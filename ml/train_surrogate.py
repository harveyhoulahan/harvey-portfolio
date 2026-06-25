#!/usr/bin/env python3
"""
Catchment — neural surrogate trainer (run this on your local GPU).

Teacher : the SAME virtual-pipes shallow-water + stream-power erosion model that
          runs in the browser (lib/catchment/sim-shaders.ts), reimplemented here
          in PyTorch so data generation is GPU-fast and physics-identical.
Student : a residual, dilated CONVOLUTIONAL NEURAL OPERATOR — a local stencil
          that is resolution-invariant, so you can train at 96² and run it at
          160²+ in the browser. (An optional FNO branch is included for
          experiments / the report, but only the conv operator exports to the
          web, because its forward pass is implementable in plain WGSL with no
          runtime dependency.)
Training: pushforward / multi-step ROLLOUT loss (Brandstetter et al.) with
          noise at every autoregressive step for stability.
Export  : public/catchment/surrogate.json  (the "catchment-surrogate-v1" contract
          consumed by the in-browser WGSL inference) and optional ONNX.

Quickstart
----------
    cd <repo>
    pip install torch numpy            # CUDA build recommended
    python ml/train_surrogate.py \
        --epochs 500 --iters 160 --batch 8 \
        --train-res 96 --channels 64 \
        --dilations 1 2 4 8 16 1 \
        --rollout 16 --noise 0.05 --lr 5e-4 --amp \
        --out public/catchment/surrogate.json
    # then just reload /catchment — the engine auto-loads the new model.

~40-90 min on a 4070-class GPU.
"""

from __future__ import annotations
import argparse, base64, glob, json, math, os, time
import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
except Exception as e:
    raise SystemExit("This script needs PyTorch. `pip install torch numpy`.\n" + str(e))


# ----------------------------------------------------------------------------
# 0. Constants — MUST match the browser engine (lib/catchment/*).
# ----------------------------------------------------------------------------
HSCALE = 80.0
G = 9.81; A = 1.0; L = 1.0; DT = 0.02
EVAP = 0.012
VEL_CLAMP = 3.0
DMEAN_FLOOR = 0.04


# ----------------------------------------------------------------------------
# 1. DEM loading
# ----------------------------------------------------------------------------
def b64_to(arr_b64: str, dtype) -> np.ndarray:
    return np.frombuffer(base64.b64decode(arr_b64), dtype=dtype)

def load_dems(catchment_dir: str, res: int, device) -> list[dict]:
    """Load every *.json DEM, resample to res², return with 8× augmentation (flip/rotate)."""
    raw_dems = []
    for path in sorted(glob.glob(os.path.join(catchment_dir, "*.json"))):
        name = os.path.basename(path)
        if name in ("maps.json", "surrogate.json"):
            continue
        d = json.load(open(path))
        if "elev16" not in d:
            continue
        n = d["n"]
        elev = b64_to(d["elev16"], "<u2").astype(np.float32).reshape(n, n) / 65535.0
        ocean = b64_to(d["ocean"], np.uint8).reshape(n, n).astype(np.float32)
        et = torch.from_numpy(elev)[None, None]
        ot = torch.from_numpy(ocean)[None, None]
        elev_r = F.interpolate(et, size=(res, res), mode="bilinear", align_corners=False)[0, 0]
        ocean_r = (F.interpolate(ot, size=(res, res), mode="nearest")[0, 0] > 0.5)
        bed = (elev_r * HSCALE).to(device)
        raw_dems.append({"name": name, "bed": bed, "ocean": ocean_r.to(device)})
    if not raw_dems:
        raise SystemExit(f"No DEMs found in {catchment_dir}")

    # Augment: 4 rotations × 2 flips = 8× more data.
    dems = []
    for d in raw_dems:
        for k in range(4):
            bed_r = torch.rot90(d["bed"], k, dims=[0, 1])
            ocean_r = torch.rot90(d["ocean"], k, dims=[0, 1])
            dems.append({"name": f"{d['name']}:r{k}", "bed": bed_r, "ocean": ocean_r})
            dems.append({"name": f"{d['name']}:r{k}f", "bed": bed_r.flip(1), "ocean": ocean_r.flip(1)})

    print(f"loaded {len(raw_dems)} DEM(s) → {len(dems)} augmented @ {res}²")
    return dems, raw_dems  # raw_dems used for validation only


# ----------------------------------------------------------------------------
# 2. Teacher physics — batched virtual-pipes shallow water (GPU).
# ----------------------------------------------------------------------------
def roll(x, dy, dx):
    return torch.roll(x, shifts=(dy, dx), dims=(-2, -1))

class ShallowWater:
    """Batched teacher. bed/ocean: (res,res). state tensors: (B,res,res)."""
    def __init__(self, bed, ocean, device):
        self.bed = bed; self.ocean = ocean; self.device = device

    def zero_state(self, B, res):
        z = lambda: torch.zeros(B, res, res, device=self.device)
        return dict(W=z(), fL=z(), fR=z(), fT=z(), fB=z(), u=z(), v=z())

    def step(self, s, rain, src_mask=None, src_amt=None):
        bed = self.bed; ocean = self.ocean
        W = s["W"] + rain[:, None, None] * DT
        if src_mask is not None and src_amt is not None:
            # src_amt can be a per-batch tensor (B,) or a scalar
            if torch.is_tensor(src_amt):
                W = W + src_mask * (src_amt[:, None, None] * DT)
            else:
                W = W + src_mask * (src_amt * DT)
        H = bed[None] + W
        Hl = roll(H, 0, 1); Hr = roll(H, 0, -1); Hu = roll(H, 1, 0); Hd = roll(H, -1, 0)
        fL = (s["fL"] + DT * A * G * (H - Hl) / L).clamp_min(0)
        fR = (s["fR"] + DT * A * G * (H - Hr) / L).clamp_min(0)
        fT = (s["fT"] + DT * A * G * (H - Hu) / L).clamp_min(0)
        fB = (s["fB"] + DT * A * G * (H - Hd) / L).clamp_min(0)
        fL[..., :, 0] = 0; fR[..., :, -1] = 0; fT[..., 0, :] = 0; fB[..., -1, :] = 0
        tot = (fL + fR + fT + fB) * DT + 1e-8
        K = torch.clamp(W * L * L / tot, max=1.0)
        fL, fR, fT, fB = fL * K, fR * K, fT * K, fB * K
        inL = roll(fR, 0, 1); inR = roll(fL, 0, -1); inT = roll(fB, 1, 0); inB = roll(fT, -1, 0)
        inL[..., :, 0] = 0; inR[..., :, -1] = 0; inT[..., 0, :] = 0; inB[..., -1, :] = 0
        inflow = inL + inR + inT + inB; outflow = fL + fR + fT + fB
        Wn = W + DT * (inflow - outflow) / (L * L)
        vx = ((inL - fL) + (fR - inR)) * 0.5
        vy = ((inT - fT) + (fB - inB)) * 0.5
        dmean = torch.clamp((W + Wn) * 0.5, min=DMEAN_FLOOR)
        u = torch.clamp(vx / (L * dmean), -VEL_CLAMP, VEL_CLAMP)
        v = torch.clamp(vy / (L * dmean), -VEL_CLAMP, VEL_CLAMP)
        Wn = Wn.clamp_min(0) * (1 - EVAP * DT)
        Wn = torch.where(ocean[None], torch.zeros_like(Wn), Wn)
        return dict(W=Wn, fL=fL, fR=fR, fT=fT, fB=fB, u=u, v=v)


def random_scenarios(B, res, device, gen):
    """Per-scenario rain rate + optional storm/pour mask."""
    rain = torch.zeros(B, device=device)
    masks = torch.zeros(B, res, res, device=device)
    amts = torch.zeros(B, device=device)
    yy, xx = torch.meshgrid(torch.arange(res, device=device), torch.arange(res, device=device), indexing="ij")
    for b in range(B):
        kind = gen.random()
        if kind < 0.5:
            rain[b] = 0.004 + 0.016 * gen.random()   # steady rain — full browser slider range
        else:
            rain[b] = 0.004 * gen.random()             # low background rain, storm-cell driven
            cx, cy = gen.random() * res, gen.random() * res
            rad = res * (0.06 + 0.08 * gen.random())
            masks[b] = ((xx - cx) ** 2 + (yy - cy) ** 2 < rad * rad).float()
            amts[b] = 0.8 + 0.8 * gen.random()
    return rain, masks, amts


# ----------------------------------------------------------------------------
# 3. Student — residual dilated conv neural operator (WGSL-deployable).
# ----------------------------------------------------------------------------
class ConvOperator(nn.Module):
    """Inputs (B,3,H,W) = [water, bedNorm, rainx100]; predicts ΔW (residual).
    Dilations grow the receptive field so fast flow is captured.
    GELU activations. All ops are standard conv2d → portable to WGSL."""
    def __init__(self, ch=64, dilations=(1, 2, 4, 8, 16, 1), use_norm=False):
        super().__init__()
        self.inp = nn.Conv2d(3, ch, 3, padding=1, padding_mode="replicate")
        self.blocks = nn.ModuleList()
        for d in dilations:
            self.blocks.append(nn.ModuleDict(dict(
                conv=nn.Conv2d(ch, ch, 3, padding=d, dilation=d, padding_mode="replicate"),
                norm=(nn.GroupNorm(8, ch) if use_norm else nn.Identity()),
            )))
        self.out = nn.Conv2d(ch, 1, 3, padding=1, padding_mode="replicate")
        nn.init.zeros_(self.out.weight); nn.init.zeros_(self.out.bias)

    def forward(self, water, bed_norm, rain):
        x = torch.stack([water, bed_norm.expand_as(water), (rain[:, None, None] * 100.0).expand_as(water)], 1)
        h = F.gelu(self.inp(x))
        for blk in self.blocks:
            h = h + F.gelu(blk["norm"](blk["conv"](h)))
        dW = self.out(h)[:, 0]
        return (water + dW).clamp_min(0.0)


class SpectralConv2d(nn.Module):
    def __init__(self, cin, cout, modes):
        super().__init__()
        self.modes = modes; s = 1 / (cin * cout)
        self.w = nn.Parameter(s * torch.rand(cin, cout, modes, modes, 2))
    def cmul(self, a, b):
        return torch.einsum("bixy,ioxy->boxy", a, torch.view_as_complex(b))
    def forward(self, x):
        B, C, H, W = x.shape; m = self.modes
        xf = torch.fft.rfft2(x)
        out = torch.zeros(B, self.w.shape[1], H, W // 2 + 1, dtype=torch.cfloat, device=x.device)
        out[:, :, :m, :m] = self.cmul(xf[:, :, :m, :m], self.w)
        return torch.fft.irfft2(out, s=(H, W))

class FNO(nn.Module):
    def __init__(self, ch=32, modes=16, layers=4):
        super().__init__()
        self.lift = nn.Conv2d(3, ch, 1)
        self.sp = nn.ModuleList([SpectralConv2d(ch, ch, modes) for _ in range(layers)])
        self.w = nn.ModuleList([nn.Conv2d(ch, ch, 1) for _ in range(layers)])
        self.proj = nn.Sequential(nn.Conv2d(ch, ch, 1), nn.GELU(), nn.Conv2d(ch, 1, 1))
    def forward(self, water, bed_norm, rain):
        x = torch.stack([water, bed_norm.expand_as(water), (rain[:, None, None] * 100.0).expand_as(water)], 1)
        h = self.lift(x)
        for sp, w in zip(self.sp, self.w):
            h = F.gelu(sp(h) + w(h))
        return (water + self.proj(h)[:, 0]).clamp_min(0.0)


# ----------------------------------------------------------------------------
# 4. Training
# ----------------------------------------------------------------------------
def train(args):
    torch.manual_seed(args.seed)
    gen = np.random.default_rng(args.seed)
    dev = torch.device(args.device if torch.cuda.is_available() or args.device == "cpu" else "cpu")
    print("device:", dev)

    dems, raw_dems = load_dems(args.catchment_dir, args.train_res, dev)
    model = (FNO() if args.fno else ConvOperator(ch=args.channels, dilations=tuple(args.dilations), use_norm=args.groupnorm)).to(dev)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"model: {'FNO' if args.fno else 'ConvOperator'}  params={n_params:,}")

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-5)

    # Linear warmup for first 10 epochs, then cosine decay.
    warmup = 10
    sched = torch.optim.lr_scheduler.SequentialLR(
        opt,
        schedulers=[
            torch.optim.lr_scheduler.LinearLR(opt, start_factor=0.1, end_factor=1.0, total_iters=warmup),
            torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, args.epochs - warmup)),
        ],
        milestones=[warmup],
    )

    scaler = torch.amp.GradScaler("cuda", enabled=args.amp)
    res = args.train_res
    best_rmse = float("inf")

    for ep in range(args.epochs):
        model.train(); t0 = time.time(); running = 0.0
        for _ in range(args.iters):
            dem = dems[gen.integers(len(dems))]
            sim = ShallowWater(dem["bed"], dem["ocean"], dev)
            bed_norm = dem["bed"] / HSCALE
            land = (~dem["ocean"]).float()
            rain, masks, amts = random_scenarios(args.batch, res, dev, gen)
            s = sim.zero_state(args.batch, res)

            # Warm to a realistic flooded state (storms OK here — they help build
            # interesting initial conditions). Per-batch amounts used correctly.
            n_warm = int(gen.integers(30, 100))
            for _ in range(n_warm):
                s = sim.step(s, rain, masks, amts)

            W = s["W"].clone()
            opt.zero_grad(set_to_none=True)

            with torch.amp.autocast("cuda", enabled=args.amp):
                loss = torch.tensor(0.0, device=dev)
                pred = W
                # Teacher rollout uses RAIN ONLY — no storm mask.
                # The model doesn't receive storm info so the teacher must not use it either.
                ts = {k: v.clone() for k, v in s.items()}
                for k in range(args.rollout):
                    ts = sim.step(ts, rain)   # rain only, no storm
                    noise_scale = args.noise * (0.5 ** k)   # decay noise each step
                    pred = model(pred + torch.randn_like(pred) * noise_scale, bed_norm, rain)
                    diff = (pred - ts["W"]) * land
                    step_w = 0.9 ** k
                    loss = loss + step_w * diff.pow(2).mean()

            scaler.scale(loss).backward()
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt); scaler.update()
            running += float(loss.detach())

        sched.step()

        if ep % max(1, args.epochs // 25) == 0 or ep == args.epochs - 1:
            rmse = eval_rollout(model, raw_dems, res, dev, steps=args.rollout)
            improved = rmse < best_rmse
            if improved:
                best_rmse = rmse
                if args.ckpt:
                    torch.save(model.state_dict(), args.ckpt)
            marker = " *" if improved else ""
            print(f"ep {ep:4d}  loss {running/args.iters:.5f}  val_rmse@{args.rollout} {rmse:.4f}"
                  f"  lr {sched.get_last_lr()[0]:.2e}  {time.time()-t0:.1f}s{marker}")

    # Export the best checkpoint, not necessarily the last epoch.
    if args.ckpt and os.path.exists(args.ckpt):
        model.load_state_dict(torch.load(args.ckpt, map_location=dev))
        print("loaded best checkpoint for export")
    export_json(model, args)
    if args.onnx:
        export_onnx(model, args, res)


@torch.no_grad()
def eval_rollout(model, raw_dems: list, res: int, dev, steps: int = 8) -> float:
    """Mean RMSE across all raw DEMs and two rain rates, averaged over all rollout steps."""
    model.eval()
    total_err = 0.0
    count = 0
    for rain_val in (0.006, 0.014):
        rain = torch.full((1,), rain_val, device=dev)
        for dem in raw_dems:
            sim = ShallowWater(dem["bed"], dem["ocean"], dev)
            bed_norm = dem["bed"] / HSCALE
            land = (~dem["ocean"]).float()
            s = sim.zero_state(1, res)
            # Warm to a realistic state matching when the browser switches to neural.
            for _ in range(60):
                s = sim.step(s, rain)
            W = s["W"].clone(); pred = W.clone()
            ts = {k: v.clone() for k, v in s.items()}
            step_err = 0.0
            for _ in range(steps):
                ts = sim.step(ts, rain)
                pred = model(pred, bed_norm, rain)
                step_err += float((((pred - ts["W"]) * land).pow(2).mean()).sqrt())
            total_err += step_err / steps
            count += 1
    return total_err / count


# ----------------------------------------------------------------------------
# 5. Export — web artifact (catchment-surrogate-v1) + ONNX.
# ----------------------------------------------------------------------------
def b64f(t: torch.Tensor) -> str:
    return base64.b64encode(t.detach().cpu().float().numpy().astype("<f4").tobytes()).decode()

def export_json(model, args):
    if args.fno:
        print("FNO is not WGSL-deployable; skipping web export (use --onnx for it).")
        return
    layers = []
    weights = {}
    def add(name, conv, act, dilation):
        weights[name + ".w"] = b64f(conv.weight)
        weights[name + ".b"] = b64f(conv.bias)
        layers.append({"name": name, "in": conv.in_channels, "out": conv.out_channels,
                       "k": conv.kernel_size[0], "dilation": dilation, "act": act,
                       "groupnorm": False})
    add("inp", model.inp, "gelu", 1)
    for i, blk in enumerate(model.blocks):
        c = blk["conv"]; nm = f"blk{i}"
        has_gn = isinstance(blk["norm"], nn.GroupNorm)
        weights[nm + ".w"] = b64f(c.weight); weights[nm + ".b"] = b64f(c.bias)
        if has_gn:
            weights[nm + ".gn_w"] = b64f(blk["norm"].weight)
            weights[nm + ".gn_b"] = b64f(blk["norm"].bias)
        layers.append({"name": nm, "in": c.in_channels, "out": c.out_channels,
                       "k": c.kernel_size[0], "dilation": c.dilation[0],
                       "act": "gelu", "residual": True,
                       "groupnorm": has_gn, **({"groups": 8} if has_gn else {})})
    add("out", model.out, "none", 1)
    model_json = {
        "format": "catchment-surrogate-v1",
        "arch": {
            "type": "conv-operator", "channels": args.channels,
            "inputs": ["water", "bedNorm", "rainx100"], "predicts": "water (residual)",
            "trainRes": args.train_res, "HSCALE": HSCALE, "dt": DT,
            "layers": layers,
        },
        "weights": weights,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    json.dump(model_json, open(args.out, "w"), separators=(",", ":"))
    kb = os.path.getsize(args.out) / 1024
    print(f"\n✅ wrote {args.out} ({kb:.1f} KB) — reload /catchment to use it.")

def export_onnx(model, args, res):
    model.eval()
    dummy = (torch.zeros(1, res, res), torch.zeros(res, res), torch.zeros(1))
    path = args.out.replace(".json", ".onnx")
    torch.onnx.export(model, dummy, path, input_names=["water", "bedNorm", "rain"],
                      output_names=["waterNext"], opset_version=17,
                      dynamic_axes={"water": {1: "h", 2: "w"}})
    print(f"   wrote {path} (ONNX, for onnxruntime-web if you prefer)")


def main():
    ap = argparse.ArgumentParser(description="Train the Catchment neural water surrogate.")
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("--catchment-dir", default=os.path.join(here, "..", "public", "catchment"))
    ap.add_argument("--out", default=os.path.join(here, "..", "public", "catchment", "surrogate.json"))
    ap.add_argument("--ckpt", default=os.path.join(here, "surrogate.pt"))
    ap.add_argument("--epochs", type=int, default=500)
    ap.add_argument("--iters", type=int, default=160, help="scenarios per epoch")
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--train-res", type=int, default=96)
    ap.add_argument("--channels", type=int, default=64)
    ap.add_argument("--dilations", type=int, nargs="+", default=[1, 2, 4, 8, 16, 1])
    ap.add_argument("--rollout", type=int, default=16, help="pushforward unroll length")
    ap.add_argument("--noise", type=float, default=0.05)
    ap.add_argument("--lr", type=float, default=5e-4)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--amp", action="store_true")
    ap.add_argument("--groupnorm", action="store_true",
                    help="GroupNorm in blocks — NOTE: not implemented in WGSL, so GPU/CPU inference will diverge")
    ap.add_argument("--fno", action="store_true", help="train FNO instead (experiments/ONNX only)")
    ap.add_argument("--onnx", action="store_true")
    args = ap.parse_args()
    args.out = os.path.abspath(args.out)
    train(args)


if __name__ == "__main__":
    main()

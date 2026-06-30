#!/usr/bin/env python3
"""
Catchment — neural surrogate trainer (run this on your local GPU).

Teacher : the SAME virtual-pipes shallow-water + stream-power erosion model that
          runs in the browser (lib/catchment/sim-shaders.ts), reimplemented here
          in PyTorch so data generation is GPU-fast and physics-identical. The
          water teacher (ShallowWater.step) is a verified 1:1 port of one browser
          water substep — DO NOT change its math without re-verifying the WGSL.
Student : a dilated CONVOLUTIONAL NEURAL OPERATOR in FLUX-DIVERGENCE form — a local
          stencil deployable in plain WGSL (3x3 dilated convs, tanh-GELU). It emits a
          2-channel edge flux (gx,gy); ΔW = divergence(flux), and rain/evaporation/
          ocean are applied analytically (canonical_step). Because the divergence of
          a flux integrates to zero, water is conserved BY CONSTRUCTION — the operator
          cannot accumulate or leak a spurious per-cell residual, which is the only
          thing that ever caused long-horizon drift.
Training: long-horizon pushforward / ROLLOUT loss with a length curriculum and
          truncated BPTT. Conservation is structural (no mass/bias loss terms or
          inference-time clamp/resync band-aids required).
Export  : public/catchment/surrogate.json  (the "catchment-surrogate-v1" contract
          consumed by the in-browser WGSL inference) and optional ONNX.

Why this version exists (root causes of the old model's drift, all fixed here):
  1. RESOLUTION: trained at 96 but deployed at 160. The L=1 virtual-pipes scheme
     is NOT grid-invariant (per-cell head drop differs by resolution), so dW was
     mis-scaled at deploy. FIX: train at the deployment resolution (--train-res 160).
  2. UNBOUNDED RESIDUAL DRIFT: predicting ΔW directly let any tiny per-step bias
     integrate without bound (water ran into the air or dried up; only an 8.0 clamp
     and a 3s resync hid it). FIX: predict FLUXES and take their divergence, so mass
     is conserved structurally. Paired with a rollout-length curriculum 16 ->
     rollout_max and truncated BPTT for long-horizon transient accuracy.
  3. GELU VARIANT: PyTorch F.gelu defaults to exact erf; the WGSL/CPU runtimes use
     the tanh approximation. ~5e-4/elem * 7 layers * every step compounds. FIX:
     approximate='tanh' everywhere.
  4. OUTPUT-OP MISMATCH: training used clamp_min(0) only with no ocean zeroing of
     the fed-back state; deploy does ocean-zero + clamp. FIX: identical output-op
     in the rollout (ocean-zero + clamp_min, NO upper cap).
  5. DISTRIBUTION GAPS: rain range, initial conditions, bed edge-fade. FIX: rain
     in [0, 0.02] incl 0; warm 0-400 rain-only with impulse blobs / partial drain;
     replicate the browser's bed edge-fade.

Quickstart
----------
    cd <repo>
    pip install torch numpy            # CUDA build recommended
    python ml/train_surrogate.py \
        --train-res 160 --channels 64 --dilations 1 2 4 8 16 1 \
        --epochs 600 --iters 160 --batch 4 \
        --rollout 16 --rollout-max 384 --bptt 24 --noise 0.05 --lr 5e-4 --amp \
        --out public/catchment/surrogate.json
    # then just reload /catchment — the engine auto-loads the new model.

~2-4 hr on a 4070-class GPU (res=160 + long rollouts).
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
EDGE_FADE = 0.10  # browser bed edge-fade fraction (Catchment.tsx coastal beach taper)


# ----------------------------------------------------------------------------
# 1. DEM loading
# ----------------------------------------------------------------------------
def b64_to(arr_b64: str, dtype) -> np.ndarray:
    return np.frombuffer(base64.b64decode(arr_b64), dtype=dtype)


def edge_fade_bed(bed: torch.Tensor) -> torch.Tensor:
    """Replicate the browser's coastal beach taper (Catchment.tsx bedInit):
    fade terrain elevation to 0 over the outer EDGE_FADE fraction via smoothstep.
    Training bedNorm must match the deployed (faded) bed bound to bed0Buf."""
    n = bed.shape[-1]
    idx = torch.arange(n, device=bed.device, dtype=torch.float32)
    d1 = torch.minimum(idx, (n - 1) - idx) / (n - 1)         # per-axis dist-to-edge
    dist = torch.minimum(d1[:, None], d1[None, :])            # (n,n) min over both axes
    t = torch.clamp(dist / EDGE_FADE, max=1.0)
    fade = t * t * (3 - 2 * t)                                # smoothstep
    return bed * fade


def load_dems(catchment_dir: str, res: int, device) -> tuple[list, list]:
    """Load every *.json DEM, resample to res^2, apply the browser edge-fade, and
    return with 8× augmentation (flip/rotate)."""
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
        bed = edge_fade_bed((elev_r * HSCALE).to(device))     # <-- deploy parity
        raw_dems.append({"name": name, "bed": bed, "ocean": ocean_r.to(device)})
    if not raw_dems:
        raise SystemExit(f"No DEMs found in {catchment_dir}")

    # Augment: 4 rotations × 2 flips = 8× more data. (edge-fade is symmetric, so it
    # commutes with rot/flip — applying before augmentation is fine.)
    dems = []
    for d in raw_dems:
        for k in range(4):
            bed_r = torch.rot90(d["bed"], k, dims=[0, 1])
            ocean_r = torch.rot90(d["ocean"], k, dims=[0, 1])
            dems.append({"name": f"{d['name']}:r{k}", "bed": bed_r, "ocean": ocean_r})
            dems.append({"name": f"{d['name']}:r{k}f", "bed": bed_r.flip(1), "ocean": ocean_r.flip(1)})

    print(f"loaded {len(raw_dems)} DEM(s) -> {len(dems)} augmented @ {res}^2")
    return dems, raw_dems  # raw_dems used for validation only


# ----------------------------------------------------------------------------
# 2. Teacher physics — batched virtual-pipes shallow water (GPU).
#    VERIFIED 1:1 port of one browser water substep. Do not modify the math.
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


def sample_rain(B, device, gen):
    """Per-scenario rain in [0, 0.02] (full browser slider incl 0) + an optional
    second rain target for in-rollout annealing (slider moves)."""
    rain0 = torch.tensor(gen.uniform(0.0, 0.020, size=B), device=device, dtype=torch.float32)
    rain1 = torch.tensor(gen.uniform(0.0, 0.020, size=B), device=device, dtype=torch.float32)
    # ~10% of scenarios sit at exactly rain=0 (drain-down / evaporation regime)
    zero = torch.tensor(gen.random(B) < 0.10, device=device)
    rain0 = torch.where(zero, torch.zeros_like(rain0), rain0)
    anneal = gen.random(B) < 0.25          # 25% anneal rain across the rollout
    return rain0, rain1, torch.tensor(anneal, device=device)


def make_initial_state(sim, B, res, rain, device, gen, warm_max=400):
    """Build a deployment-realistic initial state: warm 0-warm_max steps RAIN-ONLY
    (incl cold W=0 starts and near-equilibrium states), with occasional localized
    water blobs (pour/meteor analogue) and partial drain-downs. Trajectory DEPTH
    beyond warm_max is supplied cheaply by the replay bank in train()."""
    s = sim.zero_state(B, res)
    n_warm = int(gen.integers(0, max(1, warm_max)))
    for _ in range(n_warm):
        s = sim.step(s, rain)
    # localized impulse blobs in ~30% of scenarios (in-distribution for pour/meteor)
    if gen.random() < 0.30:
        yy, xx = torch.meshgrid(torch.arange(res, device=device),
                                torch.arange(res, device=device), indexing="ij")
        for b in range(B):
            if gen.random() < 0.5:
                continue
            cx, cy = gen.random() * res, gen.random() * res
            rad = res * (0.04 + 0.08 * gen.random())
            amt = 0.3 + 1.2 * gen.random()
            blob = torch.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * rad * rad)) * amt
            s["W"][b] = s["W"][b] + blob
    # partial drain-down in ~20%: run rain=0 for a random count after warming
    if gen.random() < 0.20:
        zero_rain = torch.zeros(B, device=device)
        for _ in range(int(gen.integers(0, 120))):
            s = sim.step(s, zero_rain)
    s["W"] = torch.where(sim.ocean[None], torch.zeros_like(s["W"]), s["W"]).clamp_min(0)
    return s


# ----------------------------------------------------------------------------
# 3. Student — residual dilated conv neural operator (WGSL-deployable).
#    GELU uses approximate='tanh' to match the WGSL/CPU tanh-GELU exactly.
# ----------------------------------------------------------------------------
def gelu(x):
    return F.gelu(x, approximate="tanh")


def flux_divergence(gx, gy):
    """ΔW from a 2-component edge flux field, in DIVERGENCE FORM (the cure for
    autoregressive drift). gx[i] = signed water flux from cell i to its RIGHT
    neighbour; gy[i] = flux to the DOWN neighbour. The outer domain boundary is
    CLOSED (no flux leaves through it) — exactly like the teacher physics, whose
    pipe flows are zeroed on the edge columns/rows.

    ΔW[i] = (inflow from left) - (outflow right) + (inflow from up) - (outflow down)

    Because every edge flux is added to one cell and subtracted from its neighbour,
    sum(ΔW) over the grid is EXACTLY zero. Net water can therefore only change via
    the analytic rain source, the analytic evaporation sink, and ocean-cell zeroing
    (see canonical_step) — never through a spurious per-cell residual bias. Runaway
    accumulation is structurally impossible, so no inference clamp/resync is needed."""
    out_r = gx.clone(); out_r[..., :, -1] = 0.0          # rightmost cells can't export right
    out_d = gy.clone(); out_d[..., -1, :] = 0.0          # bottom row can't export down
    in_l = roll(out_r, 0, 1).clone(); in_l[..., :, 0] = 0.0   # flux in from left neighbour
    in_u = roll(out_d, 1, 0).clone(); in_u[..., 0, :] = 0.0   # flux in from up neighbour
    return (in_l - out_r) + (in_u - out_d)


def canonical_step(dW, water, ocean, rain):
    """The ONE water update shared by trainer, surrogate.ts and WGSL. dW is the
    mass-conserving transport from flux_divergence; rain and evaporation are applied
    ANALYTICALLY with the same constants as the teacher physics, and ocean cells are
    zeroed. Matching this op exactly across all three runtimes is what keeps the
    autoregressive map identical at train and deploy time."""
    w1 = (water + rain[:, None, None] * DT + dW).clamp_min(0.0) * (1.0 - EVAP * DT)
    return torch.where(ocean[None], torch.zeros_like(w1), w1)


class ConvOperator(nn.Module):
    """Inputs (B,3,H,W) = [water, bedNorm, rainx100]; predicts a 2-channel EDGE FLUX
    field (gx, gy). ΔW is the divergence of that flux (flux_divergence), so the
    operator transports water mass-conservatively instead of emitting a free per-cell
    residual. Dilations grow the receptive field so fast flow is captured. All ops are
    standard conv2d + tanh-GELU -> portable to WGSL."""
    def __init__(self, ch=64, dilations=(1, 2, 4, 8, 16, 1), use_norm=False):
        super().__init__()
        self.inp = nn.Conv2d(3, ch, 3, padding=1, padding_mode="replicate")
        self.blocks = nn.ModuleList()
        for d in dilations:
            self.blocks.append(nn.ModuleDict(dict(
                conv=nn.Conv2d(ch, ch, 3, padding=d, dilation=d, padding_mode="replicate"),
                norm=(nn.GroupNorm(8, ch) if use_norm else nn.Identity()),
            )))
        self.out = nn.Conv2d(ch, 2, 3, padding=1, padding_mode="replicate")  # (gx, gy) edge flux
        nn.init.zeros_(self.out.weight); nn.init.zeros_(self.out.bias)       # start at zero flux

    def delta(self, water, bed_norm, rain):
        """Mass-conserving transport ΔW = div(flux). No rain/evap/ocean here — those
        are applied by canonical_step so the rollout and deploy share one output-op."""
        x = torch.stack([water, bed_norm.expand_as(water),
                         (rain[:, None, None] * 100.0).expand_as(water)], 1)
        h = gelu(self.inp(x))
        for blk in self.blocks:
            h = h + gelu(blk["norm"](blk["conv"](h)))
        g = self.out(h)
        return flux_divergence(g[:, 0], g[:, 1])

    def forward(self, water, bed_norm, rain, ocean=None):
        # Reference forward = full canonical step (rain + transport + evap + ocean).
        dW = self.delta(water, bed_norm, rain)
        if ocean is None:
            return (water + rain[:, None, None] * DT + dW).clamp_min(0.0) * (1.0 - EVAP * DT)
        return canonical_step(dW, water, ocean, rain)


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
        self.proj = nn.Sequential(nn.Conv2d(ch, ch, 1), nn.GELU(), nn.Conv2d(ch, 2, 1))
    def delta(self, water, bed_norm, rain):
        x = torch.stack([water, bed_norm.expand_as(water),
                         (rain[:, None, None] * 100.0).expand_as(water)], 1)
        h = self.lift(x)
        for sp, w in zip(self.sp, self.w):
            h = gelu(sp(h) + w(h))
        g = self.proj(h)
        return flux_divergence(g[:, 0], g[:, 1])
    def forward(self, water, bed_norm, rain, ocean=None):
        dW = self.delta(water, bed_norm, rain)
        if ocean is None:
            return (water + rain[:, None, None] * DT + dW).clamp_min(0.0) * (1.0 - EVAP * DT)
        return canonical_step(dW, water, ocean, rain)


# ----------------------------------------------------------------------------
# 4. Training
# ----------------------------------------------------------------------------
def rollout_len(ep, args):
    """Curriculum: hold at --rollout for the first 15% of epochs, ramp linearly to
    --rollout-max by 60%, then hold at max. Exposes the full deploy horizon."""
    frac = ep / max(1, args.epochs)
    if frac < 0.15:
        return args.rollout
    if frac >= 0.60:
        return args.rollout_max
    t = (frac - 0.15) / 0.45
    return int(round(args.rollout + t * (args.rollout_max - args.rollout)))


def loss_ramp(ep, args):
    """Ramp the mass/bias conservation terms in over epochs [15%, 30%] so the
    short-horizon step loss converges first."""
    frac = ep / max(1, args.epochs)
    if frac < 0.15:
        return 0.0
    return min(1.0, (frac - 0.15) / 0.15)


def train(args):
    torch.manual_seed(args.seed)
    gen = np.random.default_rng(args.seed)
    dev = torch.device(args.device if torch.cuda.is_available() or args.device == "cpu" else "cpu")
    print("device:", dev)

    dems, raw_dems = load_dems(args.catchment_dir, args.train_res, dev)
    model = (FNO() if args.fno else ConvOperator(ch=args.channels, dilations=tuple(args.dilations), use_norm=args.groupnorm)).to(dev)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"model: {'FNO' if args.fno else 'ConvOperator'}  params={n_params:,}")
    print(f"rollout curriculum: {args.rollout} -> {args.rollout_max} (BPTT window {args.bptt})")

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-5)
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
    best_score = float("inf")
    SFIELDS = ("W", "fL", "fR", "fT", "fB")

    # Replay bank: teacher states sampled across ALL trajectory depths. Each iter we
    # usually CONTINUE a stored state (cheap) instead of re-warming from scratch, and
    # push the rollout's final teacher state back. Over epochs the bank fills with
    # arbitrarily deep states, giving long-horizon coverage at near-zero warm cost.
    bank = []  # entries: dict(dem_idx, st={field:(B,res,res)}, rain=(B,))
    BANK_CAP = args.bank

    def bank_push(dem_idx, state, rain):
        bank.append(dict(dem_idx=dem_idx,
                         st={f: state[f].detach().clone() for f in SFIELDS},
                         rain=rain.detach().clone()))
        if len(bank) > BANK_CAP:
            bank.pop(int(gen.integers(len(bank))))

    for ep in range(args.epochs):
        model.train(); t0 = time.time(); running = 0.0
        Lroll = rollout_len(ep, args)
        K = args.bptt

        for _ in range(args.iters):
            # ---- pick a starting state: continue a deep replay state, or warm fresh ----
            if bank and gen.random() < 0.7:
                e = bank.pop(int(gen.integers(len(bank))))   # pop: avoids re-using a stale copy
                dem_idx = e["dem_idx"]; dem = dems[dem_idx]
                sim = ShallowWater(dem["bed"], dem["ocean"], dev)
                ts = {f: e["st"][f].clone() for f in SFIELDS}
                rain0 = e["rain"]
            else:
                dem_idx = int(gen.integers(len(dems))); dem = dems[dem_idx]
                sim = ShallowWater(dem["bed"], dem["ocean"], dev)
                rain0, _, _ = sample_rain(args.batch, dev, gen)
                s = make_initial_state(sim, args.batch, res, rain0, dev, gen, warm_max=args.warm)
                ts = {f: s[f] for f in SFIELDS}

            ocean = dem["ocean"]; land = (~ocean).float()
            bed_norm = dem["bed"] / HSCALE
            # Free-run the student from the (teacher) starting water — exactly the
            # browser's switch-on condition, repeated at every trajectory depth.
            pred = ts["W"].clone()

            opt.zero_grad(set_to_none=True)
            chunk = torch.zeros((), device=dev)
            iter_loss = 0.0

            for k in range(Lroll):
                with torch.amp.autocast("cuda", enabled=args.amp):
                    ts = sim.step(ts, rain0)              # teacher (constant rain, rain-only)
                    # pushforward noise, re-seeded per BPTT chunk (water channel only)
                    kc = k % K
                    noise_scale = args.noise * (0.5 ** kc)
                    inp = pred + torch.randn_like(pred) * noise_scale
                    dW = model.delta(inp, bed_norm, rain0)      # mass-conserving transport
                    # EXACT deploy output-op (rain + transport + evap + ocean), shared
                    # with surrogate.ts / WGSL via canonical_step.
                    pred = canonical_step(dW, inp, ocean, rain0)

                    diff = (pred - ts["W"]) * land
                    step_w = 0.97 ** k
                    step_loss = step_w * diff.pow(2).mean()
                    # No mass/bias conservation terms needed: the flux-divergence form
                    # makes integrated water structurally conservative, so the step loss
                    # alone supervises the (now drift-free) transport dynamics.
                    loss = step_loss

                chunk = chunk + loss
                iter_loss += float(step_loss.detach())

                # truncated BPTT: flush grads and detach state every K steps
                if (k + 1) % K == 0 or k == Lroll - 1:
                    scaler.scale(chunk).backward()
                    chunk = torch.zeros((), device=dev)
                    pred = pred.detach()
                    ts = {kk: vv.detach() for kk, vv in ts.items()}

            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt); scaler.update()
            running += iter_loss / Lroll

            # Return the (now deeper) teacher state to the bank for future continuation.
            bank_push(dem_idx, ts, rain0)

        sched.step()

        if ep % max(1, args.epochs // 30) == 0 or ep == args.epochs - 1:
            rmse, drift = eval_stability(model, raw_dems, res, dev, steps=args.eval_steps)
            score = rmse + 0.5 * drift   # select the most STABLE checkpoint
            improved = score < best_score
            if improved:
                best_score = score
                if args.ckpt:
                    torch.save(model.state_dict(), args.ckpt)
            marker = " *" if improved else ""
            print(f"ep {ep:4d}  loss {running/args.iters:.5f}  rmse@{args.eval_steps} {rmse:.4f}"
                  f"  drift {drift:.4f}  Lroll {Lroll}  lr {sched.get_last_lr()[0]:.2e}"
                  f"  {time.time()-t0:.1f}s{marker}")

    if args.ckpt and os.path.exists(args.ckpt):
        model.load_state_dict(torch.load(args.ckpt, map_location=dev))
        print("loaded best checkpoint for export")
    export_json(model, args)
    if args.onnx:
        export_onnx(model, args, res)


@torch.no_grad()
def eval_stability(model, raw_dems, res, dev, steps=384):
    """Long-horizon validation on held-out (un-augmented) DEMs at deploy resolution.
    Returns (mean per-cell RMSE over the rollout, mean BOUNDED total-water drift).

    The drift term uses a symmetric, bounded ratio |pm-tm|/(pm+tm) in [0,1]. The old
    eval divided by tm alone, which blew up to 1e4-1e7 in the rain=0 regime (teacher
    drains to ~0, so the denominator vanished) — that made checkpoint selection
    follow a measurement artifact rather than real stability. The bounded form is
    well-defined even as the teacher dries out."""
    model.eval()
    rmse_acc = 0.0; drift_acc = 0.0; count = 0
    for rain_val in (0.0, 0.003, 0.014):
        rain = torch.full((1,), rain_val, device=dev)
        for dem in raw_dems:
            sim = ShallowWater(dem["bed"], dem["ocean"], dev)
            ocean = dem["ocean"]; land = (~dem["ocean"]).float()
            bed_norm = dem["bed"] / HSCALE
            s = sim.zero_state(1, res)
            for _ in range(60):                      # warm to a realistic state
                s = sim.step(s, rain)
            pred = s["W"].clone()
            ts = {k: v.clone() for k, v in s.items()}
            step_rmse = 0.0
            for _ in range(steps):
                ts = sim.step(ts, rain)
                dW = model.delta(pred, bed_norm, rain)
                pred = canonical_step(dW, pred, ocean, rain)
                step_rmse += float((((pred - ts["W"]) * land).pow(2).mean()).sqrt())
            # drift: bounded symmetric divergence of integrated water at the final step
            pm = float((pred * land).sum()); tm = float((ts["W"] * land).sum())
            drift_acc += abs(pm - tm) / max(pm + tm, 1e-6)
            rmse_acc += step_rmse / steps
            count += 1
    return rmse_acc / count, drift_acc / count


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
    add("out", model.out, "none", 1)   # out_channels=2 -> (gx, gy) edge flux
    model_json = {
        "format": "catchment-surrogate-v2",
        "arch": {
            "type": "conv-operator", "channels": args.channels,
            "inputs": ["water", "bedNorm", "rainx100"],
            "predicts": "flux (gx,gy); water = canonical_step(div(flux))",
            "output": "flux-div",                      # final layer = 2-ch edge flux; apply = divergence + rain + evap + ocean
            "trainRes": args.train_res, "HSCALE": HSCALE, "dt": DT, "evap": EVAP,
            "gelu": "tanh",
            "layers": layers,
        },
        "weights": weights,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    json.dump(model_json, open(args.out, "w"), separators=(",", ":"))
    kb = os.path.getsize(args.out) / 1024
    print(f"\n[OK] wrote {args.out} ({kb:.1f} KB) — reload /catchment to use it.")

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
    ap.add_argument("--epochs", type=int, default=600)
    ap.add_argument("--iters", type=int, default=160, help="scenarios per epoch")
    ap.add_argument("--batch", type=int, default=4)
    ap.add_argument("--train-res", type=int, default=160, help="MUST match the browser DEM resolution")
    ap.add_argument("--channels", type=int, default=64)
    ap.add_argument("--dilations", type=int, nargs="+", default=[1, 2, 4, 8, 16, 1])
    ap.add_argument("--rollout", type=int, default=16, help="starting (min) pushforward unroll length")
    ap.add_argument("--rollout-max", type=int, default=96, help="max unroll length (depth beyond this comes from the replay bank)")
    ap.add_argument("--bptt", type=int, default=24, help="truncated-BPTT window (gradient depth)")
    ap.add_argument("--bank", type=int, default=192, help="replay-bank capacity (deep-trajectory state coverage)")
    ap.add_argument("--warm", type=int, default=160, help="max fresh warm-up steps (bank supplies deeper states)")
    ap.add_argument("--eval-steps", type=int, default=256, help="long-horizon eval rollout length (tests stability)")
    ap.add_argument("--noise", type=float, default=0.05)
    ap.add_argument("--w-mass", type=float, default=0.3, help="mass-conservation loss weight")
    ap.add_argument("--w-bias", type=float, default=1.0, help="net-residual-bias loss weight")
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

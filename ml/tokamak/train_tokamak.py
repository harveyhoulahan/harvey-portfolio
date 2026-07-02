"""
TokamakLive surrogate trainer.

Learns the forward control map  [coil currents, Ip, paxis] (6) -> psi(R,Z) (65x65),
i.e. a neural stand-in for a Grad-Shafranov equilibrium solver. Architecture is a
small dense encoder + bilinear-upsample conv decoder (5->9->17->33->65), all ops
WGSL-deployable (matmul, bilinear upsample, 3x3 conv, tanh-GELU) so the trained
model can run live in the browser like the catchment surrogate.

Run:
    python ml/tokamak/train_tokamak.py --data data.npz --epochs 400 --amp \
        --out ../../public/tokamak/surrogate.json
"""
from __future__ import annotations
import argparse, base64, json, os, time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

UP_SIZES = [9, 17, 33, 65]   # bilinear upsample schedule from a 5x5 seed
SEED_HW = 5


def gelu(x):
    return F.gelu(x, approximate="tanh")   # tanh variant -> matches WGSL/CPU


class FluxDecoder(nn.Module):
    def __init__(self, in_dim=6, base=64, chans=(48, 32, 24, 16)):
        super().__init__()
        self.base = base
        self.fc1 = nn.Linear(in_dim, 256)
        self.fc2 = nn.Linear(256, base * SEED_HW * SEED_HW)
        cin = base
        self.convs = nn.ModuleList()
        for co in chans:
            self.convs.append(nn.Conv2d(cin, co, 3, padding=1, padding_mode="replicate"))
            cin = co
        self.head = nn.Conv2d(cin, 1, 3, padding=1, padding_mode="replicate")

    def forward(self, x):
        h = gelu(self.fc1(x))
        h = gelu(self.fc2(h)).view(-1, self.base, SEED_HW, SEED_HW)
        for conv, size in zip(self.convs, UP_SIZES):
            h = F.interpolate(h, size=(size, size), mode="bilinear", align_corners=True)
            h = gelu(conv(h))
        return self.head(h)[:, 0]   # (B,65,65)


def b64f(t):
    return base64.b64encode(t.detach().cpu().float().numpy().astype("<f4").tobytes()).decode()


def export_json(model, stats, grid, labels, out):
    W = {}
    lin = lambda name, m: (W.__setitem__(name + ".w", b64f(m.weight)), W.__setitem__(name + ".b", b64f(m.bias)))
    lin("fc1", model.fc1); lin("fc2", model.fc2)
    for i, c in enumerate(model.convs):
        lin(f"conv{i}", c)
    lin("head", model.head)
    doc = {
        "format": "tokamak-surrogate-v1",
        "arch": {
            "type": "flux-decoder", "in_dim": int(stats["xmean"].shape[0]),
            "base": model.base, "seed_hw": SEED_HW, "up_sizes": UP_SIZES,
            "conv_channels": [c.out_channels for c in model.convs],
            "gelu": "tanh", "predicts": "psi(R,Z)",
            "grid": {"nx": int(grid[0]), "ny": int(grid[1]),
                     "Rmin": float(grid[2]), "Rmax": float(grid[3]),
                     "Zmin": float(grid[4]), "Zmax": float(grid[5])},
            "norm": {"xmean": stats["xmean"].tolist(), "xstd": stats["xstd"].tolist(),
                     "pmean": float(stats["pmean"]), "pstd": float(stats["pstd"])},
            "coils": [str(l) for l in labels],
        },
        "weights": W,
    }
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(doc, open(out, "w"), separators=(",", ":"))
    print(f"[OK] wrote {out} ({os.path.getsize(out)/1024:.0f} KB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data.npz")
    ap.add_argument("--epochs", type=int, default=400)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--base", type=int, default=64)
    ap.add_argument("--w-grad", type=float, default=0.3, help="weight on flux-gradient loss (sharpens surfaces)")
    ap.add_argument("--val-frac", type=float, default=0.1)
    ap.add_argument("--amp", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--ckpt", default="tokamak.pt")
    ap.add_argument("--out", default=os.path.join("..", "..", "public", "tokamak", "surrogate.json"))
    args = ap.parse_args()
    torch.manual_seed(args.seed)
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("device:", dev)

    d = np.load(args.data, allow_pickle=True)
    X = torch.tensor(d["X"], dtype=torch.float32)
    P = torch.tensor(d["psi"], dtype=torch.float32)
    grid = d["grid"]; labels = d["labels"]
    n = X.shape[0]; nval = max(1, int(n * args.val_frac))
    g = torch.Generator().manual_seed(args.seed)
    perm = torch.randperm(n, generator=g)
    vi, ti = perm[:nval], perm[nval:]

    xmean, xstd = X[ti].mean(0), X[ti].std(0).clamp_min(1e-6)
    pmean, pstd = P[ti].mean(), P[ti].std().clamp_min(1e-9)
    stats = {"xmean": xmean.numpy(), "xstd": xstd.numpy(), "pmean": pmean.item(), "pstd": pstd.item()}
    Xn = ((X - xmean) / xstd).to(dev)
    Pn = ((P - pmean) / pstd).to(dev)
    print(f"data n={n}  train={len(ti)} val={len(vi)}  psi_std={pstd:.4f}")

    model = FluxDecoder(in_dim=X.shape[1], base=args.base).to(dev)
    print("params:", sum(p.numel() for p in model.parameters()))
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
    scaler = torch.amp.GradScaler("cuda", enabled=args.amp)

    def grad_loss(a, b):  # match spatial gradients (sharper separatrix)
        return (F.l1_loss(a[:, 1:] - a[:, :-1], b[:, 1:] - b[:, :-1])
                + F.l1_loss(a[:, :, 1:] - a[:, :, :-1], b[:, :, 1:] - b[:, :, :-1]))

    ti_dev, vi_dev = ti.to(dev), vi.to(dev)
    best = float("inf")
    for ep in range(args.epochs):
        model.train(); t0 = time.time()
        idx = ti_dev[torch.randperm(len(ti_dev), device=dev)]
        tot = 0.0
        for k in range(0, len(idx), args.batch):
            b = idx[k:k + args.batch]
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", enabled=args.amp):
                pred = model(Xn[b])
                loss = F.mse_loss(pred, Pn[b]) + args.w_grad * grad_loss(pred, Pn[b])
            scaler.scale(loss).backward(); scaler.step(opt); scaler.update()
            tot += loss.item() * len(b)
        sched.step()

        if ep % 10 == 0 or ep == args.epochs - 1:
            model.eval()
            with torch.no_grad():
                pv = model(Xn[vi_dev])
                # report error in PHYSICAL psi units (denormalized)
                rmse = ((pv - Pn[vi_dev]) * pstd.to(dev)).pow(2).mean().sqrt().item()
                rel = rmse / (P[vi].std().item() + 1e-9)
            improved = rmse < best
            if improved:
                best = rmse
                torch.save(model.state_dict(), args.ckpt)
            print(f"ep {ep:4d}  loss {tot/len(idx):.5f}  val_rmse {rmse:.5f} Wb  rel {rel:.3f}"
                  f"  lr {sched.get_last_lr()[0]:.2e}  {time.time()-t0:.1f}s{' *' if improved else ''}",
                  flush=True)

    model.load_state_dict(torch.load(args.ckpt, map_location=dev))
    # speedup vs teacher (~2 s/solve)
    model.eval()
    with torch.no_grad():
        xb = Xn[vi_dev][:1]
        for _ in range(3): model(xb)
        torch.cuda.synchronize() if dev.type == "cuda" else None
        t = time.time()
        for _ in range(100): model(xb)
        torch.cuda.synchronize() if dev.type == "cuda" else None
        ms = (time.time() - t) / 100 * 1000
    print(f"best val_rmse {best:.5f} Wb   inference {ms:.2f} ms/solve   ~{2000/ms:.0f}x faster than FreeGS")
    export_json(model, stats, grid, labels, os.path.abspath(args.out))


if __name__ == "__main__":
    main()

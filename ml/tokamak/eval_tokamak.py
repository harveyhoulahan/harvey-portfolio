"""
TokamakLive eval + CPU reference inference.

Runs the exported surrogate.json through a dependency-light NumPy forward pass
(the same math the WebGPU/WGSL path will implement: standardize -> dense+tanh-GELU
-> [bilinear upsample + 3x3 conv + tanh-GELU] x4 -> head -> denormalize), compares
against held-out FreeGS ground truth, and writes a pred-vs-truth montage.

Run:  python ml/tokamak/eval_tokamak.py --data data.npz --json ../../public/tokamak/surrogate.json --out eval.png
"""
import argparse, base64, json
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def b64f(s):
    return np.frombuffer(base64.b64decode(s), dtype="<f4").copy()


def gelu(x):
    return 0.5 * x * (1.0 + np.tanh(0.7978845608028654 * (x + 0.044715 * x ** 3)))


def conv3x3(x, w, b):
    # x (cin,h,w); w (cout,cin,3,3); replicate pad; returns (cout,h,w)
    cin, h, wd = x.shape
    xp = np.pad(x, ((0, 0), (1, 1), (1, 1)), mode="edge")
    out = np.empty((w.shape[0], h, wd), np.float32)
    for co in range(w.shape[0]):
        acc = np.full((h, wd), b[co], np.float32)
        for ci in range(cin):
            for ky in range(3):
                for kx in range(3):
                    acc += w[co, ci, ky, kx] * xp[ci, ky:ky + h, kx:kx + wd]
        out[co] = acc
    return out


def upsample(x, H, W):
    # bilinear, align_corners=True (matches torch F.interpolate)
    C, h, w = x.shape
    ys = np.linspace(0, h - 1, H); xs = np.linspace(0, w - 1, W)
    y0 = np.floor(ys).astype(int); y1 = np.minimum(y0 + 1, h - 1); wy = (ys - y0)[:, None]
    x0 = np.floor(xs).astype(int); x1 = np.minimum(x0 + 1, w - 1); wx = (xs - x0)[None, :]
    out = np.empty((C, H, W), np.float32)
    for c in range(C):
        a = x[c][np.ix_(y0, x0)]; b = x[c][np.ix_(y0, x1)]
        d = x[c][np.ix_(y1, x0)]; e = x[c][np.ix_(y1, x1)]
        top = a * (1 - wx) + b * wx
        bot = d * (1 - wx) + e * wx
        out[c] = top * (1 - wy) + bot * wy
    return out


def forward(model, x):
    a = model["arch"]; W = model["W"]; nm = a["norm"]
    xn = (x - np.array(nm["xmean"], np.float32)) / np.array(nm["xstd"], np.float32)
    h = gelu(xn @ W["fc1.w"].T + W["fc1.b"])
    h = gelu(h @ W["fc2.w"].T + W["fc2.b"])
    base = a["base"]; s = a["seed_hw"]
    h = h.reshape(base, s, s)
    for i, size in enumerate(a["up_sizes"]):
        h = upsample(h, size, size)
        h = gelu(conv3x3(h, W[f"conv{i}.w"], W[f"conv{i}.b"]))
    psi = conv3x3(h, W["head.w"], W["head.b"])[0]
    return psi * nm["pstd"] + nm["pmean"]


def load_model(path):
    m = json.load(open(path))
    a = m["arch"]; base = a["base"]
    raw = m["weights"]; W = {}
    W["fc1.w"] = b64f(raw["fc1.w"]).reshape(256, a["in_dim"]); W["fc1.b"] = b64f(raw["fc1.b"])
    W["fc2.w"] = b64f(raw["fc2.w"]).reshape(base * a["seed_hw"] ** 2, 256); W["fc2.b"] = b64f(raw["fc2.b"])
    cin = base
    for i, co in enumerate(a["conv_channels"]):
        W[f"conv{i}.w"] = b64f(raw[f"conv{i}.w"]).reshape(co, cin, 3, 3); W[f"conv{i}.b"] = b64f(raw[f"conv{i}.b"]); cin = co
    W["head.w"] = b64f(raw["head.w"]).reshape(1, cin, 3, 3); W["head.b"] = b64f(raw["head.b"])
    return {"arch": a, "W": W}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data.npz")
    ap.add_argument("--json", default="../../public/tokamak/surrogate.json")
    ap.add_argument("--n", type=int, default=6)
    ap.add_argument("--out", default="eval.png")
    args = ap.parse_args()

    model = load_model(args.json)
    g = model["arch"]["grid"]
    R = np.linspace(g["Rmin"], g["Rmax"], g["nx"]); Z = np.linspace(g["Zmin"], g["Zmax"], g["ny"])
    RR, ZZ = np.meshgrid(R, Z, indexing="ij")

    d = np.load(args.data, allow_pickle=True)
    X, P = d["X"], d["psi"]
    rng = np.random.default_rng(1)
    idx = rng.choice(len(X), size=min(args.n, len(X)), replace=False)

    rmses = []
    fig, axes = plt.subplots(3, len(idx), figsize=(2.6 * len(idx), 8))
    for col, k in enumerate(idx):
        true = P[k]; pred = forward(model, X[k].astype(np.float32))
        rmse = float(np.sqrt(np.mean((pred - true) ** 2))); rmses.append(rmse)
        for row, (fld, title) in enumerate([(true, "FreeGS"), (pred, "surrogate"), (pred - true, "error")]):
            ax = axes[row, col] if len(idx) > 1 else axes[row]
            cmap = "RdBu_r" if row == 2 else "plasma"
            ax.contourf(RR, ZZ, fld, 40, cmap=cmap)
            if row < 2:
                ax.contour(RR, ZZ, fld, 20, colors="white", linewidths=0.25, alpha=0.5)
            ax.set_aspect("equal"); ax.set_xticks([]); ax.set_yticks([])
            if col == 0: ax.set_ylabel(title, fontsize=11)
            if row == 0: ax.set_title(f"#{k}  rmse={rmse:.4f}", fontsize=8)
    fig.suptitle(f"TokamakLive surrogate vs FreeGS  |  mean psi-RMSE = {np.mean(rmses):.5f} Wb", fontsize=12)
    plt.tight_layout(); plt.savefig(args.out, dpi=95, bbox_inches="tight")
    print(f"[OK] wrote {args.out}   mean psi-RMSE {np.mean(rmses):.5f} Wb over {len(idx)} held-out cases")


if __name__ == "__main__":
    main()

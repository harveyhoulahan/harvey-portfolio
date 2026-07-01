#!/usr/bin/env python3
"""Forward-pass parity test: exported surrogate.json (run through PyTorch) MUST equal
the lib/catchment/surrogate.ts CPU math. Catches the GELU-variant class of bug.

The numpy reference below is a hand port of surrogate.ts (independent tanh-GELU
formula, replicate-pad dilated conv, residual on in==out, 2-channel edge-flux output,
flux divergence) — it shares NO gelu/divergence code with PyTorch, so agreement is
meaningful, not circular. We compare the transport ΔW = div(flux) on both sides
(isolates the forward pass + divergence; rain/evap/ocean are trivial elementwise).

Usage: python ml/parity_test.py [path/to/surrogate.json]
"""
import sys, json, base64
import numpy as np
import torch

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from train_surrogate import ConvOperator  # noqa: E402

PATH = sys.argv[1] if len(sys.argv) > 1 else "public/catchment/surrogate.json"
N = 160

def b64f(b64): return np.frombuffer(base64.b64decode(b64), dtype="<f4").copy()

# ---- numpy reference mirroring lib/catchment/surrogate.ts EXACTLY ----
def ts_gelu(x):  # surrogate.ts gelu (hardcoded tanh approx)
    return 0.5 * x * (1.0 + np.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)))

def ts_conv(inp, cin, h, w, weight, bias, cout, dil):
    out = np.zeros((cout, h, w), dtype=np.float64)
    W = weight.reshape(cout, cin, 3, 3).astype(np.float64)
    def clamp(v, hi): return 0 if v < 0 else (hi if v > hi else v)
    for co in range(cout):
        acc = np.full((h, w), bias[co], dtype=np.float64)
        for ci in range(cin):
            for ky in range(3):
                for kx in range(3):
                    wv = W[co, ci, ky, kx]
                    if wv == 0: continue
                    # gather with replicate padding, dilation
                    sub = np.empty((h, w), dtype=np.float64)
                    for y in range(h):
                        sy = clamp(y + (ky - 1) * dil, h - 1)
                        for x in range(w):
                            sx = clamp(x + (kx - 1) * dil, w - 1)
                            sub[y, x] = inp[ci, sy, sx]
                    acc += sub * wv
        out[co] = acc
    return out

def ts_flux_div(gx, gy, n):  # mirrors fluxDivergence() in surrogate.ts (closed boundary)
    dW = np.zeros((n, n), dtype=np.float64)
    for y in range(n):
        for x in range(n):
            outR = gx[y, x] if x < n - 1 else 0.0
            inL = gx[y, x - 1] if x > 0 else 0.0
            outD = gy[y, x] if y < n - 1 else 0.0
            inU = gy[y - 1, x] if y > 0 else 0.0
            dW[y, x] = inL - outR + (inU - outD)
    return dW

def ts_forward(model_json, water, bed_norm, rain, n):
    arch = model_json["arch"]; Wts = model_json["weights"]
    cur = np.stack([water, bed_norm, np.full((n, n), rain * 100.0)], 0).astype(np.float64)
    curC = 3
    for ly in arch["layers"]:
        z = ts_conv(cur, curC, n, n, b64f(Wts[ly["name"] + ".w"]), b64f(Wts[ly["name"] + ".b"]),
                    ly["out"], ly["dilation"])
        a = ly["act"]
        if a == "gelu": z = ts_gelu(z)
        elif a == "relu": z = np.maximum(z, 0)
        if ly.get("residual") and ly["in"] == ly["out"]:
            z = z + cur
        cur = z; curC = ly["out"]
    return ts_flux_div(cur[0], cur[1], n)   # ΔW = divergence of the 2-ch edge flux

def main():
    m = json.load(open(PATH))
    assert m["format"] == "catchment-surrogate-v2", f"expected v2, got {m['format']}"
    print(f"model: {PATH}  trainRes={m['arch'].get('trainRes')}  gelu={m['arch'].get('gelu','?')}")

    # rebuild PyTorch model from exported weights
    ch = m["arch"]["channels"]
    dils = [ly["dilation"] for ly in m["arch"]["layers"] if ly["name"].startswith("blk")]
    net = ConvOperator(ch=ch, dilations=tuple(dils), use_norm=False).eval().double()
    sd = {}
    W = m["weights"]
    sd["inp.weight"] = torch.tensor(b64f(W["inp.w"]).reshape(ch, 3, 3, 3))
    sd["inp.bias"] = torch.tensor(b64f(W["inp.b"]))
    for i in range(len(dils)):
        sd[f"blocks.{i}.conv.weight"] = torch.tensor(b64f(W[f"blk{i}.w"]).reshape(ch, ch, 3, 3))
        sd[f"blocks.{i}.conv.bias"] = torch.tensor(b64f(W[f"blk{i}.b"]))
    sd["out.weight"] = torch.tensor(b64f(W["out.w"]).reshape(2, ch, 3, 3))
    sd["out.bias"] = torch.tensor(b64f(W["out.b"]))
    net.load_state_dict({k: v.double() for k, v in sd.items()})

    # use a SMALL grid for the O(n^2 * cin*cout*9) numpy reference
    n = 24
    rng = np.random.default_rng(0)
    water = rng.uniform(0, 0.4, (n, n)).astype(np.float32)
    bed_norm = rng.uniform(0, 1, (n, n)).astype(np.float32)
    rain = 0.012

    with torch.no_grad():
        # transport ΔW = div(flux) on BOTH sides (isolates forward pass + divergence)
        py = net.delta(torch.tensor(water, dtype=torch.float64)[None],
                       torch.tensor(bed_norm, dtype=torch.float64),
                       torch.tensor([rain], dtype=torch.float64))[0].numpy()
    ref = ts_forward(m, water.astype(np.float64), bed_norm.astype(np.float64), rain, n)

    diff = np.abs(py - ref)
    print(f"grid {n}x{n}  max|PyTorch - surrogate.ts(numpy)| = {diff.max():.3e}  mean = {diff.mean():.3e}")
    ok = diff.max() < 1e-4
    print("PARITY", "PASS" if ok else "FAIL", "(threshold 1e-4)")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()

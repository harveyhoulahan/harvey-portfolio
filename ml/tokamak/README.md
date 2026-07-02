# TokamakLive — neural surrogate of a fusion plasma equilibrium

A neural operator that replaces a Grad–Shafranov equilibrium solver: given the
poloidal-field **coil currents** (+ plasma current `Ip` and on-axis pressure
`paxis`) it predicts the **poloidal flux field ψ(R,Z)** — the thing that defines the
plasma shape, flux surfaces and X-point. It runs in **sub-millisecond** time vs
~2 s for the physics solver (~1000–3000×), the point being an interactive,
in-browser "move the coils, reshape the plasma" demo.

## Pipeline

| Stage | File | What it does |
|-------|------|--------------|
| Teacher | `freegs_compat.py` | FreeGS + modern-SciPy/Py3.14 compat shim (portable; no site-packages edits) |
| Data | `gen_data.py` | samples plasma **shapes**, lets FreeGS solve for the **coils**, saves `(coils,Ip,paxis) -> ψ` pairs |
| Train | `train_tokamak.py` | dense encoder + bilinear-upsample conv decoder (5→9→17→33→65); exports web JSON |
| Eval | `eval_tokamak.py` | NumPy CPU inference **straight from the JSON** (= the WebGPU reference) + pred-vs-FreeGS montage |
| Orchestrate | `run_all.py` | runs all three unattended |

## Run it (overnight)

```bash
# from the repo root
python ml/tokamak/run_all.py --n 4000 --epochs 400
```

- Data generation: ~5–6 s per valid equilibrium (~38 % of shape samples confine a
  plasma), so **4000 samples ≈ 6 h**. Training is fast on GPU (~minutes). Bump `--n`
  for a sharper model if you have the time.
- Outputs: `ml/tokamak/eval.png` (look here first), `ml/tokamak/tokamak.pt`,
  and `public/tokamak/surrogate.json` (web-ready).

## Notes / status

- Verified end-to-end on a tiny set: trainer runs, exports; NumPy-from-JSON matches
  PyTorch to **6e-8** (parity), inference ~0.7 ms → ~3000× faster than FreeGS.
- The model architecture is deliberately WGSL-friendly (matmul, bilinear upsample,
  3×3 conv, tanh-GELU) so the browser demo reuses the catchment PyTorch→WebGPU
  approach. `eval_tokamak.py::forward` is the exact reference to port to WGSL.
- **Next session (after the model exists):** build the `/tokamak` WebGPU demo —
  coil-current sliders → live ψ contours + last-closed-flux-surface / X-point.

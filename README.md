# hjhportfolio.com

Portfolio of **Harvey Houlahan** — spatial systems, GPU simulation and neural
surrogates for climate, carbon & nature tech. Live at
**[hjhportfolio.com](https://hjhportfolio.com)**.

The interesting parts of this repo are not the website. They are the two
GPU-native simulations it ships, and the ML pipeline that trains a neural
network to replace one of them.

---

## Catchment — physics vs neural, in a browser tab

**[hjhportfolio.com/catchment](https://hjhportfolio.com/catchment)**

A living catchment in raw WebGPU: a virtual-pipes shallow-water solver carves
real terrain, rain falls in storm cells, fire spreads with the wind, water
fights it back. Drag to orbit; pour, ignite.

Then the part that matters:

- **`ml/train_surrogate.py`** trains a small, resolution-invariant
  convolutional **neural operator** to emulate the shallow-water step —
  *physics as the teacher, the network as the student* (the
  GraphCast / NeuralGCM idea, shrunk to a catchment). Pushforward-unrolled
  training for long-rollout stability; flux-divergence output form so
  transport is conservative by construction.
- The trained model exports to a plain-JSON weight contract
  (`public/catchment/surrogate.json`) and executes in the browser as a stack
  of **hand-written WGSL compute passes** — no ONNX runtime, no TensorFlow.js,
  no runtime dependency at all.
- The demo runs **physics and the surrogate side-by-side** with a live error
  field and speed-up readout. The failure modes are visible on purpose;
  surrogates drift, and showing where is the honest part.
- Trained across every DEM in `public/catchment/` with randomised rain and
  storm forcing, so one model generalises across worlds, and across
  resolutions (train at 96², run at 160²+).

Training details and the weight-format contract: [`ml/README.md`](ml/README.md).

## Genesis — an artificial-life lab

**[hjhportfolio.com/genesis](https://hjhportfolio.com/genesis)**

Continuous cellular automata (Lenia), a 6-species particle-life system, and
Conway for reference — all evolving live on the GPU. Describe a lifeform in
plain English and an in-browser **CLIP** model plus **separable CMA-ES**
search coax it out of the simulation. Entirely client-side: the foundation
model runs on your machine, not on a server.

## TokamakLive — next up

[`ml/tokamak/`](ml/tokamak) trains a neural operator to replace a
**Grad–Shafranov fusion-plasma equilibrium solver** (FreeGS): coil currents in,
poloidal-flux field out, ~0.7 ms instead of ~2 s (≈3000×), NumPy-from-JSON
parity with PyTorch to 6e-8. The in-browser "move the coils, reshape the
plasma" demo reuses the Catchment PyTorch→WGSL deployment path. In progress.

---

## Stack

**Site** — Next.js 14 (App Router), TypeScript, Tailwind, Framer Motion.
All copy lives in `data/*.ts`, not JSX.

**Simulation & ML** — raw WebGPU/WGSL (no engine, no wrapper library),
PyTorch for training, a custom JSON weight format for browser inference.

```
app/           routes (catchment, genesis, playground, projects, …)
components/    UI + the two full-screen demos
lib/           WGSL kernels, surrogate decoding, sim engines
ml/            PyTorch training: catchment surrogate + tokamak equilibrium
public/        DEMs, trained weights (surrogate.json), papers
data/          every word of site copy, typed
```

## Run it

```bash
npm install
npm run dev        # site on localhost:3000 — demos need a WebGPU browser

# retrain the catchment surrogate (CUDA torch recommended)
python ml/train_surrogate.py --epochs 300 --iters 80 --batch 8 \
  --train-res 96 --rollout 8 --amp --out public/catchment/surrogate.json
```

© 2026 Harvey Houlahan

# Catchment — research brief: techniques to spice up the demo

*Deep scan of recent (2024–2026) research and production techniques, mapped to our WebGPU
engine. Each entry = the idea · why it's current · the source · exactly how we'd use it ·
rough effort (S/M/L) and impact (★).* Read alongside `CATCHMENT.md` and `CATCHMENT_HANDOFF.md`.

The short version: the most differentiated, on-brand wins are (1) a **neural surrogate** that
runs the sim — ideally a **Fourier Neural Operator**, not a plain U-Net; (2) **neural
super-resolution** ("DLSS for simulation"): simulate coarse, learn the fine detail; (3) a
**probabilistic / diffusion** fire forecast that renders an **uncertainty band**; and on the
render side (4) **atmosphere + volumetric clouds + cloud shadows**, (5) an **FFT ocean** for the
sea, and (6) **GPU-driven geometry clipmaps** so the terrain can be huge and zoomable.

---

## 1. The ML headliner — what the surrogate should actually be

### 1a. Fourier Neural Operator (FNO), not just a CNN ★★★ · effort M
The de-facto baseline for learned PDE solvers. FNO does learnable convolutions in the **Fourier
domain**, is **discretization-invariant** (train at 128², infer at 256²), and is excellent on
smooth fields like shallow water / diffusion — exactly our regime. Adaptive-FNO weather models
produce week-long global forecasts in **under 2 seconds**, which is the whole "student beats the
teacher" story we want.
- *Sources:* FNO practical guide ([arXiv 2512.01421](https://arxiv.org/pdf/2512.01421)); unifying
  view of PINNs vs operators ([arXiv 2601.14517](https://arxiv.org/pdf/2601.14517)).
- *Use here:* M4 surrogate = small FNO mapping `(water, sediment, bed, forcings)_t → _{t+k}`.
  Export ONNX, run in-browser (§3). Headline metric: neural ms vs physics ms + rollout horizon.

### 1b. Stable long rollouts — SGNO / pushforward ★★★ · effort M
Single-step training looks great then explodes on rollout. The 2025 fix: **Spectral Generator
Neural Operator (SGNO)**, a residual operator built for **stable long-horizon autoregressive
rollouts**, plus pushforward/multi-step training (the GraphCast trick).
- *Source:* [SGNO, arXiv 2602.18801](https://arxiv.org/html/2602.18801v1).
- *Use here:* train with a 4–8 step unrolled loss; report the rollout-stability curve as a
  figure in the write-up. This is the honest scientific result of the piece.

### 1c. Latent / reduced neural simulation ★★ · effort L
SIGGRAPH Asia 2024 **Neural Implicit Reduced Fluid Simulation** evolves fluid in a tiny latent
space via a neural ODE — latent trajectories cost almost nothing yet preserve fine detail.
- *Source:* [NIRFS, SIGGRAPH Asia 2024](https://dl.acm.org/doi/10.1145/3680528.3687628).
- *Use here:* aspirational "ludicrous speed" mode — encode the whole catchment state to a latent
  and roll it forward; decode for display. Big speed-up headline if M4 succeeds first.

## 2. Neural super-resolution — "DLSS for the simulation" ★★★ · effort M
The cleanest way to get *both* speed and beauty: run the physics at a cheap resolution, then
**learn the high-frequency detail**. Temporally-coherent GAN super-res for smoke/turbulence
(tempoGAN) is the classic; 2024 brought **diffusion** (PiRD) and **multiscale graph-NN**
super-resolution that hallucinate physically-plausible fine structure from coarse fields.
- *Sources:* [tempoGAN](https://arxiv.org/pdf/1801.09710); [PiRD physics-informed residual
  diffusion (2024)](https://arxiv.org/pdf/2404.08412); [mesh GNN super-res
  (2024)](https://arxiv.org/pdf/2409.07769); curated list
  ([Physics-Based-Deep-Learning](https://github.com/thunil/Physics-Based-Deep-Learning)).
- *Use here:* simulate water/erosion at 128², neural-upscale the detail to 512² for the render.
  Demoable A/B: "raw 128² vs neural-upscaled." Directly fixes the faceted/low-detail look while
  staying fast — a genuinely novel thing to show in a browser.

## 3. Running the model in the browser ★★★ · effort S–M
The runtime exists and is fast. **ONNX Runtime Web's WebGPU backend** (Microsoft, 2024) runs
real models in-tab; Transformers.js now WebGPU-accelerates most models; WebGPU vs WASM is a
**10–15×** difference. Same device as our sim → we can marshal state textures ↔ tensors without
leaving the GPU.
- *Sources:* [ORT Web + WebGPU (Microsoft, 2024)](https://opensource.microsoft.com/blog/2024/02/29/onnx-runtime-web-unleashes-generative-ai-in-the-browser-using-webgpu/);
  [WebGPU dispatch-overhead study (2026)](https://arxiv.org/pdf/2604.02344).
- *Use here:* `onnxruntime-web` (WebGPU EP) is the M4 inference path; mind per-dispatch overhead
  (batch the rollout, keep tensors on-GPU).

## 4. Fire: from CA to a learned, probabilistic forecast ★★★ · effort M
Our heat-CA is fine; the research frontier makes it both more realistic and more *interesting*:
- **DL-derived CA transition rules** — learn the spread rules instead of hand-tuning them
  ([ScienceDirect 2025](https://www.sciencedirect.com/science/article/pii/S1574954125001591)).
- **CNN/ConvLSTM emulators of Rothermel** — Allaire's hybrid net emulates a numerical fire
  simulator (review: [MDPI Fire 2024, 7(12):482](https://www.mdpi.com/2571-6255/7/12/482)).
- **Probabilistic spread** via **denoising diffusion / conditional flow matching** (2025) —
  predict a *distribution* of fire fronts, not one line
  ([flow-matching, arXiv 2603.26975](https://arxiv.org/pdf/2603.26975)).
- *Use here:* the killer interaction — light a fire and render an **uncertainty band** (10th–90th
  percentile front) from an ensemble/diffusion surrogate. "Where will it *probably* be in an
  hour?" is exactly what real fire agencies want, and nobody's portfolio shows it in a browser.

## 5. Water rendering — FFT ocean + proper shading ★★ · effort M
Our sea is a flat plane; the sim water is alpha-blended. Upgrade both:
- **Tessendorf FFT ocean** for the sea: GPU FFT of a wave spectrum → displacement + normals;
  **foam from the negative Jacobian** (where wave peaks curl); LOD via projected screen-space
  grid. There's already a **WebGPU FFT ocean** reference implementation.
- *Sources:* [WebGPU FFT ocean (2024)](https://barthpaleologue.github.io/Blog/posts/ocean-simulation-webgpu/);
  [hybrid wave-particle + FFT (2025)](https://arxiv.org/pdf/2511.02852);
  [Insomniac water (classic)](https://www.gamedevs.org/uploads/insomniac-water.pdf).
- *Use here:* swap the ocean plane for an FFT surface; add depth absorption + planar/sky
  reflection + Jacobian foam to the *sim* water too (we already have the velocity field for
  flow-mapped normals).

## 6. Sky, atmosphere & volumetric clouds ★★★ · effort M
Single biggest "AAA" upgrade after shadows. Hillaire's **scalable sky+atmosphere** (LUT-based
single/multi-scatter) + Schneider-style **volumetric clouds** with **cloud shadows** drifting
over the terrain. 2024 work even uses ML to optimize the cloud shader.
- *Sources:* Hillaire scalable sky+atmosphere (industry standard);
  [real-time clouds survey 2024](http://sibgrapi.sid.inpe.br/col/sid.inpe.br/sibgrapi/2024/08.29.14.04/doc/ford-77.pdf);
  [ML-driven volumetric clouds (2025)](https://arxiv.org/pdf/2502.08107).
- *Use here:* gradient sky dome + sun disc + aerial-perspective fog (cheap, do first); drifting
  cloud-shadow mask on the sunlight term (cheap, huge); full volumetric clouds (later).

## 7. GPU-driven geometry — make it huge & zoomable ★★ · effort M–L
To zoom from catchment to continent without faceting:
- **GPU geometry clipmaps** (Hoppe/Asirvatham) — nested LOD rings morphed in a vertex shader,
  all on-GPU. The pragmatic, WebGPU-friendly choice.
- **Nanite-style cluster LOD / mesh shaders** — sub-pixel detail, cluster culling (aspirational;
  WebGPU lacks mesh shaders today, but compute-rasterization is possible).
- *Sources:* [Geometry clipmaps (GPU Gems 2)](https://hhoppe.com/gpugcm.pdf);
  [Nanite virtualized geometry](https://medium.com/@GroundZer0/nanite-epics-practical-implementation-of-virtualized-geometry-e6a9281e7f52);
  [Aokana GPU-driven voxel framework (2025)](https://arxiv.org/pdf/2505.02017).
- *Use here:* clipmaps unlock the M3.6 "swappable / zoomable real DEM" idea at continental scale.

## 8. Photoreal mode via 3D Gaussian Splatting ★ · effort L (aspirational)
For a "real place" backdrop: stream a **3DGS** reconstruction of an actual catchment. 2025 work
solved the large-scene problems — **LODGE** (level-of-detail chunked streaming), aerial GS from
ultra-high-res imagery, anti-aliased large-scale GS.
- *Sources:* [LODGE (2025)](https://arxiv.org/html/2505.23158v2);
  [aerial GS, CGF 2025](https://onlinelibrary.wiley.com/doi/10.1111/cgf.70265?af=R).
- *Use here:* optional toggle — drape the sim's water/fire over a photoreal splat of a real
  valley. Heavy; keep as a "wow finale," not core.

## 9. Foundation-model embeddings as the material layer ★★ · effort M
Ties the flagship back to the playground's Embedding Atlas. Use **AlphaEarth Foundations**
64-d satellite embeddings (or our learned embeddings) to drive **landcover-accurate texturing**
(forest/rock/grass/urban) and realistic albedo on the terrain — and let the same embeddings seed
fuel/vegetation for the fire sim. Real data → real materials.
- *Use here:* per-cell embedding → small MLP → (albedo, roughness, fuel, veg type). One coherent
  story across both demos.

---

## Recommended sequencing (what actually moves the needle)

1. **M3.5 render overhaul** (handoff Track A) + **§6 sky/atmosphere/cloud-shadows** + **§5 water
   shading** → the "beautiful in 5 seconds" jump. *Mostly shader work, no ML.*
2. **§2 neural super-resolution** → fixes detail *and* perf, novel, sets up the ML runtime.
3. **M4 surrogate as an FNO (§1a/1b)** running via **ORT-Web WebGPU (§3)** → the research climax,
   physics-vs-neural split-screen + rollout-stability figure.
4. **§4 probabilistic fire** uncertainty band → the most "nobody-has-this" interaction.
5. **§7 clipmaps** + **§9 embedding materials** → scale + real-data richness. **§8 splatting** =
   optional finale.

---

### Sources
- FNO practical — https://arxiv.org/pdf/2512.01421 · SGNO stable rollouts — https://arxiv.org/html/2602.18801v1 · PINN/operator unifying view — https://arxiv.org/pdf/2601.14517
- NIRFS (SIGGRAPH Asia 2024) — https://dl.acm.org/doi/10.1145/3680528.3687628 · tempoGAN — https://arxiv.org/pdf/1801.09710 · PiRD diffusion super-res — https://arxiv.org/pdf/2404.08412 · mesh-GNN super-res — https://arxiv.org/pdf/2409.07769 · PBDL list — https://github.com/thunil/Physics-Based-Deep-Learning
- ONNX Runtime Web + WebGPU — https://opensource.microsoft.com/blog/2024/02/29/onnx-runtime-web-unleashes-generative-ai-in-the-browser-using-webgpu/ · WebGPU dispatch overhead — https://arxiv.org/pdf/2604.02344
- Wildfire CA + DL rules — https://www.sciencedirect.com/science/article/pii/S1574954125001591 · ML/DL wildfire review — https://www.mdpi.com/2571-6255/7/12/482 · probabilistic flow-matching — https://arxiv.org/pdf/2603.26975
- WebGPU FFT ocean — https://barthpaleologue.github.io/Blog/posts/ocean-simulation-webgpu/ · hybrid wave-particle FFT — https://arxiv.org/pdf/2511.02852 · Insomniac water — https://www.gamedevs.org/uploads/insomniac-water.pdf
- Volumetric clouds survey 2024 — http://sibgrapi.sid.inpe.br/col/sid.inpe.br/sibgrapi/2024/08.29.14.04/doc/ford-77.pdf · ML volumetric clouds — https://arxiv.org/pdf/2502.08107
- Geometry clipmaps — https://hhoppe.com/gpugcm.pdf · Nanite — https://medium.com/@GroundZer0/nanite-epics-practical-implementation-of-virtualized-geometry-e6a9281e7f52 · Aokana GPU voxel — https://arxiv.org/pdf/2505.02017
- LODGE large-scale GS — https://arxiv.org/html/2505.23158v2 · aerial GS (CGF 2025) — https://onlinelibrary.wiley.com/doi/10.1111/cgf.70265?af=R

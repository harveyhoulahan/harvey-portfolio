# CATCHMENT

### A browser-native neural Earth engine

*Working title — alternatives: Watershed, Telluria, Living Catchment. Codename here: **Catchment**.*

> Operate a living piece of land. Drag the wind, dump rain, drop a spark — and watch water
> carve the real topography, fire climb the slopes, vegetation and carbon answer back, all
> simulated live on your GPU. Then train a neural surrogate to run the whole world faster than
> physics can, and watch — as a shimmer of error — exactly where the student diverges from the
> teacher.

This document is the North Star for a multi-week, multi-iteration flagship on
`harveyhoulahan.com/catchment`. It is deliberately ambitious. Each milestone is independently
shippable, so the project is impressive at every stage, not just at the end.

---

## 1. Thesis

The single biggest movement at the intersection of AI and the geosciences right now is the rise of
**neural emulators of physical Earth systems** — models that learn the dynamics of the atmosphere,
ocean, and land surface from data (or from simulators) and then run those dynamics orders of
magnitude faster than the numerical models they replace. GraphCast, NeuralGCM, Aurora, FourCastNet,
and the surrounding "digital twin" programmes (NVIDIA Earth-2, the EU's Destination Earth) are all
instances of one idea: **physics is the teacher; a neural network is the student; the student, once
trained, is cheap enough to run anywhere.**

Catchment makes that idea *tangible and interactive*, shrunk from the planet to a single
catchment, and placed entirely inside a browser tab. It is simultaneously:

- a **real-time GPU physics sandbox** (hydrology + erosion + fire + vegetation over real terrain),
- a **live demonstration of ML surrogate modelling** (a trained net predicting the next world-state),
- and a **piece of spatial-data infrastructure engineering** — the exact discipline this portfolio is about.

The enabling technology only became broadly viable in the last year: **WebGPU** — which exposes GPU
compute shaders *and* on-device neural inference to web pages — shipped in Safari on iOS 26 / macOS 26
in September 2025, and is stable in Chrome/Edge and available in Firefox on Windows. A real Earth
engine in a browser was not practical before this; it is now.

### Why this project, for this person

It is the cleanest possible proof of the homepage's closing claim, *"Let's build something
spatial."* It exercises every axis of the work — spatial data, GPU programming, numerical
simulation, machine learning, and the systems plumbing to make them coexist at 60 fps — and it
produces, at the end, a genuine research-style artifact: *a browser-native neural surrogate for
catchment-scale Earth-system dynamics.*

---

## 2. Research grounding

Catchment is a hand-built miniature of a real and very active research programme. The reference
points we are deliberately echoing:

| Strand | Anchors | What we borrow |
| --- | --- | --- |
| Neural weather/climate emulators | GraphCast (0.25°, orders-of-magnitude faster than NWP); NeuralGCM (hybrid physics + ML, matches operational skill to ~5 days); Aurora (a 3D "foundation" Earth model across weather, air quality, ocean waves); FourCastNet | The **surrogate** paradigm; **pushforward / rollout-stability** training; physics-vs-neural evaluation |
| Earth digital twins | NVIDIA **Earth-2**; EU **Destination Earth**; CREDIT / community ESM-AI frameworks | Framing: an interactive, steerable twin of a place |
| GPU simulation | Mei et al. 2007 *Fast Hydraulic Erosion Simulation* (the "virtual pipes" model); Stam *Stable Fluids*; Rothermel surface fire spread | The **physics kernels** that run in compute shaders |
| In-browser GPU + neural | WebGPU (Safari 26, Chrome/Edge, FF/Win); `onnxruntime-web` WebGPU EP; WebGPU 3D Gaussian-splatting engines (WebSplatter, Visionary) | The **runtime**: compute + ONNX inference in one device |

The intellectual honesty of the piece is that it is *small but real*: real terrain analysis, real
GPU physics, a really-trained surrogate, with all simplifications stated plainly.

---

## 3. The experience

A full-bleed page (escapes the site's reading-column layout) holding a single 3D world.

- **The world.** A 3D catchment built from a real digital-elevation model — the Byron hinterland we
  already generate, at higher resolution. Orbit and fly with mouse / touch / WASD. Architectural
  light, the site palette (sage / sand / ink on concrete), restrained until you touch it.
- **The instruments.** A slim control rail: **wind** (drag a compass vector), **rain** (a slider; or
  click-drag to paint a storm cell), **ignition** (drop sparks), **season / time-of-day**, and a
  master **play / pause / step / reset**.
- **The response.** Water pools in hollows, threads into the drainage network, and — over time —
  *erodes* the terrain it flows over (sediment picked up on steep fast reaches, dropped in slow
  ones). Fire, once lit, advances faster uphill and downwind, slower through wet or sparse fuel,
  leaving a char scar that vegetation slowly reclaims. A carbon/biomass layer breathes with the
  vegetation.
- **The twist (the headline).** A **"Neural" toggle**. Flip it and a trained surrogate takes over
  stepping the world. A split-screen or A/B wipe shows **physics vs. neural**; a third panel shows
  the **error field** (where the surrogate is wrong) and a running **speed-up factor** (e.g. "neural
  step: 1.8 ms · physics step: 190 ms · 105×"). Push "rollout" and watch how many steps the
  surrogate stays faithful before it drifts — the central scientific question of the whole field,
  made playable.
- **The readout.** A quiet HUD: water volume, area burned, biomass / carbon, peak discharge — and a
  one-paragraph "how it works" that updates with the active lens.

The emotional arc in ten seconds: *"that's a real landscape… wait, the water is carving it… I can
set it on fire… and a neural net just ran the entire thing 100× faster than the physics."*

---

## 4. Architecture

```
/catchment (Next.js route, full-bleed client page)
└── <CatchmentEngine>
    ├── platform/         WebGPU device + capability detection, WebGL2 & static fallbacks
    ├── state/            GPU textures/buffers: the world state (ping-pong)
    ├── sim/              compute passes: hydrology, erosion, fire, wind, vegetation
    ├── surrogate/        onnxruntime-web session, state<->tensor marshalling, scheduler
    ├── render/           terrain mesh, water, fire, vegetation shading, camera
    ├── ui/               control rail, HUD, lens switcher, explainer
    └── data/             DEM + derived layers (public/catchment/*)
```

**World state** lives entirely on the GPU as a stack of channels on an `N×N` grid (target
`N = 256`, ambition `512`), double-buffered for ping-pong updates:

- static: `elevation` (bedrock), `hardness`
- hydrology: `water_depth`, `flux_L/R/T/B` (pipe model), `velocity_uv`, `sediment`
- fire: `fuel`, `fire_intensity`, `char`, `moisture`
- ecology: `biomass`, `carbon`
- derived each step: `slope`, `aspect`, `flow_accumulation`

**Simulation** is a sequence of WebGPU compute passes per fixed timestep (with substeps for
stability). Forcings (wind vector, rain rate, ignition mask, season) arrive as uniforms.

**Rendering** displaces a plane mesh by `elevation` (+ a thin `water_depth` surface), shades by
biomass / char / wetness, adds emissive fire and a hillshade base. Decision in M0:
**three.js `WebGPURenderer` (TSL)** for rendering with our own compute passes, vs. a **compact
custom WebGPU engine**. Default lean: three.js to de-risk camera/material/picking, custom compute
for the sim.

**The surrogate** runs through `onnxruntime-web` on the WebGPU execution provider, reading the
state textures into a tensor, predicting the next state, and writing back — scheduled either every
frame (neural mode) or alongside physics (compare mode).

**Integration with the site.** The route is lazy-loaded and code-split so it never weighs down the
rest of the portfolio. Everything degrades: **WebGPU → WebGL2 (reduced sim) → static cinematic +
explainer** for no-GPU / reduced-motion / mobile-low-power.

---

## 5. The physics (kept real, stated honestly)

- **Hydrology — virtual-pipes shallow water (Mei et al. 2007).** Each cell exchanges water with its
  four neighbours through "pipes" whose flux is driven by the difference in water+terrain height;
  velocity follows from net flux. Cheap, stable, GPU-native, and the basis for erosion.
- **Erosion / deposition — stream-power coupling.** Sediment transport capacity `C = Kc · |v| ·
  sin(slope)`; water dissolves bedrock where it's under capacity and deposits where over, advecting
  suspended sediment downstream. This is what makes the terrain visibly *carve* — the single most
  arresting effect.
- **Fire — Rothermel-flavoured cellular spread.** Rate of spread `R = R0 · (1 + φ_wind + φ_slope)`
  with `φ_wind` from wind speed and alignment to the spread direction, `φ_slope` from uphill
  gradient, gated by `fuel` and damped by `moisture`. Burned cells deposit `char` and reset `fuel`.
- **Wind — start simple, earn complexity.** v1: a global user vector deflected by terrain. v2 (if
  time): a 2D *Stable Fluids* (Stam) layer so gusts curl around ridgelines.
- **Vegetation & carbon.** Logistic biomass growth `dB/dt = r·B·(1 − B/K) · suit(moisture, slope) −
  fire_loss`; `carbon ∝ B`; a biodiversity proxy from habitat heterogeneity (local variance + edge
  density). Ties the engine back to the climate/nature problem space.

Every model above is a *recognised, citable* simplification — defensible to a technical visitor,
and explicitly labelled as a reduced-order model, not a forecast.

---

## 6. The neural surrogate (the research payload)

**Task.** Learn `f_θ : (state_t, forcings_t) → state_{t+k}` — one network that advances the whole
coupled world.

**Data.** Generate thousands of rollouts from the simulator itself (the GPU sim, mirrored by a numpy
reference for training), sweeping initial terrain, rain, wind, and ignition. The simulator is the
teacher; no external dataset required, so the whole thing stays self-contained.

**Model.** Start with a small **U-Net / ConvNeXt-style CNN** over the grid channels (translation-
equivariant, cheap, exports cleanly to ONNX). Stretch goal: a **graph/mesh net** in the GraphCast
lineage for irregular resolution.

**Training (the interesting part).** Single-step MSE is easy and unstable on rollout. We adopt the
field's fix — **pushforward / multi-step "rollout" loss**: unroll the surrogate several steps during
training and backprop through the trajectory, which is exactly how GraphCast-class models earn long
stable forecasts. We measure and report the trade-off.

**Inference.** Export to ONNX, run via `onnxruntime-web` (WebGPU EP). Marshal state textures ↔
tensors without leaving the GPU where possible.

**Evaluation = the demo.** Physics-vs-neural split screen; per-cell error field; **rollout horizon**
(steps until error exceeds a threshold); **speed-up factor**; conservation checks (does the
surrogate preserve water volume?). These plots *are* the figures in the final report.

---

## 7. Iteration roadmap

Each milestone ends in something you can open and play. Rough sizing assumes focused sessions, not
calendar days.

**M0 — Foundation & spike (de-risk).**
Route `/catchment`, full-bleed shell, WebGPU capability detection + graceful fallback copy. A spike
that renders a static 3D DEM mesh you can orbit, and a trivial compute pass writing to a texture, to
prove the device + render + compute loop end-to-end. Decide three.js-WebGPU vs custom.
*Done when:* real terrain renders in 3D, orbits smoothly, and a compute shader demonstrably runs.

**M1 — The world.**
Higher-res DEM pipeline (extend the existing generator), hillshade + satellite-style drape in
palette, day/night light, camera polish (orbit + fly), picking. Loading/empty/error states.
*Done when:* it looks beautiful and on-brand standing still.

**M2 — Water that carves.**
Virtual-pipes hydrology + erosion in compute shaders; rain forcing (slider + paint); rivers form and
terrain visibly erodes; water surface rendering. HUD water metrics.
*Done when:* dropping rain on a ridge produces a believable, carving drainage network in real time.

**M3 — Fire & life.**
Fire spread coupled to slope/wind/fuel/moisture; ignition tool; char + regrowth; vegetation/carbon
dynamics and shading; wind vector control (+ optional fluid layer).
*Done when:* you can light a downwind slope and watch fire, then recovery, unfold.

**M4 — The surrogate (headline).**
Offline data-gen + training (PyTorch), pushforward loss, ONNX export, `onnxruntime-web` inference.
Neural toggle, physics-vs-neural compare, error field, speed-up + rollout-horizon readouts.
*Done when:* the neural model visibly runs the world faster than physics, with honest error viz.

**M5 — Lens, narrative, paper.**
Carbon/biodiversity lens, guided "first-run" tour, performance pass (target 60 fps @ 256²),
accessibility + fallbacks finalised, and the written **report** (§9). Link from the homepage CTA and
nav; social/OG capture.
*Done when:* a stranger gets the "holy shit" in under ten seconds, and the report stands on its own.

---

## 8. Constraints, performance, risk

**Performance budget.** 60 fps at `N = 256` on a mid-range 2023 laptop GPU; degrade `N`, substeps,
and surrogate cadence adaptively. Neural step target < 5 ms; physics step measured for the speed-up
headline.

**Fallback ladder.** WebGPU (full) → WebGL2 (rendering + reduced/precomputed sim, no neural) →
static cinematic loop + interactive explainer (reduced-motion, no-GPU, mobile-low-power). The page
must never be a blank canvas.

**Risks & mitigations.**

- *WebGPU availability* → feature-detect, fallback ladder, copy that explains the requirement.
- *Numerical blow-ups* (erosion/fluid are stiff) → fixed timestep + substeps, clamping, CFL-aware
  limits; a "reset" that always works.
- *Surrogate instability on rollout* → pushforward training; present it as a finding, not a failure.
- *Scope creep* → milestones are independently shippable; we can stop after any of M2–M4 and still
  have something exceptional.
- *Bundle size* → route-level code-split; ORT-web and three loaded only on `/catchment`.
- *Mobile* → honest reduced experience; the full engine is a desktop showpiece.

---

## 9. The report (final deliverable, mainrun-style)

A standalone write-up published alongside the demo:

1. **Abstract** — a browser-native neural surrogate for catchment-scale Earth-system dynamics.
2. **Motivation** — the emulator turn in geoscience; why interactivity and "in the browser" matter.
3. **The simulator** — terrain, hydrology + erosion, fire, ecology; assumptions and validity.
4. **The surrogate** — architecture, data generation, pushforward training, ONNX/WebGPU inference.
5. **Results** — accuracy, rollout horizon, conservation, speed-up; physics-vs-neural figures.
6. **Engineering** — WebGPU pipeline, state management, performance, the fallback ladder.
7. **Limitations & honesty** — reduced-order physics, generalisation, what would change at scale.
8. **What this rhymes with** — GraphCast / NeuralGCM / Aurora / Earth-2, and where the field is going.

---

## Build log

- **M0 (done).** `/catchment` route + full-bleed shell; WebGPU capability detection with a
  2D-relief fallback; real DEM rendered as an orbitable 3D mesh; a **compute pass** derives
  per-vertex normals into a storage buffer that the render pass consumes (compute → render loop
  proven). Dependency-free raw WebGPU + ambient type shim (`types/webgpu-min.d.ts`); camera math
  unit-checked; tsc + lint clean. **Renderer decision: stay with the compact custom WebGPU engine** —
  the spike got terrain + compute + orbit working cleanly with zero new dependencies and full control
  over the compute passes we need next, so three.js isn't warranted. (Revisit only if camera/material
  complexity in M1 outgrows the hand-rolled path.) Files: `app/catchment/page.tsx`,
  `components/catchment/Catchment.tsx`, `lib/catchment/mat4.ts`, `types/webgpu-min.d.ts`.

---

- **M1 (done).** Higher-res **160² DEM with 16-bit elevation** (`public/catchment/dem.json`,
  `lib/catchment/dem.ts`); landcover-style shaded drape (water / riparian / vegetation / rock by
  height + slope + drainage) with hemispheric ambient, warm sun, and distance fog; **controllable
  sun angle and vertical exaggeration** (re-dispatches the normals compute pass on change); **damped
  orbit/zoom**; **click-to-inspect picking** via inverse-projection ray-march over the heightfield
  with a highlight ring + elevation/slope/coord readout. Normals still computed on the GPU. Camera
  and picking math unit-checked; tsc + lint clean. Next: **M2 — water that carves.**

---

- **M2 (done).** **Water that carves.** Virtual-pipes shallow water (Mei et al. 2007) +
  stream-power erosion + semi-Lagrangian sediment transport, running live in WebGPU compute
  shaders (`lib/catchment/sim-shaders.ts`). Pipeline per substep: addRain → flux → water+velocity →
  erode → transport → finalize, then normals re-derived from the eroding bedrock; a translucent
  water surface renders on top (depth-based colour, premultiplied blend). Controls: global
  **rainfall**, a click-drag **pour** brush (via the M1 picker), **erosion** rate, plus M1's sun /
  relief / orbit / reset. The physics + constants (`dt 0.02, g 9.81, Kc 0.08, Ks 0.10, Kd 0.05,
  evap 0.012`, velocity clamp ±3, depth floor 0.04) were ported 1:1 from a numpy reference that was
  validated visually (channels incise, mass stays bounded) before the port. tsc + lint clean; all
  bind-group / uniform layouts checked by hand. Next: **M3 — fire & life.**

---

- **Polish (post-M2).** Diorama **pedestal** (cliff walls + base, stone-shaded) so the terrain reads
  as a solid model block; **redesigned control panel** (collapsible, segmented mode toggle, custom
  sage sliders, grouped sections); **livelier water** (animated ripples, sun sparkle, fresnel, foam
  on fast flow) + a **pour ring** and bigger pour.
- **M3 (done).** **Fire & life.** Heat-accumulation fire-spread CA (Rothermel-flavoured: faster
  uphill + downwind, gated by fuel/moisture) + fuel consumption, char, and vegetation regrowth, in
  WebGPU compute (`SPREAD_WGSL`, `BURN_WGSL`). Coupled to M2: **water is a firebreak** (wet cells
  can't ignite and extinguish fire). Controls: an **Ignite** mode (click to light), **wind
  direction + strength**. Terrain shading now carries fuel (lusher greens), char scars, and emissive
  flickering fire. CPU-validated spread before the port. tsc + lint clean. Next: **M4 — the neural
  surrogate.**

---

- **M3.6 (done).** **Multiple worlds.** A map library in `public/catchment/` (Caldera, Drowned
  Coast / fjords, Braided Delta, Archipelago, + secret **Olympus**) in the 16-bit DEM format, with
  `maps.json` (name, tagline, suggested rain/wind). The engine re-inits cleanly on map change
  (init effect keyed on the selected file; device torn down + rebuilt). Picker in the control
  panel; each world adopts its suggested rainfall/wind. Easter egg: **Olympus** (a Mars-style
  shield volcano, `rng(1971)` for Mariner 9) is hidden until you click the panel's "live" dot 5×.

---

- **§5 ocean (done).** The flat sea is now an **animated wave ocean** — layered sum-of-sines swell
  (the real-time cousin of a Tessendorf FFT ocean) with analytic normals, fresnel sky reflection,
  a tamed sun glint, and crest foam. Fixes the blown-out flat-plane reflection; coastline worlds
  (Drowned Coast, Archipelago) now read as real sea. Land-water (sim) shading unchanged.

- **Render polish (done).** Gradient **sky + atmosphere** with a sun glow tracked to the Sun
  slider; **bloom** post-chain (resolve → luminance bright-pass → separable gaussian blur →
  composite) so fire/sun/water-sparkle glow. Both **gated + try/catch** (failure ⇒ prior render
  path, no regression). Neural placeholder set to a clean frozen-identity baseline.

- **M4 inference runtime (done).** The neural operator now runs **live in WebGPU**:
  `lib/catchment/sim-shaders.ts` gained assemble/conv/apply kernels (mirroring the numpy-verified
  CPU forward); the engine loads `surrogate.json`, builds per-layer weight buffers + pipelines, and
  steps a **separate neural water state** each frame. A **Physics ⟷ Neural** toggle (in the M4
  panel) rebinds the water render between the physics teacher and the neural student, with a
  "Resync to physics" reseed. Fully **gated + try/catch**: absent/invalid model ⇒ physics engine
  untouched. Lights up fully once a GPU-trained `surrogate.json` replaces the placeholder.

- **M4 foundation (done).** The neural surrogate, de-risked:
  `ml/train_surrogate.py` (local-GPU PyTorch trainer — teacher physics in torch, residual
  dilated conv neural operator, pushforward/rollout loss, exports `catchment-surrogate-v1`
  JSON + ONNX), `ml/README.md` (run + contract), a v1 placeholder `public/catchment/surrogate.json`,
  and `lib/catchment/surrogate.ts` — a **CPU reference forward pass verified against numpy to 5e-8**
  (conv + dilation + GroupNorm + GELU + residual). Still to wire: the in-browser inference *runtime*
  + physics-vs-neural compare UI (decision below).

---

## 10. Open decisions

- ~~Renderer: three.js `WebGPURenderer` (TSL) vs. a compact custom WebGPU engine.~~ → **Custom (M0).**
- Grid resolution target (256 vs 512) and whether to support adaptive LOD.
- Surrogate architecture first cut: U-Net vs ConvNeXt vs mesh-GNN.
- Region & extent: stay with the Byron hinterland, or pick a more dramatic catchment.
- Visual identity: how literal vs. abstract the cartography should be (photoreal drape vs. stylised).

---

### Immediate next step

**M0 spike.** Scaffold `/catchment`, detect WebGPU with the fallback copy, render a real DEM as an
orbitable 3D mesh, and prove one compute pass writes a texture the render reads. Small, decisive,
and it tells us which renderer we live with for the rest of the build.

---

*Sources for the research framing:*
- *NeuralGCM* — Google Research: https://research.google/blog/fast-accurate-climate-modeling-with-neuralgcm/
- *Awesome Large Weather Models* (GraphCast, Pangu, FourCastNet, Aurora index): https://github.com/jaychempan/Awesome-LWMs
- *Community Earth Digital Intelligence Twin (CREDIT)* — npj Climate & Atmos. Sci. (2025): https://www.nature.com/articles/s41612-025-01125-6
- *WebSplatter: WebGPU Gaussian Splatting in browsers* — arXiv: https://arxiv.org/html/2602.03207v1
- *Visionary: WebGPU + ONNX world-model engine* — arXiv: https://arxiv.org/html/2512.08478v1

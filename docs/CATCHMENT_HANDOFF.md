# Catchment — engineering handoff prompt

*Paste this whole file into Cursor / GPT-5.5 as the system/seed prompt. It is written
to be acted on directly.*

---

You are continuing **Catchment**, a browser-native, real-time geo-simulation that is the
flagship demo on a Next.js 14 portfolio. It renders a real catchment in 3D on the GPU
with **raw WebGPU (no three.js)** and runs a live hydraulic-erosion + fire simulation in
compute shaders. Your job is to massively raise (A) the **render realism/beauty** and
(B) the **physical depth**, then (C) execute the next milestones. Work in hard, verifiable
increments. Do not regress the working simulation.

## Stack & file map

- `app/catchment/page.tsx` — full-bleed route.
- `components/catchment/Catchment.tsx` — the engine: WebGPU device/context, all buffers,
  pipelines, bind groups, the `realFrame` render loop (one compute pass running the sim
  kernels in sequence, then a render pass: **terrain → skirt → water**), camera (damped
  orbit), inverse-projection picking, and the control panel UI.
- `lib/catchment/sim-shaders.ts` — **all WGSL** as exported strings: compute kernels
  (`ADDRAIN/FLUX/WATERVEL/ERODE/TRANSPORT/FINALIZE/NORMALS/SPREAD/BURN`) and render
  shaders (`RENDER_TERRAIN/RENDER_WATER/RENDER_SKIRT`).
- `lib/catchment/mat4.ts` — column-major mat4 (perspectiveZO is **WebGPU z∈[0,1]**), lookAt,
  invert, transformVec4, orbitEye.
- `lib/catchment/dem.ts` — DEM loader (16-bit elevation + ocean/stream masks).
- `public/catchment/dem.json` — 160² DEM. Regenerable; a higher-res/real DEM is desirable.
- `docs/CATCHMENT.md` — the vision + milestone log (read it).

### Key conventions (don't break these)
- **Uniforms.** `SimU` and `RU` are each `Float32Array(36)` = 144 bytes, std140 vec4-aligned.
  `RU` layout: `mvp[0..15]`, `sun[16..19]`, `params[20..23]=(n,vscale,half,seaY)`,
  `pick[24..27]`, `cam[28..31]=(camXYZ,fogAmt)`, `misc[32..35]=(HSCALE,baseY,time,_)`.
  `SimU` layout: `dims(n,dt,L,HSCALE)`, `phys(g,A,rain,evap)`, `ero(Kc,Ks,Kd,cap)`,
  `src(srcX,srcZ,srcR,srcAmt)`, `view(vscale,half,cellWorld,seaY)`, `fire(R0,phiW,phiS,burn)`,
  `fset(wet,regrow,charFade,ignThresh)`, `wind(wx,wz,wspeed,fireDt)`, `ign(x,z,r,on)`.
- Bedrock is stored in sim units `bed = elev * HSCALE` (HSCALE=80); world height =
  `bed/HSCALE * vscale`. Grid is row-major; row 0 = north edge.
- WebGPU auto-synchronises storage writes between dispatches **within one compute pass**, so
  kernels can be chained without explicit barriers. Buffers default to zero-init.
- All GPU objects are typed `any` via `types/webgpu-min.d.ts` (no `@webgpu/types` dep). You
  MAY add `@webgpu/types` if you want real typing — if you do, delete the shim to avoid
  conflicts.

## Hard constraints
- **WebGPU only, dependency-free** where reasonable. Keep the WebGL2/static fallback path.
- **Brand palette** (architectural, calm): sage `#4A6741`, sand `#C4A882`, ink `#1A1A18`,
  concrete `#F7F5F0`, surface `#EFECE5`, hairline `#D8D3C8`. Beauty ≠ garish.
- **60 fps target** on a 2023 laptop GPU at the chosen resolution; degrade gracefully.
- Verify every change: `npx tsc --noEmit` + `npx next lint` must stay clean. For new physics,
  **validate the maths in a numpy/JS reference and render a before/after image first**, then
  port to WGSL (this is how M2/M3 were de-risked — keep doing it).
- Never ship a broken frame: keep `Reset` working; guard against NaN blow-ups (clamp, CFL).

---

## TRACK A — Render realism & beauty (do in this order; each is a visible win)

Currently: flat-shaded facets, single Lambert + hemispheric ambient, tiny distance fog, naive
alpha water, no AA, no shadows, sRGB lighting. The fixes, highest impact first:

1. **Linear lighting + ACES tonemap + MSAA.** Do all lighting math in linear space; tonemap
   (ACES filmic) at the end; output to the sRGB swapchain. Enable **4× MSAA** (multisampled
   color + depth textures, `sampleCount:4`, resolve to the canvas view). This alone removes
   the jaggies and flatness. Acceptance: edges are smooth, midtones have filmic contrast.
2. **Sun shadow map (PCF).** Render the terrain (+skirt) depth from the sun's POV into a depth
   texture (orthographic, fit to the model AABB), then sample with 3×3+ PCF in the terrain/
   water fragment shaders. This is the single biggest *depth* cue. Add a small normal-bias to
   kill acne. Acceptance: ridges cast soft shadows into valleys that move with the Sun slider.
3. **Ambient occlusion.** Cheapest good option: precompute a horizon-based AO / sky-visibility
   term from the heightfield offline (or a compute prepass) and store per cell; multiply
   ambient by it. Valleys and creases darken. (SSAO is an alternative but heavier.)
4. **Sky + atmosphere.** Replace the flat concrete clear with a gradient **sky dome** (horizon
   → zenith), a soft **sun disc**, and **height/▽distance fog** (aerial perspective) tinted by
   the sky. Use the sky color as the ambient source (hemispheric IBL-lite). Keep it within the
   palette (warm sand horizon, pale sage-grey zenith). Acceptance: clear sense of distance and
   a believable sky.
5. **PBR-ish materials + detail normals.** Per-landcover albedo + roughness (rock rough &
   bright spec, grass matte, char near-black, wet ground darker + glossier). Add a procedural
   **fBm detail normal map** so surfaces read as ground, not flat triangles. Cook-Torrance
   specular for sun glints (esp. on wet terrain and water).
6. **Water overhaul** (`RENDER_WATER_WGSL`). Make it read like water:
   - **Depth absorption** (Beer–Lambert): deeper water → darker/greener; cheap and huge.
   - **Reflection**: reflect the sky/sun (planar reflection or just sky-dome sample by the
     reflected view vector) + Fresnel blend.
   - **Refraction tint** of the terrain below (sample terrain color, shift by depth).
   - **Flow-mapped normals**: advect two normal-map samples along the existing `vel` field
     (you already pass velocity) for directional ripples; add **shoreline foam** where
     `depth` is small and **whitewater foam** where speed is high (partly there — make it
     depth/▽-aware).
   - Sun **specular sparkle** with bloom feeding the post stack.
7. **Post-processing stack.** Add **bloom** (fire + sun/water sparkle glow), subtle **vignette**,
   gentle **color grade** toward the palette, and **FXAA or TAA** (TAA also stabilises the
   water shimmer). Optional: mild SSR for water, depth-of-field on far field.
8. **Resolution + smoothing.** Raise the grid to **256²** (consider 512² with adaptive LOD/
   tessellation). Use the already-computed compute normals; consider a light Laplacian smooth
   of bedrock for the render-only normal (keep the sim bedrock crisp).
9. **Atmosphere extras (optional polish).** Drifting **cloud shadows** (scrolling noise mask on
   sunlight), volumetric-ish **smoke** from fire (see Track B), soft **contact shadow** under
   the pedestal, god rays.

> If you do only three things: **(1) MSAA+ACES+linear**, **(2) sun shadow map**, **(7) bloom +
> tonemap post**. That trio moves it from "tech demo" to "beautiful".

---

## TRACK B — Physical depth (validate offline → port to WGSL)

1. **Hydrology that routes to the sea.** Add **infiltration** (water absorbs into a soil-
   moisture field, capacity by slope/veg), tuned **evaporation**, and crucially **basin spill-
   over** so closed lakes overflow along their lowest sill and connect into through-flowing
   rivers that reach the ocean (priority-flood / planar-fill, or just let depth integrate long
   enough). Add **suspended-sediment colour** in the water and **deposition deltas** at river
   mouths. Make rainfall **moving storm cells** (a drifting Gaussian source) instead of uniform,
   so rivers pulse and the map isn't a uniform flood.
2. **Fire → real Rothermel + smoke + spotting.** Replace the heat-CA with a proper **Rothermel
   rate-of-spread** (fuel load, fuel moisture, packing ratio, mid-flame wind, slope factor).
   Add **ember spotting** (embers carried downwind ignite cells ahead of the front),
   **fireline intensity** driving a **smoke field** advected by wind and rendered as
   soft billboards/volumetric. Distinct **fuel types** (grass fast/low-intensity vs forest
   slow/high-intensity). Suppression by soil moisture / recent rain (couple to #1).
3. **Shared soil-moisture field** linking hydrology ↔ fire ↔ vegetation. Wet soil resists fire,
   feeds vegetation growth; fire dries soil; drought raises spread.
4. **Vegetation succession.** grass → shrub → forest over time as a biomass field; biomass sets
   fuel load and albedo; post-fire **nutrient pulse** accelerates early regrowth. Ties the
   "life" loop together.
5. **Wind as a 2D fluid.** A **stable-fluids** (Stam) wind field that deflects around terrain
   and drives fire spread, smoke, and water ripples — far more alive than a global vector.
6. **Carbon & biodiversity ledger (on-brand).** Track carbon stored in biomass/soil, released
   by fire, re-sequestered by regrowth; a habitat-heterogeneity biodiversity proxy. Show a live
   HUD/strip chart. This is the climate-tech payoff and differentiates the piece.
7. **Numerics.** Adaptive timestep / CFL guard, substep counts exposed, conservation checks
   (water volume in vs out), so it stays stable at 256–512².

---

## TRACK C — Exact next milestones (ship in order; each independently demoable)

**M3.5 — Render overhaul (do this next; biggest perceived-quality jump).**
Track A items 1–7. Deliver: MSAA + linear/ACES + bloom, sun shadow map, AO, sky+fog, water
overhaul. Acceptance: a stranger calls it "beautiful" in the first 5 seconds; 60 fps at 256².

**M3.6 — Multiple maps.** A small map switcher (3–5 catchments). Generate real DEMs (e.g. from
SRTM/Copernicus 30 m tiles, or the existing procedural generator with varied seeds/coastlines)
into `public/catchment/<name>.json`; a dropdown in the panel reloads buffers without tearing
down the device. The user explicitly wants scrollable maps.

**M4 — The neural surrogate (the headline).** Train a small **U-Net/ConvNeXt** to emulate the
next simulation state from the current state + forcings. Generate training rollouts from the
sim (mirror the kernels in numpy/torch). Use **pushforward / multi-step rollout loss** for
stability (GraphCast-style). Export **ONNX**, run via **onnxruntime-web (WebGPU EP)**. Build a
**physics-vs-neural split screen** with a live **error field** and a **speed-up readout**
(neural ms vs physics ms) and a **rollout-horizon** meter (steps until divergence). This is the
research climax — see `docs/CATCHMENT.md` §6/§9.

**M5 — Narrative + the report.** Guided first-run tour, perf pass, accessibility, and the
written report (`docs/CATCHMENT.md` §9): *"A browser-native neural surrogate for catchment-scale
Earth-system dynamics."* Link from the homepage CTA + nav; capture OG/social stills.

---

## Working method (please follow)
- One milestone at a time; keep `tsc`/`lint` green; commit per coherent step.
- For any new physics: **numpy/JS reference + before/after PNG first**, tune constants, then
  port 1:1 to WGSL with the validated numbers. Surface WGSL compile errors to the UI.
- Watch the storage-buffer-per-stage limit (currently 7 in the terrain vertex stage; shadow/AO
  passes may push you toward textures instead of more storage buffers — prefer textures).
- Keep the brand palette and the calm, architectural tone. Restraint is the aesthetic.

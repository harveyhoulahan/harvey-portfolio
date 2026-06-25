# Genesis — build plan

*A browser-native artificial-life lab. You type what you want life to look like; a
vision-language model and an evolutionary search coax it out of a living GPU substrate.*

Sibling flagship to **Catchment**. Catchment is *physical* (PDE sim + neural surrogate +
graphics); Genesis is *generative/evolutionary* (emergence + foundation-model-guided
search). Same calm aesthetic (sage `#4A6741`, sand `#C4A882`, ink `#1A1A18`, concrete
`#F7F5F0`), same engineering discipline: raw WebGPU, dependency-light, every risky feature
gated behind try/catch with a graceful fallback so the build never regresses.

Route: `/genesis` · component `components/genesis/Genesis.tsx` · shaders
`lib/genesis/sim-shaders.ts` · assets `public/genesis/`.

Research basis: ASAL — *Automating the Search for Artificial Life with Foundation Models*
(Sakana AI + MIT, *Artificial Life*, MIT Press 2025; arXiv 2412.17799). See
`FLAGSHIP_II_RESEARCH.md`.

---

## The core idea, concretely

A continuous cellular automaton (**Lenia**) lives on the GPU and fills the screen. Three
ways to interact, in increasing ambition:

1. **Drive it** — sliders for the rule parameters (kernel radius, growth μ/σ, time-step);
   click to seed; watch creatures (orbium, gliders) self-organize.
2. **Summon it** — type a target ("a creature that pulses like a jellyfish"). An in-browser
   CLIP/SigLIP image encoder embeds frames of the running sim; an evolutionary loop
   (CMA-ES over the rule vector) maximizes similarity to your text. The search is visible:
   candidate sims flicker in a filmstrip, the best one takes the main canvas.
3. **Open-ended mode** — no target; the objective rewards *novelty over time* (frames that
   stay different from their own past). The substrate is pushed toward perpetual surprise.

The "knock-your-shoes-off" moment: you type a word and watch alien life assemble itself to
match it.

---

## Constraints that shape the design

- **No backend GPU.** Sim + model both run client-side (WebGPU). WebGPU is now default in
  all four major browsers (Nov 2025), so this is finally clean.
- **Blind development.** I can't see the rendered pixels. Every milestone ships with an
  offline check: a numpy/JS reference for the CA update, headless frame hashing, `tsc` +
  `lint`, and a reload for you to eyeball. Same workflow that got Catchment shipped.
- **Graceful degradation.** No WebGPU → static "creature zoo" gallery (precomputed GIFs/
  frames) + parameter sliders driving a WASM/JS fallback CA at low res. Reduced-motion
  users get the gallery, not the live sim.

---

## Milestones

Each is independently shippable and gated. Rough sizing in (parens).

### M1 — Substrate online  (foundation)
- `/genesis` route + full-screen `<canvas>`, WebGPU init with feature-detect + fallback.
- Lenia compute pipeline: state texture, FFT-free convolution with a precomputed ring
  kernel, growth mapping, ping-pong update. Render pass maps state → calm palette.
- Click-to-seed, pause/step, reset. Reduced-motion → static seed.
- **Verify:** JS reference Lenia step cross-checked against the WGSL kernel on a small grid
  (match to ~1e-5); `tsc`/`lint` clean; reload for visual.

### M2 — Make it beautiful  (rendering)
- Palette ramps tied to state + velocity; soft glow/bloom (reuse Catchment's post chain
  ideas); subtle trails (temporal blend) so motion reads.
- Multiple substrates behind one interface: **Lenia**, **Particle Life**, **Game-of-Life**
  (the discrete easter egg). Switcher in the collapsible control panel.
- **Verify:** before/after PNG montage I can read on host; perf budget (≥30fps mid-tier).

### M3 — Drive it  (interaction)
- Collapsible control panel (match Catchment's UI language) with live rule sliders, seed
  brush, speed, substrate switch, and a curated **creature presets** menu (orbium, etc.).
- Permalink: encode the rule vector in the URL hash so a discovered creature is shareable.
- **Verify:** preset round-trip (load → hash → reload → identical); lint/tsc.

### M4 — The foundation model  (the pioneering core)
- Load a small CLIP/SigLIP image encoder via `transformers.js` on WebGPU (gated; lazy,
  on first "summon"). Embed downsampled canvas frames.
- Text prompt → text embedding (precomputed offline for a starter prompt set, live encode
  if the text model fits; otherwise ship a small prompt→vector table + a tiny on-device
  tokenizer path).
- **Verify:** cosine-similarity sanity (a hand-labelled creature scores highest on its own
  description); numbers logged to console for me to read via Chrome.

### M5 — The search  (evolution)
- CMA-ES (pure TS) over the rule vector. Each generation: run N candidate sims for K
  steps (batched on GPU where possible), embed a few frames each, score vs. target,
  update the distribution. Visible filmstrip of candidates; best promotes to main canvas.
- **Open-ended mode:** objective = temporal novelty (low self-similarity across time).
- **Verify:** on a toy objective with a known optimum, CMA-ES converges; deterministic
  seed → reproducible run.

### M6 — Polish, easter eggs, report
- Easter eggs: typing `conway` seeds Game of Life; `mainrun` / `catchment` seed named
  creatures; `↯ surprise me` runs open-ended search; a Konami-style combo cranks every
  parameter into beautiful chaos.
- Loading states, error toasts, mobile fallback gallery, a11y pass, OG image.
- A short research-style writeup (method, what ASAL is, what's yours) like Catchment's.
- **Verify:** full QA pass; Lighthouse/a11y; cross-browser smoke (Chrome + Safari WebGPU).

---

## Open questions to settle as we go

- **Which substrate leads?** Lenia is the most beautiful and the best ASAL story; Particle
  Life is the most obviously "alive." Plan: Lenia as hero, Particle Life as second tab.
- **Text encoding path.** Full SigLIP text tower in-browser vs. a shipped prompt-embedding
  table. Start with the table (robust, fast) and upgrade to live text if weights are sane.
- **Batching candidates.** Whether to run CMA-ES candidates sequentially or pack several
  small grids into one texture. Start sequential; optimize if the search feels slow.

---

## Why this is a strong portfolio piece

It pairs with Catchment to show *range*: one piece is hard physical simulation with a
trained neural surrogate; the other is emergent complexity steered by a foundation model and
an evolutionary search. Both are full-screen, both run entirely on the visitor's GPU, both
are grounded in 2025–26 research, and both are things almost nobody has built as an
interactive web experience.

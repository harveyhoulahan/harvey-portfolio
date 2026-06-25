# Genesis — a browser-native artificial-life lab

*A WebGPU laboratory where you describe a lifeform in plain English and a
foundation model + evolutionary search coax it out of a living simulation — entirely
on your own machine, no backend.*

Live at `/genesis`. Sibling to **Catchment**: where Catchment is a physical PDE
simulation with a trained neural surrogate, Genesis explores the other half of the ML
landscape — *emergence, foundation models, and search*.

---

## What it is

Three artificial-life substrates run live on the GPU, full-screen:

- **Lenia** — a continuous cellular automaton (Bert Chan, 2019): a smooth scalar field
  evolved by a ring-kernel convolution and a Gaussian growth map. Self-organizing,
  drifting "creatures" emerge from noise.
- **Particle Life** — Ventrella/Mohr "Clusters": ~1,800 agents of 6 species governed by
  an asymmetric attraction matrix. Cells, chasers, and membranes self-assemble from a
  36-number interaction rule.
- **Game of Life** — Conway's discrete classic, sharing the same renderer.

On top of the substrates sits the pioneering layer: **summon by prompt**. You type a
description; an in-browser CLIP model scores how much the simulation resembles it; and a
CMA-ES search breeds the substrate's parameters to maximize that resemblance.

## Research basis

The summon-and-search loop follows **ASAL — Automating the Search for Artificial Life
with Foundation Models** (Sakana AI + MIT, *Artificial Life*, MIT Press 2025;
arXiv 2412.17799). ASAL uses a vision-language model to (1) find simulations matching a
text target, (2) discover open-ended novelty, and (3) illuminate a diverse space — across
exactly these substrates (Lenia, Particle Life, Game of Life, neural CAs). Genesis is an
*interactive, in-browser* realization of that paradigm.

## Making it feel alive

A single symmetric-kernel Lenia relaxes into a frozen lattice — too few degrees of
freedom and no broken symmetry. Genesis adds coupled, reacting variables that *break
symmetry, inject energy, and drift over time* (see `GENESIS_LIVELINESS.md`):

- **Metabolism** — μ/σ breathe, walking across the die/stable/chaos bifurcation.
- **Energy injection** — sparse stochastic births stop the field freezing.
- **Anisotropic flow** — a semi-Lagrangian advection pass (uniform drift + swirl) gives
  self-propulsion, so creatures travel and wander; the heading itself random-walks.
- For Particle Life: a **slowly drifting attraction matrix**, **brownian jitter**, and a
  **cursor field** so the swarm reacts to the viewer.

Each variable is exposed as a live slider and is what the search optimizes.

## The pioneering core — in-browser CLIP + CMA-ES

- **Scoring.** CLIP (vit-base-patch32, quantized) runs client-side on WebGPU via
  transformers.js, loaded from a CDN at runtime so the site bundle stays dependency-light.
  The prompt is embedded with prompt-ensembling (several templated phrasings averaged) for
  a clean target; a frame is embedded and cosine similarity gives a "resonance" score.
- **Search.** A separable CMA-ES (Ros & Hansen 2008) — diagonal covariance, so it scales
  to the 36-D attraction matrix without an eigendecomposition — evolves the substrate's
  parameters to maximize resonance. Each candidate is grown from fresh soup, rendered into
  an offscreen texture, read back, and embedded. An open-ended mode instead rewards
  *temporal novelty* (early vs. late frames differ), hunting restless, ever-changing life.

## Engineering

Raw WebGPU throughout (compute + render in WGSL), dependency-light, every risky feature
gated behind try/catch with graceful fallbacks (no-WebGPU notice, reduced-motion static
frame) so the page never hard-fails. Developed "blind" (no direct view of the rendered
pixels), so correctness is established offline before wiring: the Lenia and Particle-Life
update rules, and the CMA-ES optimizer, each have a pure reference validated headlessly in
Node (bounded dynamics, no NaNs, emergent clustering, optimizer convergence) before being
transcribed to the GPU.

## Honest limitations

The substrates are *abstract* — CLIP nudges color, density, scale, and arrangement toward
a prompt's vibe, but Lenia speaks in rings and blobs, not insect anatomy. Particle Life
resembles creatures and swarms far better. The search improves resonance and visibly
shifts the look; it does not render photographs. That gap — abstract emergent media,
judged by a model trained on natural images — is itself the interesting tension, and is
true of ASAL too.

## Easter eggs

Type `conway`, `lenia`, `swarm`, `mainrun`, `catchment`, or `surprise` anywhere on the
page.

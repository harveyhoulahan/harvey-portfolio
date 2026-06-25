# Flagship II — Research Brief

*A second full-screen, browser-native ML showpiece to stand alongside **Catchment**.*
Researched June 2026. Goal: the most **pioneering, interactive, captivating** idea in the
AI/ML space right now that one person can actually ship in a week of focused work —
ideally one that exercises a **different muscle** than Catchment (which is PDE simulation
+ a neural surrogate + real-time graphics).

---

## How these were judged

Five axes, scored 1–5 in the table at the end:

1. **Pioneering** — is this genuinely 2025–26 frontier, not a 2023 retread?
2. **Wow / full-screen** — does it stop someone scrolling?
3. **Interactive** — can the visitor *drive* it, not just watch?
4. **Browser-feasible** — can it run client-side (WebGPU/WASM) in a week, no backend GPU?
5. **Showcase fit** — does it prove ML depth a recruiter/peer can't fake-read past?

A hard constraint runs underneath all of these: **no server GPU**. Everything has to
run on the visitor's machine. WebGPU shipped by default across all four major browsers
on 25 Nov 2025 (~83% global coverage), and now delivers 3–5× over WebGL and 10–15× over
WASM for transformer-shaped work — so for the first time this constraint is an asset, not
a cage. ([WebGPU browser AI inference, 2026](https://www.buildmvpfast.com/blog/webgpu-browser-ai-inference-cost-savings-2026))

---

## Candidate 1 — "Genesis": foundation-model-guided artificial life  ★ recommended

**What it is.** A full-screen, GPU-simulated living substrate — continuous cellular
automata (Lenia), Particle Life, or a neural CA — where the visitor doesn't just watch
emergent creatures, they **summon** them. Type "something that swims like a jellyfish"
or "an open-ended ecosystem that never settles," and an in-browser vision-language model
scores the simulation's own video and an evolutionary loop (CMA-ES) reshapes the rules
until that phenomenon appears. You're literally searching the space of possible life with
language.

**Why it's frontier.** This is **ASAL** — *Automating the Search for Artificial Life with
Foundation Models* (Sakana AI + MIT, published in *Artificial Life*, MIT Press, 2025).
It uses a vision-language foundation model to (1) find simulations matching a text target,
(2) discover open-ended novelty, and (3) illuminate a whole diverse space — across Boids,
Particle Life, Game of Life, Lenia, and neural CAs. It's recent, it's a named paradigm,
and almost nobody has built an *interactive* version of it.
([Sakana ASAL](https://sakana.ai/asal/) · [arXiv 2412.17799](https://arxiv.org/abs/2412.17799) · [MIT Press, Artificial Life 2025](https://direct.mit.edu/artl/article/31/3/368/132866/Automating-the-Search-for-Artificial-Life-With))

**In-browser build.** Lenia / Particle Life are cheap WebGPU compute kernels (you've
already proven this muscle in Catchment). The VLM is the trick: run a small CLIP/SigLIP
image encoder via `transformers.js` on WebGPU, embed frames, and score cosine similarity
to the text prompt. CMA-ES over ~10–40 rule parameters runs in plain JS. The "search"
becomes a live, visible thing on screen.

**Showcases.** GPU compute, evolutionary optimization, foundation-model-guided discovery,
emergent-complexity intuition — and a *taste* for what "interesting" even means.

**Wow / risk.** Wow is very high (alien creatures coalescing out of noise on command).
Risk is moderate and well-bounded: worst case the VLM search is slow, and you fall back to
a gorgeous hand-curated "creature zoo" + manual rule sliders, which is still a great demo.

**Easter eggs / aesthetic.** Keep the calm palette (sage/sand/ink/concrete) as the UI
chrome around a vivid living canvas. Hidden prompts: typing "conway" seeds Game of Life;
"mainrun" or "catchment" seeds a named creature. A "↯ surprise me" button that runs
open-ended-novelty search.

---

## Candidate 2 — "The Glass Box": a live, steerable transformer  ★ strong / most distinctive

**What it is.** A small language model running entirely in the browser, with its **insides
exposed**. As you type, the full screen shows attention flowing and internal features
lighting up. Then you grab sliders — "formality," "anger," "talks about the ocean" — each
wired to a real interpretable feature, and **steer** the model's output live. You're
driving the model's mind, not its prompt.

**Why it's frontier.** Sparse autoencoders (SAEs) for finding monosemantic, interpretable
features and steering on them is the hottest thread in interpretability right now: SAE-based
steering-vector refinement, SAEBench, ConceptViz visual analytics for concepts inside LLMs,
sparse feature circuits. ([SAE steering refinement, 2509.23799](https://www.arxiv.org/pdf/2509.23799) · [ConceptViz, 2509.20376](https://arxiv.org/pdf/2509.20376) · [SAE survey, 2503.05613](https://arxiv.org/html/2503.05613v3))

**In-browser build.** A tiny transformer (e.g. a small GPT-2-class or distilled model) runs
via `transformers.js`/ONNX-Runtime-Web on WebGPU. Precompute an SAE (or a handful of
steering vectors) offline; ship the feature directions as a small asset and add them into
the residual stream at inference. Visualize attention + feature activations in WebGPU.

**Showcases.** Transformer internals, interpretability, real-time inference, and — bluntly —
that you understand models from the inside, not just the API. This is the most
**Anthropic-flavoured** demo of the five.

**Wow / risk.** Wow is high for technical viewers, subtler for laypeople. Risk: model load
weight (~tens–hundreds of MB) and making the viz legible rather than a blur. Mitigation:
go small, lazy-load, and design the viz hard.

**Easter eggs.** A "max everything" mode that over-steers into beautiful incoherence;
a feature labelled with your own name that makes it talk about geospatial ML.

---

## Candidate 3 — "Latent Brush": real-time in-browser diffusion canvas

**What it is.** A full-screen canvas where every brushstroke is **re-imagined live** by a
diffusion model — paint a blob, get a mountain; scrub a slider and walk through latent
space as the image morphs continuously. Zero server.

**Why it's frontier.** Real-time interactive diffusion is a 2025–26 arms race:
StreamDiffusion / StreamDiffusionV2 (streaming pipelines), latent-consistency & turbo
models for few/one-step sampling, and — critically — Stable Diffusion 1.5 and SD-Turbo
now running *client-side on WebGPU* via ONNX-Runtime-Web.
([StreamDiffusionV2, 2511.07399](https://arxiv.org/abs/2511.07399) · [Latent Consistency Models, 2310.04378](https://arxiv.org/pdf/2310.04378) · [SD-1.5-WebGPU](https://huggingface.co/Zhare-AI/sd-1-5-webgpu))

**In-browser build.** Load a quantized LCM/turbo UNet via ORT-Web on WebGPU; img2img on
each stroke with low step count. The latent-walk slider is the signature interaction.

**Showcases.** Diffusion, distillation/consistency models, heavy WebGPU inference,
latent-space intuition.

**Wow / risk.** Wow very high. Risk highest of the practical options: model weights are
large (slow first load), and hitting truly interactive frame-rates on mid hardware is the
whole engineering challenge. More "product-y" / less novel than 1 and 2 — it's a known
demo genre, so the differentiation has to come from the *interaction*, not the idea.

---

## Candidate 4 — "Dreamfield": a playable neural world  ◆ highest ceiling, highest risk

**What it is.** A neural world model you can *walk around inside* — no polygons, no engine;
every frame is hallucinated by a model conditioned on your last action. The literal
zeitgeist demo of 2026.

**Why it's frontier.** Genie 3 (real-time, 720p/24fps, minutes of coherent play; public as
"Project Genie" Jan 2026), Oasis, GameNGen, plus the autoregressive-distillation wave that
makes real-time *feasible*: Self Forcing → Causal Forcing (ICML 2026), Rolling Forcing,
LiveTalk. ([Genie 3 overview](https://genie3.net/) · [Causal Forcing, thu-ml](https://github.com/thu-ml/Causal-Forcing) · [Rolling Forcing, 2509.25161](https://arxiv.org/pdf/2509.25161))

**The catch.** These are large models trained on serious compute. A faithful in-browser
version is **not** a one-week, no-backend project. A *feasible* reframe: train one small,
action-conditioned next-frame model on a single constrained environment (your home GPU,
like Catchment's surrogate) and run the distilled student in-browser. Real, pioneering,
but the riskiest scope here — best as a stretch goal or a "v2" after a safer flagship.

**Showcases.** World models, autoregressive rollout, distillation, drift control — the
deepest flex, if it lands.

---

## Candidate 5 — "Instant 3D": single image → explorable splat scene

**What it is.** Drop in one photo; a feed-forward model lifts it into a 3D Gaussian-splat
scene you can fly through full-screen.

**Why it's frontier.** Feed-forward 3DGS and single-image scene generation are very live:
AnySplat (feed-forward 3DGS from unconstrained views, 2025), Wonderland, Gen3R, One2Scene.
([AnySplat-class work, Gen3R 2601.04090](https://arxiv.org/pdf/2601.04090) · [One2Scene 2602.19766](https://arxiv.org/pdf/2602.19766))

**The catch.** *Rendering* splats in WebGPU is very doable and beautiful; *generating* them
feed-forward in-browser from a single image is heavy. Realistically you'd render
precomputed scenes — which is gorgeous but light on the ML story. It also overlaps
Catchment's "real-time 3D graphics" axis rather than adding a new one. Lower priority for
that reason.

---

## Scorecard

| Candidate | Pioneering | Wow | Interactive | Feasible (1wk, no backend) | Showcase | Total |
|---|---|---|---|---|---|---|
| **1. Genesis** (ALife + foundation model) | 5 | 5 | 5 | 4 | 5 | **24** |
| **2. Glass Box** (steerable transformer) | 5 | 4 | 5 | 4 | 5 | **23** |
| **3. Latent Brush** (real-time diffusion) | 4 | 5 | 5 | 3 | 4 | **21** |
| **4. Dreamfield** (neural world) | 5 | 5 | 4 | 2 | 5 | **21** |
| **5. Instant 3D** (splat scenes) | 4 | 5 | 4 | 2 | 3 | **18** |

---

## Recommendation

Lead with **Genesis** or **Glass Box** — both score highest, both are genuinely 2025–26
frontier, both are comfortably buildable in a week on your existing WebGPU foundation, and
both add a *new* axis to your portfolio rather than echoing Catchment:

- **Genesis** is the more visually arresting and the better twin to Catchment (another
  living, full-screen GPU world — but generative/evolutionary instead of physical). It's
  the safer "knock-your-shoes-off."
- **Glass Box** is the more intellectually distinctive and the most Anthropic-aligned — it
  says "I understand what's inside the model." Slightly harder to make legible, bigger
  payoff with technical audiences.

**Dreamfield** is the dream, but scope it as a stretch / v2 — it's the one most likely to
eat the whole week and not land.

Pick one as the flagship; the other two make natural follow-ups for the rest of the credits.
A full milestone plan (à la `CATCHMENT_RESEARCH.md`) follows once you choose.

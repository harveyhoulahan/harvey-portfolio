"""
train_summon_prior.py — offline CLIP-guided evolution for the Genesis "summon" prior.

The browser summons a lifeform by breeding Particle Life's 51-gene genome against an
in-browser CLIP model (components/genesis/Genesis.tsx). That live search gets a few
hundred evaluations at most. This script runs the *same* search offline, without a
frame budget, for a whole vocabulary of concepts, and distills the results into a
retrieval atlas:

    public/genesis/summon-prior.json
        { dim, genome_len, entries: [{ prompt, score, e, g }] }

where `e` is the concept's ensembled CLIP text embedding (unit norm) and `g` the best
genome found (normalized [0,1]^51). At summon time the browser embeds the visitor's
prompt, retrieves the nearest concepts by cosine, and warm-starts its live CMA-ES from
those genomes — hours of offline evolution collapsed into a lookup.

Everything here MIRRORS the browser exactly (same model, same genome bounds, same
force law, same prompt templates, same contrastive fitness):
    · physics     ↔ lib/genesis/particle-life.ts + PARTICLE_FORCE_WGSL
    · genome      ↔ P_GENOME in components/genesis/Genesis.tsx
    · CLIP scoring↔ lib/genesis/vision.ts (openai/clip-vit-base-patch32 = Xenova port)
Edit any of those and this file together, or the prior silently degrades.
(Approximations: point-deposit + gaussian-blur sprites instead of stretched quads, and
no velocity-stretch in the offline render — the prior is a warm start, not an oracle.)

Usage:
    python ml/genesis/train_summon_prior.py                  # full default vocabulary
    python ml/genesis/train_summon_prior.py --gens 6 --warm 10 --n 1024   # quick pass
    python ml/genesis/train_summon_prior.py --prompts my_concepts.txt
Resumes by default: concepts already in the output file are skipped (--force redoes).

Requires: torch, transformers, pillow, numpy.
"""

from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image

# ---------------------------------------------------------------------------
# Constants mirrored from the browser (see file docstring for sources)
# ---------------------------------------------------------------------------

K = 6                 # species
DT = 0.018            # timestep
SPEED_CAP = 2.5
CONVERT_RADIUS = 0.45  # fraction of rMax
TAU = 2 * math.pi

# P_GENOME in Genesis.tsx: (name, min, max) — decoded from [0,1] genes.
GENOME_SCALARS = [
    ("rMax", 0.05, 0.25), ("friction", 0.40, 0.95), ("forceFactor", 1.0, 10.0), ("noise", 0.0, 4.0),
    ("beta", 0.05, 0.45), ("align", 0.0, 2.0), ("flow", 0.0, 1.2), ("pulse", 0.0, 1.0), ("convert", 0.0, 0.35),
    ("hueBase", 0.0, 1.0), ("hueSpread", 0.0, 1.0), ("sat", 0.0, 1.0), ("val", 0.4, 1.0),
    ("trail", 0.0, 1.0), ("stretch", 0.0, 3.0),
]
GENOME_LEN = K * K + len(GENOME_SCALARS)  # 51

# vision.ts PROMPT_TEMPLATES / NULL_PROMPTS / NULL_WEIGHT — keep in lockstep.
PROMPT_TEMPLATES = [
    "{t}",
    "a photo of {t}",
    "an image of {t}",
    "{t} on a black background",
    "glowing {t} on a dark background",
    "a pattern that looks like {t}",
    "{t}, organic texture",
]
NULL_PROMPTS = [
    "an image",
    "a photo",
    "a dark background",
    "colorful dots on a black background",
    "glowing particles on a dark background",
    "abstract noise",
]
NULL_WEIGHT = 0.5

MODEL_ID = "openai/clip-vit-base-patch32"  # same weights as the browser's Xenova port

# Render constants (composite pass in sim-shaders.ts / Genesis.tsx capture path)
RES = 224
EXPOSURE = 1.5
BG = (0.072, 0.072, 0.066)
TRAIL_STEPS = 45      # capture trail window (developParticle)
DEVELOP_A = 150       # steps before first capture
DEVELOP_B = 45        # steps between first and second capture
CROP_FRAC = 0.62      # center-crop fraction (embedPixelsMulti)
DEPOSIT = 1.0         # point-deposit energy standing in for the sprite integral

# Default concept vocabulary: creatures, phenomena, textures — things CLIP can
# actually see in a glowing swarm. Extend freely; more concepts = denser prior.
DEFAULT_CONCEPTS = [
    "a glowing jellyfish", "a school of fish", "a flock of starlings",
    "a swarm of fireflies", "a spiral galaxy", "a nebula", "a meteor shower",
    "a lightning storm", "aurora borealis", "ocean waves", "a whirlpool",
    "a coral reef", "sea anemones", "plankton under a microscope",
    "bacteria in a petri dish", "dividing cells under a microscope",
    "a colony of ants", "a swarm of bees", "a spider web with dew",
    "blooming flowers", "falling cherry blossom petals", "autumn leaves in the wind",
    "a snowstorm", "falling snowflakes", "embers rising from a fire",
    "molten lava", "a burning flame", "fireworks", "a comet with a long tail",
    "rain on a window", "a murmuration at dusk", "smoke curling in the air",
    "ink dispersing in water", "a lava lamp", "soap bubbles",
    "a beating heart", "neurons firing", "blood cells in a vein",
    "a dragon", "a phoenix", "a serpent", "a butterfly", "a peacock feather",
    "an eye", "a human face", "a skull", "a hurricane seen from space",
    "city lights at night from above", "a circuit board", "the matrix digital rain",
]


# ---------------------------------------------------------------------------
# Physics — mirrors particleStep / PARTICLE_FORCE_WGSL
# ---------------------------------------------------------------------------

def decode(genes: np.ndarray) -> dict:
    """[0,1]^51 → attraction matrix + named scalars (browser applyCandidate)."""
    g = np.clip(np.asarray(genes, dtype=np.float64), 0.0, 1.0)
    out = {"A": (g[: K * K] * 2.0 - 1.0).reshape(K, K)}
    for i, (name, lo, hi) in enumerate(GENOME_SCALARS):
        out[name] = lo + g[K * K + i] * (hi - lo)
    return out


class Swarm:
    """Torch Particle Life: N agents on the unit torus, O(N²) forces."""

    def __init__(self, n: int, device: torch.device, seed: int):
        self.n = n
        self.dev = device
        self.gen = torch.Generator(device="cpu").manual_seed(seed)
        self.pos = torch.rand(n, 2, generator=self.gen).to(device)
        self.vel = torch.zeros(n, 2, device=device)
        self.typ = torch.randint(0, K, (n,), generator=self.gen).to(device)

    def step(self, p: dict, A: torch.Tensor, t: float) -> None:
        pos, vel, typ = self.pos, self.vel, self.typ
        rmax, beta = p["rMax"], p["beta"]
        d = pos[None, :, :] - pos[:, None, :]
        d = d - torch.round(d)                      # toroidal minimum image
        r = d.norm(dim=-1)
        within = (r > 0) & (r < rmax)
        rn = r / rmax
        a = A[typ[:, None], typ[None, :]]
        f = torch.where(rn < beta, rn / beta - 1.0,
                        a * (1.0 - (2.0 * rn - 1.0 - beta).abs() / (1.0 - beta)))
        f = f * within
        acc = (d / r.clamp_min(1e-9).unsqueeze(-1) * f.unsqueeze(-1)).sum(1)
        pulse_mul = 1.0 + p["pulse"] * 0.6 * torch.sin(
            torch.as_tensor(t * 4.0, device=self.dev) + typ.float() * TAU / K)
        acc = acc * (rmax * p["forceFactor"]) * pulse_mul[:, None]
        if p["align"] > 0:
            nn = within.sum(1)
            avgv = (vel[None, :, :] * within.unsqueeze(-1).float()).sum(1) / nn.clamp_min(1)[:, None]
            acc = acc + p["align"] * (avgv - vel) * (nn > 0).float()[:, None]
        if p["flow"] > 0:
            acc = acc + p["flow"] * 2.5 * torch.stack([
                torch.sin(TAU * pos[:, 1] * 3.0 + 0.7 * t),
                torch.cos(TAU * pos[:, 0] * 3.0 + 0.7 * t),
            ], dim=-1)
        if p["noise"] > 0:
            acc = acc + (torch.rand(self.n, 2, device=self.dev) * 2.0 - 1.0) * p["noise"]
        vel = vel * p["friction"] + acc * DT
        sp = vel.norm(dim=-1, keepdim=True)
        vel = torch.where(sp > SPEED_CAP, vel * (SPEED_CAP / sp.clamp_min(1e-9)), vel)
        self.vel = torch.nan_to_num(vel)
        self.pos = (pos + self.vel * DT) % 1.0
        if p["convert"] > 0:
            pred = (typ + 1) % K
            near = within & (typ[None, :] == pred[:, None]) & (r < rmax * CONVERT_RADIUS)
            hit = near.any(1) & (torch.rand(self.n, device=self.dev) < p["convert"])
            self.typ = torch.where(hit, pred, typ)


# ---------------------------------------------------------------------------
# Renderer — mirrors the HDR trail + composite look (point deposits + blur)
# ---------------------------------------------------------------------------

def hsv2rgb(h: float, s: float, v: float) -> tuple[float, float, float]:
    i = int(h * 6.0) % 6
    f = h * 6.0 - math.floor(h * 6.0)
    pp, q, t_ = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    return [(v, t_, pp), (q, v, pp), (pp, v, t_), (pp, q, v), (t_, pp, v), (v, pp, q)][i]


class TrailRenderer:
    """Accumulates decayed point deposits; blur + tonemap on read-out."""

    def __init__(self, device: torch.device):
        self.dev = device
        self.img = torch.zeros(3, RES, RES, device=device)
        x = torch.arange(-2, 3, dtype=torch.float32)
        k1 = torch.exp(-(x ** 2) / (2 * 1.0 ** 2))
        k2 = (k1[:, None] * k1[None, :])
        self.blur = (k2 / k2.sum()).to(device)[None, None].repeat(3, 1, 1, 1)

    def clear(self) -> None:
        self.img.zero_()

    def palette(self, p: dict) -> torch.Tensor:
        cols = [hsv2rgb((p["hueBase"] + (t / K) * p["hueSpread"]) % 1.0, p["sat"], p["val"]) for t in range(K)]
        return torch.tensor(cols, dtype=torch.float32, device=self.dev)  # (K, 3)

    def deposit(self, sw: Swarm, p: dict, decay: float) -> None:
        self.img *= decay
        base = self.palette(p)[sw.typ]                       # (N,3)
        sp = sw.vel.norm(dim=-1)
        heat = (sp * 0.55).clamp(max=1.0)[:, None]
        col = (base * (1 - heat * 0.55) + (base * 0.4 + 0.75) * (heat * 0.55)) * (0.85 + 0.5 * heat)
        xy = (sw.pos * RES).long().clamp(0, RES - 1)
        idx = xy[:, 1] * RES + xy[:, 0]
        flat = self.img.view(3, -1)
        flat.index_add_(1, idx, (col * DEPOSIT).t())

    def frame(self) -> Image.Image:
        soft = torch.nn.functional.conv2d(self.img[None], self.blur, padding=2, groups=3)[0]
        c = 1.0 - torch.exp(-soft * EXPOSURE)
        rgb = torch.stack([c[i] + BG[i] for i in range(3)]).clamp(0, 1)
        arr = (rgb.permute(1, 2, 0).cpu().numpy() * 255).astype(np.uint8)
        return Image.fromarray(arr)


# ---------------------------------------------------------------------------
# CLIP scoring — mirrors vision.ts (ensembled text, null bank, multi-crop)
# ---------------------------------------------------------------------------

class Scorer:
    def __init__(self, device: torch.device):
        from transformers import CLIPModel, CLIPProcessor
        self.dev = device
        self.model = CLIPModel.from_pretrained(MODEL_ID).to(device).eval()
        self.proc = CLIPProcessor.from_pretrained(MODEL_ID)
        self.nulls = torch.stack([self._embed_texts([q])[0] for q in NULL_PROMPTS])

    @torch.no_grad()
    def _embed_texts(self, texts: list[str]) -> torch.Tensor:
        inp = self.proc(text=texts, return_tensors="pt", padding=True, truncation=True).to(self.dev)
        # go through tower + projection explicitly: get_text_features returns a raw
        # ModelOutput (not the projected tensor) on some transformers versions
        out = self.model.text_model(input_ids=inp["input_ids"], attention_mask=inp.get("attention_mask"))
        e = self.model.text_projection(out.pooler_output)
        return e / e.norm(dim=-1, keepdim=True)

    def embed_concept(self, text: str) -> torch.Tensor:
        e = self._embed_texts([tpl.format(t=text) for tpl in PROMPT_TEMPLATES]).mean(0)
        return e / e.norm()

    @torch.no_grad()
    def embed_views(self, img: Image.Image) -> torch.Tensor:
        w, h = img.size
        cw, ch = int(w * CROP_FRAC), int(h * CROP_FRAC)
        x0, y0 = (w - cw) // 2, (h - ch) // 2
        views = [img, img.crop((x0, y0, x0 + cw, y0 + ch))]
        inp = self.proc(images=views, return_tensors="pt").to(self.dev)
        out = self.model.vision_model(pixel_values=inp["pixel_values"])
        e = self.model.visual_projection(out.pooler_output)
        return e / e.norm(dim=-1, keepdim=True)  # (2, D)

    def match(self, views: torch.Tensor, concept: torch.Tensor) -> float:
        pos = views @ concept
        neg = (views @ self.nulls.t()).max(dim=-1).values
        return float((pos - NULL_WEIGHT * neg).mean())


def cov_penalty(img: Image.Image) -> float:
    cov = np.asarray(img, dtype=np.float32).mean() / 255.0
    return 0.3 + 0.7 * min(1.0, max(0.0, (cov - 0.004) / 0.02))


# ---------------------------------------------------------------------------
# Separable CMA-ES — direct port of lib/genesis/cmaes.ts
# ---------------------------------------------------------------------------

class SepCMAES:
    def __init__(self, mean0: np.ndarray, sigma0: float = 0.3, rng: np.random.Generator | None = None):
        n = len(mean0)
        self.n = n
        self.rng = rng or np.random.default_rng()
        self.lam = 4 + int(3 * math.log(n))
        self.mu = self.lam // 2
        w = np.log(self.mu + 0.5) - np.log(np.arange(1, self.mu + 1))
        self.w = w / w.sum()
        self.mueff = 1.0 / (self.w ** 2).sum()
        sep = (n + 2) / 3
        self.cc = (4 + self.mueff / n) / (n + 4 + 2 * self.mueff / n)
        self.cs = (self.mueff + 2) / (n + self.mueff + 5)
        self.c1 = min(1.0, (2 / ((n + 1.3) ** 2 + self.mueff)) * sep)
        self.cmu = min(1 - self.c1, (2 * (self.mueff - 2 + 1 / self.mueff) / ((n + 2) ** 2 + self.mueff)) * sep)
        self.damps = 1 + 2 * max(0.0, math.sqrt((self.mueff - 1) / (n + 1)) - 1) + self.cs
        self.chiN = math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n))
        self.mean = np.asarray(mean0, dtype=np.float64).copy()
        self.sigma = sigma0
        self.C = np.ones(n)
        self.pc = np.zeros(n)
        self.ps = np.zeros(n)
        self.gen = 0
        self.pop: np.ndarray | None = None

    def ask(self) -> np.ndarray:
        z = self.rng.standard_normal((self.lam, self.n))
        self.pop = np.clip(self.mean + self.sigma * np.sqrt(self.C) * z, 0.0, 1.0)
        return self.pop

    def tell(self, fit: np.ndarray) -> None:  # minimizes
        idx = np.argsort(fit)
        old = self.mean.copy()
        self.mean = (self.w[:, None] * self.pop[idx[: self.mu]]).sum(0)
        y = (self.mean - old) / self.sigma
        self.ps = (1 - self.cs) * self.ps + math.sqrt(self.cs * (2 - self.cs) * self.mueff) * (y / np.sqrt(self.C))
        ps_norm = float(np.linalg.norm(self.ps))
        self.gen += 1
        hsig = 1.0 if ps_norm / math.sqrt(1 - (1 - self.cs) ** (2 * self.gen)) / self.chiN < 1.4 + 2 / (self.n + 1) else 0.0
        self.pc = (1 - self.cc) * self.pc + hsig * math.sqrt(self.cc * (2 - self.cc) * self.mueff) * y
        d = (self.pop[idx[: self.mu]] - old) / self.sigma
        cmu_term = (self.w[:, None] * d * d).sum(0)
        self.C = ((1 - self.c1 - self.cmu) * self.C
                  + self.c1 * (self.pc ** 2 + (1 - hsig) * self.cc * (2 - self.cc) * self.C)
                  + self.cmu * cmu_term)
        self.C = np.maximum(self.C, 1e-9)
        self.sigma *= math.exp((self.cs / self.damps) * (ps_norm / self.chiN - 1))
        self.sigma = min(self.sigma, 1e3)


# ---------------------------------------------------------------------------
# Evaluation + evolution per concept — mirrors evalCandidate / runSearch
# ---------------------------------------------------------------------------

def eval_genome(genes: np.ndarray, concept: torch.Tensor, scorer: Scorer,
                n: int, device: torch.device, seed: int) -> float:
    p = decode(genes)
    A = torch.tensor(p["A"], dtype=torch.float32, device=device)
    decay = 0.80 + 0.17 * p["trail"]
    sw = Swarm(n, device, seed)
    ren = TrailRenderer(device)

    step_i = 0

    def develop(steps: int) -> None:
        nonlocal step_i
        for _ in range(steps):
            t = step_i * 0.016
            sw.step(p, A, t)
            if step_i >= DEVELOP_A - TRAIL_STEPS:  # trail window, as in the browser
                ren.deposit(sw, p, decay)
            step_i += 1

    develop(DEVELOP_A)
    frame_a = ren.frame()
    develop(DEVELOP_B)
    frame_b = ren.frame()
    views = torch.cat([scorer.embed_views(frame_a), scorer.embed_views(frame_b)])
    sim = scorer.match(views, concept)
    return sim * max(cov_penalty(frame_a), cov_penalty(frame_b))


def evolve_concept(prompt: str, scorer: Scorer, args, rng: np.random.Generator) -> dict:
    device = scorer.dev
    concept = scorer.embed_concept(prompt)
    n_dim = GENOME_LEN
    best_g, best_s = None, -math.inf
    evals = 0
    t0 = time.time()

    def check(g: np.ndarray) -> float:
        nonlocal best_g, best_s, evals
        s = eval_genome(g, concept, scorer, args.n, device, seed=args.seed + evals)
        evals += 1
        if s > best_s:
            best_s, best_g = s, g.copy()
        return s

    # Latin-hypercube warm start (mirrors the browser)
    strata = np.stack([rng.permutation(args.warm) for _ in range(n_dim)])
    for i in range(args.warm):
        check((strata[:, i] + rng.random(n_dim)) / args.warm)

    es = SepCMAES(best_g.copy(), 0.30, rng=rng)
    for g in range(args.gens):
        pop = es.ask()
        fits = np.array([-check(v) for v in pop])  # CMA minimizes
        es.tell(fits)
        print(f"    gen {g + 1}/{args.gens} · best {best_s:.4f} · {evals} evals · {time.time() - t0:.0f}s")

    return {
        "prompt": prompt,
        "score": round(best_s, 4),
        "e": [round(float(x), 5) for x in concept.cpu().numpy()],
        "g": [round(float(x), 5) for x in best_g],
    }


# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--out", default="public/genesis/summon-prior.json")
    ap.add_argument("--prompts", default=None, help="file with one concept per line (default: built-in vocabulary)")
    ap.add_argument("--n", type=int, default=2048, help="particles in the offline sim")
    ap.add_argument("--warm", type=int, default=14, help="Latin-hypercube warm-start samples")
    ap.add_argument("--gens", type=int, default=10, help="CMA-ES generations")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "mps", "cpu"])
    ap.add_argument("--force", action="store_true", help="re-evolve concepts already in the output")
    args = ap.parse_args()

    if args.device == "auto":
        dev = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    else:
        dev = args.device
    device = torch.device(dev)
    print(f"device: {device} · sim N={args.n} · warm {args.warm} + {args.gens} gens")

    concepts = DEFAULT_CONCEPTS
    if args.prompts:
        concepts = [ln.strip() for ln in Path(args.prompts).read_text(encoding="utf-8").splitlines() if ln.strip()]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    atlas = {"version": 1, "model": MODEL_ID, "dim": 512, "genome_len": GENOME_LEN, "entries": []}
    if out_path.exists() and not args.force:
        atlas = json.loads(out_path.read_text(encoding="utf-8"))
        atlas.setdefault("entries", [])
    done = {en["prompt"] for en in atlas["entries"]}

    scorer = Scorer(device)
    rng = np.random.default_rng(args.seed)
    todo = [c for c in concepts if c not in done]
    print(f"{len(todo)} concepts to evolve ({len(done)} already in atlas)")

    for ci, prompt in enumerate(todo):
        print(f"[{ci + 1}/{len(todo)}] “{prompt}”")
        entry = evolve_concept(prompt, scorer, args, rng)
        atlas["entries"] = [en for en in atlas["entries"] if en["prompt"] != prompt] + [entry]
        out_path.write_text(json.dumps(atlas), encoding="utf-8")  # save after every concept
        print(f"    saved · score {entry['score']} · atlas now {len(atlas['entries'])} entries")

    print(f"done → {out_path}")


if __name__ == "__main__":
    main()

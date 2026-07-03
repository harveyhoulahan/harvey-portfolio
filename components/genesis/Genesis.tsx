"use client";

/*
 * Genesis — M1: the substrate comes alive.
 *
 * A continuous cellular automaton (Lenia) runs live in a WebGPU compute shader and
 * fills the screen: a ring-kernel convolution + growth mapping evolves a state field
 * into self-organizing, drifting structures. Math is transcribed 1:1 from the
 * numpy/JS reference in lib/genesis/lenia.ts (validated headlessly). Click to seed
 * new life; pause/step/reset. Raw WebGPU, dependency-free, graceful fallback.
 *
 * Roadmap (see docs/GENESIS.md): M2 rendering polish + more substrates, M3 controls
 * + presets, M4 in-browser CLIP/SigLIP scoring, M5 CMA-ES "summon by prompt" search.
 */

import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  SIM_WGSL, LIFE_WGSL, ADVECT_WGSL, DECAY_WGSL, RENDER_WGSL,
  PARTICLE_FORCE_WGSL, PARTICLE_RENDER_WGSL, PARTICLE_FADE_WGSL, PARTICLE_COMPOSITE_WGSL,
  FIGHT_WGSL, FIGHT_RENDER_WGSL, FIGHT_ADVECT_WGSL,
} from "@/lib/genesis/sim-shaders";
import { buildKernel, seedScenario, DEFAULT_PARAMS } from "@/lib/genesis/lenia";
import { initParticles, randomMatrix, PARTICLE_DEFAULTS } from "@/lib/genesis/particle-life";
import {
  loadVision, embedText, embedCanvas, embedPixelsMulti, meanEmbed, matchScore, getNullBank,
  cosine, resonance, type VisionStatus,
} from "@/lib/genesis/vision";
import { CMAES } from "@/lib/genesis/cmaes";
import { useIdleUI } from "@/lib/useIdleUI";

const N = 192; // grid resolution (NxN) for the field substrates
const P = DEFAULT_PARAMS;
const SUBSTEPS = 1; // Lenia steps per animation frame
const LIFE_EVERY = 5; // Game-of-Life advances every Nth frame (legible pace)

// "Living Lenia" reacting variables (validated headlessly; see docs/GENESIS_LIVELINESS.md)
const MU_AMP = 0.006;    // metabolism: how much μ breathes
const SIG_AMP = 0.0008;  // metabolism: how much σ breathes
const META_OMEGA = 0.02; // breathing rate
const ENERGY_RATE = 0.003; // stochastic-birth probability per cell/step (lower = less screen-filling)
const DRIFT = 0.26;      // self-propulsion speed (cells/step)
const SWIRL = 0.18;      // rotational flow amplitude
const THETA_JITTER = 0.04; // heading random-walk per step

const PL = PARTICLE_DEFAULTS;
const PN = 2400; // particle count (O(N²) kernel; comfortable on any WebGPU device)
const POINT_SIZE = 0.0048; // particle radius in NDC-x units
const NOISE_AMP = 0.6;   // particle brownian jitter
const CURSOR_STRENGTH = 2.6; // pointer attraction strength
const MATRIX_DRIFT_RATE = 0.015; // per-update random walk of the attraction matrix
const MATRIX_DRIFT_EVERY = 16;   // frames between matrix nudges
const TRAIL_EXPOSURE = 1.0;      // tone-map exposure for the HDR trail composite

type Status = "loading" | "ready" | "nogpu" | "error";
type Substrate = "lenia" | "life" | "particle";


/* ---- live, shareable parameters ------------------------------------------ */
type Params = {
  // Lenia (base values; metabolism makes mu/sigma breathe around these)
  mu: number; sigma: number; energy: number; drift: number; swirl: number;
  kR: number; kSigma: number; // kernel scale (creature size) + ring width (shape)
  leniaHue: number; leniaTint: number; // evolvable colour for Lenia
  // Particle Life — physics
  rMax: number; friction: number; forceFactor: number; noise: number; cursor: number; matDrift: number;
  beta: number;    // repulsion-core width (fraction of rMax)
  align: number;   // flocking: steer toward local mean velocity
  flow: number;    // global wind field strength
  pulse: number;   // per-species force breathing
  convert: number; // cyclic predation rate (colour waves)
  // Particle Life — look genome (evolved so summons take on prompt colours/motion)
  hueBase: number; hueSpread: number; sat: number; val: number;
  trail: number;   // trail persistence (0 = crisp dots, 1 = long comet trails)
  stretch: number; // velocity-stretched sprites (motion streaks)
  // Game of Life
  lifeEvery: number;
};

const KR_MAX = 22; // largest kernel radius the buffer is sized for

const DEFAULTS: Params = {
  // σ=0.025 sits in a *bounded* regime: blobs persist as distinct clusters instead
  // of dying (σ≈0.017) or filling the screen — so seeded scenarios stay visible.
  mu: P.mu, sigma: 0.025, energy: ENERGY_RATE, drift: DRIFT, swirl: SWIRL,
  kR: P.R, kSigma: P.kSigma,
  leniaHue: 0.30, leniaTint: 0,
  rMax: PL.rMax, friction: PL.friction, forceFactor: PL.forceFactor,
  noise: NOISE_AMP, cursor: CURSOR_STRENGTH, matDrift: MATRIX_DRIFT_RATE,
  beta: PL.beta, align: PL.align, flow: PL.flow, pulse: PL.pulse, convert: PL.convert,
  hueBase: 0.08, hueSpread: 0.85, sat: 0.48, val: 0.82,
  trail: 0.28, stretch: 0.45,
  lifeEvery: LIFE_EVERY,
};

const LENIA_COLOR_KEYS: (keyof Params)[] = ["leniaHue", "leniaTint"];

/*
 * The particle summon genome: 36 attraction-matrix genes (decoded a = 2g − 1)
 * followed by these scalar genes decoded through the listed bounds. Order and
 * bounds are mirrored EXACTLY in ml/genesis/train_summon_prior.py — the offline
 * trainer evolves genomes in this same space and the browser warm-starts from
 * them — so any change here must be made in both places.
 */
const P_GENOME: [keyof Params, number, number][] = [
  ["rMax", 0.05, 0.25], ["friction", 0.40, 0.95], ["forceFactor", 1, 10], ["noise", 0, 4],
  ["beta", 0.05, 0.45], ["align", 0, 2], ["flow", 0, 1.2], ["pulse", 0, 1], ["convert", 0, 0.35],
  ["hueBase", 0, 1], ["hueSpread", 0, 1], ["sat", 0, 1], ["val", 0.4, 1],
  ["trail", 0, 1], ["stretch", 0, 3],
];
const P_GENOME_LEN = PL.K * PL.K + P_GENOME.length; // 51

const PARAM_KEYS = Object.keys(DEFAULTS) as (keyof Params)[];

/** Parse "#s=lenia&mu=0.15&..." into a substrate + partial params (for permalinks). */
function parseHash(): { substrate?: Substrate; params: Partial<Params> } {
  const out: { substrate?: Substrate; params: Partial<Params> } = { params: {} };
  if (typeof window === "undefined") return out;
  const sp = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const s = sp.get("s");
  if (s === "particle") out.substrate = s;
  for (const k of PARAM_KEYS) {
    const v = sp.get(k);
    if (v != null && Number.isFinite(+v)) out.params[k] = +v;
  }
  return out;
}

function buildHash(substrate: Substrate, params: Params): string {
  const sp = new URLSearchParams();
  sp.set("s", substrate);
  for (const k of PARAM_KEYS) sp.set(k, String(+params[k].toPrecision(4)));
  return "#" + sp.toString();
}

/** Named starting points. Lenia/particle presets also re-seed for a clean read. */
const LENIA_PRESETS: Record<string, Partial<Params>> = {
  Coral:    { mu: 0.15, sigma: 0.017, energy: 0.004, drift: 0.10, swirl: 0.08 },
  Wanderer: { mu: 0.15, sigma: 0.017, energy: 0.007, drift: 0.42, swirl: 0.30 },
  Pulsing:  { mu: 0.16, sigma: 0.019, energy: 0.013, drift: 0.20, swirl: 0.22 },
};
const PARTICLE_PRESETS: Record<string, Partial<Params>> = {
  Cells:    { rMax: 0.10, friction: 0.84, forceFactor: 4.0, noise: 0.8, align: 0.1, flow: 0.05, pulse: 0.1, convert: 0, trail: 0.35, stretch: 0.4 },
  Chasers:  { rMax: 0.14, friction: 0.70, forceFactor: 7.0, noise: 1.2, align: 0.5, flow: 0.1, pulse: 0.3, convert: 0.04, trail: 0.6, stretch: 1.4 },
  Storm:    { rMax: 0.16, friction: 0.55, forceFactor: 6.5, noise: 1.6, align: 1.4, flow: 1.0, pulse: 0.5, convert: 0.02, trail: 0.8, stretch: 2.2 },
  Plague:   { rMax: 0.13, friction: 0.74, forceFactor: 6.0, noise: 1.0, align: 0.4, flow: 0.15, pulse: 0.7, convert: 0.25, trail: 0.5, stretch: 0.8 },
  Comets:   { rMax: 0.12, friction: 0.62, forceFactor: 8.0, noise: 0.6, align: 0.9, flow: 0.5, pulse: 0.2, convert: 0, trail: 0.97, stretch: 2.8 },
};

// slider definitions per substrate: [param, label, min, max, step]
type SliderDef = [keyof Params, string, number, number, number];
const SLIDERS: Record<Substrate, SliderDef[]> = {
  lenia: [
    ["mu", "μ · growth centre", 0.10, 0.25, 0.001],
    ["sigma", "σ · growth width", 0.005, 0.040, 0.0005],
    ["kR", "scale · R", 6, KR_MAX, 1],
    ["kSigma", "ring width", 0.04, 0.30, 0.005],
    ["energy", "energy · births", 0, 0.02, 0.0005],
    ["drift", "drift · motion", 0, 0.6, 0.01],
    ["swirl", "swirl · turbulence", 0, 0.5, 0.01],
  ],
  particle: [
    ["rMax", "range", 0.05, 0.25, 0.005],
    ["friction", "friction", 0.40, 0.95, 0.01],
    ["forceFactor", "force", 1, 10, 0.5],
    ["noise", "jitter", 0, 4, 0.1],
    ["beta", "core · repulsion", 0.05, 0.45, 0.005],
    ["align", "flocking", 0, 2, 0.05],
    ["flow", "wind", 0, 1.2, 0.05],
    ["pulse", "pulse", 0, 1, 0.05],
    ["convert", "predation", 0, 0.35, 0.01],
    ["trail", "trails", 0, 1, 0.02],
    ["stretch", "streaks", 0, 3, 0.1],
    ["cursor", "cursor pull", -4, 6, 0.2],
    ["matDrift", "physics drift", 0, 0.06, 0.002],
  ],
  life: [
    ["lifeEvery", "step interval (frames)", 1, 20, 1],
  ],
};
const PRESETS: Partial<Record<Substrate, Record<string, Partial<Params>>>> = {
  lenia: LENIA_PRESETS,
  particle: PARTICLE_PRESETS,
};

// Particle search also tunes these sliders (alongside the attraction matrix), so a
// summon visibly updates the controls — not just the hidden matrix.
// hidden creatures, summoned by typing their names (M6 easter eggs)
const EGG_MAINRUN: Partial<Params> = { mu: 0.14, sigma: 0.015, kR: 16, kSigma: 0.12, energy: 0.003, drift: 0.46, swirl: 0.36 };
const EGG_CATCHMENT: Partial<Params> = { rMax: 0.16, friction: 0.70, forceFactor: 6.0, noise: 1.0 };


// Consolidated "macro" controls — one slider sweeps a curated path through two raw
// params so the full effect range survives. forward maps macro t∈[0,1] → param patch;
// read derives the thumb position back from current params. Raw params stay reachable
// under the "advanced" disclosure.
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const unmix = (a: number, b: number, v: number) => (b === a ? 0 : Math.min(1, Math.max(0, (v - a) / (b - a))));
type MacroDef = {
  key: string; label: string;
  forward: (t: number) => Partial<Params>;
  read: (p: Params) => number;
};
const MACROS: Record<Substrate, MacroDef[]> = {
  lenia: [
    { key: "growth", label: "growth",
      forward: (t) => ({ mu: mix(0.10, 0.25, t), sigma: mix(0.040, 0.012, t) }),
      read: (p) => unmix(0.10, 0.25, p.mu) },
    { key: "motion", label: "motion",
      forward: (t) => ({ drift: mix(0, 0.6, t), swirl: mix(0, 0.5, t) }),
      read: (p) => unmix(0, 0.6, p.drift) },
    { key: "scale", label: "scale",
      forward: (t) => ({ kR: Math.round(mix(6, KR_MAX, t)), kSigma: mix(0.04, 0.30, t) }),
      read: (p) => unmix(6, KR_MAX, p.kR) },
    { key: "energy", label: "energy",
      forward: (t) => ({ energy: mix(0, 0.02, t) }),
      read: (p) => unmix(0, 0.02, p.energy) },
  ],
  particle: [
    { key: "intensity", label: "intensity",
      forward: (t) => ({ rMax: mix(0.05, 0.25, t), forceFactor: mix(1, 10, t) }),
      read: (p) => unmix(0.05, 0.25, p.rMax) },
    { key: "life", label: "life",
      forward: (t) => ({ friction: mix(0.95, 0.40, t), noise: mix(0, 4, t), align: mix(0, 1.4, t) }),
      read: (p) => unmix(0, 4, p.noise) },
    { key: "chaos", label: "chaos",
      forward: (t) => ({ convert: mix(0, 0.3, t), pulse: mix(0, 0.9, t), flow: mix(0, 1.0, t) }),
      read: (p) => unmix(0, 0.3, p.convert) },
    { key: "glow", label: "glow",
      forward: (t) => ({ trail: mix(0.1, 1, t), stretch: mix(0.2, 2.8, t) }),
      read: (p) => unmix(0.1, 1, p.trail) },
  ],
  life: [
    { key: "lifeEvery", label: "pace",
      forward: (t) => ({ lifeEvery: Math.round(mix(20, 1, t)) }),
      read: (p) => unmix(20, 1, p.lifeEvery) },
  ],
};

/** Random binary field for seeding Conway's Game of Life. */
function seedLifeField(n: number, density = 0.32): Float32Array {
  const s = new Float32Array(n * n);
  for (let i = 0; i < s.length; i++) s[i] = Math.random() < density ? 1 : 0;
  return s;
}

/* calm site tokens */
const INK = "#1A1A18";
const SAGE = "#4A6741";
const SAND = "#C4A882";
const CONCRETE = "#F7F5F0";

export default function Genesis() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [err, setErr] = useState<string>("");
  const [paused, setPaused] = useState(false);
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [panelOpen, setPanelOpen] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  // let the animation breathe: title retires on first interaction, controls fade when idle
  const { everInteracted, idle } = useIdleUI({ timeout: 3500 });
  const uiVisible = everInteracted && !idle;

  // M4 — foundation-model scoring ("summon")
  const [prompt, setPrompt] = useState("");
  const [visionStatus, setVisionStatus] = useState<VisionStatus>("idle");
  const [visionMsg, setVisionMsg] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const textEmbedRef = useRef<Float32Array | null>(null);
  const scoreTimer = useRef<number | null>(null);
  const scoringRef = useRef(false);

  // M5 — evolutionary search
  const [searching, setSearching] = useState(false);
  const [searchInfo, setSearchInfo] = useState("");
  const [egg, setEgg] = useState("");
  const runSearchRef = useRef<((mode: "prompt" | "open") => void) | null>(null);
  const searchCancelRef = useRef(false);
  const searchActiveRef = useRef(false);

  // control hooks the render loop reads without re-subscribing
  const pausedRef = useRef(false);
  const seedRef = useRef<{ x: number; y: number } | null>(null);
  const resetRef = useRef(false);
  const substrateRef = useRef<Substrate>("particle");
  const switchRef = useRef(false); // substrate changed -> reseed
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -1, y: -1, active: false });
  const paramsRef = useRef<Params>(DEFAULTS);
  const didInit = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  // apply permalink once on mount (after hydration, so SSR markup matches)
  useEffect(() => {
    const h = parseHash();
    if (Object.keys(h.params).length) {
      const merged = { ...DEFAULTS, ...h.params };
      paramsRef.current = merged;
      setParams(merged);
    }
    didInit.current = true;
  }, []);
  // keep the live ref in sync + mirror state into the URL hash (shareable)
  useEffect(() => {
    paramsRef.current = params;
    if (!didInit.current) return;
    try { window.history.replaceState(null, "", buildHash("particle", params)); } catch { /* noop */ }
  }, [params]);

  // setters that update both the React state (UI) and the live ref (render loop)
  const setParam = (k: keyof Params, v: number) => {
    paramsRef.current = { ...paramsRef.current, [k]: v };
    setParams((p) => ({ ...p, [k]: v }));
  };
  const applyPreset = (obj: Partial<Params>) => {
    paramsRef.current = { ...paramsRef.current, ...obj };
    setParams((p) => ({ ...p, ...obj }));
    resetRef.current = true; // reseed so the preset reads cleanly
  };
  const setMacro = (def: MacroDef, t: number) => {
    const patch = def.forward(t);
    paramsRef.current = { ...paramsRef.current, ...patch };
    setParams((p) => ({ ...p, ...patch }));
  };
  const copyLink = () => {
    try {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { /* noop */ }
  };

  // M4: load CLIP (lazy), embed the prompt, then score each frame's resonance
  // live resonance meter (paused while a search drives the GPU itself)
  const startMeter = () => {
    if (scoreTimer.current) window.clearInterval(scoreTimer.current);
    scoreTimer.current = window.setInterval(async () => {
      if (searchActiveRef.current) return;
      const cvs = canvasRef.current;
      const te = textEmbedRef.current;
      if (!cvs || !te || scoringRef.current) return;
      scoringRef.current = true;
      try { const ie = await embedCanvas(cvs); setScore(cosine(ie, te)); }
      catch { /* skip bad frame */ }
      finally { scoringRef.current = false; }
    }, 700);
  };
  // Summon = load CLIP, embed the prompt, then evolve the substrate to match it
  const startSummon = async () => {
    const text = prompt.trim();
    if (!text || searching) return;
    try {
      setVisionStatus("loading"); setVisionMsg("loading vision model…");
      await loadVision((label, frac) => setVisionMsg(`fetching ${label.split("/").pop()} · ${Math.round(frac * 100)}%`));
      setVisionMsg("embedding prompt…");
      textEmbedRef.current = await embedText(text);
      await getNullBank(); // warm the contrastive null bank before the search starts
      setVisionStatus("ready"); setVisionMsg("");
      startMeter();
      runSearchRef.current?.("prompt"); // conjure: breed the substrate toward the words
    } catch (e: any) {
      setVisionStatus("error");
      setVisionMsg(e?.message ? String(e.message).slice(0, 120) : "couldn’t load the model");
    }
  };
  useEffect(() => () => { if (scoreTimer.current) window.clearInterval(scoreTimer.current); }, []);

  // M6 — easter eggs: type a name to summon a hidden creature
  useEffect(() => {
    let buf = "";
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-16);
      const fire = (label: string, fn: () => void) => { fn(); setEgg(label); window.setTimeout(() => setEgg(""), 2400); buf = ""; };
      if (buf.endsWith("catchment")) fire("≈ catchment", () => applyPreset(EGG_CATCHMENT));
      else if (buf.endsWith("surprise")) fire("✦ surprise me", () => runSearchRef.current?.("open"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let raf = 0;
    let device: any = null;
    let roRef: any = null;

    const fail = (m: string) => { if (!disposed) { setErr(m); setStatus("error"); } };

    (async () => {
      if (!navigator.gpu) { setStatus("nogpu"); return; }
      let ctx: any;
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!adapter) { setStatus("nogpu"); return; }
        device = await adapter.requestDevice();
        if (disposed) return;
        device.lost?.then((info: any) => { if (!disposed) fail(`GPU device lost: ${info?.message ?? ""}`); });

        ctx = (canvas as any).getContext("webgpu");
        if (!ctx) { setStatus("nogpu"); return; }
        const format = navigator.gpu.getPreferredCanvasFormat();

        // size the backing store to the displayed size (DPR-capped) so the
        // field renders smooth + full-resolution rather than blocky.
        let pUniWrite: (() => void) | null = null;
        let remakeTrail: (() => void) | null = null;
        const resize = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
          const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
          const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h;
            remakeTrail?.(); // HDR trail texture tracks the backing-store size
          }
          pUniWrite?.(); // particle uniform carries aspect ratio
        };
        resize();
        ctx.configure({ device, format, alphaMode: "opaque" });
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);
        roRef = ro;

        /* ---- buffers ---------------------------------------------------- */
        const ST = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
        const mkBuf = (arr: Float32Array, usage: number) => {
          const b = device.createBuffer({ size: arr.byteLength, usage, mappedAtCreation: true });
          new Float32Array(b.getMappedRange()).set(arr);
          b.unmap();
          return b;
        };

        const bufs = [mkBuf(seedScenario(N), ST), mkBuf(new Float32Array(N * N), ST)];
        const histBuf = mkBuf(new Float32Array(N * N), ST); // motion-trail memory
        // kernel buffer sized for the largest radius; rebuilt live when R/ring change
        const kernBuf = device.createBuffer({
          size: (2 * KR_MAX + 1) * (2 * KR_MAX + 1) * 4,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        let curR = Math.round(paramsRef.current.kR);
        let curKSig = paramsRef.current.kSigma;
        device.queue.writeBuffer(kernBuf, 0, buildKernel(curR, curKSig));
        const uni = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(uni, 0, new Float32Array([
          N, curR, P.dt, P.mu,        // p0
          P.sigma, 2 * curR + 1, 0, 0, // p1
          0, 0, 0, 0,                  // p2 (t, energy, seed, drift)
          0, 0, 0, 0,                  // p3 (theta, swirl, _, _)
          0, 0, 0, 0,                  // p4 (leniaHue, _, leniaTint, _)
        ]));
        // per-frame living state: μ/σ breathe, heading θ wanders, energy feeds Lenia
        let theta = Math.random() * Math.PI * 2;
        let tFlow = 0;
        const writeFieldUniform = (frame: number) => {
          const lenia = substrateRef.current === "lenia";
          const pr = paramsRef.current;
          const R = Math.round(pr.kR);
          if (R !== curR || pr.kSigma !== curKSig) {
            device.queue.writeBuffer(kernBuf, 0, buildKernel(R, pr.kSigma));
            curR = R; curKSig = pr.kSigma;
          }
          const mu = pr.mu + (lenia ? MU_AMP * Math.sin(META_OMEGA * frame) : 0);
          const sig = pr.sigma + (lenia ? SIG_AMP * Math.sin(META_OMEGA * frame * 1.3 + 1) : 0);
          theta += (Math.random() * 2 - 1) * THETA_JITTER;
          tFlow += P.dt;
          device.queue.writeBuffer(uni, 0, new Float32Array([
            N, R, P.dt, mu,
            sig, 2 * R + 1, 0, 0,
            tFlow, lenia ? pr.energy : 0, frame, lenia ? pr.drift : 0,
            theta, lenia ? pr.swirl : 0, 0, 0,
            pr.leniaHue, 0, lenia ? pr.leniaTint : 0, 0,
          ]));
        };

        /* ---- Particle Life buffers ------------------------------------- */
        const pstate = initParticles(PN, PL.K);
        const posBufs = [mkBuf(pstate.pos, ST), mkBuf(new Float32Array(2 * PN), ST)];
        const velBufs = [mkBuf(pstate.vel, ST), mkBuf(new Float32Array(2 * PN), ST)];
        // types ping-pong alongside pos/vel (predation converts species race-free)
        const mkTypeBuf = () => {
          const b = device.createBuffer({ size: PN * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, mappedAtCreation: true });
          new Uint32Array(b.getMappedRange()).set(pstate.type); b.unmap();
          return b;
        };
        const typeBufs = [mkTypeBuf(), mkTypeBuf()];
        let curMat = randomMatrix(PL.K); // the live attraction matrix (slowly drifts)
        const matBuf = mkBuf(curMat, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        const pBuf = device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        let pseed = 0;
        const trailDecay = () => 0.80 + 0.17 * paramsRef.current.trail;
        // capture=true renders for CLIP: square aspect, fuller points, no cursor
        const writePUni = (seedVal: number, capture: boolean) => {
          const pr = paramsRef.current;
          const aspect = capture ? 1 : canvas.width / Math.max(1, canvas.height);
          const m = mouseRef.current;
          const cx = !capture && m.active ? m.x : -1;
          const cy = !capture && m.active ? m.y : -1;
          device.queue.writeBuffer(pBuf, 0, new Float32Array([
            PN, PL.K, pr.rMax, pr.beta,                          // a
            PL.dt, pr.friction, pr.forceFactor, pr.noise,        // b
            aspect, capture ? POINT_SIZE * 2.4 : POINT_SIZE, cx, cy, // c
            capture ? 0 : pr.cursor, seedVal, seedVal * 0.016, pr.align, // d (seed, time, flocking)
            pr.hueBase, pr.hueSpread, pr.sat, pr.val,            // e (palette genome)
            pr.flow, pr.pulse, pr.convert, pr.stretch,           // f (behaviour genome)
            trailDecay(), TRAIL_EXPOSURE, 0, 0,                  // g (composite)
          ]));
        };
        pUniWrite = () => writePUni(pseed, false);
        pUniWrite();

        /* ---- pipelines -------------------------------------------------- */
        const simMod = device.createShaderModule({ code: SIM_WGSL });
        const lifeMod = device.createShaderModule({ code: LIFE_WGSL });
        const advMod = device.createShaderModule({ code: ADVECT_WGSL });
        const decMod = device.createShaderModule({ code: DECAY_WGSL });
        const renMod = device.createShaderModule({ code: RENDER_WGSL });
        const pForceMod = device.createShaderModule({ code: PARTICLE_FORCE_WGSL });
        const pRenderMod = device.createShaderModule({ code: PARTICLE_RENDER_WGSL });
        const pFadeMod = device.createShaderModule({ code: PARTICLE_FADE_WGSL });
        const pCompMod = device.createShaderModule({ code: PARTICLE_COMPOSITE_WGSL });
        // surface shader-compile errors early (blind-dev safety net)
        for (const m of [simMod, lifeMod, advMod, decMod, renMod, pForceMod, pRenderMod, pFadeMod, pCompMod]) {
          const ci = await (m.getCompilationInfo?.() ?? Promise.resolve({ messages: [] }));
          const e = (ci.messages ?? []).filter((x: any) => x.type === "error");
          if (e.length) throw new Error(e.map((x: any) => x.message).join(" | "));
        }
        const simPipe = device.createComputePipeline({ layout: "auto", compute: { module: simMod, entryPoint: "main" } });
        const lifePipe = device.createComputePipeline({ layout: "auto", compute: { module: lifeMod, entryPoint: "main" } });
        const advPipe = device.createComputePipeline({ layout: "auto", compute: { module: advMod, entryPoint: "main" } });
        const decPipe = device.createComputePipeline({ layout: "auto", compute: { module: decMod, entryPoint: "main" } });
        const renPipe = device.createRenderPipeline({
          layout: "auto",
          vertex: { module: renMod, entryPoint: "vs" },
          fragment: { module: renMod, entryPoint: "fs", targets: [{ format }] },
          primitive: { topology: "triangle-list" },
        });
        const pForcePipe = device.createComputePipeline({ layout: "auto", compute: { module: pForceMod, entryPoint: "main" } });
        // particles draw additively into an HDR trail texture, not the swapchain
        const TRAIL_FORMAT = "rgba16float";
        const pRenderPipe = device.createRenderPipeline({
          layout: "auto",
          vertex: { module: pRenderMod, entryPoint: "vs" },
          fragment: { module: pRenderMod, entryPoint: "fs", targets: [{
            format: TRAIL_FORMAT,
            blend: {
              color: { srcFactor: "one", dstFactor: "one", operation: "add" },
              alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
            },
          }] },
          primitive: { topology: "triangle-list" },
        });
        // fade pass: dst · blendConstant — the per-frame decay that makes trails
        const pFadePipe = device.createRenderPipeline({
          layout: "auto",
          vertex: { module: pFadeMod, entryPoint: "vs" },
          fragment: { module: pFadeMod, entryPoint: "fs", targets: [{
            format: TRAIL_FORMAT,
            blend: {
              color: { srcFactor: "zero", dstFactor: "constant", operation: "add" },
              alpha: { srcFactor: "zero", dstFactor: "constant", operation: "add" },
            },
          }] },
          primitive: { topology: "triangle-list" },
        });
        // composite pass: tone-map the HDR trails onto the swapchain / capture tex
        const pCompPipe = device.createRenderPipeline({
          layout: "auto",
          vertex: { module: pCompMod, entryPoint: "vs" },
          fragment: { module: pCompMod, entryPoint: "fs", targets: [{ format }] },
          primitive: { topology: "triangle-list" },
        });
        const trailSampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

        const cl = simPipe.getBindGroupLayout(0);
        const ll = lifePipe.getBindGroupLayout(0);
        const al = advPipe.getBindGroupLayout(0);
        const dl = decPipe.getBindGroupLayout(0);
        const rl = renPipe.getBindGroupLayout(0);
        // Lenia compute bind groups: src -> dst (+ ring kernel)
        const cbg = [
          device.createBindGroup({ layout: cl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[0] } },
            { binding: 2, resource: { buffer: bufs[1] } },
            { binding: 3, resource: { buffer: kernBuf } },
          ]}),
          device.createBindGroup({ layout: cl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[1] } },
            { binding: 2, resource: { buffer: bufs[0] } },
            { binding: 3, resource: { buffer: kernBuf } },
          ]}),
        ];
        // Game-of-Life compute bind groups: src -> dst (no kernel)
        const lbg = [
          device.createBindGroup({ layout: ll, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[0] } },
            { binding: 2, resource: { buffer: bufs[1] } },
          ]}),
          device.createBindGroup({ layout: ll, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[1] } },
            { binding: 2, resource: { buffer: bufs[0] } },
          ]}),
        ];
        // advection bind groups: src -> dst (semi-Lagrangian flow)
        const abg = [
          device.createBindGroup({ layout: al, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[0] } },
            { binding: 2, resource: { buffer: bufs[1] } },
          ]}),
          device.createBindGroup({ layout: al, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[1] } },
            { binding: 2, resource: { buffer: bufs[0] } },
          ]}),
        ];
        // decay bind groups: read latest state -> update hist in place
        const dbg = [
          device.createBindGroup({ layout: dl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[0] } },
            { binding: 2, resource: { buffer: histBuf } },
          ]}),
          device.createBindGroup({ layout: dl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[1] } },
            { binding: 2, resource: { buffer: histBuf } },
          ]}),
        ];
        // render bind groups: read state buffer i + the shared hist buffer
        const rbg = [
          device.createBindGroup({ layout: rl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[0] } },
            { binding: 2, resource: { buffer: histBuf } },
          ]}),
          device.createBindGroup({ layout: rl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[1] } },
            { binding: 2, resource: { buffer: histBuf } },
          ]}),
        ];

        // Particle Life bind groups (compute ping-pong + render)
        const pfl = pForcePipe.getBindGroupLayout(0);
        const prl = pRenderPipe.getBindGroupLayout(0);
        const mkForceBG = (i: number) => device.createBindGroup({ layout: pfl, entries: [
          { binding: 0, resource: { buffer: pBuf } },
          { binding: 1, resource: { buffer: posBufs[i] } },
          { binding: 2, resource: { buffer: velBufs[i] } },
          { binding: 3, resource: { buffer: posBufs[1 - i] } },
          { binding: 4, resource: { buffer: velBufs[1 - i] } },
          { binding: 5, resource: { buffer: typeBufs[i] } },
          { binding: 6, resource: { buffer: typeBufs[1 - i] } },
          { binding: 7, resource: { buffer: matBuf } },
        ]});
        const mkRenderBG = (i: number) => device.createBindGroup({ layout: prl, entries: [
          { binding: 0, resource: { buffer: pBuf } },
          { binding: 1, resource: { buffer: posBufs[i] } },
          { binding: 2, resource: { buffer: typeBufs[i] } },
          { binding: 3, resource: { buffer: velBufs[i] } },
        ]});
        const pcbg = [mkForceBG(0), mkForceBG(1)];
        const prbg = [mkRenderBG(0), mkRenderBG(1)];

        // HDR trail target for the live view (recreated on resize) + composite BG
        const compLayout = pCompPipe.getBindGroupLayout(0);
        const mkCompBG = (view: any) => device.createBindGroup({ layout: compLayout, entries: [
          { binding: 0, resource: { buffer: pBuf } },
          { binding: 1, resource: trailSampler },
          { binding: 2, resource: view },
        ]});
        let trailTex: any = null;
        let trailView: any = null;
        let screenCompBG: any = null;
        remakeTrail = () => {
          try { trailTex?.destroy?.(); } catch { /* noop */ }
          trailTex = device.createTexture({
            size: [canvas.width, canvas.height], format: TRAIL_FORMAT,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          });
          trailView = trailTex.createView();
          screenCompBG = mkCompBG(trailView);
        };
        remakeTrail();

        // 2-channel buffers for Lenia "war" episodes (populated from the live field)
        const fightBufs = [
          device.createBuffer({ size: N * N * 8, usage: ST }),
          device.createBuffer({ size: N * N * 8, usage: ST }),
        ];
        const fightU = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const fightPipe = device.createComputePipeline({ layout: "auto", compute: { module: device.createShaderModule({ code: FIGHT_WGSL }), entryPoint: "main" } });
        const fightRenderPipe = device.createRenderPipeline({
          layout: "auto",
          vertex: { module: device.createShaderModule({ code: FIGHT_RENDER_WGSL }), entryPoint: "vs" },
          fragment: { module: device.createShaderModule({ code: FIGHT_RENDER_WGSL }), entryPoint: "fs", targets: [{ format }] },
          primitive: { topology: "triangle-list" },
        });
        const fightAdvPipe = device.createComputePipeline({ layout: "auto", compute: { module: device.createShaderModule({ code: FIGHT_ADVECT_WGSL }), entryPoint: "main" } });
        const ffl = fightPipe.getBindGroupLayout(0);
        const ffr = fightRenderPipe.getBindGroupLayout(0);
        const fal = fightAdvPipe.getBindGroupLayout(0);
        const fcbg = [
          device.createBindGroup({ layout: ffl, entries: [
            { binding: 0, resource: { buffer: fightU } }, { binding: 1, resource: { buffer: fightBufs[0] } },
            { binding: 2, resource: { buffer: fightBufs[1] } }, { binding: 3, resource: { buffer: kernBuf } },
          ]}),
          device.createBindGroup({ layout: ffl, entries: [
            { binding: 0, resource: { buffer: fightU } }, { binding: 1, resource: { buffer: fightBufs[1] } },
            { binding: 2, resource: { buffer: fightBufs[0] } }, { binding: 3, resource: { buffer: kernBuf } },
          ]}),
        ];
        const frbg = [
          device.createBindGroup({ layout: ffr, entries: [
            { binding: 0, resource: { buffer: fightU } }, { binding: 1, resource: { buffer: fightBufs[0] } },
          ]}),
          device.createBindGroup({ layout: ffr, entries: [
            { binding: 0, resource: { buffer: fightU } }, { binding: 1, resource: { buffer: fightBufs[1] } },
          ]}),
        ];
        const fabg = [
          device.createBindGroup({ layout: fal, entries: [
            { binding: 0, resource: { buffer: fightU } }, { binding: 1, resource: { buffer: fightBufs[0] } }, { binding: 2, resource: { buffer: fightBufs[1] } },
          ]}),
          device.createBindGroup({ layout: fal, entries: [
            { binding: 0, resource: { buffer: fightU } }, { binding: 1, resource: { buffer: fightBufs[1] } }, { binding: 2, resource: { buffer: fightBufs[0] } },
          ]}),
        ];

        const groups = Math.ceil(N / 8);
        let cur = 0; // index of buffer holding the latest state
        let pcur = 0; // index of particle buffers holding the latest state
        let fcur = 0; // index of fight buffers holding the latest state
        let frame = 0; // global frame counter (shared by loop + reset scheduling)

        const stepOnce = () => {
          const life = substrateRef.current === "life";
          const enc = device.createCommandEncoder();
          const pass = enc.beginComputePass();
          pass.setPipeline(life ? lifePipe : simPipe);
          pass.setBindGroup(0, (life ? lbg : cbg)[cur]); // src=cur, dst=1-cur
          pass.dispatchWorkgroups(groups, groups);
          pass.end();
          device.queue.submit([enc.finish()]);
          cur = 1 - cur;
        };

        const advectOnce = () => {
          const enc = device.createCommandEncoder();
          const pass = enc.beginComputePass();
          pass.setPipeline(advPipe);
          pass.setBindGroup(0, abg[cur]); // src=cur, dst=1-cur
          pass.dispatchWorkgroups(groups, groups);
          pass.end();
          device.queue.submit([enc.finish()]);
          cur = 1 - cur;
        };

        const driftMatrix = () => {
          const rate = paramsRef.current.matDrift;
          for (let i = 0; i < curMat.length; i++) {
            let v = curMat[i] + (Math.random() * 2 - 1) * rate;
            v = v < -1 ? -1 : v > 1 ? 1 : v;
            curMat[i] = v;
          }
          device.queue.writeBuffer(matBuf, 0, curMat);
        };

        const decayOnce = () => {
          const enc = device.createCommandEncoder();
          const pass = enc.beginComputePass();
          pass.setPipeline(decPipe);
          pass.setBindGroup(0, dbg[cur]); // read latest state (bufs[cur])
          pass.dispatchWorkgroups(groups, groups);
          pass.end();
          device.queue.submit([enc.finish()]);
        };

        const renderFrame = () => {
          const enc = device.createCommandEncoder();
          const view = ctx.getCurrentTexture().createView();
          const pass = enc.beginRenderPass({
            colorAttachments: [{
              view, loadOp: "clear", storeOp: "store",
              clearValue: { r: 0.1, g: 0.1, b: 0.094, a: 1 },
            }],
          });
          pass.setPipeline(renPipe);
          pass.setBindGroup(0, rbg[cur]);
          pass.draw(3);
          pass.end();
          device.queue.submit([enc.finish()]);
        };

        const particleStepGPU = () => {
          const enc = device.createCommandEncoder();
          const pass = enc.beginComputePass();
          pass.setPipeline(pForcePipe);
          pass.setBindGroup(0, pcbg[pcur]); // in=pcur, out=1-pcur
          pass.dispatchWorkgroups(Math.ceil(PN / 64));
          pass.end();
          device.queue.submit([enc.finish()]);
          pcur = 1 - pcur;
        };

        // fade the trail texture toward black, then splat the swarm additively
        const trailPass = (enc: any, view: any, decay: number, drawSwarm: boolean) => {
          const pass = enc.beginRenderPass({
            colorAttachments: [{ view, loadOp: "load", storeOp: "store" }],
          });
          pass.setPipeline(pFadePipe);
          pass.setBlendConstant({ r: decay, g: decay, b: decay, a: decay });
          pass.draw(3);
          if (drawSwarm) {
            pass.setPipeline(pRenderPipe);
            pass.setBindGroup(0, prbg[pcur]); // pcur holds latest positions
            pass.draw(6, PN); // 6 verts/quad × PN instances
          }
          pass.end();
        };
        const compositePass = (enc: any, view: any, bg: any) => {
          const pass = enc.beginRenderPass({
            colorAttachments: [{
              view, loadOp: "clear", storeOp: "store",
              clearValue: { r: 0.072, g: 0.072, b: 0.066, a: 1 },
            }],
          });
          pass.setPipeline(pCompPipe);
          pass.setBindGroup(0, bg);
          pass.draw(3);
          pass.end();
        };
        const clearTrail = (view: any) => {
          const enc = device.createCommandEncoder();
          const pass = enc.beginRenderPass({
            colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
          });
          pass.end();
          device.queue.submit([enc.finish()]);
        };

        const particleRender = () => {
          const enc = device.createCommandEncoder();
          // while paused the trails hold still (no fade, no draw) but keep compositing
          if (!pausedRef.current) trailPass(enc, trailView, trailDecay(), true);
          compositePass(enc, ctx.getCurrentTexture().createView(), screenCompBG);
          device.queue.submit([enc.finish()]);
        };

        const resetParticles = () => {
          const st = initParticles(PN, PL.K);
          device.queue.writeBuffer(posBufs[pcur], 0, st.pos);
          device.queue.writeBuffer(velBufs[pcur], 0, st.vel);
          device.queue.writeBuffer(typeBufs[0], 0, st.type);
          device.queue.writeBuffer(typeBufs[1], 0, st.type);
          curMat = randomMatrix(PL.K); // new physics
          device.queue.writeBuffer(matBuf, 0, curMat);
          if (trailView) clearTrail(trailView); // fresh world, fresh canvas
        };

        // ---- rival "war" episodes inside Lenia (2-channel competitive engine) ----
        // war state + hues: channel 0 is the resident species, channel 1 the invader.
        const leniaWar = { active: false, end: 0, hueB: 0, killAB: 0.4, killBA: 0.4 };
        let warAdv = 0; // >0: species A leads in total cells (drives consumption)
        let advBusy = false; // guards the (non-blocking) advantage readback
        const LENIA_FIGHT_CHANCE = 0.45; // chance a fresh Lenia starts as a two-colour war
        const writeFightUniform = (frame: number) => {
          const pr = paramsRef.current;
          const R = Math.round(pr.kR);
          if (R !== curR || pr.kSigma !== curKSig) { device.queue.writeBuffer(kernBuf, 0, buildKernel(R, pr.kSigma)); curR = R; curKSig = pr.kSigma; }
          device.queue.writeBuffer(fightU, 0, new Float32Array([
            N, R, P.dt, 2 * R + 1,
            pr.mu, pr.sigma, pr.mu, pr.sigma,                 // both channels share the slider growth
            leniaWar.killAB, leniaWar.killBA, pr.energy, frame, // fc
            warAdv, pr.drift, frame * 0.003, pr.swirl,         // fd (advantage + flow)
            pr.leniaHue, leniaWar.hueB, 0.62, 0.95,            // fe colours (resident, invader)
          ]));
        };
        const fightStep = () => {
          const enc = device.createCommandEncoder();
          const pass = enc.beginComputePass();
          pass.setPipeline(fightPipe); pass.setBindGroup(0, fcbg[fcur]);
          pass.dispatchWorkgroups(groups, groups); pass.end();
          device.queue.submit([enc.finish()]); fcur = 1 - fcur;
        };
        const fightAdvect = () => {
          const enc = device.createCommandEncoder();
          const pass = enc.beginComputePass();
          pass.setPipeline(fightAdvPipe); pass.setBindGroup(0, fabg[fcur]);
          pass.dispatchWorkgroups(groups, groups); pass.end();
          device.queue.submit([enc.finish()]); fcur = 1 - fcur;
        };
        const fightRender = () => {
          const enc = device.createCommandEncoder();
          const view = ctx.getCurrentTexture().createView();
          const pass = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: { r: 0.094, g: 0.094, b: 0.086, a: 1 } }] });
          pass.setPipeline(fightRenderPipe); pass.setBindGroup(0, frbg[fcur]);
          pass.draw(3); pass.end();
          device.queue.submit([enc.finish()]);
        };
        // clear the field and seed two fresh, separated clusters of different colours;
        // they grow, collide and consume each other until the bigger one wins.
        const startLeniaWar = (frame: number) => {
          const v = new Float32Array(N * N * 2);
          const stamp = (cx: number, cy: number, ch: number) => {
            const rad = N * 0.12;
            for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
              if (Math.hypot(dx, dy) > rad) continue;
              const x = ((cx + dx) % N + N) % N | 0;
              const y = ((cy + dy) % N + N) % N | 0;
              if (Math.random() < 0.5) v[(y * N + x) * 2 + ch] = Math.random();
            }
          };
          // two random, separated centres (left-ish vs right-ish)
          stamp(N * (0.18 + 0.18 * Math.random()), N * (0.25 + 0.5 * Math.random()), 0);
          stamp(N * (0.64 + 0.18 * Math.random()), N * (0.25 + 0.5 * Math.random()), 1);
          device.queue.writeBuffer(fightBufs[0], 0, v); fcur = 0;
          // resident keeps the current hue; rival gets a distinct new one
          leniaWar.hueB = (paramsRef.current.leniaHue + 0.3 + 0.4 * Math.random()) % 1;
          if (Math.random() < 0.5) { leniaWar.killAB = 0.30; leniaWar.killBA = 0.6; } // random aggressor
          else { leniaWar.killAB = 0.6; leniaWar.killBA = 0.30; }
          warAdv = 0;
          leniaWar.active = true; leniaWar.end = frame + 560; // time to grow, clash, resolve
        };
        // periodic readback of the two colours' mass → who is winning (drives consumption)
        const updateWarAdvantage = async () => {
          const bytes = N * N * 8;
          const staging = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
          const enc = device.createCommandEncoder();
          enc.copyBufferToBuffer(fightBufs[fcur], 0, staging, 0, bytes);
          device.queue.submit([enc.finish()]);
          await staging.mapAsync(GPUMapMode.READ);
          const v = new Float32Array(N * N * 2);
          v.set(new Float32Array(staging.getMappedRange()));
          staging.unmap(); staging.destroy?.();
          let mA = 0, mB = 0;
          for (let i = 0; i < N * N; i++) { mA += v[i * 2]; mB += v[i * 2 + 1]; }
          warAdv = (mA - mB) / (mA + mB + 1e-6);
        };
        // resolve: whichever colour has more mass wins; it continues as the lone species
        const resolveLeniaWar = async () => {
          const bytes = N * N * 8;
          const staging = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
          const enc = device.createCommandEncoder();
          enc.copyBufferToBuffer(fightBufs[fcur], 0, staging, 0, bytes);
          device.queue.submit([enc.finish()]);
          await staging.mapAsync(GPUMapMode.READ);
          const v = new Float32Array(N * N * 2);
          v.set(new Float32Array(staging.getMappedRange()));
          staging.unmap(); staging.destroy?.();
          let mA = 0, mB = 0;
          for (let i = 0; i < N * N; i++) { mA += v[i * 2]; mB += v[i * 2 + 1]; }
          const winnerB = mB > mA;
          const ch = winnerB ? 1 : 0;
          const out = new Float32Array(N * N);
          for (let i = 0; i < N * N; i++) out[i] = v[i * 2 + ch];
          device.queue.writeBuffer(bufs[cur], 0, out);
          device.queue.writeBuffer(histBuf, 0, new Float32Array(N * N));
          // the winner's colour lives on — fully tint the continuing Lenia to it
          const winHue = winnerB ? leniaWar.hueB : paramsRef.current.leniaHue;
          const np = { ...paramsRef.current, leniaHue: +winHue.toPrecision(4), leniaTint: 1 };
          paramsRef.current = np; setParams(np);
          leniaWar.active = false;
        };

        /* ---- M5: CMA-ES search — breed parameters that maximize CLIP resonance --- */
        // Offscreen capture: render a candidate into our own texture and read the
        // pixels back directly — robust, unlike snapshotting the live canvas mid-search.
        const CAP = 224;
        const capBPR = Math.ceil((CAP * 4) / 256) * 256; // bytesPerRow must be 256-aligned
        const capTex = device.createTexture({
          size: [CAP, CAP], format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });
        const capView = capTex.createView();
        const capRead = device.createBuffer({ size: capBPR * CAP, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const bgra = format.startsWith("bgra");
        // particle candidates accumulate trails into their own HDR square, so CLIP
        // judges the composited look (streaks, glow) — exactly what a viewer sees
        const capTrailTex = device.createTexture({
          size: [CAP, CAP], format: TRAIL_FORMAT,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        const capTrailView = capTrailTex.createView();
        const capCompBG = mkCompBG(capTrailView);
        const captureEmbed = async (kind: "field" | "particle") => {
          const enc = device.createCommandEncoder();
          if (kind === "field") {
            const pass = enc.beginRenderPass({
              colorAttachments: [{ view: capView, loadOp: "clear", storeOp: "store", clearValue: { r: 0.072, g: 0.072, b: 0.066, a: 1 } }],
            });
            pass.setPipeline(renPipe); pass.setBindGroup(0, rbg[cur]); pass.draw(3);
            pass.end();
          } else {
            compositePass(enc, capView, capCompBG); // tone-mapped trails → capture tex
          }
          enc.copyTextureToBuffer({ texture: capTex }, { buffer: capRead, bytesPerRow: capBPR, rowsPerImage: CAP }, [CAP, CAP, 1]);
          device.queue.submit([enc.finish()]);
          await capRead.mapAsync(GPUMapMode.READ);
          const src = new Uint8Array(capRead.getMappedRange());
          const rgba = new Uint8ClampedArray(CAP * CAP * 4);
          for (let y = 0; y < CAP; y++) for (let x = 0; x < CAP; x++) {
            const si = y * capBPR + x * 4, di = (y * CAP + x) * 4;
            if (bgra) { rgba[di] = src[si + 2]; rgba[di + 1] = src[si + 1]; rgba[di + 2] = src[si]; }
            else { rgba[di] = src[si]; rgba[di + 1] = src[si + 1]; rgba[di + 2] = src[si + 2]; }
            rgba[di + 3] = 255;
          }
          capRead.unmap();
          let lum = 0;
          for (let i = 0; i < rgba.length; i += 4) lum += (rgba[i] + rgba[i + 1] + rgba[i + 2]);
          const cov = lum / (rgba.length / 4 * 3 * 255); // mean brightness ∈ [0,1]
          const embs = await embedPixelsMulti(rgba, CAP, CAP); // full frame + zoom crop, batched
          return { embs, cov };
        };

        /* ---- trained summon prior: offline-evolved genome atlas ------------- */
        // ml/genesis/train_summon_prior.py distills hours of CLIP-guided evolution
        // into public/genesis/summon-prior.json; at summon time the prompt embedding
        // retrieves the nearest concepts and their genomes seed the live search.
        type PriorEntry = { prompt: string; e: Float32Array; g: number[] };
        let priorEntries: PriorEntry[] | null = null;
        const getPrior = async (): Promise<PriorEntry[]> => {
          if (priorEntries) return priorEntries;
          try {
            const r = await fetch("/genesis/summon-prior.json");
            if (!r.ok) throw new Error(String(r.status));
            const j = await r.json();
            priorEntries = (Array.isArray(j?.entries) ? j.entries : [])
              .filter((en: any) => Array.isArray(en?.e) && Array.isArray(en?.g) && en.g.length === P_GENOME_LEN)
              .map((en: any) => {
                const e = Float32Array.from(en.e as number[]);
                let s = 0; for (let i = 0; i < e.length; i++) s += e[i] * e[i];
                s = Math.sqrt(s) || 1;
                for (let i = 0; i < e.length; i++) e[i] /= s;
                return {
                  prompt: String(en.prompt ?? ""),
                  e,
                  g: (en.g as number[]).map((x) => Math.min(1, Math.max(0, x))),
                };
              });
          } catch { priorEntries = []; } // atlas not shipped yet → search runs unaided
          return priorEntries ?? [];
        };
        // empty/collapsed frames (a swarm sucked into one dot) read as near-black —
        // scale their fitness down so the search prefers worlds that fill the view.
        const covPenalty = (cov: number) => 0.3 + 0.7 * Math.min(1, Math.max(0, (cov - 0.004) / 0.02));
        const developLenia = (steps: number, f0: number) => {
          for (let i = 0; i < steps; i++) { writeFieldUniform(f0 + i); stepOnce(); advectOnce(); }
          decayOnce();
        };
        // develop a particle candidate: step physics with the capture-styled uniform
        // and accumulate the last stretch of motion into the capture trail texture,
        // so the embedding sees trails exactly as the live view renders them
        const developParticle = (steps: number) => {
          const TRAIL_STEPS = 45;
          for (let i = 0; i < steps; i++) {
            pseed++;
            writePUni(pseed, true);
            particleStepGPU();
            if (i >= steps - TRAIL_STEPS) {
              const enc = device.createCommandEncoder();
              trailPass(enc, capTrailView, trailDecay(), true);
              device.queue.submit([enc.finish()]);
            }
          }
        };
        // mirror the candidate to the live canvas so the search is a spectacle
        const showLive = () => { writePUni(pseed, false); particleRender(); };
        const applyCandidate = (sub: Substrate, vec: number[]) => {
          if (sub === "lenia") {
            const pr = { ...paramsRef.current };
            const nL = SLIDERS.lenia.length;
            SLIDERS.lenia.forEach(([key, , min, max], i) => { pr[key] = min + vec[i] * (max - min); });
            LENIA_COLOR_KEYS.forEach((key, i) => { pr[key] = vec[nL + i]; }); // hue, tint (0..1)
            paramsRef.current = pr;
            device.queue.writeBuffer(bufs[cur], 0, seedScenario(N));
            device.queue.writeBuffer(histBuf, 0, new Float32Array(N * N));
          } else {
            const K2 = PL.K * PL.K;
            const m = new Float32Array(K2);
            for (let i = 0; i < K2; i++) m[i] = -1 + vec[i] * 2;
            curMat = m;
            device.queue.writeBuffer(matBuf, 0, curMat);
            const pr = { ...paramsRef.current };
            P_GENOME.forEach(([key, mn, mx], i) => { pr[key] = mn + vec[K2 + i] * (mx - mn); });
            paramsRef.current = pr;
            const st = initParticles(PN, PL.K);
            device.queue.writeBuffer(posBufs[pcur], 0, st.pos);
            device.queue.writeBuffer(velBufs[pcur], 0, st.vel);
            device.queue.writeBuffer(typeBufs[0], 0, st.type);
            device.queue.writeBuffer(typeBufs[1], 0, st.type);
            clearTrail(capTrailView); // fresh candidate, fresh trails
          }
        };
        const evalCandidate = async (sub: Substrate, mode: "prompt" | "open", vec: number[]) => {
          const kind = sub === "lenia" ? "field" : "particle";
          applyCandidate(sub, vec);
          if (sub === "lenia") { developLenia(95, 0); renderFrame(); } else { developParticle(150); showLive(); }
          const a = await captureEmbed(kind);
          if (mode === "prompt") {
            // two moments × two crops per moment → a dense, denoised fitness signal
            if (sub === "lenia") { developLenia(28, 95); renderFrame(); } else { developParticle(45); showLive(); }
            const a2 = await captureEmbed(kind);
            const te = textEmbedRef.current!;
            const nulls = await getNullBank();
            const sim = matchScore([...a.embs, ...a2.embs], te, nulls); // contrastive margin
            return sim * covPenalty(Math.max(a.cov, a2.cov)); // punish invisible worlds
          }
          if (sub === "lenia") { developLenia(60, 80); renderFrame(); } else { developParticle(90); showLive(); }
          const b = await captureEmbed(kind);
          return (1 - cosine(meanEmbed(a.embs), meanEmbed(b.embs))) * covPenalty(Math.max(a.cov, b.cov)); // restless & visible
        };

        const runSearch = async (mode: "prompt" | "open") => {
          if (searchActiveRef.current) return;
          const sub = substrateRef.current;
          if (sub === "life") { setSearchInfo("Search runs on Lenia & Particles."); return; }
          if (mode === "prompt" && !textEmbedRef.current) { setSearchInfo("Summon a prompt first."); return; }
          if (mode === "open" && !textEmbedRef.current) {
            try { setVisionStatus("loading"); setVisionMsg("loading vision model…"); await loadVision(); setVisionStatus("ready"); setVisionMsg(""); }
            catch (e: any) { setVisionStatus("error"); setVisionMsg(e?.message ?? "model load failed"); return; }
          }
          searchActiveRef.current = true; searchCancelRef.current = false;
          setSearching(true); mouseRef.current.active = false;

          const K2 = PL.K * PL.K;
          const mean0: number[] = [];
          if (sub === "lenia") {
            SLIDERS.lenia.forEach(([key, , min, max]) => {
              mean0.push(Math.max(0, Math.min(1, (paramsRef.current[key] - min) / (max - min))));
            });
            LENIA_COLOR_KEYS.forEach((key) => mean0.push(Math.max(0, Math.min(1, paramsRef.current[key]))));
          } else {
            for (let i = 0; i < K2; i++) mean0.push((curMat[i] + 1) / 2);
            P_GENOME.forEach(([key, mn, mx]) => {
              mean0.push(Math.max(0, Math.min(1, (paramsRef.current[key] - mn) / (mx - mn))));
            });
          }

          let bestScore = -Infinity; let bestVec: number[] | null = null;
          const GENS = sub === "lenia" ? 12 : 10;
          try {
            let warmVec = mean0.slice();
            const take = (v: number[], s: number, label: string) => {
              if (s > bestScore) { bestScore = s; bestVec = v.slice(); warmVec = v.slice(); }
              setScore(s);
              setSearchInfo(`${label} · best ${bestScore.toFixed(3)}`);
            };
            // 1) trained prior — genomes evolved offline for concepts near this prompt
            //    (retrieval in CLIP space) get first shot at seeding the search
            if (sub === "particle" && mode === "prompt") {
              const prior = await getPrior();
              if (prior.length) {
                const te = textEmbedRef.current!;
                const ranked = prior
                  .map((en) => ({ en, c: cosine(te, en.e) }))
                  .sort((x, y) => y.c - x.c)
                  .slice(0, 3);
                for (const { en, c } of ranked) {
                  if (searchCancelRef.current) break;
                  const s = await evalCandidate(sub, mode, en.g);
                  take(en.g, s, `prior · “${en.prompt}” ${c.toFixed(2)}`);
                }
              }
            }
            // 2) Latin-hypercube warm start: stratified coverage of the genome box
            //    (uniform random wastes samples; LHS spreads them over every axis)
            const WARM = sub === "lenia" ? 12 : 14;
            const nDim = mean0.length;
            const strata: number[][] = Array.from({ length: nDim }, () => {
              const p = Array.from({ length: WARM }, (_, k) => k);
              for (let k = WARM - 1; k > 0; k--) { const r = (Math.random() * (k + 1)) | 0; [p[k], p[r]] = [p[r], p[k]]; }
              return p;
            });
            for (let i = 0; i < WARM && !searchCancelRef.current; i++) {
              const v = Array.from({ length: nDim }, (_, d) => (strata[d][i] + Math.random()) / WARM);
              const s = await evalCandidate(sub, mode, v);
              take(v, s, `exploring ${i + 1}/${WARM}`);
            }
            const es = new CMAES(warmVec, 0.30);
            for (let g = 0; g < GENS && !searchCancelRef.current; g++) {
              const pop = es.ask();
              const fit: number[] = [];
              for (let k = 0; k < pop.length; k++) {
                if (searchCancelRef.current) break;
                const s = await evalCandidate(sub, mode, pop[k]);
                fit.push(-s); // CMA-ES minimizes
                if (s > bestScore) { bestScore = s; bestVec = pop[k].slice(); }
                setScore(s);
                setSearchInfo(`gen ${g + 1}/${GENS} · ${k + 1}/${pop.length} · best ${bestScore.toFixed(3)}`);
              }
              if (fit.length === pop.length) es.tell(fit);
            }
            if (bestVec) {
              applyCandidate(sub, bestVec);
              // reflect the winning controls in the sliders + permalink
              const np = { ...paramsRef.current };
              if (sub === "lenia") {
                const nL = SLIDERS.lenia.length;
                SLIDERS.lenia.forEach(([key, , min, max], i) => { np[key] = +(min + bestVec![i] * (max - min)).toPrecision(4); });
                LENIA_COLOR_KEYS.forEach((key, i) => { np[key] = +bestVec![nL + i].toPrecision(4); });
              } else {
                const K2b = PL.K * PL.K;
                P_GENOME.forEach(([key, mn, mx], i) => { np[key] = +(mn + bestVec![K2b + i] * (mx - mn)).toPrecision(4); });
                // hold the summoned creature: stop the matrix random-walk eroding it
                if (mode === "prompt") np.matDrift = 0;
              }
              setParams(np);
            }
          } finally {
            searchActiveRef.current = false;
            setSearching(false);
            setSearchInfo(`${searchCancelRef.current ? "stopped" : "done"} · best ${bestScore.toFixed(3)}`);
          }
        };
        runSearchRef.current = runSearch;

        /* ---- click-to-seed: read back current state, stamp a soft blob --- */
        const applySeed = async (gx: number, gy: number) => {
          if (substrateRef.current === "particle") {
            // a click conjures a new set of physics → new emergent species
            curMat = randomMatrix(PL.K);
            device.queue.writeBuffer(matBuf, 0, curMat);
            return;
          }
          const bytes = N * N * 4;
          const staging = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
          const enc = device.createCommandEncoder();
          enc.copyBufferToBuffer(bufs[cur], 0, staging, 0, bytes);
          device.queue.submit([enc.finish()]);
          await staging.mapAsync(GPUMapMode.READ);
          const mirror = new Float32Array(N * N);
          mirror.set(new Float32Array(staging.getMappedRange()));
          staging.unmap();
          staging.destroy?.();
          const life = substrateRef.current === "life";
          const rad = life ? P.R * 1.2 : P.R * 2.0;
          for (let dy = -rad; dy <= rad; dy++) {
            for (let dx = -rad; dx <= rad; dx++) {
              const d = Math.hypot(dx, dy);
              if (d > rad) continue;
              const x = ((gx + dx) % N + N) % N | 0;
              const y = ((gy + dy) % N + N) % N | 0;
              const idx = y * N + x;
              if (life) {
                // Game of Life: scatter live cells so a click sparks activity
                if (Math.random() < 0.55) mirror[idx] = 1;
              } else {
                // Lenia: OVERWRITE a clean smooth disc — clears the lattice around
                // the cursor and plants a fresh, distinct creature that blooms.
                const f = 1 - d / rad;
                const bump = f * f * (3 - 2 * f); // smoothstep falloff
                mirror[idx] = bump * 0.95;
              }
            }
          }
          device.queue.writeBuffer(bufs[cur], 0, mirror);
        };

        const doReset = () => {
          if (substrateRef.current === "particle") { resetParticles(); return; }
          leniaWar.active = false;
          device.queue.writeBuffer(histBuf, 0, new Float32Array(N * N));
          if (substrateRef.current === "life") { device.queue.writeBuffer(bufs[cur], 0, seedLifeField(N)); return; }
          // Lenia: sometimes a fresh sim begins as a two-colour fight to the death
          if (Math.random() < LENIA_FIGHT_CHANCE) { startLeniaWar(frame); }
          else { device.queue.writeBuffer(bufs[cur], 0, seedScenario(N)); }
        };

        setStatus("ready");
        if (substrateRef.current === "lenia") doReset(); // roll for an opening fight on load

        if (reduce) {
          // static-ish: evolve briefly into structure, then hold one frame
          if (substrateRef.current === "particle") {
            for (let i = 0; i < 180; i++) {
              pseed = i;
              writePUni(i, false);
              particleStepGPU();
              if (i >= 120) {
                const enc = device.createCommandEncoder();
                trailPass(enc, trailView, trailDecay(), true);
                device.queue.submit([enc.finish()]);
              }
            }
            const enc = device.createCommandEncoder();
            compositePass(enc, ctx.getCurrentTexture().createView(), screenCompBG);
            device.queue.submit([enc.finish()]);
            return;
          }
          for (let i = 0; i < 80; i++) stepOnce();
          decayOnce();
          renderFrame();
          return;
        }

        const loop = async () => {
          if (disposed) return;
          if (searchActiveRef.current) { raf = requestAnimationFrame(loop); return; } // search drives the GPU
          frame++;
          if (switchRef.current) { switchRef.current = false; doReset(); }
          if (resetRef.current) { resetRef.current = false; doReset(); }
          if (seedRef.current) { const s = seedRef.current; seedRef.current = null; await applySeed(s.x, s.y); }

          if (substrateRef.current === "particle") {
            pseed = frame;
            pUniWrite?.(); // refresh cursor + frame seed
            if (!pausedRef.current) {
              if (frame % MATRIX_DRIFT_EVERY === 0) driftMatrix(); // physics slowly evolves
              particleStepGPU();
            }
            particleRender();
            raf = requestAnimationFrame(loop);
            return;
          }

          // Lenia "war": some fresh sims open with two colours fighting to the death,
          // animated frame-by-frame until the bigger one wins and lives on.
          if (substrateRef.current === "lenia" && leniaWar.active) {
            if (!pausedRef.current && frame >= leniaWar.end) {
              await resolveLeniaWar();
              // fall through and render the restored single-channel winner this frame
            } else {
              writeFightUniform(frame);
              if (!pausedRef.current) {
                // non-blocking refresh of who's winning → no frame stall, continuous motion
                if (frame % 16 === 0 && !advBusy) { advBusy = true; updateWarAdvantage().finally(() => { advBusy = false; }); }
                fightStep();    // grow + consume
                fightAdvect();  // drift + swirl (motion)
              }
              fightRender();
              raf = requestAnimationFrame(loop); return;
            }
          }

          writeFieldUniform(frame); // metabolism + energy + flow heading
          if (!pausedRef.current) {
            const life = substrateRef.current === "life";
            // Game of Life steps slowly so generations are legible; Lenia every frame
            if (!life) { for (let i = 0; i < SUBSTEPS; i++) stepOnce(); advectOnce(); }
            else if (frame % Math.max(1, Math.round(paramsRef.current.lifeEvery)) === 0) { stepOnce(); }
          }
          decayOnce();
          renderFrame();
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e: any) {
        fail(e?.message ?? String(e));
      }
    })();

    /* map a pointer event to a grid cell and queue a seed */
    const onPointer = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const gx = Math.floor(((ev.clientX - r.left) / r.width) * N);
      const gy = Math.floor(((ev.clientY - r.top) / r.height) * N);
      if (gx >= 0 && gx < N && gy >= 0 && gy < N) seedRef.current = { x: gx, y: gy };
    };
    const onMove = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (ev.clientX - r.left) / r.width,
        y: (ev.clientY - r.top) / r.height,
        active: true,
      };
    };
    const onLeave = () => { mouseRef.current.active = false; };
    canvas.addEventListener("pointerdown", onPointer);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      try { roRef?.disconnect?.(); } catch { /* noop */ }
      try { device?.destroy?.(); } catch { /* noop */ }
    };
  }, []);

  const wrap: CSSProperties = {
    position: "relative", width: "100%", height: "calc(100svh - 4rem)",
    background: INK, overflow: "hidden",
  };
  const cvs: CSSProperties = {
    position: "absolute", inset: 0, width: "100%", height: "100%",
    display: "block", cursor: "crosshair",
  };

  return (
    <>
    <div style={wrap}>
      <canvas ref={canvasRef} style={cvs} />

      {/* title plate — frosted dark card; retires on first interaction */}
      <div style={{
        position: "absolute", top: 22, left: 22, maxWidth: 380, color: CONCRETE,
        pointerEvents: "none",
        opacity: everInteracted ? 0 : 1, transition: "opacity .7s ease",
        background: "linear-gradient(135deg, rgba(20,20,18,0.62), rgba(20,20,18,0.40))",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(196,168,130,0.28)", borderRadius: 14,
        padding: "16px 20px", boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
      }}>
        <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: SAND, fontWeight: 600 }}>
          genesis · ii
        </div>
        <h1 style={{ fontSize: 27, margin: "7px 0 5px", fontWeight: 600, letterSpacing: -0.3, color: "#FBFAF7" }}>
          Particle Life
        </h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(247,245,240,0.78)", margin: 0 }}>
          {PN.toLocaleString()} agents, {PL.K} species — flocking, wind, predation waves. Move to herd them; click for new physics.
        </p>
      </div>

      {/* M4 — summon (CLIP scoring) */}
      {status === "ready" && (
        <div style={{ ...summonCard, opacity: uiVisible ? 1 : 0, pointerEvents: uiVisible ? "auto" : "none", transition: "opacity .6s ease" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: SAND, fontWeight: 600 }}>
            summon · clip
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.45, color: "rgba(247,245,240,0.62)", margin: "5px 0 9px" }}>
            Describe a lifeform. An in-browser vision model scores the resemblance.
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") startSummon(); }}
              placeholder="a glowing jellyfish"
              style={textInput}
            />
            <button
              style={btn}
              onClick={startSummon}
              disabled={visionStatus === "loading" || searching}
            >
              {visionStatus === "loading" ? "…" : "Summon"}
            </button>
          </div>
          {visionMsg && (
            <div style={{ fontSize: 11, marginTop: 7, color: visionStatus === "error" ? "#D08763" : "rgba(247,245,240,0.55)" }}>
              {visionMsg}
            </div>
          )}
          {visionStatus === "ready" && score != null && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(247,245,240,0.7)", marginBottom: 4 }}>
                <span>resonance</span><span style={{ color: SAND }}>{score.toFixed(3)}</span>
              </div>
              <div style={meterTrack}><div style={{ ...meterFill, width: `${resonance(score) * 100}%` }} /></div>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 11 }}>
            {searching ? (
              <button style={btn} onClick={() => { searchCancelRef.current = true; }}>Stop</button>
            ) : (
              <button style={btn} onClick={() => runSearchRef.current?.("open")}>Open-ended ↯</button>
            )}
          </div>
          {searchInfo && (
            <div style={{ fontSize: 11, color: "rgba(247,245,240,0.62)", marginTop: 6 }}>{searchInfo}</div>
          )}
          <div style={{ fontSize: 10.5, color: "rgba(247,245,240,0.42)", marginTop: 9, lineHeight: 1.45 }}>
            <b style={{ color: "rgba(247,245,240,0.6)", fontWeight: 600 }}>Summon</b> retrieves a trained prior for your words, then breeds toward them (CMA-ES on a 51-gene genome, scored by contrastive CLIP). <b style={{ color: "rgba(247,245,240,0.6)", fontWeight: 600 }}>Open-ended</b> hunts restless life.
          </div>
        </div>
      )}

      {/* control panel */}
      {status === "ready" && (
        <div style={{ ...panelWrap(panelOpen), opacity: uiVisible ? 1 : 0, pointerEvents: uiVisible ? "auto" : "none", transition: "opacity .6s ease" }}>
          <div style={panelHead}>
            <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: SAND, fontWeight: 600 }}>
              controls
            </span>
            <button style={collapseBtn} onClick={() => setPanelOpen((o) => !o)} aria-label="Toggle controls">
              {panelOpen ? "–" : "+"}
            </button>
          </div>

          {panelOpen && (
            <>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                {MACROS.particle.map((m) => {
                  const t = m.read(params);
                  return (
                    <Slider key={m.key} label={m.label} min={0} max={1} step={0.01}
                      value={t} display={`${Math.round(t * 100)}`}
                      onChange={(v) => setMacro(m, v)} />
                  );
                })}
              </div>

              {PRESETS.particle && (
                <div style={{ marginTop: 12 }}>
                  <div style={presetLabel}>presets</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {Object.entries(PRESETS.particle!).map(([name, obj]) => (
                      <button key={name} style={chip} onClick={() => applyPreset(obj)}>{name}</button>
                    ))}
                  </div>
                </div>
              )}

              <button style={advBtn} onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
                {advanced ? "advanced ▾" : "advanced ▸"}
              </button>
              {advanced && (
                <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 9 }}>
                  {SLIDERS.particle.map(([key, label, min, max, step]) => (
                    <Slider key={key} label={label} min={min} max={max} step={step}
                      value={params[key]} onChange={(v) => setParam(key, v)} />
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 6, marginTop: 13 }}>
                <button onClick={() => setPaused((p) => !p)} style={btn}>{paused ? "Play" : "Pause"}</button>
                <button onClick={() => { resetRef.current = true; }} style={btn}>New world</button>
                <button onClick={copyLink} style={btn}>{copied ? "Copied ✓" : "Copy link"}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* status overlays */}
      {status === "loading" && <Center>Spinning up the GPU…</Center>}
      {status === "nogpu" && (
        <Center>
          This live simulation needs WebGPU, which your browser/device doesn’t expose.
          Try the latest Chrome or Edge, or Safari on iOS&nbsp;26 / macOS&nbsp;26+.
        </Center>
      )}
      {status === "error" && <Center>Couldn’t start the simulation: {err}</Center>}

      {/* faint affordance: controls live here, move to reveal */}
      {status === "ready" && everInteracted && idle && (
        <div style={{
          position: "absolute", bottom: 22, left: 22, width: 8, height: 8, borderRadius: 999,
          background: "rgba(196,168,130,0.5)", boxShadow: "0 0 12px rgba(196,168,130,0.5)",
          pointerEvents: "none", transition: "opacity .6s ease",
        }} />
      )}

      {egg && (
        <div style={{
          position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "rgba(20,20,18,0.78)", color: SAND, border: "1px solid rgba(196,168,130,0.4)",
          borderRadius: 999, padding: "8px 18px", fontSize: 13, letterSpacing: 0.5,
          fontFamily: 'var(--font-mono), "JetBrains Mono", ui-monospace, monospace',
          backdropFilter: "blur(8px)", pointerEvents: "none",
        }}>
          {egg}
        </div>
      )}
    </div>

    <GenesisWriteup />
    </>
  );
}

/* ---- scroll-down research writeup (on-brand, concise) -------------------- */
function GenesisWriteup() {
  return (
    <section className="bg-concrete text-ink">
      <div className="mx-auto max-w-prose px-6 py-20 md:py-28">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-sage">
          Genesis · Flagship II · How it works
        </p>
        <h2 className="mb-5 font-display text-3xl leading-tight md:text-[2.5rem]">
          Summoning swarms from a text prompt
        </h2>
        <p className="text-base leading-prose text-ink/80">
          Genesis is a WebGPU particle-life lab. You describe a lifeform in plain
          English and a foundation model plus an evolutionary search coax it out of
          a living swarm, entirely on your own machine, no server. It is the
          generative counterpart to{" "}
          <a href="/catchment" className="underline decoration-sand underline-offset-4 hover:text-sage">Catchment</a>,
          which runs a physics engine on real terrain.
        </p>

        <Block kicker="The simulation">
          <strong className="font-medium text-ink">Particle Life</strong> sets 2,400
          agents of six species loose under an asymmetric attraction matrix,
          extended here with flocking, a global wind field, per-species force
          pulsing and cyclic predation. Waves of colour sweep the swarm as species
          convert each other. Everything renders through an HDR trail buffer with
          velocity-stretched, speed-heated sprites. Move the cursor to herd them,
          click to roll new physics.
        </Block>

        <Block kicker="Summon by prompt">
          Type a description and an in-browser{" "}
          <strong className="font-medium text-ink">CLIP</strong> model, running
          client-side on WebGPU, scores how much the swarm resembles your words. The
          fitness is contrastive: each candidate is embedded from several views and
          moments, and the prompt’s similarity is measured <em>against</em> a bank
          of generic descriptions, so the search climbs on what is specific to your
          words rather than on glowing dots on black. A{" "}
          <strong className="font-medium text-ink">separable CMA-ES</strong> then
          breeds a 51-gene genome covering the full attraction matrix, the physics
          and the palette, warm-started from a{" "}
          <strong className="font-medium text-ink">trained prior</strong>: an
          offline pipeline evolves genomes for dozens of concepts against the same
          CLIP model, and your prompt retrieves the nearest ones in embedding
          space. An open-ended mode instead hunts for restless, ever-changing
          motion. The approach follows ASAL (Sakana&nbsp;AI&nbsp;+&nbsp;MIT,
          <em> Artificial Life</em>, 2025), realized here as something you can drive.
        </Block>

        <Block kicker="Making it feel alive">
          The attraction matrix slowly drifts, thermal jitter keeps the swarm from
          settling, and a cursor field lets you steer the agents in real time.
          Trails, streaks, wind and predation waves turn simple rules into motion
          that reads as organic, and every lever is a live slider.
        </Block>

        <Block kicker="Built blind, verified offline">
          Raw WebGPU throughout, dependency-light, with graceful fallbacks so the
          page never hard-fails. The simulation rules and the optimizer each have a
          pure reference implementation validated headlessly, checking bounded
          dynamics, no NaNs, emergent clustering and confirmed convergence, before
          being transcribed to GPU shaders.
        </Block>

        <Block kicker="Honest limits">
          The swarm is abstract. CLIP nudges colour, density and motion toward the
          vibe of a prompt, but the medium is particles and trails, not anatomy.
          That gap, emergent media judged by a model trained on natural images, is
          the interesting tension, and it is true of the original research too.
        </Block>

        <p className="mt-12 border-l-2 border-sage pl-4 font-mono text-xs leading-relaxed text-ink/55">
          Tip: type <span className="text-sage">catchment</span> or{" "}
          <span className="text-sage">surprise</span> anywhere on the page.
        </p>
      </div>
    </section>
  );
}

function Block({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-sage">{kicker}</h3>
      <p className="text-base leading-prose text-ink/80">{children}</p>
    </div>
  );
}

const btn: CSSProperties = {
  background: "rgba(247,245,240,0.10)", color: "#F7F5F0",
  border: "1px solid rgba(247,245,240,0.25)", borderRadius: 8,
  padding: "8px 14px", fontSize: 13, cursor: "pointer", backdropFilter: "blur(6px)",
};

const summonCard: CSSProperties = {
  position: "absolute", top: 22, right: 22, width: 290,
  background: "linear-gradient(135deg, rgba(20,20,18,0.72), rgba(20,20,18,0.52))",
  backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
  border: "1px solid rgba(196,168,130,0.28)", borderRadius: 14,
  padding: "14px 16px", boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
  fontFamily: 'var(--font-mono), "JetBrains Mono", ui-monospace, monospace',
};
const textInput: CSSProperties = {
  flex: 1, minWidth: 0, background: "rgba(247,245,240,0.06)", color: "#F7F5F0",
  border: "1px solid rgba(247,245,240,0.22)", borderRadius: 8, padding: "8px 10px",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};
const meterTrack: CSSProperties = {
  width: "100%", height: 6, borderRadius: 4, background: "rgba(247,245,240,0.12)", overflow: "hidden",
};
const meterFill: CSSProperties = {
  height: "100%", background: "linear-gradient(90deg, #4A6741, #C4A882)", transition: "width 0.3s ease",
};

const panelWrap = (open: boolean): CSSProperties => ({
  position: "absolute", bottom: 22, left: 22, width: open ? 270 : "auto",
  background: "linear-gradient(135deg, rgba(20,20,18,0.72), rgba(20,20,18,0.52))",
  backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
  border: "1px solid rgba(196,168,130,0.28)", borderRadius: 14,
  padding: open ? "13px 15px 15px" : "10px 12px",
  maxHeight: open ? "calc(100% - 44px)" : undefined,
  overflowY: open ? "auto" : "visible",
  overscrollBehavior: "contain",
  boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
  fontFamily: 'var(--font-mono), "JetBrains Mono", ui-monospace, monospace',
});
const panelHead: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
};
const collapseBtn: CSSProperties = {
  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
  border: "1px solid rgba(247,245,240,0.25)", borderRadius: 6, background: "transparent",
  color: "rgba(247,245,240,0.75)", fontSize: 15, lineHeight: 1, cursor: "pointer",
};
const presetLabel: CSSProperties = {
  fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(247,245,240,0.45)",
};
const chip: CSSProperties = {
  background: "rgba(247,245,240,0.08)", color: "rgba(247,245,240,0.85)",
  border: "1px solid rgba(247,245,240,0.2)", borderRadius: 7, padding: "5px 10px",
  fontSize: 12, cursor: "pointer", fontFamily: "inherit",
};
const advBtn: CSSProperties = {
  marginTop: 12, background: "transparent", color: "rgba(247,245,240,0.5)",
  border: "none", padding: 0, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase",
  cursor: "pointer", fontFamily: "inherit",
};

const seg: CSSProperties = {
  display: "flex", gap: 2, padding: 2, borderRadius: 10,
  background: "rgba(20,20,18,0.5)", border: "1px solid rgba(247,245,240,0.18)",
  backdropFilter: "blur(6px)",
};
const segBtn = (active: boolean): CSSProperties => ({
  background: active ? "rgba(196,168,130,0.92)" : "transparent",
  color: active ? "#1A1A18" : "rgba(247,245,240,0.78)",
  border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 13,
  fontWeight: active ? 600 : 400, cursor: "pointer", transition: "background 0.15s",
});

function Slider({ label, min, max, step, value, onChange, display }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; display?: string;
}) {
  const fmt = display ?? (Number.isInteger(value) ? String(value) : String(+value.toPrecision(3)));
  return (
    <label style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(247,245,240,0.72)", marginBottom: 3 }}>
        <span>{label}</span><span style={{ color: SAND }}>{fmt}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: SAND, cursor: "pointer", height: 3 }}
      />
    </label>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", inset: 0, display: "grid", placeItems: "center",
      color: "#F7F5F0", textAlign: "center", padding: 24, pointerEvents: "none",
    }}>
      <div style={{ maxWidth: 460, fontSize: 15, lineHeight: 1.6, opacity: 0.9 }}>{children}</div>
    </div>
  );
}

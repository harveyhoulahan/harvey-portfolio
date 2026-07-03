/*
 * Catchment terminal — command core.
 *
 * Two-tier understanding, deliberately layered so the cheap path always wins:
 *   1. a deterministic grammar (`rain 60`, `wind 40 from nw`, `meteor for 30s`)
 *      that resolves instantly with zero ambiguity, and
 *   2. a natural-language fallback: slots (numbers / compass / durations) are
 *      extracted by rule, then the residual phrasing goes to the trained
 *      intent model (lib/catchment/intent.ts) — or, if the model is absent,
 *      to a small keyword lexicon.
 *
 * The core never touches React or the GPU: it talks to the sim through the
 * CatchmentBus interface and returns plain lines + effects, which keeps every
 * branch of the grammar unit-testable in Node.
 */

import type { IntentPrediction } from "./intent";

export type TermMode = "orbit" | "pour" | "ignite" | "meteor";
export type ParamKey = "rain" | "storm" | "erosion" | "wind" | "relief";
export type LineKind = "in" | "ok" | "err" | "dim" | "block";
/** `cmd` makes a line clickable in the UI — clicking runs that command. */
export type TermLine = { kind: LineKind; text: string; cmd?: string };

export type WorldInfo = { id: string; name: string; tagline?: string; secret?: boolean };

export type CatchmentSnapshot = {
  /** All 0–100 except the two angles. */
  rain: number; storm: number; erosion: number; wind: number; relief: number;
  bearing: number; sun: number;
  mode: TermMode;
  world: string;
  worlds: WorldInfo[];
  secretUnlocked: boolean;
  neural: "unavailable" | "physics" | "neural";
  neuralNote: string;
};

export interface CatchmentBus {
  snapshot(): CatchmentSnapshot;
  setParam(key: ParamKey, pct: number): void;
  setBearing(deg: number): void;
  setSun(deg: number): void;
  setMode(mode: TermMode): void;
  reset(): void;
  setWorld(id: string): void;
  unlockSecret(): void;
  setNeural(on: boolean): boolean;
  resyncNeural(): boolean;
  exportTeacher(): boolean;
  setControls(show: boolean): void;
}

export type ExecResult = {
  lines: TermLine[];
  clear?: boolean;
  /** Set when a mode command carried a duration — the UI owns the timer. */
  revert?: { ms: number; mode: TermMode };
  /** Set on any successful mode change so the UI can cancel a stale timer. */
  modeChanged?: TermMode;
};

export type ClassifyFn = (text: string) => Promise<IntentPrediction | null>;

/* ---------------------------------------------------------------- helpers */

const ok = (text: string): TermLine => ({ kind: "ok", text });
const err = (text: string): TermLine => ({ kind: "err", text });
const dim = (text: string): TermLine => ({ kind: "dim", text });
const block = (text: string): TermLine => ({ kind: "block", text });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrapDeg = (d: number) => ((d % 360) + 360) % 360;

const COMPASS: Record<string, number> = {
  n: 0, north: 0, ne: 45, northeast: 45, e: 90, east: 90, se: 135, southeast: 135,
  s: 180, south: 180, sw: 225, southwest: 225, w: 270, west: 270, nw: 315, northwest: 315,
};
const compassName = (deg: number) => {
  const names = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  return names[Math.round(wrapDeg(deg) / 45) % 8];
};

/** `for 30s`, `for 2 min`, trailing `30 seconds` … → ms, with the match removed. */
function extractDuration(text: string): { ms: number | null; rest: string } {
  const re = /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\b/i;
  const m = text.match(re);
  if (!m) return { ms: null, rest: text };
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase().startsWith("m") ? 60_000 : 1_000;
  return { ms: clamp(n * unit, 3_000, 600_000), rest: (text.slice(0, m.index) + " " + text.slice((m.index ?? 0) + m[0].length)).trim() };
}

function extractNumber(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:%|percent\b)?/);
  return m ? parseFloat(m[1]) : null;
}

function extractCompass(text: string): number | null {
  for (const tok of text.toLowerCase().split(/[^a-z]+/)) {
    if (tok in COMPASS) return COMPASS[tok];
  }
  return null;
}

/** "60" | "60%" | "+15" | "-15" | max/full/on | off/min/none/zero → absolute pct. */
function parseValueToken(tok: string, current: number): number | null {
  const t = tok.toLowerCase().replace(/%$/, "");
  if (/^[+-]\d+(\.\d+)?$/.test(t)) return clamp(current + parseFloat(t), 0, 100);
  if (/^\d+(\.\d+)?$/.test(t)) return clamp(parseFloat(t), 0, 100);
  if (["max", "full", "on", "hundred"].includes(t)) return 100;
  if (["off", "min", "none", "zero", "steady"].includes(t)) return 0;
  if (t === "half") return 50;
  return null;
}

/* Per-param voice: one dry clause when a setting lands somewhere interesting. */
function flavor(key: ParamKey, pct: number): string | null {
  switch (key) {
    case "rain":
      return pct === 0 ? "the sky closes." : pct >= 85 ? "let it pour." : pct >= 55 ? "proper rain now." : null;
    case "storm":
      return pct === 0 ? "back to steady drizzle." : pct >= 85 ? "the cell is angry." : pct >= 40 ? "a storm cell is drifting in." : null;
    case "erosion":
      return pct >= 85 ? "the water will carve like a knife." : pct === 0 ? "the bedrock holds." : null;
    case "wind":
      return pct === 0 ? "dead calm." : pct >= 85 ? "gale force — fire will run." : null;
    case "relief":
      return pct >= 85 ? "mountains, dramatised." : pct <= 10 ? "almost true scale." : null;
  }
}

const PARAM_ALIASES: Record<string, ParamKey> = {
  rain: "rain", rainfall: "rain", precipitation: "rain",
  storm: "storm", storms: "storm",
  erosion: "erosion", erode: "erosion",
  wind: "wind",
  relief: "relief", exaggeration: "relief", exag: "relief",
};

const MODE_ALIASES: Record<string, TermMode> = {
  orbit: "orbit", camera: "orbit", look: "orbit",
  pour: "pour", water: "pour", hose: "pour",
  ignite: "ignite", fire: "ignite", burn: "ignite", torch: "ignite",
  meteor: "meteor", meteors: "meteor", asteroid: "meteor", asteroids: "meteor",
};

const MODE_HINT: Record<TermMode, string> = {
  orbit: "drag to orbit · click to inspect a point.",
  pour: "drag on the terrain to pour water.",
  ignite: "click a hillside to start a fire — wind and slope steer it.",
  meteor: "hold to charge, release to strike. bigger holds, bigger rocks.",
};

export const HELP_LINES: TermLine[] = [
  block("water    rain 60 · storm max · erosion 40"),
  block("wind     wind 70 · wind from nw · wind 50 from 220"),
  block("light    sun 135 · relief 60"),
  block("modes    orbit · pour · ignite · meteor [for 30s]"),
  block("worlds   worlds · map caldera"),
  block("neural   neural on|off|sync|export"),
  block("system   status · reset · controls · clear · help"),
  { kind: "dim", text: "…or just say it — “make it stormy”, “flood the valleys”. click to try one:", cmd: undefined },
  { kind: "dim", text: "  ↳ chuck a meteor at it", cmd: "chuck a meteor at it" },
];

const ABOUT_LINES: TermLine[] = [
  block("catchment — a WebGPU earth engine. shallow-water hydrology, erosion,"),
  block("wildfire and a neural surrogate, all in hand-written WGSL on your GPU."),
  dim("this terminal parses plain english with a ~100 KB intent model, trained"),
  dim("in ml/train_intent.py and run locally — no server, no library."),
];

const UNKNOWN_REPLIES = [
  "no parse. try `help` — or say it plainer: “more rain”, “meteor”.",
  "didn't catch that. `help` lists the grammar; plain english works too.",
  "not a thing i know. `help` shows what is.",
];

/* --------------------------------------------------- lexicon fallback (no model) */

const LEXICON: [string, RegExp][] = [
  ["scene.apocalypse", /\b(apocalypse|armageddon|doomsday|chaos|destroy|wreck|end of the world|everything at once|max everything)\b/],
  ["scene.flood", /\b(flood|deluge|inundate|drown)\b/],
  ["scene.drought", /\b(drought|arid|bone dry|dry it out|clear skies|blue skies|sunny)\b/],
  ["scene.calm", /\b(calm|peaceful|serene|tranquil|chill|settle)\b/],
  ["mode.meteor", /\b(meteors?|asteroids?|space rocks?|craters?|impact)\b/],
  ["mode.ignite", /\b(fires?|ignite|burn|torch|arson|bushfire|flame)\b/],
  ["mode.pour", /\b(pour|hose|water brush|dump water|add water)\b/],
  ["mode.orbit", /\b(orbit|look around|camera|inspect)\b/],
  ["storm.stop", /\b(stop|no|kill|end|off).*\bstorm\b|\bstorm\b.*\b(off|stop)\b/],
  ["storm.down", /\b(less|calm|ease|weaker|reduce|smaller|tone down)\b.*\bstorm/],
  ["storm.up", /\bstorm|thunder|lightning|cyclone|hurricane|tempest\b/],
  ["rain.stop", /\b(stop|no|kill|end|off).*\brain|\brain\b.*\b(off|stop)\b/],
  ["rain.down", /\b(less|lighter|ease|reduce|lower|drier)\b.*\b(rain|wet)|drizzle/],
  ["rain.up", /\brain|pour|wetter|drench|soak|bucket\b/],
  ["wind.stop", /\b(no|stop|kill|off).*\bwind\b/],
  ["wind.dir", /\bwind\b.*\b(from|direction|northerly|southerly|easterly|westerly)\b|\b(northerly|southerly|easterly|westerly)\b/],
  ["wind.down", /\b(less|weaker|calm|gentler|reduce)\b.*\bwind|\bbreeze\b/],
  ["wind.up", /\bwind|gale|gust|blustery|blow\b/],
  ["erosion.up", /\b(erosion|erode|carve|channels?)\b/],
  ["relief.down", /\b(flatter|flatten|true scale|less relief)\b/],
  ["relief.up", /\b(relief|exaggerat|taller|steeper|mountains)\b/],
  ["sun.move", /\b(sun|light|sunset|sunrise|golden hour|dawn|dusk|noon|midday)\b/],
  ["neural.on", /\b(neural|network|surrogate|student|ai|model)\b.*\bon\b|\bgo neural\b/],
  ["neural.off", /\bphysics|teacher|solver\b/],
  ["map.list", /\b(worlds?|maps?|terrains?|somewhere else)\b/],
  ["reset", /\b(reset|start over|start again|clean slate|restart)\b/],
  ["status", /\b(status|settings|state|readout|report)\b/],
  ["help", /\b(help|commands|instructions|how do i|what can i)\b/],
];

function lexiconClassify(text: string): IntentPrediction | null {
  const t = " " + text.toLowerCase() + " ";
  for (const [intent, re] of LEXICON) {
    if (re.test(t)) return { intent, confidence: 0.5, runnerUp: "none" };
  }
  return null;
}

/* ------------------------------------------------------------- world lookup */

function matchWorld(snap: CatchmentSnapshot, query: string): { world: WorldInfo; viaSecret: boolean } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const w of snap.worlds) {
    const exact = w.id.toLowerCase() === q || w.name.toLowerCase() === q;
    if (w.secret) {
      // Secret worlds answer only to their exact name — no prefix fishing.
      if (exact) return { world: w, viaSecret: !snap.secretUnlocked };
      continue;
    }
    if (exact) return { world: w, viaSecret: false };
  }
  const open = snap.worlds.filter((w) => !w.secret || snap.secretUnlocked);
  const scored = open
    .map((w) => {
      const name = w.name.toLowerCase(), id = w.id.toLowerCase();
      let s = 0;
      if (name.startsWith(q) || id.startsWith(q)) s = 3;
      else if (name.includes(q) || id.includes(q)) s = 2;
      else if (q.split(/\s+/).some((part) => part.length > 2 && name.includes(part))) s = 1;
      return { w, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored.length ? { world: scored[0].w, viaSecret: false } : null;
}

function worldLines(snap: CatchmentSnapshot): TermLine[] {
  const visible = snap.worlds.filter((w) => !w.secret || snap.secretUnlocked);
  const lines: TermLine[] = [dim("$ ls /worlds")];
  for (const w of visible) {
    const current = w.id === snap.world;
    lines.push({
      kind: "block",
      text: `${current ? "▸" : " "} ${w.id.padEnd(12)} ${w.name}${w.tagline ? " — " + w.tagline : ""}`,
      cmd: current ? undefined : `map ${w.id}`,
    });
  }
  lines.push(dim("click a world to mount it — or `map <name>`."));
  if (!snap.secretUnlocked) lines.push(dim("(one world is not on this list.)"));
  return lines;
}

/* ------------------------------------------------------------- appliers */

function applyParam(bus: CatchmentBus, key: ParamKey, pct: number): TermLine[] {
  const v = Math.round(clamp(pct, 0, 100));
  bus.setParam(key, v);
  const f = flavor(key, v);
  const label = key === "storm" && v === 0 ? "steady" : `${v}%`;
  return [ok(`${key} → ${label}${f ? "  · " + f : ""}`)];
}

function applyMode(bus: CatchmentBus, mode: TermMode, durationMs: number | null): ExecResult {
  bus.setMode(mode);
  const lines: TermLine[] = [ok(`mode → ${mode}`), dim(MODE_HINT[mode])];
  const result: ExecResult = { lines, modeChanged: mode };
  if (durationMs && mode !== "orbit") {
    result.revert = { ms: durationMs, mode: "orbit" };
    lines.push(dim(`window open for ${Math.round(durationMs / 1000)}s, then back to orbit.`));
  }
  return result;
}

function applyWind(bus: CatchmentBus, snap: CatchmentSnapshot, pct: number | null, bearing: number | null): TermLine[] {
  const lines: TermLine[] = [];
  if (pct !== null) lines.push(...applyParam(bus, "wind", pct));
  if (bearing !== null) {
    const deg = Math.round(wrapDeg(bearing));
    bus.setBearing(deg);
    lines.push(ok(`bearing → ${deg}° (${compassName(deg)})`));
  }
  if (!lines.length) {
    lines.push(block(`wind ${snap.wind}% from ${snap.bearing}° (${compassName(snap.bearing)})`));
    lines.push(dim("usage: wind 0–100 · wind from nw · wind 60 from 220"));
  }
  return lines;
}

function statusLines(snap: CatchmentSnapshot): TermLine[] {
  const world = snap.worlds.find((w) => w.id === snap.world);
  return [
    { kind: "block", text: `world    ${world?.name ?? snap.world}`, cmd: "worlds" },
    block(`mode     ${snap.mode}`),
    block(`rain     ${snap.rain}%      storm  ${snap.storm === 0 ? "steady" : snap.storm + "%"}`),
    block(`erosion  ${snap.erosion}%      relief ${snap.relief}%`),
    block(`wind     ${snap.wind}% from ${snap.bearing}° (${compassName(snap.bearing)})`),
    block(`sun      ${snap.sun}°`),
    block(`neural   ${snap.neural}${snap.neuralNote ? " — " + snap.neuralNote : ""}`),
  ];
}

function neuralLines(bus: CatchmentBus, arg: string | undefined): TermLine[] {
  const snap = bus.snapshot();
  switch (arg) {
    case "on":
    case "live":
      return bus.setNeural(true)
        ? [ok("neural → live"), dim("the student steps the water now — watch where it drifts.")]
        : [err("no surrogate on board."), dim("export frames (`neural export`), train ml/train_surrogate.py, drop surrogate.json in public/catchment/.")];
    case "off":
    case "physics":
      return bus.setNeural(false) ? [ok("neural → off"), dim("the physics teacher is back in charge.")] : [err("no surrogate on board.")];
    case "sync":
    case "resync":
      return bus.resyncNeural() ? [ok("student reseeded from physics.")] : [err("nothing to sync — neural isn't running.")];
    case "export":
      return bus.exportTeacher()
        ? [ok("teacher frame exporting — it lands in your downloads."), dim("train with ml/train_surrogate.py.")]
        : [err("export unavailable right now.")];
    case undefined:
      return [
        block(`neural   ${snap.neural}${snap.neuralNote ? " — " + snap.neuralNote : ""}`),
        dim("usage: neural on · off · sync · export"),
      ];
    default:
      return [err(`unknown neural subcommand '${arg}'.`), dim("usage: neural on · off · sync · export")];
  }
}

/* ------------------------------------------------------- deterministic tier */

function runDeterministic(raw: string, bus: CatchmentBus): ExecResult | null {
  const { ms: durationMs, rest } = extractDuration(raw);
  const tokens = rest.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length && durationMs) return null;
  if (!tokens.length) return { lines: [] };
  const [head, ...args] = tokens;
  const snap = bus.snapshot();

  switch (head) {
    case "help": case "h": case "?":
      return { lines: HELP_LINES };
    case "about": case "info":
      return { lines: ABOUT_LINES };
    case "clear": case "cls":
      return { lines: [], clear: true };
    case "reset": case "restart":
      bus.reset();
      return { lines: [ok("terrain restored — every crater and scar undone.")] };
    case "status": case "state":
      return { lines: statusLines(snap) };
    case "controls": case "panel": case "sliders": case "gui": {
      const hide = ["off", "close", "hide"].includes(args[0]);
      bus.setControls(!hide);
      return { lines: [ok(hide ? "control panel closed." : "control panel open — ✕ closes it.")] };
    }
    case "worlds": case "maps": case "levels": case "ls":
      return { lines: worldLines(snap) };
    case "pwd":
      return { lines: [block(`/worlds/${snap.world}`)] };
    case "whoami": {
      // A visitor typing unix at a landscape deserves a straight answer.
      return {
        lines: [
          block("guest — you have the whole catchment. no sudo required."),
          dim("the person who built it: hjhportfolio.com/about"),
        ],
      };
    }
    case "map": case "world": case "goto": case "load": {
      if (!args.length) return { lines: worldLines(snap) };
      const found = matchWorld(snap, args.join(" "));
      if (!found) return { lines: [err(`no world matches '${args.join(" ")}'.`), ...worldLines(snap)] };
      if (found.viaSecret) bus.unlockSecret();
      if (found.world.id === snap.world) return { lines: [dim(`already mounted: ${found.world.name}.`)] };
      bus.setWorld(found.world.id);
      return {
        lines: [
          ok(`${found.viaSecret ? "coordinates accepted. " : ""}mounted /worlds/${found.world.id} — ${found.world.name}`),
          ...(found.world.tagline ? [dim(found.world.tagline)] : []),
          dim("rebuilding terrain…"),
        ],
      };
    }
    case "neural": case "model": case "surrogate":
      return { lines: neuralLines(bus, args[0]) };
    case "mode": {
      const m = args[0] ? MODE_ALIASES[args[0]] : undefined;
      if (!m) return { lines: [err("usage: mode orbit|pour|ignite|meteor")] };
      return applyMode(bus, m, durationMs);
    }
    case "sun": case "bearing": {
      const isSun = head === "sun";
      const arg = args[0];
      if (!arg) return { lines: [block(`${head} ${isSun ? snap.sun : snap.bearing}°`), dim(`usage: ${head} <degrees|n|ne|e|se|s|sw|w|nw>`)] };
      const deg = arg in COMPASS ? COMPASS[arg]
        : /^[+-]\d+$/.test(arg) ? (isSun ? snap.sun : snap.bearing) + parseInt(arg, 10)
        : /^\d+(\.\d+)?$/.test(arg) ? parseFloat(arg) : null;
      if (deg === null) return { lines: [err(`can't read '${arg}' as a direction.`)] };
      const d = Math.round(wrapDeg(deg));
      if (isSun) { bus.setSun(d); return { lines: [ok(`sun → ${d}°`)] }; }
      bus.setBearing(d);
      return { lines: [ok(`bearing → ${d}° (${compassName(d)})`)] };
    }
    case "set": {
      // `set rain 60`, `set rain to 60%` — anything looser falls through to
      // the NL tier, which reads "set the rain to 45 percent" just fine.
      const key = args[0] ? PARAM_ALIASES[args[0]] : undefined;
      const valTok = args.filter((a) => a !== "to").slice(1)[0];
      if (!key || !valTok) return null;
      const v = parseValueToken(valTok, snap[key]);
      if (v === null) return null;
      return { lines: applyParam(bus, key, v) };
    }
  }

  // Bare mode words: `meteor`, `pour`, `ignite for 45s`…
  if (head in MODE_ALIASES && args.length === 0) {
    return applyMode(bus, MODE_ALIASES[head], durationMs);
  }

  // Param heads: `rain 60`, `wind 40 from nw`, `storm max`, `erosion +10`.
  const param = PARAM_ALIASES[head];
  if (param) {
    if (param === "wind") {
      let pct: number | null = null, bearing: number | null = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === "from" || a === "to") continue;
        if (a in COMPASS) { bearing = COMPASS[a]; continue; }
        if (args[i - 1] === "from" && /^\d+(\.\d+)?$/.test(a)) { bearing = parseFloat(a); continue; }
        const v = parseValueToken(a, snap.wind);
        if (v !== null && pct === null) pct = v;
      }
      if (pct === null && bearing === null && args.length) return null; // let NL try
      return { lines: applyWind(bus, snap, pct, bearing) };
    }
    if (!args.length) {
      return { lines: [block(`${param} ${snap[param]}%`), dim(`usage: ${param} 0–100 · max · off · +10`)] };
    }
    const v = parseValueToken(args.filter((a) => a !== "to" && a !== "at").join(" ").split(/\s+/)[0], snap[param]);
    if (v === null) return null; // "rain harder" → NL tier
    return { lines: applyParam(bus, param, v) };
  }

  return null;
}

/* --------------------------------------------------------------- NL tier */

function runIntent(pred: IntentPrediction, raw: string, bus: CatchmentBus): ExecResult {
  const snap = bus.snapshot();
  const { ms: durationMs, rest } = extractDuration(raw);
  const num = extractNumber(rest);
  const compass = extractCompass(rest);
  const [group, verb] = pred.intent.split(".");

  const step = (key: ParamKey, dir: 1 | -1): TermLine[] => {
    if (num !== null) return applyParam(bus, key, num);
    const cur = snap[key];
    // From zero, "more X" should feel like weather arriving, not a 25% tickle.
    const next = dir > 0 ? (cur === 0 ? 60 : cur + 25) : cur - 25;
    return applyParam(bus, key, next);
  };

  switch (pred.intent) {
    case "help": return { lines: HELP_LINES };
    case "controls": bus.setControls(true); return { lines: [ok("control panel open — ✕ closes it.")] };
    case "reset": bus.reset(); return { lines: [ok("terrain restored — every crater and scar undone.")] };
    case "status": return { lines: statusLines(snap) };
    case "map.list": return { lines: worldLines(snap) };
    case "wind.dir": {
      const deg = compass ?? num;
      const d = Math.round(wrapDeg(deg ?? snap.bearing + 90));
      bus.setBearing(d);
      return { lines: [ok(`bearing → ${d}° (${compassName(d)})${deg === null ? "  · swung the wind around." : ""}`)] };
    }
    case "sun.move": {
      const deg = compass ?? num ?? wrapDeg(snap.sun + 45);
      const d = Math.round(wrapDeg(deg));
      bus.setSun(d);
      return { lines: [ok(`sun → ${d}°${compass === null && num === null ? "  · swung the light around." : ""}`)] };
    }
    case "neural.on": return { lines: neuralLines(bus, "on") };
    case "neural.off": return { lines: neuralLines(bus, "off") };
    case "scene.calm": {
      bus.setParam("rain", 12); bus.setParam("storm", 0); bus.setParam("wind", 25); bus.setMode("orbit");
      return { lines: [ok("rain → 12% · storm → steady · wind → 25%"), dim("the catchment settles.")], modeChanged: "orbit" };
    }
    case "scene.apocalypse": {
      bus.setParam("rain", 90); bus.setParam("storm", 100); bus.setParam("wind", 90); bus.setMode("meteor");
      return {
        lines: [ok("rain → 90% · storm → 100% · wind → 90% · mode → meteor"), dim("end times armed. hold to charge, release to strike.")],
        modeChanged: "meteor",
      };
    }
    case "scene.flood": {
      bus.setParam("rain", 100); bus.setParam("storm", 70);
      return { lines: [ok("rain → 100% · storm → 70%"), dim("the valleys will fill from here.")] };
    }
    case "scene.drought": {
      bus.setParam("rain", 0); bus.setParam("storm", 0);
      return { lines: [ok("rain → 0% · storm → steady"), dim("the sky closes. the rivers are on their own.")] };
    }
  }

  if (group === "mode" && verb in MODE_ALIASES) {
    return applyMode(bus, MODE_ALIASES[verb], durationMs);
  }

  if ((["rain", "storm", "erosion", "wind", "relief"] as ParamKey[]).includes(group as ParamKey)) {
    const key = group as ParamKey;
    const lines =
      verb === "stop" ? applyParam(bus, key, 0)
      : verb === "down" ? step(key, -1)
      : step(key, 1);
    if (key === "wind" && compass !== null) {
      const d = Math.round(wrapDeg(compass));
      bus.setBearing(d);
      lines.push(ok(`bearing → ${d}° (${compassName(d)})`));
    }
    return { lines };
  }

  return { lines: [err(UNKNOWN_REPLIES[Math.floor(Math.random() * UNKNOWN_REPLIES.length)])] };
}

/* --------------------------------------------------------------- executor */

export function createExecutor(bus: CatchmentBus, classify: ClassifyFn) {
  return async function run(raw: string): Promise<ExecResult> {
    const input = raw.trim();
    if (!input) return { lines: [] };

    const det = runDeterministic(input, bus);
    if (det) return det;

    const pred = (await classify(input)) ?? lexiconClassify(input);
    if (!pred || pred.intent === "none") {
      return { lines: [err(UNKNOWN_REPLIES[Math.floor(Math.random() * UNKNOWN_REPLIES.length)])] };
    }
    const result = runIntent(pred, input, bus);
    if (result.lines.some((l) => l.kind === "ok")) {
      result.lines.push(dim(`· intent ${pred.intent} ${Math.round(pred.confidence * 100)}% — local model, no server`));
    }
    return result;
  };
}

/** Tab-completion corpus: static grammar plus the currently visible worlds. */
export function completions(snap: CatchmentSnapshot | null): string[] {
  const base = [
    "help", "status", "reset", "clear", "controls", "about", "worlds",
    "rain ", "storm ", "erosion ", "wind ", "wind from ", "sun ", "relief ",
    "orbit", "pour", "ignite", "meteor", "meteor for 30s",
    "neural on", "neural off", "neural sync", "neural export",
    "map ",
  ];
  if (snap) {
    for (const w of snap.worlds) if (!w.secret || snap.secretUnlocked) base.push(`map ${w.id}`);
  }
  return base;
}

/*
 * terrain-search.ts — the brains of the Semantic Terrain Search demo.
 *
 * A small, fully client-side semantic model. A natural-language query is mapped
 * into an interpretable 8-axis terrain vector (the "embedding"), then every grid
 * cell is scored by the dot product of the query vector with the cell's own
 * terrain-feature vector. No network, no API keys, no multi-MB transformer —
 * a curated vector-space lexicon with stemming, fuzzy (char-trigram) matching
 * for out-of-vocabulary words, and negation handling.
 *
 * The axes line up 1:1 with the DEM-derived feature planes in
 * public/playground/terrain.json, so language -> axes (NLP) and axes -> map
 * (GIS) compose into one honest pipeline.
 *
 * Pure module: no React / MapLibre imports, so it is unit-testable in Node.
 */

export const AXES = [
  "steepness",
  "elevation",
  "northness",
  "eastness",
  "ruggedness",
  "water",
  "exposure",
  "vegetation",
] as const;

export type Axis = (typeof AXES)[number];
export type Vec = Record<Axis, number>;

export const AXIS_META: Record<
  Axis,
  { label: string; pos: string; neg: string }
> = {
  steepness: { label: "Steepness", pos: "steep", neg: "flat" },
  elevation: { label: "Elevation", pos: "high", neg: "low" },
  northness: { label: "Aspect N–S", pos: "north-facing", neg: "south-facing" },
  eastness: { label: "Aspect E–W", pos: "east-facing", neg: "west-facing" },
  ruggedness: { label: "Ruggedness", pos: "rugged", neg: "smooth" },
  water: { label: "Water", pos: "near water", neg: "dry" },
  exposure: { label: "Exposure", pos: "exposed ridge", neg: "sheltered valley" },
  vegetation: { label: "Vegetation", pos: "vegetated", neg: "bare" },
};

const zero = (): Vec =>
  AXES.reduce((o, a) => ((o[a] = 0), o), {} as Vec);

/* ---- the lexicon: term -> partial axis weights (signed, ~ -1..1) --------- */
type Partial8 = Partial<Vec>;
const L: Record<string, Partial8> = {
  // steepness
  steep: { steepness: 1 }, steeply: { steepness: 1 }, steepness: { steepness: 1 },
  cliff: { steepness: 1, ruggedness: 0.6, exposure: 0.4 },
  escarpment: { steepness: 1, elevation: 0.5, exposure: 0.5 },
  scarp: { steepness: 0.9, exposure: 0.5 },
  precipice: { steepness: 1, exposure: 0.6 },
  bluff: { steepness: 0.8, exposure: 0.4 },
  sheer: { steepness: 1 }, vertical: { steepness: 1 },
  flat: { steepness: -1 }, level: { steepness: -1 }, plain: { steepness: -0.9, elevation: -0.4 },
  gentle: { steepness: -0.7 }, gradual: { steepness: -0.6 }, plateau: { steepness: -0.5, elevation: 0.6, exposure: 0.3 },
  // elevation
  high: { elevation: 1 }, highland: { elevation: 0.9 }, elevated: { elevation: 0.9 },
  mountain: { elevation: 1, steepness: 0.6, ruggedness: 0.6 }, mountainous: { elevation: 1, ruggedness: 0.7 },
  peak: { elevation: 1, exposure: 0.7 }, summit: { elevation: 1, exposure: 0.8 },
  alpine: { elevation: 1, exposure: 0.5 }, upland: { elevation: 0.8 },
  low: { elevation: -1 }, lowland: { elevation: -0.9 }, lowlying: { elevation: -1, water: 0.3 },
  coastal: { elevation: -0.7, water: 0.7 }, coast: { elevation: -0.6, water: 0.8 },
  basin: { elevation: -0.6, exposure: -0.7 }, depression: { elevation: -0.5, exposure: -0.8 },
  // aspect
  north: { northness: 1 }, northern: { northness: 1 }, northward: { northness: 1 }, northfacing: { northness: 1 },
  south: { northness: -1 }, southern: { northness: -1 }, southward: { northness: -1 }, southfacing: { northness: -1 },
  sunny: { northness: 0.8 }, sunlit: { northness: 0.7 }, shady: { northness: -0.7 }, shaded: { northness: -0.7 },
  east: { eastness: 1 }, eastern: { eastness: 1 }, eastward: { eastness: 1 }, eastfacing: { eastness: 1 },
  west: { eastness: -1 }, western: { eastness: -1 }, westward: { eastness: -1 }, westfacing: { eastness: -1 },
  // ruggedness
  rugged: { ruggedness: 1 }, rough: { ruggedness: 0.9 }, broken: { ruggedness: 0.8 },
  rocky: { ruggedness: 0.9, vegetation: -0.4 }, craggy: { ruggedness: 1 }, jagged: { ruggedness: 1 },
  dissected: { ruggedness: 0.8 }, smooth: { ruggedness: -1 }, even: { ruggedness: -0.8 }, rolling: { ruggedness: -0.3, steepness: -0.3 },
  // water
  water: { water: 1 }, river: { water: 1 }, riverside: { water: 1 }, creek: { water: 1 }, stream: { water: 1 },
  brook: { water: 0.9 }, riparian: { water: 1, vegetation: 0.5 }, waterfront: { water: 1 },
  wet: { water: 0.9 }, wetland: { water: 1, steepness: -0.5 }, marsh: { water: 1, steepness: -0.6 },
  marshy: { water: 1, steepness: -0.6 }, swamp: { water: 1, steepness: -0.6 }, boggy: { water: 0.9, steepness: -0.5 },
  damp: { water: 0.7 }, moist: { water: 0.6 }, floodplain: { water: 0.8, steepness: -0.8, elevation: -0.5 },
  dry: { water: -1 }, arid: { water: -1, vegetation: -0.5 }, parched: { water: -1 },
  // exposure / position
  exposed: { exposure: 1 }, ridge: { exposure: 1, elevation: 0.5 }, ridgeline: { exposure: 1, elevation: 0.6 },
  crest: { exposure: 1, elevation: 0.6 }, spur: { exposure: 0.8, elevation: 0.3 }, windswept: { exposure: 1, vegetation: -0.3 },
  windy: { exposure: 0.8 }, open: { exposure: 0.6 }, sheltered: { exposure: -1 }, protected: { exposure: -0.8 },
  shelter: { exposure: -1 }, lee: { exposure: -0.8 }, valley: { exposure: -1, steepness: -0.4 },
  gully: { exposure: -1, water: 0.4 }, gorge: { exposure: -0.8, steepness: 0.7, water: 0.5 },
  ravine: { exposure: -0.9, steepness: 0.7 }, hollow: { exposure: -0.9 }, vale: { exposure: -0.8, steepness: -0.4 },
  glen: { exposure: -0.8 }, dell: { exposure: -0.8, vegetation: 0.4 }, secluded: { exposure: -0.8 },
  // vegetation
  forest: { vegetation: 1 }, forested: { vegetation: 1 }, wooded: { vegetation: 0.9 }, woodland: { vegetation: 0.9 },
  rainforest: { vegetation: 1, water: 0.5 }, jungle: { vegetation: 1, water: 0.4 }, canopy: { vegetation: 1 },
  vegetated: { vegetation: 1 }, lush: { vegetation: 1, water: 0.4 }, verdant: { vegetation: 1 }, green: { vegetation: 0.8 },
  fertile: { vegetation: 0.8, water: 0.4 }, bare: { vegetation: -1 }, barren: { vegetation: -1, water: -0.4 },
  cleared: { vegetation: -0.8 }, grassland: { vegetation: 0.2, steepness: -0.4 }, meadow: { vegetation: 0.4, steepness: -0.5 },
  // handy compounds people type
  hilltop: { elevation: 0.8, exposure: 0.9 }, hillside: { steepness: 0.6 }, slope: { steepness: 0.7 },
  slopes: { steepness: 0.7 }, terrain: {}, land: {}, area: {}, ground: {}, zone: {}, spot: {}, place: {},
};

/* tokens we treat as negators; they flip the next content word's vector */
const NEGATORS = new Set(["no", "not", "non", "without", "avoid", "away", "far", "never", "less"]);
/* glue we skip */
const STOP = new Set(["a", "an", "the", "of", "with", "and", "or", "to", "in", "on", "near", "by", "from", "is", "are", "that", "for", "facing", "very", "more", "some"]);
/* "near" is special: when followed by water words it should boost water, but as a
   stopword it is dropped; we keep its boost only via explicit water terms. */

const stem = (w: string): string =>
  w
    .replace(/(ing|ned|ly|ed|es|s)$/, "")
    .replace(/i$/, "y");

/* char-trigram set for fuzzy OOV matching */
const trigrams = (w: string): Set<string> => {
  const s = `  ${w} `;
  const out = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) out.add(s.slice(i, i + 3));
  return out;
};
const KEYS = Object.keys(L);
const KEY_TRI = KEYS.map((k) => trigrams(k));
const triCos = (a: Set<string>, b: Set<string>): number => {
  let inter = 0;
  a.forEach((t) => b.has(t) && inter++);
  return inter / (Math.sqrt(a.size) * Math.sqrt(b.size) || 1);
};

function resolve(token: string): { key: string; score: number } | null {
  if (L[token]) return { key: token, score: 1 };
  const st = stem(token);
  if (L[st]) return { key: st, score: 0.97 };
  if (token.length < 4) return null;
  const tg = trigrams(token);
  let best = -1, bi = -1;
  for (let i = 0; i < KEYS.length; i++) {
    const s = triCos(tg, KEY_TRI[i]);
    if (s > best) { best = s; bi = i; }
  }
  return best >= 0.55 ? { key: KEYS[bi], score: best } : null;
}

export interface Match {
  token: string;
  key: string;
  negated: boolean;
  fuzzy: boolean;
  axes: Partial8;
}
export interface Embedding {
  vector: Vec;
  matches: Match[];
  unmatched: string[];
}

/** Embed a free-text query into the 8-axis terrain vector (the "ML" step). */
export function embedQuery(text: string): Embedding {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

  const vector = zero();
  const matches: Match[] = [];
  const unmatched: string[] = [];
  let negateNext = false;

  for (const tok of tokens) {
    if (NEGATORS.has(tok)) { negateNext = true; continue; }
    if (STOP.has(tok)) continue;
    const r = resolve(tok);
    if (!r) {
      unmatched.push(tok);
      negateNext = false;
      continue;
    }
    const sign = negateNext ? -1 : 1;
    const entry = L[r.key];
    const scaled: Partial8 = {};
    for (const a of AXES) {
      const w = entry[a];
      if (w) {
        const v = w * sign * r.score;
        vector[a] += v;
        scaled[a] = v;
      }
    }
    if (Object.keys(scaled).length) {
      matches.push({ token: tok, key: r.key, negated: negateNext, fuzzy: r.score < 1, axes: scaled });
    }
    negateNext = false;
  }
  return { vector, matches, unmatched };
}

/* ---- cell scoring (the GIS step) ----------------------------------------- */

export interface TerrainData {
  n: number;
  bounds: { west: number; south: number; east: number; north: number };
  elevMaxM: number;
  cellMeters: { x: number; y: number };
  planes: Record<string, string>; // base64 uint8
  elev: string;
  ocean: string;
  stream: string;
}

export interface DecodedTerrain {
  n: number;
  bounds: TerrainData["bounds"];
  elevMaxM: number;
  /** signed -1..1 feature value per axis, per cell (row-major) */
  signed: Record<Axis, Float32Array>;
  elev: Float32Array; // 0..1 incl. sea
  ocean: Uint8Array;
  stream: Uint8Array;
}

const b64ToBytes = (b64: string): Uint8Array => {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node
  return new Uint8Array(Buffer.from(b64, "base64"));
};

/** Decode the JSON asset into signed per-axis Float32 planes ready to score. */
export function decodeTerrain(d: TerrainData): DecodedTerrain {
  const len = d.n * d.n;
  const toSigned = (b64: string): Float32Array => {
    const bytes = b64ToBytes(b64);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) out[i] = (bytes[i] / 255) * 2 - 1; // 0..1 -> -1..1
    return out;
  };
  const signed = {} as Record<Axis, Float32Array>;
  for (const a of AXES) signed[a] = toSigned(d.planes[a]);
  const elevBytes = b64ToBytes(d.elev);
  const elev = new Float32Array(len);
  for (let i = 0; i < len; i++) elev[i] = elevBytes[i] / 255;
  return {
    n: d.n,
    bounds: d.bounds,
    elevMaxM: d.elevMaxM,
    signed,
    elev,
    ocean: b64ToBytes(d.ocean),
    stream: b64ToBytes(d.stream),
  };
}

export interface ScoreResult {
  /** ABSOLUTE match 0..1 per cell (1 = matches every requested trait at full
   *  strength, 0 = neutral or opposite); NaN over ocean */
  scores: Float32Array;
  /** indices of the top-N land cells, best first */
  top: number[];
  /** active axes sorted by |weight|, for the explainer panel */
  ranked: { axis: Axis; weight: number }[];
  /** best absolute match found on the map, 0..1 */
  best: number;
  /** how many land cells are a strong match (score ≥ 0.5) */
  strong: number;
}

/**
 * Score every land cell against the query vector.
 *
 * We unit-normalise the query, take the dot product with each cell's signed
 * feature vector, then divide by the query's L1 norm so the result is an
 * *absolute* 0..1 suitability: 1 means the cell has every requested trait at
 * full strength, 0 means neutral or opposite. Unlike a percentile stretch this
 * makes the map visibly respond to the query — a sharp, satisfiable request
 * lights up a few bright cells; a vague or self-cancelling one stays dim.
 */
export function scoreCells(
  t: DecodedTerrain,
  q: Vec,
  topN = 12
): ScoreResult {
  const len = t.n * t.n;
  const active = AXES.filter((a) => Math.abs(q[a]) > 1e-6);
  const scores = new Float32Array(len).fill(NaN);
  const ranked = active
    .map((axis) => ({ axis, weight: q[axis] }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  if (active.length === 0) {
    return { scores, top: [], ranked, best: 0, strong: 0 };
  }

  const qn = Math.hypot(...active.map((a) => q[a])) || 1;
  const qhat = active.map((a) => q[a] / qn);
  const l1 = qhat.reduce((s, w) => s + Math.abs(w), 0) || 1;

  const land: { idx: number; v: number }[] = [];
  let best = 0;
  let strong = 0;
  for (let i = 0; i < len; i++) {
    if (t.ocean[i]) continue;
    let s = 0;
    for (let k = 0; k < active.length; k++) s += qhat[k] * t.signed[active[k]][i];
    const disp = Math.max(0, Math.min(1, s / l1));
    scores[i] = disp;
    land.push({ idx: i, v: s });
    if (disp > best) best = disp;
    if (disp >= 0.5) strong++;
  }

  land.sort((a, b) => b.v - a.v);
  const top = land.slice(0, topN).map((c) => c.idx);

  return { scores, top, ranked, best, strong };
}

/**
 * Per-axis contribution of one cell to its score, for the "why did this match?"
 * inspector. Returns the cell's own signed feature value and the signed push it
 * gives the query score on each active axis.
 */
export function explainCell(
  t: DecodedTerrain,
  q: Vec,
  idx: number
): { axis: Axis; cell: number; weight: number; contrib: number }[] {
  const active = AXES.filter((a) => Math.abs(q[a]) > 1e-6);
  const qn = Math.hypot(...active.map((a) => q[a])) || 1;
  return active
    .map((axis) => {
      const cell = t.signed[axis][idx];
      const weight = q[axis];
      return { axis, cell, weight, contrib: (weight / qn) * cell };
    })
    .sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
}

/** Convert a cell index to lng/lat centre, for placing map markers. */
export function cellLngLat(
  t: { n: number; bounds: TerrainData["bounds"] },
  idx: number
): [number, number] {
  const r = Math.floor(idx / t.n), c = idx % t.n;
  const { west, south, east, north } = t.bounds;
  const lng = west + ((c + 0.5) / t.n) * (east - west);
  // row 0 is the NORTH edge of the grid
  const lat = north - ((r + 0.5) / t.n) * (north - south);
  return [lng, lat];
}

/** Curated example queries for the chip row. */
export const EXAMPLES = [
  "steep north-facing slopes near water",
  "sheltered valleys with lush forest",
  "flat dry land away from rivers",
  "exposed rocky ridgelines up high",
  "gentle south-facing riparian meadows",
];

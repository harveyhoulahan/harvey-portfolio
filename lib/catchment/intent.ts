/*
 * Catchment terminal — natural-language intent engine (inference side).
 *
 * A hashed bag-of-features MLP, trained offline by ml/train_intent.py on
 * synthetic command phrasings and shipped as a ~100 KB integer-quantised JSON.
 * Inference is one sparse matvec + one tiny dense matvec — dependency-free,
 * sub-millisecond, fully local. The featuriser here mirrors the trainer
 * byte-for-byte (FNV-1a-hashed word / char-trigram / word-bigram features,
 * L2-normalised); the trainer embeds parity probes and decodeIntentModel
 * refuses the model if JS and numpy ever disagree, so a drifted artefact can
 * never mis-drive the sim — the terminal just falls back to its lexicon.
 */

export type IntentPrediction = {
  intent: string;
  confidence: number;
  /** Second-best class — useful for "did you mean" and debugging. */
  runnerUp: string;
};

export type IntentModel = {
  buckets: number;
  hidden: number;
  intents: string[];
  /** Dequantised weights. w1: [buckets][hidden] row-major; w2: [hidden][classes]. */
  w1: Float64Array;
  b1: Float64Array;
  w2: Float64Array;
  b2: Float64Array;
  /** Below this softmax confidence the caller should treat the input as unparsed. */
  threshold: number;
};

/** FNV-1a 32-bit over the (ASCII, post-normalisation) string. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Text → tokens. Lowercase, digit runs collapsed to '#' (numbers are slots,
 * not vocabulary), everything outside [a-z#] becomes a separator.
 * MUST match normalize() in ml/train_intent.py exactly.
 */
export function tokenize(text: string): string[] {
  const s = text
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?/g, " # ")
    .replace(/[^a-z#]+/g, " ")
    .trim();
  return s.length ? s.split(/\s+/) : [];
}

/**
 * Tokens → L2-normalised sparse vector of hashed feature counts.
 * Features per token: whole word (W:), padded char trigrams (T:); plus
 * consecutive word bigrams (B:). Collisions are summed — the model trains
 * against the same hash space, so it learns around them.
 */
export function featurize(text: string, buckets: number): Map<number, number> {
  const toks = tokenize(text);
  const acc = new Map<number, number>();
  const bump = (feat: string) => {
    const k = fnv1a(feat) % buckets;
    acc.set(k, (acc.get(k) ?? 0) + 1);
  };
  for (const t of toks) {
    bump("W:" + t);
    if (t !== "#") {
      const padded = "^" + t + "$";
      for (let i = 0; i + 3 <= padded.length; i++) bump("T:" + padded.slice(i, i + 3));
    }
  }
  for (let i = 0; i + 1 < toks.length; i++) bump("B:" + toks[i] + "_" + toks[i + 1]);
  let norm = 0;
  acc.forEach((v) => { norm += v * v; });
  norm = Math.sqrt(norm) || 1;
  acc.forEach((v, k) => acc.set(k, v / norm));
  return acc;
}

/** relu(x·W1 + b1)·W2 + b2 → softmax. Sparse first layer: only active buckets touch W1. */
export function classifyIntent(model: IntentModel, text: string): IntentPrediction {
  const { buckets, hidden, intents, w1, b1, w2, b2 } = model;
  const x = featurize(text, buckets);
  const h = Float64Array.from(b1);
  x.forEach((v, k) => {
    const row = k * hidden;
    for (let j = 0; j < hidden; j++) h[j] += v * w1[row + j];
  });
  const C = intents.length;
  const logits = Float64Array.from(b2);
  for (let j = 0; j < hidden; j++) {
    const hj = h[j] > 0 ? h[j] : 0;
    if (hj === 0) continue;
    const row = j * C;
    for (let c = 0; c < C; c++) logits[c] += hj * w2[row + c];
  }
  let max = -Infinity;
  for (let c = 0; c < C; c++) if (logits[c] > max) max = logits[c];
  let sum = 0;
  for (let c = 0; c < C; c++) { logits[c] = Math.exp(logits[c] - max); sum += logits[c]; }
  let best = 0, second = 0;
  for (let c = 1; c < C; c++) {
    if (logits[c] > logits[best]) { second = best; best = c; }
    else if (logits[c] > logits[second] || second === best) second = c;
  }
  return {
    intent: intents[best],
    confidence: logits[best] / sum,
    runnerUp: intents[second],
  };
}

type RawModel = {
  kind?: string;
  version?: number;
  buckets?: number;
  hidden?: number;
  intents?: string[];
  w1?: number[]; b1?: number[]; w2?: number[]; b2?: number[];
  s1?: number; s2?: number;
  threshold?: number;
  parity?: { text: string; intent: string; conf: number }[];
};

/**
 * Validate + dequantise the trained artefact. Returns null (never throws) on
 * anything suspicious — including failed parity probes — so callers can fall
 * back gracefully.
 */
export function decodeIntentModel(json: unknown): IntentModel | null {
  const raw = json as RawModel;
  if (!raw || raw.kind !== "catchment-intent-v1" || raw.version !== 1) return null;
  const { buckets, hidden, intents, w1, b1, w2, b2, s1, s2 } = raw;
  if (!buckets || !hidden || !intents?.length || !w1 || !b1 || !w2 || !b2 || !s1 || !s2) return null;
  const C = intents.length;
  if (w1.length !== buckets * hidden || b1.length !== hidden) return null;
  if (w2.length !== hidden * C || b2.length !== C) return null;

  const deq = (q: number[], s: number) => {
    const out = new Float64Array(q.length);
    for (let i = 0; i < q.length; i++) out[i] = q[i] * s;
    return out;
  };
  const model: IntentModel = {
    buckets, hidden, intents,
    w1: deq(w1, s1), b1: Float64Array.from(b1),
    w2: deq(w2, s2), b2: Float64Array.from(b2),
    threshold: raw.threshold ?? 0.5,
  };

  // Parity gate: the trainer classified these exact phrases with the exact
  // exported (quantised) weights. Any drift means the featuriser or hash has
  // diverged between numpy and here — refuse the model rather than guess.
  for (const probe of raw.parity ?? []) {
    const got = classifyIntent(model, probe.text);
    if (got.intent !== probe.intent || Math.abs(got.confidence - probe.conf) > 0.01) {
      console.warn(
        `[catchment] intent model failed parity: "${probe.text}" → ${got.intent}@${got.confidence.toFixed(3)}, ` +
        `trainer said ${probe.intent}@${probe.conf.toFixed(3)}. Model disabled.`,
      );
      return null;
    }
  }
  return model;
}

/**
 * Lazy, memoised classifier. First natural-language input pays one fetch
 * (~100 KB, cached by the browser thereafter); everything else is local math.
 * Resolves null if the artefact is missing or fails its parity gate.
 */
export function createLazyClassifier(url: string): (text: string) => Promise<IntentPrediction | null> {
  let modelP: Promise<IntentModel | null> | null = null;
  const load = () =>
    (modelP ??= fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j ? decodeIntentModel(j) : null))
      .catch(() => null));
  return async (text: string) => {
    const model = await load();
    if (!model) return null;
    const pred = classifyIntent(model, text);
    return pred.confidence >= model.threshold ? pred : { ...pred, intent: "none" };
  };
}

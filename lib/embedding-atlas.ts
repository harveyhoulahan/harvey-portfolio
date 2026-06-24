/*
 * embedding-atlas.ts — the brains of the "Embedding Atlas" demo.
 *
 * A miniature, fully client-side homage to geospatial foundation models
 * (AlphaEarth Foundations, Clay, Prithvi, SatCLIP). Offline, a tiny
 * self-supervised encoder turned every terrain cell into a 16-d, L2-normalised
 * embedding (public/playground/embeddings.json). Here we:
 *   - decode the embedding field,
 *   - run PCA in the browser to render it as false colour ("the AI's-eye view"),
 *   - and train a logistic-regression classifier *live* on a handful of clicked
 *     cells — few-shot terrain mapping, the exact AlphaEarth workflow:
 *     embed once, label a little, map everything.
 *
 * Pure module (no React/MapLibre) so it is unit-testable in Node.
 */

export interface EmbeddingData {
  n: number;
  dim: number;
  bounds: { west: number; south: number; east: number; north: number };
  emb: string; // base64 int8, row-major, dim-contiguous
}

export interface DecodedEmbeddings {
  n: number;
  dim: number;
  bounds: EmbeddingData["bounds"];
  emb: Float32Array; // length n*n*dim
  land: Uint8Array; // 1 = land, 0 = ocean
  landIdx: number[]; // indices of land cells
}

const b64ToInt8 = (b64: string): Int8Array => {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Int8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = (bin.charCodeAt(i) << 24) >> 24;
    return out;
  }
  const buf = Buffer.from(b64, "base64");
  return new Int8Array(buf.buffer, buf.byteOffset, buf.length);
};

export function decodeEmbeddings(d: EmbeddingData): DecodedEmbeddings {
  const { n, dim } = d;
  const raw = b64ToInt8(d.emb);
  const emb = new Float32Array(n * n * dim);
  for (let i = 0; i < emb.length; i++) emb[i] = raw[i] / 127;
  const land = new Uint8Array(n * n);
  const landIdx: number[] = [];
  for (let c = 0; c < n * n; c++) {
    let norm = 0;
    for (let k = 0; k < dim; k++) {
      const v = emb[c * dim + k];
      norm += v * v;
    }
    if (norm > 0.01) {
      land[c] = 1;
      landIdx.push(c);
    }
  }
  return { n, dim, bounds: d.bounds, emb, land, landIdx };
}

export const cellVec = (e: DecodedEmbeddings, cell: number): Float32Array =>
  e.emb.subarray(cell * e.dim, cell * e.dim + e.dim);

/* ---- PCA via Jacobi eigendecomposition of the dim×dim covariance --------- */
export interface PCA {
  mean: Float32Array;
  comps: Float32Array[]; // top-k unit eigenvectors, length dim each
  ranges: { lo: number; hi: number }[]; // robust 0..1 range per component
}

function jacobiEigen(A: number[][], dim: number): { vals: number[]; vecs: number[][] } {
  // symmetric eigen; A is dim×dim (mutated copy)
  const a = A.map((r) => r.slice());
  const V: number[][] = Array.from({ length: dim }, (_, i) =>
    Array.from({ length: dim }, (_, j) => (i === j ? 1 : 0))
  );
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < dim; p++)
      for (let q = p + 1; q < dim; q++) off += a[p][q] * a[p][q];
    if (off < 1e-12) break;
    for (let p = 0; p < dim; p++) {
      for (let q = p + 1; q < dim; q++) {
        if (Math.abs(a[p][q]) < 1e-14) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let i = 0; i < dim; i++) {
          const aip = a[i][p], aiq = a[i][q];
          a[i][p] = c * aip - s * aiq;
          a[i][q] = s * aip + c * aiq;
        }
        for (let i = 0; i < dim; i++) {
          const api = a[p][i], aqi = a[q][i];
          a[p][i] = c * api - s * aqi;
          a[q][i] = s * api + c * aqi;
        }
        for (let i = 0; i < dim; i++) {
          const vip = V[i][p], viq = V[i][q];
          V[i][p] = c * vip - s * viq;
          V[i][q] = s * vip + c * viq;
        }
      }
    }
  }
  const vals = a.map((r, i) => r[i]);
  return { vals, vecs: V };
}

export function computePCA(e: DecodedEmbeddings, k = 3): PCA {
  const { dim, emb, landIdx } = e;
  const mean = new Float32Array(dim);
  for (const c of landIdx)
    for (let d = 0; d < dim; d++) mean[d] += emb[c * dim + d];
  for (let d = 0; d < dim; d++) mean[d] /= landIdx.length;

  const cov: number[][] = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const x = new Float32Array(dim);
  for (const c of landIdx) {
    for (let d = 0; d < dim; d++) x[d] = emb[c * dim + d] - mean[d];
    for (let i = 0; i < dim; i++)
      for (let j = i; j < dim; j++) cov[i][j] += x[i] * x[j];
  }
  for (let i = 0; i < dim; i++)
    for (let j = i; j < dim; j++) {
      cov[i][j] /= landIdx.length;
      cov[j][i] = cov[i][j];
    }

  const { vals, vecs } = jacobiEigen(cov, dim);
  const order = vals.map((v, i) => i).sort((a, b) => vals[b] - vals[a]);
  const comps: Float32Array[] = [];
  for (let c = 0; c < k; c++) {
    const col = order[c];
    const v = new Float32Array(dim);
    for (let d = 0; d < dim; d++) v[d] = vecs[d][col];
    comps.push(v);
  }

  // robust per-component range (2nd–98th percentile) for stable false colour
  const ranges = comps.map((comp) => {
    const proj: number[] = [];
    for (const c of landIdx) {
      let s = 0;
      for (let d = 0; d < dim; d++) s += (emb[c * dim + d] - mean[d]) * comp[d];
      proj.push(s);
    }
    proj.sort((a, b) => a - b);
    const lo = proj[Math.floor(proj.length * 0.02)];
    const hi = proj[Math.floor(proj.length * 0.98)];
    return { lo, hi: hi > lo ? hi : lo + 1e-6 };
  });

  return { mean, comps, ranges };
}

/** Project a cell onto the PCA components, normalised to 0..1 by robust range. */
export function projectCell(e: DecodedEmbeddings, pca: PCA, cell: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < pca.comps.length; c++) {
    let s = 0;
    for (let d = 0; d < e.dim; d++) s += (e.emb[cell * e.dim + d] - pca.mean[d]) * pca.comps[c][d];
    const { lo, hi } = pca.ranges[c];
    out.push(Math.max(0, Math.min(1, (s - lo) / (hi - lo))));
  }
  return out;
}

/* ---- few-shot logistic-regression classifier over embeddings ------------- */
export interface Classifier {
  w: Float32Array;
  b: number;
  ready: boolean;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/**
 * Train logistic regression on the embeddings of a few labelled cells.
 * If no explicit negatives are given, a random background sample of land cells
 * stands in as the negative class (one-vs-background) — the standard trick that
 * makes "click a few examples, map everything" work with foundation embeddings.
 */
export function trainClassifier(
  e: DecodedEmbeddings,
  positives: number[],
  negatives: number[],
  opts: { iters?: number; lr?: number; l2?: number; bgSeed?: number } = {}
): Classifier {
  const { dim, emb, landIdx } = e;
  const w = new Float32Array(dim);
  let b = 0;
  if (positives.length === 0) return { w, b, ready: false };

  // assemble training set
  const xs: number[] = [];
  const ys: number[] = [];
  const push = (cell: number, y: number) => {
    for (let d = 0; d < dim; d++) xs.push(emb[cell * dim + d]);
    ys.push(y);
  };
  positives.forEach((c) => push(c, 1));
  negatives.forEach((c) => push(c, 0));
  if (negatives.length === 0) {
    // sample background negatives deterministically
    let seed = opts.bgSeed ?? 1234;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const posSet = new Set(positives);
    const want = Math.max(40, positives.length * 12);
    let tries = 0;
    let added = 0;
    while (added < want && tries < want * 8) {
      tries++;
      const cell = landIdx[Math.floor(rand() * landIdx.length)];
      if (posSet.has(cell)) continue;
      push(cell, 0);
      added++;
    }
  }

  const m = ys.length;
  const iters = opts.iters ?? 300;
  const lr = opts.lr ?? 0.5;
  const l2 = opts.l2 ?? 0.01;
  // class weights to counter imbalance
  const nPos = ys.reduce((s, y) => s + y, 0) || 1;
  const nNeg = m - nPos || 1;
  const wPos = m / (2 * nPos);
  const wNeg = m / (2 * nNeg);

  for (let it = 0; it < iters; it++) {
    const gw = new Float32Array(dim);
    let gb = 0;
    for (let i = 0; i < m; i++) {
      const off = i * dim;
      let z = b;
      for (let d = 0; d < dim; d++) z += w[d] * xs[off + d];
      const p = sigmoid(z);
      const cw = ys[i] ? wPos : wNeg;
      const g = (p - ys[i]) * cw;
      for (let d = 0; d < dim; d++) gw[d] += g * xs[off + d];
      gb += g;
    }
    for (let d = 0; d < dim; d++) w[d] -= lr * (gw[d] / m + l2 * w[d]);
    b -= lr * (gb / m);
  }
  return { w, b, ready: true };
}

/** Predict P(class) for every cell; NaN over ocean. */
export function predictField(e: DecodedEmbeddings, clf: Classifier): Float32Array {
  const { n, dim, emb, land } = e;
  const out = new Float32Array(n * n);
  for (let c = 0; c < n * n; c++) {
    if (!land[c]) { out[c] = NaN; continue; }
    let z = clf.b;
    const off = c * dim;
    for (let d = 0; d < dim; d++) z += clf.w[d] * emb[off + d];
    out[c] = sigmoid(z);
  }
  return out;
}

/** Cosine similarity of every cell to a probe cell; NaN over ocean. */
export function similarityField(e: DecodedEmbeddings, probe: number): Float32Array {
  const { n, dim, emb, land } = e;
  const out = new Float32Array(n * n);
  const p = cellVec(e, probe);
  for (let c = 0; c < n * n; c++) {
    if (!land[c]) { out[c] = NaN; continue; }
    let dot = 0;
    const off = c * dim;
    for (let d = 0; d < dim; d++) dot += emb[off + d] * p[d];
    out[c] = dot; // embeddings are unit-norm -> dot = cosine
  }
  return out;
}

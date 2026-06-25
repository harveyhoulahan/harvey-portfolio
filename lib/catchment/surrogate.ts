/*
 * surrogate.ts — CPU reference inference for a `catchment-surrogate-v1` model
 * (the neural water operator trained by ml/train_surrogate.py).
 *
 * A small residual, dilated convolutional neural operator: it maps
 * [water, bedNorm, rain×100] → next water (residual, ReLU-clamped). This pure-TS
 * forward pass is (a) the ground-truth reference the WebGPU path is checked
 * against, and (b) a dependency-free fallback. It's a *local* operator, so a model
 * trained at 96² runs unchanged at any grid size.
 *
 * Pure module (no React/WebGPU) → unit-testable in Node.
 */

export interface SurrogateLayer {
  name: string;
  in: number;
  out: number;
  k: number;
  dilation: number;
  act: "gelu" | "relu" | "none";
  residual?: boolean;
  groupnorm?: boolean;
  groups?: number;
}

export interface SurrogateRaw {
  format: string;
  arch: {
    type: string;
    channels: number;
    inputs: string[];
    predicts: string;
    trainRes: number;
    HSCALE: number;
    dt: number;
    layers: SurrogateLayer[];
  };
  weights: Record<string, string>; // base64 float32
}

export interface Surrogate {
  arch: SurrogateRaw["arch"];
  weights: Record<string, Float32Array>;
}

export const SURROGATE_FORMAT = "catchment-surrogate-v1";

function b64ToF32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer as ArrayBuffer);
}

/** Returns null if the JSON isn't a valid v1 surrogate (engine then stays physics-only). */
export function decodeSurrogate(json: unknown): Surrogate | null {
  const raw = json as SurrogateRaw;
  if (!raw || raw.format !== SURROGATE_FORMAT || !raw.arch?.layers?.length) return null;
  const weights: Record<string, Float32Array> = {};
  for (const k of Object.keys(raw.weights)) weights[k] = b64ToF32(raw.weights[k]);
  return { arch: raw.arch, weights };
}

const gelu = (x: number) =>
  0.5 * x * (1 + Math.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)));
const act = (x: number, kind: SurrogateLayer["act"]) =>
  kind === "gelu" ? gelu(x) : kind === "relu" ? Math.max(0, x) : x;

/** 3×3 conv2d, replicate padding, dilation. w layout (out,in,kh,kw) row-major. */
function conv2d(
  inp: Float32Array, cin: number, h: number, w: number,
  weight: Float32Array, bias: Float32Array, cout: number, dil: number
): Float32Array {
  const out = new Float32Array(cout * h * w);
  const clamp = (v: number, hi: number) => (v < 0 ? 0 : v > hi ? hi : v);
  for (let co = 0; co < cout; co++) {
    const wBase = co * cin * 9;
    const oBase = co * h * w;
    const b = bias[co];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let acc = b;
        for (let ci = 0; ci < cin; ci++) {
          const iBase = ci * h * w;
          const wci = wBase + ci * 9;
          for (let ky = 0; ky < 3; ky++) {
            const sy = clamp(y + (ky - 1) * dil, h - 1);
            const row = iBase + sy * w;
            for (let kx = 0; kx < 3; kx++) {
              const sx = clamp(x + (kx - 1) * dil, w - 1);
              acc += inp[row + sx] * weight[wci + ky * 3 + kx];
            }
          }
        }
        out[oBase + y * w + x] = acc;
      }
    }
  }
  return out;
}

/** GroupNorm (per-instance, over each group's channels × spatial). */
function groupNorm(x: Float32Array, c: number, h: number, w: number, groups: number, gw: Float32Array, gb: Float32Array): Float32Array {
  const out = new Float32Array(x.length);
  const gc = c / groups;
  const hw = h * w;
  for (let g = 0; g < groups; g++) {
    let mean = 0;
    const start = g * gc;
    for (let cc = 0; cc < gc; cc++) for (let i = 0; i < hw; i++) mean += x[(start + cc) * hw + i];
    mean /= gc * hw;
    let varr = 0;
    for (let cc = 0; cc < gc; cc++) for (let i = 0; i < hw; i++) { const d = x[(start + cc) * hw + i] - mean; varr += d * d; }
    varr /= gc * hw;
    const inv = 1 / Math.sqrt(varr + 1e-5);
    for (let cc = 0; cc < gc; cc++) {
      const ch = start + cc;
      const s = gw[ch] * inv, off = gb[ch] - gw[ch] * mean * inv;
      for (let i = 0; i < hw; i++) out[ch * hw + i] = x[ch * hw + i] * s + off;
    }
  }
  return out;
}

/**
 * One neural step. water/bedNorm are length n*n (row-major). Returns next water.
 * bedNorm = bed/HSCALE; rain is the engine's rainfall scalar (channel = rain×100).
 */
export function surrogateStep(model: Surrogate, water: Float32Array, bedNorm: Float32Array, rain: number, n: number): Float32Array {
  const hw = n * n;
  const rainCh = rain * 100;
  // input channels: [water, bedNorm, rain×100]
  let cur: Float32Array = new Float32Array(3 * hw);
  cur.set(water, 0);
  cur.set(bedNorm, hw);
  cur.fill(rainCh, 2 * hw, 3 * hw);
  let curC = 3;
  const W = model.weights;
  for (const layer of model.arch.layers) {
    let z = conv2d(cur, curC, n, n, W[layer.name + ".w"], W[layer.name + ".b"], layer.out, layer.dilation);
    if (layer.groupnorm) z = groupNorm(z, layer.out, n, n, layer.groups ?? 8, W[layer.name + ".gn_w"], W[layer.name + ".gn_b"]);
    for (let i = 0; i < z.length; i++) z[i] = act(z[i], layer.act);
    if (layer.residual && layer.in === layer.out) {
      for (let i = 0; i < z.length; i++) z[i] += cur[i];
    }
    cur = z;
    curC = layer.out;
  }
  // final layer has out=1: residual add to water, ReLU clamp
  const next = new Float32Array(hw);
  for (let i = 0; i < hw; i++) next[i] = Math.min(Math.max(0, water[i] + cur[i]), 4.0);
  return next;
}

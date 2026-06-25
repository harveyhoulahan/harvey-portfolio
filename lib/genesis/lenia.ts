/*
 * lenia.ts — pure-TS reference for the Lenia continuous cellular automaton.
 *
 * This is the ground-truth the WebGPU kernel in `sim-shaders.ts` is transcribed
 * from (same math, same constants), and a dependency-free fallback for machines
 * without WebGPU. Being pure (no React/WebGPU) it runs in Node, so the dynamics
 * can be validated headlessly even though the live render can't be.
 *
 * Lenia (Bert Chan, 2019): a state field A ∈ [0,1] on a toroidal grid evolves by
 *   U = K ∗ A                     (convolution with a normalized ring kernel)
 *   G(u) = 2·exp(−(u−μ)²/(2σ²)) − 1   (growth mapping, ∈ [−1,1])
 *   A' = clamp(A + dt·G(U), 0, 1)
 * Smooth space/time/state generalization of Conway's Life; produces self-
 * organizing, gliding "creatures" (orbium, etc.).
 */

export interface LeniaParams {
  R: number; // kernel radius in cells
  mu: number; // growth centre
  sigma: number; // growth width
  dt: number; // time step
   kSigma: number; // ring-kernel width (fraction of R, around the 0.5 shell)
}

/** Orbium-flavoured defaults: random seeds settle into drifting blobs/gliders. */
export const DEFAULT_PARAMS: LeniaParams = {
  R: 13,
  mu: 0.15,
  sigma: 0.017,
  dt: 0.1,
  kSigma: 0.15,
};

/**
 * Build a normalized ring kernel as a flat (2R+1)² array (row-major, centre at
 * (R,R)). Shell bump peaks at normalized radius 0.5; everything outside R is 0.
 * Normalized so the weights sum to 1, so U is a weighted mean in [0,1].
 */
export function buildKernel(R: number, kSigma: number): Float32Array {
  const w = 2 * R + 1;
  const k = new Float32Array(w * w);
  let sum = 0;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const r = Math.hypot(dx, dy) / R; // normalized radius
      let v = 0;
      if (r > 0 && r <= 1) {
        const d = (r - 0.5) / kSigma;
        v = Math.exp(-0.5 * d * d);
      }
      k[(dy + R) * w + (dx + R)] = v;
      sum += v;
    }
  }
  if (sum > 0) for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

const growth = (u: number, mu: number, sigma: number) => {
  const d = (u - mu) / sigma;
  return 2 * Math.exp(-0.5 * d * d) - 1;
};

/** One Lenia step. `state` length N*N, row-major, toroidal. Returns next state. */
export function leniaStep(
  state: Float32Array,
  N: number,
  kernel: Float32Array,
  p: LeniaParams
): Float32Array {
  const R = p.R;
  const w = 2 * R + 1;
  const next = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let u = 0;
      for (let dy = -R; dy <= R; dy++) {
        const sy = (((y + dy) % N) + N) % N;
        const rowS = sy * N;
        const rowK = (dy + R) * w;
        for (let dx = -R; dx <= R; dx++) {
          const kw = kernel[rowK + (dx + R)];
          if (kw === 0) continue;
          const sx = (((x + dx) % N) + N) % N;
          u += kw * state[rowS + sx];
        }
      }
      const a = state[y * N + x] + p.dt * growth(u, p.mu, p.sigma);
      next[y * N + x] = a < 0 ? 0 : a > 1 ? 1 : a;
    }
  }
  return next;
}

/** Seed a soft random patch (used for the initial primordial soup). */
export function seedSoup(N: number, fill = 0.32, rng: () => number = Math.random): Float32Array {
  const s = new Float32Array(N * N);
  const cx = N / 2;
  const cy = N / 2;
  const rad = N * 0.22;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (Math.hypot(x - cx, y - cy) < rad && rng() < fill) {
        s[y * N + x] = rng();
      }
    }
  }
  return s;
}

/** Total field mass — used by tests/novelty objectives to confirm life persists. */
export function mass(state: Float32Array): number {
  let m = 0;
  for (let i = 0; i < state.length; i++) m += state[i];
  return m;
}

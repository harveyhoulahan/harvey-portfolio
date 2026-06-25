/*
 * particle-life.ts — reference + helpers for the Particle Life substrate.
 *
 * Particle Life (Ventrella's "Clusters"; Tom Mohr's formulation): N particles of
 * K types drift in a toroidal box. Each ordered type-pair (i,j) has an attraction
 * coefficient A[i][j] ∈ [−1,1]; within a radius rMax particles feel a short-range
 * repulsion plus an A-scaled mid-range attraction. Tiny asymmetric rules give rise
 * to cells, chasers, membranes and self-propelled "creatures" — emergent life from
 * a pure interaction matrix.
 *
 * The force law + integrator here are the ground truth the WGSL compute shader is
 * transcribed from, and (being pure) are validated headlessly in Node.
 */

export interface ParticleParams {
  K: number;        // number of types
  rMax: number;     // interaction radius (fraction of the unit box)
  beta: number;     // repulsion zone fraction of rMax
  dt: number;       // timestep
  friction: number; // velocity retained per step (∈ (0,1))
  forceFactor: number;
}

export const PARTICLE_DEFAULTS: ParticleParams = {
  K: 6,
  rMax: 0.12,
  beta: 0.30,
  dt: 0.018,
  friction: 0.78,
  forceFactor: 5.0,
};

/** Pairwise force profile, r normalized to [0,1] by rMax. */
export function force(rn: number, a: number, beta: number): number {
  if (rn < beta) return rn / beta - 1;          // close range: always repulsive
  if (rn < 1) return a * (1 - Math.abs(2 * rn - 1 - beta) / (1 - beta)); // attraction
  return 0;
}

/** Random attraction matrix in [-1,1], length K*K (row-major: A[i*K+j]). */
export function randomMatrix(K: number, rng: () => number = Math.random): Float32Array {
  const m = new Float32Array(K * K);
  for (let i = 0; i < K * K; i++) m[i] = rng() * 2 - 1;
  return m;
}

export interface ParticleState {
  pos: Float32Array; // length 2N (x,y in [0,1])
  vel: Float32Array; // length 2N
  type: Uint32Array; // length N
}

export function initParticles(N: number, K: number, rng: () => number = Math.random): ParticleState {
  const pos = new Float32Array(2 * N);
  const vel = new Float32Array(2 * N);
  const type = new Uint32Array(N);
  for (let i = 0; i < N; i++) {
    pos[2 * i] = rng();
    pos[2 * i + 1] = rng();
    type[i] = Math.floor(rng() * K) % K;
  }
  return { pos, vel, type };
}

const wrapDelta = (d: number) => (d > 0.5 ? d - 1 : d < -0.5 ? d + 1 : d);

/** One step (naive O(N²)); mirrors the WGSL kernel. Mutates state in place. */
export function particleStep(s: ParticleState, A: Float32Array, p: ParticleParams): void {
  const N = s.type.length;
  const { pos, vel, type } = s;
  const nvx = new Float32Array(N);
  const nvy = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let ax = 0, ay = 0;
    const xi = pos[2 * i], yi = pos[2 * i + 1], ti = type[i];
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dx = wrapDelta(pos[2 * j] - xi);
      const dy = wrapDelta(pos[2 * j + 1] - yi);
      const r = Math.hypot(dx, dy);
      if (r > 0 && r < p.rMax) {
        const f = force(r / p.rMax, A[ti * p.K + type[j]], p.beta);
        ax += (dx / r) * f;
        ay += (dy / r) * f;
      }
    }
    ax *= p.rMax * p.forceFactor;
    ay *= p.rMax * p.forceFactor;
    nvx[i] = vel[2 * i] * p.friction + ax * p.dt;
    nvy[i] = vel[2 * i + 1] * p.friction + ay * p.dt;
  }
  for (let i = 0; i < N; i++) {
    vel[2 * i] = nvx[i];
    vel[2 * i + 1] = nvy[i];
    let x = pos[2 * i] + nvx[i] * p.dt;
    let y = pos[2 * i + 1] + nvy[i] * p.dt;
    x -= Math.floor(x); // wrap to [0,1)
    y -= Math.floor(y);
    pos[2 * i] = x;
    pos[2 * i + 1] = y;
  }
}

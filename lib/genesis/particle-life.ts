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
 * On top of the classic law this build adds four evolvable behaviours (all part of
 * the summon genome, mirrored 1:1 in the WGSL kernel and the offline trainer
 * ml/genesis/train_summon_prior.py):
 *   · align   — Vicsek-style flocking toward the local mean velocity
 *   · flow    — a global time-varying wind field
 *   · pulse   — per-species force modulation (species breathe out of phase)
 *   · convert — cyclic predation: type t is converted by a close type (t+1)%K
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
  align: number;    // flocking strength (0 = classic particle life)
  flow: number;     // wind-field strength
  pulse: number;    // per-species force breathing amplitude
  convert: number;  // cyclic predation rate (probability per step in contact)
}

// Calm on load: enough asymmetric attraction to cluster into cells and chasers,
// but flocking/wind/pulse/predation stay understated so the default read is a
// living ecosystem, not a strobing light show. Presets and sliders still reach
// the extremes (see Storm, Comets in Genesis.tsx) for anyone who wants chaos.
export const PARTICLE_DEFAULTS: ParticleParams = {
  K: 6,
  rMax: 0.12,
  beta: 0.30,
  dt: 0.018,
  friction: 0.84,
  forceFactor: 3.2,
  align: 0.15,
  flow: 0.05,
  pulse: 0.08,
  convert: 0.02,
};

export const SPEED_CAP = 2.5; // hard velocity cap (matches the WGSL kernel)
export const CONVERT_RADIUS = 0.45; // predation radius as a fraction of rMax

/** Pairwise force profile, r normalized to [0,1] by rMax. */
export function force(rn: number, a: number, beta: number): number {
  if (rn < beta) return rn / beta - 1;          // close range: always repulsive
  if (rn < 1) return a * (1 - Math.abs(2 * rn - 1 - beta) / (1 - beta)); // attraction
  return 0;
}

/** Global wind field at position (x, y) and time t (matches WGSL). */
export function flowField(x: number, y: number, t: number): [number, number] {
  const TAU = Math.PI * 2;
  return [Math.sin(TAU * y * 3 + t * 0.7), Math.cos(TAU * x * 3 + t * 0.7)];
}

/** Per-species force multiplier at time t (matches WGSL). */
export function pulseMul(type: number, K: number, t: number, pulse: number): number {
  return 1 + pulse * 0.6 * Math.sin(t * 4 + (type * Math.PI * 2) / K);
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

/**
 * One step (naive O(N²)); mirrors the WGSL kernel. Mutates state in place.
 * `t` is the sim time in seconds (frame * 0.016 in the browser); `rng` drives
 * jitter + predation (the GPU uses a hash — same distribution, different stream).
 */
export function particleStep(
  s: ParticleState, A: Float32Array, p: ParticleParams,
  t = 0, noise = 0, rng: () => number = Math.random,
): void {
  const N = s.type.length;
  const { pos, vel, type } = s;
  const nvx = new Float32Array(N);
  const nvy = new Float32Array(N);
  const ntype = new Uint32Array(N);
  for (let i = 0; i < N; i++) {
    let ax = 0, ay = 0;
    let avx = 0, avy = 0, nn = 0;
    const xi = pos[2 * i], yi = pos[2 * i + 1], ti = type[i];
    const pred = (ti + 1) % p.K;
    let predDist = Infinity;
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dx = wrapDelta(pos[2 * j] - xi);
      const dy = wrapDelta(pos[2 * j + 1] - yi);
      const r = Math.hypot(dx, dy);
      if (r > 0 && r < p.rMax) {
        const tj = type[j];
        const f = force(r / p.rMax, A[ti * p.K + tj], p.beta);
        ax += (dx / r) * f;
        ay += (dy / r) * f;
        avx += vel[2 * j]; avy += vel[2 * j + 1]; nn++;
        if (tj === pred && r < predDist) predDist = r;
      }
    }
    const fm = p.rMax * p.forceFactor * pulseMul(ti, p.K, t, p.pulse);
    ax *= fm;
    ay *= fm;
    if (p.align > 0 && nn > 0) {
      ax += p.align * (avx / nn - vel[2 * i]);
      ay += p.align * (avy / nn - vel[2 * i + 1]);
    }
    if (p.flow > 0) {
      const [fx, fy] = flowField(xi, yi, t);
      ax += fx * p.flow * 2.5;
      ay += fy * p.flow * 2.5;
    }
    if (noise > 0) {
      ax += (rng() * 2 - 1) * noise;
      ay += (rng() * 2 - 1) * noise;
    }
    let vx = vel[2 * i] * p.friction + ax * p.dt;
    let vy = vel[2 * i + 1] * p.friction + ay * p.dt;
    const sp = Math.hypot(vx, vy);
    if (!Number.isFinite(sp)) { vx = 0; vy = 0; }
    else if (sp > SPEED_CAP) { vx *= SPEED_CAP / sp; vy *= SPEED_CAP / sp; }
    nvx[i] = vx;
    nvy[i] = vy;
    ntype[i] = (p.convert > 0 && predDist < p.rMax * CONVERT_RADIUS && rng() < p.convert) ? pred : ti;
  }
  for (let i = 0; i < N; i++) {
    vel[2 * i] = nvx[i];
    vel[2 * i + 1] = nvy[i];
    type[i] = ntype[i];
    let x = pos[2 * i] + nvx[i] * p.dt;
    let y = pos[2 * i + 1] + nvy[i] * p.dt;
    x -= Math.floor(x); // wrap to [0,1)
    y -= Math.floor(y);
    pos[2 * i] = x;
    pos[2 * i + 1] = y;
  }
}

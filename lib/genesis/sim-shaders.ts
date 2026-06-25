/*
 * sim-shaders.ts — WGSL for Genesis.
 *
 * SIM_WGSL    : one Lenia step (ring-kernel convolution + growth + clamp),
 *               transcribed 1:1 from the validated reference in lenia.ts.
 * DECAY_WGSL  : temporal "memory" pass — hist = max(state, hist·decay) — so the
 *               renderer can draw fading motion trails behind moving creatures.
 * RENDER_WGSL : fullscreen triangle that bilinearly samples the state field
 *               (smooth, not blocky), adds a soft bloom + trails, maps to the calm
 *               site palette (ink → sage → sand → cream), and vignettes the edges.
 *
 * Uniform layout (32 bytes, two vec4<f32>):
 *   p0 = (N, R, dt, mu)
 *   p1 = (sigma, kernelWidth, time, _)
 */

// Shared hash → [0,1], used for stochastic energy injection / jitter.
const HASH_WGSL = /* wgsl */ `
fn hash13(p3in: vec3<f32>) -> f32 {
  var p3 = fract(p3in * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

export const SIM_WGSL = /* wgsl */ `
struct U { p0: vec4<f32>, p1: vec4<f32>, p2: vec4<f32>, p3: vec4<f32> };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> srcS: array<f32>;
@group(0) @binding(2) var<storage, read_write> dstS: array<f32>;
@group(0) @binding(3) var<storage, read> kern: array<f32>;
${HASH_WGSL}
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let N = u32(u.p0.x);
  if (gid.x >= N || gid.y >= N) { return; }
  let R     = i32(u.p0.y);
  let dt    = u.p0.z;
  let mu    = u.p0.w;       // breathes (metabolism), written per-frame
  let sigma = u.p1.x;       // breathes too
  let kw    = i32(u.p1.y);
  let energy = u.p2.y;      // stochastic-birth rate
  let seed   = u.p2.z;      // frame seed for the hash
  let Ni = i32(N);
  let x = i32(gid.x);
  let y = i32(gid.y);

  var acc = 0.0;
  for (var dy = -R; dy <= R; dy = dy + 1) {
    let sy = ((y + dy) % Ni + Ni) % Ni;
    let rowS = sy * Ni;
    let rowK = (dy + R) * kw;
    for (var dx = -R; dx <= R; dx = dx + 1) {
      let w = kern[rowK + dx + R];
      if (w != 0.0) {
        let sx = ((x + dx) % Ni + Ni) % Ni;
        acc = acc + w * srcS[rowS + sx];
      }
    }
  }

  let z = (acc - mu) / sigma;
  let g = 2.0 * exp(-0.5 * z * z) - 1.0;
  var a = srcS[y * Ni + x] + dt * g;
  a = clamp(a, 0.0, 1.0);

  // energy injection: sparse stochastic births keep the organism from freezing
  if (energy > 0.0) {
    let hh = hash13(vec3<f32>(f32(x), f32(y), seed));
    if (hh < energy) {
      let amt = hash13(vec3<f32>(f32(x) + 11.0, f32(y) + 7.0, seed));
      a = min(1.0, a + 0.55 * amt);
    }
  }
  dstS[y * Ni + x] = a;
}
`;

// Semi-Lagrangian advection: flow the field along a slowly evolving velocity
// (uniform drift in heading θ + a swirl term) so creatures travel and wander.
export const ADVECT_WGSL = /* wgsl */ `
struct U { p0: vec4<f32>, p1: vec4<f32>, p2: vec4<f32>, p3: vec4<f32> };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> srcS: array<f32>;
@group(0) @binding(2) var<storage, read_write> dstS: array<f32>;

fn cellw(x: i32, y: i32, N: i32) -> i32 {
  let xx = ((x % N) + N) % N;
  let yy = ((y % N) + N) % N;
  return yy * N + xx;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let N = u32(u.p0.x);
  if (gid.x >= N || gid.y >= N) { return; }
  let Ni = i32(N);
  let Nf = u.p0.x;
  let t = u.p2.x;
  let drift = u.p2.w;
  let theta = u.p3.x;
  let swirl = u.p3.y;
  let TAU = 6.2831853;
  let x = f32(gid.x);
  let y = f32(gid.y);
  let vx = drift * cos(theta) + swirl * sin(TAU * y / Nf + t);
  let vy = drift * sin(theta) + swirl * cos(TAU * x / Nf + t);
  let fx = x - vx;
  let fy = y - vy;
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy));
  let tx = fx - floor(fx); let ty = fy - floor(fy);
  let a = srcS[cellw(x0, y0, Ni)];
  let b = srcS[cellw(x0 + 1, y0, Ni)];
  let c = srcS[cellw(x0, y0 + 1, Ni)];
  let d = srcS[cellw(x0 + 1, y0 + 1, Ni)];
  dstS[i32(gid.y) * Ni + i32(gid.x)] = mix(mix(a, b, tx), mix(c, d, tx), ty);
}
`;

// Conway's Game of Life on the same float field (state ∈ {0,1}). The discrete
// easter-egg substrate; shares the renderer (palette + trails + bloom) with Lenia.
export const LIFE_WGSL = /* wgsl */ `
struct U { p0: vec4<f32>, p1: vec4<f32> };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> srcS: array<f32>;
@group(0) @binding(2) var<storage, read_write> dstS: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let N = u32(u.p0.x);
  if (gid.x >= N || gid.y >= N) { return; }
  let Ni = i32(N);
  let x = i32(gid.x);
  let y = i32(gid.y);
  var n = 0;
  for (var dy = -1; dy <= 1; dy = dy + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      if (dx == 0 && dy == 0) { continue; }
      let sx = ((x + dx) % Ni + Ni) % Ni;
      let sy = ((y + dy) % Ni + Ni) % Ni;
      if (srcS[sy * Ni + sx] > 0.5) { n = n + 1; }
    }
  }
  let alive = srcS[y * Ni + x] > 0.5;
  var next = 0.0;
  if (alive && (n == 2 || n == 3)) { next = 1.0; }
  if (!alive && n == 3) { next = 1.0; }
  dstS[y * Ni + x] = next;
}
`;

// Particle Life — N agents of K types, pairwise attraction matrix, toroidal box.
// Force compute (naive O(N²)); transcribed from lib/genesis/particle-life.ts.
//   pu.a = (N, K, rMax, beta)   pu.b = (dt, friction, forceFactor, _)
export const PARTICLE_FORCE_WGSL = /* wgsl */ `
struct PU { a: vec4<f32>, b: vec4<f32>, c: vec4<f32>, d: vec4<f32> };
@group(0) @binding(0) var<uniform> pu: PU;
@group(0) @binding(1) var<storage, read> posIn: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> velIn: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read_write> posOut: array<vec2<f32>>;
@group(0) @binding(4) var<storage, read_write> velOut: array<vec2<f32>>;
@group(0) @binding(5) var<storage, read> typ: array<u32>;
@group(0) @binding(6) var<storage, read> mat: array<f32>;
${HASH_WGSL}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let N = u32(pu.a.x);
  let i = gid.x;
  if (i >= N) { return; }
  let K = i32(pu.a.y);
  let rMax = pu.a.z;
  let beta = pu.a.w;
  let dt = pu.b.x;
  let fric = pu.b.y;
  let ff = pu.b.z;
  let namp = pu.b.w;   // brownian jitter amplitude
  let cs = pu.d.x;     // cursor force strength
  let seed = pu.d.y;   // frame seed

  let pi = posIn[i];
  let ti = i32(typ[i]);
  var acc = vec2<f32>(0.0, 0.0);
  for (var j = 0u; j < N; j = j + 1u) {
    if (j == i) { continue; }
    var d = posIn[j] - pi;
    d.x = d.x - round(d.x); // toroidal minimum image (box size 1)
    d.y = d.y - round(d.y);
    let r = length(d);
    if (r > 0.0 && r < rMax) {
      let rn = r / rMax;
      let a = mat[ti * K + i32(typ[j])];
      var f = 0.0;
      if (rn < beta) { f = rn / beta - 1.0; }
      else { f = a * (1.0 - abs(2.0 * rn - 1.0 - beta) / (1.0 - beta)); }
      acc = acc + (d / r) * f;
    }
  }
  acc = acc * (rMax * ff);

  // brownian jitter — thermal energy so clusters shimmer and keep exploring
  if (namp > 0.0) {
    let jx = hash13(vec3<f32>(f32(i), seed, 1.0)) * 2.0 - 1.0;
    let jy = hash13(vec3<f32>(f32(i), seed, 2.0)) * 2.0 - 1.0;
    acc = acc + vec2<f32>(jx, jy) * namp;
  }
  // cursor field — the swarm reacts to the viewer (attract / repel)
  if (cs != 0.0) {
    let cx = pu.c.z; let cy = pu.c.w;
    if (cx >= 0.0) {
      var dc = vec2<f32>(cx, cy) - pi;
      dc.x = dc.x - round(dc.x);
      dc.y = dc.y - round(dc.y);
      let rc = length(dc);
      if (rc > 0.0001 && rc < 0.25) { acc = acc + (dc / rc) * cs * (1.0 - rc / 0.25); }
    }
  }

  let nv = velIn[i] * fric + acc * dt;
  velOut[i] = nv;
  var np = pi + nv * dt;
  np = np - floor(np); // wrap to [0,1)
  posOut[i] = np;
}
`;

// Particle render — one soft glowing disc per particle (instanced quads, additive).
//   pu.c = (aspect, pointSize, _, _)
export const PARTICLE_RENDER_WGSL = /* wgsl */ `
struct PU { a: vec4<f32>, b: vec4<f32>, c: vec4<f32> };
@group(0) @binding(0) var<uniform> pu: PU;
@group(0) @binding(1) var<storage, read> pos: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> typ: array<u32>;

struct VSOut {
  @builtin(position) p: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) col: vec3<f32>,
};

fn typeColor(t: u32) -> vec3<f32> {
  switch t {
    case 0u: { return vec3(0.290, 0.404, 0.255); } // sage
    case 1u: { return vec3(0.800, 0.680, 0.500); } // sand
    case 2u: { return vec3(0.960, 0.930, 0.880); } // cream
    case 3u: { return vec3(0.830, 0.430, 0.300); } // terracotta
    case 4u: { return vec3(0.300, 0.580, 0.540); } // teal
    default: { return vec3(0.760, 0.620, 0.230); } // gold
  }
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  var quad = array<vec2<f32>, 6>(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0));
  let q = quad[vi];
  let aspect = pu.c.x;
  let size = pu.c.y;
  let p = pos[ii];
  let center = vec2(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0);
  let off = vec2(q.x * size, q.y * size * aspect);
  var o: VSOut;
  o.p = vec4(center + off, 0.0, 1.0);
  o.uv = q;
  o.col = typeColor(typ[ii]);
  return o;
}

@fragment
fn fs(i: VSOut) -> @location(0) vec4<f32> {
  let d = length(i.uv);
  if (d > 1.0) { discard; }
  let glow = smoothstep(1.0, 0.0, d);
  let core = smoothstep(0.5, 0.0, d);
  let c = i.col * (glow * 0.45) + i.col * core;
  return vec4(c, glow); // additive blend in the pipeline
}
`;

export const DECAY_WGSL = /* wgsl */ `
struct U { p0: vec4<f32>, p1: vec4<f32> };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> stateS: array<f32>;
@group(0) @binding(2) var<storage, read_write> hist: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let N = u32(u.p0.x);
  if (gid.x >= N || gid.y >= N) { return; }
  let i = gid.y * N + gid.x;
  let s = stateS[i];
  let h = hist[i] * 0.90;   // trail persistence
  hist[i] = max(s, h);
}
`;

export const RENDER_WGSL = /* wgsl */ `
struct U { p0: vec4<f32>, p1: vec4<f32> };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> stateS: array<f32>;
@group(0) @binding(2) var<storage, read> histS: array<f32>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var p = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  let xy = p[vi];
  var o: VSOut;
  o.pos = vec4(xy, 0.0, 1.0);
  o.uv = vec2((xy.x + 1.0) * 0.5, 1.0 - (xy.y + 1.0) * 0.5);
  return o;
}

fn cell(x: i32, y: i32, N: i32) -> i32 {
  let xx = clamp(x, 0, N - 1);
  let yy = clamp(y, 0, N - 1);
  return yy * N + xx;
}

// bilinear sample of the state field at uv (smooth, not blocky)
fn sampS(uv: vec2<f32>, N: i32, Nf: f32) -> f32 {
  let fx = clamp(uv.x, 0.0, 0.999999) * Nf - 0.5;
  let fy = clamp(uv.y, 0.0, 0.999999) * Nf - 0.5;
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy));
  let tx = fx - floor(fx); let ty = fy - floor(fy);
  let a = stateS[cell(x0, y0, N)];
  let b = stateS[cell(x0 + 1, y0, N)];
  let c = stateS[cell(x0, y0 + 1, N)];
  let d = stateS[cell(x0 + 1, y0 + 1, N)];
  return mix(mix(a, b, tx), mix(c, d, tx), ty);
}

fn sampH(uv: vec2<f32>, N: i32, Nf: f32) -> f32 {
  let fx = clamp(uv.x, 0.0, 0.999999) * Nf - 0.5;
  let fy = clamp(uv.y, 0.0, 0.999999) * Nf - 0.5;
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy));
  let tx = fx - floor(fx); let ty = fy - floor(fy);
  let a = histS[cell(x0, y0, N)];
  let b = histS[cell(x0 + 1, y0, N)];
  let c = histS[cell(x0, y0 + 1, N)];
  let d = histS[cell(x0 + 1, y0 + 1, N)];
  return mix(mix(a, b, tx), mix(c, d, tx), ty);
}

fn palette(v: f32) -> vec3<f32> {
  let ink   = vec3(0.094, 0.094, 0.086);
  let sage  = vec3(0.286, 0.404, 0.255);
  let sand  = vec3(0.769, 0.659, 0.510);
  let cream = vec3(0.972, 0.961, 0.945);
  var c = mix(ink, sage, smoothstep(0.0, 0.32, v));
  c = mix(c, sand, smoothstep(0.30, 0.66, v));
  c = mix(c, cream, smoothstep(0.70, 0.98, v));
  return c;
}

@fragment
fn fs(i: VSOut) -> @location(0) vec4<f32> {
  let N = i32(u.p0.x);
  let Nf = u.p0.x;
  let uv = i.uv;

  let v = sampS(uv, N, Nf);
  let h = sampH(uv, N, Nf);

  // soft bloom: blur of the memory field over a small ring of taps
  let r = 1.7 / Nf;
  var glow = 0.0;
  glow = glow + sampH(uv + vec2( r,  0.0), N, Nf);
  glow = glow + sampH(uv + vec2(-r,  0.0), N, Nf);
  glow = glow + sampH(uv + vec2( 0.0,  r), N, Nf);
  glow = glow + sampH(uv + vec2( 0.0, -r), N, Nf);
  glow = glow + sampH(uv + vec2( r,  r), N, Nf) * 0.7;
  glow = glow + sampH(uv + vec2(-r,  r), N, Nf) * 0.7;
  glow = glow + sampH(uv + vec2( r, -r), N, Nf) * 0.7;
  glow = glow + sampH(uv + vec2(-r, -r), N, Nf) * 0.7;
  let r2 = 3.4 / Nf;
  glow = glow + sampH(uv + vec2( r2, 0.0), N, Nf) * 0.5;
  glow = glow + sampH(uv + vec2(-r2, 0.0), N, Nf) * 0.5;
  glow = glow + sampH(uv + vec2(0.0,  r2), N, Nf) * 0.5;
  glow = glow + sampH(uv + vec2(0.0, -r2), N, Nf) * 0.5;
  glow = glow / 8.4;

  // base creature body
  var col = palette(v);

  // fading trails: sage memory that lingers where structure has passed,
  // suppressed inside the bright core so it reads as motion, not haze
  let trail = vec3(0.255, 0.353, 0.227) * smoothstep(0.04, 0.55, h) * 0.40;
  col = col + trail * (1.0 - smoothstep(0.25, 0.6, v));

  // warm halo bloom around bright structures
  let bloom = mix(vec3(0.286, 0.404, 0.255), vec3(0.85, 0.74, 0.58), smoothstep(0.2, 0.8, glow));
  col = col + bloom * glow * 0.55;

  // vignette for full-screen depth
  let d = uv - vec2(0.5, 0.5);
  let vig = 1.0 - dot(d, d) * 0.85;
  col = col * clamp(vig, 0.45, 1.0);

  return vec4(col, 1.0);
}
`;

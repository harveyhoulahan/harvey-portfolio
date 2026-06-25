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

export const SIM_WGSL = /* wgsl */ `
struct U { p0: vec4<f32>, p1: vec4<f32> };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> srcS: array<f32>;
@group(0) @binding(2) var<storage, read_write> dstS: array<f32>;
@group(0) @binding(3) var<storage, read> kern: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let N = u32(u.p0.x);
  if (gid.x >= N || gid.y >= N) { return; }
  let R     = i32(u.p0.y);
  let dt    = u.p0.z;
  let mu    = u.p0.w;
  let sigma = u.p1.x;
  let kw    = i32(u.p1.y);
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
  dstS[y * Ni + x] = a;
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

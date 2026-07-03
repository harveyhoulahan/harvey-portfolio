/*
 * sim-shaders.ts — WGSL for the Catchment M2 hydraulic-erosion engine.
 *
 * Virtual-pipes shallow water (Mei et al. 2007) + stream-power erosion +
 * semi-Lagrangian sediment transport, ported 1:1 from the validated numpy
 * reference. One compute pass runs the kernels in sequence (WebGPU guarantees
 * storage writes from one dispatch are visible to the next within a pass), so
 * the whole step is: addRain → flux → water+velocity → erode → transport →
 * finalize. Normals are then re-derived from the (eroding) bedrock for shading.
 *
 * SimU uniform (80 bytes):
 *   dims = (n, dt, L, HSCALE)
 *   phys = (g, A, rain, evap)
 *   ero  = (Kc, Ks, Kd, capCap)
 *   src  = (srcX, srcZ, srcR, srcAmt)   // click-to-pour, grid coords
 *   view = (vscale, half, cellWorld, seaY)
 */

const HEADER = /* wgsl */ `
struct SimU {
  dims: vec4<f32>, phys: vec4<f32>, ero: vec4<f32>, src: vec4<f32>, view: vec4<f32>,
  fire: vec4<f32>, fset: vec4<f32>, wind: vec4<f32>, ign: vec4<f32>,
  storm: vec4<f32>, aux: vec4<f32>,
};
fn ix(r: u32, c: u32, n: u32) -> u32 { return r * n + c; }
`;

export const ADDRAIN_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read_write> wat: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total) { return; }
  let dt = u.dims.y;
  let r = i / n; let c = i % n;
  var W = wat[i] + u.phys.z * dt;
  // drifting storm cell: a Gaussian rain source the wind carries across the map.
  // The CPU pre-scales storm.w so total rainfall matches the uniform-rain budget.
  if (u.storm.w > 0.0) {
    let sdx = f32(c) - u.storm.x; let sdz = f32(r) - u.storm.y;
    W = W + u.storm.w * exp(-(sdx * sdx + sdz * sdz) / (2.0 * u.storm.z * u.storm.z)) * dt;
  }
  if (u.src.w > 0.0) {
    let dx = f32(c) - u.src.x; let dz = f32(r) - u.src.y;
    if (dx * dx + dz * dz < u.src.z * u.src.z) { W = W + u.src.w * dt; }
  }
  wat[i] = W;
}
`;

export const FLUX_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read> bed: array<f32>;
@group(0) @binding(2) var<storage, read> wat: array<f32>;
@group(0) @binding(3) var<storage, read_write> flux: array<vec4<f32>>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total) { return; }
  let dt = u.dims.y; let L = u.dims.z; let g = u.phys.x; let A = u.phys.y;
  let r = i / n; let c = i % n;
  let H = bed[i] + wat[i];
  let cl = select(c - 1u, c, c == 0u);
  let cr = select(c + 1u, c, c == n - 1u);
  let ru = select(r - 1u, r, r == 0u);
  let rd = select(r + 1u, r, r == n - 1u);
  let Hl = bed[ix(r, cl, n)] + wat[ix(r, cl, n)];
  let Hr = bed[ix(r, cr, n)] + wat[ix(r, cr, n)];
  let Hu = bed[ix(ru, c, n)] + wat[ix(ru, c, n)];
  let Hd = bed[ix(rd, c, n)] + wat[ix(rd, c, n)];
  var fl = max(0.0, flux[i].x + dt * A * g * (H - Hl) / L);
  var fr = max(0.0, flux[i].y + dt * A * g * (H - Hr) / L);
  var ft = max(0.0, flux[i].z + dt * A * g * (H - Hu) / L);
  var fb = max(0.0, flux[i].w + dt * A * g * (H - Hd) / L);
  if (c == 0u) { fl = 0.0; }
  if (c == n - 1u) { fr = 0.0; }
  if (r == 0u) { ft = 0.0; }
  if (r == n - 1u) { fb = 0.0; }
  let tot = (fl + fr + ft + fb) * dt + 1e-8;
  let K = min(1.0, wat[i] * L * L / tot);
  flux[i] = vec4<f32>(fl, fr, ft, fb) * K;
}
`;

export const WATERVEL_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read> flux: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> wat: array<f32>;
@group(0) @binding(3) var<storage, read_write> vel: array<vec2<f32>>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total) { return; }
  let dt = u.dims.y; let L = u.dims.z;
  let r = i / n; let c = i % n;
  let f = flux[i];
  let lc = select(c - 1u, 0u, c == 0u);
  let rc = select(c + 1u, 0u, c == n - 1u);
  let uc = select(r - 1u, 0u, r == 0u);
  let dc = select(r + 1u, 0u, r == n - 1u);
  let inL = select(flux[ix(r, lc, n)].y, 0.0, c == 0u);
  let inR = select(flux[ix(r, rc, n)].x, 0.0, c == n - 1u);
  let inT = select(flux[ix(uc, c, n)].w, 0.0, r == 0u);
  let inB = select(flux[ix(dc, c, n)].z, 0.0, r == n - 1u);
  let inflow = inL + inR + inT + inB;
  let outflow = f.x + f.y + f.z + f.w;
  let Wold = wat[i];
  let Wnew = Wold + dt * (inflow - outflow) / (L * L);
  let vx = ((inL - f.x) + (f.y - inR)) * 0.5;
  let vy = ((inT - f.z) + (f.w - inB)) * 0.5;
  let dmean = max((Wold + Wnew) * 0.5, 0.04);
  wat[i] = max(Wnew, 0.0);
  vel[i] = vec2<f32>(clamp(vx / (L * dmean), -3.0, 3.0), clamp(vy / (L * dmean), -3.0, 3.0));
}
`;

export const ERODE_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read_write> bed: array<f32>;
@group(0) @binding(2) var<storage, read> vel: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read_write> sed: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total) { return; }
  let L = u.dims.z;
  let r = i / n; let c = i % n;
  let v = vel[i]; let speed = length(v);
  let cl = select(c - 1u, c, c == 0u);
  let cr = select(c + 1u, c, c == n - 1u);
  let ru = select(r - 1u, r, r == 0u);
  let rd = select(r + 1u, r, r == n - 1u);
  let gx = (bed[ix(r, cr, n)] - bed[ix(r, cl, n)]) / (2.0 * L);
  let gy = (bed[ix(rd, c, n)] - bed[ix(ru, c, n)]) / (2.0 * L);
  let grad = sqrt(gx * gx + gy * gy);
  var sinT = grad / sqrt(1.0 + grad * grad);
  sinT = max(sinT, 0.02);
  let C = min(u.ero.x * sinT * speed, u.ero.w);
  let s = sed[i]; let diff = C - s;
  if (diff > 0.0) { let e = u.ero.y * diff; bed[i] = max(bed[i] - e, 0.0); sed[i] = s + e; }
  else { let d = u.ero.z * (-diff); bed[i] = bed[i] + d; sed[i] = s - d; }
}
`;

export const TRANSPORT_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read> sedIn: array<f32>;
@group(0) @binding(2) var<storage, read> vel: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read_write> sedOut: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total) { return; }
  let dt = u.dims.y;
  let r = i / n; let c = i % n;
  let v = vel[i];
  let cc = clamp(f32(c) - v.x * dt, 0.0, f32(n) - 1.001);
  let rr = clamp(f32(r) - v.y * dt, 0.0, f32(n) - 1.001);
  let c0 = u32(floor(cc)); let r0 = u32(floor(rr));
  let fc = cc - floor(cc); let fr = rr - floor(rr);
  let a = sedIn[ix(r0, c0, n)]; let b = sedIn[ix(r0, c0 + 1u, n)];
  let d = sedIn[ix(r0 + 1u, c0, n)]; let e = sedIn[ix(r0 + 1u, c0 + 1u, n)];
  sedOut[i] = (a * (1.0 - fc) + b * fc) * (1.0 - fr) + (d * (1.0 - fc) + e * fc) * fr;
}
`;

export const FINALIZE_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read> ocean: array<u32>;
@group(0) @binding(2) var<storage, read> bed0: array<f32>;
@group(0) @binding(3) var<storage, read_write> bed: array<f32>;
@group(0) @binding(4) var<storage, read_write> wat: array<f32>;
@group(0) @binding(5) var<storage, read_write> sed: array<f32>;
@group(0) @binding(6) var<storage, read> sedB: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total) { return; }
  let dt = u.dims.y; let evap = u.phys.w;
  if (ocean[i] != 0u) { wat[i] = 0.0; sed[i] = 0.0; bed[i] = bed0[i]; }
  else { wat[i] = wat[i] * (1.0 - evap * dt); sed[i] = sedB[i]; }
}
`;

export const NORMALS_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read> bed: array<f32>;
@group(0) @binding(2) var<storage, read_write> nrm: array<vec4<f32>>;

fn bedAt(r: i32, c: i32, n: u32) -> f32 {
  let rr = u32(clamp(r, 0, i32(n) - 1));
  let cc = u32(clamp(c, 0, i32(n) - 1));
  return bed[ix(rr, cc, n)];
}

fn smoothBed(r: i32, c: i32, n: u32) -> f32 {
  let center = bedAt(r, c, n) * 4.0;
  let card = (bedAt(r - 1, c, n) + bedAt(r + 1, c, n) + bedAt(r, c - 1, n) + bedAt(r, c + 1, n)) * 2.0;
  let diag = bedAt(r - 1, c - 1, n) + bedAt(r - 1, c + 1, n) + bedAt(r + 1, c - 1, n) + bedAt(r + 1, c + 1, n);
  return (center + card + diag) / 16.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total) { return; }
  let HSCALE = u.dims.w; let vs = u.view.x; let cell = u.view.z;
  let r = i32(i / n); let c = i32(i % n);
  let hl = smoothBed(r, c - 1, n) / HSCALE * vs;
  let hr = smoothBed(r, c + 1, n) / HSCALE * vs;
  let hu = smoothBed(r - 1, c, n) / HSCALE * vs;
  let hd = smoothBed(r + 1, c, n) / HSCALE * vs;
  let dx = vec3<f32>(2.0 * cell, hr - hl, 0.0);
  let dz = vec3<f32>(0.0, hd - hu, 2.0 * cell);
  let nv = normalize(cross(dz, dx));
  nrm[i] = vec4<f32>(nv, 1.0 - nv.y);
}
`;

/* Per-cell soft sun-shadow + sky ambient-occlusion, re-derived every frame from
 * the LIVE surface (eroding bedrock + water), so shadows track the Sun slider,
 * carving rivers, meteor craters — everything. A heightfield raymarch toward the
 * sun gives a distance-softened penumbra; a 6-direction horizon scan gives sky
 * visibility. Output: shad[i] = (sunVisibility, skyAO), both 0..1.
 * SimU.aux = (sunAzimuthRad, sunElevationRad, _, _). */
export const SHADOWAO_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read> bed: array<f32>;
@group(0) @binding(2) var<storage, read> wat: array<f32>;
@group(0) @binding(3) var<storage, read_write> shad: array<vec2<f32>>;

fn hWorld(r: i32, c: i32, n: u32) -> f32 {
  let rr = u32(clamp(r, 0, i32(n) - 1));
  let cc = u32(clamp(c, 0, i32(n) - 1));
  let j = rr * n + cc;
  return (bed[j] + wat[j]) / u.dims.w * u.view.x;
}

fn hWorldF(fr: f32, fc: f32, n: u32) -> f32 {
  let r0 = i32(floor(fr)); let c0 = i32(floor(fc));
  let tr = fr - floor(fr); let tc = fc - floor(fc);
  let a = hWorld(r0, c0, n); let b = hWorld(r0, c0 + 1, n);
  let d = hWorld(r0 + 1, c0, n); let e = hWorld(r0 + 1, c0 + 1, n);
  return mix(mix(a, b, tc), mix(d, e, tc), tr);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total) { return; }
  let cell = u.view.z;
  let r = i32(i / n); let c = i32(i % n);
  let h0 = hWorld(r, c, n) + 0.012; // lift start point to kill self-shadow acne

  // sun shadow: march the heightfield toward the sun; occlusion softens with distance
  let az = u.aux.x; let el = max(u.aux.y, 0.05);
  let sdir = vec2<f32>(cos(az), sin(az)); // (dCol, dRow) — matches render sun.xz
  let rise = tan(el);
  var sun = 1.0;
  var t = 1.6;
  for (var s = 0; s < 26; s = s + 1) {
    let fc = f32(c) + sdir.x * t;
    let fr = f32(r) + sdir.y * t;
    if (fc < 0.0 || fr < 0.0 || fc > f32(n) - 1.01 || fr > f32(n) - 1.01) { break; }
    let hRay = h0 + rise * t * cell;
    let occ = (hWorldF(fr, fc, n) - hRay) / (0.02 + t * cell * 0.18);
    sun = min(sun, clamp(1.0 - occ, 0.0, 1.0));
    t = t * 1.14 + 0.55;
  }

  // sky AO: mean sine-of-horizon over 6 bearings — valleys and gorges darken
  var ao = 0.0;
  for (var d2 = 0; d2 < 6; d2 = d2 + 1) {
    let ang = f32(d2) * 1.0471976;
    let dd = vec2<f32>(cos(ang), sin(ang));
    var maxTan = 0.0;
    var tt = 1.2;
    for (var s3 = 0; s3 < 9; s3 = s3 + 1) {
      let fc = clamp(f32(c) + dd.x * tt, 0.0, f32(n) - 1.01);
      let fr = clamp(f32(r) + dd.y * tt, 0.0, f32(n) - 1.01);
      maxTan = max(maxTan, (hWorldF(fr, fc, n) - h0) / (tt * cell));
      tt = tt * 1.5 + 0.6;
    }
    ao = ao + maxTan / sqrt(1.0 + maxTan * maxTan);
  }
  let sky = clamp(1.0 - (ao / 6.0) * 0.85, 0.0, 1.0);
  shad[i] = vec2<f32>(sun, sky);
}
`;

/* ---- M3 fire: heat-accumulation spread + burn/regrow ---------------------
 * SimU.fire = (R0, phiW, phiS, burn)
 * SimU.fset = (wetThresh, regrow, charFade, ignThresh)
 * SimU.wind = (wx, wz, wspeed, fireDt)
 * SimU.ign  = (ignX, ignZ, ignR, ignOn)
 */
export const SPREAD_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read> fire: array<f32>;
@group(0) @binding(2) var<storage, read> bed: array<f32>;
@group(0) @binding(3) var<storage, read_write> heat: array<f32>;
@group(0) @binding(4) var<storage, read> fuel: array<f32>;
@group(0) @binding(5) var<storage, read> wat: array<f32>;
@group(0) @binding(6) var<storage, read> ocean: array<u32>;

fn hash21(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

// contribution from the neighbour at (r+dr, c+dc); dvec is the unit direction
// FROM that neighbour TO this cell (x=col, y=row), used for downwind weighting.
fn contrib(r: i32, c: i32, ni: i32, n: u32, dr: i32, dc: i32, dvec: vec2<f32>,
           wind: vec2<f32>, wspeed: f32, R0: f32, phiW: f32, phiS: f32,
           myBed: f32, HSCALE: f32) -> f32 {
  let rr = clamp(r + dr, 0, ni - 1);
  let cc = clamp(c + dc, 0, ni - 1);
  let j = u32(rr) * n + u32(cc);
  let sf = fire[j];
  if (sf <= 0.01 || ocean[j] != 0u) { return 0.0; }
  let i = u32(r) * n + u32(c);
  if (ocean[i] != 0u) { return 0.0; }

  let windal = dot(wind, dvec);
  let downwind = max(0.0, windal);
  let upwind = max(0.0, -windal);
  let windPush = 1.0 + phiW * wspeed * pow(downwind, 1.7);
  let leeDamp = 1.0 - min(0.72, upwind * wspeed * 0.28);
  let up = max(0.0, (myBed - bed[j]) / HSCALE) * 18.0; // uphill spreads faster
  let down = max(0.0, (bed[j] - myBed) / HSCALE) * 5.0;
  let slopePush = 1.0 + phiS * up;
  let slopeDamp = 1.0 / (1.0 + down);
  let wetDamp = 1.0 - smoothstep(u.fset.x * 0.35, u.fset.x * 1.2, wat[i]);
  let fuelGate = smoothstep(0.08, 0.75, fuel[i]) * (0.55 + 0.45 * fuel[j]);
  let rough = 0.52 + 0.62 * hash21(vec2<f32>(f32(c) * 1.37 + f32(dc) * 11.0, f32(r) * 1.91 + f32(dr) * 7.0));
  let distDamp = select(0.72, 1.0, abs(dr) + abs(dc) == 1);
  return sf * R0 * windPush * leeDamp * slopePush * slopeDamp * wetDamp * fuelGate * rough * distDamp;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total) { return; }
  let H = u.dims.w; let R0 = u.fire.x; let pW = u.fire.y; let pS = u.fire.z;
  let wd = u.wind.xy; let ws = u.wind.z; let fdt = u.wind.w;
  let r = i32(i / n); let c = i32(i % n); let ni = i32(n);
  let mb = bed[i];
  let d = 0.70710678;
  var acc = 0.0;
  acc = acc + contrib(r, c, ni, n, -1, -1, vec2<f32>(d, d), wd, ws, R0, pW, pS, mb, H);
  acc = acc + contrib(r, c, ni, n, -1, 0, vec2<f32>(0.0, 1.0), wd, ws, R0, pW, pS, mb, H);
  acc = acc + contrib(r, c, ni, n, -1, 1, vec2<f32>(-d, d), wd, ws, R0, pW, pS, mb, H);
  acc = acc + contrib(r, c, ni, n, 0, -1, vec2<f32>(1.0, 0.0), wd, ws, R0, pW, pS, mb, H);
  acc = acc + contrib(r, c, ni, n, 0, 1, vec2<f32>(-1.0, 0.0), wd, ws, R0, pW, pS, mb, H);
  acc = acc + contrib(r, c, ni, n, 1, -1, vec2<f32>(d, -d), wd, ws, R0, pW, pS, mb, H);
  acc = acc + contrib(r, c, ni, n, 1, 0, vec2<f32>(0.0, -1.0), wd, ws, R0, pW, pS, mb, H);
  acc = acc + contrib(r, c, ni, n, 1, 1, vec2<f32>(-d, -d), wd, ws, R0, pW, pS, mb, H);

  // Longer-range, weaker spotting only in the downwind half-plane creates
  // natural fingers without the cost of an ember particle field.
  acc = acc + contrib(r, c, ni, n, -2, 0, vec2<f32>(0.0, 1.0), wd, ws, R0 * 0.22, pW * 1.4, pS, mb, H);
  acc = acc + contrib(r, c, ni, n, 2, 0, vec2<f32>(0.0, -1.0), wd, ws, R0 * 0.22, pW * 1.4, pS, mb, H);
  acc = acc + contrib(r, c, ni, n, 0, -2, vec2<f32>(1.0, 0.0), wd, ws, R0 * 0.22, pW * 1.4, pS, mb, H);
  acc = acc + contrib(r, c, ni, n, 0, 2, vec2<f32>(-1.0, 0.0), wd, ws, R0 * 0.22, pW * 1.4, pS, mb, H);
  heat[i] = clamp(heat[i] * 0.68 + acc * fdt, 0.0, 3.0);
}
`;

export const BURN_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read> heat: array<f32>;
@group(0) @binding(2) var<storage, read_write> fuel: array<f32>;
@group(0) @binding(3) var<storage, read_write> fire: array<f32>;
@group(0) @binding(4) var<storage, read_write> char: array<f32>;
@group(0) @binding(5) var<storage, read> wat: array<f32>;
@group(0) @binding(6) var<storage, read> ocean: array<u32>;

fn hash21(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(269.5, 183.3))) * 43758.5453);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total) { return; }
  let burn = u.fire.w; let fireDt = u.wind.w;
  let wet = u.fset.x; let regrow = u.fset.y; let charFade = u.fset.z; let ignT = u.fset.w;
  let r = i / n; let c = i % n;
  let isOcean = ocean[i] != 0u;
  let isWet = wat[i] > wet;
  var f = fire[i]; var fu = fuel[i]; var ch = char[i];
  let cellNoise = hash21(vec2<f32>(f32(c), f32(r)));
  let localIgnT = ignT * (0.72 + 0.58 * cellNoise);

  // ignition tool (click): light a patch
  if (u.ign.w > 0.5) {
    let dx = f32(c) - u.ign.x; let dz = f32(r) - u.ign.y;
    let rr = sqrt(dx * dx + dz * dz);
    let edge = 1.0 - smoothstep(u.ign.z * 0.35, u.ign.z, rr);
    if (rr < u.ign.z && fu > 0.1 && !isWet && !isOcean && edge + cellNoise * 0.35 > 0.42) {
      f = max(f, 0.72 + 0.28 * cellNoise);
    }
  }
  // spread ignition
  if (f < 0.5 && heat[i] > localIgnT && fu > 0.1 && !isWet && !isOcean) {
    f = clamp((heat[i] - localIgnT) * 1.8, 0.55, 1.0);
  }
  // water puts fire out
  if (isWet || isOcean) { f = 0.0; }

  if (f > 0.5) {
    f = clamp(f + heat[i] * 0.05, 0.0, 1.0);
    fu = fu - burn * fireDt * (0.75 + 0.45 * f);
    ch = min(1.0, ch + burn * fireDt * 1.4);
    if (fu <= 0.1) { f = 0.0; }
  } else {
    f = max(0.0, f - 0.08 * fireDt);
    fu = min(1.0, fu + regrow * fireDt * (1.0 - ch));   // vegetation regrows
    ch = max(0.0, ch - charFade * fireDt);              // scar fades
  }
  fuel[i] = clamp(fu, 0.0, 1.0); fire[i] = f; char[i] = clamp(ch, 0.0, 1.0);
}
`;

/* Single-click meteor impacts. SimU.ign = (x, z, radius, type), where type is:
 * 1 small/stony, 2 iron/deep, 3 volatile/hot. This mutates the real sim bedrock;
 * reset restores bed0, water, fire, heat, char and fuel. */
export const METEOR_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read_write> bed: array<f32>;
@group(0) @binding(2) var<storage, read_write> wat: array<f32>;
@group(0) @binding(3) var<storage, read_write> vel: array<vec2<f32>>;
@group(0) @binding(4) var<storage, read_write> fuel: array<f32>;
@group(0) @binding(5) var<storage, read_write> fire: array<f32>;
@group(0) @binding(6) var<storage, read_write> charr: array<f32>;
@group(0) @binding(7) var<storage, read> ocean: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let n = u32(u.dims.x); let total = n * n;
  if (i >= total || u.ign.w < 0.5 || ocean[i] != 0u) { return; }
  let r = i / n; let c = i % n;
  let dx = f32(c) - u.ign.x;
  let dz = f32(r) - u.ign.y;
  let dist = sqrt(dx * dx + dz * dz);
  let radius = max(u.ign.z, 1.0);
  // 2.6r covers the ejecta-ray halo; crater edits stay inside 1.22r.
  if (dist > radius * 2.6) { return; }

  let kind = u.ign.w;
  let isIron = kind > 1.5 && kind < 2.5;
  let isVolatile = kind >= 2.5;
  let depth = select(select(1.7, 3.0, isIron), 1.25, isVolatile);
  let rimLift = select(select(0.34, 0.58, isIron), 0.28, isVolatile);
  let splash = select(select(0.35, 0.75, isIron), 0.52, isVolatile);
  let ignition = select(select(0.25, 0.12, isIron), 1.0, isVolatile);
  let dry = select(select(0.35, 0.45, isIron), 0.8, isVolatile);

  // Ejecta rays: bright streaks of thrown material at fixed angles around the
  // crater — the pattern every fresh lunar crater wears. Phase keyed off the
  // impact position so no two craters share ray directions.
  let theta = atan2(dz, dx);
  let rayN = select(select(7.0, 9.0, isIron), 12.0, isVolatile);
  let ray = pow(0.5 + 0.5 * cos(theta * rayN + u.ign.x * 1.7 + u.ign.y * 0.9), 3.0);

  if (dist <= radius * 1.22) {
    let core = 1.0 - smoothstep(0.0, radius * 0.72, dist);
    let bowl = pow(max(core, 0.0), 1.55);
    // rim modulated by the rays so the crater lip reads scalloped, not stamped
    let rim = smoothstep(radius * 0.52, radius * 0.88, dist) * (1.0 - smoothstep(radius * 0.88, radius * 1.2, dist));
    var db = -bowl * depth + rim * rimLift * (0.72 + 0.56 * ray);
    // iron impactors rebound a central peak, like real complex craters
    if (isIron) {
      let peak = 1.0 - smoothstep(0.0, radius * 0.24, dist);
      db = db + pow(peak, 1.6) * depth * 0.46;
    }
    bed[i] = max(0.0, bed[i] + db);

    let dir = normalize(vec2<f32>(dx, dz) + vec2<f32>(0.0001, 0.0));
    vel[i] = clamp(vel[i] + dir * (bowl + rim) * splash * 2.5, vec2<f32>(-5.0), vec2<f32>(5.0));
    wat[i] = max(0.0, wat[i] * (1.0 - bowl * 0.72) + rim * splash * 0.16);

    let heat = bowl * ignition + rim * ignition * 0.35;
    fuel[i] = max(0.0, fuel[i] - bowl * dry * 0.4);
    charr[i] = clamp(charr[i] + heat * 0.28, 0.0, 1.0);
    if (heat > 0.2 && fuel[i] > 0.08) {
      fire[i] = max(fire[i], clamp(heat, 0.0, 1.0));
    }
    // volatile impactors throw a burning ring beyond the rim
    if (isVolatile) {
      let ring = smoothstep(radius * 0.85, radius * 1.05, dist) * (1.0 - smoothstep(radius * 1.05, radius * 1.22, dist));
      if (ring > 0.15 && fuel[i] > 0.08) { fire[i] = max(fire[i], ring); }
    }
  } else {
    // beyond the rim: ray scarring — scorched fuel and char along the ejecta
    // streaks, fading with distance. Volatile rocks scorch hardest.
    let zone = 1.0 - smoothstep(radius * 1.1, radius * 2.5, dist);
    let scorch = ray * zone * select(select(0.55, 0.4, isIron), 1.0, isVolatile);
    charr[i] = clamp(charr[i] + scorch * 0.5, 0.0, 1.0);
    fuel[i] = max(0.0, fuel[i] - scorch * 0.35);
    if (isVolatile && scorch > 0.4 && fuel[i] > 0.1) {
      fire[i] = max(fire[i], scorch * 0.6);
    }
  }
}
`;

/* ===========================================================================
 * M4 — neural surrogate inference (the conv-operator forward, on the GPU).
 * Mirrors lib/catchment/surrogate.ts (WGSL vs CPU ~5e-8); BOTH match the PyTorch
 * trainer forward exactly (same tanh GELU, same clamp_min, same ocean mask) —
 * verified by ml/parity_test.py to <1e-4. Feature buffers are channel-major f32:
 * index = ch*n*n + y*n + x. Dependency-free.
 * =========================================================================== */

// Assemble the 3 input channels [water, bedNorm, rain*100] into a feature buffer.
export const NEURAL_ASSEMBLE_WGSL = /* wgsl */ `
struct AU { n: u32, _p: u32, hscale: f32, rain: f32 };
@group(0) @binding(0) var<uniform> au: AU;
@group(0) @binding(1) var<storage, read> wat: array<f32>;
@group(0) @binding(2) var<storage, read> bed: array<f32>;
@group(0) @binding(3) var<storage, read_write> feat: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; let hw = au.n * au.n;
  if (i >= hw) { return; }
  feat[i] = wat[i];
  feat[hw + i] = bed[i] / au.hscale;
  feat[2u * hw + i] = au.rain * 100.0;
}
`;

// One conv2d layer (3x3, replicate pad, dilation) + activation + optional residual.
// w layout (out,in,kh,kw) row-major; act: 0=none 1=gelu 2=relu.
export const NEURAL_CONV_WGSL = /* wgsl */ `
struct CU { n: u32, cin: u32, cout: u32, dil: u32, act: u32, residual: u32, _a: u32, _b: u32 };
@group(0) @binding(0) var<uniform> cu: CU;
@group(0) @binding(1) var<storage, read> inp: array<f32>;
@group(0) @binding(2) var<storage, read_write> outp: array<f32>;
@group(0) @binding(3) var<storage, read> w: array<f32>;
@group(0) @binding(4) var<storage, read> b: array<f32>;

fn gelu(x: f32) -> f32 {
  return 0.5 * x * (1.0 + tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = cu.n; let hw = n * n; let total = cu.cout * hw;
  let gi = gid.x;
  if (gi >= total) { return; }
  let co = gi / hw; let rem = gi % hw; let y = i32(rem / n); let x = i32(rem % n);
  let ni = i32(n); let d = i32(cu.dil);
  var acc = b[co];
  for (var ci = 0u; ci < cu.cin; ci = ci + 1u) {
    let ib = ci * hw;
    let wb = (co * cu.cin + ci) * 9u;
    for (var ky = 0; ky < 3; ky = ky + 1) {
      let sy = clamp(y + (ky - 1) * d, 0, ni - 1);
      for (var kx = 0; kx < 3; kx = kx + 1) {
        let sx = clamp(x + (kx - 1) * d, 0, ni - 1);
        acc = acc + inp[ib + u32(sy) * n + u32(sx)] * w[wb + u32(ky * 3 + kx)];
      }
    }
  }
  var a = acc;
  if (cu.act == 1u) { a = gelu(acc); }
  else if (cu.act == 2u) { a = max(acc, 0.0); }
  if (cu.residual == 1u) { a = a + inp[co * hw + rem]; }  // in==out: add layer input
  outp[gi] = a;
}
`;

// Final apply (flux-divergence form): the last conv layer wrote a 2-channel edge
// flux into `flux` (gx = flux[i] flow right, gy = flux[hw+i] flow down). Here we take
// its divergence (ΔW, mass-conserving, closed outer boundary), then apply rain and
// evaporation analytically and zero ocean cells — the exact canonical_step shared
// with the PyTorch trainer and surrogate.ts. Because divergence conserves mass,
// water is bounded by physics alone — no upper clamp is applied.
export const NEURAL_APPLY_WGSL = /* wgsl */ `
struct PU { n: u32, rain: f32, dt: f32, evap: f32 };
@group(0) @binding(0) var<uniform> pu: PU;
@group(0) @binding(1) var<storage, read> flux: array<f32>;
@group(0) @binding(2) var<storage, read_write> wat: array<f32>;
@group(0) @binding(3) var<storage, read> ocean: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = pu.n; let hw = n * n;
  let i = gid.x;
  if (i >= hw) { return; }
  if (ocean[i] != 0u) { wat[i] = 0.0; return; }
  let x = i % n; let y = i / n;
  // ΔW = inflow - outflow over the 4 edges (closed boundary: no flux off the grid).
  var dW = 0.0;
  if (x < n - 1u) { dW = dW - flux[i]; }          // export right
  if (x > 0u)     { dW = dW + flux[i - 1u]; }      // import from left neighbour
  if (y < n - 1u) { dW = dW - flux[hw + i]; }      // export down
  if (y > 0u)     { dW = dW + flux[hw + i - n]; }  // import from up neighbour
  var v = wat[i] + pu.rain * pu.dt + dW;           // rain (analytic) + transport
  v = max(v, 0.0) * (1.0 - pu.evap * pu.dt);       // evaporation (analytic)
  wat[i] = max(v, 0.0);                             // flux-div is conservative: no upper clamp needed
}
`;

/* ---- rendering: RU is 144 bytes (Float32Array(36)) -----------------------
 * mvp(0..15) sun(16..19) params(20..23: n,vscale,half,seaY)
 * pick(24..27: x,z,r,on) cam(28..31: camx,camy,camz,fog) misc(32..35: HSCALE,..)
 */
const COLOR_HELPERS = /* wgsl */ `
fn srgbToLinear(c: vec3<f32>) -> vec3<f32> {
  return pow(max(c, vec3<f32>(0.0)), vec3<f32>(2.2));
}

fn linearToSrgb(c: vec3<f32>) -> vec3<f32> {
  return pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
}

fn acesFilm(c: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let cc = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((c * (a * c + vec3<f32>(b))) / (c * (cc * c + vec3<f32>(d)) + vec3<f32>(e)), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn displayColor(linear: vec3<f32>) -> vec3<f32> {
  return linearToSrgb(acesFilm(linear));
}
`;

/* Shared value-noise + gradient + cloud-shadow helpers for the render shaders. */
const NOISE_HELPERS = /* wgsl */ `
fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, vec3<f32>(p3.y, p3.z, p3.x) + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
fn vnoise(p: vec2<f32>) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2<f32>(1.0, 0.0)), u.x),
             mix(hash12(i + vec2<f32>(0.0, 1.0)), hash12(i + vec2<f32>(1.0, 1.0)), u.x), u.y);
}
fn vgrad(p: vec2<f32>) -> vec2<f32> {
  let e = 0.14;
  return vec2<f32>(
    vnoise(p + vec2<f32>(e, 0.0)) - vnoise(p - vec2<f32>(e, 0.0)),
    vnoise(p + vec2<f32>(0.0, e)) - vnoise(p - vec2<f32>(0.0, e))) / (2.0 * e);
}
// Drifting cloud shadows: two octaves of value noise scrolled by the wind-driven
// offset in ru.env.xy; amt fades the whole effect (0 = clear sky).
fn cloudShade(p: vec2<f32>, off: vec2<f32>, amt: f32) -> f32 {
  if (amt <= 0.002) { return 1.0; }
  let cl = vnoise(p * 1.6 + off) * 0.65 + vnoise(p * 3.7 + off * 1.6 + vec2<f32>(19.7, 7.3)) * 0.35;
  let sh = 1.0 - smoothstep(0.52, 0.80, cl) * 0.45;
  return mix(1.0, sh, clamp(amt, 0.0, 1.0));
}
`;

/* §5 ocean — domain-warped, multi-octave turbulent swell (the real-time cousin of
 * a Tessendorf FFT ocean). Iterative warp + rotated octaves give a chaotic, non-
 * repeating sea. Returns analytic normal (xyz) + wave height (w). Shared by the
 * ocean surface and the diorama's cross-section wall so they meet exactly. */
const OCEAN_WAVE = /* wgsl */ `
fn oceanWave(p0: vec2<f32>, t: f32) -> vec4<f32> {
  var p = p0 + vec2<f32>(sin(p0.y * 2.3 + t * 0.4), sin(p0.x * 2.1 - t * 0.35)) * 0.05;
  var h = 0.0; var dx = 0.0; var dz = 0.0;
  var amp = 0.013; var freq = 6.0; var spd = 0.85;
  var dir = normalize(vec2<f32>(0.92, 0.39));
  let ca = cos(2.399); let sa = sin(2.399);
  let rot = mat2x2<f32>(ca, -sa, sa, ca);
  for (var i = 0; i < 6; i = i + 1) {
    let ph = dot(dir, p) * freq + t * spd + f32(i) * 1.31;
    let s = sin(ph); let cph = cos(ph);
    h = h + amp * s;
    dx = dx + amp * freq * dir.x * cph;
    dz = dz + amp * freq * dir.y * cph;
    p = p + vec2<f32>(dz, dx) * 0.18;      // turbulent feedback warp
    dir = rot * dir; freq = freq * 1.72; amp = amp * 0.62; spd = spd * 1.16;
  }
  return vec4<f32>(normalize(vec3<f32>(-dx, 1.0, -dz)), h);
}
`;

/* Bilinear (sunVisibility, skyAO) lookup from the SHADOWAO buffer. Callers must
 * declare \`ru\` (with params = n,vscale,half,seaY) and \`shad\` at module scope. */
const SHADOW_SAMPLE = /* wgsl */ `
fn shadowAt(wx: f32, wz: f32) -> vec2<f32> {
  let n = u32(ru.params.x);
  let hf = ru.params.z;
  let fc = clamp((wx + hf) / (2.0 * hf) * f32(n - 1u), 0.0, f32(n) - 1.001);
  let fr = clamp((wz + hf) / (2.0 * hf) * f32(n - 1u), 0.0, f32(n) - 1.001);
  let c0 = u32(floor(fc)); let r0 = u32(floor(fr));
  let tc = fc - floor(fc); let tr = fr - floor(fr);
  let a = shad[r0 * n + c0]; let b = shad[r0 * n + c0 + 1u];
  let d = shad[(r0 + 1u) * n + c0]; let e = shad[(r0 + 1u) * n + c0 + 1u];
  return mix(mix(a, b, tc), mix(d, e, tc), tr);
}
`;

export const RENDER_TERRAIN_WGSL = /* wgsl */ `
// impact = (worldX, worldZ, kind*100 + ageSeconds, radiusWorld) — the last
// meteor strike; drives the incandescent crater glow that cools over ~6s.
// radiusWorld <= 0 means no live impact.
// env = (cloudOffsetX, cloudOffsetZ, cloudAmount, _) — wind-driven cloud shadows.
// stormu = (worldX, worldZ, sigmaWorld, strength) — the drifting storm cell darkens
// the ground beneath it like a real rain column.
struct RU { mvp: mat4x4<f32>, sun: vec4<f32>, params: vec4<f32>, pick: vec4<f32>, cam: vec4<f32>, misc: vec4<f32>, impact: vec4<f32>, env: vec4<f32>, stormu: vec4<f32> };
@group(0) @binding(0) var<uniform> ru: RU;
@group(0) @binding(1) var<storage, read> bed: array<f32>;
@group(0) @binding(2) var<storage, read> nrm: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> flags: array<u32>;
@group(0) @binding(4) var<storage, read> sed: array<f32>;
@group(0) @binding(5) var<storage, read> fuel: array<f32>;
@group(0) @binding(6) var<storage, read> charr: array<f32>;
@group(0) @binding(7) var<storage, read> fire: array<f32>;
@group(0) @binding(8) var<storage, read> shad: array<vec2<f32>>;
@group(0) @binding(9) var<storage, read> watT: array<f32>;
${COLOR_HELPERS}
${NOISE_HELPERS}
${SHADOW_SAMPLE}

// bilinear water depth — wets the ground around pools and river channels
fn waterAt(wx: f32, wz: f32) -> f32 {
  let n = u32(ru.params.x);
  let hf = ru.params.z;
  let fc = clamp((wx + hf) / (2.0 * hf) * f32(n - 1u), 0.0, f32(n) - 1.001);
  let fr = clamp((wz + hf) / (2.0 * hf) * f32(n - 1u), 0.0, f32(n) - 1.001);
  let c0 = u32(floor(fc)); let r0 = u32(floor(fr));
  let tc = fc - floor(fc); let tr = fr - floor(fr);
  let a = watT[r0 * n + c0]; let b = watT[r0 * n + c0 + 1u];
  let d = watT[(r0 + 1u) * n + c0]; let e = watT[(r0 + 1u) * n + c0 + 1u];
  return mix(mix(a, b, tc), mix(d, e, tc), tr);
}

fn bedAtCell(r: i32, c: i32, n: u32) -> f32 {
  let rr = u32(clamp(r, 0, i32(n) - 1));
  let cc = u32(clamp(c, 0, i32(n) - 1));
  return bed[rr * n + cc];
}

fn renderBed(r: i32, c: i32, n: u32) -> f32 {
  let center = bedAtCell(r, c, n) * 4.0;
  let card = (bedAtCell(r - 1, c, n) + bedAtCell(r + 1, c, n) + bedAtCell(r, c - 1, n) + bedAtCell(r, c + 1, n)) * 2.0;
  let diag = bedAtCell(r - 1, c - 1, n) + bedAtCell(r - 1, c + 1, n) + bedAtCell(r + 1, c - 1, n) + bedAtCell(r + 1, c + 1, n);
  return mix(bedAtCell(r, c, n), (center + card + diag) / 16.0, 0.72);
}

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) info: vec2<f32>,
  @location(3) sediment: f32,
  @location(4) eco: vec3<f32>,  // fuel, char, fire
  @location(5) beach: f32,      // 0..1 sandy foreshore strength (1 at the waterline)
  @location(6) bedh: f32,       // true bed height (ocean verts are snapped to sea level)
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  let n = u32(ru.params.x);
  let r = vi / n; let c = vi % n;
  let span = 2.0 * ru.params.z;
  let x = (f32(c) / f32(n - 1u)) * span - ru.params.z;
  let z = (f32(r) / f32(n - 1u)) * span - ru.params.z;
  let isOcean = (flags[vi] & 1u) != 0u;
  let hBed = renderBed(i32(r), i32(c), n) / ru.misc.x * ru.params.y;
  var h = hBed;
  if (isOcean) { h = ru.params.w; }
  let world = vec3<f32>(x, h, z);
  var out: VSOut;
  out.pos = ru.mvp * vec4<f32>(world, 1.0);
  out.world = world;
  out.normal = select(nrm[vi].xyz, vec3<f32>(0.0, 1.0, 0.0), isOcean);
  out.info = vec2<f32>(select(0.0, 1.0, isOcean), f32((flags[vi] >> 1u) & 1u));
  out.sediment = sed[vi];
  out.eco = vec3<f32>(fuel[vi], charr[vi], fire[vi]);
  out.beach = f32((flags[vi] >> 2u) & 15u) / 15.0; // 4-bit beach strength packed in flags
  out.bedh = hBed;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(in.normal);
  let L = normalize(ru.sun.xyz);
  let slope = clamp((1.0 - N.y) * 1.6, 0.0, 1.0);
  let hN = clamp(in.world.y / ru.params.y, 0.0, 1.0);
  let veg = srgbToLinear(vec3<f32>(0.40, 0.48, 0.33));
  let grass = srgbToLinear(vec3<f32>(0.69, 0.66, 0.47));
  let rock = srgbToLinear(vec3<f32>(0.60, 0.56, 0.49));
  var base = mix(veg, grass, smoothstep(0.15, 0.62, hN));
  base = mix(base, rock, slope);
  base = mix(base, srgbToLinear(vec3<f32>(0.30, 0.42, 0.24)), clamp(in.eco.x - 0.4, 0.0, 1.0) * 0.5); // lusher where fuel is high
  if (in.info.y > 0.5) { base = mix(base, srgbToLinear(vec3<f32>(0.46, 0.57, 0.55)), 0.6); }
  base = mix(base, srgbToLinear(vec3<f32>(0.58, 0.50, 0.40)), clamp(in.sediment * 1.5, 0.0, 0.5));
  // sandy beach: wet, darker sand at the waterline fading to dry pale sand up the slope
  var wetSheen = 0.0;
  if (in.beach > 0.001 && in.info.x < 0.5) {
    // the tideline breathes: the wet band creeps up the sand and drains back in
    // time with the swell, so the beach reads as worked by the sea
    let tide = 0.5 + 0.5 * sin(ru.misc.z * 0.8 + (in.world.x + in.world.z) * 5.0);
    let aboveSea = clamp((hN - 0.06 - 0.016 * tide) / 0.12, 0.0, 1.0);
    let wetSand = srgbToLinear(vec3<f32>(0.50, 0.46, 0.39));
    let drySand = srgbToLinear(vec3<f32>(0.84, 0.78, 0.63));
    let sand = mix(wetSand, drySand, aboveSea);
    base = mix(base, sand, clamp(in.beach * 1.15, 0.0, 1.0));
    wetSheen = clamp(in.beach * (1.0 - aboveSea) * (0.75 + 0.35 * tide), 0.0, 1.0);
  }
  if (in.info.x > 0.5) {
    // the seabed: pale sand shelving into deep slate-green with real depth, so the
    // translucent sea above reads as water over ground, not paint over paint
    let wcol = max(ru.params.w - in.bedh, 0.0);
    let sandBed = srgbToLinear(vec3<f32>(0.62, 0.60, 0.50));
    let deepBed = srgbToLinear(vec3<f32>(0.10, 0.20, 0.24));
    base = mix(sandBed, deepBed, smoothstep(0.0, 0.032, wcol));
    base = base * (0.94 + 0.12 * vnoise(in.world.xz * 14.0)); // bottom texture
  }
  // macro albedo variation so broad faces read as ground, not flat paint
  base = base * (0.93 + 0.14 * vnoise(in.world.xz * 6.3));
  // ground wetness: darken + cool toward the wet-earth tone around live water
  let wdep = waterAt(in.world.x, in.world.z);
  let wet = smoothstep(0.004, 0.09, wdep) * (1.0 - in.info.x);
  base = mix(base, base * vec3<f32>(0.55, 0.68, 0.72), wet * 0.55);
  // cast shadows + sky occlusion from the live surface, clouds drift on the wind,
  // and the storm cell drops a travelling column of gloom
  let sao = shadowAt(in.world.x, in.world.z);
  let cloud = cloudShade(in.world.xz, ru.env.xy, ru.env.z);
  let dsx = in.world.xz - ru.stormu.xy;
  let stormD = ru.stormu.w * exp(-dot(dsx, dsx) / (2.0 * ru.stormu.z * ru.stormu.z + 1e-5));
  let sunVis = mix(sao.x, sao.x * cloud, 1.0 - in.eco.z) * (1.0 - stormD * 0.55);
  // procedural detail normal: fBm gradient perturbation, stronger on rock, damped on wet ground
  let dg = vgrad(in.world.xz * 26.0) * 0.30 + vgrad(in.world.xz * 71.0 + vec2<f32>(3.7, 9.1)) * 0.16;
  let Nd = normalize(N + vec3<f32>(dg.x, 0.0, dg.y) * (0.35 + slope * 0.85) * (1.0 - wet * 0.7));
  let ndlD = clamp(dot(Nd, L), 0.0, 1.0);
  let amb = mix(srgbToLinear(vec3<f32>(0.34, 0.33, 0.30)), srgbToLinear(vec3<f32>(0.52, 0.55, 0.60)), N.y * 0.5 + 0.5);
  let sunCol = srgbToLinear(vec3<f32>(1.0, 0.96, 0.88));
  var col = base * (amb * (0.35 + 0.65 * sao.y) * (1.0 - stormD * 0.25) + sunCol * ndlD * 0.95 * sunVis);
  // wet ground and tideline sand catch a low specular sheen
  let Vt = normalize(ru.cam.xyz - in.world);
  let Ht = normalize(L + Vt);
  let sheen = max(wetSheen, wet * 0.55);
  col = col + srgbToLinear(vec3<f32>(1.0, 0.98, 0.92)) * pow(max(dot(Nd, Ht), 0.0), 42.0) * sheen * 0.55 * sunVis;
  // char scar
  col = mix(col, srgbToLinear(vec3<f32>(0.10, 0.09, 0.085)), clamp(in.eco.y, 0.0, 1.0) * 0.82);
  // fire emissive (flickers via time in misc.z)
  let flick = 0.8 + 0.2 * sin(ru.misc.z * 24.0 + in.world.x * 30.0);
  col = col + srgbToLinear(vec3<f32>(1.0, 0.45, 0.12)) * in.eco.z * 2.2 * flick;
  // incandescent crater: white-hot core cooling through orange to dull red
  // over ~6 seconds, shimmering slightly. Bloom picks this up.
  if (ru.impact.w > 0.0) {
    let ik = floor(ru.impact.z / 100.0);
    let age = ru.impact.z - ik * 100.0;
    let dImp = distance(in.world.xz, ru.impact.xy);
    let rw = ru.impact.w;
    let cool = exp(-age * 0.55);
    let hotCore = 1.0 - smoothstep(0.0, rw * 0.78, dImp);
    let hotRim = (smoothstep(rw * 0.55, rw * 0.85, dImp) - smoothstep(rw * 0.85, rw * 1.25, dImp)) * 0.4;
    let hot = (pow(hotCore, 1.4) + max(hotRim, 0.0)) * cool;
    if (hot > 0.001) {
      let hotCol = mix(srgbToLinear(vec3<f32>(0.9, 0.16, 0.02)), srgbToLinear(vec3<f32>(1.0, 0.86, 0.6)), clamp(cool, 0.0, 1.0));
      let boost = select(2.4, 3.4, ik >= 2.5);
      let shimmer = 0.85 + 0.15 * sin(ru.misc.z * 30.0 + dImp * 90.0);
      col = col + hotCol * hot * boost * shimmer;
    }
  }
  // aerial perspective: sky-tinted fog, thinner over high ground
  let dist = length(in.world - ru.cam.xyz);
  let fogH = 1.0 - clamp(in.world.y * 0.8, 0.0, 0.35);
  col = mix(col, srgbToLinear(vec3<f32>(0.90, 0.90, 0.88)), smoothstep(3.0, 6.5, dist) * ru.cam.w * fogH);
  if (ru.pick.w > 0.5) {
    let t = distance(in.world.xz, ru.pick.xy) / ru.pick.z;
    if (t < 1.0) { col = mix(col, srgbToLinear(vec3<f32>(0.29, 0.40, 0.16)), (1.0 - t) * 0.30); }
    let rr = abs(t - 1.0);
    if (rr < 0.06) { col = mix(col, srgbToLinear(vec3<f32>(0.96, 0.94, 0.90)), 1.0 - rr / 0.06); }
  }
  return vec4<f32>(displayColor(col), 1.0);
}
`;

/* Diorama pedestal: cliff walls around the perimeter + a base face. Each skirt
 * vertex packs a grid cell index (low 31 bits) and an isBottom flag (bit 31).
 * misc.x = HSCALE, misc.y = baseY. */
export const RENDER_SKIRT_WGSL = /* wgsl */ `
struct RU { mvp: mat4x4<f32>, sun: vec4<f32>, params: vec4<f32>, pick: vec4<f32>, cam: vec4<f32>, misc: vec4<f32> };
@group(0) @binding(0) var<uniform> ru: RU;
@group(0) @binding(1) var<storage, read> bed: array<f32>;
@group(0) @binding(2) var<storage, read> skirt: array<u32>;
${COLOR_HELPERS}

fn bedAtCell(r: i32, c: i32, n: u32) -> f32 {
  let rr = u32(clamp(r, 0, i32(n) - 1));
  let cc = u32(clamp(c, 0, i32(n) - 1));
  return bed[rr * n + cc];
}

fn renderBed(r: i32, c: i32, n: u32) -> f32 {
  let center = bedAtCell(r, c, n) * 4.0;
  let card = (bedAtCell(r - 1, c, n) + bedAtCell(r + 1, c, n) + bedAtCell(r, c - 1, n) + bedAtCell(r, c + 1, n)) * 2.0;
  let diag = bedAtCell(r - 1, c - 1, n) + bedAtCell(r - 1, c + 1, n) + bedAtCell(r + 1, c - 1, n) + bedAtCell(r + 1, c + 1, n);
  return mix(bedAtCell(r, c, n), (center + card + diag) / 16.0, 0.72);
}

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) shade: f32,
  @location(1) wy: f32,
  @location(2) band: f32,
  @location(3) edge: f32,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  let d = skirt[vi];
  let cell = d & 0x0fffffffu;
  let band = (d >> 28u) & 7u;
  let n = u32(ru.params.x);
  let r = cell / n; let c = cell % n;
  let span = 2.0 * ru.params.z;
  let edgeC = abs(f32(c) / f32(n - 1u) - 0.5) * 2.0;
  let edgeR = abs(f32(r) / f32(n - 1u) - 0.5) * 2.0;
  let edge = max(edgeC, edgeR);
  let skirtOut = select(1.0, 1.055, band == 1u);
  let baseOut = select(skirtOut, 1.17, band >= 2u);
  let x = ((f32(c) / f32(n - 1u)) * span - ru.params.z) * baseOut;
  let z = ((f32(r) / f32(n - 1u)) * span - ru.params.z) * baseOut;
  let topY = renderBed(i32(r), i32(c), n) / ru.misc.x * ru.params.y;
  var y = topY;
  if (band == 1u) { y = mix(topY, ru.misc.y + 0.055, 0.42); }
  if (band == 2u) { y = ru.misc.y + 0.02; }
  if (band == 3u) { y = ru.misc.y - 0.028; }
  var out: VSOut;
  out.pos = ru.mvp * vec4<f32>(x, y, z, 1.0);
  out.shade = select(0.22, 0.88, band == 0u);
  out.wy = y;
  out.band = f32(band);
  out.edge = edge;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let cap = srgbToLinear(vec3<f32>(0.74, 0.68, 0.57));
  let wall = srgbToLinear(vec3<f32>(0.54, 0.48, 0.39));
  let shadow = srgbToLinear(vec3<f32>(0.34, 0.31, 0.27));
  let plinth = srgbToLinear(vec3<f32>(0.66, 0.59, 0.48));
  let strata = 0.90 + 0.06 * sin(in.wy * 115.0) + 0.035 * sin(in.edge * 42.0);
  var col = mix(shadow, wall, in.shade) * strata;
  if (in.band < 0.5) { col = mix(col, cap, 0.42); }
  if (in.band > 0.5 && in.band < 1.5) { col = mix(col, plinth, 0.55); }
  if (in.band > 1.5) { col = mix(shadow, plinth, 0.72) * (0.94 + 0.04 * sin(in.edge * 70.0)); }
  return vec4<f32>(displayColor(col), 1.0);
}
`;

/* Lively water: depth-graded colour, animated ripples, sun sparkle, fresnel rim,
 * and foam/streaks on fast-moving water. misc.z carries time (seconds). */
export const RENDER_WATER_WGSL = /* wgsl */ `
struct RU { mvp: mat4x4<f32>, sun: vec4<f32>, params: vec4<f32>, pick: vec4<f32>, cam: vec4<f32>, misc: vec4<f32>, impact: vec4<f32>, env: vec4<f32>, stormu: vec4<f32> };
@group(0) @binding(0) var<uniform> ru: RU;
@group(0) @binding(1) var<storage, read> bed: array<f32>;
@group(0) @binding(2) var<storage, read> wat: array<f32>;
@group(0) @binding(3) var<storage, read> flags: array<u32>;
@group(0) @binding(4) var<storage, read> vel: array<vec2<f32>>;
@group(0) @binding(5) var<storage, read> sed: array<f32>;
@group(0) @binding(6) var<storage, read> shad: array<vec2<f32>>;
${COLOR_HELPERS}
${NOISE_HELPERS}
${SHADOW_SAMPLE}
${OCEAN_WAVE}

fn bedAtCell(r: i32, c: i32, n: u32) -> f32 {
  let rr = u32(clamp(r, 0, i32(n) - 1));
  let cc = u32(clamp(c, 0, i32(n) - 1));
  return bed[rr * n + cc];
}

fn renderBed(r: i32, c: i32, n: u32) -> f32 {
  let center = bedAtCell(r, c, n) * 4.0;
  let card = (bedAtCell(r - 1, c, n) + bedAtCell(r + 1, c, n) + bedAtCell(r, c - 1, n) + bedAtCell(r, c + 1, n)) * 2.0;
  let diag = bedAtCell(r - 1, c - 1, n) + bedAtCell(r - 1, c + 1, n) + bedAtCell(r + 1, c - 1, n) + bedAtCell(r + 1, c + 1, n);
  return mix(bedAtCell(r, c, n), (center + card + diag) / 16.0, 0.72);
}

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world: vec3<f32>,
  @location(1) depth: f32,
  @location(2) ocean: f32,
  @location(3) v: vec2<f32>,
  @location(4) onrm: vec3<f32>,
  @location(5) shore: f32,   // ocean: 0 deep → 1 at the sand (drives shallows + surf)
  @location(6) sedv: f32,    // suspended sediment — turbid floodwater
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  let n = u32(ru.params.x);
  let r = vi / n; let c = vi % n;
  let span = 2.0 * ru.params.z;
  let x = (f32(c) / f32(n - 1u)) * span - ru.params.z;
  let z = (f32(r) / f32(n - 1u)) * span - ru.params.z;
  let isOcean = (flags[vi] & 1u) != 0u;
  let w = wat[vi];
  var y = (renderBed(i32(r), i32(c), n) + w) / ru.misc.x * ru.params.y;
  var out: VSOut;
  out.onrm = vec3<f32>(0.0, 1.0, 0.0);
  out.depth = w;
  if (isOcean) {
    let ow = oceanWave(vec2<f32>(x, z), ru.misc.z);
    y = ru.params.w + ow.w;
    out.onrm = ow.xyz;
    out.depth = ow.w;     // carry wave height for crest foam
  }
  out.pos = ru.mvp * vec4<f32>(x, y, z, 1.0);
  out.world = vec3<f32>(x, y, z);
  out.ocean = select(0.0, 1.0, isOcean);
  out.v = vel[vi];
  out.shore = select(0.0, f32((flags[vi] >> 2u) & 15u) / 15.0, isOcean);
  out.sedv = sed[vi];
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let isOcean = in.ocean > 0.5;
  let L = normalize(ru.sun.xyz);
  let V = normalize(ru.cam.xyz - in.world);
  let H = normalize(L + V);

  if (isOcean) {
    let tt = ru.misc.z;
    // per-pixel wave field: the vertex stage displaces the coarse mesh, but the
    // normal is re-evaluated analytically per fragment (plus micro-ripple detail)
    // so the sea stays crisp instead of interpolating across 160² vertices
    let ow = oceanWave(in.world.xz, tt);
    let h = ow.w;
    let mg = vgrad(in.world.xz * 92.0 + vec2<f32>(tt * 0.9, -tt * 0.7)) * 0.05
           + vgrad(in.world.xz * 37.0 - vec2<f32>(tt * 0.5, tt * 0.35)) * 0.05;
    let N = normalize(ow.xyz + vec3<f32>(mg.x, 0.0, mg.y));

    // true water column from the live seafloor — continuous shallows that follow
    // the underwater topography all the way to the waterline
    let n2 = u32(ru.params.x);
    let hf = ru.params.z;
    let fc = clamp((in.world.x + hf) / (2.0 * hf) * f32(n2 - 1u), 0.0, f32(n2) - 1.001);
    let fr = clamp((in.world.z + hf) / (2.0 * hf) * f32(n2 - 1u), 0.0, f32(n2) - 1.001);
    let c0 = i32(floor(fc)); let r0 = i32(floor(fr));
    let tc = fc - floor(fc); let trr = fr - floor(fr);
    let bedY = mix(mix(bedAtCell(r0, c0, n2), bedAtCell(r0, c0 + 1, n2), tc),
                   mix(bedAtCell(r0 + 1, c0, n2), bedAtCell(r0 + 1, c0 + 1, n2), tc), trr)
               / ru.misc.x * ru.params.y;
    let waterCol = max(ru.params.w - bedY, 0.0);
    let shallowF = exp(-waterCol * 60.0);   // 1 at the waterline → 0 in the deep

    // lighting environment: terrain shadows reach over the water, clouds drift,
    // and the storm cell drops its column of gloom on the sea too
    let sao = shadowAt(in.world.x, in.world.z);
    let ocloud = cloudShade(in.world.xz, ru.env.xy, ru.env.z * 0.7);
    let dsx = in.world.xz - ru.stormu.xy;
    let stormD = ru.stormu.w * exp(-dot(dsx, dsx) / (2.0 * ru.stormu.z * ru.stormu.z + 1e-5));
    let sunV = sao.x * ocloud * (1.0 - stormD * 0.55);

    // body colour: one continuous slate→sea-green ramp driven by real depth, with
    // only gentle swell/current modulation — no saturated bands, no hard steps
    let cvar = vnoise(in.world.xz * 1.3 + vec2<f32>(tt * 0.03, -tt * 0.02)) - 0.5;
    let deepC = srgbToLinear(vec3<f32>(0.09, 0.22, 0.32));
    let midC = srgbToLinear(vec3<f32>(0.13, 0.33, 0.41));
    var col = mix(deepC, midC, clamp(0.45 + h * 10.0 + cvar * 0.18, 0.0, 1.0));
    let shallowC = srgbToLinear(vec3<f32>(0.32, 0.55, 0.53));
    col = mix(col, shallowC, smoothstep(0.05, 0.85, shallowF) * 0.85);
    col = col * (0.62 + 0.38 * sunV);
    // fresnel sky reflection, damped over the shallows so the sand stays readable
    let refl = reflect(-V, N);
    let horizon = srgbToLinear(vec3<f32>(0.62, 0.76, 0.82));
    let zenith = srgbToLinear(vec3<f32>(0.40, 0.58, 0.74));
    let skyCol = mix(horizon, zenith, clamp(refl.y * 0.5 + 0.5, 0.0, 1.0)) * (1.0 - stormD * 0.30);
    let fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    col = mix(col, skyCol, clamp(fres, 0.0, 0.55) * (1.0 - 0.5 * smoothstep(0.6, 0.95, shallowF)));
    // subsurface scattering — translucent green glow on lit, steep wave backs
    let sss = pow(max(0.0, dot(V, -L)), 2.0) * smoothstep(0.0, 0.014, h) * 0.6 * sunV;
    col = col + srgbToLinear(vec3<f32>(0.08, 0.40, 0.32)) * sss;
    // sun glint: a sharp sparkle for bloom + a faint broad sheen
    let ndh = max(dot(N, H), 0.0);
    col = col + srgbToLinear(vec3<f32>(1.0, 0.97, 0.86)) * (pow(ndh, 420.0) * 0.9 + pow(ndh, 48.0) * 0.08) * sunV;

    // foam, three regimes:
    // 1. crest foam — only genuinely steep wave tops, broken by advected noise
    let fN = vnoise(in.world.xz * 26.0 + vec2<f32>(tt * 0.45, tt * 0.3));
    let crest = smoothstep(0.019, 0.030, h) * smoothstep(0.55, 0.9, fN);
    // 2. breakers — swell lines whiten as the floor shoals and ride shoreward
    //    (phase locked to the water column, so lines follow the bathymetry)
    let bk = sin(waterCol * 230.0 + tt * 2.6 + (in.world.x + in.world.z) * 2.1) * 0.5 + 0.5;
    let bkN = smoothstep(0.35, 0.75, vnoise(in.world.xz * 14.0 + vec2<f32>(tt * 0.2, -tt * 0.15)));
    let breaking = pow(bk, 3.0) * smoothstep(0.30, 0.72, shallowF) * (1.0 - smoothstep(0.90, 0.99, shallowF)) * bkN;
    // 3. contact wash — a lapping bright line exactly where sea meets sand, which
    //    also hides the polygonal intersection of the two meshes
    let lapN = 0.7 + 0.3 * vnoise(in.world.xz * 55.0 - vec2<f32>(tt * 0.6, tt * 0.4));
    let contact = smoothstep(0.010, 0.0025, waterCol) * lapN;
    let foam = clamp(crest * 0.55 + max(breaking * 0.85, contact), 0.0, 1.0);
    col = mix(col, srgbToLinear(vec3<f32>(0.92, 0.95, 0.95)) * (0.55 + 0.45 * sunV), foam);
    // opacity eases from near-opaque deep water to a translucent (not glassy)
    // wash over the sand — enough body that the seabed reads as underwater
    // ground, not dry stone with sea rolling over it
    var alpha = mix(0.94, 0.68, smoothstep(0.35, 0.95, shallowF));
    alpha = clamp(alpha + foam * 0.45, 0.0, 0.96);
    return vec4<f32>(displayColor(col) * alpha, alpha);
  }

  // ---- sim water (land) ---------------------------------------------------
  // Beer–Lambert depth absorption, flow-mapped ripple normals advected by the
  // real velocity field, suspended-sediment turbidity, shoreline + whitewater
  // foam, and terrain shadows falling across the surface.
  let edge = smoothstep(0.012, 0.07, in.depth);     // soft feathered shoreline
  if (edge <= 0.002) { discard; }
  let t = ru.misc.z;
  let spd = length(in.v);
  let p = in.world.xz;
  let fdir = in.v / max(spd, 0.0001);

  // shadows + drifting clouds + the storm column shade the water like the ground
  let sao = shadowAt(in.world.x, in.world.z);
  let cloud = cloudShade(p, ru.env.xy, ru.env.z * 0.8);
  let dsx = p - ru.stormu.xy;
  let stormD = ru.stormu.w * exp(-dot(dsx, dsx) / (2.0 * ru.stormu.z * ru.stormu.z + 1e-5));
  let sunVis = sao.x * cloud * (1.0 - stormD * 0.55);

  // flow mapping: two noise-gradient samples advected along the velocity with
  // opposite phase, cross-faded so the ripples travel without visible reset
  let ph0 = fract(t * 0.6);
  let ph1 = fract(t * 0.6 + 0.5);
  let w0 = 1.0 - abs(2.0 * ph0 - 1.0);
  let w1 = 1.0 - abs(2.0 * ph1 - 1.0);
  let advect = fdir * min(spd, 1.6) * 2.4;
  let uv = p * 42.0;
  let g0 = vgrad(uv - advect * ph0);
  let g1 = vgrad(uv * 1.17 + vec2<f32>(11.3, 23.1) - advect * ph1);
  let amp = 0.05 + min(spd, 1.6) * 0.05 + smoothstep(0.0, 0.25, in.depth) * 0.025;
  let rn = (g0 * w0 + g1 * w1) * amp;
  let N = normalize(vec3<f32>(rn.x, 1.0, rn.y));

  // Beer–Lambert: red absorbed first, deep water settles into the blue-green
  let trans = exp(-in.depth * vec3<f32>(11.7, 4.05, 2.48));
  let shallowT = srgbToLinear(vec3<f32>(0.30, 0.47, 0.47));
  let deepC = srgbToLinear(vec3<f32>(0.016, 0.14, 0.30));
  var col = mix(deepC, shallowT, trans);
  // suspended sediment: eroding reaches run muddy, clear water stays blue
  let turb = clamp(in.sedv * 2.6, 0.0, 0.75);
  col = mix(col, srgbToLinear(vec3<f32>(0.46, 0.37, 0.26)), turb * 0.8);
  // light: shaded water darkens, occluded gorges lose skylight
  col = col * (0.55 + 0.45 * sunVis) * (0.60 + 0.40 * sao.y);
  // fresnel sky reflection
  let fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col = mix(col, srgbToLinear(vec3<f32>(0.55, 0.68, 0.76)) * (0.6 + 0.4 * sunVis), fres * 0.38);
  // sun sparkle (bloom feeds on this)
  let spec = pow(max(dot(N, H), 0.0), 120.0) * sunVis;
  col = col + srgbToLinear(vec3<f32>(1.0, 0.98, 0.9)) * spec * 1.1;
  // foam: whitewater streaks stretched along fast flow + a lapping shoreline band
  let fuv = vec2<f32>(dot(p, fdir), dot(p, vec2<f32>(-fdir.y, fdir.x)));
  let streak = vnoise(fuv * vec2<f32>(6.0, 52.0) - vec2<f32>(t * (1.5 + spd * 2.5), 0.0));
  let white = smoothstep(0.85, 1.9, spd) * smoothstep(0.45, 0.85, streak);
  // a real shoreline laps against sloping ground; a thin sheet on a flat basin
  // floor is just a wet playa — gating the band by bed slope stops whole lakes
  // sprouting foam fields that the bloom pass then smears into white blobs
  let nW = u32(ru.params.x);
  let hfW = ru.params.z;
  let fcW = clamp((p.x + hfW) / (2.0 * hfW) * f32(nW - 1u), 0.0, f32(nW) - 1.001);
  let frW = clamp((p.y + hfW) / (2.0 * hfW) * f32(nW - 1u), 0.0, f32(nW) - 1.001);
  let c0W = i32(floor(fcW)); let r0W = i32(floor(frW));
  let gW = vec2<f32>(bedAtCell(r0W, c0W + 1, nW) - bedAtCell(r0W, c0W - 1, nW),
                     bedAtCell(r0W + 1, c0W, nW) - bedAtCell(r0W - 1, c0W, nW));
  let shoreSlope = smoothstep(0.25, 1.2, length(gW) * 0.5);
  let shoreBand = smoothstep(0.006, 0.016, in.depth) * (1.0 - smoothstep(0.016, 0.05, in.depth));
  let lapN = vnoise(p * 34.0 + vec2<f32>(t * 0.35, -t * 0.28));
  let foam = clamp(white * 0.85 + shoreBand * shoreSlope * smoothstep(0.35, 0.8, lapN) * 0.7, 0.0, 0.9);
  col = mix(col, srgbToLinear(vec3<f32>(0.90, 0.94, 0.94)) * (0.5 + 0.5 * sunVis), foam);
  // opacity follows transmittance — thin films glint, pools go opaque; turbidity
  // and foam both cloud the water
  var alpha = clamp(1.0 - (trans.x + trans.y + trans.z) / 3.0, 0.0, 1.0);
  alpha = clamp(alpha * 0.92 + turb * 0.35 + foam * 0.4 + spec * 0.5, 0.0, 0.95) * edge;
  alpha = max(alpha, 0.06 * edge); // thin films read as sheen, not standing sea
  return vec4<f32>(displayColor(col) * alpha, alpha);
}
`;

/* The sea's cut face: an aquarium-style cross-section wall along the diorama
 * perimeter, from the (waving) ocean surface down to the seabed. Uses the same
 * oceanWave as the surface so the two meet exactly; land-height segments are
 * degenerate (top == bed) and vanish. Vertices pack cell | band<<28 (0 top, 1 bed). */
export const RENDER_OCEANWALL_WGSL = /* wgsl */ `
struct RU { mvp: mat4x4<f32>, sun: vec4<f32>, params: vec4<f32>, pick: vec4<f32>, cam: vec4<f32>, misc: vec4<f32>, impact: vec4<f32>, env: vec4<f32>, stormu: vec4<f32> };
@group(0) @binding(0) var<uniform> ru: RU;
@group(0) @binding(1) var<storage, read> bed: array<f32>;
@group(0) @binding(2) var<storage, read> wall: array<u32>;
${COLOR_HELPERS}
${NOISE_HELPERS}
${OCEAN_WAVE}

fn bedAtCell(r: i32, c: i32, n: u32) -> f32 {
  let rr = u32(clamp(r, 0, i32(n) - 1));
  let cc = u32(clamp(c, 0, i32(n) - 1));
  return bed[rr * n + cc];
}

fn renderBed(r: i32, c: i32, n: u32) -> f32 {
  let center = bedAtCell(r, c, n) * 4.0;
  let card = (bedAtCell(r - 1, c, n) + bedAtCell(r + 1, c, n) + bedAtCell(r, c - 1, n) + bedAtCell(r, c + 1, n)) * 2.0;
  let diag = bedAtCell(r - 1, c - 1, n) + bedAtCell(r - 1, c + 1, n) + bedAtCell(r + 1, c - 1, n) + bedAtCell(r + 1, c + 1, n);
  return mix(bedAtCell(r, c, n), (center + card + diag) / 16.0, 0.72);
}

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) world: vec3<f32>,
  @location(1) span: vec2<f32>, // (topY, bedY) of this column
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  let d = wall[vi];
  let cell = d & 0x0fffffffu;
  let band = d >> 28u;
  let n = u32(ru.params.x);
  let r = cell / n; let c = cell % n;
  let ext = 2.0 * ru.params.z;
  let x = (f32(c) / f32(n - 1u)) * ext - ru.params.z;
  let z = (f32(r) / f32(n - 1u)) * ext - ru.params.z;
  let bedY = renderBed(i32(r), i32(c), n) / ru.misc.x * ru.params.y;
  let seaTop = ru.params.w + oceanWave(vec2<f32>(x, z), ru.misc.z).w;
  let top = max(seaTop, bedY);
  let y = select(bedY, top, band == 0u);
  var out: VSOut;
  out.pos = ru.mvp * vec4<f32>(x, y, z, 1.0);
  out.world = vec3<f32>(x, y, z);
  out.span = vec2<f32>(top, bedY);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  if (in.span.x - in.span.y < 0.001) { discard; }
  let depthB = max(in.span.x - in.world.y, 0.0);
  // vertical water column: sunlit sea-green fading into the deeps
  let cTop = srgbToLinear(vec3<f32>(0.30, 0.52, 0.52));
  let cDeep = srgbToLinear(vec3<f32>(0.05, 0.15, 0.24));
  var col = mix(cTop, cDeep, smoothstep(0.0, 0.16, depthB));
  // drifting particulate / light shafts inside the volume
  let shaft = vnoise(vec2<f32>(in.world.x * 9.0 + in.world.z * 9.0, in.world.y * 26.0) + vec2<f32>(ru.misc.z * 0.22, ru.misc.z * -0.07));
  col = col * (0.90 + 0.18 * shaft);
  // bright waterline right under the surface
  let wl = 1.0 - smoothstep(0.0, 0.014, depthB);
  col = mix(col, srgbToLinear(vec3<f32>(0.86, 0.93, 0.93)), wl * 0.7);
  let alpha = 0.90;
  return vec4<f32>(displayColor(col) * alpha, alpha);
}
`;

/* ---- Bloom post-processing (bright-pass → separable blur → composite) -----
 * Operates on the resolved LDR scene; fire/sun/water sparkle read as near-white
 * so a luminance bright-pass catches them, then a gaussian blur blooms them. */
const FULLSCREEN_VS = /* wgsl */ `
struct VO { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VO {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var o: VO; o.pos = vec4<f32>(p[vi], 0.0, 1.0);
  o.uv = vec2<f32>((p[vi].x + 1.0) * 0.5, 1.0 - (p[vi].y + 1.0) * 0.5);
  return o;
}
`;

export const POST_BRIGHT_WGSL = FULLSCREEN_VS + /* wgsl */ `
struct BU { thresh: f32, _a: f32, _b: f32, _c: f32 };
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> bu: BU;
@fragment
fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let c = textureSample(tex, samp, uv).rgb;
  let luma = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
  let k = smoothstep(bu.thresh, bu.thresh + 0.25, luma);
  return vec4<f32>(c * k, 1.0);
}
`;

export const POST_BLUR_WGSL = FULLSCREEN_VS + /* wgsl */ `
struct DU { dir: vec2<f32>, _a: vec2<f32> };
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> du: DU;
@fragment
fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let w0 = 0.227027; let w1 = 0.1945946; let w2 = 0.1216216; let w3 = 0.054054; let w4 = 0.016216;
  var c = textureSample(tex, samp, uv).rgb * w0;
  c = c + textureSample(tex, samp, uv + du.dir * 1.0).rgb * w1 + textureSample(tex, samp, uv - du.dir * 1.0).rgb * w1;
  c = c + textureSample(tex, samp, uv + du.dir * 2.0).rgb * w2 + textureSample(tex, samp, uv - du.dir * 2.0).rgb * w2;
  c = c + textureSample(tex, samp, uv + du.dir * 3.0).rgb * w3 + textureSample(tex, samp, uv - du.dir * 3.0).rgb * w3;
  c = c + textureSample(tex, samp, uv + du.dir * 4.0).rgb * w4 + textureSample(tex, samp, uv - du.dir * 4.0).rgb * w4;
  return vec4<f32>(c, 1.0);
}
`;

export const POST_COMPOSITE_WGSL = FULLSCREEN_VS + /* wgsl */ `
struct CU2 { intensity: f32, _a: f32, _b: f32, _c: f32 };
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var sceneT: texture_2d<f32>;
@group(0) @binding(2) var bloomT: texture_2d<f32>;
@group(0) @binding(3) var<uniform> cu: CU2;
@fragment
fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let s = textureSample(sceneT, samp, uv).rgb;
  let b = textureSample(bloomT, samp, uv).rgb;
  var c = s + b * cu.intensity;
  // gentle palette grade: warm the highlights toward sand, cool the shadows
  let luma = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
  c = mix(c, c * vec3<f32>(1.03, 1.005, 0.96), smoothstep(0.45, 1.0, luma) * 0.5);
  c = mix(c, c * vec3<f32>(0.97, 1.0, 1.03), (1.0 - smoothstep(0.0, 0.4, luma)) * 0.4);
  // quiet vignette to seat the diorama in the frame
  let dv = uv - vec2<f32>(0.5, 0.5);
  c = c * (1.0 - dot(dv, dv) * 0.30);
  return vec4<f32>(c, 1.0);
}
`;

/* Fullscreen sky/atmosphere: warm-pale horizon → soft-blue zenith + a sun glow at
 * the projected sun position. sky.sun=(uvx,uvy,visible,_);
 * sky.params=(aspect,time,storminess,_) — storminess greys the sky and mutes the sun. */
export const RENDER_SKY_WGSL = /* wgsl */ `
struct SkyU { sun: vec4<f32>, params: vec4<f32> };
@group(0) @binding(0) var<uniform> sky: SkyU;
${COLOR_HELPERS}
struct VO { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VO {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var o: VO;
  o.pos = vec4<f32>(p[vi], 0.9999, 1.0);
  o.uv = p[vi] * 0.5 + vec2<f32>(0.5, 0.5);
  return o;
}
@fragment
fn fs(in: VO) -> @location(0) vec4<f32> {
  let uv = in.uv;
  let horizon = srgbToLinear(vec3<f32>(0.90, 0.88, 0.82));
  let mid = srgbToLinear(vec3<f32>(0.74, 0.79, 0.84));
  let zenith = srgbToLinear(vec3<f32>(0.52, 0.64, 0.80));
  var col = mix(horizon, mid, smoothstep(0.0, 0.45, uv.y));
  col = mix(col, zenith, smoothstep(0.4, 1.0, uv.y));
  // storm: the whole sky greys toward overcast and the sun dims behind it
  let overcast = clamp(sky.params.z, 0.0, 1.0);
  col = mix(col, srgbToLinear(vec3<f32>(0.64, 0.66, 0.68)), overcast * 0.45);
  if (sky.sun.z > 0.5) {
    let a = max(sky.params.x, 0.001);
    let d = length((uv - sky.sun.xy) * vec2<f32>(a, 1.0));
    let dim = 1.0 - overcast * 0.6;
    col = col + srgbToLinear(vec3<f32>(1.0, 0.92, 0.76)) * exp(-d * 7.0) * 0.85 * dim;
    col = col + srgbToLinear(vec3<f32>(1.0, 0.97, 0.88)) * smoothstep(0.028, 0.0, d) * dim;
  }
  return vec4<f32>(displayColor(col), 1.0);
}
`;

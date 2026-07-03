/*
 * parse.ts — binary format + pure math for the Gaussian-splat portrait.
 *
 * The .splat file is written by ml/splat/build_splat.py (export stage) and read
 * here; the two are a matched pair — change them together. Layout is 32 bytes
 * per gaussian, little-endian:
 *
 *   float32 x, y, z        world position (normalized: subject centred at the
 *                          origin, up = +Y, longest extent ≈ 1.5 units)
 *   float32 sx, sy, sz     ellipsoid semi-axes (linear, world units)
 *   uint8   r, g, b, a     colour (SH0 baked to RGB) and opacity
 *   uint8   qw, qx, qy, qz unit quaternion, mapped q*127.5+127.5
 *
 * Everything in this module is pure (no WebGL) so it can be validated headlessly
 * in Node — same discipline as lib/genesis/particle-life.ts.
 */

export const BYTES_PER_SPLAT = 32;

export interface SplatData {
  count: number;
  positions: Float32Array; // 3N
  /** 3D covariance, upper triangle per splat: xx xy xz yy yz zz (6N) */
  cov: Float32Array;
  colors: Uint8Array; // 4N (r g b a)
}

/** Quaternion (w,x,y,z) + semi-axes -> upper-triangular 3D covariance. */
export function covFromQuatScale(
  qw: number, qx: number, qy: number, qz: number,
  sx: number, sy: number, sz: number,
  out: Float32Array, o: number,
): void {
  const n = Math.hypot(qw, qx, qy, qz) || 1;
  const w = qw / n, x = qx / n, y = qy / n, z = qz / n;
  // rotation matrix rows
  const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - w * z), r02 = 2 * (x * z + w * y);
  const r10 = 2 * (x * y + w * z), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - w * x);
  const r20 = 2 * (x * z - w * y), r21 = 2 * (y * z + w * x), r22 = 1 - 2 * (x * x + y * y);
  // M = R * diag(s); Sigma = M * M^T
  const m00 = r00 * sx, m01 = r01 * sy, m02 = r02 * sz;
  const m10 = r10 * sx, m11 = r11 * sy, m12 = r12 * sz;
  const m20 = r20 * sx, m21 = r21 * sy, m22 = r22 * sz;
  out[o + 0] = m00 * m00 + m01 * m01 + m02 * m02; // xx
  out[o + 1] = m00 * m10 + m01 * m11 + m02 * m12; // xy
  out[o + 2] = m00 * m20 + m01 * m21 + m02 * m22; // xz
  out[o + 3] = m10 * m10 + m11 * m11 + m12 * m12; // yy
  out[o + 4] = m10 * m20 + m11 * m21 + m12 * m22; // yz
  out[o + 5] = m20 * m20 + m21 * m21 + m22 * m22; // zz
}

/** Decode a .splat buffer into draw-ready arrays (covariances precomputed). */
export function parseSplat(buf: ArrayBuffer): SplatData {
  if (buf.byteLength % BYTES_PER_SPLAT !== 0) {
    throw new Error(`splat file length ${buf.byteLength} is not a multiple of ${BYTES_PER_SPLAT}`);
  }
  const count = buf.byteLength / BYTES_PER_SPLAT;
  const f32 = new Float32Array(buf);
  const u8 = new Uint8Array(buf);
  const positions = new Float32Array(3 * count);
  const cov = new Float32Array(6 * count);
  const colors = new Uint8Array(4 * count);
  for (let i = 0; i < count; i++) {
    const fo = i * 8; // 8 floats of stride (first 24 bytes)
    const bo = i * 32;
    positions[3 * i] = f32[fo];
    positions[3 * i + 1] = f32[fo + 1];
    positions[3 * i + 2] = f32[fo + 2];
    const sx = f32[fo + 3], sy = f32[fo + 4], sz = f32[fo + 5];
    colors[4 * i] = u8[bo + 24];
    colors[4 * i + 1] = u8[bo + 25];
    colors[4 * i + 2] = u8[bo + 26];
    colors[4 * i + 3] = u8[bo + 27];
    const qw = (u8[bo + 28] - 127.5) / 127.5;
    const qx = (u8[bo + 29] - 127.5) / 127.5;
    const qy = (u8[bo + 30] - 127.5) / 127.5;
    const qz = (u8[bo + 31] - 127.5) / 127.5;
    covFromQuatScale(qw, qx, qy, qz, sx, sy, sz, cov, 6 * i);
  }
  return { count, positions, cov, colors };
}

/**
 * Depth-order indices for back-to-front drawing: 16-bit counting sort on
 * dot(position, viewForward), far-to-near. O(N) — comfortably per-frame for a
 * few hundred thousand gaussians; runs inside the viewer's worker.
 */
export function sortByDepth(
  positions: Float32Array, count: number,
  fx: number, fy: number, fz: number,
  out?: Uint32Array,
): Uint32Array {
  const order = out && out.length === count ? out : new Uint32Array(count);
  const depths = new Float32Array(count);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < count; i++) {
    const d = positions[3 * i] * fx + positions[3 * i + 1] * fy + positions[3 * i + 2] * fz;
    depths[i] = d;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  const B = 65536;
  const scale = max > min ? (B - 1) / (max - min) : 0;
  const counts = new Uint32Array(B);
  const bucket = new Uint16Array(count);
  for (let i = 0; i < count; i++) {
    // far first: invert so the largest depth lands in bucket 0
    const b = (B - 1 - ((depths[i] - min) * scale)) | 0;
    bucket[i] = b;
    counts[b]++;
  }
  let acc = 0;
  const starts = new Uint32Array(B);
  for (let b = 0; b < B; b++) { starts[b] = acc; acc += counts[b]; }
  for (let i = 0; i < count; i++) order[starts[bucket[i]]++] = i;
  return order;
}

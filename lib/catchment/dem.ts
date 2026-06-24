/*
 * dem.ts — loader for the Catchment digital-elevation model.
 * 16-bit elevation (smooth GPU displacement) + ocean/stream masks.
 */

export interface CatchmentDEMRaw {
  n: number;
  bounds: { west: number; south: number; east: number; north: number };
  elevMaxM: number;
  elev16: string; // base64 Uint16 little-endian, normalised
  ocean: string; // base64 Uint8
  stream: string; // base64 Uint8
}

export interface CatchmentDEM {
  n: number;
  bounds: CatchmentDEMRaw["bounds"];
  elevMaxM: number;
  elev: Float32Array; // 0..1, includes sea
  ocean: Uint8Array;
  stream: Uint8Array;
}

function b64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function decodeDEM(d: CatchmentDEMRaw): CatchmentDEM {
  const total = d.n * d.n;
  const eb = b64Bytes(d.elev16);
  const elev = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const lo = eb[i * 2], hi = eb[i * 2 + 1];
    elev[i] = ((hi << 8) | lo) / 65535;
  }
  return {
    n: d.n,
    bounds: d.bounds,
    elevMaxM: d.elevMaxM,
    elev,
    ocean: b64Bytes(d.ocean),
    stream: b64Bytes(d.stream),
  };
}

/** Bilinear sample of the elevation field (0..1) at fractional grid coords. */
export function sampleElev(dem: CatchmentDEM, gx: number, gz: number): number {
  const n = dem.n;
  const x = Math.max(0, Math.min(n - 1.001, gx));
  const z = Math.max(0, Math.min(n - 1.001, gz));
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = x - x0, fz = z - z0;
  const e = dem.elev;
  const a = e[z0 * n + x0], b = e[z0 * n + x0 + 1];
  const c = e[(z0 + 1) * n + x0], d = e[(z0 + 1) * n + x0 + 1];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}

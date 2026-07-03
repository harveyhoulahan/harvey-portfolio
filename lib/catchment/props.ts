/*
 * props.ts — CPU-side geometry for Catchment's living props.
 *
 * Builds one interleaved vertex buffer of trees, shrubs, buildings and
 * bridges for RENDER_PROPS_WGSL. Vertex layout (10 f32 / 40 B):
 *   pos.xyz   — local offset from the cell centre (bed-riding props) or
 *               absolute world XZ + world Y offset (anchored bridge parts)
 *   nrm.xyz   — face normal
 *   data.xyzw — (cellIdx | -1 anchored, type, rand 0..1, anchorH01)
 * Types: 0 canopy, 1 trunk, 2 shrub, 3 wall, 4 roof, 5 deck, 6 dark timber.
 *
 * Placement is deterministic per world id: groves come from a seeded clump
 * noise over the fuel field, buildings from designed settlement sites, and
 * bridges from designed spans. Trees ride the live bed and burn in the fire
 * sim (handled by the shader; here we only decide where things stand).
 */

import type { CatchmentDEM } from "@/lib/catchment/dem";

export interface Settlement { x: number; z: number; count: number; spread: number; grid?: boolean }
export interface BridgeSpan { x0: number; z0: number; x1: number; z1: number }
export interface PropsConfig {
  trees?: number;
  shrubs?: number;
  settlements?: Settlement[];
  bridges?: BridgeSpan[];
}

const TREE_CAP = 950;
const SHRUB_CAP = 750;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function buildPropGeometry(
  dem: CatchmentDEM,
  fuelInit: Float32Array,
  beach: Float32Array,
  cfg: PropsConfig,
  worldId: string,
  opts: { half: number; hscale: number },
): Float32Array {
  const n = dem.n;
  const { half } = opts;
  const cellW = (2 * half) / (n - 1);
  const rng = mulberry32(hashStr(worldId));
  const out: number[] = [];

  const cellIdx = (c: number, r: number) => r * n + c;
  const worldX = (c: number) => (c / (n - 1)) * 2 * half - half;
  const worldZ = (r: number) => (r / (n - 1)) * 2 * half - half;
  const elevAtGrid = (c: number, r: number) =>
    dem.elev[cellIdx(Math.max(0, Math.min(n - 1, Math.round(c))), Math.max(0, Math.min(n - 1, Math.round(r))))];

  // clump noise: seeded value noise so trees gather in groves, not confetti
  const perm = new Uint8Array(512);
  {
    const base = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  }
  const grid = (x: number, y: number) => perm[(perm[x & 255] + (y & 255)) & 511] / 255;
  const clump = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = grid(xi, yi), b = grid(xi + 1, yi), c2 = grid(xi, yi + 1), d = grid(xi + 1, yi + 1);
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v;
  };

  // ---- primitive emitters -------------------------------------------------
  const tri = (
    a: [number, number, number], b: [number, number, number], c: [number, number, number],
    cell: number, type: number, rand: number, anchors?: [number, number, number],
  ) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const pts = [a, b, c];
    for (let i = 0; i < 3; i++) {
      const p = pts[i];
      out.push(p[0], p[1], p[2], nx, ny, nz, cell, type, rand, anchors ? anchors[i] : 0);
    }
  };
  const quad = (
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number],
    cell: number, type: number, rand: number, anchors?: [number, number, number, number],
  ) => {
    tri(a, b, c, cell, type, rand, anchors ? [anchors[0], anchors[1], anchors[2]] : undefined);
    tri(a, c, d, cell, type, rand, anchors ? [anchors[0], anchors[2], anchors[3]] : undefined);
  };
  const cone = (
    ox: number, oz: number, baseY: number, r: number, apexY: number,
    seg: number, cell: number, type: number, rand: number,
  ) => {
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2;
      const a1 = ((s + 1) / seg) * Math.PI * 2;
      tri(
        [ox + Math.cos(a0) * r, baseY, oz + Math.sin(a0) * r],
        [ox + Math.cos(a1) * r, baseY, oz + Math.sin(a1) * r],
        [ox, apexY, oz],
        cell, type, rand,
      );
    }
  };

  // ---- trees & shrubs -----------------------------------------------------
  const emitTree = (cell: number, jx: number, jz: number, s: number, rand: number) => {
    // gum: trunk of two crossed quads, then a big canopy cone + an offset crown
    const tw = 0.09 * s;
    const th = 0.42 * s;
    quad([jx - tw, 0, jz], [jx + tw, 0, jz], [jx + tw, th, jz], [jx - tw, th, jz], cell, 1, rand);
    quad([jx, 0, jz - tw], [jx, 0, jz + tw], [jx, th, jz + tw], [jx, th, jz - tw], cell, 1, rand);
    cone(jx, jz, 0.3 * s, 0.42 * s, 1.02 * s, 6, cell, 0, rand);
    const lean = (rand - 0.5) * 0.24 * s;
    cone(jx + lean, jz + lean * 0.6, 0.58 * s, 0.26 * s, 1.24 * s, 5, cell, 0, Math.min(1, rand + 0.18));
  };
  const emitShrub = (cell: number, jx: number, jz: number, s: number, rand: number) => {
    cone(jx, jz, 0, 0.55 * s, 0.5 * s, 5, cell, 2, rand);
  };

  const treeDensity = cfg.trees ?? 0;
  const shrubDensity = cfg.shrubs ?? 0;
  if (treeDensity > 0 || shrubDensity > 0) {
    const total = n * n;
    let trees = 0;
    let shrubs = 0;
    const treeCap = Math.round(TREE_CAP * treeDensity);
    const shrubCap = Math.round(SHRUB_CAP * shrubDensity);
    // co-prime stride visits cells in a scattered order so caps don't bias north
    for (let k = 0; k < total && (trees < treeCap || shrubs < shrubCap); k++) {
      const i = (k * 9973) % total;
      const r = Math.floor(i / n);
      const c = i % n;
      if (r < 2 || c < 2 || r > n - 3 || c > n - 3) continue;
      if (dem.ocean[i] || dem.stream[i]) continue;
      if (beach[i] > 0.25) continue;
      const fu = fuelInit[i];
      if (fu < 0.28) continue;
      const e = dem.elev[i];
      if (e > 0.86) continue; // treeline
      const grove = clump(c * 0.11, r * 0.11);
      const p = Math.pow(fu, 1.4) * (0.12 + 0.88 * Math.pow(grove, 2.2));
      const roll = rng();
      if (trees < treeCap && roll < p * treeDensity * 0.55) {
        const s = 0.034 + rng() * 0.03;
        emitTree(i, (rng() - 0.5) * cellW, (rng() - 0.5) * cellW, s, rng());
        trees++;
      } else if (shrubs < shrubCap && roll < p * (treeDensity * 0.55 + shrubDensity * 0.5)) {
        const s = 0.014 + rng() * 0.012;
        emitShrub(i, (rng() - 0.5) * cellW, (rng() - 0.5) * cellW, s, rng());
        shrubs++;
      }
    }
  }

  // ---- buildings ----------------------------------------------------------
  const emitBuilding = (cell: number, w: number, d: number, h: number, rise: number, rot: number, rand: number) => {
    const ca = Math.cos(rot), sa = Math.sin(rot);
    const R = (x: number, z: number): [number, number] => [x * ca - z * sa, x * sa + z * ca];
    const P = (x: number, y: number, z: number): [number, number, number] => {
      const [rx, rz] = R(x, z);
      return [rx, y, rz];
    };
    // walls
    quad(P(-w, 0, -d), P(w, 0, -d), P(w, h, -d), P(-w, h, -d), cell, 3, rand);
    quad(P(w, 0, d), P(-w, 0, d), P(-w, h, d), P(w, h, d), cell, 3, rand);
    quad(P(-w, 0, d), P(-w, 0, -d), P(-w, h, -d), P(-w, h, d), cell, 3, rand);
    quad(P(w, 0, -d), P(w, 0, d), P(w, h, d), P(w, h, -d), cell, 3, rand);
    // gable ends + ridge roof with a small overhang
    tri(P(-w, h, -d), P(w, h, -d), P(0, h + rise, -d), cell, 3, rand);
    tri(P(w, h, d), P(-w, h, d), P(0, h + rise, d), cell, 3, rand);
    const ov = d * 1.18;
    quad(P(-w * 1.12, h - rise * 0.15, -ov), P(0, h + rise, -ov), P(0, h + rise, ov), P(-w * 1.12, h - rise * 0.15, ov), cell, 4, rand);
    quad(P(0, h + rise, -ov), P(w * 1.12, h - rise * 0.15, -ov), P(w * 1.12, h - rise * 0.15, ov), P(0, h + rise, ov), cell, 4, rand);
  };

  const buildable = (c: number, r: number) => {
    if (c < 2 || r < 2 || c > n - 3 || r > n - 3) return false;
    const i = cellIdx(c, r);
    if (dem.ocean[i] || dem.stream[i] || beach[i] > 0.45) return false;
    const sl = Math.abs(dem.elev[cellIdx(c + 1, r)] - dem.elev[cellIdx(c - 1, r)]) +
               Math.abs(dem.elev[cellIdx(c, r + 1)] - dem.elev[cellIdx(c, r - 1)]);
    return sl <= 0.02;
  };

  for (const st of cfg.settlements ?? []) {
    let placed = 0;
    if (st.grid) {
      // an urban district: aligned blocks on a jittered lattice, denser
      // toward the centre, buildings squared to the street grid
      const step = 3;
      const cells: [number, number][] = [];
      for (let gz = -st.spread; gz <= st.spread; gz += step) {
        for (let gx = -st.spread; gx <= st.spread; gx += step) {
          cells.push([st.x + gx, st.z + gz]);
        }
      }
      // centre-out so the cap trims the fringe, not the core
      cells.sort((a, b) =>
        Math.hypot(a[0] - st.x, a[1] - st.z) - Math.hypot(b[0] - st.x, b[1] - st.z));
      for (const [gc, gr] of cells) {
        if (placed >= st.count) break;
        const c = Math.round(gc + (rng() - 0.5) * 0.9);
        const r = Math.round(gr + (rng() - 0.5) * 0.9);
        if (!buildable(c, r)) continue;
        if (rng() < 0.14) continue; // vacant lots keep the grid human
        const i = cellIdx(c, r);
        const big = rng() < 0.22;
        const w = big ? 0.02 + rng() * 0.012 : 0.013 + rng() * 0.008;
        const d = big ? 0.014 + rng() * 0.008 : 0.009 + rng() * 0.006;
        const h = big ? 0.024 + rng() * 0.018 : 0.013 + rng() * 0.007;
        emitBuilding(i, w, d, h, 0.007 + rng() * 0.004,
          (rng() < 0.5 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.06, rng());
        placed++;
      }
    } else {
      let guard = 0;
      while (placed < st.count && guard++ < st.count * 30) {
        const c = Math.round(st.x + (rng() - 0.5) * 2 * st.spread);
        const r = Math.round(st.z + (rng() - 0.5) * 2 * st.spread);
        if (!buildable(c, r)) continue;
        const i = cellIdx(c, r);
        const w = 0.016 + rng() * 0.012;
        const d = 0.011 + rng() * 0.008;
        const h = 0.014 + rng() * 0.008;
        emitBuilding(i, w, d, h, 0.009 + rng() * 0.005, (rng() < 0.5 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.5, rng());
        placed++;
      }
    }
  }

  // ---- bridges ------------------------------------------------------------
  for (const br of cfg.bridges ?? []) {
    const ax = worldX(br.x0), az = worldZ(br.z0);
    const bx = worldX(br.x1), bz = worldZ(br.z1);
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.02) continue;
    const dirX = (bx - ax) / len, dirZ = (bz - az) / len;
    const sideX = -dirZ, sideZ = dirX;
    const deckH01 = Math.max(elevAtGrid(br.x0, br.z0), elevAtGrid(br.x1, br.z1)) + 0.014;
    const HW = 0.013; // deck half width
    const SEGS = Math.max(6, Math.round(len / 0.045));
    const rand = rng();

    const at = (t: number, side: number, y: number): [number, number, number] => [
      ax + dirX * len * t + sideX * side, y, az + dirZ * len * t + sideZ * side,
    ];
    const camber = (t: number) => Math.sin(Math.PI * t) * 0.006;

    for (let s2 = 0; s2 < SEGS; s2++) {
      const t0 = s2 / SEGS, t1 = (s2 + 1) / SEGS;
      const y0 = camber(t0), y1 = camber(t1);
      const A4: [number, number, number, number] = [deckH01, deckH01, deckH01, deckH01];
      // deck top
      quad(at(t0, -HW, y0), at(t1, -HW, y1), at(t1, HW, y1), at(t0, HW, y0), -1, 5, rand, A4);
      // deck sides
      quad(at(t0, -HW, y0 - 0.004), at(t1, -HW, y1 - 0.004), at(t1, -HW, y1), at(t0, -HW, y0), -1, 6, rand, A4);
      quad(at(t0, HW, y0), at(t1, HW, y1), at(t1, HW, y1 - 0.004), at(t0, HW, y0 - 0.004), -1, 6, rand, A4);
      // rails
      for (const sgn of [-1, 1]) {
        quad(
          at(t0, sgn * HW, y0), at(t1, sgn * HW, y1),
          at(t1, sgn * HW, y1 + 0.007), at(t0, sgn * HW, y0 + 0.007),
          -1, 6, rand, A4,
        );
      }
    }
    // piers wherever the deck rides clear of the ground
    const pierCount = Math.max(1, Math.round(len / 0.09));
    for (let p2 = 1; p2 <= pierCount; p2++) {
      const t = p2 / (pierCount + 1);
      const gc = br.x0 + (br.x1 - br.x0) * t;
      const gr = br.z0 + (br.z1 - br.z0) * t;
      const ground = elevAtGrid(gc, gr);
      if (deckH01 - ground < 0.01) continue;
      const px = ax + dirX * len * t, pz = az + dirZ * len * t;
      const pw = 0.005;
      // two crossed panels from ground to deck; anchors differ top vs bottom
      const g = ground - 0.006;
      quad(
        [px - pw, 0, pz], [px + pw, 0, pz], [px + pw, camber(t), pz], [px - pw, camber(t), pz],
        -1, 6, rand, [g, g, deckH01, deckH01],
      );
      quad(
        [px, 0, pz - pw], [px, 0, pz + pw], [px, camber(t), pz + pw], [px, camber(t), pz - pw],
        -1, 6, rand, [g, g, deckH01, deckH01],
      );
    }
  }

  return new Float32Array(out);
}

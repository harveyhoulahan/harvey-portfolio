/*
 * generate-worlds.mjs — procedural designed worlds for Catchment.
 *
 * Emits public/catchment/{gorge,terraces,pinnacles}.json in the DEM format
 * (n, bounds, elevMaxM, elev16/ocean/stream as base64) and upserts their
 * entries — including computed bridge spans and settlement sites — into
 * public/catchment/maps.json. Deterministic per world id.
 *
 *   node scripts/catchment/generate-worlds.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";

const N = 160;

// ---------------------------------------------------------------- utilities
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function makeNoise(seed) {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const grid = (x, y) => perm[(perm[x & 255] + (y & 255)) & 511] / 255;
  const smooth = (t) => t * t * (3 - 2 * t);
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = smooth(xf), v = smooth(yf);
    const a = grid(xi, yi), b = grid(xi + 1, yi);
    const c = grid(xi, yi + 1), d = grid(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, oct = 4) => {
    let v = 0, amp = 0.5, f = 1;
    for (let o = 0; o < oct; o++) { v += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
    return v;
  };
  return { rng, vnoise, fbm };
}

function b64(bytes) {
  return Buffer.from(bytes).toString("base64");
}
function encodeWorld({ elev, ocean, stream, bounds, elevMaxM }) {
  const e16 = new Uint8Array(N * N * 2);
  for (let i = 0; i < N * N; i++) {
    const v = Math.max(0, Math.min(65535, Math.round(elev[i] * 65535)));
    e16[i * 2] = v & 255;
    e16[i * 2 + 1] = v >> 8;
  }
  return { n: N, bounds, elevMaxM, elev16: b64(e16), ocean: b64(ocean), stream: b64(stream) };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

// ------------------------------------------------------------------- worlds

/** The Gorge: a high plateau split by a winding slot canyon that meets the
 * sea in the east. Two road bridges span the gap; the river runs the floor. */
function gorge() {
  const { fbm } = makeNoise(hashStr("gorge"));
  const elev = new Float32Array(N * N);
  const ocean = new Uint8Array(N * N);
  const stream = new Uint8Array(N * N);

  const zc = (x) => 80 + 26 * Math.sin(x * 0.045 + 1.2) + 12 * Math.sin(x * 0.013 + 4) + (fbm(x * 0.05, 7.7) - 0.5) * 10;
  const halfW = (x) => 6.5 + 2.2 * Math.sin(x * 0.08 + 2) + (fbm(x * 0.07, 3.1) - 0.5) * 3 + Math.max(0, x - 140) * 0.55;
  const floorAt = (x) => 0.05 + (159 - x) * 0.0009;

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      let e = 0.6 + (fbm(c * 0.022, r * 0.022) - 0.5) * 0.34 + (fbm(c * 0.09, r * 0.09, 3) - 0.5) * 0.07;
      // main canyon
      const d = Math.abs(r - zc(c));
      const t = d / Math.max(1, halfW(c));
      if (t < 1) {
        const wall = Math.pow(clamp(t, 0, 1), 3.0);
        e = Math.min(e, floorAt(c) + (e - floorAt(c)) * wall);
      }
      // a tributary slot from the north joins at x ~ 84
      const tzc = 24 + (84 - c) * -0.0 + (fbm(r * 0.06, 1.3) - 0.5) * 6;
      if (c > 60 && c < 96) {
        const dd = Math.abs(c - (84 + (r - 24) * 0.12 + (fbm(r * 0.05, 9.9) - 0.5) * 6));
        if (r < zc(c) && dd < 4.2) {
          const tt = dd / 4.2;
          const fl = floorAt(84) + (zc(c) - r) * 0.0012;
          e = Math.min(e, fl + (e - fl) * Math.pow(tt, 2.6));
        }
      }
      void tzc;
      // sea strip east
      if (c >= 154) { e = Math.min(e, 0.022); ocean[i] = 1; }
      elev[i] = clamp(e, 0.015, 1);
      if (!ocean[i] && d < 1.7) stream[i] = 1;
    }
  }
  // bridges: span the canyon rim-to-rim at two crossings
  const bridgeAt = (x) => {
    const w = halfW(x);
    return { x0: x, z0: Math.round(zc(x) - w - 3), x1: x, z1: Math.round(zc(x) + w + 3) };
  };
  return {
    world: encodeWorld({
      elev, ocean, stream, elevMaxM: 640,
      bounds: { west: 151.9, south: -29.62, east: 152.14, north: -29.38 },
    }),
    entry: {
      id: "gorge", file: "gorge.json", name: "The Gorge",
      tagline: "A river a hundred metres down.",
      rain: 6, wind: 120,
      props: { trees: 0.55, shrubs: 0.5, bridges: [bridgeAt(52), bridgeAt(108)] },
    },
  };
}

/** Terraces: a broad valley stepped into farmed benches that pond the rain,
 * a river down the middle and a hamlet at the mouth. */
function terraces() {
  const { fbm } = makeNoise(hashStr("terraces"));
  const elev = new Float32Array(N * N);
  const ocean = new Uint8Array(N * N);
  const stream = new Uint8Array(N * N);
  const STEPS = 15;
  const zr = (x) => 80 + 12 * Math.sin(x * 0.03 + 1) + (fbm(x * 0.04, 5.5) - 0.5) * 8;

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const dd = Math.hypot(c - 14, (r - 80) * 0.9);
      let e = clamp(0.88 - dd * 0.0058, 0.045, 0.88) + (fbm(c * 0.03, r * 0.03) - 0.5) * 0.1;
      // step the mid-slopes into benches; leave the summit ridge natural
      const benchness = smoothstep(0.7, 0.5, e) * smoothstep(0.05, 0.14, e);
      const q = Math.floor(e * STEPS) / STEPS;
      e = e * (1 - benchness) + (q + (e - q) * 0.12 + 0.004) * benchness;
      // river carve
      const d = Math.abs(r - zr(c));
      if (d < 2.1) { e = Math.min(e, 0.04 + (159 - c) * 0.0007); if (c < 152) stream[i] = 1; }
      if (c >= 152) { e = Math.min(e, 0.022); ocean[i] = 1; }
      elev[i] = clamp(e, 0.015, 1);
    }
  }
  const zm = Math.round(zr(120));
  return {
    world: encodeWorld({
      elev, ocean, stream, elevMaxM: 460,
      bounds: { west: 152.6, south: -28.98, east: 152.84, north: -28.74 },
    }),
    entry: {
      id: "terraces", file: "terraces.json", name: "Terraces",
      tagline: "Steps cut by patient hands.",
      rain: 8, wind: 60,
      props: {
        trees: 0.32, shrubs: 0.45,
        settlements: [{ x: 138, z: Math.round(zr(138)) + 9, count: 9, spread: 7 }],
        bridges: [{ x0: 120, z0: zm - 5, x1: 120, z1: zm + 5 }],
      },
    },
  };
}

/** The Pinnacles: karst towers over a lush lowland, a river threading
 * between them, a riverside hamlet and a timber crossing. */
function pinnacles() {
  const { rng, fbm } = makeNoise(hashStr("pinnacles"));
  const elev = new Float32Array(N * N);
  const ocean = new Uint8Array(N * N);
  const stream = new Uint8Array(N * N);
  const zr = (x) => 92 + 30 * Math.sin(x * 0.028 + 2.2) + (fbm(x * 0.05, 8.8) - 0.5) * 9;

  // poisson-ish tower field, kept off the river
  const towers = [];
  let guard = 0;
  while (towers.length < 34 && guard++ < 4000) {
    const cx = 10 + rng() * 138;
    const cz = 10 + rng() * 138;
    if (Math.abs(cz - zr(cx)) < 11) continue;
    if (cx > 146) continue;
    if (towers.some((t) => Math.hypot(t.cx - cx, t.cz - cz) < 9)) continue;
    towers.push({ cx, cz, h: 0.4 + rng() * 0.42, r: 2.6 + rng() * 2.3 });
  }

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      let e = 0.085 + (fbm(c * 0.045, r * 0.045) - 0.5) * 0.075;
      for (const t of towers) {
        const d = Math.hypot(c - t.cx, r - t.cz);
        e = Math.max(e, 0.085 + t.h * Math.exp(-Math.pow(d / t.r, 2.6)));
      }
      const d = Math.abs(r - zr(c));
      if (d < 2.3) { e = Math.min(e, 0.042 + (159 - c) * 0.0005); if (c < 153) stream[i] = 1; }
      if (c >= 153) { e = Math.min(e, 0.022); ocean[i] = 1; }
      elev[i] = clamp(e, 0.015, 1);
    }
  }
  const zb = Math.round(zr(96));
  return {
    world: encodeWorld({
      elev, ocean, stream, elevMaxM: 520,
      bounds: { west: 150.2, south: -30.42, east: 150.44, north: -30.18 },
    }),
    entry: {
      id: "pinnacles", file: "pinnacles.json", name: "The Pinnacles",
      tagline: "Towers the rain forgot to level.",
      rain: 5, wind: 200,
      props: {
        trees: 0.7, shrubs: 0.7,
        settlements: [{ x: 70, z: Math.round(zr(70)) + 10, count: 7, spread: 6 }],
        bridges: [{ x0: 96, z0: zb - 5, x1: 96, z1: zb + 5 }],
      },
    },
  };
}

/** Riverport: a channelised river meeting the sea through a gridded town.
 * Two districts of aligned blocks, road bridges stitching them together,
 * park groves inside the grid and hills standing back from the plain. */
function riverport() {
  const { fbm } = makeNoise(hashStr("riverport"));
  const elev = new Float32Array(N * N);
  const ocean = new Uint8Array(N * N);
  const stream = new Uint8Array(N * N);
  // an engineered river: gentle, almost-straight channel to the sea
  const zr = (x) => 82 + 6 * Math.sin(x * 0.02 + 1.5) + (fbm(x * 0.03, 4.4) - 0.5) * 3;

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      // coastal plain rising inland, hills pushed to the north-west
      let e = 0.05 + Math.max(0, 148 - c) * 0.0014 + (fbm(c * 0.035, r * 0.035) - 0.5) * 0.05;
      const hill = Math.max(0, 1 - Math.hypot(c - 26, r - 30) / 46);
      e += hill * hill * 0.34;
      const hill2 = Math.max(0, 1 - Math.hypot(c - 40, r - 138) / 38);
      e += hill2 * hill2 * 0.22;
      // flatten the town plain so the grid sits believably
      const town = Math.max(0, 1 - Math.hypot(c - 100, r - 82) / 42);
      e = e * (1 - town * 0.55) + 0.075 * town * 0.55;
      const d = Math.abs(r - zr(c));
      if (d < 2.4) { e = Math.min(e, 0.038 + (159 - c) * 0.0004); if (c < 150) stream[i] = 1; }
      if (c >= 150) { e = Math.min(e, 0.022); ocean[i] = 1; }
      elev[i] = clamp(e, 0.015, 1);
    }
  }
  const zb = (x) => Math.round(zr(x));
  return {
    world: encodeWorld({
      elev, ocean, stream, elevMaxM: 320,
      bounds: { west: 153.0, south: -28.4, east: 153.24, north: -28.16 },
    }),
    entry: {
      id: "riverport", file: "riverport.json", name: "Riverport",
      tagline: "A grid the river ignores.",
      rain: 5, wind: 100,
      props: {
        trees: 0.3, shrubs: 0.35,
        settlements: [
          { x: 100, z: 66, count: 46, spread: 17, grid: true },
          { x: 102, z: 98, count: 30, spread: 13, grid: true },
          { x: 56, z: 78, count: 7, spread: 7 },
        ],
        bridges: [
          { x0: 92, z0: zb(92) - 5, x1: 92, z1: zb(92) + 5 },
          { x0: 112, z0: zb(112) - 5, x1: 112, z1: zb(112) + 5 },
          { x0: 132, z0: zb(132) - 4, x1: 132, z1: zb(132) + 4 },
        ],
      },
    },
  };
}

/** The Vent: a lone stratovolcano island. Crater at the summit, radial
 * ravines running to the sea, forest on the lower flanks, one village
 * with its back to the mountain. */
function vent() {
  const { fbm } = makeNoise(hashStr("vent"));
  const elev = new Float32Array(N * N);
  const ocean = new Uint8Array(N * N);
  const stream = new Uint8Array(N * N);
  const CX = 80, CZ = 80;
  const ravines = [0.7, 2.4, 4.4]; // radial gully bearings

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const d = Math.hypot(c - CX, r - CZ);
      const ang = Math.atan2(r - CZ, c - CX);
      // the cone, with radial ribbing so the flanks read as lava-carved
      let e = 0.97 * Math.pow(Math.max(0, 1 - d / 64), 1.5);
      e *= 1 + (fbm(Math.cos(ang) * 3 + 5, Math.sin(ang) * 3 + 5) - 0.5) * 0.22 * smoothstep(4, 22, d);
      e += (fbm(c * 0.05, r * 0.05) - 0.5) * 0.04;
      // summit crater: a rim ring around a sunken bowl
      if (d < 8.5) {
        const bowl = 0.68 + Math.pow(d / 8.5, 2) * 0.2;
        e = Math.min(e, bowl);
        if (d < 5.5) e = Math.min(e, 0.66 + (fbm(c * 0.2, r * 0.2) - 0.5) * 0.03);
      }
      // radial ravines carved down to the shore
      for (const rv of ravines) {
        let da = Math.abs(ang - rv);
        da = Math.min(da, Math.PI * 2 - da);
        const wobble = (fbm(d * 0.08, rv * 9) - 0.5) * 0.16;
        if (Math.abs(da + wobble) < 0.07 && d > 7 && d < 66) {
          e = Math.min(e, e * 0.72);
          if (d > 9) stream[i] = 1;
        }
      }
      if (d > 66) { e = Math.min(e, 0.022); ocean[i] = 1; }
      elev[i] = clamp(e, 0.015, 1);
    }
  }
  // village on the eastern shore flat
  const vx = Math.round(CX + Math.cos(0.15) * 56);
  const vz = Math.round(CZ + Math.sin(0.15) * 56);
  return {
    world: encodeWorld({
      elev, ocean, stream, elevMaxM: 1150,
      bounds: { west: 155.5, south: -29.1, east: 155.74, north: -28.86 },
    }),
    entry: {
      id: "vent", file: "vent.json", name: "The Vent",
      tagline: "One mountain, still deciding.",
      rain: 4, wind: 160,
      props: {
        trees: 0.6, shrubs: 0.6,
        settlements: [{ x: vx, z: vz, count: 8, spread: 6 }],
      },
    },
  };
}

// ------------------------------------------------------------------ emit
const built = [gorge(), terraces(), pinnacles(), riverport(), vent()];
for (const b of built) {
  const path = `public/catchment/${b.entry.file}`;
  writeFileSync(path, JSON.stringify(b.world));
  console.log(`wrote ${path}`);
}

// upsert maps.json: new worlds before the secret entry; give every world props
const mapsPath = "public/catchment/maps.json";
const maps = JSON.parse(readFileSync(mapsPath, "utf8"));
const defaults = {
  hinterland: { trees: 0.5, shrubs: 0.55 },
  caldera: { trees: 0.4, shrubs: 0.5 },
  fjords: { trees: 0.35, shrubs: 0.4 },
  archipelago: { trees: 0.35, shrubs: 0.4 },
  olympus: { trees: 0, shrubs: 0 },
};
// delta retired in favour of the designed worlds
maps.maps = maps.maps.filter((m) => m.id !== "delta");
for (const m of maps.maps) {
  if (!m.props && defaults[m.id]) m.props = defaults[m.id];
}
for (const b of built) {
  const existing = maps.maps.findIndex((m) => m.id === b.entry.id);
  if (existing >= 0) maps.maps[existing] = b.entry;
  else {
    const secretIdx = maps.maps.findIndex((m) => m.secret);
    maps.maps.splice(secretIdx < 0 ? maps.maps.length : secretIdx, 0, b.entry);
  }
}
writeFileSync(mapsPath, JSON.stringify(maps, null, 1));
console.log(`updated ${mapsPath} (${maps.maps.length} worlds)`);

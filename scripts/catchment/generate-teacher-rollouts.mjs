#!/usr/bin/env node

/*
 * Generate reduced Catchment teacher rollouts for the M4 neural surrogate.
 *
 * This is intentionally dependency-free and CPU-side. It mirrors the live demo
 * at reduced resolution so we can create many training pairs without requiring
 * a browser or GPU readback loop. The browser export still provides real live
 * WebGPU frames; this script provides volume.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const rollouts = Number(args.rollouts ?? 12);
const steps = Number(args.steps ?? 96);
const stride = Number(args.stride ?? 4);
const horizon = Number(args.horizon ?? 4);
const seed0 = Number(args.seed ?? 1337);
const outPath = path.resolve(root, String(args.out ?? ".cache/catchment/teacher-rollouts.jsonl"));
const demPath = path.resolve(root, String(args.dem ?? "public/catchment/dem.json"));

const HSCALE = 80;

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function b64Bytes(b64) {
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

function decodeDem(raw) {
  const total = raw.n * raw.n;
  const eb = b64Bytes(raw.elev16);
  const elev = new Float32Array(total);
  for (let i = 0; i < total; i++) elev[i] = ((eb[i * 2 + 1] << 8) | eb[i * 2]) / 65535;
  return { ...raw, elev, ocean: b64Bytes(raw.ocean), stream: b64Bytes(raw.stream) };
}

function sample(field, n, r, c) {
  const rr = Math.max(0, Math.min(n - 1, r));
  const cc = Math.max(0, Math.min(n - 1, c));
  return field[rr * n + cc];
}

function downsampleDem(dem, stride) {
  const n = Math.ceil(dem.n / stride);
  const total = n * n;
  const bed = new Float32Array(total);
  const ocean = new Uint8Array(total);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const srcR = Math.min(dem.n - 1, r * stride);
      const srcC = Math.min(dem.n - 1, c * stride);
      const dst = r * n + c;
      const src = srcR * dem.n + srcC;
      bed[dst] = dem.elev[src] * HSCALE;
      ocean[dst] = dem.ocean[src];
    }
  }
  return { n, bed, ocean };
}

function initState(base, rand) {
  const total = base.n * base.n;
  const fuel = new Float32Array(total);
  for (let r = 0; r < base.n; r++) {
    for (let c = 0; c < base.n; c++) {
      const i = r * base.n + c;
      const gx = sample(base.bed, base.n, r, c + 1) - sample(base.bed, base.n, r, c - 1);
      const gz = sample(base.bed, base.n, r + 1, c) - sample(base.bed, base.n, r - 1, c);
      const slope = Math.min(1, Math.hypot(gx, gz) / HSCALE);
      fuel[i] = base.ocean[i] ? 0 : Math.max(0.04, 1 - slope * 0.65 + (rand() - 0.5) * 0.08);
    }
  }
  return {
    bed: new Float32Array(base.bed),
    water: new Float32Array(total),
    sediment: new Float32Array(total),
    fuel,
    fire: new Float32Array(total),
    char: new Float32Array(total),
  };
}

function makeForcing(rand, n) {
  const windDeg = rand() * Math.PI * 2;
  return {
    rain: 0.0015 + rand() * 0.012,
    stormX: rand() * (n - 1),
    stormZ: rand() * (n - 1),
    stormDx: (rand() - 0.5) * 0.32,
    stormDz: (rand() - 0.5) * 0.32,
    windX: Math.cos(windDeg),
    windZ: Math.sin(windDeg),
    windSpeed: 0.4 + rand() * 2.4,
    ignitionStep: 12 + Math.floor(rand() * 28),
    ignitionX: rand() * (n - 1),
    ignitionZ: rand() * (n - 1),
  };
}

function step(state, base, forcing, t) {
  const n = base.n;
  const total = n * n;
  const nextWater = new Float32Array(state.water);
  const nextSediment = new Float32Array(state.sediment);
  const nextFire = new Float32Array(state.fire);
  const nextFuel = new Float32Array(state.fuel);
  const nextChar = new Float32Array(state.char);
  const sx = forcing.stormX + forcing.stormDx * t;
  const sz = forcing.stormZ + forcing.stormDz * t;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (base.ocean[i]) {
        nextWater[i] = 0;
        nextSediment[i] = 0;
        nextFire[i] = 0;
        state.bed[i] = base.bed[i];
        continue;
      }

      const dx = c - sx;
      const dz = r - sz;
      const storm = Math.exp(-(dx * dx + dz * dz) / (2 * 7.5 * 7.5));
      nextWater[i] += forcing.rain * (0.25 + 2.8 * storm);

      const h = state.bed[i] + state.water[i];
      let bestJ = i;
      let bestDrop = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = Math.max(0, Math.min(n - 1, r + dr));
        const cc = Math.max(0, Math.min(n - 1, c + dc));
        const j = rr * n + cc;
        const drop = h - (state.bed[j] + state.water[j]);
        if (drop > bestDrop) {
          bestDrop = drop;
          bestJ = j;
        }
      }
      if (bestJ !== i) {
        const flow = Math.min(nextWater[i], bestDrop * 0.018 + nextWater[i] * 0.14);
        nextWater[i] -= flow;
        nextWater[bestJ] += flow;
        const capacity = Math.min(0.9, flow * bestDrop * 0.25);
        const diff = capacity - state.sediment[i];
        if (diff > 0) {
          const eroded = Math.min(state.bed[i], diff * 0.018);
          state.bed[i] -= eroded;
          nextSediment[bestJ] += state.sediment[i] + eroded;
        } else {
          const dep = -diff * 0.012;
          state.bed[i] += dep;
          nextSediment[bestJ] += Math.max(0, state.sediment[i] - dep);
        }
      }

      const wet = state.water[i] > 0.05;
      if (t === forcing.ignitionStep) {
        const ix = c - forcing.ignitionX;
        const iz = r - forcing.ignitionZ;
        if (ix * ix + iz * iz < 18 && state.fuel[i] > 0.12 && !wet) nextFire[i] = 1;
      }
      let heat = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const rr = Math.max(0, Math.min(n - 1, r + dr));
        const cc = Math.max(0, Math.min(n - 1, c + dc));
        const j = rr * n + cc;
        const len = Math.hypot(dc, dr) || 1;
        const dirX = -dc / len;
        const dirZ = -dr / len;
        const wind = Math.max(0, forcing.windX * dirX + forcing.windZ * dirZ);
        const uphill = Math.max(0, (state.bed[i] - state.bed[j]) / HSCALE);
        heat += state.fire[j] * (0.12 + wind * forcing.windSpeed * 0.22 + uphill * 1.8);
      }
      if (!wet && state.fuel[i] > 0.1 && heat > 0.42) nextFire[i] = Math.min(1, heat);
      if (wet) nextFire[i] = 0;
      if (nextFire[i] > 0.5) {
        nextFuel[i] = Math.max(0, state.fuel[i] - 0.045);
        nextChar[i] = Math.min(1, state.char[i] + 0.06);
        if (nextFuel[i] < 0.08) nextFire[i] = 0;
      } else {
        nextFuel[i] = Math.min(1, state.fuel[i] + 0.002 * (1 - state.char[i]));
        nextChar[i] = Math.max(0, state.char[i] - 0.0007);
      }
      nextWater[i] *= 0.998;
    }
  }

  state.water = nextWater;
  state.sediment = nextSediment;
  state.fire = nextFire;
  state.fuel = nextFuel;
  state.char = nextChar;
}

function pack(state, forcing) {
  const round = (field) => Array.from(field, (v) => +v.toFixed(5));
  return {
    bed: round(state.bed),
    water: round(state.water),
    sediment: round(state.sediment),
    fuel: round(state.fuel),
    fire: round(state.fire),
    char: round(state.char),
    forcings: {
      rain: +forcing.rain.toFixed(5),
      windX: +forcing.windX.toFixed(5),
      windZ: +forcing.windZ.toFixed(5),
      windSpeed: +forcing.windSpeed.toFixed(5),
    },
  };
}

const raw = JSON.parse(await readFile(demPath, "utf8"));
const dem = decodeDem(raw);
const base = downsampleDem(dem, stride);
const lines = [];

for (let rollout = 0; rollout < rollouts; rollout++) {
  const rand = mulberry32(seed0 + rollout * 101);
  const state = initState(base, rand);
  const forcing = makeForcing(rand, base.n);
  const history = [];
  for (let t = 0; t < steps + horizon; t++) {
    if (t >= horizon) {
      lines.push(JSON.stringify({
        rollout,
        t: t - horizon,
        grid: { n: base.n, hscale: HSCALE },
        input: history.shift(),
        target: pack(state, forcing),
      }));
    }
    history.push(pack(state, forcing));
    step(state, base, forcing, t);
  }
}

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${lines.join("\n")}\n`);
console.log(`wrote ${lines.length} samples (${base.n}x${base.n}) to ${outPath}`);

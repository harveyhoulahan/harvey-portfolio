/*
 * make-test-splat.mjs — synthetic .splat so the About-page viewer can be
 * exercised before a real portrait is trained. Writes a contour-banded hill
 * (on-brand stand-in) in the exact 32-byte layout of lib/splat/parse.ts /
 * ml/splat/build_splat.py.
 *
 *   node scripts/splat/make-test-splat.mjs            # → public/splat/portrait.splat
 *
 * ⚠ This is a placeholder for local dev only — do NOT commit the synthetic
 * portrait.splat; replace it with the trained one from build_splat.py.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = process.argv[2] ?? join(root, "public", "splat", "portrait.splat");

const rng = (() => { let s = 42; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); })();

const splats = [];
const hill = (x, z) =>
  0.55 * Math.exp(-(x * x + z * z) / 0.18) +
  0.10 * Math.exp(-((x - 0.45) ** 2 + (z + 0.3) ** 2) / 0.05) +
  0.02 * Math.sin(9 * x) * Math.cos(7 * z);

// terrain shell
for (let i = 0; i < 42000; i++) {
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * 0.8;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  const y = hill(x, z) - 0.28 + (rng() - 0.5) * 0.008;
  // contour banding in the site's teal ramp
  const band = Math.floor(((y + 0.28) / 0.6) * 9);
  const t = band / 9;
  const rC = 0.07 + 0.35 * t, gC = 0.28 + 0.45 * t, bC = 0.26 + 0.38 * t;
  const edge = Math.abs((((y + 0.28) / 0.6) * 9) % 1 - 0.5) < 0.06; // contour line
  splats.push({
    x, y, z,
    sx: 0.009 + rng() * 0.006, sy: 0.004 + rng() * 0.003, sz: 0.009 + rng() * 0.006,
    r: edge ? 0.93 : rC, g: edge ? 0.96 : gC, b: edge ? 0.94 : bC,
    a: 0.85,
  });
}
// summit benchmark (CIR red)
for (let i = 0; i < 400; i++) {
  const a = rng() * Math.PI * 2, r = rng() * 0.03;
  splats.push({
    x: Math.cos(a) * r, y: hill(0, 0) - 0.28 + 0.02 + rng() * 0.05, z: Math.sin(a) * r,
    sx: 0.008, sy: 0.014, sz: 0.008, r: 0.70, g: 0.23, b: 0.09, a: 0.95,
  });
}

const buf = Buffer.alloc(splats.length * 32);
splats.forEach((s, i) => {
  const o = i * 32;
  buf.writeFloatLE(s.x, o);
  buf.writeFloatLE(s.y, o + 4);
  buf.writeFloatLE(s.z, o + 8);
  buf.writeFloatLE(s.sx, o + 12);
  buf.writeFloatLE(s.sy, o + 16);
  buf.writeFloatLE(s.sz, o + 20);
  buf[o + 24] = Math.round(s.r * 255);
  buf[o + 25] = Math.round(s.g * 255);
  buf[o + 26] = Math.round(s.b * 255);
  buf[o + 27] = Math.round(s.a * 255);
  // identity quaternion (w,x,y,z) = (1,0,0,0)
  buf[o + 28] = 255;
  buf[o + 29] = 128;
  buf[o + 30] = 128;
  buf[o + 31] = 128;
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
writeFileSync(out.replace(/\.splat$/, ".json"), JSON.stringify({
  count: splats.length, bytes: buf.length, source: "synthetic-test-hill", date: new Date().toISOString().slice(0, 10),
}));
console.log(`wrote ${out} — ${splats.length.toLocaleString()} gaussians, ${(buf.length / 1e6).toFixed(1)} MB`);
console.log("⚠ synthetic placeholder: do not commit; replace with the trained portrait.");

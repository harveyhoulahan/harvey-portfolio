/*
 * Parity gate for the Catchment terminal intent model.
 *
 * Loads public/catchment/intent.json and runs it through the REAL TypeScript
 * inference path (lib/catchment/intent.ts, via Node's native type stripping),
 * checking every parity probe the numpy trainer embedded. If the JS featuriser
 * or hash ever drifts from the trainer, this fails — and so does the in-browser
 * decode, which runs the same gate.
 *
 * Usage: node scripts/verify-intent-parity.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodeIntentModel, classifyIntent } from "../lib/catchment/intent.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = JSON.parse(readFileSync(join(root, "public", "catchment", "intent.json"), "utf-8"));

const model = decodeIntentModel(raw);
if (!model) {
  console.error("FAIL: decodeIntentModel rejected the artefact (parity mismatch or bad shape).");
  process.exit(1);
}
console.log(`model ok: ${model.intents.length} intents · ${model.buckets} buckets · hidden ${model.hidden}`);

let failures = 0;
for (const probe of raw.parity) {
  const got = classifyIntent(model, probe.text);
  const pass = got.intent === probe.intent && Math.abs(got.confidence - probe.conf) <= 0.01;
  if (!pass) failures++;
  console.log(
    `${pass ? "  ok" : "FAIL"}  "${probe.text}" → ${got.intent} @ ${got.confidence.toFixed(4)}` +
    (pass ? "" : `  (trainer: ${probe.intent} @ ${probe.conf.toFixed(4)})`),
  );
}

// Off-distribution smoke probes: phrasings the trainer never saw verbatim.
// Loose asserts — the point is "reasonable", not "memorised".
const SMOKE = [
  ["absolutely drench the hills", "rain.up"],
  ["give me a massive thunderstorm", "storm.up"],
  ["way too windy, ease it off", "wind.down"],
  ["make everything peaceful again", "scene.calm"],
  ["hit the ridge with a giant asteroid", "mode.meteor"],
  ["let the neural net take over", "neural.on"],
];
console.log("\nsmoke probes (unseen phrasings):");
for (const [text, want] of SMOKE) {
  const got = classifyIntent(model, text);
  const pass = got.intent === want;
  if (!pass) failures++;
  console.log(`${pass ? "  ok" : "FAIL"}  "${text}" → ${got.intent} @ ${got.confidence.toFixed(3)}${pass ? "" : `  (wanted ${want})`}`);
}

if (failures) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
console.log("\nparity verified: numpy trainer ≡ TS inference.");

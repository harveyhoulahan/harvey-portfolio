/*
 * Parity gate for the site terminal intent model (v2).
 *
 * Loads public/catchment/intent-v2.json through the REAL TypeScript inference
 * path (lib/catchment/intent.ts, via Node's native type stripping) and checks
 * every parity probe the numpy trainer embedded — including the base64 int8
 * weight decode, which is the part most likely to drift.
 *
 * Usage: node scripts/verify-intent-v2-parity.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodeIntentModel, classifyIntent } from "../lib/catchment/intent.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = JSON.parse(readFileSync(join(root, "public", "catchment", "intent-v2.json"), "utf-8"));

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
  ["take me to the demos page", "nav.playground"],
  ["id like to read your cv", "harvey.resume"],
  ["whats the best way to email you", "harvey.email"],
  ["so who exactly built all this", "faq.who"],
  ["reckon you could tell us a joke", "joke.tell"],
  ["we want to hire you for a project", "hire.contact"],
  ["switch this site to dark mode", "site.theme_dark"],
  ["give me a massive thunderstorm", "storm.up"],
  ["hit the ridge with a giant asteroid", "mode.meteor"],
  ["book me a table for dinner", "none"],
];
console.log("\nsmoke probes (unseen phrasings):");
for (const [text, want] of SMOKE) {
  const got = classifyIntent(model, text);
  const pass = got.intent === want;
  if (!pass) failures++;
  console.log(`${pass ? "  ok" : "FAIL"}  "${text}" → ${got.intent} @ ${got.confidence.toFixed(3)}${pass ? "" : `  (wanted ${want})`}`);
}

// Egg precision: ordinary commands must never clear the egg threshold as eggs.
const EGG_NEGATIVES = ["help", "open catchment", "make it storm", "resume", "who are you"];
console.log("\negg negatives (must not fire as egg ≥ 0.7):");
for (const text of EGG_NEGATIVES) {
  const got = classifyIntent(model, text);
  const bad = got.intent.startsWith("egg.") && got.confidence >= (raw.eggThreshold ?? 0.7);
  if (bad) failures++;
  console.log(`${bad ? "FAIL" : "  ok"}  "${text}" → ${got.intent} @ ${got.confidence.toFixed(3)}`);
}

if (failures) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
console.log("\nparity verified: numpy trainer ≡ TS inference (v2, base64 int8).");

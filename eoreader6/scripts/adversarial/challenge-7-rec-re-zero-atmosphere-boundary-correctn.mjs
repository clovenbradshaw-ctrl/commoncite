// Adversarial test for CLAIM #7 — "REC re-zero (Atmosphere) boundary
// correctness": an Atmosphere is literally the span between two re-zero
// events, triggered by `tolerance` consecutive censored-above placements.
//
// Challenge: construct a source with a clean topic shift partway through
// (two genuinely unrelated real texts concatenated) and verify:
//   (POSITIVE) a re-zero event fires near the seam, AND
//   (NEGATIVE) it does NOT fire spuriously in the middle of a single
//              coherent passage that merely has local variance.
//
// We drive the CAUSAL form (`createRegimeTracker`), per the survey note and
// atmosphere.js's own header: only the causal form (ground and observation
// both strictly in the past) supports an honest "did it fire as the reader
// arrived at the seam" claim. `readAtmosphere` (batch, look-ahead) is legit
// only for offline segmentation of an already-fully-available document, not
// for this claim.
//
// Fixtures (real text, not synthetic):
//   - odyssey-greek.txt (repo root): Samuel Butler's English prose
//     translation of Homer's Odyssey. We use BOOK IX only — Odysseus's own
//     sustained first-person narration of the Cicones/Lotophagi/Cyclops
//     episode to the Phaeacians — a single continuous scene/register, not a
//     grab-bag of the whole poem's many books.
//   - scripts/adversarial/fixtures/cookery-22114-raw.txt: Project Gutenberg
//     #22114, "A Plain Cookery Book for the Working Classes" (Francatelli).
//     We use the recipe section (No. 1 "BOILED BEEF" onward), well past the
//     front-matter tea/cocoa advertisements, a single coherent topic
//     (recipes) throughout.
//
// These are about as topically unrelated as two 19th-century English prose
// texts get — an epic narrative of gods, ships and monsters vs. a Victorian
// working-class recipe book — while each individually stays on one subject
// throughout the excerpt used, which is exactly what the challenge's
// positive/negative pair needs.
//
// Reduction to a numeric series follows the run-instructions in the survey:
// tokenize -> chunkWords -> causalSurprisalSeries, chunking EACH SOURCE
// SEPARATELY before concatenation so the reduction itself has no
// seam-awareness (the causal frequency table only ever sees material at or
// before the position it is scoring).
//
// Declared numbers (window/draws/tolerance) are NOT invented for this test:
// they are copied verbatim from scripts/speak-from-here.mjs, the one script
// in this repo that already drives `createRegimeTracker` over real prose in
// production (window=6, draws=96, tolerance=2 there, called "the reach of
// the present, IN SENTENCES" — here it is chunks of 50 words, a comparable
// grain to a handful of sentences).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize, chunkWords, causalSurprisalSeries } from "../../packages/engine/perceiver/text/material.js";
import { createRegimeTracker, readAtmosphere } from "../../packages/engine/loops/atmosphere.js";
import { ground, difference, isGap, volume } from "../../nul/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const CHUNK = 50; // words per chunk, the grain fed to the numeric series
const WINDOW = 6; // atmosphere: reach of the present, copied from speak-from-here.mjs
const DRAWS = 96; // atmosphere: resolution of testimony, copied from speak-from-here.mjs
const TOLERANCE = 2; // atmosphere: resolution of refusal, copied from speak-from-here.mjs
// causalSurprisalSeries's own forgetting rate (material.js, 2026-08-05):
// gamma=1 (undecayed) drifts upward with position regardless of content —
// MEASURED, scripts/causal-surprisal-gamma-calibration.mjs — which alone
// produced this challenge's 3 remaining failures. gamma=0.999 is that
// script's calibrated operating point.
const GAMMA = 0.999;

let failures = 0;
let passes = 0;
const record = (ok, label) => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
  if (ok) passes++; else failures++;
};

console.log("=".repeat(78));
console.log("CHALLENGE #7 — REC re-zero (Atmosphere) boundary correctness");
console.log("=".repeat(78));

// ── Load and isolate the two coherent excerpts ──────────────────────────────
const odysseyPath = path.join(REPO_ROOT, "odyssey-greek.txt");
const cookeryPath = path.join(__dirname, "fixtures", "cookery-22114-raw.txt");
if (!fs.existsSync(odysseyPath)) { console.error(`missing fixture: ${odysseyPath}`); process.exit(1); }
if (!fs.existsSync(cookeryPath)) { console.error(`missing fixture: ${cookeryPath}`); process.exit(1); }

const odysseyLines = fs.readFileSync(odysseyPath, "utf8").split("\n");
const cookeryLines = fs.readFileSync(cookeryPath, "utf8").split("\n");

// BOOK IX: "BOOK IX" at line 3794 (1-indexed) through the line before "BOOK X"
// at line 4291 (1-indexed) -> 0-indexed slice [3793, 4290).
const bookIXText = odysseyLines.slice(3793, 4290).join("\n");
// Cookery recipes: "No. 1. BOILED BEEF." at line 266 (1-indexed) through
// recipe "No. 118" at line ~1876 -> 0-indexed slice [265, 1600), safely
// inside the recipe section and short of the book's closing appendix.
const cookeryText = cookeryLines.slice(265, 1600).join("\n");

const bookIXWords = tokenize(bookIXText);
const cookeryWords = tokenize(cookeryText);
console.log(`\nBook IX (Odyssey, narrative): ${bookIXWords.length} words`);
console.log(`  first words: ${bookIXWords.slice(0, 12).join(" ")}`);
console.log(`Cookery recipes (technical manual): ${cookeryWords.length} words`);
console.log(`  first words: ${cookeryWords.slice(0, 12).join(" ")}`);

const ixChunks = chunkWords(bookIXWords, CHUNK);
const crChunks = chunkWords(cookeryWords, CHUNK);
const ixSeries = causalSurprisalSeries(ixChunks, { gamma: GAMMA });
const crSeries = causalSurprisalSeries(crChunks, { gamma: GAMMA });

const seamIndex = ixChunks.length; // chunk index at which cookery begins
const combinedChunks = [...ixChunks, ...crChunks]; // chunked BEFORE concatenation
const combinedSeries = causalSurprisalSeries(combinedChunks, { gamma: GAMMA });

console.log(`\nBook IX chunks: ${ixChunks.length}, cookery chunks: ${crChunks.length}, combined: ${combinedChunks.length}`);
console.log(`seam (chunk index where cookery begins): ${seamIndex}`);
console.log(`declared: window=${WINDOW} draws=${DRAWS} tolerance=${TOLERANCE} chunkSize=${CHUNK} gamma=${GAMMA}`);

const runCausal = (series, seed) => {
  const tracker = createRegimeTracker({ window: WINDOW, draws: DRAWS, tolerance: TOLERANCE, seed });
  const rezeros = [];
  for (let i = 0; i < series.length; i++) {
    const step = tracker.push(series[i]);
    if (step.rezeroed) rezeros.push(i);
  }
  return rezeros;
};

// ── POSITIVE CASE: does a re-zero fire near the real seam? ─────────────────
console.log("\n" + "-".repeat(78));
console.log("POSITIVE CASE: Book IX -> Cookery, real topic-shift seam at chunk " + seamIndex);
console.log("-".repeat(78));

const SEEDS = [0, 1, 2, 3, 4, 12345, 999];
const positiveResults = SEEDS.map((seed) => {
  const rez = runCausal(combinedSeries, seed);
  const nearestToSeam = rez.length ? rez.reduce((b, r) => (Math.abs(r - seamIndex) < Math.abs(b - seamIndex) ? r : b)) : null;
  return { seed, rez, nearestToSeam };
});
for (const { seed, rez, nearestToSeam } of positiveResults) {
  console.log(`  seed=${seed}: rezeros=[${rez.join(",")}]  nearest-to-seam=${nearestToSeam}  distance=${nearestToSeam == null ? "n/a" : nearestToSeam - seamIndex}`);
}
// Margin: causal tracker needs `window` chunks to observe past the seam, and
// `tolerance` consecutive clearings before conceding — so a detection within
// window*tolerance*2 chunks of the seam (a generous, pre-declared margin) is
// "near the seam"; anything found here is real evidence one way or the other.
const MARGIN = WINDOW * TOLERANCE * 2;
const positiveHit = positiveResults.every(({ nearestToSeam }) => nearestToSeam != null && nearestToSeam >= seamIndex && nearestToSeam - seamIndex <= MARGIN);
record(positiveHit, `a re-zero fires within ${MARGIN} chunks after the seam, for every one of ${SEEDS.length} seeds tested`);

// ── NEGATIVE CASE 1: Book IX ALONE (no seam at all) ─────────────────────────
console.log("\n" + "-".repeat(78));
console.log("NEGATIVE CASE 1: Book IX alone — single coherent narrative, no real seam");
console.log("-".repeat(78));
const negIX = SEEDS.map((seed) => ({ seed, rez: runCausal(ixSeries, seed) }));
for (const { seed, rez } of negIX) console.log(`  seed=${seed}: rezeros=[${rez.join(",")}]`);
const negIXFired = negIX.some(({ rez }) => rez.length > 0);
record(!negIXFired, "no re-zero fires anywhere inside a single coherent 117-chunk narrative passage (Book IX alone)");

// ── NEGATIVE CASE 2: Cookery recipes ALONE (no seam at all) ─────────────────
console.log("\n" + "-".repeat(78));
console.log("NEGATIVE CASE 2: Cookery recipes alone — single coherent technical passage, no real seam");
console.log("-".repeat(78));
const negCR = SEEDS.map((seed) => ({ seed, rez: runCausal(crSeries, seed) }));
for (const { seed, rez } of negCR) console.log(`  seed=${seed}: rezeros=[${rez.join(",")}]`);
const negCRFired = negCR.some(({ rez }) => rez.length > 0);
record(!negCRFired, "no re-zero fires anywhere inside a single coherent 253-chunk recipe passage (cookery alone)");

// ── DIAGNOSTIC: is the spurious early re-zero content-driven, or a startup
// artifact of the minimum-viable-ground size? ───────────────────────────────
//
// `groundFrom` (both in readAtmosphere and createRegimeTracker) accepts a
// ground built from as few as `window + 2` elements. For the default
// `burstiness` statistic (max over `window`-sized sub-windows), window+2
// elements yields EXACTLY 3 candidate sub-window positions, independent of
// what `window` itself is. If that first-ever ground (or the ground rebuilt
// immediately after any prior re-zero) is systematically too narrow, both
// negative controls above should re-zero at THE SAME chunk indices despite
// having zero words of content in common — which is what we are about to
// check directly.
console.log("\n" + "-".repeat(78));
console.log("DIAGNOSTIC: are the negative-control re-zero positions content-independent?");
console.log("-".repeat(78));
const ixPositions = new Set(negIX[0].rez);
const crPositions = new Set(negCR[0].rez);
const sharedEarly = [...ixPositions].filter((i) => crPositions.has(i));
console.log(`  Book IX re-zero positions (seed=0): [${[...ixPositions].join(",")}]`);
console.log(`  Cookery  re-zero positions (seed=0): [${[...crPositions].join(",")}]`);
console.log(`  positions shared by BOTH unrelated texts: [${sharedEarly.join(",")}]`);
record(sharedEarly.length === 0, "the two unrelated coherent texts do NOT re-zero at the same chunk positions (if they do, the shared positions are evidence of a content-independent artifact, not real content detection)");

// Confirm seed-invariance of the earliest re-zero: if the tiny first ground
// (window+2 elements) is so narrow that ANY seed's shuffle draws land in the
// same place, that is direct evidence the null has essentially no width for
// this comparison, regardless of which random perturbations were sampled.
if (ixPositions.size > 0) {
  const firstIX = Math.min(...ixPositions);
  const seedInvariant = negIX.every(({ rez }) => rez.includes(firstIX));
  console.log(`  Book IX's earliest re-zero (chunk ${firstIX}) reproduced across ALL ${SEEDS.length} seeds tested: ${seedInvariant}`);
}

// Inspect the actual first ground directly: material, bootstrap sample
// range, and the observed value that cleared it. `10 * WINDOW` is
// atmosphere.js's current MIN_GROUND (raised from `3 * WINDOW` alongside
// causalSurprisalSeries's `gamma`, 2026-08-05 — see its header comment).
const MIN_GROUND = 10 * WINDOW;
const firstGroundMaterial = ixSeries.slice(0, MIN_GROUND);
console.log(`\n  first-ground material (${firstGroundMaterial.length} elements, the legal minimum 10*window=${MIN_GROUND}):`);
console.log(`    ${firstGroundMaterial.map((x) => Math.round(x)).join(", ")}`);
const g0 = ground({ material: firstGroundMaterial, draws: DRAWS, window: WINDOW, statistic: "burstiness", seed: 0 });
const g1 = ground({ material: firstGroundMaterial, draws: DRAWS, window: WINDOW, statistic: "burstiness", seed: 999 });
if (!isGap(g0) && !isGap(g1)) {
  console.log(`    seed=0   bootstrap sample range: [${Math.round(g0.samples[0])}, ${Math.round(g0.samples[g0.samples.length - 1])}]  volume=${volume(g0).toFixed(1)}`);
  console.log(`    seed=999 bootstrap sample range: [${Math.round(g1.samples[0])}, ${Math.round(g1.samples[g1.samples.length - 1])}]  volume=${volume(g1).toFixed(1)}`);
  const nextWindow = ixSeries.slice(MIN_GROUND, MIN_GROUND + WINDOW);
  const observedMean = nextWindow.reduce((a, b) => a + b, 0) / nextWindow.length;
  console.log(`    the very next real window's mean: ${Math.round(observedMean)} (vs. bootstrap top of ~${Math.round(g0.samples[g0.samples.length - 1])})`);
  const d0 = difference(observedMean, g0);
  const d1 = difference(observedMean, g1);
  console.log(`    difference() at seed=0:   ${isGap(d0) ? `GAP ${d0.gap} direction=${d0.direction}` : JSON.stringify(d0)}`);
  console.log(`    difference() at seed=999: ${isGap(d1) ? `GAP ${d1.gap} direction=${d1.direction}` : JSON.stringify(d1)}`);
}

// ── SUPPORTING CALIBRATION: does this reproduce on pure iid noise too? ─────
// (Confirms the artifact is not specific to these two texts' surprisal
// scale — it is a property of the tracker's ground-formation minimum size.)
console.log("\n" + "-".repeat(78));
console.log("SUPPORTING CALIBRATION: same window/draws/tolerance on iid noise, 20 seeds");
console.log("-".repeat(78));
const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
let noiseFireCount = 0;
let noiseEarlyFireCount = 0; // fired within the first 30 pushes specifically
const EARLY_CUTOFF = 30;
for (let s = 0; s < 20; s++) {
  const next = rng(s * 101 + 7);
  const series = Array.from({ length: 300 }, () => 5 + next());
  const rez = runCausal(series, s);
  if (rez.length > 0) noiseFireCount++;
  if (rez.some((r) => r < EARLY_CUTOFF)) noiseEarlyFireCount++;
}
console.log(`  iid noise (mean 5, unit-scale jitter), 20 seeds: re-zero fired at least once in ${noiseFireCount}/20 trials`);
console.log(`  of those, fired within the first ${EARLY_CUTOFF} pushes (i.e. at/near the very first viable ground) in ${noiseEarlyFireCount}/20 trials`);

// ── Sanity: readAtmosphere (batch/offline form) on the same concatenation,
// for context only — not the claim under test, but worth recording whether
// the same seam is found offline. ───────────────────────────────────────────
console.log("\n" + "-".repeat(78));
console.log("CONTEXT ONLY: readAtmosphere (batch/offline, look-ahead) on the same material");
console.log("-".repeat(78));
const batch = readAtmosphere({ material: combinedSeries, window: WINDOW, draws: DRAWS, tolerance: TOLERANCE, seed: 12345 });
if (!isGap(batch)) {
  const recEvents = batch.events.filter((e) => e.op === "REC").map((e) => e.at);
  console.log(`  readAtmosphere REC events at chunks: [${recEvents.join(",")}]  (seam at ${seamIndex})`);
} else {
  console.log(`  readAtmosphere gapped: ${batch.gap}`);
}

// ── Summary ──────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(78));
console.log(`SUMMARY: ${passes} passed, ${failures} failed`);
console.log("=".repeat(78));
process.exit(failures > 0 ? 1 : 0);

// eoreader6 · turn-fold-formation-min-ground-real-text-calibration —
// does the SAME content-dependent drift that forced atmosphere.js's
// MIN_GROUND from 3*window to 10*window (packages/engine/loops/atmosphere.js,
// scripts/causal-surprisal-gamma-calibration.mjs) also reach loops/turn.js's
// `buildAt`, emergence/fold.js's `fold()`, and formation/index.js's
// `collapse()` — which share the identical difference()-driven mechanism —
// or does loops/time.js's pattern()-only pathway (which never calls
// difference()) stay exempt as its own header already argues.
//
// Methodology copied from scripts/causal-surprisal-gamma-calibration.mjs and
// scripts/adversarial/challenge-7-rec-re-zero-atmosphere-boundary-correctn.mjs:
// Book IX (Odyssey) alone and a cookery-book excerpt alone are two REAL,
// single-topic, no-seam passages. A minimum-ground fix that is actually
// closing the drift artifact (not just the iid near-degenerate-null artifact
// 3*window already fixed) must drive the false-alarm rate on BOTH to zero
// without losing the ability to find a genuine seam or genuine surfeit.
//
// Run: node scripts/turn-fold-formation-min-ground-real-text-calibration.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize, chunkWords, causalSurprisalSeries } from "../packages/engine/perceiver/text/material.js";
import { ground, difference, pattern, isGap } from "../nul/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = __dirname.endsWith("scripts") ? path.resolve(__dirname, "..") : __dirname;

const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ── fixtures: the same two real, single-topic, no-seam excerpts challenge-7
// and its calibration script use, at the same calibrated gamma ─────────────
const odysseyLines = fs.readFileSync(path.join(REPO_ROOT, "odyssey-greek.txt"), "utf8").split("\n");
const cookeryLines = fs.readFileSync(path.join(REPO_ROOT, "scripts/adversarial/fixtures/cookery-22114-raw.txt"), "utf8").split("\n");
const bookIXText = odysseyLines.slice(3793, 4290).join("\n");
const cookeryText = cookeryLines.slice(265, 1600).join("\n");
const CHUNK = 50;
const GAMMA = 0.999; // challenge-7's calibrated operating point
const ixChunks = chunkWords(tokenize(bookIXText), CHUNK);
const crChunks = chunkWords(tokenize(cookeryText), CHUNK);
const ixSeries = causalSurprisalSeries(ixChunks, { gamma: GAMMA });
const crSeries = causalSurprisalSeries(crChunks, { gamma: GAMMA });
const seamIndex = ixChunks.length;
const combinedSeries = causalSurprisalSeries([...ixChunks, ...crChunks], { gamma: GAMMA });

const PARAM_SETS = [
  { window: 5, draws: 256, tolerance: 3 },
  { window: 6, draws: 96, tolerance: 2 },
];
const MULTS = [3, 6, 8, 9, 10, 12, 14, 16];
const SEEDS = Array.from({ length: 20 }, (_, i) => i);

console.log("=".repeat(78));
console.log(`Book IX: ${ixChunks.length} chunks, Cookery: ${crChunks.length} chunks, seam at ${seamIndex}, gamma=${GAMMA}`);
console.log("=".repeat(78));

// ── 1. turn.js's buildAt+surfeit, real text ─────────────────────────────────
// Reimplements ONLY runTurn's clearOn:["surfeit"] pathway, parametrized by
// minMult, around the real ground/difference primitives — same convention
// causal-surprisal-gamma-calibration.mjs uses for atmosphere.js's groundFrom.
console.log("\n" + "=".repeat(78));
console.log("1. loops/turn.js buildAt+surfeit — real-text negative controls + positive seam");
console.log("=".repeat(78));
const runTurnSurfeit = (material, seed, { window, draws, tolerance }, minMult) => {
  let regionStart = 0, g = null, clearings = 0;
  const buildAt = (start, end) => {
    if (end - start < minMult * window) return null;
    const built = ground({ material: material.slice(start, end), draws, window, seed: seed + start });
    return isGap(built) ? null : built;
  };
  const rez = [];
  for (let i = window; i + window <= material.length; i++) {
    if (!g) { g = buildAt(regionStart, i); if (!g) continue; }
    let sum = 0;
    for (let j = i; j < i + window; j++) sum += material[j];
    const observed = sum / window;
    const d = difference(observed, g);
    const failure = isGap(d) && d.gap === "exceeds_witness" && d.direction === "above";
    const maintained = buildAt(regionStart, i);
    if (failure) {
      clearings++;
      if (clearings >= tolerance) { regionStart = i; g = null; clearings = 0; rez.push(i); }
    } else {
      clearings = 0;
      if (maintained) g = maintained;
    }
  }
  return rez;
};

const MARGIN_OF = ({ window, tolerance }) => window * tolerance * 2;
for (const spec of PARAM_SETS) {
  console.log(`\n-- window=${spec.window} draws=${spec.draws} tolerance=${spec.tolerance} --`);
  for (const minMult of MULTS) {
    const ixFire = SEEDS.filter((s) => runTurnSurfeit(ixSeries, s, spec, minMult).length > 0).length;
    const crFire = SEEDS.filter((s) => runTurnSurfeit(crSeries, s, spec, minMult).length > 0).length;
    const margin = MARGIN_OF(spec);
    const posHit = SEEDS.filter((s) => {
      const r = runTurnSurfeit(combinedSeries, s, spec, minMult);
      if (!r.length) return false;
      const nearest = r.reduce((b, x) => (Math.abs(x - seamIndex) < Math.abs(b - seamIndex) ? x : b));
      return nearest >= seamIndex && nearest - seamIndex <= margin;
    }).length;
    const allPass = ixFire === 0 && crFire === 0 && posHit === SEEDS.length;
    console.log(`  minMult=${minMult}: negIX=${ixFire}/20 negCR=${crFire}/20 posHit=${posHit}/20 ${allPass ? "<<< PASS" : ""}`);
  }
}

// ── 2. fold.js's fold(), real text ──────────────────────────────────────────
// Mirrors conformance/fold.test.js's own CALIBRATION check: the first
// post-ground row, `at = here`. Swept across MULTIPLE standpoints, not just
// the floor, because fold's drift concern (unlike the iid near-degenerate-
// null concern) is about content compounding forward, which a single
// standpoint near the floor would not reveal.
console.log("\n" + "=".repeat(78));
console.log("2. emergence/fold.js fold() — real-text negative controls (first post-ground row)");
console.log("=".repeat(78));
const foldFirstRowBeyond = (series, here, window, draws, seed) => {
  if (here + window > series.length) return null;
  const g = ground({ material: series.slice(0, here), draws, window, seed });
  if (isGap(g)) return null;
  let sum = 0;
  for (let j = here; j < here + window; j++) sum += series[j];
  const observed = sum / window;
  const d = difference(observed, g);
  return isGap(d) && d.gap === "exceeds_witness" && d.direction === "above";
};
for (const { window, draws } of PARAM_SETS) {
  console.log(`\n-- window=${window} draws=${draws} --`);
  for (const minMult of MULTS) {
    const floorHere = minMult * window;
    // sample several standpoints spread through each document, not only the floor
    const stepsIX = [floorHere, Math.floor(ixSeries.length * 0.3), Math.floor(ixSeries.length * 0.6), Math.floor(ixSeries.length * 0.85)]
      .filter((h) => h >= floorHere && h + window <= ixSeries.length);
    const stepsCR = [floorHere, Math.floor(crSeries.length * 0.3), Math.floor(crSeries.length * 0.6), Math.floor(crSeries.length * 0.85)]
      .filter((h) => h >= floorHere && h + window <= crSeries.length);
    let ixBeyond = 0, ixTotal = 0, crBeyond = 0, crTotal = 0;
    for (const s of SEEDS) {
      for (const h of stepsIX) { const r = foldFirstRowBeyond(ixSeries, h, window, draws, s); if (r != null) { ixTotal++; if (r) ixBeyond++; } }
      for (const h of stepsCR) { const r = foldFirstRowBeyond(crSeries, h, window, draws, s); if (r != null) { crTotal++; if (r) crBeyond++; } }
    }
    console.log(`  minMult=${minMult}: IX beyond=${ixBeyond}/${ixTotal} (${(100 * ixBeyond / ixTotal).toFixed(1)}%)  CR beyond=${crBeyond}/${crTotal} (${(100 * crBeyond / crTotal).toFixed(1)}%)`);
  }
}

// ── 3. formation/index.js's collapse(), real text ───────────────────────────
// Mirrors conformance/formation.test.js's own CALIBRATION check: collapse an
// ordinary next-window mean against a ground derived just behind it.
console.log("\n" + "=".repeat(78));
console.log("3. formation/index.js collapse() — real-text negative controls");
console.log("=".repeat(78));
const collapseAbove = (series, start, window, draws, seed) => {
  const end = start + window;
  if (end > series.length) return null;
  const g = ground({ material: series.slice(0, start), draws, window, seed });
  if (isGap(g)) return null;
  let sum = 0;
  for (let j = start; j < end; j++) sum += series[j];
  const observed = sum / window;
  const d = difference(observed, g);
  return isGap(d) && d.gap === "exceeds_witness" && d.direction === "above";
};
for (const { window, draws } of PARAM_SETS) {
  console.log(`\n-- window=${window} draws=${draws} --`);
  for (const minMult of MULTS) {
    const floorStart = minMult * window;
    const startsIX = [floorStart, Math.floor(ixSeries.length * 0.3), Math.floor(ixSeries.length * 0.6), Math.floor(ixSeries.length * 0.85)]
      .filter((h) => h >= floorStart && h + window <= ixSeries.length);
    const startsCR = [floorStart, Math.floor(crSeries.length * 0.3), Math.floor(crSeries.length * 0.6), Math.floor(crSeries.length * 0.85)]
      .filter((h) => h >= floorStart && h + window <= crSeries.length);
    let ixAbove = 0, ixTotal = 0, crAbove = 0, crTotal = 0;
    for (const s of SEEDS) {
      for (const st of startsIX) { const r = collapseAbove(ixSeries, st, window, draws, s); if (r != null) { ixTotal++; if (r) ixAbove++; } }
      for (const st of startsCR) { const r = collapseAbove(crSeries, st, window, draws, s); if (r != null) { crTotal++; if (r) crAbove++; } }
    }
    console.log(`  minMult=${minMult}: IX above=${ixAbove}/${ixTotal} (${(100 * ixAbove / ixTotal).toFixed(1)}%)  CR above=${crAbove}/${crTotal} (${(100 * crAbove / crTotal).toFixed(1)}%)`);
  }
}

// ── 4. time.js's pattern()-only pathway, real text ──────────────────────────
// time.js never calls difference() — its only use of a ground is pattern(),
// comparing THIS pass's ground to the PREVIOUS pass's. Feed it the same
// drift-laden real-text series directly (bypassing text/material.js's own
// reduce(), which does NOT reproduce causalSurprisalSeries's incremental
// drift — see below) to test the mechanism itself, not just today's callers.
console.log("\n" + "=".repeat(78));
console.log("4. loops/time.js pattern()-only pathway — real-text, fed causal-surprisal series directly");
console.log("=".repeat(78));
const movedOn = (series, growTo, window, draws, reseeds, seed, minMult) => {
  if (growTo < minMult * window) return null;
  const prevMaterial = series.slice(0, growTo - window);
  const material = series.slice(0, growTo);
  if (prevMaterial.length < minMult * window) return null;
  const before = ground({ material: prevMaterial, draws, window, seed });
  const after = ground({ material, draws, window, seed: seed + draws });
  if (isGap(before) || isGap(after)) return null;
  const p = pattern({ before, after, material: prevMaterial, reseeds });
  return isGap(p) ? null : p.moved;
};
const RESEEDS = 16;
for (const { window, draws } of PARAM_SETS) {
  console.log(`\n-- window=${window} draws=${draws} reseeds=${RESEEDS} --`);
  for (const minMult of MULTS) {
    const stepsIX = [Math.floor(ixSeries.length * 0.3), Math.floor(ixSeries.length * 0.5), Math.floor(ixSeries.length * 0.7), Math.floor(ixSeries.length * 0.9)];
    const stepsCR = [Math.floor(crSeries.length * 0.3), Math.floor(crSeries.length * 0.5), Math.floor(crSeries.length * 0.7), Math.floor(crSeries.length * 0.9)];
    let ixMoved = 0, ixTotal = 0, crMoved = 0, crTotal = 0;
    for (const s of SEEDS) {
      for (const g of stepsIX) { const r = movedOn(ixSeries, g, window, draws, RESEEDS, s, minMult); if (r != null) { ixTotal++; if (r) ixMoved++; } }
      for (const g of stepsCR) { const r = movedOn(crSeries, g, window, draws, RESEEDS, s, minMult); if (r != null) { crTotal++; if (r) crMoved++; } }
    }
    console.log(`  minMult=${minMult}: IX moved=${ixMoved}/${ixTotal} (${ixTotal ? (100 * ixMoved / ixTotal).toFixed(1) : "n/a"}%)  CR moved=${crMoved}/${crTotal} (${crTotal ? (100 * crMoved / crTotal).toFixed(1) : "n/a"}%)`);
  }
}

console.log("\n" + "=".repeat(78));
console.log("DONE");
console.log("=".repeat(78));

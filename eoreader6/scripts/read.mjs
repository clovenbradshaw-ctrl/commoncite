// eoreader6 · read — the three systems running together, recursively.
//
//   PYTHAGORAS  existence, generative: dot -> line -> surface. Blind
//               recurrence detection (no name, no prior) over reader-
//               relative causal surprisal — a thing comes into being the
//               moment a shape repeats. His own crisis (irrationality,
//               discovered from his own axioms) is honored here rather than
//               suppressed: an observation that exceeds the reader's own
//               witness range triggers reZero, not denial.
//   PLATO       structure, geometric: holon_level's existence-dependency +
//               possibility-constraint. Does this candidate behave as a
//               bounded, dependent thing relative to the rest? This is the
//               one SEED.md admits is least earned, and the one that kept
//               blocking every attempt at the layer above it tonight.
//   RAMAKRISHNA significance, recursive: a claim that can move (contested
//               -> settled), and — the actual fold, run more than once for
//               the first time this session — a settled claim at one level
//               becomes received existence for the next.
//
// This does not claim to read a novel. It claims to run the three systems
// together, honestly, and report exactly what folds and what doesn't.

import { readFileSync } from "node:fs";
import { findRecurringMotifs } from "../packages/engine/referents/blind.js";
import { tokenize, chunkWords, causalSurprisalSeries } from "../packages/engine/perceiver/text/material.js";
import { ground, isGap } from "../nul/index.js";
import { levelStep, promote } from "../packages/engine/loops/level.js";

const WINDOW_SIZE = 6;
const READER_WINDOW = 8;
const BIN_SIZE = 20; // level-1 grain: chunks per coarse bin

const runLevel0 = (series) => {
  const motifResult = findRecurringMotifs(series, { windowSize: WINDOW_SIZE, hop: 1, similarityThreshold: 0.2, minOccurrences: 4 });
  const results = [];

  for (const motif of motifResult.motifs) {
    for (const occ of motif.occurrences) {
      if (occ < READER_WINDOW + 2) continue; // Pythagoras: no claim before enough has come into being to compare against
      const history = series.slice(0, occ);
      const readerGround = ground({ material: history, draws: 150, window: READER_WINDOW, seed: 11 });
      if (isGap(readerGround)) continue;

      const regime = { start: occ, end: Math.min(series.length, occ + WINDOW_SIZE) };
      if (regime.end - regime.start < 2) continue;

      const step = levelStep({ series, regime, readerGround, existenceCount: motif.count, structureOptions: { draws: 40, window: 4, reseeds: 10 } });
      results.push(step);
    }
  }
  return { motifsFound: motifResult.motifs.length, results };
};

// Level 1: promote settled level-0 claims into a coarser existence series
// (density of settled events per bin) and run the SAME structure +
// significance test on THAT — surprise folding onto its own output.
const runLevel1 = (level0Results, seriesLength) => {
  const settled = level0Results.filter((r) => r.settled);
  if (settled.length === 0) return { settledCount: 0, results: [] };

  const bins = Math.ceil(seriesLength / BIN_SIZE);
  const density = new Array(bins).fill(0);
  for (const r of settled) density[Math.floor(r.regime.start / BIN_SIZE)]++;

  // candidate level-1 regimes: bins with any settled density, widened by one
  // bin on each side so existenceDependencyTest has room to work
  const results = [];
  const densityGround = ground({ material: density, draws: 60, window: 3, seed: 5 });
  for (let b = 0; b < bins; b++) {
    if (density[b] === 0) continue;
    const regime = { start: Math.max(0, b - 1), end: Math.min(bins, b + 2) };
    if (regime.end - regime.start < 2) continue;
    const step = levelStep({
      series: density, regime, readerGround: isGap(densityGround) ? null : densityGround,
      existenceCount: density[b], structureOptions: { draws: 30, window: 2, reseeds: 8 },
    });
    results.push(step);
  }
  return { settledCount: settled.length, bins, density, results };
};

const TEXT_PATH = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const text = readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const words = tokenize(text);
const chunks = chunkWords(words, 40);
const series = causalSurprisalSeries(chunks);

console.error(`=== reading ${TEXT_PATH} (${chunks.length} chunks) ===\n`);

console.error("--- LEVEL 0 (Pythagoras: existence, Plato: structure, Ramakrishna: significance) ---");
const level0 = runLevel0(series);
const structCounts0 = {};
for (const r of level0.results) structCounts0[r.structure] = (structCounts0[r.structure] || 0) + 1;
console.error(`motifs found: ${level0.motifsFound}, regimes tested: ${level0.results.length}`);
console.error(`structure: ${JSON.stringify(structCounts0)}`);
console.error(`settled: ${level0.results.filter((r) => r.settled).length}`);
for (const r of level0.results.filter((r) => r.settled)) {
  console.error(`  SETTLED at chunk ${r.regime.start} (${((r.regime.start / chunks.length) * 100).toFixed(1)}% through): significance=${r.significance.toFixed(3)}`);
}

console.error("\n--- LEVEL 1 (promoted from level 0's settled claims) ---");
const level1 = runLevel1(level0.results, series.length);
if (level1.settledCount === 0) {
  console.error("no level-0 claims settled — nothing to promote, level 1 has no existence to work from");
} else {
  const structCounts1 = {};
  for (const r of level1.results) structCounts1[r.structure] = (structCounts1[r.structure] || 0) + 1;
  console.error(`promoted from level 0: ${level1.settledCount}`);
  console.error(`level-1 structure: ${JSON.stringify(structCounts1)}`);
  console.error(`level-1 settled: ${level1.results.filter((r) => r.settled).length}`);
  for (const r of level1.results.filter((r) => r.settled)) {
    console.error(`  LEVEL-1 SETTLED at bin ${r.regime.start} (chunks ${r.regime.start * BIN_SIZE}-${r.regime.end * BIN_SIZE}): significance=${r.significance.toFixed(3)}`);
  }
}

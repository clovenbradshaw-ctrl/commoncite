// eoreader6 · span-golden-holon — a second, structurally different
// significance detector (existence-dependency + possibility-constraint over
// sliding regimes, not rank/censoring of a single ground) scored against the
// same frozen golden as span-golden-run.mjs, PLUS a Monte Carlo chance
// baseline for every candidate set — including a stand-in baseline for
// eoreader5's own 12-span-per-entity budget, since nothing in that golden's
// own scorer establishes whether 5/21 clears chance.

import { readFileSync } from "node:fs";
import { existenceDependencyTest, possibilityConstraintTest, holonLevelRelation } from "../holon_level/index.js";
import { buildFrequencyTable, surprisalMicrobits, tokenize } from "../packages/engine/perceiver/text/material.js";

const GOLDEN_PATH = "/Users/mlacy/Documents/Default Project/eoreader5/packages/engine/emergence/summary/golden/span-golden.json";
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
const TEXTS = {
  pg2600: "/Users/mlacy/Downloads/pg2600.txt",
  pg84: "scripts/adversarial/fixtures/pg84-frankenstein.txt",
};
const BLOCK_CHARS = 2000;
const REGIME_LEN = 3; // ~6000 chars per candidate regime — same order as golden tolerance
const STEP = 2;

const blockify = (text, blockChars) => {
  const blocks = [];
  for (let i = 0; i < text.length; i += blockChars) blocks.push({ start: i, text: text.slice(i, i + blockChars) });
  return blocks;
};

const holonCandidates = (text) => {
  const blocks = blockify(text, BLOCK_CHARS);
  const table = buildFrequencyTable(tokenize(text));
  const series = blocks.map((b) => surprisalMicrobits(b.text, table));

  const offsets = [];
  for (let i = 0; i + REGIME_LEN <= series.length; i += STEP) {
    const regime = { start: i, end: i + REGIME_LEN };
    const ex = existenceDependencyTest(series, regime, { draws: 32, window: 5, reseeds: 8 });
    const co = possibilityConstraintTest(series, regime, { reseeds: 8 });
    if (holonLevelRelation(ex, co) === "above") offsets.push(blocks[i].start);
  }
  return { offsets, blockCount: blocks.length };
};

const scoreOffsets = (text, offsets, scenes) => {
  let hits = 0;
  for (const sc of scenes) {
    const at = text.indexOf(sc.anchor);
    if (at !== -1 && offsets.some((o) => Math.abs(o - at) <= GOLDEN.tolerance)) hits++;
  }
  return hits;
};

// Chance baseline: N trials of `count` uniformly-random block offsets,
// scored the same way. Reports the empirical distribution so a raw hit
// count can be read against "what chance alone would produce" instead of
// read in isolation.
const chanceBaseline = (text, blockCount, count, scenes, trials = 2000) => {
  const counts = [];
  for (let t = 0; t < trials; t++) {
    const offs = [];
    for (let i = 0; i < count; i++) offs.push(Math.floor(Math.random() * blockCount) * BLOCK_CHARS);
    counts.push(scoreOffsets(text, offs, scenes));
  }
  counts.sort((a, b) => a - b);
  const mean = counts.reduce((s, v) => s + v, 0) / counts.length;
  const p95 = counts[Math.floor(counts.length * 0.95)];
  return { mean, p95, max: counts[counts.length - 1] };
};

const cache = {};
let totalHit = 0, totalScenes = 0;
console.log("=== holon_level detector (existence-dependency + possibility-constraint, sliding regimes) ===");
for (const e of GOLDEN.entities) {
  const text = readFileSync(TEXTS[e.text], "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!cache[e.text]) cache[e.text] = holonCandidates(text);
  const { offsets, blockCount } = cache[e.text];
  const hits = scoreOffsets(text, offsets, e.scenes);
  totalHit += hits; totalScenes += e.scenes.length;

  const chance = chanceBaseline(text, blockCount, offsets.length, e.scenes);
  const eoreader5Chance = chanceBaseline(text, blockCount, 12, e.scenes); // eoreader5's actual budget

  console.log(`\n${e.entity}: ${hits}/${e.scenes.length} hits (${offsets.length} candidate regimes flagged, ${blockCount} total blocks)`);
  console.log(`  chance baseline at same candidate count (${offsets.length}): mean=${chance.mean.toFixed(2)} p95=${chance.p95} max=${chance.max} / ${e.scenes.length}`);
  console.log(`  chance baseline at eoreader5's budget (12): mean=${eoreader5Chance.mean.toFixed(2)} p95=${eoreader5Chance.p95} max=${eoreader5Chance.max} / ${e.scenes.length}`);
}
console.log(`\nTOTAL (holon_level method): ${totalHit}/${totalScenes}`);
console.log(`eoreader5 baseline: 5/21   eoreader6 rank/censoring method: 0-1/21 (see span-golden-run.mjs)`);

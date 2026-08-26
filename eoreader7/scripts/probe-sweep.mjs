import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize, chunkWords, causalSurprisalSeries } from "../packages/engine/perceiver/text/material.js";
import { readLevel0 } from "../packages/engine/loops/read-level0.js";
import { levelStep } from "../packages/engine/loops/level.js";
import { ground, isGap } from "../nul/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const frankenstein = readFileSync(join(ROOT, "scripts/adversarial/fixtures/pg84-frankenstein.txt"), "utf8").replace(/\r\n/g, "\n");

const BIN_SIZE = 20;
const scan = (text) => {
  const words = tokenize(text);
  const chunks = chunkWords(words, 40);
  const series = causalSurprisalSeries(chunks);
  const level0 = readLevel0(series);
  const settled = level0.results.filter((r) => r.settled);
  if (settled.length < 3) return [];
  const bins = Math.ceil(series.length / BIN_SIZE);
  const density = new Array(bins).fill(0);
  for (const r of settled) density[Math.floor(r.regime.start / BIN_SIZE)]++;
  const densityGround = ground({ material: density, draws: 60, window: 3, seed: 5 });
  const dg = isGap(densityGround);
  const out = [];
  for (let b = 0; b < bins; b++) {
    if (density[b] === 0) continue;
    const regime = { start: Math.max(0, b - 1), end: Math.min(bins, b + 2) };
    if (regime.end - regime.start < 2) continue;
    const step = levelStep({ series: density, regime, readerGround: dg ? null : densityGround, existenceCount: density[b], structureOptions: { draws: 30, window: 2, reseeds: 8 } });
    if (step.settled) out.push({ b, structure: step.structure, sig: step.significance, regime });
  }
  return out;
};

let found = 0;
const LENS = [100000, 150000, 200000, 250000, 300000, 350000];
const STEPS = [5000, 10000];
for (const len of LENS) {
  const step = len <= 200000 ? STEPS[0] : STEPS[1];
  for (let s = 0; s + len <= frankenstein.length; s += step) {
    const r = scan(frankenstein.slice(s, s + len));
    if (r.length > 0) { console.log(`len=${len} start=${s} ${JSON.stringify(r)}`); found += r.length; }
  }
}
console.log("total settled level-1 candidates with DEFAULT params:", found);

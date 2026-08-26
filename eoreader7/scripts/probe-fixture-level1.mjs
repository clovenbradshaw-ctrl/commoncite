import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize, chunkWords, causalSurprisalSeries } from "../packages/engine/perceiver/text/material.js";
import { readLevel0 } from "../packages/engine/loops/read-level0.js";
import { levelStep } from "../packages/engine/loops/level.js";
import { existenceDependencyTest, possibilityConstraintTest } from "../holon_level/index.js";
import { ground, isGap } from "../nul/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = join(ROOT, "scripts/adversarial/fixtures/pg84-frankenstein.txt");
const text = readFileSync(FIX, "utf8").replace(/\r\n/g, "\n").slice(0, 260000);

const words = tokenize(text);
const chunks = chunkWords(words, 40);
const series = causalSurprisalSeries(chunks);
const level0 = readLevel0(series);
const settled = level0.results.filter((r) => r.settled);
console.log(`chunks=${chunks.length} settledL0=${settled.length}`);
for (const r of settled) console.log(`  settled at chunk ${r.regime.start} sig=${r.significance.toFixed(3)}`);

const BIN_SIZE = 20;
const bins = Math.ceil(series.length / BIN_SIZE);
const density = new Array(bins).fill(0);
for (const r of settled) density[Math.floor(r.regime.start / BIN_SIZE)]++;
const nz = [];
for (let b = 0; b < bins; b++) if (density[b] > 0) nz.push(b);
console.log(`bins=${bins} nonzero@[${nz.join(",")}]`);

const dg = ground({ material: density, draws: 60, window: 3, seed: 5 });
console.log(`densityGround: ${isGap(dg) ? "GAP:" + dg.gap : `ok samples[${dg.samples[0]},${dg.samples[dg.samples.length - 1]}]`}`);

const SO = { draws: 30, window: 2, reseeds: 8 };
for (const b of nz) {
  const regime = { start: Math.max(0, b - 1), end: Math.min(bins, b + 2) };
  if (regime.end - regime.start < 2) continue;
  const ex = existenceDependencyTest(density, regime, SO);
  const co = possibilityConstraintTest(density, regime, SO);
  const step = levelStep({ series: density, regime, readerGround: isGap(dg) ? null : dg, existenceCount: density[b], structureOptions: SO });
  console.log(`bin ${b} regime [${regime.start},${regime.end}): density=${density[b]}`);
  console.log(`   ex=${isGap(ex) ? `GAP:${ex.gap}` : `exists=${ex.exists} disp=${ex.statistic.toFixed(3)} null95=${ex.nullThreshold.toFixed(3)}`}`);
  console.log(`   co=${isGap(co) ? `GAP:${co.gap}` : `constrains=${co.constrains} shift=${co.shift.toFixed(3)} null95=${co.nullThreshold.toFixed(3)}`}`);
  console.log(`   step: structure=${step.structure} sig=${step.significance}`);
}

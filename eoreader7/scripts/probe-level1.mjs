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
const probe = (text, label) => {
  const words = tokenize(text);
  const chunks = chunkWords(words, 40);
  const series = causalSurprisalSeries(chunks);
  const level0 = readLevel0(series);
  const settled = level0.results.filter((r) => r.settled);
  console.log(`=== ${label} ===`);
  console.log(`chunks=${series.length} level0 results=${level0.results.length} settled=${settled.length}`);

  if (settled.length === 0) { console.log("  -> nothing to promote"); return; }
  const bins = Math.ceil(series.length / BIN_SIZE);
  const density = new Array(bins).fill(0);
  for (const r of settled) density[Math.floor(r.regime.start / BIN_SIZE)]++;
  const densityGround = ground({ material: density, draws: 60, window: 3, seed: 5 });
  const results = [];
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
  const settledL1 = results.filter((r) => r.settled);
  console.log(`level1 tested=${results.length} settled=${settledL1.length}`);
  for (const r of settledL1) {
    console.log(`  SETTLED bin=[${r.regime.start},${r.regime.end}) chunks=[${r.regime.start * BIN_SIZE},${r.regime.end * BIN_SIZE}) sig=${r.significance.toFixed(3)}`);
  }
  for (const r of results.filter((x) => !x.settled)) {
    console.log(`  uns: bin=[${r.regime.start},${r.regime.end}) structure=${r.structure} sig=${r.significance === null ? "null" : r.significance.toFixed(3)}`);
  }
};

probe(frankenstein.slice(0, 260000), "slice(0,260000)");
probe(frankenstein.slice(0, 320000), "slice(0,320000)");
probe(frankenstein, "full book");

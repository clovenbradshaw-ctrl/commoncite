import { ground, difference, isGap } from "../nul/index.js";
import { readFileSync } from "node:fs";

const maxDeviation = (series) => {
  const sorted = [...series].sort((a, b) => a - b);
  const n = sorted.length;
  const i = (n - 1) / 2;
  const lo = Math.floor(i);
  const median = sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
  let best = 0;
  for (const x of series) best = Math.max(best, Math.abs(x - median));
  return best;
};

const outlierFull = JSON.parse(readFileSync("../eoreader6.1/kernel/data/signal-c-outlier.json", "utf8")).values;
const controlFull = JSON.parse(readFileSync("../eoreader6.1/kernel/data/noise-control.json", "utf8")).values;
const site = 16;

for (const [name, series] of [["signal-c-outlier", outlierFull], ["noise-control", controlFull]]) {
  const candidate = series[site];
  const rest = series.filter((_, i) => i !== site);
  const g = ground({ material: rest, draws: 200, window: 2, perturbation: "resample", statistic: "maxDeviation", seed: 11 });
  if (isGap(g)) { console.log(name, "ground gapped:", g); continue; }
  const rest_sorted = [...rest].sort((a, b) => a - b);
  const mid = (rest.length - 1) / 2, lo = Math.floor(mid);
  const median = rest_sorted[lo] + (rest_sorted[Math.ceil(mid)] - rest_sorted[lo]) * (mid - lo);
  const deviation = Math.abs(candidate - median);
  const d = difference(deviation, g);
  console.log(name, "candidate:", candidate, "deviation:", deviation.toFixed(3), "->", JSON.stringify(isGap(d) ? d : { rank: d.rank }));
}

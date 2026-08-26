import { ground, difference, isGap, PERTURBATIONS } from "../nul/index.js";
import { readFileSync } from "node:fs";

const outlierFull = JSON.parse(readFileSync("../eoreader6.1/kernel/data/signal-c-outlier.json", "utf8")).values;
const site = 16;
const candidate = outlierFull[site];
const rest = outlierFull.filter((_, i) => i !== site);

const sorted = [...rest].sort((a, b) => a - b);
const mid = (rest.length - 1) / 2, lo = Math.floor(mid);
const median = sorted[lo] + (sorted[Math.ceil(mid)] - sorted[lo]) * (mid - lo);
const deviation = Math.abs(candidate - median);

for (const perturbation of ["shuffle", "resample", "phase"]) {
  const g = ground({ material: rest, draws: 200, window: 2, perturbation, statistic: "maxDeviation", seed: 11 });
  if (isGap(g)) { console.log(perturbation, "ground gapped:", g); continue; }
  const d = difference(deviation, g);
  console.log(perturbation, "support:", g.support, "->", JSON.stringify(isGap(d) ? d : { rank: d.rank }));
}

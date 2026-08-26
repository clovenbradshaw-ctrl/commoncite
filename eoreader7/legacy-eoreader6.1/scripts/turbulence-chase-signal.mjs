// Chasing the signal turbulence-candidate-license.mjs's majority vote hid.
//
// "Does not clear on a majority" collapsed three different per-line outcomes
// into one number: genuinely placed-and-unremarkable (peer), censored
// (exceeds_witness/unstable — the observation left the null's support and
// COULD NOT be placed, cascade/index.js's own documented dead end), and
// above/below DISAGREEMENT across lines (which SEED.md #6 calls the most
// informative signal available, not noise to average away).
//
// This script does not run a new growth-rule check. It re-reads the same
// per-line results at finer grain, for exactly the cases the aggregate
// verdict looked flattest on, and asks what the censoring or the
// disagreement is actually made of.

import { load, line } from "../packages/engine/perceiver/field/material.js";
import { ground, level, difference, isGap, STATISTICS } from "../nul/index.js";

const FIELD = "goldens/turbulence/isotropic1024coarse-x-lines.npy";
const DRAWS = 200;
const WINDOW = 5;
const RESEEDS = 12;
const CORE = "shuffle";
const AXIS_NAME = ["u", "v", "w"];

const field = await load(FIELD);
const [nLines] = field.shape;

const moments = (m) => {
  const n = m.length;
  const mean = m.reduce((a, b) => a + b, 0) / n;
  const variance = m.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  const skew = m.reduce((a, b) => a + ((b - mean) / sd) ** 3, 0) / n;
  return { mean, variance, skew };
};

const rows = [];
for (let l = 0; l < nLines; l++) {
  for (let c = 0; c < 3; c++) {
    const material = line(field, { axis: 1, at: [l, c], component: c });
    rows.push({ l, c, material, ...moments(material) });
  }
}

console.log("═══ windowMean/phase @ window 5 — where the disagreement lives ═══\n");
const wmRows = [];
for (const row of rows) {
  const observed = STATISTICS.windowMean(row.material, { window: WINDOW });
  const own = ground({ material: row.material, draws: DRAWS, window: WINDOW, statistic: "windowMean", perturbation: "phase", seed: 0 });
  const core = ground({ material: row.material, draws: DRAWS, window: WINDOW, statistic: "windowMean", perturbation: CORE, seed: 0 });
  if (isGap(own) || isGap(core)) { wmRows.push({ ...row, rel: "gap:ground" }); continue; }
  const lv = level(observed, own, core, { material: row.material, reseeds: RESEEDS });
  wmRows.push({ ...row, rel: isGap(lv) ? `gap:${lv.gap}` : lv.relationship, disp: isGap(lv) ? null : lv.displacement });
}

for (const rel of ["above", "below", "peer", "gap:unstable"]) {
  const subset = wmRows.filter((r) => r.rel === rel);
  if (!subset.length) continue;
  const avgSkew = subset.reduce((a, r) => a + r.skew, 0) / subset.length;
  const avgVar = subset.reduce((a, r) => a + r.variance, 0) / subset.length;
  const byComponent = [0, 1, 2].map((c) => subset.filter((r) => r.c === c).length);
  console.log(
    `  ${rel.padEnd(14)} n=${String(subset.length).padEnd(3)} mean skew ${avgSkew >= 0 ? "+" : ""}${avgSkew.toFixed(3)}  mean variance ${avgVar.toFixed(4)}  by component [u:${byComponent[0]} v:${byComponent[1]} w:${byComponent[2]}]`,
  );
}
console.log(
  "\n  reading: if 'above' and 'below' differ in mean skew/variance/component, the disagreement\n" +
  "  tracks a real physical asymmetry (turbulence is intermittent — not every patch of flow looks\n" +
  "  alike). If they look the same on these measures, the split may be finer-grained than a per-line\n" +
  "  average can see, or may need a different descriptor than skew/variance/component to explain.\n",
);

console.log("═══ censored pairs @ window 5 — near-miss or wildly incompatible? ═══\n");
for (const [statistic, perturbation] of [["burstiness", "resample"], ["burstiness", "phase"], ["permutationEntropy", "phase"]]) {
  console.log(`── ${statistic}/${perturbation} ──`);
  const exceedances = [];
  let placed = 0;
  for (const row of rows) {
    const observed = STATISTICS[statistic](row.material, { window: WINDOW });
    if (!Number.isFinite(observed)) continue;
    const own = ground({ material: row.material, draws: DRAWS, window: WINDOW, statistic, perturbation, seed: 0 });
    if (isGap(own)) continue;
    const fig = difference(observed, own);
    const [lo, hi] = own.samples.length ? [own.samples[0], own.samples[own.samples.length - 1]] : [null, null];
    const width = hi - lo;
    if (isGap(fig) && fig.gap === "exceeds_witness") {
      const past = fig.direction === "above" ? (observed - hi) / width : (lo - observed) / width;
      exceedances.push(past);
    } else if (!isGap(fig)) {
      placed++;
    }
  }
  if (exceedances.length) {
    const mean = exceedances.reduce((a, b) => a + b, 0) / exceedances.length;
    const min = Math.min(...exceedances);
    const max = Math.max(...exceedances);
    console.log(
      `  censored on ${exceedances.length}/${rows.length} lines, placed on ${placed}. exceedance (in units of the null's own width): mean ${mean.toFixed(2)}x  range [${min.toFixed(2)}x, ${max.toFixed(2)}x]`,
    );
  } else {
    console.log(`  no censoring found (placed on ${placed}/${rows.length})`);
  }
}
console.log(
  "\n  reading: exceedance near 0-1x the null's own width is a near miss — the perturbation is nearly\n" +
  "  the right null, just slightly too tight. Exceedance many multiples of the null's width means the\n" +
  "  perturbation destroys something the statistic depends on so thoroughly that its own draws never\n" +
  "  come close to real material — the wrong null for this statistic, not a narrowly missed one.\n",
);

// Does burstiness/resample's near miss (mean exceedance 0.65x the null's own
// width at draws=200) close as draws increases?
//
// `draws` is not a new mechanism — it is nul's own first declared number, the
// resolution of testimony. Turning it is not the same act as inventing a
// perturbation or a statistic; it is asking the existing null to sample its
// own tails harder before a near miss is called a miss. Cheap, own-ground-only
// check first (no reseeding null yet) — only worth building the full level()
// comparison if the support actually widens enough to contain real material.

import { load, line } from "../packages/engine/perceiver/field/material.js";
import { ground, difference, isGap, STATISTICS } from "../nul/index.js";

const FIELD = "goldens/turbulence/isotropic1024coarse-x-lines.npy";
const WINDOW = 5;
const STATISTIC = "burstiness";
const PERTURBATION = "resample";
const DRAWS_STEPS = [200, 800, 3200, 12800];

const field = await load(FIELD);
const [nLines] = field.shape;
const rows = [];
for (let l = 0; l < nLines; l++) for (let c = 0; c < 3; c++) rows.push(line(field, { axis: 1, at: [l, c], component: c }));

for (const draws of DRAWS_STEPS) {
  let placed = 0;
  const exceedances = [];
  for (const material of rows) {
    const observed = STATISTICS[STATISTIC](material, { window: WINDOW });
    const own = ground({ material, draws, window: WINDOW, statistic: STATISTIC, perturbation: PERTURBATION, seed: 0 });
    if (isGap(own)) continue;
    const fig = difference(observed, own);
    if (isGap(fig) && fig.gap === "exceeds_witness") {
      const [lo, hi] = own.samples.length ? [own.samples[0], own.samples[own.samples.length - 1]] : [null, null];
      const width = hi - lo;
      exceedances.push(fig.direction === "above" ? (observed - hi) / width : (lo - observed) / width);
    } else if (!isGap(fig)) placed++;
  }
  const mean = exceedances.length ? exceedances.reduce((a, b) => a + b, 0) / exceedances.length : null;
  console.log(
    `draws=${String(draws).padEnd(6)} placed ${String(placed).padEnd(3)}/${rows.length}  censored ${exceedances.length}${mean != null ? `  mean exceedance ${mean.toFixed(3)}x` : ""}`,
  );
}

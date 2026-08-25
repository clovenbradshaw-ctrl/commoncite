// Does `phase` earn its place in PERTURBATIONS?
//
// SEED.md's growth rule: "An organ joins only when the level test returns
// `above` against the core. `peer` or `unstable` means it waits." So this is
// not a demonstration that the phase null is useful — it is `level()` being
// asked, on real material, with the answer taken as given.
//
// The candidate's own ground is the phase null; the core's ground is shuffle.
// `above` means the core's ground cannot anticipate what the candidate
// perceives: the same observation lands further out against shuffle than
// against phase, so shuffle was clearing things phase does not.
//
// Material: 32 lines of 1024 points through the JHTDB isotropic1024coarse DNS
// (Re_lambda ~ 418), fetched at t=0 along x, all three velocity components.
// That the index is SPACE is received from JHTDB, not measured here —
// Amendment III.
//
// `window` is received from the flow, not chosen for convenience. Grid spacing
// is dx = 2*pi/1024 = 0.00614; the Taylor microscale is lambda ~ 0.118 ~ 19 dx
// and the integral scale L ~ 1.38 ~ 224 dx. So window 5 sits below the Taylor
// scale (dissipative), window 19 at it, and window 64 inside the inertial
// range. Three declared reaches of the present, each with a physical name.

import { load, line } from "../packages/engine/perceiver/field/material.js";
import { ground, difference, level, isGap, STATISTICS, volume } from "../nul/index.js";

const FIELD = "goldens/turbulence/isotropic1024coarse-x-lines.npy";
const DRAWS = 200;
const WINDOWS = [
  [5, "sub-Taylor (dissipative)"],
  [19, "Taylor microscale"],
  [64, "inertial range"],
];
const STATS = ["burstiness", "permutationEntropy", "irreversibility"];

const field = await load(FIELD);
const [nLines, nX] = field.shape;
console.log(`material: ${FIELD}  shape ${field.shape.join("x")}  (${nLines} lines of ${nX})\n`);

const tally = {};

for (const [window, physicalName] of WINDOWS) {
  console.log(`── window ${window} — ${physicalName} ─────────────────────────────`);
  for (const statistic of STATS) {
    const results = [];
    for (let l = 0; l < nLines; l++) {
      for (let c = 0; c < 3; c++) {
        const material = line(field, { axis: 1, at: [l, c], component: c });
        const observed = STATISTICS[statistic](material, { window });
        if (!Number.isFinite(observed)) continue;

        const own = ground({ material, draws: DRAWS, window, statistic, perturbation: "phase", seed: 0 });
        const core = ground({ material, draws: DRAWS, window, statistic, perturbation: "shuffle", seed: 0 });
        if (isGap(own) || isGap(core)) {
          results.push({ rel: `gap:${isGap(own) ? own.gap : core.gap}` });
          continue;
        }
        const lv = level(observed, own, core);
        results.push(
          isGap(lv)
            ? { rel: `gap:${lv.gap}`, ownVol: volume(own), coreVol: volume(core) }
            : { rel: lv.relationship, disp: lv.displacement, ownVol: volume(own), coreVol: volume(core) },
        );
      }
    }
    const counts = {};
    for (const r of results) counts[r.rel] = (counts[r.rel] ?? 0) + 1;
    const disps = results.filter((r) => r.disp != null).map((r) => r.disp);
    const meanDisp = disps.length ? disps.reduce((a, b) => a + b, 0) / disps.length : null;
    const key = `${statistic}@${window}`;
    tally[key] = counts;
    const summary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join("  ");
    console.log(
      `  ${statistic.padEnd(19)} ${summary}${meanDisp != null ? `   mean displacement ${meanDisp >= 0 ? "+" : ""}${meanDisp.toFixed(3)}` : ""}`,
    );
  }
  console.log();
}

// The verdict, in the seed's own terms.
console.log("── growth rule ──────────────────────────────────────────────────");
let anyAbove = false;
for (const [key, counts] of Object.entries(tally)) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const above = counts.above ?? 0;
  if (above / total > 0.5) {
    anyAbove = true;
    console.log(`  ${key.padEnd(28)} ABOVE on ${above}/${total} lines`);
  }
}
console.log(
  anyAbove
    ? "\n  `phase` returns `above` against the core on real material: it joins."
    : "\n  no (statistic, window) pair returns `above` on a majority: it waits.",
);

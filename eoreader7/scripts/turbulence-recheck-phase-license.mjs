// Does the EXISTING irreversibility/phase license survive a proper reseeding
// null?
//
// scripts/turbulence-candidate-license.mjs's negative control caught level()
// manufacturing false 'above' verdicts on pure noise when called without
// material/reseeds — it falls back to the bare resolution floor nul/index.js's
// own docstring names at length. scripts/turbulence-growth-rule.mjs, the
// script that established irreversibility/phase's entry in LICENSED
// ("level() returns `above` on 84/96 real DNS lines, mean displacement
// +0.361"), has that same gap: it calls level(observed, own, core) with
// neither argument.
//
// This does not touch LICENSED or turbulence-growth-rule.mjs. It re-asks
// exactly the same question, on the same material, with the one correction —
// a real reseeding null instead of the floor — and reports the real count,
// whichever way it lands. window 5 only: permutationEntropy and
// irreversibility are ordinal-pattern statistics and patternSpaceAdmissible
// caps window at 8, so windows 19 and 64 are unmeasurable for this statistic
// by construction (cascade/index.js's header names the same wall) — the
// original 84/96 figure can only ever have come from window 5, and this
// recheck is scoped to exactly what the original claim covers.

import { load, line } from "../packages/engine/perceiver/field/material.js";
import { ground, level, isGap } from "../nul/index.js";

const FIELD = "goldens/turbulence/isotropic1024coarse-x-lines.npy";
const DRAWS = 200;
const WINDOW = 5;
const RESEEDS = 12;
const STATISTIC = "irreversibility";
const CANDIDATE_PERTURBATION = "phase";
const CORE_PERTURBATION = "shuffle";

const field = await load(FIELD);
const [nLines] = field.shape;
console.log(`material: ${FIELD}  shape ${field.shape.join("x")}  (${nLines} lines)`);
console.log(`recheck: ${STATISTIC}/${CANDIDATE_PERTURBATION} vs core ${STATISTIC}/${CORE_PERTURBATION}, window ${WINDOW}, reseeds ${RESEEDS}\n`);

const { STATISTICS } = await import("../nul/index.js");

let above = 0, below = 0, peer = 0, gaps = 0, total = 0;
const disps = [];
const floorOnlyTally = { above: 0, below: 0, peer: 0, gaps: 0 };

for (let l = 0; l < nLines; l++) {
  for (let c = 0; c < 3; c++) {
    const material = line(field, { axis: 1, at: [l, c], component: c });
    const observed = STATISTICS[STATISTIC](material, { window: WINDOW });
    if (!Number.isFinite(observed)) continue;
    total++;

    const own = ground({ material, draws: DRAWS, window: WINDOW, statistic: STATISTIC, perturbation: CANDIDATE_PERTURBATION, seed: 0 });
    const core = ground({ material, draws: DRAWS, window: WINDOW, statistic: STATISTIC, perturbation: CORE_PERTURBATION, seed: 0 });
    if (isGap(own) || isGap(core)) { gaps++; continue; }

    // The floor-only call, exactly as turbulence-growth-rule.mjs makes it —
    // reported alongside for direct comparison, not as this recheck's answer.
    const lvFloor = level(observed, own, core);
    if (!isGap(lvFloor)) floorOnlyTally[lvFloor.relationship]++;
    else floorOnlyTally.gaps++;

    // The corrected call: a real reseeding null.
    const lv = level(observed, own, core, { material, reseeds: RESEEDS });
    if (isGap(lv)) { gaps++; continue; }
    if (lv.relationship === "above") { above++; disps.push(lv.displacement); }
    else if (lv.relationship === "below") below++;
    else peer++;
  }
}

console.log(`── floor-only (turbulence-growth-rule.mjs's actual method) ───────`);
console.log(`  above ${floorOnlyTally.above}  below ${floorOnlyTally.below}  peer ${floorOnlyTally.peer}  gap ${floorOnlyTally.gaps}  / ${total}`);
console.log(`\n── with a proper reseeding null ───────────────────────────────`);
console.log(`  above ${above}  below ${below}  peer ${peer}  gap ${gaps}  / ${total}`);
if (disps.length) {
  const mean = disps.reduce((a, b) => a + b, 0) / disps.length;
  console.log(`  mean displacement on 'above' lines: ${mean >= 0 ? "+" : ""}${mean.toFixed(3)}`);
}
console.log(`\n── verdict ─────────────────────────────────────────────────────`);
console.log(
  above / total > 0.5
    ? `  irreversibility/phase still clears the growth rule (above on ${above}/${total}) under a proper reseeding null — the existing license holds.`
    : `  irreversibility/phase does NOT clear a majority (above on ${above}/${total}) once the floor is replaced with a real reseeding null — the existing license was resting on the floor artefact, not a null.`,
);

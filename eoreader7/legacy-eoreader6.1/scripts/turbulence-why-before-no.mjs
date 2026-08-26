// The decision procedure chased by hand across turbulence-chase-signal.mjs,
// turbulence-component-split.mjs and turbulence-near-miss-draws.mjs, made
// into one reusable sequence: before a censored or mixed growth-rule verdict
// is allowed to become "it waits," ask three specific questions about WHY,
// in order. None of the three invents anything nul does not already have —
// each turns information the engine already holds into a decision instead of
// letting it collapse into one majority vote.
//
//   1. DOES A RECEIVED FACT ALREADY ON THE MATERIAL EXPLAIN A MIXED VERDICT?
//      `component` is part of every line's provenance (Amendment III:
//      received, never derived). If above/below disagreement correlates with
//      it, re-run the growth rule stratified by it and report BOTH results —
//      which may itself disconfirm a clean split, and that is still an
//      answer.
//
//   2. IS A CENSORED VERDICT A NEAR MISS THAT RESOLUTION CAN CLOSE?
//      `draws` is nul's own declared number, not a new mechanism. If the
//      observation exceeds the null by a small multiple of the null's own
//      width, escalate draws and re-measure. If the gap shrinks toward zero,
//      it closes with resolution. If it shrinks but persists at high draws,
//      that is itself the finding: the perturbation is structurally, not
//      merely coarsely, too narrow for this material.
//
//   3. IS THE CANDIDATE FAILING, OR IS THE CORE FAILING?
//      level()'s own gap types already distinguish these and nothing new
//      needs building: `exceeds_witness` on OWN means the candidate's own
//      null cannot place the observation; `unstable` means OWN placed it
//      fine and the CORE (shuffle) could not. The second is evidence about
//      shuffle's adequacy for this statistic on this material, not about the
//      candidate, and reporting it as an undifferentiated "gap" the way the
//      first growth-rule sweep did erases that distinction.
//
// This is run here against the three pairs the chase already touched, to
// confirm the procedure reproduces what was found by hand and to leave a
// single, re-runnable record of it — not to search further ground.

import { load, line } from "../packages/engine/perceiver/field/material.js";
import { ground, level, difference, isGap, STATISTICS } from "../nul/index.js";

const FIELD = "goldens/turbulence/isotropic1024coarse-x-lines.npy";
const WINDOW = 5;
const RESEEDS = 12;
const CORE = "shuffle";
const DRAWS_ESCALATION = [200, 800, 3200, 12800];

const field = await load(FIELD);
const [nLines] = field.shape;
const rows = [];
for (let l = 0; l < nLines; l++) for (let c = 0; c < 3; c++) rows.push({ l, c, material: line(field, { axis: 1, at: [l, c], component: c }) });

const growthRule = (statistic, perturbation, draws, subset = rows) => {
  const counts = {};
  for (const { material } of subset) {
    const observed = STATISTICS[statistic](material, { window: WINDOW });
    if (!Number.isFinite(observed)) { counts.unmeasurable = (counts.unmeasurable ?? 0) + 1; continue; }
    const own = ground({ material, draws, window: WINDOW, statistic, perturbation, seed: 0 });
    const core = ground({ material, draws, window: WINDOW, statistic, perturbation: CORE, seed: 0 });
    if (isGap(own) || isGap(core)) { counts["gap:ground"] = (counts["gap:ground"] ?? 0) + 1; continue; }
    const lv = level(observed, own, core, { material, reseeds: RESEEDS });
    const key = isGap(lv) ? `gap:${lv.gap}` : lv.relationship;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
};

const majority = (counts, total) => Object.entries(counts).find(([, n]) => n / total > 0.5);

const question1_receivedSplit = (statistic, perturbation) => {
  console.log(`  Q1 — does 'component' (already received) explain the mix?`);
  for (const [name, subset] of [["w (longitudinal)", rows.filter((r) => r.c === 2)], ["u/v (transverse)", rows.filter((r) => r.c !== 2)]]) {
    const counts = growthRule(statistic, perturbation, 200, subset);
    const m = majority(counts, subset.length);
    console.log(`    ${name.padEnd(18)} ${JSON.stringify(counts)}${m ? `  -> '${m[0]}' clears a majority` : "  -> no majority"}`);
  }
};

const question2_nearMissDraws = (statistic, perturbation) => {
  console.log(`  Q2 — does the censored gap close under more draws (own ground only)?`);
  for (const draws of DRAWS_ESCALATION) {
    let placed = 0;
    const exceedances = [];
    for (const { material } of rows) {
      const observed = STATISTICS[statistic](material, { window: WINDOW });
      if (!Number.isFinite(observed)) continue;
      const own = ground({ material, draws, window: WINDOW, statistic, perturbation, seed: 0 });
      if (isGap(own)) continue;
      const fig = difference(observed, own);
      if (isGap(fig) && fig.gap === "exceeds_witness") {
        const [lo, hi] = [own.samples[0], own.samples[own.samples.length - 1]];
        const width = hi - lo;
        exceedances.push(fig.direction === "above" ? (observed - hi) / width : (lo - observed) / width);
      } else if (!isGap(fig)) placed++;
    }
    const mean = exceedances.length ? exceedances.reduce((a, b) => a + b, 0) / exceedances.length : 0;
    console.log(`    draws=${String(draws).padEnd(6)} placed ${placed}/${rows.length}  mean exceedance ${mean.toFixed(3)}x`);
  }
};

const question3_coreOrCandidate = (statistic, perturbation) => {
  console.log(`  Q3 — when it gaps, is OWN failing or is CORE (shuffle) failing?`);
  const counts = growthRule(statistic, perturbation, 200);
  const ownFails = counts["gap:exceeds_witness"] ?? 0;
  const coreFails = counts["gap:unstable"] ?? 0;
  const total = rows.length;
  console.log(`    OWN cannot place it:  ${ownFails}/${total}`);
  console.log(`    CORE cannot place it (OWN placed fine): ${coreFails}/${total}`);
  if (coreFails > ownFails && coreFails / total > 0.3) {
    console.log(`    -> CORE-INADEQUATE: shuffle cannot place real turbulence here on a third or more of lines. This is a finding about shuffle, not about ${perturbation}.`);
  } else if (ownFails / total > 0.3) {
    console.log(`    -> CANDIDATE-NARROW: ${perturbation}'s own null cannot place real turbulence here. This is a finding about ${perturbation}.`);
  }
};

for (const [statistic, perturbation] of [["windowMean", "phase"], ["burstiness", "resample"], ["burstiness", "phase"]]) {
  console.log(`\n═══ ${statistic}/${perturbation} ═══`);
  question1_receivedSplit(statistic, perturbation);
  question2_nearMissDraws(statistic, perturbation);
  question3_coreOrCandidate(statistic, perturbation);
}

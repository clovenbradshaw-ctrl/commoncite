// Does `cascade` find the energy cascade in real DNS — and does it refuse to
// find one where there isn't one?
//
// Material: JHTDB isotropic1024coarse, 32 lines x 1024 points along x, all
// three velocity components, t=0. That the index is SPACE is received from
// JHTDB (Amendment III). Re_lambda ~ 418.
//
// Received scales, in grid spacings (dx = 2*pi/1024 = 0.00614):
//   Kolmogorov eta ~ 0.00280  =  0.46 dx   (subgrid — not reachable)
//   Taylor lambda  ~ 0.118    =  19.2 dx
//   integral L     ~ 1.376    =  224 dx
//
// PREDICTIONS, WRITTEN BEFORE RUNNING, so the run can refute them:
//
//   1. real DNS shows a level relation across adjacent scales, in a
//      CONSISTENT direction. A cascade has a direction; a set of scales that
//      merely differ does not.
//   2. the phase-randomised surrogate — same power spectrum to floating point,
//      no cascade — shows FEWER laddered relations than the real line. This is
//      the control that matters. Every super-resolution model in this field is
//      validated on E(k), so a surrogate that matches E(k) exactly is the
//      cheapest available stand-in for "confident but physically false," and
//      an organ that ladders it is reading the spectrum rather than the flow.
//   3. the shuffled line — spectrum destroyed along with everything else —
//      ladders least of all, or gaps.
//
// Prediction 2 is the one that can kill the organ. If real and surrogate score
// alike, `cascade` is measuring its own filter and must be withdrawn.

import { load, line } from "../packages/engine/perceiver/field/material.js";
import { cascade } from "../cascade/index.js";
import { PERTURBATIONS, isGap } from "../nul/index.js";

const FIELD = "goldens/turbulence/isotropic1024coarse-x-lines.npy";
const DRAWS = 60;
const WINDOW = 5;
const RESEEDS = 12; // the resolution of pattern: level()'s displacement null (cascade/index.js)
// 224 dx is the integral scale; 19 dx the Taylor microscale. Received, not fitted.
const WIDTHS = [1, 2, 4, 8, 16, 19, 32, 64, 128, 224];

// Every rung is truncated to `material.length - 224 + 1`, so handing in 735
// points makes that extent exactly 512 and every ground's FFT takes the
// radix-2 path instead of Bluestein's zero-padded 2048. Purely a cost choice
// and stated as one: the extent is still declared, still identical across
// rungs and arms, and nothing about the comparison depends on it.
const MATERIAL_LEN = 735;
// The reseeding null costs `reseeds` extra grounds PER RELATION, so a full
// 32x3 sweep is ~4 hours. Cut to a stated subset rather than silently
// sampling: 16 lines, u-component only.
const LINES = 16;
const COMPONENT = 0;

const field = await load(FIELD);
const nLines = Math.min(LINES, field.shape[0]);

const ARMS = {
  real: (m) => m,
  "phase-surrogate": (m) => PERTURBATIONS.phase(m, 991),
  shuffled: (m) => PERTURBATIONS.shuffle(m, 991),
};

const summary = {};
const relTally = {};

for (const [arm, transform] of Object.entries(ARMS)) {
  const laddered = [];
  const terminations = [];
  const counts = { above: 0, below: 0, peer: 0, gap: 0 };

  for (let l = 0; l < nLines; l++) {
    const raw = line(field, { axis: 1, at: [l, COMPONENT], component: COMPONENT }).slice(0, MATERIAL_LEN);
    const material = transform(raw);
    const r = cascade({ material, widths: WIDTHS, draws: DRAWS, reseeds: RESEEDS, window: WINDOW, seed: 0 });
    if (isGap(r)) {
      counts.gap++;
      continue;
    }
    laddered.push(r.laddered);
    if (r.terminatesAt != null) terminations.push(r.terminatesAt);
    for (const rel of r.relations) {
      if (rel.gap) counts.gap++;
      else counts[rel.relationship]++;
    }
    process.stderr.write(`\r  ${arm} ${l + 1}/${nLines}   `);
  }
  process.stderr.write("\n");

  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  summary[arm] = { meanLaddered: mean(laddered), n: laddered.length, counts, terminations };
  relTally[arm] = counts;
}

console.log(`material: ${FIELD}  ${nLines} lines x 1 component (u), ${MATERIAL_LEN} pts each`);
console.log(`spec: statistic=irreversibility perturbation=phase draws=${DRAWS} reseeds=${RESEEDS} window=${WINDOW}`);
console.log(`widths (grid spacings): ${WIDTHS.join(", ")}   [19 = Taylor, 224 = integral]\n`);

console.log("arm               mean laddered/9   above   below    peer    gap");
console.log("─".repeat(68));
for (const [arm, s] of Object.entries(summary)) {
  console.log(
    `${arm.padEnd(18)}${s.meanLaddered.toFixed(2).padStart(9)}      ` +
      `${String(s.counts.above).padStart(6)}${String(s.counts.below).padStart(8)}` +
      `${String(s.counts.peer).padStart(8)}${String(s.counts.gap).padStart(7)}`,
  );
}

console.log("\n── where the ladder stops (first `peer` going up, in grid spacings) ──");
for (const [arm, s] of Object.entries(summary)) {
  const t = s.terminations;
  if (!t.length) {
    console.log(`  ${arm.padEnd(18)} never terminates within the received scales`);
    continue;
  }
  const hist = {};
  for (const v of t) hist[v] = (hist[v] ?? 0) + 1;
  const top = Object.entries(hist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w, n]) => `${w}dx x${n}`)
    .join("  ");
  console.log(`  ${arm.padEnd(18)} ${t.length}/${s.n} terminate   ${top}`);
}

console.log("\n── prediction 2, the one that can kill the organ ──");
const real = summary.real.meanLaddered;
const surr = summary["phase-surrogate"].meanLaddered;
console.log(`  real ${real.toFixed(2)}   phase-surrogate ${surr.toFixed(2)}   difference ${(real - surr).toFixed(2)}`);
console.log(
  real - surr > 0.5
    ? "  real material ladders more than its own spectrum-matched surrogate:\n" +
        "  the organ is reading structure the spectrum does not explain."
    : "  real and surrogate ladder alike. `cascade` is reading its own filter\n" +
        "  or the spectrum, NOT the cascade. The organ does not join.",
);

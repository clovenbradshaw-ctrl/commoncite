// External validation: does eoreader6's arrow track a physical constant?
//
// Everything measured in this engine so far is self-consistency — the engine
// agreeing with its own null. This asks a different question: does the arrow
// verdict track a quantity turbulence is KNOWN to have, measured independently
// of anything eoreader6 does.
//
// THE CONSTANT. Velocity-derivative skewness,
//
//   S = <(du/dx)^3> / <(du/dx)^2>^(3/2)
//
// is about -0.5 for isotropic turbulence and is not a fit — it is the
// Kolmogorov 4/5 law, <(delta u)^3> = -(4/5) * epsilon * r, the one exact
// nontrivial result in the theory. It is negative because the energy cascade
// runs large-to-small, and its sign is the direction of that flow.
//
// WHY THIS IS THE RIGHT CHECK FOR `phase` SPECIFICALLY, and not merely a
// convenient one. The power spectrum is a SECOND-ORDER quantity and carries no
// skewness whatever; a phase-randomised surrogate is Gaussian and has S = 0 by
// construction. Skewness is THIRD-order. So `irreversibility` measured against
// a phase null and S measured directly are two routes to the same thing: the
// structure the spectrum does not explain. If they disagree, one of them is
// not measuring what it claims.
//
// PREDICTIONS, WRITTEN BEFORE RUNNING:
//
//   1. measured S on real DNS lands near -0.5. This validates the perceiver
//      and the fetched data before anything is asked of the engine. If S came
//      out near zero the material would be wrong and nothing below would mean
//      anything.
//   2. S of the phase surrogate is ~0. This is a check on `phase` itself: a
//      perturbation that claims to destroy third-order structure while keeping
//      the spectrum must actually do it.
//   3. across lines, |S| is NEGATIVELY correlated with the rank of observed
//      irreversibility against the phase null. High rank means the ground
//      easily contains the observation; strong skewness should push the
//      observation out toward censoring. A null or positive correlation
//      refutes the licence `phase` was admitted under.
//
// Prediction 3 is the one that can retroactively invalidate the growth-rule
// pass that admitted `phase` at all.
//
// ── RESULTS, 96 series, draws 200, window 5 ─────────────────────────────────
//
//   1. PASS.  measured S = -0.351 (sd 0.784, so SE 0.080). Literature is about
//      -0.5, and this is ~1.9 SE below it in magnitude — consistent, but on
//      the low side, which is what the COARSE variant of the dataset should do:
//      filtering smooths exactly the sharp gradients that carry the skewness.
//      Not quoted as agreement with -0.5, only as "this is real turbulence."
//   2. PASS.  S of the phase surrogates = -0.0038. The perturbation does
//      destroy third-order structure while holding the spectrum, as claimed.
//   3. PASS.  rho(|S|, rank) = -0.342, n=95, SE 0.104.
//
// AND ONE THING THAT DOES NOT FIT, recorded because it is unexplained rather
// than because it is understood. Correlating the arrow rank against the
// moments of du separately:
//
//   2nd  variance     +0.323      partial, controlling |S|:  +0.299
//   3rd  |skewness|   -0.342      partial, controlling var:  -0.320
//   4th  kurtosis     -0.037
//
// The two are near-independent (rho(|S|, var) = -0.130), so these are two
// separate significant effects, not one wearing two labels. The skewness
// effect is the predicted one and it survives. The VARIANCE effect should not
// exist at all, by two independent arguments: `phase` preserves variance
// exactly, so figure and null share it; and ordinal patterns are invariant
// under any monotone transform, scaling included, so `irreversibility` should
// be blind to it twice over.
//
// A plausible story is that du-variance is, in real turbulence specifically, a
// proxy for intense small-scale activity and therefore for genuine non-Gaussian
// structure — a third-order effect wearing a second-order label. The kurtosis
// column argues against that (-0.037), so the story is not supported and the
// leak is OPEN. Until it is explained, the honest reading of prediction 3 is
// that the arrow tracks skewness AND something else that has not been named,
// and `phase`'s licence rests on the first without accounting for the second.

import { load, line } from "../packages/engine/perceiver/field/material.js";
import { ground, difference, isGap, PERTURBATIONS, STATISTICS } from "../nul/index.js";

const FIELD = "goldens/turbulence/isotropic1024coarse-x-lines.npy";
const DRAWS = 200;
const WINDOW = 5;

/** The physical constant, measured directly. No engine involved. */
const derivativeSkewness = (u) => {
  const d = [];
  for (let i = 0; i + 1 < u.length; i++) d.push(u[i + 1] - u[i]);
  const m = d.reduce((a, b) => a + b, 0) / d.length;
  let s2 = 0;
  let s3 = 0;
  for (const v of d) {
    s2 += (v - m) ** 2;
    s3 += (v - m) ** 3;
  }
  s2 /= d.length;
  s3 /= d.length;
  return s3 / s2 ** 1.5;
};

const spearman = (xs, ys) => {
  const rank = (a) => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    idx.forEach(([, i], k) => (r[i] = k));
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const n = xs.length;
  const mx = (n - 1) / 2;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - mx);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - mx) ** 2;
  }
  return num / Math.sqrt(dx * dy);
};

const field = await load(FIELD);
const [nLines] = field.shape;

const rows = [];
const surrogateS = [];

for (let l = 0; l < nLines; l++) {
  for (let c = 0; c < 3; c++) {
    const u = line(field, { axis: 1, at: [l, c], component: c });
    const S = derivativeSkewness(u);
    surrogateS.push(derivativeSkewness(PERTURBATIONS.phase(u, 500 + l * 3 + c)));

    const observed = STATISTICS.irreversibility(u, { window: WINDOW });
    const g = ground({ material: u, draws: DRAWS, window: WINDOW, statistic: "irreversibility", perturbation: "phase", seed: 0 });
    if (isGap(g)) {
      rows.push({ S, rank: null, censored: `ground:${g.gap}` });
      continue;
    }
    const d = difference(observed, g);
    rows.push(
      isGap(d)
        ? { S, rank: null, censored: d.direction ?? d.gap, observed }
        : { S, rank: d.rank, censored: null, observed },
    );
  }
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const realS = rows.map((r) => r.S);

console.log(`material: ${FIELD}  ${nLines} lines x 3 components = ${rows.length} series`);
console.log(`spec: irreversibility / phase, draws=${DRAWS}, window=${WINDOW}\n`);

console.log("── prediction 1: does the material carry the constant at all? ──");
console.log(`  measured derivative skewness S = ${mean(realS).toFixed(3)}  (sd ${Math.sqrt(mean(realS.map((v) => (v - mean(realS)) ** 2))).toFixed(3)})`);
console.log(`  literature for isotropic turbulence: about -0.5`);
console.log(`  ${mean(realS) < -0.3 && mean(realS) > -0.8 ? "PASS — the fetched field is real turbulence" : "FAIL — this material is not what it claims to be"}\n`);

console.log("── prediction 2: does `phase` actually destroy third-order structure? ──");
console.log(`  S of phase surrogates = ${mean(surrogateS).toFixed(4)}  (should be ~0)`);
console.log(`  ${Math.abs(mean(surrogateS)) < 0.05 ? "PASS — the perturbation does what it claims" : "FAIL — phase is leaving skewness behind"}\n`);

console.log("── prediction 3: does the engine's arrow track the constant? ──");
const placed = rows.filter((r) => r.rank != null);
const censored = rows.filter((r) => r.censored);
console.log(`  placed ${placed.length}/${rows.length}, censored ${censored.length}`);
if (placed.length > 2) {
  const rho = spearman(placed.map((r) => Math.abs(r.S)), placed.map((r) => r.rank));
  console.log(`  Spearman rho( |S| , rank ) = ${rho.toFixed(3)}   [predicted: negative]`);
  console.log(
    `  ${rho < -0.2 ? "PASS — stronger skewness pushes the observation toward censoring" : rho > 0.2 ? "REFUTED — the correlation runs the WRONG WAY" : "NULL — no relationship; the licence is not supported by this test"}`,
  );
}
if (censored.length) {
  const cS = rows.filter((r) => r.censored).map((r) => Math.abs(r.S));
  const pS = placed.map((r) => Math.abs(r.S));
  console.log(`\n  mean |S| among CENSORED series: ${mean(cS).toFixed(3)}`);
  console.log(`  mean |S| among PLACED   series: ${mean(pS).toFixed(3)}`);
  console.log(`  ${mean(cS) > mean(pS) ? "  consistent: the unplaceable ones are the strongly skewed ones" : "  inconsistent: censoring is not tracking skewness"}`);
}

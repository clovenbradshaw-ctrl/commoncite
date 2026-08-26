// eoreader6 · predictive-competency — does anything this engine does improve a
// prediction?
//
// The point of the harness is not the number it prints on real material. It is
// the CONTROL BATTERY. A candidate that beats baselines on a regime-switching
// series and also beats them on white noise has not detected regimes; it has
// found a way to look good, and the only thing that separates those two cases
// is running the negative controls before believing the positive one.
//
//   level-shift     POSITIVE — piecewise-constant level plus noise. Real
//                   boundaries exist and a mean estimator can exploit them.
//                   The first version of this control was alternating
//                   TREND/flat legs on a cumulative series, and it was the
//                   wrong test: an integrated series is dominated by
//                   persistence, so every mean-based estimator loses there for
//                   a reason that has nothing to do with regimes. Kept in the
//                   comment rather than deleted, because "the candidate lost
//                   the positive control" and "the positive control was not a
//                   test of this candidate" look identical in a results table.
//   ar1             NEGATIVE — stationary AR(1). No regimes, and no
//                   accumulating-distance mechanism either. eoreader5 recorded
//                   why the obvious choice is wrong: a plain random walk is NOT
//                   a safe negative control, because persistence's edge over a
//                   running mean genuinely grows as the walk drifts from its
//                   own history, so a candidate can gain there for a real
//                   reason that has nothing to do with regimes.
//   trend           NEGATIVE — one homogeneous slope. Structure, but no
//                   boundary anywhere in it.
//   noise           NEGATIVE — white noise. Nothing to find at all.
//   frankenstein    REAL — causal (history-only) surprisal over real prose.
//
// Run: node scripts/predictive-competency.mjs [path-to-text.txt]

import fs from "node:fs";
import { createPredictionTask } from "../packages/engine/prediction/tasks.js";
import { defaultNumericBaselines } from "../packages/engine/prediction/baselines.js";
import { defaultCandidates, boundaryControl, placementNull, placementSequenceOf } from "../packages/engine/prediction/candidates.js";
import { runPrequential } from "../packages/engine/prediction/run.js";
import { PLACEMENT } from "../packages/engine/loops/atmosphere.js";
import { tokenize, chunkWords, causalSurprisalSeries } from "../packages/engine/perceiver/text/material.js";

// The three declared numbers, plus tolerance (the resolution of refusal) and
// warmup (where the walk may honestly begin). None is a default.
const WINDOW = 6;
const DRAWS = 96;
const TOLERANCE = 2;
const WARMUP = 24;
const SCORING_RULE = "crps";

// Deterministic generators — no Math.random anywhere, so a rerun is a rerun.
const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const gauss = (next) => {
  const u = Math.max(next(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
};

const levelShift = (n, seed) => {
  const next = prng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const leg = Math.floor(i / 40); // 40-step legs, level alternating high/low
    out.push((leg % 2 === 0 ? 0 : 4) + gauss(next));
  }
  return out;
};

const ar1 = (n, seed, phi = 0.7) => {
  const next = prng(seed);
  const out = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    v = phi * v + gauss(next);
    out.push(v);
  }
  return out;
};

const trend = (n, seed) => {
  const next = prng(seed);
  return Array.from({ length: n }, (_, i) => i * 0.25 + gauss(next) * 0.35);
};

const noise = (n, seed) => {
  const next = prng(seed);
  return Array.from({ length: n }, () => gauss(next));
};

const textSeries = (path, maxChunks = 320) => {
  const chunks = chunkWords(tokenize(fs.readFileSync(path, "utf8")), 40);
  // causalSurprisalSeries builds its own frequency table as it goes — the
  // reader-relative statistic, never a whole-document one. A whole-document
  // surprisal would leak the ending into step 3.
  return causalSurprisalSeries(chunks.slice(0, maxChunks)).filter(Number.isFinite);
};

const fmt = (x, w = 9) => (x === null || x === undefined ? "—" : x.toFixed(3)).padStart(w);

const runOne = (name, series, expectation) => {
  const baselines = defaultNumericBaselines({ window: WINDOW });
  const candidates = defaultCandidates({ window: WINDOW, draws: DRAWS, tolerance: TOLERANCE, seed: 0 });
  const task = createPredictionTask({
    target_type: "number",
    horizon: { kind: "walk-forward", h: 1 },
    scoring_rule: SCORING_RULE,
    baseline_ids: baselines.map((b) => b.id),
    population: name,
  });

  const result = runPrequential({
    series,
    candidates,
    baselines,
    task,
    warmup: WARMUP,
    scoring_rule: SCORING_RULE,
    population: name,
    source_versions: [`${name}:n=${series.length}`],
  });

  console.log(`\n=== ${name}  (${expectation})`);
  console.log(`    n=${series.length}  scored=${result.steps}  skipped=${result.skipped}  rule=${SCORING_RULE}`);

  const ids = result.records[0]?.baseline_ids ?? [];
  console.log(`    ${"".padEnd(26)}${ids.map((i) => i.replace("baseline:", "").padStart(11)).join("")}   verdict`);

  for (const rec of [...result.baseline_records, ...result.records]) {
    const gains = ids.map((i) => fmt(rec.competency_gain[i], 11)).join("");
    const own = result.records.includes(rec);
    const verdict = !own ? "" : rec.beats_all_baselines ? "  BEATS ALL" : "  no";
    const label = rec.candidate_id.replace(/^(candidate|baseline):/, own ? "* " : "  ");
    console.log(`    ${label.padEnd(26)}${gains}${verdict}`);
    if (own && rec.state?.rezeroCount !== undefined) {
      console.log(`    ${"".padEnd(26)}(re-zeros: ${rec.state.rezeroCount})`);
    }
  }
  return result;
};

const path = process.argv[2];
const N = 320;

const battery = [
  ["level-shift", levelShift(N, 11), "POSITIVE control — real boundaries a mean can use"],
  ["ar1", ar1(N, 23), "NEGATIVE control — stationary, no regimes"],
  ["trend", trend(N, 37), "NEGATIVE control — structure, but no boundary"],
  ["noise", noise(N, 53), "NEGATIVE control — nothing to find"],
];

if (path && fs.existsSync(path)) battery.push(["frankenstein", textSeries(path), "REAL material"]);

console.log("competency gain = baseline cumulative loss − candidate cumulative loss.");
console.log("positive means the candidate carried less loss than that baseline.");
console.log("* marks a candidate; unmarked rows are baselines scored against each other.");

const results = battery.map(([name, series, expectation]) => runOne(name, series, expectation));

// ── the boundary permutation null ────────────────────────────────────────────
//
// Beating a fixed-window baseline is not evidence that the boundaries are real,
// because regime-mean's slice is usually longer than the window and a longer
// slice estimates a mean better on its own. This holds the boundary COUNT fixed
// at whatever atmosphere actually produced and destroys only their PLACEMENT.
// Passing means these positions beat arbitrary positions; failing means the
// gain was slice length all along.
const REPLICATES = 8;

const boundaryNull = (name, series, observedCount) => {
  if (observedCount < 1) return null;
  const baselines = defaultNumericBaselines({ window: WINDOW });
  const task = createPredictionTask({
    target_type: "number",
    horizon: { kind: "walk-forward", h: 1 },
    scoring_rule: SCORING_RULE,
    baseline_ids: baselines.map((b) => b.id),
    population: `${name}:boundary-null`,
  });

  const gains = [];
  for (let r = 0; r < REPLICATES; r++) {
    const next = prng(1000 + r);
    const positions = Array.from({ length: observedCount }, () =>
      WARMUP + Math.floor(next() * Math.max(1, series.length - WARMUP - 2)),
    );
    const result = runPrequential({
      series,
      candidates: [boundaryControl(positions, `candidate:boundary-null-${r}`)],
      baselines,
      task,
      warmup: WARMUP,
      scoring_rule: SCORING_RULE,
      population: `${name}:boundary-null`,
      source_versions: [`${name}:n=${series.length}:replicate=${r}`],
    });
    // Scored against the same reference for both sides: moving-mean-W.
    gains.push(result.records[0].competency_gain[`baseline:moving-mean-${WINDOW}`]);
  }
  gains.sort((a, b) => a - b);
  return { gains, max: gains[gains.length - 1], median: gains[Math.floor(gains.length / 2)] };
};

console.log("\n=== boundary permutation null (placement destroyed, count held fixed)");
console.log(`    ${REPLICATES} replicates, gain measured against baseline:moving-mean-${WINDOW}`);

const nullVerdicts = new Map();
for (let i = 0; i < battery.length; i++) {
  const [name, series] = battery[i];
  const rec = results[i].records.find((r) => r.candidate_id === "candidate:regime-mean");
  const observed = rec.competency_gain[`baseline:moving-mean-${WINDOW}`];
  const count = rec.state?.rezeroCount ?? 0;
  const nul = boundaryNull(name, series, count);
  if (!nul) {
    console.log(`    ${name.padEnd(16)} re-zeros=0 — no placement to destroy, null not applicable`);
    nullVerdicts.set(name, null);
    continue;
  }
  const clears = observed > nul.max;
  nullVerdicts.set(name, clears);
  console.log(
    `    ${name.padEnd(16)} re-zeros=${String(count).padStart(3)}  observed=${fmt(observed, 14)}  null-max=${fmt(nul.max, 14)}  ->  ${clears ? "CLEARS" : "does not clear"}`,
  );
}

// ── the placement permutation null ──────────────────────────────────────────
//
// Beating regime-mean does not, on its own, mean the placement TAG carries
// information. The same rate of spread modulation, applied at arbitrary steps
// instead of the ones the ground actually failed to place, could win by luck
// if regime-relative uncertainty just runs generically higher near the end of
// a regime for reasons that have nothing to do with placement. This holds the
// tag COUNT fixed at whatever atmosphere actually read and destroys only their
// POSITIONS — same discipline as the boundary null above, aimed at the tag
// instead of the boundary.
const shuffled = (xs, seed) => {
  const next = prng(seed);
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const placementNullFor = (name, series, observedPlacement) => {
  const count = observedPlacement.filter((p) => p !== PLACEMENT.PLACED).length;
  if (count < 1) return null;
  const baselines = defaultNumericBaselines({ window: WINDOW });
  const task = createPredictionTask({
    target_type: "number",
    horizon: { kind: "walk-forward", h: 1 },
    scoring_rule: SCORING_RULE,
    baseline_ids: baselines.map((b) => b.id),
    population: `${name}:placement-null`,
  });

  const gains = [];
  for (let r = 0; r < REPLICATES; r++) {
    const candidate = placementNull({
      placementSequence: shuffled(observedPlacement, 2000 + r),
      window: WINDOW,
      draws: DRAWS,
      tolerance: TOLERANCE,
      seed: 0,
      id: `candidate:placement-null-${r}`,
    });
    const result = runPrequential({
      series,
      candidates: [candidate],
      baselines,
      task,
      warmup: WARMUP,
      scoring_rule: SCORING_RULE,
      population: `${name}:placement-null`,
      source_versions: [`${name}:n=${series.length}:replicate=${r}`],
    });
    gains.push(result.records[0].competency_gain[`baseline:moving-mean-${WINDOW}`]);
  }
  gains.sort((a, b) => a - b);
  return { gains, max: gains[gains.length - 1], median: gains[Math.floor(gains.length / 2)] };
};

console.log("\n=== placement permutation null (tag positions destroyed, count held fixed)");
console.log(`    ${REPLICATES} replicates, gain measured against baseline:moving-mean-${WINDOW}`);

for (let i = 0; i < battery.length; i++) {
  const [name, series] = battery[i];
  const rec = results[i].records.find((r) => r.candidate_id === "candidate:placement-rate");
  const observed = rec.competency_gain[`baseline:moving-mean-${WINDOW}`];
  const observedPlacement = placementSequenceOf(series, { window: WINDOW, draws: DRAWS, tolerance: TOLERANCE, seed: 0 });
  const nul = placementNullFor(name, series, observedPlacement);
  if (!nul) {
    console.log(`    ${name.padEnd(16)} unplaced=0 — no tag to shuffle, null not applicable`);
    continue;
  }
  const clears = observed > nul.max;
  console.log(
    `    ${name.padEnd(16)} unplaced=${String(observedPlacement.filter((p) => p !== PLACEMENT.PLACED).length).padStart(3)}  observed=${fmt(observed, 14)}  null-max=${fmt(nul.max, 14)}  ->  ${clears ? "CLEARS" : "does not clear"}`,
  );
}

// The reading that matters is the JOINT one, so it is computed rather than
// left to the eye: a candidate has earned nothing unless it wins on the
// positive control AND loses on every negative one.
console.log("\n=== joint reading across the battery");
const positive = results[0];
const negatives = results.slice(1, 4);
for (const rec of positive.records) {
  const winsPositive = rec.beats_all_baselines;
  const negWins = negatives
    .map((r) => r.records.find((x) => x.candidate_id === rec.candidate_id))
    .filter((x) => x?.beats_all_baselines).length;
  const earned = winsPositive && negWins === 0;
  console.log(
    `    ${rec.candidate_id.padEnd(26)} positive:${winsPositive ? "win " : "lose"}  negatives-won:${negWins}/3  ->  ${earned ? "EARNED" : "NOT EARNED"}`,
  );
}
if (battery.length > 4) {
  const real = battery[4][0];
  console.log(
    `\n    on real material (${real}), regime-mean vs the boundary null: ${
      nullVerdicts.get(real) === null ? "n/a" : nullVerdicts.get(real) ? "CLEARS" : "does not clear"
    }`,
  );
}

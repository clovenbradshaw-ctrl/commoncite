import { test } from "node:test";
import assert from "node:assert/strict";

import { canonicalHashSync, canonicalJsonStringify } from "../packages/spec/canonical-json/index.js";
import { score, crps, logLoss } from "../packages/engine/prediction/scoring.js";
import { lastValue, globalMean, defaultNumericBaselines } from "../packages/engine/prediction/baselines.js";
import { createPredictionTask, walkForward } from "../packages/engine/prediction/tasks.js";
import { commitPrediction, revealAndScore } from "../packages/engine/prediction/commitments.js";
import {
  createLedger,
  recordStep,
  competencyGain,
  beatsAllBaselines,
  finalizeCompetency,
} from "../packages/engine/competency/ledger.js";
import { createRegimeTracker, PLACEMENT } from "../packages/engine/loops/atmosphere.js";
import {
  boundaryControl,
  regimeMean,
  placementRate,
  placementNull,
  placementSequenceOf,
} from "../packages/engine/prediction/candidates.js";
import { isGap } from "../nul/index.js";
import { runPrequential } from "../packages/engine/prediction/run.js";

// ── the seal ────────────────────────────────────────────────────────────────

test("the canonical hash covers NESTED fields — the defect that made the seal decorative", () => {
  // The previous canonicalHashSync called JSON.stringify(data, Object.keys(data).sort()).
  // An array second argument is a key ALLOWLIST applied at every depth, so any
  // nested key absent from the top level was dropped before hashing. A
  // commitment sealed that way did not cover predictive_output at all.
  const a = { schema: "X", predictive_output: { kind: "gaussian", mean: 1, sd: 2 } };
  const b = { schema: "X", predictive_output: { kind: "gaussian", mean: 999, sd: 2 } };
  assert.notEqual(canonicalHashSync(a), canonicalHashSync(b), "a nested edit must change the hash");
});

test("key order does not matter; array order does", () => {
  assert.equal(canonicalHashSync({ a: 1, b: 2 }), canonicalHashSync({ b: 2, a: 1 }));
  assert.notEqual(canonicalHashSync({ xs: [1, 2] }), canonicalHashSync({ xs: [2, 1] }));
  assert.equal(canonicalJsonStringify({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
});

test("a sealed envelope refuses what would silently vanish on encode", () => {
  assert.throws(() => canonicalHashSync({ a: NaN }), TypeError);
  assert.throws(() => canonicalHashSync({ a: Infinity }), TypeError);
  assert.throws(() => canonicalHashSync({ a: () => 1 }), TypeError);
  // An undefined ARRAY element has a position, so dropping it would change the
  // sequence — refused. An undefined OBJECT value is an omitted field and is
  // treated as absent, which is why { a: undefined } and {} seal identically.
  assert.throws(() => canonicalHashSync({ xs: [1, undefined] }), TypeError);
  assert.equal(canonicalHashSync({ a: undefined }), canonicalHashSync({}));
});

// ── commit before reveal ────────────────────────────────────────────────────

const aCommitment = (over = {}) =>
  commitPrediction({
    task_id: "task:t",
    candidate_id: "candidate:c",
    candidate_version_hash: "v1",
    input_snapshot_hash: "h1",
    predictive_output: { kind: "gaussian", mean: 0, sd: 1 },
    committed_at_step: 5,
    reveal_not_before_step: 6,
    ...over,
  });

test("a prediction revealable at the step it was made is not a prediction", () => {
  assert.throws(() => aCommitment({ reveal_not_before_step: 5 }), RangeError);
});

test("leakage is refused — revealing before the commitment is eligible", () => {
  const c = aCommitment();
  assert.throws(
    () => revealAndScore({ commitment: c, observed: 0.5, revealed_at_step: 5 }),
    /leakage refused/,
  );
  assert.ok(revealAndScore({ commitment: c, observed: 0.5, revealed_at_step: 6 }));
});

test("a commitment edited after sealing is refused at reveal, including inside predictive_output", () => {
  const c = aCommitment();
  const tamperedTop = { ...c, committed_at_step: 1 };
  assert.throws(() => revealAndScore({ commitment: tamperedTop, observed: 0, revealed_at_step: 6 }), /altered/);

  const tamperedNested = { ...c, predictive_output: { kind: "gaussian", mean: 0.5, sd: 1 } };
  assert.throws(() => revealAndScore({ commitment: tamperedNested, observed: 0, revealed_at_step: 6 }), /altered/);
});

test("an unsupported predictive kind is refused at commit, before any measurement is spent", () => {
  assert.throws(() => aCommitment({ predictive_output: { kind: "vibes" } }), TypeError);
});

// ── scoring honesty ─────────────────────────────────────────────────────────

test("a point forecast is never laundered into a proper score", () => {
  const r = crps({ kind: "point", value: 1 }, 1.2);
  assert.equal(r.loss, null);
  assert.equal(r.proper, false);
  assert.match(r.note, /gaussian or samples/);

  const l = logLoss({ kind: "point", value: 1 }, 1.2);
  assert.equal(l.loss, null);
  assert.equal(l.proper, false);
});

test("a nul ground is directly scoreable — its samples ARE an empirical ensemble", () => {
  const r = crps({ kind: "samples", values: [0, 1, 2, 3] }, 1.5);
  assert.equal(r.proper, true);
  assert.ok(Number.isFinite(r.loss));
});

test("CRPS prefers the better-located forecast and is finite under a bad spread", () => {
  const near = crps({ kind: "gaussian", mean: 1.0, sd: 1 }, 1.0).loss;
  const far = crps({ kind: "gaussian", mean: 9.0, sd: 1 }, 1.0).loss;
  assert.ok(near < far);
  assert.ok(Number.isFinite(crps({ kind: "gaussian", mean: 0, sd: 1e-9 }, 50).loss));
});

test("log-loss stays finite under total surprise, so one step cannot NaN a cumulative sum", () => {
  assert.ok(Number.isFinite(logLoss({ kind: "gaussian", mean: 0, sd: 1e-6 }, 1e6).loss));
});

test("a malformed distribution throws — type error before null (SEED.md #7)", () => {
  assert.throws(() => score({ kind: "gaussian", mean: 0, sd: -1 }, 0, { rule: "crps" }), RangeError);
  assert.throws(() => score(null, 0), TypeError);
  assert.throws(() => score({ kind: "gaussian", mean: 0, sd: 1 }, 0, { rule: "nope" }), TypeError);
});

// ── baselines ───────────────────────────────────────────────────────────────

test("a baseline derives its spread and degrades honestly when none is justified", () => {
  const g = lastValue([1, 3, 2, 5]);
  assert.equal(g.kind, "gaussian");
  assert.ok(g.sd > 0);

  const constant = globalMean([2, 2, 2, 2]);
  assert.equal(constant.kind, "point", "a constant series justifies no spread, so no gaussian is invented");
});

test("the default suite is non-empty and every member is committable", () => {
  const suite = defaultNumericBaselines({ window: 3 });
  assert.ok(suite.length >= 4);
  for (const b of suite) assert.ok(commitPrediction({ ...{
    task_id: "t", candidate_id: b.id, candidate_version_hash: "v", input_snapshot_hash: "h",
    committed_at_step: 1, reveal_not_before_step: 2,
  }, predictive_output: b.predict([1, 2, 3, 4, 5]) }));
});

// ── the task and the walk ───────────────────────────────────────────────────

test("a task without baselines is refused — an unbaselined competency claim is unfalsifiable", () => {
  assert.throws(
    () => createPredictionTask({ target_type: "number", horizon: {}, scoring_rule: "crps", baseline_ids: [], population: "p" }),
    TypeError,
  );
});

test("walkForward never puts the target inside the history it hands over", () => {
  const series = [0, 1, 2, 3, 4, 5];
  for (const step of walkForward(series, { warmup: 2 })) {
    assert.equal(step.history.length, step.step);
    assert.deepEqual([...step.history], series.slice(0, step.step));
    assert.ok(!step.history.includes(step.target) || series.slice(0, step.step).includes(step.target));
    assert.equal(step.reveal_not_before_step, step.committed_at_step + 1);
  }
});

// ── the ledger ──────────────────────────────────────────────────────────────

test("the ledger is immutable — a later run cannot edit a past evaluation", () => {
  const l0 = createLedger({ task_id: "t", candidate_id: "c", baseline_ids: ["b"] });
  const l1 = recordStep(l0, { candidate_loss: 1, baseline_losses: { b: 2 } });
  assert.equal(l0.observations, 0, "the original ledger must be untouched");
  assert.equal(l1.observations, 1);
  assert.notEqual(l0, l1);
});

test("competency gain is baseline loss minus candidate loss, and 'works' means beating them all", () => {
  let l = createLedger({ task_id: "t", candidate_id: "c", baseline_ids: ["b1", "b2"] });
  l = recordStep(l, { candidate_loss: 1, baseline_losses: { b1: 2, b2: 0.5 } });
  l = recordStep(l, { candidate_loss: 1, baseline_losses: { b1: 2, b2: 0.5 } });
  assert.equal(competencyGain(l).b1, 2);
  assert.equal(competencyGain(l).b2, -1);
  assert.equal(beatsAllBaselines(l), false, "beating one baseline is not beating the baselines");
});

test("a step with no proper score is counted but not summed, and the gap is visible", () => {
  let l = createLedger({ task_id: "t", candidate_id: "c", baseline_ids: ["b"] });
  l = recordStep(l, { candidate_loss: null, baseline_losses: { b: 1 }, proper: false });
  assert.equal(l.observations, 1);
  assert.equal(l.proper_observations, 0);
  assert.equal(l.cumulative_loss, 0);
});

test("a ledger cannot be created without baselines, nor sealed without a full scope", () => {
  assert.throws(() => createLedger({ task_id: "t", candidate_id: "c", baseline_ids: [] }), TypeError);
  const l = createLedger({ task_id: "t", candidate_id: "c", baseline_ids: ["b"] });
  assert.throws(() => finalizeCompetency(l, { horizon: {}, population: "p" }), /source_versions/);
  assert.ok(
    finalizeCompetency(l, {
      horizon: { kind: "walk-forward", h: 1 },
      population: "p",
      source_versions: ["s"],
      evaluation_protocol: "prequential-walk-forward",
    }).content_hash,
  );
});

// ── the organs under test ───────────────────────────────────────────────────

const staircase = (levels, seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const g = () => Math.sqrt(-2 * Math.log(Math.max(next(), 1e-12))) * Math.cos(2 * Math.PI * next());
  const out = [];
  for (const level of levels) for (let i = 0; i < 40; i++) out.push(level + g());
  return out;
};

const rezerosOn = (series) => {
  const t = createRegimeTracker({ window: 6, draws: 96, tolerance: 2, seed: 0 });
  for (const x of series) t.push(x);
  return t.rezeroCount;
};

test("the regime tracker's declared numbers are never defaults", () => {
  assert.throws(() => createRegimeTracker({ window: 6, draws: 96 }), /tolerance/);
  assert.throws(() => createRegimeTracker({ draws: 96, tolerance: 2 }), /window/);
  assert.throws(() => createRegimeTracker({ window: 6, tolerance: 2 }), /draws/);
});

test("MEASURED LIMIT: atmosphere clears on surfeit only, so it is blind to a falling level", () => {
  // This is not a bug being hidden by a test — it is a structural consequence
  // of the clearing rule, pinned so that changing the rule shows up here as a
  // deliberate change rather than as silent drift. Only censored-ABOVE clears;
  // a downward shift lands censored-below, which SEED.md #8 names as
  // regularity and forbids treating as surfeit. Counting below as surfeit was
  // measured once already and re-zeroed on nearly every step.
  const up = rezerosOn(staircase([0, 2, 4, 6, 8, 10, 12, 14], 11));
  const down = rezerosOn(staircase([14, 12, 10, 8, 6, 4, 2, 0], 11));
  assert.ok(up > 0, `a rising staircase must be detected, got ${up}`);
  assert.equal(down, 0, `a falling staircase is structurally invisible, got ${down}`);
});

test("on material with nothing to find, the tracker concedes nothing", () => {
  assert.equal(rezerosOn(staircase([0, 0, 0, 0, 0, 0, 0, 0], 53)), 0);
});

test("the boundary null holds count fixed and destroys only placement", () => {
  const c = boundaryControl([10, 40, 70]);
  assert.equal(c.state().rezeroCount, 3);
  // Same estimator shape as regime-mean, so a difference between them is
  // attributable to placement alone.
  assert.equal(typeof c.predict([1, 2, 3, 4, 5, 6]).kind, "string");
});

test("a candidate never sees a value it was not entitled to", () => {
  // Not a constant series: a constant history makes every baseline degrade to
  // a point prediction, crps then returns no proper loss, and the run honestly
  // skips every step — leaving nothing to inspect.
  const series = Array.from({ length: 60 }, (_, i) => (i < 30 ? 0 : 5) + Math.sin(i) * 0.4);
  const baselines = defaultNumericBaselines({ window: 3 });
  const seen = [];
  const spy = {
    id: "candidate:spy",
    prime: () => {},
    predict: (history) => {
      seen.push(history.length);
      return { kind: "gaussian", mean: history[history.length - 1], sd: 1 };
    },
    observe: () => {},
  };
  const task = createPredictionTask({
    target_type: "number",
    horizon: { kind: "walk-forward", h: 1 },
    scoring_rule: "crps",
    baseline_ids: baselines.map((b) => b.id),
    population: "test",
  });
  runPrequential({
    series,
    candidates: [spy],
    baselines,
    task,
    warmup: 5,
    population: "test",
    source_versions: ["test"],
  });
  // The history handed over at step t is exactly t long: series[t] is withheld.
  assert.deepEqual(seen, Array.from({ length: series.length - 5 }, (_, i) => i + 5));
});

// ── placement: the ground's relation to one arrival ──────────────────────────

test("placement is TERNARY — collapsing it to a boolean loses the middle state tolerance exists to hold", () => {
  // STRAINED is not a weaker OTHER: the ground has failed to place this
  // arrival but still stands. `tolerance` is the number of STRAINED steps
  // before the ground is conceded, so a two-valued placement would make that
  // declared number meaningless. All three must actually occur.
  const t = createRegimeTracker({ window: 6, draws: 96, tolerance: 2, seed: 0 });
  const seen = new Set();
  for (const x of staircase([0, 2, 4, 6, 8, 10, 12, 14], 11)) {
    const step = t.push(x);
    if (!isGap(step.placement)) seen.add(step.placement);
    // OTHER is exactly the conceding step, never merely a strained one.
    assert.equal(step.rezeroed, step.placement === PLACEMENT.OTHER);
  }
  assert.deepEqual(
    [...seen].sort(),
    [PLACEMENT.OTHER, PLACEMENT.PLACED, PLACEMENT.STRAINED].sort(),
    "a rising staircase must exercise all three placements",
  );
});

test("no ground to judge against is a TYPED GAP, never PLACED — the silently-wrong-number case", () => {
  // Before one window of material has arrived there is no ground at all. The
  // honest report is a refusal; reporting it as "the ground placed this"
  // would be a wrong number of exactly the kind a typed gap exists to refuse.
  const t = createRegimeTracker({ window: 6, draws: 96, tolerance: 2, seed: 0 });
  const first = t.push(1);
  assert.ok(isGap(first.placement), "an arrival with no ground yet must not be tagged placed");
  assert.equal(first.placement.gap, "no_ground");
  assert.notEqual(first.placement, PLACEMENT.PLACED);
});

test("candidate:placement-rate shares regime-mean's centre — the only declared difference is spread", () => {
  const series = staircase([0, 2, 4, 6, 8, 10, 12, 14], 11);
  const rm = regimeMean({ window: 6, draws: 96, tolerance: 2, seed: 0 });
  const ef = placementRate({ window: 6, draws: 96, tolerance: 2, seed: 0 });
  const warmup = series.slice(0, 40);
  rm.prime(warmup);
  ef.prime(warmup);
  for (let i = 40; i < series.length; i++) {
    const history = series.slice(0, i);
    const a = rm.predict(history);
    const b = ef.predict(history);
    const centreOf = (d) => (d.kind === "point" ? d.value : d.mean);
    assert.equal(centreOf(a), centreOf(b), `centres diverged at step ${i}`);
    rm.observe(series[i], history);
    ef.observe(series[i], history);
  }
});

test("OTHER resets the rate rather than entering it — a concession is a boundary, not a magnitude", () => {
  // Documented wrong once: the claim was that this candidate fuses STRAINED
  // and OTHER into one "not placed" count. It does not — the rezeroed branch
  // is checked FIRST and zeroes both counters, so a conceded ground restarts
  // the count instead of contributing to it. What the ratio reads is the
  // within-regime STRAINED rate. Pinned so the description and the arithmetic
  // cannot drift apart again.
  const series = staircase([0, 2, 4, 6, 8, 10, 12, 14], 11);
  const params = { window: 6, draws: 96, tolerance: 2, seed: 0 };
  const probe = createRegimeTracker(params);
  const candidate = placementRate(params);
  let sawOther = false;
  for (const x of series) {
    const step = probe.push(x);
    candidate.observe(x);
    if (step.placement === PLACEMENT.OTHER) {
      sawOther = true;
      const s = candidate.state();
      assert.equal(s.unplacedInRegime, 0, "a conceded ground restarts the strained count at zero");
      assert.equal(s.pushesInRegime, 0, "and restarts its denominator too");
    }
  }
  assert.ok(sawOther, "the staircase must concede at least once or this asserts nothing");
});

test("placementSequenceOf replays the same reading push() makes, in order", () => {
  const series = staircase([0, 2, 4, 6, 8, 10, 12, 14], 11);
  const params = { window: 6, draws: 96, tolerance: 2, seed: 0 };
  const t = createRegimeTracker(params);
  const live = series.map((x) => t.push(x).placement);
  assert.deepEqual(placementSequenceOf(series, params), live);
});

test("candidate:placement-null with a constant tag sequence degrades to the unmodulated base spread", () => {
  const series = staircase([0, 2, 4, 6, 8, 10, 12, 14], 11);
  const params = { window: 6, draws: 96, tolerance: 2, seed: 0 };
  // No information in a constant sequence: the unplaced rate is always 0, so
  // the ratio has nothing to distinguish and the candidate must collapse onto
  // regime-mean rather than throwing or emitting a non-finite spread.
  const allClean = placementNull({ placementSequence: series.map(() => PLACEMENT.PLACED), ...params });
  const warmup = series.slice(0, 40);
  allClean.prime(warmup);
  for (let i = 40; i < series.length; i++) {
    const out = allClean.predict(series.slice(0, i));
    if (out.kind === "gaussian") assert.ok(Number.isFinite(out.sd) && out.sd > 0);
    allClean.observe(series[i], series.slice(0, i));
  }
});

test("the placement candidates are deterministic — same input, same sealed record", () => {
  const series = Array.from({ length: 80 }, (_, i) => Math.sin(i / 5) * 3 + (i % 7) * 0.1);
  const go = (candidate) => {
    const baselines = defaultNumericBaselines({ window: 3 });
    const task = createPredictionTask({
      target_type: "number",
      horizon: { kind: "walk-forward", h: 1 },
      scoring_rule: "crps",
      baseline_ids: baselines.map((b) => b.id),
      population: "determinism-placement",
    });
    return runPrequential({
      series,
      candidates: [candidate()],
      baselines,
      task,
      warmup: 20,
      population: "determinism-placement",
      source_versions: ["determinism-placement"],
    });
  };
  const params = { window: 6, draws: 32, tolerance: 2, seed: 0 };
  assert.equal(
    go(() => placementRate(params)).records[0].content_hash,
    go(() => placementRate(params)).records[0].content_hash,
  );
});

test("the prequential run is deterministic — same input, same sealed record", () => {
  const series = Array.from({ length: 80 }, (_, i) => Math.sin(i / 5) * 3 + (i % 7) * 0.1);
  const go = () => {
    const baselines = defaultNumericBaselines({ window: 3 });
    const task = createPredictionTask({
      target_type: "number",
      horizon: { kind: "walk-forward", h: 1 },
      scoring_rule: "crps",
      baseline_ids: baselines.map((b) => b.id),
      population: "determinism",
    });
    return runPrequential({
      series,
      candidates: [regimeMean({ window: 6, draws: 32, tolerance: 2, seed: 0 })],
      baselines,
      task,
      warmup: 20,
      population: "determinism",
      source_versions: ["determinism"],
    });
  };
  assert.equal(go().records[0].content_hash, go().records[0].content_hash);
});

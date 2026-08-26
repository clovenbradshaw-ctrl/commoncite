// eoreader6 · atmosphere — the missing remedy for sustained regularity.
//
// SEED.md Amendment II: censored below is a measurement, not only a hazard.
// `createRegimeTracker` reported it (as PLACEMENT.STRAINED never firing, i.e.
// silence) and took no further act. This is the counter that turns a
// sustained run of it into a typed finding — `slack_ground` — without ever
// treating it as a clearing.
//
// THE STATISTIC MATTERS. Burstiness's below-censoring is near-universal
// (nul's own `windowMean` docstring: 79-87% of ordinary steps) because it is
// a max-over-windows statistic — a run counter built on it cannot discriminate
// real regularity from that chronic background, which the calibration test
// below measures directly. `windowMean`'s below-censoring is a genuine,
// non-chronic event (Amendment II's "a level DROP is as real as a rise"), so
// the finding is calibrated against it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isGap } from "../nul/index.js";
import { createRegimeTracker, slackRunNull, readAtmosphere } from "../packages/engine/loops/atmosphere.js";

const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const W = 5;
const DRAWS = 256;
const RESEEDS = 16;
const TOLERANCE = 3;

const findingsOn = (series, statistic = "windowMean") => {
  const t = createRegimeTracker({ window: W, draws: DRAWS, tolerance: TOLERANCE, statistic, findOn: ["regularity"], reseeds: RESEEDS, seed: 1 });
  const findings = [];
  let rezeroed = false;
  for (const x of series) {
    const step = t.push(x);
    if (step.finding) findings.push(step.finding);
    if (step.rezeroed) rezeroed = true;
  }
  return { findings, rezeroed };
};

test("regularity is opt-in — off by default, no behaviour change for existing callers", () => {
  const t = createRegimeTracker({ window: W, draws: DRAWS, tolerance: TOLERANCE, statistic: "windowMean", seed: 1 });
  const next = rng(9);
  const series = Array.from({ length: 200 }, () => 10 + next());
  for (const x of series) {
    const step = t.push(x);
    assert.equal(step.finding, null, "no finding is ever reported unless findOn asks for it");
  }
});

test("reseeds is declared and never a default once regularity is opted into", () => {
  assert.throws(
    () => createRegimeTracker({ window: W, draws: DRAWS, tolerance: TOLERANCE, findOn: ["regularity"] }),
    /reseeds/,
  );
});

test("a sustained decline produces slack_ground, never a re-zero", () => {
  // A real, sustained drop to a calmer level: repeatedly censored below the
  // ground built on the earlier, noisier stretch. Not a burst — nothing
  // exceeds anything — so surfeit has no purchase here at all.
  const next = rng(9);
  const series = [];
  for (let i = 0; i < 300; i++) series.push(10 + next());
  for (let i = 0; i < 300; i++) series.push(2 + next());
  const { findings, rezeroed } = findingsOn(series);
  assert.ok(findings.length > 0, "a sustained decline must be found as slack_ground");
  for (const f of findings) assert.equal(f.gap, "slack_ground");
  assert.equal(rezeroed, false, "regularity is a finding, never an action — it must not trigger a re-zero");
});

test("a burst still re-zeros, and is not reported as slack_ground", () => {
  const next = rng(5);
  const series = [];
  for (let i = 0; i < 280; i++) series.push(1 + 0.3 * next());
  for (let i = 0; i < 40; i++) series.push(9 + next());
  const { findings, rezeroed } = findingsOn(series);
  assert.equal(rezeroed, true, "surfeit still clears — only below was redirected");
  assert.equal(findings.length, 0, "a burst is surfeit's territory, not slackness's");
});

test("burstiness's below-censoring is too chronic to calibrate a run against — measured, not assumed", () => {
  // The near-universal background rate documented in nul's `windowMean`
  // header (79-87%). A run counter over it cannot tell a genuinely regular
  // stretch from ordinary material; both saturate the false-alarm rate.
  //
  // Series length raised 300 -> 900, 2026-08-05: atmosphere.js's MIN_GROUND
  // moved from `3 * window` to `10 * window` (causal re-zero boundary-
  // correctness fix, see its header), which delays how much of a
  // FIXED-length series is past warm-up and eligible to accumulate a run at
  // all. The underlying claim is unchanged and still measured, not assumed
  // — at `window=5` this over-fires 25/100 at length 300 (below this test's
  // own 0.3 bar, a regression this length change closes) rising to 55/100 at
  // length 900, i.e. the same chronic rate, just needing more runway past
  // the larger warm-up to show it within one finite-length trial.
  let fired = 0;
  const trials = 20;
  for (let t = 0; t < trials; t++) {
    const next = rng(2000 + t);
    const series = Array.from({ length: 900 }, () => next() * 2);
    const { findings } = findingsOn(series, "burstiness");
    if (findings.length > 0) fired++;
  }
  assert.ok(
    fired / trials > 0.3,
    `expected burstiness's chronic below-rate to over-fire on iid noise, got ${fired}/${trials}`,
  );
});

test("CALIBRATION: on iid noise, slack_ground fires at approximately its declared rate and not more", () => {
  // Modelled on conformance/calibration.test.js's device for holon_level: the
  // question a Born-null-gated finding owes before any other is "how often do
  // you say yes on material with nothing there."
  let fired = 0;
  const trials = 30;
  for (let t = 0; t < trials; t++) {
    const next = rng(4000 + t);
    const series = Array.from({ length: 300 }, () => next() * 2);
    const { findings } = findingsOn(series, "windowMean");
    if (findings.length > 0) fired++;
  }
  assert.ok(fired / trials <= 0.15, `slack_ground fired on ${fired}/${trials} structureless series — the null is not holding its rate`);
});

test("the run-length null has real width — a degenerate sequence is not silently cleared", () => {
  // All-below is the degenerate case: shuffling it is still all-below, so the
  // null and the observation coincide. slackRunNull must not read that as
  // licence to fire on nothing; it returns the same run length right back.
  const allBelow = Array(20).fill(true);
  const threshold = slackRunNull(allBelow, RESEEDS, 1);
  assert.equal(threshold, 20);
});

// ── §5: equanimity — a closed region is as reportable as an open one ────────

test("readAtmosphere reports apertureOpen/apertureClose/opened with the same prominence turn.js and surf.js already do", () => {
  const next = rng(9);
  const series = [];
  for (let i = 0; i < 200; i++) series.push(10 + next());
  for (let i = 0; i < 200; i++) series.push(60 + next() * 5); // a real burst, so at least one region concedes
  const r = readAtmosphere({ material: series, window: W, draws: DRAWS, tolerance: TOLERANCE, seed: 1 });
  assert.ok(!isGap(r));
  assert.ok(r.regions.length >= 2, "this material must concede at least once, or the test asserts nothing");
  for (const region of r.regions) {
    assert.ok("apertureOpen" in region && "apertureClose" in region, "open and close are reported at equal prominence");
    assert.ok(region.opened === true || region.opened === false || region.opened === null, "null is a third outcome, never folded into either");
  }
});

// ── recourse locality (2023arXiv230801406K checked against this organ,
// scripts/rec-recourse-locality.mjs) — the new fields' own arithmetic, not
// the substantive finding. Whether amortized recompute work actually grows
// with turns is a fact about real material, measured by that script and
// recorded in CLAUDE.md, not a threshold to pin here — pinning a specific
// growth rate would be exactly the golden-blind-parameter mistake this
// repo's own CLAUDE.md names. These tests only owe correctness of the count.

test("readAtmosphere: recomputeWork is the sum of every ground-rebuild attempt's own extent, stepsRead counts hops taken", () => {
  const next = rng(3);
  const series = Array.from({ length: 400 }, () => 10 + next());
  const r = readAtmosphere({ material: series, window: W, draws: DRAWS, tolerance: TOLERANCE, hop: 1, seed: 1 });
  assert.ok(!isGap(r));
  assert.ok(r.stepsRead > 0, "iid noise over 400 elements at window 5 must take at least one step");
  assert.ok(r.recomputeWork > 0, "a ground was built at least once over this much material");
  assert.equal(r.recomputeWorkPerStep, r.recomputeWork / r.stepsRead, "the per-step figure is exactly the ratio of the two raw counts, not a separately-tracked value that could drift from them");
});

test("readAtmosphere: no material reaches MIN_GROUND means zero recompute work, not a null field", () => {
  // Below GROUND_FLOOR_DIFFERENCE(window) = 10*window, groundFrom's own gate
  // never calls ground() at all — the accumulator must reflect that, never
  // silently omit the field or report a stale positive number.
  const r = readAtmosphere({ material: Array(5).fill(1), window: 5, draws: DRAWS, tolerance: TOLERANCE, seed: 1 });
  if (!isGap(r)) {
    assert.equal(r.recomputeWork, 0);
    assert.equal(r.recomputeWorkPerStep, r.stepsRead ? 0 : null);
  }
});

test("createRegimeTracker: recomputeWork only grows, amortizedRecourse is always recomputeWork over pushes made so far", () => {
  const next = rng(7);
  const t = createRegimeTracker({ window: W, draws: DRAWS, tolerance: TOLERANCE, seed: 1 });
  let last = 0;
  let pushes = 0;
  for (let i = 0; i < 300; i++) {
    t.push(10 + next());
    pushes++;
    assert.ok(t.recomputeWork >= last, "attempted work is accumulated, never reduced or reset outside a real re-zero");
    last = t.recomputeWork;
    // Gated on whether a push has happened at all, not on whether work has
    // accumulated yet: zero recompute work over N real turns is a genuine
    // "0", distinct from "no turns yet" (null) — see the fresh-tracker case.
    assert.equal(t.amortizedRecourse, t.recomputeWork / pushes);
  }
  assert.ok(t.recomputeWork > 0, "300 pushes at window 5 must have built a ground at least once");
});

test("createRegimeTracker: a fresh tracker with nothing pushed reports null amortizedRecourse, not a divide-by-zero", () => {
  const t = createRegimeTracker({ window: W, draws: DRAWS, tolerance: TOLERANCE, seed: 1 });
  assert.equal(t.recomputeWork, 0);
  assert.equal(t.amortizedRecourse, null);
});

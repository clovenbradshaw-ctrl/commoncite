// eoreader6 · conformance/calibration — do the yes/no organs fire at their
// nominal rate on material where nothing is there?
//
// The rest of this suite checks REFUSAL: gaps, type errors, the doctrine. It
// passed 407 tests while `existenceDependencyTest` was calling regimes
// "existent" on pure iid noise 17/60 times at a nominal 5% level — because no
// test ever asked the one question a Born-null-gated verdict owes before any
// other: on material with no structure, how often do you say yes?
//
// That is SEED.md #3 in operational form. A null that clears too little is a
// null of effectively-zero width, and it fails invisibly and globally (#6) —
// every organ built downstream (formation's holon gate, loops/level) inherits
// the miscalibration without a single conformance failure. So the rate itself
// is held here, as a family: any organ that answers a boolean against a null
// must appear in this file with its false-positive rate measured on iid noise.
//
// The bound is 15% against a nominal ~6% (the null is max-of-16 placements,
// so the exchangeable rate is 1/17). Loose enough not to flake, tight enough
// that the broken null — measured at 28% — cannot pass.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isGap } from "../nul/index.js";
import { existenceDependencyTest, possibilityConstraintTest } from "../holon_level/index.js";

const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const iidSeries = (seed, n) => {
  const g = prng(seed);
  return Array.from({ length: n }, () => g());
};

test("existence-dependency fires at its nominal rate on iid noise", () => {
  let fired = 0;
  let placed = 0;
  const trials = 40;
  for (let t = 0; t < trials; t++) {
    const series = iidSeries(1000 + t, 300);
    const at = 60 + (t * 7) % 160;
    const regime = { start: at, end: at + 50 };
    const r = existenceDependencyTest(series, regime, { draws: 48, window: 5, reseeds: 16 });
    if (isGap(r)) continue;
    placed++;
    if (r.exists) fired++;
  }
  assert.ok(placed >= trials * 0.8, `too few trials placed: ${placed}/${trials}`);
  assert.ok(
    fired / placed <= 0.15,
    `existence-dependency called ${fired}/${placed} structureless regimes "existent" — the null is not holding its rate`,
  );
});

test("possibility-constraint fires at its nominal rate on iid noise", () => {
  let fired = 0;
  let placed = 0;
  const trials = 60;
  for (let t = 0; t < trials; t++) {
    const series = iidSeries(5000 + t, 300);
    const at = 60 + (t * 7) % 160;
    const regime = { start: at, end: at + 50 };
    const r = possibilityConstraintTest(series, regime, { reseeds: 16 });
    if (isGap(r)) continue;
    placed++;
    if (r.constrains) fired++;
  }
  assert.ok(placed >= trials * 0.8, `too few trials placed: ${placed}/${trials}`);
  assert.ok(
    fired / placed <= 0.15,
    `possibility-constraint called ${fired}/${placed} structureless regimes "constraining" — the null is not holding its rate`,
  );
});

test("a genuinely singular regime still fires", () => {
  // Calibration must not be bought with blindness: a burst regime on quiet
  // material is the case the organ exists for.
  const g = prng(424242);
  const series = Array.from({ length: 300 }, () => g());
  for (let i = 140; i < 190; i++) series[i] = 9 + g();
  const regime = { start: 140, end: 190 };
  const e = existenceDependencyTest(series, regime, { draws: 48, window: 5, reseeds: 16 });
  const c = possibilityConstraintTest(series, regime, { reseeds: 16 });
  assert.ok(!isGap(e) && e.exists, "a 9-sigma burst regime must register as existence-dependent");
  assert.ok(!isGap(c) && c.constrains, "a 9-sigma burst regime must register as constraining");
});

test("existence-dependency + possibility-constraint stay calibrated at the shortest regime length holonGatedRegimeMean's gate ever sees", () => {
  // packages/engine/prediction/candidates.js's holonGatedRegimeMean skips
  // this gate below `window + 2`, TRUSTING the proposed reset outright
  // rather than refusing it — the opposite action from atmosphere.js's
  // MIN_GROUND floor, which refuses to build a ground at all below its own
  // minimum. That comment used to claim the two floors matched; they don't,
  // and this pins the actual claim that matters: gating is never worse than
  // the unconditional-accept the bypass produces, because the combined
  // above-rate stays far under nominal even at window+2 itself. If a future
  // change to either test inflates the false-positive rate at short regime
  // lengths, this is where it would show up.
  let fired = 0;
  let placed = 0;
  const trials = 60;
  const window = 6;
  for (let t = 0; t < trials; t++) {
    const series = iidSeries(9000 + t, 300);
    const at = 60 + (t * 7) % 160;
    const regime = { start: at, end: at + window + 2 }; // candidates.js's exact floor
    const e = existenceDependencyTest(series, regime, { draws: 96, window, reseeds: 16 });
    const c = possibilityConstraintTest(series, regime, { reseeds: 16 });
    if (isGap(e) || isGap(c)) continue;
    placed++;
    if (e.exists && c.constrains) fired++;
  }
  assert.ok(placed >= trials * 0.8, `too few trials placed: ${placed}/${trials}`);
  assert.ok(
    fired / placed <= 0.15,
    `the combined gate fired on ${fired}/${placed} structureless window+2 regimes — raising candidates.js's floor would not be fixing a false-alarm defect, because there isn't one`,
  );
});

test("a regime leaving no room for a non-overlapping placement is a typed gap, not a zero-width null", () => {
  const series = iidSeries(777, 60);
  const regime = { start: 2, end: 58 }; // flanks too short for a 56-wide window
  const r = possibilityConstraintTest(series, regime, { reseeds: 8 });
  assert.ok(isGap(r) && r.gap === "degenerate_ground");
});

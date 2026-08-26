// eoreader6 · outlier — the pointwise question none of the licensed pairs ask,
// and the friction closed alongside it.
//
// Measured directly (eoreader6.1's check-real-ground-full.mjs, run against
// this engine's real ground/difference): a planted single-point magnitude
// outlier ranks 0.415-0.910 against every one of burstiness/shuffle,
// windowMean/shuffle, permutationEntropy/shuffle, irreversibility/shuffle,
// irreversibility/phase. None flag it, because none ask about one value's
// distance from the rest — they ask about windowed bursts, distributional
// order, or reversal asymmetry. This suite is that gap closed: a fifth
// statistic that does ask the pointwise question, licensed the way Amendment
// I requires (checked against real data, not assumed), plus the two changes
// that let it be checked at all without first editing the registry: `ground`/
// `extremeGround` accepting a statistic function directly, and `fingerprint`
// exported so a candidate ground can be built compatibly from outside.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ground,
  extremeGround,
  difference,
  isGap,
  licensed,
  fingerprint,
  cites,
  maxDeviation,
  STATISTICS,
} from "../nul/index.js";

const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) / 2;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
};

const N = 200;
const next = prng(20260805);
const ORDINARY = Array.from({ length: N }, () => next() * 2 - 1);
const SITE = 50;
const OUTLIER_FULL = ORDINARY.map((v, i) => (i === SITE ? 40 : v));
const REST = OUTLIER_FULL.filter((_, i) => i !== SITE);
const CANDIDATE = OUTLIER_FULL[SITE];

const SPEC = { draws: 200, window: 2, seed: 11 };

// ── the statistic itself ─────────────────────────────────────────────────────

test("maxDeviation is registered and is the max absolute deviation from the median", () => {
  assert.equal(STATISTICS.maxDeviation, maxDeviation);
  assert.equal(maxDeviation([1, 2, 3]), 1);
  assert.equal(maxDeviation([1, 2, 100]), 98);
  // window is accepted and ignored: this is a property of the whole material.
  assert.equal(maxDeviation([1, 2, 100], { window: 2 }), 98);
});

// ── the licence, checked rather than assumed ────────────────────────────────

test("shuffle is degenerate for maxDeviation: it only permutes a fixed multiset", () => {
  const g = ground({ material: REST, ...SPEC, perturbation: "shuffle", statistic: "maxDeviation" });
  assert.ok(isGap(g));
  assert.equal(g.gap, "degenerate_ground");
  assert.equal(licensed("maxDeviation", "shuffle"), false);
});

test("resample is licensed: a held-out magnitude outlier exceeds the witness, above", () => {
  assert.equal(licensed("maxDeviation", "resample"), true);
  const g = ground({ material: REST, ...SPEC, perturbation: "resample", statistic: "maxDeviation" });
  assert.ok(!isGap(g));
  const deviation = Math.abs(CANDIDATE - median(REST));
  const d = difference(deviation, g);
  assert.ok(isGap(d));
  assert.equal(d.gap, "exceeds_witness");
  assert.equal(d.direction, "above");
});

test("phase is licensed: same construction, same finding", () => {
  assert.equal(licensed("maxDeviation", "phase"), true);
  const g = ground({ material: REST, ...SPEC, perturbation: "phase", statistic: "maxDeviation" });
  assert.ok(!isGap(g));
  const deviation = Math.abs(CANDIDATE - median(REST));
  const d = difference(deviation, g);
  assert.ok(isGap(d));
  assert.equal(d.gap, "exceeds_witness");
  assert.equal(d.direction, "above");
});

test("a matched control, held out the same way, reads below — regularity, not a hazard", () => {
  const controlSite = 90;
  const controlCandidate = ORDINARY[controlSite];
  const controlRest = ORDINARY.filter((_, i) => i !== controlSite);
  const g = ground({ material: controlRest, ...SPEC, perturbation: "resample", statistic: "maxDeviation" });
  assert.ok(!isGap(g));
  const deviation = Math.abs(controlCandidate - median(controlRest));
  const d = difference(deviation, g);
  // Not asserting a direction here: an ordinary point can land inside the
  // support, or exceed it below. Either is fine; landing "above" is not.
  if (isGap(d)) assert.equal(d.direction, "below");
});

test("held-in material self-contaminates: resample can and does redraw the candidate", () => {
  // This is why the docstring insists on leave-one-out. Checked, not assumed.
  const g = ground({ material: OUTLIER_FULL, ...SPEC, perturbation: "resample", statistic: "maxDeviation" });
  assert.ok(!isGap(g));
  assert.ok(
    g.samples.includes(maxDeviation(OUTLIER_FULL)),
    "a resample of material containing the outlier can produce a draw whose own maxDeviation matches the full series' — the candidate drew itself back in",
  );
});

// ── the friction closed: an unregistered statistic runs through the same pipeline ──

test("ground accepts a statistic function directly, unregistered and unlicensed", () => {
  const range = (series) => Math.max(...series) - Math.min(...series);
  const g = ground({ material: REST, ...SPEC, perturbation: "resample", statistic: range });
  assert.ok(!isGap(g));
  assert.equal(g.spec.statistic, range);
  assert.equal(licensed(range, "resample"), false, "a function never earns a licence just by running");
});

test("fingerprint is exported and matches what ground already builds internally", () => {
  const g = ground({ material: REST, ...SPEC, perturbation: "resample", statistic: "maxDeviation" });
  assert.equal(g.from, fingerprint(REST));
  assert.ok(cites(g, REST));
});

test("extremeGround accepts a statistic function directly, same as ground", () => {
  const range = (series) => Math.max(...series) - Math.min(...series);
  const g = extremeGround({ material: REST, ...SPEC, perturbation: "resample", statistic: range, n: 5, direction: "above" });
  assert.ok(!isGap(g));
  assert.equal(g.spec.statistic, range);
});

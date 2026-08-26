// eoreader6 · extremeGround — the null for the best of n, and the silent
// defect it closes.
//
// `ground` builds the nothing for ONE arrival. The failure this suite
// demonstrates is what happens when n arrivals are placed against it and the
// most extreme is kept: the maximum of n null draws sits near the top of a
// one-arrival support by construction, so a process that generates more
// candidates produces more survivors WITHOUT any of them carrying signal.
//
// The measurement below is the point of the file. Both columns are pure null —
// the "observations" are statistics of perturbed material, containing nothing
// by construction. A correct null places them uniformly. The one-arrival ground
// does not, and the size of that failure is what is asserted.
//
// SEED.md #3 at a grain the seed states only for a single arrival: a support
// that the maximum of n draws clears by construction is a null of zero width
// for the question actually being asked, even while it has perfectly good width
// for the question it was built for.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ground, extremeGround, difference, isGap, volume, PERTURBATIONS, STATISTICS } from "../nul/index.js";

// Deterministic: a test that cannot be replayed cannot be conformance.
const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const N = 400;
const DRAWS = 200;
const WINDOW = 8;
const CANDIDATES = 50;

const next = prng(20260731);
const IID = Array.from({ length: N }, () => next());

// A contiguous run of large values. Shuffling disperses the run, so a
// max-over-windows statistic drops — real signal, for the "still detects"
// direction of the check.
const CLUSTERED = (() => {
  const out = IID.slice();
  for (let i = 120; i < 120 + WINDOW * 2; i++) out[i] = 6 + out[i];
  return out;
})();

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** n observations drawn from the null itself — signal-free by construction. */
const nullObservations = (material, count, seed) => {
  const out = [];
  for (let k = 0; k < count; k++) {
    out.push(STATISTICS.burstiness(PERTURBATIONS.shuffle(material, seed + k), { window: WINDOW }));
  }
  return out;
};

test("the defect: the best of n clears a one-arrival ground by construction", () => {
  const TRIALS = 40;
  const naive = [];
  const corrected = [];

  const gOne = ground({ material: IID, draws: DRAWS, window: WINDOW, statistic: "burstiness", seed: 1 });
  const gN = extremeGround({
    material: IID, draws: DRAWS, window: WINDOW, statistic: "burstiness", seed: 1, n: CANDIDATES, direction: "above",
  });
  assert.ok(!isGap(gOne) && !isGap(gN), "both grounds must form");

  for (let t = 0; t < TRIALS; t++) {
    // Seeds far from either ground's own, so the observations are independent
    // of the samples they are placed against.
    const obs = nullObservations(IID, CANDIDATES, 500000 + t * CANDIDATES);
    const best = Math.max(...obs);

    const dOne = difference(best, gOne);
    const dN = difference(best, gN);
    // Censored above is rank 0's limit: the ground could not place it at all.
    naive.push(isGap(dOne) ? 0 : dOne.rank);
    corrected.push(isGap(dN) ? 0 : dN.rank);
  }

  const mNaive = median(naive);
  const mCorrected = median(corrected);

  // A correct null places signal-free observations uniformly, so the median
  // rank is near 1/2. The one-arrival ground is nowhere near it.
  assert.ok(mNaive < 0.1, `one-arrival ground: median rank ${mNaive} — expected badly biased toward extreme`);
  assert.ok(
    mCorrected > 0.25 && mCorrected < 0.75,
    `best-of-${CANDIDATES} ground: median rank ${mCorrected} — expected approximately uniform`,
  );
});

test("and it still detects real signal — not a gate that can only refuse", () => {
  // The dual failure. A correction so conservative that nothing survives it is
  // the same null of zero width seen from the other side.
  const gN = extremeGround({
    material: CLUSTERED, draws: DRAWS, window: WINDOW, statistic: "burstiness", seed: 3, n: CANDIDATES, direction: "above",
  });
  assert.ok(!isGap(gN), "ground must form on clustered material");

  const observed = STATISTICS.burstiness(CLUSTERED, { window: WINDOW });
  const d = difference(observed, gN);
  const placed = isGap(d) ? { censored: d.gap, direction: d.direction } : { rank: d.rank };

  // Real clustering survives the best-of-50 correction: either censored above
  // (the ground cannot place it) or ranked in the top decile.
  const survives = isGap(d) ? d.gap === "exceeds_witness" && d.direction === "above" : d.rank < 0.1;
  assert.ok(survives, `real signal must survive the correction, got ${JSON.stringify(placed)}`);
});

test("n = 1 is bit-identical to the ordinary ground", () => {
  const spec = { material: IID, draws: 50, window: WINDOW, statistic: "burstiness", seed: 7 };
  const g = ground(spec);
  const g1 = extremeGround({ ...spec, n: 1, direction: "above" });
  assert.deepEqual(g1.samples, g.samples, "one arrival must be the ordinary case, not an approximation of it");
});

test("n and direction are declared, never defaulted", () => {
  const base = { material: IID, draws: 50, window: WINDOW, statistic: "burstiness", seed: 1 };
  const noN = extremeGround({ ...base, direction: "above" });
  assert.ok(isGap(noN) && noN.gap === "undeclared" && noN.what === "n");

  const noDir = extremeGround({ ...base, n: 10 });
  assert.ok(isGap(noDir) && noDir.gap === "undeclared" && noDir.what === "direction");

  const badN = extremeGround({ ...base, n: 0, direction: "above" });
  assert.ok(isGap(badN) && badN.gap === "undeclared");
});

test("above and below are different nothings and are never pooled", () => {
  const base = { material: IID, draws: 100, window: WINDOW, statistic: "burstiness", seed: 11, n: 20 };
  const up = extremeGround({ ...base, direction: "above" });
  const down = extremeGround({ ...base, direction: "below" });
  assert.ok(!isGap(up) && !isGap(down));

  // Amendment II: both are measurements. They must not be the same measurement.
  assert.notDeepEqual(up.samples, down.samples);
  assert.ok(up.samples[0] > down.samples[down.samples.length - 1] || up.samples[0] > down.samples[0]);
  assert.equal(up.spec.direction, "above");
  assert.equal(down.spec.direction, "below");
});

test("the spec carries n and direction, so #5 can refuse the comparison", () => {
  const base = { material: IID, draws: 100, window: WINDOW, statistic: "burstiness", seed: 13 };
  const g = extremeGround({ ...base, n: 20, direction: "above" });
  assert.equal(g.spec.n, 20);
  assert.equal(g.spec.direction, "above");
  // Two grounds are comparable only if built to the same spec; a best-of-20
  // nothing and a one-arrival nothing answer different questions.
  assert.notEqual(g.spec.n, ground(base).spec.n);
});

test("volume is still the sign of health on an extreme ground", () => {
  const g = extremeGround({
    material: IID, draws: 200, window: WINDOW, statistic: "burstiness", seed: 17, n: 10, direction: "above",
  });
  assert.ok(volume(g) > 0, "a nothing of zero width is refused everywhere, at every level");
});

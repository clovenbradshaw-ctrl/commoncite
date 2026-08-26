// eoreader6 · emergence/fold — a fold projects the universe from a given
// here: every position placed, or censored beyond (surfeit) or beneath
// (regularity), labelled past/contemporary/horizon against the standpoint.
//
// The suite plants the type discipline (a standpoint with nothing settled
// behind it refuses, never derives — SEED.md #1), the labelling contract
// (every projected row carries a relation and a placement), and the
// MINIMUM VIABLE GROUND calibration: the same defect atmosphere.js's
// `groundFrom` carried, re-measured for this organ's own difference()-driven
// mechanism (see fold.js's own header comment on `MIN_GROUND`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { fold, alternatives, standing } from "../packages/engine/emergence/fold.js";
import { isGap } from "../nul/index.js";

const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const iid = (seed, n) => {
  const next = rng(seed);
  return Array.from({ length: n }, () => next() * 2);
};

const W = 5;
const D = 256;

test("the declared numbers are never defaulted, and a standpoint is required", () => {
  const material = iid(1, 60);
  assert.ok(isGap(fold({ material, here: 30, window: W })), "draws must be declared");
  assert.ok(isGap(fold({ material, here: 30, draws: D })), "window must be declared");
  assert.ok(isGap(fold({ material: [], here: 0, window: W, draws: D })), "empty material refuses");
  assert.ok(isGap(fold({ material, here: -1, window: W, draws: D })), "a negative standpoint refuses");
  assert.ok(isGap(fold({ material, here: material.length, window: W, draws: D })), "a standpoint at or past the end refuses");
});

test("a standpoint with nothing settled behind it refuses — the first ground is received, never derived (SEED.md #1)", () => {
  const material = iid(2, 100);
  const g = fold({ material, here: 10 * W - 1, window: W, draws: D });
  assert.ok(isGap(g));
  assert.equal(g.gap, "no_ground");
  assert.equal(g.need, 10 * W);
  const ok = fold({ material, here: 10 * W, window: W, draws: D });
  assert.ok(!isGap(ok), "the floor itself must be viable, not merely refused right below it");
});

test("every projected row carries a relation and a placement, and the standpoint's own extent is `past`", () => {
  const material = iid(3, 120);
  const here = 60;
  const f = fold({ material, here, window: W, draws: D, seed: 1 });
  assert.ok(!isGap(f));
  assert.equal(f.projection.length, material.length - W + 1);
  for (const row of f.projection) {
    assert.ok(["past", "contemporary", "horizon"].includes(row.relation));
    assert.ok(["placed", "beyond", "beneath", "gap"].includes(row.placement));
  }
  const firstRow = f.projection[0];
  assert.equal(firstRow.relation, "past", "a window wholly before the standpoint is its own actual world");
  const lastRow = f.projection[f.projection.length - 1];
  assert.equal(lastRow.relation, "horizon", "a window at the far end lies ahead of the standpoint");
  assert.equal(f.reach.total, f.projection.length);
  assert.equal(f.reach.placed + f.reach.beyond + f.reach.beneath, f.reach.total);
});

test("standing is Whitehead's trichotomy and is exhaustive", () => {
  assert.equal(standing({ start: 0, end: 5 }, { start: 10, end: 15 }), "a-in-actual-world-of-b");
  assert.equal(standing({ start: 10, end: 15 }, { start: 0, end: 5 }), "b-in-actual-world-of-a");
  assert.equal(standing({ start: 5, end: 15 }, { start: 10, end: 20 }), "contemporaries");
});

test("alternatives refuses folds not built to one spec over one material", () => {
  const material = iid(4, 130);
  const a = fold({ material, here: 70, window: W, draws: D, seed: 1 });
  const b = fold({ material, here: 80, window: W + 1, draws: D, seed: 1 });
  assert.ok(!isGap(a) && !isGap(b));
  const alt = alternatives([a, b]);
  assert.ok(isGap(alt));
  assert.equal(alt.gap, "unknown_spec");

  const c = fold({ material, here: 90, window: W, draws: D, seed: 2 });
  const same = alternatives([a, c]);
  assert.ok(!isGap(same));
  assert.equal(same.n, a.projection.length);
});

// ── minimum viable ground, calibrated ────────────────────────────────────────

test("CALIBRATION: on iid noise, fold's ground no longer manufactures spurious surfeit at the minimum — the same defect atmosphere.js's MIN_GROUND fixed", () => {
  // `fold` builds ONE ground from `material.slice(0, here)` (burstiness/
  // shuffle, the default statistic/perturbation, unchanged by this fix) and
  // then runs `difference()` against every subsequent window's observed mean
  // — the exact difference()-driven mechanism atmosphere.js's fix addresses,
  // at this organ's own grain (a whole-material projection rather than a
  // re-zeroing stream). The cleanest single-shot analog to atmosphere.js/
  // turn.js's "does an ordinary next window clear an artificially narrow
  // ceiling" check is the FIRST post-ground window, `at = here` — the same
  // isolation challenge-7's own adversarial script used by hand
  // (`ixSeries.slice(WINDOW+2, WINDOW+2+WINDOW)`).
  //
  // Same two parameter sets atmosphere.js's own fix was calibrated against.
  // MEASURED, 2026-08-05: at the old `window + 2` floor, that first
  // post-ground window is falsely censored above on 23.5% (window=5,
  // draws=256, 200 trials) and 26.5% (window=6, draws=96, 200 trials) of
  // iid-noise trials — comparable to atmosphere.js's own worst-case range
  // (12.5-27.5%), since this organ shares the same difference()-driven
  // mechanism, not the milder pattern()-only case. At `3 * window` it fell
  // to 1.5%/1.5% — inside the 15% bar conformance/atmosphere.test.js's own
  // CALIBRATION test already holds itself to.
  //
  // `MIN_GROUND` was later raised again to `10 * window` (see its own header)
  // for a real-text content-dependent reason iid noise cannot exercise
  // (MEASURED: scripts/turn-fold-formation-min-ground-real-text-calibration.mjs
  // §2). This test stays on iid noise to confirm the wider floor costs
  // nothing here either.
  const paramSets = [
    { window: 5, draws: 256 },
    { window: 6, draws: 96 },
  ];
  const trials = 60;
  for (const { window, draws } of paramSets) {
    let beyond = 0;
    let total = 0;
    for (let t = 0; t < trials; t++) {
      const here = 10 * window; // the shipped floor
      const material = iid(9000 + t, here + window + 5);
      const f = fold({ material, here, window, draws, seed: t });
      assert.ok(!isGap(f), isGap(f) ? f.gap : "");
      const row = f.projection.find((p) => p.at === here);
      total++;
      if (row.placement === "beyond") beyond++;
    }
    assert.ok(
      beyond / total <= 0.15,
      `spurious surfeit fired on ${beyond}/${total} structureless trials at window=${window} — the minimum ground is too small again`,
    );
  }
});

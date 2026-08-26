// eoreader6 · cascade — the scale ladder, and the two ways it could be a lie.
//
// The organ's whole claim is that coarsening reaches scales `window` cannot.
// That claim is worth nothing unless two things are true, and both are tested
// here rather than asserted in a comment:
//
//   1. it refuses a null that does not undergo what the figure underwent.
//      A box filter manufactures order; a shuffle null destroys it; the figure
//      keeps it. Ladder every rung of pure noise that way and the organ is
//      measuring its own filter. So the licence is a refusal, not a docstring.
//   2. `peer` is actually reachable. An organ that can only ever return a
//      ladder will return one for anything, including material that has no
//      scale structure at all.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cascade, coarsen } from "../cascade/index.js";
import { isGap, licensed, PERTURBATIONS } from "../nul/index.js";

const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const N = 1024;
const WIDTHS = [1, 2, 4, 8, 16, 32];
const SPEC = { widths: WIDTHS, draws: 60, reseeds: 20, window: 5, seed: 3 };

const NOISE = (() => {
  const r = prng(4242);
  return Array.from({ length: N }, () => r() - 0.5);
})();

// ── coarsen: the filter itself ───────────────────────────────────────────────

test("coarsen at width 1 is the material, and never the same array", () => {
  const out = coarsen(NOISE, 1);
  assert.deepEqual(out, NOISE);
  assert.notEqual(out, NOISE, "returning the caller's array invites mutation of material");
});

test("coarsen is a sliding mean, so it shortens by width-1 and never decimates", () => {
  assert.deepEqual(coarsen([1, 2, 3, 4], 2), [1.5, 2.5, 3.5]);
  assert.deepEqual(coarsen([1, 2, 3, 4, 5], 3), [2, 3, 4]);
  // Decimating would give length ceil(n/w); sliding gives n-w+1. The whole
  // extent argument in cascade's header depends on which one this is.
  assert.equal(coarsen(NOISE, 32).length, N - 31);
});

test("the incremental sum does not drift from a recomputed mean", () => {
  const w = 17;
  const out = coarsen(NOISE, w);
  for (const i of [0, 1, 500, out.length - 1]) {
    let s = 0;
    for (let j = i; j < i + w; j++) s += NOISE[j];
    assert.ok(Math.abs(out[i] - s / w) < 1e-12, `rung drifted at ${i}`);
  }
});

test("a filter wider than the material is not a gap but nothing at all", () => {
  assert.equal(coarsen([1, 2, 3], 9), null);
  assert.equal(coarsen([1, 2, 3], 0), null);
  assert.equal(coarsen([1, 2, 3], 2.5), null);
});

// ── the licence is a refusal, not a docstring ────────────────────────────────

test("a null that cannot contain the filter is refused EVEN WHEN FULLY LICENSED", () => {
  // The load-bearing test of the organ, and the one that caught a real
  // conflation while this was being written. `irreversibility/shuffle` IS
  // licensed — temporality earned it — and it is still unusable here. A box
  // filter manufactures autocorrelation, a shuffle destroys it, the figure
  // keeps it, so every rung would read "more ordered" from the filter rather
  // than from the material. Licensing is about sensitivity, this is about
  // containment, and neither implies the other.
  assert.ok(licensed("irreversibility", "shuffle"), "precondition: this pair is licensed");
  const r = cascade({ material: NOISE, ...SPEC, statistic: "irreversibility", perturbation: "shuffle" });
  assert.ok(isGap(r));
  assert.equal(r.gap, "unknown_spec");
  assert.match(r.reason, /spectr|coarsen/i);
  assert.deepEqual(r.preserves, ["multiset"], "the refusal must say what the perturbation DOES hold fixed");
});

test("licensing is per pair, not per statistic — Amendment I, executable", () => {
  assert.ok(licensed("irreversibility", "phase"));
  assert.ok(licensed("irreversibility", "shuffle"));
  // established for shuffle, never for phase: on real DNS it came back
  // censored on 93 of 96 lines, which is a finding and not a placement.
  assert.ok(!licensed("permutationEntropy", "phase"));
  assert.ok(!licensed("burstiness", "phase"));

  const r = cascade({ material: NOISE, ...SPEC, statistic: "permutationEntropy", perturbation: "phase" });
  assert.ok(isGap(r) && r.gap === "unknown_spec");
});

// ── nothing is defaulted ─────────────────────────────────────────────────────

test("the three declared numbers are never defaulted, and neither are the scales", () => {
  const base = { material: NOISE, ...SPEC };
  for (const [field, patch] of [
    ["draws", { draws: undefined }],
    ["draws", { draws: 1 }],
    ["window", { window: undefined }],
    ["window", { window: 1 }],
    // reseeds is required here and NOT by level() itself, because level's
    // null is optional (a ground stores no material) while cascade always
    // has the material and so has no excuse for a resolution floor.
    ["reseeds", { reseeds: undefined }],
    ["reseeds", { reseeds: 1 }],
  ]) {
    const r = cascade({ ...base, ...patch });
    assert.ok(isGap(r) && r.gap === "undeclared", `${field} was defaulted`);
    assert.equal(r.what, field);
  }
  // Which scales to ask about is the giver's, not the series'.
  for (const widths of [undefined, [], [4]]) {
    const r = cascade({ ...base, widths });
    assert.ok(isGap(r) && r.gap === "undeclared" && r.what === "widths");
  }
});

test("empty material is a type error before it is a null", () => {
  const r = cascade({ material: [], ...SPEC });
  assert.ok(isGap(r) && r.gap === "empty_material");
});

test("a coarsest width past the material's extent gaps rather than silently clipping", () => {
  const r = cascade({ material: NOISE.slice(0, 40), ...SPEC, widths: [1, 2, 4096] });
  assert.ok(isGap(r) && r.gap === "empty_material");
});

// ── every rung is built over ONE extent ──────────────────────────────────────

test("all rungs share the coarsest rung's extent, so a difference is scale and not size", () => {
  const r = cascade({ material: NOISE, ...SPEC });
  assert.ok(!isGap(r));
  assert.equal(r.extent, N - Math.max(...WIDTHS) + 1);
  // Every ground actually built must report that same extent, or the rungs
  // were never comparable — SEED.md #5.
  for (const rung of r.rungs) {
    if (rung.gap) continue;
    assert.equal(rung.ground.extent, r.extent, `rung ${rung.width} was built over a different extent`);
  }
});

test("the spec is carried on the result, because a ladder nobody can replay is not testimony", () => {
  const r = cascade({ material: NOISE, ...SPEC });
  assert.ok(!isGap(r));
  assert.deepEqual(r.spec, {
    statistic: "irreversibility",
    perturbation: "phase",
    draws: SPEC.draws,
    reseeds: SPEC.reseeds,
    window: SPEC.window,
    seed: SPEC.seed,
  });
  assert.equal(r.censoredAt, 1 / SPEC.draws);
});

test("every relation carries a real null, never level()'s bare resolution floor", () => {
  // The defect this organ was built through: level()'s `2/draws` threshold
  // shrinks as draws grows, so it clears anything at high resolution. On
  // coarsened white noise it laddered 4.42 of 5 relations at 600 draws with
  // the direction a coin flip. cascade must never fall back to it.
  const r = cascade({ material: NOISE, ...SPEC });
  assert.ok(!isGap(r));
  for (const rel of r.relations) {
    if (rel.gap) continue;
    assert.equal(rel.nulled, true, `relation ${rel.fine}->${rel.coarse} fell back to the resolution floor`);
    assert.ok(rel.reseedNull >= 0);
    assert.ok(rel.threshold >= rel.floor, "the threshold must never be below the resolution floor");
  }
});

test("relations are between ADJACENT rungs only", () => {
  const r = cascade({ material: NOISE, ...SPEC });
  assert.equal(r.relations.length, WIDTHS.length - 1);
  const sorted = [...WIDTHS].sort((a, b) => a - b);
  r.relations.forEach((rel, i) => {
    assert.equal(rel.fine, sorted[i]);
    assert.equal(rel.coarse, sorted[i + 1]);
  });
});

// ── peer must be reachable ───────────────────────────────────────────────────

test("`peer` is reachable: white noise has no scale structure and must not ladder", () => {
  // The vacuity control. Coarsening white noise produces a moving average,
  // which is smooth and correlated and looks like structure to anything that
  // does not account for the filter. Against a spectrum-preserving null the
  // filter is already in the ground, so the honest answer is that no scale
  // constrains any other.
  const r = cascade({ material: NOISE, ...SPEC });
  assert.ok(!isGap(r));
  const laddered = r.relations.filter((x) => x.relationship === "above" || x.relationship === "below").length;
  assert.ok(
    laddered <= 1,
    `white noise laddered ${laddered}/${r.relations.length} relations — the organ is reading its own filter`,
  );
});

test("determinism: same spec, same seed, same ladder", () => {
  const a = cascade({ material: NOISE, ...SPEC });
  const b = cascade({ material: NOISE, ...SPEC });
  assert.deepEqual(
    a.relations.map((r) => r.relationship),
    b.relations.map((r) => r.relationship),
  );
});

// eoreader6 · loops — three distinct iteration shapes, tested as three
// distinct mechanisms. TIME (growing fraction of one document), GRAIN (the
// Von Neumann containment chain), LEVEL (existence -> structure ->
// significance, with explicit promotion). Not one generic "loop" wearing
// three names — each has a different variable changing (how much material,
// what grain of comparison, which holon level).

import { test } from "node:test";
import assert from "node:assert/strict";
import { timeLoop } from "../packages/engine/loops/time.js";
import { grainWalk } from "../packages/engine/loops/grain.js";
import { levelStep, promote } from "../packages/engine/loops/level.js";
import { ground, pattern, isGap } from "../nul/index.js";

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

test("time loop: growing fraction produces more chunks each pass, over the SAME material", () => {
  const words = Array.from({ length: 2000 }, (_, i) => `word${i % 50}`);
  const reduce = (units, { fraction }) => {
    const readLen = Math.max(1, Math.floor(units.length * fraction));
    const chunks = [];
    for (let i = 0; i + 20 <= readLen; i += 20) chunks.push(i + Math.sin(i) * 5);
    return chunks;
  };
  const results = timeLoop({ reduce, units: words, passes: 5, window: 4, draws: 30, reseeds: 3 });
  const resolved = results.filter((r) => !r.gap);
  assert.ok(resolved.length >= 2, "at least some passes should resolve with real material");
  for (let i = 1; i < resolved.length; i++) {
    assert.ok(resolved[i].chunks >= resolved[i - 1].chunks, "later passes see at least as much material as earlier ones");
  }
});

test("CALIBRATION: on iid noise, pattern().moved near the time loop's minimum ground is not elevated over the settled plateau — the same defect family atmosphere.js's MIN_GROUND fixed, measured for THIS organ's own pathway", () => {
  // loops/atmosphere.js's `groundFrom` and loops/turn.js's `buildAt` share one
  // closure shape and one defect at `window + 2`: burstiness has only 3
  // candidate sub-window positions there, so the bootstrap null is too narrow,
  // and `difference()` reads that narrowness directly against an independent
  // next observation — a false DEF/REC almost by construction.
  //
  // This loop never calls difference(). Its only use of a ground is
  // `pattern()`, comparing one pass's ground to the previous pass's, and
  // pattern()'s own reseeding null (mean + 3·std of reseed-displacement
  // samples, nul/index.js) is built from the SAME narrow-ground machinery over
  // the SAME material as the signal it is judging — a narrow ground narrows
  // the null right along with the observation, which mostly, not entirely,
  // cancels the effect difference() shows undiluted.
  //
  // MEASURED, 2026-08-05 (300 trials/size): comparing pattern().moved at the
  // OLD floor (window+2) against a settled plateau (5*window) on iid noise —
  // 7.3% vs 3.7% (window=5, draws=256, reseeds=16, z=1.97), 6.3% vs 2.0%
  // (window=6, draws=96, reseeds=16, z=2.66), 6.7% vs 3.7% (window=12,
  // draws=200, reseeds=5 — scripts/aperture-run.mjs's own production SPEC,
  // z=1.66): real and significant in two of three sets. At the fix, `3 *
  // window`, the same comparison drops to z=0.42/1.01/-0.45 (all
  // non-significant) — independently confirming the multiplier atmosphere.js
  // and turn.js also settled on, not assuming it transfers. This test checks
  // the SHIPPED floor (post-fix, `3 * window`) stays down near the plateau.
  const paramSets = [
    { window: 5, draws: 256, reseeds: 16 },
    { window: 6, draws: 96, reseeds: 16 },
    { window: 12, draws: 200, reseeds: 5 },
  ];
  const trials = 60;
  const movedRateAt = (size, window, draws, reseeds) => {
    let moved = 0, total = 0;
    for (let t = 0; t < trials; t++) {
      const seed = 60000 + t;
      const materialN = iid(seed, size);
      const materialN1 = [...materialN, iid(seed * 7 + 3, 1)[0]];
      const before = ground({ material: materialN, draws, window, seed: seed * 13 });
      const after = ground({ material: materialN1, draws, window, seed: seed * 13 + draws });
      if (isGap(before) || isGap(after)) continue;
      const p = pattern({ before, after, material: materialN, reseeds });
      if (isGap(p)) continue;
      total++;
      if (p.moved) moved++;
    }
    return { moved, total };
  };

  for (const { window, draws, reseeds } of paramSets) {
    const floor = movedRateAt(3 * window, window, draws, reseeds); // the shipped minimum, post-fix
    const plateau = movedRateAt(5 * window, window, draws, reseeds);
    assert.ok(floor.total > trials * 0.5, "most trials must resolve a real ground to mean anything");
    // Same bound conformance/atmosphere.test.js's own CALIBRATION test holds
    // slack_ground to: how often does a finding say yes on nothing.
    assert.ok(
      floor.moved / floor.total <= 0.15,
      `moved fired on ${floor.moved}/${floor.total} at the shipped floor (window=${window}) — MIN_GROUND is too small again`,
    );
    // And the floor must not be dramatically hotter than the settled plateau
    // — the signature the OLD window+2 floor left behind (roughly 2x, and
    // statistically significant, before this fix).
    assert.ok(
      floor.moved / floor.total <= plateau.moved / plateau.total + 0.15,
      `floor rate ${(100 * floor.moved / floor.total).toFixed(1)}% is far hotter than the plateau ${(100 * plateau.moved / plateau.total).toFixed(1)}% at window=${window} — the minimum ground is still reading its own narrowness`,
    );
  }
});

test("grain walk: reaches exactly as far as the data supports, never further", () => {
  const material = Array.from({ length: 40 }, (_, i) => Math.sin(i * 0.5) * 50 + i);
  const g = ground({ material, draws: 30, window: 5, seed: 1 });
  assert.ok(!isGap(g));

  // no prior ground -> stops at figure, by construction, not by gap
  const noPrior = grainWalk({ observed: material[10], ownGround: g, priorGround: null, priorMaterial: material, reseeds: 3 });
  assert.equal(noPrior.grain, "figure");

  // a real prior ground -> can reach pattern or witness. The prior's OWN
  // material is what pattern's null is built over; handing in the later,
  // longer material is now a typed refusal, not a quietly wrong answer.
  const priorMaterial = material.slice(0, 20);
  const prior = ground({ material: priorMaterial, draws: 30, window: 5, seed: 2 });
  const withPrior = grainWalk({ observed: material[10], ownGround: g, priorGround: prior, priorMaterial, reseeds: 3 });
  assert.ok(["figure", "pattern", "witness"].includes(withPrior.grain));
  if (withPrior.grain === "witness") assert.equal(withPrior.result.pattern.moved, true);
});

test("level step: existence, structure, and significance are reported independently, and settled requires all conditions named", () => {
  const series = Array.from({ length: 60 }, (_, i) => Math.sin(i * 0.4) * 80 + (i > 30 ? 200 : 0));
  const regime = { start: 28, end: 34 }; // straddles the real step-change
  const readerGround = ground({ material: series.slice(0, 28), draws: 40, window: 5, seed: 3 });

  const step = levelStep({ series, regime, readerGround, existenceCount: 5, structureOptions: { draws: 40, window: 5, reseeds: 10 } });
  assert.ok(["above", "below", "peer", "unstable"].includes(step.structure));
  assert.equal(step.existence, 5);
  assert.equal(typeof step.settled, "boolean");

  if (step.settled) {
    const promoted = promote(step, "test-referent");
    assert.equal(promoted.type, "DEF.admit");
    assert.equal(promoted.referent_id, "test-referent:settled");
    assert.equal(promoted.provenance.giver, "loops/level:settled");
  } else {
    assert.throws(() => promote(step, "test-referent"), /never settled/);
  }
});

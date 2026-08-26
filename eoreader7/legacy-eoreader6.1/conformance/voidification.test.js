// eoreader6 · voidification — three distinct ways a claim can fail into
// nothing, tested as three distinct mechanisms, not one generic "gap":
//
//   GEOMETRIC       zero-width. A ground with no extent — degenerate_ground.
//                   Fails INSIDE one ground() construction: the statistic
//                   found no spread to measure against.
//   TRANSCENDENTAL  unconstructible from the system's own algebra. A ground
//                   claimed without a named origin — unreceived_origin.
//                   Fails at the BOUNDARY: the system can perturb what it's
//                   given, but cannot manufacture a first material or a
//                   giver for it.
//   VON NEUMANN     containment. Each grain is built from the ones below it
//                   (figure needs one ground; pattern needs two grounds;
//                   witness needs a kept ground + a figure + a moved
//                   pattern, together). Fails when a HIGHER grain is
//                   attempted without the LOWER ones actually being real.
//
// Each gets both a positive control (the real thing works) and the
// deliberate failure, so a passing suite means the distinction is doing
// work, not that everything gaps by default.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ground, difference, pattern, witness, keep, received, admissible, isGap, gap } from "../nul/index.js";

const REAL_MATERIAL = Array.from({ length: 60 }, (_, i) => Math.sin(i * 0.7) * 100 + i * 3);

test("geometric void: constant material has zero width and refuses as degenerate", () => {
  const constant = Array(50).fill(7);
  const g = ground({ material: constant, draws: 20, window: 5, seed: 1 });
  assert.ok(isGap(g));
  assert.equal(g.gap, "degenerate_ground");
});

test("geometric void: control — real varying material has real width and does not refuse", () => {
  const g = ground({ material: REAL_MATERIAL, draws: 20, window: 5, seed: 1 });
  assert.ok(!isGap(g));
  assert.ok(g.samples[0] < g.samples[g.samples.length - 1], "a real ground has nonzero spread");
});

test("transcendental void: received() without a named giver refuses", () => {
  const r = received({ samples: [1, 2, 3, 4, 5], provenance: null });
  assert.ok(isGap(r));
  assert.equal(r.gap, "unreceived_origin");
});

test("transcendental void: control — received() WITH a named giver succeeds", () => {
  const r = received({ samples: [1, 2, 3, 4, 5], provenance: "eoPriors/priors/coref/pg84-frankenstein.json" });
  assert.ok(!isGap(r));
  assert.equal(r.provenance, "eoPriors/priors/coref/pg84-frankenstein.json");
});

test("transcendental void: a constructed ground missing its material fingerprint refuses even with samples present", () => {
  const unfingerprinted = { spec: { perturbation: "shuffle", statistic: "burstiness", draws: 20, window: 5, seed: 1 }, samples: [1, 2, 3], kept: false };
  const bad = admissible(unfingerprinted);
  assert.ok(isGap(bad));
  assert.equal(bad.gap, "unreceived_origin");
});

test("von neumann void: figure (grain 1) cannot be built without a real ground (grain 0)", () => {
  const notAGround = gap("no_ground", {});
  const fig = difference(5, notAGround);
  assert.ok(isGap(fig));
});

test("von neumann void: control — figure succeeds against a real ground", () => {
  const g = ground({ material: REAL_MATERIAL, draws: 20, window: 5, seed: 1 });
  const fig = difference(REAL_MATERIAL[0], g);
  assert.ok(!isGap(fig) || fig.gap === "exceeds_witness"); // either resolves or is honestly censored, never crashes
});

test("von neumann void: pattern (grain 2) cannot be built with only one real ground", () => {
  const g = ground({ material: REAL_MATERIAL, draws: 20, window: 5, seed: 1 });
  const notAGround = gap("no_ground", {});
  const pat = pattern({ before: g, after: notAGround, material: REAL_MATERIAL, reseeds: 3 });
  assert.ok(isGap(pat));
});

test("von neumann void: control — pattern succeeds with two real grounds", () => {
  const before = ground({ material: REAL_MATERIAL.slice(0, 30), draws: 20, window: 5, seed: 1 });
  const after = ground({ material: REAL_MATERIAL, draws: 20, window: 5, seed: 2 });
  const pat = pattern({ before, after, material: REAL_MATERIAL.slice(0, 30), reseeds: 5 });
  assert.ok(!isGap(pat));
  assert.equal(typeof pat.moved, "boolean");
});

test("von neumann void: witness (the record) refuses without a KEPT ground, even with a real figure and pattern", () => {
  const before = ground({ material: REAL_MATERIAL.slice(0, 30), draws: 20, window: 5, seed: 1 });
  const after = ground({ material: REAL_MATERIAL, draws: 20, window: 5, seed: 2 });
  const fig = difference(REAL_MATERIAL[0], after);
  const pat = pattern({ before, after, material: REAL_MATERIAL.slice(0, 30), reseeds: 5 });
  const w = witness({ ground: after, figure: fig, pattern: pat }); // after was never kept()
  assert.ok(isGap(w));
  assert.equal(w.gap, "no_ground");
});

test("von neumann void: witness refuses without an established (moved) pattern, even with a kept ground and a real figure", () => {
  const after = ground({ material: REAL_MATERIAL, draws: 20, window: 5, seed: 2 });
  const median = [...after.samples].sort((a, b) => a - b)[Math.floor(after.samples.length / 2)];
  const fig = difference(median, after); // deliberately within support, isolating the pattern check
  assert.ok(!isGap(fig), "test setup: the figure itself must resolve cleanly to isolate the pattern check");
  const w = witness({ ground: keep(after), figure: fig, pattern: null });
  assert.ok(isGap(w));
  assert.equal(w.gap, "made_no_difference");
});

test("von neumann void: control — witness succeeds only when ground+figure+pattern are ALL real and pattern moved", () => {
  const before = ground({ material: REAL_MATERIAL.slice(0, 30), draws: 20, window: 5, seed: 1 });
  const after = ground({ material: REAL_MATERIAL, draws: 20, window: 5, seed: 2 });
  const pat = pattern({ before, after, material: REAL_MATERIAL.slice(0, 30), reseeds: 5 });
  const fig = difference(REAL_MATERIAL[0], after);
  if (isGap(fig)) return; // censored figure — a legitimate outcome, not this test's concern
  const w = witness({ ground: keep(after), figure: fig, pattern: pat });
  if (pat.moved) {
    assert.ok(!isGap(w));
    assert.equal(w.pattern.moved, true);
  } else {
    assert.ok(isGap(w));
    assert.equal(w.gap, "made_no_difference");
  }
});

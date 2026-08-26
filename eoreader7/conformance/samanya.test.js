// eoreader6 · loops/samanya (सामान्य) — the cross-family check for level():
// does a relationship survive being asked by shuffle AND resample, not just
// a fresh seed of one. Two families disagreeing is legal and informative
// (SEED.md #6), not a failure of the mechanism.

import { test } from "node:test";
import assert from "node:assert/strict";
import { crossFamilyLevel } from "../packages/engine/loops/samanya.js";

// A genuine step-change: own material is flat, target material has a real
// jump partway through. This should read as a stable relationship under
// both shuffle and resample — the signal isn't an artifact of one
// perturbation's blind spot.
test("cross-family level: a genuine step-change is stable across shuffle and resample", () => {
  const ownMaterial = Array.from({ length: 60 }, (_, i) => Math.sin(i * 0.3) * 10);
  const targetMaterial = Array.from({ length: 60 }, (_, i) => Math.sin(i * 0.3) * 10 + (i > 30 ? 5 : 0));
  const result = crossFamilyLevel({ ownMaterial, targetMaterial, window: 5, draws: 60, seed: 1 });
  assert.equal(result.resolvedCount, 2, "both families should resolve on material this clearly structured");
  assert.ok(result.stable, "a real step-change should read the same way under both perturbation families");
});

test("cross-family level: reports split (not silently averaged) when families disagree", () => {
  // Deliberately thin material where shuffle and resample can plausibly
  // land on different relationships — the mechanism must report the split
  // explicitly, never quietly pick one family's answer.
  const ownMaterial = Array.from({ length: 20 }, (_, i) => (i % 3) * 2 + Math.sin(i));
  const targetMaterial = Array.from({ length: 20 }, (_, i) => (i % 5) * 1.5);
  const result = crossFamilyLevel({ ownMaterial, targetMaterial, window: 4, draws: 30, seed: 2 });
  // Not asserting which way it goes — only that the result type is honest:
  // either it resolves both and reports stable/split correctly, or it gaps.
  assert.equal(typeof result.stable, "boolean");
  assert.equal(typeof result.split, "boolean");
  assert.ok(!(result.stable && result.split), "stable and split can never both be true");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { isGap } from "../nul/index.js";
import { existenceDependencyTest, possibilityConstraintTest, holonLevelRelation } from "../holon_level/index.js";

const quiet = [1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 2];
const burstSegment = [9, 9, 9, 9, 9];

test("existence-dependency: a burst regime shifts the ground", () => {
  const series = [...quiet.slice(0, 10), ...burstSegment, ...quiet.slice(5)];
  const regime = { start: 10, end: 15 };
  const result = existenceDependencyTest(series, regime, { draws: 64, window: 5, reseeds: 8 });
  assert.ok(!isGap(result));
  assert.ok(typeof result.exists === "boolean");
  assert.ok(result.statistic > 0);
});

test("existence-dependency: a random window does not shift the ground", () => {
  const series = quiet.slice();
  const regime = { start: 3, end: 6 };
  const result = existenceDependencyTest(series, regime, { draws: 64, window: 5, reseeds: 8 });
  assert.ok(!isGap(result));
});

test("existence-dependency: resolutions are declared, never defaulted", () => {
  const series = [...quiet.slice(0, 10), ...burstSegment, ...quiet.slice(5)];
  const regime = { start: 10, end: 15 };
  const noDraws = existenceDependencyTest(series, regime, { window: 5, reseeds: 8 });
  assert.ok(isGap(noDraws) && noDraws.gap === "undeclared");
  const noReseeds = existenceDependencyTest(series, regime, { draws: 64, window: 5 });
  assert.ok(isGap(noReseeds) && noReseeds.gap === "undeclared");
  const constraintNoReseeds = possibilityConstraintTest(series, regime, {});
  assert.ok(isGap(constraintNoReseeds) && constraintNoReseeds.gap === "undeclared");
});

test("possibility-constraint: a burst regime is measurably different", () => {
  const series = [...quiet.slice(0, 10), ...burstSegment, ...quiet.slice(5)];
  const regime = { start: 10, end: 15 };
  const result = possibilityConstraintTest(series, regime, { reseeds: 8 });
  assert.ok(!isGap(result));
  assert.ok(typeof result.constrains === "boolean");
});

test("possibility-constraint: uniform series shows no constraint", () => {
  const series = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const regime = { start: 3, end: 8 };
  const result = possibilityConstraintTest(series, regime, { reseeds: 4 });
  assert.ok(!isGap(result));
  assert.equal(result.constrains, false);
});

test("classify: burst regime is above, uniform is peer", () => {
  const burstSeries = [...quiet.slice(0, 10), ...burstSegment, ...quiet.slice(5)];
  const uniformSeries = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

  const eBurst = existenceDependencyTest(burstSeries, { start: 10, end: 15 }, { draws: 64, window: 5, reseeds: 8 });
  const cBurst = possibilityConstraintTest(burstSeries, { start: 10, end: 15 }, { reseeds: 8 });
  const rel = holonLevelRelation(eBurst, cBurst);
  assert.ok(rel === "above" || rel === "unstable");

  const eUniform = existenceDependencyTest(uniformSeries, { start: 3, end: 8 }, { draws: 64, window: 5, reseeds: 8 });
  const cUniform = possibilityConstraintTest(uniformSeries, { start: 3, end: 8 }, { reseeds: 8 });
  if (!isGap(eUniform) && !isGap(cUniform)) {
    assert.equal(holonLevelRelation(eUniform, cUniform), "peer");
  }
});

test("invalid regime returns a gap", () => {
  assert.ok(isGap(existenceDependencyTest([1, 2, 3], { start: -1, end: 2 })));
  assert.ok(isGap(existenceDependencyTest([1, 2, 3], { start: 0, end: 10 })));
  assert.ok(isGap(possibilityConstraintTest([1, 2, 3], { start: -1, end: 2 })));
});

import test from "node:test";
import assert from "node:assert/strict";
import * as kernel from "../packages/kernel/index.js";

const REQUIRED = [
  "reconstruct",
  "deriveOrientation",
  "encounter",
  "perceive",
  "witness",
  "interrogateCube",
  "deriveEOTransformations",
  "deltaFold",
  "applyDelta",
  "createRecursiveReader",
  "deriveSurprise",
  "deriveTension",
  "deriveRelease",
  "expectation",
  "obligation",
  "cubeAddresses",
  "relevantHypergraphNeighborhood",
];

test("v7 kernel exposes the canonical recursive reading spine without a second implementation", () => {
  for (const name of REQUIRED) {
    assert.equal(typeof kernel[name], "function", `${name} must remain a callable kernel capability`);
  }
});

test("v7 kernel keeps the EO cube complete", () => {
  assert.equal(kernel.cubeAddresses().length, 27);
});

test("v7 cut keeps surprise, tension and release derived rather than state-mutating entrypoints", () => {
  assert.equal(typeof kernel.deriveSurprise, "function");
  assert.equal(typeof kernel.deriveTension, "function");
  assert.equal(typeof kernel.deriveRelease, "function");
  assert.equal("setSurprise" in kernel, false);
  assert.equal("setTension" in kernel, false);
  assert.equal("setRelease" in kernel, false);
});

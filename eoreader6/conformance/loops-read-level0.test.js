// eoreader6 · conformance/loops-read-level0 — packages/engine/loops/read-level0.js
// is scripts/read.mjs's own level-0 loop promoted to a callable organ. These
// tests check the wiring (does a real repeating series produce real motifs
// and real levelStep results, do declared option overrides actually take
// effect) — not the individual statistics themselves, which
// conformance/holon_level.test.js and conformance/level.test.js already own.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readLevel0, STRUCTURE_OPTIONS, READER_OPTIONS } from "../packages/engine/loops/read-level0.js";

// A genuinely repeating motif (not the single-occurrence burst holon_level's
// own fixture uses) — findRecurringMotifs needs real recurrence to find
// anything at all.
const motif = [1, 5, 2, 8, 3];
const fillerBetween = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
const repeatingSeries = [];
for (let i = 0; i < 8; i++) repeatingSeries.push(...motif, ...fillerBetween);

test("STRUCTURE_OPTIONS and READER_OPTIONS are read.mjs's own literals, exported so a recheck can reuse them exactly", () => {
  assert.deepEqual(STRUCTURE_OPTIONS, { draws: 40, window: 4, reseeds: 10 });
  assert.deepEqual(READER_OPTIONS, { draws: 150, window: 8, seed: 11 });
});

test("a genuinely repeating series produces real motifs and real levelStep results", () => {
  const r = readLevel0(repeatingSeries);
  assert.ok(r.motifsFound > 0, "the motif detector should find the repeating pattern");
  assert.ok(r.results.length > 0);
  for (const step of r.results) {
    assert.ok(["above", "peer", "unstable"].includes(step.structure));
    assert.equal(typeof step.settled, "boolean");
    assert.ok(step.regime && Number.isInteger(step.regime.start) && Number.isInteger(step.regime.end));
  }
});

test("motifOptions overrides are respected, not silently ignored — an unreachable minOccurrences finds nothing", () => {
  const r = readLevel0(repeatingSeries, { motifOptions: { minOccurrences: 100 } });
  assert.equal(r.motifsFound, 0);
  assert.equal(r.results.length, 0);
});

test("a series too short for any motif to clear the reader window returns cleanly, not a throw", () => {
  const r = readLevel0([1, 2, 3]);
  assert.equal(r.results.length, 0);
});

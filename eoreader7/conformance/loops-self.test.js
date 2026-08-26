// eoreader6 · conformance/loops-self — packages/engine/loops/self.js wires
// promote()'s DEF.admit output to somewhere it can be asked again: a ledger
// of the engine's own settled testimony, and a recheck that re-runs the SAME
// Born-null-gated holon_level tests loops/level.js already ran, over the
// same regime bounds and the same ORIGINAL EXTENT, against whatever material
// now occupies that same-sized window — and builds its own reader-ground
// from that same material, at that same regime position, exactly the way
// loops/read-level0.js's level-0 loop built the original.
//
// The burst-series fixture is holon_level.test.js's own: a quiet baseline
// with one clearly distinguishable burst regime, so a real levelStep call
// settles deterministically rather than needing a hand-tuned readerGround.

import { test } from "node:test";
import assert from "node:assert/strict";
import { levelStep } from "../packages/engine/loops/level.js";
import { ground, isGap } from "../nul/index.js";
import {
  createTestimonyLedger,
  commitTestimony,
  recheckTestimony,
  classifyFresh,
  SELF,
  SELF_MISMATCH,
  WORLD,
} from "../packages/engine/loops/self.js";

const quiet = [1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 2];
const burstSegment = [9, 9, 9, 9, 9];
const burstSeries = [...quiet.slice(0, 10), ...burstSegment, ...quiet.slice(5)];
const burstRegime = { start: 10, end: 15 };
const structureOptions = { draws: 64, window: 5, reseeds: 8 };
const readerOptions = { draws: 150, window: 5, seed: 11 };

// The reader ground a real commit at burstRegime would be judged against:
// everything before the regime's own start — the exact construction
// recheckTestimony now does internally, built once here only so the
// "precondition" and "first commit settles" tests can see the same number
// recheckTestimony will produce, not a second independent one.
const commitReaderGround = ground({ material: burstSeries.slice(0, burstRegime.start), ...readerOptions });

const fakeSettled = (regimeStart, overrides = {}) =>
  Object.freeze({
    regime: { start: regimeStart, end: regimeStart + 5 },
    structure: "above",
    significance: 0.95,
    settled: true,
    existence: 4,
    ...overrides,
  });

test("precondition: the reader ground a real commit is judged against builds cleanly, and the burst regime actually settles", () => {
  assert.ok(!isGap(commitReaderGround));
  const step = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  assert.equal(step.structure, "above");
  assert.ok(step.settled, `expected the burst regime to settle; got significance=${step.significance}`);
});

test("commitTestimony refuses an unsettled result, same discipline promote() enforces", () => {
  assert.throws(() => commitTestimony(createTestimonyLedger(), { settled: false }, { sourceId: "s", admissionHash: "h1", seriesExtent: 20 }));
});

test("commitTestimony refuses a missing sourceId, admissionHash, or seriesExtent", () => {
  const ledger = createTestimonyLedger();
  assert.throws(() => commitTestimony(ledger, fakeSettled(10), { admissionHash: "h1", seriesExtent: 20 }));
  assert.throws(() => commitTestimony(ledger, fakeSettled(10), { sourceId: "s", seriesExtent: 20 }));
  assert.throws(() => commitTestimony(ledger, fakeSettled(10), { sourceId: "s", admissionHash: "h1" }));
});

test("commitTestimony refuses a seriesExtent that doesn't even cover the regime it's supposed to explain", () => {
  const ledger = createTestimonyLedger();
  assert.throws(() => commitTestimony(ledger, fakeSettled(10), { sourceId: "s", admissionHash: "h1", seriesExtent: 12 }));
});

test("recheckTestimony with no prior commits for the source returns nothing to recheck", () => {
  const ledger = createTestimonyLedger();
  const result = recheckTestimony(ledger, { series: burstSeries, sourceId: "s", admissionHash: "h2", structureOptions, readerOptions });
  assert.deepEqual(result, []);
});

test("recheckTestimony never rechecks a commit against its OWN admission (same admissionHash)", () => {
  const ledger = createTestimonyLedger();
  commitTestimony(ledger, fakeSettled(10), { sourceId: "s", admissionHash: "h1", seriesExtent: 20 });
  const result = recheckTestimony(ledger, { series: burstSeries, sourceId: "s", admissionHash: "h1", structureOptions, readerOptions });
  assert.deepEqual(result, []);
});

test("SELF: a real committed claim reconfirms against material where the burst still exists, even after LARGE unrelated growth", () => {
  const ledger = createTestimonyLedger();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  assert.ok(first.settled);
  commitTestimony(ledger, first, { sourceId: "s", admissionHash: "h1", seriesExtent: burstSeries.length });

  // A large amount of unrelated quiet material appended after the burst.
  // Before extent-matching this flipped an untouched regime to unstable at
  // +10 already (measured directly while building this file) — the whole
  // point of committing seriesExtent is that a recheck truncates back to it,
  // so growth this large downstream must not move the verdict at all.
  const grownALot = [...burstSeries, ...quiet, ...quiet, ...quiet];
  const rechecks = recheckTestimony(ledger, { series: grownALot, sourceId: "s", admissionHash: "h2", structureOptions, readerOptions });
  assert.equal(rechecks.length, 1);
  assert.equal(rechecks[0].tag, SELF, JSON.stringify(rechecks[0].recheck));
  assert.equal(rechecks[0].commit.sourceId, "s");
});

test("SELF_MISMATCH: the same committed claim fails to reconfirm once the burst is gone, even with no growth at all", () => {
  const ledger = createTestimonyLedger();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  assert.ok(first.settled);
  commitTestimony(ledger, first, { sourceId: "s", admissionHash: "h1", seriesExtent: burstSeries.length });

  // Revised admission: the exact same byte range that used to hold the burst
  // now holds ordinary quiet material — a real edit, not noise, and the
  // series is the same length as the original (no extent confound possible).
  const flattened = [...quiet.slice(0, 10), ...quiet.slice(0, 5), ...quiet.slice(5)];
  assert.equal(flattened.length, burstSeries.length);
  const rechecks = recheckTestimony(ledger, { series: flattened, sourceId: "s", admissionHash: "h3", structureOptions, readerOptions });
  assert.equal(rechecks.length, 1);
  assert.equal(rechecks[0].tag, SELF_MISMATCH);
});

test("SELF_MISMATCH: an edit inside the original span still mismatches even after unrelated tail growth (extent-matching truncates the tail away, not the edit)", () => {
  const ledger = createTestimonyLedger();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  assert.ok(first.settled);
  commitTestimony(ledger, first, { sourceId: "s", admissionHash: "h1", seriesExtent: burstSeries.length });

  const flattened = [...quiet.slice(0, 10), ...quiet.slice(0, 5), ...quiet.slice(5)];
  const editedThenGrown = [...flattened, ...quiet, ...quiet];
  const rechecks = recheckTestimony(ledger, { series: editedThenGrown, sourceId: "s", admissionHash: "h4", structureOptions, readerOptions });
  assert.equal(rechecks.length, 1);
  assert.equal(rechecks[0].tag, SELF_MISMATCH, "truncating to the original extent must still include the edited regime, not hide it");
});

test("SELF_MISMATCH: a regime that no longer fits inside shrunk material is read as unsettled, not thrown", () => {
  const ledger = createTestimonyLedger();
  commitTestimony(ledger, fakeSettled(10), { sourceId: "s", admissionHash: "h1", seriesExtent: 20 });
  const truncated = quiet.slice(0, 8); // ends before regime.start=10 even begins
  const rechecks = recheckTestimony(ledger, { series: truncated, sourceId: "s", admissionHash: "h2", structureOptions, readerOptions });
  assert.equal(rechecks.length, 1);
  assert.equal(rechecks[0].tag, SELF_MISMATCH);
});

test("SELF_MISMATCH: a commit with no history to build a reader ground from (regime.start === 0) is read as unsettled, not thrown", () => {
  const ledger = createTestimonyLedger();
  commitTestimony(ledger, fakeSettled(0), { sourceId: "s", admissionHash: "h1", seriesExtent: 20 });
  const rechecks = recheckTestimony(ledger, { series: quiet, sourceId: "s", admissionHash: "h2", structureOptions, readerOptions });
  assert.equal(rechecks.length, 1);
  assert.equal(rechecks[0].tag, SELF_MISMATCH);
});

test("a ledger entry is never rewritten by a recheck — the SAME commit answers the question again, unmodified, every time", () => {
  const ledger = createTestimonyLedger();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  const committed = commitTestimony(ledger, first, { sourceId: "s", admissionHash: "h1", seriesExtent: burstSeries.length });
  assert.equal(ledger.commits.length, 1);

  recheckTestimony(ledger, { series: [...burstSeries, ...quiet], sourceId: "s", admissionHash: "h2", structureOptions, readerOptions });
  const flattened = [...quiet.slice(0, 10), ...quiet.slice(0, 5), ...quiet.slice(5)];
  recheckTestimony(ledger, { series: flattened, sourceId: "s", admissionHash: "h3", structureOptions, readerOptions });

  assert.equal(ledger.commits.length, 1, "recheckTestimony must never append or replace ledger entries");
  assert.equal(ledger.commits[0], committed);
});

test("classifyFresh: a regime never committed before for this source is WORLD", () => {
  const ledger = createTestimonyLedger();
  const results = classifyFresh(ledger, "s", [fakeSettled(30)]);
  assert.equal(results.length, 1);
  assert.equal(results[0].tag, WORLD);
});

test("classifyFresh: a regime already covered by an existing commit is left for recheckTestimony, not re-flagged as WORLD", () => {
  const ledger = createTestimonyLedger();
  commitTestimony(ledger, fakeSettled(10), { sourceId: "s", admissionHash: "h1", seriesExtent: 20 });
  const results = classifyFresh(ledger, "s", [fakeSettled(10)]);
  assert.equal(results.length, 1);
  assert.equal(results[0].tag, null);
});

test("classifyFresh scopes by sourceId — the same regime start on a different source is still WORLD", () => {
  const ledger = createTestimonyLedger();
  commitTestimony(ledger, fakeSettled(10), { sourceId: "s", admissionHash: "h1", seriesExtent: 20 });
  const results = classifyFresh(ledger, "other-source", [fakeSettled(10)]);
  assert.equal(results[0].tag, WORLD);
});

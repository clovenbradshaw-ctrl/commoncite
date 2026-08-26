// eoreader6 · conformance/host-self — packages/host/self.js wires
// engine/loops/self.js's testimony ledger into a session: recheck what's
// already committed for a source against this admission's own series, commit
// whatever is genuinely new. Same shape conformance/host-graph.test.js
// already exercises for host/graph.js, same fixture conformance/loops-self
// uses for the underlying mechanism.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession } from "../packages/host/corpus.js";
import { attachSelf, admitSelf, sessionSelfSnapshot, sessionTestimonyHolarchy, SELF, SELF_MISMATCH, WORLD, CELL } from "../packages/host/self.js";
import { levelStep } from "../packages/engine/loops/level.js";
import { ground, isGap } from "../nul/index.js";
import { ORGANS } from "../packages/engine/operators.js";

const quiet = [1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 2];
const burstSegment = [9, 9, 9, 9, 9];
const burstSeries = [...quiet.slice(0, 10), ...burstSegment, ...quiet.slice(5)];
const burstRegime = { start: 10, end: 15 };
const structureOptions = { draws: 64, window: 5, reseeds: 8 };
const readerOptions = { draws: 150, window: 5, seed: 11 };
const commitReaderGround = ground({ material: burstSeries.slice(0, burstRegime.start), ...readerOptions });

test("CELL matches the roster entry admitSelf claims", () => {
  const entry = ORGANS.find((o) => o.id === "host/self/admit");
  assert.ok(entry, "host/self/admit is registered in the operator roster");
  assert.deepEqual({ ...CELL }, { op: entry.op, grain: entry.grain });
});

test("attachSelf creates one ledger per session and returns the same instance on repeat calls", () => {
  const session = createSession();
  const a = attachSelf(session);
  const b = attachSelf(session);
  assert.equal(a, b);
  assert.equal(session.self, a);
});

test("admitSelf refuses a missing sourceId or admissionHash", () => {
  const session = createSession();
  assert.throws(() => admitSelf(session, { admissionHash: "h1", series: burstSeries, settledResults: [] }));
  assert.throws(() => admitSelf(session, { sourceId: "s", series: burstSeries, settledResults: [] }));
});

test("admitSelf commits a fresh settled result as WORLD on a source with no prior testimony", () => {
  const session = createSession();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  assert.ok(first.settled);

  const admitted = admitSelf(session, { sourceId: "s", admissionHash: "h1", series: burstSeries, settledResults: [first], structureOptions, readerOptions });
  assert.equal(admitted.self.length, 0);
  assert.equal(admitted.selfMismatch.length, 0);
  assert.equal(admitted.world.length, 1);
  assert.equal(admitted.world[0].regime.start, burstRegime.start);
});

test("admitSelf reconfirms (SELF) a prior commit when its own regime still settles on a later admission", () => {
  const session = createSession();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  admitSelf(session, { sourceId: "s", admissionHash: "h1", series: burstSeries, settledResults: [first], structureOptions, readerOptions });

  const grownALot = [...burstSeries, ...quiet, ...quiet, ...quiet];
  const second = admitSelf(session, { sourceId: "s", admissionHash: "h2", series: grownALot, settledResults: [], structureOptions, readerOptions });
  assert.equal(second.self.length, 1);
  assert.equal(second.self[0].tag, SELF);
  assert.equal(second.selfMismatch.length, 0);
});

test("admitSelf reports SELF_MISMATCH when a prior commit's own regime no longer settles", () => {
  const session = createSession();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  admitSelf(session, { sourceId: "s", admissionHash: "h1", series: burstSeries, settledResults: [first], structureOptions, readerOptions });

  const flattened = [...quiet.slice(0, 10), ...quiet.slice(0, 5), ...quiet.slice(5)];
  const second = admitSelf(session, { sourceId: "s", admissionHash: "h2", series: flattened, settledResults: [], structureOptions, readerOptions });
  assert.equal(second.selfMismatch.length, 1);
  assert.equal(second.selfMismatch[0].tag, SELF_MISMATCH);
  assert.equal(second.self.length, 0);
});

test("sessionSelfSnapshot is plain, serialisable data — never a live ledger reference", () => {
  const session = createSession();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  admitSelf(session, { sourceId: "s", admissionHash: "h1", series: burstSeries, settledResults: [first], structureOptions, readerOptions });

  const snap = sessionSelfSnapshot(session);
  assert.ok(Array.isArray(snap.commits));
  assert.equal(snap.commitCount, 1);
  assert.doesNotThrow(() => JSON.stringify(snap));
});

test("sessionSelfSnapshot on a session with no self yet is an honest empty report, not a throw", () => {
  const session = createSession();
  const snap = sessionSelfSnapshot(session);
  assert.deepEqual(snap, { commits: [], commitCount: 0 });
});

test("admitSelf's cascaded is empty when nothing mismatched", () => {
  const session = createSession();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  const admitted = admitSelf(session, { sourceId: "s", admissionHash: "h1", series: burstSeries, settledResults: [first], structureOptions, readerOptions });
  assert.deepEqual(admitted.cascaded, []);
});

test("admitSelf's cascaded reports a fresh whole committed this same admission that contains a part which just mismatched", () => {
  const session = createSession();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  admitSelf(session, { sourceId: "s", admissionHash: "h1", series: burstSeries, settledResults: [first], structureOptions, readerOptions });

  // Second admission: the burst is gone (forces burstRegime={10,15} to
  // mismatch), and a wider claim spanning the same territory settles for the
  // first time this admission — nothing individually re-tested it, since it
  // never existed before now.
  const flattened = [...quiet.slice(0, 10), ...quiet.slice(0, 5), ...quiet.slice(5)];
  const outerFake = Object.freeze({ regime: { start: 0, end: 20 }, structure: "above", significance: 0.95, settled: true, existence: 1 });
  const second = admitSelf(session, { sourceId: "s", admissionHash: "h2", series: flattened, settledResults: [outerFake], structureOptions, readerOptions });

  assert.equal(second.selfMismatch.length, 1);
  assert.equal(second.world.length, 1);
  assert.equal(second.cascaded.length, 1);
  assert.equal(second.cascaded[0].commit, second.world[0]);
  assert.equal(second.cascaded[0].restsOn[0], second.selfMismatch[0].commit);
});

test("sessionTestimonyHolarchy refuses a missing sourceId", () => {
  const session = createSession();
  assert.throws(() => sessionTestimonyHolarchy(session, {}));
});

test("sessionTestimonyHolarchy on a session with no self yet is an honest empty report, not a throw", () => {
  const session = createSession();
  assert.deepEqual(sessionTestimonyHolarchy(session, { sourceId: "s" }), { levels: [], relations: [], cycles: [] });
});

test("sessionTestimonyHolarchy reflects real committed testimony's own containment relations", () => {
  const session = createSession();
  const first = levelStep({ series: burstSeries, regime: burstRegime, readerGround: commitReaderGround, existenceCount: 4, structureOptions });
  const outerFake = Object.freeze({ regime: { start: 0, end: 20 }, structure: "above", significance: 0.95, settled: true, existence: 1 });
  admitSelf(session, { sourceId: "s", admissionHash: "h1", series: burstSeries, settledResults: [first, outerFake], structureOptions, readerOptions });

  const holarchy = sessionTestimonyHolarchy(session, { sourceId: "s" });
  assert.equal(holarchy.levels.length, 2);
  assert.equal(holarchy.relations.length, 1);
  assert.ok(holarchy.relations[0].relation === "a-whole-of-b" || holarchy.relations[0].relation === "b-whole-of-a");
  assert.equal(holarchy.relations[0].earned_by, "contains");
  assert.doesNotThrow(() => JSON.stringify(holarchy));
});

// eoreader6 · event_log — conformance
//
// No conformance coverage existed for this module before this change. Since
// `asOf` is now the seam eo-constitution CONSTITUTION.md II.17 governs (a
// cursor is named, never defaulted to now), these tests cover the whole
// module: the basic append/replay/findByType behavior plus the new cursor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createLog, tick, replay, findByType, asOf } from "../event_log/index.js";
import { isGap } from "../nul/index.js";

test("createLog starts empty at tick 0", () => {
  const log = createLog();
  assert.deepEqual(log.events, []);
  assert.equal(log.tick, 0);
});

test("tick appends, stamps the tick, and advances the log", () => {
  const log = createLog();
  const e0 = tick(log, { type: "DEF.admit", referent_id: "r1", surface: "cat" });
  assert.equal(e0.tick, 0);
  assert.equal(log.tick, 1);
  const e1 = tick(log, { type: "DEF.admit", referent_id: "r1", surface: "the cat" });
  assert.equal(e1.tick, 1);
  assert.equal(log.events.length, 2);
});

test("tick refuses an event with no event_type", () => {
  const log = createLog();
  const r = tick(log, { referent_id: "r1" });
  assert.ok(isGap(r));
  assert.equal(r.gap, "undeclared");
});

test("event ids are content-addressed and distinguish otherwise-identical events at different ticks", () => {
  const log = createLog();
  const a = tick(log, { type: "DEF.admit", referent_id: "r1", surface: "cat" });
  const b = tick(log, { type: "DEF.admit", referent_id: "r1", surface: "cat" });
  assert.notEqual(a.event_id, b.event_id);
});

test("replay returns every event, in append order", () => {
  const log = createLog();
  tick(log, { type: "A" });
  tick(log, { type: "B" });
  const events = replay(log);
  assert.deepEqual(events.map((e) => e.type), ["A", "B"]);
});

test("findByType filters without touching the log", () => {
  const log = createLog();
  tick(log, { type: "A" });
  tick(log, { type: "B" });
  tick(log, { type: "A" });
  assert.equal(findByType(log, "A").length, 2);
  assert.equal(log.events.length, 3);
});

test("asOf refuses a missing or non-integer cursor rather than defaulting to now (II.17)", () => {
  const log = createLog();
  tick(log, { type: "A" });
  assert.ok(isGap(asOf(log)));
  assert.equal(asOf(log).gap, "undeclared");
  assert.ok(isGap(asOf(log, "latest")));
  assert.ok(isGap(asOf(log, -1)));
});

test("asOf is a real point-in-time slice, not the whole log — cursor is a COUNT (half-open, like slice), not a tick index", () => {
  const log = createLog();
  tick(log, { type: "A" }); // tick 0
  tick(log, { type: "B" }); // tick 1
  tick(log, { type: "C" }); // tick 2

  assert.deepEqual(asOf(log, 0).map((e) => e.type), [], "cursor 0 means zero events considered");
  assert.deepEqual(asOf(log, 1).map((e) => e.type), ["A"]);
  assert.deepEqual(asOf(log, 2).map((e) => e.type), ["A", "B"]);
  assert.deepEqual(asOf(log, 3).map((e) => e.type), ["A", "B", "C"]);
});

test("asOf at a cursor beyond the log's current tick still returns everything that exists, not an error", () => {
  const log = createLog();
  tick(log, { type: "A" });
  assert.deepEqual(asOf(log, 999).map((e) => e.type), ["A"]);
});

test("reading 'the latest state' is still an explicit choice, never an implicit one (II.17)", () => {
  const log = createLog();
  tick(log, { type: "A" });
  tick(log, { type: "B" });
  // The only way to mean "now" is to name it: log.tick itself.
  const now = asOf(log, log.tick);
  assert.equal(now.length, 2);
});

test("a cursor captured before a later append stays a stable snapshot — the whole reason cursor is exclusive (II.17)", () => {
  const log = createLog();
  tick(log, { type: "A" }); // tick 0
  tick(log, { type: "B" }); // tick 1
  const cursor = log.tick; // "as of right now" — count is 2

  tick(log, { type: "C" }); // appended AFTER the cursor was captured, lands at tick 2

  assert.deepEqual(
    asOf(log, cursor).map((e) => e.type),
    ["A", "B"],
    "the later append must not silently join a cursor captured before it existed",
  );
});

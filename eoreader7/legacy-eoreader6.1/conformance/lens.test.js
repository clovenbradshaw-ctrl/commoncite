// eoreader6 · lens — conformance
//
// Exercises `readLens` against the real `projectReferents` (packages/engine/
// referents/index.js) — not a stand-in — proving the generalization holds:
// an existing, hardcoded projection becomes a receivable lens with no
// change to its own logic. A second, synthetic lens over a disjoint event
// type proves two lenses can read the same log and each correctly report
// what the other one left for it to discard.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createLog, tick } from "../event_log/index.js";
import { readLens } from "../lens/index.js";
import { projectReferents } from "../packages/engine/referents/index.js";
import { isGap } from "../nul/index.js";

const REFERENT_LENS = Object.freeze({
  name: "referent-identity",
  reads: Object.freeze(["DEF.admit", "CON.identity", "SYN.merge", "SEG.split"]),
  project: projectReferents,
});

const buildLog = () => {
  const log = createLog();
  tick(log, { type: "DEF.admit", referent_id: "r1", surface: "cat", provenance: "p0" }); // tick 0
  tick(log, { type: "DEF.admit", referent_id: "r1", surface: "the cat", provenance: "p1" }); // tick 1
  tick(log, { type: "NOISE.unrelated", payload: "not a referent event" }); // tick 2
  tick(log, { type: "DEF.admit", referent_id: "r2", surface: "dog", provenance: "p2" }); // tick 3
  return log;
};

test("readLens refuses a malformed lens definition rather than guessing", () => {
  const log = buildLog();
  assert.ok(isGap(readLens(log, null, 3)));
  assert.ok(isGap(readLens(log, { name: "x" }, 3))); // no reads, no project
  assert.ok(isGap(readLens(log, { name: "x", reads: [], project: () => {} }, 3))); // empty reads
  assert.ok(isGap(readLens(log, { name: "x", reads: ["A"] }, 3))); // no project function
});

test("readLens refuses a missing or non-integer cursor rather than defaulting to now (II.17)", () => {
  const log = buildLog();
  assert.ok(isGap(readLens(log, REFERENT_LENS)));
  assert.ok(isGap(readLens(log, REFERENT_LENS, "latest")));
});

test("readLens over the real projectReferents reproduces its own direct-call result exactly", () => {
  const log = buildLog();
  const direct = projectReferents(log.events.filter((e) => e.type === "DEF.admit"));
  const viaLens = readLens(log, REFERENT_LENS, log.tick);
  assert.ok(!isGap(viaLens));
  assert.deepEqual(viaLens.view, direct);
});

test("a lens's view is point-in-time: an earlier cursor sees fewer admissions", () => {
  const log = buildLog();
  const early = readLens(log, REFERENT_LENS, 1); // cursor 1 = only the first event, the first DEF.admit
  assert.equal(early.view.length, 1);
  assert.equal(early.view[0].surfaces.length, 1);

  const full = readLens(log, REFERENT_LENS, log.tick);
  assert.equal(full.view.length, 2); // r1 and r2
});

test("a lens declares what it discards — the NOISE event never silently vanishes unaccounted for", () => {
  const log = buildLog();
  const r = readLens(log, REFERENT_LENS, log.tick);
  assert.deepEqual(r.discardedTypes, ["NOISE.unrelated"]);
});

test("provenance traces the view back to the exact events read, never more", () => {
  const log = buildLog();
  const r = readLens(log, REFERENT_LENS, log.tick);
  assert.equal(r.provenance.length, 3); // three DEF.admit events; NOISE excluded
  for (const p of r.provenance) {
    assert.equal(p.event_type, "DEF.admit");
    assert.ok(Number.isInteger(p.tick));
    assert.ok(typeof p.event_id === "string" && p.event_id.length > 0);
  }
});

test("two lenses over the same log each report the other's event types as discarded", () => {
  const log = buildLog();
  const NOISE_LENS = Object.freeze({
    name: "noise-count",
    reads: Object.freeze(["NOISE.unrelated"]),
    project: (events) => ({ count: events.length }),
  });

  const referentRead = readLens(log, REFERENT_LENS, log.tick);
  const noiseRead = readLens(log, NOISE_LENS, log.tick);

  assert.deepEqual(referentRead.discardedTypes, ["NOISE.unrelated"]);
  assert.deepEqual(noiseRead.discardedTypes.sort(), ["DEF.admit"]);
  assert.equal(noiseRead.view.count, 1);
});

test("the lens result never claims completeness by itself — reads/discardedTypes are always present", () => {
  const log = buildLog();
  const r = readLens(log, REFERENT_LENS, log.tick);
  assert.deepEqual(r.reads, REFERENT_LENS.reads);
  assert.ok(Array.isArray(r.discardedTypes));
});

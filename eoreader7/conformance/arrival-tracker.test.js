import { test } from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../packages/engine/emergence/graph.js";
import { createTier } from "../packages/engine/emergence/tiers.js";
import { createLog } from "../event_log/index.js";
import {
  createArrivalTracker, trackArrival, beliefConstellation, castBelief, arrivalReading,
} from "../packages/engine/tracking/arrival.js";

const make = () => createArrivalTracker({
  graph: createGraph({ gamma: 0.9, pruneBelow: 1e-4 }),
  tiers: [
    createTier({ name: "Atmosphere", window: 4, draws: 9, seed: 1 }),
    createTier({ name: "Lens", window: 4, draws: 9, seed: 2 }),
    createTier({ name: "Paradigm", window: 4, draws: 9, seed: 3 }),
  ],
  log: createLog(), draws: 9, seed: 7,
});

const arrival = {
  source: { sourceId: "novel", byteStart: 0, byteEnd: 20, cursor: 0 },
  scope: { referents: ["victor", "creature"], frame: "walton", horizon: "scene-1" },
  act: { op: "CON", grain: "Figure" },
  triples: [{ subject: "victor", verb: "creates", object: "creature", polarity: "+" }],
  surfaces: ["Victor", "creature"], witnesses: ["novel:0-20"],
};

test("trackArrival derives terrain and stance from the declared phasepost and commits one replayable event", () => {
  const tracker = make();
  const event = trackArrival(tracker, arrival);
  assert.deepEqual(
    { op: event.phasepost.op, grain: event.phasepost.grain, terrain: event.phasepost.terrain, stance: event.phasepost.stance },
    { op: "CON", grain: "Figure", terrain: "Link", stance: "Binding" },
  );
  assert.equal(event.status, "committed");
  assert.equal(event.measurement.revision.committed, true);
  assert.equal(tracker.graph.tick, 1);
  assert.equal(tracker.log.events.length, 1);
  assert.equal(event.before.graphHash.startsWith("fnv128:"), true);
  assert.ok(Object.isFrozen(event.arrival.triples[0]));
});

test("trackArrival refuses an undeclared coordinate before mutating graph or log", () => {
  const tracker = make();
  assert.throws(() => trackArrival(tracker, { ...arrival, act: { op: "CON", grain: "Sentence" } }), /invalid phasepost/);
  assert.equal(tracker.graph.tick, 0);
  assert.equal(tracker.log.tick, 0);
});

test("the prior hash names the state before each arrival", () => {
  const tracker = make();
  const first = trackArrival(tracker, arrival);
  const second = trackArrival(tracker, {
    ...arrival,
    source: { ...arrival.source, byteStart: 21, byteEnd: 40, cursor: 1 },
  });
  assert.notEqual(first.before.graphHash, second.before.graphHash);
  assert.equal(second.tick, 1);
  assert.equal(tracker.graph.tick, 2);
});

test("REC and tierReached require a tier gate to pass, not merely to be attempted", () => {
  const tracker = make();
  const event = trackArrival(tracker, arrival);
  assert.equal(event.measurement.tierFold.top, "Atmosphere", "the cold tier was attempted");
  assert.equal(event.measurement.tierReached, null, "the cold tier did not pass its no-ground gate");
  assert.equal(event.measurement.operatorVector.REC, 0, "an attempted tier is not a reconstruction");
});

test("unresolved surprise asks for more surfing without changing belief", () => {
  const tracker = make();
  const event = trackArrival(tracker, {
    ...arrival,
    ambiguities: [{ kind: "referent_identity", candidates: ["creature", "apparatus"] }],
  });
  assert.equal(event.status, "unstable");
  assert.equal(event.clarification.action, "surf_more");
  assert.equal(event.measurement.revision.committed, false);
  assert.equal(event.measurement.operatorVector.REC, 0);
  assert.equal(tracker.graph.tick, 0, "misunderstanding must not advance belief");
  assert.equal(tracker.tiers[0].observations, 0, "misunderstanding must not reach interpretation tiers");
  assert.equal(tracker.log.tick, 1, "the refusal remains in the trail rather than disappearing");
});

test("castBelief keeps importance plural and marks revised or unresolved beings for attention", () => {
  const tracker = make();
  trackArrival(tracker, {
    ...arrival,
    consequence: { standingRevisions: [{ referent: "victor", from: "character", to: "apparatus" }] },
  });
  trackArrival(tracker, {
    ...arrival,
    source: { ...arrival.source, cursor: 1 },
    scope: { ...arrival.scope, referents: ["uncertain-speaker"] },
    ambiguities: [{ kind: "speaker", candidates: ["victor", "walton"] }],
  });

  const cast = castBelief(tracker.log);
  const victor = cast.find((record) => record.referent === "victor");
  const uncertain = cast.find((record) => record.referent === "uncertain-speaker");
  assert.equal(victor.committedArrivals, 1);
  assert.deepEqual(victor.standingRevisions.map((r) => [r.from, r.to]), [["character", "apparatus"]]);
  assert.equal(victor.needsAttention, true);
  assert.equal(uncertain.committedArrivals, 0, "unresolved evidence cannot inflate cast importance");
  assert.equal(uncertain.unresolvedArrivals, 1);
  assert.equal(uncertain.needsAttention, true);
  assert.equal("importanceScore" in victor, false, "different grounds are not collapsed into one rank");
});

test("arrivalReading wraps the trail without flattening terrain, uncertainty, or gaps", () => {
  const tracker = make();
  const committed = trackArrival(tracker, { ...arrival, absences: [{ gap: "unknown_speaker" }] });
  const unstable = trackArrival(tracker, {
    ...arrival,
    source: { ...arrival.source, cursor: 1 },
    scope: { ...arrival.scope, referents: ["uncertain-speaker"] },
    ambiguities: [{ kind: "speaker", candidates: ["victor", "walton"] }],
  });

  const reading = arrivalReading(tracker.log);
  assert.equal(reading.events.length, 2);
  assert.deepEqual(reading.terrains.Link.map((entry) => entry.eventId), [committed.event_id, unstable.event_id]);
  assert.equal(reading.terrains.Void.length, 0, "an absence is retained as evidence, not reclassified as a Void act");
  assert.equal(reading.gaps[0].absence.gap, "unknown_speaker");
  assert.equal(reading.unresolved[0].eventId, unstable.event_id);
  assert.equal(reading.referents["uncertain-speaker"][0].status, "unstable");
  assert.equal(reading.operators.CON.length, 2);
  assert.strictEqual(castBelief, beliefConstellation, "cast is only a narrative compatibility name");
  assert.ok(Object.isFrozen(reading) && Object.isFrozen(reading.terrains.Link[0]));
});

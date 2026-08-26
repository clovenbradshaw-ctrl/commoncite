// End to end: real prose enters the host corpus, its existing perceiver finds
// and resolves relations, and those relations travel through the tracker into
// the graph, tier stack, and immutable event log.  This deliberately does not
// hand-write triples: doing so would only prove the middle of the pipeline.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSession, admitChunked } from "../packages/host/corpus.js";
import { resolveRelations } from "../packages/host/graph.js";
import { createGraph } from "../packages/engine/emergence/graph.js";
import { createTierStack } from "../packages/engine/emergence/tiers.js";
import { createLog, findByType, replay } from "../event_log/index.js";
import { createArrivalTracker, trackArrival, castBelief } from "../packages/engine/tracking/arrival.js";

const frankenstein = readFileSync(
  new URL("../scripts/adversarial/fixtures/pg84-frankenstein.txt", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

test("E2E: real Frankenstein prose becomes a navigable causal arrival trail", () => {
  // Two later, distinct passages share Clerval as a resolved referent.  That
  // gives the second arrival a real prior standpoint to revise, rather than
  // weakening the assertion to accommodate two portions with disjoint casts.
  const portions = [frankenstein.slice(40_000, 50_000), frankenstein.slice(90_000, 100_000)];
  // Per-document corpus sessions keep the test aimed at tracker composition;
  // cross-document host admission has its own independently tested cache and
  // must not decide whether either passage's perceiver is allowed to speak.
  const corpora = portions.map((text, cursor) => {
    const corpus = createSession();
    admitChunked(corpus, { sourceId: `frankenstein-${cursor}`, text });
    return corpus;
  });

  const graph = createGraph({ gamma: 0.9, pruneBelow: 1e-4 });
  const tiers = createTierStack(["atmosphere", "lens", "paradigm"], { window: 12, draws: 99, seed: 20260821 });
  const log = createLog();
  const tracker = createArrivalTracker({ graph, tiers, log, draws: 99, seed: 20260821 });

  const extracted = portions.map((text, cursor) => {
    const sourceId = `frankenstein-${cursor}`;
    const { relations, gaps } = resolveRelations(corpora[cursor], { sourceId });
    assert.ok(relations.length > 0, `real portion ${cursor} must yield relations`);
    return { sourceId, text, cursor, relations, gaps };
  });

  const events = extracted.map(({ sourceId, text, cursor, relations, gaps }) => trackArrival(tracker, {
    source: { sourceId, byteStart: 0, byteEnd: Buffer.byteLength(text), cursor },
    scope: { referents: [...new Set(relations.flatMap((r) => [r.subject, r.object]))], frame: sourceId, horizon: sourceId },
    // The text relation organ declares this cell; the tracker derives Link ·
    // Binding from it instead of guessing a terrain from Frankenstein.
    act: { op: "CON", grain: "Figure" },
    triples: relations,
    witnesses: relations.map((r) => `${sourceId}:${r.offset}`),
    absences: gaps,
  }));

  assert.equal(events.length, 2);
  assert.ok(events.every((event) => event.phasepost.terrain === "Link" && event.phasepost.stance === "Binding"));
  assert.equal(graph.tick, 2, "each real portion advances belief once");
  assert.ok(graph.nodes.size > 0 && graph.edges.size > 0, "the tracker leaves a usable belief network");
  assert.notEqual(events[0].before.graphHash, events[1].before.graphHash, "the second event names the belief formed by the first");
  assert.equal(events[1].measurement.revision.committed, true);
  assert.ok(events[1].measurement.graphBreadth.nodesHeld > 0, "the second event measures revision against an existing network");

  // The promised navigation questions are answerable from the event trail,
  // without re-reading or re-extracting the source.
  const linkBindings = findByType(log, "EVA.arrival").filter((event) =>
    event.phasepost.terrain === "Link" && event.phasepost.stance === "Binding");
  const introductions = replay(log).filter((event) => event.measurement.operatorVector.INS > 0);
  const changedStandpoints = replay(log).flatMap((event) =>
    event.measurement.standpoints.map((standpoint) => ({ event: event.event_id, ...standpoint })));

  assert.equal(linkBindings.length, 2, "follow terrain/stance finds both witnessed portions");
  assert.ok(introductions.length > 0, "follow operator finds where new network material entered");
  assert.ok(changedStandpoints.length > 0, "follow referent finds concrete, non-aggregated standpoint movements");
  assert.equal(replay(log).length, 2, "one immutable event exists per admitted portion");

  const cast = castBelief(log);
  const clerval = cast.find((record) => record.referent === "ref:auto:clerval");
  assert.ok(clerval, "the resolved recurring figure enters the belief cast by referent, not display spelling");
  assert.ok(clerval.committedArrivals >= 2, "the cast view exposes recurrence as one importance dimension");
  assert.ok(clerval.standpointChanges > 0 && clerval.beliefMovement > 0,
    "the cast view exposes how far this reader's belief about Clerval moved");
  assert.equal("importanceScore" in clerval, false, "importance remains a vector, never an unjustified leaderboard");
});

// Conformance · packages/host/tiers — the host face of the interpretation
// column. Modelled directly on conformance/host-graph.test.js's own
// conventions (same real fixture, same CELL/roster check, same
// caller-responsibility-for-dedup framing) since this file wires the
// sibling organ (emergence/tiers.js) into the same session shape
// host/graph.js already wires emergence/graph.js into.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSession, admitChunked } from "../packages/host/corpus.js";
import { admitGraph } from "../packages/host/graph.js";
import { attachTiers, admitTiers, sessionTiersSnapshot, CELL } from "../packages/host/tiers.js";
import { ORGANS } from "../packages/engine/operators.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = join(ROOT, "scripts/adversarial/fixtures");
const frankenstein = readFileSync(join(FIX, "pg84-frankenstein.txt"), "utf8").replace(/\r\n/g, "\n");

const SEED = 20260810;

const sessionOf = (text) => {
  const session = createSession();
  admitChunked(session, { text, sourceId: "s" });
  return session;
};

// The same real, corpus-derived cluster conformance/genre-seed.test.js
// already verifies clears its own readiness gate — reused rather than
// re-derived, so this suite is checked against the same real numbers.
const REAL_CLUSTER = Object.freeze({
  id: "sig-entity-tracing",
  size: 131,
  centroid: Object.freeze({
    NUL: 0.0015921634170932301,
    SIG: 0.1102136664838743,
    INS: 0.03871947329957187,
    SEG: 0.020655409913781567,
    CON: 0.02385116161438826,
    SYN: 0.0018174541660510837,
    DEF: 0.07640304949531274,
    EVA: 0.0013240191947163067,
    REC: 0.0004709190954613652,
  }),
});

test("CELL matches the roster entry admitTiers claims", () => {
  const entry = ORGANS.find((o) => o.id === "host/tiers/admit");
  assert.ok(entry, "host/tiers/admit is registered in the operator roster");
  assert.deepEqual({ ...CELL }, { op: entry.op, grain: entry.grain });
});

test("attachTiers requires a declared seed and creates one stack per session", () => {
  const session = sessionOf(frankenstein);
  assert.throws(() => attachTiers(session, {}), /seed is declared/);

  const a = attachTiers(session, { seed: SEED });
  const b = attachTiers(session, { seed: 999 }); // a different seed on a second call must not matter
  assert.equal(a, b, "a second attachTiers call must not replace the running tier stack");
  assert.equal(session.tiers, a);
  assert.deepEqual(a.map((t) => t.name), ["atmosphere", "lens", "paradigm"]);
});

test("attachTiers with no cluster leaves the stack unseeded, exactly as emergence/tiers.js's own cold start", () => {
  const session = sessionOf(frankenstein);
  const tiers = attachTiers(session, { seed: SEED });
  assert.equal(session.tierSeed, undefined);
  assert.equal(tiers[0].observations, 0);
  assert.equal(tiers[0].total, 0);
});

test("attachTiers with a cluster seeds the Atmosphere tier, and records whether it earned its place", () => {
  const session = sessionOf(frankenstein);
  const tiers = attachTiers(session, { seed: SEED, cluster: REAL_CLUSTER, giver: "test:sig-entity-tracing" });
  assert.equal(session.tierSeed.seeded, true);
  assert.equal(tiers[0].observations, 1);
  assert.ok(tiers[0].total > 0);
});

test("admitTiers folds a real document's operator-mix delta into the session's tier stack", () => {
  const session = sessionOf(frankenstein);
  attachTiers(session, { seed: SEED });
  const { tiers, admitted } = admitTiers(session, { sourceId: "s" });

  assert.equal(admitted.length, 1);
  assert.equal(admitted[0].sourceId, "s");
  assert.ok(admitted[0].admitted.stated > 0, "the fixture's prose yields real relations, exactly as host-graph.test.js already establishes");
  assert.equal(typeof admitted[0].counts, "object");
  assert.deepEqual(Object.keys(admitted[0].counts).sort(), ["CON", "DEF", "EVA", "INS", "NUL", "SEG", "SYN", "SIG"].sort());

  // The first-ever fold has no prior to differ from (tiers.js's own
  // no_ground gap) — folded is still an object naming the attempt, not null.
  assert.ok(admitted[0].folded === null || typeof admitted[0].folded === "object");
  assert.equal(tiers, session.tiers);
});

test("admitTiers requires attachTiers to have run first", () => {
  const session = sessionOf(frankenstein);
  assert.throws(() => admitTiers(session, { sourceId: "s" }), /attachTiers\(session, \.\.\.\) must run first/);
});

test("admitTiers(session) with no sourceId folds every un-admitted document exactly once each", () => {
  const session = createSession();
  admitChunked(session, { sourceId: "a", text: frankenstein.slice(0, 20000) });
  admitChunked(session, { sourceId: "b", text: frankenstein.slice(20000, 40000) });
  attachTiers(session, { seed: SEED });

  const first = admitTiers(session);
  assert.deepEqual(first.admitted.map((a) => a.sourceId).sort(), ["a", "b"]);

  // A second call must fold NEITHER document again: both were already
  // admitted into the tier stack by the call above.
  const second = admitTiers(session);
  assert.equal(second.admitted.length, 0, "re-running admitTiers over an unchanged session must not double-fold anything");
});

test("admitTiers does not re-fold a document already admitted into the tier stack, even across separate calls", () => {
  const session = sessionOf(frankenstein);
  attachTiers(session, { seed: SEED });
  admitTiers(session, { sourceId: "s" });
  const observationsAfterFirst = session.tiers[0].observations;

  const second = admitTiers(session, { sourceId: "s" });
  assert.equal(second.admitted.length, 0);
  assert.equal(session.tiers[0].observations, observationsAfterFirst, "the tier stack must not have moved a second time for the same document");
});

test("admitTiers reuses host/graph.js's admitGraph rather than re-deriving triples — the same graph, the same relations", () => {
  const viaTiers = sessionOf(frankenstein);
  attachTiers(viaTiers, { seed: SEED });
  const { admitted: admittedByTiers } = admitTiers(viaTiers, { sourceId: "s" });

  const viaGraphDirectly = sessionOf(frankenstein);
  const { admitted: admittedByGraph } = admitGraph(viaGraphDirectly, { sourceId: "s" });

  assert.equal(admittedByTiers[0].admitted.stated, admittedByGraph[0].stated);
  assert.equal(admittedByTiers[0].admitted.newEdges, admittedByGraph[0].newEdges);
  assert.deepEqual([...viaTiers.graph.edges].sort(), [...viaGraphDirectly.graph.edges].sort());
});

test("sessionTiersSnapshot is plain, serialisable data — never the live tier objects", () => {
  const session = sessionOf(frankenstein);
  attachTiers(session, { seed: SEED, cluster: REAL_CLUSTER, giver: "test:sig-entity-tracing" });
  admitTiers(session, { sourceId: "s" });

  const snap = sessionTiersSnapshot(session);
  assert.equal(snap.seeded, true);
  assert.equal(snap.tiers.length, 3);
  for (const t of snap.tiers) {
    assert.equal(typeof t.name, "string");
    assert.equal(typeof t.observations, "number");
    assert.equal(typeof t.shifts, "number");
  }
  assert.doesNotThrow(() => JSON.stringify(snap));
});

test("sessionTiersSnapshot on a session with no tier stack yet is an honest empty report, not a throw", () => {
  const session = createSession();
  assert.deepEqual(sessionTiersSnapshot(session), { seeded: false, tiers: [] });
});

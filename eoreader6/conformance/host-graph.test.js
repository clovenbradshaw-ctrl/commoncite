// eoreader6 · conformance/host-graph — packages/host/graph.js wires
// corpus.js's per-document relations (sessionRelations) into
// emergence/graph.js's decaying belief Network. Calibrated against the SAME
// real fixture (pg84-frankenstein.txt) individuation.test.js already uses —
// not a synthetic snippet: relation extraction is heuristic and small
// hand-written fixtures do not recur enough to clear discoverRelationVocab's
// own minSurfaces gate (measured while writing this file), so a real novel
// is the honest input, same as the rest of this suite already treats it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSession, admitChunked, sessionReferents } from "../packages/host/corpus.js";
import { attachGraph, admitGraph, sessionGraphSnapshot, CELL } from "../packages/host/graph.js";
import { ORGANS } from "../packages/engine/operators.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = join(ROOT, "scripts/adversarial/fixtures");
const frankenstein = readFileSync(join(FIX, "pg84-frankenstein.txt"), "utf8").replace(/\r\n/g, "\n");

const sessionOf = (text) => {
  const session = createSession();
  admitChunked(session, { text, sourceId: "s" });
  return session;
};

test("CELL matches the roster entry admitGraph claims", () => {
  const entry = ORGANS.find((o) => o.id === "host/graph/admit");
  assert.ok(entry, "host/graph/admit is registered in the operator roster");
  assert.deepEqual({ ...CELL }, { op: entry.op, grain: entry.grain });
});

test("attachGraph creates one graph per session and returns the same instance on repeat calls", () => {
  const session = sessionOf(frankenstein);
  const a = attachGraph(session);
  const b = attachGraph(session);
  assert.equal(a, b, "a second attachGraph call must not replace the running belief graph");
  assert.equal(session.graph, a);
});

test("admitGraph reads a document's relations into the session graph, canonicalised through its own discovered cast", () => {
  const session = sessionOf(frankenstein);
  const { referents } = sessionReferents(session, { sourceId: "s", limit: 500 });
  const henry = referents.find((r) => r.display === "Henry Clerval");
  assert.ok(henry, "precondition: Henry Clerval is discovered, with both 'Henry' and 'Henry Clerval' as surfaces");
  assert.ok(henry.surfaces.includes("Henry") && henry.surfaces.includes("Henry Clerval"));

  const { graph, admitted } = admitGraph(session, { sourceId: "s" });
  assert.equal(admitted.length, 1);
  assert.ok(admitted[0].stated > 0, "the fixture's prose yields real (subject, verb, object) triples");
  assert.ok(graph.nodes.size > 0 && graph.edges.size > 0);

  // The shorter surface ("Henry") must never survive as its own node once a
  // referent claims it — every triple naming it canonicalises to the SAME
  // node the fuller surface ("Henry Clerval") lands on. Un-canonicalised,
  // the same being would fragment across two nodes with no edge between
  // them, which is exactly the failure emergence/graph.js's own header
  // warns a caller into by feeding it raw surfaces instead of resolved ids.
  assert.ok(!graph.nodes.has("henry"), "'henry' alone must not appear as a separate node");
  assert.ok(graph.nodes.has("henry clerval"), "the referent's canonical display, lowercased, is the one node");
});

test("admitGraph(session) with no sourceId reads every admitted document", () => {
  const session = createSession();
  admitChunked(session, { sourceId: "a", text: frankenstein.slice(0, 20000) });
  admitChunked(session, { sourceId: "b", text: frankenstein.slice(20000, 40000) });
  const { admitted } = admitGraph(session);
  assert.equal(admitted.length, 2);
  assert.deepEqual(admitted.map((a) => a.sourceId).sort(), ["a", "b"]);
});

test("readTriples' own belief movement is not hidden by this wiring: a document admitted twice states its relations twice, exactly as emergence/graph.js documents", () => {
  const session = sessionOf(frankenstein);
  const first = admitGraph(session, { sourceId: "s" });
  const totalAfterFirst = first.graph.edgeTotal;
  const second = admitGraph(session, { sourceId: "s" });
  // Every edge decays by gamma on each read (emergence/graph.js's own
  // header), then the restated triples are added back — so edgeTotal is not
  // simply doubled, but a second admission is real, measurable movement,
  // never a silent no-op. Double-admission guarding is this module's
  // documented caller responsibility (admitGraph's own header), not
  // something admitGraph does for the caller.
  assert.notEqual(second.graph.edgeTotal, totalAfterFirst);
  assert.ok(second.admitted[0].stated === first.admitted[0].stated);
});

test("sessionGraphSnapshot is plain, serialisable data — never the live Maps", () => {
  const session = sessionOf(frankenstein);
  admitGraph(session, { sourceId: "s" });
  const snap = sessionGraphSnapshot(session, { limit: 5 });
  assert.ok(Array.isArray(snap.nodes) && Array.isArray(snap.edges));
  assert.ok(snap.nodes.length <= 5 && snap.edges.length <= 5);
  assert.equal(typeof snap.nodeCount, "number");
  assert.equal(typeof snap.edgeCount, "number");
  assert.doesNotThrow(() => JSON.stringify(snap));
  // Sorted by mentions/weight descending — the strongest belief first, since
  // a caller with a small prompt budget (a background "thought" call) reads
  // this list from the front and truncates.
  for (let i = 1; i < snap.nodes.length; i++) {
    assert.ok(snap.nodes[i - 1].mentions >= snap.nodes[i].mentions);
  }
});

test("sessionGraphSnapshot on a session with no graph yet is an honest empty report, not a throw", () => {
  const session = createSession();
  const snap = sessionGraphSnapshot(session);
  assert.deepEqual(snap, { nodes: [], edges: [], tick: 0, edgeTotal: 0, nodeCount: 0, edgeCount: 0 });
});

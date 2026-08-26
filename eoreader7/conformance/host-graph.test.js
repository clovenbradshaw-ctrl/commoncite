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
import { attachGraph, admitGraph, sessionGraphSnapshot, referentLookup, castStandings, reconcileGraphStandings, referentFace, CELL } from "../packages/host/graph.js";
import { ORGANS } from "../packages/engine/operators.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = join(ROOT, "scripts/adversarial/fixtures");
const frankenstein = readFileSync(join(FIX, "pg84-frankenstein.txt"), "utf8").replace(/\r\n/g, "\n");
const frankensteinCoref = JSON.parse(readFileSync(join(FIX, "pg84-frankenstein.coref.json"), "utf8"));
const wireQuietSubject = readFileSync(join(FIX, "wire-quiet-subject.txt"), "utf8");

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
  assert.ok(graph.nodes.has(henry.id), "the referent id, not a preferred surface spelling, is the graph node");
});

test("referent resolution reads beings inside relation phrases and composes received descriptor/narrator priors", () => {
  const session = sessionOf(frankenstein);
  const lookup = referentLookup(session, "s", { priors: frankensteinCoref.referents });
  const elizabeth = sessionReferents(session, { sourceId: "s", limit: 500 }).referents.find((r) => r.surfaces.includes("Elizabeth"));
  assert.ok(elizabeth);
  assert.equal(lookup.resolve("to Elizabeth", 0), elizabeth.id, "a being inside an object phrase resolves to identity");
  assert.equal(lookup.resolve("the dæmon", 0), "creature", "received descriptor surfaces resolve to their referent");
  const victorOffset = frankenstein.indexOf("I am by birth a Genevese") + 1;
  assert.equal(lookup.resolve("I", victorOffset), "victor", "first person resolves by the received narrator span at this offset");
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
  // Sorted by current weight descending — the strongest belief first, since
  // a caller with a small prompt budget (a background "thought" call) reads
  // this list from the front and truncates.
  for (let i = 1; i < snap.nodes.length; i++) {
    assert.ok(snap.nodes[i - 1].weight >= snap.nodes[i].weight);
  }
});

test("sessionGraphSnapshot on a session with no graph yet is an honest empty report, not a throw", () => {
  const session = createSession();
  const snap = sessionGraphSnapshot(session);
  assert.deepEqual(snap, { nodes: [], edges: [], tick: 0, edgeTotal: 0, nodeCount: 0, edgeCount: 0, standings: [] });
});

test("sessionGraphSnapshot ranks by CURRENT weight, not the lifetime mentions tally — a node's weight can fall while mentions never does", () => {
  const session = sessionOf(frankenstein);
  admitGraph(session, { sourceId: "s" });
  const snap = sessionGraphSnapshot(session, { limit: 40 });
  assert.ok(snap.nodes.length > 1);
  for (const n of snap.nodes) assert.ok(typeof n.weight === "number" && Number.isFinite(n.weight), `${n.id} must carry a numeric current weight`);
  for (let i = 1; i < snap.nodes.length; i++) {
    assert.ok(snap.nodes[i - 1].weight >= snap.nodes[i].weight, "the served list is ordered by current weight, strongest belief first");
  }
});

// ── standing (2026-08-21) — measured live on this repo's own
// wire-quiet-subject.txt: a wire-service byline discovered and typed
// `apparatus` at the cast tier, carrying real, high mention counts — the
// flagship case CLAUDE.md names for this whole mechanism.
test("castStandings keys the cast's positive individuation verdicts by referentFace, and OMITS a null (undecided) verdict — absence never manufactures a standing", () => {
  const session = sessionOf(wireQuietSubject);
  const { referents } = sessionReferents(session, { sourceId: "s" });
  const newswire = referents.find((r) => r.display === "Continental Newswire");
  const voss = referents.find((r) => r.display === "Voss");
  assert.ok(newswire, "precondition: the byline is discovered as a referent");
  assert.equal(newswire.individuation, "apparatus", "precondition: the naming-sentence-share demotion fires on this fixture");
  assert.equal(referentFace(newswire), newswire.id, "graph identity is the stable referent id, never its mutable display spelling");

  const standings = castStandings(session, "s");
  assert.equal(standings.get(referentFace(newswire))?.standing, "apparatus");
  if (voss) assert.equal(standings.has(referentFace(voss)), voss.individuation != null, "a referent with no decided individuation contributes no standing entry");
});

test("reconcileGraphStandings discloses, rather than silently drops, a referent whose stated-relations subject span never canonicalised to its own registered surfaces", () => {
  // Measured, not assumed: extractRelations's own subject span for this
  // fixture's stated relations is the shorter fragment "Newswire", which is
  // not among the referent's registered surfaces, so admitGraph's own
  // canon() falls through uncanonicalised and the triple lands belief on a
  // DIFFERENT node than the referent's own face — a real, disclosed upstream
  // limitation (the relation extractor's own coverage), not a hypothetical.
  const session = sessionOf(wireQuietSubject);
  const { restood, unresolved } = admitGraph(session, { sourceId: "s" });
  assert.ok(Array.isArray(restood) && Array.isArray(unresolved));
  const missed = unresolved.find((u) => u.standing === "apparatus");
  assert.ok(missed, "the apparatus verdict is named on `unresolved`, never silently absorbed into an empty restood list");
  assert.equal(missed.reason, "unknown_node");
  assert.equal(session.graph.nodes.has(missed.node), false, "confirms the graph genuinely holds no node at the referent's own face");
});

test("restandNode lands, and re-renders stay silent, when a referent's face DOES match a real graph node", () => {
  // A direct, engine-tier demonstration once the referent's own face is fed
  // straight to a graph that actually holds it — the host-tier canonical-
  // isation gap above is a real, separate, disclosed limitation of the
  // relation extractor, not a limit of restandNode/reconcileGraphStandings
  // themselves.
  const session = sessionOf(wireQuietSubject);
  admitGraph(session, { sourceId: "s" });
  const { referents } = sessionReferents(session, { sourceId: "s" });
  const newswire = referents.find((r) => r.display === "Continental Newswire");
  const face = referentFace(newswire);
  session.graph.nodes.set(face, { id: face, mentions: newswire.mentions, firstSeen: 0 });
  session.graph.edges.set(`${face}|learned|the finding`, 1);
  session.graph.edgeTotal += 1;

  const first = reconcileGraphStandings(session, { sourceId: "s" });
  assert.equal(first.restood.length, 1);
  assert.equal(first.restood[0].node, face);
  assert.equal(first.restood[0].standing, "apparatus");
  assert.equal(session.graph.nodes.get(face).standing, "apparatus");

  // A second reconciliation with nothing new to say is silent — the cast
  // did not change its mind, so nothing is appended.
  const second = reconcileGraphStandings(session, { sourceId: "s" });
  assert.equal(second.restood.length, 0);
  assert.equal(session.graph.nodes.get(face).standingHistory.length, 1);
});

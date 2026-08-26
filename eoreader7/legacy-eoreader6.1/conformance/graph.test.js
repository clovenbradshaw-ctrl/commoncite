// conformance/graph.test.js — emergence/graph.js's own primitives, standing
// alongside the constitution's II.9 pattern (host-graph.test.js already
// tests the host-tier wiring; nothing here tested graph.js's own exports on
// their own until now).
//
// Focus: `nodeWeights` (current, decayed weight — never the permanent
// `mentions` tally) and `restandNode` (received, giver-named, append-only,
// conservative on agreement) — the node/edge asymmetry and the belief-
// revision mechanism this repo's own CLAUDE.md names directly: "as they
// surf and fold, the system... re-weight[s], realizing what it thought was
// a character was an artifact."

import { test } from "node:test";
import assert from "node:assert/strict";
import { createGraph, readTriples, parseEdgeKey, nodeWeights, restandNode } from "../packages/engine/emergence/graph.js";

const T = (subject, verb, object, polarity) => ({ subject, verb, object, polarity });
const GAMMA = 0.9;
const PRUNE_BELOW = 1e-4;

test("parseEdgeKey inverts edgeKey's own subject|[!]verb|object format, negation included", () => {
  assert.deepEqual(parseEdgeKey("victor|creates|creature"), { subject: "victor", verb: "creates", object: "creature", negated: false });
  assert.deepEqual(parseEdgeKey("victor|!creates|creature"), { subject: "victor", verb: "creates", object: "creature", negated: true });
  // A structural key (graph.js's own A5) has no verb — the mid segment is
  // empty or bare "!".
  assert.deepEqual(parseEdgeKey("a||b"), { subject: "a", verb: "", object: "b", negated: false });
  assert.deepEqual(parseEdgeKey("a|!|b"), { subject: "a", verb: "", object: "b", negated: true });
});

test("nodeWeights reads CURRENT (decayed) incident edge weight — never the permanent mentions tally", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  readTriples(g, [T("victor", "studies", "science")]);
  const w1 = nodeWeights(g).get("victor");
  assert.ok(w1 > 0);
  assert.equal(g.nodes.get("victor").mentions, 1);

  // Many turns pass with nothing more said about victor — every edge decays
  // toward the prune floor and is eventually forgotten, but `mentions` never
  // moves: it only ever grows. This is the asymmetry the section exists to
  // close — a node's CURRENT weight must fall as its edges decay, even
  // though its lifetime tally stays exactly where it was.
  for (let i = 0; i < 40; i++) readTriples(g, [T("elizabeth", "writes", "letters")]);
  const w2 = nodeWeights(g).get("victor") ?? 0;
  assert.ok(w2 < w1, "victor's own current weight must fall as its edges decay while nothing restates them");
  assert.equal(g.nodes.get("victor").mentions, 1, "the permanent tally is untouched by decay");
});

test("nodeWeights counts a self-loop once, and every node gets an entry (0 if edgeless)", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  readTriples(g, [T("a", "reflects on", "a")]);
  const weights = nodeWeights(g);
  assert.equal(weights.get("a"), g.edges.get("a|reflects on|a"));
});

test("restandNode: standing is declared and giver-named, exactly injectPrior's own discipline", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  readTriples(g, [T("byline", "reports", "story")]);
  assert.throws(() => restandNode(g, "byline", { giver: "test" }), /declared, never defaulted/);
  assert.throws(() => restandNode(g, "byline", { standing: "apparatus" }), /a standing must name its giver/);
  // Explicit retraction (standing: null) is a real, declared value — it is
  // `undefined` alone that is refused.
  assert.doesNotThrow(() => restandNode(g, "byline", { standing: null, giver: "test" }));
});

test("restandNode refuses to manufacture a node the graph has never heard of — an honest typed report, never a throw", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  const result = restandNode(g, "nobody", { standing: "apparatus", giver: "test" });
  assert.equal(result.changed, false);
  assert.equal(result.reason, "unknown_node");
  assert.equal(g.nodes.has("nobody"), false, "a standing must never conjure a bare, edgeless node");
});

test("restandNode is append-only and conservative on agreement — the flagship case: what read as a character is realised to be an artifact", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  readTriples(g, [T("continental newswire", "learned", "the finding")]);

  const first = restandNode(g, "continental newswire", { standing: "holon", giver: "corpus.js (early pass, sparse evidence)" });
  assert.equal(first.changed, true);
  assert.equal(first.reason, "first_standing");
  assert.equal(first.history.length, 1);

  // Restating the SAME standing is not a revision — agreement is silent,
  // exactly P36's "re-confirming the same verdict lands no REC."
  const again = restandNode(g, "continental newswire", { standing: "holon", giver: "corpus.js (re-render, same page)" });
  assert.equal(again.changed, false);
  assert.equal(again.reason, "unchanged");
  assert.equal(again.history.length, 1, "no duplicate entry for an unchanged verdict");

  // Further surfing reveals what recurs constantly as a byline, not a
  // character — a genuine change of mind, conceded and recorded, never
  // silently overwritten.
  const revised = restandNode(g, "continental newswire", {
    standing: "apparatus",
    giver: "host/corpus.js::sessionReferents (naming-sentence-share demotion)",
    because: { namingSentenceShare: 0.525 },
  });
  assert.equal(revised.changed, true);
  assert.equal(revised.reason, "revised");
  assert.equal(revised.history.length, 2, "the prior standing is CONCEDED, not erased — both entries survive");
  assert.equal(revised.history[0].standing, "holon");
  assert.equal(revised.history[1].standing, "apparatus");
  assert.equal(g.nodes.get("continental newswire").standing, "apparatus", "the node's current standing is the latest entry");
  assert.equal(g.nodes.get("continental newswire").standingHistory.length, 2);

  // The graph's own accumulated belief (mentions, edges) is untouched by a
  // standing revision — only what the node IS SAID TO BE changed.
  assert.equal(g.nodes.get("continental newswire").mentions, 1);
  assert.ok(g.edges.has("continental newswire|learned|the finding"));
});

test("restandNode's history is copy-on-write — a snapshot taken before a revision does not silently grow one", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  readTriples(g, [T("byline", "reports", "story")]);
  restandNode(g, "byline", { standing: "holon", giver: "test" });
  const before = { ...g.nodes.get("byline") }; // the same shallow-copy a staged cursor takes
  restandNode(g, "byline", { standing: "apparatus", giver: "test" });
  assert.equal(before.standingHistory.length, 1, "a copy taken before the revision must not see the later entry");
  assert.equal(g.nodes.get("byline").standingHistory.length, 2, "the live node does");
});

test("no giver, no standing: emergence/graph.js stays vocabulary-agnostic — any typed judgement from any caller, never a hard-coded vocabulary", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  readTriples(g, [T("x", "does", "y")]);
  // Not "apparatus"/"holon"/etc — a caller-declared word this file never
  // validates, exactly the same discipline injectPrior holds for triples.
  const r = restandNode(g, "x", { standing: "a word this file has never heard of", giver: "test" });
  assert.equal(r.changed, true);
  assert.equal(r.standing, "a word this file has never heard of");
});

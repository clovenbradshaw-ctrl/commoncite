// eoreader6 · packages/host/graph — the host face of the belief graph.
//
// Wires two organs that already existed but had never been connected:
// corpus.js's per-document (subject, verb, object) triples (sessionRelations,
// itself discoveredCast's own `relations` — measured for the individuation
// classifier's `agency` signal and now exposed for this too), and
// emergence/graph.js's decaying Network, which has taken triples since it
// was written but had no caller anywhere in this repo. A session now carries
// one graph across every document it admits, so a relation restated in a
// later document still moves the same belief a first document formed.
//
// IDENTITY, CANONICALISED THROUGH THE CAST — emergence/graph.js's own header
// invites this ("feed it raw surfaces and it builds a surface graph; feed it
// resolved referent ids and it builds a referent graph"): a triple's
// subject/object is rewritten to the document's own discovered referent
// display name when one of sessionReferents' surfaces matches, so "Victor"
// and "Frankenstein" accumulate as one node rather than two. A side with no
// matching referent (most objects — not every noun phrase is a person/place
// the cast discovered) is kept as its own lowercase surface, exactly what
// readTriples already did before this file existed.
//
// NO NEW NODE KIND. This organ instantiates emergence/graph.js's own SYN ·
// Pattern · Composing cell at host tier (parallel to how host/corpus.js's
// admitChunked instantiates INS · Ground at host tier) — it is wiring, not a
// new measurement.

import { createGraph, readTriples, injectPrior, strongestEdges, edgeKey, structuralKey } from "../engine/emergence/graph.js";
import { sessionRelations, sessionReferents } from "./corpus.js";

export { createGraph, readTriples, injectPrior, strongestEdges, edgeKey, structuralKey };

// The cell this host organ occupies on the operator grid (engine/operators.js):
// SYN · Pattern · Composing — the same cell emergence/graph.js declares;
// admitGraph is that organ's host-tier caller. Declared, checked by
// conformance.
export const CELL = Object.freeze({ op: "SYN", grain: "Pattern" });

// gamma/pruneBelow are declared, never defaulted, inside emergence/graph.js
// itself (createGraph throws without them) — these two numbers are this
// host's OWN declared starting point for a chat-scale session (a handful of
// uploaded documents plus a running conversation, not a corpus-scale read),
// the same standing corpus.js's own CHUNK_SIZE already holds: an engineering
// starting point, not yet validated against a retrieval-quality golden.
const DEFAULT_GAMMA = 0.85;
const DEFAULT_PRUNE_BELOW = 0.05;

export function attachGraph(session, { gamma = DEFAULT_GAMMA, pruneBelow = DEFAULT_PRUNE_BELOW } = {}) {
  if (!session.graph) session.graph = createGraph({ gamma, pruneBelow });
  return session.graph;
}

// One document's discovered cast, as a surface -> canonical display name
// lookup, longest surface first so "Victor Frankenstein" claims a mention
// before "Frankenstein" alone gets the chance to. Exported since the staged
// admission in host/terrains.js needs the SAME canonicalisation per batch —
// a second copy of this logic would drift (SEED.md #5: two grounds built to
// different specs were never comparable).
export function referentLookup(session, sourceId) {
  const { referents } = sessionReferents(session, { sourceId });
  const lookup = new Map();
  for (const r of referents) {
    const surfaces = [...r.surfaces].sort((a, b) => b.length - a.length);
    for (const s of surfaces) lookup.set(String(s).toLowerCase(), r.display || r.id);
  }
  return lookup;
}

const canonicalize = (side, lookup) => lookup.get(String(side).toLowerCase()) ?? side;

/**
 * Read one (or every) admitted document's relations into the session's
 * graph. Idempotent per call is NOT claimed here — readTriples advances the
 * graph's belief on every call, by design (a relation restated is evidence,
 * not a duplicate) — so a caller that must not double-count a document it
 * has already admitted (eowebllm's chat store, admitting once per document
 * version) tracks that itself, the same discipline admitChunked's own
 * content-addressed dedup guard already keeps at the corpus tier, one layer
 * down.
 */
export function admitGraph(session, { sourceId, gamma, pruneBelow, alpha = 1 } = {}) {
  const graph = attachGraph(session, { gamma, pruneBelow });
  const targets = sourceId ? [sourceId] : Array.from(session.documents.keys());
  const results = [];
  for (const id of targets) {
    const { relations, gaps } = sessionRelations(session, { sourceId: id });
    if (!relations.length) {
      results.push({ sourceId: id, stated: 0, newEdges: 0, newNodes: 0, gaps });
      continue;
    }
    const lookup = referentLookup(session, id);
    const triples = relations.map((t) => ({
      subject: canonicalize(t.subject, lookup),
      verb: t.verb,
      object: canonicalize(t.object, lookup),
      polarity: t.polarity,
    }));
    const movement = readTriples(graph, triples, { alpha, structural: true });
    results.push({ sourceId: id, ...movement, gaps });
  }
  return { graph, admitted: results };
}

/** A plain-data view of the current graph, for a caller that must not hold a live Map (serialization, a UI list, a background-model prompt). */
export function sessionGraphSnapshot(session, { limit = 25 } = {}) {
  const graph = session.graph;
  if (!graph) return { nodes: [], edges: [], tick: 0, edgeTotal: 0, nodeCount: 0, edgeCount: 0 };
  return {
    nodes: [...graph.nodes.values()]
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, limit)
      .map((n) => ({ ...n })),
    edges: strongestEdges(graph, limit),
    tick: graph.tick,
    edgeTotal: graph.edgeTotal,
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.size,
  };
}

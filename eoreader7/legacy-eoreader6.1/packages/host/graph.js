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
// subject/object is rewritten to the document's resolved referent id when
// exactly one of sessionReferents' surfaces occurs in the phrase, so "to
// Alice" and "Alice" accumulate as one being rather than two surface nodes.
// Ambiguous phrases naming more than one referent, and sides with no match,
// remain surfaces rather than receiving a guessed identity.
//
// NO NEW NODE KIND. This organ instantiates emergence/graph.js's own SYN ·
// Pattern · Composing cell at host tier (parallel to how host/corpus.js's
// admitChunked instantiates INS · Ground at host tier) — it is wiring, not a
// new measurement.

import { createGraph, readTriples, injectPrior, strongestEdges, edgeKey, structuralKey, nodeWeights, restandNode, parseEdgeKey } from "../engine/emergence/graph.js";
import { sessionRelations, sessionReferents } from "./corpus.js";
import { diaNorm } from "../engine/perceiver/text/surfaces.js";
import { isFirstPerson, narratorAt, resolveAllNarratorSpans } from "../engine/perceiver/text/narrator.js";

export { createGraph, readTriples, injectPrior, strongestEdges, edgeKey, structuralKey, nodeWeights, restandNode, parseEdgeKey };

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

// THE REFERENT'S ONE FACE IN THE GRAPH. A referent record carries several
// surfaces ("Victor", "Victor Frankenstein", "Frankenstein") and an opaque
// id ("ref:auto:victor_frankenstein"); the graph must hold exactly ONE node
// for the being, so every organ that keys a graph node for a referent must
// key it the SAME way — this function, nowhere else. Two organs keying the
// same being two ways is not two spellings, it is the graph believing in
// two beings where the reading discovered one. The stable referent id is
// that face; display strings remain presentation and may change as the cast
// learns a fuller name.
export const referentFace = (r) => String(r.id);

// One document's received+discovered cast, as a surface -> referent id
// lookup, longest surface first so "Victor Frankenstein" claims a mention
// before "Frankenstein" alone gets the chance to. Exported since the staged
// admission in host/terrains.js needs the SAME canonicalisation per batch —
// a second copy of this logic would drift (SEED.md #5: two grounds built to
// different specs were never comparable).
export function referentLookup(session, sourceId, { priors = [] } = {}) {
  const { referents } = sessionReferents(session, { sourceId, priors, limit: Infinity });

  // Received narrator identity may know the being and its scope without
  // redundantly listing every lexical face. A display token is safe to
  // attach only when it is the prior's own canonical id (victor -> Victor,
  // walton -> Walton). Other display components are RESERVED but unresolved:
  // "Frankenstein" is part of Victor's display name, but the book also uses
  // the family name for other people, so it must not become either a global
  // alias for Victor or a second auto-minted being in the reasoning graph.
  const priorIds = new Set(priors.map((prior) => prior.id).filter(Boolean));
  const canonicalLexical = new Map();
  const reservedComponents = new Set();
  for (const prior of priors) {
    if (!prior?.id || !Array.isArray(prior.narratorSpans) || !prior.narratorSpans.length || !prior.display) continue;
    if (Array.isArray(prior.surfaces) && prior.surfaces.length) continue;
    const canonicalId = diaNorm(prior.id);
    const tokens = String(prior.display).match(/[\p{L}\p{N}'’-]+/gu) ?? [];
    for (const token of tokens) {
      const norm = diaNorm(token);
      if (norm === canonicalId) canonicalLexical.set(norm, prior.id);
      else reservedComponents.add(norm);
    }
  }

  const entries = [];
  for (const r of referents) {
    const surfaces = r.surfaces
      .map((surface) => typeof surface === "string" ? surface : surface?.surface)
      .filter(Boolean);
    for (const surface of surfaces) {
      const norm = diaNorm(surface);
      if (canonicalLexical.has(norm)) {
        entries.push({ surface: norm, referentId: canonicalLexical.get(norm), standing: "received_canonical_anchor" });
        continue;
      }
      if (reservedComponents.has(norm) && String(r.id).startsWith("ref:auto:")) continue;
      entries.push({ surface: norm, referentId: r.id });
    }
  }
  entries.sort((a, b) => b.surface.length - a.surface.length);

  const doc = session.documents.get(sourceId);
  const body = doc?.text || doc?.chunks?.map((chunk) => chunk.text).join("\n") || "";
  const { resolved: narratorSpans, unresolved: narratorGaps } = resolveAllNarratorSpans(body, priors);
  const lookup = new Map(entries.map((entry) => [entry.surface, entry.referentId]));
  lookup.entriesSorted = entries;
  lookup.narratorSpans = narratorSpans;
  lookup.narratorGaps = narratorGaps;
  lookup.priorIds = priorIds;
  lookup.reservedComponents = reservedComponents;
  lookup.canonicalLexical = canonicalLexical;
  lookup.canonicalReferentId = (id) => {
    const raw = String(id ?? "");
    const auto = raw.match(/^ref:auto:(.+)$/);
    if (!auto) return raw;
    const norm = diaNorm(auto[1]);
    if (canonicalLexical.has(norm)) return canonicalLexical.get(norm);
    if (reservedComponents.has(norm)) return null;
    return raw;
  };
  lookup.resolve = (side, offset) => canonicalize(side, offset, lookup);
  return lookup;
}

const includesSurface = (phrase, surface) => {
  let at = phrase.indexOf(surface);
  while (at !== -1) {
    const before = at === 0 ? "" : phrase[at - 1];
    const after = at + surface.length === phrase.length ? "" : phrase[at + surface.length];
    if ((!before || !/[\p{L}\p{N}]/u.test(before)) && (!after || !/[\p{L}\p{N}]/u.test(after))) return true;
    at = phrase.indexOf(surface, at + 1);
  }
  return false;
};

const canonicalize = (side, offset, resolver) => {
  const phrase = diaNorm(side);
  if (isFirstPerson(phrase)) {
    const narrator = narratorAt(offset, resolver.narratorSpans);
    if (narrator.referentId) {
      const raw = narrator.referentId.replace(/^ref:narrator:/, "");
      return resolver.priorIds.has(raw) ? raw : narrator.referentId;
    }
  }

  const matches = new Set();
  for (const entry of resolver.entriesSorted) if (includesSurface(phrase, entry.surface)) matches.add(entry.referentId);
  return matches.size === 1 ? [...matches][0] : side;
};

/** Resolve relation sides to beings before they enter Network. */
export function resolveRelations(session, { sourceId, priors = [] } = {}) {
  const { relations, gaps } = sessionRelations(session, { sourceId });
  const resolver = referentLookup(session, sourceId, { priors });
  return {
    relations: relations.map((relation) => ({
      subject: resolver.resolve(relation.subject, relation.subjectOffset ?? relation.offset),
      verb: relation.verb,
      object: resolver.resolve(relation.object, relation.objectOffset ?? relation.offset),
      polarity: relation.polarity,
      offset: relation.offset,
    })),
    gaps: [...gaps, ...resolver.narratorGaps],
  };
}

/**
 * The cast's POSITIVE individuation verdicts for one document, keyed by the
 * referent's one face in the graph (`referentFace`, above) — the join is
 * referent -> node, never surface -> node: whichever spelling a triple used,
 * canonicalisation already landed it on this face, so the verdict lands on
 * the same being the belief accumulated on.
 *
 * A referent whose `individuation` is null is OMITTED, deliberately: null is
 * the classifier declining for lack of evidence (corpus.js's own contract —
 * "genuinely insufficient evidence still returns null"), and a declination
 * must never overwrite a standing an earlier, evidenced verdict set. Absence
 * of evidence licenses withholding judgment, never manufacturing one — the
 * same constitutional line the-fold's grounding ladder already holds.
 */
export function castStandings(session, sourceId, { priors = [] } = {}) {
  const { referents } = sessionReferents(session, { sourceId, priors });
  const standings = new Map();
  for (const r of referents) {
    if (!r.individuation) continue;
    standings.set(referentFace(r), {
      standing: r.individuation,
      referent: r.id,
      display: r.display || r.id,
      ...(typeof r.namingSentenceShare === "number" ? { namingSentenceShare: r.namingSentenceShare } : {}),
    });
  }
  return standings;
}

/**
 * Carry the cast's CURRENT realization about each referent onto the belief
 * graph's own nodes — the re-weighting moment this module exists for: the
 * cast is re-derived as a document grows (discoveredCast memoises by chunk
 * count and recomputes when more material arrives), so what the cast now
 * knows ("what I read as a character is a narrating apparatus") can differ
 * from what the graph believed when its triples were admitted. Each changed
 * verdict lands through `restandNode` — received, giver named, history kept
 * — and each RESTATED verdict lands nothing (agreement is not a revision).
 *
 * The graph's accumulated belief is NOT rewritten here: the node keeps its
 * mentions, its edges keep their weights, and the organ's own gamma decay
 * remains the only forgetting. What changes is what the node IS SAID TO BE,
 * on the record, from this tick forward — a reader scrubbing the staged
 * cursor still sees the node believed-as-cast at the stages where it was.
 *
 * DISCLOSED, NOT SILENTLY DROPPED: `restandNode` correctly refuses to
 * conjure a node for a referent the graph's own triples never actually
 * landed one for (`unknown_node`) — measured live on this repo's own
 * wire-quiet-subject.txt fixture, this is not a hypothetical: "Continental
 * Newswire" is discovered and typed `apparatus` at the cast tier, but
 * `extractRelations`'s own subject-span for its stated relations is the
 * shorter fragment "Newswire" alone, which is not one of the referent's own
 * registered surfaces — so `canonicalize()` (this file's `canon`, in
 * `admitGraph`/host/terrains.js) falls through uncanonicalised and the
 * triple lands its belief on a DIFFERENT, un-canonical node, one this
 * reconciliation can never find by the referent's own face. That gap is a
 * DIFFERENT, upstream defect (the relation extractor's own coverage,
 * already named as a real limitation elsewhere in this project's own
 * history) — not something a reconciliation pass should paper over by
 * fuzzy-matching surface strings, which is exactly the referent-vs-surface
 * conflation this whole mechanism exists to refuse. So a referent with a
 * real standing verdict but no matching node is named on `unresolved`,
 * never silently absorbed into an empty `restood` list.
 */
export function reconcileGraphStandings(session, { sourceId, priors = [] } = {}) {
  const graph = session.graph;
  if (!graph) return { restood: [], unresolved: [] };
  const targets = sourceId ? [sourceId] : Array.from(session.documents.keys());
  const restood = [];
  const unresolved = [];
  for (const id of targets) {
    for (const [face, verdict] of castStandings(session, id, { priors })) {
      const result = restandNode(graph, face, {
        standing: verdict.standing,
        giver: "host/corpus.js::sessionReferents — the cast's own individuation (apparatus by naming-sentence-share; emanon/protogon/holon by the mass×coupling×agency classifier)",
        because: {
          sourceId: id,
          referent: verdict.referent,
          ...(verdict.namingSentenceShare !== undefined ? { namingSentenceShare: verdict.namingSentenceShare } : {}),
        },
      });
      if (result.changed) {
        restood.push({ node: result.nodeId, standing: result.standing, was: result.history.length > 1 ? result.history[result.history.length - 2].standing : null, referent: verdict.referent, sourceId: id });
      } else if (result.reason === "unknown_node") {
        unresolved.push({ node: face, standing: verdict.standing, referent: verdict.referent, sourceId: id, reason: "unknown_node" });
      }
    }
  }
  return { restood, unresolved };
}

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
export function admitGraph(session, { sourceId, gamma, pruneBelow, alpha = 1, priors = [] } = {}) {
  const graph = attachGraph(session, { gamma, pruneBelow });
  const targets = sourceId ? [sourceId] : Array.from(session.documents.keys());
  const results = [];
  for (const id of targets) {
    const { relations, gaps } = resolveRelations(session, { sourceId: id, priors });
    if (!relations.length) {
      results.push({ sourceId: id, stated: 0, newEdges: 0, newNodes: 0, gaps });
      continue;
    }
    const movement = readTriples(graph, relations, { alpha, structural: true });
    results.push({ sourceId: id, ...movement, gaps });
  }
  // The cast's current individuation verdicts land on the nodes the triples
  // just accumulated belief on — same call, so an admission is never left
  // believing a byline is a character when the cast already knows better.
  // `unresolved` names a real, disclosed limit rather than hiding it: a
  // referent the cast has typed but whose stated-relations node the SVO
  // extractor's own subject span never matched (see reconcileGraphStandings'
  // own header for the measured case this names).
  const { restood, unresolved } = reconcileGraphStandings(session, { sourceId, priors });
  return { graph, admitted: results, restood, unresolved };
}

/**
 * A plain-data view of the current graph, for a caller that must not hold a
 * live Map (serialization, a UI list, a background-model prompt).
 *
 * RANKED BY CURRENT WEIGHT, NOT LIFETIME MENTIONS (2026-08-21). `mentions`
 * only ever grows — ranking by it served the cumulative transcript, not the
 * evolving belief, which is the exact ranking mistake referents/entity.js's
 * own register refuses ("frequency is not significance; that is how a
 * reader ends up calling the commonest word the protagonist"). Every node
 * now carries `weight` — the summed CURRENT (decayed) weight of its
 * incident edges, engine graph.js's `nodeWeights` — and the list fronts
 * what the graph believes NOW; `mentions` stays on the node as the
 * historical tally it is. `standings` lists every node currently carrying a
 * received standing (with its full append-only history), COMPLETE rather
 * than limit-cut: a demotion must stay visible even when the demoted node
 * no longer makes the weight cut.
 */
export function sessionGraphSnapshot(session, { limit = 25 } = {}) {
  const graph = session.graph;
  if (!graph) return { nodes: [], edges: [], tick: 0, edgeTotal: 0, nodeCount: 0, edgeCount: 0, standings: [] };
  const weights = nodeWeights(graph);
  return {
    nodes: [...graph.nodes.values()]
      .map((n) => ({ ...n, weight: weights.get(n.id) ?? 0 }))
      .sort((a, b) => b.weight - a.weight || b.mentions - a.mentions)
      .slice(0, limit),
    edges: strongestEdges(graph, limit),
    tick: graph.tick,
    edgeTotal: graph.edgeTotal,
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.size,
    standings: [...graph.nodes.values()]
      .filter((n) => n.standingHistory?.length)
      .map((n) => ({ node: n.id, standing: n.standing, history: [...n.standingHistory] })),
  };
}

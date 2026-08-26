// eoreader6 · emergence/graph — THE PRIOR IS A GRAPH, and it evolves.
//
// Every earlier attempt in this repo made the reader's belief a word
// frequency distribution. A reader does not believe "which words are
// likely." A reader believes WHO IS PRESENT AND WHAT THEY DO TO WHOM, and
// Bayesian surprise is how far a passage moves THAT.
//
// The graph is the STRUCTURE tier, which the ladder diagram had as unbuilt:
//   nodes  = Entity   (Existence · Figure)
//   edges  = Link     (Structure · Figure)
//   whole  = Network  (Structure · Pattern)
//
// MODALITY-AGNOSTIC BY CONSTRUCTION. It consumes (subject, verb, object,
// polarity) triples and never learns where they came from. English SVO comes
// from perceiver/text/relations.js; a video perceiver supplying
// actor-action-target would not change a line here.
//
// Belief movement reuses `bayesianSurprise` unchanged — the "forms" are
// simply edges rather than words, which is the whole reason that function
// takes Maps and totals rather than text.
//
// gamma is the graph's forgetting: a relation not restated fades. That is
// what makes this a reader's evolving belief rather than a cumulative
// transcript, and it is why a motif returning after long enough away can
// move belief again. Declared, never defaulted.
//
// IDENTITY IS WHATEVER IT IS GIVEN. Subjects and objects are keyed by the
// string handed in. Feed it raw surfaces and it builds a surface graph; feed
// it resolved referent ids and it builds a referent graph. The graph does not
// resolve identity and must not — that is coref's job, upstream, and the seam
// is deliberate: it is where an injected eoPriors coref prior wires in.
//
// A5: STRUCTURAL EDGEKEY. Binding-derived links carry polarity but no verb
// — the "co-occur" verb is the machinery's own name, not content. The
// structural key `a|polarity|b` (no verb) runs alongside the verb-inclusive
// key so that both text-derived and binding-derived relations coexist in the
// same Network. The structural key is behind the `structural` flag; when
// reading Link records, both keyings run. `promote` decides using the
// structural key.

import { bayesianSurprise } from "./surprise.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// SYN · Network · Composing — the prior is a graph; nodes are Entity, edges
// Link, whole Network. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "SYN", grain: "Pattern" });

export const createGraph = ({ gamma, pruneBelow }) => {
  if (!Number.isFinite(gamma) || gamma <= 0 || gamma > 1)
    throw new TypeError("createGraph: gamma is declared in (0,1], never defaulted — it is the rate of forgetting");
  // A second, silent forgetting parameter: a relation decayed past this is
  // forgotten outright rather than carried as noise. It sat as a bare module
  // constant while gamma, right beside it, was already required — declared
  // and validated the same way gamma is, not defaulted.
  if (!Number.isFinite(pruneBelow) || pruneBelow <= 0)
    throw new TypeError("createGraph: pruneBelow is declared, never defaulted — it is the floor below which a relation is forgotten outright");
  return { nodes: new Map(), edges: new Map(), edgeTotal: 0, gamma, pruneBelow, tick: 0, provenance: [] };
};

export const edgeKey = ({ subject, verb, object, polarity }) =>
  `${String(subject).toLowerCase()}|${polarity === "−" || polarity === "-" ? "!" : ""}${verb}|${String(object).toLowerCase()}`;

/**
 * Structural edge key: `a|polarity|b` — no verb. Binding-derived links
 * carry polarity but the verb ("co-occur") is the machinery's own name,
 * not content. This key runs alongside the verb-inclusive key so that
 * both text-derived and binding-derived relations coexist in the same
 * Network.
 */
export const structuralKey = ({ subject, polarity, object }) =>
  `${String(subject).toLowerCase()}|${polarity === "−" || polarity === "-" ? "!" : ""}|${String(object).toLowerCase()}`;

/**
 * Extract triples from a Link record (from emergence/binding.js).
 * The link's direction determines subject/object; polarity is carried
 * through. Returns an array of triple-shaped objects.
 */
const linkToTriples = (link) => {
  if (!link.direction) return [];
  const subject = link.direction === "a→b" ? link.a.id : link.b.id;
  const object = link.direction === "a→b" ? link.b.id : link.a.id;
  return [{ subject, verb: "co-occur", object, polarity: link.polarity }];
};

/**
 * Read one frame's triples. Returns the belief movement BEFORE advancing —
 * the frame is never part of the prior it is measured against.
 *
 * Accepts either bare triples (subject, verb, object, polarity) or Link
 * records from binding.js. Link records are converted to triples internally;
 * both the verb-inclusive key and the structural key run when `structural`
 * is true.
 */
export const readTriples = (graph, triples, { alpha = 1, structural = false } = {}) => {
  const arrival = new Map();
  const structuralArrival = structural ? new Map() : null;

  for (const t of triples) {
    // Link records: extract triples first. Skip undirected links.
    if (t.a && t.b && !t.direction) continue;
    const ts = t.direction ? linkToTriples(t) : [t];
    for (const triple of ts) {
      const k = edgeKey(triple);
      arrival.set(k, (arrival.get(k) ?? 0) + 1);
      if (structuralArrival) {
        const sk = structuralKey(triple);
        structuralArrival.set(sk, (structuralArrival.get(sk) ?? 0) + 1);
      }
    }
  }
  const arrivalTotal = triples.length;

  let belief = null;
  if (graph.edgeTotal > 0 && arrivalTotal > 0) {
    belief = bayesianSurprise(graph.edges, graph.edgeTotal, arrival, arrivalTotal, { gamma: graph.gamma, alpha });
  }

  // What is genuinely new, kept apart from how far belief moved: a passage
  // can restate known relations and still shift belief (by re-weighting), or
  // introduce a new one that barely registers (in a dense graph).
  let newEdges = 0, newNodes = 0;
  for (const k of arrival.keys()) if (!graph.edges.has(k)) newEdges++;

  // ── advance ───────────────────────────────────────────────────────────────
  // EVERY edge decays, not only the restated ones. Decaying the total while
  // leaving absent edges untouched makes the distribution stop summing to 1
  // and drives KL negative — a real bug, fixed once already in this repo.
  for (const [k, w] of graph.edges) graph.edges.set(k, w * graph.gamma);
  graph.edgeTotal *= graph.gamma;

  for (const [k, c] of arrival) {
    graph.edges.set(k, (graph.edges.get(k) ?? 0) + c);
    graph.edgeTotal += c;
  }
  for (const [k, w] of graph.edges) {
    if (w < graph.pruneBelow) { graph.edgeTotal -= w; graph.edges.delete(k); }
  }

  // Structural edges: advance alongside verb-inclusive edges.
  if (structuralArrival) {
    for (const [k, c] of structuralArrival) {
      graph.edges.set(k, (graph.edges.get(k) ?? 0) + c);
      graph.edgeTotal += c;
    }
  }

  for (const t of triples) {
    if (t.a && t.b && !t.direction) continue;
    const ts = t.direction ? linkToTriples(t) : [t];
    for (const triple of ts) {
      for (const side of [triple.subject, triple.object]) {
        const id = String(side).toLowerCase();
        if (!graph.nodes.has(id)) { graph.nodes.set(id, { id, mentions: 0, firstSeen: graph.tick }); newNodes++; }
        graph.nodes.get(id).mentions++;
        graph.nodes.get(id).lastSeen = graph.tick;
      }
    }
  }

  graph.tick++;
  return { belief, stated: arrivalTotal, newEdges, newNodes, nodes: graph.nodes.size, edges: graph.edges.size };
};

/**
 * Received priors — eoPriors and anything else with a named giver. Injected,
 * never derived: this is witness-tier knowledge about the world, and the
 * engine refuses to invent it. `giver` is required for the same reason
 * `received()` in nul demands provenance: a prior whose origin cannot be
 * named is indistinguishable from a fabrication.
 */
export const injectPrior = (graph, triples, { giver, weight = 1 }) => {
  if (!giver) throw new TypeError("injectPrior: a prior must name its giver");
  for (const t of triples) {
    const k = edgeKey(t);
    graph.edges.set(k, (graph.edges.get(k) ?? 0) + weight);
    graph.edgeTotal += weight;
    for (const side of [t.subject, t.object]) {
      const id = String(side).toLowerCase();
      if (!graph.nodes.has(id)) graph.nodes.set(id, { id, mentions: 0, firstSeen: graph.tick, fromPrior: giver });
    }
  }
  graph.provenance.push({ giver, triples: triples.length, atTick: graph.tick });
  return graph;
};

/** The strongest relations currently believed, for inspection. */
export const strongestEdges = (graph, n = 10) =>
  [...graph.edges.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, w]) => ({ edge: k, weight: w }));

// ── node weight, standing, and re-weighting ─────────────────────────────────
//
// `node.mentions` is a permanent tally — it only ever grows, the same as a
// reading's raw word count. It answers "how much has this being been named,
// ever," which is a different question from what the graph actually BELIEVES
// right now: a being whose every edge decayed past pruneBelow and vanished
// three hundred pages ago still carries its full historical mentions count,
// forever, exactly as prominent on paper as one mentioned just as often but
// far more recently. That is the node/edge asymmetry this section closes —
// edges decay, so the node's OWN currently-believed weight should be read off
// its currently-believed edges, not off a counter that never forgets.
//
// `parseEdgeKey` is the exact inverse of `edgeKey`/`structuralKey`'s shared
// `subject|[!]verb|object` format (verb empty for a structural key) — a
// second, small, self-contained parser rather than reaching into
// `revision.js`'s own private `parseEdge` (unexported on purpose, and
// `search/index.js` already imports it from there for a different reason:
// walking a revision's operator decomposition, not a live graph's current
// weight). Two tiny parsers of one documented format is not the class of
// duplication CLAUDE.md's reconciliation rule warns about — there is no
// behaviour here that could drift, because the format is fixed and stated
// once, in `edgeKey`'s own construction, above.
export const parseEdgeKey = (key) => {
  const i = key.indexOf("|");
  const j = key.lastIndexOf("|");
  const mid = key.slice(i + 1, j);
  const negated = mid.startsWith("!");
  return { subject: key.slice(0, i), verb: negated ? mid.slice(1) : mid, object: key.slice(j + 1), negated };
};

/**
 * Every node's CURRENTLY BELIEVED weight, in one O(edges) pass: the sum of
 * each node's incident edges' current (already-decayed) weight — never the
 * permanent `mentions` tally. A self-loop counts once. Reads `graph.edges`
 * as it stands; a caller who wants the weight as of an earlier stage reads
 * it from a snapshot taken at that stage (host/terrains.js already stages
 * admission for exactly this reason).
 */
export const nodeWeights = (graph) => {
  const weights = new Map();
  for (const id of graph.nodes.keys()) weights.set(id, 0);
  for (const [k, w] of graph.edges) {
    const { subject, object } = parseEdgeKey(k);
    if (weights.has(subject)) weights.set(subject, weights.get(subject) + w);
    if (object !== subject && weights.has(object)) weights.set(object, weights.get(object) + w);
  }
  return weights;
};

/**
 * Revise what a node IS, not what it is connected to — a witnessed judgment
 * about the being itself (this repo's own flagship case: what surfaced as a
 * recurring name turns out, on further reading, to be a wire-service byline
 * rather than a character). Modelled directly on `injectPrior`, right above:
 * received, never derived, and a standing with no giver is indistinguishable
 * from a fabrication, so `giver` is required on every call, exactly as it is
 * there.
 *
 * DELIBERATELY VOCABULARY-AGNOSTIC. This file's own header states the rule
 * this function must not break: "IDENTITY IS WHATEVER IT IS GIVEN... The
 * graph does not resolve identity and must not." The same discipline applies
 * to KIND, one column over — `standing` is accepted as whatever string (or
 * explicit `null`, a genuine retraction) the caller hands in, never checked
 * against a vocabulary. A caller with a specific typed vocabulary of being-
 * kinds (referents/index.js's own INDIVIDUATION_TYPES, at host tier) is the
 * one who knows what those words mean and is the one who must validate them
 * — importing that vocabulary in here would be the first-ever coupling from
 * `emergence/` to `referents/`, for a five-word list this file has no
 * business knowing the meaning of.
 *
 * APPEND-ONLY, AND CONSERVATIVE ON AGREEMENT. Every call that changes the
 * standing lands a new entry at the end of `standingHistory` (oldest first);
 * nothing already on that list is ever edited or dropped. The history is
 * replaced copy-on-write rather than pushed in place, deliberately: a
 * snapshot that shallow-copied the node (`{...node}` — what revision.js's
 * `snapshot` and host/terrains.js's staged cursor both do) must keep showing
 * the history AS OF the copy, not silently grow a later revision — belief
 * as-of-a-point is the staged cursor's whole contract. A call that
 * RESTATES the current standing is a no-op — no new entry, `changed: false`
 * — the same rule P36 already states for EVA/REC on this project's claim
 * ledger ("Re-confirming the same verdict lands no REC — agreement is not a
 * contradiction"). Only a genuine change of mind — including the very first
 * standing a node is ever given — is a witnessed revision.
 *
 * A node the graph has never heard of (no incident edges, never registered
 * by `readTriples`/`injectPrior`) is refused rather than manufactured: a
 * standing describes something the graph already believes exists, and
 * conjuring a bare, edgeless node just to hang a judgement on it would be
 * exactly the "manufacturing conviction from absence" this repo's own
 * grounding-ladder section already refuses elsewhere. Returned as a typed
 * report, never a throw — an unknown node is an honest runtime state (the
 * caller's own referent discovery ran ahead of, or independently of, what
 * this graph has actually read), not a programmer error.
 */
export const restandNode = (graph, nodeId, { standing, giver, because } = {}) => {
  if (standing === undefined) throw new TypeError("restandNode: standing is declared, never defaulted — pass a value or explicit null to retract one");
  if (!giver) throw new TypeError("restandNode: a standing must name its giver — indistinguishable from a fabrication otherwise");

  const id = String(nodeId).toLowerCase();
  const node = graph.nodes.get(id);
  if (!node) return { changed: false, reason: "unknown_node", nodeId: id, standing: null, history: [] };

  const history = node.standingHistory ?? [];
  const current = history.length ? history[history.length - 1].standing : undefined;
  if (current === standing) return { changed: false, reason: "unchanged", nodeId: id, standing: current, history };

  const entry = Object.freeze({ standing, giver, because: because ?? null, atTick: graph.tick });
  node.standingHistory = Object.freeze([...history, entry]);
  node.standing = standing;
  return { changed: true, reason: current === undefined ? "first_standing" : "revised", nodeId: id, standing, history: node.standingHistory };
};

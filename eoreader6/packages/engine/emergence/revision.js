// eoreader6 · emergence/revision — SURPRISE IS A WITNESSED REVISION OF PRIOR
// STRUCTURE, decomposed across the operators and ranked against its own null.
//
// The constitution's II.9. Everything before this organ measured a property of
// the ARRIVAL: how improbable was this passage under what I believed
// (surprise.js), how far did the edge distribution move (graph.js), how high
// did a disturbance climb (tiers.js). All three answer "how unusual is this",
// and none answers "what did it change". A rare passage that reorganises
// nothing and a plain sentence that merges two referents can produce the same
// KL, and a reader who cannot tell them apart has not read.
//
//   difference   the arrival differs from local material      CANDIDATE
//   revision     the difference changes the structure         SURPRISE
//   pattern      the changed structure changes later uptake   CONSEQUENCE
//
// So the measurement is taken on a COPY. A candidate is applied to a snapshot
// of the prior, the delta is attributed to operators, and each operator's count
// is placed against a null built from continuations the prior itself expects.
// The copy is load-bearing twice over: without it the refused alternatives
// cannot be kept (they would have to be committed to be seen), and the
// counterfactual replay durability needs is impossible.
//
// NOT A SCALAR. The record is an operator vector, because introducing,
// connecting, contradicting and reorganising are different kinds of surprise at
// equal magnitude. Any collapse is the caller's, declared and task-relative.
//
// EIGHT OPERATORS ARE MEASURABLE HERE; REC IS NOT, AND SAYS SO. A frame
// reconstruction is not visible in one graph delta — it is the tier stack's act
// (emergence/tiers.js), where an observation that disturbed every fast tier
// beneath it reaches a slow one. Reporting REC from an edge diff would be
// fabricating the deepest operator from the shallowest evidence, so REC returns
// a typed gap naming the organ that owns it. A gap is a result (SEED #8).
//
// MEASURED, AND THE MOST IMPORTANT THING IN THIS FILE: THE CONTINUATION NULL
// IS VACUOUS FOR THE GENERATIVE OPERATORS, BY CONSTRUCTION.
//
// The null here draws synthetic arrivals from the prior's own edge
// distribution — "what if the material simply continued as I expect". That is
// the right null for the operators restatement can actually move:
//
//   NUL EVA SIG   a continuation restates edges, so weights shift, things fall
//                 past the prune floor, and incident distributions move. The
//                 null has real width and the rank means something.
//
//   INS CON SYN   a continuation can only ever restate edges the prior ALREADY
//   SEG DEF       HOLDS. It can never mint a new edge, never make two nodes
//                 adjacent that were not, never merge two components, never
//                 assert a contrary polarity. So the null is identically zero
//                 for these, every draw, and its width is zero.
//
// Measured on the two-islands fixture: SYN observed 1 against support [0,0].
// A null of zero width would clear anything put in front of it, which is
// SEED #3 — the lineage's most expensive dead end, and it has reappeared here
// exactly as promised. So these operators return `zero_width` and are NOT
// ranked. The organ reports that it cannot place them rather than emitting a
// rank that would be an artefact of the null's incapacity. **Do not "fix" this
// by widening the support or by falling back to a global constant.** The count
// is still reported and is still true; what is missing is a ground to place it
// against.
//
// What the generative operators actually need is a perturbation that CAN
// produce structure the prior does not hold, so that observing structure is not
// automatically surfeit: a degree-preserving rewiring of the prior's own edges,
// which keeps each referent's participation fixed while destroying which
// specific pairings obtained. Then "victor creates creature" is measured
// against how often a merge occurs when this reader's relations are rewired at
// random, which is a real question with a real answer. Per SEED Amendment I,
// sensitivity is a property of the (statistic, perturbation) PAIR — so that
// family must establish its own sensitivity and inherits no warrant from this
// one. Not built here; pinned by conformance so it cannot be papered over.
//
// MODALITY-AGNOSTIC BY CONSTRUCTION, inherited from graph.js: this consumes
// (subject, verb, object, polarity) triples and never learns where they came
// from. Actor-action-target from a video perceiver, or voice-gesture-voice from
// an audio one, would not change a line. The operators describe what figures do
// to understanding; only the perceiver is modality-specific.

import { bayesianSurprise } from "./surprise.js";
import { edgeKey, readTriples } from "./graph.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// EVA · Network · Tracing — witness at Pattern grain: speak only of what
// changed the ground, and say which operator changed it. Declared, checked by
// conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Pattern" });

/** The eight this organ can witness, in the grid's own order. REC is deferred. */
export const MEASURED = Object.freeze(["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA"]);

const PRUNE_BELOW = 1e-4; // must match graph.js: a decayed relation is forgotten, not carried

const gap = (type, detail = {}) => Object.freeze({ gap: type, ...detail });

// ── the copy ────────────────────────────────────────────────────────────────

/**
 * A structural copy of a graph. The candidate is applied here, never to the
 * caller's belief: a revision that has not yet been witnessed must not have
 * already been committed.
 */
export const snapshot = (graph) => ({
  nodes: new Map([...graph.nodes].map(([k, v]) => [k, { ...v }])),
  edges: new Map(graph.edges),
  edgeTotal: graph.edgeTotal,
  gamma: graph.gamma,
  tick: graph.tick,
  provenance: [...(graph.provenance ?? [])],
});

/**
 * Apply an arrival to a copy, with graph.js's own decay-then-add-then-prune
 * order. Exported so sibling organs (the search relevance gate) measure with
 * the same advance — measuring and believing must not drift apart, and
 * neither may two measurements drift apart.
 */
export const applyTo = (g, arrival) => {
  for (const [k, w] of g.edges) g.edges.set(k, w * g.gamma);
  g.edgeTotal *= g.gamma;
  for (const [k, c] of arrival) {
    g.edges.set(k, (g.edges.get(k) ?? 0) + c);
    g.edgeTotal += c;
  }
  for (const [k, w] of g.edges) if (w < PRUNE_BELOW) { g.edgeTotal -= w; g.edges.delete(k); }
  for (const k of arrival.keys()) {
    const { s, o } = parseEdge(k);
    for (const id of [s, o]) if (!g.nodes.has(id)) g.nodes.set(id, { id, mentions: 0, firstSeen: g.tick });
  }
  g.tick++;
  return g;
};

// ── edge keys ───────────────────────────────────────────────────────────────
// graph.js builds `subject|[!]verb|object`. Parsing it back is what lets a
// contradiction be seen as a contradiction rather than as two unrelated edges.

const parseEdge = (key) => {
  const i = key.indexOf("|");
  const j = key.lastIndexOf("|");
  const mid = key.slice(i + 1, j);
  const neg = mid.startsWith("!");
  return { s: key.slice(0, i), v: neg ? mid.slice(1) : mid, o: key.slice(j + 1), neg };
};
export { parseEdge };

const flipOf = (key) => {
  const { s, v, o, neg } = parseEdge(key);
  return `${s}|${neg ? "" : "!"}${v}|${o}`;
};

const endpointsOf = (key) => { const { s, o } = parseEdge(key); return [s, o]; };

// ── components, for SYN and SEG ─────────────────────────────────────────────
// Whether several structures became one, or one split into several, is a fact
// about connectivity and nothing else. Union-find over the edge set, restricted
// to the nodes both graphs share so that arrival of new material is counted as
// INS rather than smuggled in as a merge.

const componentCount = (edges, over) => {
  const parent = new Map([...over].map((n) => [n, n]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const k of edges.keys()) {
    const [a, b] = endpointsOf(k);
    if (!parent.has(a) || !parent.has(b)) continue;
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  return new Set([...over].map(find)).size;
};

const adjacency = (edges, over) => {
  const pairs = new Set();
  for (const k of edges.keys()) {
    const [a, b] = endpointsOf(k);
    if (!over.has(a) || !over.has(b) || a === b) continue;
    pairs.add(a < b ? `${a} ${b}` : `${b} ${a}`);
  }
  return pairs;
};

// ── per-node incident distributions, for SIG and for standpoint ─────────────
// A node's identity IS what it is incident to. When that distribution moves,
// the being has acquired a different significance — which is also, read the
// other way, this node's own standpoint on the arrival. One computation, two
// uses: SIG is standpoint-indexed surprise, not a separate mechanism.

const incidentOf = (edges, node) => {
  const m = new Map();
  let total = 0;
  for (const [k, w] of edges) {
    const [a, b] = endpointsOf(k);
    if (a !== node && b !== node) continue;
    m.set(k, w);
    total += w;
  }
  return { m, total };
};

// ── the decomposition ───────────────────────────────────────────────────────

/**
 * Attribute the delta between two graphs to operators. Returns the occurrences
 * themselves, not counts alone — a count with no witness is not testimony.
 */
export const decompose = (prior, posterior, { alpha = 1 } = {}) => {
  const P = prior.edges, Q = posterior.edges;

  const INS = { edges: [], nodes: [] };
  const NUL = { edges: [] };
  const EVA = { edges: [] };
  const DEF = { refused: [] };

  for (const [k, w] of Q) {
    const fresh = !P.has(k);
    const strengthened = !fresh && w > P.get(k);
    if (fresh) INS.edges.push(k);
    else if (strengthened) EVA.edges.push({ edge: k, from: P.get(k), to: w });
    // A believed relation whose contrary now arrives: the arrival refuses an
    // expectation the prior held. Only edges the arrival actually asserted can
    // refuse anything — every other edge merely decayed, and reporting those
    // would re-file every long-standing contradiction as fresh news each turn.
    // Kept with its finality: the prior edge is not deleted, so the refusal is
    // provisional and stays inspectable.
    if (!fresh && !strengthened) continue;
    const flip = flipOf(k);
    if (P.has(flip)) DEF.refused.push({ asserted: k, refuses: flip, priorWeight: P.get(flip), finality: "provisional" });
  }
  for (const k of P.keys()) if (!Q.has(k)) NUL.edges.push(k);
  for (const id of posterior.nodes.keys()) if (!prior.nodes.has(id)) INS.nodes.push(id);

  // Structure: only over nodes both graphs hold, so new material is INS and
  // never a spurious merge.
  const shared = new Set([...prior.nodes.keys()].filter((n) => posterior.nodes.has(n)));
  const before = componentCount(P, shared);
  const after = componentCount(Q, shared);
  const adjBefore = adjacency(P, shared);
  const adjAfter = adjacency(Q, shared);

  const CON = { pairs: [...adjAfter].filter((p) => !adjBefore.has(p)).map((p) => p.split(" ")) };
  const SYN = { merged: Math.max(0, before - after), componentsBefore: before, componentsAfter: after };
  const SEG = { split: Math.max(0, after - before), componentsBefore: before, componentsAfter: after };

  // SIG: whose significance moved, and by how far. gamma = 0 is full
  // commitment — the posterior incident distribution alone against the prior's,
  // which is the boundary case surprise.js's invariant is stated at.
  const SIG = { nodes: [] };
  for (const id of shared) {
    const a = incidentOf(P, id), b = incidentOf(Q, id);
    if (a.total <= 0 || b.total <= 0) continue;
    const moved = bayesianSurprise(a.m, a.total, b.m, b.total, { gamma: 0, alpha });
    if (moved != null && moved > 0) SIG.nodes.push({ node: id, moved });
  }
  SIG.nodes.sort((x, y) => y.moved - x.moved);

  return Object.freeze({
    NUL, SIG, INS, SEG, CON, SYN, DEF, EVA,
    // Not measurable from one graph delta. Named, not guessed.
    REC: gap("wrong_grain", {
      reason: "a frame reconstruction is not visible in an edge diff; it is the tier stack's act",
      organ: "emergence/tiers.js",
      how: "an observation that disturbs every fast tier beneath a slow one has reconstructed the slow one's ground",
    }),
  });
};

/** The count each operator is ranked by. One number per operator, never one number overall. */
export const countsOf = (d) => Object.freeze({
  NUL: d.NUL.edges.length,
  SIG: d.SIG.nodes.length,
  INS: d.INS.edges.length + d.INS.nodes.length,
  SEG: d.SEG.split,
  CON: d.CON.pairs.length,
  SYN: d.SYN.merged,
  DEF: d.DEF.refused.length,
  EVA: d.EVA.edges.length,
});

// ── the null, one per operator ──────────────────────────────────────────────

const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Place an observed count in its own null's support, in the seed's vocabulary:
 * a rank where the ground can place it, a censoring direction where it cannot.
 * A null of zero width is refused rather than allowed to clear anything put in
 * front of it (SEED #3) — which is the common case for a rare operator, and
 * saying so is the finding.
 */
const place = (observed, samples) => {
  if (!samples.length) return gap("empty_material", { reason: "no null draws survived" });
  const s = [...samples].sort((x, y) => x - y);
  const [lo, hi] = [s[0], s[s.length - 1]];
  const censoredAt = 1 / s.length;
  if (lo === hi)
    return gap("zero_width", { observed, support: [lo, hi], reason: "this operator never fired under any continuation the prior expects; the null cannot place anything" });
  if (observed > hi) return gap("exceeds_witness", { observed, support: [lo, hi], direction: "above", censoredAt, reZero: true });
  if (observed < lo) return gap("exceeds_witness", { observed, support: [lo, hi], direction: "below", censoredAt });
  return Object.freeze({ observed, support: Object.freeze([lo, hi]), rank: s.filter((v) => v >= observed).length / s.length });
};

// ── the record ──────────────────────────────────────────────────────────────

/**
 * Witness one arrival as a revision.
 *
 * The caller's graph is NEVER mutated. What comes back is the record; whether
 * to commit it is the caller's act, and a revision that failed its null is
 * exactly the one not to commit.
 *
 * `draws` is the resolution of testimony — the finest rank sayable is 1/draws —
 * and is declared, never defaulted. So is the seed: the engine holds no
 * randomness (III.2), it receives the stream that stands in for it.
 */
export const revise = (graph, triples, { draws, seed, alpha = 1 } = {}) => {
  if (!graph || !(graph.edges instanceof Map)) throw new TypeError("revise: a graph with an edge Map is required");
  if (!Array.isArray(triples)) throw new TypeError("revise: triples must be an array");
  if (!Number.isInteger(draws) || draws < 2)
    throw new TypeError("revise: draws is declared, never defaulted — it is the resolution of testimony");
  if (!Number.isInteger(seed))
    throw new TypeError("revise: seed is declared — the engine holds no randomness, it receives one");
  if (triples.length === 0) return gap("empty_material", { reason: "an arrival with no relations revises nothing" });

  const arrival = new Map();
  for (const t of triples) {
    const k = edgeKey(t);
    arrival.set(k, (arrival.get(k) ?? 0) + 1);
  }
  const arrivalTotal = triples.length;

  const prior = snapshot(graph);
  const posterior = applyTo(snapshot(graph), arrival);
  const observed = decompose(prior, posterior, { alpha });
  const counts = countsOf(observed);

  // The null: what would these operator counts be if the material simply
  // continued as the prior expects? Conditional on the reader's own belief,
  // generated per operator, never a global constant. A shuffle null is vacuous
  // here — it would preserve the multiset of arrivals and so preserve most of
  // the delta (SEED #4, and Amendment I: the pair, not the statistic).
  const formList = [...prior.edges.keys()];
  const nulls = Object.fromEntries(MEASURED.map((op) => [op, []]));
  let nullDraws = 0;

  if (formList.length > 0 && prior.edgeTotal > 0) {
    const cum = [];
    let acc = 0;
    for (const f of formList) { acc += prior.edges.get(f); cum.push(acc); }
    const next = rng(seed);

    for (let d = 0; d < draws; d++) {
      const synthetic = new Map();
      for (let k = 0; k < arrivalTotal; k++) {
        const r = next() * acc;
        let lo = 0, hi = cum.length - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
        const f = formList[lo];
        synthetic.set(f, (synthetic.get(f) ?? 0) + 1);
      }
      const c = countsOf(decompose(prior, applyTo(snapshot(graph), synthetic), { alpha }));
      for (const op of MEASURED) nulls[op].push(c[op]);
      nullDraws++;
    }
  }

  const vector = Object.fromEntries(
    MEASURED.map((op) => [
      op,
      nullDraws === 0
        ? gap("undeclared", { what: "null", why: "the prior holds no relations yet; a first arrival has nothing to revise" })
        : place(counts[op], nulls[op]),
    ]),
  );

  return Object.freeze({
    arrival: Object.freeze({ triples: arrivalTotal, distinct: arrival.size }),
    // Kept so `commit` can hand them to graph.js rather than reimplement its
    // advance. Measuring and believing must not drift apart.
    triples: Object.freeze([...triples]),
    operator_changes: observed,
    counts,
    vector,
    REC: observed.REC,

    // Breadth: how much of the structure the revision reached. Not a magnitude —
    // a magnitude says how far one thing moved, breadth says how many did.
    breadth: Object.freeze({
      nodesMoved: observed.SIG.nodes.length,
      nodesHeld: prior.nodes.size,
      edgesTouched: observed.INS.edges.length + observed.EVA.edges.length + observed.NUL.edges.length,
      edgesHeld: prior.edges.size,
    }),

    // Depth: the deepest domain any operator fired in. A coordinate, never a
    // score — a REC is not "more surprising" than an INS, it acts lower down.
    depth: deepestOf(counts),

    // Standpoint: the same SIG computation, read as "whose graph moved". An
    // event may be unsurprising globally and revolutionary from one referent's
    // standpoint, and averaging that away is refused (II.8, SEED #6).
    standpoints: Object.freeze(observed.SIG.nodes.map((n) => Object.freeze({ ...n }))),

    // Exclusion is part of the update. What the posterior refused is kept, with
    // the operator responsible and whether the refusal is final.
    refused: Object.freeze(observed.DEF.refused.map((r) => Object.freeze({ ...r, operator: "DEF" }))),

    // Owed, and named so it is not mistaken for done. Both need a replay this
    // organ does not have: durability compares the graph k arrivals later
    // against a counterfactual replay with this arrival withheld; productivity
    // asks whether the revised graph changed what the reader could then place.
    durability: gap("not_yet_measured", { needs: "counterfactual replay with the arrival withheld", horizon: "k" }),
    productivity: gap("not_yet_measured", { needs: "later arrivals placed against both the revised and the unrevised graph" }),

    nullDraws,
    committed: false,
  });
};

const DOMAIN_OF = Object.freeze({
  NUL: "Existence", SIG: "Existence", INS: "Existence",
  SEG: "Structure", CON: "Structure", SYN: "Structure",
  DEF: "Interpretation", EVA: "Interpretation", REC: "Interpretation",
});
const DEPTH_ORDER = Object.freeze(["Existence", "Structure", "Interpretation"]);

/** The deepest domain any operator fired in: existence → structure → interpretation. */
export const deepestOf = (counts) => {
  let deepest = null;
  for (const [op, n] of Object.entries(counts)) {
    if (!n) continue;
    const d = DOMAIN_OF[op];
    if (deepest === null || DEPTH_ORDER.indexOf(d) > DEPTH_ORDER.indexOf(deepest)) deepest = d;
  }
  return deepest;
};

/**
 * Commit a witnessed revision to the reader's actual belief. Separate from
 * `revise` on purpose: measuring and believing are two acts, and the whole
 * point of the copy is that the second one is refusable.
 *
 * The advance itself is graph.js's — delegated, never reimplemented, so the
 * belief the reader ends up holding is the one the record was measured against.
 */
export const commit = (graph, record, { alpha = 1 } = {}) => {
  if (record.committed) throw new TypeError("commit: this revision was already committed");
  const advanced = readTriples(graph, record.triples, { alpha });
  return Object.freeze({ ...record, committed: true, advanced });
};

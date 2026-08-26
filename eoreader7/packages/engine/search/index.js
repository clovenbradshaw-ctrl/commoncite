// eoreader6 · search — THE RELEVANCE GATE: preserve a result only if it moves
// the hypergraph as relevant against the contextual null.
//
// The old "search" here was a stub that returned empty results — a silent
// nothing. This organ is what it grew into, and it is the answer to the
// question that sent the whole lineage hunting: which web results earn a place
// in the reader, and which are noise wearing a query's clothes?
//
// The gate is a WITNESS, not a ranker. It never scores the arrival (the
// constitution's II.9 refuses that: a sound null does not rescue a mechanism
// that scores the arrival rather than measuring what it revised). It applies
// the candidate to a COPY of the reader's hypergraph and asks one question:
//
//   does this candidate move the graph BEYOND what the graph's own reseeding
//   variation produces?
//
// That null is SEED's pattern-null, exactly as stated: "a figure earns pattern
// by changing what happens next, and the only next available is the ground.
// Its null is the ground's own reseeding variation: same spec, same material,
// fresh seed." Here the ground is the reader's graph, and the reseeding
// variation is a degree-preserving tuple-rotate of the graph's own edges:
// each referent's participation is fixed (same subjects, same verbs, same
// object multiset per verb) while the specific pairings are destroyed by a
// seeded permutation. That is the perturbation the generative operators
// actually need — the one revision.js's continuation null is incapable of —
// and per SEED Amendment I it establishes its OWN sensitivity; it inherits no
// ground from revision.js's null family.
//
// THE GATE NEVER SEES THE QUERY (II.8). Relevance is not a property of a
// query string and not a property of the result alone; it is a property of the
// meeting between this material and this reader's ground (SEED Amendment IV:
// "a gift that looks apt and lowers no surprise is irrelevant"). The query's
// job is upstream — the host's lexical search nominates, the perceiver reads
// the candidate into triples, and THIS organ decides preservation. A cheap
// sense organ may nominate; it never decides.
//
// The verdicts, each a first-class result (SEED #8: a gap is a result):
//
//   preserve  the candidate introduces structure the ground's own reseeding
//             cannot produce: a being comes into existence (rotation can never
//             mint a node), a relation the ground cannot generate, a refusal
//             the ground cannot assert against itself, or a movement beyond
//             every reseeded support. The reader is meaningfully surprised.
//
//   refuse    the candidate's movement is within the ground's own reseeding
//             capacity — the reader's own structure, reseeded, produces the
//             same movement. It is redundant against the reader. Refuse gates
//             PRESERVATION (memory admission), never use: the span may still
//             be shown and cited; it just does not join the reader.
//
//   censored  magnitude reportable, place not. The movement is real but the
//             ground gave no support to place it against, and no preserve
//             condition was met. A distinct boundary, never collapsed into a
//             rank.
//
// The empty graph is the ZERO-WIDTH GROUND, and it has its own case: the first
// clause of a never-seen subject/object is measured against the empty graph
// being its own reseeding variation (SEED: "the only next available is the
// ground"). A being introduced against the nothing is the founding movement —
// it is preserved, and the record marks its INS magnitude as censored (there
// was no support to place it against).
//
// DECLARED NUMBERS. `reseeds` is the resolution of pattern (one of SEED's
// three); `seed` is the received stream standing in for randomness — the
// engine holds none (III.2). `gamma` is the graph's own, read from the graph,
// never re-declared. Type error before null: a missing declared number is not
// a measurement question.
//
// MODALITY-AGNOSTIC BY CONSTRUCTION, like the graph it reads: the candidate is
// an array of (subject, verb, object, polarity) triples and the gate never
// learns where they came from. A leitmotif in a symphony, an actor-action
// pair in a film, a voice-gesture in a song — same measurement. The perceiver
// is the only modality-specific part, and it lives downstream.

import { applyTo, snapshot, decompose, countsOf, parseEdge, MEASURED } from "../emergence/revision.js";
import { edgeKey } from "../emergence/graph.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// EVA · Network · Tracing — a witness at Pattern grain, sharing the cell with
// emergence/revision and using the OTHER null family (the ground's own
// reseeding variation, not the continuation the prior expects). Declared,
// checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Pattern" });

const gap = (type, detail = {}) => Object.freeze({ gap: type, ...detail });

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
 * Degree-preserving rewiring of a graph's own edges, as an arrival. Within
 * each verb group the objects are permuted by a seeded draw: every subject
 * keeps its verbs, every object keeps its participation count, and only the
 * specific pairings are destroyed. This is the perturbation whose null
 * revision.js says the generative operators actually need (a rewiring that CAN
 * produce structure the prior does not hold), so observing structure is not
 * automatically surfeit. A verb group of size one cannot vary — the gate
 * reports that honestly as zero-width rather than fabricating support.
 */
const rotateArrival = (edges, next) => {
  const byVerb = new Map();
  for (const [k, w] of edges) {
    const { v } = parseEdge(k);
    if (!byVerb.has(v)) byVerb.set(v, []);
    byVerb.get(v).push([k, w]);
  }
  const arrival = new Map();
  for (const [, list] of byVerb) {
    const n = list.length;
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    for (let i = 0; i < n; i++) {
      const [k, w] = list[i];
      const src = parseEdge(k);
      const tgt = parseEdge(list[idx[i]][0]);
      const nk = `${src.s}|${src.neg ? "!" : ""}${src.v}|${tgt.o}`;
      arrival.set(nk, (arrival.get(nk) ?? 0) + w);
    }
  }
  return arrival;
};

// UNLICENSED (Constitution II.10, commensurability): the ceiling below is
// the raw sample maximum over exactly `reseeds` reseed draws — an order
// statistic whose own expected value rises with `reseeds`, so a caller who
// declares FEWER (still validly >=2) reseeds gets a systematically lower
// ceiling and `exceed` clears more easily under pure noise. nul/index.js's
// `pattern()` measured and fixed the identical-SHAPED defect in its own
// reseeding null, but that fix (mean + 3*std) was calibrated by a
// false-positive sweep specific to ONE statistic/perturbation pair
// (moved_by displacement under the reseed-bootstrap null; see nul/index.js's
// `nullMax` comment, dated 2026-08-05). This gate's samples come from a
// different perturbation (rotateArrival's degree-preserving rewiring) over
// different statistics (the MEASURED per-operator counts). Transplanting
// that "3" here without an equivalent measurement was tried and reverted —
// it is a borrowed calibration, not an earned one, exactly the "null that
// differs in any other axis... fails invisibly and globally" failure II.10
// names. Left as the raw max/min pending a real false-positive sweep for
// THIS statistic/perturbation pair (II.10's "checked by type, not by hope").
const supportOf = (samples, observedCount) => {
  if (samples.length === 0) {
    // Nothing to draw against: the empty ground. The first clause of a
    // never-seen subject is measured against the empty graph being its own
    // reseeding variation, and any movement exceeds that nothing.
    return Object.freeze({
      observed: observedCount,
      support: Object.freeze([0, 0]),
      zero_width: true,
      exceed: observedCount > 0,
      within: false,
      placed: false,
    });
  }
  const lo = Math.min(...samples);
  const hi = Math.max(...samples);
  return Object.freeze({
    observed: observedCount,
    support: Object.freeze([lo, hi]),
    zero_width: lo === hi,
    exceed: observedCount > hi,
    within: observedCount > 0 && observedCount <= hi,
    placed: observedCount > 0 && observedCount <= hi && (lo < hi || lo === observedCount),
  });
};

/**
 * Judge whether a candidate result earns preservation.
 *
 * The caller's graph is NEVER mutated — the measurement lives on a copy, like
 * revision.js. What comes back is the record; whether to commit the candidate
 * into the reader is the caller's act, and the whole point of the gate is that
 * `refuse` is exactly the verdict not to commit.
 *
 * `reseeds` is the resolution of pattern (the finest placement sayable is
 * 1/reseeds), declared, never defaulted. So is `seed`.
 */
export const judge = (graph, candidate, { reseeds, seed, alpha = 1 } = {}) => {
  if (!graph || !(graph.edges instanceof Map))
    throw new TypeError("judge: a graph with an edge Map is required");
  if (!Array.isArray(candidate))
    throw new TypeError("judge: candidate must be an array of triples");
  if (!Number.isInteger(reseeds) || reseeds < 2)
    throw new TypeError("judge: reseeds is declared, never defaulted — it is the resolution of pattern");
  if (!Number.isInteger(seed))
    throw new TypeError("judge: seed is declared — the engine holds no randomness, it receives one");
  if (candidate.length === 0)
    return gap("empty_material", { reason: "a result with no relations moves nothing" });

  const arrival = new Map();
  for (const t of candidate) {
    const k = edgeKey(t);
    arrival.set(k, (arrival.get(k) ?? 0) + 1);
  }

  // The observed movement: the candidate applied to a copy, decomposed by the
  // same machinery that decomposes every revision.
  const prior = snapshot(graph);
  const observed = decompose(prior, applyTo(snapshot(graph), arrival), { alpha });
  const counts = countsOf(observed);

  // The contextual null: the ground's own reseeding variation. Same material
  // (the reader's own edges), fresh seed, tuple-rotate. An empty ground has
  // nothing to rotate — it is its own reseeding variation, and the null is the
  // nothing itself.
  const nulls = Object.fromEntries(MEASURED.map((op) => [op, []]));
  let nullReseeds = 0;
  const groundEmpty = graph.nodes.size === 0 && graph.edges.size === 0;
  if (!groundEmpty && graph.edges.size > 0) {
    const next = rng(seed);
    for (let d = 0; d < reseeds; d++) {
      const rotated = rotateArrival(graph.edges, next);
      const n = countsOf(decompose(prior, applyTo(snapshot(graph), rotated), { alpha }));
      for (const op of MEASURED) nulls[op].push(n[op]);
      nullReseeds++;
    }
  }

  const operators = Object.fromEntries(
    MEASURED.map((op) => [op, supportOf(nulls[op], counts[op])]),
  );

  // The verdict is a declared, task-relative collapse of the operator vector —
  // the same standing the vector's collapse to one number always has: the
  // caller's, declared. The vector itself is preserved in the record.
  const newNodes = observed.INS.nodes.length;
  const newEdges = observed.INS.edges.length;
  const insNullHi = nulls.INS.length ? Math.max(...nulls.INS) : 0;

  // ── ANCHORING: is a newly-minted identity corroborated, or a one-off? ──────
  //
  // INS's null is CORRECTLY zero-width for new nodes (revision.js: a rotation
  // of the ground's own edges can never mint a node it does not already hold),
  // so `newNodes > 0` clears that null trivially, by construction — the null
  // has nothing to say about WHETHER a new identity is real, only that
  // rotation cannot manufacture one. That is sound exactly when "new node"
  // means a referent — which the graph itself cannot check (graph.js: "the
  // graph does not resolve identity... that is coref's job, upstream"). If the
  // perceiver instead hands in an unvalidated span (relations.js captures an
  // object as everything up to the next punctuation mark, no coherence check),
  // a permutation of real prose can still match a real verb and mint a
  // brand-new subject/object string on every clause it touches — and INS's
  // zero-width null cannot see the difference, because a permutation is
  // invisible to a set-membership test.
  //
  // The one thing a permutation cannot fake at the graph-structure level:
  // genuine reference recurs. A being this passage actually introduces is
  // named again within it, or is connected to something the reader already
  // holds; a "being" manufactured by scrambled adjacency is a disposable
  // one-off — matched exactly once, in a triple whose other endpoint is also
  // never seen anywhere else. That is measurable directly off the arrival's
  // own edges, no text access required (the gate stays modality-agnostic —
  // this is a graph-shaped check, not a text-shaped one). A new node is
  // ANCHORED when it is touched by more than one of the candidate's own new
  // edges (recurs within the passage), or when one of those edges reaches an
  // endpoint the reader already held (connects to the ground).
  //
  // This does not apply against the EMPTY ground: the founding movement (SEED:
  // "the only next available is the ground") has nothing to recur against or
  // connect to, by construction — see the empty-ground branch below, and the
  // conformance test "a first clause of a never-seen subject against the
  // empty ground is preserved".
  const newNodeSet = new Set(observed.INS.nodes);
  const insDegree = new Map();
  const touchesKnown = new Set();
  for (const k of observed.INS.edges) {
    const { s, o } = parseEdge(k);
    insDegree.set(s, (insDegree.get(s) ?? 0) + 1);
    insDegree.set(o, (insDegree.get(o) ?? 0) + 1);
    if (newNodeSet.has(s) && !newNodeSet.has(o)) touchesKnown.add(s);
    if (newNodeSet.has(o) && !newNodeSet.has(s)) touchesKnown.add(o);
  }
  const anchoredNewNodes = observed.INS.nodes.filter(
    (id) => insDegree.get(id) > 1 || touchesKnown.has(id),
  );
  // Against the empty ground every node is founding by construction — there
  // is nothing yet to recur against or connect to, and the founding movement
  // is preserved outright (below). Elsewhere, only corroborated identity
  // founds; a one-off is reportable, not placeable (see the new `censored`
  // branch below).
  const newAnchored = groundEmpty ? newNodes : anchoredNewNodes.length;
  const OTHER_THAN_INS = MEASURED.filter((op) => op !== "INS");

  // `decisive` names exactly which of the 8 MEASURED operators drove the
  // branch taken — not for computation (the verdict above already stands on
  // its own), but so the record kept downstream can answer "which null did
  // this fail, at what threshold" without re-deriving it from `operators`.
  // Structured (an array of operator names), not just interpolated into
  // `what`'s prose, so an auditor need not parse a sentence to get it.
  let verdict;
  let what;
  let decisive;
  if (newAnchored > 0) {
    verdict = "preserve";
    what = "a being comes into existence — the ground cannot mint existence";
    decisive = ["INS"];
  } else if (newEdges > 0 && newEdges > insNullHi) {
    verdict = "preserve";
    what = "a relation the ground's own reseeding cannot produce";
    decisive = ["INS"];
  } else if (OTHER_THAN_INS.some((op) => operators[op].exceed)) {
    // INS is deliberately excluded here: its null is zero-width for new
    // nodes by construction (rotation cannot mint one), so `operators.INS.
    // exceed` is trivially true whenever ANY unanchored node arrived — that
    // is exactly the loophole above closes, and letting it back in through
    // this generic check would undo it. Every case where INS legitimately
    // drives preserve — a new edge between known nodes beyond the null, or
    // an anchored new node — is already caught above.
    decisive = OTHER_THAN_INS.filter((op) => operators[op].exceed);
    verdict = "preserve";
    what = `movement beyond the ground's own reseeding variation (${decisive.join(", ")})`;
  } else if (newNodes > 0) {
    // Reached only when nothing else preserved this candidate: every new
    // node it introduced is a one-off — it recurs nowhere within the
    // candidate and touches nothing the reader already holds. INS's null
    // cannot place it (zero-width, by construction) and the graph offers no
    // corroboration either. A magnitude arrived; nothing grounds it as a
    // referent rather than an artefact of an unvalidated span.
    verdict = "censored";
    what = "a new identity arrived but never recurs and touches nothing the ground already holds — magnitude reportable, corroboration not";
    decisive = ["INS"];
  } else if (MEASURED.some((op) => operators[op].within)) {
    decisive = MEASURED.filter((op) => operators[op].within);
    verdict = "refuse";
    what = `redundant against the reader — the ground's own reseeding reproduces the movement (${decisive.join(", ")})`;
  } else if (MEASURED.some((op) => operators[op].observed > 0)) {
    decisive = MEASURED.filter((op) => operators[op].observed > 0);
    verdict = "censored";
    what = `magnitude reportable, place not — the ground gave no support to place it against (${decisive.join(", ")})`;
  } else {
    verdict = "refuse";
    what = "nothing moved — the candidate restated what the reader already holds";
    decisive = [];
  }

  return Object.freeze({
    verdict,
    what,
    decisive: Object.freeze(decisive),
    ground: Object.freeze({
      empty: groundEmpty,
      nodes: graph.nodes.size,
      edges: graph.edges.size,
      rotation_capable: graph.edges.size > 0,
    }),
    candidate: Object.freeze({ triples: candidate.length, distinct: arrival.size }),
    // Raw INS magnitude (`counts.INS`) is unchanged and still fully honest —
    // this is a NEW channel alongside it, not a replacement: how much of the
    // new-node magnitude is corroborated (recurs within the candidate, or
    // touches a node the reader already held) versus a one-off the ground has
    // no way to place. See the anchoring computation above.
    anchoring: Object.freeze({
      newNodes,
      anchored: newAnchored,
      unanchored: newNodes - newAnchored,
      groundEmpty,
    }),
    counts,
    operator_changes: observed,
    operators,
    nullReseeds,
    reseeds,
    committed: false,
  });
};

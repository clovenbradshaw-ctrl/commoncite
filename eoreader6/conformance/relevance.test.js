// Conformance · search/relevance — THE RELEVANCE GATE.
//
// The suite exists to hold one line: a web result earns PRESERVATION only if
// it moves the reader's hypergraph beyond what the reader's own ground
// produces under reseeding. The load-bearing test is the one where two
// candidates are token-identical — any lexical coverage scorer ties them —
// and the gate still separates them, because the measurement is structural,
// never a surface.
//
// The gate never sees the query (II.8). The host's lexical search nominates;
// the perceiver reads the candidate into triples; this organ decides whether
// the candidate joins the reader.

import test from "node:test";
import assert from "node:assert/strict";

import { createGraph, readTriples } from "../packages/engine/emergence/graph.js";
import { judge, CELL } from "../packages/engine/search/index.js";
import { ORGANS } from "../packages/engine/operators.js";

const T = (subject, verb, object, polarity = "+") => ({ subject, verb, object, polarity });
const GAMMA = 0.95;
const PRUNE_BELOW = 1e-4;
const RESEEDS = 60;

/** A reader who has read a while and believes one relation strongly. */
const readerWhoBelievesCreatureHatesVictor = () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  for (let i = 0; i < 8; i++) readTriples(g, [T("creature", "hates", "victor")]);
  return g;
};

/** Two separate neighbourhoods, no bridge — the two-islands fixture. */
const readerWithTwoIslands = () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  for (let i = 0; i < 12; i++) {
    readTriples(g, [T("victor", "studies", "science"), T("victor", "leaves", "geneva"), T("elizabeth", "writes", "letters")]);
    readTriples(g, [T("creature", "roams", "mountains"), T("creature", "reads", "books")]);
  }
  return g;
};

/** A reader whose own edges can be rewired into new pairings. */
const readerWhoseGroundCanVary = () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  for (let i = 0; i < 8; i++) {
    readTriples(g, [
      T("a", "meets", "p1"), T("a", "meets", "p2"), T("b", "meets", "q1"), T("b", "meets", "q2"),
      T("a", "knows", "c"), T("c", "knows", "a"), T("b", "knows", "d"), T("d", "knows", "b"),
    ]);
  }
  return g;
};

test("the caller's belief is never mutated by judging — the copy is load-bearing", () => {
  const g = readerWithTwoIslands();
  const nodes = g.nodes.size, edges = g.edges.size, tick = g.tick, total = g.edgeTotal;

  judge(g, [T("victor", "creates", "creature")], { reseeds: RESEEDS, seed: 1 });

  assert.equal(g.tick, tick, "judging advanced the reader's clock");
  assert.equal(g.edgeTotal, total);
  assert.equal(g.nodes.size, nodes);
  assert.equal(g.edges.size, edges);
});

test("THE POINT: two token-identical candidates are told apart by what they move", () => {
  // "creature hates victor" and "creature does not hate victor" share every
  // token. A lexical coverage scorer ties them — the very shape of the
  // search.test.js "who is neil armstrong" regression. The gate refuses the
  // restatement (the reader's own reseeding reproduces it) and preserves the
  // refusal (the ground cannot assert a contradiction against itself).
  const g = readerWhoBelievesCreatureHatesVictor();

  const restatement = judge(g, [T("creature", "hates", "victor")], { reseeds: RESEEDS, seed: 2 });
  const refusal = judge(g, [T("creature", "hates", "victor", "-")], { reseeds: RESEEDS, seed: 2 });

  assert.equal(restatement.verdict, "refuse");
  assert.equal(restatement.operators.EVA.within, true, "restatement sits inside the ground's own reseeding");
  assert.equal(restatement.operators.EVA.support[1] > 0, true, "the reseeding restates the ground, so EVA has support");

  assert.equal(refusal.verdict, "preserve");
  assert.equal(refusal.counts.DEF, 1, "a contrary arrival refuses the believed relation");
  assert.equal(refusal.counts.INS, 1, "the contrary edge is new — the ground cannot mint it");
});

test("a first clause of a never-seen subject against the empty ground is preserved", () => {
  // The empty graph is the zero-width ground: its own reseeding variation is
  // the nothing. A being introduced against the nothing is the founding
  // movement (SEED: "the only next available is the ground").
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  const r = judge(g, [T("walton", "sails", "archangel")], { reseeds: RESEEDS, seed: 3 });

  assert.equal(r.verdict, "preserve");
  assert.equal(r.ground.empty, true);
  assert.equal(r.nullReseeds, 0, "an empty ground has nothing to rotate");
  assert.equal(r.counts.INS, 3, "two new referents plus their relation");
  // The magnitude is reportable; the place is not — there was no support to
  // rank it against. Censored is a distinct boundary, never a fabricated rank.
  assert.equal(r.operators.INS.zero_width, true);
  assert.equal(r.operators.INS.exceed, true, "movement against the nothing exceeds the nothing");
  assert.equal(typeof r.operators.INS.rank, "undefined", "no rank is fabricated for the zero-width ground");
});

test("a relation the ground's own reseeding can produce is refused, not preserved", () => {
  // This reader's edges rotate into new pairings freely (INS support reaches 8
  // per reseed). The candidate's new pairing "a meets q1" is one the reader's
  // own structure generates — introducing it is redundant against the reader.
  const g = readerWhoseGroundCanVary();
  const r = judge(g, [T("a", "meets", "q1")], { reseeds: RESEEDS, seed: 4 });

  assert.equal(r.nullReseeds, RESEEDS);
  assert.ok(r.operators.INS.support[1] > 0, "the reseeding null is live — it mints new pairings");
  assert.equal(r.operators.INS.within, true, "the candidate's new pairing sits within the null's draw");
  assert.equal(r.verdict, "refuse");
});

test("refuse gates preservation, never use — the record stays fully inspectable", () => {
  const g = readerWhoBelievesCreatureHatesVictor();
  const r = judge(g, [T("creature", "hates", "victor")], { reseeds: RESEEDS, seed: 5 });

  assert.equal(r.verdict, "refuse");
  // The host may still show and cite the span; it just must not be committed
  // into the reader. Every measurement is present for that decision.
  assert.equal(typeof r.counts.EVA, "number");
  assert.ok(r.operator_changes.INS && r.operator_changes.EVA, "the decomposed delta is on the record");
  assert.equal(r.committed, false);
});

test("a result that both restates and introduces is preserved on the introduced part", () => {
  // SEED #6 / II.8: plural grounds disagreeing is the finding — the movement
  // is never averaged away. The restatement is refused-in-place; the new
  // relation is preserved.
  const g = readerWhoBelievesCreatureHatesVictor();
  const r = judge(g, [T("creature", "hates", "victor"), T("victor", "creates", "creature")], { reseeds: RESEEDS, seed: 6 });

  assert.equal(r.verdict, "preserve");
  assert.equal(r.operators.EVA.within, true, "the restated part sits within the ground's capacity");
  assert.equal(r.operators.INS.exceed, true, "the introduced part exceeds it");
});

test("Amendment I: the (gate, tuple-rotate) pair is sensitive where it can vary, and says zero-width where it cannot", () => {
  // Sensitivity is a property of the (statistic, perturbation) PAIR. The
  // reseeding null inherits no ground from revision.js's continuation null;
  // it must show its own.
  const capable = judge(readerWhoseGroundCanVary(), [T("a", "meets", "q1")], { reseeds: RESEEDS, seed: 7 });
  assert.ok(capable.operators.INS.support[1] > 0, "rotation destroys pairings, so INS has real width");
  assert.ok(capable.operators.SYN.support[1] > 0, "rewiring merges components, so SYN has real width");

  // Vacuity control: a graph whose verb groups are all size one cannot vary
  // under rotation. Every support must be reported degenerate — honestly —
  // never widened into fake support. The one exception is EVA: the reseeding
  // restates all five held edges, so its degenerate support sits at [5,5].
  const still = judge(readerWithTwoIslands(), [T("victor", "creates", "creature")], { reseeds: RESEEDS, seed: 7 });
  assert.equal(still.nullReseeds, RESEEDS);
  for (const [op, o] of Object.entries(still.operators)) {
    assert.equal(o.zero_width, true, `${op}: a two-islands ground cannot reseed into variation`);
  }
  assert.deepEqual(still.operators.EVA.support, [5, 5], "identity rotation restates the five held edges");
  for (const op of ["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF"]) {
    assert.deepEqual(still.operators[op].support, [0, 0], `${op}: rotation produces nothing here`);
  }
  assert.equal(still.verdict, "preserve", "and the bridge against an unvarying ground is still a genuine encounter");
});

test("empty and candidate-less inputs are typed gaps, and declared numbers are never defaulted", () => {
  const g = readerWhoBelievesCreatureHatesVictor();
  const t = [T("a", "knows", "b")];

  assert.equal(judge(g, [], { reseeds: RESEEDS, seed: 8 }).gap, "empty_material");
  assert.throws(() => judge(g, t, { seed: 8 }), /reseeds is declared/);
  assert.throws(() => judge(g, t, { reseeds: 1, seed: 8 }), /reseeds is declared/);
  assert.throws(() => judge(g, t, { reseeds: RESEEDS }), /seed is declared/);
  assert.throws(() => judge(g, t, { reseeds: RESEEDS, seed: 1.5 }), /seed is declared/);
});

test("the measurement is deterministic in its declared seed", () => {
  const a = judge(readerWithTwoIslands(), [T("victor", "creates", "creature")], { reseeds: RESEEDS, seed: 42 });
  const b = judge(readerWithTwoIslands(), [T("victor", "creates", "creature")], { reseeds: RESEEDS, seed: 42 });
  assert.equal(a.verdict, b.verdict);
  assert.deepEqual(a.counts, b.counts);
  assert.deepEqual(a.operators, b.operators);
});

test("modality-agnostic: a leitmotif meets the same gate as a narrative clause", () => {
  // The same measurement, fed triples from an audio perceiver: a figure that
  // answers the ground is preserved, one that merely restates it is refused.
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  for (let i = 0; i < 8; i++) readTriples(g, [T("motif_a", "answers", "motif_b")]);

  const fresh = judge(g, [T("motif_a", "quotes", "motif_c")], { reseeds: RESEEDS, seed: 9 });
  const repeat = judge(g, [T("motif_a", "answers", "motif_b")], { reseeds: RESEEDS, seed: 9 });

  assert.equal(fresh.verdict, "preserve", "a new thematic relation is an encounter in any modality");
  assert.equal(repeat.verdict, "refuse", "a restated motif is redundancy in any modality");
});

test("the organ declares its cell and is wired into the roster — unwired is failing", () => {
  const entry = ORGANS.find((o) => o.id === "search/relevance");
  assert.ok(entry, "search/relevance is not in the organ roster");
  assert.equal(entry.op, CELL.op);
  assert.equal(entry.grain, CELL.grain);
  assert.equal(entry.module, "packages/engine/search/index.js");
  assert.equal(entry.fn, "judge");
});

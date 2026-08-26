// Conformance · emergence/revision — the constitution's II.9.
//
// The suite exists to hold one line: surprise is what the arrival CHANGED, not
// what the arrival LOOKED LIKE. The load-bearing test is the one where a rare
// arrival and a restructuring arrival are compared — the old measure cannot
// tell them apart, and this one must.

import test from "node:test";
import assert from "node:assert/strict";

import { createGraph, readTriples } from "../packages/engine/emergence/graph.js";
import { bayesianSurprise } from "../packages/engine/emergence/surprise.js";
import { revise, decompose, snapshot, countsOf, commit, CELL, MEASURED } from "../packages/engine/emergence/revision.js";
import { ORGANS } from "../packages/engine/operators.js";

const T = (subject, verb, object, polarity) => ({ subject, verb, object, polarity });
const GAMMA = 0.95;
const PRUNE_BELOW = 1e-4;
const DRAWS = 60;

/** A reader who has read a while: two separate neighbourhoods, no bridge. */
const readerWithTwoIslands = () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  for (let i = 0; i < 12; i++) {
    readTriples(g, [T("victor", "studies", "science"), T("victor", "leaves", "geneva"), T("elizabeth", "writes", "letters")]);
    readTriples(g, [T("creature", "roams", "mountains"), T("creature", "reads", "books")]);
  }
  return g;
};

test("the caller's belief is never mutated by measuring — the copy is load-bearing", () => {
  const g = readerWithTwoIslands();
  const edgesBefore = new Map(g.edges);
  const totalBefore = g.edgeTotal, tickBefore = g.tick, nodesBefore = g.nodes.size;

  revise(g, [T("victor", "creates", "creature")], { draws: DRAWS, seed: 1 });

  assert.equal(g.tick, tickBefore, "measuring advanced the reader's clock");
  assert.equal(g.edgeTotal, totalBefore);
  assert.equal(g.nodes.size, nodesBefore);
  assert.deepEqual([...g.edges].sort(), [...edgesBefore].sort(), "measuring changed the reader's belief");
});

test("a revision is not committed until it is committed, and then it is graph.js's advance", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  readTriples(g, [T("a", "knows", "b")]);
  const r = revise(g, [T("a", "knows", "c")], { draws: DRAWS, seed: 2 });
  assert.equal(r.committed, false);

  const tickBefore = g.tick;
  const done = commit(g, r);
  assert.equal(done.committed, true);
  assert.equal(g.tick, tickBefore + 1, "commit did not advance the real graph");
  assert.ok(g.edges.has("a|knows|c"), "the committed relation is not believed");
  assert.throws(() => commit(g, done), /already committed/);
});

test("THE POINT: a rare arrival and a restructuring arrival are told apart", () => {
  // Same reader, same size of arrival, two very different acts.
  const rare = readerWithTwoIslands();
  const bridge = readerWithTwoIslands();

  // (a) a relation between two brand-new referents: unusual material, but it
  //     reorganises nothing the reader already held.
  const rareTriples = [T("walton", "sails", "archangel")];
  // (b) a relation joining the two islands the reader has kept apart.
  const bridgeTriples = [T("victor", "creates", "creature")];

  const rRare = revise(rare, rareTriples, { draws: DRAWS, seed: 3 });
  const rBridge = revise(bridge, bridgeTriples, { draws: DRAWS, seed: 3 });

  // The OLD measure — how far the edge distribution moved — cannot separate
  // them. This is the assertion that motivates the whole organ.
  const klOf = (g, triples) => {
    const arrival = new Map();
    for (const t of triples) {
      const k = `${t.subject}|${t.verb}|${t.object}`;
      arrival.set(k, (arrival.get(k) ?? 0) + 1);
    }
    return bayesianSurprise(g.edges, g.edgeTotal, arrival, triples.length, { gamma: GAMMA });
  };
  const klRare = klOf(rare, rareTriples);
  const klBridge = klOf(bridge, bridgeTriples);
  assert.ok(Math.abs(klRare - klBridge) < 0.05, `the old lanes should be near-identical here, got ${klRare} vs ${klBridge}`);

  // The NEW measure separates them on the operator that actually differs.
  assert.equal(rRare.counts.SYN, 0, "a relation among new referents merged nothing the reader held");
  assert.equal(rBridge.counts.SYN, 1, "joining two kept-apart neighbourhoods is one merge");
  assert.equal(rBridge.counts.CON, 1, "victor and creature became adjacent");
  assert.equal(rRare.counts.CON, 0);

  // ...and the rare one is the one that introduces existence.
  assert.ok(rRare.counts.INS >= 2, "two new referents plus their relation is INS");
});

test("the vector is a vector — no scalar is produced, and every operator is placed or censored", () => {
  const g = readerWithTwoIslands();
  const r = revise(g, [T("victor", "creates", "creature")], { draws: DRAWS, seed: 4 });

  assert.deepEqual(Object.keys(r.vector).sort(), [...MEASURED].sort());
  assert.equal(typeof r.vector, "object");
  assert.ok(!("surprise" in r), "a single surprise number must not be produced by default");
  assert.ok(!("score" in r), "a single score must not be produced by default");

  for (const op of MEASURED) {
    const v = r.vector[op];
    const placed = typeof v.rank === "number";
    const censored = typeof v.gap === "string";
    assert.ok(placed || censored, `${op} is neither placed nor censored`);
    if (placed) assert.ok(v.rank > 0 && v.rank <= 1, `${op} rank out of range: ${v.rank}`);
  }
});

test("REC is a typed gap naming its organ, never a number guessed from an edge diff", () => {
  const g = readerWithTwoIslands();
  const r = revise(g, [T("victor", "creates", "creature")], { draws: DRAWS, seed: 5 });
  assert.equal(r.REC.gap, "wrong_grain");
  assert.match(r.REC.organ, /tiers\.js/);
  assert.equal(r.counts.REC, undefined, "REC must not carry a count");
  assert.ok(!MEASURED.includes("REC"));
});

test("durability and productivity are owed, and say so rather than defaulting to zero", () => {
  const g = readerWithTwoIslands();
  const r = revise(g, [T("victor", "creates", "creature")], { draws: DRAWS, seed: 6 });
  assert.equal(r.durability.gap, "not_yet_measured");
  assert.equal(r.productivity.gap, "not_yet_measured");
  assert.match(r.durability.needs, /counterfactual/);
});

test("DEF: a contrary arrival refuses a believed relation, and the refusal is retained", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  for (let i = 0; i < 8; i++) readTriples(g, [T("creature", "hates", "victor")]);

  const r = revise(g, [T("creature", "hates", "victor", "-")], { draws: DRAWS, seed: 7 });
  assert.equal(r.counts.DEF, 1, "the contrary of a believed relation is a refusal");
  assert.equal(r.refused.length, 1);
  assert.equal(r.refused[0].operator, "DEF");
  assert.equal(r.refused[0].refuses, "creature|hates|victor");
  assert.equal(r.refused[0].finality, "provisional", "the prior edge survives, so the refusal is provisional");
  assert.ok(r.refused[0].priorWeight > 0, "the refused alternative keeps the weight it had — it is evidence, not nothing");
});

test("a long-standing contradiction is not re-filed as fresh news every turn", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  for (let i = 0; i < 6; i++) readTriples(g, [T("creature", "hates", "victor"), T("creature", "hates", "victor", "-")]);

  // Both polarities are believed. An unrelated arrival must report no refusal.
  const r = revise(g, [T("walton", "sails", "north")], { draws: DRAWS, seed: 8 });
  assert.equal(r.counts.DEF, 0, "an arrival that asserted neither polarity refused nothing");
});

test("SIG is standpoint-indexed: whose graph moved, not how much the corpus moved", () => {
  const g = readerWithTwoIslands();
  const r = revise(g, [T("victor", "creates", "creature")], { draws: DRAWS, seed: 9 });

  assert.ok(r.standpoints.length > 0, "somebody's significance moved");
  const movers = new Set(r.standpoints.map((s) => s.node));
  assert.ok(movers.has("victor"), "victor's incident structure changed");

  // The disagreement between standpoints is the finding, so it must be visible
  // rather than averaged: elizabeth is untouched by this arrival.
  assert.ok(!movers.has("elizabeth"), "an uninvolved referent's standpoint must not move");
  assert.ok(r.standpoints.every((s) => s.moved > 0));
  // Sorted, so a caller reading the head gets the most-moved standpoint.
  for (let i = 1; i < r.standpoints.length; i++)
    assert.ok(r.standpoints[i - 1].moved >= r.standpoints[i].moved, "standpoints are not ordered by how far they moved");
});

test("SEG and SYN are read from connectivity, and cannot both fire", () => {
  const g = readerWithTwoIslands();
  const r = revise(g, [T("victor", "creates", "creature")], { draws: DRAWS, seed: 10 });
  assert.equal(r.operator_changes.SYN.componentsBefore - r.operator_changes.SYN.componentsAfter, 1);
  assert.ok(r.counts.SYN === 0 || r.counts.SEG === 0, "one delta cannot be both a merge and a split");
});

test("depth is a coordinate, not a score — the deepest domain any operator fired in", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  for (let i = 0; i < 8; i++) readTriples(g, [T("creature", "hates", "victor")]);

  const refusal = revise(g, [T("creature", "hates", "victor", "-")], { draws: DRAWS, seed: 11 });
  assert.equal(refusal.depth, "Interpretation", "a refusal acts in the interpretation domain");

  const g2 = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  readTriples(g2, [T("a", "knows", "b")]);
  const plain = revise(g2, [T("c", "knows", "d")], { draws: DRAWS, seed: 12 });
  assert.equal(plain.depth, "Existence", "bringing new referents into being acts in the existence domain");
});

test("breadth counts how many moved, against how many were held", () => {
  const g = readerWithTwoIslands();
  const r = revise(g, [T("victor", "creates", "creature")], { draws: DRAWS, seed: 13 });
  assert.ok(r.breadth.nodesHeld > 0);
  assert.ok(r.breadth.nodesMoved <= r.breadth.nodesHeld);
  assert.ok(r.breadth.edgesTouched > 0);
  assert.ok(r.breadth.edgesHeld > 0);
});

test("the null is conditional on the reader's own belief, and its width is reported honestly", () => {
  const g = readerWithTwoIslands();
  const r = revise(g, [T("victor", "creates", "creature")], { draws: DRAWS, seed: 14 });
  assert.equal(r.nullDraws, DRAWS);

  // A null of zero width is refused rather than allowed to clear anything put
  // in front of it (SEED #3). For an operator that never fires under a
  // continuation the prior expects, that refusal IS the reported result.
  const zeroWidth = MEASURED.filter((op) => r.vector[op].gap === "zero_width");
  for (const op of zeroWidth) assert.match(r.vector[op].reason, /never fired|cannot place/);
});

test("MEASURED DEAD END: the continuation null cannot place the generative operators", () => {
  // A continuation drawn from the prior's own edges can only restate edges the
  // prior already holds. It can never mint one, never make two nodes adjacent,
  // never merge two components, never assert a contrary polarity. So for those
  // operators the null is identically zero and has zero width.
  //
  // SEED #3: a null of zero width would clear anything put in front of it. This
  // test pins the refusal so nobody later "fixes" it by widening the support or
  // falling back to a global constant. The fix is a different perturbation
  // (degree-preserving rewiring), not a friendlier threshold.
  const g = readerWithTwoIslands();
  const r = revise(g, [T("victor", "creates", "creature")], { draws: DRAWS, seed: 17 });

  assert.equal(r.counts.SYN, 1, "the merge did happen — the count is true");
  assert.equal(r.vector.SYN.gap, "zero_width", "and it must NOT be ranked against an incapable null");
  assert.deepEqual(r.vector.SYN.support, [0, 0]);
  assert.equal(r.vector.CON.gap, "zero_width");
  assert.equal(r.vector.INS.gap, "zero_width");

  // The restatement-sensitive operators DO get a real ground, which is why the
  // null is kept rather than discarded.
  const withWidth = ["NUL", "EVA", "SIG"].filter((op) => r.vector[op].gap !== "zero_width");
  assert.ok(withWidth.length > 0, "the continuation null must retain width where restatement can move the prior");
});

test("a first arrival has nothing to revise, and says so instead of scoring", () => {
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  const r = revise(g, [T("a", "knows", "b")], { draws: DRAWS, seed: 15 });
  assert.equal(r.nullDraws, 0);
  for (const op of MEASURED) assert.equal(r.vector[op].gap, "undeclared");
});

test("draws and seed are declared, never defaulted — type error before null", () => {
  const g = readerWithTwoIslands();
  const t = [T("victor", "creates", "creature")];
  assert.throws(() => revise(g, t, { seed: 0 }), /draws is declared/);
  assert.throws(() => revise(g, t, { draws: 1, seed: 0 }), /draws is declared/);
  assert.throws(() => revise(g, t, { draws: DRAWS }), /seed is declared/);
  assert.throws(() => revise(g, t, { draws: DRAWS, seed: 1.5 }), /seed is declared/);
  assert.equal(revise(g, [], { draws: DRAWS, seed: 0 }).gap, "empty_material");
});

test("the measurement is deterministic in its declared seed", () => {
  const a = revise(readerWithTwoIslands(), [T("victor", "creates", "creature")], { draws: DRAWS, seed: 42 });
  const b = revise(readerWithTwoIslands(), [T("victor", "creates", "creature")], { draws: DRAWS, seed: 42 });
  assert.deepEqual(a.counts, b.counts);
  assert.deepEqual(a.vector, b.vector);
});

test("modality-agnostic: nothing here reads a word, a sentence, or a surface", () => {
  // The same call with actor-action-target from a video perceiver, or
  // voice-gesture-voice from an audio one, is the same measurement.
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  for (let i = 0; i < 10; i++) {
    readTriples(g, [T("motif_a", "answers", "motif_b")]);
    readTriples(g, [T("motif_c", "inverts", "motif_d")]);
  }
  const r = revise(g, [T("motif_a", "quotes", "motif_c")], { draws: DRAWS, seed: 16 });
  assert.equal(r.counts.SYN, 1, "a leitmotif bridging two thematic groups is the same merge as a narrative one");
  assert.equal(r.depth, "Structure");
});

test("decompose is inspectable on its own, over two graphs the caller built", () => {
  const g = readerWithTwoIslands();
  const prior = snapshot(g);
  readTriples(g, [T("victor", "creates", "creature")]);
  const posterior = snapshot(g);
  const d = decompose(prior, posterior);
  const c = countsOf(d);
  assert.equal(c.SYN, 1);
  assert.equal(c.CON, 1);
  assert.deepEqual(Object.keys(c).sort(), [...MEASURED].sort());
});

test("the organ declares its cell and is wired into the roster — unwired is failing", () => {
  const entry = ORGANS.find((o) => o.id === "emergence/revision");
  assert.ok(entry, "emergence/revision is not in the organ roster");
  assert.equal(entry.op, CELL.op);
  assert.equal(entry.grain, CELL.grain);
  assert.equal(entry.module, "packages/engine/emergence/revision.js");
});

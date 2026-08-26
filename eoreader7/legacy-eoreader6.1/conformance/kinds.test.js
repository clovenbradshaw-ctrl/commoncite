// eoreader6 · conformance/kinds — kinds induced from relation-term records,
// with a discovered holonic height and an EO-compliant operator chain.
//
// Fixture models what the clause-reading harness on Emma (Vol 1) earns:
//   family block   anchor_shared        sister, brother, daughter, father, mother, wife, husband
//                  anchor_shared + stem sister-in-law (composition: spouse ∘ sibling)
//   love block     subject_shared       in-love-with, violent-love, pretended-love,
//                                       falling-in-love, love-at-first-sight, not-in-love
//   lone term      —                    friend
//
// The blocks are sized comparably on purpose: a perfect 3-member block inside a
// 64%-family population is statistically indistinguishable from a random draw
// (a random triple is all-family a quarter of the time), so the existence gate
// would — correctly — refuse it. The organ must not fabricate a kind the null
// can reproduce. The conjunct/stem facts ride on the records but drop out at
// the declared prevalence bar; the correlative claim (sister/brother peers) is
// measured by pairHeight, not stored anywhere.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isGap } from "../nul/index.js";
import {
  induceKinds,
  buildVocabulary,
  pairHeight,
  partitionNull,
  deriveCohesionThreshold,
  parameterProfiles,
  conSimilarity,
} from "../packages/engine/emergence/kinds.js";
import {
  OPERATORS,
  OPERATOR_ORDER,
  operatorOf,
  validateChain,
  isCurrentOperator,
} from "../packages/engine/operators.js";

const A = (field_id, count = 1) => ({ field_id, value_type: "boolean", count });

const TERMS = [
  { id: "term:sister", label: "sister", attributes: [A("anchor_shared", 3)] },
  { id: "term:brother", label: "brother", attributes: [A("anchor_shared", 2)] },
  { id: "term:daughter", label: "daughter", attributes: [A("anchor_shared")] },
  { id: "term:father", label: "father", attributes: [A("anchor_shared")] },
  { id: "term:mother", label: "mother", attributes: [A("anchor_shared")] },
  { id: "term:wife", label: "wife", attributes: [A("anchor_shared")] },
  { id: "term:husband", label: "husband", attributes: [A("anchor_shared")] },
  { id: "term:sister-in-law", label: "sister-in-law", attributes: [A("anchor_shared"), A("stem_shared")] },
  { id: "term:in-love-with", label: "in-love-with", attributes: [A("subject_shared", 2)] },
  { id: "term:violent-love", label: "violent-love", attributes: [A("subject_shared")] },
  { id: "term:pretended-love", label: "pretended-love", attributes: [A("subject_shared")] },
  { id: "term:falling-in-love", label: "falling-in-love", attributes: [A("subject_shared")] },
  { id: "term:love-at-first-sight", label: "love-at-first-sight", attributes: [A("subject_shared")] },
  { id: "term:not-in-love", label: "not-in-love", attributes: [A("subject_shared")] },
  { id: "term:friend", label: "friend", attributes: [] },
];

const OPTS = { population: "emma-v1-relations", minPrevalence: 0.25, minKindSize: 3, permutations: 200, quantile: 0.95, reseeds: 24, seed: 42 };

test("operators: the 9 codes are the closed 3x3", () => {
  assert.equal(Object.keys(OPERATORS).length, 9);
  assert.equal(operatorOf("NUL").mode, "Differentiate");
  assert.equal(operatorOf("NUL").domain, "Existence");
  assert.equal(operatorOf("REC").mode, "Generate");
  assert.equal(operatorOf("REC").domain, "Interpretation");
  assert.deepEqual(OPERATOR_ORDER, ["NUL", "SEG", "SIG", "CON", "EVA", "DEF", "INS", "SYN", "REC"]);
  assert.ok(OPERATOR_ORDER.every(isCurrentOperator));
  assert.ok(isGap(operatorOf("ALT")) || operatorOf("ALT").gap === "unknown_spec", "ALT is legacy, not current");
  assert.equal(operatorOf("ALT").gap, "unknown_spec");
  assert.throws(() => validateChain(["CON", "SIG"]), /dependency order/);
  assert.doesNotThrow(() => validateChain(["SIG", "CON", "EVA"]));
});

test("family and love cohere into kinds; friend is not admitted", () => {
  const kinds = induceKinds(TERMS, OPTS);
  assert.equal(kinds.length, 2);
  const family = kinds.find((k) => k.label === "anchor_shared");
  const love = kinds.find((k) => k.label === "subject_shared");
  assert.ok(family && love);
  assert.equal(family.members.length, 8);
  assert.equal(love.members.length, 6);
  const allMembers = kinds.flatMap((k) => k.members);
  assert.ok(!allMembers.includes("term:friend"), "friend stays out of both kinds");
  assert.ok(family.members.includes("term:sister") && family.members.includes("term:brother"));
  assert.ok(family.members.includes("term:sister-in-law"));
});

test("a kind earns above its members through both Born gates", () => {
  const kinds = induceKinds(TERMS, OPTS);
  const family = kinds.find((k) => k.label === "anchor_shared");
  assert.equal(family.height, "above");
  assert.equal(family.heightGate.existence.passed, true);
  assert.equal(family.heightGate.constraint.passed, true);
  assert.equal(family.cohesion, 1);
});

test("every kind carries an EO-compliant, dependency-ordered operator chain", () => {
  const kinds = induceKinds(TERMS, OPTS);
  for (const kind of kinds) {
    assert.deepEqual(kind.operator_chain.chain, ["SIG", "CON", "EVA", "DEF", "INS", "SYN"]);
    assert.equal(kind.operator_chain.operator_epoch, "eo-2026-07");
    assert.equal(kind.operator_chain.stages.length, 6);
    for (const stage of kind.operator_chain.stages) {
      assert.ok(isCurrentOperator(stage.operator));
      assert.ok(typeof stage.target === "string" && stage.target.length > 0);
      assert.ok(stage.height === null || stage.height === 0 || stage.height === "above" || stage.height === "below" || stage.height === "peer" || stage.height === "unstable");
    }
    assert.equal(kind.operator_chain.stages[2].operator, "EVA");
    assert.equal(kind.operator_chain.stages[2].target, `kind:${kind.label}`);
    assert.equal(kind.operator_chain.stages[2].height, kind.height);
  }
});

test("sister and brother are peers; composition is above; friend is the peer null", () => {
  const sister = TERMS.find((t) => t.id === "term:sister");
  const brother = TERMS.find((t) => t.id === "term:brother");
  const sil = TERMS.find((t) => t.id === "term:sister-in-law");
  const friend = TERMS.find((t) => t.id === "term:friend");
  assert.equal(pairHeight(sister, brother).relation, "peer");
  assert.equal(pairHeight(sil, sister).relation, "above", "sister-in-law composes sister: it constrains");
  assert.equal(pairHeight(friend, sister).relation, "peer", "no overlap — peer is the null result");
});

test("induction is deterministic under a declared seed", () => {
  const a = induceKinds(TERMS, OPTS);
  const b = induceKinds(TERMS, OPTS);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("uniform records refuse induction (degenerate null is a gap)", () => {
  const uniform = Array.from({ length: 5 }, (_, i) => ({ id: `u${i}`, attributes: [A("anchor_shared")] }));
  const kinds = induceKinds(uniform, OPTS);
  assert.deepEqual(kinds, []);
});

test("degenerate nulls are gaps, not numbers", () => {
  const result = partitionNull({ samples: [5, 5, 5, 5], observed: 6, quantile: 0.95, seed: 1 });
  assert.ok(isGap(result));
  assert.equal(result.gap, "degenerate_ground");
});

test("deriveCohesionThreshold: count <= 2 is a typed gap, never the old silent 0.25", () => {
  const r1 = deriveCohesionThreshold({ sim: new Map(), count: 0, permutations: 200, quantile: 0.95, seed: 1 });
  const r2 = deriveCohesionThreshold({ sim: new Map(), count: 1, permutations: 200, quantile: 0.95, seed: 1 });
  const r3 = deriveCohesionThreshold({ sim: new Map(), count: 2, permutations: 200, quantile: 0.95, seed: 1 });
  for (const r of [r1, r2, r3]) {
    assert.ok(isGap(r));
    assert.equal(r.gap, "degenerate_ground");
    assert.notEqual(r, 0.25);
  }
});

test("deriveCohesionThreshold: count === 3 runs the real permutation null, not the old count < 4 fallback", () => {
  // Three profiles with genuinely different pairwise Jaccard similarity
  // (2/3, 1/5, 2/5) — non-degenerate on purpose, so the permutation loop
  // below actually samples a mix rather than one repeated value.
  const params = [{ field_id: "p" }, { field_id: "q" }, { field_id: "r" }, { field_id: "s" }, { field_id: "t" }];
  const records = [
    { id: "A", attributes: [{ field_id: "p" }, { field_id: "q" }] },
    { id: "B", attributes: [{ field_id: "p" }, { field_id: "q" }, { field_id: "r" }] },
    { id: "C", attributes: [{ field_id: "q" }, { field_id: "r" }, { field_id: "s" }, { field_id: "t" }] },
  ];
  const { profiles } = parameterProfiles(records, params);
  const { sim } = conSimilarity(profiles);
  const threshold = deriveCohesionThreshold({ sim, count: 3, permutations: 200, quantile: 0.95, seed: 7 });
  assert.equal(typeof threshold, "number");
  // The point is that this is a REAL derived number from this material's own
  // similarity structure, not the retired hand-picked 0.25 — not that it
  // equals any particular value.
  assert.notEqual(threshold, 0.25);
});

test("induceKinds: a population too small for a non-degenerate cohesion null returns no kinds, not a crash", () => {
  const tiny = [
    { id: "a", attributes: [A("x")] },
    { id: "b", attributes: [A("x")] },
  ];
  const kinds = induceKinds(tiny, { ...OPTS, minKindSize: 2 });
  assert.deepEqual(kinds, []);
});

test("buildVocabulary synthesizes the kinds and their members", () => {
  const kinds = induceKinds(TERMS, OPTS);
  const vocab = buildVocabulary(kinds, { population: OPTS.population });
  assert.equal(vocab.population, "emma-v1-relations");
  assert.deepEqual([...vocab.kinds].sort(), ["anchor_shared", "subject_shared"]);
  assert.equal(vocab.members.length, 14);
  assert.equal(new Set(vocab.members.map((m) => m.member)).size, 14);
});

test("declared options are never defaulted", () => {
  assert.throws(() => induceKinds(TERMS, { population: "x" }), /declared, never defaulted/);
});

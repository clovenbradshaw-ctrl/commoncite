import test from "node:test";
import assert from "node:assert/strict";

import {
  hyperedge,
  buildHypergraph,
  relevantHypergraphNeighborhood,
  receivedGround,
  applyObservation,
  applyDelta,
  deltaFold,
  obligation,
  openObligation,
  expectation,
  expectationTransition,
  relevantNeighborhood,
  discoverPatternCandidates,
  discoverMotifCandidates,
  deriveGraphStructuralDelta,
  deriveTension,
} from "../packages/engine/index.js";

test("n-ary hyperedges are first-class and traversable by participant", () => {
  const create = hyperedge({
    id: "edge:create:1",
    relation: "create",
    participants: [
      { role: "agent", ref: "ref:victor" },
      { role: "generated", ref: "ref:creature" },
    ],
    witness: "obs:create:1",
  });
  const graph = buildHypergraph([create]);
  const hood = relevantHypergraphNeighborhood(graph, ["ref:creature"]);
  assert.deepEqual(hood.ids, ["edge:create:1"]);
});

test("relations can ground obligations and later EO transformations", () => {
  const create = hyperedge({
    id: "edge:create:1",
    relation: "create",
    participants: [
      { role: "agent", ref: "ref:victor" },
      { role: "generated", ref: "ref:creature" },
    ],
    witness: "obs:create:1",
  });
  const obs = {
    schema: "Observation@1",
    id: "obs:create:1",
    witness: "animation",
    anchor: { start: 0, end: 9 },
    distinctions: [{ ref: "ref:creature" }],
    provenance: {},
    hyperedges: [create],
  };
  let fold = applyObservation(receivedGround(), obs);
  const creatorDuty = obligation({
    id: "obligation:creator-care",
    distinction: "what obligations follow from generation?",
    grounds: ["edge:create:1"],
    consequences: ["ref:creature"],
  });
  fold = applyDelta(fold, deltaFold([openObligation(creatorDuty, { witness: "obs:create:1" })], { id: "delta:open-duty" }));
  const graph = buildHypergraph(fold.graphEntries);
  const hood = relevantHypergraphNeighborhood(graph, ["ref:creature"]);
  assert.ok(hood.ids.includes("edge:create:1"));
  assert.ok(hood.ids.includes("obligation:creator-care"));
  assert.ok(fold.transformationObjects.some((op) => op.outputs.includes("obligation:creator-care")));
});

test("expectation evaluation remains linked to the expectation object", () => {
  const e = expectation({ id: "expectation:sympathy", hypothesis: "recognition is possible", giver: "experience", grounds: ["edge:observe:de-lacey"] });
  const op = expectationTransition(e, "violated", { witness: "obs:rejection" });
  assert.equal(op.operator, "EVA");
  assert.deepEqual(op.inputs, ["expectation:sympathy"]);
  assert.deepEqual(op.outputs, ["expectation:sympathy"]);
});

test("Fold relevant neighborhood uses graph structure without lexical overlap", () => {
  const edge = hyperedge({
    id: "edge:create:1",
    relation: "create",
    participants: [
      { role: "agent", ref: "ref:victor" },
      { role: "generated", ref: "ref:creature" },
    ],
    witness: "obs:create:1",
  });
  const duty = obligation({ id: "obligation:creator-care", distinction: "duty", grounds: ["edge:create:1"], consequences: ["ref:creature"] });
  const fold = receivedGround({ graphEntries: [edge, duty], obligations: [duty] });
  const observations = [{ schema: "Observation@1", id: "obs:new", distinctions: [{ ref: "ref:creature" }] }];
  const hood = relevantNeighborhood(fold, observations);
  assert.ok(hood.graph.ids.includes("edge:create:1"));
  assert.ok(hood.graph.ids.includes("obligation:creator-care"));
});

test("Observation nesting does not create whole-graph dependency shortcuts", () => {
  const nested = {
    schema: "Observation@1",
    id: "obs:local",
    distinctions: [],
    hyperedges: [{ schema: "EOHyperedge@1", id: "edge:nested", relation: "x", participants: [{ ref: "surface:far" }] }],
    graphEntries: [{ schema: "EOLexicalOccurrence@1", id: "lex:nested", surfaceKey: "surface:far", encounterRef: "encounter:1" }],
  };
  const local = { schema: "EOLexicalOccurrence@1", id: "lex:local", surfaceKey: "surface:near", encounterRef: "encounter:1" };
  const far = { schema: "EOLexicalOccurrence@1", id: "lex:far", surfaceKey: "surface:far", encounterRef: "encounter:99" };
  const graph = buildHypergraph([nested, local, far]);
  const hood = relevantHypergraphNeighborhood(graph, ["surface:near"], { maxHops: 2 });
  assert.ok(hood.ids.includes("lex:local"));
  assert.equal(hood.ids.includes("lex:far"), false);
});

test("ambiguous graph participant opens an explicit identity obligation", () => {
  const edge = hyperedge({
    id: "edge:ambiguous:1",
    relation: "saw",
    participants: [
      { role: "subject", ref: "occ:1:0:subject", standing: "unresolved_surface", candidateReferents: ["ref:a", "ref:b"] },
      { role: "object", ref: "ref:c", standing: "referent" },
    ],
    witness: "text:1:2",
  });
  const obs = { schema: "Observation@1", id: "obs:1", distinctions: [], hyperedges: [edge] };
  const delta = deriveGraphStructuralDelta(receivedGround(), [obs], { id: "delta:1" });
  const op = delta.operations.find((item) => item.payload?.action === "obligation");
  assert.ok(op);
  assert.equal(op.operator, "DEF");
  assert.deepEqual(op.payload.value.alternatives, ["ref:a", "ref:b"]);
});

test("persistent unresolved relation surface opens a Fold obligation without asserting coreference", () => {
  const edges = [1, 2, 3].map((n) => hyperedge({
    id: `edge:i:${n}`,
    relation: "saw",
    participants: [
      { role: "subject", ref: `occ:${n}:subject`, standing: "unresolved_surface", surfaceKey: "surface:i", surface: "I" },
      { role: "object", ref: `occ:${n}:object`, standing: "unresolved_surface", surfaceKey: `surface:o${n}` },
    ],
    witness: `text:${n}`,
  }));
  const fold = receivedGround({ graphEntries: edges.slice(0, 2) });
  const obs = { schema: "Observation@1", id: "obs:3", distinctions: [], hyperedges: [edges[2]] };
  const delta = deriveGraphStructuralDelta(fold, [obs], { id: "delta:3", minUnresolvedRecurrence: 3, minPatternInstances: 99, minMotifInstances: 99 });
  const def = delta.operations.find((op) => op.operator === "DEF" && op.payload?.value?.id === "obligation:unresolved:surface:i");
  assert.ok(def);
  assert.equal(def.payload.value.alternatives.length, 0);
  assert.equal(def.payload.value.grounds.length, 3);
});

test("witnessed repeated relation structure becomes a stable SYN pattern", () => {
  const edges = [1, 2, 3].map((n) => hyperedge({
    id: `edge:saw:${n}`,
    relation: "saw",
    participants: [
      { role: "subject", ref: `occ:${n}:s`, standing: "unresolved_surface" },
      { role: "object", ref: `occ:${n}:o`, standing: "unresolved_surface" },
    ],
    witness: `obs:${n}`,
  }));
  const patterns = discoverPatternCandidates(edges, { minInstances: 3 });
  assert.equal(patterns.length, 1);
  const fold = receivedGround({ graphEntries: edges.slice(0, 2) });
  const obs = { schema: "Observation@1", id: "obs:3", distinctions: [], hyperedges: [edges[2]] };
  const delta = deriveGraphStructuralDelta(fold, [obs], { id: "delta:3", minPatternInstances: 3, minMotifInstances: 99 });
  const syn = delta.operations.find((op) => op.operator === "SYN");
  assert.ok(syn);
  assert.equal(syn.grain, "Pattern");
  assert.equal(syn.payload.value.id, patterns[0].id);
  assert.equal(syn.payload.value.support, 3);
});

test("connected relation pairs recur as motifs rather than mere verb counts", () => {
  const edges = [
    hyperedge({ id: "e1", relation: "seek", participants: [{ role: "subject", ref: "ref:a", standing: "referent" }], scope: { sequencePosition: 1 }, meta: { encounterRef: "encounter:1" }, witness: "w1" }),
    hyperedge({ id: "e2", relation: "leave", participants: [{ role: "subject", ref: "ref:a", standing: "referent" }], scope: { sequencePosition: 2 }, meta: { encounterRef: "encounter:2" }, witness: "w2" }),
    hyperedge({ id: "e3", relation: "seek", participants: [{ role: "subject", ref: "ref:b", standing: "referent" }], scope: { sequencePosition: 10 }, meta: { encounterRef: "encounter:10" }, witness: "w3" }),
    hyperedge({ id: "e4", relation: "leave", participants: [{ role: "subject", ref: "ref:b", standing: "referent" }], scope: { sequencePosition: 11 }, meta: { encounterRef: "encounter:11" }, witness: "w4" }),
  ];
  const motifs = discoverMotifCandidates(edges, { minInstances: 2, maxSequenceGap: 2 });
  const motif = motifs.find((item) => item.relations[0] === "seek" && item.relations[1] === "leave");
  assert.ok(motif);
  assert.equal(motif.connection, "shared_referent");
  assert.equal(motif.support, 2);
  const fold = receivedGround({ graphEntries: edges.slice(0, 3) });
  const obs = { schema: "Observation@1", id: "obs:4", distinctions: [], hyperedges: [edges[3]] };
  const delta = deriveGraphStructuralDelta(fold, [obs], { minPatternInstances: 99, minMotifInstances: 2, maxMotifSequenceGap: 2 });
  assert.ok(delta.operations.some((op) => op.operator === "SYN" && op.payload?.value?.schema === "EOMotifCandidate@1"));
});

test("tension persistence is derived from sequence rather than silent mutation", () => {
  const duty = obligation({ id: "obligation:persist", distinction: "unresolved", openedAt: 2, persistence: 0 });
  const fold = receivedGround({ sequence: 7, obligations: [duty] });
  const tension = deriveTension(fold);
  assert.equal(tension.persistence[0].value, 6);
  assert.equal(fold.obligations[0].persistence, 0);
});

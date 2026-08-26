import test from "node:test";
import assert from "node:assert/strict";
import {
  createRecursiveReader, createCausalTextPerceiver, textEncounters,
  buildHypergraph, relevantHypergraphNeighborhood, deltaFold,
} from "../packages/engine/index.js";

test("real text perceiver carries witnessed hyperedges into Fold graph", async () => {
  const text = [
    "Today Alice greeted Bob.",
    "Later Carol greeted Alice.",
    "Again Alice greeted Carol.",
    "Then Bob greeted Alice.",
    "Soon Carol greeted Bob.",
    "Finally Alice greeted Bob.",
  ].join(" ");
  const reader = createRecursiveReader({
    perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 1, refreshEvery: 1 })],
    adapters: { retrieve: () => ({}), interrogate: async () => [], revise: async () => deltaFold([]) },
  });
  const out = await reader.read(textEncounters(text, { source: "fixture" }));
  const graph = buildHypergraph(out.fold.graphEntries);
  const edges = graph.entries.filter((entry) => entry.schema === "EOHyperedge@1");
  assert.ok(edges.length > 0, "expected relation hyperedges from real text");
  assert.ok(out.fold.witnessed.some((obs) => (obs.hyperedges ?? []).length > 0), "witness must preserve hyperedges");
});

test("graph-native neighborhood reaches relations through participant identity", () => {
  const entries = [
    { schema: "EOReferent@1", id: "ref:alice", surfaces: ["Alice"] },
    { schema: "EOHyperedge@1", id: "edge:1", relation: "greets", participants: [{ role: "subject", ref: "ref:alice" }, { role: "object", ref: "occ:1:0:object", surfaceKey: "surface:traveler" }] },
    { schema: "EOObligation@1", id: "obligation:1", distinction: "response owed", grounds: ["edge:1"], alternatives: [], consequences: [], status: "open" },
  ];
  const graph = buildHypergraph(entries);
  const hood = relevantHypergraphNeighborhood(graph, ["ref:alice"], { maxHops: 3 });
  assert.ok(hood.ids.includes("edge:1"));
  assert.ok(hood.ids.includes("obligation:1"));
});

test("same unresolved surface is searchable without asserting same identity", () => {
  const entries = [
    { schema: "EOHyperedge@1", id: "edge:m1", relation: "appeared", participants: [{ role: "subject", ref: "occ:10:0:subject", surfaceKey: "surface:monster", standing: "unresolved_surface", surface: "monster" }] },
    { schema: "EOHyperedge@1", id: "edge:m2", relation: "departed", participants: [{ role: "subject", ref: "occ:20:0:subject", surfaceKey: "surface:monster", standing: "unresolved_surface", surface: "monster" }] },
  ];
  const graph = buildHypergraph(entries);
  assert.notEqual(entries[0].participants[0].ref, entries[1].participants[0].ref);
  assert.equal(entries[0].participants[0].surfaceKey, entries[1].participants[0].surfaceKey);
  const hood = relevantHypergraphNeighborhood(graph, ["surface:monster"], { maxHops: 1 });
  assert.ok(hood.ids.includes("edge:m1"));
  assert.ok(hood.ids.includes("edge:m2"));
});

test("lexical occurrence can retrieve encounter context without coreference", () => {
  const entries = [
    { schema: "EOLexicalOccurrence@1", id: "lex:7:0", surfaceKey: "surface:creature", surface: "creature", encounterRef: "encounter:7" },
    { schema: "EOMention@1", id: "mention:7:victor", referent: "ref:victor", encounterRef: "encounter:7" },
    { schema: "EOHyperedge@1", id: "edge:7", relation: "fled", participants: [{ role: "subject", ref: "occ:7:0:subject", surfaceKey: "surface:he" }], meta: { encounterRef: "encounter:7" } },
  ];
  const graph = buildHypergraph(entries);
  const hood = relevantHypergraphNeighborhood(graph, ["surface:creature"], { maxHops: 3 });
  assert.ok(hood.ids.includes("lex:7:0"));
  assert.ok(hood.ids.includes("mention:7:victor"));
  assert.ok(hood.ids.includes("edge:7"));
});

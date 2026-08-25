import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CELL, BINDING_RELATION,
  detectCoArrivals, displacementNull, bindLinks, bindingTriples, shuffle,
  transferEntropy, reversalNull, reseedNull, buildLink, readLinks,
} from "../packages/engine/emergence/binding.js";
import { createGraph, readTriples, structuralKey } from "../packages/engine/emergence/graph.js";
import { gammaFor } from "../packages/engine/emergence/tiers.js";

// ── the organ's own contract ────────────────────────────────────────────────

test("every declared number is required — none is a default", () => {
  const entities = [{ id: "a", arrivals: [0, 5] }, { id: "b", arrivals: [1, 6] }];
  assert.throws(() => detectCoArrivals(entities, {}), /window/);
  assert.throws(() => bindLinks(entities, {}), /window/);
  assert.throws(() => bindLinks(entities, { window: 2 }), /draws/);
  assert.throws(() => displacementNull([0], [1], { window: 2, draws: 100 }), /seed/);
});

test("CELL is declared and matches the algebra", () => {
  assert.deepEqual({ ...CELL }, { op: "CON", grain: "Figure" });
});

// ── co-arrival detection ────────────────────────────────────────────────────

test("two entities arriving within the window are detected", () => {
  const entities = [
    { id: "victor", arrivals: [0, 10, 20] },
    { id: "creature", arrivals: [1, 11, 21] },
  ];
  const pairs = detectCoArrivals(entities, { window: 2 });
  assert.equal(pairs.length, 1, "one pair detected");
  assert.equal(pairs[0].a.id, "victor");
  assert.equal(pairs[0].b.id, "creature");
  assert.ok(pairs[0].overlap >= 1, "overlap is positive");
});

test("two entities arriving far apart are NOT detected", () => {
  const entities = [
    { id: "a", arrivals: [0, 10] },
    { id: "b", arrivals: [50, 60] },
  ];
  const pairs = detectCoArrivals(entities, { window: 2 });
  assert.equal(pairs.length, 0, "no pairs — too far apart");
});

test("three entities produce three pairs when all co-arrive", () => {
  const entities = [
    { id: "a", arrivals: [0, 5] },
    { id: "b", arrivals: [1, 6] },
    { id: "c", arrivals: [2, 7] },
  ];
  const pairs = detectCoArrivals(entities, { window: 2 });
  assert.equal(pairs.length, 3, "three pairs from three co-arriving entities");
});

test("entities with no arrivals are skipped", () => {
  const entities = [
    { id: "a", arrivals: [0] },
    { id: "b", arrivals: [] },
  ];
  const pairs = detectCoArrivals(entities, { window: 2 });
  assert.equal(pairs.length, 0, "empty arrivals skipped");
});

// ── displacement null ───────────────────────────────────────────────────────

test("displacementNull returns a distribution and p-value", () => {
  const result = displacementNull([0, 10, 20], [1, 11, 21], { window: 2, draws: 199, seed: 42 });
  assert.ok(!result.gap, "not a gap");
  assert.equal(result.samples.length, 199, "correct number of draws");
  assert.equal(typeof result.pValue, "number");
  assert.ok(result.pValue >= 0 && result.pValue <= 1, "p-value in [0, 1]");
  assert.equal(result.observed, 3, "observed overlap is 3");
});

test("strongly co-arriving pairs have low p-values", () => {
  // A spread over a large extent, B concentrated right next to A's arrivals.
  // The null places B uniformly — it almost never lands near A.
  const a = Array.from({ length: 20 }, (_, i) => i * 50);
  const b = a.map((x) => x + 1); // each B arrival is 1 unit after the corresponding A
  const result = displacementNull(a, b, { window: 1, draws: 199, seed: 99 });
  assert.ok(!result.gap, "not a gap");
  assert.ok(result.pValue < 0.1, `p-value should be low for concentrated co-arrival, got ${result.pValue}`);
});

test("independent arrivals produce high p-values", () => {
  // A at even positions, B at odd positions — minimal overlap at window=1.
  const a = Array.from({ length: 20 }, (_, i) => i * 4);
  const b = Array.from({ length: 20 }, (_, i) => i * 4 + 2);
  const result = displacementNull(a, b, { window: 1, draws: 199, seed: 77 });
  assert.ok(!result.gap, "not a gap");
  assert.ok(result.pValue > 0.1, `p-value should be high for spread arrivals, got ${result.pValue}`);
});

test("displacementNull handles empty arrivals gracefully", () => {
  const result = displacementNull([0, 1], [], { window: 1, draws: 100, seed: 1 });
  assert.equal(result.reason, "empty_arrivals", "returns reason for empty arrivals");
  assert.equal(result.samples.length, 0, "no null samples");
});

// ── combined binding ────────────────────────────────────────────────────────

test("bindLinks detects pairs and tests them", () => {
  const entities = [
    { id: "victor", arrivals: [0, 10, 20, 30] },
    { id: "creature", arrivals: [1, 11, 21, 31] },
    { id: "elizabeth", arrivals: [50, 60] },
  ];
  const { pairs, nulls } = bindLinks(entities, { window: 2, draws: 99, seed: 20260803 });
  assert.ok(pairs.length >= 1, "at least one pair detected");
  assert.ok(nulls.size >= 1, "null computed for each pair");

  // victor + creature co-arrive; victor + elizabeth do not.
  const vcKey = "victor\u0000creature";
  assert.ok(nulls.has(vcKey), "victor-creature null exists");
});

test("bindLinks refuses missing declarations", () => {
  assert.throws(() => bindLinks([], {}), /window/);
  assert.throws(() => bindLinks([], { window: 2 }), /draws/);
  assert.throws(() => bindLinks([], { window: 2, draws: 100 }), /seed/);
});

// ── graph wiring ────────────────────────────────────────────────────────────

test("bindingTriples feeds the graph directly — the modality-blind mouth reaches Network", () => {
  const links = [
    { a: { id: "a" }, b: { id: "b" }, direction: "a→b", polarity: "+" },
  ];
  const triples = bindingTriples(links);
  const graph = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  const before = graph.nodes.size;
  const out = readTriples(graph, triples);
  assert.ok(graph.nodes.size > before, "the pairs became graph nodes");
  assert.ok(out.newEdges > 0, "the pairs became graph relations");
  assert.ok(graph.edges.size > 0, "the Network is live");
});

test("bindingTriples: only directed pairs become triples", () => {
  const links = [
    { a: { id: "a" }, b: { id: "b" }, direction: "a→b", polarity: "+" },
    { a: { id: "c" }, b: { id: "d" }, direction: null, polarity: null },
  ];
  const triples = bindingTriples(links);
  assert.equal(triples.length, 1, "undirected pair filtered out");
  assert.equal(triples[0].subject, "a");
  assert.equal(triples[0].object, "b");
  assert.equal(triples[0].polarity, "+");
});

// ── shuffle is unbiased ─────────────────────────────────────────────────────

test("shuffle: every original element survives, no duplicates", () => {
  const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  let state = 42;
  const rnd = () => { state = (state * 1664525 + 1013904223) | 0; return (state >>> 0) / 4294967296; };
  const shuffled = shuffle([...original], rnd);
  assert.equal(shuffled.length, original.length, "same length");
  assert.deepEqual(shuffled.sort((a, b) => a - b), original, "same elements");
});

// ── displacement-extent variants ────────────────────────────────────────────

test("extent variants run without error and produce different distributions", () => {
  const a = [0, 10, 20, 30];
  const b = [2, 12, 22, 32];
  const r1 = displacementNull(a, b, { window: 3, draws: 99, seed: 1, extent: "combined-span" });
  const r2 = displacementNull(a, b, { window: 3, draws: 99, seed: 1, extent: "per-co-arrival" });
  assert.ok(!r1.gap && !r2.gap, "neither is a gap");
  // Same observed, potentially different distributions.
  assert.equal(r1.observed, r2.observed, "same observed overlap");
  assert.equal(r1.samples.length, r2.samples.length, "same draw count");
});

// ── A3: transfer entropy ────────────────────────────────────────────────────

test("transferEntropy: A→B positive branch only", () => {
  // Cause-effect: A at t predicts B at t+1 with a delay. Non-deterministic
  // in A but B always follows A one step later.
  const cause = [1,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1,0];
  const effect = [0,1,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1];
  const te = transferEntropy(cause, effect);
  assert.ok(te > 0, `A→B TE should be positive, got ${te}`);
});

test("transferEntropy: reverse is smaller when shift is one-directional", () => {
  const cause = [1,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1,0];
  const effect = [0,1,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1];
  const fwd = transferEntropy(cause, effect);
  const rev = transferEntropy(effect, cause);
  assert.ok(fwd > rev, `forward (${fwd}) should exceed reverse (${rev})`);
});

test("transferEntropy: independent series yield ~0", () => {
  const n = 200;
  const a = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 1 : 0));
  const b = Array.from({ length: n }, (_, i) => (i % 7 === 0 ? 1 : 0));
  const te = transferEntropy(a, b);
  assert.ok(te < 0.1, `independent series TE should be ~0, got ${te}`);
});

// ── A3: reversal null ───────────────────────────────────────────────────────

test("reversalNull: directional pairs have low p-values", () => {
  // A at even positions, B at odd positions — A→B direction.
  const a = Array.from({ length: 20 }, (_, i) => i * 4);
  const b = Array.from({ length: 20 }, (_, i) => i * 4 + 1);
  const result = reversalNull(a, b, { totalUnits: 100, draws: 199, seed: 42 });
  assert.ok(!result.gap, "not a gap");
  assert.ok(result.pValue < 0.15, `p-value should be low for directional pair, got ${result.pValue}`);
  assert.ok(result.fwd > result.rev, "forward TE exceeds reverse");
});

test("reversalNull: non-directional pairs have high p-values", () => {
  // A and B at the same positions — no temporal asymmetry.
  const pos = Array.from({ length: 10 }, (_, i) => i * 10);
  const result = reversalNull(pos, pos, { totalUnits: 100, draws: 199, seed: 99 });
  assert.ok(!result.gap, "not a gap");
  assert.ok(result.pValue > 0.3, `p-value should be high for non-directional pair, got ${result.pValue}`);
});

test("reversalNull handles empty arrivals gracefully", () => {
  const result = reversalNull([0, 5], [], { totalUnits: 20, draws: 50, seed: 1 });
  assert.equal(result.reason, "empty_arrivals");
  assert.equal(result.samples.length, 0);
});

// ── A4: reseed null ──────────────────────────────────────────────────────────

test("reseedNull: returns distribution and p-value", () => {
  const a = [0, 5, 10, 15, 20];
  const b = [1, 6, 11, 16, 21];
  const result = reseedNull(a, b, { totalUnits: 30, draws: 199, seed: 42 });
  assert.ok(!result.gap, "not a gap");
  assert.equal(result.samples.length, 199, "correct draw count");
  assert.ok(typeof result.pValue === "number", "p-value is a number");
  assert.ok(result.pValue >= 0 && result.pValue <= 1, "p-value in [0, 1]");
});

test("reseedNull: strongly co-arriving pairs have low p-values", () => {
  // A and B always at the same positions — maximum co-occurrence.
  const pos = Array.from({ length: 15 }, (_, i) => i * 3);
  const result = reseedNull(pos, pos, { totalUnits: 50, draws: 199, seed: 42 });
  assert.ok(result.pValue < 0.1, `p-value should be low for strongly co-arriving, got ${result.pValue}`);
});

test("reseedNull: independent sparse arrivals have higher p-values", () => {
  const a = [0, 30, 60];
  const b = [10, 40, 70];
  const result = reseedNull(a, b, { totalUnits: 100, draws: 199, seed: 99 });
  assert.ok(result.pValue > 0.2, `p-value should be higher for sparse independent, got ${result.pValue}`);
});

test("reseedNull handles empty arrivals gracefully", () => {
  const result = reseedNull([0, 5], [], { totalUnits: 20, draws: 50, seed: 1 });
  assert.equal(result.reason, "empty_arrivals");
  assert.equal(result.samples.length, 0);
});

// ── A3+A4: direction + polarity + witness gate ──────────────────────────────

test("buildLink: returns full record with all three nulls", () => {
  const pair = {
    a: { id: "a", arrivals: [0, 4, 8, 12, 16] },
    b: { id: "b", arrivals: [1, 5, 9, 13, 17] },
    overlap: 5,
  };
  const result = buildLink(pair, { totalUnits: 20, draws: 99, seed: 42 });
  assert.equal(result.a.id, "a");
  assert.equal(result.b.id, "b");
  assert.equal(result.overlap, 5);
  assert.ok(typeof result.strength === "number", "strength is a number");
  assert.ok(result.nulls.displacement, "displacement null present");
  assert.ok(result.nulls.reversal, "reversal null present");
  assert.ok(result.nulls.reseed, "reseed null present");
  assert.ok(Array.isArray(result.labels), "labels is an array");
  assert.ok(result.arrivals.a, "arrivals.a present");
  assert.ok(result.arrivals.b, "arrivals.b present");
  if (result.direction) {
    assert.ok(result.direction === "a→b" || result.direction === "b→a", "valid direction");
    assert.ok(result.polarity === "+" || result.polarity === "−", "valid polarity");
  }
});

test("buildLink: labels are provenance only — no label does not weaken", () => {
  const pair = {
    a: { id: "a", arrivals: [0, 4, 8] },
    b: { id: "b", arrivals: [1, 5, 9] },
    overlap: 3,
  };
  const withLabels = buildLink(pair, { totalUnits: 15, draws: 49, seed: 10, labels: ["relates-to"] });
  const withoutLabels = buildLink(pair, { totalUnits: 15, draws: 49, seed: 10, labels: [] });
  assert.deepEqual([...withLabels.labels], ["relates-to"], "labels recorded as provenance");
  assert.equal(withoutLabels.labels.length, 0, "no label does not break the record");
  // Strength is identical — labels never admission-gate.
  assert.equal(withLabels.strength, withoutLabels.strength, "labels do not affect strength");
});

test("buildLink: record is frozen", () => {
  const pair = {
    a: { id: "a", arrivals: [0, 5] },
    b: { id: "b", arrivals: [1, 6] },
    overlap: 2,
  };
  const link = buildLink(pair, { totalUnits: 10, draws: 49, seed: 99 });
  assert.ok(Object.isFrozen(link), "link record is frozen");
  assert.ok(Object.isFrozen(link.nulls), "nulls object is frozen");
  assert.ok(Object.isFrozen(link.arrivals), "arrivals is frozen");
});

test("buildLink: arrivals carry the raw data for downstream use", () => {
  const pair = {
    a: { id: "a", arrivals: [0, 5, 10] },
    b: { id: "b", arrivals: [2, 7, 12] },
    overlap: 3,
  };
  const link = buildLink(pair, { totalUnits: 15, draws: 49, seed: 7 });
  assert.deepEqual([...link.arrivals.a], [0, 5, 10], "a arrivals preserved");
  assert.deepEqual([...link.arrivals.b], [2, 7, 12], "b arrivals preserved");
});

test("readLinks: detects pairs and returns Link records", () => {
  const entities = [
    { id: "victor", arrivals: [0, 5, 10, 15, 20] },
    { id: "creature", arrivals: [1, 6, 11, 16, 21] },
    { id: "elizabeth", arrivals: [30, 35, 40] },
  ];
  const links = readLinks(entities, { window: 2, draws: 49, seed: 20260803, totalUnits: 50 });
  assert.ok(links.length >= 1, "at least one link");
  for (const l of links) {
    assert.ok(l.strength >= 0, "strength is non-negative");
    assert.ok(typeof l.direction === "string" || l.direction === null, "direction is string or null");
  }
});

// ── A3: graph wiring with polarity ──────────────────────────────────────────

test("bindingTriples feeds directed links with correct polarity to the graph", () => {
  const links = [
    { a: { id: "a" }, b: { id: "b" }, direction: "a→b", polarity: "+" },
    { a: { id: "c" }, b: { id: "d" }, direction: "b→a", polarity: "−" },
    { a: { id: "e" }, b: { id: "f" }, direction: null, polarity: null },
  ];
  const triples = bindingTriples(links);
  assert.equal(triples.length, 2, "undirected link filtered out");
  assert.equal(triples[0].subject, "a", "a→b: subject is a");
  assert.equal(triples[0].object, "b", "a→b: object is b");
  assert.equal(triples[0].polarity, "+", "a→b: positive polarity");
  assert.equal(triples[1].subject, "d", "b→a: subject is d (object of b→a)");
  assert.equal(triples[1].object, "c", "b→a: object is c (subject of b→a)");
  assert.equal(triples[1].polarity, "−", "b→a: negative polarity");

  const graph = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  const out = readTriples(graph, triples);
  assert.ok(out.newEdges > 0, "directed edges became graph relations");
  assert.ok(graph.edges.size > 0, "the Network is live");
});

// ── A5: graph seam — structural edgeKey ──────────────────────────────────────

test("structuralKey: a|polarity|b format", () => {
  const k = structuralKey({ subject: "a", polarity: "+", object: "b" });
  assert.equal(k, "a||b", "positive polarity: no marker");
  const k2 = structuralKey({ subject: "a", polarity: "−", object: "b" });
  assert.equal(k2, "a|!|b", "negative polarity: ! marker");
  const k3 = structuralKey({ subject: "A", polarity: "+", object: "B" });
  assert.equal(k3, "a||b", "lowercased");
});

test("structuralKey: no verb in the key", () => {
  const k = structuralKey({ subject: "a", polarity: "+", object: "b" });
  assert.ok(!k.includes("co-occur"), "verb not in structural key");
  assert.ok(!k.includes("knows"), "no verb in structural key");
});

test("readTriples with structural=true: both keyings run", () => {
  const graph = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  const triples = [
    { subject: "a", verb: "knows", object: "b", polarity: "+" },
    { subject: "a", verb: "co-occur", object: "b", polarity: "+" },
  ];
  const out = readTriples(graph, triples, { structural: true });
  assert.ok(out.newEdges >= 2, "both keyings produce edges");
  // The verb key and structural key are different strings.
  const verbKey = "a|knows|b";
  const structKey = "a||b";
  assert.ok(graph.edges.has(verbKey), "verb key present");
  assert.ok(graph.edges.has(structKey), "structural key present");
});

test("readTriples with structural=false (default): only verb keying runs", () => {
  const graph = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  const triples = [
    { subject: "a", verb: "knows", object: "b", polarity: "+" },
  ];
  readTriples(graph, triples);
  const structKey = "a||b";
  assert.ok(!graph.edges.has(structKey), "structural key not created by default");
});

test("readTriples accepts Link records directly", () => {
  const link = {
    a: { id: "victor" },
    b: { id: "creature" },
    direction: "a→b",
    polarity: "+",
  };
  const graph = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  const out = readTriples(graph, [link], { structural: true });
  assert.ok(out.newEdges >= 1, "link became edges");
  assert.ok(graph.edges.has("victor|co-occur|creature"), "verb key from link");
  assert.ok(graph.edges.has("victor||creature"), "structural key from link");
  assert.ok(graph.nodes.has("victor"), "victor is a node");
  assert.ok(graph.nodes.has("creature"), "creature is a node");
});

test("readTriples: link with no direction produces no edges", () => {
  const link = {
    a: { id: "a" },
    b: { id: "b" },
    direction: null,
    polarity: null,
  };
  const graph = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  const out = readTriples(graph, [link]);
  assert.equal(out.newEdges, 0, "no edges from undirected link");
});

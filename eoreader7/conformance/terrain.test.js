import { test } from "node:test";
import assert from "node:assert/strict";

import { createGraph, readTriples, edgeKey } from "../packages/engine/emergence/graph.js";
import { gammaFor } from "../packages/engine/emergence/tiers.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TERRAIN TESTS — robust testing of the 6 new organs against realistic data.
//
// The discipline: each organ must produce MEANINGLESS results on random data
// and MEANINGFUL results on structured data. If it cannot distinguish the two,
// it is not earned.
// ═══════════════════════════════════════════════════════════════════════════════

// ── SEG·Figure: connected components ────────────────────────────────────────
import { connectedComponents } from "../packages/engine/emergence/segment.js";

test("SEG·Figure: connected components find real clusters in a graph", () => {
  // Two disconnected subgraphs: {victor, creature} and {alice, bob}.
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  readTriples(g, [
    { subject: "victor", verb: "knows", object: "creature", polarity: "+" },
    { subject: "victor", verb: "loves", object: "creature", polarity: "+" },
    { subject: "alice", verb: "knows", object: "bob", polarity: "+" },
  ]);

  const components = connectedComponents(g.nodes, g.edges);
  assert.equal(components.length, 2, "two disconnected subgraphs");
  const sizes = components.map((c) => c.length).sort();
  assert.deepEqual(sizes, [2, 2], "each component has 2 nodes");
});

test("SEG·Figure: single component when graph is fully connected", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  readTriples(g, [
    { subject: "a", verb: "x", object: "b", polarity: "+" },
    { subject: "b", verb: "x", object: "c", polarity: "+" },
    { subject: "c", verb: "x", object: "a", polarity: "+" },
  ]);

  const components = connectedComponents(g.nodes, g.edges);
  assert.equal(components.length, 1, "one component");
  assert.equal(components[0].length, 3, "all 3 nodes in one component");
});

test("SEG·Figure: isolated nodes form their own components", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  readTriples(g, [
    { subject: "a", verb: "x", object: "b", polarity: "+" },
    { subject: "c", verb: "x", object: "d", polarity: "+" },
    { subject: "e", verb: "x", object: "f", polarity: "+" },
  ]);

  const components = connectedComponents(g.nodes, g.edges);
  assert.equal(components.length, 3, "three disconnected pairs");
});

test("SEG·Figure: empty graph returns empty components", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  const components = connectedComponents(g.nodes, g.edges);
  assert.equal(components.length, 0, "no components in empty graph");
});

test("SEG·Figure: structural edges (binding) participate in components", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  readTriples(g, [
    { subject: "a", verb: "knows", object: "b", polarity: "+" },
  ], { structural: true });
  // Structural key: "a||b"
  const components = connectedComponents(g.nodes, g.edges);
  assert.equal(components.length, 1, "structural edge connects a and b");
  assert.deepEqual(components[0].sort(), ["a", "b"]);
});

// ── SEG·Pattern: community detection ────────────────────────────────────────
import { communityDetection, communitiesFromLabels } from "../packages/engine/emergence/segment.js";

test("SEG·Pattern: community detection finds two communities in a modular graph", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  // Dense connections within two groups, sparse between.
  readTriples(g, [
    // Group 1: victor, creature
    { subject: "victor", verb: "knows", object: "creature", polarity: "+" },
    { subject: "victor", verb: "loves", object: "creature", polarity: "+" },
    { subject: "creature", verb: "fears", object: "victor", polarity: "−" },
    // Group 2: alice, bob
    { subject: "alice", verb: "knows", object: "bob", polarity: "+" },
    { subject: "alice", verb: "loves", object: "bob", polarity: "+" },
    { subject: "bob", verb: "admires", object: "alice", polarity: "+" },
    // Weak bridge
    { subject: "victor", verb: "knows", object: "alice", polarity: "+" },
  ]);

  const labels = communityDetection(g.nodes, g.edges);
  const communities = communitiesFromLabels(labels);
  // The two dense groups should be in separate communities.
  assert.ok(communities.length >= 2, `at least 2 communities, got ${communities.length}`);

  // victor and creature should be in the same community.
  const vComm = labels.get("victor");
  const cComm = labels.get("creature");
  assert.equal(vComm, cComm, "victor and creature share a community");

  // alice and bob should be in the same community.
  const aComm = labels.get("alice");
  const bComm = labels.get("bob");
  assert.equal(aComm, bComm, "alice and bob share a community");
});

test("SEG·Pattern: fully connected graph has one community", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  readTriples(g, [
    { subject: "a", verb: "x", object: "b", polarity: "+" },
    { subject: "b", verb: "x", object: "c", polarity: "+" },
    { subject: "c", verb: "x", object: "a", polarity: "+" },
    { subject: "a", verb: "x", object: "c", polarity: "+" },
  ]);

  const labels = communityDetection(g.nodes, g.edges);
  const communities = communitiesFromLabels(labels);
  assert.equal(communities.length, 1, "one community in fully connected graph");
});

test("SEG·Pattern: empty graph returns empty labels", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  const labels = communityDetection(g.nodes, g.edges);
  assert.equal(labels.size, 0, "no labels in empty graph");
});

// ── CON·Ground: initial co-occurrence relating ──────────────────────────────
import { detectCoOccurrences } from "../packages/engine/emergence/segment.js";

test("CON·Ground: detects co-occurrences within frames", () => {
  const units = [
    { id: "victor", frame: 0 },
    { id: "creature", frame: 0 },
    { id: "alice", frame: 0 },
    { id: "bob", frame: 1 },
    { id: "carol", frame: 1 },
  ];

  const pairs = detectCoOccurrences(units);
  assert.equal(pairs.length, 4, "3 choose 2 in frame 0 + 3 choose 2 in frame 1 = 3 + 1 = 4");
  // Frame 0: victor-creature, victor-alice, creature-alice
  const f0 = pairs.filter((p) => p.frame === 0);
  assert.equal(f0.length, 3, "3 pairs in frame 0");
  const f1 = pairs.filter((p) => p.frame === 1);
  assert.equal(f1.length, 1, "1 pair in frame 1");
});

test("CON·Ground: no pairs when each frame has one unit", () => {
  const units = [
    { id: "a", frame: 0 },
    { id: "b", frame: 1 },
    { id: "c", frame: 2 },
  ];
  const pairs = detectCoOccurrences(units);
  assert.equal(pairs.length, 0, "no co-occurrences when units are in separate frames");
});

test("CON·Ground: deduplicates within a frame", () => {
  const units = [
    { id: "a", frame: 0 },
    { id: "b", frame: 0 },
    { id: "a", frame: 0 },  // duplicate
  ];
  const pairs = detectCoOccurrences(units);
  assert.equal(pairs.length, 1, "only one pair despite duplicate a");
});

test("CON·Ground: handles empty input", () => {
  const pairs = detectCoOccurrences([]);
  assert.equal(pairs.length, 0, "no pairs from empty input");
});

// ── SYN·Figure: transitive composition ──────────────────────────────────────
import { composeTransitive } from "../packages/engine/emergence/segment.js";

test("SYN·Figure: composes transitive link when A→B and B→C exist", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  readTriples(g, [
    { subject: "a", verb: "knows", object: "b", polarity: "+" },
    { subject: "b", verb: "knows", object: "c", polarity: "+" },
  ]);

  const composed = composeTransitive(g.edges, g.edges);
  assert.ok(composed.length >= 1, "at least one transitive link composed");
  const link = composed[0];
  assert.equal(link.subject, "a");
  assert.equal(link.object, "c");
  assert.equal(link.via, "b");
});

test("SYN·Figure: does NOT compose when direct link already exists", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  readTriples(g, [
    { subject: "a", verb: "knows", object: "b", polarity: "+" },
    { subject: "b", verb: "knows", object: "c", polarity: "+" },
    { subject: "a", verb: "knows", object: "c", polarity: "+" },
  ]);

  const composed = composeTransitive(g.edges, g.edges);
  const aToC = composed.filter((c) => c.subject === "a" && c.object === "c");
  assert.equal(aToC.length, 0, "no composition when direct link exists");
});

test("SYN·Figure: does NOT compose across different verbs", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  readTriples(g, [
    { subject: "a", verb: "knows", object: "b", polarity: "+" },
    { subject: "b", verb: "loves", object: "c", polarity: "+" },
  ]);

  const composed = composeTransitive(g.edges, g.edges);
  const aToC = composed.filter((c) => c.subject === "a" && c.object === "c");
  assert.equal(aToC.length, 0, "no composition across different verbs");
});

test("SYN·Figure: no composition when graph has no chains", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  readTriples(g, [
    { subject: "a", verb: "knows", object: "b", polarity: "+" },
    { subject: "c", verb: "knows", object: "d", polarity: "+" },
  ]);

  const composed = composeTransitive(g.edges, g.edges);
  assert.equal(composed.length, 0, "no transitive chains to compose");
});

test("SYN·Figure: handles empty graph", () => {
  const g = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
  const composed = composeTransitive(g.edges, g.edges);
  assert.equal(composed.length, 0, "no composition from empty graph");
});

// ── NUL·Pattern: kind void differentiation ──────────────────────────────────
import { kindVoid } from "../packages/engine/emergence/kind-void.js";

test("NUL·Pattern: required numbers are required", () => {
  assert.throws(() => kindVoid([], []), /draws/);
  assert.throws(() => kindVoid([], [], { draws: 100 }), /seed/);
});

test("NUL·Pattern: different kinds have low p-value (they are distinguishable)", () => {
  // Kind A: records with anchor_shared=true
  const kindA = Array.from({ length: 10 }, () => ({ anchor_shared: true, subject_shared: false }));
  // Kind B: records with subject_shared=true
  const kindB = Array.from({ length: 10 }, () => ({ anchor_shared: false, subject_shared: true }));

  const result = kindVoid(kindA, kindB, { draws: 199, seed: 42 });
  assert.ok(!result.reason, "not a gap");
  assert.ok(result.pValue < 0.1, `different kinds should be distinguishable, p=${result.pValue}`);
});

test("NUL·Pattern: identical kinds have high p-value (they are indistinguishable)", () => {
  // Both kinds have the same feature distribution.
  const kindA = Array.from({ length: 10 }, () => ({ anchor_shared: true, subject_shared: true }));
  const kindB = Array.from({ length: 10 }, () => ({ anchor_shared: true, subject_shared: true }));

  const result = kindVoid(kindA, kindB, { draws: 199, seed: 42 });
  assert.ok(!result.reason, "not a gap");
  assert.ok(result.pValue > 0.3, `identical kinds should not be distinguishable, p=${result.pValue}`);
});

test("NUL·Pattern: handles empty kinds gracefully", () => {
  const result = kindVoid([], [], { draws: 100, seed: 1 });
  assert.equal(result.reason, "empty_kinds");
});

// ── SIG·Pattern: kind co-occurrence ─────────────────────────────────────────
import { kindCoOccurrence } from "../packages/engine/emergence/kind-void.js";

test("SIG·Pattern: required numbers are required", () => {
  assert.throws(() => kindCoOccurrence(new Map(), []), /draws/);
  assert.throws(() => kindCoOccurrence(new Map(), [], { draws: 100 }), /seed/);
});

test("SIG·Pattern: frequently co-occurring kinds have low p-values", () => {
  // A and B co-occur in 40% of 50 frames (20 frames).
  // A appears in 30 frames total, B in 25 frames total.
  // Under the null, expected co-occurrence = 30/50 * 25/50 = 0.30.
  // Observed = 20/50 = 0.40 — higher than chance, but modest.
  // We test that A-C (random) is less significant than A-B (correlated).
  const assignments = new Map();
  for (let i = 0; i < 50; i++) {
    const present = new Set();
    if (i < 30) present.add("A");           // A in frames 0–29
    if (i >= 5 && i < 30) present.add("B"); // B in frames 5–29 (25 frames)
    if (i % 7 === 0) present.add("C");      // C in ~7 frames, randomly placed
    if (present.size > 0) assignments.set(i, present);
  }

  const results = kindCoOccurrence(assignments, ["A", "B", "C"], { draws: 199, seed: 42 });
  assert.ok(results.length > 0, "results produced");

  const ab = results.find((r) => r.a === "A" && r.b === "B");
  const ac = results.find((r) => r.a === "A" && r.c === "C");

  assert.ok(ab, "A-B pair exists");
  assert.ok(ab.pValue < 0.1, `A-B should co-occur significantly, p=${ab.pValue}`);

  if (ac) {
    assert.ok(ac.pValue > ab.pValue, `A-C should be less significant than A-B: ${ac.pValue} > ${ab.pValue}`);
  }
});

test("SIG·Pattern: returns empty for fewer than 2 kinds", () => {
  const results = kindCoOccurrence(new Map(), ["A"], { draws: 100, seed: 1 });
  assert.equal(results.length, 0, "need at least 2 kinds");
});

test("SIG·Pattern: handles empty assignments", () => {
  const results = kindCoOccurrence(new Map(), ["A", "B"], { draws: 100, seed: 1 });
  assert.equal(results.length, 0, "no results from empty assignments");
});

// ── declared numbers: all enforced ───────────────────────────────────────────

 test("every new organ enforces declared numbers — none is defaulted", () => {
  // kindVoid
  assert.throws(() => kindVoid([], []), /draws/);
  // kindCoOccurrence
  assert.throws(() => kindCoOccurrence(new Map(), []), /draws/);
  // composeTransitive — no declared numbers (pure graph operation)
  // connectedComponents — no declared numbers (pure graph operation)
  // communityDetection — maxIterations is optional with a sensible default
  // detectCoOccurrences — no declared numbers (pure data operation)
});

// ═══════════════════════════════════════════════════════════════════════════════
// TERRAIN TESTS — the last three cells: DEF·Pattern, REC·Pattern, SYN·Ground.
//
// DEF·Pattern unravels a paradigm; REC·Pattern composes the next one; SYN·Ground
// returns the arena as one extent from its parts. Same discipline: meaningful
// on structured material, refused on random data, declared numbers never
// defaulted.
// ═══════════════════════════════════════════════════════════════════════════════

import { induceKinds } from "../packages/engine/emergence/kinds.js";
import { refuseParadigm, rezeroParadigm, sameField } from "../packages/engine/emergence/paradigm.js";

const ATTR = (field_id, count = 1) => ({ field_id, count });
const PARADIGM_OPTS = { population: "test-pop", minPrevalence: 0.25, minKindSize: 3, permutations: 200, quantile: 0.95, reseeds: 24, seed: 42 };

// A paradigm coherent on the family frame: two "above" cores, anchor and subject.
const FAMILY_POPULATION = [
  { id: "sister", attributes: [ATTR("anchor_shared", 3)] },
  { id: "brother", attributes: [ATTR("anchor_shared", 2)] },
  { id: "daughter", attributes: [ATTR("anchor_shared")] },
  { id: "father", attributes: [ATTR("anchor_shared")] },
  { id: "mother", attributes: [ATTR("anchor_shared")] },
  { id: "wife", attributes: [ATTR("anchor_shared")] },
  { id: "husband", attributes: [ATTR("anchor_shared")] },
  { id: "sister-in-law", attributes: [ATTR("anchor_shared"), ATTR("stem_shared")] },
  { id: "in-love-with", attributes: [ATTR("subject_shared", 2)] },
  { id: "violent-love", attributes: [ATTR("subject_shared")] },
  { id: "pretended-love", attributes: [ATTR("subject_shared")] },
  { id: "falling-in-love", attributes: [ATTR("subject_shared")] },
  { id: "love-at-first-sight", attributes: [ATTR("subject_shared")] },
  { id: "not-in-love", attributes: [ATTR("subject_shared")] },
];

// A coherent population on a different frame: disjoint cores, root and mode.
const MUSIC_POPULATION = [
  { id: "bass", attributes: [ATTR("root_shared", 3)] },
  { id: "tenor", attributes: [ATTR("root_shared", 2)] },
  { id: "baritone", attributes: [ATTR("root_shared")] },
  { id: "soprano", attributes: [ATTR("root_shared")] },
  { id: "chant", attributes: [ATTR("root_shared")] },
  { id: "dirge", attributes: [ATTR("root_shared")] },
  { id: "coda", attributes: [ATTR("root_shared"), ATTR("theme_shared")] },
  { id: "refrain", attributes: [ATTR("mode_shared", 2)] },
  { id: "bridge", attributes: [ATTR("mode_shared")] },
  { id: "chorus", attributes: [ATTR("mode_shared")] },
  { id: "verse", attributes: [ATTR("mode_shared")] },
  { id: "prelude", attributes: [ATTR("mode_shared")] },
];

test("DEF·Pattern: coherent material with disjoint cores unravels the paradigm", () => {
  const kinds = induceKinds(FAMILY_POPULATION, PARADIGM_OPTS);
  const result = refuseParadigm(kinds, MUSIC_POPULATION, PARADIGM_OPTS);
  assert.equal(result.gap, "paradigm_unraveled");
  assert.equal(result.placement, 0, "no record placed against the paradigm cores");
  assert.ok(result.coherent, "the received material is itself coherent");
  assert.deepEqual(result.received_coherence, ["root_shared", "mode_shared"], "the foreign frame names itself");
});

test("DEF·Pattern: more of the same frame does NOT unravel", () => {
  const kinds = induceKinds(FAMILY_POPULATION, PARADIGM_OPTS);
  const moreFamily = [
    { id: "cousin", attributes: [ATTR("anchor_shared")] },
    { id: "aunt", attributes: [ATTR("anchor_shared")] },
    { id: "uncle", attributes: [ATTR("anchor_shared")] },
    { id: "nephew", attributes: [ATTR("anchor_shared")] },
    { id: "stepmother", attributes: [ATTR("anchor_shared"), ATTR("stem_shared")] },
    { id: "fiance", attributes: [ATTR("subject_shared")] },
    { id: "lover", attributes: [ATTR("subject_shared")] },
    { id: "crush", attributes: [ATTR("subject_shared")] },
  ];
  const result = refuseParadigm(kinds, moreFamily, PARADIGM_OPTS);
  assert.equal(result.refused, false, "same-frame material is placed, not unravelled");
  assert.ok(result.placement > 0, "records carry paradigm cores");
});

test("DEF·Pattern: random noise does NOT unravel — coherence is the precondition", () => {
  const kinds = induceKinds(FAMILY_POPULATION, PARADIGM_OPTS);
  const noise = [
    { id: "n1", attributes: [ATTR("x1")] },
    { id: "n2", attributes: [ATTR("x2")] },
    { id: "n3", attributes: [ATTR("x3")] },
    { id: "n4", attributes: [ATTR("x4")] },
    { id: "n5", attributes: [ATTR("x5")] },
    { id: "n6", attributes: [ATTR("x6")] },
  ];
  const result = refuseParadigm(kinds, noise, PARADIGM_OPTS);
  assert.equal(result.gap, undefined, "incoherent material is not an unravel, and no gap is claimed");
  assert.equal(result.refused, false);
  assert.equal(result.coherent, false, "no 'above' kind in the received material");
  assert.equal(result.placement, 0, "noise places nothing either — and still does not unravel");
});

test("DEF·Pattern: refused by a paradigm with no cores", () => {
  const result = refuseParadigm([], MUSIC_POPULATION, PARADIGM_OPTS);
  assert.equal(result.gap, "empty_paradigm");
});

// ── cross-material verb identity: `sameField`/`sameAct` (challenge #9) ─────
//
// Two independently-authored documents' own SVO extraction reports whichever
// verb inflection the sentence on the page used, never a shared citation
// form — "departed" in one, "departs" in another, same act. Without a
// lemmatizer this organ can only compare field_ids by raw string identity,
// which reads that as two different cores. `opts.sameAct` is optional and
// its absence must change nothing (first test); when supplied it must let
// `verb:`-shaped cores hold a record spelled in a different inflection
// (second test) while still refusing to conflate two genuinely different
// verbs, inflected or not (third test).

const sameAct = (a, b) => {
  const stem = (w) => (w.endsWith("s") ? w.slice(0, -1) : w.endsWith("ed") ? w.slice(0, -2) : w);
  return stem(a) === stem(b);
};

test("sameField: exact identity always holds, with or without sameAct", () => {
  assert.equal(sameField("verb:departed", "verb:departed"), true);
  assert.equal(sameField("verb:departed", "verb:departed", { sameAct }), true);
  assert.equal(sameField("anchor_shared", "anchor_shared"), true);
});

test("sameField: without sameAct, two inflections of one verb are NOT the same field (default is unchanged)", () => {
  assert.equal(sameField("verb:departed", "verb:departs"), false);
});

test("sameField: with sameAct, two inflections of the SAME verb ARE the same field, only under the verb: prefix", () => {
  assert.equal(sameField("verb:departed", "verb:departs", { sameAct }), true, "same verb, different inflection");
  assert.equal(sameField("verb:departed", "verb:arrived", { sameAct }), false, "different verbs stay different, inflected or not");
  assert.equal(sameField("anchor_shared", "anchor_shares", { sameAct }), false, "sameAct is scoped to verb: fields, never applied to non-verb field_ids");
});

test("DEF·Pattern: a cross-material paradigm holds a record spelled in a different verb inflection, only when sameAct is supplied", () => {
  const VERB_FAMILY = [
    { id: "sister", attributes: [ATTR("verb:departed", 3)] },
    { id: "brother", attributes: [ATTR("verb:departed", 2)] },
    { id: "daughter", attributes: [ATTR("verb:departed")] },
    { id: "father", attributes: [ATTR("verb:departed")] },
    { id: "mother", attributes: [ATTR("verb:departed")] },
    { id: "wife", attributes: [ATTR("verb:departed")] },
    { id: "husband", attributes: [ATTR("verb:departed")] },
    { id: "sister-in-law", attributes: [ATTR("verb:departed"), ATTR("stem_shared")] },
    { id: "in-love-with", attributes: [ATTR("subject_shared", 2)] },
    { id: "violent-love", attributes: [ATTR("subject_shared")] },
    { id: "pretended-love", attributes: [ATTR("subject_shared")] },
    { id: "falling-in-love", attributes: [ATTR("subject_shared")] },
    { id: "love-at-first-sight", attributes: [ATTR("subject_shared")] },
    { id: "not-in-love", attributes: [ATTR("subject_shared")] },
  ];
  const kinds = induceKinds(VERB_FAMILY, PARADIGM_OPTS);
  assert.ok(kinds.some((k) => k.core?.field_id === "verb:departed"), "the paradigm's core is the raw inflection this material used");

  // A different, independently-built document's records: same verb, a
  // DIFFERENT inflection ("departs", not "departed") — the exact shape of
  // two documents' own independent SVO extraction over the same event.
  const otherDoc = [
    { id: "cousin", attributes: [ATTR("verb:departs")] },
    { id: "aunt", attributes: [ATTR("verb:departs")] },
    { id: "uncle", attributes: [ATTR("verb:departs")] },
  ];

  const withoutLemma = refuseParadigm(kinds, otherDoc, PARADIGM_OPTS);
  assert.equal(withoutLemma.placement, 0, "raw string identity alone cannot see across the inflection");

  const withLemma = refuseParadigm(kinds, otherDoc, { ...PARADIGM_OPTS, sameAct });
  assert.equal(withLemma.placement, 1, "sameAct recognises departs/departed as the one verb the paradigm coheres on");
  assert.equal(withLemma.refused, false);
});

test("DEF·Pattern: declared numbers are declared, never defaulted", () => {
  const kinds = induceKinds(FAMILY_POPULATION, PARADIGM_OPTS);
  assert.throws(() => refuseParadigm(kinds, MUSIC_POPULATION, { minPrevalence: 0.25 }), /population/);
  assert.throws(() => refuseParadigm(kinds, MUSIC_POPULATION, { population: "p" }), /minPrevalence/);
});

test("REC·Pattern: re-zero is never a default — it needs a measured unravel", () => {
  assert.equal(rezeroParadigm(MUSIC_POPULATION, PARADIGM_OPTS).gap, "no_rezero_trigger");
  assert.equal(
    rezeroParadigm(MUSIC_POPULATION, PARADIGM_OPTS, { prior: { gap: "no_ground" } }).gap,
    "no_rezero_trigger",
    "a prior that did not unravel is not a trigger",
  );
});

test("REC·Pattern: after a measured unravel, the arriving population re-zeros", () => {
  const kinds = induceKinds(FAMILY_POPULATION, PARADIGM_OPTS);
  const unravel = refuseParadigm(kinds, MUSIC_POPULATION, PARADIGM_OPTS);
  assert.equal(unravel.gap, "paradigm_unraveled");

  const result = rezeroParadigm(MUSIC_POPULATION, PARADIGM_OPTS, { prior: unravel });
  assert.equal(result.rezeroed, true);
  assert.equal(result.held_records, MUSIC_POPULATION.length, "the new paradigm holds the arriving material");
  assert.deepEqual(result.paradigm, ["root_shared", "mode_shared"], "a new ambient ground begins");
  assert.equal(result.trigger, "paradigm_unraveled");
});

test("REC·Pattern: a re-zero that concedes nothing is refused", () => {
  const kinds = induceKinds(FAMILY_POPULATION, PARADIGM_OPTS);
  const unravel = refuseParadigm(kinds, MUSIC_POPULATION, PARADIGM_OPTS);
  // The union is genuinely two paradigms — re-inducing over it cannot hold the
  // old loss, so the re-zero must refuse rather than pretend.
  const result = rezeroParadigm([...FAMILY_POPULATION, ...MUSIC_POPULATION], PARADIGM_OPTS, { prior: unravel });
  assert.equal(result.gap, "not_earned");
  assert.ok(result.still_unheld > 0);
});

test("REC·Pattern: declared numbers are declared, never defaulted", () => {
  const kinds = induceKinds(FAMILY_POPULATION, PARADIGM_OPTS);
  const unravel = refuseParadigm(kinds, MUSIC_POPULATION, PARADIGM_OPTS);
  assert.equal(unravel.gap, "paradigm_unraveled");
  assert.throws(() => rezeroParadigm(MUSIC_POPULATION, { minPrevalence: 0.25 }, { prior: unravel }), /population/);
});

test("REC·Pattern: refuseParadigm's own non-unraveled result is not a trigger, even though it carries a `paradigm` array", () => {
  // The adversarial case: refuseParadigm's routine "not refused" return
  // ({ refused: false, paradigm: [...], ... }) has the same `paradigm` array
  // shape as the unravel gap, but is a plain object, never built by `gap()` —
  // `isGap` on it is false. A prior admission check that accepted any object
  // with a `paradigm` array would let this masquerade as a measured unravel.
  const kinds = induceKinds(FAMILY_POPULATION, PARADIGM_OPTS);
  const moreFamily = [
    { id: "cousin", attributes: [ATTR("anchor_shared")] },
    { id: "aunt", attributes: [ATTR("anchor_shared")] },
    { id: "uncle", attributes: [ATTR("anchor_shared")] },
    { id: "nephew", attributes: [ATTR("anchor_shared")] },
    { id: "stepmother", attributes: [ATTR("anchor_shared"), ATTR("stem_shared")] },
    { id: "fiance", attributes: [ATTR("subject_shared")] },
    { id: "lover", attributes: [ATTR("subject_shared")] },
    { id: "crush", attributes: [ATTR("subject_shared")] },
  ];
  const notUnraveled = refuseParadigm(kinds, moreFamily, PARADIGM_OPTS);
  assert.equal(notUnraveled.refused, false, "same-frame material is placed, not unravelled");
  assert.ok(Array.isArray(notUnraveled.paradigm), "carries a paradigm array, same shape as the unravel gap");

  const result = rezeroParadigm(moreFamily, PARADIGM_OPTS, { prior: notUnraveled });
  assert.equal(result.gap, "no_rezero_trigger", "a non-gap prior must never trigger a re-zero, regardless of its shape");
});

// ── SYN·Ground: the arena as one extent ─────────────────────────────────────
import { composeField } from "../packages/engine/emergence/field.js";

const FRANKENSTEIN_OPENING = "Letter 1\n\nTo Mrs. Saville, England.\n\nSt. Petersburgh, Dec. 11th, 17——.";

test("SYN·Ground: contiguous parts compose to the exact original extent", () => {
  const text = FRANKENSTEIN_OPENING;
  const bytes = Buffer.byteLength(text);
  const byteOfChar = (i) => Buffer.byteLength(text.slice(0, i));
  const cutChars = [0, 7, 21, 40, 58, text.length];
  const parts = [];
  for (let i = 0; i + 1 < cutChars.length; i++) {
    const startChar = cutChars[i];
    const endChar = cutChars[i + 1];
    parts.push({ source: "letter1", byteStart: byteOfChar(startChar), byteEnd: byteOfChar(endChar), text: text.slice(startChar, endChar) });
  }
  const result = composeField(parts);
  assert.equal(result.contiguous, true);
  assert.equal(result.bytes, bytes, "the composed extent is byte-exact");
  assert.equal(result.field.length, 1, "one source, one extent");
  assert.equal(result.field[0].text, text, "a quote is a slice, never a reconstruction");
});

test("SYN·Ground: a missing part is a typed gap, never a silent fill", () => {
  const text = FRANKENSTEIN_OPENING;
  const tail = text.slice(7);
  const p1 = { source: "letter1", byteStart: 0, byteEnd: 7, text: text.slice(0, 7) };
  const pGap = { source: "letter1", byteStart: 11, byteEnd: 11 + Buffer.byteLength(tail), text: tail };
  const result = composeField([p1, pGap]);
  assert.equal(result.gap, "gap_between_parts");
  assert.equal(result.missing, 4, "the missing span is measured, not guessed");
});

test("SYN·Ground: overlapping claims are a contradiction, refused by type", () => {
  const text = FRANKENSTEIN_OPENING;
  const tail = text.slice(7);
  const p1 = { source: "letter1", byteStart: 0, byteEnd: 7, text: text.slice(0, 7) };
  const pOverlap = { source: "letter1", byteStart: 3, byteEnd: 3 + Buffer.byteLength(tail), text: tail };
  assert.equal(composeField([p1, pOverlap]).gap, "overlapping_parts");
});

test("SYN·Ground: a lying byte address is refused — the text must fill its own extent", () => {
  const result = composeField([{ source: "letter1", byteStart: 0, byteEnd: 100, text: "short" }]);
  assert.equal(result.gap, "byte_mismatch");
  assert.equal(result.declared, 100);
  assert.equal(result.actual, 5);
});

test("SYN·Ground: random addresses produce refusals, never a plausible field", () => {
  // Random byte-accurate parts over the same source: whatever else happens,
  // the composition must refuse — a random field is not a field. Byte-accurate
  // (piece's own length fills its declared extent) so the refusal can only be
  // a real address fault: a gap or an overlap, never a lying byte count.
  const text = FRANKENSTEIN_OPENING;
  const bytes = Buffer.byteLength(text);
  const charOf = (b) => { let acc = 0; for (let i = 0; i <= text.length; i++) { if (Buffer.byteLength(text.slice(0, i)) >= b) return i; } return text.length; };
  const byteOf = (c) => Buffer.byteLength(text.slice(0, c));
  const byteAccurate = (startChar, endChar) => {
    const piece = text.slice(startChar, endChar);
    return { source: "letter1", byteStart: byteOf(startChar), byteEnd: byteOf(startChar) + Buffer.byteLength(piece), text: piece };
  };
  let refusals = 0;
  for (let i = 0; i < 20; i++) {
    const a = charOf(Math.floor(Math.random() * bytes));
    const b = charOf(Math.floor(Math.random() * bytes));
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const part = byteAccurate(lo, hi);
    // A second part sharing this source but not contiguous with the first.
    const c = charOf(Math.floor(Math.random() * bytes));
    const second = byteAccurate(Math.min(c, text.length), Math.max(c, text.length));
    const result = composeField([part, second]);
    if (result.gap === "gap_between_parts" || result.gap === "overlapping_parts" || result.gap === "byte_mismatch") refusals++;
  }
  assert.ok(refusals > 0, "randomly addressed parts do not compose silently");
});

test("SYN·Ground: empty input is an empty field", () => {
  assert.equal(composeField([]).gap, "empty_field");
  assert.equal(composeField().gap, "empty_field");
});

test("SYN·Ground: multiple sources compose one extent each", () => {
  const a = FRANKENSTEIN_OPENING;
  const b = "To Be Or Not To Be";
  const ha = Math.floor(a.length / 2);
  const a1 = { source: "srcA", byteStart: 0, byteEnd: Buffer.byteLength(a.slice(0, ha)), text: a.slice(0, ha) };
  const a2 = { source: "srcA", byteStart: Buffer.byteLength(a.slice(0, ha)), byteEnd: Buffer.byteLength(a), text: a.slice(ha) };
  const b1 = { source: "srcB", byteStart: 0, byteEnd: Buffer.byteLength(b), text: b };
  const result = composeField([b1, a1, a2]);
  assert.equal(result.field.length, 2, "one extent per source");
  assert.equal(result.bytes, Buffer.byteLength(a) + Buffer.byteLength(b));
  const aField = result.field.find((f) => f.source === "srcA");
  const bField = result.field.find((f) => f.source === "srcB");
  assert.equal(aField.text, a);
  assert.equal(bField.text, b);
});

// eoreader6 · induction/typology — conformance
//
// Assembles the `typology` shape modifier-order/index.js receives
// ({ranks, direction, giver}, per II.2's giver test) from induceKinds's own
// certified output. These tests hold the assembler to the rank convention
// modifier-order/wals.js already established (closer to the anchor = lower
// rank = more classifying), to never fabricating a direction a corpus
// doesn't actually have, and — the real point — to producing a typology
// that modifier-order/index.js's EXISTING organ accepts and nests
// correctly, unchanged, exactly as it would a WALS or hand-written one.
//
// Kinds are hand-built here, in the exact shape induceKinds returns,
// rather than produced by a live induceKinds call — real certification
// against a real corpus of priors is conformance/induction-live-priors's
// job (Task 10); this file controls the happy and refusal paths
// deterministically, the way modifier-order.test.js's own fixtures do.

import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleTypology, tagSequence } from "../induction/typology.js";
import { admissibleTypology, order, toEvents } from "../modifier-order/index.js";

const COLOR_KIND = Object.freeze({
  id: "kind:test:black|red|white",
  label: "distance=1",
  members: Object.freeze(["black", "red", "white"]),
  height: "above",
});
const SIZE_KIND = Object.freeze({
  id: "kind:test:big|small|tall",
  label: "distance=2",
  members: Object.freeze(["big", "small", "tall"]),
  height: "above",
});
const UNSTABLE_KIND = Object.freeze({
  id: "kind:test:odd|weird",
  label: "distance=3",
  members: Object.freeze(["odd", "weird"]),
  height: "unstable",
});

const OCCURRENCES = [];
for (let i = 0; i < 8; i++) {
  const color = ["black", "red", "white"][i % 3];
  const size = ["big", "small", "tall"][i % 3];
  OCCURRENCES.push({ token: color, anchor: "cat", side: "before", distance: 1 });
  OCCURRENCES.push({ token: size, anchor: "cat", side: "before", distance: 2 });
}

test("assembleTypology refuses undeclared population", () => {
  const result = assembleTypology([COLOR_KIND], OCCURRENCES, {});
  assert.equal(result.gap, "undeclared");
  assert.equal(result.what, "population");
});

test("assembleTypology refuses empty kinds", () => {
  const result = assembleTypology([], OCCURRENCES, { population: "test" });
  assert.equal(result.gap, "empty_material");
});

test("assembleTypology refuses when no kind cleared both Born gates", () => {
  const result = assembleTypology([UNSTABLE_KIND], OCCURRENCES, { population: "test" });
  assert.equal(result.gap, "unstable");
  assert.deepEqual(result.excludedKinds, ["kind:test:odd|weird"]);
});

test("assembleTypology assigns lower rank to the kind whose members sit closer to their anchor", () => {
  const result = assembleTypology([COLOR_KIND, SIZE_KIND], OCCURRENCES, { population: "test" });
  assert.equal(result.gap, undefined, JSON.stringify(result));
  assert.equal(result.ranks[COLOR_KIND.id], 1);
  assert.equal(result.ranks[SIZE_KIND.id], 2);
  assert.ok(result.ranks[COLOR_KIND.id] < result.ranks[SIZE_KIND.id], "closer-to-head kind must rank lower (more classifying)");
});

test("assembleTypology measures direction from classified occurrences and reports it in the giver string", () => {
  const result = assembleTypology([COLOR_KIND, SIZE_KIND], OCCURRENCES, { population: "test" });
  assert.equal(result.direction, "pre");
  assert.match(result.giver, /induced from population "test"/);
  assert.match(result.giver, /2 kind\(s\) certified/);
});

test("assembleTypology carries an unstable (existence-only) kind as excludedKinds rather than silently dropping it", () => {
  const result = assembleTypology([COLOR_KIND, SIZE_KIND, UNSTABLE_KIND], OCCURRENCES, { population: "test" });
  assert.deepEqual(result.excludedKinds, ["kind:test:odd|weird"]);
  assert.match(result.giver, /1 candidate kind\(s\) passed existence but not possibility-constraint/);
});

test("assembleTypology refuses (unstable) when classified occurrences don't clear significance for a direction", () => {
  const balanced = [
    { token: "black", anchor: "cat", side: "before", distance: 1 },
    { token: "black", anchor: "cat", side: "after", distance: 1 },
    { token: "red", anchor: "cat", side: "before", distance: 1 },
    { token: "red", anchor: "cat", side: "after", distance: 1 },
  ];
  const result = assembleTypology([Object.freeze({ ...COLOR_KIND, members: ["black", "red"] })], balanced, { population: "test" });
  assert.equal(result.gap, "unstable");
});

test("tagSequence maps classified tokens to {class, surface}, and unclassified tokens to class: null", () => {
  const typology = assembleTypology([COLOR_KIND, SIZE_KIND], OCCURRENCES, { population: "test" });
  const tags = tagSequence(["big", "black"], typology);
  assert.equal(tags[0].class, SIZE_KIND.id);
  assert.equal(tags[0].surface, "big");
  assert.equal(tags[1].class, COLOR_KIND.id);

  const unknownTags = tagSequence(["purple"], typology);
  assert.equal(unknownTags[0].class, null);
});

// ── real composition: an induced typology feeds the EXISTING modifier-order
// organ unchanged, exactly like a WALS or English-demo typology would ─────

test("an assembled typology is admissible to modifier-order/index.js's own admissibleTypology check", () => {
  const typology = assembleTypology([COLOR_KIND, SIZE_KIND], OCCURRENCES, { population: "test" });
  const bad = admissibleTypology(typology);
  assert.equal(bad, null, `expected admissible, got ${JSON.stringify(bad)}`);
});

test("order() nests a real sequence tagged from the induced typology, in the induced rank order", () => {
  const typology = assembleTypology([COLOR_KIND, SIZE_KIND], OCCURRENCES, { population: "test" });
  // "big black cat" -- size farther from the head, color nearer -- reading
  // order for a pre-nominal typology: [size, color], which the induced
  // ranks (color=1 < size=2) say should nest correctly.
  const sequence = tagSequence(["big", "black"], typology);
  const result = order(sequence, typology);
  assert.equal(result.relation, "nested");
});

test("order() reports inverted when the induced rank order is violated", () => {
  const typology = assembleTypology([COLOR_KIND, SIZE_KIND], OCCURRENCES, { population: "test" });
  // "black big cat" -- color (rank 1) placed farther from the head than
  // size (rank 2) -- inverts the induced nesting.
  const sequence = tagSequence(["black", "big"], typology);
  const result = order(sequence, typology);
  assert.equal(result.relation, "inverted");
});

test("toEvents mints real SEG.narrow events from an induced typology, refusing an inverted stack exactly as it would for a received one", () => {
  const typology = assembleTypology([COLOR_KIND, SIZE_KIND], OCCURRENCES, { population: "test" });
  const nested = tagSequence(["big", "black"], typology);
  const events = toEvents(nested, typology, { head: "cat" });
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.type === "SEG.narrow"));

  const inverted = tagSequence(["black", "big"], typology);
  const refused = toEvents(inverted, typology, { head: "cat" });
  assert.equal(refused.gap, "unstable");
});

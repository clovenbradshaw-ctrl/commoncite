// eoreader6 · induction/attributes — conformance
//
// Converts induction/candidates.js's occurrence list into the attribute-
// record shape emergence/kinds.js's induceKinds() requires, so candidate
// descriptor words can be grouped into emergent, ANONYMOUS kinds — no
// lexicon, no semantic label, no human ever needing to learn what a given
// cluster is "for" (the user's own framing: "no human learns these ten so
// doing it emergently is fine"). These tests hold the adapter to producing
// exactly the shape induceKinds needs, and prove the two organs actually
// compose end to end without either module throwing or silently defaulting.

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractOccurrences } from "../induction/candidates.js";
import { toAttributeRecords } from "../induction/attributes.js";
import { induceKinds } from "../packages/engine/emergence/kinds.js";

test("toAttributeRecords refuses undeclared minOccurrences", () => {
  const result = toAttributeRecords([{ token: "x", anchor: "y", side: "before", distance: 1 }], {});
  assert.equal(result.gap, "undeclared");
  assert.equal(result.what, "minOccurrences");
});

test("toAttributeRecords refuses empty material", () => {
  const result = toAttributeRecords([], { minOccurrences: 1 });
  assert.equal(result.gap, "empty_material");
});

test("toAttributeRecords produces one record per distinct MODIFIER token (tokens that appear as `token`, not just `anchor`), with side/distance/headship fields", () => {
  const occurrences = [
    { token: "black", anchor: "cat", side: "before", distance: 1 },
    { token: "black", anchor: "dog", side: "before", distance: 1 },
    { token: "black", anchor: "cat", side: "before", distance: 1 },
  ];
  const records = toAttributeRecords(occurrences, { minOccurrences: 1 });
  // "cat"/"dog" here only ever occur as `anchor`, never as `token` -- they
  // are never candidates for descriptor classification in this material,
  // so they get no record of their own. Only "black" -- the one token that
  // actually occurs as a modifier -- does.
  assert.equal(records.length, 1);
  const black = records[0];
  assert.equal(black.id, "black");
  const fields = Object.fromEntries(black.attributes.map((a) => [a.field_id, a]));
  assert.equal(fields.side.value, "before");
  assert.equal(fields.distance.value, 1);
  assert.equal(fields.headship.value, 0, "black never itself serves as an anchor in this material");
});

test("a token that serves as BOTH modifier and anchor gets one record with a headship strictly between 0 and 1", () => {
  const occurrences = [
    // "black" modifies "cat" twice...
    { token: "black", anchor: "cat", side: "before", distance: 1 },
    { token: "black", anchor: "cat", side: "before", distance: 1 },
    // ...but "black" is itself modified by "fat" once (fat black ...)
    { token: "fat", anchor: "black", side: "before", distance: 1 },
  ];
  const records = toAttributeRecords(occurrences, { minOccurrences: 1 });
  const black = records.find((r) => r.id === "black");
  assert.ok(black, "black occurs as `token` (modifying cat), so it earns a record");
  const headship = black.attributes.find((a) => a.field_id === "headship").value;
  assert.ok(headship > 0 && headship < 1, `expected 0 < headship < 1, got ${headship}`);
});

test("toAttributeRecords drops tokens below minOccurrences", () => {
  const occurrences = [{ token: "rare", anchor: "cat", side: "before", distance: 1 }];
  const records = toAttributeRecords(occurrences, { minOccurrences: 5 });
  assert.equal(records.gap, "empty_material");
});

// ── real integration: candidates.js -> attributes.js -> induceKinds ────────

const CORPUS = [
  "the fat black cat sat on the old wooden table",
  "the fat black cat slept on the old wooden chair",
  "the thin white cat sat on the old wooden table",
  "the fat black dog sat on the old wooden table",
  "the thin white dog slept on the old wooden chair",
  "the fat black cat sat on the new wooden table",
  "the small red bird sat on the old wooden table",
  "the small red bird slept on the old wooden chair",
  "the tall green tree stood by the old wooden fence",
  "the tall green tree stood by the new wooden fence",
  "the fat black cat sat on the old wooden bench",
  "the small red bird sat on the old wooden bench",
];

test("the full induction pipeline runs end to end on a synthetic corpus and returns typed, non-throwing output", () => {
  const occResult = extractOccurrences(CORPUS, { minAnchorFrequency: 2, maxAnchorFrequency: 9, maxRunLength: 3 });
  assert.equal(occResult.gap, undefined);

  const records = toAttributeRecords(occResult.occurrences, { minOccurrences: 2 });
  assert.equal(records.gap, undefined);
  assert.ok(records.length > 0);
  // every record matches the exact shape induceKinds requires
  for (const rec of records) {
    assert.equal(typeof rec.id, "string");
    assert.ok(Array.isArray(rec.attributes));
    for (const attr of rec.attributes) {
      assert.equal(typeof attr.field_id, "string");
      assert.ok(["categorical", "numeric"].includes(attr.value_type));
      assert.notEqual(attr.value, undefined);
    }
  }

  // induceKinds itself: every option declared, never defaulted, per its own
  // contract. A 12-sentence synthetic corpus is too little material to
  // certify any kind against chance -- an empty result here is the honest,
  // correct output (SEED.md: no fabricated kinds from too little evidence),
  // not a failure of this adapter. Task 10 runs this same pipeline against
  // real live_priors text, where there is enough material to certify kinds.
  const kinds = induceKinds(records, {
    population: "induction-smoke-test",
    minPrevalence: 0.5,
    minKindSize: 2,
    permutations: 200,
    quantile: 0.95,
    seed: 42,
    reseeds: 5,
  });
  assert.ok(Array.isArray(kinds), "induceKinds must return an array, whether empty or populated");
  for (const kind of kinds) {
    assert.equal(typeof kind.id, "string");
    assert.equal(typeof kind.label, "string");
    assert.ok(Array.isArray(kind.members));
    assert.ok(["above", "peer", "unstable"].includes(kind.height));
  }
});

test("induceKinds throws on undeclared options rather than silently defaulting (kinds.js's own contract, exercised through our adapter's output)", () => {
  const occResult = extractOccurrences(CORPUS, { minAnchorFrequency: 2, maxAnchorFrequency: 9, maxRunLength: 3 });
  const records = toAttributeRecords(occResult.occurrences, { minOccurrences: 2 });
  assert.throws(() =>
    induceKinds(records, { minPrevalence: 0.5, minKindSize: 2, permutations: 200, quantile: 0.95, seed: 42, reseeds: 5 })
  );
});

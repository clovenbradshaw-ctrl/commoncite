// eoreader6 · modifier-order/ud-bridge — conformance
//
// Synthetic, hand-constructed sentence sets standing in for a real UD
// treebank extraction (this module does not parse .conllu — see its own
// header) — but shaped exactly the way a real extraction would be: one
// array of {relation, surface} dependents per sentence. Three regimes,
// three different verdicts required, or the distinction is decoration:
// reliably-nested (agrees with the received typology), reliably-inverted
// (disagrees — a real, surfaced finding, never suppressed), and a 50/50
// mix (too little signal to say either way).

import { test } from "node:test";
import assert from "node:assert/strict";
import { UD_RELATION_TO_CLASS, judgeSentences, crossCheck } from "../modifier-order/ud-bridge.js";
import { walsTypology } from "../modifier-order/wals.js";
import { isGap } from "../nul/index.js";

// UD's `amod` is one flat relation for all attributive adjectives — it does
// not itself distinguish quality/color/etc., so the typology under test
// here uses one generic "adjective" slot, not the fuller AP-internal scale.
const TYPOLOGY = walsTypology("english", { adjectiveRanks: { adjective: 10 } });

const sentence = (relations) => relations.map((relation, i) => ({ relation, surface: `w${i}` }));

// "these three black cats" — det, nummod, amod, all before the head, the
// harmonic order Universal 20 predicts for English.
const NESTED_SENTENCE = () => sentence(["det", "nummod", "amod"]);
// "black these three cats" — amod closer to the head than det: inverted.
const INVERTED_SENTENCE = () => sentence(["amod", "nummod", "det"]);

test("UD_RELATION_TO_CLASS maps only documented UD relations", () => {
  assert.deepEqual(UD_RELATION_TO_CLASS, { det: "demonstrative", nummod: "numeral", amod: "adjective" });
});

test("judgeSentences skips a sentence with fewer than two mapped relations", () => {
  const judged = judgeSentences([sentence(["amod"]), sentence(["case"])], TYPOLOGY);
  assert.ok(isGap(judged));
  assert.equal(judged.gap, "unknown_spec");
});

test("judgeSentences ignores unmapped relations rather than guessing at them", () => {
  const judged = judgeSentences([sentence(["det", "nummod", "case", "punct"])], TYPOLOGY);
  assert.deepEqual(judged, ["nested"]);
});

test("crossCheck: a reliably nested corpus agrees with the typology at high confidence", () => {
  const sentences = Array.from({ length: 20 }, NESTED_SENTENCE);
  const r = crossCheck(sentences, TYPOLOGY);
  assert.equal(r.n, 20);
  assert.equal(r.nested, 20);
  assert.equal(r.agrees, true);
  assert.ok(r.pValue < 0.001);
});

test("crossCheck: a reliably inverted corpus disagrees — a real finding, not suppressed", () => {
  const sentences = Array.from({ length: 20 }, INVERTED_SENTENCE);
  const r = crossCheck(sentences, TYPOLOGY);
  assert.equal(r.nested, 0);
  assert.equal(r.agrees, false);
});

test("crossCheck: a 50/50 mix is too little signal to agree or disagree", () => {
  const sentences = [
    ...Array.from({ length: 10 }, NESTED_SENTENCE),
    ...Array.from({ length: 10 }, INVERTED_SENTENCE),
  ];
  const r = crossCheck(sentences, TYPOLOGY);
  assert.equal(r.n, 20);
  assert.equal(r.nested, 10);
  assert.equal(r.agrees, false); // p-value ~0.59, not < 0.05 — no evidence of a preference either way
});

test("crossCheck: too little material to say anything reads null, never a silent false", () => {
  const sentences = Array.from({ length: 2 }, NESTED_SENTENCE);
  const r = crossCheck(sentences, TYPOLOGY);
  assert.equal(r.n, 2);
  assert.equal(r.agrees, null);
});

test("crossCheck refuses cleanly when no sentence contributes anything", () => {
  const r = crossCheck([sentence(["case"]), sentence(["punct"])], TYPOLOGY);
  assert.ok(isGap(r));
});

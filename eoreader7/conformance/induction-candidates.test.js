// eoreader6 · induction/candidates — conformance
//
// This organ finds candidate modifier stacks with no lexicon and no POS
// tagger, using nothing but a corpus's own token frequencies (Zipf's
// three-band split: function / content / rare). These tests hold it to
// what it actually claims — a narrow, measured statistical split, not
// unsupervised POS induction — and record an honest edge case: a clean,
// small sample (n=4, 4-0) can still fail to clear p<0.05, and the module
// must report "exchangeable" rather than overclaim "pre" from too little
// evidence. See the module's own header comment for the full disclosure.

import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, frequencyBands, extractOccurrences, measureDirection } from "../induction/candidates.js";

test("tokenize splits on Unicode letters and drops punctuation", () => {
  assert.deepEqual(tokenize("the fat, black cat!"), ["the", "fat", "black", "cat"]);
  assert.deepEqual(tokenize(""), []);
  assert.deepEqual(tokenize(null), []);
});

const CORPUS = [
  "the fat black cat sat on the old wooden table",
  "the fat black cat slept on the old wooden chair",
  "the thin white cat sat on the old wooden table",
  "the fat black dog sat on the old wooden table",
  "the thin white dog slept on the old wooden chair",
  "the fat black cat sat on the new wooden table",
];

test("frequencyBands refuses undeclared bounds rather than defaulting", () => {
  const noMin = frequencyBands(CORPUS, { maxAnchorFrequency: 5 });
  assert.equal(noMin.gap, "undeclared");
  assert.equal(noMin.what, "minAnchorFrequency");

  const noMax = frequencyBands(CORPUS, { minAnchorFrequency: 2 });
  assert.equal(noMax.gap, "undeclared");
  assert.equal(noMax.what, "maxAnchorFrequency");

  const badMax = frequencyBands(CORPUS, { minAnchorFrequency: 5, maxAnchorFrequency: 2 });
  assert.equal(badMax.gap, "undeclared");
});

test("frequencyBands splits 'the' (function, n=12) from content words and rare ones", () => {
  const bands = frequencyBands(CORPUS, { minAnchorFrequency: 2, maxAnchorFrequency: 8 });
  assert.equal(bands.band("the"), "function"); // appears 12x, well above max
  assert.equal(bands.band("cat"), "content"); // appears 4x
  assert.equal(bands.band("wooden"), "content"); // appears 6x
  assert.equal(bands.band("new"), "rare"); // appears 1x
  assert.equal(bands.band("chair"), "content"); // appears 2x, meets the floor
});

test("frequencyBands is deterministic and case-sensitive by default (no implicit folding)", () => {
  const mixedCase = ["Cat cat CAT", "cat cat"];
  const bands = frequencyBands(mixedCase, { minAnchorFrequency: 1, maxAnchorFrequency: 10 });
  assert.equal(bands.counts.get("cat"), 3);
  assert.equal(bands.counts.get("Cat"), 1);
  assert.equal(bands.counts.get("CAT"), 1);
});

test("frequencyBands honors an injected foldCase function", () => {
  const mixedCase = ["Cat cat CAT", "cat cat"];
  const bands = frequencyBands(mixedCase, {
    minAnchorFrequency: 1,
    maxAnchorFrequency: 10,
    foldCase: (t) => t.toLowerCase(),
  });
  assert.equal(bands.counts.get("cat"), 5);
  assert.equal(bands.counts.get("Cat"), undefined);
});

test("extractOccurrences finds adjacent content-band runs and stops at function/rare words", () => {
  const result = extractOccurrences(CORPUS, { minAnchorFrequency: 2, maxAnchorFrequency: 8, maxRunLength: 3 });
  assert.equal(result.gap, undefined);
  // "fat black cat": cat is anchor, black is distance 1 before, fat is distance 2 before
  const catOccurrences = result.occurrences.filter((o) => o.anchor === "cat");
  const black1 = catOccurrences.find((o) => o.token === "black" && o.distance === 1 && o.side === "before");
  assert.ok(black1, "black should be found 1 before cat");
  const fat2 = catOccurrences.find((o) => o.token === "fat" && o.distance === 2 && o.side === "before");
  assert.ok(fat2, "fat should be found 2 before cat, chained through black");
});

test("extractOccurrences respects maxRunLength", () => {
  const result = extractOccurrences(CORPUS, { minAnchorFrequency: 2, maxAnchorFrequency: 8, maxRunLength: 1 });
  const catOccurrences = result.occurrences.filter((o) => o.anchor === "cat");
  const fat2 = catOccurrences.find((o) => o.token === "fat" && o.distance === 2);
  assert.equal(fat2, undefined, "fat is 2 away, beyond maxRunLength=1, should not appear");
  const black1 = catOccurrences.find((o) => o.token === "black" && o.distance === 1);
  assert.ok(black1, "black at distance 1 should still be found");
});

test("extractOccurrences refuses undeclared maxRunLength", () => {
  const result = extractOccurrences(CORPUS, { minAnchorFrequency: 2, maxAnchorFrequency: 8 });
  assert.equal(result.gap, "undeclared");
  assert.equal(result.what, "maxRunLength");
});

test("measureDirection on 'black' relative to just its noun anchors (cat/dog) sees a clean but small pre-nominal sample", () => {
  // "black" always precedes "cat"/"dog" in this corpus -- 4 occurrences, all
  // "before", 0 "after". That's a clean signal, but n=4 is too small to
  // clear the p<0.05 bar on its own (binomial(4,4) = 1/16 = 0.0625) -- an
  // honest consequence of using a real significance test rather than just
  // trusting whichever side has more raw occurrences. The module reports
  // "exchangeable" rather than overclaiming "pre" from too little evidence.
  const result = extractOccurrences(CORPUS, { minAnchorFrequency: 2, maxAnchorFrequency: 8, maxRunLength: 3 });
  const blackBeforeHead = result.occurrences.filter(
    (o) => o.token === "black" && (o.anchor === "cat" || o.anchor === "dog")
  );
  assert.equal(blackBeforeHead.length, 4);
  assert.ok(blackBeforeHead.every((o) => o.side === "before"));
  const direction = measureDirection(blackBeforeHead);
  assert.equal(direction.before, 4);
  assert.equal(direction.after, 0);
  assert.equal(direction.direction, "exchangeable", "n=4 is too small to clear p<0.05 even at 4-0");
});

test("measureDirection on ALL token=='black' occurrences reaches significance once 'sat'/'on' extend the runs past the noun", () => {
  // Runs extend through every adjacent content-band word, not just the
  // immediate noun -- "on" (n=6) and "sat"/"slept" (n=4/2) are themselves
  // content-band, so a run like "black cat sat on" contributes "black"
  // occurrences at distance 2 and 3 too, all still "before" their anchor.
  // Meanwhile "fat black" contributes "black" exactly once per sentence as
  // an "after" occurrence (anchor=fat). With enough total occurrences
  // (n=16, 12 before / 4 after) the skew clears significance -- this is the
  // real, by-design behavior: a token that is sometimes a head and
  // sometimes a modifier contributes real evidence both ways, and more
  // data resolves what a small filtered sample could not.
  const result = extractOccurrences(CORPUS, { minAnchorFrequency: 2, maxAnchorFrequency: 8, maxRunLength: 3 });
  const allBlack = result.occurrences.filter((o) => o.token === "black");
  const direction = measureDirection(allBlack);
  assert.equal(direction.before, 12);
  assert.equal(direction.after, 4);
  assert.equal(direction.direction, "pre");
});

test("measureDirection reports exchangeable on a balanced synthetic split", () => {
  const balanced = [
    { token: "x", anchor: "y", side: "before", distance: 1 },
    { token: "x", anchor: "y", side: "after", distance: 1 },
    { token: "x", anchor: "y", side: "before", distance: 1 },
    { token: "x", anchor: "y", side: "after", distance: 1 },
  ];
  const direction = measureDirection(balanced);
  assert.equal(direction.direction, "exchangeable");
});

test("measureDirection refuses empty material", () => {
  const result = measureDirection([]);
  assert.equal(result.gap, "empty_material");
});

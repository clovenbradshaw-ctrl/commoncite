// eoreader6 · induction/stacks — conformance
//
// induction/attributes.js's `distance` field averages a token's distance
// over EVERY adjacent content-band word it ever occurs next to, which
// smooths out whatever monotonic rank structure exists before induceKinds
// gets a chance to find it (measured on the real live_priors run:
// scripts/induction-live-priors.mjs found one coarse side=before kind and
// no finer sub-structure inside it). This organ recovers rank a different
// way: extract genuinely BOUND stacks (a maximal run of content-band
// tokens, delimited on both sides, not one overlapping window per anchor),
// then ask only about relative POSITION between tokens that actually
// co-occur in the same stack, significance-tested per pair with the exact
// binomial statistic candidates.js's measureDirection already uses.
//
// The critical test below is a POSITIVE CONTROL — missing from every
// earlier induction conformance file, which only ever tested refusal/gap
// paths and real-text smoke behavior, never a case engineered to actually
// contain a recoverable monotonic order. It builds a synthetic corpus
// where SIZE words are always farther from the head than COLOR words
// whenever both co-occur ("the SIZE COLOR NOUN verb"), with no lexicon
// telling the mechanism "size" or "color" mean anything, and checks that
// the recovered ranks actually separate the two classes correctly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractStacks, pairwiseComparisons, monotonicPairs, monotonicRanks, assembleMonotonicTypology } from "../induction/stacks.js";

test("extractStacks refuses undeclared bounds", () => {
  const noBand = extractStacks(["the fat black cat"], { maxStackLength: 3 });
  assert.equal(noBand.gap, "undeclared");
  const noMax = extractStacks(["the fat black cat"], { minAnchorFrequency: 1, maxAnchorFrequency: 5 });
  assert.equal(noMax.gap, "undeclared");
  assert.equal(noMax.what, "maxStackLength");
});

test("extractStacks finds one maximal bound stack, not one overlapping run per anchor", () => {
  const sentences = [
    "the fat black cat sat",
    "the fat black cat slept",
    "the fat black cat sat",
    "the dog ran",
    "the dog barked",
    "the bird flew",
    "the bird sang",
  ];
  // "the" occurs 7x, well above the other tokens (<=3x) -- a real
  // frequency gap this time, not an artifact of an over-small corpus.
  const stacks = extractStacks(sentences, { minAnchorFrequency: 1, maxAnchorFrequency: 5, minStackLength: 2, maxStackLength: 5 });
  assert.equal(stacks.gap, undefined, JSON.stringify(stacks));
  const catStack = stacks.find((s) => s.includes("cat"));
  assert.ok(catStack, "expected a stack containing 'cat'");
  // "sat" (freq 2) is still below maxAnchorFrequency=5, so it stays
  // content-band and the maximal run absorbs it too -- one honest,
  // undeduplicated stack per sentence, not one run per anchor the way
  // candidates.js's overlapping occurrence windows would produce.
  assert.deepEqual(catStack, ["fat", "black", "cat", "sat"]);
  assert.equal(stacks.filter((s) => s.includes("cat")).length, 3);
});

test("extractStacks drops runs shorter than minStackLength or longer than maxStackLength", () => {
  const sentences = ["a b", "a b c d e f"];
  const stacks = extractStacks(sentences, { minAnchorFrequency: 1, maxAnchorFrequency: 10, minStackLength: 2, maxStackLength: 4 });
  // "a b" has length 2 (kept); "a b c d e f" has length 6 (dropped, too long)
  assert.equal(stacks.length, 1);
  assert.deepEqual(stacks[0], ["a", "b"]);
});

// ── positive control: a corpus with a REAL, designed-in monotonic order ────
//
// SIZE words always sit farther from the noun than COLOR words whenever
// both appear together ("the SIZE COLOR NOUN verb") -- this is the actual
// question: can the mechanism recover a known order from raw co-occurrence,
// with no lexicon telling it "size" or "color" mean anything?

const SIZES = ["big", "small", "huge", "tiny"];
const COLORS = ["red", "blue", "black", "white"];
const NOUNS = ["ball", "car", "hat", "bag", "box", "cup"];
const VERBS = ["rolled", "fell", "broke", "gleamed", "vanished", "wobbled"];

const CORPUS = [];
let idx = 0;
for (const size of SIZES) {
  for (const color of COLORS) {
    for (let rep = 0; rep < 8; rep++) {
      const noun = NOUNS[idx % NOUNS.length];
      const verb = VERBS[idx % VERBS.length];
      CORPUS.push(`the ${size} ${color} ${noun} ${verb}`);
      idx++;
    }
  }
}

test("positive control: the pipeline recovers the designed-in monotonic order (color closer to head than size)", () => {
  const stacks = extractStacks(CORPUS, { minAnchorFrequency: 2, maxAnchorFrequency: 200, minStackLength: 2, maxStackLength: 6 });
  assert.equal(stacks.gap, undefined, JSON.stringify(stacks));
  assert.ok(stacks.length > 0);

  // direction is received, not assumed -- "the SIZE COLOR NOUN" is
  // pre-nominal, so headSide is "end" (later stack positions sit closer
  // to the noun/head).
  const comparisons = pairwiseComparisons(stacks, { headSide: "end" });
  assert.equal(comparisons.gap, undefined, JSON.stringify(comparisons));

  const pairs = monotonicPairs(comparisons, { minPairOccurrences: 4 });
  assert.equal(pairs.gap, undefined, JSON.stringify(pairs));
  assert.ok(pairs.length > 0, "expected at least some pairs to clear significance");

  const typology = assembleMonotonicTypology(pairs, { population: "positive-control", direction: "pre" });
  assert.equal(typology.gap, undefined, JSON.stringify(typology));

  // The real assertion: every SIZE word present in the ranks must rank
  // HIGHER (farther from head) than every COLOR word present.
  const sizeRanks = SIZES.filter((s) => s in typology.ranks).map((s) => typology.ranks[s]);
  const colorRanks = COLORS.filter((c) => c in typology.ranks).map((c) => typology.ranks[c]);
  assert.ok(sizeRanks.length > 0, "expected at least one size word to be ranked");
  assert.ok(colorRanks.length > 0, "expected at least one color word to be ranked");
  const maxColorRank = Math.max(...colorRanks);
  const minSizeRank = Math.min(...sizeRanks);
  assert.ok(
    minSizeRank > maxColorRank,
    `expected every size rank > every color rank; got sizes=${JSON.stringify(sizeRanks)} colors=${JSON.stringify(colorRanks)}`
  );
});

test("assembleMonotonicTypology refuses undeclared population and direction", () => {
  const pairs = [{ closer: "a", farther: "b", n: 10, pValue: 0.001 }];
  const noPop = assembleMonotonicTypology(pairs, { direction: "pre" });
  assert.equal(noPop.gap, "undeclared");
  assert.equal(noPop.what, "population");

  const noDir = assembleMonotonicTypology(pairs, { population: "x" });
  assert.equal(noDir.gap, "undeclared");
  assert.equal(noDir.what, "direction");
});

test("a token that never co-occurs with anything gets no rank fabricated for it -- only tokens with real pairwise evidence are ranked", () => {
  // 6 consistent co-occurrences of (a,b) clears p<0.05 (binomial(6,6) ~=
  // 0.0156); "c" never appears in any stack and must get no rank at all.
  const stacks = Array.from({ length: 6 }, () => ["a", "b"]);
  const comparisons = pairwiseComparisons(stacks, { headSide: "end" });
  const pairs = monotonicPairs(comparisons, { minPairOccurrences: 2 });
  assert.equal(pairs.gap, undefined, JSON.stringify(pairs));
  assert.ok(pairs.length > 0);
  const typology = assembleMonotonicTypology(pairs, { population: "x", direction: "pre" });
  assert.equal(typology.gap, undefined, JSON.stringify(typology));
  assert.deepEqual(Object.keys(typology.ranks).sort(), ["a", "b"]);
  assert.equal(typology.ranks["c"], undefined, "a token that never appeared gets no fabricated rank");
});

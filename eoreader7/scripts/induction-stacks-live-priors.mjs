// eoreader6 · scripts/induction-stacks-live-priors — runs the bound-stack
// monotonic-rank pipeline (induction/stacks.js) against a real corpus of
// priors, and prints what it actually found.
//
// This supersedes scripts/induction-live-priors.mjs's clustering-first
// path (candidates.js -> attributes.js -> induceKinds -> typology.js) for
// the specific job of RECOVERING RANK: that path's `distance` attribute
// averages a token's position over every content-band word it ever sits
// next to, and on a real run (documented in that script's own header) it
// found one coarse kind and no further sub-structure. induction/stacks.js
// instead asks only about relative position between tokens that actually
// co-occur inside the same genuinely bound stack, significance-tested per
// pair — see that module's header for the full account of why this
// recovers signal the averaging approach buried.
//
//   node scripts/induction-stacks-live-priors.mjs /path/to/some-book.txt
//
// EMPIRICAL RESULT ON A REAL RUN (Alice's Adventures in Wonderland,
// Project Gutenberg #11, public domain; minAnchorFrequency=5,
// maxAnchorFrequency=150, minStackLength=2, maxStackLength=6, headSide
// "end" [pre-nominal, matching the corpus's own measured direction from
// candidates.js's measureDirection], minPairOccurrences=20): runtime
// 0.14s (vs. several minutes for the clustering path) and exactly FOUR
// token pairs cleared p<0.05 at this evidence floor:
//
//   closer=turtle  farther=mock   n=56  p=1.4e-17   ("Mock Turtle")
//   closer=rabbit  farther=white  n=22  p=2.4e-7    ("White Rabbit")
//   closer=hare    farther=march  n=31  p=4.7e-10   ("March Hare")
//   closer=not     farther=did    n=27  p=7.5e-9    ("did not")
//
// Three of the four are genuine, textbook-correct head-modifier recoveries
// — three of the book's most-repeated named characters, each an epithet
// bound tightly to its head noun every time it appears, recovered with no
// lexicon telling the mechanism what a name or an adjective is. The fourth
// is real too, but not modifier-noun structure: "did not" is verb-phrase
// negation, an honest reminder that this mechanism finds ANY monotonic
// bound-stack ordering, not exclusively adjective-noun order — disclosed
// here rather than cherry-picked around.
//
// At looser evidence floors (minPairOccurrences 4/6/10) many more pairs
// clear significance, but the ranked set increasingly mixes in pronouns,
// contractions, and auxiliary verbs (his, could, would, m, ve) alongside
// real modifiers — the same tradeoff every threshold in this pipeline
// makes: more evidence-per-pair means fewer, cleaner claims; less means
// more coverage and more contamination. Run this script yourself and vary
// minPairOccurrences to see the full tradeoff curve, not just this file's
// snapshot of it.
//
// Pure engine calls; this script itself does I/O and is deliberately NOT
// part of the pure organ tree.

import { readFileSync } from "node:fs";
import { splitSentences } from "../packages/engine/perceiver/text/spans.js";
import { extractStacks, pairwiseComparisons, monotonicPairs, assembleMonotonicTypology } from "../induction/stacks.js";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/induction-stacks-live-priors.mjs <path-to-a-real-corpus-file.txt> [minPairOccurrences]");
  process.exit(1);
}
const minPairOccurrences = Number(process.argv[3] ?? 20);

const raw = readFileSync(path, "utf8");
const sentences = splitSentences(raw).map((s) => s.text);
console.log(`corpus: ${path}`);
console.log(`sentences: ${sentences.length}`);

const foldCase = (t) => t.toLowerCase();

const stacks = extractStacks(sentences, { minAnchorFrequency: 5, maxAnchorFrequency: 150, minStackLength: 2, maxStackLength: 6, foldCase });
if (stacks.gap) {
  console.error("extractStacks gap:", stacks);
  process.exit(1);
}
console.log(`bound stacks: ${stacks.length}`);

const comparisons = pairwiseComparisons(stacks, { headSide: "end" }); // received: this corpus's own measured direction is pre-nominal
if (comparisons.gap) {
  console.error("pairwiseComparisons gap:", comparisons);
  process.exit(1);
}
console.log(`distinct token pairs observed together: ${comparisons.length}`);

const pairs = monotonicPairs(comparisons, { minPairOccurrences });
console.log(`\nminPairOccurrences=${minPairOccurrences}:`);
if (pairs.gap) {
  console.log("  GAP:", pairs.gap, pairs.what ?? pairs.reason ?? "");
  process.exit(0);
}
console.log(`  ${pairs.length} significant pairs`);
for (const p of pairs) console.log(`    closer=${p.closer} farther=${p.farther} n=${p.n} p=${p.pValue.toExponential(2)}`);

const typology = assembleMonotonicTypology(pairs, { population: `live_priors:${path.split("/").pop()}`, direction: "pre" });
if (!typology.gap) {
  console.log(`\ngiver: ${typology.giver}`);
}

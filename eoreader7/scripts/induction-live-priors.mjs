// eoreader6 · scripts/induction-live-priors — runs the full induction
// pipeline (induction/candidates.js -> induction/attributes.js ->
// emergence/kinds.js's induceKinds -> induction/typology.js) against a
// real corpus of priors, and prints what it actually found.
//
// This is an OFFLINE, BATCH tool, not something a reading ever invokes
// live — see induction/typology.js's own header. Measured cost against a
// single ~154KB / 27K-token book (Alice's Adventures in Wonderland, public
// domain): stage-1 certification alone took several minutes. The intended
// use is: run this once (or periodically) against a real corpus of priors,
// and persist whatever typology it certifies as a standing prior — the
// same received-typology seam modifier-order/wals.js's WALS table already
// fills, just from measurement instead of a cited authority.
//
// eoreader6 does not vendor live_priors text itself (II.6, the book test:
// no surrogates for source, and a multi-hundred-KB novel is not a language
// prior in the sense bin/priors/ holds). Point this script at a real
// corpus file on disk:
//
//   node scripts/induction-live-priors.mjs /path/to/some-book.txt
//
// EMPIRICAL RESULT ON A REAL RUN (Alice's Adventures in Wonderland,
// Project Gutenberg #11, public domain; minAnchorFrequency=5,
// maxAnchorFrequency=150, maxRunLength=4, minOccurrences=10,
// minPrevalence=0.3, minKindSize=3, permutations=500, quantile=0.95):
// stage 1 certified exactly ONE kind — 287 of 573 candidate tokens,
// height "above", cohesion 0.788, discriminated by `side=before` — a
// genuine, statistically significant (p<0.0001, n=8703) pre-nominal-vs-not
// split. A second pass re-running induceKinds over just that kind's 287
// members (searching for finer sub-structure — color vs. size vs. quality
// classes) certified ZERO further sub-kinds at the same thresholds. That
// is an honest result, not a failure of the mechanism: the paired Born
// gates refuse to fabricate structure evidence does not support, and
// separating true adjective subclasses from the pronouns, determiners,
// and reporting verbs that also front their anchor in this window
// apparently needs either richer attributes than {side, distance,
// headship} or a far larger prior corpus than one novel. Both are real,
// scoped follow-up work, not something this script or its callers should
// paper over.
//
// Pure engine calls; this script itself does I/O (readFileSync,
// console.log) and is deliberately NOT part of the pure organ tree.

import { readFileSync } from "node:fs";
import { splitSentences } from "../packages/engine/perceiver/text/spans.js";
import { extractOccurrences } from "../induction/candidates.js";
import { toAttributeRecords } from "../induction/attributes.js";
import { induceKinds } from "../packages/engine/emergence/kinds.js";
import { assembleTypology } from "../induction/typology.js";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/induction-live-priors.mjs <path-to-a-real-corpus-file.txt>");
  process.exit(1);
}

const raw = readFileSync(path, "utf8");
const sentences = splitSentences(raw).map((s) => s.text);
console.log(`corpus: ${path}`);
console.log(`sentences: ${sentences.length}`);

const foldCase = (t) => t.toLowerCase();

const occResult = extractOccurrences(sentences, {
  minAnchorFrequency: 5,
  maxAnchorFrequency: 150,
  maxRunLength: 4,
  foldCase,
});
if (occResult.gap) {
  console.error("extractOccurrences gap:", occResult);
  process.exit(1);
}
console.log(`occurrences: ${occResult.occurrences.length}`);

const records = toAttributeRecords(occResult.occurrences, { minOccurrences: 10 });
if (records.gap) {
  console.error("toAttributeRecords gap:", records);
  process.exit(1);
}
console.log(`attribute records (distinct modifier-candidate tokens): ${records.length}`);

const population = `live_priors:${path.split("/").pop()}`;
const kinds = induceKinds(records, {
  population,
  minPrevalence: 0.3,
  minKindSize: 3,
  permutations: 500,
  quantile: 0.95,
  seed: 1,
  reseeds: 5,
});
console.log(`kinds certified: ${kinds.length}`);
for (const k of kinds) {
  console.log(`  - ${k.members.length} members, height ${k.height}, cohesion ${k.cohesion.toFixed(3)}, core ${k.core?.field_id}`);
}

const typology = assembleTypology(kinds, occResult.occurrences, { population });
console.log("\ntypology:");
if (typology.gap) {
  console.log("  GAP:", typology.gap, typology.reason ?? "");
} else {
  console.log("  direction:", typology.direction);
  console.log("  giver:", typology.giver);
  console.log("  excludedKinds:", typology.excludedKinds);
}

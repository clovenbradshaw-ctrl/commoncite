// native/eval/causal-extraction.mjs — what a reader reading IN ORDER extracts,
// against what a batch analyzer with full lookahead extracts.
//
// extraction-overview.mjs calls discoverRelationVocab over the WHOLE text at
// once and extracts every sentence with the resulting vocabulary. That is not
// reading: sentence 12 is extracted using evidence from sentence 9,000.
// READING-POLICY P2 stage 2 states the commitment it violates — a conditional
// null "built only from material already read (groundUpTo never slices
// forward)" — and P1 makes causality the load-bearing rule of the whole
// document.
//
// The causal arm here is the REAL perceiver (createCausalTextPerceiver),
// stepped encounter by encounter in order, exactly as the recursive reader
// drives it: vocabulary refreshes every `refreshEvery` sentences from the
// material read SO FAR, and each sentence is extracted with the vocabulary as
// it stood AT THAT MOMENT — never revisited when later evidence arrives.
//
// The gap between the two arms is the price of causality, and it is a fact
// about this reader worth knowing precisely rather than assuming either way.
//
// Usage: node native/eval/causal-extraction.mjs <book.txt>...

import fs from "node:fs";
import { stripContainer, splitSentences } from "../adapters/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../adapters/text/material.js";
import { extractSurfaces } from "../adapters/text/surfaces.js";
import { discoverRelationVocab, extractRelations } from "../adapters/text/relations.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";

const MIN_SURFACES = 2;
const REFRESH_EVERY = 25;
const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));

function lookahead(sentences) {
  const text = sentences.map((s) => s.text).join("\n");
  const closed = functionWordSet(buildFrequencyTable(tokenize(text)));
  const surfaces = extractSurfaces(sentences, { functionWords: closed });
  const candidates = discoverRelationVocab(text, { surfaces, functionWords: closed, minSurfaces: 1, posPrior: POS_PRIOR }).candidates ?? [];
  const verbs = new Set(candidates.filter((c) => c.verbDominant !== false && (c.surfaceForms ?? []).length >= MIN_SURFACES).map((c) => c.verb));
  const relations = sentences.flatMap((s) => extractRelations(s.text, { verbs, functionWords: closed }));
  return { verbs: verbs.size, relations: relations.length, verbSet: verbs };
}

async function causal(stripped) {
  const perceiver = createCausalTextPerceiver({ minRelationSurfaces: MIN_SURFACES, refreshEvery: REFRESH_EVERY, posPrior: POS_PRIOR });
  const encounters = textEncounters(stripped.text, { source: "causal", offset: stripped.offset });
  let edges = 0, referents = 0;
  const verbSet = new Set();
  for (const enc of encounters) {
    for (const candidate of (await perceiver.perceive(enc, {})) ?? []) {
      for (const edge of candidate.candidate?.hyperedges ?? []) { edges += 1; if (edge.relation) verbSet.add(edge.relation); }
      referents += (candidate.candidate?.graphEntries ?? []).filter((x) => x?.schema === "EOReferent@1").length;
    }
  }
  return { verbs: verbSet.size, relations: edges, verbSet };
}

async function main() {
  const paths = process.argv.slice(2);
  if (!paths.length) throw new TypeError("usage: node native/eval/causal-extraction.mjs <book.txt>...");
  const books = [];
  for (const path of paths) {
    const stripped = stripContainer(fs.readFileSync(path, "utf8"));
    const sentences = splitSentences(stripped.text);
    console.error(`${path.split("/").pop()}: ${sentences.length} sentences...`);
    const ahead = lookahead(sentences);
    const inOrder = await causal(stripped);
    const onlyAhead = [...ahead.verbSet].filter((v) => !inOrder.verbSet.has(v));
    books.push({
      book: path.split("/").pop(),
      sentences: sentences.length,
      lookahead: { verbs: ahead.verbs, relations: ahead.relations },
      causal: { verbs: inOrder.verbs, relations: inOrder.relations },
      causalVerbShare: Number((inOrder.verbs / Math.max(1, ahead.verbs)).toFixed(3)),
      causalRelationShare: Number((inOrder.relations / Math.max(1, ahead.relations)).toFixed(3)),
      verbsOnlyLookaheadFinds: onlyAhead.slice(0, 15),
    });
  }
  console.log(JSON.stringify({
    schema: "EOCausalExtraction@1",
    declared: { minSurfaces: MIN_SURFACES, refreshEvery: REFRESH_EVERY, posPrior: "bin/priors/pos/en-ud-ewt.json — refuses only" },
    note: "lookahead is NOT reading: it extracts every sentence with vocabulary derived from the whole book, including material after that sentence. causal steps the real perceiver in order; a sentence is extracted with the vocabulary as it stood at that moment and is never revisited.",
    books,
  }, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });

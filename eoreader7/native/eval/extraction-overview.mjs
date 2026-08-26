// native/eval/extraction-overview.mjs — what this reader can actually extract
// from a whole book, stage by stage.
//
// WHOLE BOOKS ONLY. discoverRelationVocab measures recurrence of a candidate
// verb across DISTINCT capitalized surfaces over the material it is given;
// that is a whole-book statistic which COLLAPSES under truncation rather than
// degrading (Dracula at 7%: 3 recurring verbs; Dracula whole: 93 admitted).
// See native/eval/results/vocabulary-scale-FINDING.md. This driver takes no
// --limit for that reason.
//
// Reports the funnel, because the interesting fact is WHERE candidates are
// lost, not the final number:
//
//   surfaces      blind capitalized-run detection (surfaces.js)
//   referents     witnessed admission — binomial test + IQR fences
//   candidates    the token following a referent surface: the slot SVO order
//                 puts a verb in, with the surface standing as subject
//   grammar       the received POS prior REFUSES non-verbs here and may never
//                 admit one (READING-POLICY P2: statistics from the material,
//                 not lookup lists; P3: never patch a missing prior by
//                 loosening an engine gate)
//   verbs         admitted: recurs after >= minSurfaces DISTINCT surfaces —
//                 "only a recurring difference is testimony"
//   relations     SVO triples extracted with that admitted vocabulary
//
// Usage: node native/eval/extraction-overview.mjs <book.txt>...

import fs from "node:fs";
import { stripContainer, splitSentences } from "../adapters/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../adapters/text/material.js";
import { extractSurfaces, discoverReferents } from "../adapters/text/surfaces.js";
import { discoverRelationVocab, extractRelations } from "../adapters/text/relations.js";

const MIN_SURFACES = 2; // the engine's own recurrence discipline, declared by the caller
const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));

function overview(path) {
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  if (!stripped.looks_like_material) throw new Error(`${path} does not look like readable material`);
  const sentences = splitSentences(stripped.text);
  const text = sentences.map((s) => s.text).join("\n");
  const words = tokenize(text);
  const closed = functionWordSet(buildFrequencyTable(words));
  const surfaces = extractSurfaces(sentences, { functionWords: closed });
  const discovered = discoverReferents(surfaces);
  const referents = new Set((discovered.events ?? []).filter((e) => e.type === "DEF.admit").map((e) => e.referent_id));

  const candidates = discoverRelationVocab(text, { surfaces, functionWords: closed, minSurfaces: 1, posPrior: POS_PRIOR }).candidates ?? [];
  const grammarSurvives = candidates.filter((c) => c.verbDominant !== false);
  const admitted = grammarSurvives.filter((c) => (c.surfaceForms ?? []).length >= MIN_SURFACES);
  const verbs = new Set(admitted.map((c) => c.verb));
  const relations = sentences.flatMap((s) => extractRelations(s.text, { verbs, functionWords: closed }));

  return {
    book: path.split("/").pop(),
    sentences: sentences.length,
    words: words.length,
    surfaces: surfaces.length,
    referents: referents.size,
    candidates: candidates.length,
    grammarSurvives: grammarSurvives.length,
    verbsAdmitted: verbs.size,
    relations: relations.length,
    relationsPerThousandWords: Number((1000 * relations.length / Math.max(1, words.length)).toFixed(1)),
    topVerbs: admitted.sort((a, b) => b.surfaceForms.length - a.surfaceForms.length).slice(0, 12)
      .map((c) => ({ verb: c.verb, distinctSurfaces: c.surfaceForms.length })),
  };
}

const paths = process.argv.slice(2);
if (!paths.length) throw new TypeError("usage: node native/eval/extraction-overview.mjs <book.txt>...");
console.log(JSON.stringify({
  schema: "EOExtractionOverview@1",
  declared: { minSurfaces: MIN_SURFACES, posPrior: "bin/priors/pos/en-ud-ewt.json — refuses only, never admits", scope: "whole books; this driver takes no --limit" },
  books: paths.map(overview),
}, null, 1));

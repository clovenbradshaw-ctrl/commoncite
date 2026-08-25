// eoreader6 · scripts/experiments/export-filler-occurrences — EXPERIMENTAL.
//
// Exports every REAL occurrence of a discovered filler, each with its own
// actual containing sentence, so a POS tag can be assigned in situ per
// occurrence rather than once in a synthetic carrier sentence (which forces
// a single answer by construction — the carrier sentence's own grammar
// decides the tag, not the word's real distribution of uses).
//
// This is the data superposition-with-real-collapse needs: a per-word
// EMPIRICAL tag distribution across every real context it was seen in,
// never a single guess from one invented sentence.
//
// filler-occurrences.json IS nothing but corpus sentence excerpts — it
// carries no result of its own, only the input the (external, not-committed)
// POS-tagging pass needed. It is gitignored (goldens/agency-civic/data/
// .gitignore) for exactly the reason eoPriors::pocket.js's Pocket@1 firewall
// forbids a `sentence`/`text`/`excerpt` key: that content belongs with its
// corpus, not duplicated into a committed golden. Regenerate it locally
// whenever the downstream analysis needs it again; only the DERIVED output
// of that analysis (goldens/agency-civic/data/pos-superposition.json — tag
// distributions, no source text) is committed.
//
// Usage: node scripts/experiments/export-filler-occurrences.mjs <pocket-dir[,dir2,...]> [docLimit] [topNVerbs]

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { splitSentences, deriveAbbreviations } from "../../packages/engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../../packages/engine/perceiver/text/material.js";
import { extractSurfaces } from "../../packages/engine/perceiver/text/surfaces.js";
import { discoverRelationVocab } from "../../packages/engine/perceiver/text/relations.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const POCKET_DIR = process.argv[2];
const LIMIT = process.argv[3] ? Number(process.argv[3]) : Infinity;
const TOP_N_VERBS = process.argv[4] ? Number(process.argv[4]) : 12;
const WINDOW = 4;

const stripFrontmatter = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, "");
const looksLikeDebris = (tok) => /[\d/]/.test(tok) || tok.length <= 1;
const RECEIVED_FUNCTION_WORDS = new Set([
  "a", "an", "the", "all", "any", "each", "every", "no", "some", "both", "either", "neither", "other", "another", "such",
  "this", "that", "these", "those", "it", "its", "they", "them", "their", "he", "him", "his", "she", "her", "we", "us", "our", "you", "your", "i", "my",
  "and", "or", "but", "nor", "so", "yet", "if", "unless", "because", "although", "though", "while", "when", "whether", "as",
  "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "can", "could", "may", "might", "must", "shall", "should", "will", "would",
  "of", "to", "in", "on", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after",
  "above", "below", "from", "up", "down", "over", "under", "again", "further", "than", "upon", "within", "without", "per",
  "not", "only", "own", "same", "too", "very", "more", "most", "less", "least", "which", "who", "whom", "what",
]);

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(txt|md)$/.test(entry)) out.push(full);
  }
  return out;
};

const files = POCKET_DIR.split(",").flatMap((root) => walk(root)).slice(0, LIMIT);
console.log(`Folding ${files.length} documents`);

let pooledWords = [];
const perDocSentences = new Map();
const perDocSurfaces = new Map();
const allTexts = [];
for (const file of files) {
  const text = stripFrontmatter(readFileSync(file, "utf8"));
  allTexts.push(text);
  for (const w of tokenize(text)) pooledWords.push(w);
  perDocSentences.set(file, splitSentences(text, { abbreviations: deriveAbbreviations(text) }));
}
const pocketFunctionWords = functionWordSet(buildFrequencyTable(pooledWords));
const isFunctionWord = (w) => pocketFunctionWords.has(w) || RECEIVED_FUNCTION_WORDS.has(w);

for (let i = 0; i < files.length; i++) {
  const sentences = perDocSentences.get(files[i]);
  if (!sentences.length) continue;
  perDocSurfaces.set(files[i], extractSurfaces(sentences, { functionWords: pocketFunctionWords, abbreviations: deriveAbbreviations(allTexts[i]) }));
}
const allSurfaces = [...perDocSurfaces.values()].flat();
const { verbs, candidates } = discoverRelationVocab(allTexts.join("\n\n"), { surfaces: allSurfaces, functionWords: pocketFunctionWords, minSurfaces: 2 });
const topVerbs = candidates.slice(0, TOP_N_VERBS).map((c) => c.verb);
console.log(`verb vocabulary: ${verbs.size}; top ${topVerbs.length}: ${topVerbs.join(", ")}`);

// filler(norm) -> [{ sentence, verb, position }]
const occurrences = new Map();

for (const file of files) {
  const sentences = perDocSentences.get(file);
  if (!sentences.length) continue;

  for (const sent of sentences) {
    const raw = sent.text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? [];
    const lower = raw.map((t) => t.toLowerCase());

    for (let k = 0; k < raw.length; k++) {
      if (!topVerbs.includes(lower[k])) continue;
      for (let off = -WINDOW; off <= WINDOW; off++) {
        if (off === 0) continue;
        const j = k + off;
        if (j < 0 || j >= raw.length) continue;
        if (verbs.has(lower[j]) || isFunctionWord(lower[j]) || looksLikeDebris(raw[j])) continue;
        const norm = lower[j];
        if (!occurrences.has(norm)) occurrences.set(norm, []);
        const list = occurrences.get(norm);
        if (list.length < 40) list.push({ sentence: sent.text.slice(0, 300), verb: lower[k], position: off < 0 ? "before" : "after" }); // cap per filler — enough for a real distribution, not the whole corpus
      }
    }
  }
}

// Only fillers with enough real occurrences to build a distribution from.
const MIN_OCC = 3;
const out = {};
for (const [norm, list] of occurrences) {
  if (list.length >= MIN_OCC) out[norm] = list;
}

console.log(`${Object.keys(out).length} fillers with >=${MIN_OCC} real occurrences (of ${occurrences.size} total)`);

mkdirSync(join(HERE, "..", "..", "goldens", "agency-civic", "data"), { recursive: true });
const outPath = join(HERE, "..", "..", "goldens", "agency-civic", "data", "filler-occurrences.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`wrote ${outPath}`);

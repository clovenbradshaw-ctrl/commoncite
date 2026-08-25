// eoreader6 · scripts/experiments/role-fold-kinds-v3 — EXPERIMENTAL, unwired.
//
// Two fixes over v2, both concrete defects found by running v2 and reading
// its actual output rather than trusting its code:
//
// 1. POOLED FUNCTION WORDS, NOT PER-DOCUMENT. v2 derived functionWordSet
//    separately for each ~5000-word document. Zipf separation needs volume;
//    on one short document, closed-class words ("all," "any," "are," "as,"
//    "be," "because"...) often don't clear the frequency threshold that
//    would flag them, and leaked through as filler candidates — visibly, in
//    a 109-member cluster that was mostly determiners and auxiliaries mixed
//    with real content nouns. Pooling the frequency table across the WHOLE
//    pocket before deriving functionWords gives Zipf separation the sample
//    size it needs, and matches how the pocket is actually meant to be used
//    (one population, not N independent ones).
//
// 2. VERB-IDENTITY AS A SECOND ATTRIBUTE AXIS, ALONGSIDE POSITION. v2's
//    fillers carried only WHERE they sat relative to a verb (position
//    buckets). The nesting probe (role-fold-kinds-nest.mjs) found that
//    clusters built purely on position have almost no other attribute
//    variance to sub-divide on — most fillers occur in exactly one bucket,
//    so profileJaccard has nothing left once position alone has grouped
//    them. Adding WHICH verbs a filler recurred with (capped to the
//    TOP_VERBS most frequent discovered verbs in the pocket, to keep the
//    attribute space bounded) gives a second, cross-cutting axis: two
//    fillers that keep appearing with the same predicates should cohere
//    even if their position varies, which is closer to what a semantic
//    role actually is than position alone.
//
// Usage: node scripts/experiments/role-fold-kinds-v3.mjs <pocket-dir> [limit]

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { splitSentences, deriveAbbreviations } from "../../packages/engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../../packages/engine/perceiver/text/material.js";
import { extractSurfaces } from "../../packages/engine/perceiver/text/surfaces.js";
import { discoverRelationVocab } from "../../packages/engine/perceiver/text/relations.js";
import { induceKinds } from "../../packages/engine/emergence/kinds.js";
import { isGap } from "../../nul/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const POCKET_DIR = process.argv[2];
const LIMIT = process.argv[3] ? Number(process.argv[3]) : Infinity;
const WINDOW = 4;
const TOP_VERBS = Number(process.env.TOP_VERBS ?? 40);

if (!POCKET_DIR) {
  console.error("usage: node role-fold-kinds-v3.mjs <pocket-dir> [doc-limit]");
  process.exit(1);
}

const looksLikeDebris = (tok) => /[\d/]/.test(tok) || tok.length <= 1;

// A RECEIVED PRIOR, DISCLOSED AS ONE (II.2 — material knowledge must name
// its giver): standard English closed-class words (determiners, auxiliary
// and modal verbs, coordinating/subordinating conjunctions, common
// prepositions, personal/demonstrative pronouns). NOT derived from this
// pocket. `material.js::functionWordSet` is Zipf-derived and, measured
// directly against this exact pocket, catches only 13 words (the top of the
// frequency distribution: "of, and, the, be, to, for, in, on, a, that, is,
// or, branch") — correct behavior for what it's FOR (the small,
// wildly-overrepresented core), not a bug, but it was never going to catch
// mid-frequency closed-class words like "any," "each," "because," "would" —
// those are genuinely function words, just not frequency outliers. Using a
// received list for THOSE, on top of the derived set for the frequency
// outliers, is the same two-tier discipline relations.js's own
// NEGATION_WORDS already uses (Amendment V: a small closed-class set is a
// legitimate received prior, not content the engine must mine for itself).
const RECEIVED_FUNCTION_WORDS = new Set([
  "a", "an", "the", "all", "any", "each", "every", "no", "some", "both", "either", "neither", "other", "another", "such",
  "this", "that", "these", "those", "it", "its", "they", "them", "their", "he", "him", "his", "she", "her", "we", "us", "our", "you", "your", "i", "my",
  "and", "or", "but", "nor", "so", "yet", "if", "unless", "because", "although", "though", "while", "when", "whether", "as",
  "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "can", "could", "may", "might", "must", "shall", "should", "will", "would",
  "of", "to", "in", "on", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after",
  "above", "below", "from", "up", "down", "over", "under", "again", "further", "than", "upon", "within", "without", "per",
  "not", "only", "own", "same", "too", "very", "more", "most", "less", "least",
  "which", "who", "whom", "what",
]);
const bucketOf = (offset) => `${Math.abs(offset) <= 2 ? "near" : "far"}_${offset < 0 ? "before" : "after"}`;

// YAML frontmatter (world-legislation's own format: `---\nkey: val\n...\n---`)
// is container, not content — same discipline goldens/cast/read.mjs already
// applies to Project Gutenberg's licence header. Stripped before folding,
// never read as prose.
const stripFrontmatter = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, "");

// Multiple pocket roots, recursive (world-legislation nests one directory
// per jurisdiction; federal-register-fulltext is flat) — walked rather than
// assumed flat.
const POCKET_ROOTS = POCKET_DIR.split(",");
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(txt|md)$/.test(entry)) out.push(full);
  }
  return out;
};
const files = POCKET_ROOTS.flatMap((root) => walk(root)).slice(0, LIMIT);
console.log(`Pass 1/2: pooling function words + verb vocabulary across ${files.length} documents (roots: ${POCKET_ROOTS.join(", ")})\n`);

// ── PASS 1: pool frequency table + relation vocab across the WHOLE pocket ──
const allTexts = [];
let pooledWords = [];
const perDocSentences = new Map(); // file -> sentences (avoid re-splitting in pass 2)
const perDocSurfaces = new Map();

for (const file of files) {
  const text = stripFrontmatter(readFileSync(file, "utf8"));
  allTexts.push(text);
  for (const w of tokenize(text)) pooledWords.push(w); // NOT push(...tokenize(text)) — spreads a large document's tokens as individual call arguments and blows the call stack
  const abbreviations = deriveAbbreviations(text);
  const sentences = splitSentences(text, { abbreviations });
  perDocSentences.set(file, sentences);
}

const pooledFrequency = buildFrequencyTable(pooledWords);
const functionWords = functionWordSet(pooledFrequency);
console.log(`pooled vocabulary: ${pooledWords.length} tokens, ${functionWords.size} flagged as function words\n`);

// Verb vocabulary pooled the same way discoverRelationVocab already pools
// evidence WITHIN one document (a verb needs >=minSurfaces distinct
// surfaces) — here the "document" handed to it is the whole pocket's text,
// concatenated, so a verb's surface-recurrence evidence is pocket-wide
// rather than fragmented per-file.
let pooledVerbCandidates = [];
for (let i = 0; i < files.length; i++) {
  const sentences = perDocSentences.get(files[i]);
  if (!sentences.length) continue;
  const surfaces = extractSurfaces(sentences, { functionWords, abbreviations: deriveAbbreviations(allTexts[i]) });
  perDocSurfaces.set(files[i], surfaces);
}
const allSurfaces = [...perDocSurfaces.values()].flat();
const { verbs, candidates } = discoverRelationVocab(allTexts.join("\n\n"), { surfaces: allSurfaces, functionWords, minSurfaces: 2 });
console.log(`pooled verb vocabulary: ${verbs.size} verbs (minSurfaces=2, pocket-wide)`);

const topVerbs = new Set(candidates.slice(0, TOP_VERBS).map((c) => c.verb));
console.log(`tracking co-occurrence with the top ${topVerbs.size} most-recurring verbs\n`);

// ── PASS 2: window each document against the shared vocab ──────────────────
console.log(`Pass 2/2: windowing (window=${WINDOW})\n`);
const fillerStats = new Map(); // norm -> { surface, buckets: Map(bucket -> Set(verb)), verbsSeen: Set(verb) }
let totalVerbOccurrences = 0;
let docsWithVerbs = 0;

for (let i = 0; i < files.length; i++) {
  const sentences = perDocSentences.get(files[i]);
  if (!sentences.length || !verbs.size) continue;
  let hitDoc = false;

  for (const sent of sentences) {
    const raw = sent.text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? [];
    const lower = raw.map((t) => t.toLowerCase());

    for (let k = 0; k < raw.length; k++) {
      if (!verbs.has(lower[k])) continue;
      totalVerbOccurrences++;
      hitDoc = true;
      for (let off = -WINDOW; off <= WINDOW; off++) {
        if (off === 0) continue;
        const j = k + off;
        if (j < 0 || j >= raw.length) continue;
        if (verbs.has(lower[j]) || functionWords.has(lower[j]) || RECEIVED_FUNCTION_WORDS.has(lower[j]) || looksLikeDebris(raw[j])) continue;
        const bucket = bucketOf(off);
        const norm = lower[j];
        if (!fillerStats.has(norm)) fillerStats.set(norm, { surface: raw[j], buckets: new Map(), verbsSeen: new Set() });
        const f = fillerStats.get(norm);
        if (!f.buckets.has(bucket)) f.buckets.set(bucket, new Set());
        f.buckets.get(bucket).add(lower[k]);
        if (topVerbs.has(lower[k])) f.verbsSeen.add(lower[k]);
      }
    }
  }
  if (hitDoc) docsWithVerbs++;
}

console.log(`${totalVerbOccurrences} verb occurrences across ${docsWithVerbs}/${files.length} documents`);
console.log(`${fillerStats.size} distinct fillers observed in some window\n`);

// ── BUILD RECORDS: position buckets + top-verb co-occurrence, both attribute axes ──
const A = (field_id, count) => ({ field_id, value_type: "boolean", count });
const MIN_DISTINCT_PREDICATES = Number(process.env.MIN_DISTINCT_PREDICATES ?? 4);

const records = [];
for (const [norm, f] of fillerStats) {
  const attrs = [];
  let totalDistinct = 0;
  for (const [bucket, verbSet] of f.buckets) {
    attrs.push(A(`pos:${bucket}`, verbSet.size));
    totalDistinct += verbSet.size;
  }
  for (const v of f.verbsSeen) attrs.push(A(`verb:${v}`, 1));
  if (/^\p{Lu}/u.test(f.surface.trim())) attrs.push(A("capitalized", 1));
  if (totalDistinct < MIN_DISTINCT_PREDICATES) continue;
  records.push({ id: `filler:${norm}`, label: f.surface, attributes: attrs });
}

console.log(`${records.length} fillers clear the recurring-difference floor (>=${MIN_DISTINCT_PREDICATES} distinct verbs)\n`);

if (records.length < 3) {
  console.log("Too few qualifying fillers — refusing rather than reporting a degenerate result.");
  process.exit(0);
}

const OPTS = {
  population: `federal-register-fold-positions-v3-${files.length}docs`,
  minPrevalence: 0.15,
  minKindSize: 3,
  permutations: Number(process.env.PERMUTATIONS ?? 200),
  quantile: 0.95,
  reseeds: Number(process.env.RESEEDS ?? 24),
  seed: 42,
};

console.log("induceKinds options:", OPTS, "\n");
const t0 = Date.now();
const kinds = induceKinds(records, OPTS);
console.log(`induceKinds took ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

if (isGap(kinds) || kinds.length === 0) {
  console.log("No kind survived both Born gates — refused, not forced.");
} else {
  console.log(`${kinds.length} kind(s) survived:\n`);
  for (const k of kinds) {
    console.log(`── kind "${k.label}" (${k.members.length} members, height=${k.height}) ──`);
    console.log("   " + k.members.slice(0, 20).map((m) => records.find((r) => r.id === m)?.label ?? m).join(", "));
    console.log("");
  }
}

mkdirSync(join(HERE, "..", "..", "goldens", "agency-civic", "data"), { recursive: true });
const outPath = join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-kinds-v3.experiment.json");
writeFileSync(outPath, JSON.stringify({ opts: OPTS, docsProcessed: files.length, docsWithVerbs, totalVerbOccurrences, fillerCount: fillerStats.size, recordCount: records.length, topVerbCount: topVerbs.size, kinds, records }, null, 2));
console.log(`wrote ${outPath}`);

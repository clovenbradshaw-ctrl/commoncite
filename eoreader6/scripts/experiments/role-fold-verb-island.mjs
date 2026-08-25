// eoreader6 · scripts/experiments/role-fold-verb-island — EXPERIMENTAL,
// unwired.
//
// v2/v3 both asked for cross-verb abstraction from the start: pool fillers
// across hundreds or thousands of distinct discovered verbs, then ask
// induceKinds whether a subject-shaped class falls out across ALL of them
// at once. That is asking for the late-stage generalization Tomasello's
// verb-island evidence says comes SLOWLY, by accumulation across items —
// before ever checking whether the early-stage, per-verb structure exists
// at all. Children have per-item frames (cutter/cuttee for "cut," separately
// for "draw") long before anything general.
//
// This script asks the smaller, prior question: for ONE frequent verb, on
// its own, do its own near-before fillers cohere into a class distinctly
// from its own near-after fillers — a verb island, not yet abstracted
// across verbs. Function words are used the way the acquisition literature
// says they actually work — as POSITIVE anchors ("the ___" flags a noun
// follows), not just an exclusion filter — by keeping a filler's *preceding*
// function word (if any) as part of its profile, rather than only stripping
// function words out of candidacy.
//
// Usage: node scripts/experiments/role-fold-verb-island.mjs <pocket-dir[,dir2,...]> [docLimit] [topNVerbs]

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
const TOP_N_VERBS = process.argv[4] ? Number(process.argv[4]) : 12;
const WINDOW = 4;

if (!POCKET_DIR) {
  console.error("usage: node role-fold-verb-island.mjs <pocket-dir[,dir2,...]> [docLimit] [topNVerbs]");
  process.exit(1);
}

const stripFrontmatter = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, "");
const looksLikeDebris = (tok) => /[\d/]/.test(tok) || tok.length <= 1;
const bucketOf = (offset) => `${Math.abs(offset) <= 2 ? "near" : "far"}_${offset < 0 ? "before" : "after"}`;

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
const isFunctionWord = (w, pocketFunctionWords) => pocketFunctionWords.has(w) || RECEIVED_FUNCTION_WORDS.has(w);

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
console.log(`Folding ${files.length} documents\n`);

// ── PASS 1: pool function words + verb vocabulary, ranked by frequency ─────
let pooledWords = [];
const perDocSentences = new Map();
const perDocSurfaces = new Map();
const allTexts = [];

for (const file of files) {
  const text = stripFrontmatter(readFileSync(file, "utf8"));
  allTexts.push(text);
  for (const w of tokenize(text)) pooledWords.push(w);
  const abbreviations = deriveAbbreviations(text);
  const sentences = splitSentences(text, { abbreviations });
  perDocSentences.set(file, sentences);
}

const pocketFunctionWords = functionWordSet(buildFrequencyTable(pooledWords));
console.log(`pooled vocabulary: ${pooledWords.length} tokens, ${pocketFunctionWords.size} Zipf function words`);

for (let i = 0; i < files.length; i++) {
  const sentences = perDocSentences.get(files[i]);
  if (!sentences.length) continue;
  const surfaces = extractSurfaces(sentences, { functionWords: pocketFunctionWords, abbreviations: deriveAbbreviations(allTexts[i]) });
  perDocSurfaces.set(files[i], surfaces);
}
const allSurfaces = [...perDocSurfaces.values()].flat();
const { verbs, candidates } = discoverRelationVocab(allTexts.join("\n\n"), { surfaces: allSurfaces, functionWords: pocketFunctionWords, minSurfaces: 2 });
console.log(`pooled verb vocabulary: ${verbs.size} verbs\n`);

const topVerbs = candidates.slice(0, TOP_N_VERBS).map((c) => c.verb);
console.log(`Testing the top ${topVerbs.length} most-recurring verbs as separate islands: ${topVerbs.join(", ")}\n`);

// ── PASS 2: for EACH top verb, collect ONLY its own fillers ────────────────
const islandFillers = new Map(topVerbs.map((v) => [v, new Map()])); // verb -> (norm filler -> {surface, buckets, precedingFnWord})

for (const file of files) {
  const sentences = perDocSentences.get(file);
  if (!sentences.length) continue;

  for (const sent of sentences) {
    const raw = sent.text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? [];
    const lower = raw.map((t) => t.toLowerCase());

    for (let k = 0; k < raw.length; k++) {
      if (!islandFillers.has(lower[k])) continue; // only tracking the top-N verbs
      const island = islandFillers.get(lower[k]);
      for (let off = -WINDOW; off <= WINDOW; off++) {
        if (off === 0) continue;
        const j = k + off;
        if (j < 0 || j >= raw.length) continue;
        if (verbs.has(lower[j]) || isFunctionWord(lower[j], pocketFunctionWords) || looksLikeDebris(raw[j])) continue;
        const bucket = bucketOf(off);
        const norm = lower[j];
        // POSITIVE anchor, not just exclusion: does a function word sit
        // immediately before this filler ("the ___", "a ___")? Kept as an
        // attribute, the Mintz/frame-detector signal, rather than thrown
        // away once its exclusion job is done.
        const immediatelyBefore = j - 1 >= 0 ? lower[j - 1] : null;
        const anchor = immediatelyBefore && isFunctionWord(immediatelyBefore, pocketFunctionWords) ? immediatelyBefore : null;

        if (!island.has(norm)) island.set(norm, { surface: raw[j], buckets: new Map(), anchors: new Set() });
        const f = island.get(norm);
        if (!f.buckets.has(bucket)) f.buckets.set(bucket, 0);
        f.buckets.set(bucket, f.buckets.get(bucket) + 1);
        if (anchor) f.anchors.add(anchor);
      }
    }
  }
}

// ── induceKinds PER VERB ISLAND ──────────────────────────────────────────
const A = (field_id, count) => ({ field_id, value_type: "boolean", count });
const MIN_OCCURRENCES = Number(process.env.MIN_OCCURRENCES ?? 3);

const OPTS_BASE = {
  minPrevalence: 0.15,
  minKindSize: 3,
  permutations: Number(process.env.PERMUTATIONS ?? 100),
  quantile: 0.95,
  reseeds: Number(process.env.RESEEDS ?? 12),
  seed: 42,
};

const results = [];
for (const verb of topVerbs) {
  const fillers = islandFillers.get(verb);
  const records = [];
  for (const [norm, f] of fillers) {
    const total = [...f.buckets.values()].reduce((s, n) => s + n, 0);
    if (total < MIN_OCCURRENCES) continue;
    const attrs = [];
    for (const [bucket, n] of f.buckets) attrs.push(A(`pos:${bucket}`, n));
    for (const a of f.anchors) attrs.push(A(`anchor:${a}`, 1));
    if (/^\p{Lu}/u.test(f.surface.trim())) attrs.push(A("capitalized", 1));
    records.push({ id: `filler:${norm}`, label: f.surface, attributes: attrs });
  }

  if (records.length < OPTS_BASE.minKindSize) {
    console.log(`"${verb}": ${records.length} qualifying fillers — too few, skipped`);
    results.push({ verb, fillerCount: records.length, kinds: [] });
    continue;
  }

  const opts = { ...OPTS_BASE, population: `verb-island:${verb}` };
  const t0 = Date.now();
  const kinds = induceKinds(records, opts);
  const ms = Date.now() - t0;
  const survived = isGap(kinds) ? [] : kinds;
  console.log(`"${verb}": ${records.length} fillers -> induceKinds ${ms}ms -> ${survived.length} kind(s)`);
  for (const k of survived) {
    console.log(`   kind "${k.label}" (${k.members.length} members, height=${k.height}): ${k.members.slice(0, 12).map((m) => records.find((r) => r.id === m)?.label ?? m).join(", ")}`);
  }
  results.push({ verb, fillerCount: records.length, kinds: survived, records });
}

mkdirSync(join(HERE, "..", "..", "goldens", "agency-civic", "data"), { recursive: true });
const outPath = join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-verb-island.experiment.json");
writeFileSync(outPath, JSON.stringify({ opts: OPTS_BASE, docsProcessed: files.length, topVerbs, results }, null, 2));
console.log(`\nwrote ${outPath}`);

// eoreader6 · scripts/experiments/role-fold-tp-chunk — EXPERIMENTAL, unwired.
//
// Replaces role-fold-verb-island.mjs's fixed single-token, fixed-window
// candidate generator with a TRANSITIONAL-PROBABILITY chunker — Saffran,
// Aslin & Newport 1996 / Aslin, Saffran & Newport 1998: infants segment
// continuous speech into word-like units using only the conditional
// probability of what follows what, with no grammar and no labels —
// transitional probability is reliably higher WITHIN a true unit than
// ACROSS a boundary, and a unit's edge is a local dip in that sequence, not
// a fixed width.
//
// Candidate fillers here are therefore variable-length spans, grown
// outward from a discovered-verb occurrence one token at a time, continuing
// while the next token's transitional probability with the span stays
// close to the running max, and STOPPING at the first local dip — not at a
// fixed ±4 token wall. The prediction this is meant to test: "the
// Environmental Protection Agency" or "the Administrator" should chunk
// together as one cohesive span (high internal TP), while "additional" or
// "certain" sitting alone next to a verb should not falsely fuse with an
// unrelated neighbor — separating the institutional-actor signal from the
// generic-modifier signal that role-fold-verb-island.mjs's single-token
// candidates left mixed together.
//
// TP is computed from the POOLED POCKET bigram table (same reasoning as
// v3's pooled function-word fix: dip-detection needs enough bigram mass to
// be a stable statistic, and a single document doesn't have it).
//
// Usage: node scripts/experiments/role-fold-tp-chunk.mjs <pocket-dir[,dir2,...]> [docLimit] [topNVerbs]

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

// Declared, not derived — same discipline as extractSurfaces's own "up to 4
// tokens is a name, more is a heading" cap (surfaces.js).
const MAX_SPAN_LEN = 4;
const WINDOW = 6; // how far out from the verb occurrence chunk-growth is allowed to look
const DIP_RATIO = Number(process.env.DIP_RATIO ?? 0.4); // stop extending when TP falls below this fraction of the span's own running max

if (!POCKET_DIR) {
  console.error("usage: node role-fold-tp-chunk.mjs <pocket-dir[,dir2,...]> [docLimit] [topNVerbs]");
  process.exit(1);
}

const stripFrontmatter = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, "");
// URL/domain fragments ("www", "gov", "https", "regulations.gov") have
// artificially HIGH transitional probability from verbatim repetition
// across dozens of documents sharing the same boilerplate citation —
// cohesion from copy-paste, not from grammar. TP genuinely cannot tell
// these apart on its own; this is a shape-based filter, same tier as
// surfaces.js's own isRomanNumeral check, not a grammar rule.
const URL_SHAPED = /^(https?|www|gov|com|org|net|html?|pdf|php)$|\.(gov|com|org|net|html?)$|^[a-z]+\.[a-z]{2,4}$/i;
const looksLikeDebris = (tok) => /[\d/]/.test(tok) || tok.length <= 1 || URL_SHAPED.test(tok);

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

// ── PASS 1: pool unigram + BIGRAM tables, function words, verb vocabulary ──
let pooledWords = [];
const perDocSentences = new Map();
const perDocSurfaces = new Map();
const allTexts = [];

for (const file of files) {
  const text = stripFrontmatter(readFileSync(file, "utf8"));
  allTexts.push(text);
  for (const w of tokenize(text)) pooledWords.push(w);
  const abbreviations = deriveAbbreviations(text);
  perDocSentences.set(file, splitSentences(text, { abbreviations }));
}

const pocketFunctionWords = functionWordSet(buildFrequencyTable(pooledWords));
const isFunctionWord = (w) => pocketFunctionWords.has(w) || RECEIVED_FUNCTION_WORDS.has(w);

// Bigram transitional-probability table, built directly over each
// document's own token stream in order (never across a document boundary,
// which would manufacture a fake adjacency) — same "no injected order"
// discipline II.8 already states elsewhere: the count is a measured fact
// about real adjacency, never a smoothed or synthetic estimate.
const unigram = new Map();
const bigram = new Map(); // "a|b" -> count
for (const text of allTexts) {
  const toks = tokenize(text);
  for (let i = 0; i < toks.length; i++) {
    unigram.set(toks[i], (unigram.get(toks[i]) ?? 0) + 1);
    if (i + 1 < toks.length) {
      const key = `${toks[i]}|${toks[i + 1]}`;
      bigram.set(key, (bigram.get(key) ?? 0) + 1);
    }
  }
}
const tp = (a, b) => {
  const denom = unigram.get(a) ?? 0;
  if (denom === 0) return 0;
  return (bigram.get(`${a}|${b}`) ?? 0) / denom;
};
console.log(`pooled: ${pooledWords.length} tokens, ${unigram.size} types, ${bigram.size} distinct bigrams, ${pocketFunctionWords.size} Zipf function words\n`);

for (let i = 0; i < files.length; i++) {
  const sentences = perDocSentences.get(files[i]);
  if (!sentences.length) continue;
  const surfaces = extractSurfaces(sentences, { functionWords: pocketFunctionWords, abbreviations: deriveAbbreviations(allTexts[i]) });
  perDocSurfaces.set(files[i], surfaces);
}
const allSurfaces = [...perDocSurfaces.values()].flat();
const { verbs, candidates } = discoverRelationVocab(allTexts.join("\n\n"), { surfaces: allSurfaces, functionWords: pocketFunctionWords, minSurfaces: 2 });
const topVerbs = candidates.slice(0, TOP_N_VERBS).map((c) => c.verb);
console.log(`verb vocabulary: ${verbs.size}; testing top ${topVerbs.length} as islands: ${topVerbs.join(", ")}\n`);

// ── TP-CHUNK GROWTH: grow a span outward from a verb occurrence ────────────
// direction: +1 (extending after/rightward) or -1 (extending before/leftward)
const growChunk = (raw, lower, startIdx, direction) => {
  const span = [startIdx];
  let runningMax = 0;
  for (let step = 1; step < WINDOW && span.length < MAX_SPAN_LEN; step++) {
    const nextIdx = startIdx + direction * step;
    if (nextIdx < 0 || nextIdx >= raw.length) break;
    if (verbs.has(lower[nextIdx])) break; // ran into the next verb — hard stop
    const edgeIdx = span[span.length - 1];
    // TP measured in the direction the text actually reads, regardless of
    // which way the span is growing: extending rightward, it's TP(edge ->
    // next); extending leftward, it's TP(next -> edge) — the real adjacency,
    // never reversed to make the arithmetic convenient.
    const t = direction > 0 ? tp(lower[edgeIdx], lower[nextIdx]) : tp(lower[nextIdx], lower[edgeIdx]);
    runningMax = Math.max(runningMax, t);
    if (runningMax > 0 && t < runningMax * DIP_RATIO) break; // local dip — this is the boundary
    span.push(nextIdx);
  }
  if (direction < 0) span.reverse();
  return span;
};

// ── PASS 2: per verb island, chunk-grow candidates instead of single tokens ─
const islandFillers = new Map(topVerbs.map((v) => [v, new Map()]));

for (const file of files) {
  const sentences = perDocSentences.get(file);
  if (!sentences.length) continue;

  for (const sent of sentences) {
    const raw = sent.text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? [];
    const lower = raw.map((t) => t.toLowerCase());

    for (let k = 0; k < raw.length; k++) {
      if (!islandFillers.has(lower[k])) continue;
      const island = islandFillers.get(lower[k]);

      for (const direction of [1, -1]) {
        const startIdx = k + direction;
        if (startIdx < 0 || startIdx >= raw.length) continue;
        if (verbs.has(lower[startIdx]) || isFunctionWord(lower[startIdx]) || looksLikeDebris(raw[startIdx])) continue;

        const spanIdx = growChunk(raw, lower, startIdx, direction);
        // Trim a trailing/leading function word the chunk grabbed on its
        // way to a dip (a real content span shouldn't end mid-"of the").
        while (spanIdx.length > 1 && isFunctionWord(lower[spanIdx[spanIdx.length - 1]])) spanIdx.pop();
        while (spanIdx.length > 1 && isFunctionWord(lower[spanIdx[0]])) spanIdx.shift();
        if (!spanIdx.length || looksLikeDebris(raw[spanIdx[0]])) continue;

        const surface = spanIdx.map((idx) => raw[idx]).join(" ");
        const norm = spanIdx.map((idx) => lower[idx]).join(" ");
        const bucket = `${direction > 0 ? "after" : "before"}_len${spanIdx.length}`;

        if (!island.has(norm)) island.set(norm, { surface, buckets: new Map() });
        const f = island.get(norm);
        f.buckets.set(bucket, (f.buckets.get(bucket) ?? 0) + 1);
      }
    }
  }
}

// ── induceKinds per verb island, on TP-grown spans ──────────────────────
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
    if (/^\p{Lu}/u.test(f.surface.trim())) attrs.push(A("capitalized", 1));
    if (norm.includes(" ")) attrs.push(A("multiword", 1));
    records.push({ id: `filler:${norm}`, label: f.surface, attributes: attrs });
  }

  if (records.length < OPTS_BASE.minKindSize) {
    console.log(`"${verb}": ${records.length} qualifying spans — too few, skipped`);
    results.push({ verb, fillerCount: records.length, kinds: [] });
    continue;
  }

  const opts = { ...OPTS_BASE, population: `tp-verb-island:${verb}` };
  const t0 = Date.now();
  const kinds = induceKinds(records, opts);
  const ms = Date.now() - t0;
  const survived = isGap(kinds) ? [] : kinds;
  console.log(`"${verb}": ${records.length} spans -> induceKinds ${ms}ms -> ${survived.length} kind(s)`);
  for (const k of survived) {
    console.log(`   kind "${k.label}" (${k.members.length} members, height=${k.height}): ${k.members.slice(0, 12).map((m) => records.find((r) => r.id === m)?.label ?? m).join(" | ")}`);
  }
  results.push({ verb, fillerCount: records.length, kinds: survived, records });
}

mkdirSync(join(HERE, "..", "..", "goldens", "agency-civic", "data"), { recursive: true });
const outPath = join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-tp-chunk.experiment.json");
writeFileSync(outPath, JSON.stringify({ opts: OPTS_BASE, dipRatio: DIP_RATIO, maxSpanLen: MAX_SPAN_LEN, window: WINDOW, docsProcessed: files.length, topVerbs, results }, null, 2));
console.log(`\nwrote ${outPath}`);

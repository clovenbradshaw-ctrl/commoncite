// eoreader6 · scripts/experiments/role-fold-cross-lingual — EXPERIMENTAL.
//
// Every mechanism this arc has built so far (extractSurfaces's capitalised-
// run detector, discoverRelationVocab's "token immediately after a surface"
// candidate generator, the verb-island induceKinds call) was measured only
// against English prose. II.1/II.11 (omnimodal — a ground must hold for any
// medium/language it claims to, or the commitment is a lie for every one but
// the one it was built on) says that has to be checked, not assumed.
//
// THE PREDICTION THIS SCRIPT TESTS, stated before running it:
//
//   1. extractSurfaces's admission gate is: a capitalised run, not sentence-
//      initial, admitted unless its OWN lowercase form appears often enough
//      to fail a binomial significance test against its own capitalised
//      count — and if a word is NEVER seen lowercase, that test does not run
//      at all (surfaces.js L221-226, "the strongest possible evidence for
//      namehood, nothing left to test against"). That inference is sound
//      only if a language capitalises names and NOT common nouns. German
//      capitalises every common noun (Der Mann, das Zimmer, mid-sentence,
//      always) — so a German common noun is NEVER seen lowercase for a
//      reason that has nothing to do with being a name, and should be
//      admitted as a false-positive "surface" at a rate French and English
//      should not show. This is a real prediction, not a hedge: measure the
//      admitted-surface rate per 1000 words for fr/de/en and inspect a
//      sample of what German admits.
//
//   2. discoverRelationVocab's candidate generator is "the token immediately
//      following a surface occurrence" — SVO/SV-initial word-order signal
//      by construction (relations.js's own header: "MEDIUM-SPECIFIC BY
//      CONSTRUCTION"). French is SVO like English — predict comparable
//      candidate yield. German main clauses are V2 but subordinate clauses
//      are verb-final, and case marking (not position) carries the
//      grammatical-role signal — predict a measurable, not total, yield
//      drop. Finnish is topic-prominent with free constituent order and
//      heavy case marking — predict the steepest drop of the three.
//
//   3. induceKinds itself (emergence/kinds.js) takes abstract attribute
//      records and never reads a word — nothing in its profile-Jaccard +
//      Born-gate logic is English-specific or even text-specific. Prediction:
//      whatever candidate fillers DO survive step 2's generator, induceKinds
//      should cluster them the same way regardless of language — height
//      should not correlate with language once a fair set of candidates
//      reaches it. This is the actual omnimodal claim under test: the mouth
//      (relations.js) is medium/language-specific by design; the organ
//      (kinds.js) should not be.
//
// POCKET CHOICE, and a corpus defect found while making it: this originally
// pointed at live_priors/11-multi-language/gutenberg-non-en, a per-language
// directory of Project Gutenberg novels. A quick language check (grep for
// each language's dozen most common function words at each file's midpoint)
// found that pocket is mislabeled at scale — every file except
// fr/Madame_Bovary.txt is majority-ENGLISH at its own midpoint, not the
// labeled language (fr/pg15807_Nana.txt is not Zola's Nana at all; it is an
// unrelated English book, "Among the Forces" by Henry White Warren — a
// wrong-content mislabeling, not just an uncleaned English header/preface).
// Running a cross-lingual test against silently-wrong-language material
// would produce a false negative dressed as a null result — the same class
// of mistake `goldens/agency-civic/provenance.json` already disclosed and
// excluded a file for (a corrupted PDF extraction), same discipline applied
// here: verified, then switched pockets rather than silently absorbing bad
// material. `live_priors/06-government-legal/world-legislation/{de,fr,fi,us}`
// verified instead (grep-sampled, genuinely in-language, YAML-frontmatter
// legal texts — the same format `stripFrontmatter` below already handles)
// and used instead. This also removes a genre confound the Gutenberg pocket
// would have had against the ORIGINAL role-fold pocket (federal-register
// prose): all four language pockets here are legal/regulatory register, not
// literary.
//
// Usage: node scripts/experiments/role-fold-cross-lingual.mjs

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
const LIVE_PRIORS = process.env.LIVE_PRIORS_DIR ?? join(HERE, "..", "..", "..", "live_priors");
const TOP_N_VERBS = Number(process.env.TOP_N_VERBS ?? 8);
const WINDOW = 4;

// Every language pocket comes from the SAME source (live_priors's
// world-legislation fetch), same genre band (statute/code/decision text),
// so a yield difference is not confounded by "legal register vs. novel" —
// and it is the SAME register the original role-fold pocket (federal
// register) is, so a difference is not a new genre entering the comparison
// either. Verified in-language (see note above) before use, unlike the
// Gutenberg pocket this replaced.
const POCKETS = {
  en: "06-government-legal/world-legislation/us",
  fr: "06-government-legal/world-legislation/fr",
  de: "06-government-legal/world-legislation/de",
  fi: "06-government-legal/world-legislation/fi",
};

const stripFrontmatter = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, "");
const looksLikeDebris = (tok) => /[\d/]/.test(tok) || tok.length <= 1;
const bucketOf = (offset) => `${Math.abs(offset) <= 2 ? "near" : "far"}_${offset < 0 ? "before" : "after"}`;

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(txt|md)$/.test(entry)) out.push(full);
  }
  return out;
};

// Heaps' law: distinct-vocabulary growth is sublinear in corpus size, so
// "distinct surfaces per 1000 words" is not comparable across corpora of
// wildly different total size on its own — a smaller corpus inflates the
// ratio regardless of language. Capping every language to a comparable word
// budget (rather than a comparable DOC count, which the four pockets don't
// share evenly) controls for this directly instead of just disclosing it.
const WORD_BUDGET = Number(process.env.WORD_BUDGET ?? 150_000);
// Same principled tightening role-fold-verb-island.mjs's own README already
// names ("raising the recurring-difference floor... a principled tightening
// per SEED.md's 'unit of record' discipline, not just a perf hack") — a verb
// island with thousands of fillers (a high-frequency function-adjacent verb
// like French "sont"/"a" in half a million words of code civil) makes
// induceKinds' permutation test combinatorially expensive for no gain in
// what the island is actually testing; keeping the MOST-recurring fillers
// keeps the question ("does structure exist among what this verb keeps
// company with") intact while keeping the run tractable.
const MAX_FILLERS_PER_ISLAND = Number(process.env.MAX_FILLERS_PER_ISLAND ?? 200);

const runLanguage = (lang, dir) => {
  console.log(`\n${"=".repeat(70)}\n${lang.toUpperCase()}  (${dir})\n${"=".repeat(70)}`);
  const allFiles = walk(dir);
  // Word-budget selection, not doc-count: walk files in a stable order,
  // stop once the running total would exceed the budget, so every language
  // pocket is measured at a comparable scale.
  const files = [];
  let budgetWords = 0;
  for (const f of allFiles) {
    if (budgetWords >= WORD_BUDGET) break;
    files.push(f);
    budgetWords += tokenize(readFileSync(f, "utf8")).length;
  }
  console.log(`${files.length}/${allFiles.length} documents (word-budget ${WORD_BUDGET})`);

  let pooledWords = [];
  const perDocSentences = new Map();
  const perDocAbbrev = new Map();
  const allTexts = [];
  for (const file of files) {
    const text = stripFrontmatter(readFileSync(file, "utf8"));
    allTexts.push(text);
    for (const w of tokenize(text)) pooledWords.push(w);
    const abbreviations = deriveAbbreviations(text);
    perDocAbbrev.set(file, abbreviations);
    perDocSentences.set(file, splitSentences(text, { abbreviations }));
  }
  const wordCount = pooledWords.length;
  const pocketFunctionWords = functionWordSet(buildFrequencyTable(pooledWords));
  console.log(`${wordCount} words, ${pocketFunctionWords.size} Zipf function words (no received list used — NO language-specific prior, honest cross-lingual baseline)`);

  // ── (1) extractSurfaces admission rate — tests the capitalisation prediction ──
  const perDocSurfaces = new Map();
  for (const file of files) {
    const sentences = perDocSentences.get(file);
    if (!sentences.length) continue;
    perDocSurfaces.set(file, extractSurfaces(sentences, { functionWords: pocketFunctionWords, abbreviations: perDocAbbrev.get(file) }));
  }
  const allSurfaces = [...perDocSurfaces.values()].flat();
  const distinctSurfaces = new Set(allSurfaces.map((s) => s.surface));
  const perThousand = (distinctSurfaces.size / wordCount) * 1000;
  console.log(`extractSurfaces: ${distinctSurfaces.size} distinct admitted surfaces (${perThousand.toFixed(2)} / 1000 words)`);
  // A crude, disclosed, non-authoritative check for "does this look like a
  // common noun rather than a name": single lowercase-after-lowercase word
  // in this pocket's own top-2000-by-frequency-of-LOWERCASE-form band would
  // require lowercase occurrences to exist at all, which by construction
  // these do not (that's the whole prediction) — so instead just sample
  // admitted single-word surfaces for a human/LLM to eyeball.
  const sampleSurfaces = [...distinctSurfaces].filter((s) => !s.includes(" ")).slice(0, 25);
  console.log(`sample single-word admitted surfaces: ${sampleSurfaces.join(", ")}`);

  // ── (2) discoverRelationVocab yield — tests the word-order prediction ──
  const { verbs, candidates } = discoverRelationVocab(allTexts.join("\n\n"), { surfaces: allSurfaces, functionWords: pocketFunctionWords, minSurfaces: 2 });
  const verbsPerThousand = (verbs.size / wordCount) * 1000;
  console.log(`discoverRelationVocab: ${verbs.size} admitted verbs, ${candidates.length} total candidates (${verbsPerThousand.toFixed(3)} admitted / 1000 words)`);

  const topVerbs = candidates.slice(0, TOP_N_VERBS).map((c) => c.verb);
  console.log(`top verb islands: ${topVerbs.join(", ")}`);

  // ── (3) verb-island induceKinds — tests the "organ is language-blind" prediction ──
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
        for (let off = -WINDOW; off <= WINDOW; off++) {
          if (off === 0) continue;
          const j = k + off;
          if (j < 0 || j >= raw.length) continue;
          if (verbs.has(lower[j]) || pocketFunctionWords.has(lower[j]) || looksLikeDebris(raw[j])) continue;
          const norm = lower[j];
          if (!island.has(norm)) island.set(norm, { surface: raw[j], buckets: new Map() });
          const f = island.get(norm);
          const bucket = bucketOf(off);
          f.buckets.set(bucket, (f.buckets.get(bucket) ?? 0) + 1);
        }
      }
    }
  }

  const A = (field_id, count) => ({ field_id, value_type: "boolean", count });
  const MIN_OCCURRENCES = 3;
  const OPTS_BASE = { minPrevalence: 0.15, minKindSize: 3, permutations: 60, quantile: 0.95, reseeds: 8, seed: 42 };

  const islandResults = [];
  for (const verb of topVerbs) {
    const fillers = islandFillers.get(verb);
    let records = [];
    for (const [norm, f] of fillers) {
      const total = [...f.buckets.values()].reduce((s, n) => s + n, 0);
      if (total < MIN_OCCURRENCES) continue;
      const attrs = [];
      for (const [bucket, n] of f.buckets) attrs.push(A(`pos:${bucket}`, n));
      if (/^\p{Lu}/u.test(f.surface.trim())) attrs.push(A("capitalized", 1));
      records.push({ id: `filler:${norm}`, label: f.surface, attributes: attrs, _total: total });
    }
    const uncappedCount = records.length;
    if (records.length > MAX_FILLERS_PER_ISLAND) {
      // Keep the MOST-recurring fillers, not an arbitrary/positional slice —
      // the ones with the most occurrences to draw an attribute profile
      // from are also the ones a permutation test can say the most about.
      records.sort((a, b) => b._total - a._total);
      records = records.slice(0, MAX_FILLERS_PER_ISLAND);
      console.log(`  "${verb}": ${uncappedCount} fillers exceeds cap, kept top ${MAX_FILLERS_PER_ISLAND} by recurrence`);
    }
    records = records.map(({ _total, ...r }) => r);
    if (records.length < OPTS_BASE.minKindSize) {
      islandResults.push({ verb, fillerCount: records.length, uncappedFillerCount: uncappedCount, kinds: [] });
      continue;
    }
    const kinds = induceKinds(records, { ...OPTS_BASE, population: `${lang}:verb-island:${verb}` });
    const survived = isGap(kinds) ? [] : kinds;
    const heights = survived.map((k) => k.height);
    console.log(`  "${verb}": ${records.length} fillers -> ${survived.length} kind(s), heights=[${heights.join(",")}]`);
    islandResults.push({ verb, fillerCount: records.length, uncappedFillerCount: uncappedCount, kinds: survived });
  }

  const aboveCount = islandResults.reduce((n, r) => n + r.kinds.filter((k) => k.height === "above").length, 0);
  const totalKinds = islandResults.reduce((n, r) => n + r.kinds.length, 0);
  console.log(`${lang}: ${aboveCount}/${totalKinds} kinds reached height=above across ${topVerbs.length} verb islands`);

  return {
    lang, wordCount, docCount: files.length,
    distinctSurfaces: distinctSurfaces.size, surfacesPerThousand: perThousand, sampleSurfaces,
    verbCount: verbs.size, candidateCount: candidates.length, verbsPerThousand,
    topVerbs, islandResults, aboveCount, totalKinds,
  };
};

const summary = {};
for (const [lang, rel] of Object.entries(POCKETS)) {
  const dir = join(LIVE_PRIORS, rel);
  try {
    statSync(dir);
  } catch {
    console.log(`skipping ${lang}: ${dir} not found`);
    continue;
  }
  summary[lang] = runLanguage(lang, dir);
}

console.log(`\n${"=".repeat(70)}\nCROSS-LINGUAL SUMMARY\n${"=".repeat(70)}`);
console.log("lang  words    surfaces/1k  verbs/1k    above/total-kinds");
for (const [lang, r] of Object.entries(summary)) {
  console.log(`${lang.padEnd(5)} ${String(r.wordCount).padEnd(8)} ${r.surfacesPerThousand.toFixed(2).padEnd(12)} ${r.verbsPerThousand.toFixed(3).padEnd(11)} ${r.aboveCount}/${r.totalKinds}`);
}

mkdirSync(join(HERE, "..", "..", "goldens", "agency-civic", "data"), { recursive: true });
const outPath = join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-cross-lingual.experiment.json");
writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(`\nwrote ${outPath}`);

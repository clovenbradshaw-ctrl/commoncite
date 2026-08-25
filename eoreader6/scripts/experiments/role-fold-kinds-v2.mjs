// eoreader6 · scripts/experiments/role-fold-kinds-v2 — EXPERIMENTAL, unwired.
//
// Rebuild of role-fold-kinds.mjs's candidate-generation step, after v1's
// defect (see eo-constitution AMENDMENT-12-PROPOSAL.md, drafted from this
// exact case): v1 reused perceiver/text/relations.js::extractRelations,
// which requires a CONTIGUOUS, CONTIGUOUS subject-verb-object match to admit
// anything — a hand-typed English construction, undisclosed as such at the
// reuse site, that both dropped real fillers (anything not in strict SVO
// shape) and admitted noise (a discourse marker or citation fragment sitting
// next to a discovered verb, with no subject/object slot to check it
// against).
//
// THIS VERSION KEEPS ORDER AS A MEASURED FEATURE, NEVER AS A HARD GATE.
// Every content-bearing token within a small window of a discovered verb
// OCCURRENCE becomes a candidate, tagged only with its signed distance from
// that verb (near-before / far-before / near-after / far-after) — no
// subject/object label attached, no requirement that both sides of a verb
// be filled. Whether "before" and "after" turn out to behave differently is
// left for induceKinds's own Born gates to find or refuse, not asserted
// here. Reuses discoverRelationVocab for the verb VOCABULARY only (a
// recurrence-gated admission, not a positional-extraction rule — legitimate
// to keep) and does its own windowing for occurrence positions, which
// discoverRelationVocab does not expose.
//
// Usage: node scripts/experiments/role-fold-kinds-v2.mjs <pocket-dir> [limit]

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
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
const WINDOW = 4; // tokens either side of a verb occurrence — declared, not derived

if (!POCKET_DIR) {
  console.error("usage: node role-fold-kinds-v2.mjs <pocket-dir> [doc-limit]");
  process.exit(1);
}

// A token shaped like a citation fragment or URL debris — "5", "U.S.C.",
// "https://www" — not a grammar rule, a character-shape fact (digits or
// slashes present), same tier as surfaces.js's own isRomanNumeral filter.
const looksLikeDebris = (tok) => /[\d/]/.test(tok) || tok.length <= 1;

const bucketOf = (offset) => {
  const dir = offset < 0 ? "before" : "after";
  const dist = Math.abs(offset);
  return `${dist <= 2 ? "near" : "far"}_${dir}`;
};

// ── (1) FOLD: verb occurrences + windowed candidates, per document ─────────
const files = readdirSync(POCKET_DIR).filter((f) => f.endsWith(".txt")).slice(0, LIMIT);
console.log(`Folding ${files.length} documents from ${POCKET_DIR} (window=${WINDOW})\n`);

// norm filler -> { surface, buckets: Map(bucket -> Set(distinct verb tokens)) }
const fillerStats = new Map();
let totalVerbOccurrences = 0;
let docsWithVerbs = 0;

for (const file of files) {
  const text = readFileSync(join(POCKET_DIR, file), "utf8");
  const abbreviations = deriveAbbreviations(text);
  const sentences = splitSentences(text, { abbreviations });
  if (!sentences.length) continue;

  const functionWords = functionWordSet(buildFrequencyTable(tokenize(text)));
  const surfaces = extractSurfaces(sentences, { functionWords, abbreviations });
  const { verbs } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 });
  if (!verbs.size) continue;

  let hitDoc = false;
  for (const sent of sentences) {
    // Tokenize WITH the original surface form kept (for capitalization) and
    // a lowercase form (for vocab/function-word membership) — same split
    // material.js's own tokenize() uses, done here to keep index alignment
    // rather than re-deriving offsets from tokenize()'s output.
    const raw = sent.text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? [];
    const lower = raw.map((t) => t.toLowerCase());

    for (let i = 0; i < raw.length; i++) {
      if (!verbs.has(lower[i])) continue;
      totalVerbOccurrences++;
      hitDoc = true;
      for (let off = -WINDOW; off <= WINDOW; off++) {
        if (off === 0) continue;
        const j = i + off;
        if (j < 0 || j >= raw.length) continue;
        if (verbs.has(lower[j])) continue; // another verb, not a filler
        if (functionWords.has(lower[j])) continue; // this text's own closed class
        if (looksLikeDebris(raw[j])) continue; // citation/URL/number-shaped noise
        const bucket = bucketOf(off);
        const norm = lower[j];
        if (!fillerStats.has(norm)) fillerStats.set(norm, { surface: raw[j], buckets: new Map() });
        const f = fillerStats.get(norm);
        if (!f.buckets.has(bucket)) f.buckets.set(bucket, new Set());
        f.buckets.get(bucket).add(lower[i]);
      }
    }
  }
  if (hitDoc) docsWithVerbs++;
}

console.log(`${totalVerbOccurrences} verb occurrences across ${docsWithVerbs}/${files.length} documents`);
console.log(`${fillerStats.size} distinct fillers observed in some window\n`);

// ── (2) BUILD RECORDS: bucket-by-distinct-verb-count as the profile ────────
const A = (field_id, count) => ({ field_id, value_type: "boolean", count });
const MIN_DISTINCT_PREDICATES = Number(process.env.MIN_DISTINCT_PREDICATES ?? 3);

const records = [];
for (const [norm, f] of fillerStats) {
  const attrs = [];
  let totalDistinct = 0;
  for (const [bucket, verbSet] of f.buckets) {
    attrs.push(A(bucket, verbSet.size));
    totalDistinct += verbSet.size;
  }
  if (/^\p{Lu}/u.test(f.surface.trim())) attrs.push(A("capitalized", 1));
  if (totalDistinct < MIN_DISTINCT_PREDICATES) continue;
  records.push({ id: `filler:${norm}`, label: f.surface, attributes: attrs });
}

console.log(`${records.length} fillers clear the recurring-difference floor (>=${MIN_DISTINCT_PREDICATES} distinct verbs across all buckets)\n`);

if (records.length < 3) {
  console.log("Too few qualifying fillers to attempt induction — refusing rather than reporting a degenerate result.");
  process.exit(0);
}

// ── (3) INDUCE ───────────────────────────────────────────────────────────
// permutations/reseeds overridable for fast exploratory passes — the
// full declared values (200/24) are the ones that would matter for a
// claim worth trusting; a smoke test that only needs to know "does any
// structure fall out at all" is legitimately allowed to ask more cheaply
// first, same as this codebase's own nominate-cheap/witness-expensive
// precedent (generation/RESULTS.md's Experiment 2).
const OPTS = {
  population: `federal-register-fold-positions-v2-${files.length}docs`,
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
const outPath = join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-kinds-v2.experiment.json");
writeFileSync(outPath, JSON.stringify({ opts: OPTS, docsProcessed: files.length, docsWithVerbs, totalVerbOccurrences, fillerCount: fillerStats.size, recordCount: records.length, kinds, records }, null, 2));
console.log(`wrote ${outPath}`);

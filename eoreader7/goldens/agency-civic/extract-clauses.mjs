// eoreader6 · goldens/agency-civic/extract-clauses — builds the candidate
// pool and the sampled golden for the agency-in-civic-text annotation
// study (see GUIDELINE.md and README.md for what this golden is FOR).
//
// Sentence boundaries reuse the engine's own, already-tested segmenter
// (perceiver/text/spans.js::splitSentences) — sentence detection is not the
// mechanism this golden is validating, so there is no reason to reinvent it
// (and every reason not to: CLAUDE.md already names sentence segmentation
// with offsets as a consistently reinvented wheel in this project family).
//
// CLAUSE splitting, below that, is NOT reused from anywhere, because
// nothing in this repo does it (see the research note in README.md: the
// only clause-shaped behavior in the engine is incidental to
// relations.js::extractRelations's own regex, which is the mechanism under
// test and must not also define the annotation unit — that would make the
// golden circular, sampling only the clauses the engine already agrees are
// clauses). The splitter here is DECLARED, deliberately weak, mechanical:
// break on semicolons and on comma-introduced coordinating conjunctions or
// relative clauses. It will over-split some sentences and under-split
// others. That is acceptable because annotators are always shown the FULL
// sentence alongside the isolated clause (GUIDELINE.md) — the splitter only
// decides sampling granularity, never what meaning is available to a judge.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { splitSentences, deriveAbbreviations } from "../../packages/engine/perceiver/text/spans.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GENRES = ["ordinance", "staff-report", "deposition"];

// ── clause splitting — declared and weak, see header ────────────────────
const CLAUSE_BREAK =
  /;\s+|,\s+(?:and|but|or|nor|so|yet|which|who|that|because|since|while|although|when|if|unless|before|after)\s+/gi;

// A split boundary consumes the delimiter, but a `;`-only delimiter (no
// conjunction) leaves the next clause starting with a bare "and"/"or" left
// over from the source's own "; and" list-item style. Trim it back off so
// annotators see a clean clause rather than a stray connective.
const LEADING_CONNECTIVE = /^(?:and|but|or|nor|so|yet)\s+/i;

const splitClauses = (sentenceText) => {
  const parts = sentenceText
    .split(CLAUSE_BREAK)
    .map((p) => p.trim().replace(LEADING_CONNECTIVE, "").trim())
    .filter(Boolean);
  return parts.length ? parts : [sentenceText.trim()];
};

// ── quality filters — every drop is counted and reported, never silent ──
const BOILERPLATE = [
  /^Docusign Envelope ID/i,
  /^Page \d/i,
  /^\d+$/,
  /^(Date|Meeting Date|Prepared by|Presented by|Department|Length|Presenter)s?:/i,
  /^Exhibit [A-Z]\b/i,
  /^\[Ord\./,
  /^\d+\.\d+\.\d+/,
  /^[•\d]+[.)]\s*$/,
  /^ADOPTED by/i,
  /^Docusign/i,
  /^_{3,}/,
];

// The interleaved-character corruption signature left by PDF pages where a
// template label/callout box shared coordinate space with body text — see
// provenance.json's "extraction" note. A lowercase letter directly followed
// by an uppercase letter inside a run of letters does not occur in ordinary
// English prose outside this artifact (or camelCase code identifiers, which
// this corpus has none of).
const CORRUPTION = /\p{Ll}\p{Lu}/u;

const REDACTION = /■/;

const isDegenerate = (clause) => {
  const words = clause.split(/\s+/).filter(Boolean);
  if (words.length < 4) return "too_short";
  if (CORRUPTION.test(clause)) return "pdf_extraction_corruption";
  if (REDACTION.test(clause)) return "name_redacted_by_source";
  if (BOILERPLATE.some((re) => re.test(clause))) return "boilerplate";
  const alpha = (clause.match(/\p{L}/gu) ?? []).length;
  if (alpha / clause.length < 0.6) return "low_alpha_ratio";
  return null;
};

// ── build the candidate pool ─────────────────────────────────────────────
const pool = [];
const dropped = {};
const drop = (reason) => { dropped[reason] = (dropped[reason] ?? 0) + 1; };

for (const genre of GENRES) {
  const dir = join(HERE, "texts", genre);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".txt"))) {
    const sourceId = file.replace(/\.txt$/, "");
    const text = readFileSync(join(dir, file), "utf8");
    const abbreviations = deriveAbbreviations(text);
    const sentences = splitSentences(text, { abbreviations });

    for (const sent of sentences) {
      const sentWords = sent.text.split(/\s+/).filter(Boolean);
      if (sentWords.length < 4) { drop("sentence_too_short"); continue; }
      if (BOILERPLATE.some((re) => re.test(sent.text))) { drop("boilerplate_sentence"); continue; }

      const clauses = splitClauses(sent.text);
      clauses.forEach((clause, i) => {
        const reason = isDegenerate(clause);
        if (reason) { drop(reason); return; }
        pool.push({
          id: `${genre}-${sourceId}-s${sent.order}-c${i}`,
          genre,
          source: sourceId,
          sentenceOrder: sent.order,
          clauseIndex: i,
          sentence: sent.text,
          clause,
        });
      });
    }
  }
}

console.log(`candidate pool: ${pool.length} clauses`);
for (const genre of GENRES) {
  console.log(`  ${genre}: ${pool.filter((c) => c.genre === genre).length}`);
}
console.log("dropped:", dropped);

// ── sample — deterministic PRNG, same discipline as goldens/cast/read.mjs's
// own chance baseline (seed=12345; a documented LCG, not Math.random, so a
// re-run reproduces the exact same sample and a diff is meaningful) ───────
let seed = 20260806;
const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const TARGET_TOTAL = 300;
const byGenre = Object.fromEntries(GENRES.map((g) => [g, shuffle(pool.filter((c) => c.genre === g))]));
const perGenreTarget = Math.floor(TARGET_TOTAL / GENRES.length);

// Cap per source document so no single ordinance/staff-report packet
// dominates its genre's slice — declared, not tuned to hit exactly 300.
const PER_SOURCE_CAP = 60;

const takeStratified = (list, n) => {
  const out = [];
  const perSource = {};
  for (const item of list) {
    if (out.length >= n) break;
    perSource[item.source] = (perSource[item.source] ?? 0) + 1;
    if (perSource[item.source] > PER_SOURCE_CAP) continue;
    out.push(item);
  }
  return out;
};

const sample = GENRES.flatMap((g) => takeStratified(byGenre[g], perGenreTarget));
const sampleShuffled = shuffle(sample);
sampleShuffled.forEach((c, i) => { c.sampleOrder = i; });

console.log(`\nsampled: ${sampleShuffled.length} clauses`);
for (const genre of GENRES) {
  console.log(`  ${genre}: ${sampleShuffled.filter((c) => c.genre === genre).length}`);
}

mkdirSync(join(HERE, "data"), { recursive: true });
writeFileSync(join(HERE, "data", "clause-pool.json"), JSON.stringify({ count: pool.length, dropped, clauses: pool }, null, 2));
writeFileSync(
  join(HERE, "data", "clauses.sample.json"),
  JSON.stringify({ seed: 20260806, target: TARGET_TOTAL, perSourceCap: PER_SOURCE_CAP, count: sampleShuffled.length, clauses: sampleShuffled }, null, 2),
);
console.log("\nwrote data/clause-pool.json and data/clauses.sample.json");

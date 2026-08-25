// eoreader6 · scripts/experiments/role-fold-kinds — EXPERIMENTAL, not wired
// into any golden or permanent organ (growth rule: unwired is refused, not
// early — this stays a measurement script until it earns otherwise).
//
// Tests whether `induceKinds` — already built for clustering relation-term
// RECORDS by shared structural attribute keys (emergence/kinds.js, profile-
// Jaccard + two Born gates, height discovered) — recovers real structural
// classes when pointed at FOLD-POSITIONS instead of relation terms.
//
// A record here is one filler span (a subject or object recovered by
// perceiver/text/relations.js::extractRelations, already-built, no new
// parsing). Its ATTRIBUTES are never its own lexical identity — they are the
// structural company it keeps: how many DISTINCT predicates it filled the
// subject slot for, how many it filled the object slot for, across every
// document in the pocket. Two fillers cohere into one induced kind only if
// that structural profile recurs, never because they're the same word or
// even the same part of speech (this engine's grammar has no such category
// and none is assumed here — II.1, the omnimodal test).
//
// The engine induces the class. It never names it. "Agent-shaped" or
// "patient-shaped" is a label a human puts on a surviving cluster afterward
// (II.2) — nothing here asserts that meaning.
//
// Usage: node scripts/experiments/role-fold-kinds.mjs <pocket-dir> [limit]

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { splitSentences, deriveAbbreviations } from "../../packages/engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../../packages/engine/perceiver/text/material.js";
import { extractSurfaces, diaNorm } from "../../packages/engine/perceiver/text/surfaces.js";
import { discoverRelationVocab, extractRelations } from "../../packages/engine/perceiver/text/relations.js";
import { induceKinds } from "../../packages/engine/emergence/kinds.js";
import { isGap } from "../../nul/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const POCKET_DIR = process.argv[2];
const LIMIT = process.argv[3] ? Number(process.argv[3]) : Infinity;

if (!POCKET_DIR) {
  console.error("usage: node role-fold-kinds.mjs <pocket-dir> [doc-limit]");
  process.exit(1);
}

// ── (1) FOLD: pull (subject, verb, object) triples from every pocket doc ──
const files = readdirSync(POCKET_DIR).filter((f) => f.endsWith(".txt")).slice(0, LIMIT);
console.log(`Folding ${files.length} documents from ${POCKET_DIR}\n`);

const allTriples = []; // { subject, verb, object, doc }
let docsWithTriples = 0;

for (const file of files) {
  const text = readFileSync(join(POCKET_DIR, file), "utf8");
  const abbreviations = deriveAbbreviations(text);
  const sentences = splitSentences(text, { abbreviations });
  if (!sentences.length) continue;

  const functionWords = functionWordSet(buildFrequencyTable(tokenize(text)));
  const surfaces = extractSurfaces(sentences, { functionWords, abbreviations });
  const { verbs } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 });
  if (!verbs.size) continue;

  let hit = false;
  for (const s of sentences) {
    const rels = extractRelations(s.text, { verbs });
    for (const r of rels) {
      allTriples.push({ subject: r.subject, verb: r.verb, object: r.object, doc: file });
      hit = true;
    }
  }
  if (hit) docsWithTriples++;
}

console.log(`${allTriples.length} triples from ${docsWithTriples}/${files.length} documents\n`);

// ── (2) BUILD FILLER RECORDS: structural profile, never lexical identity ──
// Key = normalized filler text. Value = which DISTINCT predicates it filled
// which position for — same recurring-difference discipline
// discoverRelationVocab already applies to verbs (a filler seen with only
// ONE predicate scored well once; recurrence across DIFFERENT predicates is
// testimony, SEED.md "the unit of record").
const fillerStats = new Map(); // norm -> { surface, subjectVerbs: Set, objectVerbs: Set }

const track = (text, verb, role) => {
  const norm = diaNorm(text);
  if (!norm) return;
  if (!fillerStats.has(norm)) fillerStats.set(norm, { surface: text, subjectVerbs: new Set(), objectVerbs: new Set() });
  const f = fillerStats.get(norm);
  (role === "subject" ? f.subjectVerbs : f.objectVerbs).add(verb);
};

for (const t of allTriples) {
  track(t.subject, t.verb, "subject");
  track(t.object, t.verb, "object");
}

const A = (field_id, count) => ({ field_id, value_type: "boolean", count });
// Measured, not just declared: at MIN=2 on 40 pocket docs, 6,246 distinct
// fillers produced 466 qualifying records — induceKinds's permutation search
// (200 perms x 24 reseeds, each rerunning cohesion search) does not finish in
// minutes at that record count. Raised to 3, which is a real tightening of
// the recurring-difference bar (SEED.md's own "the unit of record" — a
// filler seen with only two distinct predicates is thin testimony, not a
// pattern), not a performance shortcut dressed as one; it also happens to
// cut the qualifying set enough to make the exploratory pass tractable.
const MIN_DISTINCT_PREDICATES = Number(process.env.MIN_DISTINCT_PREDICATES ?? 3);

const records = [];
for (const [norm, f] of fillerStats) {
  const attrs = [];
  if (f.subjectVerbs.size >= 1) attrs.push(A("subject_position", f.subjectVerbs.size));
  if (f.objectVerbs.size >= 1) attrs.push(A("object_position", f.objectVerbs.size));
  if (/^\p{Lu}/u.test(f.surface.trim())) attrs.push(A("capitalized", 1));
  const totalDistinctPredicates = f.subjectVerbs.size + f.objectVerbs.size;
  if (totalDistinctPredicates < MIN_DISTINCT_PREDICATES) continue; // one-off, not testimony — dropped, not zeroed
  records.push({ id: `filler:${norm}`, label: f.surface, attributes: attrs });
}

console.log(`${fillerStats.size} distinct fillers found; ${records.length} clear the recurring-difference floor (>=${MIN_DISTINCT_PREDICATES} distinct predicates)\n`);

if (records.length < 3) {
  console.log("Too few qualifying fillers to attempt induction — refusing rather than reporting a degenerate result.");
  process.exit(0);
}

// ── (3) INDUCE: same call kinds.test.js already makes, pointed at these records ──
const OPTS = {
  population: `federal-register-fold-positions-${files.length}docs`,
  minPrevalence: 0.15,
  minKindSize: 3,
  permutations: 200,
  quantile: 0.95,
  reseeds: 24,
  seed: 42,
};

console.log("induceKinds options:", OPTS, "\n");
const kinds = induceKinds(records, OPTS);

if (isGap(kinds) || kinds.length === 0) {
  console.log("No kind survived both Born gates — refused, not forced. (A gap is a result.)");
} else {
  console.log(`${kinds.length} kind(s) survived:\n`);
  for (const k of kinds) {
    console.log(`── kind "${k.label}" (${k.members.length} members, height=${k.height ?? "peer"}) ──`);
    console.log("   " + k.members.slice(0, 15).map((m) => records.find((r) => r.id === m)?.label ?? m).join(", "));
    console.log("");
  }
}

mkdirSync(join(HERE, "..", "..", "goldens", "agency-civic", "data"), { recursive: true });
const outPath = join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-kinds.experiment.json");
writeFileSync(outPath, JSON.stringify({ opts: OPTS, docsProcessed: files.length, docsWithTriples, tripleCount: allTriples.length, fillerCount: fillerStats.size, recordCount: records.length, kinds }, null, 2));
console.log(`wrote ${outPath}`);

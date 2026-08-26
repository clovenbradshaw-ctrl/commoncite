// eoreader6 · goldens/agency-civic/engine-score — the system side of the
// agency-in-civic-text golden. For every sampled clause, computes whether
// the engine admitted a Link naming the clause's agent.
//
// "Admitted a Link" is NOT emergence/binding.js's `bindLinks`/`readLinks` —
// that machinery answers a different, document-pairwise question (do two
// named entities co-occur more than chance, across a whole reading) and has
// no clause-scoped output at all. The Link this golden tests is the one
// perceiver/text/relations.js self-labels as: CON · Link · Binding, "the
// graph's medium-specific mouth" — a subject/verb/object triple. A clause's
// agent counts as ADMITTED when relations.js finds a triple in it AND the
// triple's subject resolves to an already-discovered referent (either a
// named surface, engine tier, or a third-person pronoun resolved through
// pronouns.js::resolvePronouns's minActivation/minMargin floor, model
// tier) — the exact composite host/corpus.js's own `agency` signal already
// computes per-referent (lines ~835-872), kept per-clause here instead of
// collapsed into an aggregate ratio.
//
// Pipeline is host/corpus.js::extractDocSurfaces + discoveredCast, run
// directly on each source document's plain text (no host session/doc
// wrapper — nothing here needs caching or chunked-append).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { splitSentences, deriveAbbreviations } from "../../packages/engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../../packages/engine/perceiver/text/material.js";
import { extractSurfaces, discoverReferents, diaNorm, namesCorefer } from "../../packages/engine/perceiver/text/surfaces.js";
import { resolvePronouns } from "../../packages/engine/perceiver/text/pronouns.js";
import { discoverRelationVocab, extractRelations } from "../../packages/engine/perceiver/text/relations.js";
import { projectReferents } from "../../packages/engine/referents/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));

// host/corpus.js's own declared operating point (PRONOUN_MIN_ACTIVATION /
// PRONOUN_MIN_MARGIN) — restated here rather than imported, because that
// file's constants are module-local, not exported. Same numbers, same
// citation this repo's own comment already gives them: "an engineering
// starting point, not yet validated against a retrieval-quality golden."
// Using them here does NOT validate them — this golden is about clause-level
// agency, not about tuning these two floors (see README.md's firewall note).
const PRONOUN_MIN_ACTIVATION = 0.05;
const PRONOUN_MIN_MARGIN = 0.2;

const referentOwnsSubject = (subjectText, surfaceTexts) => {
  const subj = diaNorm(subjectText);
  return surfaceTexts.some((s) => diaNorm(s) === subj || namesCorefer(s, subjectText));
};

/**
 * Read one document once and return everything a per-clause scorer needs:
 * the sentence list (for sentenceOrder lookups), the admitted surface
 * texts, the resolved-pronoun bindings by sentenceOrder, and the relation
 * vocabulary (verbs) discovered from this document's own text.
 */
export const readDocument = (text) => {
  const abbreviations = deriveAbbreviations(text);
  const sentences = splitSentences(text, { abbreviations });
  const functionWords = functionWordSet(buildFrequencyTable(tokenize(text)));
  const surfaces = extractSurfaces(sentences, { functionWords, abbreviations });

  let allSurfaceTexts = [];
  let boundBySentence = new Map();
  let verbs = new Set();

  if (surfaces.length) {
    const discovery = discoverReferents(surfaces);
    const referents = projectReferents(discovery.events);
    allSurfaceTexts = referents.flatMap((r) => (r.surfaces ?? []).map((s) => (typeof s === "string" ? s : s?.surface)).filter(Boolean));

    verbs = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 }).verbs;

    const surfaceToReferent = new Map(discovery.events.map((e) => [e.surface, e.referent_id]));
    const resolved = resolvePronouns(sentences, surfaceToReferent, {
      minActivation: PRONOUN_MIN_ACTIVATION,
      minMargin: PRONOUN_MIN_MARGIN,
      nonPersonal: new Set(), // apparatus demotion not computed here — see README's firewall note: this golden does not touch that machinery
    });
    boundBySentence = new Map(resolved.bindings.map((b) => [b.sentenceOrder, b]));
  }

  return { sentences, allSurfaceTexts, boundBySentence, verbs, functionWords };
};

/**
 * Score one clause against an already-read document. `sentenceOrder` must
 * be the SAME splitSentences-derived order the clause was sampled with
 * (extract-clauses.mjs runs splitSentences on the identical genre text file,
 * so orders line up without re-deriving them here).
 */
export const scoreClause = (clauseText, sentenceOrder, doc) => {
  const rels = extractRelations(clauseText, { verbs: doc.verbs, functionWords: doc.functionWords });
  const hasTriple = rels.length > 0;
  const namedSubject = rels.some((r) => referentOwnsSubject(r.subject, doc.allSurfaceTexts));
  const pronounSubject = doc.boundBySentence.has(sentenceOrder);
  return {
    hasTriple,
    namedSubject,
    pronounSubject,
    agentAdmitted: hasTriple && (namedSubject || pronounSubject),
    triples: rels,
  };
};

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const sampleArg = process.argv[2] ?? "data/clauses.sample.json";
  const outArg = process.argv[3] ?? "data/engine-scores.json";

  const { clauses } = JSON.parse(readFileSync(join(HERE, sampleArg), "utf8"));

  const bySource = new Map();
  for (const c of clauses) {
    const key = `${c.genre}/${c.source}`;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(c);
  }

  const results = [];
  for (const [key, items] of bySource) {
    const [genre, source] = key.split("/");
    const text = readFileSync(join(HERE, "texts", genre, `${source}.txt`), "utf8");
    const doc = readDocument(text);
    for (const c of items) {
      const score = scoreClause(c.clause, c.sentenceOrder, doc);
      results.push({ id: c.id, genre: c.genre, source: c.source, clause: c.clause, ...score });
    }
    console.log(`${key.padEnd(45)} ${items.length} clauses, ${doc.verbs.size} verbs discovered, ${doc.boundBySentence.size} pronouns bound`);
  }

  results.sort((a, b) => clauses.findIndex((c) => c.id === a.id) - clauses.findIndex((c) => c.id === b.id));

  const admitted = results.filter((r) => r.agentAdmitted).length;
  console.log(`\n${admitted}/${results.length} clauses admitted a Link (${((admitted / results.length) * 100).toFixed(1)}%)`);
  const byGenre = {};
  for (const r of results) {
    byGenre[r.genre] ??= { total: 0, admitted: 0 };
    byGenre[r.genre].total++;
    if (r.agentAdmitted) byGenre[r.genre].admitted++;
  }
  for (const [g, s] of Object.entries(byGenre)) console.log(`  ${g}: ${s.admitted}/${s.total} (${((s.admitted / s.total) * 100).toFixed(1)}%)`);

  mkdirSync(join(HERE, "data"), { recursive: true });
  writeFileSync(join(HERE, outArg), JSON.stringify({ prns: { PRONOUN_MIN_ACTIVATION, PRONOUN_MIN_MARGIN }, results }, null, 2));
  console.log(`\nwrote ${outArg}`);
}

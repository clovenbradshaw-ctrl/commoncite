// eoreader6 · goldens/agency-civic/rotation-control — the golden's own
// floor: what Link-admission rate does the SAME extraction machinery
// produce on a clause whose word order has been destroyed?
//
// This is the control the README's success condition requires before the
// meter's raw admission rate means anything: relations.js's SVO extraction
// is, by its own header comment, "MEDIUM-SPECIFIC BY CONSTRUCTION" and
// order-dependent (subject BEFORE verb BEFORE object). If shuffling a
// clause's own words still gets it admitted at a rate anywhere near the
// real corpus's rate, admission is not reading agency — it is reading
// vocabulary co-occurrence regardless of order, and the whole meter is a
// bag-of-words detector wearing a syntax label.
//
// The document's discovered surfaces / relation vocabulary / pronoun
// bindings are held FIXED (real, unshuffled document) — only the clause
// text being matched against them is scrambled. This isolates exactly the
// risk under test: does extractRelations require real word order, or would
// it fire just as happily on a bag of the same words. Shuffling the whole
// document instead would also destroy the surfaces/vocabulary themselves
// and trivially floor at ~0%, which tests a different (and less
// informative) question.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { readDocument, scoreClause } from "./engine-score.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// Same declared-LCG discipline as extract-clauses.mjs and goldens/cast's own
// chance baseline — deterministic and reproducible, not Math.random.
const seededShuffle = (words, seed) => {
  let s = seed >>> 0;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const a = [...words];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// FNV-1a on the clause id — every clause gets its own reproducible but
// distinct shuffle, rather than one seed reused identically for all 208
// (which could accidentally preserve some cross-clause structure).
const seedFromId = (id) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};

const shuffleClauseWords = (clauseText, id) => {
  const words = clauseText.split(/\s+/).filter(Boolean);
  return seededShuffle(words, seedFromId(id)).join(" ");
};

const sampleArg = process.argv[2] ?? "data/clauses.sample.json";
const outArg = process.argv[3] ?? "data/rotation-control.json";

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
    const shuffled = shuffleClauseWords(c.clause, c.id);
    const score = scoreClause(shuffled, c.sentenceOrder, doc);
    results.push({ id: c.id, genre: c.genre, source: c.source, shuffledClause: shuffled, ...score });
  }
}

results.sort((a, b) => clauses.findIndex((c) => c.id === a.id) - clauses.findIndex((c) => c.id === b.id));

const admitted = results.filter((r) => r.agentAdmitted).length;
console.log(`ROTATION CONTROL (word-shuffled clauses): ${admitted}/${results.length} still admitted a Link (${((admitted / results.length) * 100).toFixed(1)}%)`);
const byGenre = {};
for (const r of results) {
  byGenre[r.genre] ??= { total: 0, admitted: 0 };
  byGenre[r.genre].total++;
  if (r.agentAdmitted) byGenre[r.genre].admitted++;
}
for (const [g, s] of Object.entries(byGenre)) console.log(`  ${g}: ${s.admitted}/${s.total} (${((s.admitted / s.total) * 100).toFixed(1)}%)`);

writeFileSync(join(HERE, outArg), JSON.stringify({ results }, null, 2));
console.log(`\nwrote ${outArg}`);

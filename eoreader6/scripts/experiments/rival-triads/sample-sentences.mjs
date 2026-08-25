// eoreader6 · experiments/rival-triads — sentence sampler.
//
// Draws a fixed, seeded sample of real English sentences from the
// live_priors corpus, stratified across registers (fiction, translated
// fiction, encyclopedic, philosophy, technical, news, reference), for the
// rival-triads falsification experiment (see PREREGISTRATION.md, which is
// written and committed BEFORE this sample is judged or embedded).
//
// Deliberately reuses goldens/shared/gutenberg.mjs's stripPgBoilerplate
// (CLAUDE.md: search for the organ before you write one).

import { readFileSync, writeFileSync } from "node:fs";
import { stripPgBoilerplate } from "../../../goldens/shared/gutenberg.mjs";

const PRIORS = "/home/user/live_priors";

// register → file. Chosen for register diversity, not for content.
const SOURCES = {
  "fiction-austen": `${PRIORS}/01-literature-books/gutenberg/pg1342_Pride_and_Prejudice.txt`,
  "fiction-wilde": `${PRIORS}/01-literature-books/gutenberg/pg174_The_Picture_of_Dorian_Gray.txt`,
  "fiction-wells": `${PRIORS}/01-literature-books/gitenberg/pg35_The-Time-Machine.txt`,
  "fiction-carroll": `${PRIORS}/01-literature-books/gutenberg/pg11_Alice_s_Adventures_in_Wonderland.txt`,
  "fiction-dostoevsky-tr": `${PRIORS}/11-multi-language/gutenberg-non-en/en/pg160_Crime_and_Punishment__Dostoyevsky_.txt`,
  "philosophy-plato-tr": `${PRIORS}/01-literature-books/gutenberg/pg55201_The_Republic_by_Plato.txt`,
  "wiki-evolution": `${PRIORS}/02-encyclopedic/wikipedia/Evolution.txt`,
  "wiki-mathematics": `${PRIORS}/02-encyclopedic/wikipedia/Mathematics.txt`,
  "wiki-kant": `${PRIORS}/02-encyclopedic/wikipedia/Immanuel_Kant.txt`,
  "technical-paip": `${PRIORS}/05-academic-papers/open-access-books/paip/chapter-01.txt`,
  "fiction-twain": `${PRIORS}/01-literature-books/gutenberg/pg1661_The_Adventures_of_Tom_Sawyer.txt`,
  // factbook entries are mostly structured fields; pool several countries'
  // prose to reach the per-source quota
  "reference-factbook": ["ag", "ao", "bc", "bn", "by", "cd", "cf", "cg", "cm", "cn", "ct", "cv", "dj", "eg", "ek", "er", "et", "ga"]
    .map((c) => `${PRIORS}/06-government-legal/world-factbook/africa_${c}.txt`),
};

const PER_SOURCE = 30;
const SEED = 20260816;

const mulberry32 = (seed) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const sentencesOf = (raw) => {
  const text = stripPgBoilerplate(raw)
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/_/g, "")           // PG italics markup
    .replace(/\n{2,}/g, " ¶ ")   // paragraph breaks survive as markers
    .replace(/\n/g, " ");
  // split on sentence-final punctuation followed by space + capital/quote
  const parts = text.split(/(?<=[.!?][”"']?)\s+(?=[“"'A-Z])/);
  return parts
    .map((s) => s.replace(/¶/g, " ").replace(/\s+/g, " ").trim())
    .filter((s) => {
      const words = s.split(/\s+/);
      if (words.length < 8 || words.length > 30) return false;
      if (!/[.!?][”"']?$/.test(s)) return false;
      if (!/^[“"'A-Z]/.test(s)) return false;
      if (/[|=<>{}\[\]\\_#*]/.test(s)) return false;        // markup/code débris
      if (/\bCHAPTER\b|\bBOOK\b|Wikipedia|http/i.test(s)) return false;
      const ascii = s.replace(/[^\x20-\x7E]/g, "").length / s.length;
      return ascii > 0.97;
    });
};

const rng = mulberry32(SEED);
const sample = [];
let id = 1;
for (const [register, path] of Object.entries(SOURCES)) {
  const paths = Array.isArray(path) ? path : [path];
  const pool = paths.flatMap((p) => sentencesOf(readFileSync(p, "utf8")));
  if (pool.length < PER_SOURCE) throw new Error(`${register}: only ${pool.length} sentences`);
  // seeded sample without replacement, spread across the document
  const chosen = new Set();
  while (chosen.size < PER_SOURCE) chosen.add(Math.floor(rng() * pool.length));
  for (const idx of [...chosen].sort((a, b) => a - b)) {
    sample.push({ id: id++, register, text: pool[idx] });
  }
}

writeFileSync(new URL("./sentences.json", import.meta.url), JSON.stringify(sample, null, 1));
console.error(`wrote ${sample.length} sentences from ${Object.keys(SOURCES).length} sources`);

// Emergent word-kinds from slot deltas, Born-gated. NO LABELS ANYWHERE.
//
// Previous attempt failed (Cohen's d = -0.04) for a nameable reason: it
// scored COSINE, which measures the delta's DIRECTION — what a word
// contributes. Kind lives in HOW a word contributes:
//
//   magnitude   how much of the clause's meaning rides on this slot
//   consistency how alike its own deltas are across different contexts
//               (a word that always does the same thing vs one whose
//                contribution is context-determined)
//
// Two names both contribute large, highly specific deltas pointing at
// different referents. Cosine calls them dissimilar; they are plainly the
// same kind. Magnitude and consistency do not have that defect.
//
// THE BORN GATE. A delta counts only if it beats what masking SOME OTHER
// word in the same sentence produces. That null preserves the sentence, the
// encoder and the masking operation, and breaks only WHICH position was
// masked — so it isolates "this word matters here" from "masking anything
// perturbs an embedding." Conditional per occurrence, never one global bar.

import { pipeline } from "@xenova/transformers";
import { readFileSync } from "node:fs";

const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
const embed = async (t) => Array.from((await extractor(t, { pooling: "mean", normalize: true })).data);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mag = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));
const cos = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

const loadSentences = (path) =>
  readFileSync(path, "utf8").replace(/\r\n/g, "\n").split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 45 && s.length < 190);

const NULLS_PER = 4;
const MAX_SENT = 5;

const profile = async (word, sentences) => {
  const re = new RegExp(`\\b${word}\\b`);
  const hits = sentences.filter((s) => re.test(s)).slice(0, MAX_SENT);
  if (hits.length < 3) return null;

  const deltas = [];
  let salient = 0, tested = 0;

  for (const s of hits) {
    const full = await embed(s);
    const real = sub(full, await embed(s.replace(re, "[MASK]")));

    // null: mask some OTHER word in this same sentence
    const others = s.split(/\s+/).map((t) => t.replace(/[^\p{L}']/gu, ""))
      .filter((t) => t.length > 2 && !re.test(t));
    const nulls = [];
    for (let i = 0; i < Math.min(NULLS_PER, others.length); i++) {
      const o = others[Math.floor((i / NULLS_PER) * others.length)];
      const om = new RegExp(`\\b${o}\\b`);
      if (!om.test(s)) continue;
      nulls.push(mag(sub(full, await embed(s.replace(om, "[MASK]")))));
    }
    if (nulls.length >= 2) {
      tested++;
      nulls.sort((a, b) => a - b);
      if (mag(real) > nulls[nulls.length - 1]) salient++; // beats every null drawn
    }
    deltas.push(real);
  }

  const magnitudes = deltas.map(mag);
  const meanMag = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;

  let pairs = [], n = 0;
  for (let i = 0; i < deltas.length; i++)
    for (let j = i + 1; j < deltas.length; j++) { pairs.push(cos(deltas[i], deltas[j])); n++; }
  const consistency = n ? pairs.reduce((a, b) => a + b, 0) / n : 0;

  return { word, meanMag, consistency, salience: tested ? salient / tested : null, n: hits.length };
};

const PROBES = ["Elizabeth", "Victor", "Clerval", "Felix", "Justine", "William",
  "he", "she", "it", "they", "I", "This", "There",
  "man", "father", "creature", "friend", "night", "heart", "death"];

const run = async (label, path) => {
  const sentences = loadSentences(path);
  const rows = [];
  for (const w of PROBES) {
    const p = await profile(w, sentences);
    if (p) rows.push(p);
    process.stderr.write(".");
  }
  console.log(`\n\n=== ${label} — ${rows.length} words profiled, no labels used ===`);
  console.log("sorted by CONSISTENCY (how alike a word's own deltas are across contexts)\n");
  console.log("  word         magnitude  consistency  salience(beats null)");
  for (const r of rows.sort((a, b) => b.consistency - a.consistency)) {
    console.log(`  ${r.word.padEnd(12)} ${r.meanMag.toFixed(3).padStart(8)}  ${r.consistency.toFixed(3).padStart(10)}  ${r.salience == null ? "  —" : (r.salience * 100).toFixed(0).padStart(6) + "%"}`);
  }
  return rows;
};

const a = await run("FRANKENSTEIN", "scripts/adversarial/fixtures/pg84-frankenstein.txt");
const b = await run("WAR AND PEACE", "/Users/mlacy/Downloads/pg2600.txt");

// stability: does a word keep its place across two different books?
const byWord = new Map(b.map((r) => [r.word, r]));
const shared = a.filter((r) => byWord.has(r.word));
const rank = (rows, key) => new Map([...rows].sort((x, y) => y[key] - x[key]).map((r, i) => [r.word, i]));
const ra = rank(shared, "consistency");
const rb = rank(shared.map((r) => byWord.get(r.word)), "consistency");
let d2 = 0;
for (const r of shared) d2 += (ra.get(r.word) - rb.get(r.word)) ** 2;
const n = shared.length;
console.log(`\n\nSTABILITY across two books (${n} shared words)`);
console.log(`  Spearman rho on consistency ranking: ${(1 - (6 * d2) / (n * (n * n - 1))).toFixed(3)}`);

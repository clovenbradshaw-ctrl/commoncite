// What classes actually emerge? No labels, no assumed inventory.
//
// Probe a wide range of word types, profile each by what it DOES to a slot,
// then cluster. Whatever groups form are the classes — described afterwards
// by inspection, never assigned beforehand.
//
// Feature space is the one that worked (cosine of mean delta did not):
//   magnitude    how much of the clause rides on this slot
//   consistency  how alike the word's own deltas are across contexts
//   salience     how often it beats masking some other word in the same
//                sentence — the Born gate, conditional per occurrence
//
// War and Peace, fully lowercased: capitalization cannot contribute.

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

const sentences = readFileSync("/Users/mlacy/Downloads/pg2600.txt", "utf8")
  .replace(/\r\n/g, "\n").toLowerCase()
  .split(/(?<=[.!?])\s+/).map((s) => s.replace(/\s+/g, " ").trim())
  .filter((s) => s.length > 45 && s.length < 190);

const MAX_SENT = 5, NULLS_PER = 4;

const profile = async (word) => {
  const re = new RegExp(`\\b${word}\\b`, "u");
  const hits = sentences.filter((s) => re.test(s)).slice(0, MAX_SENT);
  if (hits.length < 3) return null;
  const deltas = [];
  let salient = 0, tested = 0;
  for (const s of hits) {
    const full = await embed(s);
    deltas.push(sub(full, await embed(s.replace(re, "[MASK]"))));
    const others = s.split(/\s+/).map((t) => t.replace(/[^\p{L}']/gu, "")).filter((t) => t.length > 2 && !re.test(t));
    const nulls = [];
    for (let i = 0; i < Math.min(NULLS_PER, others.length); i++) {
      const o = others[Math.floor((i / NULLS_PER) * others.length)];
      const om = new RegExp(`\\b${o}\\b`, "u");
      if (om.test(s)) nulls.push(mag(sub(full, await embed(s.replace(om, "[MASK]")))));
    }
    if (nulls.length >= 2) { tested++; if (mag(deltas[deltas.length - 1]) > Math.max(...nulls)) salient++; }
  }
  let pairs = [];
  for (let i = 0; i < deltas.length; i++) for (let j = i + 1; j < deltas.length; j++) pairs.push(cos(deltas[i], deltas[j]));
  return {
    word,
    m: deltas.map(mag).reduce((a, b) => a + b, 0) / deltas.length,
    c: pairs.reduce((a, b) => a + b, 0) / pairs.length,
    s: tested ? salient / tested : 0,
  };
};

// Deliberately wide and deliberately unlabelled here.
const WORDS = [
  "pierre", "natásha", "kutúzov", "moscow", "petersburg",
  "father", "man", "night", "heart", "soldier", "horse", "room",
  "said", "came", "went", "looked", "thought", "knew", "took", "stood",
  "old", "young", "great", "little", "long", "white",
  "very", "suddenly", "always", "again", "still",
  "with", "from", "about", "without", "before",
  "the", "some", "every", "this", "that",
  "he", "she", "they", "it",
];

const rows = [];
for (const w of WORDS) { const p = await profile(w); if (p) rows.push(p); process.stderr.write("."); }
console.error("\n");

// normalize each feature, then agglomerative (average-linkage) clustering
const norm = (key) => {
  const xs = rows.map((r) => r[key]);
  const lo = Math.min(...xs), hi = Math.max(...xs);
  for (const r of rows) r[`n${key}`] = (r[key] - lo) / (hi - lo || 1);
};
["m", "c", "s"].forEach(norm);
const dist = (a, b) => Math.hypot(a.nm - b.nm, a.nc - b.nc, a.ns - b.ns);

let clusters = rows.map((r) => [r]);
const linkage = (A, B) => {
  let t = 0;
  for (const a of A) for (const b of B) t += dist(a, b);
  return t / (A.length * B.length);
};
while (clusters.length > 4) {
  let best = null;
  for (let i = 0; i < clusters.length; i++)
    for (let j = i + 1; j < clusters.length; j++) {
      const d = linkage(clusters[i], clusters[j]);
      if (!best || d < best.d) best = { i, j, d };
    }
  clusters[best.i] = clusters[best.i].concat(clusters[best.j]);
  clusters.splice(best.j, 1);
}

clusters.sort((A, B) => (B.reduce((t, r) => t + r.c, 0) / B.length) - (A.reduce((t, r) => t + r.c, 0) / A.length));

console.log("=== THE CLASSES THAT EMERGED (War and Peace, lowercased, no labels) ===\n");
for (const [i, C] of clusters.entries()) {
  const avg = (k) => (C.reduce((t, r) => t + r[k], 0) / C.length).toFixed(3);
  console.log(`CLASS ${i + 1}  (n=${C.length})   magnitude ${avg("m")}   consistency ${avg("c")}   salience ${avg("s")}`);
  console.log(`  ${C.map((r) => r.word).sort().join(", ")}\n`);
}

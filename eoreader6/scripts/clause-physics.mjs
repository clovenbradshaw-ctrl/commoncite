// The physics of a clause: are slot deltas ADDITIVE?
//
//   d_i   = embed(clause) - embed(clause with i masked)
//   d_ij  = embed(clause) - embed(clause with BOTH i,j masked)
//
// If d_ij == d_i + d_j the two positions are independent — the clause is
// compositional across them. The RESIDUAL
//
//   I(i,j) = || d_ij - (d_i + d_j) ||
//
// is the interaction: how much the two slots mean only in each other's
// presence. That is a binding energy, and it needs no verb list, no grammar,
// and no part-of-speech inventory to compute.
//
// If binding is real, I(i,j) should be structured, not uniform — high for
// slots that form a relation, low for slots that merely co-occur. A tuple is
// then a set of mutually-bound slots, and its ARITY is discovered rather than
// fixed at three by borrowing S-V-O from English.

import { pipeline } from "@xenova/transformers";

const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
const embed = async (t) => Array.from((await extractor(t, { pooling: "mean", normalize: true })).data);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const mag = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));

// Real clauses, lowercased. Content words only are probed (positions that
// could carry a slot); punctuation-stripped.
const CLAUSES = [
  "pierre looked at natásha and smiled",
  "the french army crossed the river",
  "kutúzov gave the order to retreat",
  "natásha loved prince andrew deeply",
  "the old count died in moscow",
];

const analyse = async (clause) => {
  const toks = clause.split(/\s+/);
  const full = await embed(clause);

  const maskAt = (idxs) => toks.map((t, i) => (idxs.includes(i) ? "[MASK]" : t)).join(" ");

  const d = [];
  for (let i = 0; i < toks.length; i++) d.push(sub(full, await embed(maskAt([i]))));

  const inter = [];
  for (let i = 0; i < toks.length; i++) {
    for (let j = i + 1; j < toks.length; j++) {
      const dij = sub(full, await embed(maskAt([i, j])));
      const residual = mag(sub(dij, add(d[i], d[j])));
      // normalise by the joint magnitude so long clauses do not dominate
      inter.push({ i, j, a: toks[i], b: toks[j], I: residual / (mag(dij) || 1) });
    }
  }
  return { toks, d, inter };
};

for (const clause of CLAUSES) {
  const { toks, d, inter } = await analyse(clause);
  console.log(`\n"${clause}"`);
  console.log(`  slot magnitudes: ${toks.map((t, i) => `${t}:${mag(d[i]).toFixed(2)}`).join("  ")}`);
  const sorted = [...inter].sort((x, y) => y.I - x.I);
  console.log(`  STRONGEST binding: ${sorted.slice(0, 3).map((p) => `${p.a}~${p.b}(${p.I.toFixed(2)})`).join("  ")}`);
  console.log(`  WEAKEST  binding: ${sorted.slice(-3).map((p) => `${p.a}~${p.b}(${p.I.toFixed(2)})`).join("  ")}`);
  const all = inter.map((p) => p.I);
  const m = all.reduce((a, b) => a + b, 0) / all.length;
  const sd = Math.sqrt(all.reduce((s, v) => s + (v - m) ** 2, 0) / all.length);
  console.log(`  interaction spread: mean ${m.toFixed(3)}  sd ${sd.toFixed(3)}  (uniform would be sd~0)`);
}

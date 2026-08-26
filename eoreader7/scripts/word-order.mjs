// Does word order carry the relation? Tested, not assumed.
//
// English is configurational: "the dog bit the man" and "the man bit the dog"
// are different events built from identical words, so ORDER IS THE RELATION.
// Basque marks its arguments with case (-k ergative, -a absolutive), so the
// same roles survive reordering. Any tuple extractor that reads position is
// therefore English-shaped, and this measures how badly.
//
//   perturbation = 1 - cos( embed(clause), embed(shuffled clause) )
//
// A language whose relations ride on order should be perturbed MORE by
// shuffling than one whose relations ride on morphology. Same encoder for
// both, so the comparison is not confounded by model choice.

import { pipeline } from "@xenova/transformers";
import { readFileSync } from "node:fs";

const extractor = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2");
const embed = async (t) => Array.from((await extractor(t, { pooling: "mean", normalize: true })).data);
const cos = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const shuffle = (xs) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const clausesFrom = (path, n) =>
  readFileSync(path, "utf8").replace(/\r\n/g, "\n").toLowerCase()
    .split(/(?<=[.!?])\s+/).map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => { const w = s.split(/\s+/).length; return w >= 6 && w <= 14; })
    .filter((_, i) => i % 37 === 0).slice(0, n);

const SHUFFLES = 5;

const perturbation = async (label, clauses) => {
  const drops = [];
  for (const c of clauses) {
    const base = await embed(c);
    const toks = c.split(/\s+/);
    let acc = 0;
    for (let s = 0; s < SHUFFLES; s++) acc += 1 - cos(base, await embed(shuffle(toks).join(" ")));
    drops.push(acc / SHUFFLES);
    process.stderr.write(".");
  }
  const m = drops.reduce((a, b) => a + b, 0) / drops.length;
  const sd = Math.sqrt(drops.reduce((s, v) => s + (v - m) ** 2, 0) / drops.length);
  console.log(`\n  ${label.padEnd(22)} perturbation ${m.toFixed(4)}  sd ${sd.toFixed(4)}  (n=${drops.length})`);
  return drops;
};

console.log("=== DOES WORD ORDER CARRY THE RELATION? ===");
console.log("1 - cos(clause, shuffled clause). Higher = order matters more.\n");

const eng = await perturbation("English (War & Peace)", clausesFrom("/Users/mlacy/Downloads/pg2600.txt", 25));
const eus = await perturbation("Basque (Garoa)", clausesFrom("/Users/mlacy/Documents/Default Project/eoreader4.2/tests/goldens/texts/basque-garoa.txt", 25));

const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length;
const sd = (x) => Math.sqrt(mean(x.map((v) => (v - mean(x)) ** 2)));
const pooled = Math.sqrt((sd(eng) ** 2 + sd(eus) ** 2) / 2);
console.log(`\n  difference: ${(mean(eng) - mean(eus)).toFixed(4)}   Cohen d = ${((mean(eng) - mean(eus)) / (pooled || 1)).toFixed(2)}`);

// The minimal pair English cannot survive and Basque can, as a sanity anchor.
console.log("\n  minimal pair (English, same words, reversed roles):");
const a = await embed("the dog bit the man");
const b = await embed("the man bit the dog");
console.log(`    "the dog bit the man" vs "the man bit the dog": cos ${cos(a, b).toFixed(4)}`);
console.log(`    (1.0 would mean the encoder cannot represent who did what to whom at all)`);

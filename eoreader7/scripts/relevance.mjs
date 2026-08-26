// eoreader6 · relevance — does Amendment IV hold on real material?
//
// Usage: node scripts/relevance.mjs [read-text]
//
// SEED.md Amendment IV is constitutional and, until this script, was tested
// only against toy fixtures. It claims a prior is relevant exactly insofar as
// it lowers the surprise of what is encountered, and that a share is not a
// finding unless it beats a gift whose ORDER has been destroyed and whose
// VOCABULARY has not.
//
// Both halves are checkable on a real book, and cheaply: relevance is earned
// through `massOf`, which is O(order) per token, so this reads the whole text
// without ever materialising a distribution.
//
// The measurement is a reading. The reader goes through the book once, in
// order, and every gift's standing is updated against each arriving form using
// only the context that preceded it. Nothing here is scored against material
// the reader had already been shown.
//
// ── DECLARED ──────────────────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const GAMMA = 0.99995;
const RHO = 0.9995; // the forgetting rate of relevance
const PRIOR_CAP = 60000;
const CHECKPOINTS = 8; // how many times through the book to print the standings
const SEED = 20260731;

import { readFileSync, existsSync } from "node:fs";
import { createLayer, createBelief } from "../packages/engine/generation/belief.js";
import { shuffledGift } from "../packages/engine/generation/candidates.js";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";

const READ = process.argv[2] ?? "scripts/corpus/pg84.txt";
const GIFTS = [
  { path: "scripts/corpus/pg345.txt", id: "dracula", giver: "Bram Stoker, Dracula (PG 345)" },
  { path: "scripts/corpus/pg1260.txt", id: "jane-eyre", giver: "Charlotte Brontë, Jane Eyre (PG 1260)" },
  { path: "scripts/corpus/pg2701.txt", id: "moby-dick", giver: "Herman Melville, Moby-Dick (PG 2701)" },
];

const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const load = (p) => stripContainer(readFileSync(p, "utf8").replace(/\r\n/g, "\n")).text.toLowerCase().match(WORD) ?? [];

if (!existsSync(READ)) {
  console.error(`no text at ${READ}`);
  process.exit(1);
}

const tokens = load(READ);
const priors = GIFTS.filter((g) => existsSync(g.path)).map((g) => ({ ...g, tokens: load(g.path).slice(0, PRIOR_CAP) }));
if (priors.length === 0) {
  console.error("no gifts found under scripts/corpus/");
  process.exit(1);
}

console.log(`\nreading   ${READ} — ${tokens.length.toLocaleString()} forms`);
const layers = [createLayer({ id: "read", tier: "read", order: ORDER, gamma: GAMMA, alpha: ALPHA })];
for (const p of priors) {
  const layer = createLayer({ id: p.id, tier: "received", giver: p.giver, order: ORDER, gamma: 1, alpha: ALPHA });
  layer.train(p.tokens);
  layers.push(layer);
  console.log(`gift      ${p.id.padEnd(12)} ${p.tokens.length.toLocaleString()} forms`);
}
// The noise floor: one per real gift, so a gift is compared against a control
// built from its OWN vocabulary rather than against a single shared one.
for (const p of priors) layers.push(shuffledGift({ order: ORDER, alpha: ALPHA, from: p, seed: SEED }));
console.log(`floor     ${priors.length} shuffled controls — same vocabulary, order destroyed`);
console.log(`declared  order=${ORDER} alpha=${ALPHA} gamma=${GAMMA} rho=${RHO} seed=${SEED}\n`);

const belief = createBelief({ layers, rho: RHO });

const at = [];
for (let c = 1; c <= CHECKPOINTS; c++) at.push(Math.floor((tokens.length * c) / CHECKPOINTS));

const ids = layers.filter((l) => l.tier === "received").map((l) => l.id);
const width = Math.max(...ids.map((i) => i.length));
const header = ids.map((i) => i.padStart(Math.max(14, i.length + 1))).join("");
console.log(`share of the borrowed mass, as the reading proceeds\n`);
console.log(`${"at form".padEnd(10)}${header}`);

let next = 0;
const seen = [];
for (let i = 0; i < tokens.length; i++) {
  const ctx = seen.slice(Math.max(0, seen.length - ORDER));
  belief.witnessForm(ctx, tokens[i]);
  seen.push(tokens[i]);
  belief.readLayer.observe(seen, seen.length - 1);

  if (next < at.length && i + 1 === at[next]) {
    const report = belief.relevanceReport();
    const byId = Object.fromEntries(report.layers.map((l) => [l.id, l]));
    const cells = ids.map((id) => (byId[id].share * 100).toFixed(1).padStart(Math.max(14, id.length + 1)) + "");
    console.log(`${String(i + 1).padStart(9).padEnd(10)}${cells.join("")}`);
    next++;
  }
}

const final = belief.relevanceReport();
console.log(`\nfinal standing after ${final.observations.toLocaleString()} forms read\n`);
const real = final.layers.filter((l) => !l.is_noise_control).sort((a, b) => b.share - a.share);
const control = final.layers.filter((l) => l.is_noise_control).sort((a, b) => b.share - a.share);

console.log(`  ${"gift".padEnd(width)}   share    vs noise floor`);
for (const l of real)
  console.log(
    `  ${l.id.padEnd(width)}  ${(l.share * 100).toFixed(2).padStart(6)}%   ${l.above_noise ? "ABOVE" : "below"}`,
  );
console.log(`\n  ${"noise floor".padEnd(width)}   share`);
for (const l of control) console.log(`  ${l.id.padEnd(width)}  ${(l.share * 100).toFixed(2).padStart(6)}%`);

const bestReal = real[0]?.share ?? 0;
const bestControl = control[0]?.share ?? 0;
console.log(`
Amendment IV, restriction 3: a share is a finding only if it beats a gift with
its order destroyed and its vocabulary intact.

  best real gift    ${(bestReal * 100).toFixed(2)}%
  best noise floor  ${(bestControl * 100).toFixed(2)}%
  verdict           ${bestReal > bestControl ? "the gifts carry order, not just word frequency" : "REFUTED — whatever the gifts contributed, word frequency already had"}
`);

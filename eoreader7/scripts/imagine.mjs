// eoreader6 · imagine — read a book, then say what you think comes next.
//
// Usage: node scripts/imagine.mjs [read-text] [prior-text ...]
// Defaults to scripts/corpus/pg84.txt (Frankenstein) read against Dracula,
// Jane Eyre and Moby Dick as received priors.
//
// No model is downloaded and no network is touched at run time. The reader is
// counts over forms it has met, decayed by recency, interpolated across
// context lengths, with the other books entering ONLY where this one has left
// a silence. See packages/engine/generation/belief.js.
//
// ── EVERY NUMBER THIS RUN DEPENDS ON, DECLARED HERE ────────────────────────
// None of them is a default anywhere in the engine; the engine throws if one
// arrives missing. They live at the top of the script so a rerun is a rerun
// and two runs that disagree are visibly two different experiments.
const ORDER = 4; // the reach of the context, in forms
const ALPHA = 0.7; // the smoothing reserve, and the gift's audibility
const GAMMA = 0.99995; // the reader's fading, per form met
const SEED = 20260731; // the draw
const HORIZON = 24; // how many forms to imagine
const PRIOR_CAP = 90000; // forms taken from each gift
const CUTS = 6; // how many places in the book to stop and imagine
const CONDITIONING = "free-running"; // it conditions on its OWN words, not the book's

import { readFileSync, existsSync } from "node:fs";
import { createLayer, createBelief } from "../packages/engine/generation/belief.js";
import { emitSequence, admissibleAsTestimony } from "../packages/engine/generation/emit.js";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { isGap } from "../nul/index.js";

const DEFAULT_READ = "scripts/corpus/pg84.txt";
const DEFAULT_PRIORS = [
  { path: "scripts/corpus/pg345.txt", id: "dracula", giver: "Bram Stoker, Dracula (Project Gutenberg 345)" },
  { path: "scripts/corpus/pg1260.txt", id: "jane-eyre", giver: "Charlotte Brontë, Jane Eyre (Project Gutenberg 1260)" },
  { path: "scripts/corpus/pg2701.txt", id: "moby-dick", giver: "Herman Melville, Moby-Dick (Project Gutenberg 2701)" },
];

const [, , readArg, ...priorArgs] = process.argv;
const readPath = readArg ?? DEFAULT_READ;
const priorSpecs = priorArgs.length
  ? priorArgs.map((p, i) => ({ path: p, id: `prior-${i}`, giver: `supplied on the command line: ${p}` }))
  : DEFAULT_PRIORS;

if (!existsSync(readPath)) {
  console.error(`no text at ${readPath}. Fetch a corpus first (scripts/corpus/ is gitignored).`);
  process.exit(1);
}

// A form is a word or a mark. Punctuation is kept as its own form because a
// reader who cannot predict a full stop cannot finish a sentence, and dropping
// it would make the task easier in exactly the way that matters least.
const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const tokenize = (text) => text.toLowerCase().match(WORD) ?? [];

const load = (path) => {
  const raw = readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const { text } = stripContainer(raw);
  return tokenize(text);
};

const say = (forms) =>
  forms
    .filter((f) => f !== null)
    .join(" ")
    .replace(/ ([.,;:!?])/g, "$1")
    .replace(/ ?— ?/g, " — ");

console.log(`\nreading   ${readPath}`);
const readTokens = load(readPath);
console.log(`          ${readTokens.length.toLocaleString()} forms\n`);

const gifts = [];
for (const spec of priorSpecs) {
  if (!existsSync(spec.path)) {
    console.log(`gift      ${spec.path} — ABSENT, skipped`);
    continue;
  }
  const toks = load(spec.path).slice(0, PRIOR_CAP);
  const layer = createLayer({ id: spec.id, tier: "received", giver: spec.giver, order: ORDER, gamma: 1, alpha: ALPHA });
  layer.train(toks);
  gifts.push(layer);
  console.log(`gift      ${spec.id.padEnd(12)} ${toks.length.toLocaleString()} forms — ${spec.giver}`);
}
console.log(
  `\ndeclared  order=${ORDER} alpha=${ALPHA} gamma=${GAMMA} seed=${SEED} horizon=${HORIZON} conditioning=${CONDITIONING}\n`,
);

// Two readers over the same material, differing in exactly one respect: one
// has read the other books and one has not. Everything else — order, alpha,
// gamma, the material, the seed — is identical, so any difference between
// their continuations is attributable to the gifts and to nothing else.
const makeReader = (withGifts) => {
  const read = createLayer({ id: "read", tier: "read", order: ORDER, gamma: GAMMA, alpha: ALPHA });
  return { read, belief: createBelief({ layers: withGifts ? [read, ...gifts] : [read] }) };
};
const alone = makeReader(false);
const widely = makeReader(true);

const cutAt = [];
for (let c = 1; c <= CUTS; c++) cutAt.push(Math.floor((readTokens.length * c) / (CUTS + 1)));

let cursor = 0;
for (const cut of cutAt) {
  // Read forward to the cut. Causal by construction: neither reader has seen a
  // single form past this point.
  for (let i = cursor; i < cut; i++) {
    alone.read.observe(readTokens, i);
    widely.read.observe(readTokens, i);
  }
  cursor = cut;

  const context = readTokens.slice(Math.max(0, cut - ORDER), cut);
  const truth = readTokens.slice(cut, cut + HORIZON);
  const preceding = readTokens.slice(Math.max(0, cut - 18), cut);

  console.log("─".repeat(78));
  console.log(`at form ${cut.toLocaleString()} of ${readTokens.length.toLocaleString()} — having read ${((cut / readTokens.length) * 100).toFixed(0)}% of the book\n`);
  console.log(`  …${say(preceding)}\n`);

  for (const [label, reader] of [
    ["read this book only", alone],
    ["and three others", widely],
  ]) {
    const out = emitSequence({
      belief: reader.belief,
      context,
      horizon: HORIZON,
      conditioning: CONDITIONING,
      selection: "sampled",
      seed: SEED + cut,
    });
    if (isGap(out)) {
      console.log(`  ${label.padEnd(21)} [refused: ${out.gap}]`);
      continue;
    }
    const crossing = admissibleAsTestimony(out);
    console.log(`  imagines (${label}):`);
    console.log(`    ${say([...out.emitted])}`);
    // Attribution accumulates one distribution's worth of mass per emitted
    // form, so the denominator is the total across ALL layers — not the
    // already-normalised read/received fractions, which would put a single
    // gift's share above 100%.
    const attributed = Object.values(out.attribution).reduce((a, b) => a + b, 0);
    const borrowedFrom = Object.entries(out.attribution)
      .filter(([id, m]) => id !== "read" && m > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, m]) => `${id} ${((m / (attributed || 1)) * 100).toFixed(0)}%`);
    console.log(
      `    register=imagined  borrowed=${(out.received_fraction * 100).toFixed(1)}%` +
        (borrowedFrom.length ? `  from: ${borrowedFrom.join(", ")}` : "") +
        `  as testimony: ${crossing === null ? "admissible" : `REFUSED (${crossing.gap})`}`,
    );
    console.log("");
  }

  console.log(`  what actually came next:`);
  console.log(`    ${say(truth)}\n`);
}

console.log("─".repeat(78));
console.log(`
Read this the right way round. Every continuation above is an IMAGINING — the
ground read forward, not a claim about the book. It is stamped register=imagined
for that reason, and none of it was scored worse for being borrowed. The only
guarded moment is the crossing: asserting one of these about Frankenstein, which
is refused whenever a form came from a book Frankenstein never supplied.

For whether any of this is BETTER than a plain markov chain, see
packages/engine/generation/RESULTS.md — imagination that reads well is not a
result, and this script deliberately measures nothing.
`);

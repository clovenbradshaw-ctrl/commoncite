// eoreader6 · finish-a-sentence — one real sentence, and what each gift makes of it.
//
// Usage: node scripts/finish-a-sentence.mjs [n]
//
// Takes real sentences out of Frankenstein, hands the reader the opening of
// each, and withholds the rest. Then shows the same prefix finished five ways:
// by a reader who has read only this book, and by that same reader plus ONE
// gift at a time, so the difference between two lines is attributable to the
// one gift that differs between them and to nothing else.
//
// Everything here is imagination (`register: "imagined"`). None of it is a
// claim about Frankenstein, and the line marked `as testimony` says whether it
// could be asserted about the book at all.
//
// ── DECLARED ──────────────────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const GAMMA = 0.99995;
const RHO = 0.9995;
const PRIOR_CAP = 90000;
const PREFIX = 7; // forms handed over
const HORIZON = 18; // forms withheld and imagined
const SEED = 424242;
const READ_UP_TO = 0.55; // fraction of the book read before any of this is asked

import { readFileSync, existsSync } from "node:fs";
import { createLayer, createBelief } from "../packages/engine/generation/belief.js";
import { emitSequence, admissibleAsTestimony } from "../packages/engine/generation/emit.js";
import { stripContainer, splitSentences } from "../packages/engine/perceiver/text/spans.js";
import { properNounsOf } from "../packages/engine/perceiver/text/proper.js";
import { isGap } from "../nul/index.js";

const HOW_MANY = Number(process.argv[2] ?? 3);
const READ = "scripts/corpus/pg84.txt";
const GIFTS = [
  { path: "scripts/corpus/pg345.txt", id: "dracula", giver: "Bram Stoker, Dracula" },
  { path: "scripts/corpus/pg1260.txt", id: "jane-eyre", giver: "Charlotte Brontë, Jane Eyre" },
  { path: "scripts/corpus/pg2701.txt", id: "moby-dick", giver: "Herman Melville, Moby-Dick" },
];

const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const tok = (t) => t.toLowerCase().match(WORD) ?? [];
const load = (p) => stripContainer(readFileSync(p, "utf8").replace(/\r\n/g, "\n")).text;
const say = (fs) =>
  fs.filter((f) => f !== null).join(" ").replace(/ ([.,;:!?])/g, "$1").replace(/ ?— ?/g, " — ");

if (!existsSync(READ)) { console.error(`no text at ${READ}`); process.exit(1); }

const text = load(READ);
const tokens = tok(text);
const cut = Math.floor(tokens.length * READ_UP_TO);

// Which forms this modality marks as names. Detected from ORIGINAL-CASE text,
// before any lowercasing, and pooled across every source — the gate needs to
// know a name when a gift offers one, so a name anywhere is a name here.
const referents = new Set();
const noteNames = (text) => { for (const n of properNounsOf(text).names) referents.add(n); };
noteNames(text);

const gifts = GIFTS.filter((g) => existsSync(g.path)).map((g) => {
  const raw = load(g.path);
  noteNames(raw);
  const layer = createLayer({ id: g.id, tier: "received", giver: g.giver, order: ORDER, gamma: 1, alpha: ALPHA });
  layer.train(tok(raw).slice(0, PRIOR_CAP));
  return { ...g, layer };
});

// One read layer, shared by every reader below, so the ONLY thing that differs
// between two lines is which gift is present. Building a separate read layer
// per reader would have let a difference in the read material masquerade as a
// difference the gift made.
const read = createLayer({ id: "read", tier: "read", order: ORDER, gamma: GAMMA, alpha: ALPHA });
for (let i = 0; i < cut; i++) read.observe(tokens, i);

const readers = [
  { label: "this book only", belief: createBelief({ layers: [read], referents }) },
  ...gifts.map((g) => ({ label: `+ ${g.id}`, belief: createBelief({ layers: [read, g.layer], referents }) })),
  {
    label: "+ all three",
    belief: createBelief({ layers: [read, ...gifts.map((g) => g.layer)], rho: RHO, referents }),
  },
];

console.log(`\nread ${cut.toLocaleString()} of ${tokens.length.toLocaleString()} forms of Frankenstein (${(READ_UP_TO * 100).toFixed(0)}%)`);
for (const g of gifts) console.log(`gift ${g.id.padEnd(11)} ${g.giver}`);
console.log(`names ${String(referents.size).padStart(9)} forms marked as referents across all sources — a name needs every giver to cross`);
console.log(`declared order=${ORDER} alpha=${ALPHA} gamma=${GAMMA} rho=${RHO} prefix=${PREFIX} horizon=${HORIZON} seed=${SEED}`);
console.log(`selection=sampled  conditioning=free-running — every form after the first conditions on the reader's OWN previous word\n`);

// Real sentences from material the reader has NOT reached yet.
const sentences = splitSentences(text)
  .filter((s) => s.offset > text.length * READ_UP_TO)
  .map((s) => ({ ...s, forms: tok(s.text) }))
  .filter((s) => s.forms.length >= PREFIX + HORIZON)
  .slice(0, HOW_MANY * 40);

const chosen = [];
for (let i = 0; i < sentences.length && chosen.length < HOW_MANY; i += Math.floor(sentences.length / HOW_MANY) || 1)
  chosen.push(sentences[i]);

for (const s of chosen) {
  const prefix = s.forms.slice(0, PREFIX);
  const truth = s.forms.slice(PREFIX, PREFIX + HORIZON);

  console.log("═".repeat(78));
  console.log(`GIVEN     ${say(prefix)} …\n`);

  for (const r of readers) {
    const out = emitSequence({
      belief: r.belief,
      context: prefix,
      horizon: HORIZON,
      conditioning: "free-running",
      selection: "sampled",
      seed: SEED,
    });
    if (isGap(out)) { console.log(`  ${r.label.padEnd(16)} [refused: ${out.gap}]`); continue; }
    const crossing = admissibleAsTestimony(out);
    console.log(`  ${r.label.padEnd(16)} ${say([...out.emitted])}`);
    console.log(
      `  ${"".padEnd(16)} borrowed ${(out.received_fraction * 100).toFixed(1)}%` +
        `  ·  as testimony: ${crossing === null ? "admissible" : "REFUSED"}`,
    );
    console.log("");
  }

  console.log(`  ${"SHELLEY WROTE".padEnd(16)} ${say(truth)}\n`);
}
console.log("═".repeat(78));

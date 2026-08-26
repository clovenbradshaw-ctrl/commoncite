// eoreader6 · chrome-needs-the-right-prior — how specific must the coverage be?
//
// Usage: node scripts/chrome-needs-the-right-prior.mjs
//
// ADVERSARIAL TO THE PREVIOUS RESULT. `chrome-is-known.mjs` showed Heidi's
// licence block costing 0.15-0.46 nats/form against a Frankenstein prior, and
// concluded that chrome is RECOGNISED rather than detected. But that prior was
// another Project Gutenberg file WITH ITS CONTAINER INTACT — it had met that
// exact licence. The cheap reading of that result is the trivial one: two
// documents share a boilerplate, so of course one predicts the other.
//
// So this asks the question that decides how much the finding is worth:
//
//   arm 1  prior = Frankenstein, CONTAINER INTACT      (the original claim)
//   arm 2  prior = Frankenstein, CONTAINER STRIPPED    (prose only — a reader
//          who has read a novel and never seen a licence)
//   arm 3  prior = the same prose, ORDER DESTROYED     (the noise floor)
//
// If arm 2 keeps the licence block cheap, chrome is recognisable from prose
// alone and the claim is broad. If arm 2 makes it expensive, then coverage is
// SPECIFIC — a prior recognises the containers it has actually met — and the
// amendment has to say so, because "read with priors" would otherwise be
// heard as "any priors will do."
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const SEED = 20260731;
const SENTENCES = 60;

import { readFileSync } from "node:fs";
import { createLayer } from "../packages/engine/generation/belief.js";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";

const W = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const tok = (t) => (t.toLowerCase().match(W) ?? []);
const raw = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

const heidiRaw = raw("scripts/corpus/pg20781.txt");
const frankRaw = raw("scripts/corpus/pg84-raw.txt");

const withContainer = tok(frankRaw);
const proseOnly = tok(stripContainer(frankRaw).text);

const shuffled = [...proseOnly];
let a = SEED + 0x6d2b79f5;
const uniform = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(uniform() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }

const layer = (id, toks) => { const l = createLayer({ id, tier: "received", giver: id, order: ORDER, gamma: 1, alpha: ALPHA }); l.train(toks); return l; };
const intact = layer("with-container", withContainer);
const prose = layer("prose-only", proseOnly);
const floor = layer("shuffled-prose", shuffled);

const sentences = splitSentences(heidiRaw).map((s) => tok(s.text)).filter((s) => s.length > 0);
console.log(`\nHeidi's opening, scored three ways. Nothing about Heidi is stripped.`);
console.log(`prior forms: intact ${withContainer.length.toLocaleString()} · prose-only ${proseOnly.length.toLocaleString()}`);
console.log(`declared order=${ORDER} alpha=${ALPHA} seed=${SEED}\n`);
console.log(`  sent   INTACT   PROSE-ONLY   SHUFFLED    first words`);

const seen = [];
const cost = (l, ctx, f) => { const m = l.massOf(ctx, f); return -Math.log(m.mass > 0 ? m.mass : m.reserve); };
const rows = [];
for (let s = 0; s < Math.min(SENTENCES, sentences.length); s++) {
  const sent = sentences[s];
  let i = 0, p = 0, sh = 0;
  for (const form of sent) {
    const ctx = seen.slice(Math.max(0, seen.length - ORDER));
    i += cost(intact, ctx, form); p += cost(prose, ctx, form); sh += cost(floor, ctx, form);
    seen.push(form);
  }
  const r = { s, i: i / sent.length, p: p / sent.length, sh: sh / sent.length, head: sent.slice(0, 5).join(" ") };
  rows.push(r);
  console.log(`  ${String(s).padStart(4)}  ${r.i.toFixed(2).padStart(7)}  ${r.p.toFixed(2).padStart(11)}  ${r.sh.toFixed(2).padStart(9)}    ${r.head.slice(0, 32)}`);
}

// The licence block is sentences 1-3; the prose begins around 46.
const band = (from, to, k) => { const x = rows.filter((r) => r.s >= from && r.s <= to); return x.reduce((t, r) => t + r[k], 0) / x.length; };
console.log(`\n                    INTACT   PROSE-ONLY   SHUFFLED`);
console.log(`  licence block   ${band(1, 3, "i").toFixed(2).padStart(7)}  ${band(1, 3, "p").toFixed(2).padStart(11)}  ${band(1, 3, "sh").toFixed(2).padStart(9)}`);
console.log(`  prose (46-59)   ${band(46, 59, "i").toFixed(2).padStart(7)}  ${band(46, 59, "p").toFixed(2).padStart(11)}  ${band(46, 59, "sh").toFixed(2).padStart(9)}`);
console.log("");

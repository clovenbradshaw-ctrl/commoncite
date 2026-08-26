// eoreader6 · chrome-is-known — the boilerplate is not detected, it is RECOGNISED.
//
// Usage: node scripts/chrome-is-known.mjs
//
// THE CLAIM. A reader's eyes glaze over a licence block not because the block
// is rare, or common, or asterisk-shaped, but because the reader has read a
// thousand of them. Chrome is the region a PRIOR already covers. It needs no
// format knowledge to find, and the format knowledge every version of this
// lineage has accumulated (4.2's markers, 5's indexOf, 6's box-drawing) is a
// prior that was never received properly.
//
// THE COLD-START OBJECTION, AND WHY IT DISSOLVES. The leading region is where
// a reader has the least ground of its own — `fold` refuses there outright,
// and SEED.md #1 says why: "a standpoint with nothing settled behind it cannot
// grow a ground; the first one must be RECEIVED, not derived." So a reader
// that only ever builds grounds from the material in front of it cannot skip
// anything, and must give a licence block exactly the attention it gives a
// novel. That is not a limitation of this engine. It is what reading without
// priors IS.
//
// THE MEASUREMENT. Heidi from form zero, boilerplate intact, scored against
// Frankenstein — also boilerplate intact. Nothing is stripped anywhere. If the
// claim holds, the chrome region costs the reader almost nothing (the prior
// has seen this licence) and the prose costs it the normal amount.
//
// AND THE NOISE FLOOR, because "the prior knew it" must beat "the prior knew
// those words." A shuffled Frankenstein carries the same vocabulary and no
// order at all (SEED.md #4). If real-Frankenstein only matches shuffled-
// Frankenstein on the chrome, then what was recognised was word frequency and
// there is no finding here.
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const RHO = 0.9995;
const SEED = 20260731;
const SENTENCES = 90; // how far into the document to walk

import { readFileSync } from "node:fs";
import { createLayer, createBelief } from "../packages/engine/generation/belief.js";
import { splitSentences } from "../packages/engine/perceiver/text/spans.js";

const W = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const tok = (t) => (t.toLowerCase().match(W) ?? []);
const raw = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// NOTHING IS STRIPPED. Both documents keep their containers.
const heidiRaw = raw("scripts/corpus/pg20781.txt");
const frank = tok(raw("scripts/corpus/pg84-raw.txt"));
const sentences = splitSentences(heidiRaw).map((s) => tok(s.text)).filter((s) => s.length > 0);

const shuffled = [...frank];
let a = SEED + 0x6d2b79f5;
const uniform = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(uniform() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }

const mk = (id, giver, toks) => { const l = createLayer({ id, tier: "received", giver, order: ORDER, gamma: 1, alpha: ALPHA }); l.train(toks); return l; };
const gift = mk("frankenstein", "Mary Shelley, Frankenstein (PG 84) — container intact", frank);
const floor = mk("shuffled:frankenstein", "the same gift, ORDER DESTROYED. A noise floor, not a source.", shuffled);

// A cold reader: it has read nothing of Heidi. Everything it knows, it brought.
const cold = createLayer({ id: "read", tier: "read", order: ORDER, gamma: 1, alpha: ALPHA });
const belief = createBelief({ layers: [cold, gift, floor], rho: RHO });

console.log(`\nHeidi read from form 0, CONTAINER INTACT, against Frankenstein (also intact).`);
console.log(`Nothing is stripped. No marker, no URL, no box-drawing is consulted anywhere.`);
console.log(`declared order=${ORDER} alpha=${ALPHA} rho=${RHO} seed=${SEED}\n`);
console.log(`  sent   forms   nats/form vs GIFT   vs SHUFFLED   lift   first words`);

const seen = [];
const rows = [];
for (let s = 0; s < Math.min(SENTENCES, sentences.length); s++) {
  const sent = sentences[s];
  let real = 0, noise = 0;
  for (const form of sent) {
    const ctx = seen.slice(Math.max(0, seen.length - ORDER));
    const g = gift.massOf(ctx, form); const f = floor.massOf(ctx, form);
    real += -Math.log(g.mass > 0 ? g.mass : g.reserve);
    noise += -Math.log(f.mass > 0 ? f.mass : f.reserve);
    seen.push(form);
  }
  rows.push({ s, n: sent.length, real: real / sent.length, noise: noise / sent.length, head: sent.slice(0, 5).join(" ") });
}
for (const r of rows)
  console.log(`  ${String(r.s).padStart(4)}  ${String(r.n).padStart(6)}   ${r.real.toFixed(2).padStart(14)}   ${r.noise.toFixed(2).padStart(11)}   ${(r.noise - r.real).toFixed(2).padStart(5)}   ${r.head.slice(0, 34)}`);

const mean = (x, k) => x.reduce((t, r) => t + r[k], 0) / x.length;
console.log("");

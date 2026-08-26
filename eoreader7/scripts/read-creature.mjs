// eoreader6 · read-creature — a reading of Frankenstein FOR ONE REFERENT.
//
// eoreader5's best measured selector, re-earned here with the one piece it
// could not have on this text without a prior:
//
//   score = forward surprise  x  log1p(referent presence)     stratified
//
// Forward surprise alone is entity-blind; it finds unusual word clusters, not
// what happens to anyone in particular. Presence alone scores 4/21 on the
// frozen golden. The product, stratified across the whole extent, is 5/21 —
// still the best number recorded in this lineage.
//
// PRESENCE FOR THE CREATURE IS THE HARD CASE, and it is why narrator spans
// matter. eoreader5 states it plainly: "the Creature narrates 40%->60% of
// Frankenstein and never once calls himself 'the creature'." Counting only
// name-like surfaces therefore misses his entire tale — exactly the stretch
// the golden's middle scenes live in. First-person surfaces inside his
// narrator spans ARE sightings of him, at reduced weight because a pronoun is
// weaker evidence than a name and also sweeps up quoted "I" from others.
//
// Stratification is not decoration: forward surprise is measured against an
// accumulating history, so early text scores high by construction. Unmasked
// and unstratified, eoreader5 measured 12/12 selected spans landing in the
// first 27.5% of War and Peace.

import { readFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { resolveNarratorSpans } from "../packages/engine/perceiver/text/narrator.js";

const TEXT_PATH = "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const COREF_PATH = "scripts/adversarial/fixtures/pg84-frankenstein.coref.json";
const GOLDEN_PATH = "/Users/mlacy/Documents/Default Project/eoreader5/packages/engine/emergence/summary/golden/span-golden.json";

const SENTENCES_PER_FRAME = 4;
const HISTORY = 40;          // bounded sliding window, in frames
const K = parseInt(process.argv[2] || "12", 10);
const FIRST_PERSON_WEIGHT = 0.5;

const raw = readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const { text, offset: containerOffset } = stripContainer(raw);
const coref = JSON.parse(readFileSync(COREF_PATH, "utf8"));
const prior = coref.referents.find((r) => r.id === "creature");
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
const scenes = GOLDEN.entities.find((e) => e.entity === "creature").scenes;

const { resolved: narratorSpans } = resolveNarratorSpans(text, "creature", prior.narratorSpans);
const inNarration = (off) => narratorSpans.some((s) => off >= s.from && off < s.to);

// ── frames ──────────────────────────────────────────────────────────────────
const sentences = splitSentences(text);
const frames = [];
for (let i = 0; i < sentences.length; i += SENTENCES_PER_FRAME) {
  const g = sentences.slice(i, i + SENTENCES_PER_FRAME);
  if (g.length) frames.push({ order: frames.length, offset: g[0].offset, text: g.map((s) => s.text).join(" ") });
}

// ── presence: named surfaces + first-person INSIDE his own narration ────────
const WORD_RE = /[\p{L}\p{N}']+/gu;
const words = (t) => String(t ?? "").toLowerCase().match(WORD_RE) ?? [];
const FIRST_PERSON = new Set(["i", "me", "my", "mine", "myself"]);
const surfaces = prior.surfaces.map((s) => s.surface.toLowerCase());

const presenceOf = (f) => {
  const lower = f.text.toLowerCase();
  let n = 0;
  for (const s of surfaces) {
    let i = lower.indexOf(s);
    while (i !== -1) { n++; i = lower.indexOf(s, i + s.length); }
  }
  if (inNarration(f.offset)) {
    for (const w of words(f.text)) if (FIRST_PERSON.has(w)) n += FIRST_PERSON_WEIGHT;
  }
  return n;
};

// ── forward surprise against a bounded sliding window ───────────────────────
const dist = (ws) => {
  const m = new Map();
  for (const w of ws) m.set(w, (m.get(w) ?? 0) + 1);
  for (const [w, c] of m) m.set(w, c / ws.length);
  return m;
};
const kl = (obs, exp, eps = 1e-10) => {
  let d = 0;
  for (const [t, p] of obs) if (p > 0) d += p * Math.log2(p / Math.max(exp.get(t) ?? eps, eps));
  return Math.max(0, d);
};

const history = [];
const scored = [];
for (const f of frames) {
  const ws = words(f.text);
  if (ws.length >= 15 && history.length > 0) {
    const combined = new Map();
    for (const h of history) for (const [w, p] of dist(h)) combined.set(w, (combined.get(w) ?? 0) + p);
    for (const [w, p] of combined) combined.set(w, p / history.length);
    const surprise = kl(dist(ws), combined);
    const presence = presenceOf(f);
    // MEASURED DEAD END — do not retry as-is. Multiplying by a dialogue term
    // (1 + log1p(quote marks)) made recall WORSE: 3/7 -> 2/7 at K=12 and
    // 4/7 -> 3/7 at K=24. It newly caught `thy-creature`, a speech scene, so
    // the observable is real; but Frankenstein is dense with dialogue, and
    // boosting all of it lets ordinary speech outcompete significant speech
    // inside a stratum. eoreader5 does not boost dialogue generically — it
    // extracts TYPED events and gates them on TURNING_EVENT_TYPES. The
    // distinction is not "is there speech" but "is this a turning kind of
    // speech", and that is the documented remaining gap here.
    scored.push({ ...f, surprise, presence, score: surprise * Math.log1p(presence) });
  }
  if (ws.length) { history.push(ws); if (history.length > HISTORY) history.shift(); }
}

// ── stratified selection across the WHOLE extent ────────────────────────────
const present = scored.filter((s) => s.presence > 0);
const lo = present[0].offset, hi = present[present.length - 1].offset + 1;
const strata = Array.from({ length: K }, () => []);
for (const s of present) strata[Math.min(K - 1, Math.floor(((s.offset - lo) / (hi - lo)) * K))].push(s);
const moments = strata.map((b) => b.sort((a, c) => c.score - a.score)[0]).filter(Boolean)
  .sort((a, b) => a.offset - b.offset);

// ── score against the frozen golden ─────────────────────────────────────────
const tol = GOLDEN.tolerance;
let hits = 0;
const lines = [];
for (const sc of scenes) {
  const at = text.indexOf(sc.anchor);
  if (at === -1) { lines.push(`  ??   ${sc.id} (anchor missing)`); continue; }
  const hit = moments.some((m) => Math.abs(m.offset - at) <= tol);
  if (hit) hits++;
  lines.push(`  ${hit ? "HIT " : "MISS"} ${((at / text.length) * 100).toFixed(1).padStart(5)}%  ${sc.kind.padEnd(20)} ${sc.id}`);
}

console.log(`READING Frankenstein for ONE REFERENT — ${frames.length} frames, ${present.length} with presence`);
console.log(`narrator spans: ${narratorSpans.length}, covering ${((narratorSpans.reduce((t, s) => t + (s.to - s.from), 0) / text.length) * 100).toFixed(1)}% of the text\n`);
console.log(`recall ${hits}/${scenes.length}   (eoreader5 on this entity: 4/7; its TOTAL best across 3 entities: 5/21)\n`);
for (const l of lines) console.log(l);

console.log(`\nthe ${moments.length} moments selected:\n`);
for (const m of moments) {
  const pct = ((m.offset / text.length) * 100).toFixed(1);
  console.log(`── ${pct}%  surprise ${m.surprise.toFixed(2)}  presence ${m.presence.toFixed(1)}`);
  console.log(`   ${m.text.replace(/\s+/g, " ").slice(0, 200)}…\n`);
}

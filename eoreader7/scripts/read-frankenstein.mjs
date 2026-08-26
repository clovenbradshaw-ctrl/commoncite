// eoreader6 · read-frankenstein — an actual reading, left to right.
//
// The measurement unit is the SENTENCE — the perceiver's own unit. There is
// no sentence-grouping, no stratum count, no word-count floor: a frame is
// not a hand-written thing here, it is one measurement per sentence against
// a belief the reader rebuilds.
//
// BELIEF. A distribution over word forms, bounded by the declared `window`
// (the reach of the present: how many sentences' forms feed the prior) and
// decayed by the declared `gamma` (how much of the prior the posterior
// keeps).
//
// SURPRISE. Bayesian belief-shift, D_KL(posterior || prior) — surprise.js's
// collapse-as-measurement structure: surprise is concentrated at discrete
// measurement events, and the windows of surprise are the intervals between
// them.
//
// NULL. The Born-shaped null — the reader's own belief CARRIED ON: `draws`
// continuations sampled from the prior itself (surprise.js's
// priorContinuationNull), scored with the same bayesianSurprise. A sentence
// whose surprise the prior's own continuation cannot produce is censored
// above — surfeit, `exceeds_witness`, exactly what nul's difference() names.
//
// WINDOWS. A run of consecutive exceedances IS a window of surprise,
// discovered rather than declared.
//
// The numbers below are DECLARED, never defaulted — they are the physiology
// of this reading, stated as such. Everything else is gone.
//
// The first sentences seed belief and are not measured: a first ground is
// received, never derived (SEED.md #1).

import { readFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { bayesianSurprise, priorContinuationNull } from "../packages/engine/emergence/surprise.js";
import { received, difference, isGap } from "../nul/index.js";
import { readForward } from "../packages/engine/emergence/activation.js";
import { extractSurfaces, discoverReferents, diaNorm } from "../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../packages/engine/perceiver/text/material.js";
import { projectReferents } from "../packages/engine/referents/index.js";
import { readLinks, bindingTriples } from "../packages/engine/emergence/binding.js";

// ── declared, never defaulted ───────────────────────────────────────────────
const WINDOW = 12;   // reach of the present: sentences feeding the prior
const DRAWS = 200;   // resolution of testimony: finest rank sayable is 1/draws
const GAMMA = 0.9;   // recency decay: posterior = GAMMA*prior + arrival
const ALPHA = 1;     // smoothing: the cost a form never read still carries

// ── binding declared numbers ────────────────────────────────────────────────
const BINDING_WINDOW = 2;    // co-arrival window: how close in sentence index
const BINDING_DRAWS = 199;   // null draws for displacement, reversal, reseed

const WORD_RE = /[\p{L}\p{N}']+/gu;
const words = (t) => String(t ?? "").toLowerCase().match(WORD_RE) ?? [];
const countsOf = (ws) => {
  const m = new Map();
  for (const w of ws) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
};

const TEXT_PATH = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const { text } = stripContainer(readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
const sentences = splitSentences(text);

// ── entity tracking for binding (received measurement) ──────────────────────
const table = buildFrequencyTable(tokenize(text));
const functionWords = functionWordSet(table);
const allSurfaces = extractSurfaces(sentences, { functionWords });
const cast = projectReferents(discoverReferents(allSurfaces).events).filter((r) => !r.mergedInto);

// Build a surface→referent lookup (diaNorm, same as read-ladder.mjs)
const surfaceToReferent = [];
for (const r of cast) for (const s of r.surfaces) {
  const n = diaNorm(s);
  if (n.length < 2) continue;
  surfaceToReferent.push([n, new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u"), r.id]);
}
surfaceToReferent.sort((a, b) => b[0].length - a[0].length);

const referentArrivals = new Map(); // referentId -> [sentenceIndex, ...]

const windowArrivals = [];
let prior = new Map();
let priorTotal = 0;

const observations = [];

const advance = (arrival) => {
  windowArrivals.push(arrival);
  for (const [f, c] of arrival) { prior.set(f, (prior.get(f) ?? 0) + c); priorTotal += c; }
  while (windowArrivals.length > WINDOW) {
    const drop = windowArrivals.shift();
    for (const [f, c] of drop) {
      const left = prior.get(f) - c;
      if (left <= 0) prior.delete(f); else prior.set(f, left);
      priorTotal -= c;
    }
  }
};

for (let i = 0; i < sentences.length; i++) {
  const s = sentences[i];
  const ws = words(s.text);
  if (ws.length === 0) continue;
  const arrival = countsOf(ws);

  // ── entity tracking: which referents appear in this sentence ───────────
  for (const [surface, re, refId] of surfaceToReferent) {
    if (re.test(s.text)) {
      const arr = referentArrivals.get(refId);
      if (!arr) referentArrivals.set(refId, [i]);
      else if (arr[arr.length - 1] !== i) arr.push(i);
    }
  }

  if (priorTotal === 0) { advance(arrival); continue; } // nothing measured against a first ground

  const kl = bayesianSurprise(prior, priorTotal, arrival, ws.length, { gamma: GAMMA, alpha: ALPHA });
  const samples = priorContinuationNull(prior, priorTotal, ws.length, { gamma: GAMMA, alpha: ALPHA, draws: DRAWS, seed: i });
  const g = received({ samples, provenance: "the reader's own prior, carried on" });
  const d = difference(kl, g);
  const exceeded = isGap(d) && d.gap === "exceeds_witness" && d.direction === "above";

  observations.push({
    order: i, offset: s.offset, text: s.text, kl,
    exceeded,
    nullMax: samples ? samples[samples.length - 1] : null,
  });

  advance(arrival);
}

// ── runs of exceedance ARE the windows — nothing else selects ───────────────
const windows = [];
let run = null;
for (const o of observations) {
  if (o.exceeded) { if (!run) run = []; run.push(o); }
  else if (run) { windows.push(run); run = null; }
}
if (run) windows.push(run);

// ── binding: modality-blind Link over entity arrivals ───────────────────────
const entityRegister = [...referentArrivals.entries()]
  .filter(([, arr]) => arr.length >= 2)
  .map(([id, arrivals]) => ({ id, arrivals: arrivals.sort((a, b) => a - b) }));

let bindingLinks = [];
let witnessedLinks = [];
if (entityRegister.length >= 2) {
  bindingLinks = readLinks(entityRegister, {
    window: BINDING_WINDOW,
    draws: BINDING_DRAWS,
    seed: 42,
    totalUnits: sentences.length,
  });
  witnessedLinks = bindingLinks.filter((l) => l.direction !== null);
}

// ── the associative-memory channel, same sentences, no future ───────────────
const { records } = readForward(sentences.map((s, i) => ({ order: i, offset: s.offset, text: s.text })));
const recalledAt = new Map(records.map((r) => [r.order, r.recalled]));
const windowRecall = (w) => Math.max(...w.map((o) => recalledAt.get(o.order) ?? 0));

const exceeds = observations.filter((o) => o.exceeded).length;
console.log(`READING ${TEXT_PATH.split("/").pop()} — ${sentences.length} sentences, ${observations.length} measured against belief`);
console.log(`declared: window ${WINDOW} sentences, gamma ${GAMMA}, draws ${DRAWS}, alpha ${ALPHA}`);
console.log(`${exceeds} exceedances in ${windows.length} discovered windows (no stratum, no frame, no floor)`);
console.log(`binding: ${entityRegister.length} entities, ${bindingLinks.length} pairs tested, ${witnessedLinks.length} witnessed (window ${BINDING_WINDOW}, draws ${BINDING_DRAWS})\n`);

for (const w of windows) {
  const peak = w.reduce((a, b) => (b.kl > a.kl ? b : a));
  const fromPct = ((w[0].offset / text.length) * 100).toFixed(1);
  const toPct = ((w[w.length - 1].offset / text.length) * 100).toFixed(1);
  const shown = peak.text.length > 200 ? peak.text.replace(/\s+/g, " ").slice(0, 200).replace(/\s+\S*$/, "") + "…" : peak.text.replace(/\s+/g, " ");
  console.log(`── ${fromPct}%–${toPct}%  run of ${w.length}  peak KL ${peak.kl.toFixed(3)}  recalled ${windowRecall(w)} prior passages`);
  console.log(`   ${shown}\n`);
}

if (witnessedLinks.length > 0) {
  console.log(`═══ WITNESSED LINKS ═══`);
  for (const l of witnessedLinks.slice(0, 10)) {
    const from = l.direction === "a→b" ? l.a.id : l.b.id;
    const to = l.direction === "a→b" ? l.b.id : l.a.id;
    console.log(`  ${from} → ${to}  polarity=${l.polarity}  strength=${l.strength.toFixed(4)}  disp=${l.nulls.displacement.pValue.toFixed(3)} rev=${l.nulls.reversal.pValue.toFixed(3)} reseed=${l.nulls.reseed.pValue.toFixed(3)}`);
  }
}

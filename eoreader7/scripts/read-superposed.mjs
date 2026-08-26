// eoreader6 · read-superposed — a superposition of possible readings, collapsed.
//
// TAKEN LITERALLY. A "reading" of a figure is an answer to the question "how
// does this sit against noise?" — and there are two structurally different
// noisemakers in nul, shuffle and resample. Holding the SAME figure against
// BOTH of them at once is a superposition of two possible readings, and the
// collapse is disagreement():
//
//   both place          → COLLAPSED, a definite rank
//   both censor above   → COLLAPSED, definite surfeit
//   both censor below   → COLLAPSED, definite regularity (NOT surfeit — never pooled)
//   one places, one censors → LIVE. The superposition did not collapse, and
//     that split is the most informative signal this system can produce
//     (SEED.md #6: "censored differences are kept, not dropped").
//
// AND AT EVERY LEVEL. The same two families are held against the same evidence
// at each altitude the read rises through:
//
//   L1 FIGURE   — each window of the surprise series against both grounds.
//   L2 PATTERN  — did the figure move the ground it was measured against?
//                 Asked per family, and the two verdicts must agree to collapse.
//   L3 LEVEL    — above/below/peer, via crossFamilyLevel() (family.js), which
//                 already refuses to average two families into one verdict.
//   L4 TIER     — the evidence folded through two tier stacks that forget at
//                 different rates: a fast reader and a slow reader are two
//                 possible readings of how high a moment reached. Agree → the
//                 altitude is real. Differ → the altitude is live.
//
// The material is the per-sentence Bayesian surprise series of Frankenstein,
// read causally — no future ever enters a ground. The first HISTORY surprises
// are received, not derived (SEED.md #1), and measured against nothing.
//
// The control is shuffleControl (surrogates.mjs): the whole L1 read rerun on
// the surprise series with its order destroyed. If the collapse statistics
// survive shuffling, the reading is the series' arithmetic, not its order.
//
// Everything is DECLARED, never defaulted — these are the physiology of this
// reading, stated as such.

import { readFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { bayesianSurprise } from "../packages/engine/emergence/surprise.js";
import { ground, difference, pattern, disagreement, isGap } from "../nul/index.js";
import { crossFamilyLevel } from "../packages/engine/loops/samanya.js";
import { createTierStack, foldThrough } from "../packages/engine/emergence/tiers.js";
import { shuffleControl } from "./lib/surrogates.mjs";

// ── declared, never defaulted ───────────────────────────────────────────────
const WINDOW = 12;    // reach of the present: statistic window, in surprises
const HISTORY = 48;   // how much past surprise a ground is built over (same spec, comparable extents)
const DRAWS = 128;    // resolution of testimony: finest rank sayable is 1/draws
const RESEEDS = 16;   // resolution of pattern
const GAMMA = 0.9;    // recency decay of the belief that produces the surprise series
const ALPHA = 1;      // smoothing cost of a form never read
const SEED = 0;       // the received stream; the engine holds no randomness, it receives one

const FAMILIES = ["shuffle", "resample"];

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

// ── the material: a causal surprise series ──────────────────────────────────
// One KL per measured sentence, belief over a sliding window of word-forms,
// never touching the future. This is the perceiver's own reduction. The raw
// word-count series is built alongside as a SECOND reduction — if a cascade
// is order-insensitive on the surprise series but not on the raw one, the
// reduction was the blind spot, not the superposition.
const series = [];
const rawSeries = [];
const sentenceOf = []; // measured-series index → sentence index
const windowArrivals = [];
let prior = new Map();
let priorTotal = 0;

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
  const ws = words(sentences[i].text);
  if (ws.length === 0) continue;
  const arrival = countsOf(ws);
  if (priorTotal > 0) {
    series.push(bayesianSurprise(prior, priorTotal, arrival, ws.length, { gamma: GAMMA, alpha: ALPHA }));
    rawSeries.push(ws.length);
    sentenceOf.push(i);
  }
  advance(arrival);
}
const n = series.length;
const mean = series.reduce((a, b) => a + b, 0) / n;
const sd = Math.sqrt(series.reduce((a, b) => a + (b - mean) ** 2, 0) / n);

// ── the full cascade, one superposition per level ───────────────────────────
const TIER_NAMES = ["atmosphere", "lens", "paradigm"];
// TWO SUPERPOSED STACKS, and what makes them differ is now the one thing this
// script is actually about: the reach of the present. A fast reader and a slow
// reader are two WINDOWS over the same material, not two hand-picked gamma
// ladders — gamma is derived from window inside tiers.js (1 - 1/window), and
// no tier carries a number of its own. The altitude ladder inside each stack
// comes from the fold, not from a per-tier ramp.
const FAST_WINDOW = 4;          // a present that reaches four observations
const SLOW_WINDOW = WINDOW * 2; // and one that reaches twenty-four
const makeTiers = () => [
  createTierStack(["fast-atmosphere", "fast-lens", "fast-paradigm"], { window: FAST_WINDOW, draws: DRAWS, seed: SEED }),
  createTierStack(["slow-atmosphere", "slow-lens", "slow-paradigm"], { window: SLOW_WINDOW, draws: DRAWS, seed: SEED + 100 }),
];

const readFigures = (s) => {
  const rows = [];
  for (let i = HISTORY; i + WINDOW <= s.length; i++) {
    let sum = 0;
    for (let j = i; j < i + WINDOW; j++) sum += s[j];
    const observed = sum / WINDOW;
    const material = s.slice(i - HISTORY, i); // causal: the past only, same extent
    const diffs = FAMILIES.map((perturbation, f) =>
      difference(observed, ground({ material, draws: DRAWS, window: WINDOW, seed: 0, perturbation })),
    );
    const classes = diffs.map((d) => {
      if (!isGap(d)) return "placed";
      if (d.gap === "exceeds_witness") return d.direction === "above" ? "surfeit" : "regularity";
      return d.gap;
    });
    const agree = classes[0] === classes[1];
    rows.push({ at: i, observed, classes, collapsed: agree, live: !agree, disagreement: disagreement(diffs) });
  }
  return rows;
};

const cascade = (s) => {
  // L1 FIGURE — the superposition collapses here, per window.
  const figures = readFigures(s);
  const tally = {};
  for (const r of figures) {
    const key = r.collapsed ? `collapsed:${r.classes[0]}` : "live";
    tally[key] = (tally[key] ?? 0) + 1;
  }
  const eventRows = figures.filter((r) => r.collapsed && r.classes[0] === "surfeit");
  const liveRows = figures.filter((r) => r.live);

  // L2 PATTERN — did a definite surfeit move its own ground? Both families
  // must agree the ground moved, or the pattern did not collapse.
  const patternRows = [];
  for (const r of eventRows) {
    const beforeSlice = s.slice(r.at - HISTORY, r.at);
    const afterSlice = s.slice(r.at - HISTORY, Math.min(s.length, r.at + WINDOW));
    const familyPatterns = FAMILIES.map((perturbation, f) => {
      const before = ground({ material: beforeSlice, draws: DRAWS, window: WINDOW, seed: 0, perturbation });
      const after = ground({ material: afterSlice, draws: DRAWS, window: WINDOW, seed: 0, perturbation });
      return pattern({ before, after, material: beforeSlice, reseeds: RESEEDS });
    });
    const gaps = familyPatterns.filter(isGap);
    const moved = familyPatterns.filter((p) => !isGap(p) && p.moved);
    patternRows.push({
      at: r.at,
      movedCount: moved.length,
      movedBoth: moved.length === 2,
      split: !gaps.length && moved.length === 1,
      gapped: gaps.length,
      opened: moved.length === 2 ? moved[0].opened === true && moved[1].opened === true : null,
    });
  }

  // L3 LEVEL — above/below/peer, cross-family, for each run of surfeits.
  const surfeitRuns = [];
  for (const r of eventRows) {
    const last = surfeitRuns[surfeitRuns.length - 1];
    if (last && last.at + 1 === r.at) last.at = r.at;
    else surfeitRuns.push({ at: r.at });
  }
  const levelRows = [];
  for (const run of surfeitRuns) {
    const ownMaterial = s.slice(Math.max(0, run.at - HISTORY), run.at);
    const targetMaterial = s.slice(run.at, Math.min(s.length, run.at + HISTORY));
    if (ownMaterial.length < WINDOW + 2 || targetMaterial.length < WINDOW) continue;
    levelRows.push({ at: run.at, ...crossFamilyLevel({ ownMaterial, targetMaterial, window: WINDOW, draws: DRAWS, seed: 0 }) });
  }

  // L4 TIERS — the same evidence folded through a fast and a slow reader.
  // Agreeing altitude = the altitude collapsed; disagreeing = it is live.
  const [fast, slow] = makeTiers();
  const tierRows = [];
  for (const r of eventRows) {
    const arrival = countsOf(words(sentences[sentenceOf[r.at]].text));
    if (!arrival.size) continue;
    const rf = foldThrough(fast, arrival);
    const rs = foldThrough(slow, arrival);
    const fastAlt = rf.top ? TIER_NAMES.indexOf(rf.top.replace("fast-", "")) : null;
    const slowAlt = rs.top ? TIER_NAMES.indexOf(rs.top.replace("slow-", "")) : null;
    tierRows.push({ at: r.at, collapsed: fastAlt !== null && fastAlt === slowAlt, reached: rf.reached });
  }

  return { figures, tally, eventRows, liveRows, patternRows, levelRows, tierRows };
};

const result = cascade(series);
const rawResult = cascade(rawSeries);
const CONTROL_RUNS = 12;
const controlSummary = (s) => {
  const control = shuffleControl(s, cascade, CONTROL_RUNS, 73);
  const summary = control.reduce((a, c) => {
    for (const [k, v] of Object.entries(c.tally)) a.tally[k] = (a.tally[k] ?? 0) + v;
    a.pattern.movedBoth += c.patternRows.filter((r) => r.movedBoth).length;
    a.pattern.opened += c.patternRows.filter((r) => r.opened === true).length;
    a.level.stable += c.levelRows.filter((r) => r.stable).length;
    a.tier.collapsed += c.tierRows.filter((r) => r.collapsed).length;
    return a;
  }, { tally: {}, pattern: { movedBoth: 0, opened: 0 }, level: { stable: 0 }, tier: { collapsed: 0 } });
  for (const k of Object.keys(summary.tally)) summary.tally[k] = summary.tally[k] / CONTROL_RUNS;
  for (const k of Object.keys(summary.pattern)) summary.pattern[k] = summary.pattern[k] / CONTROL_RUNS;
  for (const k of Object.keys(summary.level)) summary.level[k] = summary.level[k] / CONTROL_RUNS;
  for (const k of Object.keys(summary.tier)) summary.tier[k] = summary.tier[k] / CONTROL_RUNS;
  return summary;
};
const control = controlSummary(series);
const rawControl = controlSummary(rawSeries);

// ── output ──────────────────────────────────────────────────────────────────
const shown = (sIdx) => {
  const s = sentences[sIdx];
  const t = s.text.replace(/\s+/g, " ").trim();
  return t.length > 180 ? t.slice(0, 180).replace(/\s+\S*$/, "") + "…" : t;
};
const pct = (sIdx) => ((sentenceOf[sIdx] ? sentences[sentenceOf[sIdx]].offset : sentences[sIdx].offset) / text.length * 100).toFixed(1);

console.log(`READING ${TEXT_PATH.split("/").pop()} — ${sentences.length} sentences → ${n} measured surprises`);
console.log(`declared: window ${WINDOW}, history ${HISTORY}, draws ${DRAWS}, reseeds ${RESEEDS}, gamma ${GAMMA}, alpha ${ALPHA}`);
console.log(`surprise series: mean ${mean.toFixed(3)}  sd ${sd.toFixed(3)}\n`);

const report = (label, { figures, tally, eventRows, liveRows, patternRows, levelRows, tierRows }, ctrl, detailed) => {
  console.log(`${label}:`);
  console.log(`  L1 FIGURE — collapse vs shuffle-control (${CONTROL_RUNS} reads):`);
  for (const [k, v] of Object.entries(tally)) console.log(`    ${k}: ${v}   (control ${ctrl.tally[k] ? ctrl.tally[k].toFixed(1) : "—"})`);
  console.log(`  L2 PATTERN — ${eventRows.length} definite surfeits: movedBoth ${patternRows.filter((r) => r.movedBoth).length}   (control ${ctrl.pattern.movedBoth.toFixed(1)}); opened ${patternRows.filter((r) => r.opened === true).length}   (control ${ctrl.pattern.opened.toFixed(1)})`);
  console.log(`  L3 LEVEL — ${levelRows.length} region pairs: stable ${levelRows.filter((r) => r.stable).length}   (control ${ctrl.level.stable.toFixed(1)}), split ${levelRows.filter((r) => r.split).length}`);
  console.log(`  L4 TIERS — ${tierRows.length} surfeits: altitude collapsed ${tierRows.filter((r) => r.collapsed).length}   (control ${ctrl.tier.collapsed.toFixed(1)}), highest tier ${tierRows.filter((r) => r.collapsed && r.reached === 3).length}`);
  if (!detailed) return;

  console.log(`  LIVE superpositions at L1 (${liveRows.length}):`);
  for (const r of liveRows.slice(0, 6)) console.log(`    ${pct(r.at)}%  ${r.classes.join(" | ")}  — ${shown(sentenceOf[r.at])}`);
  const encounter = patternRows.filter((r) => r.movedBoth && r.opened === true);
  console.log(`  collapsed encounters (${encounter.length}):`);
  for (const r of encounter.slice(0, 6)) console.log(`    ${pct(r.at)}%  — ${shown(sentenceOf[r.at])}`);
  const stable = levelRows.filter((r) => r.stable);
  for (const r of stable.slice(0, 4)) console.log(`  L3 stable: ${pct(r.at)}%  ${r.relations.map((x) => x.relationship).join("/")}  (${r.resolvedCount}/2 families)`);
  const top = tierRows.filter((r) => r.collapsed && r.reached === 3);
  for (const r of top.slice(0, 4)) console.log(`  L4 highest: ${pct(r.at)}%  — ${shown(sentenceOf[r.at])}`);
  console.log("");
};

report("SURPRISE MATERIAL (KL per sentence)", result, control, true);
report("RAW MATERIAL (word count per sentence)", rawResult, rawControl, true);

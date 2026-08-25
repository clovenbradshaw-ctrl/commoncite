// eoreader6 · predictor-reshape — the high tier sets the probability of the
// low. Not a swapped model: REVISED CONTROL PARAMETERS.
//
// Usage: node scripts/predictor-reshape.mjs
//
// predictor-atmosphere.mjs established the signal: a predictor's own per-form
// loss stream, read through the SAME ground()/pattern() machinery loops/turn.js
// uses on content, produces a correctly-timed `moved` event at a genuine regime
// change. This script is what a predictor-Atmosphere's REC does with that event
// — and the design is deliberately NOT "swap to a different candidate model."
//
// The two defects already on record in this codebase (belief.js's ungated lone
// gift, the abstraction-as-backoff pathology, and the slot-gated refutation in
// predictor-scientist.mjs) are the same category error: a higher-order signal
// given a LIKELIHOOD role, a vote sized by its own evidence, competing with what
// is already there. `slotExpectation`'s beta is the one place that gets this
// right instead — a PRIOR role, reshaping what the existing terms mean without
// itself appearing as a term.
//
// So: ONE model is trained, once, on prose only — tables at every order up to
// ORDER_MAX, and continuation stats, all collected in the same pass. Nothing
// below is ever retrained. What DEF/EVA/REC revise is the CONFIG {order, alpha,
// continuation} that `massOf` reads that same trained evidence under — three
// control parameters, not one, closing the gap the first version of this script
// left open (it only ever revised alpha within a fixed order=4 table, so the
// champion static config — order=2, continuation-count — was never reachable by
// reshaping at all).
//
// AND THE LIVE CONFIG STARTS AT THE ALREADY-KNOWN CHAMPION (order=2 alpha=1.5
// continuation), not at a deliberately weak one. The first version's one
// witnessed correction fired by fixing a bad starting point, which is a
// different claim than "this mechanism adapts to a regime change." Starting
// already-good means any later witnessed event can ONLY be read as genuine
// adaptation to something that changed, not cleanup of what was wrong from the
// start.
//
//   DEF   nominate candidate {order, alpha, continuation} CHEAPLY: score every
//         config in the grid on the window that just triggered the moved event
//         (no null — that is the cheap step; same nominate-then-witness shape
//         slots.js already uses).
//   EVA   witness the best candidate against the SAME reseedNull `pattern()`
//         already computed to detect the regime change — no second null
//         invented. The improvement must beat the noise floor this exact
//         ground already measured, or the revision is refused, not applied.
//   REC   if witnessed, the live config is revised going forward. If not, the
//         event is logged as moved-but-unwitnessed and the config holds.
//
// Compared against: a FIXED naive config (what the first version of this
// script used throughout), the fixed CHAMPION config held for the whole run
// (the bar that actually matters — predictor-scientist.mjs Experiment 3), and
// a HARD MODEL SWAP (retrain a second predictor on chrome-adjacent material
// and switch wholesale) — the thing this design explicitly is NOT, kept as a
// comparison rather than a strawman.
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER_MAX = 6; // deepest table trained; every config reads a <= this
const NAIVE_CONFIG = { order: 4, alpha: 0.7, continuation: false }; // what the first version held fixed throughout
const CHAMPION_CONFIG = { order: 2, alpha: 1.5, continuation: true }; // predictor-scientist.mjs Experiment 3's winner, and this run's STARTING live config
const ORDER_CANDIDATES = [2, 4, 6];
const ALPHA_CANDIDATES = [0.3, 0.7, 1.5, 3.0];
const CONTINUATION_CANDIDATES = [true, false];
const TRAIN_SIZE = 30000;
const HELDOUT_GAP = 15000;
const HELDOUT_SPAN = 4000;
const LOSS_WINDOW = 40;
const DRAWS = 32;
const RESEEDS = 16;
const STEP = 150;
const SEED = 20260731;

import { readFileSync } from "node:fs";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { ground, pattern } from "../nul/index.js";

const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const tokenize = (raw) => stripContainer(raw).text.toLowerCase().match(WORD) ?? [];

const raw = readFileSync("scripts/corpus/pg84.txt", "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const startMark = "*** START OF THE PROJECT GUTENBERG EBOOK";
const endMark = "*** END OF THE PROJECT GUTENBERG EBOOK";
const startIdx = raw.indexOf(startMark);
const endIdx = raw.indexOf(endMark);
const proseRaw = raw.slice(startIdx + startMark.length, endIdx);
const chromeRaw = raw.slice(endIdx);
const prose = tokenize(proseRaw);
const chrome = chromeRaw.toLowerCase().match(WORD) ?? [];

const CTX_SEP = "";
/** One model, trained once, readable under any {order<=ORDER_MAX, alpha, continuation} config. */
class Model {
  constructor({ orderMax }) {
    this.orderMax = orderMax;
    this.tables = Array.from({ length: orderMax + 1 }, () => new Map());
    this.continuationOf = new Map();
    this.continuationTotal = 0;
  }
  train(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j <= this.orderMax; j++) {
        if (i - j < 0) break;
        const key = j === 0 ? "" : tokens.slice(i - j, i).join(CTX_SEP);
        let entry = this.tables[j].get(key);
        if (!entry) { entry = { succ: new Map(), total: 0 }; this.tables[j].set(key, entry); }
        entry.succ.set(tokens[i], (entry.succ.get(tokens[i]) ?? 0) + 1);
        entry.total++;
      }
      // always collected, regardless of which config eventually reads it —
      // the same evidence, kept available under every counting rule.
      const prev = i >= 1 ? tokens[i - 1] : " START";
      let set = this.continuationOf.get(tokens[i]);
      if (!set) { set = new Set(); this.continuationOf.set(tokens[i], set); }
      if (!set.has(prev)) { set.add(prev); this.continuationTotal++; }
    }
    return this;
  }
  /** massOf(ctx, form, {order, alpha, continuation}) — a pure READ of the one trained model. */
  massOf(ctx, form, config) {
    const order = Math.min(config.order, this.orderMax);
    const alpha = config.alpha;
    let mass = 0, remaining = 1;
    const reach = Math.min(order, ctx.length);
    for (let j = reach; j >= 1; j--) {
      const key = ctx.slice(ctx.length - j).join(CTX_SEP);
      const entry = this.tables[j].get(key);
      if (!entry || !(entry.total > 0)) continue;
      const share = remaining * (entry.total / (entry.total + alpha));
      const c = entry.succ.get(form);
      if (c) mass += (share * c) / entry.total;
      remaining -= share;
      if (remaining <= 0) return { mass, reserve: 0 };
    }
    const entry0 = this.tables[0].get("");
    if (entry0 && entry0.total > 0) {
      const share = remaining * (entry0.total / (entry0.total + alpha));
      let p0 = 0;
      if (config.continuation && this.continuationTotal > 0) {
        p0 = (this.continuationOf.get(form)?.size ?? 0) / this.continuationTotal;
      } else {
        const c = entry0.succ.get(form);
        p0 = c ? c / entry0.total : 0;
      }
      mass += share * p0;
      remaining -= share;
    }
    return { mass, reserve: Math.max(0, remaining) };
  }
}

const reigning = new Model({ orderMax: ORDER_MAX }).train(prose.slice(0, TRAIN_SIZE));

/** per-form -log(mass or reserve) under a GIVEN config, causal, context reaching into `before`. */
const lossAt = (before, span, config) => {
  const out = new Array(span.length);
  for (let i = 0; i < span.length; i++) {
    const history = i === 0 ? before : [...before.slice(Math.max(0, before.length - config.order + i)), ...span.slice(0, i)];
    const ctx = history.slice(Math.max(0, history.length - config.order));
    const { mass, reserve } = reigning.massOf(ctx, span[i], config);
    const p = mass > 0 ? mass : reserve;
    out[i] = p > 0 ? -Math.log(p) : -Math.log(Number.MIN_VALUE);
  }
  return out;
};
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const configLabel = (c) => `order=${c.order} alpha=${c.alpha}${c.continuation ? " cont" : ""}`;

const heldoutStart = TRAIN_SIZE + HELDOUT_GAP;
const before0 = prose.slice(0, heldoutStart);
const spliceSpan = [...prose.slice(heldoutStart, heldoutStart + HELDOUT_SPAN), ...chrome];
const spliceBoundary = HELDOUT_SPAN;

const CONFIG_GRID = ORDER_CANDIDATES.flatMap((order) =>
  ALPHA_CANDIDATES.flatMap((alpha) => CONTINUATION_CANDIDATES.map((continuation) => ({ order, alpha, continuation }))),
);

console.log(`declared   order_max=${ORDER_MAX} grid=${CONFIG_GRID.length} configs (orders=[${ORDER_CANDIDATES}] alphas=[${ALPHA_CANDIDATES}] continuation=[${CONTINUATION_CANDIDATES}])`);
console.log(`           loss_window=${LOSS_WINDOW} draws=${DRAWS} reseeds=${RESEEDS} step=${STEP}`);
console.log(`live config starts at the CHAMPION (${configLabel(CHAMPION_CONFIG)}), not a weak one — closing the first run's confound.`);
console.log(`splice stream: ${spliceSpan.length} forms, chrome begins at index ${spliceBoundary}\n`);

// ── ARM A: the naive fixed config the first version of this script used throughout ──
const naiveLoss = lossAt(before0, spliceSpan, NAIVE_CONFIG);
console.log(`ARM A — fixed ${configLabel(NAIVE_CONFIG)} throughout (naive):`);
console.log(`  prose region (0..${spliceBoundary}):   mean ${meanOf(naiveLoss.slice(0, spliceBoundary)).toFixed(3)} nats/form`);
console.log(`  chrome region (${spliceBoundary}..end): mean ${meanOf(naiveLoss.slice(spliceBoundary)).toFixed(3)} nats/form`);

// ── ARM D: the champion, fixed for the whole run — the bar that actually matters ──
const championLoss = lossAt(before0, spliceSpan, CHAMPION_CONFIG);
console.log(`\nARM D — fixed ${configLabel(CHAMPION_CONFIG)} throughout (the champion, no machinery):`);
console.log(`  prose region (0..${spliceBoundary}):   mean ${meanOf(championLoss.slice(0, spliceBoundary)).toFixed(3)} nats/form`);
console.log(`  chrome region (${spliceBoundary}..end): mean ${meanOf(championLoss.slice(spliceBoundary)).toFixed(3)} nats/form`);

// ── ARM B: hard swap — retrain a SEPARATE model on chrome-adjacent material at
// the detected boundary and switch wholesale. The thing this design is
// deliberately NOT; kept only as the comparison it earns. ─────────────────
const chromeModel = new Model({ orderMax: ORDER_MAX }).train(chrome.length > 200 ? chrome.slice(0, Math.floor(chrome.length / 2)) : chrome);

// ── ARM C: same reigning model, tables untouched, CONFIG reshaped on witnessed
// REC events, starting from the champion. ──────────────────────────────────
let reshapeLog = [];
let liveConfig = { ...CHAMPION_CONFIG };
const reshapedLoss = new Array(spliceSpan.length);
let cursor = 0;
let lossHistory = [];
let b = LOSS_WINDOW * 2;
for (; cursor < Math.min(b, spliceSpan.length); cursor++) {
  const history = cursor === 0 ? before0 : [...before0.slice(Math.max(0, before0.length - liveConfig.order + cursor)), ...spliceSpan.slice(0, cursor)];
  const ctx = history.slice(Math.max(0, history.length - liveConfig.order));
  const { mass, reserve } = reigning.massOf(ctx, spliceSpan[cursor], liveConfig);
  const p = mass > 0 ? mass : reserve;
  reshapedLoss[cursor] = p > 0 ? -Math.log(p) : -Math.log(Number.MIN_VALUE);
  lossHistory.push(reshapedLoss[cursor]);
}

while (b + STEP <= spliceSpan.length) {
  const beforeMat = lossHistory.slice(0, b);
  const stepLoss = [];
  for (let k = 0; k < STEP && cursor < spliceSpan.length; k++, cursor++) {
    const history = [...before0.slice(Math.max(0, before0.length - liveConfig.order + cursor)), ...spliceSpan.slice(0, cursor)];
    const ctx = history.slice(Math.max(0, history.length - liveConfig.order));
    const { mass, reserve } = reigning.massOf(ctx, spliceSpan[cursor], liveConfig);
    const p = mass > 0 ? mass : reserve;
    const loss = p > 0 ? -Math.log(p) : -Math.log(Number.MIN_VALUE);
    reshapedLoss[cursor] = loss;
    stepLoss.push(loss);
  }
  lossHistory.push(...stepLoss);
  const afterMat = lossHistory.slice(0, b + STEP);

  const gBefore = ground({ material: beforeMat, draws: DRAWS, window: LOSS_WINDOW, statistic: "windowMean", perturbation: "shuffle", seed: SEED });
  const gAfter = ground({ material: afterMat, draws: DRAWS, window: LOSS_WINDOW, statistic: "windowMean", perturbation: "shuffle", seed: SEED });
  if (!gBefore.gap && !gAfter.gap) {
    const pat = pattern({ before: gBefore, after: gAfter, material: beforeMat, reseeds: RESEEDS });
    if (!pat.gap && pat.moved) {
      // DEF: nominate every config in the grid cheaply on the window that just triggered this.
      const recentSpan = spliceSpan.slice(Math.max(0, b - STEP), b + STEP);
      const recentCtxBefore = [...before0, ...spliceSpan.slice(0, Math.max(0, b - STEP))];
      const candidateLoss = CONFIG_GRID.map((cfg) => meanOf(lossAt(recentCtxBefore, recentSpan, cfg)));
      const bestIdx = candidateLoss.reduce((best, v, i) => (v < candidateLoss[best] ? i : best), 0);
      const oldLoss = meanOf(lossAt(recentCtxBefore, recentSpan, liveConfig));
      const improvement = oldLoss - candidateLoss[bestIdx];
      // EVA: the improvement must beat the SAME reseedNull pattern() already computed for this ground.
      const witnessed = improvement > pat.reseedNull;
      reshapeLog.push({ at: b, from: { ...liveConfig }, proposed: CONFIG_GRID[bestIdx], improvement, threshold: pat.reseedNull, witnessed });
      if (witnessed) liveConfig = { ...CONFIG_GRID[bestIdx] };
    }
  }
  b += STEP;
}

console.log(`\nARM C — reshaped config (order+alpha+continuation), REC events, starting from the champion:`);
reshapeLog.forEach((e) =>
  console.log(
    `  at ${e.at}: ${configLabel(e.from)} -> proposed ${configLabel(e.proposed)}, improvement ${e.improvement.toFixed(4)} vs threshold ${e.threshold.toFixed(4)} — ${e.witnessed ? "WITNESSED, applied" : "refused, held"}`,
  ),
);
if (reshapeLog.length === 0) console.log(`  no moved events fired.`);
console.log(`  prose region (0..${spliceBoundary}):   mean ${meanOf(reshapedLoss.slice(0, spliceBoundary)).toFixed(3)} nats/form`);
console.log(`  chrome region (${spliceBoundary}..end): mean ${meanOf(reshapedLoss.slice(spliceBoundary)).toFixed(3)} nats/form`);

// ARM B scored properly now that we know where witnessed events (if any) landed:
const swapPoint = reshapeLog.find((e) => e.witnessed)?.at ?? spliceBoundary;
const bLossPre = lossAt(before0, spliceSpan.slice(0, swapPoint), NAIVE_CONFIG);
const chromeBefore = [...before0, ...spliceSpan.slice(0, swapPoint)];
const bLossPost = spliceSpan.slice(swapPoint).map((form, i) => {
  const ctx = [...chromeBefore, ...spliceSpan.slice(swapPoint, swapPoint + i)].slice(-NAIVE_CONFIG.order);
  const { mass, reserve } = chromeModel.massOf(ctx, form, NAIVE_CONFIG);
  const p = mass > 0 ? mass : reserve;
  return p > 0 ? -Math.log(p) : -Math.log(Number.MIN_VALUE);
});
console.log(`\nARM B — hard swap to a chrome-trained model at ${swapPoint}:`);
console.log(`  prose region:  mean ${meanOf(bLossPre).toFixed(3)} nats/form`);
console.log(`  chrome region: mean ${meanOf(bLossPost).toFixed(3)} nats/form`);

console.log(`\n── overall mean nats/form, whole splice stream ──`);
console.log(`  fixed naive (${configLabel(NAIVE_CONFIG)}):            ${meanOf(naiveLoss).toFixed(3)}`);
console.log(`  hard model swap:                                ${meanOf([...bLossPre, ...bLossPost]).toFixed(3)}`);
console.log(`  fixed champion (${configLabel(CHAMPION_CONFIG)}):     ${meanOf(championLoss).toFixed(3)}`);
console.log(`  witnessed config reshaping (from champion):     ${meanOf(reshapedLoss).toFixed(3)}`);
console.log(`\nthe reshaping apparatus only earns its complexity if it beats the FIXED CHAMPION, not just the naive arm — and it is now starting FROM the champion, so any win has to be genuine adaptation.`);

// ── DID THE ONLINE MECHANISM MISS A GENUINELY BETTER CHROME-SPECIFIC CONFIG? ──
// The live config settled at index 980 and held unchanged through the entire
// chrome region — no event ever proposed something different once inside it.
// That is consistent with two very different explanations: (a) the grid
// genuinely has nothing better for chrome specifically, so "one correction
// that holds through both" is the CORRECT answer, or (b) something better
// exists in the grid and the online walk (STEP=150 windows, gated by a
// threshold built for detecting the FIRST regime shift) never surfaced it.
// Score every grid config directly against DEEP chrome material — well past
// any boundary transition — to tell the two apart.
const deepChromeStart = spliceBoundary + Math.min(1500, Math.floor((spliceSpan.length - spliceBoundary) / 2));
const deepChrome = spliceSpan.slice(deepChromeStart);
const deepChromeBefore = [...before0, ...spliceSpan.slice(0, deepChromeStart)];
console.log(`\n── is there a genuinely better config for chrome the online walk missed? ──`);
console.log(`scoring the full ${CONFIG_GRID.length}-config grid directly against ${deepChrome.length} forms of DEEP chrome (from index ${deepChromeStart}, past any boundary transition):\n`);
const deepChromeScores = CONFIG_GRID.map((cfg) => ({ cfg, loss: meanOf(lossAt(deepChromeBefore, deepChrome, cfg)) }));
deepChromeScores.sort((a, b) => a.loss - b.loss);
const liveOnDeepChrome = deepChromeScores.find((s) => s.cfg.order === liveConfig.order && s.cfg.alpha === liveConfig.alpha && s.cfg.continuation === liveConfig.continuation);
deepChromeScores.slice(0, 5).forEach((s, i) => console.log(`  #${i + 1}  ${configLabel(s.cfg).padEnd(28)} ${s.loss.toFixed(3)} nats/form${s === liveOnDeepChrome ? "   <- what the online walk actually settled on" : ""}`));
if (!deepChromeScores.slice(0, 5).includes(liveOnDeepChrome)) {
  const rank = 1 + deepChromeScores.indexOf(liveOnDeepChrome);
  console.log(`  ...\n  #${rank}  ${configLabel(liveConfig).padEnd(28)} ${liveOnDeepChrome.loss.toFixed(3)} nats/form   <- what the online walk actually settled on`);
}
const gridBest = deepChromeScores[0];
const missedGap = liveOnDeepChrome.loss - gridBest.loss;
console.log(`\nbest-in-grid for deep chrome: ${configLabel(gridBest.cfg)} at ${gridBest.loss.toFixed(3)}. what the walk is actually running: ${configLabel(liveConfig)} at ${liveOnDeepChrome.loss.toFixed(3)}.`);
console.log(
  missedGap > 0.05
    ? `GAP OF ${missedGap.toFixed(3)} nats/form: the online mechanism left real, findable improvement on the table for chrome specifically — a genuinely better config exists in its own grid and it never proposed switching to it.`
    : `GAP OF ${missedGap.toFixed(3)} nats/form, effectively none: what the walk settled on IS (at or near) the best available config for chrome too. "One correction that holds through both regions" is the correct answer here, not a missed opportunity.`,
);

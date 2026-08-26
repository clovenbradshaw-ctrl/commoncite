// eoreader6 · predictor-reshape-crossbook — does config reshaping ever propose
// GENUINELY DIFFERENT configs for two regions, or does one config just win
// everywhere tested so far?
//
// Usage: node scripts/predictor-reshape-crossbook.mjs
//
// predictor-reshape.mjs's prose -> Gutenberg-license splice turned out to be
// too extreme a test: checked directly, the SAME config (order=2 alpha=3
// continuation) was the #1 best choice in the whole grid for both regions —
// there was no genuine regime-specific choice available even in principle, so
// "one correction that holds through both" was the correct answer, not a
// missed opportunity. Boilerplate is degenerate for this question: heavily
// smoothed, short-context, continuation-counting configs dominate almost any
// text that isn't narrative prose, so pitting prose against it never tests
// whether TWO GENUINE REGISTERS want different treatment.
//
// This script asks the sharper version: a reader trained ONLY on Frankenstein
// prose reads held-out Frankenstein, then crosses into held-out HEIDI prose —
// a different novel, different author, different era, still real narrative
// prose throughout, no boilerplate anywhere. If regime-specific reshaping is
// real, this is where it should show up: two registers close enough in KIND
// that a single global config might still serve both, but different enough in
// STYLE that the DEEP-region diagnostic (borrowed unchanged from
// predictor-reshape.mjs) might, this time, actually find a gap.
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER_MAX = 6;
const NAIVE_CONFIG = { order: 4, alpha: 0.7, continuation: false };
const CHAMPION_CONFIG = { order: 2, alpha: 1.5, continuation: true };
const ORDER_CANDIDATES = [2, 4, 6];
const ALPHA_CANDIDATES = [0.3, 0.7, 1.5, 3.0];
const CONTINUATION_CANDIDATES = [true, false];
const TRAIN_SIZE = 30000;
const HELDOUT_GAP = 15000;
const HELDOUT_SPAN = 4000; // Frankenstein forms before the splice into Heidi
const HEIDI_SPAN = 4000; // Heidi forms after the splice
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

const frankRaw = readFileSync("scripts/corpus/pg84.txt", "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const heidiRaw = readFileSync("scripts/corpus/pg20781.txt", "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const prose = tokenize(frankRaw); // stripContainer already removes both books' Gutenberg boilerplate
const heidi = tokenize(heidiRaw);

const CTX_SEP = "";
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
      const prev = i >= 1 ? tokens[i - 1] : " START";
      let set = this.continuationOf.get(tokens[i]);
      if (!set) { set = new Set(); this.continuationOf.set(tokens[i], set); }
      if (!set.has(prev)) { set.add(prev); this.continuationTotal++; }
    }
    return this;
  }
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
const spliceSpan = [...prose.slice(heldoutStart, heldoutStart + HELDOUT_SPAN), ...heidi.slice(0, HEIDI_SPAN)];
const spliceBoundary = HELDOUT_SPAN;

const CONFIG_GRID = ORDER_CANDIDATES.flatMap((order) =>
  ALPHA_CANDIDATES.flatMap((alpha) => CONTINUATION_CANDIDATES.map((continuation) => ({ order, alpha, continuation }))),
);

console.log(`declared   order_max=${ORDER_MAX} grid=${CONFIG_GRID.length} configs, loss_window=${LOSS_WINDOW} draws=${DRAWS} reseeds=${RESEEDS} step=${STEP}`);
console.log(`reader trained ONLY on Frankenstein prose (${TRAIN_SIZE} forms). splice: held-out Frankenstein (${HELDOUT_SPAN}) -> held-out Heidi (${HEIDI_SPAN}), both real narrative prose, no boilerplate.`);
console.log(`live config starts at the CHAMPION (${configLabel(CHAMPION_CONFIG)}). Heidi begins at index ${spliceBoundary}.\n`);

const naiveLoss = lossAt(before0, spliceSpan, NAIVE_CONFIG);
const championLoss = lossAt(before0, spliceSpan, CHAMPION_CONFIG);
console.log(`fixed naive (${configLabel(NAIVE_CONFIG)}):     Frankenstein ${meanOf(naiveLoss.slice(0, spliceBoundary)).toFixed(3)}   Heidi ${meanOf(naiveLoss.slice(spliceBoundary)).toFixed(3)}`);
console.log(`fixed champion (${configLabel(CHAMPION_CONFIG)}):  Frankenstein ${meanOf(championLoss.slice(0, spliceBoundary)).toFixed(3)}   Heidi ${meanOf(championLoss.slice(spliceBoundary)).toFixed(3)}`);

// ── the DEF/EVA/REC walk, unchanged in structure from predictor-reshape.mjs ──
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
      const recentSpan = spliceSpan.slice(Math.max(0, b - STEP), b + STEP);
      const recentCtxBefore = [...before0, ...spliceSpan.slice(0, Math.max(0, b - STEP))];
      const candidateLoss = CONFIG_GRID.map((cfg) => meanOf(lossAt(recentCtxBefore, recentSpan, cfg)));
      const bestIdx = candidateLoss.reduce((best, v, i) => (v < candidateLoss[best] ? i : best), 0);
      const oldLoss = meanOf(lossAt(recentCtxBefore, recentSpan, liveConfig));
      const improvement = oldLoss - candidateLoss[bestIdx];
      const witnessed = improvement > pat.reseedNull;
      reshapeLog.push({ at: b, from: { ...liveConfig }, proposed: CONFIG_GRID[bestIdx], improvement, threshold: pat.reseedNull, witnessed });
      if (witnessed) liveConfig = { ...CONFIG_GRID[bestIdx] };
    }
  }
  b += STEP;
}

console.log(`\nREC events:`);
reshapeLog.forEach((e) =>
  console.log(
    `  at ${e.at} (${e.at < spliceBoundary ? "Frankenstein" : "Heidi"}): ${configLabel(e.from)} -> proposed ${configLabel(e.proposed)}, improvement ${e.improvement.toFixed(4)} vs threshold ${e.threshold.toFixed(4)} — ${e.witnessed ? "WITNESSED, applied" : "refused, held"}`,
  ),
);
if (reshapeLog.length === 0) console.log(`  none fired.`);
console.log(`\nwitnessed config reshaping:  Frankenstein ${meanOf(reshapedLoss.slice(0, spliceBoundary)).toFixed(3)}   Heidi ${meanOf(reshapedLoss.slice(spliceBoundary)).toFixed(3)}`);
console.log(`overall: ${meanOf(reshapedLoss).toFixed(3)} nats/form (champion fixed: ${meanOf(championLoss).toFixed(3)})`);

// ── the direct check: what IS the true best config for each region, scored ──
// on deep, transition-free material — same diagnostic as predictor-reshape.mjs.
const scoreGrid = (before, span) => {
  const scores = CONFIG_GRID.map((cfg) => ({ cfg, loss: meanOf(lossAt(before, span, cfg)) }));
  scores.sort((a, b) => a.loss - b.loss);
  return scores;
};
const deepFrank = prose.slice(heldoutStart + 500, heldoutStart + spliceBoundary - 500);
const deepFrankBefore = before0;
const deepHeidiStart = spliceBoundary + Math.min(1500, Math.floor(HEIDI_SPAN / 2));
const deepHeidi = spliceSpan.slice(deepHeidiStart);
const deepHeidiBefore = [...before0, ...spliceSpan.slice(0, deepHeidiStart)];

const frankScores = scoreGrid(deepFrankBefore, deepFrank);
const heidiScores = scoreGrid(deepHeidiBefore, deepHeidi);

console.log(`\n── the true best config per region (deep, transition-free material) ──`);
console.log(`Frankenstein (${deepFrank.length} forms): best = ${configLabel(frankScores[0].cfg)} at ${frankScores[0].loss.toFixed(3)}`);
frankScores.slice(0, 3).forEach((s, i) => console.log(`  #${i + 1} ${configLabel(s.cfg).padEnd(28)} ${s.loss.toFixed(3)}`));
console.log(`Heidi (${deepHeidi.length} forms):        best = ${configLabel(heidiScores[0].cfg)} at ${heidiScores[0].loss.toFixed(3)}`);
heidiScores.slice(0, 3).forEach((s, i) => console.log(`  #${i + 1} ${configLabel(s.cfg).padEnd(28)} ${s.loss.toFixed(3)}`));

const sameWinner = frankScores[0].cfg.order === heidiScores[0].cfg.order && frankScores[0].cfg.alpha === heidiScores[0].cfg.alpha && frankScores[0].cfg.continuation === heidiScores[0].cfg.continuation;
console.log(
  sameWinner
    ? `\nSAME config wins both regions (${configLabel(frankScores[0].cfg)}) — no genuine regime-specific choice exists on this axis for these two books either. A single global config remains correct.`
    : `\nDIFFERENT configs win: Frankenstein wants ${configLabel(frankScores[0].cfg)}, Heidi wants ${configLabel(heidiScores[0].cfg)} — a genuine regime-specific choice exists. Whether the online walk actually FOUND it is the question the REC log above answers.`,
);

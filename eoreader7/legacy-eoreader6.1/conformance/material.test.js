// eoreader6 · material — causalSurprisalSeries's `gamma` (2026-08-05).
//
// Challenge #7 (scripts/adversarial/challenge-7-rec-re-zero-atmosphere-
// boundary-correctn.mjs) traced its remaining failures to causal surprisal's
// own content-independent upward drift: an unseen word's cost,
// log2(table.total+1), is guaranteed to rise for as long as a document runs,
// regardless of topic, because `table.total` only ever grows. `gamma` bounds
// it to a decaying window of recent reading (belief.js's own device, SEED.md
// Amendment IV.2). See material.js's own header on `causalSurprisalSeries`
// for the real-text measurement (Frankenstein, r: 0.443 -> -0.270 at
// gamma=0.999) this repeats in miniature, deterministically, without a
// fixture.

import { test } from "node:test";
import assert from "node:assert/strict";
import { causalSurprisalSeries, tokenize, chunkWords } from "../packages/engine/perceiver/text/material.js";

const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pearson = (xs, ys) => {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  return cov / Math.sqrt(vx * vy);
};

// A STATIONARY vocabulary read at length: a fixed Zipfian pool (2000 word
// types, exponent 1 — real language's own approximate exponent) sampled in a
// fixed pseudo-random order. No topic shift is possible — there is only one
// topic, the pool, drawn from the same fixed distribution throughout — so
// any upward trend in the causal series is by construction the estimator's
// own artefact, never content. The heavy tail matters: with too small or too
// flat a pool, every type recurs often enough to converge fast and the
// drift this exists to reproduce never shows up (a uniform 50-word pool at
// this length does not; caught by running this before trusting it).
const ZIPF_POOL = 2000;
const zipfCumulative = (() => {
  const weights = Array.from({ length: ZIPF_POOL }, (_, i) => 1 / (i + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const cum = [];
  let acc = 0;
  for (const w of weights) { acc += w / total; cum.push(acc); }
  return cum;
})();
const zipfSample = (u) => {
  let lo = 0, hi = zipfCumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (zipfCumulative[mid] < u) lo = mid + 1; else hi = mid;
  }
  return lo;
};
const stationaryWords = (n, seed) => {
  const next = rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) out.push(`w${zipfSample(next())}`);
  return out;
};

test("gamma defaults to 1 and reproduces causalSurprisalSeries's pre-decay output bit-for-bit", () => {
  const words = stationaryWords(2000, 7);
  const chunks = chunkWords(words, 40);
  const bare = causalSurprisalSeries(chunks);
  const explicit = causalSurprisalSeries(chunks, { gamma: 1 });
  assert.equal(bare.length, explicit.length);
  for (let i = 0; i < bare.length; i++) assert.equal(bare[i], explicit[i], `chunk ${i} differs at gamma=1`);
});

test("gamma is declared in (0,1] — 0, negative, above 1, and non-finite all refuse", () => {
  const chunks = chunkWords(stationaryWords(200, 1), 40);
  for (const bad of [0, -0.5, 1.0001, 2, NaN, Infinity]) {
    assert.throws(() => causalSurprisalSeries(chunks, { gamma: bad }), /gamma/, `gamma=${bad} must throw`);
  }
});

test("gamma=1 still drifts upward with position on a stationary vocabulary — the defect this fix targets is real", () => {
  const chunks = chunkWords(stationaryWords(6000, 11), 40);
  const series = causalSurprisalSeries(chunks);
  const r = pearson(series.map((_, i) => i), series);
  assert.ok(r > 0.2, `expected material.js's own documented drift (content-independent, gamma=1) to show up here too, got r=${r}`);
});

test("gamma<1 measurably flattens that same drift — belief.js's decay device transplanted", () => {
  const chunks = chunkWords(stationaryWords(6000, 11), 40);
  const undecayed = causalSurprisalSeries(chunks);
  const decayed = causalSurprisalSeries(chunks, { gamma: 0.98 });
  const positions = chunks.map((_, i) => i);
  const rUndecayed = pearson(positions, undecayed);
  const rDecayed = pearson(positions, decayed);
  assert.ok(
    rDecayed < rUndecayed - 0.2,
    `expected gamma=0.98 to reduce the position/series correlation well below gamma=1's, got undecayed r=${rUndecayed} decayed r=${rDecayed}`,
  );
});

test("gamma<1 does not change the first chunk's score — there is no history yet to decay", () => {
  const chunks = chunkWords(stationaryWords(400, 3), 40);
  const undecayed = causalSurprisalSeries(chunks);
  const decayed = causalSurprisalSeries(chunks, { gamma: 0.9 });
  assert.equal(undecayed[0], decayed[0], "the opening self-entropy chunk has no table to decay");
});

test("causalSurprisalSeries stays causal under decay too — later chunks never move an earlier score", () => {
  // Same invariant the undecayed function already had (comment above it):
  // a chunk's score depends only on chunks strictly before it. Appending
  // more material after a prefix must not change any score already reported
  // for that prefix, decayed or not.
  const words = stationaryWords(2000, 21);
  const chunks = chunkWords(words, 40);
  const prefix = chunks.slice(0, 20);
  const gamma = 0.97;
  const full = causalSurprisalSeries(chunks, { gamma });
  const prefixOnly = causalSurprisalSeries(prefix, { gamma });
  for (let i = 0; i < prefixOnly.length; i++) {
    assert.ok(Math.abs(full[i] - prefixOnly[i]) < 1e-6, `chunk ${i} moved when material after it changed`);
  }
});

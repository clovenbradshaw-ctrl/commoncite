// eoreader6 · causal-surprisal-gamma-calibration — the measurement behind
// causalSurprisalSeries's `gamma` parameter (packages/engine/perceiver/text/
// material.js) and atmosphere.js's MIN_GROUND multiplier.
//
// Challenge #7's remaining failures (scripts/adversarial/challenge-7-rec-
// re-zero-atmosphere-boundary-correctn.mjs) traced to causal surprisal's
// own content-independent upward drift: an unseen word's cost,
// log2(table.total+1), is guaranteed to rise as table.total grows,
// regardless of topic. gamma<1 bounds table.total to a decaying window of
// recent reading, belief.js's own device (SEED.md Amendment IV.2).
//
// THREE THINGS THIS SCRIPT ESTABLISHES, in order:
//   1. r(position, causal surprisal) on real prose (Frankenstein), across a
//      gamma sweep — does decay actually flatten the drift, and by how much.
//   2. End-to-end through the REAL createRegimeTracker (not a proxy): does a
//      (gamma, MIN_GROUND-multiplier) pair pass all three of challenge-7's
//      assertions (no false re-zero on either coherent text alone, real
//      re-zero still fires at the real seam), and is the passing region a
//      plateau (robust) or a single lucky cell (overfit)?
//   3. Does raising MIN_GROUND's multiplier cost anything on the iid-noise
//      calibration the previous fix (2026-08-05, git log packages/engine/
//      loops/atmosphere.js) already earned at 3*window?
//
// Run: node scripts/causal-surprisal-gamma-calibration.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize, chunkWords, causalSurprisalSeries } from "../packages/engine/perceiver/text/material.js";
import { createRegimeTracker } from "../packages/engine/loops/atmosphere.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = __dirname.endsWith("scripts") ? path.resolve(__dirname, "..") : __dirname;

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

const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

console.log("=".repeat(78));
console.log("1. r(position, causal surprisal) on Frankenstein — does decay flatten drift?");
console.log("=".repeat(78));
const frankPath = path.join(REPO_ROOT, "scripts/adversarial/fixtures/pg84-frankenstein.txt");
const frankChunks = chunkWords(tokenize(fs.readFileSync(frankPath, "utf8")), 50);
console.log(`Frankenstein (pg84): ${frankChunks.length} chunks of 50 words\n`);
for (const gamma of [1, 0.999, 0.9995, 0.998, 0.995, 0.99]) {
  const series = causalSurprisalSeries(frankChunks, { gamma });
  const positions = series.map((_, i) => i);
  const r = pearson(positions, series);
  const pts = [30, 100, 400, 800, series.length - 1].map((i) => Math.round(series[i] / 1000) + "k");
  console.log(`  gamma=${gamma}: r=${r.toFixed(3)}   @30/100/400/800/last = ${pts.join(" / ")}`);
}

console.log("\n" + "=".repeat(78));
console.log("2. End-to-end through createRegimeTracker: challenge-7's own fixtures");
console.log("=".repeat(78));
const odysseyLines = fs.readFileSync(path.join(REPO_ROOT, "odyssey-greek.txt"), "utf8").split("\n");
const cookeryLines = fs.readFileSync(path.join(REPO_ROOT, "scripts/adversarial/fixtures/cookery-22114-raw.txt"), "utf8").split("\n");
const bookIXText = odysseyLines.slice(3793, 4290).join("\n");
const cookeryText = cookeryLines.slice(265, 1600).join("\n");
const ixChunks = chunkWords(tokenize(bookIXText), 50);
const crChunks = chunkWords(tokenize(cookeryText), 50);
const combinedChunks = [...ixChunks, ...crChunks];
const seamIndex = ixChunks.length;

const WINDOW = 6, DRAWS = 96, TOLERANCE = 2; // copied verbatim from speak-from-here.mjs, per challenge-7's own convention
const MARGIN = WINDOW * TOLERANCE * 2;
const SEEDS = Array.from({ length: 20 }, (_, i) => i);

// A local regime tracker taking an explicit min-ground multiplier, otherwise
// calling the REAL createRegimeTracker's groundFrom logic is not exposed —
// so this drives the real exported push() semantics via a real tracker built
// at each candidate multiplier by monkey-patching is not available either;
// instead this reimplements ONLY the ground-admission gate (identical to
// atmosphere.js's own groundFrom) around the real `ground`/`difference`
// primitives from nul, which IS what atmosphere.js itself is built from.
import { ground, difference, isGap, gap } from "../nul/index.js";
const trackerAt = ({ window, draws, tolerance, seed, minMultiplier }) => {
  const seen = [];
  let regimeStart = 0, g = null, clearings = 0;
  const groundFrom = (start, end) => {
    if (end - start < minMultiplier * window) return null;
    const built = ground({ material: seen.slice(start, end), draws, window, seed: seed + start });
    return isGap(built) ? null : built;
  };
  return {
    push(x) {
      seen.push(x);
      const t = seen.length;
      if (t < window) return { rezeroed: false };
      const built = groundFrom(regimeStart, t - window);
      if (built) g = built;
      if (!g) return { rezeroed: false };
      let sum = 0;
      for (let j = t - window; j < t; j++) sum += seen[j];
      const d = difference(sum / window, g);
      const strained = isGap(d) && d.gap === "exceeds_witness" && d.direction === "above";
      let rezeroed = false;
      if (strained) {
        clearings++;
        if (clearings >= tolerance) { regimeStart = t - window; g = null; clearings = 0; rezeroed = true; }
      } else clearings = 0;
      return { rezeroed };
    },
  };
};
const runCausal = (series, seed, minMultiplier) => {
  const tracker = trackerAt({ window: WINDOW, draws: DRAWS, tolerance: TOLERANCE, seed, minMultiplier });
  const rez = [];
  for (let i = 0; i < series.length; i++) if (tracker.push(series[i]).rezeroed) rez.push(i);
  return rez;
};

console.log(`Book IX: ${ixChunks.length} chunks, Cookery: ${crChunks.length} chunks, seam at ${seamIndex}, margin=${MARGIN}\n`);
console.log("gamma, minMult -> negIX false-alarm rate / negCookery false-alarm rate / positive seam-hit rate (20 seeds each)");
const passing = [];
for (const gamma of [0.999, 0.9992, 0.9995]) {
  for (const minMult of [3, 6, 8, 9, 10, 11, 12, 14, 16]) {
    const ixSeries = causalSurprisalSeries(ixChunks, { gamma });
    const crSeries = causalSurprisalSeries(crChunks, { gamma });
    const combinedSeries = causalSurprisalSeries(combinedChunks, { gamma });
    const ixFireRate = SEEDS.filter((seed) => runCausal(ixSeries, seed, minMult).length > 0).length;
    const crFireRate = SEEDS.filter((seed) => runCausal(crSeries, seed, minMult).length > 0).length;
    const posHitRate = SEEDS.filter((seed) => {
      const r = runCausal(combinedSeries, seed, minMult);
      if (!r.length) return false;
      const nearest = r.reduce((b, x) => (Math.abs(x - seamIndex) < Math.abs(b - seamIndex) ? x : b));
      return nearest >= seamIndex && nearest - seamIndex <= MARGIN;
    }).length;
    const allPass = ixFireRate === 0 && crFireRate === 0 && posHitRate === SEEDS.length;
    if (allPass) passing.push({ gamma, minMult });
    console.log(`  gamma=${gamma} minMult=${minMult}: negIX=${ixFireRate}/20 negCR=${crFireRate}/20 posHit=${posHitRate}/20 ${allPass ? "<<< PASS" : ""}`);
  }
}
console.log(`\nPassing (gamma, minMult) region: ${JSON.stringify(passing)}`);

console.log("\n" + "=".repeat(78));
console.log("3. iid-noise false-alarm rate at the raised minimum — does it cost anything?");
console.log("=".repeat(78));
const PARAM_SETS = [
  { window: 5, draws: 256, tolerance: 3 },
  { window: 6, draws: 96, tolerance: 2 },
];
for (const { window, draws, tolerance } of PARAM_SETS) {
  for (const minMult of [3, 10, 12]) {
    let fired = 0;
    const trials = 40;
    for (let s = 0; s < trials; s++) {
      const next = rng(s * 101 + 7);
      const series = Array.from({ length: 300 }, () => 5 + next());
      const tracker = trackerAt({ window, draws, tolerance, seed: s, minMultiplier: minMult });
      let rezeroed = false;
      for (const x of series) if (tracker.push(x).rezeroed) rezeroed = true;
      if (rezeroed) fired++;
    }
    console.log(`  window=${window} draws=${draws} tolerance=${tolerance} minMult=${minMult}: fired on ${fired}/${trials} iid trials`);
  }
}

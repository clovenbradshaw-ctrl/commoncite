// eoreader6 · rec-recourse-locality — checking Atmosphere's REC firing
// against the online-algorithms "recourse" literature (Gupta et al.,
// arXiv:2308.01406 and the surrounding line of work on bounded-recourse
// online algorithms), on the user's own two most-checkable claims:
//
//   1. Locality: at each REC (re-zero) event, how much of the material read
//      so far did the ground rebuild actually touch — and does that
//      fraction trend toward 1 as the read grows? If it does, REC is not
//      "recourse" in the bounded sense that literature means; it is a
//      periodic full offline resort wearing REC's name.
//   2. Amortized recourse per turn: total ground-rebuild touch-set summed
//      across a read, divided by turns (pushes/steps) taken. The literature
//      bounds this at O(polylog T) amortized; this script measures what it
//      actually is here, on real material, using the SAME parameters
//      (window/draws/tolerance/hop) and the SAME chunking (CHUNK_WORDS=40,
//      gamma=1) packages/host/terrains.js actually wires into the shipped
//      Atmosphere surface — not a hypothetical configuration.
//
// This is a measurement, not a redesign. atmosphere.js's own groundFrom
// gate now accumulates `recomputeWork` on every attempted ground rebuild
// (packages/engine/loops/atmosphere.js) — the two numbers below are read
// off that accumulator, not re-derived.
//
// Run: node scripts/rec-recourse-locality.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize, chunkWords, causalSurprisalSeries } from "../packages/engine/perceiver/text/material.js";
import { readAtmosphere, createRegimeTracker } from "../packages/engine/loops/atmosphere.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = __dirname.endsWith("scripts") ? path.resolve(__dirname, "..") : __dirname;

// Copied verbatim from packages/host/terrains.js's ATMOSPHERE_REGIME and
// CHUNK_WORDS — not exported from that module, so duplicated here rather
// than reached for; this is the actual shipped configuration, not a swept
// parameter set.
const ATMOSPHERE_REGIME = { window: 5, draws: 256, tolerance: 3, hop: 5 };
const CHUNK_WORDS = 40;

const pearson = (xs, ys) => {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
};

const seriesFor = (text) => {
  const chunks = chunkWords(tokenize(text), CHUNK_WORDS);
  return causalSurprisalSeries(chunks); // gamma left at its own default (1), matching terrains.js
};

const measure = (label, filePath) => {
  console.log("=".repeat(78));
  console.log(label);
  console.log("=".repeat(78));
  const text = fs.readFileSync(filePath, "utf8");
  const series = seriesFor(text);
  console.log(`${series.length} chunks of ${CHUNK_WORDS} words`);

  // ── 1. Locality per REC event, over one full causal read ────────────────
  const regime = readAtmosphere({ material: series, ...ATMOSPHERE_REGIME });
  if (regime.gap) {
    console.log(`readAtmosphere refused: ${JSON.stringify(regime.gap)}`);
    return null;
  }
  const rezeroRegions = regime.regions.slice(0, -1); // the last region closes on material running out, not REC — same exclusion regime.rezeroCount already makes
  console.log(`\nregions: ${regime.regions.length} total, ${regime.rezeroCount} closed by REC, ${regime.clearingCount} clearings`);
  console.log("\nper-REC-event touch-set as a fraction of material read so far:");
  const idx = [];
  const frac = [];
  rezeroRegions.forEach((r, k) => {
    const touched = r.end - r.start;
    const fraction = touched / r.end;
    idx.push(k);
    frac.push(fraction);
    console.log(`  REC #${k + 1} @ step ${r.end}: touched ${touched} of ${r.end} steps read (${(fraction * 100).toFixed(1)}%)`);
  });
  const trend = rezeroRegions.length >= 3 ? pearson(idx, frac) : null;
  console.log(
    trend === null
      ? "  (fewer than 3 REC events — no trend computed)"
      : `  trend: r(REC index, touch-set fraction) = ${trend.toFixed(3)} — ${
          trend > 0.3 ? "GROWING toward 1: locality is degrading as history accumulates" : trend < -0.3 ? "SHRINKING: locality improves as history accumulates" : "flat: no evidence the fraction grows with history"
        }`,
  );

  console.log(`\nbatch amortized recompute work: ${regime.recomputeWork} touched over ${regime.stepsRead} steps = ${regime.recomputeWorkPerStep.toFixed(2)} per step`);

  // ── 2. Amortized recourse per turn, as a running series ─────────────────
  // The streaming tracker (createRegimeTracker) is the "per turn" framing —
  // loops/surf.js and loops/reading-regime.js push into it one arrival at a
  // time, which is the actual online-turn shape this literature's bounds are
  // stated over. Sampling amortizedRecourse() periodically across one full
  // push sequence gives the running series without re-running the read.
  const tracker = createRegimeTracker({ window: ATMOSPHERE_REGIME.window, draws: ATMOSPHERE_REGIME.draws, tolerance: ATMOSPHERE_REGIME.tolerance, seed: 0 });
  const sampleEvery = Math.max(1, Math.floor(series.length / 10));
  const samples = [];
  for (let i = 0; i < series.length; i++) {
    tracker.push(series[i]);
    if ((i + 1) % sampleEvery === 0 || i === series.length - 1) {
      samples.push({ turn: i + 1, amortized: tracker.amortizedRecourse });
    }
  }
  console.log("\namortized recourse per turn, sampled across the read (streaming tracker):");
  for (const s of samples) console.log(`  turn ${s.turn}: ${s.amortized === null ? "null" : s.amortized.toFixed(2)}`);
  const validSamples = samples.filter((s) => s.amortized !== null);
  const amortizedTrend = validSamples.length >= 3 ? pearson(validSamples.map((s) => s.turn), validSamples.map((s) => s.amortized)) : null;
  console.log(
    amortizedTrend === null
      ? "  (not enough samples for a trend)"
      : `  trend: r(turn, amortized recourse) = ${amortizedTrend.toFixed(3)} — ${
          amortizedTrend > 0.3 ? "GROWING: amortized cost per turn is rising as history accumulates" : amortizedTrend < -0.3 ? "SHRINKING toward a floor" : "flat: bounded amortized recourse on this material"
        }`,
  );

  return { label, trend, amortizedTrend, rezeroCount: regime.rezeroCount, steps: regime.stepsRead };
};

const results = [
  measure("Frankenstein (pg84, 7741 lines)", path.join(REPO_ROOT, "scripts/adversarial/fixtures/pg84-frankenstein.txt")),
  measure("Heart of Darkness (3354 lines)", path.join(REPO_ROOT, "scripts/adversarial/fixtures/heart-of-darkness.txt")),
].filter(Boolean);

console.log("\n" + "=".repeat(78));
console.log("SUMMARY");
console.log("=".repeat(78));
for (const r of results) {
  console.log(
    `${r.label}: ${r.rezeroCount} REC events over ${r.steps} steps — locality trend ${r.trend === null ? "n/a" : r.trend.toFixed(3)}, amortized-cost trend ${r.amortizedTrend === null ? "n/a" : r.amortizedTrend.toFixed(3)}`,
  );
}

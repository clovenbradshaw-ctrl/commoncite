// eoreader6 · def-eva-rec-test — is the moved/opened -> REC/EVA split real,
// or just a plausible-sounding label? Testable prediction: REC ("cultivate
// new ground") should correspond to passes where the NEWLY read material is
// genuinely more novel (higher reader-relative causal surprisal) than EVA
// ("bind to existing ground") passes. DEF (no confirmed pattern) is the
// baseline. Pooled across materials for power, scored against a real
// permutation null — not eyeballed.

import { readFileSync } from "node:fs";
import { ground, pattern, isGap } from "../nul/index.js";
import { tokenize, chunkWords, causalSurprisalSeries } from "../packages/engine/perceiver/text/material.js";

const CHUNK_WORDS = 40;
const WINDOW = 12;
const DRAWS = 200;
const RESEEDS = 5;
const PASSES = 8;

const traceMaterial = (label, text) => {
  const words = tokenize(text);
  const chunks = chunkWords(words, CHUNK_WORDS);
  const causal = causalSurprisalSeries(chunks); // reader-relative, computed once, whole document

  const events = [];
  let prevGround = null;
  let prevReadChunks = 0;

  for (let p = 0; p < PASSES; p++) {
    const fraction = (p + 1) / PASSES;
    const readChunks = Math.max(WINDOW + 2, Math.floor(chunks.length * fraction));
    const material = causal.slice(0, readChunks);
    if (material.length < WINDOW + 2) { prevReadChunks = readChunks; continue; }

    const seed = p * 104729 + 7; // large prime step, same fix as aperture-run.mjs
    const g = ground({ material, draws: DRAWS, window: WINDOW, seed });
    if (isGap(g)) { prevReadChunks = readChunks; continue; }

    if (prevGround) {
      // pattern()'s null is BEFORE's material, never the grown one — see
      // nul/index.js::pattern. This line used to pass `material`.
      const pr = pattern({ before: prevGround, after: g, material: causal.slice(0, prevReadChunks), reseeds: RESEEDS });
      if (!isGap(pr)) {
        const label_ = !pr.moved ? "DEF" : (pr.opened ? "REC" : "EVA");
        const newMaterial = causal.slice(prevReadChunks, readChunks);
        const newSurprisal = newMaterial.length ? newMaterial.reduce((a, b) => a + b, 0) / newMaterial.length : null;
        if (newSurprisal != null) events.push({ material: label, pass: p, label: label_, newSurprisal });
      }
    }
    prevGround = g;
    prevReadChunks = readChunks;
  }
  return events;
};

const TEXTS = {
  "War and Peace": "/Users/mlacy/Downloads/pg2600.txt",
  "Frankenstein": "scripts/adversarial/fixtures/pg84-frankenstein.txt",
  "Garoa (Basque)": "/Users/mlacy/Documents/Default Project/eoreader4.2/tests/goldens/texts/basque-garoa.txt",
};

let allEvents = [];
for (const [label, path] of Object.entries(TEXTS)) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const events = traceMaterial(label, text);
  console.error(`${label}: ${events.map((e) => e.label).join(",")}`);
  allEvents.push(...events);
}

console.error(`\ntotal pass-transitions: ${allEvents.length}`);
const byLabel = {};
for (const e of allEvents) (byLabel[e.label] ??= []).push(e.newSurprisal);
for (const [l, vals] of Object.entries(byLabel)) {
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  console.error(`  ${l}: n=${vals.length} mean newSurprisal=${mean.toFixed(1)}`);
}

// Permutation test: real difference in mean newSurprisal between two labels,
// against a null built by shuffling labels across the SAME pass-transitions.
const meanDiff = (events, labelA, labelB) => {
  const a = events.filter((e) => e.label === labelA).map((e) => e.newSurprisal);
  const b = events.filter((e) => e.label === labelB).map((e) => e.newSurprisal);
  if (a.length === 0 || b.length === 0) return null;
  return (a.reduce((x, y) => x + y, 0) / a.length) - (b.reduce((x, y) => x + y, 0) / b.length);
};

const mulberry32 = (seed) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const shuffle = (arr, rng) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const testPair = (labelA, labelB) => {
  const real = meanDiff(allEvents, labelA, labelB);
  if (real == null) { console.error(`\n${labelA} vs ${labelB}: not enough data`); return; }

  const labels = allEvents.map((e) => e.label);
  const TRIALS = 5000;
  const nullDist = [];
  for (let t = 0; t < TRIALS; t++) {
    const shuffled = shuffle(labels, mulberry32(t + 1));
    const permuted = allEvents.map((e, i) => ({ label: shuffled[i], newSurprisal: e.newSurprisal }));
    const d = meanDiff(permuted, labelA, labelB);
    if (d != null) nullDist.push(d);
  }
  nullDist.sort((x, y) => x - y);
  const pctBeat = nullDist.filter((v) => Math.abs(v) <= Math.abs(real)).length / nullDist.length;
  console.error(`\n${labelA} vs ${labelB}: real diff=${real.toFixed(1)}  |real| beats ${(pctBeat * 100).toFixed(1)}% of |null shuffles| (two-tailed)`);
};

testPair("REC", "EVA");
testPair("REC", "DEF");
testPair("EVA", "DEF");

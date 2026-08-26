// eoreader6 · triad-independence — does existence/structure/significance
// behave as three genuinely separable axes on real material, the way the
// external lexical study found for Mode/Domain/Grain? Same falsification
// discipline: real z-scores against a permutation null, not eyeballing a
// small sample. Uses only nul's own machinery — no embeddings, no external
// model.
//
//   EXISTENCE    real mention density in a regime (admitFromPrior — received,
//                never derived)
//   STRUCTURE    holonLevelRelation: above / below / peer / unstable
//                (existence-dependency + possibility-constraint — discovered)
//   SIGNIFICANCE FOR THE READER: rank of this regime's CAUSAL surprisal
//                (surprisal measured against only what's been read so far,
//                never the whole document) against a ground built from ONLY
//                the reader's own prior experience. Not a document-wide
//                statistic — a reader-relative one. This replaces an earlier
//                version that scored significance against a whole-document
//                ground: (a) that isn't what any real reader experiences,
//                and (b) it was a rare binary event (~2-4% "above"),
//                underpowered at n=146. Rank is continuous (0-1) on every
//                regime — real variance everywhere, not just at rare spikes.

import { readFileSync } from "node:fs";
import { admitFromPrior, mentionOffsets } from "../packages/engine/perceiver/text/admit.js";
import { existenceDependencyTest, possibilityConstraintTest, holonLevelRelation } from "../holon_level/index.js";
import { buildFrequencyTable, surprisalMicrobits, tokenize, causalSurprisalSeries, chunkWords } from "../packages/engine/perceiver/text/material.js";
import { ground, difference, isGap } from "../nul/index.js";

const FINE_CHARS = 500;
const GAP_MERGE_CHARS = 4000;
const WORD_CHUNK = 40;
const READER_WINDOW = 8;

const buildRegimes = (text, prior, sourceId) => {
  const table = buildFrequencyTable(tokenize(text));
  const blocks = [];
  for (let i = 0; i < text.length; i += FINE_CHARS) blocks.push(i);
  const series = blocks.map((start) => surprisalMicrobits(text.slice(start, start + FINE_CHARS), table));
  const blockOf = (offset) => Math.floor(offset / FINE_CHARS);

  // reader-relative material, computed once, whole document, causal
  const words = tokenize(text);
  const wordChunks = chunkWords(words, WORD_CHUNK);
  const causal = causalSurprisalSeries(wordChunks);
  const causalIdxOf = (offset) => Math.floor((offset / text.length) * causal.length);

  const events = admitFromPrior(text, prior, sourceId);
  const offsets = mentionOffsets(events, prior.id);
  if (offsets.length === 0) return [];

  const sorted = [...offsets].sort((a, b) => a - b);
  const rawClusters = [{ start: sorted[0], end: sorted[0], count: 1 }];
  for (const o of sorted.slice(1)) {
    const last = rawClusters[rawClusters.length - 1];
    if (o - last.end <= GAP_MERGE_CHARS) { last.end = o; last.count++; }
    else rawClusters.push({ start: o, end: o, count: 1 });
  }

  const regimes = [];
  for (const c of rawClusters) {
    const regime = { start: blockOf(c.start), end: Math.min(series.length, Math.max(blockOf(c.start) + 2, blockOf(c.end) + 1)) };
    if (regime.end - regime.start < 2 || regime.end > series.length) continue;

    const ex = existenceDependencyTest(series, regime, { draws: 48, window: 5, reseeds: 12 });
    const co = possibilityConstraintTest(series, regime, { reseeds: 12 });
    const structure = (isGap(ex) || isGap(co)) ? "unstable" : holonLevelRelation(ex, co);

    // SIGNIFICANCE FOR THE READER: only what came before this point.
    const idx = causalIdxOf(c.start);
    let significance = null;
    if (idx >= READER_WINDOW + 2) {
      const history = causal.slice(0, idx);
      const readerGround = ground({ material: history, draws: 150, window: READER_WINDOW, seed: 11 });
      if (!isGap(readerGround)) {
        const winStart = Math.max(0, idx - READER_WINDOW);
        let sum = 0;
        for (let j = winStart; j < winStart + READER_WINDOW && j < causal.length; j++) sum += causal[j];
        const observed = sum / READER_WINDOW;
        const d = difference(observed, readerGround);
        significance = isGap(d) ? (d.direction === "above" ? 1.0 : 0.0) : d.rank;
      }
    }
    if (significance === null) continue; // not enough reader history yet — a real gap, not a fabricated number

    regimes.push({ existence: c.count, structure, significance });
  }
  return regimes;
};

const TEXTS = {
  pg2600: "/Users/mlacy/Downloads/pg2600.txt",
  pg84: "scripts/adversarial/fixtures/pg84-frankenstein.txt",
};

let allRegimes = [];
const frankPrior = JSON.parse(readFileSync("scripts/adversarial/fixtures/pg84-frankenstein.coref.json", "utf8")).referents.find((r) => r.id === "creature");
allRegimes.push(...buildRegimes(readFileSync(TEXTS.pg84, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"), frankPrior, "pg84"));

const wpCoref = JSON.parse(readFileSync("/Users/mlacy/Documents/Default Project/eoreader5/priors/coref/war-and-peace.json", "utf8"));
const wpText = readFileSync(TEXTS.pg2600, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
for (const id of ["natasha", "pierre"]) {
  const raw = wpCoref.referents.find((r) => r.id === id);
  allRegimes.push(...buildRegimes(wpText, { id: raw.id, surfaces: [{ surface: raw.name }] }, "pg2600"));
}

console.error(`total regimes: ${allRegimes.length}`);
const structCounts = {};
for (const r of allRegimes) structCounts[r.structure] = (structCounts[r.structure] || 0) + 1;
console.error("structure distribution:", JSON.stringify(structCounts));
const sigVals = allRegimes.map((r) => r.significance);
console.error(`significance (reader-relative rank): mean=${(sigVals.reduce((a, b) => a + b, 0) / sigVals.length).toFixed(3)} min=${Math.min(...sigVals).toFixed(3)} max=${Math.max(...sigVals).toFixed(3)}`);

// Between-group variance: does mean significance differ across structure
// categories more than chance? Standard permutation ANOVA, no library.
const betweenGroupVariance = (regimes) => {
  const groups = {};
  for (const r of regimes) (groups[r.structure] ??= []).push(r.significance);
  const grand = regimes.reduce((s, r) => s + r.significance, 0) / regimes.length;
  let ssBetween = 0;
  for (const vals of Object.values(groups)) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    ssBetween += vals.length * (mean - grand) ** 2;
  }
  return ssBetween;
};

const realStat = betweenGroupVariance(allRegimes);

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

const TRIALS = 5000;
const structLabels = allRegimes.map((r) => r.structure);
const nullDist = [];
for (let trial = 0; trial < TRIALS; trial++) {
  const shuffledStruct = shuffle(structLabels, mulberry32(trial + 1));
  const permuted = allRegimes.map((r, i) => ({ structure: shuffledStruct[i], significance: r.significance }));
  nullDist.push(betweenGroupVariance(permuted));
}
nullDist.sort((a, b) => a - b);
const pctBeat = nullDist.filter((v) => v <= realStat).length / nullDist.length;
const nullMean = nullDist.reduce((a, b) => a + b, 0) / nullDist.length;
const nullSd = Math.sqrt(nullDist.reduce((s, v) => s + (v - nullMean) ** 2, 0) / nullDist.length) || 1;
const z = (realStat - nullMean) / nullSd;

console.error(`\n=== STRUCTURE vs SIGNIFICANCE independence (reader-relative, continuous) ===`);
console.error(`real between-group variance = ${realStat.toFixed(4)}`);
console.error(`null (${TRIALS} shuffles): mean=${nullMean.toFixed(4)} p95=${nullDist[Math.floor(nullDist.length * 0.95)].toFixed(4)}`);
console.error(`real value beats ${(pctBeat * 100).toFixed(1)}% of shuffles (z ~ ${z.toFixed(2)})`);
console.error(pctBeat > 0.95 ? "-> real association: STRUCTURE predicts SIGNIFICANCE beyond chance" : "-> no evidence against independence at this sample size");

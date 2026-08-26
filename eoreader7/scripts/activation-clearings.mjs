// eoreader6 · activation-clearings — does READING give the turn a better
// observable than counting?
//
// Turn 1's only channel was causal surprisal: how unexpected is this chunk
// given the frequency table so far. That is a counting statistic. It got the
// moved-clearing to 19/24 Frankenstein chapters at p≈0.000 against rotated
// chapters, which is the number to beat.
//
// Associative memory offers four more, and they are about the reader rather
// than the text: how loudly the past answers (activation), how far back the
// loudest answer is (reach), how much of this has no precedent (novelty), how
// many distinct prior passages answered at all (recalled).
//
// The hypothesis worth stating before measuring it, so it can be wrong: a
// scene break is where the material stops echoing what was just read. If so,
// `reach` should jump at a boundary and `activation` should collapse.
//
// Scored with the instruments from scripts/lib/surrogates.mjs. The rotated-
// chapters null is the one that decides; the other two are shown to make the
// point that they can be cleared by a mechanism that is doing nothing.
//
// Usage: node scripts/activation-clearings.mjs [path]

import { readFileSync } from "node:fs";
import { runTurn } from "../packages/engine/loops/turn.js";
import { isGap } from "../nul/index.js";
import { causalSurprisalSeries, chunkWords, tokenize } from "../packages/engine/perceiver/text/material.js";
import { readForward, seriesOf } from "../packages/engine/emergence/activation.js";
import { causalWindow, tightWindow, hits, precision, chanceBaseline, rotationNull, shuffled, stats } from "./lib/surrogates.mjs";

const PATH = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const CHUNK = 100;
const SPEC = { window: 12, draws: 200, reseeds: 5, tolerance: 3, hop: 4, seed: 17 };
const CONTROLS = Number(process.env.CONTROLS || 24);
const CLEAR_ON = ["moved"]; // the clearing that earned its place; see scripts/RESULTS.md

const text = readFileSync(PATH, "utf8").replace(/\r\n/g, "\n");
const words = tokenize(text);
const chunks = chunkWords(words, CHUNK);

const CHAPTER_RE = /^(?:CHAPTER|Chapter)\s+[IVXLC0-9]+/;
const lines = text.split("\n");
let charOffset = 0;
const markerOffsets = [];
for (const line of lines) {
  if (CHAPTER_RE.test(line)) markerOffsets.push(charOffset);
  charOffset += line.length + 1;
}
const truth = [...new Set(markerOffsets.map((o) => Math.floor(tokenize(text.slice(0, o)).length / CHUNK)))]
  .filter((c) => c > 0)
  .sort((a, b) => a - b);

// One reading. Every channel below comes from the same left-to-right pass —
// they are four questions about one act, not four analyses.
const t0 = Date.now();
const { records } = readForward(chunks.map((ws, order) => ({ order, offset: order * CHUNK, words: ws })));
const readMs = Date.now() - t0;

const CHANNELS = {
  "causal surprisal": causalSurprisalSeries(chunks),
  // A frame that recalled nothing is a real finding and not a zero echo. But a
  // series needs numbers, so each channel says what it means by absence, out
  // loud, at the call site.
  activation: seriesOf(records, "activation", { missing: 0 }),
  reach: seriesOf(records, "reach", { missing: 0 }),
  novelty: seriesOf(records, "novelty", { missing: 1 }),
  recalled: seriesOf(records, "recalled", { missing: 0 }),
};

const boundariesOf = (turn) => turn.events.filter((e) => e.op === "REC").map((e) => e.at);
const scoreOf = (turn, extent) => {
  const found = boundariesOf(turn);
  const one = (w) => ({ h: hits(found, truth, w), prec: precision(found, truth, w), chance: chanceBaseline(found.length, truth, w, extent) });
  return { found: found.length, boundaries: found, causal: one(causalWindow(SPEC)), tight: one(tightWindow(SPEC)) };
};

console.log(`=== ${PATH}`);
console.log(`${words.length} tokens → ${chunks.length} frames of ${CHUNK}; ${truth.length} chapter markers; one reading in ${(readMs / 1000).toFixed(1)}s`);
const answered = records.filter((r) => r.reach != null).length;
console.log(`recall answered on ${answered}/${records.length} frames (${((answered / records.length) * 100).toFixed(0)}%)`);
console.log(`clearOn=${JSON.stringify(CLEAR_ON)}  spec=${JSON.stringify(SPEC)}\n`);

const results = {};
for (const [cname, series] of Object.entries(CHANNELS)) {
  const turn = runTurn({ material: series, ...SPEC, clearOn: CLEAR_ON });
  if (isGap(turn)) {
    console.log(`  ${cname.padEnd(18)} GAP — ${turn.gap}: ${turn.reason ?? ""}`);
    continue;
  }
  const r = scoreOf(turn, series.length);
  const ctl = [];
  for (let c = 0; c < CONTROLS; c++) {
    const t = runTurn({ material: shuffled(series, 4243 + c * 7919), ...SPEC, clearOn: CLEAR_ON });
    if (!isGap(t)) ctl.push(scoreOf(t, series.length));
  }
  results[cname] = { r, ctl };

  for (const which of ["causal", "tight"]) {
    const w = which === "causal" ? causalWindow(SPEC) : tightWindow(SPEC);
    const excess = r[which].h - r[which].chance;
    const ce = stats(ctl.map((c) => c[which].h - c[which].chance));
    const z = ce.sd > 0 ? ((excess - ce.mean) / ce.sd).toFixed(2) : "—";
    const rot = rotationNull(r.boundaries, truth, w, series.length, 4);
    const rs = stats(rot);
    const rotP = (rot.filter((h) => h >= r[which].h).length / rot.length).toFixed(3);
    const tag = which === "causal" ? cname.padEnd(18) : " ".repeat(18);
    console.log(
      `  ${tag} ${which.padEnd(6)} ${String(r[which].h).padStart(2)}/${truth.length} recall  ${String(r[which].prec).padStart(2)}/${String(r.found).padStart(2)} prec | chance ${r[which].chance.toFixed(1).padStart(4)} | shuffled z=${String(z).padStart(5)} | ROTATED ${rs.mean.toFixed(1)}±${rs.sd.toFixed(1)} p≈${rotP}`
    );
  }
  console.log("");
}

console.log("The rotated-chapters column decides. p is the fraction of rotations that");
console.log("match or beat the real alignment; everything else can be satisfied by a");
console.log("mechanism emitting evenly spaced marks.");

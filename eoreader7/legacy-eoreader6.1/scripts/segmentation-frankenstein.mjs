// eoreader6 · segmentation-frankenstein — head-to-head, on the standard
// segmentation metrics (Pk, WindowDiff), of three things this repo has so
// far only ever scored against a tolerance window: this repo's own boundary
// detector (the `recalled` channel through the "moved" clearing —
// scripts/activation-clearings.mjs, run fresh here against the fixture this
// repo actually commits: 8/24 causal recall p≈0.046, 5/24 tight p≈0.209.
// NOT the "22/24, p≈0.005" figure still quoted in this file's neighbors
// (reading-regime.js, 11-terrain-occupancy-and-the-two-ascents.md,
// prior-art-teachable-language-comprehender.md) — that number was produced
// against a legacy-repo fixture path that does not exist in this
// repository, does not reproduce on the committed one, and is already a
// tracked, open discrepancy (scripts/RESULTS.md's own "(3) The premise
// number does not reproduce" section; conformance/reproducibility.test.js).
// Repeating it here, uncorrected, would be a second copy of the same stale
// number rather than a fresh check of it — this script checked it, and
// reports what it actually found), TextTiling (Hearst 1997), and C99 (Choi
// 2000) — plus a random null at the SAME boundary count as each method,
// because Pk and WindowDiff both reward placing fewer boundaries on a
// document with few true ones, and reporting them without a matched-count
// null repeats exactly the mistake scripts/RESULTS.md's "three nulls"
// section already had to correct once.
//
// `loops/reading-regime.js`'s own regime tracker (createRegimeTracker) was
// tried first and is NOT here: on this exact corpus and spec it REFUSES
// (`trending_material` — `recalled` climbs with document position, so a
// trailing-window ground is a lagging slope estimate, not a rebuilt
// nothing), which is a known, already-documented finding
// (scripts/reading-regime-frankenstein.mjs's own header handles this exact
// refusal). The mechanism that actually places boundaries on this material
// is the "moved" clearing over the same `recalled` channel, and that is
// what is compared here — not a different, friendlier channel substituted
// without saying so.
//
// GRANULARITY IS NOT FREE, AND IS REPORTED BOTH WAYS. TextTiling and C99
// each have their own unsupervised stopping rule (a depth cutoff; an
// elbow in density gain) and neither was tuned to find 24 boundaries — so
// scoring them at their NATURAL count against a 24-chapter reference
// conflates "found the right boundaries" with "found roughly the right
// NUMBER of boundaries," which Pk/WindowDiff do not fully correct for at
// large count mismatches. Both are therefore also run in an ORACLE mode
// (told the true boundary count, 24, in advance) — the comparison the
// segmentation literature usually reports — with the natural-count numbers
// kept alongside rather than dropped, because a method's own stopping rule
// failing to find the right scale is itself a finding, not noise to hide.
// This repo's own detector gets no such oracle in either mode: it has no
// boundary-count parameter to hand one to.
//
// Usage: node scripts/segmentation-frankenstein.mjs [path]

import { readFileSync } from "node:fs";
import { runTurn } from "../packages/engine/loops/turn.js";
import { isGap } from "../nul/index.js";
import { readForward, seriesOf } from "../packages/engine/emergence/activation.js";
import { tokenize, chunkWords } from "../packages/engine/perceiver/text/material.js";
import { textTiling, c99 } from "./lib/segmentation-baselines.mjs";
import { pk, windowDiff, conventionalK } from "./lib/segmentation-metrics.mjs";
import { rng, stats } from "./lib/surrogates.mjs";

const PATH = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const CHUNK = 100;
const SPEC = { window: 12, draws: 200, reseeds: 5, tolerance: 3, hop: 4, seed: 17 };
const NULL_TRIALS = Number(process.env.NULL_TRIALS || 200);

const text = readFileSync(PATH, "utf8").replace(/\r\n/g, "\n");
const words = tokenize(text);
const chunks = chunkWords(words, CHUNK);
const frames = chunks.map((ws, order) => ({ order, offset: order * CHUNK, words: ws }));
const n = frames.length;

const CHAPTER_RE = /^(?:CHAPTER|Chapter)\s+[IVXLC0-9]+/;
const lines = text.split("\n");
let charOffset = 0;
const markerOffsets = [];
for (const line of lines) {
  if (CHAPTER_RE.test(line)) markerOffsets.push(charOffset);
  charOffset += line.length + 1;
}
const truth = new Set(
  [...new Set(markerOffsets.map((o) => Math.floor(tokenize(text.slice(0, o)).length / CHUNK)))].filter((c) => c > 0 && c < n),
);

console.log(`=== ${PATH}`);
console.log(`${words.length} tokens -> ${n} frames of ${CHUNK}; ${truth.size} chapter markers (truth)\n`);

const K = conventionalK(truth, n);
console.log(`Pk/WindowDiff window k=${K} (half the mean true segment length, ${(n / (truth.size + 1)).toFixed(1)} frames)\n`);

const nullFor = (count, seed) => {
  const next = rng(seed);
  const out = new Set();
  while (out.size < count) out.add(1 + Math.floor(next() * (n - 1)));
  return out;
};

const results = [];
const score = (name, boundaries, { note = "" } = {}) => {
  const b = boundaries instanceof Set ? boundaries : new Set(boundaries);
  const p = pk(truth, b, n, K);
  const wd = windowDiff(truth, b, n, K);

  const nullPk = [], nullWd = [];
  for (let t = 0; t < NULL_TRIALS; t++) {
    const nb = nullFor(b.size, 7000 + t);
    nullPk.push(pk(truth, nb, n, K));
    nullWd.push(windowDiff(truth, nb, n, K));
  }
  const sp = stats(nullPk), sw = stats(nullWd);

  console.log(`${name}: ${b.size} boundaries${note ? " " + note : ""}`);
  console.log(`  Pk         ${p.toFixed(3)}   (matched-count random null: ${sp.mean.toFixed(3)} ± ${sp.sd.toFixed(3)})`);
  console.log(`  WindowDiff ${wd.toFixed(3)}   (matched-count random null: ${sw.mean.toFixed(3)} ± ${sw.sd.toFixed(3)})\n`);
  const r = { name, count: b.size, pk: p, windowDiff: wd, nullPk: sp, nullWindowDiff: sw };
  results.push(r);
  return r;
};

// ── this repo's own detector: `recalled` through the "moved" clearing ──────
const { records } = readForward(frames);
const recalled = seriesOf(records, "recalled", { missing: 0 });
const turn = runTurn({ material: recalled, ...SPEC, clearOn: ["moved"] });
if (isGap(turn)) {
  console.log(`recalled/moved clearing: GAP — ${turn.gap}\n`);
} else {
  const found = turn.events.filter((e) => e.op === "REC").map((e) => e.at);
  score("this repo: recalled -> moved clearing", found);
}

// ── TextTiling and C99, natural stopping rule ───────────────────────────────
const ttNatural = textTiling(frames);
score("TextTiling, natural cutoff", ttNatural.boundaries, { note: `cutoff=${ttNatural.cutoff.toFixed(3)}` });

const c99Natural = c99(frames);
score("C99, natural elbow stop", c99Natural.boundaries, { note: `rankRadius=${c99Natural.rankRadius}` });

// ── TextTiling and C99, oracle boundary count (= truth.size) ───────────────
const ttOracle = textTiling(frames, { targetCount: truth.size });
score("TextTiling, ORACLE count", ttOracle.boundaries, { note: "(told the true boundary count)" });

const c99Oracle = c99(frames, { maxBoundaries: truth.size });
score("C99, ORACLE count", c99Oracle.boundaries, { note: "(told the true boundary count)" });

console.log("=== summary ===");
console.log("method".padEnd(38), "n".padEnd(4), "Pk".padEnd(8), "null Pk".padEnd(14), "WD".padEnd(8), "null WD");
for (const r of results) {
  console.log(
    r.name.padEnd(38),
    String(r.count).padEnd(4),
    r.pk.toFixed(3).padEnd(8),
    `${r.nullPk.mean.toFixed(3)}±${r.nullPk.sd.toFixed(3)}`.padEnd(14),
    r.windowDiff.toFixed(3).padEnd(8),
    `${r.nullWindowDiff.mean.toFixed(3)}±${r.nullWindowDiff.sd.toFixed(3)}`,
  );
}

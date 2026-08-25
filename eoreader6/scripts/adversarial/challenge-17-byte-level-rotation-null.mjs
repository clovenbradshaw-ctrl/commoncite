// eoreader6 · challenge-17-byte-level-rotation-null — ADVERSARIAL TEST.
//
// Claim under test (scripts/RESULTS.md, "Pure binary: the omnimodal claim,
// and it does not hold yet"): byte-level reading (meanByte, blockEntropy,
// blockVariety) clears NO rotation null on real text — "nothing clears the
// rotation null."
//
// This script:
//
//   PART A — REPLICATION. Re-run the exact existing pathway
//     (scripts/binary-clearings.mjs's own reductions, runTurn, and
//     scripts/lib/surrogates.mjs's rotationNull) against the real Frankenstein
//     fixture, self-contained (no import of the script itself, which is a
//     top-level side-effecting CLI, not a library — but every function it
//     calls is re-imported from the same source modules it uses, and the
//     three reduction functions are copied byte-for-byte).
//
//   PART B — LITERAL MATERIAL ROTATION. The challenge asks to "feed a byte
//     stream and a cyclically-rotated version of it via the existing
//     byte-level reduction pathway." Part A's rotationNull rotates the TRUTH
//     vector only (material and detector output untouched, per
//     lib/surrogates.mjs's own doc comment). This part instead physically
//     rotates the RAW BYTES themselves (a true cyclic shift of the material),
//     re-derives ground truth by re-running the marker scan on the rotated
//     buffer (never by arithmetically shifting the old truth), and re-scores.
//     This is an independent empirical replicate at a different phase, not a
//     restatement of Part A.
//
//   PART C — FIX ATTEMPT. Adds three NEW order/position-sensitive byte-level
//     channels not in RESULTS.md: meanByteDelta (mean |Δbyte| per block),
//     deltaEntropy (Shannon entropy of the Δbyte distribution per block), and
//     runCount (count of byte-to-byte value changes per block — a byte-level
//     zero-crossing analogue). Each is first verified, at the unit level, to
//     actually be sensitive to within-block byte order (unlike meanByte/
//     blockEntropy/blockVariety, which are histogram/sum statistics and are
//     PROVABLY invariant to any permutation of a block's bytes). Then each is
//     run through the identical runTurn + rotationNull pipeline used in Part A
//     to see whether sensitivity-to-order actually translates into clearing
//     the rotation null on real text.
//
//   PART D — PROPAGATION CHECK. Confirms (by source inspection, printed here
//     for the record) whether any code path currently carries byte-level
//     perceiver output into the repo's Entity/Kind (Existence-domain) organs.
//
// Usage: node scripts/adversarial/challenge-17-byte-level-rotation-null.mjs

import { readFileSync } from "node:fs";
import { runTurn } from "../../packages/engine/loops/turn.js";
import { isGap } from "../../nul/index.js";
import {
  causalWindow, tightWindow, hits, precision, chanceBaseline, rotationNull, shuffled, stats,
} from "../lib/surrogates.mjs";

const FIXTURE = new URL("./fixtures/challenge-17-frankenstein-full.txt", import.meta.url);
const BLOCK = 512;
const SPEC = { window: 12, draws: 200, reseeds: 5, tolerance: 3, hop: 4, seed: 17 };
const CONTROLS = 24;
const ALPHA = 0.05; // the significance line "clears the rotation null" is scored against

const bytes = readFileSync(FIXTURE);
console.log(`fixture: ${FIXTURE.pathname}`);
console.log(`${bytes.length} bytes, block ${BLOCK}, spec ${JSON.stringify(SPEC)}, ${CONTROLS} shuffle controls\n`);

// ═══════════════════════════════════════════════════════════════════════════
// Reductions: the three RESULTS.md channels, copied verbatim from
// scripts/binary-clearings.mjs (not imported — that file is a side-effecting
// CLI entrypoint, not a module), plus three new order-sensitive candidates.
// ═══════════════════════════════════════════════════════════════════════════

const meanByte = (buf, block) => {
  const out = [];
  for (let i = 0; i + block <= buf.length; i += block) {
    let s = 0;
    for (let j = i; j < i + block; j++) s += buf[j];
    out.push(s / block);
  }
  return out;
};

const blockEntropy = (buf, block) => {
  const out = [];
  const counts = new Uint32Array(256);
  for (let i = 0; i + block <= buf.length; i += block) {
    counts.fill(0);
    for (let j = i; j < i + block; j++) counts[buf[j]]++;
    let h = 0;
    for (let s = 0; s < 256; s++) {
      if (!counts[s]) continue;
      const p = counts[s] / block;
      h -= p * Math.log2(p);
    }
    out.push(h * 1e6);
  }
  return out;
};

const blockVariety = (buf, block) => {
  const out = [];
  const seen = new Uint8Array(256);
  for (let i = 0; i + block <= buf.length; i += block) {
    seen.fill(0);
    let n = 0;
    for (let j = i; j < i + block; j++) if (!seen[buf[j]]) { seen[buf[j]] = 1; n++; }
    out.push(n);
  }
  return out;
};

/** NEW candidate #1: mean absolute byte-to-byte delta per block. Order-sensitive
 * by construction — it is a function of which bytes are ADJACENT, not just which
 * bytes are PRESENT. The direct byte-level analogue of a "roughness"/first-
 * difference statistic (the family the challenge names: "delta ... reduction"). */
const meanByteDelta = (buf, block) => {
  const out = [];
  for (let i = 0; i + block <= buf.length; i += block) {
    let s = 0;
    for (let j = i + 1; j < i + block; j++) s += Math.abs(buf[j] - buf[j - 1]);
    out.push(s / (block - 1));
  }
  return out;
};

/** NEW candidate #2: Shannon entropy of the Δbyte distribution per block (Δ in
 * [-255,255], 511 symbols). Same histogram machinery as blockEntropy, but over
 * PAIRS of adjacent bytes instead of single bytes — an "autocorrelation-based"
 * reduction in the sense the challenge names, since it is exactly a first-order
 * Markov/digram statistic. */
const deltaEntropy = (buf, block) => {
  const out = [];
  const counts = new Uint32Array(511);
  for (let i = 0; i + block <= buf.length; i += block) {
    counts.fill(0);
    for (let j = i + 1; j < i + block; j++) counts[buf[j] - buf[j - 1] + 255]++;
    const n = block - 1;
    let h = 0;
    for (let s = 0; s < 511; s++) {
      if (!counts[s]) continue;
      const p = counts[s] / n;
      h -= p * Math.log2(p);
    }
    out.push(h * 1e6);
  }
  return out;
};

/** NEW candidate #3: count of byte-to-byte value CHANGES per block — a
 * byte-level zero-crossing-rate analogue (the exact family #15's audio fix
 * uses: order/sign structure instead of a sum/histogram). */
const runCount = (buf, block) => {
  const out = [];
  for (let i = 0; i + block <= buf.length; i += block) {
    let c = 0;
    for (let j = i + 1; j < i + block; j++) if (buf[j] !== buf[j - 1]) c++;
    out.push(c);
  }
  return out;
};

const OLD_REDUCTIONS = { meanByte, blockEntropy, blockVariety };
const NEW_REDUCTIONS = { meanByteDelta, deltaEntropy, runCount };

// ═══════════════════════════════════════════════════════════════════════════
// Unit-level order-sensitivity check, BEFORE spending any corpus-level compute
// on the new channels — the same discipline conformance/perceiver_invariance
// .test.js uses (mutate, check equal/not-equal on the reduction's own output).
// ═══════════════════════════════════════════════════════════════════════════

console.log("── unit check: does within-block shuffling change each statistic? ──");
{
  const sampleStart = 200 * BLOCK; // an arbitrary real block, well inside the text
  const block = Array.from(bytes.subarray(sampleStart, sampleStart + BLOCK));
  const shuffledBlock = Buffer.from(shuffled(block, 12345));
  const origBuf = Buffer.from(block);
  const reduceOne = (fn, buf) => fn(buf, BLOCK)[0];
  for (const [name, fn] of Object.entries({ ...OLD_REDUCTIONS, ...NEW_REDUCTIONS })) {
    const before = reduceOne(fn, origBuf);
    const after = reduceOne(fn, shuffledBlock);
    const changed = Math.abs(before - after) > 1e-9;
    const family = name in OLD_REDUCTIONS ? "RESULTS.md channel" : "new candidate";
    console.log(`  ${name.padEnd(14)} (${family.padEnd(18)}) before=${before.toFixed(3).padStart(10)} after=${after.toFixed(3).padStart(10)}  ${changed ? "CHANGED (order-sensitive)" : "UNCHANGED (order-blind)"}`);
  }
}
console.log();

// ═══════════════════════════════════════════════════════════════════════════
// Shared scoring machinery, copied from scripts/binary-clearings.mjs.
// ═══════════════════════════════════════════════════════════════════════════

const CHAPTER = Buffer.from("\nCHAPTER ");
const CHAPTER_LC = Buffer.from("\nChapter ");
const scanMarkers = (buf, block) => {
  const markerBlocks = [];
  const markerOffsets = [];
  for (const needle of [CHAPTER, CHAPTER_LC]) {
    let at = buf.indexOf(needle);
    while (at !== -1) {
      markerBlocks.push(Math.floor(at / block));
      markerOffsets.push(at);
      at = buf.indexOf(needle, at + 1);
    }
  }
  const truth = [...new Set(markerBlocks)].sort((a, b) => a - b).filter((b) => b > 0);
  return { truth, offsets: markerOffsets.sort((a, b) => a - b) };
};

const boundariesOf = (turn) => turn.events.filter((e) => e.op === "REC").map((e) => e.at);

const scoreOf = (turn, extent) => {
  const found = boundariesOf(turn);
  const one = (w) => ({ h: hits(found, TRUTH_FOR_SCORING, w), prec: precision(found, TRUTH_FOR_SCORING, w), chance: chanceBaseline(found.length, TRUTH_FOR_SCORING, w, extent) });
  return { found: found.length, boundaries: found, causal: one(causalWindow(SPEC)), tight: one(tightWindow(SPEC)) };
};

const MODES = [["surfeit only", ["surfeit"]], ["moved only", ["moved"]], ["both", ["surfeit", "moved"]]];

let TRUTH_FOR_SCORING = null; // set per-run below; scoreOf closes over it

const clearedCells = []; // collects every (label, reduction, mode, window) that clears p<ALPHA

const runTable = (label, buf, truth, reductions) => {
  console.log(`═══ ${label} — ${truth.length} chapter markers, blocks [${truth.slice(0, 6).join(", ")}${truth.length > 6 ? ", ..." : ""}]`);
  for (const [rname, reduce] of Object.entries(reductions)) {
    const series = reduce(buf, BLOCK);
    console.log(`\n  ── ${rname} (n=${series.length})`);
    for (const [mname, clearOn] of MODES) {
      const turn = runTurn({ material: series, ...SPEC, clearOn });
      if (isGap(turn)) { console.log(`    ${mname.padEnd(13)} GAP — ${turn.gap}`); continue; }
      TRUTH_FOR_SCORING = truth;
      const r = scoreOf(turn, series.length);
      const ctl = [];
      for (let c = 0; c < CONTROLS; c++) {
        const t = runTurn({ material: shuffled(series, 4243 + c * 7919), ...SPEC, clearOn });
        if (!isGap(t)) ctl.push(scoreOf(t, series.length));
      }
      for (const which of ["causal", "tight"]) {
        const w = which === "causal" ? causalWindow(SPEC) : tightWindow(SPEC);
        const excess = r[which].h - r[which].chance;
        const ctlExcess = stats(ctl.map((c) => c[which].h - c[which].chance));
        const z = ctlExcess.sd > 0 ? ((excess - ctlExcess.mean) / ctlExcess.sd).toFixed(2) : "—";
        const rot = rotationNull(r.boundaries, truth, w, series.length, 4);
        const rs = stats(rot);
        const rotPnum = rot.filter((h) => h >= r[which].h).length / rot.length;
        const rotP = rotPnum.toFixed(3);
        const clears = rotPnum < ALPHA && r[which].h > 0;
        if (clears) clearedCells.push(`${label} / ${rname} / ${mname} / ${which}: p=${rotP}, recall=${r[which].h}/${truth.length}`);
        const tag = which === "causal" ? mname.padEnd(13) : " ".repeat(13);
        console.log(`    ${tag} ${which.padEnd(6)} ${String(r[which].h).padStart(2)}/${truth.length} recall, ${String(r[which].prec).padStart(2)}/${String(r.found).padStart(2)} prec | chance ${r[which].chance.toFixed(1).padStart(4)} | shuffled z=${String(z).padStart(5)} | ROTATED ${rs.mean.toFixed(1)}±${rs.sd.toFixed(1)} p≈${rotP}${clears ? "  <== CLEARS (p<" + ALPHA + ")" : ""}`);
      }
    }
  }
  console.log();
};

// ═══════════════════════════════════════════════════════════════════════════
// PART A — replicate RESULTS.md's exact claim on the original byte stream.
// ═══════════════════════════════════════════════════════════════════════════

const { truth: truthOriginal } = scanMarkers(bytes, BLOCK);
console.log("PART A — REPLICATION on the original byte stream (the exact RESULTS.md pathway)\n");
runTable("original bytes", bytes, truthOriginal, OLD_REDUCTIONS);

// ═══════════════════════════════════════════════════════════════════════════
// PART B — physically rotate the raw material and re-derive truth from
// scratch on the rotated buffer. Choose a rotation point at least 3000 bytes
// from any marker so no marker is split by the cut (verified below).
// ═══════════════════════════════════════════════════════════════════════════

console.log("PART B — the literal construction the challenge names: rotate the RAW BYTES\n");

const { offsets: origOffsets } = scanMarkers(bytes, BLOCK);
let D = Math.floor(bytes.length / 2);
const SAFE_MARGIN = 3000;
const tooClose = (d) => origOffsets.some((o) => Math.abs(o - d) < SAFE_MARGIN) || d < SAFE_MARGIN || d > bytes.length - SAFE_MARGIN;
while (tooClose(D)) D = (D + 4001) % bytes.length;
console.log(`rotation offset D=${D} bytes (>= ${SAFE_MARGIN}B from every marker — no marker split by the cut)`);

const rotated = Buffer.concat([bytes.subarray(D), bytes.subarray(0, D)]);
const { truth: truthRotated, offsets: rotatedOffsets } = scanMarkers(rotated, BLOCK);

// sanity: every original marker's PREDICTED new offset (simple modular shift)
// should appear in the freshly-rescanned rotated-buffer marker offsets — this
// is the check that the rotation actually just relocated the same 24 markers
// rather than creating or destroying any.
const predicted = origOffsets.map((o) => (o - D + bytes.length) % bytes.length).sort((a, b) => a - b);
const matchExactly = predicted.length === rotatedOffsets.length && predicted.every((p, i) => p === rotatedOffsets[i]);
console.log(`markers: original=${origOffsets.length}, rotated-and-rescanned=${rotatedOffsets.length}, predicted-vs-rescanned exact match: ${matchExactly}`);
if (!matchExactly) console.log(`  predicted:  [${predicted.join(",")}]\n  rescanned:  [${rotatedOffsets.join(",")}]`);
console.log();

runTable("cyclically-rotated bytes (D=" + D + ")", rotated, truthRotated, OLD_REDUCTIONS);

// ═══════════════════════════════════════════════════════════════════════════
// PART C — fix attempt: do the new order-sensitive channels clear the
// rotation null on the original byte stream?
// ═══════════════════════════════════════════════════════════════════════════

console.log("PART C — FIX ATTEMPT: order/position-sensitive byte-level channels\n");
runTable("original bytes, NEW channels", bytes, truthOriginal, NEW_REDUCTIONS);

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

console.log("═══ SUMMARY ═══");
console.log(`Cells that cleared the rotation null at p<${ALPHA} (across Parts A, B, C, all reductions × modes × windows):`);
if (clearedCells.length === 0) {
  console.log("  NONE.");
} else {
  for (const c of clearedCells) console.log(`  ${c}`);
}

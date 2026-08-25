// eoreader6 · binary-clearings — THE OMNIMODAL CLAIM, TESTED AT ITS LIMIT.
//
// "If it works for music it'll work for texts." The strongest form of that is
// not to test a second modality; it is to remove modality altogether. This
// reads Frankenstein as BYTES. No tokenizer, no frequency table, no surprisal,
// no notion of a word. A block of 512 bytes becomes one number by arithmetic
// that would mean exactly the same thing applied to a WAV file, a JPEG, or a
// core dump.
//
// Everything downstream is byte-for-byte the same organ chain as the text run:
// the same runTurn, the same declared numbers, the same nulls. The only thing
// that changed is what the material came from. If the chapter boundaries still
// come out, then DEF·Atmosphere·Clearing is not reading language — it is
// reading difference, which is the whole claim.
//
// If they do NOT come out, that is also worth having, and it says something
// precise: the signal lives in the perceiver's reduction, not in the operator.
// A nameless leitmotif would then be out of reach, and the omnimodal
// commitment would be a claim about plumbing rather than about perception.
//
// Usage: node scripts/binary-clearings.mjs [path] [blockSize]

import { readFileSync } from "node:fs";
import { runTurn } from "../packages/engine/loops/turn.js";
import { isGap } from "../nul/index.js";
import {
  causalWindow, tightWindow, hits, precision, chanceBaseline, rotationNull, shuffled, stats,
} from "./lib/surrogates.mjs";

const PATH = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const BLOCK = Number(process.argv[3] || 512);
const SPEC = { window: 12, draws: 200, reseeds: 5, tolerance: 3, hop: 4, seed: 17 };
const CONTROLS = Number(process.env.CONTROLS || 24);

const bytes = readFileSync(PATH); // a Buffer. Deliberately never decoded to a string.

// ── reductions: byte arithmetic, and nothing that knows what a letter is ────

/** Mean byte value per block. The most literal statistic a byte stream has. */
const meanByte = (buf, block) => {
  const out = [];
  for (let i = 0; i + block <= buf.length; i += block) {
    let s = 0;
    for (let j = i; j < i + block; j++) s += buf[j];
    out.push(s / block);
  }
  return out;
};

/** Shannon entropy over the 256-symbol alphabet, per block. Still pure bytes. */
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
    out.push(h * 1e6); // microbits, matching the text perceiver's scale convention
  }
  return out;
};

/** Distinct byte values per block — the crudest diversity measure there is. */
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

const REDUCTIONS = { meanByte, blockEntropy, blockVariety };

// ── the external reference, located by byte offset, never by parsing ────────
//
// The marker scan is the ONE place a byte has to be compared to a letter,
// because the reference itself is typographic. It touches only the truth
// vector, never the material — the reading never sees it.
const CHAPTER = Buffer.from("\nCHAPTER ");
const CHAPTER_LC = Buffer.from("\nChapter ");
const markerBlocks = [];
for (const needle of [CHAPTER, CHAPTER_LC]) {
  let at = bytes.indexOf(needle);
  while (at !== -1) {
    markerBlocks.push(Math.floor(at / BLOCK));
    at = bytes.indexOf(needle, at + 1);
  }
}
const truth = [...new Set(markerBlocks)].sort((a, b) => a - b).filter((b) => b > 0);

const MODES = [
  ["surfeit only", ["surfeit"]],
  ["moved only", ["moved"]],
  ["both", ["surfeit", "moved"]],
];

const boundariesOf = (turn) => turn.events.filter((e) => e.op === "REC").map((e) => e.at);

const scoreOf = (turn, extent) => {
  const found = boundariesOf(turn);
  const one = (w) => ({
    h: hits(found, truth, w),
    prec: precision(found, truth, w),
    chance: chanceBaseline(found.length, truth, w, extent),
  });
  return { found: found.length, boundaries: found, causal: one(causalWindow(SPEC)), tight: one(tightWindow(SPEC)) };
};

console.log(`=== ${PATH}`);
console.log(`${bytes.length} bytes, block ${BLOCK} → ${Math.floor(bytes.length / BLOCK)} blocks; ${truth.length} chapter markers`);
console.log(`chapters at blocks: [${truth.join(", ")}]`);
console.log(`spec: ${JSON.stringify(SPEC)}\n`);

for (const [rname, reduce] of Object.entries(REDUCTIONS)) {
  const series = reduce(bytes, BLOCK);
  console.log(`\n──────── reduction: ${rname}  (n=${series.length})`);

  for (const [mname, clearOn] of MODES) {
    const turn = runTurn({ material: series, ...SPEC, clearOn });
    if (isGap(turn)) {
      console.log(`  ${mname.padEnd(13)} GAP — ${turn.gap}`);
      continue;
    }
    const r = scoreOf(turn, series.length);

    // the blunt null: same mechanism, order destroyed
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
      const rotP = (rot.filter((h) => h >= r[which].h).length / rot.length).toFixed(3);
      const tag = which === "causal" ? mname.padEnd(13) : " ".repeat(13);
      console.log(
        `  ${tag} ${which.padEnd(6)} ${String(r[which].h).padStart(2)}/${truth.length} recall, ${String(r[which].prec).padStart(2)}/${String(r.found).padStart(2)} prec | chance ${r[which].chance.toFixed(1).padStart(4)} | shuffled z=${String(z).padStart(5)} | ROTATED ${rs.mean.toFixed(1)}±${rs.sd.toFixed(1)} p≈${rotP}`
      );
    }
  }
}

console.log("\nThe rotated-chapters column is the one that decides. Everything else can be");
console.log("satisfied by emitting evenly spaced marks, which is what a tolerance counter does.");

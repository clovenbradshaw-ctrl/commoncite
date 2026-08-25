// eoreader6 · adversarial challenge #15 — audio tone vs permuted-samples
//
// Claim under test (scripts/RESULTS.md, "The invariance audit", and
// conformance/perceiver_invariance.test.js:128-141): the audio perceiver's
// reduction (RMS energy per frame, packages/engine/perceiver/audio/material.js
// reduce()) cannot distinguish a pure tone from a random permutation of its own
// samples WITHIN each frame — "exactly identical" material, JSON.stringify
// equal. Not order-sensitive, only aggregate energy.
//
// This script does four things, in order, and touches NO source file:
//
//   PART A. Re-confirms the gap through the REAL end-to-end pipeline: a real
//     WAV file, synthesized by ffmpeg (not a hand-written sine loop), decoded
//     through the actual production load() (spawns the same ffmpeg decode the
//     app uses), permuted, RE-ENCODED to a second real WAV file, decoded again,
//     and only THEN handed to the actual unmodified audio.reduce(). This is
//     strictly more adversarial than the existing unit test, which builds a
//     synthetic Int16Array in memory and never touches load() or a real file.
//
//   PART B. Prototypes a genuinely order-sensitive channel — mean absolute
//     first-difference per frame ("meanAbsDelta", a spectral-flux-style
//     statistic) — as a NEW channel, not a replacement, and shows it (1) is no
//     longer blind to the within-frame permutation and (2) still holds the
//     polarity invariance RESULTS.md explicitly filed as NOT a defect
//     (zero-crossing rate is polarity-invariant; this channel is chosen to be
//     polarity-invariant too, by construction: |(-b)-(-a)| = |b-a|).
//
//   PART C. Builds a longer real WAV that alternates real-order and
//     within-frame-permuted segments of the SAME underlying continuous tone (so
//     loudness is constant throughout — only ORDER changes at each segment
//     boundary, which is exactly the thing RMS cannot see). Runs the actual
//     production runTurn() organ over both the current RMS channel and the
//     candidate channel, using the SAME spec shape, scoring instrument
//     (hits/precision/chanceBaseline/rotationNull) and MODES vocabulary
//     (surfeit/moved) as scripts/binary-clearings.mjs — the repo's own
//     rotation-null methodology, not a new one invented for this script.
//
//   PART D. Confirms the currently-passing conformance file is untouched and
//     still green (proof nothing here required editing source to observe the
//     gap).
//
// Usage: node scripts/adversarial/challenge-15-audio-tone-vs-permuted-samples.mjs

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as audio from "../../packages/engine/perceiver/audio/material.js";
import { runTurn } from "../../packages/engine/loops/turn.js";
import { isGap } from "../../nul/index.js";
import {
  causalWindow, tightWindow, hits, precision, chanceBaseline, rotationNull, shuffled, stats,
} from "../lib/surrogates.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = join(HERE, "fixtures");
mkdirSync(FIXDIR, { recursive: true });

const RATE = 8000;
const FRAME = 400; // the perceiver's own default (50ms @ 8kHz)

let failures = 0;
let candidateBrokeHolds = false;
const fail = (msg) => { failures++; console.log(`  ✗ FAIL: ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

// ── small process helpers ───────────────────────────────────────────────────

const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
};

/** Real WAV, written to disk, from a raw Int16Array — via ffmpeg, same discipline as goldens/multimodal/synthesize.mjs. */
const encodeWav = (samples, outPath) =>
  new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", "-v", "error", "-f", "s16le", "-ar", String(RATE), "-ac", "1", "-i", "pipe:0", outPath]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg encode failed (${code}): ${err.slice(0, 300)}`))));
    proc.stdin.write(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
    proc.stdin.end();
  });

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffledIndices = (n, seed) => {
  const next = rng(seed);
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
};

/** Permute samples WITHIN each frameSamples-wide window, in place semantics on a copy. Same operation as the existing conformance test. */
const permuteWithinFrames = (samples, frameSamples, seedBase) => {
  const out = new Int16Array(samples);
  for (let f = 0; f + frameSamples <= out.length; f += frameSamples) {
    const idx = shuffledIndices(frameSamples, seedBase + f);
    const frame = out.slice(f, f + frameSamples);
    for (let i = 0; i < frameSamples; i++) out[f + i] = frame[idx[i]];
  }
  return out;
};

// ── PART B candidate channel: mean absolute first-difference per frame ─────
// Order-sensitive by construction (a permutation of a frame's samples changes
// which values are adjacent, hence the successive differences, hence their
// mean magnitude) and polarity-invariant by construction
// (|(-b) - (-a)| === |b - a}|), so it does not threaten the "holds" test.
const meanAbsDelta = (samples, { fraction = 1, frameSamples = 400 } = {}) => {
  const readLen = Math.max(frameSamples, Math.floor(samples.length * fraction));
  const out = [];
  for (let i = 0; i + frameSamples <= readLen; i += frameSamples) {
    let s = 0;
    for (let j = i + 1; j < i + frameSamples; j++) s += Math.abs(samples[j] - samples[j - 1]);
    out.push(s / (frameSamples - 1));
  }
  return out;
};

/** A prototype of what audio.reduce() would return if this channel were ADDED alongside RMS (not replacing it) — [rms, meanAbsDelta] pairs per frame, exactly the "new channel alongside existing ones" the challenge asks for. */
const combinedReduce = (samples, opts) => {
  const rms = audio.reduce(samples, opts);
  const delta = meanAbsDelta(samples, opts);
  return rms.map((r, i) => [r, delta[i]]);
};

async function main() {
  console.log("=== challenge #15 — audio tone vs permuted-samples-within-frame ===\n");

  // ═══════════════════════════════════════════════════════════════════════
  console.log("── PART A: re-confirm the gap through the REAL file → ffmpeg decode → reduce pipeline ──\n");

  // A real 6s 440Hz tone, generated the same way goldens/multimodal does it.
  const tonePath = join(FIXDIR, "challenge15-tone440.wav");
  ff(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=8000", "-t", "6", tonePath]);
  ok(`synthesized real WAV via ffmpeg sine filter: ${tonePath}`);

  // Decode through the ACTUAL production load() — spawns ffmpeg exactly like
  // the app does; this is the real decode path, not a hand-rolled sine array.
  const toneSamples = await audio.load(tonePath, { sampleRate: RATE });
  ok(`decoded via the real audio.load(): ${toneSamples.length} samples`);

  const SEEDS = [11, 777, 2024, 4243, 99991];
  const roundTripResults = [];
  for (const seedBase of SEEDS) {
    const permuted = permuteWithinFrames(toneSamples, FRAME, seedBase);

    // Round-trip through a SECOND real WAV file — encode the permuted PCM,
    // decode it back through the real load() — so the equality claim below is
    // checked against genuinely-real, on-disk audio media both directions,
    // not just an in-memory array.
    const permPath = join(FIXDIR, `challenge15-tone440-permuted-seed${seedBase}.wav`);
    await encodeWav(permuted, permPath);
    const permutedFromFile = await audio.load(permPath, { sampleRate: RATE });

    const rA = audio.reduce(toneSamples, { frameSamples: FRAME });
    const rB = audio.reduce(permutedFromFile, { frameSamples: FRAME });
    const identical = same(rA, rB);
    roundTripResults.push({ seedBase, identical, rA, rB });
    console.log(`  seed ${String(seedBase).padEnd(6)} real-file round-trip: audio.reduce(tone) === audio.reduce(permuted-via-real-wav) → ${identical}`);
  }

  const allIdentical = roundTripResults.every((r) => r.identical);
  if (allIdentical) {
    ok("CONFIRMED, on real ffmpeg-decoded/-encoded WAV files across 5 independent seeds: the production audio.reduce() is exactly blind to within-frame permutation. RESULTS.md's self-report is accurate — this is not a synthetic-array artifact of the existing unit test.");
  } else {
    fail("audio.reduce() distinguished tone from a within-frame permutation on real audio files — the self-reported gap does NOT reproduce end-to-end. This would mean RESULTS.md / conformance/perceiver_invariance.test.js:128-141 is stale.");
  }

  // Also exercise the exact in-repo unit-test assertion once more, for the record.
  const unitTestStyleScrambled = permuteWithinFrames(toneSamples, FRAME, 11);
  const unitTestStyleEqual = same(audio.reduce(toneSamples, { frameSamples: FRAME }), audio.reduce(unitTestStyleScrambled, { frameSamples: FRAME }));
  console.log(`\n  (for reference) exact JSON.stringify equality, in-memory only: ${unitTestStyleEqual}`);

  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── PART B: prototype an order-sensitive channel and prove it clears this exact case ──\n");

  const permutedForB = permuteWithinFrames(toneSamples, FRAME, 11);
  const negatedTone = Int16Array.from(toneSamples, (v) => -v);

  const deltaTone = meanAbsDelta(toneSamples, { frameSamples: FRAME });
  const deltaPermuted = meanAbsDelta(permutedForB, { frameSamples: FRAME });
  const deltaNegated = meanAbsDelta(negatedTone, { frameSamples: FRAME });

  const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const mTone = meanOf(deltaTone);
  const mPerm = meanOf(deltaPermuted);
  const relDiff = Math.abs(mTone - mPerm) / mTone;
  console.log(`  meanAbsDelta(tone)      mean over frames = ${mTone.toFixed(2)}`);
  console.log(`  meanAbsDelta(permuted)  mean over frames = ${mPerm.toFixed(2)}`);
  console.log(`  relative difference = ${(relDiff * 100).toFixed(1)}%`);

  if (!same(deltaTone, deltaPermuted) && relDiff > 0.5) {
    ok(`candidate channel is NOT blind: tone vs permuted differ by ${(relDiff * 100).toFixed(0)}% — this is exactly the kind of failure the file's own header calls "the success signal".`);
  } else {
    fail(`candidate channel failed to discriminate tone from permuted samples (relDiff=${(relDiff * 100).toFixed(1)}%) — the proposed statistic does not actually clear this case.`);
  }

  // holds: does the candidate channel, on its own, respect polarity invariance?
  if (same(deltaTone, deltaNegated)) {
    ok("candidate channel holds polarity invariance on its own (meanAbsDelta(tone) === meanAbsDelta(-tone)) — consistent with zero-crossing rate's polarity invariance, which RESULTS.md filed as NOT a defect.");
  } else {
    fail("candidate channel is NOT polarity-invariant — it would need justification RESULTS.md's mutation-check discipline does not currently provide.");
  }

  // Now the actual "breaks the equality" proof, in the file's own vocabulary:
  // build the [rms, delta] combined reduction (new channel ADDED, RMS kept
  // exactly as-is) and re-run literally the same equality the existing
  // "blind:" test asserts. It must now be false (moved) while the polarity
  // "holds:" test must still be true (unmoved).
  const combinedToneVsPermuted = same(combinedReduce(toneSamples, { frameSamples: FRAME }), combinedReduce(permutedForB, { frameSamples: FRAME }));
  const combinedToneVsNegated = same(combinedReduce(toneSamples, { frameSamples: FRAME }), combinedReduce(negatedTone, { frameSamples: FRAME }));

  console.log(`\n  combinedReduce (rms + meanAbsDelta, RMS untouched) — tone vs permuted equal? ${combinedToneVsPermuted}  (existing test asserted "true"; a real fix must flip this to false)`);
  console.log(`  combinedReduce — tone vs polarity-inverted equal?   ${combinedToneVsNegated}  (must STAY true — this is the "holds" test's claim, and combinedReduce must not break it)`);

  if (!combinedToneVsPermuted) {
    ok('adding meanAbsDelta as a NEW channel (RMS untouched) makes conformance/perceiver_invariance.test.js:128-141\'s exact assertion FAIL — which the file\'s own header (lines 24-30) defines as the success signal for this gap: "delete the test and record what replaced it."');
  } else {
    fail("adding the candidate channel did not change the blind: test's verdict — it would still pass unmodified, i.e. the candidate channel does not actually close the gap.");
  }
  if (!combinedToneVsNegated) {
    candidateBrokeHolds = true;
    fail('adding meanAbsDelta broke conformance/perceiver_invariance.test.js:143-150\'s "audio holds: polarity inversion" — a fix must not do this, and this prototype does.');
  } else {
    ok('the "holds: polarity inversion" equality survives the addition of this channel — the fix direction does not cost the invariance RESULTS.md confirmed is not a defect.');
  }

  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── PART C: same rotation-null methodology as scripts/binary-clearings.mjs, on a real alternating-order WAV ──\n");

  // Build a longer real tone, slice it into alternating "as recorded" /
  // "within-frame permuted" segments of the SAME underlying continuous
  // waveform — so overall loudness is constant end to end and the ONLY thing
  // that changes at each segment boundary is order. This is the real-media
  // equivalent of a boundary RMS cannot see by construction.
  const SEG_FRAMES = 40; // 40 * 400 samples = 16000 samples = 2s per segment @ 8kHz
  const N_SEGMENTS = 8;
  const longTonePath = join(FIXDIR, "challenge15-tone440-long.wav");
  ff(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=8000", "-t", String((SEG_FRAMES * N_SEGMENTS * FRAME) / RATE + 1), longTonePath]);
  const longTone = await audio.load(longTonePath, { sampleRate: RATE });

  const segSamples = SEG_FRAMES * FRAME;
  const parts = [];
  const truthFrames = [];
  for (let s = 0; s < N_SEGMENTS; s++) {
    const start = s * segSamples;
    const seg = longTone.slice(start, start + segSamples);
    const isPermuted = s % 2 === 1;
    parts.push(isPermuted ? permuteWithinFrames(seg, FRAME, 5000 + s) : seg);
    if (s > 0) truthFrames.push(s * SEG_FRAMES); // frame index of each segment TRANSITION
  }
  const composite = new Int16Array(parts.reduce((a, p) => a + p.length, 0));
  { let o = 0; for (const p of parts) { composite.set(p, o); o += p.length; } }

  const compositePath = join(FIXDIR, "challenge15-alternating-order.wav");
  await encodeWav(composite, compositePath);
  const compositeFromFile = await audio.load(compositePath, { sampleRate: RATE });
  console.log(`  real alternating-order WAV written: ${compositePath}`);
  console.log(`  ${N_SEGMENTS} segments × ${SEG_FRAMES} frames, real-order/within-frame-permuted alternating`);
  console.log(`  true segment-transition frames: [${truthFrames.join(", ")}]`);

  const rmsSeries = audio.reduce(compositeFromFile, { frameSamples: FRAME });
  const deltaSeries = meanAbsDelta(compositeFromFile, { frameSamples: FRAME });

  const rmsStats = stats(rmsSeries);
  const deltaStats = stats(deltaSeries);
  console.log(`\n  RMS series:        n=${rmsSeries.length}  min=${rmsStats.min.toFixed(3)} max=${rmsStats.max.toFixed(3)} sd=${rmsStats.sd.toFixed(4)}  (should be ~flat — loudness never changes)`);
  console.log(`  meanAbsDelta series: n=${deltaSeries.length}  min=${deltaStats.min.toFixed(1)} max=${deltaStats.max.toFixed(1)} sd=${deltaStats.sd.toFixed(1)}  (should show real structure at the transitions)`);

  const SPEC = { window: 8, draws: 200, reseeds: 5, tolerance: 2, hop: 2, seed: 17 };
  const CONTROLS = 24;
  const extent = rmsSeries.length;

  const boundariesOf = (turn) => turn.events.filter((e) => e.op === "REC").map((e) => e.at);
  const scoreOf = (turn, ext) => {
    const found = boundariesOf(turn);
    const one = (w) => ({ h: hits(found, truthFrames, w), prec: precision(found, truthFrames, w), chance: chanceBaseline(found.length, truthFrames, w, ext) });
    return { found: found.length, boundaries: found, causal: one(causalWindow(SPEC)), tight: one(tightWindow(SPEC)) };
  };

  const runAndScore = (name, series) => {
    console.log(`\n  ── ${name} ──`);
    for (const [mname, clearOn] of [["surfeit", ["surfeit"]], ["moved", ["moved"]], ["both", ["surfeit", "moved"]]]) {
      const turn = runTurn({ material: series, ...SPEC, clearOn });
      if (isGap(turn)) {
        console.log(`    ${mname.padEnd(8)} GAP — ${turn.gap}`);
        continue;
      }
      const r = scoreOf(turn, extent);
      const ctl = [];
      for (let c = 0; c < CONTROLS; c++) {
        const t = runTurn({ material: shuffled(series, 4243 + c * 7919), ...SPEC, clearOn });
        if (!isGap(t)) ctl.push(scoreOf(t, extent));
      }
      for (const which of ["causal", "tight"]) {
        const w = which === "causal" ? causalWindow(SPEC) : tightWindow(SPEC);
        const excess = r[which].h - r[which].chance;
        const ctlExcess = stats(ctl.length ? ctl.map((c) => c[which].h - c[which].chance) : [0]);
        const z = ctlExcess.sd > 0 ? ((excess - ctlExcess.mean) / ctlExcess.sd).toFixed(2) : "—";
        const rot = rotationNull(r.boundaries, truthFrames, w, extent, 1);
        const rs = stats(rot);
        const rotP = rot.length ? (rot.filter((h) => h >= r[which].h).length / rot.length).toFixed(3) : "—";
        console.log(
          `    ${mname.padEnd(8)} ${which.padEnd(6)} ${String(r[which].h).padStart(2)}/${truthFrames.length} recall, ${String(r[which].prec).padStart(2)}/${String(r.found).padStart(2)} prec | chance ${r[which].chance.toFixed(1).padStart(4)} | shuffled z=${String(z).padStart(5)} | ROTATED ${rs.mean.toFixed(1)}±${rs.sd.toFixed(1)} p≈${rotP}`,
        );
      }
      if (name.startsWith("RMS")) {
        // The claim under test predicts near-zero recall here (order carries
        // nothing RMS can see); record but do not fail the script on it — a
        // gap or ~0 recall on the CURRENT channel is the expected, confirming
        // result, not a bug in this script.
      } else if (name.startsWith("candidate") && mname === "moved") {
        const causalR = r.causal;
        if (causalR.h >= Math.ceil(truthFrames.length * 0.5)) {
          ok(`candidate channel recovers ${causalR.h}/${truthFrames.length} real order-transitions (causal window) via the production runTurn organ — genuine detection, not a synthetic-array trick.`);
        } else {
          fail(`candidate channel only recovered ${causalR.h}/${truthFrames.length} transitions via runTurn — weaker real-pipeline signal than PART B's raw-statistic comparison suggested.`);
        }
      }
    }
  };

  runAndScore("RMS (current production channel)", rmsSeries);
  runAndScore("candidate meanAbsDelta channel", deltaSeries);

  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── PART D: the actual conformance file, unmodified, still green ──\n");
  const conf = spawnSync(process.execPath, ["--test", "conformance/perceiver_invariance.test.js"], { cwd: join(HERE, "..", ".."), encoding: "utf8" });
  const confOut = conf.stdout + conf.stderr;
  const passLine = confOut.match(/# pass \d+|ℹ pass \d+/);
  const failLine = confOut.match(/# fail \d+|ℹ fail \d+/);
  console.log(`  ${passLine ? passLine[0] : "(pass count not found)"}   ${failLine ? failLine[0] : "(fail count not found)"}`);
  const confFailed = conf.status !== 0;
  if (!confFailed) {
    ok("conformance/perceiver_invariance.test.js still 100% green, untouched — including the #15 blind: test itself (still asserting the gap exists) and the #15 holds: polarity test.");
  } else {
    fail("conformance/perceiver_invariance.test.js did not pass cleanly in this environment — see raw output above.");
  }

  // ── summary ────────────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");
  console.log(`PART A (real-pipeline gap reconfirmation): ${allIdentical ? "GAP REPRODUCED — audio.reduce() is exactly blind, on real WAV files, across 5 seeds" : "GAP DID NOT REPRODUCE"}`);
  console.log(`PART B (candidate channel clears the case without breaking holds): ${!combinedToneVsPermuted && !candidateBrokeHolds ? "CONFIRMED" : "NOT CONFIRMED"}`);
  console.log(`PART C (real rotation-null detection of real order-transitions): see per-mode output above`);
  console.log(`PART D (conformance suite untouched, still green): ${!confFailed ? "CONFIRMED" : "NOT CONFIRMED"}`);
  console.log(`\nTotal script-level assertion failures: ${failures}`);
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((e) => { console.error("SCRIPT ERROR:", e); process.exitCode = 2; });

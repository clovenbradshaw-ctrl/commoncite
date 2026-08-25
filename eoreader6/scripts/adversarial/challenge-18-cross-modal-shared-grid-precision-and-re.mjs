// eoreader6 · adversarial challenge #18 — cross-modal shared-grid precision
// and recall
//
// Claim under test: "the shared structural fold-grid makes cross-modal
// comparison measurable (same coordinates regardless of medium), not merely
// analogical." The real mechanism this maps to (survey + SEED.md Amendment
// IV, CUBE.md) is NOT a literal grid data structure — CUBE.md line 3 says so
// outright — it is `packages/engine/emergence/fold.js`'s `fold()`/`agree()`
// pair: fold() projects a numeric series from a causal standpoint into a
// per-INDEX placement (placed/beyond/beneath), and agree() compares two such
// projections position-by-position. Because every perceiver in this repo
// already reduces its medium to a plain numeric array (audio: RMS/frame,
// text: causal surprisal/chunk), two folds of EQUAL LENGTH built from two
// DIFFERENT MODALITIES pass agree()'s only material-compatibility check
// (`a.spec.of === b.spec.of`, which is literally the string `n${length}` —
// length equality, not identity or modality). That is the seam #18 asks to
// be exercised for real, in both directions:
//
//   RECALL:    two modalities with a genuine, constructed shared structural
//              event (an audio loudness swell and a text vocabulary-novelty
//              swell placed at the SAME index range) — does agree() report
//              elevated concord there, above a positional null?
//
//   PRECISION: two modalities with NO real relationship (a shuffled bag of
//              real prose + literal white noise) — does agree() correctly
//              NOT report a concord level indistinguishable from, or higher
//              than, the genuine pair's?
//
// Per the challenge brief, precision is weighted higher: RESULTS.md's
// documented within-modality order-blindness (audio RMS, video abs-diff) is
// exactly the kind of mechanism that could make TWO independently "boring"
// series look similar to each other for reasons that have nothing to do with
// genuine cross-modal correspondence.
//
// This script touches no source file. Fixtures are written under
// scripts/adversarial/fixtures/ and are real: a real WAV file (PCM16, no
// ffmpeg needed to WRITE it, but decoded by the real production
// audio/material.js::load(), which DOES spawn real ffmpeg) and real text
// files tokenized and scored by the real production text/material.js.
//
// Usage: node scripts/adversarial/challenge-18-cross-modal-shared-grid-precision-and-re.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fold, agree } from "../../packages/engine/emergence/fold.js";
import { isGap } from "../../nul/index.js";
import * as audio from "../../packages/engine/perceiver/audio/material.js";
import { tokenize, chunkWords, causalSurprisalSeries } from "../../packages/engine/perceiver/text/material.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXDIR = path.join(__dirname, "fixtures");
fs.mkdirSync(FIXDIR, { recursive: true });

const FRANKENSTEIN = "/Users/mlacy/Documents/eoreader4.2/tests/fixtures/frankenstein.txt";

// ── deterministic RNG (same generator used throughout this repo's own
// scripts/lib/surrogates.mjs and nul/index.js, reused rather than reinvented) ──
const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const shuffled = (xs, seed) => {
  const next = rng(seed);
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const stats = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) || 0;
  return { mean, sd };
};

// ── fixture geometry: N=80 index positions in BOTH modalities, chunk 40-59
// is the "event" window in the genuine pair ─────────────────────────────────
const N = 80;
const CHUNK_SIZE = 40; // text: words per chunk -> N text chunks
const FRAME_SAMPLES = 400; // audio: samples per frame -> N audio frames
const SAMPLE_RATE = 8000;
const EVENT_START = 40;
const EVENT_END = 60;

// ── WAV writer (PCM16 mono). We write the container ourselves; the real
// production perceiver still does the real decode via a real ffmpeg spawn —
// this only avoids needing ffmpeg to also do the ENCODE side. ───────────────
function writeWav(filePath, int16Samples, sampleRate) {
  const dataBytes = int16Samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits/sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < int16Samples.length; i++) buf.writeInt16LE(int16Samples[i] | 0, 44 + i * 2);
  fs.writeFileSync(filePath, buf);
}

// ── GENUINE pair construction ────────────────────────────────────────────
// AUDIO: quiet sine (with amplitude jitter, so the ground has real width)
// for frames outside [40,60), loud sine for frames inside it.
function buildStructuredAudio(seed) {
  const next = rng(seed);
  const totalSamples = N * FRAME_SAMPLES;
  const samples = new Array(totalSamples);
  const freq = 220;
  for (let f = 0; f < N; f++) {
    const inEvent = f >= EVENT_START && f < EVENT_END;
    const baseAmp = inEvent ? 6000 : 400;
    for (let j = 0; j < FRAME_SAMPLES; j++) {
      const i = f * FRAME_SAMPLES + j;
      const jitter = 1 + (next() - 0.5) * 0.3; // +/-15% amplitude jitter per sample
      const t = i / SAMPLE_RATE;
      samples[i] = Math.round(baseAmp * jitter * Math.sin(2 * Math.PI * freq * t));
    }
  }
  return samples;
}

// TEXT: baseline chunks reuse a small closed vocabulary (repetitive -> low
// causal surprisal); event chunks (40..59) introduce brand-new unique
// tokens every occurrence (never seen before -> high causal surprisal),
// standing in for "many new proper nouns / technical terms at the climax."
const BASELINE_VOCAB = [
  "the", "quiet", "garden", "held", "its", "usual", "hush", "and", "nothing",
  "moved", "beyond", "slow", "turning", "of", "leaves", "a", "bird", "settled",
  "on", "low", "branch", "waited", "then", "flew", "again", "path", "wound",
  "gently", "toward", "old", "gate", "where", "light", "fell", "soft", "grey",
];
function buildStructuredText(seed) {
  const next = rng(seed);
  const words = [];
  let novelCounter = 0;
  for (let c = 0; c < N; c++) {
    const inEvent = c >= EVENT_START && c < EVENT_END;
    for (let w = 0; w < CHUNK_SIZE; w++) {
      if (inEvent) {
        // A brand-new, never-repeated token every time -> guaranteed zero
        // prior count in the causal frequency table -> maximal surprisal.
        words.push(`zzevent${novelCounter++}`);
      } else {
        words.push(BASELINE_VOCAB[Math.floor(next() * BASELINE_VOCAB.length)]);
      }
    }
  }
  return words.join(" ");
}

// ── UNRELATED pair construction (precision probe) ───────────────────────
// AUDIO: literal white noise, no envelope, no structure.
function buildNoiseAudio(seed) {
  const next = rng(seed);
  const totalSamples = N * FRAME_SAMPLES;
  const samples = new Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) samples[i] = Math.round((next() - 0.5) * 8000);
  return samples;
}

// TEXT: a real prose passage (Frankenstein), sliced and then FULLY
// SHUFFLED at the word level -- "a shuffled bag of unrelated text," per the
// challenge brief. Falls back to a structureless shuffle of the two
// vocabularies above if the sibling-repo fixture is unavailable on this
// machine.
function buildUnrelatedBagText(seed) {
  let words;
  if (fs.existsSync(FRANKENSTEIN)) {
    const raw = fs.readFileSync(FRANKENSTEIN, "utf8");
    const all = tokenize(raw);
    // Take a real, contiguous slice from well inside the book (skip front
    // matter) so this is genuine prose, not boilerplate.
    const start = 5000;
    words = all.slice(start, start + N * CHUNK_SIZE);
    if (words.length < N * CHUNK_SIZE) words = all.slice(0, N * CHUNK_SIZE);
  } else {
    const pool = [...BASELINE_VOCAB, ...Array.from({ length: 200 }, (_, i) => `bagword${i}`)];
    const next = rng(seed + 999);
    words = Array.from({ length: N * CHUNK_SIZE }, () => pool[Math.floor(next() * pool.length)]);
  }
  return shuffled(words, seed).join(" ");
}

// ── write fixtures, run through the REAL perceivers ──────────────────────
function textMaterialFrom(words) {
  const toks = tokenize(words);
  const chunks = chunkWords(toks, CHUNK_SIZE);
  return causalSurprisalSeries(chunks);
}

async function audioMaterialFrom(wavPath) {
  const samples = await audio.load(wavPath, { sampleRate: SAMPLE_RATE });
  return audio.reduce(samples, { frameSamples: FRAME_SAMPLES });
}

// ── fold/agree instrument, run at an OFFSET pair of standpoints ─────────
// agree() refuses (gap "no_ground": "one standpoint cannot differ from
// itself") whenever a.here.start===b.here.start && a.here.end===b.here.end
// -- checked on POSITION ONLY, not on material identity (confirmed live
// below, PART 0). So the single most literal reading of "same coordinates
// regardless of medium" -- fold(textMaterial, here=40) vs
// fold(audioMaterial, here=40) -- is refused outright by construction, even
// though the two folds are built from completely different materials. The
// workaround used for the main test is a 1-index offset (40 vs 39), which
// keeps both standpoints inside the identical pre-event baseline region (so
// the causal ground each fold grows is, in substance, the same "nothing has
// happened yet" prefix) while stepping around the self-identity guard.
const WINDOW = 8;
const DRAWS = 200;
const SEED = 1;
const HERE_A = 40;
const HERE_B = 39;

function concordOf(materialA, materialB, seed = SEED) {
  const fa = fold({ material: materialA, here: HERE_A, window: WINDOW, draws: DRAWS, seed });
  const fb = fold({ material: materialB, here: HERE_B, window: WINDOW, draws: DRAWS, seed });
  if (isGap(fa) || isGap(fb)) return { gap: isGap(fa) ? fa : fb };
  const ag = agree(fa, fb);
  if (isGap(ag)) return { gap: ag };
  return { concord: ag.concord, same: ag.same, split: ag.split, n: ag.n, foldA: fa, foldB: fb, ag };
}

// Positional/rotation null: how much concord arises between the SAME two
// series if one of them is circularly shifted, so it is no longer aligned
// to the other's real event window, while every other property of each
// series (its own regime, its own ground-worthy structure) is untouched.
// Same idiom as scripts/lib/surrogates.mjs's rotationNull: rotate the
// alignment, not the internal structure.
function rotate(arr, k) {
  const n = arr.length;
  const kk = ((k % n) + n) % n;
  return arr.slice(kk).concat(arr.slice(0, kk));
}

function positionalNull(materialA, materialB, offsets) {
  const vals = [];
  for (const k of offsets) {
    const rotatedB = rotate(materialB, k);
    const r = concordOf(materialA, rotatedB);
    if (r.concord != null) vals.push(r.concord);
  }
  return vals;
}

// ── run ────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== challenge #18: cross-modal shared-grid precision and recall ===\n");

  // PART 0: confirm the same-here self-identity refusal live, across two
  // DIFFERENT modalities (not the same material twice) -- a concrete,
  // load-bearing finding independent of the main precision/recall result.
  {
    const genuineTextWords = buildStructuredText(11);
    const textMat = textMaterialFrom(genuineTextWords);
    const audioSamplesTmp = buildStructuredAudio(11);
    const audioMatTmp = audio.reduce(audioSamplesTmp, { frameSamples: FRAME_SAMPLES });
    const fa = fold({ material: textMat, here: 40, window: WINDOW, draws: DRAWS, seed: SEED });
    const fb = fold({ material: audioMatTmp, here: 40, window: WINDOW, draws: DRAWS, seed: SEED });
    const ag = agree(fa, fb);
    console.log("PART 0 -- literal same-coordinate cross-modal agree() (text here=40 vs audio here=40):");
    console.log("  fa gap:", fa.gap ?? "none", " fb gap:", fb.gap ?? "none");
    console.log("  agree() result:", JSON.stringify(ag));
    console.log(
      isGap(ag)
        ? "  => REFUSED. agree()'s self-identity guard compares here.start/here.end ONLY, not material\n" +
            "     identity or modality, so the literal 'same coordinate across two media' case this\n" +
            "     challenge names is exactly the case the guard treats as 'one standpoint cannot differ\n" +
            "     from itself' -- even though the two standpoints project TWO DIFFERENT MODALITIES.\n"
        : "  => NOT refused (unexpected; re-check fold.js's agree() guard).\n"
    );
  }

  // Positional null offsets: EVERY nonzero rotation (exhaustive, same idiom
  // as scripts/lib/surrogates.mjs::rotationNull, adapted here to rotate a
  // raw series rather than a truth vector, since there is no separate
  // boundary list in this mechanism), so the event window no longer lines
  // up while every rotated copy keeps EXACTLY the same multiset of values
  // (a rotation is a permutation) -- each series' own marginal
  // placed/beyond/beneath rate is unchanged and only ALIGNMENT is destroyed.
  const offsets = Array.from({ length: N - 1 }, (_, i) => i + 1); // 1..N-1, exhaustive

  // ── GENUINE pairs (recall probe), 5 independent seeds -- same sample
  // size and same construction/scoring path as the unrelated pairs below,
  // so the two distributions are a fair, apples-to-apples comparison and
  // not one lucky/unlucky draw each. ─────────────────────────────────────
  console.log("GENUINE pairs (constructed real shared event at chunks/frames 40-59, 5 independent seeds):");
  const genuineResults = [];
  for (let s = 0; s < 5; s++) {
    const seed = 11 + s;
    const genuineTextWords = buildStructuredText(seed);
    const genuineAudioSamples = buildStructuredAudio(seed);
    const textPath = path.join(FIXDIR, `challenge18-genuine-text-${s}.txt`);
    const audioPath = path.join(FIXDIR, `challenge18-genuine-audio-${s}.wav`);
    fs.writeFileSync(textPath, genuineTextWords);
    writeWav(audioPath, genuineAudioSamples, SAMPLE_RATE);

    const genuineTextMaterial = textMaterialFrom(genuineTextWords);
    const genuineAudioMaterial = await audioMaterialFrom(audioPath);

    if (genuineTextMaterial.length !== N || genuineAudioMaterial.length !== N) {
      console.log(`  seed ${seed}: FATAL length mismatch text=${genuineTextMaterial.length} audio=${genuineAudioMaterial.length}`);
      continue;
    }

    const r = concordOf(genuineTextMaterial, genuineAudioMaterial, SEED);
    const nullVals = positionalNull(genuineTextMaterial, genuineAudioMaterial, offsets);
    const nStats = stats(nullVals);
    const z = nStats.sd > 0 ? (r.concord - nStats.mean) / nStats.sd : NaN;
    genuineResults.push({ seed, concord: r.gap ? null : r.concord, gap: r.gap ?? null, nullMean: nStats.mean, nullSd: nStats.sd, z });
    console.log(
      r.gap
        ? `  seed ${seed}: GAP ${JSON.stringify(r.gap)}`
        : `  seed ${seed}: concord = ${r.concord.toFixed(4)}  positional-null mean=${nStats.mean.toFixed(4)} sd=${nStats.sd.toFixed(4)}  z = ${z.toFixed(2)}`
    );
  }
  const validGenuine = genuineResults.filter((r) => r.concord != null);
  const genuineConcords = validGenuine.map((r) => r.concord);
  const genuineStatsAgg = stats(genuineConcords);
  const genuineZs = validGenuine.map((r) => r.z).filter(Number.isFinite);

  // ── UNRELATED pairs (precision probe), 5 independent seeds ─────────────
  console.log("\nUNRELATED pairs (shuffled real-prose bag + white noise, 5 independent seeds):");
  const unrelatedResults = [];
  for (let s = 0; s < 5; s++) {
    const seed = 100 + s;
    const bagWords = buildUnrelatedBagText(seed);
    const noiseSamples = buildNoiseAudio(seed);
    const bagPath = path.join(FIXDIR, `challenge18-unrelated-text-${s}.txt`);
    const noisePath = path.join(FIXDIR, `challenge18-unrelated-audio-${s}.wav`);
    fs.writeFileSync(bagPath, bagWords);
    writeWav(noisePath, noiseSamples, SAMPLE_RATE);

    const bagMaterial = textMaterialFrom(bagWords);
    const noiseMaterial = await audioMaterialFrom(noisePath);

    if (bagMaterial.length !== N || noiseMaterial.length !== N) {
      console.log(`  seed ${seed}: FATAL length mismatch text=${bagMaterial.length} audio=${noiseMaterial.length}`);
      continue;
    }

    const r = concordOf(bagMaterial, noiseMaterial, SEED);
    const nullVals = positionalNull(bagMaterial, noiseMaterial, offsets);
    const nStats = stats(nullVals);
    const z = nStats.sd > 0 ? (r.concord - nStats.mean) / nStats.sd : NaN;
    unrelatedResults.push({ seed, concord: r.gap ? null : r.concord, gap: r.gap ?? null, nullMean: nStats.mean, nullSd: nStats.sd, z });
    console.log(
      r.gap
        ? `  seed ${seed}: GAP ${JSON.stringify(r.gap)}`
        : `  seed ${seed}: concord = ${r.concord.toFixed(4)}  positional-null mean=${nStats.mean.toFixed(4)} sd=${nStats.sd.toFixed(4)}  z = ${z.toFixed(2)}`
    );
  }

  const validUnrelated = unrelatedResults.filter((r) => r.concord != null);
  const unrelatedConcords = validUnrelated.map((r) => r.concord);
  const unrelatedStats = stats(unrelatedConcords);
  const maxUnrelated = Math.max(...unrelatedConcords);
  const unrelatedZs = validUnrelated.map((r) => r.z).filter(Number.isFinite);

  console.log(
    `\nSummary: genuine concord:   mean=${genuineStatsAgg.mean.toFixed(4)} sd=${genuineStatsAgg.sd.toFixed(4)} ` +
      `min=${Math.min(...genuineConcords).toFixed(4)} max=${Math.max(...genuineConcords).toFixed(4)}` +
      `  (z range vs each own null: ${genuineZs.map((z) => z.toFixed(2)).join(", ")})`
  );
  console.log(
    `         unrelated concord: mean=${unrelatedStats.mean.toFixed(4)} sd=${unrelatedStats.sd.toFixed(4)} ` +
      `min=${Math.min(...unrelatedConcords).toFixed(4)} max=${maxUnrelated.toFixed(4)}` +
      `  (z range vs each own null: ${unrelatedZs.map((z) => z.toFixed(2)).join(", ")})`
  );

  // ── verdict ──────────────────────────────────────────────────────────
  // RECALL holds only if EVERY genuine replicate clears its own positional
  // null with a real margin (z >= 2) -- the system reliably, not just
  // occasionally, reports the constructed cross-modal coincidence as
  // elevated above chance alignment.
  const allGenuineClearOwnNull = genuineZs.length === genuineConcords.length && genuineZs.every((z) => z >= 2);
  const recallHolds = allGenuineClearOwnNull;

  // PRECISION holds only if EVERY unrelated replicate stays both (a) below
  // the LOWEST genuine replicate's raw concord (a fair, symmetric,
  // apples-to-apples comparison of the two 5-seed distributions, not one
  // lucky/unlucky draw each), and (b) statistically indistinguishable from
  // ITS OWN positional null (z < 2). Either condition failing on ANY
  // replicate is a real precision violation: an unrelated pair reporting a
  // concord as high as, or higher than, a genuinely matched pair, or
  // clearing its own chance baseline, is exactly the false-positive
  // cross-modal match the challenge asks about -- and per the challenge
  // brief this half is weighted more heavily given RESULTS.md's documented
  // within-modality order-blindness.
  const minGenuine = genuineConcords.length ? Math.min(...genuineConcords) : NaN;
  const anyUnrelatedAtOrAboveMinGenuine = Number.isFinite(minGenuine) && unrelatedConcords.some((c) => c >= minGenuine);
  const anyUnrelatedClearsOwnNull = unrelatedZs.some((z) => z >= 2);
  const precisionHolds = !anyUnrelatedAtOrAboveMinGenuine && !anyUnrelatedClearsOwnNull;

  console.log("\n=== VERDICT ===");
  console.log(`RECALL    (every genuine replicate detected above its own chance baseline, z>=2): ${recallHolds ? "HOLDS" : "FAILS"}`);
  console.log(`  genuine z-scores: ${genuineZs.map((z) => z.toFixed(2)).join(", ")}  (need ALL >= 2.0)`);
  console.log(`PRECISION (no unrelated replicate matches/exceeds genuine, or clears its own null): ${precisionHolds ? "HOLDS" : "FAILS"}`);
  if (anyUnrelatedAtOrAboveMinGenuine) {
    console.log(
      `  -> at least one unrelated replicate's raw concord (max=${maxUnrelated.toFixed(4)}) reached or exceeded the LOWEST genuine`
    );
    console.log(`     replicate's concord (${minGenuine.toFixed(4)}), with no threshold in agree() to warn a caller which is which.`);
  }
  if (anyUnrelatedClearsOwnNull) {
    console.log("  -> at least one unrelated replicate cleared its OWN positional-rotation null (z >= 2) -- a spurious cross-modal 'signal.'");
  }

  console.log("\nOVERALL: the claim under test requires BOTH halves. " + (recallHolds && precisionHolds ? "PASS" : "FAIL") + ".");
  console.log("\nDone.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});

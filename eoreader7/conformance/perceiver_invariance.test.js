// eoreader6 · perceiver invariance — what each reduction CANNOT see, measured
// rather than argued.
//
// `nul` is answerable for whether a statistic is sensitive to what its
// perturbation destroys (SEED.md #4). Nothing anywhere is answerable for
// whether the MATERIAL still carries what the perturbation is going to
// destroy. A reduction that has already thrown the structure away hands `nul`
// a well-formed series about the wrong quantity, and every null downstream
// passes, because they are all conditioned on the material they were given.
//
// So: the invariance audit. For each perceiver, enumerate transformations of
// the SOURCE that leave `material` unchanged, and ask whether any of them are
// transformations a competent perceiver of that medium must notice. It needs
// no corpus, no labels, and no decoder — `reduce` is pure by the contract in
// perceiver/text/material.js, so the audit runs on synthesised units and
// answers in milliseconds. That is the whole reason it is here and the
// clearing tests are not: they need labelled boundaries per modality, which do
// not exist yet.
//
// THREE KINDS OF TEST LIVE IN THIS FILE, and the differences matter.
//
//   sees:   a transform the reduction MUST notice. A failure is a bug.
//   blind:  a transform the reduction does not notice AND ought to, asserted
//           as an equality. These are characterisation tests. They pass today
//           BECAUSE the reduction is impoverished, and the day someone gives
//           audio a spectral reduction or image a two-dimensional one, the
//           matching `blind:` test starts failing. THAT FAILURE IS THE
//           SUCCESS SIGNAL — delete the test and record what replaced it.
//           A gap is a result (SEED.md #8); this is the same move, held in
//           executable form so it cannot quietly stop being true.
//   holds:  an invariance that is defensible — a transform a competent
//           perceiver may legitimately ignore. Recorded because the audit is
//           worthless if every invariance is scored as a defect, and because
//           these are the ones a future reduction must be allowed to keep.
//
// EVERY `blind:` TEST WAS CHECKED FOR DISCRIMINATION, because an equality that
// no plausible improvement would break asserts nothing. Each was re-run
// against a minimally-repaired reduction and confirmed to fail there:
//
//   audio octave, within-frame permutation   vs zero-crossing rate      breaks
//   image row-scramble                       vs per-row gradient energy breaks
//   video cut-vs-fade                        vs changed-pixel fraction  breaks
//   video spatial permutation                vs half-frame motion       breaks
//   video brighten-vs-darken                 vs signed mean difference  breaks
//
// AUDIO'S WITHIN-FRAME-PERMUTATION GAP IS NOW CLOSED, not just predicted to be
// closeable — perceiver/audio/material.js added a second channel, `flux`
// (mean absolute first-difference per frame, the zero-crossing-rate family
// this file predicted would break the equality), ADDED alongside `rms`, never
// replacing it. `rms` stays the default and stays exactly as blind as before
// — it is the loudness channel and loudness genuinely does not depend on
// arrangement, which is a fact about sums-of-squares, not an unfixed bug.
// The gap this file used to record as unclosed is the one a caller now closes
// by asking for the `flux` channel instead. Both claims are asserted below:
// the "blind:" test for `rms` still passes (channel default unchanged), and a
// new "sees:" test proves `flux` does not share the blindness — with a
// "holds:" test alongside it proving the fix did not cost polarity
// invariance, which is the other half of "did not break what RESULTS.md
// confirmed is not a defect."
//
// The check demoted two tests written as `blind:` and moved them to `holds:`.
// A per-row gradient reduction is ALSO mirror-invariant (reversing a row
// preserves the multiset of adjacent differences), and zero-crossing rate is
// ALSO polarity-invariant — so neither equality was evidence of impoverishment
// in the first place. That demotion is the method working, and it is the
// reason the mutation step is not optional when adding to this file.
//
// WHAT THIS FILE ESTABLISHES, in one line: four of the five perceivers' DEFAULT
// channel reduces to first-order intensity (RMS, mean luminance, mean absolute
// difference, the raw column) and one reduces to second-order surprise (causal
// surprisal against its own prior history). Only the second-order one is
// sensitive to the arrangement of what it is made of BY DEFAULT.
// scripts/RESULTS.md measured that asymmetry once already, on bytes: meanByte
// 8/24 against causal surprisal 14/24, and "RMS energy is the analogue of
// meanByte." Audio is no longer only-first-order, though: it now carries a
// second, non-default channel (`flux`) that is order-sensitive the same way
// causal surprisal is, closing (for a caller who asks for it) the specific gap
// this file's own header used to record as unclosed. See the AUDIO section
// below for the measured proof, on both channels, that this is true.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as audio from "../packages/engine/perceiver/audio/material.js";
import * as image from "../packages/engine/perceiver/image/material.js";
import * as video from "../packages/engine/perceiver/video/material.js";
import * as csv from "../packages/engine/perceiver/csv/material.js";
import * as text from "../packages/engine/perceiver/text/material.js";
import { ground, difference, burstiness, isGap } from "../nul/index.js";
import { temporality } from "../temporality/index.js";

// Deterministic, because a blindness that only shows up on some seeds is not a
// blindness, it is a coincidence.
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

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO — RMS energy per frame (default channel), flux per frame (2nd channel)
//
// RMS is a sum of squares over a frame. Sum is permutation-invariant and
// square is sign-invariant, so the reduction is blind to EVERYTHING inside a
// frame except its energy: pitch, timbre, phase, polarity, direction. What
// survives is the loudness envelope and nothing else. That is still exactly
// true of `rms`, the default channel, and the first two tests below still
// measure it.
//
// `flux` (mean absolute first-difference per frame) was added alongside it,
// never replacing it, specifically to close the within-frame-permutation gap
// — the tests after that measure the same permutation against `flux` instead,
// and prove the closure survives the one invariance (polarity) RESULTS.md
// separately confirmed a competent reduction may legitimately keep.
// ─────────────────────────────────────────────────────────────────────────────

const RATE = 8000;
const FRAME = 400; // 50 ms — the perceiver's own default
const FRAMES = 20;

const tone = (hz, { amp = 8000, n = FRAME * FRAMES } = {}) => {
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) s[i] = Math.round(amp * Math.sin((2 * Math.PI * hz * i) / RATE));
  return s;
};

test("audio blind: an octave is inaudible — 440 Hz and 880 Hz at matched amplitude", () => {
  const a = audio.reduce(tone(440), { frameSamples: FRAME });
  const b = audio.reduce(tone(880), { frameSamples: FRAME });
  const rel = Math.max(...a.map((v, i) => Math.abs(v - b[i]) / v));
  // Measured: 4.7e-7. The residual is int16 rounding, not pitch — both tones
  // sit at an integer number of cycles per 50 ms frame, so RMS is A/sqrt(2)
  // for both by construction.
  assert.ok(rel < 1e-5, `an octave moved the material by ${rel} — has audio gained a spectral reduction?`);
  // This is the leitmotif claim, stated at its smallest: a motif and the same
  // motif transposed are one series. scripts/RESULTS.md:105 predicted exactly
  // this ("a nameless leitmotif would need an audio reduction that is as
  // informative for music as causal surprisal is for prose").
});

// Shared fixtures for every test below that compares real order against a
// within-frame permutation of the exact same samples.
const permutedTone440 = () => {
  const src = tone(440);
  const scrambled = new Int16Array(src);
  for (let f = 0; f + FRAME <= scrambled.length; f += FRAME) {
    const idx = shuffledIndices(FRAME, 11 + f);
    const frame = scrambled.slice(f, f + FRAME);
    for (let i = 0; i < FRAME; i++) scrambled[f + i] = frame[idx[i]];
  }
  return scrambled;
};

test("audio blind: permuting samples WITHIN each frame changes nothing at all — the RMS channel, still (default, unchanged)", () => {
  const src = tone(440);
  const scrambled = permutedTone440();
  // A pure tone and broadband noise built from the same samples: exactly equal
  // on the DEFAULT channel. This is not the whole story anymore — see "audio
  // sees:" below — but `reduce()` with no `channel` option is byte-identical
  // to before the fix, which is the point: RMS is a genuine loudness
  // statistic and loudness genuinely does not depend on arrangement.
  assert.ok(
    same(audio.reduce(src, { frameSamples: FRAME }), audio.reduce(scrambled, { frameSamples: FRAME })),
    "within-frame permutation moved the RMS material — the reduction is no longer pure energy",
  );
});

test("audio sees (regression proof, challenge #15 / RESULTS.md): the flux channel is NOT blind to the same within-frame permutation", () => {
  const src = tone(440);
  const scrambled = permutedTone440();
  // Exactly the transform the test above shows RMS cannot see, scored against
  // the second channel instead. This is the file's own header's "success
  // signal" (line ~28: "delete the test and record what replaced it"),
  // applied without deleting the RMS test — because the fix is an added
  // channel, RMS keeps its (accurate) blind: test and flux earns a sees: one.
  assert.ok(
    !same(audio.reduce(src, { frameSamples: FRAME, channel: "flux" }), audio.reduce(scrambled, { frameSamples: FRAME, channel: "flux" })),
    "flux was supposed to close this gap and did not — a tone and its within-frame permutation are still one series",
  );
  // Not a coincidence of this one seed: reconfirm with four more independent
  // shuffles of the same frames (the audit's own standard for ruling out a
  // seed-specific accident — see the file header's "not a coincidence" note
  // on determinism, applied here to the fix instead of to a blindness).
  for (const seedBase of [777, 2024, 4243, 99991]) {
    const scrambled2 = new Int16Array(src);
    for (let f = 0; f + FRAME <= scrambled2.length; f += FRAME) {
      const idx = shuffledIndices(FRAME, seedBase + f);
      const frame = scrambled2.slice(f, f + FRAME);
      for (let i = 0; i < FRAME; i++) scrambled2[f + i] = frame[idx[i]];
    }
    assert.ok(
      !same(audio.reduce(src, { frameSamples: FRAME, channel: "flux" }), audio.reduce(scrambled2, { frameSamples: FRAME, channel: "flux" })),
      `flux failed to discriminate a within-frame permutation at seed ${seedBase}`,
    );
  }
});

test("audio holds: polarity inversion, which a hearer may legitimately ignore — true on both channels", () => {
  const src = tone(440);
  const flipped = Int16Array.from(src, (v) => -v);
  assert.ok(same(audio.reduce(src, { frameSamples: FRAME }), audio.reduce(flipped, { frameSamples: FRAME })));
  // Not filed as a blindness: zero-crossing rate is polarity-invariant too, and
  // so is hearing for most signals. A reduction that STARTED distinguishing
  // these would need to say why. The fix must not cost this invariance either
  // — flux was chosen (mean ABSOLUTE first-difference) specifically so it
  // would not, and this is the measured check of that construction, not just
  // an appeal to it.
  assert.ok(
    same(audio.reduce(src, { frameSamples: FRAME, channel: "flux" }), audio.reduce(flipped, { frameSamples: FRAME, channel: "flux" })),
    "flux distinguished polarity — the new channel cost an invariance RESULTS.md confirmed is not a defect",
  );
});

test("audio: an invalid channel name is a type error, not a silent fallback to rms", () => {
  assert.throws(() => audio.reduce(tone(440), { frameSamples: FRAME, channel: "spectrum" }), TypeError);
});

test("audio sees: the loudness envelope, which is the one thing it carries", () => {
  const steady = tone(440);
  const swelling = Int16Array.from(steady, (v, i) => Math.round(v * (i / steady.length)));
  assert.ok(!same(audio.reduce(steady, { frameSamples: FRAME }), audio.reduce(swelling, { frameSamples: FRAME })));
});

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE — mean luminance per scanline
//
// Each row becomes one number by summing across it. Sum is permutation-
// invariant, so every horizontal arrangement collapses. The image is read as a
// 64-long series of row brightnesses; the other dimension does not survive
// the reduction in any form.
// ─────────────────────────────────────────────────────────────────────────────

const W = 64;
const H = 64;

const picture = (fn) => {
  const buf = Buffer.alloc(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) buf[r * W + c] = fn(r, c) & 255;
  return { buf, w: W, h: H };
};

const textured = picture((r, c) => r * 3 + c * 7 + ((r * c) % 13) * 11);

test("image holds: the mirror image", () => {
  const mirrored = picture((r, c) => textured.buf[r * W + (W - 1 - c)]);
  assert.ok(same(image.reduce(textured), image.reduce(mirrored)), "a horizontal flip moved the material");
  // This was written as a blindness and demoted by the mutation check: a
  // per-row gradient reduction — a genuine improvement, sensitive to vertical
  // edges — is mirror-invariant too, because reversing a row preserves the
  // multiset of adjacent differences. So the equality does not separate the
  // impoverished reduction from a better one and is not evidence about either.
  // The row-scramble test below is where the actual claim lives.
});

test("image blind: scrambling every pixel within its own row", () => {
  const scrambled = Buffer.alloc(W * H);
  for (let r = 0; r < H; r++) {
    const idx = shuffledIndices(W, 5 + r);
    for (let c = 0; c < W; c++) scrambled[r * W + c] = textured.buf[r * W + idx[c]];
  }
  // Half the image's structure — every vertical edge, every shape, all of it —
  // is destroyed and the material is byte-identical. A photograph and noise
  // with matching row means are one series to this perceiver.
  assert.ok(
    same(image.reduce(textured), image.reduce({ buf: scrambled, w: W, h: H })),
    "row-internal scrambling moved the material — has image gained a 2-D reduction?",
  );
});

test("image sees: vertical structure, which is the axis it kept", () => {
  const banded = picture((r) => (r < H / 2 ? 30 : 220));
  assert.ok(!same(image.reduce(textured), image.reduce(banded)));
});

test("image: raster order is handed in unmarked, and the ladder calls a still picture ARROWED", () => {
  // temporality/index.js is explicit that it cannot establish that an index is
  // time — "that the ordering is time is received from whoever handed the
  // material in, and stays received." perceiver/image hands in scan order and
  // says nothing, so nothing downstream can tell. A vertical gradient reads as
  // entropy production, and so does the same picture upside down: reversal maps
  // the ordinal-pattern distribution onto its own reversal image, and the
  // Jensen-Shannon form is symmetric, so the verdict cannot even distinguish a
  // direction it has already claimed to find.
  const gradient = picture((r, c) => Math.min(255, r * 3 + (c % 5)));
  const m = image.reduce(gradient);
  const upright = temporality({ material: m, draws: 200, window: 3, seed: 7 });
  const flipped = temporality({ material: [...m].reverse(), draws: 200, window: 3, seed: 7 });
  assert.ok(!isGap(upright) && !isGap(flipped));
  assert.equal(upright.verdict, "arrowed");
  assert.equal(flipped.verdict, "arrowed", "the arrow is the same both ways up — it is scan order, not time");
});

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO — mean absolute pixel difference per transition
//
// The mean is taken over the whole frame, so WHERE the change happened is gone
// before the series exists. Magnitude survives; location, extent, and cause do
// not, and any two of cut, pan, zoom, and fade that agree on mean magnitude
// are the same number.
// ─────────────────────────────────────────────────────────────────────────────

const VW = 32;
const VH = 18;
const PIXELS = VW * VH;

test("video blind: a hard cut and a global fade of matched mean magnitude", () => {
  const base = Buffer.alloc(PIXELS, 100);
  const cut = Buffer.from(base);
  for (let i = 0; i < PIXELS / 2; i++) cut[i] = 140; // half the frame jumps 40
  const fade = Buffer.alloc(PIXELS, 120); //             every pixel drifts 20
  // Both are exactly [20]. A scene change and a lighting change are one event.
  assert.deepEqual(video.reduce([base, cut]), video.reduce([base, fade]));
});

test("video blind: permuting pixel positions consistently across every frame", () => {
  const frames = [];
  for (let k = 0; k < 12; k++) {
    const f = Buffer.alloc(PIXELS);
    for (let i = 0; i < PIXELS; i++) f[i] = (i * 5 + k * 17) % 256;
    frames.push(f);
  }
  const idx = shuffledIndices(PIXELS, 23);
  const scrambled = frames.map((f) => Buffer.from(idx.map((i) => f[i])));
  assert.ok(same(video.reduce(frames), video.reduce(scrambled)), "spatial permutation moved the material");
});

test("video blind: a light coming on and a light going out", () => {
  const dark = Buffer.alloc(PIXELS, 100);
  const lit = Buffer.alloc(PIXELS, 180);
  // The absolute value throws the sign away, so the direction of change — real
  // information, and the difference between a scene opening and closing — is
  // not in the series at any window. Breaks under a signed mean difference.
  assert.deepEqual(video.reduce([dark, lit]), video.reduce([lit, dark]));
});

test("video sees: how much moved, which is the one thing it carries", () => {
  const still = [Buffer.alloc(PIXELS, 100), Buffer.alloc(PIXELS, 100)];
  const moving = [Buffer.alloc(PIXELS, 100), Buffer.alloc(PIXELS, 180)];
  assert.ok(!same(video.reduce(still), video.reduce(moving)));
});

// Not testable here, and stated so it is not mistaken for covered: `load`
// samples at fps=2 and 32x18 (video/material.js:10). Every shot shorter than
// 500 ms is invisible and nothing downstream is told it was dropped. That is a
// property of the decode, not the reduction, and needs a fixture to measure.

// ─────────────────────────────────────────────────────────────────────────────
// CSV — the chosen column
//
// Two findings, and the second is the one that generalises past CSV.
// ─────────────────────────────────────────────────────────────────────────────

const readingsTable = () => {
  const rows = [["id", "reading"]];
  for (let i = 0; i < 300; i++) {
    rows.push([String(i + 1), i % 7 === 0 ? "" : String(50 + 10 * Math.sin(i / 4))]);
  }
  return rows;
};

test("csv: a row counter outranks the measurement, and then clears as surfeit", () => {
  const rows = readingsTable();
  // pickNumericColumn takes the most-parseable column, and "most parseable" is
  // not "most meaningful": any measurement with a missing value loses to an
  // index that never has one.
  assert.equal(csv.columnName(rows), "id");
  assert.deepEqual(csv.reduce(rows).slice(0, 4), [1, 2, 3, 4]);

  // And what it picked is the strongest-looking signal the file could contain.
  // A monotone ramp maximises a max-over-windows statistic and its shuffles
  // cannot come near, so the counter is censored ABOVE — surfeit, the trigger
  // to re-zero and read again (nul/index.js:331). The actual measurements sit
  // inside their own support at a placeable rank.
  const spec = { draws: 200, window: 12, seed: 3 };
  const counter = csv.reduce(rows);
  const dCounter = difference(burstiness(counter, spec), ground({ material: counter, ...spec }));
  assert.ok(isGap(dCounter) && dCounter.gap === "exceeds_witness" && dCounter.direction === "above");

  const measured = csv.reduce(rows, { column: 1 });
  const dMeasured = difference(burstiness(measured, spec), ground({ material: measured, ...spec }));
  assert.ok(!isGap(dMeasured), "the real measurements are placeable — it is the counter that overflows the witness");
});

test("csv: unordered records break nul's premise and produce a perfectly healthy ground", () => {
  // Every statistic in `nul` is validated against a shuffle null, which
  // presumes shuffling destroys something real. For a table of unordered
  // records — a set that arrived in a file — row order carries nothing, so
  // shuffling destroys NOTHING, and the null is vacuous in the one way
  // `ground()` was built to refuse. It cannot refuse this one: degenerate_ground
  // fires on zero WIDTH, and the width here is real. The verdict is well-formed
  // and means nothing, and no organ in the repo can tell.
  const bag = [["v"], ...[...Array(300).keys()].map((i) => [String((i * 37) % 101)])];
  const g = ground({ material: csv.reduce(bag), draws: 200, window: 12, seed: 3 });
  assert.ok(!isGap(g), "if this now gaps, something learned to check whether an index is load-bearing");
  assert.ok(g.samples.at(-1) - g.samples[0] > 1, "and the width is healthy, which is exactly the problem");
  // The missing declaration is the same shape as `draws`, `window`, and
  // `reseeds`: whether the index is load-bearing is a property of the material
  // that only the giver knows. temporality/index.js already says so in prose.
});

// ─────────────────────────────────────────────────────────────────────────────
// TEXT — the control, and the reason this file exists
// ─────────────────────────────────────────────────────────────────────────────

test("text sees: rearranging the words, which is what every other perceiver misses", () => {
  const sentence = "the creature spoke and i beheld the wretch upon the ice a nameless dread rose in me".split(" ");
  const words = [];
  for (let i = 0; i < 40; i++) words.push(...sentence);
  const rearranged = [...words];
  const idx = shuffledIndices(rearranged.length, 91);
  for (let i = 0; i < idx.length; i++) rearranged[i] = words[idx[i]];

  // Same multiset of words, same length, same frequency table. The material
  // moves because surprisal is scored against a history, so the ARRANGEMENT is
  // in the series. That is the whole difference between a second-order
  // reduction and the four first-order ones above, and it is why text is the
  // only modality in this repo with a measured clearing result.
  assert.ok(!same(text.reduce(words, { chunkSize: 8 }), text.reduce(rearranged, { chunkSize: 8 })));
});

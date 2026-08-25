// eoreader6 · adversarial challenge #16 — "video light-on vs. light-off"
//
// CLAIM UNDER TEST (scripts/RESULTS.md:137, conformance/perceiver_invariance.test.js:261-268):
//
//   | video | a light coming on vs. the same light going out | **exactly** identical |
//
//   test("video blind: a light coming on and a light going out", () => {
//     const dark = Buffer.alloc(PIXELS, 100);
//     const lit = Buffer.alloc(PIXELS, 180);
//     assert.deepEqual(video.reduce([dark, lit]), video.reduce([lit, dark]));
//   });
//
// The comment on that test names its own fix: "Breaks under a signed mean
// difference."
//
// THIS SCRIPT, IN ORDER:
//
//   PART 1 — reconfirm the gap against the REAL, unmodified repo reduction
//            (packages/engine/perceiver/video/material.js), first with the
//            exact fixture from the conformance file, then parametrically
//            across many seeds/shapes/magnitudes so a single lucky case
//            isn't mistaken for a law (the file's own stated discipline:
//            "a blindness that only shows up on some seeds is not a
//            blindness, it is a coincidence" — applied here in reverse, to
//            the gap itself).
//   PART 2 — reconfirm the SAME gap end-to-end through the REAL pipeline:
//            real ffmpeg-encoded light-on / light-off .mp4 fixtures, decoded
//            by the real, unmodified video.load().
//   PART 3 — implement a candidate fix ENTIRELY WITHIN THIS FILE (no repo
//            source is touched in this phase): a second channel, signed mean
//            luminance delta, computed alongside the existing channel.
//   PART 4 — prove the candidate fix distinguishes light-on from light-off,
//            on the same synthetic sweep AND on the real decoded fixtures.
//   PART 5 — prove the candidate fix does NOT silently repair (or break) the
//            three neighbouring, already-classified video cases in the same
//            file: the still-open "cut vs. fade" blindness (must remain
//            blind — a different, already-named fix, "changed-pixel
//            fraction," is on record for that one, and is out of scope for
//            #16), the "sees: how much moved" case (must still see), and the
//            "permuting pixel positions consistently across every frame"
//            case. That last one is filed as `blind:`, not `holds:`, in
//            conformance/perceiver_invariance.test.js — grepped SEED.md and
//            CUBE.md for anything that would bless consistent spatial
//            permutation as a defensible invariance (the way audio's
//            polarity-inversion or image's mirror-flip are explicitly
//            blessed with a stated reason); nothing there addresses it, so
//            there is no basis to reclassify it as `holds:`. It is left
//            exactly as classified, and PART 5 checks that a signed-mean-
//            difference channel is — same as the existing abs-diff channel —
//            a GLOBAL sum, so it stays invariant under any consistent
//            per-frame pixel permutation. That is not this script deciding
//            the gap is fine; it is confirming the specific fix under test
//            doesn't accidentally alter that gap's status either way.
//
// Run: node --test scripts/adversarial/challenge-16-video-light-on-vs-light-off.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as video from "../../packages/engine/perceiver/video/material.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MEDIA = join(HERE, "fixtures", "media");

// Deterministic RNG — identical construction to conformance/perceiver_invariance.test.js,
// copied (not imported) so this script stands alone and cannot drift silently
// if the conformance file's helper ever changes shape.
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
// PART 1 — reconfirm the gap against the real, unmodified reduce(), on the
// conformance file's own fixture, then across a sweep.
// ─────────────────────────────────────────────────────────────────────────────

const VW = 32, VH = 18;
const PIXELS = VW * VH;

test("PART 1a — real reduce(): the exact conformance fixture is still exactly identical", () => {
  const dark = Buffer.alloc(PIXELS, 100);
  const lit = Buffer.alloc(PIXELS, 180);
  const on = video.reduce([dark, lit]);
  const off = video.reduce([lit, dark]);
  assert.deepEqual(on, off, "expected the documented gap — abs-diff destroys sign");
  assert.deepEqual(on, [80]);
});

test("PART 1b — real reduce(): the gap survives a sweep of shapes/magnitudes/noise, not one lucky case", () => {
  let checked = 0;
  for (const pixels of [PIXELS, 8 * 8, 64 * 36, 1]) {
    for (const [base, delta] of [[100, 80], [10, 5], [0, 255], [200, 55], [128, 1]]) {
      for (const noiseAmp of [0, 3, 15]) {
        for (let seed = 0; seed < 3; seed++) {
          const next = rng(seed * 7919 + pixels + base + delta + noiseAmp);
          const noise = () => Math.round((next() - 0.5) * 2 * noiseAmp);
          const clamp = (v) => Math.max(0, Math.min(255, v));
          const dark = Buffer.alloc(pixels);
          const lit = Buffer.alloc(pixels);
          for (let p = 0; p < pixels; p++) {
            const n = noise();
            dark[p] = clamp(base + n);
            lit[p] = clamp(base + delta + n); // SAME noise draw in both frames at this
                                               // pixel, so on/off are exact mirror images
                                               // of each other, not independently noisy.
          }
          const on = video.reduce([dark, lit]);
          const off = video.reduce([lit, dark]);
          assert.deepEqual(
            on, off,
            `gap did not reproduce at pixels=${pixels} base=${base} delta=${delta} noise=${noiseAmp} seed=${seed}`,
          );
          checked++;
        }
      }
    }
  }
  assert.ok(checked >= 100, `only ran ${checked} configurations — sweep too thin to rule out coincidence`);
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — reconfirm the same gap through the REAL pipeline: real ffmpeg-
// encoded .mp4 fixtures, decoded by the real, unmodified video.load().
// Fixtures are built once, here, from system ffmpeg (no bundled decoder,
// same discipline as goldens/multimodal/synthesize.mjs).
// ─────────────────────────────────────────────────────────────────────────────

const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
};

const buildRealFixtures = () => {
  mkdirSync(MEDIA, { recursive: true });
  // dark = 0x64 = 100, lit = 0xB4 = 180 — same gray values as the conformance
  // fixture, so the real-decode result is directly comparable to PART 1.
  ff(["-f", "lavfi", "-i", "color=c=0x646464:s=32x18:d=2:rate=10", "-frames:v", "20", join(MEDIA, "dark_solid.mp4")]);
  ff(["-f", "lavfi", "-i", "color=c=0xB4B4B4:s=32x18:d=2:rate=10", "-frames:v", "20", join(MEDIA, "lit_solid.mp4")]);
  ff([
    "-i", join(MEDIA, "dark_solid.mp4"), "-i", join(MEDIA, "lit_solid.mp4"),
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[out]", "-map", "[out]",
    join(MEDIA, "lighton_real.mp4"),
  ]);
  ff([
    "-i", join(MEDIA, "lit_solid.mp4"), "-i", join(MEDIA, "dark_solid.mp4"),
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[out]", "-map", "[out]",
    join(MEDIA, "lightoff_real.mp4"),
  ]);
};

// Build once at import time — a real, deterministic ffmpeg round trip, not a
// mock. Kept outside a test() body so a build failure surfaces as a script
// crash (missing ffmpeg), not a silently-passed test.
buildRealFixtures();

let realFrames = null; // filled by the async test below, reused by PART 4's real-pipeline check

test("PART 2 — real pipeline: ffmpeg-decoded light-on vs. light-off is STILL exactly identical", async () => {
  const onFrames = await video.load(join(MEDIA, "lighton_real.mp4"));
  const offFrames = await video.load(join(MEDIA, "lightoff_real.mp4"));
  assert.ok(onFrames.length >= 2 && offFrames.length >= 2, "real decode produced too few frames to reduce");

  const on = video.reduce(onFrames);
  const off = video.reduce(offFrames);

  // Real H.264 encoding of two flat-color clips is not guaranteed to be
  // bit-exact the way the synthetic Buffers in PART 1 are — this is the
  // genuinely adversarial part of PART 2. Report what actually happened
  // rather than assuming.
  realFrames = { onFrames, offFrames, on, off };

  const maxAbsDelta = Math.max(...on.map((v, i) => Math.abs(v - off[i])));
  assert.ok(
    maxAbsDelta < 0.5,
    `real-decode on/off reduce() differ by up to ${maxAbsDelta} — the gap may not survive real compression exactly as claimed`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 3 — candidate fix, local to this file. Repo source is NOT modified in
// this phase. Adds one new channel: signed mean luminance delta per
// transition, alongside the existing (unmodified) abs-diff channel.
// ─────────────────────────────────────────────────────────────────────────────

// reduceWithArrow(frames) -> [{ abs, signed }, ...]
// `abs` is byte-identical to the real video.reduce() output at every index —
// this is additive, not a replacement, so nothing that currently reads
// video.reduce()'s numbers changes meaning if this channel is added beside it.
const reduceWithArrow = (frames, { fraction = 1 } = {}) => {
  const readLen = Math.max(2, Math.floor(frames.length * fraction));
  const out = [];
  for (let i = 1; i < readLen; i++) {
    const a = frames[i - 1], b = frames[i];
    let sumAbs = 0, sumSigned = 0;
    for (let p = 0; p < a.length; p++) {
      const d = b[p] - a[p];
      sumAbs += Math.abs(d);
      sumSigned += d;
    }
    out.push({ abs: sumAbs / a.length, signed: sumSigned / a.length });
  }
  return out;
};

test("PART 3 — candidate fix's abs channel is byte-identical to the real reduce() output", () => {
  const dark = Buffer.alloc(PIXELS, 100);
  const lit = Buffer.alloc(PIXELS, 180);
  const real = video.reduce([dark, lit]);
  const candidate = reduceWithArrow([dark, lit]).map((c) => c.abs);
  assert.deepEqual(candidate, real, "candidate fix's abs channel drifted from the real reduction — not a pure addition");
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 4 — prove the candidate fix distinguishes light-on from light-off.
// ─────────────────────────────────────────────────────────────────────────────

test("PART 4a — candidate fix: the exact conformance fixture is now distinguished", () => {
  const dark = Buffer.alloc(PIXELS, 100);
  const lit = Buffer.alloc(PIXELS, 180);
  const on = reduceWithArrow([dark, lit]);
  const off = reduceWithArrow([lit, dark]);
  assert.notDeepEqual(on, off, "candidate fix did not distinguish light-on from light-off");
  assert.deepEqual(on, [{ abs: 80, signed: 80 }]);
  assert.deepEqual(off, [{ abs: 80, signed: -80 }]);
  // Same magnitude (still [80] on the old channel — nothing about "how much
  // moved" changed), opposite sign on the new channel.
});

test("PART 4b — candidate fix: distinguishes across the same sweep PART 1b used, every case", () => {
  let checked = 0;
  for (const pixels of [PIXELS, 8 * 8, 64 * 36, 1]) {
    for (const [base, delta] of [[100, 80], [10, 5], [0, 255], [200, 55], [128, 1]]) {
      for (const noiseAmp of [0, 3, 15]) {
        for (let seed = 0; seed < 3; seed++) {
          const next = rng(seed * 7919 + pixels + base + delta + noiseAmp);
          const noise = () => Math.round((next() - 0.5) * 2 * noiseAmp);
          const clamp = (v) => Math.max(0, Math.min(255, v));
          const dark = Buffer.alloc(pixels);
          const lit = Buffer.alloc(pixels);
          for (let p = 0; p < pixels; p++) {
            const n = noise();
            dark[p] = clamp(base + n);
            lit[p] = clamp(base + delta + n);
          }
          const on = reduceWithArrow([dark, lit]);
          const off = reduceWithArrow([lit, dark]);
          // The new channel must have opposite sign (when the underlying
          // delta survives clamping) — a strictly stronger, sign-level claim,
          // not just "not equal".
          const clampedAway = base + delta > 255 || base < 0; // clamp can null out the delta at the extremes
          if (!clampedAway) {
            assert.ok(on[0].signed > 0, `on-transition signed channel not positive at pixels=${pixels} base=${base} delta=${delta} noise=${noiseAmp} seed=${seed}: ${on[0].signed}`);
            assert.ok(off[0].signed < 0, `off-transition signed channel not negative at pixels=${pixels} base=${base} delta=${delta} noise=${noiseAmp} seed=${seed}: ${off[0].signed}`);
          }
          assert.notDeepEqual(on, off);
          checked++;
        }
      }
    }
  }
  assert.ok(checked >= 100, `only ran ${checked} configurations`);
});

test("PART 4c — candidate fix on the REAL ffmpeg-decoded fixtures: distinguished end-to-end", () => {
  assert.ok(realFrames, "PART 2 must run first to populate real decoded frames");
  const on = reduceWithArrow(realFrames.onFrames);
  const off = reduceWithArrow(realFrames.offFrames);
  assert.notDeepEqual(on, off, "candidate fix failed to distinguish real-decoded light-on from light-off");

  // At least one transition (the real cut between the two concatenated
  // clips) must show opposite-signed movement in each direction — not just
  // "some numeric difference somewhere", the actual claimed property.
  const maxSignedOn = Math.max(...on.map((c) => c.signed));
  const minSignedOff = Math.min(...off.map((c) => c.signed));
  assert.ok(maxSignedOn > 20, `expected a clearly positive real transition in light-on, got max signed=${maxSignedOn}`);
  assert.ok(minSignedOff < -20, `expected a clearly negative real transition in light-off, got min signed=${minSignedOff}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 5 — the fix must not silently repair or break its neighbours.
// ─────────────────────────────────────────────────────────────────────────────

test("PART 5a — candidate fix leaves the cut-vs-fade blindness OPEN (a different, already-named fix, out of scope for #16)", () => {
  const base = Buffer.alloc(PIXELS, 100);
  const cut = Buffer.from(base);
  for (let i = 0; i < PIXELS / 2; i++) cut[i] = 140; // half the frame jumps +40
  const fade = Buffer.alloc(PIXELS, 120); //             every pixel drifts +20
  const cutOut = reduceWithArrow([base, cut]);
  const fadeOut = reduceWithArrow([base, fade]);
  // Both directions of change are identical (+40 on half / +20 on all), so a
  // signed MEAN is matched too: mean(+40 on half, 0 on half) = +20 = mean(+20
  // on all). The signed-mean-difference fix targets DIRECTION, not LOCATION —
  // it was never claimed to fix this different blindness, and must not
  // appear to by accident.
  assert.deepEqual(cutOut, fadeOut, "cut-vs-fade unexpectedly started differing — candidate fix scope crept");
});

test("PART 5b — candidate fix still SEES motion magnitude (the one thing the original reduction carries)", () => {
  const still = [Buffer.alloc(PIXELS, 100), Buffer.alloc(PIXELS, 100)];
  const moving = [Buffer.alloc(PIXELS, 100), Buffer.alloc(PIXELS, 180)];
  assert.notDeepEqual(reduceWithArrow(still), reduceWithArrow(moving));
});

test("PART 5c — candidate fix does not reclassify consistent spatial-permutation invariance (still filed `blind:`, not `holds:`, and SEED.md/CUBE.md give no basis to change that)", () => {
  // conformance/perceiver_invariance.test.js:249-259 files this as `blind:`.
  // Grepped SEED.md and CUBE.md (see header note above) for any stated reason
  // a consistent per-frame spatial permutation should be treated as a
  // defensible invariance the way audio polarity-inversion or image mirror-
  // flip are — found none. So this test does not argue the gap is fine; it
  // only checks that the signed-mean-difference channel, being a GLOBAL sum
  // exactly like the existing abs-diff channel, does not accidentally shift
  // that gap's status as a side effect of fixing #16.
  const frames = [];
  for (let k = 0; k < 12; k++) {
    const f = Buffer.alloc(PIXELS);
    for (let i = 0; i < PIXELS; i++) f[i] = (i * 5 + k * 17) % 256;
    frames.push(f);
  }
  for (const seed of [23, 1, 999, 42]) {
    const idx = shuffledIndices(PIXELS, seed);
    const scrambled = frames.map((f) => Buffer.from(idx.map((i) => f[i])));
    const real = video.reduce(frames);
    const realScrambled = video.reduce(scrambled);
    assert.ok(same(real, realScrambled), "sanity check: real reduce() should still be permutation-invariant");

    const fixed = reduceWithArrow(frames);
    const fixedScrambled = reduceWithArrow(scrambled);
    assert.ok(
      same(fixed, fixedScrambled),
      `candidate fix broke consistent-permutation invariance at seed=${seed} — this was not the gap #16 targets`,
    );
  }
});

console.log("challenge-16: script loaded — run with `node --test` to execute assertions above.");

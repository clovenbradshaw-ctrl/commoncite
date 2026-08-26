// eoreader6 · locate — the inverse of load()/reduce(), and the missing half
// of Amendment IV's cross-modal claim (SEED.md).
//
// Amendment IV settled that priors meet freely at the numeric series; it said
// nothing about getting BACK from a position in that series to something a
// reader can be shown. A surf()/divide() standpoint is a material index —
// nothing more — and until locate() existed there was no path from that
// index to a raw sample range (audio) or a byte range (text). This file
// tests the inverse directly: reduce() forward, locate() back, and the two
// must agree exactly, because a located range that disagrees with what was
// actually measured is worse than no location at all — it would report a
// standpoint as being somewhere it was not measured to be.
//
// Video is deliberately absent. Amendment XVI names it as an unattempted gap,
// not an oversight, and there is nothing to test here that would not be
// testing an implementation that does not exist.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as audio from "../packages/engine/perceiver/audio/material.js";
import * as text from "../packages/engine/perceiver/text/material.js";

// ── audio: fixed-stride framing, so locate() is checked exactly ─────────────

const RATE = 8000;
const FRAME = 400;

const tone = (hz, n) => {
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) s[i] = Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / RATE));
  return s;
};

test("audio: locate() recovers the exact sample range reduce() built each material index from", () => {
  const samples = tone(220, FRAME * 30);
  const material = audio.reduce(samples, { frameSamples: FRAME });
  for (let idx = 0; idx < material.length; idx++) {
    const loc = audio.locate(idx, { frameSamples: FRAME, sampleRate: RATE });
    let sumSq = 0;
    for (let j = loc.sampleStart; j < loc.sampleEnd; j++) sumSq += samples[j] * samples[j];
    const rebuilt = Math.sqrt(sumSq / FRAME);
    assert.ok(Math.abs(rebuilt - material[idx]) < 1e-9, `idx ${idx}: located range does not reproduce reduce()'s own value`);
  }
});

test("audio: locate() reports real time, not just sample offsets", () => {
  const loc = audio.locate(10, { frameSamples: FRAME, sampleRate: RATE });
  assert.equal(loc.sampleStart, 4000);
  assert.equal(loc.timeStart, 0.5);
  assert.equal(loc.timeEnd, 0.55);
});

test("audio: locate() refuses what it cannot locate, never guesses a range", () => {
  assert.ok(audio.locate(-1).error);
  assert.ok(audio.locate(1.5).error);
  assert.ok(audio.locate(3, { frameSamples: 0 }).error);
});

// ── text: variable-stride, so tokenizeWithOffsets is checked against
// tokenize() itself before locate() is trusted on top of it ────────────────

const PROSE = `The café was busy.  Café-goers naïve to the crowd, "waiting" -- forty
two minutes! Zoë ordered a croissant. The line grew, and grew, and grew.
${Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ")}`;

test("text: tokenizeWithOffsets carries the same words as tokenize(), in the same order", () => {
  const plain = text.tokenize(PROSE);
  const withOffsets = text.tokenizeWithOffsets(PROSE);
  assert.equal(withOffsets.length, plain.length);
  assert.deepEqual(
    withOffsets.map((t) => t.word),
    plain,
    "an offset-carrying token must not silently disagree with tokenize() about what a word is",
  );
});

test("text: every offset decodes back to the exact word, including multi-byte characters", () => {
  const buf = new TextEncoder().encode(PROSE);
  const dec = new TextDecoder();
  for (const t of text.tokenizeWithOffsets(PROSE)) {
    const decoded = dec.decode(buf.subarray(t.byteStart, t.byteEnd)).toLowerCase();
    assert.equal(decoded, t.word, `byte range [${t.byteStart},${t.byteEnd}) did not decode back to "${t.word}"`);
  }
});

test("text: locate() recovers a chunk's byte range, and re-tokenizing it reproduces reduce()'s own words", () => {
  const chunkSize = 10;
  const plain = text.tokenize(PROSE);
  const offsets = text.tokenizeWithOffsets(PROSE);
  const chunks = text.chunkWords(plain, chunkSize);
  const buf = new TextEncoder().encode(PROSE);
  const dec = new TextDecoder();

  for (let idx = 0; idx < chunks.length; idx++) {
    const loc = text.locate(idx, offsets, { chunkSize });
    const decoded = dec.decode(buf.subarray(loc.byteStart, loc.byteEnd));
    const rewords = text.tokenize(decoded);
    assert.deepEqual(rewords.slice(0, chunks[idx].length), chunks[idx], `chunk ${idx}: located range does not reproduce reduce()'s own words`);
  }
});

test("text: locate() refuses an index past the tokenized material rather than returning an empty range", () => {
  const offsets = text.tokenizeWithOffsets("only four words here");
  assert.ok(text.locate(9999, offsets, { chunkSize: 40 }).error);
  assert.ok(text.locate(0, []).error);
  assert.ok(text.locate(-1, offsets).error);
});

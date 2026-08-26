// eoreader6 · audio field-vector perceiver (promoted from eoreader5) — the
// WAV decoder and the chroma/timbre/moments reading organ, measured.
//
// The material.js contract (load/reduce/locate) reduces audio to a scalar
// series. This perceiver keeps the field vectors: it answers "what are the
// units, what is each unit's field vector?" for a waveform, and nothing
// else. Its invariants are the ones a competent hearer must hold:
//
//   - decode is lossless at the sample level for every supported bit depth
//     and container (8/16/24/32-bit int, 32/64-bit float, extra chunks,
//     multi-channel), and honest about what it discards (phase, sample-rate
//     reduction, channel collapse);
//   - every field value is finite — a NaN or Inf in a unit's vector is a
//     failure of the perceiver, never a property of the signal;
//   - chroma is a unit-norm pitch-class profile; the moments' RMS agrees
//     with the time-domain frame it was measured from.
//
// Fixtures are synthesised in-memory and disclosed as such — this file tests
// the organs, not a particular recording. Real-recording coverage lives with
// the app that consumes the perceiver.

import { test } from "node:test";
import assert from "node:assert/strict";

import { sniffWav, decodeWav } from "../packages/engine/perceiver/audio/wav.js";
import {
  buildAudioReading,
  extractFrameFields,
  frameSignal,
  AUDIO_FIELD_SPEC,
  FRAME_SIZE,
  HOP_SIZE,
  TARGET_SAMPLE_RATE,
} from "../packages/engine/perceiver/audio/reading.js";
import { monoSum, resampleLinear } from "../packages/engine/perceiver/audio/resample.js";
import { magnitudeSpectrum } from "../packages/engine/perceiver/audio/fft.js";

// ── WAV builder — deterministic, no dependency ─────────────────────────────

function chunk(id, data) {
  const pad = data.length % 2 ? Buffer.from([0]) : Buffer.alloc(0);
  return Buffer.concat([Buffer.from(id, "ascii"), u32le(data.length), data, pad]);
}
function u16le(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xffff, 0); return b; }
function u32le(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b; }

function buildWav({ sampleRate, channels, bitDepth, samples, format = 1, extraChunks = [] }) {
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;
  const fmt = Buffer.concat([u16le(format), u16le(channels), u32le(sampleRate), u32le(byteRate), u16le(blockAlign), u16le(bitDepth)]);

  // samples: number[][] (per channel, floats in [-1, 1]) or number[] (mono).
  const channelArrays = Array.isArray(samples[0]) ? samples : [samples];
  const frameCount = channelArrays[0].length;
  const data = Buffer.alloc(frameCount * channels * (bitDepth / 8));
  for (let f = 0; f < frameCount; f++) {
    for (let c = 0; c < channels; c++) {
      const v = channelArrays[c][f];
      const o = (f * channels + c) * (bitDepth / 8);
      if (format === 3 && bitDepth === 32) data.writeFloatLE(v, o);
      else if (format === 3 && bitDepth === 64) data.writeDoubleLE(v, o);
      else if (bitDepth === 8) data.writeInt8(Math.round(v * 127), o);
      else if (bitDepth === 16) data.writeInt16LE(Math.round(v * 32767), o);
      else if (bitDepth === 24) {
        const x = Math.round(v * 8388607);
        data.writeIntLE(x, o, 3);
      } else if (bitDepth === 32) data.writeInt32LE(Math.round(v * 2147483647), o);
      else throw new RangeError(`unsupported bitDepth ${bitDepth}`);
    }
  }
  const body = Buffer.concat([Buffer.from("WAVE", "ascii"), chunk("fmt ", fmt), ...extraChunks, chunk("data", data)]);
  return Buffer.concat([Buffer.from("RIFF", "ascii"), u32le(body.length), body]);
}

// A deterministic test tone: a 440 Hz sine with a decaying envelope, so the
// waveform has real pitch and real dynamics without pretending to be a
// recording.
function testTone({ seconds = 2, sampleRate = TARGET_SAMPLE_RATE, freq = 440 } = {}) {
  const n = Math.floor(seconds * sampleRate);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    out[i] = 0.7 * Math.sin(2 * Math.PI * freq * t) * Math.exp(-0.8 * t);
  }
  return out;
}

// ── decode: lossless at the sample level, per bit depth and container ──────

const TONE = testTone();

test("decodeWav: 16-bit mono round-trips exactly", () => {
  const wav = buildWav({ sampleRate: 22050, channels: 1, bitDepth: 16, samples: TONE });
  assert.ok(sniffWav(wav), "a RIFF/WAVE container must sniff as WAV");
  const { sampleRate, channels, bitDepth, channelData } = decodeWav(wav);
  assert.equal(sampleRate, 22050);
  assert.equal(channels, 1);
  assert.equal(bitDepth, 16);
  assert.equal(channelData[0].length, TONE.length);
  for (let i = 0; i < TONE.length; i++) {
    const expect = Math.round(TONE[i] * 32767) / 32768;
    assert.ok(Math.abs(channelData[0][i] - expect) < 1e-6, `sample ${i} did not round-trip`);
  }
});

test("decodeWav: 24-bit sign-extends correctly (negative samples included)", () => {
  const wav = buildWav({ sampleRate: 8000, channels: 1, bitDepth: 24, samples: [0.5, -0.5, 0, 1, -1] });
  const { channelData } = decodeWav(wav);
  const expect = [0.5, -0.5, 0, 1, -1];
  for (let i = 0; i < expect.length; i++) {
    const e = Math.round(expect[i] * 8388607) / 8388608;
    assert.ok(Math.abs(channelData[0][i] - e) < 1e-6, `24-bit sample ${i} wrong`);
  }
});

test("decodeWav: 32-bit float and 64-bit float decode without clipping", () => {
  for (const bitDepth of [32, 64]) {
    const wav = buildWav({ sampleRate: 22050, channels: 1, bitDepth, format: 3, samples: TONE });
    const { channelData } = decodeWav(wav);
    assert.equal(channelData[0].length, TONE.length);
    for (let i = 0; i < TONE.length; i++) {
      assert.ok(Math.abs(channelData[0][i] - TONE[i]) < 1e-6, `float-${bitDepth} sample ${i} wrong`);
    }
  }
});

test("decodeWav: extra chunks before data are skipped, word-aligned", () => {
  const wav = buildWav({
    sampleRate: 8000, channels: 1, bitDepth: 16,
    samples: [0.25, -0.25, 0.5, -0.5],
    extraChunks: [chunk("LIST", Buffer.from("INFOISFTeval-fixture", "ascii")), chunk("fact", Buffer.from("abc", "ascii"))],
  });
  const { channelData } = decodeWav(wav);
  assert.equal(channelData[0].length, 4);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(channelData[0][i] - Math.round(([0.25, -0.25, 0.5, -0.5][i]) * 32767) / 32768) < 1e-6);
});

test("decodeWav: multi-channel stays separated until the perceiver collapses it", () => {
  const left = TONE.map(() => 0.3);
  const right = TONE.map(() => -0.3);
  const wav = buildWav({ sampleRate: 22050, channels: 2, bitDepth: 16, samples: [left, right] });
  const { channels, channelData } = decodeWav(wav);
  assert.equal(channels, 2);
  assert.equal(channelData.length, 2);
  assert.ok(channelData[0][1000] > 0 && channelData[1][1000] < 0, "channels must not be merged at decode time");
});

test("decodeWav: rejects non-WAV bytes instead of guessing", () => {
  assert.ok(!sniffWav(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])));
  assert.throws(() => decodeWav(Buffer.from("not a wave file at all", "ascii")), /RIFF|WAVE/i);
});

// ── field vectors: finite, well-shaped, self-consistent ────────────────────

test("Reading@1: shape and discards are declared, not assumed", async () => {
  const wav = buildWav({ sampleRate: 22050, channels: 1, bitDepth: 16, samples: TONE });
  const { channelData, sampleRate } = decodeWav(wav);
  const reading = await buildAudioReading({ channelData, sampleRate, sourceBytes: wav });

  assert.equal(reading.schema, "Reading@1");
  assert.equal(reading.medium, "audio");
  assert.equal(reading.axis.kind, "time");
  assert.ok(reading.axis.extent > 0);
  assert.ok(reading.units.length > 0, "a non-silent waveform must yield frames");

  const dims = reading.field_spec.channels.reduce((n, c) => n + c.dims, 0);
  assert.equal(dims, 30, "12 chroma + 13 timbre + 5 moments");
  assert.equal(reading.units[0].field.length, dims);

  const discardKinds = reading.discard.map((d) => d.kind);
  for (const kind of ["phase-spectrum", "sample-rate-reduction", "channel-collapse"]) {
    assert.ok(discardKinds.includes(kind), `discard ${kind} must be recorded`);
  }
  assert.match(reading.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(reading.segments_proposed.length, 0, "structure-finding is not the perceiver's job");
  assert.equal(reading.sightings.length, 0);
});

test("Reading@1: every field value is finite; the reading is not a constant column", async () => {
  const wav = buildWav({ sampleRate: 22050, channels: 1, bitDepth: 16, samples: TONE });
  const { channelData, sampleRate } = decodeWav(wav);
  const reading = await buildAudioReading({ channelData, sampleRate });

  const dims = reading.units[0].field.length;
  for (const u of reading.units) {
    for (const v of u.field) {
      assert.ok(Number.isFinite(v), `non-finite field value in unit at ${u.pos}s`);
    }
  }
  // A dimension with variance 0 is not always a defect — a pure tone leaves
  // eleven chroma bins exactly zero for every frame, which is honest. What
  // would be a defect is a reading whose every dimension is constant: a field
  // that cannot see change at all. Assert the reading carries time-variation
  // somewhere, and that two frames differ on at least one dimension.
  let varyingDims = 0;
  for (let d = 0; d < dims; d++) {
    let mean = 0;
    for (const u of reading.units) mean += u.field[d];
    mean /= reading.units.length;
    let variance = 0;
    for (const u of reading.units) variance += (u.field[d] - mean) ** 2;
    variance /= reading.units.length;
    if (variance > 0) varyingDims++;
  }
  assert.ok(varyingDims > 0, "a reading where no dimension varies cannot carry a signal");
  assert.ok(varyingDims < dims, `a pure tone must leave some chroma bins at constant zero (got ${varyingDims}/${dims} varying)`);
  const a = reading.units[0].field;
  const b = reading.units[Math.floor(reading.units.length / 2)].field;
  assert.ok(
    a.some((v, i) => Math.abs(v - b[i]) > 1e-9),
    "two frames from different moments of the waveform must differ somewhere",
  );
});

test("Reading@1: unit positions tile time with the hop, never overlap", async () => {
  const wav = buildWav({ sampleRate: 22050, channels: 1, bitDepth: 16, samples: TONE });
  const { channelData, sampleRate } = decodeWav(wav);
  const reading = await buildAudioReading({ channelData, sampleRate });
  const hopSec = HOP_SIZE / TARGET_SAMPLE_RATE;
  reading.units.forEach((u, i) => {
    assert.ok(Math.abs(u.pos - i * hopSec) < 1e-9, `unit ${i} pos must be ${(i * hopSec).toFixed(4)}s`);
    assert.ok(Math.abs(u.span - hopSec) < 1e-9, "unit span must equal the hop");
  });
});

test("frame fields: chroma is a unit-norm pitch-class profile", () => {
  const resampled = resampleLinear(new Float32Array(TONE), 22050, TARGET_SAMPLE_RATE);
  const { frames } = extractFrameFields(resampled, TARGET_SAMPLE_RATE);
  const mid = Math.floor(frames.length / 2);
  const c = frames[mid].chroma;
  let normSq = 0;
  for (let i = 0; i < 12; i++) normSq += c[i] * c[i];
  assert.ok(Math.abs(Math.sqrt(normSq) - 1) < 1e-4, `chroma norm ${Math.sqrt(normSq)} must be ~1`);
  const peak = c.indexOf(Math.max(...c));
  assert.ok(peak >= 8, `a 440 Hz tone must load the A pitch class, got peak at ${peak}`);
});

test("frame fields: the moments' RMS agrees with the time-domain frame", () => {
  const resampled = resampleLinear(new Float32Array(TONE), 22050, TARGET_SAMPLE_RATE);
  const { frames, hop } = extractFrameFields(resampled, TARGET_SAMPLE_RATE);
  const i = 3;
  const frameSamples = resampled.subarray(i * hop, i * hop + FRAME_SIZE);
  let sumSq = 0;
  for (const s of frameSamples) sumSq += s * s;
  const timeRms = Math.sqrt(sumSq / frameSamples.length);
  assert.ok(Math.abs(frames[i].moments[4] - timeRms) < 1e-6, "perceptual RMS must equal measured RMS");
});

// ── supporting organs ──────────────────────────────────────────────────────

test("monoSum: N channels collapse to the mean of the channels", () => {
  const a = new Float32Array([0.5, 0.25, 0]);
  const b = new Float32Array([0.1, 0.15, 0.2]);
  const sum = monoSum([a, b]);
  sum.forEach((v, i) => {
    assert.ok(Math.abs(v - [0.3, 0.2, 0.1][i]) < 1e-6, `channel-collapsed sample ${i} wrong`);
  });
});

test("resampleLinear: identity at equal rate, correct length at other rates", () => {
  const x = new Float32Array([0, 1, 2, 3, 4]);
  assert.deepEqual([...resampleLinear(x, 8000, 8000)], [...x]);
  const half = resampleLinear(x, 8000, 4000);
  assert.equal(half.length, 3);
  assert.ok(Math.abs(half[0] - 0) < 1e-6);
  assert.ok(Math.abs(half[1] - 2) < 1e-6);
  assert.ok(Math.abs(half[2] - 4) < 1e-6);
});

test("magnitudeSpectrum: a pure sine peaks at its own bin; deterministic", () => {
  const sr = 8192, n = 1024;
  const frame = new Float64Array(n);
  for (let i = 0; i < n; i++) frame[i] = Math.sin((2 * Math.PI * 440 * i) / sr);
  const a = magnitudeSpectrum(frame);
  const b = magnitudeSpectrum(frame);
  assert.deepEqual([...a], [...b], "same input, same spectrum");
  const peakBin = a.indexOf(Math.max(...a));
  const peakFreq = (sr * peakBin) / n;
  assert.ok(Math.abs(peakFreq - 440) < 30, `peak at ${peakFreq}Hz, want ~440Hz`);
});

test("frameSignal: a signal shorter than one frame is still a reading, zero-padded, not dropped", () => {
  const short = new Float32Array(100);
  const frames = frameSignal(short, FRAME_SIZE, HOP_SIZE);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].length, FRAME_SIZE);
});

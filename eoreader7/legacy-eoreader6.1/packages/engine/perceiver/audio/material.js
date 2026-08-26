// eoreader6 · perceiver/audio — real PCM in, per-frame material out.
// Decodes with the system ffmpeg (no bundled decoder, no synthetic waveform).
// See perceiver/text/material.js for the shared load/reduce contract.
//
// TWO CHANNELS, not one reduction replacing another — the same shape as
// csv's `column` option and activation-clearings.mjs's four named channels
// over text, and the discipline conformance/perceiver_invariance.test.js's
// own header states: a gap closes by ADDING a statistic sensitive to what the
// old one missed, never by swapping the old one out from under callers who
// depend on its exact shape. `channel` defaults to "rms", so every existing
// caller (goldens/multimodal, conformance/locate.test.js, and every caller
// that predates this) sees byte-identical output to before this change.
//
//   rms   (default) — loudness envelope. Sum of squares over a frame: sum is
//         commutative/associative, so permuting a frame's samples cannot
//         move it, and squaring discards sign, so polarity cannot either.
//         Carries energy and nothing else. scripts/RESULTS.md's invariance
//         audit measured exactly this gap ("permute samples within each
//         frame ... exactly identical") and it stays true for THIS channel —
//         RMS is still the loudness channel and loudness still does not
//         depend on arrangement.
//   flux  — mean absolute first-difference over a frame (a spectral-flux-
//         style statistic: how much the signal moves sample-to-sample, not
//         how loud it is). Permuting a frame's samples changes which values
//         are adjacent and hence every successive difference, so this
//         channel is order-sensitive by construction — it is the "minimally-
//         repaired reduction" the file's mutation-check paragraph predicted
//         would break the equality (it names zero-crossing rate; flux is the
//         same family: a statistic of adjacent samples, not of the frame's
//         multiset). It is ALSO polarity-invariant by construction
//         (|(-b)-(-a)| === |b-a|), so adding it does not cost the "holds:
//         polarity inversion" invariance RESULTS.md separately confirmed is
//         not a defect — a hearer really may ignore polarity, and this
//         channel keeps ignoring it too.
//
// See conformance/perceiver_invariance.test.js for the measured proof both
// ways: rms stays blind, flux does not, polarity survives on both.

import { spawn } from "node:child_process";

const decodePCM = (path, sampleRate) =>
  new Promise((resolve, reject) => {
    const args = ["-v", "error", "-i", path, "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "pipe:1"];
    const proc = spawn("ffmpeg", args);
    const chunks = [];
    let err = "";
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg audio decode failed (${code}): ${err.slice(0, 300)}`));
      resolve(Buffer.concat(chunks));
    });
  });

export const load = async (path, { sampleRate = 8000 } = {}) => {
  const buf = await decodePCM(path, sampleRate);
  return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
};

const CHANNELS = Object.freeze(["rms", "flux"]);

export const reduce = (samples, { fraction = 1, frameSamples = 400, channel = "rms" } = {}) => {
  if (!CHANNELS.includes(channel)) throw new TypeError(`audio reduce: unknown channel "${channel}" (want one of ${CHANNELS.join(", ")})`);
  const readLen = Math.max(frameSamples, Math.floor(samples.length * fraction));
  const material = [];
  for (let i = 0; i + frameSamples <= readLen; i += frameSamples) {
    if (channel === "rms") {
      let sumSq = 0;
      for (let j = i; j < i + frameSamples; j++) sumSq += samples[j] * samples[j];
      material.push(Math.sqrt(sumSq / frameSamples));
    } else {
      // flux: mean |sample[j] - sample[j-1]| over the frame's adjacent pairs.
      // Order-sensitive (adjacency is exactly what a permutation destroys)
      // and polarity-invariant (the difference of two negated values has the
      // same absolute magnitude as the original).
      let sumAbsDelta = 0;
      for (let j = i + 1; j < i + frameSamples; j++) sumAbsDelta += Math.abs(samples[j] - samples[j - 1]);
      material.push(sumAbsDelta / (frameSamples - 1));
    }
  }
  return material;
};

// The inverse of reduce()'s framing: a surf()/atmosphere() material index
// back to the raw sample range (and, given sampleRate, the real time range)
// it was built from. Symmetric with reduce() by construction -- same
// frameSamples stride, nothing re-derived -- so a standpoint found in a ride
// over this material can be located without re-deciding what a frame is.
// SEED.md Amendment XVI: addressing infrastructure, not a new statistic or
// perturbation, so it does not trigger the growth rule.
export const locate = (index, { frameSamples = 400, sampleRate = 8000 } = {}) => {
  if (!Number.isInteger(index) || index < 0) return { error: "index must be a non-negative integer" };
  if (!Number.isInteger(frameSamples) || frameSamples < 1) return { error: "frameSamples must be a positive integer" };
  const sampleStart = index * frameSamples;
  const sampleEnd = sampleStart + frameSamples;
  return { sampleStart, sampleEnd, timeStart: sampleStart / sampleRate, timeEnd: sampleEnd / sampleRate };
};

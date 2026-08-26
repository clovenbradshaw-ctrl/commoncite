// eoreader6 · perceiver/video — real frames in, motion energy per transition
// out. Material is mean absolute pixel difference between consecutive
// grayscale frames: "perceive only by difference" made literal for the
// visual modality. No optical-flow library, no synthetic cut-timing array —
// just the frames themselves.
// See perceiver/text/material.js for the shared load/reduce contract.

import { spawn } from "node:child_process";

const decodeGrayFrames = (path, { fps = 2, w = 32, h = 18 } = {}) =>
  new Promise((resolve, reject) => {
    const args = ["-v", "error", "-i", path, "-vf", `fps=${fps},scale=${w}:${h}`, "-pix_fmt", "gray", "-f", "rawvideo", "pipe:1"];
    const proc = spawn("ffmpeg", args);
    const chunks = [];
    let err = "";
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg video decode failed (${code}): ${err.slice(0, 300)}`));
      const buf = Buffer.concat(chunks);
      const frameSize = w * h;
      const frames = [];
      for (let i = 0; i + frameSize <= buf.length; i += frameSize) frames.push(buf.subarray(i, i + frameSize));
      resolve(frames);
    });
  });

export const load = async (path, opts = {}) => decodeGrayFrames(path, opts);

export const reduce = (frames, { fraction = 1 } = {}) => {
  const readLen = Math.max(2, Math.floor(frames.length * fraction));
  const material = [];
  for (let i = 1; i < readLen; i++) {
    const a = frames[i - 1], b = frames[i];
    let sum = 0;
    for (let p = 0; p < a.length; p++) sum += Math.abs(a[p] - b[p]);
    material.push(sum / a.length);
  }
  return material;
};

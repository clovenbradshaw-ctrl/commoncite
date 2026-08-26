// eoreader6 · perceiver/image — a still image has no time, but it has scan
// order. Material is mean luminance per scanline, read top-to-bottom — the
// same "growing fraction of the real thing" pattern as every other
// perceiver, with adjacency in space instead of in time.
// See perceiver/text/material.js for the shared load/reduce contract.

import { spawn } from "node:child_process";

const decodeGrayImage = (path, { w = 64, h = 64 } = {}) =>
  new Promise((resolve, reject) => {
    const args = ["-v", "error", "-i", path, "-vf", `scale=${w}:${h}`, "-pix_fmt", "gray", "-f", "rawvideo", "-vframes", "1", "pipe:1"];
    const proc = spawn("ffmpeg", args);
    const chunks = [];
    let err = "";
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg image decode failed (${code}): ${err.slice(0, 300)}`));
      resolve({ buf: Buffer.concat(chunks), w, h });
    });
  });

export const load = async (path, opts = {}) => decodeGrayImage(path, opts);

export const reduce = ({ buf, w, h }, { fraction = 1 } = {}) => {
  const readRows = Math.max(2, Math.floor(h * fraction));
  const material = [];
  for (let r = 0; r < readRows; r++) {
    let sum = 0;
    for (let c = 0; c < w; c++) sum += buf[r * w + c];
    material.push(sum / w);
  }
  return material;
};

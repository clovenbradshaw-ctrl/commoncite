// eoreader6 · goldens/multimodal/synthesize — reproducible synthetic media
// with a KNOWN ground-truth boundary, via system ffmpeg (no bundled decoder,
// no hand-rolled waveform math — same discipline as the perceivers
// themselves). Regenerable; not checked into git as binary media.
//
// Requires: ffmpeg on PATH.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
};

export const synthesize = (dir) => {
  mkdirSync(dir, { recursive: true });

  // AUDIO: 5s silence + 5s 440Hz tone. True boundary at 5.0s.
  ff(["-f", "lavfi", "-i", "anullsrc=r=8000:cl=mono", "-t", "5", join(dir, "_silence.wav")]);
  ff(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=8000", "-t", "5", join(dir, "_tone.wav")]);
  ff([
    "-i", join(dir, "_silence.wav"), "-i", join(dir, "_tone.wav"),
    "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[out]", "-map", "[out]",
    join(dir, "transition.wav"),
  ]);

  // IMAGE: 64x64, top half black / bottom half white. True boundary at row 32.
  ff(["-f", "lavfi", "-i", "color=c=black:s=64x64:d=1", "-frames:v", "1", join(dir, "_top.png")]);
  ff(["-f", "lavfi", "-i", "color=c=white:s=64x64:d=1", "-frames:v", "1", join(dir, "_bottom.png")]);
  ff([
    "-i", join(dir, "_top.png"), "-i", join(dir, "_bottom.png"),
    "-filter_complex", "[0:v]crop=64:32:0:0[t];[1:v]crop=64:32:0:0[b];[t][b]vstack=inputs=2[out]",
    "-map", "[out]", join(dir, "halfsplit.png"),
  ]);

  // VIDEO: 20 static gray frames + 20 frames of genuine motion (testsrc),
  // 10fps. True boundary at transition index 19 (between frame 19 and 20).
  ff([
    "-f", "lavfi", "-i", "color=c=gray:s=32x18:d=2:rate=10",
    "-f", "lavfi", "-i", "testsrc=s=32x18:d=2:rate=10",
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[out]", "-map", "[out]",
    join(dir, "motiontest.mp4"),
  ]);

  return {
    "transition.wav": { modality: "audio", trueBoundaryUnit: "frame", trueBoundary: 100, unitMs: 50 },
    "halfsplit.png": { modality: "image", trueBoundaryUnit: "row", trueBoundary: 32 },
    "motiontest.mp4": { modality: "video", trueBoundaryUnit: "transition", trueBoundary: 19 },
  };
};

if (process.argv[1] && process.argv[1].endsWith("synthesize.mjs")) {
  const dir = process.argv[2] ?? new URL("./media", import.meta.url).pathname;
  const manifest = synthesize(dir);
  console.log(`synthesized into ${dir}:`, manifest);
}

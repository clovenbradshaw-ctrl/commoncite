// eoreader6 · goldens/multimodal/score — runs the SAME boundary organ
// (loops/turn.js::runTurn) that RESULTS.md measured at 22/24 recall against
// Frankenstein's chapters (p≈0.005 vs a rotation null) against real,
// synthesized audio, image, and video, each with a KNOWN ground-truth
// boundary. Nothing here is text-specific; the only per-modality code is the
// PERCEIVER'S REDUCTION (RMS energy / scanline luminance / frame-difference
// motion), exactly the "signal lives in the reduction, not the operator
// chain" finding RESULTS.md already recorded for text.
//
// RESULTS.md left this an open question: "the omnimodal commitment is a
// claim about plumbing... and not yet a claim about perception." This is
// that claim, measured, for the first time.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { synthesize } from "./synthesize.mjs";
import { runTurn } from "../../packages/engine/loops/turn.js";
import { numericVerdict } from "../surprise/detectors.mjs";
import * as audio from "../../packages/engine/perceiver/audio/material.js";
import * as image from "../../packages/engine/perceiver/image/material.js";
import * as video from "../../packages/engine/perceiver/video/material.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MEDIA = join(HERE, "media");

const cases = [
  {
    id: "audio", file: "transition.wav", trueBoundary: 100, tolerance: 6, window: 8,
    reduce: async () => audio.reduce(await audio.load(join(MEDIA, "transition.wav"), { sampleRate: 8000 }), { frameSamples: 400 }),
  },
  {
    id: "image", file: "halfsplit.png", trueBoundary: 32, tolerance: 4, window: 6,
    reduce: async () => image.reduce(await image.load(join(MEDIA, "halfsplit.png"), { w: 64, h: 64 })),
  },
  {
    id: "video", file: "motiontest.mp4", trueBoundary: 19, tolerance: 6, window: 4,
    reduce: async () => video.reduce(await video.load(join(MEDIA, "motiontest.mp4"), { fps: 10, w: 32, h: 18 })),
  },
];

export const runCase = async (c) => {
  const material = await c.reduce();
  const turn = runTurn({ material, window: c.window, draws: 200, reseeds: 8, tolerance: 2, hop: 1, clearOn: ["surfeit", "moved"] });
  const defAt = turn.events.filter((e) => e.op === "DEF").map((e) => e.at);
  const nearest = defAt.length ? defAt.reduce((best, a) => (Math.abs(a - c.trueBoundary) < Math.abs(best - c.trueBoundary) ? a : best)) : null;
  const causalHit = nearest !== null && Math.abs(nearest - c.trueBoundary) <= c.tolerance;

  // The comparison case: the BATCH, global-shuffle-null detector from
  // goldens/surprise, run on the same material. Reported so the causal-vs-
  // batch gap RESULTS.md documents on text is checked cross-modally too.
  const batch = numericVerdict(material, { window: c.window });

  return { id: c.id, materialLength: material.length, trueBoundary: c.trueBoundary, tolerance: c.tolerance, defAt, nearest, causalHit, batchVerdict: batch.verdict };
};

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(join(MEDIA, "transition.wav"))) { console.log("synthesizing media (requires ffmpeg)..."); synthesize(MEDIA); }
  const results = [];
  for (const c of cases) {
    const r = await runCase(c);
    results.push(r);
    console.log(
      `${r.id.padEnd(6)} material=${String(r.materialLength).padStart(4)}  true=${String(r.trueBoundary).padStart(4)}  ` +
      `found=${JSON.stringify(r.defAt).padEnd(14)} nearest=${String(r.nearest).padStart(4)}  ` +
      `causal=${r.causalHit ? "HIT" : "miss"}  batch(shuffle-null)=${r.batchVerdict}`,
    );
  }
  writeFileSync(join(HERE, "fixtures.json"), JSON.stringify({ generated: "from a real run of score.mjs", cases: results }, null, 2), "utf8");
}

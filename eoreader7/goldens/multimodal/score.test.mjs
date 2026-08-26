import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { synthesize } from "./synthesize.mjs";
import { runCase } from "./score.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MEDIA = join(HERE, "media");

// Same case definitions as score.mjs — kept in sync manually since this file
// tests the reusable `runCase`, not a copy of the logic.
import * as audio from "../../packages/engine/perceiver/audio/material.js";
import * as image from "../../packages/engine/perceiver/image/material.js";
import * as video from "../../packages/engine/perceiver/video/material.js";

const CASES = [
  { id: "audio", trueBoundary: 100, tolerance: 6, window: 8, reduce: async () => audio.reduce(await audio.load(join(MEDIA, "transition.wav"), { sampleRate: 8000 }), { frameSamples: 400 }) },
  { id: "image", trueBoundary: 32, tolerance: 4, window: 6, reduce: async () => image.reduce(await image.load(join(MEDIA, "halfsplit.png"), { w: 64, h: 64 })) },
  { id: "video", trueBoundary: 19, tolerance: 6, window: 4, reduce: async () => video.reduce(await video.load(join(MEDIA, "motiontest.mp4"), { fps: 10, w: 32, h: 18 })) },
];

test("setup: synthesize the fixed test media if missing", () => {
  if (!existsSync(join(MEDIA, "transition.wav"))) synthesize(MEDIA);
  assert.ok(existsSync(join(MEDIA, "transition.wav")));
});

for (const c of CASES) {
  test(`${c.id}: the causal boundary organ (runTurn) finds the real synthesized transition within tolerance`, async () => {
    const r = await runCase(c);
    assert.ok(r.causalHit, `expected a DEF event within ${c.tolerance} of true boundary ${c.trueBoundary}, got ${JSON.stringify(r.defAt)}`);
  });

  test(`${c.id}: the batch global-shuffle-null detector misses it (documents the causal-vs-batch gap cross-modally)`, async () => {
    const r = await runCase(c);
    assert.equal(r.batchVerdict, "none", "if this starts passing, the shuffle-saturation finding from goldens/surprise may no longer hold on this modality — investigate, don't just update the assertion");
  });
}

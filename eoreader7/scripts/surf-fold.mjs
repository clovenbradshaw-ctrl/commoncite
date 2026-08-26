// eoreader6 · surf-fold — the ride, its coordinate divisions, and the universe
// projected from the standpoints they yield. Run on real material.
//
// Same harness shape as aperture-run.mjs and the same commitment: only the
// perceiver differs, so this reads a novel, a recording, a spreadsheet or a
// frame sequence by the same operation.
//
// Three questions, in the order the doctrine requires:
//
//   surf   — the region is cleared, then ridden. Where did the horizon hold,
//            where did the wave break over it, where did the water go flat?
//   divide — cut the ride coordinately. TWO modes are run, because "the
//            divisions of the region are not divisions which are; they are
//            divisions which might be," and their disagreement is the point.
//   fold   — from each standpoint a completed occasion yields, project the
//            whole universe: every position placed, or censored beyond, or
//            censored beneath.
//
// Then `alternatives` reports what the choice of quantum left open. A position
// that every standpoint agrees about was settled by the material; one they
// disagree about is free — "either in the settled past, or in the contemporary
// nexus, or even left to the undecided future, according to immediate
// decision."
//
// Usage: node scripts/surf-fold.mjs <path> [kind]

import { surf, divide, standpointsOf } from "../packages/engine/loops/surf.js";
import { fold, alternatives } from "../packages/engine/emergence/fold.js";
import { isGap } from "../nul/index.js";
import * as text from "../packages/engine/perceiver/text/material.js";
import * as audio from "../packages/engine/perceiver/audio/material.js";
import * as video from "../packages/engine/perceiver/video/material.js";
import * as image from "../packages/engine/perceiver/image/material.js";
import * as csv from "../packages/engine/perceiver/csv/material.js";

const PERCEIVERS = { text, audio, video, image, csv };

const EXT_KIND = {
  txt: "text", md: "text",
  mp3: "audio", m4a: "audio", wav: "audio", flac: "audio", aac: "audio",
  mp4: "video", mov: "video", mkv: "video", webm: "video",
  jpg: "image", jpeg: "image", png: "image", gif: "image",
  csv: "csv",
};

export const inferKind = (path) => EXT_KIND[path.split(".").pop().toLowerCase()];

/**
 * `window`, `draws` and `every` are declared here rather than defaulted
 * downstream. Two of them are SEED.md's numbers; the third is the extent of a
 * coordinate division, which is a choice and never an inference.
 */
export const surfFold = async (
  path,
  { kind, window = 8, draws = 200, hop = 1, seed = 0, every = 25, maxStandpoints = 6, ...perceiverOpts } = {},
) => {
  const k = kind || inferKind(path);
  const perceiver = PERCEIVERS[k];
  if (!perceiver) throw new Error(`no perceiver for kind "${k}" (path: ${path})`);

  const units = await perceiver.load(path, perceiverOpts);
  const material = perceiver.reduce(units, { fraction: 1, ...perceiverOpts });

  const reading = surf({ material, window, draws, hop, seed });
  if (isGap(reading)) return { kind: k, path, chunks: material.length, reading };

  const divisions = {
    surfeit: divide(reading, { mode: "surfeit" }),
    extent: divide(reading, { mode: "extent", every }),
  };

  // Standpoints are spread across the ride rather than taken from the front,
  // so the projections compared below are not all near-neighbours.
  const all = standpointsOf(divisions.surfeit);
  const step = Math.max(1, Math.floor(all.length / maxStandpoints));
  const chosen = all.filter((_, i) => i % step === 0).slice(0, maxStandpoints);

  const folds = chosen
    .map((here) => fold({ material, here, window, draws, seed }))
    .filter((f) => !isGap(f));

  return {
    kind: k, path, chunks: material.length, reading, divisions,
    folds,
    freedom: folds.length >= 2 ? alternatives(folds) : null,
  };
};

export const summarize = ({ kind, path, chunks, reading, divisions, folds, freedom }) => {
  const lines = [`=== [${kind}] ${path} — ${chunks} chunks ===`];

  if (isGap(reading)) {
    lines.push(`  surf: GAP — ${reading.gap}: ${reading.reason ?? ""}`);
    return lines.join("\n");
  }

  const steps = reading.horizon.length;
  const pct = (n) => `${((n / steps) * 100).toFixed(1)}%`;
  lines.push(`  region: ${reading.field.units} reach-units, ${reading.field.coverage.covered}/${reading.field.coverage.extent} covered${reading.field.coverage.complete ? "" : ` (${reading.field.coverage.uncovered} outside the field)`}`);
  lines.push(`  ride:   ${steps} steps · met ${reading.met} (${pct(reading.met)}) · broke ${reading.broke} (${pct(reading.broke)}) · flat ${reading.flat} (${pct(reading.flat)})`);

  for (const [mode, waves] of Object.entries(divisions)) {
    const done = waves.filter((w) => w.perished === "broke");
    const opened = done.filter((w) => w.opened).length;
    lines.push(
      `  divide(${mode}): ${waves.length} waves, ${done.length} completed` +
        (done.length ? ` · ${opened} opened (encounter), ${done.length - opened} narrowed (extraction)` : "") +
        ` · ${waves.length - done.length} unfinished, no satisfaction`,
    );
  }

  if (!folds.length) {
    lines.push("  fold:   no standpoint had enough settled behind it to grow a ground");
    return lines.join("\n");
  }

  lines.push(`  folds:  ${folds.length} standpoints projected`);
  for (const f of folds) {
    const { placed, beyond, beneath, total } = f.reach;
    lines.push(`    here [${f.here.start},${f.here.end}): placed ${placed} · beyond ${beyond} · beneath ${beneath} of ${total} · undecided ${f.undecided} · aperture ${f.aperture.toFixed(4)}`);
  }

  if (freedom && !isGap(freedom)) {
    const threeWay = freedom.byPosition.filter((p) => p.relations.length === 3).length;
    lines.push(
      `  freedom: ${freedom.decided}/${freedom.n} positions settled by the material, ` +
        `${freedom.undecided} left open by the choice of quantum` +
        (threeWay ? ` (${threeWay} of them free across all three relations)` : ""),
    );
  }
  return lines.join("\n");
};

// CLI: node scripts/surf-fold.mjs <path> [kind]
if (process.argv[1] && process.argv[1].endsWith("surf-fold.mjs")) {
  const [, , path, kindArg] = process.argv;
  if (!path) {
    console.error("usage: node scripts/surf-fold.mjs <path> [kind]");
    process.exit(1);
  }
  console.log(summarize(await surfFold(path, { kind: kindArg || undefined })));
}

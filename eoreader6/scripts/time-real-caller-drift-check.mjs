// Ad-hoc check (not committed as part of the fix): does loops/time.js's
// ACTUAL current caller pathway — text/material.js's reduce(), a per-pass
// FIXED frequency table, not causalSurprisalSeries's incrementally-growing
// one — exhibit the same content-dependent drift as feeding it
// causalSurprisalSeries directly did (see
// scripts/turn-fold-formation-min-ground-real-text-calibration.mjs section 4)?
import fs from "node:fs";
import path from "node:path";
import { timeLoop } from "../packages/engine/loops/time.js";
import { tokenize, reduce } from "../packages/engine/perceiver/text/material.js";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const odysseyLines = fs.readFileSync(path.join(REPO_ROOT, "odyssey-greek.txt"), "utf8").split("\n");
const cookeryLines = fs.readFileSync(path.join(REPO_ROOT, "scripts/adversarial/fixtures/cookery-22114-raw.txt"), "utf8").split("\n");
const bookIXText = odysseyLines.slice(3793, 4290).join("\n");
const cookeryText = cookeryLines.slice(265, 1600).join("\n");
const ixWords = tokenize(bookIXText);
const crWords = tokenize(cookeryText);

const PARAM_SETS = [
  { window: 5, draws: 256, reseeds: 16 },
  { window: 6, draws: 96, reseeds: 16 },
  { window: 12, draws: 200, reseeds: 5 }, // aperture-run.mjs's own production SPEC
];

for (const words of [{ name: "Book IX", w: ixWords }, { name: "Cookery", w: crWords }]) {
  console.log(`\n=== ${words.name} (${words.w.length} words) via text/material.js's real reduce() ===`);
  for (const { window, draws, reseeds } of PARAM_SETS) {
    let moved = 0, total = 0;
    const PASSES = 12;
    for (let seed = 0; seed < 10; seed++) {
      const results = timeLoop({
        reduce: (u, { fraction }) => reduce(u, { fraction, chunkSize: 40 }),
        units: words.w,
        passes: PASSES,
        window, draws, reseeds,
      });
      for (const r of results) {
        if (r.pattern && r.pattern.moved != null) { total++; if (r.pattern.moved) moved++; }
      }
    }
    console.log(`  window=${window} draws=${draws} reseeds=${reseeds}: moved=${moved}/${total} (${total ? (100 * moved / total).toFixed(1) : "n/a"}%)`);
  }
}

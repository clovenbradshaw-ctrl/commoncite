// eoreader6 · span-golden-run — scores eoreader6's own significance signal
// against eoreader5's frozen span-golden (21 scenes, 3 entities, War and
// Peace + Frankenstein). Baseline to beat: eoreader5's 5/21
// (packages/engine/emergence/summary/golden/span-golden.json in eoreader5).
//
// No hand-tuned selector, no entity-specific gating (eoreader5's does use
// presence/coref per entity — this doesn't, which is a real methodological
// difference, not a hidden advantage; noted honestly in the report). The
// candidate signal is nul's own apparatus: chunk the document into
// golden-tolerance-sized blocks, build ONE ground from the whole
// document's block-surprisal series, and flag blocks whose figure is
// censored (exceeds_witness — surprisal outside anything the ground's own
// shuffle-perturbation has ever produced) or extreme-ranked within it.
// eoreader5's own dead-ends log already tried lexical-KL/surprise-based
// significance and got 3-4/21 (see its scripts/score-span-golden.mjs
// header) — this is a different mechanism (ground/rank/censoring, not raw
// KL), but the same broad hypothesis, so a similar ceiling is plausible and
// the honest thing is to report whatever comes out, not to tune toward 5/21.

import { readFileSync } from "node:fs";
import { ground, difference, isGap } from "../nul/index.js";
import { buildFrequencyTable, surprisalMicrobits, tokenize } from "../packages/engine/perceiver/text/material.js";

const GOLDEN_PATH = "/Users/mlacy/Documents/Default Project/eoreader5/packages/engine/emergence/summary/golden/span-golden.json";
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
const TEXTS = {
  pg2600: "/Users/mlacy/Downloads/pg2600.txt",
  pg84: "scripts/adversarial/fixtures/pg84-frankenstein.txt",
};
const BLOCK_CHARS = 2000; // same scale as the golden's own tolerance

const blockify = (text, blockChars) => {
  const blocks = [];
  for (let i = 0; i < text.length; i += blockChars) blocks.push({ start: i, text: text.slice(i, i + blockChars) });
  return blocks;
};

const candidateOffsets = (text, { window = 12, draws = 200 } = {}) => {
  const blocks = blockify(text, BLOCK_CHARS);
  const table = buildFrequencyTable(tokenize(text)); // whole-document self-referential vocabulary
  const material = blocks.map((b) => surprisalMicrobits(b.text, table));
  const g = ground({ material, draws, window, seed: 7 });
  if (isGap(g)) return { error: g, offsets: [] };

  // g.samples is a distribution of "the single largest window-of-`window`
  // mean anywhere in one full reshuffle." Comparing a raw one-block value
  // against that is comparing incommensurate quantities — a raw point will
  // almost always look extreme next to a windowed-average statistic,
  // flagging nearly everything (measured: 91% of blocks). The commensurate
  // observation is the real local windowed mean anchored at each position.
  // Only the upper tail counts. Censored below is regularity, not surfeit —
  // "must not be mistaken for it" (nul/index.js's own difference() doc).
  // A narratively significant block should look like a local SPIKE in
  // surprisal, not a dip; a dip is just unremarkable prose.
  const flagged = [];
  for (let i = 0; i + window <= material.length; i++) {
    let sum = 0;
    for (let j = i; j < i + window; j++) sum += material[j];
    const localMean = sum / window;
    const d = difference(localMean, g);
    if (isGap(d) && d.gap === "exceeds_witness" && d.direction === "above") flagged.push({ offset: blocks[i].start, why: "censored:above" });
    else if (!isGap(d) && d.rank >= 0.95) flagged.push({ offset: blocks[i].start, why: `rank:${d.rank.toFixed(2)}` });
  }
  return { offsets: flagged.map((f) => f.offset), flagged, blockCount: blocks.length };
};

const scoreEntity = (e, cache) => {
  const text = readFileSync(TEXTS[e.text], "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!cache[e.text]) cache[e.text] = candidateOffsets(text);
  const { offsets, blockCount } = cache[e.text];

  let hits = 0;
  const lines = [];
  for (const sc of e.scenes) {
    const at = text.indexOf(sc.anchor);
    if (at === -1) { lines.push(`  ??   ${sc.id} (anchor missing)`); continue; }
    const hit = offsets.some((o) => Math.abs(o - at) <= GOLDEN.tolerance);
    if (hit) hits++;
    lines.push(`  ${hit ? "HIT " : "MISS"} ${((at / text.length) * 100).toFixed(1).padStart(5)}%  ${sc.kind.padEnd(22)} ${sc.id}`);
  }
  return { hits, total: e.scenes.length, lines, candidateCount: offsets.length, blockCount };
};

const cache = {};
let totalHit = 0, totalScenes = 0;
for (const e of GOLDEN.entities) {
  const r = scoreEntity(e, cache);
  totalHit += r.hits; totalScenes += r.total;
  console.log(`\n=== ${e.entity} (${e.arc}) — recall ${r.hits}/${r.total} (${r.candidateCount}/${r.blockCount} blocks flagged) ===`);
  for (const l of r.lines) console.log(l);
}
console.log(`\nTOTAL recall: ${totalHit}/${totalScenes}  (eoreader5 baseline: 5/21)`);

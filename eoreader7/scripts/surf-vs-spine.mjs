// Does the ride find the creature's scenes better than the spine does?
//
// Two candidate generators over the SAME material and the same golden:
//
//   spine  forward surprise x presence, stratified   (eoreader5's selector)
//   surf   positions where the wave BROKE — an arrival the accumulated
//          ground could not place. Concrescence reaching satisfaction and
//          perishing, which is a different question from "unusual words here".
//
// Scored honestly: recall at a MATCHED BUDGET, because a generator that emits
// more candidates hits more scenes for free.

import { readFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { resolveNarratorSpans } from "../packages/engine/perceiver/text/narrator.js";
import { surf, divide, standpointsOf } from "../packages/engine/loops/surf.js";
import { isGap } from "../nul/index.js";

const TEXT = "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const COREF = "scripts/adversarial/fixtures/pg84-frankenstein.coref.json";
const GOLDEN_PATH = "/Users/mlacy/Documents/Default Project/eoreader5/packages/engine/emergence/summary/golden/span-golden.json";

const { text } = stripContainer(readFileSync(TEXT, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
const prior = JSON.parse(readFileSync(COREF, "utf8")).referents.find((r) => r.id === "creature");
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
const scenes = GOLDEN.entities.find((e) => e.entity === "creature").scenes;
const tol = GOLDEN.tolerance;

const { resolved } = resolveNarratorSpans(text, "creature", prior.narratorSpans);
const inNarr = (o) => resolved.some((s) => o >= s.from && o < s.to);

const SPF = 4;
const sentences = splitSentences(text);
const frames = [];
for (let i = 0; i < sentences.length; i += SPF) {
  const g = sentences.slice(i, i + SPF);
  if (g.length) frames.push({ offset: g[0].offset, text: g.map((s) => s.text).join(" ") });
}

const WORD = /[\p{L}\p{N}']+/gu;
const words = (t) => t.toLowerCase().match(WORD) ?? [];
const FP = new Set(["i", "me", "my", "mine", "myself"]);
const surfaces = prior.surfaces.map((s) => s.surface.toLowerCase());
const presenceOf = (f) => {
  const l = f.text.toLowerCase();
  let n = 0;
  for (const s of surfaces) { let i = l.indexOf(s); while (i !== -1) { n++; i = l.indexOf(s, i + s.length); } }
  if (inNarr(f.offset)) for (const w of words(f.text)) if (FP.has(w)) n += 0.5;
  return n;
};

// material the ride is taken over: presence, which is what a reading of THIS
// referent is about. A surfeit here is "more of him than the ground can place".
const material = frames.map(presenceOf);

const score = (offsets, label) => {
  let hits = 0;
  const detail = [];
  for (const sc of scenes) {
    const at = text.indexOf(sc.anchor);
    const hit = at !== -1 && offsets.some((o) => Math.abs(o - at) <= tol);
    if (hit) hits++;
    detail.push(`  ${hit ? "HIT " : "MISS"} ${((at / text.length) * 100).toFixed(1).padStart(5)}%  ${sc.id}`);
  }
  console.log(`\n${label}: ${hits}/${scenes.length}  (${offsets.length} candidates)`);
  for (const d of detail) console.log(d);
  return hits;
};

for (const window of [8, 12, 20]) {
  const reading = surf({ material, window, draws: 200, hop: 1, seed: 7 });
  if (isGap(reading)) { console.log(`window ${window}: ${reading.gap}`); continue; }
  const waves = divide(reading, { mode: "surfeit" });
  if (isGap(waves)) { console.log(`window ${window}: ${waves.gap}`); continue; }
  const breaks = standpointsOf(waves);
  if (isGap(breaks)) { console.log(`window ${window}: ${breaks.gap}`); continue; }
  const offsets = breaks.map((i) => frames[Math.min(i, frames.length - 1)].offset);
  score(offsets, `SURF window=${window}`);
}

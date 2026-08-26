// eoreader6 · seam-cost-validate — does the seam statistic discriminate?
//
// A measure that has not been shown to separate the two cases it claims to
// separate is not a measure. `seam-cost.mjs` claims to tell CONTINUOUS prose
// from a PILE OF INDEPENDENTLY WRITTEN SECTIONS. This runs both.
//
//   POSITIVE CONTROL   real continuous prose, cut into consecutive chunks and
//                      given headings. The cut is arbitrary; the prose across
//                      it is genuinely one thing. Must come out
//                      censored_below.
//   NEGATIVE CONTROL   documents assembled from independent prompts. Expected
//                      uninformative — permuting them costs nothing.
//
// If the positive control does not separate from the negative one, the
// statistic is counting features and the whole harness is refused.
//
// The positive control is run at MATCHED SIZE — same form count and same
// section count as the essay it is compared against — because a longer
// document has more ground to predict from and would win for the wrong
// reason.
//
// Usage: node scripts/seam-cost-validate.mjs

import { readFileSync } from "node:fs";
import { seamCost, summarize, tok } from "./seam-cost.mjs";

const DRAWS = 200;
const SEED = 20260801;
const TRIALS = 3; // independent offsets into the prose, to show stability

// Real prose, container skipped by taking the middle of the book. Nothing
// here depends on which offset — that is what running three of them shows.
const PROSE = [
  { id: "frankenstein", path: "../pg84.txt", giver: "Mary Shelley, Frankenstein (PG 84)" },
  { id: "war-and-peace", path: `${process.env.HOME}/Downloads/pg2600.txt`, giver: "Tolstoy, War and Peace (PG 2600)" },
];

const ESSAYS = [
  { id: "sea-turtles-essay", path: "../sea-turtles-essay.md" },
  { id: "sea-turtles-cited", path: "../sea-turtles-cited.md" },
  { id: "sea-turtles-predictive", path: "../sea-turtles-predictive.md" },
  { id: "radiation-decision-memo", path: "../radiation-decision-memo.md" },
];

/**
 * Cut continuous prose into `n` consecutive chunks of `per` words each and
 * present them as a sectioned document.
 *
 * The headings are synthetic and deliberately contentless ("Section 3"), so
 * nothing in the label can predict the body. This is the control's whole
 * point: the ONLY thing carrying the arrangement is the prose itself.
 */
const proseDoc = (words, start, n, per) => {
  const out = [];
  for (let k = 0; k < n; k++) {
    out.push(`## Section ${k + 1}\n`);
    out.push(words.slice(start + k * per, start + (k + 1) * per).join(" "));
    out.push("");
  }
  return out.join("\n");
};

const wordsOf = (path) => {
  const raw = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  // Take the middle half of the file: past any front matter, short of the
  // licence tail. No marker is consulted — this is a coarse slice, declared.
  const mid = raw.slice(Math.floor(raw.length * 0.25), Math.floor(raw.length * 0.75));
  return mid.split(/\s+/).filter(Boolean);
};

const row = (label, r) =>
  r.gap
    ? `  ${label.padEnd(26)}  ${String(r.sections).padStart(3)}      —        —        —       —     GAP ${r.gap}`
    : `  ${label.padEnd(26)}  ${String(r.sections).padStart(3)}  ${String(r.forms).padStart(6)}  ` +
      `${r.whole.real.toFixed(3).padStart(7)}  ${r.whole.nullMean.toFixed(3).padStart(7)}  ` +
      `${r.whole.rank.toFixed(3).padStart(6)}  ${r.seam.rank.toFixed(3).padStart(5)}  ${r.verdict}`;

console.log(`\n=== seam-cost validation · draws=${DRAWS} seed=${SEED} ===\n`);
console.log("  Does the arrangement carry meaning? Rank is the real order's position in");
console.log("  the section-shuffle distribution. Near 0 = real order is cheaper than the");
console.log("  shuffles (continuity). Near 0.5 = indistinguishable from a pile.\n");
console.log(`  ${"document".padEnd(26)}  sec   forms    whole  shuffled    rank   seam  verdict`);
console.log(`  ${"-".repeat(26)}  ---  ------  -------  -------  ------  -----  -------`);

// ── NEGATIVE CONTROLS: documents written across independent prompts ───────
const essayResults = [];
for (const e of ESSAYS) {
  let md;
  try {
    md = readFileSync(e.path, "utf8");
  } catch {
    continue;
  }
  const r = seamCost(md, { draws: DRAWS, seed: SEED });
  essayResults.push({ ...e, r });
  console.log(row(e.id, r));
}

console.log("");

// ── POSITIVE CONTROLS: continuous prose at MATCHED size ───────────────────
// Matched to the first essay that parsed, so the comparison is like-for-like.
const ref = essayResults.find((e) => !e.r.gap);
const nSec = ref ? ref.r.sections : 5;
const per = ref ? Math.floor(ref.r.forms / nSec) : 300;

const proseResults = [];
for (const p of PROSE) {
  let words;
  try {
    words = wordsOf(p.path);
  } catch {
    console.log(`  ${p.id.padEnd(26)}  (not available)`);
    continue;
  }
  for (let t = 0; t < TRIALS; t++) {
    const start = Math.floor((words.length - nSec * per - 1) * ((t + 1) / (TRIALS + 1)));
    const r = seamCost(proseDoc(words, start, nSec, per), { draws: DRAWS, seed: SEED + t });
    proseResults.push(r);
    console.log(row(`${p.id} @${t}`, r));
  }
}

// ── The verdict on the MEASURE itself ─────────────────────────────────────
console.log("");
const ok = (rs) => rs.filter((r) => !r.gap);
const below = (rs) => ok(rs).filter((r) => r.verdict === "censored_below").length;
const meanRank = (rs) => {
  const v = ok(rs).map((r) => r.whole.rank);
  return v.reduce((a, b) => a + b, 0) / (v.length || 1);
};

const pr = ok(proseResults);
const er = ok(essayResults.map((e) => e.r));
console.log(`  continuous prose:  ${below(proseResults)}/${pr.length} censored_below, mean whole-rank ${meanRank(proseResults).toFixed(3)}`);
console.log(`  prompt-assembled:  ${below(essayResults.map((e) => e.r))}/${er.length} censored_below, mean whole-rank ${meanRank(essayResults.map((e) => e.r)).toFixed(3)}`);
console.log("");

if (!pr.length || !er.length) {
  console.log("  INCONCLUSIVE — one side of the comparison had no runs.");
} else if (below(proseResults) === pr.length && below(essayResults.map((e) => e.r)) === 0) {
  console.log("  THE MEASURE DISCRIMINATES. Every continuous-prose control is censored below");
  console.log("  and no prompt-assembled document is. The statistic separates the two cases");
  console.log("  it claims to separate, at matched size and matched section count.");
} else {
  console.log("  THE MEASURE DOES NOT CLEANLY DISCRIMINATE — read the rows, do not trust the");
  console.log("  headline. A statistic that cannot tell continuous prose from a pile is");
  console.log("  counting features (specs/surf-and-fold.md, standing admission criterion).");
}
console.log("");

// Detail for the reference essay, since it is the thing being diagnosed.
if (ref) {
  console.log(`=== detail · ${ref.id} ===`);
  console.log(summarize(ref.r));
  console.log("");
}

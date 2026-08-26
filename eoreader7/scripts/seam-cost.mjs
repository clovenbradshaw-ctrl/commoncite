// eoreader6 · seam-cost — does the ARRANGEMENT of a document carry meaning?
//
//   DEF · Lens · Unraveling
//
// ── THE QUESTION ──────────────────────────────────────────────────────────
//
// A document written across many small prompts is assembled from sections
// each of which was generated on its own. The failure that produces is not
// bad sentences — each section can be locally excellent — it is that the
// sections do not KNOW ABOUT EACH OTHER. Every one cold-starts, re-introduces
// the subject, and restates what an earlier section already established.
//
// The measurable form of that failure: THE ORDER STOPS MATTERING. If the
// sections can be permuted and the document reads the same, there was no
// continuity to lose. Fluency across prompts is exactly the property that
// permuting hurts.
//
// So this script measures one thing: how much cheaper is the document to read
// in its real arrangement than in a shuffled one?
//
// ── WHY THE NULL IS A SECTION-ORDER SHUFFLE ───────────────────────────────
//
// specs/surf-and-fold.md's standing admission criterion: "A gate must fail on
// shuffled input. If a verdict survives destroying word order it is not
// gating." The axis under test here is not word order inside a section — it
// is the arrangement OF sections. So the perturbation permutes whole sections
// and leaves every section's internal text byte-identical.
//
// That makes it a CONDITIONAL null in the sense holonic-task.js's own header
// already argues for: it preserves every within-section statistic exactly —
// same words, same word order, same lengths, same count of sections — and
// destroys only the thing being measured. An unconditional null (shuffling
// words, comparing against a different document) would be a units change.
//
// ── TWO DIRECTIONS, DECLARED SEPARATELY ───────────────────────────────────
//
// Amendment II: above and below are both measurements and neither is the
// informative one, so the direction is reported, never pooled.
//
//   censored below  the real arrangement is CHEAPER than nearly every
//                   shuffle. Earlier sections genuinely predict later ones.
//                   This is continuity.
//   uninformative   the real arrangement sits inside the shuffle
//                   distribution. The sections are order-independent — a
//                   pile, not a document. THIS IS THE STITCHED-PROMPT
//                   SIGNATURE.
//   censored above  the real arrangement is DEARER than the shuffles. The
//                   assembled order actively fights the material.
//
// Reported as a rank against `draws`, no threshold anywhere.
//
// ── AND SEPARATELY: IS THE CHEAPNESS CONTINUITY OR REDUNDANCY? ────────────
//
// A section that merely RESTATES its predecessor is also cheap, and cheapness
// alone cannot tell that from a section that genuinely follows. The two are
// distinguished by WHERE the cheapness sits:
//
//   continuity  the seam is cheap (connectives, anaphora — "these", "such",
//               "that pressure") and the BODY is dear, because it delivers
//               material the document has not had yet.
//   redundancy  the whole section is cheap, seam and body alike. Nothing new
//               arrived.
//
// So `seamLift` (body cost − seam cost) is reported beside the arrangement
// rank. Positive is the shape of prose that connects and then says something.
// Near zero with a low whole-section cost is restatement.
//
// Usage: node scripts/seam-cost.mjs <path.md> [--window N] [--draws N] [--seed N]

import { readFileSync } from "node:fs";
import { createLayer } from "../packages/engine/generation/belief.js";

// ── Declared numbers ──────────────────────────────────────────────────────
// order/alpha/gamma are the house numbers used by every other generation
// measurement in this repo (see generation/RESULTS.md). `draws` is SEED.md's.
// `window` is the extent of a coordinate division — a CHOICE, never an
// inference — and is declared here rather than defaulted downstream.
const ORDER = 4;
const ALPHA = 0.7;
const GAMMA = 0.99995;
const DRAWS = 200;
const WINDOW = 30;
const SEED = 20260801;

const W = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
export const tok = (t) => (String(t).toLowerCase().match(W) ?? []);

const mulberry = (s) => {
  let a = s + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Split a markdown document into sections at headings.
 *
 * The heading LINES are dropped from the token stream and kept only as
 * labels. A heading is the assembler's furniture, not the writing, and
 * leaving it in would let a section be "predicted" by its own title.
 *
 * A `## References` / `## Bibliography` tail is dropped for the same reason a
 * container is: it is not prose and its internal order is not a claim.
 */
export const sections = (md) => {
  const out = [];
  let cur = { label: "(preamble)", lines: [] };
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      if (cur.lines.length) out.push(cur);
      cur = { label: h[2].trim(), lines: [] };
      continue;
    }
    if (/^\s*-{3,}\s*$/.test(line)) continue; // horizontal rules are furniture
    cur.lines.push(line);
  }
  if (cur.lines.length) out.push(cur);

  return out
    .filter((s) => !/^(references|bibliography|sources|works cited)$/i.test(s.label))
    .map((s) => ({ label: s.label, forms: tok(s.lines.join("\n")) }))
    .filter((s) => s.forms.length > 0);
};

/**
 * Read one arrangement causally and return the per-form cost, plus the index
 * at which each section began.
 *
 * The layer is trained ONLY on forms already passed — `massOf` is called
 * before `observe`, never after — so nothing here is scored against itself.
 */
export const readArrangement = (secs) => {
  const forms = [];
  const starts = [];
  for (const s of secs) {
    starts.push(forms.length);
    for (const f of s.forms) forms.push(f);
  }

  const layer = createLayer({ id: "read", tier: "read", order: ORDER, gamma: GAMMA, alpha: ALPHA });
  const cost = new Float64Array(forms.length);
  for (let i = 0; i < forms.length; i++) {
    const ctx = forms.slice(Math.max(0, i - ORDER), i);
    const { mass, reserve } = layer.massOf(ctx, forms[i]);
    cost[i] = -Math.log(mass > 0 ? mass : reserve);
    layer.observe(forms, i);
  }
  return { forms, starts, cost };
};

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/**
 * The seam statistic for one arrangement: mean cost over the first `window`
 * forms of every section EXCEPT whichever one is placed first.
 *
 * The first section is excluded in every arrangement, real and shuffled
 * alike, because it has no seam — nothing precedes it. Including it would
 * make the statistic depend on which section the shuffle happened to put in
 * front, which is a property of the permutation and not of the document.
 */
const seamStat = ({ starts, cost }, window) => {
  const xs = [];
  for (let k = 1; k < starts.length; k++) {
    const end = Math.min(starts[k] + window, k + 1 < starts.length ? starts[k + 1] : cost.length);
    for (let i = starts[k]; i < end; i++) xs.push(cost[i]);
  }
  return mean(xs);
};

/** Mean cost over section BODIES — everything past the seam window. */
const bodyStat = ({ starts, cost }, window) => {
  const xs = [];
  for (let k = 1; k < starts.length; k++) {
    const secEnd = k + 1 < starts.length ? starts[k + 1] : cost.length;
    for (let i = Math.min(starts[k] + window, secEnd); i < secEnd; i++) xs.push(cost[i]);
  }
  return mean(xs);
};

const wholeStat = ({ cost }) => mean(Array.from(cost));

/**
 * Per-boundary diagnostic: one real causal reading (no shuffle), the seam and
 * body cost of EACH section individually.
 *
 * This is what a reviser needs and `seamCost`'s aggregate does not give: WHICH
 * transition is weak. It costs one reading, not `draws` of them, so it is
 * cheap enough to call before and after a targeted rewrite of a single
 * section's opening, to check locally whether that rewrite earned its place —
 * the pencil-vs-ink discipline of specs/surprise-as-revision.md, at the grain
 * of one seam rather than the whole document.
 */
export const perBoundary = (md, { window = WINDOW } = {}) => {
  const secs = sections(md);
  const real = readArrangement(secs);
  const out = [];
  for (let k = 1; k < secs.length; k++) {
    const secEnd = k + 1 < secs.length ? real.starts[k + 1] : real.cost.length;
    const seamEnd = Math.min(real.starts[k] + window, secEnd);
    const seam = mean(Array.from(real.cost.slice(real.starts[k], seamEnd)));
    const body = mean(Array.from(real.cost.slice(seamEnd, secEnd)));
    out.push({ index: k, label: secs[k].label, seam, body, lift: body - seam });
  }
  return out;
};

export const seamCost = (md, { window = WINDOW, draws = DRAWS, seed = SEED } = {}) => {
  const secs = sections(md);
  if (secs.length < 3)
    return {
      gap: "degenerate_ground",
      reason: `a document needs at least 3 sections for an arrangement to be perturbable; found ${secs.length}`,
      sections: secs.length,
    };

  const real = readArrangement(secs);
  const realSeam = seamStat(real, window);
  const realWhole = wholeStat(real);
  const realBody = bodyStat(real, window);

  const rand = mulberry(seed);
  let seamBelow = 0;
  let wholeBelow = 0;
  const nullSeams = [];
  const nullWholes = [];
  for (let d = 0; d < draws; d++) {
    const perm = [...secs];
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    const shuffled = readArrangement(perm);
    const s = seamStat(shuffled, window);
    const w = wholeStat(shuffled);
    nullSeams.push(s);
    nullWholes.push(w);
    if (s <= realSeam) seamBelow++;
    if (w <= realWhole) wholeBelow++;
  }

  // Rank of the real arrangement in the shuffle distribution. Near 0 means
  // the real order is cheaper than nearly every shuffle (continuity); near
  // 0.5 means it is indistinguishable from a pile.
  const seamRank = seamBelow / draws;
  const wholeRank = wholeBelow / draws;

  return {
    sections: secs.length,
    forms: real.forms.length,
    window,
    draws,
    labels: secs.map((s) => s.label),
    seam: { real: realSeam, nullMean: mean(nullSeams), rank: seamRank },
    whole: { real: realWhole, nullMean: mean(nullWholes), rank: wholeRank },
    // Positive: the seam is cheaper than the body — the section connects,
    // then delivers. Near zero: the section arrives at full price, i.e. it
    // began without reference to anything already written.
    seamLift: realBody - realSeam,
    body: realBody,
    verdict:
      seamRank <= 1 / draws ? "censored_below" : seamRank >= 1 - 1 / draws ? "censored_above" : "uninformative",
  };
};

export const summarize = (r) => {
  if (r.gap) return `  GAP — ${r.gap}: ${r.reason}`;
  const L = [];
  L.push(`  ${r.sections} sections, ${r.forms} forms · window=${r.window} draws=${r.draws}`);
  L.push(`  sections: ${r.labels.map((l) => l.slice(0, 22)).join(" | ")}`);
  L.push("");
  L.push(`                     real     shuffled     rank`);
  L.push(`  seam (first ${String(r.window).padStart(2)})  ${r.seam.real.toFixed(3).padStart(7)}   ${r.seam.nullMean.toFixed(3).padStart(8)}   ${r.seam.rank.toFixed(3).padStart(6)}`);
  L.push(`  whole document  ${r.whole.real.toFixed(3).padStart(7)}   ${r.whole.nullMean.toFixed(3).padStart(8)}   ${r.whole.rank.toFixed(3).padStart(6)}`);
  L.push("");
  L.push(`  body cost ${r.body.toFixed(3)} · seamLift ${r.seamLift >= 0 ? "+" : ""}${r.seamLift.toFixed(3)} (body − seam)`);
  L.push(`  arrangement: ${r.verdict.toUpperCase()}`);
  L.push(
    r.verdict === "censored_below"
      ? `    the real order is cheaper than every shuffle — earlier sections predict later ones`
      : r.verdict === "censored_above"
        ? `    the real order is DEARER than the shuffles — the arrangement fights the material`
        : `    the real order sits inside the shuffle distribution — THE SECTIONS ARE ORDER-INDEPENDENT.` +
          `\n    Permuting them costs nothing, so there is no continuity across the seams to lose.`,
  );
  return L.join("\n");
};

if (process.argv[1] && process.argv[1].endsWith("seam-cost.mjs")) {
  const args = process.argv.slice(2);
  const path = args.find((a) => !a.startsWith("--"));
  const flag = (name, dflt) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
  };
  if (!path) {
    console.error("usage: node scripts/seam-cost.mjs <path.md> [--window N] [--draws N] [--seed N]");
    process.exit(1);
  }
  const r = seamCost(readFileSync(path, "utf8"), {
    window: flag("window", WINDOW),
    draws: flag("draws", DRAWS),
    seed: flag("seed", SEED),
  });
  console.log(`\n=== seam-cost · ${path} ===`);
  console.log(summarize(r));
  console.log("");
}

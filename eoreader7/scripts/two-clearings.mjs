// eoreader6 · two-clearings — does the SECOND way a ground can fail see what
// the first is blind to, and is it seeing anything at all?
//
// Turn 1 cleared on surfeit only. Burstiness is a max-over-windows statistic,
// so surfeit sees LEVEL shifts and is blind to SPREAD shifts: on a planted
// two-regime series it caught the level change and missed the variance change,
// while aperture (the ground's interquartile volume) tracked the missed one
// exactly. turn.js now also clears on `moved` — pattern() against the ground's
// own reseeding null. This script asks three questions in order, and the first
// one can kill the second two:
//
//   1. CALIBRATION. before and after are built over DIFFERENT amounts of
//      material while the reseeding null sits at before's n. If growth alone
//      moves the ground, `moved` fires everywhere and means nothing. So run it
//      on material with no regime structure at all — homogeneous noise, and a
//      SHUFFLE of the real series (same marginal distribution, order
//      destroyed). SEED.md #5 is the whole reason this check exists: a
//      statistic that means a different thing before and after material
//      arrives makes every comparison an artefact of growth.
//
//   2. THE PLANTED TEST. calm -> elevated (level shift) -> turbulent (spread
//      shift at the SAME level). Surfeit should catch the first and miss the
//      second. If `moved` catches the second, it is reading what aperture reads.
//
//   3. THE EXTERNAL REFERENCE. Frankenstein's 24 real chapter boundaries,
//      against a chance baseline computed by drawing boundary sets of the same
//      size uniformly at random. Turn 1 scored 1/24 against a chance of 0.99 —
//      exactly chance. That number is the thing to beat, and it is reported
//      here whatever it comes out as.
//
// Usage: node scripts/two-clearings.mjs [frankensteinPath]

import { readFileSync } from "node:fs";
import { runTurn } from "../packages/engine/loops/turn.js";
import { isGap } from "../nul/index.js";
import { causalSurprisalSeries, chunkWords, tokenize } from "../packages/engine/perceiver/text/material.js";

// Deterministic, local to this script: nul is pure and has no randomness of
// its own to lend, and a control that cannot be replayed is not a control.
const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const gaussian = (next) => {
  const u = Math.max(1e-12, next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
};

const shuffled = (xs, seed) => {
  const next = rng(seed);
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Three regimes, and the second transition is invisible to a level statistic
 * by construction: elevated and turbulent share a mean and differ only in
 * spread. That is the whole point — it is the case turn 1 provably missed.
 */
const threeRegimes = (seed) => {
  const next = rng(seed);
  const out = [];
  for (let i = 0; i < 120; i++) out.push(10 + gaussian(next) * 1); //   calm
  for (let i = 0; i < 120; i++) out.push(25 + gaussian(next) * 1); //   elevated  (LEVEL shift at 120)
  for (let i = 0; i < 120; i++) out.push(25 + gaussian(next) * 6); //   turbulent (SPREAD shift at 240)
  return out;
};

const homogeneous = (seed, n = 360) => {
  const next = rng(seed);
  return Array.from({ length: n }, () => 10 + gaussian(next) * 1);
};

// ── scoring ─────────────────────────────────────────────────────────────────

// The match window is derived from the declared numbers, not fitted.
//
//   back = window — one reach-unit, the material's own declared present. It is
//     the resolution at which this reading can distinguish two positions.
//   fwd  = window + tolerance*hop — the same, plus the detector's STRUCTURAL
//     lag: a clearing is causal, so `tolerance` consecutive failures must
//     actually arrive before a boundary can be declared. Scoring a causal
//     detector symmetrically charges it for a delay it is required to have.
//
// Both are reported, because widening the window also lifts the chance
// baseline and the honest thing is to show that it does.
const matchWindow = (spec) => ({ back: spec.window, fwd: spec.window + spec.tolerance * spec.hop });

const hits = (found, truth, w) =>
  truth.filter((t) => found.some((f) => f - t >= -w.back && f - t <= w.fwd)).length;

/** Chance is what you get from boundary sets of the SAME SIZE placed at random. */
const chanceBaseline = (k, truth, w, extent, trials = 2000, seed = 991) => {
  if (k === 0) return 0;
  const next = rng(seed);
  let total = 0;
  for (let t = 0; t < trials; t++) {
    const found = Array.from({ length: k }, () => Math.floor(next() * extent));
    total += hits(found, truth, w);
  }
  return total / trials;
};

/**
 * The sharpest control available, and the cheapest: rotate the CHAPTERS.
 *
 * Uniform-random boundaries are a weak null because real chapters are not
 * uniform — they are roughly evenly spaced, and anything else roughly evenly
 * spaced will hit some of them. Shuffling the series is a strong null but a
 * blunt one: it destroys the series' trend and autocorrelation along with its
 * order, so beating it does not isolate WHICH property is doing the work.
 *
 * A circular shift of the marker positions changes neither the detector's
 * output nor the chapters' own spacing. It breaks exactly one thing: whether
 * the two line up. If recall survives that, the alignment was the artefact.
 */
const rotationNull = (found, truth, w, extent, step = 1) => {
  const out = [];
  for (let d = step; d < extent; d += step) {
    out.push(hits(found, truth.map((t) => (t + d) % extent), w));
  }
  return out;
};

const boundariesOf = (turn) => turn.events.filter((e) => e.op === "REC").map((e) => e.at);

const apertureLine = (turn) => {
  const opened = turn.regions.filter((r) => r.opened === true).length;
  const scored = turn.regions.filter((r) => r.opened !== null).length;
  const trace = turn.regions
    .map((r) => (r.apertureClose == null ? "—" : r.apertureClose.toFixed(2)))
    .join(" → ");
  return `aperture ${trace}   opened ${opened}/${scored}`;
};

const score = (turn, truth, spec, extent) => {
  const found = boundariesOf(turn);
  const w = matchWindow(spec);
  const tight = { back: spec.window, fwd: spec.window };
  const one = (win) => ({
    h: hits(found, truth, win),
    chance: chanceBaseline(found.length, truth, win, extent),
    // precision: how many of the boundaries this run emitted landed on a chapter
    hit: found.filter((f) => truth.some((t) => f - t >= -win.back && f - t <= win.fwd)).length,
  });
  return { found: found.length, boundaries: found, causal: one(w), tight: one(tight) };
};

const report = (label, turn, { truth, spec, extent } = {}) => {
  if (isGap(turn)) {
    console.log(`  ${label.padEnd(22)} GAP — ${turn.gap} ${JSON.stringify(turn)}`);
    return null;
  }
  const found = boundariesOf(turn);
  const line = [`  ${label.padEnd(22)}`];
  line.push(`${found.length} boundaries`);
  line.push(`DEF surfeit=${turn.clearingsBy.surfeit} moved=${turn.clearingsBy.moved}`);
  let s = null;
  if (truth) {
    s = score(turn, truth, spec, extent);
    line.push(`recall ${s.causal.h}/${truth.length} prec ${s.causal.hit}/${s.found} (chance ${s.causal.chance.toFixed(2)})`);
    line.push(`| tight ${s.tight.h}/${truth.length} (chance ${s.tight.chance.toFixed(2)})`);
  }
  console.log(line.join("  "));
  console.log(`    at: [${found.join(", ")}]`);
  console.log(`    ${apertureLine(turn)}`);
  if (Object.keys(turn.driftGaps).length) console.log(`    pattern gaps: ${JSON.stringify(turn.driftGaps)}`);
  return s;
};

const MODES = [
  ["surfeit only", ["surfeit"]],
  ["moved only", ["moved"]],
  ["both", ["surfeit", "moved"]],
];

const runAll = (label, material, spec, truth) => {
  console.log(`\n=== ${label} — n=${material.length}, window=${spec.window}, hop=${spec.hop}, draws=${spec.draws}, reseeds=${spec.reseeds}, tolerance=${spec.tolerance}`);
  const out = {};
  for (const [name, clearOn] of MODES) {
    const t0 = Date.now();
    const turn = runTurn({ material, ...spec, clearOn });
    out[name] = report(name, turn, truth ? { truth, spec, extent: material.length } : {});
    if (process.env.TIMING) console.log(`    (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  return out;
};

// ── 1. calibration: material with nothing in it to find ─────────────────────

const SPEC = { window: 12, draws: 200, reseeds: 5, tolerance: 3, hop: 4, seed: 17 };

console.log("################ 1. CALIBRATION — no regime structure to find ################");
console.log("If `moved` fires here at the rate it fires on structured material, it is");
console.log("reading growth, not the material, and the mechanism is vacuous.");

runAll("homogeneous noise", homogeneous(5), SPEC, null);
runAll("three regimes, SHUFFLED", shuffled(threeRegimes(3), 71), SPEC, null);

// ── 2. the planted test ─────────────────────────────────────────────────────

console.log("\n\n################ 2. PLANTED — level shift at 120, SPREAD shift at 240 ################");
console.log("Surfeit caught 120 and missed 240 in turn 1. Aperture tracked 240 (0.5 → 1.2 → 2.5).");
runAll("three regimes", threeRegimes(3), SPEC, [120, 240]);

// ── 3. the external reference ───────────────────────────────────────────────

const FRANKENSTEIN = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const CHAPTER_RE = /^(?:CHAPTER|Chapter)\s+[IVXLC0-9]+/;
const CHUNK = 100;

let text;
try {
  text = readFileSync(FRANKENSTEIN, "utf8").replace(/\r\n/g, "\n");
} catch {
  console.log(`\n\n(no Frankenstein at ${FRANKENSTEIN} — skipping the external reference)`);
  process.exit(0);
}

// Chapter boundaries in CHUNK units: count real tokens up to each marker, by
// the same tokenizer the series is built from, so the two indexings agree.
const lines = text.split("\n");
let charOffset = 0;
const markerOffsets = [];
for (const line of lines) {
  if (CHAPTER_RE.test(line)) markerOffsets.push(charOffset);
  charOffset += line.length + 1;
}
const words = tokenize(text);
const chapterChunks = markerOffsets
  .map((off) => Math.floor(tokenize(text.slice(0, off)).length / CHUNK))
  .filter((c, i, a) => c > 0 && a.indexOf(c) === i);

const series = causalSurprisalSeries(chunkWords(words, CHUNK));

console.log("\n\n################ 3. EXTERNAL REFERENCE — Frankenstein, 24 real chapters ################");
console.log(`${words.length} tokens → ${series.length} chunks of ${CHUNK}; ${chapterChunks.length} chapter markers`);
console.log(`chapters at chunks: [${chapterChunks.join(", ")}]`);
const real = runAll("Frankenstein", series, SPEC, chapterChunks);

// The control that matters most, and it has to be a DISTRIBUTION, not one
// draw. Recall is confounded with how many boundaries a run happens to emit —
// thirteen boundaries at this slack blanket a third of the extent whatever
// they are tracking — so one shuffled run scoring "nearly as well" and one
// scoring "much worse" are equally uninformative. Shuffling preserves the
// series' marginal distribution and destroys its order: any recall that
// survives that is not coming from the text.
const CONTROLS = Number(process.env.CONTROLS || 24);
console.log(`\n--- control distribution: the same series shuffled ${CONTROLS} ways (marginal preserved, order destroyed)`);

const controls = {};
for (const [name] of MODES) controls[name] = [];
for (let c = 0; c < CONTROLS; c++) {
  const surrogate = shuffled(series, 4243 + c * 7919);
  for (const [name, clearOn] of MODES) {
    const turn = runTurn({ material: surrogate, ...SPEC, clearOn });
    if (!isGap(turn)) controls[name].push(score(turn, chapterChunks, SPEC, series.length));
  }
}

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  return { mean, sd, min: s[0], max: s[s.length - 1] };
};

console.log("\n################ verdict ################");
console.log("The question is never 'above chance'. It is 'above the same mechanism run on");
console.log("material whose order has been destroyed' — chance does not emit 13 boundaries.\n");

for (const [name] of MODES) {
  const r = real[name];
  const cs = controls[name];
  if (!r || !cs.length) continue;
  for (const which of ["causal", "tight"]) {
    const ctlHits = stats(cs.map((c) => c[which].h));
    const ctlExcess = stats(cs.map((c) => c[which].h - c[which].chance));
    const excess = r[which].h - r[which].chance;
    // Where the real run sits in the control distribution of excess-over-chance.
    const beaten = cs.filter((c) => c[which].h - c[which].chance < excess).length;
    const p = ((cs.length - beaten) / cs.length).toFixed(2);
    const z = ctlExcess.sd > 0 ? ((excess - ctlExcess.mean) / ctlExcess.sd).toFixed(2) : "—";

    // ...and the sharper null: the same boundaries against rotated chapters.
    const win = which === "causal" ? matchWindow(SPEC) : { back: SPEC.window, fwd: SPEC.window };
    const rot = rotationNull(r.boundaries, chapterChunks, win, series.length, 4);
    const rs = stats(rot);
    const rotP = (rot.filter((h) => h >= r[which].h).length / rot.length).toFixed(3);

    console.log(
      `  ${name.padEnd(13)} ${which.padEnd(6)} real ${String(r[which].h).padStart(2)}/${chapterChunks.length}  prec ${String(r[which].hit).padStart(2)}/${String(r.found).padStart(2)}  chance ${r[which].chance.toFixed(2).padStart(5)}  excess ${excess.toFixed(2).padStart(6)}`
    );
    console.log(
      `  ${" ".repeat(13)} ${" ".repeat(6)} shuffled series:   hits ${ctlHits.mean.toFixed(1)}±${ctlHits.sd.toFixed(1)} (max ${ctlHits.max}), excess ${ctlExcess.mean.toFixed(2)}±${ctlExcess.sd.toFixed(2)}  →  z=${z}, p≈${p}`
    );
    console.log(
      `  ${" ".repeat(13)} ${" ".repeat(6)} rotated chapters:  hits ${rs.mean.toFixed(1)}±${rs.sd.toFixed(1)} (max ${rs.max}, n=${rot.length})  →  p≈${rotP}`
    );
  }
  console.log("");
}

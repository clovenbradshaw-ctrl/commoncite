// Does any (statistic, perturbation) pair NOT already in LICENSED earn a
// place there against real turbulence — the same growth rule
// scripts/turbulence-growth-rule.mjs applied by hand to admit `phase`, run
// here over every combination nobody has tried yet.
//
// THIS IS THE SELF-EMERGENT HALF OF ORGAN CREATION, STATED PRECISELY SO IT IS
// NOT OVERCLAIMED. The candidate is proposed by enumerating nul's own
// STATISTICS x PERTURBATIONS against its own LICENSED registry — a person did
// not sit down and guess "let's try windowMean/phase." What is NOT
// self-emergent here, and must not become so without a wall being hit again:
// the material (goldens/turbulence, received from JHTDB — SEED.md #1), the
// statistics and perturbations themselves (all four and all three already
// exist in nul/index.js, none invented by this script), and the growth rule
// itself (SEED.md's, unchanged: `above` on a majority against the core, or it
// waits). This script automates the one step SEED.md's licensing left manual
// — WHICH untried pair to test next — and nothing else. It is a candidate
// COMPILER, not a candidate INVENTOR: it can only ever propose from a
// repertoire that already exists.
//
// Method identical to turbulence-growth-rule.mjs: own = candidate
// perturbation's ground, core = shuffle's ground (nul's baseline for every
// statistic already licensed here), level() asked which is above which,
// `above` on a majority of lines is the same admission test every hand-run
// growth-rule check in this repo already uses.
//
// A NEGATIVE CONTROL RUNS FIRST, STATED BEFORE THE REAL RESULT IS SEEN. Every
// candidate is run on 12 lines of IID noise, where nothing should clear
// `above` on a majority — the same discipline level()'s own docstring applies
// to itself (12 realisations of white noise, six adjacent scales, checking
// the growth rule doesn't ladder chance). A compiler whose verdicts are not
// trustworthy on noise cannot be trusted on turbulence either, and finding
// that out AFTER seeing the real numbers would be exactly the kind of
// self-serving check SEED.md #6 warns a bad perturbation makes possible: it
// fails invisibly and globally. If the control fails, this script halts
// before printing a single real-material result.

import { load, line } from "../packages/engine/perceiver/field/material.js";
import { ground, level, isGap, STATISTICS, PERTURBATIONS, LICENSED } from "../nul/index.js";

const FIELD = "goldens/turbulence/isotropic1024coarse-x-lines.npy";
const DRAWS = 200;
const RESEEDS = 12; // matches scripts/turbulence-cascade.mjs's reseeds; the resolution of pattern, declared, never defaulted
const WINDOWS = [
  [5, "sub-Taylor (dissipative)"],
  [19, "Taylor microscale"],
  [64, "inertial range"],
];

// The core every candidate is measured against. Not itself a candidate: a
// perturbation compared to itself is not a level question.
const CORE_PERTURBATION = "shuffle";

const candidates = [];
for (const statistic of Object.keys(STATISTICS)) {
  for (const perturbation of Object.keys(PERTURBATIONS)) {
    if (perturbation === CORE_PERTURBATION) continue;
    if (!Object.hasOwn(LICENSED, `${statistic}/${perturbation}`)) candidates.push({ statistic, perturbation });
  }
}

console.log(`unlicensed pairs proposed from the existing repertoire: ${candidates.length}`);
candidates.forEach((c) => console.log(`  ${c.statistic}/${c.perturbation}`));
console.log();

if (candidates.length === 0) {
  console.log("nothing to test: every (statistic, perturbation) pair is already in LICENSED.");
  process.exit(0);
}

// Deterministic, local — not `nul`'s rng, so a bug in the control's own
// generator cannot masquerade as agreement with the engine's.
const rngNoise = (seed) => {
  let a = (seed | 0) + 0x9e3779b9;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const noiseLine = (n, seed) => {
  const r = rngNoise(seed);
  return Array.from({ length: n }, () => r());
};

const runCandidate = (materials, statistic, perturbation, window) => {
  const results = [];
  for (const material of materials) {
    const observed = STATISTICS[statistic](material, { window });
    if (!Number.isFinite(observed)) {
      results.push({ rel: "unmeasurable" });
      continue;
    }
    const own = ground({ material, draws: DRAWS, window, statistic, perturbation, seed: 0 });
    const core = ground({ material, draws: DRAWS, window, statistic, perturbation: CORE_PERTURBATION, seed: 0 });
    if (isGap(own) || isGap(core)) {
      results.push({ rel: `gap:${isGap(own) ? own.gap : core.gap}` });
      continue;
    }
    // `level`'s own docstring: "THE THRESHOLD IS A RESOLUTION FLOOR, NOT A
    // NULL." Calling it without `material`/`reseeds` (as the first version of
    // this script did, and as scripts/turbulence-growth-rule.mjs still does)
    // falls back to `floor = 2/draws`, and the negative control below caught
    // exactly the failure the docstring already names: the rate of a false
    // level rises with draws, not with any real structure. Passing `material`
    // and `RESEEDS` gets the reseeding null the same clause was fixed to use
    // elsewhere in this codebase.
    const lv = level(observed, own, core, { material, reseeds: RESEEDS });
    results.push(isGap(lv) ? { rel: `gap:${lv.gap}` } : { rel: lv.relationship, disp: lv.displacement });
  }
  return results;
};

const summarize = (results) => {
  const counts = {};
  for (const r of results) counts[r.rel] = (counts[r.rel] ?? 0) + 1;
  const total = results.length;
  const above = counts.above ?? 0;
  return { counts, total, above, rate: total ? above / total : 0 };
};

console.log("── negative control: IID noise, 12 lines x 1024 points ────────────");
const noiseLines = Array.from({ length: 12 }, (_, i) => noiseLine(1024, 1000 + i));
let controlOK = true;
for (const [window] of WINDOWS) {
  for (const c of candidates) {
    const s = summarize(runCandidate(noiseLines, c.statistic, c.perturbation, window));
    if (s.rate > 0.5) {
      controlOK = false;
      console.log(`  FAIL  ${c.statistic}/${c.perturbation}@${window} manufactured 'above' on ${s.above}/${s.total} noise lines`);
    }
  }
}
console.log(
  controlOK
    ? "  no candidate manufactures a false 'above' on noise: proceeding to real material\n"
    : "  a candidate fabricates findings on pure noise — halting. This compiler is not trustworthy as built.\n",
);
if (!controlOK) process.exit(1);

// ---- the real run ----
const field = await load(FIELD);
const [nLines] = field.shape;
console.log(`material: ${FIELD}  shape ${field.shape.join("x")}  (${nLines} lines)\n`);

const materials = [];
for (let l = 0; l < nLines; l++) for (let c = 0; c < 3; c++) materials.push(line(field, { axis: 1, at: [l, c], component: c }));

const earned = [];
for (const c of candidates) {
  console.log(`── ${c.statistic}/${c.perturbation} ──────────────────────────────`);
  let anyAbove = false;
  for (const [window, name] of WINDOWS) {
    const results = runCandidate(materials, c.statistic, c.perturbation, window);
    const s = summarize(results);
    const disps = results.filter((r) => r.disp != null).map((r) => r.disp);
    const meanDisp = disps.length ? disps.reduce((a, b) => a + b, 0) / disps.length : null;
    const summary = Object.entries(s.counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join("  ");
    console.log(
      `  window ${window} (${name}): ${summary}${meanDisp != null ? `   mean displacement ${meanDisp >= 0 ? "+" : ""}${meanDisp.toFixed(3)}` : ""}`,
    );
    if (s.rate > 0.5) {
      anyAbove = true;
      earned.push({ ...c, window, name, rate: s.rate, meanDisp });
    }
  }
  console.log(anyAbove ? "  -> clears the growth rule on real turbulence\n" : "  -> does not clear on a majority at any tested window: it waits\n");
}

console.log("── verdict ─────────────────────────────────────────────────────");
if (earned.length) {
  earned.forEach((e) =>
    console.log(
      `  ${e.statistic}/${e.perturbation}@${e.window} (${e.name}): above on ${(e.rate * 100).toFixed(0)}% of lines, mean displacement ${e.meanDisp >= 0 ? "+" : ""}${e.meanDisp.toFixed(3)}`,
    ),
  );
} else {
  console.log("  no unlicensed pair clears the growth rule on this material. LICENSED stays as it is — refused, not early.");
}

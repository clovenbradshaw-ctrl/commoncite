// Does windowMean/phase's washed-out verdict resolve once lines are split by
// velocity component, instead of pooled?
//
// turbulence-chase-signal.mjs found the above/below split correlates with a
// skewness SIGN FLIP (-0.284 vs +0.24) and a component asymmetry (w-heavy
// below/peer, u/v-heavy unstable) — the textbook signature of longitudinal
// vs transverse derivative statistics in isotropic turbulence. `component` is
// already part of the material's provenance (the field perceiver requires it,
// never derives it — SEED.md Amendment III). This does not derive a new fact;
// it asks whether a fact already received and already carried on every line
// (which velocity component this is) explains the disagreement pooling hid.
//
// If the growth rule clears `above` (or `below`) on a majority WITHIN one
// component and not the other, the disagreement was two real, different
// findings averaged into a null, exactly SEED.md #6's point restated: "a bad
// perturbation fails invisibly and globally" — here the failure was pooling,
// not the perturbation.

import { load, line } from "../packages/engine/perceiver/field/material.js";
import { ground, level, isGap, STATISTICS } from "../nul/index.js";

const FIELD = "goldens/turbulence/isotropic1024coarse-x-lines.npy";
const DRAWS = 200;
const WINDOW = 5;
const RESEEDS = 12;
const STATISTIC = "windowMean";
const CANDIDATE = "phase";
const CORE = "shuffle";

const field = await load(FIELD);
const [nLines] = field.shape;

const groups = { longitudinal_w: [], transverse_uv: [] };
for (let l = 0; l < nLines; l++) {
  for (let c = 0; c < 3; c++) {
    const material = line(field, { axis: 1, at: [l, c], component: c });
    (c === 2 ? groups.longitudinal_w : groups.transverse_uv).push({ l, c, material });
  }
}

for (const [name, rows] of Object.entries(groups)) {
  console.log(`── ${name} (n=${rows.length}) ──`);
  const counts = {};
  const disps = [];
  for (const { material } of rows) {
    const observed = STATISTICS[STATISTIC](material, { window: WINDOW });
    const own = ground({ material, draws: DRAWS, window: WINDOW, statistic: STATISTIC, perturbation: CANDIDATE, seed: 0 });
    const core = ground({ material, draws: DRAWS, window: WINDOW, statistic: STATISTIC, perturbation: CORE, seed: 0 });
    if (isGap(own) || isGap(core)) { counts["gap:ground"] = (counts["gap:ground"] ?? 0) + 1; continue; }
    const lv = level(observed, own, core, { material, reseeds: RESEEDS });
    const key = isGap(lv) ? `gap:${lv.gap}` : lv.relationship;
    counts[key] = (counts[key] ?? 0) + 1;
    if (!isGap(lv)) disps.push(lv.displacement);
  }
  const total = rows.length;
  const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join("  ");
  const meanDisp = disps.length ? disps.reduce((a, b) => a + b, 0) / disps.length : null;
  console.log(`  ${summary}${meanDisp != null ? `   mean displacement ${meanDisp >= 0 ? "+" : ""}${meanDisp.toFixed(3)}` : ""}`);
  for (const [rel, n] of Object.entries(counts)) {
    if (n / total > 0.5) console.log(`  -> '${rel}' clears a majority within this group (${n}/${total})`);
  }
  console.log();
}

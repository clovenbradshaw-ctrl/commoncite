// eoreader6 · resolution-knob-cross — does the grain of a question decide
// which declared number governs its answer?
//
// THE CLAIM UNDER TEST (spec 13, "The stance face is the resolution face").
// SEED.md's three declared numbers are one per grain, not three knobs on one
// dial:
//
//   Ground   `window`    the reach of the present
//   Figure   `draws`     the resolution of testimony — difference() reports
//                        censoredAt = 1/draws
//   Pattern  `reseeds`   the resolution of pattern — pattern() reports
//                        censoredAt = 1/reseeds
//
// If that assignment is real and not a naming coincidence, it makes a
// directional prediction that can be wrong: turning the knob of the grain a
// question is ASKED AT should improve the answer, and turning the knob of any
// other grain should not — no matter how far it is turned.
//
// THE QUESTION USED. `level()` asks a Pattern-grain question (is one ground
// above, below, or peer to another — the growth rule's own admission test).
// Its threshold has two possible sources, one per grain:
//
//   floor      = 2/draws     the FIGURE knob — the finest rank difference two
//                            grounds can express at all
//   reseedNull = max |rank displacement| over `reseeds` reseeds of own's
//                            ground — the PATTERN knob
//
// `level()` uses max(floor, reseedNull), and when no reseeding null is
// supplied the floor stands alone. Its own docstring already records what
// that costs — false laddering RISING with draws, 3.08→4.42 of 5 across draws
// 60→600 — and names it: "THE THRESHOLD IS A RESOLUTION FLOOR, NOT A NULL,
// AND FOR A LONG TIME IT WAS ASKED TO BE BOTH." That measurement is recorded
// as prose in the docstring; the script that produced it is not in this
// repository, and no run in this repo sweeps BOTH knobs against each other.
// That cross is the only thing new here — no new statistic, no new
// perturbation, no new mechanism.
//
// PRE-REGISTERED, WRITTEN AND COMMITTED BEFORE THE NUMBERS WERE READ
// (13-the-resolution-face.md §5, and scripts/RESULTS.md):
//
//   P1  floor only: the false-ladder rate does not FALL as draws rises.
//   P2  with the reseeding null supplied: at fixed draws, the false-ladder
//       rate falls as reseeds rises.
//   P3  THE DISCRIMINATING ONE: with the reseeding null supplied, the false-
//       ladder rate is approximately FLAT in draws — operationally, its
//       spread across the four draws settings is smaller at every reseeds > 0
//       than it is at reseeds = none. The Figure knob stops governing a
//       Pattern verdict once the Pattern knob is doing the work.
//
// P3 is the one that can refuse the claim.
//
// ── THE FIRST CONTROL WAS REFUSED BY ITS OWN STATED DESIGN CHECK ───────────
// The first version of this script used level()'s own docstring's material:
// white noise coarsened by successive block-averaging, own = the finer scale,
// target = the next coarser one, ground truth "peer" everywhere. The script
// carried a pre-registered design check — a systematic direction in the
// above/below balance would mean coarsening induces a real level and would
// refuse the control rather than the claim. It fired, unambiguously: **0
// above / 528 below across every cell**, and the laddered rate sat at 100% in
// nearly every cell of the cross.
//
// The reason is a defect this repo has already written down at length, in
// pattern()'s own docstring: "burstiness is a max over windows, so its
// expectation rises with extent for no reason but extent." Block-averaging
// halves the extent at every step, so the coarser ground is built over half
// as many windows and sits systematically low; the finer material's
// observation lands below it every single time. The control was measuring
// the extent artefact, not a level. Recorded, not quietly dropped — a control
// that fails its own stated check is a result (SEED.md #8), and it is the
// reason the two controls below hold extent fixed by construction.
//
// ── THE TWO CONTROLS THAT REPLACED IT ──────────────────────────────────────
// Both hold extent, statistic, perturbation and window exactly fixed, so the
// only thing that could produce a level is the thing being tested for.
//
//   seed-only  own and target are grounds over the SAME material with the
//              SAME spec, differing only in perturbation seed. This is the
//              shape level() is actually used in (own = candidate's ground,
//              core = shuffle's ground, same material — see
//              scripts/turbulence-candidate-license.mjs) with the candidate
//              set equal to the core, so no level exists BY CONSTRUCTION.
//              The reseeding null is drawn from exactly this population,
//              which is what makes it the right null and the floor the wrong
//              one.
//
//   same-law   own and target are grounds over two INDEPENDENT white-noise
//              series of identical length. No level exists by exchangeability,
//              but the variation to be cleared is material-to-material, which
//              is wider than the seed-only variation the reseeding null
//              samples. Reported alongside, because whether the Pattern knob
//              covers material variation as well as seed variation is a real
//              open question and answering it by silence would be a choice.
//
// Deterministic, local RNG — not nul's, so a bug in the control's own
// generator cannot masquerade as agreement with the engine's. Same reason
// scripts/turbulence-candidate-license.mjs keeps its own.

import { ground, level, isGap, STATISTICS } from "../nul/index.js";

// ── declared, never defaulted ──────────────────────────────────────────────
const SPEC = {
  statistic: "burstiness",
  perturbation: "shuffle", // LICENSED: burstiness/shuffle
  window: 5, // the same sub-Taylor window scripts/turbulence-*.mjs declare
  extent: 256, // held identical across own and target in both controls
  trials: 96,
  seed0: 20260815,
  targetSeed: 1, // own's ground is seeded 0; reseeds land at r*draws, r>=1
};
const DRAWS_STEPS = [60, 120, 300, 600]; // level()'s own docstring table
const RESEEDS_STEPS = [null, 6, 12, 24, 48]; // null = floor only

const rngLocal = (seed) => {
  let a = (seed | 0) + 0x9e3779b9;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const noise = (n, seed) => {
  const r = rngLocal(seed);
  return Array.from({ length: n }, () => r());
};

// own material, target material, and the two ground seeds — per control.
const CONTROLS = {
  "seed-only": Array.from({ length: SPEC.trials }, (_, i) => {
    const m = noise(SPEC.extent, SPEC.seed0 + i * 7919);
    return { ownMaterial: m, targetMaterial: m, ownSeed: 0, targetSeed: SPEC.targetSeed };
  }),
  "same-law": Array.from({ length: SPEC.trials }, (_, i) => ({
    ownMaterial: noise(SPEC.extent, SPEC.seed0 + i * 7919),
    targetMaterial: noise(SPEC.extent, SPEC.seed0 + i * 7919 + 104729),
    ownSeed: 0,
    targetSeed: 0,
  })),
};

const stat = STATISTICS[SPEC.statistic];

// ── THE MECHANISM INSTRUMENTS, PRE-REGISTERED AFTER THE FIRST RUN ──────────
// The first full run refused P3 (see scripts/RESULTS.md): on the `same-law`
// control the false-ladder rate keeps rising with `draws` even with the
// reseeding null supplied — 36.3 → 47.7 → 66.3 → 73.4% at reseeds=48. P3 was
// the discriminating prediction and it failed; that is recorded as a refusal,
// not repaired.
//
// One diagnosis is available and it is POST HOC, so it is written down as a
// prediction with its own numbers rather than as a conclusion: `reseedNull`
// is measured in RANK units, and rank resolution is 1/draws — a Figure-grain
// quantity. If that is the route, then
//
//   M1  mean reseedNull FALLS as draws rises, at fixed reseeds
//   M2  mean |displacement| does NOT fall as draws rises
//
// and the Pattern-grain threshold is shrinking underneath a signal that is
// not, which is a grain leak in level() rather than anything about the
// material. If M1 fails, the diagnosis is wrong and P3's refusal stands
// undiagnosed. These two lines were added and committed before the numbers
// they report were read.
const runCell = (trials, draws, reseeds) => {
  const counts = { peer: 0, above: 0, below: 0, gap: 0 };
  const gaps = {};
  const meas = { displacement: [], reseedNull: [], threshold: [] };
  for (const t of trials) {
    const observed = stat(t.ownMaterial, { window: SPEC.window });
    if (!Number.isFinite(observed)) {
      counts.gap++;
      gaps.unmeasurable = (gaps.unmeasurable ?? 0) + 1;
      continue;
    }
    const common = { draws, window: SPEC.window, statistic: SPEC.statistic, perturbation: SPEC.perturbation };
    const own = ground({ material: t.ownMaterial, ...common, seed: t.ownSeed });
    const target = ground({ material: t.targetMaterial, ...common, seed: t.targetSeed });
    if (isGap(own) || isGap(target)) {
      counts.gap++;
      const g = isGap(own) ? own.gap : target.gap;
      gaps[g] = (gaps[g] ?? 0) + 1;
      continue;
    }
    const lv =
      reseeds === null
        ? level(observed, own, target)
        : level(observed, own, target, { material: t.ownMaterial, reseeds });
    if (isGap(lv)) {
      counts.gap++;
      gaps[lv.gap] = (gaps[lv.gap] ?? 0) + 1;
      continue;
    }
    counts[lv.relationship]++;
    meas.displacement.push(Math.abs(lv.displacement));
    if (lv.reseedNull !== null) meas.reseedNull.push(lv.reseedNull);
    meas.threshold.push(lv.threshold);
  }
  const placed = counts.peer + counts.above + counts.below;
  const laddered = counts.above + counts.below;
  const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
  return {
    ...counts,
    placed,
    laddered,
    rate: placed ? laddered / placed : null,
    gaps,
    meanDisplacement: mean(meas.displacement),
    meanReseedNull: mean(meas.reseedNull),
    meanThreshold: mean(meas.threshold),
  };
};

const spread = (rs) => {
  const ok = rs.filter((r) => r !== null && r !== undefined);
  return ok.length ? Math.max(...ok) - Math.min(...ok) : null;
};
const monotoneDown = (rs) => rs.every((r, i) => i === 0 || r === null || rs[i - 1] === null || r <= rs[i - 1] + 1e-12);
const pct = (r) => (r === null ? "  n/a" : (r * 100).toFixed(1).padStart(5));

console.log("── resolution-knob-cross ───────────────────────────────────────────");
console.log(`spec: ${JSON.stringify(SPEC)}`);
console.log("PRE-REGISTERED: P1 floor-only rate does not fall with draws · P2 rate falls with reseeds");
console.log("                P3 with a reseeding null, rate is flat in draws (spread < floor-only spread)");
console.log("The first control (coarsened scale ladder) was refused by its own design check:");
console.log("0 above / 528 below — block-averaging halves the extent and burstiness rises with extent.\n");

for (const [controlName, trials] of Object.entries(CONTROLS)) {
  console.log(`══ control: ${controlName} (${trials.length} trials, no level exists by construction) ══\n`);
  const table = new Map();
  for (const reseeds of RESEEDS_STEPS) {
    const label = reseeds === null ? "floor only" : `reseeds=${reseeds}`;
    const row = [];
    for (const draws of DRAWS_STEPS) {
      const cell = runCell(trials, draws, reseeds);
      row.push(cell);
      const gapNote = cell.gap ? `  gaps ${cell.gap} ${JSON.stringify(cell.gaps)}` : "";
      const num = (x) => (x === null ? "  n/a  " : x.toFixed(5));
      console.log(
        `${label.padEnd(12)} draws=${String(draws).padEnd(4)} laddered ${String(cell.laddered).padStart(3)}/${String(cell.placed).padEnd(3)} ` +
          `= ${pct(cell.rate)}%   [${cell.above}a/${cell.below}b]   floor=${(2 / draws).toFixed(4)} ` +
          `|disp|=${num(cell.meanDisplacement)} reseedNull=${num(cell.meanReseedNull)} thresh=${num(cell.meanThreshold)}${gapNote}`,
      );
    }
    table.set(label, row);
    console.log();
  }

  const rates = (label) => table.get(label).map((c) => c.rate);
  const floorRates = rates("floor only");
  const floorSpread = spread(floorRates);

  console.log(`── verdicts · ${controlName} ──`);
  console.log(
    `P1 floor-only rate does not FALL with draws: ${
      floorRates[floorRates.length - 1] >= floorRates[0] ? "HELD" : "REFUSED"
    }  (${floorRates.map((r) => (r === null ? "n/a" : (r * 100).toFixed(1))).join(" → ")})`,
  );
  for (let i = 0; i < DRAWS_STEPS.length; i++) {
    const col = RESEEDS_STEPS.filter((r) => r !== null).map((r) => table.get(`reseeds=${r}`)[i].rate);
    console.log(
      `P2 draws=${String(DRAWS_STEPS[i]).padEnd(4)} rate falls as reseeds rises: ${monotoneDown(col) ? "HELD" : "REFUSED"}  (${col
        .map((r) => (r === null ? "n/a" : (r * 100).toFixed(1)))
        .join(" → ")})`,
    );
  }
  for (const r of RESEEDS_STEPS.filter((x) => x !== null)) {
    const s = spread(rates(`reseeds=${r}`));
    console.log(
      `P3 reseeds=${String(r).padEnd(3)} spread across draws ${((s ?? 0) * 100).toFixed(1)}pp vs floor-only ${((floorSpread ?? 0) * 100).toFixed(1)}pp: ${
        s !== null && floorSpread !== null && s < floorSpread ? "HELD" : "REFUSED"
      }`,
    );
  }

  const monotoneUp = (rs) => rs.every((r, i) => i === 0 || r === null || rs[i - 1] === null || r >= rs[i - 1] - 1e-12);
  for (const r of RESEEDS_STEPS.filter((x) => x !== null)) {
    const nulls = table.get(`reseeds=${r}`).map((c) => c.meanReseedNull);
    console.log(
      `M1 reseeds=${String(r).padEnd(3)} mean reseedNull falls as draws rises: ${monotoneDown(nulls) ? "HELD" : "REFUSED"}  (${nulls
        .map((x) => (x === null ? "n/a" : x.toFixed(5)))
        .join(" → ")})`,
    );
  }
  {
    const disp = table.get("floor only").map((c) => c.meanDisplacement);
    console.log(
      `M2 mean |displacement| does not fall as draws rises: ${monotoneUp(disp) ? "HELD" : "REFUSED"}  (${disp
        .map((x) => (x === null ? "n/a" : x.toFixed(5)))
        .join(" → ")})`,
    );
  }

  const above = [...table.values()].flat().reduce((s, c) => s + c.above, 0);
  const below = [...table.values()].flat().reduce((s, c) => s + c.below, 0);
  console.log(
    `\ndesign check — direction balance across every cell: ${above} above / ${below} below. ` +
      `A systematic direction means the control itself carries a level and refuses the design, not the claim.\n`,
  );
}

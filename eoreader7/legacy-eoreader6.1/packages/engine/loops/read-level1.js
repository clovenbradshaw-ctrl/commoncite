// eoreader6 · loops/read-level1 — the level above loops/read-level0.js.
//
// scripts/read.mjs's runLevel1, promoted the same way runLevel0 was promoted
// to loops/read-level0.js: settled level-0 claims binned by density, and the
// SAME structure tests (holon_level's existenceDependencyTest +
// possibilityConstraintTest, via loops/level.js::levelStep) re-run on those
// bins. A level-1 regime spans many level-0 regimes by construction — the
// containment relation loops/self-holon.js needs to ever fire on real prose.
//
// THE ONE DEVIATION FROM runLevel1, and it is the whole point:
// runLevel1 builds ONE density ground over the WHOLE density array
// (`ground({ material: density, draws: 60, window: 3, seed: 5 })`) and uses
// it for every bin. On real prose that ground is degenerate — a real book
// settles one or two claims in two thousand chunks, the density array is
// almost all zeros, and shuffle-burstiness of a nearly-all-zero material is
// zero-width, so `ground` refuses (`degenerate_ground`) and significance is
// null for every bin. Measured across a 32-document live_priors sample
// (scripts/bake-level1-density-prior.mjs): 0 of 32 documents produce a
// level-1 structure-"above" candidate, and the density ground always gaps.
//
// This module replaces that whole-document ground with a SEEDED, SELF-
// ABSORBING DENSITY TIER (emergence/tiers.js + emergence/genre-seed.js,
// reused, not reinvented):
//
//   · SEEDED. Before the document's first bin, the tier receives a density
//     prior baked offline from live_priors (bin/priors/level1-density/en.json,
//     loaded by the host and passed in as `prior` — this module does no I/O):
//     what a per-bin settled-claim density looks like when a real book is
//     actually read. "No one starts reading in a vacuum" — the opening bins
//     are placed against other books' shape, not against a degenerate null.
//   · SELF-ABSORBING. Each observed bin decays the tier's prior by
//     `gammaFor(window)` (tiers.js derives it from `window`, nothing new) and
//     re-injects the bin's own density state. The genre seed fades exactly as
//     fast as the document stops re-confirming it — "we start a detective
//     novel and compare it to other detective novels, then slowly begin to
//     discover its own genre": within one reach of the present (window bins),
//     the tier's prior is the document's own, and the rest is judged against
//     that.
//   · PLACED AS IT STANDS. A bin's significance is the tier's own placement
//     (observe()'s rank, or censored ABOVE — surfeit, significance 1.0)
//     against the prior BEFORE that bin is folded in (tiers.js's own
//     witness gate: a movement placed against a prior that has already
//     absorbed it is measuring itself).
//
// STRUCTURE IS NOT TOUCHED: existenceDependencyTest still builds its null
// from the document's own density, and a sparse density still refuses it
// (SEED.md #3 — a null that failed to build clears anything, so the refusal
// is the result). The prior supplies SIGNIFICANCE only. On a single real
// book today, level-1 therefore settles nothing: structure "above" is
// unreachable on sparse density, honestly, by construction. This is the
// measured finding of the bake, not a gap to paper over.

import { createTier, observe } from "../emergence/tiers.js";
import { ground, difference, isGap, gap } from "../../../nul/index.js";
import { existenceDependencyTest, possibilityConstraintTest, holonLevelRelation } from "../../../holon_level/index.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// EVA · Pattern · Relating — a denser grain of the same read loops/read-
// level0.js already runs. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Pattern" });

// read.mjs's own level-1 literals, unchanged and exported — the same reason
// read-level0.js exports its own: a caller that RECHECKS a commit this organ
// produced (packages/host/reading.js) uses the identical grain and the
// identical structure-test parameters the original commit was judged under.
export const BIN_SIZE = 20;                       // level-1 grain: chunks per coarse bin
export const DENSITY_GROUND_OPTIONS = Object.freeze({ draws: 60, window: 3, seed: 5 });
export const STRUCTURE_OPTIONS = Object.freeze({ draws: 30, window: 2, reseeds: 8 });

// The density states a per-bin settled count is quantized to — the tier's
// vocabulary, the way OPERATORS is genre-seed.js's. A bin's density is its
// state; D4 is "4 or more". Derived from the baked prior's own keys, never
// invented here.
export const densityStateOf = (density, states) => {
  const n = Math.min(Math.floor(density), states.length - 1);
  return states[n];
};

// ── the genre-seed carrier, adapted to density states ────────────────────────
// seedTier (emergence/genre-seed.js) is written for operator centroids
// (OPERATORS, eight fixed forms). A density prior's forms are density states,
// so the seed is assembled here with the SAME shape and the SAME readiness
// gate genre-seed.js uses — maxDeviation/resample, licensed in nul's LICENSED
// map for exactly this question ("a single point sitting far from its
// neighbours"), candidate held out of its own material, leave-one-out — and
// handed to the tier as its first observation via the tier's own observe().
// Not a new statistic; a carrier change with the discipline intact.

const READINESS_SPEC = Object.freeze({ window: 2, draws: 200, seed: 20260810 });

const centroidOf = (prior) => {
  const states = Object.keys(prior.stateCentroid ?? {}).sort();
  if (states.length < 2) return null;
  const total = Object.values(prior.stateCounts ?? {}).reduce((s, v) => s + v, 0);
  if (!(total > 0)) return null;
  return { states, size: total };
};

/**
 * Fold a received density prior into a tier's cold start — the tier's FIRST
 * observation, and only ever its first (same contract as seedTier). Returns
 * { seeded, states, significance: null } on success, { seeded: false, gap }
 * when the prior is unready — a near-flat centroid has no dominant signal to
 * seed with, and planting noise wearing a giver's name is the exact refusal
 * genre-seed.js already makes.
 */
export const seedDensityTier = (tier, prior, { giver } = {}) => {
  if (!giver)
    throw new TypeError("seedDensityTier: a received prior must name its giver — an unnamed seed is indistinguishable from a fabrication");
  if (tier.observations !== 0)
    throw new TypeError("seedDensityTier: a tier already holding real observations cannot be seeded");

  const c = centroidOf(prior);
  if (!c)
    return { seeded: false, states: null, gap: gap("empty_material", { reason: "a density prior with no states or no measured bins seeds nothing" }) };

  const values = c.states.map((s) => prior.stateCentroid[s]);
  let topIndex = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[topIndex]) topIndex = i;
  const candidate = values[topIndex];
  const rest = values.filter((_, i) => i !== topIndex);

  const g = ground({ material: rest, ...READINESS_SPEC, statistic: "maxDeviation", perturbation: "resample" });
  if (isGap(g)) return { seeded: false, states: c.states, gap: g };
  const readiness = difference(candidate, g);
  const ready = isGap(readiness) && readiness.gap === "exceeds_witness" && readiness.direction === "above";
  if (!ready)
    return { seeded: false, states: c.states, gap: isGap(readiness) ? readiness : null };

  const arrival = new Map();
  for (const s of c.states) {
    const w = prior.stateCentroid[s];
    if (typeof w === "number" && w > 0) arrival.set(s, w * c.size);
  }
  observe(tier, arrival, { alpha: 1 });
  return { seeded: true, states: c.states, size: c.size };
};

/**
 * The level-1 read: settled level-0 claims binned by density (BIN_SIZE
 * chunks per bin), each occupied bin tested as a candidate regime by the
 * SAME structure tests levelStep runs, its significance placed against a
 * seeded, self-absorbing density tier (see the header) instead of a
 * whole-document ground.
 *
 * `prior` is a received Level1DensityPrior (host-loaded from
 * bin/priors/level1-density/en.json). Omit it and level-1 has no significance
 * ground: structure is still computed and reported (honestly, usually
 * "unstable" on sparse real density), significance stays null, and nothing
 * settles — the same outcome runLevel1 itself produces today.
 *
 * Returns runLevel1's own shape: { settledCount, bins, density, results },
 * where each result is the levelStep shape — { existence, structure,
 * significance, settled, regime } — so a caller (packages/host/reading.js)
 * folds `.filter(r => r.settled)` straight into the same settledResults it
 * already passes to admitSelf.
 */
export const readLevel1 = ({ level0Results, seriesLength, prior, structureOptions, giver } = {}) => {
  const settled = level0Results.filter((r) => r.settled);
  if (settled.length === 0) return { settledCount: 0, bins: 0, density: [], results: [] };

  const bins = Math.ceil(seriesLength / BIN_SIZE);
  const density = new Array(bins).fill(0);
  for (const r of settled) density[Math.floor(r.regime.start / BIN_SIZE)]++;

  const resolvedStructureOptions = structureOptions ?? STRUCTURE_OPTIONS;

  const states = prior?.stateCentroid ? Object.keys(prior.stateCentroid).sort() : null;
  let tier = null;
  let seeded = false;
  if (states && prior) {
    tier = createTier({ name: "level1-density", window: DENSITY_GROUND_OPTIONS.window, draws: DENSITY_GROUND_OPTIONS.draws, seed: DENSITY_GROUND_OPTIONS.seed });
    const s = seedDensityTier(tier, prior, { giver: giver ?? (prior.provenance?.source ?? "bin/priors/level1-density/en.json") });
    seeded = s.seeded;
    if (!seeded && s.states) {
      // An unready prior is a finding, not a silent no-significance: the tier
      // stays empty and every bin's significance is null, exactly as if no
      // prior had been supplied.
    }
  }

  const results = [];
  for (let b = 0; b < bins; b++) {
    if (density[b] === 0) {
      // The silent majority still advances the tier: the document's own genre
      // includes "mostly nothing settles here".
      if (tier && seeded) observe(tier, new Map([[densityStateOf(0, states), 1]]));
      continue;
    }

    let significance = null;
    if (tier && seeded) {
      const placed = observe(tier, new Map([[densityStateOf(density[b], states), 1]]));
      if (isGap(placed.gap)) significance = null;
      else if (placed.censored === "above") significance = 1.0;
      else if (placed.rank != null) significance = placed.rank;
      else significance = null;
    }

    const regime = { start: Math.max(0, b - 1), end: Math.min(bins, b + 2) };
    let structure = "unstable";
    if (regime.end - regime.start >= 2) {
      const ex = existenceDependencyTest(density, regime, resolvedStructureOptions);
      const co = possibilityConstraintTest(density, regime, resolvedStructureOptions);
      structure = holonLevelRelation(ex, co);
    }

    results.push({ existence: density[b], structure, significance, settled: structure === "above" && significance != null && significance >= 0.9, regime });
  }
  return { settledCount: settled.length, bins, density, results };
};

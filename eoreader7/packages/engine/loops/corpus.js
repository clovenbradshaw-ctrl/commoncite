// eoreader6 · loops/corpus — CON · Paradigm · Tracing: relating ONE reading's
// ground to a POOL of other readings', at Pattern grain, across documents.
//
// `loops/samanya.js` already builds two INDEPENDENT grounds and asks level()
// whether the relationship between them survives a different perturbation
// family. Nothing in it assumes the two materials come from the same
// document — it was just never pointed at two different books. Tested for
// real (goldens/corpus/), it failed instructively rather than usefully: raw
// forward-surprisal grounds from two real books (Buddenbrooks, Seitsemän
// veljestä) don't even OVERLAP in support (German ~10.7-11.2M microbits,
// Finnish ~11.8-12.0M), so every cross-book level() call returned
// `exceeds_witness` / `unstable`. That is not a bug: burstiness is a
// max-over-windows statistic, so its own null is TIGHT — good for detecting
// a boundary within one document, where it gives real power, but it means
// any natural between-book difference in absolute vocabulary scale is
// larger than the null's own spread, so raw-magnitude cross-book comparison
// is a structural non-starter regardless of language.
//
// THE FIX IS A DIMENSIONLESS STATISTIC, not a bigger null. `volume(ground) /
// median(ground.samples)` — the ground's own spread as a FRACTION of its own
// center — cancels the absolute scale a per-book frequency table imposes,
// the same way B3's chi-square-from-Benford cancelled ledger size. Verified
// on 5 real books: 0.0083, 0.0051, 0.0051, 0.0140, 0.0057 — real, comparable
// spread, not five copies of the same number.
//
// THE POOL IS A RECEIVED GROUND (nul::received), never derived from the book
// under test: N-1 OTHER books' own shape statistics, pooled and named. SEED.md
// #1 applies to a corpus exactly as it applies to a single prior — a pool is
// a gift too, and must name which books gave it.

import { ground, volume, received, difference, isGap, gap } from "../../../nul/index.js";

const median = (sorted) => sorted[Math.floor(sorted.length / 2)];

/** The one dimensionless, cross-document-comparable observable this organ uses. */
export const shapeStatistic = (material, { draws, window, seed = 0 } = {}) => {
  const g = ground({ material, draws, window, seed });
  if (isGap(g)) return g;
  const m = median(g.samples);
  if (!(m > 0)) return gap("degenerate_ground", { reason: "zero-or-negative median; a ratio to it is meaningless" });
  return { ratio: volume(g) / m, ground: g };
};

/**
 * Is THIS book's shape typical of the pool, or does it stand apart? The pool
 * is built by every OTHER contributor at the SAME spec (SEED.md #5 — two
 * grounds are comparable only if built to the same spec — enforced here by
 * construction, since every contributor shares draws/window). Leave-one-out:
 * the book under test never contributes to its own comparison population.
 */
export const corpusLevel = (materials, { draws, window, seed = 0 } = {}) => {
  const labels = Object.keys(materials);
  if (labels.length < 4) return gap("empty_material", { reason: "a pool of 3 or fewer gives a degenerate leave-one-out population" });

  const shapes = {};
  for (const label of labels) {
    const s = shapeStatistic(materials[label], { draws, window, seed });
    if (isGap(s)) return { gap: s, at: label };
    shapes[label] = s.ratio;
  }

  const results = {};
  for (const label of labels) {
    const pool = labels.filter((l) => l !== label).map((l) => shapes[l]);
    const g = received({ samples: pool, provenance: `corpus pool: ${labels.filter((l) => l !== label).join(", ")} (leave-one-out for ${label})` });
    if (isGap(g)) { results[label] = { gap: g }; continue; }
    const d = difference(shapes[label], g);
    results[label] = isGap(d)
      ? { ratio: shapes[label], censored: d.direction, poolRange: [g.samples[0], g.samples[g.samples.length - 1]] }
      : { ratio: shapes[label], rank: d.rank, poolRange: [g.samples[0], g.samples[g.samples.length - 1]] };
  }
  return { shapes, results };
};

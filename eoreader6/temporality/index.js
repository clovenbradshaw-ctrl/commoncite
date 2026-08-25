// eoreader6 · temporality — is this material's index load-bearing, and does
// it have a direction?
//
// The whole test is already in the core; what was missing is reading its
// answer as a fact about the MATERIAL rather than a fact about the
// instrument. `ground()` builds its null by shuffling. A statistic that
// survives shuffling unchanged was never measuring order. So: measure the
// real, unshuffled series against its own shuffle null, and where it lands
// IS the verdict.
//
//   order   permutationEntropy — shuffle-sensitive, reversal-blind
//   arrow   irreversibility    — shuffle-sensitive, reversal-sensitive
//
// Two statistics, one perturbation family, three outcomes:
//
//   order inside support                        EXCHANGEABLE  a bag, not a series
//   order censored below, arrow inside support  REVERSIBLE    memory, no arrow
//   order censored below, arrow censored above  ARROWED       irreversible
//
// The containment is real and enforced, not decorative: an arrow claim on
// material whose order was never established is the same error
// loops/grain.js refuses when witness is attempted without a pattern. If the
// index carries nothing, asking which way it points is not a harder
// question, it is a malformed one.
//
// No new declared number. `window` — the reach of the present — is the
// ordinal pattern length, which is the same claim it always was: how much
// material is contemporary with itself. `draws` is the resolution of
// testimony as before. The physiology is unchanged; see SEED.md, Amendment I,
// for what did change.
//
// What this CANNOT establish: that the index is time. Shuffling destroys any
// index structure, spatial or temporal or arbitrary. That the ordering is
// load-bearing is measured here; what the ordering DENOTES — wall-clock, a
// calendar, the year 1818 — is received from whoever handed the material in,
// and stays received.
//
// SEED.md Amendment V narrowed that refusal to the denotation only. Temporal
// FUNCTION — state inheritance, duration, recurrence, memory, anticipation,
// irreversibility — is measurable, by families of perturbation this organ does
// not yet carry. So the ladder below is the first two rungs of three:
//
//   ordered      the index is load-bearing         earned here
//   directional  A→B distinguishable from B→A      earned here
//   temporal     the direction functions AS time   NOT ASKED HERE
//
// `arrowed` is therefore not a temporal verdict and must not be read as one. A
// spatial scan can be arrowed. The third rung, when it is built, answers with
// `unresolved` as a first-class outcome and must keep presentation, event,
// causal, and measurement order apart rather than projecting them onto one
// axis. Each new family establishes its own sensitivity (Amendment I); none
// inherits the shuffle ground these two hold.

import { ground, difference, isGap, gap, STATISTICS } from "../nul/index.js";

export const TEMPORALITIES = Object.freeze(["exchangeable", "reversible", "arrowed"]);

/**
 * One statistic against its own shuffle null. Returns where the real series
 * landed, in the seed's own vocabulary: a rank if the ground can place it,
 * or a censoring direction if it cannot.
 */
const placeAgainstShuffles = (material, { statistic, draws, window, seed }) => {
  const g = ground({ material, draws, window, statistic, perturbation: "shuffle", seed });
  if (isGap(g)) return { gap: g };

  const observed = STATISTICS[statistic](material, { window });
  if (!Number.isFinite(observed))
    return { gap: gap("unknown_spec", { reason: "the statistic could not be formed at this window", statistic, window }) };

  const d = difference(observed, g);
  if (isGap(d) && d.gap === "exceeds_witness")
    return { observed, censored: d.direction, support: d.support, rank: null, censoredAt: d.censoredAt };
  if (isGap(d)) return { gap: d };
  return { observed, censored: null, support: d.support, rank: d.rank, volume: d.volume };
};

/**
 * The index is load-bearing iff the real series is MORE regular than its own
 * shuffles. One-sided by subadditivity, so "above" is not the other answer —
 * it is an anomaly, and gets surfaced rather than bucketed. A real series
 * more disordered than its own permutations means the material is not
 * stationary enough for the theorem that licenses this test, and that is
 * worth saying out loud.
 */
export const orderTest = (material, { draws, window, seed = 0 }) => {
  const placed = placeAgainstShuffles(material, { statistic: "permutationEntropy", draws, window, seed });
  if (placed.gap) return placed.gap;
  if (placed.censored === "above")
    return gap("unstable", {
      reason: "real material is less regular than its own shuffles — the one-sided assumption this test rests on does not hold here",
      observed: placed.observed,
      support: placed.support,
    });
  return Object.freeze({ ordered: placed.censored === "below", ...placed });
};

/**
 * The order has a direction iff the real series is MORE irreversible than its
 * own shuffles. Shuffling yields a uniform pattern distribution, which is its
 * own reversal image, so the null sits near zero and a real arrow reads as
 * surfeit — censored above.
 */
export const arrowTest = (material, { draws, window, seed = 0 }) => {
  const placed = placeAgainstShuffles(material, { statistic: "irreversibility", draws, window, seed });
  if (placed.gap) return placed.gap;
  return Object.freeze({ arrowed: placed.censored === "above", ...placed });
};

/**
 * The ladder. Arrow is only asked of material whose order was established —
 * containment, not efficiency.
 */
export const temporality = ({ material, draws, window, seed = 0 }) => {
  if (!Array.isArray(material) || material.length === 0) return gap("empty_material", {});
  if (!Number.isInteger(draws) || draws < 2)
    return gap("undeclared", { what: "draws", why: "the resolution of testimony is 1/draws and is never a default" });
  if (!Number.isInteger(window) || window < 2)
    return gap("undeclared", { what: "window", why: "the reach of the present is never derived from material length" });

  const order = orderTest(material, { draws, window, seed });
  if (isGap(order)) return order;

  if (!order.ordered)
    return Object.freeze({
      verdict: "exchangeable",
      order,
      arrow: null,
      why: "the real series is indistinguishable from its own shuffles: this index carries nothing",
    });

  const arrow = arrowTest(material, { draws, window, seed: seed + draws });
  if (isGap(arrow)) return arrow;

  return Object.freeze({
    verdict: arrow.arrowed ? "arrowed" : "reversible",
    order,
    arrow,
    why: arrow.arrowed
      ? "the real series is more irreversible than its own shuffles"
      : "the order is real but reversal-symmetric: memory without a direction",
  });
};

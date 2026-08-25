// eoreader6 · loops/surf-structural — a second witness, and their disagreement.
//
// `emergence/revision.js`'s SYN — whether an arrival merged two components
// the reader had kept apart — is real and measured, but nothing rides it.
// `loops/surf.js` surfs a belief-surprisal series; `emergence/revision.js`'s
// operator counts are never folded into a series at all, so the one place
// this codebase already knows how to tell "unusual" from "restructuring"
// apart (revision.test.js: "THE POINT: a rare arrival and a restructuring
// arrival are told apart") never reaches the surf.
//
// THE FIX IS NOT A FUSED SCALAR. Blending a graph-connectivity count into
// the existing Bayesian-surprise deposit needs an unstated combination
// weight between two different units — exactly the hand-picked extra knob
// `emergence/tiers.js` and `emergence/paradigm.js` both refuse ("NO PER-TIER
// NUMBERS. THE LADDER IS THE FOLD"). Instead: `loops/surf.js` is called
// TWICE, unmodified, once on each series, and the two rides are compared
// with `nul::disagreement` — already built for exactly this ("plural
// grounds for one figure are legal and their disagreement is the only
// self-check here... one perturbation calling something surfeit while
// another does not is the most informative signal this system can
// produce"). Disagreement is reported per position, not collapsed into one
// arrest decision — the disagreement IS the finding, not a gate on it.
//
// NO NEW CELL IS CLAIMED HERE. This module composes acts already on the
// roster (`loops/surf` EVA·Figure, `emergence/tiers` EVA·Figure, and
// `nul`'s own `disagreement`) rather than performing a new one; it is an
// orchestration, not an organ.
//
// Pure: no clock, no randomness, no I/O — every number a caller declares.

import { createGraph, readTriples } from "../emergence/graph.js";
import { snapshot, decompose, countsOf } from "../emergence/revision.js";
import { createTier, observe as observeTier } from "../emergence/tiers.js";
import { surf } from "./surf.js";
import { gap, isGap, disagreement } from "../../../nul/index.js";

/**
 * The structural series: one number per position that produced a
 * measurable operator arrival, built by reading `triples[i]` into a graph
 * one position at a time and folding `revision.js::decompose`'s 8-operator
 * count vector — the identical vocabulary `emergence/genre-seed.js` already
 * speaks — through a dedicated tier via its own `observe()`, unmodified.
 *
 * A position that added no triples, or whose first-ever fold has no prior
 * to differ from (`tiers.js`'s own `surprise: null` — "there is no prior to
 * differ from"), is SKIPPED, not padded with a placeholder: `loops/surf.js`
 * itself states the same discipline for its own ground — "not enough has
 * come into being yet: a gap, not a fake step." `keptIndices` names exactly
 * which original positions survived, so a caller's own series can be
 * aligned to the same positions rather than assumed to line up.
 */
export const structuralSeries = ({ triples, graphSpec, tier }) => {
  if (!Array.isArray(triples) || triples.length === 0)
    return gap("empty_material", { reason: "no positions to build a structural series from" });

  const g = createGraph(graphSpec);
  const series = [];
  const keptIndices = [];
  for (let i = 0; i < triples.length; i++) {
    const prior = snapshot(g);
    readTriples(g, triples[i]);
    const posterior = snapshot(g);
    const counts = countsOf(decompose(prior, posterior));
    const arrival = new Map(Object.entries(counts).filter(([, v]) => v > 0));
    if (arrival.size === 0) continue;
    const r = observeTier(tier, arrival);
    if (typeof r.surprise === "number") {
      series.push(r.surprise);
      keptIndices.push(i);
    }
  }
  if (series.length === 0)
    return gap("empty_material", { reason: "no position produced a measurable structural arrival" });
  return { series, keptIndices };
};

/**
 * Reconstruct a `difference()`-shaped value from one of `surf()`'s own
 * `horizon` entries. `surf()` does not expose the raw ground/difference
 * pair it computed internally, only the outcome already derived from one —
 * this is the same three-way collapse `surf.js` itself performs
 * (`outcome = !isGap(d) ? "met" : d.gap === "exceeds_witness" ? ... `), run
 * in reverse, so `nul::disagreement` — which expects an array of
 * `difference()` results or gaps — can be handed something faithful to what
 * each ride actually measured.
 *
 * A third shape is possible: `surf()` pushes `outcome: "gap"` (carrying the
 * real `difference()` gap as `.result`) when the arrival itself could not be
 * placed at all — a refusal unrelated to censoring. That real gap is
 * propagated as-is rather than folded into a fabricated `exceeds_witness`,
 * which would misreport an unrelated refusal as regularity or surfeit.
 */
const asDifferenceLike = (h) =>
  h.outcome === "met"
    ? { rank: h.rank }
    : h.outcome === "gap"
      ? h.result
      : gap("exceeds_witness", { direction: h.outcome === "broke" ? "above" : "below" });

/**
 * Ride the same positions twice — the caller's own belief-surprisal series,
 * and the structural series above — and report where the two rides
 * disagree.
 *
 * `primarySeries` must carry one entry per position in `triples`; it is
 * sliced down to `structuralSeries`'s own `keptIndices` internally, so both
 * rides see the same positions even though the structural series may have
 * skipped some. `surfSpec.window`/`.hop` govern both rides identically —
 * `loops/turn.js::clearField` depends only on material length, window and
 * hop, so equal-length, equal-window, equal-hop rides land their reach-unit
 * `at` positions on the same coordinates by construction, without either
 * ride needing to know about the other.
 */
export const surfStructural = ({ triples, primarySeries, graphSpec, tierSpec, surfSpec }) => {
  if (!Array.isArray(primarySeries) || !Array.isArray(triples) || primarySeries.length !== triples.length)
    return gap("incommensurate_extent", {
      reason: "the primary series must carry exactly one entry per position the structural series is built from",
      given: Array.isArray(primarySeries) ? primarySeries.length : null,
      positions: Array.isArray(triples) ? triples.length : null,
    });

  const tier = createTier({ name: "structural", ...tierSpec });
  const built = structuralSeries({ triples, graphSpec, tier });
  if (isGap(built)) return built;
  const { series: structural, keptIndices } = built;
  const primaryAligned = keptIndices.map((i) => primarySeries[i]);

  const primaryRide = surf({ material: primaryAligned, ...surfSpec });
  if (isGap(primaryRide)) return primaryRide;
  const structuralRide = surf({ material: structural, ...surfSpec });
  if (isGap(structuralRide)) return structuralRide;

  const structuralByAt = new Map(structuralRide.horizon.map((h) => [h.anticipated.at, h]));
  const compared = [];
  for (const h of primaryRide.horizon) {
    const at = h.anticipated.at;
    const s = structuralByAt.get(at);
    if (!s) continue; // the two rides can anticipate at different positions when either ground failed to build there
    compared.push(
      Object.freeze({
        at,
        primary: Object.freeze({ outcome: h.outcome, rank: h.rank }),
        structural: Object.freeze({ outcome: s.outcome, rank: s.rank }),
        disagreement: disagreement([asDifferenceLike(h), asDifferenceLike(s)]),
      }),
    );
  }

  return Object.freeze({ primaryRide, structuralRide, compared, tier });
};

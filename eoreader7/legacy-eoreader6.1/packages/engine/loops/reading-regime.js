// eoreader6 · loops/reading-regime — Assembly B of "11 — Terrain occupancy
// and the two ascents": wires emergence/activation.js's measured channels
// into loops/atmosphere.js's regime tracker, so an Atmosphere can be built
// from the reader's own accumulated recall instead of only the material's
// raw token statistics.
//
// Both halves already existed and had never been connected — this file is
// the seam, nothing else:
//
//   readForward(frames)                        -> { records, state }
//   seriesOf(records, channel, { missing })     -> number[]
//   createRegimeTracker({ window, draws, tolerance, seed, statistic,
//                         findOn, reseeds }).push(x)
//                                                -> { regimeStart, rezeroed,
//                                                     placement, aperture,
//                                                     finding }
//
// `channel` is declared, not defaulted: `recalled` is the current best
// measured channel (scripts/RESULTS.md: 22/24 Frankenstein chapter
// boundaries, p≈0.005 against a rotation null), not a law, and Assembly C
// depends on this function being callable per channel.
//
// NOT YET BUILT HERE, NAMED SO THE CITATION LANDS IN THE RIGHT FILE. Assembly
// C's "high tier sets the low tier's own hyperparameters and only the
// residual climbs back up, gated" (11-terrain-occupancy-and-the-two-ascents.md
// §5) is this codebase's nearest approach to two established lineages —
// variable-forgetting-factor RLS (Fortescue, Kershenbaum & Ydstie 1981) for
// the continuous re-dial from residual, and streaming drift detection (DDM,
// Gama, Medas, Castillo & Rodrigues 2004; ADWIN, Bifet & Gavaldà 2007) for the
// discrete gate. Cited here rather than claimed here: this file only wires a
// declared channel through to a single tracker (below), and Assembly C's own
// acceptance criteria (C4) already require the re-parameterization to be a
// discrete typed event, not a continuous adjustment — closer to a drift-gated
// re-dial than to either lineage read straight, and unmeasured until C is
// built.
//
// ONE CHANNEL, ONE TRACKER — never summed. Feeding a blend of `recalled` and
// `activation` into one tracker reproduces a failure shape this project has
// refuted three times already (lemma abstraction, null-witnessed slot
// abstraction, the ungated lone gift): a coarse signal given a voting role
// drowns better evidence in proportion to its own coarseness.
//
// THE MISSING-VALUE DISCIPLINE. `push` consumes finite numbers only and
// throws otherwise (atmosphere.js's own guard). `seriesOf` requires
// `missing` to be declared, never defaulted (I3: a gap is not a zero). This
// function's own signature has no `missing` parameter to expose, because
// there is no honest per-caller answer to "what does an unanswered frame
// mean to a regime tracker" — a regime tracker has no notion of a gap in
// its input series at all. So `missing` is fixed here to NaN: a value
// `push` itself immediately, loudly rejects. For `recalled` specifically
// this is provably inert (activation.size is a Set size, never null), so
// the sentinel is never reached; for a channel that CAN carry a null
// (`reach`), reaching it is a genuine finding about that channel's fitness
// for this seam, not a value for this file to invent.
//
// NOT THE CHAPTER-BOUNDARY ROTATION NULL. scripts/RESULTS.md already
// records that rotation loses power as boundary count rises (`recalled`
// emits 23 against 24 true boundaries and saturates on the wide window,
// p≈0.064 there). createRegimeTracker's own slack-run null — sampled every
// `window` pushes, calibrated at that stride rather than every push
// (atmosphere.js's own measured false-alarm difference: 55-90% at stride 1
// versus 0-3% at stride `window`) — is the device this file defers to,
// simply by passing `findOn` through to createRegimeTracker unchanged.

import { gap, isGap } from "../../../nul/index.js";
import { readForward, seriesOf } from "../emergence/activation.js";
import { createRegimeTracker, stationarityGap } from "./atmosphere.js";

export const CELL = Object.freeze({ op: "EVA", grain: "Figure" });

// A value push() rejects on sight (TypeError, not a silent skip) — see the
// header's "missing-value discipline" note.
const UNREACHABLE = NaN;

export const readingRegime = (frames, { channel, window, draws, tolerance, reseeds, seed, statistic, findOn } = {}) => {
  if (typeof channel !== "string" || !channel)
    throw new TypeError("readingRegime: channel is declared — which measured quantity feeds the tracker is never a default");

  // readForward is itself strictly causal (frame i's recall reads only
  // frames < i); createRegimeTracker consumes its series strictly in push
  // order with no lookahead. Composing two causal primitives in read order
  // is causal — this is I1, not asserted but structural.
  const { records: frameRecords } = readForward(frames);
  const series = seriesOf(frameRecords, channel, { missing: UNREACHABLE });

  // THE GATE THIS SEAM EXISTS TO ENFORCE. A ground is a nothing rebuilt by
  // perturbation; over a trending series it is a lagging estimate of a slope
  // instead, and every re-zero after that is arithmetic on the minimum ground
  // size rather than a reading of the material. `recalled` on real prose is
  // exactly that case (see stationarityGap's own header for the measured
  // numbers), so this refuses rather than silently metronoming. A typed gap,
  // never a correction: what to do about a trending channel — difference it,
  // rate-normalise it, pick another — is the caller's declaration, not this
  // function's to make on their behalf.
  const trend = stationarityGap(series, { reseeds, seed });
  if (isGap(trend)) {
    return {
      records: [],
      regimes: [],
      gaps: [trend],
      refused: trend,
    };
  }

  const tracker = createRegimeTracker({ window, draws, tolerance, reseeds, seed, statistic, findOn });

  const records = [];
  for (let i = 0; i < series.length; i++) {
    const pushed = tracker.push(series[i]);
    records.push({
      order: frameRecords[i].order,
      offset: frameRecords[i].offset,
      value: series[i],
      ...pushed,
    });
  }

  // Regimes: the spans between re-zero events, discovered from the push
  // sequence exactly as readAtmosphere's own `regions` are — never a
  // stratum, never a frame, never a floor. One more region than rezeros:
  // the still-open final stretch closes nothing.
  const regimes = [];
  let start = 0;
  for (const r of records) {
    if (r.rezeroed) {
      regimes.push({ start, end: r.order, rezeroed: true });
      start = r.regimeStart;
    }
  }
  if (records.length) regimes.push({ start, end: records[records.length - 1].order, rezeroed: false });

  const gaps = records.filter((r) => isGap(r.placement));

  return { records, regimes, gaps };
};

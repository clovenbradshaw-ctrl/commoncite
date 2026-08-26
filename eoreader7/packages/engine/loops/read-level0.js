// eoreader6 · loops/read-level0 — scripts/read.mjs's own level-0 loop,
// promoted from inline script logic to a callable organ. Unmodified in
// mechanism: blind recurrence detection (Pythagoras: existence) over a
// causal-surprisal series, each occurrence's regime tested by levelStep
// (Plato: structure, Ramakrishna: significance) against a reader-relative
// ground built from everything that came before that occurrence — the same
// three calls read.mjs's own runLevel0 already made, read verbatim out of a
// script and given a name the growth rule can test.
//
// "Unwired is failing" (SEED.md, the growth rule) is why this exists as its
// own file rather than staying inline: nothing in this repo could import
// read.mjs's level-0 loop, so nothing but that one script could ever call it
// — an organ nothing depends on is not early, it is refused. This is that
// refusal answered, not a new mechanism: every number below is read.mjs's
// own literal, carried over unchanged and named so a caller can see and
// override it, the same standing host/graph.js's DEFAULT_GAMMA already
// holds ("an engineering starting point, not yet validated against a
// golden") — not silently smuggled in, not re-derived either.

import { findRecurringMotifs } from "../referents/blind.js";
import { ground, isGap } from "../../../nul/index.js";
import { levelStep } from "./level.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// EVA · Pattern · Relating — one series, walked for every candidate regime a
// blind motif detector proposes. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Pattern" });

// read.mjs's own literals, unchanged — exported so a caller that also needs
// to RECHECK a commit this organ produced (packages/host/reading.js, into
// loops/self.js's recheckTestimony) uses the identical reader-ground and
// structure-test parameters the original commit's own significance was
// judged under, by construction, rather than by two copies of the same
// numbers that could drift apart.
export const WINDOW_SIZE = 6;
export const READER_WINDOW = 8;
export const READER_DRAWS = 150;
export const READER_SEED = 11;
export const MOTIF_OPTIONS = Object.freeze({ windowSize: 6, hop: 1, similarityThreshold: 0.2, minOccurrences: 4 });
export const STRUCTURE_OPTIONS = Object.freeze({ draws: 40, window: 4, reseeds: 10 });
export const READER_OPTIONS = Object.freeze({ draws: READER_DRAWS, window: READER_WINDOW, seed: READER_SEED });

/**
 * The level-0 read: every occurrence of every blindly-detected motif in
 * `series`, tested as a candidate regime. Returns `{ motifsFound, results }`
 * where `results` is an array of loops/level.js's own levelStep output — the
 * exact shape packages/host/self.js's admitSelf already expects as
 * `settledResults` (a caller filters to `.settled` itself, or passes them
 * through unfiltered — classifyFresh only ever promotes the settled ones).
 */
export const readLevel0 = (series, options = {}) => {
  const motifOptions = { ...MOTIF_OPTIONS, ...options.motifOptions };
  const readerWindow = options.readerWindow ?? READER_WINDOW;
  const readerDraws = options.readerDraws ?? READER_DRAWS;
  const readerSeed = options.readerSeed ?? READER_SEED;
  const regimeWindow = options.regimeWindow ?? WINDOW_SIZE;
  const structureOptions = { ...STRUCTURE_OPTIONS, ...options.structureOptions };

  const motifResult = findRecurringMotifs(series, motifOptions);
  const results = [];

  for (const motif of motifResult.motifs) {
    for (const occ of motif.occurrences) {
      // Pythagoras: no claim before enough has come into being to compare
      // against — read.mjs's own gate, unchanged.
      if (occ < readerWindow + 2) continue;
      const history = series.slice(0, occ);
      const readerGround = ground({ material: history, draws: readerDraws, window: readerWindow, seed: readerSeed });
      if (isGap(readerGround)) continue;

      const regime = { start: occ, end: Math.min(series.length, occ + regimeWindow) };
      if (regime.end - regime.start < 2) continue;

      const step = levelStep({ series, regime, readerGround, existenceCount: motif.count, structureOptions });
      results.push(step);
    }
  }
  return { motifsFound: motifResult.motifs.length, results };
};

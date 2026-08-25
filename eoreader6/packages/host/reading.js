// eoreader6 · packages/host/reading — the organ packages/host/self.js's own
// header names as missing: text in, this admission's engine-tier testimony
// (SELF/SELF_MISMATCH/WORLD) out. Nothing here is a new mechanism —
// tokenize/chunkWords/causalSurprisalSeries build the same causal-surprisal
// series read.mjs always built (word chunks of CHUNK_WORDS, unchanged);
// loops/read-level0.js is that script's own level-0 loop, promoted;
// admitSelf is host/self.js's already-built session wiring. This file is
// the caller none of the three ever had.
//
// The reader-ground and structure-test parameters used for the level-0 read
// and the ones handed to admitSelf's recheck are the SAME objects
// (loops/read-level0.js's own exported READER_OPTIONS/STRUCTURE_OPTIONS),
// not two copies of the same numbers — a recheck judging significance under
// different parameters than the original commit used would be answering a
// different question, not rechecking the same one.

import { canonicalHashSync } from "../spec/canonical-json/index.js";
import { tokenize, chunkWords, causalSurprisalSeries } from "../engine/perceiver/text/material.js";
import { readLevel0, STRUCTURE_OPTIONS, READER_OPTIONS } from "../engine/loops/read-level0.js";
import { admitSelf } from "./self.js";

// The cell this host organ occupies on the operator grid (engine/operators.js):
// EVA · Pattern · Relating — the same cell loops/read-level0.js declares;
// admitReading is that organ's host-tier caller, chained into host/self.js's
// own admission. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Pattern" });

// read.mjs's own chunk size, unchanged.
const CHUNK_WORDS = 40;

/**
 * Read `text` all the way through: causal-surprisal series, level-0 motif
 * detection and structure/significance testing, then into the session's
 * testimony ledger via admitSelf. `sourceId` should be the same id a caller
 * also passes to admitChunked for this same document, so a session's belief
 * graph (host/graph.js) and its testimony ledger (host/self.js) are talking
 * about the same source under the same name — this module does not enforce
 * that; a caller keeping two different names for one document is its own
 * bug, the same standing every other host organ's `sourceId` already has.
 */
export function admitReading(session, { sourceId, text, level0Options, structureOptions, readerOptions } = {}) {
  if (!sourceId || !text) throw new TypeError("admitReading: sourceId and text are declared, never defaulted");

  const admissionHash = canonicalHashSync({ sourceId, text });
  const words = tokenize(text);
  const chunks = chunkWords(words, CHUNK_WORDS);
  const series = causalSurprisalSeries(chunks);

  const resolvedStructureOptions = structureOptions ?? STRUCTURE_OPTIONS;
  const resolvedReaderOptions = readerOptions ?? READER_OPTIONS;

  const level0 = readLevel0(series, {
    ...level0Options,
    structureOptions: resolvedStructureOptions,
    readerWindow: resolvedReaderOptions.window,
    readerDraws: resolvedReaderOptions.draws,
    readerSeed: resolvedReaderOptions.seed,
  });
  const settledResults = level0.results.filter((r) => r.settled);

  const admitted = admitSelf(session, {
    sourceId,
    admissionHash,
    series,
    settledResults,
    structureOptions: resolvedStructureOptions,
    readerOptions: resolvedReaderOptions,
  });

  return {
    admissionHash,
    chunkCount: chunks.length,
    motifsFound: level0.motifsFound,
    settledCount: settledResults.length,
    ...admitted,
  };
}

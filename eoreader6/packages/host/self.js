// eoreader6 · packages/host/self — the host face of the engine's own
// testimony (packages/engine/loops/self.js).
//
// Wires the same way host/graph.js wires emergence/graph.js: a session
// carries one ledger across every admission, and a later admission's
// material moves belief the earlier one already committed — here, the
// belief being moved is the engine's OWN prior claims, not a document's.
//
// `series` (the causal-surprisal series a source is read through) and
// `settledResults` (loops/level.js's own level-0 settled results over that
// series) are REQUIRED inputs to admitSelf, not derived here — this module
// is bookkeeping (recheck + commit) only, never the reading pipeline itself.
// packages/host/reading.js's admitReading is the actual caller: it builds
// both from raw text (loops/read-level0.js, promoted from scripts/read.mjs)
// and calls admitSelf below with them. A caller without that pipeline
// available, or a different one of its own, hands admitSelf the same two
// things directly — nothing here assumes reading.js is the only way in.

import {
  createTestimonyLedger,
  commitTestimony,
  recheckTestimony,
  classifyFresh,
  commitsFor,
  SELF,
  SELF_MISMATCH,
  WORLD,
} from "../engine/loops/self.js";
import { deriveTestimonyLevels, cascadingMismatch } from "../engine/loops/self-holon.js";

export { SELF, SELF_MISMATCH, WORLD };

// The cell this host organ occupies on the operator grid (engine/operators.js):
// EVA · Figure · Relating — the same cell packages/engine/loops/self.js
// declares; admitSelf is that organ's host-tier caller. Declared, checked by
// conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Figure" });

export function attachSelf(session) {
  if (!session.self) session.self = createTestimonyLedger();
  return session.self;
}

/**
 * Read one admission's already-settled level-0 results into the session's
 * testimony ledger. Three things happen, in order:
 *
 *   1. RECHECK — every LIVE prior commitment for `sourceId` (one per regime
 *      start already in the ledger) is re-tested against `series`, exactly
 *      as loops/self.js's recheckTestimony does it. The ledger is never
 *      rewritten by this step: a commit is asked the same question again,
 *      not replaced by the answer.
 *   2. COMMIT — of THIS admission's own `settledResults`, the ones whose
 *      regime start is not already in the ledger for this source are new
 *      testimony (WORLD) and are written in.
 *   3. CASCADE — of every commit that just mismatched, which OTHER live
 *      commits for this source are wholes containing it (loops/self-holon.js).
 *      Those wholes are not re-verdicted — only recheckTestimony may change a
 *      tag — they are reported, so a caller can see that a claim resting on
 *      ground that just moved was never itself re-examined this admission,
 *      not just that some smaller, unrelated-looking regime failed.
 *
 * Idempotent per call is not claimed, the same standing host/graph.js's
 * admitGraph already carries: a caller that must not re-admit an unchanged
 * source tracks that itself (admitChunked's own admissionHash dedup, one
 * layer down, already refuses a byte-identical re-admission before this is
 * ever reached).
 */
export function admitSelf(session, { sourceId, admissionHash, series, settledResults = [], structureOptions, readerOptions } = {}) {
  if (!sourceId || !admissionHash)
    throw new TypeError("admitSelf: sourceId and admissionHash are declared, never defaulted");
  const ledger = attachSelf(session);
  const rechecks = recheckTestimony(ledger, { series, sourceId, admissionHash, structureOptions, readerOptions });
  const classified = classifyFresh(ledger, sourceId, settledResults);

  const committed = [];
  for (const { result, tag } of classified) {
    if (tag === WORLD) committed.push(commitTestimony(ledger, result, { sourceId, admissionHash, seriesExtent: series.length }));
  }

  const mismatched = rechecks.filter((r) => r.tag === SELF_MISMATCH).map((r) => r.commit);
  const cascaded = cascadingMismatch(commitsFor(ledger, sourceId), mismatched);

  return {
    ledger,
    self: rechecks.filter((r) => r.tag === SELF),
    selfMismatch: rechecks.filter((r) => r.tag === SELF_MISMATCH),
    world: committed,
    cascaded,
  };
}

/** A plain-data view of the current testimony ledger, for a caller that must not hold a live reference (serialization, a UI list, a background-model prompt). */
export function sessionSelfSnapshot(session, { limit = 25 } = {}) {
  const ledger = session.self;
  if (!ledger) return { commits: [], commitCount: 0 };
  return {
    commits: ledger.commits.slice(-limit).map((c) => ({ ...c })),
    commitCount: ledger.commits.length,
  };
}

/**
 * The holarchy over one source's own live testimony — which claims are
 * wholes containing which others as parts, each commit's depth, and any
 * containment cycle (see loops/self-holon.js's own header for what
 * "declared, not measured" means here). A plain-data view: commits inside
 * `levels`/`relations`/`cycles` are the same frozen ledger entries
 * sessionSelfSnapshot already serves, not a second copy.
 */
export function sessionTestimonyHolarchy(session, { sourceId } = {}) {
  if (!sourceId) throw new TypeError("sessionTestimonyHolarchy: sourceId is declared, never defaulted");
  const ledger = session.self;
  if (!ledger) return { levels: [], relations: [], cycles: [] };
  return deriveTestimonyLevels(commitsFor(ledger, sourceId));
}

// eoreader6 · loops/self — the engine's own testimony, re-encountered.
//
// promote() (loops/level.js) already commits something real: a settled claim
// — existence-dependency and possibility-constraint both cleared against their
// own Born-null, significance >= SETTLED_RANK. That commitment currently goes
// nowhere; nothing ever asks it again. This organ gives it somewhere to go: a
// ledger of committed claims, and a RECHECK — the SAME two holon_level tests,
// run again over the SAME regime bounds against whatever material now
// occupies them — compared to what was committed.
//
// NO NEW STATISTIC. existenceDependencyTest and possibilityConstraintTest are
// already Born-null-gated (holon_level/index.js) and already earned (SEED.md:
// "level — built, in nul, and load-bearing for the growth rule"). What is new
// here is bookkeeping (the ledger) and a comparison (then vs. now), not a
// third structural test — levelStep is called exactly as loops/level.js
// already calls it, twice, and this module reads its own `.settled` flag both
// times rather than re-deriving the threshold. A wiring module does not need
// to re-earn a statistic that already cleared its own null.
//
// eoreader4.2's own vocabulary (enactor/monitor.js) applied to testimony
// rather than conversation — the closed loop there was commit an output,
// predict its return, sense whether it came back unchanged. eoreader6 has no
// output-authoring organ (packages/engine/prediction/RESULTS.md names this
// gap explicitly), but promote()'s DEF.admit event is a real commit on its
// own material, and a later admission of the same source is a real return to
// sense. That pairing is the actual loop this organ closes:
//
//   SELF            re-tested at the same regime, against new material —
//                   still settled. The engine reconfirming its own prior
//                   claim. Attenuated: no news.
//   SELF_MISMATCH   re-tested at the same regime — no longer settled (the
//                   structure test failed, the significance rank dropped
//                   below threshold, or the regime no longer fits inside the
//                   new material at all — holon_level's own checkArgs gaps
//                   that case, which is read as unsettled here, not thrown).
//                   The engine's own prior testimony no longer holds. News:
//                   an actual, ledgered correction.
//   WORLD           a settled claim from THIS admission whose regime overlaps
//                   no prior commit for this source. Ordinary news, exactly
//                   what promote() already reports — classified here only so
//                   a caller can tell it apart from a recheck outcome.
//
// SCOPE, NAMED: overlap and "the same regime across admissions" are decided
// by sourceId + the regime's own start index. That is exactly right for
// admitChunked's actual growth model (a document's later admission APPENDS
// text; earlier byte/chunk offsets never move) and is not claimed to be right
// for an admission that edits or reorders earlier material — an edited regime
// is read as a mismatch against the old claim (the safe direction to be
// wrong in: a real edit SHOULD look like the ground moved), never silently
// matched against the wrong content.
//
// EXTENT-MATCHED RECHECK, measured into this shape rather than assumed
// (conformance/loops-self.test.js): existenceDependencyTest measures over the
// WHOLE series, not just the regime, and ground()'s own header already warns
// two grounds over different extents are not comparable unless the null
// grows the same way. Rechecking a regime against a series that has simply
// grown TAIL material far away from it is exactly that uncontrolled
// comparison, and it is not hypothetical: measured directly on this file's
// own toy fixture, appending 5 unrelated elements after an untouched burst
// regime reconfirmed it; appending 10 already read the same, untouched
// regime as unstable. So a commit records the EXTENT of the series it was
// measured over (`seriesExtent`), and a recheck truncates whatever series it
// is handed back to that same extent before testing — reconstructing the
// original comparison exactly when growth is pure append (the documented
// scope above), rather than a longer, uncontrolled one. The declared
// trade-off: material appended AFTER a commit's original extent can never by
// itself move that commit's own verdict, only material inside the commit's
// original span can (a real edit there still truncates in and is still
// caught). New evidence arriving later that would genuinely recontextualize
// an earlier claim is out of reach of this recheck — a real limitation, kept
// rather than hidden, not the one first measured here.

import { levelStep } from "./level.js";
import { ground, isGap } from "../../../nul/index.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// EVA · Figure · Relating — one committed claim, evaluated against fresh
// material. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Figure" });

export const SELF = "self";
export const SELF_MISMATCH = "self-mismatch";
export const WORLD = "world";

export const createTestimonyLedger = () => ({ commits: [] });

/**
 * Write a settled result into the ledger as this engine's own testimony.
 * Refuses anything not already settled — the same discipline promote() (which
 * every commit here is expected to have already passed through) enforces on
 * itself; this is not a second, looser gate.
 */
export const commitTestimony = (ledger, settledResult, { sourceId, admissionHash, seriesExtent }) => {
  if (!settledResult.settled)
    throw new Error("commitTestimony: called on a result that was never settled — nothing to testify");
  if (!sourceId || !admissionHash)
    throw new TypeError("commitTestimony: sourceId and admissionHash are declared, never defaulted — testimony with no named source or admission is not attributable to either");
  if (!Number.isInteger(seriesExtent) || seriesExtent < settledResult.regime.end)
    throw new TypeError("commitTestimony: seriesExtent is declared, never defaulted — a recheck cannot reconstruct the extent this claim was measured over without it, and it must at least cover the regime itself");
  const entry = Object.freeze({
    sourceId,
    admissionHash,
    regime: settledResult.regime,
    structure: settledResult.structure,
    significance: settledResult.significance,
    seriesExtent,
    committedAt: ledger.commits.length,
  });
  ledger.commits.push(entry);
  return entry;
};

/**
 * Every live commit for one source, regardless of which admission wrote it —
 * the set loops/self-holon.js's deriveTestimonyLevels/cascadingMismatch walk
 * to find containment relations among a source's own testimony. Exported
 * because that holarchy is a second, separate READ of the same ledger this
 * file owns writing to; self-holon.js does not reach into `ledger.commits`
 * directly.
 */
export const commitsFor = (ledger, sourceId) => ledger.commits.filter((c) => c.sourceId === sourceId);

/**
 * The prior commits this admission's regimes could even be compared against:
 * one per (sourceId, regime.start), the LATEST commit at that start — a
 * ledger that has already rechecked a claim twice carries three entries for
 * it (original + two rechecks); only the newest is live testimony to compare
 * a third admission against.
 */
const latestPriorCommits = (ledger, sourceId, admissionHash) => {
  const bySource = ledger.commits.filter((c) => c.sourceId === sourceId && c.admissionHash !== admissionHash);
  const latest = new Map();
  for (const c of bySource) {
    const key = c.regime.start;
    const cur = latest.get(key);
    if (!cur || c.committedAt > cur.committedAt) latest.set(key, c);
  }
  return [...latest.values()];
};

/**
 * Re-run every live prior commitment for `sourceId` at its OWN original
 * regime bounds, against the CURRENT series — never against the material the
 * commit was originally read from, which recheckTestimony does not hold onto
 * (identity by consequence, not by cached appearance: what matters is what
 * the regime measures as NOW).
 *
 * The reader-ground significance is judged against is built HERE, per commit,
 * from that commit's own `regime.start` — never a single ground shared across
 * every commit this call rechecks. loops/read-level0.js's own level-0 loop
 * builds a reader ground the same way, per motif occurrence, from
 * `series.slice(0, occ)`: "everything that came before THIS claim's own
 * position." A recheck asks the identical question of the identical
 * position, so it has to build its ground the identical way — a shared
 * ground would judge every commit's significance against one arbitrary
 * reader-position instead of each commit's own. `readerOptions` (`draws`,
 * `window`, `seed`) and `structureOptions` are the same declared,
 * never-defaulted parameters levelStep and ground() already require.
 */
export const recheckTestimony = (ledger, { series, sourceId, admissionHash, structureOptions, readerOptions }) => {
  const prior = latestPriorCommits(ledger, sourceId, admissionHash);
  return prior.map((commit) => {
    // Extent-matched: reconstruct the series at the extent this commit was
    // ORIGINALLY measured over, never a longer one grown by unrelated tail
    // material since. slice's own clamping already does the right thing if
    // the new series is SHORTER than that extent (a real shrink truncates
    // further still, and holon_level's own checkArgs gaps a regime that no
    // longer fits — read as unsettled below, not thrown).
    const bounded = series.slice(0, commit.seriesExtent);
    const history = bounded.slice(0, commit.regime.start);
    const readerGround = history.length
      ? ground({ material: history, draws: readerOptions.draws, window: readerOptions.window, seed: readerOptions.seed })
      : null;
    // No history to build a reader ground from, or the ground itself gapped
    // (too little material, degenerate) — significance cannot be judged, so
    // the claim cannot be reconfirmed. Read as unsettled, same as any other
    // way a recheck can fail to place its claim: news, not a throw.
    if (!readerGround || isGap(readerGround)) {
      return Object.freeze({ commit, tag: SELF_MISMATCH, recheck: null });
    }
    const step = levelStep({ series: bounded, regime: commit.regime, readerGround, existenceCount: null, structureOptions });
    return Object.freeze({ commit, tag: step.settled ? SELF : SELF_MISMATCH, recheck: step });
  });
};

/**
 * Classify this admission's own freshly-settled level-0 results as WORLD
 * (never committed before for this source) versus already covered by
 * recheckTestimony (same sourceId, same regime.start already in the
 * ledger) — a caller commits the WORLD set as new testimony and leaves the
 * rest to whatever recheckTestimony already found for them.
 */
export const classifyFresh = (ledger, sourceId, settledResults) => {
  const known = new Set(
    ledger.commits.filter((c) => c.sourceId === sourceId).map((c) => c.regime.start)
  );
  return settledResults.map((r) => ({
    result: r,
    tag: known.has(r.regime.start) ? null : WORLD,
  }));
};

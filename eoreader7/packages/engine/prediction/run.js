// eoreader6 · prediction/run — the prequential loop, in one place.
//
// history at step t
//   -> every candidate and every baseline emits a predictive distribution
//   -> commitPrediction seals each one, reveal_not_before_step = t + 1
//   -> series[t] is revealed
//   -> revealAndScore, leakage- and tamper-guarded
//   -> recordStep folds the losses into each candidate's ledger
//   -> candidates observe the revealed value, and only then
//   -> finalizeCompetency seals a scoped record per candidate
//
// Baselines are committed through the identical path as candidates, not
// evaluated by a shortcut. If the seal or the leakage guard were bypassed for
// baselines "because they are simple", the comparison would be between a
// candidate that was constrained and a baseline that was not, which is a
// different and much easier bar than the one this is supposed to measure.
//
// Pure: no clock, no randomness, no I/O, no ambient state. The one number that
// looks like a clock — the step index — is supplied by walkForward and is the
// logical ordering that lets "before" mean something without a wall clock.

import { canonicalHashSync } from "../../spec/canonical-json/index.js";
import { walkForward } from "./tasks.js";
import { commitPrediction, revealAndScore } from "./commitments.js";
import { createLedger, recordStep, finalizeCompetency } from "../competency/ledger.js";

/**
 * Run one series through every candidate and baseline.
 *
 * A step is only recorded if EVERY baseline produced a finite loss at it.
 * Otherwise the candidate's cumulative loss and the baselines' would be summed
 * over different step sets, and the difference between them would no longer be
 * a competency gain — it would be an artefact of which steps each side
 * happened to be scoreable on. Skipped steps are counted and reported rather
 * than dropped in silence.
 */
export const runPrequential = ({
  series,
  candidates,
  baselines,
  task,
  warmup,
  scoring_rule = "crps",
  population,
  source_versions,
}) => {
  if (!Array.isArray(series) || series.length < 3) throw new TypeError("run: series must have at least 3 points");
  if (!Number.isInteger(warmup) || warmup < 1) throw new TypeError("run: warmup must be a declared integer >= 1");
  if (!Array.isArray(baselines) || baselines.length === 0) throw new TypeError("run: at least one baseline is required");

  const baseline_ids = baselines.map((b) => b.id);
  for (const c of candidates) c.prime?.(series.slice(0, warmup));

  let ledgers = new Map(
    candidates.map((c) => [
      c.id,
      createLedger({ task_id: task.id, candidate_id: c.id, baseline_ids, scoring_rule }),
    ]),
  );
  // Each baseline also gets a ledger against the others, so the printed table
  // can show that the baselines disagree with each other too — a candidate
  // beating one baseline means much less once you can see the spread between
  // baselines on the same series.
  let baselineLedgers = new Map(
    baselines.map((b) => [
      b.id,
      createLedger({ task_id: task.id, candidate_id: b.id, baseline_ids, scoring_rule }),
    ]),
  );

  let skipped = 0;
  let steps = 0;

  for (const { step, history, target, committed_at_step, reveal_not_before_step } of walkForward(series, { warmup })) {
    const input_snapshot_hash = canonicalHashSync(history);

    const lossOf = (id, dist) => {
      const commitment = commitPrediction({
        task_id: task.id,
        candidate_id: id,
        candidate_version_hash: canonicalHashSync({ id, scoring_rule }),
        input_snapshot_hash,
        predictive_output: dist,
        committed_at_step,
        reveal_not_before_step,
      });
      return revealAndScore({ commitment, observed: target, revealed_at_step: step + 1, scoring_rule });
    };

    const baseline_losses = {};
    let baselinesUsable = true;
    for (const b of baselines) {
      const scored = lossOf(b.id, b.predict(history));
      if (typeof scored.loss !== "number" || !Number.isFinite(scored.loss)) baselinesUsable = false;
      baseline_losses[b.id] = scored.loss;
    }

    if (baselinesUsable) {
      steps++;
      for (const c of candidates) {
        const scored = lossOf(c.id, c.predict(history));
        ledgers.set(
          c.id,
          recordStep(ledgers.get(c.id), {
            candidate_loss: scored.loss,
            baseline_losses,
            proper: scored.proper,
          }),
        );
      }
      for (const b of baselines) {
        baselineLedgers.set(
          b.id,
          recordStep(baselineLedgers.get(b.id), {
            candidate_loss: baseline_losses[b.id],
            baseline_losses,
            proper: true,
          }),
        );
      }
    } else {
      skipped++;
    }

    for (const c of candidates) c.observe?.(target, history);
  }

  const scope = {
    horizon: task.horizon,
    population,
    source_versions,
    evaluation_protocol: "prequential-walk-forward",
  };

  return {
    task,
    steps,
    skipped,
    records: candidates.map((c) => ({
      ...finalizeCompetency(ledgers.get(c.id), scope),
      state: c.state?.() ?? null,
    })),
    baseline_records: baselines.map((b) => finalizeCompetency(baselineLedgers.get(b.id), scope)),
  };
};

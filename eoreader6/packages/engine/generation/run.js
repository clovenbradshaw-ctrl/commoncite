// eoreader6 · generation/run — the prequential loop for continuations.
//
// history at step t
//   -> every candidate and every baseline commits a WHOLE continuation
//   -> commitPrediction seals each one, reveal_not_before_step = t + horizon
//   -> tokens[t .. t+horizon) are revealed
//   -> revealAndScore, leakage- and tamper-guarded
//   -> recordStep folds the losses into each candidate's ledger
//   -> every emitter reads forward to the next draw, and only then
//   -> finalizeCompetency seals a scoped record per candidate
//
// Reusing prediction/commitments.js and competency/ledger.js unchanged is not
// a convenience here, it is the claim: the substrate really was task-agnostic,
// and the only thing generation needed from it was one more emission kind.
//
// EMITTERS ADVANCE THROUGH THE TOKEN ARRAY, NOT THROUGH THE TARGETS. Feeding
// each emitter its own target after scoring would be correct only at
// stride = horizon and would silently double-count or skip material at any
// other stride. Instead every emitter is walked forward to the next draw's
// start position from the token array itself, which is right at every stride
// and is also the only version that stays right when draws overlap.
//
// Pure: no clock, no randomness, no I/O, no ambient state.

import { canonicalHashSync } from "../../spec/canonical-json/index.js";
import { commitPrediction, revealAndScore } from "../prediction/commitments.js";
import { createLedger, recordStep, finalizeCompetency } from "../competency/ledger.js";
import { isGap } from "../../../nul/index.js";
import { admissibleAsTestimony } from "./emit.js";

// A cap on `samples`, the human-inspection side channel below (what was
// imagined vs. the withheld target per draw) — not a measurement bound.
// `scored`/`skipped`/`testimony` and every candidate's competency ledger are
// computed over the FULL, uncapped draw set regardless of this cap; nothing
// here gates what counts as a finding. Bounds the size of the returned
// object for a human reading it, nothing more.
const SAMPLE_SIDECAR_CAP = 40;

const versionHash = (emitter) =>
  canonicalHashSync({
    id: emitter.id,
    order: emitter.belief?.maxOrder ?? null,
    layers: emitter.belief?.layerIds ?? [emitter.id],
    givers: emitter.belief?.givers ?? [],
  });

/**
 * Run one token stream through every candidate and baseline.
 *
 * A draw is only recorded if EVERY emitter — candidate and baseline alike —
 * produced a finite loss at it. Otherwise the cumulative losses would be sums
 * over different draw sets and their difference would not be a competency
 * gain, it would be an artefact of which draws each side happened to be
 * scoreable on. Skipped draws are counted and returned, never dropped in
 * silence.
 */
export const runGeneration = ({
  tokens,
  draws,
  candidates,
  baselines,
  task,
  scoring_rule = "sequence-log-loss",
  population,
  source_versions,
  primeUpTo,
  seed = 0,
}) => {
  if (!Array.isArray(tokens) || tokens.length < 3) throw new TypeError("generation/run: tokens must be a real stream");
  if (!Array.isArray(baselines) || baselines.length === 0)
    throw new TypeError("generation/run: at least one baseline is required");
  if (!Number.isInteger(primeUpTo) || primeUpTo < 1)
    throw new TypeError("generation/run: primeUpTo is the declared warmup and is never defaulted");

  const conditioning = task.conditioning;
  const selection = task.selection;
  const emitters = [...candidates, ...baselines];
  const baseline_ids = baselines.map((b) => b.id);

  const warmup = tokens.slice(0, primeUpTo);
  for (const e of emitters) e.prime(warmup);
  let cursor = primeUpTo;

  let ledgers = new Map(
    candidates.map((c) => [c.id, createLedger({ task_id: task.id, candidate_id: c.id, baseline_ids, scoring_rule })]),
  );
  // Baselines get ledgers too, against the other baselines, so a printed table
  // can show what each of them was worth without a second code path.
  for (const b of baselines) {
    const others = baseline_ids.filter((id) => id !== b.id);
    if (others.length > 0)
      ledgers.set(b.id, createLedger({ task_id: task.id, candidate_id: b.id, baseline_ids: others, scoring_rule }));
  }

  let scored = 0;
  let skipped = 0;
  const skipReasons = Object.create(null);
  const testimony = new Map(emitters.map((e) => [e.id, { grounded: 0, borrowed: 0, received_fraction: 0 }]));
  const samples = [];

  for (const draw of draws) {
    // Walk every emitter forward to this draw's start. Causal by construction:
    // an emitter can only ever have seen tokens strictly before `step`.
    if (draw.step > cursor) {
      const advance = tokens.slice(cursor, draw.step);
      for (const e of emitters) e.observe(advance);
      cursor = draw.step;
    }

    const horizon = draw.target.length;
    const emissions = new Map();
    let usable = true;

    for (const e of emitters) {
      const emission = e.emit({ horizon, conditioning, selection, seed: seed + draw.step, target: draw.target });
      if (isGap(emission)) {
        usable = false;
        skipReasons[emission.gap] = (skipReasons[emission.gap] ?? 0) + 1;
        break;
      }
      emissions.set(e.id, emission);
    }
    if (!usable) {
      skipped++;
      continue;
    }

    const losses = new Map();
    for (const e of emitters) {
      const emission = emissions.get(e.id);
      const commitment = commitPrediction({
        task_id: task.id,
        candidate_id: e.id,
        candidate_version_hash: versionHash(e),
        input_snapshot_hash: canonicalHashSync({ upTo: draw.step, tail: tokens.slice(Math.max(0, draw.step - 8), draw.step) }),
        active_prior_hashes: (emission.attribution ? Object.keys(emission.attribution) : []).sort(),
        predictive_output: emission,
        committed_at_step: draw.committed_at_step,
        reveal_not_before_step: draw.reveal_not_before_step,
      });
      const result = revealAndScore({
        commitment,
        observed: [...draw.target],
        revealed_at_step: draw.reveal_not_before_step,
        scoring_rule,
      });
      losses.set(e.id, result);
    }

    if (![...losses.values()].every((r) => typeof r.loss === "number" && Number.isFinite(r.loss))) {
      skipped++;
      skipReasons.non_finite_loss = (skipReasons.non_finite_loss ?? 0) + 1;
      continue;
    }

    // Bookkeeping ONLY. Nothing in this block touches a loss, and nothing
    // downstream may treat `borrowed` as a penalty: every emission here is an
    // imagining, imagining out of other books is imagination working, and the
    // ledger is deliberately blind to where a good guess came from. What these
    // counts answer is a different question — if someone tried to assert these
    // continuations about this material, how many would be refused at the
    // crossing. See emit.js, "AN EMISSION IS IMAGINATION".
    for (const e of emitters) {
      const emission = emissions.get(e.id);
      const t = testimony.get(e.id);
      if (admissibleAsTestimony(emission) === null) t.grounded++;
      else t.borrowed++;
      t.received_fraction += emission.received_fraction ?? 0;
    }

    for (const [id, ledger] of ledgers) {
      const baselineLosses = {};
      for (const bid of ledger.baseline_ids) baselineLosses[bid] = losses.get(bid).loss;
      ledgers.set(id, recordStep(ledger, { candidate_loss: losses.get(id).loss, baseline_losses: baselineLosses, proper: losses.get(id).proper }));
    }

    if (samples.length < SAMPLE_SIDECAR_CAP)
      samples.push({
        step: draw.step,
        prefix: draw.prefix ?? null,
        target: [...draw.target],
        emitted: Object.fromEntries([...emissions].map(([id, em]) => [id, [...(em.emitted ?? [])]])),
        received_fraction: Object.fromEntries([...emissions].map(([id, em]) => [id, em.received_fraction ?? 0])),
        grounded: Object.fromEntries([...emissions].map(([id, em]) => [id, em.grounded === true])),
      });

    scored++;
  }

  const records = new Map();
  for (const [id, ledger] of ledgers) {
    records.set(
      id,
      finalizeCompetency(ledger, {
        horizon: task.horizon,
        population,
        source_versions,
        evaluation_protocol: `prequential ${conditioning} continuation, whole horizon sealed before any reveal, scored by ${scoring_rule}`,
      }),
    );
  }

  return {
    records,
    ledgers,
    scored,
    skipped,
    skipReasons,
    testimony: Object.fromEntries(
      [...testimony].map(([id, t]) => [
        id,
        {
          ...t,
          mean_received_fraction: scored > 0 ? t.received_fraction / scored : 0,
        },
      ]),
    ),
    samples,
    states: Object.fromEntries(emitters.map((e) => [e.id, e.state?.() ?? null])),
  };
};

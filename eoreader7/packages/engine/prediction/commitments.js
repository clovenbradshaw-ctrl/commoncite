// eoreader6 · prediction/commitments — sealed before the reveal, or it is not
// evidence.
//
// Re-earned from eoreader5's packages/engine/prediction/commitments, and this
// is the module that pays for the whole port, because it is the same act as
// `keep` in nul: a ground that has been KEPT can be testified from and can no
// longer be perceived through. A commitment that has been sealed can be scored
// against and can no longer be edited. One boolean there, one hash here; the
// phase rule is identical, and "you cannot both look and speak in the same
// act" is what both of them enforce.
//
// "Before" without a clock: the engine reads no ambient time, so the ordering
// that makes "before" mean anything is a caller-supplied logical step index
// from the prequential walk. A commitment made at step t declares
// reveal_not_before_step = t + 1; revealing earlier is leakage and is refused.
//
// Pure: no clock, no randomness, no I/O, no ambient state.

import { canonicalHashSync } from "../../spec/canonical-json/index.js";
import { score } from "./scoring.js";

// "sequence" joined when `generation/` was built. Everything else in this file
// was already modality-agnostic and needed no change to seal a continuation —
// including `active_prior_hashes`, which was written for exactly the case that
// has now arrived: a belief fed by priors from OTHER material. Which gifts
// were live when a guess was made is part of what the seal covers, so a
// competency claim can never be re-read later as though the reader had been
// working from this text alone.
// "sequence-scoped" joined when the seal turned out to cost more than the
// imagining. A scoped emission writes out the LIVE ground and carries the
// SETTLED ground by content hash, so the sealed body is the emitter's own
// choices plus a pin on what it inherited. That is exactly the guarantee a
// commitment owes: the settled ground is not something the emitter chose, and
// it cannot have changed, because the material behind the fold has perished.
// Measured on Heidi: 70,480 entries hashed twice per continuation, 235ms to
// seal against 121ms to imagine.
const SUPPORTED_KINDS = new Set(["point", "gaussian", "categorical", "quantiles", "samples", "sequence", "sequence-scoped"]);

const assertStep = (value, label) => {
  if (!Number.isInteger(value) || value < 0)
    throw new TypeError(`commitments: ${label} must be a non-negative integer step`);
};

const assertPredictiveOutput = (dist) => {
  if (!dist || typeof dist !== "object" || Array.isArray(dist))
    throw new TypeError("commitments: predictive_output must be an object");
  if (!SUPPORTED_KINDS.has(dist.kind))
    throw new TypeError(`commitments: unsupported predictive_output kind ${dist.kind}`);
};

/** The exact fields the seal covers. Kept in one place so commit and reveal cannot drift apart. */
const sealedBody = (c) => ({
  schema: "PredictionCommitment@1",
  task_id: c.task_id,
  candidate_id: c.candidate_id,
  candidate_version_hash: c.candidate_version_hash,
  input_snapshot_hash: c.input_snapshot_hash,
  active_prior_hashes: [...(c.active_prior_hashes ?? [])],
  predictive_output: c.predictive_output,
  committed_at_step: c.committed_at_step,
  reveal_not_before_step: c.reveal_not_before_step,
});

/**
 * Freeze and seal a prediction before its target is revealed. The returned
 * record is immutable and its `commitment_hash` covers every committed field
 * at every depth, so a later edit — including one reaching into
 * predictive_output — is detectable at reveal.
 */
export const commitPrediction = (c) => {
  if (!c || typeof c !== "object") throw new TypeError("commitments: commitment input must be an object");
  for (const field of ["task_id", "candidate_id", "candidate_version_hash", "input_snapshot_hash"])
    if (typeof c[field] !== "string" || !c[field]) throw new TypeError(`commitments: ${field} is required`);
  assertPredictiveOutput(c.predictive_output);
  assertStep(c.committed_at_step, "committed_at_step");
  assertStep(c.reveal_not_before_step, "reveal_not_before_step");
  if (c.reveal_not_before_step <= c.committed_at_step)
    throw new RangeError(
      "commitments: reveal_not_before_step must be strictly after committed_at_step — a prediction revealed at the step it was made is not a prediction",
    );

  const body = sealedBody(c);
  const commitment_hash = canonicalHashSync(body);
  return Object.freeze({
    ...body,
    active_prior_hashes: Object.freeze(body.active_prior_hashes),
    predictive_output: Object.freeze({ ...c.predictive_output }),
    commitment_id: `commitment:${commitment_hash}`,
    commitment_hash,
  });
};

/**
 * Reveal a target and score the sealed prediction against it. Refuses if the
 * commitment no longer matches its seal, or if the reveal happens before the
 * commitment is eligible. Both refusals throw: they are algebra violations,
 * not measurements that came out empty, and SEED.md #7 spends the type error
 * before it spends the null.
 */
export const revealAndScore = ({ commitment, observed, revealed_at_step, scoring_rule = "crps", settled = null }) => {
  if (!commitment || typeof commitment !== "object") throw new TypeError("commitments: commitment is required");
  if (canonicalHashSync(sealedBody(commitment)) !== commitment.commitment_hash)
    throw new Error("commitments: commitment_hash mismatch — this prediction was altered after it was sealed");
  assertStep(revealed_at_step, "revealed_at_step");
  if (revealed_at_step < commitment.reveal_not_before_step)
    throw new Error(
      `commitments: leakage refused — target revealed at step ${revealed_at_step} but this commitment is not eligible before step ${commitment.reveal_not_before_step}`,
    );

  // The settled ground is supplied AT REVEAL, never sealed by value. Its hash
  // is inside the sealed body, so the scorer refuses a substituted ground —
  // the tamper guarantee survives without the copy.
  const scored = score(commitment.predictive_output, observed, { rule: scoring_rule, settled });
  return Object.freeze({
    commitment_id: commitment.commitment_id,
    task_id: commitment.task_id,
    candidate_id: commitment.candidate_id,
    observed,
    revealed_at_step,
    loss: scored.loss,
    rule: scored.rule,
    proper: scored.proper,
    ...(scored.note ? { note: scored.note } : {}),
  });
};

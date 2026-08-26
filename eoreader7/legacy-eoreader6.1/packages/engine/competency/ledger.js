// eoreader6 · competency/ledger — the prequential fold, and the scope that
// makes its number mean anything.
//
// Re-earned from eoreader5's packages/engine/competency/ledger.
//
//   competencyGain(m, b) = Σ_t [ L(b, y_t) − L(m, y_t) ]
//
// Positive means the candidate carried lower cumulative loss than that
// baseline. The stub this replaces returned 0 unconditionally and mutated its
// argument — which is worth naming rather than quietly overwriting, because
// the two faults are the two failure modes this module exists to prevent: a
// competency that is always the same number regardless of evidence, and a
// historical evaluation that a later run can edit. Every recordStep returns a
// NEW ledger; nothing here is ever mutated in place.
//
// SEED.md's growth rule says an organ joins only when the level test returns
// `above` against the core. This ledger is the growth rule's other half — the
// place where "above" stops being an import-graph fact and becomes a measured
// one. `finalizeCompetency` therefore refuses to seal without a full scope:
// a gain with no named horizon, population, or protocol is not a weak claim,
// it is an unfalsifiable one.
//
// Pure: no clock, no randomness, no I/O, no ambient state.

import { canonicalHashSync } from "../../spec/canonical-json/index.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// EVA · Paradigm · Tracing — the prequential fold: competency against declared
// baselines, never nothing. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Pattern" });

/** An empty ledger for one candidate on one task, against a declared baseline set. */
export const createLedger = ({ task_id, candidate_id, baseline_ids, scoring_rule = "crps" }) => {
  if (typeof task_id !== "string" || !task_id) throw new TypeError("ledger: task_id is required");
  if (typeof candidate_id !== "string" || !candidate_id) throw new TypeError("ledger: candidate_id is required");
  if (!Array.isArray(baseline_ids) || baseline_ids.length === 0)
    throw new TypeError("ledger: at least one baseline_id is required — competency against nothing is not competency");
  const baseline_losses = {};
  for (const id of baseline_ids) baseline_losses[id] = 0;
  return Object.freeze({
    task_id,
    candidate_id,
    scoring_rule,
    baseline_ids: Object.freeze([...baseline_ids]),
    observations: 0,
    proper_observations: 0,
    cumulative_loss: 0,
    baseline_losses: Object.freeze(baseline_losses),
  });
};

/**
 * Fold one revealed step in. Returns a new ledger; the argument is untouched.
 *
 * A step whose candidate loss is null (no proper score for the emitted kind)
 * still advances `observations` but contributes nothing to `cumulative_loss`.
 * The gap between `proper_observations` and `observations` is how that shows
 * up — visibly, in the record — rather than as a silently shorter sum that
 * would flatter the candidate by simply not counting its hard steps.
 */
export const recordStep = (ledger, { candidate_loss, baseline_losses, proper = true }) => {
  if (!ledger || typeof ledger !== "object") throw new TypeError("ledger: ledger is required");
  if (!baseline_losses || typeof baseline_losses !== "object")
    throw new TypeError("ledger: baseline_losses is required");
  for (const id of ledger.baseline_ids)
    if (typeof baseline_losses[id] !== "number" || !Number.isFinite(baseline_losses[id]))
      throw new TypeError(`ledger: baseline_losses is missing a finite loss for ${id}`);

  const lossIsProper = proper && typeof candidate_loss === "number" && Number.isFinite(candidate_loss);
  const nextBaseline = {};
  for (const id of ledger.baseline_ids) nextBaseline[id] = ledger.baseline_losses[id] + baseline_losses[id];
  return Object.freeze({
    ...ledger,
    observations: ledger.observations + 1,
    proper_observations: ledger.proper_observations + (lossIsProper ? 1 : 0),
    cumulative_loss: ledger.cumulative_loss + (lossIsProper ? candidate_loss : 0),
    baseline_losses: Object.freeze(nextBaseline),
  });
};

/** Per-baseline gain: that baseline's cumulative loss minus the candidate's. */
export const competencyGain = (ledger) => {
  const gain = {};
  for (const id of ledger.baseline_ids) gain[id] = ledger.baseline_losses[id] - ledger.cumulative_loss;
  return Object.freeze(gain);
};

/** True only if the candidate beat EVERY declared baseline. The honest reading of "works". */
export const beatsAllBaselines = (ledger) => {
  const gain = competencyGain(ledger);
  return ledger.baseline_ids.length > 0 && ledger.baseline_ids.every((id) => gain[id] > 0);
};

/**
 * Seal the ledger into a scoped, content-addressed CompetencyRecord. Target,
 * horizon, population, sources, and protocol are required, not defaulted:
 * a competency number without them cannot be compared to any other, which is
 * the same defect SEED.md #5 names for two grounds built to different specs.
 *
 * `ground_status` is carried separately from competency and defaults to
 * "unknown" so nothing here is ever read as a causal claim.
 */
export const finalizeCompetency = (ledger, scope) => {
  if (!ledger || typeof ledger !== "object") throw new TypeError("ledger: ledger is required");
  if (!scope || typeof scope !== "object") throw new TypeError("ledger: a competency scope is required");
  for (const field of ["horizon", "population", "source_versions", "evaluation_protocol"])
    if (scope[field] === undefined) throw new TypeError(`ledger: competency scope must declare ${field}`);

  const body = {
    schema: "CompetencyRecord@1",
    candidate_id: ledger.candidate_id,
    task_id: ledger.task_id,
    baseline_ids: [...ledger.baseline_ids],
    scoring_rule: ledger.scoring_rule,
    scope: {
      horizon: scope.horizon,
      population: scope.population,
      source_versions: [...scope.source_versions],
      evaluation_protocol: scope.evaluation_protocol,
    },
    observations: ledger.observations,
    proper_observations: ledger.proper_observations,
    cumulative_loss: ledger.cumulative_loss,
    baseline_losses: { ...ledger.baseline_losses },
    competency_gain: competencyGain(ledger),
    beats_all_baselines: beatsAllBaselines(ledger),
    ground_status: scope.ground_status ?? "unknown",
    status: scope.status ?? "experimental",
  };
  const content_hash = canonicalHashSync(body);
  return Object.freeze({ ...body, id: `competency:${content_hash}`, content_hash });
};

// eoreader6 · prediction/tasks — a typed target, and the walk that withholds it.
//
// Re-earned from eoreader5's packages/engine/prediction/tasks. There is no
// untyped "predict what happens next": a task names its target type, horizon,
// scoring rule, baselines, population, and reveal procedure, and is
// content-addressed so two runs claiming the same task can be checked rather
// than trusted.
//
// The declared fields here are the same species as SEED.md's three declared
// numbers — `draws`, `reseeds`, `window` — and they follow the same rule:
// none of them is ever a default. A horizon quietly defaulted to 1, or a
// baseline list quietly defaulted to empty, is the identical failure as a
// window derived from material length: it makes two results incomparable
// while looking like it made them comparable.
//
// Pure: no clock, no randomness, no I/O, no ambient state.

import { canonicalHashSync } from "../../spec/canonical-json/index.js";

/** A content-addressed PredictionTask. Every listed field is required. */
export const createPredictionTask = (t) => {
  if (!t || typeof t !== "object") throw new TypeError("tasks: task input must be an object");
  for (const field of ["target_type", "horizon", "scoring_rule", "baseline_ids", "population"])
    if (t[field] === undefined) throw new TypeError(`tasks: a PredictionTask must declare ${field}`);
  if (!Array.isArray(t.baseline_ids) || t.baseline_ids.length === 0)
    throw new TypeError("tasks: a task must declare at least one baseline — an unbaselined competency claim is unfalsifiable");

  const body = {
    schema: "PredictionTask@1",
    target_type: t.target_type,
    horizon: t.horizon,
    scoring_rule: t.scoring_rule,
    baseline_ids: [...t.baseline_ids],
    population: t.population,
    leakage_policy: t.leakage_policy ?? "prequential: target withheld until reveal_not_before_step",
    provenance: Array.isArray(t.provenance) ? [...t.provenance] : [],
  };
  const content_hash = canonicalHashSync(body);
  return Object.freeze({ ...body, id: `task:${content_hash}`, content_hash });
};

/**
 * Prequential walk-forward over a numeric series. Yields one step per withheld
 * target: `history` is everything legally visible, `target` is the next value.
 *
 * The step index IS the logical clock. This engine reads no wall clock, so
 * "the prediction was made before the target was visible" cannot be a
 * timestamp claim; it is an ordering claim over an integer the walk supplies.
 * A prediction committed at step i declares reveal_not_before_step = i + 1.
 *
 * `warmup` is declared rather than defaulted-to-1 in practice by every caller
 * here: a ground needs enough material to be built at all, and starting the
 * walk before that point produces a run of gaps that look like failures and
 * are actually a mis-declared start.
 */
export function* walkForward(series, { warmup = 1, horizon = 1 } = {}) {
  if (!Array.isArray(series)) throw new TypeError("tasks: series must be an array of numbers");
  if (horizon !== 1) throw new RangeError("tasks: walkForward supports horizon = 1 only");
  if (!Number.isInteger(warmup) || warmup < 1) throw new TypeError("tasks: warmup must be an integer >= 1");
  for (let i = warmup; i < series.length; i++) {
    const target = series[i];
    if (typeof target !== "number" || !Number.isFinite(target))
      throw new TypeError(`tasks: series[${i}] is not a finite number`);
    yield Object.freeze({
      step: i,
      history: Object.freeze(series.slice(0, i)),
      target,
      committed_at_step: i,
      reveal_not_before_step: i + 1,
    });
  }
}

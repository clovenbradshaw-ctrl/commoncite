// eoreader6 · generation/tasks — a typed continuation, and the walk that
// withholds all of it.
//
// The sibling of prediction/tasks.js, and deliberately built as a sibling
// rather than a generalisation. The two share `commitments`, `scoring` and
// `competency/ledger` untouched; what they cannot share is the reveal
// procedure, because a continuation is withheld as a WHOLE and a one-step
// forecast is withheld as a point. Folding them together would have meant one
// of the two silently getting the other's leakage rule.
//
// ── THE THREE THINGS THIS RECORD DECLARES THAT PREDICTION DID NOT ──────────
//
// `horizon` — free at last. prediction/tasks.js throws on any horizon but 1,
// which was the honest limit of what its walk could withhold. Here the horizon
// is the length of the continuation and 1 is just the degenerate case.
//
// `conditioning` — the distinction that separates generation from N
// predictions, and the one a benchmark can hide for years:
//
//   free-running    each step conditions on the emitter's OWN previous
//                   emission. Errors compound. This is generation.
//   teacher-forced  each step conditions on the TRUE prefix, handed back
//                   between steps. Errors do not compound. This is N one-step
//                   predictions wearing a continuation's shape, and it scores
//                   dramatically better for a reason that has nothing to do
//                   with competence at continuing anything.
//
// Both are legitimate measurements. Reporting one as the other is not, and it
// is not the kind of thing a scoring rule can catch — `sequence-log-loss` sees
// an identical object either way. So it is declared here, it is covered by the
// task's content hash, and two runs that disagree about it are visibly two
// different tasks rather than two results to average.
//
// `prior_ids` — which gifts were live. Required, and required even when empty,
// because "this reader had read nothing else" is a claim about the experiment
// and not the absence of one. Each entry names its giver, per SEED.md #1. The
// commitment seal carries the same list in `active_prior_hashes`, so the claim
// is pinned at both the task level and at every individual guess.
//
// Pure: no clock, no randomness, no I/O, no ambient state.

import { canonicalHashSync } from "../../spec/canonical-json/index.js";

export const CONDITIONING = Object.freeze(["free-running", "teacher-forced"]);

// How a form is chosen from each committed distribution. Declared, because it
// changes what free-running conditions on and therefore changes the result:
//   mode     the likeliest form. Deterministic, and prone to cycles — the
//            likeliest successor of the likeliest successor is very often the
//            word you just left.
//   sampled  drawn from the distribution under a declared seed. What a reader
//            expects is a distribution, not a single word, and a demonstration
//            that always says the argmax is not showing you the belief.
export const SELECTION = Object.freeze(["mode", "sampled"]);

/** A content-addressed GenerationTask. Every listed field is required. */
export const createGenerationTask = (t) => {
  if (!t || typeof t !== "object") throw new TypeError("generation/tasks: task input must be an object");
  for (const field of ["target_type", "horizon", "scoring_rule", "baseline_ids", "population", "conditioning", "selection", "prior_ids"])
    if (t[field] === undefined) throw new TypeError(`generation/tasks: a GenerationTask must declare ${field}`);

  if (!Number.isInteger(t.horizon) || t.horizon < 1)
    throw new TypeError("generation/tasks: horizon must be an integer >= 1");
  if (!CONDITIONING.includes(t.conditioning))
    throw new TypeError(
      `generation/tasks: conditioning must be one of ${CONDITIONING.join(" | ")} — free-running and teacher-forced are different measurements and are never defaulted between`,
    );
  if (!SELECTION.includes(t.selection))
    throw new TypeError(`generation/tasks: selection must be one of ${SELECTION.join(" | ")}`);
  if (!Array.isArray(t.baseline_ids) || t.baseline_ids.length === 0)
    throw new TypeError("generation/tasks: a task must declare at least one baseline — an unbaselined competency claim is unfalsifiable");
  if (!Array.isArray(t.prior_ids))
    throw new TypeError("generation/tasks: prior_ids is required — an empty list is a claim, a missing one is not");
  for (const p of t.prior_ids) {
    if (!p || typeof p !== "object" || typeof p.id !== "string" || typeof p.giver !== "string" || !p.giver)
      throw new TypeError("generation/tasks: every prior must name its giver — a prior is a gift (SEED.md #1)");
  }

  const body = {
    schema: "GenerationTask@1",
    target_type: t.target_type,
    horizon: t.horizon,
    conditioning: t.conditioning,
    selection: t.selection,
    scoring_rule: t.scoring_rule,
    baseline_ids: [...t.baseline_ids],
    prior_ids: t.prior_ids.map((p) => ({ id: p.id, giver: p.giver })),
    population: t.population,
    leakage_policy:
      t.leakage_policy ?? "prequential: the entire continuation is committed before any of its targets is revealed",
    provenance: Array.isArray(t.provenance) ? [...t.provenance] : [],
  };
  const content_hash = canonicalHashSync(body);
  return Object.freeze({ ...body, id: `task:${content_hash}`, content_hash });
};

/**
 * Prequential walk-forward over a token stream, withholding `horizon` forms at
 * a time.
 *
 * `reveal_not_before_step` is `step + horizon`, NOT `step + 1`. The whole
 * continuation is sealed before any of it is seen, so the first target is not
 * eligible for reveal until the last one is. Setting it to step + 1 would
 * leave a free-running emitter formally entitled to see its own first target
 * before committing its second — which is teacher-forcing, arrived at through
 * an off-by-one instead of through a decision.
 *
 * `stride` is how far the window advances between draws. It is declared, not
 * defaulted to 1, because at stride < horizon consecutive draws overlap and
 * the scored steps are not independent — a real property of the measurement
 * that a reader of the results has to be told about rather than infer.
 */
export function* walkForwardSequence(tokens, { warmup, horizon, stride }) {
  if (!Array.isArray(tokens)) throw new TypeError("generation/tasks: tokens must be an array");
  if (!Number.isInteger(warmup) || warmup < 1) throw new TypeError("generation/tasks: warmup must be an integer >= 1");
  if (!Number.isInteger(horizon) || horizon < 1) throw new TypeError("generation/tasks: horizon must be an integer >= 1");
  if (!Number.isInteger(stride) || stride < 1)
    throw new TypeError("generation/tasks: stride is declared — overlapping draws are not independent and the reader must be told");

  for (let i = warmup; i + horizon <= tokens.length; i += stride) {
    yield Object.freeze({
      step: i,
      history: Object.freeze(tokens.slice(0, i)),
      target: Object.freeze(tokens.slice(i, i + horizon)),
      committed_at_step: i,
      reveal_not_before_step: i + horizon,
    });
  }
}

/**
 * Finish the sentence.
 *
 * The same withholding, cut at units a person would recognise: walk sentences,
 * hand over the first `prefix` forms of one, withhold the rest. `sentences` is
 * an array of token arrays; history is every form up to and including the
 * prefix, so the reader arrives at each sentence having read everything before
 * it — which is what makes this a reading and not a quiz.
 *
 * Sentences shorter than `prefix + 1` are skipped rather than padded, and the
 * count of skips is the caller's to report. Padding them would put targets in
 * the record that no one ever wrote.
 */
export function* walkSentenceCompletions(sentences, { warmupSentences, prefix, horizon }) {
  if (!Array.isArray(sentences)) throw new TypeError("generation/tasks: sentences must be an array of token arrays");
  if (!Number.isInteger(warmupSentences) || warmupSentences < 1)
    throw new TypeError("generation/tasks: warmupSentences must be an integer >= 1");
  if (!Number.isInteger(prefix) || prefix < 0) throw new TypeError("generation/tasks: prefix must be an integer >= 0");
  if (!Number.isInteger(horizon) || horizon < 1) throw new TypeError("generation/tasks: horizon must be an integer >= 1");

  let offset = 0;
  for (let s = 0; s < warmupSentences && s < sentences.length; s++) offset += sentences[s].length;

  for (let s = warmupSentences; s < sentences.length; s++) {
    const sentence = sentences[s];
    const available = sentence.length - prefix;
    if (available >= 1) {
      const take = Math.min(horizon, available);
      const start = offset + prefix;
      yield Object.freeze({
        step: start,
        sentence_index: s,
        prefix: Object.freeze(sentence.slice(0, prefix)),
        history_end: start,
        target: Object.freeze(sentence.slice(prefix, prefix + take)),
        committed_at_step: start,
        reveal_not_before_step: start + take,
        truncated: take < horizon,
      });
    }
    offset += sentence.length;
  }
}

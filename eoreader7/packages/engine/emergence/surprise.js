// eoreader6 · emergence/surprise — the two lanes, kept apart, and the one
// boundary where they provably coincide.
//
//   NOVELTY / SHANNON SURPRISAL   -log2 P(outcome)
//     How improbable was this, under what I believed? A property of the event
//     given a model. Additive over independent observations — which is why it
//     is log-scaled, and why accumulating it over a read path is legitimate.
//
//   BAYESIAN SURPRISE             D_KL(posterior || prior)
//     How far did belief MOVE? Itti & Baldi. A rare event that shifts nothing
//     (a ship's manifest) scores low; a common-worded sentence that forces
//     revision ("I beheld the wretch") scores high. NON-ADDITIVE and not
//     decomposable across observations: this is a per-observation snapshot,
//     never a running total, and averaging it over a window is a category
//     error. (Committed exactly that error once; see git history.)
//
// THE BOUNDARY INVARIANT, enforced in conformance/surprise.test.js:
//   When the posterior is a genuine point mass — full commitment, no residual
//   amplitude on the road not taken — KL(delta_a || prior) collapses
//   algebraically to -log2 P(a). The two lanes are non-collapsible IN
//   GENERAL and provably identical AT FULL COMMITMENT. Any drift between them
//   at that boundary is a normalisation bug, not a modelling choice. It is a
//   real bug-catcher: an earlier prior here spread its novelty reserve over
//   all forms instead of only unseen ones, so p_prior did not sum to 1, and
//   the tell was a clamp (`Math.max(0, kl)`) on a quantity that is
//   non-negative by construction.
//
// ON THE BORN-RULE VOCABULARY, stated precisely because the physics is real
// and the borrowing is not the physics. What does formal work here is the
// COLLAPSE-AS-MEASUREMENT STRUCTURE: surprise is not a fluid dribbling out
// across a read, it is concentrated at discrete measurement events, and the
// windows of surprise are the intervals between them. What does NOT do formal
// work anywhere in this repo is |amplitude|^2 weighting — every "Born null"
// in this codebase is a conditional null distribution, generated and scored
// classically. The architecture is an analogy on the weighting law and a
// structural claim on the collapse. Both arguments hold without the quantum
// formalism; the vocabulary is borrowed, and saying so costs nothing.

const LOG2 = Math.LN2;

// Reserved prefix for the synthetic never-before-seen forms `novelRate`
// injects into a continuation. Same reservation discipline as
// generation/belief.js::UNSEEN — a real form key cannot begin with it.
const NOVEL_SENTINEL = "\u0000novel:";

// The cell this organ occupies on the operator grid (engine/operators.js):
// EVA · Lens · Binding — the two lanes kept apart: novelty and bayesian
// surprise. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Figure" });

/**
 * A prior smoothed over an explicit form-set. Both lanes must consume the
 * SAME smoothed prior or the boundary identity is only approximate — the
 * identity is the test, so the smoothing is shared by construction.
 */
export const smoothedPrior = (prior, priorTotal, forms, alpha) => {
  const den = priorTotal + alpha * forms.size;
  if (den <= 0) return null;
  return (f) => ((prior.get(f) ?? 0) + alpha) / den;
};

/** -log2 P(outcome) under the prior. Additive; safe to accumulate. */
export const shannonSurprisal = (form, prior, priorTotal, forms, { alpha = 1 } = {}) => {
  const p = smoothedPrior(prior, priorTotal, forms, alpha);
  if (!p) return null;
  const px = p(form);
  return px > 0 ? -Math.log(px) / LOG2 : null;
};

/**
 * D_KL(posterior || prior) in bits, for one observation. NOT additive.
 *
 * `gamma` is the recency decay carried from prior into posterior, and it is
 * what makes this a READER's belief rather than a corpus statistic: the
 * distant past fades, so a motif returning after long enough away can move
 * belief again. gamma = 0 is total commitment (the prior is discarded, the
 * posterior is the observation alone) and is the boundary case above.
 */
export const bayesianSurprise = (prior, priorTotal, arrival, arrivalTotal, { gamma, alpha = 1 } = {}) => {
  if (!Number.isFinite(gamma) || gamma < 0 || gamma > 1)
    throw new TypeError("bayesianSurprise: gamma is declared in [0,1], never defaulted");
  const forms = new Set([...prior.keys(), ...arrival.keys()]);
  if (forms.size === 0) return null;

  const p = smoothedPrior(prior, priorTotal, forms, alpha);
  if (!p) return null;

  const postDen = gamma * priorTotal + arrivalTotal + alpha * forms.size;
  if (postDen <= 0) return null;

  let kl = 0;
  for (const f of forms) {
    const q = (gamma * (prior.get(f) ?? 0) + (arrival.get(f) ?? 0) + alpha) / postDen;
    if (q <= 0) continue;
    kl += q * (Math.log(q / p(f)) / LOG2);
  }
  // Non-negative by construction when both sides are proper distributions.
  // No clamp: a negative here means a normalisation bug and should surface.
  return kl;
};

/**
 * The Born-shaped null: what KL would this frame produce if belief were NOT
 * really moving — if the text simply continued as the prior expects?
 *
 * Conditional per observation, generated from the reader's own belief, never
 * a global constant. A shuffle null cannot answer this: shuffling a series
 * leaves the multiset of its values untouched, so for a per-observation
 * statistic it is vacuous — which is exactly why `burstiness` exists for the
 * order-sensitive case (SEED.md: "a statistic must be sensitive to what its
 * perturbation destroys").
 *
 * Returns the null KLs, sorted. The caller ranks the real observation against
 * them; a run of exceedances IS a window of surprise, discovered rather than
 * declared.
 *
 * `novelRate` — THE STRAWMAN THIS NULL HAS WHEN THE MATERIAL IS SPARSE.
 *
 * A continuation drawn from the prior can only ever contain forms the prior
 * ALREADY HOLDS. Over word-forms that is nearly harmless: by the time a reader
 * has a prior worth the name, most words in the next sentence are words it has
 * seen. Over sparse forms it is fatal. MEASURED on War and Peace with the tier
 * stack reading graph EDGES (emergence/tiers.js): 264 nodes and 98 live
 * relations across 532 observations, so most frames carry an edge the prior has
 * never held — the real arrival then beats every null draw *by construction*,
 * and the gate fired on 233 of 532 observations, in unbroken runs. That is not
 * a gate, and a null that the observation clears by construction is SEED.md #3
 * at the level of the perturbation: "it would clear anything put in front of
 * it."
 *
 * So the null may be told how novel a continuation should EXPECT to be. Each
 * token is, with probability `novelRate`, a form the prior has never held
 * (distinct per token, the way genuinely new forms arrive) rather than a draw
 * from the prior's mass. The question becomes the honest one — "did this move
 * belief further than a continuation AS NOVEL AS USUAL would have" — instead of
 * "did anything new happen at all."
 *
 * `novelRate` is MEASURED by the caller from its own history, never declared;
 * the default of 0 is exactly the previous behaviour, so existing callers
 * (scripts/read-frankenstein.mjs, conformance/surprise.test.js) are unchanged.
 */
export const priorContinuationNull = (prior, priorTotal, arrivalTotal, { gamma, alpha = 1, draws, seed = 0, novelRate = 0 }) => {
  if (!Number.isInteger(draws) || draws < 2)
    throw new TypeError("priorContinuationNull: draws is declared, never defaulted");
  if (!Number.isFinite(novelRate) || novelRate < 0 || novelRate > 1)
    throw new TypeError("priorContinuationNull: novelRate is a measured share in [0,1]");

  const formList = [...prior.keys()];
  if (formList.length === 0 || priorTotal <= 0) return null;

  // cumulative mass for sampling a continuation the prior itself expects
  const cum = [];
  let acc = 0;
  for (const f of formList) { acc += prior.get(f); cum.push(acc); }

  let a = (seed | 0) + 0x6d2b79f5;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const samples = [];
  for (let d = 0; d < draws; d++) {
    const synthetic = new Map();
    for (let k = 0; k < arrivalTotal; k++) {
      if (novelRate > 0 && next() < novelRate) {
        // A form the prior has never held. Distinct per token: genuinely new
        // forms arrive as separate things, not as repeats of one new thing.
        // NOVEL_SENTINEL is reserved the way generation/belief.js reserves
        // UNSEEN, so a synthetic novel form can never collide with a real key.
        synthetic.set(`${NOVEL_SENTINEL}${d}:${k}`, 1);
        continue;
      }
      const r = next() * acc;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      const f = formList[lo];
      synthetic.set(f, (synthetic.get(f) ?? 0) + 1);
    }
    const kl = bayesianSurprise(prior, priorTotal, synthetic, arrivalTotal, { gamma, alpha });
    if (kl != null) samples.push(kl);
  }
  return samples.length ? samples.sort((x, y) => x - y) : null;
};

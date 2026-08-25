// eoreader6 · generation/baselines — the bar a guess has to clear.
//
// Same argument as prediction/baselines.js, and it needs restating here
// because generation is where it is easiest to skip: a continuation that reads
// well is enormously persuasive, and "it produced fluent text" is not a
// result. Without these, "the reader can finish a sentence" is unfalsifiable
// and the whole apparatus becomes a system becoming what it was asked to be.
//
// Three of the four baselines are built out of `createLayer` with gamma = 1
// and no received layers, WHICH IS THE POINT. Every candidate in
// ./candidates.js is the same estimator differing in exactly one respect —
// the decay, the gifts, or the reset. If a baseline used a different estimator
// than the candidate it controls, a gain could be attributed to the estimator
// instead of the organ, and the measurement would be wasted.
//
//   baseline:uniform-vocab   the floor. Every form the reader has met, equally
//                            likely. Anything that cannot beat this knows
//                            nothing at all about the material.
//   baseline:unigram         order 0, no decay. Word frequency.
//   baseline:markov-k        order k, no decay, read-only. The control for
//                            every candidate here.
//   baseline:copy-previous   say the last `horizon` forms again. Persistence,
//                            which is a stronger baseline than it sounds on
//                            repetitive material and a very weak one on prose.
//
// Pure: no clock, no randomness, no I/O, no ambient state.

import { createLayer, createBelief, UNSEEN } from "./belief.js";
import { emitSequence } from "./emit.js";

/**
 * Wrap a belief as an emitter: the interface `run.js` drives.
 *
 * Emitters are stateful and hold their own accumulated `seen` array. They must
 * be constructed fresh per run — a reused emitter carries one run's material
 * into another's guesses, which is leakage that no seal would catch because it
 * happened before any commitment was made.
 */
export const asEmitter = (id, belief, { onObserve = null } = {}) => {
  const seen = [];
  // Every gift is scored against the arriving form BEFORE the read layer
  // absorbs it, using the context that preceded it. Relevance is therefore
  // earned causally — no gift is ever credited against material the reader had
  // already been shown at the moment of the guess.
  const consume = (tok) => {
    const ctx = seen.slice(Math.max(0, seen.length - belief.maxOrder));
    belief.witnessForm(ctx, tok);
    seen.push(tok);
    belief.readLayer.observe(seen, seen.length - 1);
    onObserve?.(seen, seen.length - 1, belief);
  };
  return {
    id,
    belief,
    prime(tokens) {
      for (const tok of tokens) consume(tok);
      return this;
    },
    emit({ horizon, conditioning, selection, seed, target }) {
      return emitSequence({ belief, context: seen, horizon, conditioning, selection, seed, target });
    },
    observe(revealed) {
      for (const tok of revealed) consume(tok);
      return this;
    },
    state: () => ({
      observations: seen.length,
      vocabulary: belief.readLayer.vocabularySize,
      ...(belief.receivedLayers.length ? { relevance: belief.relevanceReport() } : {}),
    }),
  };
};

/** A read-only belief at order k with no decay. The shared skeleton. */
export const plainBelief = ({ order, alpha, gamma = 1, id = "read" }) =>
  createBelief({ layers: [createLayer({ id, tier: "read", order, gamma, alpha })] });

/** order-k counts, no decay, no gifts. The control every candidate is read against. */
export const markov = ({ order, alpha }) =>
  asEmitter(`baseline:markov-${order}`, plainBelief({ order, alpha }));

/** order-0 counts. Word frequency, context-blind. */
export const unigram = ({ alpha }) => asEmitter("baseline:unigram", plainBelief({ order: 0, alpha }));

/**
 * Uniform over the causal vocabulary — every form the reader has met so far,
 * equally likely, plus the reserve for one it has not.
 *
 * Built by hand rather than out of a layer because a layer at order 0 is
 * unigram by construction and there is no parameter setting that makes it
 * uniform. The vocabulary is causal: it grows as the read does, so this
 * baseline gets steadily harder to beat in absolute terms and the comparison
 * stays honest at every step.
 */
export const uniformVocab = () => {
  const vocab = new Set();
  const emitOne = () => {
    const probs = Object.create(null);
    // One reserved slot for the unmet form, so this baseline is subject to the
    // same refusal to renormalise as every belief here (SEED.md #3).
    const denom = vocab.size + 1;
    for (const form of vocab) probs[form] = 1 / denom;
    probs[UNSEEN] = 1 / denom;
    return Object.freeze({ kind: "categorical", probs });
  };
  const seen = [];
  return {
    id: "baseline:uniform-vocab",
    prime(tokens) {
      for (const t of tokens) {
        seen.push(t);
        vocab.add(t);
      }
      return this;
    },
    emit({ horizon, conditioning, selection }) {
      const steps = [];
      const emitted = [];
      for (let h = 0; h < horizon; h++) {
        steps.push(emitOne());
        // Every form is equally likely, so the mode is a tie across the whole
        // vocabulary. Broken lexicographically and stated here so nobody reads
        // the emitted text as a claim: it is an artefact of tie-breaking.
        emitted.push([...vocab].sort()[0] ?? null);
      }
      return Object.freeze({
        kind: "sequence",
        steps: Object.freeze(steps),
        unseen_label: UNSEEN,
        covers_vocabulary: true,
        conditioning,
        selection,
        emitted: Object.freeze(emitted),
        attribution: Object.freeze({ "baseline:uniform-vocab": 1 }),
        read_fraction: 1,
        received_fraction: 0,
        grounded: true,
      });
    },
    observe(revealed) {
      for (const t of revealed) {
        seen.push(t);
        vocab.add(t);
      }
      return this;
    },
    state: () => ({ observations: seen.length, vocabulary: vocab.size }),
  };
};

/**
 * Say the last `horizon` forms again.
 *
 * The generation analogue of prediction's persistence baseline, and it needs a
 * probability to be scoreable at all. It commits its copied form with the mass
 * the reader's own experience justifies — the empirical rate at which a form
 * at distance `horizon` repeats — rather than a hand-picked confidence, for
 * the same reason no other spread in this repo is hand-picked. On material
 * where nothing repeats that rate goes to nearly zero and this baseline
 * correctly becomes almost impossible to beat with, rather than trivially
 * beatable by construction.
 *
 * THE RESIDUAL GOES TO THE VOCABULARY, NOT TO THE RESERVE, and this is the
 * whole reason this baseline is worth reading twice. The first version parked
 * 1 − p on the unseen reserve, so every target it failed to copy collected
 * almost all of that mass and cost it almost nothing — it beat every real
 * belief on the first run by declining to say anything. Spreading the residual
 * uniformly over the forms it has actually met is what makes it a persistence
 * baseline rather than a refusal baseline, and it is why this one can now
 * declare `covers_vocabulary` honestly.
 */
export const copyPrevious = ({ horizon }) => {
  const seen = [];
  const vocab = new Set();
  let repeats = 0;
  let trials = 0;
  return {
    id: "baseline:copy-previous",
    prime(tokens) {
      for (const t of tokens) {
        if (seen.length >= horizon) {
          trials++;
          if (seen[seen.length - horizon] === t) repeats++;
        }
        seen.push(t);
        vocab.add(t);
      }
      return this;
    },
    emit({ horizon: h, conditioning, selection }) {
      // Laplace on the observed repeat rate: never 0 (which would make one
      // miss infinitely costly) and never 1 (which would claim certainty).
      const p = (repeats + 1) / (trials + 2);
      const steps = [];
      const emitted = [];
      for (let i = 0; i < h; i++) {
        const form = seen.length >= h ? seen[seen.length - h + i] : null;
        const probs = Object.create(null);
        // One share each for the forms met but not copied, plus one for the
        // unmet form. The copied form takes p; the rest split 1 − p.
        const others = vocab.size - (form !== null && vocab.has(form) ? 1 : 0) + 1;
        const share = others > 0 ? (form === null ? 1 : 1 - p) / others : 0;
        for (const f of vocab) if (f !== form) probs[f] = share;
        probs[UNSEEN] = share;
        if (form !== null) probs[form] = p;
        steps.push(Object.freeze({ kind: "categorical", probs }));
        emitted.push(form);
      }
      return Object.freeze({
        kind: "sequence",
        steps: Object.freeze(steps),
        unseen_label: UNSEEN,
        covers_vocabulary: true,
        conditioning,
        selection,
        emitted: Object.freeze(emitted),
        attribution: Object.freeze({ "baseline:copy-previous": 1 }),
        read_fraction: 1,
        received_fraction: 0,
        grounded: true,
      });
    },
    observe(revealed) {
      for (const t of revealed) {
        if (seen.length >= horizon) {
          trials++;
          if (seen[seen.length - horizon] === t) repeats++;
        }
        seen.push(t);
        vocab.add(t);
      }
      return this;
    },
    state: () => ({ observations: seen.length, repeat_rate: trials > 0 ? repeats / trials : null }),
  };
};

/** The default suite for a token-continuation task. */
export const defaultGenerationBaselines = ({ order, alpha, horizon }) => [
  uniformVocab(),
  unigram({ alpha }),
  markov({ order, alpha }),
  copyPrevious({ horizon }),
];

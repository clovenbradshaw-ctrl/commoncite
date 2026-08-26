// eoreader6 · generation/candidates — this engine's organs, as continuers.
//
// The same discipline as prediction/candidates.js, and for the same reason:
// every candidate is a MINIMAL CONTRAST with a baseline it is meant to be read
// against, so a gain can be attributed to exactly one thing.
//
//   candidate:decayed-belief   vs  baseline:markov-k
//       Identical estimator, identical order, identical smoothing. The ONLY
//       difference is gamma < 1. So the gain measures exactly one thing —
//       whether a reader's FADING memory continues this text better than a
//       corpus statistic over the same text does. This is `emergence/surprise`'s
//       gamma, which that module declared and spent only on measuring how far
//       belief had moved. Here it is spent on saying what comes next.
//
//   candidate:prior-augmented  vs  baseline:markov-k
//       Identical estimator, identical order, identical gamma. The ONLY
//       difference is that received layers are present. So the gain measures
//       exactly one thing — whether having read OTHER books helps finish a
//       sentence in this one. Every form it borrows is marked; see ./emit.js.
//
//   candidate:regime-belief    vs  baseline:markov-k
//       Identical estimator. The ONLY difference is that the counts are
//       cleared where `loops/atmosphere` concedes its ground. This is the
//       exact claim `candidate:regime-mean` made in prediction/candidates.js,
//       carried to a different target type: are the re-zero boundaries real?
//       If they are, a belief that starts over at them should continue the
//       text better than one that never starts over, because the material
//       after a boundary is the material a reader is actually in.
//
//   candidate:boundary-null    — regime-belief's decisive control. Same number
//       of resets, at positions it was handed instead of positions atmosphere
//       found. Without it, regime-belief beating markov-k could just mean that
//       forgetting periodically is good for a non-stationary text, which is a
//       different and much less interesting claim.
//
// ON FEEDING ATMOSPHERE ITS OWN SURPRISAL. The regime tracker consumes finite
// numbers, and the number it is handed here is the candidate's own causal
// surprisal — −log p(token | context) computed from the belief BEFORE that
// token is observed. This is the same series prediction/RESULTS.md ran its
// whole battery on, which is what makes the two results commensurable. It is
// causal by construction: no step can be scored, or can influence a boundary,
// using a token the belief had already been shown.
//
// Pure: no clock, no randomness, no I/O. Read SEED.md first.

import { createLayer, createBelief } from "./belief.js";
import { emitSequence } from "./emit.js";
import { asEmitter, plainBelief } from "./baselines.js";
import { createRegimeTracker } from "../loops/atmosphere.js";

/**
 * The reader's fading memory. gamma < 1 or this is just markov-k with extra
 * steps, and that is checked rather than trusted, because a candidate that has
 * silently become its own control reports a gain of zero as though it had been
 * tested.
 */
export const decayedBelief = ({ order, alpha, gamma }) => {
  if (!(gamma < 1))
    throw new RangeError(
      "candidates: decayed-belief needs gamma < 1 — at gamma = 1 it IS baseline:markov-k and the contrast is empty",
    );
  return asEmitter(`candidate:decayed-belief-g${gamma}`, plainBelief({ order, alpha, gamma }));
};

/**
 * A reader who has read other books.
 *
 * `priors` is a list of { id, giver, tokens }. The giver is not optional and
 * not decorative — `createLayer` refuses a received layer without one, so a
 * prior whose provenance was lost cannot be loaded at all rather than being
 * loaded and quietly untracked.
 *
 * Received layers are trained once and never observe again. They are gifts,
 * not a second reading: letting them accumulate the material under test would
 * make them a copy of the read layer with a different name, and every
 * attribution number downstream would be a fiction.
 */
export const priorAugmented = ({ order, alpha, gamma = 1, rho, priors, noiseFloor = true, seed = 0 }) => {
  if (!Array.isArray(priors) || priors.length === 0)
    throw new TypeError("candidates: prior-augmented needs at least one received prior — without one it IS the baseline");
  const layers = [createLayer({ id: "read", tier: "read", order, gamma, alpha })];
  for (const p of priors) {
    const layer = createLayer({ id: p.id, tier: "received", giver: p.giver, order, gamma: 1, alpha });
    layer.train(p.tokens);
    layers.push(layer);
  }
  // A gift's earned share means nothing without something that should earn
  // nothing sitting beside it. See `shuffledGift`.
  if (noiseFloor) layers.push(shuffledGift({ order, alpha, from: priors[0], seed }));
  const belief = createBelief({ layers, rho });
  const id = `candidate:prior-augmented-${priors.length}`;
  return asEmitter(id, belief);
};

/**
 * THE NOISE FLOOR. A gift whose ORDER has been destroyed and whose VOCABULARY
 * has not.
 *
 * Shuffling a real prior's token stream leaves its unigram distribution
 * exactly intact and destroys every sequential regularity above it. So this
 * layer knows precisely as much English word-frequency as its source and
 * precisely nothing about how English words follow one another — which is the
 * right null for the question relevance asks. If a real gift cannot earn more
 * standing than this, then whatever it was contributing was word frequency,
 * and word frequency is something the read text supplies for itself.
 *
 * SEED.md #4, and Amendment I: sensitivity is a property of the (statistic,
 * perturbation) pair. What this perturbation destroys is order. It says
 * nothing about a gift that might be relevant for its vocabulary alone, and it
 * is not licensed to.
 *
 * Seeded and declared, never `Math.random`, so a run is a run.
 */
export const shuffledGift = ({ order, alpha, from, seed = 0 }) => {
  const tokens = [...from.tokens];
  let a = (seed | 0) + 0x6d2b79f5;
  const uniform = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = tokens.length - 1; i > 0; i--) {
    const j = Math.floor(uniform() * (i + 1));
    [tokens[i], tokens[j]] = [tokens[j], tokens[i]];
  }
  const layer = createLayer({
    id: `shuffled:${from.id}`,
    tier: "received",
    giver: `${from.giver} — ORDER DESTROYED BY SHUFFLE, seed ${seed}. A noise floor, not a source.`,
    order,
    gamma: 1,
    alpha,
  });
  layer.train(tokens);
  return layer;
};

/**
 * A reader who knows that two forms can be the same act.
 *
 * The minimal contrast against baseline:markov-k is exact: same order, same
 * alpha, same gamma, same material, read-only. The ONLY difference is that an
 * abstraction is present, so a gain measures exactly one thing — whether
 * backing off through a shared alphabet beats backing off through a shorter
 * surface context.
 *
 * The id carries the abstraction's id, because "candidate:abstracted" would
 * make two runs with different inventories look like one candidate measured
 * twice.
 */
export const abstracted = ({ order, alpha, gamma = 1, abstraction }) => {
  if (!abstraction) throw new TypeError("candidates: abstracted needs an abstraction — without one it IS the baseline");
  const layer = createLayer({ id: "read", tier: "read", order, gamma, alpha, abstraction });
  return asEmitter(`candidate:abstracted-${abstraction.id}`, createBelief({ layers: [layer] }));
};

/**
 * A belief that starts over where the ground is conceded.
 *
 * Written out rather than built on `asEmitter` for one reason that matters:
 * the surprisal fed to the tracker must be computed BEFORE the token is
 * observed. `asEmitter`'s hook fires after, and using it here would hand
 * atmosphere a number that had already seen the arrival it is supposed to be
 * surprised by — leakage into the boundary placement, invisible to every seal
 * downstream because it happens before any commitment exists.
 *
 * `gamma` defaults to 1 (no fading) so every existing caller of
 * `regimeBelief` is unaffected — see `decayedRegimeBelief` below for the
 * gamma < 1 variant, kept as a separate export for the same reason
 * `decayedBelief` throws rather than silently accepting gamma = 1: a
 * candidate that can silently become its own control must not.
 */
export const regimeBelief = ({ order, alpha, gamma = 1, window, draws, tolerance, seed = 0 }) => {
  const belief = plainBelief({ order, alpha, gamma });
  const tracker = createRegimeTracker({ window, draws, tolerance, seed });
  const seen = [];
  let resets = 0;
  const resetAt = [];

  const consume = (tok) => {
    // Causal surprisal: what this token cost the belief that had not yet met
    // it. Read through `probabilityOf` rather than through the full
    // distribution — this runs once per token of the whole material, and
    // materialising a vocabulary-sized object here made the read quadratic.
    const ctx = seen.slice(Math.max(0, seen.length - belief.maxOrder));
    const { p, reserve } = belief.probabilityOf(ctx, tok);
    const mass = p > 0 ? p : reserve;
    const surprisal = mass > 0 ? -Math.log(mass) : -Math.log(Number.MIN_VALUE);

    seen.push(tok);
    belief.readLayer.observe(seen, seen.length - 1);

    const step = tracker.push(surprisal);
    if (step.rezeroed) {
      // REC · Cultivating. A new ambient ground begins here, and for a belief
      // that means the counts start again — the faithful translation of
      // regime-mean's `history.slice(regimeStart)`, which also sees nothing
      // before the boundary.
      belief.readLayer.reset();
      resets++;
      resetAt.push(seen.length);
    }
  };

  return {
    id: gamma === 1 ? "candidate:regime-belief" : `candidate:decayed-regime-belief-g${gamma}`,
    belief,
    prime(tokens) {
      for (const t of tokens) consume(t);
      return this;
    },
    emit({ horizon, conditioning, selection, seed, target }) {
      return emitSequence({ belief, context: seen, horizon, conditioning, selection, seed, target });
    },
    observe(revealed) {
      for (const t of revealed) consume(t);
      return this;
    },
    state: () => ({ observations: seen.length, resets, resetAt: [...resetAt] }),
  };
};

/**
 * Fading AND regime resets at once — mutumorphism-shaped: two processes
 * folding the SAME count structure, each seeing what the other left behind
 * (a reset clears the counts gamma decays; a decayed count is what gets
 * cleared). NOT a minimal contrast against anything, exactly like
 * `decayedPriorAugmented` below — included only so the combined result can be
 * read against `candidate:decayed-belief-g*` and `candidate:regime-belief` in
 * isolation: if it beats both, fading and resetting carry independent
 * information about this material; if it beats neither, one of them was
 * doing nothing the other was not.
 */
export const decayedRegimeBelief = ({ order, alpha, gamma, window, draws, tolerance, seed = 0 }) => {
  if (!(gamma < 1))
    throw new RangeError(
      "candidates: decayed-regime-belief needs gamma < 1 — at gamma = 1 it IS candidate:regime-belief and the contrast is empty",
    );
  return regimeBelief({ order, alpha, gamma, window, draws, tolerance, seed });
};

/**
 * regime-belief's permutation null: the same estimator, forgetting the same
 * NUMBER of times, at positions it was handed.
 *
 * SEED.md #4 in the generative register — what this perturbation destroys is
 * boundary PLACEMENT while holding boundary COUNT fixed, so a gain that
 * survives it is a gain attributable to where atmosphere put the boundaries
 * and to nothing else.
 */
export const boundaryControl = ({ order, alpha, boundaries, id = "candidate:boundary-null" }) => {
  const belief = plainBelief({ order, alpha });
  const pending = [...boundaries].sort((a, b) => a - b);
  const seen = [];
  let cursor = 0;
  let resets = 0;

  const consume = (tok) => {
    seen.push(tok);
    belief.readLayer.observe(seen, seen.length - 1);
    while (cursor < pending.length && pending[cursor] <= seen.length) {
      if (pending[cursor] === seen.length) {
        belief.readLayer.reset();
        resets++;
      }
      cursor++;
    }
  };

  return {
    id,
    belief,
    prime(tokens) {
      for (const t of tokens) consume(t);
      return this;
    },
    emit({ horizon, conditioning, selection, seed, target }) {
      return emitSequence({ belief, context: seen, horizon, conditioning, selection, seed, target });
    },
    observe(revealed) {
      for (const t of revealed) consume(t);
      return this;
    },
    state: () => ({ observations: seen.length, resets }),
  };
};

/**
 * Fading AND gifts at once. NOT a minimal contrast against anything, and
 * included only so a combined result can be read against the two isolated
 * ones: if it beats both, the organs carry independent information; if it
 * beats neither, at least one of them was doing nothing the other was not.
 */
export const decayedPriorAugmented = ({ order, alpha, gamma, rho, priors }) => {
  const layers = [createLayer({ id: "read", tier: "read", order, gamma, alpha })];
  for (const p of priors) {
    const layer = createLayer({ id: p.id, tier: "received", giver: p.giver, order, gamma: 1, alpha });
    layer.train(p.tokens);
    layers.push(layer);
  }
  return asEmitter("candidate:decayed+priors", createBelief({ layers, rho }));
};

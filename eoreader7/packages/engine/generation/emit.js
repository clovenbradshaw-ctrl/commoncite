// eoreader6 · generation/emit — turning a belief into a committed continuation.
//
// One function, and the whole free-running / teacher-forced distinction lives
// in its `conditioning` argument rather than in two nearly-identical functions
// that could drift apart. Which one ran is stamped onto the emission, so an
// emission that has been passed around for a while still knows what it is.
//
// FREE-RUNNING IS THE HARD CASE AND THE DEFAULT NOWHERE. Each step conditions
// on the emitter's own previous choice, so a wrong first word poisons every
// word after it. That compounding is not a defect of the measurement, it is
// the thing being measured: a reader who can finish a sentence is a reader
// whose second guess survives its first. Teacher-forcing hands the truth back
// between steps and quietly deletes exactly that.
//
// ── AN EMISSION IS IMAGINATION, AND IMAGINATION NEEDS NO WITNESS ───────────
//
// This wants stating precisely, because the first cut of this module had it
// wrong in a way that would have made the whole apparatus timid.
//
// SEED.md says the system "may perceive anything. It may speak only of what
// changed the ground." A continuation is NEITHER of those acts. It is not a
// perception — nothing arrived. It is not testimony — nothing is being
// asserted about the material. It is the ground read forward: `nul` builds a
// nothing that already says what would not surprise you, and emitting is
// spending that statement in the direction of travel instead of checking an
// arrival against it. So an emission inherits the ground's status exactly. A
// ground is a construction, not a claim, and neither is this.
//
// The phase rule draws the line already and needs no second mechanism. A KEPT
// ground may be testified from and can no longer be perceived through; an
// unkept one is still in the silence. An emission comes from an unkept ground,
// which is precisely why it is not testimony and precisely why no witness gate
// belongs in front of it. IMAGINATION IS WHAT AN UNKEPT GROUND SAYS.
//
// Consequences, and they are freeing rather than restrictive:
//
//   - A continuation may borrow from received priors as freely as it likes.
//     Drawing on other books is what having read them IS. There is nothing to
//     apologise for in a guess that came from Dracula, and an apparatus that
//     refused to guess unless the guess was locally grounded would be refusing
//     to imagine, which is refusing to do the thing.
//   - `grounded` is therefore a PROVENANCE fact, not a quality judgement. A
//     false there means "the read material alone would not have said this." It
//     does not mean the guess is bad, and it is never a reason not to emit.
//   - Nothing here is scored worse for being imagined. The ledger sees losses
//     and nothing else.
//
// THE ONE PLACE A GUARD IS OWED is the crossing: the moment someone takes an
// imagined continuation and asserts it about the material. That is not a bad
// guess, it is a CATEGORY ERROR — an imagining read back as an observation —
// and it is the only thing `admissibleAsTestimony` below exists to stop. Which
// is why every emission is stamped `register: "imagined"`: so that a
// continuation that has been passed around for a while still knows what kind
// of thing it is, and cannot be quietly re-read as a record of anything.
//
// ATTRIBUTION IS ACCUMULATED, NOT AVERAGED AT THE END. Every step's
// distribution reports how much of its mass came from the read material and
// how much from received priors; the emission carries the running totals and
// the per-step detail. A continuation is `grounded` only if EVERY form in it
// was one the read layer itself supplied — the conjunction, not a mean,
// because a mean would let a fluent stretch of borrowed text launder one
// ungrounded word in the middle of it. That strictness is calibrated for the
// crossing, which is the only thing it gates; it is deliberately NOT applied
// to whether the emission may exist.
//
// Pure: no clock, no randomness, no I/O, no ambient state.

import { isGap, gap } from "../../../nul/index.js";
import { UNSEEN } from "./belief.js";

/**
 * Imagine a continuation of `horizon` forms from `context`.
 *
 * Returns a `sequence` emission ready for `commitPrediction`, or a gap if the
 * belief could not place mass ANYWHERE — no ground at all, not merely a
 * borrowed one. That distinction is the whole of the refusal policy here:
 *
 *   no ground        -> gap. There is nothing to read forward. A generator
 *                       that produces text from no ground is not imagining,
 *                       it is confabulating, and the two differ by whether
 *                       anything was constructed to speak from.
 *   borrowed ground  -> emit, and say so. Imagining out of what you read
 *                       elsewhere is imagination working correctly.
 */
export const emitSequence = ({ belief, context, horizon, conditioning, selection, seed = 0, target = null }) => {
  if (!Number.isInteger(horizon) || horizon < 1) throw new TypeError("emit: horizon must be an integer >= 1");
  if (conditioning !== "free-running" && conditioning !== "teacher-forced")
    throw new TypeError("emit: conditioning must be free-running or teacher-forced, and is never defaulted");
  if (selection !== "mode" && selection !== "sampled")
    throw new TypeError("emit: selection must be mode or sampled, and is never defaulted");
  if (conditioning === "teacher-forced" && (!Array.isArray(target) || target.length < horizon))
    throw new TypeError("emit: teacher-forced conditioning needs the true prefix it is being handed");

  // The one place randomness lives in this apparatus, seeded and declared, on
  // the same footing as `priorContinuationNull` in emergence/surprise.js. It
  // is consulted only when `selection` is "sampled"; a mode emission never
  // advances it, so the two run identically up to the choice rule.
  let a = (seed | 0) + 0x6d2b79f5;
  const uniform = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const steps = [];
  const emitted = [];
  const perStep = [];
  let coversVocabulary = true;
  const attribution = Object.create(null);
  let readMass = 0;
  let receivedMass = 0;
  let allGrounded = true;

  // Only the tail can matter, and carrying more of it would copy a whole
  // book's worth of history once per emitted form.
  const reach = Math.max(0, belief.maxOrder ?? 0);
  let ctx = reach === 0 ? [] : context.slice(Math.max(0, context.length - reach));

  for (let h = 0; h < horizon; h++) {
    const d = belief.distribution(ctx);
    if (isGap(d)) return d;

    steps.push(Object.freeze({ kind: "categorical", probs: d.probs }));
    // Carried forward as a conjunction: one step that did not cover its
    // vocabulary disqualifies the whole emission from routing missing targets
    // to the reserve. See prediction/scoring.js, sequenceLogLoss.
    if (d.covers_vocabulary !== true) coversVocabulary = false;

    const chosen = selection === "mode" ? belief.mode(ctx) : belief.draw(ctx, uniform());
    const form = isGap(chosen) ? null : chosen.form;
    emitted.push(form);
    // GROUNDED MEANS NO GIFT WAS AUDIBLE, not "the read layer knows this word".
    //
    // The earlier definition — every emitted form appears in the read layer's
    // own successors — went vacuous the moment the existence gate landed. The
    // read layer backs off to unigram, so it places mass on every form it has
    // ever met; the gate restricts gifts to exactly those forms; so every
    // emitted form was trivially "grounded" and the crossing could never fire.
    // A gate that cannot refuse is a null of zero width (SEED.md #3).
    //
    // Under the gate a gift can no longer introduce a WORD. What it can still
    // do is change which word gets said, and a continuation whose shape came
    // from Dracula is not testimony about Frankenstein even when every form in
    // it is one Shelley wrote. So the question is provenance of the MASS, and
    // it stays structural — zero versus nonzero, no threshold to tune.
    if (form === null || d.received_mass > 0) allGrounded = false;

    for (const layerId in d.attribution) attribution[layerId] = (attribution[layerId] ?? 0) + d.attribution[layerId];
    readMass += d.read_mass;
    receivedMass += d.received_mass;
    perStep.push({
      read_mass: d.read_mass,
      received_mass: d.received_mass,
      unseen_mass: d.unseen_mass,
      lambda_read: d.lambda_read,
      grounded: form !== null && d.grounded.includes(form),
    });

    // The one line that is the whole distinction.
    const nextForm = conditioning === "free-running" ? form : target[h];
    if (nextForm === null) return gap("no_ground", { reason: "the belief placed nothing it was willing to say", at: h });
    ctx = [...ctx, nextForm];
  }

  const total = readMass + receivedMass;
  return Object.freeze({
    kind: "sequence",
    // What kind of thing this is. Stamped on every emission so a continuation
    // separated from this call site cannot be re-read as a record of anything
    // that happened. There is no other register this module can produce.
    register: "imagined",
    steps: Object.freeze(steps),
    unseen_label: UNSEEN,
    covers_vocabulary: coversVocabulary,
    conditioning,
    selection,
    ...(selection === "sampled" ? { seed } : {}),
    emitted: Object.freeze(emitted),
    // For reading. Never a gate — the gate is `grounded`, which carries no
    // constant and so cannot be tuned.
    attribution: Object.freeze(attribution),
    read_fraction: total > 0 ? readMass / total : 0,
    received_fraction: total > 0 ? receivedMass / total : 0,
    per_step: Object.freeze(perStep),
    grounded: allGrounded,
  });
};

/**
 * THE CROSSING. May this imagining be asserted about the material it was read
 * alongside?
 *
 * This is not a quality gate and must never be used as one. Nothing here says
 * a borrowed continuation is a worse guess — very often it is a better one,
 * which is exactly why a reader who has read widely finishes more sentences.
 * It says only that a guess sourced from elsewhere is not evidence about
 * HERE, and that turning one into the other is a category error rather than an
 * inaccuracy.
 *
 * So the refusal is `unreceived_origin` — the same gap `nul` returns for a
 * ground that cannot cite what it perturbed — and not a low score, because a
 * score would imply the emission had done badly at something. It did not. It
 * was asked to do a different thing than it was made for.
 *
 * Structural, not thresholded, for the same reason everything else in this
 * repo is: a threshold here would be a hand-set constant deciding how much
 * borrowed material is "enough" to disqualify a claim, and there is no
 * principled value for it.
 */
export const admissibleAsTestimony = (emission) => {
  if (!emission || emission.kind !== "sequence")
    return gap("unknown_spec", { reason: "not a continuation" });
  if (emission.register !== "imagined")
    return gap("unknown_spec", { reason: "an emission must declare its register" });
  if (!emission.grounded)
    return gap("unreceived_origin", {
      reason:
        "this continuation contains forms the read material never supplied. It is a legitimate imagining and an inadmissible testimony about this material — the refusal is of the crossing, not of the guess",
      read_fraction: emission.read_fraction,
      received_fraction: emission.received_fraction,
      attribution: emission.attribution,
    });
  return null;
};

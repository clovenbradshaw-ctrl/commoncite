// eoreader6 · generation/standpoint — speak from what is in play, not from
// everything ever read.
//
//   SYN · Link · Making   (Generate · Structure · Figure)
//
// ── THE PROBLEM THIS IS THE ANSWER TO ─────────────────────────────────────
//
// `emitSequence` asks `belief.distribution(ctx)` for every form the reader has
// ever met, at every step. On Heidi at the 75% mark that is a 3,523-form
// distribution built twenty times for one sentence — 70,480 probability
// entries per continuation. A reader consulting its entire memory before each
// word it says.
//
// That is wrong twice over, and the two wrongs have one fix:
//
//   FIDELITY.  Nobody thinks about everything when they talk. Speech comes out
//     of what is currently in play, and reaches back only when the local
//     ground falls silent.
//   CONSTITUTION.  II.8, no averaging of grounds. A distribution over every
//     form ever met IS an average across every standpoint the reader has
//     occupied. It is the same error as inducing one global slot inventory and
//     applying it everywhere — `slots.js` made it on the source axis and this
//     module is the correction on the time axis.
//
// And the convergence test (II.7) is what says the fix is an organ rather than
// an optimisation: the mechanism that makes the reading faithful is the one
// that makes it finish. If those had pointed different ways, one of them would
// be wrong.
//
// ── IT NEEDS NO NEW MECHANISM, WHICH IS THE POINT ─────────────────────────
//
// `loops/surf` already states the doctrine in its own header — "the many
// become one, and are increased by one", and in perishing an occasion becomes
// DATUM FOR THE OCCASION AFTER IT. So the reader's settled past is genuinely
// *received by* its present. Which makes this `belief.js`'s existing layering,
// turned from the SOURCE axis onto the TIME axis, with nothing invented:
//
//   the live wave           tier `read`      this material, here
//   everything behind it    tier `received`  giver: this reader, earlier
//                                            world: `this`
//
// λ is derived from the live ground's own evidence exactly as it always was.
// Where the wave has met this context often the past is inaudible; where it
// has never met it the past is all there is. Nobody chose that and no constant
// governs it.
//
// The past declares `world: "this"`, which exempts it from the existence gate.
// That gate stops a foreign book's `peleg` populating this one; a form this
// same reader met earlier in this same material is of this universe by
// construction and needs no visa. Without the exemption a single self-past
// layer could never satisfy `n >= 2` and the reader could not reach its own
// memory at all.
//
// ── WHAT THIS IS NOT, AND THE MEASUREMENT THAT SAYS SO ────────────────────
//
// SURF AS A CANDIDATE GENERATOR IS REFUTED AND IS NOT BEING RETRIED. Commit
// bba5b29 measured wave-break positions as a selector for which scenes matter,
// at a matched budget, against the spine:
//
//   spine (surprise x presence)   12 candidates   4.01x chance
//   surf w=8                      55 candidates   0.71x chance
//   surf w=12                    110 candidates   0.66x chance
//   surf w=20                    185 candidates   0.69x chance
//
// Every configuration is below chance. That result is about surf used to
// SELECT SIGNIFICANT PAST POSITIONS, and it stands.
//
// This module uses surf for a different question: not "which positions matter"
// but "where does the present end". The boundary of the live wave, not a
// ranking of past waves. The nearest precedent is atmosphere's re-zero, whose
// PLACEMENT cleared a boundary-permutation null on real prose
// (prediction/RESULTS.md: +3,700,838 against a null max of -438,711), so a
// regime-local ground is not a guess on this material. That is a related
// mechanism and not the same one, and it confers no ground here — the scoped
// reader has to earn its own number.
//
// Pure: no clock, no I/O, no randomness of its own.

import { createLayer, createBelief } from "./belief.js";
import { scopedDistribution } from "./settled.js";
import { gap, isGap } from "../../../nul/index.js";

export const CELL = Object.freeze({ op: "SYN", terrain: "Link", stance: "Making" });

/**
 * Which wave is `here` inside?
 *
 * Waves come from `divide(surf(...))` and carry `from`/`to` positions in the
 * material. Returns the wave containing `here`, or a typed gap.
 *
 * A STANDPOINT OUTSIDE EVERY WAVE IS A GAP, NEVER A FALLBACK TO THE WHOLE
 * MATERIAL. Silently widening the scope to everything is precisely the
 * averaged ground this module exists to stop, and it would be invisible in the
 * output — the reader would look scoped and would not be.
 */
export const waveAt = (waves, here) => {
  if (!Array.isArray(waves)) return gap("unknown_spec", { reason: "waves must be a divided ride" });
  if (!Number.isInteger(here) || here < 0) return gap("undeclared", { what: "here" });
  for (const w of waves) if (here >= w.from && here <= w.to) return w;

  // PAST EVERY WAVE'S END, AND THE LAST ONE NEVER PERISHED.
  //
  // surf's units stop short of the material's end — the ride advances by
  // `hop` from `window`, so the final unit closes before the last datum. A
  // standpoint in that tail sits past every `to` while genuinely being inside
  // the ride.
  //
  // The answer is in `divide`'s own vocabulary rather than in a clamp. A wave
  // marked `unfinished` "has not completed": it met nothing it could not hold
  // and the material simply ran out, so it has NOT perished and is still
  // becoming. An occasion that is still becoming is where the present is. So a
  // standpoint past the end belongs to the final wave exactly when that wave
  // is unfinished.
  //
  // If the last wave DID perish, the standpoint is genuinely in no present —
  // the ride closed behind it and nothing has opened since. That stays a gap,
  // because widening to the whole material would be the averaged ground this
  // scoping exists to refuse.
  const last = waves[waves.length - 1];
  if (last && last.perished === "unfinished" && here >= last.from)
    return Object.freeze({ ...last, contains_by: "unfinished — the ride had not closed when the standpoint was taken" });

  return gap("no_ground", {
    reason: "this standpoint falls in no wave — the present has no boundary here, and widening to the whole material would be the averaged ground this scoping exists to refuse",
    here,
    waves: waves.length,
    last_perished: last?.perished ?? null,
  });
};

/**
 * A belief that speaks from the live wave and remembers the rest.
 *
 * `tokens`   the whole material read so far (never beyond `here` — causality
 *            is the caller's to keep and is checked).
 * `here`     the standpoint, in token positions. Declared, never inferred.
 * `from`     where the live wave began. Declared by the caller from a divided
 *            ride, so this module holds no opinion about where presents begin.
 *
 * Returns { belief, scope } or a gap.
 */
export const standpointBelief = ({ tokens, here, from, order, alpha, gamma = 1, pastGamma = 1, rho, seed = 0 }) => {
  if (!Array.isArray(tokens)) throw new TypeError("standpoint: tokens must be an array");
  if (!Number.isInteger(here) || here < 1) throw new TypeError("standpoint: here is declared, never inferred");
  if (!Number.isInteger(from) || from < 0) throw new TypeError("standpoint: the wave's start is declared by the caller");
  if (from >= here)
    return gap("no_ground", { reason: "a live wave with nothing in it cannot be spoken from", from, here });
  if (here > tokens.length)
    throw new RangeError("standpoint: here is past the end of what has been read — a standpoint cannot stand in unread material");

  const live = tokens.slice(from, here);
  const past = tokens.slice(0, from);

  const liveLayer = createLayer({ id: "live", tier: "read", order, gamma, alpha });
  liveLayer.train(live);

  const layers = [liveLayer];
  if (past.length > 0) {
    // The perished occasion, as datum for the one after it. It names its giver
    // like any gift, and the giver is this reader at an earlier standpoint.
    const pastLayer = createLayer({
      id: "perished",
      tier: "received",
      world: "this",
      giver: `this same reader, at the standpoint ending at form ${from} — the perished occasion, datum for the one after it (loops/surf; Whitehead, Process and Reality)`,
      order,
      gamma: pastGamma,
      alpha,
    });
    pastLayer.train(past);
    layers.push(pastLayer);

    // THE PERISHED PAST GETS A NOISE FLOOR, for the same reason every other
    // gift in this repo does, and because leaving it out was a measured
    // defect rather than a theoretical one.
    //
    // With the past as the ONLY received layer, `shares()` returns 1 and the
    // gift takes the whole of `1 - lambda` unearned — no decay, no floor, no
    // measured standing. On Heidi that let 354 forms of Project Gutenberg
    // boilerplate speak at every rare context, and the reader said the
    // publisher's name in the middle of imagined prose.
    //
    // Shuffling the perished material destroys its ORDER and keeps its
    // VOCABULARY exactly, so this layer knows precisely as much word-frequency
    // as the reader's real past and nothing about how that past unfolded. If
    // the real past cannot earn more standing than its own shuffle, what it
    // was contributing was word frequency — and word frequency is something
    // the live ground supplies for itself.
    //
    // Adding it makes `received.length === 2`, which is what puts `rho` in
    // play: relevance now has a forgetting rate and is measured. That is the
    // machinery working rather than a new mechanism.
    const shuffled = [...past];
    let a = (seed | 0) + 0x6d2b79f5;
    const uniform = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(uniform() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const floor = createLayer({
      id: "shuffled:perished",
      tier: "received",
      world: "this",
      giver: `this same reader's past, ORDER DESTROYED BY SHUFFLE, seed ${seed}. A noise floor, not a source.`,
      order,
      gamma: 1,
      alpha,
    });
    floor.train(shuffled);
    layers.push(floor);
  }

  if (layers.length > 2 && !(Number.isFinite(rho) && rho > 0 && rho <= 1))
    throw new TypeError(
      "standpoint: rho is the forgetting rate of relevance and is declared, never defaulted — without it the past's standing is a verdict passed once at the boundary",
    );

  return Object.freeze({
    belief: createBelief({ layers, rho }),
    scope: Object.freeze({
      here,
      from,
      live: live.length,
      past: past.length,
      // Reported so a caller can see how much narrower the reader actually got,
      // rather than trusting that it did.
      live_vocabulary: liveLayer.vocabularySize,
      layers: Object.freeze(layers.map((l) => l.id)),
    }),
  });
};

/**
 * Speak from the standpoint: a continuation drawn from the live ground, which
 * reaches back only where the live ground falls silent.
 *
 * THE MODE IS TAKEN OVER THE LIVE SUPPORT AND THIS IS A DECISION, NOT AN
 * OPTIMISATION. Finding the true argmax over live-plus-settled would require
 * enumerating the settled ground at every step, which is exactly the cost
 * `settled.js` exists to remove. But the reason it is defensible is not that
 * it is cheap: a speaker chooses among what is in play, and reaching past
 * everything in play to retrieve a marginally likelier form from memory is not
 * what saying the next word is. Declared on every emission as
 * `selection_scope`, so nobody reads this as the unscoped mode.
 *
 * REACHING BACK IS COUNTED, and it is the interesting number here. When a
 * sampled draw falls past the live ground's mass, the reader has to consult
 * what it settled — and only then is the settled ground enumerated, for that
 * one step. `reached_back` is how often the present could not supply the next
 * form, which is a reading of the material rather than a statistic about the
 * apparatus: a stretch where the reader keeps reaching back is a stretch its
 * present does not cover.
 */
export const emitScoped = ({
  live,
  settled,
  context,
  horizon,
  selection,
  seed = 0,
  order,
  conditioning = "free-running",
  target = null,
}) => {
  if (!Number.isInteger(horizon) || horizon < 1) throw new TypeError("standpoint: horizon must be an integer >= 1");
  if (selection !== "mode" && selection !== "sampled")
    throw new TypeError("standpoint: selection must be mode or sampled, and is never defaulted");
  // The same distinction emit.js draws, and for the same reason: free-running
  // conditions each step on the emitter's OWN previous choice and
  // teacher-forced hands the true prefix back between steps. They score
  // dramatically differently for reasons that have nothing to do with
  // competence at continuing anything, so which one ran is stamped on the
  // emission rather than inferred.
  if (conditioning !== "free-running" && conditioning !== "teacher-forced")
    throw new TypeError("standpoint: conditioning must be free-running or teacher-forced, and is never defaulted");
  if (conditioning === "teacher-forced" && (!Array.isArray(target) || target.length < horizon))
    throw new TypeError("standpoint: teacher-forced conditioning needs the true prefix it is being handed");

  let a = (seed | 0) + 0x6d2b79f5;
  const uniform = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const reach = Math.max(0, order ?? 0);
  let ctx = reach === 0 ? [] : context.slice(Math.max(0, context.length - reach));
  const emitted = [];
  const steps = [];
  let reachedBack = 0;

  for (let h = 0; h < horizon; h++) {
    const d = scopedDistribution({ live, settled, context: ctx });
    if (isGap(d)) return d;
    // The context is carried ON the step. A scorer needs it to ask the settled
    // ground what it would have placed here, and `order` forms per step is the
    // trade that removes a whole remembered vocabulary per step.
    steps.push(Object.freeze({ ...d, context: Object.freeze([...ctx]) }));

    let form = null;
    if (selection === "mode") {
      let best = -1;
      for (const f in d.live)
        if (d.live[f] > best || (d.live[f] === best && best >= 0 && f < form)) {
          best = d.live[f];
          form = f;
        }
      // The present placed nothing at all here. Only then is memory consulted,
      // and only then is it enumerated.
      if (form === null && settled !== null) {
        reachedBack++;
        const s = settled.enumerate(ctx);
        let best2 = -1;
        for (const [f, p] of s.successors) if (p > best2 || (p === best2 && f < form)) { best2 = p; form = f; }
      }
    } else {
      const u = uniform();
      const total = d.live_mass + d.settled_mass;
      if (!(total > 0)) return gap("no_ground", { reason: "every share this standpoint held was unplaced", at: h });
      const threshold = u * total;
      let acc = 0;
      for (const f in d.live) {
        acc += d.live[f];
        if (acc >= threshold) { form = f; break; }
      }
      if (form === null && settled !== null) {
        // The draw fell past everything in play. Reach back — and pay the
        // enumeration for this one step only.
        reachedBack++;
        const s = settled.enumerate(ctx);
        let sTotal = 0;
        for (const [, p] of s.successors) sTotal += p;
        if (sTotal > 0) {
          const t2 = ((threshold - d.live_mass) / d.settled_mass) * sTotal;
          let acc2 = 0;
          for (const [f, p] of s.successors) {
            acc2 += p;
            if (acc2 >= t2) { form = f; break; }
          }
        }
      }
    }

    if (form === null) return gap("no_ground", { reason: "neither the present nor what it settled would say anything", at: h });
    emitted.push(form);
    // The one line that is the whole distinction — the same shape emit.js has.
    const nextForm = conditioning === "free-running" ? form : target[h];
    ctx = [...ctx, nextForm].slice(-Math.max(1, reach));
  }

  return Object.freeze({
    // A DIFFERENT KIND, deliberately. `sequence-log-loss` reads a materialised
    // probs object per step and would silently price every remembered form at
    // the floor here. Declaring the kind is what makes the scorer refuse
    // rather than mis-score — see prediction/scoring.js, scopedSequenceLogLoss.
    kind: "sequence-scoped",
    register: "imagined",
    // TRUE BY CONSTRUCTION, and asserted rather than assumed. Both grounds
    // back off to order 0, whose context is empty and whose successor table
    // therefore holds every form that ground has ever met. So a form absent
    // from a scoped step is genuinely UNMET by both, which is the only thing
    // that makes routing it to the reserve honest — see prediction/scoring.js
    // on the loophole this condition exists to close.
    covers_vocabulary: true,
    selection,
    conditioning,
    selection_scope: "live-support — the mode is over what is in play, never over everything remembered",
    emitted: Object.freeze(emitted),
    // Each step carries the CONTEXT it was taken at — at most `order` forms —
    // so a scorer can query the settled ground without the emission having to
    // carry a copy of it. That trade is the whole point: `order` forms per
    // step instead of the whole remembered vocabulary per step.
    steps: Object.freeze(steps),
    settled: settled === null ? null : Object.freeze({ hash: settled.hash, at: settled.at }),
    reached_back: reachedBack,
    horizon,
  });
};

/**
 * How much did scoping actually narrow the reader?
 *
 * Reported rather than assumed, because "speak from what is in play" is a
 * claim about a number and the number is cheap to check. If the live
 * vocabulary is nearly the whole vocabulary, the wave is not a present, it is
 * the material with extra steps — and every downstream result would be the
 * unscoped one wearing a scoped name.
 */
export const scopeReport = ({ tokens, here, from }) => {
  const whole = new Set(tokens.slice(0, here));
  const live = new Set(tokens.slice(from, here));
  return Object.freeze({
    whole_vocabulary: whole.size,
    live_vocabulary: live.size,
    narrowed_to: whole.size > 0 ? live.size / whole.size : 1,
    live_forms: here - from,
    past_forms: from,
  });
};

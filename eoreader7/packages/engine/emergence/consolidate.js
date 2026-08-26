// eoreader6 · emergence/consolidate — the disciplined re-read of accumulated
// material, at the Pattern grain, run more than once.
//
// Challenge #13 (scripts/adversarial/challenge-13-consolidation-dreaming-
// drift.mjs) asked a real question this repo had never built a mechanism to
// answer: could repeated "dreaming"/consolidation cycles over the SAME
// accumulated material narrow what the reader believes, cycle over cycle,
// worse than the biological analogue because ingestion here is already
// salience-gated? The adversarial script found no mechanism to drive at all.
// This is that mechanism, built from organs that already existed and were
// already safe: paradigm.js's REC·Pattern trigger discipline was probed
// adversarially first (a non-gap `{refused: false, paradigm: [...]}` result
// object, dressed up as a trigger) and verified, empirically, to already be
// refused — `rezeroParadigm` rejects it with `no_rezero_trigger` because
// `isGap` is a Symbol-tagged check (nul/index.js), not a structural guess at
// shape. Nothing in paradigm.js needed to change for this file to be safe.
//
// AN ORCHESTRATOR, NOT A NEW ORGAN. Every judgement here already belongs to
// induceKinds (the induction itself), refuseParadigm (DEF·Pattern), and
// rezeroParadigm (REC·Pattern). This file adds no new one, and — the same
// standing packages/host/sing.js already takes for the same reason (its own
// header: "it claims none on the operator grid and is not in the ORGANS
// roster") — claims no cell and registers nowhere.
//
// ONE CYCLE PER CALL, NEVER A LOOP. consolidate() does not decide how many
// times to run, on what timer, or against what schedule — that is a hosting
// question this file refuses to answer, the same way REC is never a default
// (rezeroParadigm's own comment). A caller that wants repeated cycles calls
// this repeatedly, feeding each call's returned `paradigm` back in as the
// next call's input — each call independently disciplined: the paradigm
// this cycle received is tested against the records this cycle received,
// and re-zero fires only on a measured unravel, never on having been called
// before.
//
// WHY REPEATED CALLS DO NOT NARROW ANYTHING ON STATIC MATERIAL, MEASURED
// (see conformance/consolidation.test.js): on a corpus that genuinely never
// changes between cycles, a paradigm induced from that exact corpus already
// places it — that is what induction means — so refuseParadigm reports
// "holds" and consolidate() is a true no-op from the second cycle on. Not
// "shrinks slowly," not "drifts": nothing happens, because nothing NEW
// arrived to react to. Narrowing would require re-inducing from a SHRUNKEN
// view of the material, and nothing in this orchestration ever does that —
// every induceKinds call here reads the same `records` the caller handed
// in, in full, every time.
import { isGap } from "../../../nul/index.js";
import { induceKinds } from "./kinds.js";
import { refuseParadigm, rezeroParadigm } from "./paradigm.js";

/**
 * One consolidation cycle.
 *
 * `records` — the full accumulated material this cycle reads, in full,
 * exactly as the caller holds it. `opts` — the same declared induction
 * numbers refuseParadigm/rezeroParadigm/induceKinds already require
 * (population, minPrevalence, minKindSize, permutations, quantile, seed,
 * reseeds), forwarded verbatim, nothing defaulted here either.
 *
 * `paradigm`, when supplied, is the kind array a PREVIOUS cycle returned
 * (or any other real induceKinds output) — the paradigm currently believed,
 * about to be tested against `records`. Omit it (or pass `null`) for the
 * first cycle, when there is nothing yet to test: this cycle only
 * establishes a paradigm, the same way the first observation of any tier in
 * this codebase is a typed gap rather than a comparison against nothing
 * (nul/index.js's `no_ground`) — except here establishing a first paradigm
 * is itself a normal, ungapped result, since DEF·Pattern has nothing to
 * refuse yet, not a missing ground to report.
 *
 * Returns `{ consolidated, paradigm, refusal, rezero }`:
 *   consolidated — true only when a genuine re-zero actually happened.
 *   paradigm     — the kind array to feed into the NEXT cycle's `paradigm`.
 *   refusal      — refuseParadigm's own result (null on the first cycle).
 *   rezero       — rezeroParadigm's own result, only when refusal unraveled.
 */
export const consolidate = (records, opts, { paradigm = null } = {}) => {
  if (!paradigm) {
    return { consolidated: false, paradigm: induceKinds(records, opts), refusal: null, rezero: null };
  }

  const refusal = refuseParadigm(paradigm, records, opts);
  if (!isGap(refusal)) return { consolidated: false, paradigm, refusal, rezero: null };

  const rezero = rezeroParadigm(records, opts, { prior: refusal });
  if (isGap(rezero)) return { consolidated: false, paradigm, refusal, rezero };

  // rezeroParadigm already re-induced internally to certify the new paradigm
  // (its own coherenceOf/induceKinds call, same opts) but returns only
  // labels, not kind objects — re-deriving here is the same "call the pure
  // function again rather than thread its internals out" precedent
  // refuseParadigm's own coherenceOf already sets for this file.
  return { consolidated: true, paradigm: induceKinds(records, opts), refusal, rezero };
};

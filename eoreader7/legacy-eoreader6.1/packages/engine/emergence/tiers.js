// eoreader6 · emergence/tiers — MEANING FOLDS ON ITSELF.
//
// Surprise is not computed differently at each altitude. It is the same
// operation — how far did the prior move — applied to priors that surprise
// itself built. Atmosphere, lens and paradigm are not outputs of surprise;
// they ARE priors, and their shift IS surprise at that altitude.
//
//   tier 0  the material          prior: whatever the perceiver reduces to
//   tier 1  ATMOSPHERE            prior: what tier 0's surprises accumulate into
//   tier 2  LENS                  prior: what tier 1's shifts accumulate into
//   tier 3  PARADIGM              prior: what tier 2's shifts accumulate into
//
// (Interpretation × Ground / Figure / Pattern — the terrain column that the
// ladder diagram had entirely unbuilt.)
//
// ── NO PER-TIER NUMBERS. THE LADDER IS THE FOLD ─────────────────────────────
//
// Every tier here is built to the SAME spec. It used to carry a hand-picked
// ladder — gamma 0.75/0.92/0.98 and quantile 0.80/0.85/0.90, six numbers
// chosen at the call site — under the heading "higher tiers forget more
// slowly, so gamma is declared per tier." That ladder was double-counting the
// altitude, and this module's own next paragraph said so:
//
//     "a paradigm shift is not a bigger event — it is an event that survived
//      being surprising all the way up."
//
// A tier's prior decays PER OBSERVATION, and a tier only observes when the
// tier beneath it was surprised. So a tier that observes 43 times across 5705
// frames already holds its prior ~130x longer in MATERIAL terms than the tier
// below it, at identical gamma. Slow forgetting at altitude is a consequence
// of the fold, not a knob — and adding a gamma ramp on top of it was applying
// the same claim twice, the second time by hand.
//
// What is left is derived or declared-by-the-seed, and nothing else:
//
//   gamma     = 1 - 1/window. The tier's present reaches `window` of its own
//               observations, which is what "the reach of the present" means
//               (SEED.md, the three declared numbers). Not a fourth number:
//               it collapses into `window`, the same way the block-size and
//               release-cadence candidates did in SEED.md's "What did not
//               move".
//   draws     = the resolution of testimony. Declared, seed number.
//   seed      = the received stream; the engine holds no randomness.
//   alpha     = 1, add-one smoothing, the same Laplace reserve every other
//               organ here uses — a normalisation, not a tuning.
//
// ── THE GATE IS EXCEEDANCE OF A NULL THIS REPO ALREADY EARNED ───────────────
//
// The bar is gone too, and it did not need replacing with a smaller bar.
// `emergence/surprise.js::priorContinuationNull` — in the SAME package, one
// import away, unused by this file — is exactly the right nothing: "what KL
// would this frame produce if belief were NOT really moving, if the text
// simply continued as the prior expects." Conditional per observation,
// generated from the tier's own belief, never a global constant.
//
// So a shift is a movement that outran EVERYTHING that null could produce —
// `difference()` returning `exceeds_witness` above, at resolution 1/draws.
// There is no quantile to pick, because "outside the whole support" is not a
// percentile, it is SEED.md #8: censored above is surfeit, and the trigger to
// re-zero. `scripts/read-frankenstein.mjs` already reads its windows exactly
// this way ("runs of exceedance ARE the windows — nothing else selects");
// this file reinvented a percentile of its own history instead, and the
// percentile is what the hand-picked quantiles were tuning.
//
// "Runs of exceedance ARE the windows" is this file's own boundary-detection
// claim, and it has a literature: unsupervised text/audio segmentation by
// local statistical departure, without a topic label or trained model — Foote
// (2000)'s self-similarity-matrix novelty for audio, Hearst (1997)'s
// TextTiling lexical-cohesion valleys for text. Cited here, not applied: both
// score a FIXED comparison (a similarity kernel; adjacent-block cohesion)
// against its own local history, where this gate scores KL-divergence
// exceedance against a null GENERATED from the tier's own prior
// (`priorContinuationNull`, above) — a different statistic solving the same
// problem, not an instance of theirs.
//
// This also retires `history`/`minFelt`: the null is rebuilt per observation
// from the prior as it stands, so there is no felt-history buffer to size and
// nothing to declare about how much of its own past a tier keeps.
//
// ── WHAT nul GIVES BACK, AND DID NOT BEFORE ─────────────────────────────────
//
// The gate now goes through `received()` + `difference()`, so four SEED
// clauses are enforced by primitives instead of reimplemented informally:
//
//   #3  a null of zero width is REFUSED. If every continuation the prior can
//       produce scores identically, there is nothing to differ from and the
//       refusal is the result — a tier whose prior has collapsed to a point
//       announces its own sclerosis rather than passing everything.
//   #7  type error before null: "no prior yet" is a typed gap, not the same
//       `false` a real refusal returns.
//   #8  a gap is a result. Censored ABOVE is the shift and the re-zero
//       trigger; censored BELOW is regularity (Amendment II) — the arrival
//       moved belief LESS than the prior's own continuation would have — and
//       is a finding, never a shift.
//   the unit of record: `tier.shifts++` was a counter with no provenance.
//       Shifts are frozen records naming what moved, when, and against what.
//
// WHAT IS STILL NOT A FULL WITNESS RECORD, stated so it is not mistaken for
// done: SEED.md's unit of record is ground + figure + pattern, and a shift
// here has a ground (the continuation null) and a figure (this movement's
// place against it) but NO PATTERN TERM — nothing asks whether the shift
// changed what the tier does next. `witness()` is deliberately NOT called: it
// would refuse, and supplying a third term it did not measure is the
// confabulation the gate exists to prevent.

import { bayesianSurprise, priorContinuationNull } from "./surprise.js";
import { received, difference, isGap, gap } from "../../../nul/index.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// EVA · Lens · Binding — meaning folds on itself; atmosphere, lens, and
// paradigm ARE priors. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Figure" });

/**
 * The forgetting a `window`-wide present implies. Derived, never declared:
 * a prior decayed by gamma each observation retains 1/(1-gamma) observations
 * of effective mass, and "the reach of the present" is what `window` already
 * names. NOT a fourth declared number — it collapses into the third.
 */
export const gammaFor = (window) => 1 - 1 / window;

/**
 * One tier, built to the stack's single spec. There are no per-tier numbers:
 * two tiers differ only in WHERE THEY SIT, and the fold supplies that.
 */
export const createTier = ({ name, window, draws, seed }) => {
  if (!Number.isInteger(window) || window < 2)
    throw new TypeError(`createTier(${name}): window is the reach of the present — declared, never derived from material length`);
  if (!Number.isInteger(draws) || draws < 2)
    throw new TypeError(`createTier(${name}): draws is the resolution of testimony — the finest rank sayable is 1/draws`);
  if (!Number.isInteger(seed))
    throw new TypeError(`createTier(${name}): seed is declared — the engine holds no randomness, it receives one`);

  return {
    name,
    window,
    draws,
    seed,
    gamma: gammaFor(window),
    prior: new Map(),
    total: 0,
    // How novel this tier's arrivals usually are, measured from its own past
    // and decayed at the same gamma as the prior. Feeds the continuation null
    // so the null expects the novelty this material actually delivers. Both
    // are running totals, so the rate is their ratio — no separate estimator.
    novelMass: 0,
    seenMass: 0,
    shiftRecords: [],  // every shift, with its provenance. NOT a counter.
    get shifts() { return this.shiftRecords.length; },
    get novelRate() { return this.seenMass > 0 ? this.novelMass / this.seenMass : 0; },
    observations: 0,
  };
};

/**
 * The whole stack from ONE spec. The caller names the altitudes and declares
 * the seed's own numbers once; nothing per-tier is left to pick.
 */
export const createTierStack = (names, { window, draws, seed }) =>
  names.map((name, i) => createTier({ name, window, draws, seed: seed + i }));

/**
 * Place this movement against what the tier's own prior would have produced.
 *
 * The null is `priorContinuationNull` — synthetic arrivals of the same mass,
 * drawn from the prior itself — so the question is not "is this big" but "did
 * this move belief further than belief continuing as it expected." The
 * samples become a `received()` ground (they are a gift from the tier's own
 * prior, and it names that giver), and `difference()` places or censors.
 */
const placeAgainstContinuation = (tier, surprise, arrivalTotal, alpha) => {
  if (surprise == null)
    return { gap: gap("no_ground", { reason: "the tier's prior was empty; there was no movement to place", tier: tier.name }) };

  const samples = priorContinuationNull(tier.prior, tier.total, arrivalTotal, {
    gamma: tier.gamma,
    alpha,
    draws: tier.draws,
    seed: tier.seed + tier.observations,
    // Measured from this tier's own past, never this arrival's own novelty —
    // a null told how novel the thing it is judging happens to be is not a
    // null of it.
    novelRate: tier.novelRate,
  });
  if (!samples)
    return { gap: gap("no_ground", { reason: "the prior holds no forms to continue from", tier: tier.name }) };

  const g = received({
    samples,
    provenance: {
      giver: `emergence/surprise:priorContinuationNull(${tier.name})`,
      draws: tier.draws,
      observations: tier.observations,
    },
  });
  // #3 — if every continuation scores the same, this null would clear anything.
  if (isGap(g)) return { gap: g };

  const d = difference(surprise, g);
  if (isGap(d)) {
    if (d.gap !== "exceeds_witness") return { gap: d };
    // #8 — magnitude reportable, place not. Above is surfeit and the trigger
    // to re-zero; below is regularity (Amendment II) and never a shift.
    return {
      censored: d.direction,
      support: d.support,
      censoredAt: d.censoredAt,
      reZero: d.direction === "above",
      passed: d.direction === "above",
    };
  }

  // Inside what the prior could have produced by carrying on: real, placed,
  // and not a shift. `rank` is the fraction of null draws at least this large.
  return { rank: d.rank, support: d.support, aperture: d.volume, passed: false };
};

/**
 * Observe at one tier. Returns the surprise (prior movement), where it fell
 * against the tier's own continuation null, and whether it earns propagation.
 */
export const observe = (tier, arrival, { alpha = 1 } = {}) => {
  let arrivalTotal = 0;
  for (const v of arrival.values()) arrivalTotal += v;
  if (arrivalTotal === 0)
    return {
      surprise: null, passed: false, rank: null, censored: null, reZero: false, aperture: null, support: null,
      gap: gap("empty_material", { reason: "nothing arrived at this tier", tier: tier.name }),
    };

  const surprise = tier.total > 0
    ? bayesianSurprise(tier.prior, tier.total, arrival, arrivalTotal, { gamma: tier.gamma, alpha })
    : null;

  // ── the witness gate, against the prior AS IT STANDS ──────────────────────
  // Measured before the arrival is folded in: a movement placed against a
  // prior that has already absorbed it is measuring itself.
  const placed = placeAgainstContinuation(tier, surprise, arrivalTotal, alpha);

  // How much of THIS arrival was new, counted against the prior as it stood
  // when the gate ran. Folded in only afterwards, so the rate this arrival was
  // judged against is strictly the rate its predecessors established.
  let novelNow = 0;
  for (const [k, c] of arrival) if (!tier.prior.has(k)) novelNow += c;
  tier.novelMass = tier.novelMass * tier.gamma + novelNow;
  tier.seenMass = tier.seenMass * tier.gamma + arrivalTotal;

  // ── advance: EVERY form decays, not only the arriving ones ────────────────
  // Decaying the total while leaving absent forms untouched stops the
  // distribution summing to 1 and drives KL negative. Fixed twice in this
  // repo already; asserted in conformance so it cannot recur silently.
  for (const [k, w] of tier.prior) tier.prior.set(k, w * tier.gamma);
  tier.total *= tier.gamma;
  for (const [k, c] of arrival) {
    tier.prior.set(k, (tier.prior.get(k) ?? 0) + c);
    tier.total += c;
  }
  tier.observations++;

  const passed = placed.passed === true;
  if (passed) {
    // What replaces `shifts++`. A shift that cannot say what moved, when, and
    // against what, is a number claiming to be testimony.
    tier.shiftRecords.push(
      Object.freeze({
        at: tier.observations,
        tier: tier.name,
        surprise,
        rank: placed.rank ?? null,
        censored: placed.censored ?? null,
        support: placed.support,
        reZero: placed.reZero === true,
        forms: Object.freeze([...arrival.keys()]),
        ground: Object.freeze({
          giver: `emergence/surprise:priorContinuationNull(${tier.name})`,
          draws: tier.draws,
          gamma: tier.gamma,
        }),
      }),
    );
  }

  return {
    surprise,
    passed,
    rank: placed.rank ?? null,
    censored: placed.censored ?? null,
    reZero: placed.reZero === true,
    aperture: placed.aperture ?? null,
    support: placed.support ?? null,
    gap: placed.gap ?? null,
  };
};

/**
 * A stack of tiers, folded. One observation enters at tier 0; each tier that
 * is moved past its own gate hands ITS arrival upward, so a tier only ever
 * sees what genuinely disturbed the one below it.
 *
 * Returns the per-tier result, so a caller can ask "what shifted, and how
 * high did it reach" — the altitude a passage reaches IS its significance,
 * and nothing separate needs to score it.
 */
export const foldThrough = (tiers, arrival, { alpha = 1 } = {}) => {
  const results = [];
  const carried = arrival;

  // The SAME evidence rises, and every tier judges it to the SAME spec. What
  // differs is only how much has already been filtered out beneath: evidence
  // reaches a high tier by having disturbed every tier under it, so a paradigm
  // shift is not a bigger event — it is an event that survived all the way up.
  for (const tier of tiers) {
    const r = observe(tier, carried, { alpha });
    results.push({ tier: tier.name, ...r });
    if (!r.passed) break; // nothing to say upward: the ground did not change
  }

  return { results, reached: results.length, top: results[results.length - 1]?.tier ?? null };
};

/** Sanity the decay must satisfy; a tier that fails this has a broken prior. */
export const massIsConsistent = (tier, epsilon = 1e-6) => {
  let sum = 0;
  for (const v of tier.prior.values()) sum += v;
  return Math.abs(sum - tier.total) <= epsilon * Math.max(1, tier.total);
};

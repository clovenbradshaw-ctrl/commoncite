// eoreader6 · engine/ground-floor — the measured minimum-ground floors
// shared by the organs built on nul/index.js's difference()-driven
// ground/observe mechanism (emergence/fold.js, formation/index.js's
// `collapse`, loops/turn.js's `buildAt`, and loops/atmosphere.js's
// `readAtmosphere` and `createRegimeTracker` — two call sites in one file),
// plus the two floors that were investigated under the same question and
// found to be genuinely, not accidentally, different.
//
// Before this module existed, the difference-mechanism floor was five
// separate hand-written `MIN_GROUND` literals across four files. When the
// true floor needed to move (`3 * window` -> `10 * window`, after
// scripts/turn-fold-formation-min-ground-real-text-calibration.mjs found
// real-text drift an earlier iid-noise-only calibration couldn't see), that
// move took three separate PRs (#36, #38, #39) to propagate by hand, and
// each PR had to re-investigate which of the lookalike guards actually
// shared the vulnerability. This module doesn't replace that investigation
// — the calibration writeups stay at each organ's own call site, as the
// evidentiary record that THIS organ's own exposure to the defect was
// checked directly, on its own material, rather than inferred from a
// sibling's result. That is weaker than full statistical independence
// between writeups: fold.js's and turn.js's own calibration runs reused
// atmosphere.js's negative-control parameter sets rather than deriving
// fresh ones (see turn.js's retained call-site comment), so treat the
// writeups as "this organ was individually run," not "each writeup is an
// independent reconfirmation from scratch." This module just makes the
// number itself a single, importable fact instead of a copy-pasted one, so
// the next time the floor needs to move, it moves once.
//
// The three floors below are NOT interchangeable and must stay separately
// named. GROUND_FLOOR_DIFFERENCE guards a real statistical defect
// (near-degenerate nulls on too little material) shared by the
// difference()-driven organs above. TIME_PATTERN_FLOOR and
// CANDIDATE_TRUST_FLOOR only coincidentally resemble an earlier, superseded
// value of GROUND_FLOOR_DIFFERENCE — each was investigated on its own terms
// and found to need a DIFFERENT floor, for reasons specific to its own
// organ. Do not "fix" either of them by raising it to match
// GROUND_FLOOR_DIFFERENCE — see each export's own comment for why.

/**
 * The floor every `difference()`-driven organ shares. MEASURED at
 * `10 * window` — see emergence/fold.js's `MIN_GROUND` call site for the
 * full calibration writeup
 * (scripts/turn-fold-formation-min-ground-real-text-calibration.mjs §2) and
 * loops/atmosphere.js's own call site for the paired `causalSurprisalSeries`
 * gamma-fix writeup (scripts/causal-surprisal-gamma-calibration.mjs §2) —
 * two writeups, not two independent channels: fold.js/turn.js's run reused
 * atmosphere.js's own negative-control parameter sets rather than deriving
 * separate ones, so read them as one investigation applied at two organs,
 * not a second confirmation from scratch. This module intentionally does
 * not re-paraphrase either: read them there, not here, so there is exactly
 * one place each organ's own provenance can go stale, and exactly one place
 * the shared VALUE lives.
 */
export const GROUND_FLOOR_DIFFERENCE = (window) => 10 * window;

/**
 * loops/time.js's own floor for `pattern()`-based reading-in-time passes —
 * DELIBERATELY not raised to match GROUND_FLOOR_DIFFERENCE. time.js's one
 * production caller (`reduce()` via scripts/aperture-run.mjs) does not carry
 * causalSurprisalSeries's within-ground positional drift, so it was never
 * exposed to the defect GROUND_FLOOR_DIFFERENCE's raise fixed — see time.js's
 * own call site and scripts/time-real-caller-drift-check.mjs, which found
 * raising this floor does not fix that caller's own, separate, still-open
 * real-text instability.
 */
export const TIME_PATTERN_FLOOR = (window) => 3 * window;

/**
 * prediction/candidates.js's `holonGatedRegimeMean` short-regime trust gate
 * — a structurally different guard, not a ground-building floor at all.
 * GROUND_FLOOR_DIFFERENCE refuses to even BUILD a ground; this gate decides
 * whether to trust a proposed regime-boundary reset, which never builds a
 * ground from the short regime alone. See candidates.js's own call site
 * (and eoreader6 PR #38) for why "matches groundFrom's floor" was checked
 * and found wrong twice over.
 */
export const CANDIDATE_TRUST_FLOOR = (window) => window + 2;

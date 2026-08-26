// eoreader6 · loops/time — not grain, not level: TIME. A growing fraction of
// the SAME material, read successively — more of the real thing seen each
// pass, same document, same identity throughout. This is the reader-
// assimilation loop (K passes). Extracted out of what was an unnamed loop
// inside scripts/aperture-run.mjs — same mechanism, now a first-class,
// reusable thing instead of one script's private implementation detail.

import { ground, pattern, volume, isGap } from "../../../nul/index.js";
import { TIME_PATTERN_FLOOR } from "../ground-floor.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// EVA · Paradigm · Tracing — the reader-assimilation loop: a growing fraction
// of the same material. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Pattern" });

// A large prime seed step: reseeds*draws must never equal it, or pattern()'s
// reseeding-null trial silently reconstructs the next pass's own ground —
// a real bug found and fixed this session (see git history).
const SEED_STEP = 104729;

export const timeLoop = ({ reduce, units, passes, window, draws, reseeds }) => {
  if (!Number.isInteger(passes) || passes < 1)
    throw new TypeError("timeLoop: passes is declared, never defaulted — how many growing-fraction reads to take is counted, not chosen");
  if (!Number.isInteger(window) || window < 2)
    throw new TypeError("timeLoop: window is the reach of the present — declared, never derived from material length");
  if (!Number.isInteger(draws) || draws < 2)
    throw new TypeError("timeLoop: draws is the resolution of testimony — the finest rank sayable is 1/draws");
  if (!Number.isInteger(reseeds) || reseeds < 2)
    throw new TypeError("timeLoop: reseeds is the resolution of pattern — declared, never defaulted");

  const results = [];
  let prevGround = null;
  // The PREVIOUS pass's material, retained because pattern()'s null is
  // before's — not after's. Passing the current pass's material made every
  // null draw a same-material sibling of `after` differing only by seed, so
  // `moved` came out a coin landing true about 1/(reseeds+1) of the time
  // whatever the document did. nul now refuses that call outright
  // (incommensurate_extent) instead of quietly answering it.
  let prevMaterial = null;

  for (let p = 0; p < passes; p++) {
    const fraction = (p + 1) / passes;
    const material = reduce(units, { fraction });

    // MINIMUM VIABLE GROUND — the same near-degenerate-null concern
    // loops/atmosphere's `groundFrom` and loops/turn's `buildAt` carry a fix
    // for, re-measured here rather than copied: at `window + 2` elements,
    // `burstiness` (the default statistic) has only 3 candidate sub-window
    // positions, so its bootstrap null comes back too narrow. There this
    // narrowness is read directly by `difference()` against an independent
    // next observation, which is what makes it a false REC/DEF almost by
    // construction. This loop never calls `difference()` — its only use of a
    // ground is `pattern()`, comparing THIS pass's ground to the previous
    // pass's — and pattern()'s own reseeding null (mean + 3·std of
    // reseed-displacement samples, nul/index.js) is built from the SAME
    // narrow-ground machinery over the SAME material, so a narrow ground
    // narrows the null right along with the signal. That mostly — not
    // entirely — cancels the effect.
    //
    // MEASURED, 2026-08-05: comparing `pattern().moved` at the old floor
    // (window+2) against a settled plateau (5*window) on iid noise, 300
    // trials each, `window + 2` is elevated but by far less than
    // difference()'s version of this defect: 7.3% vs 3.7% (window=5,
    // draws=256, reseeds=16, z=1.97), 6.3% vs 2.0% (window=6, draws=96,
    // reseeds=16, z=2.66), 6.7% vs 3.7% (window=12, draws=200, reseeds=5 —
    // scripts/aperture-run.mjs's own production SPEC, z=1.66) — real and
    // significant in two of three parameter sets, borderline in the third.
    // At `3 * window` the same comparison drops to z=0.42/1.01/-0.45 (all
    // non-significant, rates within a point of the plateau) — independently
    // confirming the multiplier atmosphere.js and turn.js also settled on,
    // not assuming it transfers.
    //
    // NOT RAISED to `10 * window` alongside atmosphere.js's, turn.js's, and
    // fold.js's second fix, and this was checked, not assumed — this organ's
    // floor is the one place in the family that stayed a special case rather
    // than following the sync those three share.
    //
    // The mechanism itself is NOT immune to the content-DEPENDENT drift the
    // other three needed the raise for: MEASURED
    // (scripts/turn-fold-formation-min-ground-real-text-calibration.mjs §4)
    // feeding `pattern()` real `causalSurprisalSeries` output directly (Book
    // IX alone, gamma=0.999, no topic shift) produces a false `moved` on up
    // to 28% of trials at floors through `10 * window`, clearing only at
    // `12 * window` for one of the two parameter sets — so "pattern() mostly
    // cancels this," the finding this file's own header once generalized from
    // iid noise alone, does not hold once real drifting material is fed
    // straight in. What actually protects this organ today is the CALLER,
    // not the mechanism: its one production pathway (`reduce`, always
    // text/material.js's `reduce()` via scripts/aperture-run.mjs) builds one
    // FIXED frequency table per pass over that pass's whole read fraction,
    // never causalSurprisalSeries's incrementally-growing one, so a pass's own
    // series carries none of the within-ground positional drift the other
    // three organs' fix addresses.
    //
    // That caller has its OWN, larger, and separate real-text instability —
    // MEASURED (scripts/time-real-caller-drift-check.mjs): `moved` fires on
    // 60-100% of real passes on Book IX and cookery alike, at every parameter
    // set including aperture-run.mjs's own production SPEC — and raising this
    // minimum does not fix it (scripts/time-real-caller-drift-check.mjs's own
    // sweep: 80%->71%->50% from `3*window` to `20*window`, never reaching a
    // healthy baseline before the pass simply runs out of material to build a
    // ground from at all). That instability traces to `reduce()` itself
    // rescoring already-read chunks against a new, non-causal, whole-fraction
    // table every pass — a different organ's defect, out of this fix's scope,
    // and one a MIN_GROUND change here cannot buy back. Left as a named, open
    // question rather than silently patched over. This floor is
    // DELIBERATELY not GROUND_FLOOR_DIFFERENCE — see engine/ground-floor.js's
    // TIME_PATTERN_FLOOR for why raising it to match would not even help.
    const need = TIME_PATTERN_FLOOR(window);
    if (material.length < need) {
      results.push({ pass: p, fraction, gap: { reason: "not enough real material read yet", have: material.length, need } });
      continue;
    }

    const seed = p * SEED_STEP + 7;
    const g = ground({ material, draws, window, seed });
    if (isGap(g)) {
      results.push({ pass: p, fraction, gap: g });
      continue;
    }

    let patternResult = null;
    if (prevGround) {
      const pr = pattern({ before: prevGround, after: g, material: prevMaterial, reseeds });
      patternResult = isGap(pr)
        ? { gap: pr }
        : { moved: pr.moved, opened: pr.opened, displacement: pr.displacement, reseedNull: pr.reseedNull, grewBy: pr.grewBy };
    }

    results.push({ pass: p, fraction, chunks: material.length, aperture: volume(g), pattern: patternResult, ground: g });
    prevGround = g;
    prevMaterial = material;
  }

  return results;
};

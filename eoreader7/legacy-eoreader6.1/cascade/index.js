// eoreader6 · cascade — is there a level structure across SCALES of one
// material, and where does it stop?
//
// The organ exists because of a hard arithmetic wall found by running the
// growth rule on real DNS. Ordinal-pattern statistics need the pattern space
// to be populable, so `patternSpaceAdmissible` requires window! <= slots and
// caps window at 8. On a 1024-point line the real cap is window 6. The
// physically interesting scales of the material it was run on — the Taylor
// microscale at ~19 grid spacings, the integral scale at ~224 — are therefore
// not merely unmeasured but UNREACHABLE, by a factorial, at any draws.
//
// So scale is not reached by widening the present. `window` stays small and
// the MATERIAL is coarsened instead. This keeps the physiology at three
// declared numbers: a coarsened field is new material at a new grain, and
// grain is the giver's declaration, not a fourth resolution the seed forgot.
//
// WHY THIS IS ONLY POSSIBLE WITH A SPECTRUM-PRESERVING NULL.
//
// A box filter manufactures autocorrelation at every lag below its width. Put
// a coarsened figure against a SHUFFLE ground and the shuffle destroys that
// manufactured order while the figure keeps it, so every rung reads "more
// ordered" — and reads it from the filter, not from the flow. That is exactly
// the failure `pattern` records at length below its own definition: a null
// that did not undergo what the figure underwent measures the wrong thing, and
// it fails invisibly and globally rather than visibly and locally.
//
// A box filter's whole effect is spectral — it is a multiplication in
// frequency and nothing else. So a null that preserves the power spectrum
// ALREADY CONTAINS THE FILTER, with no special-casing and nothing to remember
// to do. `phase` is therefore not a convenient choice here, it is the only one
// that makes coarsening legitimate at all, and this organ refuses any pair
// `nul.licensed` has not established.
//
// What the organ can find, and it is three different things:
//
//   above / below   adjacent scales stand in a level relation — one constrains
//                   what the other can do
//   peer            no level between them: the ladder has stopped
//   gap             the relation is not sayable at this resolution
//
// `peer` is the interesting one and is not a failure. A cascade terminates;
// below the dissipation scale there is no next rung to constrain anything, and
// an organ that could only ever report a ladder would manufacture one all the
// way down. SEED.md's holon-level rule already insists on this: "not every
// nesting is a ladder — peer is a first-class, equally valid result."
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS ORGAN HAS NOT JOINED. IT WAITS. Read before using or extending it.
//
// scripts/turbulence-cascade.mjs states, before running, the result that would
// refute it: real DNS must ladder MORE than its own phase-randomised surrogate,
// which matches its power spectrum to floating point and has no cascade. On 16
// JHTDB isotropic1024coarse lines (draws 60, reseeds 12, window 5):
//
//   arm               mean laddered/9   above  below   peer    gap
//   real                   0.50            4      4     29    107
//   phase-surrogate        2.25           10     26     16     92
//   shuffled               0.44            4      3    120     17
//
// The prediction did not merely fail, it came out BACKWARDS. By the growth
// rule (SEED.md: "`peer` or `unstable` means it waits") this organ does not
// join, and it is left here unwired — which the same rule calls refuted, not
// early. That is the correct status and it should not be quietly upgraded.
//
// WHAT THE NUMBER ACTUALLY MEANS, because the scoring was itself wrong.
// 107 of real's 144 relations are gaps: 31 `exceeds_witness` and 18 `unstable`
// per 8 lines, and 37 of 80 RUNGS are censored before any relation is asked.
// So real material's low score is not "no cascade was found." It is "the
// observation left the null's support and could not be placed." Counting that
// as absence of structure is exactly the conflation SEED.md #8 exists to
// forbid — censored below is regularity and must not be mistaken for it. The
// experiment is therefore INCONCLUSIVE about whether a cascade is there, and
// conclusive only that this organ cannot place real turbulence.
//
// The finding underneath is real and worth keeping: at width 1 the phase null
// places real DNS fine — that is the growth-rule pass that admitted `phase`,
// 84/96 lines. Coarsening drives the same statistic OUT of placeable range.
// Whatever carries the arrow in this material is concentrated at the finest
// resolved scales, and a box filter destroys it faster than it destroys the
// spectrum that the null holds fixed.
//
// Two things would have to change before this could be asked again, and
// neither is a tuning: a statistic that stays placeable under coarsening, and
// a scoring rule that reports censoring as its own outcome instead of folding
// it into "not laddered."
// ─────────────────────────────────────────────────────────────────────────────

import { ground, difference, level, isGap, gap, licensed, preserves, PRESERVES, STATISTICS } from "../nul/index.js";

// Occupies no operator cell. This is a top-level measurement organ — a sibling
// of temporality and holon_level, which declare no cells — and its whole act is
// `level`, the third use of the one operation (SEED.md, "not yet earned" no
// longer). It is admitted by the growth rule, never by claiming a cell the
// algebra does not have.

/**
 * Sliding box filter — the top-hat filter of large-eddy simulation, which is
 * what "the field coarsened to scale w" already means in this domain.
 *
 * Sliding, NOT decimating. Decimation would divide the extent by the filter
 * width, so the coarsest rung would be built over a fraction of the material
 * the finest was, and every comparison between them would be an artefact of
 * extent — SEED.md #5, and the same growth artefact `pattern` had to grow its
 * null to defeat. Sliding costs only w-1 samples per rung, and `cascade`
 * truncates every rung to the coarsest one's length so all rungs are built
 * over exactly the same extent.
 */
export const coarsen = (material, width) => {
  if (!Number.isInteger(width) || width < 1) return null;
  if (width === 1) return material.slice();
  if (width > material.length) return null;
  const out = new Array(material.length - width + 1);
  let sum = 0;
  for (let i = 0; i < width; i++) sum += material[i];
  out[0] = sum / width;
  for (let i = 1; i < out.length; i++) {
    sum += material[i + width - 1] - material[i - 1];
    out[i] = sum / width;
  }
  return out;
};

/**
 * The ladder.
 *
 * `widths` are received, never derived. Which scales are worth asking about is
 * a fact about the material's physics — a grid spacing, a Taylor microscale,
 * an integral scale — and deriving them from the series would be the engine
 * inventing its own giver, which SEED.md #1 puts beyond reach.
 *
 * Between adjacent rungs the SAME observation is placed against both rungs'
 * grounds, which is `level`'s contract exactly. The finer rung is the "own"
 * ground and the coarser is the target, so the relation returned reads
 * fine-relative-to-coarse: `below` means the coarse scale's ground could not
 * anticipate the fine scale's figure — the coarse constrains, which is the
 * direction an energy cascade runs.
 */
export const cascade = ({ material, widths, draws, reseeds, window, statistic = "irreversibility", perturbation = "phase", seed = 0 }) => {
  if (!Array.isArray(material) || material.length === 0) return gap("empty_material", {});
  if (!Number.isInteger(draws) || draws < 2)
    return gap("undeclared", { what: "draws", why: "the resolution of testimony is 1/draws and is never a default" });
  if (!Number.isInteger(reseeds) || reseeds < 2)
    return gap("undeclared", { what: "reseeds", why: "level()'s displacement needs a null, and its resolution is never a default" });
  if (!Number.isInteger(window) || window < 2)
    return gap("undeclared", { what: "window", why: "the reach of the present is never derived from material length" });
  if (!Array.isArray(widths) || widths.length < 2)
    return gap("undeclared", {
      what: "widths",
      why: "which scales to ask about is received from the material's physics, never derived from the series",
    });
  if (!licensed(statistic, perturbation))
    return gap("unknown_spec", {
      reason: "this (statistic, perturbation) pair has not been established — Amendment I: a pair is licensed, not a statistic",
      statistic,
      perturbation,
    });
  // A separate refusal, for a separate reason. `irreversibility/shuffle` is
  // fully licensed and still cannot be used here: the licence is about
  // sensitivity, this is about containment. Coarsening manufactures
  // autocorrelation, and only a null that already carries the filter can tell
  // the manufactured order apart from the material's own.
  if (!preserves(perturbation, "spectrum"))
    return gap("unknown_spec", {
      reason:
        "coarsening is a spectral operation, so the null must preserve the spectrum or it never underwent what the figure underwent",
      perturbation,
      preserves: PRESERVES[perturbation] ?? null,
    });

  const sorted = [...widths].sort((a, b) => a - b);
  const widest = sorted[sorted.length - 1];
  if (widest > material.length) return gap("empty_material", { reason: "the coarsest width exceeds the material", widest });

  // One extent for every rung, so a difference between rungs is a difference
  // of SCALE and not of how much material each one happened to keep.
  const extent = material.length - widest + 1;
  if (extent < window + 1) return gap("empty_material", { reason: "coarsening at the widest scale leaves too little material", extent });

  const rungs = [];
  for (const width of sorted) {
    const full = coarsen(material, width);
    if (full === null) {
      rungs.push({ width, gap: gap("unknown_spec", { reason: "not a usable filter width", width }) });
      continue;
    }
    const m = full.slice(0, extent);
    const observed = STATISTICS[statistic](m, { window });
    if (!Number.isFinite(observed)) {
      rungs.push({ width, gap: gap("unknown_spec", { reason: "the statistic could not be formed at this window", window }) });
      continue;
    }
    const g = ground({ material: m, draws, window, statistic, perturbation, seed });
    if (isGap(g)) {
      rungs.push({ width, gap: g });
      continue;
    }
    const d = difference(observed, g);
    rungs.push({
      width,
      material: m,
      observed,
      ground: g,
      placement: isGap(d) ? { censored: d.direction ?? null, gap: d.gap } : { rank: d.rank, volume: d.volume, censored: null },
    });
  }

  // Adjacent rungs only. A relation between scale 1 and scale 224 with nothing
  // in between is not a level structure, it is two measurements — the ladder is
  // the claim, so it is built one step at a time and each step may fail alone.
  const relations = [];
  for (let i = 0; i + 1 < rungs.length; i++) {
    const fine = rungs[i];
    const coarse = rungs[i + 1];
    if (fine.gap || coarse.gap) {
      relations.push({ fine: fine.width, coarse: coarse.width, gap: (fine.gap ?? coarse.gap).gap });
      continue;
    }
    // The null is supplied, never left to level()'s resolution floor: on
    // coarsened white noise the un-nulled floor laddered 4.42 of 5 relations
    // at 600 draws, with the direction a coin flip. See level().
    const lv = level(fine.observed, fine.ground, coarse.ground, { material: fine.material, reseeds });
    relations.push(
      isGap(lv)
        ? { fine: fine.width, coarse: coarse.width, gap: lv.gap }
        : {
            fine: fine.width,
            coarse: coarse.width,
            relationship: lv.relationship,
            displacement: lv.displacement,
            threshold: lv.threshold,
            floor: lv.floor,
            reseedNull: lv.reseedNull,
            nulled: lv.nulled,
          },
    );
  }

  // Where the ladder stops: the first adjacent pair that is `peer` going up.
  // Reported rather than trimmed, because a cascade that terminates and one
  // that was never a cascade look identical in a list of relations and are not
  // the same finding.
  const firstPeer = relations.findIndex((r) => r.relationship === "peer");
  const laddered = relations.filter((r) => r.relationship === "above" || r.relationship === "below").length;

  return Object.freeze({
    extent,
    spec: Object.freeze({ statistic, perturbation, draws, reseeds, window, seed }),
    rungs: Object.freeze(rungs.map((r) => Object.freeze({ ...r, material: undefined }))),
    relations: Object.freeze(relations.map(Object.freeze)),
    laddered,
    terminatesAt: firstPeer === -1 ? null : relations[firstPeer].coarse,
    censoredAt: 1 / draws,
  });
};

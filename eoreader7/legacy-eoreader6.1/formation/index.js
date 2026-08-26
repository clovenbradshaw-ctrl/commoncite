// eoreader6 · formation — the becoming of a thing, in phases.
//
//   emanon    diffuse. Before the collapse: no boundary, no figure, no where.
//             The material is a cloud with a declared reading, and asking it
//             where it is is a type error, not a hard question (SEED.md #7).
//
//   collapse  the cut. One observation is measured against the ground, and if
//             the cloud places it, there is now a figure — a protogon. A
//             censored observation is a result, not a failure: surfeit
//             (direction above) is the seed's named trigger to re-zero, and
//             regularity (direction below) is the floor, not a figure.
//
//   protogon  collapsed, not yet self-sustaining. Definite, bounded, present —
//             but its ground was grown over the material by a reader, not
//             rebuilt by the figure itself. A cut, not a continuity.
//
//   sustain   the holon gate. The growth rule, run on a figure instead of an
//             organ: existence-dependency and possibility-constraint over the
//             cut's own regime, both Born-null-gated. `above` is
//             self-sustaining — the material cannot be without it and it
//             constrains the material. `peer` means it waits, a protogon
//             still. `unstable` is a typed gap, a result and not an error.
//
// The origin clause is enforced here the only way a primitive can enforce it.
// SEED.md #1: "The first ground is received, never derived." A figure whose
// peak value sits beyond everything its settled past could place cannot be
// cut from that past — it reads as surfeit, and the collapse says so, with
// the re-zero trigger the seed names. It collapses against a received ground
// (a gift that names its giver) or against a re-zeroed one, and only then.
//
// The eoreader5 lineage stamped these two words on static referent postures —
// present-but-unnamed, orbited-but-absent. Those are snapshots taken from
// inside this arc: a thing that never collapsed, a thing that collapsed and
// never landed. Nothing is ported; the phases are re-earned here.
//
// Pure: no clock, no randomness, no I/O. Read SEED.md first.

import {
  ground as buildGround,
  difference,
  admissible,
  isGap,
  gap,
  PERTURBATIONS,
} from "../nul/index.js";
import { existenceDependencyTest, possibilityConstraintTest, holonLevelRelation } from "../holon_level/index.js";
import { GROUND_FLOOR_DIFFERENCE } from "../packages/engine/ground-floor.js";

export const PHASES = Object.freeze(["emanon", "protogon", "holon"]);

const isRegime = (r) =>
  r && Number.isInteger(r.start) && Number.isInteger(r.end) && r.end > r.start;

/**
 * The diffuse state. No measurement is spent here — the emanon is a
 * declaration: a body (the material) and a reading (the spec). `firstGround`,
 * when given, is the received first ground (SEED.md #1) and must name its
 * giver; it is checked for admissibility and extent before it is trusted.
 */
export const emanon = ({ material, window, draws, perturbation = "shuffle", firstGround = null } = {}) => {
  if (!Array.isArray(material) || material.length === 0) return gap("empty_material", {});
  if (!Number.isInteger(draws) || draws < 2)
    return gap("undeclared", { what: "draws", why: "the resolution of testimony is 1/draws and is never a default" });
  if (!Number.isInteger(window) || window < 2)
    return gap("undeclared", { what: "window", why: "the reach of the present is never derived from material length" });
  if (!PERTURBATIONS[perturbation]) return gap("unknown_spec", { perturbation });

  if (firstGround != null) {
    const bad = admissible(firstGround);
    if (bad) return bad;
    if (firstGround.extent != null && firstGround.extent !== material.length)
      return gap("incommensurate_extent", { given: firstGround.extent, material: material.length });
  }

  return Object.freeze({
    phase: "emanon",
    material: Object.freeze(material.slice()),
    extent: material.length,
    spec: Object.freeze({ window, draws, perturbation }),
    ground: firstGround,
    figure: null,
    boundary: null,
  });
};

/**
 * The cut. Measures one observation against the ground and, if the cloud
 * places it, returns a protogon. Censored observations come back as the
 * censoring itself — `exceeds_witness` with the ground attached, so the
 * caller can re-zero and try again — because SEED.md #8 says a gap is a
 * result, and the direction of the censoring is the finding.
 *
 * The ground is resolved in order of honesty: an explicit `ground` the reader
 * hands in, the emanon's received first ground, or one derived over the
 * material the figure has settled behind (the cut's own past, never the whole
 * thing — a figure measured against the material that contains it is read
 * against its own consequence). Deriving requires something settled to
 * derive from: the first ground is received, never derived (SEED.md #1), and
 * a cut with nothing behind it refuses.
 */
export const collapse = ({ emanon: e, observed, regime = null, ground: cutGround = null, seed = 0 } = {}) => {
  if (isGap(e)) return e;
  if (!e || e.phase !== "emanon")
    return gap("no_ground", { reason: "only an emanon collapses — a protogon or holon has already been cut" });
  if (!Number.isFinite(observed)) return gap("empty_material", { observed });
  if (regime != null) {
    if (!isRegime(regime))
      return gap("undeclared", { what: "regime", why: "a boundary is a place where the cut lands: {start, end}, integers, end > start" });
    if (regime.start < 0 || regime.end > e.extent)
      return gap("undeclared", { what: "regime", why: "a boundary cannot lie outside the material it cuts" });
  }
  if (cutGround != null) {
    const bad = admissible(cutGround);
    if (bad) return bad;
    if (cutGround.extent != null) {
      const commensurate = regime == null
        ? cutGround.extent === e.extent
        : cutGround.extent === e.extent || cutGround.extent === regime.start;
      if (!commensurate)
        return gap("incommensurate_extent", { given: cutGround.extent, material: e.extent, regime });
    }
  }

  let g = cutGround;
  if (g == null && e.ground != null) g = e.ground;
  if (g == null) {
    const settled = regime == null ? e.material : e.material.slice(0, regime.start);
    // MINIMUM VIABLE GROUND — the same defect loops/atmosphere.js's
    // `groundFrom` carries a fix for, measured independently here rather than
    // assumed: this derived ground feeds `difference(observed, g)` a few
    // lines below, the exact difference()-driven mechanism atmosphere.js's
    // fix addresses. At the old floor, `window + 2`, `burstiness` (the
    // default statistic, unchanged here) has exactly 3 candidate sub-window
    // positions regardless of `window`, so the bootstrap null comes back too
    // narrow and an ordinary next observation clears it almost by
    // construction — a false DEF·surfeit `exceeds_witness`/above, not a found
    // one.
    //
    // MEASURED, 2026-08-05: on iid noise, collapsing an ordinary next-window
    // mean (ground and observation drawn from the same iid distribution, so
    // there is no real surfeit to find) against a ground built at the old
    // floor reports spurious surfeit on 24.5% (window=5, draws=256, 200
    // trials) and 16.0% (window=6, draws=96, 200 trials) of trials — the same
    // two parameter sets atmosphere.js's own calibration used. At `3 *
    // window` it falls to 2.5%/1.0%, inside the 15% bar this repo's own
    // CALIBRATION tests hold findings to. Re-measured for this organ's own
    // statistic (burstiness, unchanged) and perturbation (`e.spec.perturbation`,
    // unchanged) rather than copied.
    //
    // RAISED TO `10 * window`, 2026-08-05, alongside atmosphere.js's, turn.js's
    // and fold.js's own second fix, for the same reason fold.js's header gives
    // (this is the same `difference()`-driven mechanism at this organ's own
    // grain): MEASURED
    // (scripts/turn-fold-formation-min-ground-real-text-calibration.mjs §3,
    // same real, single-topic, no-seam Book IX / cookery-recipe fixtures,
    // gamma=0.999) collapsing real causal-surprisal material at `3 * window`
    // falsely reads surfeit on 25% of trials on one of the two negative
    // controls, purely from content-independent drift; 0% from `6 * window`
    // through `16 * window`. `10 * window` sits inside that confirmed-safe
    // plateau and keeps one shared floor across the four organs sharing this
    // mechanism, at no measured cost. The value itself now lives in
    // engine/ground-floor.js's GROUND_FLOOR_DIFFERENCE — this comment stays
    // as the calibration record; change the number there, not here.
    const MIN_GROUND = GROUND_FLOOR_DIFFERENCE(e.spec.window);
    if (regime != null && regime.start < MIN_GROUND)
      return gap("no_ground", {
        reason: "a cut with nothing settled behind it cannot grow a ground; the first one must be received, not derived",
        need: MIN_GROUND,
      });
    g = buildGround({ material: settled, draws: e.spec.draws, window: e.spec.window, perturbation: e.spec.perturbation, seed });
    if (isGap(g)) return g;
  }

  const d = difference(observed, g);
  if (isGap(d)) return Object.freeze({ ...d, ground: g });

  return Object.freeze({
    phase: "protogon",
    figure: Object.freeze({
      observed,
      rank: d.rank,
      support: d.support,
      volume: d.volume,
      regime: regime == null ? null : Object.freeze({ start: regime.start, end: regime.end }),
    }),
    ground: g,
    material: e.material,
    extent: e.extent,
    spec: e.spec,
    sustained: false,
  });
};

/**
 * The holon gate. Runs the level test the way the growth rule runs it — the
 * two Born-null-gated tests over the cut's own regime, combined by
 * `holonLevelRelation`. `above` promotes the protogon to a self-sustaining
 * holon. `peer` leaves it a protogon. `unstable` is returned as the typed gap
 * it is: the two gates disagreed in direction, and that is a finding.
 *
 * A cut with no place cannot be level-tested — a protogon that never landed
 * has no regime to constrain, and sustain refuses rather than guessing.
 */
export const sustain = ({ protogon: p, reseeds } = {}) => {
  if (isGap(p)) return p;
  if (!p || p.phase !== "protogon")
    return gap("no_ground", { reason: "sustain is the protogon gate — an emanon has not been cut and a holon has already sustained" });
  const regime = p.figure && p.figure.regime;
  if (!regime) return gap("no_ground", { reason: "a cut with no place has no self-sustaining claim; level-testing needs a regime" });
  if (!Array.isArray(p.material) || p.material.length < 2) return gap("empty_material", {});
  if (!Number.isInteger(reseeds) || reseeds < 2)
    return gap("undeclared", { what: "reseeds", why: "the resolution of pattern is never a default" });

  const existence = existenceDependencyTest(p.material, regime, {
    draws: p.spec.draws,
    window: p.spec.window,
    reseeds,
  });
  if (isGap(existence)) return existence;
  const constraint = possibilityConstraintTest(p.material, regime, { reseeds });
  if (isGap(constraint)) return constraint;

  const relation = holonLevelRelation(existence, constraint);
  if (relation === "unstable")
    return gap("unstable", { reason: "the two gates disagree in direction — a typed gap, not a level", existence, constraint });
  if (relation === "peer")
    return Object.freeze({ ...p, sustained: false, level: "peer", existence, constraint });

  return Object.freeze({ ...p, phase: "holon", sustained: true, level: "above", existence, constraint });
};

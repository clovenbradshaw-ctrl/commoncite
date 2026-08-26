// eoreader6 · loops/surf — riding the waves of CONCRESCENCE.
//
// Whitehead's process, and the algebra was already shaped like it before
// anyone named it. An occasion begins with the MANY — everything settled
// behind it. Those many grow together into ONE determinate unity. That unity
// reaches SATISFACTION, then PERISHES, and in perishing becomes datum for the
// occasion after it. "The many become one, and are increased by one."
//
//   the many        every difference in the material read so far
//   growing         `ground()` — one distribution built by perturbing them all
//   satisfaction    the ground holds: an arrival it can still place
//   perishing       an arrival it cannot — surfeit, the occasion is complete
//   increased by one  the next ground is grown over strictly more material
//
// THE REGION COMES FIRST. Process and Reality IV: "The concrescence
// presupposes its basic region, and not the region its concrescence." So the
// field is cleared before anything is ridden in it — `clearField` from
// `loops/turn`, ④ SEG · Field · Clearing, the arena established before
// anything is interpreted in it. Deriving the region from where the ride broke
// would invert the dependency, and the first cut of this file did exactly
// that.
//
// GENETIC AND COORDINATE DIVISIBILITY ARE NOT THE SAME DIVISIBILITY, and
// conflating them is the mistake this file exists to avoid:
//
//   "The subjective unity dominating the process forbids the division of that
//    extensive quantum... But the region is, after all, divisible, although in
//    the genetic growth it is undivided."
//
//   genetic     the ride itself. ONE ground, grown cumulatively, never
//               conceded, never cut. `surf` has no code that splits it,
//               and that is not an omission.
//   coordinate  `divide()` — a mode of cutting the ride into standpoints
//               afterward. Legitimate, and it ignores the subjective unity by
//               construction, which Whitehead says in as many words is what
//               dividing does.
//
// AND THE DIVISIONS ARE "MIGHT BE", NEVER "ARE":
//
//   "When we divide the satisfaction coordinately, we do not find feelings
//    which ARE separate, but feelings which MIGHT be separate. In the same
//    way, the divisions of the region are not divisions which are; they are
//    divisions which might be. Each such mode of division of the extensive
//    region yields 'extensive quanta'; also an 'extensive quantum' has been
//    termed a 'standpoint'."
//
// So `divide` takes a MODE, more than one mode is supplied, and two modes
// disagreeing about where the waves fall is not a defect to be tuned away —
// it is the doctrine. Every standpoint this produces is marked `mightBe`,
// because a derived cut hardening into a fact is the failure this whole
// codebase is built against.
//
// WHAT MAKES IT A HORIZON AND NOT A SCAN — the anticipation is stated BEFORE
// the arrival and kept. Everything else here is retrospective: `cultivateVoid`
// is causal by construction, `difference` places an observation in a nothing
// already built, `readAtmosphere` asks after the fact whether a stretch
// exceeded. Nothing anticipates. Merleau-Ponty's Cogito chapter argues that a
// reading which only looks back cannot be a reading at all — "an horizon of
// sense... of other thoughts that I vaguely sense in advance" — and the reason
// it matters is Meno's: how will you look for something you do not know at all
// what it is? The seed already answers that and had never spent the answer.
// You carry forward a nothing that already says what would NOT surprise you,
// and you know you have met something because it fell outside.
//
// ONLY SURFEIT ENDS A WAVE. The correction `loops/atmosphere` paid real
// measurement to learn, repeated here because it is repeatable: burstiness is
// a max-over-windows statistic, so an ordinary real window sits BELOW its
// support almost always. Censored-below is regularity, not encounter (SEED.md
// #8). Flat water is ridden THROUGH. Ending waves on it produced one wave per
// step in the first cut of this file — measured: the reading with no breaks at
// all correctly collapses to a single unfinished ride once flat stops ending
// them, instead of ten spurious ones.
//
// CELL — `EVA · Lens · Binding` (Relate · Interpretation · Figure).
// `loops/atmosphere` is the same domain one grain down, Interpretation ×
// Ground: where does the AMBIENT ground fail. This is Interpretation × Figure:
// one anticipation, one arrival, bound. Surf never concedes a ground and never
// cuts regions in the ride — conceding is atmosphere's act at atmosphere's
// grain, and duplicating it would refute one of the two (CUBE.md).
//
// Pure: no clock, no randomness, no I/O. Read SEED.md first.

import { ground, difference, volume, isGap, gap } from "../../../nul/index.js";
import { clearField, tendField, cultivateField } from "./turn.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// EVA · Lens · Binding — one anticipation, one arrival, bound (header CELL
// note above). Declared, checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Figure" });

/**
 * Three outcomes, and two of them are not the same failure.
 *
 * `met`   — the arrival fell inside the horizon. The ride continues.
 * `broke` — surfeit. What had grown together cannot hold this, and the
 *           occasion is complete. This and only this ends a wave.
 * `flat`  — regularity. More even than any shuffle of what was read, so the
 *           ground cannot place it — but nothing exceeded anything. Ridden
 *           through. A reading that counted `flat` as encounter would report
 *           constant encounter and be wrong in the direction that flatters it.
 */
export const OUTCOMES = Object.freeze(["met", "broke", "flat"]);

/** How a wave ended. `unfinished` is not a kind of perishing — see `divide`. */
export const PERISHED = Object.freeze(["broke", "unfinished"]);

/**
 * The horizon at one position: what the ground grown so far says would not
 * surprise it. Frozen, built from material already arrived only, and carrying
 * no field that names the arrival — at the moment it is made there is no
 * arrival to name.
 */
const anticipate = (at, g) =>
  Object.freeze({ at, reach: Object.freeze([g.samples[0], g.samples[g.samples.length - 1]]), room: volume(g) });

/**
 * Ride the material.
 *
 * The ground is CUMULATIVE and is never conceded: it is grown over everything
 * read so far, which is both Whitehead's datum and Merleau-Ponty's horizon
 * ("in some sense all possible developments are at once present to me"). A
 * reader who threw it away at every break would have no horizon, only a series
 * of fresh starts — and that reader already exists, in `loops/atmosphere`.
 *
 * `seed` is held CONSTANT across steps on purpose. The horizon then differs
 * between steps only because the material differs, so any movement in it is
 * attributable to the reading rather than to the sampler — and it makes the
 * causality invariant checkable: surfing a truncation must reproduce the
 * earlier anticipations exactly, which it would not if anything from later
 * could reach back.
 *
 * `window` and `draws` are two of SEED.md's three numbers. This is not the
 * organ that gets to guess them.
 */
export const surf = ({ material, window, draws, hop = 1, seed = 0, perturbation = "shuffle" }) => {
  if (!Array.isArray(material) || material.length === 0) return gap("empty_material", {});
  if (!Number.isInteger(window) || window < 2)
    return gap("undeclared", { what: "window", why: "the reach of the present is never derived from material length" });
  if (!Number.isInteger(draws) || draws < 2)
    return gap("undeclared", { what: "draws", why: "the resolution of testimony is 1/draws and is never a default" });
  if (!Number.isInteger(hop) || hop < 1) return gap("undeclared", { what: "hop" });

  // ── THE REGION, cleared before anything is ridden in it ────────────────────
  // "The concrescence presupposes its basic region, and not the region its
  // concrescence." The reach-units are the extensive continuum partitioned;
  // the ride happens over them, and coverage is reported because material no
  // unit touches is outside the field and cannot bear a relation at all.
  const units = clearField(material.length, { window, hop });
  const adjacency = tendField(units);
  const coverage = cultivateField(units, material.length);

  const horizon = [];
  const room = [];

  for (const unit of units) {
    const i = unit.start;
    if (i < window) continue; // nothing has settled behind this standpoint yet

    // ① the many grow together — over what has been read, and nothing else
    const g = ground({ material: material.slice(0, i), draws, window, seed, perturbation });
    if (isGap(g)) continue; // not enough has come into being yet: a gap, not a fake step

    // ② the horizon, stated and frozen while the next material is still unread
    const anticipated = anticipate(i, g);

    // ③ the arrival. Commensurate with the ground's own statistic: burstiness
    //    is a max-over-windows, so the comparable quantity is a real windowed
    //    mean, never a raw single value. (Relearned three times in this repo.)
    let sum = 0;
    for (let j = unit.start; j < unit.end; j++) sum += material[j];
    const arrived = sum / window;

    const d = difference(arrived, g);
    const outcome = !isGap(d) ? "met" : d.gap === "exceeds_witness" ? (d.direction === "above" ? "broke" : "flat") : null;
    if (outcome === null) { horizon.push(Object.freeze({ anticipated, arrived, outcome: "gap", result: d })); continue; }

    horizon.push(
      Object.freeze({
        anticipated,
        arrived,
        outcome,
        // A gap is a result: the magnitude is reportable either way, only the
        // place is censored. Both are carried, neither is dropped.
        rank: outcome === "met" ? d.rank : null,
        censoredAt: outcome === "met" ? null : d.censoredAt,
      }),
    );
    room.push(anticipated.room);
  }

  // Never getting on the wave is a gap, not a record with nothing in it. This
  // is what perfectly regular material produces: every ground over it is
  // zero-width, so there was never anything to be surprised by.
  if (horizon.length === 0)
    return gap("degenerate_ground", { reason: "no horizon could be built anywhere in this material", window, draws });

  return Object.freeze({
    /** The determinate basis the ride presupposed, not a result of it. */
    field: Object.freeze({ units: units.length, coverage, adjacencyOf: (i) => adjacency.get(i) ?? [] }),
    /**
     * The genetic process, undivided. One ground, grown cumulatively, never
     * conceded. Nothing here cuts it — to cut it, call `divide`, and know that
     * you are ignoring the subjective unity when you do.
     */
    horizon: Object.freeze(horizon),
    /**
     * The reading's own vital sign, per step: how much room to be surprised in
     * it had. SEED.md calls this the sign of health and forbids it as a gate
     * or a score, so it is neither thresholded nor maximised anywhere here. It
     * is kept because it is the reading's own trace and a trace is material.
     */
    room: Object.freeze(room),
    met: horizon.filter((h) => h.outcome === "met").length,
    broke: horizon.filter((h) => h.outcome === "broke").length,
    flat: horizon.filter((h) => h.outcome === "flat").length,
    spec: Object.freeze({ window, draws, hop, seed, perturbation }),
    provenance: Object.freeze({ giver: "loops/surf", of: `n${material.length}` }),
  });
};

/**
 * Modes of coordinate division. Each yields extensive quanta — standpoints.
 *
 * `surfeit` — cut where the ride broke: what had grown together met something
 *   it could not hold. The division the process itself suggests.
 * `extent` — cut at a fixed extent, ignoring what happened. The division the
 *   region suggests, taking Whitehead at his word that the region's
 *   divisibility is irrelevant to the subjective unity of the concrescence.
 *
 * That these two disagree about where the waves fall is the doctrine, not a
 * defect: "the divisions of the region are not divisions which are; they are
 * divisions which might be."
 */
export const MODES = Object.freeze(["surfeit", "extent"]);

/**
 * Divide the ride coordinately into waves.
 *
 * Every standpoint returned carries `mightBe: true`. It is not decoration: a
 * derived cut hardening into a fact is the failure mode this whole codebase is
 * built against, and CUBE.md records the last time a derived classification
 * was mistaken for one that was found (95.7% of cell assignments survived
 * shuffling the words inside 2,527 paragraphs).
 *
 * ONLY THE PHYSICAL POLE DIVIDES. "But it is only the physical pole of the
 * actual entity which is thus divisible. The mental pole is incurably one...
 * the conceptual feelings have regard to the complete actual entity, and not
 * to the coordinate division in question." So the extent divides and the SPEC
 * DOES NOT: every wave, under every mode, carries the one spec the ride
 * declared, by reference rather than by re-derivation. A division that recomputed
 * its own numbers from its sub-region would be SEED.md #5 — a statistic whose
 * window follows the material — arriving through the back door.
 *
 * SATISFACTION IS `EVA`, AND THAT IS WHY AN UNFINISHED WAVE HAS NONE.
 *
 * Satisfaction is the terminal phase: the occasion has become determinate and
 * is now available as datum for its successors. That is SEED.md's phase rule
 * word for word — "an unkept ground is still in the silence; a kept one has
 * returned and may speak, and can no longer be perceived through" — and
 * CUBE.md has already established that `witness()` succeeding is EVA-shaped:
 * Relate · Interpretation, binding to a claim, never generating one.
 *
 * So `satisfaction` is null on an unfinished wave. Not zero, not the last room
 * value: null. Nothing returned there, so there is nothing to evaluate and
 * nothing may be said from it. The magnitude is still reported, as
 * `roomAtClose` — a gap is a result, and censoring takes the place while
 * leaving the magnitude (SEED.md #8). The first cut of this file reported the
 * last room as `satisfaction` for unfinished waves, which is testimony from a
 * ground that never came back.
 *
 * `opened` follows it. Widening is encounter, narrowing is extraction, and
 * both are patterns — but the comparison needs a satisfaction to compare
 * against, so an unfinished wave gets null rather than a sign it did not earn.
 *
 * The last wave is `unfinished` whenever the material simply ran out. That is
 * not a kind of perishing and it is not silently closed: an occasion that never
 * met anything it could not hold has not completed, and reporting it as a
 * finished wave would be a small lie in the direction of looking done.
 */
export const divide = (reading, { mode = "surfeit", every } = {}) => {
  if (isGap(reading)) return reading;
  const horizon = reading?.horizon;
  if (!Array.isArray(horizon)) return gap("no_ground", { reason: "divide takes a ride; this is not one" });
  if (!MODES.includes(mode)) return gap("unknown_spec", { mode, known: MODES });
  if (mode === "extent" && (!Number.isInteger(every) || every < 1))
    return gap("undeclared", { what: "every", why: "an extent division declares its extent; it is not inferred from the material" });
  if (horizon.length === 0) return Object.freeze([]);

  const waves = [];
  const spec = reading.spec; // the mental pole: one, carried, never re-derived
  const close = (from, to, perished) => {
    const first = horizon[from].anticipated;
    const last = horizon[to].anticipated;
    waves.push(
      Object.freeze({
        from: first.at,
        to: last.at,
        steps: to - from + 1,
        rode: horizon.slice(from, to + 1).filter((h) => h.outcome === "met").length,
        through: horizon.slice(from, to + 1).filter((h) => h.outcome === "flat").length,
        roomOpen: first.room,
        // EVA, and only from a ground that returned. See the note above.
        satisfaction: perished === "broke" ? last.room : null,
        roomAtClose: last.room, // the magnitude, reported either way
        opened: perished === "broke" ? last.room > first.room : null,
        perished,
        mode,
        mightBe: true, // a division which might be, never one which is
        spec, // incurably one: the same object every wave under every mode
      }),
    );
  };

  let start = 0;
  for (let k = 0; k < horizon.length; k++) {
    const cut = mode === "surfeit" ? horizon[k].outcome === "broke" : k - start + 1 >= every;
    if (!cut) continue;
    // Only surfeit is a perishing. An extent cut ends a wave without anything
    // having completed, and says so rather than borrowing the word.
    close(start, k, mode === "surfeit" ? "broke" : "unfinished");
    start = k + 1;
  }
  if (start < horizon.length) close(start, horizon.length - 1, "unfinished");
  return Object.freeze(waves);
};

/**
 * The standpoints a division yields: the positions where an occasion actually
 * completed. These are the heres `emergence/fold` projects a universe from.
 *
 * Unfinished waves supply no standpoint. Nothing perished there, so there is
 * nothing yet to project from — and an extent division therefore yields none
 * at all, correctly: cutting the region at a fixed extent does not make an
 * occasion complete.
 */
export const standpointsOf = (waves) => (isGap(waves) ? waves : waves.filter((w) => w.perished === "broke").map((w) => w.to));

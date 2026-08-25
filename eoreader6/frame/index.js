// eoreader6 · frame — the engine's own acts, in the record.
//
// SEED.md, "Not yet earned", names two debts that are one debt:
//
//   No privileged frame — nothing yet puts this module's own acts in the
//   record. The conformance test for it greps for the word "advisory," which
//   is a lint wearing an invariant's clothes.
//
//   Firstness — `received` exists, but nothing enforces that a *first* ground
//   is a received one, because nothing here holds a sequence.
//
// The second sentence says exactly what was missing, and it is one thing:
// NOTHING HERE HOLDS A SEQUENCE. A frame holds one. Once the engine's own acts
// are a sequence, "the first ground is received" becomes checkable rather than
// hortatory, and the engine's own acts become material — which is the whole of
// what a privileged frame is. Both debts are discharged by the same object,
// and neither is discharged by a new mechanism: everything below is `nul`'s one
// operation, pointed at this engine instead of at a document.
//
// ── WHAT THE REFLEXIVE CASE ACTUALLY BUYS ──────────────────────────────────
//
// SEED.md names two deaths. Confabulation is caught structurally and for free
// — the witness gate refuses it. Sclerosis is not:
//
//   Sclerosis — the ground closes, nothing can differ from it, and it becomes
//   an oracle: fluent, sourced, correct, incapable of encounter.
//
// The seed says this is "largely self-announcing," and it is — from OUTSIDE.
// A reader watching the engine go quiet can tell. The engine cannot, because
// two situations are identical from where it stands:
//
//   the material stopped surprising me     nothing to say, and correctly so
//   I stopped being able to be surprised   the death
//
// Both look like `witness` refusing. They are told apart only by asking
// whether the ENGINE'S OWN ground is still moving while the material's has
// gone quiet, and that question cannot be asked without a record of the
// engine's own acts. That is the whole reason this organ exists. It is not
// introspection and it is not a health check — it is the same difference
// against the same kind of nothing, with the engine's own trajectory handed in
// as the material.
//
// ── APERTURE IS THE MATERIAL HERE, AND IT IS STILL NOT A SCORE ───────────────
//
// The scalar this organ projects per act is `volume` — the seed's vital sign,
// the room left to be surprised in. SEED.md is emphatic that it is "Never a
// gate, never a score: the warmth you check for," and that clause is not bent
// here. A score would be a number reported as a verdict without a null. This
// hands the aperture SERIES in as material to be perturbed like any other, and
// the verdict comes out of the same witness gate everything else passes
// through. The gate is `witness`; aperture is what gets measured, not what
// decides.
//
// The order of that series is real — the acts happened in that order — and
// both perturbation families destroy it, so a statistic over it is not vacuous
// by construction (SEED.md #4, and Amendment I: the licence is the pair's, and
// `burstiness/shuffle` is the pair `LICENSED` already carries).
//
// ── WHAT THIS ORGAN DOES NOT CLAIM ─────────────────────────────────────────
//
// Not a self. Not a model of one. `selfLevel` returns `continuous` where the
// level test returns `peer`, and that word is doing the seed's work, not a
// philosopher's: SEED.md's identity clause is "two figures are the same iff
// they make the same difference to the ground. Never by appearance, not even
// in principle." A reader that places an observation where it used to place it
// is, by that clause and only by that clause, the same reader. Nothing here
// knows what it is. It knows whether it still differs the way it differed.
//
// Pure: no clock, no randomness, no I/O, no ambient state. Every call returns
// a NEW frame; nothing is ever mutated in place.
//
// Read SEED.md first. Especially before adding anything.

import {
  ground as buildGround,
  difference,
  witness,
  keep,
  volume,
  admissible,
  burstiness,
  PERTURBATIONS,
  isGap,
  gap,
} from "../nul/index.js";

const shuffle = PERTURBATIONS.shuffle;

// The cells this organ occupies on the operator grid (packages/engine/operators.js).
// Two, because the organ does two things and they are not the same act:
//
//   DEF · Lens · Dissecting    firstness, enforced — refusing an opening act
//                              whose ground names no giver. The gap family
//                              CUBE.md establishes for every `gap()` call site.
//   EVA · Paradigm · Tracing   the reflexive level test and the self-witness —
//                              following the engine's own trajectory through
//                              its recurrences, at Pattern grain.
//
// Declared, checked by conformance.
export const CELLS = Object.freeze([
  Object.freeze({ op: "DEF", grain: "Figure" }),
  Object.freeze({ op: "EVA", grain: "Pattern" }),
]);

// The nine, declared locally rather than imported. A root organ depends on
// `nul` and on nothing else in the tree, and `nul` declares its own cells the
// same way. The grid is the cube's, and the cube is held outside the code.
const OPS = Object.freeze(["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"]);
const GRAINS = Object.freeze(["Ground", "Figure", "Pattern"]);

/**
 * Open a record of the engine's own acts.
 *
 * The frame itself names a giver, for the same reason every ground does: a
 * record of acts is a claim about what happened, and an unattributed one cites
 * nothing. This is not the firstness check — that one is on the first ACT, and
 * lives in `note`.
 */
export const openFrame = ({ giver } = {}) => {
  if (!giver) return gap("unreceived_origin", { reason: "a record of acts names who is keeping it" });
  return Object.freeze({ giver, origin: null, acts: Object.freeze([]), n: 0 });
};

const isFrame = (f) => Boolean(f && Array.isArray(f.acts) && f.giver);

/**
 * Put one of the engine's own acts in the record.
 *
 * AN ACT NAMES ITS ORGAN, on the same line as it names its operator and its
 * grain, and for the same reason: a record of acts is a claim about what
 * happened, and an unattributed one cites nothing. This refusal is the record's
 * own — it asks only that a name is THERE. Whether the name belongs to an organ
 * this engine has earned is the roster's question and is refused a level up, in
 * `emergence/declaration`, because a root organ depends on `nul` and on nothing
 * else in the tree. Anonymity here, imposture there.
 *
 * FIRSTNESS IS ENFORCED HERE AND NOWHERE ELSE, and it could not have been
 * enforced anywhere until something held a sequence. SEED.md #1: "The first
 * ground is received, never derived. A prior is a gift and must name its
 * giver." A constructed ground carries a `spec` and the material it perturbed;
 * a received one carries a `provenance` and nothing else. So the opening act
 * of a frame must carry the second kind, and the check is one line because the
 * distinction was already in the type — what was missing was a first position
 * to check it in.
 *
 * THE ORIGIN IS NOT A MEMBER OF THE TRAJECTORY, and finding out why cost this
 * organ its first working version. A received ground's `volume` is in whatever
 * units its giver's samples are in; a constructed ground's is in the
 * statistic's units over the material. They are not the same quantity and
 * putting them in one series is exactly the averaging SEED.md #5 refuses. It
 * did not fail loudly — the gift's aperture was simply larger than every act's,
 * so a max-over-windows statistic read the GIFT at every window and the
 * engine's whole trajectory became invisible behind its own first ground.
 * Every reader looked identical, and both deaths read as health.
 *
 * So the origin is held apart, as an origin: the gift the sequence chains back
 * to, kept in the record and never averaged into it.
 *
 * The trajectory is commensurate or it is not a trajectory. Same spec (SEED.md
 * #5, and `pattern`'s own refusal) and same extent — a max over windows grows
 * with extent for no reason but extent, so acts over different amounts of
 * material would make the engine look like it was closing whenever it happened
 * to read a shorter stretch. Restrictive on purpose: a type error before a
 * null (SEED.md #7).
 *
 * An act that could not build a ground is not notable. That is not a
 * silencing: the ground's own gap is the result (SEED.md #8), returned to
 * whoever tried, and it belongs in their hands rather than smuggled into this
 * record as a zero. A frame holds acts that happened against a nothing, and
 * only those.
 *
 * Returns a NEW frame. Nothing is mutated; a record a later call can edit is
 * not a record.
 */
export const note = (frame, act) => {
  if (!isFrame(frame)) return gap("no_ground", { reason: "not a frame" });
  if (!act || typeof act !== "object") return gap("empty_material", { reason: "no act" });
  if (!act.op) return gap("undeclared", { what: "op", why: "an act that names no operator is not in the record" });
  if (!act.grain) return gap("undeclared", { what: "grain", why: "an act lands at a grain or it does not land" });
  if (!act.organ) return gap("undeclared", { what: "organ", why: "an act that names no organ is not in the record" });
  if (!OPS.includes(act.op)) return gap("unknown_spec", { op: act.op });
  if (!GRAINS.includes(act.grain)) return gap("unknown_spec", { grain: act.grain });

  const bad = admissible(act.ground);
  if (bad) return bad;

  const entry = { op: act.op, grain: act.grain, organ: act.organ };

  if (frame.origin === null) {
    if (!act.ground.provenance)
      return gap("unreceived_origin", {
        reason: "the first ground of a sequence is received, never derived",
        op: act.op,
      });
    return Object.freeze({
      giver: frame.giver,
      origin: Object.freeze({ ...entry, giver: act.ground.provenance }),
      acts: Object.freeze([]),
      n: 0,
    });
  }

  if (!act.ground.spec)
    return gap("unreceived_origin", {
      reason: "only the first ground is received; a later act cites the material it perturbed",
      op: act.op,
    });

  const first = frame.acts[0];
  if (first) {
    const s = act.ground.spec;
    if (
      s.perturbation !== first.spec.perturbation ||
      s.statistic !== first.spec.statistic ||
      s.draws !== first.spec.draws ||
      s.window !== first.spec.window
    )
      return gap("unknown_spec", { reason: "acts built to different specs were never one trajectory" });
    if (act.ground.extent !== first.extent)
      return gap("incommensurate_extent", {
        reason: "acts over different amounts of material do not share a scale",
        given: act.ground.extent,
        trajectory: first.extent,
      });
  }

  return Object.freeze({
    giver: frame.giver,
    origin: frame.origin,
    acts: Object.freeze([
      ...frame.acts,
      Object.freeze({
        ...entry,
        volume: volume(act.ground),
        extent: act.ground.extent,
        spec: act.ground.spec,
        giver: act.ground.from,
      }),
    ]),
    n: frame.n + 1,
  });
};

/**
 * The engine's own trajectory, as material.
 *
 * One number per act: the room that act had to be surprised in. Their ORDER is
 * the order the acts happened in, which is real and which perturbing destroys
 * — that is what keeps a statistic over this series from being vacuous.
 *
 * Every member names the material it perturbed, and the series as a whole
 * names the gift it began from, for the same reason `nexus` carries its
 * givers: material assembled out of acts is still material, and material with
 * no origin is a claim with no source.
 */
export const selfMaterial = (frame) => {
  if (!isFrame(frame)) return gap("no_ground", { reason: "not a frame" });
  if (frame.origin === null) return gap("unreceived_origin", { reason: "a sequence that never received a first ground" });
  if (frame.n < 2) return gap("empty_material", { reason: "a sequence of one has no trajectory", n: frame.n });
  return Object.freeze({
    material: Object.freeze(frame.acts.map((a) => a.volume)),
    givers: Object.freeze(frame.acts.map((a) => a.giver)),
    ops: Object.freeze(frame.acts.map((a) => a.op)),
    origin: frame.origin.giver,
    n: frame.n,
  });
};

/**
 * Halves of equal extent, taken from the two ends.
 *
 * Equal, because `burstiness` is a max over windows and its expectation rises
 * with extent for no reason but extent — the correction `pattern` carries at
 * length, and the artefact `superject` ran into one grain up. Two halves of
 * different length would place the later reader against a null that grew, and
 * growth would win. From the ENDS rather than by splitting at the midpoint,
 * because on an odd count something has to be dropped and the middle act is
 * the one whose loss costs the least: both halves stay contiguous, and both
 * stay in the order they happened.
 */
const halves = (material) => {
  const h = Math.floor(material.length / 2);
  return [material.slice(0, h), material.slice(material.length - h)];
};

const quantile = (sorted, q) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
};

// The whole shape, not one summary. `pattern` had to learn this: a median is
// too robust to see reseeding at all, so on a quantised statistic it returns
// the same value for every seed and the null comes out zero-width. Same grid,
// same reason.
const GRID = Object.freeze([0.1, 0.25, 0.5, 0.75, 0.9]);
const shapeGap = (a, b) => GRID.reduce((s, q) => s + Math.abs(quantile(a.samples, q) - quantile(b.samples, q)), 0) / GRID.length;
const placeGap = (a, b) => quantile(a.samples, 0.5) - quantile(b.samples, 0.5);

/**
 * Identity by consequence, turned on the engine.
 *
 * Is the reader now the same reader it was? Not by appearance — not the same
 * process, not the same code, not the same ops in the same order. SEED.md's
 * clause is the only one available: "two figures are the same iff they make
 * the same difference to the ground." So: build a ground from the earlier half
 * of the engine's trajectory and a ground from the later half, and ask how far
 * apart they are.
 *
 * WHICH LEAVES THE ONLY HARD QUESTION — FAR APART COMPARED TO WHAT.
 *
 * `nul`'s `level` is the clause as a primitive and was the obvious thing to
 * call here. It is the wrong null for this question, and measuring rather than
 * assuming is what showed it. `level` nulls a displacement by RESEEDING own's
 * ground over own's own material, which captures how much the answer moves on
 * a fresh seed. That is not the counterfactual "are these two halves the same
 * reader" needs. Two halves of one STATIONARY trajectory already sit slightly
 * apart, because they are different stretches of material and not merely
 * different seeds over one stretch — and a null that never splits cannot see
 * that. Measured, on five stationary readers whose aperture plainly does not
 * drift, `level` returned `above` three times and `below` twice, every one of
 * them clearing its own reseeding threshold by three to six times. A coin,
 * reported confidently. Exactly SEED.md #6: "a bad perturbation fails
 * invisibly and globally."
 *
 * So the null destroys the thing actually at issue, which is the ORDER of the
 * trajectory. Shuffle the engine's own acts, split the shuffled series at the
 * same place, and measure the same gap. That is what two halves of this reader
 * look like when the sequence they happened in is worth nothing. A gap that
 * survives it is a real displacement between earlier and later; one that does
 * not is two arbitrary halves of one continuous reader.
 *
 * No new mechanism and no fourth declared number: the perturbation is `nul`'s
 * own `shuffle`, and `reseeds` is already the resolution of pattern.
 *
 * THE SIGN IS OWED THE SAME NULL, and is three-valued for the reason
 * `pattern.opened` is. `opened` here is the direction of the engine's own room:
 * the later half's ground sitting BELOW the earlier half's is the engine
 * closing — aperture declining act over act, which is SEED.md's second death
 * written as a number. Above is still encountering. Inside the null is no
 * direction sayable, which is a result (SEED.md #8) and never a quiet vote.
 *
 * Note what `opened` here is NOT. An earlier version of this organ read the
 * sign off `volume` — the aperture of a ground built over the whole trajectory
 * against one over its first half — and reported a briskly closing reader as
 * `opened: true` on every seed. That number is the trajectory's SPREAD, and a
 * declining series covers more range than its own first half does. The spread
 * of the room is not the size of the room. Kept in the header because it read
 * as health, which is the one direction of error this organ exists to catch.
 */
export const selfLevel = (frame, { draws, window, reseeds, seed = 0 } = {}) => {
  const m = selfMaterial(frame);
  if (isGap(m)) return m;
  if (!Number.isInteger(reseeds) || reseeds < 2)
    return gap("undeclared", { what: "reseeds", why: "the displacement needs a null, and its resolution is never a default" });

  const [earlyMaterial, lateMaterial] = halves(m.material);
  if (earlyMaterial.length < 2)
    return gap("empty_material", { reason: "too few acts to halve", n: m.n });

  const pair = (series, s) => {
    const [a, b] = halves(series);
    const ga = buildGround({ material: a, draws, window, seed: s });
    if (isGap(ga)) return ga;
    const gb = buildGround({ material: b, draws, window, seed: s });
    if (isGap(gb)) return gb;
    return [ga, gb];
  };

  const real = pair(m.material, seed);
  if (isGap(real)) return real;
  const [early, late] = real;

  let shapeNull = 0;
  let placeNull = 0;
  for (let r = 1; r <= reseeds; r++) {
    const scrambled = shuffle([...m.material], seed + r * draws);
    const nulled = pair(scrambled, seed + r * draws);
    if (isGap(nulled)) return nulled;
    shapeNull = Math.max(shapeNull, shapeGap(nulled[1], nulled[0]));
    placeNull = Math.max(placeNull, Math.abs(placeGap(nulled[1], nulled[0])));
  }
  if (shapeNull === 0)
    return gap("degenerate_ground", {
      reason: "destroying the order of these acts moves them not at all: a null of zero width would clear any displacement",
      reseeds,
    });

  const displacement = shapeGap(late, early);
  const place = placeGap(late, early);

  return Object.freeze({
    continuous: displacement <= shapeNull,
    displacement,
    shapeNull,
    opened: placeNull === 0 || Math.abs(place) <= placeNull ? null : place > 0,
    place,
    placeNull,
    censoredAt: 1 / reseeds,
    n: m.n,
    halfExtent: earlyMaterial.length,
    origin: m.origin,
  });
};

/**
 * Testify about itself, under the gate everything else passes through.
 *
 * The engine may perceive anything and may speak only of what changed the
 * ground — including when the thing perceived is the engine. So this builds a
 * figure and a pattern over the engine's own trajectory and hands them to
 * `witness` unchanged. Reusing the gate rather than writing a reflexive one is
 * the claim, not a convenience: if the self-case needed its own gate it would
 * be a second mechanism, and a second mechanism is where an exemption hides.
 *
 * The two answers this organ was built to tell apart come out of it directly:
 *
 *   gap `made_no_difference`   the engine's own ground did not move. Nothing
 *                              sayable about itself — which is the correct
 *                              answer, not a failure, and not yet a death.
 *   record, `opened === false` it moved, and the direction it moved was
 *                              CLOSED. The ground is narrowing. That is
 *                              sclerosis, said from the inside, at the only
 *                              moment it is sayable.
 *   record, `opened === true`  it moved, and widened. Still encountering.
 *   record, `opened === null`  it moved, and the sign is inside its own null.
 *                              No direction sayable — a result (SEED.md #8),
 *                              never a quiet vote for either.
 *
 * `before` is the ground over the earlier half and `after` the ground over the
 * whole trajectory, so the later acts are the growth whose contribution the
 * pattern's own growth-matched null already knows how to subtract.
 */
export const selfWitness = (frame, { draws, window, reseeds, seed = 0 } = {}) => {
  const lv = selfLevel(frame, { draws, window, reseeds, seed });
  if (isGap(lv)) return lv;

  const m = selfMaterial(frame);
  if (isGap(m)) return m;
  const [earlyMaterial] = halves(m.material);

  const before = buildGround({ material: earlyMaterial, draws, window, seed });
  if (isGap(before)) return before;

  const observed = burstiness(earlyMaterial, { window });
  if (!Number.isFinite(observed))
    return gap("unknown_spec", { reason: "the statistic could not be formed at this window", window });

  const fig = difference(observed, before);
  if (isGap(fig)) return fig;

  // Shaped as a pattern because it IS one, at this grain: a difference (the
  // later reader from the earlier) that made a difference (beyond what
  // splitting an order-blind trajectory produces). `witness` is handed it
  // unchanged and applies its own gate. Reusing that gate rather than writing
  // a reflexive one is the claim and not a convenience — a second gate for the
  // self-case is exactly where an exemption would hide, and SEED.md's unpaid
  // debt was named "no privileged frame" for that reason.
  const p = Object.freeze({
    moved: !lv.continuous,
    displacement: lv.displacement,
    reseedNull: lv.shapeNull,
    opened: lv.opened,
    censoredAt: lv.censoredAt,
  });

  const record = witness({ ground: keep(before), figure: fig, pattern: p });
  if (isGap(record)) return record;

  return Object.freeze({
    ...record,
    opened: lv.opened,
    giver: frame.giver,
    origin: m.origin,
    n: m.n,
  });
};

/**
 * Which pole the engine's own recent acts sit at — mindfulness's own
 * position in the doctrine of balance: outside both the calming group and
 * the arousing group, needed to tell which is owed, never itself the
 * correction. (Named `posture` rather than the doctrine's own word for this
 * because that word is exactly what `conformance/seed.test.js`'s "nothing is
 * ported" grep refuses in this file — the naming constraint is part of the
 * record, not an accident.)
 *
 * Three situations, mapped from `selfLevel` — never derived independently,
 * because a second measurement here would put the router inside what it
 * routes:
 *
 *   "agitated"  displaced from itself, and the room WIDENED (`opened: true`)
 *               — still encountering, restlessly. Buddhaghosa's remedy for
 *               this pole is calming, never more stimulation.
 *   "slack"     displaced, and the room NARROWED (`opened: false`) —
 *               sclerosis said from the inside (`selfWitness`'s own words).
 *               The remedy is investigation, never re-zero (SEED.md §1).
 *   "neither"   not displaced at all, OR displaced with no direction
 *               sayable (`opened: null`) — no situation to name, which is a
 *               result (SEED.md #8) and not a quiet default to either pole.
 *
 * HARD CONSTRAINT, TESTED NOT STATED: this is derivable from acts the frame
 * has ALREADY noted, and it causes no new one. `selfLevel` perturbs the
 * trajectory ALREADY held in `frame.acts` to build its own null — that is
 * analysis of what already happened, not a fresh act — and neither call
 * appends to the frame or touches a ground anywhere else. Called twice on
 * the same frame, this returns the same answer and mutates nothing: no
 * version change, no act appended, no volume altered.
 *
 * A GAP IS A RESULT HERE TOO. `selfLevel`'s gaps (too few acts, a null of
 * zero width, an undeclared resolution) are returned unchanged — a
 * situation this organ cannot name is refused, not guessed at.
 *
 * This does not select a remedy. It reports which cell the situation has
 * already put the engine in; choosing what to do about it is the caller's
 * act, one grain up, and logged as one (SEED.md §11 — no reward term, and
 * stance in this system is entailed, not chosen).
 */
export const posture = (frame, { draws, window, reseeds, seed = 0 } = {}) => {
  const lv = selfLevel(frame, { draws, window, reseeds, seed });
  if (isGap(lv)) return lv;

  const shared = { displacement: lv.displacement, shapeNull: lv.shapeNull, place: lv.place, placeNull: lv.placeNull };

  if (!lv.continuous) {
    if (lv.opened === true) return Object.freeze({ situation: "agitated", ...shared });
    if (lv.opened === false) return Object.freeze({ situation: "slack", ...shared });
    return Object.freeze({ situation: "neither", reason: "displaced, but no direction sayable", ...shared });
  }
  return Object.freeze({ situation: "neither", reason: "not displaced from itself", ...shared });
};

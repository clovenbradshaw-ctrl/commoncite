// eoreader6 · surf and fold — riding the waves of concrescence, and projecting
// a universe from a standpoint.
//
// Two organs, one family, because neither is testable alone: a ride nobody
// projects from is a record no one reads, and a fold with no standpoint to
// take is an oracle with a nice name.
//
// The five that carry the most weight, stated up front because they are the
// ones that would silently rot:
//
//   · the horizon is stated before the arrival, and truncating the material
//     proves it — anything leaking back from later material would change an
//     earlier anticipation, and nothing else catches that;
//   · the region is presupposed by the ride, not derived from it;
//   · genetic divisibility is not coordinate divisibility — the ride is never
//     cut, and cutting it is a separate, declared act;
//   · the divisions are "might be", never "are", and two modes disagreeing is
//     the doctrine rather than a defect;
//   · only surfeit ends a wave. Flat water is ridden through.

import { test } from "node:test";
import assert from "node:assert/strict";
import { surf, divide, standpointsOf, OUTCOMES, MODES } from "../packages/engine/loops/surf.js";
import { fold, agree, alternatives, standing, RELATIONS } from "../packages/engine/emergence/fold.js";
import { ground, isGap } from "../nul/index.js";

const W = 6;
const DRAWS = 120;
const swell = (n, phase = 0) => Array.from({ length: n }, (_, i) => 1 + Math.sin((i + phase) * 0.7));

// A reading with shape: even water, a real burst, even water again.
const shaped = [...swell(60), ...Array.from({ length: 20 }, () => 9), ...swell(60, 13)];
// A reading with none: the same thing, everywhere, all the way through.
const uniform = swell(140);
// Nothing to read at all: no ground built over this has any width.
const dead = Array.from({ length: 140 }, () => 1);

const ride = (material, seed = 11) => surf({ material, window: W, draws: DRAWS, hop: 1, seed });

// ── the ride ─────────────────────────────────────────────────────────────────

test("the horizon is stated before the arrival, and truncation proves it", () => {
  // Meno's question is only answerable if the anticipation was already there.
  // Every anticipation is grown from material already arrived, so riding the
  // first 90 of the same material must reproduce the earlier anticipations
  // EXACTLY. If anything from later could reach back this diverges — and no
  // amount of reading the code catches that, because the leak would look like
  // an ordinary index.
  const full = ride(shaped);
  const truncated = ride(shaped.slice(0, 90));
  assert.ok(truncated.horizon.length > 20, "the truncation must be long enough to be worth checking");
  for (let k = 0; k < truncated.horizon.length; k++) {
    assert.deepEqual(
      truncated.horizon[k].anticipated,
      full.horizon[k].anticipated,
      `anticipation ${k} changed when later material was added — the horizon is not causal`,
    );
  }
});

test("an anticipation is frozen and names no arrival", () => {
  const a = ride(shaped).horizon[0].anticipated;
  assert.ok(Object.isFrozen(a));
  assert.deepEqual(Object.keys(a).sort(), ["at", "reach", "room"]);
});

test("the concrescence presupposes its region, and the region covers the arena", () => {
  // "The concrescence presupposes its basic region, and not the region its
  // concrescence." The field is cleared first; material no reach-unit touches
  // is outside it and cannot bear a relation, which is reported rather than
  // silently omitted.
  const r = ride(shaped);
  assert.ok(r.field.units > 0);
  assert.equal(r.field.coverage.complete, true);
  assert.equal(r.field.coverage.uncovered, 0);
  assert.ok(Array.isArray(r.field.adjacencyOf(1)), "contemporaneity between units is available, not assumed");
});

test("the wave breaking and the water going flat are opposite findings", () => {
  // SEED.md #8: censored above is surfeit; censored below is regularity and
  // must not be mistaken for it. Burstiness is a max-over-windows statistic,
  // so `flat` is the ordinary case and `broke` is the event.
  const withBurst = ride(shaped);
  const without = ride(uniform);
  assert.ok(withBurst.broke > 0, "a real burst must break the horizon");
  assert.equal(without.broke, 0, "even water must never be reported as a break");
  assert.ok(without.flat > 0, "and its regularity must still be reported, not dropped");
  for (const h of withBurst.horizon) assert.ok(OUTCOMES.includes(h.outcome) || h.outcome === "gap");
});

test("a gap is a result: censored steps keep their magnitude and lose only their place", () => {
  const censored = ride(shaped).horizon.filter((h) => h.outcome !== "met");
  assert.ok(censored.length > 0);
  for (const h of censored) {
    assert.ok(Number.isFinite(h.arrived), "the magnitude is reportable");
    assert.equal(h.rank, null, "the place is not");
    assert.equal(h.censoredAt, 1 / DRAWS);
  }
});

test("surf declares its numbers and refuses to guess them", () => {
  assert.equal(surf({ material: shaped, draws: DRAWS, hop: 1 }).gap, "undeclared");
  assert.equal(surf({ material: shaped, window: W, hop: 1 }).gap, "undeclared");
  assert.equal(surf({ material: [], window: W, draws: DRAWS }).gap, "empty_material");
});

test("never getting on the wave is a gap, not an empty record", () => {
  const r = ride(dead);
  assert.ok(isGap(r));
  assert.equal(r.gap, "degenerate_ground");
});

// ── the division ─────────────────────────────────────────────────────────────

test("genetic divisibility is not coordinate divisibility — the ride is never cut", () => {
  // "The subjective unity dominating the process forbids the division of that
  // extensive quantum... But the region is, after all, divisible, although in
  // the genetic growth it is undivided." The ride carries one ground and
  // exposes no waves; dividing is a separate, declared act.
  const r = ride(shaped);
  assert.equal(r.waves, undefined, "the ride must not hand out a division it did not make");
  assert.equal(r.heres, undefined);
  assert.ok(Array.isArray(divide(r, { mode: "surfeit" })));
});

test("the divisions are ones which might be, never ones which are", () => {
  for (const mode of MODES) {
    const waves = divide(ride(shaped), { mode, every: 20 });
    assert.ok(waves.length > 0);
    for (const w of waves) {
      assert.equal(w.mightBe, true, `${mode} produced a division claiming to be one which is`);
      assert.equal(w.mode, mode, "and a division must say which mode produced it");
    }
  }
});

test("two modes of division disagree, and that is the doctrine", () => {
  // "Each such mode of division of the extensive region yields extensive
  // quanta." That surfeit and extent cut in different places is Whitehead's
  // claim, not a defect to be tuned away.
  const r = ride(shaped);
  const bySurfeit = divide(r, { mode: "surfeit" });
  const byExtent = divide(r, { mode: "extent", every: 20 });
  assert.notEqual(bySurfeit.length, byExtent.length);
  // And only surfeit completes an occasion: cutting the region at a fixed
  // extent does not make anything perish, so it yields no standpoints.
  assert.ok(standpointsOf(bySurfeit).length > 0);
  assert.equal(standpointsOf(byExtent).length, 0);
});

test("only surfeit ends a wave — flat water is ridden through", () => {
  // The correction loops/atmosphere paid real measurement to learn. A reading
  // with no breaks at all is ONE unfinished ride, not one wave per flat step.
  const r = ride(uniform);
  assert.ok(r.flat > 50, "this material is mostly flat water by construction");
  const waves = divide(r, { mode: "surfeit" });
  assert.equal(waves.length, 1, "flat water ended waves");
  assert.equal(waves[0].perished, "unfinished");
  assert.ok(waves[0].through > 50, "and the flat steps are inside the ride, counted");
  // Nothing perished, so nothing is offered as a standpoint.
  assert.deepEqual(standpointsOf(waves), []);
});

test("satisfaction is EVA: an unfinished wave has none, and does not borrow one", () => {
  // Satisfaction is the phase where the occasion has returned and may be
  // spoken from — SEED.md's phase rule, and CUBE.md's EVA. A wave that never
  // met anything it could not hold has not returned, so it gets null, not the
  // last room value dressed up as a result.
  const waves = divide(ride(shaped), { mode: "surfeit" });
  const last = waves.at(-1);
  assert.equal(last.perished, "unfinished", "the material ran out; nothing perished there");
  assert.equal(last.satisfaction, null, "testimony from a ground that never came back");
  assert.equal(last.opened, null, "and a sign it did not earn");
  // The magnitude survives the censoring; only the place is withheld.
  assert.ok(Number.isFinite(last.roomAtClose));

  for (const w of waves.filter((x) => x.perished === "broke")) {
    assert.ok(Number.isFinite(w.satisfaction));
    // Encounter widens the ground, extraction narrows it. Both are patterns,
    // and a system measuring one without the sign would call extraction health.
    assert.equal(w.opened, w.satisfaction > w.roomOpen);
  }
  for (const w of waves) assert.equal(w.steps, w.rode + w.through + (w.perished === "broke" ? 1 : 0));
});

test("only the physical pole divides — the spec is incurably one", () => {
  // "But it is only the physical pole of the actual entity which is thus
  // divisible. The mental pole is incurably one... the conceptual feelings
  // have regard to the complete actual entity, and not to the coordinate
  // division in question." The extent divides; the numbers do not. A division
  // that recomputed its window from its own sub-region would be SEED.md #5
  // arriving through the back door.
  const r = ride(shaped);
  const specs = new Set();
  for (const mode of MODES) for (const w of divide(r, { mode, every: 20 })) specs.add(w.spec);
  assert.equal(specs.size, 1, "a coordinate division re-derived its own numbers");
  assert.equal([...specs][0], r.spec, "and it must be the ride's own spec, carried, not a copy");
});

test("divide declares its extent and refuses an unknown mode", () => {
  const r = ride(shaped);
  assert.equal(divide(r, { mode: "extent" }).gap, "undeclared", "an extent division does not infer its extent");
  assert.equal(divide(r, { mode: "nope" }).gap, "unknown_spec");
  assert.equal(divide({}, {}).gap, "no_ground");
});

// ── the projection ───────────────────────────────────────────────────────────

test("a fold projects the whole universe from its standpoint, and drops nothing", () => {
  const r = ride(shaped);
  // The earliest surfeit standpoint clears `fold`'s own MINIMUM VIABLE GROUND
  // floor (10 * W) — some of the earlier ones do not, by construction (the
  // burst starts at 60, exactly the floor for W=6).
  const here = standpointsOf(divide(r, { mode: "surfeit" })).find((h) => h >= 10 * W);
  const f = fold({ material: shaped, here, window: W, draws: DRAWS, seed: 11 });
  assert.equal(f.reach.total, f.projection.length);
  assert.equal(f.reach.placed + f.reach.beyond + f.reach.beneath, f.reach.total, "every position is placed or censored");
  assert.ok(f.reach.beyond > 0 && f.reach.beneath > 0);
  for (const p of f.projection) {
    assert.ok(RELATIONS.includes(p.relation));
    assert.ok(Number.isFinite(p.observed), "a censored position still reports its magnitude");
  }
});

test("the ground is causal, the projection is total, and the two are labelled apart", () => {
  // The asymmetry is the point: the ground is grown from the standpoint's
  // actual world only, and the horizon is then placed in a ground that never
  // saw it. That is Merleau-Ponty's "thoughts I vaguely sense in advance", and
  // pooling the two labels would hide it.
  const f = fold({ material: shaped, here: { start: 60, end: 70 }, window: W, draws: DRAWS, seed: 11 });
  // The ground must be the one grown over the actual world and nothing else —
  // checked against a ground built independently over exactly that slice,
  // not against a restatement of what the fold already returned.
  const actualWorld = ground({ material: shaped.slice(0, 60), draws: DRAWS, window: W, seed: 11 });
  assert.equal(f.ground.from, actualWorld.from, "the ground cites more or less than the actual world");
  assert.deepEqual([...f.ground.samples], [...actualWorld.samples]);

  const past = f.projection.filter((p) => p.relation === "past");
  const horizon = f.projection.filter((p) => p.relation === "horizon");
  const contemporary = f.projection.filter((p) => p.relation === "contemporary");
  assert.ok(past.length > 0 && horizon.length > 0 && contemporary.length > 0);
  assert.ok(past.every((p) => p.at + W <= 60));
  assert.ok(horizon.every((p) => p.at >= 70));
});

test("a standpoint is an extensive region; a bare index is one of extent one", () => {
  const asPoint = fold({ material: shaped, here: 60, window: W, draws: DRAWS, seed: 11 });
  assert.deepEqual(asPoint.here, { start: 60, end: 61 });
  const asRegion = fold({ material: shaped, here: { start: 60, end: 70 }, window: W, draws: DRAWS, seed: 11 });
  // Same actual world, so the same ground — the extent changes only what falls
  // WITHIN the standpoint, never what it was grown from.
  assert.deepEqual(asPoint.reach, asRegion.reach);
  assert.ok(asRegion.projection.filter((p) => p.relation === "contemporary").length > asPoint.projection.filter((p) => p.relation === "contemporary").length);
});

test("a standpoint with nothing settled behind it refuses, and names what it would take", () => {
  // SEED.md #1: the first ground is received, never derived. Three independent
  // mechanisms tried to derive an origin and all collapsed at r ≈ 0.974.
  const f = fold({ material: shaped, here: 0, window: W, draws: DRAWS });
  assert.equal(f.gap, "no_ground");
  assert.equal(f.need, 10 * W);
  assert.equal(fold({ material: shaped, window: W, draws: DRAWS }).gap, "undeclared");
  assert.equal(fold({ material: shaped, here: { start: 60, end: 60 }, window: W, draws: DRAWS }).gap, "undeclared");
  assert.equal(fold({ material: shaped, here: 60, draws: DRAWS }).gap, "undeclared");
});

test("identity by consequence: two standpoints are compared on what they project, never on where they sit", () => {
  // SEED.md: "two figures are the same iff they make the same difference to
  // the ground. Never by appearance, not even in principle."
  const r = ride(shaped);
  const heres = standpointsOf(divide(r, { mode: "surfeit" }));
  // The earliest standpoint that clears `fold`'s floor (10 * W) — some
  // earlier ones do not, by construction (the burst starts at 60, exactly
  // the floor for W=6).
  const a = fold({ material: shaped, here: heres.find((h) => h >= 10 * W), window: W, draws: DRAWS, seed: 11 });
  const b = fold({ material: shaped, here: heres.at(-1), window: W, draws: DRAWS, seed: 11 });
  const ag = agree(a, b);
  assert.equal(ag.n, a.projection.length);
  assert.ok(ag.same + ag.split <= ag.n);
  assert.equal(ag.concord, ag.same / ag.n);
  // Censored differences are kept, not dropped (SEED.md #6): one standpoint
  // placing a position while the other calls it surfeit is the most
  // informative signal available.
  assert.ok(ag.split > 0, "the split between standpoints is reported, not discarded");
  assert.equal(ag.standing, "a-in-actual-world-of-b");
});

test("Whitehead's trichotomy is exhaustive, and overlap means contemporaries", () => {
  assert.equal(standing({ start: 10, end: 20 }, { start: 30, end: 40 }), "a-in-actual-world-of-b");
  assert.equal(standing({ start: 30, end: 40 }, { start: 10, end: 20 }), "b-in-actual-world-of-a");
  assert.equal(standing({ start: 10, end: 20 }, { start: 15, end: 25 }), "contemporaries");
});

test("mereology: a coordinate division is foldable as an actual entity, from its own standpoint", () => {
  // "In so far as the objectification of the actual world from this restricted
  // standpoint is concerned, there is nothing to distinguish this coordinate
  // division from an actual entity." A wave needs no conversion to be folded —
  // the part, projected from itself, is a whole.
  const waves = divide(ride(shaped), { mode: "surfeit" });
  const early = waves[0];
  // `>= 10 * W`, not the old `>= 20`: a wave whose `from` sits below fold's
  // own floor would be refused below for the wrong reason (too little ground,
  // not "the part is a whole subject to the same refusals" this asserts).
  const later = waves.find((w) => w.from >= 10 * W);

  const f = fold({ material: shaped, here: later, window: W, draws: DRAWS, seed: 11 });
  assert.deepEqual(f.here, { start: later.from, end: later.to + 1 });
  assert.equal(f.reach.total, f.projection.length);

  // And the part is a whole subject to the same refusals as any other — a wave
  // that opens before anything has settled behind it gets no free pass.
  const refused = fold({ material: shaped, here: early, window: W, draws: DRAWS, seed: 11 });
  assert.equal(refused.gap, "no_ground");
  assert.equal(refused.need, 10 * W);
});

test("decided conditions qualify freedom without banishing it, and the alternatives are countable", () => {
  // "Some actual entities may be either in the settled past, or in the
  // contemporary nexus, or even left to the undecided future, according to
  // immediate decision... These alternatives are represented by the indecision
  // as to the particular quantum of extension to be chosen."
  //
  // Three chosen quanta over one material. A position that gets one relation
  // across all three was settled by the material; one that gets more than one
  // is genuinely open. This is defeasibility from the other end — not "the
  // claim could be revised" as a disclaimer, but the specific positions where
  // the alternatives are still live, enumerated.
  const quanta = [{ start: 60, end: 75 }, { start: 65, end: 95 }, { start: 90, end: 120 }];
  const folds = quanta.map((here) => fold({ material: shaped, here, window: W, draws: DRAWS, seed: 11 }));
  const alt = alternatives(folds);

  assert.equal(alt.n, folds[0].projection.length);
  assert.equal(alt.decided + alt.undecided, alt.n, "every position is either settled or free");
  assert.ok(alt.undecided > 0, "no position was left open — freedom was banished, not qualified");
  assert.ok(alt.decided > 0, "nothing was settled — then the conditions decided nothing");
  for (const p of alt.byPosition) assert.equal(p.free, p.relations.length > 1);
  // The full trichotomy actually occurs: positions that a different quantum
  // would place in the past, the contemporary nexus, or the undecided future.
  assert.ok(alt.byPosition.some((p) => p.relations.length === 3), "the three-way alternative never arose");
  for (const p of alt.byPosition) for (const rel of p.relations) assert.ok(RELATIONS.includes(rel));

  // The contemporary nexus is what one quantum left undecided, and it is
  // counted on the fold itself rather than left as a remark.
  assert.equal(folds[1].undecided, folds[1].projection.filter((p) => p.relation === "contemporary").length);

  assert.equal(alternatives([folds[0]]).gap, "no_ground", "one standpoint has no alternatives to be free between");
  const otherSpec = fold({ material: shaped, here: 80, window: W + 1, draws: DRAWS, seed: 11 });
  assert.equal(alternatives([folds[0], otherSpec]).gap, "unknown_spec");
});

test("two projections built to different specs were never comparable", () => {
  // SEED.md #5. The seed is deliberately NOT part of the check: two standpoints
  // reaching the same projection through different samplers is the strongest
  // form of the claim, not a violation of it.
  const a = fold({ material: shaped, here: 60, window: W, draws: DRAWS, seed: 1 });
  const b = fold({ material: shaped, here: 80, window: W + 1, draws: DRAWS, seed: 1 });
  assert.equal(agree(a, b).gap, "unknown_spec");
  assert.equal(agree(a, a).gap, "no_ground", "one standpoint cannot differ from itself");
  const sameSpecOtherSeed = fold({ material: shaped, here: 80, window: W, draws: DRAWS, seed: 99 });
  assert.ok(!isGap(agree(a, sameSpecOtherSeed)), "a different sampler is not a different spec");
});

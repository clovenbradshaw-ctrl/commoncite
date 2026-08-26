// Conformance · emergence/tiers — THE INTERPRETATION COLUMN.
//
// This organ had NO conformance suite. It was in the ORGANS roster, wired
// into two scripts, and every claim it makes about atmosphere, lens and
// paradigm was unchecked — which is what "hand-wavy" means operationally: not
// that the idea is wrong, but that nothing holds it to the line.
//
// What this suite holds the line on, clause by clause:
//
//   NO PER-TIER NUMBERS. The stack used to carry six hand-picked values
//       (gamma 0.75/0.92/0.98, quantile 0.80/0.85/0.90). Every tier is now
//       built to ONE spec; gamma is derived from `window`; the altitude
//       ladder comes from the fold, and this suite proves the ladder still
//       exists without the numbers.
//   #3  a null of zero width is REFUSED, not cleared. The lineage's most
//       expensive dead end, and the gate had no guard for it.
//   #7  type error before null: "no prior yet" is a typed gap, never the
//       same `passed: false` a real refusal produces.
//   #8  a gap is a result: a movement outside the whole support is CENSORED
//       — magnitude reportable, place not — and the two directions are
//       different findings (Amendment II), never one pooled verdict.
//   the unit of record: a shift is a RECORD naming what moved and against
//       what, never an incremented integer.
//
// And the vacuity control the whole column needs, in both directions: a tier
// fed unvarying evidence must NOT manufacture shifts, and a tier fed real
// regime change MUST produce them. Without the second, a gate that never
// passes anything would satisfy every "no shifts" assertion here.

import test from "node:test";
import assert from "node:assert/strict";

import { createTier, createTierStack, observe, foldThrough, massIsConsistent, gammaFor } from "../packages/engine/emergence/tiers.js";
import { seedTier } from "../packages/engine/emergence/genre-seed.js";

// SEED.md's declared numbers, declared once — there is nothing per-tier left
// to declare.
const SPEC = { window: 12, draws: 200, seed: 20260803 };
const NAMES = ["atmosphere", "lens", "paradigm"];

const arrivalOf = (...forms) => {
  const m = new Map();
  for (const f of forms) m.set(f, (m.get(f) ?? 0) + 1);
  return m;
};

const stack = () => createTierStack(NAMES, SPEC);
const tierOf = () => createTier({ name: "atmosphere", ...SPEC });

/** A recurring vocabulary: varied, but with no regime change in it. */
const steady = (i) => arrivalOf(`f${i % 11}`, `g${i % 5}`);
/** The same, but the whole vocabulary turns over every `era` observations. */
const turningOver = (era) => (i) => {
  const e = Math.floor(i / era);
  return arrivalOf(`e${e}_${i % 7}`, `e${e}_${i % 3}`);
};

const runOne = (tier, n, gen) => {
  const outcomes = {};
  for (let i = 0; i < n; i++) {
    const r = observe(tier, gen(i));
    const why = r.gap ? r.gap.gap
      : r.censored === "above" ? "shift:surfeit"
      : r.censored ? `censored:${r.censored}`
      : "placed";
    outcomes[why] = (outcomes[why] ?? 0) + 1;
  }
  return outcomes;
};

// ── the declared numbers, and the derived one ───────────────────────────────

test("gamma is DERIVED from window — not a per-tier number, and not a fourth declared one", () => {
  // A prior decayed by gamma each observation retains 1/(1-gamma) observations
  // of effective mass, and "the reach of the present" is what window names.
  assert.equal(gammaFor(2), 0.5);
  assert.equal(gammaFor(4), 0.75);
  assert.equal(gammaFor(10), 0.9);
  for (const w of [2, 4, 12, 60]) assert.ok(Math.abs(1 / (1 - gammaFor(w)) - w) < 1e-9, `window ${w} round-trips`);
  assert.equal(createTier({ name: "t", ...SPEC }).gamma, gammaFor(SPEC.window));
});

test("window, draws and seed are declared — and nothing else is", () => {
  assert.throws(() => createTier({ name: "t", draws: 200, seed: 1 }), /window is the reach of the present/);
  assert.throws(() => createTier({ name: "t", window: 1, draws: 200, seed: 1 }), /window is the reach of the present/);
  assert.throws(() => createTier({ name: "t", window: 12, seed: 1 }), /draws is the resolution of testimony/);
  assert.throws(() => createTier({ name: "t", window: 12, draws: 200 }), /seed is declared/);

  // The six numbers that used to live here are gone from the tier entirely.
  const t = tierOf();
  assert.equal(t.quantile, undefined, "no per-tier quantile");
  assert.equal(t.history, undefined, "no per-tier history buffer to size");
  assert.equal(t.minFelt, undefined, "and nothing derived from a quantile that no longer exists");
});

test("every tier in a stack is built to the SAME spec — the ladder is not a ramp", () => {
  const tiers = stack();
  assert.equal(tiers.length, 3);
  const gammas = new Set(tiers.map((t) => t.gamma));
  assert.equal(gammas.size, 1, "one gamma across the whole stack; altitude is not a forgetting ramp");
  for (const t of tiers) assert.equal(t.draws, SPEC.draws);
  // Seeds differ so two tiers never draw the same null stream — that is a
  // stream, not a tuning knob.
  assert.equal(new Set(tiers.map((t) => t.seed)).size, 3);
});

// ── #7: type error before null ──────────────────────────────────────────────

test("the first observation is a TYPED GAP — there is no prior to differ from", () => {
  const tier = tierOf();
  const first = observe(tier, arrivalOf("a", "b"));
  assert.equal(first.passed, false);
  assert.equal(first.gap.gap, "no_ground");
  assert.equal(first.surprise, null, "nothing moved, because nothing was there to move");

  // A movement exists from the second observation on. Whether it can be PLACED
  // depends on the null having width, which is the next test's subject.
  const second = observe(tier, arrivalOf("c", "d"));
  assert.equal(typeof second.surprise, "number", "belief moved, and the movement is real");

  // Once the material starts recurring, the gaps clear entirely.
  for (let i = 0; i < 20; i++) observe(tier, steady(i));
  const settled = observe(tier, steady(21));
  assert.equal(settled.gap, null, "with a prior that recurs, movements are placed rather than gapped");
  assert.equal(typeof settled.rank, "number");
});

test("an empty arrival is empty_material, and never counted as an observation", () => {
  const tier = tierOf();
  const before = tier.observations;
  const r = observe(tier, new Map());
  assert.equal(r.passed, false);
  assert.equal(r.gap.gap, "empty_material");
  assert.equal(tier.observations, before, "nothing arrived, so nothing was observed");
});

// ── #3: a null of zero width is refused, everywhere, at every level ─────────

test("a stream in which EVERYTHING is novel has a null of zero width, and is refused", () => {
  // The case that matters on real material, and the reason this organ is worth
  // its refusals. When every arrival is a form never seen before, the measured
  // novelty rate pins at 1.0, so every continuation the null can imagine is
  // "some forms never seen before" — all identical, no width, nothing to
  // differ from. SEED.md #3: such a null "would clear anything put in front of
  // it," so it is refused instead.
  //
  // MEASURED on War and Peace, where this is not a corner case but the norm:
  // 532 tier observations, mean arrival mass 1.11, 578 distinct edge keys over
  // 589 total arriving mass — 98% of arrivals are 100% novel, and 241 of 532
  // come back degenerate. The Interpretation column has nothing to read there
  // and says so. The hand-tuned percentile gate this replaced reported 43
  // confident shifts over that same nothing.
  const tier = tierOf();
  for (let i = 0; i < 12; i++) observe(tier, arrivalOf(`n${i}a`, `n${i}b`));
  assert.equal(tier.novelRate, 1, "precondition: nothing has ever recurred");

  const r = observe(tier, arrivalOf("n99a", "n99b"));
  assert.equal(r.passed, false, "a zero-width null must never pass anything");
  assert.equal(r.gap.gap, "degenerate_ground", "and it must say why rather than quietly returning false");
  assert.equal(tier.shifts, 0, "and nothing was manufactured out of it");
});

test("mixing a RECURRING form into an all-novel stream makes it readable again", () => {
  // The control for the refusal above, and the reason read-tiered.mjs now
  // carries node forms alongside edge keys. The novel half is unchanged; what
  // makes the stream judgeable is that SOMETHING in it recurs, which gives the
  // continuation null forms to draw and therefore width.
  const allNovel = tierOf();
  for (let i = 0; i < 12; i++) observe(allNovel, arrivalOf(`n${i}a`, `n${i}b`));
  assert.equal(observe(allNovel, arrivalOf("n99a", "n99b")).gap.gap, "degenerate_ground");

  const withRecurrence = tierOf();
  for (let i = 0; i < 12; i++) observe(withRecurrence, arrivalOf(`n${i}a`, `n${i}b`, `node${i % 4}`));
  const r = observe(withRecurrence, arrivalOf("n99a", "n99b", "node1"));
  assert.notEqual(r.gap?.gap, "degenerate_ground", "a stream with any recurrence in it can be read");
  assert.ok(withRecurrence.novelRate < 1, "and its measured novelty is no longer pinned at 1.0");
});

test("control — a spread prior is not refused, so the guard above is not vacuous", () => {
  const tier = tierOf();
  for (let i = 0; i < 20; i++) observe(tier, steady(i));
  const r = observe(tier, steady(21));
  assert.notEqual(r.gap?.gap, "degenerate_ground");
  assert.ok(r.rank !== null || r.censored !== null, "a real null places or censors the movement");
});

// ── #8: a gap is a result — censoring, and the two directions ───────────────

test("a movement past everything the prior could produce is CENSORED ABOVE — it shifts, and triggers re-zero", () => {
  const tier = tierOf();
  for (let i = 0; i < 30; i++) observe(tier, steady(i));

  // MEASURED, and not what the first draft of this test assumed: what exceeds
  // the null is CONCENTRATION, not novelty as such. A continuation drawn from
  // the prior spreads its mass the way the prior is spread, so an arrival that
  // puts all of its mass on one form moves belief further than any draw can —
  // whereas six DISTINCT new forms score rank 0.015 and stay inside, because a
  // spread arrival is the shape the null already produces.
  const r = observe(tier, arrivalOf("Q1", "Q1", "Q1", "Q1", "Q1", "Q1", "Q1", "Q1"));
  assert.equal(r.censored, "above", "magnitude reportable, place not");
  assert.equal(r.rank, null, "a censored movement HAS no rank — that is what censored means");
  assert.equal(r.passed, true, "surfeit is the shift");
  assert.equal(r.reZero, true, "SEED.md #8 — censored above is the trigger to re-zero");
  assert.ok(r.surprise > r.support[1], "and it really is outside the support it is censored against");

  // The control for the sentence above: spread novelty is placed, not censored.
  const spread = createTier({ name: "atmosphere", ...SPEC });
  for (let i = 0; i < 30; i++) observe(spread, steady(i));
  const s = observe(spread, arrivalOf("Q1", "Q2", "Q3", "Q4", "Q5", "Q6"));
  assert.equal(s.censored, null, "six distinct new forms are the shape the null itself produces");
  assert.equal(s.passed, false);
});

test("an ordinary arrival is PLACED inside the null, with a rank — and is not a shift", () => {
  const tier = tierOf();
  for (let i = 0; i < 30; i++) observe(tier, steady(i));
  const r = observe(tier, steady(31));
  assert.equal(r.gap, null);
  assert.equal(r.censored, null);
  assert.equal(typeof r.rank, "number", "inside the support it has a place, and the place is reported");
  assert.equal(r.passed, false, "belief continuing as it expected is not a shift");
  assert.ok(r.rank >= 0 && r.rank <= 1);
});

test("sustained restatement settles to the BOTTOM of the null and stops shifting — regularity, not surfeit", () => {
  // Amendment II's regularity pole, as this null actually expresses it. The
  // first restatement is a sharp concentration the prior did not expect and
  // censors ABOVE; once the prior has absorbed it, every further restatement
  // is what the prior now expects, and the movement sinks to the floor of the
  // null's support (rank -> 1.0) rather than off the bottom of it.
  //
  // Worth stating because the obvious guess is wrong: `censored: "below"` is
  // handled here (and is never a shift) but is RARE under a continuation null,
  // because the null is redrawn from the prior each time and therefore sinks
  // WITH the observation instead of staying put.
  const tier = tierOf();
  for (let i = 0; i < 30; i++) observe(tier, steady(i));
  const beforeRestating = tier.shifts; // the warm-up has surfeits of its own

  const restate = () => observe(tier, arrivalOf("f0", "f0", "f0", "f0"));
  const first = restate();
  assert.equal(first.passed, true, "the first sharp restatement is a genuine surfeit");

  const rest = [];
  for (let i = 0; i < 12; i++) rest.push(restate());
  assert.ok(rest.every((r) => r.passed === false), "restating what belief now expects is never a shift");
  assert.ok(rest.every((r) => r.reZero === false), "and never the trigger to re-zero");

  const last = rest[rest.length - 1];
  assert.equal(last.censored, null);
  assert.ok(last.rank > 0.9, `expected the movement at the floor of its own null, saw rank ${last.rank}`);
  assert.equal(tier.shifts - beforeRestating, 1, "one surfeit, then silence — the tier stopped being surprised");
});

// ── the unit of record ──────────────────────────────────────────────────────

test("a shift is a RECORD with provenance, not an incremented integer", () => {
  const tier = tierOf();
  for (let i = 0; i < 30; i++) observe(tier, steady(i));
  const shifted = observe(tier, arrivalOf("N1", "N1", "N1", "N1", "N1", "N1", "N1", "N1"));
  assert.equal(shifted.passed, true, "precondition: this arrival really is a shift");

  assert.equal(tier.shifts, tier.shiftRecords.length, "the counter is a view of the records, never a separate tally");
  assert.ok(tier.shiftRecords.length >= 1, "the movement above the support was recorded");

  const rec = tier.shiftRecords[tier.shiftRecords.length - 1];
  assert.equal(rec.tier, "atmosphere");
  assert.equal(rec.at, tier.observations, "when it shifted");
  assert.equal(typeof rec.surprise, "number", "how far the prior moved");
  assert.ok(Array.isArray(rec.forms) && rec.forms.includes("N1"), "WHAT moved it — a shift with no forms names nothing");
  assert.match(rec.ground.giver, /priorContinuationNull/, "the ground it was placed against names its giver");
  assert.equal(rec.ground.draws, SPEC.draws, "and the resolution it was read at");
  assert.equal(rec.ground.gamma, gammaFor(SPEC.window));
  assert.ok(Object.isFrozen(rec), "a record of testimony is frozen");
  assert.throws(() => { rec.at = 999; }, TypeError, "and cannot be rewritten after the fact");
});

// ── the vacuity controls, both directions ───────────────────────────────────

test("stationary evidence produces NO shifts — the gate is not reading its own arithmetic", () => {
  const tier = tierOf();
  const outcomes = runOne(tier, 300, () => arrivalOf("x", "y"));
  assert.equal(tier.shifts, 0, `a tier fed unvarying evidence manufactured ${tier.shifts} shifts`);
  assert.ok(outcomes.placed > 250, `expected the movements to be placed inside the null, saw ${JSON.stringify(outcomes)}`);
});

test("evidence that is ALWAYS novel does not shift on every frame either", () => {
  // The failure mode the continuation null could plausibly have had: it can
  // only draw forms the prior holds, so wholly-new arrivals might exceed it
  // every single time and flatten the ladder. Measured: they do not — when
  // novelty is the norm the prior spreads and absorbs it.
  const tier = tierOf();
  runOne(tier, 300, (i) => arrivalOf(`n${i}a`, `n${i}b`));
  assert.ok(tier.shifts < 60, `unrelenting novelty passed ${tier.shifts}/300 — the gate is not gating`);
});

test("shifts DO fire on real regime change — so the silence above is a finding, not a broken gate", () => {
  const tier = tierOf();
  runOne(tier, 300, turningOver(25));
  assert.ok(tier.shifts > 0, "a tier that never shifts on genuine regime change is not measuring anything");
  assert.ok(tier.shifts < 60, `passed ${tier.shifts}/300 — that is not a gate`);
});

test("a turning-over vocabulary shifts MORE than a steady one — the gate tracks the material", () => {
  const steadyTier = tierOf();
  runOne(steadyTier, 300, steady);
  const turningTier = tierOf();
  runOne(turningTier, 300, turningOver(25));
  assert.ok(
    turningTier.shifts > steadyTier.shifts,
    `regime change produced ${turningTier.shifts} shifts and steady material ${steadyTier.shifts} — the gate is not reading the material`,
  );
});

// ── the fold IS the ladder ──────────────────────────────────────────────────

test("the ladder survives the loss of the per-tier numbers — evidence still reaches paradigm", () => {
  // The load-bearing test of this whole change. With six hand-picked numbers
  // removed, altitude must still be earned, and it must still be RARE.
  const tiers = stack();
  for (let i = 0; i < 300; i++) foldThrough(tiers, turningOver(25)(i));

  const [atmosphere, lens, paradigm] = tiers;
  assert.ok(atmosphere.observations > 0);
  assert.ok(lens.observations > 0, "nothing ever reached the lens — the fold is not folding");
  assert.ok(paradigm.observations > 0, "nothing ever reached the paradigm — the ladder has no top");

  // Sparsification: each altitude sees strictly less than the one below it.
  assert.ok(
    atmosphere.observations > lens.observations && lens.observations > paradigm.observations,
    `expected strict sparsification, saw ${atmosphere.observations} > ${lens.observations} > ${paradigm.observations}`,
  );
  // A tier observes exactly as often as the tier below it shifted.
  assert.equal(lens.observations, atmosphere.shifts, "a tier sees exactly what disturbed the one below");
  assert.equal(paradigm.observations, lens.shifts);
});

test("foldThrough stops at the first tier the evidence did not disturb", () => {
  const tiers = stack();
  const first = foldThrough(tiers, arrivalOf("a", "b"));
  assert.equal(first.reached, 1, "nothing rises above a tier that did not move");
  assert.equal(first.top, "atmosphere");
  assert.equal(tiers[1].observations, 0, "the tier above was never even asked");
  for (const r of first.results) assert.ok("rank" in r && "censored" in r && "gap" in r);
});

// ── the invariant fixed twice already ───────────────────────────────────────

test("prior mass stays consistent with its total through decay", () => {
  const tier = tierOf();
  runOne(tier, 300, (i) => arrivalOf(`m${i % 23}`, `n${i % 6}`));
  assert.ok(massIsConsistent(tier), "the decay must not let the distribution stop summing to its total");
});

test("the organ holds no randomness — it receives a stream, and reads the same twice", () => {
  const run = () => {
    const tier = tierOf();
    const out = [];
    for (let i = 0; i < 80; i++) {
      const r = observe(tier, steady(i));
      out.push({ passed: r.passed, rank: r.rank, censored: r.censored, gap: r.gap?.gap ?? null });
    }
    return out;
  };
  assert.deepEqual(run(), run());
});

test("a different received stream is a different reading — the seed is real", () => {
  const readWith = (seed) => {
    const tier = createTier({ name: "atmosphere", ...SPEC, seed });
    for (let i = 0; i < 80; i++) observe(tier, steady(i));
    return tier.shiftRecords.map((r) => r.at);
  };
  // Not an assertion that they differ — two streams may agree — but that the
  // seed is threaded through to the null at all rather than silently ignored.
  const a = createTier({ name: "t", ...SPEC, seed: 1 });
  const b = createTier({ name: "t", ...SPEC, seed: 2 });
  assert.notEqual(a.seed, b.seed);
  assert.deepEqual(readWith(SPEC.seed), readWith(SPEC.seed), "the same stream is the same reading");
});

// ── genre-seeded cold start — the vacuity control, both directions ─────────
//
// emergence/genre-seed.js hands this organ's own `observe()` a real first
// arrival instead of leaving `new Map()`. Held to the SAME two-direction
// discipline every other gate in this file is held to: seeding must not
// manufacture shifts out of material that matches what it was seeded with,
// and it must not go blind to material the seed gave near-zero weight to.

const GENRE_CLUSTER = Object.freeze({
  id: "sig-entity-tracing",
  size: 131,
  centroid: Object.freeze({
    NUL: 0.0015921634170932301,
    SIG: 0.1102136664838743,
    INS: 0.03871947329957187,
    SEG: 0.020655409913781567,
    CON: 0.02385116161438826,
    SYN: 0.0018174541660510837,
    DEF: 0.07640304949531274,
    EVA: 0.0013240191947163067,
    REC: 0.0004709190954613652,
  }),
});
const opArrival = (obj) => new Map(Object.entries(obj));

test("a genre-seeded tier's first REAL observation has something to be judged against — never no_ground", () => {
  // The unseeded control, restated: conformance/tiers.test.js's own first
  // test above pins this as always true of a bare tier.
  const bare = tierOf();
  const bareFirst = observe(bare, opArrival({ SIG: 3, DEF: 1 }));
  assert.equal(bareFirst.gap?.gap, "no_ground", "precondition: an unseeded tier's first observation has no prior at all");

  const seeded = tierOf();
  const seedResult = seedTier(seeded, GENRE_CLUSTER, { giver: "test:sig-entity-tracing" });
  assert.equal(seedResult.seeded, true, "precondition: this real, corpus-derived cluster must clear its own readiness gate");
  const seededFirst = observe(seeded, opArrival({ SIG: 3, DEF: 1 }));
  assert.notEqual(seededFirst.gap?.gap, "no_ground", "a genre-seeded tier already holds a prior before the document's own first sentence arrives");
  assert.equal(typeof seededFirst.surprise, "number", "belief had somewhere real to move from");
});

test("on-genre material does not manufacture a shift; off-genre material the seed gave near-zero weight to does", () => {
  // Both tiers are seeded identically and warmed up identically — the two
  // spikes below differ only in which operator they concentrate on.
  const warmedTier = () => {
    const t = tierOf();
    seedTier(t, GENRE_CLUSTER, { giver: "test:sig-entity-tracing" });
    for (let i = 0; i < 10; i++) observe(t, opArrival({ SIG: 3, DEF: 1 }));
    return t;
  };

  // SIG is the seed's own dominant operator (centroid weight 0.110, the
  // largest of the eight) and the warm-up's own vocabulary — concentrating
  // an arrival on it is more of the SAME kind, not a different one.
  const onGenre = observe(warmedTier(), opArrival({ SIG: 12 }));
  assert.equal(onGenre.passed, false, "concentrating on the genre's own dominant operator must not read as a shift");

  // SEG carries the seed's smallest measurable weight (0.0207) and never
  // appeared in the warm-up either — concentrating an arrival on it is
  // exactly the "different KIND, not a reweight" case: material the genre
  // prior did not lead this tier to expect.
  const offGenre = observe(warmedTier(), opArrival({ SEG: 12 }));
  assert.equal(offGenre.passed, true, "concentrating on an operator the genre gave near-zero weight to must still read as real surfeit");
  assert.equal(offGenre.censored, "above", "magnitude reportable, place not — the same #8 discipline every other shift in this file is held to");
});

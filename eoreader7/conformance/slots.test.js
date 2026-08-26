// eoreader6 · conformance/slots — the derived slot inventory, and the things
// it must refuse.
//
// The pattern this file follows deliberately: generation/RESULTS.md records
// that five defects in the last round of this work were found by RUNNING
// things and none by reading them, and that four of the five were caught by
// tests whose entire job is asserting that two ways of computing one quantity
// agree. So the load-bearing tests here are the identity tests, not the
// smoke tests.

import test from "node:test";
import assert from "node:assert/strict";

import { induceSlots, inductionSensitivity, shuffleTokens, slotExpectation, CELL } from "../packages/engine/generation/slots.js";
import { createLayer, createBelief, UNSEEN } from "../packages/engine/generation/belief.js";

// A stream with real positional structure: three groups of filler in a fixed
// frame. Within a group the members are substitutable; across groups no member
// ever occupies another's position.
//
// IT HAS TO BE THIS BIG, and the reason is the organ working rather than a
// fixture being generous. The verdict prices a nominated pair against
// FREQUENCY-MATCHED strangers, so a vocabulary of nine forms cannot supply two
// strangers at a noun's frequency and every pair comes back `exceeds_witness`
// — a null of zero width, refused by SEED.md #3. A nine-type corpus is not a
// small test of this organ; it is a corpus the organ correctly declines to
// read. Nouns and verbs are given matching counts on purpose, so each is the
// other's null and confirmation cannot come from frequency.
// THE MEMBERS MUST BE CHOSEN INDEPENDENTLY, and the first version of this
// fixture was not. Cycling each group by its index — `NOUNS[i % 15]` beside
// `VERBS[(i * 7) % 15]` — makes the pairing DETERMINISTIC: `cat` is then
// always followed by one particular verb and `dog` by another, so the two
// nouns license disjoint successors and are genuinely not substitutable. The
// organ refused them, correctly, and the fixture was what was wrong.
//
// Independent seeded draws give every member of a group the same successor
// distribution, which is what "occupying one slot" means.
const DETS = ["the", "a", "this", "that", "each", "every"];
const NOUNS = ["cat", "dog", "bird", "horse", "child", "man", "woman", "house", "tree", "river", "hill", "road", "friend", "door", "hand"];
const VERBS = ["ran", "slept", "sang", "waited", "fell", "rose", "turned", "spoke", "watched", "paused", "left", "stayed", "moved", "rested", "called"];
const STRUCTURED = [];
{
  let s = 12345;
  const pick = (xs) => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return xs[s % xs.length];
  };
  for (let i = 0; i < 1200; i++) STRUCTURED.push(pick(DETS), pick(NOUNS), pick(VERBS), ".");
}

const DECLARED = { classes: 4, features: 20, minCount: 4, iterations: 10, draws: 32, seed: 7 };

test("every declared number is required — none of them is a default", () => {
  for (const missing of ["classes", "features", "minCount", "iterations", "draws"]) {
    const args = { tokens: STRUCTURED, ...DECLARED };
    delete args[missing];
    assert.throws(() => induceSlots(args), new RegExp(missing), `${missing} must be declared`);
  }
  assert.throws(
    () => induceSlots({ tokens: STRUCTURED, ...DECLARED, seed: undefined }),
    /seed is declared/,
    "a run is a run — the seed is never implicit",
  );
});

test("a resolution finer than the evidence is a typed gap, not a smaller answer", () => {
  // Four distinct groupable forms cannot be divided into 99 classes. The
  // honest answer is a refusal; silently returning 4 classes would report a
  // resolution the run did not use.
  const thin = induceSlots({ tokens: ["a", "b", "a", "b", "a", "b", "a", "b"], ...DECLARED, classes: 99 });
  assert.equal(thin.gap, "degenerate_ground");
  // nul's gap() spreads its detail at the top level rather than nesting it.
  assert.ok(thin.forms < 99, "the refusal reports how much evidence there actually was");
});

test("the induction is deterministic under its declared seed", () => {
  const a = induceSlots({ tokens: STRUCTURED, ...DECLARED });
  const b = induceSlots({ tokens: STRUCTURED, ...DECLARED });
  assert.deepEqual(a.report.class_sizes, b.report.class_sizes);
  for (const form of ["the", "cat", "ran"]) assert.equal(a.classOf(form), b.classOf(form));
});

test("forms that behave alike land together, and forms that do not stay apart", () => {
  const slots = induceSlots({ tokens: STRUCTURED, ...DECLARED });
  // Substitutable pairs share a class.
  assert.equal(slots.classOf("the"), slots.classOf("a"), "two determiners occupy one slot");
  assert.equal(slots.classOf("cat"), slots.classOf("dog"), "two nouns occupy one slot");
  // Non-substitutable pairs do not. This is the property the UniMorph
  // abstraction lacked: it merged go/went/gone, which never share a position.
  assert.notEqual(slots.classOf("the"), slots.classOf("cat"), "a determiner is not a noun's slot");
  assert.notEqual(slots.classOf("cat"), slots.classOf("ran"), "a noun is not a verb's slot");
});

test("a form below minCount stands for itself and is never pooled into an unknown bucket", () => {
  const withRare = [...STRUCTURED, "hapax"];
  const slots = induceSlots({ tokens: withRare, ...DECLARED });
  assert.equal(slots.classOf("hapax"), null, "one occurrence earns no class");
  assert.equal(slots.of("hapax"), "hapax", "an unplaceable form abstracts to itself, never to a shared UNKNOWN");
});

test("the abstraction names its giver, and the giver says it was derived", () => {
  const slots = induceSlots({ tokens: STRUCTURED, ...DECLARED });
  assert.ok(slots.giver.includes("DERIVED"), "a derived inventory must not pass as a received one");
  assert.ok(slots.giver.includes("seed=7"), "the giver carries the declared numbers that produced it");
  // And createLayer accepts it on exactly the terms it accepts any prior.
  assert.doesNotThrow(() =>
    createLayer({ id: "read", tier: "read", order: 2, gamma: 1, alpha: 1, abstraction: slots }),
  );
});

// ── The sensitivity precondition (SEED.md #4, Amendment I) ─────────────────

test("shuffling preserves the vocabulary exactly and destroys the order", () => {
  const shuffled = shuffleTokens(STRUCTURED, 7);
  assert.equal(shuffled.length, STRUCTURED.length);
  const count = (xs) => {
    const m = new Map();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort();
  };
  assert.deepEqual(count(shuffled), count(STRUCTURED), "the noise floor must know exactly as much word-frequency");
  assert.notDeepEqual(shuffled, STRUCTURED, "and no order at all");
});

test("the VERDICT is sensitive to what the perturbation destroys, not the sense organ", () => {
  const s = inductionSensitivity({ tokens: STRUCTURED, ...DECLARED });
  assert.ok(!s.gap, "both arms must induce");

  // THE SENSE ORGAN'S SENSITIVITY IS DELIBERATELY NOT ASSERTED HERE, and the
  // reason is a measurement. The cosine gap ran in OPPOSITE DIRECTIONS on the
  // two materials this was tried on:
  //
  //   toy corpus (9 types, dense profiles)   shuffled MORE self-similar
  //   Heidi (3,310 types, sparse profiles)   shuffled LESS self-similar
  //
  // Both are explained by sample density against feature dimension — a dense
  // profile converges on the unigram distribution under shuffle, a sparse one
  // scatters into near-orthogonality — and neither says anything about
  // whether the organ works, because the cosine never decides anything. It
  // nominates. Pinning its sign would pin an artefact of vocabulary size.
  //
  // What must survive is the VERDICT: on real material the ground confirms
  // nominated pairs, and on material whose order has been destroyed there are
  // no slots left to find, so it should confirm far fewer.
  assert.ok(
    s.real_confirmed > s.shuffled_confirmed,
    `the ground confirmed ${(s.real_confirmed * 100).toFixed(1)}% of nominated pairs on real material and ` +
      `${(s.shuffled_confirmed * 100).toFixed(1)}% on shuffled — a verdict that cannot tell them apart is vacuous`,
  );
});

// ── The slot expectation ───────────────────────────────────────────────────

const beliefWith = (abstraction) => {
  const layer = createLayer({ id: "read", tier: "read", order: 2, gamma: 1, alpha: 1, abstraction });
  layer.train(STRUCTURED);
  return createBelief({ layers: [layer] });
};

test("collapsing a distribution to classes can only lower its entropy", () => {
  const slots = induceSlots({ tokens: STRUCTURED, ...DECLARED });
  const belief = beliefWith(slots);
  for (const ctx of [["the"], ["cat"], ["."], ["ran", "."]]) {
    const d = belief.distribution(ctx);
    const e = slotExpectation({ distribution: d, abstraction: slots, unseenLabel: UNSEEN });
    assert.ok(!e.gap, `no expectation at ${JSON.stringify(ctx)}`);
    assert.ok(e.h_class <= e.h_form + 1e-12, "H_class must never exceed H_form — a coarser question is never harder");
    assert.ok(e.constraint >= -1e-12, "constraint is a non-negative quantity by construction");
  }
});

test("the expectation's class mass agrees with summing the form mass by hand", () => {
  // The identity test. Two ways of computing one quantity: the organ's
  // collapse, and a direct sum over the distribution.
  const slots = induceSlots({ tokens: STRUCTURED, ...DECLARED });
  const belief = beliefWith(slots);
  const d = belief.distribution(["the"]);
  const e = slotExpectation({ distribution: d, abstraction: slots, unseenLabel: UNSEEN });

  let total = 0;
  const byHand = new Map();
  for (const form in d.probs) {
    if (form === UNSEEN) continue;
    const p = d.probs[form];
    total += p;
    const c = slots.of(form);
    byHand.set(c, (byHand.get(c) ?? 0) + p);
  }
  for (const [c, mass] of byHand)
    assert.ok(Math.abs(e.distribution[c] - mass / total) < 1e-12, `class ${c} disagrees between the two computations`);
  const summed = Object.values(e.distribution).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(summed - 1) < 1e-12, "the class distribution is a distribution");
});

test("a position that knows its kind but not its word reports exactly that", () => {
  // After a determiner the next form is certainly a noun and uncertainly
  // WHICH noun. That state is invisible to a flat next-form distribution and
  // is the whole reason this readout exists.
  const slots = induceSlots({ tokens: STRUCTURED, ...DECLARED });
  const belief = beliefWith(slots);
  const e = slotExpectation({ distribution: belief.distribution(["the"]), abstraction: slots, unseenLabel: UNSEEN });
  assert.ok(e.h_form > 0.5, "the reader should be genuinely unsure which noun");
  assert.ok(e.constraint > 0.3, "and much of that uncertainty should be about the word, not the kind");
  assert.equal(e.expected[0].class, slots.classOf("cat"), "the kind it expects is the noun slot");
});

test("a slot expectation refuses a distribution it was not given", () => {
  const slots = induceSlots({ tokens: STRUCTURED, ...DECLARED });
  assert.equal(slotExpectation({ distribution: null, abstraction: slots }).gap, "unknown_spec");
  assert.equal(
    slotExpectation({ distribution: { kind: "sequence" }, abstraction: slots }).gap,
    "unknown_spec",
    "a continuation is not a categorical and must not be silently read as one",
  );
  assert.equal(
    slotExpectation({ distribution: { kind: "categorical", probs: {} }, abstraction: null }).gap,
    "unknown_spec",
  );
});

test("the organ declares the cell it occupies", () => {
  assert.equal(CELL.op, "SEG");
  assert.equal(CELL.terrain, "Network");
  assert.equal(CELL.stance, "Unraveling");
});

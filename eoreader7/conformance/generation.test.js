// Generation: finishing the sentence without confabulating.
//
// Two families here, and they are the two deaths from SEED.md wearing
// generative clothes.
//
// CONFABULATION is the obvious one: a generator that speaks without witness.
// The tests below that matter most are the ones where the apparatus refuses to
// say something — a belief with no ground returning a gap instead of a word, a
// continuation carried by a received prior barred from testifying about the
// material it was not read from.
//
// The subtler family is about MEASUREMENT INTEGRITY, and it is where a
// generative system actually rots. Fluent output is enormously persuasive, so
// every escape hatch that lets an emitter look good without being good has to
// be nailed shut and kept nailed. "the reserve loophole" below is one this
// repo actually fell into and had to be dug out of.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isGap } from "../nul/index.js";
import { createLayer, createBelief, UNSEEN } from "../packages/engine/generation/belief.js";
import { emitSequence, admissibleAsTestimony } from "../packages/engine/generation/emit.js";
import { createGenerationTask, walkForwardSequence, walkSentenceCompletions } from "../packages/engine/generation/tasks.js";
import { defaultGenerationBaselines, markov, copyPrevious } from "../packages/engine/generation/baselines.js";
import { decayedBelief, priorAugmented, regimeBelief, abstracted } from "../packages/engine/generation/candidates.js";
import { lemmaAbstraction, classAbstraction, composeAbstractions } from "../packages/engine/generation/abstractions.js";
import { runGeneration } from "../packages/engine/generation/run.js";
import { commitPrediction, revealAndScore } from "../packages/engine/prediction/commitments.js";
import { sequenceLogLoss, score } from "../packages/engine/prediction/scoring.js";

const TOKENS = "the cat sat on the mat the cat sat on the floor the dog sat on the mat".split(" ");
const readLayer = (over = TOKENS, opts = {}) =>
  createLayer({ id: "read", tier: "read", order: 2, gamma: 1, alpha: 1, ...opts }).train(over);
const beliefOver = (over = TOKENS) => createBelief({ layers: [readLayer(over)] });

// ── A prior is a gift and must name its giver (SEED.md #1) ──────────────────

test("a received layer cannot be built without naming its giver", () => {
  assert.throws(
    () => createLayer({ id: "gift", tier: "received", order: 1, gamma: 1, alpha: 1 }),
    /must name its giver/,
  );
  assert.doesNotThrow(() =>
    createLayer({ id: "gift", tier: "received", giver: "Bram Stoker, Dracula", order: 1, gamma: 1, alpha: 1 }),
  );
});

test("a belief has exactly one read layer — not zero, not two", () => {
  const gift = createLayer({ id: "g", tier: "received", giver: "someone", order: 1, gamma: 1, alpha: 1 });
  assert.throws(() => createBelief({ layers: [gift] }), /exactly one read layer/);
  assert.throws(() => createBelief({ layers: [readLayer(), readLayer()] }), /exactly one read layer/);
});

test("order, gamma and alpha are declared, never defaulted", () => {
  assert.throws(() => createLayer({ id: "r", tier: "read", gamma: 1, alpha: 1 }), /order/);
  assert.throws(() => createLayer({ id: "r", tier: "read", order: 1, alpha: 1 }), /gamma/);
  assert.throws(() => createLayer({ id: "r", tier: "read", order: 1, gamma: 1 }), /alpha/);
});

test("a task declares its priors and every one of them names a giver", () => {
  const base = {
    target_type: "token-sequence",
    horizon: 4,
    conditioning: "free-running",
    selection: "mode",
    scoring_rule: "sequence-log-loss",
    baseline_ids: ["baseline:markov-2"],
    population: "test",
  };
  assert.throws(() => createGenerationTask(base), /prior_ids/);
  assert.throws(
    () => createGenerationTask({ ...base, prior_ids: [{ id: "dracula" }] }),
    /must name its giver/,
  );
  // An empty list is a claim and is accepted; a missing one is not.
  assert.doesNotThrow(() => createGenerationTask({ ...base, prior_ids: [] }));
});

// ── Borrowed content is fuel for a guess, never evidence about the material ──

test("imagining is unguarded: a borrowed continuation is emitted freely and penalised nowhere", () => {
  // The gift's forms all exist in this book; what the gift supplies is the
  // ORDER, which is the only thing it has standing to supply.
  const gift = createLayer({ id: "dracula", tier: "received", giver: "Bram Stoker", order: 2, gamma: 1, alpha: 1 });
  gift.train("the cat sat the dog sat the cat sat the dog sat".split(" "));
  const belief = createBelief({ layers: [readLayer(["the", "cat", "sat", "dog", "mat"]), gift] });

  const borrowed = emitSequence({ belief, context: ["the", "cat"], horizon: 2, conditioning: "free-running", selection: "mode" });
  assert.ok(!isGap(borrowed), "a guess shaped by another book is still a guess, and is emitted");
  assert.equal(borrowed.register, "imagined");
  assert.ok(borrowed.received_fraction > 0, "and the gift is audible in it");
  // And it is scored by the same rule as anything else, with no surcharge.
  const scored = sequenceLogLoss(borrowed, ["sat", "the"]);
  assert.equal(scored.proper, true);
  assert.ok(Number.isFinite(scored.loss));
});

test("a belief with no ground at all still refuses — imagining is not confabulating", () => {
  // The distinction the whole refusal policy turns on: borrowed ground emits,
  // NO ground does not. A generator that produces text from nothing is not
  // imagining, it is SEED.md's first death.
  const empty = createBelief({ layers: [createLayer({ id: "read", tier: "read", order: 2, gamma: 1, alpha: 1 })] });
  assert.ok(isGap(emitSequence({ belief: empty, context: [], horizon: 2, conditioning: "free-running", selection: "mode" })));

  // THE EXISTENCE GATE makes this stronger than it was. A reader that has met
  // nothing cannot be rescued by any number of gifts, because a gift may only
  // place mass on forms THIS book has met and there are none. Existence is
  // local; the gifts supply structure over what is already here.
  const gift = createLayer({ id: "g", tier: "received", giver: "somebody", order: 2, gamma: 1, alpha: 1 });
  gift.train(["a", "b", "c"]);
  const borrowedOnly = createBelief({ layers: [createLayer({ id: "read", tier: "read", order: 2, gamma: 1, alpha: 1 }), gift] });
  assert.ok(
    isGap(emitSequence({ belief: borrowedOnly, context: [], horizon: 2, conditioning: "free-running", selection: "mode" })),
    "gifts alone cannot speak — they have no standing to introduce a thing into this world",
  );

  // Once the reader has met the forms, the same gift becomes audible.
  const readSome = createLayer({ id: "read", tier: "read", order: 2, gamma: 1, alpha: 1 }).train(["a", "b", "c", "a"]);
  const together = createBelief({ layers: [readSome, gift] });
  assert.ok(!isGap(emitSequence({ belief: together, context: ["a"], horizon: 2, conditioning: "free-running", selection: "mode" })));
});

test("the crossing is guarded: an imagining asserted about the material is a category error", () => {
  // Under the existence gate the crossing means something sharper than it did.
  // A gift can no longer introduce a WORD; it can only propose a form this book
  // has met, in a place the read layer would not have proposed it. That is
  // still not testimony — the book never said this HERE.
  const gift = createLayer({ id: "dracula", tier: "received", giver: "Bram Stoker", order: 2, gamma: 1, alpha: 1 });
  gift.train("the cat floor the cat floor the cat floor".split(" "));
  const belief = createBelief({ layers: [readLayer(["the", "cat", "sat", "floor"]), gift] });

  const borrowed = emitSequence({ belief, context: ["the", "cat"], horizon: 1, conditioning: "free-running", selection: "mode" });
  assert.equal(borrowed.grounded, false, "a gift was audible, so this is not the book speaking");
  assert.ok(borrowed.received_fraction > 0, "and the borrowed mass is reported");
  const refusal = admissibleAsTestimony(borrowed);
  assert.ok(isGap(refusal));
  assert.equal(refusal.gap, "unreceived_origin");

  // The same apparatus, read-only, testifies fine.
  const own = emitSequence({ belief: beliefOver(), context: ["the", "cat"], horizon: 1, conditioning: "free-running", selection: "mode" });
  assert.equal(own.grounded, true);
  assert.equal(admissibleAsTestimony(own), null);
});

test("THE EXISTENCE GATE: a gift supplies structure, never a new thing in the world", () => {
  // The failure this exists to stop, observed on real material: reading
  // Frankenstein against Moby-Dick produced the word "peleg" — a character who
  // exists in no other book. A gift has no standing to introduce a referent
  // into this world. It has standing only about how what is here hangs
  // together. CUBE.md's Existence and Structure domains, made operational.
  const gift = createLayer({ id: "moby", tier: "received", giver: "Melville", order: 2, gamma: 1, alpha: 1 });
  gift.train("the cat peleg the cat peleg the cat peleg".split(" "));
  const belief = createBelief({ layers: [readLayer(), gift] });

  const d = belief.distribution(["the", "cat"]);
  assert.equal(d.probs["peleg"], undefined, "a form this book has never met takes no mass from any gift");
  for (const form in d.probs)
    assert.ok(form === UNSEEN || TOKENS.includes(form), `${form} is not a form this book has met`);

  // The gift is not silenced — its structure over the shared forms still lands.
  assert.ok(d.received_mass > 0, "what the gift can say about this book's own forms, it still says");
});

test("a gift with nothing sayable here falls to the reserve rather than being renormalised away", () => {
  const gift = createLayer({ id: "alien", tier: "received", giver: "elsewhere", order: 2, gamma: 1, alpha: 1 });
  gift.train("xylophone quokka xylophone quokka".split(" "));
  const belief = createBelief({ layers: [readLayer(["the", "cat"]), gift] });
  const d = belief.distribution(["the", "cat"]);
  assert.equal(d.received_mass, 0, "it placed nothing");
  assert.ok(d.probs[UNSEEN] > 0, "and its share became honest uncertainty, not silent renormalisation");
});

test("THE EXISTENCE GATE: a gift supplies structure, never a new thing in the world", () => {
  // The failure this exists to stop, observed on real material: reading
  // Frankenstein against Moby-Dick produced the word "peleg" — a character who
  // exists in no other book. A gift has no standing to introduce a referent
  // into this world. It has standing only about how what is here hangs
  // together. CUBE.md's Existence and Structure domains, made operational.
  const gift = createLayer({ id: "moby", tier: "received", giver: "Melville", order: 2, gamma: 1, alpha: 1 });
  gift.train("the cat peleg the cat peleg the cat peleg".split(" "));
  const belief = createBelief({ layers: [readLayer(), gift] });

  const d = belief.distribution(["the", "cat"]);
  assert.equal(d.probs["peleg"], undefined, "a form this book has never met takes no mass from any gift");
  for (const form in d.probs)
    assert.ok(form === UNSEEN || TOKENS.includes(form), `${form} is not a form this book has met`);

  // The gift is not silenced — its structure over the shared forms still lands.
  assert.ok(d.received_mass > 0, "what the gift can say about this book's own forms, it still says");
});

test("a gift with nothing sayable here falls to the reserve rather than being renormalised away", () => {
  const gift = createLayer({ id: "alien", tier: "received", giver: "elsewhere", order: 2, gamma: 1, alpha: 1 });
  gift.train("xylophone quokka xylophone quokka".split(" "));
  const belief = createBelief({ layers: [readLayer(["the", "cat"]), gift] });
  const d = belief.distribution(["the", "cat"]);
  assert.equal(d.received_mass, 0, "it placed nothing");
  assert.ok(d.probs[UNSEEN] > 0, "and its share became honest uncertainty, not silent renormalisation");
});

test("the gift fills the silence and does not overwrite the ground", () => {
  const gift = createLayer({ id: "gift", tier: "received", giver: "elsewhere", order: 2, gamma: 1, alpha: 1 });
  gift.train("the cat vanished the cat vanished the cat vanished".split(" "));

  // Barely any read evidence for this context: the gift is most of the answer.
  const thin = createBelief({ layers: [readLayer(["the", "cat"]), gift] });
  const thinD = thin.distribution(["the", "cat"]);

  // Plenty of read evidence for the same context: the gift is nearly inaudible.
  const thick = createBelief({ layers: [readLayer([...TOKENS, ...TOKENS, ...TOKENS]), gift] });
  const thickD = thick.distribution(["the", "cat"]);

  assert.ok(thinD.received_mass > thickD.received_mass, "the gift's share falls as the reader accumulates its own");
  assert.ok(thickD.lambda_read > thinD.lambda_read);
  // And a large gift cannot drown a small read layer by being large.
  const huge = createLayer({ id: "huge", tier: "received", giver: "elsewhere", order: 2, gamma: 1, alpha: 1 });
  huge.train("the cat vanished ".repeat(400).trim().split(" "));
  const withHuge = createBelief({ layers: [readLayer([...TOKENS, ...TOKENS, ...TOKENS]), huge] });
  assert.ok(
    Math.abs(withHuge.distribution(["the", "cat"]).lambda_read - thickD.lambda_read) < 1e-12,
    "lambda depends on the READ layer's evidence only, never on the size of the gift",
  );
});

// ── SEED.md #6: plural layers, and what the flat mixture discards ───────────
// Challenge #11 (multi-scale surprise disagreement): the single flattened
// p(form | context) provably cannot surface document/genre-scale disagreement
// once the read layer has accumulated enough evidence to make lambda_read
// dominate (measured on real material in
// scripts/adversarial/challenge-11-multi-scale-surprise-disagreement.mjs).
// `scaleDisagreement` is the new channel: it does not change what
// `distribution`/`probabilityOf` return, it names what they were about to
// blend away, the same way `nul::disagreement` names what plural grounds
// disagreed about instead of reconciling them.

test("scaleDisagreement reports one bits figure per layer, keyed by layer id", () => {
  const gift = createLayer({ id: "gift", tier: "received", giver: "elsewhere", order: 2, gamma: 1, alpha: 1 });
  gift.train("the cat vanished the cat vanished".split(" "));
  const belief = createBelief({ layers: [readLayer(), gift] });
  const d = belief.scaleDisagreement(["the", "cat"], "sat");
  assert.ok(Number.isFinite(d.bits.read), "the read layer's own surprisal is reported under its id");
  assert.ok(Number.isFinite(d.bits.gift), "the received layer's own surprisal is reported under its id");
  assert.ok(Number.isFinite(d.spread));
});

test("scaleDisagreement has no spread to report for a lone read layer — not zero, absent", () => {
  const d = beliefOver().scaleDisagreement(["the", "cat"], "sat");
  assert.deepEqual(Object.keys(d.bits), ["read"]);
  assert.equal(d.spread, null, "one layer cannot disagree with itself; null says so rather than a false 0");
});

test("scaleDisagreement surfaces a document/genre gap the flat mixture washes out", () => {
  // DOCUMENT: a read layer soaked in "sat" as the verb after "the cat".
  // GENRE: a received layer built from the same work but never places any
  // mass on "sat" here — an ordinary stand-in for a genre layer that simply
  // never met this local continuation.
  const heavyRead = readLayer([...TOKENS, ...TOKENS, ...TOKENS, ...TOKENS, ...TOKENS]);
  const genre = createLayer({ id: "genre", tier: "received", giver: "a disjoint excerpt of the same work", order: 2, gamma: 1, alpha: 1 });
  genre.train("the cat vanished the cat vanished the cat vanished".split(" "));
  const belief = createBelief({ layers: [heavyRead, genre] });

  const d = belief.scaleDisagreement(["the", "cat"], "sat");
  assert.ok(d.bits.read < d.bits.genre, "the read layer is far less surprised by its own well-worn continuation");
  assert.ok(d.spread > 3, `the layers should disagree sharply on this form: ${JSON.stringify(d.bits)}`);

  // The flat number the rest of the pipeline actually consumes collapses
  // toward the read layer once it dominates — exactly the averaging the
  // spread above is meant to make visible instead of silently absorbing.
  const dist = belief.distribution(["the", "cat"]);
  assert.ok(dist.lambda_read > 0.9, "read layer share of the flat mixture is already near-total here");
});

test("scaleDisagreement's bits use the same mass>0?mass:reserve convention witnessForm and candidates.js use", () => {
  const gift = createLayer({ id: "gift", tier: "received", giver: "elsewhere", order: 2, gamma: 1, alpha: 1 });
  gift.train("whale ship sea captain".split(" "));
  const belief = createBelief({ layers: [readLayer(), gift] });
  const ctx = ["the", "cat"];
  const form = "mat";
  const d = belief.scaleDisagreement(ctx, form);
  for (const [id, layer] of [
    ["read", readLayer()],
    ["gift", gift],
  ]) {
    const { mass, reserve } = layer.massOf(ctx, form);
    const p = mass > 0 ? mass : reserve;
    const expected = p > 0 ? -Math.log2(p) : -Math.log2(Number.MIN_VALUE);
    assert.ok(Math.abs(d.bits[id] - expected) < 1e-9, `${id} layer priced with a different rule than witnessForm uses`);
  }
});

test("a received layer never observes the material under test", () => {
  const priors = [{ id: "dracula", giver: "Bram Stoker", tokens: ["the", "cat", "vanished"] }];
  const emitter = priorAugmented({ order: 2, alpha: 1, rho: 0.999, priors });
  const before = emitter.belief.receivedLayers.map((l) => l.observations);
  emitter.prime(TOKENS);
  emitter.observe(TOKENS);
  assert.deepEqual(
    emitter.belief.receivedLayers.map((l) => l.observations),
    before,
    "no gift — real or control — grows by reading this text",
  );
  // The noise floor rides along as a received layer and names itself as one.
  assert.deepEqual(
    emitter.belief.givers.map((g) => g.id),
    ["dracula", "shuffled:dracula"],
  );
  assert.match(emitter.belief.givers[1].giver, /ORDER DESTROYED BY SHUFFLE/);
});

test("relevance is earned against this text, not assigned by what a gift knows", () => {
  // Two gifts. One continues THIS material; the other is fluent English that
  // never continues it. Under the old peer weighting they would split the
  // borrowed share by their evidence for the context — so the irrelevant one
  // would be loudest wherever it happened to know the context best.
  const relevant = { id: "relevant", giver: "a book that goes on like this one", tokens: [...TOKENS, ...TOKENS] };
  const irrelevant = { id: "irrelevant", giver: "a book about something else", tokens: "whale ship sea captain whale ship sea captain".split(" ") };
  const emitter = priorAugmented({ order: 2, alpha: 1, rho: 0.999, priors: [relevant, irrelevant], noiseFloor: false });
  emitter.prime([...TOKENS, ...TOKENS, ...TOKENS]);

  const report = emitter.belief.relevanceReport();
  const share = Object.fromEntries(report.layers.map((l) => [l.id, l.share]));
  assert.ok(
    share.relevant > share.irrelevant,
    `the gift that anticipates this text should earn more: ${JSON.stringify(share)}`,
  );
  assert.equal(report.observations, TOKENS.length * 3);
  assert.equal(report.rho, 0.999);
});

test("a gift's share is only a finding if it beats a gift that should earn nothing", () => {
  const priors = [{ id: "dracula", giver: "Bram Stoker", tokens: "the cat sat on the mat and then it sat again".split(" ") }];
  const emitter = priorAugmented({ order: 2, alpha: 1, rho: 0.999, priors, seed: 7 });
  emitter.prime(TOKENS);

  const report = emitter.belief.relevanceReport();
  const control = report.layers.find((l) => l.is_noise_control);
  assert.ok(control, "a noise floor is present by default — a share with nothing under it is not a finding");
  assert.ok(report.noise_floor > 0);
  // The shuffle keeps the source's word frequencies exactly and destroys only
  // its order, so this is a real bar rather than a formality.
  for (const l of report.layers) assert.equal(typeof l.above_noise, "boolean");

  // With no control supplied, the absence is stated rather than read as cleared.
  const bare = priorAugmented({ order: 2, alpha: 1, rho: 0.999, priors, noiseFloor: false });
  bare.prime(TOKENS);
  const bareReport = bare.belief.relevanceReport();
  assert.equal(bareReport.noise_floor, null);
  assert.equal(bareReport.layers[0].above_noise, null);
});

test("AMENDMENT IV: relevance is never similarity — it is the surprise that did not happen", () => {
  // The clause that costs something. Two gifts:
  //
  //   lookalike  shares this text's whole vocabulary and NONE of its order.
  //              Maximally similar by any appearance measure — same words,
  //              same frequencies — and it anticipates nothing.
  //   stranger   shares almost none of this text's vocabulary but continues
  //              the one context that actually recurs here.
  //
  // Every appearance-based rule picks the lookalike. SEED.md #0 refuses
  // identity by appearance "never by appearance, not even in principle", and
  // Amendment IV extends that refusal to relevance. So the stranger must win.
  const lookalike = {
    id: "lookalike",
    giver: "a book with this book's words in the wrong order",
    tokens: "mat the on sat floor cat the dog sat the on mat cat the".split(" "),
  };
  const stranger = {
    id: "stranger",
    giver: "a book that shares little but continues what recurs",
    tokens: "quoth zarathustra the cat sat on the mat the cat sat on the mat".split(" "),
  };
  const emitter = priorAugmented({
    order: 2,
    alpha: 1,
    rho: 0.999,
    priors: [lookalike, stranger],
    noiseFloor: false,
  });
  emitter.prime([...TOKENS, ...TOKENS, ...TOKENS]);

  const share = Object.fromEntries(emitter.belief.relevanceReport().layers.map((l) => [l.id, l.share]));
  assert.ok(
    share.stranger > share.lookalike,
    `relevance must follow surprise-reduction, not resemblance: ${JSON.stringify(share)}`,
  );
});

test("AMENDMENT IV: standing can be lost — a prior relevant once is not relevant forever", () => {
  // Restriction 2. Standing that cannot decay is a verdict passed once at the
  // beginning, which is sclerosis at the level of the priors.
  const early = { id: "early", giver: "carries the opening", tokens: "a b a b a b a b".split(" ") };
  const late = { id: "late", giver: "carries the ending", tokens: "y z y z y z y z".split(" ") };
  const emitter = priorAugmented({ order: 2, alpha: 1, rho: 0.9, priors: [early, late], noiseFloor: false });

  emitter.prime("a b a b a b a b a b a b".split(" "));
  const first = Object.fromEntries(emitter.belief.relevanceReport().layers.map((l) => [l.id, l.share]));
  assert.ok(first.early > first.late, "the gift carrying this stretch leads");

  emitter.observe("y z y z y z y z y z y z y z y z".split(" "));
  const second = Object.fromEntries(emitter.belief.relevanceReport().layers.map((l) => [l.id, l.share]));
  assert.ok(second.late > second.early, "and loses that lead when the material moves on");
});

test("AMENDMENT IV: lowering surprise earns audibility, never standing", () => {
  // Restriction 4. A gift can become the loudest voice in the mixture and
  // still cannot make the continuation testimony — the crossing does not
  // consult relevance at all.
  const gift = { id: "loud", giver: "a very relevant book", tokens: "the cat floor the cat floor".split(" ") };
  const emitter = priorAugmented({ order: 2, alpha: 1, rho: 0.999, priors: [gift], noiseFloor: false });
  emitter.prime(["the", "cat", "sat", "floor", "the", "cat"]);

  const emission = emitter.emit({ horizon: 1, conditioning: "free-running", selection: "mode", seed: 0 });
  assert.ok(emission.received_fraction > 0, "the gift is audible");
  assert.equal(emission.grounded, false);
  assert.equal(admissibleAsTestimony(emission).gap, "unreceived_origin", "and still cannot testify");
});

test("rho is declared whenever there is a share to divide", () => {
  const two = [
    { id: "a", giver: "someone", tokens: ["x", "y"] },
    { id: "b", giver: "someone else", tokens: ["y", "z"] },
  ];
  assert.throws(() => priorAugmented({ order: 2, alpha: 1, priors: two, noiseFloor: false }), /rho/);
  // One gift and no control: there is no share to divide, so demanding the
  // number would be ceremony.
  assert.doesNotThrow(() =>
    priorAugmented({ order: 2, alpha: 1, priors: [two[0]], noiseFloor: false }),
  );
});

// ── Refusing to speak is a result ───────────────────────────────────────────

test("a belief with no ground returns a gap instead of inventing a word", () => {
  const empty = createBelief({ layers: [createLayer({ id: "read", tier: "read", order: 2, gamma: 1, alpha: 1 })] });
  const out = emitSequence({ belief: empty, context: [], horizon: 3, conditioning: "free-running", selection: "mode" });
  assert.ok(isGap(out), "no material read, nothing to say");
});

test("the unseen reserve is named, not renormalised away", () => {
  const d = beliefOver().distribution(["the", "cat"]);
  assert.ok(d.probs[UNSEEN] > 0, "there is always mass for a form never met");
  const total = Object.values(d.probs).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `the distribution sums to 1, got ${total}`);
});

// ── Measurement integrity ───────────────────────────────────────────────────

test("MEASURED DEFECT, now pinned: the reserve is not a bucket for 'any word but my guess'", () => {
  // This is the shape baseline:copy-previous had on its first run. It put a
  // sliver on its guess and everything else on the reserve, so every target it
  // MISSED collected nearly the whole reserve and cost it almost nothing. It
  // beat every real belief in the repo by declining to say anything.
  const cheat = {
    kind: "sequence",
    unseen_label: UNSEEN,
    // note: covers_vocabulary NOT asserted
    steps: [{ kind: "categorical", probs: { cat: 0.001, [UNSEEN]: 0.999 } }],
  };
  const cheated = sequenceLogLoss(cheat, ["mat"]);
  const honest = sequenceLogLoss({ ...cheat, covers_vocabulary: true }, ["mat"]);
  assert.ok(
    cheated.loss > honest.loss,
    "without the assertion, a missing target takes the floor instead of collecting the reserve",
  );
  assert.ok(cheated.loss > 100, "and the floor is genuinely punishing");
  assert.equal(cheated.unplaced, 1);
});

test("a belief places mass on every form it has met — so its reserve claim is honest", () => {
  const belief = beliefOver();
  const d = belief.distribution(["the", "cat"]);
  assert.equal(d.covers_vocabulary, true);
  for (const form of new Set(TOKENS))
    assert.ok(d.probs[form] > 0, `met "${form}" but placed no mass on it — the reserve claim would be a lie`);
});

test("the fast path and the full distribution are the same belief", () => {
  // `probabilityOf` exists because building a vocabulary-sized distribution
  // once per token made a book-length read quadratic. It is an optimisation of
  // an identity, so the identity is pinned here: two code paths computing the
  // same quantity is exactly the situation that drifts silently.
  const gift = createLayer({ id: "g", tier: "received", giver: "elsewhere", order: 2, gamma: 1, alpha: 1 });
  gift.train("the cat vanished into the night".split(" "));
  for (const belief of [beliefOver(), createBelief({ layers: [readLayer(), gift] })]) {
    for (const ctx of [[], ["the"], ["the", "cat"], ["never", "seen"]]) {
      const d = belief.distribution(ctx);
      for (const form of [...new Set(TOKENS), "vanished", "aardvark"]) {
        const { p, reserve } = belief.probabilityOf(ctx, form);
        assert.ok(
          Math.abs(p - (d.probs[form] ?? 0)) < 1e-12,
          `p(${form} | ${ctx.join(" ")}) disagreed: fast ${p} vs full ${d.probs[form] ?? 0}`,
        );
        assert.ok(Math.abs(reserve - (d.probs[UNSEEN] ?? 0)) < 1e-12, "and the reserves agree");
      }
    }
  }
});

// ── The shared alphabet (SEED.md Amendment IV, consequence 5) ──────────────

test("an abstraction is a prior and must name its giver", () => {
  assert.throws(
    () => createLayer({ id: "r", tier: "read", order: 2, gamma: 1, alpha: 1, abstraction: { id: "x", of: (w) => w } }),
    /must name its giver/,
  );
  assert.throws(
    () => classAbstraction({ id: "c", classes: { a: "A" } }),
    /must name its giver/,
  );
  assert.throws(() => classAbstraction({ giver: "someone", classes: {} }), /abstracts nothing/);
});

test("an abstracted context generalises across forms the surface context cannot", () => {
  // The read material only ever says "he had gone". A surface belief asked
  // about "she has gone" has met neither trigram nor bigram and falls to
  // unigram. An abstracted one has met the CLASS context and can still place
  // the successor.
  const classes = { he: "PRON", she: "PRON", had: "AUX", has: "AUX" };
  const abstraction = classAbstraction({ id: "toy", giver: "a hand-written inventory, for test", classes });
  const material = "he had gone away he had gone away he had gone away".split(" ");

  const surface = createBelief({ layers: [createLayer({ id: "read", tier: "read", order: 3, gamma: 1, alpha: 1 }).train(material)] });
  const abstract = createBelief({
    layers: [createLayer({ id: "read", tier: "read", order: 3, gamma: 1, alpha: 1, abstraction }).train(material)],
  });

  const unseen = ["she", "has", "gone"];
  const pSurface = surface.probabilityOf(unseen, "away").p;
  const pAbstract = abstract.probabilityOf(unseen, "away").p;
  assert.ok(
    pAbstract > pSurface,
    `the abstraction should carry an unseen context: surface ${pSurface}, abstract ${pAbstract}`,
  );

  // And it must not disturb a context the surface layer HAS met: the exact
  // match outranks its abstraction at the same reach.
  const seen = ["he", "had", "gone"];
  assert.ok(abstract.probabilityOf(seen, "away").p > 0.5, "an exact context still dominates");
});

test("a form its abstraction cannot place stands for itself, never in a shared unknown bucket", () => {
  // A shared UNKNOWN bucket would make every rare word predict every other
  // rare word — the one grouping guaranteed to be wrong, and the one that
  // would look like it was working, since rare words are where backoff mass
  // lands.
  const abstraction = classAbstraction({ id: "tiny", giver: "test", classes: { he: "PRON" } });
  const layer = createLayer({ id: "read", tier: "read", order: 2, gamma: 1, alpha: 1, abstraction });
  layer.train("zebra qualm frobnicate zebra qualm frobnicate".split(" "));
  const belief = createBelief({ layers: [layer] });
  // "qualm" and "frobnicate" are both unplaced by the inventory. If they
  // shared a bucket, the context ["zebra","qualm"] would predict whatever
  // followed ["zebra","frobnicate"].
  const d = belief.distribution(["zebra", "qualm"]);
  assert.ok(d.probs["frobnicate"] > 0, "the real successor is placed");
  assert.equal(d.covers_vocabulary, true);
});

test("the abstracted candidate is a minimal contrast and refuses to be empty", () => {
  assert.throws(() => abstracted({ order: 2, alpha: 1 }), /it IS the baseline/);
  const abstraction = classAbstraction({ id: "toy", giver: "test", classes: { the: "DET" } });
  const e = abstracted({ order: 2, alpha: 1, abstraction });
  assert.equal(e.id, "candidate:abstracted-toy");
  assert.equal(e.belief.readLayer.abstraction.giver, "test");
});

test("composed abstractions are ordered, never merged by vote", () => {
  const a = classAbstraction({ id: "a", giver: "first", classes: { x: "A" } });
  const b = classAbstraction({ id: "b", giver: "second", classes: { x: "B", y: "C" } });
  const composed = composeAbstractions(a, b);
  assert.equal(composed.of("x"), "A", "the first inventory that places a form wins");
  assert.equal(composed.of("y"), "C", "and the second still gets forms the first left alone");
  assert.equal(composed.of("z"), "z");
  assert.match(composed.giver, /first/);
  assert.match(composed.giver, /second/);
});

test("the fast path still agrees with the full distribution under an abstraction", () => {
  // The chain got a second kind of table; the identity that caught the
  // separator bug has to keep holding across it.
  const abstraction = classAbstraction({
    id: "toy",
    giver: "test",
    classes: { the: "DET", a: "DET", cat: "N", dog: "N", mat: "N", floor: "N" },
  });
  const layer = createLayer({ id: "read", tier: "read", order: 2, gamma: 1, alpha: 1, abstraction }).train(TOKENS);
  const belief = createBelief({ layers: [layer] });
  for (const ctx of [[], ["the"], ["the", "cat"], ["a", "dog"], ["never", "seen"]]) {
    const d = belief.distribution(ctx);
    for (const form of [...new Set(TOKENS), "aardvark"]) {
      const { p, reserve } = belief.probabilityOf(ctx, form);
      assert.ok(Math.abs(p - (d.probs[form] ?? 0)) < 1e-12, `p(${form}|${ctx.join(" ")}) disagreed`);
      assert.ok(Math.abs(reserve - (d.probs[UNSEEN] ?? 0)) < 1e-12);
    }
  }
});

test("horizon mismatch is refused, never truncated", () => {
  const emission = emitSequence({ belief: beliefOver(), context: ["the"], horizon: 3, conditioning: "free-running", selection: "mode" });
  assert.throws(() => sequenceLogLoss(emission, ["cat", "sat"]), /horizon mismatch/);
});

test("free-running and teacher-forced are different measurements, and neither is a default", () => {
  assert.throws(
    () => emitSequence({ belief: beliefOver(), context: ["the"], horizon: 2 }),
    /never defaulted/,
  );
  assert.throws(
    () =>
      createGenerationTask({
        target_type: "token-sequence",
        horizon: 2,
        scoring_rule: "sequence-log-loss",
        baseline_ids: ["b"],
        prior_ids: [],
        population: "t",
      }),
    /conditioning/,
  );

  // And they genuinely differ. The difference lives in the COMMITTED
  // DISTRIBUTIONS, not necessarily in the emitted forms — on this material both
  // runs happen to say the same three words, and a test that compared only the
  // emitted text would have called the two identical and passed forever. From
  // step 2 on, the free-running run is conditioning on "the cat" and the
  // teacher-forced run on "the dog", and those are not the same belief.
  const belief = beliefOver();
  const target = ["dog", "sat", "on"];
  const free = emitSequence({ belief, context: ["the"], horizon: 3, conditioning: "free-running", selection: "mode", target });
  const forced = emitSequence({ belief, context: ["the"], horizon: 3, conditioning: "teacher-forced", selection: "mode", target });
  assert.deepEqual(free.steps[0].probs, forced.steps[0].probs, "step 1 has the same context either way");
  assert.notDeepEqual(free.steps[1].probs, forced.steps[1].probs, "step 2 does not");
  assert.equal(free.conditioning, "free-running");
  assert.equal(forced.conditioning, "teacher-forced");
});

test("stride is declared — overlapping draws are not independent", () => {
  assert.throws(() => [...walkForwardSequence(TOKENS, { warmup: 2, horizon: 2 })], /stride is declared/);
});

test("a candidate that has become its own control is refused rather than reported as a null result", () => {
  assert.throws(() => decayedBelief({ order: 2, alpha: 1, gamma: 1 }), /the contrast is empty/);
  assert.throws(() => priorAugmented({ order: 2, alpha: 1, priors: [] }), /it IS the baseline/);
});

// ── The seal, on a continuation ─────────────────────────────────────────────

test("the whole continuation is sealed before any of it is revealed", () => {
  const draws = [...walkForwardSequence(TOKENS, { warmup: 4, horizon: 3, stride: 3 })];
  const first = draws[0];
  assert.equal(
    first.reveal_not_before_step,
    first.committed_at_step + 3,
    "not +1 — a free-running emitter must not see its own first target before committing its second",
  );

  const emission = emitSequence({
    belief: beliefOver(),
    context: first.history,
    horizon: 3,
    conditioning: "free-running",
    selection: "mode",
  });
  const commitment = commitPrediction({
    task_id: "task:test",
    candidate_id: "candidate:test",
    candidate_version_hash: "v1",
    input_snapshot_hash: "snap",
    predictive_output: emission,
    committed_at_step: first.committed_at_step,
    reveal_not_before_step: first.reveal_not_before_step,
  });

  assert.throws(
    () =>
      revealAndScore({
        commitment,
        observed: [...first.target],
        revealed_at_step: first.committed_at_step + 1,
        scoring_rule: "sequence-log-loss",
      }),
    /leakage refused/,
  );

  const ok = revealAndScore({
    commitment,
    observed: [...first.target],
    revealed_at_step: first.reveal_not_before_step,
    scoring_rule: "sequence-log-loss",
  });
  assert.ok(Number.isFinite(ok.loss));
  assert.equal(ok.proper, true);
});

test("a committed continuation cannot be edited after it is sealed", () => {
  const emission = emitSequence({ belief: beliefOver(), context: TOKENS, horizon: 2, conditioning: "free-running", selection: "mode" });
  const commitment = commitPrediction({
    task_id: "task:test",
    candidate_id: "candidate:test",
    candidate_version_hash: "v1",
    input_snapshot_hash: "snap",
    predictive_output: emission,
    committed_at_step: 5,
    reveal_not_before_step: 7,
  });
  const tampered = { ...commitment, predictive_output: { ...emission, steps: [{ kind: "categorical", probs: { mat: 1 } }] } };
  assert.throws(
    () => revealAndScore({ commitment: tampered, observed: ["mat", "the"], revealed_at_step: 7, scoring_rule: "sequence-log-loss" }),
    /altered after it was sealed/,
  );
});

test("the sequence kind reaches the shared scoring table", () => {
  const emission = emitSequence({ belief: beliefOver(), context: TOKENS, horizon: 2, conditioning: "free-running", selection: "mode" });
  const proper = score(emission, ["the", "cat"], { rule: "sequence-log-loss" });
  assert.equal(proper.proper, true);
  // The readable rules exist and are honestly flagged improper.
  assert.equal(score(emission, ["the", "cat"], { rule: "prefix-agreement" }).proper, false);
  assert.equal(score(emission, ["the", "cat"], { rule: "exact-match" }).proper, false);
  // And a proper rule for a different kind reports that it does not apply,
  // rather than laundering a sequence into a number.
  const notApplicable = score(emission, ["the", "cat"], { rule: "crps" });
  assert.equal(notApplicable.loss, null);
  assert.equal(notApplicable.proper, false);
});

// ── Finishing sentences, and the whole loop ─────────────────────────────────

test("sentence completion withholds the tail and never pads a target no one wrote", () => {
  // Sentence 2 is exactly as long as the prefix, so there is nothing to
  // withhold and it is skipped rather than padded. Sentence 3 has one form
  // past the prefix and yields a truncated target of exactly that one form.
  const sentences = [["a", "b", "c", "d"], ["e", "f"], ["g", "h", "i"], ["j", "k", "l", "m", "n"]];
  const draws = [...walkSentenceCompletions(sentences, { warmupSentences: 1, prefix: 2, horizon: 3 })];
  assert.equal(draws.length, 2, "the length-2 sentence yields no draw at prefix 2");
  assert.deepEqual([...draws[0].target], ["i"], "a sentence with one form past the prefix yields one target");
  assert.equal(draws[0].truncated, true);
  assert.deepEqual([...draws[1].target], ["l", "m", "n"]);
  assert.equal(draws[1].reveal_not_before_step, draws[1].committed_at_step + 3);
});

test("the prequential loop runs, and every candidate clears the uniform floor", () => {
  const stream = [];
  for (let i = 0; i < 40; i++) stream.push(...TOKENS);
  const task = createGenerationTask({
    target_type: "token-sequence",
    horizon: 3,
    conditioning: "free-running",
    selection: "mode",
    scoring_rule: "sequence-log-loss",
    baseline_ids: ["baseline:uniform-vocab", "baseline:unigram", "baseline:markov-2", "baseline:copy-previous"],
    prior_ids: [],
    population: "conformance",
  });
  const out = runGeneration({
    tokens: stream,
    draws: walkForwardSequence(stream, { warmup: 60, horizon: 3, stride: 3 }),
    candidates: [
      decayedBelief({ order: 2, alpha: 1, gamma: 0.999 }),
      regimeBelief({ order: 2, alpha: 1, window: 6, draws: 64, tolerance: 2 }),
    ],
    baselines: defaultGenerationBaselines({ order: 2, alpha: 1, horizon: 3 }),
    task,
    primeUpTo: 60,
    population: "conformance",
    source_versions: ["conformance@1"],
  });

  assert.ok(out.scored > 50, `expected a real number of scored draws, got ${out.scored}`);
  for (const id of ["candidate:decayed-belief-g0.999", "candidate:regime-belief"]) {
    const record = out.records.get(id);
    assert.ok(record.competency_gain["baseline:uniform-vocab"] > 0, `${id} failed to beat the uniform floor`);
    assert.equal(record.schema, "CompetencyRecord@1");
    assert.ok(record.scope.evaluation_protocol.includes("free-running"));
  }
  // A read-only run borrows nothing, and every emission may testify.
  for (const id of ["candidate:decayed-belief-g0.999", "baseline:markov-2"]) {
    assert.equal(out.testimony[id].borrowed, 0);
    assert.equal(out.testimony[id].mean_received_fraction, 0);
  }
});

test("the competency scope is required — a gain with no scope is unfalsifiable, not weak", () => {
  const stream = [];
  for (let i = 0; i < 20; i++) stream.push(...TOKENS);
  const task = createGenerationTask({
    target_type: "token-sequence",
    horizon: 2,
    conditioning: "free-running",
    selection: "mode",
    scoring_rule: "sequence-log-loss",
    baseline_ids: ["baseline:markov-2"],
    prior_ids: [],
    population: "conformance",
  });
  assert.throws(
    () =>
      runGeneration({
        tokens: stream,
        draws: walkForwardSequence(stream, { warmup: 40, horizon: 2, stride: 2 }),
        candidates: [decayedBelief({ order: 2, alpha: 1, gamma: 0.99 })],
        baselines: [markov({ order: 2, alpha: 1 })],
        task,
        primeUpTo: 40,
        population: "conformance",
        // source_versions deliberately omitted
      }),
    /source_versions/,
  );
});

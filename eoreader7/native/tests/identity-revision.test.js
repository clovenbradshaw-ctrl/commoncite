import test from "node:test";
import assert from "node:assert/strict";
import { receivedGround, applyDelta } from "../kernel/fold.js";
import { hyperedge } from "../kernel/hypergraph.js";
import { deriveIdentityRevision } from "../kernel/identity.js";
import { textIdentityEvidence } from "../adapters/text/identity-evidence.js";

test("apposition opens identity support; separated co-presence attacks it", () => {
  const support = textIdentityEvidence("The hooded courier, Rowan, returned.", { witness: "w:1" });
  assert.equal(support.supports.length, 1);
  assert.equal(support.supports[0].left, "the hooded courier");
  assert.equal(support.supports[0].right, "rowan");

  const live = [{ schema: "EOIdentityAlternative@1", id: "identity:rowan:the_hooded_courier", left: "rowan", right: "the hooded courier", standing: "live_hypothesis", supportRefs: ["w:1"], attackRefs: [] }];
  const attack = textIdentityEvidence("Rowan waited at the fountain while the hooded courier crossed behind him.", { alternatives: live, witness: "w:3" });
  assert.equal(attack.attacks.length, 1);
  assert.equal(attack.attacks[0].reason, "text_separated_copresentation");
});

test("identity contradiction SEG/DEFs the prior reading and REC-canonicalizes affected relations", () => {
  const raw = hyperedge({
    id: "edge:token",
    relation: "carried",
    participants: [
      { role: "actor", standing: "unresolved_surface", ref: "occ:1", surface: "the hooded courier" },
      { role: "object", standing: "unresolved_surface", ref: "occ:2", surface: "the blue token" },
    ],
    witness: "w:edge",
  });
  const fold0 = receivedGround({ graphEntries: [raw] });

  const supportDelta = deriveIdentityRevision({
    fold: fold0,
    supports: [{ left: "the hooded courier", right: "Rowan", witness: "w:1" }],
  });
  const fold1 = applyDelta(fold0, supportDelta);
  const live = fold1.unresolvedAlternatives.find((x) => x.schema === "EOIdentityAlternative@1");
  assert.equal(live?.standing, "live_hypothesis");
  const canonical1 = fold1.graphEntries.find((x) => x.id === "canonical:edge:token");
  assert.deepEqual(canonical1.participants[0].alternatives, ["rowan", "the hooded courier"]);
  assert.ok(supportDelta.operations.some((x) => x.operator === "CON"));
  assert.ok(supportDelta.operations.some((x) => x.operator === "REC"));

  const attackDelta = deriveIdentityRevision({
    fold: fold1,
    attacks: [{ left: "the hooded courier", right: "Rowan", witness: "w:3", reason: "incompatible multiplicity" }],
  });
  const fold2 = applyDelta(fold1, attackDelta);
  assert.ok(attackDelta.operations.some((x) => x.operator === "SEG"));
  assert.ok(attackDelta.operations.some((x) => x.operator === "DEF"));
  assert.ok(attackDelta.operations.some((x) => x.operator === "REC"));

  const split = fold2.unresolvedAlternatives.find((x) => x.id === live.id);
  assert.equal(split.standing, "distinct");
  const canonical2 = fold2.graphEntries.find((x) => x.id === "canonical:edge:token");
  assert.deepEqual(canonical2.participants[0].alternatives, ["the hooded courier"]);

  // Historical witness stays raw and unchanged. Only the current canonical
  // projection changes; the earlier Fold still remembers the earlier reading.
  assert.deepEqual(fold2.graphEntries.find((x) => x.id === raw.id), raw);
  assert.equal(fold1.unresolvedAlternatives.find((x) => x.id === live.id).standing, "live_hypothesis");
  assert.deepEqual(fold1.graphEntries.find((x) => x.id === "canonical:edge:token").participants[0].alternatives, ["rowan", "the hooded courier"]);
});

test("canonicalizationFloor: single-witness support opens the alternative but does not project it; the second witness does", () => {
  const raw = hyperedge({
    id: "edge:floor",
    relation: "carried",
    participants: [
      { role: "actor", standing: "unresolved_surface", ref: "occ:1", surface: "the hooded courier" },
      { role: "object", standing: "unresolved_surface", ref: "occ:2", surface: "the blue token" },
    ],
    witness: "w:edge",
  });
  const fold0 = receivedGround({ graphEntries: [raw] });

  // First support: below the declared floor of 2 — the alternative lands
  // live on the fold, but NO canonical projection is written (single-
  // witness testimony must not rewrite the canonical past).
  const first = deriveIdentityRevision({
    fold: fold0,
    supports: [{ left: "the hooded courier", right: "Rowan", witness: "w:1" }],
    canonicalizationFloor: 2,
  });
  const fold1 = applyDelta(fold0, first);
  const live = fold1.unresolvedAlternatives.find((x) => x.schema === "EOIdentityAlternative@1");
  assert.equal(live?.standing, "live_hypothesis", "the alternative itself is not gated — only projection is");
  assert.equal(live?.supportRefs.length, 1);
  const canonicalAfterOne = fold1.graphEntries.find((x) => x.id === "canonical:edge:floor");
  assert.equal(
    canonicalAfterOne?.participants?.[0]?.alternatives?.includes("rowan") ?? false,
    false,
    "below the floor, the canonical projection must not carry the identity",
  );

  // Second, independent support: the floor is met — the SAME evidence
  // grammar now projects, and the canonical edge carries the identity.
  const second = deriveIdentityRevision({
    fold: fold1,
    supports: [{ left: "the hooded courier", right: "Rowan", witness: "w:2" }],
    canonicalizationFloor: 2,
  });
  const fold2 = applyDelta(fold1, second);
  const canonicalAfterTwo = fold2.graphEntries.find((x) => x.id === "canonical:edge:floor");
  assert.deepEqual(canonicalAfterTwo.participants[0].alternatives, ["rowan", "the hooded courier"]);
});

test("canonicalizationFloor is a declared positive integer or absent — never a fraction or a guess", () => {
  assert.throws(() => deriveIdentityRevision({ canonicalizationFloor: 0 }), /positive integer/);
  assert.throws(() => deriveIdentityRevision({ canonicalizationFloor: 1.5 }), /positive integer/);
  // Absent: byte-identical to before the option existed (the two tests
  // above this file already had pin that behavior).
  assert.doesNotThrow(() => deriveIdentityRevision({}));
});

test("expectations ride the identity lifecycle when a floor is declared: open below floor, fulfilled at floor, violated on attack", () => {
  const fold0 = receivedGround({});

  // Open: a new below-floor alternative is the fold's own prediction.
  const first = deriveIdentityRevision({
    fold: fold0,
    supports: [{ left: "the hooded courier", right: "Rowan", witness: "w:1" }],
    canonicalizationFloor: 2,
  });
  const fold1 = applyDelta(fold0, first);
  const exp1 = (fold1.expectations ?? []).find((x) => x.schema === "EOExpectation@1");
  assert.ok(exp1, "an expectation opens with the below-floor alternative");
  assert.equal(exp1.state, "open");
  assert.match(exp1.hypothesis, /corroboration expected/);

  // Fulfilled: the second independent witness reaches the floor.
  const second = deriveIdentityRevision({
    fold: fold1,
    supports: [{ left: "the hooded courier", right: "Rowan", witness: "w:2" }],
    canonicalizationFloor: 2,
  });
  const fold2 = applyDelta(fold1, second);
  const exp2 = (fold2.expectations ?? []).find((x) => x.id === exp1.id);
  assert.equal(exp2.state, "fulfilled");
  const fulfilledOp = second.operations.find((op) => op.consequence?.kind === "expectation_fulfilled");
  assert.equal(fulfilledOp.operator, "EVA", "a fulfilment is a judgment against evidence — EVA, expectationTransition's own typing");

  // Violated: an attack on a different, still-open expectation.
  const otherOpen = deriveIdentityRevision({
    fold: fold2,
    supports: [{ left: "the tall stranger", right: "Mira", witness: "w:3" }],
    canonicalizationFloor: 2,
  });
  const fold3 = applyDelta(fold2, otherOpen);
  const attacked = deriveIdentityRevision({
    fold: fold3,
    attacks: [{ left: "the tall stranger", right: "Mira", witness: "w:4" }],
    canonicalizationFloor: 2,
  });
  const fold4 = applyDelta(fold3, attacked);
  const expViolated = (fold4.expectations ?? []).find((x) => x.id === "expectation:identity:mira:the_tall_stranger");
  assert.equal(expViolated.state, "violated");
});

test("a support below a higher floor STRENGTHENS the expectation; no floor declared means no expectations at all", () => {
  const fold0 = receivedGround({});
  const first = deriveIdentityRevision({ fold: fold0, supports: [{ left: "the healer", right: "Elena", witness: "w:1" }], canonicalizationFloor: 3 });
  const fold1 = applyDelta(fold0, first);
  const second = deriveIdentityRevision({ fold: fold1, supports: [{ left: "the healer", right: "Elena", witness: "w:2" }], canonicalizationFloor: 3 });
  const fold2 = applyDelta(fold1, second);
  const exp = (fold2.expectations ?? []).find((x) => x.schema === "EOExpectation@1");
  assert.equal(exp.state, "strengthened", "two of three witnesses: strengthened, not fulfilled");

  const bare = deriveIdentityRevision({ fold: receivedGround({}), supports: [{ left: "the healer", right: "Elena", witness: "w:1" }] });
  const bareFold = applyDelta(receivedGround({}), bare);
  assert.equal((bareFold.expectations ?? []).length, 0, "no floor, no expectations — byte-identical to before");
});

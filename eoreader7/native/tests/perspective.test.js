// native/tests/perspective.test.js — the walls on who-holds-what.
//
// The failure this organ exists to prevent is a collapse, not a crash: a
// reading that lets "Victor says the creature is a fiend" become "the
// creature is a fiend". Every test here is one shape of that collapse,
// refused.

import test from "node:test";
import assert from "node:assert/strict";
import {
  READER, BASIS, STANCE,
  projectPerspectives, commonGround, divergence, mentalModel, perspectiveOperation,
} from "../kernel/perspective.js";
import { deltaFold } from "../kernel/fold.js";

const log = (...ops) => ops.map((op) => deltaFold([op]));

test("a perspective act lands in Lens — the cell the algebra already gives Interpretation x Figure", () => {
  const held = perspectiveOperation({ holder: "victor", claim: "creature:is:fiend", witness: "vol2ch2" });
  assert.equal(held.terrain, "Lens");
  assert.equal(held.operator, "EVA", "holding a claim against a ground is Relate-Interpretation");
  assert.equal(held.domain, "Interpretation");
  assert.equal(perspectiveOperation({ holder: "victor", claim: "c", stance: STANCE.CONCEDED }).operator, "REC", "conceding is a re-zero");
  assert.equal(perspectiveOperation({ holder: "walton", claim: null }).operator, "DEF", "opening a holder distinguishes them from the reading");
  assert.throws(() => perspectiveOperation({ claim: "x" }), /named/, "an unattributed belief is refused");
});

test("what a character asserts never becomes what the reading witnessed", () => {
  const projected = projectPerspectives(log(
    perspectiveOperation({ holder: READER, claim: "creature:killed:william", witness: "trial" }),
    perspectiveOperation({ holder: "victor", claim: "creature:is:fiend", witness: "vol2ch2" }),
  ));
  const reader = projected.perspectives[READER];
  const victor = projected.perspectives.victor;
  assert.equal(reader.beliefs[0].basis, BASIS.WITNESSED, "the reading's own act is witnessed");
  assert.equal(victor.beliefs[0].basis, BASIS.ASSERTED, "a character's claim is asserted, never witnessed");
  assert.ok(!reader.beliefs.some((b) => b.claim === "creature:is:fiend"), "Victor's claim did not leak into the reading's own beliefs");
});

test("relayed belief keeps its chain, and depth is a fact about the claim", () => {
  const projected = projectPerspectives(log(
    perspectiveOperation({ holder: READER, claim: "felix:taught:safie", via: ["victor", "creature"], witness: "vol2ch5" }),
  ));
  const belief = projected.perspectives[READER].beliefs[0];
  assert.equal(belief.basis, BASIS.REPORTED, "a via chain makes it reported by construction, without anyone declaring it");
  assert.deepEqual(belief.via, ["victor", "creature"]);
});

test("divergence splits asymmetry from conflict — one number would hide which is present", () => {
  const projected = projectPerspectives(log(
    perspectiveOperation({ holder: READER, claim: "creature:killed:william" }),
    perspectiveOperation({ holder: READER, claim: "justine:is:innocent" }),
    perspectiveOperation({ holder: "geneva", claim: "justine:is:innocent", stance: STANCE.REFUSES }),
  ));
  const d = divergence(projected, READER, "geneva");
  assert.deepEqual(d.asymmetric.map((x) => x.claim), ["creature:killed:william"], "what the reader knows and Geneva has no belief about at all");
  assert.deepEqual(d.conflicting.map((x) => x.claim), ["justine:is:innocent"], "and the one they actively disagree on");
  assert.equal(d.count, 2);
  const shared = commonGround(projected, READER, "geneva");
  assert.equal(shared.count, 0, "a refusal is not common ground");
});

test("a re-zero keeps what it conceded — the past is kept, never erased", () => {
  const projected = projectPerspectives(log(
    perspectiveOperation({ holder: "victor", claim: "justine:is:guilty" }),
    perspectiveOperation({ holder: "victor", claim: "justine:is:guilty", stance: STANCE.CONCEDED }),
  ));
  const belief = projected.perspectives.victor.beliefs[0];
  assert.equal(belief.stance, STANCE.CONCEDED);
  assert.deepEqual(belief.supersedes, { stance: STANCE.HOLDS, atSeq: 0 }, "what was held before the concession is still on the record");
  assert.equal(belief.revisions, 1);
});

test("the cursor is real: a perspective is answerable about the past, and demanded as an integer", () => {
  const entries = log(
    perspectiveOperation({ holder: "victor", claim: "a" }),
    perspectiveOperation({ holder: "victor", claim: "b" }),
    perspectiveOperation({ holder: "victor", claim: "c" }),
  );
  assert.equal(projectPerspectives(entries, { atSeq: 2 }).perspectives.victor.beliefs.length, 2);
  assert.equal(projectPerspectives(entries).perspectives.victor.beliefs.length, 3);
  assert.throws(() => projectPerspectives(entries, { atSeq: 1.5 }), /cursor/);
});

test("a mental model reports its own coverage, and an empty one is a typed gap, not a zero", () => {
  const projected = projectPerspectives(log(
    perspectiveOperation({ holder: READER, claim: "felix:taught:safie", via: ["creature"] }),
    perspectiveOperation({ holder: "creature", claim: "felix:taught:safie" }),
    perspectiveOperation({ holder: "creature", claim: "creature:is:lonely" }),
  ));
  const model = mentalModel(projected, "creature", READER);
  assert.equal(model.count, 1);
  assert.equal(model.ofHoldsInTotal, 2);
  assert.equal(model.coverage, 0.5, "half of what the creature holds is modelled — said, not implied");
  const empty = mentalModel(projected, "walton", READER);
  assert.equal(empty.gap.type, "no_attributed_beliefs");
});

test("a log with no perspective acts reports a typed gap, never a silent empty perspective (P4)", () => {
  const structural = deltaFold([{ schema: "EOOperation@1", terrain: "Entity", operator: "INS", payload: { claim: "x" } }]);
  const projected = projectPerspectives([structural]);
  assert.equal(projected.counted.lensActs, 0);
  assert.equal(projected.gap.type, "no_perspective_acts");
  assert.match(projected.gap.detail, /adapter/, "the gap names whose job the missing half is (S6)");
});

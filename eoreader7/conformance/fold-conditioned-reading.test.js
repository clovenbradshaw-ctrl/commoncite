import test from "node:test";
import assert from "node:assert/strict";

import {
  addressOf, cubeAddresses, receivedGround, eoOperation, deltaFold, applyDelta,
  reconstruct, deriveOrientation, deriveSurprise, deriveTension, deriveRelease,
  expectation, expectationTransition, obligation, openObligation, resolveObligation,
  createRecursiveReader,
} from "../packages/engine/index.js";

test("the cube derives operator terrain and stance from the three faces", () => {
  const cell = addressOf("Differentiate", "Structure", "Figure");
  assert.equal(cell.op, "SEG");
  assert.equal(cell.terrain, "Link");
  assert.equal(cell.stance, "Dissecting");
  assert.equal(cubeAddresses().length, 27);
  assert.deepEqual(
    ["Differentiate", "Relate", "Generate"].map((mode) => addressOf(mode, "Interpretation", "Ground").op),
    ["DEF", "EVA", "REC"],
  );
  assert.equal(cubeAddresses().some((cell) => ["ALT", "SUP"].includes(cell.op)), false);
});

test("NUL is no transformation and cannot mutate Fold state", () => {
  assert.throws(() => eoOperation({ op: "NUL", grain: "Figure", payload: { action: "frame", value: { id: "x" } } }), /NUL/);
  const fold = receivedGround({ activeFrames: [{ id: "f" }] });
  const next = applyDelta(fold, deltaFold([eoOperation({ op: "NUL", grain: "Figure" })]));
  assert.deepEqual(next.activeFrames, fold.activeFrames);
});

test("append-only reconstruction preserves observation through REC and rejects Fold snapshots", () => {
  const observation = { schema: "Observation@1", id: "o1", witness: "not", anchor: { start: 4, end: 7 }, distinctions: ["negation"], provenance: {} };
  const rec = eoOperation({ op: "REC", grain: "Pattern", witness: "o1", payload: { action: "frame", value: { id: "frame:2", interpretation: "reframed" } } });
  const fold = reconstruct([observation, deltaFold([rec], { id: "d1" })]);
  assert.equal(fold.witnessed[0].id, "o1");
  assert.equal(fold.activeFrames[0].id, "frame:2");
  assert.throws(() => reconstruct([receivedGround()]), /snapshots/);
});

test("orientation exposes expectations without converting them to evidence", () => {
  const fold = receivedGround({ expectations: [expectation({ id: "e1", hypothesis: "same identity recurs", giver: "genre", state: "open" })] });
  const orientation = deriveOrientation(fold);
  assert.equal(orientation.activeExpectations.length, 1);
  assert.equal(fold.witnessed.length, 0);
});

test("expectation evaluation uses EVA and reframing uses REC", () => {
  const e = expectation({ id: "e1", hypothesis: "recurs", giver: "structural-prior" });
  assert.equal(expectationTransition(e, "weakened", { witness: "w1" }).operator, "EVA");
  assert.equal(expectationTransition(e, "reframed", { witness: "w2" }).operator, "REC");
});

test("surprise is DeltaFold consequence, not encounter novelty", () => {
  const lexicalNovelty = deltaFold([eoOperation({ op: "INS", grain: "Figure", witness: "new-word" })]);
  const tinyNegation = deltaFold([
    eoOperation({ op: "SEG", grain: "Figure", witness: "not" }),
    eoOperation({ op: "EVA", grain: "Pattern", witness: "not" }),
    eoOperation({ op: "REC", grain: "Pattern", witness: "not" }),
  ]);
  assert.equal(deriveSurprise(lexicalNovelty).operations.length, 1);
  assert.equal(deriveSurprise(tinyNegation).operations.length, 3);
  assert.equal(deriveSurprise(tinyNegation).recanonicalizations.length, 1);
});

test("tension persists through silence and release requires a transformation", () => {
  const o = obligation({ id: "q1", distinction: "which identity?", consequences: ["later attribution"], persistence: 4 });
  const opened = applyDelta(receivedGround(), deltaFold([openObligation(o, { witness: "w1" })]));
  const silent = applyDelta(opened, deltaFold([]));
  assert.equal(deriveTension(silent).obligations.length, 1);
  assert.equal(deriveRelease(deltaFold([]), opened, silent).length, 0);
  const closingDelta = deltaFold([resolveObligation("q1", { witness: "w2", op: "DEF" })]);
  const closed = applyDelta(silent, closingDelta);
  assert.equal(deriveRelease(closingDelta, silent, closed).length, 1);
});

test("Fold conditions the next perception but an unsupported prior nomination fails witness", async () => {
  const reader = createRecursiveReader({
    seed: { expectations: [expectation({ id: "e1", hypothesis: "Alice returns", giver: "genre" })] },
    perceivers: [{
      id: "fixture",
      perceive: (_encounter, orientation) => ({
        candidate: { distinctions: ["Alice is this figure"] },
        nominationCause: orientation.activeExpectations.length ? "expected_recurrence" : "bottom_up_difference",
      }),
    }],
  });
  const turn = await reader.step({ source: "fixture", modality: "text", anchor: { start: 0, end: 3 }, material: "She", sequencePosition: 0 });
  assert.equal(turn.candidates[0].nominationCause[0], "expected_recurrence");
  assert.equal(turn.observations.length, 0);
  assert.equal(reader.getFold().witnessed.length, 0);
});

test("recursive reader feeds revised Fold into the next encounter", async () => {
  const reader = createRecursiveReader({
    perceivers: [{ id: "fixture", perceive: (encounter) => ({ candidate: encounter.material, anchor: encounter.anchor, evidence: encounter.material }) }],
    adapters: {
      ask: ({ address, observations }) => address.op === "INS" && address.grain === "Figure" && observations.length
        ? { changed: true, evidence: observations[0].id, effects: [{ op: "INS", grain: "Figure" }] }
        : null,
    },
  });
  const first = await reader.step({ source: "x", modality: "text", anchor: 1, material: "A", sequencePosition: 0 });
  const second = await reader.step({ source: "x", modality: "text", anchor: 2, material: "B", sequencePosition: 1 });
  assert.equal(first.observations.length, 1);
  assert.equal(second.orientation.schema, "EOOrientation@1");
  assert.equal(reader.getLog().filter((entry) => entry.schema === "EOFold@1").length, 0);
  assert.equal(reader.getFold().witnessed.length, 2);
});

import test from "node:test";
import assert from "node:assert/strict";

import { perceive as nativePerceive } from "../kernel/perception.js";
import { witness as nativeWitness } from "../kernel/witness.js";
import { perceive as legacyPerceive } from "../../legacy-eoreader6.1/packages/engine/perception/index.js";
import { witness as legacyWitness } from "../../legacy-eoreader6.1/packages/engine/witness/index.js";

const encounter = {
  source: "fixture",
  modality: "text",
  sequencePosition: 3,
  anchor: { start: 12, end: 34 },
};

const orientation = {
  schema: "EOOrientation@1",
  activeExpectations: [{ id: "e:1" }],
};

const prior = {
  giver: "test-prior",
  provenance: { source: "fixture-prior" },
  applicability: () => true,
  hypotheses: () => ({ candidate: { distinctions: ["prior-only"] } }),
};

const perceiver = {
  id: "fixture-perceiver",
  async perceive() {
    return {
      candidate: { distinctions: ["witnessed"], hyperedges: [{ schema: "EOHyperedge@1", id: "h:1" }] },
      anchor: encounter.anchor,
      evidence: { quote: "witnessed material" },
    };
  },
};

test("native perception nominations match frozen 6.1", async () => {
  assert.deepEqual(
    await nativePerceive(encounter, orientation, { perceivers: [perceiver], priors: [prior] }),
    await legacyPerceive(encounter, orientation, { perceivers: [perceiver], priors: [prior] }),
  );
});

test("native witness admission matches frozen 6.1", async () => {
  const candidates = await nativePerceive(encounter, orientation, { perceivers: [perceiver], priors: [prior] });
  assert.deepEqual(
    await nativeWitness(encounter, candidates),
    await legacyWitness(encounter, candidates),
  );
});

test("prior-only nominations cannot become witness without anchored evidence", async () => {
  const candidates = await nativePerceive(encounter, orientation, { priors: [prior] });
  assert.equal(candidates.length, 1);
  assert.ok(candidates[0].nominationCause.includes("received_prior"));
  const observations = await nativeWitness(encounter, candidates);
  assert.deepEqual(observations, []);
});

test("misanchored evidence is refused by the default witness gate", async () => {
  const candidate = {
    schema: "PerceptCandidate@1",
    candidate: { distinctions: ["wrong-place"] },
    anchor: { start: 0, end: 1 },
    perceiver: "fixture",
    evidence: { quote: "something" },
  };
  assert.deepEqual(await nativeWitness(encounter, [candidate]), []);
});

test("graph structure enters only with an admitted witnessed candidate", async () => {
  const candidates = await nativePerceive(encounter, orientation, { perceivers: [perceiver] });
  const observations = await nativeWitness(encounter, candidates);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].hyperedges[0].id, "h:1");
  assert.equal(observations[0].provenance.perceiver, "fixture-perceiver");
});

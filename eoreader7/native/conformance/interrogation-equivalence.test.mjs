import test from "node:test";
import assert from "node:assert/strict";
import * as native from "../kernel/index.js";
import * as legacy from "../../legacy-eoreader6.1/packages/engine/reasoning/fold-conditioned.js";

const observation = Object.freeze({
  schema: "Observation@1",
  id: "obs:1",
  anchor: { start: 0, end: 5 },
  distinctions: [{ ref: "ref:a" }],
  witness: "witness:1",
});

const fold = native.receivedGround({
  graphEntries: [
    { schema: "EOHyperedge@1", id: "edge:1", relation: "supports", participants: [{ ref: "ref:a" }, { ref: "ref:b" }], witness: "obs:0" },
    { schema: "EOMention@1", id: "mention:1", referent: "ref:b", witness: "obs:0" },
  ],
  expectations: [{ schema: "EOExpectation@1", id: "expectation:1", grounds: ["ref:b"], consequences: ["ref:c"], state: "open" }],
});

test("native EO address surface is exactly the legacy 27-cell surface", () => {
  const n = native.cubeAddresses();
  const l = legacy.cubeAddresses();
  assert.equal(n.length, 27);
  assert.deepEqual(n, l);
});

test("native relevant neighborhood matches frozen 6.1", () => {
  const n = native.relevantNeighborhood(fold, [observation]);
  const l = legacy.relevantNeighborhood(fold, [observation]);
  assert.deepEqual(n.graph.ids, l.graph.ids);
  assert.deepEqual(n.expectations, l.expectations);
  assert.deepEqual(n.obligations, l.obligations);
});

test("interrogation asks every address but only changed effects become DeltaFold operations", async () => {
  const ask = async ({ address }) => address.op === "EVA" && address.grain === "Figure"
    ? { changed: true, evidence: "witness:1", effects: [{ consequence: "identity revised", payload: { action: "provisional", value: { id: "ref:a", status: "revised" } } }] }
    : null;
  const nInterrogation = await native.interrogateCube([observation], {}, { ask });
  const lInterrogation = await legacy.interrogateCube([observation], {}, { ask });
  assert.deepEqual(nInterrogation, lInterrogation);
  const nDelta = native.deriveEOTransformations(nInterrogation, { id: "delta:1" });
  const lDelta = legacy.deriveEOTransformations(lInterrogation, { id: "delta:1" });
  assert.deepEqual(nDelta, lDelta);
  assert.equal(nDelta.operations.length, 1);
  assert.equal(nDelta.operations[0].operator, "EVA");
});

test("unchanged interrogation cannot fabricate a transformation", async () => {
  const results = await native.interrogateCube([observation], {}, {});
  const delta = native.deriveEOTransformations(results, { id: "delta:null" });
  assert.equal(delta.operations.length, 0);
});

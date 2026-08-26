import test from "node:test";
import assert from "node:assert/strict";

import * as nativeFold from "../kernel/fold.js";
import { cellOf as nativeCellOf, algebraAddresses } from "../kernel/cube.js";
import * as legacyFold from "../../legacy-eoreader6.1/packages/engine/fold/index.js";
import { cellOf as legacyCellOf } from "../../legacy-eoreader6.1/packages/engine/operators.js";

const OPERATORS = ["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"];
const GRAINS = ["Ground", "Figure", "Pattern"];

test("native cube algebra matches the frozen 6.1 algebra at all 27 addresses", () => {
  assert.equal(algebraAddresses().length, 27);
  for (const op of OPERATORS) {
    for (const grain of GRAINS) {
      assert.deepEqual(nativeCellOf(op, grain), legacyCellOf(op, grain));
    }
  }
});

test("native Fold constructors match frozen 6.1", () => {
  const seed = { receivedPriors: [{ id: "prior:1", source: "test" }] };
  assert.deepEqual(nativeFold.receivedGround(seed), legacyFold.receivedGround(seed));

  for (const op of OPERATORS) {
    for (const grain of GRAINS) {
      const input = {
        id: `${op}:${grain}`,
        op,
        grain,
        witness: "w:1",
        consequence: { weight: 1 },
        inputs: ["a"],
        outputs: ["b"],
      };
      assert.deepEqual(nativeFold.eoOperation(input), legacyFold.eoOperation(input));
    }
  }
});

test("native Fold reconstruction is behaviorally identical on witnessed revision", () => {
  const observation = {
    schema: "Observation@1",
    id: "obs:1",
    witness: { source: "fixture", start: 0, end: 12 },
    claim: "A provisional identity is witnessed",
    hyperedges: [],
    graphEntries: [],
  };

  const expectation = { schema: "Expectation@1", id: "exp:1", state: "open", claim: "identity persists" };
  const obligation = { schema: "Obligation@1", id: "obl:1", status: "open", claim: "resolve identity" };

  const makeEntries = (impl) => [
    observation,
    impl.deltaFold([
      impl.eoOperation({
        id: "op:expect",
        op: "EVA",
        grain: "Figure",
        witness: "obs:1",
        payload: { action: "expectation", value: expectation },
      }),
      impl.eoOperation({
        id: "op:obligation",
        op: "DEF",
        grain: "Figure",
        witness: "obs:1",
        payload: { action: "obligation", value: obligation },
      }),
    ], { id: "delta:1" }),
    impl.deltaFold([
      impl.eoOperation({
        id: "op:resolve",
        op: "REC",
        grain: "Ground",
        witness: "obs:1",
        payload: { action: "resolve-obligation", id: "obl:1", status: "resolved" },
      }),
    ], { id: "delta:2" }),
  ];

  const nativeResult = nativeFold.reconstruct(makeEntries(nativeFold));
  const legacyResult = legacyFold.reconstruct(makeEntries(legacyFold));
  assert.deepEqual(nativeResult, legacyResult);
});

test("NUL remains a non-transformation in native v7", () => {
  const input = {
    op: "NUL",
    grain: "Ground",
    payload: { action: "provisional", value: { id: "forbidden" } },
  };
  assert.throws(() => nativeFold.eoOperation(input), /NUL records no transformation/);
  assert.throws(() => legacyFold.eoOperation(input), /NUL records no transformation/);
});

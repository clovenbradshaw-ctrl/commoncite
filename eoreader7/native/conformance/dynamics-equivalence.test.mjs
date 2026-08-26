import test from "node:test";
import assert from "node:assert/strict";
import * as native from "../kernel/index.js";
import * as legacy from "../../legacy-eoreader6.1/packages/engine/dynamics/index.js";

const openA = { id: "obl:a", status: "open", openedAt: 2, grounds: ["ref:x"], alternatives: ["ref:y"], consequences: ["ref:z"] };
const openB = { id: "obl:b", status: "strengthened", openedAt: 4, grounds: ["ref:y"], alternatives: [], consequences: ["ref:q"] };

test("surprise is derived from consequential DeltaFold rather than raw observation novelty", () => {
  const delta = native.deltaFold([
    native.eoOperation({ op: "REC", grain: "Figure", witness: "obs:1", consequence: "recanonicalized identity", payload: { action: "provisional", value: { id: "ref:a" } } }),
    native.eoOperation({ op: "NUL", grain: "Ground" }),
  ], { id: "delta:1" });
  const n = native.deriveSurprise(delta);
  const l = legacy.deriveSurprise(delta);
  assert.deepEqual(n, l);
  assert.equal(n.operations.length, 1);
  assert.equal(n.recanonicalizations.length, 1);
  assert.deepEqual(n.downstreamConsequences, ["recanonicalized identity"]);
});

test("tension is unresolved consequential Fold structure with persistence", () => {
  const fold = native.receivedGround({ sequence: 7, obligations: [openA, openB, { id: "obl:closed", status: "resolved" }] });
  const n = native.deriveTension(fold);
  const l = legacy.deriveTension(fold);
  assert.deepEqual(n, l);
  assert.deepEqual(n.obligations.map((o) => o.id), ["obl:a", "obl:b"]);
  assert.equal(n.interactionNetwork.length, 1);
  assert.deepEqual(n.interactionNetwork[0].shared, ["ref:y"]);
});

test("release requires a witnessed transformation that actually closes an obligation", () => {
  const before = native.receivedGround({ sequence: 4, obligations: [openA] });
  const delta = native.deltaFold([
    native.eoOperation({ op: "REC", grain: "Ground", witness: "obs:resolution", payload: { action: "resolve-obligation", id: "obl:a", status: "resolved" } }),
  ], { id: "delta:release" });
  const after = native.applyDelta(before, delta);
  const n = native.deriveRelease(delta, before, after);
  const l = legacy.deriveRelease(delta, before, after);
  assert.deepEqual(n, l);
  assert.equal(n.length, 1);
  assert.deepEqual(n[0].witness, ["obs:resolution"]);
});

test("status change without a corresponding DeltaFold operation is not release", () => {
  const before = native.receivedGround({ obligations: [openA] });
  const after = native.receivedGround({ obligations: [{ ...openA, status: "resolved" }] });
  assert.deepEqual(native.deriveRelease(native.deltaFold([]), before, after), []);
});

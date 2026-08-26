import test from "node:test";
import assert from "node:assert/strict";

import { deriveOrientation as nativeOrientation } from "../kernel/orientation.js";
import { deriveOrientation as legacyOrientation } from "../../legacy-eoreader6.1/packages/engine/orientation/index.js";

const fixtureFold = {
  activeReferents: [{ id: "r:1" }],
  activeKinds: [{ id: "k:1" }],
  activeLinks: [{ id: "l:1" }],
  unresolvedAlternatives: [{ id: "a:1" }],
  expectations: [
    { id: "e:open", state: "open" },
    { id: "e:weak", state: "weakened" },
    { id: "e:done", state: "fulfilled" },
  ],
  obligations: [
    { id: "o:open", status: "open", distinction: "who?", consequences: ["identity"] },
    { id: "o:done", status: "resolved", distinction: "closed" },
  ],
  relevantPatterns: [{ id: "p:1" }],
  activeFrames: [{ id: "f:1" }],
  receivedPriors: [{ id: "prior:1" }],
};

const fixtureTasks = [
  { task_id: "t:1", status: "open", description: "clarify identity", targets: ["r:1"], strategy: "clarify", consequences: ["identity"] },
  { task_id: "t:2", status: "resolved", description: "done" },
];

test("native orientation matches the frozen 6.1 projection", () => {
  assert.deepEqual(
    nativeOrientation(fixtureFold, { tasks: fixtureTasks }),
    legacyOrientation(fixtureFold, { tasks: fixtureTasks }),
  );
});

test("orientation remains a projection rather than evidence", () => {
  const result = nativeOrientation(fixtureFold, { tasks: fixtureTasks });
  assert.equal(result.schema, "EOOrientation@1");
  assert.ok(!("witnessed" in result));
  assert.deepEqual(result.activeExpectations.map((e) => e.id), ["e:open", "e:weak"]);
  assert.deepEqual(result.unresolvedObligations.map((o) => o.id), ["o:open"]);
  assert.deepEqual(result.activeTasks.map((t) => t.task_id), ["t:1"]);
});

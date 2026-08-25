// eoreader6 · goldens/plan — the plan validator's refusals, pinned as
// firmly as its successes (NEXT-PLAN-EXECUTOR.md's "done" shape). Run:
//   node --test goldens/plan/validator.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlan } from "../../packages/host/plan.js";
import { executePlan } from "../../packages/host/execute.js";
import { createSession } from "../../packages/host/index.js";
import { isGap } from "../../nul/index.js";

const step = (task_id, operator, grain, extra = {}) => ({ task_id, operator, grain, ...extra });

// A real fixture, addressed from this file so the test runs from any cwd.
const FIXTURE = new URL(
  "../../scripts/adversarial/fixtures/frankenstein-excerpt.txt",
  import.meta.url,
).pathname;
const SOURCE_ID = `source:${FIXTURE}`;

const GOLDEN_PLAN = {
  steps: [
    step("admit", "INS", "Ground", {
      organ: "host/corpus/admit",
      target: { file: FIXTURE },
    }),
    step("cast", "CON", "Figure", {
      organ: "referents/index", target: { sourceId: SOURCE_ID }, depends_on: ["admit"],
    }),
    step("triples", "CON", "Figure", {
      organ: "perceiver/text/relations", target: { sourceId: SOURCE_ID }, depends_on: ["admit"],
    }),
    step("graph", "SYN", "Pattern", {
      organ: "host/graph/admit", target: { sourceId: SOURCE_ID }, depends_on: ["cast", "triples"],
    }),
  ],
};

test("a well-formed lattice validates, in dependency order", () => {
  const v = validatePlan(GOLDEN_PLAN);
  assert.equal(v.valid, true);
  assert.deepEqual([...v.order], ["admit", "cast", "triples", "graph"]);
});

test("an unknown operator is unknown_spec, with the known set attached", () => {
  const v = validatePlan({ steps: [step("x", "ZAP", "Ground")] });
  assert.equal(isGap(v), true);
  assert.equal(v.gap, "unknown_spec");
  assert.ok(v.known.includes("NUL"));
});

test("an organ off the roster is undeclared_organ", () => {
  const v = validatePlan({ steps: [step("x", "SEG", "Ground", { organ: "host/imaginary" })] });
  assert.equal(v.gap, "undeclared_organ");
});

test("an organ claimed at a cell its roster entry refutes is undeclared_cell", () => {
  const v = validatePlan({ steps: [step("x", "SEG", "Ground", { organ: "host/graph/admit" })] });
  assert.equal(v.gap, "undeclared_cell");
  assert.deepEqual(v.roster, { op: "SYN", grain: "Pattern" });
});

test("a bare number is undeclared — a value names its origin or it is refused", () => {
  const v = validatePlan({
    steps: [step("x", "CON", "Figure", { organ: "referents/index", params: { limit: 10 } })],
  });
  assert.equal(v.gap, "undeclared");
  assert.equal(v.what, "params.limit");
});

test("a declared number naming its giver passes; the giver is the record", () => {
  const v = validatePlan({
    steps: [step("x", "CON", "Figure", {
      organ: "referents/index",
      params: { limit: { value: 10, basis: "declared", giver: "steering-model" } },
    })],
  });
  assert.equal(v.valid, true);
});

test("an unlicensed statistic/perturbation pair is refused at validation, not run", () => {
  const v = validatePlan({
    steps: [step("x", "NUL", "Ground", {
      params: {
        statistic: { value: "maxDeviation", basis: "declared", giver: "test" },
        perturbation: { value: "shuffle", basis: "declared", giver: "test" },
      },
    })],
  });
  assert.equal(v.gap, "unknown_spec");
  assert.match(v.reason, /unlicensed pair maxDeviation\/shuffle/);
});

test("a dependency cycle is self_referential", () => {
  const v = validatePlan({
    steps: [
      step("a", "INS", "Ground", { depends_on: ["b"] }),
      step("b", "CON", "Figure", { depends_on: ["a"] }),
    ],
  });
  assert.equal(v.gap, "self_referential");
});

test("an empty plan is empty_material", () => {
  assert.equal(validatePlan({ steps: [] }).gap, "empty_material");
});

test("a declared linear chain is held to OPERATOR_ORDER", () => {
  const v = validatePlan({
    chain: true,
    steps: [
      step("syn", "SYN", "Pattern"),
      step("seg", "SEG", "Ground", { depends_on: ["syn"] }),
    ],
  });
  assert.equal(v.gap, "unknown_spec");
  assert.match(v.reason, /violates dependency order/);
});

test("the golden plan executes: acts ticked, handles bounded, payloads held back", () => {
  const session = createSession();
  const run = executePlan(session, GOLDEN_PLAN);
  assert.equal(run.refused, undefined);
  assert.equal(run.handles.length, 4);
  for (const h of run.handles) {
    assert.equal(typeof h.event_id, "string");
    assert.ok(h.gist.length <= 200);
  }
  assert.equal(run.log.tick, 4);
  assert.equal(run.log.events[0].type, "INS.admit");
  assert.equal(run.log.events[3].type, "SYN.compile");
  // the graph step really ran: the session carries a belief graph now
  assert.ok(session.graph.nodes.size >= 1);
});

test("the executor owns dataflow: a junk sourceId is resolved through depends_on", () => {
  const session = createSession();
  const run = executePlan(session, {
    steps: [
      GOLDEN_PLAN.steps[0],
      { ...GOLDEN_PLAN.steps[1], task_id: "cast2", target: { sourceId: "admit:sourceId" } },
    ],
  });
  const cast = run.handles.find((h) => h.task_id === "cast2");
  assert.equal(cast.refused, undefined);
  assert.ok(!cast.gaps.includes("unknown document admit:sourceId"));
  assert.equal(cast.address, SOURCE_ID);
});

test("a step naming an organ with no adapter is refused not_earned, and its dependents are refused with the reason", () => {
  const session = createSession();
  const run = executePlan(session, {
    steps: [
      step("blind", "SIG", "Ground", { organ: "referents/blind" }),
      step("after", "CON", "Figure", { organ: "referents/index", depends_on: ["blind"] }),
    ],
  });
  assert.equal(run.closed, false);
  assert.equal(run.handles[0].refused, true);
  assert.equal(run.handles[1].refused, true);
  assert.equal(run.log.events[0].type, "DEF.refuse");
});

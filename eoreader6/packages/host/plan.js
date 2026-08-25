// eoreader6 · packages/host/plan — v0 of NEXT-PLAN-EXECUTOR.md build item 1:
// a plan is DATA over the nine verbs, and every refusal is a typed gap.
//
// WHERE THIS LIVES, AND WHY: app-tier, beside the surfer. It owns the
// prompt-as-interface question ("is this plan addressable?") and measures
// nothing about any material — every judgment here is a lookup against what
// the algebra derives (engine/operators.js::cellOf), what the roster
// declares (ORGANS), and what the nulls license (nul/index.js::licensed).
// Nothing in this file reads content. The conformance purity guard's
// discipline extends here: dispatch on what the plan names and what organs
// declare, never on what the material says.
//
// A plan is a lattice, not a chain. task-log.js's own distinction: the
// depends_on link is the lattice ("which results feed which step"), the
// supersedes link is the spiral, and OPERATOR_ORDER binds production
// chains and supersede-threads (checkCubeProgression), not lattice edges —
// corpus admission (INS·Ground) feeding relation extraction (CON·Figure)
// is how every real driver in this repo already reads, and is not the
// "INS before CON" chain violation validateChain refuses. A plan that
// declares itself a linear chain (chain: true) is validated against
// OPERATOR_ORDER via validateChain; a lattice is validated per-step and
// per-edge for existence, uniqueness, and acyclicity only.
//
// EVERY REFUSAL IS A TYPED GAP from nul's closed GAP_TYPES vocabulary, so
// a steering model repairs against a named reason, never a stack trace
// (A15's lesson one layer up: typed routing beat untyped widening).
//
//   empty_material     a plan with no steps plans nothing
//   undeclared         a bare number, a missing task_id, a missing basis
//   unknown_spec       an operator/grain the algebra refuses, an unlicensed
//                      statistic/perturbation pair, a chain violation
//   undeclared_organ   an organ id the roster does not carry
//   undeclared_cell    an organ claimed at a cell its roster entry refutes
//   self_referential   a dependency cycle
//
// NUMBERS ARE DECLARED OR DERIVED, NEVER BARE (P4). A numeric param
// arrives as { value, basis: "derived" | "declared", derivation | giver }.
// A model that declares a number is a prior-giver and is recorded as one —
// emergence/graph.js::injectPrior's own law: "a prior whose origin cannot
// be named is indistinguishable from a fabrication."

import { isGap, gap, licensed, LICENSED } from "../../nul/index.js";
import {
  ORGANS,
  OPERATOR_ORDER,
  cellOf,
  isCurrentOperator,
  validateChain,
} from "../engine/operators.js";

export const PLAN_API_VERSION = "plan@0";

const organById = new Map(ORGANS.map((o) => [o.id, o]));

const badParam = (task_id, name, why) =>
  gap("undeclared", { what: `params.${name}`, task_id, why });

/** Validate one step's params object. Returns a gap or null. */
const checkParams = (step) => {
  const params = step.params ?? {};
  if (typeof params !== "object" || Array.isArray(params))
    return badParam(step.task_id, "(all)", "params is an object of named values");
  for (const [name, p] of Object.entries(params)) {
    if (typeof p === "number")
      return badParam(step.task_id, name,
        "a bare number names no origin; wrap it as { value, basis, derivation|giver }");
    if (typeof p !== "object" || p === null || !("value" in p))
      return badParam(step.task_id, name, "a param carries { value, basis, ... }");
    if (p.basis === "derived") {
      if (typeof p.derivation !== "string" || !p.derivation)
        return badParam(step.task_id, name, "a derived value names its derivation");
    } else if (p.basis === "declared") {
      if (typeof p.giver !== "string" || !p.giver)
        return badParam(step.task_id, name, "a declared value names its giver");
    } else {
      return badParam(step.task_id, name, 'basis is "derived" or "declared"');
    }
  }
  // A statistic/perturbation pair must be licensed before it may run.
  const stat = params.statistic?.value;
  const pert = params.perturbation?.value;
  if (stat != null && pert != null && !licensed(stat, pert))
    return gap("unknown_spec", {
      task_id: step.task_id,
      reason: `unlicensed pair ${stat}/${pert}`,
      known: Object.keys(LICENSED),
    });
  return null;
};

/**
 * Validate a plan. Returns frozen { valid: true, order: [task_id...] }
 * (order is a topological order of the dependency lattice) or a typed gap.
 */
export const validatePlan = (plan) => {
  const steps = plan?.steps;
  if (!Array.isArray(steps) || steps.length === 0)
    return gap("empty_material", { reason: "a plan with no steps plans nothing" });

  const byId = new Map();
  for (const step of steps) {
    if (typeof step?.task_id !== "string" || !step.task_id)
      return gap("undeclared", { what: "task_id", why: "every step is addressable by id" });
    if (byId.has(step.task_id))
      return gap("undeclared", { what: "task_id", why: `duplicate id ${step.task_id}` });
    byId.set(step.task_id, step);

    if (!isCurrentOperator(step.operator))
      return gap("unknown_spec", {
        task_id: step.task_id,
        reason: `"${step.operator}" is not an operator`,
        known: OPERATOR_ORDER,
      });
    const cell = cellOf(step.operator, step.grain);
    if (cell.gap)
      return gap("unknown_spec", { task_id: step.task_id, reason: cell.reason, known: cell.known });

    if (step.organ != null) {
      const entry = organById.get(step.organ);
      if (!entry)
        return gap("undeclared_organ", {
          task_id: step.task_id,
          organ: step.organ,
          why: "not a roster id (engine/operators.js::ORGANS)",
        });
      if (entry.op !== step.operator || entry.grain !== step.grain)
        return gap("undeclared_cell", {
          task_id: step.task_id,
          organ: step.organ,
          declared: { op: step.operator, grain: step.grain },
          roster: { op: entry.op, grain: entry.grain },
        });
    }

    const paramGap = checkParams(step);
    if (paramGap) return paramGap;
  }

  for (const step of steps)
    for (const dep of step.depends_on ?? [])
      if (!byId.has(dep))
        return gap("undeclared", {
          what: "depends_on",
          task_id: step.task_id,
          why: `depends on unknown step ${dep}`,
        });

  // Kahn's topological sort; a leftover is a cycle.
  const indegree = new Map(steps.map((s) => [s.task_id, (s.depends_on ?? []).length]));
  const dependents = new Map(steps.map((s) => [s.task_id, []]));
  for (const s of steps)
    for (const dep of s.depends_on ?? []) dependents.get(dep).push(s.task_id);
  const order = [];
  const ready = steps.filter((s) => indegree.get(s.task_id) === 0).map((s) => s.task_id);
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    for (const next of dependents.get(id)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) ready.push(next);
    }
  }
  if (order.length !== steps.length)
    return gap("self_referential", {
      cycle: steps.map((s) => s.task_id).filter((id) => !order.includes(id)),
    });

  // A plan that declares itself a linear production chain is held to
  // OPERATOR_ORDER — "a pipeline that violates the order has not read."
  if (plan.chain === true) {
    try {
      validateChain(order.map((id) => byId.get(id).operator));
    } catch (err) {
      return gap("unknown_spec", { reason: String(err.message), known: OPERATOR_ORDER });
    }
  }

  return Object.freeze({ valid: true, order: Object.freeze(order) });
};

export { isGap };

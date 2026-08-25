// eoreader6 · packages/host/execute — v0 of NEXT-PLAN-EXECUTOR.md build
// item 2: one fixed interpreter that runs a validated plan against real
// organs, ticks every act into a real event log, and hands back HANDLES,
// never payloads.
//
// THE LOAD-BEARING RULE (L5, the-fold's law generalized): what returns to
// a steering model is { task_id, event_id, tick, organ, gist, gaps,
// address } with the gist bounded — the full result stays host-side,
// re-openable by address (P1: recall is retrieval). The model routes
// addresses between steps; the executor dereferences depends_on itself.
// The model cannot misquote what it never carries.
//
// ADAPTERS, NOT REFLECTION. Organ functions have heterogeneous signatures,
// so dispatch is a host-tier adapter per roster id — each a thin marshal
// from (session, step, inputs) onto the real organ call, the same
// promotion path host/graph.js::admitGraph already walked for
// emergence/graph.js. An organ without an adapter is a typed refusal
// (not_earned), never a guess. v0 carries five adapters — enough to run
// the golden plan — and each names the roster organ whose act it performs,
// because "an act names the organ that performed it, or it is not in the
// record" (emergence/declaration.js).
//
// GAPS PROPAGATE AS RESULTS (P4). An organ returning a typed gap does not
// throw; the step's handle carries it, dependents are refused with the
// reason attached as a DEF.refuse event, and the run reports open_gaps at
// the end. A failed step is a finding.
//
// NOT BUILT IN v0, DELIBERATELY (the spec's items, named so this header
// cannot silently claim them): content-key memoization, the single
// bounded reconcile round, concurrent independent steps, exposure-scoped
// lenses. Each lands as its own change with its own test.

import { createLog, tick } from "../../event_log/index.js";
import { isGap, gap } from "../../nul/index.js";
import { OPERATORS } from "../engine/operators.js";
import { validatePlan } from "./plan.js";
import { ingestFile, admitChunked, sessionReferents, sessionRelations } from "./corpus.js";
import { executePrompt } from "./surfer.js";
import { admitGraph, sessionGraphSnapshot } from "./graph.js";

export const EXECUTE_API_VERSION = "execute@0";

const GIST_MAX = 200;
const gist = (s) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > GIST_MAX ? t.slice(0, GIST_MAX - 3) + "..." : t;
};

const paramValue = (step, name) => step.params?.[name]?.value;

/**
 * v0 adapter roster. Key = roster organ id (engine/operators.js::ORGANS).
 * Each returns { result, gist, address? }; result stays host-side.
 */
export const ADAPTERS = Object.freeze({
  "host/corpus/admit": {
    what: "admit a file or text into the session corpus (target: {file} or {text, sourceId})",
    run(session, step) {
      const t = step.target ?? {};
      const result = t.file
        ? ingestFile(session, t.file)
        : admitChunked(session, { text: t.text, sourceId: t.sourceId });
      const sourceId = t.file ? `source:${t.file}` : t.sourceId;
      return {
        result,
        gist: gist(`admitted ${result.chunks} chunks as ${sourceId}${result.deduped ? " (deduped)" : ""}`),
        address: sourceId,
      };
    },
  },
  "host/surfer": {
    what: "snip the reach-unit a prompt addresses (target: {prompt, sourceFilter?})",
    run(session, step) {
      const t = step.target ?? {};
      const result = executePrompt(session, t.prompt, { sourceFilter: t.sourceFilter ?? t.sourceId });
      const one = result.fan ? result.fan[0] : result;
      const address = one?.byte_start != null
        ? `${one.source_id}#${one.byte_start}-${one.byte_end}`
        : null;
      if (result.gap)
        return { result, gist: gist(`${result.gap}: ${result.reason ?? ""}`), address };
      return {
        result,
        gist: gist(`snipped ${one?.segment ?? "(gap)"} — ${(one?.text ?? "").slice(0, 80)}`),
        address,
      };
    },
  },
  "referents/index": {
    what: "the discovered cast of a source (target: {sourceId}; params: limit?)",
    run(session, step) {
      const limit = paramValue(step, "limit");
      const result = sessionReferents(session, {
        sourceId: step.target?.sourceId,
        ...(limit != null ? { limit } : {}),
      });
      const names = result.referents.slice(0, 8).map((r) => r.display).join(", ");
      return {
        result,
        gist: gist(`${result.referents.length} referents (${result.gaps.length} gaps): ${names}`),
        address: step.target?.sourceId ?? null,
      };
    },
  },
  "perceiver/text/relations": {
    what: "measured subject·verb·object triples of a source (target: {sourceId})",
    run(session, step) {
      const result = sessionRelations(session, { sourceId: step.target?.sourceId });
      const sample = result.relations.slice(0, 3)
        .map((r) => `${r.subject} ${r.verb} ${r.object}`).join("; ");
      return {
        result,
        gist: gist(`${result.relations.length} triples: ${sample}`),
        address: step.target?.sourceId ?? null,
      };
    },
  },
  "host/graph/admit": {
    what: "fold a source's relations into the session belief graph (target: {sourceId?}; params: gamma?, pruneBelow?)",
    run(session, step) {
      const opts = { sourceId: step.target?.sourceId };
      const gamma = paramValue(step, "gamma");
      const pruneBelow = paramValue(step, "pruneBelow");
      if (gamma != null) opts.gamma = gamma;
      if (pruneBelow != null) opts.pruneBelow = pruneBelow;
      const result = admitGraph(session, opts);
      const snap = sessionGraphSnapshot(session, { limit: 8 });
      const edges = snap.edges.map((e) => e.edge.replaceAll("|", " ")).join("; ");
      return {
        result: { ...result, snapshot: snap },
        gist: gist(`graph: ${snap.nodeCount} nodes, ${snap.edgeCount} edges; strongest: ${edges}`),
        address: step.target?.sourceId ?? null,
      };
    },
  },
});

const gapsOf = (result) => {
  if (isGap(result) || result?.gap) return [result.gap ?? "gap"];
  if (Array.isArray(result?.gaps)) return result.gaps.map((g) => g.reason ?? g.gap ?? String(g));
  return [];
};

/**
 * Execute a plan against a session. Returns { closed, open_gaps, handles,
 * log, results } — handles are what crosses a tool surface; results and
 * log stay host-side.
 */
export const executePlan = (session, plan, { adapters = ADAPTERS } = {}) => {
  const v = validatePlan(plan);
  if (isGap(v)) return { refused: v };

  const byId = new Map(plan.steps.map((s) => [s.task_id, s]));
  const log = createLog();
  const results = new Map();
  const handles = [];
  const open_gaps = [];

  // The executor owns dataflow: each step's material source resolves through
  // its dependency lattice, so the model routes edges, never address strings.
  // A sourceId naming no admitted document is replaced by the nearest
  // dependency's source — the model cannot misquote what it never carries.
  const sourceOf = new Map(); // task_id -> "source:..." address
  const inherited = (step) => {
    for (const d of step.depends_on ?? []) {
      const s = sourceOf.get(d);
      if (s) return s;
    }
    return null;
  };
  const resolveTarget = (step) => {
    const t = { ...(step.target ?? {}) };
    if (t.file) return t;
    if (t.sourceId && session.documents?.has?.(t.sourceId)) return t;
    const s = inherited(step);
    if (s) t.sourceId = s;
    return t;
  };

  for (const task_id of v.order) {
    const step = byId.get(task_id);
    const verb = OPERATORS[step.operator].verb;

    const failedDep = (step.depends_on ?? []).find((d) => {
      const h = handles.find((x) => x.task_id === d);
      return !h || h.refused || (h.gaps.length && results.get(d) === undefined);
    });
    if (failedDep) {
      const reason = gap("no_ground", {
        task_id, why: `dependency ${failedDep} did not produce a result`,
      });
      const event = tick(log, { type: "DEF.refuse", organ: "host/execute", task_id, gist: gist(`refused: dependency ${failedDep} failed`) });
      handles.push(Object.freeze({ task_id, organ: null, event_id: event.event_id, tick: event.tick, gist: event.gist, gaps: [reason.gap], refused: true }));
      open_gaps.push(reason);
      continue;
    }

    const organId = step.organ ?? null;
    const adapter = organId ? adapters[organId] : null;
    if (!adapter) {
      const reason = gap("not_earned", {
        task_id, organ: organId,
        why: organId
          ? "no adapter for this organ in the v0 executor"
          : "v0 dispatches by named organ only; cell dispatch is not yet earned",
      });
      const event = tick(log, { type: "DEF.refuse", organ: "host/execute", task_id, gist: gist(`refused: ${reason.why}`) });
      handles.push(Object.freeze({ task_id, organ: organId, event_id: event.event_id, tick: event.tick, gist: event.gist, gaps: [reason.gap], refused: true }));
      open_gaps.push(reason);
      continue;
    }

    const { result, gist: g, address = null } = adapter.run(session, { ...step, target: resolveTarget(step) });
    const gaps = gapsOf(result);
    results.set(task_id, result);
    if (typeof address === "string" && address.startsWith("source:"))
      sourceOf.set(task_id, address.split("#")[0]);
    else {
      const s = inherited(step);
      if (s) sourceOf.set(task_id, s);
    }
    const event = tick(log, {
      type: `${step.operator}.${verb}`,
      organ: organId, task_id, gist: g,
      ...(address ? { address } : {}),
      ...(gaps.length ? { gaps } : {}),
    });
    if (isGap(result) || result?.gap) open_gaps.push(result);
    handles.push(Object.freeze({
      task_id, organ: organId, event_id: event.event_id, tick: event.tick,
      gist: g, address, gaps,
    }));
  }

  return { closed: open_gaps.length === 0, open_gaps, handles: Object.freeze(handles), log, results };
};

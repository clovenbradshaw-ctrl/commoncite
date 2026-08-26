import {
  createTaskLog, append, projectTasks, ENTRY_KINDS, OPERATOR_BASIS,
} from "../holon/task-log.js";
import { buildHypergraph, relevantHypergraphNeighborhood } from "../hypergraph/index.js";

const CLOSED = new Set(["resolved", "closed", "superseded", "retracted"]);
const EO_OPS = new Set(["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"]);

const refsOf = (value, out = new Set()) => {
  if (value == null) return out;
  if (typeof value === "string") {
    if (/^(ref|surface|occ|lex|mention|encounter|obs|edge|expectation|obligation|frame|pattern|motif|delta|op|gap|task-evidence):/.test(value)) out.add(value);
    return out;
  }
  if (Array.isArray(value)) { for (const v of value) refsOf(v, out); return out; }
  if (typeof value === "object") for (const v of Object.values(value)) refsOf(v, out);
  return out;
};

const eoAddressed = (consequence) => {
  if (!consequence || typeof consequence !== "object") return false;
  if (EO_OPS.has(consequence.op) || EO_OPS.has(consequence.operator)) return true;
  const address = consequence.address ?? consequence.eo;
  return Boolean(address && typeof address === "object" && (
    EO_OPS.has(address.op) || EO_OPS.has(address.operator) ||
    (address.mode && address.domain && address.grain)
  ));
};

const structurallyTargeted = (consequence) => Boolean(consequence && typeof consequence === "object" && (
  consequence.ref || consequence.edge || consequence.expectation || consequence.obligation || consequence.frame ||
  consequence.pattern || consequence.referent || consequence.boundary || consequence.relation
));

/**
 * A reading task is licensed only by a downstream difference that could make
 * a difference to the Fold. Grounds identify where an uncertainty came from;
 * they do not, by themselves, justify spending attention on it. Likewise a
 * descriptive `kind` label is metadata, not consequence: the consequence must
 * address actual Fold structure or an EO transformation address.
 */
export function materialConsequencesOf(obligation = {}) {
  const consequenceRefs = refsOf(obligation.consequences);
  const typed = (obligation.consequences ?? []).filter((c) => structurallyTargeted(c) || eoAddressed(c));
  return Object.freeze({ refs: Object.freeze([...consequenceRefs]), typed: Object.freeze([...typed]) });
}

export function obligationMakesDifference(obligation = {}) {
  if (!obligation?.id || CLOSED.has(obligation.status)) return false;
  const material = materialConsequencesOf(obligation);
  return material.refs.length > 0 || material.typed.length > 0;
}

function taskTargets(obligation) {
  return [...refsOf([
    obligation.distinction,
    obligation.grounds,
    obligation.alternatives,
    obligation.consequences,
  ])];
}

function strategyOf(obligation) {
  const id = obligation?.id ?? "";
  const consequenceKinds = new Set((obligation?.consequences ?? []).map((c) => c?.kind).filter(Boolean));
  if (id.startsWith("obligation:identity:") || id.startsWith("obligation:unresolved:")) return "identity_clarification";
  if (id.startsWith("obligation:multiplicity:") || consequenceKinds.has("relation_scope_or_multiplicity")) return "scope_or_multiplicity";
  if (consequenceKinds.has("relation_attribution")) return "attribution_clarification";
  return "clarify";
}

function taskQuestions(strategy) {
  if (strategy === "identity_clarification") return [
    "What witnessed structure supports treating these occurrences as one referent?",
    "What witnessed structure supports keeping them distinct or scope-separated?",
  ];
  if (strategy === "scope_or_multiplicity") return [
    "Do the competing values occupy genuinely different scopes?",
    "If not, must the Fold preserve unresolved multiplicity?",
  ];
  if (strategy === "attribution_clarification") return [
    "Which witnessed referent can this relation safely be attributed to?",
    "What competing attribution remains live?",
  ];
  return [
    "What additional witnessed structure bears on this unresolved distinction?",
    "What would defeat the current leading interpretation?",
  ];
}

export function createReadingTaskState(log = null) {
  return log ?? createTaskLog();
}

export function taskForObligation(obligation, { sequence = 0 } = {}) {
  if (!obligationMakesDifference(obligation)) return null;
  const strategy = strategyOf(obligation);
  const material = materialConsequencesOf(obligation);
  const targets = taskTargets(obligation);
  if (targets.length === 0) return null;
  const consequenceCount = material.typed.length + material.refs.length;
  const persistence = obligation.persistence ?? 0;
  const openedAt = obligation.openedAt ?? sequence;
  return Object.freeze({
    kind: ENTRY_KINDS.PROPOSE,
    task_id: `task:obligation:${obligation.id}`,
    description: `Clarify unresolved distinction: ${typeof obligation.distinction === "string" ? obligation.distinction : obligation.id}`,
    obligation_id: obligation.id,
    grounds: Object.freeze([...(obligation.grounds ?? [])]),
    targets: Object.freeze(targets),
    questions: Object.freeze(taskQuestions(strategy)),
    consequences: Object.freeze([...(obligation.consequences ?? [])]),
    openedAt,
    persistence,
    priority: Object.freeze({ consequence: Math.max(1, consequenceCount), persistence, uncertainty: 1 }),
    scope: Object.freeze({ seenThrough: sequence, futureAllowed: false, retrospectiveAllowed: true }),
    strategy,
    successCondition: "new witnessed evidence changes the addressed unresolved structure through EO interrogation",
    failureCondition: "available witnessed history leaves the distinction unresolved",
    wake: Object.freeze({ refs: Object.freeze(targets) }),
    depends_on: [],
    evidence: Object.freeze([...(obligation.grounds ?? [])]),
    status: "open",
  });
}

export function taskPriority(task, fold = {}) {
  const sequence = fold?.sequence ?? 0;
  const age = Math.max(task?.persistence ?? 0, task?.openedAt == null ? 0 : sequence - task.openedAt);
  const consequence = task?.priority?.consequence ?? 0;
  const uncertainty = task?.priority?.uncertainty ?? 1;
  return consequence * (1 + age) * uncertainty;
}

/**
 * Bounded attention: only consequence-bearing questions enter scheduling;
 * older and more consequential ones get the limited deep-reading slots first.
 */
export function scheduleTasks(tasks = [], fold = {}, { limit = 4 } = {}) {
  if (!Number.isInteger(limit) || limit < 0) throw new TypeError("scheduleTasks limit must be a non-negative integer");
  return Object.freeze([...tasks]
    .filter((task) => !CLOSED.has(task.status) && (task?.priority?.consequence ?? 0) > 0 && (task?.targets?.length ?? 0) > 0)
    .map((task) => ({ task, score: taskPriority(task, fold) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || String(a.task.task_id).localeCompare(String(b.task.task_id)))
    .slice(0, limit)
    .map(({ task }) => task));
}

export function reconcileObligationTasks(log, fold) {
  let next = log;
  const byObligation = new Map((fold?.obligations ?? []).map((o) => [o.id, o]));
  for (const task of projectTasks(next)) {
    if (!task?.obligation_id) continue;
    const obligation = byObligation.get(task.obligation_id);
    if (obligation && !CLOSED.has(obligation.status) && obligationMakesDifference(obligation)) continue;
    next = append(next, {
      kind: ENTRY_KINDS.RETRACT,
      task_id: task.task_id,
      description: obligation
        ? `Underlying obligation ${task.obligation_id} no longer has a material downstream consequence`
        : `Underlying obligation ${task.obligation_id} no longer exists`,
      evidence: [...(obligation?.resolutionRefs ?? [])],
    });
  }
  return next;
}

export function proposeObligationTasks(log, fold) {
  let next = reconcileObligationTasks(log, fold);
  const active = new Set(projectTasks(next).filter((t) => !CLOSED.has(t.status)).map((t) => t.task_id));
  const proposed = [];
  for (const obligation of fold?.obligations ?? []) {
    const entry = taskForObligation(obligation, { sequence: fold?.sequence ?? 0 });
    if (!entry || active.has(entry.task_id)) continue;
    next = append(next, entry);
    active.add(entry.task_id);
    proposed.push(entry.task_id);
  }
  return Object.freeze({ log: next, proposed: Object.freeze(proposed), tasks: Object.freeze(projectTasks(next)) });
}

export function wakeTasks(tasks = [], observations = []) {
  const encountered = refsOf(observations);
  return Object.freeze(tasks.filter((task) => {
    if (CLOSED.has(task.status) || (task?.priority?.consequence ?? 0) <= 0) return false;
    const refs = task?.wake?.refs ?? task?.targets ?? [];
    return refs.some((ref) => encountered.has(ref));
  }));
}

export async function executeClarificationTask({ task, fold, observations = [], maxHops = null, graph = null } = {}) {
  if (!task?.task_id) throw new TypeError("executeClarificationTask requires a task");
  const workingGraph = graph ?? buildHypergraph([
    ...(fold?.graphEntries ?? []),
    ...observations.flatMap((o) => [o, ...(o?.hyperedges ?? []), ...(o?.graphEntries ?? [])]),
  ]);
  const consequence = task?.priority?.consequence ?? 0;
  if (consequence <= 0) return Object.freeze({
    disposition: "irrelevant",
    evidence: Object.freeze([]),
    candidates: Object.freeze([]),
    questions: Object.freeze([...(task.questions ?? [])]),
    strategy: task.strategy ?? "clarify",
    depth: 0,
    detail: "task has no material consequence in the current Fold",
  });
  const age = Math.max(task?.persistence ?? 0, task?.openedAt == null ? 0 : (fold?.sequence ?? 0) - task.openedAt);
  const hops = maxHops ?? (consequence > 1 || age > 3 ? 4 : 3);
  const neighborhood = relevantHypergraphNeighborhood(workingGraph, [...(task.targets ?? []), ...observations], { maxHops: hops });
  const candidates = neighborhood.entries.filter((entry) => entry?.id && !CLOSED.has(entry?.status));
  const evidence = candidates
    .filter((entry) => [
      "Observation@1", "EOHyperedge@1", "EOOperation@1", "EOExpectation@1",
      "EOObligation@1", "EOMention@1", "EOLexicalOccurrence@1", "EOTaskTargetOccurrence@1",
    ].includes(entry.schema))
    .map((entry) => entry.id);
  return Object.freeze({
    disposition: evidence.length ? "evidence_found" : "unresolved",
    evidence: Object.freeze([...new Set(evidence)]),
    candidates: Object.freeze(candidates),
    questions: Object.freeze([...(task.questions ?? [])]),
    strategy: task.strategy ?? "clarify",
    depth: hops,
    detail: evidence.length
      ? `reopened ${candidates.length} graph objects within ${hops} structural hops; EO interrogation must decide consequence`
      : `no additional witnessed graph structure found within ${hops} structural hops`,
  });
}

export function appendTaskResult(log, task, result = {}) {
  if (!task?.task_id) throw new TypeError("appendTaskResult requires a task");
  const evidence = [...(result.evidence ?? [])];
  const disposition = result.disposition ?? "unresolved";
  let next = log;
  if (evidence.length) {
    next = append(next, {
      kind: ENTRY_KINDS.EVIDENCE,
      task_id: task.task_id,
      evidence,
      description: task.description,
    });
  }
  next = append(next, {
    kind: ENTRY_KINDS.RESULT,
    task_id: task.task_id,
    status: "open",
    result: Object.freeze({
      disposition,
      evidence: Object.freeze(evidence),
      candidates: Object.freeze([...(result.candidates ?? [])]),
      questions: Object.freeze([...(result.questions ?? task.questions ?? [])]),
      strategy: result.strategy ?? task.strategy ?? "clarify",
      depth: result.depth ?? null,
      detail: result.detail ?? null,
    }),
    evidence,
    description: task.description,
  });
  return next;
}

export function typeTask(log, task, { operator, grain, evidence = [], description = null } = {}) {
  return append(log, {
    kind: ENTRY_KINDS.EVIDENCE,
    task_id: task.task_id,
    operator,
    operator_basis: OPERATOR_BASIS.DERIVED,
    grain,
    evidence,
    description: description ?? task.description,
  });
}

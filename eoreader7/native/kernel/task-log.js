import { GRAINS, cellOf } from "./cube.js";

export const ENTRY_KINDS = Object.freeze({ PROPOSE: "propose", SUPERSEDE: "supersede", EVIDENCE: "evidence", RESULT: "result", RETRACT: "retract" });
export const OPERATOR_BASIS = Object.freeze({ PRODUCED: "produced", DERIVED: "derived", DECLARED: "declared", CONTESTED: "contested", ABSENT: "absent" });
export const OPERATOR_ORDER = Object.freeze(["NUL", "SEG", "SIG", "CON", "EVA", "DEF", "INS", "SYN", "REC"]);

export function createTaskLog({ admits = OPERATOR_ORDER } = {}) {
  if (!Array.isArray(admits) || !admits.length) throw new TypeError("createTaskLog: admits must be a non-empty array of operator codes");
  return Object.freeze({ entries: Object.freeze([]), nextSeq: 0, admits: Object.freeze([...admits]) });
}

export function append(log, entry) {
  if (!entry || typeof entry !== "object") throw new TypeError("append requires an entry object");
  if (!Object.values(ENTRY_KINDS).includes(entry.kind)) throw new TypeError(`append: unknown entry kind ${JSON.stringify(entry.kind)}`);
  if (typeof entry.task_id !== "string" || !entry.task_id) throw new TypeError("append: every entry needs a task_id");
  const admits = log.admits ?? OPERATOR_ORDER;
  if (entry.operator != null && !admits.includes(entry.operator)) throw new TypeError(`append: ${JSON.stringify(entry.operator)} is not admitted by this log`);
  if (entry.operator != null && !Object.values(OPERATOR_BASIS).includes(entry.operator_basis)) throw new TypeError("append: an entry carrying an operator must state its operator_basis");
  if (entry.grain != null && !GRAINS.includes(entry.grain)) throw new TypeError(`append: invalid grain ${entry.grain}`);
  if (entry.grain != null && entry.operator == null) throw new TypeError("append: a grain was supplied without the operator that shares its cell");
  const sealed = Object.freeze({ ...entry, seq: log.nextSeq, depends_on: Object.freeze([...(entry.depends_on ?? [])]), evidence: Object.freeze([...(entry.evidence ?? [])]) });
  return Object.freeze({ entries: Object.freeze([...log.entries, sealed]), nextSeq: log.nextSeq + 1, admits });
}

export function projectTasks(log) {
  const byId = new Map(); const superseded = new Set(); const retracted = new Set();
  for (const e of log.entries) {
    if (e.kind === ENTRY_KINDS.RETRACT) { retracted.add(e.task_id); continue; }
    if (e.supersedes) superseded.add(e.supersedes);
    const prior = byId.get(e.task_id) ?? { task_id: e.task_id, operator: null, operator_basis: OPERATOR_BASIS.ABSENT, operator_gap: "no structural act has been earned for this task yet", grain: null, grain_gap: "no grain has been earned for this task's operator yet", cell: null, description: null, depends_on: [], evidence: [], result: null, first_seq: e.seq };
    const RESERVED = new Set(["kind","task_id","seq","supersedes","operator","operator_basis","grain","description","depends_on","evidence","result"]);
    const payload = {}; for (const [key, value] of Object.entries(e)) if (!RESERVED.has(key)) payload[key] = value;
    const nextOperator = e.operator ?? prior.operator;
    const nextGrain = e.grain ?? (e.operator != null ? null : prior.grain);
    byId.set(e.task_id, { ...prior, ...payload, evidence: e.evidence?.length ? [...new Set([...prior.evidence, ...e.evidence])] : prior.evidence, result: e.kind === ENTRY_KINDS.RESULT ? e.result : prior.result, description: e.description ?? prior.description, depends_on: e.depends_on.length ? [...e.depends_on] : prior.depends_on, operator: nextOperator, operator_basis: e.operator != null ? e.operator_basis : prior.operator_basis, operator_gap: e.operator != null ? null : prior.operator_gap, grain: nextGrain, grain_gap: e.grain != null ? null : e.operator != null ? "no grain has been earned for this task's operator yet" : prior.grain_gap, cell: nextOperator != null && nextGrain != null ? cellOf(nextOperator, nextGrain) : null, last_seq: e.seq });
  }
  return [...byId.values()].filter((t) => !retracted.has(t.task_id) && !superseded.has(t.task_id)).sort((a,b) => a.first_seq - b.first_seq);
}

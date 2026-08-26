import { cellOf } from "../operators.js";

const gap = (type, detail = {}) => Object.freeze({ gap: type, ...detail });

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const stableValue = (value) => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value, Object.keys(value || {}).sort());
};

const normalizeScope = (scope = {}) => {
  if (!isObject(scope)) return Object.freeze({ value: scope });
  const start = scope.start ?? scope.from ?? null;
  const end = scope.end ?? scope.to ?? null;
  return Object.freeze({ ...scope, start, end });
};

/**
 * Accept either an object tuple or a compact positional EOT tuple:
 *   [op, grain, subject, predicate, object, meta?]
 *
 * Content is never classified into the cube here. op + grain are declarations;
 * terrain and stance are derived mechanically through cellOf().
 */
export const normalizeEotTuple = (tuple, index = 0) => {
  const raw = Array.isArray(tuple)
    ? {
        op: tuple[0],
        grain: tuple[1],
        subject: tuple[2],
        predicate: tuple[3],
        object: tuple[4],
        ...(isObject(tuple[5]) ? tuple[5] : {}),
      }
    : tuple;

  if (!isObject(raw)) return gap("invalid_eot_tuple", { index, reason: "tuple must be an object or array" });
  if (!raw.op) return gap("invalid_eot_tuple", { index, reason: "missing declared operator" });
  if (!raw.grain) return gap("invalid_eot_tuple", { index, reason: "missing declared grain" });
  if (raw.subject === undefined) return gap("invalid_eot_tuple", { index, reason: "missing subject" });
  if (raw.predicate === undefined) return gap("invalid_eot_tuple", { index, reason: "missing predicate" });

  const cell = cellOf(raw.op, raw.grain);
  if (cell?.gap) return gap("invalid_eot_tuple", { index, reason: cell.reason, cell });

  return Object.freeze({
    id: raw.id ?? `eot:${index}`,
    op: raw.op,
    grain: raw.grain,
    subject: raw.subject,
    predicate: raw.predicate,
    object: raw.object,
    polarity: raw.polarity === -1 || raw.polarity === false ? -1 : 1,
    scope: normalizeScope(raw.scope),
    witness: raw.witness ?? raw.provenance ?? null,
    source: raw.source ?? null,
    dependsOn: Object.freeze([...(raw.dependsOn ?? raw.depends_on ?? [])]),
    meta: Object.freeze({ ...(raw.meta ?? {}) }),
    cell,
  });
};

const scalar = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(value).trim() !== "") return asNumber;
  const asDate = Date.parse(value);
  return Number.isNaN(asDate) ? null : asDate;
};

const overlap = (a, b) => {
  const aStart = scalar(a?.start);
  const aEnd = scalar(a?.end);
  const bStart = scalar(b?.start);
  const bEnd = scalar(b?.end);
  if ([aStart, aEnd, bStart, bEnd].some((v) => v === null)) return null;
  return Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);
};

const relationKey = (tuple) => `${stableValue(tuple.subject)}\u0000${stableValue(tuple.predicate)}`;
const propositionKey = (tuple) => `${relationKey(tuple)}\u0000${stableValue(tuple.object)}`;

const sameSubjectPredicate = (a, b) =>
  stableValue(a.subject) === stableValue(b.subject) && stableValue(a.predicate) === stableValue(b.predicate);

const sameObject = (a, b) => stableValue(a.object) === stableValue(b.object);

const makeAct = (op, grain, reason, tupleIds = [], detail = {}) => Object.freeze({
  ...cellOf(op, grain),
  reason,
  tupleIds: Object.freeze([...tupleIds]),
  ...detail,
});

/**
 * Build a proposition graph from declared EOT tuples.
 *
 * This graph does not invent semantic edges. It records only the relations,
 * dependencies, witnesses and cube addresses present in the tuples.
 */
export const buildEotGraph = (input = []) => {
  if (!Array.isArray(input)) return gap("invalid_eot", { reason: "input must be an array" });
  const tuples = [];
  const gaps = [];
  for (let i = 0; i < input.length; i += 1) {
    const tuple = normalizeEotTuple(input[i], i);
    if (tuple?.gap) gaps.push(tuple);
    else tuples.push(tuple);
  }

  const byRelation = new Map();
  const byProposition = new Map();
  const byId = new Map();
  for (const tuple of tuples) {
    byId.set(tuple.id, tuple);
    const rKey = relationKey(tuple);
    const pKey = propositionKey(tuple);
    if (!byRelation.has(rKey)) byRelation.set(rKey, []);
    if (!byProposition.has(pKey)) byProposition.set(pKey, []);
    byRelation.get(rKey).push(tuple);
    byProposition.get(pKey).push(tuple);
  }

  return Object.freeze({
    tuples: Object.freeze(tuples),
    gaps: Object.freeze(gaps),
    byId,
    byRelation,
    byProposition,
  });
};

/**
 * Mechanical adversarial reasoning over an EOT proposition graph.
 *
 * The engine currently reasons about what the tuples make explicit:
 * - positive/negative witness collisions
 * - multiple values for one relation
 * - temporal scope segmentation
 * - explicit DEF/EVA testimony
 * - declared dependencies whose supports are defeated
 *
 * It deliberately does not infer new world facts from vocabulary.
 */
export const reasonOverEot = (input, query = {}) => {
  const graph = input?.tuples && input?.byRelation ? input : buildEotGraph(input);
  if (graph?.gap) return graph;

  const q = isObject(query) ? query : {};
  const scoped = graph.tuples.filter((tuple) => {
    if (q.subject !== undefined && stableValue(tuple.subject) !== stableValue(q.subject)) return false;
    if (q.predicate !== undefined && stableValue(tuple.predicate) !== stableValue(q.predicate)) return false;
    if (q.object !== undefined && stableValue(tuple.object) !== stableValue(q.object)) return false;
    return true;
  });

  const acts = [];
  const findings = [];
  const defeated = new Set();
  const sustained = new Set();

  // First pass: explicit interpretive testimony already present in the EOT.
  for (const tuple of scoped) {
    if (tuple.op === "DEF") {
      defeated.add(tuple.id);
      acts.push(makeAct("DEF", tuple.grain, "explicit refusal in EOT", [tuple.id]));
    }
    if (tuple.op === "EVA") {
      sustained.add(tuple.id);
      acts.push(makeAct("EVA", tuple.grain, "explicit witnessed evaluation in EOT", [tuple.id]));
    }
  }

  // Compare positive and negative testimony for the same proposition.
  for (let i = 0; i < scoped.length; i += 1) {
    for (let j = i + 1; j < scoped.length; j += 1) {
      const a = scoped[i];
      const b = scoped[j];
      if (!sameSubjectPredicate(a, b) || !sameObject(a, b)) continue;
      if (a.polarity === b.polarity) continue;

      const scopeOverlap = overlap(a.scope, b.scope);
      const resolution = scopeOverlap === false ? "split" : "conflict";
      if (resolution === "split") {
        acts.push(makeAct("SEG", "Figure", "opposed testimony occupies disjoint declared scopes", [a.id, b.id], { scopeOverlap }));
      } else {
        acts.push(makeAct("DEF", "Figure", "opposed testimony targets the same proposition", [a.id, b.id], { scopeOverlap }));
      }
      findings.push(Object.freeze({
        type: resolution,
        proposition: Object.freeze({ subject: a.subject, predicate: a.predicate, object: a.object }),
        tupleIds: Object.freeze([a.id, b.id]),
        scopeOverlap,
      }));
    }
  }

  // Competing values for one subject/predicate are either a scoped plurality or
  // an unresolved collision. This is the Lincoln/Hamlin/Johnson class of error.
  const relationGroups = new Map();
  for (const tuple of scoped) {
    const key = relationKey(tuple);
    if (!relationGroups.has(key)) relationGroups.set(key, []);
    relationGroups.get(key).push(tuple);
  }

  for (const tuples of relationGroups.values()) {
    const positives = tuples.filter((t) => t.polarity > 0);
    const objects = new Map();
    for (const tuple of positives) {
      const key = stableValue(tuple.object);
      if (!objects.has(key)) objects.set(key, []);
      objects.get(key).push(tuple);
    }
    if (objects.size <= 1) continue;

    let allDisjoint = true;
    const pairs = [];
    for (let i = 0; i < positives.length; i += 1) {
      for (let j = i + 1; j < positives.length; j += 1) {
        if (sameObject(positives[i], positives[j])) continue;
        const scopeOverlap = overlap(positives[i].scope, positives[j].scope);
        pairs.push([positives[i].id, positives[j].id, scopeOverlap]);
        if (scopeOverlap !== false) allDisjoint = false;
      }
    }

    if (allDisjoint && pairs.length) {
      acts.push(makeAct("SEG", "Figure", "one relation carries different values in disjoint scopes", positives.map((t) => t.id), { pairs }));
      findings.push(Object.freeze({
        type: "narrowed_by_scope",
        subject: positives[0].subject,
        predicate: positives[0].predicate,
        values: Object.freeze(positives.map((t) => Object.freeze({ object: t.object, scope: t.scope, tupleId: t.id }))),
      }));
    } else {
      acts.push(makeAct("DEF", "Figure", "one relation carries unresolved competing values", positives.map((t) => t.id), { pairs }));
      findings.push(Object.freeze({
        type: "underdetermined",
        subject: positives[0].subject,
        predicate: positives[0].predicate,
        values: Object.freeze(positives.map((t) => Object.freeze({ object: t.object, scope: t.scope, tupleId: t.id }))),
      }));
    }
  }

  // Dependency propagation: if a tuple explicitly depends on a refused tuple,
  // trace the consequence rather than silently leaving it standing.
  for (const tuple of scoped) {
    const failedDependencies = tuple.dependsOn.filter((id) => defeated.has(id));
    if (!failedDependencies.length) continue;
    acts.push(makeAct("EVA", "Pattern", "trace a defeated dependency through the proposition graph", [tuple.id, ...failedDependencies]));
    findings.push(Object.freeze({
      type: "dependency_at_risk",
      tupleId: tuple.id,
      failedDependencies: Object.freeze(failedDependencies),
    }));
  }

  const disposition = findings.some((f) => f.type === "underdetermined" || f.type === "conflict")
    ? "underdetermined"
    : findings.some((f) => f.type === "narrowed_by_scope" || f.type === "split")
      ? "narrowed"
      : scoped.length === 0
        ? "void"
        : "sustained";

  if (scoped.length === 0) acts.push(makeAct("NUL", "Ground", "no addressed proposition exists in the supplied EOT", []));
  else if (disposition === "sustained") acts.push(makeAct("EVA", "Figure", "addressed propositions survive the available mechanical attacks", scoped.map((t) => t.id)));

  return Object.freeze({
    query: Object.freeze({ ...q }),
    disposition,
    tuples: Object.freeze(scoped),
    findings: Object.freeze(findings),
    acts: Object.freeze(acts),
    gaps: graph.gaps,
  });
};

/** Human-readable EO trace for inspection/debugging; rendering is downstream of reasoning. */
export const renderEotReasoning = (result) => {
  if (result?.gap) return `GAP ${result.gap}: ${result.reason ?? ""}`.trim();
  const lines = [`EOT REASONING — ${String(result.disposition ?? "unknown").toUpperCase()}`];
  if (result.query && Object.keys(result.query).length) lines.push(`query ${JSON.stringify(result.query)}`);
  lines.push("");

  for (const tuple of result.tuples ?? []) {
    lines.push(`${tuple.id}  ${tuple.op} · ${tuple.cell.terrain} · ${tuple.cell.stance}`);
    lines.push(`  ${stableValue(tuple.subject)} —${tuple.predicate}${tuple.polarity < 0 ? " NOT" : ""}→ ${stableValue(tuple.object)}`);
    if (tuple.scope?.start !== null || tuple.scope?.end !== null) lines.push(`  scope ${stableValue(tuple.scope.start)}..${stableValue(tuple.scope.end)}`);
    if (tuple.witness) lines.push(`  witness ${stableValue(tuple.witness)}`);
  }

  if ((result.findings ?? []).length) {
    lines.push("", "FINDINGS");
    for (const finding of result.findings) lines.push(`  ${finding.type}: ${JSON.stringify(finding)}`);
  }

  if ((result.acts ?? []).length) {
    lines.push("", "REASONING TRACE");
    for (const act of result.acts) {
      lines.push(`  ${act.op} · ${act.terrain} · ${act.stance} — ${act.reason}`);
    }
  }

  return lines.join("\n");
};

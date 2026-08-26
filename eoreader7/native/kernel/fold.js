import { cellOf } from "./cube.js";

const STATES = new Set(["open", "strengthened", "weakened", "fulfilled", "violated", "reframed", "superseded"]);
const emptyClasses = () => ({
  witnessed: [],
  provisional: [],
  expectations: [],
  obligations: [],
  exclusions: [],
  unresolvedAlternatives: [],
  activeFrames: [],
  receivedPriors: [],
  graphEntries: [],
  transformationObjects: [],
  transformationHistoryRefs: [],
});

const clone = (value) => value == null ? value : structuredClone(value);
const copyFold = (fold) => ({ ...(fold ?? receivedGround()) });

export function receivedGround(seed = {}) {
  return {
    schema: "EOFold@1",
    sequence: 0,
    ...emptyClasses(),
    ...clone(seed),
  };
}

export function eoOperation({ id = null, op, grain, witness = null, consequence = null, inputs = [], outputs = [], payload = null }) {
  const cell = cellOf(op, grain);
  if (cell.gap) throw new TypeError(cell.reason);
  if (op === "NUL" && payload?.action) {
    throw new TypeError("NUL records no transformation and cannot carry a mutating payload");
  }
  return Object.freeze({
    schema: "EOOperation@1",
    id,
    mode: cell.mode,
    domain: cell.domain,
    grain: cell.grain,
    operator: cell.op,
    terrain: cell.terrain,
    stance: cell.stance,
    witness,
    consequence,
    inputs: Object.freeze([...inputs]),
    outputs: Object.freeze([...outputs]),
    payload,
  });
}

export function deltaFold(operations = [], meta = {}) {
  return Object.freeze({
    schema: "DeltaFold@1",
    operations: Object.freeze([...operations]),
    ...meta,
  });
}

function upsertById(list = [], value) {
  const next = [...list];
  const i = value?.id == null ? -1 : next.findIndex((item) => item?.id === value.id);
  if (i >= 0) next[i] = { ...next[i], ...clone(value) };
  else next.push(clone(value));
  return next;
}

// ── the delta chain ─────────────────────────────────────────────────────
// Every array upsertManyById produces records its parent and exactly what
// changed, so a downstream VIEW can fold only the delta instead of
// re-walking the whole fold every encounter (the profile that earned
// this: existingIds + the per-encounter schema filters + a rebuilt
// union-find were ~45% of a full read, and the shape is O(n²) — the
// re-reading S4 forbids, at the fold tier. The fold IS the activation;
// nothing is re-read.). Exactness is the contract: a view either folds
// the delta into stolen parent state (linear chains — the reader's own
// shape), or recomputes from scratch; both produce identical results, and
// any UPDATE touching a view's schemas forces the recompute path.
const DELTA = new WeakMap(); // childArray -> { prev, appended, updated }

/**
 * chainView(compute, foldStep) — a memoized view over the delta chain.
 * `compute(list)` builds state from scratch; `foldStep(state, delta)`
 * advances stolen parent state by one delta and returns it, or null to
 * demand a recompute (e.g. an update it cannot fold exactly).
 */
export function chainView(compute, foldStep) {
  const memo = new WeakMap();
  return (list) => {
    if (!Array.isArray(list)) return compute(list ?? []);
    const hit = memo.get(list);
    if (hit) return hit;
    // Walk BACK to the nearest memoized ancestor — several upserts can land
    // between two views of the fold, and a one-step look orphans every
    // intermediate array (measured: the compute path stayed hot and the
    // whole point was lost). Then fold the collected deltas forward, oldest
    // first. A removal anywhere on the path, or a foldStep refusal, drops
    // to the from-scratch path — exactness first.
    const path = [];
    let node = list;
    let state = null;
    while (true) {
      const d = DELTA.get(node);
      if (!d || d.removed?.length) break;
      const prevState = memo.get(d.prev);
      path.push(d);
      if (prevState !== undefined) { state = prevState; memo.delete(d.prev); break; }
      node = d.prev;
    }
    if (state != null) {
      for (let i = path.length - 1; i >= 0; i -= 1) {
        state = foldStep(state, path[i]);
        if (state == null) break;
      }
    }
    if (state == null) state = compute(list);
    memo.set(list, state);
    return state;
  };
}

/** The fold's own id set, as a chain view — O(delta) per encounter. */
export const idSetOf = chainView(
  (list) => { const ids = new Set(); for (const e of list) if (e?.id != null) ids.add(e.id); return ids; },
  (ids, d) => { for (const e of d.appended) if (e?.id != null) ids.add(e.id); return ids; },
);

/** Entries of one schema, as a chain view — appended in place; any UPDATE
 * touching the schema demands the recompute path (exactness first). */
const bySchemaViews = new Map();
export function entriesBySchema(list, schema) {
  if (!bySchemaViews.has(schema)) {
    bySchemaViews.set(schema, chainView(
      (xs) => xs.filter((e) => e?.schema === schema),
      (arr, d) => {
        if (d.updated.some((e) => e?.schema === schema)) return null;
        for (const e of d.appended) if (e?.schema === schema) arr.push(e);
        return arr;
      },
    ));
  }
  return bySchemaViews.get(schema)(list);
}

const POSITIONS = new WeakMap(); // array -> Map(id -> position); positions never shift (append/replace-in-place only)

function upsertManyById(list = [], values = []) {
  if (!values.length) return list;
  const next = [...list];
  let index = POSITIONS.get(list);
  if (index) POSITIONS.delete(list); // linear chain: steal, extend, hand to the child
  else {
    index = new Map();
    for (let i = 0; i < next.length; i += 1) if (next[i]?.id != null) index.set(next[i].id, i);
  }
  const appended = [];
  const updated = [];
  for (const raw of values) {
    if (!raw) continue;
    const value = clone(raw);
    const id = value?.id;
    if (id != null && index.has(id)) {
      const i = index.get(id);
      next[i] = { ...next[i], ...value };
      updated.push(next[i]);
      continue;
    }
    if (id != null) index.set(id, next.length);
    next.push(value);
    appended.push(value);
  }
  DELTA.set(next, { prev: list, appended, updated });
  POSITIONS.set(next, index);
  return next;
}

function removeById(list = [], id) {
  return id == null ? list : list.filter((item) => item?.id !== id);
}

function graphable(value) {
  return value?.id && value?.schema ? value : null;
}

export function applyObservation(fold, observation) {
  if (observation?.schema !== "Observation@1") throw new TypeError("applyObservation requires Observation@1");
  const next = copyFold(fold);
  next.witnessed = upsertById(next.witnessed ?? [], observation);
  const additions = [
    observation,
    ...(observation.hyperedges ?? []),
    ...(observation.graphEntries ?? []),
  ].filter(graphable);
  next.graphEntries = upsertManyById(next.graphEntries ?? [], additions);
  return next;
}

function applyPayload(fold, operation) {
  if (operation.operator === "NUL") return [];
  const payload = operation.payload ?? {};
  switch (payload.action) {
    case "provisional":
      fold.provisional = upsertById(fold.provisional ?? [], payload.value);
      return [payload.value].filter(graphable);
    case "expectation": {
      const value = payload.value ?? {};
      if (value.state && !STATES.has(value.state)) throw new TypeError(`unknown expectation state: ${value.state}`);
      fold.expectations = upsertById(fold.expectations ?? [], value);
      return [value].filter(graphable);
    }
    case "obligation":
      fold.obligations = upsertById(fold.obligations ?? [], payload.value);
      return [payload.value].filter(graphable);
    case "exclusion":
      fold.exclusions = upsertById(fold.exclusions ?? [], payload.value);
      return [payload.value].filter(graphable);
    case "alternative":
      fold.unresolvedAlternatives = upsertById(fold.unresolvedAlternatives ?? [], payload.value);
      return [payload.value].filter(graphable);
    case "frame":
      fold.activeFrames = upsertById(fold.activeFrames ?? [], payload.value);
      return [payload.value].filter(graphable);
    case "prior":
      fold.receivedPriors = upsertById(fold.receivedPriors ?? [], payload.value);
      return [];
    case "hyperedge":
    case "graph-object":
      return [payload.value].filter(graphable);
    case "resolve-obligation": {
      const existing = (fold.obligations ?? []).find((item) => item?.id === payload.id);
      const revised = existing ? {
        ...existing,
        status: payload.status ?? "resolved",
        resolvedAt: fold.sequence + 1,
        resolutionRefs: [...(existing.resolutionRefs ?? []), operation.id].filter(Boolean),
      } : null;
      if (!revised) return [];
      fold.obligations = upsertById(fold.obligations ?? [], revised);
      return [revised];
    }
    case "remove-provisional":
      fold.provisional = removeById(fold.provisional ?? [], payload.id);
      return [];
    default:
      return [];
  }
}

export function applyDelta(fold, delta) {
  if (delta?.schema !== "DeltaFold@1") throw new TypeError("applyDelta requires DeltaFold@1");
  const next = copyFold(fold);
  next.sequence = (next.sequence ?? 0) + 1;
  let opIndex = 0;
  const operations = [];
  const graphUpdates = [];
  for (const rawOperation of delta.operations ?? []) {
    if (rawOperation?.schema !== "EOOperation@1") throw new TypeError("DeltaFold contains a non-EO operation");
    if (rawOperation.operator === "NUL" && rawOperation.payload?.action) throw new TypeError("NUL cannot mutate Fold state");
    const operation = rawOperation.id ? rawOperation : { ...rawOperation, id: `${delta.id ?? `delta:${next.sequence}`}:op:${opIndex}` };
    opIndex += 1;
    operations.push(operation);
    graphUpdates.push(...applyPayload(next, operation));
  }
  next.transformationObjects = upsertManyById(next.transformationObjects ?? [], operations);
  next.graphEntries = upsertManyById(next.graphEntries ?? [], [...operations, ...graphUpdates].filter(graphable));
  const ref = delta.id ?? `delta:${next.sequence}`;
  next.transformationHistoryRefs = [...(next.transformationHistoryRefs ?? []), ref];
  return next;
}

export function reconstruct(entries = [], seed = {}) {
  let fold = receivedGround(seed);
  for (const entry of entries) {
    if (entry?.schema === "EOFold@1") throw new TypeError("Fold snapshots are not append-log events");
    if (entry?.schema === "Observation@1") {
      fold = applyObservation(fold, entry);
      continue;
    }
    if (entry?.schema === "EOHyperedge@1") {
      const next = copyFold(fold);
      next.graphEntries = upsertManyById(next.graphEntries ?? [], [entry]);
      fold = next;
      continue;
    }
    if (entry?.schema === "DeltaFold@1") fold = applyDelta(fold, entry);
  }
  return fold;
}

const stable = (value) => JSON.stringify(value, Object.keys(value ?? {}).sort());
const slug = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function edgeSignature(edge) {
  const roles = (edge.participants ?? []).map((p) => ({ role: p.role ?? null, standing: p.standing ?? null }));
  return stable({ relation: edge.relation, roles });
}

function patternId(edge) {
  const roleKey = (edge.participants ?? []).map((p) => `${slug(p.role ?? "role")}-${slug(p.standing ?? "standing")}`).join("__");
  return `pattern:${slug(edge.relation)}:${roleKey}`;
}

const edgePosition = (edge) => Number.isFinite(edge?.scope?.sequencePosition) ? edge.scope.sequencePosition : null;
const encounterRef = (edge) => edge?.meta?.encounterRef ?? null;
const knownReferents = (edge) => new Set((edge?.participants ?? []).filter((p) => p.standing === "referent").map((p) => p.ref));

function pairConnection(a, b) {
  if (encounterRef(a) && encounterRef(a) === encounterRef(b)) return { kind: "same_encounter", shared: [] };
  const ar = knownReferents(a);
  const shared = [...knownReferents(b)].filter((ref) => ar.has(ref));
  return shared.length ? { kind: "shared_referent", shared } : null;
}

function motifSignature(a, b, connection) {
  return stable({
    relations: [a.relation, b.relation],
    connection: connection.kind,
    left: (a.participants ?? []).map((p) => ({ role: p.role ?? null, standing: p.standing ?? null })),
    right: (b.participants ?? []).map((p) => ({ role: p.role ?? null, standing: p.standing ?? null })),
  });
}

function motifId(a, b, connection) {
  const left = slug(a.relation);
  const right = slug(b.relation);
  return `motif:${left}__${right}:${connection.kind}`;
}

/** Single-edge recurrence. Useful as a weak lower-order pattern only. */
export function discoverPatternCandidates(entries = [], { minInstances = 3 } = {}) {
  if (!Number.isInteger(minInstances) || minInstances < 2) throw new TypeError("minInstances must be >= 2");
  const groups = new Map();
  for (const entry of entries) {
    if (entry?.schema !== "EOHyperedge@1") continue;
    const signature = edgeSignature(entry);
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(entry);
  }

  const candidates = [];
  for (const [signature, instances] of groups) {
    if (instances.length < minInstances) continue;
    candidates.push(Object.freeze({
      schema: "EOPatternCandidate@1",
      id: patternId(instances[0]),
      signature,
      relation: instances[0].relation,
      structuralMapping: Object.freeze((instances[0].participants ?? []).map((p) => Object.freeze({ role: p.role ?? null, standing: p.standing ?? null }))),
      instances: Object.freeze(instances.map((edge) => edge.id)),
      witnessRefs: Object.freeze(instances.map((edge) => edge.witness).filter(Boolean)),
      support: instances.length,
      counterInstances: Object.freeze([]),
      status: "provisional",
    }));
  }
  return Object.freeze(candidates);
}

/**
 * Discover recurrence of TWO relations in organization, not merely repeated
 * vocabulary. A pair is eligible only when the relations are locally joined
 * by the same encounter or by a witnessed shared referent. Unresolved lexical
 * surfaces never count as identity continuity.
 */
export function discoverMotifCandidates(entries = [], { minInstances = 2, maxSequenceGap = 4 } = {}) {
  if (!Number.isInteger(minInstances) || minInstances < 2) throw new TypeError("minInstances must be >= 2");
  if (!Number.isInteger(maxSequenceGap) || maxSequenceGap < 0) throw new TypeError("maxSequenceGap must be >= 0");
  const edges = entries.filter((entry) => entry?.schema === "EOHyperedge@1")
    .sort((a, b) => (edgePosition(a) ?? Infinity) - (edgePosition(b) ?? Infinity));
  const groups = new Map();

  for (let i = 0; i < edges.length; i += 1) {
    const a = edges[i];
    const aPos = edgePosition(a);
    for (let j = i + 1; j < edges.length; j += 1) {
      const b = edges[j];
      const bPos = edgePosition(b);
      if (aPos !== null && bPos !== null && bPos - aPos > maxSequenceGap) break;
      const connection = pairConnection(a, b);
      if (!connection) continue;
      const signature = motifSignature(a, b, connection);
      if (!groups.has(signature)) groups.set(signature, []);
      groups.get(signature).push({
        edges: [a.id, b.id],
        witnesses: [a.witness, b.witness].filter(Boolean),
        positions: [aPos, bPos],
        connection,
      });
    }
  }

  const candidates = [];
  for (const [signature, occurrences] of groups) {
    if (occurrences.length < minInstances) continue;
    const firstEdges = occurrences[0].edges.map((id) => edges.find((edge) => edge.id === id));
    const [a, b] = firstEdges;
    const connection = occurrences[0].connection;
    const flatEdges = [...new Set(occurrences.flatMap((occ) => occ.edges))];
    candidates.push(Object.freeze({
      schema: "EOMotifCandidate@1",
      id: motifId(a, b, connection),
      signature,
      relations: Object.freeze([a.relation, b.relation]),
      connection: connection.kind,
      instances: Object.freeze(flatEdges),
      occurrences: Object.freeze(occurrences.map((occ) => Object.freeze({
        edges: Object.freeze([...occ.edges]),
        positions: Object.freeze([...occ.positions]),
        connection: Object.freeze({ kind: occ.connection.kind, shared: Object.freeze([...occ.connection.shared]) }),
      }))),
      witnessRefs: Object.freeze([...new Set(occurrences.flatMap((occ) => occ.witnesses))]),
      support: occurrences.length,
      status: "provisional",
    }));
  }
  return Object.freeze(candidates);
}

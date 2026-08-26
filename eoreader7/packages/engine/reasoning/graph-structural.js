import {
  buildHypergraph, indexHypergraphEntries, graphEdgesForRelation,
  graphEdgesAtSequence, graphEntriesForIds,
} from "../hypergraph/index.js";
import { deltaFold, eoOperation } from "../fold/index.js";
import { obligation, openObligation } from "../obligations/index.js";

const allObservationEntries = (observations = []) => observations.flatMap((obs) => [
  obs,
  ...(obs.hyperedges ?? []),
  ...(obs.graphEntries ?? []),
]);

const stable = (value) => JSON.stringify(value, Object.keys(value ?? {}).sort());
const slug = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const edgePosition = (edge) => Number.isFinite(edge?.scope?.sequencePosition) ? edge.scope.sequencePosition : null;
const encounterRef = (edge) => edge?.meta?.encounterRef ?? null;
const knownReferents = (edge) => new Set((edge?.participants ?? []).filter((p) => p.standing === "referent").map((p) => p.ref));

function edgeSignature(edge) {
  const roles = (edge.participants ?? []).map((p) => ({ role: p.role ?? null, standing: p.standing ?? null }));
  return stable({ relation: edge.relation, roles });
}

function patternId(edge) {
  const roleKey = (edge.participants ?? []).map((p) => `${slug(p.role ?? "role")}-${slug(p.standing ?? "standing")}`).join("__");
  return `pattern:${slug(edge.relation)}:${roleKey}`;
}

function patternCandidate(instances) {
  const first = instances[0];
  return Object.freeze({
    schema: "EOPatternCandidate@1",
    id: patternId(first),
    signature: edgeSignature(first),
    relation: first.relation,
    structuralMapping: Object.freeze((first.participants ?? []).map((p) => Object.freeze({ role: p.role ?? null, standing: p.standing ?? null }))),
    instances: Object.freeze(instances.map((edge) => edge.id)),
    witnessRefs: Object.freeze(instances.map((edge) => edge.witness).filter(Boolean)),
    support: instances.length,
    counterInstances: Object.freeze([]),
    status: "provisional",
  });
}

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
  return `motif:${slug(a.relation)}__${slug(b.relation)}:${connection.kind}`;
}

function compareEdges(a, b) {
  const ap = edgePosition(a);
  const bp = edgePosition(b);
  if (ap !== null && bp !== null && ap !== bp) return ap - bp;
  if (ap !== null && bp === null) return -1;
  if (ap === null && bp !== null) return 1;
  return String(a.id).localeCompare(String(b.id));
}

function orderedPair(a, b) {
  return compareEdges(a, b) <= 0 ? [a, b] : [b, a];
}

function connectedPartners(graph, edge, maxSequenceGap) {
  const ids = new Set();
  const pos = edgePosition(edge);
  if (pos !== null) {
    for (let p = pos - maxSequenceGap; p <= pos + maxSequenceGap; p += 1) {
      for (const candidate of graphEdgesAtSequence(graph, p)) ids.add(candidate.id);
    }
  }
  for (const ref of knownReferents(edge)) {
    for (const id of graph?.incident?.get(ref) ?? []) ids.add(id);
  }
  ids.delete(edge.id);
  return graphEntriesForIds(graph, ids).filter((entry) => entry.schema === "EOHyperedge@1");
}

function pairEligible(a, b, maxSequenceGap) {
  const ap = edgePosition(a);
  const bp = edgePosition(b);
  if (ap !== null && bp !== null && Math.abs(bp - ap) > maxSequenceGap) return false;
  return Boolean(pairConnection(a, b));
}

function ambiguityObligations(graph, observations, foldSequence) {
  const ops = [];
  for (const observation of observations) {
    for (const edge of observation.hyperedges ?? []) {
      for (const participant of edge.participants ?? []) {
        const alternatives = [...new Set(participant.candidateReferents ?? [])];
        if (alternatives.length < 2) continue;
        const id = `obligation:identity:${edge.id}:${participant.role ?? "participant"}`;
        if (graph.byId.has(id)) continue;
        const value = obligation({
          id,
          distinction: { edge: edge.id, role: participant.role, occurrence: participant.ref },
          grounds: [edge.id, observation.id],
          alternatives,
          consequences: [{ kind: "relation_attribution", edge: edge.id }],
          openedAt: foldSequence + 1,
          persistence: 0,
        });
        ops.push(openObligation(value, { witness: observation.id, grain: "Figure", op: "DEF" }));
      }
    }
  }
  return ops;
}

function persistentUnresolvedObligations(graph, newEdges, foldSequence, { minUnresolvedRecurrence = 3 } = {}) {
  const touched = new Set();
  for (const edge of newEdges) {
    for (const participant of edge.participants ?? []) {
      if (participant.standing === "unresolved_surface" && participant.surfaceKey) touched.add(participant.surfaceKey);
    }
  }

  const ops = [];
  for (const surfaceKey of touched) {
    const id = `obligation:unresolved:${surfaceKey}`;
    if (graph.byId.has(id)) continue;
    const instances = graphEntriesForIds(graph, graph.incident.get(surfaceKey) ?? [])
      .filter((entry) => entry.schema === "EOHyperedge@1")
      .flatMap((edge) => (edge.participants ?? [])
        .filter((participant) => participant.standing === "unresolved_surface" && participant.surfaceKey === surfaceKey)
        .map((participant) => ({ edge, participant })));
    const uniqueEdges = [...new Map(instances.map((item) => [item.edge.id, item.edge])).values()];
    if (uniqueEdges.length < minUnresolvedRecurrence) continue;
    const alternatives = [...new Set(instances.flatMap((item) => item.participant.candidateReferents ?? []))];
    const value = obligation({
      id,
      distinction: {
        surfaceKey,
        occurrences: instances.map((item) => item.participant.ref),
        addressedRelationPositions: instances.map((item) => ({ edge: item.edge.id, role: item.participant.role })),
      },
      grounds: uniqueEdges.map((edge) => edge.id),
      alternatives,
      consequences: uniqueEdges.map((edge) => ({ kind: "relation_attribution", edge: edge.id })),
      openedAt: foldSequence + 1,
      persistence: 0,
    });
    ops.push(openObligation(value, {
      witness: uniqueEdges.map((edge) => edge.witness).filter(Boolean),
      grain: "Pattern",
      op: "DEF",
    }));
  }
  return ops;
}

function competingValueObligations(graph, newEdges, foldSequence) {
  const ops = [];
  const touched = new Set();
  for (const edge of newEdges) {
    const subject = (edge.participants ?? []).find((p) => p.role === "subject" && p.standing === "referent");
    const object = (edge.participants ?? []).find((p) => p.role === "object" && p.standing === "referent");
    if (!subject || !object) continue;
    touched.add(`${subject.ref}\u0000${edge.relation}`);
  }

  for (const key of touched) {
    const split = key.indexOf("\u0000");
    const subjectRef = key.slice(0, split);
    const relation = key.slice(split + 1);
    const id = `obligation:multiplicity:${subjectRef}:${relation}`;
    if (graph.byId.has(id)) continue;
    const group = graphEntriesForIds(graph, graph.incident.get(subjectRef) ?? [])
      .filter((edge) => edge.schema === "EOHyperedge@1" && edge.relation === relation)
      .map((edge) => ({
        edge,
        subject: (edge.participants ?? []).find((p) => p.role === "subject" && p.standing === "referent")?.ref,
        object: (edge.participants ?? []).find((p) => p.role === "object" && p.standing === "referent")?.ref,
      }))
      .filter((item) => item.subject === subjectRef && item.object);
    const values = [...new Set(group.map((item) => item.object))];
    if (values.length < 2) continue;
    const value = obligation({
      id,
      distinction: { subject: subjectRef, relation },
      grounds: group.map((item) => item.edge.id),
      alternatives: values,
      consequences: [{ kind: "relation_scope_or_multiplicity", relation }],
      openedAt: foldSequence + 1,
      persistence: 0,
    });
    ops.push(openObligation(value, {
      witness: group.map((item) => item.edge.witness).filter(Boolean),
      grain: "Figure",
      op: "DEF",
    }));
  }
  return ops;
}

function recurrenceOperation(prior, candidate, kind) {
  return eoOperation({
    op: "SYN",
    grain: "Pattern",
    witness: candidate.witnessRefs,
    consequence: {
      kind: prior ? `${kind}_strengthened` : kind,
      pattern: candidate.id,
      beforeSupport: prior?.support ?? 0,
      support: candidate.support,
    },
    inputs: candidate.instances,
    outputs: [candidate.id],
    payload: { action: "graph-object", value: candidate },
  });
}

function patternOperations(graph, newEdges, { minPatternInstances = 3 } = {}) {
  const operations = [];
  const seen = new Set();
  for (const edge of newEdges) {
    const id = patternId(edge);
    if (seen.has(id)) continue;
    seen.add(id);
    const signature = edgeSignature(edge);
    const instances = graphEdgesForRelation(graph, edge.relation).filter((candidate) => edgeSignature(candidate) === signature);
    if (instances.length < minPatternInstances) continue;
    const candidate = patternCandidate(instances);
    const prior = graph.byId.get(candidate.id);
    if (prior?.schema === "EOPatternCandidate@1" && (prior.support ?? 0) >= candidate.support) continue;
    operations.push(recurrenceOperation(prior, candidate, "structural_recurrence"));
  }
  return operations;
}

function affectedMotifSignatures(graph, newEdges, maxSequenceGap) {
  const targets = new Map();
  for (const edge of newEdges) {
    for (const partner of connectedPartners(graph, edge, maxSequenceGap)) {
      if (!pairEligible(edge, partner, maxSequenceGap)) continue;
      const [a, b] = orderedPair(edge, partner);
      const connection = pairConnection(a, b);
      if (!connection) continue;
      const signature = motifSignature(a, b, connection);
      if (!targets.has(signature)) targets.set(signature, { a, b, connection });
    }
  }
  return targets;
}

function occurrencesForMotif(graph, target, maxSequenceGap) {
  const occurrences = [];
  const seenPairs = new Set();
  for (const a0 of graphEdgesForRelation(graph, target.a.relation)) {
    for (const b0 of connectedPartners(graph, a0, maxSequenceGap)) {
      if (b0.relation !== target.b.relation || !pairEligible(a0, b0, maxSequenceGap)) continue;
      const [a, b] = orderedPair(a0, b0);
      if (a.relation !== target.a.relation || b.relation !== target.b.relation) continue;
      const connection = pairConnection(a, b);
      if (!connection || motifSignature(a, b, connection) !== motifSignature(target.a, target.b, target.connection)) continue;
      const pairKey = `${a.id}\u0000${b.id}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      occurrences.push({
        edges: [a.id, b.id],
        witnesses: [a.witness, b.witness].filter(Boolean),
        positions: [edgePosition(a), edgePosition(b)],
        connection,
      });
    }
  }
  return occurrences;
}

function motifOperations(graph, newEdges, { minMotifInstances = 2, maxMotifSequenceGap = 4 } = {}) {
  const operations = [];
  for (const target of affectedMotifSignatures(graph, newEdges, maxMotifSequenceGap).values()) {
    const occurrences = occurrencesForMotif(graph, target, maxMotifSequenceGap);
    if (occurrences.length < minMotifInstances) continue;
    const flatEdges = [...new Set(occurrences.flatMap((occ) => occ.edges))];
    const candidate = Object.freeze({
      schema: "EOMotifCandidate@1",
      id: motifId(target.a, target.b, target.connection),
      signature: motifSignature(target.a, target.b, target.connection),
      relations: Object.freeze([target.a.relation, target.b.relation]),
      connection: target.connection.kind,
      instances: Object.freeze(flatEdges),
      occurrences: Object.freeze(occurrences.map((occ) => Object.freeze({
        edges: Object.freeze([...occ.edges]),
        positions: Object.freeze([...occ.positions]),
        connection: Object.freeze({ kind: occ.connection.kind, shared: Object.freeze([...occ.connection.shared]) }),
      }))),
      witnessRefs: Object.freeze([...new Set(occurrences.flatMap((occ) => occ.witnesses))]),
      support: occurrences.length,
      status: "provisional",
    });
    const prior = graph.byId.get(candidate.id);
    if (prior?.schema === "EOMotifCandidate@1" && (prior.support ?? 0) >= candidate.support) continue;
    operations.push(recurrenceOperation(prior, candidate, "connected_motif_recurrence"));
  }
  return operations;
}

/**
 * Mechanical Fold revision from explicit hypergraph structure only.
 *
 * Crucially, revision is driven by NEW edges. Each new edge asks only which
 * existing distinctions it can materially affect. There is no whole-corpus
 * rescan per encounter.
 */
export function deriveGraphStructuralDelta(fold, observations = [], options = {}) {
  const additions = allObservationEntries(observations);
  const newEdges = observations.flatMap((obs) => obs.hyperedges ?? []);
  if (newEdges.length === 0) return deltaFold([], options.id ? { id: options.id } : {});

  const graph = options.graph ?? buildHypergraph([...(fold?.graphEntries ?? []), ...additions]);
  if (options.graph) indexHypergraphEntries(graph, additions);
  const foldSequence = fold?.sequence ?? 0;
  const operations = [
    ...ambiguityObligations(graph, observations, foldSequence),
    ...persistentUnresolvedObligations(graph, newEdges, foldSequence, options),
    ...competingValueObligations(graph, newEdges, foldSequence),
    ...patternOperations(graph, newEdges, options),
    ...motifOperations(graph, newEdges, options),
  ];
  return deltaFold(operations, options.id ? { id: options.id } : {});
}

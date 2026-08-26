const freeze = (value) => Object.freeze(value);

const OCCURRENCE_BINDING_SCHEMAS = new Set(["EOPronounBinding@1", "EODefiniteBinding@1"]);
const DEFAULT_DEPTH_THRESHOLDS = Object.freeze([2, 4, 8, 16]);

const positionOf = (edge) => Number.isFinite(edge?.scope?.sequencePosition)
  ? edge.scope.sequencePosition
  : Number.isFinite(edge?.sequencePosition)
    ? edge.sequencePosition
    : null;

const occurrenceOf = (participant) => participant?.occurrence
  ?? (participant?.standing === "unresolved_surface" ? participant?.ref : null);

function endpointOf(participant, bindings) {
  if (!participant) return null;
  if (participant.standing === "referent" && participant.ref) {
    return freeze({ entityRef: participant.ref, basis: "witnessed_referent", bindingRef: null });
  }
  const occurrence = occurrenceOf(participant);
  if (!occurrence) return null;
  const binding = bindings.get(occurrence);
  if (!binding?.referent) return null;
  return freeze({ entityRef: binding.referent, basis: "explicit_occurrence_binding", bindingRef: binding.id });
}

function structuralFeature({ id, entityRef, featureKey, featureValue, edge, basis, bindingRef = null }) {
  return freeze({
    id,
    entityRef,
    featureKey,
    featureValue,
    sequencePosition: positionOf(edge),
    witness: edge?.witness ?? null,
    witnessRefs: freeze([...(edge?.witnessRefs ?? [])]),
    provenance: freeze({
      modality: edge?.meta?.modality ?? edge?.provenance?.modality ?? null,
      giver: "kernel/kind-graph-structure",
      basis,
      sourceSchema: edge?.schema ?? null,
      sourceRef: edge?.id ?? null,
      bindingRef,
    }),
  });
}

/**
 * Present-tense structural projection over immutable witnessed hyperedges.
 *
 * Ordinary edge arrival is incremental. A newly learned occurrence binding is
 * rarer and can change the present interpretation of earlier raw witness, so
 * only binding changes trigger a full reprojection. Raw edges themselves are
 * never rewritten. The projection remains semantic-label free: role,
 * recurrence depth, role breadth, and relation-diversity depth are merely
 * candidate structure for the downstream held-out difference-making gate.
 */
export function createKindGraphStructureLedger({ depthThresholds = DEFAULT_DEPTH_THRESHOLDS } = {}) {
  const thresholds = [...new Set(depthThresholds)]
    .filter((value) => Number.isInteger(value) && value >= 2)
    .sort((a, b) => a - b);
  if (!thresholds.length) throw new TypeError("Kind graph structure requires at least one depth threshold >= 2");

  const rawEdges = new Map();
  const bindings = new Map();
  let features = [];
  let pending = [];
  let relationCount = new Map();
  let predicates = new Map();
  let roles = new Map();
  let roleBreadthEmitted = new Set();
  let rebuilds = 0;

  const emit = (descriptor) => {
    features.push(descriptor);
    pending.push(descriptor);
  };

  const projectEdge = (edge) => {
    for (let ordinal = 0; ordinal < (edge.participants ?? []).length; ordinal += 1) {
      const participant = edge.participants[ordinal];
      const endpoint = endpointOf(participant, bindings);
      if (!endpoint?.entityRef) continue;
      const entityRef = endpoint.entityRef;
      const role = participant.role ?? "participant";
      const bindingRef = endpoint.bindingRef;

      emit(structuralFeature({
        id: `kind-evidence:graph-role:${edge.id}:${ordinal}`,
        entityRef,
        featureKey: "relation_role",
        featureValue: role,
        edge,
        basis: endpoint.basis === "explicit_occurrence_binding"
          ? "bound_hyperedge_role"
          : "witnessed_hyperedge_role",
        bindingRef,
      }));

      const count = (relationCount.get(entityRef) ?? 0) + 1;
      relationCount.set(entityRef, count);
      if (thresholds.includes(count)) {
        emit(structuralFeature({
          id: `kind-evidence:graph-participation-depth:${entityRef}:${count}`,
          entityRef,
          featureKey: "relation_participation_depth",
          featureValue: `${count}+`,
          edge,
          basis: "witnessed_relation_recurrence_threshold",
          bindingRef,
        }));
      }

      if (!predicates.has(entityRef)) predicates.set(entityRef, new Set());
      const predicateSet = predicates.get(entityRef);
      const beforePredicates = predicateSet.size;
      predicateSet.add(edge.relation);
      if (predicateSet.size > beforePredicates && thresholds.includes(predicateSet.size)) {
        emit(structuralFeature({
          id: `kind-evidence:graph-diversity-depth:${entityRef}:${predicateSet.size}`,
          entityRef,
          featureKey: "relation_diversity_depth",
          featureValue: `${predicateSet.size}+`,
          edge,
          basis: "witnessed_relation_diversity_threshold",
          bindingRef,
        }));
      }

      if (!roles.has(entityRef)) roles.set(entityRef, new Set());
      const roleSet = roles.get(entityRef);
      roleSet.add(role);
      // Role BREADTH is "this being has been witnessed at more than one end
      // of an arrangement" — a structural fact any medium can present. It was
      // written as roleSet.has("subject") && roleSet.has("object"), which
      // made a kernel-level structural feature depend on an English-SVO
      // adapter's own vocabulary; material labelled any other way scored zero
      // breadth however varied its arrangements. Counted by DISTINCTNESS now,
      // never by the names the roles happen to carry.
      if (!roleBreadthEmitted.has(entityRef) && roleSet.size >= 2) {
        roleBreadthEmitted.add(entityRef);
        emit(structuralFeature({
          id: `kind-evidence:graph-role-breadth:${entityRef}:distinct-ends`,
          entityRef,
          featureKey: "relation_role_breadth",
          featureValue: `${roleSet.size}_distinct_roles`,
          edge,
          basis: "witnessed_role_breadth",
          bindingRef,
        }));
      }
    }
  };

  const rebuild = () => {
    features = [];
    pending = [];
    relationCount = new Map();
    predicates = new Map();
    roles = new Map();
    roleBreadthEmitted = new Set();
    const sorted = [...rawEdges.values()].sort((a, b) => positionOf(a) - positionOf(b) || a.id.localeCompare(b.id));
    for (const edge of sorted) projectEdge(edge);
    rebuilds += 1;
  };

  const ingest = (entries = []) => {
    let changed = 0;
    let bindingChanged = false;
    const newEdges = [];

    // Bindings are installed before projecting any edges from the same batch.
    // This avoids a transient unresolved projection when an observation carries
    // both the edge and its causal binding.
    for (const entry of entries ?? []) {
      if (!OCCURRENCE_BINDING_SCHEMAS.has(entry?.schema) || !entry?.occurrence || !entry?.referent) continue;
      const prior = bindings.get(entry.occurrence);
      if (prior?.id === entry.id && prior?.referent === entry.referent) continue;
      bindings.set(entry.occurrence, entry);
      bindingChanged = true;
      changed += 1;
    }

    for (const entry of entries ?? []) {
      if (entry?.schema !== "EOHyperedge@1" || !entry.id || positionOf(entry) === null || rawEdges.has(entry.id)) continue;
      rawEdges.set(entry.id, entry);
      newEdges.push(entry);
      changed += 1;
    }

    if (bindingChanged) {
      rebuild();
    } else if (newEdges.length) {
      newEdges.sort((a, b) => positionOf(a) - positionOf(b) || a.id.localeCompare(b.id));
      for (const edge of newEdges) projectEdge(edge);
    }
    return changed;
  };

  const drain = () => {
    if (!pending.length) return freeze([]);
    const out = freeze([...pending]);
    pending = [];
    return out;
  };

  return freeze({
    schema: "EOKindGraphStructureLedger@1",
    ingest,
    drain,
    // The induction index consumes only projection deltas. Keeping this alias
    // avoids an O(n^2) full scan while preserving its existing internal call.
    snapshot: drain,
    allFeatures: () => freeze([...features]),
    diagnostics: () => freeze({
      rawEdges: rawEdges.size,
      occurrenceBindings: bindings.size,
      projectedFeatures: features.length,
      rebuilds,
      depthThresholds: freeze([...thresholds]),
    }),
  });
}

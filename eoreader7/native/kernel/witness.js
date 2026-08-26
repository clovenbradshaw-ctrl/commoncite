const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

function sameAnchor(a, b) {
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

// Candidate nomination is not admission. By default a candidate needs explicit
// evidence anchored to the encounter; modality-specific gates may be stricter.
export async function witness(encounter, candidates = [], { admit } = {}) {
  const observations = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const defaultDecision = Boolean(candidate?.evidence) && sameAnchor(candidate.anchor, encounter.anchor);
    const decision = admit
      ? await admit(encounter, candidate)
      : { admitted: defaultDecision, witness: candidate?.evidence };
    const admitted = typeof decision === "boolean" ? decision : Boolean(decision?.admitted);
    if (!admitted) continue;
    const warrant = typeof decision === "object" ? (decision.witness ?? decision.evidence ?? candidate.evidence) : candidate.evidence;
    if (!warrant) continue;
    const nominated = candidate.candidate ?? candidate;
    observations.push(Object.freeze({
      schema: "Observation@1",
      id: candidate.id ?? `observation:${encounter.sequencePosition ?? "?"}:${index}`,
      witness: warrant,
      anchor: candidate.anchor ?? encounter.anchor,
      distinctions: asArray(nominated?.distinctions ?? nominated),
      hyperedges: Object.freeze([...(candidate.hyperedges ?? nominated?.hyperedges ?? [])]),
      graphEntries: Object.freeze([...(candidate.graphEntries ?? nominated?.graphEntries ?? [])]),
      provenance: {
        source: encounter.source,
        modality: encounter.modality,
        perceiver: candidate.perceiver,
        nominationCause: asArray(candidate.nominationCause),
        prior: candidate.prior ?? null,
      },
    }));
  }
  return observations;
}

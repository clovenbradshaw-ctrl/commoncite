import { eoOperation, deltaFold } from "../../kernel/fold.js";
import { deriveIdentityRevision } from "../../kernel/identity.js";
import {
  descriptorOccurrence,
  directDescriptorOccurrences,
  descriptorHypotheses, descriptorHypothesesWith,
} from "./individuation.js";
import {
  appositionalDescriptorBindings,
  projectDiscourseReferents,
} from "./discourse-referents.js";
import { textIdentityEvidence } from "./identity-evidence.js";
import { idSetOf, entriesBySchema } from "../../kernel/fold.js";
import { identityEvidenceFromAnchors } from "./anchoring.js";

// The fold's id set is a chain view (kernel) — O(delta) per encounter.
// The view's Set is SHARED state, so local admissions overlay it rather
// than mutating it.
const existingIds = (fold) => {
  const base = idSetOf(fold?.graphEntries ?? []);
  const added = new Set();
  return { has: (id) => base.has(id) || added.has(id), add: (id) => added.add(id) };
};

/**
 * Convert witnessed text structure into warranted EO change.
 *
 * Repeated descriptor strings no longer become referents merely by recurrence.
 * Recurrence earns an identity hypothesis. Actual descriptor-derived referents
 * require contextual occurrence-level support (currently explicit apposition).
 * This prevents every use of "the creature" or "the fiend" from collapsing
 * globally while preserving each witnessed occurrence and hypothesis.
 */
export async function reviseTextFold({ observations = [], fold = {}, canonicalizationFloor = undefined } = {}) {
  const known = existingIds(fold);
  const operations = [];
  const newDescriptorOccurrences = [];
  const currentGraphEntries = [];
  const identitySupports = [];
  const identityAttacks = [];

  const admitGraphObject = (value, { op = "INS", grain = "Ground", witness = null, consequence = null } = {}) => {
    if (!value?.id || known.has(value.id)) return false;
    known.add(value.id);
    currentGraphEntries.push(value);
    operations.push(eoOperation({
      op,
      grain,
      witness,
      outputs: [value.id],
      consequence,
      payload: { action: "graph-object", value },
    }));
    return true;
  };

  const admitOccurrence = (occurrence, witnessRef) => {
    if (!occurrence || !admitGraphObject(occurrence, {
      op: "INS",
      grain: "Ground",
      witness: witnessRef,
      consequence: { kind: "referent_occurrence_witnessed", occurrence: occurrence.id },
    })) return;
    newDescriptorOccurrences.push(occurrence);
  };

  for (const observation of observations) {
    const witnessRef = observation?.id ?? observation?.witness ?? null;
    const encounterRef = observation?.provenance?.source != null
      ? `${observation.provenance.source}:${observation.anchor?.start ?? observation.id ?? "?"}`
      : observation?.id ?? "unknown";

    const identity = textIdentityEvidence(observation?.witness, {
      alternatives: fold?.unresolvedAlternatives ?? [],
      witness: witnessRef,
    });
    identitySupports.push(...identity.supports);
    identityAttacks.push(...identity.attacks);

    for (const occurrence of directDescriptorOccurrences(observation?.witness, { encounterRef })) {
      admitOccurrence(occurrence, witnessRef);
    }

    const discourse = appositionalDescriptorBindings(observation?.witness, {
      encounterRef,
      witness: witnessRef,
    });
    for (const occurrence of discourse.occurrences) admitOccurrence(occurrence, witnessRef);
    for (const link of discourse.links) {
      admitGraphObject(link, {
        op: "CON",
        grain: "Figure",
        witness: witnessRef,
        consequence: { kind: "discourse_identity_supported", link: link.id },
      });
    }

    for (const entry of observation?.graphEntries ?? []) {
      currentGraphEntries.push(entry);
      if (entry?.schema !== "EOReferent@1" || !entry.id || known.has(entry.id)) continue;
      known.add(entry.id);
      operations.push(eoOperation({
        op: "INS",
        grain: "Figure",
        witness: witnessRef,
        outputs: [entry.id],
        consequence: { kind: "referent_admitted", ref: entry.id },
        payload: { action: "graph-object", value: entry },
      }));
    }

    for (const edge of observation?.hyperedges ?? []) {
      if (edge?.schema !== "EOHyperedge@1") continue;
      currentGraphEntries.push(edge);
      for (const participant of edge.participants ?? []) {
        admitOccurrence(descriptorOccurrence(participant, {
          encounterRef: edge.meta?.encounterRef ?? encounterRef,
          edge,
        }), witnessRef);
      }
      if (!edge.id || known.has(edge.id)) continue;
      known.add(edge.id);
      operations.push(eoOperation({
        op: "CON",
        grain: "Figure",
        witness: witnessRef,
        inputs: (edge.participants ?? []).map((participant) => participant.ref).filter(Boolean),
        outputs: [edge.id],
        consequence: { kind: "relation_witnessed", edge: edge.id },
        payload: { action: "hyperedge", value: edge },
      }));
    }
  }

  for (const hypothesis of descriptorHypothesesWith(fold?.graphEntries ?? [], newDescriptorOccurrences)) {
    if (known.has(hypothesis.id)) continue;
    known.add(hypothesis.id);
    operations.push(eoOperation({
      op: "CON",
      grain: "Figure",
      inputs: [...hypothesis.occurrenceRefs],
      outputs: [hypothesis.id],
      consequence: { kind: "identity_hypothesis_opened", hypothesis: hypothesis.id },
      payload: { action: "provisional", value: hypothesis },
    }));
  }

  const discourseSource = [
    ...(fold?.graphEntries ?? []),
    ...currentGraphEntries,
  ];
  for (const referent of projectDiscourseReferents(discourseSource)) {
    if (known.has(referent.id)) continue;
    admitGraphObject(referent, {
      op: "INS",
      grain: "Figure",
      consequence: {
        kind: "contextual_referent_admitted",
        ref: referent.id,
        defeasibleBy: ["SEG", "DEF", "REC"],
      },
    });
  }

  // Descriptor-anchoring evidence (anchoring.js), witnessed through the
  // ordinary perception -> witness path as EOAnchorEvidence@1 entries, joins
  // the SAME support/attack grammar apposition already feeds — one
  // identity-revision door, not a second mechanism.
  const anchors = observations.flatMap((o) => (o?.graphEntries ?? []).filter((x) => x?.schema === "EOAnchorEvidence@1"));
  if (anchors.length) {
    const anchorEvidence = identityEvidenceFromAnchors(anchors, fold);
    identitySupports.push(...anchorEvidence.supports);
    identityAttacks.push(...anchorEvidence.attacks);
  }

  const identityDelta = deriveIdentityRevision({
    fold: {
      ...fold,
      graphEntries: [...(fold?.graphEntries ?? []), ...currentGraphEntries],
    },
    supports: identitySupports,
    attacks: identityAttacks,
    canonicalizationFloor,
  });
  operations.push(...identityDelta.operations);

  return deltaFold(operations);
}

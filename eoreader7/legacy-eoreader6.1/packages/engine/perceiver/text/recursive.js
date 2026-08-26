import { tokenize, buildFrequencyTable, functionWordSet } from "./material.js";
import { splitSentences } from "./spans.js";
import { extractSurfaces, discoverReferents, diaNorm } from "./surfaces.js";
import { discoverRelationVocab, extractRelations } from "./relations.js";
import { hyperedge } from "../../hypergraph/index.js";

const slug = (value) => diaNorm(value).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

function surfaceMap(events = []) {
  const map = new Map();
  for (const event of events) {
    if (event?.type !== "DEF.admit") continue;
    map.set(diaNorm(event.surface), event.referent_id);
  }
  return map;
}

function referentObjects(events = []) {
  const byId = new Map();
  for (const event of events) {
    if (event?.type !== "DEF.admit") continue;
    if (!byId.has(event.referent_id)) byId.set(event.referent_id, { schema: "EOReferent@1", id: event.referent_id, surfaces: [], provenance: [] });
    const ref = byId.get(event.referent_id);
    if (!ref.surfaces.includes(event.surface)) ref.surfaces.push(event.surface);
    ref.provenance.push(event.provenance);
  }
  return [...byId.values()].map((value) => Object.freeze({ ...value, surfaces: Object.freeze(value.surfaces), provenance: Object.freeze(value.provenance) }));
}

function containsSurface(text, surface) {
  const hay = diaNorm(text);
  const needle = diaNorm(surface);
  if (!needle) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(needle)}([^\\p{L}\\p{N}]|$)`, "u").test(hay);
}

function currentReferents(text, refs = []) {
  return refs.filter((ref) => ref.surfaces.some((surface) => containsSurface(text, surface)));
}

function referentsInSpan(span, map) {
  const matches = new Map();
  for (const [surface, ref] of map) {
    if (containsSurface(span, surface)) {
      if (!matches.has(ref)) matches.set(ref, []);
      matches.get(ref).push(surface);
    }
  }
  return matches;
}

function resolveParticipant(surface, map, sequencePosition, relationIndex, role) {
  const exact = map.get(diaNorm(surface));
  if (exact) return { ref: exact, role, standing: "referent", surface, resolution: "exact_surface" };
  const candidates = referentsInSpan(surface, map);
  if (candidates.size === 1) {
    const [[ref, matchedSurfaces]] = candidates;
    return { ref, role, standing: "referent", surface, resolution: "unique_surface_in_span", matchedSurfaces };
  }
  const lexical = slug(surface) || "unknown";
  const occurrence = `occ:${sequencePosition}:${relationIndex}:${role}`;
  return {
    ref: occurrence,
    occurrence,
    surfaceKey: `surface:${lexical}`,
    role,
    standing: "unresolved_surface",
    surface,
    candidateReferents: [...candidates.keys()],
  };
}

function earnedClosedClass(table) {
  if (!table?.total || table.freq.size === 0) return new Set();
  const candidate = functionWordSet(table);
  return candidate.size * 2 < table.freq.size ? candidate : new Set();
}

function lexicalNounOccurrences(text, sequencePosition, encounterRef, posPrior) {
  if (!posPrior?.forms) return [];
  const out = [];
  let ordinal = 0;
  for (const match of text.matchAll(WORD_RE)) {
    const raw = match[0];
    const form = diaNorm(raw);
    const counts = posPrior.forms[form];
    if (!counts) continue;
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const nounShare = total ? (counts.NOUN ?? 0) / total : 0;
    if (nounShare <= 0.5) continue;
    const surfaceKey = `surface:${slug(raw) || "unknown"}`;
    out.push(Object.freeze({
      schema: "EOLexicalOccurrence@1",
      id: `lex:${sequencePosition}:${ordinal}`,
      surfaceKey,
      surface: raw,
      upos: "NOUN",
      standing: "occurrence",
      encounterRef,
      offset: match.index,
      witness: `text:${sequencePosition}:${match.index}`,
    }));
    ordinal += 1;
  }
  return out;
}

function taskTargetSurfaceKeys(orientation = {}) {
  const out = new Set();
  for (const task of orientation.activeTasks ?? []) {
    for (const target of task.targets ?? []) {
      if (typeof target === "string" && target.startsWith("surface:")) out.add(target);
    }
  }
  return out;
}

/**
 * A Fold task may make a previously unremarkable surface worth checking for.
 * This emits only occurrence evidence. It does NOT promote the surface to a
 * referent or assert that two occurrences corefer.
 */
function taskTargetOccurrences(text, sequencePosition, encounterRef, orientation, alreadySeen = new Set()) {
  const out = [];
  let ordinal = 0;
  for (const surfaceKey of taskTargetSurfaceKeys(orientation)) {
    if (alreadySeen.has(surfaceKey)) continue;
    const surface = surfaceKey.slice("surface:".length).replace(/_/g, " ");
    if (!surface || !containsSurface(text, surface)) continue;
    out.push(Object.freeze({
      schema: "EOTaskTargetOccurrence@1",
      id: `task-target:${sequencePosition}:${ordinal}`,
      surfaceKey,
      surface,
      standing: "task_nominated_occurrence",
      encounterRef,
      witness: `text:${sequencePosition}:task-target:${ordinal}`,
      provenance: Object.freeze({ giver: "active-reading-task", basis: "targeted recurrence check" }),
    }));
    ordinal += 1;
  }
  return out;
}

function mergeRelationEvidence(store, candidates = []) {
  for (const candidate of candidates) {
    if (!candidate?.verb) continue;
    if (!store.has(candidate.verb)) store.set(candidate.verb, { surfaceForms: new Set(), upos: candidate.upos ?? null, verbDominant: candidate.verbDominant !== false });
    const record = store.get(candidate.verb);
    for (const surface of candidate.surfaceForms ?? []) record.surfaceForms.add(surface);
    if (candidate.upos) record.upos = candidate.upos;
    if (candidate.verbDominant === false) record.verbDominant = false;
  }
}

function admittedRelationVerbs(store, minSurfaces) {
  const verbs = new Set();
  for (const [verb, record] of store) {
    if (record.verbDominant !== false && record.surfaceForms.size >= minSurfaces) verbs.add(verb);
  }
  return verbs;
}

export function createCausalTextPerceiver({ minRelationSurfaces = 2, refreshEvery = 25, posPrior = null } = {}) {
  if (!Number.isInteger(refreshEvery) || refreshEvery < 1) throw new TypeError("refreshEvery must be a positive integer");
  if (posPrior && (posPrior.schema !== "POSPrior@1" || !posPrior.provenance?.source)) throw new TypeError("posPrior must be a giver-named POSPrior@1");
  const priorSentences = [];
  let priorText = "";
  let relationRefreshFrom = 0;
  const relationEvidence = new Map();
  let cache = { closed: new Set(), refs: new Map(), referents: [], gaps: [], verbs: new Set() };

  const refresh = () => {
    // Surface/kind discovery still evaluates the accumulated causal past, but
    // relation-vocabulary learning scans only the NEW batch. The old path ran
    // a growing surface regex over the entire growing book every refresh — a
    // quadratic/cubic multiplier on long works. Distinct supporting surfaces
    // are accumulated explicitly, so relation admission keeps its original
    // recurrence meaning without rereading old material.
    const priorWords = tokenize(priorText);
    const table = buildFrequencyTable(priorWords);
    const closed = earnedClosedClass(table);
    const surfaces = extractSurfaces(priorSentences, { functionWords: closed });
    const discovered = discoverReferents(surfaces);
    const batchSentences = priorSentences.slice(relationRefreshFrom);
    const batchText = batchSentences.map((sentence) => sentence.text).join("\n");
    if (batchText && surfaces.length) {
      const relationResult = discoverRelationVocab(batchText, {
        surfaces,
        functionWords: closed,
        minSurfaces: 1,
        posPrior,
      });
      mergeRelationEvidence(relationEvidence, relationResult.candidates);
    }
    relationRefreshFrom = priorSentences.length;
    cache = {
      closed,
      refs: surfaceMap(discovered.events),
      referents: referentObjects(discovered.events),
      gaps: discovered.gaps,
      verbs: admittedRelationVerbs(relationEvidence, minRelationSurfaces),
    };
  };

  return Object.freeze({
    id: "text/recursive",
    async perceive(encounter, orientation = {}) {
      if (encounter?.modality !== "text" || typeof encounter.material !== "string") return [];
      const sequencePosition = encounter.sequencePosition ?? priorSentences.length;
      const encounterRef = `encounter:${sequencePosition}`;
      if (priorSentences.length === 0 || priorSentences.length % refreshEvery === 0) refresh();

      const relations = extractRelations(encounter.material, { verbs: cache.verbs, functionWords: cache.closed });
      const edges = relations.map((rel, index) => hyperedge({
        id: `edge:text:${sequencePosition}:${index}`,
        relation: rel.verb,
        participants: [
          resolveParticipant(rel.subject, cache.refs, sequencePosition, index, "subject"),
          resolveParticipant(rel.object, cache.refs, sequencePosition, index, "object"),
        ],
        witness: `text:${sequencePosition}:${rel.offset}`,
        scope: { sequencePosition, offset: rel.offset },
        eo: { op: "CON", grain: "Figure" },
        meta: { polarity: rel.polarity, source: encounter.source, encounterRef },
      }));

      const seenReferents = currentReferents(encounter.material, cache.referents);
      const mentions = seenReferents.map((ref) => Object.freeze({
        schema: "EOMention@1",
        id: `mention:${sequencePosition}:${slug(ref.id)}`,
        referent: ref.id,
        encounterRef,
        anchor: encounter.anchor,
        witness: `text:${sequencePosition}`,
        source: encounter.source,
      }));
      const lexicalOccurrences = lexicalNounOccurrences(encounter.material, sequencePosition, encounterRef, posPrior);
      const lexicalKeys = new Set(lexicalOccurrences.map((occ) => occ.surfaceKey));
      const targetedOccurrences = taskTargetOccurrences(encounter.material, sequencePosition, encounterRef, orientation, lexicalKeys);
      const activeIds = new Set(seenReferents.map((ref) => ref.id));
      for (const edge of edges) for (const participant of edge.participants ?? []) if (participant.standing === "referent") activeIds.add(participant.ref);
      const gaps = cache.gaps
        .filter((gap) => activeIds.has(gap.referent))
        .map((gap) => ({ schema: "EOReferentGap@1", id: `gap:referent:${slug(gap.referent)}`, ...gap }));

      const currentSentence = { text: encounter.material, offset: encounter.anchor?.start ?? 0, order: priorSentences.length };
      priorSentences.push(currentSentence);
      priorText += `${priorText ? "\n" : ""}${encounter.material}`;

      if (edges.length === 0 && seenReferents.length === 0 && lexicalOccurrences.length === 0 && targetedOccurrences.length === 0) return [];
      return [{
        candidate: {
          distinctions: [
            ...seenReferents.map((ref) => ({ referent: ref.id, surfaces: ref.surfaces })),
            ...edges.map((edge) => ({ relation: edge.relation, participants: edge.participants })),
            ...lexicalOccurrences.map((occ) => ({ occurrence: occ.id, surfaceKey: occ.surfaceKey, upos: occ.upos })),
            ...targetedOccurrences.map((occ) => ({ occurrence: occ.id, surfaceKey: occ.surfaceKey, taskNominated: true })),
          ],
          hyperedges: edges,
          graphEntries: [...seenReferents, ...mentions, ...lexicalOccurrences, ...targetedOccurrences, ...gaps],
        },
        anchor: encounter.anchor,
        evidence: encounter.material,
        nominationCause: targetedOccurrences.length ? ["bottom_up_difference", "active_task"] : "bottom_up_difference",
      }];
    },
  });
}

export function textEncounters(text, { source = "text", offset = 0 } = {}) {
  return splitSentences(text).map((sentence) => ({
    schema: "Encounter@1",
    source,
    modality: "text",
    anchor: { start: offset + sentence.offset, end: offset + sentence.offset + sentence.text.length },
    extent: sentence.text.length,
    material: sentence.text,
    sequencePosition: sentence.order,
  }));
}

import { tokenize, buildFrequencyTable, functionWordSet } from "./material.js";
import { splitSentences } from "./spans.js";
import { createSurfaceEvidence, accumulateSurfaceEvidence, surfacesFromEvidence, discoverReferents, diaNorm } from "./surfaces.js";
import { discoverRelationVocab, extractRelations } from "./relations.js";
import { directDescriptorOccurrences, descriptorOccurrence } from "./individuation.js";
import { createDescriptorAnchoring } from "./anchoring.js";
import { hyperedge } from "../../kernel/hypergraph.js";

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

// A relation form's composition standing, from the received POS prior.
// Absent prior, or absent form: eligible (nothing has been shown against it).
function relationStanding(verb, posPrior) {
  const counts = posPrior?.forms?.[diaNorm(String(verb ?? ""))];
  if (!counts) return Object.freeze({ eligible: true, basis: "no received evidence about this form; absence is not a refusal" });
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (!total) return Object.freeze({ eligible: true, basis: "no received evidence about this form; absence is not a refusal" });
  let dominant = null, best = -1;
  for (const [tag, n] of Object.entries(counts)) if (n > best) { best = n; dominant = tag; }
  const eligible = dominant === "VERB";
  return Object.freeze({
    eligible,
    dominantClass: dominant,
    share: best / total,
    basis: eligible
      ? "treebank-dominant VERB — eligible as portable relation memory"
      : `treebank-dominant ${dominant} — an auxiliary or non-verb form does not become familiarity by recurring`,
    giver: "UD_English-EWT via bin/priors/pos/en-ud-ewt.json",
  });
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
    if (!store.has(candidate.verb)) store.set(candidate.verb, { surfaceForms: new Set(), relatedPairs: new Set(), upos: candidate.upos ?? null, verbDominant: candidate.verbDominant !== false });
    const record = store.get(candidate.verb);
    for (const surface of candidate.surfaceForms ?? []) record.surfaceForms.add(surface);
    if (candidate.upos) record.upos = candidate.upos;
    if (candidate.verbDominant === false) record.verbDominant = false;
  }
}

// FOLD-CONDITIONED ADMISSION — "the high determines the probability of the
// low", done as conditioning rather than as a lookup list.
//
// The engine's own gate counts ONE kind of evidence: distinct capitalized
// surfaces the verb was seen beside. That is anchor evidence, and it starves
// on first-person material where the cast is rarely named in the same clause
// as its own predicates (measured on Dracula's opening 700 sentences: 74
// candidates nominated, 2 admitted).
//
// A verb witnessed BETWEEN TWO BEINGS THIS READING HAS ALREADY ESTABLISHED is
// also relation evidence, and it comes from the material, not from a table —
// the Entity terrain, already earned, conditioning what counts as evidence at
// the Link terrain below it. Counted at the SAME declared strength as anchor
// evidence (minSurfaces), so no new number is introduced and neither path is
// privileged. Measured on the same slice: 2 -> 21 verbs, every one warranted
// by Dracula's own text.
//
// NOT a loosened gate and NOT a received lexicon standing in for reading
// (READING-POLICY P2: "statistics derived from the material, not lookup
// lists"; P3: "never patch a missing prior by loosening an engine gate").
// The grammar prior's role here is unchanged and one-directional: it may
// REFUSE a candidate (verbDominant === false) and may never admit one.
function admittedRelationVerbs(store, minSurfaces) {
  const verbs = new Set();
  for (const [verb, record] of store) {
    if (record.verbDominant === false) continue; // grammar refuses; it never admits
    const anchorEvidence = record.surfaceForms.size;
    const relationEvidence = record.relatedPairs?.size ?? 0;
    if (anchorEvidence >= minSurfaces || relationEvidence >= minSurfaces) verbs.add(verb);
  }
  return verbs;
}

/**
 * Witness, over the new batch only, which candidate verbs occur in a sentence
 * that names at least two already-established referents — recording the PAIR,
 * so "witnessed relating these two beings" is counted once however often that
 * one sentence repeats, exactly as distinct surfaces are counted once each.
 */
function witnessRelatedPairs(store, sentences, refs) {
  if (!refs?.size || !store.size) return;
  const surfaces = [...refs.keys()];
  for (const sentence of sentences) {
    const hay = diaNorm(sentence.text);
    const present = [];
    for (const surface of surfaces) {
      if (containsSurface(sentence.text, surface)) present.push(refs.get(surface));
      if (present.length > 2) break;
    }
    const distinct = [...new Set(present)];
    if (distinct.length < 2) continue;
    const pairKey = distinct.slice(0, 2).sort().join("\u0000");
    for (const [verb, record] of store) {
      if (!record.relatedPairs) record.relatedPairs = new Set();
      if (hay.includes(diaNorm(verb))) record.relatedPairs.add(pairKey);
    }
  }
}

export function createCausalTextPerceiver({ minRelationSurfaces = 2, refreshEvery = 25, posPrior = null, descriptorAnchoring = null } = {}) {
  if (!Number.isInteger(refreshEvery) || refreshEvery < 1) throw new TypeError("refreshEvery must be a positive integer");
  if (posPrior && (posPrior.schema !== "POSPrior@1" || !posPrior.provenance?.source)) throw new TypeError("posPrior must be a giver-named POSPrior@1");
  // OPT-IN: descriptor anchoring (one-hop activation recall binding
  // definite/possessive descriptors to the admitted cast — anchoring.js).
  // Off by default so every existing caller is byte-identical; when
  // supplied, its floors are DECLARED by the caller (anchoring.js throws
  // otherwise — pronouns.js's own contract, applied unchanged).
  const anchoring = descriptorAnchoring ? createDescriptorAnchoring(descriptorAnchoring) : null;
  const priorSentences = [];
  let priorText = "";
  let relationRefreshFrom = 0;
  const relationEvidence = new Map();
  let cache = { closed: new Set(), refs: new Map(), referents: [], gaps: [], verbs: new Set() };
  // THE FOLD IS THE ACTIVATION — nothing is re-read. Each sentence's
  // surface evidence and word counts are folded in ONCE (arithmetic tier:
  // monotone accumulation, S10); refresh() only PROJECTS from the
  // accumulated evidence. The old shape re-tokenized and re-scanned the
  // whole prefix every 25 encounters — O(n²), measured: 75s on
  // Frankenstein, ~80min on Les Misérables, which is re-reading wearing a
  // refresh's name (S4). The split is exact: the per-sentence evidence
  // depends on nothing but the sentence; functionWords bite only in the
  // projection — proven by a byte-identical full-Frankenstein diff before
  // this landed.
  const surfaceEvidence = createSurfaceEvidence();
  const runningFreq = new Map();
  let runningTotal = 0;
  let foldedTo = 0;

  const refresh = () => {
    for (const sent of priorSentences.slice(foldedTo)) {
      accumulateSurfaceEvidence([sent], surfaceEvidence);
      for (const w of tokenize(sent.text)) { runningFreq.set(w, (runningFreq.get(w) || 0) + 1); runningTotal += 1; }
    }
    foldedTo = priorSentences.length;
    const table = { freq: runningFreq, total: runningTotal };
    const closed = earnedClosedClass(table);
    const surfaces = surfacesFromEvidence(surfaceEvidence, { functionWords: closed });
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
    // Fold-conditioned evidence, over the SAME new batch the vocabulary scan
    // uses — never a rescan of everything read so far.
    witnessRelatedPairs(relationEvidence, batchSentences, surfaceMap(discovered.events));
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
        // compositionStanding: whether this relation FORM is eligible to be
        // carried as portable experience or composed with another relation.
        // experience-priors.js reads exactly this field ("auxiliaries/noise
        // do not become familiarity merely because they appeared often") but
        // nothing on this side ever set it, so a reader's carried memory
        // filled with `were`/`would`/`has`/`could` — measured, not
        // hypothesized (the first experienced-new-book run's own carried
        // memory was 4 auxiliaries and nothing else). Decided by the SAME
        // received POS prior the descriptor-head gate already uses: a form
        // the treebank says is dominantly AUX (or any non-VERB class) is
        // ineligible; a form ABSENT from the prior stays eligible, the same
        // absent-is-a-gap-not-a-mismatch polarity that gate already holds.
        meta: { polarity: rel.polarity, source: encounter.source, encounterRef, compositionStanding: relationStanding(rel.verb, posPrior) },
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

      // Descriptor anchoring runs on EVERY sentence when enabled — the
      // activation frames must accumulate causally whether or not this
      // sentence carries a descriptor — and its evidence rides the
      // candidate's graphEntries so it passes through witness like every
      // other observation (nomination is not admission).
      let anchorEvidence = [];
      let descriptorOccsEmitted = [];
      if (anchoring) {
        // Only descriptors whose HEAD token survives two cuts are offered
        // for anchoring. Measured on Frankenstein's opening letters:
        // without them, "the most" / "that the" / "the first" —
        // determiner-plus-function/adjective bigrams, not descriptions of
        // any being — bound confidently to the only cast member in reach
        // and flooded the alternatives with furniture. Cut 1: the
        // perceiver's OWN frequency-derived closed class (cache.closed) —
        // never a hand list. Cut 2: when a POSPrior@1 is supplied (the
        // same received prior lexicalNounOccurrences already reads), a
        // head the treebank POSITIVELY says is not a noun ("most": ADV/ADJ
        // only; "first": ADJ-dominant) is refused; a head ABSENT from the
        // prior is kept — an unknown word cannot be proven furniture, and
        // furniture is by nature high-frequency and therefore present
        // (the same absent-is-a-gap-not-a-mismatch polarity
        // grammar-lens.js records for the identical prior).
        // Edge participants first: an anchored descriptor is only worth
        // something to composition if it resolves an endpoint an EDGE
        // actually has. These carry their participant's own occurrence id
        // so the binding lands in the id space the ledger reads.
        const participantOccs = edges.flatMap((edge) => (edge.participants ?? [])
          .filter((p) => p.standing === "unresolved_surface")
          .map((p) => {
            const occ = descriptorOccurrence(p, { encounterRef, edge });
            return occ ? { ...occ, participantOccurrence: p.occurrence ?? p.ref } : null;
          })
          .filter(Boolean));
        const descriptorOccs = [...participantOccs, ...directDescriptorOccurrences(encounter.material, { encounterRef })].filter((occ) => {
          const head = (occ.canonicalSurface ?? "").split(/\s+/).at(-1);
          if (!head || cache.closed.has(head)) return false;
          const counts = posPrior?.forms?.[diaNorm(head)];
          if (!counts) return true;
          const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
          const nounShare = total ? ((counts.NOUN ?? 0) + (counts.PROPN ?? 0)) / total : 0;
          return nounShare > 0.5;
        });
        anchorEvidence = anchoring.observe(currentSentence, descriptorOccs, cache.referents).evidence;
        // The occurrences themselves are perceptions too — emitted so a
        // downstream organ (descriptorBeings) can count recurrence of the
        // ones anchoring could NOT bind, instead of re-deriving the stream.
        descriptorOccsEmitted = descriptorOccs;
      }

      priorSentences.push(currentSentence);
      priorText += `${priorText ? "\n" : ""}${encounter.material}`;

      if (edges.length === 0 && seenReferents.length === 0 && lexicalOccurrences.length === 0 && targetedOccurrences.length === 0 && anchorEvidence.length === 0 && descriptorOccsEmitted.length === 0) return [];
      return [{
        candidate: {
          distinctions: [
            ...seenReferents.map((ref) => ({ referent: ref.id, surfaces: ref.surfaces })),
            ...edges.map((edge) => ({ relation: edge.relation, participants: edge.participants })),
            ...lexicalOccurrences.map((occ) => ({ occurrence: occ.id, surfaceKey: occ.surfaceKey, upos: occ.upos })),
            ...targetedOccurrences.map((occ) => ({ occurrence: occ.id, surfaceKey: occ.surfaceKey, taskNominated: true })),
          ],
          hyperedges: edges,
          graphEntries: [...seenReferents, ...mentions, ...lexicalOccurrences, ...targetedOccurrences, ...gaps, ...anchorEvidence, ...descriptorOccsEmitted],
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

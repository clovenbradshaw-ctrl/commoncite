// native/eval/levers.mjs — the two measured ceilings' levers, driven on the
// whole real book and reported as DELTAS against same-assembly baselines.
//
// ASSEMBLY, NAMED (P0/S1): host cast (sessionReferents, coref-primed) +
// causal text perceiver (one full pass, collecting occurrences, anchor
// evidence, and edges) + BOTH pronoun arms + whole-book vocabulary
// discovery/extraction rerun in this driver. The vocabulary arms here are
// a driver-level second pass under the certified re-ground posture (S4),
// not a change to the perceiver — wiring the levers INTO the perceiver is
// its own pass, gated on the frankenstein conformance gate.
//
// Lever 1 (anchorSpans): pronoun positions the binding organ RESOLVED feed
// vocabulary discovery as positional anchors. Both discovery arms share
// surfaces, functionWords, minSurfaces (2 — the perceiver's own default),
// and posPrior, so the delta isolates the spans.
//
// Lever 2 (descriptorBeings): recurring never-anchored definite
// descriptors admitted as beings (minArrivals 4, citing the Born gate:
// floor(arrivals/2) >= 2 is what actually decides), then offered to the
// pronoun arms as candidates. The delta isolates the widened universe.
//
// Usage: node native/eval/levers.mjs <book.txt> --coref <prior.json>

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { narrationFrames } from "../adapters/text/attribution.js";
import { discoverRelationVocab, extractRelations } from "../adapters/text/relations.js";
import { descriptorBeings } from "../adapters/text/anchoring.js";
import { castSurfaceMap, bindNarrationFrames } from "../adapters/text/perspective-claims.js";
import { resolvePronounsByActivation, sameClause, findThirdPersonSingular } from "../adapters/text/pronouns.js";
import { createActivation } from "../kernel/activation.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../adapters/text/material.js";
import { actClosure } from "../adapters/text/morphology.js";
import { boundAnchorSpans, agencyEvidence } from "../adapters/text/vocabulary.js";
import { createLemmatizer, loadMorphology } from "../../legacy-eoreader6.1/packages/engine/perceiver/text/morphology.js";
import { createSession, admitChunked, sessionReferents } from "../../legacy-eoreader6.1/packages/host/corpus.js";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
const PRONOUN_RECALL = { minActivation: 0.05, minMargin: 0.2 };
const PRONOUN_PRESENT = { window: 8, minActivation: 0.2, minMargin: 0.2, createActivation };
const MIN_ARRIVALS = 4; // cited: entity.js admitFromArrivals needs floor(arrivals/2) >= 2 — the Born gate decides at 4, not a pre-filter
const MIN_SURFACES = 2; // the perceiver's own minRelationSurfaces default
const PRON_RE = /^(he|him|his|himself|she|her|hers|herself)$/i;

const arg = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };

async function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/levers.mjs <book.txt> --coref <prior.json>");
  const raw = fs.readFileSync(path, "utf8");
  const stripped = stripContainer(raw);
  const prior = arg("--coref") ? JSON.parse(fs.readFileSync(arg("--coref"), "utf8")) : null;
  const sourceId = `file:${path.split("/").pop()}`;

  // cast (host assembly, coref-primed)
  const session = createSession();
  admitChunked(session, { text: raw, sourceId, language: "en" });
  const cast = sessionReferents(session, { sourceId, priors: prior ? [prior] : [], limit: 200 });
  const surfaceToReferent = castSurfaceMap(cast.referents ?? []);

  // one perceiver pass: occurrences, anchor evidence, edges
  const encounters = textEncounters(stripped.text, { source: sourceId, offset: stripped.offset });
  const perceiver = createCausalTextPerceiver({ minRelationSurfaces: MIN_SURFACES, refreshEvery: 25, posPrior: POS_PRIOR, descriptorAnchoring: PRONOUN_RECALL });
  const occurrences = [];
  const anchoredSurfaces = new Set();
  for (const enc of encounters) {
    const out = (await perceiver.perceive(enc, {})) ?? [];
    for (const x of out) {
      for (const g of x.candidate?.graphEntries ?? []) {
        if (g?.schema === "EOReferentOccurrence@1") occurrences.push(g);
        if (g?.schema === "EOAnchorEvidence@1") anchoredSurfaces.add(String(g.descriptor ?? "").toLowerCase());
      }
    }
  }

  // ── lever 2: descriptor beings ────────────────────────────────────────
  // Being evidence = AGENCY (adapters/text/vocabulary.js — the S9
  // high->low direction; the co-occurrence dead end is recorded in
  // levers-RESULTS.md and in the subassembly's own tests).
  const surfacesOnlyVocab = discoverRelationVocab(stripped.text, { surfaces: [...surfaceToReferent.keys()], functionWords: null, minSurfaces: MIN_SURFACES, posPrior: POS_PRIOR }).verbs;
  const descriptorSet = new Set(occurrences.filter((o) => o.determination === "definite").map((o) => String(o.canonicalSurface ?? "").toLowerCase()).filter(Boolean));
  const beingEvidence = agencyEvidence(stripped.text, descriptorSet, surfacesOnlyVocab, { posForms: POS_PRIOR.forms });
  const admitted = descriptorBeings(occurrences, { minArrivals: MIN_ARRIVALS, anchoredSurfaces, beingEvidence });
  const widenedSurfaces = new Map(surfaceToReferent);
  for (const b of admitted.beings) widenedSurfaces.set(b.display, b.id);

  // pronoun arms, narrow vs widened universe
  const narration = narrationFrames(stripped.text, { framePrior: prior, offset: stripped.offset });
  const runArms = (surfs) => ({
    thematic: bindNarrationFrames({ frames: narration.frames, text: stripped.text, offset: stripped.offset, surfaceToReferent: surfs, recall: PRONOUN_RECALL }),
    present: bindNarrationFrames({ frames: narration.frames, text: stripped.text, offset: stripped.offset, surfaceToReferent: surfs, recall: PRONOUN_PRESENT, resolve: (a, b, c) => resolvePronounsByActivation(a, b, c) }),
  });
  const narrow = runArms(surfaceToReferent);
  const wide = runArms(widenedSurfaces);
  const toDescriptorBeings = (arm) => arm.boundSentences.filter((b) => String(b.referentId).startsWith("ref:desc:")).length;

  // ── lever 1: anchorSpans from bound pronouns ──────────────────────────
  const table = buildFrequencyTable(tokenize(stripped.text));
  const closed = (() => { const c = functionWordSet(table); return c.size * 2 < table.freq.size ? c : new Set(); })();
  const armBound = [...wide.thematic.boundSentences, ...wide.present.boundSentences]
    .map((b) => ({ ...b, start: b.start - stripped.offset, end: b.end - stripped.offset }));
  const boundSpans = boundAnchorSpans(armBound, stripped.text);
  const surfaces = [...widenedSurfaces.keys()];
  const shared = { surfaces, functionWords: closed, minSurfaces: MIN_SURFACES, posPrior: POS_PRIOR };
  const baseVocab = discoverRelationVocab(stripped.text, shared);
  const leverVocab = discoverRelationVocab(stripped.text, { ...shared, anchorSpans: boundSpans });
  const newVerbs = [...leverVocab.verbs].filter((v) => !baseVocab.verbs.has(v));

  const countEdges = (verbs) => {
    const edges = extractRelations(stripped.text, { verbs, functionWords: closed });
    let pronounEnds = 0;
    for (const e of edges) for (const t of [e.subject, e.object]) if (PRON_RE.test(String(t ?? "").trim())) pronounEnds += 1;
    return { edges: edges.length, pronounEnds };
  };
  const baseEdges = countEdges(baseVocab.verbs);
  const leverEdges = countEdges(leverVocab.verbs);

  // ── lever 3: the act closure (morphology) ─────────────────────────────
  // Every attested inflection of a measured act, decided by the engine's
  // own lemmatizer over the vendored UniMorph prior (giver in the file).
  const morphPrior = loadMorphology(new URL("../priors/morphology-eng.json", import.meta.url).pathname);
  const lemmatizer = createLemmatizer(morphPrior.forms, { language: morphPrior.language });
  const tokenTypes = [...new Set(tokenize(stripped.text))];
  const closure = actClosure(leverVocab.verbs, tokenTypes, lemmatizer);
  const closureEdges = countEdges(closure.forms);

  console.log(JSON.stringify({
    schema: "EOLeversRun@1",
    book: path.split("/").pop(),
    assembly: "host cast (coref-primed) + causal perceiver pass + both pronoun arms + whole-book vocabulary rerun in-driver (S4 re-ground posture; perceiver itself unchanged)",
    declared: { MIN_ARRIVALS: `${MIN_ARRIVALS} (Born gate: floor(arrivals/2)>=2 decides)`, MIN_SURFACES, PRONOUN_RECALL, PRONOUN_PRESENT: { window: PRONOUN_PRESENT.window, minActivation: PRONOUN_PRESENT.minActivation, minMargin: PRONOUN_PRESENT.minMargin } },
    lever2_descriptorBeings: {
      occurrencesSeen: occurrences.length,
      anchoredSurfacesExcluded: anchoredSurfaces.size,
      admitted: admitted.beings.map((b) => ({ id: b.id, display: b.display, arrivals: b.arrivals })),
      refusedSample: admitted.refused.filter((r) => r.reason === "descriptor_below_arrivals" && r.arrivals >= 2).slice(0, 8),
      pronounBindings: {
        thematic: { narrow: narrow.thematic.boundSentences.length, widened: wide.thematic.boundSentences.length, toDescriptorBeings: toDescriptorBeings(wide.thematic) },
        activation: { narrow: narrow.present.boundSentences.length, widened: wide.present.boundSentences.length, toDescriptorBeings: toDescriptorBeings(wide.present) },
      },
    },
    lever3_actClosure: {
      prior: { giver: morphPrior.giver, language: morphPrior.language, irregularForms: lemmatizer.size },
      measuredActs: leverVocab.verbs.size,
      formsAfterClosure: closure.forms.size,
      addedSample: closure.added.slice(0, 20),
      extraction: { beforeClosure: leverEdges, afterClosure: closureEdges },
    },
    lever1_anchorSpans: {
      boundPronounSpans: boundSpans.length,
      vocabulary: { baseline: baseVocab.verbs.size, withSpans: leverVocab.verbs.size, newVerbs: newVerbs.slice(0, 40) },
      extraction: { baseline: baseEdges, withSpans: leverEdges },
    },
  }, null, 1));
}

main().catch((err) => { console.error(err); process.exit(1); });

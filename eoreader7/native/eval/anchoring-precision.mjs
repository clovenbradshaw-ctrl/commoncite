// native/eval/anchoring-precision.mjs — score descriptor anchoring against
// the committed coreference golden (pg84-frankenstein.coref.json), as a
// NEGATIVE CONTROL.
//
// The golden's creature entry lists the descriptor surfaces that all
// predicate ONE being — "the creature", "the monster", "the wretch",
// "the fiend", "the dæmon", "the being", "the devil", "my creation" — and
// that being is UNNAMED: nested first-person narration means the creature
// never carries a capitalized proper-name surface, so he can never enter
// the cast that anchoring binds against. Therefore EVERY anchoring binding
// of a creature descriptor to a named referent is a FALSE binding, by the
// golden's own annotation — a precision instrument that needs no judgment
// call. (Scoped surfaces — "my enemy"/"my adversary", weight 0.7, valid
// only inside declared narrator spans — are excluded: applying them
// without resolving their spans would score the mechanism against a truth
// this driver did not actually compute.)
//
// What this measures: of every creature-descriptor OCCURRENCE the text
// carries, how many did anchoring (correctly) refuse or leave unoffered,
// and how many did it (wrongly) bind — and to whom. What this does NOT
// measure: precision on descriptors the golden does not cover ("my
// father", "the stranger", scene furniture) — those need their own
// annotation, and are reported as uncovered volume, never as "clean".
//
// Also disclosed: anchoring can only pair descriptor ↔ named cast. It can
// never say "the wretch" = "the monster" (descriptor ↔ descriptor
// identity), which is the golden's actual cluster. That absence is the
// mechanism's disclosed shape, not this driver's finding.
//
// Usage: node native/eval/anchoring-precision.mjs <pg84.txt>

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { reviseTextFold } from "../adapters/text/revision.js";
import { createRecursiveReader } from "../../kernel.js";

const ANCHORING = { minActivation: 0.05, minMargin: 0.2 };

// Corroboration floor for canonical projection: 2 — binding.js's own
// structural minimum ("one arrival has no co-arrival to test"), the same
// giver the-fold's P29 WITNESS_FLOOR already cites. Measured need: every
// surviving false identity belief on the coref golden stood on exactly
// one support. Declared here, threaded through reviseTextFold.
const CANONICALIZATION_FLOOR = 2;

const POS_PRIOR = JSON.parse(
  fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"),
);
const GOLDEN = JSON.parse(
  fs.readFileSync(new URL("../../legacy-eoreader6.1/scripts/adversarial/fixtures/pg84-frankenstein.coref.json", import.meta.url), "utf8"),
);

const norm = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const emptyRetrieve = (_fold, evidence) => Object.freeze({
  schema: "EORelevantFold@1", witnessed: Object.freeze([...evidence]), provisional: Object.freeze([]),
  expectations: Object.freeze([]), obligations: Object.freeze([]), exclusions: Object.freeze([]),
  unresolvedAlternatives: Object.freeze([]), activeFrames: Object.freeze([]), receivedPriors: Object.freeze([]),
});

async function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/anchoring-precision.mjs <pg84.txt>");
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  if (!stripped.looks_like_material) throw new Error("input does not look like readable material");
  const encounters = textEncounters(stripped.text, { source: "gutenberg:84", offset: stripped.offset });

  // The golden's unscoped creature descriptors — the negative-control class.
  const creatureEntry = GOLDEN.referents.find((r) => r.id === "creature");
  const creatureSurfaces = new Set(
    creatureEntry.surfaces.filter((s) => !s.scope).map((s) => norm(s.surface)),
  );

  // Occurrence volume in the text itself, for the denominator.
  const body = norm(stripped.text);
  const occurrenceCounts = {};
  for (const surface of creatureSurfaces) {
    occurrenceCounts[surface] = body.split(surface).length - 1;
  }

  const reader = createRecursiveReader({
    perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25, posPrior: POS_PRIOR, descriptorAnchoring: ANCHORING })],
    adapters: { revise: (args) => reviseTextFold({ ...args, canonicalizationFloor: CANONICALIZATION_FLOOR }), retrieve: emptyRetrieve },
  });
  for (const enc of encounters) await reader.step(enc);
  const fold = reader.getFold();

  const anchors = (fold.graphEntries ?? []).filter((x) => x?.schema === "EOAnchorEvidence@1");
  const creatureBindings = anchors.filter((a) => creatureSurfaces.has(norm(a.descriptor)));
  const uncovered = anchors.length - creatureBindings.length;

  const byDescriptor = {};
  for (const surface of creatureSurfaces) {
    const bound = creatureBindings.filter((a) => norm(a.descriptor) === surface);
    byDescriptor[surface] = {
      occurrencesInText: occurrenceCounts[surface],
      falseBindings: bound.length,
      boundTo: [...new Set(bound.map((a) => a.referentSurface))],
    };
  }

  // The evidence stream is not the belief: every binding above fed the
  // support/attack grammar, and a descriptor bound to DIFFERENT referents
  // over time attacks its own earlier alternatives. So the sharper
  // precision question is what the fold still BELIEVES at the end — how
  // many creature-descriptor alternatives survived as live_hypothesis
  // versus were driven to distinct by the mechanism's own self-correction.
  const creatureAlts = (fold.unresolvedAlternatives ?? []).filter(
    (a) => a?.schema === "EOIdentityAlternative@1" && (creatureSurfaces.has(a.left) || creatureSurfaces.has(a.right)),
  );
  const survivingFalse = creatureAlts.filter((a) => a.standing === "live_hypothesis");
  const selfCorrected = creatureAlts.filter((a) => a.standing === "distinct" || a.standing === "refused");

  // With a canonicalization floor, a live-but-single-witness alternative
  // is held OUT of the canonical projection — so the decisive belief
  // question is no longer "does a false alternative survive" but "does
  // any canonical edge actually CARRY a creature surface as an identity".
  const projectedFalse = (fold.graphEntries ?? []).filter(
    (x) => x?.schema === "EOCanonicalHyperedge@1" &&
      (x.participants ?? []).some((pt) => (pt.alternatives ?? []).some((alt) => creatureSurfaces.has(alt) && alt !== pt.value)),
  );

  const totalOccurrences = Object.values(occurrenceCounts).reduce((a, b) => a + b, 0);
  const out = {
    schema: "EOAnchoringPrecision@1",
    golden: "pg84-frankenstein.coref.json (creature entry, unscoped surfaces — a negative control: the creature is unnamed, so any binding is false)",
    declared: { anchoring: ANCHORING, canonicalizationFloor: CANONICALIZATION_FLOOR, posPrior: "bin/priors/pos/en-ud-ewt.json" },
    creatureClass: {
      surfaces: [...creatureSurfaces],
      occurrencesInText: totalOccurrences,
      falseBindings: creatureBindings.length,
      falseBindingRate: totalOccurrences ? creatureBindings.length / totalOccurrences : 0,
      byDescriptor,
      falseBindingDetail: creatureBindings.map((a) => ({
        descriptor: a.descriptor, boundTo: a.referentSurface, sentence: a.sentenceOrder, activation: a.activation, margin: a.margin,
      })),
    },
    uncoveredBindings: {
      count: uncovered,
      note: "bindings of descriptors the golden does not annotate — unmeasured, never reported as clean",
    },
    finalBelief: {
      note: "what the fold still believes at the end — the evidence stream above minus the mechanism's own self-correction (attacks driving alternatives to distinct)",
      creatureAlternativesTotal: creatureAlts.length,
      survivingFalse: survivingFalse.map((a) => ({ left: a.left, right: a.right, support: (a.supportRefs ?? []).length })),
      selfCorrected: selfCorrected.map((a) => ({ left: a.left, right: a.right })),
      projectedFalseCanonicals: projectedFalse.map((x) => ({ id: x.id, participants: x.participants })),
    },
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });

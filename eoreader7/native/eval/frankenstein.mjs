import fs from "fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { reviseTextFold } from "../adapters/text/revision.js";
import { createRecursiveReader } from "../../kernel.js";

const path = process.argv[2];
if (!path) throw new TypeError("usage: node native/eval/frankenstein.mjs <pg84.txt>");
const source = fs.readFileSync(path, "utf8");
const stripped = stripContainer(source);
if (!stripped.looks_like_material) throw new Error("Frankenstein input does not look like readable material");

const encounters = textEncounters(stripped.text, { source: "gutenberg:84", offset: stripped.offset });
const perceiver = createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25 });
const reader = createRecursiveReader({
  perceivers: [perceiver],
  adapters: {
    revise: reviseTextFold,
    retrieve: (_fold, evidence) => Object.freeze({
      schema: "EORelevantFold@1",
      witnessed: Object.freeze([...evidence]),
      provisional: Object.freeze([]),
      expectations: Object.freeze([]),
      obligations: Object.freeze([]),
      exclusions: Object.freeze([]),
      unresolvedAlternatives: Object.freeze([]),
      activeFrames: Object.freeze([]),
      receivedPriors: Object.freeze([]),
    }),
  },
});

const reading = await reader.read(encounters);
const entries = reading.fold.graphEntries ?? [];
const referents = entries.filter((entry) => entry?.schema === "EOReferent@1");
const discourseReferents = referents.filter((entry) => entry?.provenance?.giver === "text/discourse-referents::projectDiscourseReferents");
const namedReferents = referents.filter((entry) => !entry?.provenance?.giver?.startsWith("text/discourse-referents"));
const edges = entries.filter((entry) => entry?.schema === "EOHyperedge@1");
const descriptorOccurrences = entries.filter((entry) => entry?.schema === "EOReferentOccurrence@1");
const identityHypotheses = entries.filter((entry) => entry?.schema === "EOIdentityHypothesis@1");
const discourseLinks = entries.filter((entry) => entry?.schema === "EODiscourseIdentityLink@1");
const referentSurfaces = new Set(referents.flatMap((ref) => ref.surfaces ?? []).map((x) => String(x).toLowerCase()));
const hypothesisSurfaces = new Set(identityHypotheses.map((x) => String(x.surface ?? "").toLowerCase()));
const hasNamedSurface = (needle) => [...referentSurfaces].some((surface) => surface === needle.toLowerCase() || surface.includes(needle.toLowerCase()));
const hasHypothesis = (needle) => hypothesisSurfaces.has(needle.toLowerCase());
const surpriseTurns = reading.turns.filter((turn) => (turn.surprise?.operations?.length ?? 0) > 0);

const requiredCharacters = ["Frankenstein", "Elizabeth", "Clerval", "Walton"];
const targetDescriptors = ["the creature", "the monster", "the fiend", "the wretch", "my father", "the hut", "the chamber", "this place"];
const missingCharacters = requiredCharacters.filter((name) => !hasNamedSurface(name));
const descriptorTargets = targetDescriptors.map((surface) => ({ surface, hypothesisPresent: hasHypothesis(surface) }));
const wretchMonsterClusters = discourseReferents.filter((ref) => {
  const s = new Set((ref.surfaces ?? []).map((x) => String(x).toLowerCase()));
  return s.has("the wretch") && s.has("the monster");
});
const creaturePulledIntoWretchMonster = wretchMonsterClusters.some((ref) => (ref.surfaces ?? []).map((x) => String(x).toLowerCase()).includes("the creature"));
const wrapperPollution = [...referentSurfaces].filter((surface) => /project gutenberg|gutenberg ebook|www\.gutenberg/.test(surface));

const topDiscourseReferents = discourseReferents.slice(0, 30).map((ref) => ({
  id: ref.id,
  surfaces: ref.surfaces,
  occurrenceCount: ref.occurrenceRefs?.length ?? 0,
  supportCount: ref.supportRefs?.length ?? 0,
}));

const metrics = {
  schema: "EOFrankensteinDiscourseReferentEval@1",
  sourceCharacters: source.length,
  bodyCharacters: stripped.text.length,
  encounters: encounters.length,
  observations: reading.fold.witnessed?.length ?? 0,
  referents: referents.length,
  namedReferents: namedReferents.length,
  discourseReferents: discourseReferents.length,
  descriptorOccurrences: descriptorOccurrences.length,
  descriptorHypotheses: identityHypotheses.length,
  discourseLinks: discourseLinks.length,
  descriptorTargets,
  wretchMonsterClusters: wretchMonsterClusters.length,
  creaturePulledIntoWretchMonster,
  topDiscourseReferents,
  relations: edges.length,
  transformations: reading.fold.transformationObjects?.length ?? 0,
  surpriseTurns: surpriseTurns.length,
  missingCharacters,
  wrapperPollution,
  finalSequence: reading.fold.sequence,
  appendLogEntries: reading.log.length,
};
console.log(JSON.stringify(metrics, null, 2));

if (encounters.length < 1000) throw new Error(`too few encounters for Frankenstein: ${encounters.length}`);
if ((reading.fold.witnessed?.length ?? 0) < 100) throw new Error("native reading admitted too little witnessed structure");
if (namedReferents.length < 10) throw new Error(`too few named referents: ${namedReferents.length}`);
if (edges.length < 10) throw new Error(`too few witnessed relations: ${edges.length}`);
if (surpriseTurns.length < 10) throw new Error(`too few structurally revising turns: ${surpriseTurns.length}`);
if (missingCharacters.length) throw new Error(`major Frankenstein referents missing: ${missingCharacters.join(", ")}`);
if (wrapperPollution.length) throw new Error(`container text polluted cast: ${wrapperPollution.join(", ")}`);
if (targetDescriptors.some((surface) => !hasHypothesis(surface))) throw new Error("expected recurrent descriptor hypotheses are missing");
if (wretchMonsterClusters.length < 1) throw new Error("explicit wretch/monster apposition did not form a discourse referent");
if (creaturePulledIntoWretchMonster) throw new Error("surface-global collapse pulled a distinct creature occurrence into the wretch/monster cluster");
if (reading.log.length < encounters.length * 2) throw new Error("append-only reading log is unexpectedly sparse");

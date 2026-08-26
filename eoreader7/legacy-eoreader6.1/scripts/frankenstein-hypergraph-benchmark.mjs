import { readFile, writeFile } from "node:fs/promises";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";
import {
  createRecursiveReader, createCausalTextPerceiver, textEncounters,
  buildHypergraph, relevantHypergraphNeighborhood, deriveGraphStructuralDelta,
  deriveTension,
} from "../packages/engine/index.js";

const SOURCES = [
  "https://www.gutenberg.org/cache/epub/84/pg84.txt",
  "https://raw.githubusercontent.com/aibolem/Frankenstein_84/master/84.txt",
];
const posPrior = JSON.parse(await readFile(new URL("../bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
let source = null;
let raw = null;
const failures = [];
for (const url of SOURCES) {
  try {
    const response = await fetch(url);
    if (!response.ok) { failures.push(`${url} -> ${response.status}`); continue; }
    const candidate = await response.text();
    const probe = stripContainer(candidate);
    if (!probe.looks_like_material) { failures.push(`${url} -> response did not look like material`); continue; }
    source = url; raw = candidate; break;
  } catch (error) { failures.push(`${url} -> ${error?.message ?? error}`); }
}
if (!raw) throw new Error(`failed to fetch Frankenstein from all sources: ${failures.join("; ")}`);

const work = stripContainer(raw);
const encounters = textEncounters(work.text, { source: "gutenberg:84", offset: work.offset });
const reader = createRecursiveReader({
  perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25, posPrior })],
  taskOrientationBudget: 16,
  taskExecutionBudget: 3,
  adapters: {
    retrieve: () => ({}),
    interrogate: async () => [],
    revise: async ({ observations, fold, graph }) => deriveGraphStructuralDelta(fold, observations, {
      graph,
      id: `delta:graph:${(fold?.sequence ?? 0) + 1}`,
      minPatternInstances: 3,
      minMotifInstances: 2,
      maxMotifSequenceGap: 4,
      minUnresolvedRecurrence: 3,
    }),
  },
});

let maxSurprise = { sequencePosition: null, operations: 0, operators: [] };
let transformingTurns = 0;
const taskMetrics = {
  proposed: 0,
  awakened: 0,
  scheduled: 0,
  evidenceEvents: 0,
  evidenceRefs: 0,
  maxReopenedObjects: 0,
  maxDepth: 0,
  orientationPeak: 0,
  livePeak: 0,
  strategyCounts: new Map(),
  depthCounts: new Map(),
};

for (const item of encounters) {
  const turn = await reader.step(item);
  const operationCount = turn.surprise.operations.length;
  if (operationCount) transformingTurns += 1;
  if (operationCount > maxSurprise.operations) {
    maxSurprise = { sequencePosition: item.sequencePosition, operations: operationCount, operators: turn.surprise.operations.map((op) => op.operator) };
  }

  taskMetrics.proposed += turn.proposedTasks?.length ?? 0;
  taskMetrics.awakened += turn.awakenedTasks?.length ?? 0;
  taskMetrics.scheduled += turn.scheduledTasks?.length ?? 0;
  taskMetrics.evidenceEvents += turn.taskEvidence?.length ?? 0;
  taskMetrics.orientationPeak = Math.max(taskMetrics.orientationPeak, turn.orientation?.activeTasks?.length ?? 0);
  taskMetrics.livePeak = Math.max(taskMetrics.livePeak, turn.tasks?.length ?? 0);
  for (const evidence of turn.taskEvidence ?? []) {
    taskMetrics.evidenceRefs += evidence.evidence?.length ?? 0;
    taskMetrics.maxReopenedObjects = Math.max(taskMetrics.maxReopenedObjects, evidence.candidates?.length ?? 0);
    taskMetrics.maxDepth = Math.max(taskMetrics.maxDepth, evidence.depth ?? 0);
    const strategy = evidence.strategy ?? "unknown";
    taskMetrics.strategyCounts.set(strategy, (taskMetrics.strategyCounts.get(strategy) ?? 0) + 1);
    const depth = String(evidence.depth ?? 0);
    taskMetrics.depthCounts.set(depth, (taskMetrics.depthCounts.get(depth) ?? 0) + 1);
  }
}

const fold = reader.getFold();
const liveTasks = reader.getTasks();
const taskLog = reader.getTaskLog();
const graph = buildHypergraph(fold.graphEntries);
const referents = graph.entries.filter((entry) => entry.schema === "EOReferent@1");
const mentions = graph.entries.filter((entry) => entry.schema === "EOMention@1");
const lexicalOccurrences = graph.entries.filter((entry) => entry.schema === "EOLexicalOccurrence@1");
const taskTargetOccurrences = graph.entries.filter((entry) => entry.schema === "EOTaskTargetOccurrence@1");
const edges = graph.entries.filter((entry) => entry.schema === "EOHyperedge@1");
const gaps = graph.entries.filter((entry) => entry.schema === "EOReferentGap@1");
const patterns = graph.entries.filter((entry) => entry.schema === "EOPatternCandidate@1");
const motifs = graph.entries.filter((entry) => entry.schema === "EOMotifCandidate@1");
const tension = deriveTension(fold);

const relationIncidentCount = (id) => edges.filter((edge) => (edge.participants ?? []).some((p) => p.ref === id)).length;
const mentionCounts = new Map();
for (const mention of mentions) mentionCounts.set(mention.referent, (mentionCounts.get(mention.referent) ?? 0) + 1);
const referentRanking = referents
  .map((ref) => ({ id: ref.id, surfaces: ref.surfaces, mentions: mentionCounts.get(ref.id) ?? 0, semanticEdges: relationIncidentCount(ref.id) }))
  .sort((a, b) => b.mentions - a.mentions || b.semanticEdges - a.semanticEdges || a.id.localeCompare(b.id))
  .slice(0, 30);

const descriptorTerms = ["creature", "monster", "daemon", "demon", "wretch", "fiend"];
const descriptorKeys = descriptorTerms.map((term) => `surface:${term}`).filter((key) =>
  (graph.incident.get(key)?.size ?? 0) > 0 ||
  lexicalOccurrences.some((occ) => occ.surfaceKey === key) ||
  taskTargetOccurrences.some((occ) => occ.surfaceKey === key));
const descriptorOccurrences = [...lexicalOccurrences, ...taskTargetOccurrences]
  .filter((occ) => descriptorKeys.includes(occ.surfaceKey))
  .map((occ) => ({ occurrence: occ.id, schema: occ.schema, surfaceKey: occ.surfaceKey, encounterRef: occ.encounterRef, offset: occ.offset ?? null }));
const creatureNeighborhood = relevantHypergraphNeighborhood(graph, descriptorKeys, { maxHops: 3, maxEntries: 400 });
const creatureEdges = creatureNeighborhood.entries
  .filter((entry) => entry.schema === "EOHyperedge@1")
  .slice(0, 80)
  .map((edge) => ({ id: edge.id, relation: edge.relation, participants: edge.participants, scope: edge.scope, polarity: edge.meta?.polarity ?? null }));
const creatureMentions = creatureNeighborhood.entries
  .filter((entry) => entry.schema === "EOMention@1")
  .slice(0, 80)
  .map((mention) => ({ id: mention.id, referent: mention.referent, encounterRef: mention.encounterRef }));
const creatureTasks = liveTasks
  .filter((task) => (task.targets ?? []).some((target) => descriptorKeys.includes(target)))
  .map((task) => ({
    task_id: task.task_id,
    obligation_id: task.obligation_id,
    strategy: task.strategy,
    questions: task.questions,
    targets: task.targets,
    result: task.result ? { disposition: task.result.disposition, evidenceCount: task.result.evidence?.length ?? 0, depth: task.result.depth ?? null } : null,
  }));

const relationCounts = new Map();
for (const edge of edges) relationCounts.set(edge.relation, (relationCounts.get(edge.relation) ?? 0) + 1);
const topRelations = [...relationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([relation, count]) => ({ relation, count }));
const unresolvedI = edges.filter((edge) => (edge.participants ?? []).some((p) => p.surfaceKey === "surface:i")).length;
const participants = edges.flatMap((edge) => edge.participants ?? []);
const boundParticipants = participants.filter((p) => p.standing === "referent").length;
const unresolvedParticipants = participants.filter((p) => p.standing === "unresolved_surface").length;
const transformationCounts = new Map();
for (const op of fold.transformationObjects ?? []) transformationCounts.set(op.operator, (transformationCounts.get(op.operator) ?? 0) + 1);
const strongestPatterns = [...patterns].sort((a, b) => b.support - a.support).slice(0, 12)
  .map((pattern) => ({ id: pattern.id, relation: pattern.relation, support: pattern.support, structuralMapping: pattern.structuralMapping }));
const strongestMotifs = [...motifs].sort((a, b) => b.support - a.support).slice(0, 12)
  .map((motif) => ({ id: motif.id, relations: motif.relations, connection: motif.connection, support: motif.support }));
const strongestObligations = [...tension.obligations]
  .map((item) => ({ id: item.id, grounds: item.grounds?.length ?? 0, consequences: item.consequences?.length ?? 0, openedAt: item.openedAt }))
  .sort((a, b) => b.consequences - a.consequences || a.openedAt - b.openedAt)
  .slice(0, 12);

const report = {
  source, sourceFailures: failures,
  priors: [{ schema: posPrior.schema, giver: posPrior.provenance?.source }],
  sentences: encounters.length, observations: fold.witnessed.length, graphEntries: graph.entries.length,
  referents: referents.length, mentions: mentions.length, lexicalOccurrences: lexicalOccurrences.length,
  taskTargetOccurrences: taskTargetOccurrences.length,
  hyperedges: edges.length, referentGaps: gaps.length,
  participantBinding: { bound: boundParticipants, unresolved: unresolvedParticipants },
  unresolvedFirstPersonEdges: unresolvedI,
  transformations: Object.fromEntries(transformationCounts), transformingTurns, maxSurprise,
  obligations: tension.obligations.length, tensionInteractions: tension.interactionNetwork.length, strongestObligations,
  patterns: patterns.length, strongestPatterns,
  motifs: motifs.length, strongestMotifs,
  tasks: {
    proposed: taskMetrics.proposed,
    awakened: taskMetrics.awakened,
    scheduled: taskMetrics.scheduled,
    evidenceEvents: taskMetrics.evidenceEvents,
    evidenceRefs: taskMetrics.evidenceRefs,
    taskLogEntries: taskLog.entries.length,
    live: liveTasks.length,
    livePeak: taskMetrics.livePeak,
    orientationPeak: taskMetrics.orientationPeak,
    maxReopenedObjects: taskMetrics.maxReopenedObjects,
    maxDepth: taskMetrics.maxDepth,
    strategyCounts: Object.fromEntries(taskMetrics.strategyCounts),
    depthCounts: Object.fromEntries(taskMetrics.depthCounts),
  },
  topRelations, referentRanking,
  creature: {
    descriptorKeys, occurrenceCount: descriptorOccurrences.length, occurrences: descriptorOccurrences,
    taskConditionedOccurrenceCount: descriptorOccurrences.filter((o) => o.schema === "EOTaskTargetOccurrence@1").length,
    neighborhoodEntries: creatureNeighborhood.entries.length, neighborhoodTruncated: creatureNeighborhood.truncated,
    contextualSemanticEdges: creatureEdges, contextualNamedMentions: creatureMentions,
    activeClarificationTasks: creatureTasks,
    note: "descriptor occurrences remain occurrence-local; tasks can increase attention/retrieval without asserting descriptor coreference",
  },
};

const summary = {
  sentences: report.sentences, observations: report.observations, graphEntries: report.graphEntries,
  referents: report.referents, mentions: report.mentions, lexicalOccurrences: report.lexicalOccurrences,
  taskTargetOccurrences: report.taskTargetOccurrences,
  hyperedges: report.hyperedges, referentGaps: report.referentGaps, participantBinding: report.participantBinding,
  unresolvedFirstPersonEdges: report.unresolvedFirstPersonEdges, transformations: report.transformations,
  transformingTurns: report.transformingTurns, maxSurprise: report.maxSurprise,
  obligations: report.obligations, tensionInteractions: report.tensionInteractions,
  strongestObligations: report.strongestObligations.slice(0, 6),
  patterns: report.patterns, strongestPatterns: report.strongestPatterns.slice(0, 6),
  motifs: report.motifs, strongestMotifs: report.strongestMotifs.slice(0, 6),
  tasks: report.tasks,
  topRelations: report.topRelations.slice(0, 12), topReferents: report.referentRanking.slice(0, 12),
  creature: {
    descriptorKeys: report.creature.descriptorKeys, occurrenceCount: report.creature.occurrenceCount,
    taskConditionedOccurrenceCount: report.creature.taskConditionedOccurrenceCount,
    neighborhoodEntries: report.creature.neighborhoodEntries, neighborhoodTruncated: report.creature.neighborhoodTruncated,
    contextualSemanticEdgeCount: report.creature.contextualSemanticEdges.length,
    contextualNamedMentionCount: report.creature.contextualNamedMentions.length,
    activeClarificationTaskCount: report.creature.activeClarificationTasks.length,
  },
};
await writeFile("frankenstein-hypergraph-summary.json", JSON.stringify(summary, null, 2));
await writeFile("frankenstein-hypergraph-report.json", JSON.stringify(report, null, 2));
console.log("FRANKENSTEIN_HYPERGRAPH_SUMMARY", JSON.stringify(summary));
console.log("FRANKENSTEIN_HYPERGRAPH_REPORT_START");
console.log(JSON.stringify(report, null, 2));
console.log("FRANKENSTEIN_HYPERGRAPH_REPORT_END");

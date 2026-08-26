import { receivedGround, applyObservation, applyDelta, deltaFold } from "./fold.js";
import { deriveOrientation } from "./orientation.js";
import { perceive as defaultPerceive } from "./perception.js";
import { witness as defaultWitness } from "./witness.js";
import { relevantNeighborhood, interrogateCube, deriveEOTransformations } from "./interrogation.js";
import { deriveSurprise, deriveTension, deriveRelease } from "./dynamics.js";
import { buildHypergraph, indexHypergraphEntries } from "./hypergraph.js";
import { createReadingTaskState, proposeObligationTasks, wakeTasks, appendTaskResult, executeClarificationTask, scheduleTasks } from "./reading-tasks.js";
import { projectTasks } from "./task-log.js";

export function encounter(value) { return Object.freeze({ schema: "Encounter@1", ...value }); }

/** Constitutive perturbation: every nominated candidate passes through this stage before witness. */
export async function challengeCandidates(currentEncounter, orientation, candidates, { challengers = [] } = {}) {
  let frontier = [...candidates];
  const challenges = [];
  for (const challenger of challengers) {
    const result = await challenger.challenge?.({ encounter: currentEncounter, orientation, candidates: frontier });
    if (!result) continue;
    challenges.push(Object.freeze({ challenger: challenger.id ?? "anonymous", result }));
    if (Array.isArray(result.candidates)) frontier = result.candidates;
  }
  return Object.freeze({ schema: "EOChallengeFrontier@1", candidates: Object.freeze(frontier), challenges: Object.freeze(challenges) });
}

const observationGraph = (o) => [o, ...(o?.hyperedges ?? []), ...(o?.graphEntries ?? [])];
const deltaGraph = (delta, fold) => (delta?.operations ?? []).flatMap((op) => {
  const out = [op];
  if (op?.payload?.value?.id) out.push(op.payload.value);
  if (op?.payload?.action === "resolve-obligation" && op.payload.id) {
    const revised = (fold?.obligations ?? []).find((x) => x?.id === op.payload.id);
    if (revised) out.push(revised);
  }
  return out;
});

export function createRecursiveReader({ seed = {}, priors = [], perceivers = [], challengers = [], adapters = {}, taskLog = null, taskOrientationBudget = 24, taskExecutionBudget = 4 } = {}) {
  if (!Number.isInteger(taskOrientationBudget) || taskOrientationBudget < 0) throw new TypeError("taskOrientationBudget must be a non-negative integer");
  if (!Number.isInteger(taskExecutionBudget) || taskExecutionBudget < 0) throw new TypeError("taskExecutionBudget must be a non-negative integer");
  let fold = receivedGround(seed);
  let tasks = createReadingTaskState(taskLog);
  tasks = proposeObligationTasks(tasks, fold).log;
  const log = [];
  const graphIndex = buildHypergraph([...(fold.graphEntries ?? []), ...(fold.expectations ?? []), ...(fold.obligations ?? []), ...(fold.activeFrames ?? []), ...(fold.unresolvedAlternatives ?? []), ...(fold.transformationObjects ?? [])]);

  async function step(input) {
    const currentEncounter = input?.schema === "Encounter@1" ? input : encounter(input);
    const beforeFold = fold;
    const liveTasksBefore = projectTasks(tasks);
    const orientationTasks = scheduleTasks(liveTasksBefore, beforeFold, { limit: taskOrientationBudget });
    const orientation = deriveOrientation(beforeFold, { tasks: orientationTasks });
    const candidates = await (adapters.perceive ?? defaultPerceive)(currentEncounter, orientation, { perceivers, priors: [...(orientation.receivedPriors ?? []), ...priors] });
    const challenge = adapters.challenge ? await adapters.challenge({ encounter: currentEncounter, orientation, candidates }) : await challengeCandidates(currentEncounter, orientation, candidates, { challengers });
    const challengedCandidates = challenge?.candidates ?? candidates;
    const observations = await (adapters.witness ?? defaultWitness)(currentEncounter, challengedCandidates, { admit: adapters.admit });

    indexHypergraphEntries(graphIndex, observations.flatMap(observationGraph));
    const awakenedTasks = wakeTasks(orientationTasks, observations);
    const scheduledTasks = scheduleTasks(awakenedTasks, beforeFold, { limit: taskExecutionBudget });
    const taskEvidence = [];
    const executeTask = adapters.executeTask ?? executeClarificationTask;
    for (const task of scheduledTasks) {
      const result = await executeTask({ task, encounter: currentEncounter, observations, fold: beforeFold, orientation, graph: graphIndex });
      if (!result) continue;
      tasks = appendTaskResult(tasks, task, result);
      taskEvidence.push(Object.freeze({ schema: "TaskEvidence@1", id: `task-evidence:${task.task_id}:${currentEncounter.sequencePosition ?? log.length}`, taskId: task.task_id, obligationId: task.obligation_id ?? null, strategy: result.strategy ?? task.strategy ?? "clarify", questions: Object.freeze([...(result.questions ?? task.questions ?? [])]), disposition: result.disposition ?? "unresolved", evidence: Object.freeze([...(result.evidence ?? [])]), candidates: Object.freeze([...(result.candidates ?? [])]), depth: result.depth ?? null, detail: result.detail ?? null }));
    }

    indexHypergraphEntries(graphIndex, taskEvidence);
    const neighborhood = (adapters.retrieve ?? relevantNeighborhood)(beforeFold, [...observations, ...taskEvidence], { select: adapters.selectNeighborhood, graph: graphIndex });
    const interrogation = await (adapters.interrogate ?? interrogateCube)([...observations, ...taskEvidence], neighborhood, { ask: adapters.ask });
    const proposedDelta = adapters.revise ? await adapters.revise({ observations, taskEvidence, neighborhood, interrogation, fold: beforeFold, tasks: projectTasks(tasks), graph: graphIndex }) : deriveEOTransformations(interrogation, { id: `delta:${currentEncounter.sequencePosition ?? log.length}` });
    const canonicalDelta = proposedDelta?.schema === "DeltaFold@1" ? proposedDelta : deltaFold([]);

    log.push(currentEncounter, ...observations, ...taskEvidence, canonicalDelta);
    let nextFold = beforeFold;
    for (const observation of observations) nextFold = applyObservation(nextFold, observation);
    nextFold = applyDelta(nextFold, canonicalDelta);
    fold = nextFold;
    indexHypergraphEntries(graphIndex, deltaGraph(canonicalDelta, fold));
    const taskUpdate = proposeObligationTasks(tasks, fold); tasks = taskUpdate.log;

    return Object.freeze({ encounter: currentEncounter, orientation, candidates, challenge, observations, awakenedTasks, scheduledTasks, taskEvidence, proposedTasks: taskUpdate.proposed, tasks: Object.freeze(projectTasks(tasks)), relevantFold: neighborhood, interrogation, deltaFold: canonicalDelta, fold, surprise: deriveSurprise(canonicalDelta), tension: deriveTension(fold), release: deriveRelease(canonicalDelta, beforeFold, fold) });
  }

  async function read(encounters = []) { const turns = []; for (const item of encounters) turns.push(await step(item)); return Object.freeze({ turns, fold, tasks: Object.freeze(projectTasks(tasks)), taskLog: tasks, log: [...log] }); }
  return Object.freeze({ step, read, getFold: () => fold, getTasks: () => Object.freeze(projectTasks(tasks)), getTaskLog: () => tasks, getLog: () => [...log] });
}

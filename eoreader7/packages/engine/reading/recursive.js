import { receivedGround, applyObservation, applyDelta, deltaFold } from "../fold/index.js";
import { deriveOrientation } from "../orientation/index.js";
import { perceive as defaultPerceive } from "../perception/index.js";
import { witness as defaultWitness } from "../witness/index.js";
import { relevantNeighborhood, interrogateCube, deriveEOTransformations } from "../reasoning/fold-conditioned.js";
import { deriveSurprise, deriveTension, deriveRelease } from "../dynamics/index.js";
import { buildHypergraph, indexHypergraphEntries } from "../hypergraph/index.js";
import {
  createReadingTaskState, proposeObligationTasks, wakeTasks, appendTaskResult,
  executeClarificationTask, scheduleTasks,
} from "../tasks/reading.js";
import { projectTasks } from "../holon/task-log.js";

export function encounter(value) {
  return Object.freeze({ schema: "Encounter@1", ...value });
}

const graphObjectsFromObservation = (observation) => [
  observation,
  ...(observation?.hyperedges ?? []),
  ...(observation?.graphEntries ?? []),
];

const graphObjectsFromDelta = (delta, fold) => {
  const out = [];
  for (const operation of delta?.operations ?? []) {
    out.push(operation);
    if (operation?.payload?.value?.id) out.push(operation.payload.value);
    if (operation?.payload?.action === "resolve-obligation" && operation.payload.id) {
      const revised = (fold?.obligations ?? []).find((item) => item?.id === operation.payload.id);
      if (revised) out.push(revised);
    }
  }
  return out;
};

export function createRecursiveReader({
  seed = {}, priors = [], perceivers = [], adapters = {}, taskLog = null,
  taskOrientationBudget = 24, taskExecutionBudget = 4,
} = {}) {
  if (!Number.isInteger(taskOrientationBudget) || taskOrientationBudget < 0) throw new TypeError("taskOrientationBudget must be a non-negative integer");
  if (!Number.isInteger(taskExecutionBudget) || taskExecutionBudget < 0) throw new TypeError("taskExecutionBudget must be a non-negative integer");
  let fold = receivedGround(seed);
  let tasks = createReadingTaskState(taskLog);
  tasks = proposeObligationTasks(tasks, fold).log;
  const log = [];

  // Transient consequence index. It is reconstructible from Fold/log and is
  // deliberately not itself historical state. Reusing it makes each new
  // encounter pay for new structure rather than re-indexing the whole book.
  const graphIndex = buildHypergraph([
    ...(fold?.graphEntries ?? []),
    ...(fold?.expectations ?? []),
    ...(fold?.obligations ?? []),
    ...(fold?.activeFrames ?? []),
    ...(fold?.unresolvedAlternatives ?? []),
    ...(fold?.transformationObjects ?? []),
  ]);

  async function step(input) {
    const currentEncounter = input?.schema === "Encounter@1" ? input : encounter(input);
    const beforeFold = fold;
    const liveTasksBefore = projectTasks(tasks);
    const orientationTasks = scheduleTasks(liveTasksBefore, beforeFold, { limit: taskOrientationBudget });
    const orientation = deriveOrientation(beforeFold, { tasks: orientationTasks });

    const candidates = await (adapters.perceive ?? defaultPerceive)(currentEncounter, orientation, {
      perceivers,
      priors: [...(orientation.receivedPriors ?? []), ...priors],
    });
    const observations = await (adapters.witness ?? defaultWitness)(currentEncounter, candidates, {
      admit: adapters.admit,
    });

    // New witnessed structure becomes searchable once, before any task asks
    // whether it changes an existing consequential distinction.
    indexHypergraphEntries(graphIndex, observations.flatMap(graphObjectsFromObservation));

    const awakenedTasks = wakeTasks(orientationTasks, observations);
    const scheduledTasks = scheduleTasks(awakenedTasks, beforeFold, { limit: taskExecutionBudget });
    const taskEvidence = [];
    const executeTask = adapters.executeTask ?? executeClarificationTask;
    for (const task of scheduledTasks) {
      const result = await executeTask({
        task,
        encounter: currentEncounter,
        observations,
        fold: beforeFold,
        orientation,
        graph: graphIndex,
      });
      if (!result) continue;
      tasks = appendTaskResult(tasks, task, result);
      taskEvidence.push(Object.freeze({
        schema: "TaskEvidence@1",
        id: `task-evidence:${task.task_id}:${currentEncounter.sequencePosition ?? log.length}`,
        taskId: task.task_id,
        obligationId: task.obligation_id ?? null,
        strategy: result.strategy ?? task.strategy ?? "clarify",
        questions: Object.freeze([...(result.questions ?? task.questions ?? [])]),
        disposition: result.disposition ?? "unresolved",
        evidence: Object.freeze([...(result.evidence ?? [])]),
        candidates: Object.freeze([...(result.candidates ?? [])]),
        depth: result.depth ?? null,
        detail: result.detail ?? null,
      }));
    }

    indexHypergraphEntries(graphIndex, taskEvidence);
    const neighborhood = (adapters.retrieve ?? relevantNeighborhood)(beforeFold, [...observations, ...taskEvidence], {
      select: adapters.selectNeighborhood,
      graph: graphIndex,
    });
    const interrogation = await (adapters.interrogate ?? interrogateCube)([...observations, ...taskEvidence], neighborhood, {
      ask: adapters.ask,
    });
    const delta = adapters.revise
      ? await adapters.revise({
          observations,
          taskEvidence,
          neighborhood,
          interrogation,
          fold: beforeFold,
          tasks: projectTasks(tasks),
          graph: graphIndex,
        })
      : deriveEOTransformations(interrogation, { id: `delta:${currentEncounter.sequencePosition ?? log.length}` });
    const canonicalDelta = delta?.schema === "DeltaFold@1" ? delta : deltaFold([]);

    log.push(currentEncounter, ...observations, ...taskEvidence, canonicalDelta);
    let nextFold = beforeFold;
    for (const observation of observations) nextFold = applyObservation(nextFold, observation);
    nextFold = applyDelta(nextFold, canonicalDelta);
    fold = nextFold;
    indexHypergraphEntries(graphIndex, graphObjectsFromDelta(canonicalDelta, fold));

    const taskUpdate = proposeObligationTasks(tasks, fold);
    tasks = taskUpdate.log;
    const liveTasksAfter = projectTasks(tasks);

    return Object.freeze({
      encounter: currentEncounter,
      orientation,
      candidates,
      observations,
      awakenedTasks,
      scheduledTasks,
      taskEvidence,
      proposedTasks: taskUpdate.proposed,
      tasks: Object.freeze(liveTasksAfter),
      relevantFold: neighborhood,
      interrogation,
      deltaFold: canonicalDelta,
      fold,
      surprise: deriveSurprise(canonicalDelta),
      tension: deriveTension(fold),
      release: deriveRelease(canonicalDelta, beforeFold, fold),
    });
  }

  async function read(encounters = []) {
    const turns = [];
    for (const item of encounters) turns.push(await step(item));
    return Object.freeze({ turns, fold, tasks: Object.freeze(projectTasks(tasks)), taskLog: tasks, log: [...log] });
  }

  return Object.freeze({
    step,
    read,
    getFold: () => fold,
    getTasks: () => Object.freeze(projectTasks(tasks)),
    getTaskLog: () => tasks,
    getLog: () => [...log],
  });
}

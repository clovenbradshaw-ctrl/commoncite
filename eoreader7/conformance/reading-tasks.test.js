import test from "node:test";
import assert from "node:assert/strict";

import {
  receivedGround, obligation, openObligation, deltaFold, createRecursiveReader,
  createReadingTaskState, proposeObligationTasks, wakeTasks, scheduleTasks,
  createCausalTextPerceiver,
} from "../packages/engine/index.js";

const fixturePerceiver = {
  id: "fixture",
  perceive: (encounter) => ({
    candidate: { distinctions: encounter.distinctions ?? [{ ref: "ref:alice" }] },
    anchor: encounter.anchor,
    evidence: encounter.material,
  }),
};

const attributionConsequence = (edge = "edge:alice") => ({ kind: "relation_attribution", edge });

test("open Fold obligations propose append-only clarification tasks without asserting truth", () => {
  const fold = receivedGround({
    sequence: 4,
    obligations: [obligation({
      id: "obligation:identity:alice",
      distinction: "which identity does this surface denote?",
      grounds: ["ref:alice"],
      consequences: [attributionConsequence()],
    })],
  });
  const state = proposeObligationTasks(createReadingTaskState(), fold);
  assert.equal(state.proposed.length, 1);
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].operator, null);
  assert.equal(state.tasks[0].scope.futureAllowed, false);
  assert.equal(state.tasks[0].scope.retrospectiveAllowed, true);
  assert.equal(fold.witnessed.length, 0);
});

test("unresolved structure without a downstream consequence does not become a reading task", () => {
  const fold = receivedGround({
    obligations: [obligation({
      id: "obligation:identity:idle",
      distinction: "ambiguity exists but changes nothing downstream",
      grounds: ["ref:idle"],
      alternatives: ["ref:a", "ref:b"],
      consequences: [],
    })],
  });
  const state = proposeObligationTasks(createReadingTaskState(), fold);
  assert.deepEqual(state.proposed, []);
  assert.equal(state.tasks.length, 0);
});

test("a descriptive consequence kind without structural or EO address does not license attention", () => {
  const fold = receivedGround({
    obligations: [obligation({
      id: "obligation:identity:labeled-only",
      distinction: "a labeled ambiguity with no addressed effect",
      grounds: ["ref:labeled"],
      alternatives: ["ref:a", "ref:b"],
      consequences: [{ kind: "interesting_identity_question" }],
    })],
  });
  const state = proposeObligationTasks(createReadingTaskState(), fold);
  assert.deepEqual(state.proposed, []);
  assert.equal(state.tasks.length, 0);
});

test("task strategy and wake refs are derived from unresolved Fold structure", () => {
  const fold = receivedGround({
    obligations: [obligation({
      id: "obligation:unresolved:surface:creature",
      distinction: {
        surfaceKey: "surface:creature",
        occurrences: ["occ:1:0:subject", "occ:4:0:object"],
      },
      grounds: ["edge:text:1:0", "edge:text:4:0"],
      consequences: [{ kind: "relation_attribution", edge: "edge:text:4:0" }],
    })],
  });
  const state = proposeObligationTasks(createReadingTaskState(), fold);
  const task = state.tasks[0];
  assert.equal(task.strategy, "identity_clarification");
  assert.equal(task.targets.includes("surface:creature"), true);
  assert.equal(task.targets.includes("occ:1:0:subject"), true);
  assert.equal(task.questions.length >= 2, true);
});

test("bounded task scheduling prefers consequential persistent uncertainty", () => {
  const fold = receivedGround({
    sequence: 12,
    obligations: [
      obligation({ id: "obligation:identity:low", distinction: "low", openedAt: 11, grounds: ["ref:low"], consequences: [{ kind: "relation_attribution", edge: "edge:low" }] }),
      obligation({ id: "obligation:identity:high", distinction: "high", openedAt: 2, grounds: ["ref:high"], consequences: [{ kind: "a", ref: "ref:x" }, { kind: "b", ref: "ref:y" }] }),
    ],
  });
  const state = proposeObligationTasks(createReadingTaskState(), fold);
  const scheduled = scheduleTasks(state.tasks, fold, { limit: 1 });
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].obligation_id, "obligation:identity:high");
});

test("reading tasks wake by graph reference rather than lexical similarity", () => {
  const fold = receivedGround({
    obligations: [obligation({
      id: "obligation:identity:alice",
      distinction: "identity unresolved",
      grounds: ["ref:alice"],
      consequences: [attributionConsequence()],
    })],
  });
  const state = proposeObligationTasks(createReadingTaskState(), fold);
  const observations = [{
    schema: "Observation@1",
    id: "obs:next",
    distinctions: [{ ref: "ref:alice", surface: "completely different wording" }],
  }];
  const awake = wakeTasks(state.tasks, observations);
  assert.equal(awake.length, 1);
  assert.equal(awake[0].task_id, "task:obligation:obligation:identity:alice");
});

test("active task can nominate a targeted surface occurrence without asserting coreference", async () => {
  const organ = createCausalTextPerceiver();
  const output = await organ.perceive({
    modality: "text",
    material: "The creature stirred in the darkness.",
    anchor: { start: 0, end: 36 },
    sequencePosition: 0,
    source: "fixture",
  }, {
    activeTasks: [{ task_id: "task:x", targets: ["surface:creature"] }],
  });
  assert.equal(output.length, 1);
  const occurrence = output[0].candidate.graphEntries.find((entry) => entry.schema === "EOTaskTargetOccurrence@1");
  assert.equal(occurrence.surfaceKey, "surface:creature");
  assert.equal(occurrence.standing, "task_nominated_occurrence");
  assert.equal(output[0].nominationCause.includes("active_task"), true);
});

test("task results remain evidence and cannot mutate the Fold without EO interrogation", async () => {
  const seed = receivedGround({
    obligations: [obligation({
      id: "obligation:identity:alice",
      distinction: "identity unresolved",
      grounds: ["ref:alice"],
      consequences: [attributionConsequence()],
    })],
  });
  const reader = createRecursiveReader({
    seed,
    perceivers: [fixturePerceiver],
    adapters: {
      executeTask: () => ({
        disposition: "resolved",
        evidence: ["obs:claimed-resolution"],
        candidates: ["ref:alice"],
      }),
      ask: () => null,
    },
  });

  const turn = await reader.step({
    source: "fixture",
    modality: "text",
    anchor: 1,
    material: "Alice appeared.",
    distinctions: [{ ref: "ref:alice" }],
    sequencePosition: 0,
  });

  assert.equal(turn.awakenedTasks.length, 1);
  assert.equal(turn.taskEvidence.length, 1);
  assert.equal(turn.taskEvidence[0].disposition, "resolved");
  assert.equal(reader.getFold().obligations[0].status, "open");
  assert.equal(reader.getTasks().length, 1);
});

test("task evidence may change Fold only through an earned EO transformation", async () => {
  const seed = receivedGround({
    obligations: [obligation({
      id: "obligation:identity:alice",
      distinction: "identity unresolved",
      grounds: ["ref:alice"],
      consequences: [attributionConsequence()],
    })],
  });
  const reader = createRecursiveReader({
    seed,
    perceivers: [fixturePerceiver],
    adapters: {
      executeTask: () => ({
        disposition: "supported",
        evidence: ["obs:identity-witness"],
        candidates: ["ref:alice"],
      }),
      ask: ({ address, observations }) => {
        const taskEvidence = observations.find((o) => o.schema === "TaskEvidence@1");
        if (!taskEvidence || address.op !== "DEF" || address.grain !== "Figure") return null;
        return {
          changed: true,
          evidence: taskEvidence.id,
          effects: [{
            op: "DEF",
            grain: "Figure",
            witness: taskEvidence.id,
            payload: { action: "resolve-obligation", id: "obligation:identity:alice", status: "resolved" },
          }],
        };
      },
    },
  });

  const turn = await reader.step({
    source: "fixture",
    modality: "text",
    anchor: 1,
    material: "Alice appeared.",
    distinctions: [{ ref: "ref:alice" }],
    sequencePosition: 0,
  });

  assert.equal(turn.deltaFold.operations.some((op) => op.operator === "DEF"), true);
  assert.equal(reader.getFold().obligations[0].status, "resolved");
  assert.equal(reader.getTasks().length, 0);
});

test("tasks created after revision condition the next Orientation", async () => {
  const reader = createRecursiveReader({
    perceivers: [fixturePerceiver],
    adapters: {
      revise: ({ observations, fold }) => {
        if (fold.obligations.length) return deltaFold([]);
        const o = obligation({
          id: "obligation:identity:alice",
          distinction: "who is Alice here?",
          grounds: ["ref:alice"],
          consequences: [{ kind: "relation_attribution", edge: "edge:alice" }],
        });
        return deltaFold([openObligation(o, { witness: observations[0]?.id ?? "obs:1" })], { id: "delta:open" });
      },
    },
  });

  const first = await reader.step({ source: "x", modality: "text", anchor: 1, material: "Alice", sequencePosition: 0 });
  assert.equal(first.proposedTasks.length, 1);
  const second = await reader.step({ source: "x", modality: "text", anchor: 2, material: "Again", sequencePosition: 1 });
  assert.equal(second.orientation.activeTasks.length, 1);
  assert.equal(second.orientation.taskQuestions[0].targets.includes("ref:alice"), true);
});

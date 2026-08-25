import { test } from "node:test";
import assert from "node:assert/strict";
import { isGap } from "../nul/index.js";
import { createSession, activateMotif, decayMotifs, activeMotifs, pushTopic, popTopic, currentTopic, addSubTask, updateSubTask, addEvidence, commit, tick } from "../discourse/index.js";

test("discourse session starts empty", () => {
  const s = createSession();
  assert.deepEqual(s.motifs, []);
  assert.deepEqual(s.topicStack, []);
  assert.equal(s.tick, 0);
});

test("activating a motif creates or boosts it", () => {
  const s = createSession();
  activateMotif(s, "war", 0.8);
  assert.equal(s.motifs.length, 1);
  assert.equal(s.motifs[0].name, "war");
  assert.equal(s.motifs[0].weight, 0.8);

  activateMotif(s, "war", 0.3);
  assert.equal(s.motifs.length, 1);
  assert.equal(s.motifs[0].weight, 1); // clamped
});

test("decay reduces motif weights", () => {
  const s = createSession();
  activateMotif(s, "peace", 1);
  decayMotifs(s, 0.5);
  assert.equal(s.motifs[0].weight, 0.5);
  decayMotifs(s, 0.5);
  assert.equal(s.motifs[0].weight, 0.25);
});

test("motifs below threshold are pruned", () => {
  const s = createSession();
  activateMotif(s, "ephemeral", 0.02);
  decayMotifs(s, 0.5);
  assert.equal(activeMotifs(s).length, 0);
});

test("topic stack supports push and pop", () => {
  const s = createSession();
  pushTopic(s, "analysis");
  assert.equal(currentTopic(s).topic, "analysis");
  pushTopic(s, "synthesis");
  assert.equal(currentTopic(s).topic, "synthesis");
  const popped = popTopic(s);
  assert.equal(popped.topic, "synthesis");
  assert.equal(currentTopic(s).topic, "analysis");
});

test("adding subtasks to the current topic", () => {
  const s = createSession();
  pushTopic(s, "essay");
  const t = addSubTask(s, "research sources");
  assert.equal(t.status, "planned");
  assert.equal(currentTopic(s).subTasks.length, 1);
});

test("updating a subtask status", () => {
  const s = createSession();
  pushTopic(s, "essay");
  addSubTask(s, "research sources");
  updateSubTask(s, 0, { status: "executing" });
  assert.equal(currentTopic(s).subTasks[0].status, "executing");
});

test("adding evidence to a subtask", () => {
  const s = createSession();
  pushTopic(s, "essay");
  addSubTask(s, "research");
  addEvidence(s, 0, { text: "key passage", source: "text.txt" });
  assert.equal(currentTopic(s).subTasks[0].evidence.length, 1);
});

test("commitment tracking", () => {
  const s = createSession();
  commit(s, "find supporting quotes");
  assert.equal(s.commitments.length, 1);
  assert.equal(s.commitments[0].what, "find supporting quotes");
});

test("tick advances and triggers decay", () => {
  const s = createSession();
  activateMotif(s, "active", 1);
  tick(s);
  assert.equal(s.tick, 1);
  assert.ok(s.motifs[0].weight < 1);
});

test("gaps returned for invalid operations", () => {
  const s = createSession();
  assert.ok(isGap(popTopic(s))); // empty stack
  assert.ok(isGap(pushTopic(s, ""))); // empty topic
});

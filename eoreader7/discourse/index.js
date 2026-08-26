import { gap, isGap } from "../nul/index.js";

const DECAY = 0.5;
const MAX_MOTIFS = 25;
const MAX_STACK = 5;

export const createSession = () => ({
  motifs: [],
  topicStack: [],
  commitments: [],
  location: null,
  tick: 0,
});

export const activateMotif = (session, name, weight = 1) => {
  const existing = session.motifs.find((m) => m.name === name);
  if (existing) {
    existing.weight = Math.min(1, existing.weight + weight);
    return existing;
  }
  if (session.motifs.length >= MAX_MOTIFS) {
    session.motifs.sort((a, b) => a.weight - b.weight);
    session.motifs.shift();
  }
  const motif = { name, weight: Math.min(1, weight), tick: session.tick };
  session.motifs.push(motif);
  return motif;
};

export const decayMotifs = (session, rate = DECAY) => {
  for (const m of session.motifs) {
    m.weight *= rate;
  }
  session.motifs = session.motifs.filter((m) => m.weight > 0.01);
};

export const activeMotifs = (session, threshold = 0.1) =>
  session.motifs.filter((m) => m.weight >= threshold);

export const pushTopic = (session, topic) => {
  if (!topic) return gap("undeclared", { what: "topic" });
  if (session.topicStack.length >= MAX_STACK) return gap("no_ground", { reason: "topic stack full" });
  session.topicStack.push({ topic, tick: session.tick, subTasks: [] });
  activateMotif(session, topic);
  return topic;
};

export const popTopic = (session) => {
  if (session.topicStack.length === 0) return gap("no_ground", { reason: "topic stack empty" });
  return session.topicStack.pop();
};

export const currentTopic = (session) =>
  session.topicStack.length > 0 ? session.topicStack[session.topicStack.length - 1] : null;

export const addSubTask = (session, description) => {
  const topic = currentTopic(session);
  if (!topic) return gap("no_ground", { reason: "no active topic" });
  const task = { description, status: "planned", tick: session.tick, evidence: [] };
  topic.subTasks.push(task);
  return task;
};

export const updateSubTask = (session, index, updates) => {
  const topic = currentTopic(session);
  if (!topic) return gap("no_ground", { reason: "no active topic" });
  if (index < 0 || index >= topic.subTasks.length) return gap("no_ground", { reason: "subtask not found" });
  Object.assign(topic.subTasks[index], updates);
  return topic.subTasks[index];
};

export const addEvidence = (session, taskIndex, evidence) => {
  const topic = currentTopic(session);
  if (!topic) return gap("no_ground", { reason: "no active topic" });
  if (taskIndex < 0 || taskIndex >= topic.subTasks.length) return gap("no_ground", { reason: "subtask not found" });
  topic.subTasks[taskIndex].evidence.push({ ...evidence, tick: session.tick });
  return topic.subTasks[taskIndex];
};

export const commit = (session, what) => {
  session.commitments.push({ what, tick: session.tick });
  activateMotif(session, what);
  return what;
};

export const tick = (session) => {
  session.tick++;
  decayMotifs(session);
};

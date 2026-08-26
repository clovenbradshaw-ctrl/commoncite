import test from "node:test";
import assert from "node:assert/strict";
import { tokens, codeOf, recall, encodeFrame } from "../memory/activation.js";

const read = (frames) => {
  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 };
  const records = [];
  for (let order = 0; order < frames.length; order += 1) {
    const ws = tokens(frames[order]);
    const { trace, cue } = codeOf(ws, state);
    const activation = recall(cue, state, { completion: 0.5, topEdges: 6, selfOrder: order });
    records.push({
      trace: [...trace.entries()],
      cue: [...cue.entries()],
      activation: [...activation.entries()].sort((a, b) => a[0] - b[0]),
    });
    encodeFrame(state, order, ws, trace, { edgeSlots: 24 });
  }
  return records;
};

test("causal memory is prefix invariant", () => {
  const prefix = [
    "garden soil roses sunlight patient tending",
    "ordinary letters accounts errands afternoon",
    "garden soil roses rainfall patient tending",
    "ordinary harbor rope market errands afternoon",
    "garden soil roses sunlight patient tending",
  ];
  const future = [
    "a revelation with entirely different vocabulary arrives much later",
    "garden soil roses suddenly acquire a new interpretation",
  ];
  assert.deepEqual(read([...prefix, ...future]).slice(0, prefix.length), read(prefix));
});

test("recall happens before encode and never retrieves the frame itself", () => {
  const records = read([
    "workshop timber grain sanding careful plane",
    "workshop timber grain sanding careful plane",
    "workshop timber grain sanding careful plane",
  ]);
  for (let order = 0; order < records.length; order += 1) {
    assert.ok(records[order].activation.every(([prior]) => prior !== order));
  }
});

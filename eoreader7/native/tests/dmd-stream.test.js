// native/tests/dmd-stream.test.js — the streaming reader against the batch
// core it claims equivalence with, and against analytic ground truth.

import test from "node:test";
import assert from "node:assert/strict";
import { createStreamingDmd } from "../kernel/dmd-stream.js";
import { dmd, transpose } from "../kernel/dmd.js";

const rotation = (rho, theta) => [
  [rho * Math.cos(theta), -rho * Math.sin(theta)],
  [rho * Math.sin(theta), rho * Math.cos(theta)],
];
const trajectory = (A, x0, steps) => {
  const states = [x0];
  for (let t = 1; t < steps; t += 1) {
    const prev = states[t - 1];
    states.push(A.map((row) => row.reduce((acc, a, j) => acc + a * prev[j], 0)));
  }
  return states;
};

test("streaming modes equal batch DMD over the same prefix — the Hemati equivalence, pinned", () => {
  const states = trajectory(rotation(0.93, 0.35), [1, 0.2], 50);
  const stream = createStreamingDmd({ dims: 2 });
  for (const x of states) stream.push(x);
  const s = stream.modes({ rank: 2 });
  const batch = dmd(transpose(states.slice(0, -1)), transpose(states.slice(1)), { rank: 2 });
  assert.equal(s.eigenvalues.length, batch.eigenvalues.length);
  for (let i = 0; i < s.eigenvalues.length; i += 1) {
    assert.ok(Math.abs(s.eigenvalues[i].magnitude - batch.eigenvalues[i].magnitude) < 1e-8);
    assert.ok(Math.abs(Math.abs(s.eigenvalues[i].frequency) - Math.abs(batch.eigenvalues[i].frequency)) < 1e-8);
  }
});

test("causal: modes at snapshot t use only the prefix — later pushes change later answers, not earlier ones", () => {
  const states = trajectory(rotation(0.9, 0.5), [1, 0], 40);
  const stream = createStreamingDmd({ dims: 2 });
  for (const x of states.slice(0, 20)) stream.push(x);
  const early = stream.modes({ rank: 2 }).eigenvalues.map((l) => l.magnitude);
  const prefixBatch = dmd(transpose(states.slice(0, 19)), transpose(states.slice(1, 20)), { rank: 2 });
  assert.ok(Math.abs(early[0] - prefixBatch.eigenvalues[0].magnitude) < 1e-8,
    "the prefix answer is the prefix's own, not the future's");
  for (const x of states.slice(20)) stream.push(x);
  assert.ok(Math.abs(stream.modes({ rank: 2 }).eigenvalues[0].magnitude - 0.9) < 1e-6);
});

test("analytic recovery survives the stream: rho and theta to 1e-6", () => {
  const stream = createStreamingDmd({ dims: 2 });
  for (const x of trajectory(rotation(0.95, 0.4), [1, 0], 60)) stream.push(x);
  const out = stream.modes({ rank: 2 });
  for (const l of out.eigenvalues) {
    assert.ok(Math.abs(l.magnitude - 0.95) < 1e-6);
    assert.ok(Math.abs(Math.abs(l.frequency) - 0.4) < 1e-6);
  }
  assert.ok(out.eigenvalues[0].period > 0, "an oscillatory mode names its period");
});

test("declared dials refuse defaults; too little data is a typed gap, never a guess", () => {
  assert.throws(() => createStreamingDmd({}), /declared/);
  const s = createStreamingDmd({ dims: 2 });
  assert.throws(() => s.modes({}), /declared/);
  s.push([1, 0]);
  s.push([0.9, 0.1]);
  assert.equal(s.modes({ rank: 2 }).gap, "insufficient_pairs");
  assert.throws(() => s.push([1]), /declared 2 dims/);
});

test("a direction the data never excited is not inverted into", () => {
  // second observable identically zero: rank must come back 1, no NaNs
  const s = createStreamingDmd({ dims: 2 });
  let v = 1;
  for (let t = 0; t < 20; t += 1) { s.push([v, 0]); v *= 0.8; }
  const out = s.modes({ rank: 2 });
  assert.equal(out.rank, 1);
  assert.ok(Math.abs(out.eigenvalues[0].magnitude - 0.8) < 1e-6);
  assert.ok(out.eigenvalues.every((l) => Number.isFinite(l.magnitude)));
});

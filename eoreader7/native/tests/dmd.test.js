// native/tests/dmd.test.js — the decomposition against systems whose modes
// are known ANALYTICALLY, so correctness is proven rather than plausible.
//
// A damped rotation x_{t+1} = rho * R(theta) x_t has eigenvalues
// rho * e^(+/- i*theta) exactly. If DMD recovers rho as the magnitude and
// theta as the frequency, the complex half — the phase a frequency table
// cannot carry — is real and not an artifact.

import test from "node:test";
import assert from "node:assert/strict";
import { dmd, eigenvalues, economySVD, matmul, transpose } from "../kernel/dmd.js";

// deterministic throughout: no Math.random anywhere in this file
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

// states (as rows) -> snapshot pair (observables x snapshots)
const snapshots = (states) => {
  const X = transpose(states.slice(0, -1));
  const Xp = transpose(states.slice(1));
  return { X, Xp };
};

test("a damped rotation: DMD recovers rho as magnitude and theta as frequency", () => {
  const rho = 0.95;
  const theta = 0.4;
  const { X, Xp } = snapshots(trajectory(rotation(rho, theta), [1, 0], 60));
  const out = dmd(X, Xp, { rank: 2 });

  assert.equal(out.rank, 2);
  assert.equal(out.eigenvalues.length, 2);
  for (const lambda of out.eigenvalues) {
    assert.ok(Math.abs(lambda.magnitude - rho) < 1e-6, `magnitude ${lambda.magnitude} should be ${rho}`);
    assert.ok(Math.abs(Math.abs(lambda.frequency) - theta) < 1e-6, `|frequency| ${Math.abs(lambda.frequency)} should be ${theta}`);
  }
  // a genuine conjugate pair: equal and opposite imaginary parts
  const [a, b] = out.eigenvalues;
  assert.ok(Math.abs(a.im + b.im) < 1e-6, "the pair is conjugate");
  assert.ok(Math.abs(a.im) > 1e-6, "and genuinely complex — this is the phase a count cannot carry");
});

test("pure decay has zero frequency — no phase is invented where there is none", () => {
  const A = [[0.9, 0], [0, 0.5]];
  const { X, Xp } = snapshots(trajectory(A, [1, 1], 40));
  const out = dmd(X, Xp, { rank: 2 });
  const mags = out.eigenvalues.map((l) => l.magnitude).sort((x, y) => y - x);
  assert.ok(Math.abs(mags[0] - 0.9) < 1e-6);
  assert.ok(Math.abs(mags[1] - 0.5) < 1e-6);
  for (const l of out.eigenvalues) assert.ok(Math.abs(l.frequency) < 1e-9, "a real mode has no frequency");
});

test("growth and decay are signed correctly", () => {
  const grow = dmd(...Object.values(snapshots(trajectory([[1.1, 0], [0, 1]], [1, 1], 30))), { rank: 2 }).eigenvalues;
  assert.ok(grow.some((l) => l.growth > 0), "a growing mode has positive growth");
  const decay = dmd(...Object.values(snapshots(trajectory([[0.8, 0], [0, 1]], [1, 1], 30))), { rank: 2 }).eigenvalues;
  assert.ok(decay.some((l) => l.growth < 0), "a decaying mode has negative growth");
});

test("TWO modes coexist in one mixed signal and the decomposition separates them", () => {
  // the architecture under test: two lenses live at once, neither collapsed,
  // told apart by their eigenvalues rather than by a threshold.
  const rho1 = 0.99, theta1 = 0.2;
  const rho2 = 0.80, theta2 = 1.1;
  const A = [
    [...rotation(rho1, theta1)[0], 0, 0],
    [...rotation(rho1, theta1)[1], 0, 0],
    [0, 0, ...rotation(rho2, theta2)[0]],
    [0, 0, ...rotation(rho2, theta2)[1]],
  ];
  // observe through a fixed, deterministic mixing so no observable IS a mode
  const M = [
    [1, 0.5, 0.25, 0.125],
    [0.3, 1, 0.7, 0.2],
    [0.9, 0.1, 1, 0.4],
    [0.2, 0.8, 0.3, 1],
  ];
  const states = trajectory(A, [1, 0, 1, 0], 80).map((x) => M.map((r) => r.reduce((acc, m, j) => acc + m * x[j], 0)));
  const { X, Xp } = snapshots(states);
  const out = dmd(X, Xp, { rank: 4 });

  const found = out.eigenvalues.map((l) => ({ mag: l.magnitude, freq: Math.abs(l.frequency) }));
  const near = (mag, freq) => found.some((f) => Math.abs(f.mag - mag) < 1e-4 && Math.abs(f.freq - freq) < 1e-4);
  assert.ok(near(rho1, theta1), `slow mode ${rho1}@${theta1} not recovered from ${JSON.stringify(found)}`);
  assert.ok(near(rho2, theta2), `fast mode ${rho2}@${theta2} not recovered from ${JSON.stringify(found)}`);
});

test("rank is declared, never defaulted", () => {
  const { X, Xp } = snapshots(trajectory(rotation(0.9, 0.3), [1, 0], 20));
  assert.throws(() => dmd(X, Xp, {}), /declared/);
  assert.throws(() => dmd(X, Xp, { rank: 0 }), /declared/);
});

test("a rank-deficient trajectory reports the rank it actually found", () => {
  // a constant state has one direction and nothing to decompose beyond it
  const states = Array.from({ length: 12 }, () => [1, 2]);
  const { X, Xp } = snapshots(states);
  const out = dmd(X, Xp, { rank: 2 });
  assert.equal(out.rank, 1, "the truncation reports what was there, not what was asked for");
});

test("economySVD reconstructs its input", () => {
  const X = [[1, 2, 3], [4, 5, 6], [7, 8, 10]];
  const { U, s, V } = economySVD(X, { rank: 3 });
  const S = s.map((v, i) => s.map((_, j) => (i === j ? v : 0)));
  const back = matmul(matmul(U, S), transpose(V));
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) assert.ok(Math.abs(back[i][j] - X[i][j]) < 1e-8);
});

test("eigenvalues of a known real matrix", () => {
  const vals = eigenvalues([[2, 0], [0, 3]]).map((z) => z.re).sort((a, b) => a - b);
  assert.ok(Math.abs(vals[0] - 2) < 1e-8 && Math.abs(vals[1] - 3) < 1e-8);
});

// eoreader6 · surprise — two lanes, and the boundary where they must coincide.
//
// The invariant that earns its keep: at FULL COMMITMENT (posterior is a true
// point mass) Bayesian surprise reduces algebraically to Shannon surprisal of
// the realised outcome. Non-collapsible in general, provably identical there.
// Drift at that boundary is a normalisation bug, never a modelling choice —
// and it catches the exact class of bug that produced a clamp on a quantity
// that is non-negative by construction.

import { test } from "node:test";
import assert from "node:assert/strict";
import { bayesianSurprise, shannonSurprisal, priorContinuationNull } from "../packages/engine/emergence/surprise.js";

const priorOf = (pairs) => new Map(pairs);
const totalOf = (m) => [...m.values()].reduce((a, b) => a + b, 0);

test("boundary: at full commitment (gamma=0, single-form arrival) Bayesian surprise IS Shannon surprisal", () => {
  const prior = priorOf([["the", 50], ["creature", 3], ["wretch", 1], ["ship", 12]]);
  const priorTotal = totalOf(prior);

  for (const form of ["the", "creature", "wretch", "ship"]) {
    const arrival = new Map([[form, 1]]);
    const forms = new Set([...prior.keys(), ...arrival.keys()]);

    // alpha = 0: the posterior is a genuine delta, no smoothing spreading mass
    const kl = bayesianSurprise(prior, priorTotal, arrival, 1, { gamma: 0, alpha: 0 });
    const surprisal = shannonSurprisal(form, prior, priorTotal, forms, { alpha: 0 });

    assert.ok(Math.abs(kl - surprisal) < 1e-9,
      `${form}: KL=${kl} should equal -log2 P=${surprisal} at full commitment`);
  }
});

test("boundary: a rarer outcome commits to a larger identical value in both lanes", () => {
  const prior = priorOf([["the", 50], ["wretch", 1]]);
  const priorTotal = totalOf(prior);
  const common = bayesianSurprise(prior, priorTotal, new Map([["the", 1]]), 1, { gamma: 0, alpha: 0 });
  const rare = bayesianSurprise(prior, priorTotal, new Map([["wretch", 1]]), 1, { gamma: 0, alpha: 0 });
  assert.ok(rare > common, "committing to the rarer form must cost more");
});

test("the lanes are NOT the same measure away from that boundary", () => {
  // Same arrival, same prior, different gamma: surprisal cannot see gamma at
  // all (it is a property of the event under the prior), Bayesian surprise
  // must. If these ever move together the two lanes have been conflated.
  const prior = priorOf([["the", 50], ["creature", 3], ["ship", 12]]);
  const priorTotal = totalOf(prior);
  const arrival = new Map([["creature", 4], ["ship", 2]]);
  const arrivalTotal = totalOf(arrival);

  const committed = bayesianSurprise(prior, priorTotal, arrival, arrivalTotal, { gamma: 0, alpha: 1 });
  const retentive = bayesianSurprise(prior, priorTotal, arrival, arrivalTotal, { gamma: 0.9, alpha: 1 });

  assert.ok(committed > retentive,
    "keeping more of the prior must move belief less than discarding it");
});

test("Bayesian surprise is non-negative by construction — no clamp is legitimate", () => {
  const prior = priorOf([["a", 7], ["b", 3], ["c", 11], ["d", 1]]);
  const priorTotal = totalOf(prior);
  for (const gamma of [0, 0.3, 0.7, 1]) {
    for (const arrival of [
      new Map([["a", 5]]),
      new Map([["d", 2], ["b", 1]]),
      new Map([["zzz", 4]]),            // a form never read
      new Map([["a", 1], ["b", 1], ["c", 1], ["d", 1]]),
    ]) {
      const kl = bayesianSurprise(prior, priorTotal, arrival, totalOf(arrival), { gamma, alpha: 1 });
      assert.ok(kl >= -1e-12, `gamma=${gamma}: KL came out ${kl}, which means p_prior does not sum to 1`);
    }
  }
});

test("gamma is declared, never defaulted", () => {
  const prior = priorOf([["a", 3]]);
  assert.throws(() => bayesianSurprise(prior, 3, new Map([["a", 1]]), 1, {}), /gamma is declared/);
});

test("the prior-continuation null is generated from belief, and is not degenerate", () => {
  const prior = priorOf([["the", 50], ["creature", 3], ["wretch", 1], ["ship", 12], ["ice", 8]]);
  const priorTotal = totalOf(prior);

  const samples = priorContinuationNull(prior, priorTotal, 20, { gamma: 0.7, draws: 60, seed: 3 });
  assert.ok(samples && samples.length > 2, "the null must produce real samples");
  assert.ok(samples[samples.length - 1] > samples[0],
    "a null of zero width would clear anything put in front of it");
  assert.ok(samples.every((s) => s >= -1e-12), "null KLs are non-negative too");
});

test("draws is declared for the null, never defaulted", () => {
  const prior = priorOf([["a", 3], ["b", 2]]);
  assert.throws(() => priorContinuationNull(prior, 5, 4, { gamma: 0.7 }), /draws is declared/);
});

test("a continuation the prior expects is less surprising than one it does not", () => {
  const prior = priorOf([["the", 100], ["ship", 40], ["ice", 30]]);
  const priorTotal = totalOf(prior);
  const expected = new Map([["the", 10], ["ship", 4], ["ice", 3]]);      // in proportion
  const foreign = new Map([["wretch", 9], ["daemon", 8]]);               // never read
  const a = bayesianSurprise(prior, priorTotal, expected, totalOf(expected), { gamma: 0.7, alpha: 1 });
  const b = bayesianSurprise(prior, priorTotal, foreign, totalOf(foreign), { gamma: 0.7, alpha: 1 });
  assert.ok(b > a, "material the prior never anticipated must move belief further");
});

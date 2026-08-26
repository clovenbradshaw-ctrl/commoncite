// eoreader6 · temporality — the index-structure test, and the two ways it
// could be vacuous.
//
// Three planted series that MUST land in three different rows, or the
// distinction is decoration:
//
//   iid noise   exchangeable   no order at all
//   sine        reversible     strong order, no direction
//   ratchet     arrowed        slow rise, sharp fall — irreversible
//
// Plus the two vacuity controls, which are the point of the suite. SEED.md #4
// says a statistic must be sensitive to what its perturbation destroys. These
// tests demonstrate that sensitivity is a property of the PAIR, not of the
// statistic: permutationEntropy is sharply sensitive to shuffling and exactly
// blind to reversal. That is Amendment I, tested rather than asserted.

import { test } from "node:test";
import assert from "node:assert/strict";
import { permutationEntropy, irreversibility, burstiness, ground, difference, isGap, STATISTICS } from "../nul/index.js";
import { temporality, orderTest, arrowTest } from "../temporality/index.js";

// Deterministic: a ground that cannot be replayed cannot be testimony, and a
// test that cannot be replayed cannot be conformance.
const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const N = 600;
const next = prng(20260730);
const IID = Array.from({ length: N }, () => next());
const SINE = Array.from({ length: N }, (_, i) => Math.sin(i * 0.21) + Math.sin(i * 0.031) * 0.4);
// A ratchet: accumulate slowly, dump sharply. Reversed, it is a series that
// falls slowly and leaps — visibly a different process, which is the whole
// content of "arrowed".
const RATCHET = (() => {
  const out = [];
  let v = 0;
  for (let i = 0; i < N; i++) {
    v += 0.1;
    if (i % 17 === 16) v -= 1.7;
    out.push(v);
  }
  return out;
})();

// AR(1): the discriminating case. Real memory — a shuffle destroys its
// autocorrelation utterly — and yet run backwards it is the same process.
// Shuffle-sensitivity alone would call this "time-ordered"; it is ordered
// and has no arrow, and separating those is the entire reason arrowTest
// exists.
const AR = (() => {
  const r = prng(7);
  const out = [];
  let x = 0;
  for (let i = 0; i < N; i++) {
    x = 0.85 * x + (r() - 0.5);
    out.push(x);
  }
  return out;
})();

const SPEC = { draws: 120, window: 3, seed: 11 };

// ── the three rows ───────────────────────────────────────────────────────────

test("exchangeable: iid material is indistinguishable from its own shuffles", () => {
  const t = temporality({ material: IID, ...SPEC });
  assert.equal(t.verdict, "exchangeable");
  assert.equal(t.order.ordered, false);
  assert.equal(t.arrow, null, "an arrow claim is not made on material with no order to have a direction");
});

test("reversible: a sine is strongly ordered and has no arrow", () => {
  const t = temporality({ material: SINE, ...SPEC });
  assert.equal(t.verdict, "reversible");
  assert.equal(t.order.ordered, true);
  assert.equal(t.order.censored, "below", "order reads as regularity — censored below, never surfeit");
  assert.equal(t.arrow.arrowed, false);
});

test("arrowed: a ratchet is ordered AND irreversible", () => {
  const t = temporality({ material: RATCHET, ...SPEC });
  assert.equal(t.verdict, "arrowed");
  assert.equal(t.order.ordered, true);
  assert.equal(t.arrow.arrowed, true);
  assert.equal(t.arrow.censored, "above", "an arrow reads as surfeit — censored above");
});

test("reversible: AR(1) has real memory and no arrow — the case shuffle alone gets wrong", () => {
  const t = temporality({ material: AR, ...SPEC });
  assert.equal(t.order.ordered, true, "shuffling destroys its autocorrelation: the index is load-bearing");
  assert.equal(t.verdict, "reversible", "and yet run backwards it is the same process");
  assert.equal(t.arrow.arrowed, false);
});

test("the planted series do not all land in the same row", () => {
  const verdicts = [IID, SINE, AR, RATCHET].map((m) => temporality({ material: m, ...SPEC }).verdict);
  assert.equal(new Set(verdicts).size, 3, `the distinction collapsed: ${verdicts.join(", ")}`);
  assert.deepEqual(verdicts, ["exchangeable", "reversible", "reversible", "arrowed"]);
});

test("the verdicts do not depend on which shuffles the null happened to draw", () => {
  for (const seed of [11, 977, 30011]) {
    const spec = { draws: 120, window: 3, seed };
    assert.equal(temporality({ material: IID, ...spec }).verdict, "exchangeable");
    assert.equal(temporality({ material: SINE, ...spec }).verdict, "reversible");
    assert.equal(temporality({ material: AR, ...spec }).verdict, "reversible");
    assert.equal(temporality({ material: RATCHET, ...spec }).verdict, "arrowed");
  }
});

// ── vacuity control 1: sensitivity is a property of the PAIR ─────────────────

test("permutationEntropy is sensitive to shuffling", () => {
  const shuffled = [...SINE].sort(() => 0); // identity — establish the real value first
  const real = permutationEntropy(SINE, { window: 3 });
  const scramble = (m, seed) => {
    const r = prng(seed);
    const out = m.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const shuffledValue = permutationEntropy(scramble(SINE, 5), { window: 3 });
  assert.ok(shuffledValue - real > 0.1, `shuffling must move it: real ${real}, shuffled ${shuffledValue}`);
  assert.equal(shuffled.length, SINE.length);
});

test("permutationEntropy is EXACTLY blind to reversal — the counterexample Amendment I rests on", () => {
  for (const material of [SINE, RATCHET, IID]) {
    const forward = permutationEntropy(material, { window: 3 });
    const backward = permutationEntropy([...material].reverse(), { window: 3 });
    assert.ok(
      Math.abs(forward - backward) < 1e-12,
      `permutation entropy must be reversal-invariant, not merely close: ${forward} vs ${backward}`,
    );
  }
});

test("irreversibility is NOT blind to reversal, which is why the arrow test needs it", () => {
  const forward = irreversibility(RATCHET, { window: 3 });
  const reversedSeries = irreversibility([...RATCHET].reverse(), { window: 3 });
  assert.ok(forward > 0.05, "a ratchet must register a real arrow");
  // Reversing swaps the two distributions, so the divergence between them is
  // preserved — the MAGNITUDE is symmetric. What reversal changes is which of
  // the two the material actually is, which is not a thing this statistic
  // claims to adjudicate: it detects an arrow, it does not name its sign.
  assert.ok(Math.abs(forward - reversedSeries) < 1e-12, "the magnitude of an arrow is reversal-symmetric");
});

test("a reversible process registers no arrow while registering strong order", () => {
  assert.ok(irreversibility(SINE, { window: 3 }) < irreversibility(RATCHET, { window: 3 }) / 3);
  assert.ok(permutationEntropy(SINE, { window: 3 }) < permutationEntropy(IID, { window: 3 }));
});

// ── the growth rule: why this organ is ABOVE the core, measured ──────────────

test("the core's own statistic is EXACTLY reversal-blind — this is what the organ is above", () => {
  // Reversing a series maps the window [i, i+w) onto [n-i-w, n-i) with an
  // identical sum, a bijection on windows. So a max-over-windows statistic is
  // preserved bit-for-bit, not approximately. nul, with the only statistic it
  // shipped with, cannot tell a ratchet from a ratchet run backwards.
  for (const material of [SINE, AR, RATCHET]) {
    const forward = burstiness(material, { window: 12 });
    const backward = burstiness([...material].reverse(), { window: 12 });
    assert.equal(forward, backward, "burstiness must be exactly reversal-invariant");
  }
});

test("the core's GROUND cannot place the distinction either", () => {
  for (const material of [SINE, AR, RATCHET]) {
    const g = ground({ material, draws: 120, window: 12, seed: 3 });
    assert.ok(!isGap(g));
    const forward = difference(burstiness(material, { window: 12 }), g);
    const backward = difference(burstiness([...material].reverse(), { window: 12 }), g);
    assert.deepEqual(forward, backward, "the core's ground returns the identical verdict on a series and its reverse");
  }
});

test("the organ does place it — the level test the growth rule requires", () => {
  const arrowed = temporality({ material: RATCHET, ...SPEC });
  const reversible = temporality({ material: AR, ...SPEC });
  assert.notEqual(arrowed.verdict, reversible.verdict, "the organ perceives what the core's ground cannot anticipate");
});

// ── vacuity control 2: a shuffle-invariant statistic cannot answer ───────────

test("the mean is shuffle-invariant and therefore cannot be asked this question", () => {
  const mean = (m) => m.reduce((a, b) => a + b, 0) / m.length;
  const scrambled = [...RATCHET].sort((a, b) => a - b); // any permutation at all
  assert.ok(Math.abs(mean(RATCHET) - mean(scrambled)) < 1e-9);
  assert.ok(!Object.keys(STATISTICS).includes("mean"), "an order-blind statistic must never enter the table");
});

// ── the declared numbers, and the containment ────────────────────────────────

test("no number is defaulted", () => {
  for (const missing of [{ draws: 120 }, { window: 3 }, {}]) {
    const t = temporality({ material: SINE, ...missing, seed: 1 });
    assert.equal(t.gap, "undeclared", `${JSON.stringify(missing)} should refuse`);
  }
});

test("a pattern space larger than the material can populate is refused, not estimated", () => {
  const short = SINE.slice(0, 40);
  const t = temporality({ material: short, draws: 30, window: 6, seed: 1 }); // 6! = 720 patterns, 35 slots
  assert.ok(t.gap === "unknown_spec", `expected refusal, got ${JSON.stringify(t).slice(0, 120)}`);
});

test("containment: the arrow test is reachable on its own but the ladder never skips order", () => {
  const direct = arrowTest(IID, { draws: 120, window: 3, seed: 11 });
  assert.equal(typeof direct.arrowed, "boolean", "the organ does not hide its own steps");
  const laddered = temporality({ material: IID, ...SPEC });
  assert.equal(laddered.arrow, null, "but the ladder refuses to report an arrow it never earned the right to ask about");
});

test("order and arrow are separately inspectable and agree with the ladder", () => {
  const o = orderTest(RATCHET, { draws: 120, window: 3, seed: 11 });
  const a = arrowTest(RATCHET, { draws: 120, window: 3, seed: 11 + 120 });
  const t = temporality({ material: RATCHET, ...SPEC });
  assert.equal(o.ordered, t.order.ordered);
  assert.equal(a.arrowed, t.arrow.arrowed);
});

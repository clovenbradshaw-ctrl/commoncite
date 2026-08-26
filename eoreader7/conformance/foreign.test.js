// eoreader6 · foreign — what no standpoint in the material can reach.
//
// The ladder `generation/belief.js` already climbs over forms, climbed here
// over positions: beyond from ONE here is that here's encounter; beyond from
// EVERY here is not this material's at all.
//
// The planted material is a work with a foreign block spliced at each end —
// the shape a distributor's wrapper has, without being one. What must hold is
// that the blocks are found WITHOUT any marker, by reach alone, and that the
// body is never foreign.
//
// The mechanism is `burstiness`/`shuffle`, which is licensed: shuffling breaks
// a contiguous block apart, so a real run of elevated values exceeds the
// max-over-windows statistic of its own shuffles. A block that is foreign in
// content but scattered through the material is NOT detectable this way, and
// the last test says so rather than leaving it implied.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fold, foreign, alternatives } from "../packages/engine/emergence/fold.js";
import { isGap } from "../nul/index.js";

const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const N = 900;
const WINDOW = 8;
const DRAWS = 200;
const HEAD = 12; // foreign block at the front
const TAIL = 12; // and at the back

const next = prng(20260731);
// The work: ordinary variation. The wrapper: a contiguous run well above it.
const WORK = Array.from({ length: N }, () => 1 + next() * 0.4);
const WRAPPED = (() => {
  const out = WORK.slice();
  for (let i = 0; i < HEAD; i++) out[i] = 5 + next() * 0.4;
  for (let i = N - TAIL; i < N; i++) out[i] = 5 + next() * 0.4;
  return out;
})();

const foldsAt = (material, heres) =>
  heres.map((here) => fold({ material, here, window: WINDOW, draws: DRAWS, seed: 0 })).filter((f) => !isGap(f));

const HERES = [200, 330, 460, 590, 720];

test("the wrapper is found by reach alone — no marker consulted", () => {
  const folds = foldsAt(WRAPPED, HERES);
  assert.ok(folds.length >= 3, `need plural standpoints, got ${folds.length}`);

  const r = foreign(folds);
  assert.ok(!isGap(r));
  assert.equal(r.standpoints, folds.length);

  const foreignAt = r.byPosition.filter((p) => p.verdict === "foreign").map((p) => p.at);
  assert.ok(foreignAt.length > 0, "the spliced blocks must be unreachable from every standpoint");

  // Every foreign position lies inside one of the two spliced blocks. A window
  // starting at `at` covers [at, at+WINDOW), so a window overlapping the head
  // block starts below HEAD, and one overlapping the tail starts above N-TAIL-WINDOW.
  for (const at of foreignAt) {
    const inHead = at < HEAD;
    const inTail = at > N - TAIL - WINDOW;
    assert.ok(inHead || inTail, `position ${at} was called foreign but lies in the body`);
  }

  // And the body is never foreign.
  const bodyForeign = r.byPosition.filter((p) => p.verdict === "foreign" && p.at > HEAD + WINDOW && p.at < N - TAIL - WINDOW * 2);
  assert.equal(bodyForeign.length, 0, "no position in the work may be foreign to the work");
});

test("unwrapped material has nothing foreign — the control", () => {
  const folds = foldsAt(WORK, HERES);
  assert.ok(folds.length >= 3);
  const r = foreign(folds);
  assert.ok(!isGap(r));
  // A null of zero width would call everything foreign; one that can never fire
  // is the same failure from the other side. This is the second.
  assert.equal(r.foreign, 0, `uniform material has no unreachable region, got ${r.foreign}`);
});

test("unanimity is monotone: adding a standpoint can only remove a foreign verdict", () => {
  const few = foreign(foldsAt(WRAPPED, HERES.slice(0, 3)));
  const many = foreign(foldsAt(WRAPPED, HERES));
  assert.ok(!isGap(few) && !isGap(many));

  const setOf = (r) => new Set(r.byPosition.filter((p) => p.verdict === "foreign").map((p) => p.at));
  const a = setOf(few);
  const b = setOf(many);
  // This is why no extreme-value correction is owed: a conjunction cannot
  // manufacture a verdict by adding evidence, unlike a best-of-n maximum.
  for (const at of b) assert.ok(a.has(at), `position ${at} became foreign only after adding standpoints`);
});

test("edge is counted apart from foreign, and the three verdicts partition", () => {
  const r = foreign(foldsAt(WRAPPED, HERES));
  assert.equal(r.foreign + r.edge + r.reachable, r.n, "every position gets exactly one verdict");
  for (const p of r.byPosition) {
    assert.ok(p.beyondFrom >= 0 && p.beyondFrom <= p.of);
    if (p.verdict === "foreign") assert.equal(p.beyondFrom, p.of);
    if (p.verdict === "reachable") assert.equal(p.beyondFrom, 0);
    if (p.verdict === "edge") assert.ok(p.beyondFrom > 0 && p.beyondFrom < p.of);
  }
});

test("refuses one standpoint, and refuses folds across specs", () => {
  const one = foreign(foldsAt(WRAPPED, [200]));
  assert.ok(isGap(one) && one.gap === "no_ground");

  const a = fold({ material: WRAPPED, here: 200, window: WINDOW, draws: DRAWS, seed: 0 });
  const b = fold({ material: WRAPPED, here: 400, window: WINDOW, draws: DRAWS + 50, seed: 0 });
  const mixed = foreign([a, b]);
  assert.ok(isGap(mixed) && mixed.gap === "unknown_spec", "reach across different specs was never comparable");
});

test("stated limit: a scattered foreign block is NOT found this way", () => {
  // The same foreign values, dispersed instead of contiguous. burstiness/shuffle
  // is sensitive to contiguity, so dispersal is exactly what it cannot see —
  // and a limit stated is worth more than a limit discovered later.
  const scattered = WORK.slice();
  const step = Math.floor(N / (HEAD + TAIL));
  for (let i = 0; i < HEAD + TAIL; i++) scattered[i * step] = 5;

  const r = foreign(foldsAt(scattered, HERES));
  assert.ok(!isGap(r));
  assert.ok(
    r.foreign < HEAD + TAIL,
    `dispersed foreign values should NOT be fully recovered by a contiguity-sensitive statistic, got ${r.foreign}`,
  );
});

test("foreign and alternatives answer different questions over the same folds", () => {
  const folds = foldsAt(WRAPPED, HERES);
  const r = foreign(folds);
  const alt = alternatives(folds);
  assert.ok(!isGap(r) && !isGap(alt));
  assert.equal(r.n, alt.n, "both are per-position over one projection length");
  // relation (past/contemporary/horizon) and placement (placed/beyond/beneath)
  // are independent axes; nothing here may conflate them.
  assert.ok("free" in alt.byPosition[0]);
  assert.ok("verdict" in r.byPosition[0]);
});

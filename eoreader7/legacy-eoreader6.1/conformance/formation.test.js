// eoreader6 · formation — the becoming of a thing, in phases.
//
// The suite plants the three rows and the two refusals that hold them apart:
//
//   a burst peak, read against its own settled past   CENSORED ABOVE  surfeit,
//                                                     and the seed's named
//                                                     trigger to re-zero
//   a burst, collapsed against a received ground      PROTOGON → HOLON  the
//                                                     origin is received, then
//                                                     the level test earns it
//   an ordinary regime                                PROTOGON → PROTOGON  peer
//                                                     means it waits
//   two gates in disagreement                          UNSTABLE — a typed gap,
//                                                     a result and not an error
//
// Plus the type discipline (SEED.md #7): a diffuse thing cannot be asked
// where it is, a cut cannot be cut again, and a holon cannot be re-sustained.

import { test } from "node:test";
import assert from "node:assert/strict";
import { received, ground, reZero, burstiness, isGap } from "../nul/index.js";
import { emanon, collapse, sustain, PHASES } from "../formation/index.js";

const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const D = 256;
const W = 5;
const quiet = [1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 2];
const bursty = [...quiet.slice(0, 10), 9, 9, 9, 9, 9, ...quiet.slice(5)];
// `quiet` tiled out past `collapse`'s own MINIMUM VIABLE GROUND floor
// (10 * W = 50, see formation/index.js's `collapse`) — same 20-element
// pattern, just repeated far enough that a settled prefix built from it can
// clear the floor.
const repeatQuiet = (n) => Array.from({ length: n }, (_, i) => quiet[i % quiet.length]);

// A settled prefix of 50 (10 * W, the shipped floor) followed by the same
// burst, for the tests below that DERIVE a ground rather than receive one:
// the material behind wherever the regime starts must be genuinely quiet, or
// the ground itself would be built over the burst it is meant to catch.
const burstyDerived = [...repeatQuiet(50), 9, 9, 9, 9, 9, ...repeatQuiet(10)];
// Same idea for the below-censoring case: a settled prefix of 50 (past the
// floor) whose ground has no width below 1, and a later window (a repeat of
// quiet's own opening five) whose mean genuinely sits under that — measured,
// not assumed (see the "the floor is regularity" test below).
const quietLong = [...repeatQuiet(50), ...quiet.slice(0, 5)];

// Received grounds — gifts that name their giver. The burst's spans 3..9 and
// places the peak; the plain's spans 0.2..2.2 and places an ordinary value.
const recBurst = received({
  samples: Array.from({ length: 64 }, (_, i) => 3 + (6 * i) / 63),
  provenance: { giver: "the-text" },
});
const recPlain = received({
  samples: Array.from({ length: 64 }, (_, i) => 0.2 + (2 * i) / 63),
  provenance: { giver: "the-text" },
});

// ── the phases ───────────────────────────────────────────────────────────────

test("emanon is diffuse — no boundary, no figure, no where", () => {
  const e = emanon({ material: bursty, window: W, draws: D });
  assert.equal(e.phase, "emanon");
  assert.equal(e.figure, null);
  assert.equal(e.boundary, null);
  assert.deepEqual([...e.material], bursty);
  assert.deepEqual({ ...e.spec }, { window: W, draws: D, perturbation: "shuffle" });
  assert.equal(e.extent, bursty.length);
});

test("the phases are the arc: diffuse, collapsed, self-sustaining", () => {
  assert.deepEqual([...PHASES], ["emanon", "protogon", "holon"]);
});

test("the declared numbers are never defaulted", () => {
  for (const args of [
    { material: bursty, draws: D },
    { material: bursty, window: W },
    { material: bursty },
    { material: [], window: W, draws: D },
  ]) {
    const e = emanon(args);
    assert.ok(isGap(e), `${JSON.stringify(args)} must refuse`);
  }
});

// ── type discipline (SEED.md #7) ─────────────────────────────────────────────

test("a diffuse thing is a type error for every figure question", () => {
  const e = emanon({ material: bursty, window: W, draws: D });
  const s = sustain({ protogon: e, reseeds: 8 });
  assert.ok(isGap(s));
  assert.match(s.reason, /not been cut/);
});

test("a cut cannot be cut again, and a holon cannot be re-sustained", () => {
  const e = emanon({ material: bursty, window: W, draws: D, firstGround: recBurst });
  const c = collapse({ emanon: e, observed: 9, regime: { start: 10, end: 15 } });
  assert.equal(c.phase, "protogon");
  assert.ok(isGap(collapse({ emanon: c, observed: 9 })), "protogon is already cut");

  const h = sustain({ protogon: c, reseeds: 8 });
  assert.equal(h.phase, "holon");
  assert.ok(isGap(sustain({ protogon: h, reseeds: 8 })), "holon has already sustained");
});

test("a received first ground must name its giver (SEED.md #1)", () => {
  const e = emanon({ material: quiet, window: W, draws: D, firstGround: { samples: [1, 2, 3, 4, 5] } });
  assert.equal(e.gap, "unreceived_origin");
});

// ── the refusals, both censored directions ───────────────────────────────────

test("a peak beyond its own settled past is surfeit, and names the re-zero trigger", () => {
  const e = emanon({ material: burstyDerived, window: W, draws: D });
  const c = collapse({ emanon: e, observed: 9, regime: { start: 50, end: 55 } });
  assert.equal(c.gap, "exceeds_witness");
  assert.equal(c.direction, "above");
  assert.equal(c.reZero, true);
  assert.ok(c.ground, "the ground is returned so it can be re-zeroed");
});

test("the floor is regularity, not a figure", () => {
  const e = emanon({ material: quietLong, window: W, draws: D });
  const observed = burstiness(quietLong.slice(50, 55), { window: W });
  const c = collapse({ emanon: e, observed, regime: { start: 50, end: 55 } });
  assert.equal(c.gap, "exceeds_witness");
  assert.equal(c.direction, "below");
  assert.equal(c.reZero, undefined);
});

test("a cut with nothing settled behind it refuses — the first ground is received", () => {
  const e = emanon({ material: bursty, window: W, draws: D });
  const c = collapse({ emanon: e, observed: 1, regime: { start: 0, end: 5 } });
  assert.equal(c.gap, "no_ground");
  assert.match(c.reason, /received/);
});

test("regime bounds and shapes are refused before any measurement", () => {
  const e = emanon({ material: quiet, window: W, draws: D });
  assert.ok(isGap(collapse({ emanon: e, observed: 1, regime: { start: -1, end: 3 } })));
  assert.ok(isGap(collapse({ emanon: e, observed: 1, regime: { start: 18, end: 21 } })));
  assert.ok(isGap(collapse({ emanon: e, observed: 1, regime: { start: 5, end: 5 } })));
  assert.ok(isGap(collapse({ emanon: e, observed: 1, regime: { start: 5.5, end: 9 } })));
});

test("a handed-in ground over the wrong extent is refused", () => {
  // Seven cells: three distinct windows, so the ground is not degenerate —
  // but its extent (7) matches neither the emanon's (20) nor the cut's regime
  // start (3), so it must be refused as incommensurate before any measurement.
  const g = ground({ material: quiet.slice(0, 7), draws: D, window: W });
  const e = emanon({ material: quiet, window: W, draws: D });
  const c = collapse({ emanon: e, observed: 1.0, regime: { start: 3, end: 6 }, ground: g });
  assert.equal(c.gap, "incommensurate_extent");
});

// ── the arc ──────────────────────────────────────────────────────────────────

test("the origin is received: a burst collapses against a ground that names its giver", () => {
  const e = emanon({ material: bursty, window: W, draws: D, firstGround: recBurst });
  const c = collapse({ emanon: e, observed: 9, regime: { start: 10, end: 15 } });
  assert.equal(c.phase, "protogon");
  assert.ok(c.figure.rank > 0 && c.figure.rank <= 1);
});

test("the level test earns the holon: a self-sustaining burst is above", () => {
  const e = emanon({ material: bursty, window: W, draws: D, firstGround: recBurst });
  const c = collapse({ emanon: e, observed: 9, regime: { start: 10, end: 15 } });
  const h = sustain({ protogon: c, reseeds: 8 });
  assert.equal(h.phase, "holon");
  assert.equal(h.level, "above");
  assert.equal(h.sustained, true);
});

test("an ordinary regime stays a protogon — peer means it waits", () => {
  const e = emanon({ material: quiet, window: W, draws: D, firstGround: recPlain });
  const c = collapse({ emanon: e, observed: 1.0, regime: { start: 3, end: 6 } });
  assert.equal(c.phase, "protogon");
  const p = sustain({ protogon: c, reseeds: 8 });
  assert.equal(p.phase, "protogon");
  assert.equal(p.sustained, false);
  assert.equal(p.level, "peer");
});

test("disagreeing gates are a typed gap, a result and not an error", () => {
  // A mild constant-offset regime is the disagreement made flesh: it shifts
  // the mean (possibility-constraint says yes) without moving the burstiness
  // ground's volume (existence-dependency says no). The old fixture — an
  // ordinary stretch of quiet — only disagreed under the organ's broken null;
  // calibrated, it is correctly a peer.
  const offset = [...quiet.slice(0, 10), 3, 3, 3, 3, 3, ...quiet.slice(10)];
  const e = emanon({ material: offset, window: W, draws: D, firstGround: recPlain });
  const c = collapse({ emanon: e, observed: 1.0, regime: { start: 10, end: 15 } });
  assert.equal(c.phase, "protogon");
  const s = sustain({ protogon: c, reseeds: 8 });
  assert.equal(s.gap, "unstable");
});

test("the full arc: diffuse, surfeit, re-zero, cut, sustain", () => {
  const e = emanon({ material: burstyDerived, window: W, draws: D });
  const c1 = collapse({ emanon: e, observed: 9, regime: { start: 50, end: 55 } });
  assert.equal(c1.gap, "exceeds_witness");
  assert.equal(c1.direction, "above");

  const g1 = reZero(c1.ground, { material: burstyDerived, seed: 1 });
  assert.ok(!isGap(g1));
  const observed = (g1.samples[0] + g1.samples[g1.samples.length - 1]) / 2;
  const c2 = collapse({ emanon: e, observed, regime: { start: 50, end: 55 }, ground: g1 });
  assert.equal(c2.phase, "protogon");

  const h = sustain({ protogon: c2, reseeds: 8 });
  assert.equal(h.phase, "holon");
  assert.equal(h.level, "above");
});

test("a cut with no place has no self-sustaining claim", () => {
  const e = emanon({ material: quiet, window: W, draws: D, firstGround: recPlain });
  const c = collapse({ emanon: e, observed: 1.0 });
  assert.equal(c.phase, "protogon");
  assert.equal(c.figure.regime, null);
  const s = sustain({ protogon: c, reseeds: 8 });
  assert.ok(isGap(s));
  assert.match(s.reason, /no place/);
});

// ── the growth rule, measured ────────────────────────────────────────────────

test("the core's rank is not phase — the level test decides what difference() cannot", () => {
  // Both figures PLACE against their grounds: rank inside (0,1). Yet one
  // sustains and one waits. The core's difference() returns only this rank —
  // it has no cut, no regime, and no way to form the question "is this thing
  // self-sustaining" at all. The organ's verdict is not carried by the rank.
  const eB = emanon({ material: bursty, window: W, draws: D, firstGround: recBurst });
  const cB = collapse({ emanon: eB, observed: 9, regime: { start: 10, end: 15 } });
  const eP = emanon({ material: quiet, window: W, draws: D, firstGround: recPlain });
  const cP = collapse({ emanon: eP, observed: 1.0, regime: { start: 3, end: 6 } });

  assert.ok(cB.figure.rank > 0 && cB.figure.rank < 1, "the burst figure places");
  assert.ok(cP.figure.rank > 0 && cP.figure.rank < 1, "the plain figure places");

  const h = sustain({ protogon: cB, reseeds: 8 });
  const p = sustain({ protogon: cP, reseeds: 8 });
  assert.equal(h.phase, "holon");
  assert.equal(p.phase, "protogon");

  // The more extreme rank (the burst's) sustains; the middling one waits.
  // Neither "high rank" nor "low rank" carries the phase — the regime's role
  // in the material does, and that is what existence-dependency and
  // possibility-constraint measure against their Born nulls.
  assert.ok(cB.figure.rank < cP.figure.rank);
});

// ── minimum viable ground, calibrated ────────────────────────────────────────

test("CALIBRATION: on iid noise, collapse's derived ground no longer manufactures spurious surfeit — the same defect atmosphere.js's MIN_GROUND fixed", () => {
  // `collapse`'s derive-a-ground path (no explicit `ground`, no `firstGround`
  // on the emanon) is `groundFrom` at this organ's own grain: same default
  // statistic (burstiness), same default perturbation (shuffle), one
  // `difference(observed, g)` gating a DEF·surfeit/`exceeds_witness`+above
  // verdict. Isolating it from `sustain`'s own Born-null-gated tests (which
  // this test never reaches) leaves exactly the mechanism atmosphere.js
  // measured: at `window + 2` elements, burstiness has only 3 candidate
  // sub-window positions no matter what `window` is, so the bootstrap null
  // comes back too narrow and an ordinary next observation clears it almost
  // by construction.
  //
  // Same two parameter sets atmosphere.js's own fix was calibrated against.
  // MEASURED, 2026-08-05: on iid noise, collapsing an ordinary next-window
  // mean (ground and observation drawn from the same distribution, so there
  // is no real surfeit to find) against a ground derived at the old
  // `window + 2` floor reported spurious surfeit on 24.5% (window=5,
  // draws=256, 200 trials) and 16.0% (window=6, draws=96, 200 trials) of
  // trials; at `3 * window` that fell to 2.5%/1.0% — inside the 15% bar
  // conformance/atmosphere.test.js's own CALIBRATION test already holds
  // itself to.
  //
  // `MIN_GROUND` was later raised again to `10 * window` (see its own header)
  // for a real-text content-dependent reason iid noise cannot exercise
  // (MEASURED: scripts/turn-fold-formation-min-ground-real-text-calibration.mjs
  // §3). This test stays on iid noise to confirm the wider floor costs
  // nothing here either. `start` MUST track the shipped floor exactly: a
  // `start` left behind at the old `3 * window` would land below the current
  // floor and `collapse` would refuse with `no_ground` on every trial,
  // passing this assertion for the wrong reason without ever reaching the
  // `exceeds_witness` path it exists to calibrate.
  const paramSets = [
    { window: 5, draws: 256 },
    { window: 6, draws: 96 },
  ];
  const trials = 60;
  for (const { window, draws } of paramSets) {
    let above = 0;
    let total = 0;
    for (let t = 0; t < trials; t++) {
      const next = rng(8000 + t);
      const start = 10 * window; // the shipped floor
      const end = start + window;
      const material = Array.from({ length: end + 5 }, () => next() * 2);
      const e = emanon({ material, window, draws });
      assert.ok(!isGap(e));
      let sum = 0;
      for (let j = start; j < end; j++) sum += material[j];
      const observed = sum / window;
      const c = collapse({ emanon: e, observed, regime: { start, end }, seed: t });
      total++;
      if (isGap(c) && c.gap === "exceeds_witness" && c.direction === "above") above++;
    }
    assert.ok(
      above / total <= 0.15,
      `spurious surfeit fired on ${above}/${total} structureless trials at window=${window} — the minimum ground is too small again`,
    );
  }
});

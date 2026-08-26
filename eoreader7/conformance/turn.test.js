// eoreader6 · turn — the nine operators at one grain, and specifically the
// two ways ⑦ DEF · Atmosphere · Clearing can fire.
//
// runTurn had no conformance file at all until now, which by SEED.md's own
// growth rule ("unwired is failing — a module nothing depends on is not early,
// it is refuted") meant the turn was refuted the whole time it was shipping.
//
// The load-bearing test in here is `a growing ground is not a moving one`. It
// is the one that would have caught the failure this file was written after:
// wired with a null held at before's extent, the moved-clearing fired at
// almost exactly even spacing on homogeneous noise — a clock reading its own
// arithmetic — and then recovered 23 of Frankenstein's 24 chapter boundaries
// while recovering 21–23 of them from the same series SHUFFLED. Every headline
// number looked like a triumph. Only the control said otherwise.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runTurn } from "../packages/engine/loops/turn.js";
import { isGap } from "../nul/index.js";

const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const gaussian = (next) => Math.sqrt(-2 * Math.log(Math.max(1e-12, next()))) * Math.cos(2 * Math.PI * next());

const homogeneous = (seed, n = 360) => {
  const next = rng(seed);
  return Array.from({ length: n }, () => 10 + gaussian(next));
};

// calm → elevated → turbulent. The first transition is a LEVEL shift; the
// second is a SPREAD shift at the SAME level. The second one is the case that
// matters: the ground the reader has accumulated by then is already wide
// enough to absorb a lot, which is exactly when a max-over-windows statistic
// stops noticing.
//
// REGIME's length must clear buildAt's own floor, `10 * SPEC.window` (=120),
// with real room to spare: after the first (level-shift) concession, a
// SECOND ground has to accumulate another full `10 * window` elements of
// elevated-only material before it exists at all, and that has to happen
// AND still leave room to observe the turbulent regime nearby — 120 itself
// (the pre-2026-08-05 regime length, sized for the retired `3 * window`
// floor) no longer clears that with any margin. 500 (≈4x the floor) does.
const REGIME = 500;
const threeRegimes = (seed) => {
  const next = rng(seed);
  const out = [];
  for (let i = 0; i < REGIME; i++) out.push(10 + gaussian(next) * 1); // calm
  for (let i = 0; i < REGIME; i++) out.push(25 + gaussian(next) * 1); // elevated  — LEVEL shift at REGIME
  for (let i = 0; i < REGIME; i++) out.push(25 + gaussian(next) * 6); // turbulent — SPREAD shift at 2*REGIME
  return out;
};

const SPEC = { window: 12, draws: 200, reseeds: 5, tolerance: 3, hop: 4, seed: 17 };
const recs = (turn) => turn.events.filter((e) => e.op === "REC").map((e) => e.at);

test("the resolution of pattern is declared, never defaulted — and only when it is needed", () => {
  const material = homogeneous(1);
  const g = runTurn({ material, ...SPEC, reseeds: undefined });
  assert.equal(g.gap, "undeclared");
  assert.equal(g.what, "reseeds");
  // ...but a reading that never asks about movement owes no such number.
  const surfeitOnly = runTurn({ material, ...SPEC, reseeds: undefined, clearOn: ["surfeit"] });
  assert.ok(!isGap(surfeitOnly));
});

test("a ground that cannot fail is not a ground, and an invented failure mode is a type error", () => {
  const material = homogeneous(1);
  assert.equal(runTurn({ material, ...SPEC, clearOn: [] }).gap, "undeclared");
  assert.equal(runTurn({ material, ...SPEC, clearOn: ["vibes"] }).gap, "unknown_spec");
});

test("both clearings are the same operator and are reported apart", () => {
  const turn = runTurn({ material: threeRegimes(3), ...SPEC });
  assert.ok(!isGap(turn));
  for (const e of turn.events.filter((e) => e.op === "DEF")) {
    assert.equal(e.stance, "Clearing");
    assert.equal(e.terrain, "Atmosphere");
    assert.ok(e.mode === "surfeit" || e.mode === "moved", `DEF event must name which failure: ${JSON.stringify(e)}`);
  }
  assert.equal(
    turn.clearingsBy.surfeit + turn.clearingsBy.moved,
    turn.clearings,
    "every clearing is one failure mode or the other, and the tally must close"
  );
});

test("events carry domain, not just terrain — a reaction is filterable without knowing the cube's vocabulary", () => {
  // DEF/EVA/REC are the only operators this turn pushes into events, and all
  // three sit at Interpretation×Ground (Atmosphere). Before this, a consumer
  // had to know "terrain === Atmosphere" means Interpretation; now domain is
  // the field, plain, so existence/structure/reaction split without a lookup
  // table private to the cube's own vocabulary.
  const turn = runTurn({ material: threeRegimes(3), ...SPEC });
  assert.ok(!isGap(turn));
  assert.ok(turn.events.length > 0);
  for (const e of turn.events) {
    assert.equal(e.domain, "Interpretation", `op ${e.op} at ${e.at} is not tagged as a reaction`);
    assert.ok(["DEF", "EVA", "REC"].includes(e.op), `unexpected op in the reaction channel: ${e.op}`);
  }
});

test("A GROWING GROUND IS NOT A MOVING ONE — the null must not be readable as a clock", () => {
  // Homogeneous noise has no regime change anywhere in it. A correct null puts
  // the false-clearing rate at roughly the null's own censoring resolution,
  // 1/(reseeds+1) — `moved` asks the displacement to exceed ALL `reseeds`
  // draws, so it lands true about one time in six by construction. The bound
  // below is that rate with generous room, and it is nowhere near the rate the
  // broken version produced, which was effectively every step it could fire.
  const material = homogeneous(5);
  const turn = runTurn({ material, ...SPEC, clearOn: ["moved"] });
  assert.ok(!isGap(turn));

  const steps = turn.events.length;
  const rate = turn.clearingsBy.moved / steps;
  assert.ok(rate < 0.4, `moved fired on ${(rate * 100).toFixed(0)}% of steps of pure noise — the null is reading growth`);

  // And the shape, not just the count: a mechanism keyed to extent re-zeros on
  // a fixed period, because it takes the same amount of new material to trip
  // `tolerance` every time. Evenly spaced boundaries on structureless material
  // are the signature, and they survive any amount of rate-tuning.
  const at = recs(turn);
  if (at.length >= 4) {
    const gaps = at.slice(1).map((v, i) => v - at[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
    assert.ok(sd / mean > 0.15, `boundaries on pure noise are evenly spaced (cv=${(sd / mean).toFixed(3)}): this is a clock`);
  }
});

test("CALIBRATION: on iid noise, buildAt's minimum ground no longer manufactures spurious surfeit re-zeros — the same defect atmosphere.js's MIN_GROUND fixed", () => {
  // `buildAt` is atmosphere.js's `groundFrom` at this organ's own grain: the
  // same closure shape, the same default statistic (burstiness), the same
  // default perturbation (shuffle), gating the same `difference()`-driven
  // DEF·surfeit/REC pair. Isolating `clearOn: ["surfeit"]` removes "moved"'s
  // own independent (and already-calibrated) reseeding null from the
  // picture, leaving exactly the mechanism atmosphere.js measured: at
  // `window + 2` elements, burstiness has only 3 candidate sub-window
  // positions no matter what `window` is, so the bootstrap null comes back
  // too narrow and an ordinary next window clears it almost by construction.
  //
  // Same two parameter sets atmosphere.js's own fix was calibrated against.
  // MEASURED, 2026-08-05: at the old `window + 2` floor this fired on 10%
  // (window=5/draws=256/tolerance=3) and 20% (window=6/draws=96/tolerance=2)
  // of 40 iid-noise trials, hop=1; at `3 * window` it fell to 0/40 in both,
  // and 0/40 at hop=4 too. `buildAt`'s floor was later raised again to
  // `10 * window` (see its own header) for a DIFFERENT, content-dependent
  // reason iid noise cannot exercise — the test below stays on iid noise
  // (modelled on conformance/atmosphere.test.js's own "CALIBRATION" device)
  // to confirm the wider floor costs nothing here either: still 0/40.
  const paramSets = [
    { window: 5, draws: 256, tolerance: 3 },
    { window: 6, draws: 96, tolerance: 2 },
  ];
  for (const { window, draws, tolerance } of paramSets) {
    let fired = 0;
    const trials = 40;
    for (let t = 0; t < trials; t++) {
      const next = rng(9000 + t);
      const material = Array.from({ length: 300 }, () => next() * 2);
      const turn = runTurn({ material, window, draws, tolerance, hop: 1, seed: t, clearOn: ["surfeit"] });
      assert.ok(!isGap(turn), isGap(turn) ? turn.gap : "");
      if (turn.rezeros > 0) fired++;
    }
    assert.ok(
      fired / trials <= 0.15,
      `surfeit-only re-zero fired on ${fired}/${trials} structureless trials at window=${window} — the minimum ground is too small again`,
    );
  }
});

test("the moved clearing finds a SPREAD shift that surfeit finds only sometimes", () => {
  // The claim here was originally stronger — "surfeit is blind to spread
  // shifts, by construction" — and it is wrong, which this test caught before
  // it got written down as a law. Burstiness is a MAX, so it responds to
  // whatever lifts the max, and a large enough variance increase does lift it.
  // What is actually true is narrower and seed-dependent: against a ground
  // already wide enough to absorb the change, surfeit misses it more often
  // than not. Measured over these three fixed seeds: moved 3/3, surfeit 1/3.
  //
  // Scored with the causal match window — a clearing cannot be declared until
  // `tolerance` failures have arrived, so the earliest honest detection sits
  // window + tolerance*hop after the change.
  const fwd = SPEC.window + SPEC.tolerance * SPEC.hop;
  const near = (at) => at.some((f) => f - 2 * REGIME >= -SPEC.window && f - 2 * REGIME <= fwd);

  let movedFound = 0;
  let surfeitFound = 0;
  for (const seed of [3, 11, 29]) {
    const material = threeRegimes(seed);
    const surfeit = runTurn({ material, ...SPEC, clearOn: ["surfeit"] });
    const moved = runTurn({ material, ...SPEC, clearOn: ["moved"] });
    assert.ok(!isGap(surfeit) && !isGap(moved));
    if (near(recs(surfeit))) surfeitFound++;
    if (near(recs(moved))) movedFound++;
  }

  assert.equal(movedFound, 3, "the moved clearing must find what aperture could already see");
  assert.ok(movedFound > surfeitFound, `moved ${movedFound}/3 vs surfeit ${surfeitFound}/3 — the second clearing has to earn its place`);
});

test("regions carry the vital sign and which failure ended them", () => {
  const turn = runTurn({ material: threeRegimes(3), ...SPEC });
  assert.ok(turn.regions.length >= 2);
  for (const r of turn.regions) {
    assert.ok(Number.isInteger(r.start) && Number.isInteger(r.end) && r.end > r.start);
    // opened is the SIGN of the pattern: widening is encounter, narrowing is
    // extraction. Never a gate, never a score — but never silently absent.
    assert.ok(r.opened === true || r.opened === false || r.opened === null);
  }
  // The last region is ended by the material running out, not by a failure,
  // and says so rather than borrowing the previous region's reason.
  assert.equal(turn.regions[turn.regions.length - 1].clearedBy, null);
  for (const r of turn.regions.slice(0, -1)) assert.ok(r.clearedBy === "surfeit" || r.clearedBy === "moved");
});

test("APERTURE FLOWS — a region opens with exactly the warmth the last region closed with", () => {
  // The reading's own settled past is RECEIVED by its present (belief.js
  // WORLDS.this: "the giver is this reader at an earlier here"; SEED.md #1).
  // Encounter is judged against accumulated warmth — by identity, not by
  // resemblance — so `opened` (close > the warmth the region OPENED with)
  // means genuinely widened-from-what-was-carried. The only region that opens
  // cold is the first one: firstness is received, never derived.
  const turn = runTurn({ material: threeRegimes(3), ...SPEC });
  assert.ok(turn.regions.length >= 2);
  for (let k = 1; k < turn.regions.length; k++) {
    assert.equal(
      turn.regions[k].apertureOpen,
      turn.regions[k - 1].apertureClose,
      `region ${k} must open with exactly the warmth region ${k - 1} closed with`,
    );
  }
  // The SIGN follows the flow: opened is close-vs-carried, and never a gate.
  for (let k = 1; k < turn.regions.length; k++) {
    const r = turn.regions[k];
    if (r.apertureClose != null)
      assert.equal(r.opened, r.apertureClose > turn.regions[k - 1].apertureClose);
  }
  // Not a gate: the flow changes nothing about how regions close.
  assert.ok(turn.clearings >= 1);
});

test("the field is established before anything is interpreted in it, and covers the whole extent", () => {
  const material = homogeneous(9);
  const turn = runTurn({ material, ...SPEC, hop: 1 });
  assert.ok(!isGap(turn));
  assert.equal(turn.field.coverage.extent, material.length);
  assert.equal(turn.field.coverage.uncovered, 0, "material no reach-unit touches cannot bear a relation");
});

test("grains other than Ground are refused, not faked", () => {
  const g = runTurn({ material: homogeneous(1), ...SPEC, grain: "Figure" });
  assert.equal(g.gap, "unknown_spec");
  assert.equal(g.grain, "Figure");
});

// ── §1/§2: regularity is a finding, never a clearing ────────────────────────

const rng2 = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

test("\"regularity\" finds, it does not fail — a clearOn of only regularity is refused like []", () => {
  const material = homogeneous(1);
  const g = runTurn({ material, ...SPEC, clearOn: ["regularity"] });
  assert.equal(g.gap, "undeclared");
  assert.equal(g.what, "clearOn");
});

test("regularity is opt-in — off by default, no findings channel touched", () => {
  const turn = runTurn({ material: homogeneous(1), ...SPEC });
  assert.ok(!isGap(turn));
  assert.deepEqual(turn.findings, []);
});

test("a sustained decline produces slack_ground findings and no re-zero", () => {
  // "surfeit" is the only other mode watched here, and a downward-only move
  // gives it nothing to clear on — this isolates the finding.
  const next = rng2(9);
  const material = [];
  for (let i = 0; i < 300; i++) material.push(10 + next());
  for (let i = 0; i < 300; i++) material.push(2 + next());
  const turn = runTurn({ material, ...SPEC, statistic: "windowMean", clearOn: ["surfeit", "regularity"] });
  assert.ok(!isGap(turn), turn.gap);
  const slack = turn.findings.filter((f) => f.gap === "slack_ground");
  assert.ok(slack.length > 0, "a sustained decline must be found");
  assert.equal(turn.clearingsBy.surfeit, 0, "a decline is not surfeit's territory");
  assert.equal(turn.rezeros, 0, "a finding is reported, never acted on");
});

test("burstiness's chronic below-rate is not calibratable — measured, matching loops/atmosphere", () => {
  // Documented in nul's windowMean header: an ordinary real window sits BELOW
  // burstiness's support 79-87% of the time. A run counter over that chronic
  // background cannot discriminate real regularity from ordinary material.
  //
  // Series length raised 300 -> 1500, 2026-08-05: `buildAt`'s floor moved from
  // `3 * window` to `10 * window` (the same content-dependent-drift fix, see
  // its own header), which delays how much of a FIXED-length series is past
  // warm-up and eligible to accumulate a slack run at all — the identical
  // adjustment conformance/atmosphere.test.js's own regularity test needed for
  // the same reason when atmosphere.js made this same move. The underlying
  // claim is unchanged and still measured, not assumed.
  let fired = 0;
  const trials = 15;
  for (let t = 0; t < trials; t++) {
    const next = rng2(6000 + t);
    const material = Array.from({ length: 1500 }, () => next() * 2);
    const turn = runTurn({ material, ...SPEC, clearOn: ["surfeit", "regularity"] });
    if (!isGap(turn) && turn.findings.length > 0) fired++;
  }
  assert.ok(fired / trials > 0.3, `expected burstiness to over-fire on iid noise, got ${fired}/${trials}`);
});

// ── the register: the reader's own settled past crosses the turn boundary ────

test("A LATER TURN OPENS WITH EXACTLY THE WARMTH THE EARLIER TURN CLOSED WITH", () => {
  // Continuity is the same act inside a turn and across it: a region closes
  // with its warmth and the next present opens with that SAME warmth. The
  // register is the form that warmth takes across the turn boundary — one
  // closing scalar, never a rollup of the trail.
  const material = threeRegimes(3);
  const t1 = runTurn({ material, ...SPEC });
  assert.ok(!isGap(t1));

  const lastClose = t1.regions[t1.regions.length - 1].apertureClose;
  assert.equal(t1.register.giver, "reader");
  assert.equal(t1.register.close, lastClose, "the register carries the last closing warmth — one scalar, never a rollup");
  assert.equal(t1.register.perturbation, "shuffle");
  assert.equal(t1.close, lastClose);

  const t2 = runTurn({ material, ...SPEC, register: t1.register });
  assert.ok(!isGap(t2));
  assert.equal(
    t2.regions[0].apertureOpen,
    lastClose,
    "the first region of the later turn opens with the earlier turn's closing warmth",
  );
  assert.equal(t2.regions[0].openedFrom, "carried");
  assert.equal(t1.regions[0].openedFrom, "own", "the first turn received nothing — firstness is received, never derived");

  const t3 = runTurn({ material, ...SPEC, register: t2.register });
  assert.ok(!isGap(t3));
  assert.equal(t3.regions[0].apertureOpen, t2.regions[t2.regions.length - 1].apertureClose, "the register chains — a third turn receives the second's close");
});

test("firstness is never derived — a turn with no register says own, never first", () => {
  const material = threeRegimes(3);
  const t = runTurn({ material, ...SPEC });
  assert.ok(!isGap(t));
  assert.equal(t.regions[0].openedFrom, "own", "received nothing, so the engine says own — firstness is the caller's to declare");
  for (const r of t.regions.slice(1)) {
    assert.equal(r.openedFrom, "carried", "every later region opens with the past the last region settled into");
  }
  // The register is typed, and a typed gap is a result, not a silent default.
  assert.equal(runTurn({ material, ...SPEC, register: {} }).gap, "unreceived_origin", "a carried past must name whose past it is (SEED.md #1)");
  assert.equal(runTurn({ material, ...SPEC, register: { giver: "reader", close: "warm" } }).gap, "unknown_spec", "the carried warmth is one closing volume, not a string");
});

test("a past built on a different perturbation is refused, not mixed", () => {
  // SEED.md #6 puts all judgement in the choice of perturbation, and Amendment
  // I makes sensitivity a property of the (statistic, perturbation) pair. A
  // register from a differently-perturbed reading cannot open this present —
  // receiving it would be an averaging of grounds.
  const material = threeRegimes(3);
  const t1 = runTurn({ material, ...SPEC });
  assert.ok(!isGap(t1));
  const foreign = { ...t1.register, perturbation: "fisher-yates" };
  const g = runTurn({ material, ...SPEC, register: foreign });
  assert.equal(g.gap, "unknown_spec");
  assert.equal(g.carried, "fisher-yates");
  assert.equal(g.here, "shuffle");
});


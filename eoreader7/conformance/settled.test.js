// eoreader6 · conformance/settled — the scoped path must be the same belief.
//
// The whole claim of settled.js is that aggregating the perished past against
// a fold is EXACT — that carrying it by reference computes the same numbers as
// spreading it over every step, only without the enumeration. That is a claim
// about floats, so the load-bearing tests here are identity tests: two ways of
// computing one quantity, asserted to agree.
//
// generation/RESULTS.md records that four of five defects in the last round of
// this work were caught by exactly this shape of test, including two invisible
// control characters that made every deep lookup silently miss.

import test from "node:test";
import assert from "node:assert/strict";

import { createLayer, createBelief, UNSEEN } from "../packages/engine/generation/belief.js";
import { settleGround, scopedDistribution, scopedMassOf, expand, reweighAt, CELL } from "../packages/engine/generation/settled.js";
import { isGap } from "../nul/index.js";

const ORDER = 3;
const ALPHA = 0.7;

// Two stretches with different habits, so the live ground and the perished one
// genuinely disagree and the mixture has something to do.
const PAST = [];
for (let i = 0; i < 400; i++) PAST.push("the", "old", "man", "walked", "slowly", ".");
const LIVE = [];
for (let i = 0; i < 60; i++) LIVE.push("the", "young", "girl", "ran", "quickly", ".");
const ALL = [...PAST, ...LIVE];
const BOUNDARY = PAST.length;

const build = () => {
  const live = createLayer({ id: "live", tier: "read", order: ORDER, gamma: 1, alpha: ALPHA });
  live.train(LIVE);
  const past = createLayer({
    id: "perished",
    tier: "received",
    world: "this",
    giver: "this same reader, earlier",
    order: ORDER,
    gamma: 1,
    alpha: ALPHA,
  });
  past.train(PAST);
  const settled = settleGround({ layer: past, at: BOUNDARY, giver: "this same reader, earlier" });
  // The unscoped belief this must agree with.
  const full = createBelief({ layers: [live, past] });
  return { live, past, settled, full };
};

const CONTEXTS = [[], ["the"], ["the", "young"], ["the", "old"], ["ran"], ["quickly", "."], ["."], ["never", "seen"]];

test("the organ declares the cell it occupies", () => {
  assert.equal(CELL.op, "REC");
  assert.equal(CELL.terrain, "Atmosphere");
  assert.equal(CELL.stance, "Cultivating");
});

// ── The identity. Everything else is commentary. ───────────────────────────

test("EXACT: the scoped path and the full belief agree on every form, in every context", () => {
  const { live, settled, full } = build();
  const vocabulary = new Set(ALL);
  let checked = 0;
  for (const ctx of CONTEXTS) {
    for (const form of vocabulary) {
      const scoped = scopedMassOf({ live, settled, context: ctx, form });
      const direct = full.probabilityOf(ctx, form);
      assert.ok(
        Math.abs(scoped.p - direct.p) < 1e-12,
        `p disagrees at ctx=${JSON.stringify(ctx)} form=${form}: scoped ${scoped.p} vs full ${direct.p}`,
      );
      assert.ok(
        Math.abs(scoped.reserve - direct.reserve) < 1e-12,
        `reserve disagrees at ctx=${JSON.stringify(ctx)} form=${form}`,
      );
      checked++;
    }
  }
  assert.ok(checked > 50, `expected a real sweep, checked ${checked}`);
});

test("EXACT: expand() reconstructs the same distribution the unscoped belief builds", () => {
  const { live, settled, full } = build();
  for (const ctx of CONTEXTS) {
    const rebuilt = expand({ live, settled, context: ctx, unseenLabel: UNSEEN });
    const direct = full.distribution(ctx);
    assert.ok(!isGap(rebuilt) && !isGap(direct), `both must place mass at ${JSON.stringify(ctx)}`);
    const forms = new Set([...Object.keys(rebuilt.probs), ...Object.keys(direct.probs)]);
    for (const f of forms) {
      const a = rebuilt.probs[f] ?? 0;
      const b = direct.probs[f] ?? 0;
      assert.ok(Math.abs(a - b) < 1e-12, `mass disagrees at ctx=${JSON.stringify(ctx)} form=${f}: ${a} vs ${b}`);
    }
  }
});

test("a distribution is still a distribution — the scoped shares account for everything", () => {
  const { live, settled } = build();
  for (const ctx of CONTEXTS) {
    const d = scopedDistribution({ live, settled, context: ctx });
    const total = d.live_mass + d.settled_mass + d.unseen_mass;
    assert.ok(Math.abs(total - 1) < 1e-12, `shares sum to ${total} at ${JSON.stringify(ctx)}`);
  }
});

// ── The saving is the point, so it is measured rather than asserted ────────

test("the per-step enumeration collapses to the live ground", () => {
  const { live, settled, full } = build();
  const ctx = ["the"];
  const scoped = scopedDistribution({ live, settled, context: ctx });
  const direct = full.distribution(ctx);
  const scopedEntries = Object.keys(scoped.live).length;
  const fullEntries = Object.keys(direct.probs).length;
  assert.ok(
    scopedEntries < fullEntries,
    `scoped enumerated ${scopedEntries} and full enumerated ${fullEntries} — if these are equal nothing was saved`,
  );
  // And the settled ground is one reference, not a copy of everything.
  assert.equal(typeof scoped.settled.hash, "string");
  assert.equal(typeof scoped.settled.mass, "number");
});

// ── A settled ground is content-addressed and cannot go stale ──────────────

test("the hash is over content, not a label", () => {
  const a = build().settled;
  const b = build().settled;
  assert.equal(a.hash, b.hash, "the same perished material settles to the same hash");

  const other = createLayer({ id: "p", tier: "received", world: "this", giver: "g", order: ORDER, gamma: 1, alpha: ALPHA });
  other.train([...PAST, "unexpected", "arrival", "."]);
  const c = settleGround({ layer: other, at: BOUNDARY, giver: "g" });
  assert.notEqual(a.hash, c.hash, "different material behind the boundary is a different settled ground");
});

test("a settled ground declares its boundary and names its giver", () => {
  const { past } = build();
  assert.throws(() => settleGround({ layer: past, at: BOUNDARY }), /names its giver/);
  assert.throws(() => settleGround({ layer: past, giver: "g" }), /boundary is declared/);
});

// ── The fold is detected, never scheduled ──────────────────────────────────

test("a rebuild needs a detected boundary, and an interval is refused", () => {
  const { settled } = build();
  // No event at all.
  assert.equal(reweighAt({ settled, event: null }).gap, "undeclared");
  // An event that does not say what found it — which is what a timer looks like.
  const anonymous = reweighAt({ settled, event: { at: BOUNDARY + 500 } });
  assert.equal(anonymous.gap, "undeclared");
  assert.match(anonymous.why, /schedule cannot pass as a detection/);
});

test("a real detection rebuilds, and a boundary that has not moved does not", () => {
  const { settled } = build();
  const moved = reweighAt({ settled, event: { at: BOUNDARY + 500, detected_by: "loops/atmosphere re-zero" } });
  assert.equal(moved.rebuild, true);
  assert.equal(moved.detected_by, "loops/atmosphere re-zero");

  const stale = reweighAt({ settled, event: { at: BOUNDARY - 10, detected_by: "loops/surf wave break" } });
  assert.equal(stale.rebuild, false);
});

// ── A reader with nothing behind it ────────────────────────────────────────

test("with nothing settled behind it, the unearned share is unplaced and never renormalised", () => {
  const { live } = build();
  const d = scopedDistribution({ live, settled: null, context: ["the"] });
  assert.equal(d.settled, null);
  assert.equal(d.settled_mass, 0);
  assert.ok(d.unseen_mass > 0, "SEED.md #3: what no ground placed is named, not normalised away");
  assert.ok(Math.abs(d.live_mass + d.unseen_mass - 1) < 1e-12);
});

test("the perished past may say a form the live ground has never met", () => {
  // The existence gate stops a FOREIGN book's referents crossing. A form this
  // same reader met earlier in this same material needs no visa, and without
  // the world:"this" exemption a single self-past layer could never clear
  // n >= 2 and the reader could not reach its own memory.
  const { live, settled } = build();
  assert.equal(live.has("walked"), false, "the live ground never met this form");
  const m = scopedMassOf({ live, settled, context: ["the", "old"], form: "walked" });
  assert.ok(m.p > 0, "the reader must be able to remember its own past");
});

// ── Scoring: the scoped path must price a target identically ───────────────

test("EXACT: scoped scoring agrees with unscoped scoring on the same belief", async () => {
  const { emitScoped } = await import("../packages/engine/generation/standpoint.js");
  const { emitSequence } = await import("../packages/engine/generation/emit.js");
  const { score } = await import("../packages/engine/prediction/scoring.js");
  const { live, settled, full } = build();

  // The same targets, priced two ways: through a materialised distribution and
  // through a live support plus a reference.
  const targets = [
    ["the", "young", "girl"],
    ["the", "old", "man"],
    ["ran", "quickly", "."],
    ["walked", "slowly", "."],
  ];
  for (const target of targets) {
    const context = ["."];
    // TEACHER-FORCED ON BOTH SIDES, and that is what makes this an identity
    // test at all. Free-running, the two emitters walk DIFFERENT paths — the
    // scoped one takes its mode over the live support and the full one over
    // everything — so their contexts diverge and they price a target at
    // different places. That is two emitters being compared, not two ways of
    // scoring one belief. Handing both the true prefix holds the contexts
    // identical, so the only thing left that could differ is the arithmetic.
    const scoped = emitScoped({ live, settled, context, horizon: target.length, selection: "mode", order: ORDER, conditioning: "teacher-forced", target });
    const plain = emitSequence({ belief: full, context, horizon: target.length, conditioning: "teacher-forced", selection: "mode", target });

    const a = score(scoped, target, { rule: "scoped-sequence-log-loss", settled });
    const b = score(plain, target, { rule: "sequence-log-loss" });
    assert.ok(
      Math.abs(a.loss - b.loss) < 1e-9,
      `loss disagrees on ${JSON.stringify(target)}: scoped ${a.loss} vs full ${b.loss}`,
    );
  }
});

test("a scoped emission cannot be scored without the ground it referenced", async () => {
  const { emitScoped } = await import("../packages/engine/generation/standpoint.js");
  const { score } = await import("../packages/engine/prediction/scoring.js");
  const { live, settled } = build();
  const e = emitScoped({ live, settled, context: ["."], horizon: 3, selection: "mode", order: ORDER });
  // Absent ground: refuse. Scoring from the live support alone would price
  // every remembered form at the floor and report it as a measurement.
  assert.throws(() => score(e, ["the", "young", "girl"], { rule: "scoped-sequence-log-loss" }), /not a zero/);
});

test("a substituted settled ground is refused by its hash", async () => {
  const { emitScoped } = await import("../packages/engine/generation/standpoint.js");
  const { score } = await import("../packages/engine/prediction/scoring.js");
  const { live, settled } = build();
  const e = emitScoped({ live, settled, context: ["."], horizon: 3, selection: "mode", order: ORDER });

  const other = createLayer({ id: "p", tier: "received", world: "this", giver: "g", order: ORDER, gamma: 1, alpha: ALPHA });
  other.train([...PAST, "unexpected", "arrival", "."]);
  const swapped = settleGround({ layer: other, at: BOUNDARY, giver: "g" });
  // The seal covers the emitter's freedom; the hash covers what it inherited.
  assert.throws(
    () => score(e, ["the", "young", "girl"], { rule: "scoped-sequence-log-loss", settled: swapped }),
    /this is a substitution/,
  );
});

test("the wrong rule refuses a scoped emission rather than mis-scoring it", async () => {
  const { emitScoped } = await import("../packages/engine/generation/standpoint.js");
  const { score } = await import("../packages/engine/prediction/scoring.js");
  const { live, settled } = build();
  const e = emitScoped({ live, settled, context: ["."], horizon: 3, selection: "mode", order: ORDER });
  const wrong = score(e, ["the", "young", "girl"], { rule: "sequence-log-loss" });
  assert.equal(wrong.proper, false, "a materialised-probs rule must not silently read a scoped emission");
  assert.equal(wrong.loss, null);
});

import { test } from "node:test";
import assert from "node:assert/strict";

import { ground, isGap } from "../nul/index.js";
import { openFrame, note } from "../frame/index.js";
import { declare, declarants, declaredCell, isDeclaredOrgan } from "../packages/engine/emergence/declaration.js";
import { ORGANS } from "../packages/engine/operators.js";

// ═══════════════════════════════════════════════════════════════════════════
// DECLARATION — an act names the organ that performed it, or it is not in the
// record.
//
// SEED.md's "Not yet earned" carried this as the privileged-frame debt: the
// record existed, and nothing required an organ to write to it. These tests
// hold the half that is now enforced, and the last one holds the half that is
// not — because a debt that moves and is described as closed is worse than a
// debt that stays.
// ═══════════════════════════════════════════════════════════════════════════

const W = 12;
const D = 200;

// A received ground — the gift a sequence chains back to. Only the first act
// of a frame may carry one (SEED.md #1, enforced in frame.note).
const GIFT = Object.freeze({
  samples: Object.freeze([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
  provenance: "conformance/declaration — a gift, and it names its giver",
  extent: 64,
  from: "the-suite",
});

const stretch = (n, seed) =>
  Array.from({ length: n }, (_, i) => ((i * 2654435761 + seed) % 1000) / 1000);

const constructed = (seed) => ground({ material: stretch(64, seed), draws: D, window: W });

// The roster's own entry for the organ that opens a frame — NUL · Ground.
const OPENER = "nul/core";

const opened = () => declare(openFrame({ giver: "the-suite" }), OPENER, { op: "NUL", grain: "Ground", ground: GIFT });

// ── the roster refuses imposture ────────────────────────────────────────────

test("an organ not on the roster cannot put an act in the record", () => {
  const f = opened();
  const refused = declare(f, "emergence/not-an-organ", { op: "EVA", grain: "Figure", ground: constructed(1) });
  assert.equal(refused.gap, "undeclared_organ");
  assert.equal(refused.organ, "emergence/not-an-organ");
});

test("a nameless declarant is refused before anything is measured", () => {
  const f = opened();
  for (const name of [undefined, null, "", 0]) {
    const refused = declare(f, name, { op: "EVA", grain: "Figure", ground: constructed(2) });
    assert.equal(refused.gap, "undeclared_organ", `${JSON.stringify(name)} is not an organ`);
  }
});

test("an organ acting outside the cell it declared is refused, and told which cell it left", () => {
  const f = opened();
  // nul/witness is EVA · Figure on the roster. An EVA · Pattern act is a
  // different act and needs its own id.
  const refused = declare(f, "nul/witness", { op: "EVA", grain: "Pattern", ground: constructed(3) });
  assert.equal(refused.gap, "undeclared_cell");
  assert.equal(refused.claimed, "EVA·Pattern");
  assert.equal(refused.declared, "EVA·Figure");
  // The gap carries the algebra's own vocabulary for the cell it belongs in.
  assert.equal(refused.terrain, "Lens");
  assert.equal(refused.stance, "Binding");
});

test("an organ acting in its declared cell is admitted, and the act carries its name", () => {
  const f = declare(opened(), "nul/witness", { op: "EVA", grain: "Figure", ground: constructed(4) });
  assert.ok(!isGap(f), `admitted: ${JSON.stringify(f)}`);
  assert.equal(f.n, 1);
  assert.equal(f.acts[0].organ, "nul/witness");
  assert.equal(f.origin.organ, OPENER, "the origin names its organ too");
});

test("declaredCell derives from the algebra and never invents one", () => {
  assert.equal(declaredCell("emergence/binding").op, "CON");
  assert.equal(declaredCell("emergence/binding").grain, "Figure");
  assert.equal(declaredCell("emergence/binding").terrain, "Link");
  assert.equal(declaredCell("nope").gap, "undeclared_organ");
  assert.ok(isDeclaredOrgan("emergence/coverage"));
  assert.ok(!isDeclaredOrgan("emergence/coverage/extra"));
});

test("every organ on the roster can declare an act — no cell is unreachable", () => {
  // The 27/27 grid does one piece of work here that a partial grid could not:
  // an act at any occupied cell has an organ to be attributed to, so
  // attribution never falls back to a gap.
  for (const organ of ORGANS) {
    const cell = declaredCell(organ.id);
    assert.ok(!isGap(cell), `${organ.id} has a derivable cell`);
    assert.equal(cell.op, organ.op);
    assert.equal(cell.grain, organ.grain);
  }
});

// ── the record refuses anonymity ────────────────────────────────────────────

test("frame.note refuses an act that names no organ, at every position", () => {
  const anonymousOpen = note(openFrame({ giver: "the-suite" }), { op: "NUL", grain: "Ground", ground: GIFT });
  assert.equal(anonymousOpen.gap, "undeclared");
  assert.equal(anonymousOpen.what, "organ");

  const anonymousLater = note(opened(), { op: "EVA", grain: "Figure", ground: constructed(5) });
  assert.equal(anonymousLater.gap, "undeclared");
  assert.equal(anonymousLater.what, "organ");
});

test("declarants walks the trail and never counts it", () => {
  let f = opened();
  f = declare(f, "nul/witness", { op: "EVA", grain: "Figure", ground: constructed(6) });
  f = declare(f, "nul/witness", { op: "EVA", grain: "Figure", ground: constructed(7) });
  f = declare(f, "loops/surf", { op: "EVA", grain: "Figure", ground: constructed(8) });
  const who = declarants(f);
  // First-appearance order, deduped, and no tally anywhere — a trail is walked,
  // never summed (frame/index.js).
  assert.deepEqual([...who], ["nul/witness", "loops/surf"]);
  assert.equal(declarants({}).gap, "no_ground");
});

test("declaration adds no refusal frame.note already makes — firstness still bites", () => {
  // A constructed ground cannot open a sequence, whoever declares it.
  const refused = declare(openFrame({ giver: "the-suite" }), "nul/core", {
    op: "NUL",
    grain: "Ground",
    ground: constructed(9),
  });
  assert.equal(refused.gap, "unreceived_origin");
});

// ── the half that is NOT enforced, held open on purpose ─────────────────────

test("declaration is checked, not compulsory — and the debt is named, not hidden", () => {
  // Nothing forces an organ to call declare(). This test exists so that the
  // day something does, it fails and someone rewrites it — which is the only
  // mechanism this repo has for keeping "Not yet earned" honest.
  //
  // Why it cannot be closed here: whoever received the first prior holds the
  // sequence, and a loop that builds its own ground can never open one
  // (SEED.md #1; loops/turn.js's header refuses a frame for exactly this
  // reason). Compulsion is the host's.
  const openedFrame = opened();
  assert.equal(openedFrame.n, 0, "an origin is held apart from the trajectory");

  // The evidence that it is unenforced: an organ can run and produce a result
  // with no frame in sight, and nothing in the engine objects.
  const silent = constructed(10);
  assert.ok(!isGap(silent), "an organ's own act needs no record to succeed — this is the debt");
});

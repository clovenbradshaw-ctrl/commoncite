// eoreader6 · frame — the engine's own acts, in the record.
//
// Two debts from SEED.md's "Not yet earned", discharged by one object because
// they were one debt: firstness could not be enforced because nothing held a
// sequence, and nothing held a sequence because the engine's own acts were
// never in the record.
//
// The suite plants the enforcement, the two artefacts that had to be measured
// away before the organ worked at all, and the growth rule — which here is not
// "the core returns a weaker answer" but "the core returns the OPPOSITE one."

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ground,
  received,
  keep,
  difference,
  pattern,
  witness,
  burstiness,
  volume,
  level,
  isGap,
} from "../nul/index.js";
import { openFrame, note, selfMaterial, selfLevel, selfWitness, posture, CELLS } from "../frame/index.js";

const D = 128;
const W = 5;
const RESEEDS = 16;
const STRETCH = 40;
const TURNS = 60;

const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// A gift that names its giver. The origin every frame chains back to.
const GIFT = received({
  samples: Array.from({ length: 64 }, (_, i) => 0.2 + (2 * i) / 63),
  provenance: { giver: "the-suite" },
});

const stretchAt = (seed, t, amp) => {
  const r = prng(seed * 7919 + t);
  return Array.from({ length: STRETCH }, () => r() * amp);
};

// Two readers. One keeps meeting material with room in it; one's room decays
// act over act. Nothing about the ENGINE differs between them — which is the
// point, and also this organ's honest limit, recorded at the bottom.
const ENCOUNTERING = () => 1.0;
const CLOSING = (t) => 1.0 - 0.85 * (t / (TURNS - 1));

const reader = (ampFn, seed, turns = TURNS) => {
  let f = note(openFrame({ giver: "the-suite" }), { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT });
  for (let t = 0; t < turns; t++) {
    const g = ground({ material: stretchAt(seed, t, ampFn(t)), draws: D, window: W, seed: seed * 31 + t });
    if (isGap(g)) continue;
    f = note(f, { organ: "conformance/frame", op: "EVA", grain: "Figure", ground: g });
    if (isGap(f)) return f;
  }
  return f;
};

// ── firstness, which needed a sequence to be enforceable ─────────────────────

test("the first ground of a sequence is received, never derived", () => {
  const f = openFrame({ giver: "the-suite" });
  const constructed = ground({ material: stretchAt(1, 0, 1), draws: D, window: W });
  assert.ok(!isGap(constructed));
  const refused = note(f, { organ: "conformance/frame", op: "EVA", grain: "Figure", ground: constructed });
  assert.equal(refused.gap, "unreceived_origin");
  // ...and the gift is admitted in the same position.
  assert.ok(!isGap(note(f, { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT })));
});

test("only the first is received — a later act cites the material it perturbed", () => {
  const opened = note(openFrame({ giver: "the-suite" }), { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT });
  const refused = note(opened, { organ: "conformance/frame", op: "EVA", grain: "Figure", ground: GIFT });
  assert.equal(refused.gap, "unreceived_origin");
});

test("a record of acts names who is keeping it", () => {
  assert.equal(openFrame({}).gap, "unreceived_origin");
  assert.equal(openFrame().gap, "unreceived_origin");
});

test("a sequence that never received a first ground has no trajectory", () => {
  assert.equal(selfMaterial(openFrame({ giver: "the-suite" })).gap, "unreceived_origin");
});

// ── the artefact that hid the engine behind its own first ground ─────────────

test("the origin is in the record and NOT in the trajectory", () => {
  // A received ground's volume is in its giver's units; a constructed one's is
  // in the statistic's units over the material. Averaging them is SEED.md #5,
  // and it did not fail loudly: the gift's aperture was simply larger than every
  // act's, so a max-over-windows statistic read the GIFT at every window and
  // every reader looked identical. Both deaths read as health.
  const f = reader(ENCOUNTERING, 1);
  const m = selfMaterial(f);
  assert.equal(f.n, TURNS, "the trajectory is the acts, not the gift");
  assert.equal(m.material.length, TURNS);
  assert.deepEqual(m.origin, { giver: "the-suite" }, "the trajectory still names the gift it began from");
  assert.ok(
    m.material.every((v) => v < volume(GIFT)),
    "the gift's aperture is off the acts' scale — which is why it may not be a member",
  );
});

// ── commensurability: a trajectory or it is not a trajectory ────────────────

test("acts built to different specs were never one trajectory", () => {
  let f = note(openFrame({ giver: "the-suite" }), { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT });
  f = note(f, { organ: "conformance/frame", op: "EVA", grain: "Figure", ground: ground({ material: stretchAt(1, 0, 1), draws: D, window: W }) });
  const otherWindow = ground({ material: stretchAt(1, 1, 1), draws: D, window: W + 2 });
  assert.equal(note(f, { organ: "conformance/frame", op: "EVA", grain: "Figure", ground: otherWindow }).gap, "unknown_spec");
});

test("acts over different amounts of material do not share a scale", () => {
  let f = note(openFrame({ giver: "the-suite" }), { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT });
  f = note(f, { organ: "conformance/frame", op: "EVA", grain: "Figure", ground: ground({ material: stretchAt(1, 0, 1), draws: D, window: W }) });
  const shorter = ground({ material: stretchAt(1, 1, 1).slice(0, 30), draws: D, window: W });
  const refused = note(f, { organ: "conformance/frame", op: "EVA", grain: "Figure", ground: shorter });
  assert.equal(refused.gap, "incommensurate_extent");
  assert.equal(refused.given, 30);
  assert.equal(refused.trajectory, STRETCH);
});

// ── the type discipline, and the record that cannot be edited ───────────────

test("an act declares its operator and its grain, both from the grid", () => {
  const f = note(openFrame({ giver: "the-suite" }), { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT });
  const g = ground({ material: stretchAt(1, 0, 1), draws: D, window: W });
  assert.equal(note(f, { organ: "conformance/frame", grain: "Figure", ground: g }).gap, "undeclared");
  assert.equal(note(f, { organ: "conformance/frame", op: "EVA", ground: g }).gap, "undeclared");
  assert.equal(note(f, { organ: "conformance/frame", op: "NOPE", grain: "Figure", ground: g }).gap, "unknown_spec");
  assert.equal(note(f, { organ: "conformance/frame", op: "EVA", grain: "Nope", ground: g }).gap, "unknown_spec");
  // An act that names no organ is not in the record. The record refuses
  // anonymity; whether the name is a real organ is the roster's question, and
  // frame depends on nul and on nothing else in the tree.
  assert.equal(note(f, { op: "EVA", grain: "Figure", ground: g }).gap, "undeclared");
  assert.equal(note(f, { op: "EVA", grain: "Figure", ground: g }).what, "organ");
});

test("an act that could not build a ground is not notable, and the gap is returned", () => {
  const f = note(openFrame({ giver: "the-suite" }), { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT });
  const flat = ground({ material: Array(STRETCH).fill(2), draws: D, window: W });
  assert.equal(flat.gap, "degenerate_ground");
  assert.equal(note(f, { organ: "conformance/frame", op: "EVA", grain: "Figure", ground: flat }).gap, "no_ground");
});

test("every note returns a NEW frame — a record a later call can edit is not a record", () => {
  const a = note(openFrame({ giver: "the-suite" }), { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT });
  const b = note(a, { organ: "conformance/frame", op: "EVA", grain: "Figure", ground: ground({ material: stretchAt(1, 0, 1), draws: D, window: W }) });
  assert.equal(a.n, 0);
  assert.equal(b.n, 1);
  assert.notEqual(a, b);
  assert.ok(Object.isFrozen(b) && Object.isFrozen(b.acts));
});

test("no number is defaulted", () => {
  const f = reader(ENCOUNTERING, 1);
  assert.equal(selfLevel(f, { draws: D, window: W }).gap, "undeclared");
  assert.equal(selfLevel(f, { draws: D, reseeds: RESEEDS }).gap, "undeclared");
  assert.equal(selfLevel(f, { window: W, reseeds: RESEEDS }).gap, "undeclared");
  assert.equal(selfWitness(f, { draws: D, window: W }).gap, "undeclared");
});

test("a sequence of one has no trajectory", () => {
  const f = note(openFrame({ giver: "the-suite" }), { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT });
  assert.equal(selfMaterial(f).gap, "empty_material");
  assert.equal(selfLevel(f, { draws: D, window: W, reseeds: RESEEDS }).gap, "empty_material");
});

// ── vacuity control: the null has real width, and says so when it does not ───

test("the null destroys the order of the acts, and a trajectory it cannot move is refused", () => {
  // SEED.md #3, the lineage's most expensive dead end: a null of zero width
  // would clear anything. A trajectory of one repeated value is unmoved by
  // shuffling, so no displacement between its halves is sayable — and the
  // organ says so rather than reporting `continuous` for free.
  let f = note(openFrame({ giver: "the-suite" }), { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT });
  const fixed = stretchAt(9, 0, 1);
  for (let t = 0; t < 12; t++) {
    f = note(f, { organ: "conformance/frame", op: "EVA", grain: "Figure", ground: ground({ material: fixed, draws: D, window: W, seed: 5 }) });
  }
  assert.equal(selfLevel(f, { draws: D, window: W, reseeds: RESEEDS }).gap, "degenerate_ground");
});

// ── what the organ is for ───────────────────────────────────────────────────

test("a reader whose room holds is continuous with itself, and has nothing to say about itself", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const f = reader(ENCOUNTERING, seed);
    const lv = selfLevel(f, { draws: D, window: W, reseeds: RESEEDS });
    assert.ok(!isGap(lv), `seed ${seed}: ${lv.gap}`);
    assert.equal(lv.continuous, true, `seed ${seed} displaced: ${lv.displacement} vs ${lv.shapeNull}`);
    // Identity by consequence: it still differs the way it differed. There is
    // no news about itself, and `witness` refuses to manufacture any.
    assert.equal(selfWitness(f, { draws: D, window: W, reseeds: RESEEDS }).gap, "made_no_difference");
  }
});

test("a reader whose room is closing is displaced from itself, and the direction is CLOSED", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const f = reader(CLOSING, seed);
    const lv = selfLevel(f, { draws: D, window: W, reseeds: RESEEDS });
    assert.ok(!isGap(lv), `seed ${seed}: ${lv.gap}`);
    assert.equal(lv.continuous, false, `seed ${seed}: ${lv.displacement} vs ${lv.shapeNull}`);
    assert.equal(lv.opened, false, `seed ${seed}: place ${lv.place} vs ${lv.placeNull}`);

    // And it passes the same gate every other claim passes — no reflexive gate,
    // no exemption. This is SEED.md's second death, said from the inside.
    const record = selfWitness(f, { draws: D, window: W, reseeds: RESEEDS });
    assert.ok(!isGap(record), `seed ${seed}: ${record.gap}`);
    assert.equal(record.opened, false);
    assert.equal(record.ground.kept, true, "testimony comes from a ground that was kept");
    assert.equal(record.pattern.moved, true);
    assert.deepEqual(record.origin, { giver: "the-suite" }, "testimony still names the gift it began from");
  }
});

// ── the growth rule, measured ───────────────────────────────────────────────

test("the core never once reads a closing reader as closed, at any spec tried", () => {
  // SEED.md: "An organ joins only when the level test returns `above` against
  // the core." The core's ground is built by perturbing the MATERIAL, so every
  // question it can form is a question about the material. Asked the strongest
  // thing it can be asked — witness over an early stretch against early+late —
  // its sign is not merely weaker than the organ's. It is never right.
  //
  // Measured, 15 (draws, seed) cells per reader, sign of `opened`:
  //
  //                       closed   opened   no sign   silent
  //   core, closing          0        8        7        0
  //   core, encountering     1        0        2       12
  //   organ, closing        15        0        0        0
  //   organ, encountering    0        0        0       15
  //
  // The core's one `closed` is on the ENCOUNTERING reader (seed 5, draws 512)
  // — the single direction of error that matters, spent on the wrong reader.
  // The mechanism is not mysterious: a declining reader meets material whose
  // overall range is WIDER than its opening stretch, so a ground over that
  // range is wider too. The core is not wrong about what it measures. It is
  // measuring the material, and no statistic of the material is a statistic
  // of the reader.
  const tally = { closing: [], encountering: [] };
  for (const draws of [128, 256, 512]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const [name, ampFn] of [["encountering", ENCOUNTERING], ["closing", CLOSING]]) {
        const early = stretchAt(seed, 0, ampFn(0));
        const late = stretchAt(seed, TURNS - 1, ampFn(TURNS - 1));
        const before = ground({ material: early, draws, window: W, seed: 1 });
        const after = ground({ material: [...early, ...late], draws, window: W, seed: 1 });
        const p = pattern({ before, after, material: early, reseeds: RESEEDS });
        const rec = witness({
          ground: keep(before),
          figure: difference(burstiness(early, { window: W }), before),
          pattern: p,
        });
        tally[name].push(isGap(rec) ? "silent" : String(p.opened));
      }
    }
  }
  assert.equal(tally.closing.filter((v) => v === "false").length, 0, "the core must never be shown getting this right");
  assert.ok(tally.closing.filter((v) => v === "true").length > 0, "and it is positively inverted on some");
  assert.equal(tally.encountering.filter((v) => v === "false").length, 1, "its only `closed` lands on the wrong reader");
});

test("the organ is right on every one of the same cells", () => {
  for (const draws of [128, 256, 512]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const enc = selfWitness(reader(ENCOUNTERING, seed), { draws, window: W, reseeds: RESEEDS });
      assert.equal(enc.gap, "made_no_difference", `draws=${draws} seed=${seed}`);
      const clo = selfWitness(reader(CLOSING, seed), { draws, window: W, reseeds: RESEEDS });
      assert.ok(!isGap(clo), `draws=${draws} seed=${seed}: ${clo.gap}`);
      assert.equal(clo.opened, false, `draws=${draws} seed=${seed}`);
    }
  }
});

test("the organ's verdicts separate the two readers the core conflates", () => {
  const verdicts = (ampFn) =>
    [1, 2, 3, 4, 5].map((seed) => {
      const w = selfWitness(reader(ampFn, seed), { draws: D, window: W, reseeds: RESEEDS });
      return isGap(w) ? w.gap : `record:opened=${w.opened}`;
    });
  const enc = new Set(verdicts(ENCOUNTERING));
  const clo = new Set(verdicts(CLOSING));
  assert.deepEqual([...enc], ["made_no_difference"]);
  assert.deepEqual([...clo], ["record:opened=false"]);
});

// ── why `level` is not the null this question needs, measured ───────────────

test("level()'s reseeding null cannot see a split, and coin-flips on stationary readers", () => {
  // The obvious implementation, kept as a test because it fails invisibly.
  // `level` nulls a displacement by reseeding own's ground over own's own
  // material — how much the answer moves on a fresh seed. Two halves of one
  // stationary trajectory are different STRETCHES, not different seeds over
  // one stretch, and a null that never splits cannot see the difference.
  //
  // On five readers whose room plainly does not drift, it reports a level
  // every time, clearing its own threshold several times over, with the
  // direction a coin. This is the defect `cascade` recorded at 3.08/5 rising
  // to 4.42/5 with draws, one grain up.
  const found = new Set();
  for (const seed of [1, 2, 3, 4, 5]) {
    const m = selfMaterial(reader(ENCOUNTERING, seed));
    const h = Math.floor(m.material.length / 2);
    const early = m.material.slice(0, h);
    const late = m.material.slice(m.material.length - h);
    const gE = ground({ material: early, draws: 256, window: W, seed: 0 });
    const gL = ground({ material: late, draws: 256, window: W, seed: 1 });
    const lv = level(gL.samples[Math.floor(gL.samples.length / 2)], gL, gE, { material: late, reseeds: RESEEDS });
    found.add(isGap(lv) ? lv.gap : lv.relationship);
  }
  assert.ok(!(found.size === 1 && found.has("peer")), `level() should be shown failing here, got ${[...found].join(", ")}`);
  assert.ok(found.has("above") && found.has("below"), `the direction should be a coin, got ${[...found].join(", ")}`);
});

// ── the cells, declared ─────────────────────────────────────────────────────

test("the organ declares the cells it occupies", () => {
  assert.deepEqual(
    CELLS.map((c) => `${c.op}·${c.grain}`),
    ["DEF·Figure", "EVA·Pattern"],
  );
  assert.ok(CELLS.every((c) => Object.isFrozen(c)));
});

// ── not yet earned, stated so it is not mistaken for done ───────────────────

test("reader-sclerosis and material-quiescence are not separated, and cannot be here", () => {
  // The honest limit. The two readers above differ only in the MATERIAL they
  // met; nothing about the engine differs. A ground is built by perturbing
  // present material and the engine carries no state between acts, so it has
  // nothing that could ossify independently of what it reads. In this engine
  // "the room is closing" and "the material went quiet" are the same event.
  //
  // What the organ does separate is a momentary silence from a TREND, which is
  // the distinction that matters operationally and which no single act can
  // make. Separating the two causes needs a reader that carries state across
  // acts — `packages/engine/generation/belief.js` is one, with its decay and
  // its layered gifts — and that trajectory is a different measurement than
  // this one. Recorded rather than implied.
  const enc = reader(ENCOUNTERING, 1);
  const clo = reader(CLOSING, 1);
  assert.notDeepEqual([...selfMaterial(enc).material], [...selfMaterial(clo).material]);
  assert.deepEqual(selfMaterial(enc).ops, selfMaterial(clo).ops, "the engine did the same acts in both");
});

// ── §3 of balance-routing-flow-v2: posture is a situation, never an instruction ──

test("a reader that keeps meeting room is neither agitated nor slack", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const p = posture(reader(ENCOUNTERING, seed), { draws: D, window: W, reseeds: RESEEDS });
    assert.ok(!isGap(p), `seed ${seed}: ${p.gap}`);
    assert.equal(p.situation, "neither");
  }
});

test("a reader whose room is closing is slack, not agitated", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const p = posture(reader(CLOSING, seed), { draws: D, window: W, reseeds: RESEEDS });
    assert.ok(!isGap(p), `seed ${seed}: ${p.gap}`);
    assert.equal(p.situation, "slack");
  }
});

test("posture is a pure read — called twice, same answer, nothing about the frame moves", () => {
  const f = reader(CLOSING, 2);
  const a = posture(f, { draws: D, window: W, reseeds: RESEEDS });
  const b = posture(f, { draws: D, window: W, reseeds: RESEEDS });
  assert.deepEqual(a, b);
  assert.equal(f.n, TURNS, "the frame itself is untouched by asking its posture");
});

test("posture propagates selfLevel's gaps rather than guessing a situation", () => {
  const f = note(openFrame({ giver: "the-suite" }), { organ: "conformance/frame", op: "NUL", grain: "Ground", ground: GIFT });
  const p = posture(f, { draws: D, window: W, reseeds: RESEEDS });
  assert.equal(p.gap, "empty_material");
});

test("no number is defaulted for posture either", () => {
  const f = reader(ENCOUNTERING, 1);
  assert.equal(posture(f, { draws: D, window: W }).gap, "undeclared");
});

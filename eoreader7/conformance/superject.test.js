// The superject: what a satisfaction adds to what comes after it.
//
// Whitehead, PR II.3 (102), on satisfaction:
//
//   the 'satisfaction' is the 'superject' rather than the 'substance' or the
//   'subject.' It CLOSES UP THE ENTITY; AND YET is the superject adding its
//   character to the creativity whereby there is a becoming of entities
//   superseding the one in question.
//
// Two clauses. `keep()` was already the first one exactly — a kept ground may
// speak and can no longer be perceived through, so to become sayable is to
// become unusable as an organ of perception. The second was missing: every
// witnessed record was frozen, returned, and prehended by nothing. A
// satisfaction that never becomes a datum for a successor is not a superject;
// it is a subject congratulating itself in private.
//
// `objectify()` and `nexus()` are the second clause. Note what they are NOT:
// they do not hand over a ground. `received()` does that, and `received()` is
// the AIM port — the first ground, the gift that names its giver. A superject
// prehended as a prior would close the successor's ground. Whitehead (ii) puts
// the antecedent in the successor's FORMAL CONSTITUTION — the process, not the
// outcome — which in this engine means material, and only material.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ground, difference, pattern, witness, keep, objectify, nexus, level, volume, burstiness, isGap } from "../nul/index.js";

const W = 5;
const DRAWS = 256;
const RESEEDS = 16;
const base = Array.from({ length: 40 }, (_, i) => i % 7);

const aSatisfaction = () => {
  const material = [...base, ...Array(8).fill(9)];
  const before = ground({ material: base, draws: DRAWS, window: W });
  const after = ground({ material, draws: DRAWS, window: W });
  const p = pattern({ before, after, material: base, reseeds: RESEEDS });
  const figure = difference(burstiness(base, { window: W }), before);
  return { record: witness({ ground: keep(before), figure, pattern: p }), before, p, figure };
};

// A succession with a rolling present. Most turns make no difference and
// correctly testify to nothing — that is the witness gate, not a shortfall.
const succession = (seed, turns, keepLast = 60) => {
  let a = (seed | 0) + 0x6d2b79f5;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const records = [];
  let material = base.slice();
  for (let t = 0; t < turns; t++) {
    const amp = next() * 10;
    const len = 2 + Math.floor(next() * 4);
    const prev = material.slice();
    material = [...material, ...Array.from({ length: len }, () => amp)].slice(-keepLast);
    const before = ground({ material: prev, draws: DRAWS, window: W });
    const after = ground({ material, draws: DRAWS, window: W });
    if (isGap(before) || isGap(after)) continue;
    const p = pattern({ before, after, material: prev, reseeds: RESEEDS });
    if (isGap(p) || !p.moved) continue;
    const figure = difference(burstiness(material, { window: W }), before);
    if (isGap(figure)) continue;
    const w = witness({ ground: keep(before), figure, pattern: p });
    if (!isGap(w)) records.push(w);
  }
  return records;
};

// ── not from within it ──────────────────────────────────────────────────────

test("a satisfaction that never closed its entity is not a superject", () => {
  const { before, p, figure } = aSatisfaction();
  // hand-built record over an UNKEPT ground: witness() would refuse it, and so
  // must objectify(), independently. The rule is not a downstream courtesy.
  const out = objectify({ ground: before, figure, pattern: p });
  assert.ok(isGap(out));
  assert.equal(out.gap, "no_ground");
});

test("a satisfaction that made no difference has nothing to pass on", () => {
  const { record } = aSatisfaction();
  assert.ok(!isGap(record));
  const out = objectify({ ...record, pattern: { ...record.pattern, moved: false } });
  assert.equal(out.gap, "made_no_difference");
});

test("a satisfaction passed on must still name its giver", () => {
  const { record } = aSatisfaction();
  const anonymous = { ...record, ground: { ...record.ground, from: null, provenance: null } };
  assert.equal(objectify(anonymous).gap, "unreceived_origin");
});

test("the depositor cannot read its own deposit", () => {
  // No machinery enforces this and none is needed. The ground that testified is
  // kept, and a kept ground cannot be perceived through. Keeping makes a
  // satisfaction unusable HERE; objectifying makes it usable THERE.
  const { record } = aSatisfaction();
  const mine = objectify(record);
  assert.ok(!isGap(mine));
  const readingBack = difference(mine.value, record.ground);
  assert.equal(readingBack.gap, "kept_ground");
});

// ── datum, not verdict ──────────────────────────────────────────────────────

test("a nexus is material and nothing else", () => {
  const records = succession(11, 220);
  const nex = nexus(records);
  assert.ok(!isGap(nex), "the succession produced no nexus");
  assert.ok(nex.n >= 8, `too thin a nexus to have tested anything: ${nex.n}`);
  // The whole point: NOT a ground. A superject prehended as a prior would close
  // the successor and this would be sclerosis with extra steps.
  assert.equal(nex.samples, undefined);
  assert.equal(nex.spec, undefined);
  assert.ok(Array.isArray(nex.material) || Object.isFrozen(nex.material));
  assert.ok(nex.material.every(Number.isFinite));
  assert.ok(nex.givers.every((g) => g != null), "every member names its giver");
});

test("a ground over a nexus is an ordinary ground, still open to being differed from", () => {
  const nex = nexus(succession(11, 220));
  const g = ground({ material: [...nex.material], draws: DRAWS, window: W });
  assert.ok(!isGap(g));
  assert.equal(g.kept, false, "a successor's ground arrives unkept — it has not spoken yet");
  assert.ok(volume(g) > 0, "a nexus with no room in it could not be surprised");
  assert.ok(!isGap(difference(g.samples[Math.floor(g.samples.length / 2)], g)));
});

// ── what the growth rule cannot do ──────────────────────────────────────────

test("a nexus is not stationary, so the growth rule cannot yet be asked of it", () => {
  // SEED.md: "An organ joins only when the level test returns `above` against
  // the core." Asked of this organ, level() returns `above`, `below`, or
  // `unstable` depending only on how long the succession ran:
  //
  //   220 turns   nexus n=75    support 3.49 .. 5.68    above
  //   500 turns   nexus n=157   support 4.43 .. 7.39    below
  //   1000 turns  nexus n=291   support 4.78 .. 7.89    unstable
  //   2000 turns  nexus n=509   support 5.51 .. 10.21   unstable
  //
  // The nexus ground's support drifts upward without settling, because the
  // satisfactions that survive the witness gate are increasingly large excesses.
  // That is SEED.md #5 one grain up — "every comparison between them is an
  // artefact of growth" — and it is the honest not-yet-earned for this organ.
  // The mechanism is built and its invariants hold; a nexus is not yet legitimate
  // MATERIAL, because nothing declares the reach of the present at this grain.
  // `window` is the seed's third declared number and it was never declared here.
  //
  // Asserting the instability rather than any one verdict, because any one
  // verdict is an artefact. If this ever fails because all three agree, the
  // nexus has become stationary and the growth rule can finally be asked.
  const core = ground({ material: base, draws: DRAWS, window: W });
  const verdicts = new Set();
  for (const turns of [220, 500, 1000]) {
    const nex = nexus(succession(11, turns));
    assert.ok(!isGap(nex));
    const organ = ground({ material: [...nex.material], draws: DRAWS, window: W });
    assert.ok(!isGap(organ));
    const lv = level(organ.samples[Math.floor(organ.samples.length / 2)], organ, core);
    verdicts.add(isGap(lv) ? lv.gap : lv.relationship);
  }
  assert.ok(verdicts.size > 1, `growth-rule verdict should not be stable yet, got only: ${[...verdicts].join(", ")}`);
});

// ── the tripwire did not break, and here is why ─────────────────────────────

test("order is legible to the figure and marginal in the intensity", () => {
  // This is why wiring the superject did not flip intensity.test.js. A ground is
  // built by PERTURBING material, and both available perturbation families —
  // shuffle and resample — destroy order. So aperture, being a property of that
  // order-free null, barely moves when the material is reordered: across 32
  // orderings its spread is at best comparable to what mere reseeding does to
  // it. The figure's statistic, measured on the real ordered material, moves
  // several times more.
  //
  // Whitehead (iii) says intensity arises from ORDER. In this engine the sign of
  // intensity cannot see order at any grain, base or nexus, because every ground
  // it is measured against had the order removed on purpose. The prediction is
  // not merely refuted — it is not yet askable. Asking it needs a third
  // perturbation family that destroys long-range order while preserving local
  // succession, so that a ground can be surprised by order specifically. SEED.md
  // #6: all judgement lives in the choice of perturbation, and there are
  // currently two, both order-free.
  const permute = (arr, s) => {
    let x = (s | 0) + 0x6d2b79f5;
    const r = () => {
      x = (x + 0x6d2b79f5) | 0;
      let t = Math.imul(x ^ (x >>> 15), 1 | x);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const o = arr.slice();
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }
    return o;
  };
  const spread = (a) => Math.max(...a) - Math.min(...a);

  const volumes = [];
  const figures = [];
  for (let s = 1; s <= 32; s++) {
    const pm = permute(base, s * 101);
    const g = ground({ material: pm, draws: DRAWS, window: W, seed: 0 });
    if (!isGap(g)) volumes.push(volume(g));
    figures.push(burstiness(pm, { window: W }));
  }
  assert.ok(
    spread(figures) > 3 * spread(volumes),
    `order should be far louder in the figure than in the intensity: ${spread(figures)} vs ${spread(volumes)}`,
  );
});

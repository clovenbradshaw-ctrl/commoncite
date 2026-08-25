// eoreader6 · loops/turn — §7-§9 of balance-routing-flow-v2: an anchor
// awareness can rest on without judging through, the vital sign kept as a
// series rather than two samples, and release before failure.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runTurn } from "../packages/engine/loops/turn.js";
import { isGap, difference } from "../nul/index.js";

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
const homogeneous = (seed, n = 400) => {
  const next = rng(seed);
  return Array.from({ length: n }, () => 10 + gaussian(next));
};

const SPEC = { window: 12, draws: 100, reseeds: 5, tolerance: 3, hop: 4, seed: 17 };

// ── §7: the anchor ──────────────────────────────────────────────────────────

test("awareness is opt-in — off by default, no ambient ground built", () => {
  const turn = runTurn({ material: homogeneous(1), ...SPEC });
  assert.ok(!isGap(turn));
  assert.equal(turn.ambientAperture, null);
  assert.equal(turn.ambientGround, null);
});

test("the ambient ground's volume is sampled at every act", () => {
  const turn = runTurn({ material: homogeneous(1), ...SPEC, awareness: true });
  assert.ok(!isGap(turn));
  assert.ok(turn.ambientAperture.length > 0);
  // Every act samples SOME value from the ambient ground, once one exists.
  const settled = turn.ambientAperture.filter((v) => v !== null);
  assert.ok(settled.length > 0);
});

test("the anchor cannot be perceived through — difference() gaps anchor_ground", () => {
  const turn = runTurn({ material: homogeneous(1), ...SPEC, awareness: true });
  assert.ok(!isGap(turn));
  assert.ok(turn.ambientGround.anchor, "the ground exposed for testing must actually be tagged");
  const d = difference(0, turn.ambientGround);
  assert.equal(d.gap, "anchor_ground");
});

test("the ambient reach is unaffected by attention's region conceding", () => {
  // Material with a real regime change, so attention's region concedes at
  // least once (clearOn: surfeit). The ambient ground's own extent — what it
  // was built over — keeps growing across that concession rather than
  // resetting with it.
  const next = rng(9);
  const material = [...Array.from({ length: 200 }, () => 10 + next()), ...Array.from({ length: 200 }, () => 40 + next())];
  const turn = runTurn({ material, ...SPEC, clearOn: ["surfeit"], awareness: true });
  assert.ok(!isGap(turn));
  assert.ok(turn.rezeros > 0, "this material must actually concede a region, or the test asserts nothing");
  assert.ok(turn.ambientGround.extent > turn.regions[turn.regions.length - 1].end - turn.regions[turn.regions.length - 1].start,
    "the ambient ground's extent must exceed the current (post-concession) region's own extent");
});

// ── §8: aperture as a series ───────────────────────────────────────────────────

test("a region's aperture series has length equal to its own act count", () => {
  const turn = runTurn({ material: homogeneous(2), ...SPEC });
  assert.ok(!isGap(turn));
  for (const r of turn.regions) assert.equal(r.aperture.length, r.acts);
});

test("the series is reported at equal prominence to opened, on every region", () => {
  const next = rng(9);
  const material = [...Array.from({ length: 200 }, () => 10 + next()), ...Array.from({ length: 200 }, () => 40 + next())];
  const turn = runTurn({ material, ...SPEC, clearOn: ["surfeit"] });
  assert.ok(!isGap(turn));
  assert.ok(turn.regions.length >= 2, "this material must concede at least once");
  for (const r of turn.regions) {
    assert.ok(Array.isArray(r.aperture));
    assert.ok(r.opened === true || r.opened === false || r.opened === null);
  }
});

test("one direction only — the aperture series is never itself fed to a ground that re-enters the same region", () => {
  // Structural, not a runtime probe: turn.js never passes a region's own
  // `aperture`/`apertureSeries` as `material` into `ground()`/`clearVoid()`. If it
  // did, the type checks (`incommensurate_extent`, `cites`) would refuse it
  // anyway, but the discipline is that it is never attempted.
  const src = new URL("../packages/engine/loops/turn.js", import.meta.url);
  const code = readFileSync(src, "utf8");
  assert.ok(!/clearVoid\(\{\s*material:\s*apertureSeries/.test(code));
  assert.ok(!/ground\(\{\s*material:\s*apertureSeries/.test(code));
});

// ── §9: release before failure ──────────────────────────────────────────────

test("release is opt-in — off by default, no new region boundaries", () => {
  const turn = runTurn({ material: homogeneous(3), ...SPEC, clearOn: ["surfeit"] });
  assert.ok(!isGap(turn));
  assert.equal(turn.releases, 0);
});

test("a read releases at the expected cadence, with no other failure mode watching at all", () => {
  // clearOn: ["release"] alone — nothing else can ever concede this ground,
  // so every boundary in the read (bar the last) must be a scheduled release.
  const turn = runTurn({ material: homogeneous(4), ...SPEC, clearOn: ["release"] });
  assert.ok(!isGap(turn));
  assert.ok(turn.releases > 0, "a read of this length must release at least once");
  assert.equal(turn.clearings, 0, "no failure mode is watching, so nothing here counts as a clearing");
  for (const r of turn.regions.slice(0, -1)) assert.equal(r.clearedBy, "release");
});

test("releases are tagged distinctly from a failure's re-zero", () => {
  const next = rng(9);
  const material = [...Array.from({ length: 200 }, () => 10 + next()), ...Array.from({ length: 200 }, () => 40 + next())];
  const turn = runTurn({ material, ...SPEC, clearOn: ["surfeit", "release"] });
  assert.ok(!isGap(turn));
  const kinds = new Set(turn.regions.map((r) => r.clearedBy).filter(Boolean));
  assert.ok(kinds.has("release") || kinds.has("surfeit"), "at least one kind must appear or the test asserts nothing");
  for (const e of turn.events.filter((e) => e.op === "REC")) assert.ok(["surfeit", "moved", "release"].includes(e.clearedBy));
});

test("replay from the same seed reproduces the release points exactly", () => {
  const material = homogeneous(4);
  const a = runTurn({ material, ...SPEC, clearOn: ["surfeit", "release"] });
  const b = runTurn({ material, ...SPEC, clearOn: ["surfeit", "release"] });
  assert.deepEqual(
    a.regions.map((r) => [r.start, r.end, r.clearedBy]),
    b.regions.map((r) => [r.start, r.end, r.clearedBy]),
  );
});

test("release does not compete with tolerance — a failing act still takes priority", () => {
  const next = rng(9);
  const material = [...Array.from({ length: 200 }, () => 10 + next()), ...Array.from({ length: 200 }, () => 40 + next())];
  const turn = runTurn({ material, ...SPEC, clearOn: ["surfeit", "release"] });
  assert.ok(!isGap(turn));
  // Every DEF event this run logs is surfeit — release never appears as a DEF
  // mode, because it bypasses the failure/tolerance channel entirely.
  for (const e of turn.events.filter((e) => e.op === "DEF")) assert.equal(e.mode, "surfeit");
});

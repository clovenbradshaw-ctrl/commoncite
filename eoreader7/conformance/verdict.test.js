import { test } from "node:test";
import assert from "node:assert/strict";
import { ground, received, keep, difference, burstiness, isGap } from "../nul/index.js";
import { verdict } from "../verdict/index.js";

const D = 256;
const W = 5;
const quiet = [1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 2];
const bursty = [...quiet, 9, 9, 9, 9, 9];
const g0 = () => ground({ material: quiet, draws: D, window: W });
const observed = burstiness(quiet, { window: W });

test("verdict types are named ranks", () => {
  const g = g0();
  const v = verdict(observed, g);
  assert.ok(["supported", "contested", "void"].includes(v.verdict));
  assert.ok(typeof v.rank === "number");
});

test("a gap produces void verdict", () => {
  const v = verdict(NaN, g0());
  assert.equal(v.verdict, "void");
});

test("a censored observation produces contested verdict", () => {
  const g = g0();
  const obs = g.samples[g.samples.length - 1] + 1;
  const v = verdict(obs, g);
  assert.equal(v.verdict, "contested");
  assert.ok(Number.isFinite(v.observed), "magnitude survives into verdict");
});

test("thrash: plural grounds disagree about the same figure", () => {
  const quietGnd = g0();
  const burstyGnd = ground({ material: bursty, draws: D, window: W });
  // 1.6 is supported against quiet ground (inside [1.2, 1.8])
  // but contested against bursty ground (below [3, 7.6])
  const v = verdict(1.6, quietGnd, { plural: [burstyGnd] });
  assert.equal(v.verdict, "thrash");
  assert.deepEqual(v.constituents, ["supported", "contested"]);
});

test("no thrash with a single ground", () => {
  const v = verdict(observed, g0(), { plural: [] });
  assert.notEqual(v.verdict, "thrash");
});

test("settled requires stable rank across reseeding", () => {
  const g = g0();
  const v = verdict(observed, g, { reseeds: 8 });
  if (v.verdict === "settled") {
    assert.ok(v.spec);
  } else {
    assert.notEqual(v.verdict, "void");
  }
});

test("settled is reachable: a mid-support observation with the cited material", () => {
  const g = g0();
  // The median of the null's own samples ranks mid-support against every
  // reseed of the same material; if anything is settled, this is.
  const mid = g.samples[Math.floor(g.samples.length / 2)];
  const v = verdict(mid, g, { reseeds: 8, material: quiet });
  assert.equal(v.verdict, "settled");
  assert.deepEqual(v.spec, g.spec);
});

test("stability without material stays supported — never settled, never void", () => {
  const g = g0();
  const mid = g.samples[Math.floor(g.samples.length / 2)];
  const v = verdict(mid, g, { reseeds: 8 });
  assert.equal(v.verdict, "supported");
});

test("stability over material the ground does not cite is a type error", () => {
  const g = g0();
  const mid = g.samples[Math.floor(g.samples.length / 2)];
  const wrong = quiet.map((v) => v + 1); // right length, not the cited material
  const v = verdict(mid, g, { reseeds: 8, material: wrong });
  assert.equal(v.verdict, "void");
  assert.equal(v.gap, "unreceived_origin");
});

test("settled verdict carries its ground spec", () => {
  const g = g0();
  const v = verdict(observed, g, { reseeds: 8, spec: g.spec });
  if (v.verdict === "settled") {
    assert.deepEqual(v.spec, g.spec);
  }
});


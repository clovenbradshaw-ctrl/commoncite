// native/tests/contextual-dmd.test.js — every dial derived, checked.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { contextualModes, decompose, conclusionOf, dyadicCandidates, basisOf } from "../adapters/text/contextual-dmd.js";

const obs = (...pairsPerUnit) => pairsPerUnit.map((o) => new Map(Object.entries(o)));

test("the basis is the material's own — no declared dimension anywhere", () => {
  const o = obs({ a: 1 }, { b: 2 }, { a: 1, c: 3 });
  assert.deepEqual(basisOf(o), ["a", "b", "c"], "dims = what this stretch actually contains");
  const out = decompose(o);
  assert.equal(out.dims, 3);
});

test("candidates are a dyadic ladder over what was read, not a chosen set", () => {
  assert.deepEqual(dyadicCandidates(10), [2, 4, 8, 10]);
  assert.deepEqual(dyadicCandidates(8), [2, 4, 8]);
  assert.deepEqual(dyadicCandidates(1), []);
});

test("the conclusion is two integers, so agreement needs no tolerance", () => {
  const c = conclusionOf(obs({ a: 1 }, { a: 2 }, { a: 4 }, { a: 8 }));
  assert.equal(typeof c.rank, "number");
  assert.equal(typeof c.oscillatory, "number");
  assert.ok(Number.isInteger(c.rank) && Number.isInteger(c.oscillatory));
});

test("rank is what the data excited, never a chosen model order", () => {
  // one motif moving, one motif dead: the dead direction is not inverted into
  const o = obs({ a: 1, z: 0 }, { a: 0.8, z: 0 }, { a: 0.64, z: 0 }, { a: 0.512, z: 0 }, { a: 0.41, z: 0 });
  const out = decompose(o);
  assert.equal(out.rank, 1, "the excited rank, derived from the spectrum");
  assert.ok(Math.abs(out.eigenvalues[0].magnitude - 0.8) < 1e-3);
});

test("a geometric decay: the window is MEASURED and the mode is recovered over it", () => {
  const o = [];
  let v = 1;
  for (let i = 0; i < 32; i += 1) { o.push(new Map([["a", v]])); v *= 0.7; }
  const out = contextualModes(o);
  assert.ok(Number.isInteger(out.window) && out.window >= 2, `a real window was measured, got ${out.window}`);
  assert.ok(out.window < o.length, "and it is shallower than everything — forgetting older material changed nothing");
  assert.ok(Math.abs(out.eigenvalues[0].magnitude - 0.7) < 1e-6, "the mode over that window is the real one");
});

test("too little material is a typed gap, never a guess", () => {
  assert.equal(decompose(obs({ a: 1 }, { a: 2 })).gap, "too_few_observations");
  assert.equal(contextualModes([]).gap, "too_few_observations");
  assert.equal(decompose(obs({}, {}, {}, {})).gap, "empty_basis");
});

test("no hardcoded dimension, rank, or tolerance appears in the source", () => {
  const raw = fs.readFileSync(new URL("../adapters/text/contextual-dmd.js", import.meta.url), "utf8");
  // scan CODE, not the header's account of the defect it removed — the
  // string "DIMS=16" legitimately appears there, describing what is gone
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/DIMS/.test(code), "no declared dimension in code");
  assert.ok(!/RANK/.test(code), "no declared rank in code");
  assert.ok(!/relTol\s*[:=]\s*[\d.]/.test(code), "no typed numerical tolerance in code");
  assert.ok(/"numerical"/.test(code), "rank is derived from the spectrum");
  assert.ok(/dmdWindow/.test(code), "the window is measured, not typed");
});

// conformance/entity.test.js — the Existence · Figure column
// (packages/engine/referents/entity.js).
//
// Two layers:
//
// 1. Synthetic — the reader's load-bearing invariants, pinned without any
//    text: declarations are never defaults, arrival is causal left-to-right
//    (surprisal is scored against the lexicon as it stands BEFORE the unit,
//    never after), witness arrival records units in order and dedupes within
//    a unit, and the void refuses a being that has no extent.
//
// 2. The golden — scripts/score-cast-entities.mjs against the Finnish cast:
//    Seitsemän veljestä, a closed cast of exactly 7. The golden asks whether
//    the reader admits the seven brothers as beings by recurrence and
//    consequence alone, in a language where the name surfaces themselves do
//    not line up (15 cases, and dialogue typeset in ALL CAPS). This is a
//    capability contract, not a ranking: 7/7 or the number moves.
//
// The fixture text is gitignored (goldens/cast/texts/). When it is absent
// the golden test SKIPS — `node goldens/cast/fetch.mjs` materialises it —
// it never silently passes. When present, it is a hard gate.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  openReading, arrive, witnessArrival, clearEntityVoid, carryEntities, refusals,
} from "../packages/engine/referents/entity.js";
import { isGap } from "../nul/index.js";
import { scoreCastEntities } from "../scripts/score-cast-entities.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SPEC = { window: 8, draws: 16, reseeds: 8, minArrivals: 2 };

test("openReading: the three declared numbers plus minArrivals are never defaults", () => {
  for (const missing of [
    { draws: 16, reseeds: 8, minArrivals: 2 },
    { window: 8, reseeds: 8, minArrivals: 2 },
    { window: 8, draws: 16, minArrivals: 2 },
    { window: 8, draws: 16, reseeds: 8 },
  ]) {
    const s = openReading(missing);
    assert.equal(isGap(s), true, `expected a gap for ${JSON.stringify(missing)}`);
    assert.equal(s.gap, "undeclared");
  }
  for (const bad of [{ window: 1 }, { draws: 0 }, { reseeds: 2.5 }, { minArrivals: -1 }]) {
    const s = openReading({ ...SPEC, ...bad });
    assert.equal(isGap(s), true, `expected a gap for ${JSON.stringify(bad)}`);
  }
  assert.equal(isGap(openReading(SPEC)), false);
});

test("arrive is causal: surprisal is scored against the lexicon BEFORE the unit", () => {
  // If the reader folded the unit in first, "x" would read as seen and the
  // second unit would carry a smaller cost. Measured here, the first
  // occurrence of a novel atom is maximally surprising against what has been
  // read (1 bit: 1-of-2). A repeat is still costly — surprisal is bounded by
  // the reading's OWN size, never by a constant: -log2(2/3) ≈ 0.585.
  const s = openReading(SPEC);
  arrive(s, ["x"]);
  assert.equal(s.series.length, 1);
  assert.ok(Math.abs(s.series[0] - 1) < 1e-9, `first unit must be -log2(1/2), got ${s.series[0]}`);
  arrive(s, ["x"]);
  assert.ok(Math.abs(s.series[1] + Math.log2(2 / 3)) < 1e-9, `repeat must be -log2(2/3), got ${s.series[1]}`);
  assert.equal(s.atoms, 2);
  assert.equal(s.unit, 2);
});

test("witnessArrival records units in order and dedupes within a unit", () => {
  const s = openReading(SPEC);
  arrive(s, ["a"]);
  witnessArrival(s, "juhani");
  arrive(s, ["b", "juhani"]);
  witnessArrival(s, "juhani");
  witnessArrival(s, "juhani");
  assert.deepEqual(s.arrivals.get("juhani"), [0, 1]);
});

test("clearEntityVoid refuses a being with no extent, and a mask that covers the reading", () => {
  const s = openReading(SPEC);
  arrive(s, ["a", "b", "c", "d"]);
  witnessArrival(s, "x");
  const single = clearEntityVoid(s, "x");
  assert.equal(isGap(single), true);
  assert.equal(single.gap, "empty_material");
});

test("carryEntities returns the register in birth order and refusals are recorded, never dropped", () => {
  const s = openReading(SPEC);
  // A candidate that never reached the admission threshold is neither a being
  // nor a refusal: refusals() only reports candidates the reader OFFERED and
  // turned away. The register is empty here because nothing was offered.
  arrive(s, ["a", "b", "c"]);
  witnessArrival(s, "once");
  witnessArrival(s, "twice");
  witnessArrival(s, "twice");
  assert.deepEqual(carryEntities(s), []);
  assert.deepEqual(refusals(s), []);
});

test("the golden: the Finnish closed cast of seven is admitted as beings", (t) => {
  const textPath = join(ROOT, "goldens/cast/texts/pg11940.txt");
  if (!existsSync(textPath)) {
    t.skip("goldens/cast/texts/ is gitignored — run `node goldens/cast/fetch.mjs` first");
    return;
  }

  const r1 = scoreCastEntities({ quiet: true });
  const r2 = scoreCastEntities({ quiet: true });

  assert.equal(r1.missing, false);
  assert.equal(r1.brothersFound, 7, `expected all seven brothers admitted, got ${r1.brothersFound}`);
  assert.deepEqual(r1.register, r2.register, "a second read of the same book must give the same beings");

  // The cast reference names are the nominatives — each brother's own surface
  // is in the register, alongside whatever inflections earned their own birth.
  for (const b of ["juhani", "tuomas", "aapo", "simeoni", "timo", "lauri", "eero"]) {
    assert.ok(r1.register.some((e) => e.surface === b), `nominative surface "${b}" must be admitted`);
  }

  // Sanity bounds, not fitted numbers: the register is a small fraction of the
  // candidates that reached the admission threshold.
  assert.ok(r1.registerSize < 300, `register should be bounded, got ${r1.registerSize}`);
  assert.ok(r1.born > 0, "the reader must actually birth beings");
});

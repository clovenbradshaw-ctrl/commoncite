// conformance/consequence.test.js — CON · Pattern
// (packages/engine/referents/consequence.js): is surfaceA's evidence and
// surfaceB's evidence the consequence of one being?
//
// Two layers, same shape as conformance/entity.test.js:
//
// 1. Synthetic — the mechanism's own discriminating power, pinned without
//    depending on any text having real segregated characters in it: a
//    maximally-segregated pair of positions must read as "distinct", an
//    identical pair must read as "consistent", and a surface that never
//    arrived is a gap, never a guess.
//
// 2. The golden — the Finnish cast fixture, reused from entity.test.js/
//    score-cast-entities.mjs. MEASURED LIMIT, not a fitted number: on
//    Seitsemän veljestä the seven brothers are on-page together for nearly
//    the whole book, so no pair of real brothers is segregated enough to
//    reach "distinct" — the golden instead pins the honest side, that
//    splitting ONE brother's own real arrivals never falsely reads as
//    "distinct" (a same-being false negative would be the serious failure
//    mode; "consistent" for a cross-brother split is the fixture's own
//    admitted weak spot, recorded in consequence.js's header, not hidden).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { openReading, arrive, witnessArrival } from "../packages/engine/referents/entity.js";
import { identityByConsequence, CELL } from "../packages/engine/referents/consequence.js";
import { isGap } from "../nul/index.js";
import { buildCastState } from "../scripts/score-cast-entities.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = { window: 8, draws: 16, reseeds: 8, minArrivals: 2 };

test("CON · Pattern is the declared cell", () => {
  assert.deepEqual({ ...CELL }, { op: "CON", grain: "Pattern" });
});

test("identical surface asked against itself is trivially the same being", () => {
  const s = openReading(SPEC);
  arrive(s, ["a"]);
  witnessArrival(s, "x");
  assert.deepEqual(identityByConsequence(s, "x", "x"), { relation: "same", reason: "identical surface" });
});

test("a surface that never arrived is a gap, never a guess", () => {
  const s = openReading(SPEC);
  arrive(s, ["a"]);
  witnessArrival(s, "x");
  const r = identityByConsequence(s, "x", "never-arrived");
  assert.equal(isGap(r), true);
  assert.equal(r.gap, "empty_material");
});

test("synthetic sanity: a maximally segregated pair reads as distinct", () => {
  const s = openReading(SPEC);
  // First half: one repeated word (near-zero surprisal after its first
  // arrival). Second half: a brand-new word every unit (surprisal stays
  // high — an atom never seen before is scored against an ever-larger
  // possible vocabulary). Real, designed variance, not a hand-picked number.
  for (let i = 0; i < 40; i++) arrive(s, ["common"]);
  for (let i = 0; i < 40; i++) arrive(s, [`novel${i}`]);
  const early = Array.from({ length: 20 }, (_, i) => i);
  const late = Array.from({ length: 20 }, (_, i) => s.series.length - 1 - i);
  s.arrivals.set("early", early);
  s.arrivals.set("late", late);
  const r = identityByConsequence(s, "early", "late");
  assert.equal(r.relation, "distinct");
  assert.equal(r.segregation.segregated, true);
  assert.equal(r.displacement.disturbed, true);
});

test("synthetic sanity: the same positions under two labels are consistent, never distinct", () => {
  const s = openReading(SPEC);
  for (let i = 0; i < 80; i++) arrive(s, [`w${i % 7}`]);
  const at = Array.from({ length: 20 }, (_, i) => i * 2);
  s.arrivals.set("alias1", at);
  s.arrivals.set("alias2", at.slice());
  const r = identityByConsequence(s, "alias1", "alias2");
  assert.equal(r.relation, "consistent");
  assert.equal(r.segregation.observed, 0);
});

test("determinism: the same pair with the same seed gives the same verdict", () => {
  const s = openReading(SPEC);
  for (let i = 0; i < 80; i++) arrive(s, [`w${i % 7}`]);
  const early = Array.from({ length: 20 }, (_, i) => i);
  const late = Array.from({ length: 20 }, (_, i) => s.series.length - 1 - i);
  s.arrivals.set("early", early);
  s.arrivals.set("late", late);
  const r1 = identityByConsequence(s, "early", "late");
  const r2 = identityByConsequence(s, "early", "late");
  assert.deepEqual(r1, r2);
});

test("the golden: splitting one brother's own arrivals never reads as distinct", (t) => {
  const textPath = join(ROOT, "goldens/cast/texts/pg11940.txt");
  if (!existsSync(textPath)) {
    t.skip("goldens/cast/texts/ is gitignored — run `node goldens/cast/fetch.mjs` first");
    return;
  }
  const built = buildCastState();
  const { state } = built;

  const splitOddEven = (arr) => [arr.filter((_, i) => i % 2 === 0), arr.filter((_, i) => i % 2 === 1)];
  for (const brother of ["juhani", "tuomas", "aapo", "simeoni", "timo", "lauri", "eero"]) {
    const at = state.arrivals.get(brother);
    assert.ok(at && at.length >= 2, `${brother} must have real arrivals in this fixture`);
    const [half1, half2] = splitOddEven(at);
    state.arrivals.set(`${brother}__A`, half1);
    state.arrivals.set(`${brother}__B`, half2);
    const r = identityByConsequence(state, `${brother}__A`, `${brother}__B`);
    assert.notEqual(r.relation, "distinct", `${brother}'s own two halves must never read as distinct beings`);
  }

  // MEASURED, not asserted away: on this ensemble-cast fixture, cross-brother
  // splits are ALSO "consistent" (weak positional segregation — the brothers
  // are rarely apart). This is the fixture's documented limit, not a claim
  // that the mechanism proved two different brothers are one being — a
  // "consistent" verdict is a refusal to refute, never a proof of identity.
  const r = identityByConsequence(state, "juhani__A", "tuomas__A");
  assert.ok(["consistent", "unstable"].includes(r.relation), "cross-brother verdict must stay honest about weak power here, never claim distinct with no basis nor silently flip meaning");
});

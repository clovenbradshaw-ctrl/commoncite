// eoreader6 · modifier-order/wals — conformance
//
// Universal 20's core claim, tested rather than asserted: demonstrative
// sits farthest from the head, numeral next, then the adjective-internal
// hierarchy — for English, entirely prenominal, the harmonic case the
// cline predicts. "this fat black cat" nests; "black this cat" (an
// adjective sitting closer to the head than a demonstrative) inverts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DEM_NUM_RANKS, SAMPLE_DIRECTIONS, walsTypology } from "../modifier-order/wals.js";
import { order } from "../modifier-order/index.js";
import { isGap } from "../nul/index.js";

const AP_RANKS = Object.freeze({
  purpose: 1, material: 2, origin: 3, color: 4, shape: 5, age: 6, quality: 7, size: 8, evaluation: 9, quantity: 10,
});

test("DEM_NUM_RANKS sits above the full adjective-internal 1-10 scale", () => {
  assert.equal(DEM_NUM_RANKS.numeral, 11);
  assert.equal(DEM_NUM_RANKS.demonstrative, 12);
  assert.ok(DEM_NUM_RANKS.numeral > Math.max(...Object.values(AP_RANKS)));
});

test("walsTypology merges the received adjective ranks with the Dem/Num ranks and names its giver", () => {
  const t = walsTypology("english", { adjectiveRanks: AP_RANKS });
  assert.ok(t);
  assert.equal(t.direction, "pre");
  assert.equal(t.ranks.demonstrative, 12);
  assert.equal(t.ranks.color, 4);
  assert.match(t.giver, /WALS/);
  assert.match(t.giver, /Universal 20/);
});

test("walsTypology returns null — never a guess — for a language outside the sample", () => {
  assert.equal(walsTypology("klingon", { adjectiveRanks: AP_RANKS }), null);
});

test("'this fat black cat': demonstrative > quality > color, pre-nominal, nests", () => {
  const t = walsTypology("english", { adjectiveRanks: AP_RANKS });
  const seq = [{ class: "demonstrative", surface: "this" }, { class: "quality", surface: "fat" }, { class: "color", surface: "black" }];
  const r = order(seq, t);
  assert.equal(r.relation, "nested");
});

test("'black this cat': an adjective placed closer to the head than a demonstrative inverts", () => {
  const t = walsTypology("english", { adjectiveRanks: AP_RANKS });
  const seq = [{ class: "color", surface: "black" }, { class: "demonstrative", surface: "this" }];
  const r = order(seq, t);
  assert.equal(r.relation, "inverted");
  assert.equal(r.violation.near, "demonstrative");
  assert.equal(r.violation.far, "color");
});

test("Mandarin sample: same harmonic direction as English, different giver citation", () => {
  const t = walsTypology("mandarin", { adjectiveRanks: AP_RANKS });
  assert.ok(t);
  assert.equal(t.direction, "pre");
  assert.match(t.giver, /Mandarin/);
  assert.notEqual(t.giver, walsTypology("english", { adjectiveRanks: AP_RANKS }).giver);
});

test("SAMPLE_DIRECTIONS is small and explicit — not presented as a complete survey", () => {
  assert.deepEqual(Object.keys(SAMPLE_DIRECTIONS).sort(), ["english", "mandarin"]);
});

test("an incomplete typology (no adjective ranks merged) still refuses cleanly on an unranked class", () => {
  const t = walsTypology("english", {}); // no adjectiveRanks merged in
  const seq = [{ class: "demonstrative" }, { class: "quality" }];
  const r = order(seq, t);
  assert.ok(isGap(r));
  assert.equal(r.gap, "unknown_spec");
});

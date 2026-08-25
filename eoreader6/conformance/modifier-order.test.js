// eoreader6 · modifier-order — conformance
//
// "The fat black cat" is well-formed; "the black fat cat" is not, and not
// because English memorized an order — because a rank received from a
// typology (never derived, II.2) nests one way and inverts the other. These
// tests hold the organ to that: the same rank pattern must nest under a
// mirrored, post-nominal direction, must invert under an inverted stack, and
// must refuse rather than guess whenever the typology it needs is not fully
// received. The cross-script fixture is II.13's earning test, not an
// assertion: the same rank pattern, spelled in an unrelated alphabet, must
// return the identical relation. The graph fixture is II.7's: `toTriples`
// output must flow through the real `emergence/graph.js`, not a stand-in.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  order,
  scopeTree,
  toTriples,
  admissibleTypology,
  corpusDirectionTest,
  RELATIONS,
  DIRECTIONS,
} from "../modifier-order/index.js";
import { isGap } from "../nul/index.js";
import { createGraph, readTriples, edgeKey } from "../packages/engine/emergence/graph.js";

const GIVER =
  "Cinque (2010), The Syntax of Adjectives; Scott (2002); Dixon (1982) — illustrative fixture typology, not a shipped lexicon";

const EN = Object.freeze({
  ranks: { purpose: 1, material: 2, origin: 3, color: 4, shape: 5, age: 6, quality: 7, size: 8, evaluation: 9, quantity: 10 },
  direction: "pre",
  giver: GIVER,
});

const POST = Object.freeze({ ...EN, direction: "post" });

test("RELATIONS and DIRECTIONS are the named vocabularies", () => {
  assert.deepEqual(RELATIONS, ["nested", "inverted"]);
  assert.deepEqual(DIRECTIONS, ["pre", "post"]);
});

test("'fat black cat': quality before color, pre-nominal, nests", () => {
  const seq = [{ class: "quality" }, { class: "color" }]; // fat, black
  const r = order(seq, EN);
  assert.equal(r.relation, "nested");
  assert.equal(r.violation, null);
  assert.deepEqual(r.headOutward, ["color", "quality"]);
});

test("'black fat cat': color before quality, pre-nominal, inverts", () => {
  const seq = [{ class: "color" }, { class: "quality" }]; // black, fat
  const r = order(seq, EN);
  assert.equal(r.relation, "inverted");
  assert.equal(r.violation.near, "quality");
  assert.equal(r.violation.far, "color");
});

test("the same rank pattern nests under a mirrored, post-nominal direction", () => {
  const seq = [{ class: "color" }, { class: "quality" }]; // nearest-head first, post-nominal
  const r = order(seq, POST);
  assert.equal(r.relation, "nested");
});

test("mirroring direction does not rescue an inverted pattern", () => {
  const seq = [{ class: "quality" }, { class: "color" }]; // farthest first, post-nominal — still inverted
  const r = order(seq, POST);
  assert.equal(r.relation, "inverted");
});

test("a typology missing its giver is a wall, not a gap-in-waiting (II.2)", () => {
  const { giver, ...noGiver } = EN;
  const bad = admissibleTypology(noGiver);
  assert.ok(isGap(bad));
  assert.equal(bad.gap, "unreceived_origin");
});

test("a missing direction refuses rather than assuming prenominal", () => {
  const { direction, ...noDirection } = EN;
  const bad = admissibleTypology(noDirection);
  assert.ok(isGap(bad));
  assert.equal(bad.gap, "undeclared");
  assert.equal(bad.what, "typology.direction");
});

test("a class outside the received typology is refused, not guessed", () => {
  const r = order([{ class: "color" }, { class: "texture" }], EN);
  assert.ok(isGap(r));
  assert.equal(r.gap, "unknown_spec");
  assert.deepEqual(r.missing, ["texture"]);
});

test("empty material refuses", () => {
  const r = order([], EN);
  assert.ok(isGap(r));
  assert.equal(r.gap, "empty_material");
});

test("scopeTree nests innermost-first for a well-formed stack", () => {
  const seq = [{ class: "quality" }, { class: "color" }]; // fat, black
  const tree = scopeTree(seq, EN);
  assert.equal(tree.class, "color"); // nearest the head, innermost
  assert.equal(tree.scopes.class, "quality");
  assert.equal(tree.scopes.scopes.class, "HEAD");
  assert.equal(tree.scopes.scopes.scopes, null);
});

test("scopeTree refuses to describe an inverted stack rather than misdescribe it", () => {
  const seq = [{ class: "color" }, { class: "quality" }]; // black, fat
  const tree = scopeTree(seq, EN);
  assert.ok(isGap(tree));
  assert.equal(tree.gap, "unstable");
});

test("cross-script invariance (II.13): the same rank pattern in an unrelated alphabet returns the identical relation", () => {
  // Class labels themselves carry no meaning to this organ — only their
  // received rank does. Re-keying the same two-class, two-rank typology in
  // Greek must change nothing about the verdict.
  const greek = Object.freeze({
    ranks: { χρώμα: 4, ιδιότητα: 7 }, // color: 4, quality: 7 — same numbers as EN
    direction: "pre",
    giver: GIVER,
  });
  const en = order([{ class: "quality" }, { class: "color" }], EN);
  const gr = order([{ class: "ιδιότητα" }, { class: "χρώμα" }], greek);
  assert.equal(en.relation, gr.relation);
  assert.equal(en.relation, "nested");

  const enInv = order([{ class: "color" }, { class: "quality" }], EN);
  const grInv = order([{ class: "χρώμα" }, { class: "ιδιότητα" }], greek);
  assert.equal(enInv.relation, grInv.relation);
  assert.equal(enInv.relation, "inverted");
});

test("corpusDirectionTest refuses undeclared numbers exactly as temporality does", () => {
  const r = corpusDirectionTest([1, 2, 3], {});
  assert.ok(isGap(r));
  assert.equal(r.gap, "undeclared");
});

test("corpusDirectionTest reads an attested rank series as ordered material, exactly as temporality does any other series", () => {
  // A rank series with no real structure — IID modifier-class draws — must
  // not read as load-bearing order.
  const prng = (seed) => {
    let a = (seed | 0) + 0x6d2b79f5;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const next = prng(20260809);
  const iidRanks = Array.from({ length: 300 }, () => Math.floor(next() * 10) + 1);
  const t = corpusDirectionTest(iidRanks, { draws: 120, window: 3, seed: 11 });
  assert.equal(t.verdict, "exchangeable");
});

// ── the graph fixture: II.7, one mechanism, not a parallel one ─────────────

test("toTriples refuses without a received head", () => {
  const seq = [{ class: "quality" }, { class: "color" }];
  const t = toTriples(seq, EN, {});
  assert.ok(isGap(t));
  assert.equal(t.gap, "undeclared");
  assert.equal(t.what, "head");
});

test("toTriples refuses to mint edges for an inverted stack", () => {
  const seq = [{ class: "color" }, { class: "quality" }]; // black, fat — inverted
  const t = toTriples(seq, EN, { head: "cat_1" });
  assert.ok(isGap(t));
  assert.equal(t.gap, "unstable");
});

test("toTriples builds a head-outward chain: the entity node carries every modifier applied", () => {
  const seq = [{ class: "quality", surface: "fat" }, { class: "color", surface: "black" }]; // fat, black
  const t = toTriples(seq, EN, { head: "cat_1" });
  assert.equal(t.headNode, "cat_1");
  assert.equal(t.entityNode, "cat_1::black::fat");
  assert.deepEqual(t.triples, [
    { subject: "cat_1::black", verb: "color", object: "cat_1", polarity: "+" },
    { subject: "cat_1::black::fat", verb: "quality", object: "cat_1::black", polarity: "+" },
  ]);
});

test("toTriples output flows through the real emergence/graph.js unchanged", () => {
  const seq = [{ class: "quality", surface: "fat" }, { class: "color", surface: "black" }];
  const t = toTriples(seq, EN, { head: "cat_1" });
  assert.ok(!isGap(t));

  const g = createGraph({ gamma: 0.9, pruneBelow: 0.01 });
  const result = readTriples(g, t.triples);

  assert.equal(result.newNodes, 3); // cat_1, cat_1::black, cat_1::black::fat
  assert.equal(result.newEdges, 2);
  assert.ok(g.nodes.has("cat_1"));
  assert.ok(g.nodes.has("cat_1::black"));
  assert.ok(g.nodes.has("cat_1::black::fat"));
  for (const triple of t.triples) {
    assert.ok(g.edges.has(edgeKey(triple)), `graph must hold the edge for ${JSON.stringify(triple)}`);
  }
});

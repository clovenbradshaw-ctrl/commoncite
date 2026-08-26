// eoreader6 · conformance/loops-self-holon — packages/engine/loops/self-holon.js's
// containment holarchy over a testimony ledger's own commits: wholes, parts,
// depth, cycles (none expected — geometrically impossible for well-formed
// regimes with distinct starts), and cascadingMismatch's reporting of which
// wholes rest on a part that just mismatched.
//
// Synthetic commit-shaped objects throughout (only `.regime` and identity
// matter to this module — commitTestimony's own contract, seriesExtent
// included, is conformance/loops-self.test.js's job, not this file's).

import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveTestimonyLevels, cascadingMismatch } from "../packages/engine/loops/self-holon.js";

const fake = (start, end, extra = {}) => Object.freeze({ sourceId: "s", regime: { start, end }, committedAt: 0, ...extra });

test("two disjoint commits are peers, both at depth 0", () => {
  const a = fake(0, 5);
  const b = fake(10, 15);
  const { levels, relations, cycles } = deriveTestimonyLevels([a, b]);
  assert.deepEqual(cycles, []);
  assert.equal(relations.length, 1);
  assert.equal(relations[0].relation, "peer");
  assert.equal(relations[0].earned_by, null);
  const depths = new Map(levels.map((l) => [l.commit, l.depth]));
  assert.equal(depths.get(a), 0);
  assert.equal(depths.get(b), 0);
});

test("a containing whole and its contained part earn a relation, part stays depth 0, whole is depth 1", () => {
  const whole = fake(0, 20);
  const part = fake(5, 10);
  const { levels, relations } = deriveTestimonyLevels([whole, part]);
  assert.equal(relations.length, 1);
  assert.equal(relations[0].relation, "a-whole-of-b");
  assert.equal(relations[0].earned_by, "contains");
  const depths = new Map(levels.map((l) => [l.commit, l.depth]));
  assert.equal(depths.get(part), 0);
  assert.equal(depths.get(whole), 1);
});

test("three levels of nesting produce three distinct depths, deepest part first", () => {
  const outer = fake(0, 30);
  const middle = fake(5, 20);
  const inner = fake(8, 12);
  const { levels } = deriveTestimonyLevels([outer, middle, inner]);
  const depths = new Map(levels.map((l) => [l.commit, l.depth]));
  assert.equal(depths.get(inner), 0);
  assert.equal(depths.get(middle), 1);
  assert.equal(depths.get(outer), 2);
});

test("touching but non-containing regimes (partial overlap, neither inside the other) are peers", () => {
  const a = fake(0, 10);
  const b = fake(5, 15);
  const { relations } = deriveTestimonyLevels([a, b]);
  assert.equal(relations[0].relation, "peer");
});

test("an identical regime is not its own containing whole (exact equality is excluded)", () => {
  const a = fake(0, 10);
  const b = fake(0, 10);
  const { relations } = deriveTestimonyLevels([a, b]);
  assert.equal(relations[0].relation, "peer");
});

test("cascadingMismatch is empty when nothing mismatched", () => {
  const whole = fake(0, 20);
  const part = fake(5, 10);
  assert.deepEqual(cascadingMismatch([whole, part], []), []);
});

test("cascadingMismatch reports a whole that contains a mismatched part, never re-tags the whole itself", () => {
  const whole = fake(0, 20);
  const part = fake(5, 10);
  const unrelated = fake(50, 55);
  const affected = cascadingMismatch([whole, part, unrelated], [part]);
  assert.equal(affected.length, 1);
  assert.equal(affected[0].commit, whole);
  assert.deepEqual(affected[0].restsOn, [part]);
});

test("cascadingMismatch never reports the mismatched commit as affected by itself", () => {
  const part = fake(5, 10);
  const affected = cascadingMismatch([part], [part]);
  assert.deepEqual(affected, []);
});

test("cascadingMismatch reports every whole in a nested chain above a deeply mismatched part", () => {
  const outer = fake(0, 30);
  const middle = fake(5, 20);
  const inner = fake(8, 12);
  const affected = cascadingMismatch([outer, middle, inner], [inner]);
  const affectedCommits = affected.map((a) => a.commit);
  assert.ok(affectedCommits.includes(outer));
  assert.ok(affectedCommits.includes(middle));
  assert.equal(affected.length, 2);
});

test("no containment cycle is ever found for well-formed regimes (geometrically impossible, checked rather than assumed)", () => {
  const a = fake(0, 30);
  const b = fake(5, 20);
  const c = fake(8, 12);
  const d = fake(100, 105);
  const { cycles } = deriveTestimonyLevels([a, b, c, d]);
  assert.deepEqual(cycles, []);
});

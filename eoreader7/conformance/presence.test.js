// eoreader6 · conformance/presence — perceiver/text/presence::admitReferent.
// No coverage existed before this suite: `events` and `fullText` were
// accepted parameters this function never read, so a referent's presence
// here was pure name-in-sentence matching against whatever `referent.surfaces`
// already listed, verbatim, and nothing else.

import { test } from "node:test";
import assert from "node:assert/strict";

import { admitReferent } from "../packages/engine/perceiver/text/presence.js";

test("with no events and no pronounBindings, behaviour is unchanged: the referent's own surfaces, deduped, name first", () => {
  const referent = { id: "ref:elena", name: "Elena", surfaces: ["Elena", "Elena", { surface: "Elena Marchetti", scope: { fromAnchor: "a", toAnchor: "b" } }] };
  const { referentId, surfaces } = admitReferent(undefined, referent);
  assert.equal(referentId, "ref:elena");
  assert.deepEqual(surfaces, [
    { surface: "Elena", scope: null },
    { surface: "Elena Marchetti", scope: { fromAnchor: "a", toAnchor: "b" } },
  ]);
});

test("FIXED: a DEF.admit event naming a surface the referent object did not carry is no longer silently dropped", () => {
  const referent = { id: "ref:elena", name: "Elena", surfaces: ["Elena"] };
  const events = [
    { type: "DEF.admit", referent_id: "ref:elena", surface: "Elena Marchetti" },
    { type: "DEF.admit", referent_id: "ref:marcus", surface: "Marcus" }, // a different referent — must not leak in
    { type: "CON.identity", referent_id: "ref:elena", surface: "should not match on type" },
  ];
  const { surfaces } = admitReferent(events, referent);
  const found = surfaces.map((s) => s.surface);
  assert.ok(found.includes("Elena Marchetti"), "the event's surface is folded in");
  assert.ok(!found.includes("Marcus"), "an event for a different referent must not leak in");
  assert.ok(!found.includes("should not match on type"), "only DEF.admit events are read");
});

test("FIXED: a scene carried only by a pronoun is now in here, scoped and tagged, never merged silently with a name", () => {
  const referent = { id: "ref:elena", name: "Elena", surfaces: ["Elena"] };
  const pronounBindings = [
    { referentId: "ref:elena", pronoun: "she", sentenceOrder: 30, offset: 30012, activation: 85.98, margin: 1 },
    { referentId: "ref:marcus", pronoun: "he", sentenceOrder: 34, offset: 34026, activation: 60.35, margin: 1 }, // a different referent
  ];
  const { surfaces } = admitReferent([], referent, { pronounBindings });
  const pronounEntry = surfaces.find((s) => s.surface === "she");
  assert.ok(pronounEntry, "the activation-bound pronoun is present");
  assert.equal(pronounEntry.resolved, "activation");
  assert.equal(pronounEntry.scope.sentenceOrder, 30);
  assert.equal(pronounEntry.activation, 85.98);
  assert.ok(!surfaces.some((s) => s.surface === "he"), "a binding for a different referent must not leak in");
});

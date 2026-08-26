// native/tests/return-curve.test.js — the kernel curve is omnimodal; the NL
// reading is the adapter's. Mirrors omnimodal-kernel.test.js's own posture:
// the same organ answers a musical question with no kernel change.

import test from "node:test";
import assert from "node:assert/strict";
import { returnCurve } from "../kernel/return-curve.js";
import { writerDecay, NL_FORMS, mentionEvents } from "../adapters/text/accessibility.js";

test("music: a theme restated fully after long gaps, fragmented up close — same kernel, no NL anywhere", () => {
  // a leitmotif: fragments within the phrase (gaps 1-2), full restatements
  // across sections (gaps 16+) — the composer's model of the listener.
  const events = [];
  let at = 0;
  for (let phrase = 0; phrase < 8; phrase += 1) {
    events.push({ key: "fate-motif", at, form: "full" });
    events.push({ key: "fate-motif", at: at + 1, form: "fragment" });
    events.push({ key: "fate-motif", at: at + 2, form: "fragment" });
    at += 16;
  }
  const curve = returnCurve(events);
  assert.deepEqual(curve.forms, ["fragment", "full"]);
  assert.equal(curve.majorityWindow.fragment, 1, "fragments are the majority only at tiny gaps");
  assert.ok(curve.majorityWindow.full >= 8, "full restatements own the long gaps");
});

test("forms are discovered from events — no declared vocabulary, any labels work", () => {
  const curve = returnCurve([
    { key: "k", at: 0, form: "close-up" },
    { key: "k", at: 1, form: "close-up" },
    { key: "k", at: 40, form: "re-establishing" },
  ]);
  assert.deepEqual(curve.forms, ["close-up", "re-establishing"]);
  assert.equal(curve.returns, 2);
});

test("co-arrival is not a return; bins are dyadic; malformed events are skipped, not guessed", () => {
  const curve = returnCurve([
    { key: "a", at: 5, form: "x" },
    { key: "a", at: 5, form: "x" },            // gap 0: not a return
    { key: "a", at: 6, form: "x" },            // gap 1 -> bin 1
    { key: "a", at: 11, form: "y" },           // gap 5 -> bin 4-7
    { key: null, at: 1, form: "x" },           // malformed
    { key: "b", at: NaN, form: "x" },          // malformed
  ]);
  assert.equal(curve.returns, 2);
  assert.deepEqual(curve.bins.map((b) => b.floor), [1, 4]);
  assert.equal(curve.bins[1].ceiling, 7);
});

test("NL adapter: the writer's activation window is the pronoun majority window; identity is the extreme-gap name share", () => {
  const mentions = [];
  // gap-1 returns as pronouns, gap-64 returns as names — the measured shape
  for (let i = 0; i < 12; i += 1) {
    const base = i * 64;
    mentions.push({ ref: "r", order: base, form: "name" });
    mentions.push({ ref: "r", order: base + 1, form: "pronoun" });
  }
  const out = writerDecay(mentions);
  assert.equal(out.activationWindow, 1);
  assert.equal(out.gamma, null, "a window of 1 has no decay rate to derive — full forgetting each tick");
  assert.equal(out.identityShareAtExtreme, 1, "extreme-gap returns are all names");
  assert.match(out.basis, /material \(no prior supplied\)/);
});

test("prior then material: the genre prior answers until the material holds more returns, and the supersession is reported", () => {
  const few = [
    { ref: "r", order: 0, form: "name" }, { ref: "r", order: 1, form: "pronoun" }, { ref: "r", order: 2, form: "pronoun" },
  ];
  const prior = { giver: "genre:gothic (measured on pg84)", activationWindow: 3, curve: { returns: 1828 } };
  const early = writerDecay(few, { prior });
  assert.equal(early.activationWindow, 3, "the prior answers while the material is thin");
  assert.match(early.basis, /prior \(genre:gothic/);
  const many = [];
  for (let i = 0; i < 2000; i += 1) { many.push({ ref: "r", order: i * 2, form: "name" }, { ref: "r", order: i * 2 + 1, form: "pronoun" }); }
  const late = writerDecay(many, { prior });
  assert.match(late.basis, /material: \d+ returns supersede/);
  assert.equal(late.activationWindow, 1, "the material's own answer now stands");
});

test("mentionEvents is a projection, nothing more", () => {
  assert.deepEqual(mentionEvents([{ ref: "a", order: 3, form: NL_FORMS.high }]), [{ key: "a", at: 3, form: "pronoun" }]);
});

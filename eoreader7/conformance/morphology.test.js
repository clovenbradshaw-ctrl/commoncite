// eoreader6 · morphology — the lemmatizer, and the two design decisions that
// are the whole reason it works.
//
// Both were got wrong here first, measured, and corrected against eoreader5's
// packages/def/morphology.js, which had already earned them:
//
//   · sameAct asks whether two forms' lemma SETS INTERSECT. It never picks a
//     lemma. Picking one by shortest-string gave `heard -> hea'`,
//     `found -> foind`, `seemed -> seeme` — UniMorph carries dialectal verbs,
//     so a tiebreak reliably prefers the dialect form over the word on the page.
//   · The suffix rule is part of the lookup, UNION with the table, not an
//     alternative to it. The prior holds only the irregular tail; every
//     fully-regular verb is absent by construction. Early-returning on a table
//     hit collapsed exactly 0 of 568 relation edges on Frankenstein.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createLemmatizer } from "../packages/engine/perceiver/text/morphology.js";

// A table shaped like the real prior: irregular tail only, ambiguity kept.
const TABLE = {
  lay: ["lie"], went: ["go"], brought: ["bring"], fled: ["flee"],
  spoke: ["speak"], saw: ["see", "saw"], said: ["say"], heard: ["hear"],
};

test("sameAct: the irregular pairs a suffix rule cannot reach", () => {
  const lem = createLemmatizer(TABLE);
  for (const [a, b] of [["lay", "lie"], ["went", "go"], ["brought", "bring"], ["fled", "flee"], ["spoke", "speak"], ["saw", "see"]]) {
    assert.ok(lem.sameAct(a, b), `${a} ~ ${b} must be the same act`);
  }
});

test("sameAct: regular inflection still works, because the rule is UNIONED in", () => {
  const lem = createLemmatizer(TABLE);
  // none of these lemmas are in the table at all — the rule must carry them
  for (const [a, b] of [["grasped", "grasp"], ["cries", "cry"], ["seemed", "seems"], ["appeared", "appears"], ["feared", "fears"]]) {
    assert.ok(lem.sameAct(a, b), `${a} ~ ${b} must be the same act`);
  }
});

test("sameAct: distinct acts stay distinct", () => {
  const lem = createLemmatizer(TABLE);
  for (const [a, b] of [["said", "saw"], ["loved", "hated"], ["went", "brought"]]) {
    assert.ok(!lem.sameAct(a, b), `${a} ~ ${b} must NOT be the same act`);
  }
});

test("ambiguity is preserved, never resolved", () => {
  const lem = createLemmatizer(TABLE);
  const ls = lem.lemmasOf("saw");
  assert.ok(ls.has("see") && ls.has("saw"), "both readings of `saw` must survive the lookup");
});

test("a missing prior is a typed gap and degrades loudly, not silently", () => {
  const lem = createLemmatizer(null);
  assert.ok(lem.gap, "no prior must report a gap");
  assert.equal(lem.gap.tier, "model");
  assert.ok(!lem.sameAct("went", "go"), "without the prior the irregular is NOT claimed to match");
  assert.ok(lem.sameAct("go", "go"), "identity still holds");

  const withFallback = createLemmatizer(null, { fallback: (a, b) => a.slice(0, 3) === b.slice(0, 3) });
  assert.ok(withFallback.sameAct("grasped", "grasping"), "an injected fallback is used when the prior is absent");
});

// AMENDED 2026-08-19 — the suffix rule is English, and a differently-
// declared language must not get it silently applied underneath its own
// table. This repo has no real non-English prior vendored yet, so the
// table below stands in for one — what matters is only that IT alone
// carries the match, not the ASCII suffix rule.
const NON_ENGLISH_TABLE = { luo: ["luso"] }; // a made-up irregular pair, unrelated to the suffix rule

test("language: omitted still runs the English suffix rule — the pinned default, unchanged by this amendment", () => {
  const lem = createLemmatizer(TABLE);
  assert.ok(lem.sameAct("grasped", "grasps"), "regular English inflection must still be recovered when language is unspecified");
});

test("language: 'eng' explicitly is the same as omitting it", () => {
  const lem = createLemmatizer(TABLE, { language: "eng" });
  assert.ok(lem.sameAct("grasped", "grasps"));
});

test("language: a declared NON-English prior gets its own table, never the English suffix rule", () => {
  const lem = createLemmatizer(NON_ENGLISH_TABLE, { language: "grc" });
  // the table's own irregular pair still resolves — a non-English prior's
  // OWN received forms are never refused, only the ASCII English rule is.
  assert.ok(lem.sameAct("luo", "luso"), "the declared prior's own table must still work");
  // but a pair that would ONLY match through the English suffix rule
  // (never through this tiny table) must NOT match once a non-English
  // language is declared — the exact failure this amendment closes.
  assert.ok(!lem.sameAct("grasped", "grasps"), "the English-only suffix rule must not fire under a declared non-English language");
});

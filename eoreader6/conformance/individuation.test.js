// eoreader6 · conformance/individuation — challenge #24's own claim, made
// real: a mass x coupling x agency classifier for the three
// INDIVIDUATION_TYPES slots ("apparatus" already had one; "field" stays
// definitionally unreachable) built from real, already-existing signals
// (pronounMentions/mentions coupling; a new subject-of-own-verbs agency
// read from perceiver/text/relations.js's real SVO extraction; a structural
// capitalisation test for emanon), calibrated against the SAME two real
// literary fixtures the audit's own adversarial script used — not invented
// for this test to pass.
//
// OUT OF SCOPE, DELIBERATELY (see the audit's own finding and the plan this
// implements): discovering "the creature" from raw text with NO prior at
// all. surfaces.js's own header records that exact descriptor-coreference
// problem failing twice already in a prior version of this codebase — this
// suite does not attempt it, and none of the tests below expect it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSession, admitChunked, sessionReferents } from "../packages/host/corpus.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = join(ROOT, "scripts/adversarial/fixtures");
const readFixture = (name) => readFileSync(join(FIX, name), "utf8").replace(/\r\n/g, "\n");

const sessionOf = (text) => {
  const session = createSession();
  admitChunked(session, { text, sourceId: "s" });
  return session;
};

test("Heart of Darkness, no prior: Kurtz — heavily orbited, physically absent until Part III — classifies protogon", () => {
  const hod = readFixture("heart-of-darkness.txt");
  const { referents } = sessionReferents(sessionOf(hod), { sourceId: "s", priors: [], limit: 500 });
  const kurtz = referents.find((r) => r.surfaces.some((s) => String(s).toLowerCase() === "kurtz"));
  assert.ok(kurtz, "precondition: Kurtz is discovered at all (he has a capitalised proper name)");
  assert.equal(kurtz.individuation, "protogon");
  assert.ok(kurtz.coupling > 1, "coupling (pronoun-bound / named mentions) must clear the measured crossing point");
  assert.equal(typeof kurtz.agency, "number", "agency is reported evidence even though it doesn't gate this decision");
});

test("Frankenstein, no prior: ordinarily-present named characters classify holon, not protogon", () => {
  const frank = readFixture("pg84-frankenstein.txt");
  const { referents } = sessionReferents(sessionOf(frank), { sourceId: "s", priors: [], limit: 500 });
  for (const name of ["Victor", "Elizabeth"]) {
    const ref = referents.find((r) => r.display === name);
    assert.ok(ref, `precondition: ${name} is discovered`);
    assert.equal(ref.individuation, "holon", `${name} must not be classified protogon`);
  }
});

test("the creature prior, with its individuation field stripped, still computes emanon — not the old silent 'holon' default", () => {
  const frank = readFixture("pg84-frankenstein.txt");
  const coref = JSON.parse(readFileSync(join(FIX, "pg84-frankenstein.coref.json"), "utf8"));
  const creaturePrior = coref.referents.find((r) => r.id === "creature");
  assert.ok(creaturePrior, "precondition: the fixture has a creature prior");

  const stripped = { ...creaturePrior, individuation: undefined };
  const { referents } = sessionReferents(sessionOf(frank), { sourceId: "s", priors: [stripped], limit: 500 });
  const creature = referents.find((r) => r.id === "creature");
  assert.ok(creature, "precondition: the prior's surfaces are counted at all");
  assert.equal(
    creature.individuation,
    "emanon",
    "stripping the prior's own individuation field must still land on emanon by computation — the audit's own finding was that this used to silently report 'holon' with zero other change",
  );
});

test("an EXPLICIT prior individuation is never second-guessed — witness knowledge still wins outright", () => {
  const frank = readFixture("pg84-frankenstein.txt");
  const coref = JSON.parse(readFileSync(join(FIX, "pg84-frankenstein.coref.json"), "utf8"));
  const creaturePrior = coref.referents.find((r) => r.id === "creature");
  const relabelled = { ...creaturePrior, individuation: "holon" }; // a deliberately WRONG hand-authored label
  const { referents } = sessionReferents(sessionOf(frank), { sourceId: "s", priors: [relabelled], limit: 500 });
  const creature = referents.find((r) => r.id === "creature");
  assert.equal(creature.individuation, "holon", "an explicit prior assertion is received, not computed over, even when this classifier would have disagreed");
});

test("control — a referent with too little mass to trust any ratio stays null, never a guess", () => {
  // Heart of Darkness's own Marlow: first-person narrator, so his third-
  // person NAME is used only a handful of times (mentions=10, below
  // MASS_FLOOR=15) — real, measured, not a constructed corner case.
  const hod = readFixture("heart-of-darkness.txt");
  const { referents } = sessionReferents(sessionOf(hod), { sourceId: "s", priors: [], limit: 500 });
  const marlow = referents.find((r) => r.display === "Marlow");
  assert.ok(marlow, "precondition: Marlow is discovered at all");
  assert.ok(marlow.mentions < 15, "precondition: this really is the low-mass case, not a stand-in");
  assert.equal(marlow.individuation, null, "too little naming evidence must gap to null, not guess a type");
});

// native/tests/construction.test.js — the collapse organ at its walls,
// against the REAL received priors (no stubs): POSPrior@1 from UD EWT and
// ConstructionPrior@1 built from the same treebank by
// native/scripts/build-construction-prior.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { collapseForm, dominantClass } from "../adapters/text/construction.js";

const formPrior = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
const constructionPrior = JSON.parse(fs.readFileSync(new URL("../priors/construction-eng.json", import.meta.url), "utf8"));
const opts = (minShare) => ({ constructionPrior, formPrior, minShare });

test("the form-level prior holds `had` in superposition — the fact the gate destroys", () => {
  assert.deepEqual(formPrior.forms.had, { AUX: 154, VERB: 335 });
  assert.ok((formPrior.forms.had.VERB > formPrior.forms.had.AUX),
    "and it destroys it toward VERB, which is why `the murder had been committed` reads as agency");
});

test("`had` before a participle collapses AUX — the passive the type-level test admits", () => {
  // "the murder had been committed": the frame is the class of `been`, AUX.
  assert.equal(dominantClass("been", formPrior), "AUX");
  const out = collapseForm("had", "been", opts(2 / 3));
  assert.equal(out.standing, "collapsed");
  assert.equal(out.cls, "AUX");
  assert.equal(out.basis, "construction");
  assert.ok(out.share > 0.85, `expected a decisive cell, got ${out.share}`);
});

test("`had` before a determiner collapses VERB — the SAME form, the other reading", () => {
  const out = collapseForm("had", "the", opts(2 / 3));
  assert.equal(out.standing, "collapsed");
  assert.equal(out.cls, "VERB");
  assert.equal(out.frame, "DET");
  // the whole point: one form, two occurrences, two classes, context deciding
  assert.notEqual(out.cls, collapseForm("had", "been", opts(2 / 3)).cls);
});

test("a cell that does not clear minShare stays LIVE — the superposition did not collapse", () => {
  // driven from the real book: "the appearance of the city had yet ..." —
  // frame ADV, and had|ADV is genuinely divided.
  const out = collapseForm("had", "yet", opts(2 / 3));
  assert.equal(out.frame, "ADV");
  assert.equal(out.standing, "live");
  assert.equal(out.cls, null, "a live reading names no class — it withholds rather than guessing");
  assert.ok(out.share < 2 / 3);
});

test("minShare is declared, never defaulted", () => {
  assert.throws(() => collapseForm("had", "been", { constructionPrior, formPrior }), /declared/);
  assert.throws(() => collapseForm("had", "been", opts(0)), /declared/);
  assert.throws(() => collapseForm("had", "been", opts(1.5)), /declared/);
});

test("an unattested form is a typed gap, never a guess", () => {
  const out = collapseForm("zzzznotaword", "been", opts(2 / 3));
  assert.equal(out.standing, "gap");
  assert.equal(out.cls, null);
  assert.equal(out.basis, "unattested");
});

test("backoff to the form level is disclosed as a weaker basis, never mixed with the construction", () => {
  // `became` is unambiguous in the treebank, so it has no conditional cells
  // at all — the ladder must fall through and SAY it fell through.
  assert.equal(constructionPrior.forms.became, undefined);
  const out = collapseForm("became", "perfectly", opts(2 / 3));
  assert.equal(out.basis, "form");
  assert.equal(out.cls, "VERB");
  assert.equal(out.standing, "collapsed");
});

test("the end of a sentence is a frame, not a missing value", () => {
  const out = collapseForm("had", null, opts(2 / 3));
  assert.equal(out.frame, constructionPrior.declared.sentenceEndFrame);
});

test("the received prior names its giver and its licence", () => {
  assert.match(constructionPrior.provenance.giver, /Universal Dependencies/);
  assert.equal(constructionPrior.provenance.license, "CC BY-SA 4.0");
  assert.equal(constructionPrior.declared.MIN_OBSERVATIONS, 2);
});

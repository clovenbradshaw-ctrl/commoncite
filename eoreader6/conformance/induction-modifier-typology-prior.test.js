// eoreader6 · bin/priors/modifier-order/en-induced.json — conformance
//
// This is the baked, standing artifact induction/stacks.js's real
// live_priors run produces (see conformance/induction-stacks-live-text
// .test.js and scripts/induction-stacks-live-priors.mjs for the run
// itself). induction/typology.js's own header insists this pipeline runs
// once, over a corpus of priors, never per-reading — this file is that
// "once," baked to data and staged in bin/ exactly like
// bin/priors/lang/en.json already is (SEED.md's own bin/ discipline: data
// only, no code, transferable to eoPriors intact). These tests hold the
// baked file to the same shape modifier-order/index.js requires of any
// typology, WALS-derived, hand-written, or induced.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { admissibleTypology, order, toEvents } from "../modifier-order/index.js";
import { tagSequence } from "../induction/typology.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const priorPath = join(root, "bin/priors/modifier-order/en-induced.json");

test("the baked prior is valid JSON with the required provenance fields", () => {
  const prior = JSON.parse(readFileSync(priorPath, "utf8"));
  assert.equal(prior.schema, "ModifierTypologyPrior@1");
  assert.equal(typeof prior.population, "string");
  assert.ok(prior.population.length > 0);
  assert.equal(typeof prior.provenance?.source, "string");
  assert.ok(Array.isArray(prior.notes) && prior.notes.length > 0, "a narrow-coverage prior must disclose its own limitation, not just carry data");
});

test("the baked prior is directly admissible to modifier-order/index.js — no reshaping needed", () => {
  const prior = JSON.parse(readFileSync(priorPath, "utf8"));
  const bad = admissibleTypology(prior);
  assert.equal(bad, null, `expected admissible, got ${JSON.stringify(bad)}`);
});

test("order()/toEvents() nest, invert, and mint real events from the baked prior, exactly as the live run did", () => {
  const prior = JSON.parse(readFileSync(priorPath, "utf8"));

  const nested = order(tagSequence(["mock", "turtle"], prior), prior);
  assert.equal(nested.relation, "nested");

  const inverted = order(tagSequence(["turtle", "mock"], prior), prior);
  assert.equal(inverted.relation, "inverted");

  const events = toEvents(tagSequence(["mock", "turtle"], prior), prior, { head: "creature" });
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.type === "SEG.narrow"));
});

test("a token outside the baked prior's narrow coverage is refused, never guessed", () => {
  const prior = JSON.parse(readFileSync(priorPath, "utf8"));
  const tags = tagSequence(["fat", "black", "turtle"], prior);
  assert.equal(tags[0].class, null, "'fat' was never induced from this corpus and must not be silently classified");
  const result = order(tags, prior);
  assert.equal(result.gap, "undeclared", "an untagged token must refuse the whole sequence, not be dropped");
});

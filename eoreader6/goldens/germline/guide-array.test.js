// eoreader6 · goldens/germline — the guide array: memory as retrieval,
// selection every time. Run: node --test goldens/germline/guide-array.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  receiveGuideArray,
  selectGuide,
  appendEntry,
  entryId,
} from "../../packages/host/guide-array.js";
import { PERCEIVER_TEMPLATE, germline } from "../../packages/host/germline.js";
import { isGap } from "../../nul/index.js";

const here = (p) => new URL(p, import.meta.url).pathname;
const ARRAY = JSON.parse(readFileSync(here("../../bin/priors/germline/guide-array.json"), "utf8"));
const FIXTURE = here("../../scripts/adversarial/fixtures/frankenstein-excerpt.txt");

test("the seeded array is receivable and carries survivors and refusals with equal weight", () => {
  const r = receiveGuideArray(ARRAY);
  assert.equal(isGap(r), false);
  const survivors = r.entries.filter((e) => e.outcome.survived);
  const refusals = r.entries.filter((e) => !e.outcome.survived);
  assert.equal(survivors.length, 1);
  assert.equal(refusals.length, 2);
  for (const e of r.entries) assert.ok(e.giver, "every entry names its giver");
});

test("retrieval finds the surviving words guide for a word-shaped task — refusals are never exemplars", () => {
  const v = selectGuide(ARRAY, "reduce each word of the text to its character length");
  assert.equal(isGap(v), false);
  assert.equal(v.entry.outcome.survived, true);
  assert.equal(v.mustReEarn, true);
});

test("an unrelated task is no_candidate — a result, not an error", () => {
  const v = selectGuide(ARRAY, "spectrogram chroma pitch");
  assert.equal(v.gap, "no_candidate");
});

test("a survivor pinned to another germline version is refused, never silently applied", () => {
  const pinned = {
    ...ARRAY,
    entries: ARRAY.entries.map((e) =>
      e.outcome.survived ? { ...e, germline_version: "germline@99" } : e),
  };
  const v = selectGuide(pinned, "reduce each word of the text to its character length");
  assert.equal(v.gap, "unknown_spec");
  assert.equal(v.reason, "reader_version_mismatch");
});

test("appendEntry is pure, complete-or-refused, and idempotent by content id", () => {
  const entry = {
    template: "perceiver", germline_version: "germline@0",
    task: "unit test entry", fillings: { a: "return 1;" },
    giver: "guide-array.test.js",
    outcome: { survived: false, gap: "not_earned" },
  };
  const missing = appendEntry(ARRAY, { ...entry, giver: undefined });
  assert.equal(missing.gap, "undeclared");
  const once = appendEntry(ARRAY, entry);
  assert.equal(once.entries.length, ARRAY.entries.length + 1);
  const twice = appendEntry(once, entry);
  assert.equal(twice.entries.length, once.entries.length, "same content, same id, no duplicate");
  assert.equal(once.entries.at(-1).id, entryId(entry));
});

test("memory never bypasses selection: the retrieved survivor re-earns through the gates on this fixture", async () => {
  const v = selectGuide(ARRAY, "the character length of each word read so far");
  assert.equal(isGap(v), false);
  const verdict = await germline(PERCEIVER_TEMPLATE, v.entry.fillings, {
    giver: `guide-array:${v.entry.id} (re-earned)`,
    fixturePath: FIXTURE,
  });
  assert.equal(isGap(verdict), false);
  assert.deepEqual([...verdict.cleared], ["imports", "contract", "behavior", "physics"]);
});

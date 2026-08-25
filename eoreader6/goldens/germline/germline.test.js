// eoreader6 · goldens/germline — the germline path's refusals and its one
// full pass, pinned. Run: node --test goldens/germline/germline.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PERCEIVER_TEMPLATE,
  instantiate,
  clearGates,
  germline,
} from "../../packages/host/germline.js";
import { isGap } from "../../nul/index.js";

const FIXTURE = new URL(
  "../../scripts/adversarial/fixtures/frankenstein-excerpt.txt",
  import.meta.url,
).pathname;

// The reference guide: a lines perceiver. Units are the file's lines;
// the reduced series is byte length per line read so far.
const LINES_FILLINGS = {
  load_body: "return text.split('\\n').filter((l) => l.trim().length > 0);",
  unit_count_expr: "units.length",
  reduce_body: "return units.slice(0, readTo).map((l) => l.length);",
};
const GIVER = "goldens/germline/germline.test.js";

test("a missing hole is undeclared — the enzyme does not cut", () => {
  const v = instantiate(PERCEIVER_TEMPLATE, { load_body: "return [];" }, { giver: GIVER });
  assert.equal(v.gap, "undeclared");
  assert.match(v.what, /unit_count_expr|filling/);
});

test("an unknown hole is unknown_spec, with the template's holes attached", () => {
  const v = instantiate(
    PERCEIVER_TEMPLATE,
    { ...LINES_FILLINGS, extra_hole: "1" },
    { giver: GIVER },
  );
  assert.equal(v.gap, "unknown_spec");
  assert.ok(v.known.includes("load_body"));
});

test("a filling carrying a clock, I/O, or an import is refused by the complementarity scan", () => {
  for (const poison of [
    "return [Date.now()];",
    "return require('fs').readdirSync('.');",
    "const m = await import('node:fs'); return [];",
    "return [Math.random()];",
    "return fetch('http://x');",
  ]) {
    const v = instantiate(
      PERCEIVER_TEMPLATE,
      { ...LINES_FILLINGS, load_body: poison },
      { giver: GIVER },
    );
    assert.equal(v.gap, "unknown_spec", poison);
    assert.match(v.reason, /forbidden token/);
  }
});

test("a statements hole without a return is refused at the scan, before assembly", () => {
  const v = instantiate(
    PERCEIVER_TEMPLATE,
    { ...LINES_FILLINGS, load_body: "const units = text.split('|');" },
    { giver: GIVER },
  );
  assert.equal(v.gap, "undeclared");
  assert.match(v.why, /no return, no result/);
});

test("a candidate with no giver is unreceived_origin", () => {
  const v = instantiate(PERCEIVER_TEMPLATE, LINES_FILLINGS, {});
  assert.equal(v.gap, "unreceived_origin");
});

test("broken syntax is refused at the imports gate, not thrown", async () => {
  const c = instantiate(
    PERCEIVER_TEMPLATE,
    { ...LINES_FILLINGS, reduce_body: "return units.slice(0, readTo" },
    { giver: GIVER },
  );
  assert.equal(isGap(c), false);
  const v = await clearGates(c, { fixturePath: FIXTURE });
  assert.equal(v.gap, "not_earned");
  assert.equal(v.gate, "imports");
});

test("a non-numeric series is refused at the behavior gate", async () => {
  const c = instantiate(
    PERCEIVER_TEMPLATE,
    { ...LINES_FILLINGS, reduce_body: "return units.slice(0, readTo);" },
    { giver: GIVER },
  );
  const v = await clearGates(c, { fixturePath: FIXTURE });
  assert.equal(v.gap, "not_earned");
  assert.equal(v.gate, "behavior");
});

test("a fraction that yields MORE is refused — reading less never shows more", async () => {
  const c = instantiate(
    PERCEIVER_TEMPLATE,
    {
      ...LINES_FILLINGS,
      reduce_body:
        "return (readTo < units.length ? units.concat(units) : units.slice(0, readTo)).map((l) => l.length);",
    },
    { giver: GIVER },
  );
  const v = await clearGates(c, { fixturePath: FIXTURE });
  assert.equal(v.gap, "not_earned");
  assert.equal(v.gate, "behavior");
  assert.match(v.why, /never yield more/);
});

test("gates without a fixture are refused — behavior is judged against material", async () => {
  const c = instantiate(PERCEIVER_TEMPLATE, LINES_FILLINGS, { giver: GIVER });
  const v = await clearGates(c, {});
  assert.equal(v.gap, "undeclared");
  assert.equal(v.what, "fixturePath");
});

test("the reference guide clears all four gates and the organ feeds real physics", async () => {
  const v = await germline(PERCEIVER_TEMPLATE, LINES_FILLINGS, {
    giver: GIVER,
    fixturePath: FIXTURE,
  });
  assert.equal(isGap(v), false);
  assert.deepEqual([...v.cleared], ["imports", "contract", "behavior", "physics"]);
  assert.ok(v.series.extent >= 2);
  assert.ok(v.series.halfExtent <= v.series.extent);
  // the instantiated organ is a live perceiver: load + reduce round-trips
  const units = await v.organ.load(FIXTURE);
  const series = v.organ.reduce(units, { fraction: 1 });
  assert.equal(series.length, v.series.extent);
  // provenance is in the artifact, not just the record
  assert.match(v.candidate.source, /giver: goldens\/germline/);
});

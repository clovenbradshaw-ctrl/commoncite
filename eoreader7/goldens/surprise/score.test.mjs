// eoreader6 · goldens/surprise/score.test — regression-locks the observed
// verdicts in fixtures.json against real code. A fixture whose `observed`
// disagrees with a fresh run has DRIFTED — either the detector changed (say
// so in the fixture) or something broke silently, and this is what catches
// the difference.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { numericVerdict, temporalVerdict, rowFormVerdict, ngramProfileVerdict, benfordVerdict, recurrenceVerdict, projectionVerdict } from "./detectors.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(readFileSync(join(HERE, "fixtures.json"), "utf8"));

const runOne = (c) => {
  switch (c.axis) {
    case "numeric": return numericVerdict(c.series);
    case "temporal": return temporalVerdict(c.series);
    case "rowForm": return rowFormVerdict(c.rows);
    case "ngramProfile": return ngramProfileVerdict(c.paragraphs);
    case "benford": return benfordVerdict(c.suspectCounts);
    case "recurrence": return recurrenceVerdict(c.tokens);
    case "projection": return projectionVerdict(c.rows);
    default: return { verdict: "not-applicable" };
  }
};

test("every engine/mixed-tier case reproduces its locked observed verdict", () => {
  for (const c of FIXTURES.cases) {
    if (c.tier === "not-applicable" || c.tier === "out-of-scope") continue;
    const r = runOne(c);
    assert.equal(r.verdict, c.observed.verdict, `${c.id}: expected verdict "${c.observed.verdict}", got "${r.verdict}"`);
  }
});

test("no model-tier case is confabulated by a purely structural detector", () => {
  // The discipline this golden exists to enforce: absent an injected witness
  // prior (world knowledge, domain knowledge), structural detectors must
  // either find nothing or find only an honestly-labeled structural echo —
  // never a semantic verdict they have no basis for.
  const modelCases = FIXTURES.cases.filter((c) => c.tier === "model");
  assert.ok(modelCases.length > 0, "must exercise at least one model-tier case");
  for (const c of modelCases) {
    const r = runOne(c);
    assert.ok(
      r.verdict === "none" || r.verdict === "gap" || c.observed.caveat,
      `${c.id} was flagged ("${r.verdict}") with no caveat explaining the structural (not semantic) basis`,
    );
  }
});

test("B8 demonstrates the one-sided blind spot this golden was built to expose", () => {
  const c = FIXTURES.cases.find((x) => x.id === "B8");
  const r = numericVerdict(c.series);
  assert.equal(r.verdict, "none", "raw one-sided reading should miss a below-average anomaly");
  assert.ok(r.highRank > 0.2, "the low value should not even register on the high-side statistic");
});

test("B6-S3's frozen sensor is refused, not silently passed", () => {
  const c = FIXTURES.cases.find((x) => x.id === "B6-S3");
  const r = numericVerdict(c.series);
  assert.equal(r.verdict, "gap");
  assert.equal(r.gap, "degenerate_ground");
});

test("A7 without a lexicon prior honestly refuses rather than guessing", () => {
  const c = FIXTURES.cases.find((x) => x.id === "A7");
  const r = projectionVerdict(c.rows);
  assert.equal(r.verdict, "gap");
  assert.equal(r.gap, "insufficient_material");
});

// Skips gracefully off-machine: the received prior is a real, named, external
// dictionary, not something bundled into the repo — the same discipline as
// treating Benford's Law as received rather than derived. If it isn't present
// this proves nothing about the mechanism and should not fail the suite.
const DICT_PATH = "/usr/share/dict/words";
test("A7 WITH a received dictionary prior decodes uniquely to FIND+ME", { skip: !existsSync(DICT_PATH) && "no system dictionary at /usr/share/dict/words" }, () => {
  const c = FIXTURES.cases.find((x) => x.id === "A7");
  const lexicon = new Set(readFileSync(DICT_PATH, "utf8").split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean));
  const r = projectionVerdict(c.rows, { lexicon });
  assert.equal(r.verdict, "segmented");
  assert.equal(r.segmentable.length, 1, "must be uniquely selective among this poem's own axes, not one hit among many");
  assert.equal(r.segmentable[0].axis, "pos0");
  assert.deepEqual(r.segmentable[0].words, ["find", "me"]);
});

test("the projection axis correctly finds a NON-lexical statistical cipher a dictionary cannot", () => {
  let seed = 1;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const cycle = "thequickbrownfoxjumps";
  const rows = [];
  for (let i = 0; i < 300; i++) {
    let row = "";
    for (let k = 0; k < 40; k++) row += k === 5 ? cycle[i % cycle.length] : alphabet[Math.floor(next() * 26)];
    rows.push(row);
  }
  const r = projectionVerdict(rows);
  assert.equal(r.verdict, "structured-axis");
  const structured = r.results.filter((x) => x.structured).map((x) => x.axis);
  assert.deepEqual(structured, ["pos5"]);
});

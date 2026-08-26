// eoreader6 · conformance/consolidation — challenge #13's own question,
// promoted from a one-off adversarial probe to a permanent regression:
// repeated "dreaming"/consolidation cycles over a FIXED corpus, with no new
// ballast between cycles, must never narrow what the reader believes.
//
// Fixture is the SAME Emma-relations TERMS/OPTS conformance/kinds.test.js
// already pins (not re-invented — a corpus already measured to induce a
// real, gate-clearing paradigm), and the SAME goldens/kinds/synthesize.mjs
// symphony composition challenge-13's own Experiment 2 used for the
// positive control, so nothing here is a fixture invented for this test
// alone to pass.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isGap } from "../nul/index.js";
import { consolidate } from "../packages/engine/emergence/consolidate.js";
import { composeKinds, MODALITIES } from "../goldens/kinds/synthesize.mjs";

const A = (field_id, count = 1) => ({ field_id, value_type: "boolean", count });
const TERMS = [
  { id: "term:sister", label: "sister", attributes: [A("anchor_shared", 3)] },
  { id: "term:brother", label: "brother", attributes: [A("anchor_shared", 2)] },
  { id: "term:daughter", label: "daughter", attributes: [A("anchor_shared")] },
  { id: "term:father", label: "father", attributes: [A("anchor_shared")] },
  { id: "term:mother", label: "mother", attributes: [A("anchor_shared")] },
  { id: "term:wife", label: "wife", attributes: [A("anchor_shared")] },
  { id: "term:husband", label: "husband", attributes: [A("anchor_shared")] },
  { id: "term:sister-in-law", label: "sister-in-law", attributes: [A("anchor_shared"), A("stem_shared")] },
  { id: "term:in-love-with", label: "in-love-with", attributes: [A("subject_shared", 2)] },
  { id: "term:violent-love", label: "violent-love", attributes: [A("subject_shared")] },
  { id: "term:pretended-love", label: "pretended-love", attributes: [A("subject_shared")] },
  { id: "term:falling-in-love", label: "falling-in-love", attributes: [A("subject_shared")] },
  { id: "term:love-at-first-sight", label: "love-at-first-sight", attributes: [A("subject_shared")] },
  { id: "term:not-in-love", label: "not-in-love", attributes: [A("subject_shared")] },
  { id: "term:friend", label: "friend", attributes: [] },
];
const OPTS = { population: "emma-v1-relations", minPrevalence: 0.25, minKindSize: 3, permutations: 200, quantile: 0.95, reseeds: 24, seed: 42 };

const labelsOf = (kinds) => kinds.map((k) => k.label).sort();

test("consolidate() establishes a paradigm on the first cycle (no prior — nothing to refuse yet)", () => {
  const first = consolidate(TERMS, OPTS, {});
  assert.equal(first.consolidated, false, "establishing a first paradigm is not itself a re-zero");
  assert.equal(first.refusal, null);
  assert.equal(first.rezero, null);
  assert.ok(first.paradigm.length > 0, "a real paradigm was induced from a real fixture");
});

test("repeated cycles on a FIXED corpus, no new ballast, never narrow the paradigm — and do nothing at all past cycle 1", () => {
  const CYCLES = 8;
  let paradigm = consolidate(TERMS, OPTS, {}).paradigm;
  const baseline = labelsOf(paradigm);
  assert.ok(baseline.length > 0, "precondition: a real paradigm exists to hold the line on");

  const results = [];
  for (let c = 0; c < CYCLES; c++) {
    const r = consolidate(TERMS, OPTS, { paradigm });
    results.push(r);
    paradigm = r.paradigm;
  }

  assert.ok(results.every((r) => r.consolidated === false), "no cycle re-zeroed — the fixed corpus never gave it a reason to");
  assert.ok(
    results.every((r) => !isGap(r.refusal) === true || r.refusal === null),
    "every cycle's refuseParadigm call reported the paradigm holds, never an unravel",
  );
  assert.ok(
    results.every((r) => JSON.stringify(labelsOf(r.paradigm)) === JSON.stringify(baseline)),
    `paradigm vocabulary must stay byte-identical across ${CYCLES} cycles on static material — saw drift`,
  );
});

test("control — a genuinely different, coherent frame DOES trigger a real re-zero, and the re-zero holds the loss", () => {
  const oldParadigm = consolidate(TERMS, OPTS, {}).paradigm;
  assert.ok(oldParadigm.length > 0);

  // A composed corpus sharing ZERO field_ids with the Emma-relations schema
  // (pitch_hz/duration_ms/dynamics/timbre/articulation vs. anchor_shared/
  // subject_shared/stem_shared) — the old paradigm's cores cannot place a
  // single one of these records, and the composition is built specifically
  // to be independently coherent (n=4 ground-truth kinds), so this is a real
  // "coherent material the paradigm has nothing to say about" case, not
  // noise dressed up as a frame.
  const { records: SYMPHONY } = composeKinds({
    n: 4, schema: MODALITIES.symphony, membersPerKind: 8, keyOverlap: 1, valueDivergence: 1, withinSpread: 0.25, seed: 7,
  });
  const OPTS2 = { population: "composed", minPrevalence: 0.25, minKindSize: 3, permutations: 200, quantile: 0.95, reseeds: 24, seed: 7 };

  const result = consolidate(SYMPHONY, OPTS2, { paradigm: oldParadigm });

  assert.ok(isGap(result.refusal), "the old paradigm's cores really do place none of the new frame's records");
  assert.equal(result.refusal.gap, "paradigm_unraveled");
  assert.equal(result.consolidated, true, "a genuine unravel must actually re-zero, not just detect");
  assert.ok(!isGap(result.rezero) && result.rezero.rezeroed === true);
  assert.ok(result.paradigm.length > 0, "the re-zeroed paradigm is a real, non-empty induction over the new frame");
});

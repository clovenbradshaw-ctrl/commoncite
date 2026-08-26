import test from "node:test";
import assert from "node:assert/strict";
import { deriveRhythmPrior, mergeRhythmPriors, composeExperience, scoreRhythmExpectations, readingGaps } from "../kernel/rhythm-priors.js";
import { deriveExperiencePrior } from "../kernel/experience-priors.js";

// A completed reading, in the shape both prior modules consume. Mentions
// carry their read position exactly as recursive.js constructs them.
const mention = (pos, ref) => ({ schema: "EOMention@1", id: `mention:${pos}:${ref}`, referent: `ref:${ref}`, witness: `text:${pos}` });
const reading = (source, positionsByRef, relation = "admired") => ({
  source,
  fold: {
    graphEntries: [
      { schema: "EOHyperedge@1", id: `edge:${source}`, relation, meta: { compositionStanding: { eligible: true } } },
      ...Object.entries(positionsByRef).flatMap(([ref, positions]) => positions.map((p) => mention(p, ref))),
    ],
    transformationObjects: [{ schema: "EOOperation@1", id: `op:${source}`, operator: "CON", stance: "Tracing" }],
  },
});

test("gaps are read off the mention stream per referent, never across referents", () => {
  const gaps = readingGaps(reading("book:a", { alice: [0, 3, 4], bob: [1, 11] }));
  assert.deepEqual(gaps, [1, 3, 10], "alice: 3,1 — bob: 10 — and never alice->bob");
});

test("a rhythm prior is declared, giver-named, and never witness", () => {
  assert.throws(() => deriveRhythmPrior([]), /named giver/);
  assert.throws(() => deriveRhythmPrior([reading("book:a", { alice: [0, 2] })], { giver: "r", minWorkSupport: 0 }), /positive integer/);
  const prior = deriveRhythmPrior([reading("book:a", { alice: [0, 2, 4, 6] })], { giver: "reader:test" });
  assert.equal(prior.schema, "EORhythmPrior@1");
  assert.equal(prior.medianGap, 2);
  assert.equal(prior.gapCount, 3);
  assert.equal(prior.witnessed, false, "a memory is never witness");
  assert.equal(prior.admissible, false);
  assert.equal(prior.standing, "defeasible_experience_prior");
  assert.deepEqual(prior.sourceRefs, ["book:a"]);
});

test("cross-work recurrence strengthens a rhythm memory exactly as it does a structural one", () => {
  const one = deriveRhythmPrior([reading("book:a", { alice: [0, 2] })], { giver: "r" });
  assert.equal(one.memoryStanding, "single_work_memory");
  const two = deriveRhythmPrior([reading("book:a", { alice: [0, 2] }), reading("book:b", { bob: [0, 2] })], { giver: "r" });
  assert.equal(two.memoryStanding, "recurrent_cross_work_memory");
  const bucket = two.gapHistogram.find((x) => x.gap === 2);
  assert.equal(bucket.workSupport, 2);
  assert.deepEqual(bucket.sourceRefs, ["book:a", "book:b"]);
});

test("merging per-book rhythm priors is EXACT against deriving from every raw reading at once", () => {
  // The differential property PR #17's own merge test establishes for the
  // structural half, held to identically here — not merely "doesn't crash".
  const a = reading("book:a", { alice: [0, 2, 5], carol: [1, 9] });
  const b = reading("book:b", { bob: [0, 1, 2, 8] });
  const c = reading("book:c", { dave: [3, 6, 7] });

  const atOnce = deriveRhythmPrior([a, b, c], { giver: "r", id: "combined" });
  const merged = mergeRhythmPriors(
    [deriveRhythmPrior([a], { giver: "r" }), deriveRhythmPrior([b], { giver: "r" }), deriveRhythmPrior([c], { giver: "r" })],
    { giver: "r", id: "combined" },
  );
  assert.equal(merged.medianGap, atOnce.medianGap);
  assert.equal(merged.gapCount, atOnce.gapCount);
  assert.deepEqual(merged.sourceRefs, atOnce.sourceRefs);
  assert.deepEqual(merged.gapHistogram, atOnce.gapHistogram, "byte-identical histograms, sourceRefs included");
});

test("the two halves compose into one carried experience without either being rewritten", () => {
  const experience = deriveExperiencePrior([reading("book:a", { alice: [0, 2] })], { giver: "reader:test" });
  const rhythm = deriveRhythmPrior([reading("book:b", { bob: [0, 3] })], { giver: "reader:test" });
  const composed = composeExperience({ experience, rhythm, giver: "reader:test" });

  assert.equal(composed.schema, "EOReaderExperience@1");
  assert.deepEqual(composed.carries, ["which", "when"]);
  assert.deepEqual(composed.sourceRefs, ["book:a", "book:b"], "the union is the honest answer to what this reader has read");
  assert.equal(composed.experience, experience, "the structural half is carried untouched, not copied or rewritten");
  assert.equal(composed.rhythm, rhythm);
  assert.equal(composed.witnessed, false);

  // Either half alone is legitimate; neither-half is not.
  assert.deepEqual(composeExperience({ experience, giver: "r" }).carries, ["which"]);
  assert.deepEqual(composeExperience({ rhythm, giver: "r" }).carries, ["when"]);
  assert.throws(() => composeExperience({ giver: "r" }), /at least one half/);
  assert.throws(() => composeExperience({ experience, rhythm }), /named giver/);
  assert.throws(() => composeExperience({ experience: rhythm, giver: "r" }), /EOExperiencePrior@1/);
});

test("the carried rhythm opens an expectation the TARGET decides, both ways", () => {
  const prior = deriveRhythmPrior([reading("book:a", { alice: [0, 2, 4, 6] })], { giver: "r" }); // medianGap 2
  // Target beings return fast (gaps 1,1) — fulfilled; and slow (gap 20) — violated.
  const target = reading("book:target", { fast: [0, 1, 2], slow: [0, 20] });
  const score = scoreRhythmExpectations(target, prior);
  assert.equal(score.expectations, 3);
  assert.equal(score.fulfilled, 2);
  assert.equal(score.violated, 1);
  assert.equal(score.medianGap, 2);
  assert.throws(() => scoreRhythmExpectations(target, { schema: "EOExperiencePrior@1" }), /EORhythmPrior@1/);
});

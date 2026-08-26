// native/tests/levers.test.js — the two measured ceilings' levers, each
// tested at its wall:
//
//   lever 1: discoverRelationVocab's anchorSpans — pronoun-subject clauses
//     reach the vocabulary through POSITIONS the binding organ resolved,
//     never through the pronoun STRING (the unlicensed shape S8 refuses).
//   lever 2: descriptorBeings — a recurring, never-anchored definite
//     descriptor is admitted as a being at the Born gate's own floor.

import test from "node:test";
import assert from "node:assert/strict";
import { discoverRelationVocab } from "../adapters/text/relations.js";
import { descriptorBeings } from "../adapters/text/anchoring.js";

// ── lever 1 ─────────────────────────────────────────────────────────────
test("anchorSpans: a verb recurring only after BOUND pronouns enters the vocabulary — two distinct beings, two anchors", () => {
  const text = "He trudged along the ridge for hours. She trudged behind, silent.";
  // The caller (the binding organ's consumer) supplies only the RESOLVED
  // pronoun positions; the anchor is the bound being's id.
  const spans = [
    { index: 0, length: 2, anchor: "ref:victor" },
    { index: text.indexOf("She"), length: 3, anchor: "ref:elizabeth" },
  ];
  const { verbs } = discoverRelationVocab(text, { surfaces: [], minSurfaces: 2, anchorSpans: spans });
  assert.ok(verbs.has("trudged"), "a verb no capitalised surface ever anchors is now hearable");
});

test("anchorSpans: the SAME bound being twice is ONE anchor — distinctness is of beings, not occurrences", () => {
  const text = "He trudged along the ridge. He trudged down again.";
  const spans = [
    { index: 0, length: 2, anchor: "ref:victor" },
    { index: text.indexOf(". He") + 2, length: 2, anchor: "ref:victor" },
  ];
  const { verbs, candidates } = discoverRelationVocab(text, { surfaces: [], minSurfaces: 2, anchorSpans: spans });
  assert.ok(!verbs.has("trudged"), "one being's habit is recurrence of the being, not of the pattern");
  assert.equal(candidates.find((c) => c.verb === "trudged")?.surfaces, 1);
});

test("anchorSpans: a name anchor and a bound-pronoun anchor SHARE the tally — one seen after each admits at minSurfaces 2", () => {
  const text = "Walton trudged across the deck. Later he trudged back to the cabin.";
  const spans = [{ index: text.indexOf("Later he") + 6, length: 2, anchor: "ref:victor" }];
  const { verbs } = discoverRelationVocab(text, { surfaces: ["Walton"], minSurfaces: 2, anchorSpans: spans });
  assert.ok(verbs.has("trudged"), "surface anchors and positional anchors are one tally, one gate");
});

test("anchorSpans: unbound pronouns contribute NOTHING — the wall is positional, the string 'he' anchors nowhere by itself", () => {
  const text = "He trudged along. He trudged back. He trudged home again at dusk.";
  const { verbs, candidates } = discoverRelationVocab(text, { surfaces: [], minSurfaces: 2, anchorSpans: [] });
  assert.ok(!verbs.has("trudged"));
  assert.equal(candidates.length, 0, "no anchors, no candidates — three unbound 'he's are not evidence");
});

test("anchorSpans: the existing gates run unchanged on span-anchored candidates — capitalised and function-word tokens still refused", () => {
  const text = "He Trudged along. She of the valley.";
  const spans = [
    { index: 0, length: 2, anchor: "ref:a" },
    { index: text.indexOf("She"), length: 3, anchor: "ref:b" },
  ];
  const { candidates } = discoverRelationVocab(text, { surfaces: [], minSurfaces: 1, anchorSpans: spans, functionWords: new Set(["of"]) });
  assert.ok(!candidates.some((c) => c.verb === "trudged"), "capitalised after a span is still surface-shaped");
  assert.ok(!candidates.some((c) => c.verb === "of"), "the text's own closed class still refuses");
});

// ── lever 2 ─────────────────────────────────────────────────────────────
const occ = (surface, sentenceOrder, determination = "definite") => ({ canonicalSurface: surface, exactSurface: surface, determination, sentenceOrder });

test("descriptorBeings: a never-anchored descriptor at the Born-gate floor is admitted; below it, refused with its count", () => {
  const occurrences = [
    occ("the stranger", 1), occ("the stranger", 4), occ("the stranger", 9), occ("the stranger", 15),
    occ("the lieutenant", 2),
  ];
  const { beings, refused } = descriptorBeings(occurrences, { minArrivals: 4, anchoredSurfaces: new Set() });
  assert.equal(beings.length, 1);
  assert.equal(beings[0].id, "ref:desc:the_stranger");
  assert.equal(beings[0].arrivals, 4);
  const r = refused.find((x) => x.surface === "the lieutenant");
  assert.equal(r?.reason, "descriptor_below_arrivals");
  assert.equal(r?.arrivals, 1);
});

test("descriptorBeings: an ANCHORED descriptor is refused — it is evidence about an existing being, not a new one", () => {
  const occurrences = [occ("the creature", 1), occ("the creature", 2), occ("the creature", 3), occ("the creature", 4)];
  const { beings, refused } = descriptorBeings(occurrences, { minArrivals: 4, anchoredSurfaces: new Set(["the creature"]) });
  assert.equal(beings.length, 0);
  assert.equal(refused[0]?.reason, "descriptor_anchored");
});

test("descriptorBeings: arrivals are DISTINCT sentences; indefinites never count; the floor is never defaulted", () => {
  const twicePerSentence = [occ("the master", 1), occ("the master", 1), occ("the master", 2), occ("the master", 2)];
  const { beings } = descriptorBeings(twicePerSentence, { minArrivals: 4, anchoredSurfaces: new Set() });
  assert.equal(beings.length, 0, "two sentences twice each is two arrivals, not four");
  const indef = [occ("a servant", 1, "indefinite"), occ("a servant", 2, "indefinite"), occ("a servant", 3, "indefinite"), occ("a servant", 4, "indefinite")];
  assert.equal(descriptorBeings(indef, { minArrivals: 4, anchoredSurfaces: new Set() }).beings.length, 0, "an indefinite never implies one being");
  assert.throws(() => descriptorBeings([], {}), /declared/);
});

test("descriptorBeings: a possessive is refused by TYPE — speaker-relative, the first-person rule one determiner over", () => {
  const occs = [occ("my father", 1, "possessive"), occ("my father", 2, "possessive"), occ("my father", 3, "possessive"), occ("my father", 4, "possessive")];
  const { beings, refused } = descriptorBeings(occs, { minArrivals: 4, anchoredSurfaces: new Set() });
  assert.equal(beings.length, 0);
  assert.equal(refused.find((r) => r.surface === "my father")?.reason, "descriptor_speaker_relative");
});

test("descriptorBeings: with being evidence measured, recurrence alone admits nothing — things are refused, beings pass", () => {
  const occs = [
    occ("the stranger", 1), occ("the stranger", 4), occ("the stranger", 9), occ("the stranger", 15),
    occ("the murder", 2), occ("the murder", 5), occ("the murder", 8), occ("the murder", 12),
  ];
  const beingEvidence = new Map([["the stranger", 3]]); // stood in the subject slot of a measured verb, three times
  const { beings, refused } = descriptorBeings(occs, { minArrivals: 4, anchoredSurfaces: new Set(), beingEvidence });
  assert.deepEqual(beings.map((b) => b.id), ["ref:desc:the_stranger"]);
  assert.equal(refused.find((r) => r.surface === "the murder")?.reason, "descriptor_no_being_evidence",
    "'the murder' recurs like a being and is refused like a thing — beings act, on the material's own measured verbs");
});

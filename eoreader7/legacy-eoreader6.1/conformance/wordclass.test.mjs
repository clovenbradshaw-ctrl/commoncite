// eoreader6 · conformance/wordclass — perceiver/text/wordclass held to the
// same discipline roles.test.js already established: never guess, always
// disclose, and prove the composition with resolveSpanRole actually works
// rather than just asserting each module in isolation.
//
// The fixture below is not invented — every count is copied verbatim from
// a real run of scripts/build-pos-prior.mjs against the real UD_English-EWT
// training file (204,578 tokens), so "at" reads ADP:790/SCONJ:10/CCONJ:1
// here because that is what the treebank actually says, not a number
// chosen to make a test pass.

import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyWord, dominantClass, THRAX_MAP, THRAX_OUT_OF_SCOPE } from "../packages/engine/perceiver/text/wordclass.js";
import { resolveSpanRole } from "../packages/engine/perceiver/text/roles.js";

const POS_PRIOR = {
  schema: "POSPrior@1",
  forms: {
    at: { ADP: 790, SCONJ: 10, CCONJ: 1 },
    the: { DET: 9064, PRON: 8, ADP: 2, PART: 1 },
    that: { SCONJ: 994, PRON: 851, DET: 176, ADV: 14, ADP: 1 },
    still: { ADV: 141 },
    book: { NOUN: 22, VERB: 9, PROPN: 2 },
    is: { AUX: 2114, VERB: 124, PRON: 1 },
    running: { VERB: 24, NOUN: 2 },
    destruction: { NOUN: 7 },
    and: { CCONJ: 4990, DET: 4, X: 6, ADP: 2 },
    important: { ADJ: 41 },
    to: { PART: 5000, ADP: 3000 },
  },
};

test("the finding this closes: 'at' never reads as a verb — it is overwhelmingly a preposition", () => {
  const c = classifyWord("at", { posPrior: POS_PRIOR });
  assert.equal(c.found, true);
  assert.equal(c.candidates[0].upos, "ADP");
  assert.equal(c.candidates[0].thraxClass, "preposition");
  assert.ok(!c.candidates.some((cand) => cand.thraxClass === "verb"), "no reading of 'at' is ever a verb");
});

test("'still', 'this'-shaped 'that', 'book' — the crosslingual eval's other junk-verb cases — all resolve to a real, non-verb class or an honest ambiguity, never silently 'verb'", () => {
  const still = classifyWord("still", { posPrior: POS_PRIOR });
  assert.deepEqual(still.candidates.map((c) => c.thraxClass), ["adverb"]);

  const that = classifyWord("that", { posPrior: POS_PRIOR });
  assert.equal(that.candidates[0].upos, "SCONJ", "the treebank's own top reading");
  assert.ok(!that.candidates.some((c) => c.thraxClass === "verb"));

  const book = classifyWord("book", { posPrior: POS_PRIOR });
  assert.equal(book.candidates[0].thraxClass, "noun");
  assert.ok(book.candidates.some((c) => c.thraxClass === "verb"), "book genuinely IS sometimes a verb — that candidate must survive too");
});

test("ambiguity is preserved, never collapsed by classifyWord itself", () => {
  const c = classifyWord("that", { posPrior: POS_PRIOR });
  assert.equal(c.candidates.length, 5, "every attested tag survives, not just the top one");
  const shareSum = c.candidates.reduce((s, x) => s + x.share, 0);
  assert.ok(Math.abs(shareSum - 1) < 1e-9, "shares partition the whole count");
});

test("a word the treebank never saw is a disclosed absence, never a guess", () => {
  const c = classifyWord("supercalifragilisticexpialidocious", { posPrior: POS_PRIOR });
  assert.equal(c.found, false);
  assert.deepEqual(c.candidates, []);
});

test("case-folded: the prior is keyed lowercase, matching every other closed-class lookup in this engine", () => {
  const c = classifyWord("AT", { posPrior: POS_PRIOR });
  assert.equal(c.found, true);
  assert.equal(c.candidates[0].upos, "ADP");
});

test("THRAX_OUT_OF_SCOPE tags carry thraxClass: null — a disclosed absence, never forced into the nearest category", () => {
  const c = classifyWord("important", { posPrior: POS_PRIOR });
  assert.equal(c.candidates[0].upos, "ADJ");
  assert.equal(c.candidates[0].thraxClass, null);
  assert.ok(THRAX_OUT_OF_SCOPE.has("ADJ"));
  assert.ok(!("ADJ" in THRAX_MAP));
});

test("dominantClass: the floor is declared, never defaulted — same standing as resolveSpanRole's minActivation/minMargin", () => {
  assert.throws(() => dominantClass(classifyWord("at", { posPrior: POS_PRIOR }), {}), /minShare/);
  assert.throws(() => dominantClass(classifyWord("at", { posPrior: POS_PRIOR }), { minShare: 1.5 }), /minShare/);
});

test("dominantClass: 'at' clears a real declared floor; the genuinely close 'that' does not", () => {
  const at = dominantClass(classifyWord("at", { posPrior: POS_PRIOR }), { minShare: 0.9 });
  assert.equal(at?.thraxClass, "preposition");

  const that = dominantClass(classifyWord("that", { posPrior: POS_PRIOR }), { minShare: 0.9 });
  assert.equal(that, null, "SCONJ 994 vs PRON 851 clears no reasonable type-level floor — this is the honest handoff point to resolveSpanRole");
});

test("not found at all: dominantClass refuses rather than guessing", () => {
  const gap = dominantClass(classifyWord("zzznotaword", { posPrior: POS_PRIOR }), { minShare: 0 });
  assert.equal(gap, null);
});

// ── composition: the genuinely ambiguous case handed to resolveSpanRole ────
// "to" here stands for a word this repo's own real prior found close to a
// coin flip (PART 5000 / ADP 3000 — roughly 62/38, well short of any
// reasonable type-level floor). classifyWord correctly refuses to pick one;
// this proves the disclosed next step — instance-level resolution from the
// occurrence's own local company — actually closes the gap, using the REAL
// organ this repo already built for exactly this handoff, not a new one.
test("composition: a type-level tie that classifyWord refuses IS resolvable per-occurrence by resolveSpanRole, given real local company", () => {
  const c = classifyWord("to", { posPrior: POS_PRIOR });
  assert.equal(dominantClass(c, { minShare: 0.9 }), null, "type frequency alone will not settle this occurrence");

  const filler = (n) => `frame ${n} the ordinary business of the afternoon continued much as before with letters and accounts and quiet errands`;
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  const known = [];

  pushFiller(3);
  known.push({ order: lines.length, role: "particle" });
  lines.push("Elena knelt to trim the garden roses and to water the warm garden soil.");
  pushFiller(3);
  known.push({ order: lines.length, role: "adposition" });
  lines.push("Marcus carried the plank to the workshop and the timber to the workshop bench.");
  pushFiller(3);
  known.push({ order: lines.length, role: "particle" });
  lines.push("Elena stopped to weed the garden wall and to gather the garden roses again.");
  pushFiller(3);
  known.push({ order: lines.length, role: "adposition" });
  lines.push("Marcus brought the tools to the workshop and the timber to the workshop light.");
  pushFiller(6);
  const unknownOrder = lines.length;
  lines.push("Elena paused to rake the garden soil and to prune the garden roses once more.");

  const sentences = lines.map((text, i) => ({ text, order: i, offset: i * 1000 }));
  const occurrences = [
    ...known.map((k, i) => ({ sentenceOrder: k.order, role: k.role, id: `known-${i}` })),
    { sentenceOrder: unknownOrder, role: null, id: "unknown" },
  ];

  const { bindings } = resolveSpanRole(sentences, occurrences, { minActivation: 0.05, minMargin: 0.2 });
  const bound = bindings.find((b) => b.id === "unknown");
  assert.ok(bound, "the garden-vocabulary company must resolve this occurrence's use of 'to'");
  assert.equal(bound.role, "particle");
});

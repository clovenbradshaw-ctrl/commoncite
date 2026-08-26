// native/tests/vocabulary.test.js — the hearing-vocabulary subassembly's
// walls, each an S9 direction made mechanical.

import test from "node:test";
import assert from "node:assert/strict";
import { boundAnchorSpans, agencyEvidence } from "../adapters/text/vocabulary.js";

test("boundAnchorSpans: only the bound pronoun's own occurrences, inside its own sentence, carrying the bound identity", () => {
  const text = "He walked out. She waited by the door while he paced.";
  const bound = [{ start: 15, end: text.length, pronoun: "she", referentId: "ref:elena" }];
  const spans = boundAnchorSpans(bound, text);
  assert.equal(spans.length, 1, "the unbound 'He' at 0 and the 'he' outside no binding contribute nothing");
  assert.equal(spans[0].anchor, "ref:elena");
  assert.equal(text.slice(spans[0].index, spans[0].index + spans[0].length), "She");
});

test("boundAnchorSpans: duplicate offsets across arms dedupe; a token inside a longer word never matches", () => {
  const text = "The weather held. She sang.";
  const bound = [
    { start: 18, end: 27, pronoun: "she", referentId: "ref:a" },
    { start: 18, end: 27, pronoun: "she", referentId: "ref:b" },
  ];
  const spans = boundAnchorSpans(bound, text);
  assert.equal(spans.length, 1, "one position, one anchor — first binding wins, the collision is not doubled");
  const trap = boundAnchorSpans([{ start: 0, end: 17, pronoun: "he", referentId: "ref:x" }], text);
  assert.equal(trap.length, 0, "'he' inside 'The'/'weather' never anchors — word boundary is the wall");
});

test("agencyEvidence: a descriptor before a real measured verb earns; before a copula it does not — AUX never testifies", () => {
  const text = "The stranger spoke of the north. The murder was dreadful. The stranger spoke again.";
  const posForms = { spoke: { VERB: 100 }, was: { AUX: 900, VERB: 40 } };
  const ev = agencyEvidence(text, ["the stranger", "the murder"], new Set(["spoke", "was"]), { posForms });
  assert.equal(ev.get("the stranger"), 2);
  assert.equal(ev.has("the murder"), false, "'the murder was' is existence-speak, not agency");
});

test("agencyEvidence: a verb the treebank never attests is refused as a witness — evidence for ADMISSION stays conservative", () => {
  const ev = agencyEvidence("the wanderer klorped by.", ["the wanderer"], new Set(["klorped"]), { posForms: {} });
  assert.equal(ev.size, 0, "an unattested form may be heard as an arrangement (that polarity is disclosed elsewhere) but never testifies being-hood");
});

// native/tests/attribution.test.js — who is speaking, and the refusals that
// keep the answer honest.

import test from "node:test";
import assert from "node:assert/strict";
import { quotationFrames, quotedSpans, attributeQuotation, narrationFrames, holderAt } from "../adapters/text/attribution.js";

test("the continued-quotation convention is read off the bytes: a run of opened-but-unclosed paragraphs is one embedded telling", () => {
  const text = [
    "He began his tale.",
    "“I remember the first days of my being.",
    "“By degrees I learned to distinguish the operations of my senses.",
    "“Such was the history of my cottagers.”",
    "The being finished speaking.",
  ].join("\n\n");
  const q = quotationFrames(text);
  assert.equal(q.embeddedFrames.length, 1, "three quoted paragraphs are ONE telling, not three");
  assert.equal(q.embeddedFrames[0].paragraphs, 3);
  assert.ok(text.slice(q.embeddedFrames[0].start, q.embeddedFrames[0].end).startsWith("“I remember"), "the span re-slices to the quoted material (P5.2)");
});

test("one paragraph of ordinary dialogue is not an embedded frame", () => {
  const q = quotationFrames("“Good evening,” said Clerval.\n\nThey walked on.");
  assert.equal(q.embeddedFrames.length, 0);
  assert.equal(q.counted.closed, 1);
});

test("a quotation is bounded by its own marks, not by its paragraph — the speaker tag sits inside the block", () => {
  const text = "He turned. “Good evening,” said Clerval, and we walked on together toward the lake.";
  const { spans } = quotedSpans(text);
  assert.equal(spans.length, 1);
  assert.equal(spans[0].text, "“Good evening,”");
  assert.ok(spans[0].after.startsWith(" said Clerval"), "the tag is in `after` — taking the PARAGRAPH's end instead put it out of reach, which is what made the first live run attribute 2.8% (P5.5: the driver, not the theory)");
  const isVerb = (w) => w.toLowerCase() === "said";
  const referentFor = (s) => (s === "Clerval" ? "ref:auto:clerval" : null);
  assert.equal(attributeQuotation(spans[0].before, spans[0].after, { isVerb, referentFor }).speaker, "ref:auto:clerval");
});

test("attribution needs a verb the prior admits AND a name the reading admitted — neither alone", () => {
  const isVerb = (w) => ["said", "exclaimed"].includes(w.toLowerCase());
  const referentFor = (s) => (["Clerval", "Elizabeth"].includes(s) ? `ref:auto:${s.toLowerCase()}` : null);
  assert.equal(attributeQuotation("", "” said Clerval, and we walked", { isVerb, referentFor }).speaker, "ref:auto:clerval");
  assert.equal(attributeQuotation("Elizabeth said, ", "", { isVerb, referentFor }).speaker, "ref:auto:elizabeth");
  // A verb beside an unknown name: no speaker. A known name beside a
  // non-verb: no speaker. Both are gaps, not guesses.
  assert.equal(attributeQuotation("", "” said Mrs", { isVerb, referentFor }).gap.type, "attribution_unwitnessed");
  assert.equal(attributeQuotation("", "” beside Clerval", { isVerb, referentFor }).gap.type, "attribution_unwitnessed");
  assert.throws(() => attributeQuotation("", "", {}), /injected/, "the prior and the cast are injected, never derived here (P3)");
});

test("narration frames come from an injected prior; with none, a typed gap and NO guessed narrator", () => {
  const bare = narrationFrames("Chapter 1\n\nI am by birth a Genevese.");
  assert.equal(bare.frames.length, 0);
  assert.equal(bare.gap.type, "frame_prior_absent");
});

test("narratorSpans resolve by anchor, and an anchor that does not resolve is reported, never widened", () => {
  const text = "Walton writes. I am by birth a Genevese. Victor speaks. The being finished speaking. Victor again.";
  const prior = {
    source: "test prior",
    referents: [
      { id: "walton", narratorSpans: [{ toAnchor: "I am by birth a Genevese" }] },
      { id: "victor", narratorSpans: [{ fromAnchor: "I am by birth a Genevese", toAnchor: "The being finished speaking" }] },
      { id: "ghost", narratorSpans: [{ fromAnchor: "a line that is not in this text" }] },
    ],
  };
  const nf = narrationFrames(text, { framePrior: prior });
  assert.deepEqual(nf.narrators, ["victor", "walton"], "the unresolvable narrator is not among them");
  assert.equal(nf.unresolvedAnchors.length, 1);
  assert.equal(nf.unresolvedAnchors[0].narrator, "ghost");
  assert.equal(holderAt(0, { narration: nf }).holder, "walton");
  assert.equal(holderAt(text.indexOf("Victor speaks"), { narration: nf }).holder, "victor");
  assert.equal(holderAt(text.length - 1, { narration: nf }).gap, "outside_every_known_frame", "past the last frame is a gap, not the last narrator carried forward");
});

test("an embedded frame outranks the outer narration — that is what embedding means", () => {
  const nf = { frames: [{ narrator: "victor", byteStart: 0, byteEnd: 100, heading: "Ch 11" }] };
  const embedded = [{ start: 40, end: 60 }];
  const speakers = new Map([[40, "creature"]]);
  assert.equal(holderAt(50, { narration: nf, embedded, embeddedSpeakers: speakers }).holder, "creature");
  assert.equal(holderAt(50, { narration: nf, embedded, embeddedSpeakers: speakers }).depth, 2);
  assert.equal(holderAt(10, { narration: nf, embedded, embeddedSpeakers: speakers }).holder, "victor");
  assert.equal(holderAt(50, { narration: nf, embedded }).gap, "embedded_speaker_unattributed", "an embedded frame with no attributed speaker says so rather than falling back to the outer narrator");
});

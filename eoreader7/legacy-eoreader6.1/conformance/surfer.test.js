import { test } from "node:test";
import assert from "node:assert/strict";

import { createSession, admitChunked, sessionSegments, snipSegment } from "../packages/host/corpus.js";
import { executePrompt } from "../packages/host/surfer.js";
import { findBySource } from "../provenance/index.js";

const FIXTURE = [
  "Title Page",
  "",
  "AN AUTHOR",
  "",
  "CHAPTER I",
  "",
  "It was on a dreary night of November that I beheld the accomplishment of my toils. With an anxiety that almost amounted to agony, I collected the instruments of life around me, that I might infuse a spark of being into the lifeless thing that lay at my feet.",
  "",
  "CHAPTER II",
  "",
  "We are surrounded by poetry. The warm and inspiring language of this author brought a magic to every page, and I lingered over the story of the wanderer who fought the fury of his destiny. This is the substance under the second chapter, and it must be long enough to count.",
  "",
  "LETTER 1",
  "",
  "To Mrs. Saville, England. You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.",
  "",
  "MOVEMENT 3",
  "",
  "And here begins a thing that is neither letter nor chapter but a movement, with a body of its own long enough to survive the substance test and earn its place in the outline of this little text. A movement opens in the middle of a source as the score would put it, its form plain, its number counted, and a reader who asks for the third movement is answered by the form alone — never by a vocabulary list that happens to know the word movement.",
  "",
  "CHAPTER XVIII",
  "",
  "This final chapter is written for the numeral-form test: a reader should be able to ask for chapter eighteen by the number eighteen, whatever the source chose to print. Its body is deliberately long so it survives the substance test.",
  "",
].join("\n");

const admit = (session, text, sourceId = "source:Frankenstein.txt") =>
  admitChunked(session, { text, sourceId });

// ── the ladder ───────────────────────────────────────────────────────────────

test("a heading address snips the addressed segment, byte for byte", () => {
  const session = createSession();
  admit(session, FIXTURE);
  const out = executePrompt(session, "snip chapter 2 of the book");
  assert.equal(out.gap, undefined);
  assert.equal(out.segment, "CHAPTER II");
  assert.equal(out.addressed_by, "heading");
  assert.ok(out.text.startsWith("CHAPTER II\n\nWe are surrounded by poetry."));
  assert.ok(out.text.trim().endsWith("enough to count."));
});

test("numeral forms convert — chapter 18 finds CHAPTER XVIII, and two addresses at once is ambiguity", () => {
  const session = createSession();
  admit(session, FIXTURE);
  const out = executePrompt(session, "chapter 18");
  assert.equal(out.segment, "CHAPTER XVIII");

  const amb = executePrompt(session, "chapter 2 letter 1");
  assert.equal(amb.gap, "ambiguous_address");
  assert.match(amb.reason, /CHAPTER II/);
  assert.match(amb.reason, /LETTER 1/);
});

test("a content address lands on the segment around the described passage", () => {
  const session = createSession();
  admit(session, FIXTURE);
  const out = executePrompt(session, "the wanderer who fought the fury of his destiny");
  assert.equal(out.gap, undefined);
  assert.equal(out.addressed_by, "content");
  assert.equal(out.segment, "CHAPTER II");
  assert.ok(out.text.includes("wanderer who fought the fury"));
});

test("the snip is registered in provenance, citable by refId", () => {
  const session = createSession();
  admit(session, FIXTURE);
  const out = executePrompt(session, "letter 1");
  assert.ok(out.refId);
  const rec = session.provenance.get(out.refId);
  assert.ok(rec, "the snipped segment must be registered");
  assert.equal(rec.sourceId, "source:Frankenstein.txt");
  assert.equal(rec.text, out.text);
  assert.equal(rec.spec.what, "snipped_segment");
  assert.equal(rec.spec.prompt, "letter 1");
  const found = findBySource(session.provenance, "source:Frankenstein.txt");
  assert.ok(found.some((e) => e.refId === out.refId));
});

// ── typed gaps, never guesses ────────────────────────────────────────────────

test("empty prompt and missing content are typed gaps; unsaid sources fan across the corpus", () => {
  const one = createSession();
  admit(one, FIXTURE);
  assert.equal(executePrompt(one, "   ").gap, "empty_prompt");
  const missed = executePrompt(one, "quantum computing theorem");
  assert.equal(missed.gap, "content_not_found");
  assert.match(missed.reason, /no heading nor any line/);

  const two = createSession();
  admit(two, FIXTURE, "source:Frankenstein.txt");
  admit(two, "A totally different document about a ship and a whale.\n\nCHAPTER ONE\n\nIts one long body of prose, enough to count as substance under the heading.\n", "source:Moby.txt");

  // Unsaid source: the prompt addresses every document — a fan, never a guess.
  const unsaid = executePrompt(two, "snip chapter 1");
  assert.ok(Array.isArray(unsaid.fan), "an unsaid source fans across the corpus");
  assert.equal(unsaid.fan.length, 2);
  const bySource = Object.fromEntries(unsaid.fan.map((r) => [r.source, r]));
  assert.equal(bySource.Frankenstein.segment, "CHAPTER I");
  assert.equal(bySource.Moby.segment, "CHAPTER ONE");

  // Two names are two targets, not ambiguity.
  const both = executePrompt(two, "snip chapter 1 of frankenstein and chapter one of moby");
  assert.ok(Array.isArray(both.fan));
  assert.equal(both.fan.length, 2);

  const named = executePrompt(two, "snip chapter 1 of frankenstein");
  assert.equal(named.gap, undefined);
  assert.equal(named.segment, "CHAPTER I");
});

test("a passage with no structural boundary in reach is a window, not a chapter", () => {
  const session = createSession();
  const prose = [
    "Long prose line one about the weather being cold and damp this morning.",
    "Long prose line two continuing the same paragraph without any blank line between.",
    "Long prose line three, still no blank line, so none of these can read as a boundary.",
    "",
  ].join("\n");
  admit(session, prose, "source:Weather.txt");

  const out = executePrompt(session, "cold damp weather");
  assert.equal(out.gap, "no_structural_boundary_in_reach");
  assert.match(out.segment, /no structural boundary/);
  assert.equal(out.windowed, true);
  assert.ok(out.text.includes("cold and damp"));
});

test("a preamble with no heading behind it is labelled a context window, never a chapter", () => {
  const session = createSession();
  const preamble = [
    "Opening prose about the weather, cold and damp, with no blank lines anywhere in this preamble.",
    "More opening prose, still no blank line, so this preamble cannot read as a boundary.",
    "",
    "CHAPTER I",
    "",
    "A real body under the one boundary, long enough to survive the substance test for the outline.",
    "",
  ].join("\n");
  admit(session, preamble, "source:Proem.txt");

  const out = executePrompt(session, "opening prose weather");
  assert.equal(out.gap, undefined);
  assert.equal(out.windowed, true);
  assert.equal(out.found, false);
  assert.equal(out.segment, "(context window — no heading precedes this passage)");
  assert.ok(out.text.includes("Opening prose"));
});

test("a lone heading still answers a heading address — the evidence survives the gap typing", () => {
  const session = createSession();
  admit(session, "CHAPTER I\n\nA body long enough to survive the substance test, which it is, because this paragraph of prose runs on well past two hundred characters so that the lone boundary it opens beneath is real and earned and counted. But there is only one of them.\n");
  const out = executePrompt(session, "chapter 1");
  assert.equal(out.gap, undefined);
  assert.equal(out.segment, "CHAPTER I");
  assert.equal(out.addressed_by, "heading");
});

// ── byte honesty ─────────────────────────────────────────────────────────────

test("multi-byte sources snip byte-accurately — the drift contract held at the seam", () => {
  const text = "ПРЕДИСЛОВИЕ\n\nГЛАВА 1\n\nЭто была глухая ноябрьская ночь, и я увидел завершение моих трудов.\n\nГЛАВА 2\n\nА вот второе тело открывается под границей, найденной по байтам, а не по символам.\n";
  const session = createSession();
  admit(session, text, "source:Сказка.txt");
  const out = executePrompt(session, "глава 2");
  assert.equal(out.gap, undefined);
  assert.equal(out.segment, "ГЛАВА 2");
  assert.ok(out.text.startsWith("ГЛАВА 2\n\nА вот второе тело"));
  // byte offsets are real: the decoded window must equal the returned text
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const buf = enc.encode(text);
  assert.equal(dec.decode(buf.subarray(out.byte_start, out.byte_end)), out.text);
});

test("snipSegment and sessionSegments agree on the same coordinates", () => {
  const session = createSession();
  admit(session, FIXTURE);
  const outline = sessionSegments(session, { sourceId: "source:Frankenstein.txt" });
  assert.equal(outline.gap, null);
  const h = outline.headings.find((x) => x.label === "LETTER 1");
  const snip = snipSegment(session, { sourceId: "source:Frankenstein.txt", anchor: h.bodyStart + 10 });
  assert.equal(snip.segment, "LETTER 1");
  assert.equal(snip.byte_start, h.start);
  assert.equal(snip.byte_end, h.end);
});

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  headingScore,
  lineIndex,
  outlineOfIndex,
  discoverSegment,
  headingsMatch,
  toArabic,
  toRoman,
} from "../packages/engine/perceiver/text/segments.js";

// ── form, not vocabulary ─────────────────────────────────────────────────────

test("a heading is form: word+number, numerals, all-caps — never the word's meaning", () => {
  for (const h of ["Chapter 1", "CHAPTER I", "1. The beginning", "MOVEMENT 3", "III.", "Sinfonia 9", "LETTER 1", "ГЛАВА", "СЦЕНА 2"]) {
    assert.ok(headingScore(h, true) >= 2, `"${h}" should read as a boundary`);
  }
  // Vocabulary means nothing to it: a sentence that uses the word "chapter"
  // is still a sentence.
  assert.equal(headingScore("This chapter begins the long night.", true), 0);
  assert.equal(headingScore("Chapter One", true), 2, "Title Case word pair is form too");
});

test("a heading must open onto a body — the blank line is the how", () => {
  assert.equal(headingScore("Chapter 1", false), 0);
  assert.equal(headingScore("Chapter 1", true), 3);
});

test("a sentence is not a heading, even one that ends in a closing quote", () => {
  // The regression this file exists to keep: "Mary Bolkónskaya."" waves through
  // on its curly quote unless the tail is stripped before the sentence test.
  assert.equal(headingScore("Mary Bolkónskaya.”", true), 0);
  assert.equal(headingScore("He left.", true), 0);
  assert.equal(headingScore("Why?", true), 0);
  // The one exception: a bare roman numeral, which is a heading's own stop.
  assert.ok(headingScore("XVIII.", true) >= 2);
});

test("a name is not a heading — honourific + name, refused by form", () => {
  assert.equal(headingScore("Mr. Darcy", true), 0);
  assert.equal(headingScore("St. Petersburg", true), 0);
  assert.equal(headingScore("Dr. Collins arrived.", true), 0);
});

test("length bounds: neither a two-character stub nor a wall of prose", () => {
  assert.equal(headingScore("X", true), 0);
  assert.equal(headingScore("12", true), 3, "a bare number is a boundary in a numbered source");
  assert.ok(headingScore("Chapter 1 " + "x".repeat(90), true) === 0);
});

// ── the outline ──────────────────────────────────────────────────────────────

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

test("the outline finds the real structure and none of the noise", () => {
  const out = outlineOfIndex(lineIndex(FIXTURE));
  assert.equal(out.gap, null);
  const labels = out.headings.map((h) => h.label);
  assert.deepEqual(labels, ["CHAPTER I", "CHAPTER II", "LETTER 1", "MOVEMENT 3", "CHAPTER XVIII"]);
  // The speech tail and the honourific lines inside bodies are NOT headings.
  assert.ok(!labels.some((l) => l.startsWith("Mary")));
  assert.ok(!labels.some((l) => l.startsWith("To Mrs.")));
});

test("the outline is flat — no level, never", () => {
  const out = outlineOfIndex(lineIndex(FIXTURE));
  for (const h of out.headings) {
    assert.ok(!("level" in h), "a derived nesting level would be a holon-level claim");
  }
});

test("the outline's offsets index back into the source exactly", () => {
  const text = FIXTURE;
  const out = outlineOfIndex(lineIndex(text));
  for (const h of out.headings) {
    assert.equal(text.slice(h.start, h.bodyStart).trim(), h.label);
    assert.equal(text.slice(h.bodyStart, h.end).trim().length > 0, true);
  }
});

test("a listing is not a structure — the substance test drops a table of contents", () => {
  const toc = [
    "CHAPTER I ..... 1",
    "CHAPTER II .... 9",
    "CHAPTER III ... 17",
    "CHAPTER IV .... 25",
    "",
    "CHAPTER I",
    "",
    "It was on a dreary night of November that I beheld the accomplishment of my toils. With an anxiety that almost amounted to agony I collected the instruments of life around me, that I might infuse a spark of being into the lifeless thing that lay at my feet. It was already one in the morning; the rain pattered dismally against the panes, and my candle was nearly burnt out, when, by the glimmer of the half-extinguished light, I saw the dull yellow eye of the creature open; it breathed hard, and a convulsive motion agitated its limbs. How can I describe my emotions at this catastrophe, or how delineate the wretch whom with such infinite pains and care I had endeavoured to form? His limbs were in proportion, and I had selected his features as beautiful. Beautiful! Great God! His yellow skin scarcely covered the work of muscles and arteries beneath; his hair was of a lustrous black, and flowing; his teeth of a pearly whiteness; but these luxuriances only formed a more horrid contrast with his watery eyes, that seemed almost of the same colour as the dun-white sockets in which they were set, his shrivelled complexion and straight black lips.",
    "",
  ].join("\n");
  const out = outlineOfIndex(lineIndex(toc));
  assert.equal(out.gap, "only_one_boundary_detected");
  assert.deepEqual(out.headings.map((h) => h.label), ["CHAPTER I"]);
  assert.ok(out.preambleEnd != null);
});

test("fewer than two boundaries is a typed gap — with the surviving evidence intact, never a contents masquerade", () => {
  assert.equal(outlineOfIndex(lineIndex("plain text with no structure at all.")).gap, "no_structural_boundaries_detected");
  const one = "CHAPTER I\n\nA body long enough to survive the substance test, which it is, because this paragraph of prose runs on well past two hundred characters so that the lone boundary it opens beneath is real and earned and counted. But there is only one of them.\n";
  const out = outlineOfIndex(lineIndex(one));
  assert.equal(out.gap, "only_one_boundary_detected");
  assert.deepEqual(out.headings.map((h) => h.label), ["CHAPTER I"], "the single real boundary is still reported as evidence");
  assert.equal(outlineOfIndex(lineIndex("")).gap, "empty_text");
});

// ── discoverSegment ──────────────────────────────────────────────────────────

test("discoverSegment brackets the anchor between the real boundaries", () => {
  const idx = lineIndex(FIXTURE);
  const seg = discoverSegment(idx, idx.starts[lineIndexOfLabel(idx, "LETTER 1")] + 40);
  assert.ok(seg, "a segment should be found");
  assert.equal(seg.label, "LETTER 1");
  assert.equal(seg.found, true);
});

test("a window edge is a window, never a chapter — and a boundaryless reach is a gap", () => {
  const prose = [
    "Long prose line one that is not a heading because it is long and unpunctuated at the end.",
    "Long prose line two, equally ordinary, continuing the same paragraph without a blank line.",
    "Long prose line three, still no blank line, so none of these can read as a boundary.",
    "",
    "CHAPTER I",
    "",
    "The body that opens beneath the one real boundary, long enough to survive the substance test.",
    "",
  ].join("\n");
  const idx = lineIndex(prose);

  // Anchor before any heading, within reach of the one there is: no heading
  // behind it, so the segment is honest about being a context window.
  const seg = discoverSegment(idx, idx.starts[0] + 5);
  assert.ok(seg);
  assert.equal(seg.found, false);
  assert.equal(seg.label, "(context window — no heading precedes this passage)");

  // Anchor in truly structureless material: no boundary anywhere in reach.
  const flat = lineIndex("plain text. more plain text. yet more plain text. nothing here is short or blank-separated.\n");
  assert.equal(discoverSegment(flat, 10), null);
});

function lineIndexOfLabel(idx, label) {
  return idx.lines.findIndex((l) => l.trim() === label);
}

// ── byte addresses ───────────────────────────────────────────────────────────

const enc = new TextEncoder();
const dec = new TextDecoder();

function byteIndex(text) {
  const lines = text.split("\n");
  const starts = new Array(lines.length);
  let at = 0;
  for (let i = 0; i < lines.length; i++) {
    starts[i] = at;
    at += enc.encode(lines[i]).length + (i + 1 < lines.length ? 1 : 0); // the \n between lines only
  }
  return { lines, starts, total: at, lengthOf: (l) => enc.encode(l).length };
}

test("byte offsets index back into the exact source bytes — the drift contract", () => {
  // Non-ASCII on purpose: the first multi-byte character is where a
  // string-length index silently parts company with a byte index.
  const text = "PREFACE\n\nCHAPTER I\n\nIt was a dreary night of November — the soirée at Netherfield began with Señor Ávila present.\n\nCHAPTER II\n\nAnd the second body opens beneath a boundary that must be found by byte, not by character.\n";
  const out = outlineOfIndex(byteIndex(text));
  const buf = enc.encode(text);
  for (const h of out.headings) {
    const label = dec.decode(buf.subarray(h.start, h.bodyStart)).trim();
    assert.equal(label, h.label);
    assert.ok(dec.decode(buf.subarray(h.bodyStart, h.end)).trim().length > 0);
  }
});

// ── number forms and addressing ──────────────────────────────────────────────

test("roman and arabic are two forms of one count", () => {
  for (const n of [1, 4, 9, 18, 44, 90, 3999]) {
    assert.equal(toArabic(toRoman(n)), n);
  }
  assert.equal(toArabic("XVIII"), 18);
  assert.equal(toArabic("not-roman"), null);
  assert.equal(toRoman(0), null);
  assert.equal(toRoman(4000), null);
});

test("a prompt addresses a boundary by form, with surrounding words ignored", () => {
  assert.equal(headingsMatch("chapter 18", "CHAPTER XVIII"), true, "arabic→roman");
  assert.equal(headingsMatch("snip chapter 2 of the book", "CHAPTER II"), true, "leading/trailing words are the reader's");
  assert.equal(headingsMatch("letter 1", "LETTER 1"), true);
  assert.equal(headingsMatch("chapter ii", "CHAPTER II"), true);
  assert.equal(headingsMatch("chapter 2", "CHAPTER I"), false, "a different number is a different boundary");
  assert.equal(headingsMatch("movement three", "MOVEMENT 3"), false, "an ordinal is vocabulary — a prior word, not form");
});

test("digit scripts beyond ASCII are form too — Devanagari and Arabic-Indic detect and address by their own surface", () => {
  assert.ok(headingScore("अध्याय १", true) >= 2, "Devanagari WORD + digit");
  assert.ok(headingScore("الفصل ١", true) >= 2, "Arabic WORD + digit");
  assert.equal(headingsMatch("अध्याय १", "अध्याय १"), true, "same-surface numeral addresses");
  assert.equal(headingsMatch("अध्याय 2", "अध्याय १"), false, "crossing a digit script is a value claim — a prior, never form");
  assert.equal(headingsMatch("الفصل २", "الفصل २"), true);
  assert.equal(headingsMatch("الفصل २", "الفصل ١"), false, "a different surface numeral is a different boundary");
});

test("Latin accents fold through the canonical single-pass map — an accentless prompt finds the accented heading", () => {
  assert.equal(headingsMatch("capitulo 1", "Capítulo I"), true, "reader drops the accent, the map folds it back");
  assert.equal(headingsMatch("capítulo 1", "Capítulo I"), true, "the accented form folds to itself");
});

test("Greek addresses by the accentless surface a printed heading carries — tonos folding is a prior, not engine form", () => {
  assert.ok(headingScore("ΡΑΨΩΔΙΑ Α", true) >= 2, "all-caps Greek is a boundary by form");
  assert.equal(headingsMatch("ραψωδια α", "ΡΑΨΩΔΙΑ Α"), true);
  assert.equal(headingsMatch("ραψωδία α", "ΡΑΨΩΔΙΑ Α"), false, "accent folding is a language prior, not an engine claim");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { splitSentences, deriveAbbreviations, stripContainer, looksLikeMaterial } from "../packages/engine/perceiver/text/spans.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EN = JSON.parse(readFileSync(join(root, "bin/priors/lang/en.json"), "utf8")).abbreviations;

const texts = (t, opts) => splitSentences(t, opts).map((s) => s.text);

test("a title does not end a sentence when a prior says it is a title", () => {
  const t = "Mr. Collins arrived early. Mrs. Bennet was delighted.";
  assert.deepEqual(texts(t, { abbreviations: EN }), [
    "Mr. Collins arrived early.",
    "Mrs. Bennet was delighted.",
  ]);
});

test("REGRESSION: without abbreviation handling every titled name is severed", () => {
  // The defect this file exists for. `Mr.` was treated as a full stop, so
  // "Mr. Collins" never occurred inside any single sentence — measured at 0
  // occurrences across Pride and Prejudice against 145 in the file. The old
  // guard ("a terminator not followed by whitespace") catches 3.14 and cannot
  // catch this, because "Mr. " has a space.
  const t = "He bowed to Mr. Darcy.";
  assert.deepEqual(texts(t, { abbreviations: [] }), ["He bowed to Mr.", "Darcy."]);
  assert.deepEqual(texts(t, { abbreviations: EN }), ["He bowed to Mr. Darcy."]);
});

test("a real sentence end still ends a sentence", () => {
  assert.deepEqual(texts("She left. He stayed.", { abbreviations: EN }), ["She left.", "He stayed."]);
  assert.equal(texts("One. Two. Three.", { abbreviations: EN }).length, 3);
});

test("a decimal point is not a sentence end either — the old guard still earns its keep", () => {
  assert.deepEqual(texts("The value is 3.14 exactly.", { abbreviations: EN }), ["The value is 3.14 exactly."]);
});

test("a paragraph break is a harder boundary than any terminator", () => {
  // A chapter heading has no period and must not glue onto what follows.
  assert.deepEqual(texts("CHAPTER XVIII\n\nMr. Darcy bowed.", { abbreviations: EN }), [
    "CHAPTER XVIII",
    "Mr. Darcy bowed.",
  ]);
});

test("a chapter numeral does not split a heading from its text", () => {
  assert.deepEqual(texts("CHAPTER XVIII. The ball at Netherfield.", { abbreviations: EN }), [
    "CHAPTER XVIII. The ball at Netherfield.",
  ]);
});

test("offsets still index back into the source exactly", () => {
  const t = "Mr. Collins arrived. Mrs. Bennet was pleased.";
  for (const s of splitSentences(t, { abbreviations: EN })) {
    assert.equal(t.slice(s.offset, s.offset + s.text.length), s.text);
  }
});

// ── the derived fallback ────────────────────────────────────────────────────

test("with no prior, abbreviations are derived from the material — no word list", () => {
  // "Mr" is only ever written with a period; "left" is not. Zipf-style
  // self-reference, the same discipline material.js uses for stopwords.
  const t = "Mr. Darcy left. Mr. Bingley left. She left. He left.";
  assert.ok(deriveAbbreviations(t).has("Mr"));
  assert.ok(!deriveAbbreviations(t).has("left"));
  assert.deepEqual(texts(t), ["Mr. Darcy left.", "Mr. Bingley left.", "She left.", "He left."]);
});

test("MEASURED LIMIT: the derived fallback is a floor, and a fragile one", () => {
  // Pinned rather than hidden, because the gap is not small. Two failure modes,
  // both real, both the reason bin/priors/lang/en.json exists.

  // 1. The length bar is the text's own 10th-percentile token length, which on
  //    real English prose comes out at 2 — a three-character title cannot pass.
  const t = "Mrs. Bennet spoke. Mrs. Hurst agreed. She spoke. He agreed. It is so. We go on. I am here.";
  assert.ok(!deriveAbbreviations(t).has("Mrs"), "if this now passes, the fallback improved — update the claim");

  // 2. "Always written with a period" is all-or-nothing: ONE period-less
  //    occurrence anywhere disqualifies the token for the whole text. This is
  //    why the fallback recovered nothing at all on Pride and Prejudice, where
  //    "Mr. Darcy" measured 0 sentences derived against 249 with the prior.
  // (No single-letter tokens in the fixture: they drag the 10th-percentile
  // length bar down to 1 and would mask the effect being demonstrated.)
  const clean = "Mr. Darcy went. Mr. Bingley went. She went.";
  assert.ok(deriveAbbreviations(clean).has("Mr"));
  const polluted = clean + " The Mr and Mrs went.";
  assert.ok(!deriveAbbreviations(polluted).has("Mr"), "a single bare occurrence disqualifies the whole text");

  assert.ok(EN.includes("Mrs") && EN.includes("Mr"), "the prior covers what the fallback cannot");
});

test("derivation is deterministic and reads nothing ambient", () => {
  const t = "Mr. A went. Mr. B went. She went.";
  assert.deepEqual([...deriveAbbreviations(t)].sort(), [...deriveAbbreviations(t)].sort());
});

test("an injected prior wins over derivation, and an empty one really is empty", () => {
  const t = "Mr. Darcy left. Mr. Bingley left. She left.";
  assert.ok(texts(t, { abbreviations: [] }).includes("Mr."), "an explicit empty prior disables the fallback");
  assert.ok(!texts(t, { abbreviations: EN }).includes("Mr."));
});

// ── The container, and the three lessons re-earned from 4.2 and 5 ──────────
//
// Chrome is general: credits and transcriber's notes in a PG file, headers
// and signatures and quoted replies in a mailbox, running heads in a scan.
// What is pinned here is the shape of the separation, not one publisher.

test("the marker is a LINE, not a run of asterisks", () => {
  // The old shape matched across newlines to the next `***` in the file, so a
  // title containing an asterisk dragged the cut. Anchored, this is exact.
  const doc = [
    "Title: A Study in *Asterisks*",
    "",
    "*** START OF THE PROJECT GUTENBERG EBOOK SOMETHING ***",
    "",
    "The work begins here and continues for a while so the guard is satisfied. " + "x".repeat(250),
  ].join("\n");
  const r = stripContainer(doc);
  assert.ok(r.text.trim().startsWith("The work begins here"), `cut landed wrong: ${r.text.slice(0, 60)}`);
});

test("front matter is the book telling you what it is, and is carried over the cut", () => {
  const doc = [
    "The Project Gutenberg eBook of Something",
    "Title: Something",
    "Author: A Writer",
    "Translator: A Translator",
    "This eBook is for the use of anyone anywhere at no cost...",
    "",
    "*** START OF THE PROJECT GUTENBERG EBOOK SOMETHING ***",
    "",
    "Body text. " + "y".repeat(250),
  ].join("\n");
  const r = stripContainer(doc);
  const fields = Object.fromEntries(r.front.map((f) => [f.field.toLowerCase(), f.value]));
  assert.equal(fields.title, "Something");
  assert.equal(fields.translator, "A Translator", "the only place a translator is ever named");
  // And the licence sentence around them is NOT kept.
  assert.ok(!r.text.includes("no cost"));
});

test("CONTIGUITY: text is a slice of the source at offset, never a reconstruction", () => {
  // eoreader4.2 glued the front matter onto the front of the body, which is
  // right for a metadata harvester and wrong here — every anchor past the join
  // would be off by the header's length.
  const doc = [
    "Title: Something",
    "",
    "*** START OF THE PROJECT GUTENBERG EBOOK SOMETHING ***",
    "",
    "Body text begins. " + "z".repeat(250),
  ].join("\n");
  const r = stripContainer(doc);
  assert.equal(doc.slice(r.offset, r.offset + r.text.length), r.text);
  assert.ok(r.front.length > 0, "front matter is carried as a field, not inlined");
  assert.ok(!r.text.includes("Title:"), "and not prefixed onto the text");
});

test("the container does not end at the start marker", () => {
  // Producer credits, an ornamental rule and a boxed transcriber's note all
  // sit AFTER the marker. Leaving them in made a reader say a publisher's name
  // inside imagined prose.
  const doc = [
    "*** START OF THE PROJECT GUTENBERG EBOOK SOMETHING ***",
    "",
    "Produced by Someone and the Online Distributed Proofreading Team at",
    "https://www.pgdp.net.",
    "",
    "*       *       *       *       *",
    "",
    "+------------------------------+",
    "| Transcriber's Note:          |",
    "| Some remark about the text.  |",
    "+------------------------------+",
    "",
    "*       *       *       *       *",
    "",
    "The real first line of the work. " + "w".repeat(250),
  ].join("\n");
  const r = stripContainer(doc);
  assert.ok(r.text.trim().startsWith("The real first line"), `still container: ${r.text.slice(0, 60)}`);
  assert.ok(!r.text.includes("pgdp.net"));
  assert.ok(!r.text.includes("Transcriber"));
});

test("stripping stops at the work — an author's own ornament survives", () => {
  // The strip walks only the LEADING run. A scene break drawn the same way
  // inside the work is content.
  const doc = [
    "*** START OF THE PROJECT GUTENBERG EBOOK SOMETHING ***",
    "",
    "The work opens here and runs on. " + "q".repeat(250),
    "",
    "*       *       *       *       *",
    "",
    "And continues after the scene break.",
  ].join("\n");
  const r = stripContainer(doc);
  assert.ok(r.text.includes("*       *"), "an ornament inside the work is not container");
  assert.ok(r.text.includes("And continues after"));
});

test("a text with no markers passes through untouched", () => {
  const plain = "Just a document. " + "p".repeat(250);
  const r = stripContainer(plain);
  assert.equal(r.text, plain);
  assert.equal(r.offset, 0);
  assert.deepEqual([...r.front], []);
});

test("the error page is reported, not read as the work", () => {
  // PG's .txt redirect is served with a malformed Location header, so a client
  // that follows it lands on HTML. It carries no markers, survives stripping
  // untouched, and would otherwise be read as the novel — 4.2 recorded the
  // reader parsing Search/Donate/DOCTYPE as prose.
  const page = "<!DOCTYPE html>\n<html><body>Search Donate " + "n".repeat(300) + "</body></html>";
  assert.equal(stripContainer(page).looks_like_material, false);
  assert.equal(looksLikeMaterial("<?xml version=\"1.0\"?><rss>" + "m".repeat(300)), false);
  assert.equal(looksLikeMaterial("a real stretch of prose ".repeat(20)), true);
});

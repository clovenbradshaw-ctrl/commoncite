// eoreader6 · perceiver/text/spans — real meaningful spans, not arbitrary
// fixed-size chunks. Everything built earlier this session (motif
// detection, structure tests, significance) operated on chunkWords(words,
// 40) — 40-word windows with no relationship to sentence or clause
// boundaries. That's the wrong foundation for anything above it: heat-
// tracking needs a real unit to attach activation to, coref resolution
// needs real sentence boundaries to resolve a pronoun within.
//
// Ported from eoreader5's text-organ.js::splitSentences, a real, tested
// implementation — paragraph breaks are a harder boundary than any
// terminator (a chapter heading has no period and must not glue onto the
// next paragraph), closing quotes after a terminator are absorbed, and a
// terminator NOT followed by whitespace is treated as a probable
// abbreviation ("Mr.") rather than a sentence end. Not reinvented — CLAUDE.md
// names sentence segmentation with offsets as one of the consistently
// reinvented wheels in this project family.

// Container, not content. A Project Gutenberg file wraps the work in a
// licence header, a title block, and often a table of contents; none of it
// is the text being read, and leaving it in put a chapter-number list at the
// top of a salience report earlier in this session. Knowing where the
// container ends is received knowledge ABOUT THE FILE FORMAT — the same kind
// as knowing an mp3 carries an ID3 header — not a linguistic rule and not a
// word set: no claim is made here about any language's vocabulary. Texts
// without these markers pass through untouched.
// ANCHORED TO A WHOLE LINE, which eoreader4.2 had and this did not. The old
// shape here was `\*\*\*\s*START OF ...[^*]*\*\*\*` — it matches across line
// breaks and depends on the trailing stars being the next asterisks in the
// file, so a book whose title contains one, or a marker PG wrote slightly
// differently, drags the cut to the wrong place. A marker is a LINE.
const GUTENBERG_START = /^[^\S\n]*\*{3}[^\S\n]*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b[^\n]*$/im;
const GUTENBERG_END = /^[^\S\n]*\*{3}[^\S\n]*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b[^\n]*$/im;

// THE BOOK TELLING YOU WHAT IT IS, WHICH IS NOT CHROME — the distinction
// eoreader4.2 drew and the reason this list exists. Everything before the
// start marker is host furniture except these: they are the work's own front
// matter, and dropping them with the licence text loses the only place a
// translator or an edition is ever named. They are carried over the cut.
//
// These are English field names and therefore a fact about PG's file format,
// received on exactly the same terms as the markers themselves (II.2). No
// claim is made about any language's vocabulary — a file that does not use
// them simply keeps nothing.
const FRONT_FIELD = /^(?:Title|Author|Editor|Translator|Illustrator|Release date|Language|Original publication|Credits)\s*:/i;

// THE CONTAINER DOES NOT END AT THE START MARKER, and assuming it did put 354
// forms of transcriber's note into the material on Heidi. Measured: the
// perished ground of a standpoint reader turned out to be Project Gutenberg's
// producer credits, so a reader imagining prose reached back and said the
// publisher's name, a copyright year and a page number.
//
// After the marker PG typically continues with a producer credit block, an
// ornamental rule, and a boxed transcriber's note, and only then the work.
// Two of the three are recognised by FORM alone, which is what keeps this out
// of linguistic-rule territory:
//
//   RULE   a line of nothing but asterisks and space
//   BOX    a run of lines drawn out of + - | and space, or bounded by pipes
//
// Neither says anything about a language's vocabulary — they are typography,
// and a Devanagari or CJK file draws its boxes the same way. The third needs a
// format marker, and a PG URL is exactly the same kind of received knowledge
// about the file format as the START marker itself already is (an mp3 has an
// ID3 header; a PG file has a credit block).
//
// STRIPPING STOPS AT THE FIRST PARAGRAPH THAT IS NONE OF THESE. It never scans
// the body, so a rule or a box drawn inside the work — a table, a scene break
// — is content and survives. Bounding it that way is what makes this safe;
// an unbounded version would eat an author's own ornament.
const PG_CREDIT_URL = /\b(?:pgdp\.net|gutenberg\.org|www\.gutenberg)/i;
const ORNAMENT_RULE = /^[\s*]+$/;
const BOX_BLOCK = /^[\s+|=_-]*$/;
const BOX_ROW = /^\s*\|.*\|\s*$/;

const isContainerParagraph = (p) => {
  const trimmed = p.trim();
  if (!trimmed) return true;
  if (ORNAMENT_RULE.test(trimmed)) return true;
  if (PG_CREDIT_URL.test(trimmed)) return true;
  // A boxed block: every line is either a border or a piped row.
  const lines = trimmed.split("\n");
  if (lines.every((l) => BOX_BLOCK.test(l) || BOX_ROW.test(l))) return true;
  return false;
};

// The cell this organ occupies on the operator grid (engine/operators.js):
// SEG · Field · Clearing — sentence segmentation; abbreviations are injected
// priors, never a list. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "SEG", grain: "Ground" });

/**
 * Does what survived read as material at all, or as the container's error page?
 *
 * eoreader4.2's `looksLikeBook`, re-earned and renamed away from books.
 * Project Gutenberg's `.txt` redirect is served with a malformed Location
 * header, so a client that follows it lands on an HTML error page — which
 * carries no PG markers, survives stripping untouched, and gets read as the
 * work. 4.2 recorded the symptom exactly: "the reader parses site chrome
 * (Search / Donate / DOCTYPE) instead of the novel."
 *
 * Structural and cheap: too short to be anything, or it opens on a markup
 * tag. Nothing here knows a language. REPORTS, DOES NOT RULE — `stripContainer`
 * returns it as a field rather than refusing, because a caller reading a
 * genuinely tiny fragment is doing something legitimate and a perceiver is not
 * the place to decide it is not.
 */
export const looksLikeMaterial = (text) => {
  const t = String(text ?? "").replace(/^﻿/, "").trimStart();
  if (t.length < 200) return false;
  if (/^<(?:!doctype|html|head|body|div|meta|title|\?xml)\b/i.test(t)) return false;
  return true;
};

/**
 * Separate the work from the container it arrived in.
 *
 * Returns `{ text, offset, front, looks_like_material }`.
 *
 * THE CONTIGUITY CONTRACT IS WHY `front` IS A FIELD AND NOT A PREFIX.
 * eoreader4.2 returned the front-matter lines glued onto the front of the
 * body, which is right for a metadata harvester and wrong here: everything
 * downstream of this resolves spans by slicing the SOURCE at `offset`, so
 * `text` has to remain a contiguous slice of what came in. Prepending would
 * make every anchor past the join point wrong by the length of the header —
 * the same class of drift as the byte/character mix eoreader5 records in
 * `host/corpus.js` ("indexOf gives a CHARACTER index; anchors are byte
 * offsets"), arriving by a different road.
 *
 * So the front matter is carried, not discarded and not inlined.
 */
export const stripContainer = (text) => {
  let s = String(text ?? "");
  let offset = 0;
  const front = [];
  const start = s.match(GUTENBERG_START);
  if (start) {
    // The book telling you what it is, kept from the header before the cut.
    for (const line of s.slice(0, start.index).split("\n")) {
      const trimmed = line.trim();
      if (FRONT_FIELD.test(trimmed)) {
        const at = trimmed.indexOf(":");
        front.push(Object.freeze({ field: trimmed.slice(0, at).trim(), value: trimmed.slice(at + 1).trim() }));
      }
    }
    offset = start.index + start[0].length;
    s = s.slice(offset);

    // Walk the leading paragraphs and drop the ones that are still container.
    // Offsets are accumulated as we go, because everything downstream anchors
    // spans against this offset and a strip that forgot to move it would
    // silently shift every citation in the reader.
    for (;;) {
      const m = s.match(/^(\s*)([\s\S]*?)(\n\s*\n|$)/);
      if (!m) break;
      const paragraph = m[2];
      if (!paragraph.trim()) break;
      if (!isContainerParagraph(paragraph)) break;
      const consumed = m[0].length;
      if (consumed === 0) break;
      offset += consumed;
      s = s.slice(consumed);
    }
  }
  const end = s.match(GUTENBERG_END);
  if (end) s = s.slice(0, end.index);
  return { text: s, offset, front: Object.freeze(front), looks_like_material: looksLikeMaterial(s) };
};

import { SENTENCE_TERMINATORS, CLOSING_QUOTES } from "./priors.js";

const PARAGRAPH_BREAK = /\n\s*\n+/g;

// The guard this file used to rely on — "a terminator not followed by
// whitespace is probably an abbreviation" — catches `3.14` and does NOT catch
// `Mr. Darcy`, which is the case its own comment named. Measured on real text:
// "Mr. Collins" occurred in 0 of Pride and Prejudice's sentences against 145
// occurrences in the file, because every title was split off as a sentence of
// its own. War and Peace never showed it, since Russian titles ("Prince
// Vasíli", "Count Rostóv") carry no period — so the defect was invisible for
// exactly as long as the corpus was Russian.
//
// WHICH tokens are abbreviations is a fact about a language, so it is not
// decided here. It is injected (`options.abbreviations`) and lives as data in
// bin/priors/lang/*.json, on its way to eoPriors. This module stays
// language-agnostic in the same way material.js does: no list baked in.
//
// When nothing is injected the fallback is derived from the material itself,
// Zipf-style, with no word list: a token type ALWAYS written with a trailing
// period is an abbreviation, since a real sentence-final word also turns up
// mid-sentence without one. A length bar taken from the text's own 10th
// -percentile token length keeps out words that merely happen to be
// text-final-only in a short sample.
//
// The fallback is a floor, not a substitute, and it is fragile in a way worth
// stating precisely rather than implying it is close enough. Two limits, both
// measured:
//
//   - the length bar on real English prose comes out at 2 characters, so a
//     three-character title like `Mrs` is out of reach by construction;
//   - "always written with a period" is all-or-nothing, so ONE period-less
//     occurrence anywhere — including in a licence header — disqualifies a
//     token for the whole text.
//
// Together those are not a small shortfall. On Frankenstein the fallback
// recovers `Mr` and `M` (13 and 8 sentences repaired). On Pride and Prejudice
// it recovers NOTHING: `Mr. Darcy` stays at 0 sentences derived, against 249
// with the prior. A caller that has a prior should pass it.
const TOKEN_BEFORE_DOT = /(\p{L}[\p{L}\p{M}]*)\./gu;
const TOKEN_RE = /\p{L}[\p{L}\p{M}]*/gu;

export const deriveAbbreviations = (text) => {
  const withDot = new Map();
  const total = new Map();
  const lengths = [];
  for (const m of text.matchAll(TOKEN_BEFORE_DOT)) withDot.set(m[1], (withDot.get(m[1]) || 0) + 1);
  for (const m of text.matchAll(TOKEN_RE)) {
    total.set(m[0], (total.get(m[0]) || 0) + 1);
    lengths.push(m[0].length);
  }
  if (lengths.length === 0) return new Set();
  lengths.sort((a, b) => a - b);
  const bar = lengths[Math.floor(lengths.length * 0.1)];
  const out = new Set();
  for (const [token, n] of withDot) if (n >= 2 && total.get(token) === n && token.length <= bar) out.add(token);
  return out;
};

/** The token immediately before position i, or "" if there is none. */
const tokenEndingAt = (s, i) => {
  let j = i;
  while (j > 0 && /[\p{L}\p{M}]/u.test(s[j - 1])) j--;
  return s.slice(j, i);
};

const pushSentence = (s, start, end, out) => {
  const raw = s.slice(start, end);
  const trimmed = raw.trim();
  if (!trimmed) return;
  const leading = raw.length - raw.trimStart().length;
  out.push({ text: trimmed, offset: start + leading, order: out.length });
};

const splitSentencesInRange = (s, rangeStart, rangeEnd, out, abbreviations) => {
  let start = rangeStart;
  for (let i = rangeStart; i < rangeEnd; i++) {
    if (!SENTENCE_TERMINATORS.has(s[i])) continue;
    let end = i + 1;
    while (end < rangeEnd && CLOSING_QUOTES.has(s[end])) end += 1;
    if (end < rangeEnd && !/\s/.test(s[end])) continue; // a decimal point, not a stop
    if (s[i] === "." && abbreviations.has(tokenEndingAt(s, i))) continue; // a title, not a stop
    pushSentence(s, start, end, out);
    start = end;
  }
  pushSentence(s, start, rangeEnd, out);
};

/**
 * @param {string} text
 * @param {object} [options]
 * @param {Iterable<string>|null} [options.abbreviations] - tokens that take a
 *   trailing period without ending a sentence. A LANGUAGE prior; pass one from
 *   bin/priors/lang/*.json. Omit to derive a weaker set from the text itself.
 */
export const splitSentences = (text, { abbreviations = null } = {}) => {
  const s = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const abbrev = abbreviations ? new Set(abbreviations) : deriveAbbreviations(s);
  const paragraphs = [];
  let paraStart = 0;
  let pm;
  PARAGRAPH_BREAK.lastIndex = 0;
  while ((pm = PARAGRAPH_BREAK.exec(s))) {
    paragraphs.push({ start: paraStart, end: pm.index });
    paraStart = pm.index + pm[0].length;
  }
  paragraphs.push({ start: paraStart, end: s.length });

  const sentences = [];
  for (const para of paragraphs) splitSentencesInRange(s, para.start, para.end, sentences, abbrev);
  sentences.forEach((sent, i) => { sent.order = i; });
  return sentences;
};

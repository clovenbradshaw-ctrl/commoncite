// eoreader6 · surfer-snips — the no-model NL-prompt surfer, on the real corpus.
//
// A reader says what they want in words; the surfer addresses the prompt to
// the corpus mechanically and snips the segment — with no model anywhere in
// the path. The address ladder, re-earned from eoreader-chat's
// engineReadSegment and the mcp snip tool:
//
//   1. SOURCE   — one document is the corpus; several need the prompt to say
//                which, and an unsaid one is a typed gap.
//   2. HEADING  — "chapter 2", "letter 1", "chapter 18": the boundary the
//                prompt addresses by form. Arabic and roman are one count, so
//                CHAPTER XVIII answers to eighteen.
//   3. CONTENT  — no heading addressed: the prompt's substantive tokens find
//                the best line, and the structural segment around it is the
//                snip — the cluster around the passage the reader described.
//   4. WINDOW   — a passage with no structural boundary in reach comes back
//                as a labelled context window, never an invented chapter.
//
// Every snip is registered in provenance (refId) so a later reader can cite
// it. Every failure is a typed gap, never a guessed answer.
//
// A PARTICULAR PARAGRAPH, SNIPPED BY WORDS. The surfer snips at structural
// height — the segment (chapter/letter) that brackets the passage the prompt
// describes — so a paragraph test asks: does the snip CONTAIN the paragraph
// the prompt addresses? War and Peace is the hard case: every book restarts
// its chapter numerals, so a "chapter N" heading address is seventeen-way
// ambiguous (a typed gap, honestly), and only a content address can reach a
// specific paragraph. Each case below names a real, famous passage by its
// own words and asserts it lands inside the snipped segment. Mechanical
// matcher, so the prompts carry the passage's distinctive vocabulary.

import { readFileSync } from "node:fs";
import { createSession, admitChunked } from "../packages/host/corpus.js";
import { executePrompt } from "../packages/host/surfer.js";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";

const DEFAULT_PATHS = [
  "scripts/adversarial/fixtures/pg84-frankenstein.txt",
  "/Users/mlacy/Downloads/pg2600.txt",
];
const paths = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const only = process.argv.includes("--only");

const session = createSession();
for (const p of (paths.length ? paths : DEFAULT_PATHS)) {
  const { text } = stripContainer(
    readFileSync(p, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
  );
  const { chunks } = admitChunked(session, { text, sourceId: `source:${p}` });
  console.log(`ingested ${chunks} chunks from ${p.split("/").pop()}`);
}
console.log("");

const prompts = [
  "letter 1 of pg84",
  "chapter 2 of pg84",
  "the scene about the creature waking in pg84",
  "chapter 18 of pg84",
  "the very start of pg84",
];

const show = (out, i) => {
  console.log(`[${i + 1}] ${out.prompt}`);
  if (out.gap) {
    console.log(`    gap: ${out.gap} — ${out.reason}`);
    return;
  }
  const head = out.text.trim().slice(0, 90).replace(/\s+/g, " ");
  console.log(`    ${out.segment}  (addressed by ${out.addressed_by})`);
  console.log(`    bytes ${out.byte_start}–${out.byte_end} · refId ${out.refId}${out.windowed ? " · WINDOW" : ""}`);
  console.log(`    "${head}${out.text.length > 90 ? "…" : ""}"`);
};

const run = (session, prompts) => {
  for (const [i, p] of prompts.entries()) show(executePrompt(session, p), i);
  console.log("");
};

// ── a particular paragraph, addressed by words ───────────────────────────────
//
// War and Peace, three famous passages, three natural-language prompts. Each
// case is a prompt and the exact paragraph it must land inside. The check is
// whitespace-folded (the snip preserves the source's own line wrapping), and
// every failure is counted — a prompt that misses its paragraph is a real,
// visible regression, not a silent wrong segment.
const PARAGRAPH_CASES = [
  {
    name: "the opening salon — Anna Pávlovna's greeting",
    prompt:
      "in pg2600, the opening scene where Anna Pávlovna warns Prince Vasíli that Genoa and Lucca are now just family estates of the Buonapartes",
    mustContain: "family estates of the Buonapartes",
  },
  {
    name: "the comet over the Arbat — Pierre's bright star",
    prompt:
      "in pg2600, Pierre standing at the entrance to the Arbat Square gazing up at the enormous brilliant comet with its long uplifted tail above the Prechistenka Boulevard",
    mustContain: "comet with its long luminous tail",
  },
  {
    name: "the transfigured old oak — Prince Andrew's springtime joy",
    prompt:
      "in pg2600, the old oak transfigured, spreading out a canopy of sappy dark-green foliage, and Prince Andrew seized by an unreasoning springtime feeling of joy and renewal",
    mustContain: "spreading out a canopy of sappy dark-green foliage",
  },
];

const flat = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ");

const testParagraphs = (session, cases) => {
  let pass = 0;
  console.log("── a particular paragraph, sniped by words ──");
  for (const c of cases) {
    const out = executePrompt(session, c.prompt);
    if (out.gap) {
      console.log(`  FAIL  ${c.name}`);
      console.log(`        gap: ${out.gap} — ${out.reason}`);
      continue;
    }
    const ok = flat(out.text).includes(flat(c.mustContain));
    if (ok) pass++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${c.name}`);
    console.log(`        ${out.segment}  (addressed by ${out.addressed_by})  bytes ${out.byte_start}–${out.byte_end}${out.windowed ? " · WINDOW" : ""}`);
    if (!ok) console.log(`        the paragraph "${c.mustContain}" is not inside the snip`);
  }
  console.log(`\n${pass}/${cases.length} paragraphs landed in their snip\n`);
  return pass === cases.length;
};

run(session, prompts);
if (!only && paths.length === 0) {
  // War and Peace — ask by chapter number across numeral forms, plus a
  // content address, so the ladder is demonstrated on both corpora.
  run(session, [
    "War and Peace — chapter 2 of pg2600",
    "the salon soirée in pg2600",
  ]);
  testParagraphs(session, PARAGRAPH_CASES);
}

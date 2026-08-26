// eoreader6 · heat-trace — wires up discourse/index.js's activateMotif/
// decayMotifs (built earlier, never called this session) to real sentence
// spans and content words. Not entity-specific, not prior-dependent: any
// content word can be a candidate "noun with heat" — this is the general
// salience-tracking layer everything else (coref, structure, significance)
// should be reading from, not a special mechanism for one named character.

import { readFileSync } from "node:fs";
import { splitSentences } from "../packages/engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, contentWords } from "../packages/engine/perceiver/text/material.js";
import { createSession, activateMotif, tick, activeMotifs } from "../discourse/index.js";

const TEXT_PATH = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const text = readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const sentences = splitSentences(text);
const table = buildFrequencyTable(tokenize(text)); // whole-document table for relevance filtering only, not for surprisal

console.error(`=== heat trace: ${sentences.length} real sentences, ${TEXT_PATH} ===\n`);

const session = createSession();
const trace = [];
for (const sent of sentences) {
  const words = tokenize(sent.text);
  const content = contentWords(words, table);
  for (const w of content) activateMotif(session, w, 1);
  tick(session); // advances session.tick AND decays — one tick per sentence read
  trace.push({ order: sent.order, offset: sent.offset, hot: activeMotifs(session, 0.3).map((m) => m.name) });
}

// report the hottest moments: sentences where the active-motif set is
// richest (many things simultaneously "hot") — a candidate proxy for scene
// density, entirely from real content-word recurrence, no names, no priors
const richest = [...trace].sort((a, b) => b.hot.length - a.hot.length).slice(0, 10);
console.error("richest heat moments (most simultaneously active content words):");
for (const r of richest) {
  const pct = ((r.offset / text.length) * 100).toFixed(1);
  console.error(`  sentence ${r.order} (${pct}%): [${r.hot.join(", ")}]`);
}

const totalHotEvents = trace.reduce((s, t) => s + t.hot.length, 0);
console.error(`\nmean simultaneously-hot words per sentence: ${(totalHotEvents / trace.length).toFixed(2)}`);

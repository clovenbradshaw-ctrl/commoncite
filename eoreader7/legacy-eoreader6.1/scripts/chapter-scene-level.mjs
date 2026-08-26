// eoreader6 · chapter-scene-level — DISCOVER whether "chapter" is a holon
// level above "scene," rather than assuming it from the name. Uses nul's
// own level() — the same primitive the growth-rule conformance test claims
// to enforce for organs, but currently only checks via import-graph
// structure, not the actual statistical test. This applies the real thing
// to real chapter markers in real books.
//
// scene ground:   burstiness over fine-grain (500-char) surprisal blocks,
//                 the whole document.
// chapter ground: burstiness over one value per REAL "Chapter N" marker
//                 (mean of that chapter's fine-grain blocks).
// For many real fine-grain observations, level(observed, sceneGround,
// chapterGround) says whether the chapter ground constrains (above), is
// enabled by (below), or is a peer of the scene ground — for THIS material,
// empirically, not because "chapter" sounds bigger than "scene."

import { readFileSync } from "node:fs";
import { ground, level, isGap } from "../nul/index.js";
import { buildFrequencyTable, surprisalMicrobits, tokenize } from "../packages/engine/perceiver/text/material.js";

const FINE_CHARS = 500;
const CHAPTER_RE = /^(?:CHAPTER|Chapter)\s+[IVXLC0-9]+/m;

const runFor = (label, path, sampleCount = 40) => {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const table = buildFrequencyTable(tokenize(text));

  // real chapter boundaries, not assumed ones
  const lines = text.split("\n");
  let offset = 0;
  const chapterStarts = [];
  for (const line of lines) {
    if (CHAPTER_RE.test(line)) chapterStarts.push(offset);
    offset += line.length + 1;
  }
  chapterStarts.push(text.length);
  if (chapterStarts.length < 5) { console.log(`${label}: too few chapter markers (${chapterStarts.length - 1}), skipping`); return; }

  // fine-grain "scene" series
  const fineBlocks = [];
  for (let i = 0; i < text.length; i += FINE_CHARS) fineBlocks.push({ start: i, text: text.slice(i, i + FINE_CHARS) });
  const fineSeries = fineBlocks.map((b) => surprisalMicrobits(b.text, table));

  // coarse-grain "chapter" series: mean fine-grain surprisal per real chapter
  const chapterSeries = [];
  for (let c = 0; c < chapterStarts.length - 1; c++) {
    const lo = chapterStarts[c], hi = chapterStarts[c + 1];
    const inChapter = fineBlocks.filter((b) => b.start >= lo && b.start < hi);
    if (inChapter.length === 0) continue;
    const vals = inChapter.map((b) => surprisalMicrobits(b.text, table));
    chapterSeries.push(vals.reduce((s, v) => s + v, 0) / vals.length);
  }

  const sceneWindow = Math.max(2, Math.min(12, Math.floor(fineSeries.length / 10)));
  const chapterWindow = Math.max(2, Math.min(5, Math.floor(chapterSeries.length / 4)));

  const sceneGround = ground({ material: fineSeries, draws: 200, window: sceneWindow, seed: 1 });
  const chapterGround = ground({ material: chapterSeries, draws: 200, window: chapterWindow, seed: 2 });

  if (isGap(sceneGround) || isGap(chapterGround)) {
    console.log(`${label}: gap building a ground`, isGap(sceneGround) ? sceneGround : chapterGround);
    return;
  }

  console.log(`\n=== ${label}: ${chapterSeries.length} real chapters, ${fineSeries.length} scene-blocks ===`);

  // Same lesson as span-golden-run.mjs, a third time: a raw single block is
  // incommensurate with a ground built from windowed-mean (burstiness)
  // statistics — it will spuriously exceed_witness almost everywhere. The
  // comparable observation is a windowed mean at the scene grain, matching
  // how the ground's own statistic is defined. level() compares by RANK, so
  // it doesn't need the two grounds' raw scales to match — only `observed`
  // needs to be a well-formed quantity in the first place.
  const relations = {};
  const gaps = {};
  const step = Math.max(1, Math.floor(fineSeries.length / sampleCount));
  let sampled = 0;
  for (let i = 0; i + sceneWindow <= fineSeries.length; i += step) {
    sampled++;
    let sum = 0;
    for (let j = i; j < i + sceneWindow; j++) sum += fineSeries[j];
    const observed = sum / sceneWindow;
    const lv = level(observed, sceneGround, chapterGround);
    if (isGap(lv)) { gaps[lv.gap] = (gaps[lv.gap] || 0) + 1; continue; }
    relations[lv.relationship] = (relations[lv.relationship] || 0) + 1;
  }
  const resolved = Object.values(relations).reduce((s, v) => s + v, 0);
  console.log(`  sampled ${sampled} scene-observations, ${resolved} resolved, ${sampled - resolved} gapped`);
  for (const [rel, count] of Object.entries(relations).sort((a, b) => b[1] - a[1])) {
    console.log(`    resolved as "${rel}": ${count}/${resolved} (${((count / resolved) * 100).toFixed(0)}%)`);
  }
  for (const [g, count] of Object.entries(gaps).sort((a, b) => b[1] - a[1])) {
    console.log(`    gapped as "${g}": ${count}/${sampled - resolved}`);
  }
};

runFor("Frankenstein", "scripts/adversarial/fixtures/pg84-frankenstein.txt");
runFor("War and Peace", "/Users/mlacy/Downloads/pg2600.txt");

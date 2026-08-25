#!/usr/bin/env node
// Challenge #22 — "Storage growth bound over sustained use"
//
// Claim under test: storage / discard-log growth should be bounded over
// sustained use, and any 'forgetting' mechanism (if built) should reduce
// footprint, not just add to it.
//
// Method: run 20 successive ingest + "consolidation" (search+fold) cycles
// over a ROTATING set of 7 real documents (mostly Project Gutenberg
// fixtures already present in this repo's adversarial fixture set, plus
// odyssey-greek.txt at repo root) — a compressed-timescale proxy for a
// reader opening books from a small personal library over many days,
// including re-opening ones they've already read (which is the realistic
// sustained-use case here: earlier survey work — see #20 in the same
// category — established that this pipeline has NO export/reimport or
// disk-persistence layer at all, so a real app restart means re-ingesting
// the same handful of source files from scratch, not resuming from state).
//
// Because there is no on-disk ledger/discard-log file to stat (confirmed
// below, Part B), "storage" is measured as the in-process proxy that
// actually exists: session.spans (the span registry), session.documents
// (the per-document text/pieces/chunks record), and process heap.
//
// Run: node --expose-gc challenge-22-storage-growth-bound-over-sustained-use.mjs
// (--expose-gc is optional; heap numbers just print as null without it)

import { readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createSession,
  admitChunked,
  ingestFile,
  searchSpans,
  spanUnits,
  foldSpans,
} from "../../packages/host/corpus.js";
import { createGraph, readTriples } from "../../packages/engine/emergence/graph.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

// ── the rotating working set ────────────────────────────────────────────
// Real Project Gutenberg texts. Six of these were already fetched onto disk
// by other adversarial-challenge scripts in this same fixtures/ directory
// (real content, not regenerated here — reused as-is); odyssey-greek.txt is
// the untracked fixture at the repo root named in the task setup.
const FIXTURES = [
  { id: "odyssey-greek", path: join(REPO_ROOT, "odyssey-greek.txt") },
  { id: "odyssey-full-en", path: join(__dirname, "fixtures", "odyssey-full.txt") },
  { id: "alice", path: join(__dirname, "fixtures", "alice-raw.txt") },
  { id: "frankenstein", path: join(__dirname, "fixtures", "frankenstein-excerpt.txt") },
  { id: "pride-prejudice", path: join(__dirname, "fixtures", "pride-prejudice-raw.txt") },
  { id: "cookery", path: join(__dirname, "fixtures", "cookery-22114-raw.txt") },
  { id: "tesla", path: join(__dirname, "fixtures", "tesla-27400-raw.txt") },
];

for (const f of FIXTURES) {
  if (!existsSync(f.path)) {
    console.error(`FATAL: fixture missing: ${f.path}`);
    process.exit(1);
  }
  f.bytes = statSync(f.path).size;
}

const CYCLES = 20;

console.log("=== Challenge #22: storage growth bound over sustained use ===");
console.log(`node ${process.version}`);
console.log(`rotating working set (${FIXTURES.length} real documents, ${(FIXTURES.reduce((s, f) => s + f.bytes, 0) / 1024).toFixed(0)}KB unique total):`);
for (const f of FIXTURES) console.log(`  ${f.id.padEnd(16)} ${(f.bytes / 1024).toFixed(1)}KB  ${f.path}`);
console.log(`cycles: ${CYCLES}`);
console.log("spanCap: Number.MAX_SAFE_INTEGER — matches eochat's live production config");
console.log("  (server/engine-ground.js:68 — createSession({ spanCap: Number.MAX_SAFE_INTEGER }))");
console.log("");

// ── Part A: the growth-cycle run ────────────────────────────────────────

const session = createSession({ spanCap: Number.MAX_SAFE_INTEGER });
const admitCounts = new Map(FIXTURES.map((f) => [f.id, 0]));

function snapshot() {
  let totalDocTextChars = 0, totalPieces = 0, totalChunks = 0;
  for (const doc of session.documents.values()) {
    totalDocTextChars += (doc.text || "").length;
    totalPieces += doc.pieces.length;
    totalChunks += doc.chunks.length;
  }
  let heapUsedMB = null;
  if (global.gc) {
    global.gc();
    heapUsedMB = +(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  }
  return { spans: session.spans.size, documents: session.documents.size, totalDocTextChars, totalPieces, totalChunks, heapUsedMB };
}

const rows = [];
let prevTotalDocTextChars = 0;

for (let cycle = 1; cycle <= CYCLES; cycle++) {
  const doc = FIXTURES[(cycle - 1) % FIXTURES.length];
  admitCounts.set(doc.id, admitCounts.get(doc.id) + 1);
  const nthAdmit = admitCounts.get(doc.id);

  const t0 = performance.now();
  const { chunks } = ingestFile(session, doc.path);
  // "consolidation": the retrieve+fold step eochat's engine-ground.js wraps
  // around this same corpus module (searchSpans -> spanUnits -> foldSpans).
  const { spans: hits } = searchSpans(session, { query: "the man said to her that he would", limit: 10 });
  const folded = foldSpans(session, { units: spanUnits(session, hits), query: "the man said to her that he would", tokenBudget: 800 });
  const t1 = performance.now();

  const docRecord = session.documents.get(`source:${doc.path}`);
  const snap = snapshot();
  const marginalGrowth = snap.totalDocTextChars - prevTotalDocTextChars;
  prevTotalDocTextChars = snap.totalDocTextChars;

  rows.push({
    cycle,
    docId: doc.id,
    nthAdmit,
    isRepeat: nthAdmit > 1,
    sourceBytes: doc.bytes,
    chunksThisAdmit: chunks,
    thisDocTextChars: docRecord.text.length,
    expectedIfDeduped: doc.bytes, // what .text length SHOULD be if repeat-admission were deduped
    foldedUnits: folded.selected.length,
    marginalGrowthChars: marginalGrowth,
    ms: +(t1 - t0).toFixed(1),
    ...snap,
  });
}

console.log("--- per-cycle table ---");
console.log(
  "cyc".padStart(3) + "  " + "doc".padEnd(16) + "admit#".padStart(7) + "  " +
  "spans".padStart(6) + "  " + "docs".padStart(5) + "  " +
  "totalDocTextChars".padStart(18) + "  " + "Δthisatcycle".padStart(13) + "  " +
  "thisDoc.text".padStart(13) + "  " + "src.bytes".padStart(10) + "  " +
  "heapMB".padStart(8) + "  " + "ms".padStart(7),
);
for (const r of rows) {
  console.log(
    String(r.cycle).padStart(3) + "  " + r.docId.padEnd(16) + String(r.nthAdmit).padStart(7) + "  " +
    String(r.spans).padStart(6) + "  " + String(r.documents).padStart(5) + "  " +
    String(r.totalDocTextChars).padStart(18) + "  " + String(r.marginalGrowthChars).padStart(13) + "  " +
    String(r.thisDocTextChars).padStart(13) + "  " + String(r.sourceBytes).padStart(10) + "  " +
    String(r.heapUsedMB).padStart(8) + "  " + String(r.ms).padStart(7),
  );
}

console.log("");
console.log("--- growth analysis ---");

const uniqueBytes = FIXTURES.reduce((s, f) => s + f.bytes, 0);
const finalSpans = rows[rows.length - 1].spans;
const finalDocTextChars = rows[rows.length - 1].totalDocTextChars;
const spansAfterFirstFullPass = rows[FIXTURES.length - 1].spans;
console.log(`span registry: ${spansAfterFirstFullPass} spans after first full pass (cycle ${FIXTURES.length}, all 7 docs seen once) -> ${finalSpans} spans after cycle ${CYCLES} (${CYCLES - FIXTURES.length} more cycles, all repeats).`);
console.log(`  span-registry delta over ${CYCLES - FIXTURES.length} repeat cycles: ${finalSpans - spansAfterFirstFullPass} (content-addressed span ids => repeat admission should be near-idempotent).`);

console.log(`in-memory document text: ${uniqueBytes} bytes of genuinely unique source content across all 7 docs.`);
console.log(`  totalDocTextChars after cycle ${CYCLES}: ${finalDocTextChars} chars (${(finalDocTextChars / uniqueBytes).toFixed(2)}x the unique-content byte count).`);

const repeatRows = rows.filter((r) => r.isRepeat);
const repeatGrowthSum = repeatRows.reduce((s, r) => s + r.marginalGrowthChars, 0);
console.log(`sum of totalDocTextChars growth on REPEAT-admission cycles only (${repeatRows.length} of ${CYCLES} cycles, zero genuinely new bytes): ${repeatGrowthSum} chars.`);
console.log(`  if repeat-admission were deduplicated, this number should be 0 (or near-0). It is ${repeatGrowthSum === 0 ? "0 — DEDUPED" : `${repeatGrowthSum} — NOT deduped, unbounded per repeat`}.`);

for (const f of FIXTURES) {
  const finalRecord = session.documents.get(`source:${f.path}`);
  const admits = admitCounts.get(f.id);
  console.log(
    `  ${f.id.padEnd(16)} admitted ${admits}x, source ${f.bytes}B -> final .text length ${finalRecord.text.length}B ` +
    `(${(finalRecord.text.length / f.bytes).toFixed(2)}x source; ${admits}x would be exactly ${admits.toFixed(2)}x if wholly unbounded)`,
  );
}

// ── Part B: is anything actually written to disk anywhere in this run? ──
console.log("");
console.log("--- Part B: on-disk footprint (static + empirical) ---");
console.log("static grep (already run before this script, see agent notes): no writeFileSync/appendFileSync/fs.promises.writeFile");
console.log("in packages/, event_log/, discourse/, provenance/, nul/, formation/, frame/, holon_level/, temporality/, verdict/, cascade/.");
console.log("createSession() (packages/host/corpus.js) returns a plain object of native Maps; no toJSON, no persist/restore pair.");
console.log("This script itself performs zero fs writes (verified by the wrapper's `find -newer` diff — see wrapper output above/below,");
console.log("or run this script's shell wrapper: touch a marker, run this file, `find <repo> -newer marker -type f` should be empty).");

// ── Part C: does a 'forgetting'/pruning/GC mechanism exist ANYWHERE, ────
// and if so, does it actually reduce footprint?
console.log("");
console.log("--- Part C: existing forgetting/pruning/GC mechanisms ---");
console.log("grep -rn 'evict|forget|prune|compact|garbage|LRU' packages/ found matches ONLY in:");
console.log("  packages/host/sing.js               (gamma/pruneBelow params passed through to createGraph)");
console.log("  packages/engine/emergence/graph.js  (createGraph/readTriples: the actual decay+delete logic)");
console.log("  packages/engine/emergence/people.js, tiers.js (prose referring to the same graph mechanism)");
console.log("  packages/engine/generation/belief.js, standpoint.js (an UNRELATED math decay param also named 'rho' —");
console.log("    a discounted mixture-of-experts weighting term, pure/in-memory/per-call, not a footprint-reducing GC)");
console.log("None of these touch session.spans or session.documents (the corpus/fold state measured in Part A).");
console.log("");
console.log("Is graph.js's pruneBelow wired into eochat's PRODUCTION ingest/fold pipeline at all?");
console.log("grep for sing|Singer|singRun in /Users/mlacy/Documents/3.0/eochat/server/engine-ground.js: checked, zero real hits");
console.log("(only substring false-positives like \"missing\", \"single\", \"answering\"). sing.js's self-directed reading loop");
console.log("is a separate host organ (packages/host/sing.js) that eochat's live engine-ground.js does not import.");
console.log("");
console.log("Live demonstration: does graph.js's pruneBelow ACTUALLY shrink its own structure when triggered?");

{
  const gamma = 0.5, pruneBelow = 0.05;
  const g = createGraph({ gamma, pruneBelow });
  // one batch of real relations, then many empty batches so every edge decays
  // (gamma=0.5 per pass) until it crosses pruneBelow and is deleted.
  const triples = [
    { subject: "penelope", verb: "waits", object: "odysseus", polarity: 1 },
    { subject: "telemachus", verb: "seeks", object: "father", polarity: 1 },
    { subject: "suitors", verb: "court", object: "penelope", polarity: 1 },
  ];
  readTriples(g, triples);
  const sizeAfterFirstBatch = g.edges.size;
  console.log(`  after 1 batch of ${triples.length} triples: graph.edges.size = ${sizeAfterFirstBatch}`);
  let passesToEmpty = 0;
  for (let i = 0; i < 30 && g.edges.size > 0; i++) {
    readTriples(g, []); // no new material — everything just decays this pass
    passesToEmpty++;
  }
  console.log(`  after ${passesToEmpty} more passes of NO new material (pure decay): graph.edges.size = ${g.edges.size}`);
  console.log(`  VERDICT for this sub-mechanism: pruneBelow genuinely deletes decayed edges (${sizeAfterFirstBatch} -> ${g.edges.size}),`);
  console.log(`  i.e. where this forgetting mechanism exists, it does reduce footprint. But it lives on a DIFFERENT`);
  console.log(`  structure (packages/engine/emergence/graph.js's belief graph, used only by packages/host/sing.js),`);
  console.log(`  never wired to session.spans/session.documents (Part A) or to eochat's production ingest path.`);
}

console.log("");
console.log("=== DONE ===");

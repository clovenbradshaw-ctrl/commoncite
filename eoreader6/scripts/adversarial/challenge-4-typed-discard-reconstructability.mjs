// challenge-4-typed-discard-reconstructability.mjs
//
// ADVERSARIAL TEST — Challenge #4: "Typed-discard reconstructability"
//
// CLAIM UNDER TEST: "The discard log retains enough to re-fold, not just a
// hash." I.e. when the self-directed read/gate/commit loop (packages/host/
// sing.js) discards a candidate span (verdict "refuse" or "censored"), the
// record it keeps in the persisted log should let an auditor answer, FROM
// THE LOG ALONE — no re-running the pipeline, no inspecting the live
// judge()/reader state — "which null did this fail, and at what threshold?"
//
// METHOD
//   1. Run the real, unmodified production pipeline exactly as
//      scripts/sing-book.mjs does: createSession -> admitChunked ->
//      discoverRelationVocab -> createSinger -> singRun, on a real Gutenberg
//      text (a slice of Frankenstein, pg84.txt).
//   2. Treat singer.refused / singer.censored (the arrays singPass() in
//      packages/host/sing.js actually pushes discarded records into) as THE
//      persisted typed-discard log — this is the only durable record any
//      caller of this pipeline is given for a discarded span; the full
//      `verdict` object judge() returns is a local variable inside singPass
//      that is never returned or stored beyond the four fields it copies.
//   3. Pick one discarded record at random (Math.random — this is a test
//      harness, not core engine code, so no purity constraint applies here).
//   4. Attempt to reconstruct, using ONLY the JSON-serializable fields of
//      that record: (a) which of the 8 measured operators (NUL/SIG/INS/SEG/
//      CON/SYN/DEF/EVA) the candidate failed or fell inside, (b) the
//      observed count for that operator, (c) the null's support bounds
//      [lo, hi] it was measured against.
//   5. Separately (clearly labelled, NOT part of the reconstruction attempt)
//      show what judge() actually computed and had in hand at the moment of
//      the verdict, by calling the exact same pure, deterministic organ
//      (packages/engine/search/index.js::judge) on the exact same
//      (unmutated — refuse/censored never commit) reader graph, the exact
//      same re-derived triples, and the exact same seed. This is done to
//      PROVE the missing numbers were real and computed, not merely
//      hypothetical — it is oracle/ground-truth, not a reconstruction
//      technique available to a real downstream auditor.
//
// A PASS would require step 4 to succeed using only the record's own fields.
// A FAIL is step 4 coming up structurally short — the record has no field
// that could ever answer "which operator, what threshold" — confirmed
// against the oracle in step 5.

import { readFileSync } from "node:fs";
import { createSession, admitChunked } from "../../packages/host/corpus.js";
import { stripContainer, splitSentences } from "../../packages/engine/perceiver/text/spans.js";
import { createSinger, singPass } from "../../packages/host/sing.js";
import { extractSurfaces } from "../../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../../packages/engine/perceiver/text/material.js";
import { discoverRelationVocab, extractRelations } from "../../packages/engine/perceiver/text/relations.js";
import { judge } from "../../packages/engine/search/index.js";
import { MEASURED } from "../../packages/engine/emergence/revision.js";

const BOOK_PATH = "/Users/mlacy/Documents/Default Project/pg84.txt";

// Declared numbers for THIS run. Smaller than sing-book.mjs's canonical
// 40-pass/60-reseed run so the adversarial script finishes in reasonable
// time; still real, still >= the organs' declared minimums, still exercising
// the identical production code path (createSinger/singPass), not a mock.
const GAMMA = 0.95;
const PRUNE_BELOW = 1e-4;
const RESEEDS = 20;
const SEED = 20260801;
const ALPHA = 1;
const LIMIT = 10;
const PASSES = 30;
// A real slice of Frankenstein, DUPLICATED once. Empirically (this survey),
// a single unbroken 40-pass run over the whole book (as sing-book.mjs's own
// canonical constants do) never once produces a refuse/censored verdict —
// the reader's own forward search keeps meeting genuinely novel material
// (new characters, new places) before its declared 40-pass ceiling, so
// newNodes>0 wins the verdict on every single pass (see judge()'s first
// branch, packages/engine/search/index.js). That is itself a real, reported
// finding (see the script's closing remarks), but it means a fixture that
// wants to adversarially test discard RECONSTRUCTABILITY must force actual
// discards to occur. Duplicating a real slice back-to-back does that
// honestly: once the first copy has been read, the second copy's identical
// sentences introduce no new nodes/edges and reliably draw refuse verdicts
// from the SAME unmodified gate — no mocking, no shortcut through judge().
const SLICE_CHARS = 60000;

console.log("=".repeat(78));
console.log("CHALLENGE #4 — Typed-discard reconstructability");
console.log("=".repeat(78));

const raw = readFileSync(BOOK_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const { text: stripped } = stripContainer(raw);
const slice = stripped.slice(0, SLICE_CHARS);
// Real Gutenberg text, duplicated once back-to-back — see the SLICE_CHARS
// comment above for why this is necessary to elicit real discards.
const text = slice + "\n\n" + slice;

const session = createSession();
const { chunks } = admitChunked(session, { text, sourceId: `source:${BOOK_PATH}` });
console.log(`ingested ${chunks} chunks (first ${SLICE_CHARS} chars of ${BOOK_PATH.split("/").pop()}, duplicated once)`);

const table = buildFrequencyTable(tokenize(text));
const functionWords = functionWordSet(table);
const surfaces = extractSurfaces(splitSentences(text), { functionWords });
const { verbs } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 });
console.log(`relation vocabulary: ${verbs.size} verbs measured from the text`);

const singer = createSinger({
  session, gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED,
  alpha: ALPHA, limit: LIMIT, verbs,
});

// Run pass-by-pass with the REAL exported singPass (not a reimplementation),
// exactly what singRun() does internally. Critically, for every refuse/
// censored pass we capture the oracle verdict RIGHT HERE, in the same
// iteration, before any later pass has a chance to commit a preserve and
// mutate singer.reader out from under it. judge() never mutates the reader
// itself (that's the whole point of the gate — see search/index.js's own
// header), so at this exact point in the loop singer.reader is bit-identical
// to what it was when singPass's internal judge() call produced this pass's
// verdict; calling judge() again here, same graph, same re-derived triples,
// same seed, reproduces that exact computation. Waiting until after the loop
// to do this would be wrong: later preserves would have grown the graph past
// the state this pass was actually judged against (an earlier version of
// this script made exactly that mistake).
const records = [];
const oraclesByPass = new Map(); // pass -> the full judge() verdict, captured live
for (let k = 0; k < PASSES; k++) {
  const r = singPass(singer);
  records.push(r);
  if (r.verdict === "refuse" || r.verdict === "censored") {
    const span = singer.session.spans.get(r.span_id);
    const triples = extractRelations(span.text, { verbs: singer.verbs });
    const oracleVerdict = judge(singer.reader, triples, { reseeds: singer.reseeds, seed: singer.seed + r.pass });
    oraclesByPass.set(r.pass, oracleVerdict);
  }
  if (r.gap === "no_candidate") break;
}

console.log("");
console.log(`RUN ended after ${singer.pass} pass(es) — ${singer.preserved.length} preserved, ` +
  `${singer.refused.length} refused, ${singer.censored.length} censored, ${singer.gaps.length} silent.`);

// ---------------------------------------------------------------------------
// STEP 2/3 — THE PERSISTED TYPED-DISCARD LOG.
//
// singer.refused and singer.censored ARE the log: they are the only place a
// discarded candidate's record survives past the pass that produced it. Pool
// both discard kinds and pick one at random.
// ---------------------------------------------------------------------------
const discardLog = [
  ...singer.refused.map((r) => ({ ...r, discardKind: "refused" })),
  ...singer.censored.map((r) => ({ ...r, discardKind: "censored" })),
];

if (discardLog.length === 0) {
  console.log("");
  console.log("NO DISCARDS PRODUCED in this run — cannot run the challenge on this slice/seed.");
  process.exit(2);
}

const pickIdx = Math.floor(Math.random() * discardLog.length);
const picked = discardLog[pickIdx];

console.log("");
console.log("-".repeat(78));
console.log(`PICKED discard #${pickIdx} of ${discardLog.length} (kind=${picked.discardKind}), pass ${picked.pass}`);
console.log("-".repeat(78));
console.log("THE PERSISTED LOG RECORD (exactly what singer.refused/singer.censored holds");
console.log("— i.e. everything a downstream auditor with only the log, not the live run,");
console.log("would ever see for this span):");
console.log("");
console.log(JSON.stringify(picked, null, 2));

// ---------------------------------------------------------------------------
// STEP 4 — RECONSTRUCTION ATTEMPT, USING ONLY THE FIELDS ABOVE.
//
// The challenge's question: "which null did it fail, at what threshold?"
// Translated into this codebase's vocabulary: which of the 8 MEASURED
// operators (NUL/SIG/INS/SEG/CON/SYN/DEF/EVA) was the one whose support
// (or lack of it) produced this verdict, what was the OBSERVED count for
// that operator, and what were the null's [lo, hi] SUPPORT bounds it was
// judged against?
// ---------------------------------------------------------------------------
console.log("");
console.log("-".repeat(78));
console.log("RECONSTRUCTION ATTEMPT — using ONLY the fields printed above");
console.log("-".repeat(78));

const logFields = Object.keys(picked).sort();
console.log(`Fields available in the persisted record: ${logFields.join(", ")}`);

const canAnswer = (question, available) => console.log(`  Q: ${question}\n     ${available ? "ANSWERABLE" : "NOT ANSWERABLE from the record"}`);

// Does the record name which of the 8 operators was decisive?
const nameableOperator = picked.what && MEASURED.some((op) => picked.what.includes(op));
canAnswer("Which of the 8 measured operators (NUL/SIG/INS/SEG/CON/SYN/DEF/EVA) failed?", nameableOperator);

// Does the record carry an observed count for the decisive operator?
const hasObservedCount = Object.prototype.hasOwnProperty.call(picked, "operators") ||
  Object.prototype.hasOwnProperty.call(picked, "counts");
canAnswer("What was the OBSERVED count for the decisive operator?", hasObservedCount);

// Does the record carry the null's support bounds [lo, hi]?
const hasSupportBounds = Object.prototype.hasOwnProperty.call(picked, "operators") &&
  Object.values(picked.operators ?? {}).some((v) => Array.isArray(v?.support));
canAnswer("What were the null's support bounds [lo, hi] the observation was measured against?", hasSupportBounds);

// record.ground looks promising by name — check whether it is actually the
// statistical ground/null (as "ground" means everywhere else in this
// codebase, e.g. nul/index.js) or something else entirely.
console.log("");
console.log(`  record.ground = ${JSON.stringify(picked.ground)}`);
console.log("  This is the READER GRAPH's own size (nodes/edges/rotation_capable),");
console.log("  NOT the statistical null/support the candidate was measured against.");
console.log("  A reader of the log who assumes \"ground\" means what it means everywhere");
console.log("  else in this codebase (nul/index.js's perturbed-null object with .samples)");
console.log("  would be actively misled, not merely under-informed.");

const reconstructionSucceeded = nameableOperator && hasObservedCount && hasSupportBounds;

// ---------------------------------------------------------------------------
// STEP 5 — ORACLE / GROUND TRUTH (NOT a reconstruction technique).
//
// Uses the verdict object captured LIVE, in the same loop iteration that
// produced `picked` (see the capture point above) — i.e. before any later
// pass's preserve could grow singer.reader past the state this pass was
// actually judged against. This is done ONLY to confirm the numbers existed
// and were computed at verdict time, not to claim this is available to a
// real downstream auditor — a real auditor does NOT have singer.reader or
// this captured object; neither is part of the persisted log, and both stop
// existing when the process that produced them exits.
// ---------------------------------------------------------------------------
console.log("");
console.log("-".repeat(78));
console.log("ORACLE (ground truth only — NOT a reconstruction available from the log)");
console.log("-".repeat(78));

const oracleVerdict = oraclesByPass.get(picked.pass);

console.log("What judge() actually computed and returned during the real pass");
console.log("(captured live, in the same loop iteration that produced the logged");
console.log("record, before any later preserve could mutate singer.reader — a real");
console.log("auditor holding only the persisted log could never do this: singer.reader");
console.log("is not part of the log and does not survive the process that produced it):");
console.log("");
console.log(JSON.stringify(oracleVerdict, null, 2));

console.log("");
console.log(`sanity check — oracle.verdict (${oracleVerdict.verdict}) matches logged verdict (${picked.verdict}): ` +
  `${oracleVerdict.verdict === picked.verdict}`);

const decisiveOps = MEASURED.filter((op) => {
  const o = oracleVerdict.operators[op];
  return picked.discardKind === "censored" ? o.observed > 0 && !o.exceed && !o.within : o.within;
});
console.log(`operator(s) actually decisive for this ${picked.discardKind} verdict: ${JSON.stringify(decisiveOps)}`);
for (const op of decisiveOps) {
  console.log(`  ${op}: observed=${oracleVerdict.operators[op].observed}  ` +
    `support=[${oracleVerdict.operators[op].support.join(", ")}]  ` +
    `(this exact information exists in the live verdict object and is DROPPED ` +
    `by packages/host/sing.js's singPass before the record is pushed to ` +
    `s.refused/s.censored)`);
}

// ---------------------------------------------------------------------------
// VERDICT
// ---------------------------------------------------------------------------
console.log("");
console.log("=".repeat(78));
if (reconstructionSucceeded) {
  console.log("VERDICT: PASS — the persisted record answered which operator/threshold.");
} else {
  console.log("VERDICT: FAIL — the persisted typed-discard log (singer.refused/censored,");
  console.log("via packages/host/sing.js::singPass) does not retain which of the 8");
  console.log("measured operators drove a refuse/censored verdict, nor that operator's");
  console.log("observed count, nor the null's support bounds it was measured against.");
  console.log("The oracle above proves this data was computed by judge() and existed at");
  console.log("verdict time (packages/engine/search/index.js) — it is discarded, not");
  console.log("absent from the mechanism. record.ground is graph size, not the null.");
}
console.log("=".repeat(78));

process.exit(reconstructionSucceeded ? 0 : 1);

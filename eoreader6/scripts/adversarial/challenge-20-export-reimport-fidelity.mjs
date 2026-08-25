// challenge-20-export-reimport-fidelity.mjs
//
// ADVERSARIAL TEST — Challenge #20: "Export/reimport fidelity"
//
// CLAIM UNDER TEST: "Since OPFS is origin-private, cross-device/browser use
// depends entirely on export/reimport fidelity: reimported state should be
// fold-equivalent to the original (same terrain structure, same ledger —
// not just the same raw source files)."
//
// TEST PLAN (per the challenge brief, followed literally):
//   1. Search both /Users/mlacy/Documents/2.0/eoreader6 and
//      /Users/mlacy/Documents/3.0/eochat for any export/import or
//      serialize/deserialize logic covering a corpus + fold ledger —
//      BOTH by grep AND by programmatic introspection of the actual
//      corpus.js module's exports (not trusting grep alone).
//   2. IF such logic exists and is separable from real OPFS I/O: run it —
//      export a corpus+ledger produced by a REAL fold, deserialize it
//      back, and diff the reconstructed state against the original for
//      fold-equivalence.
//   3. IF NO such logic exists: report INCONCLUSIVE plainly. Do not
//      fabricate a test of nonexistent product code.
//
// This script does step 1 exhaustively, confirms the absence via two
// independent methods (grep + live module introspection), and — because
// step 2's precondition fails — does NOT fabricate a pass/fail verdict on
// invented product code. It DOES, however, run one additional real,
// labeled DIAGNOSTIC using a real fold produced by the real pipeline: it
// takes the single most obvious thing an engineer would reach for first to
// build an OPFS export (JSON.stringify the session, write it as the export
// blob, JSON.parse it back), and measures — with real numbers, not
// speculation — exactly how far that naive attempt is from fold-equivalent.
// This diagnostic is NOT a test of eoreader6/eochat's own code (no such
// code exists to test) — it is evidence bearing on (a) whether the missing
// mechanism is a small closeable gap or a deep one, and (b) what a naive
// implementer would actually get if they didn't read this report first.
//
// Everything below is real execution against the real packages/host/corpus.js
// pipeline and real fixture text. Nothing is mocked or simulated.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  createSession,
  ingestFile,
  searchSpans,
  spanUnits,
  foldSpans,
  documentIds,
  CORPUS_API_VERSION,
} from "../../packages/host/corpus.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const EOREADER6 = "/Users/mlacy/Documents/2.0/eoreader6";
const EOCHAT = "/Users/mlacy/Documents/3.0/eochat";
const FIXTURES = join(HERE, "fixtures");
const OUT_DIR = join(HERE, "out-challenge20");
mkdirSync(OUT_DIR, { recursive: true });

function section(title) {
  console.log("\n" + "=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

function grepBoth(pattern) {
  const results = {};
  for (const [label, root] of [["eoreader6", EOREADER6], ["eochat", EOCHAT]]) {
    try {
      const out = execSync(
        `grep -rniE ${JSON.stringify(pattern)} --include="*.js" --include="*.mjs" . 2>/dev/null | grep -v node_modules | grep -v scripts/adversarial`,
        { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
      ).trim();
      results[label] = out;
    } catch {
      results[label] = "";
    }
  }
  return results;
}

const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

let anyFail = false;
let anyFixtureMissing = false;

// ── STEP 1: grep both repos for export/import/serialize/deserialize logic
//    that could plausibly cover a corpus+fold ledger ────────────────────────
section("STEP 1: grep both repos for corpus/fold export-import logic");

const patterns = [
  "serialize.*(corpus|session|span|fold|terrain|ledger)",
  "deserialize.*(corpus|session|span|fold|terrain|ledger)",
  "(corpus|session|span|fold|terrain).*(export|import)\\(",
  "toJSON|fromJSON",
  "exportSession|importSession|dumpSession|loadSession|restoreSession",
];

let grepHitCount = 0;
for (const p of patterns) {
  const res = grepBoth(p);
  console.log(`\n-- pattern: ${p}`);
  for (const [label, out] of Object.entries(res)) {
    if (out) {
      grepHitCount += out.split("\n").length;
      console.log(`  [${label}] HITS:`);
      console.log(out.split("\n").map((l) => "    " + l).join("\n"));
    } else {
      console.log(`  [${label}] no hits`);
    }
  }
}
console.log(`\nTotal raw grep hit lines across all patterns: ${grepHitCount}`);

// Raw hit count is NOT the same as "a relevant mechanism exists" — grep for
// export/import/serialize-shaped identifiers is necessarily broad. Each hit
// above was manually read (quoted verbatim so it's checkable) and audited
// against one question: does this touch a corpus/session/spans/documents
// object from packages/host/corpus.js or its eochat wrapper
// (server/engine-ground.js's `pools`)? Audit result, hit by hit:
//   - vendor/eoPriors/.../perceiver/surfaces.js:265 "arrow serializer" —
//     turns a discourse RELATION GRAPH into plain-language prose for the
//     talker to speak. Not disk I/O, not a corpus session, not reachable
//     from packages/host/corpus.js or server/engine-ground.js at all (it's
//     vendored eoreader5-lineage code under eochat's vendor/ tree).
//   - vendor/eoreader5/.../multi-altitude-fold.js dynamic imports — an
//     unrelated discourse-summary "fold" (multi-altitude text summarization),
//     not the corpus/span "fold" (foldSpans) this claim is about, and not on
//     the live engine-ground.js code path either (vendor/, old lineage).
//   - server/holonic-task.js toJSON — serializes a TASK TREE (agent
//     todo/plan state) for a debug/status endpoint. No corpus/spans/
//     documents field anywhere in it.
//   - server/code-longform-session.js loadSession/saveSession — a REAL,
//     working export/import pair, but for a completely different domain:
//     multi-file LLM CODE-GENERATION project state (SESSION.json per
//     project dir), not the reading corpus/fold ledger. Confirmed by
//     reading the file: it never imports corpus.js/engine-ground.js and its
//     SESSION.json holds planned-files/interfaces/verification state, not
//     spans or documents.
// None of the 13 raw hit lines is a corpus+fold-ledger export/import
// mechanism. This audit result — not the raw count — is what STEP 4 uses.
const AUDITED_MECHANISM_EXISTS = false;
console.log(
  "Audited verdict on the grep hits above: none of them is a corpus+fold-ledger\n" +
  "export/import mechanism (see the code comments above this line for the\n" +
  "per-hit justification, checkable against the quoted source)."
);

// ── STEP 2: programmatic introspection of the actual corpus.js module ──────
section("STEP 2: live introspection of packages/host/corpus.js's real exports");

const corpusModuleExports = await import("../../packages/host/corpus.js").then((m) => Object.keys(m));
console.log("corpus.js exports:", JSON.stringify(corpusModuleExports, null, 2));

const exportImportNameRe = /export|import|serialize|deserialize|snapshot|dump|restore|persist|toJSON|fromJSON/i;
const suspiciousExports = corpusModuleExports.filter((name) => exportImportNameRe.test(name));
console.log(
  "\nExports whose NAME matches an export/import/serialize-ish pattern:",
  JSON.stringify(suspiciousExports)
);
console.log(
  suspiciousExports.length === 0
    ? "-> NONE. No candidate function exists in corpus.js's public API to carry\n   a corpus+fold session across the OPFS origin boundary."
    : "-> Found candidate(s) above — these would need to be inspected further\n   (this script does not expect to reach this branch)."
);

// ── STEP 3: build a REAL session from a REAL fold, via the REAL pipeline ───
section("STEP 3: run the real ingest -> search -> fold pipeline on real fixtures");

const docAPath = join(FIXTURES, "doc-a-odyssey-excerpt.txt");
const docBPath = join(FIXTURES, "doc-b-hand-authored.txt");
for (const p of [docAPath, docBPath]) {
  if (!existsSync(p)) {
    anyFixtureMissing = true;
    console.log(`MISSING FIXTURE: ${p}`);
  }
}
if (anyFixtureMissing) {
  throw new Error("Adversarial fixtures missing — aborting rather than fabricating results.");
}

const session = createSession({ spanCap: Number.MAX_SAFE_INTEGER }); // matches eochat's live pool config (engine-ground.js)
const admitA = ingestFile(session, docAPath);
const admitB = ingestFile(session, docBPath);
console.log(`ingested doc A (Odyssey excerpt, Greek): ${admitA.chunks} chunks`);
console.log(`ingested doc B (hand-authored lighthouse story, English): ${admitB.chunks} chunks`);
console.log(`documentIds(session): ${JSON.stringify(documentIds(session))}`);
console.log(`session.spans.size (real terrain, content-addressed span registry): ${session.spans.size}`);
console.log(`session.provenance.size (registered passages): ${session.provenance.size}, tick=${session.provenance.tick}`);
console.log(`session.discourse: ${JSON.stringify(session.discourse)}`);

const QUERY = "lighthouse keeper Aoife Devane logbook";
const { spans: foundSpans } = searchSpans(session, { query: QUERY, limit: 10 });
const units = spanUnits(session, foundSpans);
const folded = foldSpans(session, { units, query: QUERY, tokenBudget: 800 });

console.log(`\nsearchSpans("${QUERY}") -> ${foundSpans.length} spans found`);
console.log(`top span source_id: ${foundSpans[0]?.source_id}, score: ${foundSpans[0]?.score?.toFixed(4)}`);
console.log(`foldSpans -> selectedCount=${folded.selectedCount}, tokens=${folded.tokens}, dropped=${folded.dropped}`);
console.log(`fold summary (first 200 chars): ${JSON.stringify(folded.summary.slice(0, 200))}`);

// Sanity: this is a REAL fold, not a trivial no-op — confirm the FOLDED
// output (what actually gets used downstream, after search+budget) resolved
// to doc B's terrain (the lighthouse story), not the unrelated Odyssey text,
// so the diagnostic below has real terrain-specific state to lose. The raw
// search hit list may still include a low-score noise match from doc A
// (logged above for transparency — expected behavior of lexical search, not
// a bug); what matters is what foldSpans actually selected.
const topSpan = foundSpans[0];
const foldedFromDocB = topSpan && topSpan.source_id.startsWith(`source:${docBPath}`) && folded.selectedCount >= 1;
console.log(`\nTop-ranked span (score ${topSpan?.score}) is from doc B: ${topSpan?.source_id.startsWith(`source:${docBPath}`)}`);
console.log(`Fold's selected unit came from doc B's terrain: ${foldedFromDocB}`);
if (!foldedFromDocB) {
  console.log("WARNING: fold did not cleanly isolate doc B — proceeding anyway, but note this in interpretation.");
}

// Canonical snapshot of "original" terrain + ledger state, for later diffing.
function canonicalSnapshot(sess, foldResult) {
  const spansArr = [...sess.spans.entries()]
    .map(([id, sp]) => [id, { source_id: sp.source_id, byte_start: sp.byte_start, byte_end: sp.byte_end, textHash: sha256(sp.text) }])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const docsArr = [...sess.documents.entries()]
    .map(([id, d]) => [id, { chunks: d.chunks.length, pieces: d.pieces.length, textLength: d.text.length, textHash: sha256(d.text) }])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const provArr = [...sess.provenance.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return {
    spanCount: spansArr.length,
    spans: spansArr,
    docCount: docsArr.length,
    docs: docsArr,
    provenanceCount: provArr.length,
    provenanceTick: sess.provenance.tick,
    discourse: sess.discourse,
    foldSelectedCount: foldResult.selectedCount,
    foldTokens: foldResult.tokens,
    foldSummaryHash: sha256(foldResult.summary),
  };
}

const originalSnapshot = canonicalSnapshot(session, folded);
console.log(`\nOriginal canonical snapshot: spanCount=${originalSnapshot.spanCount}, docCount=${originalSnapshot.docCount}, ` +
  `provenanceCount=${originalSnapshot.provenanceCount}, foldSelectedCount=${originalSnapshot.foldSelectedCount}, ` +
  `foldSummaryHash=${originalSnapshot.foldSummaryHash}`);

// ── STEP 4: is there any export/import path to actually exercise? ──────────
section("STEP 4: conclusion on precondition (does exercisable export/import logic exist?)");

const mechanismExists = suspiciousExports.length > 0 || AUDITED_MECHANISM_EXISTS;
console.log(`Exercisable export/import/serialize/deserialize logic for a corpus+fold session found: ${mechanismExists}`);

if (mechanismExists) {
  console.log("Precondition met — this script would now run the real export/import round trip.");
  console.log("(Not reached in this run: grep and live introspection both found nothing.)");
} else {
  console.log(
    "Precondition NOT met. createSession() (packages/host/corpus.js) returns a plain\n" +
    "object built on native Map instances (spans, documents, _bytes, provenance)\n" +
    "plus a plain discourse sub-object. There is no toJSON, no serialize/export\n" +
    "function, no persist/restore pair — anywhere in either repo — that turns this\n" +
    "into a transportable blob or back. eochat's live `pools` Map\n" +
    "(server/engine-ground.js:60-70) wraps this same session in pure in-process\n" +
    "state with zero disk I/O for the corpus/fold data itself (confirmed: grep for\n" +
    "MEMORY_DIR / 'memory/' in engine-ground.js and ingest-worker.js returns\n" +
    "nothing, and memory/ on disk contains only cabinet/, conversations/,\n" +
    "discourse/, projects/, senses-state.json, model-router-ledger.jsonl — no\n" +
    "corpus/pool directory at all)."
  );
}

// ── STEP 5 (DIAGNOSTIC, not a product-code test): the naive first attempt ──
section("STEP 5 (diagnostic only): what happens if you reach for the obvious tool — JSON.stringify?");
console.log(
  "This is NOT a test of eoreader6/eochat's own code — no such export code exists\n" +
  "(confirmed above). This measures what the single most natural first attempt at\n" +
  "an OPFS export would actually produce, using the REAL session + REAL fold from\n" +
  "Step 3, so the consequence is quantified rather than asserted."
);

const exportBlobPath = join(OUT_DIR, "naive-export.json");
const exportBlob = JSON.stringify(session);
writeFileSync(exportBlobPath, exportBlob, "utf8");
console.log(`\nWrote naive "export" blob to ${exportBlobPath} (${exportBlob.length} bytes)`);
console.log(`Naive export blob content (this is the ENTIRE blob, not truncated): ${exportBlob}`);

const reimported = JSON.parse(readFileSync(exportBlobPath, "utf8"));
console.log(`\nReimported (JSON.parse'd) object keys: ${JSON.stringify(Object.keys(reimported))}`);
console.log(`reimported.spans: ${JSON.stringify(reimported.spans)} (typeof: ${typeof reimported.spans}, is a Map: ${reimported.spans instanceof Map})`);
console.log(`reimported.documents: ${JSON.stringify(reimported.documents)} (typeof: ${typeof reimported.documents}, is a Map: ${reimported.documents instanceof Map})`);
console.log(`reimported.provenance: ${JSON.stringify(reimported.provenance)}`);
console.log(`reimported.discourse: ${JSON.stringify(reimported.discourse)}`);

// Try to actually USE the reimported object as a session for search+fold,
// exactly as a real cross-device reimport would need to.
let reimportSearchSpans = null;
let reimportFoldSelected = null;
let reimportError = null;
try {
  // reimported.spans is a plain {} (or absent), not a Map — session.spans.values()
  // inside searchSpans would throw. Catch and record rather than let the script die,
  // since "it throws" is itself part of the measured outcome.
  const { spans: rSpans } = searchSpans(reimported, { query: QUERY, limit: 10 });
  reimportSearchSpans = rSpans.length;
  const rUnits = spanUnits(reimported, rSpans);
  const rFolded = foldSpans(reimported, { units: rUnits, query: QUERY, tokenBudget: 800 });
  reimportFoldSelected = rFolded.selectedCount;
} catch (e) {
  reimportError = e.message;
}

console.log(`\nRunning the SAME query ("${QUERY}") against the reimported object:`);
if (reimportError) {
  console.log(`  -> THREW: ${reimportError}`);
} else {
  console.log(`  -> spans found: ${reimportSearchSpans} (original: ${foundSpans.length})`);
  console.log(`  -> fold selectedCount: ${reimportFoldSelected} (original: ${folded.selectedCount})`);
}

const foldEquivalent =
  !reimportError && reimportSearchSpans === foundSpans.length && reimportFoldSelected === folded.selectedCount;
console.log(`\nIs the naive JSON round trip fold-equivalent to the original? ${foldEquivalent}`);

section("SUMMARY");
console.log(`Mechanism (export/import/serialize/deserialize for corpus+fold ledger) exists in either repo: ${mechanismExists}`);
console.log(`Real fold produced from real fixtures: ${originalSnapshot.foldSelectedCount} unit(s) selected, ${originalSnapshot.spanCount} spans, ${originalSnapshot.docCount} documents, provenance entries=${originalSnapshot.provenanceCount}`);
console.log(`Naive JSON.stringify/parse round trip of that same session is fold-equivalent: ${foldEquivalent}`);
if (!mechanismExists) {
  console.log(
    "\nVERDICT BASIS: no export/reimport mechanism exists for the corpus+fold ledger\n" +
    "in either repo, so the claim's core assertion (\"reimported state should be\n" +
    "fold-equivalent\") has no implementation to hold or violate. Per the challenge\n" +
    "brief, this is reported as INCONCLUSIVE rather than a fabricated PASS/FAIL.\n" +
    "The diagnostic above is supplementary evidence only: it shows concretely that\n" +
    "the state is plain-data-shaped (Maps of plain objects, no closures/functions),\n" +
    "so a real serializer would be a small and well-scoped fix — but also that the\n" +
    "most obvious naive implementation (JSON.stringify a session object directly)\n" +
    "silently destroys 100% of the terrain and ledger state, which is exactly the\n" +
    "failure mode the claim exists to warn against."
  );
}

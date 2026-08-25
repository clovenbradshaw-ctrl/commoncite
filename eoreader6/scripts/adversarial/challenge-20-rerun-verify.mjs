// challenge-20-rerun-verify.mjs — INDEPENDENT re-verification, post-fix-pass.
//
// The original challenge-20 script (challenge-20-export-reimport-fidelity.mjs)
// predates serializeSession/deserializeSession. It still correctly DETECTS
// the new exports (Step 2's live introspection), but its Step 4 branch for
// "mechanism exists" was written as an unreachable stub ("not reached in
// this run") — so as-is it now reports a stale/incomplete picture: it
// confirms the mechanism exists but never actually exercises it, falling
// through to the old naive-JSON.stringify diagnostic instead.
//
// This script reconstructs the SAME adversarial scenario the brief asked
// for, faithfully, using the SAME real fixtures and the SAME
// canonicalSnapshot methodology as the original script's Step 3, but
// actually exercises the real serializeSession/deserializeSession pair that
// now exists, and diffs the reconstructed state against the original for
// fold-equivalence (terrain + ledger, not just raw files).

import { readFileSync, existsSync } from "node:fs";
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
  serializeSession,
  deserializeSession,
  CORPUS_API_VERSION,
} from "../../packages/host/corpus.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

function section(title) {
  console.log("\n" + "=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

let anyFail = false;
const check = (label, cond, extra = "") => {
  console.log(`  [${cond ? "PASS" : "FAIL"}] ${label}${extra ? " — " + extra : ""}`);
  if (!cond) anyFail = true;
};

section("STEP A: real ingest -> search -> fold pipeline on real fixtures (same as original script's Step 3)");

const docAPath = join(FIXTURES, "doc-a-odyssey-excerpt.txt");
const docBPath = join(FIXTURES, "doc-b-hand-authored.txt");
for (const p of [docAPath, docBPath]) {
  if (!existsSync(p)) throw new Error(`Missing fixture: ${p}`);
}

const session = createSession({ spanCap: Number.MAX_SAFE_INTEGER });
const admitA = ingestFile(session, docAPath);
const admitB = ingestFile(session, docBPath);
console.log(`ingested doc A: ${admitA.chunks} chunks; doc B: ${admitB.chunks} chunks`);
console.log(`session.spans.size=${session.spans.size}, documents=${documentIds(session).length}, provenance.size=${session.provenance.size}, tick=${session.provenance.tick}`);

const QUERY = "lighthouse keeper Aoife Devane logbook";
const originalHits = searchSpans(session, { query: QUERY, limit: 10 });
const originalUnits = spanUnits(session, originalHits.spans);
const originalFold = foldSpans(session, { units: originalUnits, query: QUERY, tokenBudget: 800 });
console.log(`searchSpans -> ${originalHits.spans.length} hits; foldSpans -> selectedCount=${originalFold.selectedCount}, tokens=${originalFold.tokens}`);
console.log(`fold summary hash: ${sha256(originalFold.summary)}`);

section("STEP B: serializeSession -> JSON.stringify -> JSON.parse -> deserializeSession (the real OPFS export/import shape)");

const blob = serializeSession(session);
check("serializeSession returns schema CorpusSession@1", blob.schema === "CorpusSession@1", `got ${blob.schema}`);
const jsonText = JSON.stringify(blob);
console.log(`Serialized blob JSON length: ${jsonText.length} bytes`);
const reimported = deserializeSession(JSON.parse(jsonText));

section("STEP C: structural fidelity — Maps reconstructed, not plain objects");
check("reimported.spans instanceof Map", reimported.spans instanceof Map);
check("reimported.documents instanceof Map", reimported.documents instanceof Map);
check("reimported.provenance instanceof Map", reimported.provenance instanceof Map);
check("reimported.spans.size === original", reimported.spans.size === session.spans.size, `${reimported.spans.size} vs ${session.spans.size}`);
check("reimported.documents.size === original", reimported.documents.size === session.documents.size, `${reimported.documents.size} vs ${session.documents.size}`);
check("reimported.provenance.size === original", reimported.provenance.size === session.provenance.size, `${reimported.provenance.size} vs ${session.provenance.size}`);
check("reimported.provenance.tick === original", reimported.provenance.tick === session.provenance.tick, `${reimported.provenance.tick} vs ${session.provenance.tick}`);
check("reimported.apiVersion === CORPUS_API_VERSION", reimported.apiVersion === CORPUS_API_VERSION);

section("STEP D: byte-accurate ledger fidelity — every span's text/byte-range survives exactly");
let spanMismatches = 0;
for (const [id, sp] of session.spans) {
  const re = reimported.spans.get(id);
  if (!re || re.text !== sp.text || re.byte_start !== sp.byte_start || re.byte_end !== sp.byte_end) {
    spanMismatches++;
    console.log(`  MISMATCH on span ${id}`);
  }
}
check(`all ${session.spans.size} spans byte-identical after reimport`, spanMismatches === 0, `${spanMismatches} mismatches`);

let docMismatches = 0;
for (const [id, d] of session.documents) {
  const re = reimported.documents.get(id);
  if (!re || re.text !== d.text || re.chunks.length !== d.chunks.length) {
    docMismatches++;
    console.log(`  MISMATCH on document ${id}`);
  }
}
check(`all ${session.documents.size} documents byte-identical after reimport`, docMismatches === 0, `${docMismatches} mismatches`);

let provMismatches = 0;
const origProvEntries = [...session.provenance.entries()];
for (const [k, v] of origProvEntries) {
  const re = reimported.provenance.get(k);
  if (JSON.stringify(re) !== JSON.stringify(v)) provMismatches++;
}
check(`all ${origProvEntries.length} provenance entries identical after reimport`, provMismatches === 0, `${provMismatches} mismatches`);

section("STEP E: fold-equivalence — re-running search+fold against the REIMPORTED session, comparing to the original");

const reimportedHits = searchSpans(reimported, { query: QUERY, limit: 10 });
const reimportedUnits = spanUnits(reimported, reimportedHits.spans);
const reimportedFold = foldSpans(reimported, { units: reimportedUnits, query: QUERY, tokenBudget: 800 });

check("same number of search hits", reimportedHits.spans.length === originalHits.spans.length, `${reimportedHits.spans.length} vs ${originalHits.spans.length}`);
check("same top-ranked span source_id", reimportedHits.spans[0]?.source_id === originalHits.spans[0]?.source_id);
check("same top-ranked span score", reimportedHits.spans[0]?.score === originalHits.spans[0]?.score, `${reimportedHits.spans[0]?.score} vs ${originalHits.spans[0]?.score}`);
check("same fold selectedCount", reimportedFold.selectedCount === originalFold.selectedCount, `${reimportedFold.selectedCount} vs ${originalFold.selectedCount}`);
check("same fold tokens", reimportedFold.tokens === originalFold.tokens, `${reimportedFold.tokens} vs ${originalFold.tokens}`);
check("same fold dropped count", reimportedFold.dropped === originalFold.dropped, `${reimportedFold.dropped} vs ${originalFold.dropped}`);
check("byte-identical fold summary text", reimportedFold.summary === originalFold.summary,
  reimportedFold.summary === originalFold.summary ? "" : `orig hash ${sha256(originalFold.summary)} vs reimport hash ${sha256(reimportedFold.summary)}`);

section("STEP F: negative control — deserializeSession still refuses malformed/foreign blobs (schema guard not bypassed)");
try {
  deserializeSession({ not: "a session" });
  check("throws on non-schema blob", false, "did NOT throw");
} catch (e) {
  check("throws on non-schema blob", e instanceof TypeError, e.message);
}

section("SUMMARY");
console.log(`Original: spans=${session.spans.size} documents=${session.documents.size} provenance=${session.provenance.size} foldSelected=${originalFold.selectedCount} foldSummaryHash=${sha256(originalFold.summary)}`);
console.log(`Reimported: spans=${reimported.spans.size} documents=${reimported.documents.size} provenance=${reimported.provenance.size} foldSelected=${reimportedFold.selectedCount} foldSummaryHash=${sha256(reimportedFold.summary)}`);
console.log(`\nOVERALL: ${anyFail ? "FAIL — one or more checks above failed" : "PASS — reimported session is fold-equivalent to the original (terrain + ledger, real fixtures, real fold)"}`);
process.exit(anyFail ? 1 : 0);

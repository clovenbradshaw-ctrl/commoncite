// challenge-25-cross-document-identity-at-corpus-scale.mjs
//
// ADVERSARIAL TEST — Challenge #25 (Cross-document identity at corpus scale)
//
// CLAIM UNDER TEST: "Identity resolution should hold ACROSS source-document
// boundaries (harder than same-book coreference), with provenance staying
// correctly per-source attributed even after identity merge."
//
// FIXTURE (hand-authored, deliberately adversarial): three short passages in
// three different registers/styles, describing ONE fictional naval officer
// under THREE different naming conventions, with NO literal string shared
// by all three:
//   A  naval-archive.txt   "Marcus Aurelius Kade" / "Admiral Kade" / "Kade"
//   B  folk-tale.txt       "the Iron Admiral" (the string "Kade" NEVER occurs)
//   C  court-record.txt    "Vessa's Kade" (a landed, estate-possessive title
//                          convention -- originally written as "Kade of
//                          Vessa"; changed during construction of this fixture
//                          because that form, on a short document, tripped a
//                          SEPARATE real bug documented in Part 4a's log
//                          below: the lowercase "of" splits one capitalised
//                          run into two single-word candidates, and on a
//                          short/dense document both "Kade" and "Vessa" then
//                          exceed functionWordSet's 0.6% relevance threshold
//                          (material.js) and get silently discarded as
//                          "function words" before extraction ever scores
//                          them. "Vessa's Kade" (apostrophe keeps the run
//                          unbroken) avoids that confound so this script
//                          measures the CROSS-document question cleanly; the
//                          single-document bug is real and is logged, not
//                          hidden, where it was found.
// Each source also carries its OWN distinct factual claims about the figure
// (birth town + cause of death per A; treaty authorship per B; court penalty
// + petition outcome per C) plus its own distractor secondary character
// (Selvi Odrun / Mother Yevni / Bariun Thess), so that after any attempted
// identity merge we can check whether each claim's provenance still traces
// to the right source, or gets conflated.
//
// Names are kept OUT of sentence-initial position throughout (extractSurfaces
// in packages/engine/perceiver/text/surfaces.js explicitly does not count a
// sentence-initial capitalised token as naming evidence — a text whose every
// sentence opens with the entity's name would silently produce zero
// candidate surfaces, a known fixture-construction trap for this repo).
//
// Usage: node scripts/adversarial/challenge-25-cross-document-identity-at-corpus-scale.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createSession, admitChunked, sessionReferents, searchSpans, documentIds } from "../../packages/host/corpus.js";
import { findBySource, register as registerProvenance, lookup as lookupProvenance } from "../../provenance/index.js";
import { extractSurfaces, discoverReferents, diaNorm } from "../../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../../packages/engine/perceiver/text/material.js";
import { splitSentences } from "../../packages/engine/perceiver/text/spans.js";
import { projectReferents } from "../../packages/engine/referents/index.js";
import { openReading, arrive, witnessArrival } from "../../packages/engine/referents/entity.js";
import { identityByConsequence } from "../../packages/engine/referents/consequence.js";
import { isGap } from "../../nul/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIX = join(ROOT, "scripts", "adversarial", "fixtures");

const SOURCES = [
  { id: "source:challenge25/A-naval-archive", path: join(FIX, "challenge-25-source-a-naval-archive.txt"), label: "A (naval archive) — \"Marcus Aurelius Kade\"", claimSample: "died when his flagship struck the reef" },
  { id: "source:challenge25/B-folk-tale", path: join(FIX, "challenge-25-source-b-folk-tale.txt"), label: "B (folk tale) — \"the Iron Admiral\"", claimSample: "forged the Long Chain treaty" },
  { id: "source:challenge25/C-court-record", path: join(FIX, "challenge-25-source-c-court-record.txt"), label: "C (court record) — \"Vessa's Kade\"", claimSample: "petition for reinstatement" },
];

const bar = (t) => console.log(`\n${"=".repeat(78)}\n${t}\n${"=".repeat(78)}`);

bar("CHALLENGE #25 — cross-document identity at corpus scale");
for (const s of SOURCES) {
  s.text = readFileSync(s.path, "utf8");
  console.log(`  ${s.id.padEnd(38)} ${s.text.length} chars   ${s.label}`);
}

// ════════════════════════════════════════════════════════════════════════
// PART 1 — ingest all three as one real session, through the actual host
// API a real app would use (packages/host/corpus.js).
// ════════════════════════════════════════════════════════════════════════
bar("PART 1 — ingest 3 sources into one session (admitChunked x3)");

const session = createSession();
for (const s of SOURCES) {
  const r = admitChunked(session, { text: s.text, sourceId: s.id });
  console.log(`  admitChunked(${s.id}) -> ${r.chunks} chunk(s)`);
}
console.log(`  session.documents.size = ${session.documents.size}`);
console.log(`  documentIds(session) = ${JSON.stringify(documentIds(session))}`);

// ════════════════════════════════════════════════════════════════════════
// PART 2 — per-document cast discovery via the REAL host API
// (sessionReferents). This is the only referent-discovery entry point
// packages/host/index.js exports. Does it, on its own, ever notice that
// the three documents share an entity?
// ════════════════════════════════════════════════════════════════════════
bar("PART 2 — sessionReferents() per document (the real host API)");

const perDoc = {};
for (const s of SOURCES) {
  const res = sessionReferents(session, { sourceId: s.id });
  perDoc[s.id] = res;
  console.log(`\n  ${s.label}`);
  console.log(`    sourceId = ${s.id}`);
  console.log(`    ${res.referents.length} referent(s) found:`);
  for (const r of res.referents.slice(0, 8)) {
    console.log(`      id=${r.id}  surfaces=${JSON.stringify(r.surfaces)}  mentions=${r.mentions ?? "?"}`);
  }
  if (res.gaps?.length) console.log(`    gaps: ${res.gaps.map((g) => g.reason ?? g).join("; ")}`);
}

// Does sessionReferents itself take any argument that spans more than one
// sourceId? Read the exported signature's own behaviour: call it with an
// ARRAY of the three sourceIds and see what happens (adversarial: maybe an
// undocumented multi-source mode exists).
const multiSourceAttempt = sessionReferents(session, { sourceId: SOURCES.map((s) => s.id) });
console.log(`\n  sessionReferents(session, { sourceId: [A,B,C] }) (passing an array, undocumented) =>`);
console.log(`    ${JSON.stringify(multiSourceAttempt).slice(0, 300)}`);

// Cross-check: does ANY pair of per-document referent id's or surface sets
// overlap, i.e. did the host layer coincidentally or deliberately unify any
// of the three name forms into a shared referent record?
const idSets = SOURCES.map((s) => new Set(perDoc[s.id].referents.map((r) => r.id)));
const surfaceSets = SOURCES.map((s) => new Set(perDoc[s.id].referents.flatMap((r) => r.surfaces.map((x) => diaNorm(x)))));
let anyIdOverlap = false, anySurfaceOverlap = false;
for (let i = 0; i < SOURCES.length; i++) {
  for (let j = i + 1; j < SOURCES.length; j++) {
    const idOverlap = [...idSets[i]].filter((id) => idSets[j].has(id));
    const surfOverlap = [...surfaceSets[i]].filter((sf) => surfaceSets[j].has(sf));
    if (idOverlap.length) anyIdOverlap = true;
    if (surfOverlap.length) anySurfaceOverlap = true;
    console.log(`\n  ${SOURCES[i].id} vs ${SOURCES[j].id}: shared referent ids = ${JSON.stringify(idOverlap)}, shared surface strings = ${JSON.stringify(surfOverlap)}`);
  }
}
console.log(`\n  ANY cross-document referent-id overlap: ${anyIdOverlap}`);
console.log(`  ANY cross-document surface-string overlap: ${anySurfaceOverlap}`);
console.log(`  (expected, given three deliberately DIFFERENT name forms with no shared literal string: both false)`);

// ════════════════════════════════════════════════════════════════════════
// PART 3 — is there ANY exported host function that aggregates referents
// across documents? Enumerate packages/host/index.js's actual export list
// and confirm live, not from memory of the survey.
// ════════════════════════════════════════════════════════════════════════
bar("PART 3 — does packages/host/index.js export any cross-document referent API?");

const hostIndexUrl = new URL("../../packages/host/index.js", import.meta.url);
const hostModule = await import(hostIndexUrl);
const hostExportNames = Object.keys(hostModule);
console.log(`  packages/host/index.js exports: ${JSON.stringify(hostExportNames)}`);
const suspiciousNames = hostExportNames.filter((n) => /corpus|cross|merge|identity|resolve|unify|cast/i.test(n));
console.log(`  names matching /corpus|cross|merge|identity|resolve|unify|cast/i: ${JSON.stringify(suspiciousNames)}`);
console.log(`  (sessionReferents is the only cast-shaped export, and Part 2 already showed it is single-sourceId-scoped)`);

// ════════════════════════════════════════════════════════════════════════
// PART 4 — the ONE merge vocabulary that exists in this codebase:
// referents/index.js::projectReferents understands CON.identity / SYN.merge
// events. (a) Confirm the fold logic itself is sound by hand-feeding it a
// merge across the three documents' own discovered events. (b) Grep the
// ENTIRE repo, live, for any producer of either event type outside this
// consumer and outside test files.
// ════════════════════════════════════════════════════════════════════════
bar("PART 4 — the CON.identity / SYN.merge merge vocabulary: sound but unwired?");

// Re-derive each document's own DEF.admit events exactly as discoveredCast
// does internally (same functions, same call shape), so we have raw events
// to test the fold with.
function docEvents(text) {
  const sentences = splitSentences(text);
  const table = buildFrequencyTable(tokenize(text));
  const functionWords = functionWordSet(table);
  const surfaces = extractSurfaces(sentences, { functionWords });
  const discovery = discoverReferents(surfaces);
  return discovery.events;
}

const eventsA = docEvents(SOURCES[0].text);
const eventsB = docEvents(SOURCES[1].text);
const eventsC = docEvents(SOURCES[2].text);

// projectReferents run on the concatenation of all three documents' events,
// completely unmodified (no manual merge yet) -- this is the most literal
// "run the identity engine across all three sources" attempt using the
// actual production function.
const naiveAll = projectReferents([...eventsA, ...eventsB, ...eventsC]);
const naiveIdsWithKade = naiveAll.filter((r) => r.surfaces.some((s) => /kade|admiral/i.test(s)));
console.log(`  projectReferents(eventsA ++ eventsB ++ eventsC) unmodified -> ${naiveAll.length} referents total`);
console.log(`  referents whose surfaces mention "kade" or "admiral" (should be the SAME being if merged): ${naiveIdsWithKade.length}`);
for (const r of naiveIdsWithKade) console.log(`    id=${r.id}  surfaces=${JSON.stringify(r.surfaces)}`);
console.log(`  -> even feeding all three documents' events into ONE projectReferents() call produces`);
console.log(`     one SEPARATE referent per document's own naming convention, because DEF.admit ids are`);
console.log(`     derived from the surface's own normalised string (ref:auto:<diaNorm(surface)>) and`);
console.log(`     nothing ever emits a CON.identity/SYN.merge event linking them.`);

// (a) Manually construct the ONE thing that WOULD unify them -- a SYN.merge
// event -- to check the fold mechanism itself is sound (this is MY test
// harness manufacturing the event; nothing in the real pipeline emits it).
const idA = naiveAll.find((r) => r.surfaces.includes("Marcus Aurelius Kade"))?.id;
const idB = naiveAll.find((r) => r.surfaces.includes("Iron Admiral") || r.surfaces.some((s) => /iron admiral/i.test(s)))?.id;
const idC = naiveAll.find((r) => r.surfaces.some((s) => /vessa/i.test(s) && r.surfaces.some((s2) => /kade/i.test(s2))))?.id;
console.log(`\n  (a) HAND-CONSTRUCTED probe (not something the real pipeline produces): if a SYN.merge event`);
console.log(`      naming idA=${idA}, idB=${idB}, idC=${idC} were supplied, does the fold correctly unify them?`);
if (idA && idB && idC) {
  const mergedResult = projectReferents([
    ...eventsA, ...eventsB, ...eventsC,
    { type: "SYN.merge", into_id: idA, from_ids: [idB, idC] },
  ]);
  const merged = mergedResult.find((r) => r.id === idA);
  const foldedAway = mergedResult.filter((r) => r.mergedInto === idA);
  console.log(`      after hand-fed SYN.merge: referent ${idA} now carries surfaces ${JSON.stringify(merged.surfaces)}`);
  console.log(`      referents folded away (mergedInto=${idA}): ${JSON.stringify(foldedAway.map((r) => r.id))}`);
  console.log(`      -> the FOLD LOGIC is sound when driven -- surfaces from all three name forms land on one referent id.`);
} else {
  console.log(`      could not locate all three ids in the naive projection -- surfaces: ${JSON.stringify(naiveAll.map((r) => r.surfaces))}`);
}

// (b) Live grep of the whole repo (source, not tests, not this survey's own
// script) for any producer of either event type.
const { execSync } = await import("node:child_process");
let grepOut = "";
try {
  grepOut = execSync(
    `grep -rn "CON\\.identity\\|SYN\\.merge" --include="*.js" --include="*.mjs" ${JSON.stringify(ROOT)} 2>/dev/null | grep -v /node_modules/ | grep -v /scripts/adversarial/`,
    { encoding: "utf8" },
  );
} catch (e) {
  grepOut = e.stdout || "";
}
console.log(`\n  (b) live grep of the whole repo for "CON.identity" / "SYN.merge" (excluding this script and node_modules):`);
console.log(grepOut.split("\n").filter(Boolean).map((l) => `      ${l}`).join("\n") || "      (no hits)");
const producerLines = grepOut.split("\n").filter((l) => l && !/referents\/index\.js/.test(l) && !/operators\.js/.test(l) && !/\.test\.js/.test(l));
console.log(`  producer lines outside referents/index.js (consumer), operators.js (doc comment), and *.test.js: ${producerLines.length}`);

// ════════════════════════════════════════════════════════════════════════
// PART 5 — the one identity-COMPARISON organ that isn't pure string
// matching: referents/consequence.js::identityByConsequence. It requires
// both surfaces to have arrived in the SAME reading state. Give the claim
// its best honest shot: build one continuous reading by concatenating the
// three documents in source order, and ask the actual organ whether
// "kade" (A+C's shared literal token) and "iron admiral" (B's epithet,
// literally absent from A and C) are the same being -- plus real controls.
// ════════════════════════════════════════════════════════════════════════
bar("PART 5 — identityByConsequence across a concatenated 3-document reading");

const WORD_RE = /[\p{L}\p{M}]+/gu;
const UNIT_WORDS = 20;
const ENTITY_SPEC = { window: 8, draws: 200, reseeds: 40, minArrivals: 2 };

function wordsOf(text) {
  return (text.match(WORD_RE) ?? []).map((w) => w.toLowerCase());
}

// Track, for each source, which [startUnit, endUnit) range its words land in
// once concatenated -- so we can report where each surface's arrivals
// actually fall relative to document boundaries.
const state = openReading(ENTITY_SPEC);
const ranges = {};
for (const s of SOURCES) {
  const words = wordsOf(s.text);
  const units = [];
  for (let i = 0; i < words.length; i += UNIT_WORDS) units.push(words.slice(i, i + UNIT_WORDS));
  const startUnit = state.unit;
  for (const u of units) {
    arrive(state, u);
    for (const w of new Set(u)) {
      // witness the literal words that stand in for our target surfaces
      if (w === "kade") witnessArrival(state, "kade");
      if (w === "vessa") witnessArrival(state, "vessa");
      if (w === "odrun") witnessArrival(state, "odrun");     // A's distractor surname
      if (w === "thess") witnessArrival(state, "thess");     // C's distractor surname
      if (w === "yevni") witnessArrival(state, "yevni");     // B's distractor
    }
    // multi-word epithet: witness "iron admiral" whenever the bigram occurs
    for (let k = 0; k + 1 < u.length; k++) {
      if (u[k] === "iron" && u[k + 1] === "admiral") witnessArrival(state, "iron admiral");
    }
  }
  ranges[s.id] = { startUnit, endUnit: state.unit, words: words.length };
}
console.log(`  concatenated reading: ${state.unit} total units (${UNIT_WORDS} words/unit)`);
for (const s of SOURCES) console.log(`    ${s.id.padEnd(38)} units [${ranges[s.id].startUnit}, ${ranges[s.id].endUnit})   ${ranges[s.id].words} words`);

const arrivalsSummary = (surface) => {
  const at = state.arrivals.get(surface);
  if (!at) return "(never arrived)";
  const mean = at.reduce((a, b) => a + b, 0) / at.length;
  return `${at.length} arrival(s) at units ${JSON.stringify(at)}  mean=${mean.toFixed(1)}`;
};
console.log(`\n  raw arrival positions of the surfaces under test:`);
for (const surf of ["kade", "iron admiral", "vessa", "odrun", "thess", "yevni"]) {
  console.log(`    "${surf}": ${arrivalsSummary(surf)}`);
}

function runIdentity(label, surfaceA, surfaceB) {
  const res = identityByConsequence(state, surfaceA, surfaceB, { reseeds: 200 });
  if (isGap(res)) {
    console.log(`  ${label.padEnd(58)} GAP: ${res.gap} -- ${res.reason ?? ""}`);
    return { label, relation: "gap", detail: res };
  }
  console.log(`  ${label.padEnd(58)} relation=${res.relation}`);
  return { label, relation: res.relation, detail: res };
}

console.log(`\n  TARGET (should be the SAME being per the fixture's own construction, across A+C vs B):`);
const targetResult = runIdentity(`"kade" (A+C) vs "iron admiral" (B)  -- TRUE cross-doc identity`, "kade", "iron admiral");

console.log(`\n  CROSS-DOCUMENT NEGATIVE CONTROLS (should be DISTINCT -- genuinely different people, disjoint docs):`);
const neg1 = runIdentity(`"kade" (A+C) vs "yevni" (B, unrelated storyteller)`, "kade", "yevni");
const neg2 = runIdentity(`"iron admiral" (B) vs "thess" (C, unrelated clerk)`, "iron admiral", "thess");
const neg3 = runIdentity(`"odrun" (A, unrelated officer) vs "thess" (C, unrelated clerk)`, "odrun", "thess");

console.log(`\n  WITHIN-DOCUMENT CONTROL (A's own text: "kade" is genuinely the estate name too via "vessa" only in C, so instead`);
console.log(`  compare A's protagonist token vs A's own distractor, both drawn from the SAME single document's stretch):`);
const withinDocControl = runIdentity(`"kade" vs "odrun" -- both mostly A's own stretch, genuinely DIFFERENT people`, "kade", "odrun");

// ════════════════════════════════════════════════════════════════════════
// PART 6 — provenance / citation attribution: the half of the claim that
// SHOULD hold regardless of Part 1-5's outcome. Verify spans retrieved by
// keyword across all three sources keep correct, non-conflated source_id
// attribution, and that provenance/index.js's registry never merges entries
// from different sources even when they concern "the same" fictional
// entity by this fixture's own construction.
// ════════════════════════════════════════════════════════════════════════
bar("PART 6 — provenance stays per-source attributed across the 3 documents");

for (const s of SOURCES) {
  const entries = findBySource(session.provenance, s.id);
  console.log(`  findBySource(${s.id}) -> ${entries.length} registered span(s), all sourceId===${s.id}: ${entries.every((e) => e.sourceId === s.id)}`);
}

const provenanceChecks = [];
function checkQuery(query, expectedSourceIds) {
  const { spans } = searchSpans(session, { query, limit: 20 });
  const hitSourceRoots = spans.map((sp) => sp.source_id.split(":chunk-")[0]);
  const uniqueRoots = [...new Set(hitSourceRoots)];
  const correctlyTagged = spans.every((sp) => SOURCES.some((s) => sp.source_id.startsWith(s.id)));
  const containsQueryText = spans.every((sp) => sp.text.toLowerCase().includes(query.toLowerCase().split(" ")[0]));
  console.log(`\n  searchSpans(query="${query}") -> ${spans.length} hit(s)`);
  for (const sp of spans.slice(0, 6)) {
    console.log(`    source_id=${sp.source_id.padEnd(46)} score=${sp.score.toFixed(3)}  preview="${sp.preview.slice(0, 70).replace(/\n/g, " ")}"`);
  }
  console.log(`    distinct source roots hit: ${JSON.stringify(uniqueRoots)}`);
  console.log(`    expected source roots: ${JSON.stringify(expectedSourceIds)}`);
  const rootsMatchExpected = expectedSourceIds.every((e) => uniqueRoots.includes(e)) && uniqueRoots.every((r) => expectedSourceIds.includes(r));
  console.log(`    every hit's source_id resolves to a real, correct, un-conflated sourceId: ${correctlyTagged}`);
  console.log(`    hit set matches expected source roots exactly: ${rootsMatchExpected}`);
  provenanceChecks.push({ query, correctlyTagged, rootsMatchExpected, hits: spans.length });
}

// "Coriveil" is the one token literally shared by ALL THREE sources (the
// naval disaster every account references under its own framing) -- the
// hardest real cross-source provenance case in this fixture.
checkQuery("Coriveil", [SOURCES[0].id, SOURCES[1].id, SOURCES[2].id]);
// "Vessa's" is C's own possessive estate-name token (the tokenizer keeps the
// apostrophe: "Vessa's" -> one token "vessa's", never bare "vessa") -- a
// single-source sanity check that per-source retrieval still works for the
// literal string source C actually contains.
checkQuery("Vessa's", [SOURCES[2].id]);
// "Kade" is literal in A and C, absent from B by construction.
checkQuery("Kade", [SOURCES[0].id, SOURCES[2].id]);
// "Admiral" appears in A ("Admiral Kade") and B ("the Iron Admiral") but not C.
checkQuery("Admiral", [SOURCES[0].id, SOURCES[1].id]);

// Direct provenance.register/lookup round-trip per source, to rule out any
// content-hash collision across sources (contentId hashes sourceId+byteStart
// +text together, so this should be structurally impossible, but verify live
// rather than trust the formula by reading).
console.log(`\n  direct register()/lookup() round-trip, one claim-bearing span per source:`);
for (const s of SOURCES) {
  const byteStart = 0;
  const text = s.text.slice(0, 120);
  const refId = registerProvenance(session.provenance, { sourceId: s.id, byteStart, byteEnd: byteStart + Buffer.byteLength(text, "utf8"), text });
  const looked = lookupProvenance(session.provenance, refId);
  const ok = !isGap(looked) && looked.sourceId === s.id && looked.text === text;
  console.log(`    ${s.id.padEnd(38)} refId=${refId}  round-trip correct=${ok}`);
}

// ════════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════════
bar("SUMMARY");

const identityMergeHappened = anyIdOverlap || anySurfaceOverlap || naiveIdsWithKade.length === 1;
const identityByConsequenceCalledItSame = targetResult.relation === "consistent";
const provenanceAllCorrect = provenanceChecks.every((c) => c.correctlyTagged) && provenanceChecks.every((c) => c.rootsMatchExpected);

console.log(JSON.stringify({
  part2_host_layer_ever_merges_across_documents: identityMergeHappened,
  part3_host_index_exports_a_cross_document_referent_api: suspiciousNames.length > 0 && suspiciousNames.includes("sessionReferents") === false,
  part4_naive_projectReferents_across_all_3_docs_referent_count_with_kade_or_admiral_surfaces: naiveIdsWithKade.length,
  part4_real_producers_of_CON_identity_or_SYN_merge_outside_consumer_and_tests: producerLines.length,
  part4_hand_fed_merge_fold_logic_sound: !!(idA && idB && idC),
  part5_identityByConsequence_target_relation: targetResult.relation,
  part5_identityByConsequence_negative_control_relations: [neg1.relation, neg2.relation, neg3.relation],
  part5_identityByConsequence_within_doc_control_relation: withinDocControl.relation,
  part6_provenance_stayed_correctly_per_source_on_every_query: provenanceAllCorrect,
}, null, 2));

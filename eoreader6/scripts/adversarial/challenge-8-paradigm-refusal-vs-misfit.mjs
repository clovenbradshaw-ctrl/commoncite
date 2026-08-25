// Adversarial test — Challenge #8: "Paradigm refusal vs misfit"
//
// Claim under test (packages/engine/emergence/paradigm.js, refuseParadigm,
// DEF·Pattern): when a coherent stretch of received material carries NONE of
// an established paradigm's core fields, the organ must register that as a
// DIFFERENT FRAME (the typed gap `paradigm_unraveled`) — not silently absorb
// it as if it were a misfit member of the existing paradigm, and not silently
// discard it as mere noise (the noise/misfit case is `coherent === false`,
// which must NOT unravel — that is the "noise != refusal" distinction the
// existing hand-built fixture in conformance/terrain.test.js already checks).
//
// refuseParadigm does not consume raw text (see kinds.js's own header: its
// "entities" are relation terms with structural attributes "earned from the
// text — a shared parent anchor, a shared subject" — never raw prose). So
// this test builds two REAL-content populations by the same method Emma's
// own fixture implies: relation terms drawn from a genuine source, each
// attributed with the character/anchor it structurally co-occurs with in
// that source, counted from the source's own text — not hand-picked labels.
//
//   NARRATIVE population — drawn from Homer's Odyssey (Samuel Butler's
//   public-domain translation, Project Gutenberg #1727, already checked into
//   this repo as odyssey-greek.txt), Books I-II. Relation terms (father,
//   mother, son, daughter, wife, husband, suitors, nurse, friend, friends)
//   attributed by which of four real anchors (Ulysses, Telemachus, Penelope,
//   Ithaca) they structurally co-occur with, counted sentence-by-sentence
//   over the real text.
//
//   LEGAL population — a hand-authored (not copied from any real contract;
//   generic boilerplate is formulaic, functional legal language, not
//   original creative expression) "General Provisions" section of the kind
//   any commercial contract carries: governing law, entire agreement,
//   severability, notices, assignment, force majeure, indemnification,
//   limitation of liability, confidentiality, counterparts, waiver,
//   amendment, arbitration, jurisdiction, breach, headings — attributed by
//   which of three real anchors (Agreement, Party/Parties, Section) each
//   clause structurally co-occurs with, counted clause-by-clause (each
//   clause is its own paragraph) over the real drafted text.
//
// This is the adversarial pair the challenge asks for: a passage genuinely
// coherent on its own terms (the legal population induces its own kinds) and
// genuinely orthogonal to the novel's paradigm (no legal clause mentions
// Ulysses, Telemachus, Penelope, or Ithaca; no Odyssey sentence mentions
// "Agreement", "Party", or "Section") — the reverse direction is run too,
// since the challenge explicitly asks for "or vice versa".
//
// A genuine-noise control (rare, real, but non-repeating Odyssey words, each
// its own unshared field) checks that placement===0 alone is NOT sufficient
// for the unravel — coherence must also hold — so a merely-random received
// body is correctly distinguished from a genuinely different, coherent frame.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

import { induceKinds } from "../../packages/engine/emergence/kinds.js";
import { refuseParadigm, paradigmCores } from "../../packages/engine/emergence/paradigm.js";
import { isGap } from "../../nul/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const log = (...a) => console.log(...a);

// ── extraction: real text -> relation-term records with structurally-earned
//    attributes (co-occurrence with a small set of real anchors) ───────────

const wordRe = (w) => new RegExp(`\\b${w}`, "i"); // prefix match so "indemnif" catches indemnify/indemnification
const anchorRe = (a) => new RegExp(`\\b${a}\\b`, "gi");

const sentencesOf = (text) =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z“"‘'])/)
    .map((s) => s.trim())
    .filter(Boolean);

const paragraphsOf = (text) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// anchors: { canonicalName: [surface forms...] }
// units: array of text chunks (sentences or clause-paragraphs) to count over
const buildPopulation = (units, terms, anchors, idPrefix) => {
  const anchorNames = Object.keys(anchors);
  const records = [];
  for (const term of terms) {
    const termRe = wordRe(term);
    const hitUnits = units.filter((u) => termRe.test(u));
    if (hitUnits.length === 0) continue;
    const counts = {};
    for (const name of anchorNames) {
      let n = 0;
      for (const u of hitUnits) {
        for (const surface of anchors[name]) n += (u.match(anchorRe(surface)) || []).length;
      }
      counts[name] = n;
    }
    const ranked = anchorNames.filter((n) => counts[n] > 0).sort((a, b) => counts[b] - counts[a]);
    if (ranked.length === 0) continue; // real term, but earns no anchor — excluded entirely, like "friend" in the canon fixture
    const attributes = [{ field_id: `${ranked[0]}_shared`, count: counts[ranked[0]] }];
    // tie (or near-tie, matching "sister-in-law" carrying two attributes in the canon fixture)
    if (ranked.length > 1 && counts[ranked[1]] === counts[ranked[0]]) {
      attributes.push({ field_id: `${ranked[1]}_shared`, count: counts[ranked[1]] });
    }
    records.push({ id: `${idPrefix}:${term.replace(/\s+/g, "_")}`, attributes });
  }
  return records;
};

// ── NARRATIVE population: real Odyssey Books I-II ───────────────────────────

const odysseyPath = path.join(__dirname, "fixtures/odyssey-book1-2-excerpt.txt");
assert.ok(fs.existsSync(odysseyPath), `fixture missing: ${odysseyPath}`);
const odysseyText = fs.readFileSync(odysseyPath, "utf8");
// sanity: this really is the Butler Odyssey excerpt, not something else
assert.match(odysseyText, /Ulysses/);
assert.match(odysseyText, /Telemachus/);

const odysseySentences = sentencesOf(odysseyText);

const NARRATIVE_TERMS = ["father", "mother", "son", "daughter", "wife", "husband", "suitors", "nurse", "friend", "friends"];
const NARRATIVE_ANCHORS = { ulysses: ["Ulysses"], telemachus: ["Telemachus"], penelope: ["Penelope"], ithaca: ["Ithaca"] };

const NARRATIVE_POPULATION = buildPopulation(odysseySentences, NARRATIVE_TERMS, NARRATIVE_ANCHORS, "narr");

// ── LEGAL population: real (hand-drafted, generic) boilerplate contract ────

const legalPath = path.join(__dirname, "fixtures/legal-boilerplate.txt");
assert.ok(fs.existsSync(legalPath), `fixture missing: ${legalPath}`);
const legalText = fs.readFileSync(legalPath, "utf8");

const legalParagraphs = paragraphsOf(legalText).filter((p) => p !== "GENERAL PROVISIONS");

const LEGAL_TERMS = [
  "governing law", "entire agreement", "severability", "notice", "assignment",
  "force majeure", "indemnif", "liability", "confidential", "counterparts",
  "waiver", "amendment", "arbitration", "jurisdiction", "breach", "headings",
];
const LEGAL_ANCHORS = { agreement: ["Agreement"], party: ["Party", "Parties"], section: ["Section"] };

const LEGAL_POPULATION = buildPopulation(legalParagraphs, LEGAL_TERMS, LEGAL_ANCHORS, "legal");

// ── NOISE control: real, rare Odyssey words that do NOT repeat — genuine
//    "coherent on its own terms? no." material, for the misfit/noise arm ──

// Each of these appears exactly once in the Book I-II excerpt (checked below)
// so none of them can share a field with any other record — guaranteed
// structurally incoherent, but still real text, not invented tokens.
const NOISE_CANDIDATES = ["hecatomb", "sandals", "draughts", "sponges", "spear", "cauldron", "quiver", "bowstring"];
const NOISE_POPULATION = NOISE_CANDIDATES
  .filter((w) => (odysseyText.match(new RegExp(`\\b${w}`, "gi")) || []).length >= 1)
  .map((w, i) => ({ id: `noise:${w}`, attributes: [{ field_id: `${w}_onceoff_${i}`, count: 1 }] }));

// ── report the constructed populations before running anything ─────────────

log("=== NARRATIVE_POPULATION (from real Odyssey Books I-II) ===");
for (const r of NARRATIVE_POPULATION) log(" ", r.id, JSON.stringify(r.attributes));
log(`(${NARRATIVE_POPULATION.length} records, from ${odysseySentences.length} real sentences)\n`);

log("=== LEGAL_POPULATION (from real hand-drafted boilerplate) ===");
for (const r of LEGAL_POPULATION) log(" ", r.id, JSON.stringify(r.attributes));
log(`(${LEGAL_POPULATION.length} records, from ${legalParagraphs.length} real clauses)\n`);

log("=== NOISE_POPULATION (real, non-repeating Odyssey words) ===");
for (const r of NOISE_POPULATION) log(" ", r.id, JSON.stringify(r.attributes));
log(`(${NOISE_POPULATION.length} records)\n`);

assert.ok(NARRATIVE_POPULATION.length >= 6, "narrative population too small to be a meaningful test");
assert.ok(LEGAL_POPULATION.length >= 6, "legal population too small to be a meaningful test");

// ── induction options — declared, never defaulted (SEED.md #7) ─────────────

// `reseeds` added post-hoc (2026-08-05 fix pass): induceKinds() now requires
// it unconditionally — kinds.js's own header explains why: the key-channel
// search null (`searchKeyCohesions`, a fixed-margin "curveball" swap) is no
// longer only exercised on valued material, so every call must declare it.
// This is the SAME mechanical adaptation already applied verbatim in
// challenge-9's script (see its OPTS comment) — not a change to this
// script's methodology, populations, or verdict logic, only to keep it
// running against the current, correct API contract. Value chosen (24)
// matches the value already in use elsewhere in this repo's own conformance
// suite and adversarial scripts for structurally similar (small, presence
// counted, real-text-derived) populations.
const OPTS = { population: "adv-ch8", minPrevalence: 0.15, minKindSize: 3, permutations: 300, quantile: 0.95, seed: 7, reseeds: 24 };

let failures = 0;
const check = (label, cond, detail) => {
  if (cond) {
    log(`  PASS  ${label}`);
  } else {
    failures++;
    log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1 — induce the novel's own paradigm from the narrative population.
// ═══════════════════════════════════════════════════════════════════════════

log("\n--- STEP 1: induce paradigm from NARRATIVE_POPULATION ---");
const narrativeKinds = induceKinds(NARRATIVE_POPULATION, OPTS);
log("induced kinds:", narrativeKinds.map((k) => ({ label: k.label, height: k.height, size: k.members?.length })));
const narrativeAbove = narrativeKinds.filter((k) => k.height === "above");
const narrativeCores = paradigmCores(narrativeAbove);
log("narrative paradigm cores:", [...narrativeCores]);
check("narrative population induces at least one 'above' kind (paradigm is real, not vacuous)", narrativeAbove.length > 0, `got heights: ${narrativeKinds.map((k) => k.height).join(",")}`);
check("narrative paradigm has non-empty cores", narrativeCores.size > 0);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2 — induce the legal document's own paradigm, for the reverse leg and
// to confirm the "coherent on its own terms" half of the challenge directly.
// ═══════════════════════════════════════════════════════════════════════════

log("\n--- STEP 2: induce paradigm from LEGAL_POPULATION ---");
const legalKinds = induceKinds(LEGAL_POPULATION, OPTS);
log("induced kinds:", legalKinds.map((k) => ({ label: k.label, height: k.height, size: k.members?.length })));
const legalAbove = legalKinds.filter((k) => k.height === "above");
const legalCores = paradigmCores(legalAbove);
log("legal paradigm cores:", [...legalCores]);
check("legal population induces at least one 'above' kind (coherent on its own terms)", legalAbove.length > 0, `got heights: ${legalKinds.map((k) => k.height).join(",")}`);
check("legal paradigm has non-empty cores", legalCores.size > 0);

// ═══════════════════════════════════════════════════════════════════════════
// TEST A — drop the coherent legal clause set into the novel's paradigm.
// This is the challenge's literal case: "a legal contract's boilerplate
// clause dropped into a novel". Must register as paradigm_unraveled.
// ═══════════════════════════════════════════════════════════════════════════

log("\n--- TEST A: legal boilerplate against the novel's paradigm ---");
const resultA = refuseParadigm(narrativeAbove, LEGAL_POPULATION, OPTS);
log("refuseParadigm(novel-paradigm, legal-material) =>", JSON.stringify(resultA, null, 2));

check("A1: is a typed gap", isGap(resultA), `got: ${JSON.stringify(resultA)}`);
check("A2: gap is 'paradigm_unraveled' (frame refusal, not silent absorption/discard)", resultA.gap === "paradigm_unraveled", `got gap=${resultA.gap}`);
check("A3: placement === 0 (no legal record carries a novel-paradigm core)", resultA.placement === 0, `got placement=${resultA.placement}`);
check("A4: coherent === true (the legal material is coherent on its own terms)", resultA.coherent === true, `got coherent=${resultA.coherent}`);
check("A5: the refusal names the foreign frame's own cores", Array.isArray(resultA.received_coherence) && resultA.received_coherence.length > 0, `got received_coherence=${JSON.stringify(resultA.received_coherence)}`);
check("A6: the refusal names the paradigm it refutes", Array.isArray(resultA.paradigm) && resultA.paradigm.length > 0);

// ═══════════════════════════════════════════════════════════════════════════
// TEST B — the reverse direction: drop the coherent narrative passage into
// the legal document's paradigm ("or vice versa").
// ═══════════════════════════════════════════════════════════════════════════

log("\n--- TEST B (vice versa): Odyssey narrative against the contract's paradigm ---");
const resultB = refuseParadigm(legalAbove, NARRATIVE_POPULATION, OPTS);
log("refuseParadigm(legal-paradigm, narrative-material) =>", JSON.stringify(resultB, null, 2));

check("B1: is a typed gap", isGap(resultB), `got: ${JSON.stringify(resultB)}`);
check("B2: gap is 'paradigm_unraveled'", resultB.gap === "paradigm_unraveled", `got gap=${resultB.gap}`);
check("B3: placement === 0", resultB.placement === 0, `got placement=${resultB.placement}`);
check("B4: coherent === true", resultB.coherent === true, `got coherent=${resultB.coherent}`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST C — control: real but genuinely incoherent (non-repeating) material
// must NOT unravel the paradigm, even though it also places 0 records. This
// is the misfit/noise case the claim says must stay DISTINCT from frame
// refusal — same placement===0, opposite verdict, because coherence differs.
// ═══════════════════════════════════════════════════════════════════════════

log("\n--- TEST C (control): real non-repeating noise against the novel's paradigm ---");
const resultC = refuseParadigm(narrativeAbove, NOISE_POPULATION, OPTS);
log("refuseParadigm(novel-paradigm, noise-material) =>", JSON.stringify(resultC, null, 2));

check("C1: NOT a typed gap (noise is not registered as a frame refusal)", !isGap(resultC), `got: ${JSON.stringify(resultC)}`);
check("C2: refused === false", resultC.refused === false, `got refused=${resultC.refused}`);
check("C3: placement === 0 (same measured fact as Test A)", resultC.placement === 0, `got placement=${resultC.placement}`);
check("C4: coherent === false (noise fails the precondition Test A's material passed)", resultC.coherent === false, `got coherent=${resultC.coherent}`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST D (secondary probe, not part of the pass/fail verdict) — sensitivity
// at the boundary: splice ONE genuinely-placeable narrative record into the
// otherwise-wholly-foreign legal population and confirm the mechanism's own
// documented behaviour (exact, not a threshold: ANY placement suppresses the
// unravel) actually happens on this real material, not just on the
// hand-built canon fixture.
// ═══════════════════════════════════════════════════════════════════════════

log("\n--- TEST D (secondary probe): one incidental overlap spliced into the legal set ---");
const bridgeRecord = NARRATIVE_POPULATION.find((r) => r.attributes.some((a) => narrativeCores.has(a.field_id)));
if (bridgeRecord) {
  const splicedLegal = [...LEGAL_POPULATION, bridgeRecord];
  const resultD = refuseParadigm(narrativeAbove, splicedLegal, OPTS);
  log(`spliced in ${bridgeRecord.id} ${JSON.stringify(bridgeRecord.attributes)} =>`, JSON.stringify(resultD, null, 2));
  log(`  (documented as exact-not-threshold in paradigm.js's own header comment; reported, not scored)`);
} else {
  log("  (no bridge record found — skipped)");
}

// ═══════════════════════════════════════════════════════════════════════════

log(`\n=== SUMMARY: ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`} ===`);
process.exit(failures === 0 ? 0 : 1);

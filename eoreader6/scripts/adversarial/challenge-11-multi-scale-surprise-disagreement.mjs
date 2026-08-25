// Challenge #11 — Multi-scale surprise disagreement.
//
// CLAIM UNDER TEST: "Signal lives in the disagreement between
// document/genre/corpus-scale priors (e.g. low-local-surprisal but
// high-genre-surprisal = a smuggled passage that reads smoothly but doesn't
// belong in the genre)." The system is supposed to SURFACE that disagreement
// rather than average the three scales into one flat surprise number.
//
// SURVEY FINDING BEING RE-CHECKED, NOT TRUSTED: no document/genre/corpus
// -scoped prior mechanism exists by that name anywhere in eoreader6.
// packages/engine/emergence/tiers.js is the one real multi-scale surprise
// architecture, but its "scales" are within-one-reading fold altitudes
// (material -> atmosphere -> lens -> paradigm), not separate document /
// genre / corpus priors compared against each other. This script does not
// take that on faith — it builds the closest real, honest analogue out of
// the repo's ACTUAL multi-prior machinery (packages/engine/generation/
// belief.js's layered mixture-of-experts belief, exactly the organ
// scripts/relevance.mjs already uses to test Amendment IV on real books) and
// runs the literal adversarial case against it.
//
//   DOCUMENT scale = the belief's `read` layer, trained causally on a real
//     Odyssey excerpt (Book II, the assembly/oath scene — genuinely
//     contains formal/legal-adjacent vocabulary: "assembly", "oath",
//     "witness", "shall", "house", "suitors", "elders").
//   GENRE scale     = a `received` layer trained on a DIFFERENT, non-
//     overlapping Odyssey excerpt (Book VI, Nausicaa — same work, same
//     genre, zero oath/legal-register vocabulary; verified by grep before
//     this script was written).
//   CORPUS scale    = a `received` layer trained on real front-matter (an
//     actual Project Gutenberg license header) plus a genuinely different
//     19th-century novel's body text (Du Maurier's "The Martian") — the
//     broadest, most stylistically diverse of the three.
//
// TWO SPLICES ARE TESTED, A/B, so a positive result cannot be "any weird
// text is surprising everywhere":
//   A. HYBRID  — a hand-built legal-disclaimer-register passage built
//      substantially from DOCUMENT-native vocabulary (assembly, herald,
//      house, suitors, hall, Ithaca, oath, sworn, witnessed, Penelope,
//      elders — all real words counted in Book II) but carrying modern
//      contract-register markers ("without warranty", "disclaims all
//      liability", "notwithstanding", "in accordance with", "in
//      perpetuity") that do not belong to Homeric narrative at all. This is
//      the exact case the claim describes: designed to read smoothly against
//      the LOCAL document (lots of shared vocabulary) while being obviously
//      genre-anomalous.
//   B. CONTROL — a generic legal-boilerplate passage (Licensee, Company,
//      Delaware, arbitration, jury trial, Section 9) with almost no
//      DOCUMENT-native vocabulary at all. If document/genre/corpus
//      surprisal all rise together here, that is the EXPECTED, boring
//      case — no scale-disagreement to surface, because nothing local about
//      it reads smoothly either. It exists to prove A's result (if any) is
//      about register-vs-vocabulary-overlap, not "legal text is always an
//      outlier everywhere."
//   BASE — a real, unmodified continuation of the document (the genuine next
//      lines of Book III) as the non-adversarial floor.
//
// WHAT IS ACTUALLY MEASURED, per token of each passage, causally (never
// training any layer on the splice itself, so no layer "cheats" by having
// already read it):
//   surprisal_document  = -log2 readLayer.massOf(ctx, tok)
//   surprisal_genre     = -log2 genreLayer.massOf(ctx, tok)
//   surprisal_corpus    = -log2 corpusLayer.massOf(ctx, tok)
//   surprisal_mixture   = -log2 belief.probabilityOf(ctx, tok)   <- the ONE
//     flat number the rest of this codebase actually consumes: this is
//     exactly what packages/engine/generation/candidates.js's
//     `regime-belief` candidate feeds emergence/loops/atmosphere.js as "the
//     candidate's own causal surprisal" (see candidates.js:182-189). If
//     anything downstream of belief.js ever sees "surprise" as a single
//     number, this is that number.
//
// PASS would look like: the mixture number (or something wired to
// relevanceReport()/attribution) visibly and specifically flags the HYBRID
// splice as document/genre-disagreeing, distinct from ordinary novelty.
// FAIL would look like: the three per-layer numbers genuinely disagree (the
// raw signal the claim says should exist IS there), but the one number the
// pipeline actually surfaces collapses back toward the document layer alone
// (or toward "novel word" flatness) and nothing decomposes it automatically.
//
// Run: node scripts/adversarial/challenge-11-multi-scale-surprise-disagreement.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createLayer, createBelief } from "../../packages/engine/generation/belief.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIX = join(ROOT, "scripts", "adversarial", "fixtures");

// ── DECLARED, never defaulted (SEED.md discipline; same order of magnitude
// as scripts/relevance.mjs's own declared constants) ────────────────────────
const ORDER = 3;
const ALPHA = 0.7;
const GAMMA = 0.9995; // read layer's fading — < 1, so this is a reader, not a corpus count
const RHO = 0.999; // forgetting rate of relevance between the two received layers
const LOG2 = Math.LN2;

// Same tokenizer scripts/relevance.mjs uses against real books: unicode
// letters/numbers/apostrophes as forms, a fixed punctuation set as its own
// forms, lowercased. Not reinvented here.
const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const load = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n").toLowerCase().match(WORD) ?? [];

const documentTokens = load(join(FIX, "challenge-11-document-odyssey-book2.txt"));
const genreTokens = load(join(FIX, "challenge-11-genre-odyssey-book6.txt"));
const corpusTokens = load(join(FIX, "challenge-11-corpus-the-martian-excerpt.txt"));
const baselineTokens = load(join(FIX, "challenge-11-baseline-continuation.txt"));
const hybridTokens = load(join(FIX, "challenge-11-splice-hybrid.txt"));
const controlTokens = load(join(FIX, "challenge-11-splice-control-raw-legal.txt"));
const benignTokens = load(join(FIX, "challenge-11-splice-benign-same-entities.txt"));

console.log("=".repeat(78));
console.log("CHALLENGE #11 — multi-scale surprise disagreement (document/genre/corpus)");
console.log("=".repeat(78));
console.log(`document (Odyssey Bk II, assembly/oath scene): ${documentTokens.length} forms`);
console.log(`genre    (Odyssey Bk VI, Nausicaa, disjoint):   ${genreTokens.length} forms`);
console.log(`corpus   (PG header + "The Martian" body):      ${corpusTokens.length} forms`);
console.log(`declared order=${ORDER} alpha=${ALPHA} gamma=${GAMMA} rho=${RHO}\n`);

// Sanity check the fixture's own premise before touching belief.js at all:
// does GENRE really lack the oath/legal-adjacent vocabulary DOCUMENT has?
const overlapVocab = ["shall", "assembly", "oath", "witness", "witnessed", "house", "suitors", "hall", "elders"];
console.log("fixture sanity check — counts in DOCUMENT vs GENRE (should differ sharply):");
for (const w of overlapVocab) {
  const dCount = documentTokens.filter((t) => t === w).length;
  const gCount = genreTokens.filter((t) => t === w).length;
  console.log(`  ${w.padEnd(10)} document=${dCount}  genre=${gCount}`);
}
console.log();

// ── Build the belief: 1 read layer (document), 2 received layers ───────────
const readLayer = createLayer({ id: "document", tier: "read", order: ORDER, gamma: GAMMA, alpha: ALPHA });
const genreLayer = createLayer({
  id: "genre", tier: "received", giver: "Odyssey (Butler tr.), Book VI — Nausicaa, a disjoint excerpt of the SAME work/genre",
  order: ORDER, gamma: 1, alpha: ALPHA,
});
genreLayer.train(genreTokens);
const corpusLayer = createLayer({
  id: "corpus", tier: "received", giver: "The Martian (Du Maurier, PG 27400) — a different novel, different era, plus its own real PG license header",
  order: ORDER, gamma: 1, alpha: ALPHA,
});
corpusLayer.train(corpusTokens);

const belief = createBelief({ layers: [readLayer, genreLayer, corpusLayer], rho: RHO });

// Read the document causally, exactly as scripts/relevance.mjs does: witness
// each received layer against what ACTUALLY came next before training the
// read layer on it, so relevanceReport() reflects real earned standing.
const seen = [];
for (let i = 0; i < documentTokens.length; i++) {
  const ctx = seen.slice(Math.max(0, seen.length - ORDER));
  belief.witnessForm(ctx, documentTokens[i]);
  seen.push(documentTokens[i]);
  readLayer.observe(seen, seen.length - 1);
}

console.log("relevanceReport() after reading the whole document (sanity check — does");
console.log("genre earn more standing than corpus on REAL Odyssey continuations, before");
console.log("any splice is introduced? this is a long-run average, not a per-passage");
console.log("signal, and it is reported as exactly that kind of number):");
const rr = belief.relevanceReport();
for (const l of rr.layers) console.log(`  ${l.id.padEnd(8)} share=${l.share.toFixed(4)}  log_weight=${l.log_weight.toFixed(2)}  giver="${l.giver}"`);
console.log();

// ── Score a passage causally against the document's own trailing context,
// WITHOUT training any layer on it (no layer is allowed to have "already
// read" the splice — that would make the low-surprisal finding a tautology).
const scorePassage = (label, tokens) => {
  let ctx = seen.slice(Math.max(0, seen.length - ORDER));
  const rows = [];
  for (const tok of tokens) {
    const readEvidence = readLayer.evidence(ctx);
    const lambda = readEvidence / (readEvidence + ALPHA);

    // Price exactly the way this codebase already prices an unmet form
    // everywhere it scores one: belief.js::witnessForm (line ~600) and
    // candidates.js's regime-belief candidate (line ~187-189) both use
    // `mass > 0 ? mass : reserve` — "I did not know" costs the layer's own
    // unseen reserve, not the same catastrophic floor as "I was confident
    // and wrong". Scoring with a hard p=0 floor instead (an earlier version
    // of this script did) let a handful of true zero-coverage tokens swamp
    // the mean with ~1074-bit outliers and made the whole passage-level
    // comparison meaningless. This is the SAME convention the real pipeline
    // uses, not a relaxation invented for this test.
    const bits = ({ mass, reserve }) => {
      const p = mass > 0 ? mass : reserve;
      return p > 0 ? -Math.log(p) / LOG2 : -Math.log(Number.MIN_VALUE) / LOG2;
    };
    const readMR = readLayer.massOf(ctx, tok);
    const genreMR = genreLayer.massOf(ctx, tok);
    const corpusMR = corpusLayer.massOf(ctx, tok);
    const mix = belief.probabilityOf(ctx, tok);

    rows.push({
      tok,
      lambda,
      surprisal_document: bits(readMR),
      surprisal_genre: bits(genreMR),
      surprisal_corpus: bits(corpusMR),
      surprisal_mixture: bits(mix),
      inDocVocab: readLayer.has(tok),
    });
    ctx = [...ctx, tok].slice(-ORDER);
  }
  const mean = (key) => rows.reduce((a, r) => a + r[key], 0) / rows.length;
  const median = (key) => {
    const v = rows.map((r) => r[key]).sort((a, b) => a - b);
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  };
  console.log(`── ${label} (${tokens.length} forms) ──`);
  console.log(`   mean   bits  document=${mean("surprisal_document").toFixed(2)}  genre=${mean("surprisal_genre").toFixed(2)}  corpus=${mean("surprisal_corpus").toFixed(2)}  MIXTURE(flat)=${mean("surprisal_mixture").toFixed(2)}`);
  console.log(`   median bits  document=${median("surprisal_document").toFixed(2)}  genre=${median("surprisal_genre").toFixed(2)}  corpus=${median("surprisal_corpus").toFixed(2)}  MIXTURE(flat)=${median("surprisal_mixture").toFixed(2)}`);
  console.log(`   mean lambda_read (document layer's share of the flat mixture) = ${mean("lambda").toFixed(4)}`);
  const inVocabShare = rows.filter((r) => r.inDocVocab).length / rows.length;
  console.log(`   fraction of tokens already in DOCUMENT's own vocabulary = ${(inVocabShare * 100).toFixed(0)}%`);
  return rows;
};

const baseRows = scorePassage("BASE — real, unmodified continuation of the document", baselineTokens);
const hybridRows = scorePassage("SPLICE A (HYBRID) — legal-register, document-vocabulary-heavy", hybridTokens);
const controlRows = scorePassage("SPLICE B (CONTROL) — raw generic legal boilerplate, low document-vocabulary overlap", controlTokens);
const benignRows = scorePassage("SPLICE C (BENIGN CONFOUND CHECK) — same proper nouns as A (Telemachus, suitors, Ithaca, Ulysses, Penelope, oath, assembly, hall), ORDINARY narrative register, not genre-anomalous at all", benignTokens);
console.log();

console.log("per-token detail, SPLICE A (HYBRID) — document/genre/corpus bits, so the");
console.log("claimed pattern (low document, high genre) can be checked word by word,");
console.log("not just as an averaged summary:");
for (const r of hybridRows) {
  console.log(
    `  ${r.tok.padEnd(14)} doc=${r.surprisal_document.toFixed(1).padStart(6)}  genre=${r.surprisal_genre.toFixed(1).padStart(6)}  corpus=${r.surprisal_corpus.toFixed(1).padStart(6)}  mixture=${r.surprisal_mixture.toFixed(1).padStart(6)}  ${r.inDocVocab ? "[in-doc-vocab]" : ""}`,
  );
}
console.log();

console.log("per-token detail, SPLICE C (BENIGN CONFOUND CHECK) — same proper nouns,");
console.log("ordinary narrative register — compare these doc-genre gaps to A's above:");
for (const r of benignRows) {
  console.log(
    `  ${r.tok.padEnd(14)} doc=${r.surprisal_document.toFixed(1).padStart(6)}  genre=${r.surprisal_genre.toFixed(1).padStart(6)}  corpus=${r.surprisal_corpus.toFixed(1).padStart(6)}  mixture=${r.surprisal_mixture.toFixed(1).padStart(6)}  ${r.inDocVocab ? "[in-doc-vocab]" : ""}`,
  );
}
console.log();

// ── The decisive comparison table ───────────────────────────────────────────
const meanOf = (rows, key) => rows.reduce((a, r) => a + r[key], 0) / rows.length;
const medianOf = (rows, key) => {
  const v = rows.map((r) => r[key]).sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
for (const [statLabel, stat] of [["MEAN", meanOf], ["MEDIAN", medianOf]]) {
  console.log("=".repeat(78));
  console.log(`SUMMARY (${statLabel}) — bits per token, three named scales + the one flat number`);
  console.log("=".repeat(78));
  console.log("passage".padEnd(10), "document".padStart(10), "genre".padStart(10), "corpus".padStart(10), "MIXTURE".padStart(10), "doc-genre gap".padStart(16));
  for (const [label, rows] of [["BASE", baseRows], ["HYBRID-A", hybridRows], ["CONTROL-B", controlRows], ["BENIGN-C", benignRows]]) {
    const d = stat(rows, "surprisal_document");
    const g = stat(rows, "surprisal_genre");
    const c = stat(rows, "surprisal_corpus");
    const m = stat(rows, "surprisal_mixture");
    console.log(
      label.padEnd(10),
      d.toFixed(2).padStart(10),
      g.toFixed(2).padStart(10),
      c.toFixed(2).padStart(10),
      m.toFixed(2).padStart(10),
      (g - d).toFixed(2).padStart(16),
    );
  }
  console.log();
}

// Show the raw attribution breakdown belief.js itself computes at a few
// interesting positions in the HYBRID splice — this is the actual field
// (`distribution(ctx).attribution`) any downstream caller would have to read
// manually to see the disagreement; nothing calls it automatically for this
// purpose anywhere in the pipeline.
console.log("distribution().attribution at 3 positions inside SPLICE A (HYBRID),");
console.log("showing how much of the FLAT mixture mass came from each named layer:");
{
  let ctx = seen.slice(Math.max(0, seen.length - ORDER));
  let shown = 0;
  for (const tok of hybridTokens) {
    if (shown < 3 && readLayer.has(tok)) {
      const d = belief.distribution(ctx);
      if (!d.probs) {
        console.log(`  [gap at "${tok}"]`);
      } else {
        console.log(
          `  next="${tok}"  attribution: document=${(d.attribution.document ?? 0).toFixed(4)}  genre=${(d.attribution.genre ?? 0).toFixed(4)}  corpus=${(d.attribution.corpus ?? 0).toFixed(4)}  lambda_read=${d.lambda_read.toFixed(4)}`,
        );
      }
      shown++;
    }
    ctx = [...ctx, tok].slice(-ORDER);
  }
}
console.log();
console.log("Run complete.");

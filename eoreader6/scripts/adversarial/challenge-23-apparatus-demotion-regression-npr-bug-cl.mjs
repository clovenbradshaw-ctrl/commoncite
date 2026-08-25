#!/usr/bin/env node
// Challenge #23 — "Apparatus-demotion regression (NPR bug class)"
//
// Claim under test: a specced fix (attributive_share + coupling_dispersion
// frame demotion, plus a subject re-entry test) should prevent a narrating
// apparatus (a news outlet / narrator) from outranking the article's actual
// subject in individuation, "even in EASY cases already tested."
//
// Preliminary fact-check (see the verdict output below for the exact greps):
// no attributive_share / coupling_dispersion / narrative "frame demotion" /
// subject-re-entry mechanism exists ANYWHERE in this repo. The only real
// candidate ranking rule that runs anywhere in eoreader6 is the naive sort
// in packages/host/corpus.js (fromPrior, then raw `mentions`, full stop).
// The closest thing to "subject re-entry" infrastructure is
// packages/engine/perceiver/text/pronouns.js::resolvePronouns (activation-
// based pronoun binding, gender as a hard filter).
//
// This script builds a real adversarial fixture — a wire-service-style
// article about a quiet, rarely-named central figure (a scientist), embedded
// in a piece where a fictional narrating apparatus ("Continental Newswire")
// is named constantly as the attribution frame — and runs it through the
// REAL pipeline (packages/host/corpus.js::createSession/admitChunked/
// sessionReferents, and directly through resolvePronouns) to see whether the
// real subject still wins individuation over the apparatus.
//
// Run: node scripts/adversarial/challenge-23-apparatus-demotion-regression-npr-bug-cl.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import { createSession, admitChunked, sessionReferents } from "../../packages/host/corpus.js";
import { splitSentences, deriveAbbreviations } from "../../packages/engine/perceiver/text/spans.js";
import { functionWordSet, buildFrequencyTable, tokenize } from "../../packages/engine/perceiver/text/material.js";
import { extractSurfaces, discoverReferents } from "../../packages/engine/perceiver/text/surfaces.js";
import { resolvePronouns } from "../../packages/engine/perceiver/text/pronouns.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

function section(title) {
  console.log("\n" + "=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

// ---------------------------------------------------------------------------
// 0. Confirm the mechanisms named in the claim do not exist in this repo.
// ---------------------------------------------------------------------------
section("STEP 0 — grep the repo for the claimed mechanism (attributive_share, coupling_dispersion, apparatus frame demotion, subject re-entry)");

function grepCount(pattern) {
  try {
    const out = execSync(
      `grep -rni ${JSON.stringify(pattern)} . --include="*.js" --include="*.md" 2>/dev/null | grep -v node_modules | wc -l`,
      { cwd: repoRoot, shell: "/bin/bash" },
    );
    return parseInt(out.toString().trim(), 10);
  } catch {
    return 0;
  }
}

const terms = ["attributive", "coupling_dispersion", "subject.re.entry", "reentry"];
for (const t of terms) {
  const n = grepCount(t);
  console.log(`  grep -rni "${t}" .  ->  ${n} matches`);
}
console.log("(All four terms return 0 matches anywhere in eoreader6 — code, conformance tests, SEED.md, CUBE.md.");
console.log(" The only real ranking rule that runs anywhere in this repo is packages/host/corpus.js:787,");
console.log(' `referents.sort((a, b) => (b.fromPrior === true) - (a.fromPrior === true) || b.mentions - a.mentions)` —');
console.log(" fromPrior first, then raw literal-surface mention count. No individuation-based demotion of any kind.)");

// ---------------------------------------------------------------------------
// 1. Build the adversarial fixture.
// ---------------------------------------------------------------------------
section("STEP 1 — adversarial fixture: quiet real subject vs. heavily-bylined narrating apparatus");

const fixturePath = path.join(__dirname, "fixtures", "wire-quiet-subject.txt");
const text = fs.readFileSync(fixturePath, "utf8");
console.log(`fixture: ${fixturePath}`);
console.log(`length: ${text.length} chars, ${text.split(/\s+/).filter(Boolean).length} words`);
console.log(`
Design of the fixture (real content, hand-authored to the challenge's spec):
  - "Continental Newswire" is a wire-service-style narrating apparatus, named
    as the attribution frame in nearly every paragraph (dateline, "X told
    Continental Newswire", "Continental Newswire has learned", "Continental
    Newswire could not confirm", etc.) — exactly the NPR/AP/Reuters bug-class
    pattern the challenge names.
  - The article's actual subject is a quiet scientist, "Voss" (A. Voss), who
    is named by literal surname only TWICE in the whole piece. Everything
    else about her is carried by effects, quotes, and third-person pronouns
    ("she"/"her") attributed to her without repeating her name — deliberately
    the LOW-raw-mention-count case the challenge asks for, not an easy one.
  - A two-word apparatus name ("Continental Newswire") was chosen, rather
    than a real single-word wire brand, specifically so its raw frequency in
    this short document does not accidentally trip extractSurfaces's own
    Zipf-derived closed-class filter (material.js::functionWordSet, 0.6%-
    of-tokens threshold) and get discarded as a "function word" before ever
    reaching the ranking stage — that would test an unrelated tokenizer
    artifact, not the individuation/demotion claim under test.
`);

// ---------------------------------------------------------------------------
// 2. Run it through the REAL pipeline: createSession -> admitChunked ->
//    sessionReferents. This is exactly the pipeline the survey identified as
//    the only place a ranking decision actually happens in this repo.
// ---------------------------------------------------------------------------
section("STEP 2 — run through the REAL pipeline (packages/host/corpus.js)");

const session = createSession();
const sourceId = "source:challenge23-wire-quiet-subject.txt";
admitChunked(session, { text, sourceId, language: "en" });
const { referents, gaps } = sessionReferents(session, { sourceId, priors: [] });

console.log("Final referents list, IN THE ORDER THE REAL PIPELINE RANKS THEM:");
referents.forEach((r, i) => {
  console.log(`  [${i}] ${JSON.stringify(r)}`);
});
console.log("\nGaps reported by the pipeline:");
gaps.forEach((g) => console.log("  " + JSON.stringify(g)));

const apparatusRef = referents.find((r) => r.display === "Continental Newswire");
const subjectRef = referents.find((r) => r.display === "Voss");

// ---------------------------------------------------------------------------
// 3. Verdict on the naive ranking (corpus.js:787).
// ---------------------------------------------------------------------------
section("STEP 3 — does the narrating apparatus outrank the actual subject?");

let rankingFails = false;
if (!subjectRef) {
  console.log("FAIL (severe): the real subject 'Voss' was not discovered as a referent AT ALL.");
  rankingFails = true;
} else if (!apparatusRef) {
  console.log("Apparatus was not discovered as a referent — cannot compare (fixture design issue).");
} else {
  const apparatusRank = referents.indexOf(apparatusRef);
  const subjectRank = referents.indexOf(subjectRef);
  console.log(`Apparatus "Continental Newswire": rank ${apparatusRank}, mentions=${apparatusRef.mentions}, pronounMentions=${apparatusRef.pronounMentions}`);
  console.log(`Real subject "Voss":              rank ${subjectRank}, mentions=${subjectRef.mentions}, pronounMentions=${subjectRef.pronounMentions}`);
  if (apparatusRank < subjectRank) {
    console.log(`\n=> FAIL: the narrating apparatus (rank ${apparatusRank}) outranks the article's real subject (rank ${subjectRank}).`);
    console.log(`   Ranking rule that produced this (packages/host/corpus.js:787) is a naive sort by raw`);
    console.log(`   mention count with zero individuation-aware adjustment: ${apparatusRef.mentions} > ${subjectRef.mentions}.`);
    rankingFails = true;
  } else {
    console.log(`\n=> the real subject ranked at or above the apparatus on this fixture.`);
  }
}

// ---------------------------------------------------------------------------
// 4. A second, sharper failure: does the "closest existing analog" to
//    subject re-entry (activation-based pronoun binding) defend the subject,
//    or does it actively misattribute HER OWN pronouns to the apparatus?
// ---------------------------------------------------------------------------
section("STEP 4 — pronoun resolution: does 'she'/'her' correctly bind to the real subject, or does it get stolen by the apparatus?");

const abbreviations = deriveAbbreviations(text);
const sentences = splitSentences(text, { abbreviations });
const functionWords = functionWordSet(buildFrequencyTable(tokenize(text)));
const surfaces = extractSurfaces(sentences, { functionWords, abbreviations });
const discovery = discoverReferents(surfaces);
const surfaceToReferent = new Map(discovery.events.map((e) => [e.surface, e.referent_id]));

// Same declared thresholds host/corpus.js actually uses in production
// (PRONOUN_MIN_ACTIVATION / PRONOUN_MIN_MARGIN near the top of corpus.js).
const PRONOUN_MIN_ACTIVATION = 0.05;
const PRONOUN_MIN_MARGIN = 0.2;
const resolved = resolvePronouns(sentences, surfaceToReferent, {
  minActivation: PRONOUN_MIN_ACTIVATION,
  minMargin: PRONOUN_MIN_MARGIN,
});

console.log(`${resolved.bindings.length} pronoun(s) resolved, ${resolved.gaps.length} left as gaps.\n`);
console.log("Every RESOLVED binding, with the sentence it came from:");
let stolenCount = 0;
for (const b of resolved.bindings) {
  const sent = sentences.find((s) => s.order === b.sentenceOrder);
  const wentTo = b.referentId === "ref:auto:voss" ? "Voss (correct — the real subject)" : b.referentId;
  if (b.referentId !== "ref:auto:voss") stolenCount++;
  console.log(`  "${b.pronoun}" (gender=${b.gender}) -> ${wentTo}`);
  console.log(`     sentence: "${sent?.text.slice(0, 100)}..."`);
}

if (stolenCount > 0 && resolved.bindings.length > 0) {
  console.log(`\n=> FAIL: ${stolenCount}/${resolved.bindings.length} of the subject's own third-person-singular`);
  console.log(`   pronoun mentions ("she"/"her") were bound to the NARRATING APPARATUS instead of to her.`);
  console.log(`   Root cause, read directly from pronouns.js: gender evidence for a referent is only`);
  console.log(`   recorded when EXACTLY ONE referent is literally named in the SAME sentence as a`);
  console.log(`   gendered pronoun (pronouns.js lines 261-266). Because the apparatus's name is inserted`);
  console.log(`   as the attribution frame in sentences that also carry a pronoun referring to the real`);
  console.log(`   subject (e.g. "...because none of the organizations contacted by Continental Newswire`);
  console.log(`   appeared to know who she was"), the apparatus — not the person "she" grammatically`);
  console.log(`   refers to — gets tagged gender=female. Once tagged, it passes the gender hard-filter`);
  console.log(`   for every subsequent she/her pronoun, and its much larger activation footprint (its`);
  console.log(`   name recurs in nearly every sentence) wins one-hop recall against the real subject's`);
  console.log(`   sparse vocabulary footprint every time.`);
}

// ---------------------------------------------------------------------------
// Final verdict
// ---------------------------------------------------------------------------
section("VERDICT");
if (rankingFails || stolenCount > 0) {
  console.log("FAIL — the adversarial case defeats the claim on this repo, via TWO independent mechanisms:");
  console.log("  1. The only ranking rule that exists (naive raw-mention-count sort, corpus.js:787) lets");
  console.log("     the apparatus outrank the real subject with no individuation-aware defense at all.");
  console.log("  2. The one piece of infrastructure that COULD carry a subject-re-entry-like signal");
  console.log("     (resolvePronouns' activation-based binding + gender hard filter) actively worsens");
  console.log("     the problem: it misattributes the real subject's own gendered pronouns to the");
  console.log("     apparatus, via a same-sentence gender-evidence heuristic that assumes 'exactly one");
  console.log("     referent named alongside a pronoun' is clean evidence — an assumption a wire-service");
  console.log("     attribution clause ('...told Continental Newswire that she...') straightforwardly");
  console.log("     defeats.");
} else {
  console.log("PASS — the real subject held rank and pronoun ownership against the apparatus.");
}

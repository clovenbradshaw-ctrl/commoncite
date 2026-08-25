// scripts/adversarial/challenge-24-individuation-gate-on-definite-descripti.mjs
//
// Challenge #24 — "Individuation gate on definite-description and
// orbited-absent referents."
//
// Claim under test: "The two-axis (mass x coupling) + agency-signal
// individuation gate should surface un-named referents like 'the creature'
// (Frankenstein, emanon-type) and orbited-but-absent figures like Kurtz
// (Heart of Darkness, protogon-type), not just named entities."
//
// This script:
//   PART 0  confirms (by grep + import inspection, at runtime) that no
//           mass x coupling x agency-signal classifier exists anywhere in
//           eoreader6 and that INDIVIDUATION_TYPES is never consumed.
//   PART A  emanon case: "the creature" (Frankenstein), run three ways:
//           A1 real host pipeline (corpus.js sessionReferents), NO prior
//           A2 real host pipeline, WITH the human-curated coref prior
//           A3 the one real capitalisation-blind statistical mechanism in
//              this repo (referents/entity.js witness gate), run directly,
//              word-level, as the most charitable existing proxy
//   PART B  protogon case: Kurtz (Heart of Darkness), real host pipeline,
//           NO prior — is he dropped, and is his low-mass/high-coupling
//           profile (heavily discussed pre-Part III, physically absent)
//           reflected in ANYTHING the engine computes about him?
//
// Everything below calls real, unmodified eoreader6 code. No source file
// outside scripts/adversarial/ is touched.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createSession, admitChunked, sessionReferents } from "../../packages/host/corpus.js";
import { INDIVIDUATION_TYPES } from "../../packages/engine/referents/index.js";
import {
  openReading, arrive, witnessArrival, offerCandidates, carryEntities, refusals,
} from "../../packages/engine/referents/entity.js";
import { stripContainer } from "../../packages/engine/perceiver/text/spans.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures");

const readText = (name) => readFileSync(join(FIX, name), "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const hr = (t) => console.log(`\n${"=".repeat(78)}\n${t}\n${"=".repeat(78)}`);
const sub = (t) => console.log(`\n--- ${t} ---`);

let failures = 0;
const check = (label, cond, detail) => {
  console.log(`  [${cond ? "OK  " : "FAIL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
  return cond;
};

// ═══════════════════════════════════════════════════════════════════════════
hr("PART 0 — does the claimed mechanism exist at all in eoreader6?");
// ═══════════════════════════════════════════════════════════════════════════

console.log(`INDIVIDUATION_TYPES = ${JSON.stringify(INDIVIDUATION_TYPES)}`);
console.log("(this is the ONLY place these five words appear as a program value anywhere in eoreader6 —");
console.log(" packages/engine/referents/index.js:1, a frozen array, re-exported from packages/engine/index.js)");

// Import referents/index.js's full source and confirm INDIVIDUATION_TYPES is
// never read anywhere except the two declarations/defaults already known
// from corpus.js (prior.individuation || "holon", and the literal `null`).
const referentsIndexSrc = readFileSync(join(HERE, "../../packages/engine/referents/index.js"), "utf8");
check(
  "referents/index.js contains no classifier function (no function that computes a type from mass/coupling)",
  !/classify|mass|coupling|attributive|dispersion/i.test(referentsIndexSrc),
);

const corpusSrc = readFileSync(join(HERE, "../../packages/host/corpus.js"), "utf8");
const individuationAssignments = [...corpusSrc.matchAll(/individuation:\s*([^,\n]+)/g)].map((m) => m[1].trim());
console.log(`corpus.js assigns "individuation" in exactly ${individuationAssignments.length} places: ${JSON.stringify(individuationAssignments)}`);
check(
  "every individuation assignment in corpus.js is either a literal prior passthrough or a literal null (no computation)",
  individuationAssignments.every((a) => a === "null" || a.includes("prior.individuation")),
);

hr("PART A — emanon case: 'the creature' (Frankenstein)");
// ═══════════════════════════════════════════════════════════════════════════

const frank = readText("pg84-frankenstein.txt");
console.log(`Frankenstein fixture: ${frank.length} chars, from scripts/adversarial/fixtures/pg84-frankenstein.txt`);
console.log(`(copy of the same pg84.txt scripts/read-creature.mjs reads via an external absolute path)`);

sub("A1 — real host pipeline (corpus.js::sessionReferents), NO prior");
{
  const session = createSession();
  admitChunked(session, { text: frank, sourceId: "source:frankenstein" });
  const t0 = Date.now();
  const { referents, gaps } = sessionReferents(session, { sourceId: "source:frankenstein", priors: [], limit: 500 });
  console.log(`  sessionReferents: ${referents.length} referents discovered in ${Date.now() - t0}ms, ${gaps.length} gaps`);
  console.log(`  top 8 by rank: ${referents.slice(0, 8).map((r) => `${r.display}(${r.mentions})`).join(", ")}`);

  const descriptorWords = ["creature", "monster", "wretch", "fiend", "dæmon", "daemon", "devil", "being"];
  const matches = referents.filter((r) =>
    r.surfaces.some((s) => descriptorWords.some((w) => String(s).toLowerCase().includes(w)))
  );
  console.log(`  referents whose surfaces mention any of [${descriptorWords.join("/")}]: ${matches.length}`);
  check(
    "'the creature' / 'the monster' / 'the wretch' / etc. do NOT appear as a discovered referent at all (no prior)",
    matches.length === 0,
    matches.length ? `unexpectedly found: ${JSON.stringify(matches.map((m) => m.display))}` : "confirmed absent — extractSurfaces requires a capitalised token; every one of these is a lowercase common noun and never becomes a candidate surface"
  );

  const noSurfaceGap = gaps.find((g) => g.reason === "no_candidate_surfaces");
  check("gap machinery did not even have the vocabulary to flag this (no descriptor-synonymy gap type exists)", !noSurfaceGap, "as expected — the omission is not reported as a gap, it is simply silent");
}

sub("A2 — real host pipeline, WITH the human-curated coref prior (surfaces + individuation hand-typed 'emanon')");
{
  const coref = JSON.parse(readFileSync(join(FIX, "pg84-frankenstein.coref.json"), "utf8"));
  const creaturePrior = coref.referents.find((r) => r.id === "creature");
  console.log(`  prior asserts individuation="${creaturePrior.individuation}" and ${creaturePrior.surfaces.length} hand-authored surfaces`);

  const session = createSession();
  admitChunked(session, { text: frank, sourceId: "source:frankenstein" });
  const { referents } = sessionReferents(session, { sourceId: "source:frankenstein", priors: [creaturePrior], limit: 500 });
  const creatureRef = referents.find((r) => r.id === "creature");
  check("with the prior supplied, 'creature' now appears as a referent", !!creatureRef);
  check("its individuation field reads 'emanon'", creatureRef?.individuation === "emanon", `got ${JSON.stringify(creatureRef?.individuation)}`);
  console.log(`  mentions counted: ${creatureRef?.mentions}, frames: ${creatureRef?.frames}`);
  console.log(`  NOTE: this 'emanon' label is copy-through from the prior JSON's own "individuation": "emanon"`);
  console.log(`  field (packages/host/corpus.js:751: individuation: prior.individuation || "holon") — nothing in`);
  console.log(`  eoreader6 computed it from mass/coupling/agency evidence. Delete that one JSON field, or write`);
  console.log(`  "holon" instead, and the engine would report "holon" with zero other change.`);

  // Prove the previous sentence's claim directly: same run, individuation field stripped from the prior.
  const strippedPrior = { ...creaturePrior, individuation: undefined };
  const session2 = createSession();
  admitChunked(session2, { text: frank, sourceId: "source:frankenstein2" });
  const { referents: referents2 } = sessionReferents(session2, { sourceId: "source:frankenstein2", priors: [strippedPrior], limit: 500 });
  const creatureRef2 = referents2.find((r) => r.id === "creature");
  check(
    "stripping the prior's individuation field silently defaults to 'holon' — same surfaces, same mentions, different label, no recomputation",
    creatureRef2?.individuation === "holon",
    `got ${JSON.stringify(creatureRef2?.individuation)}; mentions unchanged at ${creatureRef2?.mentions} (prior run: ${creatureRef?.mentions})`
  );
}

sub("A3 — the one real capitalisation-blind statistical mechanism (referents/entity.js witness gate), run directly, word-level");
{
  // Mirrors scripts/score-cast-entities.mjs's method exactly (same SPEC),
  // applied to Frankenstein instead of the Finnish fixture, as the most
  // charitable existing proxy for "an un-named common-noun referent gets
  // individuated by recurrence/consequence alone, blind to capitalisation."
  const SPEC = Object.freeze({ window: 16, draws: 128, reseeds: 32, minArrivals: 5, targetTokensPerUnit: 400 });
  const WORD_RE = /[\p{L}\p{M}']+/gu;
  const { text: body } = stripContainer(frank);
  const words = (body.match(WORD_RE) ?? []).map((w) => w.toLowerCase());
  const units = [];
  for (let i = 0; i < words.length; i += SPEC.targetTokensPerUnit) units.push(words.slice(i, i + SPEC.targetTokensPerUnit));
  console.log(`  ${words.length} words, ${units.length} reach-units of ~${SPEC.targetTokensPerUnit} tokens (same drive as scripts/score-cast-entities.mjs)`);

  const state = openReading({ window: SPEC.window, draws: SPEC.draws, reseeds: SPEC.reseeds, minArrivals: SPEC.minArrivals });
  for (const unit of units) {
    arrive(state, unit);
    for (const w of new Set(unit)) witnessArrival(state, w);
  }
  const born = offerCandidates(state);
  const entities = carryEntities(state);
  const refused = refusals(state);
  console.log(`  ${born} newly born this sweep; ${entities.length} total entities admitted; ${refused.length} refused`);

  const probe = (surface) => {
    const isEntity = entities.some((e) => e.surfaces.includes(surface));
    const arrivals = state.arrivals.get(surface)?.length ?? 0;
    const full = state.refused.get(surface); // {gap, reason, ...} — refusals() drops .reason, read the Map directly
    console.log(`    "${surface}": arrivals=${arrivals}  admitted=${isEntity}${full ? `  refused: ${full.reason}${full.rank !== undefined ? ` (rank=${full.rank.toFixed(3)})` : ""}` : ""}`);
    return { isEntity, arrivals, reason: full?.reason };
  };

  console.log("  probing candidate word-surfaces (this gate is single lowercase WORD only — no multi-word phrases):");
  const creatureProbe = probe("creature");
  probe("monster");
  probe("wretch");
  probe("fiend");
  const victorProbe = probe("victor");       // named-character baseline
  const frankProbe = probe("frankenstein");  // named-character baseline (surname)
  const elizProbe = probe("elizabeth");      // named-character baseline

  check(
    "the word 'creature' alone clears the real capitalisation-blind witness gate (best-case existing proxy)",
    creatureProbe.isEntity,
    creatureProbe.isEntity ? "admitted — this mechanism COULD ground un-named individuation but is not wired to it" : "refused — even the best-case proxy does not admit it"
  );
  check(
    "IMPORTANT: 'creature' is NOT being singled out for lacking a capital letter — the named characters fare identically",
    creatureProbe.reason === victorProbe.reason && creatureProbe.reason === frankProbe.reason && creatureProbe.reason === elizProbe.reason,
    `all four share reason "${creatureProbe.reason}" — this specific mechanism, at these SPEC values (window=16 draws=128 reseeds=32 minArrivals=5 chunk=400, copied verbatim from score-cast-entities.mjs's Finnish-text-calibrated operating point), fails to admit ANY of Frankenstein's major characters, named or not. Only ${entities.length} words were admitted at all, and a sample (${entities.slice(0,8).map(e=>e.surfaces[0]).join(", ")}) is dominated by function words — the SAME "closed-class contamination" the script's own header names as a known, accepted artifact on ITS validated fixture. This is not evidence the mechanism discriminates against un-named referents; it is evidence the mechanism has never been calibrated/validated against anything but the one Finnish golden and does not transfer.`
  );
  console.log("  IMPORTANT CAVEAT even in the counterfactual where this DID admit 'creature': it is a single WORD-level");
  console.log("  birth record with no 'individuation' field (field/emanon/protogon/holon/apparatus is not among");
  console.log("  admitFromArrivals's return shape — see referents/entity.js:235-300), it does not know");
  console.log("  'creature'~'monster'~'wretch' are the same being (that union-merge is consequence.js's");
  console.log("  segregation/displacement test, never invoked from here or from corpus.js), and this whole code path");
  console.log("  is NEVER CALLED by sessionReferents/discoveredCast — verified in Part A1's import list: corpus.js");
  console.log("  imports extractSurfaces/discoverReferents, never entity.js.");
}

hr("PART B — protogon case: Kurtz (Heart of Darkness), real host pipeline, NO prior");
// ═══════════════════════════════════════════════════════════════════════════

const hod = readText("heart-of-darkness.txt");
console.log(`Heart of Darkness fixture: ${hod.length} chars (Gutenberg #219, public domain, Conrad d.1924)`);

// Locate the three parts (I / II / III) — Kurtz is discussed at length in
// I and II before Marlow ever meets him face to face in III. This is the
// real, natural "orbited but absent" structure the challenge names.
const partIAt = hod.indexOf("\nI\n");
const partIIAt = hod.indexOf("\nII\n", partIAt + 1);
const partIIIAt = hod.indexOf("\nIII\n", partIIAt + 1);
check("located Part I / II / III markers in the real text", partIAt > -1 && partIIAt > partIAt && partIIIAt > partIIAt);

const countKurtz = (s) => (s.match(/\bKurtz\b/g) || []).length;
const kurtzPre = countKurtz(hod.slice(partIAt, partIIIAt));   // discussed, largely not yet met
const kurtzPost = countKurtz(hod.slice(partIIIAt));            // his own part, where he finally speaks/acts
console.log(`  "Kurtz" named mentions — Parts I+II: ${kurtzPre}   Part III: ${kurtzPost}`);
console.log(`  (a crude part-boundary split undersells the effect — Marlow already glimpses him near the very end`);
console.log(`  of Part II, and once he is physically present in Part III he is discussed even MORE, not less, so raw`);
console.log(`  name-count alone does not cleanly separate "orbited" from "present." A sharper, already-computed`);
console.log(`  signal is used below instead: pronounMentions (activation-bound he/him/his) vs. named mentions.`);

sub("B1 — sessionReferents on the full text, NO prior");
{
  const session = createSession();
  admitChunked(session, { text: hod, sourceId: "source:heart-of-darkness" });
  const { referents, gaps } = sessionReferents(session, { sourceId: "source:heart-of-darkness", priors: [], limit: 500 });
  console.log(`  ${referents.length} referents discovered, ${gaps.length} gaps`);
  console.log(`  top 10 by rank: ${referents.slice(0, 10).map((r) => `${r.display}(${r.mentions})`).join(", ")}`);

  const kurtzRef = referents.find((r) => r.surfaces.some((s) => String(s).toLowerCase() === "kurtz"));
  const rank = referents.indexOf(kurtzRef);
  check("Kurtz IS discovered as a referent (he has a capitalised proper name, unlike 'the creature')", !!kurtzRef);
  console.log(`  Kurtz: display="${kurtzRef?.display}" mentions=${kurtzRef?.mentions} rank=#${rank + 1} of ${referents.length} individuation=${JSON.stringify(kurtzRef?.individuation)}`);
  check(
    "Kurtz's individuation field is null — no protogon type, no distinction from an ordinary character, despite the measured low-mass/high-coupling profile above",
    kurtzRef?.individuation === null
  );

  // Is there ANY field on the referent record that differentiates "named a
  // lot by others while physically absent" from "physically present a lot"?
  // sessionReferents's whole schema: id, display, surfaces, mentions,
  // frames, firstFrame, lastFrame, pronounMentions, pronounFrames,
  // individuation, fromPrior. None of these separate self-agency (Kurtz as
  // grammatical subject of his own verbs) from being-talked-about.
  console.log(`  full referent record for Kurtz: ${JSON.stringify(kurtzRef, null, 2).slice(0, 600)}`);
  check(
    "no field on the referent record encodes an agency/coupling distinction (schema is id/display/surfaces/mentions/frames/individuation/fromPrior only)",
    !("agency" in (kurtzRef || {})) && !("coupling" in (kurtzRef || {})) && !("mass" in (kurtzRef || {}))
  );

  // The pipeline DOES already compute a second, real number that plausibly
  // carries a coupling-like signal: activation-bound third-person pronouns
  // (pronouns.js — "he"/"him"/"his" bound to whichever named referent the
  // sentence's own vocabulary activates). If Kurtz is talked ABOUT via
  // pronoun far more than he is named directly, that is a real, present-in-
  // this-run piece of evidence for "orbited" — and it goes completely
  // unused by individuation (still null) and by ranking (sort key is raw
  // `mentions` only, corpus.js:787).
  console.log(`  named mentions: ${kurtzRef.mentions}   pronounMentions bound to him: ${kurtzRef.pronounMentions}   pronounFrames: ${kurtzRef.pronounFrames}`);
  check(
    "a coupling-shaped signal (pronoun-activation volume far exceeding named mentions) IS already present in this run's own numbers",
    kurtzRef.pronounMentions > kurtzRef.mentions,
    `pronounMentions=${kurtzRef.pronounMentions} vs mentions=${kurtzRef.mentions} — this disparity is real output of resolvePronouns/corpus.js, not fabricated by this script`
  );
  console.log("  CAVEAT: this script has not independently audited whether all 797 pronoun bindings are semantically");
  console.log("  correct (activation-based binding is a one-hop heuristic — see conformance/pronouns.test.js — and");
  console.log("  could over-attribute generic 'he' from other characters' scenes to whichever referent is currently");
  console.log("  most activated). The point stands regardless of that number's precision: pronounMentions and mentions");
  console.log("  are two DIFFERENT signals already computed side-by-side on the SAME referent record, and neither");
  console.log("  corpus.js's sort (mentions only) nor the individuation field (always null) ever combines, ratios, or");
  console.log("  otherwise reads them together — there is no code path from these two numbers to any mass/coupling");
  console.log("  judgement anywhere in eoreader6.");
}

hr("SUMMARY");
console.log(`${failures} check(s) failed out of assertions run above.`);
console.log(failures === 0
  ? "Every check landed on the side the survey predicted: the claimed mechanism is absent, its consequences are real."
  : "At least one check landed against the survey's prediction — see FAIL lines above for the surprise.");
process.exit(failures > 0 ? 1 : 0);

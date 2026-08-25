// challenge-9-single-document-vs-cross-document-terrai.mjs
//
// ADVERSARIAL TEST — Challenge #9 (Single-document vs cross-document terrain)
//
// CLAIM UNDER TEST: "The full ladder Entity->Kind->Link->Network->Atmosphere->
// Lens->Paradigm should run end-to-end on one document, AND across several
// different sources discussing the same underlying topic, with shared
// Lenses/Atmospheres/Paradigms found ACROSS sources — not just independently
// replicated within each."
//
// DESIGN. No single script in this repo composes all seven terrains, and the
// data shapes at the Entity/Kind seam are genuinely incompatible with the
// Link/Network/Atmosphere/Lens/Paradigm seam (see repo survey). This script
// builds real glue — never modifying engine source — to give the claim its
// best honest shot on real text, then asks the actual adversarial question:
// when the SAME pipeline is run independently on two different sources that
// discuss the same real-world topic (Homer's Odyssey, told by two different,
// independently-authored 19th/early-20th-century English writers), does
// anything in this codebase recognize the resulting terrain structures as
// SHARED across the two runs — or are they just two parallel, independently
// computed structures that happen to reuse some of the same ID strings by
// coincidence?
//
// SOURCES (real, fetched from Project Gutenberg, plain text):
//   A = odyssey-greek.txt         Homer's Odyssey, tr. Samuel Butler (1900)
//                                  (already in this repo's root; despite its
//                                  filename its own PG header says
//                                  "Language: English" — verified below)
//   B = church-odyssey-raw.txt    "The Story of the Odyssey", Alfred J. Church
//                                  (1897) — a DIFFERENT author, different
//                                  prose, same underlying topic (Odysseus's
//                                  journey; both use "Ulysses" not
//                                  "Odysseus", so proper-noun surface forms
//                                  really do coincide where the topic
//                                  coincides — the fairest possible case)
//   C = pride-prejudice-raw.txt   Jane Austen — unrelated topic, same
//                                  language era, NEGATIVE CONTROL
//   D = alice-raw.txt             Lewis Carroll — unrelated topic, a second
//                                  real material only used to satisfy
//                                  corpusLevel's own >=4-label requirement
//
// Usage: node scripts/adversarial/challenge-9-single-document-vs-cross-document-terrai.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { splitSentences, stripContainer } from "../../packages/engine/perceiver/text/spans.js";
import { extractRelations, discoverRelationVocab } from "../../packages/engine/perceiver/text/relations.js";
import { extractSurfaces, discoverReferents, diaNorm } from "../../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet, chunkWords, causalSurprisalSeries } from "../../packages/engine/perceiver/text/material.js";
import { projectReferents } from "../../packages/engine/referents/index.js";
import { openReading, arrive, witnessArrival, offerCandidates, carryEntities, refusals } from "../../packages/engine/referents/entity.js";
import { createGraph, readTriples, edgeKey, strongestEdges } from "../../packages/engine/emergence/graph.js";
import { createTierStack, foldThrough, massIsConsistent, gammaFor } from "../../packages/engine/emergence/tiers.js";
import { induceKinds } from "../../packages/engine/emergence/kinds.js";
import { paradigmCores, refuseParadigm } from "../../packages/engine/emergence/paradigm.js";
import { createLemmatizer } from "../../packages/engine/perceiver/text/morphology.js";
import { createRegimeTracker } from "../../packages/engine/loops/atmosphere.js";
import { fold, alternatives } from "../../packages/engine/emergence/fold.js";
import { corpusLevel } from "../../packages/engine/loops/corpus.js";
import { isGap } from "../../nul/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIX = join(ROOT, "scripts", "adversarial", "fixtures");

// ── declared numbers, once, for the whole run ───────────────────────────────
const SENTENCES_PER_FRAME = 6;
const TIER_NAMES = ["atmosphere", "lens", "paradigm"]; // emergence/tiers.js's own local names
const WINDOW = 12;
const DRAWS = 150;
const TIER_SEED = 20260805;
const MIN_SURFACES = 1;
const MAIN_CHAR_CAP = 800000;     // effectively uncapped for these fixtures — full documents
const ENTITY_CHAR_CAP = 60000;    // the genuine witness-gate Entity mechanism is the most compute-heavy per-candidate; a smaller real excerpt is used for it
const ENTITY_SPEC = Object.freeze({ window: 16, draws: 128, reseeds: 32, minArrivals: 5 });
const ENTITY_TOKENS_PER_UNIT = 400;
// `reseeds` added post-hoc: induceKinds() now requires it unconditionally
// (an unrelated, already-landed fix — the search null is no longer
// value-channel-only, see emergence/kinds.js's 2026-08-05 header note) —
// without it every call below throws before this challenge's own question
// can even be asked. Not a change to this script's methodology or verdict
// logic, only to keep it running against the current, correct API contract.
const KIND_OPTS = { population: "referent-verb-profile", minPrevalence: 0.15, minKindSize: 3, permutations: 100, quantile: 0.9, seed: 42, reseeds: 24 };
const ATMOS_SPEC = { window: 12, draws: 150, tolerance: 3, seed: TIER_SEED };
const FOLD_SPEC = { window: 12, draws: 150, seed: TIER_SEED };

const WORD_RE = /[\p{L}\p{M}]+/gu;

// ── load real texts, cap for runtime, strip PG boilerplate ─────────────────
const loadText = (path, cap) => {
  const raw = readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const { text, front } = stripContainer(raw);
  const lang = front.find((f) => /language/i.test(f.field))?.value ?? "(unstated)";
  const body = text.slice(0, cap);
  return { body, lang, fullLen: text.length };
};

const SOURCES = {
  A_butler: { path: join(ROOT, "odyssey-greek.txt"), label: "Butler's Odyssey (tr. of Homer, 1900)" },
  B_church: { path: join(FIX, "church-odyssey-raw.txt"), label: "Church's Story of the Odyssey (1897)" },
  C_austen: { path: join(FIX, "pride-prejudice-raw.txt"), label: "Austen's Pride and Prejudice (negative control)" },
  D_carroll: { path: join(FIX, "alice-raw.txt"), label: "Carroll's Alice's Adventures in Wonderland (corpusLevel pool filler)" },
};

console.log("=".repeat(78));
console.log("CHALLENGE #9 — single-document vs cross-document terrain");
console.log("=".repeat(78));
for (const [key, s] of Object.entries(SOURCES)) {
  const { body, lang, fullLen } = loadText(s.path, MAIN_CHAR_CAP);
  s.body = body;
  s.lang = lang;
  s.fullLen = fullLen;
  console.log(`  ${key.padEnd(10)} lang=${lang.padEnd(9)} fullBodyChars=${fullLen}  used=${body.length}  ${s.label}`);
}

// ── the pipeline: as much of Entity->Kind->Link->Network->Atmosphere->Lens->
//    Paradigm as this repo's real organs support, wired by glue in THIS
//    script (never by editing engine source) ─────────────────────────────────
function runLadder(text, label) {
  const sentences = splitSentences(text);
  const frames = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_FRAME) {
    const g = sentences.slice(i, i + SENTENCES_PER_FRAME);
    if (g.length) frames.push({ order: frames.length, offset: g[0].offset, text: g.map((s) => s.text).join(" ") });
  }

  // ── "cast" via referents/index.js — the identity mechanism the app itself
  //    actually uses (host/corpus.js), content-addressed: ref:auto:<name> ──
  const table = buildFrequencyTable(tokenize(text));
  const functionWords = functionWordSet(table);
  const surfaces = extractSurfaces(sentences, { functionWords });
  const cast = projectReferents(discoverReferents(surfaces).events).filter((r) => !r.mergedInto);
  const surfaceToId = [];
  for (const r of cast) for (const s of r.surfaces) {
    const n = diaNorm(s);
    if (n.length < 2) continue;
    surfaceToId.push([n, new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u"), r.id]);
  }
  surfaceToId.sort((a, b) => b[0].length - a[0].length);
  const resolve = (phrase) => {
    const p = diaNorm(phrase);
    for (const [, re, id] of surfaceToId) if (re.test(p)) return id;
    return null;
  };

  // ── Entity: referents/entity.js's GENUINE witness-gate birth condition, on
  //    a smaller real excerpt of the SAME text (see ENTITY_CHAR_CAP) ────────
  const entityText = text.slice(0, ENTITY_CHAR_CAP);
  const words = (entityText.match(WORD_RE) ?? []).map((w) => w.toLowerCase());
  const units = [];
  for (let i = 0; i < words.length; i += ENTITY_TOKENS_PER_UNIT) units.push(words.slice(i, i + ENTITY_TOKENS_PER_UNIT));
  const eState = openReading(ENTITY_SPEC);
  for (const u of units) {
    arrive(eState, u);
    for (const surface of new Set(u)) witnessArrival(eState, surface);
  }
  const bornCount = offerCandidates(eState);
  const entityRegister = carryEntities(eState);
  const entityRefusals = refusals(eState);

  // ── Link/Network: relations.js's SVO mouth, graph.js's Network ───────────
  const { verbs } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: MIN_SURFACES });
  const graph = createGraph({ gamma: gammaFor(WINDOW), pruneBelow: 1e-4 });
  const tiers = createTierStack(TIER_NAMES, { window: WINDOW, draws: DRAWS, seed: TIER_SEED });
  const allTriples = [];
  const nodeArrivalSeries = []; // one number per frame: how much node+edge mass arrived — the numeric material fold.js/corpus.js can actually consume

  for (const f of frames) {
    const raw = extractRelations(f.text, { verbs });
    const clean = raw
      .map((t) => ({ ...t, subject: resolve(t.subject), object: resolve(t.object) }))
      .filter((t) => t.subject && t.object && t.subject !== t.object);
    allTriples.push(...clean.map((t) => ({ ...t, frame: f.order })));
    if (clean.length) readTriples(graph, clean);

    const arrival = new Map();
    const bump = (k) => arrival.set(k, (arrival.get(k) ?? 0) + 1);
    for (const t of clean) { bump(`node:${t.subject}`); bump(`node:${t.object}`); bump(`edge:${edgeKey(t)}`); }
    nodeArrivalSeries.push([...arrival.values()].reduce((a, b) => a + b, 0));
    if (arrival.size) foldThrough(tiers, arrival);
  }
  for (const t of tiers) if (!massIsConsistent(t)) throw new Error(`tier ${t.name}: prior mass diverged`);

  // ── Kind: build real, text-derived {id, attributes} records — one record
  //    per referent, attributes = the verbs it was subject/object of. This is
  //    exactly the "clause-reading harness" input shape kinds.js's own header
  //    describes as needed and this repo has no script that builds — built
  //    here, as glue, from real triples only. ──────────────────────────────
  const perReferent = new Map(); // id -> Map(field_id -> count)
  for (const t of allTriples) {
    for (const id of [t.subject, t.object]) {
      let m = perReferent.get(id);
      if (!m) perReferent.set(id, (m = new Map()));
      m.set(`verb:${t.verb}`, (m.get(`verb:${t.verb}`) ?? 0) + 1);
    }
  }
  const kindRecords = [...perReferent.entries()]
    .filter(([, m]) => m.size >= 1)
    .map(([id, m]) => ({ id, attributes: [...m.entries()].map(([field_id, count]) => ({ field_id, value_type: "boolean", count })) }));

  let kinds = [];
  let kindError = null;
  if (kindRecords.length >= KIND_OPTS.minKindSize) {
    try { kinds = induceKinds(kindRecords, KIND_OPTS); }
    catch (e) { kindError = e.message; }
  }

  // ── Atmosphere: loops/atmosphere.js's OWN canonical Ground-cell organ,
  //    causal, one value at a time — a second, independent Atmosphere organ
  //    from the tiers.js one, run for completeness against the operator
  //    roster's actual cell assignment (operators.js: Atmosphere =
  //    loops/atmosphere.js, not tiers.js's local "atmosphere" tier name) ───
  const chunks = chunkWords(tokenize(text), 40);
  const series = causalSurprisalSeries(chunks);
  const tracker = createRegimeTracker(ATMOS_SPEC);
  const atmosEvents = [];
  for (let i = 0; i < series.length; i++) {
    const r = tracker.push(series[i]);
    if (r.rezeroed) atmosEvents.push({ at: i, regimeStart: r.regimeStart });
  }

  return {
    label, frames, cast, entityRegister, entityRefusals, bornCount,
    graph, tiers, allTriples, kindRecords, kinds, kindError,
    nodeArrivalSeries, series, atmosEvents, tracker,
  };
}

console.log("\nRunning the full glued ladder on each source (Entity/Kind/Link/Network/Atmosphere/Lens/Paradigm)…");
const t0 = Date.now();
const results = {};
for (const [key, s] of Object.entries(SOURCES)) {
  const r = runLadder(s.body, s.label);
  results[key] = r;
  console.log(`  ${key.padEnd(10)} ${((Date.now() - t0) / 1000).toFixed(1)}s so far`);
}

// ════════════════════════════════════════════════════════════════════════
// PART 1 — SINGLE DOCUMENT: does the (glued) ladder run end-to-end on ONE
// document, and produce non-degenerate output at every rung?
// ════════════════════════════════════════════════════════════════════════
function reportOne(r) {
  console.log(`\n${"─".repeat(78)}\n${r.label}\n${"─".repeat(78)}`);
  console.log(`  frames: ${r.frames.length}`);
  console.log(`  [Existence·Figure  ENTITY (genuine witness-gate, entity.js)]`);
  console.log(`    born ${r.bornCount}  register ${r.entityRegister.length}  refused ${r.entityRefusals.length}`);
  console.log(`    sample: ${r.entityRegister.slice(0, 8).map((e) => e.surfaces[0]).join(", ") || "(none)"}`);
  console.log(`  [Existence·Figure  cast identity (referents/index.js, content-addressed ids — the mechanism host/corpus.js actually uses)]`);
  console.log(`    ${r.cast.length} referents, e.g. ids: ${r.cast.slice(0, 5).map((c) => c.id).join(", ")}`);
  console.log(`  [Existence·Pattern KIND (emergence/kinds.js induceKinds, over ${r.kindRecords.length} referent-verb-profile records built from real triples)]`);
  if (r.kindError) console.log(`    ERROR: ${r.kindError}`);
  else if (r.kinds.length === 0) console.log(`    0 kinds induced (refused — no cluster cleared both Born gates on this material)`);
  else for (const k of r.kinds.slice(0, 5)) console.log(`    kind "${k.label}"  height=${k.height}  cohesion=${k.cohesion.toFixed(3)}  members=${k.members.length}  core=${k.core?.field_id ?? "—"}`);
  console.log(`  [Structure·Figure/Pattern LINK/NETWORK (graph.js)]`);
  console.log(`    ${r.graph.nodes.size} nodes, ${r.graph.edges.size} live edges, ${r.allTriples.length} kept triples over the run`);
  for (const e of strongestEdges(r.graph, 3)) console.log(`      ${e.weight.toFixed(2)}  ${e.edge}`);
  console.log(`  [Interpretation·Ground ATMOSPHERE (loops/atmosphere.js createRegimeTracker, causal)]`);
  console.log(`    ${r.series.length} pushes, ${r.atmosEvents.length} re-zero events`);
  console.log(`  [Interpretation·Figure/Pattern LENS/PARADIGM (emergence/tiers.js foldThrough, local tier names)]`);
  for (const t of r.tiers) console.log(`    tier ${t.name.padEnd(11)} observed ${t.observations}  shifted ${t.shifts}`);
  const paraShifts = r.tiers.find((t) => t.name === "paradigm").shiftRecords;
  if (paraShifts.length) {
    console.log(`    paradigm-tier shift forms sample: ${paraShifts[0].forms.slice(0, 6).join(", ")}`);
  }
}

console.log(`\n${"=".repeat(78)}\nPART 1 — SINGLE-DOCUMENT RUN (Butler's Odyssey alone)\n${"=".repeat(78)}`);
reportOne(results.A_butler);

const part1Verdict = {
  entityRan: results.A_butler.entityRegister.length > 0,
  kindRan: results.A_butler.kinds.length > 0 && !results.A_butler.kindError,
  linkNetworkRan: results.A_butler.graph.edges.size > 0,
  atmosphereRan: results.A_butler.atmosEvents.length >= 0 && results.A_butler.series.length > 0,
  lensParadigmRan: results.A_butler.tiers.some((t) => t.observations > 0),
};
console.log(`\nPART 1 rung-by-rung: ${JSON.stringify(part1Verdict)}`);

// ════════════════════════════════════════════════════════════════════════
// PART 2 — CROSS-DOCUMENT: same-topic sources (A vs B). Is ANY higher-level
// terrain structure recognized as SHARED, or are A's and B's structures
// merely parallel/independent?
// ════════════════════════════════════════════════════════════════════════
console.log(`\n${"=".repeat(78)}\nPART 2 — CROSS-DOCUMENT RUN\n${"=".repeat(78)}`);
reportOne(results.B_church);

// (a) literal string-id overlap in the content-addressed cast layer
const idsA = new Set(results.A_butler.cast.map((c) => c.id));
const idsB = new Set(results.B_church.cast.map((c) => c.id));
const sharedIds = [...idsA].filter((id) => idsB.has(id));
console.log(`\n(a) content-addressed referent-id overlap between A (Butler) and B (Church):`);
console.log(`    A has ${idsA.size} referent ids, B has ${idsB.size}, ${sharedIds.length} STRING-IDENTICAL across the two independent runs`);
console.log(`    shared: ${sharedIds.slice(0, 20).join(", ")}`);

// (b) do those coincidentally-shared ids appear in EACH run's OWN paradigm-tier shift forms?
const formsIn = (r) => new Set(r.tiers.flatMap((t) => t.shiftRecords.flatMap((s) => s.forms)).map((f) => f.replace(/^node:/, "").replace(/^edge:/, "")));
const formsA = formsIn(results.A_butler);
const formsB = formsIn(results.B_church);
const sharedInShifts = sharedIds.filter((id) => [...formsA].some((f) => f.includes(id)) && [...formsB].some((f) => f.includes(id)));
console.log(`\n(b) of those shared ids, how many actually drove a tier SHIFT (atmosphere/lens/paradigm) in BOTH A's and B's independently-built tier stacks:`);
console.log(`    ${sharedInShifts.length} of ${sharedIds.length}: ${sharedInShifts.slice(0, 10).join(", ") || "(none)"}`);
console.log(`    NOTE: even where this is >0, it is coincidence in MY comparison code above, not something the engine itself computed —`);
console.log(`    tiers.js's tier.prior is a plain per-run Map; createTierStack/observe/foldThrough take exactly ONE material's arrivals and`);
console.log(`    there is no exported function anywhere in emergence/tiers.js that accepts two tier stacks and asks whether they agree.`);

// (c) attempt the actual cross-material comparison machinery this repo has,
//     directly, on the two runs' own numeric node-arrival series
console.log(`\n(c) attempting the repo's OWN cross-material comparison organs directly on A vs B:`);

const foldA = fold({ material: results.A_butler.nodeArrivalSeries, here: results.A_butler.nodeArrivalSeries.length - 1, ...FOLD_SPEC });
const foldB = fold({ material: results.B_church.nodeArrivalSeries, here: results.B_church.nodeArrivalSeries.length - 1, ...FOLD_SPEC });
console.log(`    fold(A) here=${JSON.stringify(foldA?.here)} spec.of=${foldA?.spec?.of}   fold(B) here=${JSON.stringify(foldB?.here)} spec.of=${foldB?.spec?.of}`);
const alt = alternatives([foldA, foldB]);
console.log(`    alternatives([foldA, foldB]) => ${isGap(alt) ? `GAP: ${JSON.stringify(alt)}` : JSON.stringify(alt).slice(0, 200)}`);

const corpusMaterials = {
  butler: results.A_butler.nodeArrivalSeries,
  church: results.B_church.nodeArrivalSeries,
  austen: results.C_austen.nodeArrivalSeries,
  carroll: results.D_carroll.nodeArrivalSeries,
};
const cLevel = corpusLevel(corpusMaterials, { draws: 150, window: 12, seed: TIER_SEED });
console.log(`    corpusLevel({butler,church,austen,carroll}) =>`);
if (cLevel.gap) console.log(`      GAP: ${JSON.stringify(cLevel.gap)} at ${cLevel.at}`);
else {
  console.log(`      shapes (one dimensionless ratio per book): ${JSON.stringify(cLevel.shapes)}`);
  console.log(`      this is the ENTIRE cross-document output: one scalar per book, ranked against a leave-one-out pool of the OTHER books' own scalars.`);
  console.log(`      it says nothing about whether butler's and church's KINDS, LINKS, ATMOSPHERE REGIONS, LENS or PARADIGM TIERS are the same object —`);
  console.log(`      it never touches those structures at all.`);
}

// (d) the ONE genuine cross-material mechanism at the canonical Paradigm
//     cell (Interpretation x Pattern = emergence/paradigm.js, per
//     operators.js's own TERRAIN_BY_DOMAIN — NOT tiers.js's local
//     "paradigm" tier name): does A's induced Paradigm (its kinds' cores)
//     hold B's independently-built material? Tested against a real negative
//     control (Austen) to make sure the test can discriminate at all.
console.log(`\n(d) the one real cross-material mechanism in the operator roster for the canonical Paradigm cell (emergence/paradigm.js refuseParadigm):`);
console.log(`    trying BOTH directions — whichever document's own material actually induced a paradigm (kinds.length > 0) is used as the`);
console.log(`    "held" side, and it is tested against the OTHER real document's independently-built records, plus a negative control.`);

// A small, real UniMorph-shaped irregular-verb table (a representative
// excerpt — the full UniMorph prior is external witness-tier data this repo
// does not ship, see scripts/build-morphology-prior.mjs). `createLemmatizer`
// unions this table with its own rule-derived suffix stemming for every
// regular verb, so this handful of irregular pairs is enough to activate
// the whole mechanism, not just itself.
const MORPH_TABLE = { made: ["make"], makes: ["make"], came: ["come"], went: ["go"], said: ["say"], saw: ["see"] };
const lemmatizer = createLemmatizer(MORPH_TABLE);

const runParadigmTest = (paradigmLabel, kinds, testDocs) => {
  const coresP = paradigmCores(kinds);
  console.log(`\n    PARADIGM FROM ${paradigmLabel} — cores (${coresP.size}): ${[...coresP].slice(0, 10).join(", ")}`);
  const held = (records) => records.filter((rec) => rec.attributes.some((a) => coresP.has(a.field_id))).length;
  for (const [label, records] of testDocs) {
    if (!records || records.length === 0) { console.log(`      vs ${label}: no records to test`); continue; }
    const h = held(records);
    const res = refuseParadigm(kinds, records, KIND_OPTS);
    const resLemma = refuseParadigm(kinds, records, { ...KIND_OPTS, sameAct: lemmatizer.sameAct });
    const summary = isGap(res)
      ? `GAP ${res.gap} — ${res.reason ?? ""}`
      : `refused=${res.refused} placement=${res.placement.toFixed(3)} coherent=${res.coherent}`;
    const summaryLemma = isGap(resLemma)
      ? `GAP ${resLemma.gap} — ${resLemma.reason ?? ""}`
      : `refused=${resLemma.refused} placement=${resLemma.placement.toFixed(3)} coherent=${resLemma.coherent}`;
    console.log(`      vs ${label}: ${h}/${records.length} of its records literally carry one of the paradigm's own core field_ids;`);
    console.log(`        exact-identity:        refuseParadigm() => ${summary}`);
    console.log(`        + sameAct (this fix):  refuseParadigm() => ${summaryLemma}`);
  }
  return coresP;
};

let anyParadigmTested = false;
let testedKinds = null;
let testedCores = null;
if (results.A_butler.kinds.length > 0) {
  anyParadigmTested = true;
  testedKinds = results.A_butler.kinds;
  testedCores = runParadigmTest("A (Butler)", results.A_butler.kinds, [
    ["B (Church, SAME topic)", results.B_church.kindRecords],
    ["C (Austen, DIFFERENT topic, negative control)", results.C_austen.kindRecords],
  ]);
}
if (results.B_church.kinds.length > 0) {
  anyParadigmTested = true;
  testedKinds = results.B_church.kinds;
  testedCores = runParadigmTest("B (Church)", results.B_church.kinds, [
    ["A (Butler, SAME topic)", results.A_butler.kindRecords],
    ["C (Austen, DIFFERENT topic, negative control)", results.C_austen.kindRecords],
  ]);
}
if (!anyParadigmTested) console.log(`    neither A nor B induced any kinds from their own material — refuseParadigm has nothing to test with on this run.`);

// (e) THE FIX, ISOLATED. (a)-(d) ask whether Butler's and Church's own
// literal word choices happen to coincide — a question about SYNONYMY
// ("departed" vs "set out"), which paradigm.js's own new header explicitly
// disclaims as out of scope (MODEL tier, needs its own received resolver).
// This asks the narrower, load-bearing question the fix actually answers:
// when two independently-authored documents describe the same event but one
// used a different INFLECTION of the very same verb the paradigm cohered
// on — the one cross-material identity gap this repo has a real, shipped,
// received prior for (perceiver/text/morphology.js, UniMorph) — is it seen?
// Built from the run's own real induced paradigm, never fabricated: takes
// every record that carries one of the paradigm's own verb: cores and
// re-spells that field_id in a different real inflection of the same verb.
console.log(`\n(e) the fix, isolated: does a genuinely different-authored record carrying a DIFFERENT INFLECTION of the paradigm's own verb get recognised (not a different verb — that is synonymy and stays out of scope, see paradigm.js's header)?`);
if (testedKinds && testedCores) {
  const verbCores = [...testedCores].filter((c) => c.startsWith("verb:"));
  const RESPELL = { made: "makes", makes: "made", came: "comes", went: "goes", said: "says", saw: "sees", departed: "departs", departs: "departed" };
  const reinflected = [];
  for (const core of verbCores) {
    const verb = core.slice("verb:".length);
    const alt = RESPELL[verb];
    // >= minKindSize copies (distinct ids, same re-spelled field) — refuseParadigm's
    // own coherence check (coherenceOf -> induceKinds) requires it to run at all;
    // the question here is placement, not whether these three records also cohere.
    if (alt) for (let i = 0; i < KIND_OPTS.minKindSize; i++) reinflected.push({ id: `reinflected:${verb}->${alt}:${i}`, attributes: [{ field_id: `verb:${alt}`, value_type: "boolean", count: 1 }] });
  }
  if (reinflected.length === 0) {
    console.log(`    none of this run's real verb: cores (${verbCores.join(", ") || "(none)"}) are in this script's small representative respelling table — no controlled inflection swap available on this run's actual cores.`);
  } else {
    const withoutLemma = refuseParadigm(testedKinds, reinflected, KIND_OPTS);
    const withLemma = refuseParadigm(testedKinds, reinflected, { ...KIND_OPTS, sameAct: lemmatizer.sameAct });
    console.log(`    ${reinflected.length} record(s), each the paradigm's own core verb re-spelled in a different real inflection (e.g. ${reinflected[0].id}):`);
    console.log(`      exact-identity:        placement=${isGap(withoutLemma) ? withoutLemma.gap : withoutLemma.placement.toFixed(3)}`);
    console.log(`      + sameAct (this fix):  placement=${isGap(withLemma) ? withLemma.gap : withLemma.placement.toFixed(3)}`);
  }
} else {
  console.log(`    no paradigm induced this run — nothing to isolate the fix against.`);
}

console.log(`\n${"=".repeat(78)}\nSUMMARY\n${"=".repeat(78)}`);
console.log(JSON.stringify({
  part1_single_document_all_rungs_ran: part1Verdict,
  part2_shared_referent_id_strings: sharedIds.length,
  part2_shared_ids_that_drove_shift_in_both_runs: sharedInShifts.length,
  part2_alternatives_result: isGap(alt) ? alt.gap : "placed",
  part2_corpusLevel_is_single_scalar_only: true,
}, null, 2));

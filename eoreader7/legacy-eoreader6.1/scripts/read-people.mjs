// eoreader6 · read-people — THE POPULATION, READ AS A KIND.
//
// The graph after a full read is a belief about who does what to whom; this
// script asks the question the reader carries into the material before any
// passage:
//
//     Do I already understand what these beings are, or does the material
//     have to teach me?
//
// It walks the canonical SVO pipeline (referent-gated by the eoPriors coref
// prior, first person bound by narrator scope — the same path read-tiered
// uses), then hands the graph to emergence/people.js:
//
//   deriveBeingRecords   the net's incident structure, read as records —
//                        identity by consequence, never by name
//   understand           the one question, whole: a received kind prior, or
//                        the typed gap and the invented kind
//   foldHolons           kinds as holons: each level's kinds reified into
//                        the level above, halting where the material does
//
// Nothing here scores a passage and nothing ranks a being. The result is the
// reading: what the reader understood, and where it had to learn.

import { readFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { extractRelations, discoverRelationVocab } from "../packages/engine/perceiver/text/relations.js";
import { createGraph, readTriples, strongestEdges } from "../packages/engine/emergence/graph.js";
import { gammaFor } from "../packages/engine/emergence/tiers.js";
import { extractSurfaces, discoverReferents, diaNorm } from "../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../packages/engine/perceiver/text/material.js";
import { projectReferents } from "../packages/engine/referents/index.js";
import { resolveAllNarratorSpans, narratorAt, isFirstPerson } from "../packages/engine/perceiver/text/narrator.js";
import { deriveBeingRecords, understand, foldHolons } from "../packages/engine/emergence/jati.js";
import { isGap } from "../nul/index.js";

const TEXT_PATH = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const COREF_PATH = process.argv[3] || "scripts/adversarial/fixtures/pg84-frankenstein.coref.json";
const KIND_PRIORS_PATH = process.argv[4] || "";
const POPULATION = process.argv[5] || "pg84-beings";
const READER_VERSION = "eo-2026-07";

// Declared, never defaulted — the same numbers the kinds organ enforces.
const OPTS = { minPrevalence: 0.25, minKindSize: 3, permutations: 200, quantile: 0.95, seed: 42, reseeds: 24 };

const SENTENCES_PER_FRAME = 6; // matches read-tiered.mjs's own framing of the same material
// The reach of the present, in frames — same declared number read-tiered.mjs
// uses for this material's tier stack. This script builds no tier stack, but
// the graph below forgets at the reach WINDOW derives (gammaFor), so it is
// declared here rather than left as a bare gamma nobody re-derived.
const WINDOW = 12;
const PRUNE_BELOW = 1e-4; // the floor below which a decayed relation is forgotten outright, not carried as noise

const { text } = stripContainer(readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));

const sentences = splitSentences(text);
const frames = [];
for (let i = 0; i < sentences.length; i += SENTENCES_PER_FRAME) {
  const g = sentences.slice(i, i + SENTENCES_PER_FRAME);
  if (g.length) frames.push({ order: frames.length, offset: g[0].offset, text: g.map((s) => s.text).join(" ") });
}

// ── the cast, discovered blind ──────────────────────────────────────────────
// Kept only when BOTH ends resolve to a referent; first-person surfaces bind
// by SCOPE (Walton > Victor > Creature), never by string.
const table = buildFrequencyTable(tokenize(text));
const functionWords = functionWordSet(table);
const surfaces = extractSurfaces(sentences, { functionWords });
const referentEvents = discoverReferents(surfaces).events;
const cast = projectReferents(referentEvents).filter((r) => !r.mergedInto);

// ── the relation vocabulary, measured — never a hand-listed English verb
// list. A candidate is the token found immediately after one of the surfaces
// just discovered blind above, standing in the slot SVO order gives a verb
// (relations.js::discoverRelationVocab). minSurfaces=1: this reader's own
// referent-resolution already discards nearly everything the raw SVO parse
// finds (both ends must resolve to a blind-discovered proper-noun referent,
// and Frankenstein's objects are mostly pronouns this ladder cannot yet
// resolve — surfaces.js's documented model-tier gap), so recall matters more
// than a stricter recurrence bar here. MEASURED on pg84.txt: minSurfaces=2
// leaves the graph too sparse for induceKinds to find two kinds at all;
// minSurfaces=1 is what let a Kind actually get induced.
const { verbs, candidates } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 });

const surfaceToId = [];
for (const r of cast) for (const s of r.surfaces) {
  const n = diaNorm(s);
  if (n.length < 2) continue;
  surfaceToId.push([n, new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u"), r.id]);
}
surfaceToId.sort((a, b) => b[0].length - a[0].length);

const coref = JSON.parse(readFileSync(COREF_PATH, "utf8"));
const { resolved: narratorSpans, unresolved: narratorGaps } = resolveAllNarratorSpans(text, coref.referents);

let firstPersonBound = 0, firstPersonGapped = 0;

const resolve = (phrase, offset) => {
  const p = diaNorm(phrase);
  if (isFirstPerson(p)) {
    const n = narratorAt(offset, narratorSpans);
    if (n.referentId) { firstPersonBound++; return n.referentId; }
    firstPersonGapped++;
    return null;
  }
  for (const [, re, id] of surfaceToId) if (re.test(p)) return id;
  return null;
};

// The graph forgets at the same reach as everything else here: a relation not
// restated within the present fades. Derived from WINDOW by the same identity
// read-tiered.mjs's tier stack uses (1 - 1/window), so this script declares
// no forgetting rate of its own either — this used to be a bare
// createGraph({ gamma: 0.9 }), the one hand-pick commit 7ca94e5 fixed in
// read-tiered.mjs but missed here.
const graph = createGraph({ gamma: gammaFor(WINDOW), pruneBelow: PRUNE_BELOW });
let totalTriples = 0, statedTotal = 0;

for (const f of frames) {
  const raw = extractRelations(f.text, { verbs, functionWords });
  statedTotal += raw.length;
  const triples = raw
    .map((t) => ({ ...t, subject: resolve(t.subject, f.offset), object: resolve(t.object, f.offset), said: t }))
    .filter((t) => t.subject && t.object && t.subject !== t.object);
  totalTriples += triples.length;
  if (!triples.length) continue;
  readTriples(graph, triples);
}

console.log(`READING ${TEXT_PATH.split("/").pop()} — ${frames.length} frames`);
console.log(`relation vocabulary: ${verbs.size} verbs measured from the text (${candidates.length} candidates seen, minSurfaces 1) — never a hand-listed set`);
console.log(`SVO: ${statedTotal} stated, ${totalTriples} kept (both ends resolve to a referent)`);
console.log(`cast discovered blind: ${cast.length} referents`);
console.log(`narrator spans: ${narratorSpans.length} resolved, ${narratorGaps.length} unresolved`);
console.log(`first-person: ${firstPersonBound} bound by scope, ${firstPersonGapped} typed gaps`);
console.log(`graph: ${graph.nodes.size} nodes, ${graph.edges.size} live relations\n`);

// ── the population, read ────────────────────────────────────────────────────
const records = deriveBeingRecords(graph, { population: POPULATION });
console.log(`being-records derived: ${records.length} (beings incident to a live relation)\n`);

const kindPriors = KIND_PRIORS_PATH
  ? JSON.parse(readFileSync(KIND_PRIORS_PATH, "utf8")).priors
  : [];

const u = understand(records, { priors: kindPriors, population: POPULATION, readerVersion: READER_VERSION, ...OPTS });

console.log("═".repeat(70));
if (u.understanding === "prior") {
  console.log(`UNDERSTANDING: prior — ${u.giver} covers ${u.population} as kind ${u.prior_kind.label}`);
  console.log(`(nothing invented; the gift is the understanding)`);
} else {
  console.log(`UNDERSTANDING: invented — no kind prior covered this population for reader ${u.readerVersion}`);
  console.log(`prior check: ${u.prior.gap} (${u.prior.checked} prior(s) checked, ${u.prior.refused.length} refused)`);
  for (const r of u.prior.refused) console.log(`   refused ${r.giver}: ${r.reason}`);
  console.log("");
  console.log(`reading: ${u.reading.keys.join(", ")} → valued: ${u.reading.valued}`);
  for (const f of u.reading.fields) console.log(`   ${f.field_id.padEnd(16)} ${f.mode}${f.scale ? ` (scale ${f.scale})` : ""}`);
  for (const g of u.reading.gaps) console.log(`   gap ${g.field_id}: ${g.gap} — ${g.reason}`);
  console.log("");
  console.log(`kinds induced: ${u.kinds.length}`);
  for (const k of u.kinds) {
    console.log(`\n  KIND ${k.label} (${k.members.length} members)`);
    console.log(`    height: ${k.height}${k.height === "above" ? ` — existence ${k.heightGate.existence.passed ? "earned" : "failed"}, constraint ${k.heightGate.constraint.passed ? "earned" : "failed"}` : ""}`);
    if (k.core) console.log(`    core: centred on ${k.core.centre}, lift ${k.core.lift.toFixed(3)}`);
    console.log(`    ground: ${k.ground}`);
    const roster = k.members.slice(0, 16).map((m) => m.replace(/^ref:(auto|narrator):/, ""));
    console.log(`    members: ${roster.join(", ")}${k.members.length > 16 ? ` … and ${k.members.length - 16} more` : ""}`);
  }
}

console.log("\n" + "═".repeat(70));
console.log("THE FOLD — kinds as holons:");
const fold = foldHolons(records, { population: POPULATION, levels: 3, ...OPTS });
if (!fold.halted) {
  console.log(`reached all ${fold.ladder.length} declared levels without halting`);
} else {
  console.log(`halted at level ${fold.halted.at}: ${fold.halted.reason}`);
}
for (const l of fold.ladder) {
  console.log(`  L${l.level} ${l.population} — ${l.records.length} records → ${l.kinds.length} kind(s)`);
  for (const k of l.kinds) console.log(`      ${k.label}: ${k.members.length} members, ${k.height}`);
}

console.log("\n" + "═".repeat(70));
console.log("strongest relations believed at the end (referent ids):");
for (const e of strongestEdges(graph, 8)) console.log(`  ${e.weight.toFixed(2)}  ${e.edge}`);

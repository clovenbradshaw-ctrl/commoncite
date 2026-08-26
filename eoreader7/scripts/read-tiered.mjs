// eoreader6 · read-tiered — reading where SIGNIFICANCE IS ALTITUDE.
//
// Nothing here scores a passage. A passage's significance is how far up the
// fold it reached, and it reaches an altitude only by having surprised every
// tier beneath it. Atmosphere, lens and paradigm are priors that surprise
// built; their shift is what surprise means up there.
//
// The prior at the bottom is a GRAPH — who does what to whom — not a word
// histogram. A reader's belief is relational.

import { readFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { extractRelations, discoverRelationVocab } from "../packages/engine/perceiver/text/relations.js";
import { createGraph, readTriples, strongestEdges, edgeKey } from "../packages/engine/emergence/graph.js";
import { createTierStack, foldThrough, massIsConsistent, gammaFor } from "../packages/engine/emergence/tiers.js";
import { extractSurfaces, discoverReferents, diaNorm } from "../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../packages/engine/perceiver/text/material.js";
import { projectReferents } from "../packages/engine/referents/index.js";
import { resolveAllNarratorSpans, narratorAt, isFirstPerson } from "../packages/engine/perceiver/text/narrator.js";

const SENTENCES_PER_FRAME = 6;

// THE ALTITUDES ARE NAMES, NOT NUMBERS. There is no per-tier gamma and no
// per-tier quantile — this script used to pick six of them by hand. Every
// tier is built to one spec, and the ladder comes from the fold: a tier only
// observes when the tier beneath it was surprised, so altitude is earned by
// surviving, never configured. See emergence/tiers.js.
const TIER_NAMES = ["atmosphere", "lens", "paradigm"];

// SEED.md's three declared numbers, declared once for the whole stack.
// Everything else the tiers use is derived from these (gamma = 1 - 1/window).
const WINDOW = 12;      // the reach of the present
const DRAWS = 200;      // the resolution of testimony — finest rank sayable is 1/draws
const TIER_SEED = 20260803; // the received stream; the engine holds no randomness

const TEXT_PATH = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const COREF_PATH = process.argv[3] || "scripts/adversarial/fixtures/pg84-frankenstein.coref.json";
const { text } = stripContainer(readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));

const sentences = splitSentences(text);
const frames = [];
for (let i = 0; i < sentences.length; i += SENTENCES_PER_FRAME) {
  const g = sentences.slice(i, i + SENTENCES_PER_FRAME);
  if (g.length) frames.push({ order: frames.length, offset: g[0].offset, text: g.map((s) => s.text).join(" ") });
}

// ── the cast, discovered blind ──────────────────────────────────────────────
// A triple is kept only when BOTH ends resolve to a referent. Ungated, the
// extractor emits "as he | said | this" and "waves and | lost | in darkness"
// — the regex takes whatever 1-2 words precede a verb, so the graph fills
// with fragments and the belief structure is noise. eoreader5 gates on its
// resolved cast for exactly this reason, and that gate is what makes SVO
// "stronger evidence than any keyword" rather than weaker.
const table = buildFrequencyTable(tokenize(text));
const functionWords = functionWordSet(table);
const surfaces = extractSurfaces(sentences, { functionWords });
const referentEvents = discoverReferents(surfaces).events;
const cast = projectReferents(referentEvents).filter((r) => !r.mergedInto);

// The relation vocabulary, measured from this text's own surfaces and
// closed class — never a hand-listed English verb set. minSurfaces=1: this
// pipeline's referent-resolution already discards nearly everything the raw
// SVO parse finds, so recall matters more than a stricter recurrence bar
// here (see the matching comment in read-people.mjs). See
// relations.js::discoverRelationVocab.
const { verbs, candidates } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 });

// surface -> referent id, longest surface first so "Victor Frankenstein"
// wins over "Victor" when both could match
// Surfaces must be at least 2 characters and must match on WORD BOUNDARIES.
// Substring matching on a 1-char surface is catastrophic: "M." (Monsieur
// Krempe, Monsieur Waldman) yields the surface "m", and `phrase.includes("m")`
// then matches any phrase containing the letter — `ref:auto:m` appeared in 6
// of the 8 strongest relations before this.
const surfaceToId = [];
for (const r of cast) for (const s of r.surfaces) {
  const n = diaNorm(s);
  if (n.length < 2) continue;
  surfaceToId.push([n, new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u"), r.id]);
}
surfaceToId.sort((a, b) => b[0].length - a[0].length);

// First-person surfaces resolve by SCOPE, never by string. Frankenstein is a
// frame narrative (Walton > Victor > Creature); every "I" inside the
// creature's tale is the creature, and the same three letters elsewhere are
// someone else. Without this, referent-gated SVO kept 4 of 570 triples,
// because in first-person narrative nearly every subject is a pronoun.
const coref = JSON.parse(readFileSync(COREF_PATH, "utf8"));
const { resolved: narratorSpans, unresolved: narratorGaps } = resolveAllNarratorSpans(text, coref.referents);

let firstPersonBound = 0, firstPersonGapped = 0;

const resolve = (phrase, offset) => {
  const p = diaNorm(phrase);
  if (isFirstPerson(p)) {
    const n = narratorAt(offset, narratorSpans);
    if (n.referentId) { firstPersonBound++; return n.referentId; }
    firstPersonGapped++;
    return null; // a typed absence: some narrator, and the prior does not say which
  }
  for (const [, re, id] of surfaceToId) if (re.test(p)) return id;
  return null;
};

// The graph forgets at the same reach as everything else here: a relation not
// restated within the present fades. Derived from WINDOW by the same identity
// the tiers use (1 - 1/window), so this script declares no forgetting rate of
// its own either.
const PRUNE_BELOW = 1e-4; // the floor below which a decayed relation is forgotten outright, not carried as noise
const graph = createGraph({ gamma: gammaFor(WINDOW), pruneBelow: PRUNE_BELOW });
const tiers = createTierStack(TIER_NAMES, { window: WINDOW, draws: DRAWS, seed: TIER_SEED });
const reached = [];
// Why each tier answered as it did. "shifted 0" is a different finding when
// the gate refused a zero-width felt history than when it placed movements
// and none cleared the bar — the organ distinguishes them, so the report must.
const outcomes = new Map();
let totalTriples = 0;
let statedTotal = 0;

for (const f of frames) {
  const raw = extractRelations(f.text, { verbs, functionWords });
  statedTotal += raw.length;
  const triples = raw
    .map((t) => ({ ...t, subject: resolve(t.subject, f.offset), object: resolve(t.object, f.offset), said: t }))
    .filter((t) => t.subject && t.object && t.subject !== t.object);
  totalTriples += triples.length;
  if (!triples.length) continue;

  const g = readTriples(graph, triples);

  // ── what rises: the frame's contribution to BELIEF, nodes and edges ───────
  //
  // This used to be edge keys alone, and that made the Interpretation column
  // unreadable rather than quiet. MEASURED on War and Peace: edges-only gives
  // a mean arrival mass of 1.11 — 483 of 532 arrivals are a SINGLE edge — with
  // 578 distinct edge keys over 589 total mass, so 98% of arrivals are 100%
  // novel. A tier prior cannot accumulate anything from that, and no
  // per-observation null can have width over it: 241 of 532 observations came
  // back `degenerate_ground` and nothing ever reached the lens.
  //
  // graph.js already says what a belief is made of — "nodes = Entity, edges =
  // Link, whole = Network" — and a frame asserts both: these beings were
  // present, AND this relation held between them. Carrying only the Link half
  // upward threw away the half that recurs. Nodes recur (264 referents across
  // 589 triples); a specific subject|verb|object edge essentially never does.
  //
  // Measured over the same 532 observations, same tier spec:
  //   edges only          mass 1.11  novel 0.981  ->  532 /  4 /  0   (dead)
  //   nodes + edges       mass 3.32  novel 0.480  ->  532 / 24 /  7   (reaches paradigm)
  //   nodes + edges+verbs mass 4.43  novel 0.491  ->  532 / 27 /  7   (paradigm degenerate)
  //
  // Namespaced so a referent id can never collide with an edge key.
  const arrival = new Map();
  const bump = (k) => arrival.set(k, (arrival.get(k) ?? 0) + 1);
  for (const t of triples) {
    bump(`node:${t.subject}`);
    bump(`node:${t.object}`);
    bump(`edge:${edgeKey(t)}`);
  }

  const fold = foldThrough(tiers, arrival);
  for (const r of fold.results) {
    // Censored ABOVE is a shift (surfeit); censored BELOW is regularity and
    // is not. Labelled apart so the tally sums to `shifted` without a reader
    // having to know which censoring counts.
    const why = r.gap ? r.gap.gap
      : r.censored === "above" ? "shift:surfeit"
      : r.censored ? `censored:${r.censored}`
      : r.passed ? "shift:rank"
      : "placed";
    const tally = outcomes.get(r.tier) ?? new Map();
    tally.set(why, (tally.get(why) ?? 0) + 1);
    outcomes.set(r.tier, tally);
  }
  reached.push({ ...f, triples, graphBelief: g.belief, fold });
}

for (const t of tiers) {
  if (!massIsConsistent(t)) throw new Error(`tier ${t.name}: prior mass diverged from its total`);
}

console.log(`READING ${TEXT_PATH.split("/").pop()} — ${frames.length} frames`);
console.log(`relation vocabulary: ${verbs.size} verbs measured from the text (${candidates.length} candidates seen, minSurfaces 1) — never a hand-listed set`);
console.log(`SVO: ${statedTotal} stated, ${totalTriples} kept (both ends resolve to a referent)`);
console.log(`cast discovered blind: ${cast.length} referents`);
console.log(`narrator spans: ${narratorSpans.length} resolved, ${narratorGaps.length} unresolved`);
console.log(`first-person: ${firstPersonBound} bound by scope, ${firstPersonGapped} typed gaps`);
console.log(`graph: ${graph.nodes.size} nodes, ${graph.edges.size} live relations\n`);
for (const t of tiers) {
  const tally = outcomes.get(t.name);
  const why = tally ? [...tally.entries()].map(([k, n]) => `${k} ${n}`).join(", ") : "never observed";
  console.log(`  ${t.name.padEnd(11)} observed ${String(t.observations).padStart(4)}, shifted ${String(t.shifts).padStart(3)}   (${why})`);
}
for (const t of tiers) {
  for (const s of t.shiftRecords) {
    const place = s.censored ? `censored ${s.censored}` : `rank ${s.rank.toFixed(3)}`;
    console.log(`    SHIFT ${t.name} at observation ${s.at} — ${place}, moved ${s.surprise.toFixed(4)} against ${s.ground.draws} drawn continuations${s.reZero ? " [re-zero]" : ""}`);
  }
}

const byAltitude = (n) => reached.filter((r) => r.fold.reached >= n && r.fold.results[n - 1]?.passed);

for (let level = TIER_NAMES.length; level >= 1; level--) {
  const hits = byAltitude(level);
  const name = TIER_NAMES[level - 1].toUpperCase();
  console.log(`\n${"═".repeat(70)}\n${name} — reached by ${hits.length} passages\n${"═".repeat(70)}`);
  for (const h of hits.slice(0, level === 3 ? 12 : 6)) {
    const pct = ((h.offset / text.length) * 100).toFixed(1);
    const rel = h.triples.slice(0, 2).map((t) => `${t.subject.replace("ref:auto:","")} ${t.polarity === "-" ? "NOT " : ""}${t.verb} ${t.object.replace("ref:auto:","")}`).join(" · ");
    console.log(`\n── ${pct}%   ${rel}`);
    console.log(`   ${h.text.replace(/\n/g, " ").slice(0, 220)}…`);
  }
}

console.log(`\n${"═".repeat(70)}\nstrongest relations believed at the end:`);
for (const e of strongestEdges(graph, 8)) console.log(`  ${e.weight.toFixed(2)}  ${e.edge}`);

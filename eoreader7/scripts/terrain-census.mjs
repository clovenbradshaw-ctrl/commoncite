// eoreader6 · terrain-census — Assembly A of "11 — Terrain occupancy and the
// two ascents": per source, run the existing ladder end to end and report,
// per terrain, the count of admitted instances normalized per thousand
// sentences — the one unit the perceiver emits identically across every
// source (splitSentences). Nothing new is computed here; every count below
// is read off an organ that already runs elsewhere in this repo (mirroring
// score-cast-entities.mjs, read-ladder.mjs's causal policy, and
// read-people.mjs). The only new code is the report.
//
// Nine rows: Void, Entity, Kind (Existence) / Field, Link, Network
// (Structure) / Atmosphere, Lens, Paradigm (Interpretation) — the grid
// CUBE.md and operators.js declare, domain-major grain-minor.
//
// PARADIGM IS A TYPED GAP, ALWAYS. emergence/paradigm.js's own header says
// it does not consume raw text; the one script that wires people.js's
// EVA·Pattern branch (read-people.mjs) only takes it when a KindVocabulary
// prior file is supplied, and none ships in this repo by default. Building
// that wiring fresh would be new integration, which spec 11 §3 explicitly
// says this assembly must not do ("nothing new is computed — this is a
// report over organs that already run").
//
// TWO OF THE FOUR DECLARED SOURCE SLOTS ARE TYPED GAPS TOO, for a different
// reason: this session's network egress is restricted — confirmed against
// nashville.gov, courtlistener.com, congress.gov, and gutenberg.org, all of
// which reject the CONNECT at the proxy level (policy denial, not a
// site-side block) — so no real narrative-high-SVO (War and Peace) or
// adversarial-civic (a real deposition/transcript) fixture could be
// obtained this session. Synthetic fixtures exist in
// scripts/adversarial/fixtures/ (challenge-25-source-c-court-record.txt,
// legal-boilerplate.txt) but are hand-authored fiction, and the census's
// own premise — "a terrain whose occupancy tracks genre rather than content
// has located a mouth, not a terrain" — requires real material. Recorded as
// a gap, not filled with fiction standing in for it.

import { readFileSync } from "node:fs";
import { stripContainer, splitSentences } from "../packages/engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet, chunkWords, causalSurprisalSeries } from "../packages/engine/perceiver/text/material.js";
import { extractSurfaces, discoverReferents, diaNorm } from "../packages/engine/perceiver/text/surfaces.js";
import { projectReferents } from "../packages/engine/referents/index.js";
import { discoverRelationVocab, extractRelations } from "../packages/engine/perceiver/text/relations.js";
import { createGraph, readTriples, edgeKey } from "../packages/engine/emergence/graph.js";
import { createTierStack, foldThrough, gammaFor } from "../packages/engine/emergence/tiers.js";
import { deriveBeingRecords, understand } from "../packages/engine/emergence/jati.js";
import { createRegimeTracker } from "../packages/engine/loops/atmosphere.js";
import { openReading, arrive, witnessArrival, offerCandidates, carryEntities } from "../packages/engine/referents/entity.js";
import { createSession, admitChunked } from "../packages/host/corpus.js";

// ── declared, never defaulted (I2) — one spec per organ, reused verbatim
// from the scripts that already establish it as this repo's own operating
// point, not picked to fit this script ──────────────────────────────────────
const FIELD = {}; // splitSentences takes no required declared number
const LADDER = { sentencesPerFrame: 6, window: 12, draws: 200, seed: 20260803, minSurfaces: 1, tripleTokenCap: 16, pruneBelow: 1e-4, tierNames: ["atmosphere", "lens", "paradigm"] }; // read-ladder.mjs
const KIND = { minPrevalence: 0.25, minKindSize: 3, permutations: 200, quantile: 0.95, seed: 42, reseeds: 24, readerVersion: "eo-2026-07" }; // read-people.mjs OPTS
const ENTITY_SPEC = { window: 16, draws: 128, reseeds: 32, minArrivals: 5, targetTokensPerUnit: 400 }; // score-cast-entities.mjs SPEC
const ATMOSPHERE = { window: 12, draws: 200, tolerance: 3, reseeds: 5, seed: 17, statistic: "burstiness", findOn: ["regularity"], chunk: 100 }; // two-clearings.mjs SPEC

const gap = (reason) => ({ admitted: null, per1000: null, gap: reason });

// ── Void — host-layer admission (packages/host/corpus.js) ──────────────────
function censusVoid(text, sourceId) {
  const session = createSession();
  const { chunks } = admitChunked(session, { text, sourceId });
  return { admitted: chunks, note: `${chunks} chunk(s) admitted (MIN_CHUNK_CHARS floor)` };
}

// ── Field — sentence segmentation (perceiver/text/spans.js) ────────────────
function censusField(text) {
  const sentences = splitSentences(text);
  return { sentences, admitted: sentences.length, note: "sentence boundaries found" };
}

// ── Entity — referents/entity.js, the witness-gated register (Existence·Figure) ─
function censusEntity(text) {
  const WORD_RE = /[\p{L}\p{M}]+/gu;
  const words = (text.match(WORD_RE) ?? []).map((w) => w.toLowerCase());
  const units = [];
  for (let i = 0; i < words.length; i += ENTITY_SPEC.targetTokensPerUnit) units.push(words.slice(i, i + ENTITY_SPEC.targetTokensPerUnit));
  const state = openReading({ window: ENTITY_SPEC.window, draws: ENTITY_SPEC.draws, reseeds: ENTITY_SPEC.reseeds, minArrivals: ENTITY_SPEC.minArrivals });
  for (const unit of units) {
    arrive(state, unit);
    for (const surface of new Set(unit)) witnessArrival(state, surface);
  }
  offerCandidates(state);
  const register = carryEntities(state);
  return { admitted: register.length, note: `${units.length} unit(s) of ~${ENTITY_SPEC.targetTokensPerUnit} tokens, ${state.arrivals.size} candidate surfaces offered` };
}

// ── the causal ladder shared by Link / Network / Lens / Kind ───────────────
// Reproduces read-ladder.mjs's policy B (the causal reader) and
// read-people.mjs's graph→people.understand chain, WITHOUT the narrator/
// first-person scope resolution both scripts key off an eoPriors coref file
// this repo does not ship (`/…/eoPriors/priors/coref/pg84-frankenstein.json`
// — a per-book hand-built prior, not something this census can supply for a
// new civic fixture without hand-authoring one, which spec 11 §1 forbids:
// "it does not port"). This is a genuine simplification, declared as such:
// first-person pronouns ("I", "my") never resolve here, so a first-person
// narrative's Link/Network/Lens counts are a floor, not the number
// read-ladder.mjs itself would report on the same text.
function ladder(text) {
  const sentences = splitSentences(text);
  const frames = [];
  for (let i = 0; i < sentences.length; i += LADDER.sentencesPerFrame) {
    const g = sentences.slice(i, i + LADDER.sentencesPerFrame);
    if (g.length) frames.push({ order: frames.length, offset: g[0].offset, text: g.map((s) => s.text).join(" ") });
  }

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

  const graph = createGraph({ gamma: gammaFor(LADDER.window), pruneBelow: LADDER.pruneBelow });
  const tiers = createTierStack(LADDER.tierNames, { window: LADDER.window, draws: LADDER.draws, seed: LADDER.seed });

  // policy B: the verb vocabulary is incremental, admitted only from frames
  // already read — same admission rule discoverRelationVocab always applies,
  // accumulated across frames rather than measured once over the whole text.
  const vocab = new Set();
  const seenFollowing = new Map();

  let statedTotal = 0;
  const clean = [];

  for (const f of frames) {
    const raw = extractRelations(f.text, { verbs: vocab, functionWords });
    statedTotal += raw.length;
    const frameClean = [];
    for (const r of raw) {
      const subjectId = resolve(r.subject);
      const objectId = resolve(r.object);
      if (subjectId && objectId && subjectId !== objectId) frameClean.push({ subject: subjectId, verb: r.verb, object: objectId, polarity: r.polarity, frame: f.order });
    }
    if (frameClean.length) { clean.push(...frameClean); readTriples(graph, frameClean); }

    if (raw.length) {
      const arrival = new Map();
      const bump = (k) => arrival.set(k, (arrival.get(k) ?? 0) + 1);
      for (const r of raw) {
        const subjectId = resolve(r.subject);
        const objectId = resolve(r.object);
        if (subjectId) bump(`node:${subjectId}`);
        if (objectId) bump(`node:${objectId}`);
        if (subjectId && objectId) bump(`edge:${edgeKey({ subjectId, objectId, verb: r.verb })}`);
      }
      if (arrival.size) foldThrough(tiers, arrival);
    }

    // admit next frame's vocabulary from what THIS frame just showed —
    // strictly after extraction, so frame t never reads its own new verbs.
    const frameVocab = discoverRelationVocab(f.text, { surfaces, functionWords, minSurfaces: LADDER.minSurfaces });
    for (const c of frameVocab.candidates) {
      let set = seenFollowing.get(c.verb);
      if (!set) seenFollowing.set(c.verb, (set = new Set()));
      for (const form of c.surfaceForms) set.add(form);
      if (set.size >= LADDER.minSurfaces) vocab.add(c.verb);
    }
  }

  const lensShifts = tiers.reduce((s, t) => s + t.shifts, 0);
  return { frames, cast, statedTotal, clean, graph, tiers, lensShifts };
}

function censusLink(pass, frameCount) {
  return {
    admitted: pass.clean.length,
    note: `${pass.statedTotal} SVO triples stated (causal vocab), ${pass.clean.length} kept with both ends resolved to the blind-discovered cast — this is the F1 metric (EMBEDDING-FINDINGS.md's "stated triples kept")`,
  };
}

function censusNetwork(pass) {
  return { admitted: pass.graph.edges.size, note: `${pass.graph.nodes.size} nodes, ${pass.graph.tick} observations folded` };
}

function censusLens(pass) {
  return {
    admitted: pass.lensShifts,
    note: pass.tiers.map((t) => `${t.name}:${t.shifts}/${t.observations}`).join(" "),
  };
}

function censusKind(pass, population) {
  if (pass.graph.edges.size === 0) return gap("empty_material: no live graph edges to derive being-records from");
  const records = deriveBeingRecords(pass.graph, { population });
  if (records.length < KIND.minKindSize) return gap(`empty_material: ${records.length} being-record(s) derived, short of minKindSize (${KIND.minKindSize})`);
  const u = understand(records, { priors: [], population, readerVersion: KIND.readerVersion, minPrevalence: KIND.minPrevalence, minKindSize: KIND.minKindSize, permutations: KIND.permutations, quantile: KIND.quantile, seed: KIND.seed, reseeds: KIND.reseeds });
  if (u.understanding === "prior") return { admitted: u.prior_kind ? 1 : 0, note: `covered by prior ${u.giver}` };
  return { admitted: u.kinds.length, note: `${u.kinds.length} kind(s) induced from ${records.length} being-record(s), ${u.kinds.reduce((s, k) => s + k.members.length, 0)} total memberships` };
}

// ── Atmosphere — loops/atmosphere.js, the streaming regime tracker ─────────
function censusAtmosphere(text) {
  const words = tokenize(text);
  if (words.length < ATMOSPHERE.chunk) return gap(`empty_material: ${words.length} words short of one ${ATMOSPHERE.chunk}-word chunk`);
  const chunks = chunkWords(words, ATMOSPHERE.chunk);
  const series = causalSurprisalSeries(chunks, { gamma: gammaFor(ATMOSPHERE.window) });
  const tracker = createRegimeTracker({ window: ATMOSPHERE.window, draws: ATMOSPHERE.draws, tolerance: ATMOSPHERE.tolerance, reseeds: ATMOSPHERE.reseeds, seed: ATMOSPHERE.seed, statistic: ATMOSPHERE.statistic, findOn: ATMOSPHERE.findOn });
  for (const x of series) tracker.push(x);
  return { admitted: tracker.rezeroCount, note: `${series.length} chunks of ${ATMOSPHERE.chunk} words, rezeroCount over the whole read` };
}

// ── Paradigm — no wired end-to-end path from raw text; see file header ─────
function censusParadigm() {
  return gap("not_wired: emergence/paradigm.js does not consume raw text and no script wires people.js's EVA·Pattern branch without a KindVocabulary prior this repo does not ship — reported per spec 11 §3 rather than newly integrated");
}

// ── run one source, all nine terrains ───────────────────────────────────────
function census(slot, text, sourceId, title) {
  const label = slot; // used as the Kind population id — a slot name is a fine identifier
  const { text: body } = stripContainer(text);
  const field = censusField(body);
  const sentenceCount = field.sentences.length || null;
  const per1000 = (n) => (sentenceCount && Number.isFinite(n) ? (n / sentenceCount) * 1000 : null);

  const rows = {};
  rows.Void = censusVoid(body, sourceId);
  rows.Entity = censusEntity(body);
  rows.Field = { admitted: field.admitted, note: field.note };

  if (sentenceCount) {
    const pass = ladder(body);
    rows.Link = censusLink(pass, pass.frames.length);
    rows.Network = censusNetwork(pass);
    rows.Kind = censusKind(pass, label);
    rows.Lens = censusLens(pass);
  } else {
    rows.Link = rows.Network = rows.Kind = rows.Lens = gap("empty_material: no sentence units");
  }

  rows.Atmosphere = censusAtmosphere(body);
  rows.Paradigm = censusParadigm();

  for (const [terrain, r] of Object.entries(rows)) {
    if (r.gap) continue;
    r.per1000 = per1000(r.admitted);
  }
  return { slot, title, sentenceCount, rows };
}

// ── declared sources ─────────────────────────────────────────────────────
const ROOT = new URL("..", import.meta.url).pathname;
const SOURCES = [
  { slot: "narrative-low-SVO", label: "Frankenstein (pg84)", path: `${ROOT}scripts/adversarial/fixtures/pg84-frankenstein.txt` },
  { slot: "narrative-high-SVO", label: "War and Peace", path: null, gapReason: "not obtained this session: general web fetch is restricted (nashville.gov, courtlistener.com, congress.gov, and gutenberg.org all reject the CONNECT at the proxy level) and this text is not committed to the repo (navigation-index-war-and-peace.mjs takes it as an external CLI argument, not a fixture)" },
  { slot: "civic", label: "Nashville UHS Full Report (2025)", path: `${ROOT}scripts/adversarial/fixtures/nashville-uhs-full-report-2025.txt` },
  { slot: "civic (secondary)", label: "Nashville UHS Executive Summary (2025)", path: `${ROOT}scripts/adversarial/fixtures/nashville-uhs-executive-summary-2025.txt` },
  { slot: "adversarial-civic", label: "a real deposition/transcript excerpt", path: null, gapReason: "not obtained this session: general web fetch is restricted (see narrative-high-SVO). scripts/adversarial/fixtures/challenge-25-source-c-court-record.txt and legal-boilerplate.txt exist but are hand-authored fiction, not real material — the census's own premise requires real material, so fiction is not substituted" },
];

const TERRAINS = ["Void", "Entity", "Kind", "Field", "Link", "Network", "Atmosphere", "Lens", "Paradigm"];

const results = [];
for (const s of SOURCES) {
  if (!s.path) { results.push({ slot: s.slot, title: s.label, sentenceCount: null, rows: null, gapReason: s.gapReason }); continue; }
  const text = readFileSync(s.path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  console.error(`census: reading ${s.slot} (${s.label})…`);
  results.push(census(s.slot, text, `source:${s.path}`, s.label));
}

// ── report ───────────────────────────────────────────────────────────────
console.log(`TERRAIN CENSUS — ${results.length} declared source(s), ${TERRAINS.length} terrains\n`);

for (const r of results) {
  console.log(`${"═".repeat(72)}\n${r.slot}  —  ${r.title}\n${"═".repeat(72)}`);
  if (!r.rows) { console.log(`  GAP: ${r.gapReason}\n`); continue; }
  console.log(`  ${r.sentenceCount} sentences (the normalizing unit)`);
  for (const t of TERRAINS) {
    const row = r.rows[t];
    if (row.gap) console.log(`  ${t.padEnd(11)} GAP: ${row.gap}`);
    else console.log(`  ${t.padEnd(11)} admitted=${String(row.admitted).padStart(5)}  per-1000-sentences=${row.per1000.toFixed(2).padStart(8)}   ${row.note ?? ""}`);
  }
  console.log("");
}

console.log(`${"═".repeat(72)}\nSUMMARY TABLE (admitted per 1000 sentences; GAP where the count is zero or unavailable)\n${"═".repeat(72)}`);
const COL = 20;
const header = ["terrain".padEnd(12), ...results.map((r) => r.slot.slice(0, COL - 1).padEnd(COL))];
console.log(header.join(""));
for (const t of TERRAINS) {
  const cells = results.map((r) => {
    if (!r.rows) return "GAP(no source)";
    const row = r.rows[t];
    return row.gap ? `GAP` : row.per1000.toFixed(1);
  });
  console.log([t.padEnd(12), ...cells.map((c) => String(c).padEnd(COL))].join(""));
}

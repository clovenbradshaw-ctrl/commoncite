// eoreader6 · scripts/experiments/eot-stream — EXPERIMENTAL, unwired.
//
// "EOT": the Decal Notation proposed in KERNEL_REBUILD_CHECKPOINT.md
// (canonical tuples turn/subject/operator/decal/object, "a richer RDF") has
// no implementation anywhere in this repo — it is a kernel-rewrite design
// note, not a running mechanism. This script does NOT implement that
// notation. It builds what was actually asked for once the cube-as-content-
// classifier framing was explicitly rejected: a live, append-only,
// revisable stream of the reader's own beliefs, recorded as assertions —
// "record each line as an assertion of the reader" — using only mechanisms
// already proven this session. Two real, distinct grains, composed:
//
//   PER-POPULATION  does this whole verb island already have a kind, or
//                   does the material have to teach a new one?
//                   -> emergence/people.js::understand() / inventKind(),
//                      unmodified. Checked against a REAL KindVocabulary@1
//                      built from role-fold-verb-island/tp-chunk's own
//                      already height=above-certified output — the first
//                      real KindVocabulary@1 object and the first real
//                      understand() caller with real data in this codebase
//                      (its only two prior call sites pass an empty or
//                      ephemeral priors array and persist nothing).
//   PER-INSTANCE    does THIS occurrence, right now, bind to a kind already
//                   evidenced in the reading? -> resolveSpanRole (copied
//                   unmodified from span-role-reader.mjs), unchanged.
//
// Both branches of understand()'s decision are genuinely exercised, not
// staged: verb islands are freshly discovered from the TARGET document
// being read (discoverRelationVocab, same as every prior script in this
// arc), not just replayed from the two saved registry files — some will
// match the prior (verbs the original registry was built from), some
// won't (this document's own most-frequent verbs, if different), and
// understand() answers each on its own evidence.
//
// NOT reusing frame/index.js::note() for the ledger itself: note()'s
// admissible(act.ground) requires a numeric `samples` array (length >= 2)
// and every act after the first must be COMMENSURATE with the first act's
// statistical shape (same perturbation/statistic/draws/window/extent) —
// built for perturbation-null sequences, not a heterogeneous per-instance
// belief stream. Forcing role-bindings through it would mean fabricating
// fake `samples` just to clear the gate: the exact class of mistake
// eo-constitution Article II.17 (this session's own amendment) is about —
// a reused mechanism silently importing an axis requirement its new
// consumer was never built to satisfy. So: a small, new, purpose-built
// ledger below, matching note()'s PRINCIPLE (frozen entries, append-only,
// nothing mutated) without its numeric contract.
//
// SPAN IDENTITY IS POSITION-ADDRESSED, NOT CONTENT-ADDRESSED. A span's
// hashId is built from (sourceId, sentenceOrder, charStart, charEnd) via
// the real, existing canonicalHashSync (packages/spec/canonical-json) —
// never from the literal text. A content hash (packages/host/corpus.js's
// own span_id) changes the instant the text is corrected (an OCR mistake
// fixed, a transcription revised), which would silently orphan every
// belief that pointed at the old hash. Position survives the correction;
// the ASSERTED TEXT at that position is itself just another append-only,
// revisable ledger entry, the same shape as a belief. This is also a step
// toward eo-constitution's omnimodal earning test (II.11: "text's stable
// spans are a false permanency," II.1) — position-in-a-source is the one
// identity concept text, audio, video, and image share; literal surface
// content is not. Disclosed precisely: this is a DESIGN choice, not a
// measured pass of II.11 — no cross-modality invariance fixture is built
// here, only a shape that does not foreclose one.
//
// Offsets are tracked THROUGH the pipeline, not reconstructed afterward by
// re-searching a truncated preview string for the bound word — a
// reconstruction like that would silently pick the wrong occurrence on any
// sentence where the word/span repeats, or fail outright past the preview
// cutoff. A parallel, offset-preserving tokenization (matching
// activation.js's own WORD_RE exactly, duplicated here ONLY because
// tokens() itself discards offsets) is built once per sentence and carried
// alongside the real, unmodified tokens()/codeOf()/recall()/encodeFrame()
// calls — the activation mechanism itself never sees or needs offsets.
//
// Usage: node scripts/experiments/eot-stream.mjs [pocket-dir[,dir2,...]] [docLimit]

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalHashSync } from "../../packages/spec/index.js";
import { splitSentences, deriveAbbreviations } from "../../packages/engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../../packages/engine/perceiver/text/material.js";
import { extractSurfaces } from "../../packages/engine/perceiver/text/surfaces.js";
import { discoverRelationVocab } from "../../packages/engine/perceiver/text/relations.js";
import { codeOf, recall, encodeFrame, tokens } from "../../packages/engine/emergence/activation.js";
import { understand } from "../../packages/engine/emergence/jati.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const POCKET_DIR = process.argv[2] || join(HERE, "..", "..", "..", "live_priors", "06-government-legal", "world-legislation", "us");
// Defaults chosen from measurement, not guessed: at 3 docs / 6 verbs, every
// discovered "verb" (mostly noise — 'or', 'on', an apostrophe artifact) had
// too little material to even ask understand() a real question, so BOTH its
// branches (prior/invented) went untested — the whole point of building
// this. 20 docs / 12 verbs is the smallest tried that actually exercises
// both: verb-island:are and verb-island:under matched the certified prior,
// several others (is, to, law, region...) triggered fresh induction.
const LIMIT = process.argv[3] ? Number(process.argv[3]) : 20;
const TOP_N_VERBS = process.argv[4] ? Number(process.argv[4]) : 12;
const MIN_ACTIVATION = Number(process.env.MIN_ACTIVATION ?? 0.05);
const MIN_MARGIN = Number(process.env.MIN_MARGIN ?? 0.2);
const READER_VERSION = "eot-stream-v1";

// Same regex activation.js's tokens() uses internally, duplicated ONLY to
// keep character offsets alongside each token — tokens() itself returns
// bare lowercase strings with no position information.
const WORD_RE_OFFSETS = /[\p{L}\p{N}']+/gu;
const offsetTokens = (text) => [...text.matchAll(WORD_RE_OFFSETS)].map((m) => ({ text: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length }));

// ── span identity: position-addressed, never content-addressed ─────────────
const spanId = ({ sourceId, sentenceOrder, charStart, charEnd }) => canonicalHashSync({ sourceId, sentenceOrder, charStart, charEnd });

// ── (1) the append-only ledger ───────────────────────────────────────────
// Three entry shapes, one array. Nothing is ever spliced, popped, or
// mutated. "Current" state for a spanId/population is always "the latest
// entry with that key" — a caller wanting history walks the whole ledger,
// same discipline frame/index.js's own readers use ("walked, never summed").
const ledger = [];
const appendEntry = (entry) => {
  const frozen = Object.freeze({ index: ledger.length, supersedes: null, ...entry });
  ledger.push(frozen);
  return frozen;
};
const latestSpanText = (id) => {
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i];
    if (e.type === "span" && e.spanId === id) return e.text;
  }
  return null;
};

// ── self-check: does revision actually work, on a synthetic case? ─────────
// Not staged into the real document run below (nothing in this pocket has
// a known OCR error to correct) — a small, hand-built fixture, same
// discipline as span-role-reader.mjs's multi-word self-check: prove the
// mechanism before trusting anything built on it.
{
  const id = spanId({ sourceId: "self-check", sentenceOrder: 0, charStart: 0, charEnd: 17 });
  const original = appendEntry({ type: "span", spanId: id, text: "Housing Divisicn" }); // synthetic OCR mistake
  const corrected = appendEntry({ type: "span", spanId: id, text: "Housing Division", supersedes: original.index });
  const ok = latestSpanText(id) === "Housing Division" && ledger[original.index].text === "Housing Divisicn";
  console.log(`self-check: OCR-style correction on the SAME spanId -> ${ok ? "original entry kept untouched, latest lookup returns the correction (revision confirmed)" : "REGRESSION — revision did not work as designed"}\n`);
}

// ── (2) the resolution registry + a real KindVocabulary@1 ─────────────────
// Confirmed by direct inspection: no KindVocabulary@1 object exists
// anywhere in this repo today. Built here, honestly, from data already
// earned this session — not invented, not an external tagset (no ML, per
// direct instruction): every population/kind pair traces to
// role-fold-verb-island.mjs / role-fold-tp-chunk.mjs's own height=above
// output, reused directly.
const REGISTRY_SOURCES = [
  { path: join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-verb-island.experiment.json"), prefix: "verb-island" },
  { path: join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-tp-chunk.experiment.json"), prefix: "tp-verb-island" },
];

const kindVocabularyKinds = [];
const wordKindVotes = new Map();
let noDirectionMembers = 0;

for (const { path, prefix } of REGISTRY_SOURCES) {
  const island = JSON.parse(readFileSync(path, "utf8"));
  for (const r of island.results ?? []) {
    const recs = new Map((r.records ?? []).map((rec) => [rec.id, rec]));
    const population = `${prefix}:${r.verb}`;
    for (const k of r.kinds ?? []) {
      if (k.height !== "above") continue;
      kindVocabularyKinds.push({ population, label: k.label, memberCount: k.members.length });
      for (const m of k.members) {
        const rec = recs.get(m);
        const label = (rec?.label ?? m).toLowerCase();
        let before = 0, after = 0;
        for (const a of rec?.attributes ?? []) {
          if (a.field_id.includes("before")) before += a.count;
          else if (a.field_id.includes("after")) after += a.count;
        }
        if (before === after) { noDirectionMembers++; continue; }
        if (!wordKindVotes.has(label)) wordKindVotes.set(label, { actor: 0, complement: 0 });
        const v = wordKindVotes.get(label);
        if (before > after) v.actor++; else v.complement++;
      }
    }
  }
}

const kindMarker = new Map();
const ambiguousWords = new Set();
for (const [word, v] of wordKindVotes) {
  if (v.actor > 0 && v.complement > 0) ambiguousWords.add(word);
  else if (v.actor > 0) kindMarker.set(word, "actor");
  else if (v.complement > 0) kindMarker.set(word, "complement");
}
const MAX_SPAN_TOKENS = Math.max(1, ...[...kindMarker.keys(), ...ambiguousWords].map((w) => w.split(" ").length));

const knownPopulations = new Set(kindVocabularyKinds.map((k) => k.population));
const theKindVocabulary = Object.freeze({
  schema: "KindVocabulary@1",
  giver: "role-fold-verb-island.mjs + role-fold-tp-chunk.mjs, height=above certified kinds only",
  reader_version: READER_VERSION,
  kinds: kindVocabularyKinds,
});
console.log(`KindVocabulary@1 built: ${kindVocabularyKinds.length} (population, kind) pairs across ${knownPopulations.size} populations, giver="${theKindVocabulary.giver}"`);
console.log(`resolution registry: ${kindMarker.size} unambiguous markers, ${ambiguousWords.size} ambiguous targets, ${noDirectionMembers} no-direction members\n`);

// ── (3) resolveSpanRole — the causal collapse, unmodified; offsets carried alongside ──
export const resolveSpanRole = (sentences, { minActivation, minMargin, idfFloor, minLen, completion = 0.5, topEdges = 6, edgeSlots = 24 } = {}) => {
  if (!Number.isFinite(minActivation) || minActivation < 0) throw new TypeError("resolveSpanRole: minActivation is declared");
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 1) throw new TypeError("resolveSpanRole: minMargin is declared");

  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 };
  const kindsByFrame = new Map();
  const bindings = [];
  const gaps = [];

  for (const sentence of sentences) {
    const ws = tokens(sentence.text); // unmodified — the real mechanism's own input
    const { trace, cue } = codeOf(ws, state, { minLen, idfFloor });

    const otoks = offsetTokens(sentence.text); // parallel, offset-preserving, position-tracking only
    // spansInSentence maps a candidate span string to its FIRST occurrence's
    // char range in this sentence — good enough to distinguish real
    // positions across sentences/documents; a second occurrence of the same
    // exact span in one sentence is the one remaining known imprecision,
    // disclosed rather than silently assumed away.
    const spansInSentence = new Map();
    for (let i = 0; i < otoks.length; i++) {
      for (let len = 1; len <= MAX_SPAN_TOKENS && i + len <= otoks.length; len++) {
        const slice = otoks.slice(i, i + len);
        const key = slice.map((t) => t.text).join(" ");
        if (!spansInSentence.has(key)) spansInSentence.set(key, { start: slice[0].start, end: slice[slice.length - 1].end });
      }
    }

    const present = new Set();
    for (const [w] of spansInSentence) {
      const k = kindMarker.get(w);
      if (k) present.add(k);
    }
    kindsByFrame.set(sentence.order, present);

    const hits = [...spansInSentence.keys()].filter((w) => ambiguousWords.has(w));
    if (hits.length === 0) { encodeFrame(state, sentence.order, ws, trace, { edgeSlots }); continue; }

    const activation = recall(cue, state, { completion, topEdges, selfOrder: sentence.order });
    const kindScore = new Map();
    for (const [order, amt] of activation) {
      const kinds = kindsByFrame.get(order);
      if (!kinds) continue;
      for (const k of kinds) if (amt > (kindScore.get(k) ?? -Infinity)) kindScore.set(k, amt);
    }

    for (const word of hits) {
      const { start, end } = spansInSentence.get(word);
      const candidates = [...kindScore.entries()].sort((a, b) => b[1] - a[1]);
      if (candidates.length === 0) {
        gaps.push({ reason: "span_no_candidate", sentenceOrder: sentence.order, word, charStart: sentence.offset + start, charEnd: sentence.offset + end });
        continue;
      }
      const [topKind, topScore] = candidates[0];
      if (topScore < minActivation) { gaps.push({ reason: "span_below_floor", sentenceOrder: sentence.order, word, charStart: sentence.offset + start, charEnd: sentence.offset + end, top: topKind, activation: topScore }); continue; }
      const second = candidates[1]?.[1] ?? 0;
      const margin = topScore > 0 ? (topScore - second) / topScore : 0;
      if (margin < minMargin) { gaps.push({ reason: "span_no_margin", sentenceOrder: sentence.order, word, charStart: sentence.offset + start, charEnd: sentence.offset + end, top: topKind, runnerUp: candidates[1]?.[0] ?? null, margin }); continue; }
      bindings.push({ kind: topKind, sentenceOrder: sentence.order, word, charStart: sentence.offset + start, charEnd: sentence.offset + end, activation: topScore, margin, sentence: sentence.text.slice(0, 160) });
      kindsByFrame.get(sentence.order).add(topKind);
    }
    encodeFrame(state, sentence.order, ws, trace, { edgeSlots });
  }
  return { bindings, gaps };
};

// ── (4) walk a real document: population beliefs, then instance beliefs ──
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(txt|md)$/.test(entry)) out.push(full);
  }
  return out;
};
const files = POCKET_DIR.split(",").flatMap((root) => walk(root)).slice(0, LIMIT);
console.log(`reading ${files.length} document(s) from ${POCKET_DIR}\n`);

// Real per-verb filler collection — the SAME pass role-fold-verb-island.mjs
// already runs (window=4, position buckets, preceding-function-word
// anchors), reused here so understand() gets genuine records rather than
// an empty array. Confirmed by running this once and reading the real
// exception: induceKinds' `records.length >= minKindSize` check is a hard
// TypeError (this codebase's "type error before null" contract — caller
// input, not a measurable outcome), not a soft gap — so a verb without
// enough qualifying fillers must be filtered out BEFORE calling
// understand(), never discovered by letting it throw.
const RECEIVED_FUNCTION_WORDS = new Set([
  "a", "an", "the", "all", "any", "each", "every", "no", "some", "both", "either", "neither", "other", "another", "such",
  "this", "that", "these", "those", "it", "its", "they", "them", "their", "he", "him", "his", "she", "her", "we", "us", "our", "you", "your", "i", "my",
  "and", "or", "but", "nor", "so", "yet", "if", "unless", "because", "although", "though", "while", "when", "whether", "as",
  "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "can", "could", "may", "might", "must", "shall", "should", "will", "would",
  "of", "to", "in", "on", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after",
  "above", "below", "from", "up", "down", "over", "under", "again", "further", "than", "upon", "within", "without", "per",
  "not", "only", "own", "same", "too", "very", "more", "most", "less", "least",
  "which", "who", "whom", "what",
]);
const looksLikeDebris = (tok) => /[\d/]/.test(tok) || tok.length <= 1;
const bucketOf = (offset) => `${Math.abs(offset) <= 2 ? "near" : "far"}_${offset < 0 ? "before" : "after"}`;
const A = (field_id, count) => ({ field_id, value_type: "boolean", count });

const collectVerbIslandRecords = (verb, sentences, verbSet, pocketFunctionWords) => {
  const fillers = new Map();
  for (const sent of sentences) {
    const raw = sent.text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? [];
    const lower = raw.map((t) => t.toLowerCase());
    for (let k = 0; k < raw.length; k++) {
      if (lower[k] !== verb) continue;
      for (let off = -4; off <= 4; off++) {
        if (off === 0) continue;
        const j = k + off;
        if (j < 0 || j >= raw.length) continue;
        if (verbSet.has(lower[j]) || pocketFunctionWords.has(lower[j]) || RECEIVED_FUNCTION_WORDS.has(lower[j]) || looksLikeDebris(raw[j])) continue;
        const bucket = bucketOf(off);
        const norm = lower[j];
        if (!fillers.has(norm)) fillers.set(norm, { surface: raw[j], buckets: new Map() });
        const f = fillers.get(norm);
        f.buckets.set(bucket, (f.buckets.get(bucket) ?? 0) + 1);
      }
    }
  }
  const records = [];
  for (const [norm, f] of fillers) {
    const total = [...f.buckets.values()].reduce((s, n) => s + n, 0);
    if (total < 3) continue;
    const attrs = [];
    for (const [bucket, n] of f.buckets) attrs.push(A(`pos:${bucket}`, n));
    if (/^\p{Lu}/u.test(f.surface.trim())) attrs.push(A("capitalized", 1));
    records.push({ id: `filler:${norm}`, label: f.surface, attributes: attrs });
  }
  return records;
};

const populationsChecked = new Set(); // ask understand() at most once per population across this whole run

for (const file of files) {
  const sourceId = file;
  const text = readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
  const sentences = splitSentences(text, { abbreviations: deriveAbbreviations(text) });
  if (!sentences.length) continue;

  // PER-POPULATION: discover this document's OWN top verbs (not replayed
  // from the registry sources) and ask understand() whether each is
  // already covered by the prior or has to be freshly taught — both
  // branches genuinely reachable, since this document's own frequent verbs
  // may or may not overlap the two saved registries' verb sets.
  const functionWords = functionWordSet(buildFrequencyTable(tokenize(text)));
  const surfaces = extractSurfaces(sentences, { functionWords, abbreviations: deriveAbbreviations(text) });
  const { verbs, candidates } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 });
  const topVerbs = candidates.slice(0, TOP_N_VERBS).map((c) => c.verb);

  for (const verb of topVerbs) {
    const population = `verb-island:${verb}`;
    if (populationsChecked.has(population)) continue;
    populationsChecked.add(population);

    const records = collectVerbIslandRecords(verb, sentences, verbs, functionWords);
    if (records.length < 3) {
      // Genuinely insufficient material for THIS document alone — a real,
      // disclosed outcome distinct from "invented" (which means understand()
      // ran real induction and it either found or didn't find structure).
      // Never forced through induceKinds' hard minKindSize gate.
      appendEntry({ type: "population", population, understanding: "insufficient_material", recordCount: records.length });
      continue;
    }
    const result = understand(records, { priors: [theKindVocabulary], population, readerVersion: READER_VERSION, minPrevalence: 0.15, minKindSize: 3, permutations: 20, quantile: 0.95, reseeds: 3, seed: 42 });
    appendEntry({ type: "population", population, understanding: result.understanding, giver: result.giver ?? null, recordCount: records.length });
  }

  // PER-INSTANCE: causal, activation-gated binding against the
  // ALREADY-EVIDENCED registry (the static one built in step 2 — newly
  // "invented" populations above are recorded as findings in the ledger
  // but not fed back into live resolution within this same pass; disclosed
  // as a real boundary, not silently assumed closed).
  const { bindings, gaps } = resolveSpanRole(sentences, { minActivation: MIN_ACTIVATION, minMargin: MIN_MARGIN });

  for (const b of bindings) {
    const id = spanId({ sourceId, sentenceOrder: b.sentenceOrder, charStart: b.charStart, charEnd: b.charEnd });
    if (latestSpanText(id) === null) appendEntry({ type: "span", spanId: id, sourceId, sentenceOrder: b.sentenceOrder, text: b.word });
    appendEntry({ type: "belief", spanId: id, turn: b.sentenceOrder, organ: "resolveSpanRole", operator: "CON", boundKind: b.kind, activation: b.activation, margin: b.margin });
  }
  for (const g of gaps) {
    const id = spanId({ sourceId, sentenceOrder: g.sentenceOrder, charStart: g.charStart, charEnd: g.charEnd });
    if (latestSpanText(id) === null) appendEntry({ type: "span", spanId: id, sourceId, sentenceOrder: g.sentenceOrder, text: g.word });
    appendEntry({ type: "belief", spanId: id, turn: g.sentenceOrder, organ: "resolveSpanRole", operator: "CON", boundKind: null, gapReason: g.reason });
  }
}

const popEntries = ledger.filter((e) => e.type === "population");
console.log(`population beliefs: ${popEntries.length} verb islands checked, ${popEntries.filter((e) => e.understanding === "prior").length} matched the prior, ${popEntries.filter((e) => e.understanding === "invented").length} required fresh induction, ${popEntries.filter((e) => e.understanding === "insufficient_material").length} had too little material in this document alone\n`);
console.log(`ledger: ${ledger.length} entries total (append-only, none mutated)\n`);

for (const e of ledger) {
  if (e.type === "population") console.log(`#${e.index} POPULATION ${e.population} -> ${e.understanding}${e.giver ? ` (giver: ${e.giver})` : ""}`);
  else if (e.type === "span") console.log(`#${e.index} turn:${e.sentenceOrder ?? "-"} SPAN   ${e.spanId.slice(0, 14)}…  "${e.text}"${e.supersedes !== null ? `  (supersedes #${e.supersedes})` : ""}`);
  else console.log(`#${e.index} turn:${e.turn} BELIEF ${e.spanId.slice(0, 14)}…  ${e.boundKind ? `CON+ -> ${e.boundKind}` : `GAP(${e.gapReason})`}`);
}

mkdirSync(join(HERE, "..", "..", "goldens", "agency-civic", "data"), { recursive: true });
writeFileSync(join(HERE, "..", "..", "goldens", "agency-civic", "data", "eot-stream.experiment.json"), JSON.stringify({ kindVocabulary: theKindVocabulary, ledger }, null, 2));
console.log(`\nwrote goldens/agency-civic/data/eot-stream.experiment.json`);

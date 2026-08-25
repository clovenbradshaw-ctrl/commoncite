// Bare specifier, not "node:fs": a bundler targeting a non-Node host (this
// module's own comment above on priorsRoot) treats the "node:" URI scheme
// as an unhandled resource type to load, not a module to fall back on, even
// when told to stub "fs" — the bare specifier is what that fallback
// actually matches. Node resolves both identically, so nothing changes here.
import fs from "fs";
import { canonicalHashSync, CORPUS_API_VERSION } from "../spec/index.js";
import { createRegistry, register } from "../../provenance/index.js";
import { createSession as makeDiscourseSession } from "../../discourse/index.js";
import { lineIndex, outlineOfIndex, discoverSegment } from "../engine/perceiver/text/segments.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../engine/perceiver/text/material.js";
import { splitSentences, deriveAbbreviations, stripContainer } from "../engine/perceiver/text/spans.js";
import { extractSurfaces, discoverReferents, diaNorm, namesCorefer } from "../engine/perceiver/text/surfaces.js";
import { resolvePronouns } from "../engine/perceiver/text/pronouns.js";
import { discoverRelationVocab, extractRelations } from "../engine/perceiver/text/relations.js";
import { projectReferents } from "../engine/referents/index.js";

// The cells this host organ occupies on the operator grid (engine/operators.js):
// INS · Void · Cultivating — material comes into being, admitted chunked by
// byte budget — CON · Field · Tending — a segment bound to its byte range —
// and SEG · Field · Clearing — the addressed reach-unit cut out byte-accurate
// (snip). Declared, checked by conformance.
export const CELLS = Object.freeze([
  Object.freeze({ op: "INS", grain: "Ground" }),
  Object.freeze({ op: "CON", grain: "Ground" }),
  Object.freeze({ op: "SEG", grain: "Ground" }),
]);

export { CORPUS_API_VERSION } from "../spec/index.js";

const DEFAULT_SPAN_CAP = 2000;
const CHUNK_SIZE = 2000;
const MIN_CHUNK_CHARS = 20;

// The operating point perceiver/text/pronouns.js::resolvePronouns is called
// at from this host. Declared HERE, not defaulted inside the engine organ
// (resolvePronouns throws without them, on the same standing entity.js's
// minArrivals and kind-void.js's draws/seed already hold) — but this pair of
// numbers is, honestly, the same standing as this file's own CHUNK_SIZE: an
// engineering starting point, not yet validated against a retrieval-quality
// golden. No such golden exists for pronoun binding in this repo today (the
// same gap surfaces.js's own header names). Moving these two numbers as one
// gets built is expected, not a regression.
const PRONOUN_MIN_ACTIVATION = 0.05;
const PRONOUN_MIN_MARGIN = 0.2;

const utf8 = new TextEncoder();
const utf8dec = new TextDecoder();

const byteLength = (text) => utf8.encode(text).length;

// A byte-accurate line index: starts are UTF-8 byte offsets into the source.
// The engine's boundary detection is unit-agnostic by contract, so the host
// hands it a byte index and the seams stay honest — slicing a string by byte
// offsets shifts every read past the first multi-byte character.
const byteIndex = (text) => {
  const lines = String(text ?? "").split("\n");
  const starts = new Array(lines.length);
  let at = 0;
  for (let i = 0; i < lines.length; i++) {
    starts[i] = at;
    at += byteLength(lines[i]) + (i + 1 < lines.length ? 1 : 0);
  }
  return { lines, starts, total: at, lengthOf: (line) => byteLength(line) };
};

const bufferOf = (text) => utf8.encode(text);

const bytesOf = (buf, start, end) =>
  utf8dec.decode(buf.subarray(start, Math.min(end, buf.length)));

export function createSession({ spanCap = DEFAULT_SPAN_CAP, engineVersion } = {}) {
  const discourse = makeDiscourseSession();
  return {
    apiVersion: CORPUS_API_VERSION,
    spans: new Map(),
    documents: new Map(),
    spanCap,
    engineVersion,
    discourse,
    provenance: createRegistry(),
    _bytes: new Map(),
  };
}

// ── serializeSession / deserializeSession — the export/reimport boundary ────
//
// eoreader6 itself makes no persistence claim (SEED.md/CUBE.md name none) —
// but a HOST built on this library (eochat, storing sessions in an
// origin-private OPFS) cannot honor "reimported state is fold-equivalent to
// the original" if the library it wraps offers no way to carry a session's
// terrain (spans, documents) and ledger (provenance) across the origin
// boundary at all. Measured
// (scripts/adversarial/challenge-20-export-reimport-fidelity.mjs, step 5):
// the single most obvious thing an engineer reaches for first — handing
// createSession()'s return value straight to JSON.stringify — round-trips
// every native Map as `{}` and silently destroys 100% of a real 31-span,
// 2-document terrain. Not a hypothetical: run against a real fold from the
// real pipeline, `reimported.spans instanceof Map` comes back `false` and
// the very next searchSpans() throws.
//
// The fix is narrow because the session was ALREADY plain-data-shaped —
// that same diagnostic is what shows it: every span, document, and
// provenance entry is a frozen/plain object with no closures anywhere in
// it; only the CONTAINERS are Maps, which is exactly the one shape JSON has
// no notation for. So serialize does one job — Map -> Array of [key, value]
// entries, which is what a Map's own iterator already yields (`[...map]`,
// not a rebuild) — and deserialize does the inverse, `new Map(entries)`.
//
// `_bytes` (snipRange/snipSegment's per-document byte-buffer + line-index
// cache) and `_cast` (discoveredCast's per-document memoisation) are
// deliberately NOT carried across the boundary: both are pure derived
// caches, recomputed lazily and deterministically from `documents` on next
// use (snipRange's own `cached ?? byteIndex(...)`; discoveredCast's
// chunk-count invalidation) — carrying them would mean carrying
// re-derivable bytes for nothing, and `_bytes`'s `idx.lengthOf` is a
// closure, which is not JSON-safe at all. Losing them costs a reimported
// session nothing it cannot recompute the moment it is asked; losing
// `spans`, `documents`, or `provenance` would cost the corpus itself
// (searchSpans/foldSpans/readSpan/snip* all read spans or documents) and
// the ledger (register/lookup read provenance) — which is why only those
// three needed fixing, per this project's convention of adding a named
// channel alongside what exists rather than redesigning the session shape.
export function serializeSession(session) {
  return {
    schema: "CorpusSession@1",
    apiVersion: session.apiVersion,
    spanCap: session.spanCap,
    engineVersion: session.engineVersion ?? null,
    spans: [...session.spans],
    documents: [...session.documents],
    provenance: { tick: session.provenance.tick, entries: [...session.provenance] },
    discourse: structuredClone(session.discourse),
  };
}

export function deserializeSession(blob) {
  if (!blob || blob.schema !== "CorpusSession@1")
    throw new TypeError(`deserializeSession: expected schema "CorpusSession@1", got ${blob?.schema}`);
  const provenance = new Map(blob.provenance?.entries ?? []);
  provenance.tick = blob.provenance?.tick ?? 0;
  return {
    apiVersion: blob.apiVersion,
    spans: new Map(blob.spans ?? []),
    documents: new Map(blob.documents ?? []),
    spanCap: blob.spanCap ?? DEFAULT_SPAN_CAP,
    engineVersion: blob.engineVersion ?? undefined,
    discourse: structuredClone(blob.discourse ?? makeDiscourseSession()),
    provenance,
    _bytes: new Map(),
  };
}

function chunkText(text, sourceId, session) {
  const chunks = [];
  const bytes = utf8.encode(text);
  let offset = 0;
  let chunkIndex = 0;

  while (offset < text.length) {
    const end = Math.min(offset + CHUNK_SIZE, text.length);
    const chunkText = text.slice(offset, end);
    if (chunkText.trim().length >= MIN_CHUNK_CHARS) {
      const chunkId = `${sourceId}:chunk-${chunkIndex}`;
      const byteStart = byteLength(text.slice(0, offset));
      const textBytes = byteLength(chunkText);
      const spanId = `span:${canonicalHashSync({ sourceId, chunkText })}`;

      const span = {
        span_id: spanId,
        source_id: chunkId,
        byte_start: byteStart,
        byte_end: byteStart + textBytes,
        text: chunkText,
        preview: chunkText.slice(0, 110),
        score: 0,
        coverage: 0,
        phrase: chunkText.slice(0, 60),
        chunk_index: chunkIndex,
      };

      if (session.spans.size < session.spanCap) {
        session.spans.set(spanId, span);
        register(session.provenance, {
          sourceId: chunkId,
          byteStart,
          byteEnd: byteStart + textBytes,
          text: chunkText,
        });
      }

      chunks.push({ id: chunkId, text: chunkText, byteStart, byteEnd: byteStart + textBytes });
    }
    offset = end;
    chunkIndex++;
  }
  return chunks;
}

/**
 * @param {string} [options.language] the document's language, e.g. "en" —
 *   RECEIVED, never inferred (SEED.md #1, Amendment V): omit it and cast
 *   discovery uses the engine's own derived abbreviation floor exactly as
 *   before. Supplied and a matching bin/priors/lang/<language>.json exists,
 *   that prior is used instead (see discoveredCast).
 */
export function admitChunked(session, { text, sourceId, language }) {
  if (!text || !sourceId) return { chunks: 0, admitted: [] };
  const docId = sourceId;
  let info = session.documents.get(docId);

  // Content-addressed re-admission guard — the same principle a chunk's own
  // span_id already applies (`span:${hash({sourceId, chunkText})}`, which is
  // why the span registry measured flat across repeat cycles: Map.set on an
  // existing key is a no-op-equivalent overwrite). `session.documents`,
  // unlike `session.spans`, is not keyed by content, and the concat below
  // (`info.text = (info.text||"") + text`) exists for a real case — a
  // document whose SECOND call carries genuinely new material (streamed
  // growth, see the note below) — but applies unconditionally, so a caller
  // that simply re-opens the same file next session (the ordinary shape of
  // sustained use: no export/reimport layer exists yet, so a restart means
  // re-ingesting the same source from scratch — challenge #20) hands back
  // byte-identical text and every re-admission concatenates it again,
  // unbounded in admit-count and independent of whether anything new was
  // read. Measured: 3 admissions of an unchanged 717,784-byte source grew
  // that document's `.text` to exactly 3.00x, not 1x
  // (scripts/adversarial/challenge-22-storage-growth-bound-over-sustained-use.mjs).
  // A hash of THIS call's own {sourceId, text} — not the document's
  // accumulated state — tells the two cases apart cheaply: unseen text
  // (first admission, or a second call carrying real new material) hashes to
  // something not yet recorded and is admitted exactly as before; text this
  // docId has already incorporated, byte for byte, is a repeat and is
  // reported without growing the record.
  const admissionHash = canonicalHashSync({ sourceId, text });
  if (info && info.admissionHashes?.includes(admissionHash)) {
    return { chunks: info.chunks.length, admitted: info.chunks, deduped: true };
  }

  const chunks = chunkText(text, sourceId, session);
  const pieces = chunks.map((c) => ({ byteStart: c.byteStart, text: c.text, length: c.byteEnd - c.byteStart }));
  if (info) {
    info.chunks = info.chunks.concat(chunks);
    info.pieces = info.pieces.concat(pieces);
    // `text` is the whole-document face of this record — documentText serves
    // it and sessionReferents reads its sentences. Appending chunks without
    // appending here left both looking at the first admission only, so a
    // document grown in two calls was folded as if the second half did not
    // exist. The chunker's own offsets already assume one continuous text.
    info.text = (info.text || "") + text;
    info.admissionHashes = (info.admissionHashes || []).concat(admissionHash);
    if (language) info.language = language;
  } else {
    session.documents.set(docId, {
      id: docId,
      path: sourceId,
      chunks,
      pieces,
      text,
      language: language ?? null,
      admissionHashes: [admissionHash],
    });
  }
  return { chunks: chunks.length, admitted: chunks };
}

export function ingestFile(session, filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const sourceId = `source:${filePath}`;
  return admitChunked(session, { text, sourceId });
}

// ── n-gram signal, shared with the surfer (surfer.js's contentAddress) ───────
// Re-earned from specs/mechanical-retrieval-theory.md: eoreader5 beat ColBERT
// on surface-form robustness with character-trigram profiles, and its typo
// arithmetic is calibrated at n=3 ("a typo changes at most 3 trigrams per
// character"; >50% retention keeps the rank). A wider range was measured and
// reverted: {2..4}, {2..5}, and {4..4} change no outcome on the 11 content-path
// golden cases, the three War-and-Peace paragraph snips, or their single-typo
// variants. The trigram is sufficient, so the anchor is kept. Both sides get
// the same transform, so a query and a span that share a phrase share its
// grams even when one has a wrong letter or a dropped accent.
export const nGramProfile = (text, { minN = 3, maxN = 3 } = {}) => {
  const t = String(text ?? "").toLowerCase();
  const counts = new Map();
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i + n <= t.length; i++) {
      const key = `${n}:${t.slice(i, i + n)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
};

// Query containment: the span's grams restricted to the query's support, each
// capped at the query's own count, cosine against the query. This asks "how
// much of what I asked for is in the span" and is immune to both span length
// and repetition: a span that contains the phrase verbatim scores ~1 no matter
// how long it is, a span with only half the query's grams scores proportionally,
// and a span that repeats a common letter pattern does not get extra credit.
export const queryContainment = (query, span) => {
  let dot = 0;
  let nq = 0;
  let nl = 0;
  for (const [k, qv] of query) {
    nq += qv * qv;
    const sv = span.get(k);
    if (!sv) continue;
    const capped = Math.min(sv, qv);
    dot += qv * capped;
    nl += capped * capped;
  }
  return nq && nl ? dot / (Math.sqrt(nq) * Math.sqrt(nl)) : 0;
};

// The longest contiguous run of query tokens appearing in a span's token
// sequence, as a fraction of the query's token count — the strongest evidence
// short of an exact span, and the same evidence the surfer's phrase term reads
// off a line: when the reader's words appear in order and unbroken, the span
// contains the thing asked for. Runs of length one are not evidence (every
// matched span contains the query's words singly).
const contiguousPhrase = (tokens, queryTokens) => {
  for (let len = queryTokens.length; len >= 2; len--) {
    for (let s = 0; s + len <= queryTokens.length; s++) {
      const win = queryTokens.slice(s, s + len);
      outer: for (let i = 0; i + len <= tokens.length; i++) {
        for (let j = 0; j < len; j++) if (tokens[i + j] !== win[j]) continue outer;
        return len / queryTokens.length;
      }
    }
  }
  return 0;
};

export function searchSpans(session, { query, limit = 10 }) {
  if (!query || !query.trim()) return { spans: [], gaps: null };
  const phraseWords = tokenize(query);
  if (phraseWords.length === 0) return { spans: [], gaps: null };

  // Lexical presence, never derivation: a span earns a match by containing a
  // query word as a token — no stemming, no synonymy, no fuzzy distance. The
  // query need not be a contiguous substring (a reader asks in words, not in
  // strings). Tokens come from the perceiver's WORD_RE — letters, numbers,
  // apostrophes — so "town" matches "town." and a query in any script matches
  // the same material.
  //
  // Rarity weight, re-earned from surfer.js's contentAddress (measured there:
  // term COUNT is not evidence strength — a stopword is nearly free, a rare
  // word decisive): weight = log(1 + N / (1 + df)), df is corpus-wide document
  // frequency (spans containing the token, out of N spans total). No
  // hardcoded stopword list (bin/README.md: "a hardcoded English stopword
  // list would be a lie" for any other language or a non-text medium) — a
  // word's ordinariness is read off this corpus's own statistics.
  //
  // REGRESSION this replaces: plain present/total coverage gave every query
  // word equal credit, so "who is neil armstrong" against a 5000-span novel
  // scored 0.5 (2 of 4 words present) on every one of dozens of spans that
  // merely contain "who" and "is" — indistinguishable from a genuinely
  // on-topic match, because "neil" and "armstrong" being ABSENT cost nothing.
  // Weighting fixes this without a second pass: "neil"/"armstrong" have df=0
  // (highest possible weight, since they never occur), so they dominate the
  // denominator for every span, and a span that only matches "who"/"is" —
  // both near-ubiquitous, near-zero weight — scores close to zero instead of
  // tying with real matches.
  //
  // One walk of the corpus computes both df (pass 1) and, once weights are
  // known, each span's score (pass 2) — no second full scan.
  const hits = [];
  const df = new Map(phraseWords.map((w) => [w, 0]));
  for (const span of session.spans.values()) {
    if (!span.text) continue;
    const tokens = tokenize(span.text);
    const words = new Set(tokens);
    const present = phraseWords.filter((w) => words.has(w));
    if (present.length === 0) continue;
    for (const w of present) df.set(w, df.get(w) + 1);
    hits.push({ span, present, tokens });
  }
  if (hits.length === 0) return { spans: [], gaps: null };

  const n = hits.length;
  const weight = (w) => Math.log(1 + n / (1 + (df.get(w) ?? 0)));
  const weights = new Map(phraseWords.map((w) => [w, weight(w)]));
  const totalW = phraseWords.reduce((s, w) => s + weights.get(w), 0);
  const queryGrams = nGramProfile(query);

  // A span's report is PRESENCE, and nothing else. The three terms a weighted
  // blend used to mix were measured against a full corpus and one of them is
  // not a signal at all: character-trigram containment between a sentence
  // query and a ~2000-char span is a near-constant (measured 0.88–0.98 across
  // every span of a real 220-span corpus), because the query's trigram mass is
  // overwhelmingly common English letters ("th", "he", "and") that any span
  // carries. Folded into the score it added a flat +0.13 to EVERY span — a
  // floor-bypass: below-threshold noise stopped being noise, which is exactly
  // the failure MIN_RELEVANCE_SCORE exists to close. It is kept on the span as
  // a trace and still serves the surfer's content address; it does not order
  // search. So no blend: the sense organ reports what is present, and order is
  // declared evidence — presence first, then, at equal presence, the span that
  // contains the reader's words contiguously in order (the surfer's "strongest
  // evidence short of an exact span"), then the earlier span (determinism over
  // noise). None of this is a weighted combination of what is present (the
  // constitution's II.8); the scalar stays the calibrated report the host's
  // floor was measured against.
  const matches = [];
  for (const { span, present, tokens } of hits) {
    const matchedW = present.reduce((s, w) => s + weights.get(w), 0);
    const coverage = totalW > 0 ? matchedW / totalW : 0;
    const phrase = contiguousPhrase(tokens, phraseWords);
    const ngram = queryContainment(queryGrams, nGramProfile(span.text));
    span.score = coverage;
    span.coverage = coverage;
    span.phrase_score = phrase;
    span.ngram = ngram;
    span.phrase = query;
    matches.push(span);
  }
  // Deterministic: presence desc, then the contiguous phrase desc, then earlier
  // in the document wins — the same tie-break the surfer uses ("the earlier
  // line wins — determinism over noise"), never the order the spans happened
  // to be admitted in.
  matches.sort(
    (a, b) =>
      (b.score || 0) - (a.score || 0) ||
      (b.phrase_score || 0) - (a.phrase_score || 0) ||
      a.byte_start - b.byte_start,
  );
  return { spans: matches.slice(0, limit), gaps: null };
}

export function spanUnits(session, spans) {
  return spans.map((sp) => ({
    meta: { span_id: sp.span_id, source_id: sp.source_id, score: sp.coverage || sp.score },
    text: sp.text,
    score: sp.score,
    coverage: sp.coverage,
  }));
}

export function foldSpans(session, { units, query, tokenBudget = 2400, maxUnits = 16 } = {}) {
  if (!units || !units.length) return { selected: [], summary: "", tokens: 0, selectedCount: 0 };

  const sorted = [...units].sort((a, b) => (b.score || 0) - (a.score || 0));
  const selected = [];
  let tokens = 0;
  const AVG_TOKEN_LEN = 4;

  for (const u of sorted) {
    const cost = Math.ceil((u.text?.length || 0) / AVG_TOKEN_LEN);
    if (tokens + cost > tokenBudget || selected.length >= maxUnits) break;
    selected.push(u);
    tokens += cost;
  }

  const summary = selected.map((u, i) => `[${i + 1}] ${u.text}`).join("\n\n");
  const dropped = units.length - selected.length;

  return { selected, summary, tokens, budget: tokenBudget, selectedCount: selected.length, dropped };
}

export function readSpan(session, { spanId, maxBytes = 4000 }) {
  const span = session.spans.get(spanId);
  if (!span) return { error: `unknown span_id ${spanId}` };
  const text = span.text.slice(0, maxBytes);
  return { text, source_id: span.source_id, byte_start: span.byte_start, byte_end: span.byte_end, truncated: text.length < span.text.length };
}

export function documentIds(session) {
  return Array.from(session.documents.keys());
}

export function documentText(session, docId) {
  const doc = session.documents.get(docId);
  if (!doc) return { error: `unknown document ${docId}` };
  const text = doc.text || doc.chunks.map((c) => c.text).join("\n");
  return { text, chunks: doc.chunks.length, source: doc.path };
}

// The structural outline of one document, re-earned from the engine's segment
// organ. Byte-accurate: every offset indexes the source's UTF-8 bytes, and a
// heading's `end` is the next boundary's start — the same coordinates the
// reader's byte windows already speak in, so an outline click and the text it
// lands on cannot part company.
export function sessionSegments(session, { sourceId, max, minBody } = {}) {
  const doc = sourceId ? session.documents.get(sourceId) : Array.from(session.documents.values())[0];
  if (!doc) return { error: `no document for "${sourceId}"` };

  const idx = byteIndex(doc.text || "");
  const out = outlineOfIndex(idx, { max, minBody });
  return { source: doc.id, text: doc.text || "", idx, ...out };
}

export function sessionOutline(session, { sourceId, zThreshold, max, minBody } = {}) {
  const seg = sessionSegments(session, { sourceId, max, minBody });
  if (seg.error) return { sections: [], frames: 0, error: seg.error };

  return {
    sections: (seg.headings || []).map((h, i) => ({
      index: i,
      offset: h.start,
      byteStart: h.start,
      byteEnd: h.end,
      length: h.end - h.start,
      label: h.label,
    })),
    frames: seg.text.length,
    gap: seg.gap,
    truncated: seg.truncated ?? false,
    error: null,
  };
}

// Snip an explicit byte range of one document — the primitive the surfer's
// outline resolution lands on. Decoded from the source bytes (never by
// slicing the JS string), registered in provenance so a later reader can
// cite it by refId.
export function snipRange(session, { sourceId, start, end, prompt, label }) {
  const doc = sourceId ? session.documents.get(sourceId) : Array.from(session.documents.values())[0];
  if (!doc) return { gap: "no_source", error: `no document for "${sourceId}"` };

  const cached = session._bytes.get(doc.id);
  const idx = cached?.idx ?? byteIndex(doc.text || "");
  const buf = cached?.buf ?? bufferOf(doc.text || "");
  if (!cached) session._bytes.set(doc.id, { idx, buf });

  const s = Math.max(0, Math.min(Math.floor(start ?? 0), idx.total));
  const e = Math.max(s, Math.min(Math.floor(end ?? idx.total), idx.total));
  if (e <= s) return { gap: "empty_material", reason: "the addressed range is empty" };

  const text = bytesOf(buf, s, e);
  const refId = register(session.provenance, {
    sourceId: doc.id,
    byteStart: s,
    byteEnd: e,
    text,
    spec: { what: "snipped_segment", prompt: prompt ?? null, segment: label ?? null },
  });

  return {
    refId,
    segment: label ?? "(untitled range)",
    source: doc.id,
    byte_start: s,
    byte_end: e,
    text,
  };
}

// The structural segment bracketing a byte anchor — the segment containing the
// passage the reader just landed on. Whatever stands within the reach around
// the anchor is found; a missing boundary behind it is reported honestly as a
// context window, never dressed up as a chapter.
export function snipSegment(session, { sourceId, anchor, radius, prompt } = {}) {
  const doc = sourceId ? session.documents.get(sourceId) : Array.from(session.documents.values())[0];
  if (!doc) return { gap: "no_source", error: `no document for "${sourceId}"` };

  const cached = session._bytes.get(doc.id);
  const idx = cached?.idx ?? byteIndex(doc.text || "");
  const buf = cached?.buf ?? bufferOf(doc.text || "");
  if (!cached) session._bytes.set(doc.id, { idx, buf });

  const seg = discoverSegment(idx, anchor, { radius });
  if (!seg) {
    // No structural boundary anywhere within the reach: return the window as
    // evidence, labelled as exactly that. A fabricated chapter name would be
    // a false permanency.
    const r = Math.min(radius ?? 6000, Math.max(600, idx.total >> 2));
    const from = Math.max(0, (anchor || 0) - r);
    const to = Math.min(idx.total, (anchor || 0) + r);
    const text = bytesOf(buf, from, to);
    return {
      gap: "no_structural_boundary_in_reach",
      reason: "the source's structure does not reach this passage — returned as a context window, not an invented chapter",
      segment: "(no structural boundary detected — context window)",
      source: doc.id,
      byte_start: from,
      byte_end: to,
      windowed: true,
      text,
    };
  }

  return {
    ...snipRange(session, { sourceId: doc.id, start: seg.start, end: seg.end, prompt, label: seg.label }),
    found: seg.found,
    windowed: false,
  };
}

// ---------------------------------------------------------------------------
// sessionReferents — the cast of one document.
//
// WHAT THIS REPLACES. Until now this function echoed the prior back and
// invented its numbers: `mentions: doc.chunks.length`, `frames:
// min(chunks,10)`, `lastFrame: chunks-1` — the same three values for every
// referent, none of them counted from the text. A document with no prior
// returned an empty cast, which is why the app's entity rail and Orbit were
// blank for every source but Frankenstein. Fabricated counts are worse than
// the empty cast, because a reader cannot tell them apart from measurements.
//
// Both are now read off the material by the engine's own organs, which
// already existed and were simply never called from the host:
//
//   spans.js::splitSentences        real sentence units with offsets
//   spans.js::deriveAbbreviations   tokens this text always writes with a dot
//   material.js::functionWordSet    closed class from THIS text's Zipf curve
//   surfaces.js::extractSurfaces    candidate surfaces + the cap/lower filter
//   surfaces.js::discoverReferents  name-variant coreference -> DEF.admit
//   referents/index.js::projectReferents   the canonical event projection
//   pronouns.js::resolvePronouns    third-person singular pronouns bound to
//                                   the discovered cast by one-hop activation
//                                   recall — see the header note below.
//
// TIER DISCIPLINE is inherited unchanged from surfaces.js and is the reason
// this is honest rather than a regex NER: name-variant coreference is
// ENGINE tier (derivable); descriptor synonymy is MODEL tier and still comes
// back as a typed gap, never a guessed number. A prior, when one exists,
// outranks discovery for the surfaces it claims.
//
// PRONOUN BINDING IS PARTIAL, AND SAID SO. surfaces.js's own gap
// ("pronoun_and_descriptor_mentions_unresolved") is not retired here — it is
// narrowed. Third-person singular pronouns ("he"/"she" and their forms) in a
// sentence with no named surface are offered to resolvePronouns, which binds
// one only when its one-hop recall against the already-discovered cast
// clears two declared bars (activation floor, margin over the runner-up);
// short of either, the pronoun stays exactly the same unresolved gap it
// always was. Resolved pronoun mentions are counted SEPARATELY from literal
// name mentions (`pronounMentions`/`pronounFrames`, never folded into
// `mentions`/`frames`) — merging them would let an activation-bound guess
// masquerade as a name occurrence, and countAcrossChunks's substring
// counting has no way to tell one pronoun's referent from another's.
//
// KNOWN LIMIT, declared not hidden: extractSurfaces gates on capitalisation,
// which is a property of Latin/Greek/Cyrillic script. On Han text it returns
// nothing (goldens/cast/README.md measured this). That is reported as a gap
// on a document where sentences exist but no surface survived, so the caller
// sees "this detector does not apply here" rather than "this text has no
// cast".
// ---------------------------------------------------------------------------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole-form occurrence counting, the same boundary rule the app's own
// surface matcher uses: a letter or digit on either side means this is a
// longer word, not this surface.
//
// The trailing group admits the apostrophe clitic, because the perceiver
// merged "Locke's" into "Locke" when it built the candidate. Counting the
// merged surface without it would report the stem's occurrences only — a
// number belonging to one spelling of a name that now covers two, which is
// exactly the kind of quietly-wrong figure the fold is supposed to refuse.
//
// Between words, an OPTIONAL period plus whitespace — not a literal single
// space. surfaces.js strips a trailing period off every token it captures
// (tokenisation drops non-letters), so a candidate born from an
// abbreviation-preserved name ("Mr Darcy", from raw text "Mr. Darcy") would
// otherwise never be found in the chunk text it was discovered in: a
// literal-space match requires "Mr Darcy" with no period, which the raw
// text never has. Silent under the derived fallback (which rarely produces
// a title-preserved multi-word candidate at all) and live the moment a real
// abbreviation prior is supplied — measured, not theoretical.
const occurrenceMatcher = (surfaces) => {
  const alts = [...new Set(surfaces.filter(Boolean).map(String))]
    .sort((a, b) => b.length - a.length)
    .map((s) => s.split(/\s+/).map(escapeRe).join("\\.?\\s+"));
  if (!alts.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join("|")})(?:['’]s?)?(?![\\p{L}\\p{N}])`, "giu");
};

// mentions/frames counted against the document's OWN admitted chunks, so the
// numbers the reader sees are in the same coordinates as the anchors they can
// click. A "frame" is a chunk the referent occurs in at least once.
const countAcrossChunks = (chunks, surfaces) => {
  const re = occurrenceMatcher(surfaces);
  if (!re) return { mentions: 0, frames: 0, firstFrame: null, lastFrame: null };
  let mentions = 0;
  let frames = 0;
  let firstFrame = null;
  let lastFrame = null;
  for (let i = 0; i < chunks.length; i++) {
    re.lastIndex = 0;
    const hits = chunks[i].text ? chunks[i].text.match(re) : null;
    if (!hits || !hits.length) continue;
    mentions += hits.length;
    frames++;
    if (firstFrame === null) firstFrame = i;
    lastFrame = i;
  }
  return { mentions, frames, firstFrame, lastFrame };
};

// ── apparatus demotion — the "apparatus" slot of referents/index.js's own
// INDIVIDUATION_TYPES, populated for the first time ────────────────────────
//
// `INDIVIDUATION_TYPES` (engine/referents/index.js) has named "apparatus"
// as one of five individuation kinds since that file's first line, and
// nothing anywhere in this repo ever assigned it — every discovered
// referent's `individuation` stayed the literal `null` this file's own
// comment already flags ("the caller sees null and applies its own
// policy"). This is that policy, for exactly this one kind, built on ONE
// measured, derived signal — not the general mass x coupling x agency
// classifier the other four kinds (field/emanon/protogon/holon) would still
// need; that is a genuinely larger, un-built subsystem and stays out of
// scope here.
//
// THE SIGNAL: what share of the document's OWN sentences a referent is
// named in. A narrating apparatus — a wire-service byline, a news outlet
// repeated as the attribution frame — gets re-stapled onto nearly every
// sentence precisely BECAUSE English third-person-singular pronouns do not
// apply to an organisation the way they do to a person: there is no "she"
// standing in for it, so the proper noun itself has to recur. A real
// narrative subject, however central, does not: prose carries a person
// forward with pronouns and unnamed continuation, so even the single most
// heavily NAMED character in an entire novel is named in only a small
// fraction of its sentences.
//
// MEASURED, NOT ASSUMED, against real fixtures already in this repo
// (scripts/adversarial/fixtures/), using the exact per-sentence occurrence
// count this file already applies per-chunk two functions up:
//   Frankenstein (pg84-frankenstein.txt, 3392 sentences): Elizabeth Lavenza,
//     the MOST-named character in the whole novel, 90/3392 sentences = 2.7%.
//   Heart of Darkness (2476 sentences): Mr Kurtz — discussed constantly
//     while physically absent for nearly the whole book, the protogon case
//     challenge #24 names — still only 113/2476 sentences = 4.6%.
//   The adversarial wire-service fixture (scripts/adversarial/fixtures/
//     wire-quiet-subject.txt, 40 sentences): "Continental Newswire",
//     21/40 sentences = 52.5% — an order of magnitude past either real
//     figure above, with real prose's own most extreme case (Kurtz, 4.6%)
//     nowhere near it.
// The floor below sits at 15%: comfortably above every real narrative
// referent measured (2.7%–4.6%), comfortably below the adversarial case
// (52.5%), and re-run against the exact numbers above rather than picked
// to fit one fixture (see scripts/adversarial/challenge-23-apparatus-
// demotion-regression-npr-bug-cl.mjs for the reproduction).
const APPARATUS_NAMING_SHARE_FLOOR = 0.15;

// Same occurrence discipline as countAcrossChunks just above, applied to
// SENTENCES instead of admitted chunks — chunks are a byte-capped storage
// unit (DEFAULT_SPAN_CAP) unrelated to sentence structure, and on a short
// document there may be only one or two of them, too coarse a grain for a
// share statistic to mean anything. Sentences are already computed once per
// document by discoveredCast and reused here, not re-split.
const namingSentenceShare = (sentences, surfaces) => {
  if (!sentences?.length) return 0;
  const re = occurrenceMatcher(surfaces);
  if (!re) return 0;
  let hit = 0;
  for (const s of sentences) {
    re.lastIndex = 0;
    if (re.test(s.text)) hit++;
  }
  return hit / sentences.length;
};

// ── individuation — the mass x coupling x agency classifier for the three
// remaining reachable INDIVIDUATION_TYPES slots ───────────────────────────
//
// (engine/referents/index.js's own INDIVIDUATION_TYPES has named
// field/emanon/protogon/holon/apparatus since that file's first line.
// "apparatus" is populated above, by one derived signal. This is the "genuinely
// larger, un-built subsystem" that section's own comment named as out of
// scope for that fix — built here, on the same discipline: a real signal,
// measured against real fixtures already in this repo, never assumed.)
//
// "field" stays definitionally unreachable, unchanged: a referent record
// only exists once something has recurred enough to be discovered or
// witnessed at all, and field names exactly the diffuse case that never
// individuates that far — there is nothing for this function to be asked
// to classify a field AS.
//
// THREE SIGNALS, ONE STRUCTURAL AND TWO STATISTICAL:
//
//   mass     — this referent's own `mentions` (already computed above).
//              Used here only as a RELIABILITY FLOOR: below it, no ratio
//              built on `mentions` has enough evidence to trust, so the
//              classifier declines rather than guesses (MASS_FLOOR, below).
//   coupling — pronounMentions / mentions, already computed and sitting on
//              every discovered referent unused before this. How much the
//              discourse's own grammar orbits this referent beyond bare
//              naming.
//   agency   — NEW. Real (subject, verb, object) triples already exist in
//              this codebase (perceiver/text/relations.js, discoveredCast's
//              own `relations`, above) — this is the first place they are
//              read PER REFERENT rather than as a flat list. agency is the
//              share of a referent's own mentions that occurred specifically
//              in subject position of an extracted relation: how often this
//              being enacts something, relative to how often it is merely
//              named.
//
// MEASURED, not assumed, against the two real literary fixtures challenge
// #24 itself used (scripts/adversarial/fixtures/pg84-frankenstein.txt,
// heart-of-darkness.txt) plus the human-curated coref prior for "the
// creature" (pg84-frankenstein.coref.json):
//
//   MASS_FLOOR = 15. Every noise-tier referent measured in Heart of
//   Darkness (Company 14, "I've" 14, English 13, Europe 8, Russian 8, God
//   7 — places, nationalities, and split contractions, not people) sits at
//   or below 14 mentions; every real named character measured in either
//   fixture (Frankenstein's own cast, 26-92 mentions; Kurtz, 121) sits well
//   above it. The one real exception is Marlow — Heart of Darkness's own
//   first-person narrator, whose third-person NAME is used only 10 times
//   because he is telling the story as "I," a structural property of
//   first-person narration this signal cannot see past. He is left
//   unclassified (null) rather than guessed at from too little naming
//   evidence — the honest outcome, not a special case.
//
//   PROTOGON_COUPLING_FLOOR = 1.0 — "referred to by pronoun MORE than
//   named outright." Measured against every mass-qualified referent in
//   both fixtures (Frankenstein's own eight: 0.07-0.83; Heart of Darkness's
//   own: 2.06 for Kurtz alone, everything else below the mass floor):
//   coupling never exceeds 1.0 for anyone except Kurtz, discussed and
//   pronoun-referenced for most of the book despite being physically
//   absent until Part III — this is the natural crossing point the
//   measurement itself produces, not a percentile picked to fit one
//   fixture.
//
//   agency IS computed and reported on every classified referent (below),
//   closing the "agency" third of the claim's own name — but it does NOT
//   gate the protogon decision above. Measured: at the mass this floor
//   requires, agency did not separate Kurtz (0.149) from an ordinary named
//   character — Frankenstein's own Victor sits LOWER, at 0.000. An honest
//   limit of what this signal can discriminate at this scale, disclosed
//   rather than smoothed over with a threshold that would only be fitting
//   one fixture's noise.
//
//   emanon is structural, not a threshold at all: every surface on the
//   real "creature" prior ("the creature", "the monster", "the wretch",
//   "my adversary", ...) fails the SAME capitalised-run shape
//   extractSurfaces itself already gates ordinary discovery on — this
//   referent could only ever have arrived via a prior. A referent whose
//   surfaces are categorically not name-shaped, with real mass behind it,
//   is emanon; there is nothing to measure a threshold against.
const MASS_FLOOR = 15;
const PROTOGON_COUPLING_FLOOR = 1.0;

const isNameShaped = (surface) => /^\p{Lu}/u.test(String(surface ?? "").trim());
const surfaceTextOf = (s) => (typeof s === "string" ? s : s?.surface);
const surfaceTextsOf = (raw) => (raw ?? []).map(surfaceTextOf).filter((s) => typeof s === "string" && s);

const referentOwnsSubject = (subjectText, surfaceTexts) => {
  const subj = diaNorm(subjectText);
  return surfaceTexts.some((s) => diaNorm(s) === subj || namesCorefer(s, subjectText));
};

/**
 * Classifies one referent into "emanon" | "protogon" | "holon" | null,
 * mutating `r` to also carry the `agency` and (when available) `coupling`
 * evidence it measured, whichever way the decision landed. `relations` is
 * discoveredCast's own per-document (subject, verb, object) triples (empty
 * array for a prior-sourced referent with no document-level relations to
 * read, which is fine — agency and the structural emanon test both still
 * work from `r` alone).
 *
 * Never called for a referent already typed "apparatus" — that decision,
 * made above from a different signal, is never second-guessed here.
 */
const classifyIndividuation = (r, relations) => {
  const surfaceTexts = surfaceTextsOf(r.surfaces);
  const mentions = r.mentions ?? 0;
  const nameShaped = surfaceTexts.some(isNameShaped);

  if (!nameShaped) {
    return surfaceTexts.length > 0 && mentions >= MASS_FLOOR ? "emanon" : null;
  }

  if (mentions < MASS_FLOOR) return null;

  const subjectHits = relations.filter((rel) => referentOwnsSubject(rel.subject, surfaceTexts)).length;
  r.agency = mentions > 0 ? subjectHits / mentions : 0;

  if (typeof r.pronounMentions === "number") {
    r.coupling = r.pronounMentions / mentions;
    if (r.coupling > PROTOGON_COUPLING_FLOOR) return "protogon";
  }

  return "holon";
};

// bin/priors/lang/<language>.json — a received prior naming which tokens
// this language writes with a trailing period without ending a sentence
// (spans.js's own docstring: "a caller that has a prior should pass it").
// Loaded here, at the host, and nowhere in the engine: the engine perceiver
// stays language-agnostic by construction (no word list baked into spans.js
// or surfaces.js), and loading a JSON file off disk is host-tier I/O, the
// same division loadMorphology/loadConventions already draw. `language` is
// RECEIVED (SEED.md #1, Amendment V) — never inferred from the text — so a
// caller that does not know or does not declare a document's language gets
// exactly today's behaviour: the engine's own derived, weaker fallback.
//
// Built from `import.meta.url` + the `URL` constructor rather than
// node:path/node:url: both are standard ESM/Web primitives (Node treats a
// URL exactly like a path in every fs call below), so this file only ever
// touches ONE Node-specific surface (fs itself) — the one a non-Node host
// (packages/host/index.js imported into a browser bundle, language always
// omitted so this function is simply never called) already tree-shakes
// around without needing a second built-in stubbed alongside it.
//
// The relative path is assembled at runtime rather than passed as a string
// literal: `new URL("literal", import.meta.url)` is exactly the shape
// bundlers (webpack 5's asset-module handling in particular) statically
// recognise and try to resolve as a bundled asset — which then fails the
// browser build outright over a path a browser host never asks fs to open
// in the first place (language is never declared there). A computed string
// argument reads identically to Node's URL resolution and is invisible to
// that static analysis.
const PRIORS_RELATIVE_PATH = ["..", "..", "bin", "priors", "lang", ""].join("/");
const priorsRoot = new URL(PRIORS_RELATIVE_PATH, import.meta.url);

const loadAbbreviationPrior = (language) => {
  const path = new URL(`${language}.json`, priorsRoot);
  if (!fs.existsSync(path)) return null;
  const raw = JSON.parse(fs.readFileSync(path, "utf8"));
  if (raw.schema !== "AbbreviationPrior@1")
    throw new TypeError(`loadAbbreviationPrior: expected AbbreviationPrior@1, got ${raw.schema}`);
  if (!raw.provenance?.source) throw new TypeError("loadAbbreviationPrior: a prior must name its giver");
  return { language: raw.language, giver: raw.provenance.source, abbreviations: raw.abbreviations };
};

// The document-local half of discoveredCast, factored out so a caller that
// needs surfaces from MORE THAN ONE document (sessionReferentsAcrossDocuments,
// below) can pool them before clustering, instead of re-deriving this by
// hand. Nothing past this point — sentence splitting, the abbreviation prior,
// the capitalisation/function-word filter — is document-count-aware; it was
// only ever CALLED once per document, which is a property of the caller
// (discoveredCast), not of the extraction itself.
//
// Memoised per document and invalidated by chunk count, same rationale as
// discoveredCast's own memoisation below: deterministic in the document
// text, and re-splitting 400 KB of sentences on every /api/fold poll is work
// with a known answer.
function extractDocSurfaces(session, doc) {
  const cached = session._surfaces?.get(doc.id);
  if (cached && cached.chunks === doc.chunks.length) return cached.value;

  const source = doc.text || doc.chunks.map((c) => c.text).join("\n");
  const body = stripContainer(source).text || source;

  const gaps = [];

  // Derived once and used twice, deliberately: the same set that keeps "Cf."
  // from ending a sentence is the set that keeps "Cf" out of the cast. Both
  // uses rest on the same source. When the document names a received
  // language AND a matching prior exists, that prior is the stronger source
  // (spans.js's own measurement: 0 -> 249 "Mr. Darcy" occurrences on Pride
  // and Prejudice, against 0 -> 0 from derivation alone); otherwise this
  // falls through to the engine's own derived, weaker floor exactly as
  // before — no language was ever asserted here without one being given.
  let abbreviations = null;
  let abbreviationGiver = null;
  if (doc.language) {
    const prior = loadAbbreviationPrior(doc.language);
    if (prior) {
      abbreviations = prior.abbreviations;
      abbreviationGiver = prior.giver;
    } else {
      gaps.push({
        reason: "no_abbreviation_prior_for_language",
        tier: "witness",
        detail: `document declared language "${doc.language}" but bin/priors/lang/${doc.language}.json does not exist — falling back to the engine's own derived abbreviation floor`,
      });
    }
  }
  if (!abbreviations) abbreviations = deriveAbbreviations(body);
  const sentences = splitSentences(body, { abbreviations });

  let surfaces = [];
  let functionWords = null;
  if (!sentences.length) {
    gaps.push({
      reason: "no_sentence_units_in_document",
      tier: "engine",
      detail: "the text perceiver found no sentence boundaries, so no surface could be positioned",
    });
  } else {
    functionWords = functionWordSet(buildFrequencyTable(tokenize(body)));
    surfaces = extractSurfaces(sentences, { functionWords, abbreviations });
    if (!surfaces.length) {
      gaps.push({
        reason: "no_candidate_surfaces",
        tier: "engine",
        detail:
          `${sentences.length} sentences were read and no surface survived the capitalisation filter. ` +
          "extractSurfaces detects names by mid-sentence capitalisation, which is a property of " +
          "Latin/Greek/Cyrillic script — on a caseless script (Han, Arabic, Hebrew) this detector " +
          "does not apply, and its silence is not evidence that the text has no cast.",
      });
    }
  }

  // `body` and `functionWords` are exposed (not just used locally) so
  // discoveredCast can measure the individuation classifier's `agency`
  // signal (subject-of-own-verbs rate, via relations.js) against the exact
  // same text and closed class this function already derived — never a
  // second, possibly-inconsistent derivation.
  const value = { sentences, surfaces, gaps, abbreviationGiver, body, functionWords };
  if (!session._surfaces) session._surfaces = new Map();
  session._surfaces.set(doc.id, { chunks: doc.chunks.length, value });
  return value;
}

// Discovery is deterministic in the document text, so it is memoised per
// document and invalidated by chunk count — the only way a document grows
// here is admitChunked appending to it. /api/fold is polled by the app on
// every source toggle and every reader open; re-splitting 400 KB of sentences
// each time is work with a known answer.
function discoveredCast(session, doc) {
  const cached = session._cast?.get(doc.id);
  if (cached && cached.chunks === doc.chunks.length) return cached.value;

  const { sentences, surfaces, gaps: extractionGaps, abbreviationGiver, body, functionWords } = extractDocSurfaces(session, doc);
  const gaps = [...extractionGaps];

  let referents = [];
  let pronounBindings = [];
  // (subject, verb, object) triples, measured once per document — the
  // individuation classifier's `agency` signal below reads these, and
  // sessionReferents may call discoveredCast many times over one document's
  // life (polled on every source toggle), so this is computed here,
  // alongside the same memoisation discoveredCast's own header already
  // explains, rather than re-scanned on every call.
  let relations = [];

  // extractDocSurfaces already reported the applicable one of
  // no_sentence_units_in_document / no_candidate_surfaces above, if either
  // applied — nothing further to discover from an empty surface list.
  if (surfaces.length) {
      const discovery = discoverReferents(surfaces);
      referents = projectReferents(discovery.events);
      // Apparatus demotion (see the section header above `namingSentenceShare`):
      // one derived signal, measured against this document's own sentences,
      // answering the one INDIVIDUATION_TYPES slot ("apparatus") this repo
      // had declared but never populated. Every other referent keeps
      // `individuation` unset here exactly as before — sessionReferents'
      // own comment stands: the caller sees no assertion and applies its
      // own policy for the rest.
      for (const r of referents) {
        const share = namingSentenceShare(sentences, r.surfaces);
        r.namingSentenceShare = share;
        if (share >= APPARATUS_NAMING_SHARE_FLOOR) r.individuation = "apparatus";
      }

      // The `agency` signal the individuation classifier reads below
      // (sessionReferents): real (subject, verb, object) triples, the same
      // primitive discoverRelationVocab/extractRelations already supply
      // elsewhere in this codebase (perceiver/text/relations.js). minSurfaces
      // is the same value 1 this repo's own challenge-14 script already used
      // measuring this exact organ against real prose — a candidate verb
      // need only follow one distinct surface to enter the vocabulary, the
      // most permissive reading, appropriate here because this signal is
      // read RELATIVE to other referents in the same document, never
      // against an absolute count.
      relations = extractRelations(body, { verbs: discoverRelationVocab(body, { surfaces, functionWords, minSurfaces: 1 }).verbs, functionWords });
      // discoverReferents emits the same gap once per referent, because at
      // that level each referent is the unit. Forwarding 63 identical
      // objects to a reader-facing audit log is noise that buries the gaps
      // that differ; the fact is one fact about the whole cast, so it is
      // stated once and carries its own count.
      if (discovery.gaps.length) {
        const one = discovery.gaps[0];
        gaps.push({
          reason: one.reason,
          tier: one.tier,
          needsWitness: one.needsWitness,
          referents: discovery.gaps.length,
          detail: `${discovery.gaps.length} discovered referents: ${one.detail}`,
        });
      }

      // Third-person singular pronouns, offered to the same cast — see the
      // section header above. surfaceToReferent maps each admitted DEF.admit
      // surface straight back to its referent_id; resolvePronouns adds no
      // surfaces of its own, it only asks which already-named referent a
      // pronoun's sentence resembles by one-hop recall.
      const surfaceToReferent = new Map(discovery.events.map((e) => [e.surface, e.referent_id]));
      // Referents already typed "apparatus" above are handed in as
      // known-non-personal — resolvePronouns has no individuation notion of
      // its own and is not asked to derive one; this is the same "caller
      // applies its own policy" hand-off the ranking demotion above already
      // makes, reused for pronoun binding instead of reinvented.
      const nonPersonal = new Set(referents.filter((r) => r.individuation === "apparatus").map((r) => r.id));
      const resolved = resolvePronouns(sentences, surfaceToReferent, {
        minActivation: PRONOUN_MIN_ACTIVATION,
        minMargin: PRONOUN_MIN_MARGIN,
        nonPersonal,
      });
      pronounBindings = resolved.bindings;

      // Same collapsing discipline as discovery.gaps just above: one summary
      // fact, not one gap object per unresolved pronoun in a 690 KB novel.
      if (resolved.bindings.length || resolved.gaps.length) {
        gaps.push({
          reason: "pronoun_mentions_partially_resolved",
          tier: "model",
          needsWitness: true,
          pronounsResolved: resolved.bindings.length,
          pronounsRemaining: resolved.gaps.length,
          detail:
            `${resolved.bindings.length} third-person singular pronoun mentions bound to a referent by ` +
            `activation recall; ${resolved.gaps.length} remain unresolved (below the declared activation ` +
            "or margin floor, gender-incompatible with every candidate named so far, or nothing named yet " +
            "to recall). Descriptor synonymy is untouched by either count and remains not derivable " +
            "(eoreader5 measured distributional coref failing twice). Supply a per-text prior to close " +
            "what remains.",
        });
      }
  }

  const value = { referents, gaps, abbreviationGiver, pronounBindings, relations };
  if (!session._cast) session._cast = new Map();
  session._cast.set(doc.id, { chunks: doc.chunks.length, value });
  return value;
}

// discoveredCastAcrossDocuments — the cast of MORE THAN ONE document, pooled
// before clustering.
//
// ROOT CAUSE THIS ANSWERS: discoveredCast/sessionReferents hard-scoped
// referent discovery to exactly one sourceId (`session.documents.get`),
// which is a property of the CALLER, not of discoverReferents itself —
// surfaces.js's own clustering (namesCorefer: containment or shared final
// token, the ENGINE-tier "NAME-variant coreference" its header declares,
// same doctrine that already merges "Victor Frankenstein" with
// "Frankenstein" within one document) never receives a document boundary as
// an argument. It clusters whatever flat surface list it is handed. Handing
// it ONE document's surfaces every time, with no caller ever pooling more
// than one, was the only reason two documents' variant name-forms for the
// same being never merged — not a missing capability, an unexercised one.
//
// This is name-variant coreference EXTENDED ACROSS documents, not a new
// identity mechanism: same `discoverReferents`, same `namesCorefer`, same
// generic-token fence, run once over the union of every named document's
// candidate surfaces instead of once per document. Two sources naming a
// being "Kade" and "Marcus Aurelius Kade" now corefer for the same reason
// "Frankenstein" corefers with "Victor Frankenstein" inside one book: a
// shared final token, structural, no witness needed (SEED.md "identity by
// consequence" is a different, deeper claim — CON · Pattern, requiring
// arrival-position evidence — and is untouched by this; this stays exactly
// on the SIG · Void · Tending cell discoverReferents already occupies).
//
// WHAT THIS DOES NOT CLOSE: two sources with NO shared or variant literal
// name form (a pure epithet with no name-token overlap, e.g. "the Iron
// Admiral" against "Kade") still will not merge — namesCorefer has nothing
// to compare. That is not a scoping bug; it is the tier boundary
// surfaces.js's own header already draws ("MODEL tier: descriptor synonymy
// ... NOT derivable, reported as a typed gap"). Closing that case needs a
// cross-document identity STATISTIC that does not exist in this repo yet
// (referents/consequence.js::identityByConsequence is the one non-string
// identity-comparison organ here, and it is not that statistic: it needs
// both surfaces inside one continuous openReading() state, and its own
// header already records "weak segregation power" on an ensemble cast where
// entities are rarely apart — the same weak-power failure mode reproduces
// when it is naively extended across concatenated documents).
function discoveredCastAcrossDocuments(session, docs) {
  const gaps = [];
  const pooledSurfaces = [];
  const groups = [];
  for (const doc of docs) {
    const { surfaces, gaps: docGaps } = extractDocSurfaces(session, doc);
    if (docGaps.length) gaps.push(...docGaps.map((g) => ({ ...g, sourceId: doc.id })));
    pooledSurfaces.push(...surfaces);
    groups.push(surfaces);
  }

  if (!pooledSurfaces.length) return { referents: [], gaps };

  // Clustering runs on the POOLED candidate list for CO-REFERENCE (a name
  // from source A is free to match a name from source C), but `groups` keeps
  // the GENERIC-TOKEN fence document-local (see discoverReferents's own
  // header on `groups`) — otherwise unrelated documents' one-off proper
  // nouns dilute the fence that decides whether a title/family-name inside
  // ONE document is generic, measured live on this repo's own challenge-25
  // fixture (a within-source merge that succeeds standalone silently broke
  // under naive flat pooling before `groups` existed).
  const discovery = discoverReferents(pooledSurfaces, { groups });
  const referents = projectReferents(discovery.events);

  if (discovery.gaps.length) {
    const one = discovery.gaps[0];
    gaps.push({
      reason: one.reason,
      tier: one.tier,
      needsWitness: one.needsWitness,
      referents: discovery.gaps.length,
      detail: `${discovery.gaps.length} discovered referents, pooled across ${docs.length} document(s): ${one.detail}`,
    });
  }

  return { referents, gaps };
}

// sessionReferentsAcrossDocuments — the cast of a NAMED SET of documents,
// with each surviving referent's evidence still broken out per source.
//
// THE PROVENANCE HALF OF THE CLAIM: merging "Kade" (source A) and
// "Vessa's Kade" (source C) into one referent must not blur WHICH source
// attests WHICH occurrences. `sources` on each referent is exactly that —
// countAcrossChunks run separately against each document's OWN chunks with
// the referent's full (merged) surface set, so a source that never used one
// particular variant simply counts zero for it, and a source's own mentions
// never leak into another source's tally. `mentions`/`frames` stay the sum,
// for the same "how prominent is this being in what I ingested" reading a
// single-document referent already gives; `sources` is the citation-grade
// breakdown underneath it.
function sessionReferentsAcrossDocuments(session, { sourceIds, priors = [], limit = 100 } = {}) {
  const gaps = [];
  const docs = [];
  for (const id of sourceIds) {
    const doc = session.documents.get(id);
    if (!doc) gaps.push(`unknown document ${id}`);
    else docs.push(doc);
  }
  if (!docs.length) return { referents: [], gaps, sourceIds: [] };

  const referents = [];
  const claimed = new Set();

  const countPerSource = (surfaces) => {
    const sources = [];
    let mentions = 0;
    let frames = 0;
    for (const doc of docs) {
      const counted = countAcrossChunks(doc.chunks || [], surfaces);
      if (counted.mentions) sources.push({ sourceId: doc.id, ...counted });
      mentions += counted.mentions;
      frames += counted.frames;
    }
    return { sources, mentions, frames };
  };

  // Same "prior wins every surface it names" precedence as the single-
  // document path, applied against the union of all named documents' chunks.
  for (const prior of priors) {
    const id = prior.id || prior.name || `ref:${canonicalHashSync(prior)}`;
    const raw = prior.surfaces || [prior.name].filter(Boolean);
    const surfaces = raw
      .map((s) => (typeof s === "string" ? s : s && s.surface))
      .filter((s) => typeof s === "string" && s && !/@\d+-\d+$/.test(s));
    const counted = countPerSource(surfaces.length ? surfaces : raw.filter((s) => typeof s === "string"));
    for (const s of surfaces) claimed.add(diaNorm(s));
    referents.push({
      id,
      display: prior.display || prior.name || id,
      surfaces: raw,
      ...counted,
      individuation: prior.individuation || "holon",
      fromPrior: true,
    });
  }

  const discovery = discoveredCastAcrossDocuments(session, docs);
  gaps.push(...discovery.gaps);

  for (const r of discovery.referents) {
    if (r.surfaces.some((s) => claimed.has(diaNorm(s)))) continue;
    const counted = countPerSource(r.surfaces);
    if (!counted.mentions) continue; // discovered in the pooled body, absent from every source's admitted chunks
    const display = [...r.surfaces].sort((a, b) => b.length - a.length)[0];
    referents.push({
      id: r.id,
      display,
      surfaces: r.surfaces,
      ...counted,
      // Individuation (apparatus demotion in particular) is a per-document
      // naming-sentence-share measurement (namingSentenceShare above) that
      // has no defined meaning pooled across documents of different length
      // and register — left null, the same "caller applies its own policy"
      // standing four of five individuation kinds already take on the
      // single-document path.
      individuation: null,
      fromPrior: false,
    });
  }

  referents.sort((a, b) => (b.fromPrior === true) - (a.fromPrior === true) || b.mentions - a.mentions);

  const total = referents.length;
  const kept = Number.isFinite(limit) ? referents.slice(0, limit) : referents;
  if (kept.length < total) {
    gaps.push({
      reason: "cast_truncated",
      tier: "host",
      detail: `${total} referents discovered, ${kept.length} returned (limit=${limit})`,
    });
  }

  return { referents: kept, gaps, sourceIds: docs.map((d) => d.id) };
}

// sessionRelations — the (subject, verb, object) triples discoveredCast
// already measures per document for the individuation classifier's `agency`
// signal, exposed as a document's own return rather than kept trapped inside
// that one call site. This is the graph's medium-specific mouth
// (perceiver/text/relations.js) at host tier: packages/host/graph.js reads
// this, never re-derives it, so a document's relations are measured exactly
// once regardless of how many callers (the cast, the graph) need them.
export function sessionRelations(session, { sourceId } = {}) {
  const doc = session.documents.get(sourceId);
  if (!doc) return { relations: [], gaps: [`unknown document ${sourceId}`] };
  const { relations, gaps } = discoveredCast(session, doc);
  return { relations, gaps };
}

export function sessionReferents(session, { sourceId, priors = [], limit = 100 } = {}) {
  // A caller naming MORE THAN ONE document asks a different question than
  // the single-document cast below — see sessionReferentsAcrossDocuments's
  // own header for what this does and does not merge, and why.
  if (Array.isArray(sourceId)) return sessionReferentsAcrossDocuments(session, { sourceIds: sourceId, priors, limit });

  const doc = session.documents.get(sourceId);
  if (!doc) return { referents: [], gaps: [`unknown document ${sourceId}`] };

  const chunks = doc.chunks || [];
  const referents = [];
  const gaps = [];
  const claimed = new Set(); // lowercased surfaces a prior has already spoken for

  // Computed before the prior loop now (moved up from after it — nothing in
  // either loop's own logic depends on the ORDER these two run in, only on
  // `claimed` existing before discovered referents are filtered against it,
  // which is unaffected) so a prior with no explicit `individuation` can
  // read discoveredCast's own per-document `relations` for the classifier
  // below, the same evidence discovered referents already get.
  const discovery = discoveredCast(session, doc);
  gaps.push(...discovery.gaps);

  // The prior first, and it wins every surface it names. Witness knowledge is
  // received, not competed with — a discovered candidate that happens to share
  // a surface with a prior referent is the same being seen without the name.
  for (const prior of priors) {
    const id = prior.id || prior.name || `ref:${canonicalHashSync(prior)}`;
    const raw = prior.surfaces || [prior.name].filter(Boolean);
    // A prior surface may be an object with a scope, or a positional
    // `surface@from-to` handle. Neither is countable text.
    const surfaces = raw
      .map((s) => (typeof s === "string" ? s : s && s.surface))
      .filter((s) => typeof s === "string" && s && !/@\d+-\d+$/.test(s));
    const counted = countAcrossChunks(chunks, surfaces.length ? surfaces : raw.filter((s) => typeof s === "string"));
    for (const s of surfaces) claimed.add(diaNorm(s));
    const ref = { id, display: prior.display || prior.name || id, surfaces: raw, ...counted, fromPrior: true };
    // Witness knowledge is received, not competed with — an EXPLICIT prior
    // individuation is never second-guessed. Only when the prior omits the
    // field does this fall through to the classifier discovered referents
    // already use, instead of silently defaulting to the literal string
    // "holon": stripping the field used to report "holon" with zero other
    // change (measured — see classifyIndividuation's own header); this
    // replaces that silent default with an actual, evidenced computation.
    // "holon" is still what it lands on absent any contrary evidence, so an
    // already-correct prior never regresses. Coupling is unavailable here
    // (pronoun binding is keyed off the discovered cast only) — the
    // structural emanon test doesn't need it, and classifyIndividuation
    // degrades to "holon" gracefully without it, same as any other
    // evidence-poor case.
    ref.individuation = prior.individuation || classifyIndividuation(ref, discovery.relations) || "holon";
    referents.push(ref);
  }

  for (const r of discovery.referents) {
    if (r.surfaces.some((s) => claimed.has(diaNorm(s)))) continue;
    const counted = countAcrossChunks(chunks, r.surfaces);
    if (!counted.mentions) continue; // discovered in the body, absent from the admitted chunks
    // The longest surface is the fullest form of the name ("Victor
    // Frankenstein" over "Victor"), which is what a reader wants on the label.
    const display = [...r.surfaces].sort((a, b) => b.length - a.length)[0];
    // Activation-bound pronoun mentions for THIS referent, counted separately
    // from `counted` above (see the section header: never folded into
    // `mentions`/`frames`, which stay literal-surface-only).
    const pronounHits = discovery.pronounBindings.filter((b) => b.referentId === r.id);
    const pronounFrameOrders = new Set(pronounHits.map((b) => b.sentenceOrder));
    const ref = {
      id: r.id,
      display,
      surfaces: r.surfaces,
      ...counted,
      pronounMentions: pronounHits.length,
      pronounFrames: pronounFrameOrders.size,
      namingSentenceShare: r.namingSentenceShare,
      fromPrior: false,
    };
    // Individuation. Which kind of being a referent is (holon / emanon /
    // protogon / field / apparatus) is a typed judgement; discovery only
    // establishes that something recurs and is named. "apparatus" is
    // already decided (discoveredCast measured this referent's own
    // naming-sentence-share against THIS document — see
    // `namingSentenceShare`/`APPARATUS_NAMING_SHARE_FLOOR` above) and is
    // passed through, never re-derived. For the rest, classifyIndividuation
    // reads the mass/coupling/agency evidence this loop just assembled;
    // genuinely insufficient evidence still returns null, the same "caller
    // applies its own policy" contract as before either classifier existed.
    ref.individuation = r.individuation ?? classifyIndividuation(ref, discovery.relations);
    referents.push(ref);
  }

  // Apparatus demotion: a referent typed "apparatus" above sorts AFTER every
  // other discovered referent regardless of raw mention count — the fix for
  // the bug class this ranking used to be naive about. fromPrior still wins
  // outright (witness knowledge received, not competed with, unchanged from
  // before) and raw mentions still break ties within a tier, exactly as
  // before; only a new tier was added, not a replacement of what existed.
  const isApparatus = (r) => (r.individuation === "apparatus" ? 1 : 0);
  referents.sort(
    (a, b) =>
      (b.fromPrior === true) - (a.fromPrior === true) ||
      isApparatus(a) - isApparatus(b) ||
      b.mentions - a.mentions,
  );

  // L3: where the cast is cut, the cut is reported.
  const total = referents.length;
  const kept = Number.isFinite(limit) ? referents.slice(0, limit) : referents;
  if (kept.length < total) {
    gaps.push({
      reason: "cast_truncated",
      tier: "host",
      detail: `${total} referents discovered, ${kept.length} returned (limit=${limit})`,
    });
  }

  return { referents: kept, gaps };
}

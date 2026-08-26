// eoreader6 · goldens/network/read — a full reading of each fixture book,
// scored against its frozen third-party character co-occurrence network.
//
// A FULL reading, not a co-occurrence-shaped one. Organs this repo already
// has, chained in the order a reading actually needs them, with structural
// linking as the LAST, derived step rather than the thing driving the
// pipeline:
//
//   1. perceiver/text/surfaces.js::extractSurfaces — candidate referent
//      surfaces, from the text's own statistics (a capitalisation
//      significance test against this book's own function-word
//      distribution, apostrophe/roman-numeral/all-caps rejection). Replaces
//      "every word plus every adjacent bigram is a candidate" — this
//      driver's first version — with the engine's real proper-noun
//      detector.
//   2. perceiver/text/surfaces.js::discoverReferents — name-variant
//      coreference (containment, shared final token) over those
//      candidates. "Valjean" and "Jean Valjean" become ONE referent id
//      before entity.js ever sees either spelling.
//   3. referents/entity.js — causal admission, completely unchanged: same
//      SPEC, same atom-chunked reach-units goldens/cast/read.mjs proved.
//      Only WHICH surfaces get offered to `witnessArrival` changed —
//      engine-tier candidates instead of every word — never how admission
//      itself is decided.
//   4. referents/consequence.js, via cooccurrence.js's mergeAliasedEntities
//      — a second, complementary alias pass over what step 3 admitted, for
//      exactly the cases step 2's spelling-based merge is conservative
//      about on purpose (measured: "Tom Sawyer" and "Sawyer" both lose
//      their shared tokens to the generic-token filter in Huckleberry
//      Finn's own candidate pool). Arrival SHAPE, not spelling.
//   5. emergence/binding.js::bindLinks — THE PROPER REPLACEMENT for what an
//      earlier version of this driver hand-rolled as "did two entities ever
//      share a chapter": a real permutation-null significance test PER
//      PAIR (`displacementNull`), run over the reading's own reach-unit
//      arrival positions, not a same-chapter binary. It needs no notion of
//      "chapter" or "scene" at all — resolution comes from how many
//      reach-units the book produced (hundreds to thousands, even for a
//      short play), not from how many structural boundaries a segmenter
//      found. This is what actually answers "is this an edge", replacing
//      both `cooccurrence.js::buildCooccurrenceEdges` (shared-segment
//      counting) and this driver's own post-hoc Monte Carlo chance
//      baseline — the significance is now per-edge and built in, not
//      approximated afterward.
//
// Direction and polarity (`emergence/binding.js`'s reversal null, transfer
// entropy) and verb-typed relations (`perceiver/text/relations.js` +
// `emergence/graph.js`'s belief graph, as `scripts/read-people.mjs` already
// assembles) are real, richer structure this reading could also carry —
// deliberately not scored here, because the four reference networks this
// golden checks against are themselves undirected, untyped co-occurrence
// counts and have no dimension to check direction or a verb against. Using
// them would be extracting MORE structure than this particular golden can
// verify, which is a future golden's job, not a reason to leave the
// structural link itself hand-rolled when a proper organ already exists for
// it.
//
// Usage: node goldens/network/read.mjs [--book <tag>]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openReading, arrive, witnessArrival, offerCandidates, carryEntities } from "../../packages/engine/referents/entity.js";
import { mergeAliasedEntities } from "../../packages/engine/referents/cooccurrence.js";
import { bindLinks } from "../../packages/engine/emergence/binding.js";
import { extractSurfaces, discoverReferents, diaNorm, normaliseSurface } from "../../packages/engine/perceiver/text/surfaces.js";
import { splitSentences } from "../../packages/engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../../packages/engine/perceiver/text/material.js";
import { isGap } from "../../nul/index.js";
import { parseLesMisJson, parseNodeEdgeCsv, parsePajekNet } from "./parsers.mjs";
import { stripPgBoilerplate } from "../shared/gutenberg.mjs";
import { bestMatch } from "../shared/fuzzy-match.mjs";
import { monteCarloChance } from "../shared/chance.mjs";
import { coverageFunnel } from "./coverage-funnel.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// Same numbers goldens/cast/read.mjs uses, with one exception (minArrivals)
// justified below — that calibration is proven and is not reopened here
// otherwise. atomsPerUnit stays the reach-unit's own clock; only WHICH
// surfaces get witnessed within it changed (see header).
//
// minArrivals=4, not cast's 6 — and NOT because 4 scored better against
// this golden's own reference networks. Checking that would leak the
// reference into calibration through the back door, the exact discipline
// goldens/cast's own README states plainly ("the engine never sees the
// reference — it is scored against it after the fact"). The justification
// is mechanical, from entity.js::admitFromArrivals alone: the witness gate
// (the actual Born-gated test — NUL, SIG, DEF, witness) needs a real early/
// late split of a candidate's own arrivals, `half = floor(at.length / 2)`,
// and refuses outright when `half < 2`. Below 4 arrivals there is no split
// to test at all — the Born gate itself cannot run, so any minArrivals
// under 4 is not a stricter admission standard, it is excluding candidates
// from a test that would refuse them anyway on the same mechanical grounds.
// 4 is the lowest value at which the Born gate — not a pre-filter standing
// in front of it — is what actually decides admission.
const SPEC = Object.freeze({ window: 8, draws: 99, reseeds: 8, minArrivals: 4, atomsPerUnit: 200, offerEvery: 60 });

// bindLinks' own declared numbers (never defaulted, per binding.js's own
// discipline) — separate from SPEC because they answer a different
// question (which PAIRS co-arrive significantly) over a different unit
// (reach-unit DISTANCE, not chapter identity). LINK_WINDOW=15 reach-units
// is ~3000 atoms at atomsPerUnit=200 — a few pages, wide enough that two
// characters in the same scene land inside it without requiring them to
// share a chapter boundary at all, which is what lets this resolve
// co-presence on a 44-chapter novel or a 25-scene play exactly as finely as
// on a 366-chapter one. LINK_DRAWS=199 matches conformance/binding.test.js's
// own convention for this organ.
const LINK_WINDOW = 15;
const LINK_DRAWS = 199;
const LINK_SEED = 20260812;
const LINK_ALPHA = 0.05; // displacement-null significance threshold for admitting an edge


// ── novel chapter segmentation ───────────────────────────────────────────────
//
// perceiver/text/segments.js's outlineOfIndex was tried first and rejected
// for this golden specifically: its heading form ("a sentence is not a
// heading") refuses "CHAPTER I." outright (Huckleberry Finn's own heading
// style — word, roman numeral, period, nothing else — ends in the same
// punctuation a sentence does, and the module has no way to tell those
// apart without knowing the word "CHAPTER"). That refusal is correct general
// policy; it just means a novel-chapter finder for THIS golden needs to be
// looser and purpose-built, the same way Shakespeare's scene finder below
// is purpose-built for that corpus's own tagged markup rather than reused
// from the shared module. segments.js itself is untouched.
//
// A candidate is any line starting "CHAPTER <roman|arabic|THE LAST>". Every
// one of the three novels' Gutenberg editions repeats this exact text in a
// table of contents, so a candidate only survives if real substance (>=300
// trimmed characters) stands between it and the next candidate — a listing
// entry, sitting shoulder to shoulder with the next TOC line, never clears
// that bar; a real chapter, with a chapter's worth of prose beneath it,
// always does. Measured against the three books' known chapter counts
// (365, 43, 64): this recovers 366/43(+1 phantom from a TOC-adjacent gap)/64
// — see goldens/network/README.md for the one known miscount.
const CHAPTER_RE = /^CHAPTER\s+([IVXLCDM]+|\d{1,3}|THE\s+LAST)\b/;
const CHAPTER_MIN_BODY = 300;

const novelChapters = (text) => {
  const lines = text.split("\n");
  const starts = new Array(lines.length);
  let at = 0;
  for (let i = 0; i < lines.length; i++) { starts[i] = at; at += lines[i].length + 1; }

  const candidates = [];
  for (let i = 0; i < lines.length; i++) if (CHAPTER_RE.test(lines[i].trim())) candidates.push(i);

  const segments = [];
  for (let i = 0; i < candidates.length; i++) {
    const fromLine = candidates[i] + 1;
    const toLine = i + 1 < candidates.length ? candidates[i + 1] : lines.length;
    let substance = 0;
    for (let k = fromLine; k < toLine; k++) substance += lines[k].trim().length;
    if (substance < CHAPTER_MIN_BODY) continue;
    segments.push(text.slice(starts[fromLine], toLine < lines.length ? starts[toLine] : at));
  }
  return segments;
};

// ── Shakespeare scene segmentation ───────────────────────────────────────────
//
// The Pseudomanifold/Shakespeare corpus is tagged markup, not prose: scene
// boundaries are literal `<SCENE n>` lines, and every other structural line
// (`<ACT n>`, speaker-attribution tags `<NAME>` / `</NAME>`, `<STAGE DIR>`
// blocks, bracketed scene-location captions) is wrapped start-to-end in a
// single pair of angle brackets. Spoken dialogue never is. So the whole
// extraction is one rule — a trimmed line that starts with "<" and ends
// with ">" is markup, everything else is spoken text — plus one boundary
// rule for where a new scene starts. This is FORM the same way segments.js's
// own heading detector is form, just a different corpus's form; it is kept
// here rather than folded into the shared module because it is specific to
// one tagged corpus's own markup convention, not a general prose heading.
//
// Deliberately excludes stage directions and speaker tags from the prose the
// engine reads — a character's own NAME as markup is not evidence the
// engine "read" it, only evidence the corpus's compiler knew who was
// speaking. Discovery has to come from what the play's words say.
const SCENE_BOUNDARY_RE = /^<(ACT|SCENE)\s+[\dIVXLCDM]+>$/;
const MARKUP_LINE_RE = /^<.*>$/;

const shakespeareScenes = (text) => {
  const lines = text.split("\n");
  const segments = [];
  let current = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (SCENE_BOUNDARY_RE.test(line)) {
      if (current.length) segments.push(current.join("\n"));
      current = [];
      continue;
    }
    if (MARKUP_LINE_RE.test(line)) continue;
    if (line) current.push(line);
  }
  if (current.length) segments.push(current.join("\n"));
  return segments;
};

// ── step 1+2: candidate discovery and referent coreference, over the whole
// book — a batch pass, and honestly one: extractSurfaces needs this book's
// own global capitalisation/function-word statistics to tell a name from a
// sentence-opener. This is candidate DISCOVERY, not admission — it decides
// which surfaces are even worth offering to entity.js's causal gate, never
// whether one clears it. The causal claim entity.js's own header makes
// ("nothing here can see forward") is about step 3, and step 3 still only
// ever sees one reach-unit at a time.

/**
 * Every candidate surface's occurrence, canonicalised to its referent id,
 * found in one stretch of text — the bridge from extractSurfaces'
 * AGGREGATE candidate list (counts, no positions) back to WHERE each
 * candidate actually occurs, which the causal reading needs to know which
 * reach-unit witnessed it. Tries the longest run (up to 4 tokens, matching
 * extractSurfaces' own run cap) at each token position, and — the bug this
 * comment used to claim was already handled and wasn't — ADVANCES PAST the
 * matched run's full length, not just one token. Advancing by 1 regardless
 * of match length let "Tom Sawyer" (matched at i, length 2) leave "Sawyer"
 * sitting at i+1 to be matched AGAIN on its own; measured on Huckleberry
 * Finn, "ref:auto:tom_sawyer" and "ref:auto:sawyer" carried byte-identical
 * arrival lists — the same textual occurrence witnessed twice under two
 * different referent ids, because discoverReferents did NOT merge these
 * two (their shared tokens were stripped as generic — see the driver's own
 * header on mergeAliasedEntities), so the double-witness was never
 * deduplicated the way the old comment assumed it would be.
 */
const WORD_TOKEN_RE = /[\p{L}][\p{L}\p{M}'’-]*/gu;
const occurrencesIn = (text, canonicalOf) => {
  const tokens = text.match(WORD_TOKEN_RE) ?? [];
  const found = [];
  for (let i = 0; i < tokens.length; ) {
    let matchedLen = 0;
    for (let len = Math.min(4, tokens.length - i); len >= 1; len--) {
      const run = tokens.slice(i, i + len).join(" ");
      const rid = canonicalOf.get(diaNorm(normaliseSurface(run)));
      if (rid) { found.push(rid); matchedLen = len; break; }
    }
    i += matchedLen || 1;
  }
  return found;
};

// ── the reading ───────────────────────────────────────────────────────────────

export const readBook = (text, book, spec = SPEC) => {
  const segments =
    book.kind === "novel" ? novelChapters(stripPgBoilerplate(text)) : shakespeareScenes(text);
  if (segments.length < 2) return { gap: "too_few_segments", found: segments.length };

  // Step 1: candidate surfaces, from this book's own statistics.
  let order = 0;
  const sentences = segments.flatMap((segText, segmentIndex) =>
    splitSentences(segText).map((s) => ({ ...s, order: order++, segmentIndex })),
  );
  if (sentences.length === 0) return { gap: "no_sentences" };

  const words = tokenize(segments.join("\n\n"));
  const functionWords = functionWordSet(buildFrequencyTable(words));
  const candidates = extractSurfaces(sentences, { functionWords, minGlyphs: 2 });
  if (candidates.length === 0) return { gap: "no_candidate_surfaces" };

  // Step 2: name-variant referent coreference over those candidates.
  const { events } = discoverReferents(candidates);
  if (events.length === 0) return { gap: "no_referents" };
  const canonicalOf = new Map(events.map((e) => [diaNorm(e.surface), e.referent_id]));
  // The most-mentioned spelling stands in for a referent id in output and
  // scoring — "ref:auto:tom_sawyer" is a stable key, not a display name.
  const displaySurfaceOf = new Map();
  for (const c of candidates) {
    const rid = canonicalOf.get(diaNorm(c.surface));
    if (!rid) continue;
    const prior = displaySurfaceOf.get(rid);
    if (!prior || c.mentions > prior.mentions) displaySurfaceOf.set(rid, c);
  }

  // Step 3: causal admission, unchanged — reach-units are still fixed
  // atomsPerUnit chunks, reset at every segment edge exactly as before;
  // the only difference from the atom-chunked driver this replaced is
  // WHICH surfaces get offered to witnessArrival.
  const state = openReading(spec);
  if (isGap(state)) return state;

  const segmentOfUnit = [];
  let pendingAtoms = [];
  let pendingReferents = [];
  let currentSegment = -1;

  const flush = () => {
    if (!pendingAtoms.length) return;
    arrive(state, pendingAtoms);
    segmentOfUnit[state.unit - 1] = currentSegment;
    for (const rid of new Set(pendingReferents)) witnessArrival(state, rid);
    if (spec.offerEvery > 0 && state.unit % spec.offerEvery === 0) offerCandidates(state);
    pendingAtoms = [];
    pendingReferents = [];
  };

  for (const sent of sentences) {
    if (sent.segmentIndex !== currentSegment) { flush(); currentSegment = sent.segmentIndex; }
    pendingAtoms.push(...tokenize(sent.text));
    pendingReferents.push(...occurrencesIn(sent.text, canonicalOf));
    if (pendingAtoms.length >= spec.atomsPerUnit) flush();
  }
  flush();
  offerCandidates(state);

  // Step 3.5: a second, complementary alias pass. discoverReferents (step 2)
  // merges by SPELLING and is conservative on purpose — a token that pairs
  // with many different partners across this book's own candidates
  // (measured: "tom" and "sawyer" both do, in Huckleberry Finn) is stripped
  // as generic before the coreference check runs, which is exactly right
  // for not merging every "Princess" into one person and exactly wrong for
  // "Tom Sawyer" and "Sawyer" alone, which ARE the same being and end up
  // admitted as two separate entities as a result. `mergeAliasedEntities`
  // catches what's left using arrival SHAPE (`consequence.js`) rather than
  // spelling — a different kind of evidence, asked only of the small set of
  // admitted entities that still share a token, never a spelling-based
  // decision pretending to be a behavioural one.
  const admitted = carryEntities(state);
  const register = mergeAliasedEntities(state, admitted, { nameOf: (e) => displayOf(e, displaySurfaceOf) });

  // Step 5: bindLinks — a real permutation-null significance test per pair,
  // over reach-unit arrival positions. No notion of "chapter" or "scene" is
  // needed here at all; resolution comes from how many reach-units the book
  // produced (state.unit — hundreds to thousands even for a short play),
  // never from how many structural boundaries the segmenter found. An edge
  // is admitted only where the observed co-arrival clears its own null at
  // LINK_ALPHA — the significance is now built into the extraction, not
  // approximated afterward against a pooled chance baseline.
  const { pairs, nulls } = bindLinks(register, { window: LINK_WINDOW, draws: LINK_DRAWS, seed: LINK_SEED });
  const edges = pairs
    .map((p) => {
      const key = `${p.a.id} ${p.b.id}`;
      const n = nulls.get(key);
      return { a: p.a.id, b: p.b.id, weight: p.overlap, pValue: n.pValue };
    })
    .filter((e) => e.pValue < LINK_ALPHA);

  const discovered = new Map();
  for (const event of events) discovered.set(event.referent_id, {
    id: event.referent_id,
    surface: displaySurfaceOf.get(event.referent_id)?.surface ?? event.surface,
    arrivals: state.arrivals.get(event.referent_id) ?? [],
    refusal: state.refused.get(event.referent_id) ?? null,
  });

  return {
    segments: segments.length,
    units: state.unit,
    candidateSurfaces: candidates.length,
    referents: events.length,
    register,
    edges,
    displaySurfaceOf,
    // Frozen pre-verdict material for a post-reading coverage audit. Nothing
    // here has seen the reference network; the golden may inspect it only
    // after the reading has ended.
    discovered: [...discovered.values()],
    pairs,
  };
};

// ── scoring against the frozen third-party network ───────────────────────────

export const loadGroundTruth = (gt) => {
  if (gt.format === "lesmis-json") return parseLesMisJson(join(HERE, "refs", gt.path));
  if (gt.format === "node-edge-csv") return parseNodeEdgeCsv(join(HERE, "refs", gt.nodes), join(HERE, "refs", gt.edges));
  if (gt.format === "pajek") return parsePajekNet(join(HERE, "refs", gt.speech)); // speech-based, the primary variant scored
  throw new Error(`unknown ground truth format: ${gt.format}`);
};

/**
 * For every discovered entity, the reference name it fuzzy-matches — tried
 * against the entity's DISPLAY surface (the most-mentioned real spelling
 * `discoverReferents` clustered under this entity's referent id), not the
 * id itself, which is a stable key ("ref:auto:tom_sawyer"), not a name.
 * Alias fragmentation (the same real character split across two admitted
 * entities) is now mostly handled upstream by discoverReferents' own
 * name-variant coreference — what's left here is only what that coreference
 * genuinely cannot see: descriptor synonymy and epithets, explicitly out of
 * scope for an engine-tier organ (surfaces.js's own header names this the
 * MODEL-tier gap).
 */
/** The best human-readable name for an (possibly merged) entity: the
 * highest-mention display surface among every referent id it carries. */
export const displayOf = (entity, displaySurfaceOf) => {
  let best = null;
  for (const rid of entity.surfaces) {
    const c = displaySurfaceOf.get(rid);
    if (c && (!best || c.mentions > best.mentions)) best = c;
  }
  return best?.surface ?? entity.surfaces[0];
};

const buildSurfaceToRef = (register, refNodes, displaySurfaceOf) => {
  const map = new Map();
  for (const e of register) {
    const display = displayOf(e, displaySurfaceOf);
    const hit = bestMatch(display, refNodes);
    if (hit) map.set(e.id, hit);
  }
  return map;
};

export const score = (register, edges, ref, displaySurfaceOf) => {
  const surfaceToRef = buildSurfaceToRef(register, ref.nodes, displaySurfaceOf);
  const entityHits = new Set(surfaceToRef.values());
  const entityRecall = ref.nodes.length ? entityHits.size / ref.nodes.length : 0;

  // Only an edge between two entities that BOTH matched some reference name
  // could ever land on a reference edge. At chapter/scene grain the register
  // is dominated by closed-class and dialect surfaces recurring across most
  // of the book (the same admission contamination goldens/cast/read.mjs's
  // own comments document — louder here because there are only tens of
  // structural units to arrive in, not thousands of atom-chunks). Folding
  // those noise-noise edges into precision or the chance baseline's
  // denominator would make both numbers describe the wrong graph; a
  // candidate edge is one where the noise has already been excluded by the
  // name match, so what is left to score is honestly "of the character-to-
  // character edges the reader proposed, how many are real".
  const refEdgeKey = new Set(ref.edges.map((e) => [e.a, e.b].sort().join("␟")));
  const candidateEdges = edges.filter(
    (e) => surfaceToRef.has(e.a) && surfaceToRef.has(e.b) && surfaceToRef.get(e.a) !== surfaceToRef.get(e.b),
  );
  let edgeHits = 0;
  const matchedEdges = [];
  for (const e of candidateEdges) {
    const ra = surfaceToRef.get(e.a);
    const rb = surfaceToRef.get(e.b);
    const key = [ra, rb].sort().join("␟");
    if (refEdgeKey.has(key)) { edgeHits++; matchedEdges.push({ a: ra, b: rb, weight: e.weight }); }
  }

  const edgeRecall = ref.edges.length ? edgeHits / ref.edges.length : 0;
  const edgePrecision = candidateEdges.length ? edgeHits / candidateEdges.length : 0;

  // Chance baseline: draw `candidateEdges.length` random pairs from the
  // SAME pool candidate edges are drawn from — pairs of reference-matched
  // entities — and ask how many would land on a reference edge by luck
  // alone. hitProb is the base rate WITHIN that specific pool: of the pairs
  // possible among the entities this reading actually matched, how many are
  // real reference edges — never `ref.edges.length` itself, which counts
  // edges over all `ref.nodes.length` reference characters and is not a
  // probability once the matched pool is smaller than the reference cast
  // (drawing `ref.edges.length / poolPairs` regularly exceeds 1 there).
  const matchedNames = [...entityHits];
  let refEdgesAmongMatched = 0;
  for (let i = 0; i < matchedNames.length; i++)
    for (let j = i + 1; j < matchedNames.length; j++)
      if (refEdgeKey.has([matchedNames[i], matchedNames[j]].sort().join("␟"))) refEdgesAmongMatched++;
  const matchedPairPool = (entityHits.size * (entityHits.size - 1)) / 2;
  const edgeChance = monteCarloChance({
    trials: 400,
    drawSize: candidateEdges.length,
    hitProb: matchedPairPool > 0 ? refEdgesAmongMatched / matchedPairPool : 0,
  });

  return {
    registerSize: register.length,
    referenceNodes: ref.nodes.length,
    entityHits: entityHits.size,
    entityRecall,
    edgesFoundTotal: edges.length,
    candidateEdges: candidateEdges.length,
    referenceEdges: ref.edges.length,
    edgeHits,
    edgeRecall,
    edgePrecision,
    edgeChance,
    matchedEdges: matchedEdges.slice(0, 20),
  };
};

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const book = args.includes("--book") ? args[args.indexOf("--book") + 1] : null;

  const MANIFEST = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
  mkdirSync(join(HERE, "read"), { recursive: true });

  for (const b of MANIFEST.books) {
    if (book && b.tag !== book) continue;
    const textPath = join(HERE, "texts", b.text);
    if (!existsSync(textPath)) { console.log(`${b.tag.padEnd(34)} GAP no_text`); continue; }

    const text = readFileSync(textPath, "utf8");
    const t0 = process.hrtime.bigint();
    const r = readBook(text, b);
    if (r.gap) { console.log(`${b.tag.padEnd(34)} GAP ${r.gap}`); continue; }
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;

    const ref = loadGroundTruth(b.groundTruth);
    const s = score(r.register, r.edges, ref, r.displaySurfaceOf);
    const funnel = coverageFunnel({
      discovered: r.discovered, register: r.register, pairs: r.pairs, edges: r.edges, ref,
      displayOf: (entity) => displayOf(entity, r.displaySurfaceOf),
    });

    writeFileSync(
      join(HERE, "read", `${b.tag}.read.json`),
      JSON.stringify({
        tag: b.tag, kind: b.kind, spec: SPEC, segments: r.segments, units: r.units,
        candidateSurfaces: r.candidateSurfaces, referents: r.referents,
        score: s, coverageFunnel: funnel, edges: r.edges,
        register: r.register.map((e) => ({
          id: e.id, referentIds: e.surfaces, surface: displayOf(e, r.displaySurfaceOf),
          mergedFrom: e.mergedFrom, bornAt: e.bornAt,
        })),
      }, null, 2),
      "utf8",
    );

    console.log(
      `${b.tag.padEnd(34)} seg=${String(r.segments).padStart(4)} born=${String(r.register.length).padStart(4)}  ` +
      `entities=${s.entityHits}/${s.referenceNodes}  edges=${s.edgeHits}/${s.referenceEdges} (of ${s.candidateEdges} candidates, ${s.edgesFoundTotal} raw)  ` +
      `chance(p95=${s.edgeChance.p95}, max=${s.edgeChance.max})  ${secs.toFixed(1)}s`,
    );
  }
}

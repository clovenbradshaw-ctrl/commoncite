// eoreader6 · packages/host/population — A POPULATION, READ FROM SEGMENTED
// MATERIAL: who is in this, and which of them genuinely co-arrive.
//
// This is `goldens/network/read.mjs`'s reading, moved here unchanged, minus
// the one thing that was never corpus-independent: how the material gets cut
// into segments. That stays with the caller, because a segment boundary is a
// claim about a particular corpus's own form (`novelChapters` knows Project
// Gutenberg's "CHAPTER I." convention; `shakespeareScenes` knows one tagged
// play corpus's markup) and the host has no business holding an opinion about
// either. Everything after the cut is the same for a novel, a play, a court
// docket, or a chat log, and that everything is what lives here.
//
// The chain, in the order a reading actually needs it — each step an organ
// that already existed, none of them re-implemented here:
//
//   1. perceiver/text/surfaces.js::extractSurfaces — candidate referent
//      surfaces, from the material's own statistics (a capitalisation
//      significance test against this material's own function-word
//      distribution).
//   2. perceiver/text/surfaces.js::discoverReferents — name-variant
//      coreference over those candidates. "Valjean" and "Jean Valjean"
//      become ONE referent id before entity.js sees either spelling.
//   3. referents/entity.js — causal admission through the Born gate. Nothing
//      here can see forward; the reading only ever holds one reach-unit.
//   4. referents/cooccurrence.js::mergeAliasedEntities — a second alias pass
//      over what step 3 admitted, by arrival SHAPE rather than spelling, for
//      exactly the cases step 2's spelling merge is conservative about on
//      purpose.
//   5. emergence/binding.js::bindLinks — a permutation-null significance test
//      PER PAIR over the reading's own reach-unit arrival positions. This is
//      what answers "is this an edge". It needs no notion of chapter or scene
//      at all: resolution comes from how many reach-units the material
//      produced, never from how many boundaries the segmenter found — which
//      is why a 25-scene play resolves as well as a 366-chapter novel.
//
// It mints no measurement of its own, so it declares no cell: every act in it
// belongs to an organ that already declares one. It is a composition, and the
// only thing it adds is the ORDER.
//
// RECONCILIATION IS DEFERRED, AND DELIBERATELY SO. CLAUDE.md's own rule says a
// deduplication that leaves two copies standing is not finished, and this one
// is not: `goldens/network/read.mjs` still carries the original body. Rewiring
// it to call this module was written and then reverted, because the golden's
// score is pinned by `conformance/cooccurrence.test.js` and that test SKIPS in
// any checkout without `goldens/network/texts/` (gitignored; the fetch needs
// gutenberg.org, which this environment's proxy refuses). Shipping an
// unverifiable edit to a proven artifact is worse than carrying a duplicate
// that is known about and written down.
//
// What IS established: a differential run over a synthetic 60-chapter corpus
// — one built to clear entity.js's witness gate, which a uniform fixture does
// not — returns byte-identical `segments`, `units`, `candidateSurfaces`,
// `referents`, `register`, `edges` and `displaySurfaceOf` from both paths. So
// the move itself is proven; only its effect on the four real reference
// networks is unmeasured. Finish this in a checkout that can run the golden.
//
// Callers: the EO workbench's population reading. `goldens/network/read.mjs`
// should join them once the above can be checked.

import { openReading, arrive, witnessArrival, offerCandidates, carryEntities } from "../engine/referents/entity.js";
import { mergeAliasedEntities } from "../engine/referents/cooccurrence.js";
import { bindLinks } from "../engine/emergence/binding.js";
import { extractSurfaces, discoverReferents, diaNorm, normaliseSurface } from "../engine/perceiver/text/surfaces.js";
import { splitSentences } from "../engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../engine/perceiver/text/material.js";
import { isGap } from "../../nul/index.js";

/**
 * The admission spec `goldens/network/read.mjs` proved, kept here as the
 * default so a caller that has no reason of its own to differ does not have
 * to invent one. `minArrivals: 4` is NOT an empirical pick: entity.js's
 * `admitFromArrivals` needs a real early/late split of a candidate's own
 * arrivals (`half = floor(at.length / 2)`) and refuses outright when
 * `half < 2`, so below 4 arrivals the Born gate cannot run at all. 4 is the
 * lowest value at which that gate — not a pre-filter standing in front of it
 * — is what decides admission.
 */
export const POPULATION_SPEC = Object.freeze({
  window: 8,
  draws: 99,
  reseeds: 8,
  minArrivals: 4,
  atomsPerUnit: 200,
  offerEvery: 60,
});

/**
 * bindLinks' own declared numbers, separate from POPULATION_SPEC because they
 * answer a different question (which PAIRS co-arrive significantly) over a
 * different unit (reach-unit DISTANCE, not segment identity). `window: 15`
 * reach-units is ~3000 atoms at atomsPerUnit 200 — a few pages, wide enough
 * that two beings in the same scene land inside it without having to share a
 * segment boundary. `draws: 199` matches conformance/binding.test.js's own
 * convention for this organ. `alpha` is the displacement-null significance
 * threshold below which an edge is admitted.
 */
export const LINK_SPEC = Object.freeze({ window: 15, draws: 199, seed: 20260812, alpha: 0.05 });

// The separator `bindLinks` keys its `nulls` map by — emergence/binding.js
// writes it as an escape. Built here rather than typed as a raw NUL byte,
// which is what made goldens/network/read.mjs register as a binary file to
// git and drop out of every grep run over this repo.
const NULL_KEY_SEP = String.fromCharCode(0);

/**
 * Every candidate surface's occurrence, canonicalised to its referent id,
 * found in one stretch of text — the bridge from extractSurfaces' AGGREGATE
 * candidate list (counts, no positions) back to WHERE each candidate actually
 * occurs, which the causal reading needs to know which reach-unit witnessed
 * it. Tries the longest run (up to 4 tokens, matching extractSurfaces' own
 * run cap) at each token position, and ADVANCES PAST the matched run's full
 * length, not just one token: advancing by 1 regardless of match length let
 * "Tom Sawyer" (matched at i, length 2) leave "Sawyer" sitting at i+1 to be
 * matched AGAIN on its own, so one textual occurrence was witnessed twice
 * under two referent ids.
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

/**
 * The best human-readable name for a (possibly merged) entity: the
 * highest-mention display surface among every referent id it carries. An
 * entity's own `id` is a stable key ("ref:auto:tom_sawyer"), never a name.
 */
export const displayOf = (entity, displaySurfaceOf) => {
  let best = null;
  for (const rid of entity.surfaces) {
    const c = displaySurfaceOf.get(rid);
    if (c && (!best || c.mentions > best.mentions)) best = c;
  }
  return best?.surface ?? entity.surfaces[0];
};

/**
 * Read a population out of already-segmented material.
 *
 * `segments` is an array of text stretches, in reading order — the caller's
 * cut, never this module's. Two or more are required: reach-units reset at
 * every segment edge, and a single segment gives the arrival series no
 * structure to reset against.
 *
 * Returns the reading, or a typed gap:
 *   too_few_segments      fewer than 2 segments were handed in
 *   no_sentences          the segments carry no sentence the perceiver can see
 *   no_candidate_surfaces nothing in the material passed the capitalisation
 *                         significance test — no proper-noun-shaped surface
 *   no_referents          candidates were found but none corefer into a referent
 *   (or entity.js's own gap, passed through unchanged from openReading)
 */
export const readPopulation = (segments, { spec = POPULATION_SPEC, linkSpec = LINK_SPEC } = {}) => {
  if (!Array.isArray(segments) || segments.length < 2)
    return { gap: "too_few_segments", found: Array.isArray(segments) ? segments.length : 0 };

  // Step 1: candidate surfaces, from this material's own statistics.
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

  // Step 3: causal admission. Reach-units are fixed atomsPerUnit chunks,
  // reset at every segment edge.
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
  // with many different partners across this material's own candidates
  // (measured: "tom" and "sawyer" both do, in Huckleberry Finn) is stripped
  // as generic before the coreference check runs, which is exactly right for
  // not merging every "Princess" into one person and exactly wrong for "Tom
  // Sawyer" and "Sawyer" alone, which ARE the same being and end up admitted
  // as two separate entities as a result. `mergeAliasedEntities` catches
  // what's left using arrival SHAPE (`consequence.js`) rather than spelling —
  // a different kind of evidence, asked only of the small set of admitted
  // entities that still share a token, never a spelling-based decision
  // pretending to be a behavioural one.
  const admitted = carryEntities(state);
  const register = mergeAliasedEntities(state, admitted, { nameOf: (e) => displayOf(e, displaySurfaceOf) });

  // Step 5: bindLinks — a permutation-null significance test per pair, over
  // reach-unit arrival positions. An edge is admitted only where the observed
  // co-arrival clears its own null at linkSpec.alpha; the significance is
  // built into the extraction, never approximated afterward against a pooled
  // chance baseline.
  const { pairs, nulls } = bindLinks(register, { window: linkSpec.window, draws: linkSpec.draws, seed: linkSpec.seed });
  const edges = pairs
    .map((p) => {
      const key = `${p.a.id}${NULL_KEY_SEP}${p.b.id}`;
      const n = nulls.get(key);
      return { a: p.a.id, b: p.b.id, weight: p.overlap, pValue: n.pValue };
    })
    .filter((e) => e.pValue < linkSpec.alpha);

  return {
    segments: segments.length,
    units: state.unit,
    candidateSurfaces: candidates.length,
    referents: events.length,
    register,
    edges,
    displaySurfaceOf,
  };
};

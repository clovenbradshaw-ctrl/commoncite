// eoreader6 · perceiver/text/pronouns — binding a THIRD-PERSON SINGULAR
// pronoun to a referent BY ACTIVATION, never by nearest name.
//
// surfaces.js's own gap says this plainly: pronoun binding is MODEL tier,
// "not derivable... eoreader5 measured distributional coref failing twice
// (frame-level lift, sentence-level complementary distribution)." Both of
// those attempts asked a WHOLE-DOCUMENT question after the fact — which
// other passage does this one resemble, scored against a vocabulary the
// entire text had already supplied. That is exactly the leak
// emergence/activation.js was built to close for motif recall: a
// whole-document table conditions every score on pages the reader has not
// reached. So this does not invent a second mechanism. It reuses the first
// one (codeOf / recall / encodeFrame, imported whole, never re-derived) and
// asks it a narrower, causal question: given only what has been read so far,
// which NAMED referent's own sentences does THIS sentence's vocabulary most
// resemble, by one recurrent hop?
//
// A referent's own surface, once discoverReferents has admitted it
// (name-variant coreference — engine-tier and already complete, surfaces.js),
// is exactly as good a fact about a sentence as any distinctive recurring
// word: the sentence that carries it is tagged with the referent it named,
// and later, a sentence that shares the FIRST sentence's vocabulary — not its
// name, which is exactly what a pronoun sentence lacks — recalls it by the
// same one-hop completion the rest of this engine already trusts for motifs.
//
// WHAT THIS DOES NOT CLOSE. Descriptor synonymy ("the creature" ≈ "the
// wretch") is untouched — nothing here reads definite descriptions, and
// surfaces.js's gap stands for that half unchanged. Number-ambiguous
// pronouns ("they"/"them"/"their") are out of scope too: singular-or-plural
// is not decidable from the pronoun alone (priors.js::THIRD_PERSON_SINGULAR's
// own header), and guessing one over the other here would be exactly the
// fabrication this codebase refuses everywhere else. A pronoun sharing its
// sentence with a named surface is also left alone — disambiguating which of
// several co-mentioned referents a pronoun in the SAME clause points at is a
// harder, different problem, and this only ever answers the case the
// original complaint names: a scene carried by "he" with no name anywhere
// in it.
//
// WHAT THIS MEASURES, AND WHAT IT REFUSES TO ASSUME. A pronoun's sentence is
// bound to a referent only when its one-hop recall against the referents
// named so far clears TWO declared bars: an absolute floor (`minActivation`
// — some real echo, not a rounding artefact) and a margin over the runner-up
// (`minMargin` — a decision, not a coin flip between two near-equal
// candidates). Both are declared by the caller, never defaulted here — the
// same standing entity.js's `minArrivals` and kind-void.js's `draws`/`seed`
// already hold: how much activation makes a binding is a property of the
// reading, not a constant this file gets to assume for every caller's
// material. Short of either bar, the pronoun is reported unresolved — a
// typed gap, never a guess dressed as a number.
//
// GENDER IS A HARD FILTER, NEVER A TIEBREAKER, AND IT IS DERIVED, NOT TYPED
// IN. No name list, no honorific table: a referent's gender class is read
// off which gendered pronoun co-occurs with ITS OWN named mentions (a clean
// signal only when exactly one referent is named in that sentence AND the
// pronoun sits in the SAME CLAUSE as that naming — a pronoun beside two
// co-mentioned names is not clean evidence for either, and neither is a
// pronoun beside a name that is only along for the ride in a different
// clause of the same sentence). A referent with no such evidence is never
// excluded by gender; one with clear, contrary evidence always is.
//
// "SAME SENTENCE" WAS TOO WIDE A NET, MEASURED. A wire-service attribution
// clause — "...because none of the organizations contacted by Continental
// Newswire appeared to know who she was" — puts a narrating apparatus as
// the sentence's only literally-named surface while "she" grammatically
// refers to someone this sentence never names at all. Same-sentence
// co-occurrence alone reads that as clean evidence and wrongly tags the
// apparatus female; once tagged, it passes the hard filter below for every
// later she/her pronoun and out-recalls a quietly-named real subject on
// raw activation volume alone (its own name recurs in nearly every
// sentence). Measured on a hand-authored adversarial fixture: 6/6 of a
// quiet subject's own she/her pronouns stolen by a wire-service apparatus
// this way (scripts/adversarial/challenge-23-apparatus-demotion-regression-npr-bug-cl.mjs).
// Clause-locality is the same discipline every other binding decision in
// this file already applies (one-hop recall, not whole-document lift) —
// tightened to the syntactic domain the heuristic's own header always meant:
// a pronoun and the name it echoes belong to the same clause, not merely
// the same sentence. `CLAUSE_OPENER_RE` is a small CLOSED grammatical
// class (English subordinators and relative pronouns), not a sampled
// open-class vocabulary — the same kind of hardcoded closed set this file
// already keeps for THIRD_PERSON_SINGULAR itself; closed classes don't grow,
// which is exactly what made relations.js's hand verb list wrong and is
// exactly what makes this list safe.

import { tokens, codeOf, recall, encodeFrame } from "../../emergence/activation.js";
import { THIRD_PERSON_SINGULAR } from "./priors.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// CON · Link · Binding — a pronoun bound to a referent by one-hop recall,
// the same cell activation.js's own readForward and referents/index.js's
// projectReferents already occupy: binding a passage to the structure it
// belongs with. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "CON", grain: "Figure" });

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Longest-surface-first, whole-form matching — the same boundary rule
// host/corpus.js::occurrenceMatcher and relations.js's SURFACE_RE already
// use, so "Victor Frankenstein" claims its sentence over "Victor" alone, and
// a matched possessive clitic ("Victor's") is recognised without being
// double-counted as a second surface.
const surfaceMatcher = (surfaces) => {
  const uniq = [...new Set(surfaces.filter(Boolean).map(String))].sort((a, b) => b.length - a.length);
  if (!uniq.length) return null;
  const alts = uniq.map(escapeRe).join("|");
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})(?:['’]s?)?(?![\\p{L}\\p{N}])`, "gu");
};

// Returns every (referent, index) a surface was matched at, not just the
// deduplicated set — gender-evidence collection below needs the POSITION of
// the naming, not only which referent was named, to test clause-locality
// against a co-occurring pronoun.
const namedMatchesIn = (text, matcher, surfaceToReferent) => {
  const matches = [];
  if (!matcher) return matches;
  matcher.lastIndex = 0;
  let m;
  while ((m = matcher.exec(text))) {
    const bare = m[0].replace(/['’]s?$/i, "");
    const ref = surfaceToReferent.get(bare) ?? surfaceToReferent.get(m[0]);
    if (ref) matches.push({ ref, index: m.index });
  }
  return matches;
};

// A small, CLOSED grammatical class — English subordinators and relative
// pronouns that open a new clause. Not a sampled open-class vocabulary (see
// the section header above): this list cannot grow the way a verb list
// would, because it is the whole closed set, not a sample of one.
// "to" is included as the non-finite counterpart of the finite
// complementizers above — "declined ... to make her available" opens a
// to-infinitive clause exactly the way "declined ... that she be made
// available" would open a finite one with "that". Same phenomenon
// (subordinate-clause introduction), different, still-closed realization.
const CLAUSE_OPENER_RE = /\b(?:that|which|who|whom|whose|because|although|though|while|when|whether|unless|since|before|after|until|if|to)\b/i;

// True only when the stretch of TEXT strictly between two positions carries
// no clause boundary: no comma/semicolon/colon/quotation mark, and no
// subordinator or relative pronoun opening a new clause. Order-independent —
// callers pass a naming index and a pronoun index in whichever order they
// occur.
const sameClause = (text, i, j) => {
  const [lo, hi] = i <= j ? [i, j] : [j, i];
  const between = text.slice(lo, hi);
  if (/[,;:"“”]/.test(between)) return false;
  return !CLAUSE_OPENER_RE.test(between);
};

const PRONOUN_RE = /\b(he|him|his|himself|she|her|hers|herself)\b/gi;

const findThirdPersonSingular = (text) => {
  const hits = [];
  for (const m of text.matchAll(PRONOUN_RE)) {
    const token = m[0].toLowerCase();
    hits.push({ token, gender: THIRD_PERSON_SINGULAR[token], index: m.index });
  }
  return hits;
};

// Activation.js's own declared operating point (IDF_FLOOR, MIN_LEN inside
// activation.js) is not exported, so the encode/recall calls below leave
// `idfFloor`/`minLen` undefined when the caller does not override them —
// `codeOf`'s own default parameters apply, exactly as they do for every other
// caller of `codeOf`. `completion`/`topEdges`/`edgeSlots` DO need concrete
// numbers at this call site (readForward's own defaults are internal to that
// function, not exported constants), so the values here are readForward's
// own declared defaults, restated rather than reinvented.
const DEFAULT_COMPLETION = 0.5;
const DEFAULT_TOP_EDGES = 6;
const DEFAULT_EDGE_SLOTS = 24;

/**
 * Bind third-person singular pronouns to a referent by one-hop activation
 * recall over the cast `discoverReferents` already admitted.
 *
 * @param {Array<{text: string, offset: number, order: number}>} sentences
 *   sentence-level frames in reading order (spans.js::splitSentences).
 * @param {Map<string,string>|Record<string,string>} referentSurfaces surface
 *   -> referentId, e.g. built from discoverReferents(...).events' DEF.admit
 *   records. Name-variant coreference is engine-tier and already complete;
 *   this file adds no surfaces of its own to that map.
 * @param {object} options
 * @param {number} options.minActivation declared floor a candidate's recall
 *   must clear. Never defaulted: how much echo counts as real is a property
 *   of the reading, not a constant this file assumes for every caller.
 * @param {number} options.minMargin declared lead the top candidate must hold
 *   over the runner-up, as a fraction of the top score. Never defaulted, for
 *   the same reason.
 * @returns {{bindings: Array<object>, gaps: Array<object>}} every resolved
 *   pronoun mention, and every one that was not — a gap is a result.
 */
export const resolvePronouns = (
  sentences,
  referentSurfaces,
  {
    minActivation,
    minMargin,
    idfFloor,
    minLen,
    completion = DEFAULT_COMPLETION,
    topEdges = DEFAULT_TOP_EDGES,
    edgeSlots = DEFAULT_EDGE_SLOTS,
    // Referent ids the CALLER already knows are not persons — an
    // organisation, a narrating apparatus, anything typed outside the range
    // a third-person-singular personal pronoun could ever legitimately
    // point at. Never derived here (this file has no notion of
    // individuation type); received exactly the way minActivation/minMargin
    // are, on the same terms host/corpus.js's own comment already states
    // for individuation generally: "the caller sees [it] and applies its
    // own policy." Treated as a hard filter alongside gender, not a
    // tiebreak — the same discipline gender already gets.
    nonPersonal,
  } = {},
) => {
  if (!Number.isFinite(minActivation) || minActivation < 0)
    throw new TypeError("resolvePronouns: minActivation is declared — how much recall counts as a real echo is never a default");
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 1)
    throw new TypeError("resolvePronouns: minMargin is declared — how far a candidate must lead the runner-up is never a default");

  const nonPersonalSet = nonPersonal instanceof Set ? nonPersonal : new Set(nonPersonal ?? []);
  const surfaceToReferent = referentSurfaces instanceof Map ? referentSurfaces : new Map(Object.entries(referentSurfaces ?? {}));
  const matcher = surfaceMatcher([...surfaceToReferent.keys()]);

  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 };
  const namedByFrame = new Map(); // sentence order -> Set(referentId) named in it
  const genderEvidence = new Map(); // referentId -> { m, f }

  const bindings = [];
  const gaps = [];

  const referentGender = (r) => {
    const ev = genderEvidence.get(r);
    if (!ev) return "unknown";
    if (ev.m > 0 && ev.f === 0) return "m";
    if (ev.f > 0 && ev.m === 0) return "f";
    return "unknown"; // no evidence, or genuinely contested — never guessed
  };

  for (const sentence of sentences ?? []) {
    const ws = tokens(sentence.text);
    const { trace, cue } = codeOf(ws, state, { minLen, idfFloor });

    const namedMatches = namedMatchesIn(sentence.text, matcher, surfaceToReferent);
    const named = new Set(namedMatches.map((n) => n.ref));
    const pronounHits = findThirdPersonSingular(sentence.text);

    // Resolve only the case the original complaint names: a sentence carried
    // by a pronoun with NO name anywhere in it. A pronoun sharing its
    // sentence with a named surface is left to whatever the name already
    // establishes — this file does not adjudicate between co-mentioned names.
    if (named.size === 0 && pronounHits.length > 0) {
      const activation = recall(cue, state, { completion, topEdges, selfOrder: sentence.order });
      // BEST single hop, not a sum across every hop — the same discipline
      // activation.js's own `recall`/rerank pairing already keeps
      // (rerank's own `top: scored[0]`, its header: "which of them placed
      // something the other did not," never a running total). This file's
      // header calls the mechanism "one recurrent hop" and "one-hop
      // activation recall," singular, for the same reason: summing a
      // referent's credit across every frame that happens to name it lets a
      // referent recalled from MANY weak, incidental frames (a byline
      // stapled onto nearly every sentence) outscore one recalled from a
      // FEW strong, specific frames — rewarding ubiquity of naming, not
      // strength of resemblance. Measured: without this, a quiet real
      // subject's own she/her pronouns lost 6/6 to a narrating apparatus
      // whose name recurred in nearly every frame, even after the
      // same-clause gender fix above closed the mistagging path
      // (scripts/adversarial/challenge-23-apparatus-demotion-regression-npr-bug-cl.mjs).
      const referentScore = new Map();
      for (const [order, amt] of activation) {
        const refs = namedByFrame.get(order);
        if (!refs) continue;
        for (const r of refs) {
          if (amt > (referentScore.get(r) ?? -Infinity)) referentScore.set(r, amt);
        }
      }

      for (const hit of pronounHits) {
        const offset = (sentence.offset ?? 0) + hit.index;
        const candidates = [...referentScore.entries()]
          .filter(([r]) => !nonPersonalSet.has(r))
          .filter(([r]) => {
            const g = referentGender(r);
            return g === "unknown" || g === hit.gender;
          })
          .sort((a, b) => b[1] - a[1]);

        if (candidates.length === 0) {
          gaps.push({
            reason: "pronoun_no_candidate",
            tier: "engine",
            sentenceOrder: sentence.order,
            offset,
            pronoun: hit.token,
            detail: "no gender-compatible referent has been named and activated yet — nothing here to bind to",
          });
          continue;
        }

        const [topRef, topScore] = candidates[0];
        if (topScore < minActivation) {
          gaps.push({
            reason: "pronoun_below_floor",
            tier: "engine",
            sentenceOrder: sentence.order,
            offset,
            pronoun: hit.token,
            top: topRef,
            activation: topScore,
            detail: `top candidate's recall (${topScore.toFixed(3)}) does not clear minActivation (${minActivation})`,
          });
          continue;
        }

        const second = candidates[1]?.[1] ?? 0;
        const margin = topScore > 0 ? (topScore - second) / topScore : 0;
        if (margin < minMargin) {
          gaps.push({
            reason: "pronoun_no_margin",
            tier: "engine",
            sentenceOrder: sentence.order,
            offset,
            pronoun: hit.token,
            top: topRef,
            runnerUp: candidates[1]?.[0] ?? null,
            margin,
            detail: `top candidate leads the runner-up by only ${(margin * 100).toFixed(1)}%, short of minMargin (${(minMargin * 100).toFixed(1)}%)`,
          });
          continue;
        }

        bindings.push({
          referentId: topRef,
          sentenceOrder: sentence.order,
          offset,
          pronoun: hit.token,
          gender: hit.gender,
          activation: topScore,
          margin,
          provenance: {
            giver: "perceiver/text/pronouns::resolvePronouns",
            tier: "engine",
            basis: "one-hop activation recall over the already-admitted cast",
          },
        });
      }
    }

    // Gender evidence: only when exactly one referent is named alongside a
    // pronoun in the SAME sentence, AND that pronoun sits in the same
    // clause as (at least one occurrence of) the naming — the one case
    // where the signal is actually clean. Same sentence alone is not enough
    // (see the section header above): an attribution clause can put the
    // sentence's only literally-named surface nowhere near the clause the
    // pronoun's antecedent actually lives in. Causal: this only ever
    // informs LATER sentences' candidate filtering, never the one it was
    // read from.
    if (named.size === 1 && pronounHits.length > 0) {
      const [only] = named;
      const spansForOnly = namedMatches.filter((n) => n.ref === only).map((n) => n.index);
      const ev = genderEvidence.get(only) ?? { m: 0, f: 0 };
      for (const hit of pronounHits) {
        if (spansForOnly.some((idx) => sameClause(sentence.text, idx, hit.index))) ev[hit.gender]++;
      }
      genderEvidence.set(only, ev);
    }

    namedByFrame.set(sentence.order, named);
    encodeFrame(state, sentence.order, ws, trace, { edgeSlots });
  }

  return { bindings, gaps };
};

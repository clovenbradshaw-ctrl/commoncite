// eoreader6 · induction/candidates — finds candidate modifier stacks in raw
// text with no lexicon, no POS tagger, and no assumed language — a
// distributional census of a corpus's own token frequencies, re-earning
// the principle the legacy eoreader4.2 lineage's modifier-law.js already
// demonstrated ("a word that predominantly stands before the noun... the
// tell is emergent and model-free: a distributional census of THIS
// document — not a lexicon"), built fresh here rather than ported
// (Article I.2: nothing is ported from legacy; every organ is re-earned).
//
// THE HONEST LIMIT, STATED PLAINLY: telling anchor (head) words, modifier
// words, and function words apart with no POS tagger is unsupervised part-
// of-speech induction — a real, decades-old open problem in computational
// linguistics, not something this module claims to solve. What it does
// instead is a much narrower, defensible thing: Zipf's law already gives a
// real, measured three-way frequency split in almost any corpus of natural
// language — a small number of extremely frequent function words ("the",
// "and", "a"), a larger band of moderately-frequent content words (most
// nouns and adjectives), and a long tail of rare ones with too little
// recurrence to say anything about statistically. This module uses exactly
// that split — nothing lexical, nothing per-language — and nothing more:
//
//   ABOVE maxAnchorFrequency   excluded — almost certainly function words
//   BETWEEN the two bounds     candidate anchors AND candidate modifiers
//                              (the same token can serve as either, in
//                              different occurrences — that's realistic,
//                              not a bug)
//   BELOW minAnchorFrequency   excluded — too rare for statistics to say
//                              anything about
//
// Both bounds are declared by the caller, never defaulted (SEED.md's own
// discipline) — they depend on corpus size and cannot be guessed once for
// every corpus. Quality is an empirical question this module answers by
// being run and inspected, not by the shape of its own code — see
// conformance/induction-candidates.test.js's real-text fixture for what
// this actually recovers and misses on real English prose.
//
// Case folding is NEVER done implicitly — "black" and "Black" are distinct
// tokens unless the caller supplies `foldCase`, an injected function (the
// same seam perceiver/text/spans.js already uses for abbreviations: a
// received per-language choice, never an assumption this module makes on
// its own about any script's casing conventions).
//
// Pure: no clock, no randomness, no I/O.

import { gap, isGap } from "../nul/index.js";
import { EXCHANGEABILITY_ALPHA, binomialUpperTail } from "../modifier-order/ud-bridge.js";

// Same tokenizer perceiver/text/spans.js already uses (`TOKEN_RE`) — one
// regex, reused rather than re-derived, so tokenization stays consistent
// across the organs that need it.
const TOKEN_RE = /\p{L}[\p{L}\p{M}]*/gu;

export const tokenize = (sentence) => {
  const matches = String(sentence ?? "").match(TOKEN_RE);
  return matches ? matches : [];
};

/**
 * Corpus-wide token frequency, and the three-band split it earns. Both
 * bounds are received, never defaulted.
 */
export const frequencyBands = (sentences, { minAnchorFrequency, maxAnchorFrequency, foldCase = null } = {}) => {
  if (!Number.isInteger(minAnchorFrequency) || minAnchorFrequency < 1)
    return gap("undeclared", { what: "minAnchorFrequency", why: "the floor of statistical recurrence is never defaulted" });
  if (!Number.isInteger(maxAnchorFrequency) || maxAnchorFrequency < minAnchorFrequency)
    return gap("undeclared", {
      what: "maxAnchorFrequency",
      why: "the ceiling separating content words from function words is never defaulted, and must be >= the floor",
    });

  const counts = new Map();
  for (const sentence of sentences) {
    for (const tok of tokenize(sentence)) {
      const key = foldCase ? foldCase(tok) : tok;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const band = (token) => {
    const n = counts.get(token) ?? 0;
    if (n > maxAnchorFrequency) return "function";
    if (n >= minAnchorFrequency) return "content";
    return "rare";
  };

  return Object.freeze({ counts: Object.freeze(counts), band });
};

/**
 * For every occurrence of a "content"-band token acting as an anchor, walk
 * outward on both sides collecting immediately-adjacent "content"-band
 * tokens as candidate modifier occurrences — stopping at a "function"-band
 * or "rare"-band token, another anchor-band token, or `maxRunLength`,
 * whichever comes first. Each occurrence records which side (`"before"` or
 * `"after"`) and its distance (1 = immediately adjacent).
 *
 * This does not decide which of two content-band tokens IS the anchor in
 * any global sense — every content-band token gets a turn as the anchor,
 * once per sentence position, and the resulting occurrence list is the raw
 * material a corpus-wide direction measurement and induceKinds-based
 * clustering both read from. A token that is sometimes a head and
 * sometimes a modifier contributes real evidence both ways; nothing here
 * forces a single global role onto it.
 */
export const extractOccurrences = (sentences, { minAnchorFrequency, maxAnchorFrequency, maxRunLength, foldCase = null } = {}) => {
  const bands = frequencyBands(sentences, { minAnchorFrequency, maxAnchorFrequency, foldCase });
  if (isGap(bands)) return bands;
  if (!Number.isInteger(maxRunLength) || maxRunLength < 1)
    return gap("undeclared", { what: "maxRunLength", why: "how far a run may reach from its anchor is never defaulted" });

  const occurrences = [];
  for (const sentence of sentences) {
    const raw = tokenize(sentence);
    const tokens = raw.map((t) => (foldCase ? foldCase(t) : t));
    for (let i = 0; i < tokens.length; i++) {
      if (bands.band(tokens[i]) !== "content") continue;
      const anchor = tokens[i];

      for (let d = 1; d <= maxRunLength && i - d >= 0; d++) {
        const tok = tokens[i - d];
        if (bands.band(tok) !== "content") break;
        occurrences.push(Object.freeze({ token: tok, anchor, side: "before", distance: d }));
      }
      for (let d = 1; d <= maxRunLength && i + d < tokens.length; d++) {
        const tok = tokens[i + d];
        if (bands.band(tok) !== "content") break;
        occurrences.push(Object.freeze({ token: tok, anchor, side: "after", distance: d }));
      }
    }
  }

  return Object.freeze({ occurrences: Object.freeze(occurrences), bandOf: bands.band, counts: bands.counts });
};

/**
 * Whether this corpus's occurrences favor one side of the anchor over the
 * other, measured (not assumed): "pre" if modifier occurrences fall
 * predominantly before their anchor, "post" if predominantly after,
 * "exchangeable" if the split is not distinguishable from 50/50 at
 * p<EXCHANGEABILITY_ALPHA (modifier-order/ud-bridge.js, the earliest/cited
 * copy of this threshold) — a real, typed outcome, not a forced choice
 * between two sides for a corpus that genuinely does not have one
 * (free-order languages included).
 */
export const measureDirection = (occurrences) => {
  if (!Array.isArray(occurrences) || occurrences.length === 0)
    return gap("empty_material", { occurrences });
  const before = occurrences.filter((o) => o.side === "before").length;
  const after = occurrences.length - before;
  const n = occurrences.length;
  const majority = Math.max(before, after);
  const pValue = binomialUpperTail(majority, n);
  if (pValue >= EXCHANGEABILITY_ALPHA) return Object.freeze({ direction: "exchangeable", before, after, n, pValue });
  return Object.freeze({ direction: before > after ? "pre" : "post", before, after, n, pValue });
};

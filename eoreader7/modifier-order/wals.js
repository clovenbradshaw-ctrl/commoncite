// eoreader6 · modifier-order/wals — a WALS-derived phrase-level typology,
// and a loader that turns named per-language observations into the
// `typology` shape ./index.js receives.
//
// The two classes added here — demonstrative, numeral — extend the same
// flat ranks table modifier-order/index.js's adjective-internal typology
// already uses, composing with it rather than replacing it: Greenberg's
// Universal 20 cline, refined by Cinque, Guglielmo. 2005. "Deriving
// Greenberg's Universal 20 and Its Exceptions." Linguistic Inquiry 36(3),
// and surveyed at scale in:
//   Dryer, Matthew S. 2013. "Order of Demonstrative and Noun." In Dryer &
//   Haspelmath (eds.), WALS Online (v2020.3). Leipzig: Max Planck Institute
//   for Evolutionary Anthropology. https://wals.info/chapter/88
//   Dryer, Matthew S. 2013. "Order of Numeral and Noun." Same volume.
//   https://wals.info/chapter/89
//   Dryer, Matthew S. 2013. "Order of Adjective and Noun." Same volume.
//   https://wals.info/chapter/87
//
// RANK is the cross-linguistic claim (from the cline itself, cited above):
// demonstrative sits farthest from the noun, numeral next, then the
// adjective-internal hierarchy — the strong, harmonic-order cross-
// linguistic TENDENCY, not an exceptionless universal (Cinque 2005 is
// substantially about the attested exceptions). Received once here, named,
// per CONSTITUTION.md II.2.
//
// DIRECTION is per-language and genuinely empirical, never assumed from the
// rank citation above — that is exactly what the WALS chapters record, per
// language, and this file never asserts one on its own authority.
// `walsTypology` builds a `direction` only from a named entry in
// SAMPLE_DIRECTIONS below, and returns null — never a guess — for any
// language not in that (small, hand-verified) sample.
//
// SCOPE NOTE: WALS chapters 86 (Genitive-Noun) and 90 (Relative
// clause-Noun) exist and are just as real, but genitive and relative-clause
// placement do not slot into this same single linear cline as cleanly as
// Dem>Num>Adj does — both interact more with a language's basic word-order
// typology (OV/VO) than with the semantic-distance-from-head cline this
// file's three classes follow. Folding them into this one `ranks` table
// would assert a tighter universal than the literature supports, so they
// are deliberately left out here rather than force-fit. A genitive/
// relative-clause typology, if built, should be its own received object.
//
// DATA NOTE: SAMPLE_DIRECTIONS below is small and hand-verified against
// wals.info at the time of writing — not a bulk import of the WALS CLDF
// dataset (github.com/cldf-datasets/wals, 2500+ languages). That dataset's
// license was not confirmed before this file was written, so it is not
// vendored here; pulling it in fully is separate follow-up work, gated on
// that check.

const WALS_GIVER =
  "Greenberg's Universal 20, refined by Cinque (2005), \"Deriving Greenberg's Universal 20 and Its Exceptions,\" Linguistic Inquiry 36(3); " +
  "WALS chapters 87 (Order of Adjective and Noun), 88 (Order of Demonstrative and Noun), 89 (Order of Numeral and Noun) — " +
  "Dryer, in Dryer & Haspelmath (eds.), WALS Online, Max Planck Institute for Evolutionary Anthropology — " +
  "https://wals.info/chapter/87, https://wals.info/chapter/88, https://wals.info/chapter/89";

/**
 * Ranks meant to be merged with an adjective-internal ranks table (e.g. the
 * 1-10 scale modifier-order's own conformance tests use for purpose..
 * quantity) — demonstrative and numeral sit above all of them, per the
 * cline: demonstrative farthest from the head, numeral next, then every
 * adjective subclass.
 */
export const DEM_NUM_RANKS = Object.freeze({
  demonstrative: 12,
  numeral: 11,
});

/**
 * A small, hand-verified sample. NOT a claim of completeness — see the file
 * header. Each entry names the specific WALS observation it came from.
 */
export const SAMPLE_DIRECTIONS = Object.freeze({
  english: Object.freeze({
    direction: "pre",
    giver:
      "WALS 87A/88A/89A, English (wals_code eng) — https://wals.info/languoid/lect/wals_code_eng — " +
      "Dem-N, Num-N, Adj-N: fully prenominal, the harmonic pattern Universal 20 predicts",
  }),
  mandarin: Object.freeze({
    direction: "pre",
    giver:
      "WALS 87A/88A/89A, Mandarin (wals_code cmn) — " +
      "Dem-N, Num-N, Adj-N: also fully prenominal — the same harmonic pattern as English, despite the two " +
      "languages being typologically unrelated in nearly every other respect",
  }),
});

/**
 * Builds a `typology` object ./index.js's `order`/`toTriples` can receive,
 * from a named sample-language key and the Dem/Num ranks above, merged with
 * a caller-supplied adjective-internal ranks table. Returns null — never a
 * guessed typology — for any language not in SAMPLE_DIRECTIONS.
 */
export const walsTypology = (languageKey, { adjectiveRanks = {} } = {}) => {
  const entry = SAMPLE_DIRECTIONS[languageKey];
  if (!entry) return null;
  return Object.freeze({
    ranks: Object.freeze({ ...DEM_NUM_RANKS, ...adjectiveRanks }),
    direction: entry.direction,
    giver: `${WALS_GIVER}; language observation: ${entry.giver}`,
  });
};

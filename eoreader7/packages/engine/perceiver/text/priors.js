// eoreader6 · perceiver/text/priors — the prior register for closed-class
// word sets. Every received closed class enters through DEF.admit, names its
// giver, declares its scope (Amendment IV). These are not mined from the
// material; they are received facts about a language's function words or a
// script's typographic conventions.
//
// Each export carries a `giver` and optional `scope` so a reader can trace
// provenance back to the language or script that supplied it.

// ── lang/en — English function words ────────────────────────────────────────

/** Negation markers — a small closed grammatical class, not an open semantic list. */
export const NEGATION_WORDS = Object.freeze(new Set([
  "not", "never", "hardly", "scarcely", "neither", "nor",
  "didn't", "don't", "doesn't", "wouldn't", "couldn't", "shouldn't",
  "won't", "can't", "cannot",
]));
export const NEGATION_WORDS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * First-person pronouns — forms whose capitalisation carries no naming
 * information in English. Same giver as FIRST_PERSON.
 */
export const NEVER_A_NAME = Object.freeze(new Set(["i", "i'm", "i'll", "i'd", "i've"]));
export const NEVER_A_NAME_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * First-person pronoun forms — who is "I" here is a function of who holds the
 * pen, not of the token itself. Same giver as NEVER_A_NAME.
 */
export const FIRST_PERSON = /^(i|me|my|mine|myself|we|us|our|ours)$/i;
export const FIRST_PERSON_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Third-person SINGULAR, GENDERED pronoun forms — a small closed grammatical
 * class, the same standing as FIRST_PERSON above, not an open semantic list.
 * Each form maps to the gender class it grammaticalises in English, never to
 * a referent: WHICH referent a token like "he" points at on a given occasion
 * is exactly the model-tier gap surfaces.js names
 * ("pronoun_and_descriptor_mentions_unresolved") and is not decided here.
 *
 * Number-ambiguous forms ("they", "them", "their", "theirs", "themselves")
 * are deliberately absent: singular-or-plural is not decidable from the
 * pronoun alone, and this register does not guess it (Amendment II's
 * "measured, never assumed" standing, applied to a grammatical class rather
 * than a statistic).
 */
export const THIRD_PERSON_SINGULAR = Object.freeze({
  he: "m", him: "m", his: "m", himself: "m",
  she: "f", her: "f", hers: "f", herself: "f",
});
export const THIRD_PERSON_SINGULAR_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Indefinite determiners — a closed grammatical class, not an open semantic
 * list. An indefinite determiner INTRODUCES its noun rather than pointing
 * back at one already established; whether the noun it introduces names a
 * whole new thing or a detail of something already present is a further
 * question this class does not decide (a consumer like widget.js's routing
 * still has to read what the noun IS, not just that the determiner is
 * indefinite — "some color" and "another one" both carry a member of this
 * set, and only one of them names a new artifact).
 */
export const INDEFINITE_DETERMINERS = Object.freeze(new Set([
  "a", "an", "some", "any", "another",
]));
export const INDEFINITE_DETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Definite determiners — a closed grammatical class. A definite determiner
 * presupposes its noun is already identifiable to the listener; whether
 * that noun is actually present in some specific material is, again, for
 * the consumer to check against bytes, not for this class to know.
 */
export const DEFINITE_DETERMINERS = Object.freeze(new Set([
  "the", "this", "that", "these", "those",
]));
export const DEFINITE_DETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Anaphoric pronoun forms — tokens that, used pronominally, point back at
 * something already established rather than naming it fresh. "this" and
 * "that" overlap with DEFINITE_DETERMINERS by form (English does not mark
 * determiner-use vs. pronoun-use morphologically); a consumer distinguishing
 * "make it bigger" (pronoun, nothing follows) from "make this widget bigger"
 * (determiner, a noun follows) reads the surrounding tokens, not this set
 * alone.
 */
export const ANAPHORIC_PRONOUNS = Object.freeze(new Set([
  "it", "it's", "this", "this's", "that", "that's", "these", "those",
]));
export const ANAPHORIC_PRONOUNS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Inflectional suffixes — the closed set of English inflection endings. A
 * received grammatical class, not vocabulary: these are the morphemes by
 * which one FORM of a word varies from another while pointing at the same
 * referent ("color"/"colors", "button"/"buttons", "big"/"bigger"). A
 * consumer testing whether two tokens are forms of one referent strips or
 * appends members of this set — it never stems heuristically (there is no
 * stemmer in this engine, deliberately). Orthographic variance between
 * dialects ("colour"/"color") is NOT inflection and is not this class's to
 * unify — that closes only through a received spelling prior with its own
 * giver, when one exists.
 */
export const INFLECTIONAL_SUFFIXES = Object.freeze(new Set([
  "s", "es", "ed", "ing", "er", "est", "'s",
]));
export const INFLECTIONAL_SUFFIXES_META = Object.freeze({ giver: "lang/en", scope: null });

// ── script/latn — Latin-script typographic conventions ──────────────────────

/** Sentence-ending punctuation marks. */
export const SENTENCE_TERMINATORS = Object.freeze(new Set([".", "!", "?", "…"]));
export const SENTENCE_TERMINATORS_META = Object.freeze({ giver: "script/latn", scope: null });

/** Closing quote marks. */
export const CLOSING_QUOTES = Object.freeze(new Set(['"', "'", "”", "’"]));
export const CLOSING_QUOTES_META = Object.freeze({ giver: "script/latn", scope: null });

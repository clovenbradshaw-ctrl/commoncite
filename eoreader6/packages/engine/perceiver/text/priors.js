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
 * Determiners that INTRODUCE their noun — English's indefinite class. A
 * closed grammatical class in the same standing as NEGATION_WORDS above, not
 * a semantic list: "a widget" names something that need not already exist,
 * and that is a fact about the determiner, not about widgets.
 *
 * The distinction this register makes available (indefinite introduces,
 * definite and demonstrative point back) is what lets a caller decide
 * "is this turn about something already here?" WITHOUT a verb list. That
 * matters because a verb list is exactly what relations.js's own header
 * records being refuted: a 90-word hand-typed English verb string that was
 * "not a simplification of English, it was a sample of it standing in for
 * the whole". Determiners admit no such sample — the class is closed, and
 * this is the whole of it.
 */
export const INDEFINITE_DETERMINERS = Object.freeze(new Set(["a", "an", "another", "some", "any"]));
export const INDEFINITE_DETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });

/** Determiners that presuppose their noun — English's definite class. */
export const DEFINITE_DETERMINERS = Object.freeze(new Set(["the", "this", "that", "these", "those", "its"]));
export const DEFINITE_DETERMINERS_META = Object.freeze({ giver: "lang/en", scope: null });

/**
 * Pronoun forms that stand alone FOR something already introduced — English's
 * anaphoric class, non-personal. WHICH thing they point at is not decided
 * here (the same standing THIRD_PERSON_SINGULAR holds for gendered forms, and
 * the same model-tier gap surfaces.js names): this register says only that
 * the form points BACK rather than introducing.
 *
 * "they"/"them"/"their" are absent for the reason THIRD_PERSON_SINGULAR gives
 * — number is not decidable from the pronoun alone — and because in English
 * they also carry a generic non-anaphoric use ("they say") this class would
 * silently absorb.
 */
export const ANAPHORIC_PRONOUNS = Object.freeze(new Set([
  "it", "its", "this", "that", "these", "those", "one",
  // Clitic forms, carried for the same reason NEVER_A_NAME carries "i'm" and
  // "i'll": a class that admits "it" and refuses "it's" is not the class, it
  // is a sample of it.
  "it's", "its'", "that's", "this's", "there's",
]));
export const ANAPHORIC_PRONOUNS_META = Object.freeze({ giver: "lang/en", scope: null });

// ── script/latn — Latin-script typographic conventions ──────────────────────

/** Sentence-ending punctuation marks. */
export const SENTENCE_TERMINATORS = Object.freeze(new Set([".", "!", "?", "…"]));
export const SENTENCE_TERMINATORS_META = Object.freeze({ giver: "script/latn", scope: null });

/** Closing quote marks. */
export const CLOSING_QUOTES = Object.freeze(new Set(['"', "'", "”", "’"]));
export const CLOSING_QUOTES_META = Object.freeze({ giver: "script/latn", scope: null });

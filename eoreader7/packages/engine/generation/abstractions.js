// eoreader6 · generation/abstractions — the shared alphabet a backoff can meet in.
//
// SEED.md Amendment IV, consequence 5, names exactly what this file is for:
// two priors meet only where their alphabets meet, cross-modal analogy is free
// at the numeric series and owed a quantization at the level of discrete
// forms, and "that abstraction is a thing to be built and earned, not a thing
// this amendment provides." This is the building. It is not yet the earning —
// that is a measurement, and it lives in RESULTS.md.
//
// An abstraction maps a surface form to a symbol that stands for a group of
// forms. `createLayer` keys a parallel set of tables by the ABSTRACTED context
// while storing SURFACE successors, so "he had gone" can inform "she has gone"
// without either being claimed to be the other.
//
// ── AN ABSTRACTION IS A PRIOR AND NAMES ITS GIVER ─────────────────────────
//
// UniMorph is an external fact about English. A word-class inventory is an
// external claim about what groups with what. Neither is derivable from the
// text being read, so both arrive under SEED.md #1 and `createLayer` refuses
// an abstraction that does not name its giver.
//
// ── AND AN ABSTRACTION IS A BUCKETING, NOT AN ASSERTION ───────────────────
//
// This matters most for the lemma case, because `perceiver/text/morphology.js`
// opens with "NEVER PICK A LEMMA" — inflection is genuinely ambiguous ("saw"
// is the past of `see` AND the lemma of `saw`, to cut), and that module
// deliberately exposes `sameAct` (do two forms' lemma SETS intersect) rather
// than a lemma-picking function.
//
// `sameAct` cannot key a table. Set intersection is not transitive, so it
// induces no partition: saw~see and saw~sawing does not make see~sawing, and a
// table needs every member of a bucket to agree on one key.
//
// So this picks a deterministic representative, and the reason that is not a
// violation is that NOTHING DOWNSTREAM READS THE BUCKET AS A CLAIM. The
// abstract tables only ever contribute backoff mass, they are always
// out-ranked by the exact context at the same reach, and no gap, verdict or
// testimony anywhere consults them. A wrong bucket costs a missed
// generalisation or a slightly worse guess. It cannot produce a false claim
// about the language, because no claim about the language is ever made from
// it. The ambiguity that module protects stays protected where it is read as
// meaning — in `sameAct`, untouched.
//
// Pure: no clock, no randomness, no I/O. `loadMorphology` does the reading.

import { createLemmatizer } from "../perceiver/text/morphology.js";

/**
 * Forms that inflect from the same root back off together.
 *
 * `prior` is a MorphologyPrior@1 as returned by `loadMorphology`. The
 * representative is the lexicographically first lemma the prior offers, which
 * is a KEYING CONVENTION and not a lemma choice — see the header. A form the
 * prior cannot place stands for itself, so an unknown word is never silently
 * merged into some other word's bucket.
 */
export const lemmaAbstraction = (prior) => {
  if (!prior?.forms) throw new TypeError("abstractions: a morphology prior is required");
  if (!prior.giver) throw new TypeError("abstractions: a morphology prior must name its giver (SEED.md #1)");
  const lemmatizer = createLemmatizer(prior.forms);
  return Object.freeze({
    id: `lemma:${prior.language ?? "unknown"}`,
    giver: prior.giver,
    // MEASURED, and the reason this is not simply `min(lemmasOf(form))`:
    // `lemmasOf` always includes the form itself, so a min over it returns the
    // form unchanged for every word the prior does not cover — which is most
    // of them. That makes the abstraction a NEAR-IDENTITY, and a near-identity
    // abstraction is strictly harmful: it adds a backoff level that carries no
    // information the surface levels do not already have, and every share it
    // takes is taken from a level that did. It cost 0.58–1.60 nats/form before
    // this line existed. So the form itself is the LAST resort, never the
    // representative when a real lemma is on offer.
    of: (form) => {
      let best = null;
      for (const l of lemmatizer.lemmasOf(form)) {
        if (l === form) continue;
        if (best === null || l < best) best = l;
      }
      return best ?? form;
    },
    lemmatizer,
  });
};

/**
 * Forms in the same declared class back off together.
 *
 * `classes` is a plain map form -> class name, and `giver` says where the
 * inventory came from — a clustering run, an external tagger, a hand-written
 * list. It is deliberately dumb: this file does not derive classes, because
 * deriving them is a measurement with its own null and belongs in a script
 * that can report one.
 *
 * A form with no class stands for itself rather than falling into a shared
 * "unknown" bucket. An UNKNOWN bucket would make every rare word predict every
 * other rare word, which is the one grouping guaranteed to be wrong and also
 * the one that would look like it was working — rare words are where the
 * backoff mass actually lands.
 */
export const classAbstraction = ({ id, giver, classes }) => {
  if (typeof giver !== "string" || !giver)
    throw new TypeError("abstractions: a class inventory must name its giver (SEED.md #1)");
  const map = classes instanceof Map ? classes : new Map(Object.entries(classes ?? {}));
  if (map.size === 0) throw new TypeError("abstractions: an empty class inventory abstracts nothing");
  return Object.freeze({
    id: id ?? "class",
    giver,
    of: (form) => map.get(form) ?? form,
    size: map.size,
  });
};

/**
 * Apply abstractions in order, first one that places the form wins.
 *
 * Composition is ordered rather than merged because the alternative — letting
 * two inventories vote — would need a tie-break rule, and a tie-break between
 * two received priors is a judgement neither of them gave anyone the standing
 * to make.
 */
export const composeAbstractions = (...parts) => {
  const used = parts.filter(Boolean);
  if (used.length === 0) throw new TypeError("abstractions: nothing to compose");
  if (used.length === 1) return used[0];
  return Object.freeze({
    id: used.map((p) => p.id).join("+"),
    giver: used.map((p) => `${p.id}: ${p.giver}`).join(" | "),
    of: (form) => {
      for (const p of used) {
        const a = p.of(form);
        if (a !== form) return a;
      }
      return form;
    },
  });
};

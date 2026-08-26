// native/adapters/text/morphology.js — the act closure: hear every attested
// inflection of a verb the material already earned.
//
// A human who has learned "trudged" hears "trudges" and "trudging" without
// re-learning anything — inflection is transparent to a reader in a way
// exact-string matching is not. This file gives the native reader that,
// the LICENSED way, on two walls:
//
//   1. Recurrence is earned at the ACT level, once. The vocabulary's own
//      gates measured "trudged"; the closure never adds an act the
//      material did not earn — it widens FORM, not vocabulary.
//   2. Only forms ATTESTED IN THIS MATERIAL join. UniMorph knows ten
//      thousand inflections; the closure admits only tokens the book
//      actually contains that are the same act as a measured verb. The
//      prior decides sameness (received, giver named); the material
//      decides presence.
//
// The engine's own organs decide "same act" (perceiver/text/morphology.js
// — ported from eoreader5, its header carrying the two mistakes already
// made and fixed there: never pick a lemma; the suffix rule is part of
// the lookup). This file re-derives nothing — and it IMPORTS nothing:
// the text-boundary conformance wall forbids an adapter from reaching
// into the frozen provider, so the lemmatizer arrives INJECTED (the
// cast.js pattern), from a caller that may name legacy — an eval driver,
// a host assembly — never from here. Lineage: the-fold measured the
// identical move on MINE-1 (lemma equivalence: bound 531 -> 536, zero
// contradictions) — the precedent this follows.

/**
 * actClosure(verbs, tokenTypes, lemmatizer) -> { forms, added, gap }
 *
 * `verbs`      the measured vocabulary (Set of lowercase forms)
 * `tokenTypes` every distinct token of THIS material (the presence wall)
 * `lemmatizer` the engine's createLemmatizer over a loaded prior — its
 *              own `gap` (no prior) degrades the closure to exact forms,
 *              loudly, never silently changing answers.
 */
export const actClosure = (verbs, tokenTypes, lemmatizer) => {
  const base = verbs instanceof Set ? verbs : new Set(verbs ?? []);
  const forms = new Set(base);
  const added = [];
  if (!lemmatizer || lemmatizer.gap) return { forms, added, gap: lemmatizer?.gap ?? { reason: "no_lemmatizer", tier: "model", detail: "no morphology prior injected — the closure is exact forms only" } };
  // Index measured verbs by every lemma candidate, then admit a token when
  // its own lemma set intersects a measured verb's — sameAct, precomputed
  // once instead of |tokens| x |verbs| pairwise calls.
  const byLemma = new Map();
  for (const v of base) for (const l of lemmatizer.lemmasOf(v)) {
    if (!byLemma.has(l)) byLemma.set(l, v);
  }
  for (const t of tokenTypes) {
    const w = String(t ?? "").toLowerCase();
    if (!w || forms.has(w)) continue;
    for (const l of lemmatizer.lemmasOf(w)) {
      const src = byLemma.get(l);
      if (src) { forms.add(w); added.push({ form: w, sameActAs: src }); break; }
    }
  }
  return { forms, added, gap: null };
};

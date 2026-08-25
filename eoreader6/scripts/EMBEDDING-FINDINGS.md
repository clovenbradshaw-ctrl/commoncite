# Slot deltas and embeddings — what they can and cannot do

Measured against `Xenova/all-MiniLM-L6-v2` and
`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, on Frankenstein, War and
Peace, and Garoa. Recorded so none of it is retried blind.

The technique throughout is eoreader5's `packages/def/svo.js` differential:

    delta(w) = embed(clause) - embed(clause with w masked)

with a **Born gate**: a delta counts only if it beats masking some OTHER real
word in the same sentence. That null preserves the sentence, the encoder and
the masking operation, and breaks only WHICH position was masked.

---

## WORKS — the referent-capable class, discovered without labels

Profiling each word by what it does to a slot:

  * `magnitude`   how much of the clause rides on this slot
  * `consistency` how alike a word's own deltas are across contexts
  * `salience`    how often it beats the Born null

Clustering on that (no labels used to compute anything) yields **one
coherent class** on lowercased War and Peace:

    CLASS 1  consistency 0.830  salience 0.65
      father, horse, kutúzov, moscow, natásha, petersburg, pierre, soldier

People, places and concrete common nouns together; no proper/common split.
The class is **things that can be a referent** — an ontological class, not a
part of speech, and exactly the one the existence tier needs.

Function words separate from it at **d = 3.80** (War and Peace) and
**d = 3.78** (Frankenstein) — two books, different centuries, authors,
translators and name morphologies, same effect size to two decimals.

Controls that held:

  * **Capitalization ruled out.** War and Peace fully lowercased; the names
    still lead. Not an orthographic artefact.
  * **Rarity is not the mechanism.** Rare common nouns (regiment, adjutant,
    sovereign) sit between proper and common at d = 1.07 from proper — a
    contribution, not the cause.
  * **Empty band when empty.** Probing Frankenstein's names against War and
    Peace leaves the top band vacant. The measure does not manufacture a class.

Corrected overclaim: an earlier run reported d = 3.78 for "names vs
everything" on Frankenstein with **zero overlap**. That was inflated by probe
selection — nothing occupied the middle. Adding place names and rare commons
turns the partition into a gradient:

    proper 0.825 > rare 0.793 > common 0.763 > function 0.690

Only the function/content end of that gradient is sharp.

## FAILS — anything about relations, and the reason is measurable

    cos("the dog bit the man", "the man bit the dog") = 0.9782

Mean-pooled sentence embeddings rate two opposite events as 97.8% identical.
**Who-did-what-to-whom is very nearly absent from the representation.**

Everything downstream of that fails for the same reason:

  * **Clause binding energy.** `I(i,j) = || d_ij - (d_i + d_j) ||` is real
    (residual ~50% of joint magnitude, so strongly non-additive) but
    **uniform**: sd 0.019–0.050 across all pairs. Real constituents
    (`french~army`, `gave~order`, `prince~andrew`) do surface at the top, but
    by 0.52 vs 0.48 — inside the noise. Non-additivity is a property of the
    masking operation, not of linguistic binding. No tuples can be built from
    it as it stands.
  * **Word order, cross-linguistically.** Prediction: English (configurational)
    perturbed more by shuffling than Basque (case-marked). Measured English
    0.126 vs Basque 0.147 — **d = -0.37, the wrong sign.** No configurationality
    detected in either direction.

## What this means for the engine

The symbolic path is not a fallback. For agent/patient — the exact failure
`packages/def/attribution.js` exists to catch, where a claim hands the
creature's act to Victor — the embedding **does not carry the information**,
so SVO extraction plus referent gating plus narrator spans is the right
instrument rather than the cheap one.

Use embeddings for **what kind of thing a word is**. Do not use them for
**what happened to whom**.

---

# Referent-gated SVO, and a flaw in the tier fold

## SVO yield is a fact about the MATERIAL, not only the method

A triple is kept only when both ends resolve to a referent (eoreader5's gate,
and the thing that makes SVO stronger evidence than a keyword).

    Frankenstein     1 of 570 stated triples kept  (0.2%)
    War and Peace  138 of 4975 stated triples kept (2.8%)   -> 90 nodes, 87 edges

14x. Frankenstein has ~6 characters and is mostly interior monologue, so its
stated relations are overwhelmingly person-to-ABSTRACTION ("I felt a great
alteration in my sensations"). Requiring both ends to be cast members discards
them. eoreader5 built and measured its relationship graph on War and Peace for
this reason. The method is not broken on Frankenstein; it is being asked for
something the book does not contain much of.

Narrator spans work and are worth keeping: 3 of 3 resolved, 0 unresolved,
covering 23.9% of Frankenstein (the creature narrates 40.3-62.0% and
97.8-100%). 19 first-person subjects bound BY SCOPE, 64 typed gaps outside
any known span. That is the nameless-referent principle on the hardest case.

One bug fixed here, worth recording because it silently poisoned everything:
"M." (Monsieur Krempe, Monsieur Waldman) yields the surface "m", and
substring matching made `phrase.includes("m")` true for any phrase containing
the letter. `ref:auto:m` held 6 of the 8 strongest relations. Surfaces now
require >= 2 characters AND word-boundary matching.

## The tier fold measures scale, not content — unfixed

Feeding tiers.js a stream of arrivals, its surprise converges:

    0.1215 -> 0.1035 -> 0.0869 -> 0.0748 -> ... -> 0.0464 -> 0.0464 (constant)

Adding any single edge to a large edge distribution moves belief by about the
same amount regardless of WHICH edge, so D_KL over the edge distribution is
dominated by arrival-size-vs-prior-size. At steady state every value ties and
the witness gate (strict >) never fires: 138 observations, 0 shifts, on real
War and Peace data.

The tier is technically detecting sclerosis correctly — SEED.md's second
death, "the ground closes, nothing can differ from it" — but for a mechanical
reason rather than because the text stopped surprising. Same failure class as
the other nulls measured tonight: a quantity read as meaning that was actually
reading scale.

What a fix has to do: make surprise depend on WHICH edge arrived, not merely
that one did. A novel relation between two known referents and a restatement
of a known relation must not produce the same number. Not attempted here.

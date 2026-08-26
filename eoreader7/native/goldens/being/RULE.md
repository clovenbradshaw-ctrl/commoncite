# The being-hood adjudication rule

*Written down before any candidate's passages were read, so that the rule is
a standard the material is held to and not a description of what the material
turned out to contain.*

## The question

`descriptorBeings` (native/adapters/text/anchoring.js) admits a recurring,
never-anchored **definite descriptor** as a being in its own right. Recurrence
alone admits *things* as readily as beings — measured on Frankenstein, it
admitted "the murder", "the name", "the beauty". So the admission is gated on
a caller-measured **evidence** of being-hood, and levers-RESULTS.md stopped
refining that measure on purpose:

> No being-hood golden exists in either repo; until one does, further
> filter-tuning is calibration-on-the-fixture wearing measurement's clothes.

This file is that golden's standard. It answers, per candidate:

> In **this book**, does this definite descriptor denote a being — an
> individual that acts or undergoes — or a thing?

## The classes

- **`being`** — an individual person, animal, or personified agent. Being-hood
  is the question, not novelty: a descriptor that turns out to be an alias for
  a named character is still a `being`.
- **`thing`** — anything else the descriptor denotes: an act or event, a place
  or region, an abstraction, a body part, an artifact, a stretch of time, a
  faculty, a text. Also: a span that is not a referring noun phrase at all
  (an extraction artifact), which denotes nothing and so is certainly not a
  being — tagged `artifact: true` so the count stays visible.
- **`undecided`** — the arrivals do not decide. Never guessed. Excluded from
  precision/recall, and counted.

## The procedure, in order

1. Read the candidate's arrival sentences — the book's own words, not a memory
   of the book.
2. If in **any** arrival the descriptor stands as the one doing or undergoing
   what a person or animal does — speaking, moving of its own will, feeling,
   being addressed, being harmed — it is a `being`.
3. **Metonymy does not promote.** "The city rejoiced" denotes its inhabitants
   collectively; a collective is not an individual being. A collective is
   `thing` unless the book itself individuates it as one agent.
4. **Grammatical subjecthood does not promote.** "The murder had been
   committed" puts the murder in the subject slot and it remains an act. What
   decides is what the descriptor denotes, not where it sits.
5. If 2–4 do not decide on the arrivals shown, the verdict is `undecided`.

## What each verdict must carry

`verdict`, a one-line `because`, and the `sentenceOrder` of the arrival that
decided it — so every row can be re-read against the book rather than trusted.

## Independence, and exactly how far it goes

- The sheet adjudicated (`*.blind.json`) carries **no** evidence count and
  **no** gate verdict, and is ordered alphabetically so it leaks no ranking.
- A second, received witness is recorded beside every hand verdict:
  **WordNet 3.1** (Princeton University, via `wordnet-db@3.1.14`), asked
  whether the candidate's head noun has any sense whose hypernym closure
  reaches `person`, `animal`, or `organism`. This witness is type-level and
  book-blind — it cannot see metonymy or a book-specific sense — and it is
  recorded as a **witness, never as the verdict**. Agreement between the two
  is reported as the golden's own internal reliability.
- **Disclosed contamination, not smoothed over:** the adjudicator had prior
  exposure to the five candidates the shipped gate admits — `the murder`,
  `the Turk`, `the child`, `the south`, `the city` — and to
  levers-RESULTS.md's own opinion of four of them, because that document was
  read before this pass began. Those five rows are flagged `priorExposure:
  true`, and every score is reported twice: over all decided rows, and over
  the uncontaminated remainder alone.
- **Disclosed limit:** one adjudicator, in the same session that runs the
  measurement. The repo's own stronger protocol (independent, context-isolated
  panels with Fleiss' kappa, as in the-fold's `asserted-blind-analysis.mjs`)
  was not available here. The WordNet column is the substitute for a second
  rater, and it is a weaker one — this golden is a first standard, not a
  human ceiling, and is labelled so wherever it is scored.

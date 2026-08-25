# Next: bounded relation slots, and the clause-adjacency gap behind them

Status note for whoever picks this up next. Written so the plan survives past
the session that wrote it, same purpose `KERNEL_REBUILD_CHECKPOINT.md` and
`NEXT-LEVEL1-PROMOTION.md` already serve. Read `READING-POLICY.md` first —
everything below is entries A13–A17 of its append-only attempt log, made
actionable. This file does not restate the discipline that log already
states (Born gates, no chosen thresholds, plural grounds, gaps are results);
it assumes it.

## What was measured, and what it means

A full reading of War and Peace (Gutenberg #2600, Maude) with a real coref
prior injected surfaced two compounding gaps in `perceiver/text/relations.js`,
diagnosed mechanically rather than guessed at (A17):

Of 2,868 pronoun occurrences `pronouns.js::resolvePronouns` correctly bound
by activation recall, only 277 (9.7%) ever landed in a triple
`emergence/graph.js` could use. The other 90.3% split two ways, and they are
different defects with different fixes:

- **39.1% (1,122) — SWALLOWED.** `extractRelations`'s object capture is
  `.+?` (`relations.js:207`) — everything to the next terminator, mean width
  6.2 words when a pronoun sits inside it. A pronoun resolves only when it
  happens to BE the whole capture, by accident of sentence shape. This is
  not a slot a filler attaches to by any general mechanism (name lookup,
  pronoun binding, an epithet prior — the same shape a bound variable, a
  pointer, or a foreign key resolves by, per the indirection framing this
  session was handed mid-run and confirmed against measurement rather than
  taking on faith). It is already-decided literal text that resolution can
  only pattern-match against after the fact.

- **51.2% (1,469) — NO_VERB.** No relation-vocab verb sits in immediate
  `subject VERB object` adjacency near the pronoun at all — not a capture-
  width problem, a clause-shape and vocabulary-recall problem. The matcher
  requires literal adjacency (`\s+` between capture groups, nothing else,
  `relations.js:207`), and ordinary narrative prose routinely puts
  auxiliaries, adverbs, and subordinate clauses between a subject and its
  verb. `discoverRelationVocab` is itself derived from this same adjacency
  slot (`relations.js:9-60`), so the vocabulary and the extractor share one
  blind spot rather than compensating for each other.

**These do not have the same fix.** Slot-typing recovers at most the 39.1%
swallowed bucket. The 51.2% majority needs the extractor's own clause-shape
assumption revisited — a separate, larger question this file does not
propose an answer to, only names as the bigger of the two gaps.

## Why this is worth doing at all

Because A15 already measured the payoff class this unlocks. Routing
pronoun-resolution ESCALATION by the actual kind of doubt (`pronoun_no_margin`
— a tie, a depth problem — vs `pronoun_below_floor` — thin evidence, a
breadth problem), instead of widening one undifferentiated pool, recovered
+18.3% more correct bindings with zero confirmation loss, where the untyped
version of the same escalation LOST bindings net (A14, A15). Typed routing
by the doubt's own kind beat brute widening decisively. The swallowed-slot
defect is the same shape one layer downstream: a slot that KNOWS what kind
of thing should fill it (a role, typed, bounded) can be resolved by whichever
mechanism fits — the untyped alternative (grab the nearest terminator) cannot
be typed by anything, so nothing downstream can route on it either.

## The scoped task

1. **Read `packages/engine/perceiver/text/relations.js` in full**,
   especially the header (lines 1-95) — it already documents two prior shape
   attempts that were measured and refused (anchoring on both ends found 6
   candidates on Frankenstein; anchoring on the token before a surface mixed
   verbs with epithets). Do not re-try either without re-reading why they
   failed.

2. **Change `extractRelations`'s object capture from `.+?` to a bounded
   slot.** The subject side is already close to bounded (`${W}(?:\s+${W})?`,
   1-2 tokens) — the defect is almost entirely on the object side (853 of
   1,122 swallowed occurrences, A17's own breakdown). A bounded object
   capture needs a real stopping rule, derived from the material the same
   way every other boundary in this codebase is (Zipf-derived function-word
   sets already exist in `material.js`; a clause boundary is plausibly the
   next function word or the next surface, not a fixed token count — but
   MEASURE this, do not assume it, the same discipline `deriveMinPartners`/
   `deriveMinSentences` in `surfaces.js` already models).

3. **Score against `goldens/agency-civic/` before touching anything else.**
   This is the one scored golden depending on `extractRelations`
   (`goldens/agency-civic/engine-score.mjs`, `analysis.mjs`,
   `extract-clauses.mjs`, `rotation-control.mjs` all import it). A change
   that improves the War and Peace pronoun-swallow numbers and regresses
   this golden's own precision/recall is not a fix; report both numbers
   together, not the new one alone.

4. **Then, separately, sweep the other 10 callers** (`scripts/cache-reading.mjs`,
   `navigation-index-war-and-peace.mjs`, `read-ladder.mjs`, `read-people.mjs`,
   `read-tiered.mjs`, `sing-book.mjs`, `terrain-census.mjs`) for any hand-rolled
   assumption about capture width — the same class of bug A11/A12 already
   found once in this codebase (an organ renamed, callers not swept; a driver
   collapsing bindings by sentence instead of by offset). Grep for `.object`
   and `.subject` field access on relation records in each.

5. **Do not touch the NO_VERB majority in this pass.** It is real, it is
   bigger, and it needs its own measurement pass on what adjacency pattern
   actually recovers narrative-prose SVO clauses without re-opening either
   refused shape from step 1. Name it as follow-up, do not fold it into the
   slot-typing change — two defects, two fixes, two validations.

## What "done" looks like

A `READING-POLICY.md` entry (A18 or later, whatever the log is at) reporting:
the new swallowed/clean-slot split on the same War and Peace reading with the
same coref prior (so the comparison is apples to apples against A17); the
`goldens/agency-civic` score before and after; and an honest count of the
NO_VERB majority, unchanged, named as still open. If the slot change makes
`agency-civic` worse, that is the finding — revert, and say why, in the log,
not just in a commit message.

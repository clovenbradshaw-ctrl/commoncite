# The vocabulary measurement is a whole-book statistic — a slice is not a small book

**2026-08-24. A driver defect, found by a direct challenge ("21 verbs is
nowhere near enough, how were we finding verb-ish things in 6.1?") after
three passes of theorizing about extraction.**

## The check that should have come first

`native/adapters/text/relations.js` is **byte-identical** to
`legacy-eoreader6.1/packages/engine/perceiver/text/relations.js`. Its own
header records what 6.1 measured on Frankenstein: *165 candidates, 33
recurring across ≥2 distinct surfaces*. Reproduced here:

| run | sentences | candidates | recurring ≥2 |
|---|---|---|---|
| Frankenstein FULL | 3,392 | **172** | **35** |
| *6.1's documented figure* | (full) | *165* | *33* |
| Frankenstein 700 | 700 | 35 | 4 |
| Dracula FULL | 9,470 | **447** | **135** |
| Dracula 700 | 700 | 74 | **3** |
| Pride & Prejudice FULL | 7,769 | 416 | 143 |

There is no regression. Full-book numbers reproduce 6.1's own to within
rounding.

## What actually happened

Every Dracula figure reported in this session's earlier notes came from a
**700-sentence prefix** — 7% of the book — taken as a runtime budget.
`discoverRelationVocab` measures recurrence of a candidate verb across
DISTINCT capitalized surfaces over the material it is given; that is a
whole-book statistic, and it does not degrade gracefully under truncation,
it collapses. Dracula at 7% yields 3 recurring verbs; Dracula whole yields
135 (`has went said came took saw`).

READING-POLICY P5.5 states the rule this violated, in as many words: *"When
a result surprises you, check the driver before the theory. Every anomaly in
this document's history was a driver defect."* The result surprised; the
theory got three passes; the driver got none.

## Claims this retracts

- **"The reader extracts almost no predicates from Dracula (`is`×55,
  `would`×22, `came`×1)."** False. That was 7% of the book.
- **The Fold-conditioned admission path's justification (2 → 21 verbs).**
  The mechanism stands on its own merits — a verb witnessed between two
  already-established referents *is* material evidence of relation-hood,
  and it is counted at the same declared strength as anchor evidence — but
  the numbers that motivated it were a truncation artifact and are withdrawn
  pending a full-scale measurement. It may prove unnecessary.
- **"Kind and Network are empty"** — asserted from sliced runs and not yet
  re-checked at full scale. Not a finding until it is.

## The standing rule this leaves

**A prefix is a different material, not a smaller one.** Any figure in this
suite reported from a truncated read must say so at the point of the claim,
and no mechanism may be justified by a sliced measurement. Where runtime
forbids a full read, the honest report is the gap, not the slice's number.

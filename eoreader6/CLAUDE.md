# Working in eoreader6

This file is operational guidance for coding agents (and humans) working in
this repo — narrower in scope than `SEED.md` (the engine's own theory, under
the EO constitution's governance) and `CUBE.md` (the operator grid). Nothing
here needs ratification to add to; it is a running list of mistakes made
once, named so they are not made twice.

## Search for the organ before you write one

**Before writing a new statistical test, graph, or extraction mechanism,
grep for it. This engine already has more built than any one task's context
window surfaces on the first pass.**

Concretely: `packages/engine/emergence/`, `packages/engine/perceiver/text/`,
`packages/engine/referents/`, and `induction/`, `frame/`, `lens/`,
`holon_level/` at the repo root are where a capability already lives more
often than not. A one-line `grep -rl <keyword>` across those directories
before implementing anything costs seconds; reimplementing a worse version
of an existing organ costs a rewrite.

**The incident this rule is named for** (`goldens/network/`, 2026-08):
building a co-occurrence golden, an early version hand-rolled "did two
characters ever share a chapter" as a same-segment counting function, plus a
post-hoc Monte Carlo chance baseline to guess at significance. Both already
existed, done properly: `emergence/binding.js::bindLinks` runs a real
permutation-null significance test **per pair**, needs no notion of
"chapter" at all (it works over the reading's own reach-unit arrival
positions, so it has resolution on a 25-scene play exactly as well as on a
366-chapter novel), and already had direction and polarity built in via
transfer entropy. The hand-rolled version was strictly worse on every axis
— weaker signal, no per-pair significance, and structurally incapable of
resolving anything on a short text — and it took a direct instruction
("look harder at what we've built") to go find the organ that had been
sitting one directory over the whole time.

The check that would have caught it early: `grep -rln "cooccur\|co-arriv\|co-occur" packages/engine/` finds `emergence/binding.js` and `emergence/graph.js`
immediately. The same is true for relationship extraction
(`perceiver/text/relations.js` — measured, not hand-listed, SVO triples),
population/kind induction (`emergence/jati.js`, `emergence/kinds.js`), and
referent coreference (`perceiver/text/surfaces.js::discoverReferents`) —
all real capabilities that a plausible-sounding from-scratch implementation
could otherwise silently duplicate, worse.

`scripts/read-people.mjs` is worth reading start to end before building any
new "read a book and extract X" driver — it already chains candidate
discovery → referent coreference → relation-vocabulary measurement → SVO
extraction → belief graph → population understanding, in the order those
organs actually compose. A new driver's job is usually to ask a new
QUESTION of that pipeline's output, not to rebuild pieces of the pipeline.

## Never tune a parameter by checking what it does to a golden's own score

**If a number feeds a reading (a threshold, a window, a `minX`), its value
must be justified WITHOUT looking at how it moves the score against that
reading's own reference/golden. If the only justification you have is "I
tried a few values and this one scored best," stop — that is calibrating
against the answer key, and it is the same mistake as hand-rolling a
mechanism, aimed at a parameter instead of a function.**

`goldens/cast`'s own discipline states this directly: "the engine never
sees the reference — it is scored against it after the fact." That applies
to every number that shapes what the engine does before scoring, not just
to the engine's output.

**The incident this rule is named for** (`goldens/network/`, same session as
above): trying to raise entity coverage, `SPEC.minArrivals` was walked down
from 6 to 5 to 4 to 3, checking each value's effect on Les Misérables'
entity/edge recall against `lesmis.json` — exactly the leak the rule above
forbids. The correct move, once named, was to find a justification for the
number that referenced nothing about the golden at all:
`referents/entity.js::admitFromArrivals`'s own witness gate requires
`half = floor(arrivals / 2) >= 2` to run its split test, so any candidate
with fewer than 4 arrivals is refused by the Born gate itself regardless of
`minArrivals` — 4 is the lowest value at which that gate, not a pre-filter
sitting in front of it, is what decides admission. The number came out the
same (4) either way; the METHOD is what mattered, because the empirical
route would have silently rationalized whatever value best fit these four
specific books, with no way to tell afterward that it had.

If a value's only defensible justification really does require checking
the golden (rare, and worth naming explicitly when true), say so out loud
and flag the result as calibrated-on-this-fixture, not measured-blind — the
two are different claims and this codebase's own goldens depend on being
able to tell them apart.

## When two goldens grow the same tool independently, reconcile them — don't just dedupe

**Two drivers solving adjacent problems (here, `goldens/cast/read.mjs` and
`goldens/network/read.mjs`) will grow near-identical helper functions
independently. When you find one, don't just factor out whichever copy is
convenient — read both, find the better one (or the union of what's right in
each), and give BOTH callers the improved version. Deduplication that
preserves a known bug in one copy while fixing it in the other is not
finished.**

**The incident this rule is named for** (`goldens/shared/`, same session as
above): `goldens/network/read.mjs`'s fuzzy name-matcher had already been
fixed once (the `.find()`-first-match bug from the rule above). Extracting
the PG-boilerplate stripper (`stripPgBoilerplate`) into `goldens/shared/`
was a pure, risk-free move — cast's and network's copies were byte-identical.
The name-matcher was not: cast's own `matches()` had the identical
`.find()`-over-a-boolean shape network's used to, just quieter, because
cast's surfaces are mostly single tokens (fewer chances to collide with the
wrong reference entry). Checking whether cast's copy of the SAME bug was
still live took one grep and one read; fixing it took porting the already-
generalized `matchScore`/`bestMatch` (single-token surfaces degrade to
exactly cast's old behaviour, so this was a strict generalization, not a
narrowing). Measured afterward, honestly (not tuned toward this number):
`hu-69689` (A Pál utcai fiúk) went from 5/19 to 7/19 cast recall on the
identical register — a real bug, not a theoretical one, sitting unfixed in
a "proven" golden until the adjacent driver's own fix got checked against it.

The test for whether reconciliation is safe to do live (not just leave as a
TODO): is the function under a pinned/asserted conformance test? Neither
`cast/read.mjs`'s nor `network/read.mjs`'s own `score()` is (`entity.js`'s
7/7-brothers golden goes through a SEPARATE scorer,
`scripts/score-cast-entities.mjs`, untouched here) — so there was no pinned
number to break, only console output and JSON files to re-verify by eye.
When a golden's score IS pinned by a conformance test, fixing a shared bug
underneath it is still correct, but say so explicitly and expect the pinned
number to move — a moved number from a real fix is not the same failure as
regression from an unrelated change, and the two must not be reported the
same way.

## When a rewrite is still the right call

Not everything is built. `goldens/network/read.mjs`'s chapter-boundary
detection for Gutenberg novels (`novelChapters`) and its Shakespeare
scene-splitter (`shakespeareScenes`) are both genuinely new — `segments.js`'s
`outlineOfIndex` was tried first and correctly rejected on the merits (it
refuses Huckleberry Finn's own "CHAPTER I." heading style as sentence-shaped,
which is the right general policy, just wrong for this one corpus's
convention). The rule above is "search first," not "never write new code" —
it just means the search has to actually happen, and the reason for writing
new code instead of reusing what's found has to be stated, not assumed.

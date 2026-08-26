# Working in eoreader6.1

## Version

This is **eoreader6.1** — a published snapshot of `eoreader6`: the same
engine (`packages/`, `nul/`, `frame/`, `cascade/`, `induction/`,
`holon_level/`, `formation/`, `temporality/`, `verdict/`, `reading/`,
`provenance/`, `lens/`, `event_log/`, `discourse/`) and the full conformance
suite, with the essays, research scratch (`scripts/experiments/`,
`scripts/adversarial/challenge-*.mjs`), and raw corpora (`scripts/corpus/`,
gitignored `goldens/*/texts/`) stripped out. No git history — this is a
clean base, not a fork of eoreader6's own repo.

**Successor:** none yet. This is the current published version. If a newer
one ships (eoreader6.2 or later), its location will be linked on this line —
check here before assuming 6.1 is still current.

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
population/kind induction (`emergence/people.js`, `emergence/kinds.js`), and
referent coreference (`perceiver/text/surfaces.js::discoverReferents`) —
all real capabilities that a plausible-sounding from-scratch implementation
could otherwise silently duplicate, worse.

`scripts/read-people.mjs` is worth reading start to end before building any
new "read a book and extract X" driver — it already chains candidate
discovery → referent coreference → relation-vocabulary measurement → SVO
extraction → belief graph → population understanding, in the order those
organs actually compose. A new driver's job is usually to ask a new
QUESTION of that pipeline's output, not to rebuild pieces of the pipeline.

**Instance-level role resolution** (`perceiver/text/roles.js::resolveSpanRole`,
added 2026-08-19) — the general sibling of `pronouns.js::resolvePronouns`:
given a span of unknown role and other spans already known to fill
declared roles, resolves which role THIS occurrence's own local vocabulary
resembles, by the same causal one-hop `emergence/activation.js` recall
pronouns.js already trusts for referent identity. "Role" is never typed
in — it is a caller-declared label, so this is the organ to reach for
before hand-rolling any type-level word statistic (a determiner-adjacency
vote, a POS-frequency table) to decide what a specific occurrence of an
ambiguous word is doing — that class of mistake, and the type-vs-instance
reasoning behind the fix, is recorded in the-fold's own CLAUDE.md ("Closed
the same day — a new engine organ, not another word-level proxy") along
with a measured limitation: the mechanism needs same-role vocabulary to
actually recur within the material, which book-length text has and a
single short passage often does not.

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

## A scaffolded prior sitting unused is still "search first" — check what already exists before hand-typing a closed class

**`scripts/build-pos-prior.mjs` existed before this pass, fully written, fully
commented, and had never been run: a transform from a real, human-annotated
treebank (Universal Dependencies UD_English-EWT, CC BY-SA 4.0) into
`POSPrior@1` — every English word form's attested part-of-speech tags, with
real counts, ambiguity preserved rather than collapsed. Nothing consumed it.
`grep -rl POSPrior` before this pass found exactly one file: the builder
itself.**

The incident this rule is named for (2026-08-19, a session working from
the-fold's own committed evidence that `extractRelations`'s connector slot
sometimes holds a preposition or pronoun instead of a verb — see
`eval/results/asserted-crosslingual.md`, the-fold): the fix looked like it
needed two new hand-typed closed classes (prepositions, conjunctions,
mirroring `priors.js`'s existing `NEGATION_WORDS`/`DEFINITE_DETERMINERS`
pattern) — English has small, genuinely closed inventories for both, so
hand-typing them would not itself have been the mistake this file's other
sections warn about. But `find . -iname "*prior*"` first, the way this
file's own top rule demands, surfaced `build-pos-prior.mjs` instead — a
real 16,654-word, giver-cited, ambiguity-preserving prior sitting one
`curl` and one `node` invocation away, covering not just prepositions and
conjunctions but all of Dionysius Thrax's ancient eight parts of speech at
once, built from real annotation rather than a hand-typed list. Fetching
the real treebank and running the existing script (`scripts/corpus/` is
gitignored, so this is a local, reproducible build, never a git-history
cost) took under a minute and produced a strictly better foundation than
the two lists that were about to be hand-typed.

**Files.** `perceiver/text/wordclass.js` (new, pure, organs injected):
`THRAX_MAP` (Universal Dependencies UPOS tags → Thrax's own eight
categories, every entry naming exactly where the two schemes agree and
where they do not — UD's AUX/VERB split and CCONJ/SCONJ split have no
ancient counterpart; Thrax's own article was narrower than UD's DET;
`INTJ` is Donatus and Priscian's later Latin addition, not Thrax's own),
`THRAX_OUT_OF_SCOPE` (ADJ/PART/NUM/PUNCT/SYM/X — UD categories with no
Thrax-tradition analogue, kept OUT of the map rather than silently forced
into the nearest one), `classifyWord` (every attested class for a form,
real counts, never collapsed), `dominantClass` (the one permitted
convenience — a caller-declared `minShare` floor, never defaulted, the
same standing `roles.js::resolveSpanRole`'s own `minActivation`/
`minMargin` already hold). `conformance/wordclass.test.mjs` (10 cases
against real treebank counts, including one composition test proving a
type-level tie `classifyWord` correctly refuses to collapse — a plain
majority TABLE cannot separate "walked to the station" from "wanted to
leave" — is resolvable per-OCCURRENCE by `roles.js::resolveSpanRole`,
given real local company; no new resolution mechanism, the existing organ
composed exactly as its own header already invites).

**SLOT is not CLASS, and this file only ever answers CLASS.** Which
position a span fills in a clause (subject/connector/object —
`extractRelations`'s own structure) and which part of speech a word's FORM
is (independent of any one clause) are different questions — Halliday's
Systemic Functional Grammar keeps them apart for exactly this reason
(function vs. class: a function can be realised by any class), and
conflating them is the defect this whole pass closes. `wordclass.js` has
no notion of a clause, a triple, or a slot; it answers one question, about
one word, and always as a disclosed set of candidates rather than a
verdict.

**Disclosed, not fixed: participle.** Thrax's `metokhē` (μετοχή, participle)
has no clean signal in `POSPrior@1` as currently built — UD's own UPOS
tagset has no separate participle tag (`VerbForm=Part` lives in FEATS,
which `build-pos-prior.mjs` reads from the CoNLL-U columns but does not
currently tally); `THRAX_MAP` omits it rather than guessing from a `VERB`
tag alone. Extending the builder to also tally FEATS is real, scoped,
unattempted future work, named here so the next pass does not have to
re-discover the gap.

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

## Checking REC's recourse locality against the online-algorithms literature (added 2026-08-21) — what was measured, so it is not re-derived

A review of the bounded-recourse online-algorithms literature (Gupta et
al., arXiv:2308.01406, and the adjacent OGP-barrier work on input
stability) asked four questions of `loops/atmosphere.js`'s REC (re-zero)
firing — the one place in this engine where "REC fires" is already a
literal, numeric event with a `tolerance` trigger and `regions` (spans
between re-zero events) on the record. Two of the four were cheap to check
directly against real material; they were checked, on user direction to
**only implement if it improves something** rather than build all four
reflexively. The answer is a real, disclosed problem, not a clean bill of
health, and it stops there deliberately — see below for why the other two
(a smarter trigger; deciding recourse vs. stability on purpose) were not
attempted this pass.

**What was already on the record, found before anything was added.**
`ground()` (nul/index.js) already returns `extent: material.length` on
every ground it builds — the touch-set size this question is about was
already being computed, just never summed or divided by turns.
`readAtmosphere`'s own `regions` already carry `start`/`end` per region —
`end - start` at a REC-closed region IS the touch-set at that firing, with
zero engine changes needed to read it. Only the CUMULATIVE figure (total
recompute work across every step, not just the state at firing, divided by
turns) needed a new accumulator. Added as the smallest change that answers
the question: `groundFrom`'s existing threshold gate (in both
`readAtmosphere` and `createRegimeTracker` — two separate closures, kept
separate on purpose, same as their pre-existing `groundFrom`s) now
accumulates `end - start` into one running `recomputeWork` counter on every
ATTEMPTED rebuild, counted whether or not the rebuild survives as a real
ground (a `degenerate_ground` gap still spent the draws×extent compute
inside `ground()` before being discarded — "touched" means work spent, not
work that survived). `readAtmosphere` now returns
`stepsRead`/`recomputeWork`/`recomputeWorkPerStep`; `createRegimeTracker`
gained two getters, `recomputeWork` and `amortizedRecourse` (=
recomputeWork / pushes so far), mirroring its existing
`rezeroCount`/`aperture` getter pattern. No existing caller's return shape
changed — all 8 pre-existing `conformance/atmosphere.test.js` cases pass
unchanged, plus 4 new ones pinning the new fields' own arithmetic (internal
consistency only, never the substantive finding below — pinning a specific
growth rate would be exactly the golden-blind-parameter mistake this
file's own top section warns against).

**Measured** (`scripts/rec-recourse-locality.mjs`, run against the real
shipped Atmosphere configuration — `packages/host/terrains.js`'s
`ATMOSPHERE_REGIME` {window:5, draws:256, tolerance:3, hop:5} and
CHUNK_WORDS=40, gamma left at its own default of 1, the exact pipeline
`host/terrains.js` wires for real, not a swept parameter set — on two
real, unrelated books, pg84-frankenstein.txt and heart-of-darkness.txt):

- Heart of Darkness (977 chunks) never re-zeroed ONCE across the whole
  book — one region, start to end, 0 REC events.
- Frankenstein (1963 chunks) re-zeroed twice. The SECOND region alone
  spanned 1820 of the 1900 steps read at that point — 95.8% of everything
  read so far, touched by that one ground's own rebuilds.
- Amortized recompute work per turn (the streaming tracker, sampled across
  each full read) grows near-linearly with turns on BOTH books: r=0.987
  (Frankenstein, 44→560 per turn from early to late in the read) and
  r=0.998 (Heart of Darkness, 20→409). This is not an artifact of the two
  large regions above; it is the ordinary, pervasive behavior within every
  region, confirmed by an independent arithmetic check: a simulation that
  sums `(position - regionStart)` at every tending hop using only
  Frankenstein's own region boundaries (nothing else) predicts 330,480 of
  total recompute work across the whole read; the actual instrumented
  total was 326,425 — within about 1.2%.

**The verdict the review's own framing asked for, stated plainly:** on
real material, at the real shipped parameters, REC does NOT exhibit the
bounded locality the recourse literature's guarantees depend on. A region
routinely grows to cover almost the entire read before conceding (or never
concedes at all), and because `groundFrom` fully rebuilds the ground from
`regionStart` on EVERY tending step — not only at firing — the per-turn
cost grows with elapsed region length whether or not a re-zero ever
happens. Two DISTINCT causes are both live here and were NOT disentangled
by this pass:

1. **Trigger insensitivity** — `tolerance` consecutive censored-above
   placements is a blunt threshold, and Heart of Darkness never re-zeroing
   at all is consistent with a trigger too strict for some material: slow
   drift that never strings together `tolerance` consecutive violations.
2. **The recompute itself is not incremental** — `groundFrom` reruns
   `ground()`'s full draws-many-shuffles-of-the-whole-region computation on
   every tending step, which the near-perfect linear amortized-cost trend
   (r=0.987/0.998, present from early in the read, not only inside the one
   long-lived region) implicates at least as much as the trigger does. This
   may not even be a fixable "bug" in the naive sense: `ground()`'s own
   header notes the null's `extent` must track the region's current length
   because a max-over-windows statistic's resolution changes with it — an
   incrementally-amortizable update may need a genuinely different
   statistical formulation, not just a cache.

**Amended same day — a smarter trigger was actually tried, on user
direction, and cause 1 turned out not to be the fixable one either.**
`difference()` (nul/index.js) already carries the exceedance MAGNITUDE, not
just a boolean, on every `exceeds_witness` gap (`observed - support[1]`) —
so a magnitude-weighted cumulative trigger (CUSUM-shaped: accumulate
normalized excess, leak a fixed amount per calm step, fire at a threshold)
is buildable without any new engine-level computation. Three candidates
(decay-by-1, decay-by-half, and a leak/threshold CUSUM) were replayed
against the real per-step `difference()` trace on Frankenstein, Heart of
Darkness, and Pride and Prejudice, driven through a scratch harness
cross-checked byte-for-byte against the real `readAtmosphere` output
before any candidate's numbers were trusted (the harness's first two
drafts each had a real bug — a stale ground never refreshed on tending
steps, then a stale array-tail comparison that let a later region's own
span spuriously match an earlier region's fire — both caught by that
cross-check, not assumed away).

**Decay does nothing on the real books tested.** Frankenstein's and Heart
of Darkness's above-censoring events are either already adjacent (fire
identically to baseline) or spaced far enough apart that ordinary decay
rates drain the memory between them; both decay candidates reproduced
baseline's exact spans on every corpus tried.

**Heart of Darkness's problem is signal sparsity, not trigger blindness.**
Only 3 above-censoring events occur in the entire 977-chunk read (at hops
50, 80, 85 — the last two adjacent, one short of tolerance=3), with
magnitudes of 0.10/0.12/0.25 (normalized excess). A leak fast enough to
stay safe on iid noise (0.15/step, the value tried) fully drains any one
event's magnitude within ~2 steps — nowhere near enough memory to bridge
30-step gaps between rare events. A leak slow enough to bridge that gap
was NOT calibrated against a null before this pass ran out of budget, and
this is the load-bearing point, raised directly by the user mid-session:
**the leak rate is a magic number right now, not a Born-rule / null-derived
one** — exactly the class of parameter this file's own top section forbids
tuning by checking what it does on real material. A leak slow enough to
catch Heart of Darkness's sparse signal, swept by hand against only three
books, would be indistinguishable from calibrating against the answer key.
Worse: a leak with NO decay at all (pure lifetime count, fires at 3 total
events ever) trivially fires on Heart of Darkness, but on a sufficiently
long read it is GUARANTEED to eventually misfire on pure noise too, no
matter how rare the background above-rate is — violating the exact
0/20-false-alarm guarantee `MIN_GROUND`'s own multi-pass calibration
history (above) was built to hold.

**What a real fix needs, named rather than attempted blind:** the leak
rate wants the same treatment `slackRunNull` already gives run-length —
built from the ACTUAL background rate of above-censoring events on
structureless material (drawn from a null, not eyeballed), so the leak is
provably slower than genuine sparse-but-real drift yet still provably
bounds the false-alarm rate as read length grows, checked at more than
one length the way `falseAlarmRate` above was starting to (900 and 3000
steps) before this pass stopped. Not built this session — disclosed as
real, scoped, next work, same as cause 2. `REC-TRIGGER-CALIBRATION-
BRIEF.md` (repo root) is a self-contained handoff for whoever picks this
up: the exact numbers, the two harness bugs already found and fixed once
(don't re-find them), the acceptance criteria for either a real fix or a
correctly-refused one, and what not to touch.

**Disclosed, not fixed — on purpose, not by default.** Neither cause was
acted on. A smarter trigger (a CUSUM-style potential function was the
literature's own suggestion) would address cause 1 alone and would not
touch cause 2, which the evidence above implicates at least as much — and
per this file's own standing rule, any new trigger threshold would need its
own real-and-null calibration exactly as rigorous as `slackRunNull`'s
(measured false-alarm rate, a real seam still found, checked on more than
one corpus) before it could responsibly replace a mechanism whose current
`tolerance`/`MIN_GROUND` numbers already cost multiple dated calibration
passes (see this function's own header) to earn. Doing that properly is
real, scoped, future work — not attempted blind in the same pass as the
measurement that motivated it, and not clearly the higher-leverage fix
given cause 2's own likely weight.

**The fourth question — recourse or stability, decide on purpose — is left
genuinely open, not decided here.** This pass measured recourse locality
and found it wanting; it did not measure input stability (would a small
change to the material produce a small change in where regions fall) at
all, so there is no evidence here to weigh one against the other. Which
guarantee Atmosphere should actually optimize for is a design choice for
whoever owns this organ's next pass, not something a measurement script
gets to decide unilaterally on the codebase's behalf.

**Files.** `packages/engine/loops/atmosphere.js` (`recomputeWork`
accumulator in both `groundFrom` closures; `stepsRead` counter in
`readAtmosphere`; `recomputeWork`/`amortizedRecourse` getters on
`createRegimeTracker`). `conformance/atmosphere.test.js` (4 new cases, all
on the new fields' own arithmetic). `scripts/rec-recourse-locality.mjs`
(new, re-runnable, not a committed regression test — matching this repo's
own `scripts/causal-surprisal-gamma-calibration.mjs` posture). Full suite:
1121/1125 passing, 3 skipped, the same 1 pre-existing failure this
worktree already carries (`conformance/host-terrains.test.js`'s belief-
graph-standing referent-fragmentation case, unrelated to this change and
confirmed via `git stash` to fail identically without it), zero
regressions.

# What the generation apparatus measured

Reproduce with `node scripts/imagine.mjs` (what it says) and
`node scripts/generation-competency.mjs` (whether saying it is worth
anything). Corpus is fetched, not vendored — `scripts/corpus/` is gitignored;
see the headers of those scripts for the sources.

Every declared number is at the top of the script that used it. None of them
is a default anywhere in the engine — `createLayer` throws if `order`, `gamma`
or `alpha` arrives missing, `createBelief` throws for `rho` whenever there is a
share to divide, and `createGenerationTask` throws for `conditioning`,
`selection` and `prior_ids`.

## It reads a book and says what it thinks comes next

Frankenstein as the read text, Dracula / Jane Eyre / Moby-Dick as received
priors, each naming its giver. `order=4 alpha=0.7 gamma=0.99995 horizon=24
conditioning=free-running selection=sampled`. Free-running: every form after
the first conditions on the reader's **own** previous word, not the book's.

At 71% of the way through, having read this book only:

> more cheerful air, and the presence of my friend could in the latter end of
> misery and grief. it had been her

The same moment, having also read the other three (`borrowed=23.2%`):

> sweet, and the cottage so ardently miserable spectacle the same lulling t.
> this book ii look of his age — a miserable

What actually came next:

> pause of consideration of whether i should leave my labour for the night or
> hasten its conclusion by an unremitting attention to it.

No model was downloaded and no network was touched at run time. This is counts
over forms the reader has met, decayed by recency, interpolated across context
lengths — `emergence/surprise.js`'s `priorContinuationNull` already built and
sampled exactly this distribution and then discarded the sample to keep the KL.

**Read the right way round.** Every continuation above is stamped
`register: "imagined"`. It is the ground read forward, not a claim about the
book, and it needs no witness because it asserts nothing. The guarded moment
is the crossing — see below.

## EARNED: Amendment IV holds on real material

`node scripts/relevance.mjs`. Frankenstein read once, in order, against three
gifts and three noise floors. `order=4 alpha=0.7 gamma=0.99995 rho=0.9995
seed=20260731`, 60,000 forms taken from each gift. Every gift's standing is
updated against each arriving form using only the context that preceded it, so
the whole measurement is causal.

Each real gift is paired with a control built from **its own** vocabulary,
shuffled — same word frequencies exactly, all order destroyed.

Share of the borrowed mass, as the reading proceeds:

| at form | dracula | jane-eyre | moby-dick | shuf:dracula | shuf:jane-eyre | shuf:moby-dick |
|---|---|---|---|---|---|---|
| 10,609 | 23.1 | 26.9 | 21.8 | 9.4 | 9.6 | 9.2 |
| 31,827 | 24.3 | 28.1 | 20.4 | 9.9 | 9.1 | 8.2 |
| 53,046 | 23.9 | 29.3 | 20.8 | 8.9 | 8.7 | 8.3 |
| 84,874 | 24.0 | 25.5 | 22.6 | 9.8 | 9.3 | 8.9 |

**Every real gift sits at roughly 2.5× its own noise floor, at every
checkpoint, for the whole book.** Restriction 3 is satisfied: what the gifts
contribute is not word frequency, because a control with identical word
frequencies and no order earns less than half as much. The read text supplies
its own unigram statistics, and the gifts are being heard for something else.

**What is NOT established by this run.** The ordering among the real gifts —
jane-eyre 25.5% > dracula 24.0% > moby-dick 22.6% — spans 2.9 points, against
a 13-point gap to the floor. It is stable across all eight checkpoints and it
is the ordering one would guess (Jane Eyre is the closest of the three to
Frankenstein's register; Moby-Dick the furthest). Stability under one seed is
not a null test, and this run does not license "Jane Eyre is more relevant to
Frankenstein than Moby-Dick is" as a finding. The finding is real-vs-shuffled.

### The first implementation of the clause was degenerate, and the fix is the clause

Recorded because it is the second time in this work that a constitutional
sentence turned out to have an arithmetic that did not say it.

The first version took the softmax over the **discounted sum** of log
likelihoods. On a real book that saturates: the sum's scale grows with the
effective window (1/(1 − rho)), so within a few thousand forms the gaps
between gifts are hundreds of nats, `exp` underflows, and the mixture goes
one-hot. It reported **jane-eyre 100.00% and everything else exactly 0.00%, at
every checkpoint**, and the noise floor underflowed to 0 as well, which made
restriction 3 unfalsifiable at the same stroke. Relevance had become a hard
selection. Restriction 2 was satisfied only on paper — a gift 300 nats ahead
cannot be caught by any stretch of text a book actually contains.

Dividing by the discounted count of encounters makes the weight a **per-
encounter mean**, which is what Amendment IV says relevance is: "the surprise
that did not happen", per thing encountered, not summed over everything ever
read. So the correction is not a rescue of the arithmetic. It is the
arithmetic finally saying what the clause says.

## REFUTED: lemma abstraction does not improve next-form prediction

The headline result, and it is negative.

SEED.md Amendment IV consequence 5 says cross-modal analogy is free at the
numeric series and owed **a shared abstraction over forms** everywhere else.
`generation/abstractions.js` builds that abstraction and
`scripts/build-morphology-prior.mjs` supplies the first one from UniMorph
English (224,550 lemma/form pairs read, 216,011 dropped as recoverable by
`morphology.js`'s own suffix rule, **5,531 irregular forms kept**). On
Frankenstein it abstracts 2,900 of 7,017 types (41.3%) away from identity, and
does so correctly: `went→go`, `saw→see`, `mice→mouse`, `walked→walk`,
`cats→cat`.

Held-out mean loss, nats per form, order 4, scored on forms 60,000–63,000:

| training forms | surface only | + lemma abstraction | delta |
|---|---|---|---|
| 1,000 | 4.536 | 5.113 | **−0.576** |
| 4,000 | 5.341 | 6.284 | **−0.944** |
| 16,000 | 6.310 | 7.674 | **−1.364** |
| 40,000 | 6.763 | 8.278 | **−1.515** |

Worse at every training size, and worse the more it has read — so it is not a
sparsity story that more data would fix.

### Three fixes that each corrected a real defect and did not rescue it

Recorded because each was a genuine bug and because together they are what
makes this a finding rather than a first attempt.

1. **Chain ordering.** The abstract levels were interleaved with the surface
   levels at matching reach. Ranked strictly below the whole surface chain
   instead: −1.602 → −1.591 at 40k.
2. **A near-identity abstraction.** `lemmasOf` always includes the form itself,
   so `min(lemmasOf(form))` returned the word unchanged for every word the
   prior does not cover. The abstraction was mostly the identity function,
   which can only dilute. Fixed to prefer a real lemma: −1.591 → −1.602 at 40k,
   while raising genuine merges from a handful to 41.3% of types.
3. **Pooled counts read as confidence.** Witten-Bell's share is `n/(n+alpha)`,
   calibrated for "how often have I seen THIS context". An abstract context's
   `n` is inflated purely by coarseness, so lambda went to 0.9999, the abstract
   level swallowed nearly all remaining mass, and the unigram level that
   actually covers rare forms was left with ~1e-4 of what it needed. Corrected
   by dividing by the number of distinct surface contexts pooled in — derived
   from the table's own structure, no constant picked: −1.602 → −1.515 at 40k.

Fix 3 is kept regardless of this result: it is correct independent of whether
any abstraction earns its place, and any future one needs it.

### What this does and does not refute

It refutes **lemma abstraction, as a backoff level, for next-form prediction,
in this belief**. An order-4 surface chain already backs off through orders 3,
2, 1 and unigram; the lemma level appears to be largely redundant with those,
and every share it takes comes from a level that was doing better.

It does **not** refute the abstraction mechanism, which is what Amendment IV
consequence 5 actually owes. `classAbstraction` and `composeAbstractions` take
any inventory through the same door, and a class inventory is a different claim
about what groups with what. Under the growth rule the mechanism is unwired
until something measured earns it, and `candidate:abstracted` is deliberately
not in any default suite.

### The gift's own limits, reported rather than patched

UniMorph English's noun paradigms are incomplete: `child → children` is simply
absent from the source, though `mice → mouse` and `went → go` are present. And
the suffix rule produces `was → wa`, a false positive on an irregular the table
does not cover. Neither was worked around. A prior is a gift, and its coverage
is a fact about the gift.

## The part not measured yet

`scripts/generation-competency.mjs` runs the full prequential comparison —
every candidate a minimal contrast against `baseline:markov-4`, sealed
commitments, leakage-guarded reveals, scoped competency records. It has not
been run to completion here: the first run was measuring the peer-weighted
mixture that Amendment IV replaced, and re-running it after the amendment
landed was not finished within this session. **So there is no competency-gain
table in this file, and there should not be one until that run completes.**
What is above is held-out loss, measured directly and stated as such.

Known from a completed short run on synthetic material only: the apparatus runs
end to end, candidates clear the uniform floor, and the ordering
`markov-k > copy-previous > unigram > uniform` comes out as it should.

## A defect this found on the way, in the substrate it inherited

`baseline:copy-previous` beat every real belief on its first run **by declining
to say anything**. `sequence-log-loss` routed any target outside a step's
support to the unseen reserve, so an emitter could park its mass there and pay
almost nothing for being wrong. The reserve had quietly become a bucket for
"any word other than my guess", which is the opposite of what it is for. The
fallback is now conditional on `covers_vocabulary`, and the cheat is pinned by
`conformance/generation.test.js`.

Also found: `crps` and `pinball` checked `observed` before `kind`, inverting
`scoring.js`'s own documented contract — a well-formed emission whose kind has
no proper rule must report improper, not throw.

And twice, an invisible character. `UNSEEN` was U+0000 in one file and a plain
space in another. The context separator was a literal U+0001 in two places and
a true empty string in a third, so every order-2-and-deeper lookup missed
silently and fell back to a shorter context — indistinguishable, from outside,
from a belief that is merely weak. Both were found by running things. Neither
was found by reading them, and the second was found only because the fast path
was pinned against the full distribution by a test whose entire job is to
assert that two ways of computing one quantity agree.

## REFUTED, TWICE, AND THE SECOND TIME IS THE USEFUL ONE: an abstraction as a backoff level

`generation/slots.js`, measured on *Heidi* (Johanna Spyri, PG 20781; 62,300
forms), held-out span at the 75% mark, forms 46,728–49,728, never trained on
and never induced from. Reproduce with
`node scripts/slot-abstraction.mjs scripts/corpus/pg20781.txt 46728` and
`node scripts/slot-mechanism.mjs`.

The lemma result above refuted **UniMorph lemma abstraction**. This refutes
something wider and states the replacement it owes.

### The first build was refused by the constitution, and the measurement said so first

The organ began by deciding that two forms share a slot by **cosine
similarity between their surface co-occurrence vectors**, settled by k-means.
The constitution's II.8 names that mechanism twice: *"no cheap compatibility —
never a dot product, overlap, or learned similarity over surfaces"*, and *"no
averaging of grounds"*, which a centroid is. Amendment 3 enforces it as
`weights_present`, and `true` on an engine placement is refuted.

It was refused on the numbers before it was refused on the article. Sweeping
the resolution of the grouping at 40,000 training forms:

| classes | cohesion | delta vs surface | shuffled control |
|---|---|---|---|
| 6 | 0.5216 | −0.570 | −0.341 |
| 16 | 0.6023 | −0.843 | −0.465 |
| 48 | 0.6731 | −0.888 | −0.483 |
| 140 | 0.7564 | −1.063 | −0.538 |
| 400 | 0.8800 | −1.218 | −0.741 |

Monotone in both columns. **The tighter the grouping, the worse the reading**,
and the real inventory is worse than its own shuffled floor at every matched
resolution — classes induced from destroyed order damaged the belief *less*
than classes that captured real co-occurrence. A weighted combination of what
is already there cannot differ from itself, and the harder it weights, the
more it costs. That is II.8 arrived at from the other side.

### The rebuild is constitutional, and it works as a discovery organ

Per II.9's first consequence — *"a cheap sense organ is legal and useful; a
cheap sense organ promoted to the verdict is refused"* — the cosine was kept
and demoted to **nomination**. The verdict is a perturbation with a null:
substituting B where A stood must move the ground less than a **reseeding**
does, where B's successors are redrawn from the material's successor-position
distribution keeping B's evidence count exactly and destroying which forms it
licensed. Reported as a rank against `draws`, censored below, no threshold
anywhere.

At 40,000 training forms, 20,435 pairs nominated:

| | confirmed | types placed |
|---|---|---|
| real material | **28.7%** | 854 |
| order destroyed | **4.5%** | 686 |

A 6.4× separation. The verdict refuses 69% of what the sense organ hands it
(14,088 refused by the null, 474 unwitnessable), and it tells real material
from shuffled material cleanly. **As an organ for discovering which forms
occupy one position, this is earned.**

*The first null was wrong and is recorded because the trap recurs.* It drew a
**frequency-matched stranger** — another form with about as much evidence as
B. On the conformance fixture it confirmed 0 of 177 pairs, because a frequency
band is full of true positives: the "strangers" drawn as a null for `cat`/`dog`
were mostly other nouns. The null contained the hypothesis, so nothing could
ever be closer than all of it.

### And spending it as a backoff level still loses

| training | surface | + slots | delta | + shuffled | delta |
|---|---|---|---|---|---|
| 1,000 | — | — | *refused: degenerate_ground* | | |
| 4,000 | 5.919 | 7.069 | **−1.150** | 7.134 | −1.215 |
| 16,000 | 6.396 | 7.514 | **−1.118** | 7.259 | −0.863 |
| 40,000 | 6.472 | 7.406 | **−0.934** | 7.028 | −0.557 |

So a grouping that demonstrably captures substitutability, witnessed against a
reseeding null, still makes next-form prediction worse — and at 16k and 40k
**still worse than its own shuffled control.**

**This is the finding, and it is larger than the lemma result.** The harm is
not in where the inventory came from. A received lexicon lost by 1.52
nats/form and a derived, null-witnessed inventory loses by 0.93, both against
the same surface chain, and in both cases a *better* grouping does *more*
damage. The harm is in the **spending**: an extra backoff level whose
Witten-Bell share rises with how much it pools takes mass from levels that
were doing better, in proportion to how coherent it managed to be. Fix 3 above
(dividing by distinct pooled surface contexts) already corrects part of this
and is not enough.

SEED.md Amendment IV consequence 5 asks for a shared abstraction over forms.
Two independent inventories now say the debt is **not another inventory**. It
is a mechanism for spending one that is not a backoff level — the abstraction
has to constrain *which* form is chosen rather than compete for mass with the
levels that already know. `slotExpectation` is built for exactly that reading
(H_form vs H_class: the position that knows its kind and not its word) and is
**not yet wired into any emitter**. Under the growth rule that makes it
unwired and therefore refuted; it is the next thing to earn.

### Two defects this found on the way, both by running

- **The conformance fixture, not the organ.** Cycling `NOUNS[i % 15]` beside
  `VERBS[(i * 7) % 15]` makes the pairing deterministic, so each noun licenses
  exactly one verb and no two nouns are substitutable. The organ refused them,
  correctly, and the test was wrong. Members of a group now draw independently.
- **A nine-type corpus is not a small test, it is one the organ declines.**
  With too few forms there is no null of nonzero width, every pair returns
  `exceeds_witness`, and `induceSlots` refuses rather than inventing a
  grouping — SEED.md #3 holding at the fixture boundary.

## The scoped reader runs, and has no boundary to run in

`node scripts/speak-from-here.mjs scripts/corpus/pg20781.txt 0.75`. Heidi,
62,300 forms, standpoint at form 46,725. The machinery of `settled.js` +
`standpoint.js` end to end, with the fold boundary taken from
`loops/atmosphere` rather than declared.

### What worked

The settled ground is exact and cheap. Conformance sweeps every form in every
context against the unscoped belief at 1e-12, on both the O(order) fast path
and `expand()`. Measured earlier at a hand-passed boundary: 70,480 → 7,820
entries per continuation, seal 235ms → 25ms.

### What did not: ONE boundary in 46,725 forms

| | |
|---|---|
| boundaries atmosphere found | **1**, at form 354 |
| the resulting "present" | 46,371 forms |
| vocabulary the reader speaks from | **97.4%** |

There is no scoping. The live wave is the whole novel, and the scoped emitter
is 1.5× faster only because it is barely scoping anything.

**And the one boundary is CORRECT, which is the interesting part.** Form 354
is where Project Gutenberg's front matter ends and the prose begins — the
transcriber's note, the PGDP credits, the publisher's preface. Atmosphere
found the single genuine change of ambient ground in the document. It is not
malfunctioning; it is reporting that *a novel does not concede its ground
again*, at this grain, on this statistic.

So the architecture has no within-book boundary detector. `surf`'s waves are
the obvious next source and carry a caution rather than a ground: surf as a
CANDIDATE GENERATOR is refuted (bba5b29, 0.66–0.71× chance at matched budget).
Surf as a boundary is a different question and has earned nothing yet.

### THE SMALL GROUND IS THE LOUD ONE — a real defect, not a scale artefact

With `perished` = 354 forms of boilerplate and `live` = the whole book, the
reader still reached back **6 times in 20** and imported the publisher's name,
a copyright year and a page number into imagined prose.

The cause is in the mixture and it generalises past this run. λ apportions
`1 − λ` to the settled ground on the strength of the LIVE ground's evidence
alone — nothing asks whether the settled ground has anything worth saying. A
192-form boilerplate ground receives exactly the share a 46,000-form memory
would. Where the context is rare λ collapses and the boilerplate gets almost
everything.

This is the same shape as a defect `belief.js` already logged for foreign
gifts — "it makes a book audible for KNOWING THIS CONTEXT rather than for
BEING RELEVANT TO THIS TEXT" — and the relevance machinery built to fix it does
not engage here: `shares()` returns `[1]` for a single received layer, so the
self-past is weighted unconditionally. **A one-gift mixture has no relevance
test at all**, and that was invisible while every run had three gifts.

### A third defect, found on the way

`stripContainer` leaves the transcriber's note and PGDP credits in the
material. The container is leaking into the text it is supposed to strip, and
every form-position number in this file is shifted by it.

## The window is a coordinate division, and both genetic detectors refuse to cut

Three organs were asked for the window of what is relevant. The first two
answered a different question correctly, and the third one's own header said
so before the measurement did.

| source | waves/boundaries over 2,952 sentences | present | reader speaks from |
|---|---|---|---|
| `atmosphere` re-zero | 2 (both in the first 156 forms) | 46,429 forms | **98.8%** |
| `surf` genetic (`mode: "surfeit"`) | 4, the one containing `here` spanning [28..2944] | 46,429 forms | **98.8%** |
| `surf` coordinate (`mode: "extent"`) | 25, present [2888..2944] | **1,041 forms** | **10.5%** |

**Both genetic detectors are correct and neither cuts.** They fail for one
cause, and SEED.md #5 already names it: the ground grows over the whole
regime, becomes wide, and nothing exceeds it — "a statistic whose window
follows material length means a different thing before and after material
arrives."

`surf`'s header states this as design rather than limitation: *"The subjective
unity dominating the process forbids the division of that extensive
quantum... surf has no code that splits it, AND THAT IS NOT AN OMISSION."*
Genetic division is one uncut ground by construction. Cutting is the
**coordinate** mode, which "ignores the subjective unity by construction,
which Whitehead says in as many words is what dividing does." Asking the
genetic division to produce a window was asking it to do the thing it exists
not to do.

The coordinate cut declares `every` and marks every standpoint `mightBe`.
That is what separates it from the sliding window II.8 refuses: it does not
claim the material changed here, it claims a reader may stand here, and it
says so in the record instead of hardening into a found boundary.

### And atmosphere's boundary was the CHROME boundary

The previous entry reported "1 boundary in 46,725 forms" as a failed detector.
That misread a correct detection. Form 354 was the seam between Project
Gutenberg's container and the work. Atmosphere concedes ground where the
AMBIENT changes, and in a novel that happens essentially once.

Chrome is general — credits and transcriber's notes here, headers and
signatures and quoted replies in a mailbox, running heads in a scan, an intro
in a video — and "the region that does not participate in the ground the rest
of the material builds" is exactly what a conceded ground names. That is the
organ working, at the only scale where a novel has an ambient change.

### Scoped, the reader is 7.6x faster and reaches back a third of the time

| | |
|---|---|
| per continuation, scoped | **13ms** |
| per continuation, unscoped | 99ms |
| reached back | 4–7 of 20 forms |

`reached_back` is the reading rather than the benchmark: it counts how often
the present could not supply the next form. A stretch where it climbs is a
stretch this standpoint does not cover.

### Two defects fixed

**The container leaked past its own marker.** `stripContainer` cut at
`*** START OF ... ***` and stopped, leaving PG's producer credits and a boxed
transcriber's note in the material — 117 forms, and they became the perished
ground of the standpoint reader, which is why it said a publisher's name in
the middle of imagined prose. Leading container paragraphs are now stripped by
FORM (ornamental rules, box drawing) plus one format marker (a PG URL),
bounded to the leading run so an author's own ornament inside the work
survives. Offsets accumulate through the strip; a version that forgot would
silently shift every citation.

**A lone gift is ungated, and that is a hole rather than a simplification.**
`shares()` returns `[1]` for a single received layer, so it takes the whole of
`1 - lambda` without earning any of it — no decay, no floor, no measured
standing. Every restriction Amendment IV places on relevance is skipped. It
was invisible for as long as every run had three gifts.

`relevanceReport` now declares `gated` and `ungated_reason` so the unearned
share is visible in the record, and `standpointBelief` supplies a shuffled
control of the perished material — order destroyed, vocabulary intact — which
makes `received.length === 2`, puts `rho` in play, and turns relevance back
into something measured. That is the existing machinery engaging, not a new
mechanism.

**Not yet done:** the standpoint belief has no consumption loop, so
`witnessForm` is never called and both layers sit at their initial 50/50. The
floor exists and is not yet exercised.

## EARNED: chrome is recognised by a prior, not detected by a pattern

`node scripts/chrome-is-known.mjs`. Heidi (PG 20781) read from form 0 with its
container INTACT, against Frankenstein (PG 84) also intact. Nothing stripped;
no marker, URL or box-drawing consulted anywhere. `order=4 alpha=0.7
rho=0.9995 seed=20260731`.

| region | nats/form vs prior | vs shuffled prior | lift |
|---|---|---|---|
| PG licence block | **0.15 – 0.46** | 9.33 – 9.44 | **~9.1** |
| "other information and formats" | 1.64 | 10.46 | 8.82 |
| this book's front matter | 10 – 20 | ~same | **~0** |
| prose | 8.2 – 10.6 | 9.2 – 11.6 | 0.3 – 2.2 |

**The licence block costs the reader essentially nothing — a 20-60x gap
against prose — with no format knowledge in the loop.** The shuffled control
settles what kind of recognition it is: same vocabulary, no order, 9.4 nats on
the same text. The lift is structural.

### The unpredicted result, and the strongest part

**The book's own front matter stays expensive.** Title, author, illustrator,
translator, publisher, year: 10-20 nats/form at a lift of ~0, because
Frankenstein's prior has never met `Spyri`, `Lippincott` or `1915`.

So the measurement DERIVES the distinction eoreader4.2 hand-coded as its
`FRONT_FIELD` allow-list. Chrome is what a prior covers; the title page is the
book telling you what it is, and no other book's prior can cover it. A written
list of field names was an approximation of exactly this quantity.

### What this refutes about the rest of this session's chrome work

Three implementations across three engines, all pattern-matching one
publisher — 4.2's `stripGutenbergBoilerplate`, 5's `indexOf`, and this
session's line-anchored markers plus `pgdp.net` plus box-drawing detection.
None of them reads a mailbox, a scan, or a transcript. Each is a prior that was
never received properly.

The cold-start objection to a physics gate — that the leading region is where
a reader has the least ground of its own, and `fold` refuses there outright —
does not survive SEED.md #1. "A standpoint with nothing settled behind it
cannot grow a ground; the first one must be RECEIVED, not derived." A reader
that only builds grounds from the material in front of it cannot skip
anything. That is not a limitation of the engine; it is what reading without
priors IS.

### NARROWED BY ITS OWN ADVERSARIAL TEST

`node scripts/chrome-needs-the-right-prior.mjs`. Same document, same declared
numbers, three priors:

| | prior WITH container | prior PROSE ONLY | shuffled prose |
|---|---|---|---|
| licence block | **0.28** | **9.49** | 10.42 |
| prose | 9.29 | 9.32 | 10.04 |

**A reader that has read an entire novel and never seen a licence finds the
licence block MORE expensive than prose** — 9.49 against 9.32. The 33x gap was
entirely the prior having met that exact container.

So coverage is SPECIFIC, and the broad reading of the result above is refuted
by its own measurement. "Read with priors" is not "any priors will do."

Which lands the finding on II.2 rather than making it a technique. That a
licence block is container is WITNESS KNOWLEDGE ABOUT THE MATERIAL'S FORMAT —
received, naming its giver, and deriving it is a wall. Every hardcoded
stripper in this lineage was therefore not a mistake about mechanism but a
CONTAINER PRIOR WRITTEN IN THE WRONG TIER. `stripGutenbergBoilerplate` IS the
container prior for PG; it lives in code, unnamed and ungiven.

The consequence is not to delete the pattern-matching. It is that container
knowledge belongs in `eoPriors` naming its giver, that the engine reports a
TYPED GAP where no container prior covers the material rather than silently
reading chrome as content, and that the physics stays the CHECK rather than
the finder — a container prior that does not make its region nearly free is a
prior that is wrong about this document.

Proposed as a constitutional amendment in `specs/chrome-is-recognised.md`
(a PROPOSAL — IV.2, agents propose and humans dispose).

## EARNED: the prequential run completes, and the scoped path is the same belief

`node scripts/scoped-prediction.mjs`. Heidi on NET material — container
subtracted at offset 2,470 — standpoint at form 46,637 (75%), present set by
surf's coordinate division at form 45,596. 132 sentences x 12 withheld forms =
1,584 sealed, revealed, leakage-guarded targets. `order=4 alpha=0.7 every=30
hop=4 stride=5 seed=20260731`.

### Teacher-forced: the representation, isolated

| | cumulative loss | per form | entries sealed | seal time |
|---|---|---|---|---|
| scoped | 11,238 | **7.095** | 581,328 | 384ms |
| full | 11,238 | **7.095** | 5,513,904 | 4,205ms |

**EXACT agreement, at 10.9x cheaper sealing over 9.5x fewer entries.** The
settled ground carried by reference is the same belief, not an approximation
of it — proved on real material, not only on a fixture.

### Free-running: the reader, honestly

| | per form |
|---|---|
| scoped | 11.051 |
| full | 11.015 |

The two diverge by 57 nats over 1,584 targets (0.3%) because they are
genuinely different emitters free-running: the scoped one takes its mode over
the LIVE support and the full one over everything, so a differing choice at any
step compounds. That difference is a decision declared on the emission as
`selection_scope`, not a defect — and **the cost of speaking only from what is
in play is 0.3%, not the 3x the first run reported.**

### THREE DEFECTS, ALL IN THE SCORER, NONE FOUND BY READING

The first run reported scoped 30.9 against full 11.0 and I nearly published it
as "scoping costs 3x". Every one of the three was found by refusing to trust a
number, and the third was found only because the second control still failed.

1. **The settled ground consulted only as a fallback.** The first scorer read
   `step.live[form]` and asked memory only when the present had no entry. A
   form BOTH grounds know receives mass from both, and belief.js sums them.
   Under-priced every common word: 0.045 against 0.033 on a three-form target.
   Caught by the conformance identity test.

2. **The free-running comparison was not a control.** Two emitters walking
   different paths price a target at different contexts, so it measures the
   emitters, not the representation. Teacher-forcing holds contexts identical
   and is the actual control. `emitScoped` could not teacher-force at all,
   which is a real gap given the task record DECLARES conditioning.

3. **NO UNSEEN RESERVE — the one that produced the 3x.** A form neither ground
   has met is UNMET, and `sequenceLogLoss` routes it to the reserve. The
   scoped scorer charged the finite floor: **708 nats for one unmet form,
   dominating an entire continuation** — 815 against 81 on one twelve-form
   target. Conditional on `covers_vocabulary`, which a scoped emission may
   honestly assert because both its grounds back off to order 0.

The conformance fixture never exposed defect 3 because its small vocabulary
had no unmet forms. **A fixture with no unmet form cannot test the reserve**,
which is exactly the sort of hole the repo's own history keeps recording.

## A third spending mechanism refuted, and a different question that isn't

Two prior sections above establish: an abstraction added as a backoff level
loses, whether the inventory is received (lemma) or derived-and-witnessed
(slots), and a *better* grouping does *more* damage — the debt is in the
spending, not the inventory. `slotExpectation` was named as the organ built to
spend it differently, constraining rather than competing for mass, and left
unwired. `node scripts/predictor-scientist.mjs` and
`node scripts/predictor-atmosphere.mjs` wire it, test it, and ask a further
question the first two sections never reached: is "which predictor is right"
itself a fixed constant, or does it vary — and if it varies, does it vary
*emergently*, by object, or does it converge to one global answer like
everything else tried so far?

Reproduce with `node scripts/predictor-scientist.mjs [text]` (defaults to both
`scripts/corpus/pg84.txt` and `scripts/corpus/pg20781.txt`) and
`node scripts/predictor-atmosphere.mjs`. Corpus fetched, not vendored, per the
header above.

### Experiment 1 — which null design actually separates order from noise

A candidate predictor competing over one span needs a null built from that
span's own reseeding variation, not a global benchmark — but "reseed the
span" has two readings: shuffle the span in isolation, or resample from the
wider material at the same size. `predictor-scientist.mjs` built both, on four
spans of each book, and ranked each span's real loss and its shuffled twin's
loss against both.

**Neither ad hoc design is the answer this codebase already has.** `pattern()`
(`nul/index.js:849`) and its `continueBy` helper (`nul/index.js:790`) settled
this exact question once already, for content: the null must be a
**growth-matched conditional null** — continue `before`'s material by drawing
from itself out to the target extent, then reseed — never a flat shuffle of
what was actually observed and never material sampled from a different
extent. `nul/index.js`'s own history names the cost of getting this wrong:
wired as a flat comparison, `moved` fired on homogeneous noise at almost
exactly even spacing (a clock, not a perception) and recovered 23/24
Frankenstein chapter boundaries **while also recovering 21–23/24 of them from
the same series shuffled** — a coin landing true about `1/(reseeds+1)` of the
time regardless of the material. `pattern()` now refuses the wrong call
outright (`incommensurate_extent`) rather than answering it.

So Experiment 1's own two designs are superseded, not adopted — reported
below for the record, then set aside in favour of the established mechanism,
which Experiment 4 uses directly.

| span (Frankenstein) | real loss | twin loss | span-local: real / twin %ile | global-resample: real / twin %ile |
|---|---|---|---|---|
| 0 | 7.987 | 10.116 | 100% / 0% | 100% / 0% |
| 1000 | 8.217 | 9.916 | 100% / 84% | 100% / 34% |
| 2500 | 7.745 | 9.890 | 100% / 19% | 100% / 50% |
| 4000 | 7.659 | 9.977 | 100% / 16% | 100% / 16% |

Real is a clean outlier under both designs (100th percentile every time — the
predictor genuinely tracks order). The twin's percentile is where the designs
should agree and don't: span-local means 30% (Frankenstein) / 53% (Heidi),
global-resample means 25% / 69% — inconsistent across books, because a random
resample from the wider "before" material conflates "does this span have
order" with "does this span's local vocabulary happen to match the
surrounding pool's," which is a confound the growth-matched design doesn't
have.

### Experiment 2 — nominate cheap, witness expensive

19 candidates (orders 2/4/6 × alphas 0.3/0.7/1.5 × raw-frequency-or-
continuation-count at the floor, plus the slot-gated candidate below), ranked
by a 200-form unnulled proxy against the full 6,000-form held-out score.
Spearman rank correlation **0.995 (Frankenstein), 1.000 (Heidi)**; the
cheap proxy's top 3 and the expensive top 3 were identical on both books. A
nominate-cheap/witness-expensive split — the same two-stage shape `slots.js`
already uses for class nomination — is validated for this candidate family:
null-per-candidate is the expensive step, and a cheap proxy ranks it well
enough to prefilter.

### Experiment 3 — does the winning n-gram shape change, chunk to chunk

Held-out material split into six 1,000-form chunks per book. Every chunk:
nominate the top 3 candidates by the cheap proxy, witness them properly, keep
the winner.

**One configuration won every chunk of both books: `order=2 alpha=1.5`,
counting the order-0 floor by continuation (distinct preceding contexts) 
rather than raw frequency.** Zero emergence on this axis — short order, heavy
smoothing, and continuation counting (the same statistic Kneser-Ney's lower
order uses, and the same shape as `recalled`, the strongest channel in
`scripts/RESULTS.md`'s activation-clearings table) dominates uniformly,
consistent with Brown-clustering-era literature: a stronger local model
narrows the room for anything coarser to help, and continuation-count is
simply a better statistic than frequency at the floor, everywhere tested.

| | Frankenstein | Heidi |
|---|---|---|
| best fixed (order=2 alpha=1.5 cont) | 7.235 | 6.107 |
| worst fixed (order=6 alpha=0.3) | 8.708 | 7.637 |
| random switcher | 8.668 | 7.593 |
| nominate+witness switcher | 7.235 | 6.107 |

The switcher converges exactly to the single global champion — real evidence
against "different chunks want different n-gram hyperparameters," not an
artefact of the search. **This also means the search was pointed at the wrong
altitude for finding emergence**: order/alpha/counting-rule are all still
flavours of local frequency. The genuinely different question — does a
terrain-derived predictor ever win — needed a terrain-derived candidate.

### Experiment 3, extended — the constraint-gated slot spending, tested directly

One candidate was added to the same competition: `order=4 slot-gated`, the
`slotExpectation` reading finally wired to an emitter. For a base surface
distribution and the induced slot classes (same declared numbers as the slot
section above — classes=48, features=400, minCount=4, iterations=12), the
gate computes `β = (h_form − h_class) / h_form` per position and reweights
every candidate form by `P_class(class(form))^β`, renormalised — a product,
not a summand, self-silencing wherever the class distribution has nothing to
say, exactly the shape the earlier sections named as owed.

It never won a single chunk, on either book, and it made its own ungated base
worse, not better, at **every** chunk of both books:

| chunk | Frankenstein: order=4/0.7 ungated | slot-gated | Heidi: order=4/0.7 ungated | slot-gated |
|---|---|---|---|---|
| 0 | 8.153 | 8.683 | 6.612 | 7.019 |
| 1 | 8.203 | 8.792 | 6.512 | 7.049 |
| 2 | 7.802 | 8.326 | 7.155 | 7.568 |
| 3 | 7.839 | 8.397 | 7.135 | 7.565 |
| 4 | 7.909 | 8.379 | 7.055 | 7.470 |
| 5 | 7.876 | 8.474 | 6.900 | 7.311 |

**A third distinct spending mechanism, refuted as cleanly as the first two.**
Interleaved backoff, ranked-last backoff, and now a constraint-gated product
of experts have all been tried against the same class of induced abstraction,
and all three make held-out next-form loss worse. This closes the reading
Amendment IV consequence 5 was hoping to open: constraining which form is
chosen, instead of competing for mass, was the mechanism named as owed — and
it is now measured, not merely unwired, and it does not help next-form
prediction either.

**What this does and does not settle.** It refutes rescaling the *word
distribution* by a class signal for the purpose of guessing the next word. It
says nothing about rescaling the *control parameters* — which received gifts
are live, where λ sits, how heavily α smooths — which is a different node in
the same architecture and was not tested here. The two existing defects on
record in this codebase are the same category error at that other node: a
lone received gift takes its whole share unconditionally (`shares()` returning
`[1]`, "no decay, no floor, no measured standing" — belief.js), and an
abstract backoff level's share is set by its own coarseness-inflated evidence
count, drowning out levels that knew more. Both times a higher-order signal
was given a *likelihood* role — a vote sized by its own local evidence — where
`slotExpectation`'s β is the one place in the repo that already gives a
higher-order signal a *prior* role instead: it reshapes what the existing
terms mean without itself appearing as a term. The slot-gated candidate above
is exactly that shape, applied to a word distribution, and it still lost —
which narrows, rather than closes, the question: does the prior role work
when applied one node higher, to the parameters instead of the distribution?

### Experiment 4 — a predictor's own competency stream, read by the same organ that reads content

Before any such mechanism is worth building, one thing has to be checked
first: does a predictor's per-form loss series, run through the *exact*
`ground`/`pattern` machinery `loops/turn.js` already uses on content —
unmodified, pointed at a different series — produce a real, correctly-timed
correction signal, or does it rediscover the `1/(reseeds+1)` coin-flip bug
`pattern()`'s own history already paid to fix?

`node scripts/predictor-atmosphere.mjs`. A reader trained on Frankenstein's
prose only (`order=4 alpha=0.7`, 30,000 forms) reads three held-out streams —
its own per-form `-log(mass or reserve)` at each position is the material,
never the text:

- **control** — 8,000 forms of held-out prose. Not guaranteed stationary:
  Frankenstein is a frame narrative and changes first-person voice more than
  once.
- **shuffled** — the same control span, order destroyed, same vocabulary. No
  regime change is possible here by construction.
- **splice** — 4,000 forms of held-out prose, then the closing Project
  Gutenberg license (chrome), concatenated — a genuine regime change, and the
  same chrome-vs-prose pairing already on record elsewhere in this repo as a
  register a prose-trained predictor is worse on than a naive one.

Walked in 150-observation steps, `before`/`after` grounds built with
`window=40 draws=32`, `pattern({..., reseeds: 16})` exactly as `turn.js` calls
it, no local reimplementation:

| stream | moved events | where |
|---|---|---|
| shuffled (no regime possible) | 1 / ~53 checks | 1130 |
| control (real prose) | 3 / ~53 checks | 980, 3530, 4280 |
| splice (prose → chrome at 4000) | 7 / ~53 checks | 980, 3530, **4130**, 4280, 6380, 6980, 7130 |

The shuffled control's rate (≈2%) sits below the ≈6% nominal tolerance
`reseeds=16` implies, and does not manufacture a clock — no evenly-spaced
false alarms, unlike the uncorrected `moved`'s history. The real-prose
control's three events are shared exactly with the splice stream up to the
splice point (identical material, identical signal — a reproducibility check,
not three separate false alarms), and are plausibly genuine content-level
shifts in a frame narrative rather than detector noise. The splice stream's
**first new event past the shared prefix lands at 4130 — 130 observations
after the true boundary at 4000, the earliest a 150-step walk can register
it** — followed by further events deeper into the chrome region, itself
plausible given the license text's own internal section breaks.

**This is a positive result, and it stands apart from Experiment 3's
refutation rather than being undercut by it.** It says nothing about which
word comes next; it says a predictor's own competency, read as a plain time
series through the organ this codebase already trusts for content, produces a
correctly-timed, appropriately-calibrated correction signal at a genuine
regime change while staying quiet on one that is order-destroyed. That is the
prerequisite for treating predictor competency as a terrain object with its
own Atmosphere — not the mechanism itself, which remains unbuilt: nothing here
adjusts λ, α, or which gifts are live in response to a `moved` event. It only
establishes that the signal such a mechanism would react to is real and not
an artefact.

### Experiment 5 — the high sets the probability of the low, and where that stops

`node scripts/predictor-reshape.mjs`. Experiment 4 established the signal.
This is what a predictor-Atmosphere's REC does with it — and the design
choice is the same one Experiment 3's slot-gated candidate was named as a
narrow instance of: the reigning predictor's TABLES never change, ever. One
model is trained once, on prose only, holding tables at every order up to 6
and continuation stats, all collected in the same pass. What DEF/EVA/REC
revise is the CONFIG `{order, alpha, continuation}` that reads that one fixed
body of evidence — three control parameters, not one:

- **DEF** nominates every config in a 24-point grid (orders 2/4/6 × alphas
  0.3/0.7/1.5/3.0 × continuation on/off) cheaply, scored on the window that
  just triggered a `moved` event, no null.
- **EVA** witnesses the best candidate against the *same* `reseedNull`
  `pattern()` already computed to detect that regime change — no second null
  invented for this.
- **REC** applies the revision only if witnessed; otherwise the event is
  logged as moved-but-unwitnessed and the config holds.

**A first version of this run started the live config at a deliberately weak
point (order=4 alpha=0.7) and only ever revised alpha.** Its one witnessed
event fired inside the prose region, before the real splice, and turned out to
be correcting that weak starting point rather than adapting to anything —
real, but not the claim "this mechanism adapts to a regime change." The run
below fixes both holes at once: the live config now *starts at the already-
known champion* (`order=2 alpha=1.5 continuation`, Experiment 3's winner), so
any later witnessed event can only be genuine adaptation, never cleanup — and
DEF can now revise order and the counting rule too, not just alpha, so the
champion's own family is reachable by reshaping instead of being a ceiling
outside it.

On the same prose → chrome splice as Experiment 4:

| | prose region | chrome region | overall |
|---|---|---|---|
| fixed naive (order=4 alpha=0.7) | 7.996 | 9.565 | 8.719 |
| fixed champion (order=2 alpha=1.5 cont) | 7.276 | 8.839 | 7.996 |
| witnessed config reshaping, **starting from the champion** | 6.969 | 7.948 | **7.420** |
| hard swap to a chrome-trained model | 8.146 | 5.285 | 5.663 |

Four REC events fired; one was witnessed, at index 980 — again inside the
prose region, before the splice at 4000. This time there is no confound about
*what* it corrected: starting already at the best known static config, it
still found `alpha 1.5 → 3` improved the window it was scored on (0.465
against a threshold of 0.407, barely clearing it) while order and continuation
held. **That is a real, if small, refinement Experiment 3's coarser
1,000-form chunking never surfaced** — the champion found there was the best
config *on average across six wide chunks*, and a window this much narrower
apparently wants slightly heavier smoothing than that average would suggest.
The three later events (3530, 6380, 7130 — one in prose, two well inside
chrome) all re-proposed the config already live and were correctly refused as
no-ops.

**Checked directly, rather than left open: is there a config in the grid the
online walk missed for chrome specifically?** Scored all 24 configs against
1,917 forms of chrome well past the boundary (no transition effects). The
answer is no — `order=2 alpha=3 continuation`, exactly what the walk settled
on, is the #1 best config in the entire grid for chrome too, with a gap of
0.000 against the true best. So "one correction that holds through both
regions" is not a missed opportunity here; it is the correct answer for this
particular splice, on this particular axis. That also means prose-vs-Gutenberg
-boilerplate was too extreme a test to settle the real question — the two
registers are different enough that the same heavily-smoothed, short-context,
continuation-counting config dominates both, leaving no genuine
regime-specific choice for the mechanism to find even in principle. Whether it
can propose *different* configs for two regions that actually want different
ones is still open, and needs two registers of real content, not one register
of content against boilerplate that turned out not to need separate tuning.

**The comparison against the hard swap still draws the same boundary.**
Reshaping narrows the gap in the region it touches but comes nowhere near what
retraining on in-domain material achieves (chrome region: 7.948 against 5.285)
— because a control parameter can only reweight evidence the tables already
hold. It cannot manufacture a conditional distribution the reigning predictor
never counted. **"The high sets the probability of the low" reshapes what is
already known; it is not a substitute for acquiring evidence the low tier
never had.**

### Does any of it beat doing nothing clever at all

The bar that actually matters is not the naive arm — it is the already-known
best static configuration, held fixed for the whole run with no DEF/EVA/REC
apparatus at all. A loop that only ever beats a strawman hasn't earned its
complexity.

| | overall nats/form |
|---|---|
| fixed champion (order=2 alpha=1.5 cont), no machinery | 7.996 |
| witnessed config reshaping, starting from the champion | **7.420** |

**It clears the bar by a wider margin than the earlier, confounded run did**
(7.420 against the champion's 7.996, versus the first version's 7.586 against
the same 7.996) — and clears it now with the confound about the starting
point closed. A single small, correctly-witnessed refinement to the
already-best-known configuration still measurably reduces held-out loss below
that configuration held fixed. That is the first result in this whole line of
work where added machinery earned its cost rather than losing to a simpler
alternative, and it survived being re-tested under a harder, fairer
comparison rather than only appearing under the easier one.

## Reading the Odyssey in Greek: a real learning curve, and which priors actually help

Every experiment above measured a single held-out split. `node
scripts/odyssey-greek.mjs` runs the audit this whole line of work kept
naming and never actually ran: not "is the loss low," but "does SUCCESSIVE,
never-before-seen material get cheaper to predict as more of the SAME book
has been read" — scored continuously across one long text rather than at one
static split. Homeric epic is an unusually strong material for this: oral-
formulaic composition (Milman Parry) is built from repeated epithets and
whole half-lines, so if a statistical reader can exploit accumulated
structure at all, this is where it should show.

Real production code throughout, in ancient Greek, for the first time in
this file's history — the tokenizer needed no changes (`\p{L}` already
covers precomposed polytonic Greek; verified directly, no normalisation
needed). Text: the Odyssey (Perseus Digital Library, canonical-greekLit
tlg0012.tlg002, Allen's edition), 89,260 forms. Three received priors, each
naming its giver (SEED.md #1):

- **the Iliad** — same author, same artificial epic dialect, same formulaic
  system. 114,263 forms.
- **the Homeric Hymns** — same dialect and formulaic tradition, different
  (anonymous) authorship, much shorter. 14,729 forms.
- **the Greek New Testament** (Matthew/Mark/Luke/John/Acts, Koine, SBLGNT) —
  same broad language, different dialect, register, era and genre entirely.
  71,208 forms.
- **+ the shuffled-Iliad noise floor** `priorAugmented` adds automatically.

`order=4 alpha=0.7 gamma=1 rho=0.999 checkpoint=2000 seed=20260731`.

**A performance defect found and fixed on the way, because it matters for
reading this doc's own numbers correctly.** A first version scored held-out
loss through the gift-augmented belief's own `probabilityOf`, which calls
`layer.successors(ctx)` on every received layer to build the admissible-mass
renormalisation — O(vocabulary) per gift per scored token, by design
(`belief.js`'s own comment: "the price of the gate, paid here and not
hidden"). Correct, and ruinous at 89,000 held-out tokens × 4 gift layers: the
run did not finish in five minutes. `witnessForm` — what `observe()` calls
per token to update relevance — only ever calls `layer.massOf(ctx, form)`,
O(order), cheap. So the two questions below are answered by two right-sized
instruments reading the SAME stream in lockstep: a plain, gift-free belief
for the learning curve, and `relevanceReport()` — kept current by the cheap
path alone — for which priors help. Runtime: 8.7 seconds.

### Does prediction get smarter the more it reads — not the answer expected

| | first quarter of checkpoints | last quarter |
|---|---|---|
| real Odyssey | 5.160 nats/form | 6.416 nats/form |
| shuffled Odyssey (order destroyed) | 6.248 nats/form | 9.368 nats/form |

**Loss went UP over the course of the read, for both arms.** The naive
version of the audit — early loss versus late loss, full stop — reads as a
refutation: the reader got worse, not better. That is real and is reported
as measured, not smoothed over. The reason is a genuine confound this design
did not control for: this is not a fixed train/test split, it is sequential
material from a single narrative, and the Odyssey is not stationary —
Telemachus's search in Books 1–4, Odysseus's own first-person adventure
narrative in 5–12, and the revenge plot in 13–24 differ in vocabulary,
named entities, and register. Later held-out chunks are not necessarily
harder to predict FROM MORE READING; they may just be intrinsically harder
material, arriving later. A rising curve on both arms is consistent with
content drift dominating whatever the reader was learning.

**What separates the two arms is the finding.** The shuffled control's rise
(3.120 nats) is more than double the real Odyssey's (1.256 nats) — order
destroyed, the same content drift costs far more. Read as a gap rather than
a trend: real-minus-shuffled advantage was 1.088 nats/form in the first
quarter and 2.952 nats/form in the last — **the reader's advantage from
tracking real order over having none of it nearly tripled over the course of
the read.** That is the honest form of "getting smarter" a non-stationary
text actually supports: not falling absolute loss, but a widening margin
over a matched no-order control as more of the poem's real structure
accumulates. The naive framing from earlier in this conversation — plain
early-loss-vs-late-loss — is retired by this result, not confirmed by it;
the corrected framing is the gap against a control, not the trend alone.

### Which priors actually help

| prior | share (final, after 86,000 forms) | above the shuffled-Iliad noise floor |
|---|---|---|
| Homeric Hymns | 45.7% | YES |
| Iliad | 43.0% | YES |
| Greek New Testament (Koine) | 5.3% | no |
| shuffled Iliad (the floor itself) | 6.0% | — |

Both the Iliad and the Homeric Hymns earned real, sustained standing across
the whole read — never close to the noise floor at any checkpoint. The Greek
New Testament never did: its share tracked the shuffled-Iliad floor almost
exactly throughout (both in the 4–7% band at every checkpoint), meaning
Koine prose earned no measurable trust beyond what a gift with no order at
all would have gotten by accident. **Being "the same language" bought
nothing; being the same formulaic tradition did.** This is SEED.md Amendment
IV's claim — "relevance is not a property of a prior, it is a property of
the meeting between a prior and this material" — read against real
classical material for the first time in this file, and it holds cleanly:
the two epic-tradition gifts, one of them a fraction of the Iliad's size,
both cleared the bar; the register-mismatched gift, despite sharing every
word of its alphabet with the read text, did not.

**The one genuine surprise: the Homeric Hymns matched or exceeded the
Iliad's share at most checkpoints, despite being a fraction of its size**
(14,729 against 114,263 forms) and by a different, anonymous set of authors.
At the 32,000-form checkpoint the gap was largest: Hymns 61.8% against
Iliad's 26.1%. Same dialect and formulaic register bought more standing here
than raw volume of the same author's other epic did — worth reading as a
finding about what actually transfers (formula and register) rather than
what seemed like the obvious guess going in (authorship and length).

## The chrome-vs-prose finding generalises: across two whole novels, still one config

`node scripts/predictor-reshape-crossbook.mjs`. The chrome-vs-prose splice
above turned out too extreme a test — the same config won both registers
because almost nothing else could compete with heavily-smoothed, short-
context, continuation-counting on legal boilerplate. The sharper version:
a reader trained ONLY on Frankenstein prose, reading held-out Frankenstein
and then crossing into held-out HEIDI prose — a different novel, different
author, different era, real narrative prose on both sides, no boilerplate
anywhere. If regime-specific reshaping is real on this axis, two different
novels are where it should show up.

It doesn't. `order=2 alpha=3 continuation` — the same config the chrome run
converged to — is the #1 best config in the same 24-point grid for BOTH
Frankenstein and Heidi, checked directly against deep, transition-free
material from each:

| | best config | loss |
|---|---|---|
| Frankenstein (deep, transition-free) | order=2 alpha=3 cont | 6.805 |
| Heidi (deep, transition-free) | order=2 alpha=3 cont | 7.378 |

One witnessed correction fired, again inside the *first* region (Frankenstein,
at index 2030 — alpha 1.5→3, the same refinement the chrome run found), then
held unchanged through the Heidi region with every later event correctly
refused as a no-op. Overall: 7.228 nats/form for the reshaping run against
7.696 for the fixed champion held throughout — the same margin of
improvement as before, for the same reason as before (a real, small,
correctly-witnessed refinement to the champion), and the same absence of
genuine cross-regime divergence.

**This closes the question rather than leaving it open per-corpus.** Checked
on one book's boilerplate, on that same book's own narrative-voice shifts (the
control in Experiment 4), and now across two entirely different novels: on
the order/alpha/continuation-count axis, there is no regime-specific
configuration to find, anywhere this file has looked. If genuinely emergent,
per-object predictor rules exist — the hypothesis this whole line of
experiments was chasing — they do not live on this axis. The Odyssey section
above already points at where they might: not in how a fixed local model
should be tuned, but in which *received priors* a reader trusts, which
varied by real content (formulaic tradition) rather than by local smoothing
choice, and varied by a wide, clean margin.

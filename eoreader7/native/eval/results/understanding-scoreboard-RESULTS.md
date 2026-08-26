# The understanding scoreboard — baseline, Frankenstein, 2026-08-24

`native/eval/understanding-scoreboard.mjs` asks the two questions V7-CUT.md's
own derived-dynamics clause makes measurable: **does reading further make the
future better predicted** (open identity hypotheses earning their outcomes)
**and the past make more sense** (witnessed recanonicalization of
already-read structure) — scored against a seeded order-destruction null, so
"understanding" has to beat "the same sentences in any order."

Nothing was invented for the score. Every counted event is a consequence
kind the kernel already emits (`identity_hypothesis_opened`,
`discourse_identity_supported`, `identity_split`,
`relation_recanonicalized`, `identity_hypothesis_supported`), and every
"prediction" is a hypothesis the reader itself opened.

## The baseline, measured on the full novel (3,392 sentence encounters)

| | ordered | shuffled #0 | shuffled #1 |
|---|---|---|---|
| hypotheses opened | 898 | 902 | 722 |
| resolved (discourse support) | **1** | 1 | 0 |
| attacked / split | 0 | 0 | 0 |
| past recanonicalized (REC) | 0 | 0 | 0 |
| expectations opened | 0 | 0 | 0 |
| obligations opened | 0 | 0 | 0 |
| provisional left open at end | 897 | 901 | 721 |

Declared numbers: cursors at the material's own quartiles (848/1696/2544);
`SHUFFLE_DRAWS = 2`, `SEED = 0` (runtime budget — a full read is ~2min —
disclosed as licensing no finer claim than "order matters / doesn't").

## The finding

**At this tier, reading Frankenstein in order is indistinguishable from
reading it shuffled.** The reader opens ~900 identity hypotheses per novel
and closes approximately none of them — a 0.1% resolution rate — and the
one resolution appears in a shuffled run too. `deriveRelease` fires zero
times on an entire novel; `deriveTension` networks zero obligations; the
kernel's `remove-provisional` action exists and **no adapter ever emits
it**. The v7 dynamics vocabulary (surprise / tension / release) is
structurally complete and functionally starved: the text adapter feeds it
INS volume and nothing else.

This is not a defect in the scoreboard — it is the scoreboard doing its
job on day one. V7-CUT.md commits to "surprise derives from consequential
DeltaFold; tension from unresolved structure; release from transformations
that resolve or reframe" — and the measurement says the resolve/reframe
half of that cycle currently has no input stream. A reader that
understood the book at the level the book wants to be experienced would
show: hypotheses attacked and split as evidence arrives ("the creature" ≠
"my father"), canonical past edges rewritten under later identity
(pastRemade > 0), and all of it collapsing under the shuffle null. Today's
numbers are the honest zero against which that work can be scored.

## Disclosed limits

- **Grain is the sentence.** The tier ladder ("a book wants to be
  understood as a series of meaningful events, not raw tokens" — the
  altitude gate) is named future work; nothing here claims event-level
  reading.
- **backwardScore counts re-makings by where they LAND**, not by the
  position of the past they rewrite — the REC op does not carry the source
  edge's position. Moot at a baseline of zero; must be sharpened before a
  nonzero result is reported.
- **Two shuffle draws** license only "order matters / doesn't," never an
  effect size. (A fast-run artifact worth recording so it is not re-cited:
  on an 800-sentence truncation the shuffled run appeared to open ~3×
  more hypotheses than ordered; at full length the gap vanishes —
  truncation, not order, was the difference.)
- **Identity alternatives (`textIdentityEvidence`) fire ~once per novel** —
  the support/attack grammar is currently near-inert on real prose, so the
  forward score's live-hypothesis table is nearly empty by construction.

## What would move the score (in order of leverage)

1. **Emit `remove-provisional` / attack evidence from the adapters** — the
   897 open hypotheses are the fuel; resolving or refusing them is release.
2. **Open expectations from relation structure** (a recurring subject with
   an unresolved participant is a prediction about who fills it) so
   `EXPECTATION_STATES` has traffic.
3. **Wire the altitude gate** so cursors and predictions live at the tier
   the material earns, not the sentence.

Reproduce: `node native/eval/understanding-scoreboard.mjs
legacy-eoreader6.1/scripts/adversarial/fixtures/pg84-frankenstein.txt`
(full output committed beside this file).

---

# Amendment, same day — descriptor anchoring lands, and the cycle runs

Leverage move (1) was built: `native/adapters/text/anchoring.js`
generalizes pronouns.js's one-hop activation recall from pronouns to
definite/possessive descriptors, and its bindings feed
`deriveIdentityRevision`'s EXISTING support/attack grammar (kernel
untouched — one identity-revision door, not a second mechanism). Evidence
is born at perception, witnessed as `EOAnchorEvidence@1` graph entries,
and folded like everything else. Opt-in: every caller not passing
`descriptorAnchoring` is byte-identical (all 12 pre-existing native suites
pass unchanged).

Three corrections were forced by driving it against the real book, each
pinned as a regression in `native/tests/anchoring.test.js` (8 cases):

1. **Determiner+function-word bigrams are not descriptors.** "the most" /
   "that the" / "the first" bound confidently to the only cast member in
   reach. Cut by the perceiver's own earned closed class PLUS the received
   POS prior (`bin/priors/pos/en-ud-ewt.json`, UD_English-EWT, CC BY-SA
   4.0) — a head the treebank positively says is not a noun is refused; an
   absent head is kept (furniture is high-frequency and therefore present).
2. **A margin against nothing is not a measurement.** With one admitted
   referent, margin = 1.0 vacuously, and a one-character stretch bound
   every descriptor — "the stranger" (Victor, not yet named) included — to
   Margaret. binding.js's own structural rule applied: one candidate has
   no competition to test (`descriptor_no_competition`, a typed gap).
3. **Two mechanisms shared one consequence kind.** revision.js's
   provisional descriptor hypotheses and identity.js's alternatives both
   emit `identity_hypothesis_opened`; the scoreboard now separates them by
   payload action.

## The measurement, after (same declared numbers, plus the POS prior)

| | ordered | shuffled #0 | shuffled #1 |
|---|---|---|---|
| alternatives opened | 1,639 | 1,438 | 1,733 |
| attacked → distinct (splits) | 441 | 382 | 502 |
| **past recanonicalized (REC, `from` ≠ null)** | **55** | **21** | **12** |
| first canonicalizations | 53 | 41 | 32 |
| expectations / obligations | 0 | 0 | 0 |

**The release cycle now runs, and the one measure that means "the past
was re-made under later evidence" separates ordered from shuffled in the
right direction: 55 vs 21/12 — ordered reading rewrites its own
already-canonicalized past 2.6–4.6× more than order-destroyed reading.**
Two draws license "order matters," never an effect size — disclosed as
before. Splits and support counts do NOT separate (the shuffled runs
bracket the ordered value); the forward/prediction table has real traffic
now (85–132 hypotheses attacked per cursor window) but `supportedLater`
stays near zero everywhere — re-support of the same pair is rare at these
floors, an honest partial result, not smoothed over.

## Disclosed limits, sharpened

- **Binding precision is unvalidated.** The alternatives include real
  wins and real category errors ("margaret ↔ the day" — a person bound to
  scene furniture that survives the noun gate). The attack machinery is
  currently the only precision control. The committed coref fixture
  (`pg84-frankenstein.coref.json`) is the natural golden for a real
  precision pass — named as the next evaluation, not attempted here.
- **Over-generation:** 1,639 alternatives from 3,392 sentences is a lot.
  The floors (0.05/0.2) are host/corpus.js's disclosed-as-unvalidated
  operating point, reused with the giver named — walking them against the
  coref golden would be tuning against the answer; they move only with a
  justification independent of this scoreboard.
- **Expectations and obligations are still zero.** This pass fed the
  identity stream only; leverage moves (2) (expectations from relation
  structure) and (3) (the altitude gate) remain open.

---

# Second amendment, same day — precision measured against the coref golden, and REC reach

## The negative control (`native/eval/anchoring-precision.mjs`)

The committed golden (`pg84-frankenstein.coref.json`) makes one precision
question decidable without any judgment call: its creature entry lists the
descriptor surfaces that all predicate ONE being ("the creature", "the
monster", "the wretch", "the fiend", "the dæmon", "the being", "the
devil", "my creation"), and that being is UNNAMED — nested first-person
narration means he never carries a proper-name surface, so he can never
enter the cast anchoring binds against. **Every binding of a creature
descriptor to a named referent is therefore false, by the golden's own
annotation.**

Measured on the full novel:

| | count |
|---|---|
| creature-descriptor occurrences in the text | 94 |
| falsely bound (evidence stream) | 15 (16.0%) |
| correctly refused / unoffered | 79 (84.0%) |
| **surviving false beliefs at the end of the read** | **6 (6.4%)** |
| self-corrected to `distinct` by the mechanism's own attacks | 7 of 13 |

Two findings worth keeping:

1. **The failure mode is legible: thematic co-occurrence masquerading as
   identity.** Every false binding lands on the creature's victims and
   bystanders — Clerval, Elizabeth, Justine, Felix — at the scenes he
   shares with them. Recall measures association; identity is not
   association; the 16% is exactly that gap, now with a number on it.
2. **The evidence stream is not the belief.** A descriptor bound to
   different referents over time attacks its own earlier alternatives, so
   the fold's FINAL belief (6 false) is ~2.5× cleaner than its raw
   evidence (15 false). And every one of the 6 survivors stands on
   `support = 1` — single-witness, in the-fold P29's own vocabulary.
   The obvious next quarantine, named not built: alternatives below a
   corroboration floor of 2 (binding.js's structural minimum, the same
   giver P29 already cites) should not license recanonicalization of
   edges — false belief would then be held OUT of the canonical
   projection without touching the evidence record.

Not measured, said plainly: the 1,758 bindings of descriptors the golden
does not annotate ("my father", "the stranger", scene furniture) remain
unmeasured — reported as uncovered volume, never as clean.

## REC reach (the sharpened backwardScore)

Each re-making REC names the raw edge it re-projects, and edge ids carry
their read position — so the v1 disclosure ("re-makings counted by where
they LAND") is closed: reach = landing position − source position.
Ordered reading's 55 re-makings reach a **median of 749 sentences back
(min 82, max 2,046)** — later reading genuinely rewrites the deep past,
not just the previous paragraph. Shuffled runs also show large reach
values, as they must (under a permutation, "position read" is arbitrary),
so reach is the descriptive sharpening of the claim; the COUNT (55 vs
21/12) remains the ordered-vs-shuffled separator.

---

# Third amendment, same day — the corroboration floor, and the experiment's verdict

`deriveIdentityRevision` gained a declared `canonicalizationFloor`
(kernel/identity.js): an alternative projects into canonical edges only at
`supportRefs >= floor`; the alternative itself stays live, attackable, and
accumulating evidence — only projection is gated. Both evals declare
floor 2 (binding.js's structural minimum, the same giver P29's
WITNESS_FLOOR cites). Absent, behavior is byte-identical (pinned in
identity-revision.test.js, 4/4).

This was run as an experiment with both outcomes stated in advance:
either the ordered-vs-shuffled REC signal survived on corroborated
identity alone (stronger claim), or it collapsed (the signal was riding
on single-witness bindings — reported honestly). **It resolved on the
strong side of both questions:**

| floor 2, full novel | ordered | shuffled #0 | shuffled #1 |
|---|---|---|---|
| past recanonicalized | 11 | 2 | 1 |
| separation | — | **5.5×** | **11×** |
| median reach (sentences) | 749 | (n=2) | (n=1) |

- **The order signal sharpened, not died.** Raw separation was 2.6–4.6×;
  corroborated separation is 5.5–11×. Earning two independent supports
  for the SAME pairing is itself an order-dependent event — coherent
  discourse revisits a descriptor-referent association; shuffled text
  almost never does.
- **Projected false belief: 0 of 94.** The coref negative control's six
  surviving false alternatives remain on the fold as live single-witness
  hypotheses (evidence is never discarded), and none of them now reaches
  a canonical edge (`projectedFalseCanonicals: []` in the committed
  precision JSON).

Disclosed as before: two shuffle draws license direction, not effect
size; the uncovered 1,758 bindings stay unmeasured; expectations and
obligations remain zero — the prediction side is still the open half.

---

# Fourth amendment — the prediction side gets traffic (expectations from the identity lifecycle)

`deriveIdentityRevision`, when a corroboration floor is declared, now also
emits the kernel's own expectation vocabulary: a below-floor alternative
opens an `EOExpectation@1` ("corroboration expected: X <-> Y" — the
fold's own prediction that a second witness will arrive), a support below
the floor STRENGTHENS it, a support reaching the floor FULFILLS it (EVA —
expectationTransition's own typing), an attack VIOLATES it. The floor is
what makes fulfilment a mechanical fact rather than a judgment; no floor
declared = no expectations = byte-identical (pinned, 6/6 kernel tests).
Obligations/tension stay deferred, with the reason named: ~1,600 open
obligations would make deriveTension's pairwise interaction network
quadratic per turn (~4B comparisons per full read) — a grouping design is
needed first, not a cap.

**Pre-registered before the full run** (the fast smoke run showed only
traffic volume, no ordered/shuffled comparison): fulfilment should
separate ordered from shuffled — reaching the floor requires the SAME
pairing to earn two independent witnesses, which the floor-2 REC result
already showed is order-sensitive (11 vs 2/1) — while violation should
NOT separate, since attack volume (splits: 441 vs 382/502) never did.
Whatever the full run returns is reported against this prediction,
including a miss.

## The verdict on the pre-registration: half hit, half missed — and the miss teaches more

| full novel, floor 2 | ordered | shuffled #0 | shuffled #1 |
|---|---|---|---|
| expectations opened | 1,639 | 1,438 | 1,733 |
| **fulfilled** | **59** | **68** | **59** |
| violated | 411 | 349 | 471 |
| past recanonicalized | 11 | 2 | 1 |

**The fulfilment half of the prediction MISSED.** Fulfilment does not
separate ordered from shuffled at all (59 vs 68/59) — raw corroboration
counts are order-insensitive at book scale, contrary to the registered
expectation. The violation half hit (no separation, 411 vs 349/471, as
predicted from the splits result).

What the miss localizes: the order signal does NOT live in "the same
pairing earned two witnesses" (that co-occurrence happens under any
permutation of a whole novel) — it lives in the CONJUNCTION pastRemade
measures: corroborated identity that touches an edge the reading had
already canonicalized. Shuffled reading fulfils as many predictions but
they do not reach back into the relation graph the same way. So the
sharpest current statement of what "understanding the sequence" means at
this tier, earned by a wrong prediction rather than asserted: **not how
many of the reader's predictions come true, but how much confirmed
identity re-makes what was already read.** The prediction-side metric
that would separate is therefore not fulfilment count but fulfilment
REACH — the same sharpening backwardScore already got — named as the
next measurement, not attempted in this pass.

---

# Fifth amendment — prediction at a higher abstraction transfers across works (all three pre-registrations scored)

`native/eval/narrative-rhythm-prior.mjs` ("we never read Frankenstein as
our first book"): learn WHEN a being returns — pooled inter-mention gaps,
median summary — on one work, carry it to another under
experience-priors.js's own contract (nothing from the target enters the
prior; memory is never witness). Complementary to PR #17's
WHICH-structures sediment. Assembly named: perceiver-only mention stream.

| prior | medianGap | on ordered B | shuffled #0 | shuffled #1 |
|---|---|---|---|---|
| novel (Pride & Prejudice) | 12 | **0.469** | 0.148 | 0.141 |
| play (Hamlet) | 7 | 0.345 | 0.090 | 0.070 |
| self (Frankenstein, comparison only) | 15 | 0.512 | 0.189 | 0.169 |

**Registered prediction (1) — ordered beats shuffled under any prior: HIT,
decisively (~3.3–4.9×), the strongest order separation of the session —
and it is on the PREDICTION side, exactly where identity-level fulfilment
(fourth amendment) failed to separate.** Prediction at the rhythm
abstraction is order-sensitive where prediction at the token level was
not: the level of abstraction is not a nicety, it is where the signal
lives.

**Registered prediction (2) — the novel prior transfers: HIT.** P&P's
rhythm scores ordered Frankenstein at 92% of Frankenstein's own
self-prior (0.469 vs 0.512; gaps 12 vs 15). Rhythm is a property of the
kind "novel," not of one book.

**Registered exploration (3) — the play marks the abstraction's
boundary.** Hamlet's rhythm is measurably different (gap 7) and carries
measurably worse (0.345 < 0.469). The quartiles localize the boundary:
all three works share Q1 ≈ 4–5 — scene-level burstiness is universal —
and diverge at Q2/Q3, so the kind-difference lives in the LONG returns,
not the immediate ones.

Named next, not attempted: wiring `EORhythmPrior@1` into kernel
expectations on the fold (the fourth amendment's machinery is the seat —
a prior-sourced expectation opens at each mention, EVA-transitions on the
next); and composing with PR #17's `EOExperiencePrior@1` so one merged
experience object carries both the WHICH and the WHEN memories.

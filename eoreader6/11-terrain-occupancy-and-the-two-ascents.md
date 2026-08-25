# 11 — Terrain occupancy and the two ascents
**Repo:** eoreader6, at `edab22a` (118 commits)
**Status:** spec. No production code changed by this document.
**Governs:** `emergence/activation.js`, `emergence/binding.js`, `loops/atmosphere.js`,
`emergence/tiers.js`, `perceiver/text/pronouns.js`, `referents/entity.js`,
`host/corpus.js`, `operators.js` (roster), `conformance/`
**Discipline:** SEED.md growth rule (unwired is refuted; an organ joins only on
`above` in the level test), declared-never-defaulted numbers, a gap is a result,
identity by consequence never by appearance.

---

## 0. The finding this spec responds to

Two facts, both traced at `edab22a`, neither previously recorded together:

**F1 — one heuristic gates four terrains.** `Kind` is induced over relation
*terms*; `Network` is a graph over admitted Entities and Links; `Paradigm` is the
current set of induced Kinds plus their core fields. All three are downstream of
`perceiver/text/relations.js`, whose mouth is still a token-after-a-surface
English SVO prior even after `discoverRelationVocab` replaced the hand verb list.
`scripts/EMBEDDING-FINDINGS.md` records SVO yield at **1/570 in Frankenstein
versus 138/4975 in War and Peace** — recorded there as a fact about the material.
It is also a statement that on first-person retrospective narrative, four of nine
terrains are structurally uninhabitable. The genre this project's corpus actually
lives in — staff reports, filings, depositions — sits nearer Frankenstein than
Tolstoy on exactly this axis: agentless constructions, nominalizations, *it was
determined that*.

**F2 — the strongest measured channel is in a refuted position.**
`emergence/activation.js` is imported by no engine and no host module. Its only
importers are `perceiver/text/pronouns.js` (reusing `codeOf`/`recall`/
`encodeFrame`), `conformance/activation.test.js`, and two scripts. Separately,
`host/corpus.js` computes `pronounBindings` and consumes them at one site — a
per-referent presence count — and passes them to nothing: not `extractRelations`,
not `projectReferents`, not `kinds`, not `graph`, not `paradigm`. By SEED.md's own
rule, `recalled` (22/24 Frankenstein chapter boundaries, 20/23 precision, p≈0.005
against a rotation null) is a refuted organ.

The two facts have one shape. There are two routes up the terrain ladder — a
structural ascent through Link, and a reader-state ascent through the reading
channels — and the project has been building on the choked one while leaving the
open one unwired.

---

## 1. What this spec does not do

- It does not fix the Link mouth's word-order prior. Spec 10 owns that.
- It does not add a model tier, an embedder, or a lexicon.
- It does not optimize toward anything. Every assembly below is a gate plus an
  audit surface, per the stigmergy spec's own constraint.
- It does not port. Every organ named earns here or does not come.

---

## 2. Invariants no assembly may break

Any assembly that violates one of these is refused, not merged with a note.

**I1 — causality.** Reading the first *k* frames must produce exactly the records
that reading the whole document and taking the first *k* produces. This is
`conformance/activation.test.js`'s existing invariant and it now governs
everything downstream of activation.

**I2 — declared numbers.** `window`, `draws`, `tolerance`, `reseeds`,
`minActivation`, `minMargin`, `minArrivals` are declared by the caller and throw
when absent. No assembly below introduces a module constant that a null could
have derived. Where a number is genuinely an engineering starting point, it is
labeled as such in the same words `host/corpus.js` already uses for
`PRONOUN_MIN_ACTIVATION`.

**I3 — a gap is not a zero.** `seriesOf` already refuses to default `missing`.
Every new series-producing call site declares what an unanswered unit means.

**I4 — tier boundary.** Nothing below promotes a model-tier absence into a
number. Descriptor synonymy stays a typed gap.

**I5 — roster registration.** Every organ this spec touches or adds declares a
`CELL`, appears in `operators.js`'s `ORGANS` array, and is checked by
`conformance/coverage.js`. The three `generation/` organs that self-declare a
`CELL` without roster registration (`standpoint.js`, `slots.js`,
`conventions.js`) are a known outstanding drift and this spec adds no fourth.

---

## 3. Assembly A — the census instrument

**Purpose.** Answer "do we have enough of the mechanics" as a measurement rather
than a judgment. The completeness question is unanswerable in the abstract and
perfectly answerable as: *which terrains can this material instantiate, and does
that count move for reasons that are about the instrument rather than the text?*

**New file.** `scripts/terrain-census.mjs`

**What it does.** For each supplied source, run the existing ladder end to end and
emit, per terrain, the count of admitted instances normalized per thousand units,
plus the refusal reason where the count is zero. Nine rows, one column per source.
Nothing new is computed — this is a report over organs that already run.

**Corpus (declared, three genres, deliberately spanning the SVO axis):**

| slot | source | why |
|---|---|---|
| narrative-low-SVO | Frankenstein (pg84, already committed) | the 1/570 end |
| narrative-high-SVO | War and Peace (already used in `navigation-index-war-and-peace.mjs`) | the 138/4975 end |
| civic | a Metro staff report or Council ordinance, ingested as a new fixture | the genre the project is for |
| adversarial-civic | a deposition or transcript excerpt | agentless + attribution-clause dense |

**The reading.** A terrain whose occupancy tracks *genre* rather than *content* has
located a mouth, not a terrain. The prediction this spec commits to in advance,
so it can be wrong: **Link, Kind, Network, and Paradigm will vary by more than an
order of magnitude across the four sources; Entity, Field, and the reading
channels will vary by less than 2×.** If that prediction fails — if the channels
also swing by an order of magnitude — the diagnosis in §0 is wrong and assemblies
B through F should not be built as specified.

**Checkpoint.** The census runs and emits a nine-row table for all four sources,
with a typed refusal string in every empty cell. Pre-registered prediction recorded
in `scripts/RESULTS.md` **before** the numbers are read.

**What would refuse this assembly.** Occupancy counts that are not comparable
across sources (different unit definitions per genre) would make the table
meaningless. Normalize per thousand units of the *same* unit the perceiver
emitted, and if two genres cannot share a unit, say so and drop the comparison
rather than rescaling.

---

## 4. Assembly B — Atmosphere from `recalled`

**Purpose.** Wire the project's strongest channel to the terrain it already
describes, which also un-refutes `emergence/activation.js`.

**The claim.** An Atmosphere is the span between two re-zero events over the
reader's accumulated ground (`loops/atmosphere.js` + `tiers.js` tier 1).
`recalled` — how many distinct prior frames answered — finds 22/24 chapter
boundaries at p≈0.005. A chapter boundary and a regime re-zero are candidates for
being the same event. This assembly tests whether they are.

**Seam.** Both halves already exist and have never been connected:

```
readForward(frames)            → { records, state }
seriesOf(records, "recalled", { missing })   → number[]
createRegimeTracker({ window, draws, tolerance, seed, statistic, findOn, reseeds })
  .push(x)                     → { regimeStart, rezeroed, placement, … }
```

`push` consumes finite numbers only and throws otherwise, which is why `missing`
must be declared at the `seriesOf` call and not defaulted (I3). `recalled` is a
count and is never null, so `missing` is declared unreachable and asserted rather
than filled — if it is ever reached, that is a finding about `readForward`, not a
value to supply.

**New file.** `packages/engine/loops/reading-regime.js`

**Cell.** `EVA · Figure` — evaluating whether the reader's ground still holds.
Registered in `ORGANS`.

**Export.**

```
readingRegime(frames, { channel, window, draws, tolerance, reseeds, seed,
                        statistic, findOn })
  → { records, regimes, gaps }
```

`channel` is declared, not defaulted — `recalled` is the current best measurement,
not a law, and Assembly C depends on this function being callable per channel.

**Two things this must not do.**

1. **Not sum channels.** Feeding a blend of `recalled` and `activation` into one
   tracker reproduces the failure shape already refuted three times in this
   project (lemma abstraction, null-witnessed slot abstraction, the ungated lone
   gift): a coarse signal given a voting role drowns better evidence in
   proportion to its own coarseness. One channel, one tracker.
2. **Not reuse the chapter-boundary null.** `scripts/RESULTS.md` already records
   that the rotation null loses power as boundary count rises — `recalled` emits
   23 against 24 true boundaries and saturates on the wide window (p≈0.064). The
   regime tracker's own `slackRunNull` is the calibrated device here, at the
   stride `atmosphere.js` already established (`window`, not 1 — the measured
   false-alarm difference is 55–90% versus 0–3%).

**Acceptance.**

- B1. `readingRegime` over Frankenstein emits regimes; regime starts are compared
  against the 24 known chapter boundaries and the agreement recorded. **Agreement
  is a finding, not a pass condition** — a regime is not defined as a chapter.
- B2. On a shuffled-frame control, regime count falls to the slack-run null's own
  expectation. If it does not, the tracker is reading its own extent.
- B3. Causality (I1): `readingRegime(frames.slice(0, k))` produces exactly the
  first *k* records of `readingRegime(frames)`.
- B4. `conformance/reading-regime.test.js` holds the MEANINGFUL / MEANINGLESS pair
  the repo applies everywhere else: structured material yields regimes, random
  material yields an honest refusal.

**Checkpoint.** `emergence/activation` has an engine-module importer. The SEED.md
growth-rule violation in F2 is closed.

**What would refuse this assembly.** If regime boundaries from `recalled` land at
the rate the slack-run null predicts, the channel is a boundary detector and not
an Atmosphere, and it should stay a detector. Record that and stop; do not
proceed to C.

---

## 5. Assembly C — Lens from channel disagreement

**Depends on:** B.

**Purpose.** Build a Lens that is measured rather than declared.

**The claim.** `tiers.js` tier 2 folds the same shape one level up, with the prior
built from Atmosphere's own shifts. Run two regime trackers on two channels of the
*same* reading act and the Lens is built over where their Atmospheres shift
*differently*. This is SEED.md #6 — plural grounds for one figure are legal and
their disagreement is the only self-check — applied at terrain scale instead of at
the embedding seam, where it currently has no measurement to attach to.

**Why two channels are genuinely two readers.** Already measured, not assumed:
`recalled` is strong on the tight matcher and saturates on the wide window;
causal surprisal is the reverse (p≈0.000 causal, p≈0.016 tight, 13 boundaries
emitted against `recalled`'s 23). They are not ranked by one number. That is what
a Lens difference looks like from below.

**Seam.** `emergence/tiers.js` `createTierStack` / `foldThrough` / `gammaFor`
already exist and are exercised in `read-tiered.mjs`, `read-ladder.mjs`,
`navigation-index-war-and-peace.mjs`. The material handed to tier 2 is the
*disagreement series* — per unit, whether the two trackers agree on placement
(`PLACEMENT.PLACED` / `STRAINED` / `OTHER`).

**The trap to avoid, stated explicitly.** The high tier must not enter the low
tier's mixture as a voting term. Per the position already on record: the high tier
sets the low tier's own hyperparameters and only the residual — the mismatch
between what those settings predicted and what was witnessed — climbs back up.
Here that means the Lens may re-parameterize each tracker's `window`/`tolerance`;
it may not contribute a score to either tracker's placement decision.

**Nearest ancestors, cited because C4 makes the shape checkable against them.**
Nothing found plays both halves at once — continuous re-dial fused with a
discrete gate, one hyperparameter set feeding another tier's residual — but the
two halves separately have real lineages: variable-forgetting-factor RLS
(Fortescue, Kershenbaum & Ydstie, "Implementation of Self-tuning Regulators
with Variable Forgetting Factors," *Automatica* 17(6), 1981) adapts a filter's
own memory continuously from its prediction error, which is the shape of "the
residual climbs back up" without the discreteness C4 requires; streaming
concept-drift detectors — DDM (Gama, Medas, Castillo & Rodrigues, "Learning
with Drift Detection," SBIA 2004) and ADWIN (Bifet & Gavaldà, "Learning from
Time-Changing Data with Adaptive Windowing," SDM 2007) — fire a discrete
retrain/reset signal from an error stream, which is the gate without the
continuous re-dial. C4's own acceptance criterion (a discrete typed
re-parameterization event, not a continuous adjustment) already refuses to let
this collapse into either lineage read straight; recorded here so that when C
is built, the comparison is to these two, not reinvented from nothing.

**Acceptance.**

- C1. Disagreement series over Frankenstein is non-trivial (the two trackers do not
  agree everywhere; if they do, there is one reader and no Lens).
- C2. Tier-2 folding over the disagreement series clears its own null.
- C3. Removing one channel collapses the Lens to a gap, not to a degraded Lens.
- C4. The re-parameterization path is a discrete typed event in the ledger, not a
  continuous adjustment — REC as a swap, keeping compatibility with *nothing is
  optimized toward*.

**What would refuse this assembly.** Two channels that agree almost everywhere.
Then the disagreement series is near-constant, its null is unclearable by
construction, and a Lens over it would be reading its own extent — the exact
failure `nul/index.js::pattern` cost an evening to find.

---

## 6. Assembly D — animacy, as the blocking dependency

**Blocks:** E and F. Build before either.

**The problem.** `resolvePronouns` at the production operating point over the
committed Frankenstein fixture binds 638 pronouns across 3536 sentences — and
**84 of them (13%) go to three city names**: geneva 30, ingolstadt 30, england 24.
Today that is cosmetic, because the bindings feed nothing. The moment they feed
co-arrival (E) or referent mass (F), that error stops being cosmetic and becomes
*structure*: cities entering Link and Network as animate participants.

**Why the obvious fixes are both closed.**

- A lexicon is a hand list, refused on the same grounds as the 90-verb list.
- The embedding class will not supply it: `EMBEDDING-FINDINGS.md` records the
  label-free "referent-capable" class replicating at d≈3.80 (War and Peace) /
  3.78 (Frankenstein) while **pooling people, horses and cities**.
- Relation-slot position is circular while Link is starved — the thing that needs
  animacy is upstream of the thing that would supply it.

**The non-circular derivation.** Use the signal the apparatus-demotion work
already measures, pointed one level down. A person is carried by *pronominal
continuation*; a place is not. An organisation has no pronoun to carry it, so its
name must recur — the measured shares are Elizabeth Lavenza 90/3392 = 2.7%, Kurtz
113/2476 = 4.6%, wire-service fixture 21/40 = 52.5%, floor at 15%. A city sits at
the same pole as the apparatus for the same reason and by the same measurement,
with no new mechanism and no new list.

**New export.** `perceiver/text/presence.js` or a sibling —
`continuationProfile(referentId, sentences, bindings)` returning the pronominal /
nominal continuation ratio and its own null.

**Declared, never defaulted:** the floor. And note honestly that the existing 15%
was calibrated on narrative plus one hand-authored wire-service fixture. It must be
re-measured on Metro documents before it touches the civic graph — that is already
on the next-test list and this assembly makes it blocking rather than advisory.

**Acceptance.**

- D1. On Frankenstein, the three city referents fall on the non-personal side and
  the principal characters on the personal side, with the separation clearing a
  null built from each referent's own counts (the same binomial-at-own-counts
  device `surfaces.js` uses for cap-significance).
- D2. The classification is causal: computed from the prefix already read, never
  from the whole document.
- D3. Referents with insufficient evidence return a typed gap and are neither
  admitted nor excluded — the same standing gender already has in
  `resolvePronouns` ("no evidence either way never excludes").
- D4. Re-measured on at least one civic fixture before E or F merge.

**What would refuse this assembly.** If the continuation ratio does not separate
cities from characters on Frankenstein, the signal is about apparatus specifically
and not about animacy generally. Then E and F are blocked with no available fix in
this spec, and the honest move is to record that and stop — not to add a lexicon.

---

## 7. Assembly E — Link without the SVO mouth

**Depends on:** D.

**Purpose.** Un-choke the left ascent using a mechanism that already exists and
needs no verbs.

**Seam.** `emergence/binding.js` — the modality-blind path — takes a register of
entities each carrying `.id` and `.arrivals` (sorted unit indices), detects
co-arrivals within a declared `window`, and tests each pair against a displacement
null, a reversal null, and a reseed null. It requires nothing about word order and
nothing about English.

**The change.** A sentence with no name in it currently contributes zero arrivals.
After D, a pronoun binding that clears both declared bars *and* whose referent is
personal contributes an arrival of that referent at that unit index. On
Frankenstein that is up to 638 additional arrival events fed to a mechanism that
has been starved of them, with 84 of them correctly withheld.

**Provenance is mandatory.** Each such arrival carries the binding's existing
`provenance` block (`giver: "perceiver/text/pronouns::resolvePronouns"`,
`tier: "engine"`, `basis: "one-hop activation recall over the already-admitted
cast"`) plus its `activation` and `margin`. A recall-bound arrival must remain
distinguishable from a literal naming everywhere downstream — this is
`presence.js`'s existing `resolved: "activation"` discipline extended into the
register rather than reinvented.

**Acceptance.**

- E1. Link yield on Frankenstein, before and after, reported as a delta with the
  pre-registered expectation stated first.
- E2. Every link admitted using at least one recall-bound arrival is reported
  separately from links admitted on namings alone. If the recall-bound population
  clears no null the namings-only population doesn't, the addition is noise and is
  reverted.
- E3. An ablation: the same run with bindings included but `nonPersonal` empty.
  This is the D-dependency's own regression — it should visibly degrade, and by
  roughly the 13% the city bindings represent.
- E4. Census (Assembly A) re-run. The claim to be tested is that the
  Frankenstein/War-and-Peace Link ratio narrows. If it doesn't, this route does
  not un-choke the ladder even though the mechanism works.

**What would refuse this assembly.** `challenge-23` is the standing warning:
5/5 correct binding only after the host supplies `nonPersonal`, and the fix lives
in the host rather than in the organ. If the host's policy layer is where animacy
has to live, then E is a *host* change and must not be smuggled into the engine —
the engine has no individuation notion and this spec does not give it one.

---

## 8. Assembly F — Entity mass, reweighted

**Depends on:** D.

**Purpose.** Let a measured judgment become mass instead of being computed and
discarded.

**The gap.** `referents/entity.js` admits a surface on recurring arrivals clearing
a void-mask null sized to its own extent, plus an early-half/late-half activity
difference. Arrivals are namings. Apparatus demotion already computes the
pronominal-continuation ratio and uses it to *demote*, but bindings never re-enter
individuation, so a referent carried mostly by pronouns is under-massed by exactly
the amount that makes it a person.

**The change.** Recall-bound arrivals contribute to mass, tagged, at a declared
weight — and the weight is declared by the caller, never defaulted, because how
much a recalled mention weighs against a literal naming is a property of the
reading.

**The standing danger, named.** `referents/consequence.js` already records the
fourth instance of this project's recurring failure shape: union-of-arrivals
cleared the birth condition and falsely merged two Finnish brothers, because *the
birth condition tests for significance, not identity*. Adding arrivals to a
referent is exactly the operation that failed there. Therefore:

- F1. Recall-bound arrivals may raise mass. They may **never** contribute to a
  merge decision, a coreference judgment, or an identity test.
- F2. The birth condition is re-run with recall-bound arrivals excluded as a
  standing control, and the two results are reported side by side. A referent that
  is born only with recall-bound arrivals included is reported as a finding, not
  admitted silently.

**Acceptance.**

- F3. On Frankenstein, the creature — the definite-description case
  `challenge-24` exists for — gains mass and its individuation type is re-read.
- F4. No new merges appear anywhere in the cast relative to the pre-change run.
  Any that do are a regression of the Finnish-brothers shape and block the merge.

---

## 9. Assembly G — Kind, deferred with a stated condition

Kind is induced over relation *terms*, gated by two Born tests (existence-
dependency and possibility-constraint) that jointly discover whether a cluster
sits above its members or is a peer. With Link starved, those tests cannot be
cleared honestly, and clearing them on a thin relation vocabulary is the
not-gameable-by-scale failure this project has now caught four times.

**Condition for un-deferring:** Assembly E's census re-run (E4) shows Link
occupancy on the civic fixture within 3× of the narrative-high-SVO fixture. Until
then Kind stays where it is and Paradigm with it.

Recording the deferral is the point. A gap is a result.

---

## 10. Build order and set-downs

```
A  census instrument          → set down: nine-row table, prediction pre-registered
B  Atmosphere from recalled   → set down: activation.js has an engine importer
C  Lens from disagreement     → set down: tier-2 clears its own null   [needs B]
D  animacy from continuation  → set down: cities separate on Frankenstein
                                          AND re-measured on a civic fixture
E  Link via bound arrivals    → set down: yield delta + ablation        [needs D]
F  Entity mass reweight       → set down: no new merges                 [needs D]
G  Kind                       → deferred, condition stated
```

A, B, C are independent of D and can proceed in parallel with it. E and F must not
start before D closes. Each set-down validates with its own lines plus what came
before; a failure revises only the assembly in hand.

---

## 11. Release invariants

- No new module constant that a null could have derived.
- Every new organ declares a `CELL`, registers in `ORGANS`, and appears in
  `coverageReport()`.
- Every new organ has a conformance file holding the MEANINGFUL / MEANINGLESS
  pair.
- Every recall-bound datum is distinguishable from a literal one at every point
  downstream, by tag, not by convention.
- Every pre-registered prediction in this document is written into
  `scripts/RESULTS.md` before its numbers are read, and recorded as wrong where it
  is wrong — as `reach` already is.
- Nothing here is optimized toward. Every assembly is a gate plus an audit
  surface.

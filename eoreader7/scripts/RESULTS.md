# Results — the second clearing

Everything here is reproducible: `node scripts/two-clearings.mjs`,
`node scripts/binary-clearings.mjs`. Frankenstein is read from
`eoreader4.2/tests/fixtures/frankenstein.txt` (24 real chapter markers).

Spec throughout: `window 12, draws 200, reseeds 5, tolerance 3, hop 4`.

---

## The headline

A ground fails two ways, and both are `DEF · Atmosphere · Clearing`:

- **surfeit** — new material exceeds the ground's support (`exceeds_witness`
  above). Wired since turn 1.
- **moved** — the ground itself shifted under maintenance, further than
  continuing the same material would have shifted it (`pattern().moved`).
  Wired now.

Against Frankenstein's 24 chapter boundaries:

| clearing | recall | precision | uniform chance | shuffled-series | **rotated chapters** |
|---|---|---|---|---|---|
| surfeit only | 4/24 | 3/4 | 4.35 | z=— | p≈0.84 |
| **moved only** | **19/24** | **11/13** | 11.52 | z=5.17 | **p≈0.000** |
| both | 17/24 | 12/14 | 12.11 | z=3.16 | p≈0.34 |

(causal match window; the tight window gives moved-only 14/24, rotated p≈0.016.)

**moved is the first thing in this project to beat a rotation null on an
external reference.** surfeit alone is at chance, which is where turn 1 left it
(1/24 against a chance of 0.99). Combining the two is *worse* than moved alone —
surfeit's boundaries dilute rather than complement.

---

## Three nulls, and why only the third one counts

This is the part worth keeping even if every number above turns over.

1. **Uniform random boundaries** — the baseline turn 1 used. Too weak. Real
   chapters are roughly evenly spaced, and so is anything a tolerance counter
   emits; two roughly periodic sets of marks agree far more than two uniform
   ones. It scores 13 evenly spaced boundaries at 11.5/24 before the detector
   has done anything.

2. **Shuffle the series, run the whole mechanism again** — strong but blunt.
   Destroys the order, and with it the trend and the autocorrelation, so
   beating it does not say *which* property carried the signal.

3. **Rotate the chapters** — sharpest and cheapest. Changes neither the
   detector's output nor the chapters' spacing; breaks only whether they line
   up. Rotated chapters score a 13-boundary set at **15.1±1.5** — higher than
   the "chance" baseline the same set beats comfortably.

A run can clear (1) and (2) and still be nothing. `both` does exactly that:
z=3.16 against shuffled, p≈0.34 against rotation.

---

## What the null had to be corrected to

`pattern()`'s null was the ground's reseeding variation at **before's** extent,
while `after` was built over more material. Burstiness is a max over windows,
so its expectation rises with extent alone. The null measured seed noise; the
displacement measured seed noise plus growth; growth won.

Wired that way, the moved clearing produced:

- boundaries on **homogeneous noise** at 36, 64, 92, 120, 164, 192, 220, 248,
  276, 304, 332 — spacings 28, 28, 28, 44, 28, 28, 28, 28, 28, 28. A clock.
- **23/24** Frankenstein chapter recall … and **21–23/24** on the same series
  shuffled.

Every headline number looked like a breakthrough. The fix is a growth-matched
conditional null: continue `before`'s material by drawing from itself, up to
`after`'s extent, then reseed. Same regime, carried on — so what the null shows
is what growth alone contributes. When the extents match it reduces to the
reseeding null unchanged.

The same check caught a second live bug: `loops/time.js` passed the *later*
material to `pattern()`, making every null draw a same-material sibling of
`after`. `moved` there was a coin landing true about 1/(reseeds+1) of the time
regardless of the document. `nul` now refuses that call
(`incommensurate_extent`) rather than answering it.

---

## Pure binary: the omnimodal claim, and it does not hold yet

Frankenstein read as **bytes** — no tokenizer, no frequency table, no
surprisal, no notion of a word. Same `runTurn`, same declared numbers, same
nulls; only the reduction changed.

| reduction | moved-only recall | precision | rotated chapters |
|---|---|---|---|
| mean byte value | 8/24 | 6/7 | p≈0.48 |
| block entropy (256 symbols) | 12/24 | 10/12 | p≈0.64 |
| distinct bytes per block | 16/24 | 15/17 | p≈0.65 |

Nothing clears the rotation null. Note `blockVariety`: **16/24 recall at 15/17
precision, and worth exactly nothing** — rotated chapters score the same set at
16.3±1.7. It is the single best illustration in this repo of why the third null
is not optional.

So the signal on text lives in the **perceiver's reduction** (causal
surprisal), not in the operator chain. As built, the omnimodal commitment is a
claim about plumbing — every modality reduces to a numeric series `nul` can
consume — and not yet a claim about perception. A nameless leitmotif would need
an audio reduction that is as informative for music as causal surprisal is for
prose, and RMS energy is the analogue of `meanByte`, which scored the worst of
the three.

That is a gap in the perceivers, not in `nul`, and it is now measured rather
than assumed.

---

## The invariance audit: what each perceiver cannot see

`npm test` — `conformance/perceiver_invariance.test.js`, 15 tests, 0.2s.

The clearing test above needs labelled boundaries, and outside text there are
none, so the perceivers went unmeasured. But most of the question does not need
labels. `reduce` is pure by contract, so the transformations of a source that
leave `material` unchanged can be enumerated directly, and any of them that a
competent perceiver must notice is a hole. No corpus, no ffmpeg, no fixtures.

| perceiver | transformation | material |
|---|---|---|
| audio | 440 Hz → 880 Hz at matched amplitude | identical to 4.7e-7 |
| audio | permute samples within each frame (tone → noise) | **exactly** identical |
| image | scramble every pixel within its own row | **exactly** identical |
| video | hard cut on half the frame vs. global fade, matched mean | both `[20]` |
| video | permute pixel positions consistently across all frames | **exactly** identical |
| video | a light coming on vs. the same light going out | **exactly** identical |
| text | rearrange the words, same multiset | **moves** |

Four reductions are first-order intensity; one is second-order surprise. Only
the second-order one has the arrangement of its own material in the series —
which is the same asymmetry `meanByte` (8/24) vs. causal surprisal (14/24)
measured on bytes, arrived at from the other direction and without labels.

Two further findings, neither about blindness:

- **A row counter outranks the measurement.** `pickNumericColumn` takes the
  most-parseable column, and any real measurement with a missing value loses to
  an `id` that never has one. The counter is then *censored above* — surfeit,
  the strongest reading `nul` can return — because a monotone ramp maximises a
  max-over-windows statistic and its shuffles cannot come near. The actual
  readings sit inside their support at rank 0.96.
- **Unordered records break the premise and nothing can tell.** Every statistic
  in `nul` is validated against a shuffle null, which presumes shuffling
  destroys something real. For a table of records that arrived in no order,
  shuffling destroys nothing, and the ground comes back well-formed with a
  healthy width of 17.7. `degenerate_ground` fires on zero *width*, not on a
  vacuous premise. Whether an index is load-bearing is a property only the
  giver knows — the same shape as `draws`, `window`, and `reseeds`, and
  currently the one that is never declared.

**The mutation step is not optional.** Each "blind" equality was re-run against
a minimally-repaired reduction to confirm it actually breaks there. That check
demoted two tests: a per-row gradient reduction is *also* mirror-invariant, and
zero-crossing rate is *also* polarity-invariant, so neither equality was
evidence of impoverishment. An invariance is only a defect if some plausible
improvement would remove it.

What this does **not** establish: that fixing any of these improves a clearing.
That still needs labelled events per modality, which remain the blocking gap.

---

## Reading left to right: what associative memory adds

`node scripts/activation-clearings.mjs`. One left-to-right pass over
Frankenstein (0.8s, recall answers on 738/753 frames), four channels out of it,
each fed to the same `moved` clearing.

| channel | tight recall | precision | rotated chapters (tight) |
|---|---|---|---|
| causal surprisal | 14/24 | 11/13 | p≈0.016 |
| activation | 16/24 | 14/19 | p≈0.431 |
| reach | 11/24 | 11/12 | p≈0.287 |
| novelty | 9/24 | 8/9 | p≈0.191 |
| **recalled** | **22/24** | **20/23** | **p≈0.005** |

**`recalled` — how many distinct prior passages answered — is the strongest
channel measured in this project so far.** 22/24 at 20/23 precision, p≈0.005
against rotated chapters, on the tight (±window) matcher.

Two things to be honest about:

- **The stated hypothesis was wrong.** Before measuring, the prediction written
  into the script was that `reach` would jump at a boundary — the material
  stops echoing what was just read. `reach` is the second-weakest channel
  (p≈0.29). It is not how far back the echo is; it is *how many things answer
  at all*.
- **The rotation null loses power as boundary count rises.** `recalled` emits
  23 boundaries against 24 true ones, and on the wide causal window that
  saturates — rotation alone scores 22.2±0.9, so p≈0.064 there. Only the tight
  window discriminates for a dense detector. Causal surprisal, which emits 13,
  is the reverse: strong on the causal window (p≈0.000), weaker tight
  (p≈0.016). The two channels are not ranked by one number.

## Where the embedding goes

Not measured — there is no checkpoint on disk and the sandbox blocks the only
host for the real one. The seam is built to the shape the measurement will
need and claims nothing until it has one, per the growth rule.

The placement is a tier decision, not a performance one. The sparse code fires
only on forms that have **already recurred**: verbatim and keyword recurrence,
engine tier, structurally unable to bridge `monster ≈ creature`. An embedding
is exactly that bridge, which makes it model tier — so it is injected (never
imported), it **reranks what the engine tier surfaced rather than retrieving on
its own**, and where the engine tier surfaced nothing it returns a typed gap
instead of a memory. Conformance holds that boundary against a deliberately
degenerate embedder.

The lineage's own benchmark argues for this rather than against it: the Hebbian
sparse code came out *ahead* of ColBERT-style late interaction at the range
these motifs recur (pg84 R@10 13 vs 10 of 60). The embedding is not a better
retriever to swap in — it is a second ground for one figure, and SEED.md #6
says the disagreement between two grounds is the only self-check available.
So `resonance` reports whether the two channels agree, and does not reconcile
them.

## The vital sign still points the wrong way

Turn 1 flagged 2 of 7 regions opening. With the moved clearing on Frankenstein
it is **9 of 14** — better than half, and better than turn 1 — but the shuffled
controls sit in the same range, so this is not yet evidence of anything. Per
SEED.md, widening is encounter and narrowing is extraction. Recorded, not
claimed.

## Reading real civic material: the Unified Housing Strategy

`node scripts/read-nashville-civic.mjs`. Two real documents — Metro
Nashville's Unified Housing Strategy Executive Summary (April 2025, 212
sentences) and Full Report (July 2025, 1825 sentences) — run through the
actual host session pipeline (`createSession`/`ingestFile`/`sessionReferents`)
and, separately, `resolvePronouns` at the same production operating point
(`PRONOUN_MIN_ACTIVATION 0.05`, `PRONOUN_MIN_MARGIN 0.2`) `host/corpus.js`
uses. This is spec 11's Assembly A civic fixture, first look.

**Cross-document name coreference works.** Pooling both documents (the
`sourceId` array path, `discoverReferents(pooledSurfaces, { groups })`) merges
86 referents named in both documents: Metro (267 total mentions, split
22+245), MDHA (64), Housing Division (74), Barnes Fund (42), Davidson County
(29) — the same institution, correctly summed across two documents written
five months apart by the same office (the Full Report is 5.4x longer but
covers the same ground as the Executive Summary).

**Third-person-singular pronouns are almost absent from this register, and
the one real one mis-binds.** Across 2037 combined sentences, `resolvePronouns`
found exactly 7 pronoun occurrences with a named antecedent already active: 1
bound, 6 gapped on `pronoun_no_margin`. The single binding is wrong: *"her"* in
*"Her housing search involved countless hours riding around on the bus and
looking at listings..."* (a resident case-study vignette) bound to **UHS** —
the strategy's own acronym — at activation 39.994, margin 0.613, because
nothing marks UHS as non-personal and it is named in nearly every paragraph of
the document. This is spec 11 Assembly D's problem (Frankenstein: 84/638
bindings, 13%, go to three city names) at its starkest: on real civic prose,
the *only* pronoun binding produced is the wrong one, for exactly the reason
Assembly D names.

**Referent discovery has a real-world-PDF noise floor Frankenstein/War and
Peace never surface.** Repeated running headers/footers ("Nashville Unified
Housing Strategy | *N*", "UHS Key Findings, Strategies, and Actions" on every
page) and decoratively letter-spaced section headers ("S T R A T E G Y A")
enter the cast as garbage referents: "Actions Nashville Nashville Unified"
(148 mentions pooled), "Key Findings Strategies" (100), "Figure Nashville"
(46), "S T"/"S T R"/"S T R A" (7 each). Neither Frankenstein nor War and
Peace's plain Gutenberg text has this — it is specific to PDF-derived civic
documents with page furniture, and Assembly A's census should account for it
before reading Link/Kind/Network/Paradigm occupancy on the civic fixture as a
fact about the *register* rather than the *extraction*.

What this does not establish: that fixing the header/footer noise changes the
terrain-occupancy picture, or that Assembly D's continuation-ratio signal
actually separates UHS/Metro/MDHA from personal referents on this material —
D1 (Frankenstein) is unrun here and D4 (civic re-measurement) needs it first.

Fixtures: `scripts/adversarial/fixtures/nashville-uhs-executive-summary-2025.txt`,
`scripts/adversarial/fixtures/nashville-uhs-full-report-2025.txt`.

## Assembly A: the terrain census — pre-registered prediction, read

`node scripts/terrain-census.mjs`. Spec 11 §3 commits, in advance, to: **Link,
Kind, Network, and Paradigm will vary by more than an order of magnitude
across the four declared sources; Entity, Field, and the reading channels
will vary by less than 2×.** Recorded here as the spec fixed it, before this
run — spec 11 was committed (792d5a5) well before this script existed.

**Two of the four declared sources are gaps, not two of four measured.**
narrative-high-SVO (War and Peace) and adversarial-civic (a real
deposition/transcript) could not be obtained this session — general web
fetch is restricted (nashville.gov, courtlistener.com, congress.gov, and
gutenberg.org all reject the CONNECT at the proxy level; see the entry
above). What follows is Frankenstein vs. the two Nashville UHS documents
only — half the design, not the whole test.

**The causal ladder here is a simplified reproduction of `read-ladder.mjs`,
missing narrator/first-person scope resolution** (that script's
`resolveAllNarratorSpans` needs a per-book eoPriors coref file this repo
does not ship, and hand-building one for a new civic fixture is exactly the
porting spec 11 §1 forbids). First-person pronouns never resolve to a
referent here, on any source. This mechanically lowers Frankenstein's
Link/Network/Kind/Lens counts below what `read-ladder.mjs` itself would
report on the same text; it does not touch the Nashville documents, which
are third-person throughout.

| terrain | Frankenstein (3392 sent.) | UHS Full Report (1825 sent.) | UHS Exec. Summary (212 sent.) | ratio (Full Report ÷ Frankenstein) |
|---|---|---|---|---|
| Void | 61.9 /1000 | 64.7 /1000 | 113.2 /1000 | 1.0× |
| Entity | 14.7 /1000 | 6.6 /1000 | 0.0 /1000 | 0.4× (2.2× apart) |
| Kind | 0 (0 kinds / 7 records) | 0 (0 kinds / 51 records) | GAP (2 records, &lt;minKindSize) | degenerate |
| Field | 1000.0 /1000 | 1000.0 /1000 | 1000.0 /1000 | 1.0× (tautological — see below) |
| **Link** | **1.5 /1000** (5/1654 stated) | **30.7 /1000** (56/1382 stated) | 4.7 /1000 (1/51 stated) | **20.9×** |
| **Network** | **1.5 /1000** (5 edges) | **30.1 /1000** (55 edges) | 4.7 /1000 (1 edge) | **20.5×** |
| Atmosphere | 0.6 /1000 (2 rezeros) | 0.5 /1000 (1 rezero) | 0.0 /1000 (0 rezeros) | 0.9× |
| Lens | 0.3 /1000 (1 shift) | 13.2 /1000 (24 shifts) | 0.0 /1000 (0 shifts) | 45× |
| Paradigm | GAP | GAP | GAP | untestable |

**This does not cleanly confirm the prediction, and it does not cleanly
refute it either — record it as it is, not as it was hoped.**

- **Link/Network clear the ">10×" bar (20.9×, 20.5×) — but in the wrong
  direction for the story F1 tells.** F1's own frame is that agentless civic
  prose starves the SVO mouth. Instead, civic Link yield is 20× *richer* than
  Frankenstein's, not poorer. The mechanism, read off the numbers rather than
  assumed: Frankenstein's subjects and objects are mostly **pronouns** ("I
  saw", "he said") — invisible to `relations.js`'s resolver regardless of
  narrator-coref, because that resolver matches literal named surfaces only.
  The Nashville documents' subjects and objects are mostly **repeated
  institutional proper nouns** — "Metro", "MDHA", "the Housing Division" —
  because, per Assembly D's own animacy argument, an organisation has no
  pronoun to carry it forward, so its name must recur. That repetition is
  exactly what makes it resolvable SVO. **Civic prose is not agentless in
  the sense that starves Link; it is agentless in the sense that the
  full-naming density Assembly D already predicts (Elizabeth Lavenza 2.7%,
  Kurtz 4.6%, wire-service fixture 52.5%) feeds Link almost entirely with
  organisations.** This sharpens Assembly D's stakes rather than weakening
  them: without animacy gating, Link and Network on civic material are not
  merely occasionally contaminated by a stray city name (the Frankenstein
  pronoun-binding case) — they are **structurally built from institutional
  names standing in subject/object position**, at 20× the rate of a novel.
- **Entity misses "&lt;2×" by a small margin (2.2×), and Kind is degenerate
  (0 kinds on both real sources at `minKindSize=3`, `minPrevalence=0.25`) —
  neither confirms nor refutes anything at this sample size.** The
  Exec. Summary's 0.0 Entity reading is a short-document floor effect
  (`minArrivals=5` over 212 sentences), not a genre finding.
- **Field's "&lt;2×" holds by construction, not by measurement.** Normalizing
  every terrain per 1000 sentences makes Field — which *is* the sentence
  count — exactly 1000.0/1000 on every source, always. This is a flaw in the
  normalizing choice, not evidence Field is stable; a fair test would
  normalize per 1000 words instead, or drop Field from the checked list
  entirely. Recorded as a self-test gap in the census instrument itself.
- **Lens's 45× swing is not independent evidence, and should not be read as
  a "reading channels" failure.** This census's Lens number folds
  `emergence/tiers.js` over the *same* node/edge arrivals Link produces —
  it is mechanically downstream of Link's own 20× swing, not a second,
  independent measurement. "The reading channels" spec 11 §3 means —
  `recalled`/`activation`/`reach`/`novelty`, `emergence/activation.js`'s own
  measured channels — are **not tested by this census at all**. Testing them
  is Assembly B's job, not Assembly A's; until `readingRegime` exists there
  is no wired path from raw text to those specific numbers, only to this
  differently-sourced tier-fold.
- **Paradigm is untestable, exactly as predicted going in** (§0's own
  finding) — not a new result.

**Reading against spec 11 §3's actual stop condition** — "if the channels
*also* swing by an order of magnitude, the diagnosis is wrong" — the
specific failure mode named is Entity/Field/the-reading-channels swinging
like Link/Kind/Network/Paradigm do. Entity's 2.2× is short of "an order of
magnitude"; Field's flatness is a normalization artifact, not a genuine
data point; and the actual reading channels remain unmeasured. **On its own
literal terms, this partial run does not trigger the named stop condition**
— but it also does not deliver the clean confirmation the pre-registration
hoped for, and the Link/Network direction reversal is a real complication
of §0's narrative, not a rounding error. Two of four sources are still
missing. This is recorded as a partial, honest result, not a green light.

What this does not establish: anything about narrative-high-SVO or
adversarial-civic (unmeasured), whether Kind would separate given more
signal (Frankenstein's own 7 being-records may simply be too few for
`minKindSize=3` regardless of genre), or whether "the reading channels" —
once Assembly B actually wires them — hold to &lt;2× the way this census's
proxy Lens number does not.

## Assembly B: Atmosphere from `recalled` — refused by its own stated test

`node scripts/reading-regime-frankenstein.mjs`. `packages/engine/loops/
reading-regime.js::readingRegime` wires `emergence/activation.js`'s
`recalled` channel into `loops/atmosphere.js`'s `createRegimeTracker`,
exactly the seam spec 11 §4 describes — both halves already existed and had
never been connected. Declared numbers matched to the existing precedent for
this exact material (`scripts/activation-clearings.mjs`'s own SPEC): `window
12, draws 200, tolerance 3, reseeds 5, seed 17`, `findOn: ["regularity"]`,
100-word chunks (785 frames over the full committed `pg84-frankenstein.txt`,
24 real chapter markers).

**The result is clean, and it is the negative one spec 11 §4 names in
advance as the refusal condition.**

```
rezero frames: 133, 255, 377, 499, 621, 743
B1 — recall 3/24  precision 3/6  chance 4.16  ROTATED 4.6±0.9  p≈0.985
B2 — shuffled (30 trials): mean 6.00 ± 0.00, range [6, 6]
     p(shuffled >= real) ≈ 1.000 (30/30)
```

Two facts, and they point at the same cause. **The six rezero frames are
spaced exactly 122 frames apart, every time** — not approximately, exactly.
**Every one of 30 shuffled-order trials produced exactly 6 rezeros too**,
mean 6.00, sd 0.00. Shuffling the frames changes what `recalled` measures at
every position (recall is causal — a shuffled reading recomputes recall
against a completely different reading history) and the rezero count did not
move at all. This is not "the channel is somewhat weak." It is the channel
carrying no information into this decision: 767 of 785 frames never leave
`no_ground` — `groundFrom`'s own `10×window` minimum (120 frames at
window=12) means every rezero resets the clock, and the very next ground
built after ~120 frames of accumulation is, apparently, reliably narrow
enough that the following few observations register as surfeit almost
immediately regardless of their actual value. **785 ÷ 122 ≈ 6.4** — the
observed rezero count is arithmetic on the total length and the minimum
ground size, not a reading of the material.

**Per spec 11 §4's own pre-registered refusal condition** — "If regime
boundaries from `recalled` land at the rate the slack-run null predicts, the
channel is a boundary detector and not an Atmosphere, and it should stay a
detector. Record that and stop; do not proceed to C." — **that is exactly
what this is.** No parameter search was run looking for a better result:
the declared numbers are the ones this project's own prior work already
established for this material, and re-deriving different ones until a
rezero count looked meaningful would be the same failure this file exists to
refuse elsewhere.

**What this does establish, and what it does not.** The seam itself is
sound engineering — causal (conformance/reading-regime.test.js's prefix-
stability test), refuses an undeclared channel, and its documented trigger
condition (sustained clearings against an established ground) fires when
by-construction satisfied and never fires when nothing recurs. `emergence/
activation.js` now has an engine-module importer, closing the SEED.md
growth-rule violation §0/F2 named — that checkpoint is real regardless of
this result.

### Three corrections, found by chasing the 122 rather than accepting it

**(1) The clearing is one this file already measured at chance.**
`createRegimeTracker`'s trigger is *surfeit* — `exceeds_witness` above the
ground, accumulated to `tolerance`. This document's own headline table, at
the top, records surfeit alone at **4/24, p≈0.84** against rotated chapters,
and states it plainly: "surfeit alone is at chance." The clearing that works
is `moved` — did the ground itself shift under maintenance — at **19/24,
p≈0.000**. Spec 11 §4 specified `createRegimeTracker`, so Assembly B was
built on the known-bad clearing. The refutation above is, in part, a
rediscovery of a result already in this file.

**(2) The series trends, which turns surfeit into a clock.** `recalled` is
not stationary: it climbs from 0 through the first 15 frames to 124-127 by
frame 140, because posting lists grow as the read proceeds — more prior
frames exist to answer, so more answer. A ground built over a trailing
window of a rising series is exceeded by what follows *structurally*,
independent of content. Clearings accumulate, `tolerance` trips, the ground
rebuilds at the new level, and the cycle repeats at a fixed period set by
`groundFrom`'s `10×window` minimum: 785 ÷ 122 ≈ 6.4 re-zeros. This is why
shuffling changes nothing — the trend is a property of *how much has been
read*, not of what was read, so it survives any reordering intact. The
ground was never cleared; the trend stayed in it and became it.

**(3) The premise number does not reproduce on the committed fixture.**
This document records `recalled` at **22/24 tight recall, 20/23 precision,
p≈0.005** — the number spec 11's F2 rests on ("the strongest measured
channel... is a refuted organ"). That run used
`scripts/activation-clearings.mjs`'s default path,
`/home/user/eoreader4.2/tests/fixtures/frankenstein.txt` — a **legacy-repo
file that does not exist in this repository** (eoreader4.2 is frozen
reference per the constitution's I.2; nothing is ported from it). Re-run
against the fixture this repo actually commits
(`scripts/adversarial/fixtures/pg84-frankenstein.txt`, 785 frames, 24
markers, same spec):

| channel | causal | tight | ROTATED (causal) |
|---|---|---|---|
| causal surprisal | 4/24 | 4/24 | p≈0.857 |
| activation | 4/24 | 4/24 | p≈1.000 |
| reach | 4/24 | 3/24 | p≈0.485 |
| novelty | 3/24 | 2/24 | p≈0.760 |
| **recalled** | **8/24** (5/5 prec) | 5/24 | **p≈0.046** |

The *relative* claim survives cleanly — `recalled` is still the strongest of
the five channels, and the only one clearing its rotation null. The
*absolute* claim does not: 8/24 at p≈0.046, not 22/24 at p≈0.005. Whether
the gap is the different text, different chunking, or drift in the code
since that run is untested and should not be guessed at. **Every downstream
statement resting on "22/24, p≈0.005" — including spec 11 §0's F2 — should
be re-read against 8/24, p≈0.046 until the discrepancy is closed.**

**What is actually open.** Not "is `recalled` usable" — through the `moved`
clearing it already clears its null at p≈0.046 on this fixture, which is
more than any other channel does. The open question is whether an Atmosphere
can be built from it *at all*, given that the device spec 11 named
(`createRegimeTracker`) uses the clearing this project measured at chance,
and given that the series needs detrending before any ground over it is a
ground rather than a lagging estimate of a slope. Both are structural, not
parameter choices: a metronome driven by `10×window` retuned to a different
`statistic` or `window` metronomes at a different rate, it does not stop.

**Per spec 11 §4's explicit instruction, Assembly C (the Lens from channel
disagreement, which depends on B) does not proceed from this result as
specified.** A Lens built over disagreement between two regime trackers
inherits whichever of them is a metronome; two metronomes at different
periods would produce a "disagreement series" with no reading-act content
in it at all.

## Spec 13 Assembly A: the two-knob cross — pre-registered prediction

*Written and committed **before** `scripts/resolution-knob-cross.mjs` was run
for the first time. Spec: `13-the-resolution-face.md` §5.*

**The claim under test.** `SEED.md`'s three declared numbers are one per grain
— `window` at Ground, `draws` at Figure (`difference()` reports `censoredAt =
1/draws`), `reseeds` at Pattern (`pattern()` reports `censoredAt = 1/reseeds`).
If that is real, a question is governed by the declared number of the grain it
is asked at, and no other.

**The question.** `level()` asks a Pattern-grain question. Its threshold is
`max(floor, reseedNull)` where `floor = 2/draws` (the Figure knob) and
`reseedNull` comes from `reseeds` (the Pattern knob). Material: white noise
coarsened by successive block-averaging, adjacent scales, where every relation
should be `peer` — `level()`'s own control, per its docstring.

**Predictions.**

- **P1** — floor only (no reseeding null supplied): the false-ladder rate does
  **not fall** as `draws` rises across 60 → 120 → 300 → 600. This is a
  replication of the direction `level()`'s docstring already records (3.08 →
  4.42 of 5).
- **P2** — with the reseeding null supplied: at fixed `draws`, the false-ladder
  rate **falls** as `reseeds` rises across 6 → 12 → 24 → 48.
- **P3 (discriminating)** — with the reseeding null supplied, the false-ladder
  rate is approximately **flat in `draws`**: its spread across the four `draws`
  settings is smaller, at every `reseeds > 0`, than the spread across the same
  four settings with the floor alone.

**What refuses the claim.** P3. If `draws` still governs strongly once the
reseeding null is doing the work, `draws` is not specifically the Figure-grain
resolution and spec 13 §1's assignment is wrong.

**What refuses the design (not the claim).** A systematic direction in the
above/below balance would mean coarsening induces a real level, the ground truth
`peer` is false, and this control cannot answer the question at all.

**Nothing here is tuned.** The `draws` settings are the docstring's own, so the
floor-only row is a replication; the `reseeds` settings span the range
`pattern()`'s own false-positive table already measured. No value is chosen by
what it does to a score and no operating point is proposed.

*Result appended below after the run.*

### Read — first control refused by its own design check

The first control was `level()`'s own docstring's material: white noise
coarsened by successive block-averaging, own = the finer scale, target = the
next coarser. The design check fired unambiguously — **0 above / 528 below**
across every cell of the cross, with the laddered rate at 100% almost
everywhere. Coarsening halves the extent at each step, and `pattern()`'s own
docstring already records why that is fatal here: *"burstiness is a max over
windows, so its expectation rises with extent for no reason but extent."* The
control was measuring the extent artefact, not a level.

**That is a finding about `level()`, not only about the control.** `pattern()`
refuses mismatched extents by type (`incommensurate_extent`, twice, under the
banner "Type error before null, both ways round (SEED.md #7)"). `level()` has
no such guard: it will happily level two grounds built over materials of
different extent, and on an extent-sensitive statistic the verdict is then
100% laddered in a single direction. Recorded here; no fix attempted in this
change.

Two replacement controls, both holding extent, statistic, perturbation and
window exactly fixed:

- **seed-only** — own and target are grounds over the *same* material with the
  *same* spec, differing only in perturbation seed. This is the shape `level()`
  is actually used in by the growth rule (own = candidate's ground, core =
  shuffle's ground, same material) with the candidate set equal to the core.
- **same-law** — own and target are grounds over two *independent* white-noise
  series of identical length. No level exists by exchangeability, but the
  variation to be cleared is material-to-material rather than seed-to-seed.

### Read — P1 held, P2 held, **P3 refused**

`seed-only` (96 trials): **0 false ladders in every one of the 20 cells**, at
every `draws` and every `reseeds`, floor-only included. The growth rule's own
use-shape is safe: when two grounds share their material, displacement is far
inside even the smallest floor. The P1/P2/P3 verdicts this control prints are
therefore **vacuous** — a rate that is 0 everywhere cannot rise, fall, or
spread — and are not counted as support for anything.

`same-law` (96 trials) is the informative one:

| threshold | draws=60 | 120 | 300 | 600 |
|---|---|---|---|---|
| floor only | 81.5% | 89.2% | 93.5% | 96.8% |
| reseeds=6 | 57.5% | 63.0% | 74.2% | 80.9% |
| reseeds=12 | 51.8% | 58.7% | 72.0% | 78.7% |
| reseeds=24 | 42.7% | 50.5% | 68.5% | 77.7% |
| reseeds=48 | 36.3% | 47.7% | 66.3% | 73.4% |

*(false-ladder rate — `above` or `below` where only `peer` is true. Direction
balance across all cells 602 above / 643 below, so the control itself carries
no level: the design check passes.)*

- **P1 HELD.** Floor-only laddering rises with draws, 81.5 → 96.8%,
  replicating the direction `level()`'s docstring records (3.08 → 4.42 of 5).
  Paying for more Figure resolution buys a worse Pattern answer.
- **P2 HELD** at every `draws`. Turning the Pattern knob improves the Pattern
  answer, monotonically, at every setting of the Figure knob.
- **P3 REFUSED.** The rate keeps rising steeply with `draws` even with the
  reseeding null supplied — 36.3 → 73.4% at reseeds=48 — and the spread across
  draws is *larger* with the null than without it. The Figure knob does **not**
  stop governing the Pattern verdict once the Pattern knob is doing the work.

**P3 was the pre-registered discriminating test and it failed.** Spec 13 §5
said in advance that this refuses the strong form of the claim, and it does:
the assignment `reseeds → Pattern` is not sufficient to make `draws` stop
governing a Pattern-grain verdict. What survives is the weaker pair P1 + P2 —
the right knob improves the answer and the wrong knob degrades it — which is
the direction the three incidents in spec 13 §3 already showed, now replicated
blind on material with nothing in it.

### Pre-registered: the mechanism behind P3's refusal (post hoc diagnosis, own numbers stated first)

One diagnosis is available and it is post hoc, so it is filed as a prediction
with its own numbers rather than as a conclusion. `reseedNull` is measured in
**rank** units, and rank resolution is `1/draws` — a Figure-grain quantity. If
that is the route by which `draws` leaks into a Pattern verdict:

- **M1** — mean `reseedNull` falls as `draws` rises, at fixed `reseeds`.
- **M2** — mean `|displacement|` does not fall as `draws` rises.

Together those would mean the Pattern-grain threshold shrinks underneath a
signal that does not — a **grain leak in `level()`**, not a fact about the
material. If M1 fails, the diagnosis is wrong and P3's refusal stands
undiagnosed. The instruments emitting M1 and M2 were added and committed
before the numbers they report were read.

### Read — M1 held, M2's operationalization refused on a dip, the leak is real

| `same-law`, reseeds=48 | draws=60 | 120 | 300 | 600 |
|---|---|---|---|---|
| mean `reseedNull` (the threshold) | 0.180 | 0.119 | 0.071 | 0.049 |
| mean `\|displacement\|` (the signal) | 0.165 | 0.144 | 0.142 | 0.140 |
| false-ladder rate | 36.3% | 47.7% | 66.3% | 73.4% |

- **M1 HELD** at every `reseeds` setting: mean `reseedNull` falls monotonically
  as draws rises — a 3.6× collapse across a 10× change in `draws`.
- **M2**: mean `|displacement|` runs 0.148 → 0.139 → 0.140 → 0.140 on the
  floor-only row — flat within 0.6% after a 6.5% dip at the first step. **The
  pre-registered test as coded (monotone non-decreasing) printed REFUSED on that
  dip and that is what is recorded.** The sentence M2 was written to test ("does
  not fall as draws rises") is supported by the same numbers. The
  operationalization was stricter than the sentence; that is an error in the
  pre-registration and it is left visible rather than restated to match.

The threshold collapses while the signal it must clear stays flat, and the
verdict follows the threshold. `level()`'s two declared numbers pull **opposite
ways on one quantity** — `reseeds` widens the threshold, `draws` narrows it — so
"declare more resolution" is ambiguous in this organ depending on which number
is meant.

**The kind of defect this is: a grain leak** — a quantity belonging to one grain
denominated in another grain's units. Invisible to the operator face (the act is
`EVA` either way) and to the terrain face (the object is a Network either way).
Only the stance face carries resolution, so only the stance face can see it.

Two things `level()` is missing, both recorded and neither fixed here: the
`incommensurate_extent` guard `pattern()` has twice, and a draws-invariant form
of its verdict — which `nul/index.js` already contains, thirty lines further
down, in `objectify()`'s `displacement / reseedNull`. Spec 13 Assembly E states
what would have to be measured before either is called a fix.

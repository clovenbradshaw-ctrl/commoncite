# 13 — The stance face is the resolution face

**Repo:** eoreader6, at `a0cbaf5`.
**Status:** finding + spec, **with its own discriminating prediction refused
and the refusal diagnosed** (§5). No production code changed by this document.
Assembly A (the measurement) ships with it as `scripts/resolution-knob-cross.mjs`;
B through F are proposed and unbuilt.
**Governs:** `CUBE.md` (the over-determination claim in "Three faces"),
`SEED.md` ("Three declared numbers"), `packages/engine/operators.js`
(`cellOf`), `nul/index.js` (`difference`, `pattern`, `level`), and any future
organ that reports a number without reporting what bounds it.
**Discipline:** measured before asserted; pre-registered predictions written
and committed before the numbers were read; a gap is a result; nothing here
derives a cell from content, so `CUBE.md`'s refutation of the cube as a
classifier stands untouched.

---

## 0. The finding

The three faces are described as co-equal projections of one coordinate. They
are not co-equally *understood*:

| face | projection | what it has been given |
|---|---|---|
| operator | (mode, domain) | the algebra, the organ roster, `OPERATOR_ORDER`, the surfer's dispatch key |
| terrain | (domain, grain) | a whole representation standard (doc 12, `STANDARD-1`) |
| stance | (mode, grain) | a string printed next to the other two |

Stance appears in exactly three places in running code: a derived field in
`cellOf`, a copied field on `turn.js` / `atmosphere.js` event records, and a
hand-written literal in three `generation/` organs that are not in the roster.
Nothing reads it. Nothing is refused because of it. It is the only face with
no work to do.

**The claim of this document is that stance has been idle because its axis was
misread as a taxonomy when it is a physics.** `grain` on the terrain face is a
*type* — what kind of thing the act's object is (a Void, an Entity, a Kind).
`grain` on the stance face is a *resolution* — how fine a claim the act is
entitled to make. Those are two different readings of one axis, which is
precisely the over-determination `CUBE.md` says the cube exists to provide and
which the code has never actually supplied.

And the resolution reading is not an interpretation added from outside. It is
already in the engine, one number per grain, sitting unassembled.

**What came of pointing it at something (§5, read it before the argument if you
only read one section).** The document's own discriminating prediction was
refused, and the refusal is the useful part: `level()` — the engine's growth-rule
admission test — turns out to hold a Pattern-grain threshold denominated in
Figure-grain units, so its two declared numbers pull opposite ways on one
quantity and "declare more resolution" is ambiguous in it. That defect is
invisible to the operator face and invisible to the terrain face. It has a name
now, **a grain leak**, and the first thing the instrument was pointed at had
one. A second, unrelated hole surfaced on the way: `level()` has no
`incommensurate_extent` guard where `pattern()` has two.

---

## 1. The three declared numbers are the grain axis

`SEED.md`'s "Three declared numbers" says of them: *"They are the whole
physiology. None of them is ever a default."* There are three of them and there
are three grains, and two of the three are already named by their grain:

| grain | declared number | `SEED.md`'s own words | reported in code as |
|---|---|---|---|
| Ground | `window` | "the reach of the present: how much of the material is contemporary with itself" | `ground.spec.window` — no `censoredAt` (§6, Assembly F) |
| Figure | `draws` | "the resolution of testimony. The finest rank sayable is 1/draws" | `difference()` → `censoredAt: 1 / s.length` |
| Pattern | `reseeds` | "the resolution of pattern" | `pattern()` → `censoredAt: 1 / reseeds` |

The third column is prose and could be a naming coincidence. The fourth is not.
`difference()` — the act of placing one figure against a ground — reports its
own censoring bound as `1/draws`. `pattern()` — the act of asking whether a
figure moved the ground — reports its own as `1/reseeds`. Two organs, in one
file, each reporting the resolution of its own grain, from that grain's own
declared number, and nowhere in this repository are those two lines read as one
fact.

`level()` makes the same statement a third time, in the negative:
`floor = 2 / ownGround.samples.length` — its docstring calls it *"the finest
rank difference two grounds can even express"*. That is a Figure-grain quantity
by construction: it is `draws`, doubled because two rank readings are involved.

**Why `ground()` taking both `draws` and `window` is not a counterexample.**
`ground()` manufactures the resolution the grains above it will spend. Supplying
a number is not the same act as being governed by it: `window` decides what one
sample *is*, `draws` decides how many samples there are and therefore how finely
anything placed against them can be ranked. The organ that constructs the
apparatus necessarily holds every dial; the organ that reads through it is
bounded by exactly one.

---

## 2. What that makes the stance face

If each grain has exactly one declared number, then

```
stance = (mode, grain) = (what act, at what resolution)
```

and the stance face is the only face that carries the engine's whole declared
physiology. The other two carry none of it: `mode` and `domain` name no number,
and terrain's grain names a type rather than a bound.

Read that way the three faces stop being three vocabularies for one thing and
become three genuinely different questions:

- **operator** — what act. *(dispatch: which organ)*
- **terrain** — on what, and of what kind. *(representation: how it is shown)*
- **stance** — how finely, and therefore at what cost, and therefore **what may
  be said at all**. *(refusal: what claim this act is entitled to)*

The third has never been asked. That is the power in the title of this
document: **the stance face is where an act's precision bound lives, and a
precision bound is a refusal that costs nothing to enforce.** `SEED.md` #7 —
"refusal has two tiers: type error before null; never spend a measurement on
what the algebra catches" — has been available to the operator face (an
out-of-order chain is a `TypeError` in `validateChain`) and unavailable to the
resolution face, which is where the expensive mistakes actually happened.

---

## 3. Three incidents in the record, one shape

Each of these is already written down. None of them is written down as an
instance of the others.

**(a) `level()`'s floor, standing alone — the wrong knob.** Called without
`material`/`reseeds`, `level()` falls back to `threshold = floor = 2/draws`: a
Figure-grain number answering a Pattern-grain question. On white noise coarsened
to six scales — material with no scale structure, where every relation should be
`peer` — its own docstring records false laddering **rising** with draws:

| draws | threshold | laddered / 5 | above / below |
|---|---|---|---|
| 60 | 0.0333 | 3.08 | 21 / 16 |
| 120 | 0.0167 | 3.42 | 19 / 22 |
| 300 | 0.0067 | 4.33 | 27 / 25 |
| 600 | 0.0033 | 4.42 | 26 / 27 |

A caller who pays for more resolution gets a *worse* answer. `AMENDMENT-5-PROPOSAL.md`
files this as recurrence #6 of the commensurability defect (a null answering a
different question than the one asked), which it is. It is also something
narrower and more mechanical: a **grain mismatch**, and mechanical enough to be
caught by type.

**(b) `SEED.md` Amendment XV — the right knob, at Figure grain.** A censored
testimony verdict was interrogated by escalating `draws` 200 → 12,800. The
question asked was "is a censored verdict a near miss that resolution can
close?" — a Figure-grain question, answered with the Figure knob. Mean
exceedance shrank monotonically, 0.654× → 0.432× → 0.348× → 0.218× the null's
own width; on `burstiness/phase` it closed outright, 95/96 lines placed. Where
it did not close (`burstiness/resample`, 0/96 at every setting) the amendment
concluded the gap was **structural, not a resolution shortfall** — a conclusion
only available because the right knob had been turned far enough to exhaust it.

**(c) `pattern()`'s `nullMax` — the right knob, at Pattern grain.** The raw
maximum over `reseeds` reseed draws was itself an order statistic rising with
`reseeds`, so a caller declaring fewer reseeds got an easier null. Measured
false-positive rate on 150 trials of pure reseed noise, by `reseeds`: 34.7 →
24.7 → 17.3 → 10.7 → 4.7 → 1.3 → 1.3 % (raw max), 18.7 → 10.7 → 6.7 → 2.0 → 2.0
→ 1.3 → 1.3 % (corrected). Monotone down, both columns.

**The shape.** Turn the knob belonging to the question's own grain and the
answer improves monotonically until it either closes or is shown to be
structural. Turn any other grain's knob and the answer does not improve — and in
(a) it degrades, monotonically, in the direction that looks like buying more
rigour. Three measurements, three years of debugging compressed, one law never
stated:

> **A question is governed by the declared number of the grain it is asked at.
> Escalating any other grain's number is not a weaker fix; it is not a fix.**

Assembly A tests exactly this, because a law assembled backwards out of three
incidents is a story until it makes a prediction that can fail.

---

## 4. The over-determination `CUBE.md` claims, and does not have

`CUBE.md`: *"Terrain and stance both carry grain, so grain is claimed twice —
and that redundancy is the whole point. Over-determination is what makes an
address falsifiable."*

It is not falsifiable as built. `cellOf(op, grain)` takes **one** `grain`
argument and stamps it into both projections:

```js
terrain: TERRAIN_BY_DOMAIN[domain][grain],
stance:  STANCE_BY_MODE[mode][grain],
```

Two fields, one input, no possible disagreement. The redundancy is a display
redundancy. Nothing can be refused by it, which means the sentence about
falsifiability has been decorative since it was written.

With §1's assignment the two readings separate and can genuinely disagree:

- **terrain-side grain** — a type question, answerable from what the organ's
  object *is*: does it hand back a Void, an Entity, a Kind (and the Structure /
  Interpretation rows likewise).
- **stance-side grain** — a resolution question, answerable from what bounds the
  organ's finest claim: which of `window` / `draws` / `reseeds` its own refusal
  path requires.

An organ that declares `grain: "Pattern"` and whose claim is bounded only by
`draws` is refuted **by its own address**, before any measurement is spent. That
is the check that would have caught (a) for free, and it is the first non-
decorative use the stance face has ever had.

---

## 5. Assembly A — the two-knob cross (pre-registered)

**File.** `scripts/resolution-knob-cross.mjs`. Ships with this document, run
after it was committed.

**What it does.** `level()` is asked a Pattern-grain question over
`level()`'s own control material (white noise coarsened by successive block
averaging, adjacent scales, ground truth `peer` everywhere), sweeping both
knobs against each other: `draws ∈ {60, 120, 300, 600}` (the docstring's own
settings, so the floor-only row is a replication) × `reseeds ∈ {none, 6, 12,
24, 48}`. No new statistic, no new perturbation, no new mechanism; the cross
itself is the only new thing.

**Pre-registered predictions.** Written here and in `scripts/RESULTS.md` and
committed before the script was run:

- **P1** — floor only: the false-ladder rate **does not fall** as draws rises.
  (Replication of the recorded direction.)
- **P2** — with the reseeding null supplied: at fixed `draws`, the false-ladder
  rate **falls** as `reseeds` rises.
- **P3 (discriminating)** — with the reseeding null supplied, the false-ladder
  rate is approximately **flat in `draws`**: its spread across the four draws
  settings is smaller, at every `reseeds > 0`, than the spread across the same
  four settings with the floor alone.

**What refuses this.** P3. If `draws` still governs strongly once the reseeding
null is doing the work, then `draws` is not specifically the Figure-grain
resolution, §1's assignment is wrong, and Assemblies B–E do not follow.

**The design's own refusal condition.** Coarsening must not induce a real level.
Direction balance (above vs below) is reported in every cell; a systematic
direction means the control material has scale structure after all and the
ground truth `peer` is false, which would refuse the design rather than the
claim.

**Not tuned toward anything.** No value here is chosen by what it does to a
score, and nothing in this assembly proposes an operating point for any organ.
The response surface *is* the finding.

### 5.1 What the run said

Full tables in `scripts/RESULTS.md`. Three results, in the order they arrived.

**The control was refused first, by its own stated check.** `level()`'s own
docstring's material — white noise coarsened by block-averaging — produced **0
above / 528 below** and ~100% laddering. Block-averaging halves the extent at
each step, and `pattern()`'s docstring already says why that is fatal:
*"burstiness is a max over windows, so its expectation rises with extent for no
reason but extent."* The control was measuring the extent artefact.

That is also a finding about `level()` rather than only about the control:
**`pattern()` refuses mismatched extents by type — `incommensurate_extent`,
twice, under the banner "Type error before null, both ways round (SEED.md #7)"
— and `level()` has no such guard at all.** It will level two grounds built over
materials of different extent, and on an extent-sensitive statistic the verdict
is then fully determined and fully wrong. Recorded; no fix attempted here.

**On the replacement controls (extent, statistic, perturbation, window all held
fixed):**

| threshold (`same-law`) | draws=60 | 120 | 300 | 600 |
|---|---|---|---|---|
| floor only | 81.5% | 89.2% | 93.5% | 96.8% |
| reseeds=6 | 57.5% | 63.0% | 74.2% | 80.9% |
| reseeds=12 | 51.8% | 58.7% | 72.0% | 78.7% |
| reseeds=24 | 42.7% | 50.5% | 68.5% | 77.7% |
| reseeds=48 | 36.3% | 47.7% | 66.3% | 73.4% |

*False-ladder rate where only `peer` is true; 96 trials; direction balance 602
above / 643 below, so this control passes its own design check. The `seed-only`
control — two grounds over the same material, the growth rule's actual
use-shape — laddered **0 times in all 20 cells**, so its verdicts are vacuous
and are counted as support for nothing.*

- **P1 HELD.** Floor-only laddering rises with draws, 81.5 → 96.8% —
  replicating, blind, the direction the docstring records (3.08 → 4.42 of 5).
- **P2 HELD** at every `draws`. The Pattern knob improves the Pattern answer,
  monotonically, at every setting of the Figure knob.
- **P3 REFUSED.** The rate still climbs 36.3 → 73.4% with draws at reseeds=48.
  The Figure knob does **not** stop governing once the Pattern knob is working.

**P3 was the discriminating test and it failed, so the strong form of this
document's claim is refused, not repaired.** What survives is P1 + P2: the
right knob improves the answer and the wrong knob degrades it — §3's shape,
now replicated blind on material with nothing in it.

### 5.2 The diagnosis, filed post hoc with its own numbers pre-registered

`reseedNull` is measured in **rank** units, and rank resolution is `1/draws` —
a Figure-grain quantity. Two instruments were added and committed before the
numbers they report were read:

- **M1 HELD**, at every `reseeds`: mean `reseedNull` falls monotonically as
  draws rises — e.g. at reseeds=48, `0.180 → 0.119 → 0.071 → 0.049`, a 3.6×
  collapse across a 10× change in `draws`.
- **M2**: mean `|displacement|` runs `0.148 → 0.139 → 0.140 → 0.140` — flat
  within 0.6% after a 6.5% dip at the first step. **The pre-registered test as
  coded ("monotone non-decreasing") printed REFUSED on that dip**, and that is
  what is recorded; the sentence M2 was written to test ("does not fall") is
  supported by the same numbers. The operationalization was stricter than the
  sentence, which is an error in the pre-registration and is left visible.

So the threshold collapses 3.6× while the signal it must clear stays flat, and
the verdict follows the threshold. **`level()`'s two knobs pull opposite ways
on one quantity**: `reseeds` widens the threshold, `draws` narrows it, and
"declare more resolution" is therefore ambiguous in this organ — the answer
depends on which number is meant.

That is the thing this document is for, and it is worth naming as a kind:

> **A grain leak: a quantity belonging to one grain, denominated in another
> grain's units.** It is invisible to the operator face (the act is `EVA`
> either way) and invisible to the terrain face (the object is a Network either
> way). Only the stance face can see it, because only the stance face carries
> resolution.

The first time the instrument was pointed at anything, it found one, in the
engine's own admission test. §3's three incidents were all this same defect
without a name.

---

## 6. Assemblies B–F — proposed, unbuilt

**B — make the third face computable.** `operators.js` gains
`resolutionOf(grain)` (`Ground → "window"`, `Figure → "draws"`, `Pattern →
"reseeds"`) and `censoredAt(cell, spec)`, returning the finest claim an act at
that cell is entitled to make under the caller's declared spec. `cellOf` already
returns the stance string; this makes the string mean something a caller can be
refused by. Conformance: every organ that reports a magnitude reports the bound
that censors it, in the same record — `difference()` and `pattern()` already do,
and are the pattern the rest are held to.

**C — the roster audit, as a census, not a fix.** For each entry in `ORGANS`,
compare the declared grain against which declared number the organ's own refusal
path requires. Report every disagreement as a typed gap. This is a measurement
of the instrument, exactly as `emergence/coverage.js` is, and it must not
silently rewrite a single declared cell — a disagreement is a finding about
either the organ or the assignment, and which one is not knowable from the
disagreement alone. The three `generation/` organs that self-declare a `CELL`
without roster registration (`standpoint.js`, `slots.js`, `conventions.js` —
spec 11's I5 names them as known drift) are outside `ORGANS` and so outside this
audit; that they are the least-checked cells in the repo is noted, not acted on.

**D — the lossless fold test, made quantitative.** `CONSTITUTION.md` II.21: *"a
fold is lossless — it reduces resolution and never makes anything up."*
Resolution is now a number. A fold from Figure to Pattern moves the bound from
`1/draws` to `1/reseeds`, and in every spec this repo declares `reseeds` is one
to two orders of magnitude smaller than `draws` (e.g. `read-people.mjs`:
`permutations: 200`, `reseeds: 24`). So folding up is a real, large loss of
resolution — legal, and currently unreported. Losslessness at a fold should mean:
every claim the finer grain made is either still placeable at the coarser bound
or **explicitly censored**, never silently coarsened. No fold in this repo
reports either.

**E — close `level()`'s grain leak with a form that already exists in the same
file.** The leak in §5.2 is that a Pattern-grain threshold is denominated in
Figure-grain rank units. `nul/index.js` already carries the draws-invariant
form of exactly this ratio, thirty lines further down, in `objectify()`:
*"displacement in units of the reseeding null: how far this figure moved the
ground beyond what the material moves it by itself"* — `record.pattern.displacement
/ record.pattern.reseedNull`. A `level()` that reported its verdict in units of
its own null would be porting a form this file already trusts, not inventing
one, which is the only reason this assembly is worth proposing at all (the
repo's standing complaint against itself is that everything gets reinvented,
worse).

**It is not proposed as a fix, because it is not yet established as one.** The
ratio's own null is not free: `objectify()` can use it because `pattern()`'s
`reseedNull` is a calibrated ceiling (mean + 3·std of the reseed displacement
samples), and `level()`'s is a bare maximum over `reseeds` draws — the same
raw-maximum defect `pattern()` was already corrected for and `level()` was not.
Acceptance would be: the false-ladder rate on `same-law` becomes flat in
`draws` (the P3 that just failed), the `seed-only` control stays at zero, and
the growth rule's standing licenses are re-checked and reported as moved or
not moved. Also blocking: `level()` gains the `incommensurate_extent` guard
`pattern()` has, which §5.1 shows it needs on its own account.

**F — the Ground-grain bound, deferred with the question stated.** `window` is
"the reach of the present", and the table in §1 has a hole: no organ reports a
Ground-grain `censoredAt` the way `difference()` and `pattern()` report theirs.
The natural reading — nothing separated by less than one `window` is separable
at all, so `window` is the Ground-grain resolution in units of the material — is
plausible and **not established here**. It is the weakest leg of §1 and is named
as an open question rather than filled. If it is wrong, §1 holds for two grains
out of three and the stance face is two-thirds of a physics; that is still more
than a printed string, and saying so is cheaper than guessing.

---

## 7. What this document does not claim

- **It does not claim P3.** The prediction that supplying a question's own
  grain's number makes every other grain's number stop governing was
  pre-registered as the discriminating test, and it was refused (§5.1). What is
  claimed is the weaker, replicated pair: the right knob improves the answer
  monotonically, the wrong knob degrades it. The diagnosis in §5.2 is post hoc
  and is labelled as such, with its own numbers pre-registered — it is a
  hypothesis about `level()`, not a rescue of P3.
- It does not resurrect the cube as a classifier. Nothing here derives a cell
  from content; every cell discussed is one an organ already declares.
- It does not propose an operating point for `draws`, `reseeds`, or `window`.
  Declared-never-defaulted is untouched: the point is that the *identity* of the
  number a question must declare is entailed by the question's grain, not that
  any particular value is right.
- It does not resolve `CUBE.md`'s open tension about `DEF.admit`, nor the
  hand-list contradiction inherited from `eoreader5`. Both stand.
- It does not amend the constitution. II.21's fold test is cited, and Assembly D
  would give it a number; whether that is an amendment or a reading is a
  question for the assay, not for this file.

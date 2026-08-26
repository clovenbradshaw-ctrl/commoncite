# What the prediction harness measured

Reproduce with `npm run competency -- <path-to-a-text-file>`. Every number
below comes from `scripts/predictive-competency.mjs` at `window=6`, `draws=96`,
`tolerance=2`, `warmup=24`, `n=320`, scored by CRPS. All five declared numbers
are in the script header; none of them is a default.

Competency gain = baseline cumulative loss − candidate cumulative loss.
Positive means the candidate carried less loss than that baseline.

## The claim being tested

`SEED.md` says an organ joins only when the level test returns `above` against
the core, and that "unwired is failing." Import-graph wiring is the cheap half.
This is the expensive half: each organ is reduced to a committed predictive
distribution and scored against baselines it must beat, on a battery designed
so that a candidate cannot look good by accident.

## Result

| candidate | organ under test | verdict |
|---|---|---|
| `candidate:regime-mean` | atmosphere's causal re-zero tracker | **earned on real material**, with a caveat below |
| `candidate:aperture-scaled` | ground volume as an uncertainty signal | **not earned** — mildly harmful everywhere |
| `candidate:regime-aperture` | both at once | **not earned** — tracks regime-mean, always slightly worse |
| `candidate:placement-rate` | the ground's failure-to-place rate as uncertainty | **not earned** — beats all baselines on real prose, but never beats regime-mean |

### regime-mean, on real prose

Gain against every baseline, on the causal surprisal series of *Frankenstein*
(296 scored steps, 7 re-zeros):

| vs | gain |
|---|---|
| `baseline:last-value` | +12,801,506 |
| `baseline:global-mean` | +52,086,184 |
| `baseline:moving-mean-6` | +3,700,838 |
| `baseline:random-walk` | +12,801,506 |

Beating a fixed-window baseline is **not** evidence that the boundaries are
real. Regime-mean's slice is typically much longer than a 6-step window, and on
a mean-reverting series a longer slice estimates the mean better for reasons
that have nothing to do with where it starts. So the decisive test is the
**boundary permutation null**: hold the re-zero *count* fixed at whatever
atmosphere actually produced, destroy only the *placement*, 8 replicates.

| series | re-zeros | observed gain vs moving-mean-6 | null max | clears? |
|---|---|---|---|---|
| level-shift (positive control) | 2 | −118.7 | −132.5 | yes |
| ar1 (negative control) | 4 | −19.5 | −6.1 | no |
| trend (negative control) | 34 | −100.6 | −51.4 | no |
| noise (negative control) | 0 | — | — | n/a, nothing placed |
| **frankenstein (real)** | **7** | **+3,700,838** | **−438,711** | **yes** |

On real prose the placement beats every arbitrary placement of the same count,
by a wide margin. On both negative controls it does not. That is the result
this whole port was built to be able to state.

### The caveat, which is structural and not a rounding error

On the synthetic positive control, regime-mean **loses** to
`baseline:moving-mean-6` (−118.7) even though it clears the boundary null. It
found only 2 re-zeros in a series with 7 genuine level shifts.

The reason is directional, and it is pinned by a conformance test
(`conformance/prediction.test.js`, "MEASURED LIMIT"). Same staircase, same
magnitudes, run in both directions:

```
staircase UP   (0,2,4,...,14)   re-zeros: 10
staircase DOWN (14,12,...,0)    re-zeros:  0
```

**Atmosphere is structurally blind to a falling level.** Only censored-*above*
clears, because `SEED.md` #8 names censored-below as regularity and forbids
treating it as surfeit — and counting below as surfeit was measured once
already and re-zeroed on nearly every step. So the fix for over-firing produced
a half-blind detector. Both halves of that trade are real; neither is resolved
here. Named, not patched, because patching it without a measurement would just
be the earlier bug again.

### aperture, as an uncertainty signal

`SEED.md` calls aperture "the warmth you check for" and explicitly not a gate and
not a score. This did not try to make it one. It asked a narrower question — is
ground volume *informative* about how uncertain the next step is — by holding
the forecast centre identical to `baseline:last-value` and letting aperture
modulate only the spread, entering as a dimensionless ratio to its own running
mean so no scale constant was smuggled in.

The answer is no. `candidate:aperture-scaled` is negative on every series in the
battery, including real material (−323,142 vs last-value). If ground volume
carried no information the ratio would hover near 1 and the gain would sit near
zero; it is consistently, mildly worse than that, so the modulation is adding
noise. This does not touch aperture's role as a health sign. It refutes one
specific use of it, which is the only thing that was tested.

### placement, as an uncertainty signal

`enactor/efference.js` in eoreader4.2 held a predicted sensed-consequence
outstanding after every commit and attenuated the arrival that matched it.
eoreader6 authors no output to hear back, so there is no commit to copy — but
its monitor's triad survives the loss of the author, because atmosphere
already reads a ground's relation to an arrival three ways, one per
Interpretation×Ground operator:

| eoreader4.2 monitor | eoreader6 | mode | meaning |
|---|---|---|---|
| `SELF` | **EVA** · Tending | Relate | the ground places it |
| `SELF_MISMATCH` | **DEF** · Clearing | Differentiate | exceeds this ground; the ground stands |
| `WORLD` | **REC** · Cultivating | Generate | concede the ground, regrow here |

`tolerance` IS that middle term, already load-bearing: it is the count of
STRAINED steps before a ground is conceded, and it would be meaningless if the
distinction were two-valued. `push()` now returns this as `placement`; a fourth
case — no ground to judge against — is a typed gap, never PLACED.

It is deliberately **not** named efference. There, SELF meant "I emitted this
and sensed it return." Here nothing is emitted, so the available claim is about
the ground's grip on arrivals, not about a self. The stronger word would import
the authorship SEED.md's relativity debt says this module does not have.

`candidate:placement-rate` asks one narrow question: does the current regime's
non-PLACED rate, entered as a ratio to its own running mean (the same
dimensionless-bridge discipline as `candidate:aperture-scaled`), usefully
modulate `candidate:regime-mean`'s spread? Gain against
`baseline:moving-mean-6`, side by side with the candidate it must beat:

| series | regime-mean | placement-rate |
|---|---|---|
| level-shift (positive control) | −118.7 | −126.2 |
| ar1 (negative control) | −19.5 | −22.5 |
| trend (negative control) | −100.6 | −100.6 |
| noise (negative control) | +18.7 | −12.4 |
| **frankenstein (real)** | **+1,530,054** | **+1,311,812** |

**Not earned, but not harmful either.** On real prose it BEATS ALL FOUR
BASELINES (+1.31M over moving-mean-6, +9.81M over last-value) — the only
candidate besides `regime-mean` and `regime-aperture` to do so. It simply never
beats `regime-mean`, its own minimal contrast, on any series. The modulation
costs a little everywhere and adds nothing anywhere, which is a weaker verdict
than `aperture-scaled`'s (actively harmful) and still short of earning its place.

The placement permutation null (tag positions destroyed, count held fixed, 8
replicates) locates what information is actually there:

| series | unplaced | observed | null max | clears? |
|---|---|---|---|---|
| level-shift | 33 | −126.2 | −118.6 | no |
| ar1 | 49 | −22.5 | −21.8 | no |
| trend | 320 | −100.6 | −100.6 | no |
| noise | 14 | −12.4 | +15.8 | no |
| **frankenstein** | **68** | **+1,311,812** | **+1,239,358** | **yes** |

On real prose — and only there — the tags' real positions beat every shuffle of
the same count. So the placement signal is genuinely non-random on real
material and genuinely absent on all four synthetics, which is the correct
shape for the control battery. What it does not do is convert that information
into a better forecast than the regime boundary alone already gives.

**A bug this found, and what it cost.** The first version of this candidate
read a boolean `cleared` rather than a ternary `placement`, and its two
no-ground branches returned `cleared: false` — reporting "there is no ground
yet" as "the ground held." Under that version the candidate LOST to
moving-mean-6 on Frankenstein by 812K and cleared no null but noise's. Counting
unjudgeable steps as successful placements was the whole difference between a
losing candidate and one that beats every baseline. The measurement was not
wrong about a real thing; it was measuring an incoherent quantity. Recorded
because "the candidate is harmful" and "the candidate was fed a wrong number"
look identical in a results table.

**Which of the three this actually reads.** The fold uses all three, but not
symmetrically: OTHER is caught by the `rezeroed` branch first and RESETS both
counters, so it never reaches the numerator, and the typed gap enters neither
side. What the ratio measures is the within-regime **STRAINED rate** — how much
this ground has been failing to place while still standing — with OTHER as the
boundary that restarts the count. So the concessions enter only as resets,
never as magnitudes. Whether they carry information in their own right (their
spacing, density, time since the last one) is a different candidate with a
different minimal contrast, and has not been run.

## Measured dead end: `candidate:strain-magnitude` (refuted 2026-07-31)

The magnitude variant of the above was built, run, and **refuted**. It summed
atmosphere's per-step exceedance margin — `(observed − support[1])` in the
ground's own interquartile units — instead of counting each strained step as 1,
keeping the fold shape otherwise identical (the minimal contrast: size of load
vs fact of load). The code is reverted; this record is the reason it stays
reverted.

| battery leg | placement-rate gain | strain-magnitude gain |
|---|---|---|
| level-shift (positive control) | −126.2 vs moving-mean-6 | −124.4 vs moving-mean-6 |
| ar1 (negative control) | −22.5 | −22.3 |
| trend (negative control) | −100.6 | −102.0 |
| noise (negative control) | −12.4 | −12.4 |
| **frankenstein (real material)** | **+1,311,812** | **+866,747** |

Two readings settle it. First, on real prose the magnitude candidate gained
**445K less** than its minimal contrast — how hard the ground was loaded carried
less information than the bare fact that it was loaded; the magnitude is where
the rate's already-small signal leaks away. Second, like every regime candidate
it fails the positive control: neither placement-rate nor its magnitude
descendant beats regime-mean on level-shift, so neither earns regardless.
No strain permutation null was needed to decide this — the candidate never
reached the gate where that null would be read. Do not silently retry this
candidate; the honest open question that remains is the one already named
above (the spacing/density/time of concessions as a *separate* minimal
contrast), not the magnitude of a single concession.

One caution beyond the verdict: `candidate:placement-rate` is a private
replica — its own `createRegimeTracker` over a raw numeric series, like every
other candidate here — not a consumer of the real reaction channel.
`loops/turn.js`'s `events` (now `domain`-tagged Existence/Structure/
Interpretation, not just `terrain`) is where DEF/EVA/REC actually live for
anything that is not this benchmark, and `loops/turn.js` still has no importer
(see below).

## What is now wired, and what is not

`packages/engine/loops/atmosphere.js` had zero importers and zero tests before
this. It now has both, through `prediction/candidates.js`. `prediction/*` and
`competency/ledger.js` were 3-to-12-line stubs — `competencyGain()` returned
`0` unconditionally and `recordStep` mutated its argument, which are precisely
the two failure modes the real ledger exists to prevent.

Still unwired, and therefore still refuted by the growth rule:
`loops/turn.js`, `emergence/fold.js`, `observation-index.js`, `replay/`,
`search/`, `referents/` (one re-export nothing imports), `event_log/` (one
script). The relativity debt named in `SEED.md` — "nothing yet puts this
module's own acts in the record" — is untouched by this work.

`push()` in `loops/atmosphere.js` now returns `placement` — the ternary above,
plus a typed `no_ground` gap — where it previously discarded that reading every
call. `runTurn` and `readAtmosphere`'s `events` now carry `domain` alongside
`terrain`/`stance`, so DEF/EVA/REC (Interpretation — the reaction channel) are
filterable without knowing that `terrain === "Atmosphere"` is what that means.
Neither changes what either function decides; both only expose what they
already compute, and keep reactions separable from the existence (`regions`)
and structure (`field`) channels they were always distinct from.

## A defect this found on the way

`packages/spec/index.js` exported a `canonicalHashSync` that called
`JSON.stringify(data, Object.keys(data).sort())`. An array second argument to
`JSON.stringify` is a key **allowlist** applied at every depth, not a sort
order, so every nested key absent from the top level was dropped before
hashing. A prediction commitment sealed with it did not cover
`predictive_output` at all — the seal was blind to the one field it exists to
protect. Fixed in `packages/spec/canonical-json/`, with the tamper case pinned
by test.

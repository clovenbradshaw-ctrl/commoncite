# Brief: calibrate a real fix for REC's recourse locality

Read this whole file before touching code. It is written so a fresh agent
with no memory of the investigation that produced it can pick this up and
finish it correctly — or correctly conclude it can't be finished the way it
sounds like it should. Both are legitimate outcomes; only one of them
requires new code.

## Where this comes from

`CLAUDE.md`'s two sections dated 2026-08-21 — "Checking REC's recourse
locality against the online-algorithms literature" and its same-day
amendment — are the full record of what was measured and what was tried.
Read both before starting. This brief does not repeat their evidence, only
the part that matters for doing the next step correctly: the shape of the
fix, the traps already found, and what "done" has to mean.

**The one-line summary:** `packages/engine/loops/atmosphere.js`'s REC
(re-zero) firing does not exhibit the bounded recourse locality the
online-recourse literature's guarantees require, on real material, at the
real shipped `ATMOSPHERE_REGIME` parameters. Two distinct causes are live
and undisentangled:

1. **Trigger insensitivity** — `tolerance` consecutive censored-above
   placements is a blunt run-length counter. THIS BRIEF IS ABOUT THIS ONE.
2. **Non-incremental recompute** — `groundFrom` rebuilds the whole ground
   from `regionStart` on every tending step. Not this brief's job; named
   in CLAUDE.md as a separate, likely-larger, likely-harder problem (it may
   need a different statistical formulation, not an engineering fix at
   all). Do not attempt to fix cause 2 under this brief without saying so
   explicitly and re-scoping.

## The problem, precisely

`difference()` (`nul/index.js`) returns, on every step where the observed
value exceeds the ground's support, a typed gap carrying the actual
exceedance MAGNITUDE (`observed - support[1]`), not just a boolean. The
current trigger throws this magnitude away and only counts consecutive
occurrences (`clearings++` on above, `clearings = 0` on the very next
non-above step), firing at `clearings >= tolerance`. This is exactly the
"blunt threshold" a magnitude-weighted, decaying/cumulative trigger
(CUSUM-shaped) is supposed to improve on: sustained *small* excess that
never strings together `tolerance` consecutive violations should still be
findable.

## What was already tried, and why none of it is usable as-is

Three candidates were built and replayed against the real per-step
`difference()` trace on Frankenstein, Heart of Darkness, and Pride and
Prejudice (via a scratch harness, not committed — see "Rebuilding the
harness" below):

- **decay-by-1** (`clearings = above ? clearings+1 : max(0, clearings-1)`)
  and **decay-by-half** (same, decay 0.5/step): reproduced baseline's
  exact re-zero spans on every real corpus tried. Real above-censoring
  events are either already adjacent (fire identically to plain
  `tolerance`) or spaced far enough apart that ordinary decay drains the
  memory between them before the next one arrives. **Decay alone does not
  help.** Don't re-try it without a reason to think the above changed.

- **a leak/threshold CUSUM over normalized excess**
  (`potential = max(0, potential + excess - leak)`, fire at
  `potential >= threshold`): caught a genuinely new boundary on Pride and
  Prejudice, but also *chattered* — fired 3 times in immediate succession
  around ONE real event instead of once, because nothing in the design
  stops it re-crossing the threshold moments after it last fired. On Heart
  of Darkness it fired **zero** times at every `(leak, threshold)` pair
  tried, because the signal there is genuinely sparse (see next section) —
  no leak that also stays safe on iid noise at book length was found to
  bridge it.

**The load-bearing reason none of this is done:** the leak/threshold pair
was a hand-picked magic number, swept by eye against exactly three real
books. That is calibrating against the answer key — precisely the mistake
this repo's own CLAUDE.md top section ("Never tune a parameter by checking
what it does to a golden's own score") exists to name. `slackRunNull`
(`atmosphere.js`, same file) is the existing model for how a threshold in
this exact module is supposed to earn its number: built from a real null,
its false-alarm rate measured and bounded, not eyeballed.

## The actual numbers on the hard case (Heart of Darkness)

Only 3 above-censoring events occur in the entire 977-chunk read, at hops
50, 80, 85 (window=5, draws=256, tolerance=3, hop=5 — the real shipped
`ATMOSPHERE_REGIME`). The last two are adjacent (one hop apart) — one
short of firing under plain `tolerance=3`. Their normalized excess
magnitudes (`(observed - support[1]) / (support[1] - support[0])`) are
0.095, 0.119, 0.253.

This means: any leak fast enough to have been shown safe on iid noise at
900-3000 steps (0.15/step was tried and IS safe, 0/20 false alarms) fully
drains a single event's magnitude within ~2 steps — nowhere near enough
memory to bridge the ~30-step gap between the first event and the
adjacent pair. A leak slow enough to bridge that gap was not checked
against a null before this investigation ran out of budget.

**A trap already found, do not walk into it again:** a trigger with NO
leak at all (pure lifetime count of above-events, fire at `tolerance`
total ever) trivially fires on Heart of Darkness — but on a sufficiently
long read it is *guaranteed* to eventually misfire on pure noise too, no
matter how rare the true background above-rate is, because a monotonic
counter with no floor-seeking behavior cannot help but cross any finite
threshold given enough steps. This would silently undo the exact
0-false-alarm guarantee `MIN_GROUND`'s own multi-pass calibration history
(CLAUDE.md, same file, above this section) was built to hold. Any design
under this brief MUST be checked at more than one read length (900 and
3000 was the start; go further — 10,000+ — before trusting a leak rate),
specifically looking for whether the false-alarm rate creeps up with
length. A design whose false-alarm rate is flat with length is safe by
construction; one that only "looks safe" at the lengths you happened to
test is not.

## What "done" looks like

Pick ONE of these two honest outcomes — do not stop short of either:

**(A) A real, null-calibrated design exists.** Build the leak (or whatever
the accumulator turns out to need) from an actual background-rate null —
the natural model is `slackRunNull`'s own device: generate many iid trials
at the real `ATMOSPHERE_REGIME` parameters, at more than one read length,
run the candidate trigger over each, and report the false-alarm rate
directly (not a percentile borrowed from a different question). Only once
that rate is measured and held at a declared, stated bound (the file's
existing `slackRunNull` calibration test uses ≤0.15 as its bar — reuse
that bar or justify a different one, don't invent a third convention) does
the design get checked against real material for whether it now catches
more genuine drift than plain `tolerance` does, *without* chattering
(design a cooldown or a proper reset-to-floor behavior, not just a
threshold crossing).

**(B) No such design exists within this statistic.** If the calibration
work shows that any leak safe enough to hold the false-alarm rate flat as
read length grows is ALSO too slow to ever bridge Heart-of-Darkness-sparse
signal — say so, with the swept numbers, exactly the way this repo's own
CLAUDE.md already does for every other "tried and refused" result (see
`stationarityGap`'s "FOUR ALTERNATIVES WERE TESTED AND REFUSED" block in
the same file for the house style). That is not a failure to report — a
correctly-refusing calibration is exactly what this module is *for*. In
that case the honest next move is either accepting cause 2 as the real
lever, or naming that a magnitude-weighted trigger over `burstiness`
specifically cannot resolve this without changing the statistic itself
(a materially bigger, separate proposal — don't attempt it under this
brief without re-scoping and saying so).

Either outcome gets written up as a dated CLAUDE.md section (or amendment
to the existing 2026-08-21 sections), in this file's own house style —
evidence-first, numbers cited, alternatives named and why they were
refused — not just a code diff.

## Rebuilding the harness (two real bugs already found, don't reintroduce them)

The scratch exploration harness that produced the numbers above was NOT
committed (per this repo's convention that exploratory calibration scripts
are re-runnable but disposable — `scripts/causal-surprisal-gamma-
calibration.mjs` is the pattern to follow for whatever you build). It
needs rebuilding, and it had two real, silently-wrong bugs before it could
be trusted — both caught only by cross-checking its own "baseline"
candidate's re-zero count against the REAL `readAtmosphere`'s
`rezeroCount` on the same material, which is why that cross-check is not
optional:

1. **Stale ground.** The first draft built the ground once when a region
   opened and never rebuilt it on tending steps. `readAtmosphere`'s own
   tending branch rebuilds `g` via `groundFrom(regionStart, i)` on EVERY
   tending step (not just at open) — omitting this made every candidate
   compare against an increasingly stale ground and produced completely
   wrong re-zero counts (a real "0 vs 1" mismatch against Heart of
   Darkness's actual `readAtmosphere` output was the tell).

2. **Stale array-tail comparison for "did baseline just fire this step."**
   The second draft checked `rezeros[rezeros.length-1] === i - regionStart`
   to decide whether to reset the shared region — but `i - regionStart`
   is NOT unique across regions (a later region's own span can numerically
   pass through an earlier region's fire span as it grows), so this
   spuriously re-triggered a reset using stale data. Use an explicit
   per-step boolean flag set only inside the `if (fire)` branch on the
   SAME iteration, never a comparison against accumulated history.

**Build the harness so it reuses `ground`/`difference`/`isGap`/`gap` from
`nul/index.js` directly** (the same posture `causal-surprisal-gamma-
calibration.mjs`'s own header takes: "the real exported push() semantics
via a real tracker... is not available either; instead this reimplements
ONLY the ground-admission gate... around the REAL ... primitives") —
duplicating the loop shape for exploration is sanctioned by precedent in
this repo; duplicating and silently drifting from the actual gate logic is
the bug class above.

**Always verify against the real function before trusting a single
candidate number.** Run `readAtmosphere` on the same material with the
same seed and assert your harness's own "baseline" (i.e., plain
`tolerance`-based) candidate reproduces its exact `rezeroCount`, on every
corpus you test, before reading anything else off the harness.

## Files you'll touch

- `packages/engine/loops/atmosphere.js` — where any accepted design lands,
  as an ADDITIVE opt-in (mirroring the file's own `findOn` ablation-handle
  pattern), never a silent change to the default `tolerance`-counter
  behavior for existing callers, unless you have separately decided (and
  stated, with evidence) that the new design should become the new
  default — that is a bigger decision than this brief authorizes on its
  own.
- `conformance/atmosphere.test.js` — new cases: the calibration's own
  false-alarm-rate check (mirroring the existing `slackRunNull` calibration
  test's shape exactly), plus arithmetic/consistency cases for whatever
  new fields the design needs. Do NOT pin the substantive real-material
  finding (a specific re-zero count on a specific book) as a hard
  assertion — that's the golden-blind-parameter mistake again, aimed at a
  test instead of a threshold.
- `CLAUDE.md` — the write-up, either outcome (A) or (B) above.
- Real fixtures already available and already used by this investigation:
  `scripts/adversarial/fixtures/pg84-frankenstein.txt`,
  `scripts/adversarial/fixtures/heart-of-darkness.txt`,
  `scripts/adversarial/fixtures/pride-prejudice-raw.txt`. Use more than
  one; a design tuned to fix Heart of Darkness alone and never re-checked
  against the other two is not calibrated, it's curve-fit.

## What not to do

- Don't lower `tolerance` or shrink `MIN_GROUND` directly — both already
  cost multiple dated calibration passes to reach their current values
  (see this file's own header comments in `atmosphere.js`), and moving
  either without the same rigor silently reopens problems this repo
  already closed once (real false positives on real single-topic material
  — see the `stationarityGap`/`MIN_GROUND` history in CLAUDE.md).
- Don't wire an uncalibrated design into `packages/host/terrains.js`'s
  `ATMOSPHERE_REGIME` (the real, shipped configuration `source.js` in
  the-fold consumes). That changes what real users of the-fold's Explore
  surface actually see. Only do this once outcome (A) above is real and
  measured, and say so explicitly when you do.
- Don't touch `the-fold` at all for this. Everything here is engine work;
  the standing rule in both repos' CLAUDE.md is to leave everything
  possible in eoreader6.1. If the-fold's UI ever wants to surface a new
  field this work adds, that's a separate, explicitly-scoped pass.

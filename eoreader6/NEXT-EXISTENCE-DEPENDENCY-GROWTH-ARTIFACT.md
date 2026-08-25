# Next: existenceDependencyTest's length-sensitivity — real, but not (yet) a diagnosed bug

Status note for whoever picks this up next, on the same terms
`NEXT-LEVEL1-PROMOTION.md` and `KERNEL_REBUILD_CHECKPOINT.md` already serve.

**Revised after the first version of this file.** The first pass (single
book, single regime, one length pair) concluded this was `pattern()`'s
already-known growth artifact recurring in a second organ, and sketched a
fix composing `existenceDependencyTest` with `pattern()`'s growth-corrected
null. A wider check — the "confirm it generalizes" step this file's own
first version already called for, done before writing any code — falsified
the clean version of that story. **Do not implement the fix sketched below
as originally written.** The finding is real (verdicts do move with
document length) but the mechanism is not yet understood, and implementing
a fix for the wrong mechanism is worse than leaving this open.

## What was found, and how

Investigating why `loops/read-level1.js`'s seeded density tier (see that
file's own header) never gets fed on real books — level-0 settles almost
nothing on full-length prose — traced the actual bottleneck to
`holon_level/index.js::existenceDependencyTest`, not to level-1 at all.

Measured directly, same regime (`{start: 51, end: 57}`), same book
(`scripts/adversarial/fixtures/pg84-frankenstein.txt`), two lengths:

```
                    prefix (1159 chunks)   full book (1963 chunks)
actual displacement       39,857                  85,095
null threshold (p95)      31,298                 138,275
exists?                    true                    false
```

The real effect **more than doubled**. The null threshold **grew 4.4x**. The
same regime that clears the bar on a prefix gets buried by its own null once
the book is full-length — a length-dependent bias, not a finding about the
text.

**This is SEED.md #5**, and it already happened once before in a different
organ. `nul/index.js::pattern`'s docstring (line ~875 on) records catching
the identical failure shape in `atmosphere` clearing: wired into boundary
detection, it fired on homogeneous noise at almost exactly even spacing —
"a clock, not a perception" — and recovered 21–23 of Frankenstein's 24
chapter boundaries from the **same series shuffled**, because `burstiness`
is a max-over-windows statistic whose expectation rises with material
extent for no reason but extent. `pattern`'s fix: grow the null to `after`'s
extent by resampling from `before`'s own material (`continueBy`), so any
displacement it shows is what growth alone contributes, and `moved` is what
survives subtracting it out.

`existenceDependencyTest` was itself patched for a *related* growth artifact
once already (commit `9564615`, "SEED.md #5's growth artefact, smuggled
back in") — but that fix made the null's internal comparison **extent-matched
within one call** (statistic and null both do a same-size removal). It never
adopted `pattern`'s extent-**growth-corrected** null, because the bug it was
fixing then was a different one. The bug measured here is one layer under
that fix: `gFull` (extent = whole series) and `gDegraded`/`gCut` (extent =
series minus a same-size window) are still compared by raw
`Math.abs(volume(a) - volume(b))`, with no correction for the fact that
`gFull`'s own extent — and therefore its burstiness distribution's width —
grows across different documents (or the same document at different
lengths), while `window`, `draws`, and the regime size stay fixed. Two
grounds built at different total extents were never comparable (the same
sentence `pattern`'s `sameSpec` check exists to enforce) and this function
compares them anyway, never routing through `pattern` or anything like it.

`possibilityConstraintTest` was checked at the same two lengths and did
**not** show the same flip (`constrains: true` at both lengths) — it
compares means, not a max-over-windows extreme statistic, so it likely does
not carry this specific defect. Worth confirming on more documents before
assuming it is clean, but it is not the immediate suspect.

## The check that falsified the clean version of this story

Before writing a fix, the same short-vs-full comparison was run over several
`readLevel0`-discovered regimes on three more books — not just Frankenstein,
and not just one regime:

```
Moby Dick (short=1155, full=3963 chunks):            0/6 regimes flip
Pride and Prejudice (short=1107, full=3217 chunks):  5/6 flip TRUE -> FALSE  (same direction as Frankenstein)
Dracula (short=1208, full=4146 chunks):              5/6 flip FALSE -> TRUE (OPPOSITE direction)
```

If `pattern`'s documented artifact were the whole explanation, every flip
should run the same direction — the null inflates with more windows to max
over, so existence should get uniformly *harder* to clear as extent grows,
never easier. Dracula flips the other way on 5 of 6 regimes, and Moby Dick
does not flip at all. **This is not a one-directional bias.** Something
about document length is moving the verdict, genuinely and reproducibly,
but it is not simply "the null outgrows the real effect," and composing
`existenceDependencyTest` with `pattern`'s growth-corrected null — built to
fix exactly a one-directional bias — is very likely not the right fix for
whatever this actually is. It might not even be the same mechanism.

**What this does and doesn't settle.** It doesn't mean the original
Frankenstein measurement was wrong, or that nothing is amiss — a regime's
`exists` verdict swinging on total document length, in either direction, is
still worth understanding, and still probably relevant to why level-0
settles so little on full-length books. It does mean the mechanism proposed
above (raw volume diff vs `pattern`'s growth-corrected displacement) is not
established as the cause, and implementing it now would be patching a
diagnosis that a five-minute wider check already put in doubt.

## Why this wasn't caught

`conformance/calibration.test.js` holds the false-positive rate on iid
noise, always at a **fixed series length (300)**. It is the right test for
"does the null clear noise at its nominal rate" and the wrong shape to catch
"does the same regime's verdict move as the document around it grows" —
that axis was never varied. Whatever this is, it is invisible to a
fixed-length calibration and only shows up across documents, or across a
reading in progress.

## The job — now a diagnosis, not an implementation

The composed-`pattern()` fix sketched in an earlier version of this file is
**not validated and should not be implemented as written** — see "The check
that falsified the clean version of this story" above. What's actually
needed first:

1. **Characterize the direction, not just its existence.** Across
   Frankenstein, Pride and Prejudice, Moby Dick, and Dracula, some regimes
   flip one way, some the other, some not at all. Is the direction
   predictable from something measurable about the regime or the document —
   position within the document (early vs late), local density of other
   settled claims nearby, the specific values in the regime vs the
   document's evolving mean/variance? Or is it closer to noise — the same
   regime's verdict essentially unstable under a change of context, with no
   predictable sign? Those are different findings needing different
   responses, and right now it isn't known which this is.

2. **Isolate which of the two comparisons is moving.** `existenceDependencyTest`
   computes `actualDisp = |volume(gFull) - volume(gDegraded)|` against a
   null built from `reseeds` other same-size removals. A flip could come
   from `actualDisp` itself changing (the regime's own displacement effect
   genuinely differs against a bigger book), from the null's distribution
   shifting (the `reseeds` elsewhere-placements sample a different,
   larger population as the book grows), or both moving but at different
   rates. Log `actualDisp` and the full null sample set (not just the p95)
   at both lengths, for every flipped regime in the four-book sweep already
   run, and read which side actually moved.

3. **Only once 1-2 point at a specific mechanism, propose a fix**, and
   validate it the way every amendment in `SEED.md` was validated: recheck
   `conformance/calibration.test.js`'s false-positive bound before and
   after, recheck the four-book sweep, run the full conformance suite
   before and after with numbers recorded (baseline as of this writing:
   `node --test "conformance/*.test.js"` → **1039 pass, 1 fail**, the one
   failure being `conformance/reproducibility.test.js`'s absolute-path guard
   tripping on the level-1 promotion's own leftover probe scripts —
   pre-existing, unrelated, not this job's to fix), and re-run
   `scripts/probe-read-level1.mjs` to see whether level-0 settlement on
   full-length real books actually changes. Don't assume a fix here closes
   the level-1 gap just because it's upstream of it — report whichever it
   turns out to be.

## What NOT to do

- Don't implement the `pattern()`-composition sketch from the first version
  of this file without first doing step 1-2 above. It was a reasonable
  hypothesis from one book and one regime; the four-book check already shows
  it doesn't fit the data as a single-mechanism, single-direction story.
- Don't touch `possibilityConstraintTest` speculatively. It did not show a
  flip in the one measurement taken (Frankenstein, both lengths). If the
  wider diagnosis above finds it carries a version of this too, that is its
  own finding, made the same way, not folded silently into this one.
- Don't widen the reseed-elsewhere null's own width (`reseeds`, `draws`) as
  a workaround before the mechanism is understood. That treats a possibly
  systematic effect as if it were only insufficient resolution — the same
  mistake `pattern`'s own docstring warns against for its own `nullMax`.
- Don't invent a fourth declared number when a fix is eventually built.
  `pattern`'s own fix (for its own, different, confirmed-one-directional
  defect) needed none — whatever's built here should be able to say the
  same, the way every "What did not move" entry in `SEED.md` already does.
- Don't skip the four-book check that's already been run when picking this
  back up — it's recorded above precisely so it doesn't need re-doing, only
  reading closely.

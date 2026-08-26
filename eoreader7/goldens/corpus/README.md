# Cross-corpus reading

Answers a question this engine had never asked before: is one book's shape
typical of a pool of others, or does it stand apart? Uses
`packages/engine/loops/corpus.js`, built on `nul::level()` and
`nul::received()` — no new statistical machinery, just pointed at two
independent documents for the first time.

## The primitive that was already there

`loops/family.js::crossFamilyLevel` already builds two INDEPENDENT grounds
and asks `level()` whether an above/below/peer relationship survives a
different perturbation family. Nothing about it assumed the two materials
came from one document — it had just never been run that way. It still
hadn't, until this: run directly on two real books (Buddenbrooks, Seitsemän
veljestä), **every cross-book call gapped** (`unstable` / `exceeds_witness`).

## Not a bug — the first real methodological finding

Debugged rather than patched around: German's forward-surprisal ground sits
at ~10.7–11.2M microbits, Finnish's at ~11.8–12.0M — **non-overlapping
support**, despite the two medians differing by less than 10%. `burstiness`
(max-over-windows) has a *tight* null by construction — good for detecting a
boundary within one document, where a tight null means real power — but it
means any ordinary between-book difference in absolute vocabulary scale
exceeds it. **Raw-magnitude cross-book comparison is a structural
non-starter, independent of language.** `level()`'s `unstable` gap is the
engine correctly refusing to compare incommensurate numbers, not a failure.
Locked as a permanent regression in `read-corpus.test.mjs` — if it ever
stops gapping, something about the statistic changed and needs investigating,
not celebrating.

## The fix: a dimensionless statistic

`shapeStatistic = volume(ground) / median(ground.samples)` — the ground's
own spread as a *fraction* of its own center. A ratio cancels the absolute
scale a per-book frequency table imposes, the same way B3's Benford
chi-square-distance cancelled ledger size in `goldens/surprise`. Verified
real and non-degenerate across 5 books before trusting it further: `0.0083,
0.0051, 0.0051, 0.0140, 0.0057` — genuine spread, not five copies of the
same number.

## The pool is a received ground, named

`corpusLevel` builds each book's shape statistic at one shared spec (draws,
window — SEED.md #5's comparable-only-if-same-spec discipline, enforced by
construction), then for each book pools every OTHER book's ratio into
`nul::received()` with explicit provenance (which books, leave-one-out).
SEED.md #1 applies to a corpus exactly as it applies to a single prior — a
pool is a gift too, and must name which books gave it.

## Three real bugs, caught running it against all 10 cast-golden books

1. **The raw-magnitude trap above** — the reason the shape statistic exists
   at all.
2. **`tokenize()`'s script-blindness, discovered here, not by inspection.**
   `perceiver/text/material.js::tokenize` uses `/[\p{L}\p{N}']+/gu` with no
   whitespace check. On Han script that swallows a whole clause as one
   "token" — verified directly: 紅樓夢's first 2000 characters tokenize to
   entries like `賈雨村風塵怀閨秀` (8 characters, a clause fragment),
   averaging 5.5 characters — indistinguishable in *shape* from German's
   genuine 5.9-character WORDS. A clause-length pseudo-token almost never
   recurs verbatim, so every Chinese "token" reads as near-maximally
   surprising, purely as a tokenizer artifact. This is the exact "withheld
   word division" issue found earlier for referent discovery
   (`discover-cast.mjs`'s `segmentsOnWhitespace`), silently ALSO present in
   the tokenizer **RESULTS.md's entire causal-surprisal pipeline depends
   on** — never caught before because that pipeline had never been run
   against a non-whitespace script until this comparison forced it to be.
   **Fixed locally** in `read-corpus.mjs` (script-aware reduction, falling
   back to character bigrams below the same whitespace-density floor used
   elsewhere this session) rather than editing the shared `tokenize()`,
   which conformance-tested code throughout the engine depends on and which
   this pass has no way to fully re-verify for every caller.
   **`perceiver/text/material.js:16-19` needs the same script check** before
   any pipeline that reduces text to word-frequency statistics is trusted
   cross-script — flagged, not silently worked around upstream.
3. **A companion-volume bug of my own**, caught the same way: the reading
   loop originally read only `pg${id}.txt`, ignoring `companionIds`. The
   Odyssey (`el-30613`) is split across three PG ids — volume A alone is
   292KB, all three concatenated are ~889KB, exactly as `discover-cast.mjs`
   and `read.mjs` already assemble it elsewhere. Reading volume A alone gave
   it a third of the material every other book in the pool had, and it
   promptly showed up as a spurious new "outlier" after fixing bug #2 —
   which would have been reported as a literary finding about the Odyssey's
   prose rather than what it actually was, a material-length artifact.
   Fixed; the effect shrank substantially once corrected (still present,
   smaller margin — see below).
4. **An O(n²) performance bug**, also caught by running it, not by review:
   the first fix for bug #2 built character bigrams with
   `.reduce((pairs, ch) => [...pairs, ...])` — spreading the accumulator
   every iteration, copying the whole array so far each time. On a
   2.6MB book that pinned two processes at 100%+ CPU for over ten minutes
   without finishing before being caught and killed. Rewritten as a single
   pre-allocated loop with `push` — O(n), not O(n²). Worth stating plainly:
   an accumulator built by spreading into a fresh array each step is the
   easiest way to turn a linear reduction into a quadratic one, and it stays
   silent until the input is large enough to notice — which real corpus
   material always eventually is.

## The result, after all four fixes

```
zh-24264   0.0111  rank 0.11
zh-23962   0.0054  rank 0.56
el-36248   0.0085  rank 0.22
el-30613   0.0047  CENSORED below
de-34811   0.0083  rank 0.33
fr-6497    0.0051  rank 0.78
fi-11940   0.0051  rank 0.89
hu-69689   0.0057  rank 0.44
hu-76235   0.0053  rank 0.67
nl-11024   0.0140  CENSORED above
```

Two outliers survive every fix. **`nl-11024` (Max Havelaar) is the robust
one** — present before and after every correction, at the same margin. This
is worth noting as a *correlation*, not a causal claim: it is independently
the one book the cast golden's own manifest already flagged as a
"compromise" reference (`Gebruikte pseudoniemen` is a roman-à-clef key, not
a true character list) — two unrelated signals, one about third-party
reference quality and one about this book's own prose surprisal-shape,
landing on the same book. Max Havelaar is also independently famous for an
unusually fragmented narrative structure (multiple narrators, satirical
digressions, footnotes-within-the-novel), which is a plausible independent
literary explanation and should be preferred over any claim that the two
findings caused each other.

`el-30613` (the Odyssey) is a milder, real outlier (censored below) — the
shortest text in the pool even after concatenating its three volumes, and
worth treating as thin-material rather than a confident literary claim.

## Run it

```
node goldens/corpus/read-corpus.mjs        # full leave-one-out reading over the 10 cast-golden books
node --test goldens/corpus/read-corpus.test.mjs
```

Requires `goldens/cast/fetch.mjs` to have been run first (texts are
gitignored, ~12MB, not checked in).

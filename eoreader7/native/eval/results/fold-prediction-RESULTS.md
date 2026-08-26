# Does the fold predict the corpus? — a falsifiable test, and a disciplined negative

`native/eval/fold-prediction.mjs` on the whole Frankenstein. **Zero model
calls.** Raw run: `fold-prediction-frankenstein.json`.

## The question, and why a language model cannot answer it

Standing at sentence *t*, having read only 1..*t*, rank the motifs the
reading currently holds by how likely each is to arrive in sentence *t+1*.
Then look. "Which content words occur in sentence 2,431 of Frankenstein" is
not parametric knowledge — it is answered here entirely from state the
reader built causally, and it is checkable against the book.

## The metric has no dials

At each step the **truth supplies k**: the number of live motifs that
actually arrive next. Each predictor ranks the live set and is scored
precision@k. No probability calibration (which needs bins), no threshold
(which needs a number), and k is never chosen — it is read off the answer.
The window is measured by `dmdWindow` against a discrete conclusion, not
typed.

## Result

| predictor | real | sentence-shuffled |
|---|---|---|
| `control:fold-undecayed` | **0.0549** | 0.0550 |
| `baseline:base-rate` | **0.0549** | 0.0550 |
| `candidate:fold` (measured window 4) | 0.0382 | 0.0173 |
| `baseline:recency` | 0.0334 | 0.0155 |
| chance | 0.0112 | 0.0080 |

3,102 steps. Two things are worth reading carefully.

**The undecayed control lands exactly on base-rate.** That is an identity
check, and it passing means the implementation is right: the fold at γ=1
*is* accumulation, so it must score identically to counting. It does, to
four decimals.

**Decay monotonically hurts on this target.** accumulation > fold@4 >
recency, in that order, all far above chance. The more the reader forgets,
the worse it predicts recurrence.

**The null says the mechanism is real, not the benefit.** Under sentence
shuffling, base-rate and the undecayed control are unchanged (they are
order-blind by construction), while the fold and recency collapse. So the
fold genuinely reads order — it simply reads it to its own cost here.

## What this does and does not license

**It does not license "the fold is broken."** It licenses something
narrower and more useful: *whether a motif recurs is governed by its rate,
not its recency*, so a decayed reader must lose this particular contest.
READING-POLICY P1 already says the window is "the reach of the present, not
the size of memory" — this run is that sentence measured. The experiment
asked the fold a question the fold is not for, and the fold answered
honestly by losing.

**Disclosed weakness in this run, not smoothed over.** The window was
measured at 4 from a warmup of only 8 observations — far too short a prefix
to measure a book's reach, and `contextual-dmd`'s own O(n³) cost is why the
warmup is that short. A window measured over a real stretch could sit
anywhere on the accumulation↔recency continuum this table maps, and the
table is the honest object here: it reports *where on that continuum this
corpus's answer sits*, rather than one tuned point on it.

**Open, and the sharper form of the question.** precision@k over all live
motifs is dominated by frequent words, so frequency wins somewhat by
construction. The discriminating test is whether the fold adds anything *on
top of* rate — frequency-matched strata, or the residual after base-rate.
That is the next assembly, and this run is its baseline.

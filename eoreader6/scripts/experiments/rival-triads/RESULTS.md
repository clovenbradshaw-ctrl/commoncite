# Rival triads — results

Run 2026-08-16, exactly as pre-registered (`PREREGISTRATION.md`, written
before judging — see its own note on what that ordering is and isn't
provable by). 360 sentences, 12 sources, 7 registers; four blind
judges (two per question-set); `Xenova/all-MiniLM-L6-v2`; 500-draw
label-permutation nulls. Raw labels in `labels/`, machine-readable output
in `results.json`.

## The headline table

Mean per-axis permutation z / full-address z (and full-address effect
size d = mean same-cell minus different-cell cosine similarity):

| specification | S1 (EO: mode/domain/grain) | S2 (rival: process/time/participants) |
|---|---|---|
| all 360, judge A | 14.8 / **19.5** (d .0516) | **16.7** / 18.9 (d .0491) |
| all 360, judge B | 15.7 / **21.5** (d .0529) | 15.5 / 19.3 (d .0498) |
| consensus subset | **14.4** / **17.3** (d .0609, n=242) | 12.8 / 15.9 (d .0524, n=289) |

Surface control (S3): length tercile d=.0026 z=2.60; comma band z=0.47;
alphabetical tercile z=−1.12; full address z=−0.42. Distance-by-axes
curve flat (0.9291 → 0.9294).

Calibration: a pure register/source partition scores d=.1257, z=93.5 on
the same instrument — an order of magnitude more geometric structure
than either triad.

## Predictions, scored

- **P1 — held.** Every EO axis shows real coherence on the consensus
  subset (mode z=5.1, domain z=22.7, grain z=15.5). The original study's
  direction replicates on a new sample, new judges, new encoder run.
- **P2 — held.** The rival's process axis: z=16.4 on consensus. Coherence
  against chance is not unique to EO's axes.
- **P3 — the falsification-relevant one, held in the predicted
  direction.** The EO triad does NOT clearly beat the rival on both
  headline measures across specifications. On the consensus subset (the
  primary specification, the original study's own rule) EO is ahead on
  both — 14.4 vs 12.8 mean per-axis z, 17.3 vs 15.9 address z — but the
  margin is roughly 10–15%, and it does not survive the specification
  change: on all-360 judge-A labels the rival's mean per-axis z is
  *higher* than EO's (16.7 vs 14.8). Effect sizes tell the same story at
  smaller spread: EO's full-address d edges the rival's in all three
  specifications (.0516/.0529/.0609 vs .0491/.0498/.0524), never by more
  than ~16%.
- **P4 — held.** The alphabetical noise axis is null (z=−1.12): the
  instrument does not manufacture coherence. The length axis shows the
  predicted small confound (z=2.60, d=.0026 — an order of magnitude
  below either triad's semantic axes), which is why "beats chance" alone
  was never going to be the test.
- **P5 — held.** Monotonicity — more axes differing, more embedding
  distance — holds for BOTH triads (EO consensus: .873 → .906 → .937 →
  .963; rival: .879 → .913 → .933 → .951) and for NEITHER does it hold
  on the surface control. The original study reported monotonicity as a
  confirmation of the EO axes; this shows it is a property of any
  semantically real three-way partition, not a signature of these ones.
- **P6 — held, with a genuine surprise in EO's favor.** EO's axes
  reproduce the original's independence failure in the same direction
  (mode~domain Cramér's V = 0.214, the largest of its three pairs). But
  the rival's axes are *worse*: process~time V = 0.303,
  process~participants V = 0.319. On this sample the EO triad is closer
  to orthogonal than the off-the-shelf linguistic rival — the one
  instrument in this experiment where it clearly outperformed, and not
  one we predicted it would.

Judge agreement, reported symmetrically: the rival's questions were
easier to answer consistently (kappa .92/.95/.76; consensus 289/360)
than EO's (kappa .78/.75/.86; consensus 242/360). An axis system whose
questions produce 80% full-triple agreement between independent judges
is operationally cheaper than one producing 67% — a real cost, even if
it is not a geometric one.

## Verdict, in the pre-registration's own terms

Neither pre-registered terminal state obtained cleanly. The rival did
not match-or-beat EO on both headline measures (so the axes are not
**falsified**), and EO did not clearly beat the rival on both across
specifications (so the superiority claim did not **survive** either —
its consensus-subset edge is ~10–15% and flips sign under one
specification change). The honest summary:

1. **What the original study actually established survives and
   replicates**: the three questions track something real in language,
   cross-judge, in blind embeddings.
2. **The stronger claim — that THESE three dimensions carve language
   better than some other three would — is unsupported.** A rival triad
   assembled in an afternoon from textbook distinctions (Halliday-style
   process type, time reference, participant count) reproduces the
   entire qualitative signature: real per-axis coherence, real
   full-address coherence, monotonic distance in axes-differing. Every
   one of those properties, previously reported as evidence for the EO
   axes, is hereby demonstrated to be evidence only of *semantic
   realness*, not of *these axes in particular*.
3. **The one measured, unpredicted distinction in EO's favor is axis
   independence** (max pairwise V 0.214 vs 0.319). If the triad has a
   defensible superiority claim on this instrument, it is "closer to
   orthogonal than an obvious rival," not "more geometrically coherent."
4. **Both triads are small structure on top of a much larger signal**:
   register/topic alone carries ~10× their geometric coherence. Any
   future claim about the axes should be stated inside that
   proportion.

## Limits (declared in advance, still true)

One rival system, one language, one encoder, n=360, judges from one
model family sharing training biases across both systems (symmetric, but
shared). The participant-count axis is specifically disadvantaged by
this encoder (`EMBEDDING-FINDINGS.md`: mean-pooled MiniLM barely encodes
who-did-what-to-whom) — noted before results were seen. Consensus
subsets differ in size (242 vs 289), which affects z comparability;
effect sizes d are the safer cross-system comparison and tell the same
story. Register confound is shared by both systems and not removed;
within-register analysis is the obvious next instrument.

# Rival triads — pre-registration

**Written, in full, before any sentence was judged, embedded, or scored.**
(Stated precisely, because the distinction matters here: the file was
*written* before the judges ran — its predictions were not edited after —
but the whole experiment lands in git as one batch, so the commit
timestamp cannot prove the ordering. The session transcript can; a
skeptic without access to it should treat the lock as attested, not
proven.) Same discipline as `goldens/surprise` and the lexical study this
replies to: predictions locked first, failures reported at the same
length as successes.

## The claim under test

The lineage's three axes — **mode** (Differentiate / Relate / Generate),
**domain** (Existence / Structure / Interpretation), **grain** (Ground /
Figure / Pattern), as frozen in `CUBE.md` — were tested once against real
language (`eo-lexical-analysis-2.0`, reported in `eoreader4.2/docs/eo-wiki.md`
and summarized in the handbook's Chapter 2.6): three plain-language
questions, blind judges, blind embeddings, and sentences that answered the
same way sat measurably closer together than chance.

That study established the axes beat **randomness**. It never tested
whether they beat **rivals**. "The three questions track something real" and
"the three questions carve language better than some other three questions
would" are different claims, and only the first has ever been measured.
This experiment tests the second, adversarially: if an off-the-shelf rival
triad from ordinary linguistics matches or beats the EO triad on the same
instrument, the superiority claim is falsified — coherence-against-chance
would then be a cheap property many partitions share, not evidence for
these particular axes.

## Design (mirrors the original where possible)

- **Corpus:** 360 real English sentences, 30 from each of 12 sources across
  7 registers (fiction, translated fiction, philosophy, encyclopedic,
  technical, news, reference), sampled by fixed seed
  (`sample-sentences.mjs`, seed 20260816). English-only — a narrowing
  relative to the original's 41 languages, declared here rather than hidden.
- **Judges:** two independent AI judges per question-set, given ONLY the
  numbered sentences and the plain-language questions — no EO vocabulary,
  no rival vocabulary, no statement of purpose, sentence order shuffled
  differently per judge. Same consensus rule as the original: the
  consensus subset is sentences where both judges agree on all three axes.
- **Embeddings:** `Xenova/all-MiniLM-L6-v2`, mean pooling, normalized —
  the same encoder family `scripts/EMBEDDING-FINDINGS.md` already
  characterized on this lineage's own material. The encoder never sees any
  label.
- **Statistics:** for each axis, mean same-label minus different-label
  cosine similarity, z-scored against a 500-draw label-permutation null;
  monotonicity of pairwise distance in number-of-axes-differing (0/1/2/3);
  full 27-cell address coherence z; inter-judge Cohen's kappa per axis;
  between-axis Cramér's V (the independence check the original failed).

## The three systems

**S1 — EO triad** (questions verbatim from the original study as carried in
handbook Chapter 2.6):
1. Is this transformation separating, connecting, or producing?
2. Is it operating on existence, organization, or meaning?
3. Is the target a background condition, a specific thing, or a recurring
   pattern?

**S2 — Rival triad**, assembled from three off-the-shelf linguistic
distinctions old enough and plain enough that no one owns them (process
type after Halliday's transitivity; time reference; participant count):
1. Does the sentence mainly describe an action or happening, an experience
   of sensing / feeling / saying, or a state of being / having?
2. Is it mainly about the past, about the present or an ongoing situation,
   or about the future or a timeless generality?
3. Does the main event or state involve one participant, two participants,
   or none / more than two?

S2 was chosen once, before any data was seen, for being (a) genuinely
three-axis, (b) answerable by the same kind of judge, (c) NOT derived from
EO's axes. No other rival was tried — trying several and reporting the
best would be the calibration sin `CLAUDE.md` names.

**S3 — Surface control**, computed mechanically, no judges: sentence-length
tercile × comma-count band (0 / 1 / 2+) × alphabetical tercile of the
second word. The third axis is designed to be pure noise.

## Predictions, locked

- **P1.** S1 (EO) axes each show real coherence (z > 2) on the consensus
  subset — replicating the original's direction on a new, smaller sample.
- **P2.** S2 (rival) axis 1 (process type) also shows z > 2. Semantic
  coherence against chance is NOT expected to be unique to EO's axes.
- **P3 — the falsification-relevant one.** The strong superiority claim
  predicts S1 should beat S2 on (a) mean per-axis z and (b) full-address
  z. We predict this will NOT clearly happen — i.e. we expect the rival
  to be within noise of, or above, the EO triad on at least one of (a) or
  (b). If S1 clearly beats S2 on both, the superiority claim survives
  this attempt and that gets reported with the same prominence.
- **P4.** S3's alphabetical axis shows |z| < 2 (harness sanity); S3's
  length axis may show z > 2 (embedding-norm confound), which is why
  beating chance alone proves little.
- **P5.** Monotonicity (more axes differing → more distance) holds for
  BOTH S1 and S2 — it is a property of any correlated-with-meaning
  partition, not a signature of EO's axes.
- **P6.** Axis independence: S1 reproduces the original's failure
  (mode–domain Cramér's V noticeably above 0); S2's axes are not promised
  to be independent either — reported symmetrically.

## What would count as what

- **Falsified:** S2 ≥ S1 on both headline measures → "these three
  dimensions are better than some other three" is unsupported; the axes'
  standing reverts to what the original actually earned (better than
  chance, structured, cross-linguistic) with superiority claims struck.
- **Survived (this attempt):** S1 > S2 clearly on both measures → the
  superiority claim survives one adversarial rival; it would still not be
  proven — one rival is one rival.
- **Broken instrument:** S3's noise axis shows |z| > 2 → the pipeline is
  confounded and NO conclusion is drawn in either direction.

## Known limits, declared now

- One rival system, one language, one encoder, n=360. This bounds how
  general any conclusion can be.
- The judges are large language models; the original study's were too
  (Claude and GPT-4). Judge–hypothesis contamination is mitigated by
  giving judges no vocabulary from either theory and no purpose statement,
  but the judges' own training biases are shared across S1 and S2, which
  is the comparison that matters here.
- Mean-pooled sentence embeddings barely encode who-did-what-to-whom
  (`EMBEDDING-FINDINGS.md`: cos("the dog bit the man", "the man bit the
  dog") = 0.9782). Both systems are scored on the same instrument, so
  this limits sensitivity symmetrically — but it may specifically
  understate S2's participant-count axis, and that asymmetry is noted
  here BEFORE results rather than discovered after.

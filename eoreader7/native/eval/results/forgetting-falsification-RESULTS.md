# Falsifying P41/S15 on real tasks — a book at entity level, and audio

The claim under pressure: power-law (odds-matched) forgetting improves
recall. Its evidence so far is ONE proxy task (next-sentence motif
recurrence) on ONE book. This driver puts it where it can lose, twice:

**Arm BOOK — does it improve reading a book?** Entity-level return
prediction: at sentence t, rank the CAST (constitutional referents,
coref-primed) by how likely each returns at t+1. Anticipating who returns
is what reading a novel actually requires of memory. The honest risk,
stated up front: entity returns are plot-driven and long-range, so the
power-law's recency weighting may genuinely hurt where motif recurrence
rewarded it.

**Arm AUDIO — does it hold for listening?** The engine's own audio
perceiver (wav.js → extractFrameFields → 12-dim chroma per ~46ms hop),
identities = top-3 pitch-class signatures (a chord-shaped state, ~220
possible, discovered not listed), same prequential harness verbatim.
Material: "Nancy's Waltz" (archive.org/details/NancysWaltz, CC BY-NC-ND
3.0 — analyzed, never committed; the cast golden's own gitignored-texts
posture), 143.8s ≈ 3,090 frames, comparable to the book's 3,102 steps.
The honest risk: at 46ms frames audio is dominated by PERSISTENCE (a
chord outlasts many frames), so recency may crush everything — which
would be a real timescale clause on the omnimodal claim, not a footnote.

## Frozen predictions (written before either run)

1. BOOK: actr-prior ≥ base-rate (P41 predicts the same ordering as motifs).
   FALSIFIED if base-rate beats actr at paired z ≤ −2, or if actr's edge
   survives sentence shuffling (which would mean it was never reading
   order).
2. AUDIO: the same ordering (actr ≥ base-rate > exponential > recency),
   with LOW confidence on the recency term — persistence at this frame
   rate may invert recency's rank entirely. If actr < base-rate here, the
   omnimodal claim gains a measured medium/timescale boundary.
3. Both arms: every candidate's edge over base-rate must vanish under
   shuffling or it is an artifact.

## Results

### BOOK arm — not falsified; strengthened

Frankenstein, 99 cast referents, 576 prequential steps (sentences where ≥2
referents were live and one returned next):

| predictor | real | shuffled |
|---|---|---|
| candidate:need-odds-measured | **0.2257** | 0.0914 |
| candidate:actr-prior | **0.2244** | 0.1319 |
| baseline:recency | 0.2115 | 0.0651 |
| baseline:base-rate | 0.1426 | 0.1351 |

actr-prior beats base-rate by **+0.082, z = 5.32 — a 57% relative
improvement in anticipating who returns**, far larger than the motif
task's +6%, and the edge vanishes under shuffling (z = −0.42):
order-borne. The empirical need-odds estimator is now ALSO significant
(z = 4.68) — entity returns carry enough per-step signal for the measured
cells to work, where motifs did not — and under shuffling it goes
significantly negative (z = −3.37), the signature of a mechanism that
learned real order structure and broke with it. Prediction 1 held in
full. Anticipating who returns is what reading a novel asks of memory,
and power-law forgetting improves it.

### AUDIO arm — the fixed exponent IS falsified, and the deeper law survives it in the strongest form

Nancy's Waltz, 3,092 chroma frames (~46ms), 2,996 steps:

| predictor | real | shuffled |
|---|---|---|
| baseline:recency | **0.8064** | 0.1073 |
| candidate:need-odds-measured | **0.8057** | 0.2423 |
| candidate:actr-prior | 0.2854 | 0.2720 |
| baseline:base-rate | 0.2640 | 0.2740 |

Prediction 2's low-confidence clause fired exactly: at this frame rate
audio is PERSISTENCE-dominated — a chord outlasts many frames, so
recency crushes the received power-law (z = −51.98 against it). The
claim "power-law with received d = 0.5" is **falsified as a
medium-general rule**. Two things survive, and they matter more:

1. actr-prior still beats pure frequency even here (z = 8.09), and
   everything's edge is order-borne (recency collapses to 0.1073 under
   shuffling; need-odds to 0.2423, z = −7.47). Power-law > no-forgetting
   in every medium tested; what the medium moves is recency's rank.
2. **The material-measured need-odds estimator ADAPTED**: 0.8057, within
   noise of the persistence oracle, 2.8× the received prior — with no
   functional form, learned causally from the material's own arrival
   statistics. On text (thin per-step signal) the received prior beat the
   measurement; on audio the measurement beats the prior by 2.8×. That is
   S14's ladder measured in BOTH directions: start from the received
   prior, and the material's own measurement supersedes it exactly where
   the prior's environment (Anderson & Schooler's day-scale text needs)
   is not this environment.

### Verdict

The falsification did its job: "forgetting improves recall" survives
where it was put to real work (entity-level reading, +57%), and its
FIXED-EXPONENT form breaks on audio at 46ms exactly where the honest
risk said it might — leaving the durable law one level up, where S15
already placed it: **forgetting improves recall when its shape matches
the environment's need-odds, and the need-odds are the material's to
state.** The received d = 0.5 is a text-scale prior, not a constant of
the mechanism.


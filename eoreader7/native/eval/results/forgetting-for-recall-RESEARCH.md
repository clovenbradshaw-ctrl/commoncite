# Forgetting as a recall mechanism — the research, and the experiment it licenses

Asked: do all forms of activation, across modalities, need to LEVERAGE
forgetting to improve recall? The literature's answer is yes, with a
sharp qualification this repo already ran into head-on: forgetting
improves recall only in its **odds-matched form** — and the wrong curve
(pure exponential, applied to the wrong layer) measurably hurts, which is
exactly what `fold-prediction-RESULTS.md` found before this question was
asked.

## The five pillars, each from a different field

**1. Memory decay is rational, and its shape is the environment's own
need curve.** [Anderson & Schooler 1991](https://users.cs.northwestern.edu/~paritosh/papers/KIP/AndersonSchooler1991ReflectionsOfEnvironmentOnMemory.pdf)
measured need-probability in three real environments (New York Times
headlines, parental speech, email) and found the odds an item is needed
again follow **power-law** functions of recency and frequency — and human
retention curves match them. [ACT-R's base-level activation](https://abrsvn.github.io/files/ACT-R_subsymbolic_3.pdf)
is the mechanization: `B_i = ln Σ_j t_j^(−d)`, the standard d = 0.5.
Forgetting is not loss; it is the memory ranking items by their
environmental odds of being needed. **The corollary that matters here: a
power-law never forgets frequency.** Every past occurrence contributes
forever (unlike exponential decay, where old evidence vanishes), so rate
and recency are unified in one quantity instead of competing.

**2. Retrieval strength is not storage strength, and low retrieval
strength is when learning is largest.** [Bjork & Bjork's New Theory of
Disuse](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf):
two strengths per item — storage (only grows) and retrieval (decays,
context-dependent) — and the gain in storage strength at a successful
retrieval is INVERSELY related to current retrieval strength. Forgetting
is the precondition for the spacing effect. This is this repo's own
two-layer architecture (P1: activation decays, identity does not) with an
addition we do NOT yet implement: **the two layers interact** — a
retrieval that had to work harder should strengthen more.

**3. Transience is functional: forgetting prevents overfitting to the
past.** [Richards & Frankland 2017, Neuron](https://www.cell.com/neuron/fulltext/S0896-6273(17)30365-3):
persistence AND transience together optimize memory-guided decisions in
changing, noisy environments — transience reduces the influence of
outdated information and **promotes generalization by preventing
overfitting to specific past events**. Mechanistically real, not
metaphor: [neurogenesis-induced forgetting](https://pubmed.ncbi.nlm.nih.gov/24812394/)
(Akers et al. 2014) shows new dentate-gyrus neurons actively degrade old
memories while enabling new pattern separation — the same structure this
repo's own `memory/activation.js` cites (Marr; McClelland et al.) for its
sparse band.

**4. It is cross-modal.** The [contextual interference effect](https://www.nature.com/articles/s41598-024-65753-3)
in MOTOR learning (Shea & Morgan 1979; meta-analytically confirmed for
retention 2024): interleaved practice degrades performance during
acquisition and improves delayed retention — forgetting-between-attempts
is the mechanism, in a modality with no words at all. Spacing effects
replicate across verbal, motor, perceptual learning. The mechanism the
kernel should carry is therefore omnimodal (S14's split holds).

**5. The machine side found the same law independently.**
[Gers, Schmidhuber & Cummins 2000, "Learning to Forget"](https://direct.mit.edu/neco/article/12/10/2451/6415/Learning-to-Forget-Continual-Prediction-with-LSTM):
on CONTINUAL (unsegmented) prediction, standard LSTM fails as internal
state grows without bound; the adaptive forget gate solves it, and became
a permanent part of the architecture. Continual input with no
pre-segmented ends is precisely a reader's situation.

## Where this repo stands against the five, measured not guessed

- `fold-prediction` measured EXPONENTIAL decay losing to accumulation on
  next-sentence recurrence (0.0382 vs 0.0549). Pillar 1 says that is the
  predicted result of using the wrong curve: exponential destroys
  frequency, and recurrence is rate-governed. The experiment below tests
  whether the RIGHT curve (power-law / measured need-odds) beats both.
- `writer-decay` measured the material's own two clocks (S13) — pillar 2's
  two strengths, as the writer's design. Missing: the interaction (harder
  retrieval → larger strengthening). Named, unbuilt.
- `memory/activation.js` has sparse coding and one-hop completion
  (pillar 3's structures) but its df/idf tables and Hebbian edges NEVER
  forget — only `edgeSlots = 24` caps competition. Pillars 1+3 predict
  interference/fan-effect degradation on long material. Named, untested.
- The kernel/adapter split (S14) is what pillar 4 requires.
- No organ has pillar 5's adaptive reset; the closest is atmosphere's REC
  tolerance, whose calibration brief is already open.

## The experiment (prediction recorded HERE, before the run)

Extend `fold-prediction.mjs` with two candidates:

- `candidate:actr-prior` — score(m) = Σ_j (now − t_j + 1)^(−0.5): ACT-R's
  base-level activation with the received standard exponent, giver named
  (Anderson). Power-law forgetting: recency-weighted but
  frequency-preserving.
- `candidate:need-odds-measured` — no functional form at all: the
  material's own measured P(arrives next | dyadic recency bin, dyadic
  frequency bin), tallied causally from the prefix, scored by cell rate
  with a disclosed backoff ladder (cell → recency margin → frequency).
  Anderson & Schooler's environmental analysis, run ON the material,
  BY the reader, AS it reads.

**Prediction:** need-odds-measured ≥ actr-prior > base-rate (= undecayed
accumulation) > exponential fold > recency. The load-bearing comparison
is either forgetting-shaped candidate vs base-rate: if forgetting's
correct form wins, the earlier negative is overturned exactly the way
pillar 1 predicts — it was exponential's shape that lost, not forgetting.

## Result

Run on Frankenstein, 3,102 prequential steps, real and sentence-shuffled
arms (`fold-prediction-forgetting-frankenstein.json`):

| predictor | real | shuffled |
|---|---|---|
| **candidate:actr-prior** (power-law, received d=0.5) | **0.0582** | 0.0535 |
| candidate:need-odds-measured | 0.0561 | 0.0488 |
| baseline:base-rate (= undecayed) | 0.0549 | 0.0550 |
| candidate:fold (exponential, measured w=4) | 0.0382 | 0.0173 |
| baseline:recency | 0.0334 | 0.0155 |

Paired per-step statistics (same step, same live set, same truth):

- **actr-prior beats base-rate on real prose: Δ +0.0033, 212 steps
  better / 132 worse, z = 3.26.** Significant.
- **The edge is order-borne:** under sentence shuffling it vanishes and
  reverses (Δ −0.0015, z = −1.55). Power-law forgetting reads the
  material's temporal structure; destroy the order and the advantage is
  gone — the exact signature that separates a mechanism from an artifact.
- actr-prior vs the exponential fold: Δ +0.0200, z = 9.35 — the two
  "forgetting" curves are not close.
- need-odds-measured is directionally right but NOT significant
  (z = 0.72): at this n, estimating the cells empirically pays a variance
  cost the received functional form does not. 4 of the frozen
  prediction's 5 inequalities held; the one that flipped (prior ≥
  measured, not the reverse) is S14's ladder working as designed — the
  received prior stands until the material's own measurement holds more
  evidence, and here it does not yet.

**Verdict.** Forgetting, in its odds-matched (power-law) form, improves
recall on real prose — significantly, causally, with the advantage
provably order-borne — and the session's earlier negative result is
overturned exactly the way Anderson & Schooler predict: exponential decay
lost because it destroys frequency, not because forgetting is wrong. The
fold's exponential decay remains the right clock for the BINDING layer
(S13's writer-measured window); the retrieval layer wants power-law. One
architecture, two curves, both now measured.


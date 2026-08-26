# The modes of a reading — salience picks the observables, DMD names the dynamics

`native/eval/salience-dmd.mjs` on the whole Frankenstein, causal end to end.
Raw run: `salience-dmd-frankenstein.json`. Machinery:
`kernel/dmd.js` (batch core, 8 analytic tests) + `kernel/dmd-stream.js`
(streaming formulation, Hemati/Williams/Rowley 2014; equivalence to batch
PINNED by test, not asserted) + `memory/activation.js`'s own incremental
salience band. READING-SPEC S11 is the law this runs under.

## The construction, and what is deliberately absent

- **No word list.** Observables are the first 16 motifs the material's own
  band admits (idf ≥ floor AND df ≥ 2, computed at each sentence from only
  the sentences already read). The roster pins the moment it fills;
  snapshots begin at the next sentence. Roster from the prefix, trajectory
  from what follows — the causal way to hold the dimension fixed (S3).
- **No decay constant.** Snapshots are raw per-sentence counts. The
  eigenvalue magnitudes ARE the measured persistence; a gamma imposed on
  the state would hand the modes my number and call it theirs.
- **Two arms, one run.** The band alone; and the band with UD's OWN
  closed-class inventory refused via POSPrior@1's dominant tag (ADP, AUX,
  CCONJ, DET, NUM, PART, PRON, SCONJ — the giver's taxonomy, received, not
  hand-typed).

## What came back

**Arm `band`** (no class filter) — roster: `this with there that ever those
these letter have pole undertaking north from when might been`. The
fi-11940 lesson live on English: recurrence admits function words as
confidently as content. Modes: one strong zero-frequency mode (mag 0.459)
and conjugate pairs at periods ≈ 44 and ≈ 10 sentences.

**Arm `open`** (UD closed classes refused) — roster: `ever letter have
north when only cold great life dear sister many years margaret heaven
time` — Walton's actual frame, a real cast member (margaret) among the
observables. Modes: the zero-frequency mode drops to 0.259 — much of the
band arm's "persistence" was function-word autocorrelation, now named and
gone — and the dominant oscillation is a conjugate pair at **period ≈ 29
sentences** (mag 0.075), with faster pairs at ≈ 6 and ≈ 2 sentences.
(`have` survives the filter because the received prior's dominant tag for
it is VERB 769 / AUX 588 — the prior's own call, not overridden.)

**The headline, stated at its honest size:** genuine complex-conjugate
eigenvalue pairs from real prose, computed causally, with zero model calls
and zero hand-listed vocabulary — the phase a frequency table cannot carry
(S11), measured on a novel. The between-arm difference is itself a
finding: filtering by the received closed-class taxonomy changes WHICH
dynamics you measure, not just which words you watch.

## Limits, named before anyone asks

- The roster is early-book biased by construction (pinned at sentence
  42/63): these are the modes of Walton's opening vocabulary through the
  whole book, not "the modes of the novel." A rolling or re-grounded
  roster is S4-territory future work.
- DIMS=16 / RANK=8 are declared with reasons and UNCALIBRATED — no
  modes-of-a-novel golden exists, so nothing here was tuned against a
  score (the levers lesson, held).
- Mode SHAPES (which motifs move together in each mode) are computed
  nowhere yet — this pass reports eigenvalues only; eigenvectors and their
  reading are the natural next assembly.
- Interpretation of the ≈ 29-sentence period as narrative rhythm would
  need a null (shuffled-sentence arm) before it is anything but a number.

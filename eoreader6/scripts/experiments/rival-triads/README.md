# rival-triads — can the three questions beat a rival three?

An adversarial follow-up to `eo-lexical-analysis-2.0` (the external study
summarized in the handbook's Chapter 2.6). That study showed the lineage's
three axes — mode / domain / grain, asked as three plain-language
questions — carry real geometric structure in blind embeddings of real
sentences. It compared them against **chance**. It never compared them
against **rivals**, so "these three dimensions carve language better than
some other three would" had never been tested. This experiment tests it.

Read `PREREGISTRATION.md` first — predictions were written and locked
before any judging, embedding, or scoring ran (see its own note on how
that ordering is attested). `RESULTS.md` reports what happened,
including everything that went against the prediction.

## Files

- `PREREGISTRATION.md` — the claim, the design, the locked predictions.
- `sample-sentences.mjs` — seeded sampler: 360 English sentences, 12
  sources, 7 registers, from the live_priors corpus. Reuses
  `goldens/shared/gutenberg.mjs`.
- `sentences.json` — the committed sample (regenerable, seed 20260816).
- `analyze.mjs` — embeds with `Xenova/all-MiniLM-L6-v2`, scores all three
  systems on identical instruments (per-axis permutation z, full-address
  z, distance-by-axes-differing curve, inter-judge kappa, Cramér's V).
- `labels/` — the four blind judges' raw label files, committed verbatim.
- `results.json` — machine-readable output of `analyze.mjs`.
- `RESULTS.md` — the human-readable report.

## Method notes

Judges were four independent AI annotator sessions, each given ONLY a
shuffled list of `{id, text}` items and one question-set's three
plain-language questions — no EO vocabulary, no rival vocabulary, no
statement of purpose, no access to any other file. Two judges per
question-set; the consensus subset is sentences where both agree on all
three axes (the original study's rule). The encoder never sees a label;
dependencies live in this directory only (the engine keeps zero).

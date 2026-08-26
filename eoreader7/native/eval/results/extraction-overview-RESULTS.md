# What this reader extracts from a whole book — the funnel, 2026-08-24

`native/eval/extraction-overview.mjs`, whole books, real pipeline organs.
Reproduce: `node native/eval/extraction-overview.mjs <book.txt>...`
(no `--limit`; see vocabulary-scale-FINDING.md for why).

| book | sents | words | surfaces | referents | candidates | grammar survives | **verbs** | **relations** | per 1k words |
|---|---|---|---|---|---|---|---|---|---|
| Frankenstein | 3,392 | 75,363 | 298 | 99 | 172 | 109 | **25** | **1,987** | 26.4 |
| Dracula | 9,470 | 163,636 | 741 | 191 | 447 | 289 | **93** | **9,176** | 56.1 |
| Pride & Prejudice | 7,769 | 128,700 | 330 | 115 | 416 | 271 | **87** | **5,834** | 45.3 |
| Hamlet | 3,800 | 32,976 | 414 | 67 | 153 | 94 | **10** | **568** | 17.2 |

Top admitted verbs are genuinely verbs: Dracula `has went said came took
saw`; P&P `would were has could will should might did came looked`;
Frankenstein `entered went came`.

## Where candidates are lost — the interesting part

Two gates, and they are not equally responsible.

**Grammar (447 → 289 on Dracula) refuses junk, and only refuses.** The
received POS prior may veto a candidate and may never admit one — P2's
"statistics derived from the material, not lookup lists" and P3's "never
patch a missing prior by loosening an engine gate", both preserved.

**Recurrence (289 → 93) is the real bottleneck.** Two thirds of
grammatically-fine verbs are dropped for not recurring after ≥2 DISTINCT
capitalized surfaces. That is deliberate — relations.js's own header:
*"a candidate seen after only ONE surface scored well once; one seen after
several DIFFERENT surfaces recurs, and only a recurring difference is
testimony"*. It is a design commitment, not a defect, and it is where any
future work on extraction volume has to argue.

## Hamlet is the diagnostic outlier

414 surfaces — MORE than Frankenstein — but 10 verbs and 568 relations, a
third of Frankenstein's rate. Speaker headings (`HAMLET.`, `HORATIO.`)
inflate the surface count while dialogue puts almost no verb in the
after-a-name slot, and verse breaks the SVO adjacency the extractor
anchors on. A clean genre boundary: this vocabulary mechanism is built for
narrative prose and says so honestly on drama rather than fabricating.

## CORRECTION — these numbers are not a reading

Stated plainly, because the table above is framed as "what this reader
extracts" and that framing is wrong: this driver calls
`discoverRelationVocab` over the WHOLE text at once and then extracts every
sentence with the resulting vocabulary. Sentence 12 is extracted using
evidence from sentence 9,000. That is batch analysis with full lookahead,
not reading, and READING-POLICY names the commitment it violates — P2 stage
2, a conditional null "built only from material already read (`groundUpTo`
never slices forward)", with P1 making causality the load-bearing rule of
the document.

Every figure above is therefore a LOOKAHEAD BOUND, not a reader's result,
and must be quoted as such.

`native/eval/causal-extraction.mjs` measures the causal arm — the real
perceiver stepped in order, vocabulary refreshed only from material read so
far, each sentence extracted with the vocabulary as it stood at that moment
and never revisited. Results in `causal-extraction-RESULTS.md`. The short
version, which is not what was assumed here: reading in order finds MORE
verb types than lookahead (batch nomination is more permissive) and FEWER
relations (early sentences read with a thin vocabulary are never
reconsidered).

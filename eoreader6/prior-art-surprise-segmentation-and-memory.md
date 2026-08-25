# Surprise, segmentation, and memory — a second citation audit

Sibling to `prior-art-teachable-language-comprehender.md`, not a merge into it.
That essay is scoped to comprehension and the Link mouth — Quillian, Fillmore,
the MUC lineage. This one covers a different thread: the boundary-detection
and associative-memory work in `emergence/` and `loops/`, which that essay
never touches. Short and structural, on CUBE.md's model, not a history essay.

## 1. `activation.js` — already cited in prose, now cited in code

`prior-art-teachable-language-comprehender.md` §I already draws this line by
hand: Quillian's TLC (1969), Collins & Loftus's revision (1975), and this
file's Hebbian/CA3 mechanism are "fifty-seven years apart, same mechanism,"
arrived at independently from neuroscience rather than ported. What the essay
did not do — because SEED.md's own rule (Amendment XVII) is about code
comments, not prose — is put a citation in the file itself. Fixed directly in
`packages/engine/emergence/activation.js`: Marr (1971) and McClelland,
McNaughton & O'Reilly (1995) for the dentate-gyrus/CA3 mechanism the header
already names anatomically; Collins & Loftus (1975) and Crestani (1997) named
alongside as the lineage this mechanism explicitly is **not** — one recurrent
hop, never a flood, is a stated departure from spreading activation, not an
instance of it. Cite the ancestor without also asserting the sameness the
code's own comment ("one hop, not a similarity flood") argues against.

## 2. `emergence/tiers.js` — boundary-by-exceedance has a segmentation literature

`tiers.js`'s own header already makes the segmentation claim in its own
words: "runs of exceedance ARE the windows." That is unsupervised text
segmentation by local statistical departure — the same problem Foote (2000)
solves for audio with a self-similarity matrix and a checkerboard novelty
kernel, and Hearst (1997) solves for text with lexical-cohesion valleys
(TextTiling). Now cited in `tiers.js`, next to the exceedance-null mechanism,
with the divergence stated rather than papered over: both cited ancestors
score a FIXED local comparison against its own history; this gate scores
KL-divergence against a null GENERATED from the tier's own prior. Related
problem, different statistic — see §4 for what that difference is actually
worth, measured.

## 3. Assembly C (`11-terrain-occupancy-and-the-two-ascents.md` §5) — not built, cited anyway

`reading-regime.js` is Assembly B, and it is built. Assembly C — "the high
tier sets the low tier's own hyperparameters and only the residual... climbs
back up, gated" — is a plan, not code, and is explicitly not attempted here
(see §6 of the batch this doc reports on). Its nearest ancestors are cited in
both places a reader would look for them: `reading-regime.js`'s own header
(forward-pointing, since Assembly C depends on the channel parameter that
file supplies) and the design doc itself, where the mechanism is actually
specified. Fortescue, Kershenbaum & Ydstie (1981) for the continuous
forgetting-factor re-dial; DDM (Gama, Medas, Castillo & Rodrigues 2004) and
ADWIN (Bifet & Gavaldà 2007) for the discrete drift gate. Named as two
separate lineages, because nothing found fuses them the way C4's own
acceptance criterion (a discrete typed re-parameterization event, not a
continuous adjustment) requires — recorded so the comparison is available
when C is built, not invented retroactively to make C look novel.

## 4. Measured: does the modelless novelty detector beat TextTiling/C99?

`scripts/segmentation-frankenstein.mjs`, `scripts/lib/segmentation-metrics.mjs`
(Pk, WindowDiff — Beeferman/Berger/Lafferty 1999; Pevzner/Hearst 2002) and
`scripts/lib/segmentation-baselines.mjs` (TextTiling and C99, reimplemented
from the published algorithms, not ported from an existing library — neither
validated against the original papers' own benchmark numbers, only against
properties their own papers claim). Same corpus, same frames (100-word
chunks), same 24-chapter ground truth as every other Frankenstein measurement
in this repo.

**The number this repo has been citing for this comparison is stale.**
`reading-regime.js`, `11-terrain-occupancy-and-the-two-ascents.md`, and
`prior-art-teachable-language-comprehender.md` all still quote `recalled` at
"22/24, p≈0.005" — a figure `scripts/RESULTS.md`'s own "(3) The premise
number does not reproduce" section and `conformance/reproducibility.test.js`
already flag as measured against a legacy-repo fixture path that does not
exist in this repository, and that does not reproduce on the fixture actually
committed here. This audit re-ran it rather than repeating it: **8/24 causal
recall (p≈0.046), 5/24 tight (p≈0.209)** — the corrected number the repo's
own suite already names as the one every downstream statement should rest on.
Closing those three stale citations is not in scope for this doc (it is
already a tracked, open item), but reporting a fresh number here without
repeating the stale one is.

| method | boundaries found | Pk | WindowDiff | matched-count random null |
|---|---|---|---|---|
| this repo (`recalled` → `moved` clearing) | 5 | **0.463** | **0.463** | Pk 0.501±0.025 / WD 0.502±0.025 |
| TextTiling, natural cutoff | 249 | 0.501 | 1.000 | Pk 0.501±0.003 / WD 0.990±0.007 |
| C99, natural elbow stop | 422 | 0.501 | 1.000 | Pk 0.501±0.000 / WD 1.000±0.000 |
| TextTiling, ORACLE count (told 24) | 24 | 0.462 | 0.502 | Pk 0.501±0.043 / WD 0.543±0.039 |
| C99, ORACLE count (told 24) | 24 | **0.430** | **0.434** | Pk 0.501±0.043 / WD 0.543±0.039 |

Pk/WindowDiff window k=16 (half the mean true segment length), n=785 frames.

**Neither baseline beats a random null at its own natural, unsupervised
stopping rule.** TextTiling's depth-cutoff and C99's density elbow each place
an order of magnitude more boundaries than there are chapters (249 and 422
against 24), and at that granularity mismatch both score at or worse than
chance on both metrics — Pk/WindowDiff do not fully correct for a
count mismatch this large, and this is the sharpest illustration available:
raw, unsupervised, neither published method finds "chapter" as its natural
scale on this text.

**Only when handed the true boundary count (an oracle neither this repo's
own detector nor either baseline's natural mode receives) do the baselines
become competitive, and C99 comes out slightly ahead of this repo's
mechanism on both metrics** — 0.430/0.434 against 0.463/0.463, roughly a
half-point-of-SD margin given the null's spread. This repo's detector has no
boundary-count parameter to hand an oracle to; comparing it against the
oracle rows is comparing a parameter-free method to two methods given
information it structurally cannot use. Comparing it against the *natural*
rows — the fair comparison, since none of the three received an oracle — this
repo's detector is the only one of the three that beats its own matched-count
null at all.

**Conclusion, stated the way item 4 of the original request anticipated it
might have to be.** The modelless novelty detector does not clearly beat
TextTiling/C99 on Pk/WindowDiff — it is roughly tied with C99's oracle-count
mode and ahead of both baselines' natural mode, on a five-boundary, likely
underpowered sample. What it does have that neither baseline receives in this
comparison is a null-relative claim at its own operating point: 5 boundaries,
found without being told how many to look for, still separated from a
matched-count random placement. The honest framing leans on that — parameter-
free null validation — rather than on raw Pk beating a hand-tuned baseline,
because on this run it does not clearly do that.

## 5. HippoRAG 2 — a dependency comparison, not a recall comparison, and why

HippoRAG 2 (Gutiérrez et al., "From RAG to Memory: Non-Parametric Continual
Learning for Large Language Models," arXiv:2502.14802, 2025) builds a
dual-node (phrase + passage) knowledge graph via LLM-driven OpenIE at index
time, adds embedding-based synonym edges from an ANN index, and retrieves via
Personalized PageRank seeded by a hybrid of LLM-scored triple relevance and
dense query-passage similarity. Three dependencies, all neural: an LLM
(offline extraction AND online query-time triple filtering), a passage/phrase
embedding encoder, and an ANN index.

`emergence/activation.js` has none of the three — no LLM, no embedding model,
no vector index; Hebbian edges wired from co-occurrence at read time, sparse
coding gated by an incremental idf/df table, retrieval by table lookup. The
"zero neural components" framing item 6 asked for is real and checkable
directly against the import list of every file in `emergence/` and
`referents/`: nothing in this codebase imports an embedding call or an LLM
call for retrieval. (`NO_EMBEDDER` in `activation.js` is the file naming its
own absence rather than silently having one.)

**No live recall comparison was run, and the reason is not "time" — it is
that this repo has no multi-hop retrieval mode to point at one.**
`activation.js`'s CELL declaration and its own header are explicit: "one
recurrent hop, not a flood" is not an unoptimized multi-hop mechanism, it is
the whole design — a diffuse multi-hop spread is the failure mode this file
exists to avoid. `emergence/binding.js` builds pairwise co-arrival links, also
not chained into paths. `loops/surf.js` is Whiteheadian concrescence
(genetic, undivided growth), not a query-answering hop chain. Checked, not
assumed: no file in `packages/engine` composes two retrieval hops into an
answer to a question that needs both. A multi-hop recall benchmark needs two
things this repo does not have — a wired multi-hop retrieval path, and a
multi-hop QA dataset with gold answers — and building the first to answer a
citation-debt audit would be inventing the capability being asked to compare,
not measuring it.

**What this makes concrete, and what would resolve it.** The interesting
comparison is not "HippoRAG 2 gets N% recall and this gets M%" — it is
whether repeating `activation.js`'s existing one-hop primitive (read the
prior frames a cue activates, then treat one of those frames as a new cue) is
enough to answer a two-hop question, versus needing the graph-and-PPR
machinery HippoRAG 2 was built for. That is a real, buildable measurement —
chain `readForward`'s completion step twice against a small hand-built
two-hop fixture (of the kind `goldens/surprise`'s corpus already models: cases
tagged by what tier of knowledge they require) and see whether two one-hop
calls compose into a correct two-hop answer, or whether they drown in the
same local-vocabulary flood the file's own header already warns a longer
spread would produce. Not built here. Recorded as the next real question
rather than as a claimed result the run behind it does not exist to support.

## 6. Left unresolved, named rather than guessed

A falsification-audit paper by "Nikolopoulos" was referenced in the source
request for this batch. It is not in this repository, not identifiable from
context available to this audit, and not fabricated to fill the slot — the
existing prior-art essay's own closing line applies here without
modification: "Dates and attributions should be verified before any of this
is published." Whoever has the paper in hand should add the citation where
it belongs (most likely alongside §4 or §5 above, depending on which claim
it audits) rather than have one invented here to look complete.

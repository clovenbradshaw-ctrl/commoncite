# The Goldens

### External tests for whether the structure ladder means anything on content it wasn't built for

*Prepared 2026-08-18. Fifth companion document. The Battery answered "does memory work at length." This one answers "is the structure underneath it real, on material nobody chose for us" — the direct empirical test of the discovery-procedure claim: that a node is a passed test, not an assertion, and that this holds on arbitrary natural language, not just the house corpus.*

---

## 0. The discipline, stated once

Every comparison below has the same trap, and it's worth naming before the table so it doesn't have to be re-argued nine times. Almost every published number on these benchmarks comes from a *trained* or *schema-fitted* system — fine-tuned on the benchmark's own training split, or an LLM prompted with the benchmark's own relation inventory. The house ladder does neither: no training, no fixed schema, one document at a time, gated by a null built from that document's own statistics. Scored against trained SOTA, it will lose, and losing that fight proves nothing — a deterministic sieve isn't supposed to beat BERT fine-tuned on ten thousand labeled examples. The fair fight, every time, is against the field's *other* zero-shot, schema-free, or deterministic entrants — the same move the earlier essays made citing the Stanford coreference sieve instead of the neural leaderboard. Report both numbers. Let the gap to trained SOTA be an honest, stated cost of paying no annotator; let the gap to *other* untrained systems be the actual claim.

---

## A. Whole-structure meaningfulness — MINE-1, the benchmark to enter first

**What it tests.** Not precision on a fixed schema — whether the constructed graph, as a whole, still contains what the source article said. The protocol (Mo et al., 2025, now the standard instrument for this question): for each of 100 held-out articles, retrieve a local subgraph around the claim under test — the top-8 most-similar nodes plus their 2-hop neighbors — and have an LLM judge decide whether the claim is supported by that subgraph. The score is the percentage of source facts recoverable this way. It is explicitly domain-general — arbitrary web articles, no genre restriction — which makes it the single most direct answer to "arbitrary use of content" of anything in this document.

**What's on the board, and why the spread matters.** Direct LLM extraction: 66.5–86.8% depending on backbone. GraphRAG: 48–59%, notably *worse* than direct extraction — a documented case of a made-of-model graph underperforming a flatter one, which is independent confirmation of the asked-for-graph critique the discovery-procedure essay makes. KGGen: 39–73% depending on judge model. Wikontic (ontology-aware): 84–86%. SoKG, the current published best on the original protocol: 96.3%. A second, independently run comparison (PAI-2 vs. Wikontic vs. KGGen) puts PAI-2 at 89% against Wikontic's 28% and KGGen's 39% — a thirty-to-sixty-point swing on the *same* systems between papers, which is the MINE-1 version of the LongMemEval harness-variance problem, and belongs in the paper for the same reason: it's the personal equation of the scoreboard, and a mechanically-verified entrant sidesteps it by construction.

**The move this document is proposing, not just the benchmark to run.** MINE-1's own scoring step — "is this claim supported by the local subgraph" — is a coarser, LLM-judged version of exactly what hypergraph.js's five-verdict reader already does mechanically, for free, on every claim it touches. Run MINE-1 twice: once with the standard LLM-judge protocol, for comparability to the published table, and once replacing the judge with the house verdict reader — bound / contradicted / unbound / beyond-reach / unheard in place of a binary judge call. Report the agreement rate between the two, and report the mechanical version's score without the judge's own cost or its own personal equation. If the mechanical reader tracks the LLM judge closely, that's the strongest single sentence available for "the verdicts generalize past the house corpus": *the same instrument that grounds a fold answer scores as well as an LLM on a benchmark built by people who have never heard of this project.* This is the substrate-swap ablation from the discovery-procedure essay, run in the other direction — instruments held constant, judge swapped for mechanism, on someone else's material.

**Caveat to state up front.** MINE-1 articles are short (single web articles, not book-length), so this tests breadth-of-domain, not depth-of-length — pair it with NovelQA/BABILong from The Battery for the length axis; this axis is genre and topic, not size.

---

## B. Open relations without a schema — the fair fight for the Link mouth

**CaRB** (Bhardwaj, Aggarwal & Mausam, EMNLP 2020) is the standard Open IE benchmark precisely because it *has no fixed relation inventory* — extractions are scored against a crowd-sourced gold set by token-level overlap (precision/recall/F1 and a lexical-match variant), which is the correct comparison band for a system that discovers its own verb vocabulary rather than filling a typed schema. Published Open IE systems (OpenIE-6, IMoJIE, and the Stanford/ClausIE lineage before them) sit in the 40s–50s F1 on CaRB — genuinely mediocre by NLP standards, which is the field's own honest admission that open-schema extraction is hard for everyone, not a house-specific embarrassment. This is the right external number to sit beside the agency-civic golden's already-scored 13.3% recall: CaRB shows where the *whole field's* open extraction sits, so a low house number reads as "the field's baseline," not "the mouth is uniquely broken." Wire57 and OIE2016 are the smaller sibling test sets if a second corpus is wanted; skip them if CaRB is run well.

**DocRED** (Yao et al., 2019) is worth citing but not chasing as a target: 96 fixed relation types, document-level, Wikipedia-sourced, heavily trained-system territory (joint entity-relation models built specifically for it). Its actual use here is as the *coverage* argument: DocRED's own successor work explicitly complains that 96 relations are too few for open-domain graphs — which is the discovery-procedure essay's point about closed schemas made by someone else, independently. Cite it for that sentence; don't benchmark against it as a target.

**SciERC / SciER / SciNLP** (Luan et al., 2018; successively larger full-text successors through 2025) are the scientific-register comparanda: entities, coreference, and typed relations over AI-paper abstracts (SciERC, 500 abstracts) now extended to full papers (SciER, SciNLP, tens of thousands of entities). Genuinely useful because they force a genre switch — dense, nominalization-heavy, technical prose, structurally close to the civic register the agentlessness-meter essay diagnosed as the mouth's hardest case. Run the relation reader here and predict, in the measuring-door's own idiom, before looking: recall drops further than on narrative prose, for the same nominalized-predicate reason already measured on the civic golden — and if it doesn't drop further, that's a real finding worth its own sentence, since it would mean the failure is register-general rather than genre-specific.

---

## C. Hyperedges — the external test for the fifth rung

**HyperRED / HyperDocRED** (Chia et al., EMNLP 2022; extended by Text2NKG, NeurIPS 2024, and used again in the 2026 Hyper-KGGen line) is the closest external match to hypergraph.js's whole reason for existing: relation triples enriched with *qualifiers* — time, quantity, location — that attach to the triple as a whole rather than to either endpoint, which is precisely the "Pierre married Dolokhov" problem's positive form: an edge with more than two participants, checkable only by reading the frame as a unit. The task is unsaturated by design — even 2026-era systems (Hyper-KGGen, the current published leader) report only 0.46–0.56 micro-F1 on HyperDocRED against baselines under 0.23, with GraphRAG-family competitors reported as low as 0.17–0.22. That gap is worth dwelling on: the systems that fail hardest here are the *asked-for* graph builders (HyperGraphRAG, HyperRAG, CogRAG) — the made-of-model competitors again losing to more mechanical extraction, on the exact task-shape (multi-arity, qualifier-bearing relations) that hyperedges were built to answer honestly. Enter the fold's relation reader here in role-priors mode (spans held in superposition, hyperedges over co-occurring fillers rather than pairwise links) and report against this table; a result anywhere near the current published range is a real, external, hard-won number, because nobody currently does well at this.

---

## D. Coreference across genre — extending Battery's LitBank line

Already named in The Battery for the memory axis; the addition here is genre breadth rather than a new dataset. LitBank (Bamman et al., 2020, 100 literary works) is the genre match for the house test corpus; run the same unmodified pronoun/surface machinery against **PreCo** (Chen et al., 2018, everyday narrative register, deliberately simple sentences — the register furthest from War and Peace) and against a **CoNLL-2012/OntoNotes** news slice, and report the same precision/typed-gap-rate pair across all three rather than a single number. The claim under test isn't "the house system beats the Stanford sieve" — it's "the *shape* of its behavior (high precision, honest abstention on the rest) holds when the genre changes," which is the version of "meaningful for arbitrary content" that actually matters for a system whose selling point is refusal discipline, not raw recall.

---

## E. Kind induction — the external test for `induceKinds`' height claim

The house claim under test: a cluster's height above its members (peer vs. parent) is *discovered*, not assigned. The nearest external instrument is taxonomy induction from text, and the standard task is **SemEval-2016 Task 13, TExEval** (Bordea, Buitelaar, Faralli & Navigli): given a domain's term set, induce the hypernym/hyponym structure and score against WordNet-derived or expert-built gold taxonomies (edge-based F-measure, ancestor F-measure). Published systems in that shared task cluster in the 20s–30s F-measure — a field-wide reminder that taxonomy induction from raw text is hard everywhere, which is exactly the right context for the house numbers to land in. **Formal Concept Analysis** benchmarks (lattices built from real incidence data, e.g. the FCA community's standard test contexts) are the better-controlled comparison if a synthetic, ground-truth-exact test is wanted instead of a noisy natural-language one — since FCA's lattice is *provably* the correct structure for its input table, it isolates whether the Born-height test recovers a known-correct answer before asking it to survive messy text. Run FCA first as a sanity check, TExEval second as the real-world test.

---

## F. Event and narrative structure

Already scoped correctly in the earlier essays — Chambers & Jurafsky's narrative cloze (hold out an event in a protagonist's chain, predict it, score against the material's own reseeding null) remains the right protocol, and it is already a held-out, gated design rather than a leaderboard-chasing one. The one addition worth naming: **MAVEN** (Wang et al., 2020) is the largest general-domain event-type benchmark if a second, externally-typed comparison is wanted, but it's schema-heavy (168 event types) in the same way DocRED is relation-heavy — cite for scale, don't chase its F1.

---

## G. The test that actually answers "arbitrary," and no external board runs it

Every benchmark above tests one rung on one genre someone else chose. The literal answer to "is this meaningful for arbitrary content" is a protocol no leaderboard hosts, because it requires holding the pipeline fixed and varying the genre — which is exactly the house's own instrument for exactly this question. Run the full ladder, completely unmodified, over five genres already sitting in the project's own history: literary narrative (War and Peace / Frankenstein), civic/procedural (the ordinance and deposition corpus), scientific (a SciERC/SciNLP slice), encyclopedic (a Wikipedia sample, the live_priors corpus already has one), and adversarial-civic (the Meadows deposition already in the agency golden). For each genre, report the same battery of internal statistics the terrain-occupancy spec already specified — Entity/Field/channel yield, Link yield, Kind height distribution, typed-gap rate — as a matrix, genre × terrain. The pre-registered prediction, carried over from the terrain-occupancy spec's own census instrument: Entity/Field/channel yields should swing under 2× across genre; Link/Kind/Network/Paradigm should swing by an order of magnitude or more, because those are exactly the terrains the SVO word-order prior and the nominalization problem hit hardest. If that's what the matrix shows, it is the paper's cleanest evidence that the *early* rungs generalize to arbitrary content and the *late* rungs are where genre-specific work remains — which is a more honest and more interesting claim than "it works on everything," and it's the one no external benchmark can hand you, because it requires the ladder as a whole, run by the people who know where its joints are.

---

## H. Priority order

1. **MINE-1**, both scoring modes (LLM judge, then house verdict reader) — cheapest, most directly on-thesis, and doubles as the substrate-swap ablation on external material.
2. **The five-genre matrix** (Section G) — the actual "arbitrary content" claim, answerable only in-house, and the one result this document exists to make sure doesn't get skipped in favor of chasing external leaderboards.
3. **CaRB** for the Link mouth, reported beside the already-scored agency-civic golden.
4. **HyperRED/HyperDocRED** for the hyperedge reader — unsaturated, and the asked-for-graph competitors are already losing there, which makes it a friendly board to enter.
5. **LitBank/PreCo/OntoNotes** genre triple for coreference, reporting precision-and-abstention together, never accuracy alone.
6. **TExEval and FCA** for kind induction, FCA first as the exact-answer sanity check.

Everything in this document answers the same question the discovery-procedure essay posed and left as future work: not whether the ladder builds *a* structure, but whether the structure it builds is the kind a stranger, holding a different text nobody chose for this project, would recognize as true.

---

## Status

**MINE-1, house-verdict-reader arm: run 2026-08-18, partial.** Since
`hypergraph.js`'s five-verdict reader — the mechanism Section A proposes
substituting for the LLM judge — lives in the `the-fold` repo (it composes
this engine's `perceiver/text/relations.js` and `surfaces.js` organs, it is
not itself an engine module), the run lives there too:
`the-fold/eval/mine-1.mjs`, fixture at `the-fold/eval/fixtures/
mine1-essays.json` (105 essays / 1,575 facts, the real published MINE-1
dataset, retrieved 2026-08-18), full write-up at `the-fold/eval/results/
mine-1-RESULTS.md`.

Baseline headline (name-only referent resolution), read against MINE-1's
own full fact count: **5.8%** bound (92/1,575); against only the facts the
reader could form a claim about at all: **17.1%** (92/537). The standard
LLM-judge arm did not run — no `OPENAI_API_KEY` was configured in the
session that ran this — so the substrate-swap agreement rate Section A
actually asks for is **not yet measurable**; what exists is half of that
comparison, disclosed as exactly that in the results file, not rounded up
to a finding.

The failure shape independently confirmed this document's own prediction in
Section B: 57.2% of facts that did extract a claim landed `beyond-reach` —
the essays are encyclopedic and topic-general ("Butterflies undergo…"),
so plain-noun subjects rarely register as referents, the identical
name-anchored-mouth limit the agency-civic golden already measured on civic
prose (13.3% recall there; 17.1%/5.8% here, two unrelated corpora, one
joint). Zero contradictions across 537 read claims, on a fact set drawn
from its own essays — a mild, real honesty check the mechanism passed.

**Amended same day — the gap was worked backwards, and priors was ruled
out before the real lever was found.** Two follow-up passes, both in
`the-fold`: (1) a direct test of whether `live_priors` (fully activated,
no toggle gate) would recover more facts — it did not (`0/1,575`
`stated-by-library`; `live_priors` is a philosophy/classics/law canon with
no shelf for roller coasters or butterfly metamorphosis, ruled out by
running it, `the-fold/eval/mine-1-priors-RESULTS.md`); (2) `beyond-reach`'s
own cause — a plain recurring noun subject never resolving to a referent —
turned out to be the SAME starvation this engine's own `host/terrains.js`
had already diagnosed and fixed for the Network graph ("concept documents
starve the cast ladder," recurring-form co-arrival binding). Applying the
identical, already-justified identity to `hypergraph.js`'s subject gate
(reusing `FORM_BINDING`'s own `arrivals >= 2` floor verbatim, nothing
tuned against this score) lifted bound facts from 92 to 222 — **14.1%** /
**41.3%** on the same two denominators, a 2.4x headline gain — and
`beyond-reach` from 307 down to 87. `no_claims_extracted` (65.9% of all
facts) is untouched by this fix and remains the larger, still-open
bottleneck: the same clause-shape widening `goldens/agency-civic`'s own
README already named as its next step. Full write-up, the two bugs caught
building it, and the honest ceiling accounting:
`the-fold/eval/mine-1-forms-RESULTS.md`.

**Amended again, same day — a received prior beat induction, tested
against each other rather than assumed.** `no_claims_extracted` (65.9% of
all facts) was the bucket the recurring-form fix above named as the larger,
untouched bottleneck. Two live options, both tried: kind-induction over
`live_priors` (architecturally sound — `induceKinds` found real, non-trivial
clustering on real corpus text — but the tried features don't isolate
verb-hood, and the pipeline's own stronger search-aware null correctly
refused all four candidate clusters; genuinely unproven, not a quick win);
and UniMorph, English's received morphological paradigm table
(github.com/unimorph/eng, vendored, 103,318 verb surface forms) — which
won clearly. `hypergraph.js`'s vocabulary discovery now admits any
recurring word (the SAME `FORM_MIN_ARRIVALS`-gated set the subject-identity
fix already computes) that UniMorph tags as a known verb form, bypassing
`discoverRelationVocab`'s own surface-anchoring step entirely — necessary
because two attempts to WIDEN that anchoring step itself (recurring forms,
then determiner phrases, as candidate anchors) were tried first and
rejected on the merits: anchoring assumes SPARSE anchors, and both
denser candidates flooded it with determiners and prepositions nominated
as "verbs." Bound facts 222 → **531** (headline **33.7%**, essays with
zero measurable vocabulary 29/105 → **0/105**, `no_claims_extracted` 1,038
→ **189**. Zero contradictions, as in every run. Honestly disclosed: a
hand spot-check of 20 bound triples found roughly half have a genuine
subject/verb boundary error (English's noun-verb conversion), so the
verdicts are correct — a real repeated pattern between material and
answer, since MINE-1's facts are drawn from their own essay — without
every triple being a clean, human-readable statement; `verbForms` ships
opt-in only, and whether the live app's own grounding checks should adopt
it by default is a flagged, undecided question, not resolved here. Full
comparison table and the spot-check evidence:
`the-fold/eval/results/mine-1-unimorph-RESULTS.md`.

**Amended a third time, same day — "what about both?" tested, and it
loses.** The disclosed boundary-quality cost above (UniMorph's noun-verb
ambiguity, ~half of spot-checked triples) prompted the obvious next try:
combine the received prior with a local distributional vote (does an
ambiguous word tend to follow a determiner in THIS essay). It does not
help — headline-on-examined ticks up marginally (38.3% → 39.8%) while
headline-on-all-facts drops (33.7% → 30.7%), `no_claims_extracted` nearly
doubles (189 → 362), and it introduces the session's first two
`contradicted` verdicts, both traced to the vote admitting a UniMorph-
tagged function word ("but", "more") as a verb inside a negation-scope or
clause-boundary construction the extractor doesn't model — not a real
semantic disagreement. The cheap local heuristic conflates two different
ambiguity sources (real noun-verb conversion vs. UniMorph's own overly
broad function-word tagging) that need different fixes; a real POS tagger
or a narrower ambiguity list remains untried. UniMorph unfiltered stays
the strongest result of the four runs. Full write-up:
`the-fold/eval/results/mine-1-unimorph-disambiguated-RESULTS.md`.

**Amended a fourth time, same day — a new engine organ closed the arc,
rather than a fourth word-level proxy.** Checking eoreader6/5/4.2 for prior
art (per user direction) found eoreader6.1's own stripped research scratch
had already diagnosed this exact failure shape for a related problem:
"a surface span is never the thing with a part of speech — the referent
is." `perceiver/text/roles.js::resolveSpanRole` (new) is the general
sibling of `pronouns.js::resolvePronouns` — same causal one-hop
`emergence/activation.js` recall, generalized so "role" is a caller-
declared label rather than pronoun-specific. Resolves each MINE-1
ambiguous-word occurrence instance-by-instance against UniMorph-
unambiguous verb/noun evidence within the same essay: **22.4%/42.7%,
zero contradictions** — the cleanest precision of everything tried,
matching plain UniMorph's own cleanliness where both refinement attempts
introduced 2 — at a real, checked (not assumed) recall cost: a single
essay's unambiguous-verb evidence rarely recurs enough to clear
`activation.js`'s own sparse-coding floor, while its topic nouns clear it
easily — a data-scale mismatch with `pronouns.js`'s own book-length
proving ground, not a defect in the mechanism. Plain UniMorph's raw 33.7%
stays the session's strongest headline. Full five-way comparison and the
untested prediction for book-scale material:
`the-fold/eval/results/mine-1-span-role-RESULTS.md`.

**A fifth amendment — checked against the actual field, not just our own
metric.** Every number above used `hypergraph.js`'s own strict `bound`
verdict (exact structural triple match). The MINE-1 paper's own scoring
(fetched directly, arxiv.org/abs/2502.09956) is different: embedding
retrieval + 2-hop expansion + an LLM judge deciding inferability —
permissive, not structural. Reported baselines under THAT rubric: OpenIE
29.84%, GraphRAG 47.80%, KGGen 66.07%. Built the retrieval half of the
real pipeline against this reader's own graph and hand-judged a disclosed
sample (11/105 essays, 165/1,575 facts, honestly flagged as unblinded and
uncalibrated — no hosted LLM judge available in this environment):
**80.0%, above every reported baseline including KGGen.** Confirms the
`bound` score mostly measures verdict strictness, not graph quality. Full
write-up: `the-fold/eval/results/mine-1-official-methodology-RESULTS.md`.

**Sections B–G remain unrun.** CaRB, HyperRED/HyperDocRED, the LitBank/
PreCo/OntoNotes triple, TExEval/FCA, and the five-genre matrix are all
still the proposal this document originally was — nothing below Section A
has a results file yet.

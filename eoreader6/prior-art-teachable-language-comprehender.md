# The Teachable Language Comprehender

A history of machines that were said to read, and an inventory of what is actually missing

## I. 1969

There is a program from 1969 called the Teachable Language Comprehender. Ross Quillian built it, published it in Communications of the ACM, and described it as both a simulation program and a theory of language.

Here is how it worked. Concepts were nodes in a network. Reading a sentence meant activating the nodes its words named, and letting activation spread outward along the links, one hop at a time, from each activated node. When two spreading fronts intersected — when a path was found between the concept named in this sentence and a concept from an earlier one — the intersection was the comprehension. The program had understood the sentence to the extent that it could connect it to something it already had.

That is spreading activation. Collins and Quillian tested its predictions on human reaction times the same year; Collins and Loftus revised the model in 1975; it became one of the load-bearing constructs of cognitive psychology and has never really gone away.

Now here is `emergence/activation.js`, written in 2026. Concepts are motifs. Reading a frame means computing its sparse code, letting the code fire along Hebbian edges wired at read time, exactly one recurrent hop — not a flood, because a flood pools inside the local vocabulary and drowns the distant target — and the prior frames that light up are what this frame brought back.

Fifty-seven years apart. Same mechanism. Nobody ported anything; the file's own header derives it from hippocampal function, from the dentate gyrus and CA3, and re-earns it against a memory golden rather than citing Quillian at all.

I don't think this is embarrassing. I think it is the most important fact about the project's position, and it cuts both ways. The mechanism is right — it was right in 1969, it was right when Myers and O'Brien rebuilt it as resonance in the 1990s, it is right now, and arriving at it independently from neuroscience is evidence rather than coincidence. But it also means the project has arrived at the starting line of a race that has been run four times, by well-funded people, who all failed for reasons that are documented.

So this essay is the inventory. What everyone who tried this before actually built, what specifically broke, what the psychology says comprehension requires that none of them had, and what — honestly — would have to be true for eoreader6 to be a machine that reads.

## II. Reading has been redefined four times, each time by its scoreboard

Before the prior art, a framing device, because otherwise the history is just a list.

Reading is whatever the current benchmark measures. That has been true four times, and each time the definition was gamed and then quietly replaced.

**Definition 1 — reading is building a structure you can paraphrase from.** Schank's conceptual dependency, 1972. A sentence is understood when it has been converted into a canonical representation of primitive acts, from which the system can generate paraphrases, answer questions, and — crucially — make the inferences the text left implicit. John gave Mary a book becomes an ATRANS with filled slots, and the system knows Mary has the book now without being told. Scripts followed in 1977: restaurant, and the system knows you paid.

This was real reading in a way that nothing since has quite matched. SAM understood stories. PAM tracked goals. FRUMP, in 1979, skimmed live UPI newswire using sketchy scripts and produced summaries. That is a machine reading the news.

It died of the knowledge acquisition bottleneck. Every script was hand-built. The restaurant script did not generalize to a hospital, and the hospital script did not generalize to a procurement hearing, and there is no finite list of scripts. Lenat's CYC, from 1984, was the heroic attempt to just write them all down, and forty years later that project is still the standing demonstration of how large the number is.

**Definition 2 — reading is filling a template.** The Message Understanding Conferences, 1987 to 1998, seven of them, DARPA-funded. This is the one that matters most for Michael's work and it is the one that gets cited least, so I want to spend a section on it below. Briefly: given a corpus of news, extract who did what to whom into a fixed slot structure. MUC-3 and MUC-4 used Latin American terrorism reports — perpetrator, target, date, instrument. MUC-6, in 1995, introduced named entity recognition and coreference as scored subtasks in their own right, which is where the modern NER and coref task definitions come from.

It stalled. Template-filling scores plateaued well below the human ceiling, and the human ceiling itself was not that high — annotators disagreed with each other often enough that the task's own definition was in question. The programs were brittle, domain-specific, and enormously expensive to port.

**Definition 3 — reading is selecting a span.** Hirschman's Deep Read in 1999 proposed reading comprehension tests as an AI evaluation, using third- to sixth-grade stories, and found that a bag-of-words baseline did unnervingly well. That should have been the warning. Instead the paradigm scaled: CNN/Daily Mail cloze in 2015, SQuAD in 2016, and a decade of leaderboards.

It was gamed almost immediately, and the gaming is well documented. Chen, Bolton and Manning took apart CNN/Daily Mail in 2016 and showed a large fraction was either trivially solvable or unanswerable noise. Jia and Liang appended a distracting sentence to SQuAD passages in 2017 and watched systems collapse. Others showed that passage-only and question-only baselines — models that never see both — scored far above chance, meaning the datasets encoded exploitable artifacts rather than comprehension. Levesque had already anticipated the whole problem in 2011 with the Winograd Schema Challenge, deliberately constructed so that pronoun resolution required world knowledge and could not be pattern-matched. It, too, was eventually saturated.

**Definition 4 — reading is producing text a human rates as responsive.** The current one. It is not really a definition, it is a preference model, and it has the interesting property of being unfalsifiable from the outside: there is no artifact to inspect, no structure to audit, no record of what was used. The system either satisfies you or it doesn't.

Each of these definitions was operationalized by what could be scored. That is the pattern. And it's why the fifth definition — the one eoreader6 is implicitly proposing — is genuinely novel, and I'll come back to it at the end.

## III. The objection from 1968 that this project has not answered

The single most damaging piece of prior art for the Link mouth is fifty-eight years old and was correct on arrival.

Charles Fillmore, *The Case for Case*, 1968. The argument: surface grammatical subject is not the same thing as semantic agent, and any theory that treats them as the same will fail on a large fraction of ordinary language. John broke the window, the hammer broke the window, the window broke — John is the agent, the hammer is the instrument, the window is the patient, and all three appear in subject position. Fillmore proposed deep cases — agent, instrument, patient, experiencer — as the level at which the facts are stable, precisely because surface position is not.

eoreader6's relation mouth finds a verb by position: the token after a named surface occupies the predicate slot. The hand list of ninety verbs is gone — `discoverRelationVocab` measures the vocabulary from the text, which was the right fix for the right reason. But what remains is a word-order prior, and the word-order prior is exactly the assumption Fillmore spent a career dismantling.

The field's answer to Fillmore became semantic role labeling: FrameNet from 1997, PropBank from 2005, a run of CoNLL shared tasks. And the thing to know about SRL is that it works, moderately, and it is supervised. PropBank is hand-annotated over the Penn Treebank. FrameNet is hand-built frames with hand-annotated exemplars. The knowledge acquisition bottleneck did not go away; it moved into annotation budgets.

There is unsupervised SRL — Titov and Klementiev, Lang and Lapata, around 2010-11 — which induces role clusters from distributional evidence without labels. It is the honest option for a project that refuses hand lists. It is also substantially worse than the supervised version and, as far as I know, has never been demonstrated on the agentless register.

And the field rediscovered Fillmore's problem from the other direction, in a form that reads like a direct commentary on this repo. Open Information Extraction — TextRunner in 2007, then ReVerb in 2011 — set out to extract relations from web text with no target schema at all. Their finding, stated plainly in the ReVerb paper: unconstrained extraction produces relations that are incoherent and uninformative, and the fix was to impose a syntactic constraint on what could count as a relation phrase — a verb, or a verb followed by a preposition, or a verb followed by nouns and adjectives ending in a preposition — plus a lexical constraint requiring the phrase to occur with many distinct argument pairs.

That second constraint is worth staring at. A relation phrase earns its status by recurring across many distinct argument pairs. That is `discoverRelationVocab` and the ≥2-distinct-surfaces recurrence requirement, arrived at independently, and the convergence is the good news. The bad news is in the first constraint: even with the recurrence test, ReVerb needed a verb-centered syntactic pattern to avoid garbage. And the well-known limitation of verb-centered Open IE is that it misses nominalized relations — the acquisition of X by Y, the deployment of cameras in the district — which is precisely the construction that dominates the corpus this project exists to read.

The field hit the wall this project is against, named it, and worked around it by accepting the loss. There is a literature on nominal and noun-mediated relation extraction, and it is much thinner and much less successful than the verb-based work.

So: the Link mouth's problem is not a local implementation defect. It is a fifty-eight-year-old structural fact about the relationship between surface form and semantic role, on which the best-funded programs in the field made partial progress by spending money on annotation, and on which the unsupervised route remains genuinely open research.

## IV. The decade when the government paid for exactly this

MUC deserves more than a paragraph because it is the closest historical analogue to what Michael is doing, and its lessons are unusually transferable.

The task was: read news reports and populate a structured record. MUC-3 and MUC-4 used several hundred Latin American terrorism reports and asked for perpetrator organization, perpetrator individual, physical target, human target, date, location, instrument. Systems were scored on precision and recall against human-filled templates.

Three findings from that decade are directly load-bearing here.

One: the human ceiling was low, and that is a fact about the task. Human annotators, working carefully from guidelines, did not agree with each other nearly as much as the field expected. Template filling from real news is genuinely ambiguous — not because people are careless, but because the text often does not determine the answer. A project that measures itself against a golden cast, as `goldens/cast/` does, will hit this: the Wikipedia character list is a reading, not a ground truth, and the Finnish golden already showed what happens when the reading and the material disagree (13/19 recall at precision 0.052, with the register of 269 topped by function words — recurrence individuating without discriminating).

Two: coreference was split out as its own scored task in MUC-6 because it was the bottleneck. Not because it was interesting. Because template filling kept failing on it. Everything downstream of "which mentions are the same entity" inherits its errors, and MUC-6's coreference scoring metric (and its successors, B-CUBED and CEAF and the rest) exist because the field needed to isolate that failure to make progress on anything else. eoreader6 arrived at the same partition from the other side, dividing name-variant coreference (engine tier, derivable) from descriptor synonymy and pronoun binding (model tier) — and then narrowed the pronoun half by activation while leaving descriptor synonymy an honest gap. That partition is well founded and matches what the field learned the expensive way.

Three: nobody solved the agentless case, and to my knowledge nobody seriously tried. MUC's corpora were news reports about events with perpetrators. News prose, especially wire prose, is unusually agent-rich — it is written to say who did it. The register that dominates municipal records is the opposite register, and the extraction literature simply does not have a body of results on it, because the funding followed intelligence-analyst use cases and intelligence analysts were reading reports about attacks, not procurement addenda.

Which means the agentlessness meter idea from the previous essay — reading Link yield backwards as a measurement of how much a document declines to say who acted — sits in a genuine gap. Critical discourse analysis counted agent deletion by hand from 1979 onward (Fowler, Hodge, Kress and Trew; then Fairclough) and never automated it. Information extraction automated relation-finding and never turned the failures into a measurement. The two literatures do not appear to have met.

## V. What the psychology says is missing, and three theories agree

Now the part that I think matters most, because it is a specific structural gap rather than a hard research problem, and three independent lines of work converge on it.

Kintsch and van Dijk, 1978; Kintsch's construction-integration model, 1988. Comprehension has two phases. Construction is promiscuous and dumb: the text activates everything associated with it, including irrelevant and contradictory material, with no filtering. Integration is a constraint-satisfaction settling process over the resulting network, in which mutually supporting activations strengthen each other and inconsistent ones are damped out. The output is a coherent situation model.

The theory's central claim is that the first phase is not comprehension. It is the raw material. Comprehension is the settling.

Gernsbacher's Structure Building Framework, 1990. Comprehension is laying a foundation, mapping incoming information onto it, and shifting to a new structure when incoming information doesn't map. And the mechanism that makes this work is suppression: an active competitor must be dampened once the correct interpretation is established. Gernsbacher's evidence is that less-skilled comprehenders are not worse at activating meanings — they are worse at suppressing the ones that lose.

Myers and O'Brien's resonance model, 1996-98. Reactivation from long-term memory is passive, cue-driven, and unguided by discourse focus — which eoreader6 committed to explicitly, in the conformance test that says activation beats recency. This is the half the project got right, and getting it right was a real theoretical choice, not a default.

Now line them up against the code.

`activation.js` implements construction — beautifully, causally, with the incremental idf tables closing the whole-document leak, and with the third occurrence is the first that can recall consequence defended rather than patched. It implements resonance. It implements the promiscuous phase.

It has no integration step. There is no settling. There is no suppression. A recall is a weighted sum over posting lists plus one hop, and whatever comes back comes back. The pronoun binder's hard filters — gender, `nonPersonal` — are suppression in a very thin sense, and the choice of best single hop rather than a sum is a normalization that prevents ubiquity from dominating, which is the closest thing in the codebase to Gernsbacher's mechanism. But there is no step in which a resolved binding dampens its competitor. Once *she* is bound to a referent, the runner-up's activation is untouched for the next sentence.

Three theories, developed independently over twenty years, all say the same thing: activation without settling is not comprehension. And the project's own measurement is quietly consistent with this. `recalled` — how many distinct prior frames answered — is the strongest channel at p≈0.005, and raw `activation` is one of the weakest at p≈0.431. The count of things that responded carries signal; the strength of the response does not. That is what you would expect from a system that constructs and never integrates: the magnitudes are unsettled, so only the crude fact of a response survives.

I would call this the single highest-value unbuilt thing in the reading path, and it is not a research problem. It is a known algorithm from 1988.

Zwaan and Radvansky, 1998, add the checklist. A situation model is indexed on five dimensions: time, space, causation, motivation, and protagonist. Readers track all five and show measurable costs at discontinuities in each. Against that checklist eoreader6 tracks protagonist (referents, well), something adjacent to causation (surprise and strain, indirectly), time only as reading order rather than as narrated time, and neither space nor motivation at all. That is not a criticism so much as a map: it says where the remaining organs go, and it says that "who is in this scene" — the part the project has invested in most — is one of five.

## VI. The bottleneck that killed all of them, and how the current era "solved" it

Every symbolic reader died of the same thing. Not of bad algorithms. Of not knowing enough.

Charniak's 1972 thesis was about children's stories, and the finding was that understanding *Janet needed money for the kite, so she shook her piggy bank and nothing came out* requires knowing that piggy banks hold coins and that shaking is how you get them out. That knowledge is not in the text. It is not derivable from the text. It has to come from somewhere.

Clark called this bridging inference. Every theory of comprehension since has required it. And every attempt to supply it has failed at scale or has been absorbed into weights:

- Hand-coding. CYC. Forty years, still going, still not enough.
- Distributional acquisition. Landauer and Dumais's LSA, 1997, titled *A solution to Plato's problem* — the claim that reading enough text gets you something like word meaning without a teacher. It works, partially, and it is the direct ancestor of everything since.
- Never-ending reading. NELL, from 2010, reading the web continuously, accumulating beliefs, using mutual constraints between categories and relations to bootstrap without labels. This is structurally identical to the corpus-fold and slow-dreaming design already on record here: read forever, accrete priors, consolidate. NELL's documented failure mode is semantic drift — beliefs gradually corrupt the extractors that produced them, which corrupt the next beliefs, and the loop requires periodic human intervention to stay sane. That is precisely the closed-loop self-confirmation risk already flagged in the dreaming design, and NELL is the empirical evidence that the risk is real rather than theoretical. The mitigation NELL used was mutual constraint between many simultaneous learners. The mitigation proposed here is ungated ballast and append-only prior versions. Neither is obviously sufficient.
- Absorb it. The current era's answer, which is to refuse the distinction between reading and knowing. An LLM does not read a document against a knowledge base; the knowledge and the reader are the same object. This works extraordinarily well and it is why the field moved.

The price of the fourth option is the thing that started this whole project: there is no ledger. You cannot ask which of its knowledge was used, or what it declined to conclude, or what it discarded. The reading and the knowing are inseparable, which is why the reading cannot be audited.

So the strategic situation is stark. The knowledge bottleneck is fifty-four years old, it defeated the symbolic era, it defeated Open IE's ambitions, it drove NELL into drift, and the only thing that ever beat it was giving up on separability. eoreader6's priors architecture — pockets, folds, installable corpora — is an attempt at option three with better bookkeeping. It is the right attempt. It is also the attempt on which the field's actual track record is worst.

## VII. What this project has that none of them had

Against all that, the honest inventory of what is genuinely new here, because it is not nothing and it is not the algorithms.

**Refusal as a first-class output.** Every system above produced answers. Some produced confidence scores. None produced typed refusals as a normal, expected, countable part of the output. `resolvePronouns` returns 638 bindings and 820 gaps, and the gaps are typed — `pronoun_no_margin`, `pronoun_below_floor`, `pronoun_no_candidate` — each carrying the number that failed and the bar it failed against. A MUC system that filled 44% of slots reported 44%; it did not report which 56% it refused and why. *A gap is a result* is not a slogan here; it is a return type.

**Provenance per datum.** Every binding carries its giver, its tier, and its basis. The reader can always distinguish a literal naming from a recall-bound pronoun. That is an audit trail at the granularity of the individual inference, and I cannot think of a prior system that had it. Knowledge Vault had confidence; PROV-O has provenance vocabulary; neither combines the two at inference granularity inside a reader.

**Nulls constructed from the material's own statistics.** Not fixed thresholds. Every promotion is gated against a null sized to its own candidate's extent. The project has caught itself four times with the same failure shape — a null proving not-chance without a companion test proving not-gameable-by-scale — and each catch is written down, including the one that falsely merged two Finnish brothers.

**A growth rule that binds its author.** Unwired is failing. That rule currently indicts the best measured thing in the project, and the indictment stands. The closest prior art is the LCF proof-kernel tradition and the de Bruijn criterion — architectures whose whole purpose is that the checker cannot be persuaded by how much you want the theorem. What is unusual here is that the checker is prose, and prose checkers are normally the corruptible kind. This one held.

And **pre-registration**. `reach` was predicted to spike at boundaries. It didn't. It is the second-weakest channel and the wrong prediction is in the results file. Machine reading, as a field, has approximately no tradition of this.

## VIII. So what do we actually need

Sorted by cost, honestly.

**Cheap, known, and missing — build these.**

1. An integration step. Kintsch 1988. A settling pass over the activation network after recall, in which mutually supporting activations reinforce and losers are damped. This is the gap three theories agree on, it is a forty-year-old algorithm, and the project's own channel measurements (`recalled` strong, `activation` weak) are the signature of its absence.
2. Suppression in the binder. Gernsbacher's mechanism, narrowly: a resolved binding damps its runner-up's activation for subsequent sentences. Currently the competitor is untouched, which is why 820 gaps are `pronoun_no_margin` — the margin bar is doing suppression's job statically and refusing rather than deciding.
3. Wire the reader-state ascent. `recalled` → Atmosphere → Lens. Free, closes the growth-rule violation, and it is the only ascent that works on agentless prose.
4. Regression. Re-reading the already-read prefix is legal under the causality invariant and is never done. Human readers regress constantly; eye-tracking says roughly 10-15% of saccades are regressive. A reader that cannot look back is modeling a constraint humans don't have.

**Hard, open research — decide deliberately whether to enter.**

5. Roles rather than positions. Fillmore's objection. The supervised answer costs an annotated corpus; the unsupervised answer is a live research area with modest results and no track record on the agentless register. This is the fifty-eight-year-old problem and it should not be entered casually.
6. Bridging inference / a knowledge source. The bottleneck that killed the symbolic era. The priors architecture is the plan. NELL is the warning.
7. Time, space, motivation. Three of Zwaan and Radvansky's five indices are absent. Each is its own organ.

**Already differentiating — protect these.**

8. Typed refusal, per-datum provenance, material-derived nulls, the growth rule, pre-registration.

And one structural decision that sits above the list: the two ascents are specialized for opposite genres. The structural ascent needs agents and works on narrative. The reader-state ascent needs pattern and works on the administrative record, which is formulaic precisely because it is institutional, which is what makes deviation legible. If the corpus is municipal, item 3 is worth more than item 5, and item 5 may not be worth entering at all.

## IX. The fifth definition

Back to the framing.

Reading was defined by paraphrase, then by template slots, then by span selection, then by human preference. Each definition was set by what could be scored, and each was gamed within a few years of becoming the scoreboard.

The definition implicit in eoreader6 is different in kind. Reading is accruing structure you can be held to. Not structure that is correct — correctness is not available, and the MUC annotators couldn't agree either. Structure that carries its own provenance, that names what it refused and why, that can be replayed against the ledger, and that fails loudly when its own null says it should.

That definition has one property none of the previous four had: it cannot be saturated by a better generator. You can produce a perfect paraphrase without understanding; you can fill a template by pattern; you can select a span from lexical overlap; you can produce responsive text at enormous scale. You cannot fake a ledger you did not earn, because the ledger is not the output — it is the record of how the output came to be, and forging it requires doing the work it records.

That is a real contribution and it is not the algorithms. The algorithms are Quillian's, and Fillmore's objection to the mouth still stands, and the knowledge bottleneck is still where it was in 1972. What is new is a reader that keeps books.

Whether a reader that keeps books but cannot bridge *Janet shook her piggy bank* counts as reading at all is the open question, and I don't think the project should answer it yet. Charniak asked it in 1972 and it is still the question.

But the accounting is new. And it is the part nobody else built.

## Standing gaps and provenance of this essay

Repo state: eoreader6 at `edab22a`. Repo claims are from direct inspection and from `scripts/RESULTS.md`, `scripts/EMBEDDING-FINDINGS.md`, `goldens/cast/`, and live runs of the pronoun conformance suite and `resolvePronouns` over the committed Frankenstein fixture.

Prior art is cited from memory and has not been re-read for this essay. Quillian's TLC (1969) and semantic memory (1966); Collins and Quillian (1969); Collins and Loftus (1975); Fillmore, *The Case for Case* (1968); Schank's conceptual dependency (1972) and Schank and Abelson (1977); Charniak's thesis (1972); Minsky on frames (1974); Winograd's SHRDLU (1972) and his later repudiation of the approach with Flores (1986); Lenat's CYC (1984–); the MUC series (1987–1998) and MUC-6's introduction of NER and coreference; Hobbs (1978); Grosz and Sidner (1986); Grosz, Joshi and Weinstein (1995); Kintsch and van Dijk (1978), Kintsch's CI model (1988), van Dijk and Kintsch (1983); Gernsbacher (1990); Myers and O'Brien (1996–98); Zwaan and Radvansky (1998); Landauer and Dumais (1997); Hirschman et al., Deep Read (1999); Etzioni et al. on machine reading (2006) and TextRunner (2007); Fader, Soderland and Etzioni, ReVerb (2011); Carlson et al., NELL (2010); Levesque's Winograd Schema Challenge (2011); Hermann et al. (2015); Chen, Bolton and Manning (2016); Rajpurkar et al., SQuAD (2016); Jia and Liang (2017); Titov and Klementiev and Lang and Lapata on unsupervised SRL (c. 2010–11); Elman (1990). Dates and attributions should be verified before any of this is published. The connections drawn between this literature and the engine's behaviour are mine and have not been checked against anyone else's reading of it.

Not established anywhere in this essay: that adding an integration step improves a clearing. That is a measurement, it has not been made, and the project's own discipline says an unmeasured organ claims nothing.

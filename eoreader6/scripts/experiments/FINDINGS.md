# Findings: from "does the engine's silence mean agentlessness" to instance-level role resolution

Record of one continuous line of work across two sessions and three repos
(`eoreader6`, `live_priors`, `eoPriors`), starting from a single question and
ending at a working mechanism. Written to be readable without the
conversation that produced it. `scripts/experiments/README.md` documents the
script arc in more granular detail; this document is the findings, in order,
plus what they imply for what happens next.

## 1. The question that started this

`goldens/agency-civic/` (merged, PR #44) asked: does **admitted-Link
density per clause** — whether `perceiver/text/relations.js::extractRelations`
finds a subject-verb-object triple in a clause — track whether a human
reader judges that clause to name who acted? If yes, the engine's silence on
a clause is a *reading* (the document declines to say who acted). If no, the
silence is just the mouth's own word-order prior failing to fire, and every
claim built on Link occupancy in civic text is unsupported.

**Result: not supported.** Against a 4-annotator LLM-panel proxy (κ = 0.92,
explicitly not a human ceiling — panel agreement runs higher than
independent humans would), the correlation between engine admission and
panel-majority NAMED judgment was phi = 0.109, not significant
(chi-square = 2.01), driven by 87% recall loss (124/143 panel-NAMED clauses
got no admitted Link at all) rather than a length/nominal-density confound.
**Most of the engine's silence on civic clauses is the SVO regex's
word-order requirement missing ordinary syntax — relative clauses, fronted
adverbials, coordinated verb phrases, modal-plus-infinitive predicates
("wishes to amend," "is considering referring") — not genuine
agentlessness.**

## 2. Roles, not slots — the reframe

The recall failure has a specific shape: `extractRelations` requires a
**contiguous, complete** subject-verb-object match, treats "agent" as a
**position** (whatever sits before a single-token verb), and needs **both**
sides filled to admit anything. A human reader doesn't parse this way —
verb argument structure is accessed with the verb, and voice/modal
morphology is a *rule that reassigns roles*, not a wall. The fix isn't a
bigger regex (relations.js's own history already tried and refused
enumerating more SVO shapes once). It's treating "agent" as a **role** — a
functional slot in an event's argument structure — rather than a **slot** —
a literal token position — and discovering which spans fill which roles by
recurrence, the way `emergence/kinds.js::induceKinds` already clusters
relation-term records by shared structural attributes (profile-Jaccard, two
Born gates, height discovered), never by asserting what the categories are
in advance.

## 3. The role-fold experimental arc (`scripts/experiments/`)

Six scripts, each a correction of a defect the last one's real output
revealed — full detail in `README.md`. Summary of the throughline:

| script | what it tried | what happened |
|---|---|---|
| `role-fold-kinds.mjs` | reused `extractRelations` as the candidate generator | worked, but silently reimported the SVO word-order requirement — noise (discourse markers, citation fragments) admitted as false fillers. **This defect is now `eo-constitution` Article II.17, the signal-preservation test — drafted and merged.** |
| `role-fold-kinds-v2.mjs` | order kept as a measured feature, never a hard gate or pre-assigned label | fixed the overcorrection risk (dropping order entirely would discard real signal — order does correlate with role in English) |
| `role-fold-kinds-nest.mjs` | recursive sub-clustering inside each surviving kind | found no nesting at any scale — root clusters never certified `height=above`, only `unstable`, at 40 and 150 pocket documents |
| `role-fold-kinds-v3.mjs` | pooled function-word derivation + a disclosed received closed-class list (II.2 — a small function-word set is a legitimate named-giver prior) | cleaner output, **still `unstable` at every scale tried** |
| `role-fold-verb-island.mjs` | stopped pooling across hundreds/thousands of verbs before clustering (the prior scripts asked for cross-verb abstraction from the start — Tomasello's verb-island evidence says that's backwards: children have per-verb frames long before anything general) | **the turning point.** Nearly every single-verb island reached `height=above` immediately — real signal (BIA/EPA/FAA/Commission as `"has"`'s subjects; passive past-participles "accompanied/accredited/adopted/completed/defined" immediately before `"by"`) |
| `role-fold-tp-chunk.mjs` | candidate fillers as variable-length transitional-probability-bounded spans (Saffran/Aslin/Newport: infants segment speech using only conditional probability, boundary = local dip) instead of fixed-window single tokens | recovered genuine multi-word institutional phrases no prior version found ("Director of OWCP," "European Union Aviation Safety," "NIOSH-certified respirator") |

**Cross-island convergence** (do the same fillers recur across multiple
independently-certified verb islands?) is real for single tokens — at 250
documents/20 verbs, the convergent core (FDA, NHTSA, EPA, FAA, OWCP,
Commission, Department, Exchange, applicant) got *cleaner*, not just bigger,
as pocket size grew. It is **not yet real for multi-word spans** — only 2/69
convergent fillers were multi-word, and both were noise. Read correctly this
is not a failure: a specific 3-4 word phrase recurring verbatim near many
*different* verbs is a much higher bar than a single high-frequency token
clearing the same bar, and 250 documents isn't enough evidence yet for most
multi-word units to clear it — consistent with type-frequency (not token
frequency) driving productivity (Bybee).

## 4. External validation: does the discovered structure line up with a real POS standard?

Installed `nltk`'s averaged-perceptron tagger and the Brown Corpus (which
has a `government` category — a genuine classic hand-tagged reference in
the same register) as **external, disclosed validation only** — never fed
into induction. Result: **most position-clusters score 80-100% NOUN purity**
against the independent tagger, unprompted. The informative low-purity tail
(`"by" near-before` at 48%, `"has" near-after` at 53%) isn't noise — those
are passive-participle and present-perfect complement positions, and the
tagger correctly finds them grammatically mixed. The purity metric's
disagreements land exactly where a linguist would predict variability, not
where the method happens to be weak.

## 5. The correction that mattered most: type vs. instance

Aggregating a word's occurrences into one type-level tag histogram and
asking whether *the word* resolves is the wrong question, and it was a
regression from what the verb-island/TP-chunk scripts were already doing
correctly. **A surface span is never the thing with a part of speech — the
referent is.** "by" is not objectively a preposition, an agent-marker, a
locative, or anything else; a given *instance* of "by" already is one of
those things, and the honest state before enough context has arrived is
superposition (several live candidates, each with its own standing to be
tested), never an averaged 55/45 split across all its uses. `covered`,
`register`, `present`, `cause`, `call`, `see`, and ~140 other surface forms
were flagged this way — real evidence that these forms cover multiple
distinct referent-functions, mislabeled by treating the *word* as
ambiguous rather than the *population of instances* as heterogeneous.

## 6. `resolveSpanRole` — instance-level superposition, collapsed causally

Built as a direct sibling to `perceiver/text/pronouns.js::resolvePronouns` —
same shape, re-targeted, `emergence/activation.js` reused completely
unmodified:

- **Causal, never batch.** Walks sentences in reading order; a span's
  candidate kinds are built only from what the reading has evidenced so
  far.
- **Collapse is activation-gated, never majority-vote.** One-hop recall
  (`codeOf`/`recall`) against prior frames, `minActivation`/`minMargin`
  floors (restated at the same values `host/corpus.js` already declares for
  pronoun resolution — not re-derived, not re-tuned), typed gap otherwise.
- **A resolved instance can prime later ones, but isn't guaranteed to.**
  Encoded into the same per-frame evidence set every other kind-marker
  uses; a later instance still has to clear its own margin independently.

Run against 250 real pocket documents with a minimal 2-kind registry
(`actor` / `predicate-complement`, built from `role-fold-verb-island`'s own
saved output): 8,152 instance-level resolutions, 25,111 typed gaps (stayed
plural — the large majority, honestly). 126 surface forms resolved to
**both** kinds on different real occurrences — "commission" as the subject
of "offers" (actor) vs. inside a passive construction (complement);
"operator" as a free subject ("any operator... will submit") vs. inside the
proper-noun compound "Independent System Operator" (complement); same
surface form, opposite grammatical position, resolved instance-by-instance,
never averaged.

## 7. Sibling repos found mid-session, not yet fully reconciled

- **`live_priors`** — the actual pocket corpus. Started at 9 Federal
  Register documents (873 words total, mostly API abstracts — the
  `fetch-government.mjs` script was hitting a bot-gate and silently falling
  back to short abstracts). Fixed via `raw_text_url` (ungated plain text)
  and expanded to 600 real documents, 2.63M words
  (`scripts/fetch-federal-register-fulltext.mjs`, committed there). The
  user separately expanded `06-government-legal` further to 28
  jurisdictions (world-legislation, UDHR, world factbook) — not yet used in
  any role-fold run.
- **`eoPriors`** — two things found here, neither yet reconciled with this
  work:
  - `priors/coref/*.json` — hand-curated, real coreference/narrator-scope
    goldens for four books (Frankenstein, KJV Bible, Pride & Prejudice, War
    & Peace). **Not yet used to score the current engine's referent
    extraction against known-correct answers.**
  - `src/kind-vocabulary/` and `src/role-expectation.js` — a **formal spec
    for almost exactly what `role-fold-*.mjs` prototypes**: `Pocket@1`
    (distribution-only, firewalled against ever carrying raw text —
    confirms the `role: 'corpus'` sealing pattern referenced early in this
    work is real, just lives in this repo), `KindVocabulary@1` with a
    *structurally* enforced naming/induction separation (a test greps the
    induction module's imports to prove naming can never read into
    induction — the same "engine induces the class, never names it"
    principle this work adopted independently, enforced more strongly
    here), and `RoleExpectation@1` with real readiness gates (Good-Turing
    singleton rate, held-out delta tolerance). **The actual induction
    algorithm (`induceEntityKind`) is explicitly marked incomplete,
    depending on something called "eoreader5"** — not accessible in this
    session's repo scope, not yet investigated.

## 8. Cross-linguistic testing (`role-fold-cross-lingual.mjs`)

Every mechanism above was measured only against English. II.11 (the
omnimodal earning test) says medium/language-agnosticism is *earned by a
test*, never assumed — so this ran one, against `live_priors`'s
`world-legislation` pockets (English/US, French, German, Finnish — same
legal/regulatory register the original role-fold pocket is, so a difference
is not a new genre entering the comparison).

**A real corpus defect was found and had to be worked around first.** The
obvious first choice — `live_priors/11-multi-language/gutenberg-non-en`, a
per-language folder of Project Gutenberg novels — turned out to be
mislabeled at scale: a language check (grepping each file's own midpoint for
its dozen most common function words) found every file except French's
*Madame Bovary* is majority-**English** at its midpoint, not the labeled
language. `fr/pg15807_Nana.txt` is not Zola's *Nana* at all; it is an
unrelated English book ("Among the Forces," Henry White Warren) — wrong
content, not just an uncleaned English header. Running a cross-lingual test
against silently-wrong-language material would have produced a false
negative dressed as a null result, so the pocket was verified and switched
rather than silently absorbed — the same discipline
`goldens/agency-civic/provenance.json` already applied to a corrupted PDF.

**Three predictions, stated before running, against `extractSurfaces`'s
capitalisation gate, `discoverRelationVocab`'s word-order-dependent
generator, and `induceKinds`'s language-blind clustering:**

| lang | words | surfaces/1k words | verbs/1k words | kinds reaching `height=above` |
|---|---|---|---|---|
| en | 125,997 | 19.03 | 0.317 | 21/21 |
| fr | 254,015 | 0.98 | 0.051 | 23/24 |
| de | 164,313 | 43.01 | 7.072 | 22/30 |
| fi | 61,820 | 12.07 | 0.421 | 5/5 |

1. **Confirmed, decisively.** `extractSurfaces`'s admission gate treats
   "never seen lowercase" as the strongest evidence of namehood
   (surfaces.js: "nothing left to test against"). That inference only holds
   if a language capitalises names and not common nouns — German capitalises
   *every* common noun. Predicted German would show a false-positive
   admission rate no other language would; measured, German's rate (43.01/1k)
   is **2.3× English and 44× French**, and the sample admitted "surfaces" are
   almost entirely ordinary German nouns — *Arbeitnehmer* (employee),
   *Arbeitszeit* (working hours), *Grund* (reason), *Zeit* (time), *Wochen*
   (weeks) — not one plausible proper name among them. The mechanism does
   exactly what its own documented assumption predicts when that assumption
   is false.
2. **Not confirmed as stated — and the reason ties directly back to
   finding 1.** Predicted French (SVO like English) would show a comparable
   verb-yield to English, with German and Finnish showing a measurable drop
   from case-marking/free word order. Instead French came in *far below*
   English (0.051 vs 0.317) and German *far above* (7.072 — 22× English).
   The likely reason: `discoverRelationVocab`'s candidate generator is
   "the token immediately following an admitted surface" — so its yield is
   downstream of finding 1's contamination, not an independent measurement
   of word order. German's 7,067 admitted "surfaces" (mostly common nouns)
   hand the generator thousands of anchor points a real name-only surface
   list never would, and German main clauses genuinely are V2 (verb-second),
   so "verb immediately after the first constituent" fires very often once
   almost every noun counts as a constituent-starter. French's sparse,
   name-only surface list (250, the smallest of the four) gives the same
   generator very little to anchor on, independent of French's word order
   being SVO. **This metric is not clean evidence about word order on its
   own** — a fairer follow-up would normalize verb yield per admitted
   surface, not per 1,000 words, before drawing a word-order conclusion.
3. **Confirmed — the actual omnimodal claim under test.** Predicted that
   `induceKinds` itself, once candidates reach it, should cluster by
   structure the same way regardless of language, because nothing in its
   profile-Jaccard + Born-gate logic reads a word. Measured: every language
   reaches `height=above` at 73-100% of surviving kinds (en 21/21, fr 23/24,
   fi 5/5, de 22/30 — de's lower rate is consistent with finding 1+2's
   noisier upstream candidates reaching it, not with the organ itself
   varying by language). This is the concrete version of the mouth/organ
   split the whole role-fold arc has been arguing for: `relations.js` and
   `surfaces.js` are medium/language-specific *by construction* (relations.js
   says so in its own header) and should misbehave predictably when a
   language violates their orthographic assumptions; `kinds.js` should not
   misbehave that way, and — as far as this one test can tell — doesn't.

**Disclosed limits of this test, honestly, not smoothed over:** the
word-budget (150k words/language, to control the Heaps'-law confound where
a smaller corpus inflates "distinct surfaces per 1000 words" regardless of
language) worked for en/de/fi but not fr — a single French code document
already exceeded the budget, so fr's actual sample is 254k words, larger
than the other three. The gap between fr and en is far too large (19× on the
surfaces metric) to be a pure artifact of that mismatch, but it is not
perfectly controlled. Each verb island was also capped at its 200
most-recurring fillers (`MAX_FILLERS_PER_ISLAND`) purely for tractability —
French `"qui"` had 448 candidate fillers before the cap, German `"über"` had
241 — the same principled floor-raising `role-fold-verb-island.mjs`'s own
README already names as a real tightening, not just a perf hack, disclosed
here the same way. Finnish's result is the thinnest: the whole `fi`
world-legislation pocket is only 61,820 words (not budget-limited — that's
everything available), and 3 of 8 verb islands had too few fillers
(4-9 each) to reach `induceKinds`'s `minKindSize` floor at all.

## 9. Where this could port across modalities

`goldens/multimodal/` (this repo, already built and run, not new this
session) already answers the literal question for the boundary-detection
organ one level below this one: `loops/turn.js::runTurn`'s causal
ground/pattern mechanism was measured on real synthesized audio (RMS
energy), image (scanline luminance), and video (frame-difference motion
energy) and found the transition in all three, within tolerance, by
**surfeit** — the same signature `RESULTS.md` documents for text. The
`goldens/surprise` batch-shuffle-null detector was run on the identical
three materials and found nothing on any of them — the same
(statistic, perturbation)-pair confound `goldens/surprise/README.md`
documents for text (B1/B4), reproduced a third and fourth time on pixels and
motion. That result is genuine plumbing-level omnimodality, already earned,
not a claim this session adds to.

**The role-fold/verb-island/`resolveSpanRole` line sits one level above
that** — it depends on `relations.js`'s SVO extraction and `surfaces.js`'s
capitalisation gate for candidate generation, both of which §8 just showed
are medium- AND language-specific by construction, not just medium-specific.
Porting the *induction step* (`induceKinds`, the part §8 found genuinely
language-blind) to a non-text modality needs a modality-appropriate
candidate generator standing in for `discoverRelationVocab`/`extractSurfaces`
— not a text mechanism forced onto different material. Concretely, by
modality:

- **Audio.** The candidate-generation move that worked for text
  (verb-island: hold one frequent, recurring unit fixed, cluster only ITS
  own neighbours) has a real audio analogue — a recurring motif or cadence
  figure (already the kind of unit `perceiver/audio/material.js`'s RMS
  reduction could support onset-detection over) standing in for a verb,
  clustering the figures that recur immediately around it. Whether that
  yields anything is untested — this is a real next step, not a result.
- **Image/video.** A visual analogue of "verb" is less obvious than for
  audio (audio and text share linear time; an image does not have an
  obvious single ordering axis for a "near-before/near-after" window the
  way verb-island's bucketing does). Video's frame sequence restores a time
  axis, so a recurring visual event (a cut, a consistent camera move) is the
  closer analogue to a verb-island anchor than a static image region is.
  This is speculative and untested, flagged as such rather than asserted.
- **What should NOT be expected to port unchanged:** `extractSurfaces`'s
  capitalisation gate is a fact about ONE WRITING SYSTEM's orthography
  (§8 finding 1 is the proof it isn't even a fact about all *text*).
  Whatever a non-text "surface" detector looks like, it has to be a real,
  separately-earned mechanism for that modality's own regularities — not a
  restatement of "capitalised run" in another vocabulary. This is the same
  point `eo-constitution` Article II.11 already states as the rule (medium-
  agnosticism is earned by an invariance fixture, never asserted); §8 is a
  second, independent confirmation of it, this time WITHIN one modality
  (text) rather than across modalities — English/French's relatively
  language-general capitalisation behaviour was never evidence the
  MECHANISM itself was language-general, and this test is the reason to
  believe that, not just an assumption carried over from `goldens/multimodal`.

**Net:** the boundary-detection organ (`runTurn`) has real, measured,
omnimodal standing. The role-induction organ (`induceKinds`) has real,
measured, cross-lingual standing as of §8. The MOUTHS that feed candidates
to `induceKinds` (`relations.js`, `surfaces.js`) are real but earn their
standing per-medium-per-language, one at a time, the same way `runTurn`'s
own mouths (`perceiver/{audio,image,video}/material.js`) already had to be
built and tested separately rather than assumed. Nothing here claims a
role-induction mouth for audio/image/video exists yet — it doesn't.

## 10. Constitutional record

`eo-constitution` Article **II.17, the signal-preservation test** — drafted
mid-session from the exact defect in §3's first row (a reused mechanism
silently importing an axis requirement its consumer was built to avoid),
proposed as `AMENDMENT-12-PROPOSAL.md`, **since merged** by human disposal
(PR #5). Live constitutional text now, not a draft.

## 11. What needs to happen next for development

Roughly in the order they'd actually unblock each other, not in order of
interest:

1. **Read `eoPriors`'s spec docs** (`docs/03-prior-spec-kind-vocabulary.md`,
   `docs/04-engine-spec-entity-kinds.md`, referenced but not yet read) and
   determine whether "eoreader5" is a real, accessible repo. If
   `induceEntityKind`/`EntityKindCandidate@1` already exists there in a
   usable form, `role-fold-verb-island.mjs`'s hand-rolled induction may be
   duplicating work with a less mature contract — reconcile before building
   further, not after.
2. **Reshape `role-fold-*` output to actually publish against
   `KindVocabulary@1`/`RoleExpectation@1`** if (1) confirms that's the
   intended target contract — `src/kind-vocabulary/induction.js` already
   accepts hand-constructed candidate records shaped like
   `EntityKindCandidate@1`; the verb-island/TP-chunk scripts' output is
   close to that shape already and could likely be adapted rather than
   redesigned.
3. **Score the current engine's referent/coref extraction against
   `eoPriors/priors/coref/*.json`** — a real, independent accuracy check
   that hasn't been run at all yet, orthogonal to the role-fold line but
   sitting right there unused.
4. **Widen `resolveSpanRole`'s kind registry** past the current 2 coarse
   kinds (`actor`/`predicate-complement`) — built as a minimal
   proof-of-mechanism; a richer registry (drawn from more verb islands, or
   from whatever `KindVocabulary@1` ends up publishing) is the natural next
   scale-up, not a redesign.
5. **Re-run cross-island multi-word convergence at real scale** — the null
   result in §3 is evidence-limited, not a finding that multi-word
   abstraction doesn't happen; the 600-document (or 28-jurisdiction)
   `live_priors` pocket is already available and hasn't been pointed at
   this yet.
6. **Build a real, non-capitalisation surface detector for German** (§8
   finding 1) — the cleanest, most concrete next step this session's
   cross-lingual test produced. `extractSurfaces`'s significance test
   (`capitalisationIsSignificant`) already exists for the ambiguous case
   (a word seen both capitalised and lowercase); what's missing for German
   is any signal at all for the word seen ONLY capitalised, since German
   orthography makes that the norm rather than the exception. A real fix
   needs a language-specific-but-disclosed prior (II.2 — same tier as the
   received function-word list) naming which German nouns are common vs.
   proper, or a different, non-orthographic feature entirely (case-marking
   morphology, article-gender agreement) — not attempted here, flagged as
   the concrete next build.
7. **Normalize `discoverRelationVocab`'s cross-lingual yield metric per
   admitted surface, not per 1,000 words** (§8 finding 2) before drawing any
   further word-order conclusion — the current metric conflates the
   candidate-generator's yield with finding 1's surface-admission
   contamination and cannot isolate a word-order effect on its own.
8. **A role-induction mouth for a non-text modality does not exist yet**
   (§9) — `goldens/multimodal`'s boundary-detection result does not carry
   over to role/kind induction automatically; building and testing a real
   candidate generator for at least one non-text modality (audio motif
   islands is the closer analogue) is the concrete next step for the
   omnimodal claim at THIS level, not an extrapolation from the boundary
   result.
9. **None of this is certified.** No rotation control, no inter-annotator
   ceiling, no partial correlation — the whole role-fold line is upstream
   of `goldens/agency-civic/`'s own discipline, still at "does structure
   exist at all" stage. Before any of it is used to make a claim about real
   civic text (as opposed to a claim about the pocket), it needs the same
   treatment `goldens/agency-civic/` already got: a real human-annotated
   ceiling (not the LLM-panel proxy), a rotation control run against
   whatever the final mechanism is, and a report of what it would take to
   move a clause from "engine silent" to "engine resolved" in the original
   agentlessness-meter sense this whole line of work grew out of.
10. **Growth rule.** Nothing here has earned a place in `packages/engine`
    (`IV.3` — unwired is refused, not early). Before anything graduates out
    of `scripts/experiments/`, it needs the level test: does it return
    `above` against the core, not just against its own prior version.

## Status

Everything in `scripts/experiments/` is committed (PR #45 and #46, merged),
including `resolve-span-role.mjs`, `role-fold-cross-lingual.mjs`, and their
outputs. A defect found and fixed in review before #46 merged: two
committed data files were carrying verbatim corpus sentence text (a Pocket
firewall violation, §7's `eoPriors` precedent); both scripts were fixed to
stop persisting source text, and one file was moved to gitignored/regenerable
status — see PR #46's history for the corrected form, the lesson (never
commit a corpus's own text into a derived golden) now applies to every
script in this arc, including this one. `live_priors`'s fetcher and corpus
expansion are committed there directly (not part of this repo); its
`gutenberg-non-en` pocket has an open, disclosed, NOT-yet-fixed mislabeling
defect (§8) that should be reported/fixed there before it is trusted for
anything else. `eo-constitution`'s II.17 is merged. `eoPriors`'s coref
goldens and `KindVocabulary@1`/`RoleExpectation@1` spec are read but not yet
acted on — item 1 above is the actual next step, not a continuation of the
current line without checking it first.

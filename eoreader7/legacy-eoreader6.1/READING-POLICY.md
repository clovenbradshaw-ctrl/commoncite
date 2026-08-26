# Reading Policy

How this system reads. This is policy, not description: where a rule below
and a driver disagree, the driver is wrong.

It exists because "reading" has been under-claimed and over-claimed in the
same week — a co-occurrence golden reported as if it were the whole
instrument, then an activation window enlarged to fix what was never a
memory problem. Both mistakes are cheap to repeat and expensive to detect,
because the conformance suite stays green through either one.

---

## P0 — Reading is an assembly, and the assembly is named

There is no `read(book)` in `packages/engine`. Its public surface
(`packages/engine/index.js`) is `INDIVIDUATION_TYPES`, `projectReferents`,
`coverageReport`, `judge`; `package.json` exposes ~20 organs as subpaths. The
engine offers organs. Assembly happens one tier up.

**The assembled reader is `packages/host/`** — `createSession` /
`admitChunked` / `sessionReferents` / `sessionRelations` in `corpus.js`,
retrieval in `surfer.js`, altitude in `tiers.js`, the reading record in
`reading.js`. `host/corpus.js::discoveredCast` is the one path that chains
surfaces → referents → **pronoun binding** → relation vocabulary in the order
those organs actually compose. Drivers that hand-chain engine organs
(`scripts/read-*.mjs`) are experiments, each asking one question; they are
not the reader and several predate organs the host already wires.

**Policy.** Read through the host session unless you are deliberately
isolating one organ. Any claim about "what this system can do" must name the
assembly it was measured on. Stopping at a co-occurrence golden and calling
it reading under-claims exactly as badly as citing the full chain for a run
that used two stages of it over-claims.

---

## P1 — Activation decays. Identity does not. Recall is retrieval.

**This is the load-bearing rule and the one most recently violated.**

Three different things are constantly confused for one:

| | mechanism | behavior | file |
|---|---|---|---|
| **Activation** | `gammaFor(w) = 1 − 1/w`, applied to every belief once per fold step; `pruneBelow` deletes | *decays, and re-zeros* — by design | `emergence/graph.js`, `emergence/tiers.js` |
| **Persistence** | the admitted spans, the provenance registry, byte offsets | *never forgets anything* | `host/corpus.js`, `provenance/` |
| **Retrieval** | address ladder + Born-gated confirmation, widening by the document's own score spread | *brings a being back to form on re-mention* | `host/surfer.js` |

A character who leaves for 200 pages **is not forgotten**. Their activation
decays to nothing — correctly — and the reading regime re-zeros
(`loops/reading-regime.js`; `records[i].rezeroed`, read by
`surfer.js::distanceSinceRezero`). When they are next named, retrieval brings
them back: `executePrompt`'s ladder (SOURCE → HEADING → CONTENT → WINDOW,
"never fabrication") and `wayfind`'s escalation, both grounded in the same
one-hop activation recall (`emergence/activation.js`) that
`perceiver/text/pronouns.js` uses to bind a pronoun to a referent.

**Policy.**

1. **Never enlarge the activation window to fix a recall failure.** The
   window is the reach of the present, not the size of memory. Enlarging it
   to span a book does not give the reader a better memory; it destroys the
   contrast that makes surprise measurable, because everything stays hot and
   nothing is ever new. If beings are not coming back, the defect is in
   retrieval or in coreference — fix it there.
2. **Never carry a window across books.** `w=12` was calibrated on
   Frankenstein (~1,000 frames) where it holds ~10.6% of the book in
   activation. The same 12 on War and Peace's 5,705 frames holds 1.9%, and
   folded per-sentence instead of per-frame, 0.31%. Same constant, three
   different mechanisms. The fold unit and the window are declared per
   reading, against that material's own extent.
3. **`distanceSinceRezero` widens a noise floor; it never picks a winner.**
   Any use of regime state to prefer a candidate is a violation.
4. **Void is an answer.** `wayfind` returning `wayfinder.void: true` after
   `maxRounds` is a correct result with the widest pool attached — never a
   reason to lower the gate until something is confirmed.

---

## P2 — What a reading actually consists of

Seven stages. A run reports which it used; unused stages are not implied.

1. **Perception.** Statistics derived from the material, not lookup lists:
   surprisal against the text's own frequency table, a Zipf-derived relevance
   threshold in place of a stopword list (`perceiver/text/material.js`),
   sentence and abbreviation detection derived the same way
   (`perceiver/text/spans.js::deriveAbbreviations`), a binomial significance
   test on capitalized runs and IQR-derived fences separating individuating
   names from titles (`perceiver/text/surfaces.js`).
2. **Witnessed admission.** A candidate becomes an entity only through
   `referents/entity.js::admitFromArrivals`: a declared minimum-arrival
   floor, a conditional null built only from material already read
   (`groundUpTo` never slices forward), and an early/late split asking
   whether the late half moved the ground further than reseeding noise — all
   combined through `witness()` (`nul/index.js`) or refused.
3. **Alias resolution.** Spelling-based name-variant coreference
   (`surfaces.js::discoverReferents`), then a second pass merging by arrival
   *shape* — segregation and displacement, never string comparison
   (`referents/consequence.js`, `referents/cooccurrence.js`).
4. **Pronoun binding.** `perceiver/text/pronouns.js::resolvePronouns`, by
   one-hop activation recall against what has been read so far — never
   nearest-name. `minActivation` / `minMargin` are declared, never defaulted.
   Descriptor synonymy ("the creature" ≈ "the wretch") is **out of scope** and
   closes only by prior (P3).
5. **Typed, directional relation.** SVO triples with polarity
   (`perceiver/text/relations.js`) into the decaying belief graph
   (`emergence/graph.js`); `emergence/binding.js` then tests each pair by
   displacement null (is the co-arrival real), transfer entropy (does A
   predict B's next step), and a reversal null (does the asymmetry clear
   significance) before direction or polarity is assigned.
6. **Altitude.** `emergence/tiers.js` folds atmosphere → lens → paradigm as
   the same recursive surprise test at increasing scope, gated against a
   prior-continuation null, propagated upward only if the tier below passed:
   *a paradigm shift is an event that survived being surprising all the way
   up.* On refusal, `emergence/paradigm.js` unravels and re-zeros rather than
   stretching the old paradigm over new material.
7. **Population.** Before anything is induced *over* the beings, the
   population is closed: which of the discovered referents are beings at all.
   `host/corpus.js::classifyIndividuation` types each one (holon / emanon /
   protogon / field / apparatus) from mass, coupling and agency evidence
   already assembled, and returns `null` where evidence is genuinely
   insufficient. This stage is **not optional and not a sort** — measured
   (P6.1), skipping it is what makes kind induction return "mentioned once"
   as its dominant finding.
8. **Kind.** `emergence/jati.js` (`deriveBeingRecords` → `understand` →
   `foldHolons`) over `emergence/kinds.js::induceKinds` (SIG → CON → EVA →
   DEF, two Born gates). `understand` first asks whether a **received** kind
   vocabulary already covers this population and only invents when none does.

The output shape of a reading is `reading/index.js` — per-terrain lens
results at one declared cursor. It renders nothing.

---

## P3 — Three kinds of prior, and the rule for each

A prior is received knowledge. It carries a `giver` and it is **injected,
never derived** — `host/corpus.js`: *witness knowledge is received, not
competed with*; a prior wins every surface it names.

1. **Language priors** (`bin/priors/lang/en.json`, `perceiver/text/priors.js`,
   giver `lang/en` / `script/latn`) — abbreviations, closed-class sets.
   `deriveAbbreviations` is a floor and a fragile one; inject the prior when
   the language is known. A Basque or Russian prior is a **different file**,
   never an extension of `en.json`.
2. **Per-text coref priors** (the `pg84-frankenstein.coref.json` shape) —
   which surfaces predicate one being, and which narrator owns "I" in which
   span. This is the model-tier judgement `surfaces.js` declares the engine
   **must not** derive. Without it, a protagonist fragments across their own
   names and the run measures the missing prior, not the engine.
3. **Kind vocabularies** (`KindVocabulary@1`, checked by
   `jati.js::checkKindPrior`) — what the reader already understands a
   population to be, from having read other material. Absent one,
   `understand` returns *invented*, which is an honest verdict, not a
   fallback.

**Policy.** State which priors were injected in every reported run. A result
produced with an empty coref prior is a result about an unprimed reader.
Never patch a missing prior by loosening an engine gate.

---

## P4 — Numbers are declared, gaps are results

Every organ that takes a threshold requires it explicitly — `createGraph`
demands both `gamma` and `pruneBelow`; `resolvePronouns` throws without
`minActivation`/`minMargin`; `checkKindPrior` distinguishes an empty prior
list ("a claim") from a missing one. Where a constant can be derived from the
material, derive it (`gammaFor(window)`, the IQR fences, `wayfind`'s
coefficient-of-variation step) rather than hand-picking it.

A gap is a result. `nul/index.js` carries a closed `GAP_TYPES` vocabulary;
`degenerate_ground` on a field, `missing_kind_prior`, `cast_truncated`, and
`wayfinder.void` are findings to report, not errors to suppress. Zero kinds
from a population that genuinely has no spread is the correct answer — and
`kinds.js`'s `searchCohesions` exists specifically because a naive
value-channel induction *confabulated* three kinds where there was one
regime.

---

## P5 — Anti-regression

Earned the hard way, each from a real failure:

1. **A rename must sweep `scripts/` and `goldens/`, not just `conformance/`.**
   The `people/voice/family` → `jati/shabda/samanya` rename updated the tests,
   the operator roster, and the module manifest — and left six drivers
   importing modules that no longer existed. The suite stayed green at
   1042/1044 the entire time. **Conformance passing is not evidence the
   readers run.** Before landing a rename, resolve every relative import in
   the repo and run at least one driver end to end.
2. **Normalize line endings before computing offsets.** A CRLF source read
   with `\r\n`→`\n`-normalized offsets but re-sliced against the raw bytes
   drifts one byte per line, cumulatively. Byte-offset self-verification is
   mandatory for anything that emits a seekable address; `0/57 verified` is
   the shape of this bug.
3. **Strip container boilerplate.** Project Gutenberg front and back matter
   parses cleanly and will dominate a belief graph with license prose if left
   in (`spans.js::stripContainer`).
4. **Report the fold unit.** Per-sentence and per-frame folding differ by ~6×
   in decay pressure. A run that does not state its unit is not reproducible.
5. **When a result surprises you, check the driver before the theory.**
   Every anomaly in this document's history was a driver defect —
   a stale import, an unstripped container, a raw-text field where referent
   ids were expected — not a finding about the material.

---

## P6 — What is proven, and what is not

Honesty about scope is part of the policy.

**Proven on external ground truth:** character-network recovery against
third-party hand-built networks (Les Misérables, Huckleberry Finn, David
Copperfield, 37 Shakespeare plays — `goldens/network/`); chapter-boundary
detection beating a rotation null (`scripts/RESULTS.md`); modality-general
boundary detection on audio, image, video, and turbulence series.

**Mechanically real but unscored:** direction, polarity, and verb-typed
relations (the network golden's references are undirected, so they cannot
check it); tiered altitude on a novel; kind induction over a pooled corpus.

Reference run, War and Peace (Maude, PG#2600), full chain with all three
priors injected — 34,214 sentences, 884 blind referents, 53 prior referents,
2,872 pronoun mentions bound / 11,638 unresolved, 1,786 verbs measured:
**339 nodes, 846 persisted SVO relations, 1,144 binding links of which 193
carry direction and polarity at p<0.05.** The SVO layer is thin (2.1%
admission) and carries visible parse artifacts where a name spans the verb
slot; the binding layer is the substantive product. Activation at end of
reading was 119 live edges — the reach of the present, never to be exported
as "the graph" (P1).

**Known-open, by the code's own admission:** descriptor synonymy; number-
ambiguous pronouns; capitalization-as-namehood, which `perceiver/text/proper.js`
states fails outright in German; SVO word-order assumption in `relations.js`
("medium-specific by construction"); `induceKinds` going silent on
non-text-shaped data — *text is the special case*.

### P6.1 — Kinds need discriminating FIELDS, not more records

`jati.js::deriveBeingRecords` emits exactly four numeric fields per being —
`relations`, `partners`, `subject_share`, `negated_share` — so every record in
any pool carries an **identical key profile**, and `negated_share` is
degenerate in practice (measured across nine domains: zero interquartile
spread everywhere, because `relations.js` almost never assigns negative
polarity). Three live numeric fields, same keys for everyone.

That is precisely the shape `goldens/kinds/README.md`'s own results table
records as the failure case: at full key overlap, `symphony`, `photograph`
and `table` recover 4 kinds at ARI 1.000 from 32 records, while **`prose`
recovers 0 from the same 32**. Discrimination there rides entirely on the
value channel, and a being-record's three summary numbers do not carry it.

**Measured, this session.** A pooled population of **423 being-records across
9 domains** (literature ×2, encyclopedic, academic, source-code,
multi-language, holy-texts, plus audio) induced **0 kinds** — the same result
as one book's 78 records. Scaling the corpus 5× changed nothing, because
pooling adds records, never fields.

**Policy.** Do not answer "no kinds induced" by enlarging the corpus. Ask
first whether the records carry values that could separate anything. Report
field count and degenerate fields alongside any kinds result.

**Corrected by measurement — purity outranks enrichment.** The above was
tested directly on the War and Peace reading (339 records from the persisted
ledger), three conditions, `induceKinds` unmodified in all three:

| condition | fields | records | kinds | quality |
|---|---|---|---|---|
| baseline (as `deriveBeingRecords` emits) | 4 (1 degenerate) | 339 | 1 | binning: `relations=3`, 29 members |
| enriched | 13 (4 degenerate) | 339 | 2 | binning: `arrivals=1`, **172 members** — half the population |
| **purified + enriched** | **9 (0 degenerate)** | **90** | **2** | **semantically coherent** |

Adding fields alone barely moved it and the kinds stayed degenerate — the
dominant kind was simply "mentioned once," because the population was 339
"beings" of which most were months, place names, adjectives and parse
artifacts (`April`, `Arbát Square`, `Armenian`, `I'd`). Restricting to beings
the reading has real evidence for — prior-injected, or ≥4 arrivals, the same
floor `entity.js`'s witness gate needs for an early/late split — cut the
population to 90 and produced kinds that name something: a **secondary cast**
(20 members: Davout, Murat, Ermólov, Túshin, Arakchéev, Speránski, Bilíbin,
Dessalles, Karatáev — generals, courtiers and peripheral figures, with no
protagonist among them) and an **early-established cast** (8 members entering
in the opening 4.5%: Borís, Kutúzov, Nicholas, Sónya).

Purification also fixed the fields for free: `partners` IQR went 2 → 21 and
every one of the nine survivors carried real spread, because the degeneracy
was mostly the once-mentioned mass flattening each distribution.

**Therefore, in order:** (1) restrict the population to evidenced beings
before inducing anything — `host/corpus.js::classifyIndividuation` exists for
exactly this typing and should gate the population, not merely sort it;
(2) then enrich fields; (3) never (1) or (2) by enlarging the corpus.

**The purification gate must be Born-gated, not thresholded.** Four gates
were tried on the same reading. Three were chosen numbers wearing different
clothes:

| gate | what it really is | population | kinds |
|---|---|---|---|
| `≥4 arrivals` | my hand-picked count | 90 | 2, coherent but arbitrary basis |
| `classifyIndividuation` type | **`MASS_FLOOR = 15`** (`corpus.js:831`) — a hidden count | 173 | 1 of 109 members, still full of places |
| Tukey fence on agency | derived spread, but *my* chosen coefficient | 73 | 1, degenerate |
| **Born gate on agency** | **nothing chosen** | **48** | **2, clean** |

`classifyIndividuation` does **not** separate persons from places: it reads
name-shape and mass only, which is why it types Austerlitz, Austria and
August as `holon`. And `corpus.js:867` computes `r.agency = subjectHits /
mentions` and then **never reads it** — the signal the population gate wants
was already being calculated and discarded.

The Born gate uses it properly, in the engine's own idiom: pool one 0/1 per
mention corpus-wide ("was this mention a grammatical subject" — 16,277
mentions, base rate 15.63%), build `nul/index.js::ground` over a `resample`
perturbation, and admit a referent only when `difference()` returns
`exceeds_witness` **above** the null's entire support. Nothing is chosen but
`draws` and `window`, both already declared by the reading.

It admitted 48, refused 124, and what it refused is exactly right: *French,
Austria, Russia, Prussia, Moscow, Western Europe, Napoleonic France, French
Revolution, Frenchman, Englishman, Madame, Prince* — nations, places,
collectives and bare titles. Named constantly; never acting.

The two kinds it then induced are the first semantically clean result:

- **`subject_share=0`** (5) — Davout, Lise Bolkónskaya, Platón Karatáev,
  Timókhin, Zherkóv: beings that are only ever acted *upon*.
- **`density=0.0043`** (9) — Anatole, Borís, Denísov, Dólokhov, Hélène,
  Princess Mary, Nicholas, Sónya, Véra: recurring secondary principals, thinly
  distributed across the whole book. No protagonist, no one-off figure.

**Rule.** A population gate expressed as a bare integer — anywhere, including
inside an organ — is provisional and must be reported as such. Gate by a Born
test against a null built from the material, and let the refusal be typed.

Two open defects surfaced by the same test: `induceKinds` returned
`ground: undefined` in all three conditions when called directly rather than
through `inventKind`/`understand`, so the key/value channel that
`goldens/kinds` added is not being reported; and kinds are still labelled by a
single field value (`partners=2`), which is a threshold on one attribute, not
a profile across several — a real limit on what "kind" currently means here.

### P6.2 — Cross-modal composition is wired but unearned

Everything downstream of entity discovery is modality-blind by construction
(`binding.js`/`graph.js` consume only `{id, arrivals}`), so audio motifs can
in principle enter the same population as text beings —
`reduce` → `findRecurringMotifs` → `readLinks` → `bindingTriples` → `readTriples`.
Composed for the first time this session on a real 78rpm recording: **25
motifs found, 47 links built, 0 surviving the reversal null for direction.**
`bindingTriples` emits only directed links, so audio contributed **0 records**
to the pool. The chain runs; the material did not clear the gate. That is an
honest negative and must not be reported as cross-modal reading having worked.

The statistical substrate is genuinely domain-general. The naming layer above
it is not, and no amount of the former converts the latter.

## P7 — One fold per session; a name is a referent, not a byte sequence

Two rules, one failure class. The class was measured twice before it was
named: A21 (searchSpans returns three spans for "Natásha" and zero for
"Natasha" while `surfaces.js::diaNorm` folds — two organs in one session
disagreeing about what a word is), and the same shape in a consumer
(the-fold, 2026-08-16): its retrieval folded diacritics and its grounding
check did not, so the very chapters retrieval found were reported as not
containing the names they are about. In both cases the reader is told the
material lacks what the material is made of — retrieval seeming to work and
the corpus seeming thin, which is the worst shape this failure takes.

**P7.1 — Every organ that compares text to text uses the session's one
fold.** Not "a" normalization — the same one, by import, never by local
reimplementation. `diaNorm` is the earned fold (disclosed-narrow, the five
Latin vowels' accent marks; the blanket combining-mark strip was tried and
reverted for silently claiming cross-script generality — see the scope note
in `surfaces.js`). An organ that needs a wider fold earns it with a giver
and a fixture per script; it does not quietly diverge. Conformance owes a
cross-organ agreement fixture: one accented name, every text-comparing path
in a session, all agreeing. A21 stays open until that fixture exists and
passes.

**P7.2 — A check on a NAME asks about the referent, not the string.** The
fold is only the orthographic slice of referent identity: no fold makes
"Pierre" equal "Bezúkhov", yet both point at the being the cast
establishes. Where a check must decide whether a name is supported by
material, the unit is the referent (`discoverReferents` / `namesCorefer`) —
with the direction watched, because coreference is symmetric and support is
not: a sub-form of an established surface is supported; an extension beyond
every established surface is new content and is refused. Disjoint aliases
remain model-tier, typed as gaps, closed only by a received prior with a
named giver — exactly the tier discipline `surfaces.js` already declares.
First consumer implementation: the-fold's `cast.js` + `grounding.js`
(engine organs injected, asymmetry pinned in its `grounding.test.mjs`).

---

# Attempt log

Append-only. Every attempt is recorded with what it cost and what it taught,
including the ones that were wrong — a policy that shows only its conclusions
invites the same dead ends to be re-entered. Newest at the bottom. Nothing
above this line is rewritten once an entry below refers to it; corrections are
made by appending, not by editing history.

Each entry: **what was tried → what happened → what it changed.**

### A1 · Co-occurrence golden reported as "reading"
Ran `goldens/network/read.mjs` on War and Peace and described the result as
what the system does. → Recovered real relationships, but this is the one
slice with external ground truth and the shallowest chain in the repo. → **P0.**
Naming the assembly became mandatory.

### A2 · Byte offsets on a CRLF source
`navigation-index-war-and-peace.mjs` on a freshly fetched Gutenberg text. →
**0/57 waypoints byte-verified.** Offsets computed on `\n`-normalized text,
re-sliced against raw CRLF bytes; drift accumulates one byte per line.
Stripping `\r` gave 57/57. → **P5.2.** Note the same fetch path feeds every
golden, so any uncached text is exposed.

### A3 · `read-people.mjs` — dead on import
The script `CLAUDE.md` recommends reading start-to-end failed to load. →
`emergence/people.js` had been renamed to `jati.js` (commit `cdac522`), which
updated conformance, the operator roster and the module manifest but not
`scripts/`. Six drivers broken; suite green at 1042/1044 throughout. → **P5.1.**
All six fixed; every relative import in the repo now resolves.

### A4 · Enlarging the activation window
Diagnosed sparse recall as memory loss and derived a per-book `WINDOW` to span
the whole novel. → **Wrong mechanism.** Activation decays and re-zeros by
design; beings return through retrieval (`surfer.js`, `reading-regime.js`), not
by staying hot. Enlarging the window destroys the contrast that makes surprise
measurable. → **P1**, the load-bearing rule.

### A5 · Corpus breadth as the fix for zero kinds
Six novels → then nine domains of `live_priors` plus real audio, **423 pooled
being-records**. → Still **0 kinds**. Pooling adds records, never fields;
`deriveBeingRecords` emits 4 numeric fields with identical keys for every
being, one degenerate. → **P6.1.** Corpus size is never the answer to "no kinds".

### A6 · Cross-modal composition (audio → same population)
`reduce` → `findRecurringMotifs` → `readLinks` → `bindingTriples`, first time
composed onto a real 78rpm recording. → 25 motifs, 47 links, **0 clearing the
reversal null for direction**; `bindingTriples` emits only directed links, so
audio contributed 0 records. → **P6.2.** Chain runs; material did not clear the
gate. Honest negative.

### A7 · Field enrichment alone
13 fields instead of 4, same 339 records. → 1 → 2 kinds, both degenerate; the
dominant kind was `arrivals=1` with **172 of 339 members**. Population was
mostly months, places, adjectives, parse artifacts. → Enrichment without
purification is nearly worthless.

### A8 · Four population gates, three of them chosen numbers
`≥4 arrivals` (mine) → `classifyIndividuation` → Tukey fence on agency → Born
gate. → The typed gate is **itself** a hidden count (`MASS_FLOOR = 15`,
`corpus.js:831`) and types Austerlitz, Austria and August as `holon`; it reads
name-shape and mass, never personhood. `corpus.js:867` computes `r.agency` and
**never reads it**. The Born gate (pool one 0/1 per mention corpus-wide,
`ground` over `resample`, admit only on `exceeds_witness` above) chose nothing
but the already-declared `draws`/`window`. → 48 admitted, 124 refused, and the
refusals are *French, Austria, Russia, Prussia, Moscow, Napoleonic France,
Englishman, Madame, Prince* — named constantly, never acting. → **P6.1 rule.**

### A9 · One null is not a null
Perm-tested the 2 Born-gated kinds: p=0.03, no null kind reaching the observed
largest size (9). Reported it as validated. → SEED "What follows" #6 requires
**plural grounds**; their disagreement is the only self-check. → Ran three.

### A10 · Plural grounds, and an unlicensed pair
`perm` (values shuffled within field) **p=0.03** · `strip` (values removed)
**0 kinds** · `rowperm` (whole profiles moved between beings) **p=0.90**. →
The disagreement is not a refutation: `induceKinds` sees only
`{id, attributes}`, so permuting which being holds which profile leaves the
multiset of clustered profiles unchanged — kind-count is invariant to
`rowperm` **by construction**. That is SEED #4 and Amendment I exactly, and
`nul/index.js`'s `LICENSED` registry exists to prevent it. → **Standing rule:
before spending a null, check the pair is licensed — a statistic insensitive
to its perturbation fails invisibly and globally.** What stands: the cluster
structure is real and value-carried (perm and strip both refuse). What does
**not** stand: any claim that membership is bound to those particular beings —
no null tested here can establish that, because the attributes are all the
induction ever sees.

### Open, not yet attempted
- **167 of 339 nodes never received an agency value** and were gated neither
  in nor out. A third of the graph is untested; the picture could change.
- Pronoun binding still uses chosen floors (`minActivation` 0.05 /
  `minMargin` 0.2), which `corpus.js` itself calls "an engineering starting
  point, not yet validated against a retrieval-quality golden" — a level with
  no null.
- `foldHolons` levels are not individually nulled.
- Kinds are labelled by a single field value (`subject_share=0`), a threshold
  on one attribute rather than a profile across several.
- `induceKinds` returns `ground: undefined` when called directly rather than
  through `inventKind`/`understand`, so the key/value channel is unreported.

### A11 · The helix does not stream — it re-grounds
Ran `scripts/read-helix.mjs` on War and Peace (34,202 material units). → No
output after 15 minutes; killed. Measured `runTurn` scaling directly on
prefixes: **1k → 4.5s, 2k → 16.3s, 4k → 105.3s, 8k → 309.6s** — 3.6×, 6.5×,
2.9× per doubling, superlinear. Extrapolated to full length: ~1.5h per family
per turn, ×2 families ×(1+3 shuffle controls) ≈ half a day. It also found only
2–4 REC boundaries across the whole range. → **A causal reader must be
streaming.** Reading in order is O(1) amortised per unit: priors trigger, the
ground is maintained incrementally, and readings emit continuously as the
material arrives. `runTurn` instead rebuilds grounds over growing slices, so
extent — the one quantity SEED explicitly excludes from the declared numbers
("whoever hands material in has already declared it") — silently governs cost.
A reader that cannot read a long book in order is not slow, it is wrong.

### A12 · Fold without drill-down is a summary; surf/climb/wayfind never ran
Checked this whole session against `retrieval-and-the-fold.md`. → Every reading
here was **fold-only**: read the whole book, build a graph, induce over it.
`executePrompt` (surf) was never called; the tier ladder was climbed only in
A-early runs and never keyed to a question; **`wayfind` was never called at
all** — matching the essay's own status ("exported and tested… nothing in the
app calls it. By this project's own growth rule an un-wired organ has not
joined"). I reproduced the gap rather than closing it. → Worse, the
lossless-fold law (LOSS-LESS-LADDER.md:147-152) requires every fold to carry
(a) the resolution it lost and (b) the drill-down path that remains. The
navigation-index run carried byte offsets; **the hypergraph and kinds work
dropped drill-down entirely** — so by the project's own law those kind results
are "a summary wearing the word's clothes." → And relevance was computed the
forbidden way: my rankings used counts and degree, i.e. similarity, where the
doctrine is *relevance is the surprise that did not happen* (`search/index.js`).
**Standing correction: a reading is not finished when a graph exists. It is
finished when the fold can be addressed and drilled back down.**

### A13 · Retrieval-vs-surprise — test INVALID, harness at fault
Tested Amendment IV directly: escalate retrieval, measure whether the same
material becomes less surprising. Escalation done correctly — widen what is
TESTED (recall pool `topEdges`/`edgeSlots`: ×1, ×2, ×4), hold what is BELIEVED
fixed (`minActivation` 0.05 / `minMargin` 0.2 in every condition). →
**Surprise fell 0.25–0.47% — noise.** Triples rose 858 → 870: **2,872 pronoun
bindings yielded 12 additional triples.**

→ Not evidence against Amendment IV. The retrieval never reached the graph.
`resolvePronouns` returns bindings carrying `referentId, sentenceOrder,
offset, pronoun, gender, activation, margin, provenance`. The driver keyed them
into a `Map` by `sentenceOrder` alone — **collapsing 2,868 bindings to 1,366,
discarding 52.4%** — and ignored `offset` entirely, so two pronouns in one
sentence were indistinguishable: "he saw her" resolved both ends to the same
referent and was dropped by the `subject === object` filter. The bindings were
real; the harness had no way to spend them.

One genuine finding survives, about escalation itself: widening the tested pool
**reduced** confirmed bindings (2872 → 2734 → 2679). More candidates means more
ties, more margin failures, more honest refusals. That is wayfind's discipline
behaving correctly, and it means naive pool-widening is the wrong escalation
axis — escalation must widen the *evidence* brought to a candidate, not the
number of candidates competing.

→ **P5.5 was violated by its own author.** The result was surprising and the
theory was questioned before the driver. Any A-entry reporting a null effect
must first show the mechanism under test actually reached the measured
quantity. Re-run pending: key bindings by `offset`, resolve each pronoun
occurrence against the binding at its own position.

### A14 · Retrieval-vs-surprise, harness fixed — Amendment IV holds weakly; escalation is INERT
Re-ran A13 spending every binding per OCCURRENCE: bindings grouped by sentence,
sorted by their own absolute `offset`, and each end of a triple resolved to the
binding whose offset falls INSIDE that end's span (containment — no threshold
chosen).

| condition | bindings | spent | triples | surprise/frame | surprise/triple |
|---|---|---|---|---|---|
| R0 no retrieval | 0 | 0 | 858 | 0.00616 | 0.00541 |
| R1 default pool | 2872 | 1250 | 890 (+3.73%) | −0.79% | **−1.05%** |
| R2 pool ×2 | 2734 | 1185 | 890 (+3.73%) | −0.79% | −1.05% |
| R3 pool ×4 | 2679 | 1168 | 889 (+3.61%) | −0.76% | −1.04% |

Fixing the harness roughly doubled the measured effect (−0.45% → −1.05% per
triple) and tripled the triple gain (+1.4% → +3.73%); collisions rose 17 → 177,
i.e. "he saw her" is now correctly *detected* rather than silently
mis-resolved. → **Amendment IV is directionally confirmed but small: retrieval
lowers surprise by ~1%.** Only 1,250 of 2,872 bindings could be spent at all —
57% land where the SVO extractor proposes no triple, so the ceiling here is
relation extraction, not retrieval.

→ **The load-bearing result is the null: R1 = R2 = R3 to three decimals.**
Widening the recall pool ×2 and ×4 changed surprise not at all, and *reduced*
confirmed bindings (2872 → 2734 → 2679). Escalation depth, as currently
available, contributes nothing.

→ This null is exactly what the stance-face argument predicts. `wayfind`'s
`maxRounds` widens *the same undifferentiated kind of search* repeatedly; it
carries no notion that a Ground-grain ambiguity and a Pattern-grain one call
for different widening. R1→R3 widened one untyped pool three times and got
three identical answers plus more ties. Verified at this checkout: `wayfind(`
has **no callers** in either repo (not even a conformance test naming it),
`refusals()` has none but its own definition, and `.stance` is written in four
places and read by nothing that routes. **Untyped widening is measurably
inert — which leaves the discrete (mode × grain) ordinal already derived in
`operators.js` as the untried axis, not a bigger pool.**

### A15 · Typed escalation vs untyped widening — a real, bounded win
Direct test of the stance argument: route by WHICH doubt `pronoun_below_floor`
(thin evidence — a breadth problem) vs `pronoun_no_margin` (two candidates
TIED — a depth problem, per A14, unfixable by more candidates) actually is,
using `activation.js::recall`'s two distinct knobs — `topEdges`/`edgeSlots`
(breadth) and `completion` (one-hop associative depth) — instead of scaling
one undifferentiated pool. `minActivation`/`minMargin` held fixed throughout,
as in A13/A14: what's BELIEVED never moves, only what's TESTED and how.

**Census first, and it reframes the whole test:** of 11,638 gaps,
**`pronoun_no_margin` is 99.1%** and `pronoun_below_floor` is **0%** — in this
text, once a referent is named and active, the failure mode is almost always
a tie, never thin evidence. The breadth branch of the typed routing never
fired; this measured depth-only routing of ties, cleaner than designed.

| condition | bound | vs baseline | triples | surprise/triple |
|---|---|---|---|---|
| R0 baseline | 2872 | — | 890 | 0.00535 |
| UNTYPED ×2 (both knobs, everyone) | 2802 | **−2.4%** | 893 | −0.21% ↓ |
| TYPED (depth only, routed to ties) | **3398** | **+18.3%** | 893 | −0.10% ↓ |

Untyped uniform escalation **lost bindings net**, confirming A14 again:
admitting more candidates into an already-tied contest breaks more ties the
wrong way than it resolves. Typed escalation — depth only, applied only where
the gap reason says depth is the right remedy — recovered **596 more
bindings than untyped, 526 more than baseline, with no confirmation loss.**
That is the stance argument's mechanism working: not a bigger search, the
*right kind* of search for the doubt that was actually raised.

**The honest ceiling.** Both escalations converge to the identical 893
triples and near-identical surprise/triple. TYPED's 526 additional correct
bindings barely move surprise, because **most of them land where
`extractRelations` proposes no triple at all** — the same 57%-lost ceiling
A14 already measured. Typed routing is a real, clean win for identity
resolution itself; it is bottlenecked, same as before, by relation
extraction's own recall, not by retrieval depth or breadth. **Confirms the
essay's claim in the metric it actually moves (binding recovery), and is
honest that the metric everyone wants moved (surprise) is gated upstream.**

### A16 · Everything above the import fixes is proven, not wired
Checked directly: `packages/host/corpus.js::discoveredCast` calls
`resolvePronouns` exactly once, with fixed default knobs, uniformly — nothing
reads a gap's `reason` to route. The typed escalation A15 measured (+18.3%
binding recovery, no confirmation loss) exists only in a standalone driver
script. The same is true of everything else this session proved: the
Born-gated population filter (A8), the hypergraph export, the plural-nulls
check on kinds (A10). All of it calls real, unmodified engine organs; none of
it is reachable from `host/corpus.js`, `scripts/read-people.mjs`, or any path
a normal reading takes. Only the six import fixes and this policy file itself
are actually in the repo. **Proven and wired are different claims, and this
log has not been keeping them apart — every A-entry above should be read as
"measured against the organs," not "shipped."**

### A17 · Why 57% of correct bindings never reach a triple — measured, and it splits in two
Classified all 2,868 pronoun occurrences `resolvePronouns` bound, by what
`extractRelations` actually did with the sentence each one sits in:

| bucket | n | % | what it means |
|---|---|---|---|
| `NO_VERB` | 1,469 | **51.2%** | zero triples proposed anywhere in the sentence |
| `SWALLOWED_OBJECT` | 853 | 29.7% | a triple was proposed; the pronoun sits inside the object capture, mean width **6.2 words**, but is not itself the isolated capture |
| `SWALLOWED_SUBJECT` | 269 | 9.4% | same defect, subject side |
| `CLEAN_SLOT` | 277 | 9.7% | pronoun is the isolated 1-token capture — this is the ~1,250 that already resolve |

**The `SWALLOWED_*` buckets (39.1% combined) are exactly the defect the
indirection reframe predicts, mechanically confirmed.** `relations.js`'s
object group is `.+?` — everything to the next terminator — not a bounded
slot. A pronoun resolves only when it happens to BE the whole capture, by
accident of sentence shape. That is not a slot a filler attaches to by any
means (name lookup, pronoun binding, an epithet prior, the same general
mechanism a foreign key or a bound variable is); it is already-decided
literal text that resolution can only pattern-match against post hoc. The
general fix implied is real: emit `{subject_span, verb, object_span}` as
bounded token positions, typed as filled-or-not, and let every filler
mechanism already built (`surfaceToId` lookup, `resolvePronouns`, a coref
prior) attach to the SAME slot uniformly — never a special pronoun case
bolted onto a text-shaped capture.

**But the larger bucket, `NO_VERB` at 51.2%, is a different and prior
defect that slot-typing does not touch.** These are sentences where no
`discoverRelationVocab` verb sits in immediate `subject VERB object`
adjacency near the pronoun at all — not a capture-width problem, an
extraction-shape and vocabulary-recall problem: adverbials, auxiliaries, and
subordinate clauses routinely separate a subject from its verb in ordinary
narrative prose, and the matcher requires literal adjacency
(`relations.js:207`, `\s+` between capture groups, nothing else). Fixing the
slot shape recovers at most the 39.1% swallowed bucket; the 51.2% majority
needs the extractor's own clause-shape assumption revisited, which is a
larger, separate change.

**Blast radius, checked before proposing anything:** `extractRelations`/
`discoverRelationVocab` are consumed by 11 real callers, including
`goldens/agency-civic/` — a SCORED golden with its own reference. Any change
to extraction shape must be validated against that golden before it is
trustworthy anywhere else in this list.

**Not attempted.** This is a real organ change with real blast radius, not
another driver script — the next entry this log should carry, if taken up,
is a scoped slot-typing rewrite validated against `goldens/agency-civic`
before touching anything else that depends on it.

### A18 · The polarity window was reading formatting noise as signal — fixed with a derived boundary, not a bigger guess

A separate defect from A17, found while reading `extractRelations`'s polarity
check rather than its subject/object capture: `NEGATION_BEFORE_VERB` used to
test a RAW 40-character slice of source text immediately before the verb
(`s.slice(m.index - 40, ...)`, unbounded by any token regex) against a
`{0,2}`-word-capped pattern. Both numbers — the 40 and the 2 — were hand-set,
present since this file's negation handling was written, never measured.

**What was wrong, concretely.** Ordinary mid-window punctuation broke the
match silently: `"Victor did not, truly, love Elizabeth."` — the comma
directly after "not" blocks the `\s+` the old pattern required immediately
after the trigger, so `NEGATION_BEFORE_VERB` never anchors and the triple is
reported `polarity: "+"` — a fabricated affirmative for a negative clause,
the exact failure this file's own header already named ("Defaulting to
affirmative would fabricate the most consequential bit in the triple") but
did not, in this one path, actually prevent. A second, unrelated bug shared
the same root cause: the 0-2-word group used ASCII `\w`, not this file's own
unicode-aware `W`, so a diacritic name in that slot broke the match the same
way punctuation did, on the same pg2600 (Maude) edition this file's other
comments already cite.

**Both hand-set constants were removed, not re-tuned.**

- The 40-character slice is gone. It was standing in for a WORD-count need
  ("enough characters to hold the trigger and a few words") with a
  CHARACTER-count guess — a category error, not just an unmeasured one.
- The `{0,2}` word cap is gone. MEASURED by sweeping R from 0 to 6 against
  every triple in a full War and Peace reading: R=2→3 alone recovered 265
  more genuine same-clause negations that read correctly by eye ("I have
  never yet asked you for...", "he did not like the conversation"), and
  matches kept reading as correct out past R=6 — the cap was never
  protecting against anything at the values it was silently missing real
  negations at. Going unbounded outright was tried next and rejected the
  same way: a constructed counter-example ("Natasha said she would never
  come, and Pierre truly loved Elizabeth.") confirmed a trigger from one
  clause can bleed into an unrelated later verb once nothing stops it.

**What replaced both.** A word count was never the real distinction — what
separates a connected negation from an unrelated one is whether an
INDEPENDENT clause with its own already-recognized verb sits between the
trigger and the verb being tested. `extractRelations` already computes this
as it scans: the polarity window is now bounded backward by whichever is
closer — the end of the PREVIOUS match this same pass already found (that
text is already claimed by a different triple's own verb), or the most
recent sentence-ending punctuation (`.!?;`, deliberately not `,` — commas
set off parentheticals WITHIN a clause and stopping there would undo the
fix below). Both are facts already in hand, not tuned numbers. Within that
derived boundary, `NEGATION_BEFORE_VERB` no longer bounds word count at
all — once the window is honestly clause-scoped, any trigger inside it is a
real one.

**Measured net effect**, `extractRelations` on pg2600 end to end (same
40,659 triples both before and after — this only touches polarity, never
subject/verb/object): negative-polarity count went from 1,167 (2.87%) to
2,433 (5.98%) — 1,266 triples recovered from a silently fabricated "+" to a
correct "-". The remaining, named gap: a negation sitting in a clause whose
own verb isn't in `verbs` (so MATCHER never claims that span) can still
bleed forward across a comma+conjunction into a later, unrelated verb if no
sentence-terminator intervenes — quantified at ~31 of 43,342 candidate
windows (0.07%) showing the specific "conjunction + a different known
surface name" shape that risk takes, several of which read as fine on
inspection. Closing this fully needs real clause-boundary detection (a
coordinating-conjunction-introduces-a-new-subject test), which was
considered and deliberately not built here — the "not X but Y"
same-clause-contrastive construction ("not a joyful but querulous") shares
surface shape with the risky case (a conjunction near a trigger) but is not
the same thing, and a blanket stop-at-any-conjunction rule was measured to
break it.

**A three-valued typed-refusal ("cannot tell") was considered and
measured, not just discussed, before being rejected**: after the boundary
fix alone (before removing the word cap), zero triples remained where a
negation trigger sat unresolved within reach of the verb — so a third
polarity state would have been unearned complexity, not a real residual, at
least for the punctuation-noise defect this entry fixes. `NEGATION_BEFORE_VERB`
matching is also monotonic in the safe direction throughout this fix: cleanup
and the wider window can only turn a non-match into a match, never the
reverse, so no sentence that already resolved "-" changed.

**A real ReDoS was found and fixed in the process, not shipped.** The first
attempt at removing the word cap kept the old anchored shape
(`\s+(?:W\s+)*$`) with the cap simply deleted — `W` is itself a `+` nested
inside that `*`, and on a non-match (the common case: most windows are
affirmative) the regex engine had to try every way of partitioning the
window into word+space runs before giving up. MEASURED: full-book
extraction went from 15s to 97-285s (non-deterministic across runs — the
signature of backtracking blowup, not a real algorithmic cost), concentrated
on short, contextually-unremarkable sentences with no content reason to be
slow. The fix was a simplification, not a patch: once the window is
genuinely clause-bounded, the check is a plain existence test for the
trigger, which has no repeated group to backtrack through. Full-book timing
after the fix: 19.3s (the original was 14.9s; the difference is the boundary
bookkeeping itself, not backtracking — slowest single sentence dropped from
900ms+ to 41ms).

**Blast radius.** `packages/engine/perceiver/text/relations.js` only —
`extractRelations`'s return shape (`{subject, verb, object, polarity}`) is
unchanged, and the 11 callers A17 already named consume `polarity` as a
plain string exactly as before. `npm test`: 1053/1055 passing, both
failures pre-existing and unrelated (`agency-civic-firewall.test.js` and
`reproducibility.test.js` both fail on absolute-path/reference debt in
`scripts/experiments/*` — separate in-progress work, untouched here).

### A19 · The slot-typing rewrite A17 asked for — object AND subject, both bounded by a derived class, not a hand list; then a chorus review caught three real integration bugs before any of it shipped

A17 named the fix and refused to attempt it in the same entry: `extractRelations`'s
object capture is `.+?` — everything to the next terminator — so a pronoun or
name only resolves when it happens to BE the whole capture. Taken up here,
scoped exactly as A17 specified: bound the object, validate against
`goldens/agency-civic` before touching anything else, then sweep the other
callers.

**Four candidate object-capture bounds were measured before picking one** (not
assumed): the current clause-final capture, a fixed 3-token cap, stopping at
the next already-admitted surface, and stopping at the next function-word
boundary (this text's own Zipf-derived closed class, `material.js::functionWordSet`
— the same primitive `discoverRelationVocab` already uses for its verb filter,
never a hardcoded word list). Measured on 2,863 pronoun occurrences
`resolvePronouns` bound in a full War and Peace reading, checking what the
object capture did with each one:

| rule | CLEAN_SLOT | SWALLOWED_OBJECT |
|---|---|---|
| clause-final (was) | 12.2% | 54.3% |
| fixed 3-token cap | 14.4% | 33.5% |
| next admitted surface | 12.5% | 52.7% |
| **next function word** | **20.5%** | **13.2%** |

Next-function-word won outright — not narrowly — on both axes, and is the
only candidate whose bound is a text-derived class rather than a picked
number. (These four numbers were measured against a driver script — not
`extractRelations` itself — before the mechanism was implemented, so the
`SPLITTER` defect below does not touch them; they were sound grounds for
the choice. Everything measured AFTER this point, in the paragraphs below,
was re-measured against the final, corrected code — see the chorus-review
section.)

**The object group always keeps its first token even if that token is itself
function-word-shaped** ("gave HIM the letter" must still capture "him" — a
pronoun IS a function word by Zipf frequency, and refusing to capture it
would defeat the fix's own purpose). Only tokens after the first stop at a
function-word boundary. No trailing anchor follows the object group in
`MATCHER`, so — unlike A18's `NEGATION_BEFORE_VERB` ReDoS — there is nothing
for a failed later requirement to backtrack the object choice against;
confirmed adversarially (a 5,000-token run with no function word anywhere,
and the same run against a verb that never appears, forcing an exhaustive
scan): both resolve in single-digit milliseconds.

**The subject side had the mirror-image defect, found while sampling
its own residual** (SWALLOWED_SUBJECT — A17's smaller bucket, 269 of the
39.1% SWALLOWED total). Reading the actual samples showed it is NOT one
defect generalizing from the object fix, but three distinct shapes:

- Inverted dialogue tags ("said **he**") — a different clause order, not a
  capture-width problem.
- Possessive pronouns inside a noun phrase ("**his** mouth") — the pronoun
  is a modifier, not the subject; a different slot entirely.
- A leading conjunction or determiner swallowed into the subject ("**and**
  he", "**the** King") — the actual mirror of the object defect: the
  subject's 2-token cap gets one slot spent on a function word, leaving no
  room for the pronoun to stand alone.

Only the third shape is the same defect as the object side, and it needed a
different mechanism, not a copy-paste of the object fix: rejecting a
function-word-shaped token at the START of a regex match also rejects the
single most important case this exists to serve ("**He** told her" — a bare
pronoun subject, itself function-word-shaped, must never be refused).
Tried and rejected: a lookbehind letting the match start either at the true
beginning or right after a function word — doesn't work, because the
engine already succeeds starting at position 0 (via the plain `^`
lookbehind branch) before it ever needs the skip-forward branch, so "and he"
matches whole regardless. What works: post-process the already-extracted
subject STRING (not the regex match position) — strip the first of exactly
two tokens only when it is function-word-shaped.

**A chorus-lint review (`CHORUS-LOG.md`, this run) found three real
integration bugs before any of this shipped, none of them visible from
either fix's own isolated validation.** In order of how they were found:

1. **Diaconis (NUL): `extractRelations` re-derived `{subject, verb, object}`
   from a SECOND regex (`SPLITTER`, bare `.+?`, no `dotAll`) applied to
   `MATCHER`'s own `m[0]`, instead of reading `MATCHER`'s own `m[1]`/`m[2]`/
   `m[3]` directly.** This was latent before this session (SPLITTER already
   existed) but harmless while the object group was clause-terminator-bounded
   and so never crossed a line break. Once OBJECT_GROUP could span a
   Gutenberg hard-wrap newline (its `\s+` separators match `\n` by design —
   the same reason `NOISE_RUN` exists), `SPLITTER` could no longer follow it
   across that newline and would silently re-split at a LATER verb
   occurrence instead — reproduced corrupting a real record in the checked-in
   golden data (`goldens/agency-civic/data/engine-scores.json`, id
   `ordinance-metro-ord-25-1528-preamble-s0-c9`), and, once measured at full
   scale, found to have been silently DROPPING matches far more often than
   corrupting them (`if (!parts) continue`) — the true cause of the large
   jump in total triple count below. **Fixed by deleting `SPLITTER`
   entirely** and reading `m[1]`/`m[2]`/`m[3]` directly; two regexes
   independently agreeing to parse the same text was a liability by
   construction, and removing the redundant one is a simplification, not
   just a patch.
2. **Dijkstra / Frankfurt / Alexander (three personas, independently, same
   root cause): narrowing the object capture also narrows what
   `previousMatchEnd` — A18's own clause-boundary signal for the polarity
   window — considers "already claimed."** A18's invariant ("a matched
   triple's own verb already claims everything up to here") was true when
   the object ran to the clause terminator; once the object could stop
   earlier, at a function word, a trailing negation word between the
   truncated object and the real clause boundary was left unclaimed and
   could bleed into the NEXT relation's polarity window — reproduced
   fabricating a negative polarity for an affirmative clause
   ("...never looking back and Paul departed quickly" wrongly read as "Paul
   did NOT depart"). **Fixed by decoupling the two concerns**: a new
   `clauseEndAfter` helper finds the true old-style terminator (`.`/`,`/`;`)
   forward from the match's own end and feeds THAT to `previousMatchEnd`,
   while the object capture itself stays narrow for triple-reporting
   purposes. Two different questions — "what should this triple report as
   its object" and "how far does this clause's territory reach for the NEXT
   relation's polarity check" — were conflated by reusing one position for
   both; they are not the same question and now use different answers.
3. **Dijkstra (second finding): the subject-strip's precondition checked
   only the FIRST token's function-word-ness, never the second.** For a
   negated auxiliary construction ("does not measure", "is not V"), BOTH
   subject-position tokens are ordinary high-frequency function words, so
   the strip turned "does not" into bare "not" — the negation trigger
   itself standing in as the "subject," a fabricated referent silently
   flowing downstream. **Fixed by refusing to strip when the remaining
   token is itself a member of `NEGATION_WORDS`** (already imported in this
   file) — left as the original 2-token "does not" instead, garbage that
   plainly fails referent matching rather than garbage disguised as a name.

**A fourth finding (Holmes) was not a bug in what shipped originally, but a
real risk the fix as first written would have carried**: the subject-strip
is, underneath the syntax framing, a coreference decision — "King" and "the
King" are declared the same referent by dropping "the". For most swept
callers this is inert (they already resolve the string against a discovered
referent list by containment, so stripped or not makes no difference), but
`packages/host/sing.js` has no such seam — the stripped string IS the
node id `emergence/graph.js::readTriples` keys the belief graph on. Reproduced:
"his King"/"her King" — two different people sharing a title, distinguished
only by a possessive — would both strip to bare "King" and silently merge
into one graph node. **Fixed by also refusing to strip when the leading
token is a member of `THIRD_PERSON_SINGULAR`** (`priors.js`, an existing
named prior, giver `lang/en` — not a new hand-set list): a possessive
pronoun carries person/gender information the strip must not discard,
where a plain determiner or conjunction carries none. "the King" still
correctly strips to "King" ("the" was never identity-bearing); "his
King"/"her King" now stay distinct.

**Two findings were named and deliberately not acted on.** Ostrom and Pearl
both flagged that the docstring's "every genre improved, none regressed"
was earned by the object mechanism alone and got read, unqualified, as a
property of the single `functionWords` flag that actually ships both
mechanisms together — fixed by not repeating an unqualified golden number
in the docstring at all (see the code comment) and by this entry keeping
the object and subject validations reported separately, genre by genre, as
they were before. Simon and Chekhov found that several more callers
(`scripts/adversarial/challenge-9-*.mjs`, `challenge-10-*.mjs`,
`challenge-4-*.mjs`, `scripts/experiments/role-fold-kinds.mjs`) already
compute a `functionWords` Set for their own `discoverRelationVocab` call
and simply never thread it to their `extractRelations`/`createSinger` call
a few lines below — the identical oversight this entry fixes in six other
scripts. **Not swept this pass** — named here rather than silently left out
of the accounting, per this project's own discipline of naming what
remains open. The opt-in design means nothing in these scripts is broken by
the omission; they simply do not yet benefit.

**Final, corrected numbers** — full War and Peace, all three fixes above
applied, measured against the actual code that ships (superseding every
number measured earlier in this entry and in A18, which were measured
against the pre-chorus-review code):

| | before (pre-session) | after (final) |
|---|---|---|
| total triples | 40,659 | 82,421 |
| negative polarity | 1,167 (2.87%) | 1,395 (1.69%) |
| object CLEAN_SLOT / SWALLOWED | 0.9% / 45.9% | 4.9% / 22.7% |
| subject CLEAN_SLOT / SWALLOWED | 8.5% / 11.7% | 21.1% / 23.2% |
| combined CLEAN_SLOT / SWALLOWED | 9.4% | 26.0% / 46.0% |

The near-doubling of total triples is the `SPLITTER` fix (finding 1 above):
the old code was silently dropping far more matches on newline-containing
text than it was corrupting, and removing the redundant regex recovered
them. `goldens/agency-civic`, re-run against the final code: **22/208 →
36/208 clauses admitted a Link (17.3%)**, staff-report 4.3%→9.8%, deposition
23.3%→26.7%, ordinance 7.1%→19.6% — every genre still improved. `npm test`:
1053/1055, the same two pre-existing, unrelated failures as A18.

**Callers swept**, per A17's own blast-radius note (11 named callers).
`functionWords` is opt-in — a caller that doesn't pass it gets the exact
old behavior, nothing breaks by doing nothing:

- `goldens/agency-civic/engine-score.mjs` — updated and validated (numbers
  above).
- `scripts/cache-reading.mjs`, `navigation-index-war-and-peace.mjs`,
  `read-ladder.mjs`, `read-people.mjs`, `read-tiered.mjs`,
  `terrain-census.mjs` — all already computed a `functionWords` Set for
  `extractSurfaces`/`discoverRelationVocab` and simply hadn't threaded it
  to their own `extractRelations` call; each swept for a hardcoded
  subject/object width or shape assumption first (none found — every
  caller treats the captured phrase as an opaque string resolved by
  substring/word-boundary match against known referents, never by token
  count) before opting in.
- `packages/host/corpus.js` (`discoveredCast`, the real production path)
  and `packages/host/sing.js` (`createSinger`/`singPass`, reached via
  `scripts/sing-book.mjs`) — `sing.js` had no `functionWords` concept at
  all (its `verbs` are supplied by the caller, not derived internally), so
  this needed a small signature addition (`functionWords = null` on
  `createSinger`, carried on the singer record) rather than just
  threading an already-local variable.
- `scripts/read-nashville-civic.mjs`, `scripts/full-golden-layered.mjs` —
  checked (Simon): neither calls `extractRelations` at all, not real
  callers.
- **Not swept, named rather than hidden (Simon/Chekhov):**
  `scripts/adversarial/challenge-9-single-document-vs-cross-document-terrai.mjs`,
  `scripts/adversarial/challenge-10-noisy-tv-trap-competence-gain-vs-raw-sur.mjs`,
  `scripts/adversarial/challenge-4-typed-discard-reconstructability.mjs`,
  `scripts/experiments/role-fold-kinds.mjs` — each already computes
  `functionWords` in scope and doesn't thread it through; two of them
  (challenge-4, challenge-10) construct a `createSinger` without it too.
  challenge-4's own header claims to run "the identical production code
  path" as `sing-book.mjs` — that claim is presently false, since
  `sing-book.mjs` is wired and this script is not.

**Blast radius.** `packages/engine/perceiver/text/relations.js`,
`packages/host/corpus.js`, `packages/host/sing.js`, and the six scripts
named above. `extractRelations`'s return shape is unchanged (still
`{subject, verb, object, polarity}`); `functionWords` is a new optional
parameter, defaulted to `null`, changing nothing for a caller that omits
it.

---

### A20 · Admission does not strip the container, and the cap is silent

Measured while wiring `packages/host` into a separate reader (`the-fold`),
against War and Peace (`pg2600.txt`, 3,293,655 chars).

**The container survives admission.** P5.3 says strip it, `spans.js` exports
`stripContainer` for exactly that, and `admitChunked` does not call it.
`wp:chunk-0` is the Project Gutenberg header followed by the book's entire
table of contents — admitted, indexed, retrievable, quotable. The reader that
found this had the same defect and fixed it: 47 of its 11,190 passages were
the licence and the donation appeal, and dropping them cost nothing but a
regex and an offset carried forward.

**The unit is a byte budget, not a unit.** `CHUNK_SIZE = 2000` cuts every
2000 chars regardless of sentence, paragraph or chapter: 1,647 units, all
exactly 2000 long except the tail. The file's own comment already grants this
is "an engineering starting point, not yet validated" — recorded here so the
next reader does not mistake an admission unit for a segment. The same book
through `segments.js` yields 376 boundaries found by form, which is what a
passage should be cut at, and what a citation should be able to name.

**The cap does not announce itself.** `spanCap` defaults to 2000 and
admission is `if (session.spans.size < session.spanCap)`. War and Peace needs
1,647. A book a quarter longer stops being admitted part way through, with no
gap emitted and nothing in the return value to say so — `{chunks, admitted}`
reports what was taken, never what was refused. P4 says a gap is a result;
this one is silence. **The fix is a typed gap (`cast_truncated` already
exists for this shape), not a bigger default.**

### A21 · `searchSpans` does not fold diacritics

Same session, same corpus. `searchSpans(session, {query: "Natásha"})` returns
three spans; `"Natasha"` returns zero, against a text that writes the name
1,213 times. The reader is told the material lacks her, which is the worst
shape this failure can take: it reads as retrieval working and the corpus
being thin. Folding NFD combining marks before tokenising costs one line and
is the same rule already applied in `surfaces.js::diaNorm` — the organ that
`segments.js` imports for exactly this reason. The two paths disagree.

### A22 · A21's class measured in a consumer, and promoted to policy

The-fold (2026-08-16) hit A21's failure class from the other side: its
retrieval folded diacritics and its grounding check did not, so a holonic
run over this same War and Peace text retrieved the right chapters and then
flagged "Pierre Bezukhov" and "Helene" as not-in-the-material — five false
findings on a clean run, the A21 shape exactly (the reader told the material
lacks what it is made of). The instance was fixed with one shared fold on
both sides of every containment; the class was fixed by routing name-support
through the cast — `discoverReferents`/`namesCorefer` injected into the
consumer's check, with support kept asymmetric where coreference is
symmetric (sub-forms of an established surface resolve; extensions are
refused as new content). What it changed: **P7 above** — one fold per
session, names checked as referents — and a conformance debt: the
cross-organ agreement fixture P7.1 names, which A21 stays open against.
A21's one-line searchSpans fix remains unapplied; P7 is the reason it is no
longer optional.

### A23 · RDF comparison orientation — the subject was named before a number was made

Read the checked-out engine policy and traced the host reading assembly,
belief graph, relation extraction, binding, entity admission, and external
network golden before attempting an RDF comparison. → “The hypergraph” split
into five non-interchangeable candidates; the first comparison's subject is
now explicitly the **engine belief graph at a declared reading cursor**, not
the-fold's ephemeral verifier, a claim log, an unbuilt generation plan, or
eoWebLLM's sibling implementation. No RDF was fetched and no quality number
was produced. The broader constitutions, the-fold, and live_priors named by
the brief were absent from this environment, so their described behavior is
recorded as received rather than independently verified. → Added the
append-only `RDF-COMPARISON.md` resumption log with standing, evidence flags,
existing seams, and open work. Runtime code is unchanged.

### Open, not yet attempted (RDF comparison)

- Provide and read the missing governing/sibling trees, then run the-fold's
  own baseline independently of this engine baseline.
- Select one RDF-covered, toggle-enabled live_priors document from its real
  publisher frontmatter; build a giver- and snapshot-named local RDF prior.
- Calibrate entity correspondence on human-labelled nominations before
  reporting automatic agreement, and report entity and relation differences
  separately.
- Build a cursor-stamped eval snapshot and commensurable perturbed-input null;
  only a measured discrepancy may nominate a grammar, logic, or prior-pipeline
  correction.

### A24 · The first RDF-programme assessment ran; RDF acquisition was refused

Ran the host belief graph over the checked-in Project Gutenberg Frankenstein
fixture, then reran the same pipeline on a sentence-reversal null. → The
observed row contains 5,991 nodes and 9,803 edges (4,935 verb keys, 4,868
structural keys, 356 negative); the null contains 5,993 and 9,808
respectively. The leading nodes are pronouns/function words and none has an
external identifier, a measured alignment obstacle. Because each whole
document entered at tick 1, the near-equal null does not exercise temporal
decay and is recorded as a staged-admission gap, not robustness. Wikidata
SPARQL/API/entity-data and DBpedia JSON acquisition attempts all met the
environment's HTTP 403 CONNECT refusal; zero RDF rows means RDF agreement is
explicitly refused, not scored. → Added the rerunnable
`goldens/rdf/rdf-belief-assessment.mjs` and its disclosed result artifact; no engine
threshold or organ changed.

### A25 — Work backwards from 100% coverage without tuning the golden (2026-08-20)

**What was tried.** The network reading was instrumented after the fact with a
monotone coverage funnel: discovery → Born admission → co-arrival nomination →
displacement-null acceptance. The frozen reference is supplied only after the
reading ends. No parameter, null, gate, or engine organ was changed.

**What happened.** A synthetic assay proves that one missing reference endpoint
is charged to discovery and one nominated-but-refused edge is charged to the
null, without double-counting either at a later seam. The real corpus could not
be rerun in this environment: its gitignored texts were absent and the
reproducible fetch ended in `network_fetch failed`. Existing result artifacts
were therefore left untouched rather than populated with inferred counts.

**What it changed.** `goldens/network/coverage-funnel.mjs` and its conformance
case make the next question mechanical: find the first seam carrying most of
the measured loss. A Born loss does not license lowering a floor. It licenses
checking the candidate's recorded refusal against the shared ground and the
ambient re-zero history; candidate-local re-zero remains refused by the
constitution claim already cited in `entity.js`. Standing: **shown** for the
instrument and **gap** for real-corpus funnel counts. Evidence flags:
`instrument_run=true`, `ground_present=false`, `human_calibrated=false`,
`external_reference_used_only_after_reading=true`.

**Open, not yet attempted.** Rebuild the corpus locally, materialize all forty
funnels, choose the first loss seam by those counts, inspect its row-level Born
or null records, and test any resulting mechanism on held-out material before
re-scoring these networks.

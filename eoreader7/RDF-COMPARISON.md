# RDF comparison programme — resumption log

This is an append-only research log, not a claim that an RDF comparison has
been completed.  Each pass records **what was tried → what happened → what it
changed**, and ends with work that remains open.

## Pass 0 · 2026-08-20 · Name the subject before comparing it

### What was tried

The first pass read the engine's local governing and orientation documents
(`READING-POLICY.md`, `CUBE.md`, `SEED.md`, and `CLAUDE.md`), then traced the
actual reading path through `packages/host/corpus.js`,
`perceiver/text/relations.js`, `referents/entity.js`,
`emergence/binding.js`, and `emergence/graph.js`.  It also read the network
golden's method before proposing a new comparison mechanism.

The broader constitutions and the-fold/live-priors material named in the
brief were looked for at `/Users/mlacy/Documents/3.0`, but that tree is not
mounted in this environment.  Only `/workspace/eoreader6.1` is present.
Consequently this pass does not fetch RDF, choose an RDF-covered document,
change an engine organ, or claim compliance with documents it could not
inspect.

### What happened — the overloaded “hypergraph” map

| candidate | what it is | persistence and identity | RDF-comparison standing here |
|---|---|---|---|
| **Engine belief graph** (`emergence/graph.js`, fed by the host reading assembly) | A modality-agnostic, evolving set of entity nodes and verb/polarity edges; binding links can also enter through a structural edge key. | Node ids are whatever resolved identity the caller supplies. Edge keys are derived strings. Edge weights decay and may be pruned; this is belief at a declared cursor, not a cumulative knowledge store. | **Selected subject for the first comparison.** It is the structure produced by an actual engine reading, and it exposes typed, directional, polarity-bearing relations that can be compared separately from entity correspondence. |
| **The-fold live relation verifier** (`the-fold/hypergraph.js`) | Per-turn extraction and comparison of material edges with drafted-answer edges, yielding typed verdicts. | Recomputed verification state, not a stored graph. | Not selected: it measures answer grounding after drafting, a different question from whether the reading's own extracted representation corresponds to received RDF. The sibling repository is also absent here. |
| **Append-only claim/testimony substrate** (`task-log` and the P39 testimony spine named in the brief) | Stable claims and evidence/verdict events, including a claimed SHA-256 `claim_id` seam in the-fold. | Intended stable, addressable log identity rather than live graph identity. | Not selected for pass 1: it could become the durable envelope for comparison verdicts, but the P39 implementation and policy cannot be inspected in this checkout. It should record later results, not silently replace the thing being tested. |
| **`HYPERGRAPH-FIRST-GENERATION.md` proposal** | A proposed extract-before-draft ordering. | A plan, not an implemented graph. | Not a comparison subject. A later measured under-use finding may bear on it, but no such finding exists yet. |
| **eoWebLLM hypergraph** | A sibling application's progressive ingestion/retrieval structure. | Governed and implemented outside this repository. | Explicitly excluded: shared vocabulary is not shared implementation or evidence. |

The chosen subject is therefore **a cursor-stamped snapshot of the engine
belief graph produced through `packages/host` for one disclosed reading**,
not “the project hypergraph” in the abstract.  The snapshot must preserve
the reading specification, injected priors and their givers, source
provenance, cursor/tick, node records, verb-inclusive edges, structural
edges, weights, and the fact that absent edges may have decayed or been
pruned.  It must not present the final activation state as a persistent
knowledge base.

This selection is not “whichever is easiest to export.”  It is selected
because the research question begins with the representation an engine
reading itself produces.  The verifier asks a downstream claim-grounding
question, while the claim-id log supplies a future address for testimony;
neither substitutes for measuring the upstream reading product.

### Export and comparison seams already present

No new export mechanism is licensed yet.  The graph organ already exposes
plain `Map`-backed nodes and edges plus graph provenance, while the host has
an explicit `CorpusSession@1` serialize/reimport boundary for admitted spans,
documents, and provenance.  A future eval driver should compose those
existing seams rather than introduce a graph store.  Any snapshot format is
an eval artifact first and must say that it captured a changing belief at one
tick.

The network golden supplies the transferable scoring discipline, not an RDF
scorer ready for reuse.  It already separates candidate discovery,
spelling-based referent resolution, consequence-based alias resolution,
causal entity admission, and permutation-tested links.  RDF entity labels or
aliases may therefore **nominate** a correspondence through the real
referent machinery; they may not decide one through a new fuzzy threshold.
Entity correspondence and relation correspondence remain separate reports.
The existing literary references are undirected co-occurrence networks and
cannot validate RDF predicate type, direction, or polarity.

### Standing

- **shown:** the five-way map and selected subject are an architectural
  reading of the checked-out files, not an RDF measurement.
- **received:** the requested roles of the-fold P39, live_priors, Wikidata,
  DBpedia, and the absent constitutions are received from the research brief
  for this pass; they have not been independently admitted from local bytes.
- **gap:** no commensurable corpus/RDF pair, received RDF snapshot, human
  correspondence labels, matcher calibration, null battery, or comparison
  result exists yet.
- Evidence flags: `real_ground=false`, `descended_to_rows=false`,
  `counted_search=true`, `independent_rerun=false`.  The counted search is a
  repository search for RDF/SPARQL/OWL and the named organs; it is not
  evidence of RDF quality.

### What it changed

It fixes the subject of the next pass without changing runtime code: compare
the host-assembled engine belief graph at a declared cursor.  The-fold's
verdicts and testimony spine remain downstream consumers/records of that
comparison, not aliases for its subject.

### Open, not yet attempted

1. Mount or otherwise provide the named sibling repositories and governing
   documents; run the-fold's setup script and baseline suite there before
   touching shared code.
2. Read the-fold P39 implementation and policy from its own bytes and decide
   how a comparison verdict is appended to its testimony spine.
3. Inspect `live_priors` publisher frontmatter and toggle ledger; choose one
   enabled government/legal document only after checking that the same
   subject has substantive RDF coverage.
4. Define a reproducible, giver-named, local RDF acquisition artifact with a
   snapshot date.  Do not perform an ambient network fetch from an eval run.
5. Specify the cursor-stamped graph snapshot by composing the host session
   provenance and existing graph state; do not add a persistent graph store.
6. Build a small human-labelled correspondence set before reporting an
   automatic match rate.  Record nominated, confirmed, and refused entity
   correspondences separately.
7. Compare entity correspondence separately from predicate/direction/
   polarity structure, and run the same pipeline on a perturbed input as its
   commensurable null.
8. Only after a measured discrepancy exists, run the shipped grammar
   diagnostics and inspect shared-organ callers before proposing a grammar,
   logical-layer, or live-prior ingestion fix.

## Pass 1 · 2026-08-20 · Run the available assessment; refuse the absent one

### What was tried

`goldens/rdf/rdf-belief-assessment.mjs` ran the selected host-assembled belief graph
over the repository's Project Gutenberg *Frankenstein* fixture.  It then ran
the identical `createSession` → `admitChunked` → `admitGraph` →
`sessionGraphSnapshot` path over a declared sentence-order reversal.  The
driver records the material digest, giver, transformation, graph cursor and
shape in `goldens/rdf/results/rdf-belief-frankenstein.json`.

Wikidata was also approached as the prospective received giver through its
SPARQL endpoint, entity search API, and `Special:EntityData`; DBpedia's JSON
document endpoint was tried independently.  Every HTTPS request was refused
by this environment's CONNECT proxy with HTTP 403.  No remembered or
hand-authored triples were substituted.

### What happened

The observed run admitted 210 chunks and produced 5,991 node strings and
9,803 live edge keys at tick 1: 4,935 verb-bearing keys, 4,868 structural
keys, and 356 negative keys.  The sentence-reversal run produced 5,993 nodes
and 9,808 edges: 4,938 verb-bearing, 4,870 structural, and 364 negative.

This is a measured **shape result**, not an RDF agreement result.  In
particular, the observed strongest nodes begin with pronouns and function
words (`i`, `and`, `you`, `he`, `it`), and the snapshot carries edge keys but
zero stable external entity identifiers.  That is a concrete entity-
alignment obstacle upstream of RDF predicate comparison.  The near-equality
of the order null is also not evidence of robustness: the host admits this
whole document to the graph in one call (tick 1), so graph decay never sees
the sentence order as a sequence of cursors.  This attempt therefore exposes
that a staged cursor-level run is required for the planned temporal null.

The RDF-quality verdict is **refused**, with zero RDF triples and zero
confirmed correspondences.  Reporting an overlap percentage from those rows
would turn failed acquisition into a false finding.

### Standing and what it changed

- **measured:** local graph and null shape; `real_ground=true`,
  `descended_to_rows=true`, `counted_search=true`,
  `independent_rerun=true` (the executable artifact rebuilds both rows).
- **refused:** RDF entity/relation quality; `received_rdf=false` and
  `confirmed_correspondences=false`.
- **gap:** staged graph admission and a giver-named RDF snapshot.

The programme now has a rerunnable eval rather than documentation alone, and
it has two discrepancy leads: noisy/non-external node identity at the host
graph seam, and a one-tick admission path that is not an adequate temporal
null.  Neither licenses an engine correction until the RDF rows and human
correspondence decisions exist.

### Open, not yet attempted

1. Re-run the acquisition builder where Wikidata/DBpedia egress is available,
   freezing response bytes, request, retrieval date, digest, and giver.
2. Replace *Frankenstein* with a toggle-enabled `live_priors` government/legal
   source once that sibling corpus is mounted; keep this run as the pipeline
   assay, not the headline corpus.
3. Run graph admission at declared staged cursors so sentence/order
   perturbation can exercise decay through the same pipeline.
4. Hand-confirm/refuse a calibration sample of nominated external IDs before
   computing entity coverage; only then compare predicate, direction and
   polarity separately.

## Pass 2 · 2026-08-20 · Give the order null a clock

### What was tried

The assessment now divides the already-declared sentence stream into 136
fixed stages of 25 sentences each.  Every stage is admitted as a separately
addressed host document and immediately passed to `admitGraph`; the observed
run reads stages forwards and the null reads the identical stages backwards,
without reversing sentence order inside a stage.  Both rows record every
admission cursor, original material cursor, graph tick, stated-relation count,
and live node/edge shape.  The graph still uses the host's declared decay and
pruning policy; the driver adds no graph or threshold.

### What happened

Both readings admitted 272 host chunks across 136 stages and reached graph
tick 77.  The forward reading ended with 292 nodes and 72 live edges (36
verb-bearing, 36 structural, 6 negative); the reverse-stage null ended with
the same 292 nodes but 96 live edges (48 verb-bearing, 48 structural, 8
negative).  Both trajectories reached 122 live edges before later decay and
pruning.  Unlike the one-tick assay, this is a real order-sensitive result:
the same staged bytes reach different final live beliefs because their
relations arrive at different graph ticks.

It is not an RDF-quality result.  Staging deliberately changes extraction
context from the whole-document assay, so the much smaller graph is not a
quality improvement and must not be compared to Pass 1 as though only the
clock changed.  The received-RDF row remains empty and the RDF verdict remains
refused.

### Standing and what it changed

- **measured:** staged graph trajectory and stage-order null;
  `temporal_null_exercised=true`, `independent_rerun=true`.
- **refused:** RDF entity/relation quality; `received_rdf=false` and
  `confirmed_correspondences=false`.
- **gap:** a giver-named RDF snapshot, human correspondence decisions, and a
  staged reading design whose extraction context has been independently
  justified for the eventual comparison corpus.

The prior temporal-null gap is closed at the level of an executable assay.
The observed 24-edge final-state difference is a diagnostic showing that a
declared cursor matters, not a warrant to change decay or pruning.

### Open, not yet attempted

1. Acquire and freeze the giver-named RDF bytes where egress is available.
2. Mount and select the toggle-enabled `live_priors` source under its own
   governing documents.
3. Hand-confirm/refuse nominated external IDs before any coverage percentage.
4. Decide and disclose the staged unit for that source independently of its
   score; retain both the material cursor and graph tick in every result.

## Pass 3 · 2026-08-20 · A connector slot is not evidence of a verb

### What was tried

The relation vocabulary now accepts an optional, giver-named `POSPrior@1`.
When the host receives English material it loads the checked-in aggregate
counts built from the human-annotated Universal Dependencies English EWT
treebank.  A connector form must have at least one attested `VERB` or `AUX`
reading to enter the vocabulary.  Ambiguous forms remain candidates; this is
not a tagger and does not decide the class of the present occurrence.  Forms
attested only as nouns, pronouns, adpositions, and other non-verb classes no
longer become verbs merely because they occupied the connector slot.

The gate was run both absent and present through the same whole-document host
path on *Frankenstein*, *Alice's Adventures in Wonderland*, *Pride and
Prejudice*, and the repository's Butler *Odyssey*.  A disclosed four- or
five-name human sanity register was applied only after each reading.  It is a
calibration check against familiar central beings, not an RDF reference and
not an answer key supplied to extraction.  The edition's own `Ulysses` and
`Minerva` spellings are used rather than silently modernising them.

### What happened

The POS gate refused 1,954 of 4,935 proposed *Frankenstein* relations, 611 of
2,055 for *Alice*, 4,932 of 13,580 for *Pride and Prejudice*, and 4,474 of
14,982 for the *Odyssey*.  All disclosed sanity entities remained present:
5/5 for *Frankenstein* and 4/4 for each other document.  This demonstrates a
cross-document reduction in a specifically named error class without losing
the small human calibration register; it does not establish full relation
precision or recall.

The staged artifact consequently supersedes Pass 2's raw shape numbers: it
now ends at 169 nodes and 72 live edges forward versus 169 and 74 under the
stage-order null.  The remaining nodes still include pronouns and ordinary
noun phrases because the host belief graph intentionally accepts unresolved
surfaces.  In particular, the Creature remains a declared gap in this blind
host assay: the repository's received *Frankenstein* coreference prior knows
its lowercase descriptors and narrator scopes, but the host corpus path does
not currently inject that prior.  That gap is recorded rather than filled
from literary memory.

### Standing and what it changed

- **improved and measured:** connector-class false admissions across four
  independently received documents; the before/after rows are checked in.
- **shown:** the small familiar-character register survives the gate; it is
  human calibration, not exhaustive entity or relation truth.
- **refused:** RDF quality, full SVO precision/recall, and automatic Creature
  identity; no RDF rows or relation-level human labels have been received.

### Open, not yet attempted

1. Label a stratified sample of kept and refused connector occurrences in
   context; type-level attestation cannot settle genuinely ambiguous forms.
2. Compose the existing received coreference-prior seam with the host reading
   without baking a *Frankenstein*-specific alias into the engine.
3. Acquire giver-named RDF bytes and confirm entity correspondences before
   comparing predicates, direction, or polarity.

## Pass 4 · 2026-08-20 · Hand-check what the counts concealed

### What was tried

Twelve document-grounded facts were hand selected, three per comparison
document.  Every row carries an exact anchor that the executable assay first
requires to exist in the received bytes, then asks whether the POS-gated host
relations contain the expected subject, predicate, object, and polarity.  The
facts are applied after extraction and cannot alter its vocabulary or graph.

The hand pass also corrected the POS rule exposed by inspection.  “Attested
once as a verb” admitted annotation outliers such as `by` (574 ADP uses and
one AUX use in EWT).  The gate now requires VERB+AUX to comprise a strict
majority of attested uses.  Conversely, an unseen form is recorded as a prior
gap and remains eligible: the EWT witness cannot testify that an archaic or
literary form it never saw is not a verb.

### What happened

The answer to “is it getting all that we need?” is **no**.  The hand rows find
6/12:

- *Frankenstein* 1/3: `Felix instructed Safie` is recovered; Victor creating
  the being and the monster murdering Clerval are missed.
- *Alice* 2/3: the Rabbit noticing Alice and Alice hearing the Rabbit are
  recovered; the Queen speaking to Alice is missed.
- *Pride and Prejudice* 1/3: Elizabeth looking at Darcy is recovered; Jane's
  affection for Bingley and Darcy's love for Elizabeth are missed.
- *Odyssey* 2/3: Minerva resolving to help Ulysses and Ulysses speaking to
  Telemachus are recovered; Penelope mourning her husband/Ulysses is missed.

The pattern is more informative than the aggregate count.  The recovered rows
are mostly literal named-subject/named-object clauses.  The misses require
first-person narrator identity (`I` → Victor), descriptor identity (monster →
Creature), possessive or pronoun resolution (`her husband` → Ulysses, `his`
love → Darcy), or a wider speech attachment.  Those are existing disclosed
coreference/model-tier gaps, not connector-class failures, and lowering the
POS gate cannot recover them.

The stricter-but-gap-preserving POS rule reduces stated relations from 4,935
to 2,925 on *Frankenstein*, 2,055 to 1,480 on *Alice*, 13,580 to 7,731 on
*Pride and Prejudice*, and 14,982 to 9,205 on the *Odyssey*, while retaining
every entity in the small sanity registers.  The staged *Frankenstein* graph
is now 177 nodes/80 edges forward and 177/72 under the order null; these
figures supersede Pass 3.

### Standing and what it changed

- **measured:** 6/12 hand relation checks and four before/after POS rows.
- **corrected:** type evidence now requires verb-majority attestation;
  unattested forms are gaps rather than automatic refusals.
- **gap:** the minimum familiar-relation checklist is not complete.  RDF
  comparison remains blocked upstream by unresolved identity and attachment.

### Open, not yet attempted

1. Route the repository's existing giver-named narrator/coreference priors
   through the host graph path, then rerun these same frozen hand rows.
2. Add occurrence-level class resolution for forms with genuinely mixed POS
   evidence; do not weaken the type gate to recover identity failures.
3. Expand the hand set with independently labelled negative and directional
   relations before treating predicate or polarity rates as calibrated.

## Pass 5 · 2026-08-21 · Resolve beings, not preferred spellings

### What was tried

The host graph seam was traced again from `sessionRelations` to
`referentLookup`.  The suspicion was correct: canonicalisation asked whether
an entire extracted side exactly equalled one preferred surface, then wrote
the preferred display string into Network.  Thus `Alice` and `to Alice` were
different nodes, prior surfaces stored as objects became the string
`[object Object]`, and a graph described as referent-fed actually carried
display spellings.

`referentLookup` now composes the received and discovered cast, normalises
string and object-shaped prior surfaces, and resolves a relation side only
when its phrase contains exactly one referent.  Zero matches remain a surface;
multiple matches are refused as ambiguous.  The graph receives the stable
referent id, never the current display label.  Relation extraction now carries
subject and object offsets, allowing first person to resolve through received
narrator spans at the position where that side occurred.  The same resolver
is used by one-shot graph admission, staged terrains, and the assessment.

### What happened

The hand assay now requires **both endpoints to be referent ids**.  A raw
surface that happens to spell the expected name no longer earns a hit.  Under
that stronger and more relevant question the result is 4/12, not the earlier
6/12: *Frankenstein* 1/3, *Alice* 0/3, *Pride and Prejudice* 1/3, and the
*Odyssey* 2/3.

This lower number is a correction, not a regression.  Alice herself is not a
resolved graph being in this received edition: blind discovery produced a
TOC-shaped `XII Alice Evidence` referent rather than the protagonist, while
the White Rabbit did resolve under one id whose preferred internal id happens
to be `ref:auto:white`.  The old string-substring sanity check counted raw
`Alice` and would have counted only ids containing the expected spelling; both
mistook spelling for identity in opposite directions.  The assessment now
checks expected names against each referent's full surface set, while relation
rows require the actual endpoint ids.

The received *Frankenstein* prior is now passed into the assessment.  Its
descriptor surfaces and Walton/Victor/Creature narrator scopes participate in
resolution, but the two central missed facts remain missed because the SVO
attachment does not expose `created` and `murdered Clerval` with the needed
referent-bearing sides.  Correct identity cannot repair a relation that was
never structurally extracted.

### Standing and what it changed

- **corrected:** Network nodes are referent ids where identity is uniquely
  resolved; display strings are presentation only.
- **measured:** 4/12 fully referent-resolved hand relations.
- **gap:** Alice protagonist discovery, descriptor/pronoun attachment, and
  the unresolved central *Frankenstein* relations.

### Open, not yet attempted

1. Diagnose why `extractSurfaces`/`discoverReferents` loses plain Alice while
   admitting the table-of-contents-shaped referent; fix discovery from form,
   not by adding Alice to an engine list.
2. Carry received priors into staged readings without resolving whole-book
   narrator anchors independently inside each fragment.
3. Inspect the missed anchored clauses at the relation-attachment layer before
   adding any new referent or predicate mechanism.

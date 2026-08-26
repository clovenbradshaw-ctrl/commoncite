# The lossless ladder — a case, and the laws that generate it

The question this case answers: *can the engine climb from entities to kinds
all the way up to paradigms, folding losslessly — reducing resolution without
making anything up, always able to drill back down?*

The short answer, measured on `pg84.txt` (Frankenstein, 438,841 bytes,
host-aligned): the climb exists and drills down losslessly on relations. It
is not a ladder in time — it is a **helix**. The ladder is the fold frozen at
one pass; the helix is the fold running, where every altitude's output is a
prior for the next arrival and recall is activation, not re-aggregation.

Constitution: Article **II.13 — The lossless fold test** (amendment 8th),
enforced as `fabricates_at_altitude`.

---

## The rungs, measured

Everything below uses the engine's own organs and nothing typed in — the
verb vocabulary is `discoverRelationVocab`, measured from the material
(tokens following the blind-discovered cast), never a hand list (II.1).

| rung | organ | pg84 result |
|---|---|---|
| material | host spans | 220 byte-accurate spans |
| entities | `extractSurfaces → discoverReferents → projectReferents` | **110 referents** (Ingolstadt 16, Elizabeth 92, Victor 28; the creature is invisible — lowercase mid-sentence, hence the curated coref prior) |
| relations | `extractRelations` gated losslessly | **2898 kept**, every one verbatim (subject/verb/object phrases + byte addresses); only 15 resolve on both ends to a referent |
| kinds | `deriveBeingRecords → understand` over the graph | 1 kind — the rung does not cohere on this corpus's sparse resolved graph |
| tiers | `createTierStack` + `foldThrough` over node+edge arrivals | **atmosphere 249 observed / 11 shifted, lens 11 / 1, paradigm 1 / 0** — altitude is reached, from zero before |

The gate that used to kill the climb: `read-tiered.mjs`'s strict rule (both
ends of an SVO triple must resolve to a referent) kept **9 of 2576** triples.
The lossless gate keeps the triple whenever it carries verbatim text, and
resolves what it can: `resolve` binds a first-person **terminal** token
(`that I`, `and I`, `I`) by narrator scope (`narratorAt`), else the longest
surface. Measured: 270 named, 136 bound by scope, 453 typed gaps.

## Drill-down — the address, never the answer

For each benchmark query, does a fold rung reach the answer's byte?

| query | answer @ byte | relation drills it? |
|---|---|---|
| where did victor go to school | 55560 ("Ingolstadt") | **YES** — `[that I] should [become a student at the university of Ingolstadt]`, object → `ref:auto:ingolstadt` |
| what did victor study at university | 48010 ("natural philosophy") | **YES** — `[Natural philosophy] is [the genius that has regulated my fate]` |
| why did the narrator flee from the creature | 86787 ("rushed out of the room") | NO — "rushed" is not in the measured vocab (it follows a pronoun, never a surface); the relation rung is blind to first-person events. **Verified: the lexical fold fails it too** — `searchSpans` top-1 is byte 22056 (a creature-mention), not the flight scene; the flee query is unreached by every measured rung |
| who strangled william / create a female / brought to life | — | NO relation covers them (each already answers lexically in eochat) |

This is the load-bearing finding: **school and study — two queries the
lexical fold fails on (searchSpans ranks 162 and 56; verified here — neither
answer ranks top-1) — are drilled verbatim by the relation rung.** The ladder
reaches what proximity cannot.

The flee query is the opposite side of the same coin, verified: `searchSpans`
answers it with byte 22056 (a "creature" mention) while the flight scene's
byte 86787 never ranks — a wrong rank served silently, not a typed gap. That
silent wrong rank is the risk the fold was built against (II.13), and it is
exactly the place the ladder needs the fold prior (see below), not a patch to
the verb vocabulary (L2).

## Where the climb honestly stops

- **First-person events are unmeasurable by the surface-anchored vocab, and
  this is a SEPARATE gate from who "I" is.** `discoverRelationVocab`
  (`perceiver/text/relations.js`) admits a verb candidate only when it
  follows a token `extractSurfaces` already found — a capitalised run — never
  a pronoun. "rushed", "fled" follow `I`, not a surface, so they cannot enter
  the measured vocabulary no matter whose voice `I` resolves to. This limit
  is unchanged by the fix below and cannot be, without a different admission
  rule than the one II.1 and this ladder's own L2 already argue for (measured
  recurrence after a candidate the text itself supplies, never a hand list —
  "rushed" recurs after `I`, not after a name, in this book).
- **The narrator prior covered only the creature's tale — closed 2026-08-04,
  measured, and it did NOT fix the flee query.** This section originally read
  "Victor's and Walton's 'I' are 453 typed gaps. The flee scene is not even
  attributed to Victor," implying attribution was the missing piece. It was
  half right: `eoPriors/priors/coref/pg84-frankenstein.json` now carries
  `narratorSpans` for `walton` and `victor` too, chained end-to-end against
  the book's own frame seams (Letters 1–4 → Chapter 1's first line → the
  creature's existing spans, unchanged → resumed at "The being finished
  speaking" → "Walton, _in continuation._" → the close), and
  `resolveAllNarratorSpans` (new; `perceiver/text/narrator.js`) fixed a real
  bug — the three scripts that consumed this prior each called
  `coref.referents.find(r => r.narratorSpans...)`, which silently used only
  the FIRST referent carrying spans and dropped the rest, so adding Victor
  and Walton to the file alone would have changed nothing. Controlled
  before/after, identical script and book, only the prior swapped:

  | | before | after |
  |---|---|---|
  | narrator spans resolved | 3 | **7**, 0 unresolved |
  | policy A: bound by scope / typed gaps | 136 / 453 | **589 / 0** |
  | policy B: bound by scope / typed gaps | 104 / 265 | **369 / 0** |

  Every narrator-attribution typed gap in the book closed — Victor's and
  Walton's "I" now resolve everywhere, including through the one nested case
  (the creature's closing speech, quoted inside Walton's own final letter:
  `resolveAllNarratorSpans` sorts narrowest-span-first so the quotation
  resolves to the creature, not to Walton, who merely contains it). And the
  flee query, re-run against the fixed prior: **still `relation covers: NO`**.
  `narrator scope: victor` now shows correctly at that byte — attribution
  works — and the relation is still absent, because "rushed" never entered
  the vocabulary in either run, for the reason in the bullet above. The two
  limits are independent, not two symptoms of one cause; closing one is real
  and measured and left the other exactly where it was.
- Both limits are **witness-shaped**: they resolve by receiving a prior with
  a giver, never by deriving (II.2). The flee answer is a scene, not an
  entity — the prior that reaches it is a fold prior (a distribution over a
  scene), which is the eoPriors shape: priorMass → Void, priorBond → Field.
  Closing it needs a different admission rule for the vocabulary gate, not
  another prior of this shape.

## Ladder or helix

A ladder is what you get when you freeze the fold at one pass and cut it:
rung n is a lossless reduction of rung n-1, each rung keeps byte addresses,
so you always drill back down. The tiers are NOT another stack of knobs —
tier 1's prior is what tier 0's surprises accumulate into, tier 2's what
tier 1's shifts accumulate into, tier 3's what tier 2's shifts accumulate
into (tiers.js: "meaning folds on itself"). And a tier only observes when the
tier beneath it was surprised — altitude is earned, not configured.

The process is therefore a helix:

- the top of the ladder is a **prior**, and a prior re-enters the bottom of
  the next reading (III.2: the engine holds no prior — the fold's output is
  handed back as ground);
- the graph's belief feeds back (graph.js: the prior is a graph and it
  evolves — a relation not restated fades, so a motif returning after long
  absence can move belief again);
- recall is **activation** — Hebbian edges written at read time, one
  recurrent hop for pattern completion, incremental idf/df (a motif needs
  df ≥ 2 before it can recall — the third occurrence is the first that can);
- the drill-down is a helix descent: from the fold, re-entering the material
  at the byte the fold addresses.

Freeze one pass and you see a ladder. Run it and it is a helix, because
every altitude loops back into the reading as a prior.

## The laws that generate the fold

These are the generating constraints — what makes the fold a helix and not an
index. They are stated here as the case's record; the constitution carries
the principle (II.13) and this file carries the shape.

**L1 — Lossless, or it is not a fold.** A fold reduces resolution and never
adds content. Whatever any altitude asserts, a drill-down path reaches the
material beneath it — a kind to its members, a member to its passages, a
passage to its bytes. A fold that cannot be drilled back down is a summary,
and a summary is a surrogate (II.6). A fold is kept with its byte addresses,
or it is not kept.

**L2 — Measured, never listed.** Every vocabulary the fold climbs with —
verbs, surfaces, function words — is measured from the material
(`discoverRelationVocab`, `functionWordSet`, `extractSurfaces`). No hand
lists of verbs, nouns, or relations. A candidate is admitted only when the
material repeats it in the slot the grammar gives it; a caller that hands in
no vocabulary gets no triples back, never a guessed one.

**L3 — The arrow of time.** Every fold is computed causally, left to right.
There is no whole-document table: idf and df are incremental, belief decays
per observation (`gamma = 1 - 1/window`), and a tier observes only when the
tier beneath it was surprised. A fold that conditions on material it has not
read yet is not a reader; it is an index. (A corpus-wide reading is a legal
*record* — read-tiered and this case are records — but it is not the
technique. The technique is the reader.)

**L4 — Activation, not aggregation.** Recall is written at read time: Hebbian
encoding when motifs co-occur in a frame, sparse coding (a motif is a key
only once it has already recurred), pattern completion by one recurrent hop.
Proximity is not recall — a diffuse spread that pools a passage's own dense
vocabulary drowns the distant target. The fold is the memory; the memory is
the wiring, and it is never recomputed from proximity at query time.

**L5 — The witness is a prior, and it re-enters.** What the material cannot
say about itself — which being a name denotes, who "I" is at a byte, that
"flee" and "rushed out of the room" name one event, that "school" and the
"university of Ingolstadt" answer one question — is received with its giver,
never derived. The re-injection of a prior into the climb is the helix's
turn. Where the ladder needs a witness and has none, it reports a typed gap
(II.2, III.3) — it never fills it.

**L6 — A typed gap is a result.** The flee scene has no measured verb, and
the narrator prior does not name Victor. Both are findings, reported as such,
not patched. Fabricating the bridge is refused everywhere the measurement
lives (II.13). The next turn of the helix receives the gap as its ground.

---

## Reproduce

The ladder probes run against `/Users/mlacy/Documents/Default Project/pg84.txt`
with the engine at `/Users/mlacy/Documents/2.0/eoreader6`:

- `node scripts/read-tiered.mjs` — the strict, all-resolved climb (9 triples).
- `node scripts/read-people.mjs` — entities → kinds over the graph.
- the enriched lossless ladder + drill-down audit (probe-ladder-full /
  probe-audit2 in the probe workspace) — the numbers above.

The probes are measurement scaffolding; if the relation rung ships, it ships
as a causal reader (L3/L4), not as the whole-text extraction used to measure
it here.

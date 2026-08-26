# The agency-civic golden

## The question it asks

Every other golden in this directory certifies something the engine
discovers *about* a text (a cast, a shape, a structural boundary). This one
certifies something different: whether the engine's own **silence** — a
clause where no Link gets admitted — is a *reading* or an *artifact*.

`perceiver/text/relations.js` self-labels its cell as **CON · Link ·
Binding**: a subject/verb/object triple, "the graph's medium-specific
mouth." It is order-dependent by construction (subject before verb before
object) and requires the subject to resolve to an already-admitted referent
(a named surface, or a pronoun resolved through `pronouns.js`'s
`minActivation`/`minMargin` floor) before the clause counts as having named
its agent. If that mechanism's silence tracks real agentlessness in civic
prose — passive constructions with the actor dropped, bureaucratic
nominalizations with no agent slot at all — then an **agentlessness meter**
built on admitted-Link density per clause is a real finding: *this document
declines to say who acted, more than its own genre does*. If the silence
instead just tracks the mouth's own word-order prior failing to fire on
ordinary variation, every claim built on Link occupancy in civic text is
unsupported, however interesting it sounds.

That is the whole question. One binary judgment, one correlation, one
verdict — reported only after its own ceiling and its own floor are on the
table.

## Why this golden and not the others sitting on the same shelf

Three other numbers in this repo are declared, never defaulted, and have no
validating golden: `host/corpus.js`'s `PRONOUN_MIN_ACTIVATION` /
`PRONOUN_MIN_MARGIN` (0.05 / 0.2), `emergence/activation.js`'s `MIN_LEN`,
and the apparatus floor at 15% (calibrated on one novel plus one
hand-authored wire-service fixture). This golden validates **none of
them** — see "What this golden is explicitly not for," below. It exists
because it is the one claim on this list with the **highest ceiling** (a
binary "does this clause name who acted" is a judgment two readers agree
on, unlike coreference in a deposition, which is precisely the
low-agreement task that burned MUC-3/4 a generation ago) and the **only**
one with **zero existing ground truth anywhere** — LitBank and GUM give
coreference for free; agency-in-municipal-prose exists nowhere as a public
resource. It is also the highest-leverage claim: Link yield as an
agentlessness meter is a genuinely new reading this engine has never made
before, not a recalibration of a mechanism it already trusts.

## What this golden is explicitly NOT for

**Not a coreference golden.** Annotators never resolve which real-world
entity a name or pronoun refers to (see `GUIDELINE.md`).

**Not ground truth about who actually acted.** Only about whether the text
says so. A clause reads NAMED even when the annotator has outside knowledge
that a different body actually made the decision.

**Not for tuning `minActivation`, `minMargin`, `MIN_LEN`, or the 15%
apparatus floor.** Those are separate holes with separate goals. This
golden's `engine-score.mjs` *reuses* `PRONOUN_MIN_ACTIVATION` /
`PRONOUN_MIN_MARGIN` at their existing declared values (restated, not
re-derived) purely so the composite admission test has a pronoun-resolution
step at all — using them is not validating them, and no script in this
directory writes back to `host/corpus.js`'s constants or reports a
recommended value for them. Borrowing this golden to calibrate those
numbers is exactly how a golden quietly becomes a hand list that touches
the fold — see "The firewall," below.

## Method

1. **Corpus** (`texts/`, `provenance.json`) — three genres of real civic
   text: Metro (Oregon regional government) ordinances, their attached
   staff-report memos, and one federal deposition transcript (Mark Meadows,
   Select January 6th Committee — a no-show deposition, Q&A register).
   Sourced 2026-08-06, hashed, licensed on the government-edicts doctrine
   (ordinances) and 17 U.S.C. §105 (the federal deposition transcript). One
   staff-report PDF was excluded outright after PDF extraction silently
   dropped words mid-sentence with no detectable signature — see
   `provenance.json`'s note on `metro-ord-24-1514`.

2. **Clause sampling** (`extract-clauses.mjs`) — sentence boundaries reuse
   the engine's own tested `spans.js::splitSentences`; clause boundaries
   below that are a **declared, deliberately weak** mechanical split
   (semicolons, comma-introduced coordinating conjunctions and relative
   clauses) — never the engine's own SVO-triggered boundary, which would
   make the sample circular (only ever drawing clauses the engine already
   agrees are clauses). 208 clauses survived quality filtering from a
   296-clause candidate pool (drops logged, never silent — boilerplate,
   PDF-extraction corruption signatures, source redactions).

3. **Guideline** (`GUIDELINE.md`) — one binary-plus-one-bucket judgment per
   clause: NAMED / AGENTLESS / NOMINALIZED / SKIP. Annotators always see the
   full sentence around the target clause, never resolve outside it.

4. **The panel** (`data/panel/`) — **an LLM-panel proxy, not a human
   ceiling.** Four independent, context-isolated Claude agents each
   annotated all 208 clauses from the guideline alone, blind to each
   other and to the engine's own output. This is a smoke test, run because
   real multi-annotator human judgment could not be fabricated in this
   session without undermining exactly the discipline this golden is built
   to enforce (see the project conversation this golden was built from).
   **A real human-annotated pass is still required before this golden's
   correlation can be reported as a certified finding** — see "Status,"
   below.

5. **Engine scoring** (`engine-score.mjs`) — NOT `emergence/binding.js`'s
   `bindLinks`/`readLinks`, which answers a different, document-pairwise
   question (do two named entities co-occur more than chance across a
   whole reading) with no clause-scoped output. The Link tested here is
   `relations.js`'s own: a clause's agent counts as **admitted** when
   `extractRelations` finds a subject/verb/object triple in it AND the
   subject resolves to an already-discovered referent (named surface, or a
   pronoun resolved through `resolvePronouns`'s declared floor) — the exact
   composite `host/corpus.js`'s own `agency` signal already computes
   per-referent (`referentOwnsSubject`, lines ~835), kept per-clause here.

6. **Rotation control** (`rotation-control.mjs`) — the floor: each clause's
   own words, shuffled (deterministic seeded shuffle, reproducible), scored
   through the *same* pipeline against the *same* document's real
   discovered surfaces and vocabulary. Isolates exactly the risk under
   test — does admission require real word order, or does it fire on a bag
   of the same words regardless of order.

7. **Analysis** (`analysis.mjs`, `stats.mjs`) — reports, strictly in this
   order: the panel's agreement (Fleiss' kappa; the golden is refused below
   `kappa = 0.4` — Landis & Koch's own "moderate" floor — before any system
   number is reported as a finding); the rotation-control floor alongside
   the real admission rate; the phi coefficient / chi-square /
   precision-recall of engine-admitted vs. panel-majority NAMED; and a
   partial correlation controlling for clause length and a nominal-density
   proxy (content-word tokens that are not the document's own discovered
   verbs, divided by clause length — a declared, weak stand-in for
   noun-phrase density; this repo has no POS tagger, and this proxy's
   limits should be read as exactly that, not overclaimed).

## Results

Run 2026-08-06, `data/analysis-results.json` is the machine-readable record;
`node goldens/agency-civic/analysis.mjs` reproduces every number below.

**(1) Ceiling.** Fleiss' kappa across the 4-annotator LLM panel, 208 clauses
x 4 categories: **κ = 0.920** (96.1% mean pairwise agreement). Well above
the κ = 0.4 "moderate agreement" floor this script refuses the golden
below. Read this the right way round, though: **this is a ceiling on
whether the guideline is followable, not a ceiling on human agreement.**
Four instances of the same model family, given the identical guideline
text, are expected to correlate with each other more than four independent
human annotators would — shared training, shared failure modes, no genuine
independence of judgment. A real human pass could easily land lower. What
κ = 0.92 does establish: the guideline is specified precisely enough that
a careful reader applying it gets a stable answer, which is the necessary
(not sufficient) condition for a human pass to be worth running at all.

**(2) Floor.** Real corpus: **22/208 clauses (10.6%)** got an admitted
Link. Word-shuffled rotation control on the same clauses, same document
context: **7/208 (3.4%)**. Real exceeds the floor by 3.1x — admission is
not pure noise — but the floor itself is not negligible: roughly a third of
real admissions could, in principle, have happened by word-salad luck on a
clause this short.

**(3) The correlation — and this is the headline result.** Against the
panel-majority label (170/208 clauses had a clear majority; 38 were
SKIP/no-majority and excluded, not folded into either bucket):

| | human: NAMED | human: AGENTLESS/NOMINALIZED |
|---|---|---|
| **engine: admitted** | 19 | 1 |
| **engine: silent** | 124 | 26 |

phi = **0.109**, chi-square(df=1) = 2.01, **not significant at p<0.05**.
Precision is high (engine-admitted → human-NAMED: **95.0%**) — when the
mouth does speak, it is almost never wrong. Recall is not (human-NAMED
clauses the engine actually admits: **13.3%**). **124 of 143 clauses a
majority of the panel says name their agent got no admitted Link at all.**
False negatives are not concentrated in one genre — of the clauses a panel
majority calls NAMED, the engine catches 3/36 in ordinance, 4/53 in
staff-report, 12/54 in deposition. Recall is low across all three
registers (8%, 8%, 22%) — this is `relations.js`'s own word-order
requirement (subject before verb before object, subject resolving to an
already-admitted referent) missing ordinary variation broadly, not a
single genre's quirk. Deposition's Q&A register — shorter, more first/
second-person, more simple declaratives — comes closest to what the mouth
expects, and still misses more than three-quarters of its own NAMED
clauses.

**(4) Survives the length/nominal-density control**, for what that is
worth here: raw r = 0.109, partial r = 0.107 (99% retained). The
correlation is **not** a complexity detector in disguise — but that check
only matters once there is a correlation worth defending, and at
phi = 0.109, non-significant, there mostly isn't one yet.

**Read plainly: this run does not clear the bar.** The engine's silence on
these 208 civic clauses is dominated by false negatives — clauses a panel
majority reads as clearly naming an agent, that `extractRelations` simply
never turns into a triple, almost always because the clause's real-world
syntax (a relative clause, a fronted adverbial, a coordinated verb phrase,
an object-dropping intransitive) doesn't match the subject-verb-object,
comma/semicolon-bounded shape the mouth requires. High precision means an
admitted Link can be trusted when it happens. Low recall means its
**absence cannot** — which is exactly the failure mode this golden was
built to catch: *"the silence is just the mouth's word-order prior
failing."* On this evidence, that is closer to the truth than "the silence
is a reading." **Reporting Link yield as an agentlessness meter on civic
text is not supported by this run.**

## The firewall

This golden is consumed by evaluation and must never be consumed by the
fold. Three things enforce that structurally, not by convention:

- **Directory boundary.** Nothing outside `goldens/agency-civic/` reads
  from this directory. `conformance/agency-civic-firewall.test.js` asserts
  that `host/corpus.js`'s `PRONOUN_MIN_ACTIVATION`/`PRONOUN_MIN_MARGIN`,
  `emergence/activation.js`'s `MIN_LEN`, and `host/corpus.js`'s
  `APPARATUS_NAMING_SHARE_FLOOR` stay at their pre-existing values and that
  no file under `packages/` imports anything from `goldens/agency-civic/`.
- **One-way data flow.** `engine-score.mjs` reads `host/corpus.js`'s
  declared constants; nothing writes back. A future PR that changes
  `PRONOUN_MIN_ACTIVATION` because it improved this golden's correlation is
  exactly the failure mode this test exists to catch.
- **The panel is labeled everywhere it appears**, in code comments, in
  file names (`data/panel/`, never `data/human/`), and in every printed
  line of `analysis.mjs`'s output, as an LLM-panel proxy — so a later reader
  skimming a results file cannot mistake it for the human ceiling the
  success condition actually requires.

## Status

**Not certified as a finding.** This golden's LLM-panel-proxy run does not
support reporting Link yield as an agentlessness meter on civic text: the
correlation between admitted-Link density and the panel's NAMED judgment is
weak (phi = 0.109) and not statistically significant, driven by 87% recall
loss (124/143 panel-NAMED clauses got no admitted Link) rather than by
noise the length/nominal-density control could explain away. That is the
"the silence is just the mouth's word-order prior failing" outcome the
golden's own success condition named as the alternative to a real finding —
on this evidence, it is the one that happened.

**What would change this status:**

1. **A real human annotation pass**, replacing the LLM-panel proxy per
   `GUIDELINE.md`, run through the identical pipeline (`data/panel/` format,
   `analysis.mjs` unmodified). The panel's κ = 0.92 is an *optimistic*
   estimate of what a human ceiling would show (four same-model-family
   raters correlate with each other more than four independent humans
   would) — a human pass could still refuse this golden on low agreement
   before recall is even examined, which is a materially different, and
   equally legitimate, way for this golden to end.
2. Independent of (1): the recall failure is large enough (87%) that it is
   very unlikely to be a panel-proxy artifact — a real human pass changing
   this golden's verdict from "not supported" to "supported" would require
   the mechanism itself to change, not just the ceiling. Widening
   `relations.js`'s clause-terminal SVO match (right now: subject
   immediately before verb immediately before object, ending at the first
   `.`/`,`/`;`) to recover relative clauses, fronted adverbials, and
   coordinated verb phrases with an elided subject would be the concrete,
   falsifiable next step — and should be re-scored against this exact
   golden, not declared fixed by inspection.

This golden **stays in the repository regardless of the verdict.** A
golden that only gets committed when it confirms the thing under test is
not a golden.

## Known extraction noise

PDF-to-text extraction on the Metro ordinance packets produced two distinct
corruption modes, both from a template layout where a label/callout box
shares coordinate space with body text: (1) **interleaved characters**
(`SStTaRffA rTecEoGmICm...`), caught by `extract-clauses.mjs`'s
`\p{Ll}\p{Lu}` signature and dropped per-clause; (2) **silent word
dropout**, no distinguishing signature, caught only by manual review — one
whole staff-report source was excluded rather than left to a filter that
cannot reliably catch it (see `provenance.json`). Both modes are disclosed,
not hidden inside a clean-looking word count.

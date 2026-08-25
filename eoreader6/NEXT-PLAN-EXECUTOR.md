# Next: the plan executor — steering is a plan over the nine verbs, and physics executes it

Status note for whoever picks this up next. Written so the plan survives past
the session that wrote it, same purpose as `NEXT-LOSSLESS-READING-MANIFEST.md`
and `NEXT-LEVEL1-PROMOTION.md`. Read `READING-POLICY.md` first (P0–P6, attempt
log through A21) and then `NEXT-LOSSLESS-READING-MANIFEST.md`, because build
item 1 there — real organs feeding `event_log::tick()` — is a hard dependency
of everything below and is not restated here.

The question this file answers: what has to exist so that a reader can say a
compound sentence — "identify the motifs in this wave file," "show where this
book does not align with that dataset and chart the key concepts," "summarize
it" — and the engine performs it by dispatching organs it already has, with a
steering model contributing exactly three things (which verbs, at which
targets, rendered how) and zero mechanism. Not a new theory: this is the-fold's
L5 ("a compliance-critical fact is never left to the model's own
instruction-following" — measured there as zero addresses across six turns
from two models four times apart in size, fixed mechanically, never by a
better prompt) applied to the whole engine surface instead of one chat app.

## The claim, and the measured pattern behind it

The verb set is closed. `packages/engine/operators.js` derives all nine
operators from (mode, domain), refuses hand-listed diagonals (eoreader5's
own algebra refused five of its nine hand-listed cells), and fails at module
load if any operator has no organ claiming it ("unwired is failing").
`conformance/operators.test.js` pins the rest: 62 roster entries, each a live
export of its module (the test dynamically imports every one), each module's
declared `CELL`/`CELLS` matching the algebra's derivation, and the registry
itself pure — no imports, no `readFile`, no dynamic import — so dispatch can
never become content-derived classification (the cube-as-classifier was
measured and refuted at 95.7% assignment survival under word-shuffle; the
registry "may only dispatch on what a prompt names (a verb, a target, a
height) and on what an organ declares — never on content").

What is genuinely open-ended sits in exactly two places, and this repo's own
incident log already sorted them: admission-time form parsing at the world
boundary (`novelChapters`, `shakespeareScenes`, the CSV row-grouper — written
once per container convention, defended in CLAUDE.md's "when a rewrite is
still the right call"), and research scripts, which are science about the
engine, not operations of it. Every *unnecessary* rewrite CLAUDE.md names was
an analysis organ that already existed (`binding.js`'s per-pair permutation
null, hand-rolled worse as same-segment counting). The conjecture this file
turns into a build plan: a compound reading task is a **plan over registered
organs** — data, not code — and the only per-task code anyone should ever
write again is a new perceiver at the admission boundary or a new organ that
enters the roster once.

## What already exists — the executor is mostly assembled, in pieces that have never met

- **The registry and its order.** `operators.js::ORGANS` (62 entries, each
  `{id, module, fn, op, grain, verb, what}`), `organsByOp`, `cellOf`,
  `OPERATOR_ORDER = [NUL, SEG, SIG, CON, EVA, DEF, INS, SYN, REC]`, and
  `validateChain`, which throws — "an out-of-order chain is not a chain
  (SEED.md #7)" — before any null is consulted. Epoch pin:
  `CURRENT_OPERATOR_EPOCH = "eo-2026-07"`.
- **The single-verb executor.** `packages/host/surfer.js::executePrompt` is
  one verb (SEG · snip) executed properly: address ladder SOURCE → HEADING →
  CONTENT → WINDOW, fan-out to the whole corpus when no source is named
  (`{fan, fan_to}`), a closed typed-gap vocabulary (`empty_prompt`,
  `no_source`, `ambiguous_address`, `content_not_found`,
  `no_structural_boundary_in_reach`, `empty_material`), and `wayfind`'s
  escalation with a coefficient-of-variation-derived widening step — a
  derived number where a hand-picked one would have been easy. This file is
  the embryo; the executor below is this shape grown to nine verbs with
  dataflow.
- **The plan language.** `packages/engine/holon/task-log.js` already is one:
  append-only entries typed by `(operator, grain)` with `operator_basis`
  (produced / derived / declared / contested / absent), `depends_on`,
  `evidence`, `supersedes`; `produce(log, rules)` fires rules keyed by
  operator in `OPERATOR_ORDER` and halts on operational closure measured on
  a fold digest (never on entry count), with a `maxSteps` guard and open
  DEF-tasks holding `closed` false; `legalNextCells` (≤ 27), `isProductionOrder`
  (a thin wrapper over `validateChain`), `checkCubeProgression` (refuses
  grain-coarsening and order-reversal per supersedes-thread), and
  `foldToWorkingSet` (k = 7, declared, the Ericsson-Kintsch range) as the
  bounded mouth. It passed the omnimodal test empirically — the identical
  code drove music, essays, fiction, numeric prediction, multi-file code,
  and SVG. **A plan is a task-log. The grammar does not need inventing.**
- **The record of acts.** `event_log/index.js::tick/createLog/asOf` — typed
  events, content-hashed `event_id`, logical tick, and `asOf(log, cursor)`
  with the cursor required, half-open, never defaulted ("a read of this log
  names its position in it or it is an undeclared clock" — CONSTITUTION.md
  II.17). Tested by `conformance/reading.test.js`; fed by nothing real yet
  (the lossless manifest's finding, and its build item 1).
- **The session surface.** `packages/host/index.js`: `createSession`,
  `admitChunked` (content-hash deduped), `ingestFile`, `searchSpans`
  (returning `{span_id, source_id, byte_start, byte_end, text}`), `readSpan`,
  `sessionOutline`, `snipSegment`, `sessionReferents` (multi-document),
  `sessionRelations`, `admitGraph`, `admitTiers`, `admitSelf`,
  `admitReading`. Note `wayfind` is exported by surfer.js but not re-exported
  by index.js — the tool surface below needs it, so that export gap is part
  of the wiring.
- **The nulls, closed.** `nul/index.js`: 32 `GAP_TYPES` (closed — `gap()`
  throws on anything else), the `LICENSED` statistic/perturbation map with
  `licensed()` as the check, and the three declared numbers doctrine
  (`draws` / `reseeds` / `window`; extent and n counted, never chosen).
- **The self-model.** `loops/self.js`: the testimony ledger —
  `commitTestimony` / `recheckTestimony` / `classifyFresh`, verdicts SELF /
  SELF_MISMATCH / WORLD, extent-matched recheck via `seriesExtent`.
- **The model-integration precedent, measured.** the-fold: one system message
  assembled mechanically (`buildTurnMessages`), retrieval decided by the
  question's own tokens ("the model does not get tools"), and after the
  model speaks, the mechanical pipeline in a fixed order — `checkCitations`
  (did it cite an address it was handed), `checkGrounding` (are the figures
  and names in the bytes at all), `attribute` (where does an uncited
  sentence come from, attached only above a null floor and vetoed on
  unsupported names) — with the warrant record built from those checks
  *before* the summary-refresh model call, and the records never writable by
  any model call ("a model that could edit the record could edit the
  evidence"). `detectTable` pre-empts the model entirely for questions the
  app can answer from its own state ("computed, not generated").
- **The memoization precedent.** `scripts/cache-reading.mjs`: one expensive
  reading, cached under a sha256 content key, after the same extraction was
  paid five times in one session by five scripts.
- **The perceiver contract.** "load(path) does I/O once; reduce(units,
  {fraction}) is pure" — five modalities live (text, csv, audio, image,
  video), dispatched by extension in `scripts/aperture-run.mjs::EXT_KIND`,
  with `locate()` on text and audio already returning seekable addresses.

## The gap, stated once

Today a compound act lives in a hand-written driver. `scripts/read-people.mjs`
is seventeen stages of registered organ calls — every stage a roster entry or
a declared-number call, in `OPERATOR_ORDER`-respecting sequence — and the only
thing that makes it a *program* rather than a *plan* is that the glue is
JavaScript instead of data. The surfer executes exactly one verb. Nothing
executes a task-log against the ORGANS roster. `NEXT-LOSSLESS-READING-MANIFEST.md`'s
sibling table already names the two "(not yet built)" cells on the generation
side — a declared-cursor read and a composed projection — and an executor that
runs plans and ticks its acts is the thing that fills both.

## The build

### 1. The plan schema and its validator (`packages/host/plan.js`)

A plan is a JSON task-log: entries `{task_id, kind: "propose", operator,
grain, organ?, target?, params?, depends_on: [task_id...]}` plus the
`operator_basis` discipline task-log.js already enforces. Validation is
mechanical and total, and every refusal is a typed gap the steering model can
repair against, never a stack trace:

- operator/grain through `cellOf` — unknown is `unknown_spec`, exactly as
  `cellOf` already returns it.
- chain order through `validateChain` / `isProductionOrder` — "a pipeline
  that violates the order has not read."
- `organ` (optional) must be a roster id; absent, dispatch is by cell via
  `organsByOp` filtered to grain. Either way the executed organ id lands in
  the act's event (the `emergence/declaration.js` sentence: an act names the
  organ that performed it, or it is not in the record).
- every numeric param arrives as `{value, basis: "derived" | "declared",
  derivation | giver}`. Derived numbers name their derivation (`gammaFor(window)`,
  the IQR fences, wayfind's CV step are the house patterns). Declared numbers
  name their giver — a steering model that declares a window is a prior-giver
  and is recorded as one (`injectPrior`'s own law: "a prior whose origin
  cannot be named is indistinguishable from a fabrication"). A bare number is
  `undeclared` (P4).
- statistic/perturbation pairs through `licensed()` — an unlicensed pair is
  refused at validation, not run.
- targets are addresses: a `source_id`, a `span_id`, a register handle, a
  prior step's `task_id`, or absent — and absent means everywhere, the fan,
  exactly as the surfer resolved the same question ("a prompt that names no
  source is not a guess about which — it is an address to all of them").

### 2. The executor (`packages/host/execute.js`)

One fixed interpreter, and the discipline of `conformance/operators.test.js`
test 4 already proves the dispatch mechanism: dynamic-import the organ's
module, call its `fn`. Per step, in dependency order (steps with no edge
between them are independent and may run concurrently; `seq` stays logical):

- **Execute** the organ with its validated params against its resolved
  target.
- **Tick** the act into the session's event log — the event shapes the
  lossless manifest already specs (`DEF.admit`, `CON.identity`, `SYN.merge`,
  `CON.link`, `SYN.kind`, `REC.paradigm`), plus one new type for the act
  itself (e.g. `SEG.snip` carrying the byte range) so the plan's execution is
  itself a reading that writes.
- **Memoize** under a content key: hash of (organ id, resolved params, input
  event_ids, source content hashes) — `cache-reading.mjs`'s pattern promoted.
  Same plan over the same corpus returns instantly; this, plus the persisted
  log, is what "summarize a 5000-page book almost instantly" actually is:
  the reading paid once, every question after it a fold over the log.
- **Propagate gaps as results.** An organ returning a typed gap does not
  throw; the step's result *is* the gap, dependent steps are refused with
  that reason carried (`DEF`, given a place in the log — task-log.js's
  `REFUSAL_OPERATOR` semantics), and the plan runs to operational closure
  with `open_gaps` reported. A failed step is a finding (P4).
- **Reconcile once.** If a completeness check flags a step (missing null
  field, unverifiable byte range), one bounded repair pass —
  `DEFAULT_RECONCILE_ROUNDS = 1`, the generation side's own law, cited by
  the lossless manifest. Never a second loop.

What the executor must never contain: `eval` or any model-authored code path;
content-derived dispatch (the purity guard's discipline extends here — the
executor dispatches on what the plan names and what organs declare, never on
what the material says); any write path from a model call to measurements,
records, or the log (the-fold's fold.js law, generalized).

### 3. The tool surface — how a model steers physics over arbitrary data

This is the load-bearing section. The advice is ranked; the first three are
the ones that hurt when violated, and each is a measured lesson, not taste.

1. **Three tools, not sixty-two.** `plan` (submit or extend a task-log),
   `read` (dereference an address — `readSpan` / `asOf` / `snipSegment`
   shaped, plus `searchSpans`/`wayfind` for SIG · scout), `render` (emit
   prose/tables over named addresses, post-checked). Every additional tool
   is additional instruction-following surface, and L5's measurement says
   instruction-following is exactly what fails silently. The 62 organs are
   reachable through the plan's `organ` field, not as tools — the schema is
   the constraint, so compliance is structural, not requested.
2. **Handles, never payloads.** A step's result returns to the model as
   `{task_id, event_id, cursor, gist, gaps, address}` with the gist bounded
   (the fold discipline: what returns to context is truncated; the full
   record stays in the log, re-openable — P1, recall is retrieval). The
   model routes addresses between steps; it never transcribes a measurement
   from one result into the next step's input, because the executor
   dereferences `depends_on` itself. **The model cannot misquote what it
   never carries.** This kills the invented-figure class the same way
   the-fold's `tables.js` kills it — by computing what the app already
   knows instead of asking for it back.
3. **Typed refusal is the repair channel.** Schema violations, order
   violations, unlicensed pairs, undeclared numbers all come back as the
   same typed gaps the engine already speaks (`unknown_spec`, `undeclared`,
   plus the validator's own order-refusal), so the model repairs against a
   named reason. A15's measurement is the precedent one layer down: routing
   escalation by the doubt's own type recovered +18.3% more correct
   bindings where untyped widening lost net. Give the model typed doubt.
4. **Prose is checked, not trusted.** `render`'s output runs the-fold's
   mechanical pipeline against the executor's own addresses — `checkCitations`,
   `checkGrounding`, `attribute` with its null floor and names veto — and
   the warrant record is built from those checks before anything else
   happens. An address the model invents renders inert and lands in
   `unsupported`. Nothing is blocked; everything is flagged, recorded, and
   visibly suspect.
5. **Arbitrary data is a perceiver, not a plan feature.** Dispatch by
   `EXT_KIND` to the load/reduce contract; a new modality is one new
   perceiver module (load, reduce, locate) and zero changes to the plan
   grammar, the executor, or the tools. Structure-finding stays emergence's
   ("perceiver answers: what are the units, what is each unit's field
   vector? Nothing more" — audio/reading.js's own header law).
6. **The nulls are not options.** There is no plan parameter that disables a
   Born gate, lowers a significance floor, or pools directions. A plan may
   choose among licensed pairs; it may not invent one. And no param's value
   may be justified by its effect on a golden's score (CLAUDE.md's second
   rule — the executor cannot enforce this one; the review discipline must).
7. **Fan mechanically, steer at boundaries.** The model is consulted when a
   plan completes, refuses, or reconciles — never per reach-unit, never
   polling. The surfer's fan is the pattern: one act, aimed at everything,
   each landing reported or gapped, no model in the loop.

### 4. Lenses — self, world, user, character: n-many lenses off one log at one cursor

The canon already defines the mechanism. Lens is Interpretation · Figure,
"the saved view," and the ratified representation standard's build law reads:
"Lens is a fold one tier up from Atmosphere (the 'n-many lenses off one log
at one cursor' mechanism, gated by CONSTITUTION.md II.17)."
`conformance/reading.test.js` pins the contract: a lens declares `reads`,
reports `discardedTypes`, and refuses a missing cursor. A **perspective** is
therefore not a new organ class — it is `(holder, exposure selector, cursor)`:
the same lenses, projected over the subset of the log the holder was exposed
to, so the holder's ground is rebuilt from *their* exposure and perception is
by difference from *that* ground. Same physics, scoped replay.

Four holders, in order of how much already exists:

- **World** — the full log at a named cursor. This is `readDocument` as
  already specced; nothing new.
- **Self** — the engine's own testimony: `loops/self.js`'s ledger, with
  SELF / SELF_MISMATCH / WORLD verdicts and the self-holon holarchy over its
  own commits. One deep consequence worth writing down:
  `atmosphere.js::createRegimeTracker`'s header says its placement triad is
  eoreader4.2's monitor loop "without the authorship it assumed... Self/world
  is the special case this collapses into once there is an author to close
  the loop," and `prediction/RESULTS.md` names the missing output-authoring
  organ explicitly. The executor is that author. A plan emitted, executed,
  and sensed on return is commit → predict → sense — the loop closes, and
  SELF finally means "I emitted this and sensed it return."
- **User** — the steering party's exposure and commitments, built from what
  actually crossed the interface: every `read` handle served, every plan
  submitted, every warrant record established (the-fold's System 2 records
  are exactly this, already mechanical). The honest boundary, kept typed:
  this is a model of the user's *exposure and record*, not their mind —
  anything deeper is model-tier and ships as a typed gap needing a witness
  (`tier: "model", needsWitness: true`, surfaces.js's own coreference
  discipline). The useful derivative is the complement: "what have I not
  seen" is a lens-complement query over the same log, and it is answerable
  mechanically.
- **Character** — the one genuinely new organ in this file. Nothing today
  attributes an assertion or a perception to a character-holder: graph.js's
  "belief" is the reader's belief, always (its header says so), and the
  recon that preceded this spec confirmed no attitude-attribution mechanism
  exists anywhere in the engine. What a character-lens needs, in order:
  (a) **exposure** — the units where the referent is present; the entity
  register's arrival positions already carry this, and the event-log's
  byte-carrying events give it addresses; (b) **attributed assertion** —
  triples whose subject resolves to the referent, which `read-people.mjs`
  already does, including first-person-by-narrator-scope
  (`narrator.js::narratorAt`, the Walton > Victor > Creature binding);
  (c) **attitude and perception verbs** — the subset of
  `discoverRelationVocab`'s measured vocabulary whose objects are claims
  rather than beings. This subset must be *measured out of the discovered
  vocabulary*, never hand-listed (relations.js's own history: the 90-verb
  English list measured 0 triples on civic prose and was deleted). What is
  unproven and must be measured first: whether clause-shaped objects are
  even detectable at the current slot typing — `NEXT-RELATION-SLOTS.md` /
  A19 landed bounded noun-role slots, and a clause object is a different
  shape. If it is not detectable, the honest v1 character lens is
  (a) + (b) only — what the character did and was present for, not yet what
  they believed — and that limitation ships named, not papered over.
  Gate the lens the house way: a character's scoped graph must differ from
  a same-extent random-exposure null (`holon_level`'s "the null is the same
  act at a random place, elsewhere") before the lens claims the character
  *has* a distinct view. Once two lenses exist, divergence between a
  character's graph and the world graph is a measurement — dramatic irony,
  literally computable, as a comparator over two lenses at one cursor.

On "how does every mode perceive the all": the canon's answer is the stance
face, and its language is exact — a stance is "in what posture, at what
grain," entailed by (mode, grain), never chosen. At Ground grain the three
modes perceive the all as Clearing, Tending, Cultivating (atmosphere.js fires
exactly these three as one regime). The nine stances are the closed answer;
a lens chooses a cursor and a scope, never a tenth posture.
(`13-the-resolution-face.md` carries the one caveat: its stance-grain-as-
resolution reading had its own discriminating prediction refused — do not
build on that sentence without re-reading it.)

### 5. The backlog this session's wishes map onto (ordered, each one organ or less)

1. **Event-log wiring** — lossless manifest build item 1, unchanged, first.
2. **Plan schema + validator + executor + three tools** — items 1–3 above.
3. **Audio Entity lens** — mostly wiring, not a new organ:
   `referents/blind.js::findRecurringMotifs` (SIG · scout, "noticing needs
   no name") already yields occurrence positions; `loops/read-level0.js`
   already runs blind motifs against reader-relative grounds; what remains
   is feeding motif occurrences as arrivals into
   `referents/entity.js::admitFromArrivals` so a motif is *born* through the
   same witness gate a character is — after which motifs are referents,
   `bindLinks` gives their co-arrival structure, and "identify the motifs in
   this wave file" is a five-step plan with zero new mechanism.
4. **Character lens** — item 4(c) above, measured-first.
5. **Cross-corpus alignment organ** — the comparator vocabulary (same
   entity / different figure, present / absent, opposite direction, date
   mismatch), each finding carrying two addresses, gated against a
   noisy-coreference null; whatever the vocabulary cannot type ships as an
   `unaligned` typed result, never a guess. Plus the **web perceiver**
   (admission-tier: HTML → text with carried offsets, `stripContainer`
   generalized, provenance tier declared on every record).

## What NOT to do

- **Don't expose organs as individual tools.** Sixty-two tools is sixty-two
  instruction surfaces; the plan is the interface.
- **Don't let any model call write to the log, the records, or a
  measurement.** the-fold's law, unchanged: flag and record model output;
  never let it edit evidence.
- **Don't derive a cell, an organ choice, or a dispatch decision from
  content.** The classifier is refuted (95.7%); the purity guard's
  discipline extends to the executor.
- **Don't default a cursor, ever** (II.17 — "as of whenever this happened to
  run" is a claim nobody made).
- **Don't rebuild the-fold's checking pipeline inside the executor.** Emit
  the same address shapes and let `cite.js`/`grounding.js` run unchanged;
  reconcile the two address spellings (`name#start-end` vs
  `{span_id, byte_start, byte_end}`) with a converter, not a third format.
- **Don't tune any plan default against a golden** (CLAUDE.md rule 2), and
  don't let "the model picked it" launder a hand-picked number — a
  model-declared param is a named prior, which is better than an anonymous
  constant and still worse than a derived one.
- **Don't build the character lens's attitude vocabulary as an English word
  list.** Measure it out of the discovered vocabulary or ship without it,
  named.

## Stale references found while writing this (fix in passing, separately)

- `CLAUDE.md` and `scripts/read-people.mjs:12` both cite
  `emergence/people.js`, which does not exist — the organs are
  `emergence/graph.js` (the reader's belief graph) and `emergence/jati.js`
  (population understanding). The imports are already correct; the prose
  is stale.
- `goldens/network/read.mjs:332` keyed its null lookup with a LITERAL NUL
  byte in source (matching `emergence/binding.js:198`’s `\u0000` separator,
  so the code worked) — but the byte renders as a space, and it was read as
  one and diagnosed as a phantom key-mismatch bug twice in this very
  session, once by the recon pass that fed this spec and once more in the
  first draft of this bullet. Replaced with the visible `\u0000` escape on
  this branch: behavior-identical, and the next reader sees what the code
  does. An unprintable literal that defeats every reader is its own bug
  class, even at p(runtime failure) = 0.

## What "done" looks like

A golden plan, checked in beside the executor: this session's own compound
sentence — the wave-file motif question — as a JSON task-log executed
end-to-end by `execute.js` with zero new driver code, its acts ticked into a
real `{events, tick}` log, its results addressed (sample ranges via audio
`locate`), and a conformance test pinning the refusals as firmly as the
successes: an out-of-order chain refused by type, an undeclared number
refused as `undeclared`, an unlicensed pair refused at validation, a
defaulted cursor refused per II.17. A `READING-POLICY.md` entry (A22 or
later, whatever the log is at) reporting: the driver line count the plan
replaced, the two "(not yet built)" cells of the lossless manifest's sibling
table now filled or honestly still open, and — if the character lens shipped —
the measured answer to whether clause-shaped objects were detectable, with
the v1 scope named either way. Full suite: `node --test "conformance/*.test.js"`
stays at 100% pass, checked before and after, the way every commit in this
lineage does.

## Addendum (same session): the germline path, v0 built

The residual-code categories above ("a new perceiver at the admission
boundary or a new organ that enters the roster once") now have their first
mechanical entry path: `packages/host/germline.js` — template with typed
holes (enzyme), fillings that name their giver (guide), a complementarity
scan (no clocks, no I/O, no imports, no eval in a hole; statements holes
must return), and four selection gates (imports → contract → behavior →
physics), every refusal a typed gap. The perceiver template is built;
organ and adapter templates follow the same shape and are not yet built.

Two boundaries this path must keep, both load-bearing:

- **Germline runs outside plans.** `execute.js` dispatches only organs
  that already exist. A running read can never grow itself new mechanism
  mid-flight, and the roster stays ratification-edited — `germline.js`
  writes no file and touches no registry.
- **Selection is contract, not intent.** The gates prove a candidate
  speaks the engine's material shape; they do not prove it answers the
  task that prompted it (measured immediately: the first surviving
  model-guided organ split on sentence punctuation when the task said
  whitespace — see `goldens/germline/README.md`). Intent verification is
  the missing fifth gate, and it must arrive as a mechanical, task-derived
  property check supplied with the guide, never as review-by-impression.

Measured (goldens/germline, local Qwen2.5-1.5B on CPU): three runs — one
guide refused for a JSON-mangled escape it could not repair even with a
typed hint, one refused before assembly by the return-scan that refusal
taught us to add, one survived all four gates after its single bounded
repair round. A working perceiver now exists that no human wrote, and both
refusals are recorded beside it with equal weight.

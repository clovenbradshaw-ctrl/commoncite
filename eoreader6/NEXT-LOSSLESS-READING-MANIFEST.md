# Next: a lossless reading manifest — wiring real organs into the real event log

Status note for whoever picks this up next. Written so the plan survives past
the session that wrote it. Read `READING-POLICY.md` first (P0–P6, A1–A17) —
this file is the answer to the question that log's ending pointed at but
didn't spec: not "did the organs work" (measured, repeatedly, this session)
but "what output would let a local model retrieve against a reading without
losing anything."

## The adage this is built on

*Reading is writing. Writing is editing.* Not a metaphor — the same
operation shows up twice in this codebase under two names, independently
built, and naming them together is most of this spec.

**Reading writes.** `event_log/index.js::tick(log, event)` appends one typed
act — no clock, an `event_id` content-hashed from the event itself, a `tick`
that is a logical counter, never wall time. A reading of a book, done right,
is nothing but a long sequence of `tick()` calls: an entity admitted, a
relation extracted, a link bound, a kind induced, a paradigm re-zeroed. This
is not a proposal — the mechanism exists, is tested
(`conformance/reading.test.js`), and nothing real feeds it (confirmed this
session: `grep -rln "tick(log" packages/engine/` returns nothing — every
organ used all session returns its result and lets it evaporate).

**Writing edits.** `emergence/jati.js::reviseKinds(prevKinds, nextKinds)`,
`emergence/paradigm.js::refuseParadigm`/`rezeroParadigm`, and the generation
side's `app/client/eo-holonic-plan.ts` DEFINE→EVALUATE→RECONCILE loop are the
same act under three names: hold a prior claim, measure it against new
evidence, and either confirm it or replace it — never silently, always as a
new entry, never a mutation of the old one. `task-log.js`'s own header
(`packages/engine/holon/task-log.js:1-13`) says this cleanly: it was
"re-earned, not ported" from `eochat/server/task-log.js`, proven by running
unmodified across "music composition, essay generation, fiction, numeric
prediction, multi-file code, and SVG diagrams" — the omnimodal test, passed
on the WRITING side. Nothing on the READING side has been asked to clear the
same bar, and this session is the first full-book run that could ask it to.

## What already exists on both sides, named as siblings

Not a coincidence — reading and generation independently arrived at the same
shape, because it is the shape an append-only, clockless, typed record has to
have:

| | reading | generation |
|---|---|---|
| append-only log | `event_log/index.js::tick`/`createLog` | `holon/task-log.js` |
| ordering | `tick`, a logical counter | `seq`, a logical counter |
| typed by | the operator cube (`operators.js`) | the SAME `operators.js` — `GRAINS`, `cellOf`, `OPERATOR_ORDER` |
| declared-cursor read | `event_log::asOf(log, cursor)` — half-open, never defaulted | (not yet built) |
| composed projection | `reading/index.js::readDocument` — named lenses, each declaring `reads`/`discardedTypes` | (not yet built) |
| hierarchical fold | `emergence/jati.js::foldHolons` | `task-log.js::deriveLevels` |
| existence-dependency test on the fold | `holon_level/index.js` — real, Born-null-gated, **for CONTINUOUS material** | `deriveLevels` — **declared, not measured**, `task-log.js:29-40` names this itself |
| revise a prior claim against new evidence | `jati.js::reviseKinds`, `paradigm.js::refuseParadigm`/`rezeroParadigm` | `eo-holonic-plan.ts` DEFINE→EVALUATE→RECONCILE |

Two things follow from this table, and they are different kinds of finding.

**First, doubly-motivated work.** `task-log.js`'s own header says a discrete-
graph existence-dependency test needs "a new perturbation+statistic pair,
licensed and calibration-tested" in `nul/index.js`, and that this is "real,
separate work" not yet done. This session hit the identical gap from the
reading side, independently: A10 found `rowperm` (permuting which being
holds which attribute profile) is an **unlicensed pair** for
`induceKinds`, because the induction only ever sees `{id, attributes}` —
never the graph topology connecting beings. Both are the same missing
primitive: a licensed null for a DISCRETE graph (task dependencies on one
side, entity relations on the other), where every existing null in this
codebase is built for continuous series. Two independent domains needing the
same unbuilt thing is stronger grounds for building it than either alone —
this is now that grounds. Whoever builds the discrete-graph perturbation
should build it once, in `nul/index.js`, and let both `holon_level`-style
existence-dependency (over relation graphs) and `task-log.js::deriveLevels`
(over dependency graphs) draw on the same licensed pair, the way `foldHolons`
and `deriveLevels` are named siblings rather than merged today — *check
before merging*, per the project's own stated doctrine
(`task-log.js:40-41`, "the same 'siblings, not one generalization' pattern
as `generation/tasks.js` vs `prediction/tasks.js`"), but this is the
concrete case where the shared primitive underneath the siblings is worth
building once.

**Second, a reusable completeness-check shape.** `eo-holonic-plan.ts`'s
EVALUATE step is a mechanical, non-self-graded measurement of a generated
answer against a declared contract (`minWords`, `require`, `forbid`), with
**one bounded RECONCILE round** if it fails — never infinite retry, never the
model grading its own work. That is exactly the shape "is this reading
lossless enough" needs, and section 3 below specs it directly onto reading's
own contract.

## The three things to actually build

### 1. Instrument the real organs to `tick()`

Every organ this session called already returns exactly the content an event
needs; none of it is captured. Concretely, per organ:

- `referents/entity.js::admitFromArrivals` — on admission, `tick(log, {
  type: "DEF.admit", referent_id, surface, provenance })`. This is the EXACT
  event shape `conformance/reading.test.js`'s fixture already hand-writes
  (`buildLog()`, `type: "DEF.admit"`) — the shape is proven, only the real
  producer is missing.
- `referents/consequence.js` / `referents/cooccurrence.js` merges —
  `CON.identity` / `SYN.merge` events, same vocabulary the test fixture
  already names in `REFERENT_LENS.reads`.
- `perceiver/text/relations.js::extractRelations` + the resolution step
  (whatever `NEXT-RELATION-SLOTS.md` lands as bounded subject/object slots)
  — a new event type, e.g. `CON.link` — carrying the verbatim subject/verb/
  object text AND the byte-verified offset (A2's discipline: independently
  re-verified, not just computed).
- `emergence/binding.js::readLinks` — `CON.link` or a distinct
  `EVA.direction` event per surviving Link, carrying direction/polarity and
  which nulls it cleared (the same fields A15/A17 already compute and
  currently only print to a console).
- `emergence/jati.js::understand`/`induceKinds` — a `SYN.kind` event per
  induced kind, carrying `ground`, `heightGate`, and — per A10 — which
  perturbations were run and their p-values, not just the members.
- `emergence/tiers.js::foldThrough` — a `REC.paradigm` event on each tier
  that clears its null, at minimum atmosphere/lens/paradigm, carrying the
  byte-verified waypoint the way `navigation-index-war-and-peace.mjs`
  already proves out (57/57 verified once the CRLF bug — A2 — is fixed at
  the source, still open).

### 2. Promote the Entity lens out of the test file, and write the missing ones

`REFERENT_LENS` (referent-identity) exists only inside
`conformance/reading.test.js` and `conformance/lens.test.js` — confirmed,
`grep -rln "REFERENT_LENS"` returns only those two files. No production
reading can import it. It needs a real home (e.g.
`referents/index.js`'s own export, since it wraps `projectReferents`, which
already lives there) before anything downstream can use it.

`modifier-order/lens.js::MODIFIER_SCOPE_LENS` is the one lens that already
IS production code, not test fixture — the Link terrain's working example to
follow the shape of, not to reuse directly (it reads modifier-scope events,
not relation triples).

Missing entirely, each needs a `{name, reads, project}` following the same
contract `lens/index.js::readLens` already enforces (declared `reads`,
reported `discardedTypes`, refuses on a missing cursor):

- **Link** — projects `CON.link` events into the relation ledger (the
  `wap-graph.json` shape this session hand-rolled, but built FROM the log,
  addressable at any cursor via `asOf`, instead of computed once over the
  whole text).
- **Network** — projects link events into components/communities
  (`emergence/segment.js`, already real, just never fed a real log).
- **Kind** — projects `SYN.kind` events, carrying the null results alongside
  membership, never membership alone (A10's own lesson).
- **Atmosphere/Paradigm** — named in `TERRAINS`, unwired per
  `reading/index.js`'s own header; `emergence/tiers.js` output is the
  obvious source once `REC.paradigm` events exist.

### 3. The lossless-completeness check, DEFINE→EVALUATE→RECONCILE shaped

Not "build the manifest and hope it's complete" — measure it, mechanically,
the way `eo-holonic-plan.ts` measures a generated answer:

- **DEFINE** — the contract, stated once, not per-run: every claim at every
  terrain carries a byte address independently re-verifiable against the
  source file (A2's discipline); every relation ships from the PERSISTED
  ledger, never the decayed activation snapshot (P1); every gap
  (`pronoun_no_margin`, `degenerate_ground`, `wayfinder.void`,
  `missing_kind_prior`) ships as a typed event, not an omission (P4); every
  induced kind carries which nulls it cleared, at what p-value, under which
  perturbation (A9/A10); every lens reports its own `discardedTypes`
  (`lens/index.js`'s own built-in field — free, if the lens is real).
- **EVALUATE** — mechanical, regex/graph-shaped checks against the log
  itself: does every `SYN.kind` event carry a `nulls` field; does every
  `CON.link` event's byte range independently re-verify against the source
  file on disk; does `asOf(log, cursor)` at four or more cursors actually
  return growing, non-empty slices (catches the A11 helix-style non-
  streaming defect before it ships, not after 15 minutes of nothing).
- **RECONCILE** — one bounded pass: for whatever the EVALUATE step flags,
  either supply the missing field (re-verify the byte range, attach the
  missing null) or convert the claim to a typed gap rather than dropping it.
  Never a second unbounded retry loop — the same discipline
  `DEFAULT_RECONCILE_ROUNDS = 1` already encodes on the generation side.

## What "done" looks like

A `war-and-peace.eventlog.json` (or equivalent) that is a real
`{events: [...], tick: N}`, producible by real organs via real `tick()`
calls, composable through `reading/index.js::readDocument` with real lenses
on at least Entity/Link/Network/Kind, addressable at any `asOf(log, cursor)`
— not the four hand-picked fractions `hypergraph.mjs` used this session. A
`READING-POLICY.md` entry reporting the DEFINE contract used, the EVALUATE
results (pass/fail per check, not a vibe), and whatever RECONCILE had to fix.
If the discrete-graph null primitive gets built along the way, it should land
in `nul/index.js` once, and both `holon_level`-style reading existence-
dependency and `task-log.js::deriveLevels` should be checked against it
before either claims to be measured rather than declared.

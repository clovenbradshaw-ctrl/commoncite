# The cube — instrument, not runtime

**This describes no data structure in this repository and must not become one.**

It is a scaffold for thinking about architecture: hold a proposed organ up
against it and ask which cell the organ occupies. Two organs in one cell means
one of them is redundant. An organ that cannot be placed is not yet understood.
An empty cell is a question, not a backlog item.

As a *classifier* — deriving a cell from content — this was already measured and
refuted: shuffling words inside 2,527 paragraphs left 95.7% of cell assignments
unchanged, random words hit the modal cell at 34.7% against real prose at 33.5%,
and the fabrication veto built on it passed three plain fabrications. It is not
resurrected here. It is promoted out of the code.

## Three axes

```
MODES   = Differentiate · Relate · Generate
DOMAINS = Existence · Structure · Interpretation
GRAINS  = Ground · Figure · Pattern
```

`GRAINS` is the triad from `SEED.md`. It is the same three terms; the seed's
unit is one axis of this instrument.

## Three faces

One coordinate, three pairwise projections. This is why there appear to be
three separate vocabularies of nine — there aren't. There is one cube.

| projection | face | asks |
|---|---|---|
| (mode, domain) | **operator** | what act |
| (domain, grain) | **terrain** | on what, at what grain |
| (mode, grain) | **stance** | in what posture, at what grain |

```
operator = (mode, domain)      NUL SIG INS / SEG CON SYN / DEF EVA REC

terrain  = (domain, grain)     Existence:      Void       Entity  Kind
                               Structure:      Field      Link    Network
                               Interpretation: Atmosphere Lens    Paradigm

stance   = (mode, grain)       Differentiate:  Clearing    Dissecting Unraveling
                               Relate:         Tending     Binding    Tracing
                               Generate:       Cultivating Making     Composing
```

**A stance is not a mood and cannot be chosen.** Name the act and the grain and
the stance is entailed. Terrain and stance both carry grain, so grain is claimed
twice — and that redundancy is the whole point. Over-determination is what makes
an address falsifiable.

**The redundancy is not available in the code as written**, and
`13-the-resolution-face.md` files why: `cellOf(op, grain)` takes one `grain`
argument and stamps it into both projections, so the two claims cannot disagree
and nothing can be refused by their disagreeing. That document argues the two
readings do separate — terrain's grain is a *type*, stance's grain is a
*resolution*, one declared number per grain (`window` / `draws` / `reseeds`) —
and it carries a measurement whose own discriminating prediction was refused.
Read it before treating the sentence above as load-bearing.

The addressable space is operator × grain = **27**, not 729. Of 729, 702 are
type errors by construction.

## Why this instrument earns its keep

Two mechanisms the seed depends on land on named cells, which is how we know
the instrument is doing work rather than decorating:

- **`Differentiate · Existence · Ground`** — `NUL · Void · Clearing`. Clearing
  the ground of existence. This is *E. coli's methylation reset*: it cannot
  sense a spatial gradient, so it re-zeroes its receptor baseline continuously
  and perceives only change against a nothing it rebuilds. Perfect adaptation
  is mandatory — incomplete adaptation is saturation, which is blindness in
  high signal. The work is not the swimming. The work is the erasing.

- **`Differentiate · Interpretation · Pattern` → `Generate · Interpretation ·
  Ground`** — unravel the frame, return and cultivate. This is *Ramakrishna*:
  samadhi is not the end state, it is the reset, and speech is structurally
  impossible inside it. Witness happens on the return. Hence the seed's phase
  rule.

Neither of them writes on the world. Both change only their own zero. Deposit
into a shared medium — traces, decay, off-gradient exploration — is a
`Structure`-domain mechanism, a colony's, and it does not belong at the seed.

## More cells earned, checked against running code and against independent evidence

Found by walking `nul/index.js` and `holon_level/index.js`'s actual control
flow — not asserted, checked line by line, then independently corroborated
against real cross-linguistic exemplar sentences from an external embedding
study that never saw this codebase (`eo-lexical-analysis-2.0`, held-out
top-1 accuracy 40.9% vs 3.7% chance on its own test set).

- **Every `gap()` call site is `Differentiate · Interpretation`-shaped
  (`DEF`)** — the engine refusing a claim. The external study's real,
  margin-ranked exemplars for this cell (`ALT` in its naming) escalate by
  grain exactly the way `nul`'s own gap vocabulary does: Ground-grain
  refusals clear a general assumption ("we're not on TV, let's speak
  honestly"), Figure-grain refusals reject one specific claim ("no
  conclusion could be drawn"), Pattern-grain refusals dismantle a whole
  frame ("reality is often different, however"). `degenerate_ground`,
  `exceeds_witness`, `unreceived_origin` are all this same act at different
  grains, not three unrelated failure modes.

- **`witness()` succeeding is `Relate · Interpretation`-shaped (`EVA`)** —
  it structurally *requires* `pattern.moved === true`: it will not speak
  without independent corroborating evidence. The external study's exemplars
  for this cell (`SUP`) are affirmation/agreement content at every grain
  (positive reviews, dialogue agreement, shared creeds) — binding to a claim,
  never generating one.

- **`reZero()`, specifically its documented trigger ("censored above is
  surfeit and is the trigger to re-zero"), is `Generate · Interpretation ·
  Ground` (`REC`)** — this was already named above as the Ramakrishna cell,
  asserted from doctrine alone. The external study's real exemplars for this
  cell are atmosphere-generating content ("the camera transformed Paris into
  an icy city," "each passing day makes it more evident") — independent,
  empirical corroboration of a correspondence this document had only argued
  for before.

- **Existence / Structure / Significance — the layering this engine's
  significance work is built on this session — is the same axis as
  `Existence · Structure · Interpretation`,** not an analogy to it. `ground()`
  admissibility is a pure existence question; `holon_level`'s
  existence-dependency/possibility-constraint tests are a pure structure
  question (does this regime behave as a bounded, dependent thing); `verdict`
  and `witness` are pure interpretation questions (what claim gets made, and
  it's explicitly revisable). Tested for real independence, not assumed: 146
  real presence-anchored regimes across three entities and two texts, a
  reader-relative (causal, not whole-document) significance statistic, and a
  5,000-trial permutation null — real between-group variance beat only 73.9%
  of shuffled trials (z≈0.20), no evidence the axes collapse into each other.

**Not yet earned, and should not be treated as confirmed**: whether `moved &&
opened` (`pattern()`'s encounter/widening case) is specifically `REC` and
`moved && !opened` (narrowing/consolidating) is specifically `EVA`. Tested
directly (pooled across War and Peace, Frankenstein, and Garoa, a real
permutation null against reader-relative novelty): n=17 DEF, n=3 REC, n=1
EVA — badly underpowered, direction consistent with the hypothesis but not
distinguishable from chance. This is a real open question, not a rounding
error to fix later.

**An open tension, named rather than resolved**: `referents/index.js`
(pre-existing in this repo, not written this session) already used
`DEF.admit` / `CON.identity` / `SYN.merge` / `SEG.split` as event-type names
before any of the above was checked. `DEF.admit` — admitting a *new* surface
as belonging to a referent — is an additive, existence-shaped act on its
face, which sits uneasily against `DEF` = refusal established above. Either
that pre-existing naming used the letters as plain English abbreviations
unrelated to the operator grid, or it encoded an intuition not yet checked
against real gap-flow the way the mapping above was. Not resolved here,
following the same discipline as the contradiction below.

## A known contradiction in the prior engine

Not carried here, recorded so it is not re-inherited. `eoreader5` contains two
ports of the same 4.2 cube with incompatible algebras:

- `packages/engine/ledger/cube.js` **generates** its cells from
  `stanceOf(mode, grain)` / `terrainOf(domain, grain)` — coherent by
  construction, and the derivable one.
- `packages/spec/cube/index.js` **hand-lists** nine "diagonal" cells, five of
  which its sibling's `coherence()` would refuse for grain mismatch:
  `SIG·Entity·Tracing`, `INS·Kind·Making`, `SEG·Field·Dissecting`,
  `DEF·Lens·Unraveling`, `REC·Paradigm·Cultivating`.

The hand-list also calls Existence/Structure/Interpretation "modes" (they are
domains) and claims a 9×9×9 space. It predates the algebra.

Note that Ramakrishna's own cell is among the five the algebra refuses. Either
the hand-list encoded an intuition the algebra has not yet earned, or the
intuition is wrong. Unresolved, and deliberately not resolved by fiat.

## Representation standard (companion doc)

The Site face — this file's `terrain = (domain, grain)` — is also the
address space for how data gets *shown*, not only how the engine measures
it. `12-nine-terrains-as-representation-standard.md` files that standard:
each of the nine terrains has a native class of representation (a
spreadsheet row is Entity, an EKG strip is Atmosphere, a legend is
Paradigm), and no representation has two native terrains. It is a
downstream, application-facing use of this same grid, not a runtime change
here — same discipline as the rest of this file: the cube stays an
instrument, never a data structure.

On the naming used a few paragraphs up ("Existence / Structure /
Significance — the layering this engine's significance work is built on
this session — is the same axis as Existence · Structure · Interpretation,
not an analogy to it"): the representation standard formalizes that as two
live aliases for one axis, not a resolved rename. `DOMAINS` in
`packages/engine/operators.js` is frozen as `Existence, Structure,
Interpretation` — that stays the engine name. `writing-code-in-eo` uses
Significance throughout — that stays the application name. Both are canon
at their own tier; unifying them lineage-wide is a separate, larger
proposal this file does not make.

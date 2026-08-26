# The role a span fills is not a property of the span — measured

`native/eval/being-superposition.mjs`, on the whole Frankenstein. Zero model
calls. Organ: the engine's `perceiver/text/roles.js::resolveSpanRole`,
unmodified.

## The defect this started from

`descriptorBeings`' being-evidence measure (`anchoring.js`, driven by
`levers.mjs`) decides whether a recurring descriptor ACTS by asking whether
the word after it is a verb, and answers from the UD EWT prior's TYPE-level
counts — keeping a form only when `VERB > AUX`, so that "a copula never
testifies that its subject acts."

Every clause the measure actually licensed on this book:

| admitted | the licensing clause | what is really going on |
|---|---|---|
| `the murder` | *the murder **had been committed*** | **passive** — theme of `commit`, not an agent |
| `the child` | *the child **had been missed*** | **passive** — theme of `miss` |
| `the city` | *the appearance of the city **had** yet…* | `the city` is inside a PP; the subject is `the appearance` |
| `the south` | *the passage towards the south **became** free* | `the south` is inside a PP; the subject is `the passage` |
| `the Turk` | *the Turk **entered** his daughter's apartment* | the one genuine agent |

And the agent it refuses: *"The conscience of the woman was troubled; **she
began to think**…"*, *"**The woman asked** her what she did there."*

**Precision 1 in 5**, with two distinct error modes, neither of them a
threshold: `\bthe city\s+(\w+)` reaches across a PP boundary, so in two of
five cases the "subject" scored is the subject of nothing; and in two more
the clause is passive, where the surface subject is precisely the patient.

## What was asked next

The prior already holds the answer in superposition — `had` is
`{AUX: 154, VERB: 335}`, a distribution — and the gate destroys it with one
`>` before any occurrence is seen. So: can the collapse be moved to the
occurrence, where context can drive it?

Construction (`mine-1-span-role.mjs`'s own, pointed at AUX/VERB): forms the
prior tags with exactly one class seed the roles as declared evidence; forms
it tags with several are resolved per occurrence. Nothing hand-listed —
which forms are ambiguous is the received prior's own fact. Floors are
`host/corpus.js`'s declared operating point (`minActivation 0.05`,
`minMargin 0.2`), cited rather than invented.

## The result, and it is negative

7 superposed tokens stood where the gate's measure reads. 3 returned a typed
gap (`role_no_margin`); 4 collapsed — and collapsed **wrongly**:

```
the murder  had  {AUX:154,VERB:335}  → VERB, margin 0.785   ("had been committed" — AUX)
the murder  had  {AUX:154,VERB:335}  → VERB, margin 0.772   ("had been committed" — AUX)
the turk    was  {AUX:1202,VERB:42}  → VERB, margin 0.317
the woman   was  {AUX:1202,VERB:42}  → VERB, margin 0.300
```

Confidently wrong, at margins far above the floor. The prediction recorded in
the driver's header before the run — a granularity risk, not a failure of
principle — is what happened, and the cause is sharper than predicted.

## The cause, measured

The seeding is **structurally degenerate for this role pair**: the class to
be detected is exactly the class held in superposition.

| | form types | occurrences in this book |
|---|---|---|
| unambiguous VERB | 2,623 | 5,447 |
| unambiguous AUX | **29** | 843 |
| ambiguous AUX/VERB | 22 | 3,929 |

The 29 unambiguous AUX types are **only modals and clitics** — `would`,
`could`, `should`, `might`, `must`, `shall`, `'m`, `'d`, `'ll`, `'ve`, `'re`
(and four typos). Every primary auxiliary is ambiguous:

```
be  {AUX:1105,VERB:27}   is  {AUX:2114,VERB:124}   was {AUX:1202,VERB:42}
had {AUX:154,VERB:335}   has {VERB:162,AUX:357}    have{AUX:588,VERB:769}
do  {AUX:580,VERB:268}   did {AUX:230,VERB:62}     been{VERB:10,AUX:331}
```

So the AUX role is seeded almost entirely by modals, which are
distributionally unlike `had`/`was`, while VERB gets 6.5× the seed mass.
Resemblance-to-other-tokens-of-this-role cannot work when the role has no
unambiguous tokens of the relevant kind to resemble.

This is not a tuning problem. **Auxiliaryhood is not a lexical property at
all** — it is constructional. `had` is AUX when a participle follows and a
main verb when an NP follows. The 154/335 split is not noise; it is a
frequency summary of two constructions with the construction thrown away.

## Where the superposition was actually destroyed

One level earlier than the gate. `scripts/build-pos-prior.mjs` reads CoNLL-U,
whose columns are `ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL DEPS MISC`, and
keeps `form -> {UPOS: count}`. **`HEAD` and `DEPREL` — the dependency arcs —
are discarded at build time.** The treebank knows, for every one of those
154 `had`s, exactly which construction it sat in. The vendored prior does
not. What the gate collapses was already collapsed before it arrived.

## What follows, named and not built

- The collapse needs a prior over **constructions**, not over forms — at
  least the local frame (what follows), which is what the treebank already
  annotates and the builder already reads past.
- `resolveSpanRole` evidences a role **per sentence**, which is above the
  grain where AUX/VERB is decided. Its frames are the right mechanism for
  referent identity (`pronouns.js`) and the wrong altitude for this. That is
  a statement about grain, not a defect in the organ.
- `beingEvidence` is typed `Map<surface, count>` — **one number per
  surface**. Even a correct per-occurrence resolver is flattened at that
  interface. Being-hood evidence has to be carried per occurrence before any
  of this can land.
- `read-superposed.mjs` was checked and is a different superposition (two
  `nul` noise families held against one figure), not this one.

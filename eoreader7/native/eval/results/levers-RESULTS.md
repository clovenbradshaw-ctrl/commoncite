# The two levers, measured — and where refinement was stopped on purpose

Driven by `eval/levers.mjs` on the whole Frankenstein (assembly named in the
output; both pronoun arms; whole-book vocabulary rerun in-driver under the
S4 re-ground posture). Raw run: `levers-frankenstein.json`.

## Lever 1 — anchorSpans (Fold-conditioned vocabulary): WORKS

Pronoun positions the binding organs RESOLVED feed `discoverRelationVocab`
as positional anchors (338 spans). The wall is positional on purpose: the
STRING "he" anchors nothing (the refused treebank-nomination shape, S8).

| | baseline | with spans |
|---|---|---|
| vocabulary | 23 | 42–45 |
| edges extracted | 1,945 | ~2,600 (+34%) |
| pronoun edge ends | 118 | ~170 (+44%) |

New verbs are mostly real acts (continued, called, died, replied, said,
hastened, observed, found, began, held, worked, cried, looked). Disclosed
noise: the absent-is-kept polarity admits treebank-unattested nouns
("tranquillity", "eloquence") — the documented polarity choice, not a new
bug.

## Lever 2 — descriptorBeings: the WALL works, the EVIDENCE needs a golden

Recurring never-anchored definite descriptors admitted as beings
(minArrivals 4, citing the Born gate). Two evidence measures were tried
and each is recorded:

1. **Clause-local pronoun co-occurrence — REFUTED by its own run.**
   "he paced the deck" handed *the deck* person evidence. Co-occurrence is
   not co-reference (the same lesson the-fold's web tier learned about
   string co-occurrence).
2. **Agency (subject slot of a measured verb, auxiliaries refused as
   witnesses)** — better: 58 → 5 admitted, The Turk and the child among
   them. Residue: "the murder", "the south", "the city" still pass (each
   does stand before a real measured verb somewhere), and "the woman" —
   a genuine being who only ever *was* — is now refused.

**Refinement was STOPPED here, on the repo's own rule**: a third filter
iteration was being walked against this book's admitted list as if it were
an answer key. No being-hood golden exists in either repo; until one does,
further filter-tuning is calibration-on-the-fixture wearing measurement's
clothes. The mechanism (recurrence floor + caller-measured evidence gate +
typed refusals: speaker-relative, anchored, below-arrivals, no-evidence)
is built and pinned by tests; the evidence MEASURE is disclosed as
uncalibrated.

Binding effect at the honest configuration: thematic 632 → 628, activation
894 → 895; 19–34 bindings land on descriptor beings. Small, and reported
as small.

## Lever 3 — the act closure (morphology): WORKS, and stacks

Every attested inflection of a measured act joins the hearing vocabulary —
the engine's own lemmatizer (eoreader5's lessons in its header) over the
vendored UniMorph prior (giver in the file), presence walled by the
material's own tokens. 43 measured acts → 120 attested forms.

| | baseline | +anchorSpans | +actClosure |
|---|---|---|---|
| edges | 1,945 | 2,621 | **3,643** (+87%) |
| pronoun edge ends | 118 | 176 | **230** (+95%) |

Added forms are clean inflection families (do/does/done, become/became/
becoming, see/saw, appear/appeared, reply/replied, call/called...). The
known ambiguity rides disclosed: "seen" joins via "saw" because UniMorph
preserves see-the-act / saw-the-tool, and sameAct never picks a lemma —
the engine module's own decision #1.

## What was learned about "the stranger"

The motivating case (Victor-as-"the stranger" in Walton's letters) is
EXCLUDED by the anchored-descriptor wall — the anchoring organ already
binds it to an existing referent later in the book, which is the system
working: the stranger IS Victor, and admitting him twice would fork the
identity the anchor already supports.

# The signal-from-noise golden

24 cases (A1–A15, B1–B8, B6 split into its two sensors) from a hand-built
salience/surprise corpus, each run for real against `nul`, `temporality.js`,
and a small set of general axis detectors — not hand-classified.

## The tier split, and why it's the load-bearing thing

Every case is tagged **engine** (structural, no world knowledge, detectable
by perturbing a ground the engine can build itself), **model** (requires
semantic or world knowledge the material does not carry — correct behavior
is a typed gap, never a lucky hit), **mixed**, or **not-applicable /
out-of-scope**. This is the same discipline `conformance/confabulation.test.js`
already enforces elsewhere in this repo: a gap declared at the call site is
never defaulted, and a model-tier refinement must never invent what the
engine tier didn't earn. A corpus like this one is exactly what silently
erodes that boundary if nobody checks it — a detector that happens to flag
A11's anachronism from sentence length alone would look like a win and would
in fact be confabulating.

`score.test.mjs` enforces both halves: engine/mixed cases must reproduce
their locked verdict, and **no model-tier case may be flagged without an
explicit caveat naming the structural (not semantic) basis for the flag.**

## Real findings from running it, kept because they're the content

**The corpus calls B1 trivial and B2 the harder case. Run against this
engine, it's backwards.** `burstiness` (max-over-windows) compared to its own
shuffle null is nearly **blind** to B1's lone spike — `highRank 0.68`,
nowhere near censored — because shuffling *preserves the multiset*, so the
one extreme value relocates under reshuffling but never disappears, and the
null keeps producing similarly large maxima. B2's variance-only case scores
**closer to censored** (`highRank 0.985`) because a window of size 2 catches
the local (5.0, 8.2) pair as an ordinary mean bump. Sensitivity is a property
of the (statistic, perturbation) *pair* (Amendment I), demonstrated on a case
that wasn't built to demonstrate it.

**B8 is the decisive case, and it generalizes past this probe.**
`burstiness` only ever *selects* the highest windowed mean before comparing
anything — so a below-average anomaly (a suspiciously fast time) can never
even become the observation under test. `highRank 0.325`: invisible, not
narrowly missed. This is the same asymmetry Amendment II exists to name, and
the same one `referents/entity.js::defOnEntity` had to be built two-sided to
catch (the Finnish siblings came back censored *below*, not above, earlier
this session). **Every organ in this codebase using the standard
max-over-windows pattern — most of `holon_level`, the span probes, `turn.js`'s
DEF as originally written — inherits this blind spot**, not just this probe.
`detectors.mjs::numericVerdict` fixes it locally by running the statistic
twice, once on the series and once negated, rather than by changing the
statistic itself — two grounds, SEED.md #6, not a new mechanism.

**B4's non-detection is density-dependent, not a mechanism failure — and
this took a second run to confirm rather than assert.** The literal corpus
text (340 identical $4.99 charges in 6 minutes) doesn't have a natural
numeric-series form, so it's reconstructed as a charges-per-minute rate
series. At a 20-minute reconstruction (14 background + 6 burst) it scores
`highRank 0.26` — not censored. Rather than accept that as the answer, the
same burst was re-run embedded in 60 background minutes: `highRank 0.035`,
monotonically closer to censored. **Whether this case reads as "surprising"
depends on how much background the reader has accumulated, exactly as
SEED.md #5 says it must** — two grounds built to different specs mean
different things, and a golden that only ran the first reconstruction would
have reported a false negative as a property of the *case* rather than of
the *spec*.

**B6's frozen sensor is refused, not missed.** `ground()` returns
`degenerate_ground` on zero-variance material — a type error before any null
is drawn (SEED.md #7). That refusal turned out to be the **same structural
event** that made B4's low-side ground degenerate at 20 minutes: when a
majority class dominates a series enough that a random window is very likely
to land entirely inside it, the null for "the least-extreme window" collapses
to a single repeated value. One mechanism explaining two of the corpus's
supposedly separate cases.

**B3 (Benford's Law) is the cleanest instance of a received prior in this
whole golden.** `nul::received()` takes samples with a named `provenance` —
here, "Benford's Law (Newcomb 1881 / Benford 1938) — received, not derived
from this ledger." The suspect ledger's near-uniform digit distribution
scores `chi-sq 195.56` against a Monte Carlo null of genuine Benford sampling
noise and comes back `deviates`, cleanly. This is SEED.md #1's discipline —
a prior is a gift and must name its giver — doing real, checkable work.

**A12 was mis-scoped on the first pass, and the fix is itself worth
recording.** It was built against `scriptProfileVerdict` (Han/Latin/Cyrillic
script-family), reused from the multilingual cast golden's script check. Run
for real: `majority=Latin, switches=[]` — silently wrong, because **French
and English are both Latin script**. A script-family test cannot see a
language switch within one script by construction. Corrected to
`ngramProfileVerdict`: character-trigram frequency profile, leave-one-out
distance from the pooled other paragraphs, same bootstrap-null discipline as
`rowFormVerdict`. Still no vocabulary and no translation — the French
sentence is caught by its letter statistics, not by being recognized as
French. (At only 3 paragraphs the bootstrap null is thin and the corrected
detector also reads `none` on this exact fixture; a longer document would be
the fairer test of the fix, which is itself a note about spec-sensitivity
worth carrying forward rather than papering over.)

**A `numericVerdict` bug was caught by B4, not designed for.** An earlier
version required *both* the high-side and low-side grounds to succeed before
reporting anything — so when the (structurally correct, informative) low-side
degeneracy above fired, a genuine high-side signal was discarded along with
it. Fixed to score each side independently; a gap on one side is not evidence
about the other.

## What structurally echoes into model-tier cases, honestly reported

`rowFormVerdict` — the shape-outlier test built for A3's log severity and
A13's TOC — was run against every text case regardless of tier, on the
principle that a model-tier label is a claim about what's needed to
*correctly interpret* a signal, not a promise that no structural byproduct
exists. It found one: **A4's buried finding (row 6, "Section 7, however...")
flags as a shape outlier**, because the informative footnote is genuinely
longer and differently punctuated than the six inert, templated ones that
precede it. The engine has no idea *why* row 6 differs — it cannot read
"finding inconsistent with all prior literature" as meaningful — but the
shape difference is real and is reported with an explicit caveat rather than
either suppressed or claimed as semantic detection. Nine of the ten other
model-tier cases (A2, A5, A9, A10, A11, A15, ...) show no structural echo at
all: `verdict: none`, clean refusal, exactly what the confabulation
discipline requires.

## A7's acrostic — no longer out of scope, and how

Every mechanism above measures predictability-break on an axis the *material
itself exposes* — row order, character sequence, digit distribution. An
acrostic's signal lives on an axis nobody marks: the vertical read of first
letters. `projectionVerdict` generalizes the axis idea one step further
rather than hardcoding "check first letters": candidate axes are *character
at position k of every row*, swept over every k a row is long enough to
have, unprivileged.

**Two honest branches, not one hack.**

Without a witness, this correctly **refuses**: `gap: insufficient_material`.
The poem's projected strings are 6 characters long, and no perturbation null
has power at n=6 — pretending otherwise would be exactly the confabulation
this golden exists to catch.

With a **received lexicon** — `/usr/share/dict/words` (macOS/BSD `web2`,
~236k entries), named and provenanced exactly like B3's Benford prior, never
derived from the poem — position 0 decodes. First attempt (whole-string
lookup) failed: `FINDME` is not itself a dictionary entry, it's a coined
phrase, not a word. Fixed with word-break segmentation on the *same* prior —
`FIND` + `ME`, a well-known DP technique, still only the one witness,
applied more cleverly. First pass at that also over-fired: two other axes
segmented into chains of obscure 2-letter dictionary entries (`ah wu er`,
`no er ge` reversed) — a permissive wordlist finding short words in noise by
chance. Fixed by requiring at least one substantial (3+ letter) word per
segmentation, which cleanly separated the real hit from both false
positives, verified by rerunning. Final result: **1 of 26 axes** segments
into substantial words — `pos0 → find + me` — confirmed selective against a
negative control (0 of 29 axes on genuinely random text).

**The lexicon path only ever finds a WORD.** A non-lexical cipher — secret
structure with no dictionary content at all — needs the statistical branch:
the exact successor-entropy-rise test from `learn-segmentation.mjs`,
retargeted from "boundary within a character stream" to "which axis of
projection is non-random," with the same type-error-before-null floor
(200 characters) that keeps it from guessing on short material. Proven on
300 synthetic rows carrying a secret cyclic pattern hidden at position 5
inside otherwise uniform random noise: **position 5 was the only one of 40
axes flagged**, observed entropy 0.105 against a shuffle-null floor of
3.115 — near-total predictability where every sibling axis sat inside its
own null.

Tiered `model`, not `engine`: both working paths depend on a received
prior (a dictionary, or — implicitly — "enough material to matter"), the
same discipline as coref and Benford. Nothing here derives what a witness
must supply.

## A6 — the one case the golden still declines to force

Redaction geometry is not an anomaly-among-peers question at all — it's
whether the engine *preserves* informative absence (block length, word
shape) through a redaction, a different capability than everything else
here. No detector targets it; forcing one through `rowForm` would test the
wrong thing.

## Run it

```
node goldens/surprise/score.mjs        # prints every case's live verdict
node --test goldens/surprise/score.test.mjs
```

`fixtures.json`'s `observed` field is not hand-asserted — it is what running
`score.mjs` actually produced, including the two corrections above. A future
change to `detectors.mjs` that silently changes a verdict is exactly what
`score.test.mjs` is for.

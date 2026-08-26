# The network golden

Four hand-built literary character co-occurrence networks — Les Misérables
(Knuth, Stanford GraphBase), Huckleberry Finn and David Copperfield (same),
and all 37 Shakespeare plays (Rieck et al., IEEE VIS 2016) — none of them
built with this engine, none of them seeing it.

The question it asks:

> Does `referents/cooccurrence.js`, built on top of `referents/entity.js`'s
> causal entity discovery, recover *which characters appear together, and
> how often* from raw text alone?

`goldens/cast` already asks whether the engine discovers a book's cast. This
asks the next question the cast golden has no way to ask: not just who is
in the book, but who is near whom.

## A full reading, not a co-occurrence-shaped one

The pipeline is organs this repo already has, chained in the order a
reading actually needs them — the structural link is the LAST, derived
step, not the thing driving the others:

1. `perceiver/text/surfaces.js::extractSurfaces` — candidate referent
   surfaces from this book's own capitalisation statistics, not "every word
   plus every adjacent bigram" (the driver's first version, replaced).
2. `perceiver/text/surfaces.js::discoverReferents` — name-variant
   coreference (containment, shared final token). "Valjean" and "Jean
   Valjean" become one referent id before `entity.js` ever sees either
   spelling.
3. `referents/entity.js` — causal admission, completely unchanged from
   `goldens/cast/read.mjs`'s own calibration: same SPEC, same atom-chunked
   reach-units. Only WHICH surfaces get offered to `witnessArrival` changed.
4. `referents/consequence.js`, via `cooccurrence.js::mergeAliasedEntities` —
   a second, complementary alias pass over what step 3 admitted, for exactly
   the cases step 2's spelling-based merge is conservative about on purpose
   (measured: "Tom Sawyer" and "Sawyer" both get their shared tokens
   stripped as generic, because "tom" and "sawyer" each pair with too many
   different partners elsewhere in Huckleberry Finn's own candidate pool —
   right for not collapsing every "Princess" into one person, wrong for
   this one pair). This asks arrival SHAPE instead of spelling, and only of
   entities that still share a name token — never a blind O(n²) sweep.
5. `emergence/binding.js::bindLinks` — a real permutation-null significance
   test PER PAIR (`displacementNull`) over the reading's own reach-unit
   arrival positions. An earlier version of this driver hand-rolled "did two
   entities ever share a chapter" instead of finding this organ first — see
   `CLAUDE.md`'s "search for the organ before you write one" for the full
   account, and `cooccurrence.js`'s own header for why that hand-rolled
   version was removed rather than kept as a second, weaker path. `bindLinks`
   needs no notion of "chapter" or "scene" at all: resolution comes from how
   many reach-units the book produced (hundreds to thousands, even for a
   short play), never from how many structural boundaries a segmenter found.
   An edge is admitted only where the observed co-arrival clears its own
   null — the significance is built into the extraction, not approximated
   afterward against a pooled chance baseline the way the hand-rolled
   version needed to.

`entity.js`'s birth condition needs many reach-units to have any statistical
power (thousands, in `goldens/cast`'s fixed 200-atom chunks) — that
calibration is untouched. Direction and polarity (`bindLinks`' fuller
sibling `readLinks`, via transfer entropy) and verb-typed relations
(`perceiver/text/relations.js` + `emergence/graph.js`'s belief graph, the
way `scripts/read-people.mjs` already assembles them) are real, richer
structure a reading could also carry here — deliberately not scored by this
golden, because the four reference networks are themselves undirected,
untyped co-occurrence counts with no dimension to check either against.

## Measured, across four revisions of this driver

Run against all 40 books (`node goldens/network/read.mjs`):

| book | entities found | edges found | vs. chance | precision (of candidates) |
|---|---|---|---|---|
| Les Misérables (366 ch.) | 38/77 | 68/254 | **~2.3× chance ceiling** (30) | 68/100 = 68% |
| David Copperfield (64 ch.) | 26/87 | 30/406 | at chance ceiling (27) | 30/67 = 45% |
| Huckleberry Finn (44 ch.) | 5/74 | 2/301 | at chance ceiling (3) | 2/3 = 67% |
| 37 Shakespeare plays (aggregate) | 43/1271 | 9 hits | at chance ceiling (11) | 9/11 = 82% |

Four revisions got here, each fixing a real problem the previous one had:

1. **Naive candidates** (every word + every adjacent bigram, no statistical
   filter). Registers were 90%+ noise (Huckleberry Finn: 312 admitted
   "characters", top of the list `miss`, `up the`, `says`, `he says`).
   Fragmented spellings gave a real character several independent chances
   to clear admission, inflating recall without meaning to. Same-chapter
   counting for edges had no significance test, and a hand-rolled Monte
   Carlo baseline was needed just to say whether a count meant anything —
   Les Misérables scored 152/254 edges, but only 10 above its own chance
   *mean*. 150s runtime on Les Misérables.
2. **`extractSurfaces`/`discoverReferents` candidates**, same-chapter edges.
   Registers dropped to real names almost exclusively. Runtime dropped to
   13s. But edges were still same-chapter counting — no per-pair
   significance, and completely unable to resolve anything on Huckleberry
   Finn's 44 chapters or a Shakespeare play's 20-30 scenes.
3. **`emergence/binding.js::bindLinks`** for edges (this revision) — see
   `CLAUDE.md` for why this was the organ that should have been used from
   the start. Along the way, two more bugs surfaced and got fixed: the
   candidate-occurrence scanner was double-witnessing "Tom Sawyer" as both
   "Tom Sawyer" and "Sawyer" for the same textual occurrence (advancing one
   token at a time past a matched multi-token run instead of past the whole
   run); and the reference-name matcher used `.find()`, which took the
   FIRST reference name sharing any word with a discovered surface rather
   than the best one — "Miss Watson" (this reading's own correct, exact
   surface) was scoring a match against "Miss Charlotte Grangerford"
   because that name sits earlier in the CSV, never reaching the actual
   "Miss Watson" entry. Fixing the matcher alone took Huckleberry Finn's
   edge precision from 1/3 candidates correct to 2/3.
4. **`SPEC.minArrivals`: 6 → 4** (this revision). Coverage of the reference
   networks is capped mostly by how many real characters `entity.js` admits
   at all — checked directly on Les Misérables: of 77 reference characters,
   only 2 never even became a candidate surface; 30 more WERE discovered as
   real candidates and refused at admission, almost entirely on "too few
   arrivals." The number was NOT tuned by trying values and keeping
   whichever scored best against these reference networks — that would leak
   the reference into calibration through the exact discipline
   `goldens/cast` exists to protect. The justification is mechanical only:
   `admitFromArrivals`'s own witness gate needs `half = floor(arrivals/2)
   >= 2` to run its early/late split test at all, so any candidate with
   fewer than 4 arrivals fails on that gate regardless of `minArrivals` — 4
   is the lowest value at which the Born gate itself, not a pre-filter in
   front of it, is what decides admission. Measured afterward, honestly:
   the gain is real but small (Les Misérables 36→38 entities, David
   Copperfield 25→26, Huckleberry Finn unchanged) and comes with a real
   cost — the admitted register on Les Misérables nearly doubled (173→228,
   the extra ~55 mostly noise that also clears the Born gate at this looser
   floor) and `bindLinks`' O(n²) pairing cost more than quadrupled the
   runtime (13s→55s). This confirms, rather than fixes, the earlier
   finding: the coverage ceiling on these books is structural — most of the
   uncovered reference characters are one- or two-scene walk-ons that no
   honestly-set statistical bar admits, not an artifact of where the floor
   sits.

**What's real now**: every edge this reading proposes has already cleared a
permutation-null significance test on its own arrival positions — not "did
these two ever share a chapter" but "do these two co-arrive within ~3000
atoms of each other significantly more than chance." On Les Misérables that
produces 68 edges at 68% precision, sitting at 2.3× the chance ceiling — a
genuinely reliable signal, even though the raw count is lower than either
earlier revision's (both were counting more edges, less honestly).

**What's still hard, and why**: Huckleberry Finn and Shakespeare remain
weak, but for a *diagnosable* reason now rather than a structural mystery —
checked directly against the reference data (Huckleberry Finn's
`huckleberry-finn-edges.csv`), the one wrong candidate edge bindLinks
proposes (Miss Watson–Tom Sawyer, co-arrival weight 93, p≈0) is a real
false positive: both characters are heavily present in the book's opening
chapters without ever sharing a scene, and `LINK_WINDOW=15` reach-units
(~3000 atoms) is wide enough to read "both mentioned in the same general
stretch of the opening" as co-arrival. That is a tunable parameter, not a
ceiling — narrower windows, or using `readLinks`' fuller directional test
(transfer entropy against a reversal null, currently unused because
undirected reference edges don't need direction to exist) are both real
next steps, not attempted in this pass, and — per revision 4's own lesson
— any such tuning has to be justified independent of what it does to this
golden's own score, not chosen because it raises it. Shakespeare's
shortfall is upstream of edges entirely: entity admission itself stays weak
on 20-30 scenes' worth of material, before a pair is even offered to
`bindLinks`.

## Files

- `refs/` — the four received ground truths, frozen verbatim, plus Pajek
  networks for all 37 Shakespeare plays (`refs/shakespeare/{speech,time}/`).
  `read.mjs` scores against the speech-based variant.
- `manifest.json` — one entry per book/play: material location, ground
  truth format and path. Generator/provenance recorded in `givers`.
- `fetch.mjs` — pulls the novels from Project Gutenberg and the plays from
  a pinned commit of `github.com/Pseudomanifold/Shakespeare` (the exact
  corpus the reference networks were built from).
- `parsers.mjs` — reads the three ground-truth formats (d3 JSON, node/edge
  CSV, Pajek `.net`) into one shape.
- `read.mjs` — the driver: chapter/scene segmentation (novel chapter
  headings are purpose-detected here rather than reusing
  `perceiver/text/segments.js`'s `outlineOfIndex`, which correctly refuses
  Huckleberry Finn's own "CHAPTER I." heading style as sentence-shaped; see
  the comment above `novelChapters` for why), the reading itself, and
  scoring. `node goldens/network/read.mjs [--book <tag>]`.
- `read/` — per-book output: full register, full edge list, and the score
  (gitignored by nothing — small enough to keep, unlike `texts/`).
- `../shared/` — PG boilerplate stripping (`gutenberg.mjs`), the fuzzy
  reference-name matcher (`fuzzy-match.mjs`), and the Monte Carlo chance
  baseline (`chance.mjs`), all reconciled out of independent copies this
  driver and `goldens/cast/read.mjs` had each grown on their own — see
  `CLAUDE.md`'s "reconcile, don't just dedupe" for what that found (a real,
  previously-unfixed matcher bug in `cast/read.mjs`, measured: `hu-69689`
  recall 5/19 → 7/19 on the identical register once fixed).

## Working backwards from complete coverage (2026-08-20)

“Get closer to 100%” is not licensed as “turn a threshold until the golden
moves.” A reference edge can survive only if both endpoint beings pass four
monotone seams: its names must be nominated by perception, both nominated
referents must be born, their arrival series must nominate a co-arriving pair,
and that pair must clear its displacement null. A miss at an earlier seam is
unreachable by every later improvement.

`coverage-funnel.mjs` now counts those ceilings after a reading has completely
ended. The reference is not passed to `readBook`; it first enters in this
audit. The result therefore diagnoses where coverage was lost without tuning
the instrument on its own answer key. In particular, `lostAtBorn` is not an
invitation to lower `minArrivals`: the audit also preserves the existing Born
refusal reasons. The licensed question is whether the shared ground failed to
re-zero when the material changed, or whether the Born comparison did exactly
what its declared null says. A candidate-local re-zero remains prohibited.

The funnel records reference nodes nominated before birth and admitted by the
Born rule, then reference edges whose endpoints were discoverable, whose
endpoints were born, whose pair was nominated by co-arrival, and whose
nomination cleared the displacement null.

The checked-in corpus texts are gitignored and were unavailable in the
2026-08-20 implementation environment, so the existing result files were not
rewritten with invented funnel counts. Re-run `node goldens/network/read.mjs`
after `fetch.mjs` succeeds to materialize them. The next engine change, if any,
must be selected from the first measured loss seam and tested against new or
held-out material—not selected for raising these frozen scores.

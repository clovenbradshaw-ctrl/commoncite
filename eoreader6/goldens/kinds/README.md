# N arbitrary conceptual kinds over a shared key pool

Kinds that share a meaningful amount of KEYS but not all VALUES — composed with
a known ground-truth partition, and run back through
`packages/engine/emergence/kinds.js`.

## What this was built to expose

`induceKinds` read kinds from KEY PRESENCE alone. A profile was a binary key
vector, similarity was Jaccard over key sets, and a kind's label was its
most-prevalent `field_id`. That is exactly right for the material it was built
on — Emma's relation terms differ in *which fields they carry*
(`anchor_shared` vs `subject_shared`), so key-identity stood in for
kind-identity and nothing was wrong.

Almost nothing else in the world is shaped that way. A leitmotif shares every
key with every other motif in the symphony — pitch, duration, timbre,
dynamics — and only the values differ. So does a photograph's every region and
a table's every row. Text is the special case.

On that material the organ did not degrade. It went **completely silent**:

```
three kinds over {locomotion, covering, clutch}, differing only in fillers
  kinds induced: 0
  profile(bird0) = [1,1,1]   profile(fish0) = [1,1,1]
  jaccard(bird0, fish0) = 1  pairHeight(bird0, fish0) = peer
```

Identical key profiles ⇒ every pairwise similarity is 1.0 ⇒ the cohesion null
has zero width ⇒ `degenerate_ground` at every cluster. SEED.md #3 firing
correctly on a statistic that never looked. The refusal was right; the
blindness was total.

## The generator

`synthesize.mjs` composes `n` kinds over a declared **schema** and knows nothing
about modality — that is the whole design. `MODALITIES` are nothing but declared
schemas, and the generator cannot tell a symphony from a spreadsheet. If it
could, it would have a text assumption in it.

```
symphony    pitch_hz(numeric) duration_ms(numeric) dynamics(ordinal)
            timbre(vector·8) articulation(categorical)
photograph  luminance(numeric) hue_deg(numeric) texture(vector·12)
            depth_order(ordinal) edge_kind(categorical)
table       magnitude(numeric) rate(numeric) tier(ordinal)
            channel(categorical) flagged(boolean)
prose       anchor_shared/subject_shared/stem_shared(boolean) register(categorical)
```

Two knobs, and **both ends of each are meaningful**:

| | 0 | 1 |
|---|---|---|
| `keyOverlap` | disjoint key pools — the regime key-Jaccard already solved | identical key pools — pure value discrimination |
| `valueDivergence` | one regime wearing `n` labels; **there is nothing to find** | maximally separated regimes |

Ground truth never enters the records: ids are positional (`rec:7`) and rows are
shuffled before naming, so neither id nor position encodes membership.

## Results

`read` is the material as composed. Both controls are what make it mean
anything — `strip` removes every value and leaves keys untouched (what the organ
saw before), `perm` permutes values *within* their keys, preserving every key
profile exactly and destroying only the value↔record binding. Recovery is
Adjusted Rand Index against truth, chance-corrected.

```
case                       n  recs | read  ARI    | strip ARI    | perm  ARI
------------------------------------------------------------------------------
symphony · overlap 1.0    4   32 |  4  1.000 |  0   —   |  0   —
photograph · overlap 1.0  4   32 |  4  1.000 |  0   —   |  0   —
table · overlap 1.0       4   32 |  4  1.000 |  0   —   |  0   —
prose · overlap 1.0       4   32 |  0   —   |  0   —   |  0   —
symphony · overlap 0.6    4   32 |  3  0.693 |  3  0.693 |  2  0.479
photograph · n=6          6   42 |  2  0.545 |  0   —   |  0   —
table · n=2               2   20 |  2  1.000 |  0   —   |  0   —
symphony · spread 0.6     4   32 |  2  1.000 |  0   —   |  1  0.000
symphony · divergence 0   4   32 |  0   —   |  0   —   |  0   —
```

Exact recovery on pure value discrimination in three modalities, from a
statistic that previously returned nothing at all. The `strip` column reproduces
the blackout in every shared-pool case.

## The finding that cost the most, and was not the one being looked for

The value channel alone was not enough, and the way it failed is the useful
part. With `valueDivergence: 0` — four labels over ONE regime, nothing to
find — induction reported **three kinds, every one `above`, both Born gates
passing, core lift up to 0.476.** Confabulation, the first of the seed's two
deaths, fully certified.

The gates were not weak. They were **the wrong null**, in exactly the shape
Amendment I describes. `eva` and `def` compare a cluster against RANDOM subsets
of the population — but the cluster was not random, it was *chosen* by
agglomeration for being the most cohesive subset available. "The best subset I
could find" beats "a subset drawn at random" whether or not any structure
exists. The perturbation has to destroy what the statistic actually exploits,
and what this statistic exploits is the **search**.

The key-only organ was protected from this **by accident**: Jaccard over a
handful of keys takes few distinct values, cohesion is quantised, null samples
come out all-equal, and `degenerate_ground` refused. Continuous values remove
the accident. Nothing was wrong before, and nothing was right before either —
the null was never licensed for this material, and nothing said so.

So `searchCohesions` re-runs the **entire search** on value-permuted material —
same spec, same material, fresh seed, SEED.md's own words for the pattern
null — and asks whether the real search found more cohesion than the same search
finds when values are no longer bound to the records that earned them. It costs
recall and buys precision: `divergence 0` now induces nothing, `perm` collapses
to nothing, and every case that still commits commits at ARI 1.000 except the
two noted below.

## A second null was needed, and the reason is worth keeping

Gating membership on the search null was wrong on its own. With **disjoint** key
pools the permuted search finds the same clusters at the same cohesion —
correctly, because key structure survives a value permutation untouched — so the
null refused kinds that were entirely key-carried. That is the Emma case, i.e.
the case the organ exists for.

The null was not lying. It answers *"do values add anything here?"* and was being
read as *"does this kind exist?"* A kind now needs ground from at least one
channel, each nulled by the perturbation that can actually speak to it
(SEED.md #6, plural grounds):

- **key channel** — nulled by the label shuffle, over key-only similarity
- **value channel** — nulled by the re-run search over within-key permutation

Every kind reports which one carried it in `heightGate.ground`
(`key` / `value` / `both`).

## Limitations, stated so they are not mistaken for done

- **`prose · overlap 1.0` recovers nothing.** Four kinds over a 3-level
  categorical and three booleans genuinely cannot be separated — kinds must
  share levels. Refusing is the honest answer, but it is a refusal, not a pass.
- **Under-segmentation grows with `n`.** At `n=6` induction commits to 2 kinds
  (ARI 0.545) rather than 6. Average-linkage agglomeration with a derived
  threshold merges too eagerly at higher `n`; not investigated.
- **`perm` is not silence, and cannot be.** At `quantile: 0.95` the search null
  admits one cluster in twenty by construction. A residual survivor is the
  declared resolution being honoured. Conformance asserts recovery is at
  *chance* (|ARI| < 0.2), never that the false-positive rate is zero.
- **`pairHeight` is still key-only.** Two records sharing a key pool are `peer`
  whatever their values. Whether a value regime can be a strict refinement of
  another — the value-channel analogue of `sister-in-law ⊃ sister` — is not
  asked and not earned.
- **The composed material is not real material.** Every result here is on
  engineered regimes with known separation, the same standing as
  `goldens/multimodal`'s engineered transitions. That the mechanism works says
  nothing yet about whether real audio, real images, or real tables hand over
  kinds this cleanly.

## Run it

```
node goldens/kinds/synthesize.mjs        # schema summary per modality
node goldens/kinds/score.mjs             # the table above
node --test conformance/kind-values.test.js
```

# 12 — The nine terrains as the nine representations of data

**Repo:** eoreader6 (this file, the record of the standard) + `eo-constitution`
(ratification record) + `writing-code-in-eo` SKILL.md (Layer 2 enrichment,
consuming repo).
**Status:** RATIFIED as a representation standard, 2026-08-14, by direction of
the project owner. **Not** an `eo-constitution` Article II amendment — nothing
here is a routing test, so Article IV.1's "an amendment updates the
enforcement tests in the same change" does not apply and no
`assay/classify.js` change accompanies it. See `eo-constitution/STANDARD-1-NINE-TERRAINS-REPRESENTATION.md`
for the cross-repo ratification note.
**Governs:** nothing in `packages/engine` — no organ, roster entry, or
conformance test changes with this document. It governs how data is
*represented* downstream of the engine: consumed by `writing-code-in-eo`
(Appendix A's neighbor, Layer 2 enrichment) and cross-referenced from
`CUBE.md`.
**Discipline:** the [canon] / [measured] / [proposed] tagging this document
uses throughout, checked against running code before filing; `CUBE.md`'s own
rule that an empty cell is a question, not a backlog item, extended here from
organs to representations.

---

## Wiring notes (added at ratification — read this first)

Two corrections made while filing the proposal as received, both substantive
enough to flag rather than quietly fix.

**1. Canon-of-record paths, corrected.** The proposal as drafted cited
`core/operators.js`, `core/faces.js`, `core/cube.js` as canon of record.
Those are the `eoreader4.1`/`eoreader4.2` *legacy* paths — per
`eo-constitution/CONSTITUTION.md` Article I.2, legacy is frozen reference and
nothing is ported from it; a legacy organ that hasn't been re-earned does not
exist for placement purposes. The live `eoreader6` equivalents, verified
against running code, are `packages/engine/operators.js` (`DOMAINS`,
`GRAINS`, `TERRAIN_BY_DOMAIN`, `cellOf`) and `CUBE.md` (the three-faces
scaffold — deliberately prose, not a data structure; see its own opening
line). §0–§7 below cite the live paths.

**2. "Significance" is not yet canon in the engine.** The proposal's original
§1 called "Identity/Interpretation" an informal label being retired in favor
of "Existence/Structure/Significance." That overstates the case in one
direction. `packages/engine/operators.js` freezes
`DOMAINS = ["Existence", "Structure", "Interpretation"]` — a literal,
load-bearing constant, keyed into `TERRAIN_BY_DOMAIN` and read by every
`cellOf()` call in the engine — and `SEED.md` has a numbered section built on
the word ("XXI — Interpretation was starved by Structure, not by itself").
That is not informal usage; it is the frozen, running canon of the engine
tier (Article I.1). "Significance" is the term the *application* layer
uses: `writing-code-in-eo` SKILL.md uses it throughout Layers 1, 2, and 4 —
and that document is itself marked "Version 0.2 (proposal)," not ratified
engine canon. `CUBE.md` already flags the two as naming the same axis
("the same axis... not an analogy to it") without picking a winner. This
document does not pick one either: **Interpretation** stays the engine-canon
name, **Significance** stays the application-layer name, and the two are
documented as aliases, not as a resolved rename. Unifying them lineage-wide
would mean renaming a frozen constant and roughly sixteen call sites across
`operators.js` and `SEED.md` — a real, separately-scoped change, not a side
effect of this one. (A smaller, third note in the same family: the proposal
also retired "Object" as an informal column label, but `writing-code-in-eo`
Layer 2 still uses "Object" today as the formal name of the grain-axis
*category* — "Mode (how), Domain (where), Object (what grain)" — distinct
from "Global," which this search found no live usage of anywhere. "Object"
isn't dead terminology either; it's a second live name for the same
category, same as grain/Object below.)

The `Object/Global` half of the original deprecation clause is otherwise
unaffected — `Ground/Figure/Pattern` is already the canonical `GRAINS`
constant with no competing *value* names found anywhere in the lineage; only
the axis-category label ("grain" vs. "Object") is doubled, not the three
terrain-column names themselves.

The rest of this document is the original proposal, filed as received, with
the grid, connections, and corollary laws checked against `operators.js` and
`CUBE.md` and found to match.

---

## 0. The claim being standardized

"Nine terrains, nine ways to represent any data" is made precise as: every
representation has a native terrain — the one Site-face cell its structure is
built to hold — and that catalog is closed at nine. A spreadsheet, a graph, a
legend, and an EKG strip aren't four arbitrary UI choices; they're four
terrains wearing pixels. Real surfaces are composites (a dashboard is many);
the claim is that the atoms are nine and every composite decomposes into
them, forced the way the nine operators are forced. [proposed]

## 1. The canonical grid [canon]

|                 | Ground      | Figure  | Pattern  |
|-----------------|-------------|---------|----------|
| **Existence**   | Void        | Entity  | Kind     |
| **Structure**   | Field       | Link    | Network  |
| **Significance**\* | Atmosphere  | Lens    | Paradigm |

\* Third-row axis name: **Significance** here and in `writing-code-in-eo`
(Layers 1, 2, 4); the identical axis is named **Interpretation** in
`eoreader6/packages/engine/operators.js` (`DOMAINS`, frozen) and throughout
`SEED.md`. Both are live, current usage in different tiers — see Wiring
notes above, point 2.

Rows are Domains (Existence = whether things are; Structure = how they
connect; Significance/Interpretation = what they mean). Columns are grain
(Ground = ambient substrate; Figure = one individuated thing; Pattern =
recurring structure over Figures). A representation's native terrain is one
cell: pick the Domain it's about, then the grain it holds.

Deprecation: the informal row label "Identity" (for Existence) is retired;
"Existence" is unambiguous canon everywhere it's used (`operators.js`,
`CUBE.md`, `SEED.md`, `writing-code-in-eo`). The third row's name is *not*
fully deprecated to one term — see the footnote above and the Wiring notes.
The column labels "Ground/Figure/Pattern" were already sole canon (`GRAINS`
in `operators.js`); "Object" survives as a second, still-live name for the
*category* those three columns belong to, used in `writing-code-in-eo`
Layer 2 ("Domain by Object").

## 2. The nine terrains and their canonical surfaces

| Terrain (cell) | Canonical surface | Family | Blind to |
|---|---|---|---|
| **Void** — Ex·Ground | the empty frame: schema with no rows, coordinate plane before any mark, control-chart centerline | blank ledger, null curve, "no results" state | everything particular |
| **Entity** — Ex·Figure | the record: one spreadsheet row / DB tuple / index card / detail page | contact card, form response, log line | relation & type |
| **Kind** — Ex·Pattern | the taxonomy: category tree, pivot group-by, dendrogram, schema-as-type | legend, facet list, histogram bins | the individual |
| **Field** — St·Ground | the raw layout: page scan, map tile, flowed doc, hex dump, raster | document viewer, tiled map background | named relations |
| **Link** — St·Figure | the edge: one citation, hyperlink, foreign key, ER arrow, join row | cross-reference, "related to" chip | the whole |
| **Network** — St·Pattern | the node-link graph: Gephi, org chart, citation net, adjacency matrix | sankey, chord, subway map | the moment & individual salience |
| **Atmosphere** — Sig·Ground | the trace with a moving baseline: EKG strip, ticker, sparkline, running feed | activity stream, live log tail | fixed reference (it re-zeros) |
| **Lens** — Sig·Figure | the saved view: SQL VIEW, dashboard filter, camera preset, a chart-as-argument | pinned report, annotated figure, diagnosis panel | its own contingency |
| **Paradigm** — Sig·Pattern | the legend / ontology / style guide; a governing doc like the constitution | coding frame, controlled vocabulary | what it excludes |

Build laws worth carrying forward [measured] (against `CUBE.md` and
`eoreader6/11-terrain-occupancy-and-the-two-ascents.md`): Void is the shared
null every terrain calls fresh (a service, not a product). Entity is born
only from recurring consequence clearing a void-mask null — never
appearance. Kind clusters over relation terms, height discovered not
assigned. Field is pure byte-contiguity reassembly with no statistics — the
one terrain representable with zero inference. Link needs its endpoint
Entities first. Network is a decaying belief graph (it forgets). Atmosphere
is literally the span between two re-zero events. Lens is a fold one tier up
from Atmosphere (the "n-many lenses off one log at one cursor" mechanism,
gated by `CONSTITUTION.md` II.17). Paradigm = induced Kinds + their core
Fields, and refuses stretches carrying none of its cores.

## 3. The connections

**Type A — grain ascent within a Domain** (Ground → Figure → Pattern).
Existence: Void→Entity→Kind. Structure: Field→Link→Network. Significance:
Atmosphere→Lens→Paradigm. This is the helix at terrain grain: no Figure
without a Ground null to clear it, no Pattern without Figures to recur over.
[measured]

**Type B — cross-Domain dependency** (Existence → Structure → Significance).
Four edges the engine actually builds, all sloping forward — verified
against `packages/engine/operators.js`'s roster and
`11-terrain-occupancy-and-the-two-ascents.md` §0: [measured]

- Link ← Entity (a Link needs admitted endpoints)
- Kind ← Link (`induceKinds` clusters over relation terms)
- Network ← Entity, Link (belief graph over both)
- Paradigm ← Kind, Field (induced Kinds + core Fields)

Net shape: Significance is downstream of Structure downstream of Existence.
Every cross-Domain arrow points forward; none point back. A
Significance-terrain surface with empty Existence/Structure under it is a
reading with nothing beneath it.

## 4. Corollary laws

- **One native terrain per atom** (composites declare the union). [canon]
- **No terrain is a UI default** — choose from the data's home, not
  language's gravity toward Entity. [proposed]
- **The desert cell, in representation:** no surface may generate a Pattern
  terrain (Kind/Network/Paradigm) directly from a Ground terrain
  (Void/Field/Atmosphere) without a Figure mediating — you can't compose a
  Network straight from a Field. [proposed] (from the canonical SYN-at-Ground
  prohibition [canon], `CUBE.md`'s desert cell / `writing-code-in-eo`
  Layer 2's "the desert cell")
- **Grain must cohere across Act/Site/Stance** or the kernel rejects the
  event. [canon] (`writing-code-in-eo` Layer 2, "the coherence guard")
- **Cross-Domain claims carry their floor** — a Lens with no records/links
  under it is a Lens over Void. [proposed]

## 5. External validation — the nine subsume the classical taxonomies [proposed, cited]

The data-model tradition populates the Existence + Structure blocks (theory
of things and their connections): the relational model, developed by E.F.
Codd in 1970, represents data as tables → Entity (rows) + Kind (schema); the
hierarchical model, developed by IBM in 1968, organizes data in a tree →
Kind; the network model replaces the hierarchical tree with a graph,
allowing a record to have more than one parent → Network. The
Bertin–Wilkinson tradition is a theory of display landing on the
Ground/Figure rows plus all of Significance: Bertin's visual variables
include planar position, value, and hue (position→Field, value/hue as
wash→Atmosphere); texture-density is both selective and associative, ideal
for encoding categorical data → Kind; a grammar-of-graphics spec maps visual
variables (signifiers) onto data variables (signifieds) → a chart is one
Lens. Neither tradition alone spans the grid; the union does, with no cell
empty and no tenth demanded. That's external completeness evidence, not a
self-issued claim.

## 6. Honest gaps

The §2 surface exemplars are [proposed], not catalog canon — Appendix A of
`writing-code-in-eo` SKILL.md remains the authority on shipped contracts
(surface, `contract.terrains`, `contract.ops`, `contract.stances`,
renderer), and §2's "canonical surface" column is a broader, domain-neutral
catalog one level more general than Appendix A's ten shipped UI components;
the two are complementary, not competing, and Appendix A is not superseded
by this document. §0's "every composite decomposes" has no algorithm yet.
§5 is subsumption, not a closure theorem of the kind that backs the nine
operators against Codd's algebra — a representation-side proof that no
display targets a tenth terrain is the right next artifact. And, entered at
ratification rather than in the original draft: the Significance/Interpretation
naming fork (Wiring notes, point 2) is itself an honest gap — this document
records it rather than resolving it, and a future proposal that actually
wants to unify the name engine-wide should cite this file as the place the
fork was first written down in one place.

## 7. Ratification hook

On acceptance, this fixes going forward: (a) the axis names, with the
Significance/Interpretation fork explicitly retained rather than silently
picked (Wiring notes); (b) one-native-terrain-per-atom; (c) the three §4
proposed laws; (d) deprecation of "Identity" as a row label and no further
deprecation of "Object" as a category label, since it remains live in
`writing-code-in-eo`. Each point is acceptable or refusable independently,
the way the ledger rules on organs one at a time.

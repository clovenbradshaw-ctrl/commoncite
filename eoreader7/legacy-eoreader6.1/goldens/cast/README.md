# The cast golden

Ten net-new Project Gutenberg books in seven languages and three scripts, each
paired with a **third-party human analysis of the same book** — a Wikipedia
character list or `Figuren` / `Personnages` / `Szereplők` / `角色列表` section,
pinned to a revision id.

The question it asks:

> Does the engine discover a book's principal cast by recurrence and
> self-similarity alone, in a language and script where no name-string
> heuristic can help?

`referents/blind.js` already claims to find recurring shapes by self-similarity
with no human prior. This is the first fixture that can hold that claim to an
external witness.

## Why this reference and not chapter markup

Structural markup (EPUB TOC, `h2.chapter`) was the obvious ground truth and is
the wrong one. It certifies a segmenter. A character list certifies that
something was *individuated* — and it was produced by people reading the book
as literature, who never saw this engine and were not applying a rule to the
plaintext we ingest. That is the independence that matters.

`fetch.mjs` pulls both gifts and freezes them. Raw wikitext is stored verbatim
under `refs/`; cast extraction is deliberately **not** done at fetch time,
because pulling names out of a wikitable is our act, not the giver's, and
folding it in would make the received gift unauditable.

## Run it

```
node goldens/cast/fetch.mjs            # texts + references
node goldens/cast/fetch.mjs --refs-only
```

`texts/` is gitignored (12 MB). `refs/` and `fetched.lock.json` are committed —
they are the golden. Every text and every reference carries a sha256; every
reference carries a revision id and the giver's own timestamp.

Pinning is not bookkeeping. `fr-6497`'s reference was edited the same day it was
fetched. An unpinned reference is a moving target, and a score against one is
uninterpretable a year later: the number moves and nobody can say whether the
engine or the encyclopedia changed.

## What the slate cost, recorded so it is not re-surveyed

**Three languages had to be dropped, and the reasons are facts about Project
Gutenberg, not about the design.**

- **Russian** — 9 books total. The three narrative ones (`19681` Детство,
  `21186` Записки из подполья, `21183` Белые ночи) are **audiobooks**:
  `.txt.utf-8` 404s and the only plaintext is an English track listing with zero
  Cyrillic. The rest are an arithmetic problem book, religious odes, an
  art-history essay, a pamphlet and two short poems. **No Cyrillic narrative
  fixture exists on PG.**
- **Japanese** — 22 books. Four of the six largest are translations of English
  novels by a single translator, which carry English narrative structure and
  transliterated Western names. The only large native novel (`32941`) has no
  Wikipedia article. The one book meeting every criterion (`33307` 友情) is an
  88k-char novella with a 7-person cast — not a peer of the 2.6 MB Chinese
  entries, and pooling them would let scale masquerade as language. A real
  Japanese fixture comes from Aozora Bunko.
- **Arabic** — 1 item, a tribute to Michael Hart. Not a book.

Rejected for reference quality: `金瓶梅` (2.3 MB, no character-list article),
`Effi Briest` (its `Figurenübersicht` is a single SVG image), `Germinal` and
`Le Ventre de Paris` (no character section). Dutch was the hard Latin-script
language — Eline Vere, De stille kracht, Camera Obscura, De kleine Johannes,
Woutertje Pieterse, Sara Burgerhart and Noodlot were all checked on two wikis
and none has one.

## The finding that outranks the slate

**Every language broke name-matching, in a different way, before any engine ran.**

| book | the break | measured |
|---|---|---|
| `zh-24264` 紅樓夢 | reference is **Simplified**, material is **Traditional** | 賈寶玉 occurs 18×; the reference's 贾宝玉 occurs **0×** |
| `el-36248` Ιλιάδα | Pallis is **demotic**, reference lists **Attic lemmas** | nominative matching returns 11/31 and misses **Achilles and Agamemnon entirely** |
| `el-30613` Οδύσσεια | Polylas is katharevousa — *same reference, same language, cleaner match* | 24/37 vs 22/31 |
| `fi-11940` | 15 cases: Juhani / Juhanin / Juhania / Juhanille | exact match degrades against a **closed cast of exactly 7** |
| `hu-69689` | family name **first** (Nemecsek Ernő) | inverts the order Western name heuristics assume |
| `de-34811` | multigenerational family, most characters **share a surname** | discrimination cannot come from the name |

`Ἕκτωρ → Έχτορ` is a consonant change (κτ→χτ), not an ending, so suffix
stripping alone does not rescue it.

This is the nameless-referent principle appearing in the wild, unprompted, in
six independent forms. It is also why this fixture cannot be quietly passed by
a string matcher — the surfaces do not line up in any language here, so
anything that scores well has to have earned it some other way.

The pairing of `el-36248` with `el-30613` is deliberate: one reference, one
language, two translation registers, very different match rates. That
difference is a measurement, not noise.

## The read step's own finding: recall without discrimination (fi-11940)

`read.mjs` running `fi-11940` end to end scores `13/19` recall — unique named
characters recovered — against a chance ceiling the same run computes
alongside it: `mean 0.08, p95 1, max 1` over 400 trials. The reader clears
chance by roughly two orders of magnitude. Sitting right next to that number,
in the same JSON, is `precision 0.052` (14/269) — read as a scoreboard, that
looks like a failing grade on the same fixture.

It is not the same measurement, and treating it as one would be the mistake.
`registerSize` is 269 because Finnish's case system means the discovery step
is watching recurrence, not recognizing names. `sillä`, `minä`, `se`, `on`,
`siinä` — pronouns, the copula, adverbial particles — recur across a
407-unit read far more reliably than any single case-inflected name-form
does. This is the same gap `missingPrior` already names for this fixture
(`finnish_case_paradigm`, 15 grammatical cases): `Juhani` fragments into
`Juhani`/`Juhanin`/`Juhania`/`Juhanille`/..., so no single surface
accumulates the frequency a Western name would, while every one of those
grammatical particles is, by construction, un-inflected and maximally
recurrent. The 13 real hits are real — `lauri`, `aapo`, `eero`, `juhani`,
`simeoni`, `timo`, `tuomas`, `valko` among them — found by the same
self-similarity mechanism, at a rate chance would not produce once in 400
trials.

What the low precision measures is that recurrence alone individuates a
Finnish function word exactly as confidently as it individuates a Finnish
character, because agglutination makes closed-class words the *most*
recurrent surfaces in the material, not the least. Read this way, `fi-11940`
is not "the engine fails on Finnish" — it is the dual of the nameless-referent
table above. That table documents six ways surface form fails to **confirm**
a correct referent (Traditional/Simplified, Attic/demotic, name order,
shared surnames, ...). This is the case where recurrence with no name-string
prior cannot **discriminate** a referent from a grammatical particle. Both
are findings about this fixture, not a scoreboard to chase to zero by tuning
against it: the fix is a closed-class prior, scored against its own golden,
and belongs to CON · Pattern, not to relaxing this one's matcher.

## Handling notes

- **Strip PG boilerplate before measuring.** Whole-file script ratios are
  misleading — `pg30613` reads 86% Greek across the file and **100% Greek
  across the body**; the Latin is entirely front matter and license.
- **`el-30613` is one work across three ids** (`30613`/`30614`/`30615`, ~889 KB
  concatenated). `hu-76235` likewise has volume II at `76236`. `fetch.mjs`
  pulls companions automatically.
- **`zh-23962` 西遊記 is episodic.** Its 106 attested names are inflated: most
  demons appear in one or two chapters and the extractor picks up common nouns
  (妖精, 妖怪, 天竺). It rewards episodic detection, not sustained tracking —
  score it apart from `24264`, never pooled.
- **`nl-11024` is a flagged compromise.** `Gebruikte pseudoniemen` is a
  roman-à-clef key, not a character list; it omits Droogstoppel and Stern (which
  have their own subsections) and three entries are titles rather than names.
  Weight it low or treat its reference as partial.
- **`castAttested` in the manifest is not the raw name count.** It is reference
  names occurring ≥5× in the material. 紅樓夢 drops 367 → 80, 西遊記 408 → 106.
  The gap is reported, never silently closed.
- **`api.php` returns HTTP 200 with an empty body under load.** Parsed naively
  that is indistinguishable from "no such article", and it is how two
  independent surveys of this slate both recorded live articles as missing.
  `fetch.mjs` sends a descriptive User-Agent and **retries** empty bodies;
  `article_missing` is a separate, genuine result.

# The writer's own decay curve — accessibility marking, measured

`native/eval/writer-decay.mjs` on Frankenstein (coref-primed) and Pride and
Prejudice (unprimed — disclosed below). Zero model calls. Raw runs:
`writer-decay-{frankenstein,pride}.json`.

## The question this answers

How do natural-language writers WANT reading to happen — what decay rate,
what surf, what fold does the material itself ask for? The literature has
the mechanism: a writer chooses the FORM of every returning mention from a
model of what the reader still holds (Accessibility Theory, Ariel;
referential distance, Givón 1983). A pronoun says "you have this active." A
bare name says "retrievable." A definite descriptor re-gloss says "here is
a refresh." So the mapping **gap-since-last-mention → form-of-return** is
the writer's intended reader-memory curve, sitting in the text. This driver
reads it out, with dyadic bins (structural) and a majority criterion
(where a plurality flips) — no typed dials.

## Frankenstein, 3,525 mentions, 1,828 returns (prediction recorded before the run)

| gap (sentences) | n | pronoun | name | descriptor |
|---|---|---|---|---|
| 1 | 208 | **.567** | .236 | .197 |
| 2–3 | 273 | .308 | .425 | .267 |
| 4–7 | 295 | .224 | .393 | .383 |
| 8–15 | 253 | .126 | .411 | .462 |
| 16–31 | 240 | .083 | .429 | .487 |
| 32–63 | 200 | .115 | .375 | .510 |
| 64–127 | 158 | .013 | .361 | **.627** |
| 128–255 | 86 | .000 | .488 | .512 |
| 512–1023 | 34 | .000 | .676 | .324 |
| 1024–2047 | 30 | .000 | .833 | .167 |
| 2048–4095 | 6 | .000 | **1.000** | .000 |

Three findings, the first two predicted, the third not:

1. **The activation layer is real and fast.** Pronoun-form returns are the
   majority only at gap 1 and are extinct beyond 128. The writer's
   pronoun window on this material is ~1 sentence by the pre-declared
   majority criterion (meaningful minority to ~63).
2. **The identity layer does not decay.** Returns after 1,000–4,000
   sentences arrive as bare names, unglossed, at 83–100% share. The writer
   relies on the reader holding identity indefinitely.
3. **Descriptors own the middle distance** — not predicted. The definite
   descriptor ("the creature", "the stranger") peaks at gaps 64–127
   (.627) and then CEDES to names at extreme gaps. Ariel's scale calls
   definite descriptions intermediate-accessibility markers; measured,
   they occupy exactly the intermediate gap range. This is the writer's
   own re-grounding device, deployed where activation is gone but the
   discourse neighbourhood still is.

Together 1+2 are READING-POLICY P1's architecture — "activation decays,
identity does not, recall is retrieval" — appearing as a measured fact
about how writers write, not a design choice this engine asserts.

## Pride and Prejudice — the replication, and an honest artifact

4,625 returns, unprimed (no coref prior exists for this book).
**pronounShare is 0.000 in every bin, and that is an artifact of priming,
not a fact about Austen** — the pronoun arm binds nothing without the
prior (S7: a run without the coref prior is a result about an unprimed
reader and says so). What survives the artifact replicates the direction
on a different register: descriptor share rises monotonically with gap
(.009 at gap 1 → .326 at 512–1023), names dominate short range at ~.99.
The form MIX differs by genre — Austen names where Shelley descriptors —
which is itself the genre signal the question asked after; the curve's
direction is shared.

## The wiring answer: two clocks, both now measured from the material

- **Surf (retrieval / recurrence)**: `fold-prediction` measured that
  recurrence is governed by rate — the undecayed reader won, γ=1. That is
  the identity layer's clock, and the writer-decay curve independently
  confirms writers assume it (finding 2).
- **Fold (binding / the present)**: the writer's activation window is
  ~1–2 sentences on this material (finding 1). That is the clock for
  pronoun binding and aperture — NOT for retrieval, which is why handing
  the fold's short window to the recurrence task lost.
- **Re-ground cues**: descriptor-form returns are the writer marking
  "activation has lapsed, here is the re-entry" (finding 3) — the
  material's own fold-checkpoint signal, free to read.

## Limits, named

- Pronoun mentions are the activation arm's own bindings — organ-derived,
  not gold; unresolved pronouns never enter. The known conservatism
  under-counts pronouns at SMALL gaps, which biases against finding 1 —
  the true collapse is steeper, so the direction of bias strengthens the
  conclusion rather than manufacturing it.
- The majority criterion for "the writer's window" was declared before
  running; the full curve is the real object and is what ships.
- One book primed, one unprimed; a primed P&P (or a third genre —
  argumentative nonfiction) is the natural next arm.

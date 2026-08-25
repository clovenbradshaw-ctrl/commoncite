# Kernel rebuild checkpoint

Status note for the in-progress rebuild of this engine's kernel in `eoreader6.1`,
and for a determinism audit landing on this repo directly. Written so the plan
survives past this conversation.

## The idea

Rebuild the kernel — not as a JavaScript port, but grounded directly in EO's
own primitives, so the notation and the runtime stop being two different
things that have to be kept in sync by hand.

**The kernel is not the cube.** `CUBE.md` already says this: the 27-cell grid
"describes no data structure in this repository and must not become one." The
actual kernel is the ONE operation `SEED.md` names — difference against a
ground you rebuild — with three uses distinguished only by what the
difference is measured against: figure (against its own ground), pattern
(against the next ground — the difference this figure made), level (against
another figure's ground).

**That triad is not new.** Ground / Figure / Pattern is Peirce's Firstness /
Secondness / Thirdness: Ground is unrelated quality prior to any distinction;
Figure is brute dyadic fact, this against that; Pattern is mediation — a fact
becoming a rule for what the ground does next, which is exactly Bateson's
"difference that makes a difference." Spencer-Brown's calculus of indications
(the Mark; the law of calling; the law of crossing) gives the algebraic floor
underneath it, and its re-entrant forms are the formal reason Pattern/
Thirdness cannot be reduced to Figure/Secondness — a re-entrant mark oscillates
rather than settling, which is a proved result, not an assertion.

**Notation: EOT.** The EO wiki's own "Object axis" is explicitly named the
Time axis, and Decal Notation (an operator code plus one of `−` / `+` / `*`)
already gives a compact, native address for all 27 positions with composition
built in: `−` is reversal (the operator's ground — undoes/inverts), `+` is
forward (the canonical act), `*` is self-application (the operator meeting its
own pattern). This is the target language — not Rust, not JavaScript, not
Python standing in for it.

**Canonical form.** Every act reduces to one tuple: `(turn, subject, operator,
decal, object)`. Stance, site, and the numeric coordinates are pure functions
of `(operator, decal)` — read from the Decal table, never stored redundantly.
(`eoreader5`'s two incompatible cube ports, recorded in `CUBE.md`'s "known
contradiction," drifted apart from exactly this kind of redundant storage.)
Turtle, decal-compact, and JSON-event are three interchangeable renderings of
that one tuple; converting between them is re-punctuation, not translation.

**Time is a first-class axis.** Turns thread through a register: each act
receives exactly one scalar — the closing state of the act immediately before
it (`SEED.md` Amendment IX) — never a rollup of history. Order is
non-commutative and load-bearing, matching the EO wiki's event-streaming claim
that operator order is a feature, not an artifact to normalize away.

**The kernel is earned, not authored by fiat.** No module joins by being
written; it joins by clearing a growth-rule test the *existing* system runs —
a permutation-null check against the current core, gated by a mandatory
negative control — which is this repo's own discipline (`nul`'s `level()`,
the growth rule in `SEED.md`) carried forward rather than invented fresh.

**Goal: swap-in compatible.** `eoreader6.1`'s kernel should eventually
replicate this repo's actual behavior — ground/aperture (IQR), the witness
gate (`pattern.moved`), the `gap()` taxonomy, the growth rule with its
negative control, frame/register sequencing across turns, binding's three
nulls — closely enough to stand in for this JS kernel.

**Byte level, deferred on purpose.** Once the tuple and composition semantics
are proven, the same tuple packs into a byte: operator (9 values) into 4 bits,
decal (unmarked / `−` / `+` / `*`) into 2 bits. Not started yet — earning the
semantics comes first.

## Side audit, on this repo directly

External review flagged that this kernel's own first principle — "a ground
that cannot be replayed cannot be testimony" — has a live gap: several call
sites depend on host `Math.cos` / `sin` / `log` / `hypot`, none of which
ECMA-262 guarantees bit-identical across engines (V8 vs. JSC vs. SpiderMonkey
matters for `eochat`, which runs in a browser). Verified against source:

- `nul/index.js:101-103` — FFT twiddle factors (`Math.cos`/`Math.sin`)
- `nul/index.js:155-157` — Bluestein chirp table
- `nul/index.js:264-267` — the `phase` perturbation itself (`Math.hypot`, `Math.cos`, `Math.sin`)
- `nul/index.js:406-408` — `permutationEntropy`'s normalizer (`Math.log(factorial(window))`)
- `nul/index.js:442-445` — `irreversibility`'s Jensen-Shannon divergence

Baseline established before any change: `node --test conformance/*.test.js` →
**748 tests, 745 pass, 1 fail, 2 skipped.**

Plan (cheapest first): replace eliminable transcendentals with committed
constants. `Math.log(factorial(window))` is a pure constant over `window`'s
actual admissible range (`patternSpaceAdmissible` bounds it to 2–8) — an
8-entry table, computed once, committed as data, identical on every engine
forever. `Math.log(2)` in the same function is a universal constant, not
data-dependent — same treatment. The FFT/Bluestein trig and the per-sample
`p·log(p)` terms need more than a table (the domain isn't small and fixed):
either a self-authored deterministic transcendental implementation, or —
since every verdict here is a rank comparison and three of the four
statistics are natively ordinal or sum-based — a move to exact integer
arithmetic, which closes determinism, autarky, and safe parallelism at once.
Recorded as the next step, not done yet.

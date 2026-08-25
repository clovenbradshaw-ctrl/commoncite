# The plan golden — steering measured, physics pinned

The v0 of `NEXT-PLAN-EXECUTOR.md`, exercised two ways:

- `validator.test.js` — the mechanical layer, pinned: 13 tests, refusals as
  firmly as successes (unknown operator → `unknown_spec`, off-roster organ →
  `undeclared_organ`, cell mismatch → `undeclared_cell`, bare number →
  `undeclared`, unlicensed statistic/perturbation pair refused at validation,
  cycle → `self_referential`, declared chain held to `OPERATOR_ORDER`,
  executor dataflow inheritance, `not_earned` for adapterless organs with
  dependents refused in cascade). Run: `node --test goldens/plan/validator.test.js`.
- `plan-e2e.mjs` — a LOCAL model (Qwen2.5-1.5B-Instruct q4_k_m, llama.cpp,
  4 CPU threads, no GPU) in the steering seat, schema-constrained at decode
  time. Run against any OpenAI-compatible endpoint (`LLM_URL`).

## What the e2e measured (2026-08-16, two runs, trace in run.json)

**Run 1** — the model emitted a structurally correct plan first try: right
organs, right dependency lattice, correct (operator, grain) for all four
steps; the validator passed it without a repair round. It failed on address
literals — invented pointer syntax (`"snip:sourceId"`) instead of the real
source id. The physics answered every invented address with a typed gap
(`unknown document …`, `empty_prompt`), executed nothing wrong, fabricated
nothing, and the render honestly reported the handles covered nothing.

The diagnosis wrote the fix into the executor, not the prompt: per the spec,
dataflow belongs to the executor ("the model routes addresses between
steps; the executor dereferences depends_on itself"). `execute.js` now
resolves each step's source through its dependency lattice; a sourceId
naming no admitted document is replaced by the nearest dependency's source.

**Run 2** — with dataflow owned by the executor, the same model's plan
executed clean: 37 chunks admitted, 22 referents discovered (Elizabeth,
Margaret, Clerval, M Waldman…), 179 measured triples, every handle carrying
a real address and its typed gaps (`pronoun_and_descriptor_mentions_unresolved`
ships as a result, not an omission). Then the instructive failure moved up a
layer: the render step **confabulated** — "Elizabeth travels with Margaret"
is an invented pairing; the plan never included a binding step, so nothing
measured who travels with whom — and it cited zero handles despite the
instruction to cite every claim. The mechanical check caught both shapes:
`citationCheck.used = []`, all handles uncited.

## The finding

A 1.5B CPU model already produces valid, executable plans over the organ
roster when the schema constrains the shape and the executor owns dataflow —
steering quality is real at this scale, and the failures that remain are
exactly the ones L5 predicts: prose-layer instruction-following (citing,
not-inventing) fails silently and must be caught mechanically, which it was.
What run 2's answer needed was not a better prompt but the-fold's
`attribute()` — mechanical sentence-level attachment with a null floor —
ported over the handles, plus a completeness check ("the question's second
clause required a CON step no plan step covers"). Both are named in
`NEXT-PLAN-EXECUTOR.md`; neither is faked here.

No number in this golden was tuned against its own output: the plan schema,
the menu text, and the executor's inheritance rule were fixed from the spec
before the second run, and the model was not re-prompted toward the fixture.

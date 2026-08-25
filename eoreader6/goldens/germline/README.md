# The germline golden — how new code enters the engine

`packages/host/germline.js`, exercised two ways. The decomposition under
test (NEXT-PLAN-EXECUTOR.md's residual-code categories, made mechanical for
the first one, the admission-boundary perceiver):

- **enzyme** — `instantiate()`: mechanical assembly of a template whose
  three typed holes are the only places new text may land.
- **guide** — the fillings: short per-hole strings, each naming its giver.
- **complementarity scan** — before assembly: every hole filled, no unknown
  holes, no forbidden tokens (clocks, randomness, I/O, imports, eval — the
  `conformance/seed.test.js` list plus the smuggling routes), statements
  holes must return.
- **gates** — selection, not review: imports cleanly → exports the
  contract → behaves (finite numeric series, pure, monotone under
  `fraction`) → feeds `nul`'s `ground()` without a gap. Refusals are
  `not_earned`, naming the gate.
- **the boundary**: the germline path runs OUTSIDE plans. `execute.js`
  dispatches only organs that already exist; a running read can never grow
  itself mechanism mid-flight, and the roster is edited by ratification,
  never by this code.

`germline.test.js` pins 10 cases — refusals as firmly as the one full pass.
Run: `node --test goldens/germline/germline.test.js`.

## The e2e (same local model as goldens/plan: Qwen2.5-1.5B, CPU)

Three recorded runs, traces in `run-lines-refused.json`,
`run-words-refused.json`, `run.json`:

1. **Lines task — did not survive.** The model's guide carried a raw
   newline where a `\n` escape was meant (mangled crossing the JSON
   boundary), the imports gate refused, and the typed hint
   (`holes [load_body] contain raw newline/tab characters…`) was not
   enough for this model to repair. Recorded as a refusal — a result, not
   an error. Interface lesson: guides that need string escapes are beyond
   a 1.5B; tasks expressible with regex literals are not.
2. **Words task, first form — did not survive.** The model assigned to an
   undeclared variable instead of returning. This was mechanically
   detectable *before* assembly, so the scan now refuses a statements hole
   with no `return` (typed, named), and the pinned suite grew a case.
3. **Words task, with the scan rule and one worked example — survived.**
   First guide refused at the behavior gate; the one bounded repair round
   fixed it; the repaired candidate cleared imports → contract → behavior
   → physics. The organ that now exists is in `run.json` — a working
   perceiver never written by hand.

## The finding, stated honestly

Selection guarantees **contract**-compliance, not **intent**-compliance:
the surviving organ splits on sentence punctuation, not the whitespace the
task asked for — the model copied the example's shape over the task's
semantics, and no gate checks semantics. That is the next gate category,
and it should arrive the same way the others did: as a mechanical check the
guide itself supplies (a task-derived property the candidate must satisfy
on the fixture), never as a reviewer's impression. Until it exists, a
germline candidate is contract-true and intent-unverified, and anything
consuming one should say so.

No gate, scan rule, or prompt change was derived from the fixture's
content; the two interface improvements (return-scan, worked example) came
from the refusal traces, which is what refusal traces are for.

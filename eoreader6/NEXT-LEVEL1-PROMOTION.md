# Next: promote level-1 so self-holon actually fires on real reads

Status note for whoever picks this up next. Written so the plan survives
past the session that wrote it (same purpose `KERNEL_REBUILD_CHECKPOINT.md`
already serves for the kernel rebuild).

## What already exists, and why this is the next piece

`packages/engine/loops/self.js` gives the engine a real memory of its own
testimony: `promote()`'s settled claims get committed to a ledger, and a
later admission of the same source re-tests each commit's own regime —
`SELF` (reconfirmed), `SELF_MISMATCH` (revised), `WORLD` (genuinely new).
Proven end to end on real prose: `node --test conformance/reading-self-e2e.test.js`
runs this against `scripts/adversarial/fixtures/pg84-frankenstein.txt` and
watches a claim settle, reconfirm, then get caught being wrong after its own
words are rewritten.

`packages/engine/loops/self-holon.js` reads that ledger holonically: a claim
about a larger span is partly *made of* whatever smaller claims sit inside
it (Koestler's holon — the word `holon_level` and `engine/holon/task-log.js`
already carry). `deriveTestimonyLevels` builds wholes/parts/depth/cycles by
regime containment; `cascadingMismatch` reports which wholes rest on a part
that just mismatched, without ever re-tagging them itself.

**The gap:** `loops/read-level0.js` (the only reading pipeline currently
wired to `self.js`) only ever commits fixed-width regimes — every commit is
`{ start: occ, end: occ + 6 }`. Fixed-width, non-overlapping regimes almost
never contain one another. So on real text today, `self-holon`'s containment
relations are correctly computed and fully tested (`conformance/loops-self-holon.test.js`,
synthetic fixtures) — but on an actual book, `cascadingMismatch` will stay
empty. The mechanism is real; nothing produces the shape of data it needs
yet.

`scripts/read.mjs` already has the piece that would: `runLevel1`. It reads
level-0's own settled claims, bins them by density, and re-runs the *same*
`levelStep` test on the bins. A level-1 regime spans many level-0 regimes by
construction — genuine containment, for free, the moment it's wired in.

## The job

Promote `runLevel1` the same way `runLevel0` was promoted to
`loops/read-level0.js` — same discipline, same shape, not a new mechanism.
Concretely:

1. **`packages/engine/loops/read-level1.js`** — `runLevel1`'s own logic
   (`scripts/read.mjs` lines 54–80), verbatim in mechanism, options named and
   overridable with `read.mjs`'s own literals as defaults (`BIN_SIZE = 20`,
   `draws: 60`/`window: 3`/`seed: 5` for the density ground, `draws: 30`/
   `window: 2`/`reseeds: 8` for `structureOptions`) — mirror `read-level0.js`
   exactly: export the literal defaults too, for the same reason (a caller
   that recheck must use identical parameters to the ones the original
   commit was judged under).

2. **THE ONE REAL GOTCHA, not obvious from the code, worth reading twice:**
   `runLevel1`'s regimes are bin indices (`{ start: b-1, end: b+2 }`), not
   chunk indices. Bin `b` covers chunks `[b * BIN_SIZE, (b+1) * BIN_SIZE)`.
   `loops/self.js`'s ledger and `loops/self-holon.js`'s `contains()` both
   assume every regime lives in the *same* index space — they have no idea
   bins exist. If a level-1 regime gets committed with its raw bin-index
   `{start, end}`, `contains()` will compare bin-3 against chunk-847 and
   produce a nonsense containment relation — silently, no error, just wrong.
   **Convert level-1 regimes to chunk-index space before they ever reach
   `commitTestimony`**: `{ start: regime.start * BIN_SIZE, end: regime.end * BIN_SIZE }`.
   Do this conversion in the host-tier wiring (step 4 below), not inside
   `read-level1.js` itself — that module's own regimes are honestly in bin
   space, in bin-space units, and should stay that way for anyone reading its
   output directly; the chunk-space conversion is specifically for feeding
   `self.js`.

3. **`seriesExtent` for a level-1 commit is NOT `series.length`** (the
   causal-surprisal series's length) — it's `bins * BIN_SIZE` (in the same
   chunk-index units the containment conversion above uses), or more
   precisely the chunk-length the density array was actually built over.
   Get this wrong and extent-matching (`loops/self.js`'s own header explains
   why it exists — measured directly there: unrelated growth elsewhere can
   flip an untouched regime's verdict without it) will silently misbehave for
   level-1 commits specifically.

4. **`packages/host/reading.js`'s `admitReading`** — after computing level-0
   as it already does, also run `readLevel1(level0.results, series.length)`,
   convert its settled results' regimes to chunk-index space (step 2), and
   fold them into the SAME `settledResults` array passed to `admitSelf`
   before committing. `admitSelf`/`self.js` need no changes at all — they
   already accept any settled result with a `regime`/`structure`/
   `significance`/`settled` shape; they have no idea level-0 and level-1 are
   different mechanisms, and they shouldn't need to.

5. **Conformance, same bar this work was held to — do not settle for less:**
   - `conformance/loops-read-level1.test.js` — mirror
     `conformance/loops-read-level0.test.js`: a real level-0 result set with
     genuine density clustering produces real level-1 settled regimes;
     declared-option overrides actually take effect; empty/sparse input
     returns cleanly.
   - Extend `conformance/reading-self-e2e.test.js` (or add a sibling) proving
     the actual point of this work: on a real admission of
     `pg84-frankenstein.txt`, `sessionTestimonyHolarchy` returns a non-empty
     `relations` array with at least one `earned_by: "contains"` entry, and a
     constructed scenario where a level-0 mismatch produces a non-empty
     `cascaded` array from `admitSelf` pointing at a real, wider level-1
     commit — not synthetic fixtures standing in for it, the actual mechanism
     firing on actual prose. This is the test that proves the gap named in
     the previous commit's message is closed, not just narrowed.
   - Full suite: `node --test "conformance/*.test.js"` must stay at 100%
     pass, 0 regressions — check the number before and after, the way every
     commit in this lineage does.

6. **Register it.** `operators.js`'s `ORGANS` roster needs a `loops/read-level1`
   entry (and `host/reading/admit`'s own `what` text should be updated to
   mention level-1, since it now does more than it used to say). Follow the
   existing entries right above it in the file for the exact object shape.

## What NOT to do

- Don't touch `self.js` or `self-holon.js` themselves. Both are already
  general over "any settled claim with a regime" — level-1 is a new
  *producer* of settled claims, not a reason to change the consumer. If you
  find yourself editing either file to make level-1 work, stop — the
  conversion belongs in the host-tier wiring (step 2/4), not the ledger.
- Don't invent a new statistic. `runLevel1` already reuses `levelStep`
  exactly as `runLevel0` does — same discipline, same reason: it's already
  Born-null-gated, already earned.
- Don't skip the extent/index-space gotchas above to get something running
  faster. They are exactly the kind of bug that passes a shallow test and
  produces silently wrong containment relations on real books — the entire
  reason this file exists is so the next person doesn't rediscover them by
  shipping them first.

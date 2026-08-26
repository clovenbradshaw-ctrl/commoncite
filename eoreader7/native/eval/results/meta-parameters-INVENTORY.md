# The meta-parameter inventory — every reading dial that should be prior-then-learned

The pattern S13 established for decay, generalized and made a checklist.
Each core reading function below carries a dial that is today TYPED
(declared with a citation at best), and each has the same correct shape:

  omnimodal kernel mechanism
    + medium-specific adapter (the NL organ)
    + a genre-level PRIOR to start from (giver named)
    + the material's own MEASURED value, superseding the prior as reading
      proceeds — the supersession reported, never silent.

The decay window now runs this whole ladder (`kernel/return-curve.js` →
`adapters/text/accessibility.js` → genre prior → `writerDecay`'s reported
supersession). The rest of the inventory, from a scan of the code rather
than from memory:

| # | reading function | today's dial (where) | omnimodal kernel half | NL-adapter half | genre-prior signal | material-learned signal |
|---|---|---|---|---|---|---|
| 1 | **present / decay window** | ~~`PRONOUN_PRESENT.window = 8`~~ (three drivers) | `return-curve.js` | `accessibility.js` | a genre's measured curve (gothic ≠ social comedy ≠ nonfiction — measured: Shelley residual pronouns to gap 63, Austen extinct by 16) | **DONE** — the writer's own curve |
| 2 | **salience band** | `IDF_FLOOR = 2.0`, `MIN_LEN = 4` (memory/activation.js) | the band itself (distinctive ∧ recurring; the rate form is scale-free) | `MIN_LEN` is English morphology — fi-11940 shows agglutination breaks it | per-language morphology prior (UniMorph/UD, received) | where the band's yield stabilizes as the floor moves — a dmdWindow-shaped derivation |
| 3 | **recall floors** | `minActivation .05 / minMargin .2` (pronouns, anchoring, roles — "disclosed as unvalidated") | one-hop recall | what counts as a candidate | register prior | **self-calibration on structurally-certain instances**: sentences with exactly one live candidate have a known answer; the margin distribution of those bindings is the material's own yardstick for the ambiguous ones |
| 4 | **admission floors** | `minArrivals = 4` (Born-gate-cited — structural, keep); `minSurfaces = 2` (vocab); `refreshEvery`'s `minSurfaces = 1` | recurrence gates | what an "arrival" is (sentence) | episodic vs sustained genre (the cast golden's own zh-23962 note) | the arrival-gap distribution of already-admitted referents |
| 5 | **re-ground cadence** | `refreshEvery = 25` (perceiver); atmosphere `tolerance = 3` (the REC-TRIGGER brief's open magic number) | the REC trigger | chapter breaks, paragraphing, descriptor re-glosses | genre fold conventions | **the writer marks the fold points**: descriptor-form returns (finding 3) and boundary re-gloss density — free to read, unread today |
| 6 | **memory wiring budgets** | `edgeSlots = 24`, `topEdges = 6`, `completion = 0.5` (memory, anchoring, pronouns) | Hebbian encode/recall | — | — | widen-until-no-difference on the caller's own conclusion (the dmdWindow shape, applied to each budget) |
| 7 | **clock grain** | one observe = one tick; sentence as the unit; `CHUNK_WORDS = 40` (engine atmosphere) | tick semantics (P5.4: state the unit) | sentence vs clause vs paragraph vs dialogue turn is NL's own | verse/drama/prose conventions | the material's own segmentation — the writer already segmented it |
| 8 | **closed-class boundary** | `functionWordSet` share threshold; `UD_CLOSED` (received) | frequency-share mechanism (`earnedClosedClass`'s degeneracy check is already structural) | function words are NL | UD's own taxonomy (giver-named — in use) | the material's earned closed class, superseding the prior when non-degenerate |
| 9 | **null-arm scale** | `draws = 200 / 96 / 64`, seeds | perturbation nulls | — | — | a sequential stopping rule: draw until the verdict stabilizes — the REC brief's own "null-derived, not eyeballed" standard, applied to draw count itself |
| 10 | **verb-hood / vocabulary** | ~~`VERB > AUX`~~ (retired); `minSurfaces = 2` | co-occurrence tally | construction prior (built this branch) | UD treebank (received, `dropped` disclosed) | **DONE** — per-occurrence collapse; fold-conditioned vocabulary (levers lever 1) |
| 11 | **rhythm / surprise pacing** | aperture regime numbers; tier gammas | tier-stack surprise | narrative rhythm | `rhythm-priors.js` + `narrative-rhythm-prior.mjs` already do PRIOR TRANSFER between books — the pattern half-exists here | the material's own measured rhythm superseding the transferred one |

Three rows are the highest-leverage next work, in order:

- **Row 3** is the only one with a *novel* self-calibration mechanism named
  (structurally-certain instances as the material's own gold) — it would
  retire the one dial every binding organ shares and currently disclaims.
- **Row 5** closes the loop with S13's finding 3: the writer already marks
  where to fold, and `refreshEvery = 25` reads none of it.
- **Row 2** is the cast golden's fi-11940 finding waiting for its fix: the
  salience band's length floor is an English fact injected as a constant.

What does NOT belong on this list: floors that are structural rather than
empirical (`minArrivals`' Born-gate citation, binding.js's arrivals ≥ 2 —
"one arrival has no co-arrival to test"). A structural floor is a theorem
about the mechanism, not a model of the material, and turning it into a
learned dial would be un-earning it.

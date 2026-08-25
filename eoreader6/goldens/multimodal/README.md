# Cross-modality reading

Answers a question RESULTS.md left explicitly open: *"the omnimodal
commitment is a claim about plumbing... and not yet a claim about
perception."* This is that claim, measured, for the first time — on real
audio, image, and video, synthesized with a KNOWN ground-truth boundary,
run through the exact organ (`loops/turn.js::runTurn`) RESULTS.md measured at
22/24 recall against Frankenstein's real chapters (p≈0.005 vs a rotation
null).

## What was already real, and had never been run

`packages/engine/perceiver/{audio,image,video}/material.js` are not stubs —
they decode real media via system `ffmpeg` and reduce to genuine numeric
series: RMS energy per audio frame, mean scanline luminance per image row,
mean absolute frame-difference per video transition. `scripts/aperture-run.mjs`
already dispatches any file to the right perceiver by extension and runs
`nul`'s ground/pattern machinery generically. None of it had a conformance
test, and no test media existed. This is that test.

## The result

Three synthesized cases, each with an exact known transition point:

| modality | material | true boundary | `runTurn` found | within tolerance |
|---|---|---|---|---|
| audio | 5s silence + 5s 440Hz tone, 50ms frames | frame 100 (5.0s) | frames 103–104 | yes (±6) |
| image | 64×64, black top / white bottom | row 32 | rows 34–35 | yes (±4) |
| video | 20 static + 20 genuinely-moving frames, 10fps | transition 19 | transitions 23–24 | yes (±6) |

All three cleared by **surfeit** (the new material exceeds the ground's
support), not `moved` — a sharp level shift, not a subtler quantile-shape
drift, exactly matching what RESULTS.md documents for text: surfeit is good
at level shifts, `moved` is what catches variance-only changes.

## The batch detector misses all three — and that's a confirming result, not a gap

`goldens/surprise/detectors.mjs::numericVerdict` — the global-shuffle-null
detector this session built and verified on text and synthetic numeric
series — was run on the identical three materials. **It found nothing on
any of them.** This is not a weaker version of the same finding; it's the
*same* finding, reproduced cross-modally: a step function is roughly half
elevated values, so a full reshuffle of the whole series produces a window
of consecutive elevated values almost as reliably as the real arrangement
does, and the null saturates near the ceiling regardless of where the real
transition sits. `goldens/surprise/README.md` documented this for B1 (a
numeric spike) and B4 (a rate burst); this is the third and fourth
confirmation, on image pixels and video motion-energy, that this is a
property of the **(statistic, perturbation) pair**, not of text.

**The causal design is why `runTurn` succeeds where the batch detector
fails.** `runTurn` builds its ground only from material read so far and
asks whether the ground itself moved under maintenance (`pattern()`), not
whether one global shuffle of the whole series could occasionally reproduce
the peak. Before the transition arrives, the causal ground genuinely hasn't
seen it — there is no equivalent of "a lucky reshuffle already contains the
burst" available to a reader who hasn't read that far yet. This is the
same causal-vs-batch distinction `referents/entity.js` was built around
earlier this session, now confirmed as the reason cross-modal boundary
detection works at all.

## What this does and doesn't establish

It establishes that the boundary-detection MECHANISM is real plumbing that
works identically across four modalities on ENGINEERED, unambiguous
transitions (silence→tone, black→white, static→motion). It does **not**
establish that any modality's reduction is as *informative* as text's causal
surprisal for a genuinely ambiguous, naturally-occurring boundary — that is
a harder, still-open question (RESULTS.md's own binary-reduction experiments
found byte-level text reductions clearing nothing against a rotation null;
whether RMS energy or motion-energy would do better on a REAL audio drama or
film, with real ambiguous scene changes rather than an engineered step, is
untested and would need real media with an independently-verified reference,
the same discipline as `goldens/cast`'s third-party character lists).

## Run it

```
node goldens/multimodal/synthesize.mjs     # regenerates media/ via ffmpeg (gitignored, not checked in)
node goldens/multimodal/score.mjs
node --test goldens/multimodal/score.test.mjs
```

Requires `ffmpeg` on `PATH`.

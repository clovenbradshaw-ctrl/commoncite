// eoreader6 · conformance/reading-regime — loops/reading-regime::readingRegime
// held to the same discipline as every other terrain organ in this repo:
// causal, refuses to guess its channel, and its documented trigger condition
// actually fires and actually refuses to fire.
//
// WHAT THIS FILE DOES NOT CLAIM, and the two dead ends kept on the record so
// they are not re-walked.
//
// (1) An earlier MEANINGFUL test asserted a rezero landed at or after a
// hand-picked frame index — a hardcoded position standing in for evidence.
// A follow-up "shuffled control" compared one arbitrary shuffle against the
// real reading. Both were removed: a proper multi-trial shuffle-population
// comparison (K=30-40 seeded shuffles, scripts/lib/surrogates.mjs's own
// `shuffled`) does NOT separate the real reading from the shuffled population
// at conformance-test scale, checked on a hand-built fixture and on a
// 400-sentence excerpt of real pg84-frankenstein.txt (p in the 0.17-1.0
// range). Tuning a fixture until a low p-value appeared would be the same
// failure in a new shape. Statistical claims belong at full scale, in
// scripts/reading-regime-frankenstein.mjs, the same division of labor
// conformance/activation.test.js already keeps against
// scripts/activation-clearings.mjs.
//
// (2) The fixtures themselves were wrong, and the gate caught them. Every
// early fixture here used a shared-vocabulary `filler`, which makes `recalled`
// accumulate frame over frame — so the rezeros those tests asserted were the
// same metronome artefact the real Frankenstein run produced (re-zeros exactly
// 122 apart, 30 shuffled controls at mean 6.00 ± 0.00). The tests passed for
// the reason the mechanism was broken. `uniq` below exists because of that:
// unique per-frame vocabulary is what makes a genuine BURST possible instead
// of a ramp, and the burst is what an Atmosphere is actually for.
//
// What this file checks: the mechanism's documented trigger condition fires
// when by-construction satisfied, never fires when nothing recurs, refuses a
// trending channel, and does NOT refuse a burst that returns to baseline —
// properties of the plumbing and its guard, not claims about real text.

import { test } from "node:test";
import assert from "node:assert/strict";

import { readingRegime } from "../packages/engine/loops/reading-regime.js";

const mk = (lines) => lines.map((text, i) => ({ text, order: i, offset: i * 1000 }));

const SPEC = { channel: "recalled", window: 3, draws: 100, tolerance: 2, reseeds: 20, seed: 7, statistic: "burstiness", findOn: [] };

// A long unique-vocabulary establishing stretch (nothing recurs, so
// `recalled` sits at 0 throughout and the ground is built on a low
// baseline — comfortably past atmosphere.js's own groundFrom minimum of
// 10*window, 30 frames at window=3), followed by a sustained run of frames
// that each echo several already-planted motifs: a surfeit against the low
// ground, sustained long enough to clear `tolerance` consecutive times.
// `filler` shares its whole vocabulary across every frame, so `recalled`
// accumulates through it — the same property real prose has, and the one that
// makes a channel trend. Used only by the trend test below.
const filler = (n) => `frame ${n} the ordinary business of the afternoon continued with quiet errands and small unremarkable talk`;

// `uniq` shares nothing between frames, so recall can only come from a planted
// motif. This is what makes a burst possible: `recalled` sits at 0, rises
// through the callback block, and returns to 0 rather than climbing forever.
const uniq = (n) => `alpha${n} beta${n} gamma${n} delta${n} epsilon${n} zeta${n} eta${n} theta${n} iota${n} kappa${n}`;

const MOTIFS = [
  "the lantern swung above the harbour wall and the water answered",
  "gulls turned over the counting house while the ledgers were stacked",
  "the columns of careful ink were ruled again beside the bridge",
];

// The MEANINGFUL fixture: a stationary baseline, a mid-document callback burst
// that genuinely exceeds the ground it is measured against, and a long clean
// tail so the burst returns to baseline rather than running to the end. The
// establishing stretch clears atmosphere.js's own `groundFrom` minimum
// (10*window, 30 frames at window=3) before any push sees real ground.
function buildBurstCorpus() {
  const lines = [];
  let f = 0;
  for (let i = 0; i < 30; i++) lines.push(uniq(f++));
  for (const m of MOTIFS) { lines.push(`${uniq(f++)} ${m}`); lines.push(`${uniq(f++)} ${m}`); }
  for (let i = 0; i < 20; i++) lines.push(uniq(f++)); // let df catch up
  for (let i = 0; i < 12; i++) lines.push(`${uniq(f++)} ${MOTIFS[i % 3]} ${MOTIFS[(i + 1) % 3]}`);
  for (let i = 0; i < 40; i++) lines.push(uniq(f++)); // the burst returns to baseline
  return lines;
}

test("channel is declared — readingRegime refuses to guess which measurement feeds the tracker", () => {
  assert.throws(() => readingRegime(mk(["one", "two"]), { window: 4, draws: 50, tolerance: 2, reseeds: 10, seed: 1 }), /channel is declared/);
});

test("CAUSALITY (I1): reading the first k frames gives exactly the first k records reading all of it gave", () => {
  const frames = mk(buildBurstCorpus());
  const whole = readingRegime(frames, SPEC).records;

  for (const k of [1, 5, 20, 30, whole.length]) {
    const prefix = readingRegime(frames.slice(0, k), SPEC).records;
    assert.equal(prefix.length, k);
    for (let i = 0; i < k; i++) {
      assert.deepEqual(prefix[i], whole[i], `record ${i} read differently once only ${k} frames were available — the future is leaking backwards`);
    }
  }
});

test("the documented trigger condition fires: sustained clearings against an established ground produce a rezero", () => {
  const frames = mk(buildBurstCorpus());
  const { records, regimes, gaps } = readingRegime(frames, SPEC);

  assert.equal(records.length, frames.length);
  assert.ok(gaps.length > 0, "the ramp-up before one window of material has arrived must be a typed gap, not silently skipped");
  assert.ok(regimes.length >= 2, `expected at least one re-zero (>=2 regimes), got ${regimes.length} — a by-construction surfeit never registered as one`);
  assert.ok(records.some((r) => r.rezeroed), "no rezero fired at all");
});

test("the documented trigger condition refuses to fire: nothing ever recurs, so no ground can be exceeded", () => {
  const lines = Array.from({ length: 40 }, (_, i) => filler(i)); // pure filler, nothing ever recurs
  const { records, regimes } = readingRegime(mk(lines), SPEC);
  assert.ok(!records.some((r) => r.rezeroed), "no motif ever recurred; there is nothing here for a surfeit to be measured against");
  assert.equal(regimes.length, 1, "one open regime, never closed");
});

test("REFUSES A TRENDING CHANNEL: a ground over a rising series is a slope estimate, not a rebuilt nothing", () => {
  // The measured failure this gate exists for: `recalled` climbs with document
  // position because posting lists grow as the read proceeds, so every ground
  // built over a trailing window is exceeded structurally and the tracker
  // metronomes at a period set by the minimum ground size. `filler` shares its
  // whole vocabulary across every frame, which is what makes recall accumulate
  // — the same property real prose has.
  const lines = [];
  let f = 0;
  for (let i = 0; i < 30; i++) lines.push(filler(f++));
  lines.push(...MOTIFS.flatMap((m) => [`${filler(f++)} ${m}`, `${filler(f++)} ${m}`]));
  for (let i = 0; i < 40; i++) {
    const echoes = Array.from({ length: 1 + Math.floor(i / 8) }, (_, k) => MOTIFS[(i + k) % MOTIFS.length]);
    lines.push(`${filler(f++)} ${echoes.join(" ")}`);
  }
  const { refused, records, regimes } = readingRegime(mk(lines), SPEC);

  assert.ok(refused, "a monotonically rising channel must be refused, not silently metronomed");
  assert.equal(refused.gap, "trending_material");
  assert.deepEqual(records, [], "a refused reading places nothing");
  assert.deepEqual(regimes, [], "a refused reading closes no regime");
});

test("ADMITS A BURST THAT RETURNS: the gate refuses trends, not the signal an Atmosphere is for", () => {
  // The false positive worth guarding against in the guard itself. Unique
  // per-frame vocabulary means recall cannot accumulate through the filler, so
  // `recalled` sits at 0, rises through a mid-document callback block, and
  // returns to 0 — a real regime shift, which must NOT be refused as a trend.
  const { refused } = readingRegime(mk(buildBurstCorpus()), SPEC);
  assert.equal(refused, undefined, "a burst that rises and returns is the signal, not a trend — refusing it defeats the gate's purpose");
});

test("A RISE STILL IN PROGRESS IS REFUSED, and admitted once the return arrives — the same series, one window later", async () => {
  // Not a false positive: an identity. A burst occupying the final quarter and
  // the PREFIX OF A TREND are byte-identical inputs, so no statistic can
  // separate them — the evidence that would ("does it come back") is the
  // material after the end, which a causal reader does not have. A gap is what
  // this engine says when it cannot yet tell. The same values, once the return
  // has actually been read, are admitted.
  const { stationarityGap } = await import("../packages/engine/loops/atmosphere.js");
  const flat = Array.from({ length: 60 }, () => 0);
  const rise = [4, 6, 8, 10, 12, 14, 16, 18, 20];

  const stillRising = [...flat, ...rise];
  const returned = [...flat, ...rise, ...Array.from({ length: 60 }, () => 0)];

  assert.equal(
    stationarityGap(stillRising, { reseeds: 20, seed: 1 })?.gap,
    "trending_material",
    "a rise that has not yet returned is indistinguishable from a trend's prefix and must be refused",
  );
  assert.equal(
    stationarityGap(returned, { reseeds: 20, seed: 1 }),
    null,
    "once the return is in the material, the same rise is a burst and must be admitted",
  );
});

test("the refusal is a GAP, never a correction — the series is not detrended on the caller's behalf", async () => {
  const { stationarityGap } = await import("../packages/engine/loops/atmosphere.js");
  const rising = Array.from({ length: 60 }, (_, i) => i);
  const g = stationarityGap(rising, { reseeds: 20, seed: 1 });
  assert.ok(g && g.gap === "trending_material");
  assert.equal(typeof g.observed, "number");
  assert.equal(typeof g.threshold, "number");
  // stationary material passes untouched
  const flat = Array.from({ length: 60 }, (_, i) => (i % 2 ? 4 : 5));
  assert.equal(stationarityGap(flat, { reseeds: 20, seed: 1 }), null);
  // and reseeds is declared, never defaulted, like every other null's resolution
  assert.throws(() => stationarityGap(rising, {}), /reseeds is the resolution/);
});

test("declares its own cell, EVA · Figure — checked against the roster by conformance/coverage.test.js", async () => {
  const mod = await import("../packages/engine/loops/reading-regime.js");
  assert.deepEqual(mod.CELL, { op: "EVA", grain: "Figure" });
});

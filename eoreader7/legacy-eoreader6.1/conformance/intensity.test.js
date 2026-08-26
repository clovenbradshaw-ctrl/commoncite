// Intensity: the sign of aperture, and what it is actually tracking.
//
// Opened by reading Whitehead, Process and Reality II.3 ("The Order of Nature"),
// the four grounds of 'order'. The third is a claim this engine can be asked
// directly:
//
//   (iii) That the heightening of intensity arises from order such that the
//   multiplicity of components in the nexus can enter explicit feeling as
//   CONTRASTS, and are not dismissed into negative prehensions as
//   INCOMPATIBILITIES.
//
// Both halves have organs here. Contrast held is `disagreement()` — SEED.md #6,
// "censored differences are kept, not dropped." Dismissal into incompatibility
// is `exceeds_witness`: the ground cannot place the component at all, so it
// cannot enter feeling. Heightened intensity is `pattern().opened` — aperture
// widening, the seed's sign of encounter over extraction.
//
// Asking it turned up something before the answer: the sign had no null.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ground, difference, pattern, volume, burstiness, disagreement, isGap } from "../nul/index.js";

const W = 5;
const DRAWS = 256;
const RESEEDS = 16;

// A base with room in it: aperture 0.6 against a reseeding null of 0.2, so both
// halves of the sign are sayable. See the asymmetry test below for why that is
// not the default case.
const base = Array.from({ length: 40 }, (_, i) => i % 7);
const quiet = [1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 2];

const arrivalPattern = (amp, len) => {
  const material = [...base, ...Array.from({ length: len }, () => amp)];
  const before = ground({ material: base, draws: DRAWS, window: W });
  const after = ground({ material, draws: DRAWS, window: W });
  if (isGap(before) || isGap(after)) return null;
  const p = pattern({ before, after, material: base, reseeds: RESEEDS });
  return isGap(p) ? null : { p, material };
};

// Which of Whitehead's two fates did this arrival meet? Plural grounds for one
// figure, built from structurally different perturbation families.
const contrastClass = (material) => {
  const observed = burstiness(material, { window: W });
  const gS = ground({ material: base, draws: DRAWS, window: W, perturbation: "shuffle" });
  const gR = ground({ material: base, draws: DRAWS, window: W, perturbation: "resample" });
  const d = disagreement([difference(observed, gS), difference(observed, gR)]);
  if (d.censored === 0) return "placed"; // both grounds place it: no contrast to hold
  if (d.censored === 1) return "split"; // contrast HELD — one places, one censors
  return "dismissed"; // both refuse it: the negative prehension, in full
};

// ── the sign is owed a null ──────────────────────────────────────────────────
//
// `opened` was the bare inequality volume(after) > volume(before). Measured over
// 180 real arrivals: 77.8% of its verdicts fell inside the reseeding null,
// 41.1% flipped sign on a mere reseed, and 15.0% were exact ties reported as
// extraction. SEED.md #3 is unconditional — "a null of zero width is refused,
// everywhere, at every level" — and this was the one place the seed calls the
// whole physiology.

test("an exact tie is not extraction", () => {
  // The original failing shape: appending to `quiet` leaves volume untouched, and
  // `>` made every such arrival a vote for narrowing.
  const before = ground({ material: quiet, draws: DRAWS, window: W });
  const after = ground({ material: [...quiet, 2, 2], draws: DRAWS, window: W });
  const p = pattern({ before, after, material: quiet, reseeds: RESEEDS });
  assert.equal(p.volumeDelta, 0);
  assert.equal(p.opened, null, "no movement at all is not a direction");
});

test("a sign inside the reseeding null is not sayable", () => {
  const got = arrivalPattern(3, 3);
  assert.ok(got);
  const { p } = got;
  if (p.opened !== null) assert.ok(Math.abs(p.volumeDelta) > p.volumeNull);
  else assert.ok(Math.abs(p.volumeDelta) <= p.volumeNull);
});

test("every sayable sign clears the null it was measured against", () => {
  let sayable = 0;
  for (let amp = 0; amp <= 14; amp += 0.25) {
    for (const len of [2, 3, 5, 8, 13]) {
      const got = arrivalPattern(amp, len);
      if (!got) continue;
      const { p } = got;
      if (p.opened === null) continue;
      sayable++;
      assert.ok(
        Math.abs(p.volumeDelta) > p.volumeNull,
        `sign ${p.opened} on delta ${p.volumeDelta} inside null ${p.volumeNull}`,
      );
    }
  }
  assert.ok(sayable > 20, `too few sayable signs to have tested anything: ${sayable}`);
});

test("the null the sign is measured against is never zero-width", () => {
  // SEED.md #3. A zero-width null would license any hairline difference, and
  // volume's null does collapse to zero as `draws` grows — it is the most stable
  // thing in the engine. Stability is not a licence; it is the absence of one.
  const before = ground({ material: base, draws: 1024, window: W });
  const after = ground({ material: [...base, ...Array(8).fill(9)], draws: 1024, window: W });
  const p = pattern({ before, after, material: base, reseeds: RESEEDS });
  if (!isGap(p) && p.volumeNull === 0) assert.equal(p.opened, null, "a zero-width null clears anything put in front of it");
});

// ── an asymmetry that is not a bug, and must not be mistaken for one ─────────

test("narrowing is unsayable from a ground with no room to lose", () => {
  // `quiet`'s aperture is 0.2 and its own reseeding null is 0.2. The largest
  // narrowing physically available — all the way to zero volume — is exactly the
  // null. So from such a ground the engine can report encounter and can never
  // report extraction, whatever happens. Not a defect of the sign: a real fact
  // about what a narrow ground can testify to. Worth knowing before anyone reads
  // an absence of extraction as an absence of extraction.
  const before = ground({ material: quiet, draws: DRAWS, window: W });
  assert.ok(volume(before) > 0);
  const after = ground({ material: [...quiet, ...Array(20).fill(1)], draws: DRAWS, window: W });
  const p = pattern({ before, after, material: quiet, reseeds: RESEEDS });
  assert.ok(volume(before) <= p.volumeNull, "quiet's aperture does not clear its own null");
  assert.notEqual(p.opened, false);
});

// ── the prediction, and its refutation ───────────────────────────────────────

test("Whitehead (iii) is refuted here: intensity tracks dismissal, not contrast held", () => {
  // 565 arrivals across amplitude and length, three fates, permutation null on
  // the class labels (5,000 trials). Measured:
  //
  //   placed     n=259   widened 0.004     — nothing to hold, nothing heightens
  //   split      n=10    widened 0.100     — contrast HELD
  //   dismissed  n=296   widened 0.601     — the negative prehension, in full
  //
  // The association with class is real (beats 4,999/5,000 permuted trials), and
  // it runs the wrong way. Whitehead's claim is that intensity rises from
  // components entering feeling AS CONTRAST and specifically NOT from their
  // dismissal as incompatible. Here dismissal is the only thing that reliably
  // widens the ground: aperture responds to sheer exceedance — surfeit, the
  // reZero trigger — and barely responds to a contrast the engine holds.
  //
  // This is not a defect in `disagreement()`. It is what (iv) predicts of a
  // system with no superjects. Intensity-from-order requires that a satisfaction
  // become an objective component in a successor's concrescence, and nothing
  // here puts a witnessed record back into a later ground — SEED.md's
  // "no privileged frame," still unearned. There is no order for intensity to
  // arise FROM, so it arises from magnitude instead.
  //
  // Kept as a tripwire, not as an endorsement: if contrast held ever starts
  // outperforming dismissal, this test breaks, and that break is the signal that
  // the superject work landed.
  //
  // ADDENDUM — the superject work has since landed (objectify/nexus,
  // superject.test.js) and this tripwire DID NOT break. Re-run one grain up,
  // over a nexus of 509 satisfactions, same sweep design: placed 0.000, split
  // 0.000, dismissed 0.863, association beating 5,000/5,000 permuted trials.
  // The refutation is unchanged and slightly stronger.
  //
  // Necessary but not sufficient, and the reason is structural: a ground is
  // built by PERTURBING material, and both perturbation families destroy order,
  // so aperture — a property of that order-free null — cannot see order at any
  // grain. Objectifying satisfactions gives a successor its components; it does
  // not give the successor a ground that can be surprised by how they are
  // arranged. See superject.test.js, "order is legible to the figure and
  // marginal in the intensity."
  const rows = [];
  for (let amp = 0; amp <= 14; amp += 0.125) {
    for (const len of [2, 3, 5, 8, 13]) {
      const got = arrivalPattern(amp, len);
      if (!got) continue;
      rows.push({ cls: contrastClass(got.material), widened: got.p.opened === true });
    }
  }

  const rate = (cls) => {
    const r = rows.filter((x) => x.cls === cls);
    return r.length ? r.filter((x) => x.widened).length / r.length : null;
  };
  for (const cls of ["placed", "split", "dismissed"])
    assert.ok(rows.some((r) => r.cls === cls), `class ${cls} unpopulated — the grid no longer spans the transition`);

  assert.ok(rate("dismissed") > rate("split"), "dismissal outwidens contrast held — the refutation");
  assert.ok(rate("dismissed") > rate("placed"));

  // A proper null: permute the class labels and recompute the spread in widening
  // rate. This destroys exactly the association being claimed, which is SEED.md
  // #4 — a statistic must be sensitive to what its perturbation destroys.
  const widened = rows.map((r) => (r.widened ? 1 : 0));
  const spread = (labels) => {
    const g = {};
    labels.forEach((c, i) => {
      g[c] ??= [0, 0];
      g[c][0] += widened[i];
      g[c][1]++;
    });
    const rates = Object.values(g).map(([w, n]) => w / n);
    return Math.max(...rates) - Math.min(...rates);
  };

  const real = spread(rows.map((r) => r.cls));
  let a = 12345;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const TRIALS = 5000;
  let beaten = 0;
  const labels = rows.map((r) => r.cls);
  for (let t = 0; t < TRIALS; t++) {
    const s = labels.slice();
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    if (spread(s) < real) beaten++;
  }
  assert.ok(beaten / TRIALS > 0.99, `association not distinguishable from shuffled labels: ${beaten}/${TRIALS}`);
});

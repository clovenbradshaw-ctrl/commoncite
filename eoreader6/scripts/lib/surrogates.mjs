// eoreader6 · scripts/lib/surrogates — the null-making and scoring instruments,
// in one place because there are now two readings using them and this repo's
// standing complaint against itself is that everything gets reinvented worse.
//
// Nothing here is medium-specific. A boundary is an index into a series; the
// series can be surprisal per text-chunk or RMS per audio frame and none of
// this changes. That is the omnimodal commitment held to at the scoring layer
// too, where it is easiest to quietly break.

/** Deterministic: nul is pure and has none to lend, and an unreplayable control is not a control. */
export const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const gaussian = (next) => {
  const u = Math.max(1e-12, next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
};

export const shuffled = (xs, seed) => {
  const next = rng(seed);
  const out = Array.from(xs);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  return { mean, sd, min: s[0], max: s[s.length - 1] };
};

// ── the match window, derived from declared numbers, never fitted ────────────
//
//   back = window — one reach-unit, the material's own declared present. It is
//     the resolution at which this reading can distinguish two positions.
//   fwd  = window + tolerance*hop — the same, plus the detector's STRUCTURAL
//     lag: clearing is causal, so `tolerance` consecutive failures must
//     actually arrive before a boundary can be declared. Scoring a causal
//     detector symmetrically charges it for a delay it is required to have.
//
// Report both. Widening the window also lifts every null, and showing that it
// does is the difference between a matcher and an excuse.
export const causalWindow = (spec) => ({ back: spec.window, fwd: spec.window + spec.tolerance * spec.hop });
export const tightWindow = (spec) => ({ back: spec.window, fwd: spec.window });

export const hits = (found, truth, w) => truth.filter((t) => found.some((f) => f - t >= -w.back && f - t <= w.fwd)).length;
export const precision = (found, truth, w) => found.filter((f) => truth.some((t) => f - t >= -w.back && f - t <= w.fwd)).length;

// ── three nulls, weakest to strongest ───────────────────────────────────────

/**
 * WEAKEST. Boundary sets of the same size placed uniformly at random.
 *
 * Too weak to conclude from, and worth saying why: real sections are roughly
 * evenly spaced, and so is anything a tolerance-counter emits, so two evenly
 * spaced sets line up far more than two uniform ones do. Reported because it
 * is the baseline turn 1 was scored against, and the comparison is the point.
 */
export const chanceBaseline = (k, truth, w, extent, trials = 2000, seed = 991) => {
  if (k === 0) return 0;
  const next = rng(seed);
  let total = 0;
  for (let t = 0; t < trials; t++) total += hits(Array.from({ length: k }, () => Math.floor(next() * extent)), truth, w);
  return total / trials;
};

/**
 * STRONG BUT BLUNT. Run the whole mechanism again on the series shuffled.
 * Preserves the marginal distribution, destroys the order. Beating it proves
 * the order matters, but not WHICH property of the order — trend and
 * autocorrelation go out with everything else.
 */
export const shuffleControl = (series, run, controls, seed = 4243) =>
  Array.from({ length: controls }, (_, c) => run(shuffled(series, seed + c * 7919)));

/**
 * SHARPEST, AND THE CHEAPEST. Rotate the TRUTH.
 *
 * Changes neither the detector's output nor the sections' own spacing. Breaks
 * exactly one thing: whether the two line up. If recall survives this, the
 * alignment is the finding; if it doesn't, the recall was arithmetic — two
 * roughly periodic sets of marks agreeing about as well at any phase.
 */
export const rotationNull = (found, truth, w, extent, step = 1) => {
  const out = [];
  for (let d = step; d < extent; d += step) out.push(hits(found, truth.map((t) => (t + d) % extent), w));
  return out;
};

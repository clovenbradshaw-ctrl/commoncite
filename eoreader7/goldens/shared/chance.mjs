// eoreader6 · goldens/shared/chance — a Monte Carlo chance baseline, shared.
//
// Without this a recall number is uninterpretable: eoreader5's span-golden
// once reported 5/21 for a year with no baseline attached, and 5/21 turns
// out to sit at roughly the 95th percentile of chance. Both goldens/cast and
// goldens/network independently wrote this exact simulation (seeded LCG,
// `trials` draws of `drawSize` items each hitting independently at
// `hitProb`, sorted for percentiles) — reconciled here rather than kept as
// two copies. The LCG itself (`1664525`/`1013904223`) is the same family
// used inline throughout packages/engine/ — that duplication is a
// deliberate, established repo convention for tiny pure functions inside
// core organs, and is NOT reopened here; this file only removes the
// goldens-level duplication of the surrounding simulation loop.
export const monteCarloChance = ({ trials, drawSize, hitProb, seed = 12345 }) => {
  let s = seed;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const hits = [];
  for (let t = 0; t < trials; t++) {
    let h = 0;
    for (let i = 0; i < drawSize; i++) if (next() < hitProb) h++;
    hits.push(h);
  }
  hits.sort((a, b) => a - b);
  return { mean: hits.reduce((a, b) => a + b, 0) / trials, p95: hits[Math.floor(trials * 0.95)], max: hits[trials - 1] };
};

// eoreader6 · scripts/lib/segmentation-baselines — TextTiling (Hearst 1997)
// and C99 (Choi 2000), reimplemented from the published algorithm
// descriptions for the segmentation-frankenstein.mjs comparison. Neither is
// ported from an existing implementation and neither is validated against
// the original papers' own benchmark numbers — only against the properties
// their own papers claim (TextTiling's depth score is non-negative and zero
// where similarity is monotonic; C99's inside-density is non-decreasing as
// boundaries are added). Said plainly because this repo's citation
// discipline (SEED.md Amendment XVII) requires an ancestor be named without
// being misrepresented as reproduced.
//
// BOTH OPERATE ON THE SAME FRAMES the repo's own mechanism reads — 100-word
// chunks, not raw pseudosentences — because a fair comparison needs one
// granularity, not TextTiling's native pseudosentence scale versus this
// repo's own declared `window`. This is a real deviation from Hearst's and
// Choi's own unit of analysis, and it is the deviation a coarser corpus with
// the same declared frame size would also force.
//
// BOTH ARE BATCH, NOT CAUSAL. Unlike every reading mechanism elsewhere in
// this codebase, TextTiling and C99 see the whole document before placing
// any boundary — that is how the published algorithms work, and holding
// them to this repo's own causality invariant (I1) would not be reproducing
// them, it would be a different algorithm wearing their names.

import { tokenize, buildFrequencyTable, contentWords } from "../../packages/engine/perceiver/text/material.js";

/** Content-word TF vector per frame, shared by both baselines below. */
export const frameVectors = (frames) => {
  const allWords = frames.flatMap((f) => f.words);
  const table = buildFrequencyTable(allWords);
  return frames.map((f) => {
    const cw = contentWords(f.words, table);
    const v = new Map();
    for (const w of cw) v.set(w, (v.get(w) ?? 0) + 1);
    return v;
  });
};

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [k, v] of small) { const w = large.get(k); if (w) dot += v * w; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

// ── TextTiling (Hearst 1997) ─────────────────────────────────────────────
//
// Gap similarity is the cosine similarity between the block of `blockSize`
// frames on each side of a gap (Hearst's block comparison; blockSize=1 here
// because a frame already plays the role of Hearst's pseudosentence at this
// corpus's declared frame size, per the header note above). Depth score at
// gap i is how far similarity DROPS into i from its nearest higher point on
// each side — a valley measure, not a threshold on similarity itself, which
// is what lets TextTiling find a boundary in a generally-similar document
// and refuse one in a generally-dissimilar paragraph. Boundaries are local
// maxima of depth exceeding mean(depth) - stdev(depth)/2, Hearst's own
// cutoff, with a minimum-spacing filter so one valley cannot register twice.
export const textTiling = (frames, { blockSize = 1, minSpacing = 1, targetCount = null } = {}) => {
  const vecs = frameVectors(frames);
  const n = vecs.length;
  const blockVec = (center, side) => {
    // side: -1 = block ending at `center` (frames [center-blockSize+1, center]),
    //       +1 = block starting at `center` (frames [center, center+blockSize-1])
    const out = new Map();
    const lo = side < 0 ? Math.max(0, center - blockSize + 1) : center;
    const hi = side < 0 ? center : Math.min(n - 1, center + blockSize - 1);
    for (let i = lo; i <= hi; i++) for (const [k, v] of vecs[i]) out.set(k, (out.get(k) ?? 0) + v);
    return out;
  };

  // sim[g] = similarity across gap g (between frame g-1 and frame g), g in [1, n-1]
  const sim = new Array(n).fill(0);
  for (let g = 1; g < n; g++) sim[g] = cosine(blockVec(g - 1, -1), blockVec(g, +1));

  const depth = new Array(n).fill(0);
  for (let g = 1; g < n - 1; g++) {
    let leftPeak = sim[g];
    for (let i = g - 1; i >= 1 && sim[i] >= leftPeak; i--) leftPeak = sim[i];
    let rightPeak = sim[g];
    for (let i = g + 1; i <= n - 1 && sim[i] >= rightPeak; i++) rightPeak = sim[i];
    depth[g] = Math.max(0, (leftPeak - sim[g]) + (rightPeak - sim[g]));
  }

  const nonzero = depth.filter((d, g) => g >= 1 && g < n - 1);
  const mean = nonzero.reduce((a, b) => a + b, 0) / (nonzero.length || 1);
  const sd = Math.sqrt(nonzero.reduce((a, b) => a + (b - mean) ** 2, 0) / (nonzero.length || 1));
  const cutoff = mean - sd / 2;

  // `targetCount`: an ORACLE mode, named as such — every local maximum is a
  // candidate regardless of the cutoff, ranked by depth, so a caller asking
  // for a matched boundary count is choosing among the same peaks Hearst's
  // own threshold would rank first, not inventing new ones. Absent
  // `targetCount`, the cutoff is the only gate, exactly as published.
  const candidates = [];
  for (let g = 2; g < n - 2; g++) {
    if (depth[g] < depth[g - 1] || depth[g] < depth[g + 1]) continue; // local max only
    if (targetCount === null && depth[g] <= cutoff) continue;
    candidates.push(g);
  }
  candidates.sort((a, b) => depth[b] - depth[a]);
  const chosen = [];
  for (const g of candidates) {
    if (targetCount !== null && chosen.length >= targetCount) break;
    if (chosen.some((c) => Math.abs(c - g) < minSpacing)) continue;
    chosen.push(g);
  }
  return { boundaries: new Set(chosen.sort((a, b) => a - b)), sim, depth, cutoff };
};

// ── C99 (Choi 2000) ──────────────────────────────────────────────────────
//
// Similarity matrix -> local RANK matrix (each cell replaced by the fraction
// of same-neighborhood cells it exceeds, which is what makes the method
// robust to a whole-document similarity baseline that a raw cosine matrix
// does not correct for) -> divisive clustering that greedily inserts the
// boundary maximizing inside-block rank density, one at a time.
//
// TWO NAMED DEVIATIONS FROM CHOI'S PAPER, not silently taken:
//   1. Rank-mask radius here is declared from frame count (`max(2, floor(n/40))`)
//      rather than Choi's own formula tying it to average sentence length in
//      characters, because this comparison has no sentence-length scale.
//   2. STOPPING RULE. Choi's paper stops by a distributional test on the rank
//      matrix; here, boundaries are added while the marginal density gain
//      exceeds 10% of the largest gain seen so far (an elbow/scree rule) —
//      simpler than the original, and named as a substitution rather than
//      passed off as the same test.
export const c99 = (frames, { rankRadius = null, gainFloorFraction = 0.1, maxBoundaries = null } = {}) => {
  const vecs = frameVectors(frames);
  const n = vecs.length;
  const S = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    S[i][i] = 1;
    for (let j = i + 1; j < n; j++) { const s = cosine(vecs[i], vecs[j]); S[i][j] = s; S[j][i] = s; }
  }

  const r = rankRadius ?? Math.max(2, Math.floor(n / 40));
  const R = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const iLo = Math.max(0, i - r), iHi = Math.min(n - 1, i + r);
      const jLo = Math.max(0, j - r), jHi = Math.min(n - 1, j + r);
      let below = 0, count = 0;
      const v = S[i][j];
      for (let a = iLo; a <= iHi; a++) for (let b = jLo; b <= jHi; b++) {
        if (S[a][b] < v) below++;
        count++;
      }
      R[i][j] = count > 1 ? below / (count - 1) : 0;
    }
  }

  // 2D prefix sum of R for O(1) block-sum queries.
  const P = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
    P[i + 1][j + 1] = R[i][j] + P[i][j + 1] + P[i + 1][j] - P[i][j];
  const blockSum = (lo, hi) => P[hi + 1][hi + 1] - P[lo][hi + 1] - P[hi + 1][lo] + P[lo][lo];

  const densityOf = (boundaries) => {
    const bounds = [0, ...[...boundaries].sort((a, b) => a - b), n];
    let inside = 0, area = 0;
    for (let s = 0; s < bounds.length - 1; s++) {
      const lo = bounds[s], hi = bounds[s + 1] - 1;
      inside += blockSum(lo, hi);
      area += (hi - lo + 1) ** 2;
    }
    return inside / area;
  };

  // `maxBoundaries` explicit: an ORACLE mode, named as such — run the same
  // greedy density-maximizing insertion to exactly that many boundaries,
  // skipping the elbow stop below. Absent it, the elbow rule is what decides
  // when to stop, exactly as the unsupervised algorithm must.
  const oracle = maxBoundaries !== null;
  const boundaries = new Set();
  let prevDensity = densityOf(boundaries);
  const gains = [];
  const limit = maxBoundaries ?? n - 1;
  while (boundaries.size < limit) {
    let bestGap = null, bestDensity = prevDensity;
    for (let g = 1; g < n; g++) {
      if (boundaries.has(g)) continue;
      const trial = new Set(boundaries); trial.add(g);
      const d = densityOf(trial);
      if (d > bestDensity) { bestDensity = d; bestGap = g; }
    }
    if (bestGap === null) break;
    const gain = bestDensity - prevDensity;
    const maxGainSoFar = gains.length ? Math.max(...gains) : gain;
    if (!oracle && gains.length && gain < gainFloorFraction * maxGainSoFar) break;
    boundaries.add(bestGap);
    gains.push(gain);
    prevDensity = bestDensity;
  }
  return { boundaries, gains, rankRadius: r };
};

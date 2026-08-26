// eoreader6 · scripts/lib/segmentation-metrics — Pk and WindowDiff, the two
// standard error metrics text-segmentation literature uses instead of
// tolerance-window recall/precision. Built because this repo's own boundary
// work (activation-clearings.mjs, reading-regime-frankenstein.mjs) has so far
// only ever been scored against a tolerance window and a rotation null — a
// fair comparison against TextTiling/C99, whose own literature reports Pk and
// WindowDiff, needs the same instrument on both sides, not this repo's
// instrument applied to itself and a borrowed number applied to the others.
//
// Both take boundary sets as GAP INDICES: a segmentation of N units (frames)
// has N-1 candidate gaps, gap g sitting between frame g-1 and frame g, for
// g in [1, N-1]. A boundary set is the Set of gaps where a new segment
// starts. This is the same "boundary = frame index a new segment starts at"
// convention scripts/lib/surrogates.mjs and reading-regime-frankenstein.mjs
// already use, so callers can pass rezero frame indices straight through.

const hasBoundaryStrictlyBetween = (gaps, lo, hi) => {
  for (const g of gaps) if (g > lo && g <= hi) return true;
  return false;
};

const countBoundariesStrictlyBetween = (gaps, lo, hi) => {
  let n = 0;
  for (const g of gaps) if (g > lo && g <= hi) n++;
  return n;
};

/**
 * Beeferman, Berger & Lafferty (1999), "Statistical Models for Text
 * Segmentation" — Pk. Slide a window of width k across the N units; at each
 * position, ask whether the two ends sit in the same segment under the
 * reference and under the hypothesis, and penalize disagreement. Lower is
 * better; 0 is exact agreement, and a segmentation with no boundaries at all
 * scores well on documents with few true boundaries, which is why WindowDiff
 * below was proposed as a correction to this metric's own known bias.
 */
export const pk = (refGaps, hypGaps, n, k) => {
  if (n - k <= 0) throw new RangeError(`pk: window k=${k} is not smaller than n=${n}`);
  let disagreements = 0;
  const total = n - k;
  for (let i = 0; i < total; i++) {
    const refSame = !hasBoundaryStrictlyBetween(refGaps, i, i + k);
    const hypSame = !hasBoundaryStrictlyBetween(hypGaps, i, i + k);
    if (refSame !== hypSame) disagreements++;
  }
  return disagreements / total;
};

/**
 * Pevzner & Hearst (2002), "A Critique and Improvement of an Evaluation
 * Metric for Text Segmentation" — WindowDiff. Same sliding window, but
 * compares the COUNT of boundaries inside the window rather than a same/
 * different-segment bit, which is what fixes Pk's near-miss and
 * boundary-count insensitivity. Lower is better.
 */
export const windowDiff = (refGaps, hypGaps, n, k) => {
  if (n - k <= 0) throw new RangeError(`windowDiff: window k=${k} is not smaller than n=${n}`);
  let disagreements = 0;
  const total = n - k;
  for (let i = 0; i < total; i++) {
    const refCount = countBoundariesStrictlyBetween(refGaps, i, i + k);
    const hypCount = countBoundariesStrictlyBetween(hypGaps, i, i + k);
    if (refCount !== hypCount) disagreements++;
  }
  return disagreements / total;
};

/**
 * The conventional k: half the reference's own mean segment length, rounded.
 * Declared as a function of the REFERENCE segmentation only (never of the
 * hypothesis being scored), which is what keeps a method from picking its
 * own favorable window — the same discipline as this repo's `tightWindow`
 * being derived from the spec, not from what a given run happened to find.
 */
export const conventionalK = (refGaps, n) => {
  const boundaryCount = refGaps.size ?? refGaps.length;
  const segmentCount = boundaryCount + 1;
  const meanSegLen = n / segmentCount;
  return Math.max(1, Math.round(meanSegLen / 2));
};

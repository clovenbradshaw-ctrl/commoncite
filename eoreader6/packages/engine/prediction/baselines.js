// eoreader6 · prediction/baselines — the minimum bar a candidate must clear.
//
// Re-earned from eoreader5's packages/engine/prediction/baselines. This file
// did not exist here even as a stub, which is the more interesting half of the
// port: without baselines, "our organ predicts well" is unfalsifiable, and the
// whole exercise becomes a system becoming what it was asked to be — the
// failure mode SEED.md's entelechy section is written against.
//
// A baseline emits a gaussian whose spread is DERIVED FROM THE DATA, never a
// hand-set constant, for the same reason nul refuses a zero-width null: a
// spread chosen by hand would clear or condemn anything put in front of it.
// When no spread is justified (too little history, a constant series) the
// baseline honestly degrades to a bare point prediction rather than inventing
// a probability, and scoring will then mark it improper instead of pretending.
//
// Pure: no clock, no randomness, no I/O, no ambient state.

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Sample standard deviation (Bessel-corrected). 0 for <2 points or a constant series. */
const stdev = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1));
};

const diffs = (xs) => {
  const out = [];
  for (let i = 1; i < xs.length; i++) out.push(xs[i] - xs[i - 1]);
  return out;
};

const requireHistory = (history, name) => {
  if (!Array.isArray(history) || history.length === 0)
    throw new TypeError(`${name}: history must be a non-empty array of numbers`);
  for (const x of history)
    if (typeof x !== "number" || !Number.isFinite(x))
      throw new TypeError(`${name}: history must contain only finite numbers`);
};

/** A central value plus a data-derived spread, or a point when no spread is justified. */
export const gaussianOrPoint = (centralValue, spread) =>
  Number.isFinite(spread) && spread > 0
    ? Object.freeze({ kind: "gaussian", mean: centralValue, sd: spread })
    : Object.freeze({ kind: "point", value: centralValue });

/** Persistence: the most recent observation. Spread is the stdev of first differences. */
export const lastValue = (history) => {
  requireHistory(history, "last-value");
  return gaussianOrPoint(history[history.length - 1], stdev(diffs(history)));
};

/**
 * Random walk without drift. Identical centre to persistence; spread widens
 * with the square root of the horizon. At h = 1 it coincides with last-value,
 * and it is kept distinct anyway so a multi-step caller has somewhere honest
 * to go rather than reusing a one-step number.
 */
export const randomWalk = (history, { steps = 1 } = {}) => {
  requireHistory(history, "random-walk");
  return gaussianOrPoint(history[history.length - 1], stdev(diffs(history)) * Math.sqrt(Math.max(1, steps)));
};

/** The mean of all history seen so far. Spread is the series stdev. */
export const globalMean = (history) => {
  requireHistory(history, "global-mean");
  return gaussianOrPoint(mean(history), stdev(history));
};

/** Mean over the last `window` observations. Spread from that same window. */
export const movingMean = (history, { window } = {}) => {
  requireHistory(history, "moving-mean");
  const w = Math.max(1, Math.min(window ?? Math.max(2, Math.floor(Math.sqrt(history.length) / 2)), history.length));
  const tail = history.slice(history.length - w);
  return gaussianOrPoint(mean(tail), stdev(tail));
};

/** The value one period back. Spread from the seasonal residuals x_t − x_{t−period}. */
export const seasonalPersistence = (history, { period }) => {
  requireHistory(history, "seasonal-persistence");
  if (!Number.isInteger(period) || period < 1)
    throw new TypeError("seasonal-persistence: period must be a positive integer");
  if (history.length <= period) return lastValue(history); // not enough history to look back
  const residuals = [];
  for (let i = period; i < history.length; i++) residuals.push(history[i] - history[i - period]);
  return gaussianOrPoint(history[history.length - period], stdev(residuals));
};

/**
 * The default suite for a one-step numeric task. Every candidate is committed
 * under the same horizon as every baseline, or the comparison is not a
 * comparison. `moving-mean` is the one that matters most for this repo: it is
 * the direct control for the regime candidate in ./candidates.js, which is the
 * same estimator differing ONLY in where it starts counting.
 */
export const defaultNumericBaselines = ({ window, seasonalPeriod } = {}) => {
  if (!Number.isInteger(window) || window < 1)
    throw new TypeError(
      "defaultNumericBaselines: window must be declared explicitly — it is the direct control for candidate:regime-mean, and a hidden default here can silently diverge from whatever window the candidate suite it is contrasted against declares",
    );
  const suite = [
    { id: "baseline:last-value", predict: (h) => lastValue(h) },
    { id: "baseline:global-mean", predict: (h) => globalMean(h) },
    { id: `baseline:moving-mean-${window}`, predict: (h) => movingMean(h, { window }) },
    { id: "baseline:random-walk", predict: (h) => randomWalk(h) },
  ];
  if (Number.isInteger(seasonalPeriod) && seasonalPeriod >= 1)
    suite.push({
      id: `baseline:seasonal-${seasonalPeriod}`,
      predict: (h) => seasonalPersistence(h, { period: seasonalPeriod }),
    });
  return suite;
};

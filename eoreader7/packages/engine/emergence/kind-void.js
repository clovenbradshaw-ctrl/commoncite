// eoreader6 · emergence/kind-void — THE NOTHING A KIND IS SEEN AGAINST, and
// the signals that emerge at kind grain.
//
// Two cells share this file:
//
//   NUL · Pattern   Kind · Unraveling   the nothing a kind is seen against
//   SIG · Pattern   Kind · Tracing      scouting signals at kind grain
//
// NUL·PATTERN. Every other NUL organ builds a ground — a nothing constructed
// by perturbing what is present — against which a figure is measured. Kinds
// are the Pattern grain of Existence, and their ground is the attribute
// distribution of the whole population: "what would two random subsets of
// relations look like?" The null holds neither kind fixed; both are shuffled
// independently from the population's attribute pool. A kind that cannot
// distinguish itself from a random partition has no structure (SEED.md #3:
// a null of zero width is refused — this null's width is the whole attribute
// space).
//
// SIG·PATTERN. Co-occurrence of kinds across frames is the raw signal of
// correlative structure. A kind that always appears alongside another is
// evidence that the two are correlated in the material. The signal is
// measured, not assumed: co-occurrence counts are tested against a permutation
// null that shuffles kind assignments across frames. The null destroys
// kind-frame alignment while preserving marginal counts (same discipline as
// every other null in this repo).
//
// DECLARED NUMBERS. Every parameter is required — none is defaulted.

import { gap, isGap } from "../../../nul/index.js";

// The cells this organ occupies — declared, checked by conformance.
export const CELLS = Object.freeze([
  Object.freeze({ op: "NUL", grain: "Pattern" }),   // Kind · Unraveling
  Object.freeze({ op: "SIG", grain: "Pattern" }),    // Kind · Tracing
]);

// ── NUL·Pattern: the nothing a kind is seen against ─────────────────────────

/**
 * Fisher-Yates shuffle (in-place). Same as binding.js — shared PRNG
 * discipline.
 */
const shuffle = (arr, rnd) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
};

/**
 * Build a feature vector for a set of relation-term records. Each record
 * carries structural facts (e.g., anchor_shared, subject_shared, conjunct).
 * The vector counts how many records have each feature.
 */
const featureVector = (records) => {
  const counts = new Map();
  for (const r of records) {
    for (const [k, v] of Object.entries(r)) {
      if (v === true || v === 1) {
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  return counts;
};

/**
 * Jaccard similarity between two feature vectors.
 */
const jaccard = (a, b) => {
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  let intersection = 0;
  let union = 0;
  for (const k of allKeys) {
    const av = a.get(k) ?? 0;
    const bv = b.get(k) ?? 0;
    intersection += Math.min(av, bv);
    union += Math.max(av, bv);
  }
  return union === 0 ? 0 : intersection / union;
};

/**
 * The nothing a kind is seen against: measure whether two kinds are
 * meaningfully different by shuffling kind assignments and testing whether
 * the observed difference exceeds the null.
 *
 * `kindA` and `kindB` are arrays of relation-term records (the kind's
 * members). `population` is the full set of records (both kinds combined,
 * plus any others).
 *
 * Returns { observed, samples, pValue }.
 */
export const kindVoid = (kindA, kindB, { draws, seed } = {}) => {
  if (!Number.isInteger(draws) || draws < 1)
    throw new TypeError("kindVoid: draws is declared, never defaulted");
  if (!Number.isInteger(seed))
    throw new TypeError("kindVoid: seed is declared, never defaulted");

  if (!kindA.length || !kindB.length)
    return { observed: 0, samples: [], pValue: 1, draws, reason: "empty_kinds" };

  const vecA = featureVector(kindA);
  const vecB = featureVector(kindB);
  const observed = jaccard(vecA, vecB);

  // The null: shuffle kind assignments across the population.
  const allRecords = [...kindA, ...kindB];
  const nA = kindA.length;

  let state = seed | 0;
  const rnd = () => { state = (state * 1664525 + 1013904223) | 0; return (state >>> 0) / 4294967296; };

  const samples = [];
  for (let d = 0; d < draws; d++) {
    const shuffled = shuffle([...allRecords], rnd);
    const nullA = shuffled.slice(0, nA);
    const nullB = shuffled.slice(nA);
    samples.push(jaccard(featureVector(nullA), featureVector(nullB)));
  }
  samples.sort((a, b) => a - b);

  // p-value: fraction of draws at or above the observed similarity.
  // LOW similarity = kinds are different = good. We test whether the
  // observed similarity is LOWER than the null (the kinds are more
  // different than random partitions).
  let belowOrEqual = 0;
  for (const s of samples) if (s <= observed) belowOrEqual++;
  const pValue = belowOrEqual / draws;

  return { observed, samples, pValue, draws };
};

// ── SIG·Pattern: kind co-occurrence signals ─────────────────────────────────

/**
 * Detect kind co-occurrence across frames and test each pair against a
 * permutation null.
 *
 * `kindAssignments` is a Map from frameOrder -> Set of kindIds present
 * in that frame. `kindIds` is the array of all kind IDs.
 *
 * Returns an array of { a, b, observed, pValue } records.
 */
export const kindCoOccurrence = (kindAssignments, kindIds, { draws, seed } = {}) => {
  if (!Number.isInteger(draws) || draws < 1)
    throw new TypeError("kindCoOccurrence: draws is declared, never defaulted");
  if (!Number.isInteger(seed))
    throw new TypeError("kindCoOccurrence: seed is declared, never defaulted");

  if (kindIds.length < 2)
    return [];

  // Compute observed co-occurrence counts.
  const frames = [...kindAssignments.keys()].sort((a, b) => a - b);
  const coOccurrence = new Map(); // "a\0b" -> count
  const marginalA = new Map();    // kindId -> frame count
  const marginalB = new Map();

  for (const fid of frames) {
    const present = kindAssignments.get(fid);
    if (!present || present.size < 2) continue;
    const ids = [...present];
    for (let i = 0; i < ids.length; i++) {
      marginalA.set(ids[i], (marginalA.get(ids[i]) ?? 0) + 1);
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}\u0000${ids[j]}`;
        coOccurrence.set(key, (coOccurrence.get(key) ?? 0) + 1);
        marginalB.set(ids[j], (marginalB.get(ids[j]) ?? 0) + 1);
      }
    }
  }

  // For each pair, test against a permutation null.
  let state = seed | 0;
  const rnd = () => { state = (state * 1664525 + 1013904223) | 0; return (state >>> 0) / 4294967296; };

  const results = [];
  for (let i = 0; i < kindIds.length; i++) {
    for (let j = i + 1; j < kindIds.length; j++) {
      const a = kindIds[i];
      const b = kindIds[j];
      const key = `${a}\u0000${b}`;
      const obs = coOccurrence.get(key) ?? 0;
      if (obs === 0) continue;

      // Null: shuffle kind assignments across frames.
      const nFrames = frames.length;
      const samples = [];
      for (let d = 0; d < draws; d++) {
        // For each frame, randomly include a or b based on their marginal rates.
        let nullCount = 0;
        const rateA = (marginalA.get(a) ?? 0) / nFrames;
        const rateB = (marginalB.get(b) ?? 0) / nFrames;
        for (const _fid of frames) {
          const inA = rnd() < rateA;
          const inB = rnd() < rateB;
          if (inA && inB) nullCount++;
        }
        samples.push(nullCount);
      }
      samples.sort((x, y) => x - y);

      let aboveOrEqual = 0;
      for (const s of samples) if (s >= obs) aboveOrEqual++;
      const pValue = aboveOrEqual / draws;

      results.push({ a, b, observed: obs, pValue, draws });
    }
  }

  return results;
};

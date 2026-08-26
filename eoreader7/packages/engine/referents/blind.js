// eoreader6 · referents/blind — existence detection with no human-named
// prior. admitFromPrior (perceiver/text/admit.js) is "received, never
// derived": correct for WHICH surfaces predicate one being, which is
// witness-tier knowledge that must be injected. But noticing that
// SOMETHING recurs at all needs no name and no giver — a listener notices
// a leitmotif before anyone tells them its name. This is that: pure
// self-similarity in raw numeric material, blind to modality, blind to
// identity. If real existence-detection can only run when a human has
// already curated a prior, it isn't sensing, it's being handed the answer.
//
// Motif shapes are normalized (mean-centered, spread-scaled) before
// comparison so recurrence survives amplitude drift — the same theme
// played louder is still the same theme.

const windowShape = (series, start, size) => series.slice(start, start + size);

// The cell this organ occupies on the operator grid (engine/operators.js):
// SIG · Void · Tending — existence detection with no human-named prior;
// noticing needs no name. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "SIG", grain: "Ground" });

const distance = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum / a.length);
};

const normalize = (shape) => {
  const mean = shape.reduce((a, b) => a + b, 0) / shape.length;
  const centered = shape.map((v) => v - mean);
  const spread = Math.sqrt(centered.reduce((s, v) => s + v * v, 0) / centered.length) || 1;
  return centered.map((v) => v / spread);
};

// Finds candidate "things" as clusters of mutually similar, recurring
// window-shapes across the whole series. No naming, no priors — only
// self-similarity and a minimum recurrence count.
export const findRecurringMotifs = (series, { windowSize = 8, hop = 2, similarityThreshold = 0.3, minOccurrences = 3 } = {}) => {
  if (series.length < windowSize * (minOccurrences + 1)) {
    return { motifs: [], positionsScanned: 0, reason: "not enough material for a recurrence claim" };
  }

  const positions = [];
  for (let i = 0; i + windowSize <= series.length; i += hop) positions.push(i);
  const shapes = positions.map((p) => normalize(windowShape(series, p, windowSize)));

  const minGap = windowSize; // occurrences must be genuinely separate, not overlapping copies of one window
  const matches = positions.map(() => []);
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (positions[j] - positions[i] < minGap) continue;
      if (distance(shapes[i], shapes[j]) < similarityThreshold) {
        matches[i].push(j);
        matches[j].push(i);
      }
    }
  }

  const parent = positions.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < positions.length; i++) for (const j of matches[i]) union(i, j);

  const clusters = new Map();
  for (let i = 0; i < positions.length; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(positions[i]);
  }

  const motifs = [...clusters.values()]
    .filter((occurrences) => occurrences.length >= minOccurrences)
    .map((occurrences) => ({ occurrences: occurrences.sort((a, b) => a - b), windowSize, count: occurrences.length }))
    .sort((a, b) => b.count - a.count);

  return { motifs, positionsScanned: positions.length };
};

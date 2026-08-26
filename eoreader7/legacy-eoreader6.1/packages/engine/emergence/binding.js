// eoreader6 · emergence/binding — THE MODALITY-BLIND LINK (CON·Figure).
//
// Structure·Figure's mouth. This organ reads the entity register
// (referents/entity.js::carryEntities) and binds pairs whose arrivals
// overlap within a declared window. The binding is modality-blind: it
// reads arrival indices, never surfaces, never words, never a language.
//
// ASSEMBLIES (built incrementally):
//   A2  co-arrival + displacement null — which pairs co-occur above chance
//   A3  direction + polarity — which way does predictive asymmetry run
//   A4  witness gate + record — reseed null; labels as provenance; arrivals
//   A5  graph seam — structural edgeKey, both keyings, Link-accepting path
//
// THE DISPLACEMENT NULL. For a candidate pair (A, B) with observed overlap
// k, the null holds A's arrival positions fixed and shuffles B's arrivals
// within the pair's shared extent (the union of both arrival ranges). The
// shuffled overlap is the statistic; the p-value is the fraction of draws
// at or above the observed k. Same spec as every other null in this repo
// (SEED.md Amendment I): permutation destroys alignment, preserves
// marginal counts.
//
// DIRECTION IS THE ASYMMETRY (A3). Predictive asymmetry is measured by
// transfer entropy: does A's presence reduce surprise on B's next state
// more than the reverse? The forward TE (A→B) and reverse TE (B→A) are
// computed over binary indicator series of the two entities' arrival
// positions. Polarity is the sign of the asymmetry (+ for A→B, − for
// B→A). A pair with no significant asymmetry is refused — no direction
// means no link.
//
// THE REVERSAL NULL. The observed TE is tested against a permutation null
// that shuffles one entity's arrivals to break temporal alignment while
// preserving marginal counts. The p-value is the fraction of draws at or
// above the observed TE. Same spec as the displacement null.
//
// DECLARED NUMBERS. Every parameter is required — none is defaulted. How
// much co-arrival and how much testimony count as structure is the
// caller's to say, not this file's (SEED.md #7).

import { isGap, gap } from "../../../nul/index.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// CON · Link · Binding — modality-blind co-arrival binding. Declared,
// checked by conformance.
export const CELL = Object.freeze({ op: "CON", grain: "Figure" });

/**
 * The relation the binding organ writes in its own voice when a caller
 * feeds its output to emergence/graph.js. One label, the machinery's
 * name for its own output — identity, never content.
 */
export const BINDING_RELATION = "co-occur";

// ── A2: co-arrival detection ────────────────────────────────────────────────

/**
 * Detect pairs of entities whose arrival sets overlap within `window`.
 *
 * `entities` is the register from carryEntities() — an array of entity
 * objects each carrying `.id` and `.arrivals` (an array of unit indices,
 * already sorted). Returns an array of pair records:
 *   { a, b, aArrivals, bArrivals, overlap }
 */
export const detectCoArrivals = (entities, { window } = {}) => {
  if (!Number.isInteger(window) || window < 1)
    throw new TypeError("detectCoArrivals: window is declared, never defaulted");

  const pairs = [];
  for (let i = 0; i < entities.length; i++) {
    const ea = entities[i];
    if (!ea.arrivals?.length) continue;
    for (let j = i + 1; j < entities.length; j++) {
      const eb = entities[j];
      if (!eb.arrivals?.length) continue;

      // Co-arrival: any of A's arrivals within `window` units of any of B's.
      let overlap = 0;
      let bi = 0;
      for (const ai of ea.arrivals) {
        while (bi < eb.arrivals.length && eb.arrivals[bi] < ai - window) bi++;
        let bj = bi;
        while (bj < eb.arrivals.length && eb.arrivals[bj] <= ai + window) {
          overlap++;
          bj++;
        }
      }
      if (overlap > 0) pairs.push({ a: ea, b: eb, aArrivals: ea.arrivals, bArrivals: eb.arrivals, overlap });
    }
  }
  return pairs;
};

// ── A2: displacement null ───────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle (in-place). Exported for testing.
 */
export const shuffle = (arr, rnd) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
};

/**
 * Count the number of A arrivals that have a B arrival within `window`.
 */
const countOverlap = (aArrivals, bArrivals, window) => {
  let count = 0;
  let bi = 0;
  for (const ai of aArrivals) {
    while (bi < bArrivals.length && bArrivals[bi] < ai - window) bi++;
    let bj = bi;
    while (bj < bArrivals.length && bArrivals[bj] <= ai + window) { count++; bj++; }
  }
  return count;
};

/**
 * Displacement null for one pair.
 *
 * Holds A's arrivals fixed, shuffles B's arrivals within the pair's
 * shared extent (the union of both arrival ranges). Returns the null
 * distribution and p-value.
 *
 * `extent` controls how far B's arrivals can be displaced:
 *   "combined-span" — B shuffled within [min(a∪b), max(a∪b)] (default)
 *   "per-co-arrival" — B shuffled within each co-arrival's ±window
 *
 * Returns { samples, observed, pValue }.
 */
export const displacementNull = (aArrivals, bArrivals, { window, draws, seed, extent = "combined-span" } = {}) => {
  if (!Number.isInteger(window) || window < 1)
    throw new TypeError("displacementNull: window is declared, never defaulted");
  if (!Number.isInteger(draws) || draws < 1)
    throw new TypeError("displacementNull: draws is declared, never defaulted");
  if (!Number.isInteger(seed))
    throw new TypeError("displacementNull: seed is declared, never defaulted");

  const observed = countOverlap(aArrivals, bArrivals, window);
  if (aArrivals.length === 0 || bArrivals.length === 0)
    return { samples: [], observed, pValue: 1, draws, window, extent, reason: "empty_arrivals" };

  // The shared extent: where B's arrivals can be placed.
  const allPositions = [...new Set([...aArrivals, ...bArrivals])].sort((a, b) => a - b);
  const lo = allPositions[0];
  const hi = allPositions[allPositions.length - 1];

  // Build the pool of available positions — all integer positions in the
  // extent that are NOT occupied by A's fixed arrivals.
  const aSet = new Set(aArrivals);
  const pool = [];
  for (let p = lo; p <= hi; p++) if (!aSet.has(p)) pool.push(p);

  // PRNG — LCG, same family as the rest of this repo.
  let state = seed | 0;
  const rnd = () => { state = (state * 1664525 + 1013904223) | 0; return (state >>> 0) / 4294967296; };

  const samples = [];
  for (let d = 0; d < draws; d++) {
    // Place B's arrivals uniformly at random from the available pool.
    const shuffled = pool.slice();
    shuffle(shuffled, rnd);
    const placed = shuffled.slice(0, bArrivals.length).sort((a, b) => a - b);
    samples.push(countOverlap(aArrivals, placed, window));
  }
  samples.sort((a, b) => a - b);

  // p-value: fraction of draws at or above the observed overlap.
  let aboveOrEqual = 0;
  for (const s of samples) if (s >= observed) aboveOrEqual++;
  const pValue = aboveOrEqual / draws;

  return { samples, observed, pValue, draws, window, extent };
};

// ── A2: combined binding ────────────────────────────────────────────────────

/**
 * Detect co-arrivals and test each against the displacement null.
 *
 * `entities` is the register from carryEntities().
 * Returns { pairs, nulls } where `pairs` is every co-arriving pair and
 * `nulls` is the map from pair key to its displacement null result.
 */
export const bindLinks = (entities, { window, draws, seed, extent } = {}) => {
  if (!Number.isInteger(window) || window < 1)
    throw new TypeError("bindLinks: window is declared, never defaulted");
  if (!Number.isInteger(draws) || draws < 1)
    throw new TypeError("bindLinks: draws is declared, never defaulted");
  if (!Number.isInteger(seed))
    throw new TypeError("bindLinks: seed is declared, never defaulted");

  const pairs = detectCoArrivals(entities, { window });
  const nulls = new Map();

  for (const p of pairs) {
    const key = `${p.a.id}\u0000${p.b.id}`;
    nulls.set(key, displacementNull(p.aArrivals, p.bArrivals, { window, draws, seed: seed + p.aArrivals.length, extent }));
  }

  return { pairs, nulls };
};

// ── A3: direction + polarity via transfer entropy ───────────────────────────

const LOG2 = Math.log(2);
const log2 = (x) => Math.log(x) / LOG2;

/**
 * Transfer entropy X→Y at one step of target history, on two binary
 * indicator series of equal length — POSITIVE BRANCH ONLY.
 *
 *   TE(X→Y) = Σ p(x_t, y_t, y_{t+1}=1) · log2[ p(y_{t+1}=1 | x_t, y_t)
 *                                                   / p(y_{t+1}=1 | y_t) ]
 *
 * WHAT THIS MEASURES, AND WHAT IT DOES NOT. This is DIRECTED PREDICTIVE
 * STRUCTURE, not causation, and the gap between those is not a matter of
 * degree. Measured on data built with a common cause driving X at lag 1 and Y
 * at lag 2 and NO direct X→Y edge, `reversalNull` over this statistic reported
 * significant directed structure in 100 trials out of 100, median p = 0.000
 * (eo-evidence assays/causality-synthetic/causality-golden.mjs). The confounded
 * signal ran at 44% the strength of a true one, which is unusable as a
 * discriminator: separating them by threshold requires already knowing which
 * case you are in.
 *
 * This is not a defect and there is nothing here to fix. Every bivariate
 * directed-information measure has this property, because two worlds — "X
 * causes Y" and "Z causes both" — can emit identical series, and no function of
 * those series distinguishes what the series do not encode. Separating them
 * takes a measured confounder to condition on, or a design in which assignment
 * was decided by something unrelated to the outcome.
 *
 * A caller who needs causation needs a different instrument. A caller who needs
 * to know whether A's arrivals make B's arrivals more predictable is in the
 * right place. See eo-evidence LAWS.md L9.
 *
 * The sum runs over triples whose target state is OCCURRENCE. The claim
 * is "A's presence makes B's occurrence more predictable" — the same
 * directed information flow the deleted link.js measured. The
 * complementary branch (predicting B's ABSENCE) is real structure too,
 * but it is a different claim and is not read here; a pair that
 * suppresses B's occurrence contributes negative mass and is refused by
 * the null, never emitted as a link.
 *
 * Computed from a single scan of the series into three joint tables; no
 * estimator, no parametric assumption — the empirical distribution over
 * the (x_t, y_t, y_{t+1}) triples.
 */
export const transferEntropy = (x, y) => {
  const n = x.length;
  if (n < 2) return 0;
  // Keys are packed bits: a = x_t, b = y_t, c = y_{t+1}, each 0/1.
  const joint = new Map();    // a<<2 | b<<1 | c   -> count
  const marg = new Map();     //  b<<1 | c          -> count
  const condB = new Map();    // b                  -> count
  const condAB = new Map();   // a<<1 | b          -> count
  for (let t = 0; t + 1 < n; t++) {
    const a = x[t] ? 1 : 0;
    const b = y[t] ? 1 : 0;
    const c = y[t + 1] ? 1 : 0;
    const j = (a << 2) | (b << 1) | c;
    joint.set(j, (joint.get(j) ?? 0) + 1);
    const m = (b << 1) | c;
    marg.set(m, (marg.get(m) ?? 0) + 1);
    condB.set(b, (condB.get(b) ?? 0) + 1);
    condAB.set((a << 1) | b, (condAB.get((a << 1) | b) ?? 0) + 1);
  }
  const total = n - 1;
  let te = 0;
  for (const [j, c] of joint) {
    const c0 = j & 1;
    if (c0 === 0) continue; // positive branch only — predicting that y occurs
    const b = (j >> 1) & 1;
    const a = (j >> 2) & 1;
    const pCab = c / condAB.get((a << 1) | b);
    const pCb = (marg.get((b << 1) | 1) ?? 0) / condB.get(b);
    if (pCab > 0 && pCb > 0) te += (c / total) * log2(pCab / pCb);
  }
  return te;
};

/**
 * Build a binary indicator series: 1 at positions where the entity
 * arrived, 0 elsewhere. `length` is the total number of units.
 */
const indicator = (arrivals, length) => {
  const out = new Array(length).fill(0);
  for (const i of arrivals) if (i < length) out[i] = 1;
  return out;
};

/**
 * Reversal null for one pair.
 *
 * Holds A's arrivals fixed, shuffles B's arrivals within the full reading
 * extent, and computes TE(A→B) and TE(B→A) for each draw. The null
 * distribution is the set of |fwd − rev| values under shuffling; the
 * p-value is the fraction of draws where the null's asymmetry exceeds
 * the observed asymmetry.
 *
 * Returns { samples, observed, pValue, fwd, rev }.
 */
export const reversalNull = (aArrivals, bArrivals, { totalUnits, draws, seed } = {}) => {
  if (!Number.isInteger(totalUnits) || totalUnits < 2)
    throw new TypeError("reversalNull: totalUnits is declared, never defaulted");
  if (!Number.isInteger(draws) || draws < 1)
    throw new TypeError("reversalNull: draws is declared, never defaulted");
  if (!Number.isInteger(seed))
    throw new TypeError("reversalNull: seed is declared, never defaulted");

  if (aArrivals.length === 0 || bArrivals.length === 0)
    return { samples: [], observed: 0, pValue: 1, fwd: 0, rev: 0, draws, reason: "empty_arrivals" };

  const x = indicator(aArrivals, totalUnits);
  const y = indicator(bArrivals, totalUnits);
  const fwd = transferEntropy(x, y);
  const rev = transferEntropy(y, x);
  const observed = fwd - rev;

  // PRNG — LCG, same family.
  let state = seed | 0;
  const rnd = () => { state = (state * 1664525 + 1013904223) | 0; return (state >>> 0) / 4294967296; };

  // Pool: EVERY position. B's arrivals are re-placed anywhere the real B could
  // have been, A's own positions included.
  //
  // This read `if (!aSet.has(p))` until 2026-08-15 — excluding A's positions,
  // so no null draw could ever put a B arrival on the same index as an A
  // arrival. The observation has no such restriction: real co-occurring
  // arrivals land on the same index all the time. The null was therefore drawn
  // from a strictly smaller space than the observation it was being compared
  // against, which pushes the observed asymmetry out toward the tail of a
  // distribution that could not reach it, and inflates significance.
  //
  // Measured on independent series, 500 trials per density, nominal alpha 0.05
  // (eo-evidence assays/causality-synthetic/fpr-check.mjs):
  //
  //            density  events   excluding-A   every-position
  //              0.18     216        13.4%          6.5%
  //              0.08      96         9.2%          7.3%
  //              0.03      36         9.8%          5.8%
  //
  // The general rule this is an instance of: if a perturbation cannot reach a
  // configuration the real material can exhibit, it is not a null of the same
  // thing. See eo-evidence LAWS.md L1a.
  const pool = [];
  for (let p = 0; p < totalUnits; p++) pool.push(p);

  const samples = [];
  for (let d = 0; d < draws; d++) {
    const shuffled = pool.slice();
    shuffle(shuffled, rnd);
    const placed = shuffled.slice(0, bArrivals.length).sort((a, b) => a - b);
    const yShuf = indicator(placed, totalUnits);
    const sFwd = transferEntropy(x, yShuf);
    const sRev = transferEntropy(yShuf, x);
    samples.push(sFwd - sRev);
  }
  samples.sort((a, b) => a - b);

  // p-value: fraction of draws where |null asymmetry| >= |observed|.
  const absObs = Math.abs(observed);
  let aboveOrEqual = 0;
  for (const s of samples) if (Math.abs(s) >= absObs) aboveOrEqual++;
  const pValue = aboveOrEqual / draws;

  return { samples, observed, pValue, fwd, rev, draws, totalUnits };
};

// ── A4: reseed null ─────────────────────────────────────────────────────────

/**
 * Reseed null for one pair — the witness gate's third test.
 *
 * Holds nothing fixed. Shuffles BOTH A's and B's arrivals independently
 * within the full reading extent, then counts overlap. The null asks:
 * "would these two entities co-occur this often if both were placed at
 * random?" This is a stricter test than displacement (which holds one
 * fixed) and answers a different question than reversal (which tests
 * directionality). All three must pass for the pair to be witnessed.
 *
 * Returns { samples, observed, pValue }.
 */
export const reseedNull = (aArrivals, bArrivals, { totalUnits, draws, seed } = {}) => {
  if (!Number.isInteger(totalUnits) || totalUnits < 2)
    throw new TypeError("reseedNull: totalUnits is declared, never defaulted");
  if (!Number.isInteger(draws) || draws < 1)
    throw new TypeError("reseedNull: draws is declared, never defaulted");
  if (!Number.isInteger(seed))
    throw new TypeError("reseedNull: seed is declared, never defaulted");

  if (aArrivals.length === 0 || bArrivals.length === 0)
    return { samples: [], observed: 0, pValue: 1, draws, reason: "empty_arrivals" };

  const observed = countOverlap(aArrivals, bArrivals, 1);

  // PRNG — LCG, same family.
  let state = seed | 0;
  const rnd = () => { state = (state * 1664525 + 1013904223) | 0; return (state >>> 0) / 4294967296; };

  // Pool: all positions in the reading.
  const used = new Set([...aArrivals, ...bArrivals]);
  const pool = [];
  for (let p = 0; p < totalUnits; p++) pool.push(p);

  const samples = [];
  for (let d = 0; d < draws; d++) {
    // Shuffle the full pool, then split: first |A| positions for A, next |B| for B.
    const shuffled = pool.slice();
    shuffle(shuffled, rnd);
    const shufA = shuffled.slice(0, aArrivals.length).sort((a, b) => a - b);
    const shufB = shuffled.slice(aArrivals.length, aArrivals.length + bArrivals.length).sort((a, b) => a - b);
    samples.push(countOverlap(shufA, shufB, 1));
  }
  samples.sort((a, b) => a - b);

  let aboveOrEqual = 0;
  for (const s of samples) if (s >= observed) aboveOrEqual++;
  const pValue = aboveOrEqual / draws;

  return { samples, observed, pValue, draws, totalUnits };
};

// ── A4: full Link record ────────────────────────────────────────────────────

/**
 * Build the full Link record for one pair: all three nulls + direction +
 * polarity + labels + arrivals.
 *
 * Returns a frozen record:
 *   { a, b, overlap, nulls: { displacement, reversal, reseed },
 *     direction, polarity, strength, labels, arrivals }
 *
 * `labels` is an optional array of relation labels from
 * discoverRelationVocab — provenance only, never admission-gating. A Link
 * with no label is not weaker.
 *
 * `direction` is "a→b" or "b→a" (the direction whose TE is larger and
 * clears the reversal null). `null` when neither direction clears.
 * `polarity` is "+" or "−" (sign of the asymmetry). `null` when
 * direction is null.
 */
export const buildLink = (pair, { totalUnits, draws, seed, extent, labels = [] } = {}) => {
  if (!Number.isInteger(totalUnits) || totalUnits < 2)
    throw new TypeError("buildLink: totalUnits is declared, never defaulted");

  const aArr = pair.aArrivals ?? pair.a.arrivals;
  const bArr = pair.bArrivals ?? pair.b.arrivals;

  // A2: displacement null
  const disp = displacementNull(aArr, bArr, {
    window: 1, draws, seed, extent,
  });

  // A3: reversal null for direction
  const rev = reversalNull(aArr, bArr, { totalUnits, draws, seed: seed + 7 });

  const strength = Math.abs(rev.observed);
  let direction = null;
  let polarity = null;

  if (rev.pValue < 0.05) {
    if (rev.fwd > rev.rev) {
      direction = "a→b";
      polarity = "+";
    } else {
      direction = "b→a";
      polarity = "−";
    }
  }

  // A4: reseed null — the witness gate's third test
  const reseed = reseedNull(aArr, bArr, { totalUnits, draws, seed: seed + 13 });

  return Object.freeze({
    a: pair.a,
    b: pair.b,
    overlap: pair.overlap,
    nulls: Object.freeze({ displacement: disp, reversal: rev, reseed }),
    direction,
    polarity,
    strength,
    labels: Object.freeze(labels),
    arrivals: Object.freeze({ a: Object.freeze(aArr), b: Object.freeze(bArr) }),
  });
};

// ── A2+A3: combined binding ─────────────────────────────────────────────────

/**
 * Detect co-arrivals, test displacement, compute direction + polarity,
 * apply the reseed witness gate.
 *
 * `entities` is the register from carryEntities().
 * `totalUnits` is the total number of units in the reading.
 * `labels` is an optional Map from pair key to label arrays — provenance
 *   from discoverRelationVocab, never admission-gating.
 * Returns an array of Link records (frozen). Only pairs that clear all
 * three nulls AND the reversal null are emitted with direction set.
 */
export const readLinks = (entities, { window, draws, seed, totalUnits, extent, labels } = {}) => {
  if (!Number.isInteger(window) || window < 1)
    throw new TypeError("readLinks: window is declared, never defaulted");
  if (!Number.isInteger(draws) || draws < 1)
    throw new TypeError("readLinks: draws is declared, never defaulted");
  if (!Number.isInteger(seed))
    throw new TypeError("readLinks: seed is declared, never defaulted");
  if (!Number.isInteger(totalUnits) || totalUnits < 2)
    throw new TypeError("readLinks: totalUnits is declared, never defaulted");

  const pairs = detectCoArrivals(entities, { window });
  return pairs.map((p, i) => {
    const key = `${p.a.id}\u0000${p.b.id}`;
    const pairLabels = labels?.get(key) ?? [];
    return buildLink(p, { totalUnits, draws, seed: seed + i * 13, extent, labels: pairLabels });
  });
};

/**
 * The graph adaptation: Link records become the triple shape
 * emergence/graph.js already eats — the two entity ids, the binding
 * relation, and polarity from direction. Only directed pairs (those
 * whose direction cleared the reversal null) emit triples; undirected
 * pairs are reported but do not feed the Network.
 */
export const bindingTriples = (links, { relation = BINDING_RELATION } = {}) =>
  links
    .filter((l) => l.direction !== null)
    .map((l) => ({
      subject: l.direction === "a→b" ? l.a.id : l.b.id,
      verb: relation,
      object: l.direction === "a→b" ? l.b.id : l.a.id,
      polarity: l.polarity,
    }));

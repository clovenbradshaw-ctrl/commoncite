// eoreader6 · generation/slots — what KIND of thing goes here, discovered from
// how forms behave in the ground rather than received from a lexicon.
//
//   induction  SEG · Network · Unraveling   (Differentiate · Structure · Pattern)
//   use        CON · Link   · Binding       (Relate       · Structure · Figure)
//
// ── WHY THIS EXISTS, AND WHY IT IS NOT THE THING THAT ALREADY FAILED ───────
//
// generation/RESULTS.md records a negative result that this module is the
// direct consequence of. `lemmaAbstraction` over UniMorph English abstracts
// 41.3% of Frankenstein's types correctly — `went→go`, `mice→mouse` — and
// makes next-form prediction WORSE at every training size, by 0.58 nats/form
// at 1k and 1.52 at 40k, after three fixes that each corrected a real defect.
// Worse the more it reads, so it is not a sparsity story more data would fix.
//
// The reason is visible once it is stated in this module's terms, and it is
// the whole design rationale here: UniMorph merges `go`, `went` and `gone`
// because English inflects them from one root. They are NOT SUBSTITUTABLE —
// "he had gone" is the ground's expectation and "he had go" is not — so the
// merged context is a context no reader ever occupies, and every share the
// merged level takes comes from a level that was doing better. A lexicon
// groups by an external fact about the language. A backoff level needs a
// grouping by THE QUANTITY IT IS BACKING OFF OVER: what may follow.
//
// So the replacement had to be DERIVED (how a form behaves in this ground)
// rather than RECEIVED (a table of what English does), and the constitution
// is what makes that a legal move rather than a violation of SEED.md #1.
//
// ── THE FIRST VERSION OF THIS FILE WAS REFUSED BY II.8, AND MEASURED SO ───
//
// Recorded in place, because the refusal is the most useful thing here and
// the shape recurs. The first build decided that two forms shared a slot by
// COSINE SIMILARITY between their surface co-occurrence vectors, settled by
// k-means. The constitution's II.8 names that exact mechanism three times
// over:
//
//   "No cheap compatibility. Who a surface denotes is a received prior,
//    never a dot product, overlap, or learned similarity over surfaces."
//   "No averaging of grounds." — a centroid is the mean of its members.
//
// It was a dot product, an overlap and a learned similarity over surfaces at
// once, with an averaging step, placed in the engine. Amendment 3 enforces
// this as `weights_present`, and `true` on an engine placement is refuted.
//
// THE MEASUREMENT SAID IT FIRST, and it is worth keeping because it is a
// constitutional article reproduced as a number. Sweeping the resolution of
// the grouping on Heidi (40,000 training forms, held-out 3,000):
//
//   classes   cohesion   delta vs surface   shuffled control
//         6     0.5216            -0.570             -0.341
//        16     0.6023            -0.843             -0.465
//        48     0.6731            -0.888             -0.483
//       140     0.7564            -1.063             -0.538
//       400     0.8800            -1.218             -0.741
//
// Monotone in both columns: THE TIGHTER THE GROUPING, THE WORSE THE READING.
// And the real inventory is worse than its own shuffled floor at every
// matched resolution — classes induced from destroyed order damaged the
// belief LESS than classes that genuinely captured surface co-occurrence.
// A weighted combination of what is already there cannot differ from itself,
// and the harder it weights, the more it costs. That is II.8, arrived at from
// the other side.
//
// So the cosine is KEPT AND DEMOTED. II.9's first consequence licenses
// exactly that: "a cheap sense organ is legal and useful; a cheap sense organ
// promoted to the verdict is refused." It NOMINATES pairs for inspection and
// decides nothing. The verdict is a perturbation with a null — see
// `substitutionTest`.
//
// A NAMED LIMITATION OF THAT ARRANGEMENT, so it is not mistaken for absent:
// pairs are only tested WITHIN a nominated class, so the sense organ's
// partition is a ceiling. The verdict can split a nominated class and can
// refuse it entirely, but it can never merge two forms the cosine happened to
// separate. On real material it refuses about 69% of what it is handed, so
// the ceiling is not currently the binding constraint — but a false negative
// from the nominator is invisible here by construction, and that is a
// property of this design rather than a bug in it. All-pairs confirmation is
// the version with no ceiling and is O(V²) in the vocabulary.
//
// ── IDENTITY BY CONSEQUENCE, APPLIED TO POSITIONS ─────────────────────────
//
// SEED.md: "two figures are the same iff they make the same difference to the
// ground. Never by appearance, not even in principle."
//
// A slot-class is that sentence applied one level down, to forms:
//
//   Two forms occupy the same slot iff substituting one for the other makes
//   the same difference to the ground — iff they license the same
//   continuations and are licensed by the same precursors.
//
// Nothing in that sentence mentions a word, a language, a part of speech, or
// a name. It is stated entirely in terms of the one operation, and it is why
// this is engine rather than prior: what a class DENOTES ("this is the noun
// class", "this is the dominant-function class") stays received and is never
// claimed here; how a position FUNCTIONS is measured by perturbation like
// everything else. That is exactly the denotation/function split SEED.md
// Amendment IV already made for time — do not assume time from the index,
// discover time from transformation — carried to structure:
//
//   DO NOT ASSUME GRAMMAR FROM A LEXICON. DISCOVER SLOTS FROM SUBSTITUTION.
//
// ── THE OMNIMODAL TEST, WHICH THIS IS BUILT TO PASS ───────────────────────
//
// Constitution II.1: would a leitmotif in a symphony have this problem? A
// cadence has a position that admits only certain harmonic functions; a
// listener who knows a dominant resolves does not thereby know the voicing.
// That is a slot, and this module's definition reaches it without alteration
// — the "forms" are whatever the perceiver quantised, the "consequence" is
// whatever followed. A part-of-speech tagger reaches none of it.
//
// ── WHAT IS DECLARED, AND WHY EACH NUMBER IS NOT A DEFAULT ────────────────
//
//   classes     how many slots the vocabulary is divided into. The resolution
//               of the grouping. Nothing derives it; a different value is a
//               different claim about how coarse the structure is, and two
//               runs at different values are two measurements, not one
//               measurement twice.
//   features    how many context forms the consequence is read over. The
//               reach of "what difference does this form make".
//   minCount    the evidence a form needs before it may be grouped at all.
//               Below it a form STANDS FOR ITSELF and is never pooled — see
//               abstractions.js on why an UNKNOWN bucket is the one grouping
//               guaranteed to be wrong.
//   iterations  the resolution of the settling.
//   seed        declared, never Math.random, so a run is a run.
//
// ── AND IT CARRIES ITS OWN NULL ───────────────────────────────────────────
//
// SEED.md #4 with Amendment I: a statistic must be sensitive to what its
// perturbation destroys, and sensitivity is a property of the (statistic,
// perturbation) PAIR. The perturbation here is the shuffle, which destroys
// order and preserves vocabulary exactly.
//
// MEASURED, AND THE DIRECTION IS THE OPPOSITE OF WHAT THIS FILE FIRST
// CLAIMED. The first version of this header predicted that shuffling would
// make the vocabulary MORE self-similar: every form's successor distribution
// converges on the unigram distribution, so every form becomes trivially
// substitutable for every other and the classes collapse. On Heidi at 40,000
// training forms the real induction scores a mean within-class cosine of
// 0.6731 and the shuffled one 0.5853 — it moved, and it moved DOWN.
//
// The prediction confused an expectation with a sample. Under shuffle a form
// met `n` times has `n` neighbours drawn iid from the unigram distribution,
// so its profile converges on that distribution IN EXPECTATION while any
// individual profile is a sparse random sample of a `features`-dimensional
// space — and two sparse random samples of a large space are very nearly
// orthogonal. Shuffled forms do not collapse together; they scatter apart.
//
// So the statistic is sensitive, which is all SEED.md #4 requires, and the
// sign carries the finding rather than the failure: REAL MATERIAL CONTAINS
// GROUPS OF GENUINELY SUBSTITUTABLE FORMS AND SHUFFLED MATERIAL CONTAINS
// NONE. `separation` is reported signed, and a separation near zero — not a
// negative one — is what would mean the induction was reading frequency.
//
// This control is the one the UniMorph run never had. A lexicon has no
// shuffled twin, so "the abstraction lost 1.5 nats" was reported against the
// surface chain alone. Here the same inventory is induced twice, from the
// same vocabulary, differing only in whether order survived.
//
// Pure: no clock, no I/O, no ambient randomness — the one PRNG is seeded from
// a declared argument and lives in this file only.

import { classAbstraction } from "./abstractions.js";
import { gap } from "../../../nul/index.js";

export const CELL = Object.freeze({ op: "SEG", terrain: "Network", stance: "Unraveling" });

/** Seeded uniform, the same shape used in emit.js and candidates.js. */
const rngFrom = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Read every form's consequence: what precedes it and what follows it.
 *
 * BOTH DIRECTIONS, AND THEY ARE KEPT APART rather than summed into one
 * neighbourhood bag. A form is constrained from the left by what licensed it
 * and from the right by what it licenses, and those are different facts — the
 * article and the adjective share their right-consequence and not their left.
 * Pooling them makes two forms look alike whenever either half matches, which
 * is the merge that would put `the` and `went` together for both being
 * followed by nouns.
 *
 * Features are the `features` most frequent forms, which is not a shortcut:
 * the frequent forms ARE the ones that carry positional structure, and a rare
 * context form appears too seldom to distinguish anything. Every other form
 * still gets a vector; it simply has no coordinate for a rare neighbour.
 */
const readConsequences = (tokens, { features, minCount }) => {
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);

  const byFrequency = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const featureIndex = new Map();
  for (let i = 0; i < Math.min(features, byFrequency.length); i++) featureIndex.set(byFrequency[i][0], i);
  const dim = featureIndex.size;

  // form -> Map<coordinate, count>. Sparse: a book has thousands of types and
  // each meets only a small share of the feature set.
  const left = new Map();
  const right = new Map();
  const bump = (store, form, coord) => {
    let v = store.get(form);
    if (!v) {
      v = new Map();
      store.set(form, v);
    }
    v.set(coord, (v.get(coord) ?? 0) + 1);
  };

  for (let i = 0; i < tokens.length; i++) {
    const form = tokens[i];
    if ((counts.get(form) ?? 0) < minCount) continue;
    if (i > 0) {
      const c = featureIndex.get(tokens[i - 1]);
      if (c !== undefined) bump(left, form, c);
    }
    if (i + 1 < tokens.length) {
      const c = featureIndex.get(tokens[i + 1]);
      if (c !== undefined) bump(right, form, c);
    }
  }

  // The vector: left profile in [0,dim), right profile in [dim,2*dim).
  //
  // Each half is normalised to sum 1 BEFORE the halves are concatenated, so a
  // form whose left context is highly skewed and whose right context is flat
  // contributes both facts equally. Without it the more concentrated side
  // dominates the cosine and the other side stops being read at all.
  //
  // Then the concatenation is L2-normalised, so cosine distance is a dot
  // product and frequency drops out entirely — which it must, or the classes
  // would be frequency bands wearing a structural name.
  const vectors = new Map();
  for (const [form, count] of counts) {
    if (count < minCount) continue;
    const l = left.get(form);
    const r = right.get(form);
    const lSum = l ? [...l.values()].reduce((a, b) => a + b, 0) : 0;
    const rSum = r ? [...r.values()].reduce((a, b) => a + b, 0) : 0;
    if (lSum === 0 && rSum === 0) continue; // met only rare neighbours: no consequence read
    const v = new Map();
    if (l) for (const [c, n] of l) v.set(c, n / lSum);
    if (r) for (const [c, n] of r) v.set(dim + c, n / rSum);
    let norm = 0;
    for (const x of v.values()) norm += x * x;
    norm = Math.sqrt(norm);
    if (!(norm > 0)) continue;
    for (const [c, x] of v) v.set(c, x / norm);
    vectors.set(form, v);
  }

  return { vectors, counts, dim: dim * 2, featureCount: featureIndex.size };
};

const cosineTo = (sparse, centroid) => {
  let dot = 0;
  for (const [c, x] of sparse) dot += x * centroid[c];
  return dot; // both sides L2-normalised, so this IS the cosine
};

/**
 * Settle `classes` centroids over the consequence vectors.
 *
 * Seeded k-means++ initialisation, because uniform-random starts on cosine
 * data collapse: the frequent function forms sit close together and several
 * centroids land inside that cluster while whole regions of the space get
 * none. k-means++ spreads the starts by distance, which is a property of the
 * data rather than a constant anyone picked.
 *
 * Assignment is by cosine, and a class that empties is RESEEDED to the point
 * furthest from its centroid rather than dropped. Dropping it would make the
 * declared `classes` a lie — the run would report a resolution it did not
 * actually use.
 */
const settle = (vectors, { classes, dim, iterations, seed }) => {
  const forms = [...vectors.keys()].sort();
  if (forms.length < classes)
    return gap("degenerate_ground", {
      reason: "fewer groupable forms than declared classes — the resolution exceeds the evidence",
      forms: forms.length,
      classes,
    });

  const uniform = rngFrom(seed);
  const centroids = [];
  const pick = (form) => {
    const c = new Float64Array(dim);
    for (const [i, x] of vectors.get(form)) c[i] = x;
    centroids.push(c);
  };
  pick(forms[Math.floor(uniform() * forms.length)]);
  // k-means++: each subsequent start is drawn with probability proportional to
  // its squared distance from the nearest start already chosen.
  while (centroids.length < classes) {
    const d2 = forms.map((f) => {
      const v = vectors.get(f);
      let best = -1;
      for (const c of centroids) best = Math.max(best, cosineTo(v, c));
      const dist = 1 - best;
      return dist * dist;
    });
    const total = d2.reduce((a, b) => a + b, 0);
    if (!(total > 0)) {
      pick(forms[centroids.length % forms.length]);
      continue;
    }
    let acc = 0;
    const threshold = uniform() * total;
    let chosen = forms[forms.length - 1];
    for (let i = 0; i < forms.length; i++) {
      acc += d2[i];
      if (acc >= threshold) {
        chosen = forms[i];
        break;
      }
    }
    pick(chosen);
  }

  let assignment = new Map();
  let meanSimilarity = 0;
  for (let iter = 0; iter < iterations; iter++) {
    assignment = new Map();
    const sums = Array.from({ length: classes }, () => new Float64Array(dim));
    const sizes = new Array(classes).fill(0);
    let simTotal = 0;
    let worst = { form: null, sim: Infinity };

    for (const form of forms) {
      const v = vectors.get(form);
      let bestK = 0;
      let bestSim = -Infinity;
      for (let k = 0; k < classes; k++) {
        const s = cosineTo(v, centroids[k]);
        if (s > bestSim) {
          bestSim = s;
          bestK = k;
        }
      }
      assignment.set(form, bestK);
      simTotal += bestSim;
      if (bestSim < worst.sim) worst = { form, sim: bestSim };
      const acc = sums[bestK];
      for (const [i, x] of v) acc[i] += x;
      sizes[bestK]++;
    }
    meanSimilarity = simTotal / forms.length;

    for (let k = 0; k < classes; k++) {
      if (sizes[k] === 0) {
        // Reseed the empty class at the worst-served point. Declared
        // resolution stays honest.
        const v = vectors.get(worst.form);
        const c = new Float64Array(dim);
        for (const [i, x] of v) c[i] = x;
        centroids[k] = c;
        continue;
      }
      const acc = sums[k];
      let norm = 0;
      for (let i = 0; i < dim; i++) norm += acc[i] * acc[i];
      norm = Math.sqrt(norm);
      if (norm > 0) for (let i = 0; i < dim; i++) acc[i] /= norm;
      centroids[k] = acc;
    }
  }

  return { assignment, meanSimilarity, forms };
};

/**
 * THE GROUND: what each form actually licenses.
 *
 * Successor counts, read once. This is not a feature vector and is not
 * compared to another feature vector — it is the ground's own expectation,
 * and the only thing done with it is to perturb it and see whether the
 * expectation moves. That distinction is the whole of II.8 here: comparing
 * what two surfaces LOOK like is a dot product; asking whether the ground
 * SAYS the same thing after a substitution is a difference against a rebuilt
 * nothing.
 */
const groundOf = (tokens) => {
  const succ = new Map();
  const counts = new Map();
  // What occupies a successor position at all, across the whole material.
  // This is the distribution the null reseeds from — SEED.md's "same spec,
  // same material, fresh seed."
  const occupants = new Map();
  for (let i = 0; i < tokens.length; i++) {
    const f = tokens[i];
    counts.set(f, (counts.get(f) ?? 0) + 1);
    if (i + 1 >= tokens.length) continue;
    let m = succ.get(f);
    if (!m) {
      m = new Map();
      succ.set(f, m);
    }
    const n = tokens[i + 1];
    m.set(n, (m.get(n) ?? 0) + 1);
    occupants.set(n, (occupants.get(n) ?? 0) + 1);
  }
  const forms = [...occupants.keys()].sort();
  const cumulative = new Float64Array(forms.length);
  let running = 0;
  for (let i = 0; i < forms.length; i++) {
    running += occupants.get(forms[i]);
    cumulative[i] = running;
  }
  return { succ, counts, marginal: { forms, cumulative, total: running } };
};

/**
 * How far apart are two grounds? Jensen-Shannon, in nats.
 *
 * Symmetric and always finite, which matters because KL is infinite whenever
 * one form licenses a successor the other never has — which is almost every
 * pair of real forms, and would make every comparison report the same
 * infinity. Bounded above by ln 2, so a divergence is on a scale the null can
 * actually place it against.
 */
const jensenShannon = (a, b) => {
  let aTotal = 0;
  let bTotal = 0;
  for (const v of a.values()) aTotal += v;
  for (const v of b.values()) bTotal += v;
  if (!(aTotal > 0) || !(bTotal > 0)) return null;
  let d = 0;
  const forms = new Set([...a.keys(), ...b.keys()]);
  for (const f of forms) {
    const p = (a.get(f) ?? 0) / aTotal;
    const q = (b.get(f) ?? 0) / bTotal;
    const m = (p + q) / 2;
    if (p > 0) d += 0.5 * p * Math.log(p / m);
    if (q > 0) d += 0.5 * q * Math.log(q / m);
  }
  return d;
};

/**
 * THE VERDICT. Does substituting B where A stood leave the ground unmoved?
 *
 * SEED.md: "two figures are the same iff they make the same difference to the
 * ground." This is that sentence executed rather than approximated. The
 * difference A makes to the ground is what it licenses; the test is whether B
 * makes the SAME difference, and the only way that can be a finding rather
 * than a threshold is against a null.
 *
 * THE NULL IS A RESEEDING, NOT A SUBSTITUTE FORM. This is the second design
 * of it and the first one was wrong in a way worth recording, because it is
 * the same trap SEED.md #3 keeps naming.
 *
 * The first null drew a FREQUENCY-MATCHED STRANGER: another form with about
 * as much evidence as B, on the reasoning that this destroys identity while
 * preserving evidence. On the conformance fixture it confirmed nothing at all
 * — 177 pairs proposed, 0 confirmed — and the reason is that a frequency band
 * is full of TRUE POSITIVES. Every noun has about as many occurrences as
 * every other noun, so the "strangers" drawn as a null for `cat`/`dog` were
 * largely other nouns, which are genuine slot-mates. The null contained the
 * hypothesis, so nothing could ever be closer than all of it.
 *
 * The null used here is SEED.md's own: "the ground's own reseeding variation
 * — same spec, same material, fresh seed." B's successors are redrawn from
 * the successor-position distribution of the whole material, keeping B's
 * EVIDENCE COUNT exactly and destroying WHICH forms it licensed. So the
 * question becomes the right one: are A and B closer than A is to a form that
 * had B's amount of evidence and no positional identity at all? A true
 * slot-mate cannot appear in that null, because the null is not a form.
 *
 * What the perturbation destroys is positional identity; what the statistic
 * reads is positional identity. SEED.md #4 with Amendment I, satisfied by
 * construction rather than by assertion.
 *
 * REPORTED AS A RANK AGAINST `draws`, NEVER AS A SCORE (SEED.md #8). The
 * finest verdict sayable is 1/draws, and a pair whose observed divergence
 * falls below every null draw is CENSORED BELOW rather than assigned a
 * confidence — censored below is a measurement here (Amendment II), and it is
 * the direction that says "these two are more alike than any frequency-matched
 * stranger", which is the finding.
 *
 * Returns `{ same, rank, censored, observed, null_median }`. `same` is true
 * only when the observed divergence beats the null at the declared
 * resolution. There is no threshold anywhere in it.
 */
export const substitutionTest = ({ ground, a, b, draws, seed }) => {
  const { succ, marginal } = ground;
  const sa = succ.get(a);
  const sb = succ.get(b);
  if (!sa || !sb) return gap("degenerate_ground", { reason: "a form with no successors licenses nothing", a, b });

  const observed = jensenShannon(sa, sb);
  if (observed === null) return gap("degenerate_ground", { reason: "empty successor set", a, b });

  // B's evidence count, kept exactly. What is destroyed is which forms it
  // licensed, not how much it was seen.
  let evidence = 0;
  for (const v of sb.values()) evidence += v;
  if (!(evidence > 0)) return gap("degenerate_ground", { reason: "no evidence to reseed", a, b });

  const uniform = rngFrom(seed);
  const { forms, cumulative, total } = marginal;
  const drawForm = () => {
    const u = uniform() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    return forms[lo];
  };

  const nulls = [];
  for (let d = 0; d < draws; d++) {
    const synthetic = new Map();
    for (let i = 0; i < evidence; i++) {
      const f = drawForm();
      synthetic.set(f, (synthetic.get(f) ?? 0) + 1);
    }
    const v = jensenShannon(sa, synthetic);
    if (v !== null) nulls.push(v);
  }
  if (nulls.length === 0) return gap("degenerate_ground", { reason: "the null could not be built", a, b });

  // A null of zero width would clear anything put in front of it (SEED.md #3).
  const lo = Math.min(...nulls);
  const hi = Math.max(...nulls);
  if (!(hi - lo > 0))
    return gap("degenerate_ground", { reason: "the null has zero width and would clear anything", a, b });

  let below = 0;
  for (const v of nulls) if (observed < v) below++;
  const sorted = [...nulls].sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)];

  return Object.freeze({
    a,
    b,
    observed,
    null_median: median,
    null_low: lo,
    null_high: hi,
    // The share of frequency-matched strangers this pair is closer than.
    rank: below / nulls.length,
    draws: nulls.length,
    censored: observed < lo ? "below" : observed > hi ? "above" : null,
    // Same iff closer than EVERY frequency-matched stranger. The strongest
    // claim expressible at this resolution, and it carries no constant: the
    // bar is the null's own support, not a number anyone chose.
    same: observed < lo,
  });
};

/**
 * Induce a slot inventory from a token stream.
 *
 * Returns an abstraction `createLayer` accepts — `{ id, giver, of }` — built
 * through `classAbstraction` rather than beside it, so there is one definition
 * of what a class inventory is and the "a form with no class stands for
 * itself" rule is not written twice.
 *
 * THE GIVER IS THE DERIVATION, STATED AS SUCH. `createLayer` requires an
 * abstraction to name its giver, and the honest answer here is not a witness
 * but a procedure: this inventory came from this material, under these
 * declared numbers. Naming a person or a corpus would be a false provenance;
 * omitting it would let a derived grouping pass as a received one. Neither is
 * acceptable, so the giver says exactly what happened.
 */
export const induceSlots = ({ tokens, classes, features, minCount, iterations, draws, seed, label = "slots" }) => {
  if (!Array.isArray(tokens) || tokens.length === 0) throw new TypeError("slots: a token stream is required");
  for (const [name, v] of [["classes", classes], ["features", features], ["minCount", minCount], ["iterations", iterations], ["draws", draws]])
    if (!Number.isInteger(v) || v < 1)
      throw new TypeError(`slots: ${name} is declared as an integer >= 1, never defaulted — it sets the resolution of the grouping`);
  if (!Number.isInteger(seed)) throw new TypeError("slots: seed is declared — a run is a run (never Math.random)");

  const { vectors, counts, dim, featureCount } = readConsequences(tokens, { features, minCount });
  const settled = settle(vectors, { classes, dim, iterations, seed });
  if (settled.gap) return settled;

  // ── NOMINATION IS DONE. NOTHING IS DECIDED YET. ─────────────────────────
  //
  // `settled.assignment` is the cheap sense organ's output and has exactly
  // the standing II.9 gives one: it says which pairs are WORTH INSPECTING.
  // Every pair it proposes now has to survive a perturbation, and a pair that
  // does not survive is dropped no matter how tight its cosine was.
  const nominated = new Map();
  for (const [form, k] of settled.assignment) {
    if (!nominated.has(k)) nominated.set(k, []);
    nominated.get(k).push(form);
  }

  const ground = groundOf(tokens);
  const map = new Map();
  let proposed = 0;
  let confirmed = 0;
  let refusedByNull = 0;
  let unwitnessable = 0;
  let classIndex = 0;

  for (const [, members] of [...nominated.entries()].sort((x, y) => x[0] - y[0])) {
    const sorted = [...members].sort();
    // Confirmed edges only. A nominated class is not a class; it is a set of
    // hypotheses, and what survives is whatever connected components the
    // confirmed edges leave behind. A class can therefore SPLIT here, and a
    // singleton that survives alone simply stands for itself — which is the
    // honest outcome for a form the ground does not place with anything.
    const parent = new Map(sorted.map((f) => [f, f]));
    const find = (f) => {
      while (parent.get(f) !== f) {
        parent.set(f, parent.get(parent.get(f)));
        f = parent.get(f);
      }
      return f;
    };
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        proposed++;
        const verdict = substitutionTest({ ground, a: sorted[i], b: sorted[j], draws, seed: seed + proposed });
        if (verdict.gap) {
          unwitnessable++;
          continue;
        }
        if (!verdict.same) {
          refusedByNull++;
          continue;
        }
        confirmed++;
        const ra = find(sorted[i]);
        const rb = find(sorted[j]);
        if (ra !== rb) parent.set(ra, rb);
      }
    }
    const components = new Map();
    for (const f of sorted) {
      const r = find(f);
      if (!components.has(r)) components.set(r, []);
      components.get(r).push(f);
    }
    for (const [, comp] of components) {
      // A component of one is a form the ground refused to place with
      // anything. It stands for itself rather than being given a private
      // class, so the abstraction never becomes the identity function in
      // disguise — abstractions.js measured that trap at 0.58-1.60 nats.
      if (comp.length < 2) continue;
      const id = `${label}:${classIndex++}`;
      for (const f of comp) map.set(f, id);
    }
  }

  if (map.size === 0)
    return gap("exceeds_witness", {
      reason: "no nominated pair survived its null — the ground places no two of these forms together",
      proposed,
      refused_by_null: refusedByNull,
    });

  const sizes = new Array(classIndex).fill(0);
  for (const id of map.values()) sizes[Number(id.split(":")[1])]++;

  const abstraction = classAbstraction({
    id: label,
    giver:
      `DERIVED by substitution over this material — pairs NOMINATED by successor/precursor ` +
      `co-occurrence and CONFIRMED only where substituting one for the other moved the ground ` +
      `less than every frequency-matched stranger did, at draws=${draws}. ` +
      `classes=${classes} features=${features} minCount=${minCount} iterations=${iterations} seed=${seed}. ` +
      `Not a lexicon and not a witness: the grouping is a measurement of how forms behave in this ` +
      `ground, and what any class DENOTES is not claimed.`,
    classes: map,
  });

  return Object.freeze({
    ...abstraction,
    of: abstraction.of,
    /** How many forms were groupable at all, versus standing for themselves. */
    report: Object.freeze({
      vocabulary: counts.size,
      grouped: map.size,
      standing_alone: counts.size - map.size,
      nominated_classes: classes,
      classes: classIndex,
      class_sizes: Object.freeze([...sizes]),
      features: featureCount,
      dimensions: dim,
      // The cosine is reported because it was measured, NOT because it
      // decided anything. See the header: it nominates and nothing else.
      nomination_cohesion: settled.meanSimilarity,
      // What the perturbation did to the sense organ's proposals. A high
      // refusal share is the organ working, not failing.
      pairs_proposed: proposed,
      pairs_confirmed: confirmed,
      pairs_refused_by_null: refusedByNull,
      pairs_unwitnessable: unwitnessable,
    }),
    classOf: (form) => map.get(form) ?? null,
    members: (classId) => [...map.entries()].filter(([, c]) => c === classId).map(([f]) => f).sort(),
  });
};

/**
 * Does the induction actually read order, or only vocabulary?
 *
 * SEED.md #4 and Amendment I. The perturbation is the shuffle: it preserves
 * every form's count exactly and destroys every sequential regularity above
 * it. What is required is that the statistic MOVE; which way it moves is a
 * finding about the material, and this one moved opposite to the prediction
 * in the header above — read that note before interpreting the sign.
 *
 * `separation` is `shuffled − real`. Measured at −0.088 on real prose: the
 * real vocabulary contains tight groups of substitutable forms, and the
 * shuffled one contains only sparse near-orthogonal profiles. A separation
 * near ZERO is the vacuity signal — it would mean the grouping survived the
 * destruction of order and was therefore never about order.
 *
 * Returns both arms, and the caller reports them together. This module passes
 * no verdict: the decisive test is downstream — whether a real inventory
 * beats a shuffled one AT THE TASK — and a similarity gap here is only the
 * precondition for that test being worth spending, never a substitute for it.
 */
export const shuffleTokens = (tokens, seed) => {
  const out = [...tokens];
  const uniform = rngFrom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(uniform() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const inductionSensitivity = ({ tokens, classes, features, minCount, iterations, draws, seed }) => {
  const real = induceSlots({ tokens, classes, features, minCount, iterations, draws, seed, label: "slots" });
  const shuffled = induceSlots({
    tokens: shuffleTokens(tokens, seed),
    classes,
    features,
    minCount,
    iterations,
    draws,
    seed,
    label: "shuffled",
  });
  if (real.gap) return real;
  if (shuffled.gap) return shuffled;
  return Object.freeze({
    real,
    shuffled,
    // THE SENSITIVITY THAT MATTERS IS NOW THE VERDICT'S, NOT THE SENSE
    // ORGAN'S. The cosine gap is still reported, but a nomination statistic
    // moving under shuffle establishes nothing about the organ — the sense
    // organ was never the thing deciding. What has to survive the shuffle
    // test is the CONFIRMATION RATE: on real material the ground should place
    // nominated pairs together, and on material whose order has been
    // destroyed it should refuse nearly all of them, because there are no
    // slots left to find.
    real_confirmed: real.report.pairs_confirmed / Math.max(1, real.report.pairs_proposed),
    shuffled_confirmed: shuffled.report.pairs_confirmed / Math.max(1, shuffled.report.pairs_proposed),
    real_grouped: real.report.grouped,
    shuffled_grouped: shuffled.report.grouped,
    real_cohesion: real.report.nomination_cohesion,
    shuffled_cohesion: shuffled.report.nomination_cohesion,
    separation: shuffled.report.nomination_cohesion - real.report.nomination_cohesion,
  });
};

/**
 * THE SLOT EXPECTATION — what kind of thing goes here, and how tightly is it
 * constrained?
 *
 * This is the readout the whole module is for, and it is a different act from
 * the backoff use. Backoff spends a class as extra mass; this asks the ground
 * a question it could not previously answer: not "which word comes next" but
 * "does this position know what KIND of thing it wants."
 *
 * Two entropies over the same distribution, one collapsed to classes:
 *
 *   H_form   uncertainty about WHICH FORM comes next
 *   H_class  uncertainty about WHICH KIND comes next
 *
 * Their difference is the part of the reader's uncertainty that is about
 * choosing within a settled kind. A position with low H_class and high H_form
 * is one where the reader KNOWS WHAT GOES HERE AND NOT WHICH WORD — the
 * cadence whose resolution is certain and whose voicing is not. That state is
 * invisible to a flat next-form distribution, which reports only that it is
 * uncertain, and it is the single most useful thing a generator can be told
 * before it commits.
 *
 * REPORTED IN NATS, NOT AS A SCORE. Both numbers are entropies of a
 * distribution the belief already built, so nothing here is a confidence from
 * nowhere. `constraint` is their difference and is NOT normalised to [0,1] —
 * dividing by H_form would manufacture a ratio whose denominator goes to zero
 * exactly where the reader is most certain, and the resulting number would
 * swing wildly for reasons that have nothing to do with the slot.
 *
 * Omnimodal: nothing in this function mentions a word. It consumes a
 * categorical and a form->class map.
 */
export const slotExpectation = ({ distribution, abstraction, unseenLabel }) => {
  if (!distribution || distribution.kind !== "categorical")
    return gap("unknown_spec", { reason: "a slot expectation needs a categorical distribution" });
  if (!abstraction || typeof abstraction.of !== "function")
    return gap("unknown_spec", { reason: "a slot expectation needs an abstraction" });

  const probs = distribution.probs;
  const byClass = new Map();
  let total = 0;
  let hForm = 0;
  for (const form in probs) {
    if (unseenLabel !== undefined && form === unseenLabel) continue;
    const p = probs[form];
    if (!(p > 0)) continue;
    total += p;
    const cls = abstraction.of(form);
    byClass.set(cls, (byClass.get(cls) ?? 0) + p);
  }
  if (!(total > 0)) return gap("degenerate_ground", { reason: "no mass outside the unseen reserve" });

  for (const form in probs) {
    if (unseenLabel !== undefined && form === unseenLabel) continue;
    const p = probs[form] / total;
    if (p > 0) hForm -= p * Math.log(p);
  }
  let hClass = 0;
  for (const m of byClass.values()) {
    const p = m / total;
    if (p > 0) hClass -= p * Math.log(p);
  }

  const ranked = [...byClass.entries()].sort((a, b) => b[1] - a[1]);
  return Object.freeze({
    kind: "slot-expectation",
    h_form: hForm,
    h_class: hClass,
    // How much of the uncertainty is about choosing WITHIN a kind rather than
    // about which kind. Always >= 0 up to float error: collapsing a
    // distribution can only lower its entropy.
    constraint: hForm - hClass,
    classes_live: byClass.size,
    // The kinds this position wants, in order, with the mass each holds.
    expected: Object.freeze(ranked.slice(0, 8).map(([id, mass]) => Object.freeze({ class: id, mass: mass / total }))),
    distribution: Object.freeze(Object.fromEntries([...byClass].map(([k, v]) => [k, v / total]))),
  });
};

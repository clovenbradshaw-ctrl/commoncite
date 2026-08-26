// eoreader6 · emergence/kinds — KINDS INDUCED, WITH A DISCOVERED HOLONIC HEIGHT.
//
// The "entities" of eoreader5's kind builder are, here, the relation terms a
// reading observed (sister, brother, daughter, wife, husband, sister-in-law,
// in-love-with, friend). Their attributes are structural facts earned from
// the text — a shared parent anchor, a shared subject, a conjunct pairing —
// never a stored taxonomy. The kinds that cohere are the neurons that make
// correlative structure readable at all: "brother" and "sister" join one kind
// only when the material says so, and "friend" stays out for exactly the same
// measurement.
//
// THE WHOLE ORGAN IS ONE OPERATOR CHAIN, in dependency order, and every stage
// is aimed at a target at a holonic height (eoreader6/packages/engine/operators.js):
//
//   SIG  sig()   differentiate attribute signals from the population
//   CON  con()   relate records into candidate kinds (profile Jaccard)
//   EVA  eva()   generate the two Born gates, null against chance
//   DEF  def()   differentiate what survived into a definition
//   INS  ins()   instantiate the kind's members from the material
//   SYN  syn()   synthesize the vocabulary the kinds require
//   REC  —        recognize rules; not applied here — the reading's reframes
//                 are the rule learner (see the clause-reading harness)
//
// HEIGHT IS DISCOVERED, NEVER ASSIGNED (holon-level.md). A kind that earns
// BOTH Born gates has its members below it — the kind cannot dissolve into
// equal random partitions (existence-dependency) and its core constrains
// membership (possibility-constraint). A kind that earns neither sits at its
// members' level: PEER is a first-class result, the null the pair tests fall
// to. These two gates are the attribute-material shape of the same Born pair
// holon_level/index.js runs over time series — same tests, same null
// discipline, nulls shaped to the material. There is no universal clock: a
// kind ticks on its own signal-from-noise, never on a shared epoch.
//
// KINDS ARE READ BY KEY *AND* VALUE (emergence/values.js). This organ began
// key-only: a profile was a binary key vector and similarity was Jaccard over
// key sets. That is exactly right when kind-identity coincides with
// key-identity, which is what Emma's relation terms gave it — `anchor_shared`
// and `subject_shared` are different KEYS. It is blind, totally rather than
// partially, on material whose kinds share a key pool and differ only in
// fillers: identical profiles, an all-1.0 similarity matrix, a cohesion null of
// zero width, `degenerate_ground` at every cluster. That is the omnimodal case
// and not an edge case — a leitmotif shares every key with every other motif,
// and only values differ. `valuedJaccard` generalises the old statistic and
// reduces to it exactly on valueless material, so nothing that was induced
// before is induced differently now.
//
// The core field is chosen by DISCRIMINATION, not prevalence, whenever values
// are being read. Under a shared key pool every field has prevalence 1 in every
// kind, so prevalence cannot tell two kinds apart and would hand all of them the
// same label. The discriminating field is the one whose within-kind agreement
// most exceeds the population's — a difference against a ground, like
// everything else here. Presence-only material keeps the prevalence rule and
// keeps its old labels.
//
// Declared numbers are options, never defaults (SEED.md #7): population,
// minPrevalence, minKindSize, permutations, quantile, seed — and `reseeds`,
// the resolution of pattern (one of SEED.md's three), because CON's own
// search must always be nulled against itself (`searchCohesions` for values,
// `searchKeyCohesions` for keys) — a cluster is chosen by best-first
// agglomeration, never drawn at random, and no single-subset null can see
// that selection on its own. Not a valued-material-only requirement: a small
// disjoint key pool lets the key search null resolve to `degenerate_ground`
// and defer to the single-subset gate, same as before, but that deferral is
// now measured every time, never assumed in advance.

import { gap, isGap } from "../../../nul/index.js";
import { CURRENT_OPERATOR_EPOCH, OPERATORS, validateChain } from "../operators.js";
import {
  fieldScales,
  valuedSimilarity,
  agreement,
  readsValues,
  scaleGaps,
  permuteAllValues,
} from "./values.js";

// The cells this organ occupies on the operator grid (engine/operators.js):
// the chain's vocabulary synthesis, SYN · Network · Composing, and its
// instantiation of members, INS · Kind · Composing — both at Pattern grain,
// where the kind's correlative structure becomes readable. Declared, checked
// by conformance.
export const CELLS = Object.freeze([
  Object.freeze({ op: "SYN", grain: "Pattern" }),
  Object.freeze({ op: "INS", grain: "Pattern" }),
]);

const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const fisherYates = (n, rnd) => {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
};

const randomSubset = (n, k, rnd) => {
  const perm = fisherYates(n, rnd);
  return perm.slice(0, k).sort((a, b) => a - b);
};

/** A Born gate over samples: the observed statistic against a null. Degenerate
 * nulls are gaps. The pass/fail is an empirical p-value — the fraction of null
 * samples that meet or beat the observation — so a small identical block does
 * not saturate a percentile rank into falsely refusing a real kind. */
export const partitionNull = ({ samples, observed, quantile = 0.95, seed = 0 }) => {
  if (!Array.isArray(samples) || samples.length === 0)
    return gap("empty_material", { reason: "no null samples" });
  if (!Number.isFinite(observed)) return gap("empty_material", { reason: "observed must be finite" });
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted[0] === sorted[sorted.length - 1])
    return gap("degenerate_ground", { reason: `all ${samples.length} null samples equal (${sorted[0]})` });
  const n = sorted.length;
  const h = (n - 1) * quantile;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  const threshold = sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
  let atOrAbove = 0;
  for (const s of samples) if (s >= observed) atOrAbove++;
  const pValue = atOrAbove / (n + 1);
  return Object.freeze({
    observed,
    threshold,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    pValue,
    passed: pValue <= 1 - quantile + 1e-9,
  });
};

// ── SIG · differentiate attribute signals from the population ───────────────

const labelShuffleNull = (records, fieldId, permutations, quantile, seed) => {
  const n = records.length;
  const hasField = records.map((r) => (r.attributes ?? []).some((a) => a.field_id === fieldId));
  const observed = hasField.filter(Boolean).length / n;
  const rnd = prng(seed ^ 0x51ab1e);
  const samples = [];
  for (let p = 0; p < permutations; p++) {
    const perm = fisherYates(n, rnd);
    let hits = 0;
    for (let i = 0; i < n; i++) if (hasField[perm[i]]) hits++;
    samples.push(hits / n);
  }
  return partitionNull({ samples, observed, quantile, seed: seed + 1 });
};

export const sig = (records, { minPrevalence, permutations, quantile, seed }) => {
  const total = records.length;
  const byField = new Map();
  for (const rec of records) {
    for (const attr of rec.attributes ?? []) {
      let entry = byField.get(attr.field_id);
      if (!entry) {
        entry = { field_id: attr.field_id, value_type: attr.value_type, ids: new Set(), totalCount: 0 };
        byField.set(attr.field_id, entry);
      }
      entry.ids.add(rec.id);
      entry.totalCount += attr.count ?? 1;
    }
  }
  const params = [];
  for (const entry of byField.values()) {
    const prevalence = entry.ids.size / total;
    if (prevalence < minPrevalence) continue;
    params.push({
      field_id: entry.field_id,
      value_type: entry.value_type,
      prevalence,
      ids: [...entry.ids],
      totalCount: entry.totalCount,
      null: labelShuffleNull(records, entry.field_id, permutations, quantile, seed),
    });
  }
  return params.sort((a, b) => b.prevalence - a.prevalence || b.totalCount - a.totalCount);
};

// ── CON · relate records into candidate kinds ───────────────────────────────

export const parameterProfiles = (records, params) => {
  const keys = params.map((p) => p.field_id);
  const profiles = new Map();
  for (const rec of records) {
    const has = new Set((rec.attributes ?? []).map((a) => a.field_id));
    const vec = keys.map((k) => (has.has(k) ? 1 : 0));
    if (vec.some((v) => v === 1)) profiles.set(rec.id, vec);
  }
  return { profiles, keys };
};

export const profileJaccard = (a, b) => {
  const nz = (v) => v.reduce((s, x) => s + x, 0);
  const A = nz(a);
  const B = nz(b);
  if (A + B === 0) return 0;
  let common = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === 1 && b[i] === 1) common++;
  return common / (A + B - common);
};

const simKey = (i, j) => (i < j ? `${i}\u0000${j}` : `${j}\u0000${i}`);

export const conSimilarity = (profiles) => {
  const ids = [...profiles.keys()];
  const sim = new Map();
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      sim.set(simKey(i, j), profileJaccard(profiles.get(ids[i]), profiles.get(ids[j])));
    }
  }
  return { sim, idxOf: new Map(ids.map((id, i) => [id, i])) };
};

const simBetween = (sim, a, b) => sim.get(simKey(a, b)) ?? 0;

const meanPairwiseSim = (cluster, sim, idxOf) => {
  if (cluster.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      sum += simBetween(sim, idxOf.get(cluster[i]), idxOf.get(cluster[j]));
    }
  }
  return sum / (cluster.length * (cluster.length - 1) / 2);
};

const meanPairwiseSimOf = (indices, sim) => {
  if (indices.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < indices.length; i++) {
    for (let j = i + 1; j < indices.length; j++) sum += simBetween(sim, indices[i], indices[j]);
  }
  return sum / (indices.length * (indices.length - 1) / 2);
};

/** The clustering threshold is DERIVED from the material, never declared: random
 * subsets of the population set the bar the way they are.
 *
 * count < 3 is refused BEFORE the permutation loop runs — not a tuning floor,
 * a structural one (SEED.md #7: "never spend a measurement on what the
 * algebra catches"). At count <= 2, k = Math.max(2, Math.floor(count/2))
 * always equals count, so the "random subset" is the whole population on
 * every draw and every sample is identical by construction — the same
 * zero-width null `partitionNull` itself already refuses as
 * `degenerate_ground` once the loop runs, just refused earlier here to skip
 * wasting `permutations` draws on a result that is certain in advance. */
export const deriveCohesionThreshold = ({ sim, count, permutations, quantile, seed }) => {
  if (count < 3)
    return gap("degenerate_ground", {
      reason: `population of ${count} admits only one possible subset — the null has zero width by construction`,
      count,
    });
  const k = Math.max(2, Math.floor(count / 2));
  const rnd = prng(seed ^ 0xc0ffee);
  const samples = [];
  for (let p = 0; p < permutations; p++) {
    samples.push(meanPairwiseSimOf(randomSubset(count, k, rnd), sim));
  }
  const result = partitionNull({ samples, observed: 0, quantile, seed: seed + 1 });
  return isGap(result) ? result : result.threshold;
};

const meanBetween = (a, b, sim, idxOf) => {
  let sum = 0;
  for (const x of a) {
    for (const y of b) sum += simBetween(sim, idxOf.get(x), idxOf.get(y));
  }
  return a.size * b.size > 0 ? sum / (a.size * b.size) : 0;
};

/** Average-linkage agglomeration: merge the two clusters with the highest
 * inter-cluster mean sim, and stop when even the best merge is below the
 * derived threshold. Block-pure material forms blocks; a dense block cannot
 * dilute a stranger in. */
const conCluster = (profiles, sim, idxOf, threshold, minKindSize) => {
  const ids = [...profiles.keys()];
  let clusters = ids.map((id) => new Set([id]));
  while (clusters.length > 1) {
    let bestI = -1;
    let bestJ = -1;
    let bestSim = -Infinity;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const mean = meanBetween(clusters[i], clusters[j], sim, idxOf);
        if (mean > bestSim) {
          bestSim = mean;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestSim < threshold) break;
    const merged = new Set([...clusters[bestI], ...clusters[bestJ]]);
    clusters = clusters.filter((_, x) => x !== bestI && x !== bestJ);
    clusters.push(merged);
  }
  return clusters.filter((c) => c.size >= minKindSize).map((c) => [...c]);
};

export const con = (profiles, sim, idxOf, { minKindSize, permutations, quantile, seed }) => {
  const threshold = deriveCohesionThreshold({ sim, count: profiles.size, permutations, quantile, seed });
  if (isGap(threshold)) return threshold;
  return { clusters: conCluster(profiles, sim, idxOf, threshold, minKindSize), threshold };
};

// ── EVA · the two Born gates, null against chance ────────────────────────────
//
// Existence-dependency: the kind's cohesion cannot dissolve into equal random
// partitions of the population — it cannot exist without its membership.
// Possibility-constraint: the kind's core attribute constrains membership more
// than a random partition would. Both null-gated; a degenerate null is a gap.

export const eva = (profiles, sim, cluster, idxOf, { permutations, quantile, seed }) => {
  const count = profiles.size;
  const rnd = prng(seed ^ 0x51ab1e);
  const cohesion = meanPairwiseSim(cluster, sim, idxOf);

  const cohesionSamples = [];
  for (let p = 0; p < permutations; p++) {
    const sub = randomSubset(count, cluster.length, rnd);
    cohesionSamples.push(meanPairwiseSimOf(sub, sim));
  }
  const existence = partitionNull({ samples: cohesionSamples, observed: cohesion, quantile, seed: seed + 1 });

  return { cohesion, existence };
};

// ── DEF · differentiate what survived into a definition ─────────────────────

/** Mean pairwise agreement on one field across a set of records. The ground for
 *  a kind's agreement is the whole population's agreement on the same field. */
const meanAgreement = (recs, fieldId, scale) => {
  const vals = recs
    .map((r) => (r.attributes ?? []).find((a) => a.field_id === fieldId))
    .filter((a) => a !== undefined)
    .map((a) => a.value);
  if (vals.length < 2) return null;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < vals.length; i++) {
    for (let j = i + 1; j < vals.length; j++) {
      sum += agreement(vals[i], vals[j], scale);
      n++;
    }
  }
  return n === 0 ? null : sum / n;
};

/** What this kind's core field is CENTRED on — the thing that makes it this
 *  kind and not its neighbour. Testimony, never identity: a kind's identity is
 *  its member set (`id` below), so naming the regime here fabricates nothing. */
const centralValue = (recs, fieldId, scale) => {
  const vals = recs
    .map((r) => (r.attributes ?? []).find((a) => a.field_id === fieldId))
    .filter((a) => a !== undefined && a.value !== undefined)
    .map((a) => a.value);
  if (vals.length === 0) return null;
  if (scale?.value_type === "numeric") {
    const nums = vals.filter(Number.isFinite).sort((a, b) => a - b);
    if (nums.length === 0) return null;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  }
  if (scale?.value_type === "vector") return null; // no scalar name for a centroid
  const counts = new Map();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0];
};

export const def = ({ cluster, cohesion, existence, searched = null, ground = null, sim, records, params, population, minPrevalence, permutations, quantile, seed, scales, valued }) => {
  const members = cluster;
  const memberIds = new Set(members);
  const memberRecords = records.filter((r) => memberIds.has(r.id));
  const kindParams = [];
  for (const p of params) {
    const prevalenceInKind = [...memberIds].filter((id) => p.ids.includes(id)).length / members.length;
    if (prevalenceInKind < minPrevalence) continue;
    kindParams.push({ field_id: p.field_id, value_type: p.value_type, prevalence: prevalenceInKind });
  }

  // Prevalence picks the core only when there are no values to read. Under a
  // shared key pool every admitted field sits at prevalence 1 in every kind, so
  // prevalence is constant and would label every kind identically. What
  // separates them is where their values agree with themselves more than the
  // population agrees with itself.
  let coreField = null;
  if (kindParams.length > 0) {
    if (!valued) {
      coreField = kindParams.reduce((a, b) => (b.prevalence > a.prevalence ? b : a), kindParams[0]);
    } else {
      let best = null;
      for (const p of kindParams) {
        const scale = scales.get(p.field_id);
        const within = meanAgreement(memberRecords, p.field_id, scale);
        const ground = meanAgreement(records, p.field_id, scale);
        if (within === null || ground === null) continue;
        const lift = within - ground;
        if (best === null || lift > best.lift || (lift === best.lift && p.prevalence > best.prevalence)) {
          best = { ...p, within, ground, lift };
        }
      }
      coreField = best ?? kindParams.reduce((a, b) => (b.prevalence > a.prevalence ? b : a), kindParams[0]);
    }
  }

  const coreScale = coreField ? scales?.get(coreField.field_id) : null;
  const coreCentre = coreField && valued ? centralValue(memberRecords, coreField.field_id, coreScale) : null;
  const label = coreField
    ? (coreCentre === null ? coreField.field_id : `${coreField.field_id}=${coreCentre}`)
    : population;

  // POSSIBILITY-CONSTRAINT — does the kind's core constrain membership more
  // than a random partition of the population would?
  //
  // Asked of PRESENCE, this question is vacuous under a shared key pool: every
  // record carries every admitted field, so the observed fraction is 1, every
  // null sample is 1, and `partitionNull` correctly refuses a null of zero
  // width — returning `unstable` for kinds that are in fact sharply
  // constrained. The constraint was never about carrying the key. It is about
  // the core's REGIME: members agree with each other on the core field, and a
  // subset drawn across kinds does not.
  //
  // Presence-only material keeps the presence form exactly, because there is no
  // regime to ask about and the fraction is then genuinely informative.
  const allIds = records.map((r) => r.id);
  const memberIndexes = members.map((id) => allIds.indexOf(id)).sort((a, b) => a - b);
  const coreIsValued = Boolean(coreField && valued && scales?.get(coreField.field_id)?.mode === "value");
  const rnd = prng(seed ^ 0xdeadbeef);
  const constraintSamples = [];
  let observedCore;

  if (coreIsValued) {
    const scale = scales.get(coreField.field_id);
    observedCore = meanAgreement(memberRecords, coreField.field_id, scale) ?? 0;
    for (let p = 0; p < permutations; p++) {
      const sub = randomSubset(records.length, members.length, rnd);
      constraintSamples.push(meanAgreement(sub.map((i) => records[i]), coreField.field_id, scale) ?? 0);
    }
  } else {
    const hasCore = (rec) => (coreField ? (rec.attributes ?? []).some((a) => a.field_id === coreField.field_id) : false);
    observedCore = memberIndexes.filter((i) => hasCore(records[i])).length / members.length;
    for (let p = 0; p < permutations; p++) {
      const sub = randomSubset(records.length, members.length, rnd);
      constraintSamples.push(sub.filter((i) => hasCore(records[i])).length / members.length);
    }
  }
  const constraint = partitionNull({ samples: constraintSamples, observed: observedCore, quantile, seed: seed + 1 });

  const relation = (() => {
    if (isGap(existence) || isGap(constraint)) return "unstable";
    const e = existence.passed;
    const c = constraint.passed;
    if (e && c) return "above";
    if (!e && !c) return "peer";
    return "unstable";
  })();

  const chain = validateChain(["SIG", "CON", "EVA", "DEF", "INS", "SYN"]);
  const stages = [
    { operator: "SIG", target: `population:${population}`, height: 0 },
    { operator: "CON", target: `candidate:${members.join("|")}`, height: null },
    { operator: "EVA", target: `kind:${label}`, height: relation },
    { operator: "DEF", target: `kind:${label}`, height: relation },
    { operator: "INS", target: members.length > 1 ? `members:${members.length}` : members[0], height: relation === "above" ? "below" : relation },
    { operator: "SYN", target: "vocabulary", height: null },
  ];

  return Object.freeze({
    id: `kind:${population}:${[...members].sort().join("|")}`,
    label,
    population,
    members: Object.freeze([...members].sort()),
    core: coreField ? Object.freeze({
      field_id: coreField.field_id,
      value_type: coreField.value_type,
      prevalence: coreField.prevalence,
      // Present only when values were read: what the kind is centred on, and
      // how much more it agrees with itself there than the population does.
      ...(coreCentre === null ? {} : { centre: coreCentre }),
      ...(coreField.lift === undefined ? {} : { agreement: coreField.within, ground_agreement: coreField.ground, lift: coreField.lift }),
    }) : null,
    cohesion,
    height: relation,
    heightGate: Object.freeze({ existence, constraint, relation, ...(searched ? { searched } : {}), ...(ground ? { ground } : {}) }),
    operator_chain: Object.freeze({ ...chain, stages: Object.freeze(stages) }),
  });
};

// ── the search null · what the Born gates cannot see ────────────────────────
//
// MEASURED, AND THE REASON THIS EXISTS. On composed material with FOUR kinds
// collapsed into ONE regime (`goldens/kinds`, valueDivergence 0 — there is
// nothing to find), induction reported three kinds, every one of them `above`,
// both Born gates passing, core lift up to 0.476. That is confabulation, and
// the seed names it as one of the two deaths.
//
// The reason is a selection effect, not a bad statistic. `eva` and `def`
// compare a cluster against RANDOM SUBSETS of the population — but the cluster
// was not random, it was CHOSEN by agglomeration for being the most cohesive
// subset available. "The best subset I could find" beats "a subset drawn at
// random" whether or not there is any structure, so the gates pass on noise.
//
// So the perturbation has to destroy what the statistic actually exploits,
// which is the search. This null RE-RUNS THE WHOLE SEARCH — same spec, same
// material, fresh seed — and asks whether the real search found more cohesion
// than the same search finds in material where what the search exploits is no
// longer bound to the records that earned it. SEED.md's own words for the
// pattern null: "same spec, same material, fresh seed." Two perturbations,
// one for each channel a cluster can rest on:
//
//   searchCohesions      values permuted within their keys, so every key
//                        profile survives exactly — the value channel's null.
//   searchKeyCohesions   a fixed-margin ("curveball") swap of field
//                        membership, so every field's own prevalence AND
//                        every record's own degree survive exactly, but which
//                        fields co-occur WITHIN a record does not — the key
//                        channel's null. Its perturbation, and the measured
//                        reason a naive independent-per-field shuffle was
//                        rejected first, are documented at `curveballSwap`.
//
// SECOND MEASUREMENT (2026-08-05), THE SAME FINDING ON THE OTHER CHANNEL. A
// moderately-sized shared vocabulary (12 admitted fields, not Emma's 2) let a
// population of mutually-independent "peer" records — each drawing its own
// random subset of a common convenience vocabulary, no generative link
// between any two — get agglomerated into confabulated `above` kinds at
// existence p = 0.0000, repeatably, across five seeds and inside a mixed
// population alongside a genuine Kind. The key-only organ was never protected
// by anything but accident: Jaccard over a HANDFUL of keys takes only a few
// distinct values, so cohesion is quantised there and `degenerate_ground`
// refuses — but a dozen admitted keys is not a handful, cohesion is no longer
// quantised, and the same selection effect that motivated `searchCohesions`
// for continuous values goes through uncontested on presence-only material
// too. `searchKeyCohesions` closes it the same way: re-run the whole search
// on material where field membership is real (every field's own prevalence
// and every record's own degree are exactly preserved) but no longer
// correlated within a record, and ask whether the observed cluster beats what
// that same search finds there, at the SAME cluster size. Where the
// vocabulary really is a handful of mutually-exclusive keys, this null is
// itself degenerate and returns `degenerate_ground` — correctly, because
// there is nothing here to distinguish "found by search" from "found by
// chance," and the single-subset existence gate `eva` already runs is the
// whole ground exactly as it always was. Nothing that was induced by a
// small, disjoint key pool is induced differently now; what changes is that a
// rich shared vocabulary can no longer borrow that degeneracy's protection it
// never earned.

const searchCohesions = (records, params, keys, scales, { minKindSize, permutations, quantile, seed, reseeds }) => {
  const samples = [];
  for (let r = 0; r < reseeds; r++) {
    const rnd = prng((seed ^ 0x5ea2c4) + r * 0x9e3779b1);
    const permuted = permuteAllValues(records, keys, rnd);
    const { profiles } = parameterProfiles(permuted, params);
    if (profiles.size < minKindSize) continue;
    const { sim, idxOf } = valuedSimilarity(profiles, permuted, keys, scales);
    const conResult = con(profiles, sim, idxOf, { minKindSize, permutations, quantile, seed: seed + r });
    if (isGap(conResult)) continue; // this reseed's permuted population was too small to cohere against — not a finding, just skipped
    for (const c of conResult.clusters) samples.push(meanPairwiseSim(c, sim, idxOf));
  }
  return samples;
};

/** FIXED-MARGIN SWAP ("curveball") — the key channel's search perturbation.
 *  Independent per-field label shuffle (permute each column separately) was
 *  tried first and rejected by measurement: it preserves each field's own
 *  prevalence but not a record's own DEGREE (how many admitted fields it
 *  carries), so on a small key vocabulary it manufactures brand-new
 *  same-profile blocks that never existed in the real material — every
 *  record's field COUNT was free to drift, and with few keys admitted the
 *  discrete profile space pigeonholes: best-first search then finds a
 *  cohesion-1 clique of SOME size in essentially every reshuffle, real
 *  structure or none, and the search null saturates against itself,
 *  manufacturing rejections of genuine kinds (measured on Emma's `love`
 *  block: rejected at a stable ~15% collision rate across reseed counts from
 *  24 to 1000 — not noise, a structural artefact of the perturbation).
 *
 *  The swap below is the standard null model for co-occurrence structure
 *  (Strona et al. 2014's "curveball" algorithm; Gotelli 2000's fixed-fixed
 *  null): pick two records, swap their DIFFERING fields between them at
 *  random, keep their SHARED fields untouched. This preserves both margins
 *  EXACTLY — every field's prevalence (column sum) and every record's own
 *  degree (row sum) — so it tests exactly the question the header names,
 *  "do fields co-occur within a record more than each field's prevalence and
 *  each record's degree alone would predict," and nothing else. On Emma's
 *  two mutually-exclusive keys every record's degree is fixed at 1 already,
 *  so a swap only ever exchanges which of the two keys a record holds — the
 *  same two blocks re-form at cohesion 1 in EVERY draw, `degenerate_ground`
 *  correctly refuses, and induction defers to the single-subset gate exactly
 *  as before this fix (measured: 300/300 draws at cohesion 1, zero
 *  variance). On a richer vocabulary the swap has real room to move and the
 *  null carries real information (measured: a twelve-key population's
 *  swapped search settles to a broad, non-degenerate spread, mean cohesion
 *  0.28–0.39 across cluster sizes, clearly separating a genuine exclusive
 *  four-field core at cohesion 1 from coincidental convenience-field
 *  overlap). */
const curveballSwap = (rows, ids, rnd) => {
  const n = ids.length;
  if (n < 2) return;
  const iA = Math.floor(rnd() * n);
  let iB = Math.floor(rnd() * (n - 1));
  if (iB >= iA) iB++;
  const rowA = rows.get(ids[iA]);
  const rowB = rows.get(ids[iB]);
  const uniqueA = [...rowA].filter((c) => !rowB.has(c));
  const uniqueB = [...rowB].filter((c) => !rowA.has(c));
  if (uniqueA.length === 0 && uniqueB.length === 0) return;
  const union = [...uniqueA, ...uniqueB];
  const perm = fisherYates(union.length, rnd);
  const shuffledUnion = perm.map((i) => union[i]);
  const newUniqueA = new Set(shuffledUnion.slice(0, uniqueA.length));
  const newUniqueB = new Set(shuffledUnion.slice(uniqueA.length));
  const shared = [...rowA].filter((c) => rowB.has(c));
  rows.set(ids[iA], new Set([...shared, ...newUniqueA]));
  rows.set(ids[iB], new Set([...shared, ...newUniqueB]));
};

const profilesToRowSets = (profiles) => {
  const rows = new Map();
  for (const [id, vec] of profiles.entries()) {
    const s = new Set();
    vec.forEach((v, i) => { if (v === 1) s.add(i); });
    rows.set(id, s);
  }
  return rows;
};

const rowSetsToProfiles = (rows, dim) => {
  const out = new Map();
  for (const [id, s] of rows.entries()) {
    const vec = new Array(dim).fill(0);
    for (const c of s) vec[c] = 1;
    out.set(id, vec);
  }
  return out;
};

/** Swap enough times to mix: five times the number of 1-cells in the profile
 *  matrix is the resolution the curveball paper itself measures as
 *  sufficient for a well-mixed fixed-margin sample; DERIVED from the
 *  material's own density, not a declared threshold — the same standing as
 *  `k` in `deriveCohesionThreshold`. */
export const permuteFieldSwap = (profiles, rnd) => {
  const ids = [...profiles.keys()];
  if (ids.length === 0) return new Map();
  const dim = profiles.get(ids[0]).length;
  const rows = profilesToRowSets(profiles);
  const totalOnes = [...profiles.values()].reduce((s, v) => s + v.reduce((a, b) => a + b, 0), 0);
  const swaps = Math.max(20, 5 * totalOnes);
  for (let s = 0; s < swaps; s++) curveballSwap(rows, ids, rnd);
  return rowSetsToProfiles(rows, dim);
};

/** SIZE-MATCHED: for each reseed, the fixed-margin swap's own threshold-
 *  stopped search (the real `con()`, same as the real induction runs) is
 *  read off ONLY where it happens to produce a cluster of exactly
 *  `targetSize` — the candidate's own member count. Comparing across sizes
 *  would blend distributions with genuinely different typical cohesion (a
 *  measured fact: smaller clusters run more cohesive under this null than
 *  larger ones, since a smaller clique has fewer chances to pick up a
 *  disagreeing field), which is not the candidate's own question. Silently
 *  skips a reseed whose search never produces that size; the honest result
 *  of too few informative reseeds is a short (or empty) sample list, which
 *  `partitionNull` already reads as `empty_material`, never a fabricated
 *  pass or fail. */
/**
 * DOES THIS PERTURBATION MOVE THIS MATERIAL? The runtime companion to
 * `nul/index.js`'s `PRESERVES.fieldSwap`.
 *
 * A fixed-margin swap preserves the row and column margins by construction.
 * What it preserves BEYOND that depends on the material, and there is one case
 * where it preserves everything: if every row sum is 1, the only move available
 * is relabelling which column each row's single 1 occupies, so the multiset of
 * rows comes back identical and every cluster survives at its original
 * cohesion. A null built that way reproduces the observation it is supposed to
 * be a nothing for, and cannot reject anything — the failure II.10 describes as
 * failing invisibly and globally, since the record shows a real ground, a real
 * rank and a real spec throughout.
 *
 * Returns whether ANY reseed changed the multiset of profile rows. Exact
 * equality, so there is no threshold here — the question is whether the
 * perturbation is inert, not how inert it is.
 */
export const perturbationMoves = (profiles, { seed, reseeds }) => {
  const key = (m) => [...m.values()].map((v) => v.join("")).sort().join("|");
  const before = key(profiles);
  for (let r = 0; r < reseeds; r++) {
    const rnd = prng((seed ^ 0x2eed1e) + r * 0x9e3779b1);
    if (key(permuteFieldSwap(profiles, rnd)) !== before) return true;
  }
  return false;
};

export const searchKeyCohesions = (profiles, targetSize, { minKindSize, permutations, quantile, seed, reseeds }) => {
  // An inert perturbation yields a null that reproduces the observation. Report
  // no samples rather than samples that cannot reject, so the caller sees a
  // typed gap (III.3: a missing ground is a typed gap, never a silently wrong
  // number) instead of a resolved-looking null with no power in it.
  if (!perturbationMoves(profiles, { seed, reseeds })) return [];
  const samples = [];
  for (let r = 0; r < reseeds; r++) {
    const rnd = prng((seed ^ 0x2eed1e) + r * 0x9e3779b1);
    const permuted = permuteFieldSwap(profiles, rnd);
    if (permuted.size < minKindSize) continue;
    const { sim, idxOf } = conSimilarity(permuted);
    const conResult = con(permuted, sim, idxOf, { minKindSize, permutations, quantile, seed: seed + r });
    if (isGap(conResult)) continue; // this reseed's swapped population was too small to cohere against — not a finding, just skipped
    // EVERY cluster the same search returned, at whatever size it chose.
    //
    // Until 2026-08-15 this read `if (c.length === targetSize)`, keeping only
    // permuted clusters exactly as large as the observed one. That is not a
    // commensurability requirement and it inverted the organ. SIZE WAS AN
    // OUTPUT OF THE SEARCH, NOT A CONSTRAINT ON IT: `con` returns whatever
    // clusters clear its derived threshold, so the matched counterfactual
    // (II.10, "the null undergoes what the observation underwent") is "a
    // cluster con() returned on permuted material" — every one of them.
    //
    // Filtering on size starved the null to n=3..24 samples, below what the
    // family-wise quantile it is compared at can resolve: at n=6 the smallest
    // achievable p is 1/7 = 0.143 against a required 0.0167, so the gate could
    // not pass — unless the few samples happened to be identical, which
    // returned `degenerate_ground` and skipped the gate entirely. Admission
    // therefore turned on whether the null happened to degenerate rather than
    // on structure: measured on a planted three-block population, the PERFECT
    // size-20 block at cohesion 1.000 was rejected on 24 real samples while
    // weaker size-18 and size-22 clusters were admitted on degenerate ones.
    //
    // Measured on a stage-0-validated fixture (blocks whose members share
    // several fields, where permuteFieldSwap demonstrably destroys 66.5% of
    // planted cohesion), 25 trials each, eo-evidence
    // assays/kinds-induction/fix-power-check.mjs:
    //
    //                    power   false positives   separation
    //     exact-size       100%              68%         32pt
    //     every cluster     96%               8%         88pt
    //
    // Four points of power for an 8.5x reduction in fabrication. The null pool
    // goes from a median of 6 samples to 115.
    for (const c of conResult.clusters) samples.push(meanPairwiseSim(c, sim, idxOf));
  }
  return samples;
};

// ── the organ entry point ────────────────────────────────────────────────────

export const induceKinds = (records, opts = {}) => {
  const {
    population,
    minPrevalence,
    minKindSize,
    permutations,
    quantile,
    seed,
    reseeds,
  } = opts;
  if (typeof population !== "string" || population.length === 0)
    throw new TypeError("induceKinds: population is declared, never defaulted");
  for (const [name, v] of [["minPrevalence", minPrevalence], ["minKindSize", minKindSize], ["permutations", permutations], ["quantile", quantile], ["seed", seed]]) {
    if (typeof v !== "number" || !Number.isFinite(v)) throw new TypeError(`induceKinds: ${name} is declared, never defaulted (got ${v})`);
  }
  if (!Array.isArray(records) || records.length < minKindSize)
    throw new TypeError(`induceKinds: records must be an array of at least minKindSize (${minKindSize})`);

  const params = sig(records, { minPrevalence, permutations, quantile, seed });
  if (params.length === 0) return [];
  const { profiles, keys } = parameterProfiles(records, params);
  if (profiles.size < minKindSize) return [];

  // The value channel. `valuedSimilarity` is a strict generalisation of
  // `conSimilarity` — on presence-only material the two agree exactly — so it
  // is used unconditionally rather than switched on, and conformance pins the
  // agreement rather than trusting it.
  const scales = fieldScales(records);
  const valued = readsValues(keys, scales);
  const { sim, idxOf } = valuedSimilarity(profiles, records, keys, scales);
  const conResult = con(profiles, sim, idxOf, { minKindSize, permutations, quantile, seed });
  // Same standing as the profiles.size < minKindSize refusal a few lines up:
  // a population too small to admit a non-degenerate cohesion null cannot
  // certify any kind, so the honest result is no kinds — never a silently
  // substituted threshold.
  if (isGap(conResult)) return [];
  const { clusters, threshold } = conResult;

  // EVERY con()-SELECTED CLUSTER MUST BE NULLED AGAINST ITS OWN SEARCH, valued
  // or not (see "the search null" above — `reseeds` is one of SEED.md's three
  // declared numbers, "the resolution of pattern," and is never scoped to one
  // channel). A cluster was not drawn at random; it was CHOSEN by best-first
  // agglomeration for being the most cohesive grouping the search could find,
  // and `eva`'s single-random-subset null cannot see that selection effect on
  // either channel — measured on both (2026-08-05, this file's history above).
  if (!Number.isInteger(reseeds) || reseeds < 2)
    throw new TypeError("induceKinds: a declared `reseeds` (the resolution of pattern) of at least 2 is required — the Born gates alone certify clusters found in noise, whatever the channel");
  // Valued material's search is population-level (key profiles survive the
  // value permutation exactly, so one re-search serves every candidate).
  // Presence-only material's search (`searchKeyCohesions`) is SIZE-MATCHED
  // per candidate (see its doc) and so cannot be hoisted here; it runs once
  // per cluster, inside the loop below.
  const search = valued
    ? searchCohesions(records, params, keys, scales, { minKindSize, permutations, quantile, seed, reseeds })
    : null;

  // PLURAL GROUNDS, AND EACH IS LICENSED FOR ONE PERTURBATION (SEED.md #6,
  // Amendment I). A cluster can rest on key structure, on value structure, or
  // on both, and the two claims have different nulls:
  //
  //   key channel    nulled by the label shuffle — which is what `eva` runs,
  //                  over the key-only similarity (single-subset, as before
  //                  this fix — VALUED material's key-channel fallback is
  //                  unchanged; it exists only to rescue kinds that are
  //                  entirely key-carried, and the vulnerability this fix
  //                  closes was measured and named on the PRESENCE-ONLY path,
  //                  where the key channel is the only channel there is).
  //   value channel  nulled by the re-run search over within-key value
  //                  permutation (`searchCohesions`), which PRESERVES key
  //                  structure exactly and so cannot speak to it at all.
  //
  // MEASURED, and the reason valued material is a branch rather than one gate:
  // on material with DISJOINT key pools the value-permuted search finds the
  // same clusters at the same cohesion — correctly, because the key structure
  // survives that permutation untouched. Gating membership on that null alone
  // discarded kinds that were entirely key-carried, which is the Emma case and
  // the case this organ was built for. The null was not wrong; it was
  // answering "do values add anything here?" and being read as "does this
  // kind exist?" So valued material needs ground from at least ONE of its two
  // channels — key-search when it resolves, value-search as the fallback
  // where a shared key pool leaves key-search structurally unable to move.
  //
  // Presence-only material has exactly one channel, and `searchKeyCohesions`
  // is its search null outright, not a branch: where the vocabulary is a
  // handful of keys the null is itself quantised (`degenerate_ground`, no
  // information, `eva`'s single-subset existence gate — already required
  // above — is the whole ground, exactly as before this fix); where the
  // vocabulary is rich enough that the null actually resolves, it must be
  // beaten, not merely reported.
  const keySim = valued ? conSimilarity(profiles) : null;

  const kinds = [];
  for (const cluster of clusters) {
    const { cohesion, existence } = eva(profiles, sim, cluster, idxOf, { permutations, quantile, seed });
    if (isGap(existence)) continue;
    if (!existence.passed) continue;

    let searched;
    let ground = "key";
    if (valued) {
      searched = partitionNull({ samples: search, observed: cohesion, quantile, seed: seed + 2 });
      const keyGate = eva(profiles, keySim.sim, cluster, keySim.idxOf, { permutations, quantile, seed });
      const keySupported = !isGap(keyGate.existence) && keyGate.existence.passed;
      const valueSupported = !isGap(searched) && searched.passed;
      if (!keySupported && !valueSupported) continue;
      ground = keySupported && valueSupported ? "both" : keySupported ? "key" : "value";
    } else {
      const keySearch = searchKeyCohesions(profiles, cluster.length, { minKindSize, permutations, quantile, seed, reseeds });
      // Where the perturbation is inert on this material, the search null has
      // no power and the kind rests on `eva` alone — which has never rejected
      // anything in measurement, because it nulls a best-first-SELECTED cluster
      // against RANDOM subsets. That is a real weakening of the ground and it
      // is carried on the kind rather than left implicit, so a reader can tell
      // a kind the search null cleared from one it never spoke to.
      if (keySearch.length === 0) ground = "eva-only";
      // FAMILY-WISE CORRECTION ACROSS THE SIMULTANEOUS CANDIDATES. `con` hands
      // back `clusters.length` candidates from ONE search over ONE population,
      // each gated here independently — the identical multiple-comparisons
      // concern the search null exists to correct for `con`'s OWN search, one
      // level up: testing several candidates from the same population at one
      // per-candidate alpha lets the single most extreme of them clear the bar
      // by chance alone. Bonferroni is the standard, minimal correction, and
      // `clusters.length` is MEASURED from this very call, never a declared or
      // tuned number — the same status as `k` in `deriveCohesionThreshold`.
      const familyQuantile = 1 - (1 - quantile) / clusters.length;
      searched = partitionNull({ samples: keySearch, observed: cohesion, quantile: familyQuantile, seed: seed + 2 });
      // AN UNRESOLVED SEARCH NULL IS NOT A GROUND. This read
      // `if (!isGap(searched) && !searched.passed) continue`, so a gap ADMITTED
      // — resting the whole verdict on `eva`'s existence gate, on the reasoning
      // that where the vocabulary is a handful of keys the search null is
      // quantised and eva is the remaining ground.
      //
      // That reasoning requires eva to be a gate. It is not: eva nulls a
      // cluster that best-first agglomeration CHOSE for being the most cohesive
      // grouping available against subsets drawn AT RANDOM, which is exactly
      // the selection effect II.10 refuses ("selection is an axis; a cluster
      // chosen for being extreme is not placed against subsets drawn at
      // random"). Measured, it returns p=0.0000 passed=true for every cluster
      // on planted structure and on structureless noise alike — it has never
      // rejected anything. Admitting on a gap therefore admitted on nothing.
      //
      // With the size filter removed above, a degenerate search null is rare
      // rather than routine, so this refuses the residual case instead of
      // rubber-stamping it. Fixing eva's own commensurability is the larger
      // repair and is not attempted here.
      // A GAP STILL ADMITS HERE, AND THAT IS DELIBERATE — but it is now the
      // rare residual case rather than the routine one.
      //
      // Refusing on a gap was tried on 2026-08-15 and reverted: it takes the
      // Emma fixture from 2 kinds to 0 and fails conformance/kinds.test.js
      // outright. Emma carries three fields and near-one-hot profiles, so its
      // search null legitimately degenerates, and the fallback to `eva` is
      // load-bearing on exactly the sparse material this organ was built for.
      //
      // The honest caveat, recorded rather than smoothed: `eva` is a weak
      // fallback. It nulls a cluster that best-first agglomeration CHOSE for
      // being the most cohesive grouping available against subsets drawn AT
      // RANDOM — the selection effect II.10 refuses ("selection is an axis") —
      // and measured, it returns p=0.0000 passed=true for every cluster on
      // planted structure and on structureless noise alike. So where this gap
      // fires, the kind rests on a gate that has never rejected anything.
      //
      // Two things make that tolerable rather than fatal. Removing the size
      // filter above turns a degenerate search null from the common case into
      // an uncommon one (median pool 6 samples -> 115). And the material where
      // it still degenerates is precisely the material where `permuteFieldSwap`
      // — a curveball, fixed-margin swap — cannot destroy the structure being
      // tested: with near-one-hot profiles every row sum is 1, so a
      // margin-preserving swap only relabels which column each row's single 1
      // occupies and the permuted matrix carries the same blocks. That is a
      // PERTURBATION problem, not a sampling one, and the real repair is to
      // route this organ's NUL through nul/index.js's PERTURBATIONS/LICENSED
      // rather than holding a private one here.
      if (!isGap(searched) && !searched.passed) continue;
    }

    kinds.push(def({ cluster, cohesion, existence, searched, ground, sim, records, params, population, minPrevalence, permutations, quantile, seed, scales, valued }));
  }
  return kinds.sort((a, b) => b.cohesion - a.cohesion);
};

/** The induction's own account of how it read the material: which fields
 *  contributed values, which fell back to presence, and why. A gap is a result
 *  (SEED.md #8) — a field whose values could not be read is reportable, not
 *  silently dropped. */
export const inductionReading = (records, opts = {}) => {
  const { minPrevalence, permutations, quantile, seed } = opts;
  const params = sig(records, { minPrevalence, permutations, quantile, seed });
  const { keys } = parameterProfiles(records, params);
  const scales = fieldScales(records);
  return Object.freeze({
    keys: Object.freeze([...keys]),
    valued: readsValues(keys, scales),
    fields: Object.freeze(keys.map((k) => {
      const s = scales.get(k);
      return Object.freeze({ field_id: k, value_type: s?.value_type ?? null, mode: s?.mode ?? "presence", scale: s?.scale ?? null });
    })),
    gaps: Object.freeze(scaleGaps(scales)),
  });
};

// ── SYN · synthesize the vocabulary the kinds require ────────────────────────

export const buildVocabulary = (kinds, { population, requiredQuantile = 0.5 } = {}) => {
  if (!Array.isArray(kinds) || kinds.length === 0)
    throw new TypeError("buildVocabulary: kinds must be a non-empty array");
  const all = kinds.flatMap((k) => k.members.map((m) => ({ kind: k.label, member: m })));
  return Object.freeze({
    population,
    kinds: kinds.map((k) => k.label),
    members: Object.freeze(all),
  });
};

// ── pair height: correlatives are peers ──────────────────────────────────────
//
// The pair tests carry no shuffle null by design: with two holons the null IS
// peerhood. A term whose attribute set equals another's has no level between
// them (sister / brother); a strict superset constrains (sister-in-law above
// its sister part, composition); no overlap is the peer null (friend).

export const pairHeight = (a, b, { population } = {}) => {
  const aSet = new Set((a.attributes ?? []).map((x) => x.field_id));
  const bSet = new Set((b.attributes ?? []).map((x) => x.field_id));
  if (aSet.size === 0 || bSet.size === 0)
    return { relation: "peer", heightGate: { reason: "an empty attribute set is no evidence of structure — peer is the null result" } };
  const aSup = aSet.size > bSet.size && [...bSet].every((f) => aSet.has(f));
  const bSup = bSet.size > aSet.size && [...aSet].every((f) => bSet.has(f));
  if (aSup) return { relation: "above", heightGate: { reason: "a strictly contains b — a constrains, b enables" } };
  if (bSup) return { relation: "below", heightGate: { reason: "b strictly contains a — b constrains, a enables" } };
  return { relation: "peer", heightGate: { reason: "equal or no overlap — peer is the null result" } };
};

export const operator_epoch = CURRENT_OPERATOR_EPOCH;
export { OPERATORS };

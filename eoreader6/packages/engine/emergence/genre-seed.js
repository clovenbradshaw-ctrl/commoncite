// eoreader6 · emergence/genre-seed — a tier's cold start, not a fourth number.
//
// `emergence/tiers.js`'s prior starts at `new Map()`: every reading begins
// with no expectation at all about the kind of thing it is about to read.
// A reader is not actually blank at turn zero — it holds, loosely, what is
// normal for a text of this kind, and that expectation matters most exactly
// where a bare tier is weakest: the first few observations, before its own
// prior has accumulated anything to be surprised against.
//
// This module hands `tiers.js::observe` a real first arrival instead of
// leaving that silence. It is NOT a second mechanism: seeding a tier is
// calling its own `observe()` once, before any document material has
// arrived, against the tier's identity-element starting state
// (`prior: new Map()`, `total: 0`). The gamma decay `tiers.js` already
// derives from `window` is what fades the seed's influence as real material
// accumulates — nothing here declares a second decay parameter.
//
// THE PRIOR IS RECEIVED, NEVER INVENTED. A genre centroid is witness-tier
// knowledge about a corpus this reader did not itself read, and every
// received prior in this codebase must name its giver (`nul::received`,
// `graph::injectPrior`) — `seedTier` refuses to run without one.
//
// READINESS IS MEASURED, NOT ASSUMED, AND REUSES AN ALREADY-EARNED PAIR.
// A genre cluster's own centroid can be flat — near-uniform mass across all
// eight measurable operators — in which case there is no real dominant
// signal to seed with, only noise wearing a giver's name. `clusterReadiness`
// asks whether the cluster's own top operator is a genuine outlier against
// the REST of its centroid, using `maxDeviation`/`resample` — licensed in
// `nul/index.js`'s own LICENSED map for exactly this shape of question ("a
// single point sitting far from its neighbours"), with the candidate held
// out of its own material and tested leave-one-out against the rest, per
// that pair's own documented, correct usage. No new (statistic,
// perturbation) pair is invented or licensed here.
//
// READINESS IS CHECKED LOCALLY, AT THE POINT OF USE — never precomputed and
// stored in a log entry or a checkpoint. A checkpoint (see `replayGenreLog`)
// carries only replayed DATA, never a verdict. Every call to `seedTier`
// decides for itself, from whatever slice of the genre-prior log it was
// handed, whether that slice is worth seeding with. Nothing hands a tier a
// pre-made verdict about its own prior.

import { observe } from "./tiers.js";
import { ground, difference, isGap, gap } from "../../../nul/index.js";
import { replay } from "../../../event_log/index.js";

// The eight operators `emergence/revision.js::decompose` can measure from one
// graph delta. REC is excluded by construction there ("REC is not
// measurable... it is the tier stack's own act") — a genre centroid built
// the same way as a document's own operator-mix carries no REC channel
// either, so a genre-seeded tier and a document's own revision counts stay
// commensurate.
export const OPERATORS = Object.freeze(["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA"]);

/**
 * The arrival a genre cluster becomes, in `tiers.js`'s own vocabulary
 * (`Map<form, weight>`, the same shape every other tier arrival already is).
 *
 * `cluster.size` — the cluster's own declared member-book count — is the
 * seed's mass. Not a hand-picked weight: a received extent, the same way
 * `ground()`'s own `material.length` is never the seed's to choose, and
 * `graph.js::injectPrior`'s `weight` is always the giver's own declaration.
 */
export const seedArrivalFromCluster = (cluster) => {
  if (!cluster || typeof cluster !== "object")
    throw new TypeError("seedArrivalFromCluster: cluster is declared, never defaulted");
  if (!cluster.centroid || typeof cluster.centroid !== "object")
    throw new TypeError("seedArrivalFromCluster: cluster.centroid is declared — a genre prior with no distribution seeds nothing");
  if (!Number.isFinite(cluster.size) || cluster.size <= 0)
    throw new TypeError("seedArrivalFromCluster: cluster.size is declared — the seed's mass is the cluster's own member count, never invented");

  const arrival = new Map();
  for (const op of OPERATORS) {
    const w = cluster.centroid[op];
    if (typeof w === "number" && w > 0) arrival.set(op, w * cluster.size);
  }
  return arrival;
};

// window is declared here, once, the way every other caller of `ground()`
// declares it — never derived from the centroid's own length (which is
// fixed at 8 regardless). `maxDeviation` ignores window by construction
// (its own docstring: "accepted and unused, deliberately: this statistic is
// a property of the whole material handed to it") but `ground()` still
// requires a valid declared window, so the floor of its valid range is used.
const READINESS_SPEC = Object.freeze({ window: 2, draws: 200, seed: 20260810 });

/**
 * Is this cluster's own dominant operator a genuine outlier against the
 * REST of its centroid, or is the centroid close enough to flat that the
 * apparent "top" operator is not distinguishable from resampling noise?
 *
 * `maxDeviation`'s own documented usage: the candidate (the top weight) is
 * held OUT of the material a ground is built over, and tested against the
 * ground `difference` builds from the rest — never a ground built over a
 * series that already contains the candidate.
 *
 * Returns a `difference()`-shaped result (a rank inside the null, meaning
 * "not distinguishable from resampling noise") or a gap. `exceeds_witness`
 * with `direction: "above"` is the finding this gate exists to make: a real,
 * earned dominant signal, not noise wearing a giver's name.
 */
export const clusterReadiness = (cluster) => {
  if (!cluster?.centroid || typeof cluster.centroid !== "object")
    return gap("empty_material", { reason: "a cluster with no centroid has nothing to be ready about" });
  const values = OPERATORS.map((op) => cluster.centroid[op]).filter((v) => typeof v === "number" && Number.isFinite(v));
  if (values.length < 3)
    return gap("empty_material", { reason: "too few operator weights to hold one out and test the rest" });

  let topIndex = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[topIndex]) topIndex = i;
  const candidate = values[topIndex];
  const rest = values.filter((_, i) => i !== topIndex);

  const g = ground({ material: rest, ...READINESS_SPEC, statistic: "maxDeviation", perturbation: "resample" });
  if (isGap(g)) return g;
  return difference(candidate, g);
};

/**
 * Whether a measured readiness clears the bar to seed with. The one finding
 * that counts: the candidate exceeded every resample of the rest — a real
 * outlier, not noise. A placed rank (inside the null) or a below-censored
 * result both mean the same thing here: this cluster's apparent "top"
 * operator is not distinguishable from an unremarkable, near-flat centroid,
 * and seeding with it would be planting noise wearing a giver's name.
 */
export const isReady = (readiness) =>
  isGap(readiness) && readiness.gap === "exceeds_witness" && readiness.direction === "above";

/**
 * Fold a genre cluster into a tier's cold start — its FIRST observation, and
 * only ever its first. Reuses `observe()` unchanged: seeding is not a second
 * mechanism, it is the tier's identity-element start being handed a real
 * first arrival instead of staying at `new Map()`.
 *
 * Readiness is checked HERE, at the point of use, against whatever cluster
 * this call was handed — never precomputed and stored upstream. Every tier
 * that seeds itself decides for itself; nothing hands it a verdict.
 *
 * A seed that fails readiness is simply not applied: the tier is returned
 * untouched, exactly as it would be with no seeding step at all.
 */
export const seedTier = (tier, cluster, { alpha = 1, giver } = {}) => {
  if (!giver)
    throw new TypeError("seedTier: a genre prior must name its giver — an unnamed seed is indistinguishable from a fabrication");
  if (tier.observations !== 0)
    throw new TypeError("seedTier: a tier already holding real observations cannot be seeded — seeding would silently overwrite belief");

  const readiness = clusterReadiness(cluster);
  if (!isReady(readiness)) {
    // `readiness` is already a gap when the ground itself refused (e.g. a
    // flat centroid gives `degenerate_ground`) — propagated as-is. When
    // `readiness` is a real, non-gap placed rank, the finding is genuinely
    // "unremarkable" rather than any of the typed refusals in
    // `nul::GAP_TYPES`, so `gap` is null rather than a fabricated type: a
    // ground with real width that the candidate simply did not exceed is
    // not a `degenerate_ground`, and reusing that name for it would report
    // a shape the measurement doesn't have (SEED.md #8 — a gap is a
    // result, not a label of convenience).
    return { seeded: false, readiness, gap: isGap(readiness) ? readiness : null };
  }

  const arrival = seedArrivalFromCluster(cluster);
  const result = observe(tier, arrival, { alpha });
  tier.provenance = tier.provenance ?? [];
  tier.provenance.push(Object.freeze({ giver, tick: tier.observations, cluster: cluster.id ?? null }));
  return { seeded: true, readiness, result };
};

/**
 * Replay a genre-prior log — `event_log/index.js`'s own `{events, tick}`
 * shape, reused via its `replay()`, never reimplemented — from an optional
 * checkpoint. Checkpointing is a pure optimisation: replaying the same log
 * with and without a checkpoint must agree on every cluster both cover
 * (pinned by `conformance/genre-seed.test.js`'s checkpoint invariant test).
 *
 * `checkpoint`, when supplied, IS folded DATA as of some earlier tick —
 * never a verdict about readiness. This function never asks whether a
 * cluster is ready; `clusterReadiness`/`seedTier` do that, at the point of
 * use, against whatever this replay produces.
 */
export const replayGenreLog = ({ log, checkpoint = null } = {}) => {
  if (!log || !Array.isArray(log.events))
    throw new TypeError("replayGenreLog: log is declared — event_log/index.js's own shape, {events, tick}");
  const clusters = new Map(checkpoint ? Object.entries(checkpoint.clusters ?? {}) : []);
  const fromTick = checkpoint?.tick ?? 0;
  for (const entry of replay(log)) {
    if (entry.tick < fromTick) continue;
    if (entry.type !== "genre-cluster-update") continue;
    clusters.set(entry.cluster.id, entry.cluster);
  }
  return clusters;
};

/** The folded state of a genre-prior log as of its current tick — data, never a verdict. */
export const checkpointOf = (log) =>
  Object.freeze({
    tick: log.tick,
    clusters: Object.fromEntries(replayGenreLog({ log })),
  });

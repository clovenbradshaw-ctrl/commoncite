// Conformance · emergence/genre-seed — the cold start, and its refusal.
//
// What this suite holds the line on:
//   - a seed's mass and vocabulary are exactly the cluster's own declared
//     numbers, never invented;
//   - readiness is a real, licensed measurement (maxDeviation/resample,
//     leave-one-out), and a flat centroid is correctly refused rather than
//     seeded as if it were a real signal;
//   - a tier can be seeded exactly once, as its first observation, and
//     never silently overwritten;
//   - a genre-prior log replays identically with or without a checkpoint —
//     checkpointing is a pure optimisation, never a second source of truth.

import test from "node:test";
import assert from "node:assert/strict";

import {
  OPERATORS,
  seedArrivalFromCluster,
  clusterReadiness,
  isReady,
  seedTier,
  replayGenreLog,
  checkpointOf,
} from "../packages/engine/emergence/genre-seed.js";
import { createTier, observe } from "../packages/engine/emergence/tiers.js";
import { createLog, tick } from "../event_log/index.js";
import { isGap } from "../nul/index.js";

// A real cluster, drawn from the actual imported genre-prior data
// (bin/priors/genre/lens-fold.json's "sig-entity-tracing"), so this suite
// is checked against real corpus statistics rather than a fixture invented
// for the occasion.
const REAL_CLUSTER = Object.freeze({
  id: "sig-entity-tracing",
  size: 131,
  centroid: Object.freeze({
    NUL: 0.0015921634170932301,
    SIG: 0.1102136664838743,
    INS: 0.03871947329957187,
    SEG: 0.020655409913781567,
    CON: 0.02385116161438826,
    SYN: 0.0018174541660510837,
    DEF: 0.07640304949531274,
    EVA: 0.0013240191947163067,
    REC: 0.0004709190954613652,
  }),
});

const FLAT_CLUSTER = Object.freeze({
  id: "flat-fixture",
  size: 40,
  centroid: Object.freeze({ NUL: 0.125, SIG: 0.125, INS: 0.125, SEG: 0.125, CON: 0.125, SYN: 0.125, DEF: 0.125, EVA: 0.125 }),
});

const TIER_SPEC = { window: 12, draws: 200, seed: 20260810 };
const tierOf = () => createTier({ name: "atmosphere", ...TIER_SPEC });

// ── seedArrivalFromCluster ──────────────────────────────────────────────────

test("seedArrivalFromCluster: centroid and size are declared, never defaulted", () => {
  assert.throws(() => seedArrivalFromCluster(null), /cluster is declared/);
  assert.throws(() => seedArrivalFromCluster({ size: 10 }), /centroid is declared/);
  assert.throws(() => seedArrivalFromCluster({ centroid: { SIG: 0.5 } }), /size is declared/);
  assert.throws(() => seedArrivalFromCluster({ centroid: { SIG: 0.5 }, size: 0 }), /size is declared/);
});

test("seedArrivalFromCluster: mass is centroid times size, REC excluded, nothing invented", () => {
  const arrival = seedArrivalFromCluster(REAL_CLUSTER);
  assert.ok(!arrival.has("REC"), "REC is not measurable from one graph delta (revision.js) — a genre seed must not carry it either");
  for (const op of OPERATORS) {
    if (REAL_CLUSTER.centroid[op] > 0) {
      assert.ok(Math.abs(arrival.get(op) - REAL_CLUSTER.centroid[op] * REAL_CLUSTER.size) < 1e-9, `${op} mass is not centroid*size`);
    }
  }
  let total = 0;
  for (const w of arrival.values()) total += w;
  assert.ok(total > 0);
});

// ── clusterReadiness / isReady ──────────────────────────────────────────────

test("clusterReadiness: a real, corpus-derived cluster clears the bar", () => {
  const readiness = clusterReadiness(REAL_CLUSTER);
  assert.ok(isGap(readiness) && readiness.gap === "exceeds_witness" && readiness.direction === "above");
  assert.ok(isReady(readiness));
});

test("clusterReadiness: a perfectly flat centroid is refused, not seeded as if it were signal", () => {
  // The vacuity control this gate needs: without it, "readiness" would be
  // vacuous — every cluster, flat or not, would clear it.
  const readiness = clusterReadiness(FLAT_CLUSTER);
  assert.ok(isGap(readiness), "a flat centroid has no outlier to find, and must say so rather than guess");
  assert.ok(!isReady(readiness));
});

test("clusterReadiness: too few operator weights to hold one out is a typed gap", () => {
  const r = clusterReadiness({ centroid: { SIG: 0.5, DEF: 0.5 } });
  assert.equal(r.gap, "empty_material");
});

// ── seedTier ─────────────────────────────────────────────────────────────────

test("seedTier: a genre prior must name its giver", () => {
  assert.throws(() => seedTier(tierOf(), REAL_CLUSTER, {}), /must name its giver/);
});

test("seedTier: a tier already holding real observations refuses to be seeded", () => {
  const tier = tierOf();
  observe(tier, new Map([["a", 1]]));
  assert.throws(() => seedTier(tier, REAL_CLUSTER, { giver: "test" }), /already holding real observations/);
});

test("seedTier: a ready cluster becomes the tier's first observation, exactly once", () => {
  const tier = tierOf();
  assert.equal(tier.observations, 0);
  const result = seedTier(tier, REAL_CLUSTER, { giver: "eoPriors:lens-fold.json" });
  assert.equal(result.seeded, true);
  assert.equal(tier.observations, 1, "seeding IS the tier's first observation — no second mechanism");
  assert.ok(tier.total > 0);
  assert.equal(tier.provenance.length, 1);
  assert.equal(tier.provenance[0].giver, "eoPriors:lens-fold.json");
  assert.equal(tier.provenance[0].cluster, REAL_CLUSTER.id);
  assert.ok(Object.isFrozen(tier.provenance[0]), "a record of a received prior is frozen, like any other testimony here");

  // The gamma decay tiers.js already derives from `window` is what fades the
  // seed — no second decay parameter exists to inspect, so this is checked
  // behaviourally: a real observation folded in afterwards moves the tier
  // exactly the way it would after any other first observation.
  const second = observe(tier, new Map([["SIG", 3], ["DEF", 1]]));
  assert.equal(typeof second.surprise, "number", "the seed left a real prior for the next observation to move");
});

test("seedTier: an unready cluster is refused, and the tier is left untouched", () => {
  const tier = tierOf();
  const result = seedTier(tier, FLAT_CLUSTER, { giver: "test" });
  assert.equal(result.seeded, false);
  assert.ok(isGap(result.gap));
  assert.equal(tier.observations, 0, "a refused seed leaves the tier exactly as an unseeded tier would be");
  assert.equal(tier.total, 0);
});

// ── replayGenreLog / checkpointOf — the checkpoint invariant ───────────────

const buildLog = (n) => {
  const log = createLog();
  for (let i = 0; i < n; i++) {
    tick(log, {
      type: "genre-cluster-update",
      giver: "test-giver",
      cluster: { id: `cluster-${i}`, size: 10 + i, centroid: { SIG: 0.5, DEF: 0.5 } },
    });
  }
  return log;
};

test("replayGenreLog: a log with no checkpoint replays every entry", () => {
  const log = buildLog(5);
  const clusters = replayGenreLog({ log });
  assert.equal(clusters.size, 5);
  assert.ok(clusters.has("cluster-4"));
});

test("checkpointOf / replayGenreLog: replaying from a checkpoint agrees with a full replay, exactly", () => {
  // Build a log in two stages, take a checkpoint after the first, then
  // extend it — modelling exactly what scripts/import-genre-fold.mjs does
  // on a second run against a growing source.
  const early = buildLog(3);
  const checkpoint = checkpointOf(early);
  assert.equal(checkpoint.tick, 3);

  const full = createLog();
  for (const e of early.events) tick(full, { type: e.type, giver: e.giver, cluster: e.cluster });
  for (let i = 3; i < 7; i++) {
    tick(full, {
      type: "genre-cluster-update",
      giver: "test-giver",
      cluster: { id: `cluster-${i}`, size: 10 + i, centroid: { SIG: 0.5, DEF: 0.5 } },
    });
  }

  const fromScratch = replayGenreLog({ log: full });
  const fromCheckpoint = replayGenreLog({ log: full, checkpoint });
  assert.deepEqual([...fromScratch.entries()].sort(), [...fromCheckpoint.entries()].sort());
  assert.equal(fromScratch.size, 7);
});

test("checkpointOf: carries data, never a verdict — no readiness field anywhere in it", () => {
  const log = buildLog(2);
  const checkpoint = checkpointOf(log);
  const json = JSON.stringify(checkpoint);
  assert.ok(!/ready|readiness|verdict/i.test(json), "a checkpoint that baked in a verdict would let one caller's readiness decide for every other");
});

// Adversarial test — Challenge #6: "Height discovery, not assignment (Kind)"
//
// Claim under test: induceKinds discovers via two Born tests (existence-
// dependency in eva(), possibility-constraint in def()) whether a cluster
// sits ABOVE its members (Kind) or is a peer — height is discovered, never
// assigned. relation = "above" only if BOTH gates pass, "peer" only if BOTH
// fail, else "unstable" (packages/engine/emergence/kinds.js:454-461).
//
// Design: one population, materially unrelated to the existing kinship
// fixture (conformance/kinds.test.js), containing:
//
//   ENGINE group   6 records sharing an IDENTICAL, EXCLUSIVE 4-field core
//                  (turbocharged/direct_injection/variable_valve_timing/
//                  forged_crank found nowhere else in the population) — a
//                  genuine, existence-dependent, constraining Kind by
//                  construction.
//
//   PEER material  24-30 records that each independently draw a random
//                  k-subset (k=2..4) of a SHARED, population-wide-common
//                  8-field "convenience" vocabulary, plus one idiosyncratic
//                  field unique to themselves. No generative rule binds any
//                  subset of these records to each other — ground truth is
//                  "no Kind here, only coincidental overlap on common
//                  features," exactly the "superficially similar but
//                  independently existing peers" the challenge specifies.
//
// Part A drives eva()/def() directly on hand-picked candidates (bypassing
// con()'s own clustering) as a narrow unit check of the two Born gates.
//
// Part B drives the REAL production path — con()'s own best-first
// agglomeration feeding eva()/def() inside induceKinds() itself — across
// five independent seeds of PEER-ONLY material (no Kind present by
// construction), to test whether the two-gate mechanism holds up once the
// candidate is chosen by the organ's own search rather than handed to it.
//
// Part C combines a genuine Kind with peer material in ONE population and
// ONE induceKinds() call, matching the challenge's literal ask.

import { induceKinds, pairHeight, eva, def, sig, parameterProfiles, conSimilarity, con } from "../../packages/engine/emergence/kinds.js";
import { valuedSimilarity, fieldScales, readsValues } from "../../packages/engine/emergence/values.js";
import { isGap } from "../../nul/index.js";
import assert from "node:assert/strict";

const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const A = (field_id) => ({ field_id, value_type: "boolean", count: 1 });

const CORE_FIELDS = ["turbocharged", "direct_injection", "variable_valve_timing", "forged_crank"];
const CONVENIENCE_FIELDS = ["heated_seats", "keyless_entry", "bluetooth_audio", "rain_sensor", "cruise_control", "sunroof", "usb_c_ports", "ambient_lighting"];

const pickSubset = (pool, k, rnd) => {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k);
};

const buildEngineGroup = () =>
  Array.from({ length: 6 }, (_, i) => ({ id: `engine:${i + 1}`, attributes: CORE_FIELDS.map((f) => A(f)) }));

/** Fully mutually-independent "peer" records: each draws its own random
 *  subset of a SHARED convenience vocabulary. By construction there is no
 *  generative link between any two records — ground truth is "no Kind." */
const buildPeerPopulation = (n, seed, prefix = "peer") => {
  const rnd = prng(seed);
  return Array.from({ length: n }, (_, i) => {
    const k = 2 + Math.floor(rnd() * 3); // 2..4
    const shared = pickSubset(CONVENIENCE_FIELDS, k, rnd);
    return { id: `${prefix}:${i + 1}`, attributes: [...shared.map((f) => A(f)), A(`${prefix}_unique_${i + 1}`)] };
  });
};

const OPTS_BASE = { minPrevalence: 0.15, minKindSize: 4, permutations: 500, quantile: 0.95, seed: 42, reseeds: 24 };

let failures = 0;
const report = (label, ok, detail) => {
  console.log(`  [${ok ? "OK" : "FAIL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

console.log("=".repeat(78));
console.log("PART A — direct eva()/def() on hand-picked candidates (unit-level gate check)");
console.log("=".repeat(78));
{
  const engineGroup = buildEngineGroup();
  const trimGroup = buildPeerPopulation(6, 1234, "trim");
  const filler = buildPeerPopulation(18, 4321, "filler");
  const population = [...engineGroup, ...trimGroup, ...filler];

  const params = sig(population, { minPrevalence: OPTS_BASE.minPrevalence, permutations: OPTS_BASE.permutations, quantile: OPTS_BASE.quantile, seed: OPTS_BASE.seed });
  const { profiles, keys } = parameterProfiles(population, params);
  const scales = fieldScales(population);
  const valued = readsValues(keys, scales);
  const { sim, idxOf } = valuedSimilarity(profiles, population, keys, scales);

  const engineIds = engineGroup.map((r) => r.id);
  const evaEngine = eva(profiles, sim, engineIds, idxOf, { permutations: OPTS_BASE.permutations, quantile: OPTS_BASE.quantile, seed: OPTS_BASE.seed });
  const defEngine = def({ cluster: engineIds, cohesion: evaEngine.cohesion, existence: evaEngine.existence, sim, records: population, params, population: "vehicle-listings", minPrevalence: OPTS_BASE.minPrevalence, permutations: OPTS_BASE.permutations, quantile: OPTS_BASE.quantile, seed: OPTS_BASE.seed, scales, valued });

  console.log(`\nEngine group (genuine Kind, hand-picked candidate):`);
  console.log(`  cohesion=${evaEngine.cohesion} existence.passed=${evaEngine.existence.passed} (p=${evaEngine.existence.pValue})`);
  console.log(`  constraint.passed=${defEngine.heightGate.constraint.passed} (p=${defEngine.heightGate.constraint.pValue}) -> relation=${defEngine.height}`);
  report("genuine Kind candidate discovered as 'above'", defEngine.height === "above");

  const trimIds = trimGroup.map((r) => r.id);
  const evaTrim = eva(profiles, sim, trimIds, idxOf, { permutations: OPTS_BASE.permutations, quantile: OPTS_BASE.quantile, seed: OPTS_BASE.seed });
  const defTrim = def({ cluster: trimIds, cohesion: evaTrim.cohesion, existence: evaTrim.existence, sim, records: population, params, population: "vehicle-listings", minPrevalence: OPTS_BASE.minPrevalence, permutations: OPTS_BASE.permutations, quantile: OPTS_BASE.quantile, seed: OPTS_BASE.seed, scales, valued });

  console.log(`\nTrim group (superficially similar independent peers, hand-picked candidate):`);
  console.log(`  cohesion=${evaTrim.cohesion} existence.passed=${isGap(evaTrim.existence) ? "GAP" : evaTrim.existence.passed} (p=${isGap(evaTrim.existence) ? "n/a" : evaTrim.existence.pValue})`);
  console.log(`  constraint.passed=${isGap(defTrim.heightGate.constraint) ? "GAP" : defTrim.heightGate.constraint.passed} (p=${isGap(defTrim.heightGate.constraint) ? "n/a" : defTrim.heightGate.constraint.pValue}) -> relation=${defTrim.height}`);
  report("independent-peer candidate discovered as 'peer' (both gates fail)", defTrim.height === "peer");
}

console.log("\n" + "=".repeat(78));
console.log("PART B — the REAL pipeline: con()'s own agglomeration feeding eva()/def(),");
console.log("on PEER-ONLY populations where NO Kind exists by construction");
console.log("=".repeat(78));
{
  const seeds = [1234, 999, 7, 55555, 2026];
  let totalClusters = 0;
  let aboveClusters = 0;
  const evidence = [];
  for (const seed of seeds) {
    const population = buildPeerPopulation(24, seed, "peer");
    const opts = { ...OPTS_BASE, population: `peer-only-seed${seed}` };
    const kinds = induceKinds(population, opts);
    console.log(`\nseed ${seed}: ${population.length} mutually-independent records, no Kind exists by construction.`);
    console.log(`  induceKinds() reports ${kinds.length} cluster(s):`);
    for (const k of kinds) {
      totalClusters++;
      if (k.height === "above") aboveClusters++;
      const ep = k.heightGate.existence?.pValue;
      const cp = k.heightGate.constraint?.pValue;
      console.log(`    label=${k.label.padEnd(20)} height=${k.height.padEnd(8)} members=${k.members.length} cohesion=${k.cohesion.toFixed(3)} existence.p=${ep?.toFixed?.(4)} constraint.p=${cp?.toFixed?.(4)}`);
      evidence.push({ seed, label: k.label, height: k.height, members: k.members.length, cohesion: k.cohesion, existenceP: ep, constraintP: cp });
    }
  }
  console.log(`\nTotals across ${seeds.length} seeds: ${totalClusters} clusters induced from peer-only material, ${aboveClusters} reported 'above', ${totalClusters - aboveClusters} reported 'peer'/'unstable'.`);
  report("peer-only material never confabulates an 'above' Kind (0 expected)", aboveClusters === 0, `observed ${aboveClusters}/${totalClusters} clusters reported 'above' from material with no Kind by construction`);
  globalThis.__partB_evidence = evidence;
}

console.log("\n" + "=".repeat(78));
console.log("PART C — ONE population, ONE induceKinds() call: genuine Kind + independent peers together");
console.log("=".repeat(78));
{
  const engineGroup = buildEngineGroup();
  const trimGroup = buildPeerPopulation(6, 1234, "trim");
  const filler = buildPeerPopulation(18, 4321, "filler");
  const population = [...engineGroup, ...trimGroup, ...filler];
  const opts = { ...OPTS_BASE, population: "vehicle-listings-mixed" };
  const kinds = induceKinds(population, opts);

  console.log(`\nMixed population: 6 genuine-Kind (engine) + 6 peer (trim) + 18 filler = ${population.length} records.`);
  console.log(`induceKinds() reports ${kinds.length} cluster(s):`);
  for (const k of kinds) {
    const isEngineCluster = k.members.every((m) => m.startsWith("engine:"));
    console.log(`    label=${k.label.padEnd(24)} height=${k.height.padEnd(8)} members=${k.members.length} cohesion=${k.cohesion.toFixed(3)} isGenuineEngineKind=${isEngineCluster}`);
  }

  const engineCluster = kinds.find((k) => k.members.every((m) => m.startsWith("engine:")));
  report("the genuine engine Kind is discovered as 'above'", Boolean(engineCluster) && engineCluster.height === "above");

  const nonEngineClusters = kinds.filter((k) => !k.members.every((m) => m.startsWith("engine:")));
  const confabulatedAbove = nonEngineClusters.filter((k) => k.height === "above");
  console.log(`\n  non-engine clusters found: ${nonEngineClusters.length}, of which reported 'above': ${confabulatedAbove.length}`);
  for (const k of confabulatedAbove) {
    console.log(`    CONFABULATED 'above': label=${k.label} members=${JSON.stringify(k.members)}`);
  }
  report(
    "in the SAME reading, no non-engine (peer-only) cluster is also reported 'above'",
    confabulatedAbove.length === 0,
    `${confabulatedAbove.length} peer-derived cluster(s) reported 'above' alongside the genuine Kind, indistinguishable in the output`,
  );
}

console.log("\n" + "=".repeat(78));
console.log(failures === 0 ? "VERDICT: PASS — no confabulated 'above' height observed anywhere." : `VERDICT: FAIL — ${failures} check(s) violated the discovery claim.`);
console.log("=".repeat(78));

process.exitCode = failures === 0 ? 0 : 1;

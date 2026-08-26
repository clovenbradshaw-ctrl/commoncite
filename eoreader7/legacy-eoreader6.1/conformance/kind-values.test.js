// eoreader6 · conformance/kind-values — KINDS THAT SHARE KEYS AND DIFFER IN
// VALUES, and the licensing measurements that say which statistic may read them.
//
// `kinds.test.js` is the key-only record: Emma's relation terms, where kinds
// differ in WHICH FIELDS they carry and key-Jaccard is therefore a sufficient
// statistic. This file is the case text almost never supplies and every other
// modality supplies by default — one shared key pool, all the discrimination in
// the fillers. A leitmotif shares pitch, duration, timbre and dynamics with
// every other motif in the symphony.
//
// AMENDMENT I IS THE SPINE OF THIS FILE. "Sensitivity is a property of the
// (statistic, perturbation) pair, not of the statistic." Two facts are one
// measurement here, and neither is a defect:
//
//   profileJaccard is invariant under within-key value permutation to EXACT
//   floating-point equality — so it was never licensed for value structure,
//   and it was never wrong either. It was licensed for the label shuffle,
//   and nothing said so.
//
//   valuedJaccard moves under that same perturbation — which is what licenses
//   it, and the only thing that could.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isGap } from "../nul/index.js";
import {
  induceKinds,
  inductionReading,
  parameterProfiles,
  profileJaccard,
  sig,
} from "../packages/engine/emergence/kinds.js";
import {
  valuedJaccard,
  agreement,
  fieldScales,
  permuteValuesWithinKey,
  permuteAllValues,
  scaleGaps,
  VALUE_TYPES,
} from "../packages/engine/emergence/values.js";
import { composeKinds, MODALITIES } from "../goldens/kinds/synthesize.mjs";
import { adjustedRand } from "../goldens/kinds/score.mjs";

const OPTS = (seed, extra = {}) => ({
  population: "composed",
  minPrevalence: 0.25,
  minKindSize: 3,
  permutations: 200,
  quantile: 0.95,
  reseeds: 24,
  seed,
  ...extra,
});

const compose = (over = {}) =>
  composeKinds({
    n: 4,
    schema: MODALITIES.symphony,
    membersPerKind: 8,
    keyOverlap: 1,
    valueDivergence: 1,
    withinSpread: 0.25,
    seed: 7,
    ...over,
  });

const strip = (records) =>
  records.map((r) => ({ ...r, attributes: (r.attributes ?? []).map(({ value, ...rest }) => rest) }));

const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ── Amendment I · what each statistic is licensed for ───────────────────────

test("Amendment I: profileJaccard is EXACTLY invariant under within-key value permutation", () => {
  const { records } = compose();
  const opts = OPTS(7);
  const params = sig(records, opts);
  const keys = params.map((p) => p.field_id);
  const before = parameterProfiles(records, params).profiles;

  const permuted = permuteAllValues(records, keys, prng(99));
  const after = parameterProfiles(permuted, params).profiles;

  const ids = [...before.keys()];
  assert.deepEqual(ids, [...after.keys()], "the permutation moves no record");
  let compared = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const b = profileJaccard(before.get(ids[i]), before.get(ids[j]));
      const a = profileJaccard(after.get(ids[i]), after.get(ids[j]));
      // Bit-for-bit, not "within a tolerance" — the perturbation is a bijection
      // on values and touches no key, so the key statistic cannot move at all.
      assert.equal(a, b, `pair ${i},${j} moved: key-Jaccard saw a value permutation`);
      compared++;
    }
  }
  assert.ok(compared > 100, "compared a real number of pairs");
});

test("Amendment I: valuedJaccard MOVES under the same perturbation — that is its licence", () => {
  const { records } = compose();
  const opts = OPTS(7);
  const params = sig(records, opts);
  const keys = params.map((p) => p.field_id);
  const scales = fieldScales(records);
  const permuted = permuteAllValues(records, keys, prng(99));
  const scalesAfter = fieldScales(permuted);

  let moved = 0;
  let total = 0;
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const b = valuedJaccard(records[i], records[j], keys, scales);
      const a = valuedJaccard(permuted[i], permuted[j], keys, scalesAfter);
      if (Math.abs(a - b) > 1e-9) moved++;
      total++;
    }
  }
  assert.ok(moved / total > 0.5, `only ${moved}/${total} pairs moved — too blind to be licensed`);
});

test("valuedJaccard reduces to profileJaccard EXACTLY on presence-only material", () => {
  // The migration guarantee: valueless populations induce exactly what they
  // induced before, so Emma's numbers cannot drift.
  const { records } = compose();
  const bare = strip(records);
  const opts = OPTS(7);
  const params = sig(bare, opts);
  const keys = params.map((p) => p.field_id);
  const scales = fieldScales(bare);
  const { profiles } = parameterProfiles(bare, params);

  const ids = [...profiles.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const key = profileJaccard(profiles.get(ids[i]), profiles.get(ids[j]));
      const val = valuedJaccard(
        bare.find((r) => r.id === ids[i]),
        bare.find((r) => r.id === ids[j]),
        keys,
        scales,
      );
      assert.equal(val, key);
    }
  }
});

// ── recovery, and the two controls that make it mean anything ───────────────

test("n kinds over ONE shared key pool are recovered exactly, in every modality", () => {
  for (const modality of ["symphony", "photograph", "table"]) {
    const { records, truth } = compose({ schema: MODALITIES[modality] });
    const kinds = induceKinds(records, OPTS(7));
    assert.equal(kinds.length, 4, `${modality}: expected 4 kinds, got ${kinds.length}`);
    const { ari } = adjustedRand(kinds, truth);
    assert.equal(ari, 1, `${modality}: ARI ${ari} — the partition is not the composed one`);
    // Every key is shared, so this cannot have been done by key structure.
    const reading = inductionReading(records, OPTS(7));
    assert.ok(reading.valued, `${modality}: values were not read at all`);
    for (const rec of records) assert.equal(rec.attributes.length, MODALITIES[modality].length);
  }
});

test("the KEY-ONLY control recovers nothing — this is the blindness, measured", () => {
  // Strip the values and the same material becomes unreadable: identical
  // profiles, an all-1.0 similarity matrix, a cohesion null of zero width, and
  // `degenerate_ground` at every cluster. The refusal is correct; the point is
  // that key-Jaccard had nothing to say here.
  const { records } = compose();
  assert.deepEqual(induceKinds(strip(records), OPTS(7)), []);
});

test("the AMENDMENT I null recovers only chance — the statistic reads the partition, not the distribution", () => {
  // Values are still present and still the same multiset; only the value↔record
  // binding is destroyed. Anything recovered here would be an artefact of the
  // value DISTRIBUTION rather than of the composed kinds.
  //
  // The bar is chance, not silence, and deliberately so. `quantile` is the
  // declared resolution of this test: at 0.95 the search null admits one
  // cluster in twenty by construction, so across several candidate clusters an
  // occasional survivor is the resolution being honoured, not a leak. What must
  // not survive is the PARTITION — a survivor that carried real membership
  // information would mean the statistic had been reading the distribution all
  // along. Asserting `[]` here would be asserting a false-positive rate of
  // zero, which no null at a finite quantile can promise.
  const seeds = [0xa11ce, 0xb0b, 0xc0ffee, 0xd00d];
  for (const s of seeds) {
    const { records, truth } = compose();
    const keys = inductionReading(records, OPTS(7)).keys;
    const permuted = permuteAllValues(records, keys, prng(s));
    const kinds = induceKinds(permuted, OPTS(7));
    assert.ok(kinds.length < 4, `seed ${s}: recovered ${kinds.length} kinds from permuted values`);
    const { ari } = adjustedRand(kinds, truth);
    if (ari !== null) {
      assert.ok(Math.abs(ari) < 0.2, `seed ${s}: ARI ${ari} — the permuted material still carries the partition`);
    }
  }
});

test("VACUITY CONTROL: one regime wearing four labels induces nothing", () => {
  // valueDivergence 0 composes four "kinds" from a single regime — there is
  // nothing to find, and reporting kinds here is confabulation, the first of
  // the seed's two deaths.
  //
  // MEASURED REGRESSION, recorded so it is not re-litigated: before the search
  // null existed this returned THREE kinds, every one `above`, both Born gates
  // passing, core lift up to 0.476. The Born gates cannot catch it on their own
  // because they compare a cluster against RANDOM subsets while agglomeration
  // CHOSE that cluster for its cohesion — "the best subset I could find" beats
  // "a subset drawn at random" whether or not any structure exists.
  const { records } = compose({ valueDivergence: 0, seed: 23 });
  assert.deepEqual(induceKinds(records, OPTS(23)), []);
});

test("the search null is what refuses it: without reseeds, valued induction will not run", () => {
  const { records } = compose();
  assert.throws(
    () => induceKinds(records, { population: "c", minPrevalence: 0.25, minKindSize: 3, permutations: 200, quantile: 0.95, seed: 7 }),
    /reseeds/,
    "valued material must declare the resolution of pattern",
  );
});

// ── typed gaps · a gap is a result, scoped to the field ─────────────────────

test("an unknown value_type is a type error before a null, and falls back to presence", () => {
  const records = Array.from({ length: 6 }, (_, i) => ({
    id: `r${i}`,
    attributes: [{ field_id: "mystery", value_type: "quaternion", value: i, count: 1 }],
  }));
  const scales = fieldScales(records);
  assert.equal(scales.get("mystery").mode, "presence");
  const gaps = scaleGaps(scales);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].gap, "unknown_spec");
  assert.equal(gaps[0].field_id, "mystery");
  assert.ok(!VALUE_TYPES.includes("quaternion"));
});

test("an ordinal field must RECEIVE its order — it cannot be derived from the levels", () => {
  const records = Array.from({ length: 6 }, (_, i) => ({
    id: `r${i}`,
    attributes: [{ field_id: "dynamics", value_type: "ordinal", value: ["pp", "mf", "ff"][i % 3], count: 1 }],
  }));
  const gaps = scaleGaps(fieldScales(records));
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].gap, "unreceived_origin", "sorting the levels alphabetically would invent a rank the giver never declared");

  // Declared, it reads as a value.
  const declared = records.map((r) => ({
    ...r,
    attributes: r.attributes.map((a) => ({ ...a, levels: ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"] })),
  }));
  const scales = fieldScales(declared);
  assert.equal(scales.get("dynamics").mode, "value");
  assert.deepEqual(scaleGaps(scales), []);
});

test("a numeric field of zero spread is a degenerate ground, not an agreement of 1", () => {
  const records = Array.from({ length: 6 }, (_, i) => ({
    id: `r${i}`,
    attributes: [{ field_id: "flat", value_type: "numeric", value: 42, count: 1 }],
  }));
  const gaps = scaleGaps(fieldScales(records));
  assert.equal(gaps[0].gap, "degenerate_ground", "zero width would clear anything put in front of it");
});

test("agreement is typed, bounded, and never fabricates disagreement from a hole", () => {
  const cat = { value_type: "categorical", mode: "value", scale: null };
  assert.equal(agreement("fly", "fly", cat), 1);
  assert.equal(agreement("fly", "swim", cat), 0);
  // A missing filler is not evidence of disagreement.
  assert.equal(agreement(undefined, "swim", cat), 1);

  const num = { value_type: "numeric", mode: "value", scale: 10 };
  assert.equal(agreement(100, 100, num), 1);
  assert.equal(agreement(100, 110, num), 0);
  assert.equal(agreement(100, 1e9, num), 0, "bounded below at 0 — distance cannot run negative agreement");

  const ord = { value_type: "ordinal", mode: "value", scale: 3, levels: ["a", "b", "c", "d"] };
  assert.equal(agreement("a", "a", ord), 1);
  assert.equal(agreement("a", "d", ord), 0);
  assert.ok(Math.abs(agreement("a", "b", ord) - 2 / 3) < 1e-12);

  const vec = { value_type: "vector", mode: "value", scale: 3 };
  assert.equal(agreement([1, 0, 0], [1, 0, 0], vec), 1);
  assert.equal(agreement([1, 0, 0], [-1, 0, 0], vec), 0);
  for (const s of [cat, num, ord, vec]) {
    assert.ok(agreement(undefined, undefined, s) === 1);
  }
});

// ── the generator ───────────────────────────────────────────────────────────

test("the generator leaks no membership into the material", () => {
  const { records, truth, manifest } = compose();
  const serialized = JSON.stringify(records);
  assert.ok(!/kind/i.test(serialized), "no record mentions a kind");
  for (const rec of records) assert.deepEqual(Object.keys(rec).sort(), ["attributes", "id"]);
  // Ids are positional and the rows were shuffled before naming, so neither the
  // id nor the position orders the composed kinds.
  const byPosition = truth.map((t) => t.kind);
  const sorted = [...byPosition].sort((a, b) => a - b);
  assert.notDeepEqual(byPosition, sorted, "record order still groups the kinds");
  assert.equal(manifest.total, records.length);
});

test("the generator declares every number and defaults none", () => {
  for (const missing of ["n", "membersPerKind", "keyOverlap", "valueDivergence", "withinSpread", "seed"]) {
    const opts = { n: 3, schema: MODALITIES.table, membersPerKind: 5, keyOverlap: 1, valueDivergence: 1, withinSpread: 0.2, seed: 1 };
    delete opts[missing];
    assert.throws(() => composeKinds(opts), new RegExp(missing), `${missing} was defaulted`);
  }
});

test("keyOverlap 0 hands back the key-only regime the organ started from", () => {
  // The other end of the knob: disjoint key pools, which is what Emma looks
  // like and what key-Jaccard already solved. Values are not needed here, and
  // the stripped material recovers as well as the read material does.
  const { records, truth } = compose({ keyOverlap: 0, n: 2, schema: MODALITIES.table, membersPerKind: 8, seed: 31 });
  const read = induceKinds(records, OPTS(31));
  const bare = induceKinds(strip(records), OPTS(31));
  assert.ok(read.length >= 2, `expected the disjoint pools to separate, got ${read.length}`);
  assert.equal(adjustedRand(read, truth).ari, 1);
  assert.equal(adjustedRand(bare, truth).ari, 1, "key structure alone suffices when the pools are disjoint");
});

test("induction is deterministic under a declared seed, on valued material", () => {
  const { records } = compose();
  const a = induceKinds(records, OPTS(7));
  const b = induceKinds(records, OPTS(7));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("a kind names the regime it is centred on, not just the field it carries", () => {
  // Under a shared key pool every field sits at prevalence 1 in every kind, so
  // a prevalence-chosen label would hand all four kinds the same name.
  const { records } = compose();
  const kinds = induceKinds(records, OPTS(7));
  const labels = kinds.map((k) => k.label);
  assert.equal(new Set(labels).size, kinds.length, `labels collided: ${labels.join(", ")}`);
  for (const k of kinds) {
    assert.ok(k.core.centre !== undefined, "a valued core reports what it is centred on");
    assert.ok(k.core.lift > 0, "the core field agrees with itself more than the population does");
    assert.ok(k.heightGate.searched, "a valued kind carries its search null");
  }
});

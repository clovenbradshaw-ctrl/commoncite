// eoreader6 · emergence/values — THE TYPED VALUE ALGEBRA KINDS ARE READ WITH.
//
// `emergence/kinds.js` induced kinds from KEY PRESENCE alone: an attribute was
// {field_id, value_type, count}, a profile was a binary key vector, and
// similarity was Jaccard over key sets. That works exactly when kind-identity
// happens to coincide with key-identity — which is what Emma's relation terms
// gave it (`anchor_shared` vs `subject_shared` are different KEYS).
//
// It is blind everywhere else, and the blindness is total rather than partial.
// Material whose kinds share a key pool and differ only in FILLERS produces
// identical profiles, a similarity matrix of all-1.0, a cohesion null of zero
// width, and therefore `degenerate_ground` at every cluster — SEED.md #3 firing
// correctly on a statistic that never looked. The organ says nothing, and is
// right to, because key-Jaccard has no warrant here.
//
// THIS IS THE OMNIMODAL CASE, NOT AN EDGE CASE (SEED.md, "think omnimodally").
// A leitmotif shares every key with every other motif in the symphony — pitch,
// duration, timbre, dynamics. Only values differ. So does a photograph's every
// region, a CSV's every row, a spectrum's every band. Text was the special
// case: it is nearly alone in handing over kinds that differ in which fields
// they carry at all. Reading kinds by key was fitting to that accident.
//
// AMENDMENT I IS THE GOVERNING CLAUSE HERE. "Sensitivity is a property of the
// (statistic, perturbation) pair, not of the statistic." `profileJaccard` was
// admitted on the strength of the LABEL SHUFFLE, which destroys the
// record↔key assignment. It carries no warrant for any other perturbation, and
// in particular it is invariant to exact floating-point equality under
// WITHIN-KEY VALUE PERMUTATION (`permuteValuesWithinKey` below) — that
// perturbation moves only values, and a key-presence statistic cannot see it.
// That invariance is not a defect to be patched out; it is the measurement that
// establishes what key-Jaccard is licensed for. Conformance records it.
//
// WHAT A VALUE IS, AND IS NOT. A value here is a filler in a DECLARED field
// whose domain arrives with the material. It is not a referent surface, and
// comparing two categorical fillers is not coreference — the nameless-referent
// principle governs identity across surfaces, and nothing here resolves
// identity. A field's level domain is a denotation and stays RECEIVED
// (SEED.md #1): ordinal levels must be handed in with their order, because an
// order over levels cannot be derived from the levels. A missing declaration is
// a typed gap, never an assumed alphabetical order.
//
// A GAP IS A RESULT (SEED.md #8), and it is scoped to the field. A field whose
// values cannot be read — an unknown value_type, an undeclared ordinal order, a
// numeric field of zero spread — does not abort the induction. It falls back to
// contributing KEY PRESENCE only, exactly as before, and the gap is carried on
// the result so the caller can see which fields were read as values and which
// were not. Silent fallback would be the real failure.

import { gap, isGap } from "../../../nul/index.js";

/** The value types this algebra can read. Spanning the modalities on purpose:
 *  `numeric` is audio RMS / luminance / price, `vector` is timbre / colour /
 *  embedding, `ordinal` is dynamics (ppp..fff) / Likert, `categorical` is a
 *  tabular level, `boolean` is the presence-only shape kinds.js started with. */
export const VALUE_TYPES = Object.freeze([
  "boolean",
  "categorical",
  "ordinal",
  "numeric",
  "vector",
]);

const quantileOf = (sorted, q) => {
  if (sorted.length === 1) return sorted[0];
  const h = (sorted.length - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
};

const isVector = (v) => Array.isArray(v) && v.length > 0 && v.every(Number.isFinite);

// ── field scales · the ground each field's agreement is a difference against ──
//
// A raw distance is not an agreement. |440 - 880| means one thing in a field of
// hertz and another in a field of milliseconds, and normalising by the field's
// RANGE would make the scale grow without bound in the number of records — the
// same objection SEED.md raises to range as a health statistic. So numeric
// fields are scaled by their own INTERQUARTILE spread, which is what "ananda is
// the volume of the ground" already commits this engine to.

/**
 * Derives the per-field scale every agreement kernel is read against, from the
 * population itself. Returns a Map field_id → {value_type, scale, gap?}. A
 * field whose scale cannot be formed carries its gap and is read as presence.
 */
export const fieldScales = (records) => {
  const byField = new Map();
  for (const rec of records) {
    for (const attr of rec.attributes ?? []) {
      let entry = byField.get(attr.field_id);
      if (!entry) {
        entry = { field_id: attr.field_id, value_type: attr.value_type, values: [], levels: attr.levels ?? null, valued: 0, total: 0 };
        byField.set(attr.field_id, entry);
      }
      entry.total++;
      if (attr.levels && !entry.levels) entry.levels = attr.levels;
      if (attr.value !== undefined) {
        entry.valued++;
        entry.values.push(attr.value);
      }
    }
  }

  const scales = new Map();
  for (const entry of byField.values()) {
    const { field_id, value_type, values, levels } = entry;

    // No value carried anywhere: the legacy presence-only field. Not a gap —
    // this is exactly what Emma's records are, and they are well-formed.
    if (entry.valued === 0) {
      scales.set(field_id, Object.freeze({ field_id, value_type, mode: "presence", scale: null }));
      continue;
    }

    // Type error before null (SEED.md #7): never spend a measurement on what
    // the algebra catches.
    if (!VALUE_TYPES.includes(value_type)) {
      scales.set(field_id, Object.freeze({
        field_id, value_type, mode: "presence", scale: null,
        gap: gap("unknown_spec", { field_id, value_type, reason: `no agreement kernel for value_type '${value_type}'` }),
      }));
      continue;
    }

    if (value_type === "numeric") {
      const nums = values.filter(Number.isFinite);
      if (nums.length < 2) {
        scales.set(field_id, Object.freeze({
          field_id, value_type, mode: "presence", scale: null,
          gap: gap("empty_material", { field_id, reason: "fewer than two finite values: no spread to scale against" }),
        }));
        continue;
      }
      const sorted = [...nums].sort((a, b) => a - b);
      const iqr = quantileOf(sorted, 0.75) - quantileOf(sorted, 0.25);
      if (!(iqr > 0)) {
        // Zero width would clear anything put in front of it (SEED.md #3).
        scales.set(field_id, Object.freeze({
          field_id, value_type, mode: "presence", scale: null,
          gap: gap("degenerate_ground", { field_id, reason: "zero interquartile spread: every value agrees with every other" }),
        }));
        continue;
      }
      scales.set(field_id, Object.freeze({ field_id, value_type, mode: "value", scale: iqr }));
      continue;
    }

    if (value_type === "ordinal") {
      // The ORDER over levels is a denotation and must be received (SEED.md #1).
      // Deriving it from the observed levels would invent a rank the giver never
      // declared — sorting strings is not an ordinal scale.
      if (!Array.isArray(levels) || levels.length < 2) {
        scales.set(field_id, Object.freeze({
          field_id, value_type, mode: "presence", scale: null,
          gap: gap("unreceived_origin", { field_id, reason: "an ordinal field must declare its ordered `levels`; an order over levels cannot be derived from them" }),
        }));
        continue;
      }
      scales.set(field_id, Object.freeze({ field_id, value_type, mode: "value", scale: levels.length - 1, levels: Object.freeze([...levels]) }));
      continue;
    }

    if (value_type === "vector") {
      const vecs = values.filter(isVector);
      const dims = new Set(vecs.map((v) => v.length));
      if (vecs.length < 2 || dims.size !== 1) {
        scales.set(field_id, Object.freeze({
          field_id, value_type, mode: "presence", scale: null,
          gap: gap("incommensurate_extent", { field_id, dims: [...dims], reason: "vector values must all share one dimensionality" }),
        }));
        continue;
      }
      scales.set(field_id, Object.freeze({ field_id, value_type, mode: "value", scale: vecs[0].length }));
      continue;
    }

    // boolean / categorical: a declared level domain, compared by identity
    // within the field. No scale to derive.
    scales.set(field_id, Object.freeze({ field_id, value_type, mode: "value", scale: null }));
  }
  return scales;
};

// ── agreement · one shared key, two records, a number in [0,1] ───────────────

/**
 * How much two records agree on ONE key they both carry. 1 is full agreement,
 * 0 is none. Never a gap: unreadable fields were already demoted to `presence`
 * mode by `fieldScales`, and a presence field agrees trivially — both records
 * assert the key and neither asserts more.
 *
 * A pair where either side omits its value also reads as presence. That keeps
 * partially-valued material honest: absence of a filler is not evidence of
 * disagreement, and fabricating 0 there would manufacture discrimination out of
 * a hole.
 */
export const agreement = (a, b, scale) => {
  if (!scale || scale.mode !== "value") return 1;
  if (a === undefined || b === undefined) return 1;

  switch (scale.value_type) {
    case "boolean":
    case "categorical":
      return a === b ? 1 : 0;

    case "ordinal": {
      const ia = scale.levels.indexOf(a);
      const ib = scale.levels.indexOf(b);
      if (ia < 0 || ib < 0) return 1; // a level outside the declared domain is no evidence
      return 1 - Math.abs(ia - ib) / scale.scale;
    }

    case "numeric": {
      if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
      return 1 - Math.min(1, Math.abs(a - b) / scale.scale);
    }

    case "vector": {
      if (!isVector(a) || !isVector(b) || a.length !== b.length) return 1;
      let dot = 0;
      let na = 0;
      let nb = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
      }
      if (na === 0 || nb === 0) return 1;
      const cos = dot / (Math.sqrt(na) * Math.sqrt(nb));
      return Math.min(1, Math.max(0, (1 + cos) / 2));
    }

    default:
      return 1;
  }
};

const attrMap = (rec) => {
  const m = new Map();
  for (const attr of rec.attributes ?? []) m.set(attr.field_id, attr);
  return m;
};

/**
 * VALUED JACCARD — a strict generalisation of `profileJaccard`.
 *
 *     sim(a,b) = ( Σ_{k ∈ A∩B} agreement_k(a,b) ) / |A ∪ B|
 *
 * The denominator is untouched: disagreeing on a shared key is penalised
 * exactly as not carrying it would be, so key structure keeps the weight it
 * already had. And when every shared key agrees fully — which is what a
 * presence-only population gives — the numerator collapses to |A∩B| and this
 * IS `profileJaccard`, bit for bit. That is the migration guarantee: valueless
 * material induces exactly the kinds it induced before, and Emma's numbers do
 * not move.
 *
 * `keys` restricts the read to the fields SIG admitted, so a field below the
 * declared prevalence bar cannot re-enter through the value channel.
 */
export const valuedJaccard = (recA, recB, keys, scales) => {
  const A = attrMap(recA);
  const B = attrMap(recB);
  let inA = 0;
  let inB = 0;
  let numerator = 0;
  for (const k of keys) {
    const a = A.get(k);
    const b = B.get(k);
    if (a) inA++;
    if (b) inB++;
    if (a && b) numerator += agreement(a.value, b.value, scales.get(k));
  }
  const union = inA + inB - keys.reduce((n, k) => n + (A.has(k) && B.has(k) ? 1 : 0), 0);
  if (union === 0) return 0;
  return numerator / union;
};

const simKey = (i, j) => (i < j ? `${i} ${j}` : `${j} ${i}`);

/**
 * The similarity matrix `con` clusters over, in the shape `conSimilarity`
 * returns so it is a drop-in. `profiles` decides membership (a record with no
 * admitted key is out); the records supply the values.
 */
export const valuedSimilarity = (profiles, records, keys, scales) => {
  const byId = new Map(records.map((r) => [r.id, r]));
  const ids = [...profiles.keys()];
  const sim = new Map();
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      sim.set(simKey(i, j), valuedJaccard(byId.get(ids[i]), byId.get(ids[j]), keys, scales));
    }
  }
  return { sim, idxOf: new Map(ids.map((id, i) => [id, i])), ids };
};

/** True when any admitted field is actually being read as values — i.e. when
 *  this population can discriminate kinds that share a key pool at all. */
export const readsValues = (keys, scales) => keys.some((k) => scales.get(k)?.mode === "value");

/** Every field-scoped gap the scales carry, as a result rather than a throw. */
export const scaleGaps = (scales) =>
  [...scales.values()].filter((s) => s.gap).map((s) => Object.freeze({ field_id: s.field_id, ...s.gap }));

// ── the perturbation values are licensed against (Amendment I) ───────────────

/**
 * WITHIN-KEY VALUE PERMUTATION. Permutes the values of one field across the
 * records that carry it, and changes nothing else: every record keeps exactly
 * the keys it had, so every key profile — and therefore `profileJaccard`, and
 * therefore every statistic kinds.js was previously built on — is preserved
 * EXACTLY. Only the value↔record association is destroyed.
 *
 * This is the null a value-sensitive statistic must move against to be licensed
 * at all (Amendment I), and it is the perturbation under which the old
 * statistic is provably blind. Both facts are one measurement, and conformance
 * runs it in both directions.
 */
export const permuteValuesWithinKey = (records, fieldId, rnd) => {
  const carriers = [];
  records.forEach((rec, i) => {
    if ((rec.attributes ?? []).some((a) => a.field_id === fieldId && a.value !== undefined)) carriers.push(i);
  });
  if (carriers.length < 2) return records;

  const perm = carriers.map((_, i) => i);
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  const donorValue = new Map();
  carriers.forEach((recIdx, slot) => {
    const donor = records[carriers[perm[slot]]];
    donorValue.set(recIdx, (donor.attributes ?? []).find((a) => a.field_id === fieldId).value);
  });

  return records.map((rec, i) => {
    if (!donorValue.has(i)) return rec;
    return {
      ...rec,
      attributes: (rec.attributes ?? []).map((a) =>
        a.field_id === fieldId ? { ...a, value: donorValue.get(i) } : a,
      ),
    };
  });
};

/** All admitted fields permuted independently — the population-level value null. */
export const permuteAllValues = (records, keys, rnd) =>
  keys.reduce((recs, k) => permuteValuesWithinKey(recs, k, rnd), records);

export { isGap };

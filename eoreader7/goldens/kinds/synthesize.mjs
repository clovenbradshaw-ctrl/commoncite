// eoreader6 · goldens/kinds/synthesize — N ARBITRARY CONCEPTUAL KINDS OVER A
// SHARED KEY POOL, with a KNOWN ground-truth partition.
//
// The adversary for `packages/engine/emergence/kinds.js`. That organ began by
// reading kinds from KEY PRESENCE, which is exactly right when kind-identity
// coincides with key-identity — Emma's relation terms differ in which fields
// they carry (`anchor_shared` vs `subject_shared`), so key-Jaccard could stand
// in for kind-Jaccard. Nearly nothing else in the world is shaped that way. A
// leitmotif shares every key with every other motif in the symphony; only the
// values differ. So this generator's default case is the one text never
// supplies: `keyOverlap: 1`, every kind carrying every field, all of the
// discriminating signal in the fillers.
//
// THE GENERATOR KNOWS NOTHING ABOUT MODALITY, and that is the whole design.
// It takes a SCHEMA — a list of field specs with declared value types — and
// composes regimes over it. `MODALITIES` below are nothing but declared
// schemas: a symphony is five fields, a photograph is five fields, and the
// generator cannot tell them apart. If it could, it would have a text
// assumption in it. Values span numeric, ordinal, categorical, vector and
// boolean because those are what the modalities actually hand over — hertz and
// luminance are numeric, dynamics and depth-order are ordinal, timbre and
// colour are vectors.
//
// GROUND TRUTH IS KEPT OUT OF THE RECORDS. Ids are neutral (`rec:7`) and the
// record order is shuffled, so nothing about membership survives into the
// material an inducer sees. The truth ships alongside, for scoring only.
//
// TWO KNOBS, AND BOTH ENDS OF EACH ARE MEANINGFUL:
//
//   keyOverlap       0 → kinds carry disjoint fields (the old key-only regime,
//                        which key-Jaccard already solved)
//                    1 → kinds carry identical fields (pure value
//                        discrimination; key-Jaccard is provably blind)
//
//   valueDivergence  0 → every kind draws from one regime. There is only one
//                        kind, and an inducer that reports N is confabulating.
//                        This is the vacuity control, not a degenerate input.
//                    1 → maximally separated regimes.
//
// Deterministic under a declared seed. No clock, no I/O, no ambient randomness.

const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const gauss = (rnd) => {
  const u = Math.max(rnd(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};

const shuffled = (arr, rnd) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ── declared schemas · the generator cannot tell these apart ────────────────

const DYNAMICS = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"];
const DEPTH = ["foreground", "midground", "background", "horizon"];

export const MODALITIES = Object.freeze({
  // A symphony: what a motif carries. No names, no stable surfaces.
  symphony: Object.freeze([
    { field_id: "pitch_hz", value_type: "numeric", unit: 220, spread: 40 },
    { field_id: "duration_ms", value_type: "numeric", unit: 400, spread: 90 },
    { field_id: "dynamics", value_type: "ordinal", levels: DYNAMICS },
    { field_id: "timbre", value_type: "vector", dim: 8 },
    { field_id: "articulation", value_type: "categorical", levels: ["legato", "staccato", "marcato", "tenuto", "pizzicato"] },
  ]),
  // A photograph: what a region carries.
  photograph: Object.freeze([
    { field_id: "luminance", value_type: "numeric", unit: 0.5, spread: 0.12 },
    { field_id: "hue_deg", value_type: "numeric", unit: 180, spread: 35 },
    { field_id: "texture", value_type: "vector", dim: 12 },
    { field_id: "depth_order", value_type: "ordinal", levels: DEPTH },
    { field_id: "edge_kind", value_type: "categorical", levels: ["hard", "soft", "occluded", "specular"] },
  ]),
  // A table: what a row carries.
  table: Object.freeze([
    { field_id: "magnitude", value_type: "numeric", unit: 100, spread: 22 },
    { field_id: "rate", value_type: "numeric", unit: 1, spread: 0.3 },
    { field_id: "tier", value_type: "ordinal", levels: ["low", "mid", "high"] },
    { field_id: "channel", value_type: "categorical", levels: ["direct", "referred", "organic", "paid"] },
    { field_id: "flagged", value_type: "boolean" },
  ]),
  // Prose: the Emma-like shape, presence-heavy. Included so the generator can
  // reproduce the case the organ was originally fitted to.
  prose: Object.freeze([
    { field_id: "anchor_shared", value_type: "boolean" },
    { field_id: "subject_shared", value_type: "boolean" },
    { field_id: "stem_shared", value_type: "boolean" },
    { field_id: "register", value_type: "categorical", levels: ["familial", "amorous", "civil"] },
  ]),
});

// ── regimes · what makes one kind not its neighbour ─────────────────────────

const regimeFor = (spec, kindIndex, n, divergence, rnd) => {
  switch (spec.value_type) {
    case "numeric": {
      // Centres spaced by divergence, in units of the field's own spread, so
      // separation is always read against the material's scale and never an
      // absolute number.
      const offset = n < 2 ? 0 : (kindIndex - (n - 1) / 2) * 3 * divergence * spec.spread;
      return { centre: spec.unit + offset };
    }
    case "ordinal": {
      const L = spec.levels.length;
      const span = (L - 1) * divergence;
      const centre = n < 2 ? (L - 1) / 2 : (L - 1) / 2 + (kindIndex - (n - 1) / 2) * (span / Math.max(1, n - 1));
      return { rank: Math.min(L - 1, Math.max(0, centre)) };
    }
    case "categorical":
    case "boolean": {
      const levels = spec.value_type === "boolean" ? [true, false] : spec.levels;
      // At divergence 0 every kind prefers the same level; at 1 they walk the
      // alphabet. Fewer levels than kinds is legal and simply harder.
      const idx = divergence === 0 ? 0 : Math.round(kindIndex * divergence) % levels.length;
      return { level: levels[idx] };
    }
    case "vector": {
      const base = Array.from({ length: spec.dim }, () => gauss(rnd));
      const own = Array.from({ length: spec.dim }, () => gauss(rnd));
      const centroid = base.map((b, i) => b * (1 - divergence) + own[i] * divergence);
      return { centroid };
    }
    default:
      return {};
  }
};

const drawValue = (spec, regime, withinSpread, rnd) => {
  switch (spec.value_type) {
    case "numeric":
      return regime.centre + gauss(rnd) * spec.spread * withinSpread;
    case "ordinal": {
      const L = spec.levels.length;
      const r = Math.round(regime.rank + gauss(rnd) * (L - 1) * withinSpread * 0.25);
      return spec.levels[Math.min(L - 1, Math.max(0, r))];
    }
    case "categorical":
    case "boolean": {
      const levels = spec.value_type === "boolean" ? [true, false] : spec.levels;
      if (rnd() < withinSpread) return levels[Math.floor(rnd() * levels.length)];
      return regime.level;
    }
    case "vector":
      return regime.centroid.map((c) => c + gauss(rnd) * withinSpread);
    default:
      return undefined;
  }
};

/**
 * Composes `n` conceptual kinds over one schema.
 *
 * Every option is declared and none is defaulted — the same discipline
 * `induceKinds` enforces on its own numbers (SEED.md #7). A generator with
 * quiet defaults would silently decide the difficulty of its own test.
 *
 * Returns `{ records, truth, manifest }`. `records` is what an inducer sees and
 * carries no membership information; `truth` is the partition, for scoring.
 */
export const composeKinds = ({
  n,
  schema,
  membersPerKind,
  keyOverlap,
  valueDivergence,
  withinSpread,
  seed,
} = {}) => {
  for (const [name, v] of [["n", n], ["membersPerKind", membersPerKind], ["keyOverlap", keyOverlap], ["valueDivergence", valueDivergence], ["withinSpread", withinSpread], ["seed", seed]]) {
    if (typeof v !== "number" || !Number.isFinite(v)) throw new TypeError(`composeKinds: ${name} is declared, never defaulted (got ${v})`);
  }
  if (!Array.isArray(schema) || schema.length === 0) throw new TypeError("composeKinds: schema must be a non-empty array of field specs");
  if (n < 1) throw new TypeError("composeKinds: n must be at least 1");
  if (keyOverlap < 0 || keyOverlap > 1) throw new TypeError("composeKinds: keyOverlap is a fraction in [0,1]");
  if (valueDivergence < 0 || valueDivergence > 1) throw new TypeError("composeKinds: valueDivergence is a fraction in [0,1]");

  const rnd = prng(seed);
  const K = schema.length;

  // The spine every kind carries, and the private remainder split between them.
  const spineSize = Math.round(K * keyOverlap);
  const spine = schema.slice(0, spineSize);
  const rest = schema.slice(spineSize);
  const privateFields = Array.from({ length: n }, (_, k) => rest.filter((_, i) => i % n === k % Math.max(1, n)));

  const regimes = Array.from({ length: n }, (_, k) => {
    const fields = [...spine, ...privateFields[k]];
    return {
      kind: k,
      fields: fields.map((f) => f.field_id),
      regime: Object.fromEntries(fields.map((f) => [f.field_id, regimeFor(f, k, n, valueDivergence, rnd)])),
    };
  });

  const rows = [];
  for (let k = 0; k < n; k++) {
    const fields = [...spine, ...privateFields[k]];
    for (let m = 0; m < membersPerKind; m++) {
      rows.push({
        kind: k,
        attributes: fields.map((f) => {
          const attr = {
            field_id: f.field_id,
            value_type: f.value_type,
            value: drawValue(f, regimes[k].regime[f.field_id], withinSpread, rnd),
            count: 1,
          };
          // An ordinal field must hand over its order — it cannot be derived
          // from the levels (values.js, SEED.md #1).
          if (f.value_type === "ordinal") attr.levels = f.levels;
          return attr;
        }),
      });
    }
  }

  // Shuffle before naming, so neither the id nor the position encodes the kind.
  const order = shuffled(rows.map((_, i) => i), rnd);
  const records = order.map((srcIdx, i) => ({
    id: `rec:${i}`,
    attributes: rows[srcIdx].attributes,
  }));
  const truth = Object.freeze(order.map((srcIdx, i) => Object.freeze({ id: `rec:${i}`, kind: rows[srcIdx].kind })));

  return Object.freeze({
    records,
    truth,
    manifest: Object.freeze({
      n,
      membersPerKind,
      total: records.length,
      keyOverlap,
      valueDivergence,
      withinSpread,
      seed,
      spine: Object.freeze(spine.map((f) => f.field_id)),
      value_types: Object.freeze([...new Set(schema.map((f) => f.value_type))]),
      kinds: Object.freeze(regimes.map((r) => Object.freeze({ kind: r.kind, fields: Object.freeze(r.fields) }))),
    }),
  });
};

if (process.argv[1] && process.argv[1].endsWith("synthesize.mjs")) {
  for (const [name, schema] of Object.entries(MODALITIES)) {
    const { records, manifest } = composeKinds({
      n: 4, schema, membersPerKind: 8, keyOverlap: 1, valueDivergence: 1, withinSpread: 0.25, seed: 7,
    });
    console.log(`${name.padEnd(11)} ${records.length} records · ${manifest.spine.length} shared keys · types: ${manifest.value_types.join(", ")}`);
  }
}

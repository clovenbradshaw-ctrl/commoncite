// Canonical Hyperlexicon (HL) assembly for EOReader reasoning.
//
// HL is not a vocabulary list and it is not a hidden semantic classifier.
// It is the explicit ledger of relation affordances that may participate in
// reasoning. A candidate may be discovered from repeated experience; only a
// GIVEN affordance, with a named giver, may license composition.
//
// This makes the old "HL" role explicit and canonical: every reading may
// consult it, every affordance has standing, and absence is represented as an
// inspectable unknown rather than silently treated as permission.

const freeze = (x) => Object.freeze(x);
const stable = (x) => typeof x === "string" ? x : JSON.stringify(x);
export const pairKey = (left, right) => `${stable(left)}\u0000${stable(right)}`;

export const HL_SCHEMA = "EOHyperlexicon@1";
export const HL = "Hyperlexicon";

const normalizeAffordance = (entry = {}) => freeze({
  left: entry.left,
  right: entry.right,
  standing: entry.standing ?? "unknown",
  giver: entry.giver ?? null,
  witnesses: freeze([...(entry.witnesses ?? [])]),
  meta: freeze({ ...(entry.meta ?? {}) }),
});

/** Create a canonical Hyperlexicon snapshot. */
export function createHyperlexicon({ composition = [], meta = {} } = {}) {
  const table = Object.create(null);
  const entries = Array.isArray(composition)
    ? composition
    : Object.entries(composition).map(([key, value]) => ({
        ...(typeof value === "string" ? { standing: value } : value),
        _key: key,
      }));

  for (const raw of entries) {
    const entry = normalizeAffordance(raw);
    const key = raw._key ?? pairKey(entry.left, entry.right);
    table[key] = entry;
  }

  return freeze({
    schema: HL_SCHEMA,
    composition: freeze(table),
    meta: freeze({ ...meta }),
  });
}

/** Accept historical/plain HL shapes and return the canonical form. */
export function normalizeHyperlexicon(input = null) {
  if (!input) return createHyperlexicon();
  if (input.schema === HL_SCHEMA && input.composition) return input;
  if (Array.isArray(input)) return createHyperlexicon({ composition: input });
  if (input.composition) return createHyperlexicon({ composition: input.composition, meta: input.meta });
  return createHyperlexicon({ composition: input });
}

/** Read the standing of one possible relation composition. */
export function compositionAffordance(hyperlexicon, left, right) {
  const hl = normalizeHyperlexicon(hyperlexicon);
  return hl.composition[pairKey(left, right)] ?? freeze({
    left,
    right,
    standing: "unknown",
    giver: null,
    witnesses: freeze([]),
    meta: freeze({}),
  });
}

/**
 * Merge newly observed candidates into HL without promoting them. Existing
 * GIVEN entries always win: experience may nominate a law, never grant itself
 * authority to become one.
 */
export function admitHyperlexiconCandidates(hyperlexicon, candidates = []) {
  const hl = normalizeHyperlexicon(hyperlexicon);
  const composition = { ...hl.composition };

  for (const raw of candidates) {
    const candidate = normalizeAffordance({ ...raw, standing: "candidate" });
    const key = pairKey(candidate.left, candidate.right);
    const current = composition[key];
    if (current?.standing === "given") continue;

    const witnessKeys = new Set([
      ...(current?.witnesses ?? []).map(stable),
      ...(candidate.witnesses ?? []).map(stable),
    ]);
    const witnessByKey = new Map([
      ...(current?.witnesses ?? []).map((x) => [stable(x), x]),
      ...(candidate.witnesses ?? []).map((x) => [stable(x), x]),
    ]);

    composition[key] = freeze({
      left: candidate.left,
      right: candidate.right,
      standing: "candidate",
      giver: current?.giver ?? candidate.giver ?? null,
      witnesses: freeze([...witnessKeys].map((k) => witnessByKey.get(k))),
      meta: freeze({ ...(current?.meta ?? {}), ...(candidate.meta ?? {}), observed: true }),
    });
  }

  return createHyperlexicon({ composition, meta: hl.meta });
}

/** Explicitly grant an affordance. The giver is mandatory and auditable. */
export function giveHyperlexiconAffordance(hyperlexicon, { left, right, giver, witnesses = [], meta = {} } = {}) {
  if (left === undefined || right === undefined) throw new TypeError("giveHyperlexiconAffordance: left and right are required");
  if (!giver) throw new TypeError("giveHyperlexiconAffordance: giver is required");
  const hl = normalizeHyperlexicon(hyperlexicon);
  return createHyperlexicon({
    meta: hl.meta,
    composition: {
      ...hl.composition,
      [pairKey(left, right)]: {
        left,
        right,
        standing: "given",
        giver,
        witnesses,
        meta,
      },
    },
  });
}

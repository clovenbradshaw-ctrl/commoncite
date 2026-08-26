// eoreader6 · spec/canonical-json — deterministic bytes for a sealed record.
//
// Re-earned from eoreader5's packages/spec/canonical-json, not copied: v5's
// canonicalizer is kept (it is correct and the rules below are its rules), but
// its hash was async (WebCrypto subtle) with a sync fallback, and this repo's
// commitment path must be pure and synchronous — no I/O, no ambient anything.
// So the digest here is a self-contained FNV-1a, and its limits are stated
// rather than implied.
//
// Rules:
// - object keys sorted lexicographically (code-point order) AT EVERY DEPTH;
// - arrays preserve semantic order — the caller chooses a deterministic order;
// - undefined / function / symbol are refused: a sealed envelope must not
//   carry something that silently vanishes on encode;
// - numbers must be finite — NaN and Infinity have no canonical bytes;
// - no insignificant whitespace.
//
// WHAT THIS SEAL IS AND IS NOT. It is a tamper-DETECTION seal: it catches
// accidental mutation, key reordering, and a record edited after the fact and
// re-passed as the original. It is not a cryptographic commitment — FNV-1a is
// not collision-resistant against someone deliberately constructing a
// collision. Every use of it in this repo is against ourselves (did this
// record change between commit and reveal?), never against an adversary, and
// that distinction is why an unauthenticated digest is honest here. If a use
// ever needs the adversarial property, it needs a different function, and
// saying so here is cheaper than discovering it later.

const assertCanonicalizable = (value, path) => {
  if (value === undefined) throw new TypeError(`canonicalJson: undefined at ${path}`);
  if (typeof value === "function" || typeof value === "symbol")
    throw new TypeError(`canonicalJson: ${typeof value} at ${path}`);
  if (typeof value === "number" && !Number.isFinite(value))
    throw new TypeError(`canonicalJson: non-finite number at ${path}`);
};

const canonicalize = (value, path = "$") => {
  assertCanonicalizable(value, path);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item, i) => canonicalize(item, `${path}[${i}]`));
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const child = value[key];
    if (child === undefined) continue; // an omitted field, not a null
    out[key] = canonicalize(child, `${path}.${key}`);
  }
  return out;
};

/** Deterministic JSON string: sorted keys at every depth, no whitespace. */
export const canonicalJsonStringify = (value) => JSON.stringify(canonicalize(value));

// Four FNV-1a lanes with distinct offset bases, concatenated to 128 bits. One
// 32-bit lane collides by birthday at ~65k records, which is well inside the
// number of commitments a single walk-forward produces.
const LANES = [2166136261, 84696351, 1640531527, 2654435761];

/**
 * Content hash of the canonical encoding, tagged with its algorithm so a
 * stored hash stays self-describing if this is ever migrated.
 */
export const canonicalHashSync = (value) => {
  const str = canonicalJsonStringify(value);
  const lanes = LANES.slice();
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    for (let l = 0; l < lanes.length; l++) {
      lanes[l] = Math.imul(lanes[l] ^ ((c + l * 0x9e37) & 0xffff), 16777619) | 0;
    }
  }
  return "fnv128:" + lanes.map((h) => (h >>> 0).toString(16).padStart(8, "0")).join("");
};

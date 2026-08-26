// eoreader6 · goldens/shared/fuzzy-match — a discovered surface against a
// third-party reference name, scored, so the BEST match wins rather than
// whichever reference entry happens to sit first in the list.
//
// Reconciled from two independently-written versions: goldens/cast/read.mjs
// carried a boolean `matches()` (exact / single-shared-token / containment),
// tuned for its own mostly-single-token surfaces (cast drives entity.js with
// raw unigram/bigram candidates, deliberately without extractSurfaces' name-
// shape prior — see cast's own header on why: several of its fixtures are
// scripts, like Han, where capitalisation carries no signal at all, and the
// golden's whole point is recurrence-only discovery). goldens/network/read.mjs
// carried a near-identical but SCORED version, because its surfaces are
// routinely two-to-four-token capitalised runs from extractSurfaces, and the
// boolean matcher's `.find()` call site took the FIRST reference name that
// shared any token with a surface rather than the best one — measured on
// Huckleberry Finn: "Miss Watson" (this reading's own correct, exact
// surface) matched "Miss Charlotte Grangerford" purely because that name
// sits earlier in the CSV, sharing only the honorific "miss".
//
// That bug is not multi-word-specific — cast/read.mjs's own `.find()` call
// has the identical shape and would misfire the same way given two
// reference names sharing a single token (a common surname or title in any
// of its five languages). The single-token case degrades to exactly cast's
// old boolean matcher's own behaviour (`aTokens`/`bTokens` are each one
// token; exact match or containment fires the same way), so this is a
// generalisation, not a narrowing, of what cast already asked for.

const norm = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * How well `surface` (a discovered entity's display name) matches
 * `refName` (one third-party reference entry) — 0 (no match) to 100
 * (exact, token-for-token match after normalisation). Deliberately weak
 * string comparison, on purpose: bridging real spelling gaps (script
 * mismatch, morphological inflection, alias) is CON · Pattern's job
 * (referents/consequence.js), never a scorer's.
 */
export const matchScore = (surface, refName) => {
  const aTokens = norm(surface).split(/\s+/).filter((t) => t.length >= 3);
  const bTokens = norm(refName).replace(/[.,]/g, " ").split(/\s+/).filter((t) => t.length >= 3);
  if (!aTokens.length || !bTokens.length) return 0;
  if (aTokens.join(" ") === bTokens.join(" ")) return 100;
  const shared = aTokens.filter((t) => bTokens.includes(t)).length;
  if (shared > 0) return (10 * shared) / Math.max(aTokens.length, bTokens.length);
  const a = aTokens.join("");
  const b = bTokens.join("");
  if (b.includes(a) || a.includes(b)) return 1;
  return 0;
};

/** The best-scoring entry in `refNames` for `surface`, or null if nothing scores above 0. */
export const bestMatch = (surface, refNames) => {
  let best = null;
  let bestScore = 0;
  for (const n of refNames) {
    const sc = matchScore(surface, n);
    if (sc > bestScore) { bestScore = sc; best = n; }
  }
  return best;
};

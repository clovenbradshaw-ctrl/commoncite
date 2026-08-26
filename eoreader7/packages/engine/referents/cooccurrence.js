// eoreader6 · referents/cooccurrence — a second, complementary alias pass
// over an admitted register, before any edge is asked about.
//
// The actual structural-edge question — do two admitted beings recur
// TOGETHER, significantly, more than a permutation of their own arrivals
// would predict — already has a proper organ: `emergence/binding.js`
// (`detectCoArrivals`, `displacementNull`, `bindLinks`, and the fuller
// `readLinks`/`buildLink` with direction and polarity via transfer
// entropy). An earlier version of this file hand-rolled a cruder
// same-chapter counting test instead of using it — measured (goldens/
// network/README.md) to be both weaker (no significance test, limited by
// how many chapters/scenes a segmenter happened to find) and, on short
// texts, simply unable to resolve anything. `emergence/binding.js` needs no
// notion of "chapter" at all — resolution comes from the reading's own
// reach-unit count, which stays in the hundreds to thousands even for a
// short play. Callers building a co-occurrence graph over an admitted
// register should use `bindLinks`/`readLinks` directly; this file no
// longer duplicates that.
//
// What genuinely belongs here — because it is a step BEFORE any edge is
// asked about, not the edge question itself — is alias consolidation.
// `perceiver/text/surfaces.js::discoverReferents` already merges by
// SPELLING (name-variant coreference) before `entity.js` ever sees a
// surface, and is conservative on purpose: a token that pairs with too
// many different partners across a book's own candidate pool is stripped
// as generic before the coreference check runs (right for not merging
// every "Princess" into one person). Measured on Huckleberry Finn: "tom"
// and "sawyer" both get stripped this way, so "Tom Sawyer" and "Sawyer"
// are admitted as two separate entities. `mergeAliasedEntities` catches
// what is left using arrival SHAPE (`consequence.js::identityByConsequence`)
// instead of spelling — a different kind of evidence, asked only of
// entities that still share a name token, never a blind O(n²) sweep.

import { identityByConsequence } from "./consequence.js";

// ── alias merging ─────────────────────────────────────────────────────────────
//
// The merge decision itself is `consequence.js`'s `identityByConsequence` —
// arrival-shape only, never spelling, the nameless-referent principle held
// exactly as strictly here as everywhere else in this engine. What IS by
// spelling is which pairs are even worth asking: testing every admitted
// pair is O(n²) resamples (200 reseeds × two tests, per pair) and most
// pairs of admitted beings share no plausible reason to be aliases at all.
// Restricting the question to pairs that share a token of real length is a
// candidate FILTER, not a verdict — "valjean" and "jean valjean" get asked;
// "valjean" and "javert" never do, because nothing here is willing to
// resample 400 times per pair to answer a question the strings already make
// obvious is "no". The verdict, when a pair IS asked, is still earned by
// `identityByConsequence` alone.
// Splits on anything that isn't a letter/digit, not just whitespace — a
// caller whose admitted "surfaces" are structured ids (e.g. entity.js fed
// `discoverReferents`'s `ref:auto:tom_sawyer` keys instead of plain words)
// still tokenizes to ["ref","auto","tom","sawyer"] rather than one opaque
// blob no other id ever shares.
const tokensOf = (name) => name.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3);

const aliasCandidates = (entities, nameOf) => {
  const byToken = new Map();
  entities.forEach((e, i) => {
    for (const t of tokensOf(nameOf(e))) {
      if (!byToken.has(t)) byToken.set(t, []);
      byToken.get(t).push(i);
    }
  });
  // A token most entities share is a structural artifact of `nameOf`
  // (an id-namespace prefix like "ref"/"auto" from `discoverReferents`'s
  // own `ref:auto:*` ids when a caller passes no real `nameOf`), never
  // evidence two SPECIFIC entities might be aliases — matches everything,
  // so it filters nothing, and every pair would be offered to the
  // expensive statistical test regardless of whether either name even
  // resembles the other. Dropped the same way `genericTokens` in
  // perceiver/text/surfaces.js drops a title/family-name token that pairs
  // with too many partners to individuate anyone.
  const majority = Math.ceil(entities.length / 2);
  const pairs = new Set();
  for (const idxs of byToken.values()) {
    if (idxs.length > majority) continue;
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const key = idxs[a] < idxs[b] ? `${idxs[a]}:${idxs[b]}` : `${idxs[b]}:${idxs[a]}`;
        pairs.add(key);
      }
    }
  }
  return [...pairs].map((k) => k.split(":").map(Number));
};

/**
 * Union-find over admitted entities, merged wherever `identityByConsequence`
 * returns "consistent" for a candidate pair — never "distinct" or
 * "unstable", both of which leave the two beings separate (a refusal to
 * refute is not a proof, and this only acts on the refutation side: two
 * surfaces stay apart unless the evidence gives no reason to keep them so).
 * Returns a new entity list — same shape as `carryEntities`'s (`id`,
 * `surfaces`, `arrivals`), a merged entity carrying every surface and the
 * union of every arrival, id taken from whichever original entity was born
 * first (birth order is still meaningful: the earliest surface to clear the
 * gate).
 *
 * `nameOf(entity)` supplies the human-readable string the token-sharing
 * PREFILTER runs against — defaults to `entities[i].surfaces[0]`, correct
 * when that surface is already a plain word or phrase. A caller whose
 * admitted surfaces are structured ids (`ref:auto:tom_sawyer`) rather than
 * words should pass a `nameOf` that resolves back to a display name, or
 * every entity's id-prefix tokens ("ref", "auto") collide and the prefilter
 * stops filtering anything.
 */
export const mergeAliasedEntities = (state, entities, { nameOf = (e) => e.surfaces[0], ...options } = {}) => {
  const parent = entities.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };

  for (const [i, j] of aliasCandidates(entities, nameOf)) {
    if (find(i) === find(j)) continue;
    const verdict = identityByConsequence(state, entities[i].surfaces[0], entities[j].surfaces[0], options);
    if (verdict.relation === "consistent") union(i, j);
  }

  const groups = new Map();
  entities.forEach((e, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(e);
  });

  return [...groups.values()].map((members) => {
    const sorted = members.slice().sort((a, b) => a.bornAt - b.bornAt);
    const arrivals = [...new Set(sorted.flatMap((e) => e.arrivals))].sort((a, b) => a - b);
    return {
      id: sorted[0].id,
      surfaces: sorted.flatMap((e) => e.surfaces),
      arrivals,
      bornAt: sorted[0].bornAt,
      mergedFrom: sorted.length > 1 ? sorted.map((e) => e.id) : undefined,
    };
  });
};

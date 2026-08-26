// eoreader6 · induction/typology — assembles the `typology` shape
// modifier-order/index.js receives (`{ranks, direction, giver}`, per II.2)
// from induceKinds's own certified output, instead of a human-supplied
// table like modifier-order/wals.js's. This is the emergent path II.2's
// giver test still governs: nothing here is assumed or guessed, but the
// giver is the measurement itself, named honestly as such, rather than a
// cited linguistic authority.
//
// RANK is each kind's mean distance from its member tokens' anchors,
// measured directly from the occurrence evidence (never from whichever
// field induceKinds's DEF stage happened to pick as the kind's displayed
// "core" — distance is what modifier-order/index.js's rank axis actually
// means, so it is what this module always measures, regardless of which
// field discriminated the kind best). A kind whose members sit closer to
// their anchors, on average, gets a lower rank — more classifying, per
// modifier-order/index.js's own header ("modifiers closer to the head
// classify a narrower kind... modifiers farther from the head evaluate").
// This is the same convention modifier-order/wals.js's DEM_NUM_RANKS uses
// (demonstrative=12, farthest from the head, ranked highest).
//
// DIRECTION is measured, never assumed pre-nominal: the same binomial test
// candidates.js's measureDirection already runs, applied here to every
// occurrence of every CLASSIFIED token (members of a certified kind) rather
// than every content-band token — a tighter, more relevant sample than
// candidates.js's own corpus-wide measurement. A corpus whose classified
// occurrences do not clear p<0.05 either way gets no typology at all
// (`gap("unstable", ...)`) — this module never forces a direction a corpus
// does not actually have, the same discipline measureDirection itself
// already holds to.
//
// ONLY KINDS THAT CLEARED BOTH BORN GATES (height === "above") seed a rank.
// induceKinds returns kinds that passed its existence-dependency gate but
// still failed the possibility-constraint gate as height === "unstable" —
// real evidence of a cohesive group, but not evidence that group's core
// field itself constrains membership. Folding those into the typology
// would rank a class this organ cannot actually name a coherent regime
// for. They are carried on the result as `excludedKinds`, not silently
// dropped (SEED.md #8: a gap is a result).
//
// THIS RUNS ONCE, OVER A CORPUS OF PRIORS — NEVER PER-READING. Exactly like
// modifier-order/wals.js's typology or eoWebLLM's disclosed-scope English
// demo table, the object this module returns is meant to be RECEIVED by a
// reading, not rebuilt by one. A single document, even a whole book, is
// almost never enough material for induceKinds's Born gates to clear (the
// gates are nulled against random partitions of the very population being
// clustered — too small a population has no non-degenerate null to clear at
// all, and correctly returns no kinds rather than a fabricated one). The
// intended shape is: induce once over a real corpus of priors (live_priors,
// e.g.), keep the resulting typology as a standing prior, and hand it to
// modifier-order/index.js's `order`/`toTriples`/`toEvents` for every
// individual reading afterward — the same received-typology seam WALS and
// the English demo table already use, just filled emergently instead of
// from a cited authority or a hand-written lexicon.
//
// Pure: no clock, no randomness, no I/O.

import { gap, isGap } from "../nul/index.js";
import { measureDirection } from "./candidates.js";

/**
 * Builds the induced typology from induceKinds's own output and the same
 * occurrence list attributes.js read to build its records. `population`
 * names what was induced from, for the giver string (II.2 requires a named
 * giver; here that name is the corpus/run identity, not a linguist).
 */
export const assembleTypology = (kinds, occurrences, { population } = {}) => {
  if (typeof population !== "string" || population.trim() === "")
    return gap("undeclared", { what: "population", why: "a typology's giver must name what it was induced from" });
  if (!Array.isArray(kinds) || kinds.length === 0)
    return gap("empty_material", { reason: "induceKinds returned no certified kinds; there is nothing to assemble a typology from" });
  if (!Array.isArray(occurrences) || occurrences.length === 0) return gap("empty_material", { occurrences });

  const distancesByToken = new Map();
  for (const occ of occurrences) {
    let d = distancesByToken.get(occ.token);
    if (!d) {
      d = [];
      distancesByToken.set(occ.token, d);
    }
    d.push(occ.distance);
  }

  const certified = kinds.filter((k) => k.height === "above");
  const excludedKinds = kinds.filter((k) => k.height !== "above").map((k) => k.id);
  if (certified.length === 0)
    return gap("unstable", {
      reason: "no induced kind cleared both Born gates (existence-dependency and possibility-constraint); a typology needs at least one fully certified class",
      excludedKinds,
    });

  const ranks = {};
  const classOf = {};
  for (const kind of certified) {
    const memberDistances = kind.members.flatMap((tok) => distancesByToken.get(tok) ?? []);
    if (memberDistances.length === 0) continue; // no occurrence evidence for this kind's members — do not fabricate a rank
    ranks[kind.id] = memberDistances.reduce((s, d) => s + d, 0) / memberDistances.length;
    for (const tok of kind.members) classOf[tok] = kind.id;
  }
  if (Object.keys(ranks).length === 0)
    return gap("empty_material", { reason: "certified kinds carried no measurable member occurrences" });

  const classifiedOccurrences = occurrences.filter((o) => o.token in classOf);
  const directionResult = measureDirection(classifiedOccurrences);
  if (isGap(directionResult)) return directionResult;
  if (directionResult.direction === "exchangeable")
    return gap("unstable", {
      reason: "classified occurrences do not skew pre- or post-nominal at p<0.05; no direction can be assigned without guessing one",
      directionResult,
    });

  const giver =
    `induced from population "${population}": ${certified.length} kind(s) certified by induceKinds's paired Born gates ` +
    `(existence-dependency + possibility-constraint) over ${occurrences.length} candidate occurrences; rank = each kind's ` +
    `mean distance from its member tokens' anchors; direction = a binomial test over every occurrence of a classified token ` +
    `(p=${directionResult.pValue.toFixed(4)}, n=${directionResult.n})` +
    (excludedKinds.length > 0 ? `; ${excludedKinds.length} candidate kind(s) passed existence but not possibility-constraint and were excluded` : "");

  return Object.freeze({
    ranks: Object.freeze(ranks),
    direction: directionResult.direction,
    giver,
    classOf: Object.freeze(classOf),
    excludedKinds: Object.freeze(excludedKinds),
  });
};

/**
 * Tags a plain token sequence against an assembled typology, in the exact
 * `{class, surface}` shape modifier-order/index.js's `order`/`toTriples`/
 * `toEvents` receive. A token with no class in the typology gets
 * `class: null` — which fails `order`'s own `isTag` check and refuses the
 * whole sequence, rather than this module silently dropping or
 * misclassifying a token the induction never actually covered.
 */
export const tagSequence = (tokens, typology) => {
  if (!Array.isArray(tokens)) return gap("undeclared", { what: "tokens", why: "a sequence to tag is received, never assumed" });
  if (!typology || typeof typology.classOf !== "object")
    return gap("undeclared", { what: "typology", why: "a typology (with classOf) is received, never assumed" });
  return Object.freeze(tokens.map((tok) => Object.freeze({ class: typology.classOf[tok] ?? null, surface: tok })));
};

// eoreader6 · induction/attributes — converts candidate modifier occurrences
// (induction/candidates.js) into the attribute-record shape
// emergence/kinds.js's induceKinds() requires, so descriptor words can be
// grouped into emergent, anonymous kinds by pure distributional behavior —
// never by a semantic label a human assigned.
//
// "No human learns these ten" — a kind's label, once induceKinds runs, is
// whichever field_id (and, for numeric fields, its central value) most
// discriminates it from the population (kinds.js's own DEF stage): something
// like "distance=1" or "headship=0.02". That is not a linguistic category
// anyone named; it is a measured regime. Nothing downstream requires a
// human-readable gloss for the classification to be real — exactly the
// simplification the user authorized ("no human learns these ten so doing
// it emergently is fine").
//
// Three fields per record, all measured from the occurrence list, never
// invented by this module:
//
//   side       categorical — which side of its anchor(s) this token's
//              occurrences predominantly fall on ("before" | "after")
//   distance   numeric — the mean distance from anchor across this token's
//              occurrences (closer-binding and farther-binding modifiers
//              sit at different typical distances — what linguistic
//              typology calls "rank")
//   headship   numeric — the fraction of this token's total involvement
//              (as either anchor or modifier) in which it served as the
//              ANCHOR rather than the modifier. A token that is almost
//              always a modifier (headship near 0) behaves differently
//              from one that is often itself a head (headship near 1) —
//              the same evidence a POS tagger would use, recovered here
//              from position alone.
//
// One record per distinct token — not per occurrence — because induceKinds
// clusters ENTITIES (here, candidate modifier words), each carrying
// attributes earned from its behavior across the whole corpus, exactly as
// emergence/kinds.js's own relation-term records do (`sister` is one
// record, not one row per sentence it appears in).
//
// Pure: no clock, no randomness, no I/O.

import { gap, isGap } from "../nul/index.js";

/**
 * Groups a flat occurrence list (from induction/candidates.js's
 * extractOccurrences) by token and reduces each group to the three
 * distributional fields declared above. `minOccurrences` is the floor of
 * recurrence a token needs before its distribution is trusted enough to
 * report at all — declared by the caller, never defaulted, the same
 * discipline as candidates.js's frequency bounds.
 */
export const toAttributeRecords = (occurrences, { minOccurrences } = {}) => {
  if (!Number.isInteger(minOccurrences) || minOccurrences < 1)
    return gap("undeclared", {
      what: "minOccurrences",
      why: "the floor of recurrence a token needs before its distribution is trusted is never defaulted",
    });
  if (!Array.isArray(occurrences) || occurrences.length === 0) return gap("empty_material", { occurrences });

  const asModifier = new Map(); // token -> { before, after, distances }
  const asAnchor = new Map(); // token -> count

  for (const occ of occurrences) {
    let entry = asModifier.get(occ.token);
    if (!entry) {
      entry = { before: 0, after: 0, distances: [] };
      asModifier.set(occ.token, entry);
    }
    if (occ.side === "before") entry.before++;
    else entry.after++;
    entry.distances.push(occ.distance);

    asAnchor.set(occ.anchor, (asAnchor.get(occ.anchor) ?? 0) + 1);
  }

  const records = [];
  for (const [token, entry] of asModifier) {
    const modCount = entry.before + entry.after;
    const headCount = asAnchor.get(token) ?? 0;
    const total = modCount + headCount;
    if (total < minOccurrences) continue;

    const side = entry.before >= entry.after ? "before" : "after";
    const meanDistance = entry.distances.reduce((s, d) => s + d, 0) / entry.distances.length;
    const headship = headCount / total;

    records.push(
      Object.freeze({
        id: token,
        attributes: Object.freeze([
          Object.freeze({ field_id: "side", value_type: "categorical", value: side, count: modCount }),
          Object.freeze({ field_id: "distance", value_type: "numeric", value: meanDistance, count: modCount }),
          Object.freeze({ field_id: "headship", value_type: "numeric", value: headship, count: total }),
        ]),
      })
    );
  }

  if (records.length === 0) return gap("empty_material", { reason: "no token cleared minOccurrences", minOccurrences });
  return Object.freeze(records);
};

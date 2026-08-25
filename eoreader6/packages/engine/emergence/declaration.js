// eoreader6 · emergence/declaration — an act names the organ that performed
// it, or it is not in the record.
//
//   DEF · Ground   Atmosphere · Clearing   refuse an act that cannot say whose
//
// SEED.md, "Not yet earned", has carried this debt since `frame` shipped:
//
//   The privileged frame is possible, not mandatory — `frame` puts an act in
//   the record and measures a sequence of them, so the debt below is no longer
//   that the thing cannot be done. It is that nothing *requires* an organ to
//   record what it did. The "advisory" grep is still a lint wearing an
//   invariant's clothes, and it stays until an organ that fails to declare its
//   acts is refused rather than merely unaudited.
//
// TWO REFUSALS AT TWO LEVELS, AND NEITHER DOES THE OTHER'S JOB. That split is
// the whole design, and getting it wrong would have put the roster inside a
// root organ:
//
//   the record refuses ANONYMITY   `frame.note` refuses an act carrying no
//                                  `organ` at all — the same shape as its
//                                  existing refusals for `op` and `grain`.
//                                  It never asks whether the name is real,
//                                  because `frame` depends on `nul` and on
//                                  nothing else in the tree.
//   the roster refuses IMPOSTURE   this module. A name that is not on the
//                                  roster is not an organ, and an organ
//                                  acting outside the cell it declared is
//                                  acting as something it is not.
//
// THE SAME CELL AS `perceiver/text/admit`, AND THE SAME SENTENCE. That organ
// occupies DEF · Ground because a prior must name its giver; this one occupies
// it because an act must name its organ. Two mouths, one jaw: both refuse a
// claim that cannot say where it came from. `loops/atmosphere/def` is the
// third and reads material rather than the apparatus, which is the same
// arrangement `emergence/coverage` already has with EVA · Ground.
//
// WHAT THIS IS NOT YET. Declaration is CHECKED, not COMPULSORY. An organ that
// never declares anything still runs — nothing forces the call. Making it
// compulsory is the host's, not this module's and not the turn's:
// `loops/turn`'s own header refuses to hold a frame, and refuses it for a
// reason rather than for convenience — a constructed ground can never open a
// sequence (SEED.md #1), so a loop that builds its own ground cannot be the
// thing that opens the record. Whoever received the first prior holds the
// sequence. The debt therefore moves rather than closes, and SEED.md says so.
//
// DECLARED NUMBERS. None. This organ measures nothing; it refuses, and a
// refusal that needed a threshold would be a measurement wearing a type
// error's clothes (SEED.md #7).
//
// Pure: no clock, no randomness, no I/O.

import { gap, isGap } from "../../../nul/index.js";
import { note } from "../../../frame/index.js";
import { ORGANS, cellOf } from "../operators.js";

// The cell this organ occupies — declared, checked by conformance.
export const CELL = Object.freeze({ op: "DEF", grain: "Ground" });

// The roster, keyed by id. Built once from the same ORGANS array
// `emergence/coverage` reports over — one source of truth, never a second
// hand-list (CUBE.md records what a second hand-list cost eoreader5).
const BY_ID = new Map(ORGANS.map((o) => [o.id, o]));

/** Is this name an organ this engine has earned? */
export const isDeclaredOrgan = (organId) => BY_ID.has(organId);

/** The cell an organ declared, or a typed gap. Never inferred, never guessed. */
export const declaredCell = (organId) => {
  const organ = BY_ID.get(organId);
  if (!organ)
    return gap("undeclared_organ", {
      organ: organId ?? null,
      reason: "not on the roster — an act by an organ this engine has not earned is not in the record",
    });
  return cellOf(organ.op, organ.grain);
};

/**
 * Put an organ's act in the record, under its own name.
 *
 * The roster's convention is already one id per act — `nul/core`, `nul/witness`
 * and `nul/rezero` are three ids for one module, and `emergence/paradigm/def`
 * and `/rec` are two for another. So the match is EXACT: an id claims one
 * cell, and an act at another cell is a different act and needs its own id.
 * Restrictive on purpose, and for the reason `frame.note` is restrictive about
 * extent — a type error before a null (SEED.md #7). An organ that genuinely
 * performs two acts says so in the roster, where `emergence/coverage` can see
 * it, rather than in a runtime argument nothing reports.
 *
 * `act` is `frame.note`'s act — `{ op, grain, ground }` — and everything
 * `note` enforces still applies afterward: firstness, one spec, one extent.
 * This organ adds the name and refuses two things `note` structurally cannot
 * check, then hands the act on unchanged.
 *
 * Returns the new frame, or the first typed gap encountered. Nothing is
 * mutated.
 */
export const declare = (frame, organId, act) => {
  const cell = declaredCell(organId);
  if (isGap(cell)) return cell;
  if (!act || typeof act !== "object")
    return gap("empty_material", { organ: organId, reason: "no act" });
  if (act.op !== cell.op || act.grain !== cell.grain)
    return gap("undeclared_cell", {
      organ: organId,
      claimed: `${act.op}·${act.grain}`,
      declared: `${cell.op}·${cell.grain}`,
      terrain: cell.terrain,
      stance: cell.stance,
      reason: "an organ acting outside the cell it declared is acting as something it is not",
    });
  return note(frame, { ...act, organ: organId });
};

/**
 * Which organs have put an act in this frame, in first-appearance order.
 *
 * A reading's trail is walked, never summed (`frame`), so this counts nothing
 * and ranks nothing. It answers one question — whose acts are in here — which
 * is the question a reader asks of a record before trusting it.
 */
export const declarants = (frame) => {
  if (!frame || !Array.isArray(frame.acts)) return gap("no_ground", { reason: "not a frame" });
  const seen = [];
  for (const a of frame.acts) if (a?.organ && !seen.includes(a.organ)) seen.push(a.organ);
  return Object.freeze(seen);
};

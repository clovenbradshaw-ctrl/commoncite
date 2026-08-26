// eoreader6 · packages/host/tiers — the host face of the interpretation column.
//
// emergence/tiers.js's Atmosphere → Lens → Paradigm stack has had no
// production caller anywhere in this repo (11-terrain-occupancy-and-the-
// two-ascents.md names the gap explicitly, and routes its own planned
// wiring through a different, not-yet-built engine module — this file is a
// separate, host-tier wiring, not a competing claim on that plan).
// host/graph.js already gives a session one running belief graph across
// every document it admits; this wires that same session's tier stack
// alongside it, folded from the SAME admission act's own operator-mix
// delta (emergence/revision.js's decompose/countsOf around the snapshot
// admitGraph's own readTriples call advances), so nothing here re-derives
// triples or re-reads a document a second time.
//
// GENRE-SEEDED, OPTIONALLY. emergence/genre-seed.js seeds the Atmosphere
// tier's cold start from a received corpus prior, when a caller supplies
// one — session.tierSeed records whether that seed actually cleared its
// own readiness gate, never silently. A session given no cluster reads
// exactly as an unseeded tier stack always has: `new Map()`, no shift
// until real material accumulates.
//
// NO NEW CELL. Wraps emergence/tiers.js's own EVA · Figure cell at host
// tier, the same pattern host/graph.js's admitGraph already follows for
// emergence/graph.js's SYN · Pattern.

import { attachGraph, admitGraph } from "./graph.js";
import { snapshot, decompose, countsOf } from "../engine/emergence/revision.js";
import { createTierStack, foldThrough } from "../engine/emergence/tiers.js";
import { seedTier } from "../engine/emergence/genre-seed.js";

// The cell this host organ occupies on the operator grid (engine/operators.js):
// EVA · Figure — the same cell emergence/tiers.js declares; admitTiers is
// that organ's host-tier caller. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Figure" });

const NAMES = ["atmosphere", "lens", "paradigm"];

/**
 * Create (or return) the session's tier stack. `window`/`draws`/`seed` are
 * declared here, once — the session's own starting point, never derived
 * from a document's length. `cluster`/`giver`, when supplied, seed the
 * Atmosphere tier's cold start via genre-seed.js::seedTier; a cluster that
 * fails its own readiness gate is simply not applied — `session.tierSeed`
 * records the refusal rather than falling back to a seed that did not earn
 * its place.
 */
export function attachTiers(session, { window = 12, draws = 200, seed, cluster, giver } = {}) {
  if (session.tiers) return session.tiers;
  if (!Number.isInteger(seed))
    throw new TypeError("attachTiers: seed is declared — the engine holds no randomness, it receives one");
  const tiers = createTierStack(NAMES, { window, draws, seed });
  if (cluster) session.tierSeed = seedTier(tiers[0], cluster, { giver });
  session.tiers = tiers;
  session.tiersAdmitted = new Set();
  return tiers;
}

/**
 * Fold one (or every un-admitted) document's operator-mix delta into the
 * session's tier stack. Reuses `host/graph.js::admitGraph` for the actual
 * read — the same call, the same triples, the same graph — wrapped with a
 * before/after snapshot so `emergence/revision.js::decompose` attributes
 * the delta to the eight measurable operators, folded through
 * `foldThrough` unmodified.
 *
 * Double-admission into the TIER STACK is guarded here via
 * `session.tiersAdmitted`: a document folded once is not folded again just
 * because a caller re-ran `admitTiers` over the same session. This does
 * NOT extend to `admitGraph`'s own graph-level dedup, which remains
 * exactly as documented there — a caller's responsibility, unenforced —
 * so a document already admitted to `session.graph` by a direct
 * `admitGraph` call before `admitTiers` first runs will still be folded
 * into the tier stack once, from whatever delta that admission produced;
 * it is a caller admitting the SAME document to the graph twice (via two
 * direct `admitGraph` calls) that this file inherits, not adds to.
 */
export function admitTiers(session, { sourceId, gamma, pruneBelow, alpha = 1 } = {}) {
  if (!session.tiers)
    throw new TypeError("admitTiers: attachTiers(session, ...) must run first — a tier stack, seeded or not, is declared, never implicit");
  const graph = attachGraph(session, { gamma, pruneBelow });
  const targets = (sourceId ? [sourceId] : Array.from(session.documents.keys())).filter(
    (id) => !session.tiersAdmitted.has(id),
  );

  const results = [];
  for (const id of targets) {
    const before = snapshot(graph);
    const { admitted } = admitGraph(session, { sourceId: id, gamma, pruneBelow, alpha });
    const after = snapshot(graph);
    const counts = countsOf(decompose(before, after));
    const arrival = new Map(Object.entries(counts).filter(([, v]) => v > 0));
    const folded = arrival.size > 0 ? foldThrough(session.tiers, arrival, { alpha }) : null;
    session.tiersAdmitted.add(id);
    results.push({ sourceId: id, admitted: admitted[0], counts, folded });
  }
  return { tiers: session.tiers, admitted: results };
}

// How many of a tier's own shift records a snapshot surfaces — a display
// bound, not a measurement parameter (SEED.md's three declared numbers
// govern what counts as a shift; this only bounds how much of that already-
// decided record a caller renders at once), so it lives here rather than as
// a fourth number threaded through tiers.js itself.
const SNAPSHOT_SHIFTS = 5;

/** A plain-data view of the current tier stack, for serialisation / a UI list. */
export function sessionTiersSnapshot(session) {
  if (!session.tiers) return { seeded: false, tiers: [] };
  return {
    seeded: Boolean(session.tierSeed?.seeded),
    tiers: session.tiers.map((t) => ({
      name: t.name,
      observations: t.observations,
      shifts: t.shifts,
      novelRate: t.novelRate,
      recentShifts: t.shiftRecords.slice(-SNAPSHOT_SHIFTS).reverse(),
    })),
  };
}

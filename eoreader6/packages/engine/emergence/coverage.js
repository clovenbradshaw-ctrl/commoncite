// eoreader6 · engine/emergence/coverage — the instrument's own occupancy
// report: which cells the organs actually occupy, and which are open
// questions. This is MEASURED occupancy, never classification — it reads the
// roster and the algebra, never content. CUBE.md measured the cube as a
// content classifier and refuted it (95.7% of cell assignments survived word
// shuffle); the one runtime use it kept is the dispatch key, and this report
// is that use made visible: every cell is either earned by a declared organ
// or named as a question. An empty cell is a typed gap in the instrument,
// never a guessed terrain.

import { CURRENT_OPERATOR_EPOCH, GRAINS, OPERATORS, ORGANS, OPERATOR_ORDER, cellOf } from "../operators.js";

// The cell this organ occupies: EVA · Atmosphere · Tending at Ground — the
// witness act, aimed at the instrument itself. Declared, checked by
// conformance.
export const CELL = Object.freeze({ op: "EVA", grain: "Ground" });

const cellKey = (op, grain) => `${op}·${grain}`;

/**
 * Which cells the engine's organs earned, and which remain open questions.
 * Every cell of the grid is accounted for exactly once — occupied by the
 * organs that declared it, or listed as an empty question in the algebra's
 * own vocabulary. Deterministic: sorted by OPERATOR_ORDER, then GRAINS.
 */
export const coverageReport = () => {
  const byKey = new Map();
  for (const organ of ORGANS) {
    const cell = cellOf(organ.op, organ.grain);
    const key = cellKey(organ.op, organ.grain);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({
      id: organ.id,
      module: organ.module,
      fn: organ.fn,
      verb: organ.verb,
      what: organ.what,
    });
  }

  const occupied = [];
  const empty = [];
  for (const op of OPERATOR_ORDER) {
    for (const grain of GRAINS) {
      const key = cellKey(op, grain);
      const cell = cellOf(op, grain);
      if (byKey.has(key)) {
        occupied.push({ op, grain, terrain: cell.terrain, stance: cell.stance, organs: byKey.get(key) });
      } else {
        empty.push({ op, grain, terrain: cell.terrain, stance: cell.stance });
      }
    }
  }

  return Object.freeze({
    epoch: CURRENT_OPERATOR_EPOCH,
    grid: Object.freeze({ operators: OPERATOR_ORDER.length, grains: GRAINS.length, cells: OPERATOR_ORDER.length * GRAINS.length }),
    occupied: Object.freeze(occupied.map((c) => Object.freeze({ ...c, organs: Object.freeze(c.organs) }))),
    empty: Object.freeze(empty),
    counts: Object.freeze({ occupied: occupied.length, empty: empty.length, total: occupied.length + empty.length }),
  });
};

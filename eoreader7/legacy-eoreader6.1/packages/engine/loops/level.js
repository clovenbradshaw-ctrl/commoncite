// eoreader6 · loops/level — not time, not grain: LEVEL. Existence (received)
// -> structure (discovered, Born-null-gated) -> significance (asserted,
// revisable), and a SETTLED significance at one level becomes RECEIVED
// existence for the next. One step handles one level; the caller decides
// whether a settled result gets promoted — recursion is explicit, never
// implicit or unbounded.

import { existenceDependencyTest, possibilityConstraintTest, holonLevelRelation } from "../../../holon_level/index.js";
import { difference, isGap } from "../../../nul/index.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// DEF · Lens · Unraveling — settled significance becomes received existence,
// refused before it is granted. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "DEF", grain: "Figure" });

const SETTLED_RANK = 0.9;

// One level: a candidate regime's existence-dependency + possibility-
// constraint (structure), and — if a reader-relative ground is available —
// its significance as a rank against that ground (never a whole-document
// ground; see packages/engine/perceiver/text/material.js::causalSurprisalSeries
// for why that distinction is load-bearing).
export const levelStep = ({ series, regime, readerGround, existenceCount, structureOptions = {} }) => {
  const ex = existenceDependencyTest(series, regime, structureOptions);
  const co = possibilityConstraintTest(series, regime, structureOptions);
  const structure = (isGap(ex) || isGap(co)) ? "unstable" : holonLevelRelation(ex, co);

  let significance = null;
  if (readerGround && !isGap(readerGround)) {
    const window = readerGround.spec?.window ?? Math.max(1, regime.end - regime.start);
    const start = Math.max(0, regime.start);
    let sum = 0, n = 0;
    for (let j = start; j < start + window && j < series.length; j++) { sum += series[j]; n++; }
    const observed = n ? sum / n : null;
    if (observed != null) {
      const d = difference(observed, readerGround);
      significance = isGap(d) ? (d.direction === "above" ? 1.0 : 0.0) : d.rank;
    }
  }

  const settled = structure === "above" && significance != null && significance >= SETTLED_RANK;
  return { existence: existenceCount, structure, significance, settled, regime };
};

// Promotes a settled level-N result into level-(N+1)'s received existence:
// a new admit-event naming exactly what settled it — never a bare boolean,
// never a silently-derived identity. Only called on results levelStep
// already marked settled; promoting an unsettled result is a caller error,
// not something this function guesses its way around.
export const promote = (settledResult, referentId) => {
  if (!settledResult.settled) throw new Error("promote() called on a result that was never settled — nothing to receive");
  return {
    type: "DEF.admit",
    referent_id: `${referentId}:settled`,
    surface: null,
    provenance: {
      giver: "loops/level:settled",
      regime: settledResult.regime,
      structure: settledResult.structure,
      significance: settledResult.significance,
    },
  };
};

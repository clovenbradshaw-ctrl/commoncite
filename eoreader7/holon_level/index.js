// eoreader6 · holon_level — does a regime of one series stand as a level of it?
//
// Two questions, each Born-null-gated, combined by `holonLevelRelation`:
//
//   existence-dependency    remove the regime and the ground moves — the
//                           material cannot be what it is without this stretch
//   possibility-constraint  the regime's values sit measurably apart from the
//                           rest — it constrains what the material can do
//
// THE NULL IS THE SAME ACT AT A RANDOM PLACE, ELSEWHERE.
//
// Each null draw performs exactly the transformation the statistic performed —
// delete a window, or bracket one — at a placement that does NOT overlap the
// regime under test. Three consequences, each the correction of a measured
// failure (the prior null called regimes "existent" on pure iid noise 17/60
// times at a nominal 5% level; conformance/calibration.test.js holds the rate):
//
//   · statistic and null undergo the SAME extent change. The statistic compares
//     a full-extent ground to a deleted-extent ground; so does every null draw.
//     A null over unequal extents smuggles pure growth into the displacement —
//     SEED.md #5, the same artefact `pattern` grows its null to defeat.
//   · nothing is invented. The old null filled the window with zeros — material
//     that is not present, refused by the seed's first principle, and it made
//     the null depend on the material's offset.
//   · the placement actually varies. The old draw called the generator with an
//     argument it ignores and floored the raw uniform, so every "random"
//     placement was position 0.
//
// Non-overlap is what keeps the null from containing the very effect it is the
// null FOR: a placement on top of a singular regime reproduces the regime's own
// displacement and clears it. When the regime leaves no room for a
// non-overlapping window, the null cannot be built and that is a typed gap, not
// a threshold of zero — a null that failed to build clears anything (SEED.md #3).
//
// The three resolutions are declared, never defaulted (SEED.md, "three declared
// numbers"): `draws` and `window` for the grounds, `reseeds` for the placement
// null. The organ used to default all three, quietly opting out of the
// constitution it sits under.

import { ground, isGap, gap, volume } from "../nul/index.js";

const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * A placement for a window of `len` that does not overlap [regime.start,
 * regime.end). Eligible starts are the two flanks; null when there are none.
 */
const placeElsewhere = (seriesLength, regime, len, u) => {
  const leftCount = Math.max(0, regime.start - len + 1);
  const rightCount = Math.max(0, seriesLength - len - regime.end + 1);
  const total = leftCount + rightCount;
  if (total === 0) return null;
  const k = Math.min(total - 1, Math.floor(u * total));
  return k < leftCount ? k : regime.end + (k - leftCount);
};

const percentile95 = (values) =>
  values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)];

const checkArgs = (series, regime, { draws, window, reseeds }, needGrounds) => {
  if (!Array.isArray(series) || series.length < 2) return gap("empty_material", { reason: "series too short" });
  if (!regime || regime.start < 0 || regime.end > series.length || regime.end <= regime.start)
    return gap("empty_material", { reason: "invalid regime range" });
  if (needGrounds && (!Number.isInteger(draws) || draws < 2))
    return gap("undeclared", { what: "draws", why: "the resolution of testimony is 1/draws and is never a default" });
  if (needGrounds && (!Number.isInteger(window) || window < 2))
    return gap("undeclared", { what: "window", why: "the reach of the present is never derived from material length" });
  if (!Number.isInteger(reseeds) || reseeds < 2)
    return gap("undeclared", { what: "reseeds", why: "the resolution of the placement null is never a default" });
  return null;
};

export const existenceDependencyTest = (series, regime, options = {}) => {
  const bad = checkArgs(series, regime, options, true);
  if (bad) return bad;
  const { draws, window, reseeds } = options;

  // Seeds are spaced by `draws`, the kernel's own reseeding convention: a
  // ground built at seed s consumes the stream s..s+draws-1, so adjacent seeds
  // share almost their whole stream and the "independent" draws collapse onto
  // each other — a null of nearly one effective member wearing sixteen's
  // clothes. Measured: adjacent seeds put the iid false-positive rate at
  // 17.5%; spaced seeds return it to nominal.
  const spec = { perturbation: "shuffle", statistic: "burstiness", draws, window };
  const gFull = ground({ material: series, ...spec, seed: 0 });
  if (isGap(gFull)) return gFull;

  const degraded = [...series.slice(0, regime.start), ...series.slice(regime.end)];
  if (degraded.length < 2) return gap("empty_material", { reason: "regime covers too much of series" });
  const gDegraded = ground({ material: degraded, ...spec, seed: draws });
  if (isGap(gDegraded)) return gDegraded;
  const actualDisp = Math.abs(volume(gFull) - volume(gDegraded));

  const len = regime.end - regime.start;
  const displacements = [];
  for (let r = 0; r < reseeds; r++) {
    const start = placeElsewhere(series.length, regime, len, prng(r + 999)());
    if (start === null) break;
    const cut = [...series.slice(0, start), ...series.slice(start + len)];
    const gCut = ground({ material: cut, ...spec, seed: (2 + r) * draws });
    if (isGap(gCut)) continue;
    displacements.push(Math.abs(volume(gFull) - volume(gCut)));
  }
  if (displacements.length < 2)
    return gap("degenerate_ground", {
      reason: "the placement null could not be built — no non-overlapping window, or every placement gapped; a null of zero width would clear anything",
      built: displacements.length,
      reseeds,
    });

  const null95 = percentile95(displacements);
  return Object.freeze({
    exists: actualDisp > null95,
    statistic: actualDisp,
    nullThreshold: null95,
    fullVolume: volume(gFull),
    degradedVolume: volume(gDegraded),
    regime,
  });
};

export const possibilityConstraintTest = (series, regime, options = {}) => {
  const bad = checkArgs(series, regime, options, false);
  if (bad) return bad;
  const { reseeds } = options;

  const inside = series.slice(regime.start, regime.end);
  if (inside.length < 2) return gap("empty_material", { reason: "regime too small" });
  const outside = [...series.slice(0, regime.start), ...series.slice(regime.end)];
  if (outside.length < 2) return gap("empty_material", { reason: "no outside data" });

  const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const insideMean = mean(inside);
  const outsideMean = mean(outside);
  const actualShift = Math.abs(insideMean - outsideMean);

  // The null draw brackets a random non-overlapping window of the same length
  // and asks the SAME question of it: its inside against its outside. The old
  // null held the tested regime as "inside" on every draw and only wiggled
  // what "outside" excluded, so the null never varied along the axis the
  // statistic measures.
  const len = regime.end - regime.start;
  const shifts = [];
  for (let r = 0; r < reseeds; r++) {
    const start = placeElsewhere(series.length, regime, len, prng(r + 8888)());
    if (start === null) break;
    const win = series.slice(start, start + len);
    const rest = [...series.slice(0, start), ...series.slice(start + len)];
    if (rest.length < 2) continue;
    shifts.push(Math.abs(mean(win) - mean(rest)));
  }
  if (shifts.length < 2)
    return gap("degenerate_ground", {
      reason: "the placement null could not be built — no non-overlapping window of the regime's length",
      built: shifts.length,
      reseeds,
    });

  const null95 = percentile95(shifts);
  return Object.freeze({
    constrains: actualShift > null95,
    insideMean,
    outsideMean,
    shift: actualShift,
    nullThreshold: null95,
    regime,
  });
};

export const holonLevelRelation = (existence, constraint) => {
  if (isGap(existence) || isGap(constraint)) return "unstable";
  const e = existence.exists;
  const c = constraint.constrains;
  if (e && c) return "above";
  if (!e && !c) return "peer";
  return "unstable";
};

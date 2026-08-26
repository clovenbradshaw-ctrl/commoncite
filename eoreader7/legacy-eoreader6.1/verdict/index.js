import { difference, admissible, isGap, gap, reZero, cites } from "../nul/index.js";

const CONTESTED_THRESHOLD = 0.1;

const rankVerdict = (observed, g) => {
  const fig = difference(observed, g);
  if (isGap(fig)) {
    if (fig.gap === "exceeds_witness") return { verdict: "contested", ...fig };
    return { verdict: "void", ...fig };
  }
  if (fig.rank < CONTESTED_THRESHOLD || fig.rank > 1 - CONTESTED_THRESHOLD) {
    return { verdict: "contested", ...fig };
  }
  return { verdict: "supported", ...fig };
};

// Replay reconstructs a ground from its retained spec, never from kept
// samples — so stability needs the MATERIAL back. For as long as this passed
// `material: null` down to reZero, every reseed gapped, `stable` was false on
// every path, and "settled" was a verdict the module named but could not
// reach.
const checkStability = (observed, g, reseeds, material) => {
  const spec = g.spec;
  if (!spec) return false;
  for (let r = 1; r <= reseeds; r++) {
    const reseeded = reZero(g, { material, seed: spec.seed + r * spec.draws });
    if (isGap(reseeded)) return false;
    if (rankVerdict(observed, reseeded).verdict !== "supported") return false;
  }
  return true;
};

/**
 * options.reseeds > 0 asks for the stability check, and the check needs
 * `options.material` — the material the ground cites, so reseeds can rebuild
 * it. Asking for stability without material is answerable only as "supported,
 * stability unchecked" (the null is optional here for the same reason it is in
 * `level()`: a ground stores a fingerprint, not its material). Material that
 * is not what the ground cites is a type error, not a weaker check.
 */
export const verdict = (observed, g, options = {}) => {
  const { plural = [], reseeds = 0, material = null, spec } = options;
  const bad = admissible(g);
  if (bad && isGap(bad)) return { verdict: "void", ...bad };

  const v = rankVerdict(observed, g);
  if (v.verdict === "void") return v;

  if (plural.length > 0) {
    const all = [g, ...plural];
    const types = all.map((pg) => rankVerdict(observed, pg).verdict);
    const unique = new Set(types);
    if (unique.size > 1) {
      return Object.freeze({ verdict: "thrash", constituents: types, ground: g.spec ?? g.provenance });
    }
  }

  if (reseeds > 0 && v.verdict === "supported" && material != null) {
    if (!cites(g, material))
      return {
        verdict: "void",
        ...gap("unreceived_origin", {
          reason: "stability must reseed over the material this ground cites — the material handed in is not it",
        }),
      };
    if (checkStability(observed, g, reseeds, material)) {
      return Object.freeze({
        verdict: "settled",
        spec: spec ?? g.spec ?? null,
        rank: v.rank,
        observed: v.observed,
        support: v.support,
        volume: v.volume,
      });
    }
  }

  return Object.freeze({ verdict: v.verdict, rank: v.rank, observed: v.observed, support: v.support, volume: v.volume });
};

export { CONTESTED_THRESHOLD };

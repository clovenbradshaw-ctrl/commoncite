// EOReader 7 native cube algebra.
//
// This is intentionally smaller than the historical engine/operators.js.
// The kernel needs only the closed EO algebra. App verbs, organ routing,
// and historical registries remain compatibility concerns.

export const MODES = Object.freeze(["Differentiate", "Relate", "Generate"]);
export const DOMAINS = Object.freeze(["Existence", "Structure", "Interpretation"]);
export const GRAINS = Object.freeze(["Ground", "Figure", "Pattern"]);

const OP_MODE = Object.freeze({
  NUL: "Differentiate",
  SIG: "Relate",
  INS: "Generate",
  SEG: "Differentiate",
  CON: "Relate",
  SYN: "Generate",
  DEF: "Differentiate",
  EVA: "Relate",
  REC: "Generate",
});

const OP_DOMAIN = Object.freeze({
  NUL: "Existence",
  SIG: "Existence",
  INS: "Existence",
  SEG: "Structure",
  CON: "Structure",
  SYN: "Structure",
  DEF: "Interpretation",
  EVA: "Interpretation",
  REC: "Interpretation",
});

export const TERRAIN_BY_DOMAIN = Object.freeze({
  Existence: Object.freeze({ Ground: "Void", Figure: "Entity", Pattern: "Kind" }),
  Structure: Object.freeze({ Ground: "Field", Figure: "Link", Pattern: "Network" }),
  Interpretation: Object.freeze({ Ground: "Atmosphere", Figure: "Lens", Pattern: "Paradigm" }),
});

export const STANCE_BY_MODE = Object.freeze({
  Differentiate: Object.freeze({ Ground: "Clearing", Figure: "Dissecting", Pattern: "Unraveling" }),
  Relate: Object.freeze({ Ground: "Tending", Figure: "Binding", Pattern: "Tracing" }),
  Generate: Object.freeze({ Ground: "Cultivating", Figure: "Making", Pattern: "Composing" }),
});

const gap = (type, detail = {}) => Object.freeze({ gap: type, ...detail });

export const cellOf = (op, grain) => {
  if (!OP_MODE[op]) return gap("unknown_spec", { reason: `no such operator: ${op}`, known: Object.keys(OP_MODE) });
  if (!GRAINS.includes(grain)) return gap("unknown_spec", { reason: `no such grain: ${grain}`, known: GRAINS });
  const mode = OP_MODE[op];
  const domain = OP_DOMAIN[op];
  return Object.freeze({ op, grain, mode, domain, terrain: TERRAIN_BY_DOMAIN[domain][grain], stance: STANCE_BY_MODE[mode][grain] });
};

// Algebra enumeration groups by operator. This is useful for validating the
// closed operator×grain algebra, but recursive interrogation uses a different,
// semantically meaningful traversal order exposed as cubeAddresses().
export const algebraAddresses = () => Object.freeze(
  Object.keys(OP_MODE).flatMap((op) => GRAINS.map((grain) => cellOf(op, grain))),
);

// eoreader6 · formula-thrift-check — does a (concept, slot) → formula
// correspondence carry information a causal reader can detect, or does
// repetition alone explain the cheapness of formulaic text?
//
//   DEF · Lens · Unraveling
//
// specs/composition-is-retrieval.md §5 proposes a UID-style verification for
// a formula system, with a specific null: shuffle WHICH formula fills WHICH
// slot, holding the total formula/content word-count split fixed. This
// script asks the prior question that has to be answered before that check
// is trusted with anything real: DOES THAT NULL HAVE POWER? A statistic that
// cannot tell a genuine thrift system from a scrambled one is not a gate,
// per the standing admission criterion (specs/surf-and-fold.md).
//
// This is deliberately NOT "is repeated text cheap" — that is true of any
// causal n-gram model by construction and would be an uninteresting result.
// The REAL and SHUFFLED conditions below use the EXACT SAME multiset of
// formula tokens at the EXACT SAME positions — only the ASSIGNMENT of which
// formula follows which concept's mention is permuted. So any cost
// difference measured is attributable to the CORRESPONDENCE, never to
// repetition, vocabulary, or position alone.
//
// Usage: node scripts/formula-thrift-check.mjs [--draws N] [--seed N]

import { createLayer } from "../packages/engine/generation/belief.js";

const ORDER = 4;
const ALPHA = 0.7;
const GAMMA = 1;
const MENTIONS_PER_CONCEPT = 30;
const DRAWS = 200;
const SEED = 20260801;

const args = process.argv.slice(2);
const flagNum = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
};
const draws = flagNum("draws", DRAWS);
const seed = flagNum("seed", SEED);

const mulberry = (s) => {
  let a = s + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const CONCEPTS = ["aldric", "ysolde"];
// Two formulas, one per concept — Parry's thrift as a concrete tiny system.
const FORMULAS = {
  aldric: "the iron willed one",
  ysolde: "the star eyed one",
};
// Varied content, so a formula position sits inside realistic surrounding
// text rather than a bare repeated string with nothing else in play.
const CONTENT = [
  "walked to the river and considered what must be done before dawn",
  "argued fiercely against the council and would not be moved from it",
  "remembered the years before the war and said nothing more that night",
  "climbed the tower stairs slowly and looked out over the empty fields",
  "gathered the scattered maps and traced the old road toward the coast",
  "sat by the dying fire and turned the letter over without reading it",
  "called for the horses at first light and rode out before the rain",
  "listened at the door and heard nothing but the wind in the rafters",
];

const rand = mulberry(seed);
const shuffle = (arr, rng) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Build the mention SEQUENCE (which concept, in what order) and its content
// once — shared between REAL and SHUFFLED so nothing but the formula
// assignment differs.
const buildMentions = () => {
  const mentions = [];
  for (const c of CONCEPTS) for (let i = 0; i < MENTIONS_PER_CONCEPT; i++) mentions.push({ concept: c, content: CONTENT[(i + CONCEPTS.indexOf(c) * 3) % CONTENT.length] });
  return shuffle(mentions, mulberry(seed + 1));
};

const MENTIONS = buildMentions();
// The exact multiset of formula tokens to place — length-matched, so a
// shuffle only reassigns WHICH slot gets WHICH formula, never how many of
// each exist overall.
const FORMULA_ASSIGNMENT_REAL = MENTIONS.map((m) => FORMULAS[m.concept]);

const tok = (s) => s.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Render mentions into one token stream, given a formula assignment (an
 * array parallel to MENTIONS). Returns { forms, formulaSpans } where each
 * span is the [start, end) token range the assigned formula occupies.
 */
const render = (formulaAssignment) => {
  const forms = [];
  const formulaSpans = [];
  for (let i = 0; i < MENTIONS.length; i++) {
    const m = MENTIONS[i];
    forms.push(...tok(m.concept));
    const start = forms.length;
    forms.push(...tok(formulaAssignment[i]));
    formulaSpans.push([start, forms.length]);
    forms.push(...tok(m.content));
    forms.push(".");
  }
  return { forms, formulaSpans };
};

/** Causal cost at every position, and the mean over the declared formula spans. */
const costAtFormulas = ({ forms, formulaSpans }) => {
  const layer = createLayer({ id: "read", tier: "read", order: ORDER, gamma: GAMMA, alpha: ALPHA });
  const cost = new Float64Array(forms.length);
  for (let i = 0; i < forms.length; i++) {
    const ctx = forms.slice(Math.max(0, i - ORDER), i);
    const { mass, reserve } = layer.massOf(ctx, forms[i]);
    cost[i] = -Math.log(mass > 0 ? mass : reserve);
    layer.observe(forms, i);
  }
  let sum = 0, n = 0;
  for (const [s, e] of formulaSpans) for (let i = s; i < e; i++) { sum += cost[i]; n++; }
  return sum / n;
};

console.log(`\n=== formula-thrift-check · ${MENTIONS.length} mentions, draws=${draws}, seed=${seed} ===\n`);

const real = render(FORMULA_ASSIGNMENT_REAL);
const realCost = costAtFormulas(real);
console.log(`REAL correspondence (concept -> its own formula, always):  mean cost at formula tokens = ${realCost.toFixed(4)}`);

// Rank convention matches seam-cost.mjs: the fraction of NULL draws at or
// below the real value. Low rank = real sits at the cheap extreme of the
// null distribution = censored below = the correspondence is doing work.
const nullRand = mulberry(seed + 2);
const nullCosts = [];
let below = 0;
for (let d = 0; d < draws; d++) {
  const shuffled = shuffle(FORMULA_ASSIGNMENT_REAL, nullRand);
  const doc = render(shuffled);
  const c = costAtFormulas(doc);
  nullCosts.push(c);
  if (c <= realCost) below++;
}
const nullMean = nullCosts.reduce((a, b) => a + b, 0) / nullCosts.length;
const rank = below / draws;

console.log(`SHUFFLED correspondence (same formulas, same slots, wrong pairing): null mean = ${nullMean.toFixed(4)}`);
console.log(`rank of REAL vs null: ${rank.toFixed(3)}  (0 = cheaper than every shuffle draw, 0.5 = indistinguishable)`);
console.log("");

if (rank <= 1 / draws) {
  console.log("CENSORED BELOW. The correspondence itself is what an order-4 causal reader");
  console.log("exploits — cost at formula tokens is lower under the real (concept -> formula)");
  console.log("pairing than under EVERY shuffle of that pairing, at fixed vocabulary and fixed");
  console.log("formula/content split. This is not 'repeated text is cheap' (both conditions");
  console.log("repeat the same tokens equally often) — it is evidence the null in");
  console.log("specs/composition-is-retrieval.md §5 has real power at this scale.");
} else {
  console.log("UNINFORMATIVE OR WORSE. The correspondence null does not separate here either —");
  console.log("read this before trusting §5's acceptance criterion #4 on anything real.");
}
console.log("");

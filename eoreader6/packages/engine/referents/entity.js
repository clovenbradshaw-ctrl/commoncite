// eoreader6 · referents/entity — THE EXISTENCE · FIGURE COLUMN.
//
// The registry (engine/operators.js) had four empty cells where a being should
// be, and the emptiness was load-bearing rather than incidental:
//
//   NUL · Figure   Entity · Dissecting    the nothing a being is seen against
//   SIG · Figure   Entity · Binding       is this being here, now
//   INS · Figure   Entity · Making        a being comes into existence
//   REC · Figure   Entity · Making        the register the next turn receives
//
// Everything Figure-grained that existed was CON · Figure — `referents/index`,
// `emergence/activation`, `perceiver/text/relations` — the LINKS BETWEEN
// entities that nothing had created. `referents/index::projectReferents` folds
// DEF.admit events, and the only generator of those events was
// `perceiver/text/admit::admitFromPrior`: a received prior. So a being could
// enter this engine only if a human had already named it. `referents/blind`'s
// own header states the objection: "If real existence-detection can only run
// when a human has already curated a prior, it isn't sensing, it's being
// handed the answer."
//
// THE ONE RULE THAT SHAPES EVERY FUNCTION HERE: this reads left to right.
// State carries only what has arrived. No frequency table over the whole
// document, no occupancy over an arena that includes unread pages, no
// second pass. `loops/turn.js` says of ③ INS that it "makes the read a READING
// rather than an analysis of a finished object" — that is the operator this
// column hangs from, and a batch implementation of it is not a slower reader,
// it is a different thing wearing the name.
//
// A BEING IS NOT A STRING. Surfaces are scoped evidence; identity lives in the
// referent (the nameless-referent principle). Nothing here compares spellings.
// Binding surfaces that point at one being is CON · Pattern and lives in
// ./consequence.js — identity by consequence, never by appearance.

import { ground, difference, pattern, keep, witness, isGap, gap, volume, admissible } from "../../../nul/index.js";

// The four cells this column claims — declared, checked by conformance
// against operators.js's own algebra (never the reverse).
export const CELLS = Object.freeze([
  { op: "NUL", grain: "Figure" },
  { op: "SIG", grain: "Figure" },
  { op: "INS", grain: "Figure" },
  { op: "REC", grain: "Figure" },
]);

// ── the reading's state ──────────────────────────────────────────────────────

/**
 * Nothing here is a default. `window` is the reach of the present, `draws` the
 * resolution of testimony, `reseeds` the resolution of pattern — SEED.md's
 * three declared numbers. The extent of the material is not among them: it
 * arrives with whoever hands the material in, and this reader never asks.
 */
export const openReading = ({ window, draws, reseeds, minArrivals }) => {
  if (!Number.isInteger(window) || window < 2) return gap("undeclared", { what: "window", why: "the reach of the present is never derived from material length" });
  if (!Number.isInteger(draws) || draws < 2) return gap("undeclared", { what: "draws", why: "the resolution of testimony is 1/draws and is never a default" });
  if (!Number.isInteger(reseeds) || reseeds < 2) return gap("undeclared", { what: "reseeds", why: "the resolution of pattern is never a default" });
  if (!Number.isInteger(minArrivals) || minArrivals < 2)
    return gap("undeclared", { what: "minArrivals", why: "a being seen once has no pattern; how many arrivals make one is declared, never assumed" });

  return {
    spec: { window, draws, reseeds, minArrivals },
    unit: 0,              // reach-units elapsed — the reader's own clock, not wall time
    series: [],           // ③ INS · Ground: the material as it has come into being
    lexicon: new Map(),   // causal frequency table — only what has been read
    atoms: 0,
    arrivals: new Map(),  // surface -> [unit, …] the units it has been seen in
    entities: new Map(),  // surface -> admitted Entity record
    refused: new Map(),   // surface -> why this candidate was refused (a gap is a result)
    // A ground over a PREFIX of the reading is a pure function of (prefix
    // length, draws, window, seed) — it does not depend on which being is
    // being asked about. Thousands of candidates share a few hundred distinct
    // prefixes, so this is memoisation of a pure function, not a cache of a
    // judgement. Without it the birth condition is ~2.4e9 operations on a
    // 690 KB book and the reader is unrunnable rather than merely slow.
    prefixGrounds: new Map(),
  };
};

const groundUpTo = (state, end, seed) => {
  const key = `${end}:${seed}`;
  if (state.prefixGrounds.has(key)) return state.prefixGrounds.get(key);
  const g = ground({ material: state.series.slice(0, end), draws: state.spec.draws, window: state.spec.window, seed });
  state.prefixGrounds.set(key, g);
  return g;
};

// ── ③ INS · Ground — material comes into being ───────────────────────────────

/**
 * One reach-unit of material arrives. Surprisal is scored against the lexicon
 * AS IT STANDS BEFORE this unit is folded in, which is the whole causal claim:
 * a word is surprising because of what the reader has read, not because of what
 * the document will later contain. Folding first and scoring after is the
 * single most common way a "causal" reader silently stops being one.
 */
export const arrive = (state, atoms) => {
  if (!atoms.length) return state;

  let bits = 0;
  for (const a of atoms) {
    const seen = state.lexicon.get(a) ?? 0;
    // An unseen atom is maximally surprising against what has been read, and
    // its surprisal is bounded by the reading's own size — never by a constant.
    bits += -Math.log2((seen + 1) / (state.atoms + 2));
  }
  state.series.push(bits / atoms.length);

  for (const a of atoms) state.lexicon.set(a, (state.lexicon.get(a) ?? 0) + 1);
  state.atoms += atoms.length;
  state.unit += 1;
  return state;
};

/** Record that a candidate surface was present in the unit just read. */
export const witnessArrival = (state, surface) => {
  const at = state.unit - 1;
  const seen = state.arrivals.get(surface);
  if (!seen) state.arrivals.set(surface, [at]);
  else if (seen[seen.length - 1] !== at) seen.push(at);
  return state;
};

// ── ① NUL · Figure — the nothing a being is seen against ─────────────────────

/**
 * A being's ground is CONDITIONAL ON ITS OWN EXTENT. The null is the same
 * number of reach-units this being has occupied, placed elsewhere in what has
 * been read. So a being present in 6 units is judged against 6-unit masks and
 * one present in 400 against 400-unit masks, and no threshold is ever shared
 * between a rare being and a common one.
 *
 * That conditioning is not a refinement, it is the difference between a ground
 * and a units change. SEED.md #3 refuses a null of zero width everywhere, and
 * eoreader5's memory-golden notes record an unconditional null calibrating at
 * r = 1.000 — perfectly correlated with the thing it was meant to control for.
 */
// Arrivals-first, so `referents/consequence.js` (CON · Pattern) can ask the
// same question of a UNION of two surfaces' arrivals without going through a
// surface lookup — identity by consequence, never by a shared name.
export const clearVoidOverArrivals = (state, at) => {
  const n = state.series.length;
  if (!at || at.length < 2) return gap("empty_material", { reason: "a being needs at least two arrivals to have an extent" });
  const k = at.length;
  // Type error before null (SEED.md #7): a mask with no outside cannot differ
  // from one, and there is nothing to measure rather than something to refuse.
  if (k >= n - 1) return gap("empty_material", { reason: "mask covers the reading; no outside to differ from", extent: k, read: n });

  const meanAt = (idx) => {
    let s = 0;
    for (const i of idx) s += state.series[i];
    return s / idx.length;
  };

  let seed = 1013904223 ^ k;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const samples = [];
  const idx = state.series.map((_, i) => i);
  for (let d = 0; d < state.spec.draws; d++) {
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(next() * (idx.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    samples.push(meanAt(idx.slice(0, k)));
  }
  samples.sort((a, b) => a - b);
  return { samples, draws: state.spec.draws, window: state.spec.window, extent: k, observed: meanAt(at) };
};

export const clearEntityVoid = (state, surface) => clearVoidOverArrivals(state, state.arrivals.get(surface));

// ── ② SIG · Figure — is this being here, and is its ground fit to see against ─

/**
 * Presence, and the room left to be surprised in. Aperture is the interquartile
 * volume of the being's ground — never a gate, the warmth you check for.
 * A ground of zero width would clear anything put in front of it.
 */
export const senseEntity = (g) => {
  if (isGap(g)) return { viable: false, reason: g };
  const room = volume(g);
  if (!(room > 0)) return { viable: false, reason: gap("empty_material", { reason: "ground of zero width" }) };
  return { viable: true, aperture: room, extent: g.extent };
};

// ── ⑦ DEF · Figure — where the being's ground fails ──────────────────────────

/**
 * Both censorings are findings, and which one carries beinghood is MEASURED,
 * not assumed. Measured on `fi-11940` (Seitsemän veljestä, seven brothers,
 * a closed cast): the brothers come back censored BELOW — a named character's
 * stretches read as LESS surprising than the reading's average, because scenes
 * dense with a named person are dialogue and action, carried on high-frequency
 * vocabulary, while the rare words live in description.
 *
 * The first draft of this assumed `above` and returned function words. Amendment
 * II is the standing correction: censored below is a measurement, not only a
 * hazard, and an organ may be built on either direction.
 */
export const defOnEntity = (g) => {
  const lo = g.samples[0];
  const hi = g.samples[g.samples.length - 1];
  if (g.observed < lo) return { censored: "below", direction: "regular", observed: g.observed };
  if (g.observed > hi) return { censored: "above", direction: "surfeit", observed: g.observed };
  const below = g.samples.filter((s) => s < g.observed).length;
  return { censored: null, rank: below / g.draws, observed: g.observed };
};

// ── ③ INS · Figure — a being comes into existence ────────────────────────────

/**
 * THE WITNESS GATE IS THE BIRTH CONDITION, and this is the part that makes an
 * Entity different from a candidate that merely scored well.
 *
 * SEED.md: all three terms or it is not a record. `witness` refuses a figure
 * whose pattern did not move the ground — "a difference that made no difference
 * is not information, so it is not testimony either." Applied to a being, that
 * reads: a surface that marks distinctive territory ONCE is an event, not a
 * being. A being goes on making its difference.
 *
 * So the pattern term is the being's own recurrence of consequence: split its
 * arrivals into the first half and the second half of the reading of them, build
 * a ground from each, and ask `pattern()` whether the second sits further from
 * the first than reseeding the first alone would put it. A one-scene surface
 * has no second half to answer with. A character does, and answers the same way
 * twice.
 *
 * Refusals are recorded, never dropped. A gap is a result.
 *
 * Arrivals-first (like `clearVoidOverArrivals`): the birth condition asks
 * nothing about a surface's name, only about the shape its arrivals make.
 * `referents/consequence.js` calls this directly with a UNION of two
 * surfaces' arrivals — if the union clears the same gate a single surface
 * must, the two are one being's consequence, never a name comparison.
 */
export const admitFromArrivals = (state, at) => {
  if (!at || at.length < state.spec.minArrivals)
    return { admitted: false, why: gap("empty_material", { reason: "too few arrivals to carry a pattern", arrivals: at?.length ?? 0 }) };

  const g = clearVoidOverArrivals(state, at);             // ① NUL · Figure
  if (isGap(g)) return { admitted: false, why: g };
  const sensed = senseEntity(g);                          // ② SIG · Figure
  if (!sensed.viable) return { admitted: false, why: sensed.reason };

  const d = defOnEntity(g);                               // ⑦ DEF · Figure
  if (!d.censored) return { admitted: false, why: gap("empty_material", { reason: "ground held; this surface marks no territory of its own", rank: d.rank }) };

  // The pattern term: does the consequence RECUR?
  const half = Math.floor(at.length / 2);
  if (half < 2) return { admitted: false, why: gap("empty_material", { reason: "not enough arrivals to split; no second half to answer with" }) };
  const early = at.slice(0, half);
  const late = at.slice(half);
  const meanAt = (idx) => idx.reduce((s, i) => s + state.series[i], 0) / idx.length;
  const readSoFar = state.series.slice(0, (late[late.length - 1] ?? 0) + 1);

  const gEarly = groundUpTo(state, (early[early.length - 1] ?? 0) + 1, 3);
  const gLate = groundUpTo(state, readSoFar.length, 3);
  if (isGap(gEarly) || isGap(gLate)) return { admitted: false, why: isGap(gEarly) ? gEarly : gLate };
  if (admissible(gEarly) || admissible(gLate)) return { admitted: false, why: gap("empty_material", { reason: "ground inadmissible over this being's span" }) };

  const p = pattern({ before: gEarly, after: gLate, material: readSoFar.slice(0, (early[early.length - 1] ?? 0) + 1), reseeds: state.spec.reseeds });
  if (isGap(p)) return { admitted: false, why: p };

  // FIXED — this block previously re-zeroed `gEarly` PRIVATELY, inside one
  // candidate's own birth condition, when its figure exceeded witness. The
  // constitution's assay refuted that mechanism on record
  // (eo-constitution/claims/candidate-local-rezero.claim.json, II.7 — the
  // convergence test): it was added to rescue exactly one miss (Eero, the
  // seventh Jukola brother) and reported as a recall gain before it was ever
  // separated from a second change made in the same edit. A re-zero everywhere
  // else in this engine is AMBIENT and SHARED — REC ends a region and every
  // being in play reads the new ground together (`loops/turn.js`). A ground
  // rebuilt for one candidate, unshared, discarded after the question, is not
  // that. E. coli re-zeros one baseline for the whole cell, not one per ligand.
  //
  // What replaces it is not a mechanism at all: `exceeds_witness` already IS
  // SEED.md #8's censored difference — magnitude reportable, place not — and
  // reporting it plainly, with no retry, is the honest end state. A being whose
  // late-half activity outruns the ground its early half built is admitted
  // carrying that censoring, not silently dropped and not rescued by a one-off.
  let figure = difference(meanAt(late), gEarly);
  const censoredRank = isGap(figure) && figure.gap === "exceeds_witness";
  if (censoredRank) figure = { censored: figure.direction, observed: meanAt(late), support: figure.support };
  if (isGap(figure)) return { admitted: false, why: figure };

  const record = witness({ ground: keep(gEarly), figure, pattern: p });
  if (isGap(record)) return { admitted: false, why: record };

  return {
    admitted: true,
    birth: Object.freeze({
      arrivals: at.slice(),
      extent: g.extent,
      censored: d.censored,
      aperture: sensed.aperture,
      bornAt: state.unit,
      moved: p.moved,
      censoredRank,    // magnitude reportable, place not — never filled with a guess
    }),
  };
};

export const admitEntity = (state, surface) => {
  const result = admitFromArrivals(state, state.arrivals.get(surface));
  if (!result.admitted) return result;
  const entity = Object.freeze({
    // The surface is EVIDENCE, scoped to this reading — not the identity. The
    // id is positional so that nothing downstream can be tempted to compare
    // beings by comparing their names.
    id: `e${state.entities.size}`,
    surfaces: [surface],
    ...result.birth,
  });
  state.entities.set(surface, entity);
  return { admitted: true, entity };
};

// ── ⑨ REC · Figure — the register the next turn receives ─────────────────────

/**
 * What turn 2 receives as its existence tier, IN BIRTH ORDER.
 *
 * It is deliberately unranked, and both obvious keys are refused:
 *
 *   by count   — frequency is not significance; that is how a reader ends up
 *                calling the commonest word the protagonist.
 *   by aperture  — SEED.md is explicit that aperture is "never a gate, never a
 *                score: the warmth you check for." Sorting by it was measured
 *                here and is actively misleading: on `fi-11940` the top of an
 *                aperture-ranked register was entirely candidates sitting at
 *                exactly `minArrivals`, because a small extent gives a wide
 *                interquartile ground. Ranking by aperture ranks by rarity.
 *
 * Birth order is the one ordering a causal reader actually has. Anything that
 * wants a ranking must earn it from a ground, downstream, and say so.
 */
export const carryEntities = (state) =>
  [...state.entities.values()].sort((a, b) => a.bornAt - b.bornAt);

/** Every candidate the reader refused, and why. A gap is a result. */
export const refusals = (state) => [...state.refused.entries()].map(([surface, why]) => ({ surface, why: why.gap ?? why }));

/**
 * Sweep: offer every candidate that has arrived often enough to the birth
 * condition. Called at the reader's own tempo, never on wall time — a "tick"
 * is signal-from-noise local to this holon (CLAUDE.md #3).
 */
export const offerCandidates = (state) => {
  let born = 0;
  for (const [surface, at] of state.arrivals) {
    if (state.entities.has(surface)) continue;
    if (at.length < state.spec.minArrivals) continue;
    const r = admitEntity(state, surface);
    // Candidates are offered repeatedly as the reading grows, so a surface
    // refused early can be born later. Leaving the stale refusal on the books
    // made `refusals()` report beings that exist as though they had been turned
    // away.
    if (r.admitted) { born++; state.refused.delete(surface); }
    else state.refused.set(surface, r.why);
  }
  return born;
};

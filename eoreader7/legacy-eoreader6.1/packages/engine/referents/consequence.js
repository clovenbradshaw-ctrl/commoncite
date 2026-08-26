// eoreader6 · referents/consequence — CON · Pattern: binding surfaces that
// point at one being.
//
// entity.js admits a being from ONE surface's arrivals. But a real being
// often shows up under several surfaces the driver never told the engine
// were the same thing: Finnish inflects a name across 15 cases (Juhani /
// Juhanin / Juhania …), Chinese alternates given-name-only and full-name
// forms (寶玉 / 賈寶玉), Greek declines (Αχιλλέα / Αχιλλέως). Two of those
// surfaces are the same being or they are not — and THE NAMELESS-REFERENT
// PRINCIPLE means that question is never answered by comparing the strings.
// No stem table, no edit distance, no transliteration. Not even here.
//
// MEASURED AND REFUSED: the first design asked "does the UNION of two
// surfaces' arrivals clear the same birth condition (admitFromArrivals) a
// single surface must clear?" On the Finnish cast fixture this produced a
// false positive — two DIFFERENT admitted brothers' arrival-halves (Juhani,
// Tuomas), pooled, cleared the birth condition as readily as one brother's
// own two halves did. A dense, recurring surface merged with almost any
// other dense, recurring surface still "looks censored" — the birth
// condition tests for SIGNIFICANCE, not IDENTITY, and the two are not the
// same question. That design is not carried forward.
//
// WHAT IS MEASURED INSTEAD, modelled on holon_level/index.js's own two-gate,
// Born-null shape (existence-dependency + possibility-constraint →
// above/peer/unstable; holon_level cannot be called directly here — it
// requires a contiguous {start,end} regime and these are scattered arrival
// sets, the same reason emergence/kinds.js re-earned its own pair instead of
// reusing it):
//
//   segregation   — are surfaceA's and surfaceB's arrivals concentrated in
//                    DIFFERENT stretches of the reading, more than a random
//                    same-size split of their pooled positions would be?
//   displacement  — does surfaceB's specific evidence disturb surfaceA's own
//                    ground more than an arbitrary same-size ADDITION drawn
//                    from elsewhere in the reading would?
//
// Both real (segregated AND disturbed) → the two occupy different narrative
// territory: DISTINCT beings, refuted as one. Neither real → the evidence
// does not distinguish them: CONSISTENT with one being — never asserted
// proven, because refuting is this codebase's only mode of confidence
// (EVA: "speak only of what changed the ground"). Mixed evidence, or either
// gate ungrounded, is UNSTABLE — the honest middle, never forced either way.
//
// MEASURED LIMIT, recorded rather than hidden: on Seitsemän veljestä (an
// ensemble cast that is on-page together for nearly the whole book) the
// segregation gate has weak power — different brothers' positions are not
// strongly separated because the brothers are rarely apart. The mechanism
// still gets the DIRECTION right (same-being splits score far closer to
// their null than cross-being splits do) but reaching "distinct" on this
// specific fixture is a high bar. A text with genuinely separated character
// arcs would give the gates more to work with; this fixture mainly proves
// the "consistent" side honestly, not the "distinct" side.

import { gap, isGap } from "../../../nul/index.js";
import { clearVoidOverArrivals } from "./entity.js";

// The one cell this organ occupies — declared, checked by conformance.
export const CELL = Object.freeze({ op: "CON", grain: "Pattern" });

const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;

const lcg = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

const shuffleSplit = (pool, sizeA, rand) => {
  const idx = pool.map((_, i) => i);
  for (let i = 0; i < sizeA; i++) {
    const j = i + Math.floor(rand() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return [idx.slice(0, sizeA).map((i) => pool[i]), idx.slice(sizeA).map((i) => pool[i])];
};

/**
 * Are surfaceA's and surfaceB's arrivals concentrated in different stretches
 * of the reading? Observed: |mean position of A − mean position of B|. Null:
 * that same statistic under many random same-size splits of the pooled
 * positions — the exchangeable-surfaces hypothesis made concrete. Threshold
 * is the null's own 95th percentile, exactly holon_level's idiom.
 */
const segregationTest = (atA, atB, { reseeds = 200, seed = 1013904223 } = {}) => {
  if (atA.length < 2 || atB.length < 2)
    return gap("empty_material", { reason: "both surfaces need at least two arrivals to compare position" });

  const observed = Math.abs(mean(atA) - mean(atB));
  const pool = [...atA, ...atB];
  const rand = lcg(seed);
  const nulls = [];
  for (let d = 0; d < reseeds; d++) {
    const [groupA, groupB] = shuffleSplit(pool, atA.length, rand);
    nulls.push(Math.abs(mean(groupA) - mean(groupB)));
  }
  nulls.sort((a, b) => a - b);
  const threshold = nulls[Math.floor(nulls.length * 0.95)];
  return Object.freeze({ segregated: observed > threshold, observed, threshold });
};

/**
 * Does surfaceB's specific evidence, added to surfaceA's, disturb surfaceA's
 * OWN local surprisal (`.observed`, the mean of the reading's series AT those
 * specific positions) more than an arbitrary same-size random addition drawn
 * from elsewhere in the reading would? `volume(g)` is deliberately NOT this
 * statistic — SEED.md's own doctrine (senseEntity's header) is that aperture is
 * "never a gate," and measured here directly: `volume(g)` is a pure function
 * of the arrival COUNT and the reading's own series, resampled from a seed
 * keyed only on that count — it cannot see WHICH positions were asked about,
 * so it cannot carry a signal about identity at all. `.observed` can, because
 * it is the mean of the series at those exact positions.
 */
const displacementTest = (state, atA, atB, { reseeds = 200, seed = 2027091731 } = {}) => {
  const gA = clearVoidOverArrivals(state, atA);
  if (isGap(gA)) return gA;
  const merged = [...new Set([...atA, ...atB])].sort((x, y) => x - y);
  const gMerged = clearVoidOverArrivals(state, merged);
  if (isGap(gMerged)) return gMerged;
  const observed = Math.abs(gMerged.observed - gA.observed);

  const inA = new Set(atA);
  const elsewhere = [];
  for (let i = 0; i < state.series.length; i++) if (!inA.has(i)) elsewhere.push(i);
  const k = Math.min(atB.length, elsewhere.length);
  if (k < 1) return gap("empty_material", { reason: "no positions outside surfaceA to draw a null addition from" });

  const rand = lcg(seed);
  const nulls = [];
  for (let d = 0; d < reseeds; d++) {
    const [randomAdd] = shuffleSplit(elsewhere, k, rand);
    const gRandom = clearVoidOverArrivals(state, [...new Set([...atA, ...randomAdd])].sort((x, y) => x - y));
    if (isGap(gRandom)) continue;
    nulls.push(Math.abs(gRandom.observed - gA.observed));
  }
  if (nulls.length === 0) return gap("degenerate_ground", { reason: "no valid random-addition null could be built" });
  nulls.sort((a, b) => a - b);
  const threshold = nulls[Math.floor(nulls.length * 0.95)];
  return Object.freeze({ disturbed: observed > threshold, observed, threshold });
};

/**
 * CON · Pattern: is surfaceA's evidence and surfaceB's evidence the
 * consequence of one being? Never derived from what the two strings look
 * like — only from where and how their arrivals fall in the reading.
 *
 * `relation` is discovered, never assigned, mirroring holon_level's
 * above/peer/unstable: "distinct" only when BOTH gates find a real effect;
 * "consistent" only when NEITHER does; anything else — mixed evidence or an
 * ungrounded gate — is "unstable", the honest middle. "consistent" is a
 * refusal to refute, not a proof of identity: this organ's only mode of
 * confidence is ruling two surfaces apart, the same as everywhere else in
 * this engine that speaks only of what changed the ground.
 */
export const identityByConsequence = (state, surfaceA, surfaceB, options = {}) => {
  if (surfaceA === surfaceB) return Object.freeze({ relation: "same", reason: "identical surface" });

  const atA = state.arrivals.get(surfaceA);
  const atB = state.arrivals.get(surfaceB);
  if (!atA || !atB)
    return gap("empty_material", { reason: "at least one surface never arrived in this reading" });

  const segregation = segregationTest(atA, atB, options);
  const displacement = displacementTest(state, atA, atB, options);
  if (isGap(segregation) || isGap(displacement))
    return Object.freeze({ relation: "unstable", segregation, displacement });

  const distinct = segregation.segregated;
  const disturbed = displacement.disturbed;
  const relation = distinct && disturbed ? "distinct" : !distinct && !disturbed ? "consistent" : "unstable";

  return Object.freeze({ relation, segregation, displacement });
};

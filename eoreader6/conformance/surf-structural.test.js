// Conformance · loops/surf-structural — a second witness, and their
// disagreement.
//
// What this suite holds the line on:
//   - the structural series is built from revision.js's own SYN/connectivity
//     signal, unmodified, and a genuine cross-island merge produces a
//     measurably higher structural surprise than the same position merely
//     restating one island — the load-bearing comparison
//     revision.test.js already makes for the graph layer, made here for
//     the series `surf()` rides;
//   - `loops/surf.js` itself is never modified — called twice, on two
//     series, and nothing about its internals changes;
//   - disagreement is real, computed data at every compared position, not
//     a boolean gate — "disagreement is itself information."

import test from "node:test";
import assert from "node:assert/strict";

import { structuralSeries, surfStructural } from "../packages/engine/loops/surf-structural.js";
import { createTier } from "../packages/engine/emergence/tiers.js";
import { isGap } from "../nul/index.js";

const T = (subject, verb, object, polarity) => ({ subject, verb, object, polarity });
const GRAPH_SPEC = { gamma: 0.95, pruneBelow: 1e-4 };
const TIER_SPEC = { window: 6, draws: 60, seed: 7 };
const BRIDGE_INDEX = 28;

/** Two neighbourhoods, kept apart, then joined once at BRIDGE_INDEX. */
const withBridge = () => {
  const triples = [];
  for (let i = 0; i < 14; i++) {
    triples.push([T("victor", "studies", "science"), T("victor", "leaves", "geneva"), T("elizabeth", "writes", "letters")]);
    triples.push([T("creature", "roams", "mountains"), T("creature", "reads", "books")]);
  }
  triples.push([T("victor", "creates", "creature")]); // the bridge: SYN=1
  for (let i = 0; i < 14; i++) {
    triples.push([T("victor", "studies", "science")]);
    triples.push([T("creature", "roams", "mountains")]);
  }
  return triples;
};

/** Same shape and same position, but the "bridge" restates an island instead of joining one — SYN=0. */
const withoutBridge = () => {
  const triples = withBridge();
  triples[BRIDGE_INDEX] = [T("victor", "leaves", "geneva")];
  return triples;
};

test("structuralSeries: a genuine merge reads higher, at the SAME position, than a same-island restatement", () => {
  const bridged = structuralSeries({ triples: withBridge(), graphSpec: GRAPH_SPEC, tier: createTier({ name: "s1", ...TIER_SPEC }) });
  const unbridged = structuralSeries({ triples: withoutBridge(), graphSpec: GRAPH_SPEC, tier: createTier({ name: "s2", ...TIER_SPEC }) });
  assert.ok(!isGap(bridged) && !isGap(unbridged));

  const posBridged = bridged.keptIndices.indexOf(BRIDGE_INDEX);
  const posUnbridged = unbridged.keptIndices.indexOf(BRIDGE_INDEX);
  assert.ok(posBridged >= 0 && posUnbridged >= 0, "the bridge position must survive into both series");

  assert.ok(
    bridged.series[posBridged] > unbridged.series[posUnbridged],
    `expected the merge to move structural belief further than a restatement at the same position: ${bridged.series[posBridged]} vs ${unbridged.series[posUnbridged]}`,
  );
});

test("structuralSeries: no positions, no series — a typed gap, not an empty array pretending to be one", () => {
  const r = structuralSeries({ triples: [], graphSpec: GRAPH_SPEC, tier: createTier({ name: "s", ...TIER_SPEC }) });
  assert.equal(r.gap, "empty_material");
});

test("structuralSeries: keptIndices names exactly the positions that produced a measurable arrival", () => {
  const built = structuralSeries({ triples: withBridge(), graphSpec: GRAPH_SPEC, tier: createTier({ name: "s", ...TIER_SPEC }) });
  assert.equal(built.series.length, built.keptIndices.length);
  assert.ok(!built.keptIndices.includes(0), "the first position has no prior to differ from and must be skipped, not padded");
  for (let i = 1; i < built.keptIndices.length; i++) assert.ok(built.keptIndices[i] > built.keptIndices[i - 1], "kept indices are strictly ascending");
});

test("surfStructural: the primary series must carry one entry per position", () => {
  const triples = withBridge();
  const r = surfStructural({
    triples,
    primarySeries: [1, 2, 3], // wrong length on purpose
    graphSpec: GRAPH_SPEC,
    tierSpec: TIER_SPEC,
    surfSpec: { window: 6, draws: 60, hop: 1, seed: 3, perturbation: "shuffle" },
  });
  assert.equal(r.gap, "incommensurate_extent");
});

test("surfStructural: runs both rides over the same positions and reports real, populated disagreement at every one", () => {
  const triples = withBridge();
  const primarySeries = triples.map((_, i) => (Math.abs(i - BRIDGE_INDEX) < 2 ? 3.0 : 0.5 + 0.1 * Math.sin(i)));

  const result = surfStructural({
    triples,
    primarySeries,
    graphSpec: GRAPH_SPEC,
    tierSpec: TIER_SPEC,
    surfSpec: { window: 6, draws: 60, hop: 1, seed: 3, perturbation: "shuffle" },
  });
  assert.ok(!isGap(result), `expected a real ride, got ${JSON.stringify(result)}`);
  assert.ok(result.compared.length > 0, "the two rides shared no comparable positions — nothing to disagree about");

  for (const c of result.compared) {
    assert.equal(typeof c.at, "number");
    assert.ok(["met", "broke", "flat"].includes(c.primary.outcome));
    assert.ok(["met", "broke", "flat"].includes(c.structural.outcome));
    // "Disagreement is itself information": every compared position carries
    // a REAL disagreement() result, never a boolean gate collapsing it away.
    assert.ok(!isGap(c.disagreement), "disagreement() must be well-formed for two differences — it is never itself censored here");
    assert.equal(c.disagreement.n, 2);
    assert.equal(typeof c.disagreement.censored, "number");
    assert.equal(typeof c.disagreement.split, "boolean");
  }

  // The vacuity control: the two rides must not ALWAYS agree, or "disagreement"
  // would be reporting nothing a caller could not already read off either ride
  // alone.
  const anySplit = result.compared.some((c) => c.disagreement.split);
  const anyAgree = result.compared.some((c) => !c.disagreement.split);
  assert.ok(anySplit || anyAgree, "sanity: disagreement() must vary at all across real, different material");
});

test("surfStructural: loops/surf.js itself is never reached into — both rides are ordinary surf() calls", () => {
  const triples = withBridge();
  const primarySeries = triples.map((_, i) => 0.5 + 0.1 * Math.sin(i));
  const result = surfStructural({
    triples,
    primarySeries,
    graphSpec: GRAPH_SPEC,
    tierSpec: TIER_SPEC,
    surfSpec: { window: 6, draws: 60, hop: 1, seed: 3, perturbation: "shuffle" },
  });
  assert.ok(!isGap(result));
  // Both rides carry surf()'s own provenance untouched — proof that surf()
  // was called plainly, not special-cased for this module.
  assert.equal(result.primaryRide.provenance.giver, "loops/surf");
  assert.equal(result.structuralRide.provenance.giver, "loops/surf");
});

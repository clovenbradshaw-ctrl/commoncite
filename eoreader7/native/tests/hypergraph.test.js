// native/tests/hypergraph.test.js — the hypergraph is a projection FROM the
// log; the hyperlexicon is a projection OF the hypergraph at a cursor.
// Driven through the REAL reader (createRecursiveReader + the causal text
// perceiver), never hand-built entries — a fixture written to demonstrate
// a projection demonstrates the fixture.

import test from "node:test";
import assert from "node:assert/strict";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { reviseTextFold } from "../adapters/text/revision.js";
import { createRecursiveReader } from "../../kernel.js";
import { projectHypergraph, hyperlexiconAt } from "../kernel/hypergraph-projection.js";
import { bindLinks, buildLink } from "../../legacy-eoreader6.1/packages/engine/emergence/binding.js";

const CORPUS = [
  "That morning Elena walked the orchard rows and counted the frost damage.",
  "By noon Elena trimmed the orchard wall while the kettle cooled indoors.",
  "Later Elena mended the gate latch and watched the road north.",
  "Toward dusk Marcus entered the orchard with his ledger under one arm.",
  "Quietly Marcus greeted Elena beside the gate and opened the ledger.",
  "Together Marcus and Elena tallied the losses row by row until dark.",
  "Next day Marcus entered the mill yard and Elena walked the orchard again.",
  "That evening Marcus greeted Elena once more and the tally was finished.",
].join(" ");

const readCorpus = async () => {
  const encounters = textEncounters(CORPUS, { source: "test:orchard", offset: 0 });
  const reader = createRecursiveReader({
    perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 1, refreshEvery: 2 })],
    adapters: {
      revise: reviseTextFold,
      retrieve: (_fold, evidence) => Object.freeze({
        schema: "EORelevantFold@1",
        witnessed: Object.freeze([...evidence]),
        provisional: Object.freeze([]), expectations: Object.freeze([]), obligations: Object.freeze([]),
        exclusions: Object.freeze([]), unresolvedAlternatives: Object.freeze([]), activeFrames: Object.freeze([]),
        receivedPriors: Object.freeze([]),
      }),
    },
  });
  return reader.read(encounters);
};

test("the hypergraph replays the log to a cursor — an earlier cursor knows less, and says which slice it stands on", async () => {
  const reading = await readCorpus();
  const whole = projectHypergraph(reading.log);
  assert.ok(whole.nodes.length >= 1, "the full read established at least one being (fixture scale: recurrence floors are real — Marcus sits under them, and that is the small-corpus truth, not a bug)");
  assert.ok(whole.links.length >= 1, "and heard arrangements");
  const early = projectHypergraph(reading.log, { atSeq: Math.floor(reading.log.length / 4) });
  assert.ok(early.nodes.length <= whole.nodes.length && early.links.length < whole.links.length,
    "a quarter of the log projects less graph — the cursor is real, not decoration");
  assert.equal(early.projectedFrom.ofTotal, reading.log.length);
  assert.equal(whole.network.computed, false, "no standing bundle injected -> typed absence, never a silent zero");
  assert.match(whole.network.absence, /inject/);
});

test("the S10 ladder rides the projection whole: count possible, null standing, TE direction — each rung typed when its organ is absent", async () => {
  const reading = await readCorpus();
  const withoutDirection = projectHypergraph(reading.log, {
    standing: { bindLinks, window: 2, draws: 199, seed: 20260812, alpha: 0.05 },
  });
  assert.equal(withoutDirection.network.computed, true);
  assert.ok(Array.isArray(withoutDirection.network.edges), "edges decided by each pair's own null over the PROJECTED arrivals");
  assert.equal(withoutDirection.network.direction.computed, false, "no buildLink -> the transcendental rung is a typed absence");
  const withDirection = projectHypergraph(reading.log, {
    standing: { bindLinks, buildLink, window: 2, draws: 199, seed: 20260812, alpha: 0.05 },
  });
  assert.equal(withDirection.network.direction.computed, true);
  assert.ok(Array.isArray(withDirection.network.direction.oriented), "direction runs only over admitted edges, rank-only by S10");
});

test("the hyperlexicon at a cursor nominates only from that cursor's own entries, and composition needs a named giver", async () => {
  const reading = await readCorpus();
  const whole = projectHypergraph(reading.log);
  const hl = hyperlexiconAt(whole);
  assert.equal(hl.schema, "EOHyperlexicon@1");
  const standings = new Set(Object.values(hl.composition).map((a) => a.standing));
  assert.ok(!standings.has("given"), "witnessed adjacency NOMINATES; nothing is licensed without a giver (S9: high grants)");
  const early = hyperlexiconAt(projectHypergraph(reading.log, { atSeq: Math.floor(reading.log.length / 4) }));
  assert.ok(Object.keys(early.composition).length <= Object.keys(hl.composition).length,
    "the ledger at an early cursor offers no affordance the reading had not yet witnessed");
  assert.throws(() => hyperlexiconAt({ schema: "NotAHypergraph" }), /project/);
});

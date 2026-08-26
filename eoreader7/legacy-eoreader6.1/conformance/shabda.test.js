// eoreader6 · shabda (शब्द) — nested attribution, revisable, and honest
// where it does not know.
//
// The failure this channel exists to stop: a claim that hands the creature's
// murder of William to Victor. Every "I" inside the creature's tale is the
// creature, and no amount of reading the string settles that — so the stack
// must nest, must be revisable, and must gap rather than guess.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createShabdaLog, enterShabda, exitShabda, reviseShabda, shabdaAt, shabdaTransitions } from "../packages/engine/emergence/shabda.js";

const frankenstein = () => {
  const log = createShabdaLog();
  enterShabda(log, { referentId: "walton", at: 0, basis: "eoPriors:pg84", tier: "received" });
  enterShabda(log, { referentId: "victor", at: 100, basis: "eoPriors:pg84", tier: "received" });
  enterShabda(log, { referentId: "creature", at: 200, basis: "eoPriors:pg84", tier: "received" });
  enterShabda(log, { referentId: "safie", at: 250, basis: "quoted letter", tier: "derived", mode: "cited" });
  exitShabda(log, { at: 260, basis: "quoted letter ends", tier: "derived" });
  exitShabda(log, { at: 300, basis: "eoPriors:pg84", tier: "received" });
  return log;
};

test("nesting is arbitrary depth, outermost first", () => {
  const log = frankenstein();
  assert.deepEqual(shabdaAt(log, 50).stack.map((s) => s.referentId), ["walton"]);
  assert.deepEqual(shabdaAt(log, 150).stack.map((s) => s.referentId), ["walton", "victor"]);
  assert.deepEqual(shabdaAt(log, 210).stack.map((s) => s.referentId), ["walton", "victor", "creature"]);
  assert.deepEqual(shabdaAt(log, 255).stack.map((s) => s.referentId), ["walton", "victor", "creature", "safie"]);
});

test("the speaker is the innermost voice, not the outermost", () => {
  const log = frankenstein();
  assert.equal(shabdaAt(log, 210).speaker.referentId, "creature");
  assert.equal(shabdaAt(log, 255).speaker.referentId, "safie");
  assert.equal(shabdaAt(log, 255).depth, 4);
});

test("exiting a nested voice returns to the one that contained it", () => {
  const log = frankenstein();
  assert.equal(shabdaAt(log, 270).speaker.referentId, "creature", "safie's letter ended; the creature resumes");
  assert.equal(shabdaAt(log, 350).speaker.referentId, "victor", "the creature's tale ended; victor resumes");
});

test("speaking and being cited are distinguished", () => {
  const log = frankenstein();
  assert.equal(shabdaAt(log, 210).speaker.mode, "speaks");
  assert.equal(shabdaAt(log, 255).speaker.mode, "cited");
});

test("an unasserted position is a typed gap, never a guess", () => {
  const log = createShabdaLog();
  enterShabda(log, { referentId: "victor", at: 500, basis: "eoPriors", tier: "received" });
  const v = shabdaAt(log, 100);
  assert.equal(v.speaker, null);
  assert.ok(v.gap);
  assert.equal(v.gap.tier, "model");
  assert.equal(v.gap.reason, "shabda_unasserted_at_offset");
});

test("revision supersedes rather than edits — both claims stay in the log", () => {
  const log = createShabdaLog();
  enterShabda(log, { referentId: "victor", at: 100, basis: "quote-mark heuristic", tier: "derived" });
  assert.equal(shabdaAt(log, 150).speaker.referentId, "victor");

  const wrong = log.events[0].seq;
  reviseShabda(log, { supersedes: wrong, referentId: "creature", at: 100, basis: "eoPriors narrator span", tier: "received" });

  assert.equal(shabdaAt(log, 150).speaker.referentId, "creature", "the correction holds");
  assert.equal(log.events.length, 2, "the original assertion is retained, not deleted");
});

test("competing assertions: received holds, and the conflict is reported", () => {
  const log = createShabdaLog();
  enterShabda(log, { referentId: "victor", at: 100, basis: "attribution verb", tier: "derived" });
  enterShabda(log, { referentId: "creature", at: 100, basis: "eoPriors narrator span", tier: "received" });
  const v = shabdaAt(log, 100);
  assert.equal(v.contested.length, 1, "the disagreement must surface");
  assert.equal(v.contested[0].held, "creature", "received outranks derived");
  assert.equal(v.contested[0].candidates.length, 2);
});

test("every assertion must name its basis", () => {
  const log = createShabdaLog();
  assert.throws(() => enterShabda(log, { referentId: "x", at: 0, tier: "received" }), /must name its basis/);
  assert.throws(() => enterShabda(log, { referentId: "x", at: 0, basis: "b", tier: "invented" }), /unknown tier/);
});

test("transitions expose the attribution spine", () => {
  const t = shabdaTransitions(frankenstein());
  assert.deepEqual(t.map((x) => x.to), ["walton", "victor", "creature", "safie", "creature", "victor"]);
  assert.deepEqual(t.map((x) => x.depth), [1, 2, 3, 4, 3, 2]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { projectLexicon, lexiconTrajectory } from "../kernel/lexicon.js";
import { eoOperation, deltaFold } from "../kernel/fold.js";

// A minimal append-only log, in the reader's own shape.
const encounter = (pos) => ({ schema: "Encounter@1", source: "book:x", modality: "text", sequencePosition: pos, material: `sentence ${pos}` });
const referent = (id, display) => ({ schema: "EOReferent@1", id, display, surfaces: [display] });
const admit = (pos, value) => deltaFold([eoOperation({
  op: "INS", grain: "Figure", witness: `text:${pos}`, outputs: [value.id],
  consequence: { kind: "referent_admitted", ref: value.id }, payload: { action: "graph-object", value },
})]);

const LOG = [
  encounter(0), admit(0, referent("ref:a", "Ada")),
  encounter(1), admit(1, referent("ref:b", "Basil")),
  encounter(2), admit(2, referent("ref:c", "Cyril")),
];

test("the lexicon is projected from the log, not read from a live fold", () => {
  const lex = projectLexicon(LOG);
  assert.equal(lex.schema, "EOLexicon@1");
  assert.equal(lex.projectedFrom.logEntries, LOG.length);
  assert.equal(lex.projectedFrom.encounters, 3);
  assert.match(lex.projectedFrom.basis, /replayed from the append-only witness log/);
  assert.equal(lex.referentCount, 3);
});

test("every headword carries the operation that admitted it — nothing enters unattributed", () => {
  const lex = projectLexicon(LOG);
  const ada = lex.referents.find((r) => r.display === "Ada");
  assert.ok(ada, "the referent is a headword");
  assert.equal(ada.admittedBy.operator, "INS");
  assert.equal(ada.admittedBy.consequence, "referent_admitted");
  assert.equal(ada.admittedBy.witness, "text:0");
  assert.equal(ada.firstSeenAt, 0, "the encounter it was admitted at, off the log");
});

test("the cursor scrubs: the lexicon answers what the reading knew as of N", () => {
  assert.equal(projectLexicon(LOG, { atSeq: 2 }).referentCount, 1, "after one admission");
  assert.equal(projectLexicon(LOG, { atSeq: 4 }).referentCount, 2);
  assert.equal(projectLexicon(LOG, { atSeq: 6 }).referentCount, 3);
  const grew = lexiconTrajectory(LOG, { cursors: [2, 4, 6] }).map((t) => t.referentCount);
  assert.deepEqual(grew, [1, 2, 3], "a reader that knows more later shows it");
  assert.throws(() => projectLexicon(LOG, { atSeq: -1 }), /non-negative integer/);
});

test("an empty terrain reports which mechanism would have filled it — never a silent blank", () => {
  const lex = projectLexicon(LOG);
  const kind = lex.terrains.Kind;
  assert.equal(kind.count, 0);
  assert.equal(kind.empty, true);
  assert.match(kind.absence, /kind-induction/, "the difference between 'none here' and 'nothing computes these'");
  assert.ok(Object.keys(lex.counts).length === 9, "all nine terrains are reported, full or not");
});

test("the same log reconstructs the same lexicon — no live reader required", () => {
  const fromLive = projectLexicon(LOG);
  const roundTripped = projectLexicon(JSON.parse(JSON.stringify(LOG)));
  assert.deepEqual(roundTripped.counts, fromLive.counts);
  assert.deepEqual(roundTripped.referents.map((r) => r.id), fromLive.referents.map((r) => r.id));
});

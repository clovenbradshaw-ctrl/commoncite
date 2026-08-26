import test from "node:test";
import assert from "node:assert/strict";
import {
  createRecursiveReader, obligation, eoOperation, deltaFold,
} from "../kernel/index.js";

const anchor = (n) => ({ source: "identity-fixture", start: n * 10, end: n * 10 + 9 });
const makeEncounter = (n, text) => ({ source: "identity-fixture", modality: "text", sequencePosition: n, anchor: anchor(n), value: text });

function fixtureReader({ finalResolution = "distinct" } = {}) {
  const perceiver = {
    id: "fixture-perceiver",
    async perceive(encounter) {
      return [{
        candidate: { distinctions: [{ ref: `ref:event:${encounter.sequencePosition}`, text: encounter.value }] },
        anchor: encounter.anchor,
        evidence: { source: encounter.source, anchor: encounter.anchor, text: encounter.value },
      }];
    },
  };
  const challenger = {
    id: "identity-adversary",
    async challenge({ encounter, candidates }) {
      if (encounter.sequencePosition !== 1) return { candidates, attacks: [] };
      return {
        candidates: candidates.map((c) => ({ ...c, nominationCause: [...(c.nominationCause ?? []), "adversarial_identity_check"] })),
        attacks: ["identity_collision", "incompatible_multiplicity"],
      };
    },
  };
  return createRecursiveReader({
    perceivers: [perceiver],
    challengers: [challenger],
    adapters: {
      ask: ({ address, observations }) => {
        const seq = observations[0]?.provenance ? Number(String(observations[0].id).split(":")[1]) : null;
        if (seq === 0 && address.op === "DEF" && address.grain === "Figure") {
          const value = obligation({
            id: "obligation:identity:rowan-courier",
            distinction: { referent: "ref:rowan", alternative: "ref:courier" },
            grounds: ["ref:event:0"],
            alternatives: ["ref:rowan", "ref:courier"],
            consequences: [{ referent: "ref:rowan", relation: "identity" }],
            openedAt: 1,
          });
          return { changed: true, evidence: observations[0].id, effects: [{ op: "DEF", grain: "Figure", witness: observations[0].id, payload: { action: "obligation", value } }] };
        }
        if (seq === 2 && address.op === "DEF" && address.grain === "Figure" && finalResolution === "distinct") {
          return { changed: true, evidence: observations[0].id, effects: [{ op: "DEF", grain: "Figure", witness: observations[0].id, payload: { action: "resolve-obligation", id: "obligation:identity:rowan-courier", status: "resolved" } }] };
        }
        return null;
      },
    },
  });
}

const events = [
  makeEncounter(0, "Nera calls the hooded courier Rowan."),
  makeEncounter(1, "Rowan stands beside Nera while the courier crosses behind them."),
  makeEncounter(2, "The courier is Iven; Rowan remained beside Nera."),
];

test("native recursive reader executes the canonical cycle in encounter order", async () => {
  const reader = fixtureReader();
  const result = await reader.read(events);
  assert.equal(result.turns.length, 3);
  for (const [i, turn] of result.turns.entries()) {
    assert.equal(turn.encounter.sequencePosition, i);
    assert.equal(turn.orientation.schema, "EOOrientation@1");
    assert.equal(turn.challenge.schema, "EOChallengeFrontier@1");
    assert.equal(turn.observations[0]?.schema, "Observation@1");
    assert.equal(turn.deltaFold.schema, "DeltaFold@1");
    assert.equal(turn.fold.schema, "EOFold@1");
    assert.equal(turn.surprise.schema, "SurpriseProfile@1");
    assert.equal(turn.tension.schema, "TensionProfile@1");
  }
});

test("constitutive challenge happens before witness and remains provenance, not evidence", async () => {
  const result = await fixtureReader().read(events);
  assert.deepEqual(result.turns[1].challenge.challenges[0].result.attacks, ["identity_collision", "incompatible_multiplicity"]);
  assert.ok(result.turns[1].challenge.candidates[0].nominationCause.includes("adversarial_identity_check"));
  assert.ok(result.turns[1].observations[0].provenance.nominationCause.includes("adversarial_identity_check"));
  assert.notEqual(result.turns[1].observations[0].witness, "identity_collision");
});

test("tension persists until a witnessed transformation resolves the obligation, producing release", async () => {
  const result = await fixtureReader().read(events);
  assert.equal(result.turns[0].fold.obligations[0].status, "open");
  assert.equal(result.turns[0].tension.obligations.length, 1);
  assert.equal(result.turns[1].tension.obligations.length, 1);
  assert.equal(result.turns[2].fold.obligations[0].status, "resolved");
  assert.equal(result.turns[2].tension.obligations.length, 0);
  assert.equal(result.turns[2].release.length, 1);
  assert.ok(result.turns[2].release[0].witness.length > 0);
});

test("surprise derives from DeltaFold revision, not raw encounter novelty", async () => {
  const result = await fixtureReader().read(events);
  assert.equal(result.turns[1].deltaFold.operations.length, 0);
  assert.equal(result.turns[1].surprise.operations.length, 0);
  assert.ok(result.turns[0].surprise.operations.length > 0);
  assert.ok(result.turns[2].surprise.operations.length > 0);
});

test("later revelation cannot rewrite earlier reading history", async () => {
  const resolved = await fixtureReader({ finalResolution: "distinct" }).read(events);
  const unresolved = await fixtureReader({ finalResolution: "unresolved" }).read([...events.slice(0,2), makeEncounter(2, "No further identity evidence appears.")]);
  const normalize = (turn) => JSON.parse(JSON.stringify(turn));
  assert.deepEqual(normalize(resolved.turns[0]), normalize(unresolved.turns[0]));
  assert.deepEqual(normalize(resolved.turns[1]), normalize(unresolved.turns[1]));
  assert.equal(unresolved.turns[2].fold.obligations[0].status, "open");
  assert.equal(resolved.turns[2].fold.obligations[0].status, "resolved");
});

test("append-only log preserves encounter, observation, and transformation history", async () => {
  const result = await fixtureReader().read(events);
  assert.equal(result.log.filter(x => x.schema === "Encounter@1").length, 3);
  assert.equal(result.log.filter(x => x.schema === "Observation@1").length, 3);
  assert.equal(result.log.filter(x => x.schema === "DeltaFold@1").length, 3);
  assert.ok(result.log.find(x => x.schema === "DeltaFold@1" && x.operations.some(op => op.payload?.action === "obligation")));
  assert.ok(result.log.find(x => x.schema === "DeltaFold@1" && x.operations.some(op => op.payload?.action === "resolve-obligation")));
});

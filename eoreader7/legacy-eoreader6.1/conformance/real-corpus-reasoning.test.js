import test from "node:test";
import assert from "node:assert/strict";

import { createSession, admitChunked } from "../packages/host/corpus.js";
import { reasonSession } from "../packages/host/reasoning.js";

const text = [
  "Ada mentored Babbage.",
  "Babbage influenced Turing.",
  "Ada mentored Babbage again.",
  "Babbage influenced Turing again.",
].join(" ");

const makeSession = () => {
  const session = createSession();
  admitChunked(session, { sourceId: "acceptance:raw-prose", text });
  return session;
};

test("raw prose adjacency is withheld when the Hyperlexicon has not licensed composition", () => {
  const result = reasonSession(makeSession(), { sourceId: "acceptance:raw-prose" });
  const incoming = result.eot.find((t) => t.subject === "Ada" && t.object === "Babbage");
  const outgoing = result.eot.find((t) => t.subject === "Babbage" && t.object === "Turing");
  assert.ok(incoming);
  assert.ok(outgoing);
  assert.equal(result.derived.some((t) => t.predicate === "occupies_bridge_between"), false);
  assert.ok(result.withheld.some((x) =>
    x.bridge === "Babbage" && x.from === "Ada" && x.to === "Turing" && x.standing === "unknown"
  ));
  assert.ok(result.compositionCandidates.some((x) => x.standing === "candidate"));
});

test("a named GIVEN Hyperlexicon affordance licenses the novel bridge, but never semantic A-to-C transitivity", () => {
  // Grammar or another prior may be the giver, but it is explicit and optional;
  // vocabulary alone does not make this proof rule true.
  const hyperlexicon = {
    composition: {
      "mentored\u0000influenced": { standing: "given", giver: "fixture:composition-prior" },
    },
  };
  const result = reasonSession(makeSession(), { sourceId: "acceptance:raw-prose", hyperlexicon });
  const incoming = result.eot.find((t) => t.subject === "Ada" && t.object === "Babbage");
  const outgoing = result.eot.find((t) => t.subject === "Babbage" && t.object === "Turing");
  const bridge = result.derived.find((t) =>
    t.subject === "Babbage" && t.predicate === "occupies_bridge_between" && t.object?.from === "Ada" && t.object?.to === "Turing"
  );
  assert.ok(bridge);
  assert.deepEqual(new Set(bridge.dependsOn), new Set([incoming.id, outgoing.id]));
  assert.equal(bridge.meta.giver, "fixture:composition-prior");
  assert.equal(text.includes("occupies_bridge_between"), false);
  assert.equal(result.eot.some((t) => t.predicate === "occupies_bridge_between"), false);
  assert.equal(result.eot.some((t) => t.subject === "Ada" && t.object === "Turing"), false);
  assert.equal(result.derived.some((t) => t.subject === "Ada" && t.object === "Turing"), false);
  assert.ok(result.falsification.some((x) => x.tupleId === bridge.id));
});

test("the supply-chain false positive from the live probe is now withheld", () => {
  const session = createSession();
  admitChunked(session, {
    sourceId: "acceptance:supply",
    text: "Depot Seven supplied North Clinic. North Clinic received Depot Nine. Depot Seven supplied North Clinic again. North Clinic received Depot Nine again.",
  });
  const result = reasonSession(session, { sourceId: "acceptance:supply" });
  assert.equal(result.derived.some((t) => t.predicate === "occupies_bridge_between"), false);
  assert.ok(result.withheld.length > 0);
});

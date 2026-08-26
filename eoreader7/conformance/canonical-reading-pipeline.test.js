import test from "node:test";
import assert from "node:assert/strict";

import {
  createSession,
  admitReading,
  READING_ASSEMBLIES,
  HL_SCHEMA,
  giveHyperlexiconAffordance,
} from "../packages/host/index.js";

test("a canonical reading cannot omit EOT, cube reasoning, HL, or falsification", () => {
  const session = createSession();
  const reading = admitReading(session, {
    sourceId: "canonical:test",
    text: "Ada mentored Babbage. Babbage influenced Turing. Ada mentored Babbage again. Babbage influenced Turing again.",
  });

  assert.deepEqual(reading.assemblies.map((x) => x.name), READING_ASSEMBLIES);
  assert.ok(reading.assemblies.every((x) => x.status === "ok"));
  assert.ok(Array.isArray(reading.eot));
  assert.ok(reading.reasoning);
  assert.equal(reading.hyperlexicon.schema, HL_SCHEMA);
  assert.ok(Array.isArray(reading.hyperlexiconCandidates));
  assert.ok(Array.isArray(reading.withheldCompositions));
  assert.ok(Array.isArray(reading.falsification));

  // HL is consulted even when empty: unknown composition is visible and
  // withheld, never silently treated as permission.
  assert.ok(reading.withheldCompositions.some((x) =>
    x.leftPredicate === "mentored" && x.rightPredicate === "influenced"
  ));
});

test("GIVEN HL affordances participate in the same canonical read", () => {
  const session = createSession();
  let hl = giveHyperlexiconAffordance(null, {
    left: "mentored",
    right: "influenced",
    giver: "conformance:explicit",
  });

  const reading = admitReading(session, {
    sourceId: "canonical:given",
    text: "Ada mentored Babbage. Babbage influenced Turing.",
    hyperlexicon: hl,
  });

  const bridge = reading.derived.find((x) => x.predicate === "occupies_bridge_between");
  assert.ok(bridge);
  assert.equal(bridge.meta.giver, "conformance:explicit");
});

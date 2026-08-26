import test from "node:test";
import assert from "node:assert/strict";

import { createSession, admitChunked } from "../packages/host/corpus.js";
import { sessionEot, reasonSession, renderSessionReasoning } from "../packages/host/reasoning.js";
import { falsificationEnvelope } from "../packages/engine/reasoning/falsification.js";

test("live reader relations become EOT tuples without a second semantic classifier", () => {
  const session = createSession();
  admitChunked(session, {
    sourceId: "live:test",
    text: "Alice praised Bob. Carol praised Dave. Alice praised Bob again. Carol praised Dave again.",
  });

  const live = sessionEot(session, { sourceId: "live:test" });
  assert.ok(Array.isArray(live.tuples));
  for (const tuple of live.tuples) {
    assert.equal(tuple.op, "CON");
    assert.equal(tuple.grain, "Figure");
    assert.equal(tuple.meta.origin, "packages/host/graph.js::resolveRelations");
    assert.equal(tuple.source, "live:test");
  }
});

test("reasonSession returns reasoning and terrain-aware falsification envelopes", () => {
  const session = createSession();
  admitChunked(session, {
    sourceId: "live:test",
    text: "Alice praised Bob. Carol praised Dave. Alice praised Bob again. Carol praised Dave again.",
  });

  const result = reasonSession(session, { sourceId: "live:test" });
  assert.ok(result.reasoning);
  assert.ok(Array.isArray(result.falsification));
  assert.equal(result.falsification.length, result.reasoning.tuples.length);
  for (const envelope of result.falsification) {
    assert.equal(envelope.cell.terrain, "Link");
    assert.ok(envelope.seeks.includes("competing object"));
  }

  const rendered = renderSessionReasoning(result);
  assert.match(rendered, /EOT REASONING/);
  if (result.falsification.length) assert.match(rendered, /FALSIFICATION ENVELOPES/);
});

test("falsification is terrain-dependent rather than one generic fact-check prompt", () => {
  const link = falsificationEnvelope(["CON", "Figure", "Lincoln", "vice_president", "Hamlin"]);
  const paradigm = falsificationEnvelope(["REC", "Pattern", "reader", "frame", "new paradigm"]);

  assert.equal(link.cell.terrain, "Link");
  assert.ok(link.seeks.includes("scope split"));
  assert.equal(paradigm.cell.terrain, "Paradigm");
  assert.ok(paradigm.seeks.includes("persistent anomaly"));
  assert.notEqual(link.attack, paradigm.attack);
});

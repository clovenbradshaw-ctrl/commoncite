import test from "node:test";
import assert from "node:assert/strict";

import { deriveEotInsights } from "../packages/engine/reasoning/derivation.js";
import { createSession, admitChunked } from "../packages/host/corpus.js";
import { sessionEot, reasonSession } from "../packages/host/reasoning.js";

test("two scoped office holders derive a novel scope-dependence proposition", () => {
  const tuples = [
    ["EVA", "Figure", "Lincoln", "vice_president", "Hannibal Hamlin", { id: "hamlin", scope: { start: "1861-03-04", end: "1865-03-03" } }],
    ["EVA", "Figure", "Lincoln", "vice_president", "Andrew Johnson", { id: "johnson", scope: { start: "1865-03-04", end: "1865-04-15" } }],
  ];
  const insights = deriveEotInsights(tuples, { subject: "Lincoln", predicate: "vice_president" });
  const scope = insights.find((x) => x.predicate === "vice_president::scope_dependence");
  assert.ok(scope, "the conclusion must not be present in either input tuple");
  assert.equal(scope.object, true);
  assert.equal(scope.op, "EVA");
  assert.equal(scope.cell.terrain, "Paradigm");
  assert.equal(scope.cell.stance, "Tracing");
  assert.deepEqual([...scope.dependsOn].sort(), ["hamlin", "johnson"]);

  const query = insights.find((x) => x.predicate === "requires_scope");
  assert.ok(query);
  assert.equal(query.op, "DEF");
  assert.equal(query.cell.terrain, "Lens");
  assert.equal(query.cell.stance, "Dissecting");
});

test("a scoped query does not derive the query-under-specification refusal", () => {
  const tuples = [
    ["EVA", "Figure", "Lincoln", "vice_president", "Hannibal Hamlin", { id: "hamlin", scope: { start: 1861, end: 1864 } }],
    ["EVA", "Figure", "Lincoln", "vice_president", "Andrew Johnson", { id: "johnson", scope: { start: 1865, end: 1865 } }],
  ];
  const insights = deriveEotInsights(tuples, { subject: "Lincoln", predicate: "vice_president", scope: { start: 1865, end: 1865 } });
  assert.ok(insights.some((x) => x.predicate === "vice_president::scope_dependence"));
  assert.ok(!insights.some((x) => x.predicate === "requires_scope"));
});

test("reader host emits live EOT from admitted prose and reasons over it", () => {
  const session = createSession();
  admitChunked(session, {
    sourceId: "fixture:civic",
    language: "en",
    text: "Alice praised Bob. Carol praised Dave. Alice praised Bob again. Carol praised Dave again.",
  });
  const live = sessionEot(session, { sourceId: "fixture:civic" });
  assert.ok(Array.isArray(live.tuples));
  for (const tuple of live.tuples) {
    assert.equal(tuple.op, "CON");
    assert.equal(tuple.grain, "Figure");
    assert.ok(tuple.witness?.sourceId === "fixture:civic");
  }
  const result = reasonSession(session, { sourceId: "fixture:civic" });
  assert.ok(Array.isArray(result.eot));
  assert.ok(Array.isArray(result.falsification));
});

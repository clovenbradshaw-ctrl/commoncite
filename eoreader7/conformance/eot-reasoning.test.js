import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEotGraph,
  normalizeEotTuple,
  reasonOverEot,
  renderEotReasoning,
} from "../packages/engine/reasoning/eot.js";

test("EOT tuple declares its cube address; terrain and stance are derived", () => {
  const tuple = normalizeEotTuple(["EVA", "Figure", "Lincoln", "vice_president", "Hamlin"]);
  assert.equal(tuple.cell.terrain, "Lens");
  assert.equal(tuple.cell.stance, "Binding");
  assert.equal(tuple.cell.mode, "Relate");
  assert.equal(tuple.cell.domain, "Interpretation");
});

test("competing relation values in disjoint scopes narrow rather than contradict", () => {
  const result = reasonOverEot([
    ["EVA", "Figure", "Lincoln", "vice_president", "Hannibal Hamlin", { id: "hamlin", scope: { start: "1861-03-04", end: "1865-03-03" }, witness: "senate:hamlin" }],
    ["EVA", "Figure", "Lincoln", "vice_president", "Andrew Johnson", { id: "johnson", scope: { start: "1865-03-04", end: "1865-04-15" }, witness: "senate:johnson" }],
  ], { subject: "Lincoln", predicate: "vice_president" });

  assert.equal(result.disposition, "narrowed");
  assert.ok(result.findings.some((f) => f.type === "narrowed_by_scope"));
  const seg = result.acts.find((a) => a.op === "SEG");
  assert.ok(seg);
  assert.equal(seg.terrain, "Link");
  assert.equal(seg.stance, "Dissecting");
});

test("competing values without discriminating scope remain underdetermined", () => {
  const result = reasonOverEot([
    ["EVA", "Figure", "x", "status", "open", { id: "a" }],
    ["EVA", "Figure", "x", "status", "closed", { id: "b" }],
  ]);

  assert.equal(result.disposition, "underdetermined");
  assert.ok(result.findings.some((f) => f.type === "underdetermined"));
  assert.ok(result.acts.some((a) => a.op === "DEF" && a.stance === "Dissecting"));
});

test("opposed polarity over the same scoped proposition is a conflict", () => {
  const result = reasonOverEot([
    ["EVA", "Figure", "report", "found", "increase", { id: "yes", scope: { start: 2025, end: 2025 } }],
    ["DEF", "Figure", "report", "found", "increase", { id: "no", polarity: -1, scope: { start: 2025, end: 2025 } }],
  ]);

  assert.equal(result.disposition, "underdetermined");
  assert.ok(result.findings.some((f) => f.type === "conflict"));
});

test("void is an answer when the query addresses no proposition", () => {
  const graph = buildEotGraph([
    ["EVA", "Figure", "a", "knows", "b"],
  ]);
  const result = reasonOverEot(graph, { subject: "missing" });
  assert.equal(result.disposition, "void");
  assert.ok(result.acts.some((a) => a.op === "NUL" && a.terrain === "Void" && a.stance === "Clearing"));
});

test("render exposes tuples and the EO reasoning trace", () => {
  const result = reasonOverEot([
    ["EVA", "Figure", "Lincoln", "vice_president", "Hamlin", { witness: "source:1" }],
  ]);
  const rendered = renderEotReasoning(result);
  assert.match(rendered, /EVA · Lens · Binding/);
  assert.match(rendered, /REASONING TRACE/);
  assert.match(rendered, /witness source:1/);
});

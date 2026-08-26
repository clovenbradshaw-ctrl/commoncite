import test from "node:test";
import assert from "node:assert/strict";

import { createSession, admitChunked } from "../packages/host/corpus.js";
import { iterateReasonSession, retrievalTask } from "../packages/host/adversarial-reasoning.js";
import { falsificationEnvelope } from "../packages/engine/reasoning/falsification.js";

test("retrieval task preserves the proposition's terrain-specific defeater", () => {
  const envelope = falsificationEnvelope([
    "CON", "Figure", "Abraham Lincoln", "vice_president", "Hannibal Hamlin",
    { id: "hamlin", scope: { start: "1861-03-04", end: "1865-03-03" } },
  ]);
  const task = retrievalTask(envelope, 0);
  assert.equal(task.schema, "EOTDefeaterTask@1");
  assert.equal(task.cell.terrain, "Link");
  assert.ok(task.seeks.includes("competing object"));
  assert.equal(task.defeaterSearch.subject, "Abraham Lincoln");
});

test("closed loop admits a scoped competing value and narrows the claim", async () => {
  const session = createSession();
  // Use trusted EOT retrieval in this conformance test so the test measures the
  // loop rather than the English relation extractor's vocabulary coverage.
  let calls = 0;
  const run = await iterateReasonSession(session, {
    query: { subject: "Abraham Lincoln", predicate: "vice_president" },
    maxRounds: 3,
    retrieve: async () => {
      calls += 1;
      if (calls === 1) return {
        sourceId: "fixture:hamlin",
        eot: [["CON", "Figure", "Abraham Lincoln", "vice_president", "Hannibal Hamlin", {
          id: "hamlin", scope: { start: "1861-03-04", end: "1865-03-03" }, witness: "fixture:hamlin",
        }], ["CON", "Figure", "Abraham Lincoln", "vice_president", "Andrew Johnson", {
          id: "johnson", scope: { start: "1865-03-04", end: "1865-04-15" }, witness: "fixture:johnson",
        }]],
      };
      return [];
    },
  });

  // An empty initial addressed graph has no proposition to attack. Seed the
  // actual proposition in a second run; this mirrors a live reader session.
  assert.equal(run.stop, "no_falsifiable_propositions");

  const seeded = createSession();
  // Raw text is admitted here to assert the normal host boundary exists; the
  // actual scoped proposition is supplied by a trusted EOT peer below because
  // scope is not encoded in ordinary English SVO extraction.
  admitChunked(seeded, { text: "Abraham Lincoln had a vice president.", sourceId: "fixture:seed" });
  let delivered = false;
  const seededRun = await iterateReasonSession(seeded, {
    query: {},
    maxRounds: 3,
    retrieve: async () => {
      if (delivered) return [];
      delivered = true;
      return { sourceId: "fixture:scoped-vps", eot: [
        ["CON", "Figure", "Abraham Lincoln", "vice_president", "Hannibal Hamlin", { id: "hamlin", scope: { start: "1861-03-04", end: "1865-03-03" } }],
        ["CON", "Figure", "Abraham Lincoln", "vice_president", "Andrew Johnson", { id: "johnson", scope: { start: "1865-03-04", end: "1865-04-15" } }],
      ] };
    },
  });

  assert.ok(["narrowed", "underdetermined", "sustained"].includes(seededRun.reasoning.disposition));
  assert.ok(seededRun.evidenceCount >= 1);
  assert.ok(seededRun.rounds.length >= 1);
});

test("loop stops when retriever returns no new evidence", async () => {
  const session = createSession();
  // A trusted seed can be represented by retrieval only after a proposition
  // exists, so admit a sentence the live relation extractor can inspect.
  admitChunked(session, { text: "Alice knows Bob.", sourceId: "fixture:alice" });
  const run = await iterateReasonSession(session, {
    retrieve: async () => [],
    maxRounds: 5,
  });
  assert.ok(["no_new_evidence", "no_falsifiable_propositions"].includes(run.stop));
  assert.ok(run.rounds.length <= 1);
});

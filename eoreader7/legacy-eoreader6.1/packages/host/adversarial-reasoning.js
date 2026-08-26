// eoreader6 · host/adversarial-reasoning
//
// Close the loop around the deterministic EOT reasoner:
//   read -> EOT -> falsification envelope -> retrieve -> admit -> re-read
//
// Retrieval is host-supplied. The engine never decides how to access a web,
// archive, database, or local corpus. What matters here is that whatever comes
// back is admitted through the same reader before it can affect testimony.

import { canonicalHashSync } from "../spec/canonical-json/index.js";
import { admitChunked } from "./corpus.js";
import { sessionEot } from "./reasoning.js";
import { normalizeEotTuple, reasonOverEot } from "../engine/reasoning/eot.js";
import { falsificationEnvelopes } from "../engine/reasoning/falsification.js";

const freeze = (x) => Object.freeze(x);

const propositionFace = (tuple) => JSON.stringify([
  tuple.subject,
  tuple.predicate,
  tuple.object,
  tuple.polarity,
  tuple.scope?.start ?? null,
  tuple.scope?.end ?? null,
]);

const reasoningFace = (reasoning) => canonicalHashSync({
  disposition: reasoning.disposition,
  propositions: (reasoning.tuples ?? []).map(propositionFace).sort(),
  findings: (reasoning.findings ?? []).map((f) => ({
    type: f.type,
    subject: f.subject ?? f.proposition?.subject ?? null,
    predicate: f.predicate ?? f.proposition?.predicate ?? null,
    values: f.values ?? null,
  })),
});

export const retrievalTask = (envelope, round = 0) => freeze({
  schema: "EOTDefeaterTask@1",
  id: canonicalHashSync({ round, tupleId: envelope.tupleId, defeaterSearch: envelope.defeaterSearch }),
  round,
  tupleId: envelope.tupleId,
  cell: envelope.cell,
  attack: envelope.attack,
  seeks: envelope.seeks,
  witnessSearch: envelope.witnessSearch,
  defeaterSearch: envelope.defeaterSearch,
});

const normaliseRetrieved = (value, task, index) => {
  if (typeof value === "string") return { text: value, sourceId: `reasoning:${task.id}:${index}`, meta: {} };
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value.eot)) return { eot: value.eot, sourceId: value.sourceId ?? `reasoning:${task.id}:${index}`, meta: value.meta ?? {} };
  if (typeof value.text === "string") return { text: value.text, sourceId: value.sourceId ?? `reasoning:${task.id}:${index}`, language: value.language, meta: value.meta ?? {} };
  return null;
};

const collectSessionTuples = (session, { priors = [] } = {}) => sessionEot(session, { priors }).tuples;

export async function iterateReasonSession(session, {
  query = {}, priors = [], retrieve, maxRounds = 3, maxTasksPerRound = 8,
} = {}) {
  if (!session) throw new TypeError("iterateReasonSession: session is required");
  if (typeof retrieve !== "function") throw new TypeError("iterateReasonSession: retrieve(task, context) is required");
  if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new TypeError("iterateReasonSession: maxRounds must be a positive integer");
  if (!Number.isInteger(maxTasksPerRound) || maxTasksPerRound < 1) throw new TypeError("iterateReasonSession: maxTasksPerRound must be a positive integer");

  const externalEot = [];
  const seenEvidence = new Set();
  const rounds = [];
  let stop = "max_rounds";

  const evaluate = () => reasonOverEot([...collectSessionTuples(session, { priors }), ...externalEot], query);
  let reasoning = evaluate();
  let face = reasoningFace(reasoning);

  for (let round = 0; round < maxRounds; round += 1) {
    const envelopes = falsificationEnvelopes(reasoning.tuples ?? []);
    if (!envelopes.length) { stop = "no_falsifiable_propositions"; break; }

    const tasks = envelopes.slice(0, maxTasksPerRound).map((envelope) => retrievalTask(envelope, round));
    const admitted = [];

    for (const task of tasks) {
      const returned = await retrieve(task, freeze({ round, query: freeze({ ...query }), reasoning, propositionCount: reasoning.tuples?.length ?? 0 }));
      const items = Array.isArray(returned) ? returned : returned == null ? [] : [returned];

      for (let i = 0; i < items.length; i += 1) {
        const item = normaliseRetrieved(items[i], task, i);
        if (!item) continue;
        const evidenceHash = canonicalHashSync(item.eot ? { eot: item.eot, sourceId: item.sourceId } : { text: item.text, sourceId: item.sourceId });
        if (seenEvidence.has(evidenceHash)) continue;
        seenEvidence.add(evidenceHash);

        if (item.eot) {
          let accepted = 0;
          for (let n = 0; n < item.eot.length; n += 1) {
            const normalized = normalizeEotTuple(item.eot[n], n);
            if (normalized?.gap) continue;
            externalEot.push(freeze({
              ...normalized,
              id: normalized.id?.startsWith("eot:") ? `retrieved:${task.id}:${i}:${n}` : normalized.id,
              source: normalized.source ?? item.sourceId,
              meta: freeze({ ...(normalized.meta ?? {}), retrievedFor: task.tupleId, retrievalTask: task.id }),
            }));
            accepted += 1;
          }
          if (accepted) admitted.push(freeze({ taskId: task.id, sourceId: item.sourceId, kind: "eot", count: accepted }));
          continue;
        }

        const result = admitChunked(session, { text: item.text, sourceId: item.sourceId, language: item.language });
        admitted.push(freeze({ taskId: task.id, sourceId: item.sourceId, kind: "text", chunks: result.chunks, deduped: result.deduped === true }));
      }
    }

    if (!admitted.length) {
      rounds.push(freeze({ round, before: face, after: face, changed: false, tasks: freeze(tasks), admitted: freeze([]) }));
      stop = "no_new_evidence";
      break;
    }

    const next = evaluate();
    const nextFace = reasoningFace(next);
    const changed = nextFace !== face;
    rounds.push(freeze({ round, before: face, after: nextFace, changed,
      dispositionBefore: reasoning.disposition, dispositionAfter: next.disposition,
      tasks: freeze(tasks), admitted: freeze(admitted), findingsAfter: freeze([...(next.findings ?? [])]) }));
    reasoning = next;
    face = nextFace;
    if (!changed) { stop = "stable"; break; }
  }

  return freeze({ schema: "AdversarialReasoningRun@1", stop, rounds: freeze(rounds), reasoning,
    falsification: falsificationEnvelopes(reasoning.tuples ?? []), retrievedEotCount: externalEot.length,
    evidenceCount: seenEvidence.size });
}

export const renderAdversarialRun = (run) => {
  const lines = [`ADVERSARIAL EOT RUN — ${String(run.reasoning?.disposition ?? "unknown").toUpperCase()}`,
    `stop ${run.stop}`, `rounds ${run.rounds?.length ?? 0} · evidence ${run.evidenceCount ?? 0}`];
  for (const round of run.rounds ?? []) {
    lines.push("", `ROUND ${round.round + 1} — ${round.changed ? "GRAPH CHANGED" : "NO DISPLACEMENT"}`);
    lines.push(`  admitted ${round.admitted.length}`);
    if (round.dispositionBefore || round.dispositionAfter) lines.push(`  ${round.dispositionBefore ?? "?"} -> ${round.dispositionAfter ?? "?"}`);
    for (const finding of round.findingsAfter ?? []) lines.push(`  ${finding.type}`);
  }
  return lines.join("\n");
};

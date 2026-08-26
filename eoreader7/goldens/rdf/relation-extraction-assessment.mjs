#!/usr/bin/env node
// Cross-document assay for the connector-class gate used by the host belief
// graph. The small expected-entity lists are disclosed human calibration,
// used only after extraction; they never nominate a verb or alter a reading.

import { readFileSync, writeFileSync } from "node:fs";
import { createSession, admitChunked, sessionReferents } from "../../packages/host/corpus.js";
import { admitGraph, resolveRelations } from "../../packages/host/graph.js";
import { stripContainer } from "../../packages/engine/perceiver/text/spans.js";

const CASES = [
  {
    id: "frankenstein", path: "scripts/adversarial/fixtures/pg84-frankenstein.txt",
    priorPath: "scripts/adversarial/fixtures/pg84-frankenstein.coref.json",
    expected: ["frankenstein", "clerval", "elizabeth", "felix", "safie"],
    knownGap: "The repository's received prior supplies Creature descriptors and narrator scopes; relation attachment still has to expose the applicable mention before identity can resolve it.",
    checks: [
      { fact: "Felix instructed Safie", anchor: "Felix instructed Safie", subject: /felix/i, verb: /^instructed$/i, object: /safie/i, polarity: "+" },
      { fact: "Victor created the being", anchor: "the being I had created", subject: /^(i|victor)$/i, verb: /^created$/i, object: /being|creature|monster/i, polarity: "+" },
      { fact: "the monster murdered Clerval", anchor: "murdered Clerval", subject: /monster|creature|wretch|dæmon/i, verb: /^murdered|killed$/i, object: /clerval/i, polarity: "+" },
    ],
  },
  {
    id: "alice", path: "scripts/adversarial/fixtures/alice-raw.txt",
    expected: ["alice", "rabbit", "hatter", "queen"],
    checks: [
      { fact: "the Rabbit noticed Alice", anchor: "Rabbit noticed Alice", subject: /rabbit/i, verb: /^noticed$/i, object: /alice/i, polarity: "+" },
      { fact: "Alice heard the Rabbit", anchor: "Alice heard the Rabbit say", subject: /alice/i, verb: /^heard$/i, object: /rabbit/i, polarity: "+" },
      { fact: "the Queen spoke to Alice", anchor: "the Queen said to Alice", subject: /queen/i, verb: /^said$/i, object: /alice/i, polarity: "+" },
    ],
  },
  {
    id: "pride-and-prejudice", path: "scripts/adversarial/fixtures/pride-prejudice-raw.txt",
    expected: ["elizabeth", "darcy", "bingley", "jane"],
    checks: [
      { fact: "Elizabeth looked at Darcy", anchor: "Elizabeth looked at Darcy", subject: /elizabeth/i, verb: /^looked$/i, object: /darcy/i, polarity: "+" },
      { fact: "Jane felt affection for Bingley", anchor: "what Jane felt for Bingley", subject: /jane/i, verb: /^felt$/i, object: /bingley/i, polarity: "+" },
      { fact: "Darcy loved Elizabeth", anchor: "his love of you", subject: /darcy/i, verb: /^loved|love$/i, object: /elizabeth/i, polarity: "+" },
    ],
  },
  {
    id: "odyssey", path: "scripts/adversarial/fixtures/odyssey-full.txt",
    // This Butler translation predominantly writes Ulysses and Minerva;
    // calibration follows the received edition's bytes, not modern aliases.
    expected: ["ulysses", "telemachus", "penelope", "minerva"],
    checks: [
      { fact: "Minerva resolved to help Ulysses", anchor: "Minerva resolved to help Ulysses", subject: /minerva/i, verb: /^resolved$/i, object: /ulysses/i, polarity: "+" },
      { fact: "Ulysses spoke to Telemachus", anchor: "Ulysses said to Telemachus", subject: /ulysses/i, verb: /^said$/i, object: /telemachus/i, polarity: "+" },
      { fact: "Penelope mourned Ulysses", anchor: "Penelope went upstairs again and mourned her husband", subject: /penelope/i, verb: /^mourns|mourned$/i, object: /ulysses/i, polarity: "+" },
    ],
  },
];

const read = (text, id, language, priors = []) => {
  const session = createSession({ engineVersion: "eo-2026-07" });
  const sourceId = `${id}:${language ?? "untyped"}`;
  admitChunked(session, { text, sourceId, ...(language ? { language } : {}) });
  const { graph, admitted } = admitGraph(session, { priors });
  const { relations } = resolveRelations(session, { sourceId, priors });
  const { referents } = sessionReferents(session, { sourceId, priors, limit: Infinity });
  const identityText = new Map(referents.map((referent) => [
    referent.id,
    [referent.display, ...referent.surfaces.map((surface) => typeof surface === "string" ? surface : surface?.surface)].filter(Boolean).join(" "),
  ]));
  const keys = [...graph.edges.keys()].filter((key) => key.split("|")[1].replace(/^!/, ""));
  return { relations_stated: admitted[0]?.stated ?? 0, relations, referents, identityText, nodes: [...graph.nodes.keys()], predicates: keys.map((key) => key.split("|")[1].replace(/^!/, "")) };
};

const hitExpected = (reading, expected) => expected.filter((name) =>
  reading.referents.some((referent) => reading.nodes.includes(referent.id) && reading.identityText.get(referent.id).toLowerCase().includes(name)));
const artifact = { schema: "RelationExtractionAssessment@1", prior: "bin/priors/pos/en-ud-ewt.json", cases: [] };

for (const testCase of CASES) {
  const raw = readFileSync(testCase.path, "utf8").replace(/\r\n?/g, "\n");
  const { text } = stripContainer(raw);
  const priors = testCase.priorPath ? JSON.parse(readFileSync(testCase.priorPath, "utf8")).referents : [];
  const baseline = read(text, testCase.id, null, priors);
  const posGated = read(text, testCase.id, "en", priors);
  const handChecks = testCase.checks.map((check) => {
    if (!text.includes(check.anchor)) throw new Error(`${testCase.id}: hand-check anchor not found: ${check.anchor}`);
    const match = posGated.relations.find((relation) =>
      posGated.identityText.has(relation.subject) && posGated.identityText.has(relation.object) &&
      check.subject.test(posGated.identityText.get(relation.subject)) && check.verb.test(relation.verb) &&
      check.object.test(posGated.identityText.get(relation.object)) && relation.polarity === check.polarity);
    return { fact: check.fact, anchor: check.anchor, expected_polarity: check.polarity, found: Boolean(match), extracted: match ?? null };
  });
  artifact.cases.push({
    id: testCase.id,
    path: testCase.path,
    expected_entities: testCase.expected,
    known_gap: testCase.knownGap ?? null,
    referent_prior: testCase.priorPath ?? null,
    baseline: { relations_stated: baseline.relations_stated, predicates: baseline.predicates.length },
    pos_gated: {
      relations_stated: posGated.relations_stated,
      predicates: posGated.predicates.length,
      expected_entities_found: hitExpected(posGated, testCase.expected),
      expected_entities_missed: testCase.expected.filter((name) => !hitExpected(posGated, testCase.expected).includes(name)),
    },
    relations_refused_by_pos_gate: baseline.relations_stated - posGated.relations_stated,
    hand_checks: { found: handChecks.filter((check) => check.found).length, total: handChecks.length, rows: handChecks },
  });
}

writeFileSync("goldens/rdf/results/relation-extraction-assessment.json", `${JSON.stringify(artifact, null, 2)}\n`);
console.log(artifact.cases.map((c) => `${c.id}: ${c.baseline.relations_stated} -> ${c.pos_gated.relations_stated}; known ${c.pos_gated.expected_entities_found.length}/${c.expected_entities.length}`).join("\n"));

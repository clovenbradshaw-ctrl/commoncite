#!/usr/bin/env node
// RDF-programme measurement: capture the host belief graph and a
// commensurable order-perturbed null through identical, staged admission.
// This does not manufacture RDF when the received snapshot is unavailable.

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createSession, admitChunked } from "../../packages/host/corpus.js";
import { admitGraph, sessionGraphSnapshot } from "../../packages/host/graph.js";
import { splitSentences, stripContainer } from "../../packages/engine/perceiver/text/spans.js";

const materialPath = process.argv[2] ?? "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const outputPath = process.argv[3] ?? "goldens/rdf/results/rdf-belief-frankenstein.json";
const raw = readFileSync(materialPath, "utf8").replace(/\r\n?/g, "\n");
const { text: material } = stripContainer(raw);

const digest = (value) => createHash("sha256").update(value).digest("hex");

const SENTENCES_PER_STAGE = 25;

function read(stages, sourceId) {
  const session = createSession({ engineVersion: "eo-2026-07" });
  let chunks = 0;
  let relationsStated = 0;
  const trajectory = [];
  let lastAdmission = null;
  for (const [cursor, stage] of stages.entries()) {
    const stageSourceId = `${sourceId}:cursor-${cursor + 1}:material-${stage.materialCursor}`;
    const corpus = admitChunked(session, { text: stage.text, sourceId: stageSourceId, language: "en" });
    chunks += corpus.chunks;
    const admission = admitGraph(session, { sourceId: stageSourceId });
    lastAdmission = admission.admitted[0];
    relationsStated += lastAdmission.stated;
    const snapshot = sessionGraphSnapshot(session, { limit: 0 });
    trajectory.push({
      cursor: cursor + 1,
      material_cursor: stage.materialCursor,
      graph_tick: snapshot.tick,
      node_count: snapshot.nodeCount,
      edge_count: snapshot.edgeCount,
      stated: lastAdmission.stated,
    });
  }
  const graph = sessionGraphSnapshot(session, { limit: 25 });
  const keys = [...session.graph.edges.keys()];
  return {
    chunks,
    stages: stages.length,
    relations_stated: relationsStated,
    last_admission: lastAdmission,
    trajectory,
    graph,
    edge_shape: {
      verb_typed: keys.filter((key) => key.split("|")[1].replace(/^!/, "").length > 0).length,
      structural: keys.filter((key) => key.split("|")[1].replace(/^!/, "").length === 0).length,
      negative: keys.filter((key) => key.split("|")[1].startsWith("!")).length,
    },
  };
}

// Reversing fixed sentence-stage order preserves the same sentence bytes and
// uses the same host pipeline. It perturbs discourse/order rather than
// substituting a hand-built scoring procedure. The transformation and digest
// are recorded.
const sentences = splitSentences(material).map((sentence) => sentence.text);
const stages = [];
for (let from = 0; from < sentences.length; from += SENTENCES_PER_STAGE) {
  stages.push({ materialCursor: stages.length + 1, text: sentences.slice(from, from + SENTENCES_PER_STAGE).join(" ") });
}
const nullStages = [...stages].reverse();
const nullMaterial = nullStages.map((stage) => stage.text).join(" ");
const observed = read(stages, "project-gutenberg:pg84:observed");
const orderNull = read(nullStages, "project-gutenberg:pg84:stage-reversal-null");

const rdfShape = (reading) => ({
  entity_nodes: reading.graph.nodeCount,
  live_edges: reading.graph.edgeCount,
  predicates_present: reading.edge_shape.verb_typed,
  directional_edges: reading.graph.edgeCount,
  negative_edges: reading.edge_shape.negative,
  stable_external_ids: 0,
  rdf_correspondences_confirmed: 0,
});

const artifact = {
  schema: "RDFBeliefAssessment@2",
  standing: {
    graph_shape: "measured",
    rdf_quality: "refused",
  },
  measured_at: new Date().toISOString(),
  subject: "host-assembled engine belief graph at the admission cursor",
  material: {
    path: materialPath,
    giver: "Project Gutenberg (fixture already admitted by this repository)",
    sha256: digest(material),
    bytes: Buffer.byteLength(material),
    sentences: sentences.length,
    staging: { sentences_per_stage: SENTENCES_PER_STAGE, stages: stages.length },
  },
  received_rdf: {
    status: "gap",
    triples: 0,
    reason: "No giver-named RDF snapshot is mounted; network acquisition returned HTTP 403 and was not replaced with ambient model knowledge.",
  },
  observed: { ...rdfShape(observed), ...observed },
  null: {
    perturbation: "reverse the order of fixed 25-sentence stages while preserving sentence order within each stage",
    sha256: digest(nullMaterial),
    ...rdfShape(orderNull),
    ...orderNull,
  },
  verdict: {
    rdf_quality: "refused",
    reason: "Entity and relation overlap cannot be scored without received RDF rows and confirmed correspondences.",
    assessable_now: "graph shape and order sensitivity only",
  },
};

writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`${outputPath}: ${observed.graph.nodeCount} nodes/${observed.graph.edgeCount} edges; null ${orderNull.graph.nodeCount}/${orderNull.graph.edgeCount}; RDF ${artifact.received_rdf.status}`);

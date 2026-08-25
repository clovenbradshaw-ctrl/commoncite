// eoreader6 · scripts/build-canon-prior — induce a CANON prior from a real
// corpus: the relation-verb vocabulary and its usage distribution, which is
// what actually transfers between works (a character edge does not; "what
// verbs a canon's prose does, and how often" does). Offline, batch, same
// posture as build-morphology-prior.mjs and induction-live-priors.mjs:
// run once against a corpus, persist the induced DATA to bin/priors/canon/
// (data only, no code, staged for eoPriors), and let the reading consume
// it as a received prior with a named giver.
//
// The consumer is emergence/surprise.js — bayesianSurprise/shannonSurprisal
// against ANY prior — via packages/host/canon.js. No new statistic exists
// here; a canon is just a received prior for the organ that already
// measures movement of belief.
//
//   node scripts/build-canon-prior.mjs <book.txt> <population-label> [out.json]

import { readFileSync, writeFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { extractRelations, discoverRelationVocab } from "../packages/engine/perceiver/text/relations.js";
import { extractSurfaces } from "../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../packages/engine/perceiver/text/material.js";

const SENTENCES_PER_FRAME = 6; // read-people.mjs's own frame size
const MIN_SURFACES = 1;        // same declared literal, same justification

const path = process.argv[2];
const population = process.argv[3];
const out = process.argv[4] || "bin/priors/canon/en-novel-verbs.json";
if (!path || !population) {
  console.error("usage: node scripts/build-canon-prior.mjs <book.txt> <population-label> [out.json]");
  process.exit(1);
}

const raw = readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const { text } = stripContainer(raw);
const sentences = splitSentences(text);
const frames = [];
for (let i = 0; i < sentences.length; i += SENTENCES_PER_FRAME)
  frames.push(sentences.slice(i, i + SENTENCES_PER_FRAME).map((s) => s.text).join(" "));

const words = tokenize(text);
const table = buildFrequencyTable(words);
const functionWords = functionWordSet(table);
const surfaces = extractSurfaces(sentences, { functionWords });
const { verbs } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: MIN_SURFACES });

const usage = new Map();
let total = 0;
for (const frame of frames)
  for (const t of extractRelations(frame, { verbs, functionWords })) {
    usage.set(t.verb, (usage.get(t.verb) ?? 0) + 1);
    total += 1;
  }

const prior = {
  $comment: "A CANON prior. Data only, no code. Staged here for transfer to eoPriors; nothing in packages/ may hardcode any of it.",
  schema: "CanonVerbPrior@1",
  population,
  reader_version: "eo-2026-07",
  provenance: {
    source: `Induced by eoreader6 scripts/build-canon-prior.mjs from ${path} (measured relation vocabulary via discoverRelationVocab, minSurfaces=${MIN_SURFACES}; usage counted over ${SENTENCES_PER_FRAME}-sentence frames by extractRelations)`,
    built_by: "scripts/build-canon-prior.mjs",
  },
  notes: [
    "verbs: relation-verb usage counts over the canon corpus — the distribution a new work's frames are measured against.",
    "Consumed by packages/host/canon.js::canonSurprise via emergence/surprise.js (bayesianSurprise against a received prior).",
    "What transfers between works is the verb vocabulary and its distribution, never character-level edges.",
  ],
  total,
  verbs: Object.fromEntries([...usage.entries()].sort((a, b) => b[1] - a[1])),
};

writeFileSync(out, JSON.stringify(prior, null, 1) + "\n");
console.log(`induced ${usage.size} verbs, ${total} usages, from ${frames.length} frames → ${out}`);

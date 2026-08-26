// native/eval/reading-grain.mjs — does the reading GRAIN change what is read?
//
// `createCausalTextPerceiver({ refreshEvery: N })` re-derives its surfaces and
// relation vocabulary every N sentences. Between refreshes the reader is using
// STALE state: at N=25, sentence 30 is read against evidence that stopped at
// sentence 25. That is not reading in order at the grain the material has —
// it is reading in order at the grain the OPTIMIZATION has. Reading one
// proposition at a time is N=1.
//
// Measured (Hamlet, whole): N=25 -> 411 arrangements in 4s; N=1 -> 490 in 66s.
// Batching costs ~19% of what the material offers, and buys ~16x wall clock.
// The cost is `refresh()` re-scanning all prior sentences each time, which is
// an incremental-algorithm problem to solve, NOT a reason to coarsen the
// grain: the honest reading grain is one proposition, and a slower correct
// reader is not the same thing as a faster wrong one.
//
// WHAT IS COUNTED, NAMED HONESTLY. These are the text adapter's ternary
// arrangements — (first slot, link slot, second slot) — as produced by
// `relations.js`, which nominates the link slot as "the token immediately
// FOLLOWING a candidate referent surface: the slot SVO order puts a verb in".
// That is three ASSUMPTIONS about the medium (natural language; that it has
// verbs; that it is subject-verb-object), and they belong to this adapter,
// not to the reader. The earned representation is the ARRANGEMENT — an
// ordered first end, a label, an ordered second end. Calling the middle slot
// a "verb" is a declared English overlay, and no number here should be quoted
// as the reader's capacity to find structure in material generally.
//
// Usage: node native/eval/reading-grain.mjs <book.txt> [--grains 1,25]

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));

async function readAt(stripped, refreshEvery) {
  const perceiver = createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery, posPrior: POS_PRIOR });
  const encounters = textEncounters(stripped.text, { source: "grain", offset: stripped.offset });
  const started = Date.now();
  let arrangements = 0;
  const links = new Set();
  for (const encounter of encounters) {
    for (const candidate of (await perceiver.perceive(encounter, {})) ?? []) {
      for (const edge of candidate.candidate?.hyperedges ?? []) {
        arrangements += 1;
        if (edge.relation) links.add(edge.relation);
      }
    }
  }
  return { refreshEvery, sentences: encounters.length, linkForms: links.size, arrangements, seconds: Math.round((Date.now() - started) / 1000) };
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/reading-grain.mjs <book.txt> [--grains 1,25]");
  const gi = process.argv.indexOf("--grains");
  const grains = (gi > -1 ? process.argv[gi + 1] : "1,25").split(",").map(Number);
  const stripped = fs.readFileSync(path, "utf8");
  const material = stripContainer(stripped);
  if (!material.looks_like_material) throw new Error("input does not look like readable material");

  const runs = [];
  for (const grain of grains) {
    console.error(`${path.split("/").pop()} at refreshEvery=${grain}...`);
    runs.push(await readAt(material, grain));
  }
  const finest = runs.find((r) => r.refreshEvery === Math.min(...grains));
  console.log(JSON.stringify({
    schema: "EOReadingGrain@1",
    book: path.split("/").pop(),
    counted: "ternary arrangements from the text adapter — (first slot, link slot, second slot). 'verb' is a declared English overlay on the link slot, not the reader's own category.",
    runs: runs.map((r) => ({ ...r, shareOfFinestGrain: finest ? Number((r.arrangements / Math.max(1, finest.arrangements)).toFixed(3)) : null })),
  }, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });

// native/eval/book-lexicon.mjs — the full lexicon of a book, read whole.
//
// READS THE WHOLE BOOK BY DEFAULT, and that is the point. This suite spent a
// session reporting figures from 700-sentence prefixes taken as a runtime
// budget, and every one of them was wrong: `discoverRelationVocab` measures
// recurrence of a candidate verb across DISTINCT capitalized surfaces over
// the material it is given, which is a whole-book statistic that COLLAPSES
// under truncation rather than degrading. Dracula at 7% yields 3 recurring
// verbs; Dracula whole yields 135. Full account:
// native/eval/results/vocabulary-scale-FINDING.md.
//
// `--limit N` exists for smoke runs only, and any run that uses it says so in
// its own output (`truncated: true`) so a sliced number can never be quoted
// as a book's number. A prefix is a different material, not a smaller one.
//
// Usage: node native/eval/book-lexicon.mjs <book.txt> [--limit N]

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { reviseTextFold } from "../adapters/text/revision.js";
import { createRecursiveReader } from "../kernel/reading.js";
import { projectLexicon } from "../kernel/lexicon.js";

const CANONICALIZATION_FLOOR = 2;
const ANCHORING = { minActivation: 0.05, minMargin: 0.2 };
const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));

const emptyRetrieve = (_fold, evidence) => Object.freeze({
  schema: "EORelevantFold@1", witnessed: Object.freeze([...evidence]), provisional: Object.freeze([]),
  expectations: Object.freeze([]), obligations: Object.freeze([]), exclusions: Object.freeze([]),
  unresolvedAlternatives: Object.freeze([]), activeFrames: Object.freeze([]), receivedPriors: Object.freeze([]),
});

async function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/book-lexicon.mjs <book.txt> [--limit N]");
  const li = process.argv.indexOf("--limit");
  const limit = li > -1 ? Number(process.argv[li + 1]) : null;

  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  if (!stripped.looks_like_material) throw new Error("input does not look like readable material");
  const all = textEncounters(stripped.text, { source: `file:${path.split("/").pop()}`, offset: stripped.offset });
  const encounters = limit ? all.slice(0, limit) : all;
  console.error(`reading ${encounters.length}${limit ? ` of ${all.length} (TRUNCATED)` : " (whole book)"} encounters...`);

  const reader = createRecursiveReader({
    perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25, posPrior: POS_PRIOR, descriptorAnchoring: ANCHORING })],
    adapters: { revise: (a) => reviseTextFold({ ...a, canonicalizationFloor: CANONICALIZATION_FLOOR }), retrieve: emptyRetrieve },
  });
  for (const enc of encounters) await reader.step(enc);

  const lexicon = projectLexicon(reader.getLog(), { perTerrain: 20 });
  console.log(JSON.stringify({
    schema: "EOBookLexicon@1",
    book: path.split("/").pop(),
    read: { encounters: encounters.length, ofTotal: all.length, truncated: Boolean(limit) },
    declared: { canonicalizationFloor: CANONICALIZATION_FLOOR, anchoring: ANCHORING, posPrior: "bin/priors/pos/en-ud-ewt.json (refuses only, never admits)" },
    counts: lexicon.counts,
    referentCount: lexicon.referentCount,
    relationFormCount: lexicon.relationCount,
    relations: lexicon.relations.slice(0, 20).map((r) => ({ relation: r.relation, witnessed: r.witnessed, eligible: r.eligible, dominantClass: r.dominantClass })),
    referents: lexicon.referents.slice(0, 15).map((r) => ({ display: r.display, mentions: r.mentions, firstSeenAt: r.firstSeenAt })),
    emptyTerrains: Object.entries(lexicon.terrains).filter(([, v]) => v.empty).map(([t, v]) => ({ terrain: t, filledBy: v.filledBy })),
  }, null, 1));
}

main().catch((err) => { console.error(err); process.exit(1); });

// native/eval/experienced-new-book.mjs — read a NET NEW book as a reader who
// has read other books first, and show the Hyperlexicon that results.
//
// "We never read Frankenstein as our first book" — so this driver never reads
// the target as a first book either. Prior works are read to completion, each
// sedimented into portable memory the moment it finishes (PR #17's own
// discipline), and only that bounded memory is carried into the new book.
// Nothing from the target enters any prior; memory is never witness.
//
// The two halves of carried experience, composed (rhythm-priors.js):
//   WHICH — EOExperiencePrior@1 (experience-priors.js): relation forms,
//           network signatures, terrain/stance/operator expectations.
//   WHEN  — EORhythmPrior@1 (rhythm-priors.js): how soon an admitted being,
//           once mentioned, returns.
//
// THE HYPERLEXICON is the payoff surface, and its whole point is a wall:
// it is NOT a vocabulary or a synonym table, it is a ledger of relation-
// COMPOSITION affordances, and "experience may nominate candidates; only a
// GIVEN affordance with a named giver licenses composition." So a reader
// with priors does not thereby get to reason further — it gets to NOMINATE
// further, and every nomination that no giver has licensed is shown here as
// withheld, with the reason attached. That is the surface worth looking at:
// what the reader now sees, next to what it still refuses to conclude.
//
// DECLARED: prefix lengths are a runtime budget, stated not hidden — a full
// four-book run is ~40 minutes here. `--prior N` / `--target N` override.
//
// Usage:
//   node native/eval/experienced-new-book.mjs <target.txt> <prior.txt>...

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { anchorAsDefiniteBinding } from "../adapters/text/anchoring.js";
import { reviseTextFold } from "../adapters/text/revision.js";
import { createRecursiveReader } from "../kernel/reading.js";
import { createPriorConditionedReader } from "../kernel/experienced-reading.js";
import { deriveExperiencePrior, mergeExperiencePriors } from "../kernel/experience-priors.js";
import { deriveRhythmPrior, mergeRhythmPriors, composeExperience, scoreRhythmExpectations } from "../kernel/rhythm-priors.js";
import { createHyperlexicon, giveHyperlexiconAffordance, admitHyperlexiconCandidates, compositionAffordance } from "../kernel/hyperlexicon.js";
import { createRelationCompositionLedger, evaluateRelationCompositions, consequentialWithheldCompositions, acquireCompositionCandidates } from "../kernel/relation-composition.js";

const GIVER = "reader:experienced-new-book";
const CANONICALIZATION_FLOOR = 2; // binding.js's structural minimum, as elsewhere in this suite
const ANCHORING = { minActivation: 0.05, minMargin: 0.2 };
const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};

const emptyRetrieve = (_fold, evidence) => Object.freeze({
  schema: "EORelevantFold@1", witnessed: Object.freeze([...evidence]), provisional: Object.freeze([]),
  expectations: Object.freeze([]), obligations: Object.freeze([]), exclusions: Object.freeze([]),
  unresolvedAlternatives: Object.freeze([]), activeFrames: Object.freeze([]), receivedPriors: Object.freeze([]),
});

const adapters = {
  revise: (args) => reviseTextFold({ ...args, canonicalizationFloor: CANONICALIZATION_FLOOR }),
  retrieve: emptyRetrieve,
};
const perceivers = () => [createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25, posPrior: POS_PRIOR, descriptorAnchoring: ANCHORING })];

function load(path, source, limit) {
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  if (!stripped.looks_like_material) throw new Error(`${path} does not look like readable material`);
  const all = textEncounters(stripped.text, { source, offset: stripped.offset });
  return limit ? all.slice(0, limit) : all;
}

async function readWith(reader, encounters) {
  for (const enc of encounters) await reader.step(enc);
  return { fold: reader.getFold(), log: reader.getLog?.() ?? [] };
}

async function main() {
  const files = process.argv.slice(2).filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));
  const [targetPath, ...priorPaths] = files;
  if (!targetPath || !priorPaths.length) throw new TypeError("usage: node native/eval/experienced-new-book.mjs <target.txt> <prior.txt>... [--prior N] [--target N]");
  const priorLimit = arg("--prior", 1200);
  const targetLimit = arg("--target", 2000);

  // ── prior works: read, sediment, DROP the raw reading ────────────────
  const sedimented = [];
  for (const path of priorPaths) {
    const source = `file:${path.split("/").pop()}`;
    console.error(`reading prior work ${source} (${priorLimit} encounters)...`);
    const reader = createRecursiveReader({ perceivers: perceivers(), adapters });
    const reading = await readWith(reader, load(path, source, priorLimit));
    const item = { source, reading };
    sedimented.push({
      source,
      which: deriveExperiencePrior([item], { giver: GIVER, id: `experience:${source}` }),
      when: deriveRhythmPrior([item], { giver: GIVER, id: `rhythm:${source}` }),
    });
    // the raw reading falls out of scope here — only bounded memory accumulates
  }

  const carried = composeExperience({
    experience: mergeExperiencePriors(sedimented.map((s) => s.which), { giver: GIVER, id: "experience:carried" }),
    rhythm: mergeRhythmPriors(sedimented.map((s) => s.when), { giver: GIVER, id: "rhythm:carried" }),
    giver: GIVER,
    id: "reader-experience:carried",
  });

  // ── the net-new book, read BY A READER THAT HAS READ BEFORE ──────────
  const targetSource = `file:${targetPath.split("/").pop()}`;
  console.error(`reading NEW book ${targetSource} (${targetLimit} encounters) with ${carried.sourceCount} prior work(s)...`);
  const experienced = createPriorConditionedReader({ perceivers: perceivers(), adapters, priors: [carried] });
  const target = await readWith(experienced, load(targetPath, targetSource, targetLimit));

  // ── the Hyperlexicon ────────────────────────────────────────────────
  // Composition chains bridge on RESOLVED referents. This branch's anchoring
  // emits EOAnchorEvidence@1; the ledger reads EODefiniteBinding@1. Project
  // one into the other (anchoring.js::anchorAsDefiniteBinding — the two
  // schemas are the same fact built from two directions) or the reader has
  // no bridges at all and the Hyperlexicon comes back empty. Measured: the
  // first run of this driver, 932 relation edges, 0 bindings, 0 candidates.
  const rawEntries = target.fold.graphEntries ?? [];
  const projectedBindings = rawEntries.map(anchorAsDefiniteBinding).filter(Boolean);
  const entries = [...rawEntries, ...projectedBindings];
  const ledger = createRelationCompositionLedger(entries);
  const stats = ledger.diagnostics();

  // Experience NOMINATES: every relation form the prior works recurrently
  // met, paired as it composes in the new book, enters as a CANDIDATE.
  const remembered = new Set((carried.experience?.relationVocabulary ?? []).filter((r) => r.recurrent).map((r) => r.relation));
  const observed = acquireCompositionCandidates(entries, { minWitnesses: 2 });
  const nominated = observed.filter((c) => remembered.has(c.left) || remembered.has(c.right));
  let hyperlexicon = admitHyperlexiconCandidates(createHyperlexicon(), nominated.map((c) => ({
    left: c.left, right: c.right, giver: GIVER,
    witnesses: (c.witnesses ?? []).slice(0, 3).map((w) => w?.[0]).filter(Boolean),
    meta: { rememberedLeft: remembered.has(c.left), rememberedRight: remembered.has(c.right), independentSupport: c.meta?.support ?? 0 },
  })));

  // A GIVEN affordance requires a named giver — and this driver gives exactly
  // one, explicitly, so the licensed/withheld split is visible rather than
  // theoretical. Chosen mechanically: the best-supported nomination whose
  // BOTH sides are cross-work memories (an affordance about forms this
  // reader has genuinely met before, not about this book's own accidents).
  const givable = nominated.filter((c) => remembered.has(c.left) && remembered.has(c.right))
    .sort((a, b) => (b.meta?.support ?? 0) - (a.meta?.support ?? 0))[0];
  if (givable) {
    hyperlexicon = giveHyperlexiconAffordance(hyperlexicon, {
      left: givable.left, right: givable.right, giver: GIVER,
      meta: { basis: "both sides are recurrent cross-work memories of this reader's prior works" },
    });
  }

  const evaluated = evaluateRelationCompositions(entries, hyperlexicon);
  const withheldGroups = consequentialWithheldCompositions(evaluated);

  const rhythmScore = scoreRhythmExpectations(target, carried.rhythm);

  // ── report ──────────────────────────────────────────────────────────
  const composition = Object.values(hyperlexicon.composition);
  const out = {
    schema: "EOExperiencedNewBook@1",
    declared: { priorLimit, targetLimit, canonicalizationFloor: CANONICALIZATION_FLOOR, anchoring: ANCHORING, giver: GIVER },
    priorWorks: sedimented.map((s) => ({
      source: s.source,
      relationForms: s.which.relationVocabulary.length,
      medianGap: s.when.medianGap,
      gapCount: s.when.gapCount,
    })),
    carriedExperience: {
      schema: carried.schema,
      carries: carried.carries,
      sourceRefs: carried.sourceRefs,
      witnessed: carried.witnessed,
      admissible: carried.admissible,
      which: {
        relationForms: carried.experience.relationVocabulary.length,
        recurrentAcrossWorks: carried.experience.relationVocabulary.filter((r) => r.recurrent).length,
        topRecurrent: carried.experience.relationVocabulary.filter((r) => r.recurrent).slice(0, 12).map((r) => ({ relation: r.relation, works: r.workSupport, standing: r.memoryStanding })),
        networkPatterns: carried.experience.networkPatterns.length,
      },
      when: { medianGap: carried.rhythm.medianGap, gapCount: carried.rhythm.gapCount, memoryStanding: carried.rhythm.memoryStanding },
    },
    newBook: {
      source: targetSource,
      projectedBindings: projectedBindings.length,
      encounters: targetLimit,
      relationEdges: stats.relationEdges,
      referentBindings: stats.referentBindings,
      chainSites: stats.chainSites,
      pairTypes: stats.pairTypes,
      repeatedPairTypes: stats.repeatedPairTypes,
      rhythmExpectation: rhythmScore,
    },
    hyperlexicon: {
      schema: hyperlexicon.schema,
      entries: composition.length,
      given: composition.filter((e) => e.standing === "given").map((e) => ({ left: e.left, right: e.right, giver: e.giver, basis: e.provenance.basis })),
      candidates: composition.filter((e) => e.standing === "candidate").slice(0, 25).map((e) => ({
        left: e.left, right: e.right, standing: e.standing, giver: e.giver,
        rememberedLeft: e.meta.rememberedLeft, rememberedRight: e.meta.rememberedRight,
        independentSupport: e.meta.independentSupport, basis: e.provenance.basis,
      })),
      candidateCount: composition.filter((e) => e.standing === "candidate").length,
    },
    composition: {
      licensed: evaluated.licensed.length,
      withheld: evaluated.withheld.length,
      withheldPairTypes: withheldGroups.length,
      licensedExamples: evaluated.licensed.slice(0, 5).map((c) => ({ from: c.from, bridge: c.bridge, to: c.to, left: c.leftPredicate, right: c.rightPredicate, giver: c.provenance.giver })),
      withheldExamples: withheldGroups.slice(0, 8).map((g) => ({ left: g.leftPredicate, right: g.rightPredicate, standing: g.standing, sites: g.examples.length, reason: g.reason })),
    },
    // The wall, stated as a fact of the run rather than a promise.
    disclosure: "experience nominated candidates; only the single explicitly GIVEN affordance licensed composition — every other adjacency, however well witnessed, is withheld with its reason attached",
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });

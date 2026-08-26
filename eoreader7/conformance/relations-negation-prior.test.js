import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { discoverRelationVocab, extractRelations } from "../packages/engine/perceiver/text/relations.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EU = new Set(JSON.parse(readFileSync(join(root, "bin/priors/lang/eu.json"), "utf8")).negation);
const PCM = new Set(JSON.parse(readFileSync(join(root, "bin/priors/lang/pcm.json"), "utf8")).negation);
const AAVE = new Set(JSON.parse(readFileSync(join(root, "bin/priors/lang/en-AAVE.json"), "utf8")).negation);

// A tiny, hand-shaped Basque-like fixture: "Ez" (the vendored negation
// particle) fronts a finite verb before a candidate object, twice — enough
// for discoverRelationVocab's own minSurfaces=1 gate. Real material (Garoa,
// eval/vendored-prior-eval.md in the-fold repo) is where the real result
// lives; this fixture only pins the injection SEAM itself, deterministically.
// Two surfaces, so "zetorren" enters the vocabulary through an AFFIRMATIVE
// use after a DIFFERENT surface first (hypergraph.test.mjs's own "loved"
// fixture in the-fold proves the same shape is needed for English: a verb
// that only ever follows a surface inside its own negated clause never
// clears vocabulary discovery, which looks at the token immediately after a
// surface — "ez" sits in that exact slot when Basque negation fronts the
// verb, so "zetorren" is never seen there at all in a negated-only clause).
const SURFACE = "Joanes";
const OTHER = "Maritxu";
const TEXT = `${OTHER} zetorren gaur. ${SURFACE} artzaia zen. ${SURFACE} ez zetorren gaur.`;
// Every real caller of this organ (hypergraph.js, packages/host/corpus.js's
// discoveredCast) already supplies functionWords — never omitted — so every
// test below does too, both to be representative and because of a real,
// separately-disclosed, pre-existing defect this fixture exposed while
// being built: with functionWords OMITTED, extractRelations's fallback
// object shape (`(.+?)(?:\.|,|;|$)`) consumes its own terminating period as
// part of m[0], so `clauseEndAfter(m.index + m[0].length)` searches forward
// from a position already past that period and can land on a LATER
// clause's own terminator instead of "here" — on two short back-to-back
// sentences this walked `previousMatchEnd` past the very match it was
// meant to bound, producing an EMPTY polarity window (`windowStart` ended
// up greater than `subjEnd`) and silently losing a real "ez" this way.
// Dormant in production (nothing here calls extractRelations without
// functionWords), not fixed here — a different, unrelated bug in the other
// code path, found while verifying this seam, named rather than chased.
const functionWords = new Set(["gaur", "zen", "is", "here"]);

test("negationWords defaults to the English prior — unchanged from before this seam existed", () => {
  const { verbs } = discoverRelationVocab(TEXT, { surfaces: [SURFACE, OTHER], minSurfaces: 1, functionWords });
  const rels = extractRelations(TEXT, { verbs, functionWords });
  // With no injected prior, "ez" is not excluded from vocabulary candidacy
  // and the negation-before-verb regex has no Basque trigger to fire on —
  // the default behaviour is exactly what existed before this file.
  assert.ok(rels.length > 0, "the extractor still runs with nothing injected");
  assert.ok(
    rels.every((r) => r.polarity === "+"),
    `with no Basque prior injected, nothing in this fixture can read as negated: ${JSON.stringify(rels)}`,
  );
});

test("an injected Basque prior lets a real 'ez' clause read negative", () => {
  const { verbs } = discoverRelationVocab(TEXT, { surfaces: [SURFACE, OTHER], minSurfaces: 1, negationWords: EU, functionWords });
  const rels = extractRelations(TEXT, { verbs, negationWords: EU, functionWords });
  const negated = rels.filter((r) => r.polarity === "-");
  assert.ok(negated.length > 0, `expected at least one negated relation, got: ${JSON.stringify(rels)}`);
});

test("the vendored particle itself is never admitted into the measured vocabulary", () => {
  // "ez" recurs immediately before verb-shaped tokens in the fixture, which
  // is exactly the shape discoverRelationVocab admits candidates from — the
  // injected prior's whole job is to keep it out, the same exclusion
  // NEGATION_WORDS already earns for English "not"/"never"/etc.
  const { verbs } = discoverRelationVocab(TEXT, { surfaces: [SURFACE, OTHER], minSurfaces: 1, negationWords: EU, functionWords });
  assert.ok(!verbs.has("ez"), `"ez" must never be admitted as a verb: ${[...verbs].join(", ")}`);
});

test("the English 'no longer' idiom never leaks onto an injected language's own closed class", () => {
  const t = `${SURFACE} is here. ${SURFACE} no longer stays.`;
  const { verbs } = discoverRelationVocab(t, { surfaces: [SURFACE], minSurfaces: 1, negationWords: EU, functionWords });
  const rels = extractRelations(t, { verbs, negationWords: EU, functionWords });
  // "no longer" is an English MULTI-WORD idiom appended only to the
  // module's own default NEGATION_WORDS (by reference equality) — an
  // injected Basque Set must not inherit it.
  const stays = rels.find((r) => r.verb === "stays");
  if (stays) assert.equal(stays.polarity, "+", "an injected non-English prior must not match the English idiom");
});

test("nothing in relations.js hardcodes \"ez\" — the vendored file is the only place it lives", () => {
  const code = readFileSync(join(root, "packages/engine/perceiver/text/relations.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.ok(!/["']ez["']/.test(code), 'relations.js hardcodes "ez" — that belongs in the vendored prior, not the organ');
});

// Nigerian Pidgin (pcm). Same shape as the Basque fixture above and for the
// same reason: "sabi" must first clear vocabulary discovery via an
// AFFIRMATIVE use after a DIFFERENT surface (Ngozi), since the token
// immediately after Chidi in his own negated clause is "no" itself.
// Confirmed live via a scratch script before this was written into the
// suite; real material is eval/vendored-prior-eval.md in the-fold repo.
const PCM_SURFACE = "Chidi";
const PCM_OTHER = "Ngozi";
const PCM_TEXT = `${PCM_OTHER} sabi am well. ${PCM_SURFACE} dey house. ${PCM_SURFACE} no sabi am well.`;
const pcmFunctionWords = new Set(["am", "well", "house", "dey"]);

test("an injected Nigerian Pidgin prior lets a real 'no' clause read negative", () => {
  const { verbs } = discoverRelationVocab(PCM_TEXT, {
    surfaces: [PCM_SURFACE, PCM_OTHER],
    minSurfaces: 1,
    negationWords: PCM,
    functionWords: pcmFunctionWords,
  });
  const rels = extractRelations(PCM_TEXT, { verbs, negationWords: PCM, functionWords: pcmFunctionWords });
  const negated = rels.filter((r) => r.polarity === "-");
  assert.ok(negated.length > 0, `expected at least one negated relation, got: ${JSON.stringify(rels)}`);
});

test("the Nigerian Pidgin particle 'no' is never admitted into the measured vocabulary", () => {
  const { verbs } = discoverRelationVocab(PCM_TEXT, {
    surfaces: [PCM_SURFACE, PCM_OTHER],
    minSurfaces: 1,
    negationWords: PCM,
    functionWords: pcmFunctionWords,
  });
  assert.ok(!verbs.has("no"), `"no" must never be admitted as a verb: ${[...verbs].join(", ")}`);
});

// AAVE. Same two-surface shape: "know" must clear vocabulary discovery via
// Tanya's affirmative use before Marcus's "ain't" clause is ever read.
const AAVE_SURFACE = "Marcus";
const AAVE_OTHER = "Tanya";
const AAVE_TEXT = `${AAVE_OTHER} know that answer. ${AAVE_SURFACE} home today. ${AAVE_SURFACE} ain't know that answer.`;
const aaveFunctionWords = new Set(["that", "answer", "today", "home"]);

test("an injected AAVE prior lets a real 'ain't' clause read negative", () => {
  const { verbs } = discoverRelationVocab(AAVE_TEXT, {
    surfaces: [AAVE_SURFACE, AAVE_OTHER],
    minSurfaces: 1,
    negationWords: AAVE,
    functionWords: aaveFunctionWords,
  });
  const rels = extractRelations(AAVE_TEXT, { verbs, negationWords: AAVE, functionWords: aaveFunctionWords });
  const negated = rels.filter((r) => r.polarity === "-");
  assert.ok(negated.length > 0, `expected at least one negated relation, got: ${JSON.stringify(rels)}`);
});

test("the AAVE particle \"ain't\" is never admitted into the measured vocabulary", () => {
  const { verbs } = discoverRelationVocab(AAVE_TEXT, {
    surfaces: [AAVE_SURFACE, AAVE_OTHER],
    minSurfaces: 1,
    negationWords: AAVE,
    functionWords: aaveFunctionWords,
  });
  assert.ok(!verbs.has("ain't"), `"ain't" must never be admitted as a verb: ${[...verbs].join(", ")}`);
});

test("without an injected prior, Nigerian Pidgin 'no' and AAVE \"ain't\" read as affirmative", () => {
  const { verbs: pcmVerbs } = discoverRelationVocab(PCM_TEXT, {
    surfaces: [PCM_SURFACE, PCM_OTHER],
    minSurfaces: 1,
    functionWords: pcmFunctionWords,
  });
  const pcmRels = extractRelations(PCM_TEXT, { verbs: pcmVerbs, functionWords: pcmFunctionWords });
  assert.ok(
    pcmRels.every((r) => r.polarity === "+"),
    `with no Pidgin prior injected, nothing in this fixture can read as negated: ${JSON.stringify(pcmRels)}`,
  );

  const { verbs: aaveVerbs } = discoverRelationVocab(AAVE_TEXT, {
    surfaces: [AAVE_SURFACE, AAVE_OTHER],
    minSurfaces: 1,
    functionWords: aaveFunctionWords,
  });
  const aaveRels = extractRelations(AAVE_TEXT, { verbs: aaveVerbs, functionWords: aaveFunctionWords });
  assert.ok(
    aaveRels.every((r) => r.polarity === "+"),
    `with no AAVE prior injected, nothing in this fixture can read as negated: ${JSON.stringify(aaveRels)}`,
  );
});

test("nothing in relations.js hardcodes \"ain't\" or \"neva\" — the vendored files are the only place they live", () => {
  const code = readFileSync(join(root, "packages/engine/perceiver/text/relations.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.ok(!/["']ain't["']/.test(code), 'relations.js hardcodes "ain\'t" — that belongs in the vendored prior, not the organ');
  assert.ok(!/["']neva["']/.test(code), 'relations.js hardcodes "neva" — that belongs in the vendored prior, not the organ');
});

test("a received POS prior refuses connector-slot nouns and prepositions without erasing attested verbs", () => {
  const posPrior = {
    schema: "POSPrior@1",
    forms: { walked: { VERB: 8 }, at: { ADP: 12, AUX: 1 }, family: { NOUN: 10 } },
  };
  const { verbs, candidates } = discoverRelationVocab(
    "Victor walked home. Elizabeth at Geneva. Henry family friend. Safie instructed Felix.",
    { surfaces: ["Victor", "Elizabeth", "Henry", "Safie"], minSurfaces: 1, posPrior },
  );
  assert.deepEqual([...verbs], ["walked", "instructed"], "an unattested form is a gap, not evidence of non-verb class");
  assert.equal(candidates.find((c) => c.verb === "at").verbDominant, false);
  assert.equal(candidates.find((c) => c.verb === "family").verbDominant, false);
  assert.equal(candidates.find((c) => c.verb === "at").verbShare, 1 / 13);
  assert.equal(candidates.find((c) => c.verb === "walked").upos.VERB, 8);
  assert.equal(candidates.find((c) => c.verb === "instructed").posStanding, "gap");
});

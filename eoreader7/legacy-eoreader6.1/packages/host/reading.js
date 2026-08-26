// Canonical EOReader reading pipeline.
//
// A "reading" is no longer allowed to mean only the level-0 surprise organ.
// Every canonical read passes through the same named subassemblies:
//   material -> corpus/EOT ingestion -> level-0/self -> cube reasoning -> HL
// -> falsification.
// Each assembly reports its own status so a broken organ is visible rather
// than silently omitted. This is the public invariant for future callers.

import { canonicalHashSync } from "../spec/canonical-json/index.js";
import { tokenize, chunkWords, causalSurprisalSeries } from "../engine/perceiver/text/material.js";
import { readLevel0, STRUCTURE_OPTIONS, READER_OPTIONS } from "../engine/loops/read-level0.js";
import { admitSelf } from "./self.js";
import { admitChunked } from "./corpus.js";
import { reasonSession } from "./reasoning.js";
import { normalizeHyperlexicon } from "../engine/reasoning/hyperlexicon.js";

export const CELL = Object.freeze({ op: "EVA", grain: "Pattern" });
export const READING_PIPELINE_SCHEMA = "EOReadingPipeline@1";
export const READING_ASSEMBLIES = Object.freeze([
  "material",
  "eot_ingestion",
  "level0_self",
  "cube_reasoning",
  "hyperlexicon",
  "falsification",
]);
const CHUNK_WORDS = 40;
const ok = (name, detail = {}) => Object.freeze({ name, status: "ok", ...detail });
const broken = (name, error) => Object.freeze({ name, status: "broken", error: error instanceof Error ? error.message : String(error) });

/**
 * Canonical read. EOT ingestion, cube reasoning and HL are constitutive, not
 * optional enhancements. `strict` defaults true: a broken assembly throws,
 * carrying the partial assembly trace on error.reading so callers can show
 * exactly where the reader broke. strict=false is diagnostic mode only.
 */
export function admitReading(session, {
  sourceId,
  text,
  level0Options,
  structureOptions,
  readerOptions,
  priors = [],
  query = {},
  hyperlexicon = null,
  strict = true,
} = {}) {
  if (!session) throw new TypeError("admitReading: session is required");
  if (!sourceId || !text) throw new TypeError("admitReading: sourceId and text are declared, never defaulted");

  const assemblies = [];
  const fail = (name, error, partial = {}) => {
    assemblies.push(broken(name, error));
    const reading = Object.freeze({ schema: READING_PIPELINE_SCHEMA, sourceId, assemblies: Object.freeze([...assemblies]), ...partial });
    if (!strict) return reading;
    const wrapped = new Error(`admitReading: ${name} assembly failed: ${error?.message ?? error}`);
    wrapped.cause = error;
    wrapped.reading = reading;
    throw wrapped;
  };

  let admissionHash, words, chunks, series;
  try {
    admissionHash = canonicalHashSync({ sourceId, text });
    words = tokenize(text);
    chunks = chunkWords(words, CHUNK_WORDS);
    series = causalSurprisalSeries(chunks);
    assemblies.push(ok("material", { chunkCount: chunks.length }));
  } catch (error) { return fail("material", error); }

  // Canonical ingestion: this is what makes the document available to the
  // referent/relation organ from which sessionEot is built.
  try {
    admitChunked(session, { sourceId, text });
    assemblies.push(ok("eot_ingestion", { sourceId }));
  } catch (error) { return fail("eot_ingestion", error, { admissionHash }); }

  const resolvedStructureOptions = structureOptions ?? STRUCTURE_OPTIONS;
  const resolvedReaderOptions = readerOptions ?? READER_OPTIONS;
  let level0, admitted;
  try {
    level0 = readLevel0(series, {
      ...level0Options,
      structureOptions: resolvedStructureOptions,
      readerWindow: resolvedReaderOptions.window,
      readerDraws: resolvedReaderOptions.draws,
      readerSeed: resolvedReaderOptions.seed,
    });
    const settledResults = level0.results.filter((r) => r.settled);
    admitted = admitSelf(session, {
      sourceId, admissionHash, series, settledResults,
      structureOptions: resolvedStructureOptions,
      readerOptions: resolvedReaderOptions,
    });
    assemblies.push(ok("level0_self", { motifsFound: level0.motifsFound, settledCount: settledResults.length }));
  } catch (error) { return fail("level0_self", error, { admissionHash }); }

  // HL is always instantiated before reasoning. Empty HL means "unknown", not
  // "HL omitted". reasonSession mechanically derives cube cells from EOT,
  // consults HL for composition affordances, acquires candidates, and creates
  // terrain-aware falsification envelopes.
  session.hyperlexicon = normalizeHyperlexicon(hyperlexicon ?? session.hyperlexicon);
  let reasoned;
  try {
    reasoned = reasonSession(session, { sourceId, priors, query, hyperlexicon: session.hyperlexicon });
    assemblies.push(ok("cube_reasoning", { tuples: reasoned.reasoning?.tuples?.length ?? 0, derived: reasoned.derived?.length ?? 0 }));
    assemblies.push(ok("hyperlexicon", { schema: reasoned.hyperlexicon.schema, candidates: reasoned.hyperlexiconCandidates.length, withheld: reasoned.withheldCompositions.length }));
    assemblies.push(ok("falsification", { envelopes: reasoned.falsification.length }));
  } catch (error) { return fail("cube_reasoning", error, { admissionHash, ...admitted }); }

  return Object.freeze({
    schema: READING_PIPELINE_SCHEMA,
    sourceId,
    admissionHash,
    chunkCount: chunks.length,
    motifsFound: level0.motifsFound,
    settledCount: level0.results.filter((r) => r.settled).length,
    ...admitted,
    eot: reasoned.eot,
    reasoning: reasoned.reasoning,
    derived: reasoned.derived,
    hyperlexicon: reasoned.hyperlexicon,
    hyperlexiconCandidates: reasoned.hyperlexiconCandidates,
    withheldCompositions: reasoned.withheldCompositions,
    falsification: reasoned.falsification,
    extractionGaps: reasoned.extractionGaps,
    assemblies: Object.freeze(assemblies),
  });
}

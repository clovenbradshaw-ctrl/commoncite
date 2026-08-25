// eoreader6 · packages/host/canon — surprise against a received CANON.
//
// The reading's own ground answers "is this frame surprising given what
// THIS book has done so far." A canon prior answers the other question a
// reader actually has: "is this frame surprising for a book of this
// kind." No new statistic exists here — emergence/surprise.js already
// measures belief movement against ANY prior; this file only receives a
// canon (bin/priors/canon/*.json, schema CanonVerbPrior@1, induced by
// scripts/build-canon-prior.mjs, provenance-stamped) and aims the organ.
//
// What transfers between works is the relation-verb vocabulary and its
// distribution — never character edges ("Elizabeth praised Darcy" is not
// canon; "what verbs a canon's prose does, and how often" is). Frames are
// measured as verb-usage arrivals against the canon's usage distribution:
// a frame doing what the canon does moves belief little; a frame doing
// verbs the canon lacks — or lacking the verbs the canon lives on — moves
// it far.
//
// RECEIVING DISCIPLINE, mirrored from emergence/jati.js::checkKindPrior:
// a prior names its schema and its provenance or it is refused; a
// reader_version mismatch is a typed refusal, never a silent apply.
// gamma is declared by the caller, never defaulted (nul's doctrine).

import { gap, isGap } from "../../nul/index.js";
import { bayesianSurprise } from "../engine/emergence/surprise.js";
import { splitSentences } from "../engine/perceiver/text/spans.js";
import { extractRelations, discoverRelationVocab } from "../engine/perceiver/text/relations.js";
import { extractSurfaces } from "../engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../engine/perceiver/text/material.js";

export const CANON_SCHEMA = "CanonVerbPrior@1";
export const READER_VERSION = "eo-2026-07";
const SENTENCES_PER_FRAME = 6; // read-people.mjs's own frame size

/** Validate a loaded canon prior. Returns the prior or a typed gap. */
export const receiveCanon = (prior, { readerVersion = READER_VERSION } = {}) => {
  if (!prior || typeof prior !== "object")
    return gap("unreceived_origin", { why: "a canon is received, never assumed" });
  if (prior.schema !== CANON_SCHEMA)
    return gap("unknown_spec", { reason: `unsupported schema ${prior.schema}`, known: [CANON_SCHEMA] });
  if (!prior.provenance?.source || !prior.provenance?.built_by)
    return gap("unreceived_origin", { why: "a canon names its provenance (source, built_by) or it is indistinguishable from a fabrication" });
  if (prior.reader_version !== readerVersion)
    return gap("unknown_spec", { reason: "reader_version_mismatch", expected: readerVersion, got: prior.reader_version });
  if (!prior.verbs || typeof prior.total !== "number" || prior.total <= 0)
    return gap("empty_material", { reason: "a canon with no measured usage grounds nothing" });
  return prior;
};

/**
 * Per-frame Bayesian surprise of a document's verb usage against a canon.
 * `gamma` is declared, never defaulted. Verbs are the UNION of the canon's
 * vocabulary and the document's own discovered vocabulary, so a verb the
 * canon lacks still arrives — and registers as movement — instead of
 * being invisible.
 */
export const canonSurprise = (session, { sourceId, prior, gamma, minSurfaces = 1 } = {}) => {
  const received = receiveCanon(prior);
  if (isGap(received)) return received;
  if (typeof gamma !== "number" || !(gamma >= 0 && gamma <= 1))
    return gap("undeclared", { what: "gamma", why: "the recency decay is declared, never defaulted" });

  const doc = session.documents?.get?.(sourceId);
  if (!doc) return gap("empty_material", { reason: `no document ${sourceId}` });

  const text = doc.text;
  const sentences = splitSentences(text);
  if (!sentences.length) return gap("empty_material", { reason: "no sentence units" });

  const words = tokenize(text);
  const functionWords = functionWordSet(buildFrequencyTable(words));
  const surfaces = extractSurfaces(sentences, { functionWords });
  const own = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces });
  const verbs = new Set([...Object.keys(received.verbs), ...own.verbs]);

  const canonPrior = new Map(Object.entries(received.verbs));
  const priorTotal = received.total;

  const frames = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_FRAME) {
    const group = sentences.slice(i, i + SENTENCES_PER_FRAME);
    frames.push({ offset: group[0].offset, text: group.map((s) => s.text).join(" ") });
  }

  const series = [];
  for (const frame of frames) {
    const arrival = new Map();
    let arrivalTotal = 0;
    for (const t of extractRelations(frame.text, { verbs, functionWords })) {
      arrival.set(t.verb, (arrival.get(t.verb) ?? 0) + 1);
      arrivalTotal += 1;
    }
    if (arrivalTotal === 0) continue; // a frame with no relations asserts nothing about the canon
    const surprise = bayesianSurprise(canonPrior, priorTotal, arrival, arrivalTotal, { gamma });
    if (surprise === null) continue;
    series.push({
      offset: frame.offset,
      surprise,
      arrivals: arrivalTotal,
      verbs: [...arrival.keys()].slice(0, 6),
    });
  }

  if (!series.length)
    return gap("empty_material", { reason: "no frame carried a relation to measure against the canon" });

  const mean = series.reduce((n, f) => n + f.surprise, 0) / series.length;
  const top = [...series].sort((a, b) => b.surprise - a.surprise).slice(0, 5);
  return Object.freeze({
    canon: received.population,
    framesMeasured: series.length,
    mean,
    top: Object.freeze(top),
    series: Object.freeze(series),
  });
};

export { isGap };

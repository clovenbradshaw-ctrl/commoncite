// eoreader6 · host/sing — THE SELF-DIRECTED LOOP: search, read, gate, commit,
// sing. The relevance gate's runtime home — the wiring that organ was built
// for, on the other side of the conformance suite.
//
// ONE PASS, FIVE ACTS, EACH A REGISTERED ORGAN, NONE OF THEM NEW:
//
//   · QUERY     — the reader seeks what it just found worth keeping. The
//     query is the last PRESERVED passage's own forms — never a human's words,
//     never the gate's. The first pass has no ground to seek from, so it
//     RECEIVES the first unread span: the first ground is received, never
//     derived (NUL; operators.js).
//   · NOMINATE  — host/corpus searchSpans: token presence, coverage-ranked,
//     rare-word weighted. A cheap sense organ may nominate; it never decides
//     (II.8, search/index.js).
//   · READ      — perceiver/text/relations reads the candidate into
//     (subject, verb, object, polarity) triples, against `verbs` — a
//     vocabulary measured from the corpus (discoverRelationVocab), never a
//     hand-listed English verb set. A passage that yields none moves nothing
//     and is recorded empty_material, never fabricated into a verdict.
//   · GATE      — search/index.js judge, the relevance gate, which never sees
//     the query: preserve only if the candidate moves the graph beyond its
//     own reseeding (tuple-rotate) variation; refuse is redundancy against
//     the reader; censored is unplaceable magnitude.
//   · COMMIT    — only a preserved candidate joins the reader (readTriples on
//     the real graph). The gate measured on a COPY; committing is the
//     caller's act — the whole point of judge's record.
//
// THE LOOP ENDS WHEN THE READER'S OWN SEARCH RUNS DRY: a pass whose search
// finds nothing the reader has not already met returns the typed gap
// `no_candidate`, and singRun stops there. A reader whose memory stops
// pointing at anything new has stopped, and the run records that it did.
//
// APERTURE is reported as the volume (nul's IQR) over the ground the belief
// movements have built so far — the same primitives aperture-run.mjs uses,
// "never a gate, never a score". The series is computed on request
// (apertureSeries) so the loop itself never consults it as a decision.
//
// SING: the reading's own material, spoken from where the reader now stands —
// generation/standpoint's emitScoped over the live wave, the perished past
// settled once (settleGround). Every emission is stamped register=imagined;
// a song is imagination, never testimony.
//
// The loop is a COMPOSITION of already-registered organs, not a new cell, so
// it claims none on the operator grid and is not in the ORGANS roster — it is
// wired here, where the host's surfaces live.

import { searchSpans } from "./corpus.js";
import { extractRelations } from "../engine/perceiver/text/relations.js";
import { tokenize } from "../engine/perceiver/text/material.js";
import { judge } from "../engine/search/index.js";
import { createGraph, readTriples, strongestEdges } from "../engine/emergence/graph.js";
import { readLinks, bindingTriples } from "../engine/emergence/binding.js";
import { ground, volume, isGap, gap } from "../../nul/index.js";
import { createLayer } from "../engine/generation/belief.js";
import { settleGround } from "../engine/generation/settled.js";
import { emitScoped } from "../engine/generation/standpoint.js";

const previewOf = (text) => String(text ?? "").replace(/\s+/g, " ").slice(0, 96);

/**
 * A reader with a corpus and a graph. Declared numbers are declared, never
 * defaulted, in the same spirit every engine organ enforces: `gamma` is the
 * reader's forgetting, `pruneBelow` the floor below which a decayed relation
 * is forgotten outright, `reseeds` the gate's resolution of pattern, `seed`
 * the gate's received stream, `alpha` the graph's smoothing reserve, `limit`
 * the search's nomination budget.
 *
 * `verbs` is the reader's relation vocabulary — measured from the corpus by
 * `perceiver/text/relations.js::discoverRelationVocab` before the singer is
 * created (see `scripts/sing-book.mjs`), never a hand-listed English verb
 * set. It is declared here for the same reason `gamma`/`reseeds`/`seed` are:
 * a Set the caller measured or otherwise supplied, never one this file
 * assumes on the caller's behalf.
 *
 * `entities` is an optional entity register from carryEntities — when
 * provided, binding-derived links are fed to the graph alongside text-derived
 * triples. The graph gains structural edges (a|polarity|b) that capture
 * co-occurrence patterns text triples miss.
 */
export const createSinger = ({ session, gamma, pruneBelow, reseeds, seed, alpha = 1, limit = 10, verbs, entities, bindingSpec, functionWords = null }) => {
  if (!session || !(session.spans instanceof Map)) throw new TypeError("sing: a corpus session is required");
  if (!Number.isFinite(gamma) || gamma <= 0 || gamma > 1)
    throw new TypeError("sing: gamma is the reader's forgetting, declared in (0,1], never defaulted");
  if (!Number.isFinite(pruneBelow) || pruneBelow <= 0)
    throw new TypeError("sing: pruneBelow is the graph's forgetting floor, declared and positive, never defaulted");
  if (!Number.isInteger(reseeds) || reseeds < 2)
    throw new TypeError("sing: reseeds is the gate's resolution of pattern, declared, never defaulted");
  if (!Number.isInteger(seed)) throw new TypeError("sing: seed is declared — the engine holds no randomness, it receives one");
  if (!Number.isFinite(alpha) || alpha <= 0) throw new TypeError("sing: alpha is the graph's smoothing reserve, declared and positive");
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError("sing: limit is the nomination budget, declared");
  if (!(verbs instanceof Set)) throw new TypeError("sing: verbs is the reader's measured relation vocabulary, declared — see perceiver/text/relations.js::discoverRelationVocab");

  const reader = createGraph({ gamma, pruneBelow });
  return {
    session,
    reader,
    gamma,
    reseeds,
    seed,
    alpha,
    limit,
    verbs,
    functionWords: functionWords instanceof Set && functionWords.size ? functionWords : null,
    entities: entities ?? null,
    bindingSpec: bindingSpec ?? null,
    readIds: new Set(),   // spans already experienced — the reader never re-reads
    preserved: [],        // passages that joined the reader (verdict preserve)
    refused: [],          // passages redundant against the reader
    censored: [],         // movement real, place not given
    gaps: [],             // passes that moved nothing at all
    moves: [],            // belief movement per committed pass, for aperture
    pass: 0,
    lastPreserved: null,  // the span the reader most recently kept — the next query
  };
};

const spanTokens = (text) => tokenize(String(text ?? ""));

/**
 * One pass of the loop. Returns the pass record, or a typed gap:
 *
 *   no_candidate    the reader's own search found nothing it has not met —
 *                   the run is over, recorded as exactly that.
 *   empty_material  the candidate stated no relation the graph could read.
 *
 * The reader's graph is never mutated by judging; only a `preserve` verdict
 * commits (readTriples), which is the caller's act the gate was built for.
 */
export const singPass = (singer) => {
  const s = singer;
  s.pass++;

  // QUERY — the reader seeks what it just found worth keeping.
  const query = s.lastPreserved ? spanTokens(s.lastPreserved.text).join(" ") : null;

  // NOMINATE — search, or, with no ground yet, receive.
  let candidates = [];
  if (query) {
    const out = searchSpans(s.session, { query, limit: s.limit });
    candidates = out.spans.filter((sp) => !s.readIds.has(sp.span_id));
  } else {
    for (const sp of s.session.spans.values()) {
      if (!s.readIds.has(sp.span_id)) { candidates.push(sp); break; }
    }
  }
  if (candidates.length === 0)
    return gap("no_candidate", {
      reason: "the reader's own search found nothing it has not already met — the run is over",
      pass: s.pass,
      query: query ?? null,
    });

  const span = candidates[0];
  s.readIds.add(span.span_id);

  // READ — into triples. The candidate is experienced whether or not it moves.
  const triples = extractRelations(span.text, { verbs: s.verbs, functionWords: s.functionWords });
  const record = { pass: s.pass, query, span_id: span.span_id, preview: previewOf(span.text), triples: triples.length };
  if (triples.length === 0) {
    s.gaps.push(record);
    return gap("empty_material", {
      reason: "the candidate stated no relation the graph could read",
      ...record,
    });
  }

  // GATE — the relevance gate, on a copy, never seeing the query.
  const verdict = judge(s.reader, triples, { reseeds: s.reseeds, seed: s.seed + s.pass });
  record.verdict = verdict.verdict;
  record.what = verdict.what;
  record.ground = verdict.ground;
  record.nullReseeds = verdict.nullReseeds;
  // The operator vector judge() measured — which of the 8 MEASURED operators
  // carried the verdict, each with its observed count and its null's support
  // [lo,hi] (search/index.js's supportOf) — is kept on the record, not just
  // its collapse to `verdict`/`what`. Without this, a refuse or censored span
  // is discarded down to a hash-like summary: the verdict is stated but WHY
  // (which operator, at what threshold) is unrecoverable from the persisted
  // log alone, only from a live re-run. Same discipline nul/index.js already
  // applies to its own ground objects (keep the support, not just the call).
  record.operators = verdict.operators;
  record.counts = verdict.counts;
  record.decisive = verdict.decisive;

  if (verdict.verdict === "preserve") {
    // COMMIT — only a preserved candidate joins the reader.
    const committed = readTriples(s.reader, triples, { alpha: s.alpha });
    record.movement = committed.belief;
    record.newEdges = committed.newEdges;
    record.newNodes = committed.newNodes;

    // BINDING — when an entity register is available, feed co-arrival links.
    // Structural edges (a|polarity|b) capture relations text triples miss.
    if (s.entities && s.bindingSpec) {
      const links = readLinks(s.entities, s.bindingSpec);
      const linkTriples = bindingTriples(links);
      if (linkTriples.length > 0) {
        const bindingResult = readTriples(s.reader, linkTriples, { alpha: s.alpha, structural: true });
        record.bindingEdges = bindingResult.newEdges;
        record.bindingNodes = bindingResult.newNodes;
      }
    }

    s.preserved.push(record);
    s.moves.push(committed.belief);
    s.lastPreserved = span;
  } else if (verdict.verdict === "refuse") {
    s.refused.push(record);
  } else {
    s.censored.push(record);
  }

  return record;
};

/**
 * Run up to `passes` passes. Stops at `no_candidate`: a reader whose memory
 * no longer points at anything new has stopped, and the summary says how.
 */
export const singRun = (singer, { passes }) => {
  if (!Number.isInteger(passes) || passes < 1) throw new TypeError("sing: passes is declared, never defaulted");
  const records = [];
  for (let k = 0; k < passes; k++) {
    const r = singPass(singer);
    records.push(r);
    if (r.gap === "no_candidate") break;
  }
  return {
    records: Object.freeze(records),
    pass: singer.pass,
    preserved: singer.preserved.length,
    refused: singer.refused.length,
    censored: singer.censored.length,
    gaps: singer.gaps.length,
    ended: records[records.length - 1]?.gap ?? null,
    nodes: singer.reader.nodes.size,
    edges: singer.reader.edges.size,
    moves: Object.freeze(singer.moves.filter((m) => typeof m === "number")),
    strongest: strongestEdges(singer.reader, 5),
  };
};

/**
 * Aperture per committed pass: the volume (nul's interquartile range) of the
 * ground the belief movements have built up to that pass. `window`, `draws`
 * and `seed` are declared — they are the ground's own resolutions. A pass
 * with fewer than `window` movements has no ground yet and reports null
 * rather than a fabricated warmth.
 */
export const apertureSeries = (moves, { window, draws, seed }) => {
  if (!Number.isInteger(window) || window < 2) throw new TypeError("sing: aperture window is declared, never defaulted");
  if (!Number.isInteger(draws) || draws < 2) throw new TypeError("sing: aperture draws is declared, never defaulted");
  if (!Number.isInteger(seed)) throw new TypeError("sing: aperture seed is declared");
  return moves.map((_, k) => {
    const series = moves.slice(0, k + 1);
    if (series.length < window) return null;
    const g = ground({ material: series, draws, window, seed });
    return isGap(g) ? null : volume(g);
  });
};

/**
 * SING — speak from where the reading left the reader.
 *
 * `tokens` is the material the reader experienced, in order; `here` the
 * standpoint in token positions; `from` where the present begins (declared by
 * the caller, exactly as standpoint.js requires). The perished past is settled
 * ONCE at the boundary and spoken past only where the present falls silent.
 *
 * The emission is imagination (register=imagined) — a ground read forward,
 * never testimony about the material.
 */
export const sing = ({ tokens, here, from, order, alpha, gamma = 1, pastGamma = 1, horizon, seed = 0, selection = "mode" }) => {
  if (!Array.isArray(tokens)) throw new TypeError("sing: tokens must be the experienced material, in order");
  if (!Number.isInteger(here) || here < 1 || here > tokens.length)
    throw new RangeError("sing: here is declared, and must stand inside the read material");
  if (!Number.isInteger(from) || from < 0 || from >= here)
    return gap("no_ground", { reason: "the present must contain material to speak from", from, here });
  if (!Number.isInteger(order) || order < 0) throw new TypeError("sing: order is declared, never defaulted");
  if (!Number.isFinite(alpha) || alpha <= 0) throw new TypeError("sing: alpha is declared, never defaulted");
  if (!Number.isInteger(horizon) || horizon < 1) throw new TypeError("sing: horizon is declared, never defaulted");
  if (selection !== "mode" && selection !== "sampled")
    throw new TypeError("sing: selection must be mode or sampled, and is never defaulted");

  const live = createLayer({ id: "live", tier: "read", order, gamma, alpha });
  live.train(tokens.slice(from, here));

  let settled = null;
  if (from > 0) {
    const past = createLayer({
      id: "perished",
      tier: "received",
      world: "this",
      order,
      gamma: pastGamma,
      alpha,
      giver: `this same reader, at the standpoint ending at form ${from} — the perished occasion, datum for the one after it (loops/surf)`,
    });
    past.train(tokens.slice(0, from));
    settled = settleGround({ layer: past, at: from, giver: `this same reader, at the standpoint ending at form ${from}` });
  }

  const context = tokens.slice(Math.max(0, here - order), here);
  const emission = emitScoped({ live, settled, context, horizon, selection, seed, order });
  if (isGap(emission)) return emission;
  return Object.freeze({
    ...emission,
    scope: Object.freeze({ here, from, live: here - from, past: from }),
  });
};

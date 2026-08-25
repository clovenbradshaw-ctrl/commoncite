// eoreader6 · cache-reading — EXTRACT ONCE, SERIALIZE, LET EVERY DOWNSTREAM
// TOOL LOAD INSTEAD OF RE-EXTRACTING.
//
// This session ran the same expensive SVO+Link extraction over the full
// text of War and Peace FIVE separate times across five different scripts
// (the plain census, Network-aware kind induction, the Link+tier-stack
// ladder, the paradigm test, the shuffle control) — each paying the same
// multi-minute cost from scratch, because none of them shared their work.
// The shuffle control script gets this right INTERNALLY (one extraction,
// many cheap re-folds of the same captured data); this script generalizes
// that pattern ACROSS scripts.
//
// Every terrain above Field depends on the same underlying reading: the
// frame-by-frame SVO extraction, referent cast, entity arrivals for
// binding, and the resulting graph. None of that changes between asking
// "what kinds does this induce" and "does a paradigm hold across a split"
// and "is the tier-shift signal real" — only what's computed FROM it does.
// So this script does the one expensive pass and writes everything a
// downstream tool needs to a single JSON cache, keyed by a content hash of
// the input (SEED.md #1's own discipline — nul/index.js::fingerprint's
// pattern, reused: a cache keyed by content, never by filename, so a
// changed file can never silently serve a stale reading).
//
// Graph edges/nodes are serialized as [key, value] arrays (Maps don't
// survive JSON.stringify); loaders reconstruct the Maps.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { extractRelations, discoverRelationVocab } from "../packages/engine/perceiver/text/relations.js";
import { createGraph, readTriples } from "../packages/engine/emergence/graph.js";
import { gammaFor } from "../packages/engine/emergence/tiers.js";
import { extractSurfaces, discoverReferents, diaNorm } from "../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../packages/engine/perceiver/text/material.js";
import { projectReferents } from "../packages/engine/referents/index.js";
import { resolveAllNarratorSpans, narratorAt, isFirstPerson } from "../packages/engine/perceiver/text/narrator.js";
import { readLinks, bindingTriples } from "../packages/engine/emergence/binding.js";

const SENTENCES_PER_FRAME = 6;
const WINDOW = 12;
const PRUNE_BELOW = 1e-4;
const BINDING_WINDOW = 2;
const BINDING_DRAWS = 199;
const BINDING_SEED = 20260811;

const contentKey = (text, coref, causal) => createHash("sha256").update(text).update(JSON.stringify(coref)).update(causal ? "causal" : "whole-text").digest("hex").slice(0, 16);

/**
 * Read a text ONCE (SVO extraction + Link binding), returning everything a
 * downstream terrain measurement needs. Cached to `cacheDir` by content
 * hash — a second call with the SAME text+coref (byte-for-byte) loads
 * instead of re-extracting; any change to either input is a different
 * hash, never a stale hit.
 *
 * `causal` (default false) selects which of this session's two, both
 * legitimate, relation-vocabulary policies to run — they are NOT
 * interchangeable and must never share a cache key (folded into
 * `contentKey` above for exactly that reason):
 *
 *   causal: false (the default, "whole-text"/"policy A")  — the vocabulary
 *     is measured once over the whole text before any frame is read. What
 *     read-people.mjs / read-kinds-networked.mjs / read-paradigm.mjs use.
 *     A RECORD of the text, legal as such, refused as "the technique"
 *     (read-ladder.mjs's own header names this distinction).
 *   causal: true ("policy B") — the vocabulary is incremental: a verb is
 *     admitted only after it has already followed enough surfaces in
 *     frames read so far, so frame t's extraction never sees a verb first
 *     met at t or later. What read-ladder.mjs / terrain-census.mjs /
 *     atmosphere-shuffle-control.mjs use — the policy Amendment XXIV's
 *     (and its correction's) numbers were actually measured under.
 */
export const readCached = (text, coref, { cacheDir = "/tmp/eoreader6-read-cache", label = "reading", causal = false } = {}) => {
  const key = contentKey(text, coref, causal);
  const cachePath = `${cacheDir}/${key}.json`;
  if (existsSync(cachePath)) {
    console.error(`[cache-reading] HIT ${key} (${label}, ${causal ? "causal" : "whole-text"} vocab) — loading, not re-extracting`);
    const saved = JSON.parse(readFileSync(cachePath, "utf8"));
    return {
      ...saved,
      graphNodes: new Map(saved.graphNodesEntries),
      graphEdges: new Map(saved.graphEdgesEntries),
      arrivalSeq: saved.arrivalSeq.map((pairs) => new Map(pairs)),
    };
  }
  console.error(`[cache-reading] MISS ${key} (${label}, ${causal ? "causal" : "whole-text"} vocab) — extracting once, will cache`);

  const { text: body } = stripContainer(text);
  const sentences = splitSentences(body);
  const frames = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_FRAME) {
    const g = sentences.slice(i, i + SENTENCES_PER_FRAME);
    if (g.length) frames.push({ order: frames.length, offset: g[0].offset, text: g.map((s) => s.text).join(" ") });
  }

  const table = buildFrequencyTable(tokenize(body));
  const functionWords = functionWordSet(table);
  const surfaces = extractSurfaces(sentences, { functionWords });
  const cast = projectReferents(discoverReferents(surfaces).events).filter((r) => !r.mergedInto);
  // whole-text vocab, measured once — overwritten per-frame below when causal.
  let verbs = causal ? new Set() : discoverRelationVocab(body, { surfaces, functionWords, minSurfaces: 1 }).verbs;
  const seenFollowing = new Map(); // causal only: verb -> Set(surfaceForm) from frames already read

  const surfaceToId = [];
  for (const r of cast) for (const s of r.surfaces) {
    const n = diaNorm(s);
    if (n.length < 2) continue;
    surfaceToId.push([n, new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u"), r.id]);
  }
  surfaceToId.sort((a, b) => b[0].length - a[0].length);

  const { resolved: narratorSpans } = resolveAllNarratorSpans(body, coref.referents ?? []);
  const resolve = (phrase, offset) => {
    const p = diaNorm(phrase);
    if (isFirstPerson(p)) { const n = narratorAt(offset, narratorSpans); return n.referentId ?? null; }
    for (const [, re, id] of surfaceToId) if (re.test(p)) return id;
    return null;
  };

  const graph = createGraph({ gamma: gammaFor(WINDOW), pruneBelow: PRUNE_BELOW });
  const referentArrivals = new Map();
  const arrivalSeq = []; // per-frame arrival maps as [key,count] pairs (JSON-safe, Map-reconstructable)

  for (const f of frames) {
    // Causal: frame t's extraction sees only verbs already admitted from
    // frames before it — vocab is grown AFTER extraction, below, never
    // before, so frame t never reads its own new verbs (read-ladder.mjs's
    // own discipline, reproduced exactly).
    const raw = extractRelations(f.text, { verbs, functionWords });
    const triples = raw
      .map((t) => ({ ...t, subject: resolve(t.subject, f.offset), object: resolve(t.object, f.offset) }))
      .filter((t) => t.subject && t.object && t.subject !== t.object);
    if (triples.length) readTriples(graph, triples);
    for (const t of triples) for (const id of [t.subject, t.object]) {
      const arr = referentArrivals.get(id);
      if (!arr) referentArrivals.set(id, [f.order]);
      else if (arr[arr.length - 1] !== f.order) arr.push(f.order);
    }
    if (raw.length) {
      const arrival = new Map();
      const bump = (k) => arrival.set(k, (arrival.get(k) ?? 0) + 1);
      for (const r of raw) {
        const s = resolve(r.subject, f.offset), o = resolve(r.object, f.offset);
        if (s) bump(`node:${s}`);
        if (o) bump(`node:${o}`);
        if (s && o) bump(`edge:${s}|${r.verb}|${o}`);
      }
      if (arrival.size) arrivalSeq.push([...arrival.entries()]);
    }

    if (causal) {
      const frameVocab = discoverRelationVocab(f.text, { surfaces, functionWords, minSurfaces: 1 });
      for (const c of frameVocab.candidates) {
        let set = seenFollowing.get(c.verb);
        if (!set) seenFollowing.set(c.verb, (set = new Set()));
        for (const form of c.surfaceForms) set.add(form);
        if (set.size >= 1) verbs.add(c.verb);
      }
    }
  }

  const entityRegister = [...referentArrivals.entries()].filter(([, a]) => a.length >= 2).map(([id, a]) => ({ id, arrivals: a.slice().sort((x, y) => x - y) }));
  let bindingTriplesCount = 0;
  if (entityRegister.length >= 2) {
    const links = readLinks(entityRegister, { window: BINDING_WINDOW, draws: BINDING_DRAWS, seed: BINDING_SEED, totalUnits: frames.length });
    const lt = bindingTriples(links);
    bindingTriplesCount = lt.length;
    if (lt.length > 0) readTriples(graph, lt, { structural: true });
  }

  const result = {
    key, label,
    frameCount: frames.length,
    castCount: cast.length,
    entityRegister,
    bindingTriplesCount,
    arrivalSeq,
    graphNodesEntries: [...graph.nodes.entries()],
    graphEdgesEntries: [...graph.edges.entries()],
  };

  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(result));
  console.error(`[cache-reading] wrote ${cachePath} (${frames.length} frames, ${graph.nodes.size} nodes, ${graph.edges.size} edges, ${arrivalSeq.length} arrival maps)`);

  return { ...result, graphNodes: graph.nodes, graphEdges: graph.edges, arrivalSeq: arrivalSeq.map((pairs) => new Map(pairs)) };
};

// CLI: prime the cache for a text without needing a downstream script.
if (import.meta.url === `file://${process.argv[1]}`) {
  const textPath = process.argv[2];
  const corefPath = process.argv[3];
  if (!textPath || !corefPath) throw new Error("usage: node scripts/cache-reading.mjs <text> <coref-json>");
  const text = readFileSync(textPath, "utf8").replace(/\r\n/g, "\n");
  const coref = JSON.parse(readFileSync(corefPath, "utf8"));
  const r = readCached(text, coref, { label: textPath.split("/").pop() });
  console.log(`ready: ${r.frameCount} frames, ${r.graphNodes.size} nodes, ${r.graphEdges.size} edges, ${r.entityRegister.length} entities, ${r.arrivalSeq.length} arrival maps`);
}

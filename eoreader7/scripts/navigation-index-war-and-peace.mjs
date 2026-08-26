// eoreader6 · navigation-index-war-and-peace — the compliant version of
// "Paradigm down to Void, navigate meaningful semantics."
//
// This is NOT a fork of read-tiered.mjs's discipline, it's the same proven
// pipeline (unmodified: same imports, same frame construction, same
// referent/relation discovery, same tier fold) with one addition: every
// passage that reaches an altitude gets a real, independently-verified BYTE
// offset into the canonical source file, so the result is something a
// system can actually seek to — not just a percentage-through-the-document
// printed to a console.
//
// Why this exists instead of another classifier: eoreader6/CUBE.md refuses
// deriving a terrain cell from content by classification ("measured and
// refuted... promoted out of the code"). Nothing here classifies anything.
// A passage's altitude is EARNED — it only reaches "paradigm" by having
// surprised atmosphere, then lens, then paradigm in sequence, each shift
// tested against a real null built from the material's own belief-graph
// history (emergence/tiers.js). That is eoreader6's actual discipline,
// applied, not worked around.
//
// Usage: node scripts/navigation-index-war-and-peace.mjs <textPath> <corefPath> [outPath]

import { readFileSync, writeFileSync, openSync, readSync, closeSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { extractRelations, discoverRelationVocab } from "../packages/engine/perceiver/text/relations.js";
import { createGraph, readTriples, edgeKey } from "../packages/engine/emergence/graph.js";
import { createTierStack, foldThrough, massIsConsistent, gammaFor } from "../packages/engine/emergence/tiers.js";
import { extractSurfaces, discoverReferents, diaNorm } from "../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../packages/engine/perceiver/text/material.js";
import { projectReferents } from "../packages/engine/referents/index.js";
import { resolveNarratorSpans, narratorAt, isFirstPerson } from "../packages/engine/perceiver/text/narrator.js";

const SENTENCES_PER_FRAME = 6;
const TIER_NAMES = ["atmosphere", "lens", "paradigm"];
const WINDOW = 12, DRAWS = 200, TIER_SEED = 20260803;

const TEXT_PATH = process.argv[2];
const COREF_PATH = process.argv[3];
const OUT_PATH = process.argv[4] || TEXT_PATH.replace(/\.[^.]+$/, "") + "-navigation-index.json";
if (!TEXT_PATH || !COREF_PATH) {
  console.error("Usage: node navigation-index-war-and-peace.mjs <textPath> <corefPath> [outPath]");
  process.exit(1);
}

const rawFileText = readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const { text, offset: containerOffset } = stripContainer(rawFileText);
console.log(`stripContainer offset shift: ${containerOffset} (0 means the source file had no remaining Gutenberg boilerplate to strip)`);

// ── BYTE PROVENANCE: the actual point of this script over read-tiered.mjs ──
// h.offset from the pipeline below is a JS char index into `text`, which is
// `rawFileText` sliced by `containerOffset`. Real file byte offset = byte
// length of (rawFileText up to containerOffset + charOffset). Computed fresh
// per waypoint (cheap: a handful of calls) and independently re-verified
// with a raw fs.readSync against the ORIGINAL file on disk — the same
// two-bug discipline (CRLF drift, UTF-16-vs-UTF-8 drift) already paid for
// once this session; applied here from the start instead of re-discovered.
const fd = openSync(TEXT_PATH, "r");
function charToByteOffset(charIndexInStripped) {
  const charIndexInRaw = containerOffset + charIndexInStripped;
  return Buffer.byteLength(rawFileText.slice(0, charIndexInRaw), "utf8");
}
function verifyByteSeek(byteOffset, byteLength, expectedCollapsed) {
  const buf = Buffer.alloc(byteLength);
  const n = readSync(fd, buf, 0, byteLength, byteOffset);
  const got = buf.subarray(0, n).toString("utf8").replace(/\s+/g, " ").trim();
  return got === expectedCollapsed;
}

const sentences = splitSentences(text);
const frames = [];
for (let i = 0; i < sentences.length; i += SENTENCES_PER_FRAME) {
  const g = sentences.slice(i, i + SENTENCES_PER_FRAME);
  if (g.length) {
    const last = g[g.length - 1];
    // frame.text is a RECONSTRUCTION (sentences joined with single spaces),
    // not a literal raw substring — verified directly: a single sentence's
    // own .text IS a literal substring of `text` at its own offset, but the
    // multi-sentence join collapses the real inter-sentence whitespace
    // (paragraph breaks can be several chars) down to one space each, so
    // "frame.offset + frame.text.length" undershoots the real raw span.
    // endOffset (last sentence's own offset + its own real length) is the
    // true end of the frame's raw span; byte provenance below uses that,
    // not frame.text.length.
    frames.push({ order: frames.length, offset: g[0].offset, endOffset: last.offset + last.text.length, text: g.map((s) => s.text).join(" ") });
  }
}

const table = buildFrequencyTable(tokenize(text));
const functionWords = functionWordSet(table);
const surfaces = extractSurfaces(sentences, { functionWords });
const referentEvents = discoverReferents(surfaces).events;
const cast = projectReferents(referentEvents).filter((r) => !r.mergedInto);

const { verbs, candidates } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 });

const surfaceToId = [];
for (const r of cast) for (const s of r.surfaces) {
  const n = diaNorm(s);
  if (n.length < 2) continue;
  surfaceToId.push([n, new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u"), r.id]);
}
surfaceToId.sort((a, b) => b[0].length - a[0].length);

const coref = JSON.parse(readFileSync(COREF_PATH, "utf8"));
const narratorSource = coref.referents.find((r) => Array.isArray(r.narratorSpans) && r.narratorSpans.length);
const { resolved: narratorSpans } = narratorSource
  ? resolveNarratorSpans(text, `ref:narrator:${narratorSource.id}`, narratorSource.narratorSpans)
  : { resolved: [] };

const resolve = (phrase, offset) => {
  const p = diaNorm(phrase);
  if (isFirstPerson(p)) {
    const n = narratorAt(offset, narratorSpans);
    return n.referentId ?? null;
  }
  for (const [, re, id] of surfaceToId) if (re.test(p)) return id;
  return null;
};

const PRUNE_BELOW = 1e-4;
const graph = createGraph({ gamma: gammaFor(WINDOW), pruneBelow: PRUNE_BELOW });
const tiers = createTierStack(TIER_NAMES, { window: WINDOW, draws: DRAWS, seed: TIER_SEED });
const reached = [];

for (const f of frames) {
  const raw = extractRelations(f.text, { verbs, functionWords });
  const triples = raw
    .map((t) => ({ ...t, subject: resolve(t.subject, f.offset), object: resolve(t.object, f.offset), said: t }))
    .filter((t) => t.subject && t.object && t.subject !== t.object);
  if (!triples.length) continue;

  readTriples(graph, triples);

  const arrival = new Map();
  const bump = (k) => arrival.set(k, (arrival.get(k) ?? 0) + 1);
  for (const t of triples) { bump(`node:${t.subject}`); bump(`node:${t.object}`); bump(`edge:${edgeKey(t)}`); }

  const fold = foldThrough(tiers, arrival);
  reached.push({ ...f, triples, fold });
}

for (const t of tiers) {
  if (!massIsConsistent(t)) throw new Error(`tier ${t.name}: prior mass diverged from its total`);
}

const byAltitude = (n) => reached.filter((r) => r.fold.reached >= n && r.fold.results[n - 1]?.passed);

const index = { canonicalSource: TEXT_PATH, corefPrior: COREF_PATH, mechanism: "eoreader6 tiered belief-graph fold (emergence/tiers.js) — altitude earned by surviving surprise, not classified", tiers: {} };
let totalWaypoints = 0, totalVerified = 0;

for (let level = TIER_NAMES.length; level >= 1; level--) {
  const hits = byAltitude(level);
  const name = TIER_NAMES[level - 1];
  const waypoints = hits.map((h) => {
    const collapsed = h.text.replace(/\s+/g, " ").trim();
    const byteOffset = charToByteOffset(h.offset);
    const byteLength = Buffer.byteLength(rawFileText.slice(containerOffset + h.offset, containerOffset + h.endOffset), "utf8");
    const byteVerified = verifyByteSeek(byteOffset, byteLength, collapsed);
    totalWaypoints++; if (byteVerified) totalVerified++;
    return {
      byteOffset, byteLength, byteVerified,
      relation: h.triples.slice(0, 2).map((t) => `${t.subject.replace("ref:auto:", "")} ${t.polarity === "-" ? "NOT " : ""}${t.verb} ${t.object.replace("ref:auto:", "")}`).join(" · "),
      text: collapsed,
    };
  });
  index.tiers[name] = { count: waypoints.length, waypoints };
  console.log(`${name.toUpperCase()}: ${waypoints.length} waypoints, ${waypoints.filter((w) => w.byteVerified).length}/${waypoints.length} byte-verified`);
}

closeSync(fd);
writeFileSync(OUT_PATH, JSON.stringify(index, null, 2), "utf8");
console.log(`\n${totalVerified}/${totalWaypoints} total waypoints independently byte-verified.`);
console.log(`Navigation index written to ${OUT_PATH}`);

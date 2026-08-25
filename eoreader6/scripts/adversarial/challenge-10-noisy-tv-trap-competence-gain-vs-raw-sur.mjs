// Adversarial test — Challenge #10: "Noisy-TV trap (competence-gain vs raw
// surprisal)"
//
// CLAIM UNDER TEST: the ingestion gate keeps spans that improve prediction of
// the REST of the salient material (competence gain) — not spans that are
// merely high-surprisal (static/noise is high-surprisal but teaches nothing).
//
// There is no single artifact in this repo literally named "the ingestion
// gate" (host/corpus.js::admitChunked admits every chunk unconditionally, no
// filter of any kind). The two real candidates are:
//
//   (A) packages/engine/search/index.js::judge — THE RELEVANCE GATE that
//       decides which candidate (subject,verb,object,polarity) triples join
//       the reader's belief graph, wired through host/sing.js's self-directed
//       read/gate/commit loop. Its null is a degree-preserving tuple-rotate
//       of the graph's OWN edges — structural competence-gain, never a raw
//       surprisal score.
//
//   (B) SEED.md Amendment IV's shuffledGift/relevanceReport (candidates.js,
//       belief.js) — the CONSTITUTION'S OWN literal statement of the
//       noisy-TV trap ("a gift that looks apt and lowers no surprise is
//       irrelevant"), tested here on real books rather than the toy fixtures
//       conformance/generation.test.js already uses.
//
// This script tests (A) as the primary target (three angles) and (B) as a
// secondary corroboration, all against REAL text (Samuel Butler's public-
// domain translation of Homer's Odyssey, Project Gutenberg #1727, plus other
// real fixtures already checked into scripts/adversarial/fixtures/ by prior
// challenges), never toy sentences.
//
// PART A1 — SPAN ADMISSION, THREE CANDIDATE KINDS, SAME SOURCE:
//   structured-novel   a real, held-out stretch of the SAME Odyssey text
//                      (Books III/V/VI — never fed to the reader) — genuinely
//                      new narrative, genuinely structured.
//   word-shuffled       the EXACT SAME structured-novel span with its own
//                      words Fisher-Yates shuffled (seeded) — same
//                      vocabulary, same length, order destroyed. The literal
//                      "static" control the challenge names, drawn from the
//                      same source, Amendment-IV-style.
//   char-static         synthetic, seeded, out-of-vocabulary noise — pure
//                      "static", guaranteed unparseable as English, matched
//                      in length to the structured spans.
//
//   A naive "raw surprisal" ranker (material.js's own surprisalMicrobits,
//   trained on the reader's own read material — the repo's own off-the-shelf
//   surprisal metric) is computed for all three, so the trap is not a straw
//   man: we show what a next-token/word-frequency surprisal score actually
//   says before showing what the gate does.
//
// PART A2 — THE SHARPEST VERSION OF THE SAME QUESTION, AT THE GRAPH LAYER:
//   candidates built by permuting the READER'S OWN edges (same subjects,
//   same verbs, same object multiset per verb group — literally judge()'s
//   own null-generating recipe, run with an independent seed) are fed to
//   judge() many times. This is graph-shaped "noise" that could fool a
//   novelty detector keyed on "have I seen this EXACT triple before" (every
//   permuted triple is, in that sense, new) while carrying zero real
//   competence gain by construction. If the gate preserves these at anything
//   like the rate it preserves genuine narrative, the claim fails.
//
// PART B — AMENDMENT IV ON REAL BOOKS: does a real prior beat its own
// shuffled-order noise floor when read against real, held-out Frankenstein
// text (not the "the cat sat on the mat" toy fixtures the conformance suite
// already uses)?
//
// Run: node scripts/adversarial/challenge-10-noisy-tv-trap-competence-gain-vs-raw-sur.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createSession, admitChunked } from "../../packages/host/corpus.js";
import { createSinger, singRun } from "../../packages/host/sing.js";
import { stripContainer, splitSentences } from "../../packages/engine/perceiver/text/spans.js";
import { extractSurfaces } from "../../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet, surprisalMicrobits } from "../../packages/engine/perceiver/text/material.js";
import { discoverRelationVocab, extractRelations } from "../../packages/engine/perceiver/text/relations.js";
import { judge } from "../../packages/engine/search/index.js";
import { parseEdge } from "../../packages/engine/emergence/revision.js";
import { createLayer, createBelief } from "../../packages/engine/generation/belief.js";
import { shuffledGift } from "../../packages/engine/generation/candidates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = (f) => path.join(__dirname, "fixtures", f);

// ── declared numbers (never defaulted, matching scripts/sing-book.mjs) ─────
const GAMMA = 0.95;
const PRUNE_BELOW = 1e-4;
const RESEEDS = 60;
const SEED = 20260805;
const ALPHA = 1;
const LIMIT = 10;
const PASSES = 400; // ceiling; the loop stops early at no_candidate

let PASS = true;
const FAIL = (msg) => { PASS = false; console.log(`  *** FAIL: ${msg}`); };

// tiny seeded PRNG, used ONLY to build fixtures deterministically (not part
// of the engine under test) — same mulberry32-shaped generator this repo
// uses throughout (search/index.js::rng, candidates.js::shuffledGift).
const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWords = (text, seed) => {
  const words = text.split(/(\s+)/).filter((w) => w.length > 0);
  const idxWords = [];
  for (let i = 0; i < words.length; i++) if (!/^\s+$/.test(words[i])) idxWords.push(i);
  const next = rng(seed);
  const vals = idxWords.map((i) => words[i]);
  for (let i = vals.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [vals[i], vals[j]] = [vals[j], vals[i]];
  }
  idxWords.forEach((pos, k) => { words[pos] = vals[k]; });
  return words.join("");
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const staticNoise = (targetChars, seed) => {
  const next = rng(seed);
  let out = "";
  while (out.length < targetChars) {
    const len = 2 + Math.floor(next() * 9); // 2..10 chars, like real word lengths
    let w = "";
    for (let i = 0; i < len; i++) w += ALPHABET[Math.floor(next() * ALPHABET.length)];
    out += (out.length ? " " : "") + w;
  }
  return out.slice(0, targetChars);
};

const compressRatio = (text) => {
  const raw = Buffer.byteLength(text, "utf8");
  const gz = gzipSync(Buffer.from(text, "utf8")).length;
  return { raw, gz, ratio: gz / raw };
};

console.log("=".repeat(78));
console.log("CHALLENGE #10 — noisy-TV trap: competence-gain vs raw surprisal");
console.log("=".repeat(78));

// ── build the reader from a real, already-checked-in excerpt (Odyssey I-II) ─
const SEED_PATH = FIX("odyssey-book1-2-excerpt.txt");
const FULL_PATH = FIX("odyssey-full.txt");
if (!existsSync(SEED_PATH) || !existsSync(FULL_PATH)) {
  console.error("required fixtures missing:", SEED_PATH, FULL_PATH);
  process.exit(1);
}

const { text: seedText } = stripContainer(readFileSync(SEED_PATH, "utf8").replace(/\r\n/g, "\n"));
const { text: fullText } = stripContainer(readFileSync(FULL_PATH, "utf8").replace(/\r\n/g, "\n"));

const session = createSession();
const { chunks } = admitChunked(session, { text: seedText, sourceId: "source:odyssey-book1-2-excerpt.txt" });
console.log(`\ningested ${chunks} chunks from odyssey-book1-2-excerpt.txt (${seedText.length} chars)`);

const table = buildFrequencyTable(tokenize(seedText));
const functionWords = functionWordSet(table);
const surfaces = extractSurfaces(splitSentences(seedText), { functionWords });
const { verbs } = discoverRelationVocab(seedText, { surfaces, functionWords, minSurfaces: 1 });
console.log(`relation vocabulary measured from the SEED text: ${verbs.size} verbs`);

const singer = createSinger({ session, gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, limit: LIMIT, verbs });
const seedRun = singRun(singer, { passes: PASSES });
console.log(`seed run: ${seedRun.ended} after ${seedRun.pass} pass(es) — ${seedRun.preserved} preserved, ${seedRun.refused} refused, ${seedRun.censored} censored, ${seedRun.gaps} silent`);
console.log(`reader graph after seeding: ${singer.reader.nodes.size} nodes, ${singer.reader.edges.size} edges`);

if (singer.reader.edges.size < 5) {
  console.log("\n*** the seed run did not build enough graph structure for a discriminating gate — aborting");
  process.exit(1);
}

// ── PART A1: three candidate spans from/around the SAME source ─────────────
console.log("\n" + "-".repeat(78));
console.log("PART A1 — span admission: structured-novel vs shuffled vs static, same source");
console.log("-".repeat(78));

const cutAfterHeading = (heading, chars) => {
  // The real per-book heading is padded with blank lines on both sides
  // ("\n\n\nBOOK III\n\n\nTELEMACHUS VISITS..."); a bare indexOf(heading)
  // instead finds the front-matter TABLE OF CONTENTS listing ("BOOK III.\n
  // BOOK IV.\n..."), which is not narrative at all. Anchor on the padded
  // form so this is the actual chapter body, verified against `grep -n
  // "^BOOK "` on the real file.
  const re = new RegExp(`\\n\\n\\n${heading}\\n\\n\\n[^\\n]*\\n\\n\\n`);
  const m = re.exec(fullText);
  if (!m) throw new Error(`chapter heading not found: ${heading}`);
  const from = m.index + m[0].length;
  return fullText.slice(from, from + chars).trim();
};

const NOVEL_TARGET_CHARS = 2200;
const structuredSpans = [
  { label: "BOOK III (Telemachus at Pylos, meets Nestor)", text: cutAfterHeading("BOOK III", NOVEL_TARGET_CHARS) },
  { label: "BOOK V (Calypso's island, raft-building)", text: cutAfterHeading("BOOK V", NOVEL_TARGET_CHARS) },
  { label: "BOOK VI (Nausicaa at the river)", text: cutAfterHeading("BOOK VI", NOVEL_TARGET_CHARS) },
];

// sanity: none of these three excerpts occur verbatim in the already-read
// seed text — they must be genuinely unread material.
for (const s of structuredSpans) {
  if (seedText.includes(s.text.slice(0, 200))) throw new Error(`${s.label}: overlaps the already-read seed text — not a valid held-out span`);
}

const fixtureRecord = { seedPath: SEED_PATH, structuredSpans: [], recombinantTrials: null };

const spanReport = (label, text) => {
  const bits = surprisalMicrobits(text, table);
  const { raw, gz, ratio } = compressRatio(text);
  const triples = extractRelations(text, { verbs });
  let verdict = null, what = null, newNodes = null, newEdges = null;
  if (triples.length === 0) {
    verdict = "gap:empty_material";
  } else {
    const j = judge(singer.reader, triples, { reseeds: RESEEDS, seed: SEED + label.length });
    verdict = j.verdict;
    what = j.what;
    newNodes = j.operator_changes.INS.nodes.length;
    newEdges = j.operator_changes.INS.edges.length;
  }
  console.log(`\n  [${label}]`);
  console.log(`    chars=${text.length} triples=${triples.length} surprisal(microbits/word)=${bits.toFixed(0)} gzip-ratio=${ratio.toFixed(3)} (raw ${raw}B -> gz ${gz}B)`);
  console.log(`    verdict=${verdict}${newNodes !== null ? `  newNodes=${newNodes} newEdges=${newEdges}` : ""}`);
  if (what) console.log(`    why: ${what}`);
  return { label, chars: text.length, triples: triples.length, surprisal: bits, compressRatio: ratio, verdict, newNodes, newEdges };
};

const results = [];
let idx = 0;
for (const s of structuredSpans) {
  idx++;
  const shuffled = shuffleWords(s.text, SEED + idx);
  fixtureRecord.structuredSpans.push({ label: s.label, structured: s.text, shuffled });

  console.log(`\n=== source: ${s.label} ===`);
  const rStructured = spanReport(`structured-novel · ${s.label}`, s.text);
  const rShuffled = spanReport(`word-shuffled · ${s.label}`, shuffled);
  results.push({ kind: "structured", ...rStructured });
  results.push({ kind: "shuffled", ...rShuffled });
}

// one shared char-static control, length-matched to the average structured span
const avgLen = Math.round(structuredSpans.reduce((a, s) => a + s.text.length, 0) / structuredSpans.length);
const staticText = staticNoise(avgLen, SEED + 999);
fixtureRecord.staticNoise = staticText;
console.log(`\n=== source: synthetic char-static noise (length-matched, seeded) ===`);
const rStatic = spanReport("char-static noise", staticText);
results.push({ kind: "static", ...rStatic });

// ── verdict logic for A1 ────────────────────────────────────────────────────
console.log("\n" + "-".repeat(78));
console.log("A1 scorecard");
console.log("-".repeat(78));
const structuredResults = results.filter((r) => r.kind === "structured");
const noiseResults = results.filter((r) => r.kind !== "structured");

const structuredPreserved = structuredResults.filter((r) => r.verdict === "preserve");
console.log(`structured-novel spans preserved: ${structuredPreserved.length}/${structuredResults.length}`);
if (structuredPreserved.length < structuredResults.length) {
  FAIL(`a genuinely novel, structured, held-out narrative span was NOT preserved (${structuredResults.filter(r=>r.verdict!=="preserve").map(r=>r.label).join(", ")})`);
}

const noisePreserved = noiseResults.filter((r) => r.verdict === "preserve");
console.log(`noise spans (shuffled + static) preserved: ${noisePreserved.length}/${noiseResults.length}`);
if (noisePreserved.length > 0) {
  FAIL(`noise was preserved into the reader's graph: ${noisePreserved.map((r) => r.label).join(", ")}`);
}

// the raw-surprisal trap check: does naive surprisal actually favor noise?
const maxStructuredSurprisal = Math.max(...structuredResults.map((r) => r.surprisal));
const minNoiseSurprisal = Math.min(...noiseResults.map((r) => r.surprisal));
console.log(`max structured-novel surprisal = ${maxStructuredSurprisal.toFixed(0)} microbits/word`);
console.log(`min noise surprisal            = ${minNoiseSurprisal.toFixed(0)} microbits/word`);
const trapIsReal = minNoiseSurprisal >= maxStructuredSurprisal * 0.9; // noise is at least comparably "surprising"
console.log(trapIsReal
  ? "  => raw surprisal does NOT reliably separate noise from structured content here — a naive surprisal-ranker would risk keeping the noise. This is the trap the claim is about."
  : "  => (raw surprisal happened to separate these particular spans on its own; the gate's behavior is still the decisive test below)");

// ── PART A2: graph-native rotation-shaped "noise" — the sharpest test ──────
console.log("\n" + "-".repeat(78));
console.log("PART A2 — recombinant candidates drawn from the reader's OWN edges");
console.log("(same subjects, same verbs, same object multiset per verb group —");
console.log(" literally judge()'s own null-generating recipe, independent seed)");
console.log("-".repeat(78));

const byVerb = new Map();
for (const [k] of singer.reader.edges) {
  const { s, v, o, neg } = parseEdge(k);
  if (!byVerb.has(v)) byVerb.set(v, []);
  byVerb.get(v).push({ s, o, neg });
}
const varyingGroups = [...byVerb.entries()].filter(([, list]) => list.length >= 2);
console.log(`verb groups in the reader's graph: ${byVerb.size} total, ${varyingGroups.length} with >=2 members (able to vary under permutation)`);

const TRIALS = 40;
let recombPreserve = 0, recombRefuse = 0, recombCensored = 0, recombEmpty = 0;
for (let t = 0; t < TRIALS; t++) {
  const next = rng(90000 + t);
  const candidate = [];
  for (const [v, list] of varyingGroups) {
    const objs = list.map((e) => e.o);
    for (let i = objs.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [objs[i], objs[j]] = [objs[j], objs[i]];
    }
    list.forEach((e, i) => {
      candidate.push({ subject: e.s, verb: v, object: objs[i], polarity: e.neg ? "-" : "+" });
    });
  }
  if (candidate.length === 0) { recombEmpty++; continue; }
  const j = judge(singer.reader, candidate, { reseeds: RESEEDS, seed: 500000 + t });
  if (j.verdict === "preserve") recombPreserve++;
  else if (j.verdict === "refuse") recombRefuse++;
  else recombCensored++;
}
console.log(`${TRIALS} trials: preserve=${recombPreserve} refuse=${recombRefuse} censored=${recombCensored} empty=${recombEmpty}`);
const recombPreserveRate = recombPreserve / TRIALS;
const structuredPreserveRate = structuredPreserved.length / structuredResults.length;
console.log(`recombinant preserve-rate = ${(recombPreserveRate * 100).toFixed(0)}%  vs  genuine-novel-narrative preserve-rate = ${(structuredPreserveRate * 100).toFixed(0)}%`);
if (recombPreserveRate > 0.5) {
  FAIL(`the gate preserved a majority (${recombPreserve}/${TRIALS}) of pure edge-rotation recombinants — structure-shaped noise is being rewarded as if it were competence gain`);
}
if (recombPreserveRate >= structuredPreserveRate && structuredPreserveRate > 0) {
  FAIL(`recombinant (structurally-generated) noise preserved at least as often as genuine novel narrative — the gate is not discriminating on real competence gain`);
}

// ── PART B: Amendment IV on real books (not toy fixtures) ──────────────────
console.log("\n" + "-".repeat(78));
console.log("PART B — Amendment IV / shuffledGift noise floor, on real books");
console.log("-".repeat(78));

const READ_PATH = FIX("frankenstein-excerpt.txt");
const GIFT_PATHS = [
  { path: FIX("cookery-22114-raw.txt"), id: "cookery", giver: "A Plain Cookery Book for the Working Classes (PG 22114) — different register, different domain" },
  { path: FIX("tesla-27400-raw.txt"), id: "the-martian", giver: "The Martian (PG 27400) — fiction narrative, different story" },
];

const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const loadTokens = (p, cap) => {
  const { text } = stripContainer(readFileSync(p, "utf8").replace(/\r\n/g, "\n"));
  const toks = text.toLowerCase().match(WORD) ?? [];
  return cap ? toks.slice(0, cap) : toks;
};

if (existsSync(READ_PATH) && GIFT_PATHS.every((g) => existsSync(g.path))) {
  const ORDER_B = 3, ALPHA_B = 0.7, GAMMA_B = 0.9999, RHO_B = 0.999, SEED_B = SEED;
  const READ_CAP = 25000, GIFT_CAP = 15000;

  const readTokens = loadTokens(READ_PATH, READ_CAP);
  const priors = GIFT_PATHS.map((g) => ({ ...g, tokens: loadTokens(g.path, GIFT_CAP) }));

  console.log(`read text: frankenstein-excerpt.txt, ${readTokens.length} forms (capped)`);
  for (const p of priors) console.log(`gift: ${p.id.padEnd(14)} ${p.tokens.length} forms (capped) — ${p.giver}`);

  const layers = [createLayer({ id: "read", tier: "read", order: ORDER_B, gamma: GAMMA_B, alpha: ALPHA_B })];
  for (const p of priors) {
    const layer = createLayer({ id: p.id, tier: "received", giver: p.giver, order: ORDER_B, gamma: 1, alpha: ALPHA_B });
    layer.train(p.tokens);
    layers.push(layer);
  }
  for (const p of priors) layers.push(shuffledGift({ order: ORDER_B, alpha: ALPHA_B, from: p, seed: SEED_B }));

  const belief = createBelief({ layers, rho: RHO_B });
  const seen = [];
  for (let i = 0; i < readTokens.length; i++) {
    const ctx = seen.slice(Math.max(0, seen.length - ORDER_B));
    belief.witnessForm(ctx, readTokens[i]);
    seen.push(readTokens[i]);
    belief.readLayer.observe(seen, seen.length - 1);
  }

  const report = belief.relevanceReport();
  const real = report.layers.filter((l) => !l.is_noise_control).sort((a, b) => b.share - a.share);
  const control = report.layers.filter((l) => l.is_noise_control).sort((a, b) => b.share - a.share);
  console.log(`\nfinal standing after ${report.observations} forms read:`);
  for (const l of real) console.log(`  ${l.id.padEnd(14)} share=${(l.share * 100).toFixed(2)}%  above_noise=${l.above_noise}`);
  for (const l of control) console.log(`  ${l.id.padEnd(14)} share=${(l.share * 100).toFixed(2)}%  [noise floor]`);

  const bestReal = real[0]?.share ?? 0;
  const bestControl = control[0]?.share ?? 0;
  console.log(`\nbest real gift share=${(bestReal * 100).toFixed(2)}%  best noise floor=${(bestControl * 100).toFixed(2)}%`);
  if (bestReal <= bestControl) {
    FAIL(`on real books, no gift beat its own shuffled noise floor (best real ${(bestReal*100).toFixed(2)}% <= best floor ${(bestControl*100).toFixed(2)}%) — Amendment IV would be REFUTED on this material`);
  } else {
    console.log("  => at least one real gift beats its own order-destroyed noise floor on real text: Amendment IV holds here.");
  }
} else {
  console.log("(skipped — required real-book fixtures not all present)");
}

// ── persist the exact candidate texts used, for reproducibility ────────────
const outDir = FIX("");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "challenge-10-candidate-spans.json"), JSON.stringify(fixtureRecord, null, 2));
console.log(`\n(candidate spans and their shuffled/static variants written to fixtures/challenge-10-candidate-spans.json for the record)`);

console.log("\n" + "=".repeat(78));
console.log(PASS ? "OVERALL: PASS — the gate tracked competence gain, not raw surprisal, in every angle tested." : "OVERALL: FAIL — see *** lines above.");
console.log("=".repeat(78));
process.exit(PASS ? 0 : 1);

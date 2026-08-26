// eoreader6 · read-ladder — THE LADDER, READ LEFT TO RIGHT (L3/L4).
//
// LOSS-LESS-LADDER.md measured the whole rung chain against a verb vocabulary
// built over the WHOLE text before reading a single frame (probe-ladder-full):
// that is a whole-document table, and the arrow-of-time law refuses it — "a
// fold that conditions on material it has not read yet is not a reader; it is
// an index" (L3). This is the same ladder with the leak closed:
//
//   · THE VERB VOCABULARY IS INCREMENTAL. discoverRelationVocab is called on
//     each frame as it is read. A verb is admitted at the END of a frame once
//     it has ALREADY followed >= minSurfaces distinct surfaces in the frames
//     read so far, and frame t's relations are extracted against the
//     vocabulary as it stood when t was read — never a verb first met at t or
//     later. The price of reading is the one activation.js names for recall
//     ("the third occurrence is the first that can recall"): a verb's own
//     first surface-following frame is invisible to it.
//   · EXTRACTION IS PER FRAME, against the vocabulary as it stands.
//   · EVERY KEPT TRIPLE KEEPS ITS BYTE ADDRESSES (L1 — the drill-down is an
//     address, never an answer).
//   · RECALL IS WIRING, NOT RE-SCORING (L4). Each frame's clean triples are
//     read into the graph the moment they are met — belief decayed per
//     observation, edges written at read time — and the tiers fold the
//     node+edge arrivals with the same single spec as read-tiered.mjs. Nothing
//     is recomputed from proximity at the end.
//
// THIS SCRIPT MEASURES BOTH POLICIES, so the price of causality is a number:
//
//   policy A — the whole-text record (the probe's shape: vocabulary measured
//              once over the whole text). Legal as a RECORD, refused as the
//              technique.
//   policy B — the causal reader. Same extraction, same graph, same tiers;
//              only the vocabulary is incremental.
//
// The delta between them is the myopia: relations in frames whose verb had
// not yet been earned. Where the drill-down survives under B, causality was
// nearly free on this corpus — which is itself the finding, and it is the
// same cost activation.js already measured for recall.
//
// WHAT IS RECEIVED, DOCUMENTED AS SUCH (L3 names frequency tables — idf, df —
// and this reader closes exactly those): the cast (extractSurfaces is
// per-occurrence — a name is recognised the moment it appears) and the closed
// class (functionWordSet, this text's own Zipf curve — a stable language
// prior, same tier as an abbreviation prior). The verb vocabulary is the one
// whole-document frequency table the ladder still had, and it is the one
// closed here.
//
// Declared numbers, once for the whole stack (SEED.md's three; gamma and
// prune are derived from WINDOW by the same identities read-tiered.mjs uses):

const SENTENCES_PER_FRAME = 6;
const TIER_NAMES = ["atmosphere", "lens", "paradigm"];
const WINDOW = 12;        // the reach of the present
const DRAWS = 200;        // the resolution of testimony — finest rank sayable is 1/draws
const TIER_SEED = 20260803; // the received stream; the engine holds no randomness
const MIN_SURFACES = 1;   // how much recurrence admits a verb (same as the probe)
const TRIPLE_TOKEN_CAP = 16;
const PRUNE_BELOW = 1e-4;

// ── binding declared numbers ────────────────────────────────────────────────
const BINDING_WINDOW = 2;    // co-arrival window: how close in frame index
const BINDING_DRAWS = 199;   // null draws for displacement, reversal, reseed

import { readFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { extractRelations, discoverRelationVocab } from "../packages/engine/perceiver/text/relations.js";
import { extractSurfaces, discoverReferents, diaNorm } from "../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../packages/engine/perceiver/text/material.js";
import { projectReferents } from "../packages/engine/referents/index.js";
import { resolveAllNarratorSpans, narratorAt, isFirstPerson } from "../packages/engine/perceiver/text/narrator.js";
import { createGraph, readTriples, edgeKey, strongestEdges } from "../packages/engine/emergence/graph.js";
import { createTierStack, foldThrough, massIsConsistent, gammaFor } from "../packages/engine/emergence/tiers.js";
import { readLinks, bindingTriples } from "../packages/engine/emergence/binding.js";

const TEXT_PATH = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const COREF_PATH = process.argv[3] || "scripts/adversarial/fixtures/pg84-frankenstein.coref.json";
const { text } = stripContainer(readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));

const sentences = splitSentences(text);
const frames = [];
for (let i = 0; i < sentences.length; i += SENTENCES_PER_FRAME) {
  const g = sentences.slice(i, i + SENTENCES_PER_FRAME);
  if (g.length) frames.push({ order: frames.length, offset: g[0].offset, text: g.map((s) => s.text).join(" ") });
}

// ── the cast and the closed class, received measurements ────────────────────
const table = buildFrequencyTable(tokenize(text));
const functionWords = functionWordSet(table);
const surfaces = extractSurfaces(sentences, { functionWords });
const cast = projectReferents(discoverReferents(surfaces).events).filter((r) => !r.mergedInto);

const surfaceToId = [];
for (const r of cast) for (const s of r.surfaces) {
  const n = diaNorm(s);
  if (n.length < 2) continue;
  surfaceToId.push([n, new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u"), r.id]);
}
surfaceToId.sort((a, b) => b[0].length - a[0].length);

const coref = JSON.parse(readFileSync(COREF_PATH, "utf8"));
const { resolved: narratorSpans, unresolved: narratorGaps } = resolveAllNarratorSpans(text, coref.referents);

const LAST_TOKEN = /(\S+)$/;
const makeResolver = () => {
  const stats = { named: 0, bound: 0, gapped: 0 };
  const resolve = (phrase, offset) => {
    const p = diaNorm(phrase);
    const last = p.match(LAST_TOKEN)?.[1] ?? "";
    if (isFirstPerson(last)) {
      const n = narratorAt(offset, narratorSpans);
      if (n.referentId) { stats.bound++; return n.referentId; }
      stats.gapped++;
      return null;
    }
    for (const [, re, id] of surfaceToId) if (re.test(p)) { stats.named++; return id; }
    return null;
  };
  return { resolve, stats };
};

// ── the two vocab policies ──────────────────────────────────────────────────
const wholeText = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: MIN_SURFACES });

const policyA = {
  label: "A whole-text",
  vocab: wholeText.verbs,
  observe: () => null,
};

const policyB = {
  label: "B causal",
  vocab: new Set(),
  seenFollowing: new Map(), // verb -> Set(surfaceForm) from frames already read
  curve: [],
  observe(frameText) {
    // Scan THIS frame for new surface-following tokens and admit for the
    // future. discoverRelationVocab applies the same admission rules this
    // organ already owns (not a second implementation): a candidate is not
    // itself capitalised, not a bare number, not a member of this text's
    // closed class, not a negation marker — and `surfaceForms` now carries
    // the distinct surfaces it followed, so the accumulation across frames
    // is a union, never a re-count.
    const frameVocab = discoverRelationVocab(frameText, { surfaces, functionWords, minSurfaces: MIN_SURFACES });
    for (const c of frameVocab.candidates) {
      let set = policyB.seenFollowing.get(c.verb);
      if (!set) policyB.seenFollowing.set(c.verb, (set = new Set()));
      for (const form of c.surfaceForms) set.add(form);
      if (set.size >= MIN_SURFACES) policyB.vocab.add(c.verb);
    }
    policyB.curve.push(policyB.vocab.size);
    return null;
  },
};

// ── one full pass of the ladder under one vocab policy ──────────────────────
const readPass = (policy) => {
  const graph = createGraph({ gamma: gammaFor(WINDOW), pruneBelow: PRUNE_BELOW });
  const tiers = createTierStack(TIER_NAMES, { window: WINDOW, draws: DRAWS, seed: TIER_SEED });
  const { resolve, stats } = makeResolver();
  const edges = [];
  const clean = [];
  let emptyFrames = 0;
  let firstAdmissions = [];

  // ── entity arrivals for binding ──────────────────────────────────────────
  const referentArrivals = new Map(); // referentId -> [frameOrder, ...]

  for (const f of frames) {
    const raw = extractRelations(f.text, { verbs: policy.vocab, functionWords });
    const frameEdges = [];
    const frameClean = [];

    for (const r of raw) {
      const subjectId = resolve(r.subject, f.offset);
      const objectId = resolve(r.object, f.offset);
      const phraseTokens = r.object.split(/\s+/).filter(Boolean).length;
      if (!subjectId && !objectId && (phraseTokens > TRIPLE_TOKEN_CAP || phraseTokens < 2)) continue;
      const sub = text.indexOf(r.subject, f.offset);
      const obj = text.indexOf(r.object, f.offset);
      frameEdges.push({ subject: r.subject, subjectId, verb: r.verb, object: r.object, objectId, polarity: r.polarity, frame: f.order, subAt: sub, objAt: obj });
      if (subjectId && objectId && subjectId !== objectId) frameClean.push({ subject: subjectId, verb: r.verb, object: objectId, polarity: r.polarity, frame: f.order });

      // track referent arrivals for binding (frame index = arrival position)
      if (subjectId) {
        const arr = referentArrivals.get(subjectId);
        if (!arr) referentArrivals.set(subjectId, [f.order]);
        else if (arr[arr.length - 1] !== f.order) arr.push(f.order);
      }
      if (objectId) {
        const arr = referentArrivals.get(objectId);
        if (!arr) referentArrivals.set(objectId, [f.order]);
        else if (arr[arr.length - 1] !== f.order) arr.push(f.order);
      }
    }

    if (frameEdges.length) {
      edges.push(...frameEdges);
      clean.push(...frameClean);
    } else {
      emptyFrames++;
    }

    // L4: the graph is wired at read time — the frame's clean triples enter
    // the graph NOW, so belief decays per observation as the reading goes.
    if (frameClean.length) readTriples(graph, frameClean);

    // the tiers fold the node+edge arrivals, same spec as read-tiered.mjs.
    if (frameEdges.length) {
      const arrival = new Map();
      const bump = (k) => arrival.set(k, (arrival.get(k) ?? 0) + 1);
      for (const e of frameEdges) {
        if (e.subjectId) bump(`node:${e.subjectId}`);
        if (e.objectId) bump(`node:${e.objectId}`);
        if (e.subjectId && e.objectId) bump(`edge:${edgeKey(e)}`);
      }
      foldThrough(tiers, arrival);
    }

    policy.observe?.(f.text);
  }

  for (const t of tiers) if (!massIsConsistent(t)) throw new Error(`tier ${t.name}: prior mass diverged`);

  // ── binding: modality-blind Link over entity arrivals ─────────────────────
  const entityRegister = [...referentArrivals.entries()]
    .filter(([, arr]) => arr.length >= 2)
    .map(([id, arrivals]) => ({ id, arrivals: arrivals.sort((a, b) => a - b) }));

  let bindingLinks = [];
  let bindingTriplesCount = 0;
  if (entityRegister.length >= 2) {
    bindingLinks = readLinks(entityRegister, {
      window: BINDING_WINDOW,
      draws: BINDING_DRAWS,
      seed: TIER_SEED,
      totalUnits: frames.length,
    });
    const lt = bindingTriples(bindingLinks);
    bindingTriplesCount = lt.length;
    if (lt.length > 0) readTriples(graph, lt, { structural: true });
  }

  return { graph, tiers, edges, clean, stats, emptyFrames, entityRegister, bindingLinks, bindingTriplesCount };
};

// ── the drill-down audit, one policy ────────────────────────────────────────
const BENCH = [
  ["school", 55560, "ingolstadt"],
  ["study", 48010, "natural philosophy"],
  ["flee", 86787, "rushed out of the room"],
  ["brought to life", 85355, "spark of being"],
  ["create a female", 261131, "create a female"],
  ["strangled", 322737, "strangled"],
];

const audit = (pass) => {
  for (const [q, byte, frag] of BENCH) {
    const narr = narratorSpans.filter((s) => byte >= s.from && byte < s.to).map((s) => s.referentId.replace("ref:narrator:", ""));
    const covering = pass.edges.filter((e) =>
      (e.subAt >= 0 && byte >= e.subAt && byte < e.subAt + e.subject.length) ||
      (e.objAt >= 0 && byte >= e.objAt && byte < e.objAt + e.object.length),
    );
    const fragCovering = covering.filter((e) => e.object.toLowerCase().includes(frag) || e.subject.toLowerCase().includes(frag));
    console.log(`  Q "${q}"  answer @${byte} ("${frag}")`);
    console.log(`    narrator scope: ${narr.length ? narr[0] : "—"}   relation covers: ${covering.length ? "YES" : "NO"}${fragCovering.length ? "  ◄ frag verbatim" : ""}`);
    for (const e of covering.slice(0, 2)) console.log(`      [${e.subject}] ${e.verb} [${e.object.slice(0, 55)}]`);
  }
};

const report = (label, pass) => {
  console.log(`\n${"═".repeat(72)}\n${label}\n${"═".repeat(72)}`);
  console.log(`  vocab: ${policyA.vocab.size} whole-text verbs (policy A) / ${policyB.vocab.size} causal (policy B)`);
  console.log(`  relations: ${pass.edges.length} lossless kept, ${pass.clean.length} with both ends resolved (${pass.stats.named} named, ${pass.stats.bound} bound by scope, ${pass.stats.gapped} typed gaps)`);
  console.log(`  frames with no relation: ${pass.emptyFrames} of ${frames.length}`);
  console.log(`  graph: ${pass.graph.nodes.size} nodes, ${pass.graph.edges.size} live relations, ${pass.graph.tick} observations`);
  for (const e of strongestEdges(pass.graph, 5)) console.log(`      ${e.weight.toFixed(2)}  ${e.edge}`);
  for (const t of pass.tiers) console.log(`  tier ${t.name.padEnd(11)} observed ${String(t.observations).padStart(4)}, shifted ${t.shifts}`);

  // ── binding results ──────────────────────────────────────────────────────
  const witnessed = pass.bindingLinks.filter((l) => l.direction !== null);
  console.log(`  binding: ${pass.entityRegister.length} entities, ${pass.bindingLinks.length} pairs tested, ${witnessed.length} witnessed (${pass.bindingTriplesCount} triples → graph)`);
  for (const l of witnessed.slice(0, 8)) {
    const from = l.direction === "a→b" ? l.a.id : l.b.id;
    const to = l.direction === "a→b" ? l.b.id : l.a.id;
    console.log(`    ${from} → ${to}  polarity=${l.polarity}  strength=${l.strength.toFixed(4)}  disp=${l.nulls.displacement.pValue.toFixed(3)} rev=${l.nulls.reversal.pValue.toFixed(3)} reseed=${l.nulls.reseed.pValue.toFixed(3)}`);
  }
};

console.log(`LADDER ${TEXT_PATH.split("/").pop()} — ${frames.length} frames, ${MIN_SURFACES} min surfaces, ${SENTENCES_PER_FRAME} sentences/frame`);
console.log(`cast ${cast.length} referents | narrator spans ${narratorSpans.length} resolved, ${narratorGaps.length} unresolved`);
console.log(`binding: window ${BINDING_WINDOW}, draws ${BINDING_DRAWS} (SEED.md Amendments X–XIII)`);
console.log(`whole-text vocab: ${policyA.vocab.size} verbs (has "rushed"? ${policyA.vocab.has("rushed")} "went"? ${policyA.vocab.has("went")} "became"? ${policyA.vocab.has("became")})`);

const passA = readPass(policyA);
report("POLICY A — the whole-text record (the probe's shape)", passA);

const passB = readPass(policyB);
report("POLICY B — the causal reader (the technique)", passB);

// ── the price of causality, measured ────────────────────────────────────────
const keyOf = (e) => `${e.subAt}|${e.verb}|${e.objAt}`;
const setA = new Set(passA.edges.map(keyOf));
const setB = new Set(passB.edges.map(keyOf));
const missed = passA.edges.filter((e) => !setB.has(keyOf(e)));
const gained = passB.edges.filter((e) => !setA.has(keyOf(e)));
console.log(`\nPRICE OF CAUSALITY — relations B lost to the reader's myopia: ${missed.length} (of ${passA.edges.length})`);
const early = missed.filter((e) => e.frame <= 60).length;
console.log(`  of those, ${early} in the first 60 frames — the reader's first hundred pages`);
for (const e of missed.slice(0, 6)) console.log(`    frame ${String(e.frame).padStart(3)}  [${e.subject.slice(0, 22)}] ${e.verb} [${e.object.slice(0, 32)}]`);
if (gained.length) console.log(`  relations only the causal reader kept (policy-B grammar): ${gained.length}`);

// ── the vocab curve ─────────────────────────────────────────────────────────
const curve = policyB.curve;
const admittedAt = [];
{
  const admitted = new Set();
  const seen = new Map();
  for (let fi = 0; fi < frames.length; fi++) {
    const frameVocab = discoverRelationVocab(frames[fi].text, { surfaces, functionWords, minSurfaces: MIN_SURFACES });
    for (const c of frameVocab.candidates) {
      let s = seen.get(c.verb);
      if (!s) seen.set(c.verb, (s = new Set()));
      for (const form of c.surfaceForms) s.add(form);
      if (s.size >= MIN_SURFACES && !admitted.has(c.verb)) { admitted.add(c.verb); admittedAt.push([fi, c.verb]); }
    }
  }
}
console.log(`\nVOCAB CURVE — verb admitted (frame, verb) for the first ${Math.min(12, admittedAt.length)}:`);
for (const [fi, v] of admittedAt.slice(0, 12)) console.log(`    frame ${String(fi).padStart(4)}  ${v}`);
console.log(`  last new admission at frame ${admittedAt.length ? admittedAt[admittedAt.length - 1][0] : "—"} of ${frames.length}`);

console.log(`\n${"═".repeat(72)}\nDRILL-DOWN — the address ladder, both policies\n${"═".repeat(72)}`);
console.log("POLICY A — the whole-text record (the probe's shape):");
audit(passA);
console.log("\nPOLICY B — the causal reader (the technique):");
audit(passB);

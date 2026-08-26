// native/eval/narrative-rhythm-prior.mjs — prediction at a HIGHER level of
// abstraction, drawn from a prior work: "we never read Frankenstein as our
// first book."
//
// The sibling experiment (PR #17, experience-priors.js) sediments WHICH
// structures recur across works (terrain / stance / operator memories).
// This one measures WHEN — narrative rhythm: how soon an admitted being,
// once mentioned, is mentioned again. That is a property of no particular
// string or referent — it is a claim about narrative-as-a-kind, which is
// exactly what makes it a candidate PRIOR: learned on one work, carried to
// another, correct or refutable there. Same contract as
// deriveExperiencePrior's own header: nothing from the target source is
// accepted into the prior; memory is descriptive, never witness.
//
// THE PRIOR. Read work A; collect every admitted referent's mention
// positions (EOMention@1, the perceiver's own output); pool the
// inter-mention gaps; summarize as the MEDIAN (a declared standard summary,
// not a tuned threshold). `EORhythmPrior@1 { medianGap, gaps, provenance }`.
//
// THE EXPECTATION ON WORK B. At every mention of an admitted referent
// (except its last), the reader carrying the prior predicts: the next
// mention of this being arrives within `medianGap` encounters. The outcome
// is mechanical — fulfilled or violated by B's own mention stream, no
// judgment anywhere.
//
// PRE-REGISTERED, before any target run (misses reported as misses — the
// expectation-traffic amendment's own discipline, which its fulfilment
// prediction already paid once):
//   (1) ORDERED beats SHUFFLED under any prior: coherent narrative is
//       BURSTY (beings cluster in scenes), so more gaps sit under a fixed
//       threshold than under a permutation, which spreads mentions toward
//       geometric gaps.
//   (2) TRANSFER WITHIN THE KIND: the novel prior (Pride and Prejudice)
//       scores ordered Frankenstein close to Frankenstein's own self-prior
//       — rhythm is a property of the kind "novel," not of one book.
//   (3) EXPLORATORY, uncertainty admitted both ways: the play prior
//       (Hamlet) may carry a different medianGap — if it does, the
//       abstraction has a measurable boundary (novel-rhythm ≠ play-rhythm);
//       if it does not, rhythm is broader than the novel/play cut. Neither
//       outcome is a failure; both are findings.
//
// ASSEMBLY, NAMED (P0's rule: any claim names the assembly it was measured
// on): this driver runs the PERCEIVER ONLY — createCausalTextPerceiver's
// own mention stream, in causal order. The fold/revision/identity tier is
// NOT exercised; wiring the rhythm prior into kernel expectations on the
// fold is the named next step once the transfer question is answered here.
//
// Usage: node native/eval/narrative-rhythm-prior.mjs <pg84.txt> <pg1342.txt> <pg1524.txt>

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";

const SEED = 0;
const SHUFFLE_DRAWS = 2; // same declared budget as the scoreboard

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(items, rand) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function loadEncounters(path, source) {
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  if (!stripped.looks_like_material) throw new Error(`${path} does not look like readable material`);
  return textEncounters(stripped.text, { source, offset: stripped.offset });
}

// Perceiver-only mention stream, causal order — referent id -> [positions].
async function mentionStream(encounters) {
  const perceiver = createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25 });
  const mentions = new Map();
  let pos = 0;
  for (const enc of encounters) {
    const out = await perceiver.perceive({ ...enc, sequencePosition: pos }, {});
    for (const candidate of out ?? []) {
      for (const entry of candidate.candidate?.graphEntries ?? []) {
        if (entry?.schema !== "EOMention@1") continue;
        if (!mentions.has(entry.referent)) mentions.set(entry.referent, []);
        const list = mentions.get(entry.referent);
        if (list[list.length - 1] !== pos) list.push(pos);
      }
    }
    pos += 1;
  }
  return { mentions, turns: pos };
}

function pooledGaps(mentions) {
  const gaps = [];
  for (const positions of mentions.values()) {
    for (let i = 1; i < positions.length; i += 1) gaps.push(positions[i] - positions[i - 1]);
  }
  return gaps.sort((a, b) => a - b);
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function rhythmPrior(mentions, source) {
  const gaps = pooledGaps(mentions);
  return Object.freeze({
    schema: "EORhythmPrior@1",
    medianGap: median(gaps),
    gapCount: gaps.length,
    quartiles: [median(gaps.slice(0, Math.floor(gaps.length / 2))), median(gaps), median(gaps.slice(Math.ceil(gaps.length / 2)))],
    provenance: Object.freeze({ source, giver: "eval/narrative-rhythm-prior::rhythmPrior", basis: "pooled inter-mention gaps of the perceiver's own admitted-referent mention stream; median is a declared standard summary, not a tuned threshold" }),
  });
}

// Fulfilment of the prior's expectation against a target mention stream.
function scoreExpectations(mentions, medianGap) {
  let fulfilled = 0, violated = 0;
  for (const positions of mentions.values()) {
    for (let i = 0; i + 1 < positions.length; i += 1) {
      if (positions[i + 1] - positions[i] <= medianGap) fulfilled += 1;
      else violated += 1;
    }
  }
  const total = fulfilled + violated;
  return { expectations: total, fulfilled, violated, fulfilmentRate: total ? fulfilled / total : null };
}

async function main() {
  const [target, novelPrior, playPrior] = process.argv.slice(2);
  if (!target || !novelPrior || !playPrior) throw new TypeError("usage: node native/eval/narrative-rhythm-prior.mjs <target pg84> <novel-prior pg1342> <play-prior pg1524>");

  console.error("reading prior work A1 (novel)...");
  const a1 = await mentionStream(loadEncounters(novelPrior, "gutenberg:1342"));
  const novel = rhythmPrior(a1.mentions, "gutenberg:1342");
  console.error("reading prior work A2 (play)...");
  const a2 = await mentionStream(loadEncounters(playPrior, "gutenberg:1524"));
  const play = rhythmPrior(a2.mentions, "gutenberg:1524");

  console.error("reading target B ordered...");
  const bEncounters = loadEncounters(target, "gutenberg:84");
  const bOrdered = await mentionStream(bEncounters);
  const self = rhythmPrior(bOrdered.mentions, "gutenberg:84"); // self-prior, for the transfer comparison ONLY — never a carried prior

  const rand = mulberry32(SEED);
  const bShuffled = [];
  for (let d = 0; d < SHUFFLE_DRAWS; d += 1) {
    console.error(`reading target B shuffled #${d}...`);
    const perm = shuffled(bEncounters, rand).map((e, i) => ({ ...e, sequencePosition: i }));
    bShuffled.push(await mentionStream(perm));
  }

  const runs = [{ label: "ordered", stream: bOrdered }, ...bShuffled.map((s, i) => ({ label: `shuffled#${i}`, stream: s }))];
  const priors = [{ label: "novel (P&P)", prior: novel }, { label: "play (Hamlet)", prior: play }, { label: "self (Frankenstein — comparison only)", prior: self }];

  const out = {
    schema: "EORhythmTransfer@1",
    declared: { seed: SEED, shuffleDraws: SHUFFLE_DRAWS, summary: "median", assembly: "perceiver-only mention stream — fold/revision tier not exercised" },
    priors: Object.fromEntries(priors.map((p) => [p.label, { medianGap: p.prior.medianGap, gapCount: p.prior.gapCount, quartiles: p.prior.quartiles }])),
    scores: {},
  };
  for (const run of runs) {
    out.scores[run.label] = {};
    for (const p of priors) {
      out.scores[run.label][p.label] = scoreExpectations(run.stream.mentions, p.prior.medianGap);
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });

// eoreader6 · read-audio-voices — THE NETWORK TERRAIN, BUILT FROM TIMBRE
// SIMILARITY DIRECTLY, NOT FROM BINDING'S CO-ARRIVAL LINKS.
//
// read-audio-networked.mjs asked "do audio motifs (findRecurringMotifs,
// blind to modality, the same organ read-level0.js uses for text) co-arrive
// often enough for binding.js to witness a Link between them" — answer,
// measured: no, at any window, because each motif only has 3-8 occurrences
// over a real song, too few for the null-gated tests to clear.
//
// THIS SCRIPT ASKS A DIFFERENT QUESTION: not "do two recurring shapes
// co-arrive" but "which stretches of the recording SOUND like the same
// voice" — a Network-terrain question (SEG·Pattern, communityDetection),
// built directly from TIMBRE similarity rather than from binding's
// arrival-index co-occurrence. Timbre (MFCC-family, AUDIO_FIELD_SPEC's own
// declared "cosine" metric) is the standard acoustic correlate of "who/what
// is making this sound" — voice vs. guitar vs. orchestra section — as
// distinct from chroma (which pitch) or moments (spectral shape moments).
//
// THE CHAIN:
//   perceiver/audio/wav.js::decodeWav        raw bytes -> channelData, sampleRate
//   perceiver/audio/reading.js::buildAudioReading   -> per-frame {chroma,timbre,moments}
//                                             (Reading@1, ~46ms grain, unmodified organ)
//   [this script]                            bin frames into coarser units, average
//                                             timbre per bin, cosine-similarity graph
//   emergence/segment.js::connectedComponents / communityDetection
//                                             the Network terrain, unmodified — same
//                                             two functions read-kinds-networked.mjs
//                                             already validated on text
//
// NOT A NEW STATISTIC: cosine similarity is the metric AUDIO_FIELD_SPEC
// already declares for the timbre channel; connectedComponents/
// communityDetection are unmodified, already-earned SEG-cell organs. The
// only new code is building the similarity graph itself — the same kind of
// composition Amendment XXII made for kind induction, on a different edge
// source.

import { readFileSync } from "node:fs";
import { decodeWav } from "../packages/engine/perceiver/audio/wav.js";
import { buildAudioReading } from "../packages/engine/perceiver/audio/reading.js";
import { connectedComponents, communityDetection } from "../packages/engine/emergence/segment.js";
import { findRecurringMotifs } from "../packages/engine/referents/blind.js";

// No default: see read-audio-networked.mjs's own note — the WAV files this
// was measured against are not committed to this repository, and this
// script does not default to an absolute path outside it (conformance/
// reproducibility.test.js's rule 1). Pass a real WAV path explicitly.
const AUDIO_PATH = process.argv[2];
if (!AUDIO_PATH) throw new Error("usage: node scripts/read-audio-voices.mjs <path-to-wav>");

// Declared, never defaulted.
const BIN_SECONDS = 0.4;        // the reach of the present for a "voice" — a bin shorter
                                 // than a syllable/note would be dominated by attack
                                 // transients rather than timbral character; 400ms matches
                                 // the grain read-audio-networked.mjs/read-kinds-networked.mjs
                                 // already use elsewhere in this session.
// SIMILARITY_THRESHOLD calibrated below, not assumed — same discipline
// read-audio-networked.mjs used for MOTIF_OPTIONS.similarityThreshold.

const bytes = readFileSync(AUDIO_PATH);
console.log(`LOADING ${AUDIO_PATH.split("/").pop()}…`);
const { sampleRate, channelData } = decodeWav(bytes);
console.log(`decoded ${channelData.length} channel(s) at ${sampleRate}Hz, ${(channelData[0].length / sampleRate).toFixed(1)}s`);

const reading = await buildAudioReading({ channelData, sampleRate, sourceBytes: bytes });
console.log(`Reading@1: ${reading.units.length} frames at ~${(reading.perceiver.params.hop / reading.perceiver.params.targetSampleRate * 1000).toFixed(0)}ms/frame (chroma+timbre+moments, unmodified perceiver)\n`);

// ── bin frames into coarser time units, average TIMBRE per bin ─────────────
const framesPerBin = Math.max(1, Math.round(BIN_SECONDS / (reading.perceiver.params.hop / reading.perceiver.params.targetSampleRate)));
const TIMBRE_START = 12, TIMBRE_DIMS = 13; // AUDIO_FIELD_SPEC's own declared layout: chroma[0..12), timbre[12..25), moments[25..30)

const bins = [];
for (let i = 0; i < reading.units.length; i += framesPerBin) {
  const group = reading.units.slice(i, i + framesPerBin);
  if (group.length === 0) continue;
  const timbre = new Array(TIMBRE_DIMS).fill(0);
  const chroma = new Array(12).fill(0);
  for (const u of group) {
    for (let d = 0; d < TIMBRE_DIMS; d++) timbre[d] += u.field[TIMBRE_START + d] / group.length;
    for (let d = 0; d < 12; d++) chroma[d] += u.field[d] / group.length;
  }
  bins.push({ id: `bin:${bins.length}`, from: group[0].pos, to: group[group.length - 1].pos + group[group.length - 1].span, timbre, chroma });
}
console.log(`binned into ${bins.length} units of ~${BIN_SECONDS}s each\n`);

const cosineSim = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

// ── calibrate the similarity threshold, measured not assumed ───────────────
// Same discipline as read-audio-networked.mjs's MOTIF_OPTIONS sweep: report
// how the graph's density and largest-component size move across candidate
// thresholds, and pick the tightest one before the graph degenerates into
// one giant trivial component.
const sims = [];
for (let i = 0; i < bins.length; i++) for (let j = i + 1; j < bins.length; j++) sims.push(cosineSim(bins[i].timbre, bins[j].timbre));
sims.sort((a, b) => a - b);
console.log(`pairwise timbre-similarity distribution: min ${sims[0]?.toFixed(3)}  p50 ${sims[Math.floor(sims.length / 2)]?.toFixed(3)}  p90 ${sims[Math.floor(sims.length * 0.9)]?.toFixed(3)}  max ${sims[sims.length - 1]?.toFixed(3)}`);

const buildGraph = (threshold) => {
  const nodes = new Map(bins.map((b) => [b.id, b]));
  const edges = new Map();
  for (let i = 0; i < bins.length; i++) {
    for (let j = i + 1; j < bins.length; j++) {
      const s = cosineSim(bins[i].timbre, bins[j].timbre);
      if (s >= threshold) edges.set(`${bins[i].id}||${bins[j].id}`, s);
    }
  }
  return { nodes, edges };
};

console.log("\nthreshold sweep (edge count, largest component):");
// Fine-grained near 1.0 first — the first sweep on the Josh White track
// jumped from 62% (0.999) straight to 98% (0.995) with nothing in between
// tried, so a real transition point (if one exists) could be hiding in that
// gap. Swept top to bottom, TIGHTEST first, so the fallback below can prefer
// the tightest candidate rather than silently falling through to the
// loosest — the original version of this script had that fallback backwards
// (`chosen ?? CANDIDATES[CANDIDATES.length - 1]`, the loosest), which is why
// it reported 0.9 — the worst threshold in the sweep — as "chosen" the first
// time this ran, on a track where nothing in the coarse sweep cleared 60%.
const CANDIDATES = [0.9999, 0.9997, 0.9996, 0.9995, 0.9994, 0.9993, 0.9992, 0.9991, 0.999, 0.998, 0.997, 0.996, 0.995, 0.99, 0.98, 0.95, 0.9];
let chosen = null;
// A band, not just an upper bound: the first sweep picked 0.9999 as
// "chosen" because 0 edges / all-singleton components trivially satisfies
// frac < 0.6 (0/436 = 0%) — equally degenerate as one giant blob, just at
// the opposite extreme, and the upper-bound-only check could not tell the
// difference. Real substructure needs the largest component to be BOTH
// under 60% (not one blob) AND over 5% (not noise-isolated) of the bins.
const LOWER = 0.05, UPPER = 0.6;
for (const t of CANDIDATES) {
  const g = buildGraph(t);
  const comps = connectedComponents(g.nodes, g.edges);
  const largest = comps.length ? Math.max(...comps.map((c) => c.length)) : 0;
  const frac = bins.length ? largest / bins.length : 0;
  console.log(`  ${t}  ->  ${g.edges.size} edges, ${comps.length} components, largest ${largest} (${(frac * 100).toFixed(0)}% of bins)`);
  if (!chosen && frac >= LOWER && frac < UPPER) chosen = t; // the FIRST (tightest) threshold in the band
}
const degenerate = chosen === null;
const THRESHOLD = chosen ?? CANDIDATES[0]; // fall back to the TIGHTEST candidate, never the loosest, if nothing cleared 60%
console.log(`\nchosen threshold: ${THRESHOLD}${degenerate ? ` — DEGENERATE: no candidate in the sweep landed the largest component in [${LOWER}, ${UPPER}) of bins; the graph jumps from near-total isolation straight to one dominant cluster with no band of real intermediate substructure. Reported honestly, not hidden by falling back to a threshold that would look cleaner.` : ` (tightest threshold with the largest component in [${LOWER}, ${UPPER}) of bins — not tuned for a particular voice count)`}\n`);

// ── the Network, at the chosen threshold ────────────────────────────────────
const graph = buildGraph(THRESHOLD);
const components = connectedComponents(graph.nodes, graph.edges);
const communityLabels = communityDetection(graph.nodes, graph.edges);
const communityCount = new Set(communityLabels.values()).size;

console.log(`Network: ${graph.nodes.size} nodes, ${graph.edges.size} edges`);
console.log(`Network topology: ${components.length} connected component(s) (sizes: ${components.map((c) => c.length).sort((a, b) => b - a).slice(0, 10).join(", ")}${components.length > 10 ? ", …" : ""})`);
console.log(`Network topology: ${communityCount} communit${communityCount === 1 ? "y" : "ies"} by label propagation\n`);

// ── report each community as a set of time ranges — "this is one voice" ────
const byCommunity = new Map();
for (const b of bins) {
  const label = communityLabels.get(b.id);
  if (!byCommunity.has(label)) byCommunity.set(label, []);
  byCommunity.get(label).push(b);
}
const ranked = [...byCommunity.values()].sort((a, b) => b.length - a.length);
console.log(`voices (communities), largest first:`);
for (const members of ranked.slice(0, 10)) {
  const spans = members.map((m) => `${m.from.toFixed(1)}-${m.to.toFixed(1)}s`);
  console.log(`  ${members.length} bin(s), ${(members.length * BIN_SECONDS).toFixed(1)}s total: ${spans.slice(0, 6).join(", ")}${spans.length > 6 ? `, … +${spans.length - 6} more` : ""}`);
}

// ── SEQUENCE STRUCTURE: not just WHEN a voice is present, but whether its
// presence clusters into contiguous stretches (verse/chorus-shaped) or
// scatters — and, within its own stretches, whether it repeats a melodic
// figure (chroma is pitch-class content; the same modality-blind
// findRecurringMotifs organ read-audio-networked.mjs already used for
// timbre/flux, applied here to one voice's own chroma sub-sequence). ────────
console.log(`\n${"═".repeat(70)}\nSEQUENCE STRUCTURE — what each voice does over time, not only when\n${"═".repeat(70)}`);

const binIndexOf = new Map(bins.map((b, i) => [b.id, i]));
const labelOf = (b) => communityLabels.get(b.id);

// Contiguous runs: consecutive bin indices carrying the SAME label.
const runsOf = (label) => {
  const idxs = bins.map((b, i) => (labelOf(b) === label ? i : null)).filter((i) => i !== null);
  const runs = [];
  let start = null, prev = null;
  for (const i of idxs) {
    if (prev === null || i !== prev + 1) { if (start !== null) runs.push(prev - start + 1); start = i; }
    prev = i;
  }
  if (start !== null) runs.push(prev - start + 1);
  return runs;
};

// Born-null control: is the REAL run-contiguity more clustered than a
// random assignment of the same label counts to bin positions would give,
// by chance? Shuffle (Fisher-Yates, declared seed) the label sequence and
// recompute the same statistic (mean run length) — same shape as every
// other reseeding null in this repo (SEED.md #3/#6): a statistic is only
// informative next to what it looks like on the same material with order
// destroyed.
const RUN_NULL_DRAWS = 200, RUN_NULL_SEED = 20260812;
const prng = (seed) => { let a = (seed | 0) + 0x6d2b79f5; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const shuffledMeanRun = (label, count) => {
  const labels = bins.map((b) => labelOf(b));
  const rnd = prng(RUN_NULL_SEED + count);
  const draws = [];
  for (let d = 0; d < RUN_NULL_DRAWS; d++) {
    const shuffled = labels.slice();
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    let runs = 0, curRun = 0, sumRun = 0;
    for (const l of shuffled) {
      if (l === label) { curRun++; } else { if (curRun > 0) { runs++; sumRun += curRun; } curRun = 0; }
    }
    if (curRun > 0) { runs++; sumRun += curRun; }
    draws.push(runs > 0 ? sumRun / runs : 0);
  }
  draws.sort((a, b) => a - b);
  return draws;
};

for (const members of ranked.slice(0, 5)) {
  const label = labelOf(members[0]);
  const runs = runsOf(label);
  const meanRun = runs.reduce((a, b) => a + b, 0) / runs.length;
  const nullDraws = shuffledMeanRun(label, members.length);
  const nullMean = nullDraws.reduce((a, b) => a + b, 0) / nullDraws.length;
  const rank = nullDraws.filter((v) => v <= meanRun).length / nullDraws.length;
  console.log(`\nvoice (${members.length} bins, ${(members.length * BIN_SECONDS).toFixed(1)}s): ${runs.length} contiguous run(s), mean run length ${meanRun.toFixed(1)} bins (${(meanRun * BIN_SECONDS).toFixed(1)}s)`);
  console.log(`  vs. shuffled-order null: mean run length ${nullMean.toFixed(1)} bins, real value at rank ${rank.toFixed(2)} of the null (${rank >= 0.95 ? "MORE contiguous than chance" : rank <= 0.05 ? "LESS contiguous than chance (scattered)" : "not distinguishable from chance placement"})`);

  // Internal melodic recurrence: this voice's own chroma sequence, in the
  // time order its bins actually occur, tested for recurring shapes — the
  // SAME organ (findRecurringMotifs), a nested/finer application, not a
  // second mechanism.
  const chromaSeq = members
    .map((b) => binIndexOf.get(b.id))
    .sort((a, b) => a - b)
    .map((i) => bins[i]);
  // A scalar series for findRecurringMotifs: chroma's own dominant-pitch-class
  // index per bin (argmax over the 12 chroma dims, already averaged into
  // each bin at binning time above) — collapses the 12-dim vector to one
  // number, the same kind of reduction audio/material.js's reduce() already
  // performs for a different channel.
  const pitchSeries = chromaSeq.map((b) => { let best = 0; for (let k = 1; k < 12; k++) if (b.chroma[k] > b.chroma[best]) best = k; return best; });
  if (pitchSeries.length >= 8 * 4) {
    // referents/blind.js's own declared default (similarityThreshold: 0.3) —
    // not re-tuned for this series. If it degenerates into one dominant
    // cluster the way flux did on the untuned rms channel, that is reported
    // as-is, the same finding, not silently retuned away a second time.
    const { motifs: chromaMotifs } = findRecurringMotifs(pitchSeries, { windowSize: 4, hop: 1, similarityThreshold: 0.3, minOccurrences: 3 });
    console.log(`  internal chroma recurrence (this voice's own melodic sequence): ${chromaMotifs.length} recurring figure(s) found`);
    for (const m of chromaMotifs.slice(0, 3)) console.log(`    figure recurs ${m.count}x at bin-positions [${m.occurrences.slice(0, 8).join(", ")}${m.occurrences.length > 8 ? ", …" : ""}]`);
  } else {
    console.log(`  internal chroma recurrence: too few bins (${pitchSeries.length}) for a recurrence claim`);
  }
}

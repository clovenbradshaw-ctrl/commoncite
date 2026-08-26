// eoreader6 · read-audio-networked — LINK AND NETWORK, TRIED ON AUDIO.
//
// Amendment XXI/XXII wired the Link/Network terrains (emergence/binding.js,
// emergence/segment.js) into a TEXT reading and measured real gains. Both
// organs are modality-blind by construction — they consume only {id,
// arrivals}, never a surface or a word. What text supplies and no other
// modality here has yet is the ENTITY-DISCOVERY stage that produces that
// shape: perceiver/text/surfaces.js + referents/.
//
// referents/blind.js::findRecurringMotifs is NOT text-specific. Its own
// header: "pure self-similarity in raw numeric material, blind to modality,
// blind to identity." It is the same organ loops/read-level0.js already
// calls for text's causal-surprisal series. Composed here with audio's own
// reduce() (perceiver/audio/material.js), it is the missing entity-discovery
// stage for audio — not a new mechanism, the SAME one, on different material.
//
// THE CHAIN, every link an already-earned organ:
//   audio/material.js::reduce        PCM -> numeric series (RMS envelope)
//   referents/blind.js::findRecurringMotifs   series -> motifs (= entities),
//                                     each with .occurrences (= arrivals)
//   emergence/binding.js::readLinks  entities -> Links (3 nulls, direction,
//                                     polarity) — no text, no English, ever
//   emergence/graph.js::readTriples  Links -> the Network
//   emergence/segment.js             the Network -> components, communities
//
// No kind induction here (emergence/kinds.js reads attribute profiles —
// relations/partners/subject_share — that assume a text-shaped being-record;
// composing that onto audio motifs honestly is a further step, not attempted
// in this script). This script asks the narrower, prior question: does the
// Link/Network chain even PRODUCE a non-trivial graph on real audio at all.

import { load, reduce } from "../packages/engine/perceiver/audio/material.js";
import { findRecurringMotifs } from "../packages/engine/referents/blind.js";
import { readLinks, bindingTriples } from "../packages/engine/emergence/binding.js";
import { createGraph, readTriples, strongestEdges } from "../packages/engine/emergence/graph.js";
import { connectedComponents, communityDetection } from "../packages/engine/emergence/segment.js";
import { gammaFor } from "../packages/engine/emergence/tiers.js";

// No default: the WAV files this was actually measured against
// (live_priors' Josh White track, eochat's Frankenstein overture) are not
// committed to this repository, and this script does not default to an
// absolute path outside it (conformance/reproducibility.test.js's rule 1 —
// "an argument-less run must work from a fresh clone"). Pass a real WAV
// path explicitly.
const AUDIO_PATH = process.argv[2];
if (!AUDIO_PATH) throw new Error("usage: node scripts/read-audio-networked.mjs <path-to-wav>");

// Declared, never defaulted (SEED.md's three, plus the organs' own).
const SAMPLE_RATE = 8000;
const FRAME_SAMPLES = 400;     // ~50ms per reduced unit at 8kHz — audio/material.js's own default
const CHANNEL = "flux";        // order-sensitive, not the smooth loudness envelope — see below
// similarityThreshold=0.3 is referents/blind.js's own default, calibrated on TEXT's
// causal-surprisal series. MEASURED here first (not assumed): on this song, both rms
// (0.3) and flux (0.3) produce one degenerate "motif" spanning >55% of all scanned
// positions (987/1819 rms, 1004/1819 flux) — a continuous audio envelope has far more
// generically-similar-shaped windows than text's causal-surprisal series does, so the
// same threshold that separates real recurrence from noise on text does not on audio.
// Swept 0.3/0.2/0.1/0.05/0.02 on flux: the dominant cluster shrinks 1004 -> 267 -> 8 -> 0
// -> 0. 0.1 is the tightest threshold before real motifs disappear entirely, not a value
// chosen to force a particular outcome.
const MOTIF_OPTIONS = { windowSize: 8, hop: 2, similarityThreshold: 0.1, minOccurrences: 3 };
// Swept 4/10/20/40/80/150/300 (0.2s-15s): 0 links witnessed at EVERY window size —
// more candidate pairs get tested as the window widens (6 -> 35), but none clear
// binding.js's three nulls at any scale. Window is not the bottleneck; each motif
// has only 3-8 occurrences over the whole 182s song, which is not enough arrivals
// for the displacement/reversal/reseed nulls to distinguish real co-occurrence from
// chance. 40 (2.0s) kept as a plausible "these two motifs occurred close together"
// interval — not chosen to force a result, since no value in the sweep produced one.
const BINDING_WINDOW = 40;
const BINDING_DRAWS = 199;
const BINDING_SEED = 20260811;

console.log(`LOADING ${AUDIO_PATH.split("/").pop()} at ${SAMPLE_RATE}Hz…`);
const samples = await load(AUDIO_PATH, { sampleRate: SAMPLE_RATE });
console.log(`decoded ${samples.length} samples (${(samples.length / SAMPLE_RATE).toFixed(1)}s)`);

const series = reduce(samples, { frameSamples: FRAME_SAMPLES, channel: CHANNEL });
console.log(`reduced to ${series.length} units (${CHANNEL}, ${FRAME_SAMPLES} samples/unit)\n`);

// ── entity discovery, modality-blind ────────────────────────────────────────
const { motifs, positionsScanned, reason } = findRecurringMotifs(series, MOTIF_OPTIONS);
if (!motifs) {
  console.log(`no motifs: ${reason}`);
  process.exit(0);
}
console.log(`Existence (SIG·Void·Tending): ${motifs.length} recurring motifs found over ${positionsScanned} scanned positions`);
for (const m of motifs.slice(0, 8)) console.log(`  motif ${m.id ?? "?"}: ${m.occurrences.length} occurrences at [${m.occurrences.slice(0, 10).join(", ")}${m.occurrences.length > 10 ? ", …" : ""}]`);
console.log("");

const entities = motifs.map((m, i) => ({ id: `motif:${i}`, arrivals: [...m.occurrences].sort((a, b) => a - b) }))
  .filter((e) => e.arrivals.length >= 2);
console.log(`entities registered for binding: ${entities.length}\n`);

// ── LINK, modality-blind ────────────────────────────────────────────────────
const graph = createGraph({ gamma: gammaFor(12), pruneBelow: 1e-4 });
let links = [], bindingTriplesCount = 0;
if (entities.length >= 2) {
  links = readLinks(entities, { window: BINDING_WINDOW, draws: BINDING_DRAWS, seed: BINDING_SEED, totalUnits: series.length });
  const lt = bindingTriples(links);
  bindingTriplesCount = lt.length;
  if (lt.length > 0) readTriples(graph, lt, { structural: true });
}
const witnessed = links.filter((l) => l.direction !== null);
console.log(`Link (CON·Figure, modality-blind): ${entities.length} entities, ${links.length} pairs tested, ${witnessed.length} witnessed (${bindingTriplesCount} triples -> graph)`);
for (const l of witnessed.slice(0, 8)) {
  const from = l.direction === "a→b" ? l.a.id : l.b.id;
  const to = l.direction === "a→b" ? l.b.id : l.a.id;
  console.log(`  ${from} -> ${to}  polarity=${l.polarity}  strength=${l.strength.toFixed(4)}  disp=${l.nulls.displacement.pValue.toFixed(3)} rev=${l.nulls.reversal.pValue.toFixed(3)} reseed=${l.nulls.reseed.pValue.toFixed(3)}`);
}
console.log(`\nNetwork (graph): ${graph.nodes.size} nodes, ${graph.edges.size} live relations\n`);

if (graph.nodes.size === 0) {
  console.log("Network is empty — nothing witnessed, so component/community detection has nothing to read. Stopping honestly here.");
  process.exit(0);
}

// ── NETWORK ──────────────────────────────────────────────────────────────
const components = connectedComponents(graph.nodes, graph.edges);
const communityLabels = communityDetection(graph.nodes, graph.edges);
const communityCount = new Set(communityLabels.values()).size;
console.log(`Network topology: ${components.length} connected component(s) (sizes: ${components.map((c) => c.length).sort((a, b) => b - a).slice(0, 8).join(", ")}${components.length > 8 ? ", …" : ""})`);
console.log(`Network topology: ${communityCount} communit${communityCount === 1 ? "y" : "ies"} by label propagation\n`);

console.log("strongest relations believed at the end (motif ids):");
for (const e of strongestEdges(graph, 8)) console.log(`  ${e.weight.toFixed(2)}  ${e.edge}`);

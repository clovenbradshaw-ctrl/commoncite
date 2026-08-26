// eoreader6 · sing-book — the self-directed loop on a real book.
//
// A reader is pointed at a corpus. It RECEIVES its first passage, then its own
// search seeks what it just kept, the relevance gate decides what joins it,
// and the run ends when the reader's own memory stops pointing at anything
// new. What the reader kept is then spoken from where it stands — a song,
// stamped imagined, never testimony.
//
// Declared numbers, as the engine demands:
const GAMMA = 0.95; // the reader's forgetting
const PRUNE_BELOW = 1e-4; // the graph forgetting floor
const RESEEDS = 60; // the gate's resolution of pattern
const SEED = 20260801; // the gate's received stream
const ALPHA = 1; // the graph's smoothing reserve
const LIMIT = 10; // the search's nomination budget
const PASSES = 40; // the run's ceiling — the loop ends early at no_candidate
const HORIZON = 12; // the song's extent
const ORDER = 2; // the song's dependence on the lived form
const SELECTION = "mode"; // the song's choice of next form

import { readFileSync } from "node:fs";
import { createSession, admitChunked } from "../packages/host/corpus.js";
import { stripContainer, splitSentences } from "../packages/engine/perceiver/text/spans.js";
import { createSinger, singRun, apertureSeries, sing } from "../packages/host/sing.js";
import { extractSurfaces } from "../packages/engine/perceiver/text/surfaces.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../packages/engine/perceiver/text/material.js";
import { discoverRelationVocab } from "../packages/engine/perceiver/text/relations.js";
import { isGap } from "../nul/index.js";

const DEFAULT_PATH = "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const path = process.argv[2] ?? DEFAULT_PATH;

const session = createSession();
const { text } = stripContainer(readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
const { chunks } = admitChunked(session, { text, sourceId: `source:${path}` });
console.log(`ingested ${chunks} chunks from ${path.split("/").pop()}`);

// The reader's relation vocabulary, measured from this book's own surfaces
// and closed class — never a hand-listed English verb set. See
// perceiver/text/relations.js::discoverRelationVocab.
const table = buildFrequencyTable(tokenize(text));
const functionWords = functionWordSet(table);
const surfaces = extractSurfaces(splitSentences(text), { functionWords });
const { verbs } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 });
console.log(`relation vocabulary: ${verbs.size} verbs measured from the text — never a hand-listed set`);
console.log("");

const singer = createSinger({ session, gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, limit: LIMIT, verbs, functionWords });
const run = singRun(singer, { passes: PASSES });

const ceiling = run.pass >= PASSES ? ` (reached the declared ${PASSES}-pass ceiling)` : "";
console.log(`RUN ${run.ended} after ${run.pass} pass(es)${ceiling} — ${run.preserved} preserved, ${run.refused} refused, ${run.censored} censored, ${run.gaps} silent.`);
console.log(`the reader holds ${run.nodes} referents and ${run.edges} relations.`);
console.log("");
for (const rec of run.records) {
  const act = rec.gap
    ? `gap ${rec.gap}`
    : `${rec.verdict}  (${rec.triples} relation${rec.triples === 1 ? "" : "s"})`;
  const query = rec.query ? ` · sought "${rec.query.slice(0, 60)}"` : " · received";
  console.log(`  p${String(rec.pass).padStart(2)} ${act.padEnd(26)} ${rec.preview}${query}`);
}
console.log("");

const strongest = run.strongest.map((e) => `    ${e.edge} (${e.weight.toFixed(3)})`).join("\n");
console.log(`what the reader now believes most strongly:\n${strongest}`);
console.log("");

// Aperture: the volume of the ground the movements have built — reported, never
// consulted as a gate.
const moods = apertureSeries(run.moves, { window: 6, draws: 16, seed: SEED });
console.log("aperture (volume of the ground so far, per committed pass):");
console.log("  " + moods.map((v) => (v === null ? "." : v.toFixed(3))).join(" "));
console.log("");

// SING — the reading's own material, spoken from where it now stands.
const tokens = [];
const kept = [];
for (const rec of run.records) {
  const sp = singer.session.spans.get(rec.span_id);
  if (rec.verdict === "preserve" && sp) {
    kept.push(sp);
    tokens.push(...String(sp.text).toLowerCase().split(/\W+/).filter(Boolean));
  }
}
if (tokens.length === 0) {
  console.log("the reader preserved nothing — there is no song to sing, and no silence is faked.");
  process.exit(0);
}

const here = tokens.length;
const from = Math.max(0, here - HORIZON);
const song = sing({ tokens, here, from, order: ORDER, alpha: ALPHA, horizon: HORIZON, seed: SEED, selection: SELECTION });
if (isGap(song)) {
  console.log(`the reading refused to sing: ${song.gap} — ${song.reason ?? "no reason given"}.`);
  process.exit(0);
}
console.log(`the reading sings, from ${song.scope.live} live forms over ${song.scope.past} perished, register=${song.register}:`);
console.log("");
console.log("  " + song.emitted.join(" "));
console.log("");
console.log("what it sang of the kept passage it ended on:");
console.log("  " + kept[kept.length - 1].text.trim().replace(/\s+/g, " ").slice(0, 120));

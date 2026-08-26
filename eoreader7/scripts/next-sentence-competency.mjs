// eoreader6 · next-sentence-competency — read 3/4 of a book, then chase the
// real next sentence.
//
// Usage: node scripts/next-sentence-competency.mjs [read-text]
//
// Sibling of scripts/generation-competency.mjs, and it exists because that
// script only ever drove walkForwardSequence. walkSentenceCompletions has
// been sitting in packages/engine/generation/tasks.js since it was written,
// covered by one conformance test and consumed by nothing — unwired, and
// SEED.md's growth rule calls that failing, not early. This wires it.
//
// The task it measures is different from finish-a-sentence.mjs's. That script
// hands over the first PREFIX forms of the real next sentence and asks for
// the rest — teacher-forced up to the cut. This asks for the WHOLE next
// sentence from nothing but everything read so far (prefix = 0), which is
// the harder and more honest version of "what does the reader think comes
// next": free-running from the first form, so a wrong opening compounds
// exactly the way SEED.md's free-running clause says it must.
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const GAMMA = 0.99995; // decayed-belief's fading rate — same value RESULTS.md already earned on Frankenstein
const PREFIX = 0; // no forms handed over: the whole sentence is imagined
const HORIZON = 20; // forms withheld and scored; sentences longer than this are truncated, not dropped
// DECLARED, not a convenience. Scoring every sentence in the last quarter is
// ~1,000 draws x 6 emitters x 20 free-running steps, each materialising a
// vocabulary-sized distribution, and it does not finish. Taking every Nth
// sentence is a statement about which draws were scored, and a reader of the
// numbers has to be told it rather than infer it from a runtime.
const SENTENCE_STRIDE = 7;
const READ_UP_TO = 0.75; // fraction of the book read before the reader is ever asked what comes next
const SEED = 20260731;
const WINDOW = 6; // atmosphere: the reach of the present
const DRAWS = 96; // atmosphere: the resolution of testimony
const TOLERANCE = 2; // atmosphere: the resolution of refusal
const SELECTION = "sampled"; // a mode reader cycles; a sampled one shows the belief

import { readFileSync, existsSync } from "node:fs";
import { createGenerationTask, walkSentenceCompletions } from "../packages/engine/generation/tasks.js";
import { defaultGenerationBaselines } from "../packages/engine/generation/baselines.js";
import { decayedBelief, regimeBelief } from "../packages/engine/generation/candidates.js";
import { runGeneration } from "../packages/engine/generation/run.js";
import { emitSequence, admissibleAsTestimony } from "../packages/engine/generation/emit.js";
import { stripContainer, splitSentences } from "../packages/engine/perceiver/text/spans.js";
import { isGap } from "../nul/index.js";

const READ = process.argv[2] ?? "scripts/corpus/pg84.txt";
const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const tok = (t) => (t.toLowerCase().match(WORD) ?? []);
const say = (fs) => fs.filter((f) => f !== null).join(" ").replace(/ ([.,;:!?])/g, "$1").replace(/ ?— ?/g, " — ");

if (!existsSync(READ)) {
  console.error(`no text at ${READ}`);
  process.exit(1);
}

const raw = readFileSync(READ, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const text = stripContainer(raw).text;

// Sentences as token arrays, and `tokens` is their concatenation — not a
// second tokenisation of the whole text. walkSentenceCompletions tracks
// position by summing `sentences[i].length`, so the flat stream fed to
// runGeneration must be built the same way or the two would drift apart on
// any edge case where per-sentence and whole-text tokenisation disagree.
const sentences = splitSentences(text).map((s) => tok(s.text)).filter((s) => s.length > 0);
const tokens = sentences.flat();

let cum = 0;
let warmupSentences = 0;
const cutForms = Math.floor(tokens.length * READ_UP_TO);
for (; warmupSentences < sentences.length && cum < cutForms; warmupSentences++) cum += sentences[warmupSentences].length;

console.log(`\nread      ${READ}`);
console.log(`forms     ${tokens.length.toLocaleString()} across ${sentences.length.toLocaleString()} sentences`);
console.log(`warmup    ${warmupSentences.toLocaleString()} sentences (${cum.toLocaleString()} forms, ${((cum / tokens.length) * 100).toFixed(1)}% of the book)`);
console.log(`declared  order=${ORDER} alpha=${ALPHA} gamma=${GAMMA} prefix=${PREFIX} horizon=${HORIZON} selection=${SELECTION} seed=${SEED}\n`);

const baselines = defaultGenerationBaselines({ order: ORDER, alpha: ALPHA, horizon: HORIZON });
const candidates = [
  decayedBelief({ order: ORDER, alpha: ALPHA, gamma: GAMMA }),
  regimeBelief({ order: ORDER, alpha: ALPHA, window: WINDOW, draws: DRAWS, tolerance: TOLERANCE, seed: SEED }),
];

const task = createGenerationTask({
  target_type: "token-sequence",
  horizon: HORIZON,
  conditioning: "free-running",
  selection: SELECTION,
  scoring_rule: "sequence-log-loss",
  baseline_ids: baselines.map((b) => b.id),
  prior_ids: [],
  population: `${READ}, sentence ${warmupSentences}..${sentences.length}`,
  provenance: [READ],
});

const started = process.hrtime.bigint();
const out = runGeneration({
  tokens,
  draws: (function* () {
    let i = 0;
    for (const d of walkSentenceCompletions(sentences, { warmupSentences, prefix: PREFIX, horizon: HORIZON }))
      if (i++ % SENTENCE_STRIDE === 0) yield d;
  })(),
  candidates,
  baselines,
  task,
  primeUpTo: cum,
  population: task.population,
  source_versions: [`${READ}@${tokens.length}`],
  seed: SEED,
});
const secs = Number(process.hrtime.bigint() - started) / 1e9;

console.log(`task      ${task.id}`);
console.log(`scored    ${out.scored} sentences, skipped ${out.skipped} ${JSON.stringify(out.skipReasons)} in ${secs.toFixed(1)}s\n`);

const ids = [...out.records.keys()];
const width = Math.max(...ids.map((i) => i.length));
console.log("competency gain (baseline cumulative loss − candidate cumulative loss; positive = better)\n");
const cols = baselines.map((b) => b.id.replace("baseline:", ""));
console.log(`${"".padEnd(width)}  ${cols.map((c) => c.padStart(14)).join("")}   beats all`);
for (const id of ids) {
  const r = out.records.get(id);
  const cells = baselines.map((b) => {
    if (b.id === id) return "—".padStart(14);
    const g = r.competency_gain[b.id];
    return (g === undefined ? "—" : g.toFixed(0)).padStart(14);
  });
  console.log(`${id.padEnd(width)}  ${cells.join("")}   ${r.beats_all_baselines ? "yes" : "no"}`);
}

console.log(`\ncumulative loss (nats over ${out.scored} sentences, ${out.scored > 0 ? "avg " + (out.records.get(ids[0]).cumulative_loss / out.scored).toFixed(1) + " nats/sentence for the first row" : ""})\n`);
for (const id of ids) {
  const r = out.records.get(id);
  console.log(`  ${id.padEnd(width)}  ${r.cumulative_loss.toFixed(0).padStart(10)}`);
}

console.log(`\nat the crossing — how many imagined sentences could be asserted about this text\n`);
for (const id of ids) {
  const t = out.testimony[id];
  if (!t) continue;
  console.log(`  ${id.padEnd(width)}  admissible ${String(t.grounded).padStart(4)}   refused ${String(t.borrowed).padStart(4)}`);
}

console.log(`\nstates\n`);
for (const [id, s] of Object.entries(out.states)) console.log(`  ${id.padEnd(width)}  ${JSON.stringify(s)}`);

// A handful of examples, read the way finish-a-sentence.mjs reads them: the
// belief's OWN sampled continuation against what the book actually says next,
// drawn evenly from the scored range so they are not all clustered at the end.
console.log(`\n${"═".repeat(78)}\nexamples — decayed-belief's sampled guess vs the real next sentence\n`);
const evalSentences = sentences.slice(warmupSentences).filter((s) => s.length >= 1);
const belief = decayedBelief({ order: ORDER, alpha: ALPHA, gamma: GAMMA });
belief.prime(tokens.slice(0, cum));
let seenForms = cum;
const HOW_MANY = 6;
const stepEvery = Math.max(1, Math.floor(evalSentences.length / HOW_MANY));
for (let i = 0; i < evalSentences.length; i++) {
  const sentence = evalSentences[i];
  if (i % stepEvery === 0) {
    const out = emitSequence({
      belief: belief.belief,
      context: tokens.slice(0, seenForms),
      horizon: Math.min(HORIZON, sentence.length),
      conditioning: "free-running",
      selection: "sampled",
      seed: SEED + seenForms,
    });
    const truth = sentence.slice(0, Math.min(HORIZON, sentence.length));
    console.log(`at form ${seenForms.toLocaleString()} (${((seenForms / tokens.length) * 100).toFixed(1)}%)`);
    if (isGap(out)) {
      console.log(`  [refused: ${out.gap}]`);
    } else {
      const crossing = admissibleAsTestimony(out);
      console.log(`  imagined  ${say(out.emitted)}`);
      console.log(`  real      ${say(truth)}${sentence.length > HORIZON ? " …" : ""}`);
      console.log(`  as testimony: ${crossing === null ? "admissible" : "refused (" + crossing.gap + ")"}\n`);
    }
  }
  belief.observe(sentence);
  seenForms += sentence.length;
}
console.log("═".repeat(78));

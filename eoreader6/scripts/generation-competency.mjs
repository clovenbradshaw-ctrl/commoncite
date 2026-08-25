// eoreader6 · generation-competency — does any of it actually help?
//
// Usage: node scripts/generation-competency.mjs [read-text]
//
// `scripts/imagine.mjs` shows what the reader says. This says whether saying it
// is worth anything, which is a different question and the only one that can
// be answered with a number. Fluent output is enormously persuasive and is not
// a result.
//
// Every candidate is a MINIMAL CONTRAST with baseline:markov-K — same
// estimator, same order, same smoothing, differing in exactly one respect —
// so a gain is attributable to one thing:
//
//   candidate:decayed-belief-g*     differs only by gamma < 1  (the fading)
//   candidate:prior-augmented-3     differs only by the gifts   (other books)
//   candidate:regime-belief         differs only by the resets  (atmosphere)
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const GAMMA = 0.99995;
const HORIZON = 6;
const STRIDE = 240; // >> horizon, so no two scored draws overlap
const WARMUP = 20000; // forms read before the first guess is asked for
const PRIOR_CAP = 60000;
const SEED = 20260731;
const WINDOW = 6; // atmosphere: the reach of the present
const DRAWS = 96; // atmosphere: the resolution of testimony
const TOLERANCE = 2; // atmosphere: the resolution of refusal
const CONDITIONING = "free-running";
const SELECTION = "mode"; // deterministic: a competency run is not a demo

import { readFileSync, existsSync } from "node:fs";
import { createGenerationTask, walkForwardSequence } from "../packages/engine/generation/tasks.js";
import { defaultGenerationBaselines } from "../packages/engine/generation/baselines.js";
import { decayedBelief, priorAugmented, regimeBelief, decayedRegimeBelief } from "../packages/engine/generation/candidates.js";
import { runGeneration } from "../packages/engine/generation/run.js";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";

const READ = process.argv[2] ?? "scripts/corpus/pg84.txt";
const PRIORS = [
  { path: "scripts/corpus/pg345.txt", id: "dracula", giver: "Bram Stoker, Dracula (PG 345)" },
  { path: "scripts/corpus/pg1260.txt", id: "jane-eyre", giver: "Charlotte Brontë, Jane Eyre (PG 1260)" },
  { path: "scripts/corpus/pg2701.txt", id: "moby-dick", giver: "Herman Melville, Moby-Dick (PG 2701)" },
];

const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const load = (p) => {
  const raw = readFileSync(p, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return (stripContainer(raw).text.toLowerCase().match(WORD) ?? []);
};

if (!existsSync(READ)) {
  console.error(`no text at ${READ}`);
  process.exit(1);
}

const tokens = load(READ);
const priors = PRIORS.filter((p) => existsSync(p.path)).map((p) => ({ ...p, tokens: load(p.path).slice(0, PRIOR_CAP) }));

console.log(`\nread      ${READ} — ${tokens.length.toLocaleString()} forms`);
for (const p of priors) console.log(`gift      ${p.id.padEnd(12)} ${p.tokens.length.toLocaleString()} forms — ${p.giver}`);
console.log(
  `declared  order=${ORDER} alpha=${ALPHA} gamma=${GAMMA} horizon=${HORIZON} stride=${STRIDE} warmup=${WARMUP.toLocaleString()} conditioning=${CONDITIONING} selection=${SELECTION}\n`,
);

const baselines = defaultGenerationBaselines({ order: ORDER, alpha: ALPHA, horizon: HORIZON });
const candidates = [
  decayedBelief({ order: ORDER, alpha: ALPHA, gamma: GAMMA }),
  regimeBelief({ order: ORDER, alpha: ALPHA, window: WINDOW, draws: DRAWS, tolerance: TOLERANCE, seed: SEED }),
  // Experimental: fading AND resets at once — see the doc comment on
  // decayedRegimeBelief in generation/candidates.js. Not a minimal contrast;
  // read against the two isolated candidates above.
  decayedRegimeBelief({ order: ORDER, alpha: ALPHA, gamma: GAMMA, window: WINDOW, draws: DRAWS, tolerance: TOLERANCE, seed: SEED }),
];
if (priors.length) candidates.push(priorAugmented({ order: ORDER, alpha: ALPHA, priors }));

const task = createGenerationTask({
  target_type: "token-sequence",
  horizon: HORIZON,
  conditioning: CONDITIONING,
  selection: SELECTION,
  scoring_rule: "sequence-log-loss",
  baseline_ids: baselines.map((b) => b.id),
  prior_ids: priors.map((p) => ({ id: p.id, giver: p.giver })),
  population: `${READ}, forms ${WARMUP}..${tokens.length}`,
  provenance: [READ, ...priors.map((p) => p.path)],
});

const started = process.hrtime.bigint();
const out = runGeneration({
  tokens,
  draws: walkForwardSequence(tokens, { warmup: WARMUP, horizon: HORIZON, stride: STRIDE }),
  candidates,
  baselines,
  task,
  primeUpTo: WARMUP,
  population: task.population,
  source_versions: [READ, ...priors.map((p) => `${p.id}@${p.tokens.length}`)],
  seed: SEED,
});
const secs = Number(process.hrtime.bigint() - started) / 1e9;

console.log(`task      ${task.id}`);
console.log(`scored    ${out.scored} draws, skipped ${out.skipped} ${JSON.stringify(out.skipReasons)} in ${secs.toFixed(1)}s\n`);

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

console.log(`\ncumulative loss (nats over ${out.scored} × ${HORIZON} = ${out.scored * HORIZON} withheld forms)\n`);
for (const id of ids) {
  const r = out.records.get(id);
  console.log(`  ${id.padEnd(width)}  ${r.cumulative_loss.toFixed(0).padStart(10)}   per form ${(r.cumulative_loss / (out.scored * HORIZON)).toFixed(3)}`);
}

console.log(`\nat the crossing — how many imaginings could be asserted about this text\n`);
for (const id of ids) {
  const t = out.testimony[id];
  if (!t) continue;
  console.log(
    `  ${id.padEnd(width)}  admissible ${String(t.grounded).padStart(4)}   refused ${String(t.borrowed).padStart(4)}   mean borrowed mass ${(t.mean_received_fraction * 100).toFixed(1)}%`,
  );
}

console.log(`\nstates\n`);
for (const [id, s] of Object.entries(out.states)) console.log(`  ${id.padEnd(width)}  ${JSON.stringify(s)}`);
console.log("");

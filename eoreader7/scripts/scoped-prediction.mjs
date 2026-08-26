// eoreader6 · scoped-prediction — the prequential run that would not finish.
//
// Usage: node scripts/scoped-prediction.mjs [text] [fraction]
//
// A scored, sealed, walk-forward comparison over next-sentence continuations,
// on NET material — the container subtracted before anything is weighed.
//
// ── WHY THIS ONE COMPLETES AND THE EARLIER ONE DID NOT ────────────────────
//
// scripts/next-sentence-competency.mjs seals a materialised distribution per
// step: 20 x (3,523 + 1) = 70,480 probability entries per continuation,
// canonical-hashed once by commitPrediction and again by revealAndScore. The
// seal cost 235ms against 121ms to do the imagining, and the run did not
// finish at any stride worth reporting.
//
// Here the emission carries the LIVE ground written out and the SETTLED ground
// by reference, and the scorer is handed the settled ground at reveal and
// checks its hash. The tamper guarantee is unchanged — a commitment must be
// evident over what the EMITTER CHOSE, and the settled ground is not something
// it chose but something it inherited, which cannot have changed because the
// material behind the fold has perished.
//
// ── THE THING AND ITS CONTAINER ───────────────────────────────────────────
//
// Weighing runs on NET. `stripContainer` removes what it can name, and the
// standpoint's live wave begins at a boundary surf's coordinate division
// declared. Every number below is about the book, not the bag it came in.
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const HORIZON = 12;
const EVERY = 30;   // surf: the extent of a coordinate standpoint, in ride units
const HOP = 4;      // surf: how far the ride advances between standpoints
const WINDOW = 6;   // the reach of the present, in sentences
const DRAWS = 96;   // the resolution of testimony
const SEED = 20260731;
const STRIDE = 5;   // sentences between scored draws — declared, not a runtime
const CONDITIONING = process.env.COND ?? "free-running";
const SELECTION = "mode"; // deterministic: a competency run is not a demo

import { readFileSync, existsSync } from "node:fs";
import { createLayer, createBelief } from "../packages/engine/generation/belief.js";
import { settleGround } from "../packages/engine/generation/settled.js";
import { emitScoped } from "../packages/engine/generation/standpoint.js";
import { emitSequence } from "../packages/engine/generation/emit.js";
import { score } from "../packages/engine/prediction/scoring.js";
import { commitPrediction, revealAndScore } from "../packages/engine/prediction/commitments.js";
import { canonicalHashSync } from "../packages/spec/canonical-json/index.js";
import { surf, divide } from "../packages/engine/loops/surf.js";
import { waveAt } from "../packages/engine/generation/standpoint.js";
import { stripContainer, splitSentences } from "../packages/engine/perceiver/text/spans.js";
import { isGap } from "../nul/index.js";

const TEXT = process.argv[2] ?? "scripts/corpus/pg20781.txt";
const FRACTION = Number(process.argv[3] ?? 0.75);
const W = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const tok = (t) => (t.toLowerCase().match(W) ?? []);
if (!existsSync(TEXT)) { console.error(`no text at ${TEXT}`); process.exit(1); }

const container = stripContainer(readFileSync(TEXT, "utf8").replace(/\r\n/g, "\n"));
if (!container.looks_like_material) { console.error("what survived stripping does not read as material"); process.exit(1); }
const sentences = splitSentences(container.text).map((s) => tok(s.text)).filter((s) => s.length > 0);
const tokens = sentences.flat();
const HERE = Math.floor(tokens.length * FRACTION);

console.log(`\nread      ${TEXT}`);
console.log(`NET       ${tokens.length.toLocaleString()} forms, ${sentences.length.toLocaleString()} sentences — container subtracted at offset ${container.offset.toLocaleString()}`);
if (container.front.length) console.log(`          the book says it is: ${container.front.map((f) => `${f.field}=${f.value}`).slice(0, 3).join(" · ")}`);
console.log(`here      form ${HERE.toLocaleString()} (${(FRACTION * 100).toFixed(0)}%)`);
console.log(`declared  order=${ORDER} alpha=${ALPHA} horizon=${HORIZON} every=${EVERY} hop=${HOP} stride=${STRIDE} conditioning=${CONDITIONING} selection=${SELECTION} seed=${SEED}\n`);

// ── Read to `here`, keeping the per-sentence surprisal surf rides ──────────
const reader = createLayer({ id: "read", tier: "read", order: ORDER, gamma: 1, alpha: ALPHA });
const readBelief = createBelief({ layers: [reader] });
const seen = [];
const series = [];
const sentenceStart = [0];
let si = 0, inS = 0, sSum = 0;
for (let i = 0; i < HERE; i++) {
  const ctx = seen.slice(Math.max(0, seen.length - ORDER));
  const { p, reserve } = readBelief.probabilityOf(ctx, tokens[i]);
  const m = p > 0 ? p : reserve;
  sSum += m > 0 ? -Math.log(m) : -Math.log(Number.MIN_VALUE);
  inS++; seen.push(tokens[i]); reader.observe(seen, seen.length - 1);
  if (inS === sentences[si]?.length) { series.push(sSum / inS); si++; sentenceStart.push(seen.length); inS = 0; sSum = 0; }
}

const ride = surf({ material: series, window: WINDOW, draws: DRAWS, hop: HOP, seed: SEED });
if (isGap(ride)) { console.error(`surf refused: ${ride.gap}`); process.exit(1); }
const waves = divide(ride, { mode: "extent", every: EVERY });
const wave = waveAt([...waves], si);
if (isGap(wave)) { console.error(`no present here: ${wave.gap}`); process.exit(1); }
const FROM = sentenceStart[Math.max(0, Math.min(wave.from, sentenceStart.length - 1))];

const live = createLayer({ id: "live", tier: "read", order: ORDER, gamma: 1, alpha: ALPHA });
live.train(tokens.slice(FROM, HERE));
const pastLayer = createLayer({ id: "perished", tier: "received", world: "this", order: ORDER, gamma: 1, alpha: ALPHA, giver: `this reader, at the standpoint ending at form ${FROM}` });
pastLayer.train(tokens.slice(0, FROM));
const settled = settleGround({ layer: pastLayer, at: FROM, giver: `this reader, at the standpoint ending at form ${FROM}` });
const full = createBelief({ layers: [live, pastLayer] });

console.log(`present   forms ${FROM.toLocaleString()}..${HERE.toLocaleString()} — ${live.vocabularySize.toLocaleString()} distinct of ${settled.vocabulary.toLocaleString()} remembered (${((live.vocabularySize / settled.vocabulary) * 100).toFixed(1)}%)`);
console.log(`settled   ${settled.hash.slice(0, 22)}…\n`);

// ── The prequential walk, sealed and revealed ─────────────────────────────
let scopedLoss = 0, fullLoss = 0, n = 0, reachedBack = 0;
let scopedSealMs = 0, fullSealMs = 0, scopedEntries = 0, fullEntries = 0;

let at = HERE;
let idx = si;
while (idx < sentences.length && n < 200) {
  const target = sentences[idx].slice(0, HORIZON);
  if (target.length === HORIZON) {
    const context = tokens.slice(Math.max(0, at - ORDER), at);

    const eS = emitScoped({ live, settled, context, horizon: HORIZON, selection: SELECTION, seed: SEED + at, order: ORDER, conditioning: CONDITIONING, target });
    const eF = emitSequence({ belief: full, context, horizon: HORIZON, conditioning: CONDITIONING, selection: SELECTION, seed: SEED + at, target });

    if (!isGap(eS) && !isGap(eF)) {
      for (const s of eS.steps) scopedEntries += Object.keys(s.live).length;
      for (const s of eF.steps) fullEntries += Object.keys(s.probs).length;

      let t0 = process.hrtime.bigint();
      const cS = commitPrediction({ task_id: "scoped", candidate_id: "candidate:scoped", candidate_version_hash: settled.hash,
        input_snapshot_hash: canonicalHashSync({ at }), predictive_output: eS, committed_at_step: at, reveal_not_before_step: at + HORIZON });
      scopedSealMs += Number(process.hrtime.bigint() - t0) / 1e6;

      t0 = process.hrtime.bigint();
      const cF = commitPrediction({ task_id: "full", candidate_id: "candidate:full", candidate_version_hash: "v1",
        input_snapshot_hash: canonicalHashSync({ at }), predictive_output: eF, committed_at_step: at, reveal_not_before_step: at + HORIZON });
      fullSealMs += Number(process.hrtime.bigint() - t0) / 1e6;

      // Revealed only at reveal_not_before_step; the seal is verified on the way.
      const rS = revealAndScore({ commitment: cS, observed: [...target], revealed_at_step: at + HORIZON, scoring_rule: "scoped-sequence-log-loss", settled });
      const rF = revealAndScore({ commitment: cF, observed: [...target], revealed_at_step: at + HORIZON, scoring_rule: "sequence-log-loss" });

      if (Number.isFinite(rS.loss) && Number.isFinite(rF.loss)) {
        scopedLoss += rS.loss; fullLoss += rF.loss; reachedBack += rS.reached_back ?? 0; n++;
      }
    }
  }
  for (let k = 0; k < STRIDE && idx < sentences.length; k++) { at += sentences[idx].length; idx++; }
}

console.log(`scored    ${n} sentences x ${HORIZON} withheld forms = ${(n * HORIZON).toLocaleString()} targets\n`);
console.log(`                     cumulative loss    per form    entries sealed    seal time`);
console.log(`  scoped   ${scopedLoss.toFixed(0).padStart(18)}  ${(scopedLoss / (n * HORIZON)).toFixed(3).padStart(10)}  ${scopedEntries.toLocaleString().padStart(16)}  ${scopedSealMs.toFixed(0).padStart(8)}ms`);
console.log(`  full     ${fullLoss.toFixed(0).padStart(18)}  ${(fullLoss / (n * HORIZON)).toFixed(3).padStart(10)}  ${fullEntries.toLocaleString().padStart(16)}  ${fullSealMs.toFixed(0).padStart(8)}ms`);
console.log(`\n  agreement ${Math.abs(scopedLoss - fullLoss) < 1e-6 ? "EXACT — same belief, two representations" : `DIFFER by ${(scopedLoss - fullLoss).toFixed(6)}`}`);
console.log(`  unplaced targets reported by the scorer are counted in the loss at the finite floor`);
console.log(`  the present could not supply the target ${reachedBack} of ${n * HORIZON} times (${((reachedBack / (n * HORIZON)) * 100).toFixed(1)}%)`);
console.log(`  sealing  ${(fullSealMs / Math.max(0.001, scopedSealMs)).toFixed(1)}x cheaper, ${(fullEntries / Math.max(1, scopedEntries)).toFixed(1)}x fewer entries\n`);

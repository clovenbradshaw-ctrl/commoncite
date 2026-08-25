// eoreader6 · slot-mechanism — is the harm in the INVENTORY or in the
// SPENDING?
//
// Usage: node scripts/slot-mechanism.mjs [text] [heldout-start]
//
// scripts/slot-abstraction.mjs produced a result that needs explaining rather
// than only reporting. A DERIVED inventory — forms grouped by identity of
// consequence, which is the grouping a backoff level actually needs — lost to
// the surface chain by 0.89 nats/form, and lost BY MORE THAN ITS OWN NOISE
// FLOOR did (0.48). Classes induced from a stream whose order had been
// destroyed damaged the belief LESS than classes that genuinely captured
// substitutability.
//
// That ordering rules out the obvious reading. If the abstraction were simply
// a weak signal diluting a strong one, a better grouping would dilute less.
// It dilutes MORE. So the suspicion is that the harm is not a property of the
// inventory at all but of the MECHANISM that spends it — an extra backoff
// level whose Witten-Bell confidence rises with how much it pools, taking
// mass from levels that were doing better in proportion to how coherent it
// managed to be.
//
// This script tries to refute that. `classes` is the resolution of the
// grouping and nothing else changes with it: fewer classes means coarser
// pooling means higher counts per abstract context. If harm tracks coarseness
// monotonically, the damage is mechanical. If harm tracks GROUPING QUALITY
// instead — best near whatever resolution the material actually has — then the
// inventory is what matters and the mechanism is exonerated.
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const FEATURES = 400;
const MIN_COUNT = 4;
const ITERATIONS = 12;
const SEED = 20260731;
const HELDOUT = 3000;
const TRAINING = 40000;
const SWEEP = [6, 16, 48, 140, 400]; // the resolution of the grouping, swept

import { readFileSync, existsSync } from "node:fs";
import { createLayer, createBelief } from "../packages/engine/generation/belief.js";
import { induceSlots, shuffleTokens } from "../packages/engine/generation/slots.js";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";

const TEXT = process.argv[2] ?? "scripts/corpus/pg84.txt";
const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
if (!existsSync(TEXT)) {
  console.error(`no text at ${TEXT}`);
  process.exit(1);
}
const tokens =
  stripContainer(readFileSync(TEXT, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n")).text.toLowerCase().match(WORD) ?? [];

const heldoutStart = Number(process.argv[3] ?? Math.floor(tokens.length * 0.75));
const heldout = tokens.slice(heldoutStart, heldoutStart + HELDOUT);
const train = tokens.slice(0, Math.min(TRAINING, heldoutStart));

if (heldout.length < HELDOUT) {
  console.error(`not enough text after ${heldoutStart} for a ${HELDOUT}-form held-out span`);
  process.exit(1);
}

const heldOutLoss = (belief) => {
  let total = 0;
  for (let i = 0; i < heldout.length; i++) {
    const ctx = heldout.slice(Math.max(0, i - ORDER), i);
    const { p, reserve } = belief.probabilityOf(ctx, heldout[i]);
    const mass = p > 0 ? p : reserve;
    total += mass > 0 ? -Math.log(mass) : -Math.log(Number.MIN_VALUE);
  }
  return total / heldout.length;
};

const beliefOver = (abstraction) => {
  const layer = createLayer({ id: "read", tier: "read", order: ORDER, gamma: 1, alpha: ALPHA, abstraction });
  layer.train(train);
  return createBelief({ layers: [layer] });
};

/**
 * How much of the material is actually abstracted, by TOKEN rather than by
 * type.
 *
 * Reported because type coverage is the misleading number here and it is the
 * one the first run printed. abstractions.js records that a NEAR-IDENTITY
 * abstraction is strictly harmful — it adds a level carrying no information
 * the surface already has — and 71% of TYPES standing for themselves sounds
 * like exactly that trap. By token it may be nothing like it, because the
 * types that stand alone are by construction the rare ones. Both numbers, so
 * neither can be read alone.
 *
 * `context_covered` is the share of order-4 contexts in which EVERY form was
 * grouped, which is the quantity that decides whether an abstract context is
 * a genuine generalisation or a copy of the surface key under another name.
 */
const coverage = (abstraction, stream) => {
  let byToken = 0;
  for (const t of stream) if (abstraction.of(t) !== t) byToken++;
  let full = 0;
  let total = 0;
  for (let i = ORDER; i < stream.length; i++) {
    total++;
    let all = true;
    for (let j = i - ORDER; j < i; j++)
      if (abstraction.of(stream[j]) === stream[j]) {
        all = false;
        break;
      }
    if (all) full++;
  }
  return { by_token: byToken / stream.length, context_covered: total > 0 ? full / total : 0 };
};

console.log(`\nread      ${TEXT} — ${tokens.length.toLocaleString()} forms`);
console.log(`train     forms 0..${train.length.toLocaleString()}`);
console.log(`held out  forms ${heldoutStart.toLocaleString()}..${(heldoutStart + HELDOUT).toLocaleString()}`);
console.log(`declared  order=${ORDER} alpha=${ALPHA} features=${FEATURES} minCount=${MIN_COUNT} iterations=${ITERATIONS} seed=${SEED}\n`);

const base = heldOutLoss(beliefOver(null));
console.log(`surface only                                     ${base.toFixed(3)} nats/form\n`);
console.log(`sweeping the resolution of the grouping — coarse (few classes) to fine\n`);
console.log(`  classes   grouped   by-token   ctx-cov   cohesion      loss     delta      shuffled     delta`);

for (const classes of SWEEP) {
  const real = induceSlots({ tokens: train, classes, features: FEATURES, minCount: MIN_COUNT, iterations: ITERATIONS, seed: SEED, label: "slots" });
  const shuf = induceSlots({
    tokens: shuffleTokens(train, SEED),
    classes,
    features: FEATURES,
    minCount: MIN_COUNT,
    iterations: ITERATIONS,
    seed: SEED,
    label: "shuffled",
  });
  if (real.gap || shuf.gap) {
    console.log(`  ${String(classes).padStart(7)}   [refused: ${real.gap || shuf.gap}]`);
    continue;
  }
  const cov = coverage(real, train);
  const lossReal = heldOutLoss(beliefOver(real));
  const lossShuf = heldOutLoss(beliefOver(shuf));
  const dR = base - lossReal;
  const dS = base - lossShuf;
  console.log(
    `  ${String(classes).padStart(7)}   ${String(real.report.grouped).padStart(7)}   ${(cov.by_token * 100).toFixed(1).padStart(7)}%   ${(cov.context_covered * 100).toFixed(1).padStart(6)}%   ${real.report.mean_similarity.toFixed(4).padStart(6)}  ${lossReal.toFixed(3).padStart(8)}  ${((dR >= 0 ? "+" : "") + dR.toFixed(3)).padStart(7)}   ${lossShuf.toFixed(3).padStart(9)}  ${((dS >= 0 ? "+" : "") + dS.toFixed(3)).padStart(7)}`,
  );
}
console.log("");

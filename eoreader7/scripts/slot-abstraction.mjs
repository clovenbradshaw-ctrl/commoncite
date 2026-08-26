// eoreader6 · slot-abstraction — does a DERIVED slot inventory beat the
// surface chain where a RECEIVED lexicon lost?
//
// Usage: node scripts/slot-abstraction.mjs [text] [heldout-start]
//
// Built to be read directly against the UniMorph table in
// packages/engine/generation/RESULTS.md, which is why the shape is identical:
// held-out mean loss in nats per form, order 4, at several training sizes,
// scored on a span the reader has not reached. Same estimator, same alpha,
// same scoring, one thing different — where the abstraction comes from.
//
//   surface only        the control the lemma run lost to
//   + derived slots     forms grouped by identity of consequence (slots.js)
//   + shuffled slots    THE NOISE FLOOR the lemma run never had. Same
//                       induction, same declared numbers, run over a stream
//                       whose ORDER has been destroyed and whose VOCABULARY
//                       is exactly intact. A real grouping that cannot beat
//                       this was grouping by frequency.
//
// LEAKAGE. The inventory is induced from the TRAINING PREFIX ONLY, freshly
// per training size. Inducing once over the whole book would let every
// reported number be computed from classes that had already read the held-out
// span — invisible in the output, and fatal to all of it.
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const CLASSES = 48; // the resolution of the grouping
const FEATURES = 400; // how many context forms a consequence is read over
const MIN_COUNT = 4; // evidence a form needs before it may be grouped at all
const ITERATIONS = 12; // the resolution of the settling
const DRAWS = 32; // the resolution of the verdict — the finest rank sayable is 1/draws
const SEED = 20260731;
const HELDOUT = 3000; // forms scored
const TRAINING_SIZES = [1000, 4000, 16000, 40000];

import { readFileSync, existsSync } from "node:fs";
import { createLayer, createBelief } from "../packages/engine/generation/belief.js";
import { induceSlots, inductionSensitivity, shuffleTokens } from "../packages/engine/generation/slots.js";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";

const TEXT = process.argv[2] ?? "scripts/corpus/pg84.txt";
const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
if (!existsSync(TEXT)) {
  console.error(`no text at ${TEXT}`);
  process.exit(1);
}
const raw = readFileSync(TEXT, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const tokens = stripContainer(raw).text.toLowerCase().match(WORD) ?? [];

const heldoutStart = Number(process.argv[3] ?? Math.max(...TRAINING_SIZES) + 20000);
const heldout = tokens.slice(heldoutStart, heldoutStart + HELDOUT);
if (heldout.length < HELDOUT) {
  console.error(`text has ${tokens.length} forms; not enough after ${heldoutStart} for a ${HELDOUT}-form held-out span`);
  process.exit(1);
}

console.log(`\nread       ${TEXT} — ${tokens.length.toLocaleString()} forms`);
console.log(`held out   forms ${heldoutStart.toLocaleString()}..${(heldoutStart + HELDOUT).toLocaleString()} (never trained on, never induced from)`);
console.log(`declared   order=${ORDER} alpha=${ALPHA} classes=${CLASSES} features=${FEATURES} minCount=${MIN_COUNT} iterations=${ITERATIONS} seed=${SEED}\n`);

/** Mean nats per form over the held-out span, causal within the span. */
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

const beliefOver = (train, abstraction) => {
  const layer = createLayer({ id: "read", tier: "read", order: ORDER, gamma: 1, alpha: ALPHA, abstraction });
  layer.train(train);
  return createBelief({ layers: [layer] });
};

// ── The sensitivity precondition (SEED.md #4, Amendment I) ────────────────
// Established once, on the largest training prefix, before any of the table
// below is worth spending. If destroying order does not move the induction,
// nothing downstream is a finding.
const biggest = tokens.slice(0, Math.max(...TRAINING_SIZES));
const sens = inductionSensitivity({
  tokens: biggest,
  classes: CLASSES,
  features: FEATURES,
  minCount: MIN_COUNT,
  iterations: ITERATIONS,
    draws: DRAWS,
  seed: SEED,
});
if (sens.gap) {
  console.error(`induction refused: ${sens.gap} — ${sens.detail?.reason ?? ""}`);
  process.exit(1);
}
console.log(`sensitivity, on ${biggest.length.toLocaleString()} training forms — what must move is the VERDICT, not the sense organ`);
console.log(`  real      ground confirmed ${(sens.real_confirmed * 100).toFixed(1)}% of nominated pairs   ${sens.real_grouped.toLocaleString()} types placed   (nomination cohesion ${sens.real_cohesion.toFixed(4)})`);
console.log(`  shuffled  ground confirmed ${(sens.shuffled_confirmed * 100).toFixed(1)}% of nominated pairs   ${sens.shuffled_grouped.toLocaleString()} types placed   (nomination cohesion ${sens.shuffled_cohesion.toFixed(4)})\n`);

console.log(`held-out mean loss, nats per form (lower is better)\n`);
console.log(`  training      surface       + slots    delta      + shuffled    delta`);
for (const size of TRAINING_SIZES) {
  const train = tokens.slice(0, size);
  const real = induceSlots({ tokens: train, classes: CLASSES, features: FEATURES, minCount: MIN_COUNT, iterations: ITERATIONS, draws: DRAWS, seed: SEED, label: "slots" });
  const shuf = induceSlots({
    // Order destroyed, vocabulary exactly preserved. Seeded per training size
    // so the two arms differ in the perturbation and in nothing else.
    tokens: shuffleTokens(train, SEED),
    classes: CLASSES,
    features: FEATURES,
    minCount: MIN_COUNT,
    iterations: ITERATIONS,
    draws: DRAWS,
    seed: SEED,
    label: "shuffled",
  });
  if (real.gap || shuf.gap) {
    console.log(`  ${String(size).padStart(8)}      [induction refused: ${(real.gap || shuf.gap)}]`);
    continue;
  }

  const base = heldOutLoss(beliefOver(train, null));
  const withSlots = heldOutLoss(beliefOver(train, real));
  const withShuf = heldOutLoss(beliefOver(train, shuf));
  const d1 = base - withSlots;
  const d2 = base - withShuf;
  console.log(
    `  ${String(size).padStart(8)}  ${base.toFixed(3).padStart(11)}  ${withSlots.toFixed(3).padStart(11)}  ${(d1 >= 0 ? "+" : "") + d1.toFixed(3)}` +
      `  ${withShuf.toFixed(3).padStart(11)}  ${(d2 >= 0 ? "+" : "") + d2.toFixed(3)}`,
  );
}

// ── What the slots actually are ───────────────────────────────────────────
// Printed last and read as evidence, not as a verdict: the classes are
// grouped by consequence, and whether the grouping is legible to a reader of
// English is a separate question from whether it lowers loss.
const shown = induceSlots({
  tokens: tokens.slice(0, Math.max(...TRAINING_SIZES)),
  classes: CLASSES,
  features: FEATURES,
  minCount: MIN_COUNT,
  iterations: ITERATIONS,
    draws: DRAWS,
  seed: SEED,
});
console.log(`\nwhat the slots are — ${shown.report.grouped.toLocaleString()} types in ${shown.report.classes} confirmed classes, ${shown.report.standing_alone.toLocaleString()} standing alone`);
console.log(`nominated ${shown.report.pairs_proposed.toLocaleString()} pairs · confirmed ${shown.report.pairs_confirmed.toLocaleString()} · refused by the null ${shown.report.pairs_refused_by_null.toLocaleString()} · unwitnessable ${shown.report.pairs_unwitnessable.toLocaleString()}\n`);
const sizes = shown.report.class_sizes.map((n, k) => ({ k, n })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
for (const { k, n } of sizes.slice(0, 14)) {
  const members = shown.members(`slots:${k}`);
  console.log(`  slots:${String(k).padEnd(3)} n=${String(n).padStart(4)}  ${members.slice(0, 12).join(" ")}`);
}
console.log("");

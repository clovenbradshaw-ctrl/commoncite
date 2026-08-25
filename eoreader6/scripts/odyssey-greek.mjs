// eoreader6 · odyssey-greek — does the reader get less and less surprised the
// more of the Odyssey it reads, in ancient Greek, and which received priors
// actually help it do that?
//
// Usage: node scripts/odyssey-greek.mjs
//
// This is the audit this whole line of work kept naming and never ran for
// real: SEED.md's own framing of prediction is "carry forward a nothing that
// already says what would NOT surprise you" — so the honest test of "is this
// reader learning" is not a single held-out split, it is whether SUCCESSIVE
// held-out chunks of the SAME poem get cheaper to predict as more of it has
// been read. Homeric verse is an unusually strong case for this: oral-
// formulaic composition is built from repeated epithets, formulae and whole
// half-lines (Milman Parry's finding), which is exactly the kind of structure
// a statistical reader should be able to exploit — so if this mechanism works
// at all, it should show up clearly here.
//
// AND: this is real production code, not a reimplemented model, for both
// halves of the question:
//
//   THE LEARNING CURVE — a plain read-only belief (`createLayer`+`createBelief`,
//   one layer, no gifts), scored causally against successive held-out chunks
//   as it reads more.
//
//   WHICH PRIORS HELP — the SAME Odyssey stream, fed in lockstep through
//   `packages/engine/generation/candidates.js`'s `priorAugmented`, the actual
//   mixture-of-experts belief this codebase ships, against THREE received
//   priors, each naming its giver (SEED.md #1):
//
//     the Iliad          same author, same artificial epic dialect, same
//                         formulaic system — the strongest prior on offer.
//     the Homeric Hymns   same dialect and formulaic tradition, different
//                         (anonymous) authorship, much shorter.
//     the Greek New Testament (Gospels + Acts, Koine)
//                         same broad language, different dialect, register,
//                         era and genre — the weakest-expected prior, so the
//                         comparison has a real gradient, not one prior alone.
//     + the shuffled noise floor `priorAugmented` adds automatically — same
//       vocabulary as the Iliad, order destroyed.
//
// THE TWO ARE DELIBERATELY KEPT SEPARATE, and this is a correction on record:
// a first version of this script scored held-out loss through the GIFT-
// AUGMENTED belief's own `probabilityOf`, which calls `layer.successors(ctx)`
// on every received layer to build the admissible-mass renormalisation —
// O(vocabulary) per gift per scored token, by design (`belief.js`'s own
// comment: "the price of the gate, paid here and not hidden"). Fine for
// answering "how much mass did each gift place," ruinous for scoring 89,000
// held-out tokens: the run did not finish in five minutes. `witnessForm` —
// what `observe()` actually calls per token to update relevance — only ever
// calls `layer.massOf(ctx, form)`, O(order), cheap. So the learning curve
// is measured on a plain belief with no gifts and no admits-gate at all,
// and "which priors help" is read entirely off `relevanceReport()`, which
// the cheap `observe()` pass already keeps current. Same material, same
// order, two different questions, two right-sized instruments.
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const GAMMA = 1; // no fading — this run measures pure accumulation, not memory decay
const RHO = 0.999; // relevance's forgetting rate, declared because >1 prior is in play
const CHECKPOINT = 2000; // forms read per step before the next held-out chunk is scored
const SEED = 20260731;

import { readFileSync } from "node:fs";
import { createLayer, createBelief } from "../packages/engine/generation/belief.js";
import { priorAugmented } from "../packages/engine/generation/candidates.js";

const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const tokenize = (path) => readFileSync(path, "utf8").toLowerCase().match(WORD) ?? [];

const odyssey = tokenize("scripts/corpus/greek/odyssey-grc.txt");
const iliad = tokenize("scripts/corpus/greek/iliad-grc.txt");
const hymns = tokenize("scripts/corpus/greek/homeric-hymns-grc.txt");
const nt = tokenize("scripts/corpus/greek/nt-koine-grc.txt");

console.log(`declared   order=${ORDER} alpha=${ALPHA} gamma=${GAMMA} rho=${RHO} checkpoint=${CHECKPOINT} seed=${SEED}`);
console.log(`Odyssey: ${odyssey.length.toLocaleString()} forms (read text)`);
console.log(`Iliad: ${iliad.length.toLocaleString()} forms, Homeric Hymns: ${hymns.length.toLocaleString()}, Greek NT (Gospels+Acts): ${nt.length.toLocaleString()} (received priors)\n`);

const priors = [
  { id: "iliad", giver: "Homer, Iliad (Perseus Digital Library, canonical-greekLit tlg0012.tlg001, Allen's text)", tokens: iliad },
  { id: "homeric-hymns", giver: "Homeric Hymns (Perseus Digital Library, canonical-greekLit tlg0013, various editors)", tokens: hymns },
  { id: "nt-koine", giver: "Greek New Testament, Matthew/Mark/Luke/John/Acts (SBLGNT via morphgnt/sblgnt)", tokens: nt },
];

/** per-token -log(p or reserve), O(order) — no gifts, no admits-gate, cheap. */
const heldOutLoss = (belief, before, chunk) => {
  let total = 0;
  let ctx = before.slice(-belief.maxOrder);
  for (let i = 0; i < chunk.length; i++) {
    const { p, reserve } = belief.probabilityOf(ctx, chunk[i]);
    const mass = p > 0 ? p : reserve;
    total += mass > 0 ? -Math.log(mass) : -Math.log(Number.MIN_VALUE);
    ctx = ctx.length >= belief.maxOrder ? [...ctx.slice(1), chunk[i]] : [...ctx, chunk[i]];
  }
  return total / chunk.length;
};

/** feed `tokens` through a read layer one at a time, the same incremental API asEmitter uses. */
const trainOn = (layer, seen, tokens) => {
  for (const t of tokens) {
    seen.push(t);
    layer.observe(seen, seen.length - 1);
  }
};

// ── the learning curve: does prediction get smarter the more it reads? ────
// a PLAIN read-only belief, no gifts, no admits-gate — this question has
// nothing to do with priors and does not need to pay for them.
const readLayer = createLayer({ id: "read", tier: "read", order: ORDER, gamma: GAMMA, alpha: ALPHA });
const readBelief = createBelief({ layers: [readLayer] });

// ── which priors help: the real mixture-of-experts belief, fed the SAME
// stream in lockstep, read only through the cheap witnessForm/relevance path.
const emitter = priorAugmented({ order: ORDER, alpha: ALPHA, gamma: GAMMA, rho: RHO, priors, noiseFloor: true, seed: SEED });

console.log(`forms read   held-out loss on NEXT ${CHECKPOINT}   iliad share   hymns share   nt share   shuffled floor   iliad above floor?`);
let seenForRead = [];
const curve = [];
for (let start = 0; start + CHECKPOINT * 2 <= odyssey.length; start += CHECKPOINT) {
  const upcoming = odyssey.slice(start, start + CHECKPOINT);

  // score the UPCOMING chunk before either belief has observed it — genuinely held out
  const loss = heldOutLoss(readBelief, seenForRead, upcoming);
  const relevance = start > 0 ? emitter.belief.relevanceReport() : null;
  const shareOf = (id) => relevance?.layers.find((l) => l.id === id)?.share ?? null;
  const floor = relevance?.noise_floor ?? null;
  const aboveFloor = relevance?.layers.find((l) => l.id === "iliad")?.above_noise ?? null;

  curve.push({ readSoFar: seenForRead.length, loss, iliadShare: shareOf("iliad"), hymnsShare: shareOf("homeric-hymns"), ntShare: shareOf("nt-koine"), floor });
  console.log(
    `${String(seenForRead.length).padStart(9)}   ${loss.toFixed(3).padStart(9)}` +
      `                     ${shareOf("iliad") !== null ? (shareOf("iliad") * 100).toFixed(1).padStart(5) + "%" : "   n/a"}` +
      `        ${shareOf("homeric-hymns") !== null ? (shareOf("homeric-hymns") * 100).toFixed(1).padStart(5) + "%" : "   n/a"}` +
      `      ${shareOf("nt-koine") !== null ? (shareOf("nt-koine") * 100).toFixed(1).padStart(5) + "%" : "   n/a"}` +
      `      ${floor !== null ? (floor * 100).toFixed(1).padStart(5) + "%" : "   n/a"}` +
      `           ${aboveFloor === null ? "-" : aboveFloor ? "YES" : "no"}`,
  );

  // NOW train both, causally: read-only belief for the curve, the gift-augmented
  // one for relevance (its `observe` witnesses every gift via the cheap massOf
  // path, then trains its own read layer the same way).
  trainOn(readLayer, seenForRead, upcoming);
  emitter.observe(upcoming);
}

// ── the learning curve, summarised ──────────────────────────────────────
const early = curve.slice(0, Math.floor(curve.length / 4));
const late = curve.slice(-Math.floor(curve.length / 4));
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log(`\n── does prediction get smarter the more it reads? ──`);
console.log(`mean held-out loss, first quarter of checkpoints (${early.length} checkpoints, up to ${early[early.length - 1]?.readSoFar ?? 0} forms read): ${meanOf(early.map((c) => c.loss)).toFixed(3)} nats/form`);
console.log(`mean held-out loss, last quarter of checkpoints  (${late.length} checkpoints, from ${late[0]?.readSoFar ?? 0} forms read):      ${meanOf(late.map((c) => c.loss)).toFixed(3)} nats/form`);

// ── a control: does a SHUFFLED Odyssey (order destroyed, vocabulary intact)
// show the same downward trend? If yes, the improvement above is coverage —
// the reader simply meeting more of the vocabulary — not learning ORDER.
const shuffleTokens = (tokens, seed) => {
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const out = [...tokens];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
const shuffledOdyssey = shuffleTokens(odyssey, SEED);
const controlLayer = createLayer({ id: "read", tier: "read", order: ORDER, gamma: GAMMA, alpha: ALPHA });
const controlBelief = createBelief({ layers: [controlLayer] });
let seenForControl = [];
const controlCurve = [];
for (let start = 0; start + CHECKPOINT * 2 <= shuffledOdyssey.length; start += CHECKPOINT) {
  const upcoming = shuffledOdyssey.slice(start, start + CHECKPOINT);
  controlCurve.push(heldOutLoss(controlBelief, seenForControl, upcoming));
  trainOn(controlLayer, seenForControl, upcoming);
}
const controlEarly = meanOf(controlCurve.slice(0, Math.floor(controlCurve.length / 4)));
const controlLate = meanOf(controlCurve.slice(-Math.floor(controlCurve.length / 4)));
console.log(`\nSHUFFLED control (order destroyed, same vocabulary):`);
console.log(`  first quarter: ${controlEarly.toFixed(3)} nats/form   last quarter: ${controlLate.toFixed(3)} nats/form`);
console.log(`\nreal Odyssey improvement:     ${(meanOf(early.map((c) => c.loss)) - meanOf(late.map((c) => c.loss))).toFixed(3)} nats/form`);
console.log(`shuffled-control improvement: ${(controlEarly - controlLate).toFixed(3)} nats/form`);
console.log(`the real improvement is only a finding about ORDER if it clearly exceeds the shuffled control's — the control still improves from pure vocabulary coverage growing, and that part doesn't count.`);

// ── final relevance verdict ─────────────────────────────────────────────
const finalRelevance = emitter.belief.relevanceReport();
console.log(`\n── final relevance report, after reading ${seenForRead.length.toLocaleString()} forms of the Odyssey ──`);
for (const l of finalRelevance.layers) {
  console.log(`  ${l.id.padEnd(14)} giver: ${l.giver.slice(0, 60)}${l.giver.length > 60 ? "…" : ""}`);
  console.log(`  ${" ".repeat(14)} share: ${(l.share * 100).toFixed(1)}%   above noise floor: ${l.above_noise === null ? "n/a" : l.above_noise ? "YES" : "no"}`);
}

// eoreader6 · predictor-atmosphere — does a PREDICTOR's own competency stream,
// run through the SAME ground/pattern machinery loops/turn.js already uses on
// content, produce a real correction signal at a genuine regime change while
// staying quiet on a homogeneous one?
//
// Usage: node scripts/predictor-atmosphere.mjs
//
// This is the prerequisite check, not the whole design. Before any hyperparameter
// -reshaping mechanism is worth building on top of it, the loss stream itself has
// to clear the exact trap `pattern()`'s own history already caught once: a null
// built the wrong way turns "moved" into a coin landing true about 1/(reseeds+1)
// of the time regardless of the material (nul/index.js:836-838, scripts/RESULTS.md
// "What the null had to be corrected to"). So this script does NOT reinvent that
// null. It imports `ground`/`pattern`/`continueBy`'s public surface from nul/index.js
// directly and points them at a predictor's per-form loss series instead of text —
// exactly the substitution proposed in conversation: "tier-0 emits per-form loss
// under whichever predictor currently reigns. That loss stream — not the text —
// becomes the material a predictor-Atmosphere reads."
//
// TWO STREAMS, ONE PREDICTOR, TRAINED ON PROSE ONLY:
//   control   held-out PROSE only — a homogeneous regime. A correct design should
//             report FEW OR NO moved events, the same "no clock on homogeneous
//             noise" check turn.js's own fix was measured against.
//   splice    held-out PROSE, then the Project Gutenberg license CHROME appended —
//             a genuine regime change (the chrome-vs-prose result already on record:
//             a predictor trained on prose is worse on license text than a naive
//             one, in the same file). A correct design should report a moved event
//             LOCATED NEAR the real splice, not scattered.
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER = 4;
const ALPHA = 0.7;
const TRAIN_SIZE = 30000;
const HELDOUT_GAP = 15000;
const HELDOUT_SPAN = 4000; // forms of held-out prose scored per stream
const LOSS_WINDOW = 40; // ground()'s `window` — the reach of the present, over LOSS observations, not text
const DRAWS = 32;
const RESEEDS = 16;
const STEP = 150; // how far the before/after boundary advances between checks
const SEED = 20260731;

import { readFileSync } from "node:fs";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { ground, pattern } from "../nul/index.js";

const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const tokenize = (raw) => stripContainer(raw).text.toLowerCase().match(WORD) ?? [];

const raw = readFileSync("scripts/corpus/pg84.txt", "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const startMark = "*** START OF THE PROJECT GUTENBERG EBOOK";
const endMark = "*** END OF THE PROJECT GUTENBERG EBOOK";
const startIdx = raw.indexOf(startMark);
const endIdx = raw.indexOf(endMark);
if (startIdx < 0 || endIdx < 0) { console.error("could not find PG boilerplate markers"); process.exit(1); }
const proseRaw = raw.slice(startIdx + startMark.length, endIdx);
const chromeRaw = raw.slice(endIdx); // the closing license block — pure chrome, never seen in training

const prose = tokenize(proseRaw);
// stripContainer's whole job is to REMOVE exactly this text (it's the Gutenberg
// boilerplate stripper), so tokenize it directly rather than through the same
// pipeline that would delete it.
const chrome = chromeRaw.toLowerCase().match(WORD) ?? [];
console.log(`prose: ${prose.length.toLocaleString()} forms   chrome (closing license): ${chrome.length.toLocaleString()} forms`);

// ── the same minimal Witten-Bell predictor as predictor-scientist.mjs ─────
const CTX_SEP = "";
class Candidate {
  constructor({ order, alpha }) { this.order = order; this.alpha = alpha; this.tables = Array.from({ length: order + 1 }, () => new Map()); }
  train(tokens) {
    for (let i = 0; i < tokens.length; i++)
      for (let j = 0; j <= this.order; j++) {
        if (i - j < 0) break;
        const key = j === 0 ? "" : tokens.slice(i - j, i).join(CTX_SEP);
        let entry = this.tables[j].get(key);
        if (!entry) { entry = { succ: new Map(), total: 0 }; this.tables[j].set(key, entry); }
        entry.succ.set(tokens[i], (entry.succ.get(tokens[i]) ?? 0) + 1);
        entry.total++;
      }
    return this;
  }
  massOf(ctx, form) {
    let mass = 0, remaining = 1;
    const reach = Math.min(this.order, ctx.length);
    for (let j = reach; j >= 1; j--) {
      const key = ctx.slice(ctx.length - j).join(CTX_SEP);
      const entry = this.tables[j].get(key);
      if (!entry || !(entry.total > 0)) continue;
      const share = remaining * (entry.total / (entry.total + this.alpha));
      const c = entry.succ.get(form);
      if (c) mass += (share * c) / entry.total;
      remaining -= share;
      if (remaining <= 0) return { mass, reserve: 0 };
    }
    const entry0 = this.tables[0].get("");
    if (entry0 && entry0.total > 0) {
      const share = remaining * (entry0.total / (entry0.total + this.alpha));
      const c = entry0.succ.get(form);
      if (c) mass += (share * c) / entry0.total;
      remaining -= share;
    }
    return { mass, reserve: Math.max(0, remaining) };
  }
}

if (prose.length < TRAIN_SIZE + HELDOUT_GAP + 2 * HELDOUT_SPAN) { console.error("not enough prose for the declared windows"); process.exit(1); }
const reigning = new Candidate({ order: ORDER, alpha: ALPHA }).train(prose.slice(0, TRAIN_SIZE));

/** per-form -log(mass or reserve), causal, context reaching into `before`. */
const lossSeries = (before, span) => {
  const out = new Array(span.length);
  for (let i = 0; i < span.length; i++) {
    const history = i === 0 ? before : [...before.slice(Math.max(0, before.length - ORDER + i)), ...span.slice(0, i)];
    const ctx = history.slice(Math.max(0, history.length - ORDER));
    const { mass, reserve } = reigning.massOf(ctx, span[i]);
    const p = mass > 0 ? mass : reserve;
    out[i] = p > 0 ? -Math.log(p) : -Math.log(Number.MIN_VALUE);
  }
  return out;
};

const heldoutStart = TRAIN_SIZE + HELDOUT_GAP;
const before = prose.slice(0, heldoutStart);
const controlSpan = prose.slice(heldoutStart, heldoutStart + 2 * HELDOUT_SPAN);
const spliceSpan = [...prose.slice(heldoutStart, heldoutStart + HELDOUT_SPAN), ...chrome];

const controlLoss = lossSeries(before, controlSpan);
const spliceLoss = lossSeries(before, spliceSpan);
const spliceBoundary = HELDOUT_SPAN; // index in spliceLoss where chrome begins

console.log(`\ndeclared   order=${ORDER} alpha=${ALPHA} loss_window=${LOSS_WINDOW} draws=${DRAWS} reseeds=${RESEEDS} step=${STEP} seed=${SEED}`);
console.log(`control stream: ${controlLoss.length} loss observations, homogeneous prose throughout`);
console.log(`splice stream:  ${spliceLoss.length} loss observations, chrome begins at index ${spliceBoundary}\n`);

/** Walk a loss series, checking before/after ground.pattern() at each STEP, same shape as turn.js's drift check. */
const walk = (series, name) => {
  const events = [];
  let b = LOSS_WINDOW * 2;
  while (b + STEP <= series.length) {
    const beforeMat = series.slice(0, b);
    const afterMat = series.slice(0, b + STEP);
    const gBefore = ground({ material: beforeMat, draws: DRAWS, window: LOSS_WINDOW, statistic: "windowMean", perturbation: "shuffle", seed: SEED });
    const gAfter = ground({ material: afterMat, draws: DRAWS, window: LOSS_WINDOW, statistic: "windowMean", perturbation: "shuffle", seed: SEED });
    if (gBefore.gap || gAfter.gap) { b += STEP; continue; }
    const pat = pattern({ before: gBefore, after: gAfter, material: beforeMat, reseeds: RESEEDS });
    if (!pat.gap && pat.moved) events.push({ at: b, displacement: pat.displacement, reseedNull: pat.reseedNull });
    b += STEP;
  }
  console.log(`${name}: ${events.length} moved event(s)${events.length ? " at " + events.map((e) => e.at).join(", ") : ""}`);
  return events;
};

// A REAL prose control isn't guaranteed stationary — Frankenstein is a frame
// narrative and switches first-person voice more than once, so an event there
// could be a genuine content-driven shift rather than a false alarm. This
// second control has no regime to shift BY CONSTRUCTION: same vocabulary,
// order destroyed.
const shuffleTokens = (tokens, seed) => {
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const out = [...tokens];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
const shuffledSpan = shuffleTokens(controlSpan, SEED);
const shuffledLoss = lossSeries(before, shuffledSpan);

const controlEvents = walk(controlLoss, "control  (homogeneous prose)      ");
const shuffledEvents = walk(shuffledLoss, "shuffled (order destroyed, no regime)");
const spliceEvents = walk(spliceLoss, "splice   (prose -> chrome)        ");

console.log(`\nsplice boundary is at index ${spliceBoundary}. A correct design puts moved events near it and not scattered elsewhere.`);
if (spliceEvents.length) {
  const nearest = spliceEvents.reduce((best, e) => (Math.abs(e.at - spliceBoundary) < Math.abs(best.at - spliceBoundary) ? e : best));
  console.log(`nearest moved event to the real boundary: index ${nearest.at} (${Math.abs(nearest.at - spliceBoundary)} loss-observations away)`);
}
console.log(`control false-alarm rate: ${controlEvents.length} events over a homogeneous stream that should show none.`);

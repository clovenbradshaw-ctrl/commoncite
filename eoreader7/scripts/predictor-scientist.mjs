// eoreader6 · predictor-scientist — is "which predictor is right" itself a
// terrain object, or a constant?
//
// Usage: node scripts/predictor-scientist.mjs [text]
//
// Three joints were left open in conversation before any of this was worth
// building, and this script is the experiment that closes them, not a
// hyperparameter search:
//
//   1. NULL SIZING — a predictor competing over one span needs a null built
//      from THAT SPAN's own reseeding variation, not a global benchmark. But
//      "reseed the span" has two readings: shuffle the span in isolation, or
//      shuffle the wider material and re-slice the same span out of it. These
//      are different nulls. Experiment 1 measures which one actually
//      separates a real span from an order-destroyed twin of itself.
//
//   2. THE COMPETENCY STATISTIC — does a fixed-shape predictor (one order,
//      one alpha, one counting rule) stay the best choice across a whole
//      read, or does the winner change span to span? Experiment 3 answers
//      this directly, by letting predictors COMPETE per span instead of
//      assuming an order.
//
//   3. NOMINATE CHEAP, WITNESS EXPENSIVE — null-per-candidate is the
//      expensive step. Experiment 2 asks whether a cheap proxy (loss on a
//      small unnulled sample) ranks candidates well enough to prefilter
//      which ones deserve the expensive treatment, the same two-stage shape
//      slots.js already uses for class nomination.
//
// Every declared number is named once, at the top, exactly as everywhere else
// in this engine — a run is a run.
//
// ── EVERY DECLARED NUMBER ─────────────────────────────────────────────────
const ORDER_CANDIDATES = [2, 4, 6];
const ALPHA_CANDIDATES = [0.3, 0.7, 1.5];
const CONTINUATION_CANDIDATES = [false, true]; // raw frequency vs continuation count at order 0
const TRAIN_SIZE = 30000; // forms every candidate is trained on
const GAP = 15000; // forms skipped between training and held-out, so no candidate's order-6 context reaches into training
const HELDOUT_TOTAL = 6000; // forms scored, split into chunks below
const CHUNK_SIZE = 1000; // Experiment 3's competition unit
const SPAN_SIZE = 500; // Experiment 1's null-design test unit
const SPAN_OFFSETS = [0, 1000, 2500, 4000]; // where, within the held-out region, Experiment 1's spans start
const DRAWS = 32; // the resolution of every null in this file
const CHEAP_SAMPLE = 200; // Experiment 2's unnulled proxy sample size
const NOMINATE_TOP_K = 3; // Experiment 3 witnesses only the cheap-proxy's top K per chunk
const SLOT_CLASSES = 48; // same declared numbers slot-abstraction.mjs uses, so this is comparable to that finding
const SLOT_FEATURES = 400;
const SLOT_MIN_COUNT = 4;
const SLOT_ITERATIONS = 12;
const SLOT_DRAWS = 32;
const SEED = 20260731;

import { readFileSync, existsSync } from "node:fs";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { induceSlots } from "../packages/engine/generation/slots.js";

const TEXTS = process.argv[2] ? [process.argv[2]] : ["scripts/corpus/pg84.txt", "scripts/corpus/pg20781.txt"];
const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;

// ── a declared, seeded PRNG — no Math.random anywhere in this file ────────
const rngFrom = (seed) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
};
const shuffleTokens = (tokens, seed) => {
  const out = [...tokens];
  const u = rngFrom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(u() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
/** A random sample of `n` tokens, WITHOUT replacement, from `pool`, in random order. */
const sampleWithoutReplacement = (pool, n, seed) => {
  const idx = pool.map((_, i) => i);
  const u = rngFrom(seed);
  const take = Math.min(n, idx.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(u() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, take).map((i) => pool[i]);
};

// ── a minimal, self-contained Witten-Bell n-gram, deliberately separate from
// generation/belief.js: this file is a scientist running experiments on
// candidate SHAPES of predictor, not a production reader, and touching the
// hardened, conformance-pinned belief.js to add a throwaway axis (raw vs
// continuation count) would be exactly the kind of change SEED.md warns
// against making without a finding in hand first. ─────────────────────────
const CTX_SEP = "";
class Candidate {
  constructor({ order, alpha, continuation }) {
    this.order = order;
    this.alpha = alpha;
    this.continuation = continuation;
    this.tables = Array.from({ length: order + 1 }, () => new Map());
    this.continuationOf = new Map(); // form -> Set(preceding form) — distinct contexts it has followed
    this.continuationTotal = 0;
  }
  train(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j <= this.order; j++) {
        if (i - j < 0) break;
        const key = j === 0 ? "" : tokens.slice(i - j, i).join(CTX_SEP);
        let entry = this.tables[j].get(key);
        if (!entry) { entry = { succ: new Map(), total: 0 }; this.tables[j].set(key, entry); }
        entry.succ.set(tokens[i], (entry.succ.get(tokens[i]) ?? 0) + 1);
        entry.total++;
      }
      if (this.continuation) {
        const prev = i >= 1 ? tokens[i - 1] : " START";
        let set = this.continuationOf.get(tokens[i]);
        if (!set) { set = new Set(); this.continuationOf.set(tokens[i], set); }
        if (!set.has(prev)) { set.add(prev); this.continuationTotal++; }
      }
    }
    return this;
  }
  massOf(ctx, form) {
    let mass = 0;
    let remaining = 1;
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
      let p0 = 0;
      if (this.continuation && this.continuationTotal > 0) {
        p0 = (this.continuationOf.get(form)?.size ?? 0) / this.continuationTotal;
      } else {
        const c = entry0.succ.get(form);
        p0 = c ? c / entry0.total : 0;
      }
      mass += share * p0;
      remaining -= share;
    }
    return { mass, reserve: Math.max(0, remaining) };
  }
  /** Full successor map at `ctx`, same interpolation as massOf. Map<form, mass> sums to at most 1. */
  successors(ctx) {
    const out = new Map();
    let remaining = 1;
    const reach = Math.min(this.order, ctx.length);
    for (let j = reach; j >= 1; j--) {
      const key = ctx.slice(ctx.length - j).join(CTX_SEP);
      const entry = this.tables[j].get(key);
      if (!entry || !(entry.total > 0)) continue;
      const share = remaining * (entry.total / (entry.total + this.alpha));
      for (const [form, c] of entry.succ) {
        const p = c / entry.total;
        if (p > 0) out.set(form, (out.get(form) ?? 0) + share * p);
      }
      remaining -= share;
      if (remaining <= 0) return { successors: out, reserve: 0 };
    }
    const entry0 = this.tables[0].get("");
    if (entry0 && entry0.total > 0) {
      const share = remaining * (entry0.total / (entry0.total + this.alpha));
      if (this.continuation && this.continuationTotal > 0) {
        for (const [form, set] of this.continuationOf) {
          const p = set.size / this.continuationTotal;
          if (p > 0) out.set(form, (out.get(form) ?? 0) + share * p);
        }
      } else {
        for (const [form, c] of entry0.succ) {
          const p = c / entry0.total;
          if (p > 0) out.set(form, (out.get(form) ?? 0) + share * p);
        }
      }
      remaining -= share;
    }
    return { successors: out, reserve: Math.max(0, remaining) };
  }
}

/**
 * A TERRAIN-DERIVED candidate — not another flavour of n-gram, a genuinely
 * different question. `base` supplies the surface distribution at a context;
 * `classModel` is trained on the SAME material rewritten as a stream of
 * induced classes, so it answers "which class comes next" instead of "which
 * form"; `abstraction` is what connects the two. The gate is
 * `beta = (h_form - h_class) / h_form` — self-silencing exactly where the
 * class distribution has nothing to say, never a picked constant.
 */
class SlotGated {
  constructor({ base, classModel, abstraction }) {
    this.base = base;
    this.classModel = classModel;
    this.abstraction = abstraction;
    this.order = base.order;
  }
  massOf(ctx, form) {
    const { successors, reserve } = this.base.successors(ctx);
    if (successors.size === 0) return { mass: 0, reserve };
    let total = 0;
    for (const p of successors.values()) total += p;
    if (!(total > 0)) return { mass: 0, reserve };
    let hForm = 0;
    for (const p of successors.values()) { const q = p / total; if (q > 0) hForm -= q * Math.log(q); }
    const byClass = new Map();
    for (const [f, p] of successors) {
      const cls = this.abstraction.of(f) ?? f;
      byClass.set(cls, (byClass.get(cls) ?? 0) + p);
    }
    let hClass = 0;
    for (const m of byClass.values()) { const q = m / total; if (q > 0) hClass -= q * Math.log(q); }
    const beta = hForm > 0 ? Math.max(0, hForm - hClass) / hForm : 0;
    const classCtx = ctx.map((t) => this.abstraction.of(t) ?? t);
    let constrainedTotal = 0;
    const constrained = new Map();
    for (const [f, p] of successors) {
      const cls = this.abstraction.of(f) ?? f;
      const cm = this.classModel.massOf(classCtx, cls);
      const cp = cm.mass > 0 ? cm.mass : cm.reserve;
      const val = p * Math.pow(Math.max(cp, 1e-12), beta);
      constrained.set(f, val);
      constrainedTotal += val;
    }
    if (!(constrainedTotal > 0)) return { mass: 0, reserve };
    const raw = constrained.get(form);
    const mass = raw ? (raw / constrainedTotal) * total : 0;
    return { mass, reserve };
  }
}

const label = (c) => c.label;
const NGRAM_CANDIDATES = ORDER_CANDIDATES.flatMap((order) =>
  ALPHA_CANDIDATES.flatMap((alpha) =>
    CONTINUATION_CANDIDATES.map((continuation) => ({
      order, alpha, continuation,
      label: `order=${order} alpha=${alpha}${continuation ? " cont" : ""}`,
    })),
  ),
);

/** mean nats/form of one candidate over one span, causal within the span, context reaching back into `before`. */
const lossOver = (model, before, span) => {
  let total = 0;
  for (let i = 0; i < span.length; i++) {
    const history = i === 0 ? before : [...before.slice(Math.max(0, before.length - model.order + i), before.length), ...span.slice(0, i)];
    const ctx = history.slice(Math.max(0, history.length - model.order));
    const { mass, reserve } = model.massOf(ctx, span[i]);
    const p = mass > 0 ? mass : reserve;
    total += p > 0 ? -Math.log(p) : -Math.log(Number.MIN_VALUE);
  }
  return total / span.length;
};

for (const TEXT of TEXTS) {
  if (!existsSync(TEXT)) { console.error(`no text at ${TEXT}`); continue; }
  const raw = readFileSync(TEXT, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const tokens = stripContainer(raw).text.toLowerCase().match(WORD) ?? [];
  const heldoutStart = TRAIN_SIZE + GAP;
  if (tokens.length < heldoutStart + HELDOUT_TOTAL) {
    console.error(`${TEXT}: ${tokens.length} forms, not enough for the declared windows`);
    continue;
  }
  const train = tokens.slice(0, TRAIN_SIZE);
  const heldout = tokens.slice(heldoutStart, heldoutStart + HELDOUT_TOTAL);

  console.log(`\n${"=".repeat(78)}`);
  console.log(`${TEXT} — ${tokens.length.toLocaleString()} forms`);
  console.log(`train 0..${TRAIN_SIZE.toLocaleString()}   held out ${heldoutStart.toLocaleString()}..${(heldoutStart + HELDOUT_TOTAL).toLocaleString()}`);
  console.log(`declared   orders=[${ORDER_CANDIDATES}] alphas=[${ALPHA_CANDIDATES}] draws=${DRAWS} seed=${SEED}`);
  console.log(`${"=".repeat(78)}`);

  // A predictor trained once on `train`, reused across every experiment below.
  const CANDIDATES = [...NGRAM_CANDIDATES];
  const trained = NGRAM_CANDIDATES.map((c) => new Candidate(c).train(train));

  // ── the one genuinely TERRAIN-derived candidate, induced from TRAIN ONLY ──
  // (leakage rule from slot-abstraction.mjs: induce fresh, never from held-out).
  const slots = induceSlots({
    tokens: train, classes: SLOT_CLASSES, features: SLOT_FEATURES, minCount: SLOT_MIN_COUNT,
    iterations: SLOT_ITERATIONS, draws: SLOT_DRAWS, seed: SEED, label: "slots",
  });
  if (!slots.gap) {
    const base = new Candidate({ order: 4, alpha: 0.7, continuation: false }).train(train);
    const classTokens = train.map((f) => slots.of(f) ?? f);
    const classModel = new Candidate({ order: 4, alpha: 0.7, continuation: false }).train(classTokens);
    const slotGated = new SlotGated({ base, classModel, abstraction: slots });
    slotGated.label = "order=4 slot-gated (h_form-h_class)";
    CANDIDATES.push({ label: slotGated.label });
    trained.push(slotGated);
    console.log(`\nterrain candidate induced: ${slots.report.grouped.toLocaleString()} types in ${slots.report.classes} confirmed classes, ${slots.report.standing_alone.toLocaleString()} standing alone`);
  } else {
    console.log(`\nterrain candidate refused: ${slots.gap} — competing without it`);
  }

  // ── EXPERIMENT 1 — which null design actually separates order from noise? ─
  console.log(`\n── Experiment 1: null design ─────────────────────────────────────────`);
  console.log(`for a fixed order=4 alpha=0.7 predictor, on each span: real loss vs its`);
  console.log(`SHUFFLED TWIN's loss, ranked against two null designs. A correct design`);
  console.log(`should rank real as a clear outlier and the shuffled twin as ordinary.\n`);
  const referee = new Candidate({ order: 4, alpha: 0.7, continuation: false }).train(train);
  console.log(`  span            real   twin  |  span-local null: real%ile twin%ile  |  global-resample null: real%ile twin%ile`);
  const exp1Rows = [];
  for (const off of SPAN_OFFSETS) {
    const span = heldout.slice(off, off + SPAN_SIZE);
    const before = tokens.slice(0, heldoutStart + off);
    const twin = shuffleTokens(span, SEED + off);

    const realLoss = lossOver(referee, before, span);
    const twinLoss = lossOver(referee, before, twin);

    const spanLocalNull = [];
    for (let d = 0; d < DRAWS; d++) spanLocalNull.push(lossOver(referee, before, shuffleTokens(span, SEED + off + 1000 + d)));
    spanLocalNull.sort((a, b) => a - b);

    const globalNull = [];
    for (let d = 0; d < DRAWS; d++) globalNull.push(lossOver(referee, before, sampleWithoutReplacement(before, SPAN_SIZE, SEED + off + 5000 + d)));
    globalNull.sort((a, b) => a - b);

    // percentile = share of null draws with HIGHER loss (worse) than the observed —
    // a real, order-carrying span should beat almost every null draw.
    const pct = (value, null_) => (100 * null_.filter((x) => x > value).length) / null_.length;
    const row = {
      off, realLoss, twinLoss,
      spanLocalReal: pct(realLoss, spanLocalNull), spanLocalTwin: pct(twinLoss, spanLocalNull),
      globalReal: pct(realLoss, globalNull), globalTwin: pct(twinLoss, globalNull),
    };
    exp1Rows.push(row);
    console.log(
      `  ${String(off).padStart(6)}      ${realLoss.toFixed(3).padStart(6)} ${twinLoss.toFixed(3).padStart(6)}  |` +
      `           ${row.spanLocalReal.toFixed(0).padStart(5)}%   ${row.spanLocalTwin.toFixed(0).padStart(5)}%     |` +
      `                 ${row.globalReal.toFixed(0).padStart(5)}%   ${row.globalTwin.toFixed(0).padStart(5)}%`,
    );
  }
  const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(`\n  mean   span-local: real ${meanOf(exp1Rows.map((r) => r.spanLocalReal)).toFixed(0)}%ile, twin ${meanOf(exp1Rows.map((r) => r.spanLocalTwin)).toFixed(0)}%ile` +
    `   |   global-resample: real ${meanOf(exp1Rows.map((r) => r.globalReal)).toFixed(0)}%ile, twin ${meanOf(exp1Rows.map((r) => r.globalTwin)).toFixed(0)}%ile`);
  console.log(`  a design that WORKS puts real near 100%ile and twin near 50%ile. Read the gap between the two designs' twin columns —`);
  console.log(`  the design whose twin column sits closer to 50 is the one that is not itself quietly encoding order.`);

  // ── EXPERIMENT 2 — does a cheap, unnulled proxy rank candidates like the ──
  //    expensive, nulled score would?
  console.log(`\n── Experiment 2: cheap nomination vs expensive witnessing ──────────────`);
  const cheapSample = heldout.slice(0, CHEAP_SAMPLE);
  const cheapBefore = tokens.slice(0, heldoutStart);
  const cheapScores = trained.map((m) => lossOver(m, cheapBefore, cheapSample));
  const expensiveScores = trained.map((m) => lossOver(m, cheapBefore, heldout));
  // Spearman rank correlation between the two rankings.
  const rank = (xs) => {
    const order = xs.map((x, i) => i).sort((a, b) => xs[a] - xs[b]);
    const r = new Array(xs.length);
    order.forEach((idx, pos) => (r[idx] = pos));
    return r;
  };
  const rc = rank(cheapScores), re = rank(expensiveScores);
  const n = rc.length;
  const dSq = rc.reduce((sum, _, i) => sum + (rc[i] - re[i]) ** 2, 0);
  const spearman = 1 - (6 * dSq) / (n * (n * n - 1));
  console.log(`  ${n} candidates, cheap proxy = ${CHEAP_SAMPLE}-form unnulled loss, expensive = full ${HELDOUT_TOTAL}-form loss`);
  console.log(`  Spearman rank correlation (cheap proxy vs expensive full score): ${spearman.toFixed(3)}`);
  const topByCheap = [...trained.keys()].sort((a, b) => cheapScores[a] - cheapScores[b]).slice(0, NOMINATE_TOP_K);
  const topByExpensive = [...trained.keys()].sort((a, b) => expensiveScores[a] - expensiveScores[b]).slice(0, NOMINATE_TOP_K);
  const overlap = topByCheap.filter((i) => topByExpensive.includes(i)).length;
  console.log(`  top-${NOMINATE_TOP_K} by cheap proxy: ${topByCheap.map((i) => label(CANDIDATES[i])).join(", ")}`);
  console.log(`  top-${NOMINATE_TOP_K} by expensive:   ${topByExpensive.map((i) => label(CANDIDATES[i])).join(", ")}`);
  console.log(`  overlap: ${overlap}/${NOMINATE_TOP_K} — a nominate-cheap/witness-expensive split is only honest if this overlap holds up.`);

  // ── EXPERIMENT 3 — does the winning predictor change chunk to chunk, and ──
  //    does a chunk-by-chunk switcher beat every fixed candidate and a
  //    random-switching control?
  console.log(`\n── Experiment 3: does the winner change, and does switching pay for it ──`);
  const chunks = [];
  for (let off = 0; off + CHUNK_SIZE <= HELDOUT_TOTAL; off += CHUNK_SIZE) chunks.push(heldout.slice(off, off + CHUNK_SIZE));
  const chunkBefore = (i) => tokens.slice(0, heldoutStart + i * CHUNK_SIZE);

  const winners = [];
  const switcherLosses = [];
  const perChunkAllLosses = []; // [chunkIndex][candidateIndex] = loss, for the fixed-baseline comparison below
  chunks.forEach((chunk, i) => {
    const before = chunkBefore(i);
    // nominate cheap: score every candidate on this chunk directly (no null — that IS the cheap step)
    const cheap = trained.map((m) => lossOver(m, before, chunk));
    perChunkAllLosses.push(cheap);
    const shortlist = [...trained.keys()].sort((a, b) => cheap[a] - cheap[b]).slice(0, NOMINATE_TOP_K);
    // witness expensive: null each shortlisted candidate against a resample null SIZED TO THIS CHUNK —
    // Experiment 1's finding decides which design; span-local is used here since it is what a chunk can
    // always afford (it needs no access to a longer "before" than the chunk owns).
    let best = null, bestSeparation = -Infinity;
    for (const idx of shortlist) {
      const real = cheap[idx];
      const nullDraws = [];
      for (let d = 0; d < DRAWS; d++) nullDraws.push(lossOver(trained[idx], before, shuffleTokens(chunk, SEED + i * 100 + d)));
      const nullMean = meanOf(nullDraws);
      const separation = nullMean - real; // how much lower (better) than its own null
      if (separation > bestSeparation) { bestSeparation = separation; best = idx; }
    }
    winners.push(best);
    switcherLosses.push(cheap[best]);
  });

  const slotIdx = CANDIDATES.findIndex((c) => c.label.includes("slot-gated"));
  const baseIdx = CANDIDATES.findIndex((c) => c.label === "order=4 alpha=0.7");
  console.log(`  chunk   winner                          winner-loss   ungated order=4/0.7   slot-gated loss   gate helped its own base?`);
  winners.forEach((w, i) => {
    const row = perChunkAllLosses[i];
    const helped = slotIdx >= 0 && baseIdx >= 0 ? row[slotIdx] < row[baseIdx] : null;
    console.log(
      `  ${String(i).padStart(5)}   ${label(CANDIDATES[w]).padEnd(30)} ${row[w].toFixed(3).padStart(9)}` +
        `             ${baseIdx >= 0 ? row[baseIdx].toFixed(3).padStart(9) : "n/a"}         ${slotIdx >= 0 ? row[slotIdx].toFixed(3).padStart(9) : "n/a"}` +
        `          ${helped === null ? "-" : helped ? "YES" : "no"}`,
    );
  });
  const distinctWinners = new Set(winners).size;
  console.log(`  ${distinctWinners} distinct winner(s) across ${chunks.length} chunks.`);

  // fixed baselines: best single candidate averaged over ALL chunks, and worst
  const meanPerCandidate = CANDIDATES.map((_, idx) => meanOf(perChunkAllLosses.map((row) => row[idx])));
  const bestFixedIdx = meanPerCandidate.reduce((best, v, i) => (v < meanPerCandidate[best] ? i : best), 0);
  const worstFixedIdx = meanPerCandidate.reduce((worst, v, i) => (v > meanPerCandidate[worst] ? i : worst), 0);

  // random-switching control: for each chunk pick a RANDOM candidate from the SAME shortlist size,
  // seeded, so the comparison isolates "does picking the winner help" from "does switching at all help".
  const randomSwitcherLosses = chunks.map((_, i) => {
    const u = rngFrom(SEED + 9999 + i);
    const idx = Math.floor(u() * CANDIDATES.length);
    return perChunkAllLosses[i][idx];
  });

  console.log(`\n  mean nats/form over ${chunks.length} chunks:`);
  console.log(`    best fixed predictor   (${label(CANDIDATES[bestFixedIdx])}):  ${meanOf(perChunkAllLosses.map((row) => row[bestFixedIdx])).toFixed(3)}`);
  console.log(`    worst fixed predictor  (${label(CANDIDATES[worstFixedIdx])}):  ${meanOf(perChunkAllLosses.map((row) => row[worstFixedIdx])).toFixed(3)}`);
  console.log(`    random switcher:                          ${meanOf(randomSwitcherLosses).toFixed(3)}`);
  console.log(`    nominate+witness switcher:                ${meanOf(switcherLosses).toFixed(3)}`);
  console.log(`  the switcher is only a finding if it beats BOTH the best fixed predictor AND the random switcher —`);
  console.log(`  beating only the random switcher would mean switching helps for reasons unrelated to picking well.`);
}
console.log("");

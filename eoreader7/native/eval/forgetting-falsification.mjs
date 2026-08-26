// native/eval/forgetting-falsification.mjs — P41/S15 put where it can lose:
// entity-level returns in a real book, and chroma-state returns in real
// audio. Predictions are FROZEN in
// results/forgetting-falsification-RESULTS.md before any run.
//
// The predictor bank mirrors fold-prediction.mjs deliberately (same bank,
// same paired statistics) so the arms are comparable; this is a driver-local
// reuse, disclosed here, not a second organ.
//
// Usage:
//   node native/eval/forgetting-falsification.mjs book  <book.txt> --coref <prior.json>
//   node native/eval/forgetting-falsification.mjs audio <file.wav>

import fs from "node:fs";
import { stripContainer, splitSentences } from "../adapters/text/spans.js";
import { castSurfaceMap } from "../adapters/text/perspective-claims.js";
import { createSession, admitChunked, sessionReferents } from "../../legacy-eoreader6.1/packages/host/corpus.js";
import { decodeWav } from "../../legacy-eoreader6.1/packages/engine/perceiver/audio/wav.js";
import { extractFrameFields } from "../../legacy-eoreader6.1/packages/engine/perceiver/audio/reading.js";
import { monoSum, resampleLinear } from "../../legacy-eoreader6.1/packages/engine/perceiver/audio/resample.js";

const SEED = 20260825;
const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (arr, seed) => {
  const rnd = mulberry(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
const dyadicFloor = (n) => 1 << Math.floor(Math.log2(Math.max(1, n)));
const arg = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };

const precisionAtK = (ranked, truth) => {
  if (!truth.size) return null;
  let hit = 0;
  for (let i = 0; i < Math.min(truth.size, ranked.length); i += 1) if (truth.has(ranked[i])) hit += 1;
  return hit / truth.size;
};

// observations: array of Set(identity). The same prequential bank as
// fold-prediction.mjs: base-rate, recency, actr power-law (received d=0.5,
// giver: Anderson/ACT-R), measured need-odds.
function runArm(observations, label) {
  const count = new Map();
  const lastAt = new Map();
  const occurrencesOf = new Map();
  const cellTallies = new Map();
  const recencyTallies = new Map();
  const scores = { "baseline:base-rate": [], "baseline:recency": [], "candidate:actr-prior": [], "candidate:need-odds-measured": [] };
  const chance = [];
  let steps = 0;

  const actrScore = (m, now) => {
    let b = 0;
    for (const t of occurrencesOf.get(m) ?? []) b += 1 / Math.sqrt(now - t + 1);
    return b;
  };
  const cellOf = (m, now) => {
    const r = dyadicFloor(now - (lastAt.get(m) ?? now) + 1);
    const f = dyadicFloor(count.get(m) ?? 1);
    return { key: r + "|" + f, r };
  };
  const needOdds = (m, now) => {
    const { key, r } = cellOf(m, now);
    const cell = cellTallies.get(key);
    if (cell && cell.trials > 0) return cell.arrivals / cell.trials;
    const marg = recencyTallies.get(r);
    if (marg && marg.trials > 0) return marg.arrivals / marg.trials;
    return (count.get(m) ?? 0) / Math.max(1, now);
  };

  for (let t = 0; t < observations.length - 1; t += 1) {
    for (const m of observations[t]) {
      count.set(m, (count.get(m) ?? 0) + 1);
      if (!occurrencesOf.has(m)) occurrencesOf.set(m, []);
      occurrencesOf.get(m).push(t);
      lastAt.set(m, t);
    }
    const live = [...count.entries()].filter(([, n]) => n >= 2).map(([m]) => m);
    if (live.length < 2) continue;
    const truth = new Set([...observations[t + 1]].filter((m) => count.has(m)));
    if (!truth.size) continue;

    const rank = (score) => [...live].sort((a, b) => score(b) - score(a));
    scores["baseline:base-rate"].push(precisionAtK(rank((m) => count.get(m) ?? 0), truth));
    scores["baseline:recency"].push(precisionAtK(rank((m) => lastAt.get(m) ?? -Infinity), truth));
    scores["candidate:actr-prior"].push(precisionAtK(rank((m) => actrScore(m, t)), truth));
    scores["candidate:need-odds-measured"].push(precisionAtK(rank((m) => needOdds(m, t)), truth));
    chance.push(Math.min(truth.size, live.length) / live.length);
    steps += 1;

    for (const m of live) {
      const { key, r } = cellOf(m, t);
      const hit = truth.has(m) ? 1 : 0;
      const c = cellTallies.get(key) ?? { trials: 0, arrivals: 0 };
      c.trials += 1; c.arrivals += hit; cellTallies.set(key, c);
      const g = recencyTallies.get(r) ?? { trials: 0, arrivals: 0 };
      g.trials += 1; g.arrivals += hit; recencyTallies.set(r, g);
    }
  }

  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const paired = (a, b) => {
    const d = scores[a].map((x, i) => x - scores[b][i]);
    const m = mean(d) ?? 0;
    const sd = Math.sqrt((mean(d.map((x) => (x - m) ** 2)) ?? 0) * (d.length / Math.max(1, d.length - 1)));
    return { of: `${a} minus ${b}`, meanDelta: Number(m.toFixed(5)),
      stepsBetter: d.filter((x) => x > 0).length, stepsWorse: d.filter((x) => x < 0).length,
      z: sd > 0 ? Number((m / (sd / Math.sqrt(d.length))).toFixed(2)) : null };
  };
  return {
    arm: label, steps, chance: mean(chance),
    meanPrecisionAtK: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, mean(v)])),
    pairedHeadline: [
      paired("candidate:actr-prior", "baseline:base-rate"),
      paired("candidate:need-odds-measured", "baseline:base-rate"),
      paired("candidate:actr-prior", "baseline:recency"),
    ],
  };
}

async function bookObservations(path, corefPath) {
  const raw = fs.readFileSync(path, "utf8");
  const stripped = stripContainer(raw);
  const prior = corefPath ? JSON.parse(fs.readFileSync(corefPath, "utf8")) : null;
  const sourceId = `file:${path.split("/").pop()}`;
  const session = createSession();
  admitChunked(session, { text: raw, sourceId, language: "en" });
  const cast = sessionReferents(session, { sourceId, priors: prior ? [prior] : [], limit: 200 });
  const surfaceToReferent = castSurfaceMap(cast.referents ?? []);
  const surfaces = [...surfaceToReferent.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
  const matcher = surfaces.length ? new RegExp(`\\b(${surfaces.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "giu") : null;
  const observations = [];
  for (const s of splitSentences(stripped.text)) {
    const here = new Set();
    if (matcher) {
      matcher.lastIndex = 0;
      let m;
      while ((m = matcher.exec(s.text))) {
        const ref = surfaceToReferent.get(m[1]) ?? surfaceToReferent.get(m[1].toLowerCase());
        if (ref) here.add(ref);
      }
    }
    observations.push(here);
  }
  return { observations, cast: cast.referents?.length ?? 0, unit: "sentence" };
}

function audioObservations(path) {
  const bytes = fs.readFileSync(path);
  const wav = decodeWav(bytes);
  const mono = monoSum(wav.channelData);
  const samples = resampleLinear(mono, wav.sampleRate, 22050);
  const { frames } = extractFrameFields(samples, 22050);
  // identity = the frame's top-3 pitch classes, sorted — a chord-shaped
  // state DISCOVERED from the frame's own chroma, never listed. 3 is the
  // triad's own structural size (the smallest complete chord), not a dial.
  const observations = frames.map((f) => {
    const chroma = f.chroma;
    const idx = [...chroma.keys()].sort((a, b) => chroma[b] - chroma[a]).slice(0, 3).sort((a, b) => a - b);
    return new Set([idx.join("-")]);
  });
  return { observations, frames: frames.length, unit: "frame (~46ms: hop 1024 at 22050 Hz — the perceiver's own numbers)" };
}

async function main() {
  const mode = process.argv[2];
  const path = process.argv[3];
  if (!mode || !path) throw new TypeError("usage: node native/eval/forgetting-falsification.mjs book|audio <file> [--coref <prior.json>]");
  const meta = mode === "book" ? await bookObservations(path, arg("--coref")) : audioObservations(path);
  const real = runArm(meta.observations, "real");
  const nullArm = runArm(shuffle(meta.observations, SEED), "shuffled");
  console.log(JSON.stringify({
    schema: "EOForgettingFalsificationRun@1",
    mode, file: path.split("/").pop(),
    meta: { ...meta, observations: undefined },
    declared: { d: "0.5 — ACT-R's received standard, giver named (Anderson)", identityFloor: "seen >= 2 (binding.js's structural minimum)", SEED },
    arms: { real, null: nullArm },
  }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });

// eoreader6 · experiments/rival-triads — analysis.
//
// Reads sentences.json + the four judges' label files, embeds every
// sentence with Xenova/all-MiniLM-L6-v2 (the encoder family
// scripts/EMBEDDING-FINDINGS.md already characterized), and scores three
// systems on identical instruments:
//
//   S1  EO triad        (mode / domain / grain questions, judged blind)
//   S2  rival triad     (process type / time / participants, judged blind)
//   S3  surface control (length tercile / comma band / alphabetical tercile)
//
// Everything is pre-registered in PREREGISTRATION.md. The encoder never
// sees a label; the judges never saw either theory's vocabulary.
//
// Run: npm install && node analyze.mjs   (deps stay inside this experiment
// dir — the engine itself keeps zero dependencies)

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
const ANN = `${HERE}labels`;

const sentences = JSON.parse(readFileSync(`${HERE}sentences.json`, "utf8"));
const N = sentences.length;

// ---------- embeddings (cached) ----------
let vecs;
const cachePath = `${HERE}embeddings.json`;
if (existsSync(cachePath)) {
  vecs = JSON.parse(readFileSync(cachePath, "utf8"));
} else {
  const { pipeline } = await import("@xenova/transformers");
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  vecs = [];
  for (let i = 0; i < N; i += 32) {
    const batch = sentences.slice(i, i + 32).map((s) => s.text);
    const out = await extractor(batch, { pooling: "mean", normalize: true });
    const dim = out.dims[out.dims.length - 1];
    for (let j = 0; j < batch.length; j++) vecs.push(Array.from(out.data.slice(j * dim, (j + 1) * dim)));
    console.error(`embedded ${Math.min(i + 32, N)}/${N}`);
  }
  writeFileSync(cachePath, JSON.stringify(vecs));
}

// ---------- similarity matrix (normalized vectors → dot = cosine) ----------
const sim = Array.from({ length: N }, () => new Float64Array(N));
for (let i = 0; i < N; i++)
  for (let j = i + 1; j < N; j++) {
    let d = 0;
    const a = vecs[i], b = vecs[j];
    for (let k = 0; k < a.length; k++) d += a[k] * b[k];
    sim[i][j] = d; sim[j][i] = d;
  }

// ---------- labels ----------
const loadJudge = (file) => {
  const byId = {};
  for (const line of readFileSync(`${ANN}/${file}`, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const o = JSON.parse(t);
    byId[o.id] = [o.q1, o.q2, o.q3];
  }
  return sentences.map((s) => {
    if (!byId[s.id]) throw new Error(`${file}: missing id ${s.id}`);
    return byId[s.id];
  });
};
const s1A = loadJudge("out-s1-judgeA.jsonl"), s1B = loadJudge("out-s1-judgeB.jsonl");
const s2A = loadJudge("out-s2-judgeA.jsonl"), s2B = loadJudge("out-s2-judgeB.jsonl");

// surface control — mechanical
const lens = sentences.map((s) => s.text.split(/\s+/).length);
const tercile = (vals) => {
  const sorted = [...vals].sort((a, b) => a - b);
  const t1 = sorted[Math.floor(vals.length / 3)], t2 = sorted[Math.floor((2 * vals.length) / 3)];
  return vals.map((v) => (v < t1 ? "A" : v < t2 ? "B" : "C"));
};
const lenLab = tercile(lens);
const commaLab = sentences.map((s) => {
  const c = (s.text.match(/,/g) || []).length;
  return c === 0 ? "A" : c === 1 ? "B" : "C";
});
const alphaLab = tercile(sentences.map((s) => {
  const w = (s.text.split(/\s+/)[1] || "m").toLowerCase().replace(/[^a-z]/g, "") || "m";
  return w.charCodeAt(0);
}));
const s3 = sentences.map((_, i) => [lenLab[i], commaLab[i], alphaLab[i]]);

// ---------- seeded RNG + shuffle ----------
const mulberry32 = (seed) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const shuffled = (arr, rng) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const TRIALS = 500;

// stat: mean same-label sim − mean different-label sim, over a subset of indices
const coherenceStat = (labels, idxs) => {
  let sSame = 0, nSame = 0, sDiff = 0, nDiff = 0;
  for (let x = 0; x < idxs.length; x++)
    for (let y = x + 1; y < idxs.length; y++) {
      const v = sim[idxs[x]][idxs[y]];
      if (labels[x] === labels[y]) { sSame += v; nSame++; } else { sDiff += v; nDiff++; }
    }
  if (!nSame || !nDiff) return null;
  return sSame / nSame - sDiff / nDiff;
};

const permZ = (labels, idxs, seed) => {
  const real = coherenceStat(labels, idxs);
  if (real === null) return { real: null };
  const rng = mulberry32(seed);
  const nullDist = [];
  for (let t = 0; t < TRIALS; t++) {
    const v = coherenceStat(shuffled(labels, rng), idxs);
    if (v !== null) nullDist.push(v);
  }
  const mean = nullDist.reduce((a, b) => a + b, 0) / nullDist.length;
  const sd = Math.sqrt(nullDist.reduce((s, v) => s + (v - mean) ** 2, 0) / nullDist.length) || 1e-12;
  const p = nullDist.filter((v) => v >= real).length / nullDist.length;
  return { real, z: (real - mean) / sd, p };
};

// monotonicity: mean cosine distance by number of axes differing
const hammingCurve = (triples, idxs) => {
  const bins = [[], [], [], []];
  for (let x = 0; x < idxs.length; x++)
    for (let y = x + 1; y < idxs.length; y++) {
      let h = 0;
      for (let k = 0; k < 3; k++) if (triples[x][k] !== triples[y][k]) h++;
      bins[h].push(1 - sim[idxs[x]][idxs[y]]);
    }
  return bins.map((b) => (b.length ? { n: b.length, mean: b.reduce((a, c) => a + c, 0) / b.length } : { n: 0, mean: null }));
};

const kappa = (a, b, k) => {
  let agree = 0;
  const margA = {}, margB = {};
  for (let i = 0; i < N; i++) {
    if (a[i][k] === b[i][k]) agree++;
    margA[a[i][k]] = (margA[a[i][k]] || 0) + 1;
    margB[b[i][k]] = (margB[b[i][k]] || 0) + 1;
  }
  const po = agree / N;
  let pe = 0;
  for (const c of ["A", "B", "C"]) pe += ((margA[c] || 0) / N) * ((margB[c] || 0) / N);
  return (po - pe) / (1 - pe);
};

const cramersV = (labels, k1, k2) => {
  const table = {};
  for (const t of labels) {
    const key = t[k1] + t[k2];
    table[key] = (table[key] || 0) + 1;
  }
  const rows = {}, cols = {};
  for (const t of labels) { rows[t[k1]] = (rows[t[k1]] || 0) + 1; cols[t[k2]] = (cols[t[k2]] || 0) + 1; }
  let chi2 = 0;
  for (const r of Object.keys(rows))
    for (const c of Object.keys(cols)) {
      const e = (rows[r] * cols[c]) / labels.length;
      const o = table[r + c] || 0;
      chi2 += (o - e) ** 2 / e;
    }
  const kMin = Math.min(Object.keys(rows).length, Object.keys(cols).length) - 1;
  return Math.sqrt(chi2 / (labels.length * kMin));
};

// ---------- score one system ----------
const AXES = { s1: ["mode", "domain", "grain"], s2: ["process", "time", "participants"], s3: ["length", "commas", "alphabet"] };
let seedCounter = 1000;

const score = (name, judged, subsetIdxs) => {
  const idxs = subsetIdxs ?? sentences.map((_, i) => i);
  const triples = idxs.map((i) => judged[i]);
  const axes = {};
  for (let k = 0; k < 3; k++)
    axes[AXES[name.slice(0, 2)][k]] = permZ(triples.map((t) => t[k]), idxs, seedCounter++);
  const address = permZ(triples.map((t) => t.join("")), idxs, seedCounter++);
  const curve = hammingCurve(triples, idxs);
  const dist = {};
  for (let k = 0; k < 3; k++) {
    const c = {};
    for (const t of triples) c[t[k]] = (c[t[k]] || 0) + 1;
    dist[AXES[name.slice(0, 2)][k]] = c;
  }
  return { name, n: idxs.length, axes, address, curve, labelDistribution: dist };
};

const consensusIdxs = (a, b) => sentences.map((_, i) => i).filter((i) => a[i][0] === b[i][0] && a[i][1] === b[i][1] && a[i][2] === b[i][2]);

const s1Cons = consensusIdxs(s1A, s1B);
const s2Cons = consensusIdxs(s2A, s2B);

const results = {
  meta: { n: N, trials: TRIALS, encoder: "Xenova/all-MiniLM-L6-v2", date: "2026-08-16" },
  kappa: {
    s1: [0, 1, 2].map((k) => +kappa(s1A, s1B, k).toFixed(3)),
    s2: [0, 1, 2].map((k) => +kappa(s2A, s2B, k).toFixed(3)),
  },
  consensus: { s1: s1Cons.length, s2: s2Cons.length },
  independence: {
    s1: { "mode~domain": +cramersV(s1A, 0, 1).toFixed(3), "mode~grain": +cramersV(s1A, 0, 2).toFixed(3), "domain~grain": +cramersV(s1A, 1, 2).toFixed(3) },
    s2: { "process~time": +cramersV(s2A, 0, 1).toFixed(3), "process~participants": +cramersV(s2A, 0, 2).toFixed(3), "time~participants": +cramersV(s2A, 1, 2).toFixed(3) },
  },
  systems: {
    s1_all_judgeA: score("s1 all (judge A)", s1A, null),
    s2_all_judgeA: score("s2 all (judge A)", s2A, null),
    s1_all_judgeB: score("s1 all (judge B)", s1B, null),
    s2_all_judgeB: score("s2 all (judge B)", s2B, null),
    s1_consensus: score("s1 consensus", s1A, s1Cons),
    s2_consensus: score("s2 consensus", s2A, s2Cons),
    s3_surface: score("s3 surface", s3, null),
  },
};

// calibration: how much coherence does a purely topical partition (source
// register) carry on this instrument? Both judged systems should be read
// against this ceiling, not against zero.
results.registerCalibration = permZ(sentences.map((s) => s.register), sentences.map((_, i) => i), 9999);

writeFileSync(`${HERE}results.json`, JSON.stringify(results, null, 1));

const fmt = (r) => r.real === null ? "  (degenerate)" : `d=${r.real.toFixed(4)} z=${r.z.toFixed(2)} p=${r.p.toFixed(3)}`;
for (const sys of Object.values(results.systems)) {
  console.error(`\n=== ${sys.name} (n=${sys.n}) ===`);
  for (const [ax, r] of Object.entries(sys.axes)) console.error(`  ${ax.padEnd(13)} ${fmt(r)}`);
  console.error(`  ${"FULL ADDRESS".padEnd(13)} ${fmt(sys.address)}`);
  console.error(`  distance by #axes differing: ${sys.curve.map((c) => c.mean === null ? "–" : c.mean.toFixed(4)).join(" → ")}  (n: ${sys.curve.map((c) => c.n).join("/")})`);
}
console.error(`\nkappa S1 (mode/domain/grain): ${results.kappa.s1.join(" ")}`);
console.error(`kappa S2 (process/time/participants): ${results.kappa.s2.join(" ")}`);
console.error(`consensus sizes: S1 ${s1Cons.length}/${N}, S2 ${s2Cons.length}/${N}`);
console.error(`independence (Cramér's V): ${JSON.stringify(results.independence)}`);

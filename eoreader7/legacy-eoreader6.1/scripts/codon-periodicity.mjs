// eoreader6 · codon-periodicity — the engine against a REAL biological ground
// truth, with no new organs. This is the pitch from "A Ground You Can Cite":
// coding DNA carries period-3 (codon) structure, intergenic DNA does not. Does
// the existing ground/verdict machinery recover that separation, from the
// material alone?
//
// GROUND TRUTH (received, named): GenBank NC_005816.1 — Yersinia pestis biovar
// Microtus str. 91001 plasmid pPCP1, 9,609 bp, 10 annotated CDS. Record fetched
// from NCBI efetch (nuccore, rettype genbank + fasta) on 2026-08-01. The
// RefSeq record carries no ORIGIN block (CONTIG join(AE017046.1:1..9609)), so
// the bases come from the FASTA fetch and are verified against the LOCUS length.
//
// The sequence module, re-earned here, not ported: parse features by position,
// verify against the record's stated length, strand the CDS to their sense
// sequence, and validate translation against the record's own /translation
// qualifiers (with the GTG→Met start convention) before anything is measured.
//
// TWO independent checks are run before the engine is consulted:
//   1. TRANSLATION — does the transcribed sequence reproduce the record's own
//      annotated proteins exactly? (validates the parser by a known answer)
//   2. PERIOD-3 GROUND TRUTH — the classic phase-sum measure (|Σ indicator over
//      each codon phase|², the O(n) form of the spectral peak at bin n/3). This
//      is the famous gene-finding signal; if it is not strong here, the whole
//      premise fails before the engine is involved.
//
// THEN the engine, as-is. Its alphabet is four statistics (burstiness,
// windowMean, permutationEntropy, irreversibility) and three perturbations
// (shuffle, resample, phase), with Amendment-I licences. The candidate lens for
// "does the order carry period-3" is permutationEntropy at window 3: a shuffle
// destroys codon phase while keeping the base multiset, so a real coding series
// should sit at or BELOW its own shuffle null (regularity — SEED.md #8).
//
// Encoding is declared, not hidden: A=1 C=2 G=3 T=4. A second order (A=1 G=2
// C=3 T=4) is run to expose whether the verdict is an artefact of the arbitrary
// numeric order — if the ordinal statistic rides on the arbitrary order, the
// encoding is the finding, and the machinery is honest only by refusing.

import { readFileSync } from "node:fs";
import { ground, isGap, difference, burstiness, windowMean, permutationEntropy } from "../nul/index.js";
import { verdict } from "../verdict/index.js";

// ── declared, never defaulted ────────────────────────────────────────────────
const DRAWS = 256;            // resolution of testimony: finest rank sayable is 1/draws
const WINDOW = 3;             // the statistic's reach: triples, because period-3 is the claim
const WIN_SIZE = 150;         // the windowed attempt: material extent per window (~50 codons)
const SEED = 0;
const BASE_ORDERS = {
  "A=1 C=2 G=3 T=4": { A: 1, C: 2, G: 3, T: 4 },
  "A=1 G=2 C=3 T=4": { A: 1, G: 2, C: 3, T: 4 },
};

const GB = process.argv[2] ?? "/var/folders/ck/tztwm60n4s9dxwrjfwlsmz3m0000gn/T/opencode/NC_005816.gb";
const FA = process.argv[3] ?? "/var/folders/ck/tztwm60n4s9dxwrjfwlsmz3m0000gn/T/opencode/NC_005816.fa";

// ── the genetic code (standard; bacterial table 11 is identical for elongation) ──
const CODON = {
  TTT: "F", TTC: "F", TTA: "L", TTG: "L", TCT: "S", TCC: "S", TCA: "S", TCG: "S",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*", TGT: "C", TGC: "C", TGA: "*", TGG: "W",
  CTT: "L", CTC: "L", CTA: "L", CTG: "L", CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  CAT: "H", CAC: "H", CAA: "Q", CAG: "Q", CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M", ACT: "T", ACC: "T", ACA: "T", ACG: "T",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K", AGT: "S", AGC: "S", AGA: "R", AGG: "R",
  GTT: "V", GTC: "V", GTA: "V", GTG: "V", GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  GAT: "D", GAC: "D", GAA: "E", GAG: "E", GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};

// ── the sequence module (re-earned): parse by position, verify, strand ───────
const reverseComplement = (s) =>
  [...s].reverse().map((b) => ({ A: "T", T: "A", C: "G", G: "C" }[b])).join("");

const sequenceModule = (gbPath, faPath) => {
  const gb = readFileSync(gbPath, "utf8");
  const fa = readFileSync(faPath, "utf8");

  const loc = gb.match(/LOCUS\s+(\S+)\s+(\d+)\s+bp/);
  const locusLength = Number(loc[2]);

  const cds = [];
  const lines = gb.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^     CDS\s+(.+)$/);
    if (!m) continue;
    let start, end, strand;
    const locText = m[1];
    if (locText.startsWith("complement(")) {
      strand = -1;
      const [a, b] = locText.slice(11, -1).split("..").map(Number);
      start = a; end = b;
    } else {
      strand = 1;
      const [a, b] = locText.split("..").map(Number);
      start = a; end = b;
    }
    let translation = "";
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (/^     \S/.test(l)) break; // the next feature block starts at column 5
      if (l.length > 0 && !l.startsWith(" ")) break; // a top-level line (CONTIG, //, ORIGIN)
      const raw = l.trim();
      if (raw.startsWith("/translation=")) {
        // first line: everything after the opening quote (may or may not close)
        translation += raw.slice("/translation=\"".length).replace(/"/g, "");
      } else if (/^[A-Z*]+"?$/.test(raw)) {
        // continuation lines: bare amino acids, the last one carries the closing quote
        translation += raw.replace(/"/g, "");
      }
    }
    cds.push({ start, end, strand, translation });
  }

  const seq = fa
    .split("\n")
    .filter((l) => !l.startsWith(">"))
    .join("")
    .trim();
  if (seq.length !== locusLength)
    throw new Error(`length mismatch: LOCUS says ${locusLength}, FASTA has ${seq.length}`);

  const coding = cds.map((f) => {
    let s = seq.slice(f.start - 1, f.end);
    if (f.strand === -1) s = reverseComplement(s);
    return { ...f, sense: s };
  });

  const covered = new Set();
  for (const f of cds) for (let p = f.start; p <= f.end; p++) covered.add(p);
  const intergenic = [...seq].filter((_, i) => !covered.has(i + 1)).join("");

  return { seq, length: seq.length, cds: coding, intergenic, coveredCount: covered.size };
};

const translate = (dna) => {
  let aa = "";
  for (let i = 0; i + 3 <= dna.length; i += 3) {
    const c = CODON[dna.slice(i, i + 3)];
    if (c == null || c === "*") break; // the record's /translation stops before the terminal stop
    aa += c;
  }
  return "M" + aa.slice(1); // GTG→Met start convention, named, not hidden
};

// The classic period-3 measure, O(n), no FFT needed: for each base's indicator
// series, sum the indicator over the three codon phases; the period-3 power is
// how far those three phase-sums depart from the equal split. This is the
// discrete form of |DFT(bin n/3)|² — the famous gene-finding signal.
const period3 = (dna) => {
  const bases = ["A", "C", "G", "T"];
  let signal = 0;
  for (const b of bases) {
    const s = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < dna.length; i++) { if (dna[i] === b) { s[i % 3]++; n++; } }
    if (n === 0) continue;
    const expect = n / 3;
    signal += (s[0] - expect) ** 2 + (s[1] - expect) ** 2 + (s[2] - expect) ** 2;
  }
  return signal; // departures of the phase-sums from equal, summed over bases
};

const gcByPhase = (dna) => {
  const g = [0, 0, 0], c = [0, 0, 0], tot = [0, 0, 0];
  for (let i = 0; i < dna.length; i++) {
    const p = i % 3;
    tot[p]++;
    if (dna[i] === "G") g[p]++;
    if (dna[i] === "C") c[p]++;
  }
  return tot.map((t, p) => ((g[p] + c[p]) / t) * 100);
};

// ── engine reads ─────────────────────────────────────────────────────────────
const readFigure = (material, order, { draws = DRAWS, window = WINDOW } = {}) => {
  const series = [...material].map((b) => order[b]);
  const g = ground({ material: series, draws, window, statistic: "permutationEntropy", seed: SEED });
  if (isGap(g)) return { gap: g };
  const observed = permutationEntropy(series, { window });
  const v = verdict(observed, g);
  // verdict() flattens the censoring direction away (it keeps observed/support/
  // volume); the direction the pitch's "censoring direction recorded" requires
  // lives one level down, at difference(). Asked for directly, named as such.
  const fig = difference(observed, g);
  const direction = isGap(fig) && fig.direction ? fig.direction : null;
  return { ...v, direction, extent: series.length };
};

const splitWindows = (material, n) => {
  const out = [];
  for (let i = 0; i + n <= material.length; i += n) out.push(material.slice(i, i + n));
  return out;
};

// ── the run ──────────────────────────────────────────────────────────────────
const mod = sequenceModule(GB, FA);
const { seq, length, cds, intergenic } = mod;
const codingPool = cds.map((c) => c.sense).join("");

console.log(`SEQUENCE MODULE — ${GB.split("/").pop()} / ${FA.split("/").pop()}`);
console.log(`  LOCUS length ${length} bp, FASTA ${length} bp — MATCH`);
console.log(`  CDS features ${cds.length}: ${cds.map((c) => `${c.start}..${c.end}${c.strand === -1 ? "(c)" : ""}`).join("  ")}`);
console.log(`  coding (unique CDS bases) ${mod.coveredCount} bp, intergenic ${intergenic.length} bp`);
console.log(`declared: draws ${DRAWS}, window ${WINDOW}, windowed material ${WIN_SIZE} bp, seed ${SEED}`);

// 1. translation validation against the record's own proteins
let translatedOk = 0;
console.log("\nCHECK 1 — TRANSLATION (known answer: the record's own /translation):");
for (const c of cds) {
  const mine = translate(c.sense);
  const ok = mine === c.translation;
  if (ok) translatedOk++;
  console.log(`  [${ok ? "exact" : "MISMATCH"}] ${c.start}..${c.end}${c.strand === -1 ? "(c)" : ""}  ${mine.slice(0, 20)}…`);
}
console.log(`  ${translatedOk}/${cds.length} CDS translate exactly to the record's own proteins`);

// 2. period-3 ground truth, verified directly and transparently
const p3coding = period3(codingPool);
const p3inter = period3(intergenic);
const gcpCoding = gcByPhase(codingPool);
const gcpInter = gcByPhase(intergenic);
console.log("\nCHECK 2 — PERIOD-3 GROUND TRUTH (the famous gene-finding signal, measured directly):");
console.log(`  phase-sum period-3 measure:  coding ${p3coding.toFixed(1)}   intergenic ${p3inter.toFixed(1)}   (ratio ${(p3coding / Math.max(p3inter, 1)).toFixed(1)}×)`);
console.log(`  G+C% per codon phase:        coding ${gcpCoding.map((x) => x.toFixed(1)).join(" / ")}   intergenic ${gcpInter.map((x) => x.toFixed(1)).join(" / ")}`);

// 3. the windowed attempt — per-window ground over the window's own material
console.log("\nENGINE, WINDOWED (150 bp) — per-window ground over the window's own material:");
const tallyReads = (pool, order) => {
  const tally = {};
  let below = 0, above = 0;
  for (const win of splitWindows(pool, WIN_SIZE)) {
    const r = readFigure(win, order);
    const key = r.gap ? `void:${r.gap.gap}` : r.verdict;
    tally[key] = (tally[key] ?? 0) + 1;
    if (!r.gap && r.verdict === "contested" && r.direction === "below") below++;
    if (!r.gap && r.verdict === "contested" && r.direction === "above") above++;
  }
  const n = Object.values(tally).reduce((a, b) => a + b, 0);
  return { n, line: Object.entries(tally).map(([k, v]) => `${k} ${v}`).join("  "), below, above };
};
for (const [orderName, order] of Object.entries(BASE_ORDERS)) {
  for (const [name, pool] of [["coding", codingPool], ["intergenic", intergenic]]) {
    const r = tallyReads(pool, order);
    console.log(`  ${orderName.padEnd(16)} ${name.padEnd(11)} ${String(r.n).padStart(3)} windows  ${r.line}`);
    console.log(`      censored below ${r.below} / censored above ${r.above} (the finding would be below: regularity)`);
  }
}

// 4. the pooled test — all of one class as one material, one ground, full power
console.log("\nENGINE, POOLED — the whole class as one material, one ground, full power:");
for (const [orderName, order] of Object.entries(BASE_ORDERS)) {
  for (const [name, pool] of [["coding", codingPool], ["intergenic", intergenic]]) {
    const r = readFigure(pool, order);
    if (r.gap) { console.log(`  ${orderName.padEnd(16)} ${name.padEnd(11)} ${r.gap.gap}`); continue; }
    const where = r.direction
      ? ` CENSORED ${r.direction.toUpperCase()} (${r.direction === "below" ? "regularity — the finding the pitch predicts" : "surfeit — the opposite of the prediction"})`
      : ` rank ${r.rank.toFixed(4)} (${r.rank < 0.1 ? "tail-contested, inside support" : r.rank > 0.9 ? "tail-contested, inside support" : "inside support, supported"})`;
    console.log(
      `  ${orderName.padEnd(16)} ${name.padEnd(11)} ${r.verdict}  obs ${r.observed.toFixed(5)}  null support [${r.support[0].toFixed(5)}, ${r.support[1].toFixed(5)}]${where}`,
    );
  }
}

// 4.5 the mean statistics, pooled — blind by construction or not?
console.log("\nENGINE, POOLED, MEAN STATISTICS — can burstiness/windowMean see the phase signal?");
const meanOrder = BASE_ORDERS["A=1 C=2 G=3 T=4"];
for (const [name, pool] of [["coding", codingPool], ["intergenic", intergenic]]) {
  for (const statistic of ["burstiness", "windowMean"]) {
    const series = [...pool].map((b) => meanOrder[b]);
    const g = ground({ material: series, draws: DRAWS, window: 3, statistic, seed: SEED });
    if (isGap(g)) { console.log(`  ${name.padEnd(11)} ${statistic.padEnd(12)} ${g.gap}`); continue; }
    const stat = statistic === "burstiness" ? burstiness : windowMean;
    const observed = stat(series, { window: 3 });
    const v = verdict(observed, g);
    const where = v.rank == null ? ` censored` : ` rank:${v.rank.toFixed(4)}`;
    console.log(`  ${name.padEnd(11)} ${statistic.padEnd(12)} ${v.verdict}${where}`);
  }
}

// 5. mechanism: the empirical ordinal-pattern distributions, real vs shuffled
const patternDist = (dna, order) => {
  const counts = new Map();
  const series = [...dna].map((b) => order[b]);
  const idx = [0, 1, 2];
  for (let t = 0; t + 3 <= series.length; t++) {
    const s = idx.map((k) => k).slice();
    const key = s.sort((a, b) => series[t + a] - series[t + b] || a - b).join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};
const dist = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
const seededShuffle = (arr, seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
console.log("\nMECHANISM — why the ordinal lens reads these materials the way it does (real vs one seeded shuffle):");
const order = BASE_ORDERS["A=1 C=2 G=3 T=4"];
for (const [name, pool] of [["coding", codingPool], ["intergenic", intergenic]]) {
  const real = dist(patternDist(pool, order));
  const shuffled = dist(patternDist(seededShuffle([...pool], 7), order));
  const top = (d) => d.slice(0, 3).map(([k, v]) => `${k}:${(v / pool.length * 100).toFixed(1)}%`).join("  ");
  console.log(`  ${name.padEnd(11)} real top-3 patterns      ${top(real)}`);
  console.log(`  ${name.padEnd(11)} one shuffle top-3        ${top(shuffled)}`);
}

// 6. the reproducibility bundle (the export): the retained ground spec
console.log("\nREPRODUCIBILITY BUNDLE (rebuild the same ground from this spec, never from kept samples):");
const specMaterial = [...codingPool].map((b) => order[b]);
const specGround = ground({ material: specMaterial, draws: DRAWS, window: WINDOW, statistic: "permutationEntropy", seed: SEED });
console.log(`  ${JSON.stringify(specGround.spec)}`);
console.log(`  extent ${specGround.extent} bp, fingerprint from=${specGround.from}`);

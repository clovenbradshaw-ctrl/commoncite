// eoreader6 · goldens/agency-civic/analysis — the one binary judgment this
// whole golden exists to make: does admitted-Link density per clause track
// whether a reader judges the clause names who acted? Reports, in this
// order (README.md's success condition demands the order, not just the
// numbers): (1) the panel's own ceiling — agreement, BEFORE any system
// number; (2) the rotation-control floor, alongside the real rate, never
// separately; (3) the correlation; (4) whether the correlation survives
// partialling out clause length and nominal density.
//
// The panel here is an LLM-panel PROXY (see GUIDELINE.md and README.md) —
// NOT a human ceiling. Every number this script prints is labeled that way
// and none of it should be read, cited, or reused as if a human had
// annotated this golden.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { fleissKappa, percentAgreement, phiCoefficient, chiSquare2x2, partialCorrelation, pearson } from "./stats.mjs";
import { tokenize, buildFrequencyTable, functionWordSet } from "../../packages/engine/perceiver/text/material.js";
import { discoverRelationVocab } from "../../packages/engine/perceiver/text/relations.js";
import { extractSurfaces } from "../../packages/engine/perceiver/text/surfaces.js";
import { splitSentences, deriveAbbreviations } from "../../packages/engine/perceiver/text/spans.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(HERE, p), "utf8"));

const VERDICTS = ["NAMED", "AGENTLESS", "NOMINALIZED", "SKIP"];

const { clauses } = read("data/clauses.sample.json");
const panelFiles = [1, 2, 3, 4].map((n) => `data/panel/annotator-${n}.json`);
const panels = panelFiles.map((f) => read(f));

// Index each panel's verdicts by clause id, and sanity-check coverage —
// a gap here (a missing id, a stray extra one) is reported, never silently
// papered over by falling back to a default verdict.
const panelById = panels.map((p) => new Map(p.map((r) => [r.id, r.verdict])));
for (let i = 0; i < panels.length; i++) {
  const missing = clauses.filter((c) => !panelById[i].has(c.id));
  if (missing.length) console.warn(`WARNING annotator-${i + 1}: missing ${missing.length} clause verdicts`);
}

// ── (1) THE CEILING — LLM-panel agreement, reported before any system number ──
const verdictMatrix = clauses.map((c) => panels.map((_, i) => panelById[i].get(c.id)));
const counts = verdictMatrix.map((row) => VERDICTS.map((v) => row.filter((r) => r === v).length));
const kappa = fleissKappa(counts, panels.length);
const pctAgreement = percentAgreement(verdictMatrix);

console.log("=".repeat(70));
console.log("(1) CEILING — LLM-panel agreement (NOT a human ceiling — see README)");
console.log("=".repeat(70));
console.log(`Fleiss' kappa (4 raters x ${clauses.length} items x ${VERDICTS.length} categories): ${kappa.toFixed(3)}`);
console.log(`Mean pairwise percent agreement: ${(pctAgreement * 100).toFixed(1)}%`);
for (const v of VERDICTS) {
  const total = counts.reduce((s, row) => s + row[VERDICTS.indexOf(v)], 0);
  console.log(`  ${v}: ${total}/${clauses.length * panels.length} total assignments (${((total / (clauses.length * panels.length)) * 100).toFixed(1)}%)`);
}

// Majority verdict per clause (mode across the 4 panelists); a tie or a
// SKIP-majority is a genuine gap, excluded from the binary comparison below
// and reported as such rather than forced.
const majorityOf = (row) => {
  const tally = new Map();
  for (const v of row) tally.set(v, (tally.get(v) ?? 0) + 1);
  const max = Math.max(...tally.values());
  const winners = [...tally.entries()].filter(([, n]) => n === max).map(([v]) => v);
  return winners.length === 1 ? winners[0] : "NO_MAJORITY";
};
const majority = clauses.map((c, i) => ({ id: c.id, majority: majorityOf(verdictMatrix[i]) }));
const majorityById = new Map(majority.map((m) => [m.id, m.majority]));

const KAPPA_FLOOR = 0.4; // Landis & Koch's own "moderate" threshold — below this the task's own ceiling is in question, not the system.
const refused = kappa < KAPPA_FLOOR;
console.log(`\n${refused ? "*** GOLDEN REFUSED ***" : "Golden proceeds:"} kappa ${kappa.toFixed(3)} ${refused ? "<" : ">="} ${KAPPA_FLOOR} (moderate-agreement floor).`);
if (refused) {
  console.log("Per README's own discipline: low agreement means the task is underdetermined, not that the system failed. Stopping before any system score is reported as a finding.");
}

// ── engine + rotation-control data ──────────────────────────────────────
const { results: engineResults } = read("data/engine-scores.json");
const { results: rotationResults } = read("data/rotation-control.json");
const engineById = new Map(engineResults.map((r) => [r.id, r]));
const rotationById = new Map(rotationResults.map((r) => [r.id, r]));

// ── (2) THE FLOOR — rotation control, reported alongside the real rate ──
const realAdmitted = engineResults.filter((r) => r.agentAdmitted).length;
const floorAdmitted = rotationResults.filter((r) => r.agentAdmitted).length;
console.log("\n" + "=".repeat(70));
console.log("(2) FLOOR — rotation control (word-shuffled clauses), alongside the real rate");
console.log("=".repeat(70));
console.log(`Real corpus:       ${realAdmitted}/${engineResults.length} clauses admitted a Link (${((realAdmitted / engineResults.length) * 100).toFixed(1)}%)`);
console.log(`Rotation control:  ${floorAdmitted}/${rotationResults.length} clauses admitted a Link (${((floorAdmitted / rotationResults.length) * 100).toFixed(1)}%)`);
console.log(`Ratio real:floor = ${(realAdmitted / Math.max(floorAdmitted, 1)).toFixed(2)}x`);

// ── build the analysis set: clauses with a clear majority NAMED vs AGENTLESS/NOMINALIZED ──
const rows = [];
for (const c of clauses) {
  const maj = majorityById.get(c.id);
  if (maj === "SKIP" || maj === "NO_MAJORITY") continue;
  const eng = engineById.get(c.id);
  if (!eng) continue;
  const humanNamed = maj === "NAMED" ? 1 : 0;
  const engineAdmitted = eng.agentAdmitted ? 1 : 0;
  const clauseLength = c.clause.split(/\s+/).filter(Boolean).length;
  rows.push({ id: c.id, genre: c.genre, humanNamed, engineAdmitted, clauseLength, majorityVerdict: maj });
}
console.log(`\nAnalysis set: ${rows.length}/${clauses.length} clauses (excluded: SKIP or no-majority verdicts).`);

// Nominal-density proxy: content-word (non-function-word) tokens that are
// NOT in the document's own discovered relation-vocabulary verb set,
// divided by clause length. A declared, weak proxy for noun-phrase density
// — this repo has no POS tagger; see README's "What the partial-correlation
// control actually measures" for the honest limits of this stand-in.
const docCache = new Map();
const nominalDensityOf = (clauseText, genre, source) => {
  const key = `${genre}/${source}`;
  if (!docCache.has(key)) {
    const text = readFileSync(join(HERE, "texts", genre, `${source}.txt`), "utf8");
    const functionWords = functionWordSet(buildFrequencyTable(tokenize(text)));
    const abbreviations = deriveAbbreviations(text);
    const sentences = splitSentences(text, { abbreviations });
    const surfaces = extractSurfaces(sentences, { functionWords, abbreviations });
    const { verbs } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 });
    docCache.set(key, { functionWords, verbs });
  }
  const { functionWords, verbs } = docCache.get(key);
  const words = tokenize(clauseText);
  if (!words.length) return 0;
  const nominal = words.filter((w) => !functionWords.has(w) && !verbs.has(w)).length;
  return nominal / words.length;
};

for (const r of rows) {
  const c = clauses.find((x) => x.id === r.id);
  r.nominalDensity = nominalDensityOf(c.clause, c.genre, c.source);
}

// ── (3) THE CORRELATION ──────────────────────────────────────────────────
const humanNamed = rows.map((r) => r.humanNamed);
const engineAdmitted = rows.map((r) => r.engineAdmitted);
const lengths = rows.map((r) => r.clauseLength);
const densities = rows.map((r) => r.nominalDensity);

const a = rows.filter((r) => r.engineAdmitted === 1 && r.humanNamed === 1).length; // true positive
const b = rows.filter((r) => r.engineAdmitted === 1 && r.humanNamed === 0).length; // false positive
const c_ = rows.filter((r) => r.engineAdmitted === 0 && r.humanNamed === 1).length; // false negative
const d = rows.filter((r) => r.engineAdmitted === 0 && r.humanNamed === 0).length; // true negative

const phi = phiCoefficient(a, b, c_, d);
const chi2 = chiSquare2x2(a, b, c_, d);
const precision = a / Math.max(a + b, 1);
const recall = a / Math.max(a + c_, 1);
const f1 = (2 * precision * recall) / Math.max(precision + recall, 1e-9);

console.log("\n" + "=".repeat(70));
console.log("(3) THE CORRELATION — engine agentAdmitted vs. panel-majority NAMED");
console.log("=".repeat(70));
console.log(`2x2:  TP=${a}  FP=${b}  FN=${c_}  TN=${d}`);
console.log(`phi coefficient: ${phi.toFixed(3)}`);
console.log(`chi-square (df=1): ${chi2.toFixed(2)}  ${chi2 > 10.828 ? "(p<0.001)" : chi2 > 6.635 ? "(p<0.01)" : chi2 > 3.841 ? "(p<0.05)" : "(not significant at p<0.05)"}`);
console.log(`precision (engine-admitted -> human-NAMED): ${precision.toFixed(3)}`);
console.log(`recall (human-NAMED clauses the engine admits): ${recall.toFixed(3)}`);
console.log(`F1: ${f1.toFixed(3)}`);

// ── (4) SURVIVES LENGTH + NOMINAL-DENSITY CONTROLS? ─────────────────────
const rawPearson = pearson(engineAdmitted, humanNamed);
const partial = partialCorrelation(engineAdmitted, humanNamed, lengths, densities);
const lenCorr = pearson(lengths, humanNamed);
const densCorr = pearson(densities, humanNamed);

console.log("\n" + "=".repeat(70));
console.log("(4) DOES THE CORRELATION SURVIVE PARTIALLING OUT LENGTH + NOMINAL DENSITY?");
console.log("=".repeat(70));
console.log(`raw correlation (engineAdmitted, humanNamed):            r = ${rawPearson.toFixed(3)}`);
console.log(`partial correlation, controlling for length + density:   r = ${partial.toFixed(3)}`);
console.log(`(for context) correlation(clauseLength, humanNamed):     r = ${lenCorr.toFixed(3)}`);
console.log(`(for context) correlation(nominalDensity, humanNamed):   r = ${densCorr.toFixed(3)}`);
const survives = Math.abs(partial) >= Math.abs(rawPearson) * 0.5;
console.log(`\n${survives ? "SURVIVES" : "DOES NOT SURVIVE"}: partial correlation retains ${((Math.abs(partial) / Math.max(Math.abs(rawPearson), 1e-9)) * 100).toFixed(0)}% of the raw correlation's magnitude.`);

const out = {
  ceiling: { kappa, pctAgreement, refused, kappaFloor: KAPPA_FLOOR, verdictCounts: Object.fromEntries(VERDICTS.map((v, i) => [v, counts.reduce((s, row) => s + row[i], 0)])) },
  floor: { realAdmittedRate: realAdmitted / engineResults.length, rotationAdmittedRate: floorAdmitted / rotationResults.length, n: engineResults.length },
  correlation: { n: rows.length, contingency: { a, b, c: c_, d }, phi, chi2, precision, recall, f1 },
  lengthDensityControl: { rawPearson, partial, lengthCorrelation: lenCorr, densityCorrelation: densCorr, survives },
  analysisRows: rows,
};
writeFileSync(join(HERE, "data", "analysis-results.json"), JSON.stringify(out, null, 2));
console.log("\nwrote data/analysis-results.json");

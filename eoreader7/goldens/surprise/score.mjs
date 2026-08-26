// eoreader6 · goldens/surprise/score — runs every fixture through its
// declared axis and reports what actually happened. No expected verdict is
// asserted here; this script PRODUCES the verdicts that fixtures.json's
// README locks in as a regression baseline, on the discipline that a claim
// about what code does must come from running it.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { numericVerdict, temporalVerdict, rowFormVerdict, scriptProfileVerdict, ngramProfileVerdict, benfordVerdict, recurrenceVerdict, projectionVerdict } from "./detectors.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(readFileSync(join(HERE, "fixtures.json"), "utf8"));

const runOne = (c) => {
  switch (c.axis) {
    case "numeric": return numericVerdict(c.series);
    case "temporal": return temporalVerdict(c.series);
    case "rowForm": return rowFormVerdict(c.rows);
    case "scriptProfile": return scriptProfileVerdict(c.paragraphs);
    case "ngramProfile": return ngramProfileVerdict(c.paragraphs);
    case "benford": return benfordVerdict(c.suspectCounts);
    case "recurrence": return recurrenceVerdict(c.tokens);
    // Run WITHOUT a lexicon by default — this is the case's default axis
    // result, and matches `observed` in fixtures.json. score.test.mjs
    // separately exercises the with-lexicon branch, since that one needs a
    // received prior explicitly supplied, not silently assumed.
    case "projection": return projectionVerdict(c.rows);
    default: return { verdict: "n/a" };
  }
};

console.log(`${FIXTURES.cases.length} cases\n`);
const tally = {};
for (const c of FIXTURES.cases) {
  const r = runOne(c);
  tally[c.tier] = (tally[c.tier] ?? 0) + 1;
  const flagged = r.verdict !== "none" && r.verdict !== "n/a" && r.verdict !== "gap";
  console.log(
    `${c.id.padEnd(7)} tier=${c.tier.padEnd(15)} axis=${(c.axis ?? "-").padEnd(13)} ` +
    `verdict=${String(r.verdict).padEnd(9)} ${flagged ? "FLAGGED" : ""}`
  );
  if (c.axis === "numeric" && (r.at !== undefined || r.highAt !== undefined)) {
    console.log(`        ${JSON.stringify({ at: r.at ?? r.highAt ?? r.lowAt, value: r.value, highRank: r.highRank, lowRank: r.lowRank })}`);
  }
  if (c.axis === "rowForm" && r.outliers) console.log(`        outlier rows: ${r.outliers.map((o) => o.row).join(",")}`);
  if (c.axis === "scriptProfile") console.log(`        majority=${r.majorityScript} switches=${JSON.stringify(r.switches?.filter((s) => s.switched).map((s) => s.row))}`);
  if (c.axis === "benford") console.log(`        observed chi-sq=${r.observed?.toFixed(2)} rank=${r.rank}`);
  if (c.axis === "recurrence" && r.repeats.length) console.log(`        repeats: ${JSON.stringify(r.repeats)}`);
  if (c.axis === "temporal") console.log(`        arrowed=${r.arrowed}`);
}
console.log("\nby tier:", tally);

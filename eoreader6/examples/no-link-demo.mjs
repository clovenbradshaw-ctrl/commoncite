// examples/no-link-demo.mjs — the gate refuses a pair without direction.

import { detectCoArrivals, buildLink } from "../packages/engine/emergence/binding.js";

// Two entities that co-arrive but have no temporal asymmetry.
// Same arrival times — TE is symmetric, reversal null high.
const entities = [
  { id: "anna",    arrivals: [0, 5, 10, 15, 20] },
  { id: "boris",   arrivals: [0, 5, 10, 15, 20] },
  { id: "charlie", arrivals: [50, 55, 60] },
];

const totalUnits = 70;
const window = 2;
const draws = 199;
const seed = 20260803;

const pairs = detectCoArrivals(entities, { window });
console.log(`Detected ${pairs.length} co-arriving pair(s):\n`);

for (const p of pairs) {
  const link = buildLink(p, { totalUnits, draws, seed });
  const gate = link.direction ? "✓ WITNESSED" : "○ REFUSED — no direction";
  console.log(`  ${link.a.id} ↔ ${link.b.id}`);
  console.log(`    overlap:      ${link.overlap}`);
  console.log(`    direction:    ${link.direction ?? "null"}`);
  console.log(`    polarity:     ${link.polarity ?? "null"}`);
  console.log(`    strength:     ${link.strength.toFixed(4)}`);
  console.log(`    displacement: p=${link.nulls.displacement.pValue.toFixed(4)}`);
  console.log(`    reversal:     p=${link.nulls.reversal.pValue.toFixed(4)}`);
  console.log(`    reseed:       p=${link.nulls.reseed.pValue.toFixed(4)}`);
  console.log(`    gate:         ${gate}`);
  console.log();
}

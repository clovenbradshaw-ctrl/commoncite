// examples/binding-demo.mjs — the modality-blind mouth in action.
//
// Simulates an entity register (as carryEntities would produce) and
// runs the full A1→A5 pipeline: co-arrival, displacement null,
// transfer entropy, reversal null, reseed null, direction + polarity,
// graph wiring.

import { detectCoArrivals, displacementNull, transferEntropy, reversalNull, reseedNull, buildLink, bindingTriples } from "../packages/engine/emergence/binding.js";
import { createGraph, readTriples, structuralKey } from "../packages/engine/emergence/graph.js";

// ── the entity register ─────────────────────────────────────────────────────

// Victor and the creature appear together frequently — a genuine binding.
// Elizabeth appears alone — no link to either.

const entities = [
  {
    id: "victor",
    arrivals: [0, 3, 7, 12, 15, 20, 25, 30],
  },
  {
    id: "creature",
    arrivals: [1, 4, 8, 13, 16, 21, 26, 31],
  },
  {
    id: "elizabeth",
    arrivals: [50, 55, 60, 65, 70],
  },
];

const totalUnits = 80;
const window = 2;       // co-arrival window: 2 units
const draws = 199;      // null draws
const seed = 20260803;

// ── A2: co-arrival detection ────────────────────────────────────────────────

console.log("═══ A2: CO-ARRIVAL ═══\n");

const pairs = detectCoArrivals(entities, { window });
console.log(`Detected ${pairs.length} co-arriving pair(s):\n`);
for (const p of pairs) {
  console.log(`  ${p.a.id} ↔ ${p.b.id}  (overlap: ${p.overlap})`);
}

// ── A2: displacement null ───────────────────────────────────────────────────

console.log("\n═══ A2: DISPLACEMENT NULL ═══\n");

for (const p of pairs) {
  const d = displacementNull(p.aArrivals, p.bArrivals, { window, draws, seed });
  const verdict = d.pValue < 0.05 ? "✓ ABOVE CHANCE" : "○ within null";
  console.log(`  ${p.a.id} ↔ ${p.b.id}`);
  console.log(`    observed overlap: ${d.observed}`);
  console.log(`    null p-value:    ${d.pValue.toFixed(4)}`);
  console.log(`    verdict:         ${verdict}`);
}

// ── A3: transfer entropy ────────────────────────────────────────────────────

console.log("\n═══ A3: TRANSFER ENTROPY ═══\n");

const indicator = (arrivals, length) => {
  const out = new Array(length).fill(0);
  for (const i of arrivals) if (i < length) out[i] = 1;
  return out;
};

for (const p of pairs) {
  const x = indicator(p.aArrivals, totalUnits);
  const y = indicator(p.bArrivals, totalUnits);
  const fwd = transferEntropy(x, y);
  const rev = transferEntropy(y, x);
  const asymmetry = fwd - rev;
  console.log(`  ${p.a.id} → ${p.b.id}  TE: ${fwd.toFixed(4)}`);
  console.log(`  ${p.b.id} → ${p.a.id}  TE: ${rev.toFixed(4)}`);
  console.log(`  asymmetry (fwd − rev): ${asymmetry.toFixed(4)}`);
  console.log();
}

// ── A3: reversal null ───────────────────────────────────────────────────────

console.log("═══ A3: REVERSAL NULL ═══\n");

for (const p of pairs) {
  const r = reversalNull(p.aArrivals, p.bArrivals, { totalUnits, draws, seed: seed + 7 });
  const verdict = r.pValue < 0.05 ? "✓ DIRECTIONAL" : "○ no asymmetry";
  console.log(`  ${p.a.id} ↔ ${p.b.id}`);
  console.log(`    observed asymmetry: ${r.observed.toFixed(4)}`);
  console.log(`    forward TE:         ${r.fwd.toFixed(4)}`);
  console.log(`    reverse TE:         ${r.rev.toFixed(4)}`);
  console.log(`    null p-value:       ${r.pValue.toFixed(4)}`);
  console.log(`    verdict:            ${verdict}`);
}

// ── A4: reseed null + full record ───────────────────────────────────────────

console.log("\n═══ A4: RESEED NULL + FULL RECORD ═══\n");

for (const p of pairs) {
  const link = buildLink(p, { totalUnits, draws, seed, labels: ["relates-to"] });
  const gate = link.direction ? "✓ WITNESSED" : "○ not witnessed";
  console.log(`  ${link.a.id} → ${link.b.id}`);
  console.log(`    polarity:     ${link.polarity ?? "null"}`);
  console.log(`    direction:    ${link.direction ?? "null"}`);
  console.log(`    strength:     ${link.strength.toFixed(4)}`);
  console.log(`    displacement: p=${link.nulls.displacement.pValue.toFixed(4)}`);
  console.log(`    reversal:     p=${link.nulls.reversal.pValue.toFixed(4)}`);
  console.log(`    reseed:       p=${link.nulls.reseed.pValue.toFixed(4)}`);
  console.log(`    labels:       [${link.labels.join(", ")}]`);
  console.log(`    arrivals:     a=[${link.arrivals.a}]`);
  console.log(`                  b=[${link.arrivals.b}]`);
  console.log(`    gate:         ${gate}`);
}

// ── A5: graph wiring ────────────────────────────────────────────────────────

console.log("\n═══ A5: GRAPH WIRING ═══\n");

const allLinks = entities.length >= 2
  ? (() => {
      const ps = detectCoArrivals(entities, { window });
      return ps.map((p, i) => buildLink(p, { totalUnits, draws, seed: seed + i * 13, labels: ["relates-to"] }));
    })()
  : [];

const triples = bindingTriples(allLinks);
console.log(`Binding triples produced: ${triples.length}`);
for (const t of triples) {
  console.log(`  ${t.subject} —[${t.verb}]→ ${t.object}  (polarity: ${t.polarity})`);
}

const graph = createGraph({ gamma: 1 - 1 / 12, pruneBelow: 1e-4 });
const out = readTriples(graph, triples, { structural: true });

console.log(`\nGraph state:`);
console.log(`  nodes:    ${out.nodes}`);
console.log(`  edges:    ${out.edges}`);
console.log(`  newEdges: ${out.newEdges}`);
console.log(`  belief:   ${out.belief?.toFixed(4) ?? "first frame"}`);

console.log(`\nAll edge keys:`);
for (const [k, w] of graph.edges) {
  console.log(`  ${k}  weight=${w.toFixed(2)}`);
}

console.log(`\nStructural keys (a|polarity|b, no verb):`);
for (const [k, w] of graph.edges) {
  if (k.includes("||") || k.includes("|!|")) {
    console.log(`  ${k}  weight=${w.toFixed(2)}`);
  }
}

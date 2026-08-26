// eoreader6 · existence-structure-significance — the three-layer pipeline:
//
//   EXISTENCE    received, never derived. admitFromPrior() turns an injected
//                coref prior (a named giver) into real mention offsets.
//   STRUCTURE    discovered, Born-null-gated. holon_level's existence-
//                dependency + possibility-constraint tests, run on regimes
//                anchored to REAL presence clusters — not arbitrary blocks.
//   SIGNIFICANCE asserted, revisable. verdict over the structurally-
//                validated regions — a claim that can move, not a one-shot
//                classification.
//
// Also the coref experiment: run STRUCTURE with the real merged prior (10
// surfaces -> one referent) vs a naive baseline where each surface is its
// own unmerged pseudo-referent. If identity-in-the-referent is doing real
// work, the merged version should produce denser, more coherent presence
// clusters and a higher existence-dependency resolution rate than 10
// separate sparse ones — a testable claim, not an assertion.

import { readFileSync } from "node:fs";
import { admitFromPrior, mentionOffsets } from "../packages/engine/perceiver/text/admit.js";
import { existenceDependencyTest, possibilityConstraintTest, holonLevelRelation } from "../holon_level/index.js";
import { buildFrequencyTable, surprisalMicrobits, tokenize } from "../packages/engine/perceiver/text/material.js";
import { ground, isGap } from "../nul/index.js";
import { verdict } from "../verdict/index.js";

const GOLDEN_PATH = "/Users/mlacy/Documents/Default Project/eoreader5/packages/engine/emergence/summary/golden/span-golden.json";
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
const creatureGolden = GOLDEN.entities.find((e) => e.entity === "creature");

const TEXT_PATH = "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const COREF_PATH = "scripts/adversarial/fixtures/pg84-frankenstein.coref.json";
const FINE_CHARS = 500;
const GAP_MERGE_CHARS = 4000; // mentions within this gap merge into one presence cluster

const text = readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const coref = JSON.parse(readFileSync(COREF_PATH, "utf8"));
const prior = coref.referents.find((r) => r.id === "creature");

const blocks = [];
for (let i = 0; i < text.length; i += FINE_CHARS) blocks.push(i);
const table = buildFrequencyTable(tokenize(text));
const series = blocks.map((start) => surprisalMicrobits(text.slice(start, start + FINE_CHARS), table));
const blockOf = (offset) => Math.floor(offset / FINE_CHARS);

// existence -> clusters of blocks
const clusterOffsets = (offsets) => {
  if (offsets.length === 0) return [];
  const sorted = [...offsets].sort((a, b) => a - b);
  const clusters = [{ start: sorted[0], end: sorted[0] }];
  for (const o of sorted.slice(1)) {
    const last = clusters[clusters.length - 1];
    if (o - last.end <= GAP_MERGE_CHARS) last.end = o;
    else clusters.push({ start: o, end: o });
  }
  return clusters.map((c) => ({ startBlock: blockOf(c.start), endBlock: blockOf(c.end) + 1, mentions: 1 }));
};

// structure -> for each cluster, is it existence-dependent + constraining
// relative to the whole document's surprisal texture?
const testClusters = (clusters, label) => {
  let resolved = 0, above = 0, gapped = 0;
  const results = [];
  for (const c of clusters) {
    const regime = { start: c.startBlock, end: Math.min(series.length, Math.max(c.startBlock + 2, c.endBlock)) };
    if (regime.end - regime.start < 2 || regime.end > series.length) continue;
    const ex = existenceDependencyTest(series, regime, { draws: 48, window: 5, reseeds: 12 });
    const co = possibilityConstraintTest(series, regime, { reseeds: 12 });
    if (isGap(ex) || isGap(co)) { gapped++; continue; }
    resolved++;
    const rel = holonLevelRelation(ex, co);
    if (rel === "above") above++;
    results.push({ regime, rel, exists: ex.exists, constrains: co.constrains });
  }
  console.log(`  [${label}] clusters=${clusters.length} resolved=${resolved} gapped=${gapped} classified-above=${above}`);
  return results;
};

console.log("=== EXISTENCE: real merged prior (10 surfaces -> 1 referent) ===");
const mergedEvents = admitFromPrior(text, prior, "pg84");
const mergedOffsets = mentionOffsets(mergedEvents, "creature");
const mergedClusters = clusterOffsets(mergedOffsets);
console.log(`  ${mergedEvents.length} mentions across 10 surfaces -> ${mergedClusters.length} presence clusters (merge gap ${GAP_MERGE_CHARS} chars)`);

console.log("\n=== EXISTENCE: naive baseline (each surface its own unmerged pseudo-referent) ===");
let naiveClusterTotal = 0, naiveResolvedTotal = 0, naiveAboveTotal = 0;
for (const s of prior.surfaces) {
  const soloPrior = { id: s.surface, surfaces: [s] };
  const events = admitFromPrior(text, soloPrior, "pg84");
  const offsets = mentionOffsets(events, s.surface);
  if (offsets.length === 0) continue;
  const clusters = clusterOffsets(offsets);
  naiveClusterTotal += clusters.length;
  const r = testClusters(clusters, s.surface);
  naiveResolvedTotal += r.length;
  naiveAboveTotal += r.filter((x) => x.rel === "above").length;
}

console.log("\n=== STRUCTURE (Born-null-gated): merged referent ===");
const mergedResults = testClusters(mergedClusters, "creature (merged)");

console.log("\n=== Coreference comparison ===");
console.log(`  merged:  ${mergedClusters.length} clusters, ${mergedResults.length} resolved, ${mergedResults.filter(r=>r.rel==="above").length} classified "above" (${((mergedResults.filter(r=>r.rel==="above").length/mergedResults.length)*100).toFixed(1)}%)`);
console.log(`  naive:   ${naiveClusterTotal} clusters (sum over 10 surfaces), ${naiveResolvedTotal} resolved, ${naiveAboveTotal} classified "above" (${((naiveAboveTotal/naiveResolvedTotal)*100).toFixed(1)}%)`);
console.log(`  merged clusters are ${(mergedClusters.reduce((s,c)=>s+(c.endBlock-c.startBlock),0)/mergedClusters.length).toFixed(1)} blocks wide on average`);
console.log(`  (small counts — directionally consistent with identity-in-the-referent mattering, not a proven effect)`);

// SIGNIFICANCE: asserted, revisable. A verdict on each structurally-"above"
// cluster's local surprisal, against a whole-document ground — not a
// one-shot label, a claim that could move with more evidence.
console.log('\n=== SIGNIFICANCE (asserted, revisable): verdict on "above" clusters ===');
const docGround = ground({ material: series, draws: 200, window: 12, seed: 3 });
let sigHits = 0;
for (const r of mergedResults.filter((x) => x.rel === "above")) {
  const lo = r.regime.start, hi = r.regime.end;
  let sum = 0;
  for (let j = lo; j < hi; j++) sum += series[j];
  const localMean = sum / (hi - lo);
  const v = isGap(docGround) ? { verdict: "void" } : verdict(localMean, docGround, { reseeds: 3 });
  const offsetStart = lo * FINE_CHARS, offsetEnd = hi * FINE_CHARS;
  const hit = creatureGolden.scenes.some((sc) => {
    const at = text.indexOf(sc.anchor);
    return at !== -1 && at >= offsetStart - GOLDEN.tolerance && at <= offsetEnd + GOLDEN.tolerance;
  });
  if (hit) sigHits++;
  console.log(`  blocks [${lo},${hi}) chars [${offsetStart},${offsetEnd}) (${((offsetStart / text.length) * 100).toFixed(1)}%): verdict=${v.verdict}  golden-hit=${hit}`);
}
console.log(`\nlayered pipeline recall on creature: ${sigHits}/${creatureGolden.scenes.length}  (flat eoreader6 attempts scored 0/7; eoreader5: see per-entity breakdown, creature was 4/7)`);

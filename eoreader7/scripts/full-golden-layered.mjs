// eoreader6 · full-golden-layered — the existence/structure/significance
// pipeline (existence-structure-significance.mjs) run across all three
// golden entities, using each text's REAL injected coref prior:
//   - creature: eoPriors/priors/coref/pg84-frankenstein.json (emanon, full
//     surfaces array with scope/weight)
//   - Natasha, Pierre: eoreader5/priors/coref/war-and-peace.json (holon,
//     single `name` field — "name variants structural" per eoreader5's own
//     tier discipline, so a bare surface match is the right-tier operation)
//
// Reports the full recall against the frozen 21-scene golden, comparable
// directly to eoreader5's 5/21 and eoreader6's earlier flat attempts (0-1/21).

import { readFileSync } from "node:fs";
import { admitFromPrior, mentionOffsets } from "../packages/engine/perceiver/text/admit.js";
import { existenceDependencyTest, possibilityConstraintTest, holonLevelRelation } from "../holon_level/index.js";
import { buildFrequencyTable, surprisalMicrobits, tokenize } from "../packages/engine/perceiver/text/material.js";
import { ground, isGap } from "../nul/index.js";
import { verdict } from "../verdict/index.js";

const GOLDEN_PATH = "/Users/mlacy/Documents/Default Project/eoreader5/packages/engine/emergence/summary/golden/span-golden.json";
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
const FINE_CHARS = 500;
const GAP_MERGE_CHARS = 4000;

const TEXTS = {
  pg2600: "/Users/mlacy/Downloads/pg2600.txt",
  pg84: "scripts/adversarial/fixtures/pg84-frankenstein.txt",
};

const priorFor = (entityGoldenEntry) => {
  if (entityGoldenEntry.text === "pg84") {
    const coref = JSON.parse(readFileSync("scripts/adversarial/fixtures/pg84-frankenstein.coref.json", "utf8"));
    return coref.referents.find((r) => r.id === "creature");
  }
  const coref = JSON.parse(readFileSync("/Users/mlacy/Documents/Default Project/eoreader5/priors/coref/war-and-peace.json", "utf8"));
  const id = entityGoldenEntry.entity === "Natasha Rostova" ? "natasha" : "pierre";
  const raw = coref.referents.find((r) => r.id === id);
  // "holon" individuation: bare name is the whole surface set — structural
  // name matching, not descriptor-alias resolution. Received as given, not
  // expanded with variants the prior didn't declare.
  return { id: raw.id, surfaces: [{ surface: raw.name }] };
};

const runEntity = (entityGoldenEntry) => {
  const text = readFileSync(TEXTS[entityGoldenEntry.text], "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const table = buildFrequencyTable(tokenize(text));
  const blocks = [];
  for (let i = 0; i < text.length; i += FINE_CHARS) blocks.push(i);
  const series = blocks.map((start) => surprisalMicrobits(text.slice(start, start + FINE_CHARS), table));
  const blockOf = (offset) => Math.floor(offset / FINE_CHARS);

  const prior = priorFor(entityGoldenEntry);
  const events = admitFromPrior(text, prior, entityGoldenEntry.text);
  const offsets = mentionOffsets(events, prior.id);

  if (offsets.length === 0) return { hits: 0, total: entityGoldenEntry.scenes.length, mentions: 0, clusters: 0 };

  const sorted = [...offsets].sort((a, b) => a - b);
  const clusters = [{ start: sorted[0], end: sorted[0] }];
  for (const o of sorted.slice(1)) {
    const last = clusters[clusters.length - 1];
    if (o - last.end <= GAP_MERGE_CHARS) last.end = o;
    else clusters.push({ start: o, end: o });
  }
  const regimes = clusters.map((c) => ({ start: blockOf(c.start), end: Math.min(series.length, Math.max(blockOf(c.start) + 2, blockOf(c.end) + 1)) }));

  const above = [];
  for (const regime of regimes) {
    if (regime.end - regime.start < 2 || regime.end > series.length) continue;
    const ex = existenceDependencyTest(series, regime, { draws: 48, window: 5, reseeds: 12 });
    const co = possibilityConstraintTest(series, regime, { reseeds: 12 });
    if (isGap(ex) || isGap(co)) continue;
    if (holonLevelRelation(ex, co) === "above") above.push(regime);
  }

  const docGround = ground({ material: series, draws: 200, window: 12, seed: 3 });
  let hits = 0;
  const detail = [];
  for (const regime of above) {
    const offsetStart = regime.start * FINE_CHARS, offsetEnd = regime.end * FINE_CHARS;
    let sum = 0;
    for (let j = regime.start; j < regime.end; j++) sum += series[j];
    const localMean = sum / (regime.end - regime.start);
    const v = isGap(docGround) ? { verdict: "void" } : verdict(localMean, docGround, { reseeds: 3 });

    for (const sc of entityGoldenEntry.scenes) {
      const at = text.indexOf(sc.anchor);
      if (at === -1) continue;
      if (at >= offsetStart - GOLDEN.tolerance && at <= offsetEnd + GOLDEN.tolerance) {
        hits++;
        detail.push({ scene: sc.id, verdict: v.verdict });
      }
    }
  }

  return { hits: new Set(detail.map((d) => d.scene)).size, total: entityGoldenEntry.scenes.length, mentions: offsets.length, clusters: regimes.length, above: above.length, detail };
};

let totalHit = 0, totalScenes = 0;
for (const e of GOLDEN.entities) {
  const r = runEntity(e);
  totalHit += r.hits; totalScenes += r.total;
  console.log(`${e.entity}: ${r.hits}/${r.total}  (${r.mentions} mentions, ${r.clusters} clusters, ${r.above ?? 0} classified "above")`);
  for (const d of r.detail ?? []) console.log(`    hit: ${d.scene} (verdict=${d.verdict})`);
}
console.log(`\nTOTAL layered recall: ${totalHit}/${totalScenes}   (eoreader5: 5/21, eoreader6 flat: 0-1/21)`);

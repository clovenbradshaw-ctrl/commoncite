// scripts/import-genre-fold.mjs — the only place eoreader6 reads eoPriors.
//
// eoreader6 does not depend on eoPriors as code or as a package — there is
// no import, no submodule, no path alias. eoPriors is a sibling checkout on
// disk, and this script reads its lens-fold.json ONCE, at import time, and
// appends what it finds to a committed, append-only log under
// bin/priors/genre/ — event_log/index.js's own {events, tick} shape,
// replayed by the engine (packages/engine/emergence/genre-seed.js) and
// never re-fetched from eoPriors at runtime or test time. Nothing under
// packages/ or conformance/ reads ../eoPriors again; they read
// bin/priors/genre/*.json, exactly the way bin/priors/lang/en.json is read
// by the language-prior precedent (see bin/README.md).
//
// Only the per-cluster centroid, size and dominant-operator tally cross the
// boundary. Per-book file paths are dropped: the readiness gate
// (genre-seed.js::clusterReadiness) needs only the centroid, and bin/ is
// staged data with no source text in it by the same firewall
// eoPriors/docs/priors-component-spec.md declares on its own side ("A
// pocket can... never be quoted, cited, or surfaced as content").
//
// Run: node scripts/import-genre-fold.mjs [path-to-lens-fold.json]
//
// Re-running is safe and cumulative: an existing committed log is loaded
// and ticked forward, never overwritten from scratch, matching
// event_log/index.js's own append-only discipline.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createLog, tick } from "../event_log/index.js";
import { checkpointOf } from "../packages/engine/emergence/genre-seed.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = process.argv[2] ?? join(root, "..", "eoPriors", "priors", "lens-fold.json");

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
if (source.schema !== "LensFold@1")
  throw new Error(`import-genre-fold: expected schema LensFold@1, got ${source.schema ?? "(none)"}`);
if (!Array.isArray(source.clusters) || source.clusters.length === 0)
  throw new Error("import-genre-fold: source names no clusters — nothing to import");

const outDir = join(root, "bin", "priors", "genre");
const logPath = join(outDir, "lens-fold.json");
const checkpointDir = join(outDir, "checkpoints");

const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : createLog();

const giver = `eoPriors:${source.source ?? "lens-ledger.json"}@${source.fold_hash ?? source.version ?? "unversioned"}`;

for (const cluster of source.clusters) {
  if (!cluster.id || !cluster.centroid || !Number.isFinite(cluster.size)) {
    console.warn(`import-genre-fold: skipping a cluster missing id/centroid/size: ${JSON.stringify(cluster).slice(0, 80)}`);
    continue;
  }
  tick(log, {
    type: "genre-cluster-update",
    giver,
    cluster: {
      id: cluster.id,
      size: cluster.size,
      centroid: cluster.centroid,
      dominantOperators: cluster.dominantOperators ?? null,
      description: cluster.description ?? null,
    },
  });
}

mkdirSync(outDir, { recursive: true });
mkdirSync(checkpointDir, { recursive: true });
writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`);

const checkpoint = checkpointOf(log);
const checkpointPath = join(checkpointDir, `${checkpoint.tick}.json`);
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);

console.log(`import-genre-fold: wrote ${source.clusters.length} cluster(s) from ${sourcePath}`);
console.log(`import-genre-fold: log now at tick=${log.tick} — ${logPath}`);
console.log(`import-genre-fold: checkpoint written — ${checkpointPath}`);

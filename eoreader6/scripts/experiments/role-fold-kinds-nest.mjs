// eoreader6 · scripts/experiments/role-fold-kinds-nest — EXPERIMENTAL,
// unwired. Recursively re-runs induceKinds INSIDE each surviving kind's own
// members, on their FULL attribute profile (not just the one field that
// grouped them at the parent level) — the same question holon_level's
// height-discovery already asks at one grain, asked again one level down:
// does this cluster have real internal structure, or is it a leaf?
//
// Answers the "if they're all function words, that's useful" question
// properly: a kind that is a genuine mix (function words AND content words,
// as role-fold-kinds-v2's 109-member far_before cluster is) either
// decomposes into two children when re-clustered on its members' OTHER
// attributes (near_before/near_after/far_after/capitalized) — real
// sub-structure, a finding — or it doesn't, and the mix is real cohesion on
// SOME dimension humans haven't named yet, which is also a finding, not a
// failure to clean up.
//
// Usage: node scripts/experiments/role-fold-kinds-nest.mjs <experiment.json> [maxDepth]

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { induceKinds } from "../../packages/engine/emergence/kinds.js";
import { isGap } from "../../nul/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPERIMENT_PATH = process.argv[2];
const MAX_DEPTH = process.argv[3] ? Number(process.argv[3]) : 5;
const MIN_MEMBERS_TO_RECURSE = 8; // below this, a permutation null has nothing to work with

if (!EXPERIMENT_PATH) {
  console.error("usage: node role-fold-kinds-nest.mjs <experiment.json> [maxDepth]");
  process.exit(1);
}

const experiment = JSON.parse(readFileSync(EXPERIMENT_PATH, "utf8"));
const allRecords = experiment.records;
if (!allRecords) {
  console.error("experiment.json has no saved `records` — re-run role-fold-kinds-v2.mjs (now saves them) first.");
  process.exit(1);
}
const recordsById = new Map(allRecords.map((r) => [r.id, r]));

// Cheaper than the top-level pass by default — this is a shape-of-the-tree
// probe, not a certified per-node claim. Overridable the same way the
// top-level script is.
const PERMUTATIONS = Number(process.env.PERMUTATIONS ?? 80);
const RESEEDS = Number(process.env.RESEEDS ?? 10);

let nodeCount = 0;
const tree = [];

const recurse = (memberIds, path, depth) => {
  nodeCount++;
  const members = memberIds.map((id) => recordsById.get(id)).filter(Boolean);
  const node = { path: path.join(" > "), depth, size: members.length, labels: members.slice(0, 8).map((m) => m.label) };
  tree.push(node);

  if (depth >= MAX_DEPTH || members.length < MIN_MEMBERS_TO_RECURSE) {
    node.leaf = true;
    node.leafReason = depth >= MAX_DEPTH ? "max_depth" : "too_few_members";
    return;
  }

  const opts = {
    population: `${path.join("/")}`,
    minPrevalence: 0.1,
    minKindSize: 3,
    permutations: PERMUTATIONS,
    quantile: 0.9,
    reseeds: RESEEDS,
    seed: 42 + depth,
  };

  const t0 = Date.now();
  const kinds = induceKinds(members, opts);
  const ms = Date.now() - t0;
  console.log(`${"  ".repeat(depth)}${path[path.length - 1]} (${members.length} members) -> induceKinds ${ms}ms -> ${isGap(kinds) ? "gap" : kinds.length + " child kind(s)"}`);

  if (isGap(kinds) || kinds.length === 0) {
    node.leaf = true;
    node.leafReason = "no_child_kind_survived";
    return;
  }

  node.children = [];
  for (const k of kinds) {
    const childPath = [...path, `${k.label}(${k.height})`];
    node.children.push({ label: k.label, height: k.height, memberIds: k.members });
    recurse(k.members, childPath, depth + 1);
  }
};

console.log(`Recursing into ${experiment.kinds.length} top-level kind(s), max depth ${MAX_DEPTH}, min ${MIN_MEMBERS_TO_RECURSE} members to attempt a split\n`);

for (let i = 0; i < experiment.kinds.length; i++) {
  const k = experiment.kinds[i];
  recurse(k.members, [`root${i}:${k.label}(${k.height})`], 0);
}

console.log(`\n${nodeCount} nodes visited.\n`);

// ── report the tree ──────────────────────────────────────────────────────
const printTree = (node, indent = "") => {
  const tag = node.leaf ? `LEAF (${node.leafReason})` : `${node.children.length} children`;
  console.log(`${indent}[d${node.depth}] ${node.path.split(" > ").pop()} — ${node.size} members — ${tag}`);
  console.log(`${indent}    e.g. ${node.labels.join(", ")}`);
};

// Rebuild parent-child display order (tree[] is a flat visit-order list;
// walk it again matching on path prefix rather than storing pointers, since
// induceKinds's own kind objects are frozen and simplest kept immutable).
const roots = tree.filter((n) => n.depth === 0);
const childrenOf = (node) => tree.filter((n) => n.path.startsWith(node.path + " > ") && n.depth === node.depth + 1);
const walk = (node, indent) => {
  printTree(node, indent);
  for (const c of childrenOf(node)) walk(c, indent + "  ");
};
for (const r of roots) walk(r, "");

const outPath = EXPERIMENT_PATH.replace(/\.json$/, "") + ".nest.json";
writeFileSync(outPath, JSON.stringify({ maxDepth: MAX_DEPTH, minMembersToRecurse: MIN_MEMBERS_TO_RECURSE, permutations: PERMUTATIONS, reseeds: RESEEDS, nodeCount, tree }, null, 2));
console.log(`\nwrote ${outPath}`);

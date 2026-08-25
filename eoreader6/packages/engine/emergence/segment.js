// eoreader6 · emergence/segment — CUTTING THE ARENA at Link and Network grain.
//
// Three cells share this file:
//
//   SEG · Figure   Link · Dissecting     connected components in the graph
//   SEG · Pattern  Network · Unraveling  community detection in the graph
//   CON · Ground   Field · Tending       initial co-occurrence relating
//   SYN · Figure   Link · Making         composing new links from existing ones
//
// SEG·FIGURE. A connected component is a maximal subgraph where every node
// is reachable from every other. The cut is at Link grain: each component
// is a cluster of entities that are mutually reachable through the graph's
// edges. The component is the reach-unit at this grain — the natural
// partition the graph's own structure provides.
//
// SEG·PATTERN. Community detection finds subgraphs that are internally dense
// and externally sparse — more structure than connected components, which
// only test reachability. The algorithm is label propagation: each node
// adopts the majority label of its neighbours, iterating until stability.
// The result is a partition of the graph into communities. The partition
// is measured, never classified (CUBE.md).
//
// CON·GROUND. The initial relating step: which raw units co-occur within
// the same reach-unit (frame)? This is the ground-grain act of relating —
// before binding, before links, before structure. Co-occurrence pairs are
// the raw material that SEG and CON at higher grains organise.
//
// SYN·FIGURE. Composing new links from existing ones: transitive inference.
// If A → B and B → C share a verb and polarity, and A → C is not already
// believed, compose the transitive link. One hop, not a flood — the same
// discipline activation.js uses for recall.
//
// DECLARED NUMBERS. Every parameter is required — none is defaulted.

import { isGap, gap } from "../../../nul/index.js";

// The cells this organ occupies — declared, checked by conformance.
export const SEG_FIGURE_CELL = Object.freeze({ op: "SEG", grain: "Figure" });
export const SEG_PATTERN_CELL = Object.freeze({ op: "SEG", grain: "Pattern" });
export const CON_GROUND_CELL = Object.freeze({ op: "CON", grain: "Ground" });
export const SYN_FIGURE_CELL = Object.freeze({ op: "SYN", grain: "Figure" });

export const CELLS = Object.freeze([SEG_FIGURE_CELL, SEG_PATTERN_CELL, CON_GROUND_CELL, SYN_FIGURE_CELL]);

// ── SEG·Figure: connected components ────────────────────────────────────────

/**
 * Find connected components in a graph (undirected, ignoring edge polarity
 * and direction). Returns an array of components, each an array of node IDs.
 *
 * `nodes` is a Map from nodeId -> node record. `edges` is a Map from
 * edgeKey -> weight. Edge keys are "a|verb|b" or "a||b" (structural).
 */
export const connectedComponents = (nodes, edges) => {
  // Build an adjacency list from the edge keys.
  const adj = new Map();
  for (const k of edges.keys()) {
    const parts = k.split("|");
    if (parts.length < 2) continue;
    // The key format is "a|verb|b" or "a|!|b" or "a||b".
    // Extract the two node IDs: everything before the first | and after the last |.
    const pipeIdx = k.indexOf("|");
    const lastPipe = k.lastIndexOf("|");
    if (pipeIdx === lastPipe) continue; // no second pipe
    const a = k.slice(0, pipeIdx);
    const b = k.slice(lastPipe + 1);
    if (!a || !b) continue;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }

  // BFS to find components.
  const visited = new Set();
  const components = [];
  for (const node of nodes.keys()) {
    if (visited.has(node)) continue;
    const component = [];
    const queue = [node];
    visited.add(node);
    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);
      for (const neighbour of (adj.get(current) ?? new Set())) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }
    components.push(component);
  }

  return components;
};

// ── SEG·Pattern: community detection via label propagation ──────────────────

/**
 * Community detection by label propagation. Each node starts with its own
 * label; in each iteration, a node adopts the majority label of its
 * neighbours (weighted by edge weight). Iterates until stability or a
 * maximum number of iterations.
 *
 * Returns a Map from nodeId -> communityLabel.
 */
export const communityDetection = (nodes, edges, { maxIterations = 20 } = {}) => {
  // Build weighted adjacency list.
  const adj = new Map();
  for (const [k, w] of edges) {
    const pipeIdx = k.indexOf("|");
    const lastPipe = k.lastIndexOf("|");
    if (pipeIdx === lastPipe) continue;
    const a = k.slice(0, pipeIdx);
    const b = k.slice(lastPipe + 1);
    if (!a || !b) continue;
    if (!adj.has(a)) adj.set(a, new Map());
    if (!adj.has(b)) adj.set(b, new Map());
    adj.get(a).set(b, (adj.get(a).get(b) ?? 0) + w);
    adj.get(b).set(a, (adj.get(b).get(a) ?? 0) + w);
  }

  // Initialise labels.
  const labels = new Map();
  for (const node of nodes.keys()) labels.set(node, node);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    // Visit nodes in random order for fairness.
    const order = [...nodes.keys()];
    let state = 42;
    const rnd = () => { state = (state * 1664525 + 1013904223) | 0; return (state >>> 0) / 4294967296; };
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    for (const node of order) {
      const neighbours = adj.get(node);
      if (!neighbours || neighbours.size === 0) continue;

      // Count labels weighted by edge weight.
      const labelCounts = new Map();
      for (const [neighbour, weight] of neighbours) {
        const nl = labels.get(neighbour);
        labelCounts.set(nl, (labelCounts.get(nl) ?? 0) + weight);
      }

      // Adopt the majority label.
      let bestLabel = labels.get(node);
      let bestCount = -1;
      for (const [l, c] of labelCounts) {
        if (c > bestCount || (c === bestCount && l < bestLabel)) {
          bestLabel = l;
          bestCount = c;
        }
      }
      if (bestLabel !== labels.get(node)) {
        labels.set(node, bestLabel);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return labels;
};

/**
 * Convert a label map into an array of communities (arrays of node IDs).
 */
export const communitiesFromLabels = (labels) => {
  const byLabel = new Map();
  for (const [node, label] of labels) {
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(node);
  }
  return [...byLabel.values()];
};

// ── CON·Ground: initial co-occurrence relating ──────────────────────────────

/**
 * Detect co-occurrence pairs within reach-units (frames). This is the
 * ground-grain act of relating: which raw units appear together, before
 * binding, before links, before structure.
 *
 * `units` is an array of { id, frame } objects. Returns an array of
 * { a, b, frame } pairs.
 */
export const detectCoOccurrences = (units) => {
  const byFrame = new Map();
  for (const u of units) {
    if (!byFrame.has(u.frame)) byFrame.set(u.frame, []);
    byFrame.get(u.frame).push(u.id);
  }

  const pairs = [];
  for (const [frame, ids] of byFrame) {
    const unique = [...new Set(ids)];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        pairs.push({ a: unique[i], b: unique[j], frame });
      }
    }
  }
  return pairs;
};

// ── SYN·Figure: composing new links from existing ones ──────────────────────

/**
 * Compose transitive links from existing directed edges. If A→B and B→C
 * share the same verb and polarity, and A→C is not already in the graph,
 * compose the transitive link. One hop only — the same discipline
 * activation.js uses for recall.
 *
 * `edges` is a Map from edgeKey -> weight. `graphEdges` is the graph's
 * edge map for checking existing relations.
 *
 * Returns an array of { subject, verb, object, polarity, via } triples.
 */
export const composeTransitive = (edges, graphEdges = new Map()) => {
  // Index edges by (source, verbPol) → [{ target, weight }].
  const bySource = new Map(); // "source\0verbPol" -> [{ target, weight }]
  for (const [k, w] of edges) {
    const pipeIdx = k.indexOf("|");
    const lastPipe = k.lastIndexOf("|");
    if (pipeIdx === lastPipe) continue;
    const source = k.slice(0, pipeIdx);
    const verbPol = k.slice(pipeIdx + 1, lastPipe);
    const target = k.slice(lastPipe + 1);
    if (!source || !target || !verbPol) continue;
    const idxKey = `${source}\0${verbPol}`;
    if (!bySource.has(idxKey)) bySource.set(idxKey, []);
    bySource.get(idxKey).push({ target, weight: w });
  }

  const composed = [];
  for (const [idxKey, targets] of bySource) {
    const [source, verbPol] = idxKey.split("\0");
    for (let i = 0; i < targets.length; i++) {
      const mid = targets[i].target;
      // Look up mid's outgoing edges with the same verbPol.
      const midIdx = `${mid}\0${verbPol}`;
      const midTargets = bySource.get(midIdx);
      if (!midTargets) continue;
      for (const { target: dest } of midTargets) {
        if (mid === dest || source === dest) continue;
        // Verify source→mid and mid→dest exist in graphEdges.
        const keySM = `${source}|${verbPol}|${mid}`;
        const keyMD = `${mid}|${verbPol}|${dest}`;
        if (!graphEdges.has(keySM) || !graphEdges.has(keyMD)) continue;
        // Skip if source→dest already exists.
        const keySD = `${source}|${verbPol}|${dest}`;
        if (graphEdges.has(keySD)) continue;
        composed.push({
          subject: source,
          verb: verbPol,
          object: dest,
          polarity: "+",
          via: mid,
          weight: Math.min(graphEdges.get(keySM), graphEdges.get(keyMD)),
        });
      }
    }
  }

  // Deduplicate.
  const seen = new Set();
  return composed.filter((c) => {
    const k = `${c.subject}|${c.verb}|${c.object}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// Post-reading audit: work backwards from a received reference network to the
// first seam at which each item became unreachable.  This module never feeds
// the reference back into reading and never changes a gate.  It only scores
// already-produced candidates, births, pair nominations, and Born/null verdicts.

import { bestMatch } from "../shared/fuzzy-match.mjs";

const edgeKey = (a, b) => [a, b].sort().join("\u241f");

const nominatedReferences = (items, refNodes, nameOf) => {
  const found = new Set();
  for (const item of items) {
    const hit = bestMatch(nameOf(item), refNodes);
    if (hit) found.add(hit);
  }
  return found;
};

const edgesInside = (refEdges, nodes) =>
  new Set(refEdges.filter((e) => nodes.has(e.a) && nodes.has(e.b)).map((e) => edgeKey(e.a, e.b)));

/**
 * Produce monotone coverage ceilings for a completed reading.
 *
 * `discovered` contains pre-Born referents ({ id, surface, arrivals, refusal }).
 * `register` contains beings admitted by the Born rule. `pairs` are every pair
 * nominated by co-arrival before the displacement null, and `edges` are those
 * that survived it. Reference names are used only here, after all four sets
 * have been frozen.
 */
export const coverageFunnel = ({ discovered, register, pairs, edges, ref, displayOf }) => {
  const discoveredRefs = nominatedReferences(discovered, ref.nodes, (d) => d.surface);
  const bornRefs = nominatedReferences(register, ref.nodes, displayOf);
  const idToRef = new Map();
  for (const entity of register) {
    const hit = bestMatch(displayOf(entity), ref.nodes);
    if (hit) idToRef.set(entity.id, hit);
  }

  const nominatedPairKeys = new Set();
  for (const pair of pairs) {
    const a = idToRef.get(pair.a.id ?? pair.a);
    const b = idToRef.get(pair.b.id ?? pair.b);
    if (a && b && a !== b) nominatedPairKeys.add(edgeKey(a, b));
  }
  const acceptedKeys = new Set();
  for (const edge of edges) {
    const a = idToRef.get(edge.a);
    const b = idToRef.get(edge.b);
    if (a && b && a !== b) acceptedKeys.add(edgeKey(a, b));
  }
  const referenceKeys = new Set(ref.edges.map((e) => edgeKey(e.a, e.b)));
  const discoveredEdgeCeiling = edgesInside(ref.edges, discoveredRefs);
  const bornEdgeCeiling = edgesInside(ref.edges, bornRefs);
  const hits = (keys) => [...keys].filter((key) => referenceKeys.has(key)).length;

  const missedBorn = discovered.filter((d) => {
    const hit = bestMatch(d.surface, ref.nodes);
    return hit && !bornRefs.has(hit);
  });
  const refusalReasons = {};
  for (const item of missedBorn) {
    const reason = item.refusal?.details?.reason ?? item.refusal?.gap ?? "not_offered_to_born";
    refusalReasons[reason] = (refusalReasons[reason] ?? 0) + 1;
  }

  return {
    reference: { nodes: ref.nodes.length, edges: ref.edges.length },
    nodes: {
      discovered: discoveredRefs.size,
      born: bornRefs.size,
      lostBeforeDiscovery: ref.nodes.length - discoveredRefs.size,
      lostAtBorn: discoveredRefs.size - bornRefs.size,
      bornRefusalReasons: refusalReasons,
    },
    edges: {
      endpointsDiscovered: discoveredEdgeCeiling.size,
      endpointsBorn: bornEdgeCeiling.size,
      nominatedByCoarrival: hits(nominatedPairKeys),
      acceptedByNull: hits(acceptedKeys),
      lostBeforeEndpointDiscovery: ref.edges.length - discoveredEdgeCeiling.size,
      lostAtBorn: discoveredEdgeCeiling.size - bornEdgeCeiling.size,
      lostBeforeCoarrival: bornEdgeCeiling.size - hits(nominatedPairKeys),
      lostAtNull: hits(nominatedPairKeys) - hits(acceptedKeys),
    },
  };
};

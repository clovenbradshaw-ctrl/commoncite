import test from "node:test";
import assert from "node:assert/strict";

import { coverageFunnel } from "../goldens/network/coverage-funnel.mjs";

test("coverage funnel locates losses without changing a reading", () => {
  const ref = {
    nodes: ["Ada", "Bert", "Cora"],
    edges: [{ a: "Ada", b: "Bert" }, { a: "Bert", b: "Cora" }],
  };
  const discovered = [
    { id: "ra", surface: "Ada", arrivals: [1, 3, 5, 7] },
    { id: "rb", surface: "Bert", arrivals: [2, 4, 6, 8] },
  ];
  const register = [{ id: "ea", name: "Ada" }, { id: "eb", name: "Bert" }];
  const pairs = [{ a: register[0], b: register[1] }];
  const edges = [];

  assert.deepEqual(coverageFunnel({ discovered, register, pairs, edges, ref, displayOf: (e) => e.name }), {
    reference: { nodes: 3, edges: 2 },
    nodes: {
      discovered: 2, born: 2, lostBeforeDiscovery: 1, lostAtBorn: 0, bornRefusalReasons: {},
    },
    edges: {
      endpointsDiscovered: 1, endpointsBorn: 1, nominatedByCoarrival: 1, acceptedByNull: 0,
      lostBeforeEndpointDiscovery: 1, lostAtBorn: 0, lostBeforeCoarrival: 0, lostAtNull: 1,
    },
  });
});

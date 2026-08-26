// native/tests/terrain-activation.test.js — the presence organ's walls.
//
// Three things are pinned here, each earned in the session that built the
// organ rather than invented for the test:
//   1. The fold-unit clock: one observe() = one tick, whatever the
//      observation's size. The bug this pins was REAL — the first cut
//      advanced the clock by key-count, so a window measured as 8
//      propositions by dmdWindow decayed as if it were ~1.5, and the cast
//      read as faded at every checkpoint while genuinely present (P5.4:
//      "a run that does not state its unit is not reproducible").
//   2. Lighting spreads one hop, no more: a Link arrangement lights its
//      resolved ends (Entity), their pair (Network), and its source
//      (Field) — and an unresolved end lights nothing it doesn't have.
//   3. Presence is declared-floor, terrain-shaped, and FADES — the same
//      key kept hot stays present, an abandoned key falls below the floor.
//      Unknown schemas are reported, never guessed into a terrain.

import test from "node:test";
import assert from "node:assert/strict";
import { createActivation } from "../kernel/activation.js";
import { createTerrainActivation } from "../kernel/terrain-activation.js";

test("the clock ticks once per observation, not once per key — the fold unit is the observation (P5.4)", () => {
  // Two readers, same window, same number of OBSERVATIONS — one sees rich
  // propositions (5 keys each), one sees bare ones (1 key each). The storm
  // key must decay IDENTICALLY in both: depth is counted in observations.
  const rich = createActivation({ window: 8 });
  const bare = createActivation({ window: 8 });
  rich.observe(["storm"]);
  bare.observe(["storm"]);
  for (let i = 0; i < 10; i += 1) {
    rich.observe(["a" + i, "b" + i, "c" + i, "d" + i, "e" + i]);
    bare.observe(["x" + i]);
  }
  assert.equal(
    rich.activationOf("storm").toFixed(6),
    bare.activationOf("storm").toFixed(6),
    "observation size multiplied decay — the key-count clock bug is back",
  );
  // And the decay is gamma^10 for 10 subsequent observations, exactly.
  assert.equal(rich.activationOf("storm").toFixed(6), (0.875 ** 10).toFixed(6));
});

test("a Link lights its ends, their pair, and its field — one hop, and only what is resolved", () => {
  const presence = createTerrainActivation({ window: 8 });
  const { lit, unknown } = presence.light([
    {
      schema: "EOHyperedge@1",
      id: "edge:1",
      participants: [
        { standing: "referent", ref: "ref:walton" },
        { standing: "surface", text: "the ship" }, // unresolved — must not light Entity
        { standing: "referent", ref: "ref:margaret" },
      ],
      scope: { sequencePosition: 12 },
      meta: { source: "file:test.txt" },
    },
  ]);
  assert.deepEqual(lit.Link, ["edge:1"]);
  assert.deepEqual(lit.Entity, ["ref:walton", "ref:margaret"], "resolved ends only");
  assert.deepEqual(lit.Network, ["ref:margaret|ref:walton"], "the pair, order-free");
  assert.deepEqual(lit.Field, ["file:test.txt"]);
  assert.deepEqual(unknown, []);
});

test("presence fades below a declared floor; the floor is never defaulted; unknown schemas are reported", () => {
  const presence = createTerrainActivation({ window: 4 });
  presence.light([{ schema: "EOReferent@1", id: "ref:early" }]);
  for (let i = 0; i < 12; i += 1) {
    presence.light([{ schema: "EOReferent@1", id: "ref:steady" }, { schema: "EONotAThing@1", id: "x" + i }]);
  }
  assert.throws(() => presence.present(), /declared/, "how faint still counts is the caller's to say");
  const now = presence.present(1);
  const entityIds = now.Entity.map((e) => e.id);
  assert.ok(entityIds.includes("ref:steady"), "the kept-hot key is present");
  assert.ok(!entityIds.includes("ref:early"), "the abandoned key has faded below the floor (P1: activation decays)");
  const { unknown } = presence.light([{ schema: "EONotAThing@1", id: "y" }]);
  assert.deepEqual(unknown, ["EONotAThing@1"], "an unmapped schema is named, never guessed into a terrain");
});

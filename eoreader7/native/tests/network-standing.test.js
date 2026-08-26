// native/tests/network-standing.test.js — standing comes from the null,
// never the count. Against the REAL engine binding organ, injected.

import test from "node:test";
import assert from "node:assert/strict";
import { networkStanding } from "../kernel/network-standing.js";
import { bindLinks } from "../../legacy-eoreader6.1/packages/engine/emergence/binding.js";

const DECLARED = { bindLinks, window: 2, draws: 199, seed: 20260812, alpha: 0.05 };

test("a genuinely co-arriving pair earns an edge; an everywhere-being's big count is refused — the null, not the count, decides", () => {
  // A and B share three tight scenes. C is on every fifth unit — raw
  // overlap with A is six, bigger than many real bonds, and exactly what a
  // shuffle also produces (probed against the real null: p = 0.15).
  const beings = [
    { id: "a", arrivals: [13, 14, 153, 154, 293, 294] },
    { id: "b", arrivals: [14, 15, 154, 155, 294, 295] },
    { id: "c", arrivals: Array.from({ length: 60 }, (_, i) => i * 5) },
  ];
  const { edges, refused } = networkStanding(beings, DECLARED);
  assert.ok(edges.some((e) => e.a === "a" && e.b === "b"), "the scene-sharing pair clears its own null");
  const ac = refused.find((r) => r.a === "a" && r.b === "c");
  assert.ok(ac, "the everywhere-being's company is coincident under the null — typed, never silently dropped");
  assert.equal(ac.reason, "coincident_under_null");
  assert.ok(ac.coArrivals >= edges.find((e) => e.a === "a" && e.b === "b").coArrivals / 2,
    "and its raw count was NOT small — the count is exactly what must not decide");
});

test("the organ and the cut are the caller's to declare — nothing defaulted, nothing reimplemented", () => {
  assert.throws(() => networkStanding([], { window: 2, draws: 199, seed: 1, alpha: 0.05 }), /injected/);
  assert.throws(() => networkStanding([], { bindLinks, window: 2, draws: 199, seed: 1 }), /alpha/);
  assert.throws(() => networkStanding([{ id: "a", arrivals: [1, 3] }, { id: "b", arrivals: [1, 3] }], { bindLinks, draws: 199, seed: 1, alpha: 0.05 }), /window/);
});

test("one arrival has no co-arrival to test — the floor is binding's own structural minimum, and it closes a measured false door", () => {
  // Measured before this wall existed: a single shared arrival produced a
  // DEGENERATE null (nowhere to displace to) that read p = 0 — standing
  // granted precisely where the test could not run.
  const { edges, belowFloor, pairsTested } = networkStanding(
    [{ id: "x", arrivals: [5] }, { id: "y", arrivals: [5] }],
    DECLARED,
  );
  assert.equal(pairsTested, 0);
  assert.equal(edges.length, 0);
  assert.equal(belowFloor.length, 2);
  assert.equal(belowFloor[0].reason, "below_arrival_floor");
});

// ── the directed pass ───────────────────────────────────────────────────
import { directedEdges } from "../kernel/network-standing.js";
import { buildLink } from "../../legacy-eoreader6.1/packages/engine/emergence/binding.js";

test("direction comes from the reversal null, or stays typed undetermined — never guessed from raw asymmetry", () => {
  // A leads, B follows one unit later, forty times over — a real
  // directional structure the reversal null can orient.
  const lead = Array.from({ length: 40 }, (_, i) => i * 7);
  const follow = lead.map((x) => x + 1);
  const beings = [
    { id: "lead", arrivals: lead },
    { id: "follow", arrivals: follow },
    // a symmetric pair: interleaved with no leader
    { id: "p", arrivals: Array.from({ length: 40 }, (_, i) => i * 7 + (i % 2)) },
    { id: "q", arrivals: Array.from({ length: 40 }, (_, i) => i * 7 + ((i + 1) % 2)) },
  ];
  const edges = [
    { a: "lead", b: "follow", coArrivals: 40 },
    { a: "p", b: "q", coArrivals: 40 },
  ];
  const { directed, undetermined } = directedEdges(beings, edges, { buildLink, totalUnits: 300, draws: 199, seed: 20260812 });
  const lf = directed.find((d) => d.a === "lead");
  assert.ok(lf, "the leader/follower pair orients");
  assert.equal(lf.direction, "a→b", "and in the right direction");
  const pq = [...directed, ...undetermined].find((d) => d.a === "p");
  assert.ok(pq, "the symmetric pair is reported either way, never dropped");
  assert.throws(() => directedEdges(beings, edges, { totalUnits: 300, draws: 199, seed: 1 }), /injected/);
});

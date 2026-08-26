// Death one: confabulation. It speaks without witness.
//
// Every refusal here is structural and free — no null is spent to catch any of
// it. The last two tests are the witness gate in its Bateson form: a difference
// that made no difference is not information, so it is not testimony either.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ground, received, keep, difference, pattern, witness, admissible, isGap, burstiness } from "../nul/index.js";

const D = 256;
const W = 5;
const quiet = [1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 2];
const g0 = () => ground({ material: quiet, draws: D, window: W });
const observed = burstiness(quiet, { window: W });

test("a ground cites the material it perturbed or the giver it came from", () => {
  assert.equal(admissible({ samples: [1, 2] }).gap, "unreceived_origin");
  assert.equal(admissible({ samples: [1, 2], spec: {}, from: null }).gap, "unreceived_origin");
  assert.equal(received({ samples: [1, 2, 3] }).gap, "unreceived_origin");
  assert.equal(received({ samples: [1, 2, 3], provenance: "priors/x.json" }).provenance, "priors/x.json");
});

test("a ground of zero width is refused — it would clear anything", () => {
  const flat = ground({ material: [2, 2, 2, 2, 2, 2, 2, 2], draws: D, window: W });
  assert.equal(flat.gap, "degenerate_ground");
});

test("both resolutions are declared, never defaulted", () => {
  assert.equal(ground({ material: quiet, window: W }).gap, "undeclared");
  assert.equal(ground({ material: quiet, draws: D }).gap, "undeclared");
  assert.equal(pattern({ before: g0(), after: g0(), material: quiet }).gap, "undeclared");
});

test("a kept ground cannot be perceived through, only testified from", () => {
  assert.equal(difference(observed, keep(g0())).gap, "kept_ground");
});

test("testimony requires a ground that was kept", () => {
  const out = witness({ ground: g0(), figure: difference(observed, g0()), pattern: { moved: true } });
  assert.equal(out.gap, "no_ground");
});

test("two grounds built to different specs were never comparable", () => {
  const a = ground({ material: quiet, draws: D, window: W });
  const b = ground({ material: [...quiet, 9, 9, 9, 9, 9], draws: D, window: W + 1 });
  assert.equal(pattern({ before: a, after: b, material: quiet, reseeds: 16 }).gap, "unknown_spec");
});

test("a difference that made no difference is not testimony", () => {
  const before = g0();
  const after = ground({ material: [...quiet, 1, 0, 2, 1, 0], draws: D, window: W });
  const p = pattern({ before, after, material: quiet, reseeds: 16 });
  assert.equal(p.moved, false);
  const out = witness({ ground: keep(before), figure: difference(observed, before), pattern: p });
  assert.equal(out.gap, "made_no_difference");
});

test("a difference that made one is", () => {
  const before = g0();
  const after = ground({ material: [...quiet, 9, 9, 9, 9, 9], draws: D, window: W });
  const p = pattern({ before, after, material: quiet, reseeds: 16 });
  assert.equal(p.moved, true);
  const record = witness({ ground: keep(before), figure: difference(observed, before), pattern: p });
  assert.ok(!isGap(record));
  assert.ok(record.ground.kept);
  assert.equal(record.pattern.moved, true);
});

test("gaps are returned, never thrown — absence is the normal case", () => {
  assert.doesNotThrow(() => ground({ material: [], draws: D, window: W }));
  assert.doesNotThrow(() => ground({ material: quiet, draws: D, window: W, perturbation: "nope" }));
  assert.equal(ground({ material: [], draws: D, window: W }).gap, "empty_material");
  assert.equal(ground({ material: quiet, draws: D, window: W, perturbation: "nope" }).gap, "unknown_spec");
});

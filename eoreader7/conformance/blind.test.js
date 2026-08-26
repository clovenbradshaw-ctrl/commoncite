// eoreader6 · referents/blind — existence detection that requires no
// human-named prior. A planted, known repeating shape must be found by
// self-similarity alone, with zero information about what it looks like or
// where it is — the actual falsifiable claim behind "we can sense a thing
// before anyone names it."

import { test } from "node:test";
import assert from "node:assert/strict";
import { findRecurringMotifs } from "../packages/engine/referents/blind.js";

// A seeded PRNG for a genuinely non-periodic, reproducible background — a
// sine wave (tried first) is itself periodic and produced spurious
// self-similarity that swallowed the whole series into one cluster.
const mulberry32 = (seed) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

test("blind detection: a planted recurring shape is found without being told what or where", () => {
  const motif = [1, 3, 6, 8, 6, 3, 1, 0];
  const plantAt = [10, 80, 150, 300, 450];
  const rng = mulberry32(42);
  const series = Array.from({ length: 550 }, () => rng() * 2 - 1);
  for (const pos of plantAt) {
    for (let i = 0; i < motif.length; i++) series[pos + i] = motif[i];
  }

  const result = findRecurringMotifs(series, { windowSize: 8, hop: 1, similarityThreshold: 0.15, minOccurrences: 3 });
  assert.ok(result.motifs.length > 0, "should find at least one recurring candidate");

  const top = result.motifs[0];
  assert.ok(top.count >= plantAt.length, "the strongest motif should recover at least as many occurrences as were planted");

  // every planted location should have a detected occurrence within a few
  // positions of it (small offsets are expected: the exact best-aligned
  // window can shift a couple of steps under the hop/window scan)
  for (const pos of plantAt) {
    const found = top.occurrences.some((o) => Math.abs(o - pos) <= 4);
    assert.ok(found, `planted location ${pos} should be recovered (occurrences: ${top.occurrences})`);
  }
});

test("blind detection: material with no real recurrence finds nothing forced", () => {
  const flat = Array.from({ length: 300 }, () => 5); // constant — no genuine shape to recur
  const result = findRecurringMotifs(flat, { windowSize: 8, hop: 2, similarityThreshold: 0.01, minOccurrences: 3 });
  // constant material is trivially "similar everywhere" at this threshold —
  // the honest behavior is either one giant cluster (everything matches
  // everything) or nothing, never a SPECIFIC small number of separate
  // candidates fabricated out of nothing.
  assert.ok(result.motifs.length <= 1, "flat material must not fabricate multiple distinct candidates");
});

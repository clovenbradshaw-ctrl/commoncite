// conformance/cooccurrence.test.js — referents/cooccurrence.js.
//
// Two layers, same shape as conformance/entity.test.js:
//
// 1. Synthetic — `mergeAliasedEntities`'s load-bearing invariants, pinned
//    without any text or real admitted beings (a hand-seeded `state.series`
//    stands in for a real reading — see `seededState`'s own comment). The
//    structural edge question itself (do two admitted beings recur
//    together, significantly) is NOT this file's job any more — that is
//    `emergence/binding.js`'s (`detectCoArrivals`, `displacementNull`,
//    `bindLinks`), already covered by `conformance/binding.test.js`. An
//    earlier version of this module hand-rolled a same-chapter counting
//    test instead of using that organ; see cooccurrence.js's own header for
//    why it was removed rather than kept as a second, weaker path.
//
// 2. The golden — goldens/network/read.mjs against the reference character
//    co-occurrence networks (Les Misérables, Huckleberry Finn, David
//    Copperfield, all 37 Shakespeare plays). Fixture texts are gitignored;
//    the golden test SKIPS when absent, exactly like entity.test.js's.

import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { openReading, arrive } from "../packages/engine/referents/entity.js";
import { mergeAliasedEntities } from "../packages/engine/referents/cooccurrence.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = { window: 8, draws: 16, reseeds: 8, minArrivals: 2 };

// A state with a real series to test identity against, and each entity's
// arrivals registered in `state.arrivals` too — identityByConsequence reads
// arrivals from THE STATE by surface key, not from the entity object, the
// same way it does on a real reading (an admitted entity's `.arrivals` is a
// copy taken at birth, but `state.arrivals` is where consequence.js actually
// looks). An empty series gaps out as "unstable" for everything, and a
// surface key state.arrivals has never heard of does too — both would make
// every test below vacuous if skipped.
const seededState = (surfaceArrivals) => {
  const state = openReading(SPEC);
  for (let i = 0; i < 30; i++) arrive(state, [`w${i % 5}`]);
  for (const [surface, at] of Object.entries(surfaceArrivals)) state.arrivals.set(surface, at);
  return state;
};

test("mergeAliasedEntities: entities sharing no name token are never even asked, and stay apart", () => {
  const state = seededState({ valjean: [0, 3, 6, 9, 12], javert: [1, 4, 7, 10, 13] });
  const entities = [
    { id: "e0", surfaces: ["valjean"], arrivals: [0, 3, 6, 9, 12], bornAt: 3 },
    { id: "e1", surfaces: ["javert"], arrivals: [1, 4, 7, 10, 13], bornAt: 4 },
  ];
  const merged = mergeAliasedEntities(state, entities);
  assert.equal(merged.length, 2, "no shared token means no candidate pair was even tested");
  assert.deepEqual(merged.map((e) => e.surfaces), [["valjean"], ["javert"]]);
});

test("mergeAliasedEntities: a shared id-namespace prefix (\"ref\", \"auto\") is majority-generic and never a merge reason on its own", () => {
  // Every id `discoverReferents` mints shares the literal prefix
  // "ref:auto:" — with enough entities in the register for "majority" to
  // mean something (unlike a 2-entity toy case, where any shared token is
  // trivially 100%), that prefix must not be what proposes a pair, or the
  // token-sharing prefilter tests every pair in the register regardless of
  // whether the names resemble each other at all.
  const arrivals = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18];
  const ids = ["ref:auto:tom_sawyer", "ref:auto:huck_finn", "ref:auto:jim", "ref:auto:widow_douglas", "ref:auto:pap"];
  const state = seededState(Object.fromEntries(ids.map((id) => [id, arrivals])));
  const entities = ids.map((id, i) => ({ id: `e${i}`, surfaces: [id], arrivals, bornAt: i }));
  const merged = mergeAliasedEntities(state, entities); // default nameOf: the raw id
  assert.equal(merged.length, ids.length, "the shared \"ref\"/\"auto\" prefix must not merge unrelated entities");
});

test("mergeAliasedEntities: a caller-supplied nameOf resolves structured ids back to comparable words", () => {
  // Mirrors goldens/network/read.mjs's own situation: admitted surfaces are
  // opaque referent ids, not plain words, so the token-sharing prefilter
  // needs `nameOf` to see past the id shape to the real name underneath.
  // Padded to five entities for the same reason as the test above — "ref"
  // and "auto" must stay below the majority guard here too, so the surname
  // "sawyer" (shared by exactly two of five) is the token that survives.
  const arrivals = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18];
  const ids = ["ref:auto:tom_sawyer", "ref:auto:sawyer", "ref:auto:jim", "ref:auto:widow_douglas", "ref:auto:pap"];
  const state = seededState(Object.fromEntries(ids.map((id) => [id, arrivals])));
  const entities = ids.map((id, i) => ({ id: `e${i}`, surfaces: [id], arrivals, bornAt: i }));
  const names = {
    "ref:auto:tom_sawyer": "Tom Sawyer", "ref:auto:sawyer": "Sawyer", "ref:auto:jim": "Jim",
    "ref:auto:widow_douglas": "Widow Douglas", "ref:auto:pap": "Pap",
  };
  const merged = mergeAliasedEntities(state, entities, { nameOf: (e) => names[e.surfaces[0]] });
  // Identical arrival positions on the one pair that shares a real name
  // token ("sawyer") must read as "consistent" once it's offered at all —
  // everything else stays apart, same count as the un-merged five minus one.
  assert.equal(merged.length, 4, "Tom Sawyer and Sawyer merge; the other three stay distinct entities");
  const mergedSawyer = merged.find((e) => e.surfaces.length > 1);
  assert.deepEqual(mergedSawyer.surfaces.sort(), ["ref:auto:sawyer", "ref:auto:tom_sawyer"]);
});

test("the golden: the reader discovers real characters and a real, precise co-occurrence structure among them (bindLinks)", async (t) => {
  const manifestPath = join(ROOT, "goldens/network/manifest.json");
  const { readFileSync, existsSync: exists } = await import("fs");
  if (!exists(manifestPath)) {
    t.skip("goldens/network/manifest.json is missing — run `node goldens/network/fetch.mjs` first");
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const book = manifest.books.find((b) => b.tag === "huckleberry-finn");
  const textPath = join(ROOT, "goldens/network/texts", book.text);
  if (!exists(textPath)) {
    t.skip("goldens/network/texts/ is gitignored — run `node goldens/network/fetch.mjs` first");
    return;
  }

  const { readBook, score: scoreCooccurrence, loadGroundTruth } = await import("../goldens/network/read.mjs");
  const text = readFileSync(textPath, "utf8");
  const r = readBook(text, book);
  assert.ok(r.edges.length > 0, "the golden must actually produce edges");

  const ref = loadGroundTruth(book.groundTruth);
  const s = scoreCooccurrence(r.register, r.edges, ref, r.displaySurfaceOf);

  // A capability floor, not a ranking: entity discovery at this grain must
  // find a real, non-trivial slice of the cast (measured: 5/74 — Huckleberry
  // Finn's 44 chapters give the sparsest register of the three novels; see
  // goldens/network's README for Les Misérables and David Copperfield,
  // where both entity and edge counts are much larger). Every edge
  // `readBook` proposes has already cleared bindLinks' own displacement-
  // null significance test, so precision on the FEW candidates a sparse
  // book like this produces should be high — measured at 2/3.
  assert.ok(s.entityHits >= 3, `expected at least 3 real characters discovered, got ${s.entityHits}`);
  assert.ok(s.candidateEdges > 0, "at least one character-to-character edge must be proposed");
  assert.ok(s.edgeHits >= 1, "at least one proposed edge must be a real reference relationship");
  assert.ok(Number.isFinite(s.edgeChance.p95), "the chance baseline must be a real number, never NaN/undefined");
});

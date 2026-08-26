// eoreader6 · conformance/surfaces — candidate referent surfaces and the
// engine-tier (name-variant) coreference between them. No coverage existed
// for this file before this suite; it exists because genericTokens's
// minPartners and discoverReferents's minSentences used to be fixed absolute
// counts (3) and are now derived from each document's own structure.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractSurfaces,
  genericTokens,
  discoverReferents,
  namesCorefer,
} from "../packages/engine/perceiver/text/surfaces.js";

test("extractSurfaces: capitalised runs become candidate surfaces, sentence-initial tokens do not", () => {
  const sentences = [
    { text: "He met Victor Frankenstein at Ingolstadt.", order: 0 },
    { text: "He wrote to Elizabeth Lavenza often.", order: 1 },
  ];
  const surfaces = extractSurfaces(sentences);
  const names = surfaces.map((s) => s.surface);
  assert.ok(names.includes("Victor Frankenstein"));
  assert.ok(names.includes("Elizabeth Lavenza"));
  assert.ok(names.includes("Ingolstadt"));
  // "He" opens sentence 1 and is capitalised by position only.
  assert.ok(!names.includes("He"));
});

test("genericTokens: a title co-occurring with many different names is derived as generic; the names it titles are not", () => {
  // "princess" partners with three distinct tokens; every other token
  // partners with exactly one. No fixed count is passed — the fence is
  // derived from this list's own partner-count distribution (q3 + IQR).
  const surfaces = [
    { surface: "Princess Mary" },
    { surface: "Princess Helene" },
    { surface: "Princess Anna" },
    { surface: "Victor Frankenstein" },
  ];
  const generic = genericTokens(surfaces);
  assert.ok(generic.has("princess"), "a token with an outlier partner count should be found generic");
  for (const individuating of ["mary", "helene", "anna", "victor", "frankenstein"]) {
    assert.ok(!generic.has(individuating), `${individuating} individuates and should not be generic`);
  }
});

test("genericTokens: a flat partner-count distribution (no outlier) derives no generic tokens, rather than defaulting to some", () => {
  const surfaces = [{ surface: "Alpha Beta" }, { surface: "Gamma Delta" }];
  assert.deepEqual(genericTokens(surfaces), new Set());
});

test("genericTokens: an explicit override still works, for a caller that wants a fixed fence", () => {
  const surfaces = [{ surface: "Princess Mary" }, { surface: "Princess Helene" }];
  // fence of 0: every token with >0 partners is generic under an explicit override.
  const generic = genericTokens(surfaces, { minPartners: 0 });
  assert.ok(generic.has("princess") && generic.has("mary") && generic.has("helene"));
});

test("discoverReferents: the recurrence floor is derived from the surface pool's own median, not a fixed 3", () => {
  // Three hapax candidates (1 sentence each), one candidate at 2, two well
  // above. Median is 1.5, so the derived floor keeps > 1.5 — the hapaxes are
  // excluded and, notably, the 2-sentence candidate is KEPT even though the
  // old hardcoded minSentences=3 would have excluded it.
  const surfaces = [
    { surface: "Victor", mentions: 5, sentences: 5 },
    { surface: "Elizabeth", mentions: 4, sentences: 4 },
    { surface: "Geneva", mentions: 2, sentences: 2 },
    { surface: "Henry", mentions: 1, sentences: 1 },
    { surface: "Justine", mentions: 1, sentences: 1 },
    { surface: "William", mentions: 1, sentences: 1 },
  ];
  const { events } = discoverReferents(surfaces);
  const ids = new Set(events.map((e) => e.referent_id));
  assert.ok(ids.has("ref:auto:victor"));
  assert.ok(ids.has("ref:auto:elizabeth"));
  assert.ok(ids.has("ref:auto:geneva"), "a 2-sentence candidate should survive a derived floor below the old fixed 3");
  assert.ok(!ids.has("ref:auto:henry"), "a hapax candidate should not survive a floor derived from a Zipfian pool");
  assert.ok(!ids.has("ref:auto:justine"));
  assert.ok(!ids.has("ref:auto:william"));
});

test("discoverReferents: an explicit override is still honoured", () => {
  const surfaces = [
    { surface: "Victor", sentences: 5 },
    { surface: "Geneva", sentences: 2 },
  ];
  const { events } = discoverReferents(surfaces, { minSentences: 4 });
  const ids = new Set(events.map((e) => e.referent_id));
  assert.ok(ids.has("ref:auto:victor"));
  assert.ok(!ids.has("ref:auto:geneva"));
});

test("discoverReferents: an empty pool degrades to no referents, not a crash", () => {
  assert.deepEqual(discoverReferents([]).events, []);
});

test("discoverReferents: a single candidate, with no pool to compare against, is admitted rather than silently dropped", () => {
  // A one-candidate pool's own 25th percentile always equals its one value,
  // so "exceeds the derived floor" would reject the only evidence there
  // is — the same degrade-safely standing genericTokens takes: the material
  // cannot support the distinction, so nothing is filtered.
  const { events } = discoverReferents([{ surface: "Lone", sentences: 1 }]);
  assert.equal(events.length, 1);
  assert.equal(events[0].referent_id, "ref:auto:lone");
});

test("extractSurfaces: a word overwhelmingly used lowercase, with only rare capitalised sightings, is rejected regardless of run length — per-candidate binomial test, not a fixed ratio band", () => {
  // "well" used lowercase far more than the rare capitalised "Well" — the
  // kind of dialogue-opener the old fixed-band filter targeted too, but
  // this exercises it through a candidate with real evidence at scale
  // rather than a coincidental one-occurrence tie.
  const sentences = [];
  for (let i = 0; i < 40; i++) sentences.push({ text: `He said well, it was fine number ${i}.`, order: i });
  sentences.push({ text: "He paused. Well seemed like a strange thing to say twice.", order: 40 });
  const surfaces = extractSurfaces(sentences);
  assert.ok(!surfaces.some((s) => s.surface === "Well"), "a word seen mostly lowercase should not survive as a candidate name");
});

test("extractSurfaces: a candidate seen capitalised only once, with a single coincidental lowercase collision, is rejected for insufficient evidence — not kept by a coincidental ratio near 1", () => {
  const sentences = [
    { text: "They admired the east wind that evening.", order: 0 },
    { text: "He then travelled toward the East for a season.", order: 1 },
  ];
  const surfaces = extractSurfaces(sentences);
  assert.ok(!surfaces.some((s) => s.surface === "East"), "cap=1,lower=1 is not enough evidence either way and should not pass by coincidence");
});

test("namesCorefer: containment and shared final token still work unchanged (regression against the derivation change above)", () => {
  assert.ok(namesCorefer("Victor Frankenstein", "Frankenstein"));
  assert.ok(namesCorefer("Victor Frankenstein", "Victor"));
  assert.ok(!namesCorefer("Victor Frankenstein", "Henry Clerval"));
});

// native/tests/perspective-claims.test.js — the pronoun-to-claim subassembly,
// tested in isolation. Each organ's wall is pinned, including the two bugs
// the inline version shipped with (the NaN sentence range; the silent
// no-match join).

import test from "node:test";
import assert from "node:assert/strict";
import { castSurfaceMap, bindNarrationFrames, pronounResolver, claimEndKey } from "../adapters/text/perspective-claims.js";

const RECALL = { minActivation: 0.05, minMargin: 0.2 };
const FIRST_PERSON = /^(i|me|my|mine|myself)$/i; // test's own injected class; production injects priors.js's, giver named

// A synthetic two-frame material: Ada's stretch, then Bram's. Filler keeps
// the activation organ honest (real recurrence, not two adjacent lines).
const filler = (n) => `frame ${n} the ordinary business of the afternoon continued with letters and accounts and quiet errands.`;
const buildMaterial = () => {
  const adaLines = [];
  let f = 0;
  const push = (arr, k) => { for (let i = 0; i < k; i++) arr.push(filler(f++)); };
  push(adaLines, 3);
  adaLines.push("Ada knelt in the garden and pressed her palms into the warm garden soil.");
  push(adaLines, 3);
  adaLines.push("Ada trimmed the garden roses growing along the garden wall in the soil.");
  push(adaLines, 3);
  adaLines.push("Ada watered the garden roses again, kneeling in the soft garden soil.");
  push(adaLines, 6);
  adaLines.push("The garden soil there was rich, and she loved working the garden roses after rain.");
  const bramLines = [];
  push(bramLines, 3);
  bramLines.push("Bram stood at his workbench, running a plane along the rough workshop timber.");
  push(bramLines, 3);
  bramLines.push("Bram sanded the workshop timber until the grain shone in the workshop light.");
  push(bramLines, 3);
  bramLines.push("Bram planed another length of workshop timber, the grain pale in the light.");
  push(bramLines, 6);
  bramLines.push("Even in the evening chill he kept sanding the workshop timber, patient with the grain.");
  const ada = adaLines.join(" ");
  const bram = bramLines.join(" ");
  const text = ada + " " + bram;
  const frames = [
    { narrator: "ada-frame", byteStart: 0, byteEnd: ada.length },
    { narrator: "bram-frame", byteStart: ada.length + 1, byteEnd: text.length },
  ];
  return { text, frames };
};


test("castSurfaceMap reads the host cast shape — display and surfaces, string or wrapped", () => {
  const map = castSurfaceMap([
    { display: "Ada", surfaces: [{ surface: "Ada Lovelace" }, "Miss Ada"] },
    { display: "Bram", surfaces: [] },
  ]);
  assert.equal(map.get("Ada"), "Ada");
  assert.equal(map.get("Ada Lovelace"), "Ada");
  assert.equal(map.get("Miss Ada"), "Ada");
  assert.equal(map.get("Bram"), "Bram");
});

test("bindNarrationFrames returns REAL byte ranges — the NaN-range regression stays dead", () => {
  const { text, frames } = buildMaterial();
  const surfaces = new Map([["Ada", "ref:ada"], ["Bram", "ref:bram"]]);
  const { boundSentences, perFrame } = bindNarrationFrames({ frames, text, offset: 0, surfaceToReferent: surfaces, recall: RECALL });
  assert.ok(boundSentences.length >= 1, "at least the pronoun-only sentences bind");
  for (const b of boundSentences) {
    assert.ok(Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start,
      "a bound sentence carries a real range — splitSentences has no .start/.end, and reading them was the NaN bug");
    assert.equal(text.slice(b.start, b.end).toLowerCase().includes(b.pronoun), true,
      "the range actually contains the pronoun it was bound on");
  }
  assert.equal(perFrame.length, 2);
});

test("frame scoping is the wall: a teller's pronoun never binds a name from another teller's stretch", () => {
  const { text, frames } = buildMaterial();
  const surfaces = new Map([["Ada", "ref:ada"], ["Bram", "ref:bram"]]);
  const { boundSentences } = bindNarrationFrames({ frames, text, offset: 0, surfaceToReferent: surfaces, recall: RECALL });
  const adaEnd = frames[0].byteEnd;
  for (const b of boundSentences) {
    if (b.end <= adaEnd) assert.notEqual(b.referentId, "ref:bram", "Ada's frame bound Bram — the window was carried across tellers");
    if (b.start >= frames[1].byteStart) assert.notEqual(b.referentId, "ref:ada", "Bram's frame bound Ada — the window was carried across tellers");
  }
});

test("pronounResolver counts every stage — a silent no-match is structurally visible", () => {
  const bound = [
    { start: 100, end: 160, referentId: "ref:ada", pronoun: "she" },
    { start: 300, end: 350, referentId: "ref:bram", pronoun: "he" },
  ];
  const { resolve, counters } = pronounResolver(bound);
  assert.equal(resolve("she", 120), "ref:ada");
  assert.equal(resolve("he", 320), "ref:bram");
  assert.equal(resolve("he", 120), null, "wrong token in a bound range resolves nothing");
  assert.equal(resolve("she", 500), null, "outside every range resolves nothing");
  assert.equal(resolve("garden", 120), null, "a non-pronoun surface is never counted as a pronoun end");
  assert.deepEqual(counters, { pronounEnds: 4, inBoundRange: 3, tokenMatch: 2 },
    "each stage of the join is counted — zeros here located the NaN bug, and would locate the next one");
});

test("claimEndKey priority: referent id > frame narrator (first person) > bound pronoun > bare surface", () => {
  const { resolve } = pronounResolver([{ start: 10, end: 90, referentId: "ref:ada", pronoun: "she" }]);
  const opts = { offset: 50, resolvePronoun: resolve, firstPerson: FIRST_PERSON };
  assert.equal(claimEndKey({ standing: "referent", ref: "ref:walton" }, "victor", opts), "ref:walton");
  assert.equal(claimEndKey({ surface: "I" }, "victor", opts), "holder:victor");
  assert.equal(claimEndKey({ surface: "she" }, "victor", opts), "ref:ada");
  assert.equal(claimEndKey({ surface: "the Storm" }, "victor", opts), "surface:the_storm");
  assert.equal(claimEndKey({ surface: "she" }, "victor", { ...opts, offset: 500 }), "surface:she",
    "an unbound pronoun falls to the honest floor, never a guess");
});

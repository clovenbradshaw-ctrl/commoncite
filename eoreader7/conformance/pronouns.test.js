// eoreader6 · conformance/pronouns — perceiver/text/pronouns::resolvePronouns
// held to the same discipline as every other terrain organ in this repo:
// MEANINGFUL on structured material, MEANINGLESS (or honestly refused) on
// material with no real structure to find. No coverage existed before this
// suite — presence.js's own admitReferent was unwired dead code (`events`
// and `fullText` accepted, never read) until this fix.

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolvePronouns } from "../packages/engine/perceiver/text/pronouns.js";

const mk = (lines) => lines.map((text, i) => ({ text, order: i, offset: i * 1000 }));
const filler = (n) => `frame ${n} the ordinary business of the afternoon continued much as before with letters and accounts and quiet errands`;

// A structured two-character narrative: each name is followed, across
// several separated mentions, by its OWN distinctive thematic vocabulary
// (garden/soil/roses for Elena; workshop/timber/grain for Marcus), with
// unrelated filler between every mention — the same "intervening material
// that shares nothing with the motif" shape activation.test.js's own LONG
// fixture uses, for the same reason: recall has to reach PAST filler to be
// evidence of anything.
const buildTwoCharacterCorpus = () => {
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };

  pushFiller(3);
  lines.push("Elena knelt in the garden and pressed her palms into the warm garden soil.");
  pushFiller(3);
  lines.push("Marcus stood at his workbench, running a plane along the rough workshop timber.");
  pushFiller(3);
  lines.push("Elena trimmed the garden roses growing along the garden wall in the soil.");
  pushFiller(3);
  lines.push("Marcus sanded the workshop timber until the grain shone in the workshop light.");
  pushFiller(3);
  lines.push("Elena watered the garden roses again, kneeling in the soft garden soil.");
  pushFiller(3);
  lines.push("Marcus planed another length of workshop timber, the grain pale in the light.");
  pushFiller(6);
  // No name anywhere in this sentence — exactly the complaint this organ
  // exists to answer: "a scene carried by 'he' [or 'she'] without the name
  // on the page."
  lines.push("The garden soil there was rich, and she loved working the garden roses after rain.");
  pushFiller(3);
  lines.push("Even in the evening chill he kept sanding the workshop timber, patient with the grain.");
  return lines;
};

const TWO_CHARACTER_SURFACES = new Map([
  ["Elena", "ref:elena"],
  ["Marcus", "ref:marcus"],
]);

// The declared operating point host/corpus.js actually calls this with.
const OPTS = { minActivation: 0.05, minMargin: 0.2 };

test("declared numbers are declared, never defaulted", () => {
  assert.throws(() => resolvePronouns([], new Map()), /minActivation/);
  assert.throws(() => resolvePronouns([], new Map(), { minActivation: 0 }), /minMargin/);
  assert.doesNotThrow(() => resolvePronouns([], new Map(), { minActivation: 0, minMargin: 0 }));
});

test("a sentence carried only by a pronoun, with no name on the page, is bound to the referent whose OWN vocabulary it shares", () => {
  const sentences = mk(buildTwoCharacterCorpus());
  const { bindings, gaps } = resolvePronouns(sentences, TWO_CHARACTER_SURFACES, OPTS);

  const she = bindings.find((b) => b.pronoun === "she");
  const he = bindings.find((b) => b.pronoun === "he");
  assert.ok(she, "the garden-vocabulary pronoun sentence must resolve");
  assert.ok(he, "the workshop-vocabulary pronoun sentence must resolve");
  assert.equal(she.referentId, "ref:elena");
  assert.equal(he.referentId, "ref:marcus");
  assert.ok(she.activation > 0 && he.activation > 0, "a real echo, not a rounding artefact");
  assert.equal(gaps.length, 0, "both pronouns had a clear, gender-compatible, well-separated winner");
});

test("activation beats recency: a more recently named same-gender referent does not steal a pronoun whose vocabulary belongs to someone else", () => {
  // Marcus (workshop) is established early and repeatedly. Thomas (harbor),
  // also male, is named LAST — immediately before the pronoun sentence — but
  // shares none of its vocabulary. A mechanism that tracked "the nearest
  // compatible name" would bind the pronoun to Thomas; one-hop recall over
  // shared vocabulary must not.
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  pushFiller(3);
  lines.push("Marcus stood at his workbench, running a plane along the rough workshop timber.");
  pushFiller(3);
  lines.push("Marcus sanded the workshop timber until the grain shone in the workshop light.");
  pushFiller(3);
  lines.push("Marcus planed another length of workshop timber, the grain pale in the light.");
  pushFiller(6);
  lines.push("Thomas coiled the harbor rope and watched the tide slide past the pier.");
  pushFiller(2);
  lines.push("Even in the evening chill he kept sanding the workshop timber, patient with the grain.");

  const surfaces = new Map([["Marcus", "ref:marcus"], ["Thomas", "ref:thomas"]]);
  const { bindings } = resolvePronouns(mk(lines), surfaces, OPTS);
  const he = bindings.find((b) => b.pronoun === "he");
  assert.ok(he, "the workshop-vocabulary sentence must resolve to someone");
  assert.equal(he.referentId, "ref:marcus", "shared vocabulary must win over mere recency");
});

test("MEANINGLESS ON RANDOM MATERIAL: a pronoun sentence sharing no established referent's vocabulary is refused, never guessed", () => {
  const lines = buildTwoCharacterCorpus();
  lines[lines.length - 1] = "The distant bell rang twice and he wondered about the price of bread in the market square.";
  const { bindings, gaps } = resolvePronouns(mk(lines), TWO_CHARACTER_SURFACES, OPTS);
  assert.ok(!bindings.some((b) => b.pronoun === "he"), "no candidate has any real claim on this sentence");
  assert.ok(gaps.some((g) => g.pronoun === "he" && g.reason === "pronoun_no_candidate"));
  // The untouched "she" sentence earlier in the same document is unaffected —
  // the refusal is specific to the corrupted input, not a global breakdown.
  assert.ok(bindings.some((b) => b.pronoun === "she" && b.referentId === "ref:elena"));
});

test("gender is a HARD filter, never a tiebreaker — the strongest activation in the document does not override it", () => {
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  // Only one referent exists at all, and it is male. A "she" sharing its
  // exact vocabulary must still refuse rather than bind to the only
  // candidate on the board.
  pushFiller(3);
  lines.push("Marcus stood at his workbench, running a plane along the rough workshop timber.");
  pushFiller(3);
  lines.push("Marcus sanded the workshop timber until the grain shone in the workshop light.");
  pushFiller(3);
  lines.push("Marcus planed another length of workshop timber, the grain pale in the light.");
  pushFiller(6);
  lines.push("Even in the evening chill she kept sanding the workshop timber, patient with the grain.");

  const surfaces = new Map([["Marcus", "ref:marcus"]]);
  const { bindings, gaps } = resolvePronouns(mk(lines), surfaces, OPTS);
  assert.equal(bindings.length, 0, "the only candidate on the board is gender-incompatible");
  assert.ok(gaps.some((g) => g.reason === "pronoun_no_candidate"));
});

test("a pronoun sharing its own sentence with a named surface is left alone", () => {
  // Disambiguating a pronoun beside a co-mentioned name is a different,
  // harder problem this organ does not attempt — only the case the original
  // complaint names (no name anywhere in the sentence) is in scope.
  const sentences = mk([
    "Elena walked with Marcus through the garden, and he carried the basket.",
  ]);
  const { bindings, gaps } = resolvePronouns(sentences, TWO_CHARACTER_SURFACES, OPTS);
  assert.equal(bindings.length, 0);
  assert.equal(gaps.length, 0, "a sentence with a named surface is simply not offered to this organ");
});

test("no evidence either way never excludes a referent by gender — only clear, contrary evidence does", () => {
  // A referent mentioned by name but never alongside a gendered pronoun has
  // no gender evidence at all, and must remain a candidate.
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  pushFiller(3);
  lines.push("Alex arranged the workshop timber along the bench, checking the grain twice.");
  pushFiller(3);
  lines.push("Alex measured the workshop timber again before cutting into the grain.");
  pushFiller(3);
  lines.push("Alex stacked more workshop timber, running a hand along the grain.");
  pushFiller(6);
  lines.push("Even in the evening chill she kept sanding the workshop timber, patient with the grain.");

  const surfaces = new Map([["Alex", "ref:alex"]]);
  const { bindings } = resolvePronouns(mk(lines), surfaces, OPTS);
  const she = bindings.find((b) => b.pronoun === "she");
  assert.ok(she, "no gender evidence exists for Alex, so 'she' must not be excluded");
  assert.equal(she.referentId, "ref:alex");
});

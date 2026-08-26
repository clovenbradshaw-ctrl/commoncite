import test from "node:test";
import assert from "node:assert/strict";
import { resolvePronouns } from "../adapters/text/pronouns.js";

const mk = (lines) => lines.map((text, i) => ({ text, order: i, offset: i * 1000 }));
const filler = (n) => `frame ${n} the ordinary business of the afternoon continued much as before with letters and accounts and quiet errands`;
const OPTS = { minActivation: 0.05, minMargin: 0.2 };

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
  lines.push("The garden soil there was rich, and she loved working the garden roses after rain.");
  pushFiller(3);
  lines.push("Even in the evening chill he kept sanding the workshop timber, patient with the grain.");
  return lines;
};

const SURFACES = new Map([["Elena", "ref:elena"], ["Marcus", "ref:marcus"]]);

test("pronoun operating point is declared, never defaulted", () => {
  assert.throws(() => resolvePronouns([], new Map()), /minActivation/);
  assert.throws(() => resolvePronouns([], new Map(), { minActivation: 0 }), /minMargin/);
});

test("pronoun-only scenes bind by causal thematic recall", () => {
  const { bindings, gaps } = resolvePronouns(mk(buildTwoCharacterCorpus()), SURFACES, OPTS);
  const she = bindings.find((x) => x.pronoun === "she");
  const he = bindings.find((x) => x.pronoun === "he");
  assert.equal(she?.referentId, "ref:elena");
  assert.equal(he?.referentId, "ref:marcus");
  assert.equal(gaps.length, 0);
});

test("activation beats recency", () => {
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
  const { bindings } = resolvePronouns(mk(lines), new Map([["Marcus", "ref:marcus"], ["Thomas", "ref:thomas"]]), OPTS);
  assert.equal(bindings.find((x) => x.pronoun === "he")?.referentId, "ref:marcus");
});

test("unrelated pronoun material is refused rather than guessed", () => {
  const lines = buildTwoCharacterCorpus();
  lines[lines.length - 1] = "The distant bell rang twice and he wondered about the price of bread in the market square.";
  const { bindings, gaps } = resolvePronouns(mk(lines), SURFACES, OPTS);
  assert.ok(!bindings.some((x) => x.pronoun === "he"));
  assert.ok(gaps.some((x) => x.pronoun === "he" && x.reason === "pronoun_no_candidate"));
});

test("gender is a hard filter", () => {
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
  lines.push("Even in the evening chill she kept sanding the workshop timber, patient with the grain.");
  const { bindings, gaps } = resolvePronouns(mk(lines), new Map([["Marcus", "ref:marcus"]]), OPTS);
  assert.equal(bindings.length, 0);
  assert.ok(gaps.some((x) => x.reason === "pronoun_no_candidate"));
});

// ── the activation arm: binding on the reader's own decaying present ────
import { resolvePronounsByActivation } from "../adapters/text/pronouns.js";
import { createActivation } from "../kernel/activation.js";

const ACT_OPTS = { window: 8, minActivation: 0.2, minMargin: 0.2, createActivation };

test("activation arm: the gradient is injected from the kernel, and its numbers are declared", () => {
  assert.throws(() => resolvePronounsByActivation([], new Map(), { window: 8, minActivation: 0.2, minMargin: 0.2 }), /injected/);
  assert.throws(() => resolvePronounsByActivation([], new Map(), { window: 8, createActivation, minMargin: 0.2 }), /minActivation/);
});

test("activation arm: the most recently present compatible being binds — recency, not thematic echo", () => {
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  // Marcus is named, then fades through many frames; Thomas is named just
  // before the pronoun. The THEMATIC arm binds this to Marcus (its own
  // "activation beats recency" test above, on workshop vocabulary); the
  // ACTIVATION arm must bind Thomas — that difference in one dimension is
  // exactly what having two arms measures.
  pushFiller(2);
  lines.push("Marcus stood at his workbench, running a plane along the rough workshop timber.");
  pushFiller(6);
  lines.push("Thomas coiled the harbor rope and watched his tide gauge by the pier.");
  lines.push("Even in the evening chill he kept working, patient as ever.");
  const { bindings } = resolvePronounsByActivation(mk(lines), new Map([["Marcus", "ref:marcus"], ["Thomas", "ref:thomas"]]), ACT_OPTS);
  assert.equal(bindings.find((x) => x.pronoun === "he")?.referentId, "ref:thomas",
    "the being hot in the present wins on this arm — by design, not by accident");
});

test("activation arm: everyone faded refuses below the floor; two beings comparably hot refuse on margin", () => {
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  pushFiller(2);
  lines.push("Marcus stood at his workbench with the plane and his workshop timber.");
  pushFiller(30); // window 8: 0.875^30 ≈ 0.018 — well below the declared 0.2 floor
  lines.push("Then he returned at last.");
  const faded = resolvePronounsByActivation(mk(lines), new Map([["Marcus", "ref:marcus"]]), ACT_OPTS);
  assert.ok(faded.gaps.some((g) => g.reason === "pronoun_below_floor"), "a being thirty sentences gone is not 'present'");

  const lines2 = [];
  f = 0;
  lines2.push("Marcus carried his own toolbag across the yard toward the gate.");
  lines2.push("Daniel carried his own ladder across the same yard behind him.");
  lines2.push("Then he stopped at the gate.");
  const contested = resolvePronounsByActivation(mk(lines2), new Map([["Marcus", "ref:marcus"], ["Daniel", "ref:daniel"]]), ACT_OPTS);
  assert.ok(contested.gaps.some((g) => g.reason === "pronoun_no_margin"),
    "two beings named a sentence apart are comparably present — refused as ambiguous, the way a human reader would hesitate");
});

test("activation arm: gender stays a hard filter — a hot but wrong-gendered being never binds", () => {
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  pushFiller(2);
  lines.push("Elena knelt in the garden and pressed her palms into the garden soil.");
  pushFiller(4);
  lines.push("Marcus stood at his workbench with the plane and the workshop timber.");
  lines.push("She looked out across the garden wall toward the evening light.");
  const { bindings } = resolvePronounsByActivation(mk(lines), new Map([["Elena", "ref:elena"], ["Marcus", "ref:marcus"]]), ACT_OPTS);
  const she = bindings.find((x) => x.pronoun === "she");
  assert.equal(she?.referentId, "ref:elena", "Marcus is hotter but 'she' cannot bind him — gender evidence is a wall, not a weight");
});

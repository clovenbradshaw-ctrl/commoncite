// eoreader6 · conformance/roles — perceiver/text/roles::resolveSpanRole
// held to the same discipline pronouns.test.js already established for its
// own sibling: MEANINGFUL on structured material, MEANINGLESS (or honestly
// refused) on material with no real structure to find. This suite also
// pins the two places this module deliberately DIVERGES from pronouns.js
// (no same-sentence skip rule; role is an open, caller-declared label, not
// a closed English vocabulary) as explicit, tested behavior rather than
// leaving the divergence to be rediscovered by reading two files side by
// side.

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSpanRole } from "../packages/engine/perceiver/text/roles.js";

const mk = (lines) => lines.map((text, i) => ({ text, order: i, offset: i * 1000 }));
const filler = (n) => `frame ${n} the ordinary business of the afternoon continued much as before with letters and accounts and quiet errands`;

// Unlike pronouns.test.js's OPTS (which restates host/corpus.js's REAL
// production operating point for pronoun resolution), this module has no
// real caller yet — there is no golden to restate a validated number from.
// This is an engineering starting point for exercising the MECHANISM
// (does it correctly separate a clear case from an ambiguous one, does it
// correctly refuse), the same honest debt corpus.js's own comment already
// discloses for PRONOUN_MIN_ACTIVATION/PRONOUN_MIN_MARGIN — not a claim
// that these numbers are validated for any real reading.
const OPTS = { minActivation: 0.05, minMargin: 0.2 };

test("declared numbers are declared, never defaulted", () => {
  assert.throws(() => resolveSpanRole([], []), /minActivation/);
  assert.throws(() => resolveSpanRole([], [], { minActivation: 0 }), /minMargin/);
  assert.doesNotThrow(() => resolveSpanRole([], [], { minActivation: 0, minMargin: 0 }));
});

// Two roles, each evidenced by several separated occurrences carrying
// their OWN distinctive vocabulary — the general form of pronouns.test.js's
// two-character corpus, with "role" standing in for "referent identity" as
// an arbitrary caller-declared label (nothing about "garden"/"workshop"
// means anything to this module; they are simply two role names).
const buildTwoRoleCorpus = () => {
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  const knownAt = [];

  pushFiller(3);
  knownAt.push({ order: lines.length, role: "garden" });
  lines.push("Elena knelt in the garden and pressed her palms into the warm garden soil.");
  pushFiller(3);
  knownAt.push({ order: lines.length, role: "workshop" });
  lines.push("Marcus stood at his workbench, running a plane along the rough workshop timber.");
  pushFiller(3);
  knownAt.push({ order: lines.length, role: "garden" });
  lines.push("Elena trimmed the garden roses growing along the garden wall in the soil.");
  pushFiller(3);
  knownAt.push({ order: lines.length, role: "workshop" });
  lines.push("Marcus sanded the workshop timber until the grain shone in the workshop light.");
  pushFiller(3);
  knownAt.push({ order: lines.length, role: "garden" });
  lines.push("Elena watered the garden roses again, kneeling in the soft garden soil.");
  pushFiller(3);
  knownAt.push({ order: lines.length, role: "workshop" });
  lines.push("Marcus planed another length of workshop timber, the grain pale in the light.");
  pushFiller(6);
  const gardenUnknownOrder = lines.length;
  lines.push("The garden soil there was rich, and working the garden roses after rain felt easy.");
  pushFiller(3);
  const workshopUnknownOrder = lines.length;
  lines.push("Even in the evening chill, sanding the workshop timber stayed patient with the grain.");

  return { lines, knownAt, gardenUnknownOrder, workshopUnknownOrder };
};

test("an occurrence of unknown role resolves to the role whose OWN evidenced examples it shares", () => {
  const { lines, knownAt, gardenUnknownOrder, workshopUnknownOrder } = buildTwoRoleCorpus();
  const sentences = mk(lines);
  const occurrences = [
    ...knownAt.map((k) => ({ sentenceOrder: k.order, role: k.role, id: `known-${k.order}` })),
    { sentenceOrder: gardenUnknownOrder, role: null, id: "unknown-garden" },
    { sentenceOrder: workshopUnknownOrder, role: null, id: "unknown-workshop" },
  ];

  const { bindings, gaps } = resolveSpanRole(sentences, occurrences, OPTS);
  const garden = bindings.find((b) => b.id === "unknown-garden");
  const workshop = bindings.find((b) => b.id === "unknown-workshop");
  assert.ok(garden, "the garden-vocabulary occurrence must resolve");
  assert.ok(workshop, "the workshop-vocabulary occurrence must resolve");
  assert.equal(garden.role, "garden");
  assert.equal(workshop.role, "workshop");
  assert.ok(garden.activation > 0 && workshop.activation > 0, "a real echo, not a rounding artefact");
  assert.equal(gaps.length, 0, "both occurrences had a clear, well-separated winner");
});

test("activation beats recency: a role evidenced last, but sharing no vocabulary, does not steal an occurrence whose vocabulary belongs to an earlier role", () => {
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  const known = [];
  pushFiller(3);
  known.push({ order: lines.length, role: "workshop" });
  lines.push("Marcus stood at his workbench, running a plane along the rough workshop timber.");
  pushFiller(3);
  known.push({ order: lines.length, role: "workshop" });
  lines.push("Marcus sanded the workshop timber until the grain shone in the workshop light.");
  pushFiller(3);
  known.push({ order: lines.length, role: "workshop" });
  lines.push("Marcus planed another length of workshop timber, the grain pale in the light.");
  pushFiller(6);
  known.push({ order: lines.length, role: "harbor" }); // named LAST, immediately before the ambiguous line, shares no vocabulary
  lines.push("Thomas coiled the harbor rope and watched the tide slide past the pier.");
  pushFiller(2);
  const unknownOrder = lines.length;
  lines.push("Even in the evening chill, sanding the workshop timber stayed patient with the grain.");

  const occurrences = [
    ...known.map((k, i) => ({ sentenceOrder: k.order, role: k.role, id: `known-${i}` })),
    { sentenceOrder: unknownOrder, role: null, id: "unknown" },
  ];
  const { bindings } = resolveSpanRole(mk(lines), occurrences, OPTS);
  const bound = bindings.find((b) => b.id === "unknown");
  assert.ok(bound, "the workshop-vocabulary occurrence must resolve to someone");
  assert.equal(bound.role, "workshop", "shared vocabulary must win over mere recency");
});

test("MEANINGLESS ON RANDOM MATERIAL: an occurrence sharing no evidenced role's vocabulary is refused, never guessed", () => {
  const { lines, knownAt, gardenUnknownOrder, workshopUnknownOrder } = buildTwoRoleCorpus();
  lines[workshopUnknownOrder] = "The distant bell rang twice and someone wondered about the price of bread in the market square.";
  const occurrences = [
    ...knownAt.map((k) => ({ sentenceOrder: k.order, role: k.role, id: `known-${k.order}` })),
    { sentenceOrder: gardenUnknownOrder, role: null, id: "unknown-garden" },
    { sentenceOrder: workshopUnknownOrder, role: null, id: "unknown-corrupted" },
  ];
  const { bindings, gaps } = resolveSpanRole(mk(lines), occurrences, OPTS);
  assert.ok(!bindings.some((b) => b.id === "unknown-corrupted"), "no role has any real claim on this sentence");
  assert.ok(gaps.some((g) => g.id === "unknown-corrupted" && g.reason === "role_no_candidate"));
  // The untouched garden occurrence earlier in the same document is
  // unaffected — the refusal is specific to the corrupted input, not a
  // global breakdown.
  assert.ok(bindings.some((b) => b.id === "unknown-garden" && b.role === "garden"));
});

test("DELIBERATE DIVERGENCE from pronouns.js: an unknown occurrence sharing its sentence with a FRESH known example is still resolved, using only prior sentences' evidence", () => {
  // pronouns.js refuses to attempt a pronoun that shares its sentence with
  // a named surface at all — disambiguating among several CO-PRESENT
  // candidates is a different, harder problem than the one it answers.
  // This module has no such rule (documented in roles.js's own header as a
  // deliberate non-inheritance): a role declared in the SAME sentence as an
  // unknown occurrence cannot possibly help resolve it anyway, because
  // roleByFrame is only populated for a sentence AFTER that sentence's own
  // resolution branch has already run — so "harbor," freshly declared here,
  // is never even a candidate for this occurrence, while "garden,"
  // evidenced three sentences earlier and genuinely shared, wins on its
  // own merits.
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  const known = [];
  pushFiller(3);
  known.push({ order: lines.length, role: "garden" });
  lines.push("Elena knelt in the garden and pressed her palms into the warm garden soil.");
  pushFiller(3);
  known.push({ order: lines.length, role: "garden" });
  lines.push("Elena trimmed the garden roses growing along the garden wall in the soil.");
  pushFiller(3);
  known.push({ order: lines.length, role: "garden" });
  lines.push("Elena watered the garden roses again, kneeling in the soft garden soil.");
  pushFiller(6);
  const sameSentenceOrder = lines.length;
  known.push({ order: sameSentenceOrder, role: "harbor" });
  lines.push("Thomas coiled the harbor rope, and the garden soil nearby smelled of rain and roses.");

  const occurrences = [
    ...known.map((k, i) => ({ sentenceOrder: k.order, role: k.role, id: `known-${i}` })),
    { sentenceOrder: sameSentenceOrder, role: null, id: "unknown-same-sentence" },
  ];
  const { bindings, gaps } = resolveSpanRole(mk(lines), occurrences, OPTS);
  const bound = bindings.find((b) => b.id === "unknown-same-sentence");
  assert.ok(bound, "the garden vocabulary, evidenced earlier, must still resolve this occurrence");
  assert.equal(bound.role, "garden", "the fresh same-sentence 'harbor' declaration must never be a candidate");
});

test("role is an open, caller-declared label — three simultaneous roles resolve independently, not a fixed binary vocabulary", () => {
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i++) lines.push(filler(f++)); };
  const known = [];
  pushFiller(3);
  known.push({ order: lines.length, role: "garden" });
  lines.push("Elena knelt in the garden and pressed her palms into the warm garden soil.");
  pushFiller(3);
  known.push({ order: lines.length, role: "workshop" });
  lines.push("Marcus stood at his workbench, running a plane along the rough workshop timber.");
  pushFiller(3);
  known.push({ order: lines.length, role: "harbor" });
  lines.push("Thomas coiled the harbor rope and watched the tide slide past the pier.");
  pushFiller(3);
  known.push({ order: lines.length, role: "garden" });
  lines.push("Elena trimmed the garden roses growing along the garden wall in the soil.");
  pushFiller(3);
  known.push({ order: lines.length, role: "workshop" });
  lines.push("Marcus sanded the workshop timber until the grain shone in the workshop light.");
  pushFiller(3);
  known.push({ order: lines.length, role: "harbor" });
  lines.push("Thomas coiled more harbor rope and watched the tide slide past the pier again.");
  pushFiller(6);
  const gardenOrder = lines.length;
  lines.push("The garden soil there was rich, and working the garden roses after rain felt easy.");
  pushFiller(3);
  const workshopOrder = lines.length;
  lines.push("Even in the evening chill, sanding the workshop timber stayed patient with the grain.");
  pushFiller(3);
  const harborOrder = lines.length;
  lines.push("Down at the pier the harbor rope lay coiled, and the tide kept sliding past.");

  const occurrences = [
    ...known.map((k, i) => ({ sentenceOrder: k.order, role: k.role, id: `known-${i}` })),
    { sentenceOrder: gardenOrder, role: null, id: "unknown-garden" },
    { sentenceOrder: workshopOrder, role: null, id: "unknown-workshop" },
    { sentenceOrder: harborOrder, role: null, id: "unknown-harbor" },
  ];
  const { bindings, gaps } = resolveSpanRole(mk(lines), occurrences, OPTS);
  assert.equal(bindings.find((b) => b.id === "unknown-garden")?.role, "garden");
  assert.equal(bindings.find((b) => b.id === "unknown-workshop")?.role, "workshop");
  assert.equal(bindings.find((b) => b.id === "unknown-harbor")?.role, "harbor");
  assert.equal(gaps.length, 0);
});

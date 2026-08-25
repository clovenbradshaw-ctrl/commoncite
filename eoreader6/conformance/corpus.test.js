// eoreader6 · conformance/corpus — host-tier cast discovery and its
// language-received abbreviation prior. No coverage existed for
// sessionReferents/discoveredCast before this suite.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createSession, admitChunked, sessionReferents } from "../packages/host/corpus.js";

// Long enough that "Mrs Darcy" recurs across multiple sentences — the exact
// regression bin/priors/lang/en.json's own notes measure against (Pride and
// Prejudice: 0 -> 249 occurrences kept intact with the prior, 0 -> 0 derived).
const TITLED_TEXT = [
  "Mrs. Darcy walked into the room. Everyone turned to look at Mrs. Darcy.",
  "Elizabeth greeted Mrs. Darcy politely. Mrs. Darcy said very little.",
  "Later, Mrs. Darcy left without a word. No one understood Mrs. Darcy that evening.",
].join(" ");

test("sessionReferents: with no declared language, behaviour is exactly the engine's derived fallback (unchanged for every existing caller)", () => {
  const session = createSession();
  admitChunked(session, { text: TITLED_TEXT, sourceId: "source:titled.txt" });
  const { referents, gaps } = sessionReferents(session, { sourceId: "source:titled.txt" });
  // Without a prior, "Mrs." falls outside the derived fallback's own length
  // bar (documented in spans.js: comes out at ~2 characters on real prose,
  // so a 3-character title is out of reach by construction) and is not
  // recognised as an abbreviation, so "Darcy" is severed from "Mrs." at
  // sentence boundaries — the documented limit this prior exists to fix.
  assert.ok(!gaps.some((g) => g.reason === "no_abbreviation_prior_for_language"));
  const surfaces = referents.flatMap((r) => r.surfaces ?? []);
  assert.ok(!surfaces.includes("Mrs Darcy"), "without a prior, the titled form should not survive intact");
});

test("sessionReferents: language: \"en\" loads bin/priors/lang/en.json and keeps the titled name intact", () => {
  const session = createSession();
  admitChunked(session, { text: TITLED_TEXT, sourceId: "source:titled-en.txt", language: "en" });
  const { referents, gaps } = sessionReferents(session, { sourceId: "source:titled-en.txt" });
  assert.ok(!gaps.some((g) => g.reason === "no_abbreviation_prior_for_language"));
  const surfaces = referents.flatMap((r) => r.surfaces ?? []);
  assert.ok(surfaces.includes("Mrs Darcy"), "with the English prior, the titled form should survive intact");
});

test("sessionReferents: an unknown declared language reports a typed gap and still falls back, never a crash", () => {
  const session = createSession();
  admitChunked(session, { text: TITLED_TEXT, sourceId: "source:titled-xx.txt", language: "xx-not-a-real-language" });
  const { gaps } = sessionReferents(session, { sourceId: "source:titled-xx.txt" });
  assert.ok(gaps.some((g) => g.reason === "no_abbreviation_prior_for_language"));
});

// ── cross-document cast: sourceId as an array ───────────────────────────────
//
// Challenge #25 ("cross-document identity at corpus scale") found
// sessionReferents hard-scoped to exactly one sourceId, with no path anywhere
// in the host that ever pooled two documents' discovered casts — so a name
// and its own variant form, split across two sources, never merged, no
// matter how literal the overlap. `sourceId` accepting an array is the fix:
// same discoverReferents/namesCorefer engine-tier coreference the
// single-document path already uses, run once over the union.
//
// "Voss" (not "Kade") is deliberately the shared token here: each document
// gives it exactly ONE modifying title, so the token is NOT generic within
// either document alone (genericTokens flags a token only when it recurs
// with MULTIPLE different partners inside one document's own material) and
// the merge is expected to succeed. A companion fixture below intentionally
// makes its shared token generic within its own document, to test that the
// same conservative refusal namesCorefer already applies inside one document
// is preserved rather than bypassed once pooled.
const VOSS_NAVAL_TEXT =
  "Captain Elena Voss commanded the northern fleet during the long campaign. " +
  "Captain Elena Voss later resigned her post after the incident. " +
  "The service record lists Captain Elena Voss as reprimanded.";
const VOSS_COURT_TEXT =
  "A petition was filed against Colonel Voss following the inquiry. " +
  "The register states that Colonel Voss held command during the incident. " +
  "Colonel Voss was later cleared of formal charges.";
const UNRELATED_TEXT =
  "Captain Selvi Odrun filed this deposition after the wreck. " +
  "According to Odrun's own account, the ship went down within the hour. " +
  "No further word of Selvi Odrun reached the Archive after that day.";

function vossSession() {
  const session = createSession();
  admitChunked(session, { text: VOSS_NAVAL_TEXT, sourceId: "source:corpus/naval.txt" });
  admitChunked(session, { text: VOSS_COURT_TEXT, sourceId: "source:corpus/court.txt" });
  admitChunked(session, { text: UNRELATED_TEXT, sourceId: "source:corpus/unrelated.txt" });
  return session;
}

test("sessionReferents: sourceId as an array pools name-variant coreference across documents (containment/shared-final-token, same engine-tier rule as within one document)", () => {
  const session = vossSession();
  const { referents, sourceIds } = sessionReferents(session, {
    sourceId: ["source:corpus/naval.txt", "source:corpus/court.txt"],
  });
  assert.deepEqual(sourceIds, ["source:corpus/naval.txt", "source:corpus/court.txt"]);
  const voss = referents.find((r) => r.surfaces.includes("Elena Voss"));
  assert.ok(voss, "the naval document's own name form must survive pooling");
  assert.ok(
    voss.surfaces.includes("Colonel Voss"),
    `expected the court document's variant form on the SAME referent, got surfaces ${JSON.stringify(voss.surfaces)}`,
  );
});

test("sessionReferents: a cross-document merge keeps each source's own mentions separately attributed (the provenance half of the claim)", () => {
  const session = vossSession();
  const { referents } = sessionReferents(session, {
    sourceId: ["source:corpus/naval.txt", "source:corpus/court.txt"],
  });
  const voss = referents.find((r) => r.surfaces.includes("Elena Voss"));
  assert.ok(Array.isArray(voss.sources) && voss.sources.length === 2, "both sources contributed mentions");
  const naval = voss.sources.find((s) => s.sourceId === "source:corpus/naval.txt");
  const court = voss.sources.find((s) => s.sourceId === "source:corpus/court.txt");
  assert.ok(naval && naval.mentions > 0, "naval source's own mentions must be counted against ITS OWN chunks");
  assert.ok(court && court.mentions > 0, "court source's own mentions must be counted against ITS OWN chunks");
  assert.equal(naval.mentions + court.mentions, voss.mentions, "the merged total is exactly the sum of the per-source counts, nothing lost or double-counted");
  // Neither source's own mentions leaked onto the OTHER source's tally: the
  // court document never wrote "Elena Voss" and the naval document never
  // wrote "Colonel Voss", so each source's count must reflect ONLY its own
  // text, not the merged surface set double-matching across documents.
  assert.equal(naval.mentions, 3, "naval.txt's own 3 mentions of \"Captain Elena Voss\"");
  assert.equal(court.mentions, 3, "court.txt's own 3 mentions of \"Colonel Voss\"");
});

test("sessionReferents: pooling documents never merges genuinely unrelated names (no false positive from the wider pool)", () => {
  const session = vossSession();
  const { referents } = sessionReferents(session, {
    sourceId: ["source:corpus/naval.txt", "source:corpus/court.txt", "source:corpus/unrelated.txt"],
  });
  const voss = referents.find((r) => r.surfaces.includes("Elena Voss"));
  const odrun = referents.find((r) => r.surfaces.some((s) => s.includes("Odrun")));
  assert.ok(voss && odrun, "both beings must still be discovered");
  assert.notEqual(voss.id, odrun.id, "Voss and Odrun are two different people and must not fold into one referent");
});

// A companion fixture where the shared token IS generic within its own
// document (naval.txt uses "Kade" under two DIFFERENT titles, "Marcus
// Aurelius Kade" and "Admiral Kade" — the same ambiguity-inside-one-document
// pattern genericTokens exists to catch, same as "Rostóv"/"Princess" in
// surfaces.js's own header) — the conservative refusal to merge on a
// title/surname alone must survive pooling unchanged, exactly as it already
// holds within one document.
const KADE_NAVAL_TEXT =
  "In the third year of the campaign, Marcus Aurelius Kade took command of the fleet. " +
  "Records describe Admiral Kade as exacting and rarely present at shore functions. " +
  "This record closes the service file of Marcus Aurelius Kade, entered as unresolved.";
const KADE_COURT_TEXT =
  "A petition was entered before the Council on behalf of the petitioner known as Vessa Kade. " +
  "The register states that Vessa Kade had held the coastal holding since inheriting it. " +
  "The petition for reinstatement, entered by counsel on behalf of Vessa Kade, was denied.";

function kadeSession() {
  const session = createSession();
  admitChunked(session, { text: KADE_NAVAL_TEXT, sourceId: "source:corpus/kade-naval.txt" });
  admitChunked(session, { text: KADE_COURT_TEXT, sourceId: "source:corpus/kade-court.txt" });
  admitChunked(session, { text: UNRELATED_TEXT, sourceId: "source:corpus/unrelated.txt" });
  return session;
}

test("sessionReferents: pooling does not launder a merge namesCorefer already refuses within one document (a token generic to ITS OWN document stays generic pooled)", () => {
  const session = kadeSession();
  const { referents } = sessionReferents(session, {
    sourceId: ["source:corpus/kade-naval.txt", "source:corpus/kade-court.txt"],
  });
  const kade = referents.find((r) => r.surfaces.includes("Marcus Aurelius Kade"));
  const vessa = referents.find((r) => r.surfaces.some((s) => /vessa/i.test(s)));
  assert.ok(kade && vessa, "both documents' own referents must still be discovered");
  assert.notEqual(
    kade.id,
    vessa.id,
    "\"Kade\" is ambiguous within naval.txt's own text (two different titles) — pooling must not treat that ambiguity as license to merge across documents on the bare surname",
  );
});

test("sessionReferents: pooling with an UNRELATED document does not undo a within-document merge that succeeds standalone", () => {
  // Regression for a bug found while building the cross-document fix itself:
  // genericTokens' fence, and deriveMinSentences' recurrence floor, are both
  // statistics over whatever surface pool they are handed — correct for one
  // document, but pooling a same-source name/title pair ("Marcus Aurelius" /
  // "Marcus Aurelius Kade", which merge on their own) together with a wholly
  // unrelated document's own material diluted BOTH statistics and silently
  // broke the standalone merge (the fence wrongly bracketed "marcus" and
  // "aurelius" as generic too; separately, the recurrence floor rose past
  // what a short document's own candidates could clear and dropped the
  // referent entirely) — even though the unrelated document shares nothing
  // with either name. discoverReferents's `groups` option keeps both
  // document-local; this is the regression test for it.
  const session = kadeSession();
  const standalone = sessionReferents(session, { sourceId: "source:corpus/kade-naval.txt" });
  const standaloneKade = standalone.referents.find((r) => r.surfaces.includes("Marcus Aurelius Kade"));
  assert.ok(standaloneKade.surfaces.includes("Marcus Aurelius"), "sanity: the standalone document merges its own name/title pair");

  const pooled = sessionReferents(session, {
    sourceId: ["source:corpus/kade-naval.txt", "source:corpus/unrelated.txt"],
  });
  const pooledKade = pooled.referents.find((r) => r.surfaces.includes("Marcus Aurelius Kade"));
  assert.ok(pooledKade, "the naval document's referent must still be discovered when pooled");
  assert.ok(
    pooledKade.surfaces.includes("Marcus Aurelius"),
    `pooling with an unrelated document must not undo kade-naval.txt's OWN merge; got surfaces ${JSON.stringify(pooledKade.surfaces)}`,
  );
});

test("sessionReferents: sourceId as an array reports one gap per unknown document and still returns real referents for the known ones", () => {
  const session = vossSession();
  const { referents, gaps } = sessionReferents(session, {
    sourceId: ["source:corpus/naval.txt", "source:corpus/does-not-exist.txt"],
  });
  assert.ok(gaps.includes("unknown document source:corpus/does-not-exist.txt"));
  assert.ok(referents.some((r) => r.surfaces.includes("Elena Voss")));
});

test("sessionReferents: a single-string sourceId call never sees another document's surfaces, even after an array call already pooled them in the same session", () => {
  const session = vossSession();
  sessionReferents(session, { sourceId: ["source:corpus/naval.txt", "source:corpus/court.txt"] });
  const after = sessionReferents(session, { sourceId: "source:corpus/naval.txt" });
  const voss = after.referents.find((r) => r.surfaces.includes("Elena Voss"));
  assert.ok(voss, "naval.txt's own referent still discovered");
  assert.ok(
    !voss.surfaces.includes("Colonel Voss"),
    "a single-string sourceId call must stay single-document-scoped regardless of a prior array call on the same session",
  );
});

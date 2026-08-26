import test from "node:test";
import assert from "node:assert/strict";
import {
  descriptorOccurrence,
  directDescriptorOccurrences,
  descriptorHypotheses,
} from "../adapters/text/individuation.js";
import {
  appositionalDescriptorBindings,
  projectDiscourseReferents,
} from "../adapters/text/discourse-referents.js";

test("pronouns never become referent occurrences", () => {
  for (const surface of ["I", "it", "he", "she", "they", "you", "who"]) {
    const occ = descriptorOccurrence({ standing: "unresolved_surface", surface, role: "subject" }, { encounterRef: "e:1" });
    assert.equal(occ, null, surface);
  }
});

test("relation descriptors require determiner evidence", () => {
  const good = descriptorOccurrence({ standing: "unresolved_surface", surface: "the creature", occurrence: "occ:1", role: "subject" }, { encounterRef: "e:1", edge: { id: "edge:1", relation: "entered" } });
  assert.equal(good?.schema, "EOReferentOccurrence@1");
  assert.equal(good?.determination, "definite");
  for (const surface of ["old man", "young girl", "when I", "have been", "borne away", "fiend"]) {
    assert.equal(descriptorOccurrence({ standing: "unresolved_surface", surface }, { encounterRef: "e:1" }), null, surface);
  }
});

test("direct witness detects determiner descriptions without relation extraction", () => {
  const found = directDescriptorOccurrences("I saw the creature beside my father. The creature fled from this place.", { encounterRef: "e:1" });
  assert.ok(found.some((x) => x.canonicalSurface === "the creature"));
  assert.ok(found.some((x) => x.canonicalSurface === "my father"));
  assert.ok(found.some((x) => x.canonicalSurface === "this place"));
});

test("same-surface recurrence earns a hypothesis but not a being", () => {
  const [a] = directDescriptorOccurrences("The creature entered.", { encounterRef: "e:1" });
  const [b] = directDescriptorOccurrences("The creature vanished.", { encounterRef: "e:2" });
  const [hypothesis] = descriptorHypotheses([a, b]);
  assert.equal(hypothesis?.schema, "EOIdentityHypothesis@1");
  assert.equal(hypothesis?.standing, "live_hypothesis");
  assert.deepEqual(projectDiscourseReferents([a, b]), []);
});

test("explicit apposition binds occurrences into a contextual referent", () => {
  const binding = appositionalDescriptorBindings(
    "I beheld the wretch—the miserable monster whom I had created.",
    { encounterRef: "e:640", witness: "w:640" },
  );
  assert.equal(binding.links.length, 1);
  assert.equal(binding.occurrences.length, 2);
  assert.equal(binding.occurrences[0].canonicalSurface, "the wretch");
  assert.equal(binding.occurrences[1].canonicalSurface, "the monster");
  const [referent] = projectDiscourseReferents([...binding.occurrences, ...binding.links]);
  assert.equal(referent?.schema, "EOReferent@1");
  assert.equal(referent?.standing, "provisional");
  assert.deepEqual(new Set(referent.surfaces), new Set(["the wretch", "the monster"]));
});

test("same surface in an unrelated occurrence is not pulled into an appositional cluster", () => {
  const binding = appositionalDescriptorBindings(
    "I beheld the wretch—the miserable monster whom I had created.",
    { encounterRef: "e:640", witness: "w:640" },
  );
  const [femaleCreature] = directDescriptorOccurrences(
    "The wretch saw me destroy the creature on whose future existence he depended.",
    { encounterRef: "e:2436" },
  ).filter((x) => x.canonicalSurface === "the wretch");
  const creature = directDescriptorOccurrences(
    "The wretch saw me destroy the creature on whose future existence he depended.",
    { encounterRef: "e:2436" },
  ).find((x) => x.canonicalSurface === "the creature");
  const [referent] = projectDiscourseReferents([...binding.occurrences, ...binding.links, femaleCreature, creature]);
  assert.ok(referent.occurrenceRefs.every((id) => id !== creature.id));
  assert.ok(!referent.surfaces.includes("the creature"));
});

// ── the singleton-partner rescue ────────────────────────────────────────
import { extractSurfaces as xs2, discoverReferents as dr2 } from "../adapters/text/surfaces.js";

const corpus = (lines) => lines.map((text, i) => ({ text, order: i }));
const refIdOf = (events, surface) => events.find((e) => e.type === "DEF.admit" && e.surface === surface)?.referent_id;

test("singleton-partner rescue: a bare family name with ONE evidence-worthy bearer merges; two bearers stay split — the Princess wall holds", () => {
  // Clerval-shaped, at fixture scale: the fence is DECLARED (2 — a derived
  // fence needs corpus-scale spread and this is a unit fixture, exactly the
  // case genericTokens' own header names) and 'marlowe' is made generic the
  // way 'clerval' really was: junk one-off surfaces ("Chapter Marlowe")
  // give it phantom partners, while its EVIDENCE-WORTHY partner is Edmund
  // alone. The rescue must read the floor-filtered partners, not the raw
  // ones — that distinction is the fix.
  // Names sit MID-sentence throughout: a sentence-initial capital is
  // position, not identity, and extractSurfaces rightly refuses it.
  const one = [
    "That winter Edmund Marlowe rode out early past the mill and the weir gate.",
    "By then Edmund Marlowe kept his ledger closed against the cold all season.",
    "At last Edmund Marlowe answered the summons before the frost had left the glass.",
    "See the notes in Chapter Marlowe for the weir accounts.",
    "They still called him Old Marlowe at the mill.",
    "At dusk Marlowe returned by the marsh road and said nothing of the weir.",
    "For a while Marlowe stood at the gate before knocking at the mill door.",
    "That night Marlowe wrote two letters and burned the second one unread.",
    "Down the road Kate watched. Near the mill Kate waited. All month Kate counted the days.",
  ];
  const a = dr2(xs2(corpus(one), {}), { minPartners: 2, minSentences: 1 });
  const bare = refIdOf(a.events, "Marlowe");
  const full = refIdOf(a.events, "Edmund Marlowe");
  assert.ok(bare && full, "both surfaces must actually be admitted — a vacuous fixture pins nothing");
  assert.equal(bare, full, "one evidence-worthy partner in the whole corpus = one possible bearer (S9: low sets possible)");

  // Princess-shaped: 'vane' is equally generic, but TWO evidence-worthy
  // bearers exist — bare 'Vane' has two possible referents and must merge
  // with neither.
  const many = [
    "By the window Mary Vane sat with her letters and her maps of the coast.",
    "Twice over Mary Vane read the tide tables and marked the third crossing out.",
    "Before dark Mary Vane sealed the answer as the lamp burned down.",
    "In the hall Helena Vane argued about the coast and the letters again.",
    "Even so Helena Vane would not sign, and said so before the fire died.",
    "Overnight Helena Vane left the map unrolled across the long table.",
    "See the appendix to Chapter Vane for the tide accounts.",
    "At the coast house Vane was expected before the letters arrived that night.",
    "In the end Vane never came, and the tide tables stayed open.",
  ];
  const b = dr2(xs2(corpus(many), {}), { minPartners: 2, minSentences: 1 });
  const vane = refIdOf(b.events, "Vane");
  const mary = refIdOf(b.events, "Mary Vane");
  const helena = refIdOf(b.events, "Helena Vane");
  assert.ok(vane && mary && helena, "all three surfaces admitted — the wall is actually exercised");
  assert.notEqual(vane, mary, "two possible bearers — the rescue must not fire");
  assert.notEqual(vane, helena, "two possible bearers — the rescue must not fire");
});

// ── the witnessed merge: transitivity through a compound surface ────────
//
// Found by the-fold's MHC battery (order 5, Nominal — POLICIES.md P44
// there): on both Wikipedia fixtures the fold gathered 23/24 and 10/12 of
// the pairs its own individuation rule calls one being, and every miss was
// one shape — a bare token stranded while the compound containing it merged
// with the OTHER bare token first. `Mikhail Kutuzov` corefers with BOTH
// `Mikhail` and `Kutuzov`; the assignment loop took the first match and
// broke, so which single-token form stranded was decided by scan order.
// "Is the same being as" is transitive; a greedy first-match closure over
// the pairwise rule is not. The compound surface is a WITNESS that the two
// groups co-name one being, and the fix merges exactly on that witness —
// never on chained pairwise similarity alone.
test("a compound surface coreferent with two prior referents witnesses them as one being", () => {
  const lines = [
    "That morning General Kutuzov rode past the mill and said nothing of it.",
    "By noon staff found Kutuzov at the weir gate reading the dispatches twice.",
    "Later still Kutuzov signed the order and sent the rider south at dusk.",
    "At the council Kutuzov spoke last and briefly, as was his habit.",
    "The elder Mikhail kept his own counsel through the first reading.",
    "Old friends called Mikhail stubborn long before the war made it useful.",
    "They said Mikhail would not move the army for any letter from court.",
    "The full name Mikhail Kutuzov appeared once on the order of the day.",
    "Clerks wrote Mikhail Kutuzov again beneath the seal before it was sent.",
    "Down the road Kate watched. Near the mill Kate waited. All month Kate counted the days.",
  ];
  const d = dr2(xs2(corpus(lines), {}), { minPartners: 2, minSentences: 1 });
  const bare1 = refIdOf(d.events, "Mikhail");
  const bare2 = refIdOf(d.events, "Kutuzov");
  const full = refIdOf(d.events, "Mikhail Kutuzov");
  assert.ok(bare1 && bare2 && full, "all three surfaces must actually be admitted — a vacuous fixture pins nothing");
  assert.equal(bare1, full, "the compound gathers its first-name form");
  assert.equal(bare2, full, "the compound gathers its surname form — the stranding this test exists for");
});

test("the witnessed merge never crosses the ambiguity wall: two bearers of one first name stay apart", () => {
  // The Princess/Vane wall, first-name-shaped, and the case that makes blind
  // union-find (and the OLD match-any-member scan) wrong: before the
  // witnessed-merge fix, this exact fixture put BOTH compounds in ONE
  // referent — two generals merged through a bare first name sitting at
  // (not above) the generic fence, whenever the bare form was assigned
  // first. The wall this test pins is bearer separation. Where the bare
  // fragment lands is order-dependent by construction — the pairwise
  // relation here (M~MK, M~MB, MK≁MB) admits NO violation-free partition,
  // and {M,MK},{MB} is a minimal-violation reading; revising it when the
  // second bearer arrives is revision.js's work, not this loop's — so this
  // test deliberately does not pin the fragment.
  const lines = [
    "At dawn Mikhail Kutuzov read the first dispatch beside the map table.",
    "By evening Mikhail Kutuzov had signed nothing and said less than that.",
    "Meanwhile Mikhail Barclay argued for the withdrawal along the north road.",
    "In the council Mikhail Barclay stood alone against the older marshals.",
    "Some said Mikhail favoured caution above any glory the court could offer.",
    "Others said Mikhail had already chosen and would not be moved from it.",
    "Down the road Kate watched. Near the mill Kate waited. All month Kate counted the days.",
  ];
  const d = dr2(xs2(corpus(lines), {}), { minPartners: 2, minSentences: 1 });
  const kutuzov = refIdOf(d.events, "Mikhail Kutuzov");
  const barclay = refIdOf(d.events, "Mikhail Barclay");
  assert.ok(kutuzov && barclay, "both bearers must actually be admitted");
  assert.notEqual(kutuzov, barclay, "two bearers never merge through their shared first name");
});

test("a bare fragment matching two established bearers is a typed gap with candidates, never a third being", () => {
  // The subset direction of the witness rule, landed at the right LAYER.
  // Bare "Mikhail" corefers with the maximal evidence of BOTH established
  // bearers and contains neither — the type level can say exactly that and
  // no more. Admitting it as its own referent would assert a third being
  // that does not exist; joining either group would guess. So admission is
  // WITHHELD and the form lands as an `ambiguous_surface` gap naming its
  // candidates — each of its MENTIONS is an occurrence-level question for
  // the activation machinery (the same recall resolvePronouns performs),
  // never this loop's to answer. (Before the fix, first-match-break
  // silently handed the whole form to whichever group the scan reached
  // first.)
  const lines = [
    "At dawn Mikhail Kutuzov read the first dispatch beside the map table.",
    "By evening Mikhail Kutuzov had signed nothing and said less than that.",
    "At last Mikhail Kutuzov chose the older road and the longer delay.",
    "Meanwhile Mikhail Barclay argued for the withdrawal along the north road.",
    "In the council Mikhail Barclay stood alone against the older marshals.",
    "By autumn Mikhail Barclay had ceded the command without one word more.",
    "Some said Mikhail favoured caution above any glory the court could offer.",
    "Others said Mikhail had already chosen and would not be moved from it.",
    "Down the road Kate watched. Near the mill Kate waited. All month Kate counted the days.",
  ];
  const d = dr2(xs2(corpus(lines), {}), { minPartners: 2, minSentences: 1 });
  const kutuzov = refIdOf(d.events, "Mikhail Kutuzov");
  const barclay = refIdOf(d.events, "Mikhail Barclay");
  assert.ok(kutuzov && barclay, "both bearers must actually be admitted");
  assert.notEqual(kutuzov, barclay);
  assert.equal(refIdOf(d.events, "Mikhail"), undefined, "an ambiguous form is never admitted as a being");
  const gap = d.gaps.find((g) => g.reason === "ambiguous_surface" && g.surface === "Mikhail");
  assert.ok(gap, "the withholding is a typed gap, not silence");
  assert.deepEqual([...gap.candidates].sort(), [barclay, kutuzov].sort(), "the gap carries exactly the two candidate referents");
  assert.match(gap.detail, /occurrence-level/);
});

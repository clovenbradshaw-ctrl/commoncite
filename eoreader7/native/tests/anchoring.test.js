import test from "node:test";
import assert from "node:assert/strict";
import { createDescriptorAnchoring, identityEvidenceFromAnchors } from "../adapters/text/anchoring.js";
import { directDescriptorOccurrences } from "../adapters/text/individuation.js";
import { reviseTextFold } from "../adapters/text/revision.js";
import { receivedGround, applyDelta } from "../kernel/fold.js";

const OPTS = { minActivation: 0.05, minMargin: 0.2 }; // host/corpus.js's own declared, disclosed-as-unvalidated operating point
const REFERENTS = [
  { id: "ref:elena", display: "Elena", surfaces: ["Elena"] },
  { id: "ref:marcus", display: "Marcus", surfaces: ["Marcus"] },
];

const filler = (n) => `frame ${n} the ordinary business of the afternoon continued much as before with letters and accounts and quiet errands`;

// Same dialect as pronouns.test.js's two-character corpus: Elena lives in
// garden vocabulary, Marcus in workshop vocabulary; the descriptor scene
// carries one theme's vocabulary and NO name.
const corpus = (descriptorLine) => {
  const lines = [];
  let f = 0;
  const pushFiller = (k) => { for (let i = 0; i < k; i += 1) lines.push(filler(f++)); };
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
  lines.push(descriptorLine);
  return lines;
};

const run = (lines, referents = REFERENTS) => {
  const anchoring = createDescriptorAnchoring(OPTS);
  const all = { evidence: [], gaps: [] };
  lines.forEach((text, order) => {
    const sentence = { text, order, offset: order * 1000 };
    const occs = directDescriptorOccurrences(text, { encounterRef: `encounter:${order}` });
    const out = anchoring.observe(sentence, occs, referents);
    all.evidence.push(...out.evidence);
    all.gaps.push(...out.gaps);
  });
  return all;
};

test("anchoring operating point is declared, never defaulted", () => {
  assert.throws(() => createDescriptorAnchoring(), /minActivation/);
  assert.throws(() => createDescriptorAnchoring({ minActivation: 0 }), /minMargin/);
});

test("a name-free descriptor scene binds to the thematically recalled referent", () => {
  // "light" recurs in Marcus's workshop frames, so BOTH referents score —
  // real competition, which the no-competition rule requires — and the
  // garden vocabulary still makes Elena the clear winner.
  const { evidence } = run(corpus("The gardener knelt by the garden roses in the light, working the garden soil."));
  const bound = evidence.find((e) => e.descriptor === "the gardener");
  assert.ok(bound, "the descriptor binds");
  assert.equal(bound.referent, "ref:elena");
  assert.ok(bound.margin >= OPTS.minMargin);
});

test("a descriptor whose context recalls no referent-bearing frame refuses with a typed gap, never a guess", () => {
  // The scene speaks only the filler register — its recall lands on frames
  // that name nobody, so there is nothing to bind to. (A hand-balanced
  // "equally both themes" sentence was tried first and BOUND anyway —
  // recall found a real margin in it; constructing knife-edge ambiguity by
  // hand is tuning against the answer, so the structural case is tested
  // instead: vocabulary that genuinely activates no referent.)
  const { evidence, gaps } = run(
    corpus("The visitor reviewed the ordinary letters and accounts of the afternoon before the quiet errands."),
  );
  assert.equal(evidence.find((e) => e.descriptor === "the visitor"), undefined);
  const gap = gaps.find((g) => g.descriptor === "the visitor");
  assert.ok(gap, "a typed gap is reported");
  assert.match(gap.reason, /descriptor_(no_margin|no_candidate|below_floor)/);
});

test("a single-candidate binding is refused — a margin against nothing is not a measurement", () => {
  // Pure garden vocabulary: only Elena's frames recall, so there is no
  // runner-up to measure a margin against. The pre-fix behavior bound
  // this at a vacuous margin of 1.0 (measured on Frankenstein's opening
  // letters, where a one-character stretch bound every descriptor —
  // "the stranger" included — to the only admitted referent).
  const { evidence, gaps } = run(corpus("The gardener knelt again by the garden roses, working the garden soil."));
  assert.equal(evidence.find((e) => e.descriptor === "the gardener"), undefined);
  const gap = gaps.find((g) => g.descriptor === "the gardener");
  assert.equal(gap?.reason, "descriptor_no_competition");
});

test("a descriptor sharing its sentence with a name is left alone — no adjudication", () => {
  const { evidence, gaps } = run(corpus("Marcus watched the gardener from the doorway."));
  assert.equal(evidence.find((e) => e.descriptor === "the gardener"), undefined);
  assert.equal(gaps.find((g) => g.descriptor === "the gardener"), undefined);
});

test("indefinite descriptors are never anchored — recurrence of 'a servant' does not imply one being", () => {
  const { evidence, gaps } = run(corpus("A gardener knelt by the garden roses in the garden soil."));
  assert.equal(evidence.find((e) => e.descriptor === "a gardener"), undefined);
  assert.equal(gaps.find((g) => g.descriptor === "a gardener"), undefined);
});

test("anchors convert to identity supports; a conflicting anchor attacks the live alternative", () => {
  const anchor = (descriptor, referentSurface, order) => ({
    schema: "EOAnchorEvidence@1",
    id: `anchor:${order}:x`,
    descriptor,
    referentSurface,
    referent: `ref:${referentSurface.toLowerCase()}`,
    witness: `text:${order}:anchor`,
    provenance: { giver: "text/anchoring::createDescriptorAnchoring" },
  });
  const first = identityEvidenceFromAnchors([anchor("the gardener", "Elena", 30)], { unresolvedAlternatives: [] });
  assert.equal(first.supports.length, 1);
  assert.deepEqual([first.supports[0].left, first.supports[0].right], ["the gardener", "elena"]);
  assert.equal(first.attacks.length, 0);

  const liveAlt = {
    schema: "EOIdentityAlternative@1",
    id: "identity:elena:the_gardener",
    left: "elena",
    right: "the gardener",
    standing: "live_hypothesis",
  };
  const second = identityEvidenceFromAnchors([anchor("the gardener", "Marcus", 60)], { unresolvedAlternatives: [liveAlt] });
  assert.equal(second.supports.length, 1, "the new binding still supports its own pair");
  assert.equal(second.attacks.length, 1, "and attacks the live alternative it contradicts");
  assert.deepEqual([second.attacks[0].left, second.attacks[0].right], ["elena", "the gardener"]);
});

test("end to end through reviseTextFold: an anchor opens a live alternative on the fold", async () => {
  const observation = {
    schema: "Observation@1",
    id: "observation:t",
    witness: "The gardener knelt again by the garden roses.",
    graphEntries: [
      {
        schema: "EOAnchorEvidence@1",
        id: "anchor:30:the_gardener",
        descriptor: "the gardener",
        referentSurface: "Elena",
        referent: "ref:elena",
        witness: "text:30:anchor:the_gardener",
        provenance: { giver: "text/anchoring::createDescriptorAnchoring" },
      },
    ],
  };
  const delta = await reviseTextFold({ observations: [observation], fold: receivedGround({}) });
  const opened = delta.operations.find((op) => op.consequence?.kind === "identity_hypothesis_opened" && op.payload?.action === "alternative");
  assert.ok(opened, "the anchor reaches deriveIdentityRevision and opens an alternative");
  const fold = applyDelta(receivedGround({}), delta);
  const alt = (fold.unresolvedAlternatives ?? []).find((x) => x.left === "elena" && x.right === "the gardener");
  assert.ok(alt, "the alternative lands on the fold");
  assert.equal(alt.standing, "live_hypothesis");
});

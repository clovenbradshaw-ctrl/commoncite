// native/eval/nested-narration.mjs — read Frankenstein the way a person does:
// keeping track of who is telling it.
//
// The book is Walton writing to his sister about Victor, who tells him about
// the creature, who tells Victor about the cottagers. A reader holds all four
// apart. Until this driver, this repo's reading did not: every relation
// extracted from the creature's own account of Felix and Safie entered the
// reading exactly like a relation from Walton's own eyes.
//
// ASSEMBLY, NAMED (P0): the causal text perceiver stepped in order, plus
// adapters/text/attribution.js for frames, plus kernel/perspective.js for the
// projection. The revision/fold tier and the binding layer are NOT run.
//
// PRIORS, STATED (P3/S7):
//   - narratorSpans, from the human-curated pg84 coref prior. Not authored
//     here: the prior already carried them, anchored to the book's own frame
//     seams, and the search that found them is the reason no second prior
//     file exists.
//   - the relay chain (Walton > Victor > creature) is DECLARED, citing the
//     same prior's own note verbatim. It is not derived from the spans:
//     their representation is a flat partition, and reading nesting out of a
//     partition would be an inference wearing a measurement's clothes.
//
// Usage: node native/eval/nested-narration.mjs <book.txt> --coref <prior.json>

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { narrationFrames, quotationFrames, holderAt } from "../adapters/text/attribution.js";
import { deltaFold } from "../kernel/fold.js";
import { READER, STANCE, projectPerspectives, commonGround, divergence, mentalModel, perspectiveOperation } from "../kernel/perspective.js";
import { FIRST_PERSON, FIRST_PERSON_META } from "../../legacy-eoreader6.1/packages/engine/perceiver/text/priors.js";
import { castSurfaceMap, bindNarrationFrames, pronounResolver, claimEndKey } from "../adapters/text/perspective-claims.js";
import { resolvePronounsByActivation } from "../adapters/text/pronouns.js";
import { createActivation } from "../kernel/activation.js";
import { createSession, admitChunked, sessionReferents } from "../../legacy-eoreader6.1/packages/host/corpus.js";

// Declared, not defaulted, and borrowed rather than invented: host/corpus.js's
// own operating point for this organ. Its own header says no golden exists for
// pronoun binding, so these are disclosed-as-unvalidated, and moving them is
// expected rather than a regression.
const PRONOUN_RECALL = { minActivation: 0.05, minMargin: 0.2 };

// The activation arm's own numbers, separately declared because the scale is
// different (arrival units: 1 = one full naming, undecayed). window 8 is the
// DMD-MEASURED reach of "who is this stretch about" on this book's own first
// quarter (terrain-activation-live, derive named there); 0.2 is the floor at
// which a single naming has faded past ~12 sentences at the measured gamma —
// disclosed-as-unvalidated exactly like the thematic arm's numbers.
const PRONOUN_PRESENT = { window: 8, minActivation: 0.2, minMargin: 0.2, createActivation };

// DECLARED, with its giver: the coref prior's own note — "the whole book is
// nested first-person narration (Walton > Victor > Creature)."
const RELAY_CHAIN = ["walton", "victor", "creature"];
const relayVia = (holder) => {
  const i = RELAY_CHAIN.indexOf(holder);
  return i <= 0 ? [] : RELAY_CHAIN.slice(0, i);
};

const arg = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };

// How an arrangement's end becomes a CLAIM key. Keyed by occurrence, two
// tellers can never agree about anything (occurrence ids are unique by
// construction) and "common ground: 0" would be an artifact of the key, not
// a finding about the book. Keyed by bare surface, they agree too much — and
// about the worst possible thing: the coref prior's own note says "'I' points
// at the Creature ONLY inside his own spans; elsewhere it is Victor or
// Walton. Same string, three referents, split by scope." So first person
// resolves to the FRAME'S narrator, using the prior register's own closed
// class (giver: lang/en) rather than a pronoun list written here.
// endKey now lives in adapters/text/perspective-claims.js::claimEndKey,
// where it is tested; this driver only declares the injected closed class.

async function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/nested-narration.mjs <book.txt> --coref <prior.json>");
  const corefPath = arg("--coref");
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  const framePrior = corefPath ? JSON.parse(fs.readFileSync(corefPath, "utf8")) : null;

  const narration = narrationFrames(stripped.text, { framePrior, offset: stripped.offset });
  const quotes = quotationFrames(stripped.text, { offset: stripped.offset });
  const encounters = textEncounters(stripped.text, { source: `file:${path.split("/").pop()}`, offset: stripped.offset });

  // ── pronoun binding, scoped PER TELLER ────────────────────────────────
  // The organ (adapters/text/pronouns.js) was built, tested, and had no
  // caller in the reading path — the scaffolded-organ pattern this repo's
  // own CLAUDE.md names. It is wired here rather than inside the perceiver
  // because S4 keeps the perceiver's re-ground posture until conformance
  // parity licenses a swap.
  //
  // FRAME-SCOPED, and that is the whole point. Resolving "he" against a name
  // that only occurs in a DIFFERENT teller's stretch is the same error P1
  // forbids across books, one level in: the creature's "he" is not Victor's.
  // The coref prior states the rule for first person ("same string, three
  // referents, split by scope"); third person inherits it.
  const cast = sessionReferents(
    (() => { const s = createSession(); admitChunked(s, { text: fs.readFileSync(path, "utf8"), sourceId: `file:${path.split("/").pop()}`, language: "en" }); return s; })(),
    { sourceId: `file:${path.split("/").pop()}`, priors: framePrior ? [framePrior] : [], limit: 200 },
  );
  const surfaceToReferent = castSurfaceMap(cast.referents ?? []);
  const { boundSentences, perFrame: perFrameBindings } = bindNarrationFrames({
    frames: narration.frames, text: stripped.text, offset: stripped.offset,
    surfaceToReferent, recall: PRONOUN_RECALL,
  });
  // The SECOND arm — the reader's decaying present instead of thematic echo.
  // Same frames, same join, one changed dimension (the mechanism), so the
  // two reports below are a controlled comparison, not two anecdotes.
  const presentArm = bindNarrationFrames({
    frames: narration.frames, text: stripped.text, offset: stripped.offset,
    surfaceToReferent, recall: PRONOUN_PRESENT,
    resolve: (sents, surfs, opts) => resolvePronounsByActivation(sents, surfs, opts),
  });
  const agree = (() => {
    const a = new Map(boundSentences.map((b) => [`${b.start}:${b.pronoun}`, b.referentId]));
    let both = 0, same = 0;
    for (const b of presentArm.boundSentences) {
      const t = a.get(`${b.start}:${b.pronoun}`);
      if (t) { both += 1; if (t === b.referentId) same += 1; }
    }
    return { bothBound: both, agreeing: same };
  })();
  const { resolve: referentForPronoun, counters: joinCounters } = pronounResolver(boundSentences);

  const perceiver = createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25 });
  const entries = [];
  const byHolder = new Map();
  const unframed = [];

  for (const enc of encounters) {
    const out = (await perceiver.perceive(enc, {})) ?? [];
    const edges = out.flatMap((c) => c.candidate?.hyperedges ?? []);
    if (!edges.length) continue;
    const at = holderAt(enc.anchor.start, { narration, embedded: [] });
    if (!at.holder) { unframed.push(enc.anchor.start); continue; }
    byHolder.set(at.holder, (byHolder.get(at.holder) ?? 0) + edges.length);
    const ops = [];
    for (const edge of edges) {
      const ends = (edge.participants ?? []).map((p) => claimEndKey(p, at.holder, { offset: enc.anchor.start, resolvePronoun: referentForPronoun, firstPerson: FIRST_PERSON }));
      const claim = `${ends[0]}|${edge.relation ?? edge.label ?? "?"}|${ends[ends.length - 1]}`;
      // The extractor already carries polarity on every edge; a negated
      // arrangement is its teller REFUSING that claim, not asserting it.
      // Without this, two holders can only ever be asymmetric — nobody can
      // disagree, and "conflicting: 0" would say more about the driver than
      // about the book.
      const stance = edge.meta?.polarity === "-" ? STANCE.REFUSES : STANCE.HOLDS;
      // The teller holds it as their own assertion...
      ops.push(perspectiveOperation({ holder: at.holder, claim, stance, witness: `byte:${enc.anchor.start}` }));
      // ...and the reader holds it as RELAYED, through whoever relayed it.
      // Two entries, because they are two different epistemic facts, and the
      // whole point of this driver is that collapsing them loses the book.
      ops.push(perspectiveOperation({ holder: READER, claim, stance, via: [...relayVia(at.holder), at.holder], witness: `byte:${enc.anchor.start}` }));
    }
    entries.push(deltaFold(ops));
  }

  const projected = projectPerspectives(entries);
  const perHolder = Object.fromEntries(Object.entries(projected.perspectives).map(([h, p]) => [h, p.beliefs.length]));

  const report = {
    schema: "EONestedNarration@1",
    book: path.split("/").pop(),
    assembly: "causal text perceiver (in order) + attribution frames + perspective projection — revision tier and binding layer NOT run (P0/P2)",
    priorsInjected: [
      { kind: "narratorSpans", giver: narration.prior?.giver ?? null, version: narration.prior?.version ?? null, via: "adapters/text/attribution.js::narrationFrames" },
      { kind: "relay chain", giver: "the same coref prior's own note: 'the whole book is nested first-person narration (Walton > Victor > Creature)'", declared: RELAY_CHAIN },
      { kind: "first-person closed class", giver: FIRST_PERSON_META.giver, via: "claim keying: 'I' resolves to the frame's narrator, never to one shared string" },
    ],
    frames: {
      resolved: narration.frames.length,
      unresolvedAnchors: narration.unresolvedAnchors.length,
      narrators: narration.narrators,
      spans: narration.frames.map((f) => ({ narrator: f.narrator, byteStart: f.byteStart, byteEnd: f.byteEnd, opens: (f.fromAnchor ?? "<book start>").slice(0, 44) })),
    },
    quotationConvention: {
      basis: quotes.basis,
      paragraphs: quotes.paragraphs,
      counted: quotes.counted,
      embeddedRuns: quotes.embeddedFrames.length,
      largestRuns: [...quotes.embeddedFrames].sort((a, b) => b.paragraphs - a.paragraphs).slice(0, 3)
        .map((r) => ({ paragraphs: r.paragraphs, byteStart: r.start, byteEnd: r.end })),
    },
    // The headline: the same book, read as four different sets of claims.
    heldPerHolder: perHolder,
    edgesPerNarrator: Object.fromEntries(byHolder),
    pronounBinding: {
      organ: "adapters/text/pronouns.js::resolvePronouns (built and tested here, previously with no caller in the reading path)",
      declared: PRONOUN_RECALL,
      scope: "per narration frame — a teller's 'he' is never resolved against a name that only occurs in another teller's stretch (P1, one level in)",
      castSurfaces: surfaceToReferent.size,
      reach: {
        ...joinCounters,
        reading: "pronounEnds: gendered-pronoun edge ends the extractor produced at all (of 3,180 edges — 4.2%). inBoundRange: those inside a sentence the organ bound, which it only does for sentences carrying NO name (its own declared scope). tokenMatch: the end IS the bound pronoun, so the claim keys to a being.",
        ceiling: "the claim tier is unmoved, and the bottleneck is UPSTREAM, not here: the relation extractor anchors on capitalised surfaces, so pronoun-subject clauses are mostly never extracted. Widening this organ would not help; widening extraction would. Named, not attempted.",
      },
      boundSentences: boundSentences.length,
      perFrame: perFrameBindings,
      byActivation: {
        mechanism: "decayed presence (kernel createActivation; window 8 measured by dmd on this book — see terrain-activation-live)",
        declared: { window: PRONOUN_PRESENT.window, minActivation: PRONOUN_PRESENT.minActivation, minMargin: PRONOUN_PRESENT.minMargin },
        boundSentences: presentArm.boundSentences.length,
        perFrame: presentArm.perFrame,
        agreementWithThematic: agree,
        reading: "the two arms agree on only ~26% of the sentences both bind. Spot-checked: disagreements cluster in stretches whose TRUE antecedent (the master, the lieutenant — Walton-letter minor characters) is below the cast floor entirely, so both arms bind the nearest wrong candidate. That is a candidate-universe gap upstream of either mechanism; with no pronoun golden in either repo, declaring a winner between the arms is not licensed (CLAUDE.md: never tune toward the answer key you wish you had).",
      },
    },
    unframedEncounters: unframed.length,
    // What the reader holds only through Victor — every one of these is a
    // claim no one in the book corroborates, and the reader knows it.
    readersModelOfVictor: (() => { const m = mentalModel(projected, "victor", READER); return { attributed: m.count, ofHoldsInTotal: m.ofHoldsInTotal, coverage: m.coverage, sample: m.attributed.slice(0, 4) }; })(),
    readersModelOfTheCreature: (() => { const m = mentalModel(projected, "creature", READER); return { attributed: m.count, ofHoldsInTotal: m.ofHoldsInTotal, coverage: m.coverage, relayDepth: m.attributed[0]?.relayDepth ?? null, sample: m.attributed.slice(0, 4) }; })(),
    // Dramatic irony, mechanically: what one teller holds that another has
    // no belief about at all.
    victorVersusCreature: (() => {
      const d = divergence(projected, "victor", "creature");
      return { asymmetric: d.asymmetric.length, conflicting: d.conflicting.length, conflictSample: d.conflicting.slice(0, 3) };
    })(),
    refusedPerHolder: Object.fromEntries(Object.entries(projected.perspectives).map(([h, p]) => [h, p.beliefs.filter((b) => b.stance === STANCE.REFUSES).length])),
    sharedByVictorAndWalton: (() => { const g = commonGround(projected, "victor", "walton"); return { count: g.count, sample: g.shared.slice(0, 3).map((s) => s.claim) }; })(),
    counted: projected.counted,
    logEntries: entries.length,
    note: "every claim here is held BY someone. A relation from the creature's own telling reaches the reader with relayDepth 2 and basis 'reported' — never as something the reading witnessed.",
  };
  console.log(JSON.stringify(report, null, 1));
}

main().catch((err) => { console.error(err); process.exit(1); });

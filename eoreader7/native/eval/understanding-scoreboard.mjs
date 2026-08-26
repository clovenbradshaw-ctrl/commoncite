// native/eval/understanding-scoreboard.mjs — does reading further make the
// past make more sense, and the future better predicted?
//
// The scoreboard uses only predictions the reader ALREADY makes, with
// outcomes it ALREADY witnesses — nothing is invented for the score:
//
//   FORWARD (prediction): a live EOIdentityAlternative@1 at cursor n is the
//   fold's own open expectation — "these two forms may be the same being."
//   Its outcome arrives in (n, N]: SUPPORTED again (CON), ATTACKED into
//   `distinct` (SEG + DEF), or SILENT (never touched again). A reading that
//   understands its material should have its live hypotheses keep earning
//   evidence rather than dying or going silent.
//
//   BACKWARD (retrodiction / release): every REC whose consequence is
//   `relation_recanonicalized` with a non-null `from` is a WITNESSED
//   rewrite of an already-canonicalized past edge under later identity
//   evidence — literally the past being re-made to make more sense.
//   First-time canonicalizations (`from: null`) are counted separately:
//   they are the present being made sense of, not the past re-made.
//   Identity splits (`identity_split`) are the same motion by separation.
//
//   NULL: the same material with encounter ORDER destroyed (seeded
//   permutation). If forward/backward numbers survive shuffling, the
//   reading was never using sequence — "understanding" was vocabulary
//   statistics wearing a trajectory's clothes.
//
// Declared numbers (P4 — declared with a duty, never silently defaulted):
//   CURSORS: quartiles of the material's own encounter count — derived
//     from the material, not hand-picked.
//   SHUFFLE_DRAWS = 2, SEED = 0: runtime budget (a full read is ~2min);
//     two draws distinguish "order matters" from "this permutation was
//     unlucky" but license no finer claim — disclosed, not hidden.
//
// DISCLOSED SCOPE: this scores the identity/relation tier only. The tier
// ladder ("a book wants to be understood as events, not tokens" — the
// altitude gate in emergence/tiers.js) is named, real, and NOT wired here;
// encounters are sentences, and every claim below is at that grain.
//
// Usage: node native/eval/understanding-scoreboard.mjs <pg84.txt> [--fast]
//   --fast: first 800 encounters only, 1 shuffle draw (smoke run).

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { reviseTextFold } from "../adapters/text/revision.js";
import { createRecursiveReader } from "../../kernel.js";

const SEED = 0;

// mulberry32 — small seeded PRNG for the permutation null (declared seed,
// reproducible; the same construction the-fold's null arms already use).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, rand) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const emptyRetrieve = (_fold, evidence) => Object.freeze({
  schema: "EORelevantFold@1",
  witnessed: Object.freeze([...evidence]),
  provisional: Object.freeze([]),
  expectations: Object.freeze([]),
  obligations: Object.freeze([]),
  exclusions: Object.freeze([]),
  unresolvedAlternatives: Object.freeze([]),
  activeFrames: Object.freeze([]),
  receivedPriors: Object.freeze([]),
});

// Descriptor anchoring's floors: host/corpus.js's own declared,
// disclosed-as-unvalidated operating point (0.05 / 0.2) — reused with its
// giver named, never re-derived here (pronouns.test.js uses the same pair).
const ANCHORING = { minActivation: 0.05, minMargin: 0.2 };

// Corroboration floor for canonical projection: 2 — binding.js's own
// structural minimum ("one arrival has no co-arrival to test"), the same
// giver the-fold's P29 WITNESS_FLOOR already cites. Measured need: every
// surviving false identity belief on the coref golden stood on exactly
// one support. Declared here, threaded through reviseTextFold.
const CANONICALIZATION_FLOOR = 2;

// The received POS prior (UD_English-EWT, CC BY-SA 4.0 — provenance inside
// the file) gates descriptor HEADS to noun-hood; without it "the most" /
// "the first" bind as descriptors (measured — recursive.js's own comment).
const POS_PRIOR = JSON.parse(
  fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"),
);

function makeReader() {
  return createRecursiveReader({
    perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25, posPrior: POS_PRIOR, descriptorAnchoring: ANCHORING })],
    adapters: { revise: (args) => reviseTextFold({ ...args, canonicalizationFloor: CANONICALIZATION_FLOOR }), retrieve: emptyRetrieve },
  });
}

// Snapshot only what the score needs — id -> {standing, support, attack}.
function identitySnapshot(fold) {
  const map = new Map();
  for (const alt of fold?.unresolvedAlternatives ?? []) {
    if (alt?.schema !== "EOIdentityAlternative@1") continue;
    map.set(alt.id, {
      standing: alt.standing,
      support: (alt.supportRefs ?? []).length,
      attack: (alt.attackRefs ?? []).length,
    });
  }
  return map;
}

async function runReading(encounters, { cursors }) {
  const reader = makeReader();
  const cursorSet = new Set(cursors);
  const snapshots = new Map(); // position -> identitySnapshot
  // Per-position delta events, kept tiny: {pos, kind, from} for the kinds we score.
  const events = [];
  let pos = 0;
  for (const enc of encounters) {
    const turn = await reader.step(enc);
    pos += 1;
    for (const op of turn.deltaFold?.operations ?? []) {
      const kind = op?.consequence?.kind;
      if (!kind) continue;
      if (kind === "relation_recanonicalized") {
        // The REC names the raw edge it re-projects (consequence.sourceEdge,
        // shape edge:text:{sequencePosition}:{index}) — so a re-making's
        // REACH (how far back the past it rewrote was read) is addressable,
        // closing the v1 disclosure that re-makings were counted only by
        // where they LANDED.
        const srcMatch = /^edge:text:(\d+):/.exec(op.consequence.sourceEdge ?? "");
        const srcPos = srcMatch ? Number(srcMatch[1]) + 1 : null; // sequencePosition is 0-based; pos is 1-based
        events.push({ pos, kind, remade: op.consequence.from != null, reach: srcPos != null ? pos - srcPos : null });
      } else if (kind === "expectation_opened" || kind === "expectation_strengthened" || kind === "expectation_fulfilled" || kind === "expectation_violated") {
        events.push({ pos, kind });
      } else if (
        kind === "identity_split" ||
        kind === "identity_hypothesis_opened" ||
        kind === "identity_hypothesis_supported" ||
        kind === "discourse_identity_supported"
      ) {
        // `identity_hypothesis_opened` is emitted by TWO mechanisms that
        // must not be conflated: revision.js's provisional descriptor
        // hypotheses (payload action "provisional" — recurrence noticed)
        // and identity.js's alternatives (payload action "alternative" —
        // a live, attackable identity pairing). Tagged apart here.
        events.push({ pos, kind, action: op.payload?.action ?? null, identity: op.consequence.identity ?? op.consequence.hypothesis ?? op.consequence.link });
      }
    }
    if (cursorSet.has(pos)) snapshots.set(pos, identitySnapshot(reader.getFold()));
  }
  return { snapshots, events, finalFold: reader.getFold(), turns: pos };
}

function forwardScore(cursor, snapAtCursor, finalSnap) {
  // Every hypothesis LIVE at the cursor, judged by its own final state.
  let supportedLater = 0, attacked = 0, silent = 0, live = 0;
  for (const [id, at] of snapAtCursor) {
    if (at.standing !== "live_hypothesis") continue;
    live += 1;
    const fin = finalSnap.get(id);
    if (!fin) { silent += 1; continue; }
    if (fin.standing === "distinct" || fin.standing === "refused" || fin.attack > at.attack) attacked += 1;
    else if (fin.support > at.support) supportedLater += 1;
    else silent += 1;
  }
  return { cursor, live, supportedLater, attacked, silent };
}

function backwardScore(cursor, events, total) {
  // Work landed AFTER the cursor that re-made what was read BEFORE it is
  // not directly addressable from consequence.kind alone (the op does not
  // carry the source edge's position), so this v1 counts re-makings by the
  // position they LANDED at — every `remade: true` REC after the cursor is
  // later reading rewriting an existing canonical past. Disclosed grain.
  let remade = 0, firstCanon = 0, splits = 0, opened = 0, supported = 0, discourseSupported = 0, alternativesOpened = 0;
  for (const e of events) {
    if (e.pos <= cursor) continue;
    if (e.kind === "relation_recanonicalized") { if (e.remade) remade += 1; else firstCanon += 1; }
    else if (e.kind === "identity_split") splits += 1;
    else if (e.kind === "identity_hypothesis_opened") { if (e.action === "alternative") alternativesOpened += 1; else opened += 1; }
    else if (e.kind === "identity_hypothesis_supported") supported += 1;
    else if (e.kind === "discourse_identity_supported") discourseSupported += 1;
  }
  let expFulfilled = 0, expViolated = 0;
  for (const e of events) {
    if (e.pos <= cursor) continue;
    if (e.kind === "expectation_fulfilled") expFulfilled += 1;
    else if (e.kind === "expectation_violated") expViolated += 1;
  }
  return { cursor, after: total - cursor, pastRemade: remade, firstCanonicalizations: firstCanon, identitySplits: splits, hypothesesOpened: opened, alternativesOpened, hypothesesSupported: supported, discourseSupported, expectationsFulfilledAfter: expFulfilled, expectationsViolatedAfter: expViolated };
}

// Distribution of how far back (in encounters) re-made RECs reached — the
// sharper claim behind pastRemade: not just "the past was rewritten" but
// "how old was the past that later reading reached back to".
function reachSummary(remadeEvents) {
  const reaches = remadeEvents.map((e) => e.reach).filter((r) => Number.isFinite(r)).sort((a, b) => a - b);
  if (!reaches.length) return { n: 0 };
  const mid = Math.floor(reaches.length / 2);
  return {
    n: reaches.length,
    median: reaches.length % 2 ? reaches[mid] : (reaches[mid - 1] + reaches[mid]) / 2,
    max: reaches[reaches.length - 1],
    min: reaches[0],
  };
}

function scoreRun(label, run, cursors) {
  const finalSnap = identitySnapshot(run.finalFold);
  const forward = cursors.map((c) => forwardScore(c, run.snapshots.get(c), finalSnap));
  const backward = cursors.map((c) => backwardScore(c, run.events, run.turns));
  const totals = {
    turns: run.turns,
    hypothesesFinal: finalSnap.size,
    finalDistinct: [...finalSnap.values()].filter((x) => x.standing === "distinct" || x.standing === "refused").length,
    pastRemadeTotal: run.events.filter((e) => e.kind === "relation_recanonicalized" && e.remade).length,
    pastRemadeReach: reachSummary(run.events.filter((e) => e.kind === "relation_recanonicalized" && e.remade)),
    firstCanonTotal: run.events.filter((e) => e.kind === "relation_recanonicalized" && !e.remade).length,
    splitsTotal: run.events.filter((e) => e.kind === "identity_split").length,
    hypothesesOpenedTotal: run.events.filter((e) => e.kind === "identity_hypothesis_opened" && e.action !== "alternative").length,
    alternativesOpenedTotal: run.events.filter((e) => e.kind === "identity_hypothesis_opened" && e.action === "alternative").length,
    alternativesSupportedTotal: run.events.filter((e) => e.kind === "identity_hypothesis_supported").length,
    hypothesesResolvedTotal: run.events.filter((e) => e.kind === "discourse_identity_supported").length,
    // Measured, not asserted: the text adapter opens neither of the
    // kernel's own dynamics carriers — this is the starvation finding.
    expectationsFinal: (run.finalFold.expectations ?? []).length,
    expectationsByState: (run.finalFold.expectations ?? []).reduce((acc, e) => { acc[e.state] = (acc[e.state] ?? 0) + 1; return acc; }, {}),
    expectationsFulfilledTotal: run.events.filter((e) => e.kind === "expectation_fulfilled").length,
    expectationsViolatedTotal: run.events.filter((e) => e.kind === "expectation_violated").length,
    obligationsFinal: (run.finalFold.obligations ?? []).length,
    provisionalFinal: (run.finalFold.provisional ?? []).length,
    unresolvedAlternativesFinal: (run.finalFold.unresolvedAlternatives ?? []).length,
  };
  return { label, totals, forward, backward };
}

async function main() {
  const path = process.argv[2];
  const fast = process.argv.includes("--fast");
  if (!path) throw new TypeError("usage: node native/eval/understanding-scoreboard.mjs <pg84.txt> [--fast]");
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  if (!stripped.looks_like_material) throw new Error("input does not look like readable material");
  let encounters = textEncounters(stripped.text, { source: "gutenberg:84", offset: stripped.offset });
  if (fast) encounters = encounters.slice(0, 800);
  const N = encounters.length;
  const cursors = [1, 2, 3].map((q) => Math.floor((N * q) / 4)); // quartiles, derived from the material
  const draws = fast ? 1 : 2; // SHUFFLE_DRAWS — declared above

  console.error(`reading ${N} encounters, cursors at ${cursors.join(", ")}...`);
  const ordered = await runReading(encounters, { cursors });
  const orderedScore = scoreRun("ordered", ordered, cursors);

  const rand = mulberry32(SEED);
  const nullScores = [];
  for (let d = 0; d < draws; d += 1) {
    console.error(`shuffle draw ${d + 1}/${draws}...`);
    // Shuffled text, resequenced: same sentences, order destroyed. The
    // perceiver sees positions 0..N-1 exactly as the ordered run does —
    // only the MATERIAL's own trajectory is gone.
    const perm = shuffled(encounters, rand).map((e, i) => ({ ...e, sequencePosition: i }));
    const run = await runReading(perm, { cursors });
    nullScores.push(scoreRun(`shuffled#${d}`, run, cursors));
  }

  const out = {
    schema: "EOUnderstandingScoreboard@1",
    material: { path, encounters: N, fast },
    declared: { cursors, shuffleDraws: draws, seed: SEED, anchoring: ANCHORING, canonicalizationFloor: CANONICALIZATION_FLOOR, grain: "sentence — the tier ladder is disclosed future work, not implied" },
    ordered: orderedScore,
    nulls: nullScores,
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });

// Adversarial test — Challenge #13: "Consolidation/dreaming drift"
//
// Claim under test (owner's own stated worry, not yet reported as tested):
// closed-loop self-confirmation could narrow the induced priors over repeated
// dream/consolidation cycles — worse than the biological analogue because
// ingestion is already salience-gated.
//
// Challenge: run several consolidation ("dreaming") cycles back to back on a
// FIXED corpus with NO new ungated ballast introduced between cycles. Measure
// whether the diversity of the induced Kind vocabulary (distinct Kinds, their
// spread/variety) shrinks over cycles (bad) vs. stays stable/diversifies. If
// no consolidation/dreaming mechanism exists yet, report INCONCLUSIVE plainly
// rather than fabricating one.
//
// SURVEY CONFIRMATION (re-verified independently below, not trusted blindly):
//   grep -rniI "dream" over every *.js/*.mjs/*.md file in the repo: zero
//   mechanism hits (only literal narrative content in the odyssey-greek.txt
//   fixture and one unrelated Chinese-wiki image filename).
//   grep -rniI "consolidat": exactly one hit, CUBE.md:130, an unrelated,
//   purely theoretical operator-taxonomy question (EVA vs REC classification
//   of a "narrowing" pattern-movement event, n=17/3/1) — not a mechanism.
//
// So there is no dedicated "dream()" / "consolidate()" entry point to drive.
// This script does NOT fabricate one. Instead it does the maximally honest
// adjacent thing, in three independent experiments, all against REAL fixed
// corpora and REAL repo code, none of it invented:
//
//   EXPERIMENT 1 — the literal proxy: the actual Kind-vocabulary machinery
//   (induceKinds/buildVocabulary, packages/engine/emergence/kinds.js) is the
//   organ that would sit inside ANY consolidation loop, whatever wrapper
//   eventually calls it. Call it N times back-to-back on a genuinely FIXED
//   corpus (the exact TERMS fixture conformance/kinds.test.js already uses
//   and pins) with IDENTICAL options every cycle, and measure the Kind
//   vocabulary's diversity (count, labels, member sets, total distinct
//   members covered) each cycle. Does it shrink?
//
//   EXPERIMENT 2 — same idea on a larger, richer, VALUED-material corpus
//   (goldens/kinds/synthesize.mjs's symphony modality, n=4 ground-truth
//   kinds, the same corpus conformance/kind-values.test.js pins) to make sure
//   the finding isn't an artifact of the small 15-term/2-kind fixture.
//
//   EXPERIMENT 3 — actually try to drive the repo's own closest analogue to a
//   "second consolidation cycle": emergence/paradigm.js's REC·Pattern
//   rezeroParadigm(), triggered by DEF·Pattern refuseParadigm(). Attempt this
//   on the SAME fixed corpus with NO new records introduced (exactly what the
//   challenge specifies) three different ways:
//     3a. the correct, intended trigger path (refuseParadigm on the same
//         corpus, then rezeroParadigm keyed off whatever it returns)
//     3b. rezeroParadigm called with no prior at all
//     3c. an adversarial probe: rezeroParadigm called with refuseParadigm's
//         own "refused: false" result object as `prior` — that object
//         happens to satisfy rezeroParadigm's loose admission check
//         (`Array.isArray(prior?.paradigm)`) even though nothing unraveled,
//         so this specifically probes whether the trigger discipline has a
//         real hole an implementer could fall through when wiring a
//         consolidation loop.
//
//   EXPERIMENT 4 (supplementary, clearly separate variable) — vary only the
//   declared `seed` across "cycles" on the Experiment-1 fixed corpus, to see
//   whether the measurement's own permutation-null randomness could ever
//   produce an apparent narrowing on this corpus, independent of any real
//   feedback loop.
//
// Nothing here is fabricated as "the dreaming mechanism" — every experiment
// is clearly labeled as a proxy/probe and the verdict says so explicitly.

import { induceKinds, buildVocabulary } from "../../packages/engine/emergence/kinds.js";
import { refuseParadigm, rezeroParadigm, paradigmCores } from "../../packages/engine/emergence/paradigm.js";
import { composeKinds, MODALITIES } from "../../goldens/kinds/synthesize.mjs";
import { isGap } from "../../nul/index.js";

const line = (s = "") => console.log(s);
const hr = () => line("-".repeat(78));
const J = (x) => JSON.stringify(x);

let anyFailure = false; // set true only by a genuine, concrete narrowing/leak finding

// ── fixed corpus 1 — verbatim from conformance/kinds.test.js ────────────────
// (Emma-vol-1-relation-terms fixture; a real, already-pinned, already-passing
// fixture in this repo — not invented for this test.)
const A = (field_id, count = 1) => ({ field_id, value_type: "boolean", count });
const TERMS = [
  { id: "term:sister", label: "sister", attributes: [A("anchor_shared", 3)] },
  { id: "term:brother", label: "brother", attributes: [A("anchor_shared", 2)] },
  { id: "term:daughter", label: "daughter", attributes: [A("anchor_shared")] },
  { id: "term:father", label: "father", attributes: [A("anchor_shared")] },
  { id: "term:mother", label: "mother", attributes: [A("anchor_shared")] },
  { id: "term:wife", label: "wife", attributes: [A("anchor_shared")] },
  { id: "term:husband", label: "husband", attributes: [A("anchor_shared")] },
  { id: "term:sister-in-law", label: "sister-in-law", attributes: [A("anchor_shared"), A("stem_shared")] },
  { id: "term:in-love-with", label: "in-love-with", attributes: [A("subject_shared", 2)] },
  { id: "term:violent-love", label: "violent-love", attributes: [A("subject_shared")] },
  { id: "term:pretended-love", label: "pretended-love", attributes: [A("subject_shared")] },
  { id: "term:falling-in-love", label: "falling-in-love", attributes: [A("subject_shared")] },
  { id: "term:love-at-first-sight", label: "love-at-first-sight", attributes: [A("subject_shared")] },
  { id: "term:not-in-love", label: "not-in-love", attributes: [A("subject_shared")] },
  { id: "term:friend", label: "friend", attributes: [] },
];
const OPTS1 = { population: "emma-v1-relations", minPrevalence: 0.25, minKindSize: 3, permutations: 200, quantile: 0.95, reseeds: 24, seed: 42 };

const vocabSnapshot = (kinds) => {
  const labels = kinds.map((k) => k.label).sort();
  const membersByLabel = Object.fromEntries(kinds.map((k) => [k.label, [...k.members].sort()]));
  const distinctMembersCovered = new Set(kinds.flatMap((k) => k.members)).size;
  return { numKinds: kinds.length, labels, membersByLabel, distinctMembersCovered };
};

hr();
line("EXPERIMENT 1 — repeated induceKinds() on a FIXED corpus, no new ballast");
line("(Emma-relation-terms fixture, 15 fixed records, identical opts every cycle)");
hr();

const CYCLES_1 = 8;
const exp1 = [];
for (let c = 1; c <= CYCLES_1; c++) {
  const kinds = induceKinds(TERMS, OPTS1); // pure function of (records, opts) — no external state carried in
  const snap = vocabSnapshot(kinds);
  exp1.push(snap);
  line(`cycle ${c}: numKinds=${snap.numKinds} labels=${J(snap.labels)} distinctMembersCovered=${snap.distinctMembersCovered}`);
}
const exp1Baseline = J(exp1[0]);
const exp1AllIdentical = exp1.every((s) => J(s) === exp1Baseline);
const exp1NumKindsSeries = exp1.map((s) => s.numKinds);
const exp1Shrunk = exp1NumKindsSeries.some((n, i) => i > 0 && n < exp1NumKindsSeries[0]);
line("");
line(`numKinds series across ${CYCLES_1} cycles: ${J(exp1NumKindsSeries)}`);
line(`all ${CYCLES_1} cycles byte-identical vocabulary: ${exp1AllIdentical}`);
line(`any cycle shrank below cycle-1 numKinds: ${exp1Shrunk}`);
if (exp1Shrunk) anyFailure = true;

// ── fixed corpus 2 — goldens/kinds symphony modality (valued material) ──────
hr();
line("EXPERIMENT 2 — same probe on a larger valued-material corpus (symphony, n=4 ground-truth kinds)");
line("(goldens/kinds/synthesize.mjs, the exact composition conformance/kind-values.test.js pins)");
hr();

const { records: SYMPHONY } = composeKinds({
  n: 4, schema: MODALITIES.symphony, membersPerKind: 8, keyOverlap: 1, valueDivergence: 1, withinSpread: 0.25, seed: 7,
});
const OPTS2 = { population: "composed", minPrevalence: 0.25, minKindSize: 3, permutations: 200, quantile: 0.95, reseeds: 24, seed: 7 };

const CYCLES_2 = 6;
const exp2 = [];
for (let c = 1; c <= CYCLES_2; c++) {
  const kinds = induceKinds(SYMPHONY, OPTS2);
  const snap = vocabSnapshot(kinds);
  exp2.push(snap);
  line(`cycle ${c}: numKinds=${snap.numKinds} labels=${J(snap.labels)}`);
}
const exp2Baseline = J(exp2[0]);
const exp2AllIdentical = exp2.every((s) => J(s) === exp2Baseline);
const exp2NumKindsSeries = exp2.map((s) => s.numKinds);
const exp2Shrunk = exp2NumKindsSeries.some((n, i) => i > 0 && n < exp2NumKindsSeries[0]);
line("");
line(`numKinds series across ${CYCLES_2} cycles: ${J(exp2NumKindsSeries)} (ground truth n=4)`);
line(`all ${CYCLES_2} cycles byte-identical vocabulary: ${exp2AllIdentical}`);
line(`any cycle shrank below cycle-1 numKinds: ${exp2Shrunk}`);
if (exp2Shrunk) anyFailure = true;

// ── the repo's closest real "consolidation" analogue ─────────────────────────
hr();
line("EXPERIMENT 3 — driving emergence/paradigm.js's REC·Pattern on the SAME fixed corpus,");
line("no new records introduced between attempts (exactly the challenge's premise)");
hr();

const kinds0 = induceKinds(TERMS, OPTS1);
line(`paradigm0 (from cycle-0 induction over TERMS): ${J(kinds0.map((k) => k.label))}`);

// 3a. the intended, correct trigger path: refuseParadigm on the SAME corpus
// the paradigm was itself induced from — no new material at all.
const refuse1 = refuseParadigm(kinds0, TERMS, OPTS1);
line("");
line("3a. refuseParadigm(paradigm0, SAME TERMS, OPTS1) — the intended trigger check:");
line(`    ${isGap(refuse1) ? `GAP ${refuse1.gap}: ${refuse1.reason}` : J(refuse1)}`);
const noUnravelOnFixedCorpus = !isGap(refuse1) || refuse1.gap !== "paradigm_unraveled";
line(`    unravel triggered on fixed/no-new-material corpus? ${!noUnravelOnFixedCorpus}`);

// 3b. rezeroParadigm with literally no prior.
const rezeroNoPrior = rezeroParadigm(TERMS, OPTS1, {});
line("");
line("3b. rezeroParadigm(TERMS, OPTS1, {}) — no prior at all:");
line(`    ${isGap(rezeroNoPrior) ? `GAP ${rezeroNoPrior.gap}: ${rezeroNoPrior.reason}` : J(rezeroNoPrior)}`);

// 3c. ADVERSARIAL PROBE: feed rezeroParadigm the non-unraveled "refused:false"
// object as `prior`. It carries an array field named `paradigm` (part of its
// normal, documented return shape), which is enough to pass
// rezeroParadigm's OWN admission check for "an object carrying the
// unraveled paradigm's labels" even though refuse1 never unraveled anything.
// This is the concrete way a careless consolidation-loop wrapper could try
// to force a second cycle on a fixed corpus with nothing new to justify it.
const rezeroLoosePrior = rezeroParadigm(TERMS, OPTS1, { prior: refuse1 });
line("");
line("3c. ADVERSARIAL: rezeroParadigm(TERMS, OPTS1, { prior: refuse1 }) — feeding the");
line("    non-unraveled refused:false result as if it were a trigger:");
line(`    ${isGap(rezeroLoosePrior) ? `GAP ${rezeroLoosePrior.gap}: ${rezeroLoosePrior.reason}` : J(rezeroLoosePrior)}`);

const looseTriggerBypassedFirstCheck = !isGap(rezeroLoosePrior) || rezeroLoosePrior.gap !== "no_rezero_trigger";
const looseTriggerActuallySucceeded = !isGap(rezeroLoosePrior);
line(`    bypassed the "no_rezero_trigger" guard (loose admission check)? ${looseTriggerBypassedFirstCheck}`);
line(`    but ultimately SUCCEEDED (silently re-composed the paradigm)? ${looseTriggerActuallySucceeded}`);
if (looseTriggerActuallySucceeded) {
  line("    *** this would be a real hole: a consolidation cycle silently re-ran on a");
  line("    *** fixed corpus with no measured unravel and no new material. ***");
}

hr();
line("EXPERIMENT 4 (supplementary) — vary ONLY the declared seed, same fixed TERMS corpus,");
line("to see whether measurement-only re-runs (no feedback loop at all) can look like drift");
hr();
const seeds = [42, 1, 2, 3, 7, 99, 12345];
const exp4 = seeds.map((seed) => {
  const kinds = induceKinds(TERMS, { ...OPTS1, seed });
  const snap = vocabSnapshot(kinds);
  line(`seed=${seed}: numKinds=${snap.numKinds} labels=${J(snap.labels)}`);
  return snap.numKinds;
});
const exp4Min = Math.min(...exp4);
const exp4Max = Math.max(...exp4);
line(`numKinds range across ${seeds.length} independent seeds on the SAME fixed corpus: [${exp4Min}, ${exp4Max}]`);

// ── verdict plumbing ──────────────────────────────────────────────────────
hr();
line("SUMMARY");
hr();
line(`Experiment 1 (small fixture, ${CYCLES_1} cycles): all-identical=${exp1AllIdentical}, any shrink=${exp1Shrunk}`);
line(`Experiment 2 (symphony fixture, ${CYCLES_2} cycles): all-identical=${exp2AllIdentical}, any shrink=${exp2Shrunk}`);
line(`Experiment 3a (intended trigger, fixed corpus): unravel fired spuriously=${!noUnravelOnFixedCorpus}`);
line(`Experiment 3b (no prior): correctly refused=${isGap(rezeroNoPrior) && rezeroNoPrior.gap === "no_rezero_trigger"}`);
line(`Experiment 3c (loose-prior probe): silently succeeded=${looseTriggerActuallySucceeded}`);
line(`Experiment 4 (seed-only variation): numKinds never left [${exp4Min},${exp4Max}] on this fixed corpus`);
line("");
line(`OVERALL: anyFailure=${anyFailure}`);

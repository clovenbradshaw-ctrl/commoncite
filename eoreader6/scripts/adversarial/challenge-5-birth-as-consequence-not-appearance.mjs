// scripts/adversarial/challenge-5-birth-as-consequence-not-appearance.mjs
//
// Adversarial challenge #5 — "Birth-as-consequence, not appearance."
//
// Claim under test (packages/engine/referents/entity.js): an Entity is born
// only from RECURRING CONSEQUENCE — minArrivals arrivals, a cleared void-mask
// null, and late-half activity that moves beyond what reseeding the early
// half alone would produce (admitFromArrivals, lines 235-300) — never from
// mere appearance, however prominent.
//
// This script builds one hand-authored fixture (saved to
// fixtures/challenge-5-lighthouse.txt) containing THREE candidate surfaces,
// each a proper noun, at three different appearance/consequence profiles:
//
//   THRENODY  — the literal "title-page name" case: appears EXACTLY ONCE, in
//               a single prominent one-off dedication line. Below minArrivals
//               by construction — the paradigm case of "mere appearance."
//
//   KESTREL   — the harder case: appears SIX times (comfortably clears
//               minArrivals), each time as the SAME verbatim boilerplate
//               attribution line ("By Aldous Kestrel: nothing further
//               follows."), reset into the narrative at evenly-spaced points.
//               Prominent AND repeated — but because the wording never
//               changes, each later occurrence is *more* predictable than the
//               last (the words have already been seen), not less. Nothing
//               about what follows a Kestrel-mention differs from what
//               preceded it. This is appearance without consequence.
//
//   VOSS      — the admit case: appears SIX times, always as "Voss spoke
//               once, and then <X>." The first three occurrences' <X> draw on
//               a small "mild anomaly" vocabulary (gauge/hush/flicker); the
//               last three draw on a disjoint, escalated "hull failure"
//               vocabulary (klaxon/buckled/sparks) that appears nowhere else
//               in the fixture. Each mention is followed by something that
//               did not happen before it was mentioned, and the back half
//               marks distinctly different territory than the front half.
//
// Unit choice: ONE SENTENCE = ONE REACH-UNIT. entity.js does not care how a
// caller chunks material (window/draws/reseeds/minArrivals are the only
// declared numbers); scripts/score-cast-entities.mjs chunks by a fixed token
// count because it wants "a few pages" per unit on a 690KB book. This fixture
// is small and hand-built for precise control over what surprisal each
// surface's arrival-units carry, so a sentence is the reach-unit here. Still
// the real production API: openReading/arrive/witnessArrival/
// offerCandidates/carryEntities/refusals, unmodified, imported straight from
// packages/engine/referents/entity.js.
//
// Run: node scripts/adversarial/challenge-5-birth-as-consequence-not-appearance.mjs

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  openReading, arrive, witnessArrival, offerCandidates, carryEntities, refusals, admitFromArrivals,
} from "../../packages/engine/referents/entity.js";
import { isGap } from "../../nul/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE_PATH = join(ROOT, "scripts/adversarial/fixtures/challenge-5-lighthouse.txt");

// ── declared numbers (never defaulted — SEED.md's three, plus minArrivals) ──
const SPEC = Object.freeze({ window: 8, draws: 96, reseeds: 24, minArrivals: 4 });

// ── the filler narrative: a TIGHT, heavily-reused vocabulary ────────────────
// First attempt used 18 distinct one-off filler sentences (mostly disjoint
// vocabulary) and every surface came back refused, including the ordinary
// recurring closed-class word "the" -- because with so many distinct rare
// words and so few repeats, the running lexicon never saturates: total atoms
// keeps growing faster than any single word's own count, so causal surprisal
// (arrive()'s -log2((seen+1)/(atoms+2))) DRIFTS UPWARD across the whole
// reading instead of settling to a stable baseline. That drift, not any
// surface's own behaviour, was what the void-mask null and pattern() were
// actually responding to -- a confound in the fixture, not a finding about
// the engine. Fixed by cycling a small (~20-word) core vocabulary densely
// enough that the lexicon saturates well before Kestrel/Voss/Threnody are
// introduced (40 pure-filler units of burn-in), so the baseline series is
// flat and any signal at a surface's own arrivals is really its own.
const FILLER = [
  "The keeper kept the watch again.",
  "The light burned slow and quiet.",
  "The sea stayed calm and still.",
  "The wind moved slow through the dark.",
  "The keeper held the light again.",
  "The night was quiet and still.",
  "The sea moved slow and dark.",
  "The wind stayed quiet at night.",
  "The keeper watched the sea again.",
  "The light stayed still in the dark.",
  "The wind held quiet and slow.",
  "The keeper kept the light burned.",
  "The dark sea stayed still again.",
  "The quiet night held the light.",
];

// ── the prominent-but-inert surface: identical verbatim line, six times ─────
const KESTREL_LINE = "By Aldous Kestrel: nothing further follows.";

// ── the rare-but-consequential surface: mild anomaly, then escalation ───────
const VOSS_EARLY = [
  "Voss spoke once, and then the gauge dipped and steadied again.",
  "Voss spoke once, and then a hush settled over the gauge.",
  "Voss spoke once, and then the gauge flickered and slowly steadied.",
];
const VOSS_LATE = [
  "Voss spoke once, and then the klaxon shrieked through the hull.",
  "Voss spoke once, and then sparks spat from a buckled panel.",
  "Voss spoke once, and then the walls buckled as the klaxon failed outright.",
];

// ── the literal "appears once" case: a one-off prominent dedication ─────────
const THRENODY_LINE = "For Threnody, who never returned, this page is kept blank.";

// ── build the 153-sentence plan: 140 filler (40-unit burn-in first) + 6 ────
// kestrel + 6 voss + 1 threnody, interleaved after the lexicon has saturated
const TOTAL = 153;
const KESTREL_IDX = [40, 58, 76, 94, 112, 130];
const VOSS_IDX = [49, 67, 85, 103, 121, 139]; // first 3 -> VOSS_EARLY, last 3 -> VOSS_LATE
const THRENODY_IDX = [145];

function buildPlan() {
  const special = new Map();
  KESTREL_IDX.forEach((i) => special.set(i, KESTREL_LINE));
  VOSS_IDX.forEach((i, k) => special.set(i, k < 3 ? VOSS_EARLY[k] : VOSS_LATE[k - 3]));
  THRENODY_IDX.forEach((i) => special.set(i, THRENODY_LINE));

  const plan = [];
  let fillerCursor = 0;
  for (let i = 0; i < TOTAL; i++) {
    if (special.has(i)) {
      plan.push(special.get(i));
    } else {
      plan.push(FILLER[fillerCursor % FILLER.length]);
      fillerCursor++;
    }
  }
  return plan;
}

const WORD_RE = /[\p{L}\p{M}]+/gu;
const tokenize = (sentence) => (sentence.match(WORD_RE) ?? []).map((w) => w.toLowerCase());

function main() {
  const plan = buildPlan();

  // Persist the actual source text used, so the fixture is auditable on disk.
  writeFileSync(FIXTURE_PATH, plan.join(" "), "utf-8");

  const state = openReading(SPEC);
  for (const sentence of plan) {
    const atoms = tokenize(sentence);
    arrive(state, atoms);
    for (const surface of new Set(atoms)) witnessArrival(state, surface);
  }

  const born = offerCandidates(state);
  const register = carryEntities(state);
  const refs = refusals(state);
  const refMap = new Map(refs.map((r) => [r.surface, r.why]));

  console.log(`fixture: ${FIXTURE_PATH}`);
  console.log(`units=${state.series.length}  candidates offered=${state.arrivals.size}  born=${born}  register=${register.length}  refused=${refs.length}`);
  console.log(`full register (birth order): ${register.map((e) => e.surfaces[0]).join(", ")}`);
  console.log("");

  const report = (surface, label) => {
    const at = state.arrivals.get(surface);
    console.log(`── ${label}  surface="${surface}"`);
    console.log(`   arrivals (unit indices): ${JSON.stringify(at)}`);
    const admittedEntity = register.find((e) => e.surfaces[0] === surface);
    const direct = admitFromArrivals(state, at); // same call offerCandidates makes, kept here for full diagnostics
    if (direct.admitted) {
      console.log(`   VERDICT: ADMITTED`);
      console.log(`   birth: ${JSON.stringify(direct.birth, (k, v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v))}`);
    } else {
      const why = isGap(direct.why) ? direct.why : direct.why;
      console.log(`   VERDICT: REFUSED`);
      console.log(`   why: ${JSON.stringify(why)}`);
    }
    console.log(`   (register lookup agrees: ${admittedEntity ? "admitted" : "not in register"}; refusals() agrees: ${refMap.has(surface) ? "refused, reason=" + JSON.stringify(refMap.get(surface)) : "not in refusals()"})`);
    console.log("");
    return direct;
  };

  const threnody = report("threnody", "THRENODY (appears once, prominent dedication)");
  const kestrel = report("kestrel", "KESTREL (appears 6x, verbatim boilerplate, prominent-but-inert)");
  const aldous = report("aldous", "ALDOUS (co-occurs identically with kestrel every time — sanity twin)");
  const voss = report("voss", "VOSS (appears 6x, rare-but-consequential — escalating downstream vocabulary)");

  // ── verdict logic for this challenge, AT THIS ONE declared parameter set ──
  const threnodyRefusedForArrivals = !threnody.admitted && isGap(threnody.why) && threnody.why.gap === "empty_material" && /too few arrivals/.test(threnody.why.reason ?? "");
  const kestrelRefused = !kestrel.admitted;
  const vossAdmitted = voss.admitted;

  console.log("── SUMMARY (primary SPEC)");
  console.log(`THRENODY (once, prominent) refused, and refused specifically for too-few-arrivals: ${threnodyRefusedForArrivals}`);
  console.log(`KESTREL (prominent, repeated, inert) refused: ${kestrelRefused}`);
  console.log(`VOSS (rare, consequential) admitted: ${vossAdmitted}`);
  const primaryHeld = threnodyRefusedForArrivals && kestrelRefused && vossAdmitted;
  console.log(`CLAIM HELD at this SPEC: ${primaryHeld}`);

  // ── PART 2: does the SAME source hold up under OTHER validly-declared
  // parameter sets? "Never from mere appearance" is stated in entity.js as an
  // unconditional property of the mechanism, not one scoped to a specific
  // choice of draws/reseeds. entity.js's own gate only requires reseeds >= 2
  // (referents/entity.js:56, nul/index.js:854) and SEED.md itself documents
  // reseeds=12 as a legitimate, corrected value (SEED.md line ~754), and
  // conformance/formation.test.js and conformance/voidification.test.js
  // routinely use reseeds of 3, 5, 8. So this sweep re-runs the identical
  // KESTREL fixture (same arrivals, same underlying series) across several
  // such legitimately-declared SPECs to see whether "prominent but inert"
  // stays refused everywhere, or only at the one SPEC hand-picked above.
  console.log("\n── PART 2: does KESTREL (zero true consequence) stay refused across other valid, non-default SPECs?");
  const SWEEP_SPECS = [
    { window: 8, draws: 96, reseeds: 24, minArrivals: 4 }, // primary, restated
    { window: 6, draws: 64, reseeds: 16, minArrivals: 3 },
    { window: 8, draws: 48, reseeds: 8, minArrivals: 4 },
    { window: 8, draws: 48, reseeds: 12, minArrivals: 4 },
    { window: 8, draws: 48, reseeds: 24, minArrivals: 4 },
    { window: 8, draws: 96, reseeds: 12, minArrivals: 4 },
    { window: 10, draws: 128, reseeds: 32, minArrivals: 5 },
  ];
  let anyFalsePositive = false;
  for (const spec of SWEEP_SPECS) {
    const s2 = openReading(spec);
    for (const sentence of plan) {
      const atoms = tokenize(sentence);
      arrive(s2, atoms);
      for (const surface of new Set(atoms)) witnessArrival(s2, surface);
    }
    const kAt = s2.arrivals.get("kestrel");
    const vAt = s2.arrivals.get("voss");
    const kResult = admitFromArrivals(s2, kAt);
    const vResult = admitFromArrivals(s2, vAt);
    const flag = kResult.admitted ? "  <-- FALSE POSITIVE: prominent-but-inert surface ADMITTED" : "";
    if (kResult.admitted) anyFalsePositive = true;
    console.log(`  SPEC ${JSON.stringify(spec)} -> kestrel admitted=${kResult.admitted}, voss admitted=${vResult.admitted}${flag}`);
  }

  console.log(`\nANY FALSE POSITIVE across the swept, validly-declared SPECs (kestrel wrongly admitted): ${anyFalsePositive}`);

  // ── overall verdict for the challenge ───────────────────────────────────
  // The claim as stated ("never born from mere appearance") is unconditional.
  // If it only holds for one hand-tuned SPEC and breaks under other SPECs
  // this same codebase treats as normal (reseeds=8/12/16 are used throughout
  // conformance/formation.test.js, conformance/voidification.test.js, and
  // SEED.md's own worked example), the claim does not hold as stated.
  const overallHeld = primaryHeld && !anyFalsePositive;
  console.log(`\nOVERALL CLAIM HELD (unconditionally, across all swept SPECs): ${overallHeld}`);

  process.exit(overallHeld ? 0 : 1);
}

main();

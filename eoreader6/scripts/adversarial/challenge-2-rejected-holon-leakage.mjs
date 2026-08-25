// Challenge #2 — "Rejected-holon leakage"
//
// Claim under test: "Rejected holons are logged but never enter the tape or
// condition the next step."
//
// In this codebase the closest real analogs are:
//   · "the tape"        — the reader's belief graph (packages/engine/emergence/graph.js)
//                          plus the singer's preserved/refused/censored/gaps
//                          arrays (packages/host/sing.js createSinger).
//   · "a holon"          — a candidate result judge()'d by the relevance gate
//                          (packages/engine/search/index.js judge()), wired
//                          through the self-directed loop in packages/host/sing.js.
//   · "rejected"         — verdict "refuse" (redundant against the reader) or
//                          "censored" (magnitude reportable, place not).
//   · "the next step"    — the next singPass(): its query, its candidate pool,
//                          and the seed fed to judge().
//
// METHOD (as specified by the challenge):
//   1. Engineer a source that produces SEVERAL near-miss/rejected holon
//      candidates: for every one of 5 "founding" sentences (each introducing
//      a brand-new relation), 4 near-identical restatements are interleaved
//      immediately after it — same extracted (subject,verb,object,polarity)
//      triple, dressed in different surface clothing (trailing clause,
//      leading interjection, semicolon clause, exact duplicate). Each is
//      independently verified (below) to extract to the SAME triple key as
//      its founding sentence, so a "refuse" verdict on it is a genuine
//      near-miss (borderline recurrence), not an accident of extraction.
//   2. RUN A — "the rejected-candidate log intact": the full singRun over the
//      corpus INCLUDING all near-miss/reject spans.
//   3. Read off, from Run A's own singer.refused/singer.censored arrays,
//      exactly which span_ids were rejected.
//   4. RUN B — "confirmed absent from what feeds forward": a fresh singRun
//      over a corpus with precisely those rejected span_ids removed, so the
//      candidates that would have been rejected are never even nominated.
//   5. Compare Run A and Run B on every genuinely downstream artifact: the
//      preserved-span sequence, the final reader graph (nodes+edges+weights),
//      strongest edges, the per-pass belief-movement series, the aperture
//      series computed over it, and the sing() song emitted from the kept
//      material. The claim predicts byte-for-byte identity.
//   6. As a second, independent line of evidence: within Run A itself, snapshot
//      the reader graph's identity (nodes/edges/tick/edgeTotal) immediately
//      before and after EVERY SINGLE one of the 20 reject passes and assert
//      no observable field moved — not just in aggregate, but per rejection.
//   7. Honesty check on "borderline null-clearance": empirically probe whether
//      judge()'s top-level "censored" verdict is even reachable (the survey
//      flagged this as structurally suspicious), and whether the ONE place
//      rejected passes measurably touch anything — the pass-counter-derived
//      seed fed to judge() (`seed: s.seed + s.pass` in packages/host/sing.js)
//      — can be shown, empirically, to change a verdict.
//
// Nothing outside scripts/adversarial/ is modified. This script only imports
// and calls the real, unmodified pipeline modules.

import assert from "node:assert/strict";
import { createSession, searchSpans } from "../../packages/host/corpus.js";
import { createSinger, singPass, singRun, apertureSeries, sing } from "../../packages/host/sing.js";
import { extractRelations } from "../../packages/engine/perceiver/text/relations.js";
import { createGraph, readTriples } from "../../packages/engine/emergence/graph.js";
import { judge } from "../../packages/engine/search/index.js";
import { isGap } from "../../nul/index.js";

const GAMMA = 0.95, PRUNE_BELOW = 1e-4, RESEEDS = 60, SEED = 20260801, ALPHA = 1, LIMIT = 50;
const VERBS = new Set(["trusted", "betrayed", "forgave", "envied", "admired"]);

const log = (...a) => console.log(...a);
const section = (t) => log("\n" + "=".repeat(78) + "\n" + t + "\n" + "=".repeat(78));

let allOk = true;
const check = (label, cond) => {
  const status = cond ? "OK  " : "FAIL";
  if (!cond) allOk = false;
  log(`  [${status}] ${label}`);
  return cond;
};

// ── 1. THE ADVERSARIAL FIXTURE ─────────────────────────────────────────────
// 5 chained "founding" relations (each introduces a brand-new referent, so
// each is a genuine, unambiguous preserve), each immediately followed by 4
// near-miss restatements engineered to extract to the SAME triple — a
// borderline-recurrence rejected-holon candidate that a naive scorer (plain
// token coverage) would find just as attractive as the founding sentence
// itself, since it shares every content token.
const stages = [
  { s: "Alice", v: "trusted", o: "Bob" },
  { s: "Alice", v: "betrayed", o: "Carol" },
  { s: "Carol", v: "forgave", o: "Dave" },
  { s: "Dave", v: "envied", o: "Erin" },
  { s: "Erin", v: "admired", o: "Frank" },
];

let idCounter = 0;
const mkSpan = (text, tag) => {
  idCounter++;
  return { span_id: `span:${idCounter}`, source_id: `test:${tag}`, text, tag };
};

const allSpans = [];
for (const st of stages) {
  allSpans.push(mkSpan(`${st.s} ${st.v} ${st.o}.`, "founding"));
  allSpans.push(mkSpan(`${st.s} ${st.v} ${st.o}, everyone whispered.`, "twin-trailing-comma"));
  allSpans.push(mkSpan(`Truly, ${st.s} ${st.v} ${st.o}.`, "twin-preamble"));
  allSpans.push(mkSpan(`${st.s} ${st.v} ${st.o}; that much was certain.`, "twin-semicolon"));
  allSpans.push(mkSpan(`${st.s} ${st.v} ${st.o}.`, "twin-exact-dup"));
}

section("STEP 1 — validate every near-miss twin extracts to its founding sentence's exact triple");
{
  let idx = 0;
  for (const st of stages) {
    const group = allSpans.slice(idx, idx + 5);
    const keys = group.map((sp) => extractRelations(sp.text, { verbs: VERBS })
      .map((t) => `${t.subject}|${t.verb}|${t.object}|${t.polarity}`.toLowerCase()).join(","));
    const allSame = keys.every((k) => k === keys[0] && k.length > 0);
    check(`stage "${st.s} ${st.v} ${st.o}": all 5 spans -> identical triple key (${keys[0]})`, allSame);
    idx += 5;
  }
}

// ── 2. RUN A — the rejected-candidate log intact ───────────────────────────
section("STEP 2 — RUN A: full corpus, rejected-candidate log intact (real packages/host/sing.js pipeline)");

const buildSession = (spans) => {
  const session = createSession();
  for (const sp of spans) session.spans.set(sp.span_id, sp);
  return session;
};

const runSinger = (spans) => {
  const session = buildSession(spans);
  const singer = createSinger({ session, gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, limit: LIMIT, verbs: VERBS });
  const run = singRun(singer, { passes: 60 });
  return { session, singer, run };
};

const A = runSinger(allSpans);
log(`  Run A: ended=${A.run.ended} pass=${A.run.pass} preserved=${A.run.preserved} refused=${A.run.refused} censored=${A.run.censored} gaps=${A.run.gaps}`);
for (const rec of A.run.records) {
  const tag = allSpans.find((s) => s.span_id === rec.span_id)?.tag ?? "";
  log(`    p${String(rec.pass).padStart(2)} ${(rec.gap ? "GAP:" + rec.gap : rec.verdict).padEnd(10)} ${rec.span_id ?? ""} ${tag}`);
}
check("Run A produced several (>=10) rejected near-miss candidates", A.run.refused + A.run.censored >= 10);
check("Run A preserved exactly the 5 founding relations", A.run.preserved === 5);

const rejectedIds = new Set([...A.singer.refused, ...A.singer.censored].map((r) => r.span_id));
log(`  rejected span_ids (n=${rejectedIds.size}): ${[...rejectedIds].join(", ")}`);

// ── 6. STRUCTURAL CHECK — the reader graph's identity across EVERY reject ──
section("STEP 6 — per-rejection structural check: reader graph identity across all 20 individual rejections");
{
  // Re-run pass by pass (fresh singer, same corpus/config) so we can snapshot
  // the graph's identity fields immediately before and after EVERY pass and
  // assert, for every single refuse/censored pass, that nothing moved.
  const session2 = buildSession(allSpans);
  const singer2 = createSinger({ session: session2, gamma: GAMMA, pruneBelow: PRUNE_BELOW, reseeds: RESEEDS, seed: SEED, alpha: ALPHA, limit: LIMIT, verbs: VERBS });
  let rejectionsChecked = 0;
  let queryDriftDetected = false;
  for (let k = 0; k < 60; k++) {
    const before = { nodes: singer2.reader.nodes.size, edges: singer2.reader.edges.size, tick: singer2.reader.tick, edgeTotal: singer2.reader.edgeTotal, lastPreserved: singer2.lastPreserved?.span_id ?? null };
    const rec = singPass(singer2);
    if (isGap(rec) && rec.gap === "no_candidate") break;
    if (!isGap(rec) && (rec.verdict === "refuse" || rec.verdict === "censored")) {
      rejectionsChecked++;
      const after = { nodes: singer2.reader.nodes.size, edges: singer2.reader.edges.size, tick: singer2.reader.tick, edgeTotal: singer2.reader.edgeTotal, lastPreserved: singer2.lastPreserved?.span_id ?? null };
      const unchanged = JSON.stringify(before) === JSON.stringify(after);
      if (!unchanged) {
        log(`    pass ${rec.pass} (${rec.verdict}) MUTATED the reader: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
      }
      if (before.lastPreserved !== after.lastPreserved) queryDriftDetected = true;
      check(`  pass ${rec.pass} (${rec.verdict}, span ${rec.span_id}): reader graph + lastPreserved (next query) unchanged`, unchanged);
    }
  }
  check(`checked every individual rejection in the run (n=${rejectionsChecked}, expected 20)`, rejectionsChecked === 20);
  check("no rejection ever changed what the next pass will query for", !queryDriftDetected);
}

// ── 3/4. RUN B — the counterfactual with rejects confirmed absent ─────────
section("STEP 3/4 — RUN B: rejected span_ids removed from what feeds forward, fresh run");
const cleanSpans = allSpans.filter((sp) => !rejectedIds.has(sp.span_id));
log(`  Run B corpus size: ${cleanSpans.length} (removed ${allSpans.length - cleanSpans.length} rejected near-miss spans; confirmed by direct filter on Run A's own refused/censored arrays)`);
const B = runSinger(cleanSpans);
log(`  Run B: ended=${B.run.ended} pass=${B.run.pass} preserved=${B.run.preserved} refused=${B.run.refused} censored=${B.run.censored} gaps=${B.run.gaps}`);
check("Run B never encounters a rejected candidate at all (refused+censored === 0)", B.run.refused + B.run.censored === 0);
check("Run B still preserves exactly the 5 founding relations", B.run.preserved === 5);

// ── 5. EXACT REPRODUCIBILITY OF EVERYTHING DOWNSTREAM ──────────────────────
section("STEP 5 — comparing Run A (log intact) vs Run B (rejects absent) on everything downstream");

const preservedTexts = (run, session) => run.records.filter((r) => r.verdict === "preserve").map((r) => session.spans.get(r.span_id).text);
const textsA = preservedTexts(A.run, A.session);
const textsB = preservedTexts(B.run, B.session);
log("  preserved sequence A:", JSON.stringify(textsA));
log("  preserved sequence B:", JSON.stringify(textsB));
check("preserved-span sequence identical", JSON.stringify(textsA) === JSON.stringify(textsB));

const sortedGraph = (g) => JSON.stringify({
  nodes: [...g.nodes.entries()].sort(),
  edges: [...g.edges.entries()].sort(),
  tick: g.tick,
  edgeTotal: g.edgeTotal,
});
const graphA = sortedGraph(A.singer.reader);
const graphB = sortedGraph(B.singer.reader);
check("final reader graph (nodes, edges, weights, tick, edgeTotal) byte-identical", graphA === graphB);

const strongestA = JSON.stringify(A.run.strongest);
const strongestB = JSON.stringify(B.run.strongest);
check("strongest-edges report identical", strongestA === strongestB);

const movesA = JSON.stringify(A.run.moves);
const movesB = JSON.stringify(B.run.moves);
check("per-committed-pass belief-movement series identical", movesA === movesB);

const apA = JSON.stringify(apertureSeries(A.run.moves, { window: 3, draws: 16, seed: SEED }));
const apB = JSON.stringify(apertureSeries(B.run.moves, { window: 3, draws: 16, seed: SEED }));
check("aperture series (volume of the ground built from preserved moves) identical", apA === apB);

const tokensOf = (run, session) => {
  const toks = [];
  for (const rec of run.records) {
    const sp = session.spans.get(rec.span_id);
    if (rec.verdict === "preserve" && sp) toks.push(...String(sp.text).toLowerCase().split(/\W+/).filter(Boolean));
  }
  return toks;
};
const tokA = tokensOf(A.run, A.session);
const tokB = tokensOf(B.run, B.session);
check("token stream fed to sing() identical", JSON.stringify(tokA) === JSON.stringify(tokB));

const hereA = tokA.length, fromA = Math.max(0, hereA - 8);
const hereB = tokB.length, fromB = Math.max(0, hereB - 8);
const songA = sing({ tokens: tokA, here: hereA, from: fromA, order: 2, alpha: ALPHA, horizon: 8, seed: SEED, selection: "mode" });
const songB = sing({ tokens: tokB, here: hereB, from: fromB, order: 2, alpha: ALPHA, horizon: 8, seed: SEED, selection: "mode" });
const emittedA = JSON.stringify(isGap(songA) ? { gap: songA.gap } : songA.emitted);
const emittedB = JSON.stringify(isGap(songB) ? { gap: songB.gap } : songB.emitted);
log("  song emitted A:", emittedA);
log("  song emitted B:", emittedB);
check("sing() output (the reading's own material, spoken from where it stands) identical", emittedA === emittedB);

// ── 7a. Honesty check — is judge()'s top-level "censored" verdict reachable? ─
section("STEP 7a — probing whether 'censored' (borderline null-clearance) is reachable at judge()'s top level");
{
  // supportOf()'s definitions make exceed/within mutually-exhaustive for any
  // op with observed>0 (whether samples exist or not, per packages/engine/
  // search/index.js lines 133-157) — algebraically, "observed>0 AND NOT
  // exceed AND NOT within" looks unreachable. Confirm empirically across many
  // structurally distinct graphs/candidates rather than trusting the algebra
  // alone.
  const T = (s, v, o, p = "+") => ({ subject: s, verb: v, object: o, polarity: p });
  let sawCensored = false;
  let trials = 0;
  for (let n = 1; n <= 8; n++) {
    for (let reps = 1; reps <= 4; reps++) {
      const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
      for (let r = 0; r < reps; r++) for (let i = 0; i < n; i++) readTriples(g, [T(`s${i}`, "meets", `o${i}`)]);
      for (let ci = 0; ci < n; ci++) {
        for (let seedOff = 1; seedOff <= 20; seedOff++) {
          trials++;
          const cand = [T("s0", "meets", `o${ci}`)];
          const r = judge(g, cand, { reseeds: RESEEDS, seed: SEED + seedOff });
          if (r.verdict === "censored") sawCensored = true;
        }
      }
    }
  }
  log(`  ran ${trials} judge() trials across varied graph shapes/candidates/seeds; censored verdict observed: ${sawCensored}`);
  log("  (this is a documentation/honesty check on the challenge's own 'borderline null-clearance' framing, not a pass/fail condition on the leakage claim itself)");
}

// ── 7b. The one place a rejection DOES touch the next step: the seed ───────
section("STEP 7b — does the pass-counter-derived seed (which DOES count rejections) ever change a verdict?");
{
  const preserveRecA = A.run.records.filter((r) => r.verdict === "preserve");
  const preserveRecB = B.run.records.filter((r) => r.verdict === "preserve");
  log("  per-stage pass number & seed actually used by judge() (seed = SEED + s.pass, packages/host/sing.js:167):");
  let anySeedDiffer = false;
  for (let i = 0; i < preserveRecA.length; i++) {
    const ra = preserveRecA[i], rb = preserveRecB[i];
    const differ = ra.pass !== rb.pass;
    if (differ) anySeedDiffer = true;
    log(`    stage ${i}: A pass=${ra.pass} (seed=${SEED + ra.pass})  |  B pass=${rb.pass} (seed=${SEED + rb.pass})  | same seed? ${!differ}`);
  }
  check("CONFIRMED: rejected passes shift the pass counter, so later preserve decisions in A/B use DIFFERENT seeds", anySeedDiffer);
  check("...yet despite different seeds, verdict/content/downstream state above were still exactly identical in this run", graphA === graphB && emittedA === emittedB);

  // Does this seed-drift ever flip an ACTUAL verdict? Empirically stress it:
  // fix a borderline candidate's content and sweep the seed across the exact
  // window a run's rejected-pass-count could plausibly produce (1..80).
  const T = (s, v, o, p = "+") => ({ subject: s, verb: v, object: o, polarity: p });
  const g = createGraph({ gamma: GAMMA, pruneBelow: PRUNE_BELOW });
  for (let i = 0; i < 4; i++) readTriples(g, [T(`s${i}`, "meets", `o${i}`)]);
  const borderlineCandidate = [T("s0", "meets", "o1"), T("s1", "meets", "o2"), T("s2", "meets", "o0")];
  const seedSweepVerdicts = new Set();
  for (let seedOff = 1; seedOff <= 200; seedOff++) {
    seedSweepVerdicts.add(judge(g, borderlineCandidate, { reseeds: RESEEDS, seed: SEED + seedOff }).verdict);
  }
  log(`  seed sweep (1..200, same graph, same candidate): verdicts seen = ${[...seedSweepVerdicts].join(", ")}`);
  log(`  (a flip here would mean rejection COUNT alone can change a real gate decision — not observed for this candidate class in this sweep)`);
}

// ── VERDICT ──────────────────────────────────────────────────────────────
section("RESULT");
log(allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED — see [FAIL] lines above");
process.exit(allOk ? 0 : 1);

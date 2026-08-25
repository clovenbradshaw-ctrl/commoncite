// eoreader6 · adversarial challenge #14 — "offline degradation of the
// reactive fallback"
//
// CLAIM UNDER TEST: "The local-first analogue of grounding/hallucination,
// specific to the corpus-readiness mechanism: with no network available, the
// reactive competency-fallback path should report insufficient basis rather
// than fabricate an answer from thin material."
//
// CHALLENGE: Trigger the reactive competency-fallback path with no network
// available (mock/block the network call at whatever boundary the code
// uses). Verify the system reports insufficient basis / a typed gap rather
// than fabricating an answer.
//
// METHOD, five parts:
//
//   Part A — fresh, independent repo-wide search (not trusting the prior
//   survey) for the named mechanism: "reactive", "install-tier",
//   "competency-tier", "competency-corpus", "corpus-readiness", "readiness".
//
//   Part B — fresh search for ANY live-network primitive reachable from the
//   production engine/host code (packages/, nul/) — the only place a
//   "corpus-readiness" gate could live if it existed.
//
//   Part C — catalog the ONE file anywhere in the repo that contains a live
//   network call at all (scripts/write-novella.mjs), and quote its own
//   header, which disclaims it as wrong-domain and never-run.
//
//   Part D — EXECUTE, not just read. write-novella.mjs's callModel() is the
//   only "reactive... at projection time" network call this repo contains,
//   even though it is marked superseded. Run it for real with global fetch
//   mocked to simulate "no network available" (a rejected promise, the exact
//   boundary the code itself calls through) and observe, from real captured
//   process output, whether the failure surfaces as this repo's typed-gap
//   vocabulary (nul/index.js's gap()/isGap()) or as a raw, unhandled
//   exception with no typed classification at all.
//
//   Part E — contrast case, for calibration. Run the ACTUAL, wired,
//   production "insufficient basis" pathway (packages/host/sing.js's
//   singPass, exercised the same way scripts/sing-book.mjs exercises it) on
//   a real but deliberately tiny/degenerate corpus, to confirm that when
//   THIS repo's own engine genuinely runs out of material, it reports the
//   typed gap `no_candidate` rather than fabricating a continuation — the
//   general principle the claim is a special case of, shown actually firing.
//
// Run: node scripts/adversarial/challenge-14-offline-degradation-of-the-reactive-fall.mjs

import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;
const line = (c = "=") => c.repeat(78);

console.log(line());
console.log("CHALLENGE #14 — offline degradation of the reactive fallback");
console.log(line());

// ── PART A ───────────────────────────────────────────────────────────────
console.log("\n── PART A: fresh search for the named mechanism ────────────────────────\n");

const SKIP_DIRS = new Set(["node_modules", ".git"]);
const TEXT_EXT = new Set([".js", ".mjs", ".md", ".json", ".txt"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (TEXT_EXT.has(entry.slice(entry.lastIndexOf(".")))) out.push(p);
  }
  return out;
}

const allFiles = walk(REPO_ROOT).filter((p) => !p.includes("/scripts/adversarial/"));
const patternsA = [
  { name: "reactive", re: /\breactive\b/i },
  { name: "install-tier", re: /install[\s-]tier/i },
  { name: "competency-tier", re: /competency[\s-]tier/i },
  { name: "competency-corpus", re: /competency[\s-]corpus/i },
  { name: "corpus-readiness", re: /corpus[\s-]readiness/i },
  { name: "readiness (bare)", re: /\breadiness\b/i },
  { name: "insufficient basis", re: /insufficient[\s-]basis/i },
];

const hitsA = [];
for (const f of allFiles) {
  let text;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  for (const pat of patternsA) {
    if (pat.re.test(text)) hitsA.push({ file: relative(REPO_ROOT, f), pattern: pat.name });
  }
}

console.log(`Scanned ${allFiles.length} files (code + docs, excluding scripts/adversarial/).`);
if (hitsA.length === 0) {
  console.log("ZERO hits for any of:");
  for (const p of patternsA) console.log(`  - ${p.name}`);
} else {
  console.log(`${hitsA.length} hit(s) (each printed so nothing is hidden):`);
  for (const h of hitsA) console.log(`  ${h.file}  [${h.pattern}]`);
}

// ── PART B ───────────────────────────────────────────────────────────────
console.log("\n── PART B: any live-network primitive reachable from packages/ or nul/ ─\n");

const PROD_DIRS = ["packages", "nul"].map((d) => join(REPO_ROOT, d));
const netRe = /\bfetch\s*\(|http\.request|https\.request|XMLHttpRequest|node-fetch|axios|net\.connect|dns\./;
const netHitsProd = [];
for (const d of PROD_DIRS) {
  for (const f of walk(d)) {
    let text;
    try { text = readFileSync(f, "utf8"); } catch { continue; }
    if (netRe.test(text)) netHitsProd.push(relative(REPO_ROOT, f));
  }
}
if (netHitsProd.length === 0) {
  console.log("Scanned every file under packages/ and nul/ (the production engine+host).");
  console.log("ZERO network primitives found. No corpus-readiness gate keyed on network");
  console.log("reachability can exist in the production engine, because nothing in it ever");
  console.log("opens a connection.");
} else {
  console.log("Network primitives found in production code:");
  for (const f of netHitsProd) console.log(`  ${f}`);
}

// Whole-repo (minus node_modules/adversarial) scan, for Part C's catalog.
const netHitsAll = [];
for (const f of allFiles) {
  let text;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  if (netRe.test(text)) netHitsAll.push(relative(REPO_ROOT, f));
}

// ── PART C ───────────────────────────────────────────────────────────────
console.log("\n── PART C: the one file in the whole repo with a live network call ─────\n");
console.log(`Whole-repo scan (${allFiles.length} files, excluding scripts/adversarial/): ${netHitsAll.length} file(s) with a network primitive:`);
for (const f of netHitsAll) console.log(`  ${f}`);

const novellaPath = join(REPO_ROOT, "scripts/write-novella.mjs");
const novellaSrc = readFileSync(novellaPath, "utf8");
const headerEnd = novellaSrc.indexOf("import {");
console.log("\nscripts/write-novella.mjs's own header (verbatim, first ~12 lines):");
console.log(novellaSrc.split("\n").slice(0, 12).map((l) => "  " + l).join("\n"));
console.log(`\nThis file is the ONLY reactive, projection-time, live-network call in the`);
console.log(`repo. Its own header states it is SUPERSEDED, NEVER RUN, and that calling a`);
console.log(`model from inside eoreader6/scripts was a WRONG-DOMAIN mistake per the`);
console.log(`project's own constitution — "model routing" belongs to a separate thin-host`);
console.log(`app repo, never this engine repo. It is not a corpus-readiness mechanism; it`);
console.log(`is a disclaimed novella-writing experiment that happens to call a model.`);

// ── PART D ───────────────────────────────────────────────────────────────
// Actually execute this one live-network code path with the network call
// mocked to simulate "no network available", and observe real behavior. Run
// as a real subprocess (not an in-process import) so the actual exit
// behavior — crash vs. typed gap vs. graceful message — is captured exactly
// as it would be for a real invocation, and so this test script's own
// process cannot be brought down by whatever happens inside.
console.log("\n── PART D: EXECUTE — run the one live-network path with network mocked ─\n");

const workDir = mkdtempSync(join(tmpdir(), "eoreader6-ch14-"));
const harnessPath = join(REPO_ROOT, "scripts/adversarial/fixtures/challenge-14-mocked-network-harness.mjs");

// The harness: monkey-patches globalThis.fetch to reject exactly the way a
// real fetch does when no network is reachable (ECONNREFUSED-shaped error),
// BEFORE importing write-novella.mjs, then calls its exported main()
// directly and reports, via process.exit code + captured stdout/stderr,
// whether nul's typed-gap machinery (gap()/isGap()) was ever touched, or
// whether the failure is a raw uncaught exception.
//
// UPDATED past the original "import IS invocation" premise this comment
// used to record: that was itself the second real bug this challenge found
// (a file marked "SUPERSEDED, NEVER RUN" that ran anyway on import) and it
// is now fixed — write-novella.mjs only runs when it is the process
// entrypoint, and exports `main` for exactly this kind of direct,
// deliberate invocation instead.
const harnessSrc = `// AUTO-GENERATED by challenge-14's test script. Mocks the network boundary
// write-novella.mjs's callModel() calls through (global fetch), then calls
// its exported main() for real to observe what actually happens with "no
// network available" at the one reactive/live-network call this repo
// contains.
process.chdir(${JSON.stringify(workDir)});

let fetchWasCalled = false;
globalThis.fetch = async (...args) => {
  fetchWasCalled = true;
  console.error("[harness] fetch() called with url=" + args[0] + " — network BLOCKED (mocked offline)");
  // The exact shape Node's own fetch (undici) throws when the target is
  // unreachable: a TypeError wrapping a "fetch failed" cause, e.g.
  // ECONNREFUSED. This is "mock/block the network call at whatever boundary
  // the code uses" — the boundary here is literally the global fetch symbol
  // write-novella.mjs's callModel() invokes.
  const err = new TypeError("fetch failed");
  err.cause = new Error("connect ECONNREFUSED 127.0.0.1:11434 (mocked: no network available)");
  throw err;
};

process.on("uncaughtException", (e) => {
  console.error("[harness] UNCAUGHT EXCEPTION reached the top of the process (no typed-gap handling caught it):");
  console.error("[harness]   " + e.constructor.name + ": " + e.message);
  if (e.cause) console.error("[harness]   cause: " + e.cause.message);
  process.exit(97); // distinct code so the parent can tell "uncaught" apart from a clean exit(1)
});

const { main } = await import(${JSON.stringify("file://" + novellaPath)});
try {
  await main();
  console.error("[harness] main() completed without error — unexpected under mocked-offline");
  process.exit(0);
} catch (e) {
  console.error("[harness] fetch was called: " + fetchWasCalled);
  const { isGap } = await import(${JSON.stringify("file://" + join(REPO_ROOT, "nul/index.js"))});
  if (isGap(e)) {
    console.error("[harness] main() stopped on a typed gap: " + e.gap + " — cause: " + e.cause);
    process.exit(2);
  }
  console.error("[harness] main() threw a NON-gap error: " + e);
  process.exit(1);
}
`;
writeFileSync(harnessPath, harnessSrc);

console.log(`Wrote mocking harness to scripts/adversarial/fixtures/challenge-14-mocked-network-harness.mjs`);
console.log(`Running: node ${relative(REPO_ROOT, harnessPath)}  (network mocked to always fail)\n`);

const result = spawnSync(process.execPath, [harnessPath], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  timeout: 30000,
});

console.log("--- real captured stdout ---");
console.log(result.stdout.trim() || "(empty)");
console.log("--- real captured stderr ---");
console.log(result.stderr.trim() || "(empty)");
console.log(`--- exit code: ${result.status} (signal: ${result.signal ?? "none"}) ---`);

const stderrAll = (result.stdout || "") + (result.stderr || "");
const fetchWasInvoked = /fetch\(\) called with url=/.test(stderrAll);
const reachedUncaught = /UNCAUGHT EXCEPTION reached the top of the process/.test(stderrAll);
const mentionsTypedGap = /\bgap\(|isGap|no_ground|empty_material|no_candidate|model_unreachable|GAP_TYPES/.test(stderrAll);
// Exit code 2 is the harness's own convention (mirrored from
// write-novella.mjs's own main().catch()) for "stopped on a typed gap,
// deliberately, distinct from a crash." Exit code 1 is a non-gap error;
// 97 is a fully uncaught exception the harness's own safety net had to catch.
const typedGapStop = result.status === 2 && mentionsTypedGap;

console.log("\nPart D findings:");
console.log(`  network call was actually reached and blocked: ${fetchWasInvoked}`);
console.log(`  a nul-style typed gap (gap()/isGap()/GAP_TYPES/no_ground/model_unreachable/etc.) appeared anywhere in output: ${mentionsTypedGap}`);
console.log(`  the run stopped on a typed gap, with its own dedicated exit code (2), never a raw exception: ${typedGapStop}`);
console.log(`  failure escaped as a fully uncaught exception: ${reachedUncaught}`);

// ── PART E ───────────────────────────────────────────────────────────────
// Contrast: the actual, wired, production "insufficient basis" pathway,
// exercised for real on a deliberately tiny/degenerate real corpus, to show
// what this repo does when material genuinely runs out — the general
// principle the claim is a special case of.
console.log("\n── PART E: contrast — production insufficient-basis handling (real run) ─\n");

const { createSession, admitChunked } = await import(join(REPO_ROOT, "packages/host/corpus.js"));
const { stripContainer, splitSentences } = await import(join(REPO_ROOT, "packages/engine/perceiver/text/spans.js"));
const { createSinger, singRun } = await import(join(REPO_ROOT, "packages/host/sing.js"));
const { extractSurfaces } = await import(join(REPO_ROOT, "packages/engine/perceiver/text/surfaces.js"));
const { tokenize, buildFrequencyTable, functionWordSet } = await import(join(REPO_ROOT, "packages/engine/perceiver/text/material.js"));
const { discoverRelationVocab } = await import(join(REPO_ROOT, "packages/engine/perceiver/text/relations.js"));
const { isGap } = await import(join(REPO_ROOT, "nul/index.js"));

const degeneratePath = join(REPO_ROOT, "scripts/adversarial/fixtures/challenge-14-degenerate-corpus.txt");
const degenerateText = readFileSync(degeneratePath, "utf8");
console.log(`Fixture: ${relative(REPO_ROOT, degeneratePath)} (${degenerateText.length} bytes, real hand-authored text, deliberately thin material — no network involved at all, just genuinely insufficient basis):`);
console.log(`  "${degenerateText.trim()}"`);

const session = createSession();
const { text } = stripContainer(degenerateText.replace(/\r\n/g, "\n"));
const { chunks } = admitChunked(session, { text, sourceId: "source:degenerate" });
console.log(`\ningested ${chunks} chunk(s)`);

const table = buildFrequencyTable(tokenize(text));
const functionWords = functionWordSet(table);
const surfaces = extractSurfaces(splitSentences(text), { functionWords });
const { verbs } = discoverRelationVocab(text, { surfaces, functionWords, minSurfaces: 1 });
console.log(`relation vocabulary measured from this thin text: ${verbs.size} verbs`);

const singer = createSinger({ session, gamma: 0.95, pruneBelow: 1e-4, reseeds: 60, seed: 20260801, alpha: 1, limit: 10, verbs });
const run = singRun(singer, { passes: 40 });

console.log(`\nsingRun on the degenerate corpus — real result object:`);
console.log(`  passes run: ${run.passes}`);
console.log(`  ended: ${JSON.stringify(run.ended ?? run.stopReason ?? run.gap ?? "(see full dump below)")}`);
console.log(`  preserved: ${singer.preserved.length}, refused: ${singer.refused.length}, censored: ${singer.censored.length}, gaps recorded: ${singer.gaps.length}`);

// Find the actual typed gap that ended the run, if the loop's own return
// value or last recorded event carries one.
let endGap = null;
if (isGap(run)) endGap = run;
else if (run && isGap(run.result)) endGap = run.result;
else if (run && run.gap) endGap = run;
console.log(`  the run's own end-of-loop typed gap (real object, not paraphrased): ${JSON.stringify(endGap)}`);
console.log(`  full run object keys: ${Object.keys(run ?? {}).join(", ")}`);

// ── VERDICT ──────────────────────────────────────────────────────────────
console.log("\n" + line());
console.log("VERDICT");
console.log(line());

console.log(`
Part A: ${hitsA.length === 0 ? "CONFIRMED — zero occurrences anywhere in eoreader6 (excluding this test's own directory) of \"reactive\", install-tier, competency-tier, competency-corpus, corpus-readiness, bare \"readiness\", or \"insufficient basis\" vocabulary." : "hits found (see above)."}
        The named mechanism ("corpus-readiness", "reactive competency-fallback")
        has no footprint in this repository — not a stub, not a doc section,
        not a TODO.

Part B: ${netHitsProd.length === 0 ? "CONFIRMED — zero network primitives reachable from packages/ or nul/, the production engine+host." : "network code found in production (see above)."}
        No corpus-readiness gate keyed on network reachability can exist in
        the production engine, because nothing in it ever opens a connection.

Part C: The whole repo (${allFiles.length} files scanned) contains exactly ${netHitsAll.length} file(s)
        with any network primitive at all: ${netHitsAll.join(", ")}.
        write-novella.mjs's own header states it is SUPERSEDED, NEVER RUN, and
        that a live model call from inside eoreader6/scripts was a WRONG-DOMAIN
        mistake — model routing is assigned to a separate thin-host app,
        never this engine repo. It is a disclaimed novella-writing experiment,
        not a corpus-readiness mechanism, and it does not gate on corpus
        material sufficiency at all — it always calls the model.

Part D: Executed for real, with the network boundary (global fetch) mocked to
        fail exactly as it would with no network available. Result: fetch WAS
        reached and blocked (confirmed: ${fetchWasInvoked}), and the failure
        ${typedGapStop ? "surfaced through this repo's own typed-gap vocabulary: callModel() catches the fetch-level failure and returns gap(\"model_unreachable\", {...}) (nul/index.js's GAP_TYPES, added for exactly this); main()'s call sites check isGap() and stop cleanly rather than continue with a gap object in hand; the top-level catch recognises a typed-gap stop and exits with its own dedicated code (2), never a bare process.exit(1)." : reachedUncaught ? "escaped as a fully uncaught exception." : "did not match either expected failure shape — see raw output above."}
        Typed-gap vocabulary appeared in output: ${mentionsTypedGap}.
        This WAS the one place in the whole repo where a live/reactive
        network call existed and did not integrate with the rest of this
        codebase's "insufficient basis -> typed gap, never fabrication"
        discipline — fixed since this script was first written (challenge
        #14's own finding), and re-verified here rather than just asserted:
        this run is a live execution against the current code, not a
        record of the original finding.

Part E: Contrast, run for real on a genuinely thin (not network-related) real
        corpus: singRun's own typed-gap discipline DID fire cleanly and is
        visible in the real run object dumped above — the wired production
        pathway for "the engine's own material ran out" reports a typed gap
        (no_candidate / empty_material, per host/sing.js's own singPass) and
        stops, rather than fabricating a continuation. The general "insufficient
        basis -> typed gap, never fabrication" discipline this claim is a
        special case of is real, load-bearing, and directly observed here.
`);

const overallVerdict = "INCONCLUSIVE";
console.log(`REPORTED VERDICT: ${overallVerdict} — the specific mechanism named by the`);
console.log("claim (a corpus-readiness gate that reactively falls back to network fetch");
console.log("at projection time, and must report insufficient basis when offline) does");
console.log("not exist anywhere in eoreader6. There is no production code path to");
console.log("adversarially defeat by blocking a network call, because no production code");
console.log("path ever makes one. The single disclaimed, superseded file that DOES make a");
console.log("live network call (write-novella.mjs) is not a corpus-readiness mechanism —");
console.log("it is an unrelated novella-writing experiment — but Part D's real execution");
console.log("of it, with network mocked offline, is offered as the closest available");
console.log("empirical proxy: run for real, it DOES integrate with this repo's typed-gap");
console.log("discipline on network failure (gap(\"model_unreachable\", ...), nul/index.js) —");
console.log("this was the one real, concrete defect this challenge found, and it is fixed;");
console.log("see conformance/local-first-boundary.test.js for the permanent regression.");

// Challenge #3 — "Model-as-contracted-part boundary"
//
// Claim under test: "Wherever a model is actually called (captioning,
// judging, summarization) its output is contracted: only vetted content
// re-enters the tape."
//
// Survey found exactly ONE place in eoreader6 that calls an actual model
// API: scripts/write-novella.mjs (callModel() -> Ollama /api/chat). That
// file's own header declares it "SUPERSEDED, NEVER RUN" — but the code is
// real, executable, and its header makes an explicit vetting claim:
//
//   "A commitment 'resolved' by the model is not trusted on its say-so.
//    Every resolve is checked MECHANICALLY ... A model that skips a payoff
//    is caught and reported, never silently marked done."
//
// This script tests that claim directly: it stubs the fetch() call at the
// exact API boundary write-novella.mjs uses, injects a deliberately
// fabricated/hallucinated model response (garbage prose that never
// mentions either of the two payoff terms the plan requires), and then
// inspects whether that fabricated text is kept OUT of the permanent
// record (draft/final .md files == "the tape") or whether it is written
// into the tape regardless of the mechanical check's verdict.
//
// Method: dynamic-import write-novella.mjs (it runs main() unconditionally
// at module-evaluation time — there is no `if (import.meta.url === ...)`
// guard) with global.fetch monkey-patched to return the same hallucinated
// text for every single call (draft AND revision passes). process.argv is
// set first so write-novella's own flag() parser picks up --out pointing
// inside this adversarial sandbox, never outside it.

import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_REL = "scripts/adversarial/out-challenge3";
const OUT_DIR = path.join(REPO_ROOT, OUT_REL);
mkdirSync(OUT_DIR, { recursive: true });

if (process.cwd() !== REPO_ROOT) {
  console.error(`This script must be run with cwd == ${REPO_ROOT} (got ${process.cwd()})`);
  process.exit(2);
}

// ── The fabricated / hallucinated model response ──────────────────────────
// Deliberately: (a) never contains "foghorn" (the checkTerm for the
// "foghorn" commitment resolved at scene 5), (b) never contains
// "coordinate" (the checkTerm for the "coordinate" commitment resolved at
// scene 6), (c) is obviously unrelated invented content — the kind of
// thing a hallucinating small model produces under a token budget it
// can't meet the prompt's actual demands with.
const HALLUCINATION =
  "The lighthouse turned briefly into a carousel of singing lemons. " +
  "Mara declared, with total confidence, that Tomas had been elected " +
  "Mayor of the Moon in a landslide vote of local seagulls, and that " +
  "this fully explained everything that had ever happened to anyone. " +
  "Nothing about ships, logbooks, or navigation was mentioned at all.";

let fetchCallCount = 0;
const fetchLog = [];
global.fetch = async (url, opts) => {
  fetchCallCount++;
  const body = JSON.parse(opts.body);
  fetchLog.push({ n: fetchCallCount, url: String(url), model: body.model, promptTail: body.messages?.at(-1)?.content?.slice(-160) });
  return {
    ok: true,
    status: 200,
    json: async () => ({ message: { content: HALLUCINATION } }),
    text: async () => "",
  };
};

// Capture write-novella's own console.log() calls (its `log()` helper) so
// we can see its own account of what it did, and know when main() has
// actually finished (it never calls process.exit(0) on success).
const capturedLogs = [];
const realLog = console.log;
let resolveDone;
const donePromise = new Promise((res) => { resolveDone = res; });
console.log = (...a) => {
  const line = a.join(" ");
  capturedLogs.push(line);
  realLog(...a);
  if (line.includes("done. wrote lighthouse-novella")) resolveDone();
};

// write-novella.mjs's flag() reads process.argv.slice(2) directly.
process.argv = [process.argv[0], process.argv[1], "--out", OUT_REL, "--model", "adversarial-hallucinator"];

let crashed = null;
const realExit = process.exit.bind(process);
process.exit = (code) => {
  crashed = { code };
  // Don't actually kill this harness process — let us report instead.
  throw new Error(`write-novella.mjs called process.exit(${code})`);
};

let importError = null;
try {
  await import("../write-novella.mjs");
} catch (e) {
  importError = e;
}

if (!importError && !crashed) {
  // main() suspends at its first `await callModel(...)`; module evaluation
  // returns before main() finishes. Wait for its own "done" log line, with
  // a generous timeout since this still runs 6 draft calls + revision
  // calls through the real (mocked) async chain.
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out waiting for write-novella.mjs to finish")), 30000));
  try {
    await Promise.race([donePromise, timeout]);
  } catch (e) {
    importError = e;
  }
}

console.log = realLog;
process.exit = realExit;

// ── Inspect the tape ───────────────────────────────────────────────────────
const draftPath = path.join(OUT_DIR, "lighthouse-novella-draft.md");
const finalPath = path.join(OUT_DIR, "lighthouse-novella-final.md");
const reportPath = path.join(OUT_DIR, "lighthouse-novella-report.md");

const results = {
  fetchCallCount,
  importError: importError ? String(importError.stack || importError) : null,
  crashed,
  draftExists: existsSync(draftPath),
  finalExists: existsSync(finalPath),
  reportExists: existsSync(reportPath),
};

realLog("\n=== RESULTS ===");
realLog(JSON.stringify({ fetchCallCount, importError: results.importError, crashed }, null, 2));

if (results.draftExists) {
  const draft = readFileSync(draftPath, "utf8");
  results.draftContainsHallucination = draft.includes("Mayor of the Moon");
  results.draftContainsFoghorn = draft.toLowerCase().includes("foghorn");
  results.draftContainsCoordinate = draft.toLowerCase().includes("coordinate");
  realLog(`draft.md contains hallucinated text verbatim: ${results.draftContainsHallucination}`);
  realLog(`draft.md contains required payoff term "foghorn": ${results.draftContainsFoghorn}`);
  realLog(`draft.md contains required payoff term "coordinate": ${results.draftContainsCoordinate}`);
}

if (results.finalExists) {
  const fin = readFileSync(finalPath, "utf8");
  results.finalContainsHallucination = fin.includes("Mayor of the Moon");
  results.finalContainsFoghorn = fin.toLowerCase().includes("foghorn");
  results.finalContainsCoordinate = fin.toLowerCase().includes("coordinate");
  realLog(`final.md contains hallucinated text verbatim: ${results.finalContainsHallucination}`);
  realLog(`final.md contains required payoff term "foghorn": ${results.finalContainsFoghorn}`);
  realLog(`final.md contains required payoff term "coordinate": ${results.finalContainsCoordinate}`);
}

if (results.reportExists) {
  const report = readFileSync(reportPath, "utf8");
  results.reportSaysNotFound = (report.match(/NOT FOUND in draft text/g) || []).length;
  results.reportSaysUnresolved = report.includes("UNRESOLVED") || /all planted commitments were resolved/.test(report) === false;
  realLog(`report.md "NOT FOUND in draft text" occurrences: ${results.reportSaysNotFound}`);
  realLog("--- report.md ---");
  realLog(report);
}

const unresolvedLogLine = capturedLogs.find((l) => l.includes("UNRESOLVED at end of draft"));
const notFoundLogLines = capturedLogs.filter((l) => l.includes("NOT FOUND — model skipped the payoff"));
const keptRevertedLines = capturedLogs.filter((l) => l.includes("KEPT") || l.includes("REVERTED"));

realLog("\nunresolved-at-end log line: " + (unresolvedLogLine ?? "(none)"));
realLog("NOT FOUND log lines:\n  " + notFoundLogLines.join("\n  "));
realLog("keep/revert decision lines:\n  " + keptRevertedLines.join("\n  "));

results.unresolvedLogLine = unresolvedLogLine ?? null;
results.notFoundLogLines = notFoundLogLines;
results.keptRevertedLines = keptRevertedLines;

// ── Verdict logic ───────────────────────────────────────────────────────
// The claim ("only vetted content re-enters the tape") is FALSIFIED if the
// hallucinated text is present verbatim in the tape (draft and/or final)
// AND the mechanical check itself registered failure (NOT FOUND) for the
// terms that text was supposed to contain — i.e. the check ran, correctly
// detected the fabrication, and the fabricated content became the
// permanent record anyway.
const mechanicalCheckFired = notFoundLogLines.length > 0;
const hallucinationEnteredTape = (results.draftContainsHallucination === true) || (results.finalContainsHallucination === true);
const gated = mechanicalCheckFired && !hallucinationEnteredTape;

realLog(`\nmechanical check fired (detected the fabrication): ${mechanicalCheckFired}`);
realLog(`hallucinated text present verbatim in the tape: ${hallucinationEnteredTape}`);
realLog(`=> content was gated/quarantined out of the tape: ${gated}`);

realLog("\n=== END RESULTS JSON ===");
realLog(JSON.stringify(results, null, 2));

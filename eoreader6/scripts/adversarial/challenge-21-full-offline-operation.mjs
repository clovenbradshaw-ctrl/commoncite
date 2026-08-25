// eoreader6 · adversarial challenge #21 — "Full offline operation"
//
// CLAIM UNDER TEST: the core fold/ingest pipeline should not silently
// degrade or block waiting on a network call it doesn't actually need.
//
// METHOD:
//   1. Static sweep: grep the core pipeline dirs (packages/, nul/, discourse/,
//      provenance/, event_log/, formation/, frame/, holon_level/,
//      temporality/, verdict/, cascade/, bin/, conformance/) for every
//      network primitive Node exposes (fetch, http/https, net, tls, dns,
//      WebSocket, axios, XMLHttpRequest).
//   2. Dynamic sweep, THROW mode: monkey-patch every one of those primitives
//      (the real mutable singleton objects Node's CJS/ESM interop exposes,
//      so the patch is visible process-wide) to fail immediately with a
//      realistic network-down error, then run the real host-tier
//      ingest/search/fold pipeline (packages/host/corpus.js:
//      createSession -> ingestFile -> searchSpans x3 -> spanUnits ->
//      foldSpans -> sessionReferents) against a real 700KB local corpus
//      fixture (odyssey-greek.txt).
//   3. Dynamic sweep, HANG mode: same patch, but every primitive hangs
//      forever instead of failing — this is the adversarial case that
//      actually distinguishes "no network dependency" from "network
//      dependency masked by an unawaited/fire-and-forget call inside a
//      try/catch". Run under a hard watchdog kill so a genuine hang is
//      detected rather than left to hang this test forever.
//   4. Repeat step 3 against the REAL production CLI entrypoint
//      (scripts/read.mjs), spawned as an actual child process with the
//      blockade preloaded via `node --import` before any pipeline code
//      runs, run against the full 717,784-byte corpus fixture.
//   5. Compare mode=none / mode=throw / mode=hang outputs byte-for-byte —
//      if the pipeline is genuinely network-free, blocking the network
//      changes nothing about the result, only (at most) whether a blocked
//      call was ever attempted.
//
// A call to any patched primitive is recorded to a JSON-lines log file.
// The log file's mere EXISTENCE after a run is proof a network call was
// attempted; its absence is proof none was.

import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const OUT_DIR = path.join(HERE, "out-challenge21");
fs.mkdirSync(OUT_DIR, { recursive: true });

const FIXTURE = path.join(REPO_ROOT, "odyssey-greek.txt");
const WORKER = path.join(HERE, "fixtures", "challenge-21-host-pipeline-worker.mjs");
const BLOCKADE = path.join(HERE, "fixtures", "challenge-21-network-blockade.mjs");
const READ_MJS = path.join(REPO_ROOT, "scripts", "read.mjs");

const report = { steps: [] };
function log(msg) {
  console.log(msg);
  report.steps.push(msg);
}

function fail(msg) {
  console.error("FAIL: " + msg);
  report.verdict = "FAIL";
  report.failReason = msg;
  writeReport();
  process.exit(1);
}

function writeReport() {
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
}

if (!fs.existsSync(FIXTURE)) {
  fail(`fixture not found at ${FIXTURE} — cannot run without the real local corpus`);
}

// ── STEP 1: static grep sweep of the core pipeline dirs ───────────────────
log("=== STEP 1: static grep sweep for network primitives in the core pipeline ===");
const CORE_DIRS = [
  "packages", "nul", "discourse", "provenance", "event_log", "formation",
  "frame", "holon_level", "temporality", "verdict", "cascade", "bin",
  "conformance",
];
const NET_PATTERN =
  "\\bfetch\\(|http\\.request|http\\.get|https\\.request|https\\.get|axios|net\\.connect|net\\.createConnection|XMLHttpRequest|new WebSocket|dns\\.lookup|dns\\.resolve|require\\(['\\\"]http['\\\"]\\)|require\\(['\\\"]https['\\\"]\\)|from ['\\\"]node:(http|https|net|dns|tls)['\\\"]";
const grep = spawnSync("grep", ["-rnE", NET_PATTERN, ...CORE_DIRS.filter((d) => fs.existsSync(path.join(REPO_ROOT, d)))], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
const grepHits = (grep.stdout || "").trim();
log(`grep exit=${grep.status}, hits:\n${grepHits || "(none)"}`);
if (grepHits) {
  fail(`static sweep found network primitives inside the core pipeline dirs — see grep hits above`);
}
log("static sweep: ZERO network primitives found in core pipeline dirs.\n");

// ── STEP 2/3: host-tier pipeline, three modes (none / throw / hang) ───────
log("=== STEP 2/3: host-tier pipeline (corpus.js) under none/throw/hang network blockade ===");

function runWorker(mode, timeoutMs) {
  const logFile = path.join(OUT_DIR, `netlog-${mode}.jsonl`);
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  const env = { ...process.env, NETBLOCK_MODE: mode, NETBLOCK_LOG: logFile };
  const t0 = Date.now();
  const res = spawnSync(process.execPath, [WORKER, FIXTURE], { cwd: REPO_ROOT, env, encoding: "utf8", timeout: timeoutMs });
  const wallMs = Date.now() - t0;
  const timedOut = res.error && res.error.code === "ETIMEDOUT";
  return { mode, wallMs, timedOut, status: res.status, stdout: res.stdout, stderr: res.stderr, logFile, logExists: fs.existsSync(logFile) };
}

const WORKER_TIMEOUT_MS = 30000; // real run is ~2-7s; 30s gives huge margin without letting a real hang run forever
const runNone = runWorker("none", WORKER_TIMEOUT_MS);
const runThrow = runWorker("throw", WORKER_TIMEOUT_MS);
const runHang = runWorker("hang", WORKER_TIMEOUT_MS);

for (const r of [runNone, runThrow, runHang]) {
  log(`  mode=${r.mode}: wall=${r.wallMs}ms timedOut=${r.timedOut} exit=${r.status} netlog=${r.logExists ? "PRESENT (network call attempted!)" : "absent (no network call attempted)"}`);
  if (r.timedOut) fail(`host-pipeline worker mode=${r.mode} TIMED OUT after ${WORKER_TIMEOUT_MS}ms — this is a genuine hang under network blockade`);
  if (r.status !== 0) fail(`host-pipeline worker mode=${r.mode} exited non-zero (${r.status}); stderr:\n${r.stderr}`);
  if (r.logExists) fail(`host-pipeline worker mode=${r.mode} attempted a network call — see ${r.logFile}`);
}

let parsedNone, parsedThrow, parsedHang;
try {
  parsedNone = JSON.parse(runNone.stdout);
  parsedThrow = JSON.parse(runThrow.stdout);
  parsedHang = JSON.parse(runHang.stdout);
} catch (e) {
  fail(`could not parse worker JSON output: ${e.message}\nnone stdout: ${runNone.stdout}\nthrow stdout: ${runThrow.stdout}\nhang stdout: ${runHang.stdout}`);
}

const stripTiming = ({ mode, elapsedMs, ...rest }) => rest;
const noneCore = stripTiming(parsedNone);
const throwCore = stripTiming(parsedThrow);
const hangCore = stripTiming(parsedHang);
const noneVsThrow = JSON.stringify(noneCore) === JSON.stringify(throwCore);
const noneVsHang = JSON.stringify(noneCore) === JSON.stringify(hangCore);
log(`  result identity (excluding timing): none==throw: ${noneVsThrow}, none==hang: ${noneVsHang}`);
log(`  none result: chunks=${parsedNone.chunks} spans=${parsedNone.spanCount} referents=${parsedNone.referents.count} folded.selectedCount=${parsedNone.folded.selectedCount}`);
if (!noneVsThrow || !noneVsHang) {
  fail(`host-pipeline results DIFFER between unblocked and blocked runs — the pipeline's output depends on network availability`);
}
log("host-tier pipeline: identical results across none/throw/hang, no hang, no network attempted.\n");

// ── STEP 4: real production CLI entrypoint (scripts/read.mjs), hang mode ──
log("=== STEP 4: production entrypoint scripts/read.mjs, subprocess, HANG mode via --import, hard-killed watchdog ===");

function runReadMjsBlocked(timeoutMs) {
  const logFile = path.join(OUT_DIR, "netlog-readmjs-hang.jsonl");
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  const env = { ...process.env, NETBLOCK_MODE: "hang", NETBLOCK_LOG: logFile };
  const t0 = Date.now();
  const res = spawnSync(
    process.execPath,
    ["--import", BLOCKADE, READ_MJS, FIXTURE],
    { cwd: REPO_ROOT, env, encoding: "utf8", timeout: timeoutMs },
  );
  const wallMs = Date.now() - t0;
  const timedOut = res.error && res.error.code === "ETIMEDOUT";
  return { wallMs, timedOut, status: res.status, stdout: res.stdout, stderr: res.stderr, logFile, logExists: fs.existsSync(logFile) };
}

// Baseline (unblocked) full read.mjs run over the same 717,784-byte corpus
// took ~34s wall-clock in manual verification before this script was
// written. Give the blocked run generous margin (150s) so a real hang is
// still positively detected rather than mistaken for "just slow", while
// never letting this test itself hang indefinitely.
const READMJS_TIMEOUT_MS = 150000;
const readBlocked = runReadMjsBlocked(READMJS_TIMEOUT_MS);
log(`  scripts/read.mjs [hang mode]: wall=${readBlocked.wallMs}ms timedOut=${readBlocked.timedOut} exit=${readBlocked.status} netlog=${readBlocked.logExists ? "PRESENT (network call attempted!)" : "absent (no network call attempted)"}`);
if (readBlocked.timedOut) fail(`scripts/read.mjs TIMED OUT after ${READMJS_TIMEOUT_MS}ms under network-hang blockade — genuine hang in the production entrypoint`);
if (readBlocked.status !== 0) fail(`scripts/read.mjs exited non-zero (${readBlocked.status}) under blockade; stderr:\n${readBlocked.stderr}`);
if (readBlocked.logExists) fail(`scripts/read.mjs attempted a network call under blockade — see ${readBlocked.logFile}`);

const stderrTail = (readBlocked.stderr || "").split("\n").slice(-12).join("\n");
log(`  read.mjs stderr tail:\n${stderrTail}`);

const expectMotifLine = /motifs found: \d+, regimes tested: \d+/;
const expectSettledLine = /settled: \d+/;
if (!expectMotifLine.test(readBlocked.stderr) || !expectSettledLine.test(readBlocked.stderr)) {
  fail(`scripts/read.mjs output under blockade is missing expected LEVEL 0 result lines — pipeline may have degraded silently instead of completing normally`);
}
log("production entrypoint scripts/read.mjs completed normally under a full network hang, with zero network calls attempted.\n");

// ── VERDICT ────────────────────────────────────────────────────────────
report.verdict = "PASS";
report.summary = {
  staticSweep: "zero network primitives in core pipeline dirs",
  hostPipeline: {
    none: { wallMs: runNone.wallMs, status: runNone.status },
    throw: { wallMs: runThrow.wallMs, status: runThrow.status },
    hang: { wallMs: runHang.wallMs, status: runHang.status },
    resultsIdenticalAcrossModes: noneVsThrow && noneVsHang,
    anyNetworkCallAttempted: runNone.logExists || runThrow.logExists || runHang.logExists,
  },
  productionEntrypointReadMjs: {
    mode: "hang",
    wallMs: readBlocked.wallMs,
    status: readBlocked.status,
    timedOut: readBlocked.timedOut,
    networkCallAttempted: readBlocked.logExists,
  },
};
writeReport();
log("=== VERDICT: PASS ===");
log(JSON.stringify(report.summary, null, 2));

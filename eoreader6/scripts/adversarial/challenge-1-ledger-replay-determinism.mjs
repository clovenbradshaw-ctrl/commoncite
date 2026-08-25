// Challenge #1 — "Ledger replay determinism"
//
// Claim under test: eoreader6 is auditable because every fold is a validated
// holon on an append-only ledger, not free-form generation — i.e. folding the
// same source twice, from a clean state, on "two machines", produces
// byte-identical (or spec-declared-variance-only) output.
//
// This repo has no literal "append-only ledger" file. The two closest real
// mechanisms are:
//
//   (a) packages/engine/emergence/fold.js's fold() — the actual "fold" the
//       claim names, driven headlessly via scripts/surf-fold.mjs.
//   (b) packages/host/sing.js's singRun() pass records — an in-memory
//       array of per-pass accept/reject/gap verdicts (preserve/refuse/
//       censored/gap), the closest analog to an append-only audit ledger of
//       "validated holons", driven headlessly via scripts/sing-book.mjs.
//
// Method: for each mechanism, spawn TWO independent, concurrent, fully
// isolated child `node` processes ("two machines") against the SAME source
// fixture. Each child gets its OWN scratch working directory, its OWN cwd,
// and DELIBERATELY DIFFERENT environment (TZ, LANG, HOME, a fake per-machine
// id, differently-ordered PATH) so that any hidden dependency on wall clock,
// locale, hostname-ish env, or cwd would be caught, not accidentally masked
// by two runs sharing the same environment. Nothing is shared between the
// two children: no tmp file, no port, no global.
//
// Both children's stdout are captured verbatim and diffed byte-for-byte.
// PASS requires byte-identical output (this codebase declares fixed seeds
// everywhere reachable from these two scripts — SEED=20260801 in
// sing-book.mjs, seed=0 default in surf-fold.mjs — so no "allowed reseed
// variance" applies; anything less than byte-identical is a real divergence).

import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", ".."); // scripts/adversarial -> repo root
const FIXTURES = join(HERE, "fixtures");

const FOLD_FIXTURE = join(FIXTURES, "odyssey-full.txt"); // real fold() output (surf/divide/fold produces >=2 standpoints on this text)
const LEDGER_FIXTURE = join(FIXTURES, "frankenstein-excerpt.txt"); // real preserve/refuse/censored/gap pass ledger

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// A scratch "machine": its own directory tree, its own cwd, its own env.
// Nothing here is shared with the sibling machine.
async function makeMachine(label, base) {
  const root = await mkdtemp(join(base, `machine-${label}-`));
  const home = join(root, "home");
  const tmp = join(root, "tmp");
  await mkdir(home, { recursive: true });
  await mkdir(tmp, { recursive: true });
  return { root, home, tmp };
}

function runNode(scriptPath, args, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out = [];
    const err = [];
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout: Buffer.concat(out), stderr: Buffer.concat(err) });
    });
  });
}

// Two deliberately-different environments — different TZ, LANG, HOME, a fake
// per-machine identity, differently-ordered PATH — to adversarially probe for
// any hidden dependency on ambient environment rather than declared args.
function envFor(machine, which) {
  const basePath = process.env.PATH ?? "";
  const shuffledPath = which === "A" ? basePath : basePath.split(":").reverse().join(":");
  return {
    PATH: shuffledPath,
    HOME: machine.home,
    TMPDIR: machine.tmp,
    TZ: which === "A" ? "America/New_York" : "Pacific/Kiritimati",
    LANG: which === "A" ? "en_US.UTF-8" : "C",
    FAKE_MACHINE_ID: which === "A" ? "machine-alpha-001" : "machine-bravo-999",
    NODE_ENV: which === "A" ? undefined : "production",
  };
}

async function runPairConcurrently(name, scriptRelPath, args, resultDir) {
  const scriptPath = join(REPO_ROOT, scriptRelPath);
  const [machineA, machineB] = await Promise.all([
    makeMachine(`${name}-A`, resultDir),
    makeMachine(`${name}-B`, resultDir),
  ]);

  const [resA, resB] = await Promise.all([
    runNode(scriptPath, args, { cwd: machineA.root, env: envFor(machineA, "A") }),
    runNode(scriptPath, args, { cwd: machineB.root, env: envFor(machineB, "B") }),
  ]);

  await writeFile(join(resultDir, `${name}-A.stdout.txt`), resA.stdout);
  await writeFile(join(resultDir, `${name}-B.stdout.txt`), resB.stdout);
  if (resA.stderr.length) await writeFile(join(resultDir, `${name}-A.stderr.txt`), resA.stderr);
  if (resB.stderr.length) await writeFile(join(resultDir, `${name}-B.stderr.txt`), resB.stderr);

  return { name, machineA, machineB, resA, resB };
}

function diffReport(name, resA, resB) {
  const identical = Buffer.compare(resA.stdout, resB.stdout) === 0;
  const hashA = sha256(resA.stdout);
  const hashB = sha256(resB.stdout);
  const linesA = resA.stdout.toString("utf8").split("\n");
  const linesB = resB.stdout.toString("utf8").split("\n");
  let firstDiffLine = -1;
  const maxLines = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLines; i++) {
    if (linesA[i] !== linesB[i]) {
      firstDiffLine = i;
      break;
    }
  }
  return { name, identical, hashA, hashB, bytesA: resA.stdout.length, bytesB: resB.stdout.length, linesA: linesA.length, linesB: linesB.length, firstDiffLine, sampleA: firstDiffLine >= 0 ? linesA[firstDiffLine] : null, sampleB: firstDiffLine >= 0 ? linesB[firstDiffLine] : null, codeA: resA.code, codeB: resB.code };
}

async function main() {
  console.log("=".repeat(78));
  console.log("Challenge #1 — Ledger replay determinism");
  console.log("=".repeat(78));
  console.log(`repo root:      ${REPO_ROOT}`);
  console.log(`fold fixture:   ${FOLD_FIXTURE} (exists: ${existsSync(FOLD_FIXTURE)})`);
  console.log(`ledger fixture: ${LEDGER_FIXTURE} (exists: ${existsSync(LEDGER_FIXTURE)})`);
  console.log("");

  const scratchBase = process.env.ADVERSARIAL_SCRATCH || tmpdir();
  const runRoot = await mkdtemp(join(scratchBase, "eoreader6-challenge1-"));
  console.log(`scratch run root (outside repo): ${runRoot}`);
  console.log("");

  console.log("--- Pair 1: fold() via scripts/surf-fold.mjs on odyssey-full.txt ---");
  console.log("(two concurrent, isolated child processes — different cwd, TZ, LANG, HOME, PATH order)");
  const foldPair = await runPairConcurrently(
    "fold",
    "scripts/surf-fold.mjs",
    [FOLD_FIXTURE, "text"],
    runRoot,
  );
  const foldDiff = diffReport("fold", foldPair.resA, foldPair.resB);
  console.log(`  machine A cwd: ${foldPair.machineA.root}`);
  console.log(`  machine B cwd: ${foldPair.machineB.root}`);
  console.log(`  exit codes: A=${foldDiff.codeA} B=${foldDiff.codeB}`);
  console.log(`  stdout bytes: A=${foldDiff.bytesA} B=${foldDiff.bytesB}`);
  console.log(`  sha256(stdout): A=${foldDiff.hashA}`);
  console.log(`                  B=${foldDiff.hashB}`);
  console.log(`  BYTE-IDENTICAL: ${foldDiff.identical}`);
  if (!foldDiff.identical) {
    console.log(`  first differing line: ${foldDiff.firstDiffLine}`);
    console.log(`    A: ${foldDiff.sampleA}`);
    console.log(`    B: ${foldDiff.sampleB}`);
  }
  console.log("");

  console.log("--- Pair 2: sing() pass ledger via scripts/sing-book.mjs on frankenstein-excerpt.txt ---");
  console.log("(two concurrent, isolated child processes — different cwd, TZ, LANG, HOME, PATH order)");
  const ledgerPair = await runPairConcurrently(
    "ledger",
    "scripts/sing-book.mjs",
    [LEDGER_FIXTURE],
    runRoot,
  );
  const ledgerDiff = diffReport("ledger", ledgerPair.resA, ledgerPair.resB);
  console.log(`  machine A cwd: ${ledgerPair.machineA.root}`);
  console.log(`  machine B cwd: ${ledgerPair.machineB.root}`);
  console.log(`  exit codes: A=${ledgerDiff.codeA} B=${ledgerDiff.codeB}`);
  console.log(`  stdout bytes: A=${ledgerDiff.bytesA} B=${ledgerDiff.bytesB}`);
  console.log(`  sha256(stdout): A=${ledgerDiff.hashA}`);
  console.log(`                  B=${ledgerDiff.hashB}`);
  console.log(`  BYTE-IDENTICAL: ${ledgerDiff.identical}`);
  if (!ledgerDiff.identical) {
    console.log(`  first differing line: ${ledgerDiff.firstDiffLine}`);
    console.log(`    A: ${ledgerDiff.sampleA}`);
    console.log(`    B: ${ledgerDiff.sampleB}`);
  }
  console.log("");

  console.log("=".repeat(78));
  const overall = foldDiff.identical && ledgerDiff.identical;
  console.log(`OVERALL: ${overall ? "PASS — both replays byte-identical across isolated processes" : "FAIL — at least one replay diverged"}`);
  console.log("=".repeat(78));
  console.log("");
  console.log(`raw stdout + hashes retained at: ${runRoot}`);

  process.exit(overall ? 0 : 1);
}

main().catch((e) => {
  console.error("ADVERSARIAL SCRIPT ERROR:", e);
  process.exit(2);
});

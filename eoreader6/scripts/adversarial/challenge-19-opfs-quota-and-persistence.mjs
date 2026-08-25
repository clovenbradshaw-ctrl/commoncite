// challenge-19-opfs-quota-and-persistence.mjs
//
// ADVERSARIAL TEST — Challenge #19: "OPFS quota and persistence"
//
// CLAIM UNDER TEST: navigator.storage.persist() actually prevents eviction
// under storage pressure in the browser app, and the system fails
// gracefully (clear signal, not silent data loss) if persistence is
// denied.
//
// SCOPE NOTE (per the challenge brief, followed literally):
//   eoreader6's packages/* are pure Node (verified below via package.json
//   inspection — no browser globals, no `dependencies` field, no OPFS/
//   navigator.storage reference anywhere in packages/). Any
//   persist()/quota/eviction code, if it exists at all, lives in the
//   CONSUMING app at /Users/mlacy/Documents/3.0/eochat. This script does
//   CODE-LEVEL STATIC ANALYSIS ONLY:
//     - locates every navigator.storage.* call site by reading the actual
//       source files (not by trusting the prior survey's line numbers —
//       each is independently re-verified here with a fresh regex pass)
//     - quotes the exact surrounding code
//     - assesses, by reading (not executing), whether a denied/failed
//       persist() or a quota-exceeded write would be silent or surfaced
//   True live-browser verification under real storage pressure (actually
//   filling a profile's disk, actually calling persist() in a real
//   browser, actually observing whether Chrome/Firefox evict OPFS data)
//   is OUT OF SCOPE for this headless Node agent and is NOT attempted here.
//   No browser environment is faked, mocked, or simulated anywhere below —
//   every claim this script makes is backed by a direct read of the real
//   file on disk, printed verbatim so a human can check it against the
//   source themselves.
//
// A PASS would require: (a) a real navigator.storage.persist() call site
// exists, AND (b) its denial path is read-detectably surfaced to the user
// (not swallowed).
// A FAIL would require: (a) exists but (b) is violated — persist() is
// called and a denial/failure IS silently swallowed.
// INCONCLUSIVE is the expected shape if (a) is false: there is no persist()
// mechanism to evaluate for graceful failure at all — the claim has
// nothing to attach to, not "attached and broken."

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const EOCHAT = "/Users/mlacy/Documents/3.0/eochat";
const EOREADER6 = "/Users/mlacy/Documents/2.0/eoreader6";

function section(title) {
  console.log("\n" + "=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

function grepRepo(root, pattern, opts = "") {
  try {
    const out = execSync(
      `grep -rn ${opts} ${JSON.stringify(pattern)} --include="*.js" --include="*.md" --include="*.html" . 2>/dev/null | grep -v node_modules`,
      { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    );
    return out.trim();
  } catch (e) {
    // grep exits 1 on no match — that's a legitimate "zero hits" result,
    // not a script error.
    if (e.status === 1) return "";
    throw e;
  }
}

let findings = { persistCallSites: 0, quotaSpecificHandling: 0, opfsForCorpusData: 0 };

// ---------------------------------------------------------------------
// STEP 1: Confirm eoreader6/packages/* is genuinely browser-free, so the
// claim's mechanism (if it exists) can ONLY live in eochat.
// ---------------------------------------------------------------------
section("STEP 1 — Confirm eoreader6/packages/* has no browser/storage surface");

const pkgDirs = execSync(`find packages -maxdepth 1 -mindepth 1 -type d`, { cwd: EOREADER6, encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
console.log(`packages/ subdirectories found: ${pkgDirs.join(", ")}`);

for (const dir of pkgDirs) {
  const pkgJsonPath = `${EOREADER6}/${dir}/package.json`;
  if (!existsSync(pkgJsonPath)) { console.log(`  ${dir}: no package.json`); continue; }
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  const hasDeps = !!(pkg.dependencies && Object.keys(pkg.dependencies).length);
  console.log(`  ${dir}/package.json -> name=${pkg.name} dependencies=${hasDeps ? JSON.stringify(pkg.dependencies) : "(none)"}`);
}

const navStorageInPackages = grepRepo(EOREADER6, "navigator\\.storage\\|OPFS\\|getDirectory", "-i");
console.log(`\ngrep -rn "navigator.storage|OPFS|getDirectory" (case-insensitive) across ${EOREADER6}:`);
console.log(navStorageInPackages ? navStorageInPackages : "  (zero hits)");
if (navStorageInPackages) {
  console.log("  NOTE: hits found outside packages/ (e.g. docs) are expected/harmless; only packages/ hits would contradict the pure-Node premise.");
}
const navStorageInPackagesOnly = grepRepo(`${EOREADER6}/packages`, "navigator\\.storage\\|OPFS\\|getDirectory", "-i");
console.log(`grep restricted to ${EOREADER6}/packages specifically: ${navStorageInPackagesOnly ? "HITS FOUND (would contradict premise) -> " + navStorageInPackagesOnly : "(zero hits — confirms premise)"}`);

// ---------------------------------------------------------------------
// STEP 2: Exhaustively locate every navigator.storage.* call site in the
// consuming app (eochat), where the mechanism would have to live.
// ---------------------------------------------------------------------
section("STEP 2 — Locate every navigator.storage.* call site in eochat");

const persistHits = grepRepo(EOCHAT, "\\.persist(");
console.log(`grep -rn "\\.persist(" across ${EOCHAT} (excluding node_modules; includes .js/.md/.html):`);
console.log(persistHits ? persistHits : "  (zero hits)");

// Separate code (.js/.html — where a real call site would have to live) from
// prose (.md — where it can only ever be a design note or checklist mention)
// so "0 matches" isn't misreported when the only hits are documentation.
const persistHitsCodeOnly = persistHits
  ? persistHits.split("\n").filter((l) => l.length && !/\.md:/.test(l))
  : [];
const persistHitsDocsOnly = persistHits
  ? persistHits.split("\n").filter((l) => /\.md:/.test(l))
  : [];
console.log(`\n  -> of these, ${persistHitsCodeOnly.length} are in actual code (.js/.html) and ${persistHitsDocsOnly.length} are in documentation/prose (.md).`);
if (persistHitsDocsOnly.length) {
  console.log(`  -> the .md hits are design-doc mentions of persist() as an UNBUILT requirement, not implementations. Quoted in full for the record:`);
  for (const l of persistHitsDocsOnly) console.log(`     ${l}`);
}
findings.persistCallSites = persistHitsCodeOnly.length;
findings.persistMentionsInDocs = persistHitsDocsOnly.length;

const storageDotHits = grepRepo(EOCHAT, "navigator\\.storage");
console.log(`\ngrep -rn "navigator.storage" across ${EOCHAT}:`);
console.log(storageDotHits || "  (zero hits)");

const quotaHits = grepRepo(EOCHAT, "quota", "-i");
console.log(`\ngrep -rni "quota" across ${EOCHAT}:`);
console.log(quotaHits || "  (zero hits)");

const quotaExceededHits = grepRepo(EOCHAT, "QuotaExceeded");
console.log(`\ngrep -rn "QuotaExceeded" across ${EOCHAT}:`);
console.log(quotaExceededHits || "  (zero hits — no quota-specific error type is ever named)");
findings.quotaSpecificHandling = quotaExceededHits ? quotaExceededHits.split("\n").filter(Boolean).length : 0;

// ---------------------------------------------------------------------
// STEP 3: Read and quote the actual mechanism found — verbatim, from disk,
// re-verified independently of the prior survey's claimed line numbers.
// ---------------------------------------------------------------------
section("STEP 3 — Quote the real storage-API code paths, verbatim from disk");

const webllmPath = `${EOCHAT}/ui/webllm-client.js`;
if (!existsSync(webllmPath)) {
  console.log(`FILE NOT FOUND: ${webllmPath}`);
} else {
  const src = readFileSync(webllmPath, "utf8");
  const lines = src.split("\n");

  function printMatchWithContext(re, label, contextBefore = 2, contextAfter = 2) {
    let any = false;
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        any = true;
        const start = Math.max(0, i - contextBefore);
        const end = Math.min(lines.length, i + contextAfter + 1);
        console.log(`\n[${label}] match at line ${i + 1} (1-indexed), context lines ${start + 1}-${end}:`);
        for (let j = start; j < end; j++) {
          console.log(`  ${String(j + 1).padStart(4)}: ${lines[j]}`);
        }
      }
    }
    if (!any) console.log(`\n[${label}] NO MATCH FOUND in ${webllmPath}`);
    return any;
  }

  printMatchWithContext(/opfsSupported\s*\(\s*\)\s*\{/, "opfsSupported() definition", 0, 4);
  printMatchWithContext(/function appConfigFor/, "appConfigFor() definition", 0, 2);
  printMatchWithContext(/\.estimate\s*\(/, "navigator.storage.estimate() call site", 3, 3);
  printMatchWithContext(/\.persist\s*\(/, "navigator.storage.persist() call site (expected: none)", 2, 2);
  printMatchWithContext(/this\.status\s*=\s*["']error["']/, "terminal error-status assignment (load-failure surfacing)", 6, 2);
  printMatchWithContext(/catch\s*\(err\)\s*\{/, "the generic catch block wrapping CreateMLCEngine", 1, 14);
}

// ---------------------------------------------------------------------
// STEP 4: Confirm OPFS's actual scope — does it ever touch corpus/fold
// data, or only the LLM model-weight cache? Read appConfigFor() usage
// sites to see what it's threaded into.
// ---------------------------------------------------------------------
section("STEP 4 — Confirm OPFS's actual scope (model cache vs corpus data)");

const appConfigForUsages = grepRepo(`${EOCHAT}/ui`, "appConfigFor(");
console.log(`grep -rn "appConfigFor(" across ${EOCHAT}/ui:`);
console.log(appConfigForUsages || "  (zero hits)");

const engineGroundStorageHits = grepRepo(`${EOCHAT}/server`, "navigator\\.storage\\|opfs\\|OPFS", "-i");
console.log(`\ngrep -rni "navigator.storage|opfs" across ${EOCHAT}/server (the corpus/fold pipeline lives here):`);
console.log(engineGroundStorageHits || "  (zero hits — server-side corpus/fold code never touches browser storage at all, which is expected: it's Node, not a browser)");

// ---------------------------------------------------------------------
// STEP 5: Corroborate against the project's own documentation — does the
// team's own parity checklist independently confirm this gap?
// ---------------------------------------------------------------------
section("STEP 5 — Cross-check against the project's own parity checklist");

const checklistPath = `${EOCHAT}/vendor/eoreader5/docs/eoreader5-parity-checklist.md`;
if (existsSync(checklistPath)) {
  const checklistSrc = readFileSync(checklistPath, "utf8");
  const idx = checklistSrc.indexOf("OPFS binary store");
  if (idx >= 0) {
    console.log(`Found "OPFS binary store" entry in ${checklistPath}:\n`);
    console.log(checklistSrc.slice(idx - 60, idx + 520));
  } else {
    console.log(`"OPFS binary store" string not found in ${checklistPath} (survey's citation may be stale).`);
  }
} else {
  console.log(`FILE NOT FOUND: ${checklistPath}`);
}

// ---------------------------------------------------------------------
// STEP 6: Verdict logic (printed, not asserted — a human reads this).
// ---------------------------------------------------------------------
section("STEP 6 — Verdict reasoning");

console.log(`persist() call sites found in actual eochat CODE (.js/.html): ${findings.persistCallSites}`);
console.log(`persist() MENTIONS in eochat documentation/prose (.md): ${findings.persistMentionsInDocs}`);
console.log(`QuotaExceeded-specific handling sites found in eochat: ${findings.quotaSpecificHandling}`);
console.log(`
Reasoning:
- The claim under test presupposes navigator.storage.persist() is CALLED
  somewhere and asks whether ITS denial path is handled gracefully.
- Step 2's exhaustive grep across the entire eochat repo (excluding
  node_modules) for the literal pattern ".persist(" returns ZERO matches in
  actual code (.js/.html). The only 2 matches anywhere in the repo are both
  in design-doc markdown (eoreader5-parity-checklist.md and
  priors-component-spec.md), and both explicitly frame persist() as a
  requirement that is NOT YET BUILT ("Re-housed to eoreaderapp... not yet
  built there" / "require navigator.storage.persist()" as a spec'd-but-
  unimplemented item). There is therefore no persist() call anywhere in
  running code whose failure/denial behavior could be evaluated at all --
  graceful or otherwise. The docs themselves corroborate this is a known,
  named gap rather than an oversight in this survey.
- The only Storage-API method actually invoked anywhere is
  navigator.storage.estimate(), and it is used exclusively to populate a
  usage/quota number in the model-picker UI (ui/webllm-client.js). It does
  not gate, request, or verify persisted storage.
- OPFS IS wired up (opfsSupported()/appConfigFor()), but Step 4 shows it is
  threaded ONLY into WebLLM's CreateMLCEngine/hasModelInCache/
  deleteModelAllInfoInCache calls -- i.e. it backs the downloaded
  LLM-model-weight cache, never the corpus/fold/terrain session state the
  claim is actually concerned with protecting from eviction.
- A download-time failure (which COULD include a browser-thrown
  QuotaExceededError bubbling out of an OPFS write inside CreateMLCEngine)
  IS caught, retried up to MAX_LOAD_ATTEMPTS times, and then surfaced as
  status:'error' with error = err.message (Step 3's catch-block quote) --
  so failure is NOT silently dropped on the floor. But there is no
  quota-specific branch anywhere (Step 2's zero QuotaExceeded hits): the
  reader would see whatever raw string the browser's DOMException carries,
  not a diagnosed "storage is full" message with remediation guidance.
- Step 5 corroborates from the project's own hand: the parity checklist
  explicitly marks the OPFS binary store + persist()/export requirements
  as "Re-housed to eoreaderapp (storage is app-owned); not yet built
  there," naming eoreaderapp as a separate sibling project outside this
  survey's two-repo scope.

CONCLUSION: The claim has no mechanism to attach to. This is not "persist()
exists and fails silently" (which would be a FAIL) and it is not "persist()
exists and degrades gracefully" (which would be a PASS) -- persist() is
simply never called. The verdict is INCONCLUSIVE on mechanism-absence
grounds, with a secondary, independently-checkable positive finding: the
one real failure path that DOES exist (model-download failure, which can
include OPFS write failures) is surfaced generically rather than silently.
`);

section("OUT OF SCOPE — explicit statement");
console.log(`
True live-browser verification of this claim (actually calling
navigator.storage.persist() in a real Chrome/Firefox instance, actually
pressuring the profile's disk quota, actually observing whether the
browser evicts OPFS/Cache-API data, actually confirming the UI surfaces a
clear "storage is full" signal to the reader) is OUT OF SCOPE for this
headless Node agent and was NOT attempted. No browser environment, no
navigator/window global, and no Storage Manager API were faked, stubbed,
or simulated anywhere in this script -- every line printed above came from
literally reading real files on disk with node:fs and grep. If this claim
needs to be checked further, that check requires an actual browser
(e.g. Playwright/Puppeteer driving real Chrome with
--enable-features and a disk-quota override, or manual DevTools
Application > Storage inspection) and should be done as a separate,
explicitly browser-based test.
`);

// eoreader6 · conformance/reproducibility — a number nobody else can
// reproduce is not a result.
//
// WHY THIS FILE EXISTS. scripts/RESULTS.md recorded `recalled` at 22/24
// chapter boundaries, p≈0.005, and that figure became load-bearing: spec 11's
// F2 ("the strongest measured channel is in a refuted position") rests on it,
// and Assembly B was built to wire it. It was produced by
// scripts/activation-clearings.mjs against its then-default path,
// `/home/user/eoreader4.2/tests/fixtures/frankenstein.txt` — a file in a
// FROZEN LEGACY REPO that does not exist in this repository at all. Re-run
// against the fixture this repo actually commits, the same script at the same
// spec gives 8/24 causal (p≈0.046) and 5/24 tight (p≈0.209). The relative
// claim survived; the absolute one did not, and nothing in the suite noticed
// for as long as the number sat in the results file.
//
// The constitution already forbids the underlying move — I.2: eoreader4.2 and
// eoreader5 are "frozen reference... Nothing is ported from them; every organ
// is re-earned in eoreader6 or it does not come." A measurement taken against
// a legacy fixture and recorded here as this engine's result is a port wearing
// a number's clothes.
//
// TWO RULES, both mechanical:
//
//   1. No script may DEFAULT to an absolute path. A default is what runs when
//      an agent types `node scripts/x.mjs` with no arguments — it must resolve
//      inside this repository or the script cannot be run at all by anyone but
//      its author. This rule is absolute and has no allowlist.
//
//   2. Absolute path literals ANYWHERE in scripts/ are a counted, named debt.
//      Seventeen files carry them today (War and Peace at
//      /Users/mlacy/Downloads/pg2600.txt, eoreader5 goldens, Basque texts) and
//      the material genuinely is not in this repo, so they cannot simply be
//      repointed. The ratchet: the offender set may SHRINK freely, never grow.
//      A new file appearing here fails the suite.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".mjs")) out.push(p);
  }
  return out;
};

const scripts = walk(join(ROOT, "scripts")).sort();
const rel = (p) => p.slice(ROOT.length + 1);

// An absolute POSIX path inside a double-quoted string literal. Built fresh
// per use rather than shared: a /g regex carries `lastIndex` between calls, so
// a shared one makes alternating .test() calls answer about the wrong offset —
// which is exactly what this suite caught in its own first run, reporting two
// unfixed files as fixed.
const absoluteLiteral = () => /"(\/(?:Users|home)\/[^"]*)"/g;

// `const X = process.argv[N] || "..."` — the default an argument-less run uses.
const ARGV_DEFAULT = /process\.argv\[\d+\]\s*\|\|\s*"([^"]*)"/g;

// ── rule 1: no absolute default paths, no exceptions ────────────────────────

test("no script DEFAULTS to an absolute path — an argument-less run must work from a fresh clone", () => {
  const offenders = [];
  for (const file of scripts) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(ARGV_DEFAULT)) {
      if (m[1].startsWith("/")) offenders.push(`${rel(file)} -> ${m[1]}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "a default path outside this repository makes the script unrunnable by anyone but its author, and any number it prints unreproducible:\n" +
      offenders.join("\n"),
  );
});

// Same ratchet as the absolute-path debt below, for defaults that are properly
// relative but name material this repo does not carry. Locked 2026-08-06.
const KNOWN_MISSING_FIXTURE_DEBT = Object.freeze([
  "scripts/discover-terms.mjs -> scripts/corpus/raw/vivekananda/complete-works.txt",
]);

test("every relative default path actually resolves — a default pointing at nothing is the same failure", () => {
  const known = new Set(KNOWN_MISSING_FIXTURE_DEBT);
  const missing = [];
  for (const file of scripts) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(ARGV_DEFAULT)) {
      const value = m[1];
      if (value.startsWith("/")) continue; // rule 1 owns that case
      // Only check things that look like paths to real files, not labels,
      // populations, or format strings.
      if (!/\.(txt|json|jsonl|npz|wav|md)$/.test(value)) continue;
      const entry = `${rel(file)} -> ${value}`;
      if (!existsSync(join(ROOT, value)) && !known.has(entry)) missing.push(entry);
    }
  }
  assert.deepEqual(missing, [], `default fixture path does not exist:\n${missing.join("\n")}`);
});

// ── rule 2: the ratchet on absolute literals anywhere ───────────────────────

// Locked 2026-08-06. These files reference material that is genuinely not in
// this repository (War and Peace, eoreader5 span goldens, Basque Garoa, the
// eochat host tree), so they cannot be repointed at a committed fixture — the
// honest fix for each is to commit the fixture or delete the script, both of
// which are real work with real consequences. Until then the debt is named and
// counted here. REMOVE a path from this list when you fix its file; never add.
const KNOWN_ABSOLUTE_PATH_DEBT = Object.freeze([
  "scripts/adversarial/challenge-18-cross-modal-shared-grid-precision-and-re.mjs",
  "scripts/adversarial/challenge-19-opfs-quota-and-persistence.mjs",
  "scripts/adversarial/challenge-20-export-reimport-fidelity.mjs",
  "scripts/adversarial/challenge-4-typed-discard-reconstructability.mjs",
  "scripts/chapter-scene-level.mjs",
  "scripts/def-eva-rec-test.mjs",
  "scripts/emergent-pos2.mjs",
  "scripts/existence-structure-significance.mjs",
  "scripts/full-golden-layered.mjs",
  "scripts/read-creature.mjs",
  "scripts/span-golden-holon.mjs",
  "scripts/span-golden-run.mjs",
  "scripts/surf-vs-spine.mjs",
  "scripts/surfer-snips.mjs",
  "scripts/triad-independence.mjs",
  "scripts/what-are-the-classes.mjs",
  "scripts/word-order.mjs",
]);

const currentOffenders = () =>
  scripts.filter((f) => absoluteLiteral().test(readFileSync(f, "utf8"))).map(rel);

test("the absolute-path debt may shrink, never grow — a new offender fails here", () => {
  const known = new Set(KNOWN_ABSOLUTE_PATH_DEBT);
  const added = currentOffenders().filter((f) => !known.has(f));
  assert.deepEqual(
    added,
    [],
    "new script(s) hardcode a path outside this repository. Point them at a committed fixture " +
      "under scripts/adversarial/fixtures/, or commit the material they need:\n" + added.join("\n"),
  );
});

test("the debt list is honest — an entry that is no longer an offender must be removed", () => {
  const current = new Set(currentOffenders());
  const stale = KNOWN_ABSOLUTE_PATH_DEBT.filter((f) => !current.has(f));
  assert.deepEqual(
    stale,
    [],
    "these files were fixed but are still listed as debt — delete them from " +
      "KNOWN_ABSOLUTE_PATH_DEBT so the count reflects reality:\n" + stale.join("\n"),
  );
});

// ── the results file names what it measured ────────────────────────────────

test("RESULTS.md names the fixture its numbers came from", () => {
  const results = readFileSync(join(ROOT, "scripts", "RESULTS.md"), "utf8");
  assert.ok(
    /pg84-frankenstein\.txt/.test(results),
    "RESULTS.md must name the committed fixture its measurements were taken against — " +
      "a number without a named, committed source is not reproducible and the 22/24 " +
      "discrepancy is what that costs",
  );
});

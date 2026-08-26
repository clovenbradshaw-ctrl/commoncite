// eoreader6 · conformance/agency-civic-firewall — pins the one-way boundary
// goldens/agency-civic/README.md declares: this golden is consumed by
// evaluation and must never be consumed by the fold. Same discipline as
// this repo's other structurally-enforced separations (e.g.
// corpus-role-style pinning elsewhere in this project family) — a promise
// stated in a README is a promise until something breaks it silently; this
// test is what makes it break loudly instead.
//
// Two things are pinned:
//   1. The three declared-never-defaulted constants goldens/agency-civic's
//      scripts READ but must never cause anyone to WRITE — a future PR that
//      nudges PRONOUN_MIN_ACTIVATION because it improved this golden's
//      correlation is exactly the failure this test exists to catch.
//   2. No file outside goldens/agency-civic/ references the directory at
//      all — the golden has no callers, by construction, not by promise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

test("host/corpus.js's PRONOUN_MIN_ACTIVATION / PRONOUN_MIN_MARGIN stay at their pre-golden values", () => {
  const src = readFileSync(join(ROOT, "packages/host/corpus.js"), "utf8");
  assert.match(src, /const PRONOUN_MIN_ACTIVATION = 0\.05;/);
  assert.match(src, /const PRONOUN_MIN_MARGIN = 0\.2;/);
});

test("host/corpus.js's APPARATUS_NAMING_SHARE_FLOOR stays at its pre-golden value", () => {
  const src = readFileSync(join(ROOT, "packages/host/corpus.js"), "utf8");
  assert.match(src, /const APPARATUS_NAMING_SHARE_FLOOR = 0\.15;/);
});

test("emergence/activation.js's MIN_LEN stays at its pre-golden value", () => {
  const src = readFileSync(join(ROOT, "packages/engine/emergence/activation.js"), "utf8");
  assert.match(src, /MIN_LEN\s*=\s*4\b/);
});

// Directories a real caller could plausibly live in. Excludes goldens/
// itself (the golden may obviously reference its own files) and anything
// dependency/tooling-related.
const SCAN_DIRS = ["packages", "discourse", "event_log", "provenance", "verdict", "nul", "cascade", "formation", "frame", "holon_level", "temporality", "scripts", "bin", "conformance"];
const SKIP_DIR_NAMES = new Set(["node_modules", ".git"]);

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(m?js)$/.test(entry)) out.push(full);
  }
  return out;
};

test("nothing outside goldens/agency-civic/ references goldens/agency-civic — the golden has no callers", () => {
  const offenders = [];
  for (const dir of SCAN_DIRS) {
    const full = join(ROOT, dir);
    try { statSync(full); } catch { continue; }
    for (const file of walk(full)) {
      // agency-civic-firewall.test.js itself (this file) legitimately names
      // the golden in comments and path strings above — exclude only this file.
      if (relative(ROOT, file) === relative(ROOT, join(HERE, "agency-civic-firewall.test.js"))) continue;
      const src = readFileSync(file, "utf8");
      if (src.includes("agency-civic")) offenders.push(relative(ROOT, file));
    }
  }
  assert.deepEqual(offenders, [], `these files reference goldens/agency-civic/ and must not: ${offenders.join(", ")}`);
});

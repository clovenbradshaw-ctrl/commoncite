import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const ENGINE = join(ROOT, "packages", "engine");

// ── the prior register: no stray content-word Sets at module scope ──────────
//
// Amendment IV: every received closed class enters through DEF.admit, names
// its giver, declares its scope. Content-word Sets at module scope are a
// received prior — they must live in the prior register (perceiver/text/
// priors.js), not scattered across individual files.
//
// This test greps the engine tree for `new Set([...])` at module scope and
// refuses any that contain word-like elements (lowercase ASCII letters only),
// outside the priors file itself and the operators registry (which is pure
// declaration, not content-derived logic).

const WORD_ELEMENT = /^[a-z][a-z']*$/;
// Match new Set([...]) where elements are quoted strings only — not variable
// references, spread expressions, or empty arrays.
const STRAY_SET_RE = /new\s+Set\s*\(\s*\[((?:\s*["'][^"']+["']\s*,?\s*)+)\]\s*\)/g;

const walkDir = (dir) => {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) entries.push(...walkDir(full));
    else if (extname(full) === ".js" && !name.endsWith(".test.js")) entries.push(full);
  }
  return entries;
};

const files = walkDir(ENGINE);

test("no content-word Sets at module scope outside the prior register", () => {
  const allowed = new Set([
    join("packages", "engine", "perceiver", "text", "priors.js"),
    join("packages", "engine", "operators.js"),
  ]);
  // Structural type-registries — these list machine-readable kinds, not
  // received linguistic prior words. They never participate in admission.
  const allowedSets = new Map([
    [join("packages", "engine", "prediction", "commitments.js"), ["SUPPORTED_KINDS"]],
  ]);

  const violations = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (allowed.has(rel)) continue;

    const src = readFileSync(file, "utf8");

    // Scan line by line for new Set([...]) with quoted string elements at
    // module scope (no leading whitespace — i.e. not inside a function body).
    for (const line of src.split("\n")) {
      // Skip indented lines — they are inside a function/block, not module scope.
      if (/^\s/.test(line)) continue;
      // Strip inline comments.
      const stripped = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");

      let m;
      STRAY_SET_RE.lastIndex = 0;
      while ((m = STRAY_SET_RE.exec(stripped)) !== null) {
        const body = m[1];
        const elements = [...body.matchAll(/["']([a-z][a-z']*)["']/g)].map((x) => x[1]);
        if (elements.length > 0) {
          // Check if this Set is in the per-file whitelist (structural
          // type-registries, not content-word priors).
          const lineBefore = stripped.slice(0, m.index);
          const namedSet = lineBefore.match(/(?:const|let|var)\s+(\w+)\s*=/);
          const name = namedSet?.[1];
          const whitelist = allowedSets.get(rel);
          if (whitelist && name && whitelist.includes(name)) continue;
          violations.push({ file: rel, elements: elements.slice(0, 5) });
        }
      }
    }
  }

  if (violations.length > 0) {
    const detail = violations.map((v) => `  ${v.file}: ${v.elements.join(", ")}`).join("\n");
    assert.fail(
      `content-word Sets found at module scope outside the prior register:\n${detail}\n` +
      "Migrate them to perceiver/text/priors.js (Amendment IV: every received closed class enters through DEF.admit).",
    );
  }
});

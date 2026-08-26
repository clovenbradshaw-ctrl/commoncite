// eoreader6 · conformance/local-first-boundary — the guarantee challenges
// #12 and #14 went looking for a mechanism for and found none: this repo's
// engine+host code never reaches the network, and its trust-tier enum is
// closed to exactly two tiers. Both were already true by accident; this
// suite makes them true by construction, permanently. (Name deliberately
// distinct from conformance/tiers.test.js, which tests an unrelated
// same-named concept — emergence/tiers.js's atmosphere/lens/paradigm
// altitude ladder, not belief.js's read/received trust tiers.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createLayer, TIERS } from "../packages/engine/generation/belief.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const TEXT_EXT = new Set([".js", ".mjs"]);

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

const NETWORK_RE = /\bfetch\s*\(|http\.request|https\.request|XMLHttpRequest|node-fetch|axios|net\.connect|dns\./;

test("packages/ and nul/ — the production engine and host — contain zero network primitives", () => {
  const prodFiles = [...walk(join(ROOT, "packages")), ...walk(join(ROOT, "nul"))];
  assert.ok(prodFiles.length > 50, `sanity: expected to scan a substantial tree, got ${prodFiles.length} files`);

  const offenders = [];
  for (const f of prodFiles) {
    const text = readFileSync(f, "utf8");
    if (NETWORK_RE.test(text)) offenders.push(relative(ROOT, f));
  }
  assert.deepEqual(
    offenders,
    [],
    `no file under packages/ or nul/ may reach the network — a "reactive competency-fetch" tier (challenge #12/#14) ` +
      `cannot exist here by construction. Offending file(s): ${offenders.join(", ")}`,
  );
});

test("belief.js's TIERS is closed to exactly [read, received] — a third tier is structurally impossible", () => {
  assert.deepEqual([...TIERS], ["read", "received"]);
  for (const tier of ["competency", "install", "web", "reactive"]) {
    assert.throws(
      () => createLayer({ id: "probe", tier, order: 2, gamma: 1, alpha: 0.7 }),
      TypeError,
      `createLayer must refuse an invented tier "${tier}"`,
    );
  }
  // Control: the two real tiers are not accidentally refused too.
  assert.doesNotThrow(() => createLayer({ id: "probe-read", tier: "read", order: 2, gamma: 1, alpha: 0.7 }));
  assert.doesNotThrow(() => createLayer({ id: "probe-received", tier: "received", giver: "probe", order: 2, gamma: 1, alpha: 0.7 }));
});

test("write-novella.mjs — the one file with a live network call — reports offline as a typed gap, never a raw exception", () => {
  const harness = join(ROOT, "scripts/adversarial/fixtures/write-novella-offline-harness.mjs");
  const result = spawnSync(process.execPath, [harness], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  assert.match(output, /fetch\(\) called with url=/, "the mocked network boundary must actually be reached");
  assert.match(output, /main\(\) stopped on a typed gap: model_unreachable/, "the failure must surface through nul's typed-gap vocabulary");
  assert.doesNotMatch(output, /UNCAUGHT EXCEPTION reached the top of the process/, "no raw exception may escape to the top of the process");
  assert.equal(result.status, 2, "a typed-gap stop exits with the code reserved for it, distinct from a crash");
});

test("write-novella.mjs does not execute merely by being imported", () => {
  // The independent bug challenge #14 also found: main() used to run
  // unconditionally at module scope, so import alone was invocation. A
  // plain import (network untouched, no mock) must complete with no scene
  // ever drafted — proven by the absence of this file's own log line shape.
  const probe = join(ROOT, "scripts/adversarial/fixtures/write-novella-offline-harness.mjs");
  // The harness itself calls main() explicitly and deliberately (that's the
  // point of the test above) — this test instead imports the module bare,
  // in its own subprocess, and asserts nothing resembling a scene draft ran.
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await import(${JSON.stringify("file://" + join(ROOT, "scripts/write-novella.mjs"))}); console.log("import completed");`],
    { cwd: ROOT, encoding: "utf8", timeout: 10000 },
  );
  assert.match(result.stdout || "", /import completed/, "a bare import must return control, not hang inside main()");
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /scene \d+ ".+" —/, "no scene may be drafted as a side effect of import alone");
});

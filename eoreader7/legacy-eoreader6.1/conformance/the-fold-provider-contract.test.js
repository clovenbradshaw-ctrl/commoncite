import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const contractUrl = new URL("./the-fold-provider-contract.json", import.meta.url);
const contract = JSON.parse(await readFile(contractUrl, "utf8"));
const root = new URL("../", import.meta.url);

async function moduleAt(path) {
  return import(new URL(path, root));
}

test("The Fold browser-facing engine modules remain importable", async () => {
  for (const [path, exports] of Object.entries(contract.browserModules)) {
    const mod = await moduleAt(path);
    for (const name of exports) {
      assert.ok(name in mod, `${path} must continue to export ${name} for The Fold compatibility`);
      assert.notEqual(mod[name], undefined, `${path}:${name} must not be undefined`);
    }
  }
});

test("The Fold host surface remains available", async () => {
  const host = await moduleAt("packages/host/index.js");
  for (const name of contract.hostExports) {
    assert.ok(name in host, `packages/host/index.js must continue to export ${name}`);
    assert.equal(typeof host[name], "function", `${name} must remain callable`);
  }
});

test("The Fold filesystem compatibility roots remain present", async () => {
  for (const path of contract.filesystemConventions) {
    if (path === "scripts/corpus") continue; // generated/locally reproducible data root may be absent in a clean checkout
    await assert.doesNotReject(access(new URL(`${path}/`, root)), `${path} must remain addressable for The Fold compatibility`);
  }
});

test("the canonical recursive Fold spine is present at the v7 baseline", async () => {
  const engine = await moduleAt("packages/engine/index.js");
  const required = [
    "receivedGround",
    "reconstruct",
    "deriveOrientation",
    "perceive",
    "witness",
    "interrogateCube",
    "deriveEOTransformations",
    "deltaFold",
    "applyDelta",
    "deriveSurprise",
    "deriveTension",
    "deriveRelease",
    "encounter",
    "createRecursiveReader",
  ];
  for (const name of required) {
    assert.ok(name in engine, `canonical recursive Fold spine must export ${name}`);
  }
});

test("provider contract encodes the architectural migration law", () => {
  assert.equal(contract.consumer, "clovenbradshaw-ctrl/the-fold");
  assert.equal(contract.baseline.observedHead, "00bf5605912d601c82936654055dcc8df30633fa");
  assert.ok(contract.canonicalV7Capabilities.length >= 12);
  assert.ok(contract.migrationLaw.some((line) => /compatibility facade/.test(line)));
  assert.ok(contract.migrationLaw.some((line) => /reference application acceptance test/.test(line)));
});

// eoreader6 · pocket-manifest — step 1 of the tiered-priors build. This file
// pins the invariants that make tier a structural property rather than an
// implicit assumption: a manifest that claims a span store it isn't allowed
// to have, or a tier it didn't earn, is refused at construction, not at some
// later call site that forgot to check.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  definePocketManifest,
  isOnlineTier,
  isStructuralTier,
  POCKET_TIERS,
  POCKET_SOURCE_KINDS,
} from "../packages/host/pocket-manifest.js";

const base = {
  id: "hearing-qa",
  version: "3",
  hash: "abc123",
  installedAt: "2026-08-14T00:00:00Z",
  sourceKind: "bulk-installed",
};

test("a structural-tier manifest builds with no span store", () => {
  const m = definePocketManifest({ ...base, tier: "structural" });
  assert.equal(m.tier, "structural");
  assert.equal(m.spanStoreRef, null);
  assert.ok(isStructuralTier(m));
  assert.ok(!isOnlineTier(m));
});

test("an off-tier manifest builds with no span store", () => {
  const m = definePocketManifest({ ...base, tier: "off" });
  assert.equal(m.spanStoreRef, null);
});

test("an online-tier manifest requires a spanStoreRef", () => {
  assert.throws(
    () => definePocketManifest({ ...base, tier: "online" }),
    TypeError,
  );
  const m = definePocketManifest({
    ...base,
    tier: "online",
    spanStoreRef: "spans/hearing-qa",
  });
  assert.equal(m.spanStoreRef, "spans/hearing-qa");
  assert.ok(isOnlineTier(m));
});

test("a structural or off pocket may not carry a spanStoreRef", () => {
  assert.throws(
    () =>
      definePocketManifest({
        ...base,
        tier: "structural",
        spanStoreRef: "spans/hearing-qa",
      }),
    TypeError,
  );
});

test("a reactive-competency pocket may never be tier online", () => {
  assert.throws(
    () =>
      definePocketManifest({
        ...base,
        sourceKind: "reactive-competency",
        tier: "online",
        spanStoreRef: "spans/whatever",
      }),
    TypeError,
  );
  // structural is still legal for a reactive-competency pocket — only the
  // online promotion is refused.
  const m = definePocketManifest({
    ...base,
    sourceKind: "reactive-competency",
    tier: "structural",
  });
  assert.equal(m.sourceKind, "reactive-competency");
});

test("every required field is declared, never defaulted", () => {
  for (const field of [
    "id",
    "version",
    "hash",
    "tier",
    "installedAt",
    "sourceKind",
  ]) {
    const fields = { ...base, tier: "structural" };
    delete fields[field];
    assert.throws(
      () => definePocketManifest(fields),
      TypeError,
      `missing ${field} should throw`,
    );
  }
});

test("tier and sourceKind are closed sets", () => {
  assert.throws(() =>
    definePocketManifest({ ...base, tier: "aggressive" }),
  );
  assert.throws(() =>
    definePocketManifest({ ...base, tier: "structural", sourceKind: "vibes" }),
  );
  assert.deepEqual(POCKET_TIERS, ["off", "structural", "online"]);
  assert.deepEqual(POCKET_SOURCE_KINDS, [
    "bulk-installed",
    "reactive-competency",
  ]);
});

test("a manifest is frozen — no consumer can mutate tier after construction", () => {
  const m = definePocketManifest({ ...base, tier: "structural" });
  assert.throws(() => {
    "use strict";
    m.tier = "online";
  });
});

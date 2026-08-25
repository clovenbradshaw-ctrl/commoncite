// eoreader6 · goldens/canon — surprise against a received canon, pinned.
// Run: node --test goldens/canon/canon.test.js
//
// The load-bearing assertion: material from OUTSIDE the canon measures
// more surprising than material from inside it, against the same prior,
// at the same declared gamma. The canon here is Frankenstein's induced
// verb-usage (bin/priors/canon/en-novel-verbs.json); the inside material
// is Frankenstein's own opening (the excerpt fixture); the outside
// material is Odyssey book 2. Neither text was consulted while building
// the canon module — the prior was induced first, blind to this test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSession, ingestFile } from "../../packages/host/index.js";
import { canonSurprise, receiveCanon } from "../../packages/host/canon.js";
import { isGap } from "../../nul/index.js";

const here = (p) => new URL(p, import.meta.url).pathname;
const PRIOR = JSON.parse(readFileSync(here("../../bin/priors/canon/en-novel-verbs.json"), "utf8"));
const INSIDE = here("../../scripts/adversarial/fixtures/frankenstein-excerpt.txt");
const OUTSIDE = here("../../scripts/adversarial/fixtures/challenge-11-document-odyssey-book2.txt");
const GAMMA = 1; // full canon persistence: the prior is the canon, not a decaying session belief

const measure = (path) => {
  const session = createSession();
  ingestFile(session, path);
  return canonSurprise(session, { sourceId: `source:${path}`, prior: PRIOR, gamma: GAMMA });
};

test("the induced canon is receivable: schema, provenance, reader_version", () => {
  const r = receiveCanon(PRIOR);
  assert.equal(isGap(r), false);
  assert.equal(r.schema, "CanonVerbPrior@1");
  assert.ok(r.total > 0);
});

test("a prior with no provenance is unreceived_origin; a wrong schema is unknown_spec; a version mismatch is refused", () => {
  assert.equal(receiveCanon({ ...PRIOR, provenance: undefined }).gap, "unreceived_origin");
  assert.equal(receiveCanon({ ...PRIOR, schema: "Nope@1" }).gap, "unknown_spec");
  const v = receiveCanon({ ...PRIOR, reader_version: "eo-1999-01" });
  assert.equal(v.gap, "unknown_spec");
  assert.equal(v.reason, "reader_version_mismatch");
});

test("gamma is declared, never defaulted", () => {
  const session = createSession();
  ingestFile(session, INSIDE);
  const v = canonSurprise(session, { sourceId: `source:${INSIDE}`, prior: PRIOR });
  assert.equal(v.gap, "undeclared");
  assert.equal(v.what, "gamma");
});

test("outside-canon material measures more surprising than inside-canon material, same prior, same gamma", () => {
  const inside = measure(INSIDE);
  const outside = measure(OUTSIDE);
  assert.equal(isGap(inside), false);
  assert.equal(isGap(outside), false);
  assert.ok(inside.framesMeasured >= 3, `inside frames: ${inside.framesMeasured}`);
  assert.ok(outside.framesMeasured >= 3, `outside frames: ${outside.framesMeasured}`);
  assert.ok(
    outside.mean > inside.mean,
    `expected outside (${outside.mean.toFixed(4)} bits) > inside (${inside.mean.toFixed(4)} bits)`,
  );
  // every surprising frame carries an address back into its document
  for (const f of outside.top) assert.equal(typeof f.offset, "number");
});

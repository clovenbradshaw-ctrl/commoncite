// conformance/surfer-golden.test.js — the surfer golden is a 100% contract.
//
// The surfer (packages/host/surfer.js) is deterministic host code, so unlike
// the emergent span-golden (a ceiling tracker) the frozen golden in
// conformance/golden/surfer-snips-golden.json is an all-or-nothing capability
// contract: any FAIL is a regression. Re-earn the engine underneath all you
// like — this gate is how a changed engine proves it can still snip the
// segment a prompt addresses, omnilingual and omnigenre.
//
// Amend the golden deliberately (never to fit the engine), and only then does
// the scorer header's LIVE baseline move.

import { test } from "node:test";
import assert from "node:assert/strict";

import { scoreSurferGolden } from "../scripts/score-surfer-golden.mjs";

test("the surfer golden is fully green — every prompt snips the segment it addresses", () => {
  const r = scoreSurferGolden({ quiet: true });
  assert.equal(r.fail, 0, `surfer golden regressed: ${JSON.stringify(r.fails, null, 2)}`);
  assert.equal(r.pass, r.total, `expected ${r.total} passing cases, got ${r.pass}`);
});

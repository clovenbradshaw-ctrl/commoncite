// eoreader6 · conformance/reading-self-e2e — the whole chain, on a real book:
// packages/host/reading.js's admitReading (text -> causal-surprisal series ->
// loops/read-level0.js's motif/structure/significance read -> the session's
// testimony ledger via host/self.js). Not synthetic fixtures — the same real
// fixture individuation.test.js and host-graph.test.js already use, admitted
// three times: once to let a claim settle (WORLD), once with more of the
// same book to watch the engine reconfirm its own prior claim (SELF), once
// with the settled claim's own words genuinely rewritten to watch the engine
// catch itself being wrong (SELF_MISMATCH).
//
// The word ranges and admission sizes below are not arbitrary — they are the
// exact ones this file's own author found empirically produce a settled
// claim, a reconfirmation, and a real edit inside that claim's own regime,
// on this exact fixture, with read-level0's own default parameters.
// Deterministic (fixed seeds throughout), so this is a real regression test,
// not a flaky one.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSession } from "../packages/host/corpus.js";
import { admitReading } from "../packages/host/reading.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = join(ROOT, "scripts/adversarial/fixtures");
const frankenstein = readFileSync(join(FIX, "pg84-frankenstein.txt"), "utf8").replace(/\r\n/g, "\n");

test("admitReading commits a real settled claim from real prose as WORLD", () => {
  const session = createSession();
  const r1 = admitReading(session, { sourceId: "frank", text: frankenstein.slice(0, 260000) });
  assert.ok(r1.settledCount >= 1, "a real 260,000-character stretch of prose should settle at least one claim");
  assert.equal(r1.world.length, r1.settledCount);
  assert.equal(r1.self.length, 0);
  assert.equal(r1.selfMismatch.length, 0);
});

test("admitReading reconfirms (SELF) the engine's own prior claim once more of the same book is read", () => {
  const session = createSession();
  const r1 = admitReading(session, { sourceId: "frank", text: frankenstein.slice(0, 260000) });
  assert.ok(r1.world.length >= 1);

  const r2 = admitReading(session, { sourceId: "frank", text: frankenstein.slice(0, 320000) });
  assert.ok(r2.self.length >= 1, "the earlier claim's own regime is untouched by the extra 60,000 characters and should reconfirm");
  assert.equal(r2.selfMismatch.length, 0);

  const reconfirmedStarts = new Set(r2.self.map((x) => x.commit.regime.start));
  for (const c of r1.world) assert.ok(reconfirmedStarts.has(c.regime.start), `commit at regime.start=${c.regime.start} should have been rechecked`);
});

test("admitReading catches the engine being wrong (SELF_MISMATCH) when the committed claim's own words are genuinely rewritten", () => {
  const session = createSession();
  const r1 = admitReading(session, { sourceId: "frank", text: frankenstein.slice(0, 260000) });
  const committedStart = r1.world[0].regime.start; // a chunk index; chunkWords uses 40-word chunks
  const wordStart = committedStart * 40;

  // Rewrite the 300 words starting where the committed regime's own chunks
  // begin into flat, repeated filler — a real edit to the exact prose the
  // claim was about, not noise added anywhere else.
  const tokens = frankenstein.slice(0, 340000).split(/(\s+)/); // alternating word/whitespace
  let wordIdx = 0;
  for (let i = 0; i < tokens.length && wordIdx <= wordStart + 300; i++) {
    if (tokens[i].trim() === "") continue;
    if (wordIdx >= wordStart && wordIdx < wordStart + 300) tokens[i] = "the";
    wordIdx++;
  }
  const rewritten = tokens.join("");

  const r2 = admitReading(session, { sourceId: "frank", text: rewritten });
  const mismatchedStarts = new Set(r2.selfMismatch.map((x) => x.commit.regime.start));
  assert.ok(mismatchedStarts.has(committedStart), `the rewritten regime (start=${committedStart}) should be reported as SELF_MISMATCH, got selfMismatch=${JSON.stringify([...mismatchedStarts])}`);
});

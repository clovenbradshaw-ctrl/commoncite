// eoreader6 · modifier-order/toEvents + modifier-order/lens — conformance
//
// The full pipeline, proven end to end against the real modules: a
// modifier stack -> toEvents() -> ticked into a real event_log -> read back
// through the real lens/index.js::readLens with the real MODIFIER_SCOPE_LENS.
// A second head's stack ticked in later proves the cursor is a genuine
// point-in-time read, not just a filter that happens to work on one call.

import { test } from "node:test";
import assert from "node:assert/strict";
import { toEvents, toTriples } from "../modifier-order/index.js";
import { MODIFIER_SCOPE_LENS } from "../modifier-order/lens.js";
import { createLog, tick } from "../event_log/index.js";
import { readLens } from "../lens/index.js";
import { isGap } from "../nul/index.js";

const GIVER = "Cinque (2010); Scott (2002); Dixon (1982) — illustrative fixture typology";
const EN = Object.freeze({
  ranks: { purpose: 1, material: 2, origin: 3, color: 4, shape: 5, age: 6, quality: 7, size: 8, evaluation: 9, quantity: 10 },
  direction: "pre",
  giver: GIVER,
});

test("toEvents mirrors toTriples exactly, retyped as SEG.narrow events", () => {
  const seq = [{ class: "quality", surface: "fat" }, { class: "color", surface: "black" }];
  const t = toTriples(seq, EN, { head: "cat_1" });
  const events = toEvents(seq, EN, { head: "cat_1" });
  assert.equal(events.length, t.triples.length);
  events.forEach((e, i) => {
    assert.equal(e.type, "SEG.narrow");
    assert.equal(e.subject, t.triples[i].subject);
    assert.equal(e.object, t.triples[i].object);
    assert.equal(e.class, t.triples[i].verb);
    assert.equal(e.polarity, t.triples[i].polarity);
  });
});

test("toEvents refuses exactly where toTriples refuses", () => {
  const inverted = [{ class: "color" }, { class: "quality" }]; // black, fat — inverted
  const r = toEvents(inverted, EN, { head: "cat_1" });
  assert.ok(isGap(r));
  assert.equal(r.gap, "unstable");

  const noHead = toEvents([{ class: "quality" }], EN, {});
  assert.ok(isGap(noHead));
  assert.equal(noHead.gap, "undeclared");
});

test("end to end: a modifier stack ticked into a real log reads back through the real modifier-scope lens", () => {
  const log = createLog();
  const events = toEvents(
    [{ class: "quality", surface: "fat" }, { class: "color", surface: "black" }],
    EN,
    { head: "cat_1" },
  );
  for (const e of events) tick(log, e);

  const r = readLens(log, MODIFIER_SCOPE_LENS, log.tick);
  assert.ok(!isGap(r));
  assert.equal(r.lens, "modifier-scope");
  assert.deepEqual(r.view, [
    { subject: "cat_1::black", object: "cat_1", class: "color", polarity: "+" },
    { subject: "cat_1::black::fat", object: "cat_1::black", class: "quality", polarity: "+" },
  ]);
});

test("the cursor makes this a real point-in-time read: a second head's stack ticked later is invisible at the earlier cursor", () => {
  const log = createLog();
  const catEvents = toEvents(
    [{ class: "quality", surface: "fat" }, { class: "color", surface: "black" }],
    EN,
    { head: "cat_1" },
  );
  for (const e of catEvents) tick(log, e);
  const cursorAfterCat = log.tick;

  const dogEvents = toEvents([{ class: "size", surface: "big" }], EN, { head: "dog_1" });
  // A single-modifier "stack" is degenerate (order() needs >=1 tag and still
  // nests trivially) — included to prove the lens handles a one-layer chain
  // too, not just the two-layer fixture used elsewhere in this file.
  for (const e of dogEvents) tick(log, e);

  const early = readLens(log, MODIFIER_SCOPE_LENS, cursorAfterCat);
  assert.equal(early.view.length, 2, "only the cat's two edges exist at this cursor");
  assert.ok(!early.view.some((e) => e.subject.startsWith("dog_1")));

  const full = readLens(log, MODIFIER_SCOPE_LENS, log.tick);
  assert.equal(full.view.length, 3, "cat's two edges plus dog's one");
});

test("a lens reading a different event type reports SEG.narrow as discarded, and vice versa", () => {
  const log = createLog();
  const events = toEvents([{ class: "quality", surface: "fat" }], EN, { head: "cat_1" });
  for (const e of events) tick(log, e);
  tick(log, { type: "NOISE.unrelated" });

  const scopeRead = readLens(log, MODIFIER_SCOPE_LENS, log.tick);
  assert.deepEqual(scopeRead.discardedTypes, ["NOISE.unrelated"]);

  const NOISE_LENS = Object.freeze({ name: "noise", reads: ["NOISE.unrelated"], project: (e) => e.length });
  const noiseRead = readLens(log, NOISE_LENS, log.tick);
  assert.deepEqual(noiseRead.discardedTypes, ["SEG.narrow"]);
});

test("provenance on a modifier-scope read traces back to the real ticked events", () => {
  const log = createLog();
  const events = toEvents(
    [{ class: "quality", surface: "fat" }, { class: "color", surface: "black" }],
    EN,
    { head: "cat_1" },
  );
  for (const e of events) tick(log, e);

  const r = readLens(log, MODIFIER_SCOPE_LENS, log.tick);
  assert.equal(r.provenance.length, 2);
  assert.deepEqual(r.provenance.map((p) => p.tick), [0, 1]);
  for (const p of r.provenance) assert.equal(p.event_type, "SEG.narrow");
});

// eoreader6 · reading — conformance
//
// The end-to-end shape a "read" of a document actually is: two real
// terrains (Entity via referent-identity, Link via modifier-scope), read
// off the same log at the same cursor, each still carrying its own
// provenance and discardedTypes (II.17) — never flattened into one
// undifferentiated blob a consumer can't trace back to source.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createLog, tick } from "../event_log/index.js";
import { readDocument, TERRAINS } from "../reading/index.js";
import { projectReferents } from "../packages/engine/referents/index.js";
import { toEvents } from "../modifier-order/index.js";
import { MODIFIER_SCOPE_LENS } from "../modifier-order/lens.js";
import { isGap } from "../nul/index.js";

const REFERENT_LENS = Object.freeze({
  name: "referent-identity",
  reads: Object.freeze(["DEF.admit", "CON.identity", "SYN.merge", "SEG.split"]),
  project: projectReferents,
});

const GIVER = "Cinque (2010); Scott (2002); Dixon (1982) — illustrative fixture typology";
const EN = Object.freeze({
  ranks: { quality: 7, color: 4 },
  direction: "pre",
  giver: GIVER,
});

const buildLog = () => {
  const log = createLog();
  tick(log, { type: "DEF.admit", referent_id: "r1", surface: "cat", provenance: "p0" });
  for (const e of toEvents(
    [{ class: "quality", surface: "fat" }, { class: "color", surface: "black" }],
    EN,
    { head: "cat_1" },
  )) {
    tick(log, e);
  }
  return log;
};

test("TERRAINS names all nine, including Atmosphere and Paradigm — no lens exists for them yet, but the shape has room", () => {
  assert.deepEqual(TERRAINS, [
    "Void", "Entity", "Kind",
    "Field", "Link", "Network",
    "Atmosphere", "Lens", "Paradigm",
  ]);
});

test("readDocument refuses without any lenses, or with a lens missing a named terrain", () => {
  const log = buildLog();
  assert.ok(isGap(readDocument(log, [], log.tick)));
  assert.ok(isGap(readDocument(log, [{ lensDef: REFERENT_LENS }], log.tick))); // no terrain
  assert.ok(isGap(readDocument(log, [{ lensDef: REFERENT_LENS, terrain: "Nowhere" }], log.tick))); // unknown terrain
});

test("readDocument composes two real lenses on two real terrains, at one shared cursor", () => {
  const log = buildLog();
  const reading = readDocument(
    log,
    [
      { lensDef: REFERENT_LENS, terrain: "Entity" },
      { lensDef: MODIFIER_SCOPE_LENS, terrain: "Link" },
    ],
    log.tick,
  );
  assert.ok(!isGap(reading));
  assert.equal(reading.cursor, log.tick);
  assert.deepEqual(reading.terrains.Entity, ["referent-identity"]);
  assert.deepEqual(reading.terrains.Link, ["modifier-scope"]);
  assert.equal(Object.keys(reading.terrains).length, 2, "Atmosphere/Paradigm/etc. are absent, not silently empty-populated");

  const entityLens = reading.lenses.find((l) => l.terrain === "Entity");
  const linkLens = reading.lenses.find((l) => l.terrain === "Link");
  assert.equal(entityLens.view.length, 1); // one referent, r1
  assert.equal(linkLens.view.length, 2); // two SEG.narrow edges
});

test("both lenses in a reading see the same cursor — an earlier reading omits the later-ticked modifier stack", () => {
  const log = createLog();
  tick(log, { type: "DEF.admit", referent_id: "r1", surface: "cat" });
  const cursorAfterAdmit = log.tick;
  for (const e of toEvents(
    [{ class: "quality", surface: "fat" }, { class: "color", surface: "black" }],
    EN,
    { head: "cat_1" },
  )) {
    tick(log, e);
  }

  const early = readDocument(
    log,
    [
      { lensDef: REFERENT_LENS, terrain: "Entity" },
      { lensDef: MODIFIER_SCOPE_LENS, terrain: "Link" },
    ],
    cursorAfterAdmit,
  );
  assert.ok(!isGap(early));
  const linkLens = early.lenses.find((l) => l.terrain === "Link");
  assert.equal(linkLens.view.length, 0, "the modifier stack ticked after the cursor is not part of this reading");
});

test("each lens in a reading still carries its own provenance and discardedTypes — the reading never flattens them away", () => {
  const log = buildLog();
  const reading = readDocument(
    log,
    [
      { lensDef: REFERENT_LENS, terrain: "Entity" },
      { lensDef: MODIFIER_SCOPE_LENS, terrain: "Link" },
    ],
    log.tick,
  );
  for (const l of reading.lenses) {
    assert.ok(Array.isArray(l.provenance));
    assert.ok(Array.isArray(l.discardedTypes));
  }
  const entityLens = reading.lenses.find((l) => l.terrain === "Entity");
  const linkLens = reading.lenses.find((l) => l.terrain === "Link");
  assert.deepEqual(entityLens.discardedTypes, ["SEG.narrow"]);
  assert.deepEqual(linkLens.discardedTypes, ["DEF.admit"]);
});

test("a gap from any one lens gaps the whole reading, rather than a partial silent result", () => {
  const log = buildLog();
  const badLens = Object.freeze({ name: "broken", reads: ["DEF.admit"], project: () => { throw new Error("nope"); } });
  assert.throws(() =>
    readDocument(log, [{ lensDef: badLens, terrain: "Entity" }], log.tick),
  );
  // A well-formed refusal (not a throw) propagates cleanly as a gap:
  const missingCursorReading = readDocument(log, [{ lensDef: REFERENT_LENS, terrain: "Entity" }]);
  assert.ok(isGap(missingCursorReading));
});

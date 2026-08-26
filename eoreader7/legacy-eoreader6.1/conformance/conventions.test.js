// eoreader6 · conformance/conventions — a received order convention, and the
// four things it must never do.
//
// The tests that matter here are not the lookups. They are:
//   1. never default an unknown system to anything
//   2. never confuse "the giver found no dominant order" with "nobody told us"
//   3. never let an IMPLIED value pass as an ATTESTED one
//   4. never treat a surveyed departure and a stipulated departure alike

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  loadConventions,
  orderFor,
  expectedNext,
  impliedFor,
  compareWithMeasured,
  CELL,
} from "../packages/engine/generation/conventions.js";
import { isGap } from "../nul/index.js";

// The host does the I/O; the engine is handed an object (III.2).
const here = dirname(fileURLToPath(import.meta.url));
const PRIOR_PATH = join(here, "..", "bin", "priors", "typology", "order-conventions.json");
const raw = JSON.parse(readFileSync(PRIOR_PATH, "utf8"));
const conventions = loadConventions(raw);

test("the organ declares the cell it occupies", () => {
  assert.equal(CELL.op, "CON");
  assert.equal(CELL.terrain, "Network");
  assert.equal(CELL.stance, "Tracing");
});

// ── 1. An unknown system is a wall, never a default ────────────────────────

test("an unknown system is a typed gap and NEVER a default order", () => {
  for (const unknown of ["nl:xyz", "music:gamelan-colotomic", "", "undefined", "code:cobol"]) {
    const o = orderFor(conventions, unknown);
    assert.ok(isGap(o), `${unknown} must not resolve`);
    assert.equal(o.gap, "unreceived_origin", "nothing failed to be measured — nobody gave us this");
    assert.equal(o.order, undefined, "a refusal carries no order at all");
  }
});

test("the refusal is unreceived_origin, not a measurement failure", () => {
  // The distinction II.2 draws between a wall and a gap-in-waiting, carried
  // into the return value. `degenerate_ground` would say we tried and the
  // ground was thin; the truth is that no giver spoke.
  const o = orderFor(conventions, "nl:zzz");
  assert.equal(o.gap, "unreceived_origin");
  assert.notEqual(o.gap, "degenerate_ground");
});

test("the English-shaped bug: an unknown system does not inherit the developer's own language", () => {
  const o = orderFor(conventions, "nl:unknown-language");
  assert.ok(isGap(o));
  const known = orderFor(conventions, "nl:eng");
  assert.deepEqual([...known.order], ["S", "V", "O"]);
  // The point of the test: the known answer exists and is NOT reachable from
  // the unknown one by any fallback path.
  assert.ok(!("order" in o) || o.order === undefined);
});

// ── 2. "No dominant order" is attested, not absent ─────────────────────────

test("a giver finding NO dominant order is a measurement, categorically not a gap", () => {
  const de = orderFor(conventions, "nl:deu");
  assert.ok(!isGap(de), "German is well attested — it simply has no dominant order");
  assert.equal(de.attested, true);
  assert.equal(de.rigidity, "none");
  assert.equal(de.order, null);
  // And the two states are distinguishable by any consumer.
  const unknown = orderFor(conventions, "nl:deu-x-nonexistent");
  assert.ok(isGap(unknown));
  assert.notEqual(de.attested, unknown.attested);
});

test("a system with no dominant order expects its whole inventory, not a guess", () => {
  const e = expectedNext(conventions, "nl:deu", []);
  assert.equal(e.constrained, false);
  assert.deepEqual([...e.expected].sort(), ["O", "S", "V"]);
});

test("a prior may not hide an order behind rigidity none", () => {
  const bad = structuredClone(raw);
  bad.systems["nl:deu"].order = ["S", "V", "O"];
  assert.throws(() => loadConventions(bad), /rigidity none/);
});

// ── 3. Implied is never attested ───────────────────────────────────────────

test("an implication produces `implied`, never `attested`, and names its giver", () => {
  const w = impliedFor(conventions, "nl:cym"); // VSO -> prepositional, Greenberg U3
  assert.ok(w.implied.length > 0, "a VSO language should fire the adposition implication");
  for (const i of w.implied) {
    assert.equal(i.status, "implied");
    assert.ok(typeof i.giver === "string" && i.giver.length > 0, "an implication is a gift too");
  }
});

test("where the giver also attested a value, both are kept and agreement is reported", () => {
  const w = impliedFor(conventions, "nl:cym");
  const adp = w.implied.find((i) => i.feature === "adposition_order");
  assert.equal(adp.value, "prepositional");
  assert.equal(adp.attested, "prepositional");
  assert.equal(adp.agrees, true, "corroboration is reported as corroboration, not merged away");
});

test("an implication scoped to one modality does not fire on another", () => {
  // Greenberg's universals are about natural language. A cadence must not
  // acquire adpositions.
  const cadence = impliedFor(conventions, "music:cadence-authentic");
  assert.equal(cadence.implied.length, 0);
  const png = impliedFor(conventions, "binary:png-chunks");
  assert.equal(png.implied.length, 0);
});

// ── 4. Surveyed and stipulated departures mean opposite things ─────────────

test("a departure from a SURVEYED convention is marked, and the prior is not thereby wrong", () => {
  const c = compareWithMeasured({
    conventions,
    systemId: "nl:eng",
    measured: { rigid: false, rank: 0.4, draws: 96 },
  });
  assert.equal(c.verdict, "marked");
  assert.match(c.note, /finding about the material/);
});

test("a departure from a STIPULATED convention is malformed, never a stylistic finding", () => {
  const c = compareWithMeasured({
    conventions,
    systemId: "binary:png-chunks",
    measured: { rigid: false, rank: 0.4, draws: 96 },
  });
  assert.equal(c.verdict, "malformed");
  assert.match(c.note, /invalid, or the system was misidentified/);
});

test("both grounds survive the comparison — nothing is resolved or averaged", () => {
  const c = compareWithMeasured({
    conventions,
    systemId: "nl:eng",
    measured: { rigid: false, rank: 0.4, draws: 96 },
  });
  assert.equal(c.resolved, false, "SEED #6: the disagreement IS the finding, not an input to a merge");
  assert.deepEqual([...c.prior.order], ["S", "V", "O"], "the prior is retained verbatim");
  assert.equal(c.measured.rank, 0.4, "and so is the measurement");
});

test("a comparison refuses a measurement that carries no null", () => {
  const c = compareWithMeasured({ conventions, systemId: "nl:eng", measured: { note: "looks SVO to me" } });
  assert.equal(c.gap, "unknown_spec");
});

test("a system whose giver found no order has nothing to depart from", () => {
  const c = compareWithMeasured({ conventions, systemId: "nl:deu", measured: { rigid: false, rank: 0.4, draws: 96 } });
  assert.equal(c.verdict, "unconstrained");
});

// ── The prior is not natural-language-shaped ───────────────────────────────

test("the schema reaches modalities with no names, no lexicon and no stable surfaces", () => {
  // II.1, applied to the prior rather than argued about. If this test can be
  // written, the prior is not text-shaped.
  for (const id of ["music:sonata-form", "music:blues-12bar", "binary:png-chunks", "tabular:tidy-observation"]) {
    const o = orderFor(conventions, id);
    assert.ok(!isGap(o), `${id} must be addressable`);
    assert.ok(o.roles.length > 0);
  }
  const modalities = new Set(Object.values(conventions.systems).map((s) => s.modality));
  assert.ok(modalities.size >= 4, `expected several modalities, got ${[...modalities]}`);
});

test("roles may recur in an order — nothing assumes order.length === roles.length", () => {
  const blues = orderFor(conventions, "music:blues-12bar");
  assert.equal(blues.roles.length, 3);
  assert.equal(blues.order.length, 12, "a role inventory is not a sequence length");
  assert.ok(blues.order.length > blues.roles.length);
});

test("a cyclic convention wraps rather than refusing, and says that it did", () => {
  const inside = expectedNext(conventions, "music:blues-12bar", new Array(4).fill("x"));
  assert.equal(inside.wrapped, false);
  assert.deepEqual([...inside.expected], ["IV"]);
  const past = expectedNext(conventions, "music:blues-12bar", new Array(13).fill("x"));
  assert.equal(past.wrapped, true, "wrapping is reported, not silent");
});

test("what would satisfy this position — the lookup half, modality-blind", () => {
  assert.deepEqual([...expectedNext(conventions, "nl:eng", []).expected], ["S"]);
  assert.deepEqual([...expectedNext(conventions, "nl:eng", ["S"]).expected], ["V"]);
  assert.deepEqual([...expectedNext(conventions, "nl:eus", ["S"]).expected], ["O"]);
  assert.deepEqual([...expectedNext(conventions, "nl:cym", []).expected], ["V"]);
  assert.deepEqual([...expectedNext(conventions, "music:cadence-authentic", ["dominant"]).expected], ["tonic"]);
});

test("an expectation carries what a departure from it would mean", () => {
  assert.equal(expectedNext(conventions, "nl:eng", []).departure_means, "marked");
  assert.equal(expectedNext(conventions, "code:json", []).departure_means, "malformed");
});

// ── Loading refuses a gift with no giver ───────────────────────────────────

test("a system that names no giver cannot be loaded at all", () => {
  const bad = structuredClone(raw);
  delete bad.systems["nl:eng"].giver;
  assert.throws(() => loadConventions(bad), /names no giver/);
});

test("basis and rigidity are declared, never defaulted", () => {
  for (const field of ["basis", "rigidity"]) {
    const bad = structuredClone(raw);
    delete bad.systems["nl:eng"][field];
    assert.throws(() => loadConventions(bad), new RegExp(field));
  }
});

test("an order may not reference a role outside the inventory", () => {
  const bad = structuredClone(raw);
  bad.systems["nl:eng"].order = ["S", "V", "INDIRECT-OBJECT"];
  assert.throws(() => loadConventions(bad), /not in its inventory/);
});

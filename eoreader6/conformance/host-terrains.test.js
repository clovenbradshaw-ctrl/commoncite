// eoreader6 · conformance/host-terrains — packages/host/terrains.js serves
// one admitted source on the nine-terrain grid, each surface from the organ
// that owns it. Same real fixture host-graph.test.js already justified
// (pg84-frankenstein.txt): relation extraction is heuristic and synthetic
// snippets do not recur enough to clear discoverRelationVocab's own gate,
// so a real novel is the honest input.
//
// What is tested here is the ASSEMBLY, not the organs — every organ below
// has its own conformance file. The claims are: the grid is the engine's
// own canon; each surface is present or its absence is typed; truncation is
// counted where it happens; a second call does not silently advance belief.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSession, admitChunked } from "../packages/host/corpus.js";
import { sessionTerrains, sessionKinds, kindsNullArm, foldExtract, TERRAIN_GRID } from "../packages/host/terrains.js";
import { DOMAINS, GRAINS, TERRAIN_BY_DOMAIN } from "../packages/engine/operators.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = join(ROOT, "scripts/adversarial/fixtures");
// The head of the novel is enough for assembly claims and keeps this file
// seconds-cheap; host-graph.test.js already exercises the full text.
const frankenstein = readFileSync(join(FIX, "pg84-frankenstein.txt"), "utf8").replace(/\r\n/g, "\n").slice(0, 120_000);
// The assembly claims below don't need the full head — form-binding's pair
// nulls price each sessionTerrains call at roughly seconds per 30KB, and
// this suite stays under a default runner timeout by using the smaller
// slice wherever the claim allows it.
const frankHead = frankenstein.slice(0, 60_000);

const sessionOf = (text) => {
  const session = createSession();
  admitChunked(session, { text, sourceId: "s" });
  return session;
};

test("TERRAIN_GRID is the engine's own canon, domain-major, all nine cells, each carrying its blindness and dependencies", () => {
  assert.equal(TERRAIN_GRID.length, 9);
  let i = 0;
  for (const domain of DOMAINS) {
    for (const grain of GRAINS) {
      const cell = TERRAIN_GRID[i];
      assert.equal(cell.terrain, TERRAIN_BY_DOMAIN[domain][grain]);
      assert.equal(cell.domain, domain);
      assert.equal(cell.grain, grain);
      assert.ok(typeof cell.blindTo === "string" && cell.blindTo.length, "every terrain names what it cannot see (12-terrains §2)");
      assert.ok(Array.isArray(cell.dependsOn));
      i++;
    }
  }
  // §3 Type B: the four forward-sloping edges, exactly.
  const deps = Object.fromEntries(TERRAIN_GRID.map((c) => [c.terrain, [...c.dependsOn]]));
  assert.deepEqual(deps.Link, ["Entity"]);
  assert.deepEqual(deps.Kind, ["Link"]);
  assert.deepEqual(deps.Network, ["Entity", "Link"]);
  assert.deepEqual(deps.Paradigm, ["Kind", "Field"]);
});

test("an unknown source is a typed gap, never a throw", () => {
  const session = createSession();
  const out = sessionTerrains(session, { sourceId: "nope" });
  assert.equal(out.gap.reason, "unknown_source");
  const kinds = sessionKinds(session, { sourceId: "nope", opts: { minPrevalence: 0.03, minKindSize: 5, permutations: 4, quantile: 0.95, seed: 1, reseeds: 2 } });
  assert.equal(kinds.gap.reason, "unknown_source");
});

test("sessionTerrains serves every wired surface and types every absence", () => {
  const session = sessionOf(frankHead);
  const { terrains } = sessionTerrains(session, { sourceId: "s" });

  // Field — the admitted chunks, byte-addressed, in order.
  assert.ok(terrains.Field.units.length > 0);
  assert.equal(terrains.Field.units.length, terrains.Field.unitsTotal);
  for (let i = 1; i < terrains.Field.units.length; i++) {
    assert.ok(terrains.Field.units[i].byteStart >= terrains.Field.units[i - 1].byteStart, "units are in source order");
  }

  // Entity — the discovered cast.
  assert.ok(terrains.Entity.referents.length > 0, "the fixture's prose yields a cast");

  // Link — triples, with the total stated next to what was returned.
  assert.ok(terrains.Link.total >= terrains.Link.relations.length);

  // Network — the belief graph snapshot is plain data.
  assert.doesNotThrow(() => JSON.stringify(terrains.Network));

  // Atmosphere — one frame per word-chunk, byte-anchored via locate().
  assert.ok(terrains.Atmosphere.frames.length > 0);
  const f = terrains.Atmosphere.frames[0];
  assert.ok(Number.isFinite(f.microbits) && Number.isFinite(f.byteStart) && f.byteEnd > f.byteStart);

  // Lens — not served, by construction, and the omission is typed.
  assert.equal(terrains.Lens.gap.silence, "not-present");

  // Kind — not computed here; the deferral is typed.
  assert.equal(terrains.Kind.silence, "not-computed");

  // Void — the ledger carries the Lens and Kind entries at minimum.
  const terrainsInLedger = terrains.Void.ledger.map((g) => g.terrain);
  assert.ok(terrainsInLedger.includes("Lens") && terrainsInLedger.includes("Kind"));

  // Paradigm — the grid, the declared numbers with givers, the engine version.
  assert.equal(terrains.Paradigm.grid.length, 9);
  assert.ok(terrains.Paradigm.declared.every((d) => d.name && d.giver !== undefined));
  assert.ok(terrains.Paradigm.engine.corpusApiVersion);
});

test("sessionTerrains emits every surface as it is computed — Field first, Void last (the ledger accumulates)", () => {
  const session = sessionOf(frankenstein.slice(0, 30000));
  const order = [];
  const result = sessionTerrains(session, { sourceId: "s", emit: (terrain) => order.push(terrain) });
  assert.equal(order[0], "Field", "the zero-inference surface streams before anything expensive");
  assert.equal(order[order.length - 1], "Void", "the gap ledger is only complete once every organ has spoken");
  assert.equal(new Set(order).size, 9, "all nine surfaces are emitted exactly once");
  assert.ok(result.terrains.Field, "the full return is unchanged by streaming");
});

test("a second sessionTerrains call does not silently advance the belief graph", () => {
  const session = sessionOf(frankHead);
  const first = sessionTerrains(session, { sourceId: "s" });
  const second = sessionTerrains(session, { sourceId: "s" });
  assert.equal(second.terrains.Network.edgeTotal, first.terrains.Network.edgeTotal, "belief must not double on a re-render");
  assert.equal(second.terrains.Network.stages.length, first.terrains.Network.stages.length, "the staged snapshots are served from the same admission, not re-read");
});

test("the network is admitted in ordered stages — a scrubbably real reading cursor", () => {
  const session = sessionOf(frankHead);
  const { terrains } = sessionTerrains(session, { sourceId: "s" });
  const stages = terrains.Network.stages;
  assert.ok(stages.length >= 1);
  for (let i = 1; i < stages.length; i++) {
    assert.ok(stages[i].tick > stages[i - 1].tick, "the graph's own tick advances per stage");
  }
  // The stated-relations stages read strictly further; binding, when it
  // cleared its nulls, arrives as its own labelled final stage with its own
  // count — a different organ's testimony, not a continuation of the first.
  const stated = stages.filter((s) => s.label === "stated relations");
  assert.ok(stated.length >= 1);
  for (let i = 1; i < stated.length; i++) assert.ok(stated[i].upTo > stated[i - 1].upTo, "each stage reads strictly further into the relations");
  assert.equal(stated[stated.length - 1].upTo, stated[stated.length - 1].of, "the final stated stage has read every relation");
  const last = stages[stages.length - 1];
  assert.equal(last.nodeCount, terrains.Network.nodeCount, "the final stage IS the served graph, not a parallel one");
  // Binding always reports — entities, pairs tested, witnessed — even when zero.
  const binding = terrains.Network.binding;
  assert.ok(binding && Number.isInteger(binding.entities) && Number.isInteger(binding.witnessed));
});

test("sessionKinds refuses undeclared statistical options by name", () => {
  const session = sessionOf(frankenstein);
  const out = sessionKinds(session, { sourceId: "s", opts: { minPrevalence: 0.03, minKindSize: 5, permutations: 4, quantile: 0.95 } });
  assert.equal(out.gap.reason, "undeclared");
  assert.match(out.gap.detail, /opts\.seed/);
});

test("sessionKinds builds chunk records, runs the real induction, and carries the per-population null arm with its declared draw count", () => {
  const session = sessionOf(frankenstein);
  // permutations kept small — this is an assembly test, not a calibration.
  const opts = { minPrevalence: 0.05, minKindSize: 5, permutations: 4, quantile: 0.95, seed: 1, reseeds: 2, nullArmDraws: 1 };
  const out = sessionKinds(session, { sourceId: "s", opts });
  assert.ok(!out.gap, `no gap expected, got ${JSON.stringify(out.gap)}`);
  assert.ok(out.recordCount > 0);
  assert.ok(out.formFloor.admittedForms <= out.formFloor.candidateForms);
  assert.ok(Array.isArray(out.kinds));
  for (const k of out.kinds) {
    assert.ok(k.size >= 5, "no kind below the declared minKindSize");
    assert.ok(k.members.every((m) => /^u\d+$/.test(m)), "members are chunk-record ids that cross-reference Field units");
  }
  // The arm ran the declared number of redeals and the count is on the
  // result — the finest rank sayable is 1/draws and the renderer may not
  // phrase the claim finer than that.
  assert.equal(out.nullArm.ran, true);
  assert.equal(out.nullArm.draws, 1);
  assert.equal(out.nullArm.finestRank, "1/1");
  assert.equal(out.nullArm.perDraw.length, 1);
  assert.ok(Number.isInteger(out.nullArm.drawsWithKinds));
});

test("foldExtract is a coverage fold — verbatim, addressed, in order, budget-bounded, structure excluded, typed gaps", () => {
  const text = frankenstein.slice(0, 30_000);
  const out = foldExtract({ text, budgetSentences: 5 });
  assert.ok(!out.gap, "whole-text fold succeeds on real prose");
  assert.ok(out.lines.length <= 5 && out.lines.length > 0);
  assert.ok(out.of > out.lines.length, "the fold reports what it folded from");
  assert.ok(out.forms.covered > 0 && out.forms.covered <= out.forms.of, "coverage is counted against the scope's recurring forms");
  for (let i = 0; i < out.lines.length; i++) {
    const l = out.lines[i];
    assert.equal(text.slice(l.charStart, l.charEnd), l.text, "every line is the source's own bytes at its address — resolution, never invention");
    assert.ok(l.covers.length > 0 && l.covers.every((w) => out.forms.list.includes(w)), "each line says which recurring forms it carries");
    if (i) assert.ok(l.charStart > out.lines[i - 1].charStart, "lines stay in document order");
  }

  // range scope stays inside the range
  const ranged = foldExtract({ text, charStart: 5000, charEnd: 12000, budgetSentences: 3 });
  assert.ok(!ranged.gap);
  for (const l of ranged.lines) assert.ok(l.charEnd > 5000 && l.charStart < 12000);

  // word scope: every line carries the word, word-bounded
  const worded = foldExtract({ text, word: "letter", budgetSentences: 3 });
  if (!worded.gap) {
    for (const l of worded.lines) assert.match(l.text.toLowerCase(), /(?<![\p{L}\p{N}])letter(?![\p{L}\p{N}])/u);
  }

  // markdown structure lines are addresses, not claims — never fold lines
  // (real prose behind the heading: the Zipf function-word classifier is
  // honestly starved on toy-sized texts and gaps instead of guessing)
  const md = foldExtract({ text: `# A Planted Heading\n\n${frankenstein.slice(2000, 10000)}`, budgetSentences: 3 });
  assert.ok(!md.gap);
  for (const l of md.lines) assert.ok(!/^\s*#/.test(l.text), "headings are excluded from candidacy");

  // undeclared budget and empty scopes are typed, never silent
  assert.equal(foldExtract({ text }).gap.reason, "undeclared");
  assert.equal(foldExtract({ text, word: "zzzqqqxyzzy", budgetSentences: 3 }).gap.silence, "computed-and-empty");
  assert.ok(foldExtract({ text: "", budgetSentences: 3 }).gap);
});

// The dispositions are contract, not calibration — small synthetic records
// keep this whole file under a default runner timeout (the arm on the real
// fixture above is the one expensive run this suite affords).
const syntheticRecords = (n = 40) =>
  Array.from({ length: n }, (_, i) => ({
    id: `u${i}`,
    attributes: [
      { field_id: `tok:${i % 2 ? "alpha" : "beta"}`, value_type: "present" },
      { field_id: `tok:${i % 2 ? "gamma" : "delta"}`, value_type: "present" },
      { field_id: `tok:common${i % 5}`, value_type: "present" },
    ],
  }));

test("null-arm dispositions: undeclared draws are a typed gap; declining and deferring are legal and reported", () => {
  const session = createSession();
  const records = syntheticRecords();
  const opts = { minPrevalence: 0.03, minKindSize: 5, permutations: 4, quantile: 0.95, seed: 1, reseeds: 2, nullArmDraws: 2 };

  // An arm with no declared draw count is a typed gap, never a silent default.
  const undeclared = sessionKinds(session, { sourceId: "syn", records, opts: { ...opts, nullArmDraws: undefined } });
  assert.equal(undeclared.gap.reason, "undeclared");
  assert.match(undeclared.gap.detail, /nullArmDraws/);

  // Declining the arm is legal and reported — the renderer marks every kind provisional.
  const declined = sessionKinds(session, { sourceId: "syn", records, opts: { ...opts, nullArm: false } });
  assert.equal(declined.nullArm.ran, false);
  assert.match(declined.nullArm.reason, /provisional/);

  // Deferring is legal too: the records come back so the SAME population can
  // be armed asynchronously by kindsNullArm, and until then it is pending.
  const deferred = sessionKinds(session, { sourceId: "syn", records, opts: { ...opts, nullArm: "defer" } });
  assert.equal(deferred.nullArm.disposition, "pending");
  assert.ok(Array.isArray(deferred.records) && deferred.records.length === deferred.recordCount);
  const arm = kindsNullArm({ records: deferred.records, opts, population: "syn-deferred" });
  assert.equal(arm.ran, true);
  assert.equal(arm.draws, 2);
  assert.equal(arm.finestRank, "1/2");
});

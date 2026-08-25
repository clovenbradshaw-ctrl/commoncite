import { test } from "node:test";
import assert from "node:assert/strict";

import { MODES, DOMAINS, GRAINS, OPERATORS, ORGANS, cellOf, organsByOp } from "../packages/engine/operators.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname); // the eoreader6 repo root — roster module paths are root-relative

// ── the algebra ──────────────────────────────────────────────────────────────

test("nine operators, nine distinct (mode, domain) cells — the cube is complete", () => {
  assert.equal(Object.keys(OPERATORS).length, 9, "exactly nine operators");
  const cells = new Set(Object.values(OPERATORS).map((o) => `${o.mode}×${o.domain}`));
  assert.equal(cells.size, 9, "each operator lands in a distinct (mode, domain) cell");
  for (const mode of MODES)
    for (const domain of DOMAINS) assert.ok(cells.has(`${mode}×${domain}`), `${mode}×${domain} covered`);
});

test("terrain and stance derive from the algebra, never a hand-list", () => {
  // The eoreader5 diagonal refused five of its own nine cells; this one must
  // derive every terrain and stance from (mode, domain, grain) alone.
  for (const op of Object.keys(OPERATORS))
    for (const grain of GRAINS) {
      const cell = cellOf(op, grain);
      assert.notEqual(cell.gap, "unknown_spec", `${op} at ${grain} derives`);
      assert.equal(typeof cell.terrain, "string", `${op} at ${grain} has terrain`);
      assert.equal(typeof cell.stance, "string", `${op} at ${grain} has stance`);
    }
  // Spot-check the cells the engine's own headers claim:
  assert.deepEqual({ ...cellOf("SEG", "Ground") }, { op: "SEG", grain: "Ground", mode: "Differentiate", domain: "Structure", terrain: "Field", stance: "Clearing" });
  assert.deepEqual({ ...cellOf("EVA", "Figure") }, { op: "EVA", grain: "Figure", mode: "Relate", domain: "Interpretation", terrain: "Lens", stance: "Binding" });
  assert.deepEqual({ ...cellOf("SYN", "Pattern") }, { op: "SYN", grain: "Pattern", mode: "Generate", domain: "Structure", terrain: "Network", stance: "Composing" });
  assert.deepEqual({ ...cellOf("DEF", "Ground") }, { op: "DEF", grain: "Ground", mode: "Differentiate", domain: "Interpretation", terrain: "Atmosphere", stance: "Clearing" });
});

test("every operator carries its verb and is claimed by at least one organ", () => {
  for (const op of Object.keys(OPERATORS)) {
    assert.equal(typeof OPERATORS[op].verb, "string", `${op} has a verb`);
    assert.ok(organsByOp(op).length >= 1, `${op} is claimed by an organ`);
  }
});

// ── the roster ↔ organ declarations ──────────────────────────────────────────

const importOrgan = async (module) => {
  const { pathToFileURL } = await import("node:url");
  return import(pathToFileURL(join(ROOT, module)).href);
};

test("each roster entry is a live export of its module", async () => {
  const seen = new Set();
  for (const organ of ORGANS) {
    assert.ok(!seen.has(organ.id), `organ id ${organ.id} is unique`);
    seen.add(organ.id);
    const mod = await importOrgan(organ.module);
    assert.equal(typeof mod[organ.fn], "function", `${organ.id}: ${organ.module} exports ${organ.fn}()`);
  }
});

test("each organ's declared CELL covers every roster entry for its module", async () => {
  for (const organ of ORGANS) {
    const mod = await importOrgan(organ.module);
    const declared = mod.CELL ? [mod.CELL] : mod.CELLS ?? [];
    assert.ok(declared.length > 0, `${organ.id}: ${organ.module} exports CELL or CELLS`);
    const covers = declared.some((c) => c.op === organ.op && c.grain === organ.grain);
    assert.ok(covers, `${organ.id} claims ${organ.op}·${organ.grain} but ${organ.module} declares ` +
      `${declared.map((c) => `${c.op}·${c.grain}`).join(", ")}`);
  }
});

test("no organ declares a cell the algebra refutes", async () => {
  for (const organ of ORGANS) {
    const mod = await importOrgan(organ.module);
    const declared = mod.CELL ? [mod.CELL] : mod.CELLS ?? [];
    for (const c of declared) {
      const cell = cellOf(c.op, c.grain);
      assert.notEqual(cell.gap, "unknown_spec", `${organ.id} declares a spec the algebra does not have`);
      assert.deepEqual(
        { op: c.op, grain: c.grain },
        { op: cell.op, grain: cell.grain },
        `${organ.id} declared cell matches the derived cell`,
      );
    }
  }
});

// ── not a classifier — a refusal this file exists to enforce ────────────────

test("the registry performs no imports — it is pure declaration, never content-derived logic", () => {
  // The registry is declaration only. This guards the measured refutation:
  // cube-as-classifier survived 95.7% of assignments under word-shuffle and
  // was retired. The file may only dispatch on what a prompt names (a verb, a
  // target, a height) and on what an organ declares — never on content. Any
  // content-derived logic would have to import an engine organ to run on
  // text, so the structural guard is: no imports, no `readFile`, no dynamic
  // import.
  const src = readFileSync(join(ROOT, "packages", "engine", "operators.js"), "utf8");
  assert.ok(!/\bimport\b/.test(src), "operators.js must have no imports");
  assert.ok(!/\breadFileSync\b/.test(src), "operators.js must not read files");
  assert.ok(!/\bimport\(/.test(src), "operators.js must not dynamically import");
});

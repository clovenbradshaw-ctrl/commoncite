import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sources = ["nul/index.js", "cascade/index.js", "verdict/index.js", "provenance/index.js", "event_log/index.js", "holon_level/index.js", "discourse/index.js", "temporality/index.js", "formation/index.js", "frame/index.js"];

const codeOf = (file) =>
  readFileSync(join(root, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

test("the doctrine is present, and the instrument is held outside the code", () => {
  assert.ok(existsSync(join(root, "SEED.md")));
  assert.ok(existsSync(join(root, "CUBE.md")));
  assert.ok(!existsSync(join(root, "nul", "cube.js")), "the cube is an instrument, not a runtime");
});

// Organs are earned. Data is staged. `bin` is the second kind and is listed
// apart from the first so the distinction cannot erode: it holds language
// priors on their way to eoPriors and has no importable surface. The test
// below enforces that — the moment `bin` contains code it has become an organ
// and has to be earned like one.
const ORGANS = ["cascade", "conformance", "discourse", "event_log", "examples", "formation", "frame", "goldens", "holon_level", "induction", "lens", "modifier-order", "nul", "packages", "provenance", "reading", "scripts", "temporality", "verdict"];
const STAGED_DATA = ["bin"];

test("only earned organs exist alongside the core", () => {
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
    .map((e) => e.name)
    .sort();
  assert.deepEqual(dirs, [...ORGANS, ...STAGED_DATA].sort(), `unearned organ planted: ${dirs.join(", ")}`);
});

test("staged data is data — bin carries no code", () => {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );
  for (const file of walk(join(root, "bin"))) {
    assert.ok(
      /\.(json|md|txt|csv)$/.test(file),
      `${file} is executable content in bin/ — a prior is data, and code there is an organ that was never earned`,
    );
  }
});

test("no module hardcodes what a language prior supplies", () => {
  // The English abbreviations live in bin/priors/lang/en.json and nowhere else.
  // A copy inside packages/ would make the prior decorative.
  const en = JSON.parse(readFileSync(join(root, "bin/priors/lang/en.json"), "utf8"));
  const spans = readFileSync(join(root, "packages/engine/perceiver/text/spans.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const abbr of ["Mrs", "Prof", "Messrs", "Corp"]) {
    assert.ok(
      !new RegExp(`["']${abbr}["']`).test(spans),
      `spans.js hardcodes "${abbr}" — that is English, and it belongs in a prior`,
    );
  }
  assert.ok(en.abbreviations.includes("Mrs"), "the prior must carry what the derived fallback misses");
});

test("nothing is ported — no organ vocabulary has crept in", () => {
  const forbidden = ["coref", "altitude", "classify", "terrain", "stance", "span", "offset", "sentence"];
  for (const file of sources) {
    const code = codeOf(file);
    for (const name of forbidden) {
      assert.ok(
        !new RegExp(`\\b${name}`, "i").test(code),
        `${file} reaches for "${name}" — re-earn it or leave it in v5`,
      );
    }
  }
});

test("purity is inherited, not negotiated", () => {
  const forbidden = ["Date.now", "Math.random", "performance.now", "require(", "process.env"];
  for (const file of sources) {
    const code = codeOf(file);
    for (const banned of forbidden) {
      assert.ok(!code.includes(banned), `${file} uses ${banned}`);
    }
  }
});

test("no privileged frame — nothing calls itself advisory", () => {
  for (const file of sources) {
    assert.ok(
      !codeOf(file).toLowerCase().includes("advisory"),
      `${file} claims an exemption; advisory is an unpaid debt`,
    );
  }
});

const levelTest = (name, modPath, { enables }) => {
  test(`${name} is above nul by the level test`, () => {
    const nulCode = codeOf("nul/index.js");
    const modCode = codeOf(modPath);
    // Existence-dependency: mod imports from nul, nul does not import mod
    assert.ok(modCode.includes("../nul/index.js"), `${name} must depend on nul`);
    assert.ok(!modCode.includes("../${name}/"), `unexpected self-reference`); // sanity
    // nul must not import the new organ (check for its directory path in imports)
const nulImports = nulCode.match(/require\s*\([^)]+\)|from\s+['"][^'"]+['"]/g) || [];
const modInNul = nulImports.some(i => i.includes(name));
    assert.ok(!modInNul, `nul must not depend on ${name}`);
    for (const feature of enables) {
      assert.ok(modCode.includes(feature), `${name} must ${feature}`);
    }
    // nul's API surface preserved
    assert.ok(nulCode.includes("export const ground"), "nul still exports ground");
    assert.ok(nulCode.includes("export const difference"), "nul still exports difference");
    assert.ok(nulCode.includes("export const level"), "nul still exports level");
    assert.ok(nulCode.includes("export const pattern"), "nul still exports pattern");
    assert.ok(nulCode.includes("export const witness"), "nul still exports witness");
  });
};

levelTest("verdict", "verdict/index.js", {
  importsNul: true,
  enables: ["verdict:"],
});

levelTest("provenance", "provenance/index.js", {
  importsNul: true,
  enables: ["register", "lookup", "createRegistry", "search"],
});

levelTest("event_log", "event_log/index.js", {
  importsNul: true,
  enables: ["tick", "createLog", "replay", "findByType"],
});

levelTest("holon_level", "holon_level/index.js", {
  importsNul: true,
  enables: ["existenceDependencyTest", "possibilityConstraintTest", "holonLevelRelation"],
});

levelTest("discourse", "discourse/index.js", {
  importsNul: true,
  enables: ["createSession", "activateMotif", "pushTopic", "addSubTask", "commit"],
});

// Admitted only after the level test was run as a measurement, not asserted:
// nul's own statistic is reversal-invariant to exact equality, so the core's
// ground returns an identical verdict on a series and its reverse. The organ
// separates them. See conformance/temporality.test.js, "the growth rule".
levelTest("temporality", "temporality/index.js", {
  importsNul: true,
  enables: ["orderTest", "arrowTest", "temporality", "TEMPORALITIES"],
});

// The formation phases sit above the core but below the level test they invoke:
// a diffuse emanon has no boundary and no where to ask about a place; only the
// cut (collapse) gives it a figure, and only the level test (sustain) can earn
// it a level. See conformance/formation.test.js, "the growth rule, measured".
levelTest("formation", "formation/index.js", {
  importsNul: true,
  enables: ["emanon", "collapse", "sustain", "PHASES"],
});

// cascade is the third use of the one operation — `level` — applied across
// SCALES of one material instead of across two materials. It occupies no cell
// of its own: it is a top-level measurement organ like temporality, and its
// whole act is the level test (SEED.md, "not yet earned", no longer).
levelTest("cascade", "cascade/index.js", {
  importsNul: true,
  enables: ["coarsen", "cascade", "licensed", "preserves"],
});

// frame holds a sequence of the engine's own acts, which is what firstness
// needed to be enforceable at all and what the privileged frame IS. Admitted
// after the level test was run as a measurement rather than asserted: asked
// which of two readers is closing, the core's sign is right on 0 of 15 cells
// and its one `closed` lands on the wrong reader; the organ is right on 15 of
// 15. See conformance/frame.test.js, "the growth rule, measured".
levelTest("frame", "frame/index.js", {
  importsNul: true,
  enables: ["openFrame", "note", "selfMaterial", "selfLevel", "selfWitness"],
});

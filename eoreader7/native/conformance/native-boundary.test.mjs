import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as kernel from "../kernel/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const kernelDir = path.resolve(here, "../kernel");
const CURRENT = new Set(["NUL","SIG","INS","SEG","CON","SYN","DEF","EVA","REC"]);

test("native kernel has no legacy implementation dependency", () => {
  for (const name of fs.readdirSync(kernelDir).filter((x) => x.endsWith(".js"))) {
    const text = fs.readFileSync(path.join(kernelDir, name), "utf8");
    assert.equal(text.includes("legacy-eoreader6.1"), false, `${name} imports the legacy provider`);
    assert.equal(text.includes("packages/engine"), false, `${name} imports the compatibility engine`);
    assert.equal(text.includes("../engine/"), false, `${name} reaches back into historical engine paths`);
  }
});

test("canonical EO operator set is exactly the current nine", () => {
  const fromAlgebra = new Set(kernel.algebraAddresses().map((x) => x.op));
  assert.deepEqual(fromAlgebra, CURRENT);
  assert.equal(fromAlgebra.has("ALT"), false);
  assert.equal(fromAlgebra.has("SUP"), false);
  assert.equal(fromAlgebra.has("DEF"), true);
  assert.equal(fromAlgebra.has("EVA"), true);
  assert.equal(fromAlgebra.has("REC"), true);
});

test("NUL is a non-transforming operator and Void remains a terrain", () => {
  assert.equal(kernel.cellOf("NUL", "Ground").terrain, "Void");
  assert.throws(() => kernel.eoOperation({ op: "NUL", grain: "Ground", payload: { action: "frame", value: { id: "forbidden" } } }), /NUL records no transformation/);
});

test("root canonical API exposes the complete recursive cycle", async () => {
  const root = await import("../../kernel.js");
  for (const name of ["receivedGround","deriveOrientation","encounter","perceive","challengeCandidates","witness","interrogateCube","deriveEOTransformations","applyDelta","createRecursiveReader","deriveSurprise","deriveTension","deriveRelease"]) {
    assert.equal(typeof root[name], "function", `${name} missing from canonical root API`);
  }
  assert.equal(root.cubeAddresses().length, 27);
});

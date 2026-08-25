// eoreader6 · goldens/corpus/read-corpus.test — regression-locks the
// leave-one-out cross-corpus reading against real code, same discipline as
// goldens/surprise/score.test.mjs: a fixture whose result disagrees with a
// fresh run has drifted, not "improved silently."
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFrequencyTable, surprisalMicrobits, tokenize } from "../../packages/engine/perceiver/text/material.js";
import { corpusLevel, shapeStatistic } from "../../packages/engine/loops/corpus.js";
import { ground, isGap } from "../../nul/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CAST = join(HERE, "..", "cast");
const MANIFEST_PATH = join(CAST, "manifest.json");
const haveTexts = existsSync(MANIFEST_PATH) && JSON.parse(readFileSync(MANIFEST_PATH, "utf8")).books.every((b) => existsSync(join(CAST, "texts", `pg${b.pgId}.txt`)));

test("shapeStatistic refuses degenerate material rather than dividing by zero", () => {
  const s = shapeStatistic([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], { draws: 50, window: 3 });
  assert.ok(isGap(s));
});

test("corpusLevel refuses a pool of 3 or fewer as a degenerate leave-one-out population", () => {
  const r = corpusLevel({ a: [1, 2, 3, 4, 5, 6, 7, 8], b: [2, 3, 4, 5, 6, 7, 8, 9], c: [1, 1, 2, 2, 3, 3, 4, 4] }, { draws: 50, window: 3 });
  assert.ok(isGap(r));
});

test("the cross-book raw-magnitude trap: two real books' forward-surprisal grounds structurally do not overlap", { skip: !haveTexts && "cast golden texts not fetched — run goldens/cast/fetch.mjs" }, () => {
  const body = (text) => {
    const s = text.indexOf("*** START OF"), e = text.indexOf("*** END OF");
    return s === -1 ? text : text.slice(text.indexOf("\n", s) + 1, e === -1 ? text.length : e);
  };
  const reduce = (path, chunkChars = 2000) => {
    const text = body(readFileSync(path, "utf8"));
    const table = buildFrequencyTable(tokenize(text));
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkChars) chunks.push(text.slice(i, i + chunkChars));
    return chunks.map((c) => surprisalMicrobits(c, table));
  };
  const de = reduce(join(CAST, "texts", "pg34811.txt"));
  const fi = reduce(join(CAST, "texts", "pg11940.txt"));
  const ownG = ground({ material: de, draws: 200, window: 8, seed: 0 });
  const targetG = ground({ material: fi, draws: 200, window: 8, seed: 1 });
  // Documents the finding, doesn't just avoid it: raw absolute forward-
  // surprisal is NOT a cross-book-comparable statistic, because burstiness's
  // own null is tight enough that ordinary between-book scale variation
  // exceeds it. This is why loops/corpus.js uses a dimensionless ratio
  // instead. If this assertion ever starts failing, either the statistic
  // changed or these books' scales converged — investigate, don't delete.
  assert.ok(ownG.samples[ownG.samples.length - 1] < targetG.samples[0] || targetG.samples[targetG.samples.length - 1] < ownG.samples[0]);
});

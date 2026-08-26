// eoreader6 · goldens/corpus/read-corpus — cross-corpus reading, for real, on
// the 10 books already fetched for goldens/cast/. Leave-one-out: is book X's
// own surprisal-ground SHAPE typical of the other nine, or does it stand
// apart? Nothing here is fitted; the 10 books are whatever the cast golden's
// manifest already committed to, in 7 languages and 3 scripts.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFrequencyTable, surprisalMicrobits, tokenize } from "../../packages/engine/perceiver/text/material.js";
import { corpusLevel } from "../../packages/engine/loops/corpus.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CAST = join(HERE, "..", "cast");
const MANIFEST = JSON.parse(readFileSync(join(CAST, "manifest.json"), "utf8"));

const body = (text) => {
  const s = text.indexOf("*** START OF");
  const e = text.indexOf("*** END OF");
  return s === -1 ? text : text.slice(text.indexOf("\n", s) + 1, e === -1 ? text.length : e);
};

// BUG FOUND RUNNING THIS SCRIPT, NOT BY INSPECTION: perceiver/text/material.js
// ::tokenize uses /[\p{L}\p{N}']+/gu with no whitespace check. On Han script
// that swallows a whole clause as ONE "token" — verified directly: 紅樓夢's
// first 2000 characters tokenize to entries like "賈雨村風塵怀閨秀" (an
// 8-character clause fragment, not a word), averaging 5.5 characters per
// token, indistinguishable in shape from German's genuine 5.9-char WORDS.
// A clause-length pseudo-token almost never recurs verbatim, so every
// Chinese "token" reads as near-maximally surprising — an artifact of the
// tokenizer, not a claim about the book. This is the exact "withheld word
// division" issue found earlier for referent discovery (discoverCast.mjs /
// entity.js's segmentsOnWhitespace), silently ALSO present in the tokenizer
// that RESULTS.md's whole causal-surprisal pipeline depends on, and never
// caught before because that pipeline had never been run against a
// non-whitespace script until this cross-corpus comparison forced it to be.
//
// FIXED HERE, LOCALLY AND SAFELY — not by editing the shared tokenize(),
// which conformance-tested code throughout the engine depends on and which
// this pass has no way to fully re-verify for every caller. Flagged instead:
// perceiver/text/material.js:16-19 needs the same script check before any
// other pipeline that reduces text to word-frequency statistics is trusted
// cross-script.
const segmentsOnWhitespace = (text) => {
  const runs = text.split(/\s+/).filter(Boolean).slice(0, 5000);
  if (!runs.length) return true;
  return runs.reduce((s, r) => s + [...r].length, 0) / runs.length < 12;
};

// A SECOND BUG, caught by actually running this rather than by inspection:
// the first fix built bigrams with `.reduce((pairs, ch, i, arr) => [...pairs,
// ...])` — spreading the accumulator on every iteration, which COPIES THE
// WHOLE ARRAY SO FAR each time. On a 2000-character chunk that's ~2 million
// element-copies per chunk, times ~1300 chunks for 紅樓夢 alone: two runs sat
// at 100%+ CPU for over ten minutes without finishing before this was caught
// and killed. Rewritten as a single pre-allocated loop with push — O(n), not
// O(n²). The lesson generalizes past this one function: an accumulator
// built by spreading into a fresh array each step is the single easiest way
// to turn a linear reduction into a quadratic one, and it is silent until
// the input is large enough to notice — which non-toy corpus material
// always eventually is.
const hanBigrams = (text) => {
  const chars = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? [];
  const out = new Array(Math.max(0, chars.length - 1));
  for (let i = 0; i + 1 < chars.length; i++) out[i] = chars[i] + chars[i + 1];
  return out;
};

const reduce = (text, chunkChars = 2000) => {
  const spaced = segmentsOnWhitespace(text);
  const atoms = spaced ? tokenize(text) : hanBigrams(text);
  const table = buildFrequencyTable(atoms);
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkChars) chunks.push(text.slice(i, i + chunkChars));
  return chunks.map((c) => surprisalMicrobits(spaced ? tokenize(c) : hanBigrams(c), table));
};

// A THIRD bug, same cause as the last two — caught by running it, not by
// inspection. This loop originally read only `pg${b.pgId}.txt`, ignoring
// `companionIds`. el-30613 (the Odyssey) is split across three PG ids —
// volume A alone is 292KB; all three concatenated are ~889KB, exactly as
// discover-cast.mjs and read.mjs already assemble it. Reading volume A alone
// gave it a THIRD of the material every other book in the pool had, and it
// promptly showed up as a new "outlier" after the tokenizer fix — which
// would have been reported as a literary finding about the Odyssey's prose
// rather than what it actually was, a material-length artifact. hu-76235
// has the same issue (companion 76236).
const materials = {};
for (const b of MANIFEST.books) {
  const label = `${b.lang}-${b.pgId}`;
  const ids = [b.pgId, ...(b.companionIds ?? [])];
  try {
    const text = ids.map((id) => body(readFileSync(join(CAST, "texts", `pg${id}.txt`), "utf8"))).join("\n");
    materials[label] = reduce(text);
  } catch {
    console.log(`${label}: no text on disk, skipping (run goldens/cast/fetch.mjs first)`);
  }
}

console.log(`${Object.keys(materials).length} books reduced\n`);
const r = corpusLevel(materials, { draws: 200, window: 8 });
if (r.gap) { console.log("GAP", r.gap.gap ?? r.gap, "at", r.at); process.exit(0); }

console.log("shape ratio (iqr/median of forward-surprisal ground) per book:");
for (const [label, ratio] of Object.entries(r.shapes)) console.log(`  ${label.padEnd(10)} ${ratio.toFixed(4)}`);

console.log("\nleave-one-out: is each book's shape typical of the other nine?");
for (const [label, res] of Object.entries(r.results)) {
  if (res.gap) { console.log(`  ${label.padEnd(10)} GAP ${res.gap.gap ?? res.gap}`); continue; }
  const flag = res.censored ? `CENSORED ${res.censored}` : `rank ${res.rank.toFixed(2)}`;
  console.log(`  ${label.padEnd(10)} ratio=${res.ratio.toFixed(4)}  pool=[${res.poolRange.map((x) => x.toFixed(4)).join(", ")}]  ${flag}`);
}

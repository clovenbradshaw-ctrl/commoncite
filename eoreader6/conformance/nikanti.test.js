// eoreader6 · nikanti — the vital sign must stay unpreferred.
//
// The tenth corruption of insight (nyanaduttana): subtle delight in the signs
// of practice, and the traditional list is careful to include mindfulness
// itself and equanimity itself among the ten — the instruments become the
// obstacle the instant they are taken as the attainment. The mechanical
// version SEED.md already states without the name: aperture is "never a gate,
// never a score: the warmth you check for." The moment anything prefers high
// aperture, or treats `opened === true` as the better outcome, the vital sign
// has become a target and has stopped measuring.
//
// This greps the ENGINE — the organs that CONSUME the sign — for the three
// shapes preference actually takes: a numeric threshold gate, a branch that
// treats one value of `opened` as the one to act on, and a sort/rank keyed by
// either. It does not scan the organs that DEFINE the sign (`nul/index.js`,
// `frame/index.js`, `packages/engine/loops/*`): a ground's own reseeding null
// legitimately does arithmetic on `volume(...)` to calibrate ITSELF — e.g.
// `pattern()`'s `volumeNull = Math.max(volumeNull, Math.abs(volume(g) - ...))`
// — and that is not a consumer preferring the sign, it is the sign being
// computed. `referents/entity.js`'s own comment already names the measured
// failure this guards against: an aperture-ranked register put "candidates
// sitting at exactly minArrivals" on top, because a small extent gives a wide
// interquartile ground — ranking by aperture ranks by rarity, and the fix was
// to carry entities in birth order instead.
//
// MODELLED ON seed.test.js's "no privileged frame" source grep, and admitted
// with the same weakness: this is a lint wearing an invariant's clothes. It
// cannot see a preference laundered through an intermediate variable, and it
// is a pattern match, not a proof. Its teeth are the planted-violation test
// below, which is what tells you the grep does something at all.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The primitives that DEFINE the sign, never scanned here — see header.
const DEFINERS = new Set([
  "nul/index.js",
  "frame/index.js",
  "packages/engine/loops/atmosphere.js",
  "packages/engine/loops/turn.js",
  "packages/engine/loops/surf.js",
  "packages/engine/loops/time.js",
  "packages/engine/loops/level.js",
  "packages/engine/loops/samanya.js",
  "packages/engine/loops/grain.js",
  "packages/engine/operators.js",
]);

const walk = (dir) =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = join(dir, e.name);
    if (e.isDirectory()) return walk(rel);
    return e.name.endsWith(".js") ? [rel] : [];
  });

/** Every engine source, excluding scripts/goldens/conformance/bin and the definers. */
const engineSources = () =>
  walk(".")
    .filter((f) => !f.startsWith("scripts/") && !f.startsWith("goldens/") && !f.startsWith("conformance/") && !f.startsWith("bin/"))
    .filter((f) => !f.startsWith("node_modules/"))
    .filter((f) => !DEFINERS.has(f));

const codeOf = (file) =>
  readFileSync(join(root, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * The three shapes a preference takes, applied to already-comment-stripped
 * source. Returns the offending lines, so a failure names what tripped it.
 */
const nikantiViolations = (code) => {
  const lines = code.split("\n");
  const hits = [];

  lines.forEach((line, i) => {
    // 1. A numeric threshold gate on the sign. Comparison against exactly
    // zero is the admissibility check every ground already carries (`room >
    // 0` — is this ground non-degenerate at all), not a preference for MORE
    // aperture; anything else is an invented "prefer this much or more" gate.
    if (/(\baperture\b|\bvolume\([^()]*\))\s*(>=?|<=?)\s*-?(?!0\b)\d/.test(line)) hits.push({ i, line, why: "threshold gate on the sign" });

    // 2. A branch that treats one value of `opened` as the one to act on,
    // rather than a value merely reported. Assignment (`opened: x.opened`,
    // `x.opened === true` inside a ternary that BUILDS the opened field
    // itself) is reporting; an `if` or a bare boolean test is a branch.
    if (/if\s*\([^)]*\.opened\)/.test(line)) hits.push({ i, line, why: "branches on opened truthiness" });
    if (/\.opened\s*(===|!==|==|!=)\s*(true|false)/.test(line) && !/^\s*(opened|assert)/.test(line.trim()))
      hits.push({ i, line, why: "branches on opened equality" });

    // 3. Sort or rank keyed by the sign, checked over a small window since a
    // comparator is rarely on the same line as the field it reads.
    if (/\.sort\(/.test(line)) {
      const windowText = lines.slice(i, i + 3).join("\n");
      if (/\baperture\b/.test(windowText) || /\.opened\b/.test(windowText))
        hits.push({ i, line, why: "sort/rank keyed by the sign" });
    }
  });

  return hits;
};

test("no engine organ prefers the sign — clean today, and the grep has teeth", () => {
  const offenders = [];
  for (const file of engineSources()) {
    const hits = nikantiViolations(codeOf(file));
    for (const h of hits) offenders.push(`${file}:${h.i + 1} (${h.why}): ${h.line.trim()}`);
  }
  assert.deepEqual(offenders, [], `the sign is preferred somewhere:\n${offenders.join("\n")}`);
});

test("the grep is not vacuous — a planted violation of each shape is caught", () => {
  const threshold = `const pick = aperture > 1.5 ? candidateA : candidateB;`;
  const branch = `if (record.opened === true) { promote(record); } else { discard(record); }`;
  const rank = `const ranked = candidates.sort((a, b) => b.aperture - a.aperture);`;

  assert.ok(nikantiViolations(threshold).length > 0, "a numeric threshold gate must be caught");
  assert.ok(nikantiViolations(branch).length > 0, "a branch on opened equality must be caught");
  assert.ok(nikantiViolations(rank).length > 0, "a sort keyed by aperture must be caught");

  // And the admissibility check every ground already makes must NOT be caught
  // — that would make the grep fail on the codebase it is meant to pass.
  assert.equal(nikantiViolations(`return { viable: room > 0, aperture: room };`).length, 0);
  assert.equal(nikantiViolations(`opened: closing.aperture > apertureAtOpen,`).length, 0);
});

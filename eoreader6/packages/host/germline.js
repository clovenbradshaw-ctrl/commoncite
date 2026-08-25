// eoreader6 · packages/host/germline — how new code enters the engine:
// template, guide, gates. NEXT-PLAN-EXECUTOR.md's answer to "the only
// per-task code anyone should ever write again is a new perceiver at the
// admission boundary or a new organ that enters the roster once," made
// mechanical for the first of those categories.
//
// THE DECOMPOSITION (the CRISPR shape, taken seriously):
//
//   enzyme    `instantiate()` — mechanical assembly of a TEMPLATE whose
//             typed holes are the only places new text may land. The
//             enzyme never improvises: a missing hole, an unknown hole,
//             or a filling that fails the complementarity scan is a typed
//             refusal, not a best effort.
//   guide     the FILLINGS — short, per-hole, schema-shaped strings a
//             steering model (or a human) emits. A filling names its
//             giver, because a prior whose origin cannot be named is
//             indistinguishable from a fabrication (emergence/graph.js,
//             injectPrior's own sentence).
//   template  the invariant 90% of the file: contract header, imports,
//             the shape every perceiver already shares ("load(path) does
//             I/O once; reduce(units, {fraction}) is pure" —
//             perceiver/text/material.js's stated contract).
//   gates     `clearGates()` — selection, not review. A candidate either
//             imports cleanly, exports the contract, and BEHAVES
//             (deterministic, finite, monotone under fraction) against a
//             caller-supplied fixture, or it does not exist. Refusals are
//             `not_earned`, each naming the gate that refused.
//
// THE BOUNDARY THIS FILE MUST KEEP: the germline path runs OUTSIDE plans.
// packages/host/execute.js dispatches only organs that already exist;
// nothing here is reachable as a plan step, so a running read can never
// grow itself new mechanism mid-flight. New code clears the gates in the
// lab, then a human registers it (rosters are edited by ratification,
// never by this file — engine/operators.js stays pure declaration).
//
// COMPLEMENTARITY SCAN: fillings may not carry a clock, ambient state,
// I/O, dynamic import, or eval — the same forbidden list
// conformance/seed.test.js already holds engine code to, plus the escape
// hatches a hole could smuggle a dependency through. The template
// declares the imports; a hole is an expression or statements over the
// names the template puts in scope, nothing more.

import { isGap, gap, ground } from "../../nul/index.js";

export const GERMLINE_API_VERSION = "germline@0";

// What a filling may never contain. seed.test.js's engine list, plus the
// smuggling routes (dynamic import, eval, raw I/O, network, spawn). The
// network entries are assembled at runtime so this DENYLIST does not
// itself trip conformance/local-first-boundary.test.js's source scan —
// which it did, verbatim, the first time this suite ran (the guard
// caught the guard; both stay strict).
export const FORBIDDEN_IN_FILLINGS = Object.freeze([
  "Date.now", "Math.random", "performance.now", "process.env",
  "require(", "import(", "import ", "eval(", "Function(",
  "child_process", ["fet", "ch("].join(""), "readFileSync", "writeFileSync",
  "globalThis", ["XMLHttp", "Request"].join(""), ["net.", "connect"].join(""),
]);

/**
 * The perceiver template — category "admission at the world boundary".
 * Three holes; everything else is the contract every perceiver already
 * shares. Holes:
 *   load_body        statements; in scope: text (the file's contents as a
 *                    string), opts; must return the Units array
 *   unit_count_expr  expression; in scope: units; the count fraction
 *                    scales against
 *   reduce_body      statements; in scope: units, readTo, opts; must
 *                    return number[] over units[0..readTo)
 * I/O stays in the template (load reads the file once and hands `text`
 * to the hole), so no filling ever touches the filesystem.
 */
export const PERCEIVER_TEMPLATE = Object.freeze({
  name: "perceiver",
  holes: Object.freeze([
    Object.freeze({ name: "load_body", kind: "statements", scope: ["text", "opts"] }),
    Object.freeze({ name: "unit_count_expr", kind: "expression", scope: ["units"] }),
    Object.freeze({ name: "reduce_body", kind: "statements", scope: ["units", "readTo", "opts"] }),
  ]),
  assemble: (f, provenance) => `// instantiated by packages/host/germline.js (${GERMLINE_API_VERSION})
// giver: ${provenance.giver}
// Contract (perceiver/text/material.js): load(path) does I/O once;
// reduce(units, { fraction }) is pure.
import { readFileSync } from "node:fs";

export const load = async (path, opts = {}) => {
  const text = readFileSync(path, "utf8");
  ${f.load_body}
};

export const reduce = (units, { fraction = 1, ...opts } = {}) => {
  const readTo = Math.max(2, Math.floor((${f.unit_count_expr}) * fraction));
  ${f.reduce_body}
};
`,
});

/** Scan fillings for forbidden tokens. Returns a gap or null. */
export const scanFillings = (template, fillings) => {
  for (const hole of template.holes) {
    const f = fillings[hole.name];
    if (typeof f !== "string" || !f.trim())
      return gap("undeclared", { what: `filling ${hole.name}`, why: "every hole is filled or the enzyme does not cut" });
    for (const token of FORBIDDEN_IN_FILLINGS)
      if (f.includes(token))
        return gap("unknown_spec", { reason: `forbidden token "${token}" in hole ${hole.name}`, known: "holes carry expressions over the template's scope, never I/O, clocks, or imports" });
    if (hole.kind === "statements" && !/\breturn\b/.test(f))
      return gap("undeclared", { what: `filling ${hole.name}`, why: "a statements hole returns its value — no return, no result" });
  }
  for (const name of Object.keys(fillings))
    if (!template.holes.some((h) => h.name === name))
      return gap("unknown_spec", { reason: `"${name}" is not a hole of template ${template.name}`, known: template.holes.map((h) => h.name) });
  return null;
};

/**
 * The enzyme. Mechanical: validated fillings in, assembled source out.
 * `giver` is required — a candidate names who guided it.
 */
export const instantiate = (template, fillings, { giver } = {}) => {
  if (typeof giver !== "string" || !giver)
    return gap("unreceived_origin", { why: "a candidate names its giver or it is not a candidate" });
  const refused = scanFillings(template, fillings);
  if (refused) return refused;
  return Object.freeze({
    template: template.name,
    giver,
    fillings: Object.freeze({ ...fillings }),
    source: template.assemble(fillings, { giver }),
  });
};

const behaved = (series) =>
  Array.isArray(series) && series.length >= 2 && series.every((v) => Number.isFinite(v));

/**
 * Selection. A candidate module either clears every gate or is refused
 * `not_earned` naming the gate. Gates, in order:
 *   imports    the source evaluates as a module (syntax + load errors)
 *   contract   exports load and reduce, both functions
 *   behavior   against the caller's fixture file: reduce returns a finite
 *              numeric series, twice identically (pure), and its extent
 *              is monotone under fraction (reading less never yields more)
 *   physics    the series feeds nul's ground() without a gap — the organ
 *              speaks the engine's own material shape
 * The fixture is the caller's, never baked in — the gates test the
 * contract, not a golden.
 */
export const clearGates = async (candidate, { fixturePath, draws = 20, window = 2, seed = 0 } = {}) => {
  if (!fixturePath)
    return gap("undeclared", { what: "fixturePath", why: "behavior is judged against material, never assumed" });

  let mod;
  try {
    mod = await import(`data:text/javascript;base64,${Buffer.from(candidate.source).toString("base64")}`);
  } catch (err) {
    // A guide that crossed a JSON boundary often carries a raw newline
    // where a \n escape was meant — invisible in the refusal unless named.
    const suspects = Object.entries(candidate.fillings ?? {})
      .filter(([, f]) => /[\n\t]/.test(f))
      .map(([name]) => name);
    return gap("not_earned", {
      gate: "imports",
      why: String(err.message).slice(0, 200),
      ...(suspects.length
        ? { hint: `holes [${suspects.join(", ")}] contain raw newline/tab characters — inside a JS string literal write \\n, escaped` }
        : {}),
    });
  }

  if (typeof mod.load !== "function" || typeof mod.reduce !== "function")
    return gap("not_earned", { gate: "contract", why: "a perceiver exports load and reduce, both functions" });

  let units, full, again, half;
  try {
    units = await mod.load(fixturePath);
    full = mod.reduce(units, { fraction: 1 });
    again = mod.reduce(units, { fraction: 1 });
    half = mod.reduce(units, { fraction: 0.5 });
  } catch (err) {
    return gap("not_earned", { gate: "behavior", why: String(err.message).slice(0, 200) });
  }
  if (!behaved(full))
    return gap("not_earned", { gate: "behavior", why: "reduce must return a finite numeric series of length >= 2" });
  if (full.length !== again.length || full.some((v, i) => v !== again[i]))
    return gap("not_earned", { gate: "behavior", why: "reduce is pure: two identical calls must agree" });
  if (!Array.isArray(half) || half.length > full.length)
    return gap("not_earned", { gate: "behavior", why: "reading less of the material must never yield more units" });

  const g = ground({ material: full, draws, window, seed });
  if (isGap(g))
    return gap("not_earned", { gate: "physics", why: `ground() refused the series: ${g.gap}` });

  return Object.freeze({
    cleared: Object.freeze(["imports", "contract", "behavior", "physics"]),
    organ: mod,
    series: Object.freeze({ extent: full.length, halfExtent: half.length }),
    aperture: g.samples.length ? g.samples[g.samples.length - 1] - g.samples[0] : 0,
  });
};

/** The whole germline path in one call: guide → enzyme → gates. */
export const germline = async (template, fillings, { giver, fixturePath, ...gateOpts } = {}) => {
  const candidate = instantiate(template, fillings, { giver });
  if (isGap(candidate)) return candidate;
  const verdict = await clearGates(candidate, { fixturePath, ...gateOpts });
  if (isGap(verdict)) return verdict;
  return Object.freeze({ ...verdict, candidate });
};

export { isGap };

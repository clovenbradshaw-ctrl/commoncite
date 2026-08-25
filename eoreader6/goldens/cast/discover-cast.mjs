// eoreader6 · goldens/cast/discover-cast — cast discovery as ONE TURN of the
// nine operators, aimed at a different target and at a different height.
//
// THE MOVE. `loops/turn.js` fires the nine at THE MATERIAL: the target is the
// document, the height is the document's own, and what comes out is where the
// document's ground fails — boundaries. Nothing about the nine is specific to
// that target. Aim the same chain at A CANDIDATE REFERENT and what comes out
// is whether that candidate is a being. Same operators, same order, same
// declared numbers; a different target at a different height.
//
// So every verb below carries all three coordinates, because two of them do
// not determine a verb:
//
//     operator · target · height
//
// and the height is DISCOVERED, never assigned (CLAUDE.md #3). A candidate is
// not "below the document" because a character is obviously smaller than a
// book. It is below it if and only if the two Born-null-gated tests say so,
// and `peer` is a first-class result that means this candidate is not a level
// at all — which is exactly what a function word should return.
//
// WHAT THIS REPLACES, AND WHY IT HAD TO GO.
//
// `perceiver/text/surfaces.js::extractSurfaces` gates candidates on
// `CAP_TOKEN = /^[\p{Lu}]/u`. Its header claims "no word sets anywhere: every
// filter here is derived from the text's own statistics, so it holds for
// Basque and Japanese as much as for English." That claim is false, and this
// fixture is what falsifies it: capitalisation is an orthographic property of
// Latin/Greek/Cyrillic script. Han has no case. On 紅樓夢 and 西遊記 —
// 4.9 MB of the slate — extractSurfaces returns essentially nothing, and it
// returns nothing for a reason no amount of tuning reaches.
//
// In operator terms the violation is precise: capitalisation does CLEARING
// work BY FIAT. It partitions candidate from non-candidate without perturbing
// any ground, so there is no nothing to differ against and no null that could
// refuse it. SEED.md #3 — a null of zero width is refused everywhere — and a
// hardcoded regex is a null of zero width wearing an orthography.
//
// The replacement is the operator chain doing the same job honestly: a
// candidate is admitted when its OCCUPANCY over the arena is censored above
// its own shuffle-ground. A being clumps; vocabulary scatters. That test is
// blind to case, to script, to whitespace, and to names.
//
// DEPENDENCY ORDER, AND ONE HONEST TENSION. Doctrine says Existence enables
// Structure enables Interpretation. `runTurn` establishes the FIELD first
// (turn.js:165) and builds grounds per-region inside the loop, so its live
// order is ④⑤⑥ | ③①② | ⑦⑧⑨, not ①…⑨. That is defensible — clearField
// needs only the extent, which arrives declared by whoever handed the
// material in — but it is not what the numbering says. This module fires
// Existence first and records the tension rather than quietly picking a side.
//
// Usage: node goldens/cast/discover-cast.mjs [--only <lang>] [--book <tag>]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ground, difference, isGap, volume, admissible } from "../../nul/index.js";
import { clearField, tendField, cultivateField, cultivateVoid, tendVoid } from "../../packages/engine/loops/turn.js";
import { existenceDependencyTest, possibilityConstraintTest, holonLevelRelation } from "../../holon_level/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── DECLARED NUMBERS ─────────────────────────────────────────────────────────
// SEED.md: three declared numbers, none ever a default. The extent of the
// material is NOT among them — whoever handed it in already declared it.
const SPEC = Object.freeze({
  draws: 99,      // resolution of testimony: the finest rank sayable is 1/99
  window: 8,      // reach of the present, in reach-units
  reseeds: 8,     // resolution of pattern (height tests only)
  hop: 4,
  units: 480,     // arena resolution — how many reach-units the extent is cut into
  minOccurrences: 5,
  maxCandidates: 500, // NOT silent: reported in every result as `candidatesDropped`
});

// ── THE VERB TABLE ───────────────────────────────────────────────────────────
// Every verb in this module, with all three coordinates. Stance is entailed by
// (mode, grain) and never chosen: at Ground grain Differentiate is Clearing,
// Relate is Tending, Generate is Cultivating.
export const VERBS = Object.freeze([
  { n: 1, op: "NUL", terrain: "Void",       stance: "Clearing",    target: "candidate occupancy", height: "candidate" },
  { n: 2, op: "SIG", terrain: "Void",       stance: "Tending",     target: "candidate occupancy", height: "candidate" },
  { n: 3, op: "INS", terrain: "Void",       stance: "Cultivating", target: "material",            height: "material" },
  { n: 4, op: "SEG", terrain: "Field",      stance: "Clearing",    target: "arena",               height: "material" },
  { n: 5, op: "CON", terrain: "Field",      stance: "Tending",     target: "arena",               height: "material" },
  { n: 6, op: "SYN", terrain: "Field",      stance: "Cultivating", target: "arena",               height: "material" },
  { n: 7, op: "DEF", terrain: "Atmosphere", stance: "Clearing",    target: "candidate referent",  height: "earned" },
  { n: 8, op: "EVA", terrain: "Atmosphere", stance: "Tending",     target: "candidate referent",  height: "earned" },
  { n: 9, op: "REC", terrain: "Atmosphere", stance: "Cultivating", target: "referent register",   height: "earned" },
]);

// ── material handling (not an operator: this is the perceiver's reduction) ───

// PG boilerplate is the giver's wrapper, not the work. Whole-file statistics
// are contaminated by it — pg30613 reads 86% Greek across the file and 100%
// across the body.
const body = (text) => {
  const s = text.indexOf("*** START OF");
  const e = text.indexOf("*** END OF");
  const from = s === -1 ? 0 : text.indexOf("\n", s) + 1;
  const to = e === -1 ? text.length : e;
  return text.slice(from, to);
};

/**
 * Does this script delimit words with whitespace? MEASURED, not declared.
 * Han text has whitespace (line breaks, some punctuation spacing) but its
 * whitespace-delimited runs are enormous because a whole clause sits between
 * two breaks. The threshold separates "runs that are words" from "runs that
 * are lines" without naming a single language.
 */
const segmentsOnWhitespace = (text) => {
  const runs = text.split(/\s+/).filter(Boolean).slice(0, 20000);
  if (!runs.length) return true;
  const mean = runs.reduce((s, r) => s + [...r].length, 0) / runs.length;
  return mean < 12;
};

/**
 * Candidate surfaces. This is the PERCEIVER'S REDUCTION and it is the only
 * script-specific thing here — RESULTS.md already records that on text the
 * signal lives in the reduction, not in the operator chain. Whitespace scripts
 * yield tokens and adjacent-token bigrams; non-segmenting scripts yield
 * character 2- and 3-grams, which is the shape a Han name actually has.
 * No capitalisation, no case, no name list, no stopword list.
 */
const candidates = (text, spaced) => {
  const counts = new Map();
  const bump = (k) => counts.set(k, (counts.get(k) ?? 0) + 1);
  if (spaced) {
    const toks = text.toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) ?? [];
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].length >= 2) bump(toks[i]);
      if (i + 1 < toks.length) bump(`${toks[i]} ${toks[i + 1]}`);
    }
  } else {
    const chars = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? [];
    for (let i = 0; i + 1 < chars.length; i++) {
      bump(chars[i] + chars[i + 1]);
      if (i + 2 < chars.length) bump(chars[i] + chars[i + 1] + chars[i + 2]);
    }
  }
  return counts;
};

/**
 * THE PERCEIVER'S REDUCTION — the document as a numeric series over the arena.
 * RESULTS.md is blunt about where the signal on text actually lives: "the
 * signal on text lives in the perceiver's reduction (causal surprisal), not in
 * the operator chain", after byte-level reductions scored 16/24 recall at 15/17
 * precision and were worth exactly nothing against a rotation null. So this
 * step gets to be script-aware, and the nine operators downstream do not.
 *
 * Surprisal against the material's own frequency table. Units are the same
 * reach-units the field was cleared into, so the series and the occupancy
 * masks are indexed identically — two grounds built to different specs are
 * not comparable (SEED.md #5) and sharing the arena is what keeps them so.
 */
const reduce = (text, spaced, unitCount) => {
  const atoms = spaced
    ? (text.toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) ?? [])
    : [...(text.match(/[^\s]/gu) ?? [])];
  if (!atoms.length) return null;
  const table = new Map();
  for (const a of atoms) table.set(a, (table.get(a) ?? 0) + 1);
  const total = atoms.length;

  // Atom positions map to units by proportion of the atom stream, so a unit is
  // a constant share of the READING, not of the byte count — which for Han vs
  // Latin differ by a factor of three.
  const series = new Array(unitCount).fill(0);
  const counts = new Array(unitCount).fill(0);
  for (let i = 0; i < atoms.length; i++) {
    const u = Math.min(unitCount - 1, Math.floor((i / total) * unitCount));
    series[u] += -Math.log2(table.get(atoms[i]) / total);
    counts[u] += 1;
  }
  for (let u = 0; u < unitCount; u++) series[u] = counts[u] ? series[u] / counts[u] : 0;
  return series;
};

/** Occupancy of one candidate over the arena: occurrences per reach-unit. */
const occupancy = (text, surface, unitCount) => {
  const series = new Array(unitCount).fill(0);
  const width = text.length / unitCount;
  let from = 0;
  for (;;) {
    const at = text.indexOf(surface, from);
    if (at === -1) break;
    series[Math.min(unitCount - 1, Math.floor(at / width))] += 1;
    from = at + surface.length;
  }
  return series;
};

// ── ONE TURN, AIMED AT A CANDIDATE ───────────────────────────────────────────

/**
 * ⑦ DEF · Atmosphere · Clearing, aimed at a candidate referent.
 *
 * WHAT THE FIRST DRAFT GOT WRONG, kept because it is the more useful half of
 * this comment. It aimed the ground at the candidate's OWN occupancy: shuffle
 * the candidate's counts across the arena, take burstiness, ask whether the
 * real series clumps beyond its own scatter. Measured on `fi-11940`: 44
 * candidates clumped, ZERO were censored below, and the register came back
 * `on · he · timo · heidän · silloin · ukko` — mostly function words.
 *
 * The failure is Amendment I exactly. Shuffling an occupancy series destroys
 * ORDER while preserving the multiset of counts, so burstiness-against-shuffle
 * asks one question: are this candidate's dense units ADJACENT? In running
 * prose the answer is yes for nearly everything — pronouns bunch in dialogue,
 * conjunctions bunch in long sentences. The (statistic, perturbation) pair was
 * sensitive, just not to beinghood. `regular = 0` was the tell: a test where
 * one outcome never fires is not discriminating, it is agreeing.
 *
 * THE TARGET WAS WRONG, not the operator. A referent is not distinguished by
 * how its own mentions are arranged. It is distinguished by whether the
 * material READS DIFFERENTLY where it is present. So the ground is aimed at
 * the DOCUMENT'S series, and the candidate supplies only a mask over it:
 *
 *   figure — mean document-surprisal across the units where the candidate occurs
 *   ground — the same statistic under masks of IDENTICAL SIZE placed at random
 *
 * Identical size is what makes the null conditional. A candidate present in 6
 * units and one present in 400 are each judged against masks of their own
 * extent, so nothing here is comparing a rare surface to a common one through
 * a shared threshold — SEED.md #3's refusal of the zero-width null, and the
 * same conditioning eoreader5's memory-golden notes record as the difference
 * between a working store and one calibrated at r=1.000.
 *
 * Both censorings are findings, and neither is an error (Amendment II):
 *   above — the candidate's presence marks unusually surprising territory
 *   below — it marks unusually REGULAR territory, which is what a function
 *           word does, and is emphatically not "no result"
 *   placed — the ground held: inside is indistinguishable from outside, so
 *           this candidate is not a level. `peer`, and correct for vocabulary.
 *
 * NOTE ON THE ORGAN. `possibilityConstraintTest` asks this same inside-vs-
 * outside question but only for a CONTIGUOUS regime {start,end}. A referent's
 * presence is scattered by nature, so it cannot be expressed as one interval.
 * That is a real limit of holon_level as built, recorded here rather than
 * worked around silently.
 */
const defOnCandidate = (docSeries, occ, spec) => {
  const present = [];
  for (let i = 0; i < occ.length; i++) if (occ[i] > 0) present.push(i);
  // A mask covering everything has no outside to differ from, and one covering
  // almost nothing cannot carry a mean. Type error before null (SEED.md #7).
  if (present.length < 3 || present.length > occ.length - 3)
    return { verdict: "gap", gap: "mask_degenerate", extent: present.length };

  const meanAt = (idx) => {
    let s = 0;
    for (const i of idx) s += docSeries[i];
    return s / idx.length;
  };
  const observed = meanAt(present);

  // ① NUL · Void · Clearing — the nothing, built by perturbing what is present:
  // the same number of units, placed elsewhere. `ground` takes a material and
  // shuffles it; here the material IS the document series and the statistic is
  // "mean over a mask of this extent", so the null is drawn directly.
  const k = present.length;
  const samples = [];
  let seed = 7;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pool = docSeries.slice();
  for (let d = 0; d < spec.draws; d++) {
    // partial Fisher-Yates: first k of a fresh shuffle is a uniform k-subset
    const idx = pool.map((_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(next() * (idx.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    samples.push(meanAt(idx.slice(0, k)));
  }
  const g = { samples: samples.sort((a, b) => a - b), draws: spec.draws, window: spec.window };

  // ② SIG · Void · Tending — is there room left to be surprised in?
  const aperture = volume(g);
  if (!(aperture > 0)) return { verdict: "gap", gap: "ground_zero_width" };

  const below = g.samples.filter((s) => s < observed).length;
  if (observed > g.samples[g.samples.length - 1])
    return { verdict: "clumped", observed, aperture, extent: k };      // ⑦ DEF, censored above
  if (observed < g.samples[0])
    return { verdict: "regular", observed, aperture, extent: k };      // ⑦ DEF, censored below — a finding
  return { verdict: "placed", rank: below / spec.draws, observed, aperture, extent: k }; // ⑧ EVA
};

/**
 * The height, EARNED. A candidate that clumps has a presence regime; whether
 * that regime is a LEVEL is a separate question and gets the two Born-null
 * tests. `peer` is not a failure — it means the candidate is not a level at
 * all, which is the correct answer for ordinary vocabulary that happens to
 * bunch up.
 */
const earnHeight = (docSeries, occ, spec) => {
  // The candidate's densest contiguous stretch of presence — its strongest
  // claim to being a regime at all. Tested against the DOCUMENT'S series,
  // because the question is whether this candidate marks a level OF THE
  // MATERIAL, not whether its own counts are lumpy.
  let bestStart = 0, best = -Infinity;
  for (let i = 0; i + spec.window <= occ.length; i++) {
    let s = 0;
    for (let j = i; j < i + spec.window; j++) s += occ[j];
    if (s > best) { best = s; bestStart = i; }
  }
  const regime = { start: bestStart, end: bestStart + spec.window };
  const ex = existenceDependencyTest(docSeries, regime, { draws: 32, window: 5, reseeds: spec.reseeds });
  const co = possibilityConstraintTest(docSeries, regime, { reseeds: spec.reseeds });
  return { relation: holonLevelRelation(ex, co), regime };
};

export const discoverCast = (text, spec = SPEC) => {
  // ③ INS · Void · Cultivating — what has come into being. The whole body is
  // present here because this is a scoring pass over a finished object, and
  // saying so is the honest version: a live reader would slice this.
  const material = cultivateVoid([...text], text.length).join("");

  // ④⑤⑥ FIELD — the arena, established before anything is interpreted in it.
  const units = clearField(spec.units, { window: 1, hop: 1 });
  const adjacency = tendField(units.slice(0, 2));            // ⑤ CON
  const coverage = cultivateField(units, spec.units);        // ⑥ SYN
  if (!coverage.complete) return { gap: "arena_not_covered", coverage };

  const spaced = segmentsOnWhitespace(material);
  const docSeries = reduce(material, spaced, spec.units);
  if (!docSeries) return { gap: "no_material_after_reduction" };
  const counts = candidates(material, spaced);

  const eligible = [...counts.entries()]
    .filter(([, c]) => c >= spec.minOccurrences)
    .sort((a, b) => b[1] - a[1]);
  const kept = eligible.slice(0, spec.maxCandidates);
  const candidatesDropped = eligible.length - kept.length; // never silent

  const hay = spaced ? material.toLowerCase() : material;
  const clumped = [];
  const regular = [];
  for (const [surface, count] of kept) {
    const occ = occupancy(hay, surface, spec.units);
    const r = defOnCandidate(docSeries, occ, spec);
    if (r.verdict !== "clumped" && r.verdict !== "regular") continue;
    // Height is earned for BOTH censorings. Which one carries the cast is a
    // measurement, not a thing to assume — the first draft assumed `above` and
    // was wrong by exactly one sign.
    const h = earnHeight(docSeries, occ, spec);
    const row = { surface, count, extent: r.extent, reach: r.extent / spec.units, aperture: r.aperture, height: h.relation };
    (r.verdict === "clumped" ? clumped : regular).push(row);
  }

  // ⑨ REC · Atmosphere · Cultivating — the register that turn 2 would receive.
  // Only candidates whose height was EARNED as a level enter it.
  const register = regular
    .filter((c) => c.height === "above")
    .sort((a, b) => b.count - a.count);

  return {
    spec, spaced,
    arena: { units: units.length, coverage, contemporaryOf0: adjacency.get(0) ?? [] },
    candidatesConsidered: kept.length,
    candidatesDropped,
    clumped: clumped.length,
    regular: regular.length,
    // Kept in full, not just counted: the height gate below is the newest and
    // least-earned part of this chain, and pooling its input into a number
    // would make it impossible to tell a bad gate from a bad DEF.
    clumpedAll: clumped,
    regularAll: regular,
    // Heights are reported for the REGULAR (censored-below) bucket, because
    // that is where the cast turned out to live. Reporting them for `clumped`
    // while building the register from `regular` printed above=0 next to a
    // non-empty register for three books — the numbers described different
    // populations.
    heights: {
      above: regular.filter((c) => c.height === "above").length,
      peer: regular.filter((c) => c.height === "peer").length,
      unstable: regular.filter((c) => c.height === "unstable").length,
    },
    clumpedHeights: {
      above: clumped.filter((c) => c.height === "above").length,
      peer: clumped.filter((c) => c.height === "peer").length,
      unstable: clumped.filter((c) => c.height === "unstable").length,
    },
    register,
  };
};

// ── run ──────────────────────────────────────────────────────────────────────

// NOT `import.meta.url === "file://"+argv[1]` — this repo lives under a path
// with a space, so import.meta.url is percent-encoded and that compare is
// silently false forever.
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const book = args.includes("--book") ? args[args.indexOf("--book") + 1] : null;

  const MANIFEST = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
  mkdirSync(join(HERE, "discovered"), { recursive: true });

  for (const b of MANIFEST.books) {
    const tag = `${b.lang}-${b.pgId}`;
    if (only && b.lang !== only) continue;
    if (book && tag !== book) continue;
    const ids = [b.pgId, ...(b.companionIds ?? [])];
    const parts = ids
      .map((id) => join(HERE, "texts", `pg${id}.txt`))
      .filter(existsSync)
      .map((p) => body(readFileSync(p, "utf8")));
    if (!parts.length) { console.log(`${tag.padEnd(12)} GAP no_text`); continue; }

    const t0 = process.hrtime.bigint();
    const r = discoverCast(parts.join("\n"));
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;
    if (r.gap) { console.log(`${tag.padEnd(12)} GAP ${r.gap}`); continue; }

    writeFileSync(join(HERE, "discovered", `${tag}.discovered.json`), JSON.stringify(r, null, 2), "utf8");
    console.log(
      `${tag.padEnd(12)} ${r.spaced ? "spaced " : "ngram  "}` +
      `cand=${String(r.candidatesConsidered).padStart(4)} (+${r.candidatesDropped} dropped)  ` +
      `clumped=${String(r.clumped).padStart(4)} regular=${String(r.regular).padStart(3)}  ` +
      `above=${String(r.heights.above).padStart(4)} peer=${String(r.heights.peer).padStart(3)} unstable=${String(r.heights.unstable).padStart(4)}  ` +
      `${secs.toFixed(1)}s`,
    );
    console.log(`             top: ${r.register.slice(0, 8).map((x) => x.surface).join(" · ")}`);
  }
}

// scripts/score-cast-entities.mjs — does the Existence·Figure column
// (referents/entity.js) discover a closed cast by recurrence and consequence
// alone, on a text where no name-string heuristic can help?
//
// The golden: goldens/cast/cast/fi-11940.cast.json — Seitsemän veljestä, a
// closed cast of exactly 7 (the seven brothers), each name inflected across
// Finnish's 15 cases (Juhani / Juhanin / Juhania / Juhanille …). The material
// is the Project Gutenberg plaintext pinned in goldens/cast/texts/.
//
// What is scored is NOT a match rate against a name list. A string matcher
// would walk the inflections and hand the number back. This scores whether
// surface forms that recur with consequence get ADMITTED as beings — by the
// witness gate (born when its consequence recurs), not by spelling.
//
// Drive: the reading is chunked into reach-units (the causal reader never
// asks the material's extent). Every distinct word form witnessed in a unit
// is a candidate surface; admission is earned, refusals are results.
//
// Measured stability of the drive (recorded so it is not re-surveyed):
//   chunk=400 is stable at 7/7 across window ∈ {12,16,20} and draws
//   ∈ {96,128,192}. chunk=500 degrades to 6/7 at higher draws (Lauri's
//   surface stops carrying a pattern at coarser chunking). chunk=300 is
//   stable too. Admission is selective: of the ~2.1k surfaces that reach
//   minArrivals, ~95 are born. Known honest contamination: closed-class
//   surfaces (on, oli, se) are admitted — censored-below is a measurement
//   (Amendment II in referents/entity.js), and presence is claimed, never
//   ranking. The register is deliberately unranked (birth order only).
//
// Usage: node scripts/score-cast-entities.mjs [--book texts/pg11940.txt]
// Re-score after any engine change under referents/entity.js.

import { readFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join, resolve } from "path";
import {
  openReading, arrive, witnessArrival, offerCandidates, carryEntities, refusals,
} from "../packages/engine/referents/entity.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SPEC = Object.freeze({
  window: 16,
  draws: 128,
  reseeds: 32,
  minArrivals: 5,
  targetTokensPerUnit: 400,
});

const START_RE = /\*\*\* START OF THE PROJECT GUTENBERG EBOOK/;
const END_RE = /\*\*\* END OF THE PROJECT GUTENBERG EBOOK/;
const WORD_RE = /[\p{L}\p{M}]+/gu;

const bodyOf = (text) => {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => START_RE.test(l));
  const end = lines.findIndex((l) => END_RE.test(l));
  if (start === -1 || end === -1) throw new Error("could not find PG boilerplate markers");
  return lines.slice(start + 1, end).join("\n");
};

const tokenize = (text) => {
  const words = text.match(WORD_RE) ?? [];
  const units = [];
  let current = [];
  for (const w of words) {
    current.push(w);
    if (current.length >= SPEC.targetTokensPerUnit) {
      units.push(current);
      current = [];
    }
  }
  if (current.length) units.push(current);
  return units;
};

/**
 * Read pg11940.txt and open a reading over it — the raw state, before any
 * scoring. Shared by scoreCastEntities() and anything else that needs the
 * live arrivals/entities of this fixture (e.g. conformance/consequence.test.js,
 * which asks whether two DIFFERENT surfaces are one being by consequence).
 * `null` when the gitignored text has not been fetched.
 */
export function buildCastState() {
  const path = join(ROOT, "goldens/cast/texts/pg11940.txt");
  let book;
  try {
    book = readFileSync(path, "utf-8");
  } catch {
    return null;
  }
  const units = tokenize(bodyOf(book));

  // Letter-case is typography, not morphology: the novel's dialogue is
  // typeset in ALL CAPS, so JUHANI and Juhani are the same surface. Finnish
  // INFLECTION is meaning-bearing and is kept — Juhanin/Juhania are distinct
  // surfaces, which is exactly the fixture's point. This is the driver's
  // decision about what counts as a surface, not the engine's about identity.
  const state = openReading({ ...SPEC });
  for (const rawAtoms of units) {
    const atoms = rawAtoms.map((a) => a.toLowerCase());
    arrive(state, atoms);
    for (const surface of new Set(atoms)) witnessArrival(state, surface);
  }
  return { state, units };
}

export function scoreCastEntities({ quiet = false } = {}) {
  const line = (s) => { if (!quiet) console.log(s); };
  const built = buildCastState();
  if (!built) return { missing: join(ROOT, "goldens/cast/texts/pg11940.txt"), brothersFound: 0 };
  const { state, units } = built;
  const born = offerCandidates(state);
  const register = carryEntities(state);
  const refs = refusals(state);

  const BROTHERS = ["Juhani", "Tuomas", "Aapo", "Simeoni", "Timo", "Lauri", "Eero"];
  const perBrother = BROTHERS.map((b) => ({
    brother: b,
    surfaces: register.filter((e) => e.surfaces[0].startsWith(b.toLowerCase())).map((e) => e.surfaces[0]),
  }));
  const found = perBrother.filter((r) => r.surfaces.length > 0).length;

  const CLOSED_CLASS = new Set([
    "ja", "on", "oli", "oi", "ei", "en", "että", "kun", "kuin", "mutta", "vai", "jos", "niin", "se",
    "hän", "he", "minä", "sinä", "me", "te", "joka", "mikä", "kuka", "tämä", "tuo", "nämä", "noiden",
    "ole", "olla", "olisi", "olivat", "ollut", "ovat", "olleen", "eivät", "sillä", "koska", "vaikka",
    "jotta", "itse", "nyt", "jo", "vielä", "myös", "vain", "sitten", "niin", "siksi", "näin",
  ]);
  const closedClassAdmitted = register.filter((e) => CLOSED_CLASS.has(e.surfaces[0]));

  const r = {
    missing: false,
    units: units.length,
    tokens: units.reduce((s, u) => s + u.length, 0),
    born,
    candidatesOffered: state.arrivals.size,
    registerSize: register.length,
    refusals: refs.length,
    brothersFound: found,
    perBrother,
    closedClassAdmitted: closedClassAdmitted.map((e) => e.surfaces[0]),
    // Determinism net: the register as (surface, birth order) — enough to say
    // whether a second read of the same book gave the same beings.
    register: register.map((e) => ({ surface: e.surfaces[0], bornAt: e.bornAt })),
    elapsedMs: 0,
  };

  line(`units ${r.units}  tokens ${r.tokens}  candidates ${r.candidatesOffered}`);
  line(`born ${r.born}  register ${r.registerSize}  refused ${r.refusals}`);
  line(`closed-class admitted: ${r.closedClassAdmitted.length > 0 ? r.closedClassAdmitted.join(", ") : "(none)"}`);
  line(`brothers: ${r.brothersFound}/${BROTHERS.length}${quiet ? "" : ""}`);
  for (const p of perBrother) line(`  ${p.brother.padEnd(8)} → ${p.surfaces.length ? p.surfaces.join(", ") : "—"}`);
  if (!quiet) {
    line(`\nfirst 40 admitted:`);
    for (const e of register.slice(0, 40)) line(`  ${e.surfaces[0]}  censored=${e.censored}  aperture=${e.aperture.toFixed(3)}  moved=${e.moved}  censoredRank=${e.censoredRank}`);
    const gaps = new Map();
    for (const f of refs) gaps.set(f.why, (gaps.get(f.why) ?? 0) + 1);
    line(`\nrefusal reasons:`);
    for (const [g, c] of [...gaps.entries()].sort((a, b) => b[1] - a[1])) line(`  ${String(g).padEnd(24)} ${c}`);
  }
  return r;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const t0 = Date.now();
  const r = scoreCastEntities();
  console.error(`\n${(Date.now() - t0)} ms`);
  if (r.missing) process.exit(2);
  process.exit(r.brothersFound === 7 ? 0 : 1);
}

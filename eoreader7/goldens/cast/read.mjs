// eoreader6 · goldens/cast/read — a CAUSAL reading of each fixture book,
// scored against its frozen third-party cast.
//
// This replaces discover-cast.mjs, which was a batch pass: it built one
// frequency table over the whole document and computed occupancy over an
// arena that included unread pages, so every judgement it made was
// conditioned on the ending. That is an analysis of a finished object.
// `loops/turn.js` says of ③ INS that it is what "makes the read a READING
// rather than an analysis of a finished object", and a batch implementation
// of that operator is not a slower reader, it is a different thing wearing
// the name.
//
// Here the reader meets the book once, in order. `referents/entity.js` carries
// the state, and nothing in it can see forward.
//
// Usage: node goldens/cast/read.mjs [--book <tag>] [--only <lang>]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openReading, arrive, witnessArrival, offerCandidates, carryEntities } from "../../packages/engine/referents/entity.js";
import { isGap } from "../../nul/index.js";
import { stripPgBoilerplate } from "../shared/gutenberg.mjs";
import { bestMatch } from "../shared/fuzzy-match.mjs";
import { monteCarloChance } from "../shared/chance.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// Declared, never defaulted. `atomsPerUnit` is the grain of the reader's own
// clock — a "tick" is signal-from-noise local to this holon, never wall time.
const SPEC = Object.freeze({ window: 8, draws: 99, reseeds: 8, minArrivals: 6, atomsPerUnit: 200, offerEvery: 60 });

// Measured, not declared: Han text has whitespace, but its whitespace-delimited
// runs are whole clauses. Nothing here names a language.
const spacedScript = (text) => {
  const runs = text.split(/\s+/).filter(Boolean).slice(0, 20000);
  if (!runs.length) return true;
  return runs.reduce((s, r) => s + [...r].length, 0) / runs.length < 12;
};

/** The perceiver's reduction — the only script-aware step in the whole chain. */
const atomise = (text, spaced) =>
  spaced
    ? (text.toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) ?? [])
    : [...(text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? [])];

/** Candidate surfaces present in one reach-unit. Han names are 2-3 characters. */
const surfacesIn = (atoms, spaced) => {
  const out = new Set();
  if (spaced) {
    for (let i = 0; i < atoms.length; i++) {
      if (atoms[i].length >= 2) out.add(atoms[i]);
      if (i + 1 < atoms.length) out.add(`${atoms[i]} ${atoms[i + 1]}`);
    }
  } else {
    for (let i = 0; i + 1 < atoms.length; i++) {
      out.add(atoms[i] + atoms[i + 1]);
      if (i + 2 < atoms.length) out.add(atoms[i] + atoms[i + 1] + atoms[i + 2]);
    }
  }
  return out;
};

export const readBook = (text, spec = SPEC) => {
  const spaced = spacedScript(text);
  const atoms = atomise(text, spaced);
  const state = openReading(spec);
  if (isGap(state)) return state;

  for (let i = 0; i < atoms.length; i += spec.atomsPerUnit) {
    const unit = atoms.slice(i, i + spec.atomsPerUnit);
    arrive(state, unit);                                   // ③ INS · Ground
    for (const s of surfacesIn(unit, spaced)) witnessArrival(state, s);
    // The reader offers candidates to the birth condition at its own tempo.
    // Offering on every unit would be the same measurement repeated; offering
    // once at the end would make this a batch pass again.
    if (state.unit % spec.offerEvery === 0) offerCandidates(state);
  }
  offerCandidates(state);

  return { spaced, units: state.unit, atoms: atoms.length, candidates: state.arrivals.size, state };
};

// ── scoring against the frozen third-party cast ──────────────────────────────

const MISSING_PRIOR = {
  zh: "han_script_fold — reference is Simplified, material is Traditional",
  el: "greek_morphology — reference lists Attic lemmas, material is inflected",
  fi: "finnish_case_paradigm — 15 cases per name",
  hu: "hungarian_agglutination",
};

const score = (register, cast, lang, poolSize) => {
  const names = cast.entries.map((e) => e.name);
  // Best-scoring reference name per surface, not the first one that shares
  // any token — goldens/shared/fuzzy-match.mjs's own header names the bug
  // this replaced: `.find()` over a boolean matcher took whichever reference
  // entry happened to sit first in the cast list, not the closest match.
  const found = [];
  const hitNames = new Set();
  for (const e of register) {
    const hit = bestMatch(e.surfaces[0], names);
    if (hit) { found.push({ surface: e.surfaces[0], ref: hit }); hitNames.add(hit); }
  }

  // Chance baseline: draw |register| surfaces at random from the same candidate
  // pool and count hits. Without this a recall number is uninterpretable —
  // eoreader5's span-golden reported 5/21 for a year with no baseline attached,
  // and 5/21 turns out to sit at roughly the 95th percentile of chance.
  const chance = monteCarloChance({ trials: 400, drawSize: register.length, hitProb: names.length / Math.max(poolSize, 1) });

  return {
    registerSize: register.length,
    referenceSize: names.length,
    recall: hitNames.size,
    recallOf: `${hitNames.size}/${names.length}`,
    precision: register.length ? found.length / register.length : 0,
    chance,
    found: found.slice(0, 20),
    missingPrior: MISSING_PRIOR[lang] ?? null,
  };
};

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const book = args.includes("--book") ? args[args.indexOf("--book") + 1] : null;

  const MANIFEST = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
  mkdirSync(join(HERE, "read"), { recursive: true });

  for (const b of MANIFEST.books) {
    const tag = `${b.lang}-${b.pgId}`;
    if (only && b.lang !== only) continue;
    if (book && tag !== book) continue;

    const ids = [b.pgId, ...(b.companionIds ?? [])];
    const parts = ids.map((id) => join(HERE, "texts", `pg${id}.txt`)).filter(existsSync).map((p) => stripPgBoilerplate(readFileSync(p, "utf8")));
    if (!parts.length) { console.log(`${tag.padEnd(12)} GAP no_text`); continue; }

    const castPath = join(HERE, "cast", `${tag}.cast.json`);
    if (!existsSync(castPath)) { console.log(`${tag.padEnd(12)} GAP no_cast — run extract-cast.mjs`); continue; }
    const cast = JSON.parse(readFileSync(castPath, "utf8"));

    const t0 = process.hrtime.bigint();
    const r = readBook(parts.join("\n"));
    if (isGap(r)) { console.log(`${tag.padEnd(12)} GAP ${r.gap}`); continue; }
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;

    const register = carryEntities(r.state);
    const s = score(register, cast, b.lang, r.candidates);

    writeFileSync(
      join(HERE, "read", `${tag}.read.json`),
      JSON.stringify({ tag, spec: SPEC, units: r.units, candidates: r.candidates, score: s, register: register.slice(0, 60) }, null, 2),
      "utf8",
    );

    console.log(
      `${tag.padEnd(12)} units=${String(r.units).padStart(4)} cand=${String(r.candidates).padStart(6)}  ` +
      `born=${String(register.length).padStart(4)}  recall=${s.recallOf.padStart(7)}  ` +
      `chance(p95=${s.chance.p95}, max=${s.chance.max})  ${secs.toFixed(1)}s`,
    );
    if (s.found.length) console.log(`             hits: ${s.found.slice(0, 8).map((f) => f.surface).join(" · ")}`);
  }
}

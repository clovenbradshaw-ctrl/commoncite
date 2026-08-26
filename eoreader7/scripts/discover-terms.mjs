// eoreader6 · discover-terms — WHAT DOES THIS TEXT HOLD BEINGS ABOUT?
//
// A probe, written to settle one question by measurement rather than by
// argument: does the canonical birth condition (referents/entity.js) admit a
// philosophical corpus's load-bearing terms — soul, freedom, divinity — when
// it is pointed at the text's own content tokens instead of at capitalised
// runs?
//
// WHY THIS EXISTS AT ALL. perceiver/text/surfaces.js discovers candidate
// referent surfaces from capitalised RUNS, skipping the sentence-initial
// token, filtered by a cap/lower ratio. That is a NAME detector and it says so.
// It is right for Frankenstein and War and Peace, and it is blind on Whitehead
// and Vivekananda, where every load-bearing referent is a lowercase common
// noun. Blind in the strong sense: `soul` cannot be a candidate there, because
// no filter it could pass is ever applied to it.
//
// Nothing new is invented here. `entity.js` already states that the birth
// condition "asks nothing about a surface's name, only about the shape its
// arrivals make", and `consequence.js` already calls it on raw arrival sets.
// The organ was always name-agnostic; only its MOUTH was capitalised. So this
// hands it a different mouth and reports what it does — no new statistic, no
// new threshold, no word list.
//
// The reach-unit is the SENTENCE, the perceiver's own unit. No 40-word chunks
// and no regions: a chunk boundary is an artefact of the reader's arithmetic,
// and a being's arrivals must be counted in units the text actually has.
//
// Candidate = a token that is not closed-class by this text's OWN frequency
// distribution (material.js::functionWordSet, Zipf-derived, no stopword list).

import { readFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../packages/engine/perceiver/text/material.js";
import { openReading, arrive, witnessArrival, admitEntity } from "../packages/engine/referents/entity.js";
import { isGap } from "../nul/index.js";

// ── declared, never defaulted ───────────────────────────────────────────────
const WINDOW = 12;        // reach of the present, in sentences
const DRAWS = 200;        // resolution of testimony
const RESEEDS = 16;       // resolution of pattern
const MIN_ARRIVALS = 8;   // a being seen fewer times than this has no second half to answer with

const TEXT_PATH = process.argv[2] || "scripts/corpus/raw/vivekananda/complete-works.txt";
const FRACTION = Number(process.argv[3] || "1");
const LANG_PRIOR = "bin/priors/lang/en.json";

const raw = readFileSync(TEXT_PATH, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const { text: whole } = stripContainer(raw);
const text = FRACTION >= 1 ? whole : whole.slice(0, Math.floor(whole.length * FRACTION));

const en = JSON.parse(readFileSync(LANG_PRIOR, "utf8"));
const sentences = splitSentences(text, { abbreviations: en.abbreviations });

const table = buildFrequencyTable(tokenize(text));
const closed = functionWordSet(table);

const state = openReading({ window: WINDOW, draws: DRAWS, reseeds: RESEEDS, minArrivals: MIN_ARRIVALS });
if (isGap(state)) { console.error(state); process.exit(1); }

for (const s of sentences) {
  const atoms = tokenize(s.text);
  if (!atoms.length) continue;
  arrive(state, atoms);
  const distinct = new Set(atoms);
  for (const a of distinct) {
    if (closed.has(a)) continue;   // closed-class by this text's own statistics
    if (a.length < 3) continue;    // below the material's own token-length floor
    witnessArrival(state, a);
  }
}

const candidates = [...state.arrivals.entries()]
  .filter(([, at]) => at.length >= MIN_ARRIVALS)
  .sort((a, b) => b[1].length - a[1].length);

console.log(`${sentences.length} sentences read · ${state.arrivals.size} candidate surfaces · ${candidates.length} with >= ${MIN_ARRIVALS} arrivals`);
console.log(`declared: window ${WINDOW}, draws ${DRAWS}, reseeds ${RESEEDS}, minArrivals ${MIN_ARRIVALS}\n`);

const admitted = [];
const refused = new Map();
for (const [surface] of candidates) {
  const r = admitEntity(state, surface);
  if (r.admitted) admitted.push({ surface, arrivals: state.arrivals.get(surface).length, ...r.entity });
  else {
    // A gap is a result: report the TYPE, and the stated reason where the gap
    // carries one, rather than collapsing every refusal into one bucket.
    const g = r.why;
    const why = isGap(g) ? `${g.gap}${g.reason ? ` — ${g.reason}` : ""}` : String(g ?? "unstated");
    refused.set(why, (refused.get(why) ?? 0) + 1);
  }
}

console.log(`ADMITTED ${admitted.length} of ${candidates.length} candidates by the birth condition\n`);
for (const [why, n] of [...refused.entries()].sort((a, b) => b[1] - a[1])) console.log(`  refused ${String(n).padStart(6)}  ${why}`);

console.log(`\nadmitted, in birth order (the register the next turn receives):\n`);
for (const e of admitted) console.log(`  ${e.id.padEnd(6)} ${e.surface.padEnd(22)} ${String(e.arrivals).padStart(6)} arrivals`);

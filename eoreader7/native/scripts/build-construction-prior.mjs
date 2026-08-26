// eoreader7 · build-construction-prior — Universal Dependencies CoNLL-U in,
// ConstructionPrior@1 out: the CONDITIONING LEVEL the form-level POS prior
// reads past.
//
// WHY THIS EXISTS, stated precisely so the existing prior is not maligned.
// scripts/build-pos-prior.mjs (eoreader6.1) is faithful to its own stated
// discipline — "AMBIGUITY IS PRESERVED, NEVER RESOLVED... a form keeps every
// UPOS tag the treebank ever gave it, with real counts, never collapsed to
// one majority verdict here." That is right, and this file does not change
// it. The gap is not that the superposition was destroyed. It is that the
// VARIABLE THAT WOULD COLLAPSE IT was not kept: CoNLL-U's columns are
// ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL DEPS MISC, and the form-level
// prior keeps `form -> {UPOS: count}` alone. So `had` is held, correctly, as
// {AUX: 154, VERB: 335} — and nothing downstream has anything to collapse it
// WITH, which is how a consumer ends up collapsing it globally with one `>`
// (measured: native/eval/results/being-superposition-RESULTS.md).
//
// WHAT IS KEPT, AND WHY IT IS OBSERVABLE AT READ TIME. HEAD and DEPREL are
// the treebank's own answer, but they are a PARSE — unavailable when reading
// raw prose, so a prior keyed on them could never be consulted. What IS
// observable in raw text is the local frame, so this prior conditions a
// form's tag distribution on the DOMINANT CLASS OF THE FOLLOWING TOKEN,
// itself read from the form-level tally. That is enough for the distinction
// that broke the gate: "had been" (next token dominantly AUX) against "had
// sufficient" (next token dominantly ADJ) — auxiliaryhood is constructional,
// not lexical, and the construction's observable trace is what follows.
//
// SCOPED TO WHERE THERE IS SOMETHING TO COLLAPSE. The conditional layer is
// built ONLY for forms the treebank tags with more than one class. An
// unambiguous form has no superposition to collapse and would only inflate
// the file. This is a declared scope, not a coverage claim.
//
// THE FLOOR IS DECLARED AND CITED. A (form, nextClass) cell is kept only at
// >= MIN_OBSERVATIONS. One observation is not a distribution; 2 is the same
// structural minimum emergence/binding.js already uses for co-arrival ("one
// arrival has no co-arrival to test"), reused rather than re-derived.
//
// This is NOT a tagger and nothing here runs inference on our text — the
// same standing build-pos-prior.mjs states. It tallies a human-annotated
// gold treebank and never sees our documents at build time.
//
// SOURCE, FETCHED SEPARATELY (no ambient network I/O in a data-transform
// script — build-pos-prior.mjs's own discipline):
//   curl -sSL -o en_ewt-ud-train.conllu \
//     https://raw.githubusercontent.com/UniversalDependencies/UD_English-EWT/master/en_ewt-ud-train.conllu
// UD_English-EWT is CC BY-SA 4.0 — attribution required, recorded in the
// output's provenance. No treebank sentence text is embedded, only aggregate
// counts.
//
// Usage: node native/scripts/build-construction-prior.mjs <in.conllu> <out.json>

import { readFileSync, writeFileSync } from "node:fs";

const IN = process.argv[2] ?? "en_ewt-ud-train.conllu";
const OUT = process.argv[3] ?? "native/priors/construction-eng.json";
const MIN_OBSERVATIONS = 2; // cited: binding.js's structural minimum — one observation is not a distribution
const SENTENCE_END = "END"; // a token ending its sentence has no follower; that IS a frame, not a missing value
const TAB = String.fromCharCode(9);

const raw = readFileSync(IN, "utf8");

// pass 0: read the treebank into sentences of (form, upos)
const sentences = [];
let current = [];
for (const line of raw.split("\n")) {
  if (line.startsWith("#")) continue;
  if (line.trim() === "") { if (current.length) sentences.push(current); current = []; continue; }
  const cols = line.split(TAB);
  if (cols.length < 4) continue;
  if (!/^[0-9]+$/.test(cols[0])) continue; // skip multi-word ranges (3-4) and empty nodes (3.1)
  current.push({ form: cols[1].toLowerCase(), upos: cols[3] });
}
if (current.length) sentences.push(current);

// pass 1: the form-level tally — the backoff level, and the next-token class
const forms = new Map();
for (const s of sentences) {
  for (const t of s) {
    if (!forms.has(t.form)) forms.set(t.form, {});
    const row = forms.get(t.form);
    row[t.upos] = (row[t.upos] ?? 0) + 1;
  }
}
const dominant = new Map();
for (const [form, row] of forms) dominant.set(form, Object.entries(row).sort((a, b) => b[1] - a[1])[0][0]);
const ambiguous = new Set([...forms].filter(([, row]) => Object.keys(row).length > 1).map(([f]) => f));

// pass 2: condition an ambiguous form's tag on the following token's class
const conditional = new Map();
for (const s of sentences) {
  for (let i = 0; i < s.length; i += 1) {
    const t = s[i];
    if (!ambiguous.has(t.form)) continue; // nothing to collapse
    const next = s[i + 1];
    const nextClass = next ? (dominant.get(next.form) ?? "UNK") : SENTENCE_END;
    if (!conditional.has(t.form)) conditional.set(t.form, new Map());
    const byNext = conditional.get(t.form);
    if (!byNext.has(nextClass)) byNext.set(nextClass, {});
    const row = byNext.get(nextClass);
    row[t.upos] = (row[t.upos] ?? 0) + 1;
  }
}

// emit, keeping only cells that clear the declared floor
const out = {};
let cells = 0;
let dropped = 0;
for (const [form, byNext] of conditional) {
  const kept = {};
  for (const [nextClass, row] of byNext) {
    const total = Object.values(row).reduce((a, b) => a + b, 0);
    if (total < MIN_OBSERVATIONS) { dropped += 1; continue; }
    kept[nextClass] = row;
    cells += 1;
  }
  if (Object.keys(kept).length) out[form] = kept;
}

writeFileSync(OUT, JSON.stringify({
  schema: "ConstructionPrior@1",
  language: "en",
  provenance: {
    giver: "Universal Dependencies — UD_English-EWT (train split), human-annotated gold treebank",
    license: "CC BY-SA 4.0",
    source: "https://raw.githubusercontent.com/UniversalDependencies/UD_English-EWT/master/en_ewt-ud-train.conllu",
    builder: "eoreader7 native/scripts/build-construction-prior.mjs",
    basis: "a form's UPOS distribution CONDITIONED on the dominant class of the following token — the observable trace of the construction, since HEAD/DEPREL are a parse and unavailable when reading raw prose",
    dropped: "the source carries LEMMA, XPOS, FEATS, HEAD, DEPREL, DEPS, MISC per token; this output keeps none of them — in particular HEAD/DEPREL (the parse) and FEATS (e.g. VerbForm=Part) are cut here, and any downstream absence of them is this cut, not the treebank's ignorance (READING-SPEC S10)",
  },
  declared: {
    MIN_OBSERVATIONS,
    scope: "ambiguous forms only — a form the treebank tags with one class has no superposition to collapse",
    backoff: "consult form|nextClass; short of the floor, fall back to the form-level POSPrior@1; short of that, a typed gap — never a guess",
    sentenceEndFrame: SENTENCE_END,
  },
  stats: {
    treebankSentences: sentences.length,
    formsSeen: forms.size,
    ambiguousForms: ambiguous.size,
    conditionedForms: Object.keys(out).length,
    cellsKept: cells,
    cellsBelowFloor: dropped,
  },
  forms: out,
}));

console.error("sentences " + sentences.length + " · forms " + forms.size + " · ambiguous " + ambiguous.size + " · conditioned " + Object.keys(out).length + " · cells " + cells + " (dropped " + dropped + " below floor " + MIN_OBSERVATIONS + ") -> " + OUT);

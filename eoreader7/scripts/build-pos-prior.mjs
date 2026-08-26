// eoreader6 · build-pos-prior — Universal Dependencies CoNLL-U in,
// POSPrior@1 out.
//
// Usage: node scripts/build-pos-prior.mjs [conllu-file] [out.json]
//
// This is NOT a tagger, and nothing here runs inference on new text. It
// tallies a real, human-annotated gold treebank's own POS tags per word
// form — a lookup table built once from witness-tier data, the same
// standing perceiver/text/morphology.js's UniMorph-derived
// MorphologyPrior@1 already holds ("external witness-tier data... injected
// as a prior, never computed"). Running a trained statistical tagger on
// OUR documents would be the thing explicitly ruled out this session; this
// is closer kin to a dictionary than a model — it never sees our text at
// build time, only the treebank's.
//
// AMBIGUITY IS PRESERVED, NEVER RESOLVED, same discipline
// perceiver/text/morphology.js already states for lemmas: a form keeps
// every UPOS tag the treebank ever gave it, with real counts, never
// collapsed to one majority verdict here. Collapsing happens later, per
// self-discovered CLUSTER, in scripts/experiments/pos-merge-check.mjs —
// never baked into the prior itself, for the same reason a dictionary
// entry for "record" lists both the noun and the verb sense rather than
// picking one.
//
// SOURCE, FETCHED SEPARATELY. This script transforms an already-downloaded
// file; it does not fetch one itself (same purity discipline
// build-morphology-prior.mjs already follows — no ambient network I/O in a
// data-transform script). Obtain the input with:
//   curl -sSL -o en_ewt-ud-train.conllu \
//     https://raw.githubusercontent.com/UniversalDependencies/UD_English-EWT/master/en_ewt-ud-train.conllu
// Universal Dependencies UD_English-EWT is licensed CC BY-SA 4.0 —
// attribution required, recorded in this output's own provenance below.
// No treebank sentence text is embedded in the output, only aggregate
// per-form tag counts.
//
// CoNLL-U columns: ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL DEPS MISC.
// Comment lines start with "#"; multi-word-token range lines ("3-4") and
// empty-node lines ("3.1") are skipped — only real, single-token ID lines
// (a bare integer) are tallied, so a contraction like "don't" contributes
// its two real sub-token tags ("do" AUX, "not" PART) rather than the
// surface span's own un-tagged range line.

import { readFileSync, writeFileSync } from "node:fs";

const IN = process.argv[2] ?? "en_ewt-ud-train.conllu";
const OUT = process.argv[3] ?? "scripts/corpus/pos-eng.json";

const raw = readFileSync(IN, "utf8");
const forms = new Map(); // lowercased form -> { UPOS: count }
let tokensRead = 0;
let linesSkipped = 0;

for (const line of raw.split("\n")) {
  if (!line || line[0] === "#") { continue; }
  const cols = line.split("\t");
  if (cols.length !== 10) { linesSkipped++; continue; }
  const [id, form, , upos] = cols;
  if (!/^\d+$/.test(id)) { linesSkipped++; continue; } // range/empty-node line, not a real token
  if (!form || !upos || upos === "_") { linesSkipped++; continue; }
  const f = form.toLowerCase();
  if (!forms.has(f)) forms.set(f, {});
  forms.get(f)[upos] = (forms.get(f)[upos] ?? 0) + 1;
  tokensRead++;
}

const prior = {
  schema: "POSPrior@1",
  language: "eng",
  provenance: {
    source: "Universal Dependencies UD_English-EWT",
    url: "https://github.com/UniversalDependencies/UD_English-EWT",
    license: "CC BY-SA 4.0",
    built_by: "scripts/build-pos-prior.mjs",
    input: IN,
    tokens_read: tokensRead,
    lines_skipped: linesSkipped,
    forms_kept: forms.size,
    note: "tag counts only, ambiguity preserved — no treebank sentence text embedded",
  },
  forms: Object.fromEntries(forms),
};

writeFileSync(OUT, JSON.stringify(prior));
console.log(
  `read ${tokensRead.toLocaleString()} real tokens (${linesSkipped.toLocaleString()} comment/range/empty lines skipped)\n` +
    `kept ${forms.size.toLocaleString()} distinct word forms -> ${OUT}`,
);

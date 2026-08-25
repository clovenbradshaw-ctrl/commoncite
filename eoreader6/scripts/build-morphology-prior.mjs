// eoreader6 · build-morphology-prior — UniMorph TSV in, MorphologyPrior@1 out.
//
// Usage: node scripts/build-morphology-prior.mjs [eng.tsv] [out.json]
//
// UniMorph is WITNESS-TIER. It is an external fact about English, not
// derivable from any text being read, so it arrives as a prior and names its
// giver — and this script's only job is to get it into the shape
// `perceiver/text/morphology.js` already expects, without deciding anything.
//
// ONLY THE IRREGULAR TAIL IS KEPT, and that is not a size optimisation. That
// module's `stemsOf` already recovers every regular inflection by rule, and
// its header records what happens when the table competes with the rule
// instead of complementing it: `heard -> hea`, `found -> foind`, because
// UniMorph carries dialectal verbs and a shortest-lemma tiebreak reliably
// picks the dialect form over the word on the page. So a pair is kept only
// when the rule CANNOT already recover it. The table is the exception list;
// the rule is the law.
//
// Nothing here picks a lemma. A form keeps every lemma UniMorph gives it,
// because inflection is genuinely ambiguous — "saw" is the past of `see` AND
// the lemma of `saw`, to cut — and the ambiguity is preserved, never resolved.

import { readFileSync, writeFileSync } from "node:fs";

const IN = process.argv[2] ?? "scripts/corpus/eng.txt";
const OUT = process.argv[3] ?? "scripts/corpus/morphology-eng.json";

// The regular English suffixes, mirrored from perceiver/text/morphology.js.
// Duplicated deliberately rather than imported: this is a BUILD-time claim
// about what the rule can recover, and if the two ever drift the right
// failure is a prior that carries a few redundant pairs, not a build that
// silently reshapes itself when the reader's rule changes.
const stemsOf = (w) => {
  const out = new Set();
  const add = (s) => { if (s && s.length > 1) out.add(s); };
  if (w.endsWith("ies")) add(w.slice(0, -3) + "y");
  if (w.endsWith("ied")) add(w.slice(0, -3) + "y");
  if (w.endsWith("ing")) { add(w.slice(0, -3)); add(w.slice(0, -3) + "e"); }
  if (w.endsWith("es")) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith("ed")) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith("s") && !w.endsWith("ss")) add(w.slice(0, -1));
  for (const s of [...out]) if (/(.)\1$/.test(s)) add(s.slice(0, -1));
  return out;
};

const raw = readFileSync(IN, "utf8");
const forms = new Map();
let pairs = 0;
let ruleRecoverable = 0;

for (const line of raw.split("\n")) {
  if (!line || line[0] === "#") continue;
  const [lemma, form] = line.split("\t");
  if (!lemma || !form) continue;
  const l = lemma.toLowerCase();
  const f = form.toLowerCase();
  if (!l || !f || l === f) continue;
  pairs++;
  if (stemsOf(f).has(l)) {
    ruleRecoverable++;
    continue; // the rule already gets this one
  }
  if (!forms.has(f)) forms.set(f, new Set());
  forms.get(f).add(l);
}

const prior = {
  schema: "MorphologyPrior@1",
  language: "eng",
  provenance: {
    source: "UniMorph English (github.com/unimorph/eng)",
    built_by: "scripts/build-morphology-prior.mjs",
    input: IN,
    pairs_read: pairs,
    rule_recoverable_dropped: ruleRecoverable,
    kept: forms.size,
    note: "the irregular tail only; regular inflections are recovered by stemsOf at read time",
  },
  forms: Object.fromEntries([...forms].map(([f, ls]) => [f, [...ls].sort()])),
  irregular: true,
};

writeFileSync(OUT, JSON.stringify(prior));
console.log(
  `read ${pairs.toLocaleString()} lemma/form pairs\n` +
    `dropped ${ruleRecoverable.toLocaleString()} the suffix rule already recovers\n` +
    `kept ${forms.size.toLocaleString()} irregular forms -> ${OUT}`,
);

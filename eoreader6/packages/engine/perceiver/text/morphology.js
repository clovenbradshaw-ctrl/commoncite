// eoreader6 · perceiver/text/morphology — inflected form → lemma, from UniMorph.
//
// Ported from eoreader5's packages/def/morphology.js, which had already
// earned the two decisions I got wrong building this from scratch:
//
//   1. NEVER PICK A LEMMA. Ask whether two forms are the SAME ACT — i.e.
//      whether their lemma sets intersect. Inflection is genuinely ambiguous
//      ("saw" is the past of `see` AND the lemma of `saw`, to cut), and the
//      prior's own provenance says the ambiguity is preserved, not resolved.
//      My first attempt broke the tie by shortest lemma and produced
//      `heard -> hea'`, `found -> foind`, `seemed -> seeme`: UniMorph carries
//      dialectal verbs, so the tiebreak reliably picked the dialect form over
//      the word actually on the page.
//
//   2. THE SUFFIX RULE IS PART OF THE LOOKUP, NOT AN ALTERNATIVE TO IT. The
//      table holds only the IRREGULAR tail; regular forms were dropped when
//      the prior was built because a rule already recovers them. So candidates
//      are the table's lemmas UNION the rule's stem, always. My first attempt
//      early-returned on a table hit and required the rule's stem to already
//      be a known lemma — which excludes every fully-regular verb (`seem`,
//      `appear`, `fear` are absent from the table by construction), so the
//      sets never intersected and lemmatisation collapsed exactly 0 of 568
//      edges on Frankenstein.
//
// UniMorph is WITNESS-TIER: an external fact about a language, not derivable
// from the text being read. Injected as a prior, never computed. Missing
// prior ⇒ typed gap and a documented fallback, never a silent guess.

import { readFileSync } from "node:fs";

// The regular English suffixes the prior's build dropped as rule-recoverable.
const stemsOf = (w) => {
  const out = new Set();
  const add = (s) => { if (s && s.length > 1) out.add(s); };
  if (w.endsWith("ies")) { add(w.slice(0, -3) + "y"); }
  if (w.endsWith("ied")) { add(w.slice(0, -3) + "y"); }
  if (w.endsWith("ing")) { add(w.slice(0, -3)); add(w.slice(0, -3) + "e"); }
  if (w.endsWith("es")) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith("ed")) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith("s") && !w.endsWith("ss")) { add(w.slice(0, -1)); }
  // doubled consonant: stopped -> stop, running -> run
  for (const s of [...out]) if (/(.)\1$/.test(s)) add(s.slice(0, -1));
  return out;
};

export const loadMorphology = (path) => {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (raw.schema !== "MorphologyPrior@1") throw new TypeError(`loadMorphology: unknown schema ${raw.schema}`);
  if (!raw.provenance?.source) throw new TypeError("loadMorphology: a prior must name its giver");
  return { language: raw.language, giver: raw.provenance.source, forms: raw.forms, irregular: raw.irregular };
};

/**
 * createLemmatizer(index) -> { lemmasOf, sameAct, size, gap }
 *
 * Absent index ⇒ every lookup reports a gap and `sameAct` falls back to the
 * caller's comparator, so a missing prior degrades LOUDLY to the previous
 * behaviour rather than silently changing answers.
 */
export const createLemmatizer = (index, { fallback = null } = {}) => {
  const map = new Map();
  if (index instanceof Map) for (const [k, v] of index) map.set(k, new Set(v));
  else if (index && typeof index === "object") for (const [k, v] of Object.entries(index)) map.set(k, new Set(v));

  const gap = map.size === 0
    ? { reason: "no_morphology_prior", tier: "model", needsWitness: true,
        detail: "irregular inflections (lay/lie, went/go, saw/see) will not be recognised" }
    : null;

  // Candidates are the table's lemmas AND the rule's stem — union, always.
  const lemmasOf = (form) => {
    const w = String(form || "").toLowerCase();
    const out = new Set();
    if (w) out.add(w);
    for (const l of map.get(w) ?? []) out.add(l);
    for (const s of stemsOf(w)) out.add(s);
    return out;
  };

  const sameAct = (a, b) => {
    const x = String(a || "").toLowerCase();
    const y = String(b || "").toLowerCase();
    if (x && x === y) return true;
    if (map.size === 0) return fallback ? fallback(x, y) : x === y;
    const la = lemmasOf(x);
    for (const l of lemmasOf(y)) if (la.has(l)) return true;
    return false;
  };

  return { lemmasOf, sameAct, size: map.size, gap };
};

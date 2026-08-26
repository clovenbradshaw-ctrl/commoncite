// eoreader6 · perceiver/text/proper — which forms are names, in THIS modality.
//
// The existence gate in `generation/belief.js` needs to know which forms are
// referents, and deliberately does not decide it: naming is medium-specific.
// In prose a name is marked orthographically; in a spreadsheet it is an id
// column; in turbulence data there are no names at all and the gate correctly
// does nothing. So the belief takes a predicate and this supplies one for
// text, exactly the split every perceiver in this repo already uses.
//
// THE SIGNAL IS MID-SENTENCE CAPITALISATION, and its limits are the honest
// part. A form capitalised at the start of a sentence tells you nothing —
// every word is. A form capitalised in the MIDDLE of one is being marked as a
// name by the writing system itself. So only mid-sentence positions are
// counted, and the test is whether the form is capitalised in most of them.
//
// `EMBEDDING-FINDINGS.md` reports that capitalisation is NOT the mechanism
// behind the referent-capable class — lowercasing War and Peace left the names
// leading anyway. That result is about explanation and this is about
// detection, and the two do not conflict: the finding says names would still
// be findable without case, not that case fails to mark them. Using it here
// costs nothing and needs no model. What it does cost is generality, which is
// why this lives in a text perceiver and is named for what it actually is.
//
// KNOWN FAILURES, stated rather than tuned away:
//   - "I" in English is capitalised everywhere and is not a name. It is
//     excluded by hand, and that exclusion is a language fact like any other.
//   - A common noun that happens to open many clauses mid-sentence after a
//     colon or a quotation mark can be miscounted. The majority rule absorbs
//     most of it.
//   - German capitalises every noun, so this predicate is worthless there and
//     must not be reused without measurement. The language is a parameter of
//     the detector, not of the gate.
//
// Pure: no clock, no randomness, no I/O.

import { NEVER_A_NAME } from "./priors.js";

const WORD = /[\p{L}\p{N}']+/gu;

/**
 * Forms this text marks as names, as a lowercase Set.
 *
 * `text` must be the ORIGINAL-CASE text. Handing this a lowercased string
 * returns an empty set rather than throwing, because "no names found" and "you
 * destroyed the evidence" look identical from in here — so the count of
 * mid-sentence observations is returned alongside, and a caller that sees
 * plenty of observations and no names has been told what happened.
 */
export const properNounsOf = (text, { minObservations = 2 } = {}) => {
  if (typeof text !== "string") throw new TypeError("proper: text is required");

  const capitalised = new Map();
  const total = new Map();
  let observations = 0;

  // A position is "mid-sentence" if the last non-space character before it was
  // not a sentence-ending mark. Cheap, and wrong only around abbreviations,
  // which `spans.js` handles properly for the cases that matter there.
  let atSentenceStart = true;
  let index = 0;
  for (const match of text.matchAll(WORD)) {
    const form = match[0];
    const before = text.slice(index, match.index);
    if (/[.!?]\s*["')\]]?\s*$/.test(before) || /\n\s*\n\s*$/.test(before)) atSentenceStart = true;
    index = match.index + form.length;

    const lower = form.toLowerCase();
    if (!atSentenceStart) {
      observations++;
      total.set(lower, (total.get(lower) ?? 0) + 1);
      if (/^\p{Lu}/u.test(form)) capitalised.set(lower, (capitalised.get(lower) ?? 0) + 1);
    }
    atSentenceStart = false;
  }

  const names = new Set();
  for (const [form, seen] of total) {
    if (NEVER_A_NAME.has(form)) continue;
    if (seen < minObservations) continue;
    if ((capitalised.get(form) ?? 0) * 2 > seen) names.add(form);
  }

  return { names, observations, vocabulary: total.size };
};

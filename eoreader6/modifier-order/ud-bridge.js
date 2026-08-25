// eoreader6 · modifier-order/ud-bridge — empirically checks a received
// typological claim (e.g. from ./wals.js) against a corpus's own attested
// modifier stacks.
//
// Deliberately NOT built on ../temporality/index.js (via ./index.js's
// corpusDirectionTest): that organ answers a different question — is there
// load-bearing SEQUENTIAL structure across the positions of ONE long
// numeric series, tested by shuffle-sensitivity — not "across N independent
// sentences, is the higher-rank modifier placed farther from the head more
// often than a coin flip would predict." Both are "order" in English, but
// not the same statistical claim, and reusing a shuffle-sensitivity test
// for a question it was never measured to answer is exactly the error
// SEED.md's "a statistic must be sensitive to what its perturbation
// destroys" warns against. The right tool for "is this pattern more common
// than chance across N independent trials" is a frequency count against a
// binomial null — which is what this module does instead, reusing
// ./index.js's own `order()` judgments rather than inventing a parallel
// path (II.7, the convergence test).
//
// UD relation labels are documented in: de Marneffe, Marie-Catherine, et
// al. 2021. "Universal Dependencies." Computational Linguistics 47(2).
// universaldependencies.org. `amod`, `nummod`, `det` are real UD relations;
// UD_RELATION_TO_CLASS is a received (not invented) mapping from them onto
// the same class vocabulary a typology's `ranks` table uses.
//
// This module does not parse treebank files — extracting per-sentence
// dependent lists from a .conllu file is the caller's job, upstream, the
// same seam packages/engine/emergence/graph.js documents ("a video
// perceiver supplying its own triples would not change a line").

import { gap, isGap } from "../nul/index.js";
import { order } from "./index.js";

export const UD_RELATION_TO_CLASS = Object.freeze({
  det: "demonstrative",
  nummod: "numeral",
  amod: "adjective",
});

/**
 * `sentences`: array of arrays of `{ relation, surface }` tags for one
 * head's dependents in one sentence, in the language's own attested reading
 * order. A sentence contributes nothing (never guessed) if it has fewer
 * than two relations this typology can rank, or if `order()` itself gaps on
 * it (an unranked class slipping through the UD mapping).
 *
 * Returns an array of "nested"/"inverted" verdicts, one per contributing
 * sentence — never the sentences themselves, so a caller cannot mistake a
 * judgment count for a claim about the corpus's raw content.
 */
export const judgeSentences = (sentences, typology) => {
  if (!Array.isArray(sentences) || sentences.length === 0)
    return gap("empty_material", { sentences });

  const judged = [];
  for (const sentence of sentences) {
    const tags = sentence
      .filter((dep) => dep.relation in UD_RELATION_TO_CLASS)
      .map((dep) => ({ class: UD_RELATION_TO_CLASS[dep.relation], surface: dep.surface }));
    if (tags.length < 2) continue;
    const verdict = order(tags, typology);
    if (isGap(verdict)) continue;
    judged.push(verdict.relation);
  }
  if (judged.length === 0)
    return gap("unknown_spec", { reason: "no sentence contributed two or more ranked, mapped modifiers" });
  return Object.freeze(judged);
};

// Exact one-sided binomial upper-tail probability, P(at least `k`
// successes in `n` flips | p=0.5) — computed directly (log-space to avoid
// overflow), never approximated. n here is a corpus's sentence count for
// one head, not a whole treebank, so the direct sum is cheap.
const binomialUpperTail = (k, n) => {
  const logChoose = (n, r) => {
    let lg = 0;
    for (let i = 0; i < r; i++) lg += Math.log(n - i) - Math.log(i + 1);
    return lg;
  };
  let p = 0;
  for (let s = k; s <= n; s++) p += Math.exp(logChoose(n, s) - n * Math.LN2);
  return Math.min(1, p);
};

/**
 * The cross-check. Tests the null "no real ordering preference, 50/50"
 * against the fraction of sentences `order()` judges nested. `agrees` is
 * `null` — a typed absence, not a silent false — when there is real
 * material but too little of it (n < 5) to say anything either way.
 */
export const crossCheck = (sentences, typology) => {
  const judged = judgeSentences(sentences, typology);
  if (isGap(judged)) return judged;

  const nested = judged.filter((r) => r === "nested").length;
  const n = judged.length;
  const pValue = binomialUpperTail(nested, n);

  return Object.freeze({
    n,
    nested,
    inverted: n - nested,
    fractionNested: nested / n,
    pValue,
    agrees: pValue < 0.05 ? true : n < 5 ? null : false,
    typology: { direction: typology.direction, giver: typology.giver },
  });
};

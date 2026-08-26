// eoreader6 · perceiver/text/roles — binding an AMBIGUOUS SPAN OCCURRENCE
// to a role BY ACTIVATION, never by an averaged tag over all its occurrences.
//
// The general sibling of pronouns.js::resolvePronouns, at the same
// quarantine level: both are thin text-tier consumers of
// emergence/activation.js's fully domain-agnostic mechanism (tokens/codeOf/
// recall/encodeFrame — no notion of English, grammar, or any specific
// language lives in that file, and none is added here either). Where
// pronouns.js answers one narrow, named question — "which referent does
// this pronoun mean" — this file answers the general one underneath it:
// given a span occupying an UNKNOWN role, and other spans already known to
// occupy DECLARED roles, which role does this occurrence's own local
// vocabulary most resemble, by one causal recurrent hop? "Role" is never
// typed in here — pronoun-vs-referent, verb-vs-non-verb, actor-vs-patient
// are all the same shape to this module, a caller-declared label string.
//
// WHY A SPAN IS NEVER SCORED BY ITS OWN TYPE. Aggregating a word's
// occurrences into one type-level tag and asking whether THE WORD resolves
// is a different, weaker question than this one, and the wrong one: a
// surface span is never the thing with a role — the OCCURRENCE is. "by" is
// not objectively a preposition, an agent-marker, or a locative; a given
// instance of "by" already is one of those, and the honest state before
// enough context has arrived is that several roles are still live
// candidates, never an averaged split across every use the word has ever
// had. This is the same correction pronouns.js itself already embodies for
// referents (a pronoun is bound by what ITS OWN sentence resembles, never
// by which referent is named most often in the document) — applied here to
// role generally, not just to referent identity.
//
// WHAT THIS DELIBERATELY DOES NOT INHERIT FROM pronouns.js, AND WHY.
// pronouns.js carries several English-pronoun-specific decisions on top of
// the causal-recall core: a closed gendered-pronoun vocabulary, a
// derived-not-typed gender hard filter, a caller-supplied `nonPersonal`
// filter, and a rule that a span sharing its sentence with an already-known
// example is left alone entirely (disambiguating among several
// CO-PRESENT named referents in one sentence is a harder, different
// problem than the one pronouns.js exists to answer). None of that is
// general — it is what "quarantining natural language" means applied one
// level further in: those decisions stay in pronouns.js, where the English
// facts they depend on actually live. This file has no notion of gender,
// person, or co-presence; a caller wanting a hard filter over roles
// applies it to this module's OUTPUT (candidates), the same way pronouns.js
// itself receives `nonPersonal` from ITS caller rather than deriving it.
//
// WHAT THIS MEASURES, AND WHAT IT REFUSES TO ASSUME. An occurrence is
// bound to a role only when its one-hop recall against the roles already
// evidenced clears two declared bars: an absolute floor (`minActivation` —
// some real echo, not a rounding artefact) and a margin over the runner-up
// (`minMargin` — a decision, not a coin flip between two near-equal
// candidates). Both are declared by the caller, never defaulted here — the
// same standing pronouns.js's own minActivation/minMargin already hold,
// which in turn matches entity.js's minArrivals and kind-void.js's
// draws/seed: how much activation makes a binding is a property of the
// reading, not a constant this file gets to assume for every caller's
// material. Short of either bar, the occurrence is reported unresolved — a
// typed gap, never a guess dressed as a number.

import { tokens, codeOf, recall, encodeFrame } from "../../emergence/activation.js";

// The cell this organ occupies on the operator grid (engine/operators.js):
// CON · Link · Binding — the identical cell activation.js's own readForward
// and pronouns.js's resolvePronouns already occupy, because this is the
// same act (binding a span to the structure it belongs with) at the same
// generality pronouns.js applies to one narrow case.
export const CELL = Object.freeze({ op: "CON", grain: "Figure" });

// readForward's own defaults (activation.js) are internal to that function,
// not exported constants, so a caller that bypasses readForward (as this
// file does, exactly as pronouns.js does, to interleave recall with its own
// per-occurrence logic between the code and encode steps) restates them
// here rather than leaving them silently unset.
const DEFAULT_COMPLETION = 0.5;
const DEFAULT_TOP_EDGES = 6;
const DEFAULT_EDGE_SLOTS = 24;

/**
 * Bind span occurrences of unknown role to a role by one-hop activation
 * recall over occurrences the caller has already declared to be examples
 * of a role.
 *
 * @param {Array<{text: string, offset: number, order: number}>} sentences
 *   sentence-level frames in reading order (spans.js::splitSentences).
 * @param {Array<{sentenceOrder: number, role: (string|null), id: *, offset: number}>} occurrences
 *   every span this call is asked to reason about, anchored to the sentence
 *   it occurs in. An occurrence with `role` set is EVIDENCE — a known
 *   example the reading trusts without needing recall to confirm it. An
 *   occurrence with `role` null or omitted is what this call resolves.
 *   `id`/`offset` are opaque caller identifiers, echoed back on the
 *   binding/gap so the caller can find its way back to the original span;
 *   this file never reads or interprets either.
 * @param {object} options
 * @param {number} options.minActivation declared floor a candidate role's
 *   recall must clear. Never defaulted: how much echo counts as real is a
 *   property of the reading, not a constant this file assumes for every
 *   caller.
 * @param {number} options.minMargin declared lead the top candidate role
 *   must hold over the runner-up, as a fraction of the top score. Never
 *   defaulted, for the same reason.
 * @returns {{bindings: Array<object>, gaps: Array<object>}} every resolved
 *   occurrence, and every one that was not — a gap is a result.
 */
export const resolveSpanRole = (
  sentences,
  occurrences,
  {
    minActivation,
    minMargin,
    idfFloor,
    minLen,
    completion = DEFAULT_COMPLETION,
    topEdges = DEFAULT_TOP_EDGES,
    edgeSlots = DEFAULT_EDGE_SLOTS,
  } = {},
) => {
  if (!Number.isFinite(minActivation) || minActivation < 0)
    throw new TypeError("resolveSpanRole: minActivation is declared — how much recall counts as a real echo is never a default");
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 1)
    throw new TypeError("resolveSpanRole: minMargin is declared — how far a candidate must lead the runner-up is never a default");

  // Grouped once, by the sentence each occurrence is anchored to — this
  // file has no text-matching notion of its own (unlike pronouns.js's
  // surfaceMatcher/PRONOUN_RE, both English-specific); locating occurrences
  // in the text is the caller's job, exactly as declaring what a role means
  // is.
  const byOrder = new Map(); // sentenceOrder -> { known: [], unknown: [] }
  for (const occ of occurrences ?? []) {
    const order = occ?.sentenceOrder;
    if (!byOrder.has(order)) byOrder.set(order, { known: [], unknown: [] });
    const bucket = byOrder.get(order);
    if (occ.role != null) bucket.known.push(occ);
    else bucket.unknown.push(occ);
  }

  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 };
  const roleByFrame = new Map(); // sentence order -> Set(role) evidenced in it

  const bindings = [];
  const gaps = [];

  for (const sentence of sentences ?? []) {
    const ws = tokens(sentence.text);
    const { trace, cue } = codeOf(ws, state, { minLen, idfFloor });

    const bucket = byOrder.get(sentence.order);
    const known = bucket?.known ?? [];
    const unknown = bucket?.unknown ?? [];

    if (unknown.length > 0) {
      const activation = recall(cue, state, { completion, topEdges, selfOrder: sentence.order });
      // BEST single hop, not a sum across every hop — the same discipline
      // pronouns.js already keeps for referents, for the identical reason:
      // summing a role's credit across every frame that happens to
      // evidence it lets a role recalled from MANY weak, incidental frames
      // outscore one recalled from a FEW strong, specific frames —
      // rewarding ubiquity of the role's examples, not strength of
      // resemblance to THIS occurrence.
      const roleScore = new Map();
      for (const [order, amt] of activation) {
        const roles = roleByFrame.get(order);
        if (!roles) continue;
        for (const role of roles) {
          if (amt > (roleScore.get(role) ?? -Infinity)) roleScore.set(role, amt);
        }
      }

      for (const occ of unknown) {
        const candidates = [...roleScore.entries()].sort((a, b) => b[1] - a[1]);

        if (candidates.length === 0) {
          gaps.push({
            reason: "role_no_candidate",
            tier: "engine",
            sentenceOrder: sentence.order,
            id: occ.id,
            offset: occ.offset,
            detail: "no role has been evidenced and activated yet — nothing here to bind to",
          });
          continue;
        }

        const [topRole, topScore] = candidates[0];
        if (topScore < minActivation) {
          gaps.push({
            reason: "role_below_floor",
            tier: "engine",
            sentenceOrder: sentence.order,
            id: occ.id,
            offset: occ.offset,
            top: topRole,
            activation: topScore,
            detail: `top candidate's recall (${topScore.toFixed(3)}) does not clear minActivation (${minActivation})`,
          });
          continue;
        }

        const second = candidates[1]?.[1] ?? 0;
        const margin = topScore > 0 ? (topScore - second) / topScore : 0;
        if (margin < minMargin) {
          gaps.push({
            reason: "role_no_margin",
            tier: "engine",
            sentenceOrder: sentence.order,
            id: occ.id,
            offset: occ.offset,
            top: topRole,
            runnerUp: candidates[1]?.[0] ?? null,
            margin,
            detail: `top candidate leads the runner-up by only ${(margin * 100).toFixed(1)}%, short of minMargin (${(minMargin * 100).toFixed(1)}%)`,
          });
          continue;
        }

        bindings.push({
          role: topRole,
          sentenceOrder: sentence.order,
          id: occ.id,
          offset: occ.offset,
          activation: topScore,
          margin,
          provenance: {
            giver: "perceiver/text/roles::resolveSpanRole",
            tier: "engine",
            basis: "one-hop activation recall over already-evidenced role examples",
          },
        });
      }
    }

    // Causal: this sentence's own known examples inform only LATER
    // sentences' recall, never the one they were read from — set after
    // this sentence's own resolution branch has already run, and
    // encodeFrame (which is what makes this sentence's vocabulary
    // recallable at all) runs last, matching activation.js's own
    // "recall first, then encode" discipline.
    roleByFrame.set(sentence.order, new Set(known.map((k) => k.role)));
    encodeFrame(state, sentence.order, ws, trace, { edgeSlots });
  }

  return { bindings, gaps };
};

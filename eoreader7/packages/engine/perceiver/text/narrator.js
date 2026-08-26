// eoreader6 · perceiver/text/narrator — who is "I" here?
//
// The one pronoun whose referent is a function of WHO IS HOLDING THE PEN
// rather than of the token itself. Frankenstein is a frame narrative:
// Walton > Victor > Creature. Every "I" inside the creature's tale is the
// creature; the same three letters elsewhere are Victor or Walton. No amount
// of reading the string can settle that.
//
// So it is RECEIVED. eoPriors coref priors carry `narratorSpans` as ANCHOR
// QUOTES — not offsets, because raw offsets rot the moment whitespace or an
// edition changes, and an exact-string match breaks on line wraps. Anchors
// are resolved at apply time against whitespace-collapsed text, which is
// eoreader5's `presence.js::resolveSpans` discipline, ported.
//
// This is the nameless-referent principle applied to the hardest case: a
// surface whose referent is fixed by SCOPE. Outside a known span the answer
// is a typed gap, never a guess — attributing the creature's murder of
// William to Victor is exactly the failure `def/attribution.js` exists to
// catch, and it is one silent fallback away.

import { FIRST_PERSON } from "./priors.js";

/** Collapse whitespace, keeping a map back to raw offsets. */
const collapse = (text) => {
  let out = "";
  const map = [];
  let inRun = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) {
      if (!inRun) { out += " "; map.push(i); inRun = true; }
    } else {
      out += c; map.push(i); inRun = false;
    }
  }
  return { collapsed: out, map };
};

/**
 * Resolve a prior's anchor-quoted narrator spans to real character ranges.
 * An anchor that cannot be found is reported, never silently dropped: a span
 * that failed to resolve means a stretch of text whose narrator we believed
 * we knew and now do not.
 */
export const resolveNarratorSpans = (text, referentId, spans) => {
  const { collapsed, map } = collapse(text);
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

  const resolved = [];
  const unresolved = [];

  for (const span of spans ?? []) {
    const fromIdx = span.fromAnchor ? collapsed.indexOf(norm(span.fromAnchor)) : 0;
    const toIdx = span.toAnchor ? collapsed.indexOf(norm(span.toAnchor)) : collapsed.length;
    if (fromIdx === -1 || toIdx === -1) {
      unresolved.push({ span, reason: fromIdx === -1 ? "fromAnchor not found" : "toAnchor not found" });
      continue;
    }
    const from = map[fromIdx] ?? 0;
    const to = map[Math.min(toIdx, map.length - 1)] ?? text.length;
    if (to <= from) { unresolved.push({ span, reason: "toAnchor precedes fromAnchor" }); continue; }
    resolved.push({ referentId, from, to });
  }

  return { resolved, unresolved };
};

export const isFirstPerson = (surface) => FIRST_PERSON.test(String(surface ?? "").trim());

/**
 * Resolve narrator spans across EVERY referent that carries them, not just
 * one. A frame narrative can nest more than one pen — Frankenstein alone has
 * three (Walton, Victor, the creature) — and a prior with a `narratorSpans`
 * array on more than one referent was always structurally legal; the callers
 * were the bug, each written as `coref.referents.find(r => r.narratorSpans…)`,
 * which resolves the FIRST referent carrying spans and silently drops the
 * rest. Fixed once here rather than three times at the call sites
 * (`scripts/read-ladder.mjs`, `read-tiered.mjs`, `read-people.mjs` all
 * carried the identical bug).
 *
 * Sorted NARROWEST FIRST, not by position. `narratorAt` below returns the
 * first span whose range contains an offset, so if two referents' spans
 * ever nest — Frankenstein's do: the creature's final speech is quoted
 * inside Walton's closing letters — a naive sort by `from` would let the
 * wider, outer span win for the inner one's whole extent, silently
 * misattributing every "I" inside the quotation to whoever is holding the
 * pen outside it. Narrowest-first makes the nested span win where it
 * applies and costs nothing where spans don't overlap at all.
 */
export const resolveAllNarratorSpans = (text, referents) => {
  const resolved = [];
  const unresolved = [];
  for (const r of referents ?? []) {
    if (!Array.isArray(r?.narratorSpans) || r.narratorSpans.length === 0) continue;
    const out = resolveNarratorSpans(text, `ref:narrator:${r.id}`, r.narratorSpans);
    resolved.push(...out.resolved);
    for (const u of out.unresolved) unresolved.push({ ...u, referent: r.id });
  }
  resolved.sort((a, b) => (a.to - a.from) - (b.to - b.from));
  return { resolved: Object.freeze(resolved), unresolved: Object.freeze(unresolved) };
};

/**
 * Who does this first-person surface point at, at this offset?
 * Returns a referent id, or a typed gap when no span covers the position —
 * "some narrator, and the prior does not say which."
 */
export const narratorAt = (offset, resolvedSpans) => {
  for (const s of resolvedSpans) if (offset >= s.from && offset < s.to) return { referentId: s.referentId };
  return {
    gap: {
      reason: "narrator_unknown_at_offset",
      tier: "model",
      needsWitness: true,
      offset,
      detail: "a first-person surface outside every known narrator span; which speaker holds the pen here is not derivable",
    },
  };
};

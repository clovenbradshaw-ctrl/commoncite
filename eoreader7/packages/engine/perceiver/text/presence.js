// eoreader6 · perceiver/text/presence — a referent's surfaces, projected for
// a reader: which strings point at this being, and where.
//
// FIXED — `events` and `fullText` were accepted parameters this function
// never read, so a referent's presence here was pure name-in-sentence
// matching: whatever `referent.surfaces` already listed, verbatim, and
// nothing else. Two consequences followed from that, both real gaps rather
// than oversights:
//
//   1. A DEF.admit event naming a surface the `referent` object itself did
//      not carry was silently dropped, even though `events` was sitting
//      right there in the parameter list. referents/index.js::projectReferents
//      folds the same events; this now does too, so a caller building a
//      referent by a different path still sees what its own event log
//      already knows.
//
//   2. A scene carried only by a pronoun — "he" with no name anywhere in it
//      — was invisible here by construction, because name-in-sentence
//      matching has nothing to match. That is the gap surfaces.js's own
//      header names as unsolved ("pronoun_and_descriptor_mentions_unresolved"
//      — model tier, not derivable). It still is, in general: descriptor
//      synonymy is untouched, and this makes no claim about it. But the
//      pronoun half now has an engine-tier answer for the specific case this
//      complaint named — perceiver/text/pronouns.js::resolvePronouns binds a
//      pronoun's sentence to a referent by the SAME one-hop activation
//      recall emergence/activation.js already uses for motif memory, gated
//      by declared activation/margin thresholds that refuse a guess dressed
//      as a number. Its bindings are optional here (`pronounBindings`) and
//      never merged into the literal-surface entries: each carries its own
//      `resolved: "activation"` tag, its activation weight and its margin,
//      so a reader can always tell a name from a recall-bound pronoun.

export function admitReferent(events, referent, { pronounBindings } = {}) {
  const surfaces = [];
  const seen = new Set();

  const name = referent.name || referent.display || referent.id || "unknown";
  const referentId = referent.referentId || referent.id || `ref:${name.replace(/\s+/g, "_")}`;

  for (const entry of referent.surfaces || []) {
    const surface = typeof entry === "string" ? entry : entry.surface || entry.name;
    if (!surface || seen.has(surface)) continue;
    seen.add(surface);

    const scope = entry.scope || null;
    surfaces.push({ surface, scope });
  }

  if (!seen.has(name)) {
    surfaces.unshift({ surface: name, scope: null });
  }

  // DEF.admit events for this referent that named a surface the `referent`
  // object itself did not carry — previously ignored entirely.
  for (const event of events || []) {
    if (event?.type !== "DEF.admit" || event.referent_id !== referentId) continue;
    const surface = event.surface;
    if (!surface || seen.has(surface)) continue;
    seen.add(surface);
    surfaces.push({ surface, scope: event.scope || null });
  }

  // Activation-resolved pronoun mentions — scoped to one sentence/offset,
  // never a bare literal string, and always tagged with how they got here.
  for (const binding of pronounBindings || []) {
    if (binding.referentId !== referentId) continue;
    surfaces.push({
      surface: binding.pronoun,
      scope: { sentenceOrder: binding.sentenceOrder, offset: binding.offset },
      resolved: "activation",
      activation: binding.activation,
      margin: binding.margin,
    });
  }

  return { referentId, surfaces };
}

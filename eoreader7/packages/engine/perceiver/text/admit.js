// eoreader6 · perceiver/text/admit — the existence layer. Turns an injected,
// named-giver coref prior (eoPriors/priors/coref/*.json — witness-tier
// knowledge, never derived) into DEF.admit events for referents/index.js's
// projectReferents. This is the missing producer: projectReferents already
// existed, unwired, with nothing calling it — "unwired is failing" per
// SEED.md. Mechanical surface matching only (structural coref, engine-tier
// per eoreader5's tier discipline); deciding WHICH surfaces predicate one
// being is the model-tier judgment already made by whoever wrote the prior.

const resolveAnchor = (text, anchor) => (anchor ? text.indexOf(anchor) : -1);

// The cell this organ occupies on the operator grid (engine/operators.js):
// DEF · Atmosphere · Clearing — received priors into DEF.admit events; a
// prior must name its giver. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "DEF", grain: "Ground" });

const inScope = (offset, scope, text) => {
  if (!scope) return true;
  for (const range of scope) {
    const from = range.fromAnchor ? resolveAnchor(text, range.fromAnchor) : 0;
    const to = range.toAnchor ? resolveAnchor(text, range.toAnchor) : text.length;
    if (from === -1 || to === -1) continue;
    if (offset >= from && offset < to) return true;
  }
  return false;
};

// All occurrences of `surface` in `text`, case-sensitive (the prior spells
// surfaces exactly — "dæmon" not "daemon" is the documented reason this
// exists at all).
const findAll = (text, surface) => {
  const offsets = [];
  let i = 0;
  while ((i = text.indexOf(surface, i)) !== -1) {
    offsets.push(i);
    i += surface.length;
  }
  return offsets;
};

export const admitFromPrior = (text, referentPrior, sourceId) => {
  const events = [];
  for (const s of referentPrior.surfaces) {
    for (const offset of findAll(text, s.surface)) {
      if (!inScope(offset, s.scope, text)) continue;
      events.push({
        type: "DEF.admit",
        referent_id: referentPrior.id,
        surface: s.surface,
        provenance: { sourceId, giver: "eoPriors/coref", offset, weight: s.weight ?? 1 },
      });
    }
  }
  events.sort((a, b) => a.provenance.offset - b.provenance.offset);
  return events;
};

export const mentionOffsets = (events, referentId) =>
  events.filter((e) => e.type === "DEF.admit" && e.referent_id === referentId).map((e) => e.provenance.offset);

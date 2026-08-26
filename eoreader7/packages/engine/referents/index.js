export const INDIVIDUATION_TYPES = Object.freeze(["field", "emanon", "protogon", "holon", "apparatus"]);

// The cell this organ occupies on the operator grid (engine/operators.js):
// CON · Link · Binding — the projection over DEF.admit / CON.identity /
// SYN.merge / SEG.split events. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "CON", grain: "Figure" });

export function projectReferents(events) {
  const referents = new Map();

  function ensure(id) {
    if (!referents.has(id)) {
      referents.set(id, { id, surfaces: new Set(), admittedBy: [], mergedInto: null });
    }
    return referents.get(id);
  }

  function resolve(id) {
    let current = ensure(id);
    const seen = new Set();
    while (current.mergedInto && !seen.has(current.id)) {
      seen.add(current.id);
      current = ensure(current.mergedInto);
    }
    return current;
  }

  for (const event of events) {
    switch (event.type) {
      case "DEF.admit": {
        const referent = resolve(event.referent_id);
        referent.surfaces.add(event.surface);
        referent.admittedBy.push({ surface: event.surface, provenance: event.provenance });
        break;
      }
      case "CON.identity": {
        const referent = resolve(event.referent_id);
        const target = resolve(event.target_id);
        for (const s of target.surfaces) referent.surfaces.add(s);
        break;
      }
      case "SYN.merge": {
        const into = resolve(event.into_id);
        for (const fromId of event.from_ids) {
          const from = resolve(fromId);
          for (const s of from.surfaces) into.surfaces.add(s);
          from.mergedInto = into.id;
        }
        break;
      }
      case "SEG.split": {
        const from = resolve(event.from_id);
        for (const intoId of event.into_ids) {
          const into = ensure(intoId);
          const surfaces = event.surfaces?.[intoId] || [];
          for (const s of surfaces) into.surfaces.add(s);
        }
        break;
      }
    }
  }

  return Array.from(referents.values()).map((r) => ({
    id: r.id,
    surfaces: Array.from(r.surfaces),
    admittedBy: r.admittedBy,
    mergedInto: r.mergedInto,
  }));
}

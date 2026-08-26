import { eoOperation } from "./fold.js";

export function obligation({ id, distinction, grounds = [], alternatives = [], consequences = [], openedAt = null, persistence = 0, status = "open" }) {
  if (!id) throw new TypeError("Obligation requires id");
  return Object.freeze({ schema: "EOObligation@1", id, distinction, grounds: Object.freeze([...grounds]), alternatives: Object.freeze([...alternatives]), consequences: Object.freeze([...consequences]), openedAt, persistence, status, resolutionRefs: Object.freeze([]) });
}

export function openObligation(value, { witness, grain = "Figure", op = "DEF" } = {}) {
  return eoOperation({ op, grain, witness, inputs: [...(value.grounds ?? [])], outputs: [value.id], consequence: value.consequences ?? null, payload: { action: "obligation", value: { ...value, status: value.status ?? "open" } } });
}

export function resolveObligation(id, { witness, status = "resolved", grain = "Figure", op = "DEF", consequence = null } = {}) {
  return eoOperation({ op, grain, witness, inputs: [id], outputs: [id], consequence, payload: { action: "resolve-obligation", id, status } });
}

export function carryObligations(fold) {
  return (fold?.obligations ?? []).map((item) => ["resolved", "closed", "superseded"].includes(item.status) ? item : { ...item, persistence: (item.persistence ?? 0) + 1 });
}

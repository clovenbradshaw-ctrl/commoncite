import { eoOperation, deltaFold } from "./fold.js";
import { expectation, expectationTransition, openExpectation } from "./expectations.js";

const norm = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const stablePair = (a, b) => [norm(a), norm(b)].sort();
const stable = (x) => JSON.stringify(x);

const identityId = (a, b) => {
  const [left, right] = stablePair(a, b);
  return `identity:${left.replace(/\s+/g, "_")}:${right.replace(/\s+/g, "_")}`;
};

const findAlternative = (fold, a, b) => {
  const id = identityId(a, b);
  return (fold?.unresolvedAlternatives ?? []).find((x) => x?.id === id) ?? null;
};

export function identityAlternative({ left, right, standing = "live_hypothesis", supportRefs = [], attackRefs = [], giver = null } = {}) {
  const [a, b] = stablePair(left, right);
  if (!a || !b || a === b) throw new TypeError("identityAlternative requires two distinct forms");
  return Object.freeze({
    schema: "EOIdentityAlternative@1",
    id: identityId(a, b),
    left: a,
    right: b,
    standing,
    supportRefs: Object.freeze([...new Set(supportRefs.filter(Boolean))]),
    attackRefs: Object.freeze([...new Set(attackRefs.filter(Boolean))]),
    giver,
  });
}

const participantValue = (participant) => {
  // An unresolved participant's `ref` is only an occurrence identifier. Its
  // witnessed surface is the form identity evidence can actually concern.
  if (participant?.standing === "unresolved_surface" && participant?.surface) return norm(participant.surface);
  return norm(participant?.ref ?? participant?.value ?? participant?.surface);
};

export function canonicalizeHyperedge(edge, alternatives = []) {
  if (edge?.schema !== "EOHyperedge@1") throw new TypeError("canonicalizeHyperedge requires EOHyperedge@1");
  const active = (alternatives ?? []).filter((x) => x?.schema === "EOIdentityAlternative@1" && x.standing !== "distinct" && x.standing !== "refused");
  const participants = (edge.participants ?? []).map((participant) => {
    const value = participantValue(participant);
    const values = new Set([value]);
    for (const identity of active) {
      if (identity.left === value) values.add(identity.right);
      if (identity.right === value) values.add(identity.left);
    }
    return Object.freeze({ role: participant.role ?? null, value, alternatives: Object.freeze([...values].sort()) });
  });
  return Object.freeze({
    schema: "EOCanonicalHyperedge@1",
    id: `canonical:${edge.id}`,
    sourceEdge: edge.id,
    relation: edge.relation,
    participants: Object.freeze(participants),
    witness: edge.witness ?? null,
    scope: edge.scope ?? null,
  });
}

const currentCanonical = (fold, edgeId) => (fold?.graphEntries ?? []).find((x) => x?.schema === "EOCanonicalHyperedge@1" && x.sourceEdge === edgeId) ?? null;
const rawEdges = (fold) => (fold?.graphEntries ?? []).filter((x) => x?.schema === "EOHyperedge@1");
const touches = (edge, identity) => (edge.participants ?? []).some((p) => {
  const value = participantValue(p);
  return value === identity.left || value === identity.right;
});

// An alternative participates in CANONICAL PROJECTION only at or above the
// caller's declared corroboration floor (supportRefs count). The floor
// gates projection alone — the alternative itself stays on the fold, live,
// attackable, and accumulating evidence either way. Rationale, measured
// (native/eval/results/understanding-scoreboard-RESULTS.md, second
// amendment): every surviving FALSE identity belief on the Frankenstein
// coref golden stood on exactly one support — single-witness testimony
// rewriting the canonical past is the precise failure a corroboration
// floor exists for. No floor supplied = every non-refused alternative
// projects, byte-identical to before this option existed.
const meetsFloor = (alternative, floor) =>
  !Number.isFinite(floor) || (alternative.supportRefs ?? []).length >= floor;

function recanonicalizationOperations(fold, alternatives, touchedIdentity, witness, floor) {
  const operations = [];
  const projecting = alternatives.filter((x) => meetsFloor(x, floor));
  for (const edge of rawEdges(fold)) {
    if (!touches(edge, touchedIdentity)) continue;
    const next = canonicalizeHyperedge(edge, projecting);
    const before = currentCanonical(fold, edge.id);
    if (before && stable(before) === stable(next)) continue;
    operations.push(eoOperation({
      op: "REC",
      grain: "Figure",
      witness,
      inputs: [edge.id, touchedIdentity.id],
      outputs: [next.id],
      consequence: { kind: "relation_recanonicalized", sourceEdge: edge.id, identity: touchedIdentity.id, from: before?.participants ?? null, to: next.participants },
      payload: { action: "graph-object", value: next },
    }));
  }
  return operations;
}

/**
 * Turn modality-supplied identity evidence into a witnessed Fold delta.
 * Support never proves sameness: it opens/strengthens a live alternative via
 * CON. Attack is constitutive contradiction: SEG separates the forms and DEF
 * records refusal of the prior identity reading. Canonical relation projections
 * are then REC-written; raw witnessed edges remain untouched.
 */
export function deriveIdentityRevision({ fold = {}, supports = [], attacks = [], witness = null, giver = null, canonicalizationFloor = undefined } = {}) {
  if (canonicalizationFloor !== undefined && (!Number.isInteger(canonicalizationFloor) || canonicalizationFloor < 1))
    throw new TypeError("deriveIdentityRevision: canonicalizationFloor, when declared, is a positive integer — how much corroboration licenses canonical projection is never a fraction or a guess");
  const operations = [];
  const working = new Map((fold?.unresolvedAlternatives ?? []).filter((x) => x?.schema === "EOIdentityAlternative@1").map((x) => [x.id, x]));

  // ── expectations, gated behind the declared floor ──────────────────────
  // The floor is what makes "fulfilled" a mechanical fact rather than a
  // judgment: an alternative opened below the floor IS the fold's own
  // prediction that corroboration will arrive. Its outcome is witnessed by
  // the same evidence stream — a support below the floor STRENGTHENS it, a
  // support reaching the floor FULFILLS it, an attack VIOLATES it. No
  // floor declared = no expectations = byte-identical to before (the same
  // backward-compatibility posture the floor itself holds).
  const expId = (altId) => `expectation:${altId}`;
  const expWorking = new Map((fold?.expectations ?? []).filter((x) => x?.schema === "EOExpectation@1").map((x) => [x.id, x]));
  const expectationsOn = Number.isFinite(canonicalizationFloor);
  const expectFor = (alt, ref) => {
    if (!expectationsOn || (alt.supportRefs ?? []).length >= canonicalizationFloor) return;
    if (expWorking.has(expId(alt.id))) return;
    const value = expectation({
      id: expId(alt.id),
      hypothesis: `corroboration expected: ${alt.left} <-> ${alt.right}`,
      giver: alt.giver ?? null,
      grounds: [alt.id],
      openedAt: null,
    });
    expWorking.set(value.id, value);
    operations.push(openExpectation(value, { witness: ref, consequence: { kind: "expectation_opened", expectation: value.id, identity: alt.id } }));
  };
  const transitionFor = (altId, state, ref, kind) => {
    if (!expectationsOn) return;
    const current = expWorking.get(expId(altId));
    if (!current || !["open", "strengthened", "weakened"].includes(current.state)) return;
    const next = { ...current, state };
    expWorking.set(next.id, next);
    operations.push(expectationTransition(current, state, { witness: ref, consequence: { kind, expectation: current.id, identity: altId } }));
  };

  for (const evidence of supports ?? []) {
    const left = norm(evidence?.left), right = norm(evidence?.right);
    if (!left || !right || left === right) continue;
    const prior = working.get(identityId(left, right)) ?? findAlternative(fold, left, right);
    if (prior?.standing === "distinct" || prior?.standing === "refused") continue;
    const ref = evidence?.witness ?? witness;
    const next = identityAlternative({ left, right, standing: "live_hypothesis", supportRefs: [...(prior?.supportRefs ?? []), ref], attackRefs: prior?.attackRefs ?? [], giver: evidence?.giver ?? giver });
    working.set(next.id, next);
    operations.push(eoOperation({
      op: "CON", grain: "Figure", witness: ref, inputs: [next.left, next.right], outputs: [next.id],
      consequence: { kind: prior ? "identity_hypothesis_supported" : "identity_hypothesis_opened", identity: next.id },
      payload: { action: "alternative", value: next },
    }));
    if (!prior) {
      expectFor(next, ref);
    } else if ((next.supportRefs ?? []).length >= (canonicalizationFloor ?? Infinity)) {
      transitionFor(next.id, "fulfilled", ref, "expectation_fulfilled");
    } else {
      transitionFor(next.id, "strengthened", ref, "expectation_strengthened");
    }
    operations.push(...recanonicalizationOperations(fold, [...working.values()], next, ref, canonicalizationFloor));
  }

  for (const evidence of attacks ?? []) {
    const left = norm(evidence?.left), right = norm(evidence?.right);
    if (!left || !right || left === right) continue;
    const prior = working.get(identityId(left, right)) ?? findAlternative(fold, left, right);
    if (!prior || prior.standing === "distinct" || prior.standing === "refused") continue;
    const ref = evidence?.witness ?? witness;
    const next = identityAlternative({ left: prior.left, right: prior.right, standing: "distinct", supportRefs: prior.supportRefs ?? [], attackRefs: [...(prior.attackRefs ?? []), ref], giver: evidence?.giver ?? giver ?? prior.giver });
    working.set(next.id, next);
    operations.push(eoOperation({
      op: "SEG", grain: "Figure", witness: ref, inputs: [prior.id], outputs: [next.id],
      consequence: { kind: "identity_split", identity: next.id, reason: evidence?.reason ?? "incompatible multiplicity" },
      payload: { action: "alternative", value: next },
    }));
    operations.push(eoOperation({
      op: "DEF", grain: "Figure", witness: ref, inputs: [prior.id], outputs: [`exclusion:${prior.id}`],
      consequence: { kind: "identity_reading_refused", identity: prior.id },
      payload: { action: "exclusion", value: Object.freeze({ schema: "EOExclusion@1", id: `exclusion:${prior.id}`, kind: "identity_refused", target: prior.id, witness: ref }) },
    }));
    transitionFor(prior.id, "violated", ref, "expectation_violated");
    operations.push(...recanonicalizationOperations(fold, [...working.values()], next, ref, canonicalizationFloor));
  }

  return deltaFold(operations, { schemaVersion: "EOIdentityRevision@1" });
}

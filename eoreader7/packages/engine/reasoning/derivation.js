import { normalizeEotTuple } from "./eot.js";
import { cellOf } from "../operators.js";
import { compositionAffordance } from "./hyperlexicon.js";

const freeze = (x) => Object.freeze(x);
const stable = (x) => typeof x === "string" ? x : JSON.stringify(x);
const keyOf = (t) => `${stable(t.subject)}\u0000${stable(t.predicate)}`;

const scalar = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(value).trim() !== "") return asNumber;
  const asDate = Date.parse(value);
  return Number.isNaN(asDate) ? null : asDate;
};

const disjoint = (a, b) => {
  const a0 = scalar(a?.start); const a1 = scalar(a?.end);
  const b0 = scalar(b?.start); const b1 = scalar(b?.end);
  if ([a0, a1, b0, b1].some((v) => v === null)) return false;
  return Math.min(a1, b1) <= Math.max(a0, b0);
};

const scopesCompatible = (a, b) => {
  const a0 = scalar(a?.start); const a1 = scalar(a?.end);
  const b0 = scalar(b?.start); const b1 = scalar(b?.end);
  if ([a0, a1, b0, b1].some((v) => v === null)) return true;
  return Math.max(a0, b0) < Math.min(a1, b1);
};

/**
 * Candidate composition affordances are observations about repeated relation
 * adjacency. They are deliberately NOT proof rules: corpus recurrence may
 * nominate a pair for checking, but only a named GIVEN HL affordance may
 * license a composed bridge proposition.
 */
const positiveTuples = (input = []) => input.map((t, i) => normalizeEotTuple(t, i)).filter((t) => !t?.gap && t.polarity > 0);
const bySubject = (tuples) => {
  const index = new Map();
  for (const tuple of tuples) { const key = stable(tuple.subject); if (!index.has(key)) index.set(key, []); index.get(key).push(tuple); }
  return index;
};

export function acquireCompositionCandidates(input = [], { minWitnesses = 2 } = {}) {
  const tuples = positiveTuples(input);
  const outgoingBySubject = bySubject(tuples);
  const counts = new Map();
  for (const incoming of tuples) {
    for (const outgoing of outgoingBySubject.get(stable(incoming.object)) ?? []) {
      if (incoming.id === outgoing.id || !scopesCompatible(incoming.scope, outgoing.scope)) continue;
      const key = `${stable(incoming.predicate)}\u0000${stable(outgoing.predicate)}`;
      if (!counts.has(key)) counts.set(key, { left: incoming.predicate, right: outgoing.predicate, witnesses: [] });
      counts.get(key).witnesses.push(freeze([incoming.id, outgoing.id]));
    }
  }
  return freeze([...counts.values()].filter((x) => x.witnesses.length >= minWitnesses).map((x) => freeze({
    left: x.left,
    right: x.right,
    standing: "candidate",
    witnesses: freeze(x.witnesses),
  })));
}

const deriveBridgePositions = (tuples, hyperlexicon, withheld) => {
  const positive = positiveTuples(tuples);
  const outgoingBySubject = bySubject(positive);
  const derived = [];
  const seen = new Set();

  for (const incoming of positive) {
    for (const outgoing of outgoingBySubject.get(stable(incoming.object)) ?? []) {
      if (incoming.id === outgoing.id || !scopesCompatible(incoming.scope, outgoing.scope)) continue;

      const left = incoming.subject;
      const bridge = incoming.object;
      const right = outgoing.object;
      if (stable(left) === stable(bridge) || stable(bridge) === stable(right) || stable(left) === stable(right)) continue;

      const affordance = compositionAffordance(hyperlexicon, incoming.predicate, outgoing.predicate);
      if (affordance.standing !== "given") {
        withheld.push(freeze({
          type: "composition_underdetermined",
          bridge,
          from: left,
          to: right,
          leftPredicate: incoming.predicate,
          rightPredicate: outgoing.predicate,
          standing: affordance.standing,
          tupleIds: freeze([incoming.id, outgoing.id]),
          reason: "shared-node adjacency does not license composition without a GIVEN Hyperlexicon affordance",
        }));
        continue;
      }

      const id = `derived:${stable(bridge)}:bridge:${stable(left)}:${stable(right)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      derived.push(freeze({
        id,
        op: "EVA",
        grain: "Pattern",
        subject: bridge,
        predicate: "occupies_bridge_between",
        object: freeze({ from: left, to: right }),
        polarity: 1,
        scope: incoming.scope?.start != null ? incoming.scope : outgoing.scope,
        dependsOn: freeze([incoming.id, outgoing.id]),
        meta: freeze({
          derived: true,
          structural: true,
          giver: affordance.giver,
          composition: freeze({ left: incoming.predicate, right: outgoing.predicate, standing: affordance.standing }),
          rule: "shared-node adjacency plus a GIVEN Hyperlexicon composition affordance licenses an observed bridge",
          path: freeze([
            freeze({ tupleId: incoming.id, subject: incoming.subject, predicate: incoming.predicate, object: incoming.object }),
            freeze({ tupleId: outgoing.id, subject: outgoing.subject, predicate: outgoing.predicate, object: outgoing.object }),
          ]),
        }),
        cell: cellOf("EVA", "Pattern"),
      }));
    }
  }
  return derived;
};

export function deriveEotInsights(input = [], query = {}, { hyperlexicon = null } = {}) {
  const tuples = input.map((t, i) => t?.cell ? t : normalizeEotTuple(t, i)).filter((t) => !t?.gap);
  const groups = new Map();
  for (const t of tuples.filter((t) => t.polarity > 0)) {
    const key = keyOf(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const withheld = [];
  const derived = [...deriveBridgePositions(tuples, hyperlexicon, withheld)];
  for (const group of groups.values()) {
    if (query.subject === undefined || query.predicate === undefined) continue;
    const objects = new Set(group.map((t) => stable(t.object)));
    if (objects.size < 2) continue;
    const pairs = [];
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      if (stable(group[i].object) === stable(group[j].object)) continue;
      pairs.push([group[i], group[j]]);
    }
    const scopedPairs = pairs.filter(([a, b]) => disjoint(a.scope, b.scope));
    if (!scopedPairs.length) continue;

    const subject = group[0].subject;
    const predicate = group[0].predicate;
    const witnesses = [...new Set(scopedPairs.flatMap(([a, b]) => [a.id, b.id]))];
    derived.push(freeze({
      id: `derived:${stable(subject)}:${stable(predicate)}:scope-dependent`,
      op: "EVA", grain: "Pattern", subject,
      predicate: `${predicate}::scope_dependence`, object: true, polarity: 1,
      dependsOn: freeze(witnesses),
      meta: freeze({ derived: true, rule: "distinct positive objects for one relation occupy disjoint declared scopes", sourcePredicate: predicate, values: freeze(group.map((t) => freeze({ object: t.object, scope: t.scope, tupleId: t.id }))) }),
      cell: cellOf("EVA", "Pattern"),
    }));

    const queryMatches = (query.subject === undefined || stable(query.subject) === stable(subject))
      && (query.predicate === undefined || stable(query.predicate) === stable(predicate));
    const queryHasScope = query.scope && (query.scope.start != null || query.scope.end != null);
    if (queryMatches && !queryHasScope) derived.push(freeze({
      id: `derived:${stable(subject)}:${stable(predicate)}:query-needs-scope`,
      op: "DEF", grain: "Figure", subject: freeze({ ...query }), predicate: "requires_scope", object: true, polarity: 1,
      dependsOn: freeze(witnesses),
      meta: freeze({ derived: true, rule: "an unscoped singular relation query is under-specified when distinct values occupy disjoint scopes", sourceSubject: subject, sourcePredicate: predicate }),
      cell: cellOf("DEF", "Figure"),
    }));
  }

  Object.defineProperties(derived, {
    withheld: { value: freeze(withheld), enumerable: false },
    candidates: { value: acquireCompositionCandidates(tuples), enumerable: false },
  });
  return freeze(derived);
}

export function renderDerivedInsights(insights = []) {
  const lines = [insights.length ? "DERIVED INSIGHTS" : "DERIVED INSIGHTS — none"];
  for (const x of insights) lines.push(`  ${x.op} · ${x.cell.terrain} · ${x.cell.stance}  ${stable(x.subject)} —${x.predicate}→ ${stable(x.object)}\n    because ${x.meta.rule}`);
  if (insights.withheld?.length) {
    lines.push("", "WITHHELD COMPOSITIONS");
    for (const x of insights.withheld) lines.push(`  ${stable(x.from)} —${x.leftPredicate}→ ${stable(x.bridge)} —${x.rightPredicate}→ ${stable(x.to)}: ${x.standing}`);
  }
  return lines.join("\n");
}

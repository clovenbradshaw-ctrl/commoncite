import { normalizeEotTuple } from "./eot.js";

const freeze = (x) => Object.freeze(x);

const scopeText = (scope) => {
  if (!scope) return "the declared scope";
  const start = scope.start ?? null;
  const end = scope.end ?? null;
  if (start === null && end === null) return "the declared scope";
  return `${start ?? "?"}..${end ?? "?"}`;
};

const terrainAttack = (tuple) => {
  const terrain = tuple.cell.terrain;
  const base = { terrain, proposition: freeze({ subject: tuple.subject, predicate: tuple.predicate, object: tuple.object }) };

  switch (terrain) {
    case "Void":
      return freeze({ ...base, attack: "find an admissible observation inside the searched ground, or show the ground could not have detected one", seeks: ["counter-instance", "coverage gap", "selection effect"] });
    case "Entity":
      return freeze({ ...base, attack: "find independent evidence that the referent is absent, duplicated, misidentified, or impossible in the declared scope", seeks: ["identity collision", "nonexistence", "temporal impossibility"] });
    case "Kind":
      return freeze({ ...base, attack: "find a member that violates the claimed kind boundary, or an alternative grouping that explains the members better", seeks: ["counterexample member", "boundary case", "alternative clustering"] });
    case "Field":
      return freeze({ ...base, attack: "find a missing variable, excluded population, or boundary that changes the structural possibility-space", seeks: ["missing variable", "excluded population", "changed frame"] });
    case "Link":
      return freeze({ ...base, attack: `find an opposed or competing ${String(tuple.predicate)} relation for ${String(tuple.subject)} in ${scopeText(tuple.scope)}, including a value that forces scope segmentation`, seeks: ["opposed polarity", "competing object", "direction reversal", "scope split"] });
    case "Network":
      return freeze({ ...base, attack: "remove or reverse high-leverage links and test whether the claimed relational pattern survives", seeks: ["edge deletion", "node identity perturbation", "alternative topology"] });
    case "Atmosphere":
      return freeze({ ...base, attack: "find nearby counter-signals or a different baseline under which the local interpretive state disappears", seeks: ["counter-signal", "baseline sensitivity", "reader effect"] });
    case "Lens":
      return freeze({ ...base, attack: "construct a live rival framing and search for evidence the current lens systematically hides or misweights", seeks: ["rival lens", "suppressed evidence", "perspective dependence"] });
    case "Paradigm":
      return freeze({ ...base, attack: "accumulate anomalies or a rival paradigm that explains both the old successes and the resistant observations with fewer rescues", seeks: ["persistent anomaly", "rival paradigm", "ad hoc rescue"] });
    default:
      return freeze({ ...base, attack: "seek evidence that changes the declared proposition", seeks: ["counterexample"] });
  }
};

export const falsificationEnvelope = (input, index = 0) => {
  const tuple = input?.cell ? input : normalizeEotTuple(input, index);
  if (tuple?.gap) return tuple;
  const attack = terrainAttack(tuple);
  return freeze({
    tupleId: tuple.id,
    cell: tuple.cell,
    ...attack,
    witnessSearch: freeze({
      subject: tuple.subject,
      predicate: tuple.predicate,
      object: tuple.object,
      polarity: tuple.polarity,
      scope: tuple.scope,
    }),
    defeaterSearch: freeze({
      subject: tuple.subject,
      predicate: tuple.predicate,
      object: tuple.object,
      oppositePolarity: tuple.polarity * -1,
      competingObject: true,
      scope: tuple.scope,
      seeks: attack.seeks,
    }),
  });
};

export const falsificationEnvelopes = (tuples = []) => freeze(tuples.map((tuple, i) => falsificationEnvelope(tuple, i)));

export const renderFalsificationEnvelope = (envelope) => {
  if (envelope?.gap) return `GAP ${envelope.gap}: ${envelope.reason ?? ""}`.trim();
  return [
    `${envelope.tupleId}  ${envelope.cell.terrain} · ${envelope.cell.stance}`,
    `  attack: ${envelope.attack}`,
    `  seek: ${envelope.seeks.join(", ")}`,
  ].join("\n");
};

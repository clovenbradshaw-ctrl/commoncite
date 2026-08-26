import { DOMAINS, GRAINS, MODES, OPERATORS, cellOf } from "../operators.js";
import { deltaFold, eoOperation } from "../fold/index.js";
import { buildHypergraph, relevantHypergraphNeighborhood } from "../hypergraph/index.js";

export function addressOf(mode, domain, grain) {
  const operator = Object.values(OPERATORS).find((entry) => entry.mode === mode && entry.domain === domain)?.op;
  if (!operator) throw new TypeError(`unknown EO address: ${mode}/${domain}/${grain}`);
  return cellOf(operator, grain);
}

export function cubeAddresses() {
  return MODES.flatMap((mode) => DOMAINS.flatMap((domain) => GRAINS.map((grain) => addressOf(mode, domain, grain))));
}

/** Retrieve the consequence-bearing structural neighborhood around new observations. */
export function relevantNeighborhood(fold, observations, { select, maxHops = 3, graph = null } = {}) {
  if (select) return select(fold, observations);
  const workingGraph = graph ?? buildHypergraph([
    ...(fold?.graphEntries ?? []),
    ...(fold?.expectations ?? []),
    ...(fold?.obligations ?? []),
    ...(fold?.activeFrames ?? []),
    ...(fold?.unresolvedAlternatives ?? []),
    ...(fold?.transformationObjects ?? []),
  ]);
  const graphNeighborhood = relevantHypergraphNeighborhood(workingGraph, observations, { maxHops });
  const ids = new Set(graphNeighborhood.ids);
  const pick = (key) => (fold?.[key] ?? []).filter((entry) => entry?.id && ids.has(entry.id));
  return {
    graph: graphNeighborhood,
    witnessed: pick("witnessed"),
    provisional: pick("provisional"),
    expectations: pick("expectations"),
    obligations: pick("obligations"),
    exclusions: pick("exclusions"),
    unresolvedAlternatives: pick("unresolvedAlternatives"),
    activeFrames: pick("activeFrames"),
    receivedPriors: pick("receivedPriors"),
  };
}

/**
 * The cube is a complete question surface, not 27 mandatory content bins.
 * A caller may answer only consequential addresses; unanswered addresses remain NUL.
 */
export async function interrogateCube(observations, neighborhood, { ask } = {}) {
  const results = [];
  for (const address of cubeAddresses()) {
    const answer = ask ? await ask({ address, observations, neighborhood }) : null;
    results.push({
      schema: "EOInterrogation@1",
      address,
      changed: Boolean(answer?.changed),
      effects: answer?.effects ?? [],
      evidence: answer?.evidence ?? null,
    });
  }
  return results;
}

/** Convert only explicitly warranted interrogation effects into EO transformations. */
export function deriveEOTransformations(interrogation = [], meta = {}) {
  const operations = [];
  for (const result of interrogation) {
    if (!result.changed) continue;
    for (const effect of result.effects ?? []) {
      const op = effect.op ?? result.address.op;
      const grain = effect.grain ?? result.address.grain;
      operations.push(eoOperation({
        op,
        grain,
        witness: effect.witness ?? result.evidence,
        consequence: effect.consequence ?? null,
        payload: effect.payload ?? null,
      }));
    }
  }
  return deltaFold(operations, meta);
}

// EOReader 7 canonical kernel facade.
//
// This file intentionally introduces no new behavior. It names the universal
// recursive reading spine already implemented in 6.1 so v7 can strip historical
// machinery behind one semantic boundary without forcing applications to move
// first.

// Fold: reconstructed epistemic state from append-only witness + EO change.
export {
  receivedGround,
  eoOperation,
  deltaFold,
  applyObservation,
  applyDelta,
  reconstruct,
} from "../engine/fold/index.js";

// Orientation: transient Fold-conditioned disposition toward the next encounter.
export { deriveOrientation } from "../engine/orientation/index.js";

// Perception and witness remain separate: priors may nominate; only witness admits.
export { perceive } from "../engine/perception/index.js";
export { witness } from "../engine/witness/index.js";

// EO interrogation and warranted transformation.
export {
  addressOf,
  cubeAddresses,
  relevantNeighborhood,
  interrogateCube,
  deriveEOTransformations,
} from "../engine/reasoning/fold-conditioned.js";

// Expectations and unresolved obligations live in the Fold trajectory.
export {
  expectation,
  expectationTransition,
  EXPECTATION_STATES,
} from "../engine/expectations/index.js";
export {
  obligation,
  openObligation,
  resolveObligation,
  carryObligations,
} from "../engine/obligations/index.js";

// Derived dynamics never mutate ontology.
export { deriveSurprise, deriveTension, deriveRelease } from "../engine/dynamics/index.js";

// Encounter-ordered recursion.
export { encounter, createRecursiveReader } from "../engine/reading/recursive.js";

// Generic hypergraph neighborhood used by interrogation; modality adapters remain outside.
export {
  hyperedge,
  graphObject,
  buildHypergraph,
  relevantHypergraphNeighborhood,
} from "../engine/hypergraph/index.js";

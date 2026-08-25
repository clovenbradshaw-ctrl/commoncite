// eoreader6 · packages/host — the host face of the engine.
//
// Thin by the constitution: session, I/O, and the reader's own surfaces.
// All measurement is imported from the engine; nothing here derives a figure
// the engine refused to produce.
export {
  createSession,
  admitChunked,
  ingestFile,
  searchSpans,
  spanUnits,
  foldSpans,
  readSpan,
  documentIds,
  documentText,
  sessionSegments,
  sessionOutline,
  snipSegment,
  sessionReferents,
  sessionRelations,
  CORPUS_API_VERSION,
} from "./corpus.js";

export { executePrompt } from "./surfer.js";

export { createSinger, singPass, singRun, apertureSeries, sing } from "./sing.js";

export {
  attachGraph,
  admitGraph,
  sessionGraphSnapshot,
  createGraph,
  readTriples,
  injectPrior,
  strongestEdges,
  edgeKey,
  structuralKey,
} from "./graph.js";

export { attachTiers, admitTiers, sessionTiersSnapshot } from "./tiers.js";

export { attachSelf, admitSelf, sessionSelfSnapshot, sessionTestimonyHolarchy, SELF, SELF_MISMATCH, WORLD } from "./self.js";

export { admitReading } from "./reading.js";

export { sessionTerrains, sessionKinds, kindsNullArm, foldExtract, TERRAIN_GRID } from "./terrains.js";

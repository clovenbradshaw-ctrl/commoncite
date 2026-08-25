import { gap, isGap, GAP_TYPES } from "../nul/index.js";

const hash = (str) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0);
  }
  return h.toString(16).padStart(8, "0");
};

const contentId = (sourceId, byteStart, text) =>
  hash(`${sourceId}:${byteStart}:${text}`);

export const register = (registry, { sourceId, byteStart, byteEnd, text, spec }) => {
  if (!sourceId) return gap("unreceived_origin", { reason: "passage needs a source" });
  if (!Number.isInteger(byteStart) || !Number.isInteger(byteEnd) || byteEnd <= byteStart)
    return gap("empty_material", { reason: "passage has no valid byte range" });
  if (!text || text.length === 0) return gap("empty_material", { reason: "passage has no text" });

  const refId = contentId(sourceId, byteStart, text);
  if (registry.has(refId)) return refId;

  const entry = Object.freeze({
    refId,
    sourceId,
    byteStart,
    byteEnd,
    text,
    spec: spec ?? null,
    registeredAt: registry.tick,
  });
  registry.set(refId, entry);
  registry.tick++;
  return refId;
};

export const lookup = (registry, refId) => {
  const entry = registry.get(refId);
  if (!entry) return gap("no_ground", { reason: `unknown passage: ${refId}` });
  return entry;
};

export const createRegistry = () => {
  const store = new Map();
  store.tick = 0;
  return store;
};

export const findBySource = (registry, sourceId) => {
  const results = [];
  for (const entry of registry.values()) {
    if (entry.sourceId === sourceId) results.push(entry);
  }
  return results;
};

export const search = (registry, query) => {
  const q = query.toLowerCase();
  const results = [];
  for (const entry of registry.values()) {
    if (entry.text.toLowerCase().includes(q)) results.push(entry);
  }
  return results;
};

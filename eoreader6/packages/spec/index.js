export const CORPUS_API_VERSION = 2;

// Re-exported so existing callers keep one import site. The implementation
// moved to ./canonical-json because the previous one here was not canonical:
// it called JSON.stringify(data, Object.keys(data).sort()), and an ARRAY
// second argument to JSON.stringify is a key ALLOWLIST, not a sort order —
// applied at every depth. Any nested field whose key did not also appear at
// the top level was silently dropped before hashing, so a seal built on it
// did not cover the nested values it was supposed to protect. That is fatal
// for a prediction commitment, whose whole job is to notice that
// predictive_output was edited between commit and reveal.
export { canonicalJsonStringify, canonicalHashSync } from "./canonical-json/index.js";

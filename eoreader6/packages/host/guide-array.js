// eoreader6 · packages/host/guide-array — the germline's memory: an
// explicit, received corpus of guides (survivors AND refusals), retrieval
// before generation. In the CRISPR system this is the array itself — the
// heritable archive of survived encounters the guides are transcribed
// from; immunity is retrieval, not re-invention. bin/priors carries the
// DATA (schema GuideArrayPrior@1, data only, no code, staged for
// eoPriors); this file carries the mechanics.
//
// DISCIPLINES, each borrowed from an organ that already enforces it:
//   received, named    schema + provenance checked on load, refusals typed
//                      (jati.js::checkKindPrior's shape)
//   memory never       a retrieved guide is a CANDIDATE: the caller re-runs
//   bypasses selection the gates against ITS OWN fixture. Selection happens
//                      every time; the array remembers what survived THERE,
//                      and "there" is not "here" until re-measured.
//   version-pinned     an entry archived under another germline version is
//                      refused on retrieval, never silently applied.
//   append, supersede  appendEntry is pure (data in, data out), dedupes by
//                      content hash, never deletes; refusals are archived
//                      with the same weight as survivors — they are the
//                      negative spacers scan rules get mined from.
//   retrieval is       survivors only are offered as exemplars; the match
//   typed              is mechanical (task-token overlap, the same
//                      tokenizer the engine reads with); no match is
//                      gap("no_candidate"), a result.

import { gap, isGap } from "../../nul/index.js";
import { tokenize } from "../engine/perceiver/text/material.js";
import { GERMLINE_API_VERSION } from "./germline.js";

export const GUIDE_ARRAY_SCHEMA = "GuideArrayPrior@1";

// FNV-1a over the entry's stable identity — same construction event_log
// uses, applied to (template, version, task, fillings).
const hash = (str) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
};

export const entryId = (e) =>
  hash(`${e.template}:${e.germline_version}:${e.task}:${JSON.stringify(e.fillings)}`);

/** Validate a loaded array. Returns the array data or a typed gap. */
export const receiveGuideArray = (data) => {
  if (!data || typeof data !== "object")
    return gap("unreceived_origin", { why: "a guide array is received, never assumed" });
  if (data.schema !== GUIDE_ARRAY_SCHEMA)
    return gap("unknown_spec", { reason: `unsupported schema ${data.schema}`, known: [GUIDE_ARRAY_SCHEMA] });
  if (!data.provenance?.source || !data.provenance?.built_by)
    return gap("unreceived_origin", { why: "a guide array names its provenance or it is indistinguishable from a fabrication" });
  if (!Array.isArray(data.entries))
    return gap("empty_material", { reason: "no entries" });
  for (const e of data.entries)
    if (!e.giver)
      return gap("unreceived_origin", { why: `entry ${e.id ?? "(unnamed)"} names no giver` });
  return data;
};

/**
 * Retrieve the best surviving guide for a task. Mechanical: task-token
 * overlap, survivors only, current germline version only. Returns
 * { entry, score, mustReEarn: true } or a typed gap — no_candidate when
 * nothing matches, unknown_spec when the only matches are version-pinned
 * to another germline.
 */
export const selectGuide = (data, task, { version = GERMLINE_API_VERSION } = {}) => {
  const received = receiveGuideArray(data);
  if (isGap(received)) return received;
  const want = new Set(tokenize(String(task ?? "")));
  if (!want.size) return gap("empty_material", { reason: "a task with no words retrieves nothing" });

  let best = null;
  let versionRefused = 0;
  for (const e of received.entries) {
    if (!e.outcome?.survived) continue; // refusals are archived, never exemplars
    if (e.germline_version !== version) { versionRefused++; continue; }
    const have = new Set(tokenize(e.task));
    let overlap = 0;
    for (const t of want) if (have.has(t)) overlap++;
    const score = overlap / want.size;
    if (score > 0 && (!best || score > best.score)) best = { entry: e, score };
  }
  if (!best) {
    if (versionRefused)
      return gap("unknown_spec", {
        reason: "reader_version_mismatch",
        why: `${versionRefused} surviving guide(s) exist but are pinned to another germline version — re-earn them, never silently apply`,
        expected: version,
      });
    return gap("no_candidate", { reason: "no surviving guide overlaps this task; generation proceeds from nothing, and its outcome should be archived" });
  }
  return Object.freeze({ ...best, mustReEarn: true });
};

/**
 * Append an entry (survivor or refusal). Pure — returns new array data;
 * callers own the file I/O. Dedupes by content id; never deletes.
 */
export const appendEntry = (data, entry) => {
  const received = receiveGuideArray(data);
  if (isGap(received)) return received;
  for (const field of ["template", "germline_version", "task", "fillings", "giver", "outcome"])
    if (entry?.[field] === undefined)
      return gap("undeclared", { what: `entry.${field}`, why: "an archive entry is complete or it is not an entry" });
  const id = entryId(entry);
  if (received.entries.some((e) => e.id === id)) return received; // idempotent
  return Object.freeze({
    ...received,
    entries: Object.freeze([...received.entries, Object.freeze({ ...entry, id })]),
  });
};

export { isGap };

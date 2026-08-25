// eoreader6 · goldens/shared/gutenberg — Project Gutenberg boilerplate
// stripping, shared by every golden that reads a PG plaintext edition.
//
// Previously duplicated verbatim in goldens/cast/read.mjs (as `body`) and
// goldens/network/read.mjs (as `bodyOf`) — the same eleven-line function,
// independently written twice. Consolidated here rather than left as two
// copies that could quietly drift apart.

/**
 * Everything between PG's own "*** START OF ..." / "*** END OF ..." markers
 * — the licensed work itself, without the distributor's front and back
 * matter. Falls back to the whole text when a marker is missing (some PG
 * editions omit one or both) rather than refusing outright.
 */
export const stripPgBoilerplate = (text) => {
  const s = text.indexOf("*** START OF");
  const e = text.indexOf("*** END OF");
  const from = s === -1 ? 0 : text.indexOf("\n", s) + 1;
  return text.slice(from, e === -1 ? text.length : e);
};

// eoreader6 · emergence/field — THE ARENA AS ONE EXTENT, CULTIVATED FROM PARTS.
//
//   SYN · Ground   Field · Cultivating   compose the whole field from its parts
//
// SYN at the Ground grain is the whole composed from parts — the inverse act of
// SEG at the Ground grain, which cuts reach-units out of the arena. The arena
// is the extent; its parts are reach-units (chunks, segments, spans), each
// carrying a byte address into its source. Composing the field is the act of
// returning the whole extent from its addressed parts, byte-exact, never a
// reconstruction (L1: a quote is a slice of the source at offset, never a
// paraphrase).
//
// The measurement is contiguity. A field composes only when its parts tile
// their source exactly: the next part begins where the previous ended, each
// part's text is byte-accurate against its declared offsets, and no part is
// missing. A gap is a missing part — the field is incomplete and the
// composition is refused, not silently filled. An overlap is two parts
// claiming the same bytes — a contradiction, refused by type.
//
// Multi-source is native: the field is ordered by source and, within each
// source, by byte offset. One extent per source, the field is the whole.
//
// DECLARED NUMBERS. None new — the extent is handed in by the parts' own
// addresses. The engine never declares the size of what it did not receive.

import { gap } from "../../../nul/index.js";

// The cell this organ occupies — declared, checked by conformance.
export const SYN_GROUND_CELL = Object.freeze({ op: "SYN", grain: "Ground" });

export const CELLS = Object.freeze([SYN_GROUND_CELL]);

/** The byte-exact length of text in UTF-8, the same ruler chunkText uses. */
const byteLength = (text) => Buffer.byteLength(String(text ?? ""), "utf8");

/**
 * Compose the whole field from its addressed parts.
 *
 * `parts` is an array of { source, byteStart, byteEnd, text } reach-units.
 * Composing refuses, by typed gap, anything that would silently lose or
 * invent material:
 *
 *   gap_between_parts   a part's byteStart does not equal the previous
 *                       part's byteEnd in the same source — a missing part.
 *   overlapping_parts   two parts of one source claim the same bytes.
 *   byte_mismatch       a part's declared byteEnd − byteStart disagrees with
 *                       the byte length of its own text — a lying address.
 *   empty_field         nothing to compose.
 *
 * Returns the composed extent per source, byte-exact and contiguous, with the
 * concatenated text as a slice of the source — never a reconstruction.
 */
export const composeField = (parts = []) => {
  if (!Array.isArray(parts) || parts.length === 0)
    return gap("empty_field", { reason: "nothing received to compose" });

  // Order by source, then by byte offset — the arena's own order.
  const ordered = [...parts].sort((a, b) =>
    a.source < b.source ? -1 : a.source > b.source ? 1 : a.byteStart - b.byteStart,
  );

  const sources = [];
  let current = null;

  for (const p of ordered) {
    const { source, byteStart, byteEnd, text } = p;
    if (typeof source !== "string" || source.length === 0)
      return gap("unknown_spec", { reason: "a part must name its source", part: p });
    if (!Number.isInteger(byteStart) || !Number.isInteger(byteEnd) || byteEnd < byteStart)
      return gap("unknown_spec", { reason: "a part's byte addresses must be integers with byteEnd >= byteStart", part: p });

    const declared = byteEnd - byteStart;
    const actual = byteLength(text);
    if (actual !== declared)
      return gap("byte_mismatch", {
        source,
        byteStart,
        byteEnd,
        declared,
        actual,
        reason: `a part declares ${declared} bytes but carries ${actual} — a lying address, refused by type`,
      });

    if (!current || current.source !== source) {
      current = { source, parts: [], from: byteStart, to: byteEnd };
      sources.push(current);
    } else {
      if (byteStart < current.to)
        return gap("overlapping_parts", { source, at: byteStart, reason: "two parts claim the same bytes" });
      if (byteStart > current.to)
        return gap("gap_between_parts", {
          source,
          at: byteStart,
          missing: byteStart - current.to,
          reason: `the previous part ended at ${current.to} but this one begins at ${byteStart} — a missing part`,
        });
      current.to = byteEnd;
    }

    current.parts.push({ source, byteStart, byteEnd });
    current.text = (current.text ?? "") + text;
  }

  for (const s of sources) {
    const whole = byteLength(s.text);
    if (whole !== s.to - s.from)
      return gap("byte_mismatch", {
        source: s.source,
        reason: `composed ${whole} bytes but the parts tile ${s.to - s.from} — the composition is not byte-exact`,
      });
  }

  return Object.freeze({
    field: Object.freeze(
      sources.map((s) =>
        Object.freeze({
          source: s.source,
          from: s.from,
          to: s.to,
          bytes: s.to - s.from,
          text: s.text,
          parts: Object.freeze(s.parts),
        }),
      ),
    ),
    bytes: sources.reduce((n, s) => n + (s.to - s.from), 0),
    contiguous: true,
  });
};

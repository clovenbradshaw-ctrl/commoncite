// eoreader6 · loops/self-holon — the testimony ledger's own holarchy.
//
// loops/self.js's ledger is deliberately flat: one commit, one regime, one
// recheck, no relationship to any other commit. That is correct for what
// self.js answers (does THIS claim still hold) but leaves every commit an
// island. A claim about a LARGER span of the same source is, by
// construction, partly made of whatever smaller claims sit inside it —
// Koestler's holon, the word this codebase's own holon_level and
// engine/holon/task-log.js already carry: a thing that is simultaneously a
// WHOLE (composed of what it contains) and a PART (of whatever contains it).
// This organ makes that relation explicit instead of leaving it implicit in
// geometry nothing ever reads.
//
// DECLARED, NOT MEASURED — the same honest standing engine/holon/task-log.js's
// own deriveLevels already carries for its depends_on graph (see that
// module's header, and its own reason: nul/index.js has no statistic shaped
// for a DISCRETE graph yet). A commit's regime containing another commit's
// regime is a stated geometric fact here, not itself run through a
// Born-null existence-dependency test the way holon_level/index.js tests a
// regime against the series it was drawn from. Building that (does a
// containing claim's own status genuinely, measurably depend on what it
// contains, rather than merely overlap it) is real, separate work, not done
// here — named plainly rather than dressed as something earned.
//
// THE ALGORITHM SHAPE IS NOT A SECOND INVENTION. above-map, depthOf, DFS
// cycle colouring below are the identical shape engine/holon/task-log.js's
// deriveLevels already uses for its own (different) domain — one existing,
// working pattern for "declared containment, not measured, walked into
// levels and cycles," reused rather than reinvented. The edge rule (regime
// containment vs. a received depends_on list) is the only thing that
// differs; earned_by reads "contains" here, never holon_level's own
// Born-null vocabulary, so a caller cannot mistake one standing for the
// other.

// The cell this organ occupies on the operator grid (engine/operators.js):
// SYN · Network · Composing — many commits read as one structure, the same
// cell emergence/graph.js declares for the belief graph; this is the
// testimony ledger's own network. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "SYN", grain: "Pattern" });

const contains = (outer, inner) =>
  outer.regime.start <= inner.regime.start &&
  inner.regime.end <= outer.regime.end &&
  !(outer.regime.start === inner.regime.start && outer.regime.end === inner.regime.end);

/**
 * The holarchy over a set of LIVE commits (one source's worth — a caller
 * scopes this the same way loops/self.js's own latestPriorCommits does):
 * which claims are wholes containing which others as parts, each commit's
 * depth (how many containing layers of testimony it sits under — 0 is a
 * commit contained by nothing else live), and any containment cycle.
 * Geometrically impossible for well-formed regimes with distinct starts (the
 * standing loops/self.js's own ledger already keeps, one commit per regime
 * start) — reported rather than silently assumed away, the same discipline
 * this file inherits from deriveLevels rather than trusting geometry blind.
 */
export function deriveTestimonyLevels(commits) {
  const above = new Map(commits.map((c) => [c, new Set()]));
  for (const whole of commits) {
    for (const part of commits) {
      if (whole === part) continue;
      if (contains(whole, part)) above.get(whole).add(part);
    }
  }

  const depthOf = (c, seen = new Set()) => {
    if (seen.has(c)) return 0; // cycle: report a peer-ish 0 rather than recurse
    const parts = above.get(c);
    if (!parts || parts.size === 0) return 0;
    const next = new Set(seen).add(c);
    return 1 + Math.max(...[...parts].map((p) => depthOf(p, next)));
  };

  const cycles = [];
  const seenCycle = new Set();
  const colour = new Map();
  const stack = [];
  const key = (c) => `${c.sourceId}:${c.regime.start}-${c.regime.end}:${c.committedAt}`;
  const walk = (c) => {
    const col = colour.get(c);
    if (col === "black") return;
    if (col === "grey") {
      const cycle = stack.slice(stack.indexOf(c));
      const cycleKey = cycle.map(key).sort().join("|");
      if (!seenCycle.has(cycleKey)) { seenCycle.add(cycleKey); cycles.push(Object.freeze([...cycle])); }
      return;
    }
    colour.set(c, "grey");
    stack.push(c);
    for (const part of above.get(c) ?? []) walk(part);
    stack.pop();
    colour.set(c, "black");
  };
  for (const c of commits) walk(c);

  const relations = [];
  for (let i = 0; i < commits.length; i++) {
    for (let j = i + 1; j < commits.length; j++) {
      const a = commits[i], b = commits[j];
      const aWholeOfB = above.get(a).has(b);
      const bWholeOfA = above.get(b).has(a);
      relations.push(Object.freeze({
        a, b,
        relation: aWholeOfB ? "a-whole-of-b" : bWholeOfA ? "b-whole-of-a" : "peer",
        earned_by: aWholeOfB || bWholeOfA ? "contains" : null,
        // DECLARED, NOT MEASURED (see this module's header) — the same
        // reserved-not-yet-consumed marker engine/holon/task-log.js's
        // deriveLevels now carries for its own declared-only relations. No
        // caller branches on it today. It is NOT a claim that
        // holon_level::holonLevelRelation (holon_level/index.js:178-184)
        // already returns a comparable flag: that function currently
        // returns a bare "above"/"peer"/"unstable" string, nothing else.
        measured: false,
      }));
    }
  }

  return {
    levels: commits.map((c) => Object.freeze({ commit: c, depth: depthOf(c) })),
    relations,
    cycles,
  };
}

/**
 * Given this admission's own SELF_MISMATCH results (loops/self.js's
 * recheckTestimony output, filtered to the mismatched ones), find every LIVE
 * commit whose claim is a whole containing one that just mismatched —
 * testimony that structurally rests on ground which just moved, even though
 * nothing tested THAT commit's own regime this admission (it may not even
 * have been live enough, or old enough, to be up for recheck yet).
 *
 * Reported, never silently re-verdicted: a whole's own tag never changes
 * here — only recheckTestimony, running that whole's own regime against the
 * material, is allowed to do that. This widens what a caller is TOLD, it
 * never invents a verdict holon_level itself did not produce. A watchmaker
 * does not reset a gear's own reading because a smaller gear inside it
 * slipped; the watchmaker flags that the smaller gear slipped and lets the
 * owner decide whether the whole mechanism needs opening up.
 */
export function cascadingMismatch(liveCommits, mismatchedCommits) {
  if (mismatchedCommits.length === 0) return [];
  const mismatched = new Set(mismatchedCommits);
  const affected = [];
  for (const whole of liveCommits) {
    if (mismatched.has(whole)) continue;
    const restsOn = [...mismatched].filter((part) => contains(whole, part));
    if (restsOn.length) affected.push(Object.freeze({ commit: whole, restsOn: Object.freeze(restsOn) }));
  }
  return affected;
}

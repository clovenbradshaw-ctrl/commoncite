// eoreader6 · emergence/shabda (शब्द) — WHO IS SPEAKING, OR BEING CITED.
//
// Nyāya's word for testimony — śabda pramāṇa, knowledge carried by an
// utterance rather than witnessed directly — is exactly this organ's claim:
// the best CURRENT testimony for an assertion, nested to any depth, always
// revisable.
//
// Frankenstein is Walton > Victor > Creature, and inside the creature's tale
// the cottagers' history and Safie's letters go deeper still. A flat list of
// narrator spans cannot express that — it has no notion of INSIDE — and it
// cannot be revised without being replaced. Both are fixed by making this
// EVENT-SOURCED, the same discipline referents/index.js already uses: the
// stack is a projection over an append-only log, so revising an attribution
// is appending a correction, never editing a fact.
//
// MODALITY-AGNOSTIC. Detection of who speaks is medium-specific (quote marks
// in prose, diarization in audio, a lower-third in video) and belongs in a
// perceiver. The STACK is not: nested attribution is the same structure for
// a podcast quoting a broadcast quoting a witness.
//
// AN ASSERTION, NOT A FACT. Every event carries a `basis` and a `tier`:
//
//   received  an injected prior naming its giver (eoPriors narrator spans).
//             Witness-tier: who holds the pen is not derivable from the text.
//   derived   read off the material (quote marks, attribution verbs).
//             Engine-tier, and defeasible.
//
// When two events disagree about the same position the received one wins and
// THE DISAGREEMENT IS REPORTED, never silently resolved — a contested
// attribution is exactly the signal worth surfacing, since handing the
// creature's act to Victor is the failure this whole channel exists to stop.
//
// Outside every asserted voice the answer is a typed gap. "Some narrator, and
// nothing here says which" is a result; guessing is the cardinal regression.

export const TIERS = Object.freeze(["received", "derived"]);

// The cell this organ occupies on the operator grid (engine/operators.js):
// DEF · Lens · Unraveling — who is speaking, or being cited; outside every
// asserted voice, a typed gap. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "DEF", grain: "Figure" });

export const MODES = Object.freeze(["speaks", "cited"]);

export const createShabdaLog = () => ({ events: [], seq: 0 });

const push = (log, event) => {
  if (!event.basis) throw new TypeError("shabda: every assertion must name its basis");
  if (!TIERS.includes(event.tier)) throw new TypeError(`shabda: unknown tier ${event.tier}`);
  log.events.push(Object.freeze({ ...event, seq: log.seq++ }));
  return log;
};

/** Assert that a voice opens here. `mode` distinguishes speaking from being quoted. */
export const enterShabda = (log, { referentId, at, basis, tier, mode = "speaks" }) => {
  if (!MODES.includes(mode)) throw new TypeError(`shabda: unknown mode ${mode}`);
  return push(log, { type: "SHABDA.enter", referentId, at, basis, tier, mode });
};

/** Assert that the innermost open voice closes here. */
export const exitShabda = (log, { at, basis, tier }) =>
  push(log, { type: "SHABDA.exit", at, basis, tier });

/**
 * Revise an earlier assertion. Not an edit — a later event that supersedes an
 * earlier one, so the original claim and the correction both stay in the log
 * and the change is auditable.
 */
export const reviseShabda = (log, { supersedes, referentId, at, basis, tier, mode = "speaks" }) =>
  push(log, { type: "SHABDA.revise", supersedes, referentId, at, basis, tier, mode });

const RANK = { received: 0, derived: 1 };

/**
 * Project the log into the stack in force at `offset`.
 *
 * Returns { stack, speaker, depth, contested } where `stack` is outermost
 * first — for Frankenstein at the right offset, [walton, victor, creature].
 * `speaker` is the innermost voice: whoever is talking right now.
 */
export const shabdaAt = (log, offset) => {
  const superseded = new Set(log.events.filter((e) => e.supersedes != null).map((e) => e.supersedes));
  const events = log.events
    .filter((e) => !superseded.has(e.seq) && e.at <= offset)
    .sort((a, b) => a.at - b.at || a.seq - b.seq);

  const stack = [];
  for (const e of events) {
    if (e.type === "SHABDA.exit") stack.pop();
    else stack.push({ referentId: e.referentId, from: e.at, basis: e.basis, tier: e.tier, mode: e.mode });
  }

  // Competing assertions at the same depth: the received one holds, and the
  // conflict is surfaced rather than dissolved.
  const contested = [];
  const atThisOffset = log.events.filter((e) => !superseded.has(e.seq) && e.type !== "SHABDA.exit" && e.at === offset);
  if (atThisOffset.length > 1) {
    const ids = new Set(atThisOffset.map((e) => e.referentId));
    if (ids.size > 1) {
      const best = [...atThisOffset].sort((a, b) => RANK[a.tier] - RANK[b.tier])[0];
      contested.push({ at: offset, candidates: atThisOffset.map((e) => ({ referentId: e.referentId, tier: e.tier, basis: e.basis })), held: best.referentId });
    }
  }

  if (stack.length === 0) {
    return {
      stack: [], speaker: null, depth: 0, contested,
      gap: {
        reason: "shabda_unasserted_at_offset",
        tier: "model",
        needsWitness: true,
        offset,
        detail: "no voice is asserted here; who is speaking or being cited is not derivable from the material alone",
      },
    };
  }

  return { stack, speaker: stack[stack.length - 1], depth: stack.length, contested };
};

/** Every position where the innermost voice changes — the attribution spine. */
export const shabdaTransitions = (log) => {
  const superseded = new Set(log.events.filter((e) => e.supersedes != null).map((e) => e.supersedes));
  const events = log.events.filter((e) => !superseded.has(e.seq)).sort((a, b) => a.at - b.at || a.seq - b.seq);
  const out = [];
  const stack = [];
  for (const e of events) {
    const before = stack.length ? stack[stack.length - 1].referentId : null;
    if (e.type === "SHABDA.exit") stack.pop();
    else stack.push({ referentId: e.referentId, tier: e.tier });
    const after = stack.length ? stack[stack.length - 1].referentId : null;
    if (before !== after) out.push({ at: e.at, from: before, to: after, depth: stack.length, tier: e.tier });
  }
  return out;
};

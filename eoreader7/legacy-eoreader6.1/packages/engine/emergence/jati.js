// eoreader6 · emergence/jati (जाति) — UNDERSTANDING A POPULATION AS A KIND,
// OR INVENTING THE KIND, ON THE ONE NEURAL NET.
//
// Nyāya's word for a natural-kind universal — jāti is a species of sāmānya
// (loops/samanya.js): the same "does this genuinely hold" question, asked
// specifically of a population of beings rather than of a relationship.
//
// The reader meets content full of beings — people in a text, agents in a
// video, voices in a score — and asks the question this organ exists for:
//
//     Do I already understand what these are, or do I have to learn it?
//
// "People" was only ever text's name for the general case; the mechanism
// never reads one (II.1). A leitmotif does not need the word "person", and
// nothing here depends on a name string. The population is a set of records
// carrying structural facts, whatever modality handed them in.
//
// THE SUBSTRATE IS THE GRAPH (emergence/graph.js) — the reader's neural net,
// and the only belief the engine holds. Nodes are beings, edges are weighted
// relations that decay by `gamma` and move by bayesian surprise. This organ
// measures on that substrate and stores nothing beside it:
//
//   deriveBeingRecords   the net's incident structure, read as records —
//                        identity by consequence (a being IS what it is
//                        incident to), the same incidentOf revision.js reads
//                        as standpoint, read here as a profile.
//   checkKindPrior       does a received kind prior (KindVocabulary@1) cover
//                        this population for this reader version? A missing
//                        prior is a typed gap (III.3), never a silently
//                        wrong number.
//   inventKind           kinds.js over the records: the SIG→CON→EVA→DEF→INS→
//                        SYN chain, the two Born gates, height DISCOVERED
//                        (above / peer / unstable), ground (key / value /
//                        both).
//   reviseKinds          revisable like everything else (IV.5): re-derive
//                        from the advanced net, re-induce, and KEEP what was
//                        revoked — exclusion is part of the update (II.9).
//   foldHolons           holons on holons: a kind is a whole built from its
//                        members and, reified, a part of the level above it;
//                        the fold halts where the material does.
//
// WHO UNDERSTANDS WHAT IS A PRIOR QUESTION, NEVER AN ENGINE ANSWER. What a
// person is is witness-tier knowledge; if eoPriors ever ships a kind prior
// for a population, `checkKindPrior` finds it and this organ invents nothing.
// The engine's acts are the CHECK (mechanical, addressed) and the INDUCTION
// (measured). The content of a prior is a gift.
//
// Declared, never defaulted (SEED.md #7): population, readerVersion, the
// kinds organ's own numbers (minPrevalence, minKindSize, permutations,
// quantile, seed, and `reseeds` — kinds.js requires it unconditionally now:
// CON's own search must be nulled against itself whether the records read as
// values, which graph-derived records always do, or by key alone). The
// graph's `gamma` is graph.js's declared number, carried through untouched.

import { gap, isGap } from "../../../nul/index.js";
import { induceKinds, inductionReading } from "./kinds.js";

// The cells this organ occupies on the operator grid (engine/operators.js):
// EVA · Paradigm · Tracing — the witness that the reader understands this
// population as a kind, or the typed gap that says it does not; and SYN ·
// Network · Composing — the invention itself, the kind compiled from the
// material's own structural facts. Declared, checked by conformance.
export const CELLS = Object.freeze([
  Object.freeze({ op: "EVA", grain: "Pattern" }),
  Object.freeze({ op: "SYN", grain: "Pattern" }),
]);

// ── the neural net, read as records ─────────────────────────────────────────
// graph.js stores `subject|[!]verb|object` edge keys. Parsing them back is
// what lets a being's role be seen as a role rather than as a string.

const endpointsOf = (key) => {
  const i = key.indexOf("|");
  const j = key.lastIndexOf("|");
  return { s: key.slice(0, i), o: key.slice(j + 1) };
};

const negatedEdge = (key) => key.includes("|!");

/**
 * The graph's incident structure, read as being-records for kinds induction.
 *
 * A being's record is entirely what it is incident to — never a stored
 * taxonomy, never a name string. Four numeric facts, each an earned
 * measurement of the net:
 *
 *   relations       total incident edge weight — how much belief the being
 *                   carries right now (decay is the forgetting)
 *   partners        distinct co-participants — breadth of the net around it
 *   subject_share   fraction of incident edges where the being is the subject
 *                   — agency, read from the graph's own orientation
 *   negated_share   fraction of incident edges with negative polarity — how
 *                   much of its world is asserted as not
 *
 * A being whose edges have all decayed below the prune floor has no incident
 * structure and therefore no record: the net no longer believes it, and a
 * belief with no weight is not a being. That dropout is the revisability of
 * the population itself, and it is deliberate.
 */
export const deriveBeingRecords = (graph, { population } = {}) => {
  if (!graph || !(graph.edges instanceof Map) || !(graph.nodes instanceof Map))
    throw new TypeError("deriveBeingRecords: a graph with edge and node Maps is required");
  if (typeof population !== "string" || population.length === 0)
    throw new TypeError("deriveBeingRecords: population is declared, never defaulted");

  const incident = new Map();
  for (const id of graph.nodes.keys())
    incident.set(id, { total: 0, edges: 0, partners: new Set(), subject: 0, negated: 0 });

  for (const [k, w] of graph.edges) {
    const { s, o } = endpointsOf(k);
    const neg = negatedEdge(k);
    const sub = incident.get(s);
    const obj = incident.get(o);
    if (sub) { sub.total += w; sub.edges++; sub.subject++; sub.partners.add(o); if (neg) sub.negated++; }
    if (obj) { obj.total += w; obj.edges++; obj.partners.add(s); if (neg) obj.negated++; }
  }

  const records = [];
  for (const [id, d] of incident) {
    if (d.edges === 0) continue;
    records.push(Object.freeze({
      id,
      attributes: Object.freeze([
        Object.freeze({ field_id: "relations", value_type: "numeric", value: d.total, count: d.edges }),
        Object.freeze({ field_id: "partners", value_type: "numeric", value: d.partners.size, count: 1 }),
        Object.freeze({ field_id: "subject_share", value_type: "numeric", value: d.subject / d.edges, count: 1 }),
        Object.freeze({ field_id: "negated_share", value_type: "numeric", value: d.negated / d.edges, count: 1 }),
      ]),
    }));
  }
  return Object.freeze(records);
};

// ── the priors check ─────────────────────────────────────────────────────────

/**
 * Does a received kind prior cover this population, for this reader version?
 *
 * The channel is `KindVocabulary@1` (eoPriors/docs/03-prior-spec-kind-
 * vocabulary.md): a published artifact carries kinds WITHOUT a member roster —
 * membership is engine-internal, so the address is the declared `population`
 * under a pinned `reader_version`. A prior built for another reader version is
 * refused loudly and by name (the channel's own §3.3 rule), never silently
 * used. A prior that does not satisfy the channel is reported as refused, and
 * the result is the typed gap — because the absence of understanding IS the
 * finding this check exists to produce.
 *
 * A prior that does not name its giver is a wall, not a gap-in-waiting
 * (II.2): a prior without provenance is indistinguishable from a fabrication.
 */
export const checkKindPrior = (priors, { population, readerVersion } = {}) => {
  if (!Array.isArray(priors))
    throw new TypeError("checkKindPrior: priors must be an array — an empty list is a claim, a missing one is not");
  if (typeof population !== "string" || population.length === 0)
    throw new TypeError("checkKindPrior: population is declared, never defaulted");
  if (typeof readerVersion !== "string" || readerVersion.length === 0)
    throw new TypeError("checkKindPrior: readerVersion is declared, never defaulted");

  const refused = [];
  for (const p of priors) {
    if (!p || typeof p !== "object") {
      refused.push({ giver: "(malformed)", reason: "not an object" });
      continue;
    }
    if (!p.giver)
      throw new TypeError(`checkKindPrior: a prior must name its giver — a prior without one is indistinguishable from a fabrication`);
    if (p.reader_version !== readerVersion) {
      refused.push({ giver: p.giver, reason: "reader_version_mismatch", expected: readerVersion, got: p.reader_version });
      continue;
    }
    if (p.schema !== "KindVocabulary@1") {
      refused.push({ giver: p.giver, reason: "unsupported_schema", schema: p.schema });
      continue;
    }
    const kind = (p.kinds ?? []).find((k) => k?.population === population);
    if (kind) return Object.freeze({ found: true, kind, giver: p.giver, prior: p });
  }

  return gap("missing_kind_prior", {
    population,
    readerVersion,
    checked: priors.length,
    refused: Object.freeze(refused),
  });
};

// ── the invention ────────────────────────────────────────────────────────────

/**
 * The SYN act: a kind the reader had no prior for, induced from the material's
 * own structural facts. Every kind returns holonically placed — height earned
 * by the two Born gates, ground naming the channel that carried it — and
 * stamped as invented, so the difference between a received understanding and
 * an induced one is always visible in the record.
 */
export const inventKind = (records, { population, ...kindOpts } = {}) => {
  if (typeof population !== "string" || population.length === 0)
    throw new TypeError("inventKind: population is declared, never defaulted");
  const kinds = induceKinds(records, { population, ...kindOpts });
  return Object.freeze({
    population,
    kinds,
    invented: true,
    via: "induceKinds",
    declared: Object.freeze({ population, ...kindOpts }),
  });
};

// ── the one question, asked whole ────────────────────────────────────────────

/**
 * The reader's whole act: does this population already have a kind, or does
 * the material have to teach it one?
 *
 *   understanding: "prior"     a KindVocabulary@1 gift covered the population
 *                              — nothing invented, the gift's kind is the
 *                              understanding, its giver is named.
 *   understanding: "invented"  no compatible prior — the typed gap is kept as
 *                              part of the invention's provenance (a gap is a
 *                              result, SEED.md #8), and the kinds are induced
 *                              from the records. `reading` reports how the
 *                              records were actually read (which fields earned
 *                              values, which fell back to presence, and why).
 */
export const understand = (records, { priors, population, readerVersion, ...kindOpts } = {}) => {
  if (!Array.isArray(records))
    throw new TypeError("understand: records are required — understanding nothing is not a question");
  const prior = checkKindPrior(priors, { population, readerVersion });

  if (!isGap(prior)) {
    return Object.freeze({
      understanding: "prior",
      population,
      readerVersion,
      giver: prior.giver,
      prior_kind: prior.kind,
      kinds: null,
      reading: null,
    });
  }

  const kinds = induceKinds(records, { ...kindOpts, population });
  return Object.freeze({
    understanding: "invented",
    population,
    readerVersion,
    prior,
    kinds,
    reading: inductionReading(records, kindOpts),
  });
};

// ── revisability ─────────────────────────────────────────────────────────────
// A kind is not a verdict passed once (Amendment IV, consequence 2). Re-reading
// the net after more material yields a new induction; `reviseKinds` is the
// diff, and its shape IS the update rule: exclusion is part of the update, so
// a kind that no longer stands is REVOKED AND KEPT, never silently deleted.

const memberSet = (kind) => new Set(kind.members);

/**
 * Diff two inductions of the same population, one earlier and one later.
 *
 *   kept     same member set — the kind stood and still stands
 *   revised  a later kind stands on a partial overlap of an earlier one —
 *            the membership moved, and what was gained and lost is stated
 *   added    a kind with no earlier footprint — the material taught something
 *            new
 *   revoked  an earlier kind no later induction stands on — KEPT in the
 *            record, with its reason, because a discarded alternative is
 *            consequential evidence and does not vanish (II.9)
 *
 * Determinism: the output is a pure function of the two inputs, in their
 * order. The caller declares what changed the material; this organ measures
 * the difference.
 */
export const reviseKinds = (prevKinds, nextKinds) => {
  if (!Array.isArray(prevKinds) || !Array.isArray(nextKinds))
    throw new TypeError("reviseKinds: both the earlier and the later kind lists are required");

  const nextById = new Map(nextKinds.map((k) => [k.id, k]));

  const kept = [];
  const revised = [];
  const revoked = [];
  const spokenFor = new Set();

  for (const p of prevKinds) {
    if (nextById.has(p.id)) {
      kept.push(p);
      spokenFor.add(p.id);
      continue;
    }
    const pSet = memberSet(p);
    let best = null;
    let bestOverlap = 0;
    for (const n of nextKinds) {
      const overlap = [...memberSet(n)].filter((m) => pSet.has(m)).length;
      if (overlap > bestOverlap) { bestOverlap = overlap; best = n; }
    }
    if (best && bestOverlap > 0) {
      revised.push({
        from: p,
        to: best,
        lost_members: [...pSet].filter((m) => !memberSet(best).has(m)),
        added_members: [...memberSet(best)].filter((m) => !pSet.has(m)),
      });
      spokenFor.add(best.id);
    } else {
      revoked.push({
        kind: p,
        reason: "no later induction stands on this membership — revoked, and kept: exclusion is part of the update",
      });
    }
  }

  const added = nextKinds.filter((n) => !spokenFor.has(n.id));

  return Object.freeze({ kept, added, revised, revoked });
};

// ── holons on holons ─────────────────────────────────────────────────────────
// A kind is a whole built from its members and, reified, a part of the level
// above it — Koestler's holon, earned rather than named: whether a level exists
// at all is the material's answer, and 0/1 kinds is a first-class halt.

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const mode = (xs) => {
  const counts = new Map();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0];
};

/**
 * Reify a kind into a record for the level above: its member records'
 * attributes, aggregated. The reified record's id IS the kind's member set —
 * identity by consequence, never a label. Numeric facts mean over the members,
 * categorical/boolean take their mode; a field no member carried a value for
 * stays presence. The aggregation is testimony about the members, nothing
 * more — it names no scale and asserts no level.
 */
export const reify = (kinds, records) => {
  if (!Array.isArray(kinds) || !Array.isArray(records))
    throw new TypeError("reify: kinds and their member records are required");
  const byId = new Map(records.map((r) => [r.id, r]));

  return kinds.map((kind) => {
    const members = kind.members.map((id) => byId.get(id)).filter(Boolean);
    const fields = new Map();
    for (const rec of members) {
      for (const a of rec.attributes ?? []) {
        let f = fields.get(a.field_id);
        if (!f) { f = { value_type: a.value_type, values: [] }; fields.set(a.field_id, f); }
        if (a.value !== undefined) f.values.push(a.value);
      }
    }
    const attributes = [...fields.entries()].map(([field_id, f]) => {
      if (f.values.length === 0) return Object.freeze({ field_id, value_type: f.value_type, count: members.length });
      if (f.value_type === "numeric") return Object.freeze({ field_id, value_type: f.value_type, value: mean(f.values), count: f.values.length });
      return Object.freeze({ field_id, value_type: f.value_type, value: mode(f.values), count: f.values.length });
    });
    return Object.freeze({
      id: kind.id,
      label: kind.label,
      attributes: Object.freeze(attributes),
      members: Object.freeze([...kind.members]),
    });
  });
};

/**
 * The recursive fold: induce at level n, reify the kinds that stood, induce
 * over the reified records at level n+1 — the same function, a different
 * input level (the eoPriors fold-holons discipline). The fold halts where the
 * material does: fewer than two kinds means there is nothing to reify into a
 * holon, and fewer records than the declared `minKindSize` means the level
 * has no population to induce over. Halting is a result, never an error.
 *
 * `levels` is declared, never defaulted: how high the fold MAY reach. Each
 * level's kinds carry their own holonic height and operator chain; the ladder
 * is the discovery, and names are never assigned to it.
 */
export const foldHolons = (records, { population, levels, ...kindOpts } = {}) => {
  if (!Array.isArray(records) || records.length === 0)
    throw new TypeError("foldHolons: records are required — a fold over nothing is not a fold");
  if (typeof population !== "string" || population.length === 0)
    throw new TypeError("foldHolons: population is declared, never defaulted");
  if (!Number.isInteger(levels) || levels < 1)
    throw new TypeError("foldHolons: levels is declared, never defaulted — how high the fold may reach");

  const ladder = [];
  let current = records;
  let halted = null;

  for (let level = 0; level < levels; level++) {
    if (current.length < kindOpts.minKindSize) {
      halted = {
        at: level,
        reason: `the material has ${current.length} record(s) at level ${level}, below the declared minKindSize ${kindOpts.minKindSize}`,
      };
      break;
    }
    const pop = level === 0 ? population : `${population}#L${level}`;
    const kinds = induceKinds(current, { ...kindOpts, population: pop });
    ladder.push({ level, population: pop, records: current, kinds });
    if (kinds.length < 2) {
      halted = {
        at: level + 1,
        reason: "fewer than two kinds — the fold halts where the material does (nothing to reify into a holon)",
      };
      break;
    }
    current = reify(kinds, current);
  }

  return Object.freeze({ population, ladder: Object.freeze(ladder), halted });
};

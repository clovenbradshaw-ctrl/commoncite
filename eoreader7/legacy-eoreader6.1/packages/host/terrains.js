// eoreader6 · packages/host/terrains — one admitted source, served on the
// nine-terrain grid.
//
// AN ASSEMBLER, NOT AN ORGAN — no CELL is declared here (precedent:
// host/sing.js), because nothing here measures. Each surface below is served
// by the organ that owns it, at that organ's own standing, and this file's
// whole job is to put those surfaces on the grid the representation standard
// ratified (12-terrains-as-representation-standard.md; the names come from
// engine/operators.js's own TERRAIN_BY_DOMAIN, never restated):
//
//   Void        the gap ledger — every typed gap the organs below reported,
//               organ-tagged. Computed-and-empty is a different mark from
//               not-computed, which is different again from refused (nul's
//               six silences; here each entry keeps the organ's own typing).
//   Entity      corpus.js::sessionReferents — the discovered cast.
//   Kind        sessionKinds() below — emergence/kinds.js::induceKinds over
//               token-form records built from the admitted chunks. Split out
//               of sessionTerrains because it is minutes-expensive, not
//               milliseconds-expensive, and a caller schedules it separately.
//   Field       the admitted chunks in source order, byte-addressed, plus
//               corpus.js::sessionOutline — deliberately zero-inference.
//   Link        corpus.js::sessionRelations — (subject, verb, object,
//               polarity) triples, each a Figure.
//   Network     graph.js::admitGraph + sessionGraphSnapshot — the belief
//               graph over those triples, canonicalised through the cast.
//   Atmosphere  material.js::causalSurprisalSeries over the reader's own
//               word chunks (host/reading.js's numbers, unchanged) +
//               loops/atmosphere.js::readAtmosphere for regions/events.
//               Byte anchors come from tokenizeWithOffsets + locate() —
//               measured, never re-derived.
//   Lens        NOT SERVED, by construction: a lens is declared by a reader
//               (a saved view with a giver), never extracted from content.
//               Reported as a typed gap so the omission stays visible.
//   Paradigm    the frame that says how to read everything else: the grid
//               itself, this file's declared constants with their givers,
//               and the corpus API version. Received knowledge, giver named.
//
// WHAT THIS FILE MAY NOT DO (the-fold/CLAUDE.md, constitution II.12): derive
// a terrain from a passage. The cube was measured and refuted as a content
// classifier — 95.7% of cell assignments survived word-shuffling. Nothing
// here labels content BY terrain; the terrains are the surfaces of the
// reading, not classifications of the source.

import {
  sessionOutline,
  sessionReferents,
  sessionRelations,
  CORPUS_API_VERSION,
} from "./corpus.js";
import { attachGraph, sessionGraphSnapshot, referentLookup, referentFace, reconcileGraphStandings } from "./graph.js";
import { readTriples, strongestEdges, nodeWeights } from "../engine/emergence/graph.js";
import { readLinks, bindingTriples } from "../engine/emergence/binding.js";
import { splitSentences } from "../engine/perceiver/text/spans.js";
import { diaNorm } from "../engine/perceiver/text/surfaces.js";
import {
  tokenize,
  chunkWords,
  causalSurprisalSeries,
  tokenizeWithOffsets,
  locate,
  buildFrequencyTable,
  functionWordSet,
  surprisalMicrobits,
} from "../engine/perceiver/text/material.js";
import { readAtmosphere } from "../engine/loops/atmosphere.js";
import { induceKinds, inductionReading } from "../engine/emergence/kinds.js";
import { DOMAINS, GRAINS, TERRAIN_BY_DOMAIN } from "../engine/operators.js";

// ── declared numbers, each with its giver ───────────────────────────────────
// host/reading.js's own chunk size, unchanged — the same 40-word chunk
// read.mjs always built, so an Atmosphere series here and one from
// admitReading are the same measurement.
const CHUNK_WORDS = 40;

// loops/atmosphere.js's own calibrated regime numbers: window=5/draws=256/
// tolerance=3 is the parameter set conformance/atmosphere.test.js declares
// and scripts/adversarial/challenge-7 measured false-re-zero rates against.
// hop = window is NOT an optimisation: the slack-run null is calibrated at
// that stride, and loops/reading-regime.js records the measured false-alarm
// difference — 55-90% at stride 1 versus 0-3% at stride `window`. (It also
// happens to be the difference between 148s and ~30s on a 3.3MB novel.)
// statistic and seed are left at readAtmosphere's own declared defaults.
const ATMOSPHERE_REGIME = Object.freeze({ window: 5, draws: 256, tolerance: 3, hop: 5 });

// This file's own engineering starting points — caps on what one response
// carries, not on what was computed. Every truncation they cause is counted
// in the surface it truncates (constitution III.3: filtered-out is rendered,
// not merely removed). Givers: this file, unvalidated against any golden.
const FIELD_PREVIEW_CHARS = 280;
const RELATION_CAP = 500;
const GRAPH_LIMIT = 240;
// The reading cursor's resolution: the graph is admitted in this many
// ordered batches, a snapshot taken after each, so a reader can scrub
// belief-as-of-a-point-in-the-read. Decay applies per batch — that is the
// organ's own semantics (every readTriples call decays, by design), so the
// staged final state IS a reading in stages, stated as such, not a
// re-implementation of the one-call state.
const GRAPH_STAGES = 12;

// Binding — the modality-blind co-arrival Link over the cast, nulled by
// displacement and reversal inside emergence/binding.js itself. The three
// numbers are scripts/read-frankenstein.mjs's own declared block, unchanged
// (BINDING_WINDOW/BINDING_DRAWS/seed 42): the SVO ladder sees only clause
// shapes, and a document can bind its cast without ever putting them in one
// clause — this organ sees that, and only its witnessed (null-clearing)
// pairs feed the graph.
const BINDING = Object.freeze({ window: 2, draws: 199, seed: 42 });
// Recurring-form binding: the same co-arrival organ, run over the document's
// own recurring vocabulary (non-function-word forms with at least 2 sentence
// arrivals — binding's structural minimum, not a tuned floor: one arrival
// has no co-arrival to test). This is what a concept document is MADE of —
// measured on SEED-SPEAKER.md, whose cast ladder yielded four
// sentence-initial capitals with one arrival each while "ground", "fold"
// and "null" recurred through the whole text unseen. The function-word
// exclusion is the engine's own Zipf-derived closed class. The form cap
// bounds the O(forms²) pair test; its truncation is counted.
const TERM_FORMS_CAP = 24;
// Form binding's own draw count — an interactive dial, declared and carried
// on the result. 64 draws buy a rank no finer than 1/64 (II.4), said out
// loud; the cast binding above keeps the script's 199 because a cast
// register is small. MEASURED on the 120KB Frankenstein head: 60 forms at
// 199 draws ≈ 64s per read; 40 at 64 ≈ 45s; 24 at 64 ≈ 16s — the pair
// nulls are the cost, so the form cap is the dial. Giver: this file.
const FORM_BINDING = Object.freeze({ window: 2, draws: 64, seed: 42 });
// Cost bound on the arrival scan (sentences × surfaces), an engineering
// starting point; beyond it binding reports censored-above rather than
// stalling a read. Giver: this file, unvalidated.
const BINDING_SCAN_CAP = 6_000_000;

// The declared-constants table, exported through Paradigm so a reader sees
// the physiology of the instrument, not just its output.
const DECLARED = Object.freeze([
  { name: "CHUNK_WORDS", value: CHUNK_WORDS, giver: "host/reading.js (unchanged; read.mjs's own chunk size)" },
  { name: "ATMOSPHERE_REGIME.window", value: ATMOSPHERE_REGIME.window, giver: "conformance/atmosphere.test.js + scripts/adversarial/challenge-7 (measured false-re-zero rates)" },
  { name: "ATMOSPHERE_REGIME.draws", value: ATMOSPHERE_REGIME.draws, giver: "conformance/atmosphere.test.js (resolution of testimony: finest rank sayable is 1/draws)" },
  { name: "ATMOSPHERE_REGIME.tolerance", value: ATMOSPHERE_REGIME.tolerance, giver: "conformance/atmosphere.test.js" },
  { name: "ATMOSPHERE_REGIME.hop", value: ATMOSPHERE_REGIME.hop, giver: "loops/reading-regime.js — the null is calibrated at stride=window (55-90% false alarms at stride 1, 0-3% at window)" },
  { name: "FIELD_PREVIEW_CHARS", value: FIELD_PREVIEW_CHARS, giver: "host/terrains.js — engineering starting point, unvalidated" },
  { name: "RELATION_CAP", value: RELATION_CAP, giver: "host/terrains.js — engineering starting point, unvalidated" },
  { name: "GRAPH_LIMIT", value: GRAPH_LIMIT, giver: "host/terrains.js — engineering starting point, unvalidated" },
]);

// What each terrain CANNOT see — the "Blind to" column of
// 12-terrains-as-representation-standard.md §2, carried with the grid so a
// consumer switching interfaces can show what the new surface is blind to.
// Received, giver: that document (ratified 2026-08-14). Never computed.
const BLIND_TO = Object.freeze({
  Void: "everything particular",
  Entity: "relation & type",
  Kind: "the individual",
  Field: "named relations",
  Link: "the whole",
  Network: "the moment & individual salience",
  Atmosphere: "fixed reference (it re-zeros)",
  Lens: "its own contingency",
  Paradigm: "what it excludes",
});

// Cross-domain dependency, §3 Type B of the same standard: the four edges
// the engine actually builds, all sloping forward. A Pattern rendered
// straight off a Ground with no Figure between is the desert cell and is
// refused (FOLD-CONSTITUTION II.12: "No Pattern from a Ground without a
// Figure between"). Received, giver: 12-terrains §3.
const DEPENDS_ON = Object.freeze({
  Link: Object.freeze(["Entity"]),
  Kind: Object.freeze(["Link"]),
  Network: Object.freeze(["Entity", "Link"]),
  Paradigm: Object.freeze(["Kind", "Field"]),
});

// The grid, read off the engine's canon — [{terrain, domain, grain,
// blindTo, dependsOn}, ...] in domain-major order, so a consumer renders
// the 3×3 without restating names.
export const TERRAIN_GRID = Object.freeze(
  DOMAINS.flatMap((domain) =>
    GRAINS.map((grain) => {
      const terrain = TERRAIN_BY_DOMAIN[domain][grain];
      return Object.freeze({ terrain, domain, grain, blindTo: BLIND_TO[terrain], dependsOn: DEPENDS_ON[terrain] ?? Object.freeze([]) });
    }),
  ),
);

const gapEntry = (terrain, organ, gap) => ({ terrain, organ, ...(typeof gap === "string" ? { reason: gap } : gap) });

// Which operator cell serves each surface — for a caller journaling what was
// DONE to material (a space's log). Only cells an organ itself declares are
// stated; a surface whose serving path declares no single cell says so,
// rather than wearing a guessed address (II.12: addresses are declared,
// never inferred).
export const SURFACE_CELLS = Object.freeze({
  Field: Object.freeze({ op: "INS", grain: "Ground", organ: "host/corpus.js::admitChunked", giver: "host/graph.js header: admitChunked instantiates INS · Ground at host tier" }),
  Network: Object.freeze({ op: "SYN", grain: "Pattern", organ: "host/graph.js + emergence/graph.js", giver: "host/graph.js CELL, declared and conformance-checked" }),
  Atmosphere: Object.freeze({ op: "EVA", grain: "Figure", organ: "emergence/surprise.js lineage via perceiver/material.js", giver: "emergence/surprise.js CELL (EVA · Figure)" }),
  Entity: Object.freeze({ op: null, organ: "host/corpus.js::sessionReferents", note: "the cast ladder spans cells; no single declared address" }),
  Link: Object.freeze({ op: null, organ: "host/corpus.js::sessionRelations", note: "the relation ladder spans cells; no single declared address" }),
  Kind: Object.freeze({ op: null, organ: "emergence/kinds.js::induceKinds", note: "kinds.js declares CELLS (plural); no single address is claimed here" }),
});

/**
 * Every terrain surface the session's organs can serve for one admitted
 * source, in one call — except Kind, which is minutes-expensive and lives in
 * sessionKinds() below so a caller can schedule it as a job.
 *
 * The source must already be admitted (admitChunked / ingestFile). A missing
 * source returns a typed gap, never a throw — the caller may be probing.
 *
 * NETWORK AND DOUBLE-ADMISSION: admitGraph advances belief on every call by
 * design (a relation restated is evidence). This assembler keeps the
 * admit-once-per-source discipline admitGraph's own header assigns to its
 * caller, via a per-session record of sources already read into the graph —
 * so calling sessionTerrains twice reports the same belief instead of
 * silently doubling it.
 *
 * `emit(terrain, surface)` (optional): called once per surface AS IT IS
 * COMPUTED, cheapest organs first (Field, Atmosphere, then the cast and
 * what builds on it), so a caller streaming to a reader can reveal each
 * surface the moment it exists instead of waiting on the slowest organ.
 * Measured on the 3.3MB Tolstoy: Field is ready in milliseconds, the cast
 * ~90s later — a single-return caller sees nothing for the whole span.
 * The return value is unchanged and complete either way; Void is emitted
 * last because the ledger accumulates every organ's gaps.
 */
export function sessionTerrains(session, { sourceId, emit } = {}) {
  const doc = session.documents.get(sourceId);
  if (!doc) {
    return { sourceId, gap: { reason: "unknown_source", detail: `no admitted document named "${sourceId}"` } };
  }
  const say = typeof emit === "function" ? emit : () => {};
  const text = doc.text || "";
  const voidLedger = [];

  // ── Field · Structure·Ground — the admitted chunks, in order, byte-addressed
  const units = (doc.chunks || []).map((c, i) => ({
    i,
    byteStart: c.byteStart,
    byteEnd: c.byteEnd,
    preview: c.text.length > FIELD_PREVIEW_CHARS ? c.text.slice(0, FIELD_PREVIEW_CHARS) : c.text,
    previewTruncated: c.text.length > FIELD_PREVIEW_CHARS,
    chars: c.text.length,
  }));
  const outline = sessionOutline(session, { sourceId });
  if (outline.error) voidLedger.push(gapEntry("Field", "sessionOutline", outline.error));
  if (outline.gap) voidLedger.push(gapEntry("Field", "sessionOutline", outline.gap));
  const field = {
    units,
    unitsTotal: (doc.chunks || []).length,
    previewChars: FIELD_PREVIEW_CHARS,
    outline: { sections: outline.sections ?? [], gap: outline.gap ?? null },
    bytes: units.length ? units[units.length - 1].byteEnd : 0,
  };
  say("Field", field);

  // ── Atmosphere · Interpretation·Ground — the trace with its moving baseline
  let atmosphere;
  const offsetTokens = tokenizeWithOffsets(text);
  if (offsetTokens.length === 0) {
    atmosphere = { gap: { silence: "computed-and-empty", detail: "no word tokens in the admitted text" } };
    voidLedger.push(gapEntry("Atmosphere", "tokenizeWithOffsets", atmosphere.gap));
  } else {
    const words = offsetTokens.map((t) => t.word);
    const chunks = chunkWords(words, CHUNK_WORDS);
    // gamma left at causalSurprisalSeries's own default (1 — no fading), the
    // same call host/reading.js::admitReading makes, so the two series are
    // the same measurement.
    const series = causalSurprisalSeries(chunks);
    const frames = series.map((microbits, i) => {
      const at = locate(i, offsetTokens, { chunkSize: CHUNK_WORDS });
      return { i, microbits, byteStart: at.byteStart ?? null, byteEnd: at.byteEnd ?? null };
    });
    const regime = readAtmosphere({ material: series, ...ATMOSPHERE_REGIME });
    if (regime.gap) voidLedger.push(gapEntry("Atmosphere", "readAtmosphere", regime));
    atmosphere = {
      frames,
      chunkWords: CHUNK_WORDS,
      regime: regime.gap ? { gap: regime } : regime,
      regimeParams: ATMOSPHERE_REGIME,
    };
  }
  say("Atmosphere", atmosphere);

  // ── Entity · Existence·Figure — the discovered cast
  const entity = sessionReferents(session, { sourceId });
  for (const g of entity.gaps ?? []) voidLedger.push(gapEntry("Entity", "sessionReferents", g));
  const entitySurface = { referents: entity.referents, gaps: entity.gaps ?? [] };
  say("Entity", entitySurface);

  // ── Link · Structure·Figure — the triples
  const rel = sessionRelations(session, { sourceId });
  for (const g of rel.gaps ?? []) voidLedger.push(gapEntry("Link", "sessionRelations", g));
  const link = {
    relations: rel.relations.slice(0, RELATION_CAP),
    total: rel.relations.length,
    truncated: rel.relations.length > RELATION_CAP,
  };
  if (link.truncated) {
    voidLedger.push(
      gapEntry("Link", "host/terrains", {
        reason: "relations_truncated",
        detail: `${rel.relations.length} relations stated, ${RELATION_CAP} returned (RELATION_CAP)`,
      }),
    );
  }
  if (rel.relations.length === 0) {
    voidLedger.push(gapEntry("Link", "sessionRelations", { silence: "computed-and-empty", detail: "the relation ladder ran and stated zero triples" }));
  }
  say("Link", link);

  // ── Network · Structure·Pattern — the belief graph, admitted in stages so
  // a reader can scrub belief-as-of-a-point-in-the-read. Same triples, same
  // canonicalisation (graph.js's own referentLookup), same organ; the only
  // difference from one-call admission is that decay applies per stage,
  // which is the organ's own reading semantics, declared above.
  //
  // CONSERVATIVE, NOT GREEDY, on the cast side of the graph (2026-08-21): a
  // referent the cast has already typed `apparatus` (a narrating byline
  // re-stapled to most sentences — corpus.js's own measured demotion) is
  // WITHHELD from the co-arrival binding register, and the withholding is a
  // typed Void entry naming who was withheld. An apparatus co-arrives with
  // everyone by construction, so binding it as cast reads the container's
  // own voice as the story's structure. Its STATED relations still enter —
  // "X has learned…" is genuinely stated by the material — but the node
  // carries its standing (reconciled below), so a reader can tell belief
  // about the story from belief about the wire that carried it. The gap is
  // recomputed and pushed on EVERY call, not only the admitting one, so the
  // Void ledger stays whole on a re-render.
  const apparatusReferents = entity.referents.filter((r) => r.individuation === "apparatus");
  const bindableReferents = entity.referents.filter((r) => r.individuation !== "apparatus");
  if (apparatusReferents.length) {
    voidLedger.push(
      gapEntry("Network", "binding", {
        reason: "apparatus_withheld_from_binding",
        detail:
          `${apparatusReferents.length} referent(s) the cast types apparatus withheld from co-arrival binding: ` +
          `${apparatusReferents.map((r) => r.display || r.id).join(", ")} — a narrating apparatus co-arrives with ` +
          "everything, so binding it as cast would read the container's own voice as the story's structure",
        withheld: apparatusReferents.map((r) => ({ referent: r.id, display: r.display || r.id })),
      }),
    );
  }
  if (!session._terrainsGraphAdmitted) session._terrainsGraphAdmitted = new Set();
  let stages = session._terrainsGraphStages?.get?.(sourceId) ?? null;
  if (!session._terrainsGraphAdmitted.has(sourceId)) {
    session._terrainsGraphAdmitted.add(sourceId);
    const graph = attachGraph(session);
    const lookup = referentLookup(session, sourceId);
    const triples = rel.relations.map((t) => ({
      subject: lookup.resolve(t.subject, t.subjectOffset ?? t.offset),
      verb: t.verb,
      object: lookup.resolve(t.object, t.objectOffset ?? t.offset),
      polarity: t.polarity,
    }));
    stages = [];
    // Each stage's nodes carry `weight` — the summed CURRENT (decayed)
    // incident edge weight at that stage (engine graph.js::nodeWeights) —
    // and are ranked by it: the cursor scrubs the graph's own re-weighted
    // belief as-of-that-point, not a lifetime mentions tally that can only
    // grow ("frequency is not significance" — referents/entity.js's own
    // register discipline, applied to this ranking 2026-08-21).
    const snap = (label, upTo, of) => {
      const weights = nodeWeights(graph);
      stages.push({
        label,
        upTo,
        of,
        tick: graph.tick,
        nodes: [...graph.nodes.values()]
          .map((n) => ({ ...n, weight: weights.get(n.id) ?? 0 }))
          .sort((a, b) => b.weight - a.weight || b.mentions - a.mentions)
          .slice(0, GRAPH_LIMIT),
        edges: strongestEdges(graph, GRAPH_LIMIT),
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.size,
      });
    };
    const per = Math.max(1, Math.ceil(triples.length / GRAPH_STAGES));
    for (let s = 0; s < triples.length; s += per) {
      const batch = triples.slice(s, s + per);
      readTriples(graph, batch, { alpha: 1, structural: true });
      snap("stated relations", Math.min(s + per, triples.length), triples.length);
    }

    // ── binding: the co-arrival Link over the cast, its own final stage ──
    // The register is keyed by `referentFace` — the SAME stable referent id
    // the SVO canonicalisation above lands triples on — so one referent is
    // ONE node whichever organ speaks about it. Display strings remain
    // presentation rather than graph identity. Apparatus referents are
    // withheld (bindableReferents; the
    // typed Void entry above says who and why).
    let binding = { entities: 0, pairsTested: 0, witnessed: 0, apparatusWithheld: apparatusReferents.length, params: BINDING };
    const sentences = splitSentences(text);
    const surfacePatterns = [];
    for (const r of bindableReferents) {
      for (const s of r.surfaces ?? []) {
        const surfaceText = typeof s === "string" ? s : s?.surface;
        const n = diaNorm(surfaceText ?? "");
        if (n.length < 2) continue;
        surfacePatterns.push([referentFace(r), new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u")]);
      }
    }
    if (sentences.length * surfacePatterns.length > BINDING_SCAN_CAP) {
      binding.gap = {
        silence: "censored-above",
        detail: `${sentences.length} sentences × ${surfacePatterns.length} surfaces exceeds the declared scan cap — binding not attempted`,
      };
      voidLedger.push(gapEntry("Network", "binding", binding.gap));
    } else if (surfacePatterns.length) {
      const arrivals = new Map();
      sentences.forEach((sen, i) => {
        const norm = diaNorm(sen.text ?? sen);
        for (const [id, re] of surfacePatterns) {
          if (re.test(norm)) {
            if (!arrivals.has(id)) arrivals.set(id, []);
            const arr = arrivals.get(id);
            if (arr[arr.length - 1] !== i) arr.push(i);
          }
        }
      });
      const register = [...arrivals.entries()].filter(([, a]) => a.length >= 2).map(([id, a]) => ({ id, arrivals: a }));
      binding.entities = register.length;
      if (register.length >= 2) {
        const links = readLinks(register, { ...BINDING, totalUnits: sentences.length });
        const witnessed = links.filter((l) => l.direction !== null);
        binding.pairsTested = links.length;
        binding.witnessed = witnessed.length;
        if (witnessed.length) {
          readTriples(graph, bindingTriples(witnessed), { alpha: 1, structural: true });
          snap("binding links (witnessed against the nulls)", witnessed.length, witnessed.length);
        }
      }
    }
    stages._binding = binding;

    // ── recurring-form binding: the vocabulary's own co-arrivals ─────────
    let formBinding = { forms: 0, candidateForms: 0, pairsTested: 0, witnessed: 0, cap: TERM_FORMS_CAP, params: FORM_BINDING, finestRank: `1/${FORM_BINDING.draws}` };
    {
      const table = buildFrequencyTable(tokenize(text));
      const functionWords = functionWordSet(table);
      const formArrivals = new Map();
      sentences.forEach((sen, i) => {
        for (const w of new Set(tokenize(sen.text ?? String(sen)))) {
          if (functionWords.has(w) || w.length < 2) continue;
          if (!formArrivals.has(w)) formArrivals.set(w, []);
          const arr = formArrivals.get(w);
          if (arr[arr.length - 1] !== i) arr.push(i);
        }
      });
      const candidates = [...formArrivals.entries()].filter(([, a]) => a.length >= 2).sort((a, b) => b[1].length - a[1].length);
      formBinding.candidateForms = candidates.length;
      const kept = candidates.slice(0, TERM_FORMS_CAP);
      formBinding.forms = kept.length;
      if (candidates.length > kept.length) {
        voidLedger.push(
          gapEntry("Network", "formBinding", {
            reason: "forms_truncated",
            detail: `${candidates.length} recurring forms, ${kept.length} bound (TERM_FORMS_CAP) — ranked by sentence arrivals`,
          }),
        );
      }
      if (kept.length >= 2) {
        const register = kept.map(([form, arrivals]) => ({ id: form, arrivals }));
        const links = readLinks(register, { ...FORM_BINDING, totalUnits: sentences.length });
        const witnessed = links.filter((l) => l.direction !== null);
        formBinding.pairsTested = links.length;
        formBinding.witnessed = witnessed.length;
        if (witnessed.length) {
          readTriples(graph, bindingTriples(witnessed), { alpha: 1, structural: true });
          snap("recurring-form co-arrivals (witnessed against the nulls)", witnessed.length, witnessed.length);
        }
      }
    }
    stages._formBinding = formBinding;

    if (!session._terrainsGraphStages) session._terrainsGraphStages = new Map();
    session._terrainsGraphStages.set(sourceId, stages);
  }
  // Reconciled on EVERY call, not only the admitting one: the cast is
  // re-derived as a document grows (discoveredCast recomputes on chunk-count
  // change), so a re-render after more material has landed is exactly when a
  // standing is most likely to have moved — the moment this whole mechanism
  // exists for. A call with nothing new to say is a no-op by construction
  // (restandNode refuses to repeat an unchanged verdict).
  const { restood, unresolved } = reconcileGraphStandings(session, { sourceId });
  const network = {
    ...sessionGraphSnapshot(session, { limit: GRAPH_LIMIT }),
    stages: stages ?? [],
    binding: stages?._binding ?? null,
    formBinding: stages?._formBinding ?? null,
    stageNote: "belief admitted in ordered stages; decay applies per stage — the organ's own reading semantics",
    limit: GRAPH_LIMIT,
  };
  if (restood.length) {
    voidLedger.push(
      gapEntry("Network", "reconcileGraphStandings", {
        reason: "standing_revised",
        detail: restood.map((r) => `${r.node}: ${r.was ?? "(none)"} → ${r.standing}`).join("; "),
        restood,
      }),
    );
  }
  if (unresolved.length) {
    voidLedger.push(
      gapEntry("Network", "reconcileGraphStandings", {
        reason: "standing_unresolved",
        detail:
          `${unresolved.length} referent(s) the cast has typed carry no matching graph node — ` +
          `${unresolved.map((u) => `${u.referent} (${u.standing})`).join(", ")}; the relation extractor's own ` +
          "subject span for this referent did not canonicalise to one of its registered surfaces",
        unresolved,
      }),
    );
  }
  if (network.nodeCount === 0) {
    voidLedger.push(gapEntry("Network", "sessionGraphSnapshot", { silence: "computed-and-empty", detail: "no triples survived into the belief graph" }));
  }
  say("Network", network);

  // ── Lens · Interpretation·Figure — not served, by construction
  const lens = {
    gap: {
      silence: "not-present",
      detail: "a lens is declared by a reader — a saved view with a giver — never extracted from content",
    },
  };
  voidLedger.push(gapEntry("Lens", "host/terrains", lens.gap));

  // ── Kind · Existence·Pattern — not computed HERE (see sessionKinds)
  voidLedger.push(
    gapEntry("Kind", "host/terrains", {
      silence: "not-computed",
      detail: "induceKinds is minutes-expensive; schedule sessionKinds() as its own job",
    }),
  );

  // ── Paradigm · Interpretation·Pattern — the frame, received, givers named
  const paradigm = {
    grid: TERRAIN_GRID,
    declared: DECLARED,
    engine: { corpusApiVersion: CORPUS_API_VERSION },
    received: {
      giver: "12-terrains-as-representation-standard.md (ratified 2026-08-14) via engine/operators.js TERRAIN_BY_DOMAIN",
      note: "the grid is a representation standard and a dispatch key for verbs — never a label computed from content (the cube was measured and refuted as a content classifier: 95.7% of cell assignments survived word-shuffling)",
    },
  };

  const kind = { silence: "not-computed", schedule: "sessionKinds" };
  const voidSurface = { ledger: voidLedger };
  say("Lens", lens);
  say("Kind", kind);
  say("Paradigm", paradigm);
  say("Void", voidSurface); // last — the ledger accumulates every organ's gaps

  return {
    sourceId,
    terrains: {
      Void: voidSurface,
      Entity: entitySurface,
      Kind: kind,
      Field: field,
      Link: link,
      Network: network,
      Atmosphere: atmosphere,
      Lens: lens,
      Paradigm: paradigm,
    },
  };
}

/**
 * An extractive fold of an arbitrary place in a text — the house's one
 * operation, done without a mouth: the scope's most novel sentences against
 * the DOCUMENT's own frequency table (material.js::surprisalMicrobits, the
 * same statistic the atmosphere trace runs on), returned verbatim, in
 * document order, each line carrying its char address so the fold descends
 * to the rows (II.3). No model, no paraphrase — a change of resolution that
 * invents nothing. `budgetSentences` is caller-declared: the fold's
 * resolution is a claim, and the caller makes it.
 *
 * Scope is one of: a char range {charStart, charEnd}; a word (its arrival
 * sentences, word-bounded, case-folded); or the whole text. An empty scope
 * is a typed gap, never an empty success.
 */
export function foldExtract({ text, charStart, charEnd, word, budgetSentences } = {}) {
  if (typeof text !== "string" || !text.length) {
    return { gap: { silence: "computed-and-empty", detail: "no text to fold" } };
  }
  if (!Number.isInteger(budgetSentences) || budgetSentences < 1) {
    return { gap: { reason: "undeclared", detail: "foldExtract: budgetSentences is declared by the caller, never defaulted" } };
  }
  const sentences = splitSentences(text);
  let scoped;
  let scope;
  if (word) {
    const n = diaNorm(String(word));
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u");
    scoped = sentences.filter((s) => re.test(diaNorm(s.text)));
    scope = { word: String(word) };
  } else if (Number.isInteger(charStart) || Number.isInteger(charEnd)) {
    const a = Math.max(0, charStart ?? 0);
    const b = Math.min(text.length, charEnd ?? text.length);
    scoped = sentences.filter((s) => s.offset + s.text.length > a && s.offset < b);
    scope = { charStart: a, charEnd: b };
  } else {
    scoped = sentences;
    scope = { whole: true };
  }
  if (!scoped.length) {
    return { scope, gap: { silence: "computed-and-empty", detail: "no sentences in this scope" } };
  }

  // CANDIDACY. Structure lines — markdown headings, table rows, fences —
  // are addresses and scaffolding, not claims; the outline already holds
  // them (measured: a novelty-ranked fold returned "## One operation" and
  // two orphaned list markers as a "summary"). And a sentence with fewer
  // than two word tokens cannot carry a claim — a structural minimum.
  // A leading pipe is a table fragment even when sentence-splitting broke
  // the row mid-way (measured: "| Line | Held by |…" survived an
  // ends-with-pipe test and shipped in a fold).
  const structureLine = /^\s*(#{1,6}\s|\||```)/;
  const candidates = scoped
    .filter((s) => !structureLine.test(s.text))
    .map((s) => ({ ...s, tokens: tokenize(s.text) }))
    .filter((s) => s.tokens.length >= 2);
  if (!candidates.length) {
    return { scope, gap: { silence: "computed-and-empty", detail: "no sentence in this scope carries a claim (structure lines and sub-two-token fragments are not candidates)" } };
  }

  // COVERAGE, not novelty. A summary answers "what is this about", so the
  // fold greedily picks the sentences that together carry the most of the
  // scope's own recurring content vocabulary — the same Zipf-filtered,
  // arrivals ≥ 2 forms the belief graph binds (TERM_FORMS_CAP, one
  // standing, one dial). Novelty (surprisal) stays licensed for "what is
  // most surprising" — a different question this function does not answer.
  const table = buildFrequencyTable(tokenize(text));
  const functionWords = functionWordSet(table);
  const arrivals = new Map();
  for (const s of candidates) {
    for (const w of new Set(s.tokens)) {
      if (functionWords.has(w) || w.length < 2) continue;
      arrivals.set(w, (arrivals.get(w) ?? 0) + 1);
    }
  }
  const forms = [...arrivals.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TERM_FORMS_CAP)
    .map(([w]) => w);
  const formSet = new Set(forms);
  if (!formSet.size) {
    return { scope, gap: { silence: "computed-and-empty", detail: "nothing recurs in this scope — no vocabulary to cover" } };
  }

  const uncovered = new Set(formSet);
  const picked = [];
  const pool = candidates.map((s) => ({ ...s, forms: new Set(s.tokens.filter((w) => formSet.has(w))) }));
  while (picked.length < budgetSentences && uncovered.size) {
    let best = null;
    let bestGain = 0;
    for (const s of pool) {
      if (picked.includes(s)) continue;
      let gain = 0;
      for (const w of s.forms) if (uncovered.has(w)) gain++;
      if (gain > bestGain || (gain === bestGain && gain > 0 && best && s.tokens.length < best.tokens.length)) {
        best = s;
        bestGain = gain;
      }
    }
    if (!best || bestGain === 0) break; // nothing left adds coverage — an honest short fold
    picked.push(best);
    for (const w of best.forms) uncovered.delete(w);
  }

  const lines = picked
    .sort((a, b) => a.offset - b.offset)
    .map((s) => ({
      text: s.text,
      charStart: s.offset,
      charEnd: s.offset + s.text.length,
      covers: forms.filter((w) => s.forms.has(w)),
    }));
  return {
    scope,
    lines,
    of: candidates.length,
    kept: lines.length,
    forms: { covered: formSet.size - uncovered.size, of: formSet.size, list: forms },
    method:
      "coverage fold — the fewest sentences that together carry the most of the scope's recurring content vocabulary (Zipf function-words excluded, arrivals ≥ 2, the same forms the belief graph binds); verbatim, addressed, in document order; structure lines are not candidates",
  };
}

/**
 * Kind · Existence·Pattern — emergence/kinds.js::induceKinds over records
 * built from the admitted chunks: one record per chunk, one boolean
 * attribute per distinct non-function-word token form. The function-word
 * exclusion is material.js::functionWordSet — Zipf-derived from THIS text's
 * own frequency table, never a stoplist (the same discipline
 * perceiver/text/relations.js applies to verb candidates).
 *
 * Every statistical option is DECLARED BY THE CALLER, never defaulted here —
 * minPrevalence, minKindSize, permutations, quantile, seed (and optionally
 * reseeds) carry the caller's own standing, the same contract induceKinds
 * itself keeps. A caller that wants an interactive-speed answer and one that
 * wants a thorough one are making different claims and must say so.
 *
 * `minPrevalence` is additionally applied while BUILDING attributes — the
 * same gate induceKinds applies to fields, applied early so the profile
 * matrix never materialises columns the gate would drop anyway. Not a new
 * threshold: the same declared number, at the same meaning.
 */
// Deterministic rng, the same recurrence nul/index.js declares for its own
// grounds — a null that cannot be replayed cannot be testimony.
const mulberry = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const kindsView = (kinds) =>
  kinds.map((k) => ({
    label: k.label,
    size: k.members.length,
    cohesion: k.cohesion,
    height: k.height,
    // heightGate.warrant is being renamed heightGate.ground across the
    // lineage (2026-08-16); the fallback read bridges until that commit
    // lands and can be dropped after.
    ground: k.heightGate?.ground ?? k.heightGate?.warrant ?? null,
    existence_p: k.heightGate?.existence?.pValue ?? null,
    constraint_p: k.heightGate?.constraint?.pValue ?? null,
    core: k.core,
    members: k.members,
  }));

/**
 * `records` (optional): a caller that has already segmented its material into
 * induceKinds' own record shape — a tabular file's rows, a log's lines —
 * passes them here and the chunk-record building below is skipped. The
 * induction, the view, and the null arm are identical either way; what
 * varies is only who segmented, and that is the caller's own standing to
 * declare. When `records` is given, `sourceId` still names the population.
 */
export function sessionKinds(session, { sourceId, records: givenRecords, opts } = {}) {
  const doc = session.documents.get(sourceId);
  if (!doc && !givenRecords) {
    return { sourceId, gap: { reason: "unknown_source", detail: `no admitted document named "${sourceId}"` } };
  }
  // reseeds is on this list because induceKinds itself refuses to run
  // without a declared reseeds >= 2 — surfacing the requirement here as a
  // typed gap instead of letting the engine throw mid-job.
  for (const required of ["minPrevalence", "minKindSize", "permutations", "quantile", "seed", "reseeds"]) {
    if (opts?.[required] === undefined) {
      return { sourceId, gap: { reason: "undeclared", detail: `sessionKinds: opts.${required} is declared by the caller, never defaulted` } };
    }
  }
  let records;
  let formFloor = null;
  if (givenRecords) {
    records = givenRecords;
  } else {
    const chunks = doc.chunks || [];
    if (!chunks.length) {
      return { sourceId, gap: { silence: "computed-and-empty", detail: "no admitted chunks to build records from" } };
    }

    const table = buildFrequencyTable(tokenize(doc.text || ""));
    const functionWords = functionWordSet(table);

    const perChunkForms = chunks.map((c) => {
      const forms = new Set();
      for (const w of tokenize(c.text)) if (!functionWords.has(w)) forms.add(w);
      return forms;
    });
    const prevalence = new Map();
    for (const forms of perChunkForms) for (const f of forms) prevalence.set(f, (prevalence.get(f) ?? 0) + 1);
    const floor = opts.minPrevalence * chunks.length;
    const admittedForms = new Set([...prevalence].filter(([, n]) => n >= floor).map(([f]) => f));

    records = chunks.map((c, i) => ({
      id: `u${i}`,
      attributes: [...perChunkForms[i]]
        .filter((f) => admittedForms.has(f))
        .map((f) => ({ field_id: `tok:${f}`, value_type: "present" })),
    }));
    formFloor = { minPrevalence: opts.minPrevalence, records: chunks.length, admittedForms: admittedForms.size, candidateForms: prevalence.size };
  }
  if (!records.length) {
    return { sourceId, gap: { silence: "computed-and-empty", detail: "zero records to induce structure over" } };
  }
  // Fewer records than the declared minimum kind size cannot support any
  // kind at all — a typed refusal (nul's refused-as-underpowered silence),
  // never the engine's raw throw surfacing as an error. Measured live: a
  // 489-byte essay (1 chunk) against minKindSize 5.
  if (records.length < opts.minKindSize) {
    return {
      sourceId,
      gap: {
        silence: "refused-as-underpowered",
        detail: `${records.length} record${records.length === 1 ? "" : "s"} against a declared minKindSize of ${opts.minKindSize} — no kind is statable over this population`,
      },
    };
  }

  const population = `${sourceId}:${records.length}-records`;
  const reading = inductionReading(records, { ...opts, population });
  const kinds = induceKinds(records, { ...opts, population });

  // ── the per-population null arm ───────────────────────────────────────────
  // See kindsNullArm below for what it is and why. Three dispositions:
  //   opts.nullArm === false     declined — reported, kinds render provisional
  //   opts.nullArm === "defer"   the caller will run kindsNullArm itself
  //                              (typically async, after showing the kinds) —
  //                              reported as pending, records returned so the
  //                              arm runs over the SAME population
  //   otherwise                  run here, opts.nullArmDraws declared
  let nullArm;
  let deferredRecords;
  if (opts.nullArm === false) {
    nullArm = { ran: false, disposition: "declined", reason: "declined by caller — every kind renders provisional (FOLD-CONSTITUTION II.12)" };
  } else if (opts.nullArm === "defer") {
    nullArm = { ran: false, disposition: "pending", reason: "arm deferred by caller — kinds render provisional until it lands" };
    deferredRecords = records;
  } else {
    nullArm = kindsNullArm({ records, opts, population });
    if (nullArm.gap) return { sourceId, gap: nullArm.gap };
  }

  return {
    sourceId,
    recordCount: records.length,
    admittedFields: reading.keys,
    ...(formFloor ? { formFloor } : {}),
    nullArm,
    kinds: kindsView(kinds),
    ...(deferredRecords ? { records: deferredRecords } : {}),
  };
}

/**
 * The per-population null arm, callable on its own so a caller can show the
 * kinds first and let the arm land asynchronously (II.13: a null that does
 * not run locally does not exist — and a null that costs a minute must not
 * quietly become a null nobody runs).
 *
 * WHY IT EXISTS: induceKinds fabricates a kind from structureless material
 * in 10.0% of trials against a registered 5% bar (eo-evidence 3b17214,
 * 2026-08-15; 30.0% at the looser settings a real analysis used), and its
 * failure mode is confident-and-wrong (purity 1.000 on anything admitted).
 * So a kind does not ship on the internal gates alone: the SAME pipeline
 * re-runs on copies of THIS population with co-occurrence destroyed — each
 * admitted field's presences redealt across records. Marginal prevalence is
 * preserved (containment: the hypothesis "these fields co-occur" fits inside
 * what the redeal keeps) and co-occurrence is destroyed (licence: it is
 * exactly what a kind is made of, so the statistic moves). Kinds the redealt
 * copies still produce are what fabrication looks like on this population.
 *
 * DRAWS: `opts.nullArmDraws` — declared by the caller, never defaulted, and
 * carried on the result, because the finest rank sayable is 1/draws
 * (FOLD-CONSTITUTION II.4): one redeal buys "the arm's copy produced kinds
 * or it did not", five buy a coarse rate, and the renderer may not phrase
 * the claim finer than the count supports. Each draw redeals with its own
 * seeded stream, deterministically derived from the declared seed.
 */
export function kindsNullArm({ records, opts, population = "population" } = {}) {
  if (!Array.isArray(records) || !records.length) {
    return { gap: { reason: "empty_material", detail: "kindsNullArm: no records to redeal" } };
  }
  const draws = opts?.nullArmDraws;
  if (!Number.isInteger(draws) || draws < 1) {
    return { gap: { reason: "undeclared", detail: "kindsNullArm: opts.nullArmDraws is declared by the caller, never defaulted (the finest rank sayable is 1/draws)" } };
  }

  const byField = new Map();
  records.forEach((r, i) => {
    for (const a of r.attributes) {
      if (!byField.has(a.field_id)) byField.set(a.field_id, []);
      byField.get(a.field_id).push(i);
    }
  });

  const perDraw = [];
  for (let d = 0; d < draws; d++) {
    const rnd = mulberry((opts.seed ^ (d * 0x9e3779b9)) | 0);
    const permuted = records.map((r) => ({ id: r.id, attributes: [] }));
    for (const [field_id, holders] of byField) {
      // redeal this field's presences: a seeded n-of-N draw, Fisher–Yates
      // over the record indices, first |holders| taken.
      const idx = records.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      for (let n = 0; n < holders.length; n++) permuted[idx[n]].attributes.push({ field_id, value_type: "present" });
    }
    const nullKinds = induceKinds(permuted, { ...opts, population: `${population}:null-arm:${d}` });
    perDraw.push({ draw: d, kindsFound: nullKinds.length, sizes: nullKinds.map((k) => k.members.length) });
  }

  return {
    ran: true,
    disposition: "ran",
    perturbation: "per-field presence redeal (marginals preserved, co-occurrence destroyed)",
    draws,
    finestRank: `1/${draws}`,
    drawsWithKinds: perDraw.filter((p) => p.kindsFound > 0).length,
    perDraw,
  };
}

// native/eval/being-golden-candidates.mjs — build the BLIND sheet the
// being-hood golden is adjudicated against, and, separately, the gate run
// that golden will later be scored against.
//
// WHY THIS EXISTS. levers-RESULTS.md stopped Lever 2's refinement on
// purpose: "no being-hood golden exists in either repo; until one does,
// further filter-tuning is calibration-on-the-fixture wearing measurement's
// clothes." This driver produces the missing answer key's raw material —
// the candidate set the evidence gate is HANDED, before the gate speaks.
//
// THE BLINDING, and exactly how far it goes. Two files are written:
//
//   *.blind.json  — every candidate that clears the recurrence floor and
//                   the anchored wall, with its own arrival sentences, in
//                   ALPHABETICAL order, carrying NO evidence count and NO
//                   verdict. This is the only file adjudication may read.
//   *.gate.json   — the agency evidence measure and descriptorBeings'
//                   own verdicts. Written for scoring, read only AFTER the
//                   golden is frozen.
//
// The candidate set is produced by descriptorBeings with beingEvidence
// OMITTED, which is the honest way to ask "what does the gate get handed":
// the recurrence floor and the anchored wall have spoken, the evidence
// measure under test has not. It is not a reimplementation of the walls —
// it is the same function, asked one argument short.
//
// Assembly is levers.mjs's own, unchanged, so the candidate set here IS the
// candidate set measured there: host cast (coref-primed) + one causal text
// perceiver pass collecting occurrences and anchor evidence.
//
// Usage: node native/eval/being-golden-candidates.mjs <book.txt> --coref <prior.json> --out-prefix <path>

import fs from "node:fs";
import { stripContainer, splitSentences } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { discoverRelationVocab } from "../adapters/text/relations.js";
import { descriptorBeings } from "../adapters/text/anchoring.js";
import { castSurfaceMap } from "../adapters/text/perspective-claims.js";
import { createSession, admitChunked, sessionReferents } from "../../legacy-eoreader6.1/packages/host/corpus.js";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
const PRONOUN_RECALL = { minActivation: 0.05, minMargin: 0.2 };
const MIN_ARRIVALS = 4; // levers.mjs's own declared value, cited there to entity.js's Born gate
const MIN_SURFACES = 2; // the perceiver's own minRelationSurfaces default
const PASSAGES_PER_CANDIDATE = 6; // a reading budget, declared: enough arrivals to decide, few enough to read all of them

const arg = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : null; };

async function main() {
  const path = process.argv[2];
  const outPrefix = arg("--out-prefix");
  if (!path || !outPrefix) throw new TypeError("usage: node native/eval/being-golden-candidates.mjs <book.txt> --coref <prior.json> --out-prefix <path>");
  const raw = fs.readFileSync(path, "utf8");
  const stripped = stripContainer(raw);
  const prior = arg("--coref") ? JSON.parse(fs.readFileSync(arg("--coref"), "utf8")) : null;
  const sourceId = `file:${path.split("/").pop()}`;

  const session = createSession();
  admitChunked(session, { text: raw, sourceId, language: "en" });
  const cast = sessionReferents(session, { sourceId, priors: prior ? [prior] : [], limit: 200 });
  const surfaceToReferent = castSurfaceMap(cast.referents ?? []);

  const encounters = textEncounters(stripped.text, { source: sourceId, offset: stripped.offset });
  const perceiver = createCausalTextPerceiver({ minRelationSurfaces: MIN_SURFACES, refreshEvery: 25, posPrior: POS_PRIOR, descriptorAnchoring: PRONOUN_RECALL });
  const occurrences = [];
  const anchoredSurfaces = new Set();
  for (const enc of encounters) {
    const out = (await perceiver.perceive(enc, {})) ?? [];
    for (const x of out) {
      for (const g of x.candidate?.graphEntries ?? []) {
        if (g?.schema === "EOReferentOccurrence@1") occurrences.push(g);
        if (g?.schema === "EOAnchorEvidence@1") anchoredSurfaces.add(String(g.descriptor ?? "").toLowerCase());
      }
    }
  }

  // ── the candidate set: the walls have spoken, the measure under test has not ──
  const candidatesRun = descriptorBeings(occurrences, { minArrivals: MIN_ARRIVALS, anchoredSurfaces });

  // Arrival sentences, so every adjudication can cite the book rather than a
  // memory of it. The arrival KEY is descriptorBeings' own: `sentenceOrder`
  // when an occurrence carries one, else `encounterRef` — which the causal
  // perceiver mints as the string `encounter:<sequencePosition>`, one per
  // sentence. Reading the order back out of that key is what turns an
  // arrival count into a citable passage; parsing it as a bare number does
  // not (measured: every passage came back empty).
  const sentences = splitSentences(stripped.text);
  const byOrder = new Map(sentences.map((s) => [s.order, s.text]));
  const orderOf = (at) => {
    if (typeof at === "number") return at;
    const m = /(\d+)\s*$/.exec(String(at ?? ""));
    return m ? Number(m[1]) : null;
  };
  const arrivalsFor = new Map();
  for (const occ of occurrences) {
    if (occ?.determination !== "definite") continue;
    const canon = String(occ.canonicalSurface ?? occ.surface ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!canon) continue;
    const at = orderOf(occ.sentenceOrder ?? occ.encounterRef ?? null);
    if (at == null) continue;
    if (!arrivalsFor.has(canon)) arrivalsFor.set(canon, new Set());
    arrivalsFor.get(canon).add(at);
  }

  const blind = candidatesRun.beings
    .map((b) => {
      const orders = [...(arrivalsFor.get(b.canonicalSurface) ?? [])].sort((a, z) => a - z);
      const step = Math.max(1, Math.floor(orders.length / PASSAGES_PER_CANDIDATE));
      const sampled = orders.filter((_, i) => i % step === 0).slice(0, PASSAGES_PER_CANDIDATE);
      return {
        surface: b.canonicalSurface,
        display: b.display,
        arrivals: b.arrivals,
        passages: sampled.map((o) => ({ sentenceOrder: o, text: (byOrder.get(o) ?? "").replace(/\s+/g, " ").trim() })),
      };
    })
    .sort((a, b) => a.surface.localeCompare(b.surface)); // alphabetical: never rank order, which would leak the measure

  fs.writeFileSync(`${outPrefix}.blind.json`, JSON.stringify({
    schema: "EOBeingCandidateSheet@1",
    book: path.split("/").pop(),
    assembly: "levers.mjs's own: host cast (coref-primed) + one causal text perceiver pass",
    declared: { MIN_ARRIVALS, MIN_SURFACES, PRONOUN_RECALL, PASSAGES_PER_CANDIDATE },
    walls: {
      note: "the recurrence floor and the anchored wall produced this set; the agency evidence measure under test did NOT",
      occurrencesSeen: occurrences.length,
      anchoredSurfacesExcluded: anchoredSurfaces.size,
      candidates: blind.length,
    },
    ordering: "alphabetical by surface — never by arrivals or by any evidence, so the sheet leaks no ranking",
    candidates: blind,
  }, null, 1));

  // ── the gate run, written apart and read only after the golden is frozen ──
  const surfacesOnlyVocab = discoverRelationVocab(stripped.text, { surfaces: [...surfaceToReferent.keys()], functionWords: null, minSurfaces: MIN_SURFACES, posPrior: POS_PRIOR }).verbs;
  const agencyVerbs = new Set([...surfacesOnlyVocab].filter((v) => {
    const f = POS_PRIOR.forms?.[v];
    return f && (f.VERB ?? 0) > (f.AUX ?? 0);
  }));
  const beingEvidence = new Map();
  {
    const lowerText = stripped.text.toLowerCase();
    for (const c of blind) {
      const re = new RegExp(`\\b${c.surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+([\\p{L}'’]+)`, "giu");
      let m, n = 0;
      const witnesses = [];
      while ((m = re.exec(lowerText)) && n < 50) { if (agencyVerbs.has(m[1])) { n += 1; if (witnesses.length < 5) witnesses.push(m[1]); } }
      if (n > 0) beingEvidence.set(c.surface, { count: n, verbs: witnesses });
    }
  }
  const gated = descriptorBeings(occurrences, {
    minArrivals: MIN_ARRIVALS,
    anchoredSurfaces,
    beingEvidence: new Map([...beingEvidence].map(([k, v]) => [k, v.count])),
  });

  fs.writeFileSync(`${outPrefix}.gate.json`, JSON.stringify({
    schema: "EOBeingGateRun@1",
    book: path.split("/").pop(),
    measure: "agency — the descriptor standing in the subject slot of a verb the material itself measured, auxiliaries refused as witnesses",
    declared: { MIN_ARRIVALS, MIN_SURFACES, agencyVerbs: agencyVerbs.size },
    admitted: gated.beings.map((b) => ({ surface: b.canonicalSurface, display: b.display, arrivals: b.arrivals })),
    evidence: [...beingEvidence].map(([surface, v]) => ({ surface, count: v.count, verbs: v.verbs })).sort((a, b) => b.count - a.count),
    refusedForNoEvidence: gated.refused.filter((r) => r.reason === "descriptor_no_being_evidence").map((r) => ({ surface: r.surface, arrivals: r.arrivals })),
  }, null, 1));

  console.error(`candidates: ${blind.length}  admitted-by-gate: ${gated.beings.length}  wrote ${outPrefix}.{blind,gate}.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });

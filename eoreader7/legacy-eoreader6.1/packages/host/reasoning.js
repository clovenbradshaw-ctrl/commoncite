// Host wiring: take the reader's already-discovered, referent-canonicalised
// relations and expose them as EOT tuples for the reasoning kernel.

import { resolveRelations } from "./graph.js";
import { sessionTerrains } from "./terrains.js";
import { reasonOverEot, renderEotReasoning } from "../engine/reasoning/eot.js";
import { falsificationEnvelopes } from "../engine/reasoning/falsification.js";
import { deriveEotInsights, renderDerivedInsights } from "../engine/reasoning/derivation.js";
import { normalizeHyperlexicon, admitHyperlexiconCandidates } from "../engine/reasoning/hyperlexicon.js";

export const CELL = Object.freeze({ op: "CON", grain: "Figure" });

const sectionScopeForOffset = (sections = [], offset = null) => {
  if (!Number.isFinite(offset)) return null;
  let best = null;
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    if (!Number.isFinite(section?.byteStart) || !Number.isFinite(section?.byteEnd)) continue;
    if (offset < section.byteStart || offset >= section.byteEnd) continue;
    if (!best || (section.byteEnd - section.byteStart) < (best.byteEnd - best.byteStart)) best = { ...section, index: i };
  }
  if (!best) return null;
  return Object.freeze({
    index: best.index,
    label: best.label ?? best.heading ?? best.title ?? `section:${best.index}`,
    start: best.byteStart,
    end: best.byteEnd,
  });
};

export function sessionEot(session, { sourceId, priors = [] } = {}) {
  if (!session) throw new TypeError("sessionEot: session is required");
  const targets = sourceId ? [sourceId] : Array.from(session.documents?.keys?.() ?? []);
  const tuples = [];
  const gaps = [];
  for (const id of targets) {
    const terrains = sessionTerrains(session, { sourceId: id, priors });
    if (terrains?.gap) {
      gaps.push({ sourceId: id, ...terrains.gap });
      continue;
    }

    const resolved = resolveRelations(session, { sourceId: id, priors });
    const sections = terrains.terrains?.Field?.outline?.sections ?? [];
    gaps.push(...(resolved.gaps ?? []).map((gap) => ({ sourceId: id, ...gap })));
    for (let i = 0; i < (resolved.relations ?? []).length; i += 1) {
      const relation = resolved.relations[i];
      const offset = relation.offset ?? relation.subjectOffset ?? relation.objectOffset ?? null;
      const scope = sectionScopeForOffset(sections, offset);
      tuples.push(Object.freeze({
        id: `eot:${id}:stated:${relation.offset ?? i}`,
        op: "CON", grain: "Figure",
        subject: relation.subject, predicate: relation.verb, object: relation.object,
        polarity: relation.polarity, source: id,
        ...(scope ? { scope } : {}),
        witness: Object.freeze({ sourceId: id, offset: relation.offset ?? null, subjectOffset: relation.subjectOffset ?? null, objectOffset: relation.objectOffset ?? null }),
        meta: Object.freeze({ origin: "packages/host/graph.js::resolveRelations", testimony: "stated" }),
      }));
    }

    const bindingLinks = terrains.terrains?.Network?.binding?.links ?? [];
    for (let i = 0; i < bindingLinks.length; i += 1) {
      const link = bindingLinks[i];
      tuples.push(Object.freeze({
        id: `eot:${id}:binding:${i}:${link.scope?.index ?? 0}`,
        op: "CON", grain: "Figure",
        subject: link.subject, predicate: link.predicate, object: link.object,
        polarity: link.polarity, source: id,
        scope: link.scope,
        witness: Object.freeze({ sourceId: id, ...(link.witness ?? {}) }),
        meta: Object.freeze({
          origin: "packages/host/terrains.js::Network.binding",
          testimony: "earned_binding",
          strength: link.strength ?? null,
        }),
      }));
    }
  }
  return Object.freeze({ tuples: Object.freeze(tuples), gaps: Object.freeze(gaps) });
}

export function reasonSession(session, { sourceId, priors = [], query = {}, hyperlexicon = null } = {}) {
  const live = sessionEot(session, { sourceId, priors });
  const hlBefore = normalizeHyperlexicon(hyperlexicon ?? session.hyperlexicon);
  const reasoning = reasonOverEot(live.tuples, query);
  const derived = deriveEotInsights(reasoning.tuples, query, { hyperlexicon: hlBefore });
  const hlAfter = admitHyperlexiconCandidates(hlBefore, derived.candidates ?? []);
  session.hyperlexicon = hlAfter;
  const envelopes = falsificationEnvelopes([...reasoning.tuples, ...derived]);
  return Object.freeze({
    sourceId: sourceId ?? null,
    eot: live.tuples,
    extractionGaps: live.gaps,
    reasoning,
    hyperlexicon: hlAfter,
    hyperlexiconCandidates: derived.candidates ?? Object.freeze([]),
    withheldCompositions: derived.withheld ?? Object.freeze([]),
    derived,
    falsification: envelopes,
  });
}

export function renderSessionReasoning(result) {
  const lines = [renderEotReasoning(result.reasoning)];
  lines.push("", `HYPERLEXICON · ${result.hyperlexicon?.schema ?? "missing"} · candidates ${result.hyperlexiconCandidates?.length ?? 0} · withheld ${result.withheldCompositions?.length ?? 0}`);
  if (result.derived?.length) lines.push("", renderDerivedInsights(result.derived));
  if (result.falsification?.length) {
    lines.push("", "FALSIFICATION ENVELOPES");
    for (const envelope of result.falsification) {
      lines.push(`  ${envelope.tupleId} · ${envelope.cell.terrain}`);
      lines.push(`    ${envelope.attack}`);
    }
  }
  if (result.extractionGaps?.length) lines.push("", `EXTRACTION GAPS ${result.extractionGaps.length}`);
  return lines.join("\n");
}

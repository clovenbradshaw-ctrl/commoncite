// eoreader6 · read-nashville-civic — real referent discovery and pronoun
// coreference over Nashville's Unified Housing Strategy documents.
//
// PART 1 drives the actual host session API (createSession / ingestFile /
// sessionReferents) — the same path eochat drives — for the per-document
// cast and the name-based POOLED cast across both documents.
//
// PART 2 reproduces host/corpus.js's discoveredCast at the same production
// operating point (PRONOUN_MIN_ACTIVATION/PRONOUN_MIN_MARGIN) to print
// concrete pronoun bindings — discoveredCast itself is not exported, and
// sessionReferents' cross-document path does not compute pronoun bindings
// at all (see the note before Part 2): that boundary is itself a finding,
// not an omission in this script.

import { readFileSync } from "node:fs";
import { createSession, ingestFile, sessionReferents } from "../packages/host/corpus.js";
import { stripContainer, splitSentences, deriveAbbreviations } from "../packages/engine/perceiver/text/spans.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "../packages/engine/perceiver/text/material.js";
import { extractSurfaces, discoverReferents } from "../packages/engine/perceiver/text/surfaces.js";
import { projectReferents } from "../packages/engine/referents/index.js";
import { resolvePronouns } from "../packages/engine/perceiver/text/pronouns.js";

// declared, never defaulted — the same production operating point
// host/corpus.js uses (PRONOUN_MIN_ACTIVATION/PRONOUN_MIN_MARGIN there)
const PRONOUN_MIN_ACTIVATION = 0.05;
const PRONOUN_MIN_MARGIN = 0.2;

const FILES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "scripts/adversarial/fixtures/nashville-uhs-executive-summary-2025.txt",
      "scripts/adversarial/fixtures/nashville-uhs-full-report-2025.txt",
    ];

// ── Part 1: the real host session API ───────────────────────────────────────
const session = createSession();
const sourceIds = [];
for (const path of FILES) {
  const { chunks } = ingestFile(session, path);
  const sourceId = `source:${path}`;
  sourceIds.push(sourceId);
  console.log(`ingested ${path} — ${chunks} chunk(s)`);
}

console.log(`\n═══ PER-DOCUMENT CAST (sessionReferents) ═══`);
for (const sourceId of sourceIds) {
  const { referents, gaps } = sessionReferents(session, { sourceId, limit: 300 });
  console.log(`\n-- ${sourceId} — ${referents.length} referents, ${gaps.length} gap(s) --`);
  for (const r of referents.slice(0, 20)) {
    console.log(
      `  ${r.display.padEnd(42)} mentions=${String(r.mentions).padStart(4)} frames=${String(r.frames).padStart(3)} ` +
        `pronoun=${String(r.pronounMentions ?? 0).padStart(3)} individuation=${(r.individuation ?? "?").padEnd(9)} namingShare=${(r.namingSentenceShare ?? 0).toFixed(3)}`,
    );
  }
}

console.log(`\n═══ POOLED CAST ACROSS BOTH DOCUMENTS (name-based cross-document coreference) ═══`);
const { referents: pooled, gaps: pooledGaps } = sessionReferents(session, { sourceId: sourceIds, limit: 300 });
console.log(`${pooled.length} referents, ${pooledGaps.length} gap(s)`);
const sharedAcrossDocs = pooled.filter((r) => r.sources?.length > 1);
console.log(`${sharedAcrossDocs.length} referents named in BOTH documents:\n`);
for (const r of sharedAcrossDocs.slice(0, 40)) {
  const perSource = r.sources.map((s) => `${s.sourceId.split("/").pop()}:${s.mentions}`).join(", ");
  console.log(`  ${r.display.padEnd(42)} total=${r.mentions}  (${perSource})`);
}

// sessionReferentsAcrossDocuments (host/corpus.js) sets individuation: null
// and never calls resolvePronouns for the pooled path — apparatus demotion's
// namingSentenceShare "has no defined meaning pooled across documents of
// different length and register" (its own comment) and pronoun binding is
// keyed off one document's own discovered cast. Cross-document coreference
// in this codebase today is NAME-based only; pronoun coreference does not
// cross a document boundary. That is exactly the boundary spec 11's F2 and
// Assembly D are about — not a bug in this script.

// ── Part 2: concrete pronoun bindings, per document ─────────────────────────
console.log(`\n═══ CONCRETE PRONOUN BINDINGS (per document, reproducing discoveredCast) ═══`);
for (const path of FILES) {
  const text = stripContainer(readFileSync(path, "utf8")).text;
  const abbreviations = deriveAbbreviations(text);
  const sentences = splitSentences(text, { abbreviations });
  const functionWords = functionWordSet(buildFrequencyTable(tokenize(text)));
  const surfaces = extractSurfaces(sentences, { functionWords, abbreviations });
  const discovery = discoverReferents(surfaces);
  const cast = projectReferents(discovery.events);
  const surfaceToReferent = new Map(discovery.events.map((e) => [e.surface, e.referent_id]));
  const display = new Map(cast.map((r) => [r.id, [...r.surfaces].sort((a, b) => b.length - a.length)[0]]));

  // nonPersonal intentionally omitted — Assembly D (animacy from pronominal
  // continuation) is not built yet. This IS current production behavior:
  // host/corpus.js only supplies nonPersonal after its own apparatus-
  // demotion pass, which this minimal reproduction skips.
  const resolved = resolvePronouns(sentences, surfaceToReferent, {
    minActivation: PRONOUN_MIN_ACTIVATION,
    minMargin: PRONOUN_MIN_MARGIN,
  });

  console.log(`\n-- ${path} — ${sentences.length} sentences, ${resolved.bindings.length} bound, ${resolved.gaps.length} gap(s) --`);
  for (const b of resolved.bindings.slice(0, 15)) {
    const s = sentences[b.sentenceOrder];
    const shown = s ? s.text.replace(/\s+/g, " ").trim().slice(0, 140) : "";
    console.log(`  "${b.pronoun}" → ${display.get(b.referentId) ?? b.referentId}  (activation=${b.activation.toFixed(3)}, margin=${b.margin.toFixed(3)})`);
    console.log(`      [${b.sentenceOrder}] ${shown}${shown.length === 140 ? "…" : ""}`);
  }
  const gapReasons = new Map();
  for (const g of resolved.gaps) gapReasons.set(g.reason, (gapReasons.get(g.reason) ?? 0) + 1);
  console.log(`  gap reasons: ${[...gapReasons.entries()].map(([k, v]) => `${k}=${v}`).join(", ") || "none"}`);
}

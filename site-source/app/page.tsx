"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Span = { span_id: string; page: number; order: number; char_start: number; char_end: number; byte_start: number; byte_end: number; text: string };
type Page = { page: number; char_start: number; char_end: number; byte_start: number; byte_end: number; text: string; spans: Span[] };
type Referent = { id: string; display: string; mentions: number; frames: number; surfaces: string[]; selfIdentified?: boolean };
type SourceLink = { href: string; text: string };
type Witness = {
  schema: string; title: string; edition: string; stable_uri: string; origin_uri: string; media_type: string;
  source_integrity: { sha256: string; byte_count?: number; preserved_copy?: string };
  extraction: { adapter: string; adapter_role: string; character_count: number; utf8_byte_count: number; page_count: number; sentence_span_count: number; all_page_text_retained: boolean };
  engine: { name: string; release: string; repository: string; commit: string; language_received: string; llm_used: boolean; model: null };
  admission: { chunk_count: number; admitted_span_count: number; reading: { admission_hash: string; chunk_count: number; motifs_found: number; settled_count: number } };
  grammar: { referents: Referent[]; relations: { subject: string; verb: string; object: string; polarity: string }[]; relation_total: number; relation_truncated?: boolean; network: { node_count: number; edge_count: number }; explicit_gaps: { terrain: string; organ: string; reason?: string; detail: string }[] };
  source_links?: SourceLink[];
  pages: Page[];
};

type Concept = { id: string; display: string; mentions: number; frames: number; surfaces: string[] };

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
// The exact fold eoreader7's own perceiver/text/surfaces.js::diaNorm uses
// (READING-POLICY.md P7.1: "the same one, by import, never by local
// reimplementation" — copied verbatim since browser code can't import from
// the Node-only vendored engine, not reinvented). Missing this is a real,
// named failure class there (A21/A22): a consumer's own name check
// disagreeing with the engine's fold reads as the material lacking someone
// it actually contains ("Natásha" found, "Natasha" not). Used below so a
// self-identified name matches an engine-discovered referent regardless of
// which of the two accents either one happens to use.
const DIA_RE = /[áàâäéèêëíìîïóòôöúùûü]/g;
const DIA_TO: Record<string, string> = { á: "a", à: "a", â: "a", ä: "a", é: "e", è: "e", ê: "e", ë: "e", í: "i", ì: "i", î: "i", ï: "i", ó: "o", ò: "o", ô: "o", ö: "o", ú: "u", ù: "u", û: "u", ü: "u" };
const diaNorm = (value: string) => String(value ?? "").toLowerCase().trim().replace(DIA_RE, (c) => DIA_TO[c]);
const spanDomId = (spanId: string) => spanId.replace(/[^a-zA-Z0-9_-]/g, "-");
const words = (value: string) => value.toLowerCase().match(/[a-z0-9]+/g) || [];
const generic = new Set(["action", "actions", "key", "findings", "strategy", "strategies", "unified", "division", "department", "public", "program", "programs", "policy", "report", "figure", "table", "source", "services", "development", "community", "fund", "funding", "tools", "analysis", "residents", "households", "people"]);
const noise = /^(?:the\s+|actions?$|key(?:\s+findings)?$|division$|figure$|source$|programs?$|responses?(?:\s+response)?(?:\s+percent)?$|total\s+responses?)/i;

function conceptGate(referent: Referent) {
  const label = referent.display.trim();
  const tokens = words(label);
  const acronym = /^[A-Z][A-Z0-9&-]{1,8}$/.test(label);
  const meaningful = tokens.filter((token) => !generic.has(token)).length;
  return referent.mentions >= 6 && referent.frames >= 5 && referent.frames / Math.max(1, referent.mentions) >= .25
    && label.length >= 3 && label.length <= 72 && tokens.length <= 6 && !noise.test(label)
    && (acronym || tokens.length >= 2) && (acronym || meaningful >= 1)
    && referent.surfaces.every((surface) => label.toLowerCase().includes(surface.toLowerCase()) || surface.toLowerCase().includes(label.toLowerCase()));
}

function definitionScore(span: Span, concept: Concept) {
  const text = normalize(span.text);
  const lower = text.toLowerCase();
  const surface = concept.surfaces.find((item) => lower.includes(item.toLowerCase()));
  if (!surface) return 0;
  const escaped = surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`^[•\\s]*${escaped}\\s*(?:\\([^)]{1,36}\\))?\\s*:`, "i").test(text)) return 10;
  if (new RegExp(`${escaped}\\s*(?:\\([^)]{1,36}\\))?\\s*,?\\s*(?:(?:which|that)\\s+[^,.]{0,60}\\s+)?(?:means\\b|is defined as|refers to|[^,.]{0,35}\\bdefines?\\s+as\\b)`, "i").test(text)) return 10;
  if (!/\bis\s+(?:a|an|the)\s+(?:faster|slower|more|less|better|worse)\b/i.test(text) && new RegExp(`${escaped}\\s*(?:\\([^)]{1,36}\\))?\\s+is\\s+(?:an?|the)\\s+`, "i").test(text)) return 7;
  return 0;
}

function sourceHref(witness: Witness, page: number) {
  return /^https?:/i.test(witness.stable_uri) ? `${witness.stable_uri}#page=${page}` : "";
}

// Spans carry exact byte/char offsets but the source's own paragraph and line
// structure — meaningful in a transcript, where each turn is one speaker —
// was previously discarded: every span rendered inline, joined by a plain
// space, regardless of what actually separated them in the source. The gap
// between one span's end and the next span's start (read straight out of the
// page's own text) still carries that: two-or-more newlines is a paragraph
// break, exactly one is a soft line break, anything else is the same run-on
// sentence flow prose already wants. Nothing here is inferred — it's already
// on the witness, just never read.
type PageItem = { kind: "span"; span: Span } | { kind: "break" };
type Turn = { items: PageItem[]; spans: Span[]; speakerLabel: string | null };

const SPEAKER_LABEL = /^([A-Z][A-Za-z]{0,24}(?:\s[A-Z][A-Za-z]{0,24}){0,2}):\s+/;

function pageTurns(page: Page): Turn[] {
  const turns: Turn[] = [];
  let items: PageItem[] = [];
  let spans: Span[] = [];
  let prevEnd = page.char_start;
  const flush = () => {
    if (!items.length) return;
    const labelMatch = SPEAKER_LABEL.exec(spans[0]?.text || "");
    turns.push({ items, spans, speakerLabel: labelMatch ? labelMatch[1] : null });
    items = []; spans = [];
  };
  page.spans.forEach((span, index) => {
    const gap = page.text.slice(prevEnd - page.char_start, span.char_start - page.char_start);
    const newlines = (gap.match(/\n/g) || []).length;
    if (index > 0) {
      if (newlines >= 2) flush();
      else if (newlines === 1) items.push({ kind: "break" });
    }
    items.push({ kind: "span", span });
    spans.push(span);
    prevEnd = span.char_end;
  });
  flush();
  return turns;
}

// A transcript names its speakers ("Speaker A:", "JOHN SMITH:") but that
// label is frequently a diarization channel, not a stable per-person
// identity — this exact transcript has multiple different real people
// speaking as "Speaker A" at different points, and sometimes multiple
// people's turns compressed into a single "Speaker B:" block by the
// transcription tool itself (one real block here opens "I'm Aubrey Hardy...",
// closes "I'm Carolina..." — two different people, one label). So
// self-identification is resolved per SPAN, not per turn or per label: each
// span is checked on its own, and only updates who subsequent spans resolve
// to once a new self-ID actually appears, so a second self-ID mid-turn
// correctly hands off attribution instead of the first one bleeding forward.
// Two patterns, both grammatically unambiguous as first-person self-reference
// (no guessing from a bare name appearing near a pronoun, which this
// transcript also shows is not safe — "Chloe, OHS." and "Grant Winter." are
// both the meeting chair naming someone ELSE, not that person speaking).
const SELF_ID_PATTERNS = [
  /\b[Mm]y name is\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,2})/,
  /\bI(?:'m| am)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,2})(?=[.,]|\s+(?:with|from)\b|$)/,
];
const FIRST_PERSON_SPLIT = /\b(I'm|I'd|I've|I'll|I|my|My|me|Me)\b/g;
const FIRST_PERSON_TEST = /^(?:I'm|I'd|I've|I'll|I|my|My|me|Me)$/;

function looksLikeName(candidate: string) {
  const words = candidate.trim().split(/\s+/);
  if (!words.length || words.length > 3) return false;
  return words.every((word) => {
    const letters = word.replace(/[^a-zA-Z]/g, "");
    return letters.length >= 2 && letters !== letters.toUpperCase();
  });
}

function detectSelfIdentification(turnText: string) {
  for (const pattern of SELF_ID_PATTERNS) {
    const match = pattern.exec(turnText);
    if (match && looksLikeName(match[1])) return match[1].trim();
  }
  return null;
}

export default function Commoncite() {
  const [witness, setWitness] = useState<Witness | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"Document" | "Concepts" | "Receipt">("Document");
  const [mode, setMode] = useState<"infinite" | "sections">("infinite");
  const [section, setSection] = useState(0);
  const [selectedConcept, setSelectedConcept] = useState("");
  const [showConceptLinks, setShowConceptLinks] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const witnessFileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/data/active-witness.json").then((response) => response.ok ? response.json() : null).then((payload) => { if (payload) setWitness(payload as Witness); }).catch(() => {});
  }, []);

  // Derived, never written back to the witness (the projection never changes
  // the witness — docs/IMPORTING.md's own rule). Walks each turn's spans in
  // order, tracking who's currently resolved; a self-ID in a span updates
  // that going forward within the SAME turn, so a second self-ID mid-turn
  // correctly takes over rather than the first one bleeding across it.
  // Either merges into an existing engine-discovered referent (by substring
  // overlap, e.g. "Sean" <-> "Sean Reed") or creates a new one, and counts
  // each resolved span's own first-person words as real, evidenced mentions
  // of that person — never a different span's.
  const speechAttribution = useMemo(() => {
    const spanSpeaker = new Map<string, { name: string; referentId: string }>();
    const built = new Map<string, Referent>();
    if (!witness) return { spanSpeaker, extraReferents: [] as Referent[] };
    const existingBySurface = (name: string) => witness.grammar.referents.find((r) =>
      diaNorm(r.display).includes(diaNorm(name)) || diaNorm(name).includes(diaNorm(r.display)));

    for (const page of witness.pages) {
      for (const turn of pageTurns(page)) {
        let current: { name: string; referentId: string } | null = null;
        for (const span of turn.spans) {
          const selfId = detectSelfIdentification(span.text);
          if (selfId) {
            const existing = existingBySurface(selfId);
            const referentId = existing ? existing.id : `ref:self-id:${selfId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            const display = existing && existing.display.length >= selfId.length ? existing.display : selfId;
            if (!built.has(referentId)) {
              built.set(referentId, {
                id: referentId, display, mentions: existing?.mentions ?? 0, frames: existing?.frames ?? 0,
                surfaces: [...new Set([...(existing?.surfaces ?? []), selfId])], selfIdentified: true,
              });
            }
            current = { name: display, referentId };
          }
          if (!current) continue;
          const pronounHits = (span.text.match(FIRST_PERSON_SPLIT) || []).length;
          if (!pronounHits) continue; // no first-person word in this span: nothing to link, nothing evidenced to count
          const record = built.get(current.referentId)!;
          record.mentions += pronounHits;
          record.frames += 1;
          spanSpeaker.set(span.span_id, current);
        }
      }
    }
    return { spanSpeaker, extraReferents: [...built.values()] };
  }, [witness]);

  // Frequency (mentions >= 6, frames >= 5, ...) is the ONLY evidence conceptGate
  // knows how to weigh — the right bar for a novel's or report's recurring
  // subject, but it means someone mentioned once systematically loses, no
  // matter how they were mentioned. A person explicitly self-identifying
  // ("My name is X") is different-in-kind evidence, not weaker evidence at a
  // smaller sample size — it isn't inferred from a pattern, it's a direct
  // first-person assertion — so speechAttribution's referents bypass the gate
  // entirely rather than trying to force them through it. conceptGate's other
  // checks (noise patterns, length) still don't apply here since these are
  // never noise; the frequency floor is specifically what self-ID evidence
  // doesn't need to clear.
  const concepts = useMemo(() => {
    if (!witness) return [];
    const gated = witness.grammar.referents.filter(conceptGate);
    const selfIds = speechAttribution.extraReferents.filter((r) => !gated.some((g) => g.id === r.id));
    return [...gated, ...selfIds]
      .map((referent) => ({ ...referent, surfaces: [...new Set([referent.display, ...referent.surfaces])] }))
      .sort((a, b) => b.mentions - a.mentions);
  }, [witness, speechAttribution]);
  const conceptMap = useMemo(() => {
    const map = new Map<string, Concept>();
    for (const concept of concepts) for (const surface of concept.surfaces) if (surface.length >= 3 && !map.has(surface.toLowerCase())) map.set(surface.toLowerCase(), concept);
    const pattern = [...map.keys()].sort((a, b) => b.length - a.length).map((surface) => surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    return { map, regex: pattern ? new RegExp(`\\b(${pattern})\\b`, "gi") : null };
  }, [concepts]);
  const sourceLinkMap = useMemo(() => {
    const map = new Map<string, SourceLink>();
    for (const link of witness?.source_links || []) if (link.text.length >= 3 && !map.has(link.text.toLowerCase())) map.set(link.text.toLowerCase(), link);
    const pattern = [...map.keys()].sort((a, b) => b.length - a.length).map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    return { map, regex: pattern ? new RegExp(`\\b(${pattern})\\b`, "gi") : null };
  }, [witness]);

  const sections = useMemo(() => {
    if (!witness) return [];
    const size = witness.pages.length > 80 ? 10 : witness.pages.length > 24 ? 6 : Math.max(1, witness.pages.length);
    const result: { title: string; pages: Page[] }[] = [];
    for (let index = 0; index < witness.pages.length; index += size) {
      const pages = witness.pages.slice(index, index + size);
      result.push({ title: pages.length === 1 ? `Page ${pages[0].page}` : `Pages ${pages[0].page}–${pages.at(-1)?.page}`, pages });
    }
    return result;
  }, [witness]);

  function loadFile(file: File) {
    setError("");
    file.text().then((text) => {
      const parsed = JSON.parse(text) as Witness;
      if (parsed.schema !== "CommonRecordWitness@1" || !Array.isArray(parsed.pages)) throw new Error("This is not a CommonRecordWitness@1 file.");
      setWitness(parsed); setView("Document"); setSelectedConcept("");
    }).catch((reason: Error) => setError(reason.message));
  }

  function describeImportError(reason: unknown) {
    const message = reason instanceof Error ? reason.message : String(reason);
    if (/failed to fetch|networkerror|econnrefused|load failed/i.test(message)) {
      return "The local import service isn't running. It should start automatically with npm run dev — check that terminal for errors.";
    }
    return message;
  }

  async function acceptWitness(response: Response) {
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.witness) throw new Error(payload?.error || `Import failed (${response.status}).`);
    setWitness(payload.witness as Witness); setView("Document"); setSelectedConcept("");
  }

  function importFile(file: File) {
    setError(""); setImporting(true);
    fetch("/local-import/import-file", {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream", "X-Filename": encodeURIComponent(file.name) },
      body: file,
    }).then(acceptWitness).catch((reason) => setError(describeImportError(reason))).finally(() => setImporting(false));
  }

  function importFromUrl(url: string) {
    setError(""); setImporting(true);
    fetch("/local-import/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
      .then(acceptWitness).catch((reason) => setError(describeImportError(reason))).finally(() => setImporting(false));
  }

  function renderConceptSegment(text: string, key: string) {
    if (!showConceptLinks || !conceptMap.regex) return [text];
    return text.split(conceptMap.regex).map((part, index) => {
      const concept = conceptMap.map.get(part.toLowerCase());
      return concept ? <button className="concept-link" key={`${key}-c${index}`} onClick={() => { setSelectedConcept(concept.id); setView("Concepts"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{part}</button> : part;
    });
  }

  // Within a turn that self-identified, its own first-person words ("I",
  // "I'm", "my"...) are now resolved evidence, not noise to strip — link
  // them to that turn's own resolved speaker. Only runs on plain-text
  // leftovers from the two passes above, and only for spans inside a turn
  // that actually carried a self-identification (speaker is undefined
  // everywhere else, so this is a no-op there).
  function renderSpeakerSegment(text: string, key: string, speaker?: { name: string; referentId: string }) {
    if (!speaker) return [text];
    return text.split(FIRST_PERSON_SPLIT).map((part, index) =>
      FIRST_PERSON_TEST.test(part)
        ? <button className="concept-link speaker-link" key={`${key}-p${index}`} title={`Resolved from this turn's own self-identification: "${speaker.name}"`} onClick={() => { setSelectedConcept(speaker.referentId); setView("Concepts"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{part}</button>
        : part
    );
  }

  // Original-source hyperlinks are matched first and rendered as real, external
  // links — never suppressed by the reader-link toggle, since they aren't ours.
  // Only the leftover plain-text segments get a chance at a reader concept-link,
  // so a term that's already the source's own citation keeps that citation's
  // precedence at that exact occurrence. Speaker-pronoun linking runs last, on
  // whatever plain text neither pass claimed.
  function linkText(text: string, key: string, speaker?: { name: string; referentId: string }) {
    const afterSource = !sourceLinkMap.regex ? renderConceptSegment(text, key) : text.split(sourceLinkMap.regex).flatMap((part, index) => {
      const link = sourceLinkMap.map.get(part.toLowerCase());
      if (!link) return renderConceptSegment(part, `${key}-${index}`);
      return [<a className="source-link" key={`${key}-s${index}`} href={link.href} target="_blank" rel="noreferrer">{part}<span className="source-link-icon" aria-hidden="true">↗</span></a>];
    });
    if (!speaker) return afterSource;
    return afterSource.flatMap((part, index) => typeof part === "string" ? renderSpeakerSegment(part, `${key}-sp${index}`, speaker) : [part]);
  }

  // One turn = one paragraph block, matching however the source itself broke
  // it (a speaker turn, a stanza, an ordinary prose paragraph — pageTurns()
  // doesn't know which, it just reads the gap). A leading "Speaker A:" label
  // is pulled out of the first span's own displayed text into a bold lead-in
  // — span.text itself, and its span_id hash, are untouched; this only
  // changes what's shown.
  function renderTurn(turn: Turn, turnKey: string) {
    const resolved = turn.spans[0] ? speechAttribution.spanSpeaker.get(turn.spans[0].span_id) : undefined;
    let firstSpanSeen = false;
    return <p className="turn" key={turnKey}>
      {turn.speakerLabel && <b className="speaker-label">{turn.speakerLabel}{resolved && resolved.name !== turn.speakerLabel ? ` (${resolved.name})` : ""}: </b>}
      {turn.items.map((item, index) => {
        if (item.kind === "break") return <br key={`${turnKey}-br${index}`} />;
        const span = item.span;
        const speaker = speechAttribution.spanSpeaker.get(span.span_id);
        const isFirst = !firstSpanSeen;
        firstSpanSeen = true;
        const shown = turn.speakerLabel && isFirst ? normalize(span.text).slice(turn.speakerLabel.length + 1).trim() : normalize(span.text);
        return <span className="sentence" id={spanDomId(span.span_id)} key={span.span_id}>{linkText(shown, span.span_id, speaker)} <a className="cite" href={`#${spanDomId(span.span_id)}`} title={`Bytes ${span.byte_start}–${span.byte_end}`}>¶</a>{" "}</span>;
      })}
    </p>;
  }

  function openSpan(span: Span) {
    const id = spanDomId(span.span_id);
    setMode("infinite");
    setView("Document");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      history.replaceState(null, "", `#${id}`);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
  }

  if (!witness) return <main className="import-home">
    <header><span className="seal">C</span><div><strong>COMMONCITE</strong><small>Portable model-free starter</small></div></header>
    <article>
      <p className="kicker">No source is bundled</p>
      <h1>Import anything. Preserve what it actually says.</h1>
      <p className="deck">Drop in a file or paste a URL. Deterministic adapters recover source-native text or structure; EOReader maps grammar, referents, relations, and explicit gaps without an LLM.</p>

      <div
        className={`drop-zone${dragActive ? " active" : ""}${importing ? " busy" : ""}`}
        onDragOver={(event) => { event.preventDefault(); if (!importing) setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => { event.preventDefault(); setDragActive(false); const file = event.dataTransfer.files?.[0]; if (file && !importing) importFile(file); }}
      >
        {importing ? <p>Importing — running EOReader, no model call…</p> : <>
          <p>Drop a file here, or</p>
          <button onClick={() => fileInput.current?.click()}>Choose a file</button>
          <input ref={fileInput} type="file" accept=".pdf,.docx,.html,.htm,.xml,.json,.geojson,.csv,.tsv,.md,.txt,.yaml,.yml" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; }} />
          <small>PDF, DOCX, HTML, JSON, GeoJSON, CSV, Markdown, text — anything else is still retained as a binary witness</small>
        </>}
      </div>

      <form className="url-import" onSubmit={(event) => { event.preventDefault(); if (importUrl.trim()) importFromUrl(importUrl.trim()); }}>
        <input type="url" placeholder="https://example.gov/report.pdf" value={importUrl} onChange={(event) => setImportUrl(event.target.value)} disabled={importing} required />
        <button type="submit" disabled={importing || !importUrl.trim()}>Import from URL</button>
      </form>

      {error && <p className="error">{error}</p>}
      <section className="import-grid"><div><b>1 · Witness</b><p>Hash and retain the original bytes before interpretation.</p></div><div><b>2 · Adapt</b><p>PDF, DOCX, HTML, JSON, GeoJSON, CSV, text, and unknown binary all have explicit outcomes.</p></div><div><b>3 · Read</b><p>EOReader 7 maps the recovered content with no model call.</p></div><div><b>4 · Project</b><p>The same witness becomes a wiki document, concept pages, definitions, and source trails.</p></div></section>
      <details><summary>What happens to an unsupported format?</summary><p>Its bytes, hash, media type, and provenance still enter the record. Semantic extraction is recorded as an explicit gap; the importer does not guess.</p></details>
      <details><summary>Advanced: load an exported witness file directly</summary><p>If you already have a <code>CommonRecordWitness@1</code> JSON file — from <code>npm run import:anything</code>, or exported from another Commoncite session — you can load it without re-running extraction.</p><button onClick={() => witnessFileInput.current?.click()}>Open a witness JSON</button><input ref={witnessFileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) loadFile(file); event.target.value = ""; }} /></details>
    </article>
  </main>;

  const visiblePages = mode === "infinite" ? witness.pages : sections[section]?.pages || [];
  const concept = concepts.find((item) => item.id === selectedConcept) || concepts[0];

  return <div className="wiki-shell">
    <header className="wiki-header"><span className="seal">C</span><div className="wordmark"><strong>COMMONCITE</strong><small>Portable civic knowledge commons</small></div><button onClick={() => { setWitness(null); setSelectedConcept(""); }}>Import another source</button></header>
    <div className="wiki-layout">
      <aside className="left-rail"><strong>Contents</strong><button className={view === "Document" ? "active" : ""} onClick={() => setView("Document")}>Full document</button><button className={view === "Concepts" ? "active" : ""} onClick={() => setView("Concepts")}>Generated concepts <span>{concepts.length}</span></button><button className={view === "Receipt" ? "active" : ""} onClick={() => setView("Receipt")}>Source receipt</button><hr /><strong>Source</strong><p>{witness.media_type}</p><p>{witness.extraction.page_count} page or unit boundaries</p><p>{witness.extraction.sentence_span_count.toLocaleString()} spans</p></aside>
      <main className="wiki-main">
        <header className="article-title"><p>{witness.edition} · imported witness</p><h1>{witness.title}</h1><span>From Commoncite, projected from a provenance-bearing EOReader event graph</span></header>
        <nav className="tabs"><button className={view === "Document" ? "active" : ""} onClick={() => setView("Document")}>Document</button><button className={view === "Concepts" ? "active" : ""} onClick={() => setView("Concepts")}>Concepts</button><button className={view === "Receipt" ? "active" : ""} onClick={() => setView("Receipt")}>Receipt</button></nav>

        {view === "Document" && <article className="document-view">
          <div className="source-note"><b>Source witness:</b> {/^https?:/i.test(witness.stable_uri) ? <a href={witness.stable_uri} target="_blank" rel="noreferrer">Open stable original ↗</a> : <code>{witness.stable_uri}</code>} <span>EOReader {witness.engine.release} · no LLM</span></div>
          <div className="reader-controls">
            <div><button className={mode === "infinite" ? "active" : ""} onClick={() => setMode("infinite")}>Infinite scroll</button><button className={mode === "sections" ? "active" : ""} onClick={() => setMode("sections")}>Sections</button></div>
            <div className="reader-controls-right">
              {mode === "sections" && <select value={section} onChange={(event) => setSection(Number(event.target.value))}>{sections.map((item, index) => <option value={index} key={item.title}>{item.title}</option>)}</select>}
              {conceptMap.regex && <label className="link-toggle"><input type="checkbox" checked={showConceptLinks} onChange={(event) => setShowConceptLinks(event.target.checked)} /> Reader-detected links</label>}
              {(conceptMap.regex || sourceLinkMap.regex) && <div className="link-legend">
                {conceptMap.regex && <span className="legend-item"><span className="legend-swatch concept" />Reader-detected</span>}
                {sourceLinkMap.regex && <span className="legend-item"><span className="legend-swatch source" />Original source link</span>}
              </div>}
            </div>
          </div>
          <div className="pages">{visiblePages.map((page) => <section className="page" id={`page-${page.page}`} key={page.page}><header><span>Page / unit {page.page}</span>{sourceHref(witness, page.page) && <a href={sourceHref(witness, page.page)} target="_blank" rel="noreferrer">Original ↗</a>}</header>{page.spans.length ? pageTurns(page).map((turn, index) => renderTurn(turn, `turn-${page.page}-${index}`)) : <p className="empty">No semantic text was recovered for this unit.</p>}</section>)}</div>
        </article>}

        {view === "Concepts" && <article className="concept-view">{concept ? <ConceptPage witness={witness} concept={concept} concepts={concepts} onConcept={setSelectedConcept} onOpenSpan={openSpan} /> : <div className="empty-panel"><h2>No concept page passed the gate</h2><p>The witness remains readable and citable. The portal does not manufacture concepts to fill the space.</p></div>}</article>}

        {view === "Receipt" && <article className="receipt-view"><div className="receipt-lead"><span>EO</span><div><h2>Import and engine receipt</h2><p>The source root, adapter, engine revision, and declared gaps travel with every projection.</p></div></div><dl><div><dt>Canonical source</dt><dd><code>{witness.stable_uri}</code></dd></div><div><dt>Retained bytes</dt><dd>{witness.source_integrity.preserved_copy ? <a href={witness.source_integrity.preserved_copy.replace(/^\.\//, "/")} download>Download content-addressed original</a> : "Not bundled with this witness"}</dd></div><div><dt>SHA-256</dt><dd><code>{witness.source_integrity.sha256}</code></dd></div><div><dt>Media type</dt><dd>{witness.media_type}</dd></div><div><dt>Adapter</dt><dd>{witness.extraction.adapter} · {witness.extraction.adapter_role}</dd></div><div><dt>Engine</dt><dd>EOReader {witness.engine.release} · <code>{witness.engine.commit}</code></dd></div><div><dt>Language</dt><dd>{witness.engine.language_received} · received, not inferred</dd></div><div><dt>LLM</dt><dd><strong>none</strong></dd></div><div><dt>Grammar</dt><dd>{witness.grammar.referents.length} referents · {witness.grammar.relation_total.toLocaleString()} relations · {witness.grammar.network.node_count.toLocaleString()} nodes</dd></div><div><dt>Original source links</dt><dd>{witness.source_links?.length ? `${witness.source_links.length} captured from source markup` : "None captured for this adapter"}</dd></div></dl><h2>Declared gaps</h2><ul>{witness.grammar.explicit_gaps.map((gap, index) => <li key={`${gap.terrain}-${gap.organ}-${index}`}><b>{gap.terrain} · {gap.reason || gap.organ}</b><span>{gap.detail}</span></li>)}</ul></article>}
      </main>
    </div>
  </div>;
}

function ConceptPage({ witness, concept, concepts, onConcept, onOpenSpan }: { witness: Witness; concept: Concept; concepts: Concept[]; onConcept: (id: string) => void; onOpenSpan: (span: Span) => void }) {
  const occurrences = witness.pages.flatMap((page) => page.spans).filter((span) => concept.surfaces.some((surface) => normalize(span.text).toLowerCase().includes(surface.toLowerCase())));
  const definitions = occurrences.map((span) => ({ span, score: definitionScore(span, concept) })).filter((item) => item.score).sort((a, b) => b.score - a.score || a.span.page - b.span.page).slice(0, 6);
  const relations = witness.grammar.relations.filter((relation) => concept.surfaces.some((surface) => `${relation.subject} ${relation.object}`.toLowerCase().includes(surface.toLowerCase()))).slice(0, 12);
  const related = (value: string) => concepts.find((candidate) => candidate.id !== concept.id && candidate.surfaces.some((surface) => normalize(value).toLowerCase().includes(surface.toLowerCase())));
  return <>
    <header className="concept-title"><p>Auto-projected concept page</p><h2>{concept.display}</h2><span>Passed co-reference and salience gate · no LLM</span></header>
    <p className="concept-lead"><b>{concept.display}</b> is a source-resolved referent appearing {concept.mentions.toLocaleString()} times across {concept.frames.toLocaleString()} EOReader frames. This fixed-template overview exposes only definitions, relations, and locations that survive deterministic gates.</p>
    <div className="projection-note"><b>EO</b><p><strong>Nothing here is a generated consensus.</strong> When no definition or relationship passes, the page says so.</p></div>
    <h2>Definitions in use</h2>{definitions.length ? definitions.map(({ span }, index) => <section className="definition" key={span.span_id}><b>{index ? "Additional scoped definition" : "Primary definition candidate"}</b><p>{normalize(span.text)}</p><a href={`#${spanDomId(span.span_id)}`} onClick={(event) => { event.preventDefault(); onOpenSpan(span); }}>Open exact source passage →</a></section>) : <p className="empty-panel">No explicit definition passed the definition gate.</p>}
    <h2>Relationships stated by the source</h2>{relations.length ? <table className="relations"><tbody>{relations.map((relation, index) => { const subject = related(relation.subject); const object = related(relation.object); return <tr key={`${index}-${relation.subject}`}><td>{subject ? <button onClick={() => onConcept(subject.id)}>{relation.subject}</button> : relation.subject}</td><th>{relation.verb}</th><td>{object ? <button onClick={() => onConcept(object.id)}>{relation.object}</button> : relation.object}</td></tr>; })}</tbody></table> : <p className="empty-panel">No clean relationship survived this projection.</p>}
    {witness.grammar.relation_truncated && <p className="truncation-note">This witness carries {witness.grammar.relations.length.toLocaleString()} of {witness.grammar.relation_total.toLocaleString()} relations the source-reading stated — the engine caps how many one witness response returns. {concept.display} may have relations beyond that cutoff that were never evaluated for this page, whether or not any are shown above.</p>}
    <h2>Source trail</h2><ol className="source-trail">{occurrences.slice(0, 24).map((span) => <li key={span.span_id}><a href={`#${spanDomId(span.span_id)}`} onClick={(event) => { event.preventDefault(); onOpenSpan(span); }}>Page / unit {span.page} · exact passage</a><code>{span.span_id.slice(0, 26)}…</code></li>)}</ol>
  </>;
}

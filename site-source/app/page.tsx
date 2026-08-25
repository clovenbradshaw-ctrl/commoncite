"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Span = { span_id: string; page: number; order: number; char_start: number; char_end: number; byte_start: number; byte_end: number; text: string };
type Page = { page: number; char_start: number; char_end: number; byte_start: number; byte_end: number; text: string; spans: Span[] };
type Referent = { id: string; display: string; mentions: number; frames: number; surfaces: string[] };
type Witness = {
  schema: string; title: string; edition: string; stable_uri: string; origin_uri: string; media_type: string;
  source_integrity: { sha256: string; byte_count?: number; preserved_copy?: string };
  extraction: { adapter: string; adapter_role: string; character_count: number; utf8_byte_count: number; page_count: number; sentence_span_count: number; all_page_text_retained: boolean };
  engine: { name: string; release: string; repository: string; commit: string; language_received: string; llm_used: boolean; model: null };
  admission: { chunk_count: number; admitted_span_count: number; reading: { admission_hash: string; chunk_count: number; motifs_found: number; settled_count: number } };
  grammar: { referents: Referent[]; relations: { subject: string; verb: string; object: string; polarity: string }[]; relation_total: number; network: { node_count: number; edge_count: number }; explicit_gaps: { terrain: string; organ: string; reason?: string; detail: string }[] };
  pages: Page[];
};

type Concept = { id: string; display: string; mentions: number; frames: number; surfaces: string[] };

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
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

export default function CommonRecordStarter() {
  const [witness, setWitness] = useState<Witness | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"Document" | "Concepts" | "Receipt">("Document");
  const [mode, setMode] = useState<"infinite" | "sections">("infinite");
  const [section, setSection] = useState(0);
  const [selectedConcept, setSelectedConcept] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/data/active-witness.json").then((response) => response.ok ? response.json() : null).then((payload) => { if (payload) setWitness(payload as Witness); }).catch(() => {});
  }, []);

  const concepts = useMemo(() => witness ? witness.grammar.referents.filter(conceptGate).map((referent) => ({ ...referent, surfaces: [...new Set([referent.display, ...referent.surfaces])] })).sort((a, b) => b.mentions - a.mentions) : [], [witness]);
  const conceptMap = useMemo(() => {
    const map = new Map<string, Concept>();
    for (const concept of concepts) for (const surface of concept.surfaces) if (surface.length >= 3 && !map.has(surface.toLowerCase())) map.set(surface.toLowerCase(), concept);
    const pattern = [...map.keys()].sort((a, b) => b.length - a.length).map((surface) => surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    return { map, regex: pattern ? new RegExp(`\\b(${pattern})\\b`, "gi") : null };
  }, [concepts]);

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

  function linkText(text: string, key: string) {
    if (!conceptMap.regex) return text;
    return text.split(conceptMap.regex).map((part, index) => {
      const concept = conceptMap.map.get(part.toLowerCase());
      return concept ? <button className="concept-link" key={`${key}-${index}`} onClick={() => { setSelectedConcept(concept.id); setView("Concepts"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{part}</button> : part;
    });
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
    <header><span className="seal">C</span><div><strong>COMMON RECORD</strong><small>Portable model-free starter</small></div></header>
    <article>
      <p className="kicker">No source is bundled</p>
      <h1>Import anything. Preserve what it actually says.</h1>
      <p className="deck">Files and URLs enter as content-addressed witnesses. Deterministic adapters recover source-native text or structure; EOReader maps grammar, referents, relations, and explicit gaps without an LLM.</p>
      <div className="import-actions"><button onClick={() => fileInput.current?.click()}>Open a witness JSON</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) loadFile(file); }} /><code>npm run import:anything -- &lt;file-or-url&gt;</code></div>
      {error && <p className="error">{error}</p>}
      <section className="import-grid"><div><b>1 · Witness</b><p>Hash and retain the original bytes before interpretation.</p></div><div><b>2 · Adapt</b><p>PDF, DOCX, HTML, JSON, GeoJSON, CSV, text, and unknown binary all have explicit outcomes.</p></div><div><b>3 · Read</b><p>EOReader 6.1 maps the recovered content with no model call.</p></div><div><b>4 · Project</b><p>The same witness becomes a wiki document, concept pages, definitions, and source trails.</p></div></section>
      <details><summary>What happens to an unsupported format?</summary><p>Its bytes, hash, media type, and provenance still enter the record. Semantic extraction is recorded as an explicit gap; the importer does not guess.</p></details>
    </article>
  </main>;

  const visiblePages = mode === "infinite" ? witness.pages : sections[section]?.pages || [];
  const concept = concepts.find((item) => item.id === selectedConcept) || concepts[0];

  return <div className="wiki-shell">
    <header className="wiki-header"><span className="seal">C</span><div className="wordmark"><strong>COMMON RECORD</strong><small>Portable civic knowledge commons</small></div><button onClick={() => { setWitness(null); setSelectedConcept(""); }}>Import another source</button></header>
    <div className="wiki-layout">
      <aside className="left-rail"><strong>Contents</strong><button className={view === "Document" ? "active" : ""} onClick={() => setView("Document")}>Full document</button><button className={view === "Concepts" ? "active" : ""} onClick={() => setView("Concepts")}>Generated concepts <span>{concepts.length}</span></button><button className={view === "Receipt" ? "active" : ""} onClick={() => setView("Receipt")}>Source receipt</button><hr /><strong>Source</strong><p>{witness.media_type}</p><p>{witness.extraction.page_count} page or unit boundaries</p><p>{witness.extraction.sentence_span_count.toLocaleString()} spans</p></aside>
      <main className="wiki-main">
        <header className="article-title"><p>{witness.edition} · imported witness</p><h1>{witness.title}</h1><span>From Common Record, projected from a provenance-bearing EOReader event graph</span></header>
        <nav className="tabs"><button className={view === "Document" ? "active" : ""} onClick={() => setView("Document")}>Document</button><button className={view === "Concepts" ? "active" : ""} onClick={() => setView("Concepts")}>Concepts</button><button className={view === "Receipt" ? "active" : ""} onClick={() => setView("Receipt")}>Receipt</button></nav>

        {view === "Document" && <article className="document-view">
          <div className="source-note"><b>Source witness:</b> {/^https?:/i.test(witness.stable_uri) ? <a href={witness.stable_uri} target="_blank" rel="noreferrer">Open stable original ↗</a> : <code>{witness.stable_uri}</code>} <span>EOReader {witness.engine.release} · no LLM</span></div>
          <div className="reader-controls"><div><button className={mode === "infinite" ? "active" : ""} onClick={() => setMode("infinite")}>Infinite scroll</button><button className={mode === "sections" ? "active" : ""} onClick={() => setMode("sections")}>Sections</button></div>{mode === "sections" && <select value={section} onChange={(event) => setSection(Number(event.target.value))}>{sections.map((item, index) => <option value={index} key={item.title}>{item.title}</option>)}</select>}</div>
          <div className="pages">{visiblePages.map((page) => <section className="page" id={`page-${page.page}`} key={page.page}><header><span>Page / unit {page.page}</span>{sourceHref(witness, page.page) && <a href={sourceHref(witness, page.page)} target="_blank" rel="noreferrer">Original ↗</a>}</header>{page.spans.length ? page.spans.map((span) => <span className="sentence" id={spanDomId(span.span_id)} key={span.span_id}>{linkText(normalize(span.text), span.span_id)} <a className="cite" href={`#${spanDomId(span.span_id)}`} title={`Bytes ${span.byte_start}–${span.byte_end}`}>¶</a>{" "}</span>) : <p className="empty">No semantic text was recovered for this unit.</p>}</section>)}</div>
        </article>}

        {view === "Concepts" && <article className="concept-view">{concept ? <ConceptPage witness={witness} concept={concept} concepts={concepts} onConcept={setSelectedConcept} onOpenSpan={openSpan} /> : <div className="empty-panel"><h2>No concept page passed the gate</h2><p>The witness remains readable and citable. The portal does not manufacture concepts to fill the space.</p></div>}</article>}

        {view === "Receipt" && <article className="receipt-view"><div className="receipt-lead"><span>EO</span><div><h2>Import and engine receipt</h2><p>The source root, adapter, engine revision, and declared gaps travel with every projection.</p></div></div><dl><div><dt>Canonical source</dt><dd><code>{witness.stable_uri}</code></dd></div><div><dt>Retained bytes</dt><dd>{witness.source_integrity.preserved_copy ? <a href={witness.source_integrity.preserved_copy.replace(/^\.\//, "/")} download>Download content-addressed original</a> : "Not bundled with this witness"}</dd></div><div><dt>SHA-256</dt><dd><code>{witness.source_integrity.sha256}</code></dd></div><div><dt>Media type</dt><dd>{witness.media_type}</dd></div><div><dt>Adapter</dt><dd>{witness.extraction.adapter} · {witness.extraction.adapter_role}</dd></div><div><dt>Engine</dt><dd>EOReader {witness.engine.release} · <code>{witness.engine.commit}</code></dd></div><div><dt>Language</dt><dd>{witness.engine.language_received} · received, not inferred</dd></div><div><dt>LLM</dt><dd><strong>none</strong></dd></div><div><dt>Grammar</dt><dd>{witness.grammar.referents.length} referents · {witness.grammar.relation_total.toLocaleString()} relations · {witness.grammar.network.node_count.toLocaleString()} nodes</dd></div></dl><h2>Declared gaps</h2><ul>{witness.grammar.explicit_gaps.map((gap, index) => <li key={`${gap.terrain}-${gap.organ}-${index}`}><b>{gap.terrain} · {gap.reason || gap.organ}</b><span>{gap.detail}</span></li>)}</ul></article>}
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
    <h2>Source trail</h2><ol className="source-trail">{occurrences.slice(0, 24).map((span) => <li key={span.span_id}><a href={`#${spanDomId(span.span_id)}`} onClick={(event) => { event.preventDefault(); onOpenSpan(span); }}>Page / unit {span.page} · exact passage</a><code>{span.span_id.slice(0, 26)}…</code></li>)}</ol>
  </>;
}

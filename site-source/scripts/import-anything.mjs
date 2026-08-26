#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith("--"));
const valueFor = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

if (!input) {
  console.error("Usage: npm run import:anything -- <file-or-url> [--title NAME] [--output FILE] [--stable-uri URI]");
  process.exit(64);
}

const outputPath = path.resolve(valueFor("--output", path.join(projectRoot, "public/data/active-witness.json")));
const sourceDir = path.resolve(valueFor("--source-dir", path.join(projectRoot, "public/imports")));
const bundledEngineRoot = path.resolve(projectRoot, "../eoreader7");
const engineRoot = path.resolve(process.env.EOREADER_ROOT || (fs.existsSync(bundledEngineRoot) ? bundledEngineRoot : "/workspace/eoreader7"));
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "commoncite-import-"));
const isUrl = /^https?:\/\//i.test(input);

function extensionFor(value) {
  try { return path.extname(isUrl ? new URL(value).pathname : value).toLowerCase(); }
  catch { return path.extname(value).toLowerCase(); }
}

function mediaTypeFor(extension, responseType = "") {
  if (responseType) return responseType.split(";")[0].trim();
  return ({
    ".txt": "text/plain", ".md": "text/markdown", ".html": "text/html", ".htm": "text/html", ".xml": "application/xml",
    ".json": "application/json", ".geojson": "application/geo+json", ".csv": "text/csv", ".tsv": "text/tab-separated-values",
    ".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".yaml": "application/yaml", ".yml": "application/yaml",
  })[extension] || "application/octet-stream";
}

function stripMarkup(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<w:tab\s*\/>/gi, "\t")
    .replace(/<w:br\s*\/>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function paginate(value, target = 60000) {
  const nativePages = value.split("\f").filter((page) => page.length);
  if (nativePages.length > 1) return nativePages;
  if (value.length <= target) return [value];
  const pages = [];
  let remaining = value;
  while (remaining.length) {
    if (remaining.length <= target) { pages.push(remaining); break; }
    let cut = remaining.lastIndexOf("\n\n", target);
    if (cut < target * .6) cut = remaining.lastIndexOf("\n", target);
    if (cut < target * .6) cut = target;
    pages.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\s+/, "");
  }
  return pages;
}

async function acquire() {
  if (!isUrl) {
    const localPath = path.resolve(input);
    if (!fs.existsSync(localPath)) throw new Error(`Input not found: ${localPath}`);
    return { filePath: localPath, bytes: fs.readFileSync(localPath), responseType: "" };
  }
  const response = await fetch(input, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const extension = extensionFor(input) || ".bin";
  const filePath = path.join(temporaryRoot, `download${extension}`);
  fs.writeFileSync(filePath, bytes);
  return { filePath, bytes, responseType: response.headers.get("content-type") || "" };
}

function extractText(filePath, bytes, mediaType, extension) {
  if (mediaType === "application/pdf" || extension === ".pdf") {
    const textPath = path.join(temporaryRoot, "document.txt");
    execFileSync("pdftotext", ["-layout", filePath, textPath], { stdio: "inherit" });
    return { text: fs.readFileSync(textPath, "utf8"), adapter: "pdftotext -layout", role: "deterministic PDF text and page-boundary recovery" };
  }
  if (extension === ".docx") {
    const xml = execFileSync("unzip", ["-p", filePath, "word/document.xml"], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
    return { text: stripMarkup(xml), adapter: "DOCX XML", role: "deterministic OOXML paragraph and text recovery" };
  }
  if (/html|xml/.test(mediaType) || [".html", ".htm", ".xml"].includes(extension)) {
    return { text: stripMarkup(bytes.toString("utf8")), adapter: "markup-strip", role: "deterministic visible-text recovery; original bytes retained" };
  }
  if (/json/.test(mediaType) || [".json", ".geojson"].includes(extension)) {
    const parsed = JSON.parse(bytes.toString("utf8"));
    return { text: JSON.stringify(parsed, null, 2), adapter: parsed?.type === "FeatureCollection" ? "GeoJSON FeatureCollection" : "JSON", role: "deterministic structured serialization; key order received from source" };
  }
  if (mediaType.startsWith("text/") || [".md", ".csv", ".tsv", ".yaml", ".yml"].includes(extension)) {
    return { text: bytes.toString("utf8"), adapter: extension.slice(1).toUpperCase() || "plain text", role: "UTF-8 text recovery" };
  }
  return { text: "", adapter: "binary witness", role: "content-addressed bytes retained; semantic extraction abstained because no deterministic adapter is installed" };
}

const acquired = await acquire();
const extension = extensionFor(input);
const mediaType = mediaTypeFor(extension, acquired.responseType);
const sha256 = createHash("sha256").update(acquired.bytes).digest("hex");
const sourceName = path.basename(isUrl ? new URL(input).pathname : input) || `source${extension || ".bin"}`;
const preservedName = `${sha256}${extension || ".bin"}`;
fs.mkdirSync(sourceDir, { recursive: true });
fs.copyFileSync(acquired.filePath, path.join(sourceDir, preservedName));

const extracted = extractText(acquired.filePath, acquired.bytes, mediaType, extension);
const title = valueFor("--title", sourceName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
const stableUri = valueFor("--stable-uri", isUrl ? input : `urn:sha256:${sha256}`);
const originUri = isUrl ? input : `./imports/${preservedName}`;
const pageTexts = extracted.text ? paginate(extracted.text) : [];
let engineCommit = "not-run";
let engineRelease = "7";
let admission = { chunks: 0, admitted: [] };
let reading = { admissionHash: "none", chunkCount: 0, motifsFound: 0, settledCount: 0 };
let terrains = null;
let splitSentences = () => [];
let canonicalHashSync = ({ sourceId, byteStart, byteEnd, text }) => createHash("sha256").update(`${sourceId}\0${byteStart}\0${byteEnd}\0${text}`).digest("hex");

if (extracted.text) {
  if (!fs.existsSync(path.join(engineRoot, "packages/host/corpus.js"))) throw new Error(`EOReader not found at ${engineRoot}. Set EOREADER_ROOT to an EOReader 7 checkout.`);
  const host = await import(pathToFileURL(path.join(engineRoot, "packages/host/corpus.js")));
  const readingHost = await import(pathToFileURL(path.join(engineRoot, "packages/host/reading.js")));
  const terrainHost = await import(pathToFileURL(path.join(engineRoot, "packages/host/terrains.js")));
  const spanModule = await import(pathToFileURL(path.join(engineRoot, "packages/engine/perceiver/text/spans.js")));
  const spec = await import(pathToFileURL(path.join(engineRoot, "packages/spec/index.js")));
  const commitFile = path.join(engineRoot, "EOREADER_COMMIT");
  engineCommit = fs.existsSync(commitFile)
    ? fs.readFileSync(commitFile, "utf8").trim()
    : execFileSync("git", ["-C", engineRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  splitSentences = spanModule.splitSentences;
  canonicalHashSync = spec.canonicalHashSync;
  const session = host.createSession({ spanCap: Math.ceil(extracted.text.length / 1800) + 100, engineVersion: `EOReader 7@${engineCommit}` });
  admission = host.admitChunked(session, { text: extracted.text, sourceId: stableUri, language: "und" });
  reading = readingHost.admitReading(session, { sourceId: stableUri, text: extracted.text });
  terrains = terrainHost.sessionTerrains(session, { sourceId: stableUri }).terrains;
  engineRelease = "7";
}

const byteLength = (value) => Buffer.byteLength(value, "utf8");
let globalChar = 0;
let globalByte = 0;
let spanCount = 0;
const pages = pageTexts.map((pageText, pageIndex) => {
  const page = pageIndex + 1;
  const charStart = globalChar;
  const byteStart = globalByte;
  const pageSpans = splitSentences(pageText).map((sentence) => {
    const sentenceByteStart = byteStart + byteLength(pageText.slice(0, sentence.offset));
    const sentenceByteEnd = sentenceByteStart + byteLength(sentence.text);
    spanCount += 1;
    return {
      span_id: `span:${canonicalHashSync({ sourceId: stableUri, byteStart: sentenceByteStart, byteEnd: sentenceByteEnd, text: sentence.text })}`,
      page, order: sentence.order, char_start: charStart + sentence.offset, char_end: charStart + sentence.offset + sentence.text.length,
      byte_start: sentenceByteStart, byte_end: sentenceByteEnd, text: sentence.text,
    };
  });
  const pageRecord = { page, char_start: charStart, char_end: charStart + pageText.length, byte_start: byteStart, byte_end: byteStart + byteLength(pageText), text: pageText, spans: pageSpans };
  globalChar += pageText.length + 1;
  globalByte += byteLength(pageText) + 1;
  return pageRecord;
});

const emptyGrammar = {
  terrain_sequence: [], outline: { sections: [], gap: { reason: "No deterministic semantic adapter output" } }, referents: [], referent_gaps: [], relations: [], relation_total: 0, relation_truncated: false,
  network: { node_count: 0, edge_count: 0, binding: { entities: 0, pairsTested: 0, witnessed: 0 }, form_binding: { forms: 0, candidateForms: 0, pairsTested: 0, witnessed: 0 }, stage_count: 0 },
  explicit_gaps: [{ terrain: "Void", organ: "adapter", reason: "unsupported-binary", detail: extracted.role }], kind: { silence: "explicit", schedule: "none" },
};

const witness = {
  schema: "CommonRecordWitness@1", title, edition: "imported witness", source_id: stableUri, stable_uri: stableUri, origin_uri: originUri, media_type: mediaType,
  source_integrity: { sha256, byte_count: acquired.bytes.length, preserved_copy: `./imports/${preservedName}` },
  extraction: { adapter: extracted.adapter, adapter_role: extracted.role, character_count: extracted.text.length, utf8_byte_count: byteLength(extracted.text), page_count: pages.length, sentence_span_count: spanCount, all_page_text_retained: Boolean(extracted.text) },
  engine: { name: "EOReader", release: engineRelease, repository: "https://github.com/clovenbradshaw-ctrl/eoreader7", commit: engineCommit, language_received: "und", llm_used: false, model: null },
  admission: { chunk_count: admission.chunks || 0, admitted_span_count: admission.admitted?.length || 0, reading: { admission_hash: reading.admissionHash, chunk_count: reading.chunkCount, motifs_found: reading.motifsFound, settled_count: reading.settledCount } },
  grammar: terrains ? {
    terrain_sequence: ["Void", "Field", "Atmosphere", "Entity", "Link", "Network", "Kind", "Lens", "Paradigm"], outline: terrains.Field.outline, referents: terrains.Entity.referents, referent_gaps: terrains.Entity.gaps,
    relations: terrains.Link.relations, relation_total: terrains.Link.total, relation_truncated: terrains.Link.truncated,
    network: { node_count: terrains.Network.nodeCount, edge_count: terrains.Network.edgeCount, binding: terrains.Network.binding, form_binding: terrains.Network.formBinding, stage_count: terrains.Network.stages.length },
    explicit_gaps: terrains.Void.ledger, kind: terrains.Kind, lens: terrains.Lens, paradigm: terrains.Paradigm,
  } : emptyGrammar,
  citation_contract: { source_text_is_not_article_prose: true, locator_form: "stable_uri + page/unit + EOReader byte-addressed span_id", self_grounding_rule: "A proposition with no external span is evidence only that it was asserted." },
  pages,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(witness)}\n`);
fs.rmSync(temporaryRoot, { recursive: true, force: true });
console.log(JSON.stringify({ output: outputPath, title, media_type: mediaType, source_sha256: sha256, pages: pages.length, spans: spanCount, referents: witness.grammar.referents.length, relations: witness.grammar.relation_total, llm_used: false }, null, 2));

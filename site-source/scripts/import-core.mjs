import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function extensionFor(name) {
  try { return path.extname(name).toLowerCase(); }
  catch { return ""; }
}

export function mediaTypeFor(extension, responseType = "") {
  if (responseType) return responseType.split(";")[0].trim();
  return ({
    ".txt": "text/plain", ".md": "text/markdown", ".html": "text/html", ".htm": "text/html", ".xml": "application/xml",
    ".json": "application/json", ".geojson": "application/geo+json", ".csv": "text/csv", ".tsv": "text/tab-separated-values",
    ".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".yaml": "application/yaml", ".yml": "application/yaml",
  })[extension] || "application/octet-stream";
}

export function stripMarkup(value) {
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

export function extractHyperlinks(html) {
  const links = [];
  const seen = new Set();
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html))) {
    const href = (match[2] ?? match[3] ?? "").trim();
    if (!/^https?:\/\//i.test(href) && !href.startsWith("/")) continue;
    const text = stripMarkup(match[4]).trim();
    if (text.length < 3) continue;
    const key = `${href} ${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ href, text });
  }
  return links;
}

export function paginate(value, target = 60000) {
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

function extractText({ filePath, bytes, mediaType, extension, temporaryRoot }) {
  if (mediaType === "application/pdf" || extension === ".pdf") {
    const textPath = path.join(temporaryRoot, "document.txt");
    try {
      execFileSync("pdftotext", ["-layout", filePath, textPath], { stdio: "pipe" });
    } catch (error) {
      throw new Error(`pdftotext failed or is not installed. PDF import needs the poppler-utils "pdftotext" command on this machine. (${error instanceof Error ? error.message : error})`);
    }
    return { text: fs.readFileSync(textPath, "utf8"), adapter: "pdftotext -layout", role: "deterministic PDF text and page-boundary recovery" };
  }
  if (extension === ".docx") {
    let xml;
    try {
      xml = execFileSync("unzip", ["-p", filePath, "word/document.xml"], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
    } catch (error) {
      throw new Error(`unzip failed or is not installed. DOCX import needs the "unzip" command on this machine. (${error instanceof Error ? error.message : error})`);
    }
    return { text: stripMarkup(xml), adapter: "DOCX XML", role: "deterministic OOXML paragraph and text recovery" };
  }
  if (/html|xml/.test(mediaType) || [".html", ".htm", ".xml"].includes(extension)) {
    const raw = bytes.toString("utf8");
    const isHtml = /html/.test(mediaType) || [".html", ".htm"].includes(extension);
    return {
      text: stripMarkup(raw), adapter: "markup-strip",
      role: isHtml ? "deterministic visible-text recovery; original hyperlinks captured separately; original bytes retained" : "deterministic visible-text recovery; original bytes retained",
      links: isHtml ? extractHyperlinks(raw) : [],
    };
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

// The one place that turns acquired bytes into a CommonRecordWitness@1 document.
// Both the CLI (scripts/import-anything.mjs) and the local browser-facing
// service (scripts/import-server.mjs) call this — neither reimplements
// adapter or engine-invocation logic on its own.
export async function buildWitness({
  bytes, sourceName, responseType = "", isUrl = false, originalRef = "",
  titleOverride = "", stableUriOverride = "", engineRoot, sourceDir,
}) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "commoncite-import-"));
  try {
    const extension = extensionFor(sourceName);
    const mediaType = mediaTypeFor(extension, responseType);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const preservedName = `${sha256}${extension || ".bin"}`;
    const filePath = path.join(temporaryRoot, `source${extension || ".bin"}`);
    fs.writeFileSync(filePath, bytes);

    fs.mkdirSync(sourceDir, { recursive: true });
    fs.copyFileSync(filePath, path.join(sourceDir, preservedName));

    const extracted = extractText({ filePath, bytes, mediaType, extension, temporaryRoot });
    const title = titleOverride || sourceName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    const stableUri = stableUriOverride || (isUrl ? originalRef : `urn:sha256:${sha256}`);
    const originUri = isUrl ? originalRef : `./imports/${preservedName}`;
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

    return {
      schema: "CommonRecordWitness@1", title, edition: "imported witness", source_id: stableUri, stable_uri: stableUri, origin_uri: originUri, media_type: mediaType,
      source_integrity: { sha256, byte_count: bytes.length, preserved_copy: `./imports/${preservedName}` },
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
      source_links: extracted.links || [],
      pages,
    };
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

#!/usr/bin/env node

// A plain, dependency-free Node HTTP server that runs the real importer
// (pdftotext, unzip, and the vendored EOReader engine — none of which can
// run inside the app's own Next.js route handlers, since those execute in
// a sandboxed Workers/Miniflare runtime with no child_process and no access
// to the real project filesystem). This is what the browser's import UI
// actually talks to, via vite.config.ts's dev-server proxy at /local-import.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildWitness } from "./import-core.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.resolve(path.join(projectRoot, "public/imports"));
const bundledEngineRoot = path.resolve(projectRoot, "../eoreader7");
const engineRoot = path.resolve(process.env.EOREADER_ROOT || (fs.existsSync(bundledEngineRoot) ? bundledEngineRoot : "/workspace/eoreader7"));
const port = Number(process.env.IMPORT_SERVER_PORT || 8934);
const MAX_BYTES = 64 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BYTES) { reject(new Error(`Upload exceeds the ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit for the local import service.`)); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Filename, X-Title",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
    return res.end();
  }

  try {
    if (req.method === "GET" && req.url === "/health") {
      return send(res, 200, { ok: true, engine_root: engineRoot, engine_found: fs.existsSync(path.join(engineRoot, "packages/host/corpus.js")) });
    }

    if (req.method === "POST" && req.url === "/import-file") {
      const bytes = await readBody(req);
      if (!bytes.length) return send(res, 400, { error: "No file bytes received." });
      const sourceName = req.headers["x-filename"] ? decodeURIComponent(String(req.headers["x-filename"])) : "upload.bin";
      const title = req.headers["x-title"] ? decodeURIComponent(String(req.headers["x-title"])) : "";
      const witness = await buildWitness({ bytes, sourceName, responseType: req.headers["content-type"] || "", isUrl: false, titleOverride: title, engineRoot, sourceDir });
      return send(res, 200, { witness });
    }

    if (req.method === "POST" && req.url === "/import-url") {
      const raw = await readBody(req);
      const body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
      if (!/^https?:\/\//i.test(body.url || "")) return send(res, 400, { error: "A valid http(s) URL is required." });
      const response = await fetch(body.url, { redirect: "follow" });
      if (!response.ok) return send(res, 502, { error: `Fetching the source failed: ${response.status} ${response.statusText}` });
      const bytes = Buffer.from(await response.arrayBuffer());
      const sourceName = path.basename(new URL(body.url).pathname) || "download.bin";
      const witness = await buildWitness({
        bytes, sourceName, responseType: response.headers.get("content-type") || "", isUrl: true,
        originalRef: body.url, titleOverride: body.title || "", engineRoot, sourceDir,
      });
      return send(res, 200, { witness });
    }

    send(res, 404, { error: "Not found." });
  } catch (error) {
    console.error("[import-server]", error);
    send(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, () => {
  console.log(`Commoncite local import service listening on http://localhost:${port}`);
  console.log(`Engine root: ${engineRoot}${fs.existsSync(path.join(engineRoot, "packages/host/corpus.js")) ? "" : " (NOT FOUND — set EOREADER_ROOT)"}`);
});

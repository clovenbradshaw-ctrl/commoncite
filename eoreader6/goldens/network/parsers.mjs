// eoreader6 · goldens/network/parsers — reading the four received ground
// truths back into one shape: { nodes: [name, …], edges: [{a, b, weight}] }.
//
// Every parser here only READS a frozen third-party artifact (goldens/network/
// refs/) — none of it touches the engine, the same discipline goldens/cast
// keeps between fetch.mjs (the gift) and read.mjs (the score).

import { readFileSync } from "node:fs";

const splitCsvLine = (line) => {
  // Minimal CSV: the only quoted field in these two datasets is
  // `description`, and it never itself contains an escaped quote.
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
};

const parseCsv = (text) => {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = splitCsvLine(l);
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  });
};

/** Les Misérables — d3.js's canonical format: {nodes:[{name,group}], links:[{source,target,value}]}. */
export const parseLesMisJson = (path) => {
  const d = JSON.parse(readFileSync(path, "utf8"));
  const nodes = d.nodes.map((n) => n.name);
  const edges = d.links.map((l) => ({ a: nodes[l.source], b: nodes[l.target], weight: l.value }));
  return { nodes, edges };
};

/**
 * Huckleberry Finn / David Copperfield — Stanford GraphBase parse: a
 * `code,description` node table (the character's name is the text before
 * the first comma in `description` — "Abner Shackleford, friend of PW" —
 * everything after the comma is the compiler's own relational gloss, not
 * part of the name) and a `source,target,weight` edge table keyed by code.
 */
export const parseNodeEdgeCsv = (nodesPath, edgesPath) => {
  const nodeRows = parseCsv(readFileSync(nodesPath, "utf8"));
  const codeToName = new Map(nodeRows.map((r) => [r.code, r.description.split(",")[0].trim()]));
  const nodes = [...codeToName.values()];
  const edgeRows = parseCsv(readFileSync(edgesPath, "utf8"));
  const edges = edgeRows
    .filter((r) => codeToName.has(r.source) && codeToName.has(r.target))
    .map((r) => ({ a: codeToName.get(r.source), b: codeToName.get(r.target), weight: Number(r.weight) }));
  return { nodes, edges };
};

/**
 * Shakespeare (Rieck et al.) — Pajek `.net`: `*Vertices N` then
 * `id "Label"` lines, then `*Edges` (or `*Arcs`) then `id1 id2 weight`
 * lines. Weight here is a filtration value, not a raw count — fine for
 * recall/precision (existence, not magnitude) and for a rank correlation,
 * not for a literal "shared scenes" comparison.
 */
export const parsePajekNet = (path) => {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const idToName = new Map();
  const edges = [];
  let section = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\*Vertices/i.test(line)) { section = "vertices"; continue; }
    if (/^\*Edges/i.test(line) || /^\*Arcs/i.test(line)) { section = "edges"; continue; }
    if (line.startsWith("*")) { section = null; continue; }
    if (section === "vertices") {
      const m = line.match(/^(\d+)\s+"([^"]*)"/);
      if (m) idToName.set(m[1], m[2]);
    } else if (section === "edges") {
      const [id1, id2, w] = line.split(/\s+/);
      if (idToName.has(id1) && idToName.has(id2)) edges.push({ a: idToName.get(id1), b: idToName.get(id2), weight: Number(w) });
    }
  }
  return { nodes: [...idToName.values()], edges };
};

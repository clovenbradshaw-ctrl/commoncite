// native/eval/golden-network.mjs — the NATIVE reading scored blind against
// a third-party human-built character network (Knuth, Stanford GraphBase,
// 1993 — goldens/network's own frozen reference, giver in its manifest).
//
// THIS IS THE SEALED TIER. The engine never sees the reference; the score
// runs after the fact, through the 6.1 golden's OWN exported scorer and
// fuzzy matcher (imported, never re-derived — a re-written scorer would
// make the two assemblies' numbers incomparable). The 6.1 baseline this
// is read against (les-miserables.read.json, committed in the golden):
// entity recall 49.4%, edge recall 26.8%, edge precision 68%, chance mean
// 18.6 of 100.
//
// ASSEMBLY, NAMED (P0): the full native reader (createRecursiveReader +
// causal text perceiver) -> the log -> projectHypergraph (the graph IS the
// projection from the log) -> networkStanding for edges. Numbers: window
// MEASURED by dmdWindow on this book's own first-quarter mention stream;
// draws/alpha/seed from LINK_SPEC's convention (cited in
// kernel/network-standing.js).
//
// Usage: node native/eval/golden-network.mjs <pg135.txt>

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { reviseTextFold } from "../adapters/text/revision.js";
import { createRecursiveReader } from "../../kernel.js";
import { projectHypergraph } from "../kernel/hypergraph-projection.js";
import { dmdWindow } from "../kernel/activation.js";
import { bindLinks } from "../../legacy-eoreader6.1/packages/engine/emergence/binding.js";
import { score } from "../../legacy-eoreader6.1/goldens/network/read.mjs";
import { parseLesMisJson } from "../../legacy-eoreader6.1/goldens/network/parsers.mjs";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
const LINK = { draws: 199, alpha: 0.05, seed: 20260812 };
const WINDOW_CANDIDATES = [8, 16, 32, 64, 128, 256];

async function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/golden-network.mjs <pg135.txt>");
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  const encounters = textEncounters(stripped.text, { source: "gutenberg:135", offset: stripped.offset });

  const reader = createRecursiveReader({
    perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25, posPrior: POS_PRIOR })],
    adapters: {
      revise: reviseTextFold,
      retrieve: (_fold, evidence) => Object.freeze({
        schema: "EORelevantFold@1",
        witnessed: Object.freeze([...evidence]),
        provisional: Object.freeze([]), expectations: Object.freeze([]), obligations: Object.freeze([]),
        exclusions: Object.freeze([]), unresolvedAlternatives: Object.freeze([]), activeFrames: Object.freeze([]),
        receivedPriors: Object.freeze([]),
      }),
    },
  });
  const reading = await reader.read(encounters);

  // window measured on this book's own first-quarter mention stream
  const bare = projectHypergraph(reading.log);
  const quarter = Math.floor(bare.cursorExtent / 4);
  const obs = Array.from({ length: quarter + 1 }, () => []);
  for (const n of bare.nodes) for (const a of n.arrivals) if (a <= quarter) obs[a].push(n.id);
  const top1 = (o) => {
    const m = new Map();
    for (const r of o.flat()) m.set(r, (m.get(r) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 1).map(([r]) => r);
  };
  const measured = dmdWindow(obs, top1, { candidates: WINDOW_CANDIDATES });
  if (measured.window == null) throw new Error(`window measurement gapped: ${measured.gap}`);

  const g = projectHypergraph(reading.log, { standing: { bindLinks, window: measured.window, ...LINK } });

  // the golden's own scorer wants: register [{id,...}], edges [{a,b,weight}], displaySurfaceOf
  const displayById = new Map(g.nodes.map((n) => [n.id, (n.surfaces?.[0]?.surface ?? n.surfaces?.[0] ?? n.id.replace(/^ref:auto:/, "").replace(/_/g, " "))]));
  const register = g.nodes.map((n) => ({ id: n.id }));
  const edges = g.network.edges.map((e) => ({ a: e.a, b: e.b, weight: e.coArrivals }));
  const ref = parseLesMisJson(new URL("../../legacy-eoreader6.1/goldens/network/refs/lesmis.json", import.meta.url).pathname);
  const result = score(register, edges, ref, (id) => displayById.get(id));

  console.log(JSON.stringify({
    schema: "EOGoldenNetworkNative@1",
    book: "les-miserables (pg135)",
    assembly: "native recursive reader -> append-only log -> projectHypergraph (standing: engine bindLinks injected) -> 6.1 golden's own scorer, blind",
    declared: { window: { value: measured.window, basis: "dmdWindow, top-1 derive, this book's own first-quarter mention stream" }, ...LINK },
    reference: { giver: "Knuth, Stanford GraphBase (1993), via goldens/network/refs/lesmis.json", nodes: ref.nodes.length, edges: ref.edges.length },
    baseline61: { note: "goldens/network/read/les-miserables.read.json — the 6.1 assembly's own committed score", entityRecall: 0.4935, edgeRecall: 0.2677, edgePrecision: 0.68, candidateEdges: 100, chanceMean: 18.565 },
    native: result,
    readerNodes: g.nodes.length,
    standingEdges: g.network.edges.length,
  }, null, 1));
}

main().catch((err) => { console.error(err); process.exit(1); });

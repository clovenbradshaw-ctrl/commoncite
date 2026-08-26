// native/eval/hypergraph-cursor.mjs — the hypergraph projected from the log
// at four cursors, with the hyperlexicon projected from EACH cursor's own
// hypergraph. Scrubbing the cursor is scrubbing belief: a node at 100% may
// be two nodes at 25% (identity is retrieval-time), an affordance offered
// at 100% may not exist at 25% (the ledger never offers what the reading
// had not witnessed).
//
// Usage: node native/eval/hypergraph-cursor.mjs <book.txt>

import fs from "node:fs";
import { stripContainer } from "../adapters/text/spans.js";
import { createCausalTextPerceiver, textEncounters } from "../adapters/text/recursive.js";
import { reviseTextFold } from "../adapters/text/revision.js";
import { createRecursiveReader } from "../../kernel.js";
import { projectHypergraph, hyperlexiconAt } from "../kernel/hypergraph-projection.js";
import { anchorAsDefiniteBinding } from "../adapters/text/anchoring.js";
import { bindLinks, buildLink } from "../../legacy-eoreader6.1/packages/engine/emergence/binding.js";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
// window 8: the dmd-measured reach of "who is this stretch about" on
// pg84's own first quarter (terrain-activation-live, derive named there);
// draws/alpha/seed: LINK_SPEC's convention (kernel/network-standing.js).
const STANDING = { bindLinks, buildLink, window: 8, draws: 199, alpha: 0.05, seed: 20260812 };

async function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/hypergraph-cursor.mjs <book.txt>");
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  const encounters = textEncounters(stripped.text, { source: `file:${path.split("/").pop()}`, offset: stripped.offset });
  const reader = createRecursiveReader({
    perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25, posPrior: POS_PRIOR, descriptorAnchoring: { minActivation: 0.05, minMargin: 0.2 } })],
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

  const cursors = [1, 2, 3, 4].map((q) => Math.floor((reading.log.length * q) / 4));
  const at = cursors.map((atSeq, i) => {
    const g = projectHypergraph(reading.log, { atSeq, standing: STANDING });
    const hl = hyperlexiconAt(g, { projectBindings: anchorAsDefiniteBinding });
    const comp = Object.values(hl.composition);
    return {
      cursor: `${(i + 1) * 25}%`, atSeq,
      nodes: g.nodes.length, links: g.links.length,
      standingEdges: g.network.edges.length, refused: g.network.refused,
      oriented: g.network.direction?.computed ? g.network.direction.oriented.length : null,
      hyperlexicon: {
        affordances: comp.length,
        byStanding: comp.reduce((m, a) => ({ ...m, [a.standing]: (m[a.standing] ?? 0) + 1 }), {}),
        sample: comp.slice(0, 4).map((a) => `${a.left} ∘ ${a.right} [${a.standing}]`),
      },
      topStanding: g.network.edges.slice(0, 4).map((e) => `${e.a}—${e.b} (co=${e.coArrivals})`),
    };
  });

  console.log(JSON.stringify({
    schema: "EOHypergraphCursorRun@1",
    book: path.split("/").pop(),
    logEntries: reading.log.length,
    declared: { window: STANDING.window, draws: STANDING.draws, alpha: STANDING.alpha, seed: STANDING.seed },
    at,
    note: "the log is the reality; each row is one projection of it — hypergraph at the cursor, hyperlexicon projected from THAT hypergraph, never from the whole log",
  }, null, 1));
}

main().catch((err) => { console.error(err); process.exit(1); });

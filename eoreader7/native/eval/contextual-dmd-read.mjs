// native/eval/contextual-dmd-read.mjs — the modes of a reading, measured
// where the reader stands, with nothing typed in.
//
// Contrast with eval/salience-dmd.mjs, which this supersedes as a claim:
// that driver fixed DIMS=16 and RANK=8 and pinned one roster at sentence 63
// for the whole book, so its "period ~29 sentences" was the modes of
// Walton's opening vocabulary read through 3,328 later sentences. Here the
// basis is whatever the CURRENT stretch contains, the rank is whatever the
// data excites, and the stretch itself is measured by dmdWindow.
//
// The reader is asked at several standpoints, each answered from its own
// prefix only (READING-SPEC S3). Nothing about a standpoint uses material
// after it.
//
// Usage: node native/eval/contextual-dmd-read.mjs <book.txt>

import fs from "node:fs";
import { stripContainer, splitSentences } from "../adapters/text/spans.js";
import { tokens, codeOf, encodeFrame } from "../memory/activation.js";
import { contextualModes } from "../adapters/text/contextual-dmd.js";
import { dominantClass } from "../adapters/text/construction.js";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
const UD_CLOSED = new Set(["ADP", "AUX", "CCONJ", "DET", "NUM", "PART", "PRON", "SCONJ"]);

function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/contextual-dmd-read.mjs <book.txt>");
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  const sentences = splitSentences(stripped.text);

  // one causal pass: at each sentence, the band's admitted motifs present in it
  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 };
  const observations = [];
  for (const s of sentences) {
    const ws = tokens(s.text);
    const { trace, cue } = codeOf(ws, state, {});
    const counts = new Map();
    for (const w of ws) {
      if (!cue.has(w)) continue;                       // the band decides membership
      const c = dominantClass(w, POS_PRIOR);
      if (c == null || UD_CLOSED.has(c)) continue;     // UD's own closed classes, the giver's taxonomy
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    observations.push(counts);
    encodeFrame(state, s.order, ws, trace, {});
  }

  // standpoints: the reader asked at each quarter of what it has read,
  // derived from the material's own length rather than chosen positions
  const n = observations.length;
  const standpoints = [1, 2, 3, 4].map((k) => Math.floor((n * k) / 4));

  const readings = standpoints.map((at) => {
    const out = contextualModes(observations.slice(0, at));
    const osc = (out.eigenvalues ?? []).filter((l) => Math.abs(l.im) > 0);
    return {
      standpointSentence: at,
      windowMeasured: out.window ?? null,
      windowGap: out.windowGap ?? null,
      dims: out.dims ?? null,
      rankExcited: out.rank ?? null,
      gap: out.gap ?? null,
      topMode: out.eigenvalues?.[0]
        ? { magnitude: Number(out.eigenvalues[0].magnitude.toFixed(4)),
            halfLifeUnits: Number((Math.log(0.5) / Math.log(out.eigenvalues[0].magnitude)).toFixed(2)) }
        : null,
      oscillatoryCount: osc.length,
      topOscillatory: osc[0]
        ? { magnitude: Number(osc[0].magnitude.toFixed(4)),
            periodUnits: Number(((2 * Math.PI) / Math.abs(osc[0].frequency)).toFixed(1)),
            // the number that decides whether a "period" means anything:
            // what fraction of the mode survives one of its own periods
            survivesOnePeriod: Number(Math.pow(osc[0].magnitude, (2 * Math.PI) / Math.abs(osc[0].frequency)).toExponential(2)) }
        : null,
    };
  });

  console.log(JSON.stringify({
    schema: "EOContextualDmdRead@1",
    book: path.split("/").pop(),
    construction: {
      basis: "the band-admitted, open-class motifs present in the measured stretch — derived per standpoint, never pinned",
      rank: "numerical — every direction the data excited above floating-point noise at this matrix's own scale",
      window: "measured by kernel/activation.js::dmdWindow against a DISCRETE conclusion (rank, oscillatory count), so no tolerance is smuggled in",
      candidates: "dyadic ladder over what has been read",
      standpoints: "quarters of the material's own length",
      typedDials: "none",
    },
    sentences: n,
    readings,
  }, null, 1));
}

main();

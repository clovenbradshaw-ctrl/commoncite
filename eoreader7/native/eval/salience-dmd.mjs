// native/eval/salience-dmd.mjs — the modes of a real reading: salience picks
// the observables, the stream measures their dynamics, DMD names the modes.
//
// NO WORD LIST ANYWHERE. The observables are the first `DIMS` motifs the
// material's OWN salience band admits — memory/activation.js's incremental
// gate, distinctive (idf >= floor) AND recurring (df >= 2), computed at each
// sentence from only the sentences already read. The roster is pinned the
// moment it fills; snapshots begin at the NEXT sentence. Everything before
// that moment is roster-building, not trajectory — which is the causal way
// to hold the state dimension fixed (READING-SPEC S3: the roster is the
// prefix's, the trajectory is what follows, nothing reads backward).
//
// NO DECAY CONSTANT. Each snapshot is the raw count of each roster motif in
// that sentence. The eigenvalue magnitudes ARE the measured persistence of
// the reading's own modes; a gamma imposed on the state would hand the
// modes my number and call it theirs (dmd-stream.js's own header).
//
// FIRST LOOK, said plainly: the declared dials (DIMS, RANK) carry reasons
// but no golden exists for "the modes of a novel," so the output is
// reported as measurement of a declared construction, not as a validated
// reading surface.
//
// TWO ARMS, one run. The band alone admits closed-class motifs — the cast
// golden's own fi-11940 lesson ("recurrence individuates a function word
// exactly as confidently as a character"). The second arm excludes them BY
// THE RECEIVED PRIOR, not by a hand list: Universal Dependencies' own
// taxonomy names its closed classes (ADP, AUX, CCONJ, DET, NUM, PART, PRON,
// SCONJ — universaldependencies.org/u/pos, the giver's own division), and a
// motif is refused when POSPrior@1's dominant tag for it is one of those.
// Both arms are reported; the difference between them is a finding.
//
// Usage: node native/eval/salience-dmd.mjs <book.txt>

import fs from "node:fs";
import { stripContainer, splitSentences } from "../adapters/text/spans.js";
import { tokens, codeOf, encodeFrame } from "../memory/activation.js";
import { createStreamingDmd } from "../kernel/dmd-stream.js";
import { dominantClass } from "../adapters/text/construction.js";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
// UD's own closed-class inventory, received verbatim from the giver's taxonomy
const UD_CLOSED = new Set(["ADP", "AUX", "CCONJ", "DET", "NUM", "PART", "PRON", "SCONJ"]);

const DIMS = 16; // declared: a reading budget — enough observables to hold several modes, small enough that the Gram stays well-excited on one novel
const RANK = 8;  // declared: at most half the observables — a mode needs more than one direction's evidence

function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/salience-dmd.mjs <book.txt>");
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  const sentences = splitSentences(stripped.text);

  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 };
  const arms = {
    band: { admit: () => true, roster: [], rosterAt: new Map(), pinnedAt: null, stream: createStreamingDmd({ dims: DIMS }), snapshots: 0 },
    open: {
      admit: (w) => { const c = dominantClass(w, POS_PRIOR); return c != null && !UD_CLOSED.has(c); },
      roster: [], rosterAt: new Map(), pinnedAt: null, stream: createStreamingDmd({ dims: DIMS }), snapshots: 0,
    },
  };

  for (const s of sentences) {
    const ws = tokens(s.text);
    const { trace, cue } = codeOf(ws, state, {});

    for (const arm of Object.values(arms)) {
      if (arm.pinnedAt == null) {
        // roster-building: admit band-clearing unigram motifs in arrival order
        for (const w of cue.keys()) {
          if (w.includes(" ")) continue;          // unigram observables only, this pass
          if (!arm.admit(w)) continue;
          if (!arm.rosterAt.has(w) && arm.roster.length < DIMS) { arm.roster.push(w); arm.rosterAt.set(w, s.order); }
        }
        if (arm.roster.length === DIMS) arm.pinnedAt = s.order;
      } else {
        const seen = new Map();
        for (const w of ws) seen.set(w, (seen.get(w) ?? 0) + 1);
        arm.stream.push(arm.roster.map((w) => seen.get(w) ?? 0));
        arm.snapshots += 1;
      }
    }
    encodeFrame(state, s.order, ws, trace, {});
  }
  console.log(JSON.stringify({
    schema: "EOSalienceDmdRun@1",
    book: path.split("/").pop(),
    declared: {
      DIMS: `${DIMS} — a reading budget, declared with its reason and uncalibrated (no modes-of-a-novel golden exists)`,
      RANK: `${RANK} — at most half the observables`,
      band: "memory/activation.js's own incremental salience: idf >= floor AND df >= 2, nothing hand-listed",
      decay: "none imposed — mode magnitudes are the measured persistence",
    },
    sentencesTotal: sentences.length,
    arms: Object.fromEntries(Object.entries(arms).map(([name, arm]) => {
      const out = arm.stream.modes({ rank: RANK });
      return [name, {
        filter: name === "open"
          ? "UD's own closed classes refused via POSPrior@1 dominant tag (giver: universaldependencies.org/u/pos)"
          : "the band alone — no class filter",
        roster: arm.roster.map((w) => ({ motif: w, admittedAtSentence: arm.rosterAt.get(w) })),
        pinnedAtSentence: arm.pinnedAt,
        snapshots: arm.snapshots,
        rankResolved: out.rank,
        modes: (out.eigenvalues ?? []).map((l) => ({
          magnitude: Number(l.magnitude.toFixed(4)),
          growth: Number(l.growth.toFixed(4)),
          frequency: Number(l.frequency.toFixed(4)),
          periodSentences: l.period == null ? null : Number(l.period.toFixed(1)),
        })),
      }];
    })),
  }, null, 1));
}

main();

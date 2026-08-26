// native/eval/being-construction.mjs — the being-evidence gate's own reading
// position, re-decided by the construction rather than by the word type.
//
// THE MEASUREMENT. anchoring.js's gate asks "is the word after this
// descriptor a verb?" and answers from POSPrior@1's TYPE-level counts
// (keep a form when VERB > AUX). Measured on Frankenstein, four of five
// admissions are licensed by `had` or `became`, and two of those are
// passives where the descriptor is the patient. This driver puts the SAME
// question to construction.js::collapseForm, which resolves the licensing
// token AT ITS OCCURRENCE against ConstructionPrior@1.
//
// PREDICTION, RECORDED BEFORE THE RUN. `had` in "the murder had been
// committed" should collapse AUX (frame = the dominant class of "been",
// which is AUX; the treebank cell had|AUX is 41/46 AUX). The two PP cases
// — "the appearance of the city had", "the passage towards the south
// became" — should NOT be fixed by this level, because their error is that
// the descriptor is not the subject at all, which is a boundary (SEG)
// question and not a class-superposition (DEF) one. A level that fixed
// those too would be a level doing something it cannot see.
//
// Usage: node native/eval/being-construction.mjs <book.txt>

import fs from "node:fs";
import { stripContainer, splitSentences } from "../adapters/text/spans.js";
import { collapseForm, dominantClass } from "../adapters/text/construction.js";

const POS_PRIOR = JSON.parse(fs.readFileSync(new URL("../../legacy-eoreader6.1/bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
const CONSTRUCTION_PRIOR = JSON.parse(fs.readFileSync(new URL("../priors/construction-eng.json", import.meta.url), "utf8"));

// DECLARED, and disclosed as uncalibrated: no being-hood golden exists yet,
// so this floor is not walked against any score. Every row prints its own
// share so a reader can see whether a verdict sits near the boundary or far
// from it — which is the honest substitute for a calibration this repo has
// not earned.
const MIN_SHARE = 2 / 3;

// The gate's own five admissions plus the agent it refuses.
const WATCHED = ["the murder", "the child", "the city", "the south", "the turk", "the woman"];
const WORD = /[\p{L}][\p{L}'’]*/gu;

// The gate's TAG WALL, reproduced exactly: keep a form when VERB > AUX.
// This is the half of the gate under study, NOT the whole gate — the
// shipped gate ALSO requires the form to be in the 11-verb vocabulary
// discoverRelationVocab measured on this book. So a row marked
// tagWall:ADMITS is not a claim that the shipped gate admits it; it is a
// claim about the tag test alone, which is what the construction prior
// replaces. Saying otherwise would credit this level with fixing a
// sparsity problem it never touched.
const typeLevelVerdict = (form) => {
  const f = POS_PRIOR.forms?.[String(form).toLowerCase()];
  if (!f) return { admits: false, why: "unattested" };
  const admits = (f.VERB ?? 0) > (f.AUX ?? 0);
  return { admits, why: `VERB ${f.VERB ?? 0} vs AUX ${f.AUX ?? 0}` };
};

function main() {
  const path = process.argv[2];
  if (!path) throw new TypeError("usage: node native/eval/being-construction.mjs <book.txt>");
  const stripped = stripContainer(fs.readFileSync(path, "utf8"));
  const rows = [];

  for (const s of splitSentences(stripped.text)) {
    const words = [...s.text.matchAll(WORD)].map((m) => ({ w: m[0], at: m.index }));
    const lower = words.map((x) => x.w.toLowerCase());
    for (const descriptor of WATCHED) {
      const parts = descriptor.split(" ");
      for (let i = 0; i + parts.length < words.length; i += 1) {
        if (!parts.every((p, k) => lower[i + k] === p)) continue;
        const j = i + parts.length;          // the licensing token — the gate's reading position
        const licensing = words[j];
        if (!licensing) continue;
        const next = words[j + 1]?.w ?? null; // the frame
        const type = typeLevelVerdict(licensing.w);
        const collapsed = collapseForm(licensing.w, next, {
          constructionPrior: CONSTRUCTION_PRIOR,
          formPrior: POS_PRIOR,
          minShare: MIN_SHARE,
        });
        rows.push({
          descriptor,
          licensing: licensing.w.toLowerCase(),
          frame: collapsed.frame,
          nextToken: next,
          tagWall: { admitsAsAgency: type.admits, basis: type.why },
          construction: {
            standing: collapsed.standing,
            cls: collapsed.cls,
            share: collapsed.share == null ? null : Number(collapsed.share.toFixed(3)),
            n: collapsed.n,
            basis: collapsed.basis,
          },
          // agency survives only if the licensing token collapses to a real
          // VERB at this occurrence; AUX, live and gap all withhold it
          agencyAfterCollapse: collapsed.standing === "collapsed" && collapsed.cls === "VERB",
          text: s.text.replace(/\s+/g, " ").trim().slice(0, 190),
        });
      }
    }
  }

  const licensedByGate = rows.filter((r) => r.tagWall.admitsAsAgency);
  const survives = licensedByGate.filter((r) => r.agencyAfterCollapse);
  const overturned = licensedByGate.filter((r) => !r.agencyAfterCollapse);
  const rescued = rows.filter((r) => !r.tagWall.admitsAsAgency && r.agencyAfterCollapse);

  console.log(JSON.stringify({
    schema: "EOBeingConstructionRun@1",
    book: path.split("/").pop(),
    organ: "native/adapters/text/construction.js::collapseForm over ConstructionPrior@1",
    declared: { MIN_SHARE, WATCHED, calibration: "none — MIN_SHARE is declared and uncalibrated; every row prints its own share" },
    priors: {
      form: { giver: POS_PRIOR.provenance ?? null, forms: Object.keys(POS_PRIOR.forms ?? {}).length },
      construction: { giver: CONSTRUCTION_PRIOR.provenance?.giver ?? null, conditionedForms: CONSTRUCTION_PRIOR.stats?.conditionedForms ?? null },
    },
    tally: {
      readingPositions: rows.length,
      licensedByTagWall: licensedByGate.length,
      survivesCollapse: survives.length,
      overturnedByCollapse: overturned.length,
      rescuedByCollapse: rescued.length,
    },
    rows,
  }, null, 1));
}

main();

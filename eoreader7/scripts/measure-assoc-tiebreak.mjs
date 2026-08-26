// Does the associative tie-break resolve the golden's tied cases above chance?
//
// The mechanical formula (coverage/phrase/ngram) leaves a genuine tie when no
// candidate is a confirmed outlier by the licensed maxDeviation/resample
// Born-null test; on those cases `assocTieBreak` hands the tied set to
// activation.js's Hebbian associative memory and asks which candidate the
// query's own vocabulary actually co-fires with across the corpus's reading.
//
// Scored the way surf-vs-spine.mjs scored the first surf: recall against a
// budget-matched null. The tie-break's budget is the tied set itself — it
// picks ONE candidate per case, so chance at the same budget is a uniform
// pick among the tied candidates. A random tie-breaker recovers
//   expected = Σ |correct ⊆ tied| / |tied|
// over the tied cases. An abstention (the graph has no opinion) is scored
// separately, never as a hit: the existing earliest-wins determinism still
// resolves the tie, but that is the fallback, not the signal under test.

import { readFileSync } from "node:fs";
import { createSession, admitChunked, sessionSegments } from "../packages/host/corpus.js";
import { executePrompt, assocTieBreak } from "../packages/host/surfer.js";
import { tokens as assocTokens, codeOf as assocCodeOf, encodeFrame as assocEncodeFrame, recall as assocRecall } from "../packages/engine/emergence/activation.js";

const GOLDEN_PATH = "conformance/golden/surfer-snips-golden.json";
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));

// Which tied candidate the golden actually requires. Replicated from the
// surfer's own resolveRange: the anchor's segment is the outline heading
// whose span contains it; the golden's expected `segment` is that label
// (verified below by confirming the surrogate reproduces the live winner's
// segment for every tied case, so the script can never mislabel one).
const labelFor = (outline, byteStart) => {
  const hs = outline.headings || [];
  if (hs.length === 0) return null;
  let lo = 0, hi = hs.length - 1, hit = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (hs[mid].start <= byteStart) { hit = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return hit === -1 ? null : hs[hit].label;
};

let tied = 0;
let assocHits = 0;
let assocScored = 0;
let assocFlips = 0;
let chance = 0;
let abstained = 0;
const rows = [];

for (const c of GOLDEN.cases) {
  const session = createSession();
  for (const docId of c.docs) {
    const doc = GOLDEN.documents[docId];
    admitChunked(session, { text: doc.text, sourceId: docId });
  }
  const out = executePrompt(session, c.prompt);
  const entries = out.fan
    ? out.fan.map((r, i) => ({ r, id: `${c.id}[${i}]`, sourceId: c.docs[i], expect: (c.expect || {}).fan[i] }))
    : [{ r: out, id: c.id, sourceId: c.docs[0], expect: c.expect || {} }];

  for (const { r, id, sourceId, expect } of entries) {
    const m = r.content_match;
    if (!m || !m.ambiguous || !m.tiedCandidates || m.tiedCandidates.length < 2) continue;
    tied++;
    const outline = sessionSegments(session, { sourceId });
    const expected = expect.segment;
    const cands = m.tiedCandidates;

    const idx = outline.idx;
    const pick = assocTieBreak(session, GOLDEN.documents[sourceId], c.prompt, cands, idx);
    const picked = pick ? pick.anchorLine : null;

    const correct = cands.filter((t) => labelFor(outline, t.byte_start) === expected);
    const correctLines = new Set(correct.map((t) => t.anchorLine));
    const correctCount = correct.length;
    chance += correctCount / cands.length;

    let verdict;
    if (pick === null) {
      abstained++;
      verdict = "ABSTAIN";
    } else {
      assocScored++;
      const hit = correctLines.has(picked);
      if (hit) assocHits++;
      const flipped = picked !== r.content_line;
      if (flipped) assocFlips++;
      verdict = hit ? `HIT   pick=${picked}${flipped ? " (flipped)" : ""}` : `MISS  pick=${picked}${flipped ? " (flipped)" : ""} → expected ${[...correctLines]} / got line ${r.content_line}`;
    }

    // Sanity: the surrogate must reproduce the live winner's segment, else
    // the correctness label below is untrustworthy.
    const liveLabel = r.segment ?? null;
    const winnerLabel = labelFor(outline, idx.starts[r.content_line]);
    const sane = liveLabel === winnerLabel;
    if (!sane) console.error(`WARNING: surrogate label mismatch on ${id}: live "${liveLabel}" vs surrogate "${winnerLabel}"`);

    rows.push({ id, expected, cands: cands.length, correct: correctLines.size, verdict, sane });
  }
}

console.log(`\nTied cases in the 33/33 golden: ${tied}`);
for (const r of rows) {
  console.log(`  ${r.verdict}  ${r.id}  (${r.cands} tied, ${r.correct} correct)  expected "${r.expected}"`);
}
console.log(`\nAssoc signal, scored where it has an opinion: ${assocHits}/${assocScored}`);
console.log(`Chance at the same budget (uniform pick over the tied set): ${chance.toFixed(2)}/${tied}`);
console.log(`  ratio: ${assocScored > 0 ? (assocHits / assocScored).toFixed(2) : "—"}x vs ${(chance / tied).toFixed(2)} chance`);
console.log(`Abstentions (no opinion — earliest-wins fallback resolves): ${abstained}/${tied}`);
console.log(`Picks that flipped the mechanical winner: ${assocFlips}`);

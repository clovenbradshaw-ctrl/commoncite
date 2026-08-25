// eoreader6 · scripts/experiments/resolve-span-role — EXPERIMENTAL, unwired.
//
// resolveSpanRole: a sibling to perceiver/text/pronouns.js::resolvePronouns,
// same shape, re-targeted. Where resolvePronouns binds a third-person
// pronoun to an already-NAMED referent by one-hop activation recall,
// resolveSpanRole binds an INSTANCE of a structurally ambiguous span (a
// surface form whose occurrences split across multiple induced kinds — see
// goldens/agency-civic/data/pos-superposition.json for how these were
// found) to an already-EVIDENCED kind, same mechanism, same floors.
//
// THE POINT THIS OPERATIONALIZES: a span's role is never a property of its
// surface form. "covered" is not an adjective or a verb; a given INSTANCE
// of "covered" already is one or the other (or something else), and the
// honest state before enough context has arrived is superposition, not a
// 55/45 split. Resolution happens causally, in reading order, from what the
// reading has evidenced so far — never a batch pass, never an average
// across all of a word's uses. Reuses activation.js completely unmodified.
//
// KIND REGISTRY: two coarse kinds built from role-fold-verb-island's own
// saved output, not re-induced here — this script consumes an existing
// kind vocabulary, it does not create one:
//   "actor"  — fillers whose surviving clusters were labeled pos:*before*
//              (BIA, EPA, FAA, Commission, Department, applicant...)
//   "predicate-complement" — fillers whose surviving clusters were labeled
//              pos:*after* (established, committed, accepted, applicable...)
// A word already unambiguous by this registry (appears in only one kind)
// marks that kind PRESENT in its sentence, exactly as a named surface marks
// a referent present for resolvePronouns. A word that is itself ambiguous
// (present in the registry under both kinds, or one of the flagged
// heterogeneous fillers) is a resolution TARGET, exactly as a pronoun is.
//
// Usage: node scripts/experiments/resolve-span-role.mjs <pocket-dir[,dir2,...]> [docLimit]

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { splitSentences, deriveAbbreviations } from "../../packages/engine/perceiver/text/spans.js";
import { codeOf, recall, encodeFrame, tokens } from "../../packages/engine/emergence/activation.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const POCKET_DIR = process.argv[2];
const LIMIT = process.argv[3] ? Number(process.argv[3]) : Infinity;
const MIN_ACTIVATION = Number(process.env.MIN_ACTIVATION ?? 0.05); // same declared floor host/corpus.js already uses for resolvePronouns (PRONOUN_MIN_ACTIVATION) — restated, not re-derived, so this stays comparable
const MIN_MARGIN = Number(process.env.MIN_MARGIN ?? 0.2); // same as PRONOUN_MIN_MARGIN

if (!POCKET_DIR) {
  console.error("usage: node resolve-span-role.mjs <pocket-dir[,dir2,...]> [docLimit]");
  process.exit(1);
}

// ── (1) Build the kind registry from already-saved role-fold-verb-island output ──
const islandPath = join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-verb-island.experiment.json");
const island = JSON.parse(readFileSync(islandPath, "utf8"));

const wordKindVotes = new Map(); // word -> { actor: n, complement: n }
for (const r of island.results) {
  const recs = new Map((r.records ?? []).map((rec) => [rec.id, rec.label]));
  for (const k of r.kinds) {
    if (k.height !== "above") continue;
    const isActor = k.label.includes("before");
    const isComplement = k.label.includes("after");
    if (!isActor && !isComplement) continue;
    for (const m of k.members) {
      const label = (recs.get(m) ?? m).toLowerCase();
      if (label.includes(" ")) continue; // single tokens only for this pass
      if (!wordKindVotes.has(label)) wordKindVotes.set(label, { actor: 0, complement: 0 });
      const v = wordKindVotes.get(label);
      if (isActor) v.actor++;
      if (isComplement) v.complement++;
    }
  }
}

// A word is an UNAMBIGUOUS marker for a kind only if every vote it got went
// the same way — same discipline as extractSurfaces' own capitalisation
// physics filter (a word seen only ever one way is real evidence; a word
// seen both ways is exactly the ambiguity this script exists to resolve).
const kindMarker = new Map(); // word -> 'actor' | 'complement'
const ambiguousWords = new Set();
for (const [word, v] of wordKindVotes) {
  if (v.actor > 0 && v.complement > 0) ambiguousWords.add(word);
  else if (v.actor > 0) kindMarker.set(word, "actor");
  else if (v.complement > 0) kindMarker.set(word, "complement");
}
console.log(`kind registry: ${kindMarker.size} unambiguous markers, ${ambiguousWords.size} ambiguous resolution targets`);
console.log(`sample targets: ${[...ambiguousWords].slice(0, 15).join(", ")}\n`);

// ── (2) resolveSpanRole — resolvePronouns's exact shape, re-targeted ────────
export const resolveSpanRole = (sentences, { minActivation, minMargin, idfFloor, minLen, completion = 0.5, topEdges = 6, edgeSlots = 24 } = {}) => {
  if (!Number.isFinite(minActivation) || minActivation < 0) throw new TypeError("resolveSpanRole: minActivation is declared");
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 1) throw new TypeError("resolveSpanRole: minMargin is declared");

  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 };
  const kindsByFrame = new Map(); // sentenceOrder -> Set('actor'|'complement')
  const bindings = [];
  const gaps = [];

  for (const sentence of sentences) {
    const ws = tokens(sentence.text);
    const { trace, cue } = codeOf(ws, state, { minLen, idfFloor });

    // Which kinds are UNAMBIGUOUSLY evidenced in this sentence by a marker
    // word — same role namedMatchesIn plays for resolvePronouns.
    const present = new Set();
    for (const w of ws) {
      const k = kindMarker.get(w);
      if (k) present.add(k);
    }
    kindsByFrame.set(sentence.order, present);

    // Resolution targets: ambiguous words present in THIS sentence.
    const hits = [...new Set(ws)].filter((w) => ambiguousWords.has(w));
    if (hits.length === 0) continue;

    const activation = recall(cue, state, { completion, topEdges, selfOrder: sentence.order });

    // Best single hop per kind, never summed — same reasoning resolvePronouns
    // states for referents: a kind recalled from many weak frames should not
    // outscore one recalled from a single strong, specific frame.
    const kindScore = new Map();
    for (const [order, amt] of activation) {
      const kinds = kindsByFrame.get(order);
      if (!kinds) continue;
      for (const k of kinds) {
        if (amt > (kindScore.get(k) ?? -Infinity)) kindScore.set(k, amt);
      }
    }

    for (const word of hits) {
      const candidates = [...kindScore.entries()].sort((a, b) => b[1] - a[1]);

      if (candidates.length === 0) {
        gaps.push({ reason: "span_no_candidate", sentenceOrder: sentence.order, word, detail: "no kind has been evidenced yet in this reading to recall against" });
        continue;
      }
      const [topKind, topScore] = candidates[0];
      if (topScore < minActivation) {
        gaps.push({ reason: "span_below_floor", sentenceOrder: sentence.order, word, top: topKind, activation: topScore });
        continue;
      }
      const second = candidates[1]?.[1] ?? 0;
      const margin = topScore > 0 ? (topScore - second) / topScore : 0;
      if (margin < minMargin) {
        gaps.push({ reason: "span_no_margin", sentenceOrder: sentence.order, word, top: topKind, runnerUp: candidates[1]?.[0] ?? null, margin });
        continue;
      }

      bindings.push({ kind: topKind, sentenceOrder: sentence.order, word, activation: topScore, margin });
      // A resolved instance can prime later ones — but only via the same
      // recall/margin gate every other instance has to clear. Added to
      // THIS frame's evidence, not asserted globally.
      kindsByFrame.get(sentence.order).add(topKind);
    }

    encodeFrame(state, sentence.order, ws, trace, { edgeSlots });
  }

  return { bindings, gaps };
};

// ── (3) Run it over the real pocket, in document order ──────────────────
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(txt|md)$/.test(entry)) out.push(full);
  }
  return out;
};
const files = POCKET_DIR.split(",").flatMap((root) => walk(root)).slice(0, LIMIT);

let totalBindings = [];
let totalGaps = [];
const perWordKinds = new Map(); // word -> Set of kinds it actually resolved to, across real instances

// Console-only lookup, deliberately never attached to a binding and never
// written to disk — goldens/agency-civic/data is a committed artifact, and
// a corpus's own sentence text is exactly what a Pocket firewall forbids
// there (eoPriors::pocket.js's own forbidden-content-key list: text,
// sentence, excerpt, quote, body, document, page, paragraph). The mechanism
// itself only ever needs sentence.order (an opaque position), never the
// text at that position, to do its job — printing a sample below, for a
// human running this script interactively, is a display concern, not part
// of the result.
const sentenceTextByKey = new Map(); // `${fileIndex}#${order}` -> text

for (let fi = 0; fi < files.length; fi++) {
  const file = files[fi];
  const text = readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
  const sentences = splitSentences(text, { abbreviations: deriveAbbreviations(text) });
  if (!sentences.length) continue;
  for (const s of sentences) sentenceTextByKey.set(`${fi}#${s.order}`, s.text.slice(0, 160));
  const { bindings, gaps } = resolveSpanRole(sentences, { minActivation: MIN_ACTIVATION, minMargin: MIN_MARGIN });
  for (const b of bindings) {
    if (!perWordKinds.has(b.word)) perWordKinds.set(b.word, new Set());
    perWordKinds.get(b.word).add(b.kind);
  }
  totalBindings.push(...bindings.map((b) => ({ ...b, _fi: fi })));
  totalGaps.push(...gaps);
}

console.log(`${files.length} documents, ${totalBindings.length} instance-level resolutions, ${totalGaps.length} typed gaps (stayed plural)\n`);

const gapReasons = {};
for (const g of totalGaps) gapReasons[g.reason] = (gapReasons[g.reason] ?? 0) + 1;
console.log("gap reasons:", gapReasons, "\n");

// The actual proof this is instance-level, not type-level: the same surface
// word resolving to DIFFERENT kinds on different real occurrences.
const splitWords = [...perWordKinds.entries()].filter(([, kinds]) => kinds.size > 1);
console.log(`${splitWords.length} words resolved to BOTH kinds across different real instances (the same surface form, genuinely different referents, never forced to one type-level answer):\n`);
for (const [word] of splitWords.slice(0, 15)) {
  const examples = totalBindings.filter((b) => b.word === word).slice(0, 2);
  console.log(`  "${word}":`);
  for (const ex of examples) console.log(`    -> ${ex.kind}  (margin ${ex.margin.toFixed(2)}): "${sentenceTextByKey.get(`${ex._fi}#${ex.sentenceOrder}`) ?? ""}"`);
}

// `_fi` was carried only for the console sample above — corpus-source
// bookkeeping, not part of the result. Stripped before anything is written.
const persistedBindings = totalBindings.map(({ _fi, ...b }) => b);

mkdirSync(join(HERE, "..", "..", "goldens", "agency-civic", "data"), { recursive: true });
const outPath = join(HERE, "..", "..", "goldens", "agency-civic", "data", "resolve-span-role.experiment.json");
writeFileSync(outPath, JSON.stringify({ minActivation: MIN_ACTIVATION, minMargin: MIN_MARGIN, docsProcessed: files.length, bindingCount: persistedBindings.length, gapCount: totalGaps.length, gapReasons, splitWordCount: splitWords.length, bindings: persistedBindings, gaps: totalGaps.slice(0, 500) }, null, 2));
console.log(`\nwrote ${outPath} (no corpus sentence text persisted — samples above are console-only)`);

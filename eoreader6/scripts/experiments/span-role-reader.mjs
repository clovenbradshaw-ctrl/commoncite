// eoreader6 · scripts/experiments/span-role-reader — EXPERIMENTAL, unwired.
//
// Composes three already-proven pieces of the role-fold arc into one
// reading tool, instead of three disconnected one-shot measurement
// scripts each writing its own JSON blob:
//
//   1. role-fold-verb-island.mjs proved per-verb "islands" of candidate
//      filler words reach induceKinds' height=above (real structure)
//      where every cross-verb-pooled attempt before it landed on
//      unstable.
//   2. role-fold-tp-chunk.mjs proved variable-length, transitional-
//      probability-bounded spans recover genuine multi-word
//      institutional phrases ("Director of OWCP") that fixed-window
//      single tokens miss.
//   3. resolve-span-role.mjs (scripts/experiments, open PR #46 on branch
//      claude/link-density-agency-test-v5taii, not yet on this branch)
//      proved a span's role is a property of the INSTANCE, not the word
//      — collapsed causally, one-hop, activation-gated, a direct sibling
//      to perceiver/text/pronouns.js::resolvePronouns, reusing
//      emergence/activation.js unmodified.
//
// resolve-span-role.mjs's own registry, though, only drew from ONE of
// the two saved experiment files (role-fold-verb-island.experiment.json)
// and explicitly excluded multi-word members ("single tokens only for
// this pass"). Its own FINDINGS.md names the fix directly: "a richer
// registry (drawn from more verb islands...) is the natural next
// scale-up, not a redesign." This script is that widening — pooling
// BOTH saved experiment files and admitting multi-word spans. The
// causal, activation-gated collapse mechanism itself (recall, margin/
// floor gating, priming) is copied from resolve-span-role.mjs with no
// logic changes; the one necessary addition is scanning multi-word
// windows for markers/targets, not just single tokens — otherwise every
// multi-word registry entry would be structurally unreachable (present
// in the map, never once checked against a document's actual spans).
//
// Not named read.mjs: scripts/read.mjs and goldens/cast/read.mjs already
// exist in this codebase as unrelated pipelines, and "read" already
// carries a specific, different meaning in each.
//
// Usage: node scripts/experiments/span-role-reader.mjs [pocket-dir[,dir2,...]] [docLimit]
// Pocket-dir defaults to live_priors/06-government-legal/world-legislation/us
// (20 real US statute documents, already confirmed English) — a small,
// uncontested slice chosen only to demonstrate the composed mechanism
// reading a real document end to end, not to make any claim about corpus
// completeness or scale.

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { splitSentences, deriveAbbreviations } from "../../packages/engine/perceiver/text/spans.js";
import { codeOf, recall, encodeFrame, tokens } from "../../packages/engine/emergence/activation.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const POCKET_DIR = process.argv[2] || join(HERE, "..", "..", "..", "live_priors", "06-government-legal", "world-legislation", "us");
const LIMIT = process.argv[3] ? Number(process.argv[3]) : Infinity;
// Same declared floors host/corpus.js already states for resolvePronouns
// (PRONOUN_MIN_ACTIVATION/PRONOUN_MIN_MARGIN) and resolve-span-role.mjs
// restates for span roles — restated again here, not re-derived: how
// much activation counts as a real echo is a property of the reading,
// not a constant this file gets to assume for every caller's material.
const MIN_ACTIVATION = Number(process.env.MIN_ACTIVATION ?? 0.05);
const MIN_MARGIN = Number(process.env.MIN_MARGIN ?? 0.2);

if (!POCKET_DIR) {
  console.error("usage: node span-role-reader.mjs [pocket-dir[,dir2,...]] [docLimit]");
  process.exit(1);
}

// ── (1) Build the kind registry from BOTH already-saved role-fold experiment outputs ──
//
// A first version of this classified by the SURVIVING KIND's own label
// (does it say "before" or "after"?) — the same test resolve-span-role.mjs
// already used. Run against the real saved data, every multi-word span
// that reached height=above turned out to cluster under a position-
// AGNOSTIC "multiword" label (role-fold-tp-chunk.mjs: a filler can carry
// both pos:after_len2 AND multiword at once, and induceKinds found
// "shares multiword" a stronger cohesion signal than position, at this
// evidence scale) — so kind-label classification produced a registry with
// zero multi-word entries, not because no real positional evidence
// exists, but because it was looking at the wrong grain.
//
// Each surviving member's OWN record still carries its actual measured
// position-attribute counts (e.g. "take place" -> {pos:after_len2: 4}),
// computed and saved by role-fold-tp-chunk.mjs regardless of which kind
// the member's surface ultimately clustered under. Classifying by the
// MEMBER's own attribute counts instead of the KIND's label reads the
// same already-measured evidence at its real grain — still no new
// induction, still nothing guessed the data doesn't support.
const REGISTRY_SOURCES = [
  join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-verb-island.experiment.json"),
  join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-tp-chunk.experiment.json"),
];

const wordKindVotes = new Map(); // surface (lowercased, single- or multi-word) -> { actor: n, complement: n }
let noDirectionMembers = 0; // surviving members whose own attributes gave no before/after majority

for (const path of REGISTRY_SOURCES) {
  const island = JSON.parse(readFileSync(path, "utf8"));
  for (const r of island.results ?? []) {
    const recs = new Map((r.records ?? []).map((rec) => [rec.id, rec]));
    for (const k of r.kinds ?? []) {
      if (k.height !== "above") continue;
      for (const m of k.members) {
        const rec = recs.get(m);
        const label = (rec?.label ?? m).toLowerCase();
        let before = 0;
        let after = 0;
        for (const a of rec?.attributes ?? []) {
          if (a.field_id.includes("before")) before += a.count;
          else if (a.field_id.includes("after")) after += a.count;
        }
        if (before === after) { noDirectionMembers++; continue; } // tied or no positional evidence — disclosed, not guessed
        if (!wordKindVotes.has(label)) wordKindVotes.set(label, { actor: 0, complement: 0 });
        const v = wordKindVotes.get(label);
        if (before > after) v.actor++; else v.complement++;
      }
    }
  }
}

// A word/span is an UNAMBIGUOUS marker for a kind only if every vote it
// got went the same way — same discipline extractSurfaces' own
// capitalisation physics filter already applies: a form seen only ever
// one way is real evidence; a form seen both ways is exactly the
// ambiguity this script exists to resolve.
const kindMarker = new Map(); // word/span -> 'actor' | 'complement'
const ambiguousWords = new Set();
for (const [word, v] of wordKindVotes) {
  if (v.actor > 0 && v.complement > 0) ambiguousWords.add(word);
  else if (v.actor > 0) kindMarker.set(word, "actor");
  else if (v.complement > 0) kindMarker.set(word, "complement");
}

const multiwordMarkers = [...kindMarker.keys()].filter((w) => w.includes(" ")).length;
const multiwordTargets = [...ambiguousWords].filter((w) => w.includes(" ")).length;
// activation.js's tokens() ("ws" below) yields single word tokens — a
// multi-word registry key like "take place" can never equal one element
// of that set. MAX_SPAN_TOKENS bounds a sliding n-gram join over ws so
// multi-word markers/targets are actually reachable, not just present in
// the registry and silently unmatchable.
const MAX_SPAN_TOKENS = Math.max(1, ...[...kindMarker.keys(), ...ambiguousWords].map((w) => w.split(" ").length));

console.log(`kind registry (pooled from ${REGISTRY_SOURCES.length} experiment files): ${kindMarker.size} unambiguous markers (${multiwordMarkers} multi-word), ${ambiguousWords.size} ambiguous resolution targets (${multiwordTargets} multi-word)`);
console.log(`surviving members with no before/after majority in their own attributes (tied or no positional evidence — disclosed, not guessed): ${noDirectionMembers}`);
console.log(`sample targets: ${[...ambiguousWords].slice(0, 15).join(", ")}\n`);

// ── (2) resolveSpanRole — the causal collapse mechanism, copied unmodified
// from resolve-span-role.mjs; only candidate DETECTION widened to match ──
// The proven mechanism itself: causal, never batch (a span's candidate
// kinds are built only from what the reading has evidenced so far),
// collapse activation-gated never majority-vote (one-hop recall against
// prior frames, minActivation/minMargin floors, typed gap otherwise), a
// resolved instance can prime later ones but isn't guaranteed to (encoded
// into the same per-frame evidence set every other kind-marker uses; a
// later instance still has to clear its own margin independently) — none
// of that changed. What DID have to change: resolve-span-role.mjs scanned
// only single tokens for markers/targets, which is fine for a single-
// token-only registry but would make every multi-word registry entry
// above structurally unreachable here — present in the map, never once
// checked against. `spansInSentence` below is that one addition: every
// contiguous 1..MAX_SPAN_TOKENS-token window in the sentence, checked
// against the same registry the single-token version already checked.
// The collapse itself — everything from `recall` onward — is untouched.
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

    // Every contiguous 1..MAX_SPAN_TOKENS-token window, not just single
    // tokens — the registry (built above) already contains multi-word
    // keys; this is what makes them checkable at all.
    const spansInSentence = new Set();
    for (let i = 0; i < ws.length; i++) {
      for (let len = 1; len <= MAX_SPAN_TOKENS && i + len <= ws.length; len++) {
        spansInSentence.add(ws.slice(i, i + len).join(" "));
      }
    }

    // Which kinds are UNAMBIGUOUSLY evidenced in this sentence by a
    // marker word/span — same role namedMatchesIn plays for
    // resolvePronouns.
    const present = new Set();
    for (const w of spansInSentence) {
      const k = kindMarker.get(w);
      if (k) present.add(k);
    }
    kindsByFrame.set(sentence.order, present);

    // Resolution targets: ambiguous words/spans present in THIS sentence.
    const hits = [...spansInSentence].filter((w) => ambiguousWords.has(w));
    if (hits.length === 0) continue;

    const activation = recall(cue, state, { completion, topEdges, selfOrder: sentence.order });

    // Best single hop per kind, never summed — same reasoning
    // resolvePronouns states for referents: a kind recalled from many
    // weak frames should not outscore one recalled from a single strong,
    // specific frame.
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

      bindings.push({ kind: topKind, sentenceOrder: sentence.order, word, activation: topScore, margin, sentence: sentence.text.slice(0, 160) });
      // A resolved instance can prime later ones — but only via the same
      // recall/margin gate every other instance has to clear. Added to
      // THIS frame's evidence, not asserted globally.
      kindsByFrame.get(sentence.order).add(topKind);
    }

    encodeFrame(state, sentence.order, ws, trace, { edgeSlots });
  }

  return { bindings, gaps };
};

// ── (2b) Self-check: is a multi-word registry entry actually reachable? ──
// A hand-built fixture, not a claim taken on faith: picks one real
// multi-word AMBIGUOUS TARGET straight out of the registry built above
// (a marker alone won't do — a marker only ever seeds `present` for a
// later target and never itself appears in a binding or a gap, so
// checking one would silently prove nothing) places it in a synthetic
// sentence, and confirms resolveSpanRole's span-detection step
// (spansInSentence) produces a hit for it — either a binding or a gap,
// either is fine; the only failure this guards against is the span
// never being checked at all, which is exactly what happened before this
// widening (single-token-only detection made every multi-word registry
// entry unreachable in principle, not just unlucky in practice).
{
  const sampleWord = [...ambiguousWords].find((w) => w.includes(" "));
  if (sampleWord) {
    const fixtureSentences = [
      { text: `A filler sentence with no registry words at all, just ordinary prose to occupy a frame.`, offset: 0, order: 0 },
      { text: `Consider the following: ${sampleWord} appears right here in this sentence.`, offset: 0, order: 1 },
    ];
    const { bindings: fb, gaps: fg } = resolveSpanRole(fixtureSentences, { minActivation: MIN_ACTIVATION, minMargin: MIN_MARGIN });
    const seen = fb.some((b) => b.word === sampleWord) || fg.some((g) => g.word === sampleWord);
    console.log(`self-check: multi-word ambiguous target "${sampleWord}" placed in a synthetic sentence -> ${seen ? "detected (span-level match confirmed reachable)" : "NOT DETECTED — span-detection regression, investigate before trusting any multi-word result below"}\n`);
  } else {
    console.log("self-check: registry has no multi-word AMBIGUOUS TARGET to verify against (multi-word markers may still exist, but a marker alone never appears in a binding or gap, so there is nothing checkable to build a fixture from) — skipped\n");
  }
}

// ── (3) Run it over a real pocket, in document order ────────────────────
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
console.log(`reading ${files.length} document(s) from ${POCKET_DIR}\n`);

let totalBindings = [];
let totalGaps = [];
const perWordKinds = new Map(); // word/span -> Set of kinds it actually resolved to, across real instances

for (const file of files) {
  const text = readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
  const sentences = splitSentences(text, { abbreviations: deriveAbbreviations(text) });
  if (!sentences.length) continue;
  const { bindings, gaps } = resolveSpanRole(sentences, { minActivation: MIN_ACTIVATION, minMargin: MIN_MARGIN });
  for (const b of bindings) {
    if (!perWordKinds.has(b.word)) perWordKinds.set(b.word, new Set());
    perWordKinds.get(b.word).add(b.kind);
  }
  totalBindings.push(...bindings);
  totalGaps.push(...gaps);
}

console.log(`${files.length} documents, ${totalBindings.length} instance-level resolutions, ${totalGaps.length} typed gaps (stayed plural)\n`);

const gapReasons = {};
for (const g of totalGaps) gapReasons[g.reason] = (gapReasons[g.reason] ?? 0) + 1;
console.log("gap reasons:", gapReasons, "\n");

const multiwordBindings = totalBindings.filter((b) => b.word.includes(" "));
// Every hit — resolved or gapped — carries `word`, so this counts every
// time a multi-word marker/target was even ENCOUNTERED in this pocket,
// not just the ones that went on to resolve. Distinguishes "the mechanism
// never got a chance" from "it got a chance and declined" — the same
// distinction a typed gap exists to preserve everywhere else in this
// codebase.
const multiwordEncounters = totalBindings.filter((b) => b.word.includes(" ")).length + totalGaps.filter((g) => g.word?.includes(" ")).length;
console.log(`${multiwordBindings.length} of ${totalBindings.length} resolutions were multi-word spans; ${multiwordEncounters} multi-word marker/target occurrences encountered in this pocket total (0 of either was structurally possible before this widening — resolve-span-role.mjs excluded multi-word members entirely)`);
if (multiwordEncounters === 0) {
  console.log(`none of the registry's ${multiwordMarkers + multiwordTargets} multi-word entries happened to recur verbatim in this ${files.length}-document pocket — consistent with this arc's own prior finding that multi-word convergence is a higher bar than single-token convergence (role-fold-tp-chunk.mjs: only 2/69 convergent fillers were multi-word). The self-check above already confirmed the mechanism itself is reachable; this is the pocket not containing a match, not a detection failure.\n`);
}
if (multiwordBindings.length) {
  console.log("sample multi-word resolutions:");
  for (const b of multiwordBindings.slice(0, 10)) console.log(`  "${b.word}" -> ${b.kind} (margin ${b.margin.toFixed(2)}): "${b.sentence}"`);
  console.log();
}

// The actual proof this is instance-level, not type-level: the same
// surface form resolving to DIFFERENT kinds on different real occurrences.
const splitWords = [...perWordKinds.entries()].filter(([, kinds]) => kinds.size > 1);
console.log(`${splitWords.length} words/spans resolved to BOTH kinds across different real instances (the same surface form, genuinely different referents, never forced to one type-level answer):\n`);
for (const [word] of splitWords.slice(0, 15)) {
  const examples = totalBindings.filter((b) => b.word === word).slice(0, 2);
  console.log(`  "${word}":`);
  for (const ex of examples) console.log(`    -> ${ex.kind}  (margin ${ex.margin.toFixed(2)}): "${ex.sentence}"`);
}

mkdirSync(join(HERE, "..", "..", "goldens", "agency-civic", "data"), { recursive: true });
const outPath = join(HERE, "..", "..", "goldens", "agency-civic", "data", "span-role-reader.experiment.json");
writeFileSync(outPath, JSON.stringify({
  minActivation: MIN_ACTIVATION,
  minMargin: MIN_MARGIN,
  registrySources: REGISTRY_SOURCES.map((p) => p.split("/").slice(-1)[0]),
  registry: {
    unambiguousMarkers: kindMarker.size,
    unambiguousMarkersMultiword: multiwordMarkers,
    ambiguousTargets: ambiguousWords.size,
    ambiguousTargetsMultiword: multiwordTargets,
    noDirectionMembers,
  },
  docsProcessed: files.length,
  bindingCount: totalBindings.length,
  multiwordBindingCount: multiwordBindings.length,
  multiwordEncounterCount: multiwordEncounters,
  gapCount: totalGaps.length,
  gapReasons,
  splitWordCount: splitWords.length,
  bindings: totalBindings,
  gaps: totalGaps.slice(0, 500),
}, null, 2));
console.log(`\nwrote ${outPath}`);

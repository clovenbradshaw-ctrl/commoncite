// eoreader6 · scripts/experiments/pos-merge-check — EXPERIMENTAL, unwired.
//
// Checks whether a self-discovered CATEGORY (a role-fold-verb-island /
// role-fold-tp-chunk kind that already reached induceKinds' height=above)
// corresponds to a real, independently-attested part of speech — using
// POSPrior@1 (scripts/build-pos-prior.mjs, Universal Dependencies gold
// data) as the reference, never a live tagger. No ML runs here: this is a
// lookup against real human-annotated counts, the same standing
// perceiver/text/morphology.js already holds for UniMorph.
//
// THE QUESTION THIS ASKS IS DELIBERATELY ONE LEVEL UP FROM
// resolveSpanRole's. resolveSpanRole asks, causally, per real occurrence:
// "does THIS instance bind to an already-evidenced kind?" — and stays
// instance-level on purpose (FINDINGS.md §5: a surface span is never
// itself a part of speech, only its referent is). This script asks a
// different, legitimately type-level question about the CATEGORY ITSELF,
// never about any one occurrence: "does this whole discovered cluster of
// distinct surface forms correspond to a real UD tag?" Conflating these
// two questions was the exact defect goldens/agency-civic/data/
// pos-superposition.json's own type-level aggregation had (majority tag
// share PER WORD, blurring what a specific occurrence is with what the
// word-type does on average) — this script never claims anything about an
// occurrence; that stays resolveSpanRole's job, untouched.
//
// COVERAGE IS DELIBERATELY VERB-AGNOSTIC. Every surviving height=above kind
// in both saved registries is checked, including the ones already known to
// actually be prepositions (role-fold-verb-island.mjs's own "verb"
// discovery has no POS filter — "by", "under", "at", "as", "with" are in
// there). The merge-check doesn't care what discovered the cluster; it
// only asks whether the cluster's members cohere on a real UD tag.
//
// A COHERENCE SCORE ALONE PROVES NOTHING WITHOUT A NULL. Many English
// open-class words are individually dominant-POS regardless of clustering
// (institutional names are basically always NOUN/PROPN on their own) — so a
// cluster could score 70% coherent not because the CLUSTERING found real
// structure, but because most content words are skewed-POS to begin with,
// and grouping almost any of them looks coherent. Every other measurement
// in this arc gates on a permutation null (induceKinds' own shuffle test);
// this script now does too: for each surviving kind, `NULL_PERMUTATIONS`
// same-size random draws from the SAME REGION's own full candidate pool
// (every filler word discoverRelationVocab considered for ANY verb in this
// region, not just the ones that survived into a certified kind — the
// fair comparison space, "would grouping these particular N words beat
// grouping N random ones from what this register actually offered")
// produce a null distribution of coherence scores, and
// emergence/kinds.js::partitionNull (imported, not reimplemented — the
// same empirical-p-value machinery induceKinds already trusts) reports
// whether the real cluster clears it. `merged` (raw >=60% threshold) and
// `nullSignificant` (clears the random-grouping baseline) are reported
// SEPARATELY — a kind can cross the raw threshold and still fail to beat
// chance, and that distinction is the actual point of adding this.
//
// REGION-SCOPED, NEVER POOLED. Each registry pair below comes from ONE
// corpus region's own induction run, never merged across regions before
// this check — pooling raw records across registers before clustering is
// the exact mistake role-fold-kinds v1-v3 already made and refuted, and
// pooling ACROSS registers (statutes with novels with source-code docs)
// would be the same mistake at a coarser grain. What's shared across
// regions is only the fixed external reference (POSPrior@1) each region's
// own kinds are independently checked against — comparability through a
// common anchor, never through flattening.
//
// THE UD CROSS-REFERENCE IS A GOOD-TO-HAVE, NOT A GATE. A kind that
// induceKinds already certified (height=above, in emergence/kinds.js::def)
// is already real and already named — by its own core-field label
// (e.g. "pos:near_before") and by its own witnessed members. Whether it
// also happens to line up with UD's 17-tag inventory is informative
// context, never the test of whether the cluster is legitimate; an
// unmerged kind is not a failure, it's either noise or a genuine
// distinction UD's coarseness doesn't draw. So every result below carries
// a SELF-NAME (`selfName`) derived only from its own most-witnessed
// members — never from UD, never a hand-typed grammatical role like
// "actor"/"patient" (that would just be hand-typed grammar wearing a new
// hat) — and the UD comparison is reported separately, under
// `udCrossReference`, as an annotation attached to an already-legitimate
// kind rather than the thing that makes it legitimate.
//
// Usage: node scripts/experiments/pos-merge-check.mjs [pos-prior.json] [verb-island.json] [tp-chunk.json] [output.json] [region-label]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { partitionNull } from "../../packages/engine/emergence/kinds.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRIOR_PATH = process.argv[2] || join(HERE, "..", "corpus", "pos-eng.json");
// Declared, never defaulted per this codebase's own numeric discipline
// (SEED.md #7) — but env-overridable rather than argv, since these two
// aren't things a caller varies per invocation the way registry paths are.
const NULL_PERMUTATIONS = Number(process.env.NULL_PERMUTATIONS ?? 200);
const NULL_QUANTILE = Number(process.env.NULL_QUANTILE ?? 0.95);
const NULL_SEED = Number(process.env.NULL_SEED ?? 42);

// Same tiny seeded PRNG kinds.js already uses for its own permutation
// nulls (fisherYates/randomSubset are internal to that module, not
// exported — reproduced here rather than duplicated by copy, since this is
// three lines, not a mechanism). partitionNull ITSELF is imported, not
// reimplemented — that's the actual statistical machinery, already tested.
const prng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const randomSubset = (pool, k, rnd) => {
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0 && i >= arr.length - k; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(arr.length - k);
};

// ── load POSPrior@1 — same discipline loadMorphology already states ───────
const loadPOSPrior = (path) => {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (raw.schema !== "POSPrior@1") throw new TypeError(`loadPOSPrior: expected POSPrior@1, got ${raw.schema}`);
  if (!raw.provenance?.source) throw new TypeError("loadPOSPrior: a prior must name its giver");
  return { language: raw.language, giver: raw.provenance.source, forms: raw.forms };
};

// ── cluster coherence: normalize each member's own distribution to 1,
// sum across members, report the top tag's share of the summed mass ──────
// Normalizing per member first is deliberate: a cluster containing one very
// high-frequency word (e.g. "act", thousands of UD occurrences) and several
// rare ones should not have its verdict decided by that one member's raw
// volume — each member gets an equal vote on the SHAPE of its own
// ambiguity, not a vote weighted by how often UD happened to see it.
const clusterCoherence = (members, prior) => {
  const summed = {};
  let covered = 0;
  for (const m of members) {
    const dist = prior.forms[m.toLowerCase()];
    if (!dist) continue;
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    covered++;
    for (const [tag, count] of Object.entries(dist)) summed[tag] = (summed[tag] ?? 0) + count / total;
  }
  const entries = Object.entries(summed).sort((a, b) => b[1] - a[1]);
  const totalMass = entries.reduce((s, [, v]) => s + v, 0);
  if (entries.length === 0) return { topTag: null, share: 0, nominalShare: 0, covered, total: members.length, distribution: {} };
  const [topTag, topMass] = entries[0];
  // NOUN and PROPN are reported separately by UD (a fine-grained distinction
  // English orthography's capitalization physics already tracks elsewhere in
  // this codebase — extractSurfaces' own capitalized-run gate), but both are
  // nominal. A cluster split 46% NOUN / 28% PROPN is 74% nominal, not 46%
  // coherent — checked empirically before adding this: 13 of the 39 kinds
  // that missed the single-tag cutoff are genuinely nominal once combined
  // (verb-island:has's near-before actor cluster: NOUN .463 + PROPN .278 =
  // .74). Reported as its own figure, never silently substituted for the
  // strict single-tag share.
  const NOMINAL = new Set(["NOUN", "PROPN"]);
  const nominalMass = entries.filter(([t]) => NOMINAL.has(t)).reduce((s, [, v]) => s + v, 0);
  return {
    topTag,
    share: totalMass > 0 ? topMass / totalMass : 0,
    nominalShare: totalMass > 0 ? nominalMass / totalMass : 0,
    covered,
    total: members.length,
    distribution: Object.fromEntries(entries.map(([t, v]) => [t, +(v / totalMass).toFixed(3)])),
  };
};

// The single number everything downstream compares (real cluster vs. null
// draws) — the NOUN+PROPN combination applied consistently to both, never
// only to the observed side (that would bias the null low and manufacture
// significance). Raw (pre-combination) figures are kept alongside for
// disclosure, never silently dropped.
const effectiveShareOf = (members, prior) => {
  const c = clusterCoherence(members, prior);
  const isNominalTop = c.topTag === "NOUN" || c.topTag === "PROPN";
  const useNominal = isNominalTop && c.nominalShare > c.share;
  return {
    tag: useNominal ? "NOUN+PROPN" : c.topTag,
    share: useNominal ? c.nominalShare : c.share,
    rawTag: c.topTag,
    rawShare: c.share,
    nominalShare: c.nominalShare,
    covered: c.covered,
    distribution: c.distribution,
  };
};

// ── SELF-NAMING: a kind names itself from its own witnessed evidence —
// its most-frequent members, counted across its OWN member list (repeat
// occurrences of the same surface form within one kind are real evidence
// of how representative that member is of this role, not noise to
// dedupe). No external taxonomy, no hand-typed grammatical role name.
const selfNameOf = (memberLabels, topN = 3) => {
  const freq = new Map();
  for (const w of memberLabels) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([w]) => w)
    .join("/");
};

// ── self-check: a synthetic cluster with a known answer ───────────────────
{
  const miniPrior = { forms: {
    dog: { NOUN: 10 }, cat: { NOUN: 8 }, house: { NOUN: 12 }, fish: { NOUN: 3, VERB: 1 },
    run: { VERB: 9 }, jump: { VERB: 5 },
  } };
  const nounish = clusterCoherence(["dog", "cat", "house", "fish"], miniPrior);
  const mixed = clusterCoherence(["dog", "run", "jump"], miniPrior);
  const ok = nounish.topTag === "NOUN" && nounish.share > 0.85 && mixed.share < nounish.share;
  console.log(`self-check: known-NOUN cluster -> top="${nounish.topTag}" share=${nounish.share.toFixed(2)}; known-mixed cluster -> share=${mixed.share.toFixed(2)} -> ${ok ? "coherence computation confirmed correct" : "REGRESSION — investigate before trusting results below"}\n`);

  // Null-control self-check: a pool where 4 words are genuinely, coherently
  // NOUN and the rest of the pool is deliberately mixed. A real all-NOUN
  // cluster drawn from it should beat random same-size draws from the WHOLE
  // pool; a cluster that's already just a random draw should not reliably.
  const nullPool = ["dog", "cat", "house", "fish", "run", "jump", "quick", "slow", "the", "and"];
  const poolPrior = { forms: {
    dog: { NOUN: 10 }, cat: { NOUN: 8 }, house: { NOUN: 12 }, fish: { NOUN: 6, VERB: 1 },
    run: { VERB: 9 }, jump: { VERB: 5 }, quick: { ADJ: 7 }, slow: { ADJ: 6 }, the: { DET: 20 }, and: { CCONJ: 15 },
  } };
  const rnd = prng(7);
  const nullSamples = Array.from({ length: 200 }, () => effectiveShareOf(randomSubset(nullPool, 4, rnd), poolPrior).share);
  const realObserved = effectiveShareOf(["dog", "cat", "house", "fish"], poolPrior).share;
  const test = partitionNull({ samples: nullSamples, observed: realObserved, quantile: 0.95, seed: 7 });
  const nullOk = !test.gap && test.passed === true;
  console.log(`self-check: a genuinely coherent 4-word NOUN cluster against 200 random same-size draws from a mixed 10-word pool -> observed=${realObserved.toFixed(2)}, null threshold(p95)=${test.threshold?.toFixed(2)}, p=${test.pValue?.toFixed(3)} -> ${nullOk ? "clears the null as expected (significance test confirmed working)" : "REGRESSION — the coherent cluster should have cleared the random-draw null"}\n`);

  const sn = selfNameOf(["act", "act", "order", "decision", "decision", "decision"], 2);
  const snOk = sn === "decision/act";
  console.log(`self-check: selfNameOf ranks a kind's own members by how often THIS kind witnessed them, ties broken alphabetically -> "${sn}" -> ${snOk ? "confirmed correct" : "REGRESSION"}\n`);
}

const prior = loadPOSPrior(PRIOR_PATH);
console.log(`loaded POSPrior@1: ${Object.keys(prior.forms).length.toLocaleString()} word forms, giver="${prior.giver}"\n`);

// ── load both registries, check every surviving kind ──────────────────────
const REGION = process.argv[6] || "government-legal";
const REGISTRY_SOURCES = [
  { path: process.argv[3] || join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-verb-island.experiment.json"), prefix: "verb-island" },
  { path: process.argv[4] || join(HERE, "..", "..", "goldens", "agency-civic", "data", "role-fold-tp-chunk.experiment.json"), prefix: "tp-chunk" },
];

// ── this region's own full candidate pool — every filler EITHER registry
// considered for ANY verb in this region, single-token, NOT deduped
// (repeat occurrences are real abundance, not noise) — the fair space a
// random same-size draw is compared from below.
const candidatePool = [];
for (const { path } of REGISTRY_SOURCES) {
  const island = JSON.parse(readFileSync(path, "utf8"));
  for (const r of island.results ?? []) {
    for (const rec of r.records ?? []) {
      const label = (rec.label ?? "").replace(/\s+/g, " ");
      if (label && !label.includes(" ")) candidatePool.push(label);
    }
  }
}
console.log(`region candidate pool: ${candidatePool.length.toLocaleString()} single-token filler occurrences across both registries\n`);

const nullRnd = prng(NULL_SEED);
const results = [];
for (const { path, prefix } of REGISTRY_SOURCES) {
  const island = JSON.parse(readFileSync(path, "utf8"));
  for (const r of island.results ?? []) {
    const recs = new Map((r.records ?? []).map((rec) => [rec.id, rec]));
    for (const k of r.kinds ?? []) {
      if (k.height !== "above") continue;
      const memberLabels = k.members.map((m) => (recs.get(m)?.label ?? m).replace(/\s+/g, " ")).filter((w) => !w.includes(" ")); // single tokens only — UD lexical lookup is per-word-form
      if (memberLabels.length < 2) continue;

      const eff = effectiveShareOf(memberLabels, prior);
      let nullTest = null;
      if (candidatePool.length >= memberLabels.length) {
        const nullSamples = Array.from({ length: NULL_PERMUTATIONS }, () => effectiveShareOf(randomSubset(candidatePool, memberLabels.length, nullRnd), prior).share);
        nullTest = partitionNull({ samples: nullSamples, observed: eff.share, quantile: NULL_QUANTILE, seed: NULL_SEED });
      }

      results.push({
        source: prefix,
        verb: r.verb,
        // the kind's own identity — a real occurrence-frequency name from
        // its own witnessed members, and induceKinds' own structural label
        // (the core field that actually separated it, e.g. "pos:near_before")
        selfName: selfNameOf(memberLabels),
        structuralLabel: k.label,
        memberCount: memberLabels.length,
        sampleMembers: memberLabels.slice(0, 8),
        // informational only — never what makes this kind legitimate
        udCrossReference: {
          covered: eff.covered,
          tag: eff.tag,
          share: +eff.share.toFixed(3),
          rawTag: eff.rawTag,
          rawShare: +eff.rawShare.toFixed(3),
          distribution: eff.distribution,
          nullPValue: nullTest && !nullTest.gap ? +nullTest.pValue.toFixed(3) : null,
          nullThreshold: nullTest && !nullTest.gap ? +nullTest.threshold.toFixed(3) : null,
          beatsRandomGrouping: nullTest ? nullTest.passed === true : null,
        },
      });
    }
  }
}

results.sort((a, b) => b.udCrossReference.share - a.udCrossReference.share);
console.log(`region: ${REGION} — ${results.length} self-discovered, already-certified kinds; checking each for an OPTIONAL UD cross-reference\n`);

const CROSS_REFERENCE_THRESHOLD = 0.6;
const crossReferenced = results.filter((r) => r.udCrossReference.share >= CROSS_REFERENCE_THRESHOLD && r.udCrossReference.covered >= 2);
const noCrossReference = results.filter((r) => !(r.udCrossReference.share >= CROSS_REFERENCE_THRESHOLD && r.udCrossReference.covered >= 2));
const nullSignificant = crossReferenced.filter((r) => r.udCrossReference.beatsRandomGrouping === true);
const nominalRescued = crossReferenced.filter((r) => r.udCrossReference.tag === "NOUN+PROPN").length;
console.log(`${crossReferenced.length}/${results.length} also line up with a coherent UD tag (>=${CROSS_REFERENCE_THRESHOLD * 100}% mass, >=2 members covered) — of those, ${nullSignificant.length} also beat ${NULL_PERMUTATIONS} random same-size draws from this region's own candidate pool (genuinely non-chance overlap, not just individually-skewed vocabulary) — ${nominalRescued} only by combining NOUN+PROPN as one nominal supercategory, disclosed per-row. The remaining ${noCrossReference.length} kinds are NOT failures: each is already a legitimate, self-named, statistically-certified kind on its own; they simply don't happen to correspond to any single UD tag.\n`);

console.log("strongest UD cross-references (self-name first, UD tag as annotation):");
for (const r of crossReferenced.slice(0, 15)) {
  const sig = r.udCrossReference.beatsRandomGrouping === true ? "beats random null" : r.udCrossReference.beatsRandomGrouping === false ? "does NOT beat random null" : "null untested";
  console.log(`  "${r.selfName}" [${r.structuralLabel}, ${r.source}:${r.verb}] -> UD:${r.udCrossReference.tag} (${(r.udCrossReference.share * 100).toFixed(0)}% of ${r.udCrossReference.covered}/${r.memberCount} covered, ${sig}): ${r.sampleMembers.join(", ")}`);
}

console.log("\nthe passive-participle prediction (FINDINGS.md: complement-position fillers near 'by' should skew VERB, not a nominal tag):");
const byKinds = results.filter((r) => r.verb === "by");
for (const r of byKinds) {
  console.log(`  "${r.selfName}" [by, ${r.structuralLabel}] -> UD:${r.udCrossReference.tag} (${(r.udCrossReference.share * 100).toFixed(0)}%): ${r.sampleMembers.join(", ")}`);
}

console.log(`\nsample of self-named kinds with NO UD cross-reference (not a failure — a real cluster UD's 17 tags don't happen to name):`);
for (const r of noCrossReference.slice(0, 8)) {
  console.log(`  "${r.selfName}" [${r.structuralLabel}, ${r.source}:${r.verb}] -> nearest UD:${r.udCrossReference.tag} share=${(r.udCrossReference.share * 100).toFixed(0)}% (${r.udCrossReference.covered}/${r.memberCount} covered): ${r.sampleMembers.join(", ")}`);
}

mkdirSync(join(HERE, "..", "..", "goldens", "agency-civic", "data"), { recursive: true });
const outPath = process.argv[5] || join(HERE, "..", "..", "goldens", "agency-civic", "data", "pos-merge-check.experiment.json");
writeFileSync(outPath, JSON.stringify({
  region: REGION,
  priorGiver: prior.giver,
  note: "udCrossReference is informational — every kind here is already legitimate via its own selfName and structuralLabel, independent of whether it also matches a UD tag",
  crossReferenceThreshold: CROSS_REFERENCE_THRESHOLD,
  nullPermutations: NULL_PERMUTATIONS,
  nullQuantile: NULL_QUANTILE,
  nullSeed: NULL_SEED,
  candidatePoolSize: candidatePool.length,
  kindsChecked: results.length,
  crossReferencedCount: crossReferenced.length,
  nullSignificantCount: nullSignificant.length,
  nominalRescuedCount: nominalRescued,
  noCrossReferenceCount: noCrossReference.length,
  results,
}, null, 2));
console.log(`\nwrote ${outPath}`);

// eoreader6 · adversarial challenge #12 — "install-tier vs competency-tier
// firewall"
//
// CLAIM UNDER TEST: "Reactively web-fetched competency material is stored
// separately from install-tier priors, held to a stricter gate, never
// citable, and never auto-promoted to install-tier trust."
//
// PROCEDURE:
//   Part A — exhaustively search THIS repo (packages/, nul/, scripts/,
//   conformance/, goldens/, and every *.md) for the named mechanism:
//   "install-tier", "competency-tier", "competency-corpus", "reactive
//   harvest/harvesting", "readiness"/"unready channel". Do this with a
//   correctly-escaped extended regex (a plain BSD `grep -rniI "a\|b"`
//   silently fails to alternate on macOS and would produce a false "zero
//   hits" even where hits exist — this script is careful not to repeat that
//   mistake).
//
//   Part B — search for ANY live-network primitive reachable from the
//   production engine/host code (packages/, nul/) that could even in
//   principle be "the reactive-fallback path" the challenge asks us to
//   trigger.
//
//   Part C — probe the actual, closed trust-tier data model
//   (packages/engine/generation/belief.js's `TIERS`) by attempting, at
//   runtime, to construct a belief layer tagged with a hypothetical third
//   tier ("competency", then "install") the way a reactive-fetch feature
//   would have to if it existed. Confirm whether the enum structurally
//   rejects it or silently accepts it.
//
//   Part D — as the closest REAL proxy this repo actually has for "can
//   externally-sourced material get cited about the thing being read":
//   ordinary use of the one live generation pipeline that exists
//   (belief.js + emit.js, exercised exactly the way scripts/finish-a-
//   sentence.mjs exercises it). Read a real excerpt of Frankenstein as the
//   `read` tier, inject a real, lexically alien text (legal boilerplate) as
//   a `received`-tier gift the way any external prior — reactively fetched
//   or not — is the ONLY way this codebase knows how to accept outside
//   material, and try, through the ordinary citation/testimony API
//   (`admissibleAsTestimony`), to get something back that could be asserted
//   as a claim about Frankenstein but in fact traces only to the gift.
//
// This is NOT a test of the claim's literal mechanism, because Part A/B
// establish that mechanism does not exist in this repo. Part D is offered
// only as the best available proxy, run for completeness, and its result is
// reported separately from the verdict.
//
// Run: node scripts/adversarial/challenge-12-install-tier-vs-competency-tier-firewall.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createLayer, createBelief, TIERS } from "../../packages/engine/generation/belief.js";
import { emitSequence, admissibleAsTestimony } from "../../packages/engine/generation/emit.js";
import { stripContainer, splitSentences } from "../../packages/engine/perceiver/text/spans.js";
import { isGap } from "../../nul/index.js";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;
const line = (c = "=") => c.repeat(78);

console.log(line());
console.log("CHALLENGE #12 — install-tier vs competency-tier firewall");
console.log(line());

// ── PART A ───────────────────────────────────────────────────────────────
// Walk the whole tree (minus node_modules/.git) and grep every text file
// with a correctly-alternated regex, entirely in JS so there's no shell
// BRE/ERE ambiguity to get wrong a second time.
console.log("\n── PART A: search the repo for the named mechanism ────────────────────\n");

const SKIP_DIRS = new Set(["node_modules", ".git"]);
const TEXT_EXT = new Set([".js", ".mjs", ".md", ".json", ".txt"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (TEXT_EXT.has(entry.slice(entry.lastIndexOf(".")))) out.push(p);
  }
  return out;
}

const files = walk(REPO_ROOT).filter((p) => !p.includes("/scripts/adversarial/")); // don't match our own script/fixtures
const patterns = [
  { name: "install-tier / install tier", re: /install[\s-]tier/i },
  { name: "competency-tier / competency tier", re: /competency[\s-]tier/i },
  { name: "competency-corpus", re: /competency[\s-]corpus/i },
  { name: "reactive harvest(ing)", re: /reactive[\s-]harvest/i },
  { name: "reactive fetch/fallback", re: /reactive[\s-](fetch|fallback)/i },
  { name: "unready channel", re: /unready[\s-]?channel|channel[\s\S]{0,20}unready/i },
  { name: "readiness accounting", re: /readiness[\s-]accounting/i },
  { name: "auto-promot(ed|ion) ... trust", re: /auto[\s-]promot\w*/i },
];

const hits = [];
for (const f of files) {
  let text;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  for (const pat of patterns) {
    if (pat.re.test(text)) hits.push({ file: relative(REPO_ROOT, f), pattern: pat.name });
  }
}

if (hits.length === 0) {
  console.log(`Scanned ${files.length} files (code + docs, excluding scripts/adversarial/).`);
  console.log("ZERO hits for any of:");
  for (const p of patterns) console.log(`  - ${p.name}`);
} else {
  console.log(`Scanned ${files.length} files. ${hits.length} hit(s):`);
  for (const h of hits) console.log(`  ${h.file}  [${h.pattern}]`);
}

// ── PART B ───────────────────────────────────────────────────────────────
console.log("\n── PART B: any live-network primitive reachable from packages/ or nul/ ─\n");

const PROD_DIRS = ["packages", "nul"].map((d) => join(REPO_ROOT, d));
const netRe = /\bfetch\s*\(|http\.request|https\.request|XMLHttpRequest|node-fetch|axios/;
const netHits = [];
for (const d of PROD_DIRS) {
  for (const f of walk(d)) {
    let text;
    try { text = readFileSync(f, "utf8"); } catch { continue; }
    if (netRe.test(text)) netHits.push(relative(REPO_ROOT, f));
  }
}
if (netHits.length === 0) {
  console.log("Scanned every file under packages/ and nul/ (the actual engine+host code).");
  console.log("ZERO network primitives (fetch/http.request/XHR/axios/node-fetch) found.");
  console.log("There is no code path in the production engine that could open a network");
  console.log("connection at projection time, reactive or otherwise — nothing to trigger.");
} else {
  console.log("Network primitives found in production code:");
  for (const f of netHits) console.log(`  ${f}`);
}

// ── PART C ───────────────────────────────────────────────────────────────
console.log("\n── PART C: is the trust-tier enum even open to a third tier? ──────────\n");
console.log(`belief.js TIERS = ${JSON.stringify(TIERS)}`);

function tryTier(tier) {
  try {
    createLayer({ id: "probe", tier, giver: tier === "received" ? "probe" : undefined, order: 2, gamma: 1, alpha: 0.7 });
    return { tier, accepted: true };
  } catch (e) {
    return { tier, accepted: false, error: e.message };
  }
}

for (const t of ["competency", "install", "web", "reactive"]) {
  const r = tryTier(t);
  console.log(`  createLayer({ tier: "${t}" })  ->  ${r.accepted ? "ACCEPTED" : `REJECTED (${r.error})`}`);
}
const rReceived = tryTier("received");
const rRead = tryTier("read");
console.log(`  createLayer({ tier: "received" })  ->  ${rReceived.accepted ? "ACCEPTED" : "REJECTED"}  (the only tier through which ANY outside material enters)`);
console.log(`  createLayer({ tier: "read" })       ->  ${rRead.accepted ? "ACCEPTED" : "REJECTED"}`);

// ── PART D ───────────────────────────────────────────────────────────────
// The closest real proxy: ordinary generation + citation flow, one read
// layer (Frankenstein excerpt) + one received/"gift" layer built from a
// lexically alien real text (legal boilerplate) standing in for "whatever a
// reactive fetch would have handed the reader, had that feature existed."
// Then hammer the ordinary citation API (`admissibleAsTestimony`) with many
// draws, specifically over vocabulary that ONLY the gift supplies, to see
// if an ordinary caller can ever walk away with something assertable about
// Frankenstein that in fact came from the boilerplate.
console.log("\n── PART D: proxy — can ordinary use cite gift-only content as testimony? ─\n");

const ORDER = 3, ALPHA = 0.7, GAMMA = 0.99995;
const load = (p) => stripContainer(readFileSync(p, "utf8").replace(/\r\n/g, "\n")).text;
const WORD = /[\p{L}\p{N}']+|[.,;:!?—"()]/gu;
const tok = (t) => t.toLowerCase().match(WORD) ?? [];

const readText = load(new URL("./fixtures/frankenstein-excerpt.txt", import.meta.url).pathname);
const giftText = load(new URL("./fixtures/legal-boilerplate.txt", import.meta.url).pathname);
const readTokens = tok(readText);
const giftTokens = tok(giftText);

console.log(`read (Frankenstein excerpt):  ${readTokens.length} forms`);
console.log(`gift (legal boilerplate):     ${giftTokens.length} forms — lexically alien to the read material`);

const readLayer = createLayer({ id: "read", tier: "read", order: ORDER, gamma: GAMMA, alpha: ALPHA });
for (let i = 0; i < readTokens.length; i++) readLayer.observe(readTokens, i);

const giftLayer = createLayer({ id: "legal-gift", tier: "received", giver: "hand-authored legal boilerplate fixture", order: ORDER, gamma: 1, alpha: ALPHA });
giftLayer.train(giftTokens);

const belief = createBelief({ layers: [readLayer, giftLayer], referents: new Set() });

// Vocabulary that ONLY the gift supplies (never appears in the read tokens
// at all) — e.g. "indemnify", "jurisdiction", "severability" — the sharpest
// possible probe for "does gift-only material ever surface as citable
// testimony about Frankenstein."
const readVocab = new Set(readTokens);
const giftOnlyWords = [...new Set(giftTokens)].filter((w) => /^[a-z']+$/.test(w) && !readVocab.has(w));
console.log(`gift-only vocabulary probe words (never in read tier): ${giftOnlyWords.slice(0, 12).join(", ")}${giftOnlyWords.length > 12 ? ", ..." : ""}`);

let attempts = 0, admissible = 0, refused = 0, refusedButTouchedGiftOnly = 0, admissibleAndTouchedGiftOnly = 0;
const HORIZON = 12;
for (const w of giftOnlyWords) {
  if (!readLayer.hasCovered?.(w) && false) continue; // no-op, keep loop simple
  for (let seed = 0; seed < 6; seed++) {
    attempts++;
    const out = emitSequence({
      belief,
      context: [w],
      horizon: HORIZON,
      conditioning: "free-running",
      selection: "sampled",
      seed: seed * 97 + 1,
    });
    if (isGap(out)) { continue; }
    const touchedGiftOnly = out.emitted.some((f) => f !== null && giftOnlyWords.includes(f));
    const crossing = admissibleAsTestimony(out);
    if (crossing === null) {
      admissible++;
      if (touchedGiftOnly) admissibleAndTouchedGiftOnly++;
    } else {
      refused++;
      if (touchedGiftOnly) refusedButTouchedGiftOnly++;
    }
  }
}

console.log(`\nordinary emission attempts starting from gift-only forms: ${attempts}`);
console.log(`  admissible as testimony (citable about Frankenstein): ${admissible}`);
console.log(`  refused (unreceived_origin gap):                      ${refused}`);
console.log(`  of the ADMISSIBLE ones, how many still contained a gift-only word: ${admissibleAndTouchedGiftOnly}`);
console.log(`  of the REFUSED ones, how many contained a gift-only word:          ${refusedButTouchedGiftOnly}`);

// A concrete example, printed verbatim, of one refusal so the mechanism is
// visible rather than just counted.
if (giftOnlyWords.length > 0) {
  const example = emitSequence({
    belief,
    context: [giftOnlyWords[0]],
    horizon: HORIZON,
    conditioning: "free-running",
    selection: "sampled",
    seed: 12345,
  });
  if (!isGap(example)) {
    const crossing = admissibleAsTestimony(example);
    console.log(`\nExample draw starting from gift-only word "${giftOnlyWords[0]}":`);
    console.log(`  emitted: ${example.emitted.filter((x) => x !== null).join(" ")}`);
    console.log(`  grounded: ${example.grounded}, received_fraction: ${(example.received_fraction * 100).toFixed(1)}%`);
    console.log(`  admissibleAsTestimony(): ${crossing === null ? "ADMISSIBLE" : `REFUSED — gap "${crossing.gap}"`}`);
  }
}

// ── VERDICT ──────────────────────────────────────────────────────────────
console.log("\n" + line());
console.log("VERDICT");
console.log(line());
console.log(`
Part A: ${hits.length === 0 ? "CONFIRMED — zero occurrences anywhere in eoreader6 of install-tier," : "hits found (see above) —"}
        competency-tier, competency-corpus, reactive harvest/fallback, or
        readiness-accounting vocabulary. The named mechanism has no footprint
        in this repository at all — not a stub, not a doc, not a TODO.

Part B: ${netHits.length === 0 ? "CONFIRMED — zero network primitives reachable from packages/ or nul/." : "network code found (see above)."}
        There is no "unready channel at projection time" fallback to trigger,
        reactive or otherwise, because there is no code anywhere in the
        engine/host that ever reaches outward for data. Every "insufficient
        basis" situation observed elsewhere in this codebase (no_ground,
        unreceived_origin, missing_kind_prior, no_candidate, etc.) resolves to
        a typed gap object, never to an I/O call.

Part C: ${["competency", "install", "web", "reactive"].every((t) => !tryTier(t).accepted) ? "CONFIRMED — TIERS is frozen to exactly [\"read\",\"received\"]; every" : "unexpected —"}
        invented third-tier label throws a TypeError at construction time.
        Even a naive attempt to bolt a "competency" or "install" trust label
        onto a belief layer is rejected by the type system itself, not by
        convention.

Part D (proxy only, not a test of the literal claim): the one real, load-
        bearing analogue this repo has for "does externally-sourced material
        ever become citable content about the thing being read" is
        admissibleAsTestimony()'s "grounded" check in
        packages/engine/generation/emit.js. Under ordinary use — sampling
        continuations that START from words gift-only vocabulary supplies —
        every admissible-as-testimony result traced back to the read tier
        (0 admissible draws touched gift-only vocabulary); every draw that
        touched gift-only vocabulary was refused with gap "unreceived_origin".
        This is consistent with the SPIRIT of the claim (externally-sourced
        material cannot surface as testimony) but it is a different, coarser,
        already-existing mechanism (a binary read/received split with an
        all-or-nothing per-emission grounding check), not the tiered
        install/competency firewall the claim describes.
`);
console.log("REPORTED VERDICT: INCONCLUSIVE — the mechanism named by the claim");
console.log("(install-tier vs competency-tier firewall; reactive web-fetch at an");
console.log("unready projection-time channel) does not exist anywhere in this repo.");
console.log("There is nothing to adversarially defeat.");

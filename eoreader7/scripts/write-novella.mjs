// eoreader6 · write-novella — SUPERSEDED, NEVER RUN. Kept as a measured
// near-miss, in the manner surf-and-fold.md's own draft is kept.
//
// Two defects, recorded so neither is walked into twice:
//
//   1. WRONG DOMAIN. `callModel` below fetches an Ollama endpoint directly
//      from inside eoreader6/scripts. Article I.4 of eo-constitution assigns
//      "model routing" to thin-host applications (eochat, eoreader-chat),
//      never to the engine repo. This file should never have called a model;
//      an orchestrator that does belongs in an app, importing pure
//      measurement from eoreader6 (see eo-constitution-placement-rules).
//   2. WRONG APPROACH. The pipeline here — plan, draft forward, detect weak
//      seams by shuffling SECTION ORDER, patch — is an essay-editing loop.
//      specs/composition-is-retrieval.md records why: the section-order
//      shuffle-null has no power at novelette scale, even on ground-truth
//      Frankenstein prose cut to the same size (whole-document rank 0.5-0.8
//      across three offsets, i.e. indistinguishable from a random
//      arrangement). An `uninformative` verdict from this statistic at this
//      scale is not evidence of bad writing; it is evidence the null has zero
//      width for the question being asked (SEED.md #3's shape).
//
// What survives: the causal-cost machinery (`createLayer` read forward,
// per-position cost under belief.js) is sound. `specs/composition-is-
// retrieval.md` §5 reuses it for a different, within-document statistic
// (formula-vs-content cost, not section-arrangement) that does not need a
// between-permutation comparison — see `scripts/formula-thrift-check.mjs`,
// which validates that replacement's null actually has power before anything
// is built around it.
//
// ── THE PROBLEM (as originally stated; the diagnosis above supersedes the
//    fix, not the problem) ─────────────────────────────────────────────────
//
// No writer produces a coherent long work in one straight pass, and a small
// model asked to do so produces the failure `seam-cost.mjs` was built to
// detect: every section cold-starts, because the only continuity mechanism on
// offer is handing back a truncated slice of raw prior text (see
// eoreader-proxy/conversation-fold.js's header, and holonic-task.js's
// `previousSections.slice(0, 800)`, which always shows the OPENING of the
// draft, never what was just written). A small model cannot hold the whole
// manuscript in context, and even where it technically fits, feeding it raw
// prior text scales the prompt with the manuscript's length — the model is
// overwhelmed by degrees, then all at once.
//
// The fix this script tests is the one fold-compression-for-tiny-models.md
// argues for in essay form and specs/surf-and-fold.md §3 states as doctrine:
// compress before the model ever sees it, and never grow the compression with
// the manuscript's length.
//
// ── THE ARCHITECTURE: TWO PASSES, NOT ONE ─────────────────────────────────
//
// specs/surf-and-fold.md §3 (the epistemic/pragmatic objective flip) and
// specs/surprise-as-revision.md (pencil, then ink — a candidate applied to a
// COPY, kept only when witnessed to help) compose into one pipeline:
//
//   DRAFT   (epistemic-dominant) — each scene is written once, forward, from
//           a bounded LEDGER: a cumulative entity roster, the discourse
//           organ's own decaying motif weights (`discourse/index.js`,
//           previously wired only into `packages/host/corpus.js` and never
//           consumed), the FACTS of commitments still open — never their
//           original prose — and a short verbatim tail of the immediately
//           preceding scene. The ledger's size does not grow with the
//           manuscript; only its CONTENTS turn over. This is the fold.
//
//   REVISE  (pragmatic-dominant) — once the whole draft exists, `seam-cost.js`
//           locates which transitions are cheapest read as a PILE (a bad
//           sign — see its header) rather than as continuous prose, and a
//           second small model call rewrites ONLY that scene's opening
//           (2-4 sentences), never the whole manuscript. The rewrite is
//           applied to a COPY; `perBoundary` is measured again at that same
//           seam, and the rewrite is kept only if it demonstrably helped —
//           otherwise the draft's own opening stands. Ink follows pencil.
//
// ── THE LEDGER'S HONESTY CONDITION ─────────────────────────────────────────
//
// A commitment "resolved" by the model is not trusted on its say-so. Every
// resolve is checked MECHANICALLY — the same discipline as holonic-task.js's
// `_mechanicalCite`: does the generated text actually contain the terms the
// payoff requires? A model that skips a payoff is caught and reported, never
// silently marked done — and, since the admission gate below (`admitToTape`),
// never silently admitted to draftMd/finalMd either. Earlier versions of this
// file made the first half of that claim true (bookkeeping: `c.resolvedAt`,
// `checks[]`) while leaving the second half false (`texts.push(text)` ran
// unconditionally, before the check even fired, so a failed scene's raw prose
// still became the permanent, unmarked "novella"). A model call is a
// contracted part: only content the mechanical check vets may re-enter the
// tape a reader actually cites; text that fails is replaced, in place, with a
// typed gap (nul/index.js's `payoff_not_confirmed`) rather than let stand as
// an uncontested claim.
//
// ── SCALE, DECLARED ─────────────────────────────────────────────────────────
//
// This run is sized to the machine it ran on, not to the mechanism. Local
// inference measured at ~1.25 tok/s under real load (shared GPU, other
// services warm) sets SCENE_TOKENS low enough to finish in this session. The
// pipeline itself does not change shape at novella length — SCENES below is
// the only thing that would grow, and the ledger stays fixed-size regardless.
// This run proves the mechanism at 6 scenes; scaling it is a config change
// and a longer wait, not a redesign.
//
// Usage: node scripts/write-novella.mjs [--model NAME] [--out DIR]

import { readFileSync, writeFileSync } from "node:fs";
import { createSession, activateMotif, activeMotifs, commit, tick } from "../discourse/index.js";
import { seamCost, perBoundary, summarize } from "./seam-cost.mjs";
import { gap, isGap } from "../nul/index.js";

// ── Declared numbers ──────────────────────────────────────────────────────
const OLLAMA_URL = "http://localhost:11434";
const TEMPERATURE = 0.75;
const SEED = 20260801;
const SCENE_TOKENS = 340; // ≈ 230-260 words at this model's verbosity
const REVISE_TOKENS = 160;
const TAIL_WORDS = 80; // the only raw prior text a draft prompt ever sees
const OPENING_WORDS = 90; // how much of a scene's start a revision may replace
const REVISE_BUDGET = 3; // boundaries revised beyond any mandatory payoff fix
const API_TIMEOUT_MS = 20 * 60 * 1000;

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const MODEL = flag("model", "llama3.2:latest");
const OUT_DIR = flag("out", "..");

// ── The plan: hand-authored, never model-generated ─────────────────────────
//
// Isolating the question this script is actually testing — can a small model
// hold continuity from a COMPRESSED ledger — from a different question it
// would otherwise be entangled with: can a small model produce a reliable
// JSON outline. The plan is the declared prior; the model's job is prose and
// nothing upstream of it.
//
// Two commitments are planted and resolved NON-ADJACENTLY (a real Chekhov's
// gun, not a same-scene callback), and one motif is deliberately left untouched
// for two scenes so discourse.js's own decay has something to do before it is
// reactivated for the payoff — the actual organ, not a description of it.
const SCENES = [
  {
    id: 1, chapter: "I", label: "Chapter I — The Light",
    entities: ["Mara (the lighthouse keeper)", "Tomas (her brother, missing at sea exactly one year tonight)"],
    motifsTouch: ["Tomas's brass compass"],
    plants: [{ id: "foghorn", fact: "Mara sometimes hears the foghorn sound on nights when it is switched off, and has never told anyone.", checkTerms: ["foghorn"] }],
    resolves: [],
    beat: "Mara finishes her nightly check of the lamp. Establish the lighthouse, her isolation, and that her brother Tomas disappeared at sea exactly one year ago tonight. She keeps his brass compass shut in a drawer and has not opened it in months. Work in, as her own private thought, that she sometimes hears the foghorn sound on nights when it is switched off, and has never told anyone this. End the scene with her noticing something pale caught in the surf below the rocks.",
  },
  {
    id: 2, chapter: "I", label: "Chapter I — What the Tide Gave Back",
    entities: ["Elian Voss (a sailor, name found in a washed-up logbook)"],
    motifsTouch: ["Tomas's brass compass"],
    plants: [],
    resolves: [],
    beat: "Mara climbs down and retrieves the object: a sealed logbook, waterlogged but legible. The flyleaf names its owner, a sailor called Elian Voss. She reads enough to learn it describes a ship, and realizes with unease that its dates sit close to the night Tomas vanished. She glances at the closed drawer where the brass compass sits, but does not take it out.",
  },
  {
    id: 3, chapter: "II", label: "Chapter II — The Torn Page",
    entities: [],
    motifsTouch: [],
    plants: [{ id: "coordinate", fact: "Near the back of Voss's logbook is a page torn out except for one corner, on which is written a set of coordinates in a shaking hand; Mara suspects it marks where the ship went down, possibly where Tomas's boat went down too — and tells herself she will go there when the weather turns.", checkTerms: ["coordinate"] }],
    resolves: [],
    beat: "By lamplight, Mara reads further into Voss's logbook. It describes the ship going down in a storm. Near the back she finds a page torn out except for one corner, on which is written a set of coordinates in a shaking hand. She suspects it marks exactly where the ship sank — possibly where Tomas's boat went down too. She decides not to go there yet, telling herself she will when the weather turns.",
  },
  {
    id: 4, chapter: "II", label: "Chapter II — Old Ren",
    entities: ["Old Ren (a visiting keeper, suspicious but not unkind)"],
    motifsTouch: [],
    plants: [],
    resolves: [],
    beat: "A visiting keeper named Old Ren stops by and remarks that Mara's radio has been busy at strange hours. He is suspicious but not unkind. Mara deflects his questions about the logbook and about Tomas. Do not mention the compass or the coordinates directly — keep the tension in what is left unsaid.",
  },
  {
    id: 5, chapter: "III", label: "Chapter III — The Foghorn",
    entities: [],
    motifsTouch: ["Tomas's brass compass"],
    plants: [],
    resolves: ["foghorn"],
    beat: "Alone again, on the anniversary night, Mara finally opens the drawer and takes out Tomas's brass compass, turning it over in her hands. This is the scene where she directly explains — to herself, or aloud — why she sometimes hears the foghorn sound on nights when it is switched off, and what she believes it means about her own grief. Resolve this plainly; do not leave it implied.",
  },
  {
    id: 6, chapter: "III", label: "Chapter III — The Coordinate",
    entities: [],
    motifsTouch: ["Tomas's brass compass"],
    plants: [],
    resolves: ["coordinate"],
    beat: "The weather turns, as she said it would. Mara takes Tomas's brass compass and a boat out to the coordinate written on the torn page from Voss's logbook, navigating by the compass itself. She reaches the coordinate and finds something there that resolves what happened to Tomas — closure, wreckage, or a decision she makes because of it. End the novella here.",
  },
];

// ── Model call, same shape as eoreader-chat/holonic-task.js's _call ────────
//
// The network boundary is caught separately from an ordinary bad response.
// "No network available" (challenge #14: fetch itself rejects — Node's own
// undici throws a TypeError wrapping an ECONNREFUSED-shaped cause when the
// target is unreachable) is this repo's local-first analogue of insufficient
// basis, and every other insufficient-basis situation in this codebase
// reports a typed gap rather than fabricating or crashing raw — this is that
// discipline, applied to the one place a network call exists at all. A
// response that DID arrive but carries an error status is a different,
// already-handled failure (a real answer from a real endpoint, just not an
// ok one) and stays a plain thrown Error, unchanged.
async function callModel(messages, maxTokens) {
  let resp;
  try {
    resp = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        options: { temperature: TEMPERATURE, num_predict: maxTokens, seed: SEED },
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch (e) {
    return gap("model_unreachable", { url: OLLAMA_URL, cause: e?.cause?.message || e.message });
  }
  if (!resp.ok) throw new Error(`Ollama ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return (data.message?.content || "").trim();
}

const wc = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const tailOf = (s, n) => s.trim().split(/\s+/).slice(-n).join(" ");
const headOf = (s, n) => s.trim().split(/\s+/).slice(0, n).join(" ");

/**
 * Split at the boundary after the Nth word, keeping the ORIGINAL string on
 * both sides — so a spliced-in revision does not collapse the rest of the
 * scene's paragraph breaks into one line, which a naive split/join(" ") would.
 */
const splitAtWord = (s, n) => {
  const re = /\S+\s*/g;
  let idx = 0, count = 0, m;
  while (count < n && (m = re.exec(s))) { idx = re.lastIndex; count++; }
  return { head: s.slice(0, idx), rest: s.slice(idx) };
};

/**
 * The fold: what the model sees before drafting a scene.
 *
 * Fixed shape regardless of manuscript length — a roster, a list of active
 * motif NAMES (not their history), a list of open commitment FACTS (not
 * their original prose), and ~80 words of verbatim tail. Compare against
 * holonic-task.js's `previousSections.slice(0, 800)`, which grows with
 * nothing and always shows the wrong 800 characters.
 */
function buildDraftPrompt(scene, roster, motifNames, openCommitments, prevTail) {
  const system =
    "You are writing a short literary novella, one scene at a time, in a spare, atmospheric style. " +
    "Write only the prose of the scene — no headings, no meta-commentary, no chapter titles.";

  let p = `STORY SO FAR — established facts you must stay consistent with:\n`;
  p += roster.length ? `Characters and things introduced: ${roster.join("; ")}.\n` : `(Nothing yet — this is the opening scene.)\n`;
  if (motifNames.length) p += `Recurring image(s) available to use if natural: ${motifNames.join(", ")}.\n`;
  if (openCommitments.length) {
    p += `\nUNRESOLVED THREADS still open (do not resolve unless told to below):\n`;
    for (const c of openCommitments) p += `- ${c.fact}\n`;
  }
  if (prevTail) p += `\nTHE PREVIOUS SCENE ENDED:\n"...${prevTail}"\n`;

  p += `\nNOW WRITE THIS SCENE:\n${scene.beat}\n`;
  if (scene.resolves.length) {
    p += `\nThis scene MUST resolve the following thread(s) explicitly and unambiguously:\n`;
    for (const id of scene.resolves) {
      const c = SCENES.flatMap((s) => s.plants).find((pl) => pl.id === id);
      if (c) p += `- ${c.fact}\n`;
    }
  }
  p += `\nWrite roughly 220-260 words. Prose only.`;
  return { system, prompt: p };
}

function buildRevisePrompt(prevTail, currentOpening, connectFact) {
  const system = "You revise the opening of a scene so it connects to what came before. Return ONLY the rewritten opening — no commentary, no quotation marks around it.";
  let p = `THE PREVIOUS SCENE ENDED:\n"...${prevTail}"\n\n`;
  p += `THIS SCENE CURRENTLY OPENS:\n"${currentOpening}..."\n\n`;
  p += `Rewrite ONLY this opening (2-4 sentences) so it picks up naturally from the previous scene's ending`;
  if (connectFact) p += `, and makes sure to work in: ${connectFact}`;
  p += `. Do not summarize what follows. Match the spare, atmospheric prose style.`;
  return { system, prompt: p };
}

const checkResolved = (text, checkTerms) => checkTerms.some((t) => text.toLowerCase().includes(t.toLowerCase()));

/**
 * THE ADMISSION GATE — the tape's own boundary.
 *
 * `checkResolved` above is the header's "checked MECHANICALLY" claim, and
 * until this function existed that claim was true only of bookkeeping
 * (`c.resolvedAt`, `checks[]`, the report's prose) and never of the tape
 * itself: `texts.push(text)` used to run unconditionally, before this check
 * even fired, so a scene that failed the mechanical check still became six
 * paragraphs of unmarked prose in draftMd and finalMd — the permanent
 * artifacts a reader actually cites. A model call is a contracted part
 * (SEED.md / the ledger's honesty condition above): only vetted content may
 * re-enter the tape, and "vetted" has to mean the document, not a sibling
 * report.md a reader of the novella never opens.
 *
 * So a scene whose text is offered as resolving a planted commitment but does
 * not contain the required terms is refused admission, in place, at the same
 * grain nul/index.js already refuses every other unearned claim — a typed
 * gap (`payoff_not_confirmed`), rendered so it is legible IN the document,
 * not just in a side channel. `texts[]` itself is left untouched: it is the
 * pipeline's own working ledger (continuity prompts, the revise pass's raw
 * material), never presented to a reader as citable, so it is not the tape
 * and is not gated here. Only what is written to draftMd/finalMd is.
 */
const admissionGap = (scene, failedChecks) =>
  gap("payoff_not_confirmed", {
    scene: scene.id,
    label: scene.label,
    unconfirmed: failedChecks.map((c) => c.id),
  });

const renderGap = (g) =>
  `*[quarantined — mechanical check found no citation of ${g.unconfirmed.map((id) => `"${id}"`).join(", ")} in this scene's generated text. ` +
  `A model output that claims a payoff it does not contain is not vetted content and is withheld from this document ` +
  `(gap: ${g.gap}). See lighthouse-novella-report.md's mechanical payoff checks for the raw finding.]*`;

/** Runs the mechanical check for every commitment this scene claims to resolve. Never trusts the model's say-so. */
const checkScene = (scene, text, commitments) =>
  scene.resolves.map((id) => {
    const c = commitments.get(id);
    return { id, ok: checkResolved(text, c.checkTerms), c };
  });

/**
 * What actually reaches the tape for one scene: the raw text if every
 * resolve it claims is mechanically confirmed, or a typed gap in its place
 * if any is not. This is the one place draftMd/finalMd content is decided —
 * `texts[idx]` (the pipeline's raw ledger) is never substituted for it.
 */
const admitToTape = (scene, text, sceneChecks) => {
  const failed = sceneChecks.filter((s) => !s.ok);
  if (failed.length === 0) return text;
  return renderGap(admissionGap(scene, failed));
};

/**
 * A matched-size REAL-PROSE control for the whole-document seam-cost verdict.
 *
 * Measured before trusting seam-cost's aggregate on the novella: genuine
 * Frankenstein prose, cut into the SAME number of sections at the SAME mean
 * length, ALSO reads `uninformative` (whole-document rank ~0.5-0.8 across
 * three offsets tried). Order-4 arrangement-sensitivity has no power at
 * novelette scale — this is the same finding generation/RESULTS.md already
 * recorded for a different statistic ("the ground grows over the whole
 * regime, becomes wide, and nothing exceeds it") arrived at independently.
 *
 * So the aggregate verdict on the novella is reported ALONGSIDE this control,
 * never alone — per the standing admission criterion, a statistic that cannot
 * tell continuous human prose from a shuffle at this scale is not a gate on
 * the novella either. What DOES carry signal at this scale: the mechanical
 * payoff checks (deterministic, scale-independent) and the PAIRED before/after
 * comparison at one boundary during revision (same content, same position,
 * only the opening differs — a far better-powered comparison than real-vs-200
 * -shuffles of six sections).
 */
function matchedProseControl(nSections, meanWords, seed) {
  let raw;
  try {
    raw = readFileSync("../pg84.txt", "utf8");
  } catch {
    return null;
  }
  const words = raw.slice(Math.floor(raw.length * 0.4), Math.floor(raw.length * 0.7)).split(/\s+/).filter(Boolean);
  const secs = [];
  for (let i = 0; i < nSections; i++) secs.push(`## Section ${i + 1}\n\n${words.slice(i * meanWords, (i + 1) * meanWords).join(" ")}`);
  return seamCost(secs.join("\n\n"), { draws: 200, seed });
}

export async function main() {
  const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
  log(`model=${MODEL} scenes=${SCENES.length} scene_tokens=${SCENE_TOKENS}`);

  const session = createSession();
  const roster = [];
  const commitments = new Map(); // id -> { fact, checkTerms, plantedAt, resolvedAt: null }
  const texts = []; // the pipeline's own working ledger — raw model output, never presented to a reader
  const tapeTexts = []; // what actually reaches draftMd/finalMd — gated by admitToTape
  const checks = [];

  for (const scene of SCENES) {
    for (const p of scene.plants) commitments.set(p.id, { fact: p.fact, checkTerms: p.checkTerms, plantedAt: scene.id, resolvedAt: null });
    for (const m of scene.motifsTouch) activateMotif(session, m, 1);
    const motifNames = activeMotifs(session).map((m) => m.name);
    const openCommitments = [...commitments.values()].filter((c) => c.resolvedAt === null);
    const prevTail = texts.length ? tailOf(texts[texts.length - 1], TAIL_WORDS) : null;

    const { system, prompt } = buildDraftPrompt(scene, [...roster], motifNames, openCommitments, prevTail);
    const t0 = Date.now();
    const text = await callModel([{ role: "system", content: system }, { role: "user", content: prompt }], SCENE_TOKENS);
    if (isGap(text)) { log(`scene ${scene.id} "${scene.label}" — model unreachable (${text.cause}); stopping, not fabricating`); throw text; }
    log(`scene ${scene.id} "${scene.label}" — ${wc(text)} words in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    texts.push(text);

    const sceneChecks = checkScene(scene, text, commitments);
    for (const { id, ok, c } of sceneChecks) {
      checks.push({ id, plantedAt: c.plantedAt, resolvedAt: scene.id, gap: scene.id - c.plantedAt, mechanicallyConfirmed: ok });
      if (ok) c.resolvedAt = scene.id;
      log(`  resolve "${id}" (planted scene ${c.plantedAt}, gap ${scene.id - c.plantedAt}): ${ok ? "CONFIRMED" : "NOT FOUND — model skipped the payoff; withheld from the tape (gap: payoff_not_confirmed)"}`);
    }
    tapeTexts.push(admitToTape(scene, text, sceneChecks));

    for (const e of scene.entities) roster.push(e);
    commit(session, `scene ${scene.id}: ${scene.label}`);
    tick(session);
  }

  const unresolvedAtDraft = [...commitments.entries()].filter(([, c]) => c.resolvedAt === null);
  if (unresolvedAtDraft.length) log(`UNRESOLVED at end of draft: ${unresolvedAtDraft.map(([id]) => id).join(", ")}`);

  const draftMd = SCENES.map((s, i) => `## ${s.label}\n\n${tapeTexts[i]}\n`).join("\n");
  writeFileSync(`${OUT_DIR}/lighthouse-novella-draft.md`, `# The Compass Light\n\n${draftMd}`);
  log(`draft written: ${wc(draftMd)} words total`);

  log("measuring draft arrangement (seam-cost)...");
  const draftSeam = seamCost(draftMd, { draws: 200, seed: SEED });
  const draftBoundaries = perBoundary(draftMd);
  console.log(summarize(draftSeam));

  // ── REVISE: mandatory fixes (failed mechanical payoffs) + worst-lift seams
  const mandatory = new Set(checks.filter((c) => !c.mechanicallyConfirmed).map((c) => c.resolvedAt - 1)); // boundary index into secs[]
  const byLift = [...draftBoundaries].sort((a, b) => a.lift - b.lift).map((b) => b.index);
  const targets = new Set(mandatory);
  for (const idx of byLift) {
    if (targets.size >= mandatory.size + REVISE_BUDGET) break;
    targets.add(idx);
  }
  log(`revising ${targets.size} of ${draftBoundaries.length} boundaries: [${[...targets].sort((a, b) => a - b).join(", ")}]`);

  // Each candidate is generated from the DRAFT's own text (never a previously
  // revised neighbour) and judged in ISOLATION — a candidateMd that swaps in
  // only THIS boundary's rewrite, everything else left at the draft. Judging
  // against a manuscript with other revisions already spliced in would let an
  // upstream rewrite change the causal reading at a downstream seam, and the
  // keep/revert decision would then be measuring a confound, not this
  // rewrite's own effect.
  const revisedTexts = [...texts]; // candidate text per revised index, for the descriptive "Revised" report section
  // Starts from tapeTexts, not texts: the un-revised baseline for any boundary
  // this loop does not touch must already be admission-gated, never raw.
  const finalTexts = [...tapeTexts];
  const decisions = [];
  for (const idx of [...targets].sort((a, b) => a - b)) {
    const scene = SCENES[idx];
    const prevTail = tailOf(texts[idx - 1], TAIL_WORDS);
    const { head: opening, rest } = splitAtWord(texts[idx], OPENING_WORDS);

    let connectFact = null;
    if (scene.resolves.length) connectFact = commitments.get(scene.resolves[0])?.fact ?? null;
    else if (scene.motifsTouch.length) connectFact = `the recurring image of ${scene.motifsTouch[0]}`;

    const { system, prompt } = buildRevisePrompt(prevTail, opening.trim(), connectFact);
    const t0 = Date.now();
    const newOpening = await callModel([{ role: "system", content: system }, { role: "user", content: prompt }], REVISE_TOKENS);
    if (isGap(newOpening)) { log(`revise scene ${scene.id} — model unreachable (${newOpening.cause}); stopping, not fabricating`); throw newOpening; }
    log(`revised opening of scene ${scene.id} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    const candidateText = `${newOpening.trim()} ${rest.trimStart()}`;
    revisedTexts[idx] = candidateText;

    // Pencil, then ink: judge this ONE candidate against a copy of the draft
    // with only its own boundary swapped in, per specs/surprise-as-revision.md.
    // Always measured and logged — informative even on a citation-bearing
    // boundary, just no longer what the KEEP/REVERT decision is made from.
    const candidateTexts = [...texts];
    candidateTexts[idx] = candidateText;
    const candidateMd = SCENES.map((s, i) => `## ${s.label}\n\n${candidateTexts[i]}\n`).join("\n");
    const candidateBoundaries = perBoundary(candidateMd);
    const before = draftBoundaries.find((b) => b.index === idx);
    const after = candidateBoundaries.find((b) => b.index === idx);
    const liftHelped = after.lift > before.lift;

    let kept, basis;
    if (scene.resolves.length) {
      // CITATION-BEARING BOUNDARY. checkResolved is a HARD PRECONDITION here,
      // independent of seamCost lift — a still-fabricated revision can never
      // be KEPT purely because its arrangement statistic looks better. This
      // is the same admission gate `admitToTape` applies at draft time,
      // applied again because a second model call is a second unvetted
      // claim, not an automatic upgrade of the first.
      const c = commitments.get(scene.resolves[0]);
      const confirmed = checkResolved(candidateText, c.checkTerms);
      log(`  re-check "${scene.resolves[0]}" after revision: ${confirmed ? "CONFIRMED" : "still not found — gate refuses this candidate regardless of lift"}`);
      kept = confirmed;
      basis = "payoff_not_confirmed gate";
      if (confirmed && c.resolvedAt === null) {
        // The revision is what actually earned the citation — the report and
        // the tape must agree, so the bookkeeping the header promises
        // ("caught and reported, never silently marked done") is updated
        // here too, not left to contradict a now-vetted finalMd.
        c.resolvedAt = scene.id;
        const chk = checks.find((ch) => ch.id === scene.resolves[0]);
        if (chk) { chk.mechanicallyConfirmed = true; chk.viaRevision = true; }
      }
    } else {
      kept = liftHelped;
      basis = "lift";
    }
    // tapeTexts[idx] is the correct fallback either way: the raw draft text
    // when it already passed admission, the typed gap when it did not — never
    // texts[idx], which would readmit exactly the fabrication this gate exists
    // to keep off the tape.
    finalTexts[idx] = kept ? candidateText : tapeTexts[idx];
    decisions.push({ index: idx, label: scene.label, beforeLift: before.lift, afterLift: after.lift, kept, basis });
    log(`boundary ${idx} "${scene.label}": lift ${before.lift.toFixed(3)} -> ${after.lift.toFixed(3)} (decision basis: ${basis}) — ${kept ? "KEPT" : "REVERTED"}`);
  }

  // Descriptive only: all candidates applied together, for the "Revised"
  // report section. The KEEP/REVERT decisions above never consult this.
  const revisedMd = SCENES.map((s, i) => `## ${s.label}\n\n${revisedTexts[i]}\n`).join("\n");
  log("measuring revised arrangement (seam-cost, all candidates applied together, descriptive only)...");
  const revisedSeam = seamCost(revisedMd, { draws: 200, seed: SEED });
  console.log(summarize(revisedSeam));

  const finalMd = SCENES.map((s, i) => `## ${s.label}\n\n${finalTexts[i]}\n`).join("\n");
  writeFileSync(`${OUT_DIR}/lighthouse-novella-final.md`, `# The Compass Light\n\n${finalMd}`);
  log("measuring final arrangement (seam-cost)...");
  const finalSeam = seamCost(finalMd, { draws: 200, seed: SEED });
  console.log(summarize(finalSeam));

  log("measuring matched-size real-prose control (Frankenstein, same section count and length)...");
  const meanWords = Math.round(wc(finalMd) / SCENES.length);
  const control = matchedProseControl(SCENES.length, meanWords, SEED);
  if (control) console.log(summarize(control));

  // Recomputed AFTER revision: a commitment the revise pass actually earned
  // (c.resolvedAt set above, inside the payoff_not_confirmed gate) must not
  // still be reported UNRESOLVED — the report and the tape have to agree.
  const unresolvedFinal = [...commitments.entries()].filter(([, c]) => c.resolvedAt === null);

  const report = [
    `# The Compass Light — a fluency-across-prompts report`,
    ``,
    `Model: ${MODEL} · ${SCENES.length} scenes · scene budget ${SCENE_TOKENS} tokens`,
    ``,
    `## Mechanical payoff checks (never trusted on the model's say-so)`,
    ``,
    ...checks.map((c) => `- **${c.id}**: planted scene ${c.plantedAt}, resolved scene ${c.resolvedAt} (gap ${c.gap} scenes) — ${c.mechanicallyConfirmed ? `CONFIRMED${c.viaRevision ? " (only after revision — draft text was withheld from the tape)" : " in draft text"}` : "NOT FOUND — withheld from the tape (gap: payoff_not_confirmed)"}`),
    unresolvedFinal.length ? `- **UNRESOLVED**: ${unresolvedFinal.map(([id]) => id).join(", ")}` : `- all planted commitments were resolved`,
    ``,
    `## Arrangement (seam-cost): does the order carry meaning?`,
    ``,
    `### Draft (single forward pass)`,
    "```",
    summarize(draftSeam),
    "```",
    `### Revised (before keep/revert)`,
    "```",
    summarize(revisedSeam),
    "```",
    `### Final (kept revisions only)`,
    "```",
    summarize(finalSeam),
    "```",
    ``,
    `### Calibration: matched-size REAL PROSE control`,
    ``,
    `Frankenstein, cut into ${SCENES.length} sections of ~${meanWords} words each — same statistic, same draws, ground-truth continuous prose.`,
    `Read this BEFORE trusting the aggregate verdicts above: if genuine prose at this size also comes back \`uninformative\`,`,
    `the statistic has no power at novelette scale and an \`uninformative\` verdict on the novella is not evidence against it —`,
    `only a \`censored_below\` verdict on the novella that the control does NOT also achieve would be informative here.`,
    control ? "```" : "(pg84.txt not found — control skipped)",
    ...(control ? [summarize(control)] : []),
    ...(control ? ["```"] : []),
    ``,
    `## Per-boundary revision decisions`,
    ``,
    ...decisions.map((d) => `- boundary ${d.index} (${d.label}): lift ${d.beforeLift.toFixed(3)} → ${d.afterLift.toFixed(3)} (decision basis: ${d.basis}) — **${d.kept ? "KEPT" : "REVERTED"}**`),
  ].join("\n");
  writeFileSync(`${OUT_DIR}/lighthouse-novella-report.md`, report);
  log("done. wrote lighthouse-novella-{draft,final,report}.md");
}

// SUPERSEDED, NEVER RUN (see this file's own header) means never run as a
// SIDE EFFECT of being imported, either — challenge #14 found that main()
// ran unconditionally at module scope, so importing this file for any
// reason (a test harness included) was itself an invocation. Guarded now,
// the same "is this process the entrypoint" check Node's own docs recommend.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    if (isGap(e)) {
      // Insufficient basis, not a crash — a typed stop gets its own exit
      // code so a caller (or a test harness) can tell the two apart without
      // parsing stderr text.
      console.error(`[gap] ${e.gap}: ${e.cause ?? e.reason ?? "(no detail)"}`);
      process.exit(2);
    }
    console.error(e);
    process.exit(1);
  });
}

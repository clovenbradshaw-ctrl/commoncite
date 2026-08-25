// eoreader6 · scripts/model-relevance — the model tier, kept OUT on purpose.
//
// This file lives under scripts/, not packages/host/, because
// conformance/local-first-boundary.test.js makes it structurally impossible
// for anything under packages/ or nul/ to reach the network — "a reactive
// competency-fetch tier cannot exist here by construction" (challenge
// #12/#14's own words). That boundary is a deliberate, tested guarantee, and
// this module's first draft lived inside packages/host/ and broke it; moved
// here rather than argued around.
//
// surfer.js's contentAddress is mechanical: two signals (lexical coverage/
// phrase, then the Hebbian associative graph re-earned from
// engine/emergence/activation.js) resolve a candidate, and when BOTH
// genuinely have no opinion, contentAddress says so (`match.ambiguous`,
// `match.tiedCandidates`) instead of silently trusting a coin-flip. Neither
// contentAddress nor executePrompt calls this module, and never will from
// inside packages/ — the seam is the same DIRECTION activation.js's `embed`
// parameter already uses (injected, never imported), just enforced by
// physical location instead of an unsupplied default, because a network
// call cannot be a caller-supplied no-op the way a missing embedder can. A
// caller OUTSIDE packages/ (a script, an app) runs the mechanical result
// first, then calls resolveAmbiguity itself if it wants the last resort.
//
// THE MEASUREMENT, AND WHY IT CHANGED TWICE. First draft asked a chat model
// (gemma2:2b) an independent yes/no per candidate, parsed the generated
// word — a tool-call shape, trusting the model's own free-text act. Second
// draft kept the chat model but read its next-token logprobs instead of
// generated text (a real measurement of the distribution it already held),
// framed pairwise ("which of these two, A or B") instead of independently,
// because independent absolute scoring measured 0.85-0.99 P(YES) on nearly
// every candidate — acquiescence, not judgment. Both drafts asked a
// GENERATIVE model to introspect a preference it was never trained to have a
// calibrated opinion about. An embedding model is trained for exactly the
// opposite: place semantically-similar text close together by a contrastive
// objective, so cosine similarity between the claim's embedding and a
// candidate's IS the calibrated signal, not a proxy for one read off a
// chat model's side channel. `nomic-embed-text` (274MB, one forward pass —
// smaller and faster than every chat model tried) replaces both prior
// designs rather than sitting alongside them.
//
// SIGNAL FROM NOISE, NOT A HAND-SET THRESHOLD. Once every tied candidate has
// a cosine-similarity reading, "is one of them a real standout" is answered
// by the SAME licensed Born-null test surfer.js's contentAddress uses for
// its own mechanical tie (nul/index.js's maxDeviation/resample pair, earned
// by scripts/verify-maxdeviation-candidate.mjs) — not a hand-picked cosine
// cutoff living in this file. One decision procedure, asked of every kind of
// evidence this seam produces.
//
// REVISABLE, NOT AUTHORITATIVE. This module never claims to know which
// candidate is right — it returns a MEASUREMENT, one per candidate, and the
// caller decides what to do with disagreement or a gap. SEED.md #6: plural
// grounds for one figure are legal, and their disagreement is the only
// self-check. An embedding's cosine similarity is evidence to weigh, not a
// fact to substitute for the mechanical result.
//
// No network reachability, no model pulled, no server running: every one of
// those is a typed gap (`gap: "undeclared"`, matching activation.js's own
// NO_EMBEDDER shape), never a default answer and never a thrown exception
// that stops the caller's mechanical result from standing.

import { ground, difference, isGap } from "../nul/index.js";

const DEFAULT_ENDPOINT = "http://localhost:11434";
const DEFAULT_MODEL = "nomic-embed-text";
const DEFAULT_TIMEOUT_MS = 30000;

const NO_MODEL = (why) => Object.freeze({ gap: "undeclared", what: "model_relevance", why });

async function embed(text, { endpoint, model, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${endpoint}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, input: text }),
      signal: controller.signal,
    });
    if (!res.ok) return { error: `ollama responded ${res.status}` };
    const data = await res.json();
    const vec = data.embeddings?.[0];
    if (!Array.isArray(vec) || vec.length === 0) return { error: "response carried no embedding vector" };
    return { vec };
  } catch (e) {
    return { error: e.name === "AbortError" ? "timed out" : String(e.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};

/**
 * resolveAmbiguity(claim, tiedCandidates, opts) — the last resort.
 *
 * `tiedCandidates`: [{ anchorLine, byte_start, text }, ...] — exactly
 * contentAddress's `match.tiedCandidates` when `match.ambiguous` is true.
 *
 * Returns { assertion, readings, gap } — never throws. `assertion` is an
 * ASSERTION, not a verdict: it names the candidate the embedding ranks
 * highest whenever readings exist at all, together with `confirmed` — did
 * the Born-null test find that candidate a genuine statistical outlier above
 * the rest, or is it only the best of an indistinguishable field. Both cases
 * are reported; neither is silence. A caller that wants only confirmed picks
 * checks `assertion.confirmed`; a caller that wants the best available guess,
 * clearly held revisably, reads `assertion` either way. `assertion` is null
 * only when there is nothing to assert at all (a gap, or fewer than two
 * candidates) — never a stand-in for "not confirmed."
 */
export async function resolveAmbiguity(claim, tiedCandidates, {
  endpoint = DEFAULT_ENDPOINT,
  model = DEFAULT_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!tiedCandidates || tiedCandidates.length < 2) {
    return { assertion: null, readings: [], gap: NO_MODEL("fewer than two tied candidates — nothing to arbitrate") };
  }

  const claimEmbed = await embed(claim, { endpoint, model, timeoutMs });
  if (claimEmbed.error) {
    return { assertion: null, readings: [], gap: NO_MODEL(`${model}@${endpoint}: ${claimEmbed.error}`) };
  }

  const readings = [];
  for (const c of tiedCandidates) {
    const out = await embed(c.text, { endpoint, model, timeoutMs });
    if (out.error) {
      return { assertion: null, readings, gap: NO_MODEL(`${model}@${endpoint}: ${out.error}`) };
    }
    readings.push({ anchorLine: c.anchorLine, byte_start: c.byte_start, similarity: cosine(claimEmbed.vec, out.vec) });
  }

  // The SAME construction as surfer.js's mechanical tie-break: hold the top
  // reading out, build a null from the rest via maxDeviation/resample (the
  // licensed pair, same declared draws/window/seed everywhere it is used —
  // not re-picked per call site), and ask whether the held-out value's
  // deviation from the rest's median exceeds what that null could produce by
  // chance. This gates CONFIDENCE, not whether an assertion is made at all —
  // the top reading is always asserted; this only says whether it clears the
  // bar to be trusted as more than "best of an indistinguishable field."
  const sorted = [...readings].sort((a, b) => b.similarity - a.similarity);
  const top = sorted[0];
  const rest = sorted.slice(1).map((r) => r.similarity);

  let confirmed = false;
  if (rest.length >= 2) {
    const g = ground({ material: rest, draws: 200, window: 2, perturbation: "resample", statistic: "maxDeviation", seed: 11 });
    if (!isGap(g)) {
      const restSorted = [...rest].sort((a, b) => a - b);
      const mid = (rest.length - 1) / 2;
      const lo = Math.floor(mid);
      const median = restSorted[lo] + (restSorted[Math.ceil(mid)] - restSorted[lo]) * (mid - lo);
      const deviation = Math.abs(top.similarity - median);
      const d = difference(deviation, g);
      confirmed = isGap(d) && d.gap === "exceeds_witness" && d.direction === "above";
    }
  }

  const winnerCandidate = tiedCandidates.find((c) => c.anchorLine === top.anchorLine);
  return {
    assertion: { anchorLine: top.anchorLine, byte_start: winnerCandidate.byte_start, similarity: top.similarity, confirmed },
    readings,
    gap: null,
  };
}

export const CELL = Object.freeze({ op: "EVA", grain: "Figure" });

// eoreader6 · packages/host/surfer — the no-model NL-prompt surfer.
//
// A reader says what they want in words and the surfer does it: snips the
// segment the words address. No model, no statistics, no clock — the prompt
// is addressed to the corpus mechanically, and whatever cannot be addressed
// is a typed gap, never a guess.
//
// WHERE THIS LIVES, AND WHY (eo-constitution, assay claim surfer-snip-host):
// this is app-tier. It owns the session, the prompt-as-interface, and the
// byte I/O that turns a byte range into text a reader can experience. It
// measures nothing about the material itself — every measurement is the
// engine's, imported whole from perceiver/text/segments.js and host/corpus.js.
//
// THE ADDRESS LADDER, re-earned from eoreader-chat's engineReadSegment and
// the mcp snip tool:
//
//   1. SOURCE — one document is the corpus; several need the prompt to say
//      which. A prompt that names a document narrows the field to the names;
//      a prompt that names none is NOT a guess about which — it is an address
//      to ALL of them, and the surfer fans the act out across the corpus. The
//      old rung stopped at a `no_source_addressed` typed gap; that gap was
//      the engine asking "which document?" and the answer — everywhere — is
//      what a fan delivers. Two names named is two targets, not ambiguity:
//      `ambiguous_source` was the same gate with the answer already in the
//      prompt.
//
//   2. HEADING — if the prompt addresses a boundary by form ("chapter 2",
//      "letter 1", "movement 3"), that segment is snipped. Numeral forms
//      convert across arabic/roman ("chapter 18" finds "CHAPTER XVIII");
//      surrounding words ("snip chapter 2 of the book") are the reader's,
//      not the address. Two headings addressed at once is ambiguity, typed.
//
//   3. CONTENT — no heading addressed: the prompt's substantive tokens are
//      matched against the lines, and the best-scoring line is the anchor.
//      The segment bracketing it is what the surfer returns — the structural
//      cluster around the passage the reader described.
//
//   4. WINDOW, never fabrication. A passage with no structural boundary in
//      reach returns the raw context window, labelled as one, or a typed gap
//      — never a chapter name invented for the occasion.
//
// THE OPERATOR GRID (engine/operators.js): every act of the app is one of the
// nine operators, aimed at some target at some holonic height. The surfer's
// act is SEG · snip — the addressed reach-unit cut out of the arena, byte-
// accurate — and this file is the target dimension of that grid: the act is
// aimed at every target the prompt names, or at the whole corpus when it
// names none, and each fan entry lands at the ladder rung it reached. The
// verb dimension (the nine operators and their organs) is declared in
// engine/operators.js and fired by the loops; the surfer does not pretend to
// run an EVA or DEF organ it has not — a prompt's English verb is content,
// and the surfer is mechanical.
//
// The ladder is host because the prompt is a surface: a leitmotif in a
// symphony does not arrive by English words. What the engine refuses to do
// (understand "the second chapter" — an English ordinal) the surfer does not
// paper over either; that word falls through to the content phase, where it
// is matched as a token or missed as a typed gap.

import { OPERATORS } from "../engine/operators.js";
import { headingsMatch } from "../engine/perceiver/text/segments.js";
import { diaNorm } from "../engine/perceiver/text/surfaces.js";
import { sessionSegments, snipSegment, snipRange, nGramProfile, queryContainment } from "./corpus.js";
import { tokens as assocTokens, codeOf as assocCodeOf, encodeFrame as assocEncodeFrame, recall as assocRecall } from "../engine/emergence/activation.js";
import { ground as nulGround, difference as nulDifference, isGap as nulIsGap } from "../../nul/index.js";
import { readingRegime } from "../engine/loops/reading-regime.js";

// The cell this host organ occupies on the operator grid (engine/operators.js):
// SEG · Field · Clearing — the addressed reach-unit cut out of the arena, the
// app's default verb (no verb named ⇒ SEG · snip). Declared, checked by
// conformance.
export const CELL = Object.freeze({ op: "SEG", grain: "Ground" });

// The n-gram pass is computed only for this many top-lexical lines: the
// signal reorders near-equals, so the shortlist cap bounds the cost without
// changing what the gate admits.
const CONTENT_SHORTLIST_CAP = 40;

// A token is a run of 4+ letters/digits, folded through the canonical single-
// pass diacritic map (diaNorm — never a third map). The 4-char floor keeps a
// distinctive word while refusing what is not a word: "oak" alone is not
// distinctive enough to address anything, and an un-segmented glyph run like
// "第二回" is not a token either — treating a CJK run as one word is a value
// claim that belongs in eoPriors, and the golden pins that address as a typed
// gap until a segmentation prior lands.
const tokenize = (s) => diaNorm(s).match(/[\p{L}\p{N}]{4,}/gu) ?? [];

// The n-gram signal (nGramProfile/queryContainment) lives in corpus.js, where
// searchSpans reads it too — both sides get the same transform (see
// corpus.js's note re-earned from specs/mechanical-retrieval-theory.md).

// Tried and reverted (golden-quotes-surprise-calibration pilot): a true,
// symmetric trigram cosine as a last-resort tie-break when the mechanical
// formula below leaves several candidates within a narrow margin of the
// leader. It closed zero of the remaining Don Quixote/Les Misérables misses
// and broke a real, deliberately-designed adversarial case in the frozen
// surfer golden (`en-content-regression` — a wrong section that happens to
// repeat the query's own rare word must NOT win over the right one; the
// cosine tie-break flipped exactly that). Left as a note rather than silently
// dropped: the next attempt at a semantic escalation tier should be verified
// against the FULL golden before being trusted, not just the pilot's own
// books — a fix that only helps the golden you're building it against is not
// a fix.

const baseName = (id) =>
  String(id ?? "")
    .split(":")
    .pop()
    .split(/[/\\]/)
    .pop()
    .replace(/\.(txt|md|html?|json|csv)$/i, "");

// 1. SOURCE — the documents the prompt addresses. A named document narrows
// the field to the names (one name is a single target, several are several);
// silence addresses every document in the corpus. A prompt that names nothing
// is not a guess about which — it is an address to all of them.
const resolveTargets = (session, prompt) => {
  const docs = Array.from(session.documents.values());
  if (docs.length === 0) return { error: "no_source", reason: "the corpus is empty" };

  const lower = String(prompt ?? "").toLowerCase();
  const hits = docs.filter((d) => lower.includes(baseName(d.id).toLowerCase()));
  return { targets: hits.length > 0 ? hits : docs, named: hits };
};

// When a prompt names several documents, each target is addressed by the
// clause that names it — the other documents' addresses must not bleed into
// this one's heading match ("chapter 2 of pg84 and chapter 1 of pg1342" is
// two targets with two addresses, not one ambiguous address). A document the
// prompt did not name (the fan to all) keeps the whole prompt, and a single
// named document keeps the whole prompt too — its prose is one address, not
// a clause to be split ("...that Genoa and Lucca are family estates of the
// Buonapartes" is one thought, and splitting on "and" would mangle it).
const scopeForTarget = (prompt, doc, namedDocs) => {
  if (!namedDocs.includes(doc)) return prompt;
  if (namedDocs.length === 1) return prompt;
  const clauses = String(prompt).split(/\s+and\s+/i).map((s) => s.trim());
  const name = baseName(doc.id).toLowerCase();
  return clauses.find((c) => c.toLowerCase().includes(name)) ?? prompt;
};

// 2. HEADING — addresses of boundaries by form, mechanically.
const headingAddress = (prompt, outline) => {
  const matches = (outline.headings || []).filter((h) => headingsMatch(prompt, h.label));
  if (matches.length === 1) {
    const h = matches[0];
    return { heading: h, anchor: h.bodyStart, addressed_by: "heading", label: h.label };
  }
  if (matches.length > 1) {
    return {
      error: "ambiguous_address",
      reason: `"${prompt}" addresses ${matches.length} segments (a flat outline cannot tell them apart): ${matches
        .slice(0, 5)
        .map((h) => `${h.label}@${h.start}`)
        .join(", ")}${matches.length > 5 ? ", …" : ""}`,
    };
  }
  return null;
};

// 3. CONTENT — the line the prompt's tokens best cover is the anchor.
//
// Re-earned, not ported, from the measured eoreader5 search lessons
// (packages/engine/search/index.js + specs/mechanical-retrieval-theory.md):
// the composition is lexical-coverage-led because signal-led ranking was
// measured to lose the verbatim phrase (top-1 7/14), and rarity weights exist
// because term COUNT is not evidence strength. Two passes:
//
//   PASS 1 — the evidence gate. A line with zero matched tokens has nothing
//   to say about the prompt, and the n-gram signal NEVER rescues it — silence
//   over fabrication, and measured in eoreader5: signal alone cannot separate
//   a genuine near-match from an absent term at this granularity.
//
//   PASS 2 — n-gram query containment, computed only for the lexical
//   shortlist. It can reorder near-equals (a typo, a diacritic, a shared
//   phrase), never admit.
//
//   score = coverage*0.6 + phrase*0.25 + ngram*0.15
// Amendment (golden-quotes-surprise-calibration pilot): a prompt built from
// several sentences — the ordinary shape of a non-verbatim query, a reader
// paraphrasing a passage rather than quoting it — cannot be covered well by
// ANY single physical line when the source is hard-wrapped prose (a
// Gutenberg line is ~70-80 chars; a real quote is often 200-600). Scoring
// physical lines alone left the winner to whichever unrelated short line
// happened to contain the query's one or two rarest tokens, not the actual
// passage — measured directly against Goodreads' non-verbatim War and Peace
// quotes, where whole-novel content-address hit only 2/15 before this
// change. The fix adds PARAGRAPH-level candidates (consecutive non-blank
// lines, the source's own structural unit above the line) alongside the
// existing line-level ones, scored by the identical formula — a multi-line
// paragraph is not a new kind of evidence, just a wider reach for the same
// coverage/phrase/ngram measure. A one-line paragraph is already a line
// candidate, so only paragraphs spanning 2+ lines are added, to avoid
// scoring the same text twice under two labels.
// A paragraph capped at MAX_PARA_LINES: front matter (a table of contents,
// hundreds of ALL-CAPS chapter titles with no blank line between them) is,
// by this same "consecutive non-blank lines" rule, ONE giant paragraph —
// and a giant candidate accumulates coverage on generic words ("world",
// "knight") repeated across every title, enough to outscore the real
// passage on a short, common-vocabulary quote. Measured directly: "Hunger
// is the best sauce in the world" (Don Quixote) resolved to the table of
// contents, which repeats "…IN THE WORLD" across a dozen chapter titles.
// A real paragraph is never this long; capping and sliding (stride half the
// cap, so a passage straddling a cap boundary is still whole in the next
// window) keeps every candidate a plausible single passage.
const MAX_PARA_LINES = 30;
const paragraphsOf = (lines) => {
  const paras = [];
  let start = -1;
  const flush = (s, e) => {
    if (e - s < 1) return; // need 2+ lines to be worth a paragraph candidate
    if (e - s + 1 <= MAX_PARA_LINES) {
      paras.push({ start: s, end: e });
      return;
    }
    const stride = MAX_PARA_LINES >> 1;
    for (let w = s; w <= e; w += stride) paras.push({ start: w, end: Math.min(e, w + MAX_PARA_LINES - 1) });
  };
  for (let i = 0; i <= lines.length; i++) {
    const blank = i === lines.length || lines[i].trim() === "";
    if (!blank && start === -1) start = i;
    if (blank && start !== -1) {
      flush(start, i - 1);
      start = -1;
    }
  }
  return paras;
};

// LAST RESORT, take two (golden-quotes-surprise-calibration pilot). The
// first attempt at breaking a coverage/phrase tie (a symmetric trigram
// cosine) broke a real adversarial case in the frozen surfer golden, because
// it is still a SURFACE signal — it rewards a candidate for merely LOOKING
// like the query, the same failure mode as coverage itself, just measured
// differently. This is a different kind of evidence: `engine/emergence/
// activation.js`'s Hebbian associative memory, already built and tested for
// a different question ("what does this new passage recall"), reused here
// for "which of these tied candidates does the query's OWN vocabulary
// actually co-occur with, across this corpus's real reading history" — not
// which one shares surface form, which one the corpus itself has actually
// wired together. No model: `activation.js`'s `embed` rerank stays
// unsupplied (`NO_EMBEDDER`), so only the causal, no-model half of that
// module is reused — the same posting/edges tables `perceiver/text/
// pronouns.js` already reuses for a different question, per that file's own
// invitation not to re-derive a second recall function.
//
// The corpus is read once, in byte order, as the SAME spans corpus.js's
// searchSpans already chunks the document into (2000 chars — no new framing
// notion invented), building the posting table and bounded Hebbian edges.
// The query is then asked as a single probe AFTER the whole book has been
// read — recall() naturally sees every real frame, because in reading order
// the query is the newest thing read. Built and cached once per document,
// on the session, never rebuilt per prompt.
const buildAssocState = (session, doc) => {
  session._assoc ??= new Map();
  const cached = session._assoc.get(doc.id);
  if (cached) return cached;

  const prefix = `${doc.id}:chunk-`;
  const spans = Array.from(session.spans.values())
    .filter((s) => s.source_id.startsWith(prefix))
    .sort((a, b) => a.byte_start - b.byte_start);

  const state = { df: new Map(), gramDf: new Map(), posting: new Map(), edges: new Map(), read: 0 };
  for (let order = 0; order < spans.length; order++) {
    const ws = assocTokens(spans[order].text);
    const { trace } = assocCodeOf(ws, state);
    assocEncodeFrame(state, order, ws, trace);
  }

  const built = { state, spans };
  session._assoc.set(doc.id, built);
  return built;
};

// THE HIGH TIER CALIBRATES; IT NEVER VOTES. A tier built from the same read
// that just produced a confidently-wrong candidate has no privileged
// position to overrule it from — that regress is already refuted twice in
// this repo (lemma abstraction, the ungated lone gift: a coarse signal given
// a voting role drowns better evidence in proportion to its own
// coarseness). What the high tier is allowed to do instead: set the low
// tier's own hyperparameters, never the low tier's answer. Only a mismatch
// between what the high tier expected and what the low tier actually
// witnessed climbs back up, as a residual, never a verdict.
//
// `engine/loops/reading-regime.js` already exists and is already measured
// for exactly this shape of question — not "which candidate is right" but
// "does the standard I'm currently holding candidates to still fit what I'm
// reading right now" — a self-referential alarm on activation.js's own
// `recalled` channel, confirmed (scripts/reading-regime-frankenstein.mjs) to
// fire at a real register shift with zero false alarms on ordinary prose.
// Reused here verbatim, at the SAME declared spec that script earned —
// not re-picked for this call site — over the SAME spans buildAssocState
// already reads the document as.
const READING_REGIME_SPEC = { channel: "recalled", window: 12, draws: 200, tolerance: 3, reseeds: 5, seed: 17, statistic: "burstiness", findOn: ["regularity"] };

const buildReadingRegimeState = (session, doc) => {
  session._regime ??= new Map();
  const cached = session._regime.get(doc.id);
  if (cached) return cached;

  const { spans } = buildAssocState(session, doc);
  const frames = spans.map((s, order) => ({ order, offset: s.byte_start, text: s.text }));
  const { records } = readingRegime(frames, READING_REGIME_SPEC);

  const built = { records, spans };
  session._regime.set(doc.id, built);
  return built;
};

// How many pushes since the tracker last re-zeroed at this position — 0
// means "right at a re-zero," `window` or more means "long stable." Used
// only to WIDEN the Born gate's own noise-floor sample (see contentAddress
// below), never to pick a winner: the regime tracker has no opinion about
// which candidate is right, only about whether the ground under all of them
// was just rebuilt.
const distanceSinceRezero = (session, doc, byteOffset) => {
  const { records, spans } = buildReadingRegimeState(session, doc);
  if (records.length === 0 || spans.length === 0) return Infinity;
  let lo = 0, hi = spans.length - 1, order = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (spans[mid].byte_start <= byteOffset) { order = mid; lo = mid + 1; } else hi = mid - 1;
  }
  let sinceRezero = order;
  for (let i = order; i >= 0; i--) {
    if (records[i]?.rezeroed) { sinceRezero = order - i; break; }
  }
  return sinceRezero;
};

// Random passages of the document, drawn without replacement, for widening
// the Born gate's noise-floor sample where the reading regime says the
// local ground is shaky — the SAME construction scripts/model-relevance.js
// uses for its own document-noise reference, reused here rather than a
// second, differently-written sampler.
const randomSpanScores = (spans, count, excludeOrders, weights, tokens, seed) => {
  const next = ((s) => { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(seed);
  const pool = spans.map((_, i) => i).filter((i) => !excludeOrders.has(i));
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const i = Math.floor(next() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  const totalW = tokens.reduce((s, t) => s + (weights.get(t) ?? 0), 0);
  return picked.map((i) => {
    const text = spans[i].text.toLowerCase();
    let matchedW = 0;
    for (const t of tokens) if (text.includes(t)) matchedW += weights.get(t) ?? 0;
    return totalW > 0 ? matchedW / totalW : 0;
  });
};

// Which of the tied candidates the query's words actually co-fire with, by
// mapping each candidate's anchor byte to the span it falls in and reading
// that span's activation off a single recall() probe. Returns null (not a
// guess) when the graph has no opinion — every candidate recalls the same,
// or nothing recalls at all — and the existing earliest-wins determinism
// stands as before.
export const assocTieBreak = (session, doc, prompt, tiedCandidates, idx) => {
  const { state, spans } = buildAssocState(session, doc);
  if (spans.length === 0) return null;

  const { cue } = assocCodeOf(assocTokens(prompt), state);
  if (cue.size === 0) return null;
  const activation = assocRecall(cue, state, { completion: 0.5, topEdges: 6, selfOrder: null });
  if (activation.size === 0) return null;

  const orderAt = (byteOffset) => {
    let lo = 0, hi = spans.length - 1, hit = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (spans[mid].byte_start <= byteOffset) { hit = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return hit;
  };

  let winner = null;
  let winnerScore = -1;
  for (const c of tiedCandidates) {
    const order = orderAt(idx.starts[c.anchorLine]);
    const score = activation.get(order) ?? 0;
    if (score > winnerScore + 1e-9) {
      winnerScore = score;
      winner = c;
    }
  }
  return winnerScore > 0 ? winner : null;
};

const contentAddress = (prompt, idx, session, doc, admissionWidth = null) => {
  const toks = tokenize(prompt);
  if (toks.length === 0) return null;

  // Rarity weights over THIS document's lines (the index the surfer already
  // paid for): weight = log(1 + N / (1 + df)). A stopword is nearly free, a
  // rare word decisive. df is over diacritic-normalized lines, so "Pávlovna"
  // and "Pavlovna" are one term.
  const lines = idx.lines.map((l) => diaNorm(l));
  const n = Math.max(1, lines.length);
  const df = new Map();
  for (const t of toks) {
    let d = 0;
    for (const line of lines) if (line.includes(t)) d++;
    df.set(t, d);
  }
  const weight = (t) => Math.log(1 + n / (1 + (df.get(t) ?? 0)));
  const weights = new Map(toks.map((t) => [t, weight(t)]));

  const queryGrams = nGramProfile(diaNorm(prompt));

  // Amendment (golden-quotes-surprise-calibration pilot, re-earned from
  // specs/mechanical-retrieval-theory.md's own finding that contiguous
  // surface-form match is the load-bearing signal, and this project's own
  // hand-check of Goodreads' non-verbatim quotes: a *distinctive contiguous
  // phrase* search found the passage 8/8 tried, where whole-quote bag-of-
  // words coverage did not). The previous phrase check compared a NAIVE
  // single-space join of query tokens against the raw candidate string —
  // real prose has punctuation between words ("Because of the self-
  // confidence, no one could tell..."), so `"self confidence no"` never
  // literally appears even when the words are genuinely contiguous. The fix
  // tokenizes the candidate the same way the query already is and matches
  // token ADJACENCY, immune to intervening punctuation — the same technique
  // corpus.js's searchSpans already uses (`contiguousPhrase`), now re-earned
  // here so the two content-retrieval paths agree on what "contiguous"
  // means.
  const contiguousRun = (queryToks, candToks) => {
    for (let len = queryToks.length; len >= 2; len--) {
      for (let s = 0; s + len <= queryToks.length; s++) {
        const win = queryToks.slice(s, s + len);
        outer: for (let i = 0; i + len <= candToks.length; i++) {
          for (let j = 0; j < len; j++) if (candToks[i + j] !== win[j]) continue outer;
          return len / queryToks.length;
        }
      }
    }
    return 0;
  };

  const scoreText = (text) => {
    let matchedW = 0;
    let totalW = 0;
    let matched = 0;
    for (const t of toks) {
      const w = weights.get(t);
      totalW += w;
      if (text.includes(t)) {
        matchedW += w;
        matched++;
      }
    }
    if (matched === 0) return null; // the evidence gate

    // Longest contiguous run of query tokens present in the text, by token
    // adjacency (not raw substring) — the strongest evidence short of an
    // exact span: when the reader's words appear in order and unbroken, the
    // text contains the thing asked for, and this is true regardless of the
    // punctuation between them.
    const phrase = contiguousRun(toks, tokenize(text));

    const coverage = totalW > 0 ? matchedW / totalW : 0;
    // Phrase dominates: a genuine multi-word contiguous match is far
    // stronger, more specific evidence of "this is the passage" than bag-of-
    // words coverage, which — measured directly against this golden's own
    // War-and-Peace test — false-positives on unrelated passages that merely
    // share the query's rarest individual words (e.g. "truth", "love",
    // "God" recur throughout a philosophical novel; a 6-word run of them in
    // order essentially never does by coincidence).
    return { coverage, phrase, lexical: phrase * 0.7 + coverage * 0.3 };
  };

  const shortlist = [];
  for (let i = 0; i < lines.length; i++) {
    const s = scoreText(lines[i]);
    if (s) shortlist.push({ anchorLine: i, text: lines[i], ...s });
  }
  for (const p of paragraphsOf(lines)) {
    const text = lines.slice(p.start, p.end + 1).join(" ");
    const s = scoreText(text);
    if (s) shortlist.push({ anchorLine: p.start, text, ...s });
  }
  if (shortlist.length === 0) return null;

  shortlist.sort((a, b) => b.lexical - a.lexical || a.anchorLine - b.anchorLine);
  const candidates = shortlist.slice(0, admissionWidth ?? CONTENT_SHORTLIST_CAP);

  let best = -1;
  let bestScore = 0;
  let bestMatch = null;
  const scored = [];
  for (const c of candidates) {
    const ngram = queryContainment(queryGrams, nGramProfile(c.text));
    const score = c.phrase * 0.7 + c.coverage * 0.2 + ngram * 0.1;
    scored.push({ c, score });
    // Only a clear margin flips the winner: the n-gram signal reorders
    // near-equals, but two candidates that each contain the query's phrase
    // are equal evidence, and the earlier one wins — determinism over noise.
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = c.anchorLine;
      bestMatch = { coverage: c.coverage, phrase: c.phrase, ngram, score };
    }
  }
  if (best === -1) return null;

  // LAST RESORT: only inside a genuine tie, and only when session/doc are
  // available to build the graph against — a caller without them (none in
  // this codebase today, but the signature stays optional rather than
  // required) gets exactly the prior behaviour.
  //
  // "Genuine tie" is decided by a licensed Born-null test, not a hand-set
  // margin (the pilot's own prior attempt — 0.03, then widened to 0.1 by
  // feel — was exactly the "handset margin" this project's growth rule
  // exists to refuse; the numbers moved because they were never derived).
  // `maxDeviation`/`resample` is ALREADY licensed and validated in this repo
  // for exactly this question — nul/index.js's LICENSED registry, earned by
  // scripts/verify-maxdeviation-candidate.mjs: a planted single-point
  // magnitude outlier, held out leave-one-out against the rest of its own
  // series, reads exceeds_witness/above; a matched non-outlier control reads
  // exceeds_witness/below (regularity). The winning candidate's score is the
  // held-out point; every other shortlisted candidate's score is the "rest"
  // it is tested against. `draws`, `window`, `seed` are the SAME declared
  // numbers that script earned this pair against — not re-picked here.
  if (session && doc) {
    let rest = scored.filter((s) => s.c.anchorLine !== best).map((s) => s.score);

    // THE CALIBRATION STEP: widen the noise-floor sample, never touch the
    // winner. `distanceSinceRezero` asks the reading-regime tracker (built
    // from activation.js's own `recalled` channel, the same measured seam
    // scripts/reading-regime-frankenstein.mjs earned) how long the ground
    // around the winning candidate has stood since it was last rebuilt. Near
    // a re-zero (within the tracker's own declared `window` — not a new
    // number), the local `rest` sample cannot be trusted as a fair noise
    // floor: the vocabulary itself is in transition right there. The fix is
    // not to distrust the WINNER — it is to distrust the SAMPLE, by mixing
    // in random passages from elsewhere in the document (the identical
    // construction scripts/model-relevance.js's noise band already uses)
    // in proportion to how recent the re-zero was. A stable region (at or
    // past `window` pushes since the last re-zero) adds nothing: this is
    // pure calibration, inert everywhere the ground already holds.
    const stability = distanceSinceRezero(session, doc, idx.starts[best]);
    const extra = Math.max(0, READING_REGIME_SPEC.window - stability);
    if (extra > 0) {
      const { spans } = buildAssocState(session, doc);
      let bestOrder = 0;
      for (let i = 0; i < spans.length; i++) if (spans[i].byte_start <= idx.starts[best]) bestOrder = i; else break;
      rest = rest.concat(randomSpanScores(spans, extra, new Set([bestOrder]), weights, toks, 11));
    }

    let signal = false;
    if (rest.length >= 2) {
      const g = nulGround({ material: rest, draws: 200, window: 2, perturbation: "resample", statistic: "maxDeviation", seed: 11 });
      if (!nulIsGap(g)) {
        const restSorted = [...rest].sort((a, b) => a - b);
        const mid = (rest.length - 1) / 2;
        const lo = Math.floor(mid);
        const median = restSorted[lo] + (restSorted[Math.ceil(mid)] - restSorted[lo]) * (mid - lo);
        const deviation = Math.abs(bestScore - median);
        const d = nulDifference(deviation, g);
        signal = nulIsGap(d) && d.gap === "exceeds_witness" && d.direction === "above";
      }
      // A construction gap (degenerate ground — every other candidate tied
      // at the same score, zero width) means the test cannot be run, not
      // that the winner is unconfirmed; `signal` stays false only in that
      // case because there is genuinely nothing to compare against, and the
      // conservative default (offer the last resort rather than assume) is
      // the same choice this file makes everywhere else a test can't run.
    }

    // Top-K exposure, not "everything within some distance": once the
    // Born-null test (not a margin) has said the winner is NOT a confirmed
    // outlier, the reasonable candidates to hand a last-resort caller are
    // simply the best few by the same mechanical score — no further
    // hand-set threshold decides which ones count as "in the running".
    const TOP_K = admissionWidth ?? 6;
    const tied = signal ? [] : [...scored].sort((a, b) => b.score - a.score).slice(0, TOP_K).map((s) => s.c);
    if (tied.length > 1) {
      // The graph is only consulted when the signal test itself had enough
      // material to run (rest.length >= 2, above). With too few candidates
      // there is no "rest" to test against, and the graph's own causal idf
      // has a measured recency bias on short documents (a word's SECOND
      // occurrence gets a higher stored weight than its first, because idf
      // grows with total frames read while df clamps to 1 for both):
      // a planted adversarial case in the frozen surfer golden
      // (`en-content-regression` — two near-identical sections, the correct
      // one occurring FIRST) flips to the WRONG, later section under this
      // bias when consulted with no statistical backing. Where the file's
      // own documented convention already exists for an exact tie ("the
      // earlier one wins — determinism over noise"), a graph with nothing
      // to test against should not override it.
      const winner = rest.length >= 2 ? assocTieBreak(session, doc, prompt, tied, idx) : null;
      if (winner && winner.anchorLine !== best) {
        best = winner.anchorLine;
        bestMatch = { ...bestMatch, resolvedBy: "assoc_graph_tiebreak" };
      }
      // The tied set is exposed REGARDLESS of whether the graph found a
      // winner: a real tie existed by the mechanical formula's own numbers,
      // and the graph's pick (or lack of one) is one more ground, not proof
      // the tie is resolved — SEED.md #6 again. `best`/`anchor` still land
      // on whatever the mechanical+graph pipeline settled on above, so every
      // existing caller gets EXACTLY the prior behaviour unchanged; a caller
      // that wants the last-resort model judgment (scripts/model-relevance.js
      // — a separate, async, opt-in module outside packages/, per
      // conformance/local-first-boundary.test.js) can see the real
      // alternatives and ask, rather than trust a pick it can't see was ever
      // in question.
      // The score distribution's own spread — not the tied set's, the WHOLE
      // admitted pool's (`scored`, everything within the current
      // admissionWidth) — so a caller deciding how much wider to search next
      // (wayfind, below) derives the step from what this document's scores
      // actually look like, never a fixed multiplier picked in advance.
      const allScores = scored.map((s) => s.score);
      const scoreMean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
      const scoreVariance = allScores.reduce((a, b) => a + (b - scoreMean) ** 2, 0) / allScores.length;
      bestMatch = {
        ...bestMatch,
        ambiguous: true,
        tiedCandidates: tied.map((c) => ({
          anchorLine: c.anchorLine,
          byte_start: idx.starts[c.anchorLine],
          text: c.text,
        })),
        scoreMean,
        scoreSD: Math.sqrt(scoreVariance),
        admittedCount: scored.length,
      };
    }
  }

  return { line: best, score: bestScore, anchor: idx.starts[best], addressed_by: "content", match: bestMatch };
};

// A returned segment this large cannot be "fed into a prompt without
// bloating" (the golden-quotes-surprise-calibration pilot's own standard for
// what surf must deliver) — a chapter can run tens of thousands of
// characters, and the reader asked for a passage, not a chapter. Chosen to
// comfortably hold a real multi-sentence quote and its immediate
// surroundings without approaching a token-budget problem for a caller that
// snips several results into one prompt.
const MAX_SEGMENT_CHARS = 2400;

// RESOLUTION — the anchor is located against the whole outline, not a
// radius-limited local window: the outline is the navigable index the surfer
// already paid for, and a chapter far longer than the local reach must still
// hold the passage it contains. An anchor before the first heading is the
// preamble, answered as a context window; a source with no structure at all
// misses and falls back to the raw reach. A chapter that DOES contain the
// anchor but is too large to hand back whole is trimmed to a window centred
// on the anchor, inside the chapter's own bounds — found is still true (the
// structure did resolve it), only the returned bytes are excerpted.
const resolveRange = (outline, anchor) => {
  const hs = outline.headings || [];
  if (hs.length === 0) return { miss: true };
  let lo = 0;
  let hi = hs.length - 1;
  let hit = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (hs[mid].start <= anchor) { hit = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  if (hit === -1) {
    return { window: { start: 0, end: hs[0].start, label: "(context window — no heading precedes this passage)" } };
  }
  const h = hs[hit];
  if (h.end - h.start > MAX_SEGMENT_CHARS) {
    const half = MAX_SEGMENT_CHARS >> 1;
    const from = Math.max(h.start, anchor - half);
    const to = Math.min(h.end, anchor + half);
    return {
      window: { start: from, end: to, label: `(excerpt from "${h.label}" — too large to return whole)` },
      truncated: true,
      h,
    };
  }
  return { h };
};

// The one entry point: execute a natural-language prompt against the session
// corpus and snip the segment it addresses. No model anywhere in the path.
export function executePrompt(session, prompt, { sourceFilter, radius, admissionWidth = null } = {}) {
  const text = String(prompt ?? "").trim();
  if (!text) return { gap: "empty_prompt", reason: "a prompt with no words addresses nothing" };

  let targets;
  let named = [];
  if (sourceFilter) {
    const hit = Array.from(session.documents.values()).find(
      (d) => d.id === sourceFilter || baseName(d.id).toLowerCase() === sourceFilter.toLowerCase(),
    );
    if (!hit) return { gap: "no_source", reason: `no document matches "${sourceFilter}"` };
    targets = [hit];
  } else {
    const resolved = resolveTargets(session, text);
    if (resolved.error) return { gap: resolved.error, reason: resolved.reason };
    targets = resolved.targets;
    named = resolved.named;
  }

  const results = targets.map((doc) =>
    addressDoc(session, scopeForTarget(text, doc, named), doc, { radius, admissionWidth }),
  );

  const operator = OPERATORS.SEG;
  if (results.length === 1) return { ...results[0], operator: operator.op, verb: operator.verb, prompt: text };

  // The fan: the act is aimed at every target at the height each one reached.
  // Each entry is a snip or a typed gap — a document the prompt could not
  // address is reported, never silently dropped.
  return {
    fan: results,
    operator: operator.op,
    verb: operator.verb,
    prompt: text,
    fan_to: results.length,
  };
}

// THE WAYFINDER — etak, one integrated act with the star compass (surf) and
// dead reckoning (climb), not a fourth instrument bolted on top. Both of
// those run on every call, cheap and checked constantly.
//
// NOT THREE PHASES — ONE FORK. contentAddress's Born-null gate is a single
// test (`nulDifference`, one call) with two mutually exclusive verdicts: EVA
// (confirmed — the ground holds, return the bearing, nothing follows) or DEF
// (refused — `content_match.ambiguous`). REC is not a third phase beside
// them; it is what only the DEF verdict does next: widen the admission pool
// (the SAME `admissionWidth` hyperparameter contentAddress already reads)
// and re-enter the identical gate at that width. This is the same
// domain/mode shape atmosphere.js runs at Interpretation·Ground — DEF/EVA/
// REC are one row of the operator grid's domain×mode table (engine/
// operators.js's OP_MODE/OP_DOMAIN), not a pipeline order; OPERATOR_ORDER's
// NUL→...→REC law governs a chain that crosses domains, which this loop
// never does.
//
// WAYFIND'S ONE DELIBERATE DIVERGENCE from atmosphere.js's own use of this
// shape: no `tolerance`. Atmosphere only concedes the ground after
// `clearings >= tolerance` consecutive DEF verdicts, because it is guarding
// a REAL, STILL-ARRIVING stream against re-zeroing on one blip — a second
// look later might vindicate the ground. Wayfind's material is already
// fully in hand at every width; there is no later frame to wait for, only a
// wider pool to ask for now. Porting `tolerance` in here would not be a
// missing safeguard — it would just waste rounds waiting for a second bad
// verdict that can't tell it anything the first one didn't.
//
// THE STEP SIZE IS DERIVED, NOT A FIXED MULTIPLIER. A flat doubling is the
// same "handset margin" this project's growth rule keeps having to refuse —
// it was never asked what THIS document's own scores actually look like.
// contentAddress already reports the admitted pool's mean and standard
// deviation (`content_match.scoreMean`/`scoreSD`) — the SAME distribution
// the Born-null gate itself is built from, not a second statistic invented
// for this purpose. The next width widens by the coefficient of variation
// (SD/mean): a tightly clustered pool (low relative spread — the sample
// already looks representative) widens gently; a pool with real spread
// (high relative spread — real structure may be sitting further down,
// unadmitted) widens more aggressively, in direct proportion to how much
// variability this document's own scores actually carry.
//
// THE HIGH TIER NEVER VOTES, HERE EITHER. Each round widens WHAT gets
// tested, never picks a winner directly — the winner is still whatever the
// same Born-null "signal" test (now also calibrated by the reading-regime
// noise-floor widening) confirms at that width, or it is not confirmed at
// all. wayfind's only decision is whether to keep widening or to stop, and
// stopping on a real confirmed signal is the SAME stopping rule every round
// uses, never "this looks like what I expected."
//
// VOID IS THE DEFAULT ANSWER, NOT A FAILURE MODE. A caller that widens
// `maxRounds` times and still gets no confirmed bearing is told exactly
// that (`wayfinder.void: true`), with the widest pool actually tried
// attached (`content_match.tiedCandidates`, from the last round) — never a
// guess dressed as a confirmation.
export function wayfind(session, prompt, { sourceFilter, radius, maxRounds = 3 } = {}) {
  let result = null;
  let width = null;
  for (let round = 0; round <= maxRounds; round++) {
    result = executePrompt(session, prompt, { sourceFilter, radius, admissionWidth: width });
    const match = result.content_match;
    const ambiguous = match?.ambiguous === true;
    if (!ambiguous) {
      return { ...result, wayfinder: { void: false, escalations: round, admissionWidth: width } };
    }
    const currentWidth = width ?? CONTENT_SHORTLIST_CAP;
    // Coefficient of variation of THIS round's admitted-pool scores — the
    // step is what the data says, not a fixed multiplier. Guarded: a
    // degenerate or unreported distribution (scoreMean <= 0, or an older/
    // gapped result with no scoreSD) falls back to the smallest defensible
    // step, one full width — never zero, which would loop forever, and
    // never invented from nothing.
    const cv = match?.scoreMean > 0 && Number.isFinite(match.scoreSD) ? match.scoreSD / match.scoreMean : 1;
    width = Math.ceil(currentWidth * (1 + Math.max(cv, 0.1)));
  }
  return { ...result, wayfinder: { void: true, escalations: maxRounds, admissionWidth: width } };
}

// Address the prompt inside one document: the whole ladder, one target.
const addressDoc = (session, text, doc, { radius, admissionWidth = null } = {}) => {
  const outline = sessionSegments(session, { sourceId: doc.id });
  if (outline.error) return { gap: "no_source", reason: outline.error };

  const addr = headingAddress(text, outline);
  if (addr?.error) return { gap: addr.error, reason: addr.reason };

  let anchor;
  let addressed_by;
  let content = null;
  if (addr) {
    anchor = addr.anchor;
    addressed_by = "heading";
  } else {
    content = contentAddress(text, outline.idx, session, doc, admissionWidth);
    if (!content) {
      return {
        gap: "content_not_found",
        reason: `no heading nor any line in ${baseName(doc.id)} matches "${text}"`,
      };
    }
    anchor = content.anchor;
    addressed_by = "content";
  }

  const range = resolveRange(outline, anchor);
  if (range.miss) {
    // No structure ANYWHERE in the source, per the outline — the navigable
    // index this organ already paid for. The fallback is a raw context window
    // around the anchor, honestly labelled — NEVER a local boundary pulled out
    // of the reach by form alone: the outline's substance gate already
    // refused it, and resurrecting it here would be the same listing-as-
    // structure false permanency the engine exists to refuse.
    const total = outline.idx?.total ?? 0;
    const r = Math.min(radius ?? 6000, Math.max(600, total >> 2));
    const from = Math.max(0, anchor - r);
    const to = Math.min(total, anchor + r);
    const snip = snipRange(session, {
      sourceId: doc.id,
      start: from,
      end: to,
      prompt: text,
      label: "(no structural boundary detected — context window)",
    });
    return {
      ...snip,
      source_id: doc.id,
      source: baseName(doc.id),
      gap: "no_structural_boundary_in_reach",
      reason: "the source's structure does not reach this passage — returned as a context window, not an invented chapter",
      addressed_by,
      heading: null,
      content_line: content?.line ?? null,
      content_match: content?.match ?? null,
      found: false,
      windowed: true,
      prompt: text,
    };
  }

  const r = range.window ?? range.h;
  const snip = snipRange(session, {
    sourceId: doc.id,
    start: r.start,
    end: r.end,
    prompt: text,
    label: r.label,
  });

  return {
    ...snip,
    source_id: doc.id,
    source: baseName(doc.id),
    addressed_by,
    heading: range.window ? (range.truncated ? range.h.label : null) : range.h.label,
    content_line: content?.line ?? null,
    content_match: content?.match ?? null,
    found: range.window ? Boolean(range.truncated) : true,
    windowed: Boolean(range.window),
    truncated: Boolean(range.truncated),
    prompt: text,
  };
}

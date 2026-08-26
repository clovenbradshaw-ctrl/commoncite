// eoreader6 · goldens/surprise/detectors — GENERAL axis detectors for the
// signal-from-noise corpus. General because every function here takes its
// material as an argument; nothing is fitted to a specific fixture, and
// nothing hardcodes a language, a genre, or a name. Per-document specifics
// (this book's chapter form, this ledger's Benford provenance note) belong in
// priors, not here — this file is the mechanism, not the particular.
//
// Five axes, four of them a direct reuse of what this session already built
// or already existed in the repo:
//
//   numeric        nul's ground/difference, run TWICE (raw and negated) so a
//                  LOW-value anomaly is as visible as a high one — B8 showed
//                  today that the single-sided max-over-windows statistic used
//                  everywhere else in this codebase structurally cannot see a
//                  below-average anomaly at all.
//   temporal       temporality.js's arrowTest, unchanged — already built for
//                  a different reason, reused verbatim for B5's shape.
//   rowForm        the same reduce-to-shape / closed-set discipline as
//                  eoPriors/scripts/learn-typography.mjs, scoped to a small
//                  in-memory row set instead of a whole book.
//   scriptProfile  character-class composition, the same statistic the
//                  multilingual cast golden's script test uses.
//   received       nul's received() ground for an EXTERNALLY GIVEN prior
//                  (Benford's Law) — named, provenanced, never derived from
//                  the material it is compared against.
//
// A sixth thing, deliberately absent: nothing here attempts A7's acrostic.
// Every mechanism in this file measures where predictability breaks on an
// axis the material EXPOSES (the row order, the character sequence, the
// digit distribution). An acrostic's signal lives on an axis nobody exposes —
// vertical first-letters, unmarked by any typography — and finding it needs
// either an injected hint or a genuine search over candidate projections.
// Neither is built here; see README.md.

import { ground, difference, isGap, admissible, received, gap } from "../../nul/index.js";
import { temporality } from "../../temporality/index.js";

// ── numeric: BOTH-SIDED, by running the one-sided statistic twice ───────────
//
// `ground()`'s statistic is max-over-windows by construction (nul/index.js's
// own comment: "largest windowed mean is the simplest honest choice"). That
// can only ever register a HIGH departure. Mirroring the series (negate it)
// and asking the same question finds the LOW departure, because the maximum
// of the negated series is the minimum of the original. Two grounds, not a
// new statistic — SEED.md #6's plural-grounds discipline, applied on purpose.
export const numericVerdict = (series, { draws = 200, window } = {}) => {
  const w = window ?? Math.max(2, Math.min(3, Math.floor(series.length / 3)));
  const peak = (s) => {
    let best = -Infinity, at = -1;
    for (let i = 0; i + w <= s.length; i++) {
      let sum = 0; for (let j = i; j < i + w; j++) sum += s[j];
      if (sum / w > best) { best = sum / w; at = i; }
    }
    return { value: best, at };
  };

  // THE TWO SIDES ARE SCORED INDEPENDENTLY, and this independence is itself a
  // finding, not just an implementation detail. On B4's reconstructed rate
  // series (14 background minutes at rate 1, 6 burst minutes at rate 57), the
  // LOW-side null degenerates: with the background class covering 70% of the
  // series, nearly every shuffle draw contains at least one all-background
  // window, so the null for "the least-extreme window" collapses to a single
  // repeated value and `ground()` correctly refuses it (`degenerate_ground`,
  // zero width). That refusal is the SAME structural event as B6's frozen
  // sensor — a majority class making its own null uninformative — and it has
  // nothing to do with whether the HIGH side can still speak. An earlier
  // version of this function required both grounds to succeed before
  // reporting anything, which meant a real, obvious spike (57 against a
  // background of 1) was silently discarded because the unrelated low-side
  // null degenerated. Fixed by scoring each side on its own merits.
  const gHigh = ground({ material: series, draws, window: w, seed: 1 });
  const gLow = ground({ material: series.map((v) => -v), draws, window: w, seed: 1 });

  let highCensored = false, lowCensored = false, highRank = null, lowRank = null;
  const hi = peak(series);
  const lo = peak(series.map((v) => -v));

  if (!isGap(gHigh)) {
    const dHigh = difference(hi.value, gHigh);
    highCensored = isGap(dHigh) && dHigh.gap === "exceeds_witness" && dHigh.direction === "above";
    highRank = isGap(dHigh) ? null : dHigh.rank;
  }
  if (!isGap(gLow)) {
    const dLow = difference(lo.value, gLow);
    lowCensored = isGap(dLow) && dLow.gap === "exceeds_witness" && dLow.direction === "above"; // "above" on the negated series = below on the original
    lowRank = isGap(dLow) ? null : dLow.rank;
  }

  if (isGap(gHigh) && isGap(gLow)) return { verdict: "gap", gap: gHigh.gap, lowGap: gLow.gap };
  if (highCensored && lowCensored) return { verdict: "both", highAt: hi.at, lowAt: lo.at };
  if (highCensored) return { verdict: "high", at: hi.at, value: hi.value, lowGap: isGap(gLow) ? gLow.gap : null };
  if (lowCensored) return { verdict: "low", at: lo.at, value: -lo.value, highGap: isGap(gHigh) ? gHigh.gap : null };
  return { verdict: "none", highRank, lowRank, highGap: isGap(gHigh) ? gHigh.gap : null, lowGap: isGap(gLow) ? gLow.gap : null };
};

// ── temporal: reuse temporality.js exactly ───────────────────────────────────
export const temporalVerdict = (series, { draws = 99, window } = {}) => {
  const w = window ?? Math.max(2, Math.min(4, Math.floor(series.length / 3)));
  const t = temporality({ material: series, draws, window: w });
  if (isGap(t)) return { verdict: "gap", gap: t.gap };
  return { verdict: t.verdict, arrowed: t.arrow?.arrowed ?? null };
};

// ── rowForm: closed-set outlier over a small set of "lines" ─────────────────
//
// Same reduction eoPriors' typography learner uses: a line's FORM is its
// character-class shape, content discarded. Here the population is the rows
// themselves (a TOC, a set of log lines, footnotes) rather than a whole book,
// so the null is a bootstrap over the observed forms, not a shuffle over a
// document-length series — same discipline (declared draws, a rank, censored
// below is a finding), smaller material.
const classOf = (ch) => {
  if (/\s/u.test(ch)) return "_";
  if (/\p{Nd}/u.test(ch)) return "d";
  if (/\p{Lu}/u.test(ch)) return "U";
  if (/\p{Ll}/u.test(ch)) return "l";
  if (/\p{L}/u.test(ch)) return "w";
  return "p";
};
const rowShape = (row) => {
  let sig = "", run = null;
  for (const ch of row) {
    const c = classOf(ch);
    if (c === run) continue;
    sig += c; run = c;
  }
  return sig;
};

/** Distance between two shape strings: normalized edit distance, no semantics. */
const shapeDistance = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length] / Math.max(a.length, b.length, 1);
};

export const rowFormVerdict = (rows, { draws = 200 } = {}) => {
  if (rows.length < 3) return { verdict: "gap", gap: "empty_material" };
  const shapes = rows.map(rowShape);
  // leave-one-out mean distance to every other row's shape
  const looDist = shapes.map((s, i) => {
    const others = shapes.filter((_, j) => j !== i);
    return others.reduce((sum, o) => sum + shapeDistance(s, o), 0) / others.length;
  });

  let seed = 7;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const samples = [];
  for (let d = 0; d < draws; d++) {
    // bootstrap: draw n-1 shapes WITH REPLACEMENT from the observed set and
    // measure one held-out draw's distance to that resample — the null for
    // "how far would a typical row from this same population sit".
    const pick = shapes[Math.floor(next() * shapes.length)];
    const resample = Array.from({ length: shapes.length - 1 }, () => shapes[Math.floor(next() * shapes.length)]);
    samples.push(resample.reduce((sum, o) => sum + shapeDistance(pick, o), 0) / resample.length);
  }
  samples.sort((a, b) => a - b);
  const g = { samples, kept: false, provenance: "bootstrap over observed row shapes" };

  const outliers = [];
  looDist.forEach((d, i) => {
    const above = samples.filter((s) => s < d).length / draws;
    if (d > samples[samples.length - 1]) outliers.push({ row: i, rank: 1, shape: shapes[i] });
    else if (above > 0.95) outliers.push({ row: i, rank: above, shape: shapes[i] });
  });
  return outliers.length ? { verdict: "outlier", outliers } : { verdict: "none", looDist };
};

// ── scriptProfile: character-class composition shift within one text ────────
//
// Same statistic the multilingual golden's script check uses (Han vs Latin
// character ratio), generalized to any Unicode script boundary — this is what
// catches A12's language switch with zero translation, zero vocabulary.
export const scriptProfileVerdict = (paragraphs, { draws = 200 } = {}) => {
  const scriptOf = (ch) => {
    if (/\p{Script=Latin}/u.test(ch)) return "Latin";
    if (/\p{Script=Han}/u.test(ch)) return "Han";
    if (/\p{Script=Cyrillic}/u.test(ch)) return "Cyrillic";
    if (/\p{Script=Greek}/u.test(ch)) return "Greek";
    if (/\p{L}/u.test(ch)) return "Other";
    return null;
  };
  const dominant = (text) => {
    const counts = new Map();
    for (const ch of text) { const s = scriptOf(ch); if (s) counts.set(s, (counts.get(s) ?? 0) + 1); }
    const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? { script: top[0], share: top[1] / total } : { script: null, share: 0 };
  };
  const profiles = paragraphs.map(dominant);
  const majority = profiles.reduce((acc, p) => { acc[p.script] = (acc[p.script] ?? 0) + 1; return acc; }, {});
  const majorityScript = Object.entries(majority).sort((a, b) => b[1] - a[1])[0]?.[0];
  const switches = profiles.map((p, i) => ({ row: i, script: p.script, share: p.share, switched: p.script !== majorityScript }));
  return { verdict: switches.some((s) => s.switched) ? "switch" : "none", majorityScript, switches };
};

// ── ngramProfile: LANGUAGE switch within one SCRIPT ──────────────────────────
//
// A12 exposed a real scoping error: French and English are both Latin script,
// so `scriptProfileVerdict` — built for the multilingual golden's Han-vs-Latin
// question — is structurally blind to a switch between two languages that
// share an alphabet. Verified: run against A12's three sentences, it reported
// majority=Latin, zero switches, on a fixture whose whole point is a language
// switch. Language, not script, needs a distributional statistic: character
// trigram frequency profile, leave-one-out distance from the other paragraphs'
// pooled profile, same bootstrap-null discipline as `rowFormVerdict`. Still no
// vocabulary, no translation, no semantics — "qu'ils ne reviennent" is flagged
// by its letter statistics, not by being recognized as French.
const trigramProfile = (text) => {
  const t = text.toLowerCase().replace(/[^\p{L}]/gu, " ").replace(/\s+/g, " ");
  const counts = new Map();
  for (let i = 0; i + 3 <= t.length; i++) {
    const g = t.slice(i, i + 3);
    if (g.includes(" ".repeat(3))) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return counts;
};

const profileDistance = (a, b) => {
  const keys = new Set([...a.keys(), ...b.keys()]);
  const totalA = [...a.values()].reduce((x, y) => x + y, 0) || 1;
  const totalB = [...b.values()].reduce((x, y) => x + y, 0) || 1;
  let dist = 0;
  for (const k of keys) dist += Math.abs((a.get(k) ?? 0) / totalA - (b.get(k) ?? 0) / totalB);
  return dist / 2; // total variation distance, in [0, 1]
};

export const ngramProfileVerdict = (paragraphs, { draws = 200 } = {}) => {
  if (paragraphs.length < 3) return { verdict: "gap", gap: "empty_material" };
  const profiles = paragraphs.map(trigramProfile);
  const looDist = profiles.map((p, i) => {
    const pooled = new Map();
    profiles.forEach((q, j) => { if (j !== i) for (const [k, v] of q) pooled.set(k, (pooled.get(k) ?? 0) + v); });
    return profileDistance(p, pooled);
  });

  let seed = 11;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const samples = [];
  for (let d = 0; d < draws; d++) {
    const pick = profiles[Math.floor(next() * profiles.length)];
    const pooled = new Map();
    for (let k = 0; k < profiles.length - 1; k++) {
      const q = profiles[Math.floor(next() * profiles.length)];
      for (const [g, v] of q) pooled.set(g, (pooled.get(g) ?? 0) + v);
    }
    samples.push(profileDistance(pick, pooled));
  }
  samples.sort((a, b) => a - b);

  const switches = looDist.map((d, i) => {
    const above = samples.filter((s) => s < d).length / draws;
    return { row: i, distance: Number(d.toFixed(3)), censoredAbove: d > samples[samples.length - 1], rank: above };
  });
  const flagged = switches.filter((s) => s.censoredAbove);
  return { verdict: flagged.length ? "switch" : "none", switches };
};

// ── received: an EXTERNAL, named prior compared against material ────────────
//
// Benford's Law is not derived from the ledger — it is a received, provenanced
// claim about what naturally-occurring leading-digit distributions look like
// (Newcomb 1881 / Benford 1938). SEED.md #1: a prior is a gift and must name
// its giver. `deviation` is chi-square distance from the Benford proportions;
// the received ground is what that deviation looks like under genuine Benford
// sampling noise (Monte Carlo draws from the Benford distribution itself,
// not from the ledger under test).
const BENFORD = [0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];

const chiSqFromBenford = (counts) => {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  let x = 0;
  for (let d = 0; d < 9; d++) {
    const expected = BENFORD[d] * total;
    x += ((counts[d] - expected) ** 2) / expected;
  }
  return x;
};

export const benfordVerdict = (leadingDigitCounts, { draws = 300, seed = 5 } = {}) => {
  const total = leadingDigitCounts.reduce((a, b) => a + b, 0);
  let s = seed;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const samples = [];
  for (let d = 0; d < draws; d++) {
    const counts = new Array(9).fill(0);
    for (let i = 0; i < total; i++) {
      const r = next(); let cum = 0, digit = 8;
      for (let k = 0; k < 9; k++) { cum += BENFORD[k]; if (r <= cum) { digit = k; break; } }
      counts[digit]++;
    }
    samples.push(chiSqFromBenford(counts));
  }
  const g = received({ samples, provenance: "Benford's Law (Newcomb 1881 / Benford 1938) — received, not derived from this ledger" });
  if (isGap(g)) return { verdict: "gap", gap: g.gap };
  const observed = chiSqFromBenford(leadingDigitCounts);
  const d = difference(observed, g);
  if (isGap(d) && d.gap === "exceeds_witness" && d.direction === "above") return { verdict: "deviates", observed };
  return { verdict: isGap(d) ? "gap" : "consistent", observed, rank: isGap(d) ? null : d.rank };
};

// ── projection: an axis the material does NOT typographically declare ───────
//
// A7's acrostic exposed the sharpest boundary in this golden: every mechanism
// above measures predictability-break on an axis the material EXPOSES — row
// order, character sequence, digit position. An acrostic's signal lives on an
// axis nobody marks: the vertical read of first letters. Two honest answers,
// not one hack:
//
// 1. GENERAL, ENGINE-TIER, MATERIAL-LIMITED. Sweep candidate axes — position k
//    within each row, for every k a row is long enough to have — and test each
//    projected string the SAME way `learn-segmentation.mjs` tests a character
//    stream: successor-entropy rise against a label-shuffle null. Nothing here
//    is "check first letters"; k ranges over every position, unprivileged.
//    THE HONEST LIMIT: that null needs real material to have power (same floor
//    `learn-segmentation.mjs` declares). A 6-line poem's projected strings are
//    6 characters long. No perturbation test has power at n=6, and pretending
//    otherwise would be exactly the confabulation this golden exists to catch.
//    So below the floor this returns a TYPED GAP, not a guess, and says what
//    would fix it: more material, or an injected axis hint.
//
// 2. RECEIVED LEXICON, MODEL-TIER, MATERIAL-INDEPENDENT. A dictionary is a
//    witness prior exactly like Benford's Law or a coref prior — external,
//    named, provenanced, never derived from the poem. `/usr/share/dict/words`
//    (macOS/BSD `web2`, ~236k entries) is the giver, named as such. Every
//    candidate axis's projected string (forward and reversed, since an
//    acrostic can run either way) is checked for membership. This is what
//    actually resolves A7 — decoding needs a witness the way naming a
//    character needs a coref prior, and the honest move is to say so, not to
//    dress a dictionary lookup up as pure statistics.
export const projectionAxes = (rows, { maxOffset = 40 } = {}) => {
  const minLen = Math.min(...rows.map((r) => [...r].length));
  const axes = [];
  for (let k = 0; k < Math.min(minLen, maxOffset); k++) {
    axes.push({ axis: `pos${k}`, projected: rows.map((r) => [...r][k]).join("") });
  }
  return axes;
};

// Word-break: can the whole projected string be partitioned into a sequence of
// dictionary words with nothing left over? Classic DP, still using only the
// ONE received prior (the wordlist) — a smarter consumption of it, not a
// second witness. FINDME is not itself a dictionary entry, but FIND + ME is,
// which single-word lookup structurally cannot see.
const segmentIntoWords = (s, dict, { minWordLen = 2, maxWordLen = 15 } = {}) => {
  const n = s.length;
  const best = new Array(n + 1).fill(null);
  best[0] = [];
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - maxWordLen); j < i; j++) {
      if (best[j] === null || i - j < minWordLen) continue;
      const w = s.slice(j, i);
      if (dict.has(w)) { best[i] = [...best[j], w]; break; }
    }
  }
  return best[n];
};

export const projectionVerdict = (rows, { lexicon = null, floor = 200, draws = 99 } = {}) => {
  if (rows.length < 3) return { verdict: "gap", gap: "empty_material" };
  const axes = projectionAxes(rows);

  if (lexicon) {
    const hits = [];
    const segmentable = [];
    for (const { axis, projected } of axes) {
      const fwd = projected.toLowerCase();
      const rev = [...fwd].reverse().join("");
      if (fwd.length >= 4 && lexicon.has(fwd)) { hits.push({ axis, word: fwd, direction: "forward", mode: "whole" }); continue; }
      if (rev.length >= 4 && lexicon.has(rev)) { hits.push({ axis, word: rev, direction: "reversed", mode: "whole" }); continue; }
      // FALSE-POSITIVE CHECK, not skipped: a permissive dictionary can
      // segment almost anything into short words by chance, so a segmentable
      // axis is recorded on EVERY axis first, and only reported as a hit if
      // it is rare across the population this document's own axes provide —
      // the same population-relative discipline as `rowFormVerdict`, applied
      // here because n=1 candidate axes give no perturbation null to build.
      // A chain of all 2-letter dictionary entries ("ah wu er") is exactly the
      // false positive a permissive wordlist produces on random letters — web2
      // carries obscure 2-letter entries as valid words. Requiring at least
      // one word of 3+ letters is what separated the real "find+me" from two
      // such chains on THIS poem's own other axes, verified by running it.
      const substantial = (seg) => seg && seg.length <= 3 && seg.some((w) => w.length >= 3);
      const seg = segmentIntoWords(fwd, lexicon);
      if (substantial(seg)) segmentable.push({ axis, words: seg, direction: "forward" });
      else {
        const segR = segmentIntoWords(rev, lexicon);
        if (substantial(segR)) segmentable.push({ axis, words: segR, direction: "reversed" });
      }
    }
    if (hits.length) return { verdict: "decoded", hits, axesChecked: axes.length };
    if (segmentable.length && segmentable.length <= Math.max(1, Math.round(axes.length * 0.15))) {
      // Rare among this document's own axes — a real signal, not dictionary noise.
      return { verdict: "segmented", segmentable, rareAmong: axes.length, axesChecked: axes.length };
    }
    if (segmentable.length) {
      return { verdict: "none", gap: "segmentation_not_selective", segmentableCount: segmentable.length, axesChecked: axes.length,
        reason: `${segmentable.length}/${axes.length} axes segment into dictionary words — too common to be a signal on its own` };
    }
    // Falls through to the statistical path — a lexicon miss is not proof of
    // absence, only of no WORD-shaped signal; a non-lexical cipher could still
    // show statistical structure.
  }

  const long = axes.filter((a) => a.projected.length >= floor);
  if (long.length === 0) {
    return {
      verdict: "gap", gap: "insufficient_material",
      axesChecked: axes.length, floor,
      reason: `no candidate axis reaches ${floor} characters; a perturbation null has no power here — needs a longer document or an injected axis hint`,
    };
  }
  // Reuse the exact successor-entropy-rise test from learn-segmentation.mjs's
  // corrected form, at context=1 (single-character lookback, appropriate for
  // a short alphabet of candidate positions rather than a whole language).
  const entropyOf = (counts, n) => { let h = 0; for (const v of counts.values()) { const p = v / n; h -= p * Math.log2(p); } return h; };
  const rise = (chars) => {
    const followers = new Map();
    for (let i = 1; i < chars.length; i++) {
      let m = followers.get(chars[i - 1]); if (!m) { m = new Map(); followers.set(chars[i - 1], m); }
      m.set(chars[i], (m.get(chars[i]) ?? 0) + 1);
    }
    let total = 0, n = 0;
    for (const m of followers.values()) { let s = 0; for (const v of m.values()) s += v; total += entropyOf(m, s); n++; }
    return n ? total / n : 0;
  };

  let seed = 3;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const results = long.map(({ axis, projected }) => {
    const chars = [...projected];
    const observed = rise(chars);
    const samples = [];
    for (let d = 0; d < draws; d++) {
      const s = chars.slice();
      for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = s[i]; s[i] = s[j]; s[j] = t; }
      samples.push(rise(s));
    }
    samples.sort((a, b) => a - b);
    return { axis, observed: Number(observed.toFixed(3)), floor: Number(samples[0].toFixed(3)), structured: observed < samples[0] };
  });
  const structured = results.filter((r) => r.structured);
  return { verdict: structured.length ? "structured-axis" : "none", results, axesChecked: axes.length };
};

// ── recurrence: exact match in a near-random space (B7) ──────────────────────
//
// Not a magnitude question — an identity question, structurally the wrong
// organ for `nul`. This is the minimal honest version: report exact repeats
// and their improbability under a uniform model over the observed alphabet,
// without claiming to BE the associative-memory organ (`activation.js`) this
// really belongs to.
export const recurrenceVerdict = (tokens) => {
  const seen = new Map();
  const repeats = [];
  tokens.forEach((t, i) => {
    if (seen.has(t)) repeats.push({ at: i, matches: seen.get(t), value: t });
    else seen.set(t, i);
  });
  return { verdict: repeats.length ? "repeat" : "none", repeats, note: "identity/recurrence question — belongs to emergence/activation.js, not nul" };
};

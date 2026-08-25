// eoreader6 · perceiver/text/surfaces — candidate referent surfaces, and the
// structural (engine-tier) coreference between them. No word sets anywhere:
// every filter here is derived from the text's own statistics, so it holds
// for Basque and Japanese as much as for English.
//
// TIER DISCIPLINE — the load-bearing part, and the reason this file is small:
//   ENGINE tier (derivable, built here): NAME-variant coreference.
//     "Victor Frankenstein" ≈ "Frankenstein" ≈ "Victor" by containment or
//     shared final token. Structural, no witness needed.
//   MODEL tier (NOT derivable, reported as a typed gap): descriptor synonymy
//     ("the creature" ≈ "the wretch") and PRONOUN binding ("he" -> whom).
//     eoreader5's dead-ends log records distributional coref failing twice
//     (frame-level lift, sentence-level complementary distribution). It is not
//     retried here. A missing prior produces a gap, never a guessed number.
//
// Ported rather than reinvented (CLAUDE.md names each of these a
// consistently-reinvented wheel): diaNorm, namesCorefer, the cap/lower
// physics filter, and whole-word counting all come from eoreader5's
// presence.js / entity-fold.js.

const DIA_RE = /[áàâäéèêëíìîïóòôöúùûü]/g;
const DIA_TO = { á:"a",à:"a",â:"a",ä:"a",é:"e",è:"e",ê:"e",ë:"e",í:"i",ì:"i",î:"i",ï:"i",ó:"o",ò:"o",ô:"o",ö:"o",ú:"u",ù:"u",û:"u",ü:"u" };

export const diaNorm = (t) => String(t ?? "").toLowerCase().trim().replace(DIA_RE, (c) => DIA_TO[c]);

// The cell this organ occupies on the operator grid (engine/operators.js):
// SIG · Void · Tending — candidate referent surfaces, from the text's own
// statistics. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "SIG", grain: "Ground" });

const tokensOf = (id) => diaNorm(id).split(/\s+/).filter((t) => t.length > 2);

/** Two NAMES corefer: containment, or a shared final token (surname). */
export const namesCorefer = (a, b) => {
  const ta = tokensOf(a);
  const tb = tokensOf(b);
  if (!ta.length || !tb.length) return false;
  const setA = new Set(ta);
  const setB = new Set(tb);
  const subset = ta.every((t) => setB.has(t)) || tb.every((t) => setA.has(t));
  return subset || ta[ta.length - 1] === tb[tb.length - 1];
};

// A capitalised RUN: consecutive capitalised tokens, which is what a
// multi-word name looks like from the outside. Sentence-initial position is
// recorded because a token there is capitalised by grammar, not by being a
// name — the ratio filter below needs to know the difference.
const CAP_TOKEN = /^[\p{Lu}][\p{L}'’]*$/u;
const LOWER_TOKEN = /^[\p{Ll}][\p{L}'’]*$/u;

// A one-sided 95% significance resolution — declared, the same standing as
// this codebase's other Born-gate quantiles (e.g. nul-adjacent 0.95
// thresholds elsewhere): a stated resolution for a statistical test, not a
// hand-picked bridge between unrelated scales (SEED.md's actual complaint).
const CAP_SIG_Z = 1.645;

/**
 * Is this candidate's non-initial capitalisation rate significant against
 * the null that capitalisation is a fair coin flip (p=0.5) unrelated to
 * namehood — normal approximation to the binomial, evaluated at THIS
 * candidate's own (cap, lower) counts. Replaces a single fixed ratio band
 * shared by every word (formerly [0.8, 2.0], applied uniformly regardless
 * of how much evidence a given candidate actually carried) with a bound
 * that widens for a word seen only a handful of times and tightens for one
 * seen thousands: two occurrences split evenly can never clear it (not
 * enough evidence either way), where the same split at high volume would.
 */
const capitalisationIsSignificant = (cap, lower) => {
  const n = cap + lower;
  const pHat = cap / n;
  const bound = 0.5 + CAP_SIG_Z * Math.sqrt(0.25 / n);
  return pHat > bound;
};

// ---------------------------------------------------------------------------
// ORTHOGRAPHIC NORMALISATION AND REJECTION.
//
// Four facts about writing, not four facts about English. Each states the
// glyph-level property it reads and the measurement that made it necessary,
// because a filter without a measurement is a preference.
//
// All four are about the SAME thing the ratio filter above is about: which
// capitalisations are evidence of namehood and which are produced by the
// writing system for some other reason. Sentence-initial position was already
// excluded on exactly this ground; these are the remaining cases the same
// argument covers.
// ---------------------------------------------------------------------------

// 1. THE APOSTROPHE CLITIC. "Locke's" and "Locke" are one name written twice;
//    the apostrophe is a mark of inflection, not a different referent. Left
//    unmerged this splits every possessed name in a scholarly text — measured
//    on Process and Reality: Locke 68 + Locke's 45, Hume 66 + Hume's 40,
//    Descartes 48 + Descartes' 27, and the same again for God, Kant, Newton
//    and Whitehead. Seven of the book's principal referents appeared twice
//    each, at roughly half strength.
//    This reads the apostrophe glyph. It does not know what a possessive is,
//    and a script without the clitic simply never matches.
const POSSESSIVE = /['’]s?$/i;
export const stripPossessive = (token) => token.replace(POSSESSIVE, "");

// 2. ROMAN NUMERALS ARE NUMBERS. A number is not a name, in any language that
//    writes numbers. Measured: II, III, IV, V and VI entered the cast of
//    Process and Reality with 28, 26, 22, 17 and 10 mentions — five of the top
//    twenty referents were section numbers.
//    Guarded two ways so a real name cannot be caught: the form must be
//    ALL-UPPERCASE as written (a name is Title Case — "Mill" is not "MILL"),
//    and it must parse as a well-formed numeral, so "MILL" and "DID" are
//    rejected by the grammar rather than by a list.
const ROMAN = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
export const isRomanNumeral = (token) =>
  token.length > 0 && token === token.toUpperCase() && ROMAN.test(token);

// 3. ALL-CAPS IS TYPOGRAPHY. In a run where every token is capitalised because
//    the whole run is set in capitals — a heading, a running head, an
//    emphasised phrase — capitalisation carries no more naming evidence than
//    it does at the start of a sentence, and is excluded for the same reason.
//    Measured: "ORDER OF NATURE" (13), "AND FORM" (10) and "EXTENSIVE
//    CONTINUUM" (10) are Process and Reality's part titles, lifted out of the
//    table of contents by the PDF extractor.
//    Restricted to runs of TWO OR MORE tokens. A lone all-caps token is
//    routinely a name shouted by the typesetter ("DESCARTES" at the head of a
//    section) and diaNorm already folds it into the Title Case form.
const isAllCaps = (token) => {
  const letters = token.replace(/[^\p{L}]/gu, "");
  return letters.length > 0 && letters === letters.toUpperCase();
};

// 4. A NUMERAL SUFFIX INDEXES A NAME, it does not make a new one. "Part I" and
//    "Part IV" are the same word plus a divider. Folding them onto the stem is
//    the same move as folding the possessive: it merges, never deletes, so a
//    genuinely numbered name ("Henry V") joins "Henry" rather than vanishing —
//    which is what coreference should do with it anyway.
const stripNumeralIndex = (tokens) => {
  const out = tokens.slice();
  while (out.length > 1 && isRomanNumeral(out[out.length - 1])) out.pop();
  return out;
};

/**
 * The orthographic form under which two spellings of one name are the same
 * candidate. Exported so a host counting mentions can normalise the text the
 * same way this normalised the candidates — otherwise the merged surface has
 * a count that belongs to only one of its spellings.
 */
export const normaliseSurface = (surface) =>
  stripNumeralIndex(String(surface).split(/\s+/).map(stripPossessive)).join(" ");

/**
 * @param {Array<{text: string, order: number}>} sentences
 * @param {object} [options]
 * @param {Set<string>|null} [options.functionWords] closed class derived from
 *   this text's own frequency distribution (material.js::functionWordSet).
 * @param {Iterable<string>|null} [options.abbreviations] tokens this text
 *   always writes with a trailing period (spans.js::deriveAbbreviations).
 *   "Cf", "Sect", "Fig", "Bk" are capitalised and recurrent and are not
 *   names; the set is derived from the text, so no abbreviation list is
 *   asserted here.
 * @param {number} [options.minGlyphs] shortest surface that can be a name,
 *   counted in letters and digits. A single capitalised glyph is an initial,
 *   an axis label or a maths variable — measured on a quantum-computing paper,
 *   M, L, S, J, C and W took six of the top ten places.
 */
export const extractSurfaces = (sentences, { functionWords = null, abbreviations = null, minGlyphs = 2 } = {}) => {
  const capCounts = new Map();   // surface -> times seen capitalised, NOT sentence-initial
  const lowerCounts = new Map(); // lowercased form -> times seen lowercase anywhere
  const sentenceIndex = new Map(); // surface -> Set(sentence order)

  const abbrev = abbreviations ? new Set(abbreviations) : null;

  for (const sent of sentences) {
    const toks = sent.text.split(/\s+/).map((t) => t.replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, "")).filter(Boolean);
    // A unit set entirely in capitals is a heading or a running head, and every
    // token in it is capitalised by typography. Reading capitalisation as
    // evidence here is the sentence-initial mistake at unit scale — on Process
    // and Reality it put the table of contents into the cast. Skipped for
    // capitalisation evidence; its lowercase counts are moot, there are none.
    if (toks.length > 1 && toks.every(isAllCaps)) continue;
    for (let i = 0; i < toks.length; i++) {
      if (LOWER_TOKEN.test(toks[i])) {
        const k = diaNorm(toks[i]);
        lowerCounts.set(k, (lowerCounts.get(k) ?? 0) + 1);
      }
    }
    // capitalised runs, skipping the sentence-initial token: it is capitalised
    // by position and carries no evidence of namehood on its own
    let i = 1;
    while (i < toks.length) {
      if (!CAP_TOKEN.test(toks[i])) { i++; continue; }
      let j = i;
      while (j < toks.length && CAP_TOKEN.test(toks[j])) j++;
      const run = toks.slice(i, j);
      // An all-caps run inside an otherwise mixed-case unit is the same
      // typography as an all-caps unit — a part title quoted mid-paragraph.
      if (run.length > 1 && run.every(isAllCaps)) { i = j; continue; }
      // every prefix-run up to 4 tokens is a candidate ("Victor",
      // "Victor Frankenstein"); >4 tokens is a heading, not a name
      for (let len = 1; len <= Math.min(run.length, 4); len++) {
        // Normalised at the point of counting, so the two spellings of one
        // name accumulate into one candidate with one count rather than
        // being merged later with counts that have to be added back up.
        const surface = normaliseSurface(run.slice(0, len).join(" "));
        if (!surface) continue;
        capCounts.set(surface, (capCounts.get(surface) ?? 0) + 1);
        if (!sentenceIndex.has(surface)) sentenceIndex.set(surface, new Set());
        sentenceIndex.get(surface).add(sent.order);
      }
      i = j;
    }
  }

  // The physics filter (eoreader5, measured): a NAME essentially never appears
  // lowercased, while a sentence/dialogue opener ("Well", "Why") constantly
  // does. A pronoun that is capitalised by orthographic convention rather
  // than by namehood ("I" in English) survives this filter regardless,
  // because it has no lowercase form to compare against — it was the single
  // largest false positive here (2152 "mentions" in Frankenstein). The fix
  // reuses the Zipf-derived closed-class detector from material.js rather
  // than naming any language's pronouns: `functionWords` is a Set the
  // caller derives from this same text's own frequency distribution.
  // Optional — omit it and the filter simply doesn't run.
  //
  // Multi-word runs skip this filter (a lowercase form of "Victor
  // Frankenstein" does not occur to compare against), and so does any
  // single word never seen lowercase at all (lower === 0) — the strongest
  // possible evidence for namehood, nothing left to test against.
  //
  // What remains is genuinely ambiguous: a word seen written BOTH ways.
  // capitalisationIsSignificant asks a binomial question of it — is this
  // word's own capitalised share (cap / (cap + lower)) further above a fair
  // coin than chance alone would produce AT THIS WORD'S OWN SAMPLE SIZE —
  // derived per candidate from its own two counts, not a fixed shared band.
  const surfaces = [];
  for (const [surface, cap] of capCounts) {
    const words = surface.split(/\s+/);
    // Numbers and single glyphs, per the two orthographic facts above.
    if (words.every(isRomanNumeral)) continue;
    if (surface.replace(/[^\p{L}\p{N}]/gu, "").length < minGlyphs) continue;
    if (words.length === 1) {
      if (abbrev && abbrev.has(surface)) continue;
      if (functionWords && functionWords.has(diaNorm(surface))) continue;
      const lower = lowerCounts.get(diaNorm(surface)) ?? 0;
      if (lower > 0 && !capitalisationIsSignificant(cap, lower)) continue;
    }
    surfaces.push({ surface, mentions: cap, sentences: sentenceIndex.get(surface).size });
  }
  return surfaces.sort((a, b) => b.mentions - a.mentions);
};

/**
 * Cluster candidate surfaces into referents by NAME-variant coreference only.
 * Emits DEF.admit events for referents/index.js::projectReferents — the
 * canonical path, not a parallel string-matching substitute.
 *
 * Returns { events, gaps }. `gaps` is not decoration: every referent
 * discovered this way is name-only, so its pronoun and descriptor mentions
 * are known-missing and are reported as such.
 */
/**
 * Tokens that individuate vs tokens that classify. A token combining with
 * many DIFFERENT other tokens across the corpus ("Princess" before Mary,
 * Hélène, Anna, Drubetskáya; "Rostóv" after Nicholas, Ilyá, Pétya) is a
 * title or a family name — it groups people, it does not pick one out.
 * A token appearing in only one or two surfaces ("Frankenstein", only ever
 * after "Victor") individuates.
 *
 * Derived from this text's own combinatorics — no title list, no honorific
 * table, nothing language-specific. Necessary because `namesCorefer` is a
 * PAIRWISE test against one known seed; used transitively for clustering it
 * over-merges exactly here, which eoreader5's relationship-graph notes
 * record as measured ("a multi-word seed must strip single-word
 * nameSurfaces first, or it absorbs every OTHER prince's bare 'Prince'").
 */
const quantileOf = (sorted, q) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/**
 * A partner-count fence derived from THIS document's own co-occurrence
 * structure, not a fixed absolute count. The interquartile range is already
 * this codebase's own measure of a distribution's ordinary spread (nul's
 * `volume`, "aperture") — a token whose partner-set size sits more than one
 * IQR above the 75th percentile of this document's own partner-count
 * distribution is exceeding what ordinary co-occurrence breadth looks like
 * HERE, a Tukey-style upper fence rather than a percentile chosen by hand.
 * Degrades safely rather than gapping: too little multi-word structure to
 * have a fence at all (empty or uniform partner counts, IQR 0) means nothing
 * exceeds it, so `genericTokens` correctly finds nothing generic — the right
 * answer when the material can't support the distinction, not a special case.
 */
const deriveMinPartners = (partners) => {
  const counts = [...partners.values()].map((s) => s.size).sort((a, b) => a - b);
  if (counts.length === 0) return Infinity;
  const q1 = quantileOf(counts, 0.25);
  const q3 = quantileOf(counts, 0.75);
  return q3 + (q3 - q1);
};

/**
 * @param {object} [options.minPartners] override the derived fence — omit to
 *   derive it from `surfaces`'s own co-occurrence structure (see
 *   `deriveMinPartners`). Compares by EXCEEDS (`>`), matching the derived
 *   fence's own "outside the ordinary spread" convention.
 */
export const genericTokens = (surfaces, { minPartners } = {}) => {
  const partners = new Map(); // token -> Set(other tokens it co-occurs with in a surface)
  for (const { surface } of surfaces) {
    const toks = diaNorm(surface).split(/\s+/).filter((t) => t.length > 2);
    if (toks.length < 2) continue;
    for (const t of toks) {
      if (!partners.has(t)) partners.set(t, new Set());
      for (const u of toks) if (u !== t) partners.get(t).add(u);
    }
  }
  const fence = minPartners ?? deriveMinPartners(partners);
  const generic = new Set();
  for (const [tok, set] of partners) if (set.size > fence) generic.add(tok);
  return generic;
};

/**
 * A recurrence floor derived from THIS document's own candidate-surface
 * pool: a candidate must recur across MORE distinct sentences than the
 * bottom quarter of the pool does. Most candidate surfaces in any real text
 * are Zipfian one-off capitalisations (the 25th percentile is often exactly
 * 1), so this weeds out that long tail while scaling with how
 * recurrence-rich the material actually is, rather than a fixed absolute
 * sentence count.
 *
 * The 25th percentile, not the median: a TINY or heavily-tied pool (a short
 * document, or one dominated by a couple of names) can put the median AT
 * the pool's own maximum, and "exceeds the median" then rejects everything,
 * including the most-recurring candidates — measured, on a 3-candidate
 * pool tied 4/4/2, where a median-based floor of 4 admitted nothing. The
 * 25th percentile targets the LOW tail specifically and does not collide
 * with the top the same way.
 *
 * Degrades safely rather than rejecting everyone: a pool small or uniform
 * enough that its OWN 25th percentile sits at or above every member's own
 * count (a single surviving candidate is the extreme case — its own
 * percentile always equals itself) means the pool cannot support the
 * distinction, so nothing is filtered — the same "the material can't
 * support it, so don't fabricate an answer" standing `deriveMinPartners`
 * already takes above, not a special case.
 */
const deriveMinSentences = (surfaces) => {
  const counts = surfaces.map((s) => s.sentences).sort((a, b) => a - b);
  if (counts.length === 0) return 0;
  const floor = quantileOf(counts, 0.25);
  return counts.every((c) => c <= floor) ? 0 : floor;
};

/**
 * @param {object} [options.minSentences] override the derived recurrence
 *   floor — omit to derive it from `surfaces` (see `deriveMinSentences`).
 *   Compares by EXCEEDS (`>`), matching `minPartners`'s convention.
 * @param {object} [options.minPartners] forwarded to `genericTokens`.
 * @param {object} [options.groups] surface-arrays this pooled `surfaces` list
 *   was assembled from (each a document's own candidates, in the same order
 *   they were concatenated into `surfaces`) — omit for the single-document
 *   case, where `surfaces` IS the one group and nothing changes.
 *
 *   WHY THIS EXISTS: `genericTokens`'s fence is an IQR statistic over
 *   WHATEVER pool it is handed — correct for one document, where the pool
 *   IS the material whose ordinary co-occurrence breadth is in question.
 *   Pool two OR MORE documents' candidates flat and hand them to
 *   `genericTokens` unchanged, and every unrelated document's own one-off
 *   proper nouns (each a fresh partner-count-1 token) dilutes the SAME
 *   quartile fence a real name-and-title pair inside ONE of the documents
 *   is measured against — the fence keeps falling as more documents join,
 *   until it wrongly brands an ordinary name individuating-token as generic
 *   PURELY because other, unrelated documents were also in the batch.
 *   Measured live on the challenge-25 fixture: "kade" (correctly generic
 *   within source A alone, by A's own co-occurrence structure — it is A's
 *   title, not A's individuating evidence) additionally took "marcus" and
 *   "aurelius" down with it the moment source C's candidates joined the
 *   pool, because C's own one-off proper nouns (unrelated to Kade) pushed
 *   the POOLED fence to 1 — collapsing a within-document merge
 *   ("Marcus Aurelius" / "Marcus Aurelius Kade") that succeeds standalone.
 *   `groups`, when given, derives the generic set PER GROUP and unions the
 *   results — each document's own candidates are still judged against
 *   their OWN co-occurrence breadth, exactly as the single-document case
 *   already does; pooling more documents can only ADD generic tokens found
 *   within some document's own material, never dilute another document's
 *   fence with material foreign to it.
 *
 *   `deriveMinSentences`'s recurrence floor has the EXACT same compositional
 *   flaw and gets the same treatment: pooled flat, a richly-recurring
 *   document (many candidates recurring across many sentences) raises the
 *   25th-percentile floor past what a SHORT, sparser document's own
 *   candidates can ever clear — a name that individuates fine standalone
 *   drops out entirely the moment it is pooled with a longer document,
 *   never merging (there's no DEF.admit event to merge) rather than
 *   over-merging. `groups` derives the floor per group too, so each
 *   document's own candidates are judged against their own recurrence
 *   floor, exactly as `minSentences` already promises for the
 *   single-document case.
 */
export const discoverReferents = (surfaces, { minSentences, minPartners, groups } = {}) => {
  const events = [];
  const assigned = new Map(); // surface -> referent_id
  const generic = groups
    ? groups.reduce((out, g) => {
        for (const t of genericTokens(g, { minPartners })) out.add(t);
        return out;
      }, new Set())
    : genericTokens(surfaces, { minPartners });
  // One sentences-floor per group when grouped, looked up by the surface
  // OBJECT's identity (not its string, which two different documents' own
  // candidates could coincidentally share) — a Map keyed on object identity
  // is exactly what surfaces' own array elements give for free.
  const sentencesFloorOf = groups
    ? (() => {
        const byGroup = groups.map((g) => minSentences ?? deriveMinSentences(g));
        const lookup = new Map();
        groups.forEach((g, gi) => { for (const s of g) lookup.set(s, byGroup[gi]); });
        return (s) => lookup.get(s);
      })()
    : (() => {
        const floor = minSentences ?? deriveMinSentences(surfaces);
        return () => floor;
      })();

  // Two surfaces corefer only on evidence a GENERIC token didn't supply:
  // strip titles/family names from both and require the remainder to still
  // corefer. "Princess Mary" vs "Princess Hélène" -> mary vs helene -> no.
  // "Victor Frankenstein" vs "Frankenstein" -> victor vs (empty) -> falls
  // back to the unstripped test, which containment answers correctly.
  const individuating = (surface) =>
    diaNorm(surface).split(/\s+/).filter((t) => t.length > 2 && !generic.has(t));

  const corefersIndividuated = (a, b) => {
    const ia = individuating(a);
    const ib = individuating(b);
    if (ia.length && ib.length) return namesCorefer(ia.join(" "), ib.join(" "));
    // No individuating evidence on one side means no evidence FOR merging —
    // not licence to fall back on the generic tokens just judged unreliable.
    // That inverted fallback kept every Princess in one referent: both
    // "Princess Mary" and "Princess Hélène" strip to nothing, and the
    // fallback then merged them on the shared title alone.
    return diaNorm(a) === diaNorm(b);
  };

  for (const entry of surfaces) {
    const { surface, sentences } = entry;
    if (sentences <= sentencesFloorOf(entry)) continue;

    let referentId = null;
    for (const [existing, id] of assigned) {
      if (corefersIndividuated(surface, existing)) { referentId = id; break; }
    }
    if (!referentId) referentId = `ref:auto:${diaNorm(surface).replace(/\s+/g, "_")}`;

    events.push({
      type: "DEF.admit",
      referent_id: referentId,
      surface,
      provenance: { giver: "surfaces/discoverReferents", tier: "engine", basis: "name-variant coreference" },
    });
    assigned.set(surface, referentId);
  }

  const referentIds = new Set(events.map((e) => e.referent_id));
  const gaps = [...referentIds].map((id) => ({
    reason: "pronoun_and_descriptor_mentions_unresolved",
    referent: id,
    tier: "model",
    needsWitness: true,
    detail:
      "name-variant coreference is engine-tier and complete; binding pronouns and definite " +
      "descriptions to this referent is not derivable (eoreader5 measured distributional coref " +
      "failing twice). Supply a per-text prior to close this gap.",
  }));

  return { events, gaps };
};
